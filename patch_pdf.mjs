import fs from 'fs';

let content = fs.readFileSync('src/components/pdf/TicketPdf.tsx', 'utf8');

content = content.replace(
  'OFFICIAL DONOR E-PASS • ADMIT ONE',
  'OFFICIAL DONOR E-PASS'
);

content = content.replace(
  'seatNo: string;',
  'seatNo: string;\n  admitCount?: number;'
);

content = content.replace(
  'seatNo,',
  'seatNo,\n  admitCount = 1,'
);

content = content.replace(
  '<Text style={styles.seatLabel}>SEAT NO</Text>',
  '<Text style={styles.seatLabel}>{admitCount > 1 ? "SEATS" : "SEAT NO"}</Text>'
);

content = content.replace(
  '<Text style={styles.badgeText}>OFFICIAL DONOR E-PASS</Text>',
  '<Text style={styles.badgeText}>OFFICIAL DONOR E-PASS • ADMIT {admitCount}</Text>'
);

fs.writeFileSync('src/components/pdf/TicketPdf.tsx', content);
