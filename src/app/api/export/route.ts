import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import ExcelJS from 'exceljs';
import { fetchBandsWithMetrics } from '@/lib/band-utils';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // Fetch all tables
    const [bands, passesRes, membersRes, sponsorsRes, clubsRes] = await Promise.all([
      fetchBandsWithMetrics(adminClient),
      adminClient
        .from('passes')
        .select(`
          *,
          band:bands(label, price),
          seller:members(full_name, groups(name)),
          payments(mode, amount, reference_no, status)
        `)
        .order('created_at', { ascending: false }),
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
    ]);

    const passes = passesRes.data || [];
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
      { header: 'Metric', key: 'metric', width: 35 },
      { header: 'Value', key: 'value', width: 25 },
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
    const totalRaised = totalPassesCollected + sponsorsReceived;
    const fundedStations = Math.floor(totalRaised / 150000);

    sheetSummary.addRow({ metric: 'Total Seating Allocation (All Bands)', value: totalCap });
    sheetSummary.addRow({ metric: 'Total Passes Issued / Sold', value: totalSold });
    sheetSummary.addRow({ metric: 'Remaining Available Seats', value: totalRem });
    sheetSummary.addRow({ metric: 'Pass Sales Revenue Collected (₹)', value: totalPassesCollected });
    sheetSummary.addRow({ metric: 'Pass Sales Pending (₹)', value: totalPassesPending });
    sheetSummary.addRow({ metric: 'Sponsorships Received (₹)', value: sponsorsReceived });
    sheetSummary.addRow({ metric: 'Sponsorships Committed (₹)', value: sponsorsCommitted });
    sheetSummary.addRow({ metric: 'Total Net Funds Raised (₹)', value: totalRaised });
    styleHeader(sheetSummary);

    // ──────────────────────────────────────────────
    // Sheet 2: All Passes
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
    // Sheet 3: Groups & Members
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
    // Sheet 4: Sponsors
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
    // Sheet 5: Participating Clubs
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
