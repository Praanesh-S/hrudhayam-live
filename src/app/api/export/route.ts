import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import ExcelJS from 'exceljs';
import { fetchAllSeats } from '@/lib/seat-utils';
import { SPONSOR_TIERS } from '@/lib/sponsor-constants';
import { OBLIGATION_LABELS } from '@/lib/constants';

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminClient = createAdminClient();

  const { data: profile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const isSuperAdmin = profile?.role === 'super_admin';

  const { data: allProfiles } = await adminClient.from('profiles').select('id, full_name, email, role');
  const profileMap = new Map((allProfiles || []).map((p: any) => [p.id, p.full_name || p.email]));

  const { data: allSponsors } = await adminClient.from('sponsors').select('*');
  const sponsorMap = new Map((allSponsors || []).map((s: any) => [s.id, s.name]));

  const seats = await fetchAllSeats(adminClient, {
    ownerId: isSuperAdmin ? undefined : user.id,
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Hrudhayam LIVE';
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
  // Sheet 1: Summary Financials & Occupancy
  // ──────────────────────────────────────────────
  const sheetSummary = workbook.addWorksheet('Summary');
  sheetSummary.columns = [
    { header: 'Metric', key: 'metric', width: 32 },
    { header: 'Value', key: 'value', width: 22 },
  ];
  styleHeader(sheetSummary);

  const totalSeats = seats.length;
  const filledSeats = seats.filter(s => s.guest_name && s.guest_name.trim() !== '').length;
  const paidSeats = seats.filter(s => (s.payment_status || '').toLowerCase() === 'received').length;
  const checkedInSeats = seats.filter(s => s.checked_in).length;
  const totalValue = seats.reduce((sum, s) => sum + (s.tier || 0), 0);
  const collectedValue = seats
    .filter(s => (s.payment_status || '').toLowerCase() === 'received')
    .reduce((sum, s) => sum + (s.tier || 0), 0);
  const pendingValue = seats
    .filter(s => s.guest_name && (s.payment_status || '').toLowerCase() === 'pending')
    .reduce((sum, s) => sum + (s.tier || 0), 0);

  sheetSummary.addRows([
    { metric: 'Total Venue Capacity', value: totalSeats },
    { metric: 'Confirmed Guest Passes', value: filledSeats },
    { metric: 'Paid Donations (Passes)', value: paidSeats },
    { metric: 'Admitted / Checked In at Gate', value: checkedInSeats },
    { metric: 'Potential Revenue (INR)', value: `₹${totalValue.toLocaleString('en-IN')}` },
    { metric: 'Collected Revenue (INR)', value: `₹${collectedValue.toLocaleString('en-IN')}` },
    { metric: 'Pending Revenue (INR)', value: `₹${pendingValue.toLocaleString('en-IN')}` },
    { metric: 'Occupancy Rate', value: `${totalSeats > 0 ? Math.round((filledSeats / totalSeats) * 100) : 0}%` },
    { metric: 'Collection Rate', value: `${totalValue > 0 ? Math.round((collectedValue / totalValue) * 100) : 0}%` },
  ]);

  // ──────────────────────────────────────────────
  // Sheet 2: By Team Member
  // ──────────────────────────────────────────────
  const sheetTeam = workbook.addWorksheet('By Team Member');
  sheetTeam.columns = [
    { header: 'Team Member Name', key: 'name', width: 28 },
    { header: 'Email', key: 'email', width: 28 },
    { header: 'Rows In Charge', key: 'rows', width: 24 },
    { header: 'Seats Held', key: 'seatsHeld', width: 14 },
    { header: 'Filled Passes', key: 'filled', width: 14 },
    { header: 'Paid Passes', key: 'paid', width: 14 },
    { header: 'Tickets Sent', key: 'ticketsSent', width: 14 },
    { header: 'Checked In', key: 'checkedIn', width: 14 },
    { header: 'Potential Value (INR)', key: 'val', width: 20 },
    { header: 'Collected (INR)', key: 'rec', width: 20 },
    { header: 'Pending (INR)', key: 'pen', width: 20 },
  ];
  styleHeader(sheetTeam);

  (allProfiles || []).forEach(member => {
    const memberSeats = seats.filter(s => s.owner_id === member.id);
    if (memberSeats.length === 0 && !isSuperAdmin) return;
    const rows = [...new Set(memberSeats.map(s => `${s.section === 'Ground Floor' ? 'GF' : 'BAL'}-${s.row_label}`))].join(', ');
    const filled = memberSeats.filter(s => s.guest_name).length;
    const paid = memberSeats.filter(s => (s.payment_status || '').toLowerCase() === 'received').length;
    const sent = memberSeats.filter(s => s.ticket_sent).length;
    const checkedIn = memberSeats.filter(s => s.checked_in).length;
    const val = memberSeats.reduce((sum, s) => sum + (s.tier || 0), 0);
    const rec = memberSeats
      .filter(s => (s.payment_status || '').toLowerCase() === 'received')
      .reduce((sum, s) => sum + (s.tier || 0), 0);
    const pen = memberSeats
      .filter(s => s.guest_name && (s.payment_status || '').toLowerCase() === 'pending')
      .reduce((sum, s) => sum + (s.tier || 0), 0);

    sheetTeam.addRow({
      name: member.full_name || 'Team Member',
      email: member.email,
      rows: rows || 'Unassigned',
      seatsHeld: memberSeats.length,
      filled,
      paid,
      ticketsSent: sent,
      checkedIn,
      val: `₹${val.toLocaleString('en-IN')}`,
      rec: `₹${rec.toLocaleString('en-IN')}`,
      pen: `₹${pen.toLocaleString('en-IN')}`,
    });
  });

  // ──────────────────────────────────────────────
  // Sheet 3: By Pricing Tier
  // ──────────────────────────────────────────────
  const sheetTier = workbook.addWorksheet('By Pricing Tier');
  sheetTier.columns = [
    { header: 'Pricing Tier', key: 'tier', width: 22 },
    { header: 'Total Seats', key: 'total', width: 14 },
    { header: 'Filled Passes', key: 'filled', width: 14 },
    { header: 'Paid Passes', key: 'paid', width: 14 },
    { header: 'Potential Value (INR)', key: 'val', width: 22 },
    { header: 'Collected (INR)', key: 'rec', width: 22 },
    { header: 'Pending (INR)', key: 'pen', width: 22 },
  ];
  styleHeader(sheetTier);

  [5000, 3000, 1500].forEach(t => {
    const tierSeats = seats.filter(s => s.tier === t);
    const count = tierSeats.length;
    const filled = tierSeats.filter(s => s.guest_name).length;
    const paid = tierSeats.filter(s => (s.payment_status || '').toLowerCase() === 'received').length;
    sheetTier.addRow({
      tier: `₹${t.toLocaleString('en-IN')} Tier`,
      total: count,
      filled,
      paid,
      val: `₹${(count * t).toLocaleString('en-IN')}`,
      rec: `₹${(paid * t).toLocaleString('en-IN')}`,
      pen: `₹${((filled - paid) * t).toLocaleString('en-IN')}`,
    });
  });

  // ──────────────────────────────────────────────
  // Sheet 4: By Sponsor
  // ──────────────────────────────────────────────
  const sheetSponsors = workbook.addWorksheet('By Sponsor');
  sheetSponsors.columns = [
    { header: 'Sponsor Name', key: 'name', width: 28 },
    { header: 'Sponsorship Tier', key: 'tier', width: 24 },
    { header: 'Complimentary Entitlement', key: 'entitlement', width: 25 },
    { header: 'Seats Tagged', key: 'tagged', width: 15 },
    { header: 'Checked In', key: 'checkedIn', width: 15 },
    { header: 'Contact Person', key: 'contact', width: 24 },
    { header: 'Contact Phone / Email', key: 'contactInfo', width: 28 },
  ];
  styleHeader(sheetSponsors);

  (allSponsors || []).forEach(sp => {
    const taggedSeats = seats.filter(s => s.sponsor_id === sp.id);
    const checkedIn = taggedSeats.filter(s => s.checked_in).length;
    const tierConfig = SPONSOR_TIERS.find(t => t.value === sp.sponsor_tier);
    sheetSponsors.addRow({
      name: sp.name,
      tier: `${tierConfig?.label || sp.sponsor_tier} (₹${(tierConfig?.amount || 0).toLocaleString('en-IN')})`,
      entitlement: sp.complimentary_pass_count,
      tagged: taggedSeats.length,
      checkedIn,
      contact: sp.contact_name || '—',
      contactInfo: `${sp.contact_phone || ''} ${sp.contact_email || ''}`.trim() || '—',
    });
  });

  // ──────────────────────────────────────────────
  // Sheet 5: By Obligation
  // ──────────────────────────────────────────────
  const sheetObligation = workbook.addWorksheet('By Obligation');
  sheetObligation.columns = [
    { header: 'Obligation Category', key: 'category', width: 25 },
    { header: 'Total Seats', key: 'total', width: 15 },
    { header: 'Assigned Guests', key: 'filled', width: 15 },
    { header: 'Checked In', key: 'checkedIn', width: 15 },
    { header: 'Assigned Rows', key: 'rows', width: 25 },
  ];
  styleHeader(sheetObligation);

  ['chief', 'police', 'corp', 'other'].forEach(ob => {
    const obSeats = seats.filter(s => s.obligation === ob);
    const rows = [...new Set(obSeats.map(s => s.row_label))].join(', ');
    sheetObligation.addRow({
      category: OBLIGATION_LABELS[ob] || ob,
      total: obSeats.length,
      filled: obSeats.filter(s => s.guest_name).length,
      checkedIn: obSeats.filter(s => s.checked_in).length,
      rows: rows || '—',
    });
  });

  // ──────────────────────────────────────────────
  // Sheet 6: Full Seat List
  // ──────────────────────────────────────────────
  const sheetFull = workbook.addWorksheet('Full Seat List');
  sheetFull.columns = [
    { header: 'Seat ID', key: 'id', width: 14 },
    { header: 'Section', key: 'section', width: 15 },
    { header: 'Row', key: 'row_label', width: 10 },
    { header: 'Seat No', key: 'seat_no', width: 10 },
    { header: 'Tier (INR)', key: 'tier', width: 12 },
    { header: 'Assigned Member', key: 'owner', width: 25 },
    { header: 'Sponsor Tag', key: 'sponsor', width: 22 },
    { header: 'Obligation', key: 'obligation', width: 15 },
    { header: 'Guest Name', key: 'guest_name', width: 25 },
    { header: 'Guest Email', key: 'guest_email', width: 30 },
    { header: 'Phone', key: 'guest_phone', width: 15 },
    { header: 'Payment Status', key: 'payment_status', width: 15 },
    { header: 'Pass Code', key: 'pass_code', width: 12 },
    { header: 'Checked In', key: 'checked_in', width: 12 },
  ];
  styleHeader(sheetFull);

  seats.forEach(s => {
    sheetFull.addRow({
      id: s.id,
      section: s.section,
      row_label: s.row_label,
      seat_no: s.seat_no,
      tier: s.tier,
      owner: s.owner_id ? (profileMap.get(s.owner_id) || 'Team Member') : 'Unassigned',
      sponsor: s.sponsor_id ? (sponsorMap.get(s.sponsor_id) || 'Sponsor') : '—',
      obligation: s.obligation ? (OBLIGATION_LABELS[s.obligation] || s.obligation) : '—',
      guest_name: s.guest_name || '',
      guest_email: s.guest_email || '',
      guest_phone: s.guest_phone || '',
      payment_status: s.payment_status,
      pass_code: s.pass_code,
      checked_in: s.checked_in ? 'Yes' : 'No',
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  
  return new NextResponse(buffer, {
    headers: {
      'Content-Disposition': 'attachment; filename="Hrudhayam_LIVE_Financial_Report.xlsx"',
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }
  });
}
