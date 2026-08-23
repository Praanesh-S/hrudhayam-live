import fs from 'fs';

let content = fs.readFileSync('src/app/(dashboard)/checkin/checkin-client.tsx', 'utf8');

// Add admitCount to ScanResult interface
content = content.replace(
  'seatNo: string;',
  'seatNo: string;\n  admitCount?: number;'
);

content = content.replace(
  '<span className="text-white">{result.seatNo}</span>',
  '<span className="text-white">{result.seatNo} {result.admitCount && result.admitCount > 1 ? `(${result.admitCount} Seats)` : ""}</span>'
);

content = content.replace(
  '<h3 className="text-2xl font-bold text-white mb-2">{result.guestName}</h3>',
  '<h3 className="text-2xl font-bold text-white mb-2">{result.guestName} {result.admitCount && result.admitCount > 1 ? <span className="text-emerald-400 ml-2 text-xl">(Admit {result.admitCount})</span> : ""}</h3>'
);

fs.writeFileSync('src/app/(dashboard)/checkin/checkin-client.tsx', content);
