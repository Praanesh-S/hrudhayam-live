import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const adminClient = createAdminClient();

    // Fetch all active passes sorted alphabetically by donor_name
    const { data: passes, error } = await adminClient
      .from('passes')
      .select(`
        id,
        pass_code,
        ticket_type,
        physical_serial,
        donor_name,
        donor_phone,
        status,
        used_at,
        band:bands(label, price),
        seller:members(full_name, groups(name))
      `)
      .neq('status', 'cancelled')
      .order('donor_name', { ascending: true });

    if (error) {
      return new Response('Database error generating manifest', { status: 500 });
    }

    const rows = passes || [];
    const printDate = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>HRUDHAYAM LIVE 2026 — Official Gate Admission Manifest</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #111;
      margin: 20px;
      font-size: 12px;
      line-height: 1.4;
    }
    .header {
      border-bottom: 2px solid #000;
      padding-bottom: 10px;
      margin-bottom: 15px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    h1 { margin: 0; font-size: 20px; text-transform: uppercase; letter-spacing: 0.5px; }
    .meta { font-size: 11px; color: #555; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    th, td {
      border: 1px solid #ccc;
      padding: 6px 8px;
      text-align: left;
    }
    th {
      background-color: #f2f2f2;
      font-weight: bold;
      font-size: 11px;
      text-transform: uppercase;
    }
    .code { font-family: monospace; font-weight: bold; }
    .box {
      width: 20px;
      height: 20px;
      border: 2px solid #333;
      display: inline-block;
      margin: 0 auto;
    }
    .btn-print {
      background: #0F2B3C;
      color: #fff;
      padding: 8px 16px;
      font-weight: bold;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      margin-bottom: 15px;
    }
    @media print {
      .btn-print { display: none; }
      body { margin: 10mm; font-size: 11px; }
      tr { page-break-inside: avoid; }
      thead { display: table-header-group; }
    }
  </style>
</head>
<body>
  <button class="btn-print" onclick="window.print()">🖨️ Print Manifest</button>

  <div class="header">
    <div>
      <h1>HRUDHAYAM LIVE 2026 — Official Gate Admission Manifest</h1>
      <div class="meta">Rotary Club of Aarch City Madras • The Music Academy, Chennai • 9 Oct 2026</div>
    </div>
    <div class="meta" style="text-align: right;">
      <strong>Total Active Passes:</strong> ${rows.length}<br>
      <strong>Generated:</strong> ${printDate} (IST)
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 30px;">#</th>
        <th>Donor Full Name</th>
        <th style="width: 95px;">Mobile</th>
        <th style="width: 85px;">Pass Code</th>
        <th style="width: 80px;">Type / Serial</th>
        <th>Price Band</th>
        <th style="width: 70px;">Status</th>
        <th style="width: 45px; text-align: center;">Tick [✓]</th>
      </tr>
    </thead>
    <tbody>
      ${rows
        .map((p: any, idx) => {
          const bandLabel = Array.isArray(p.band) ? p.band[0]?.label : p.band?.label;
          return `
      <tr>
        <td>${idx + 1}</td>
        <td><strong>${p.donor_name}</strong></td>
        <td>${p.donor_phone || '-'}</td>
        <td class="code">${p.pass_code}</td>
        <td>${p.ticket_type === 'physical' ? `Serial: <strong>${p.physical_serial || ''}</strong>` : 'Digital QR'}</td>
        <td>${bandLabel || ''}</td>
        <td>${p.status === 'used' ? 'Admitted' : 'Issued'}</td>
        <td style="text-align: center;"><div class="box"></div></td>
      </tr>`;
        })
        .join('')}
    </tbody>
  </table>
</body>
</html>`;

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (err: any) {
    return new Response('Failed to generate gate manifest', { status: 500 });
  }
}
