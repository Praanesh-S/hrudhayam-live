import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import ExcelJS from 'exceljs';
import { fetchAllSeats } from '@/lib/seat-utils';

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

  const { data: allProfiles } = await adminClient.from('profiles').select('id, full_name');
  const profileMap = new Map((allProfiles || []).map((p: any) => [p.id, p.full_name]));

  const seats = await fetchAllSeats(adminClient, {
    ownerId: isSuperAdmin ? undefined : user.id,
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Hrudhayam App';
  workbook.created = new Date();

  const headerStyle = {
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F2B3C' } } as ExcelJS.Fill,
    font: { color: { argb: 'FFFFFFFF' }, bold: true } as ExcelJS.Font
  };

  // Sheet 1: Full List
  const sheet1 = workbook.addWorksheet('Full Seat List');
  sheet1.columns = [
    { header: 'Seat ID', key: 'id', width: 14 },
    { header: 'Section', key: 'section', width: 15 },
    { header: 'Row', key: 'row_label', width: 10 },
    { header: 'Seat No', key: 'seat_no', width: 10 },
    { header: 'Tier (INR)', key: 'tier', width: 12 },
    { header: 'Assigned Member', key: 'owner', width: 25 },
    { header: 'Obligation', key: 'obligation', width: 15 },
    { header: 'Guest Name', key: 'guest_name', width: 25 },
    { header: 'Guest Email', key: 'guest_email', width: 30 },
    { header: 'Phone', key: 'guest_phone', width: 15 },
    { header: 'Payment Status', key: 'payment_status', width: 15 },
    { header: 'Pass Code', key: 'pass_code', width: 12 },
    { header: 'Checked In', key: 'checked_in', width: 12 },
  ];

  sheet1.getRow(1).eachCell((cell) => {
    cell.fill = headerStyle.fill;
    cell.font = headerStyle.font;
  });

  seats.forEach(s => {
    sheet1.addRow({
      id: s.id,
      section: s.section,
      row_label: s.row_label,
      seat_no: s.seat_no,
      tier: s.tier,
      owner: s.owner_id ? (profileMap.get(s.owner_id) || 'Team Member') : 'Unassigned',
      obligation: s.obligation,
      guest_name: s.guest_name || '',
      guest_email: s.guest_email || '',
      guest_phone: s.guest_phone || '',
      payment_status: s.payment_status,
      pass_code: s.pass_code,
      checked_in: s.checked_in ? 'Yes' : 'No'
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  
  return new NextResponse(buffer, {
    headers: {
      'Content-Disposition': 'attachment; filename="hrudhayam_export.xlsx"',
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }
  });
}
