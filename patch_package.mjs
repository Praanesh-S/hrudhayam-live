import fs from 'fs';
let content = fs.readFileSync('package.json', 'utf8');
content = content.replace(/"name": "clever-raman"/, '"name": "hrudhayam-live"');
fs.writeFileSync('package.json', content);
