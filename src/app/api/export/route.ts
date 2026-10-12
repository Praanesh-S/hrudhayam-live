import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import ExcelJS from 'exceljs';
import { fetchBandsWithMetrics } from '@/lib/band-utils';
import { fetchAllPaginated } from '@/lib/db-utils';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // Fetch all tables
    const [bands, passes, membersRes, sponsorsRes, clubsRes, pendingPayments] = await Promise.all([
      fetchBandsWithMetrics(adminClient),
      fetchAllPaginated((from, to) =>
        adminClient
          .from('passes')
          .select(`
            *,
            band:bands(label, price),
            seller:members(full_name, groups(name)),
            payments(mode, amount, reference_no, status, legacy_discount_data)
          `, { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(from, to)
      ),
      adminClient
        .from('members')
        .select('*, groups(name)')
        .order('group_id')
        .order('full_name'),
      adminClient
        .from('sponsors')
        .select('*, brought_by:members(full_name)')
        .order('amount', { ascending: false }),
      adminClient
        .from('participating_clubs')
        .select('*')
        .order('created_at'),
      fetchAllPaginated((from, to) =>
        adminClient
          .from('payments')
          .select(`
            *,
            pass:passes(
              id, pass_code, band_id, ticket_type, physical_serial, donor_name, donor_phone, donor_email, status,
              seller:members(full_name, groups(name)),
              band:bands(label, price)
            ),
            sponsor:sponsors(
              id, sponsor_name, tier, amount, contact_name, contact_phone, contact_email, brought_by:members(full_name)
            ),
            club:participating_clubs(
              id, club_name, contact_name, contact_phone
            )
          `, { count: 'exact' })
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .range(from, to)
      ),
    ]);
    const members = membersRes.data || [];
    const sponsors = sponsorsRes.data || [];
    const clubs = clubsRes.data || [];

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Hrudhayam LIVE 2026';
    workbook.created = new Date();

    const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF131F2E' } } as ExcelJS.Fill;
    const headerFont = { color: { argb: 'FFFFFFFF' }, bold: true } as ExcelJS.Font;

    const styleHeader = (sheet: ExcelJS.Worksheet) => {
      sheet.getRow(1).eachCell((cell) => {
        cell.fill = headerFill;
        cell.font = headerFont;
        cell.alignment = { vertical: 'middle' };
      });
      sheet.getRow(1).height = 24;
    };

    // ──────────────────────────────────────────────
    // Sheet 1: Executive Summary
    // ──────────────────────────────────────────────
    const sheetSummary = workbook.addWorksheet('Summary');
    sheetSummary.columns = [
      { header: 'Metric', key: 'metric', width: 42 },
      { header: 'Value', key: 'value', width: 28 },
    ];

    const totalCap = bands.reduce((sum, b) => sum + (b.total_allocated || 0), 0);
    const activePasses = passes.filter((p) => p.status !== 'cancelled');
    const totalSold = activePasses.length;
    const totalRem = bands.reduce((sum, b) => sum + (b.remaining_count || 0), 0);
    const totalCheckedIn = passes.filter((p) => p.status === 'used').length;

    let totalPassesCollected = 0;
    let totalPassesPending = 0;

    for (const p of activePasses) {
      const pays = (p as any).payments;
      if (Array.isArray(pays)) {
        for (const pay of pays) {
          if (pay.status === 'received') totalPassesCollected += pay.amount || 0;
          else totalPassesPending += pay.amount || 0;
        }
      }
    }

    const sponsorsReceived = sponsors.filter((s) => s.status === 'received').reduce((sum, s) => sum + s.amount, 0);
    const sponsorsCommitted = sponsors.filter((s) => s.status === 'committed').reduce((sum, s) => sum + s.amount, 0);
    const clubsTotalEntryFees = clubs.reduce((sum, c) => sum + (c.entry_fee || 25000), 0);
    const totalCollected = totalPassesCollected + sponsorsReceived + clubsTotalEntryFees;
    const totalPending = totalPassesPending + sponsorsCommitted;
    const totalCollectable = totalCollected + totalPending;

    sheetSummary.addRow({ metric: 'Total Seating Allocation (All Bands)', value: totalCap });
    sheetSummary.addRow({ metric: 'Total Passes Issued / Sold', value: totalSold });
    sheetSummary.addRow({ metric: 'Remaining Available Seats', value: totalRem });
    sheetSummary.addRow({ metric: 'Pass Sales Revenue Collected (₹)', value: totalPassesCollected });
    sheetSummary.addRow({ metric: 'Pass Sales Pending Receivables (₹)', value: totalPassesPending });
    sheetSummary.addRow({ metric: 'Sponsorships Received (₹)', value: sponsorsReceived });
    sheetSummary.addRow({ metric: 'Sponsorships Committed (₹)', value: sponsorsCommitted });
    sheetSummary.addRow({ metric: 'Participating Clubs Entry Fees (₹)', value: clubsTotalEntryFees });
    sheetSummary.addRow({ metric: 'Total Confirmed Funds Collected (₹)', value: totalCollected });
    sheetSummary.addRow({ metric: 'Total Pending Receivables (₹)', value: totalPending });
    sheetSummary.addRow({ metric: 'Total Amount Collectable (Target ₹)', value: totalCollectable });
    styleHeader(sheetSummary);

    // ──────────────────────────────────────────────
    // Sheet 2: Pending Payments by Person (Combined & Aggregated)
    // ──────────────────────────────────────────────
    const activePendingPayments = pendingPayments.filter((p) => {
      if (p.pass && p.pass.status === 'cancelled') return false;
      return true;
    });

    interface GroupedPendingPerson {
      key: string;
      name: string;
      phone: string;
      email: string;
      totalPendingAmount: number;
      passesCount: number;
      bandsCount: Map<string, number>;
      passCodes: string[];
      serials: string[];
      sellers: Set<string>;
      teams: Set<string>;
      modes: Set<string>;
      notes: Set<string>;
      references: Set<string>;
      transactionCount: number;
    }

    const pendingByPerson = new Map<string, GroupedPendingPerson>();

    for (const p of activePendingPayments) {
      const pass = p.pass;
      const sponsor = p.sponsor;
      const club = p.club;

      const rawName = pass?.donor_name || sponsor?.sponsor_name || club?.club_name || 'Direct Donor';
      const rawPhone = pass?.donor_phone || sponsor?.contact_phone || club?.contact_phone || '';
      const rawEmail = pass?.donor_email || sponsor?.contact_email || '';

      // Normalize phone (digits only, last 10 digits for matching same donor across multiple sales)
      const digitsOnly = rawPhone.replace(/\D/g, '');
      const cleanPhone = digitsOnly.length >= 10 ? digitsOnly.slice(-10) : digitsOnly;
      const cleanName = rawName.trim().toLowerCase().replace(/\s+/g, ' ');

      // Group key: clean phone if valid, otherwise clean name
      const personKey = cleanPhone ? `phone:${cleanPhone}` : `name:${cleanName}`;

      if (!pendingByPerson.has(personKey)) {
        pendingByPerson.set(personKey, {
          key: personKey,
          name: rawName.trim(),
          phone: rawPhone.trim() || '-',
          email: rawEmail.trim() || '-',
          totalPendingAmount: 0,
          passesCount: 0,
          bandsCount: new Map(),
          passCodes: [],
          serials: [],
          sellers: new Set(),
          teams: new Set(),
          modes: new Set(),
          notes: new Set(),
          references: new Set(),
          transactionCount: 0,
        });
      }

      const person = pendingByPerson.get(personKey)!;
      person.totalPendingAmount += p.amount || 0;
      person.transactionCount += 1;

      if (pass) {
        person.passesCount += 1;
        if (pass.pass_code) person.passCodes.push(pass.pass_code);
        if (pass.physical_serial) person.serials.push(pass.physical_serial);

        const bandLabel = pass.band?.label || pass.band_id || 'General';
        person.bandsCount.set(bandLabel, (person.bandsCount.get(bandLabel) || 0) + 1);

        if (pass.seller?.full_name) person.sellers.add(pass.seller.full_name);
        if (pass.seller?.groups?.name) person.teams.add(pass.seller.groups.name);
      } else if (sponsor) {
        person.bandsCount.set(`Sponsor (${sponsor.tier || 'Direct'})`, 1);
        if (sponsor.brought_by?.full_name) person.sellers.add(sponsor.brought_by.full_name);
      } else if (club) {
        person.bandsCount.set('Participating Club', 1);
      }

      if (p.mode) person.modes.add(p.mode.toUpperCase());
      if (p.reference_no) person.references.add(p.reference_no);

      const discountReason = (p.legacy_discount_data as any)?.reason;
      if (discountReason && String(discountReason).trim()) {
        person.notes.add(String(discountReason).trim());
      }
    }

    const sortedPendingPersons = Array.from(pendingByPerson.values()).sort((a, b) => {
      if (b.totalPendingAmount !== a.totalPendingAmount) {
        return b.totalPendingAmount - a.totalPendingAmount;
      }
      return a.name.localeCompare(b.name);
    });

    const sheetPendingPersons = workbook.addWorksheet('Pending by Person');
    sheetPendingPersons.columns = [
      { header: 'S.No', key: 'sno', width: 8 },
      { header: 'Person / Donor Name', key: 'name', width: 28 },
      { header: 'Mobile Number', key: 'phone', width: 16 },
      { header: 'Email', key: 'email', width: 24 },
      { header: 'Total Pending Amount (₹)', key: 'amount', width: 24 },
      { header: 'Passes Count', key: 'passes_count', width: 14 },
      { header: 'Seating Bands Breakdown', key: 'bands', width: 32 },
      { header: 'Pass Codes', key: 'pass_codes', width: 34 },
      { header: 'Physical Ticket Serials', key: 'serials', width: 22 },
      { header: 'Attributed Seller Member(s)', key: 'sellers', width: 26 },
      { header: 'Seller Team(s)', key: 'teams', width: 18 },
      { header: 'Payment Mode(s)', key: 'modes', width: 16 },
      { header: 'Transactions Count', key: 'tx_count', width: 18 },
      { header: 'Adjustment / Note', key: 'notes', width: 30 },
    ];

    let grandTotalPending = 0;
    let grandTotalPasses = 0;

    sortedPendingPersons.forEach((person, idx) => {
      grandTotalPending += person.totalPendingAmount;
      grandTotalPasses += person.passesCount;

      const bandsBreakdown = Array.from(person.bandsCount.entries())
        .map(([b, count]) => `${b} (${count})`)
        .join(', ');

      sheetPendingPersons.addRow({
        sno: idx + 1,
        name: person.name,
        phone: person.phone,
        email: person.email,
        amount: person.totalPendingAmount,
        passes_count: person.passesCount,
        bands: bandsBreakdown || '-',
        pass_codes: person.passCodes.join(', ') || '-',
        serials: person.serials.join(', ') || '-',
        sellers: Array.from(person.sellers).join(', ') || '-',
        teams: Array.from(person.teams).join(', ') || '-',
        modes: Array.from(person.modes).join(', ') || 'PENDING',
        tx_count: person.transactionCount,
        notes: Array.from(person.notes).join('; ') || '-',
      });
    });

    // Add Grand Total Row for Pending by Person
    const grandRow = sheetPendingPersons.addRow({
      sno: '',
      name: 'GRAND TOTAL PENDING RECEIVABLES',
      phone: '',
      email: '',
      amount: grandTotalPending,
      passes_count: grandTotalPasses,
      bands: `${sortedPendingPersons.length} Unique Donors / Persons`,
      pass_codes: '',
      serials: '',
      sellers: '',
      teams: '',
      modes: '',
      tx_count: activePendingPayments.length,
      notes: '',
    });

    grandRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFEF3C7' }, // Soft warm amber highlight
      } as ExcelJS.Fill;
      cell.font = {
        bold: true,
        color: { argb: 'FF92400E' },
        size: 11,
      };
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'double' },
      };
    });

    styleHeader(sheetPendingPersons);

    // ──────────────────────────────────────────────
    // Sheet 3: Pending Payments Detail (Itemized)
    // ──────────────────────────────────────────────
    const sheetPendingDetail = workbook.addWorksheet('Pending Payments Detail');
    sheetPendingDetail.columns = [
      { header: 'Pass Code', key: 'pass_code', width: 14 },
      { header: 'Price Band', key: 'band', width: 24 },
      { header: 'Ticket Type', key: 'ticket_type', width: 14 },
      { header: 'Physical Serial', key: 'serial', width: 16 },
      { header: 'Donor Name', key: 'donor_name', width: 26 },
      { header: 'Donor Mobile', key: 'donor_phone', width: 16 },
      { header: 'Pending Amount (₹)', key: 'amount', width: 20 },
      { header: 'Seller Member', key: 'seller_name', width: 26 },
      { header: 'Seller Team', key: 'seller_team', width: 16 },
      { header: 'Payment Mode', key: 'mode', width: 14 },
      { header: 'Reference / UTR', key: 'ref', width: 20 },
      { header: 'Adjustment / Note', key: 'notes', width: 30 },
      { header: 'Issue Date', key: 'date', width: 18 },
    ];

    activePendingPayments.forEach((p) => {
      const pass = p.pass;
      const discountReason = (p.legacy_discount_data as any)?.reason;

      sheetPendingDetail.addRow({
        pass_code: pass?.pass_code || (p.sponsor ? `SPONSOR-${p.sponsor.tier}` : 'DIRECT'),
        band: pass?.band?.label || pass?.band_id || (p.sponsor ? `Sponsor (${p.sponsor.tier})` : 'Club'),
        ticket_type: pass?.ticket_type ? pass.ticket_type.toUpperCase() : 'N/A',
        serial: pass?.physical_serial || '-',
        donor_name: pass?.donor_name || p.sponsor?.sponsor_name || p.club?.club_name || 'Donor',
        donor_phone: pass?.donor_phone || p.sponsor?.contact_phone || p.club?.contact_phone || '-',
        amount: p.amount || 0,
        seller_name: pass?.seller?.full_name || p.sponsor?.brought_by?.full_name || '-',
        seller_team: pass?.seller?.groups?.name || '-',
        mode: p.mode ? p.mode.toUpperCase() : 'PENDING',
        ref: p.reference_no || '-',
        notes: discountReason || '-',
        date: p.created_at ? new Date(p.created_at).toLocaleDateString('en-IN') : '-',
      });
    });

    const detailGrandRow = sheetPendingDetail.addRow({
      pass_code: 'TOTAL',
      band: `${activePendingPayments.length} Items`,
      ticket_type: '',
      serial: '',
      donor_name: `${sortedPendingPersons.length} Persons`,
      donor_phone: '',
      amount: grandTotalPending,
      seller_name: '',
      seller_team: '',
      mode: '',
      ref: '',
      notes: '',
      date: '',
    });

    detailGrandRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFEF3C7' },
      } as ExcelJS.Fill;
      cell.font = { bold: true, color: { argb: 'FF92400E' } };
      cell.border = { top: { style: 'thin' }, bottom: { style: 'double' } };
    });

    styleHeader(sheetPendingDetail);

    // ──────────────────────────────────────────────
    // Sheet 4: All Passes
    // ──────────────────────────────────────────────
    const sheetPasses = workbook.addWorksheet('All Passes');
    sheetPasses.columns = [
      { header: 'Pass Code', key: 'pass_code', width: 14 },
      { header: 'Price Band', key: 'band', width: 20 },
      { header: 'Ticket Type', key: 'ticket_type', width: 12 },
      { header: 'Physical Serial', key: 'serial', width: 15 },
      { header: 'Donor Name', key: 'donor_name', width: 25 },
      { header: 'Donor Mobile', key: 'donor_phone', width: 16 },
      { header: 'Donor Email', key: 'donor_email', width: 25 },
      { header: 'Seller Member', key: 'seller_name', width: 25 },
      { header: 'Seller Team', key: 'seller_team', width: 14 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Gate Admitted At', key: 'used_at', width: 20 },
      { header: 'Payment Mode', key: 'pay_mode', width: 14 },
      { header: 'Payment Amount (₹)', key: 'amount', width: 18 },
      { header: 'Payment Status', key: 'pay_status', width: 14 },
      { header: 'Reference / UTR', key: 'reference_no', width: 22 },
    ];

    passes.forEach((p) => {
      const pay = Array.isArray(p.payments) && p.payments.length > 0 ? p.payments[0] : null;

      sheetPasses.addRow({
        pass_code: p.pass_code,
        band: p.band?.label || p.band_id,
        ticket_type: p.ticket_type,
        serial: p.physical_serial || '-',
        donor_name: p.donor_name,
        donor_phone: p.donor_phone,
        donor_email: p.donor_email || '-',
        seller_name: p.seller?.full_name || 'Direct / Fallback',
        seller_team: p.seller?.groups?.name || '-',
        status: p.status.toUpperCase(),
        used_at: p.used_at ? new Date(p.used_at).toLocaleString('en-IN') : '-',
        pay_mode: pay?.mode ? pay.mode.toUpperCase() : '-',
        amount: pay?.amount ?? p.band?.price ?? 0,
        pay_status: pay?.status ? pay.status.toUpperCase() : 'PENDING',
        reference_no: pay?.reference_no || '-',
      });
    });
    styleHeader(sheetPasses);

    // ──────────────────────────────────────────────
    // Sheet 5: Groups & Members
    // ──────────────────────────────────────────────
    const sheetMembers = workbook.addWorksheet('Roster & Attribution');
    sheetMembers.columns = [
      { header: 'Team', key: 'team', width: 12 },
      { header: 'Member Name', key: 'name', width: 30 },
      { header: 'Role', key: 'role', width: 16 },
      { header: 'Mobile Number', key: 'phone', width: 18 },
      { header: 'Phone Status', key: 'phone_status', width: 14 },
    ];

    members.forEach((m) => {
      sheetMembers.addRow({
        team: m.groups?.name || `Team ${m.group_id}`,
        name: m.full_name,
        role: m.is_group_admin ? 'Team Coordinator' : 'Member',
        phone: m.phone_raw,
        phone_status: m.phone_status.toUpperCase(),
      });
    });
    styleHeader(sheetMembers);

    // ──────────────────────────────────────────────
    // Sheet 6: Sponsors
    // ──────────────────────────────────────────────
    const sheetSponsors = workbook.addWorksheet('Sponsors');
    sheetSponsors.columns = [
      { header: 'Sponsor Name', key: 'name', width: 30 },
      { header: 'Tier', key: 'tier', width: 20 },
      { header: 'Amount (₹)', key: 'amount', width: 16 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Brought By Member', key: 'brought_by', width: 25 },
      { header: 'Contact Person', key: 'contact', width: 20 },
      { header: 'Phone', key: 'phone', width: 16 },
    ];

    sponsors.forEach((s) => {
      sheetSponsors.addRow({
        name: s.sponsor_name,
        tier: s.tier,
        amount: s.amount,
        status: s.status.toUpperCase(),
        brought_by: s.brought_by?.full_name || 'Club Direct',
        contact: s.contact_name || '-',
        phone: s.contact_phone || '-',
      });
    });
    styleHeader(sheetSponsors);

    // ──────────────────────────────────────────────
    // Sheet 7: Participating Clubs
    // ──────────────────────────────────────────────
    const sheetClubs = workbook.addWorksheet('Participating Clubs');
    sheetClubs.columns = [
      { header: 'Club Name', key: 'name', width: 30 },
      { header: 'Contact Person', key: 'contact', width: 22 },
      { header: 'Mobile Number', key: 'phone', width: 18 },
      { header: 'Entry Fee (₹)', key: 'fee', width: 16 },
      { header: 'Passes Value (₹)', key: 'passes', width: 16 },
      { header: 'Net Contribution (₹)', key: 'net', width: 18 },
    ];

    clubs.forEach((c) => {
      sheetClubs.addRow({
        name: c.club_name,
        contact: c.contact_name,
        phone: c.contact_phone,
        fee: c.entry_fee,
        passes: c.passes_value,
        net: c.net_contribution,
      });
    });
    styleHeader(sheetClubs);

    const buffer = await workbook.xlsx.writeBuffer();

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Hrudhayam_LIVE_Master_Export_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  } catch (err: any) {
    console.error('Export error:', err);
    return NextResponse.json({ error: err.message || 'Export failed' }, { status: 500 });
  }
}
