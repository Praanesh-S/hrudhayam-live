import fs from 'fs';
let content = fs.readFileSync('src/lib/audit.ts', 'utf8');
content = content.replace("| 'invite_user';", "| 'invite_user'\n  | 'update_user';");
fs.writeFileSync('src/lib/audit.ts', content);
