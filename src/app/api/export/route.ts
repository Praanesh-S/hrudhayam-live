import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import ExcelJS from 'exceljs';
import { fetchBandsWithMetrics } from '@/lib/band-utils';

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // Fetch all data in parallel
    const [bands, salesRes, profilesRes, sponsorsRes, poolsRes] = await Promise.all([
      fetchBandsWithMetrics(adminClient),
      adminClient
        .from('sales')
        .select('*, band:bands(name, standard_price), seller:profiles!sales_sold_by_fkey(full_name, email), sponsor:sponsors(name)')
        .eq('cancelled', false)
        .order('created_at', { ascending: false }),
      adminClient.from('profiles').select('id, full_name, email, role').eq('is_active', true),
      adminClient.from('sponsors').select('*').order('name'),
      adminClient.from('reserved_pools').select('*, entries:reserved_entries(*)').order('display_order'),
    ]);

    const sales = salesRes.data || [];
    const profiles = profilesRes.data || [];
    const sponsors = sponsorsRes.data || [];
    const pools = poolsRes.data || [];

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Hrudhayam LIVE 2026';
    workbook.created = new Date();

    const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F2B3C' } } as ExcelJS.Fill;
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
      { header: 'Metric', key: 'metric', width: 32 },
      { header: 'Value', key: 'value', width: 25 },
    ];

    const totalCap = bands.reduce((sum, b) => sum + b.total_capacity, 0);
    const totalSold = sales.length;
    const totalRem = Math.max(0, totalCap - totalSold);
    const totalCollected = sales.filter(s => s.payment_status === 'paid').reduce((sum, s) => sum + (s.collected_amount || s.standard_price), 0);
    const totalPending = sales.filter(s => s.payment_status === 'pending').reduce((sum, s) => sum + (s.standard_price - (s.discount_amount || 0)), 0);
    const totalDiscounts = sales.reduce((sum, s) => sum + (s.discount_amount || 0), 0);
    const totalAdmitted = sales.filter(s => s.checked_in).length;

    sheetSummary.addRow({ metric: 'Total Commercial Capacity (All Bands)', value: totalCap });
    sheetSummary.addRow({ metric: 'Total Seats Sold', value: totalSold });
    sheetSummary.addRow({ metric: 'Remaining Available Seats', value: totalRem });
    sheetSummary.addRow({ metric: 'Commercial Occupancy %', value: totalCap > 0 ? `${Math.round((totalSold / totalCap) * 100)}%` : '0%' });
    sheetSummary.addRow({ metric: 'Confirmed Collected Revenue (INR)', value: totalCollected });
    sheetSummary.addRow({ metric: 'Pending Revenue (INR)', value: totalPending });
    sheetSummary.addRow({ metric: 'Total Potential Revenue (INR)', value: totalCollected + totalPending });
    sheetSummary.addRow({ metric: 'Total Concessions / Discounts Given (INR)', value: totalDiscounts });
    sheetSummary.addRow({ metric: 'Total Gate Check-ins Admitted', value: totalAdmitted });
    styleHeader(sheetSummary);

    // ──────────────────────────────────────────────
    // Sheet 2: By Price Band
    // ──────────────────────────────────────────────
    const sheetBands = workbook.addWorksheet('By Price Band');
    sheetBands.columns = [
      { header: 'Band Name', key: 'name', width: 22 },
      { header: 'Standard Price (₹)', key: 'price', width: 18 },
      { header: 'Total Capacity', key: 'capacity', width: 16 },
      { header: 'Sold Seats', key: 'sold', width: 14 },
      { header: 'Remaining Seats', key: 'remaining', width: 16 },
      { header: 'Collected (₹)', key: 'collected', width: 18 },
      { header: 'Pending (₹)', key: 'pending', width: 18 },
      { header: 'Discounts (₹)', key: 'discounts', width: 16 },
      { header: 'Occupancy %', key: 'occupancy', width: 14 },
    ];

    bands.forEach((b) => {
      const sold = b.sold_count || 0;
      const cap = b.total_capacity || 0;
      const rem = b.remaining_count || 0;
      sheetBands.addRow({
        name: b.name,
        price: b.standard_price,
        capacity: cap,
        sold,
        remaining: rem,
        collected: b.collected_amount || 0,
        pending: b.pending_amount || 0,
        discounts: b.discount_amount || 0,
        occupancy: cap > 0 ? `${Math.round((sold / cap) * 100)}%` : '0%',
      });
    });
    styleHeader(sheetBands);

    // ──────────────────────────────────────────────
    // Sheet 3: By Team Member
    // ──────────────────────────────────────────────
    const sheetTeam = workbook.addWorksheet('By Team Member');
    sheetTeam.columns = [
      { header: 'Team Member Name', key: 'name', width: 24 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Role', key: 'role', width: 16 },
      { header: 'Seats Sold', key: 'sold', width: 14 },
      { header: 'Standard Value (₹)', key: 'standardValue', width: 18 },
      { header: 'Collected (₹)', key: 'collected', width: 18 },
      { header: 'Pending (₹)', key: 'pending', width: 18 },
      { header: 'Discounts (₹)', key: 'discounts', width: 16 },
      { header: 'WhatsApp Passes', key: 'whatsapp', width: 16 },
      { header: 'Printed Tickets', key: 'printed', width: 16 },
    ];

    profiles.forEach((p) => {
      const pSales = sales.filter(s => s.sold_by === p.id);
      if (pSales.length > 0 || p.role === 'sub_admin' || p.role === 'super_admin') {
        const sold = pSales.length;
        const stdVal = pSales.reduce((sum, s) => sum + s.standard_price, 0);
        const col = pSales.filter(s => s.payment_status === 'paid').reduce((sum, s) => sum + (s.collected_amount || s.standard_price), 0);
        const pen = pSales.filter(s => s.payment_status === 'pending').reduce((sum, s) => sum + (s.standard_price - (s.discount_amount || 0)), 0);
        const disc = pSales.reduce((sum, s) => sum + (s.discount_amount || 0), 0);
        const wa = pSales.filter(s => s.issuance_type === 'whatsapp').length;
        const pr = pSales.filter(s => s.issuance_type === 'printed').length;

        sheetTeam.addRow({
          name: p.full_name || 'Team Member',
          email: p.email,
          role: p.role || 'sub_admin',
          sold,
          standardValue: stdVal,
          collected: col,
          pending: pen,
          discounts: disc,
          whatsapp: wa,
          printed: pr,
        });
      }
    });
    styleHeader(sheetTeam);

    // ──────────────────────────────────────────────
    // Sheet 4: By Sponsor
    // ──────────────────────────────────────────────
    const sheetSponsors = workbook.addWorksheet('By Sponsor');
    sheetSponsors.columns = [
      { header: 'Sponsor Name', key: 'name', width: 26 },
      { header: 'Sponsor Tier', key: 'tier', width: 20 },
      { header: 'Complimentary Quota', key: 'quota', width: 20 },
      { header: 'Passes Tagged', key: 'tagged', width: 16 },
      { header: 'Gate Checked In', key: 'checkedIn', width: 16 },
    ];

    sponsors.forEach((sp) => {
      const spSales = sales.filter(s => s.sponsor_id === sp.id);
      sheetSponsors.addRow({
        name: sp.name,
        tier: sp.sponsor_tier.replace('_', ' '),
        quota: sp.complimentary_pass_count,
        tagged: spSales.length,
        checkedIn: spSales.filter(s => s.checked_in).length,
      });
    });
    styleHeader(sheetSponsors);

    // ──────────────────────────────────────────────
    // Sheet 5: Reserved Quotas
    // ──────────────────────────────────────────────
    const sheetPools = workbook.addWorksheet('Reserved Quotas');
    sheetPools.columns = [
      { header: 'Category', key: 'category', width: 18 },
      { header: 'Pool Name', key: 'name', width: 26 },
      { header: 'Set Aside Count', key: 'count', width: 16 },
      { header: 'Named Guests Count', key: 'named', width: 20 },
    ];

    pools.forEach((pool) => {
      sheetPools.addRow({
        category: pool.category,
        name: pool.name,
        count: pool.total_count,
        named: pool.entries?.length || 0,
      });
    });
    styleHeader(sheetPools);

    // ──────────────────────────────────────────────
    // Sheet 6: Full Sales Master List
    // ──────────────────────────────────────────────
    const sheetMaster = workbook.addWorksheet('Full Sales Master');
    sheetMaster.columns = [
      { header: 'Pass Code', key: 'passCode', width: 14 },
      { header: 'Donor Name', key: 'donorName', width: 22 },
      { header: 'Mobile Number', key: 'phone', width: 16 },
      { header: 'Price Band', key: 'band', width: 18 },
      { header: 'Standard Price (₹)', key: 'standardPrice', width: 16 },
      { header: 'Collected Amount (₹)', key: 'collected', width: 18 },
      { header: 'Discount Amount (₹)', key: 'discount', width: 16 },
      { header: 'Payment Status', key: 'payment', width: 16 },
      { header: 'Issuance Channel', key: 'issuance', width: 18 },
      { header: 'Sold By', key: 'seller', width: 20 },
      { header: 'Gate Checked In', key: 'checkedIn', width: 16 },
      { header: 'Checked In At', key: 'checkedInAt', width: 20 },
      { header: 'Sponsor Tag', key: 'sponsor', width: 20 },
      { header: 'Notes / Comment', key: 'comment', width: 26 },
    ];

    sales.forEach((s) => {
      sheetMaster.addRow({
        passCode: s.pass_code,
        donorName: s.donor_name,
        phone: s.donor_phone,
        band: s.band?.name || 'Band',
        standardPrice: s.standard_price,
        collected: s.collected_amount,
        discount: s.discount_amount,
        payment: s.payment_status.toUpperCase(),
        issuance: s.issuance_type ? s.issuance_type.toUpperCase() : 'UNISSUED',
        seller: s.seller?.full_name || 'Team',
        checkedIn: s.checked_in ? 'YES' : 'NO',
        checkedInAt: s.checked_in_at ? new Date(s.checked_in_at).toLocaleString('en-IN') : '-',
        sponsor: s.sponsor?.name || '-',
        comment: s.comment || '-',
      });
    });
    styleHeader(sheetMaster);

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Hrudhayam-Live-Reconciliation-${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    });
  } catch (err: any) {
    console.error('Excel Export Error:', err);
    return NextResponse.json({ error: err.message || 'Export failed' }, { status: 500 });
  }
}
