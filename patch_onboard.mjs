import fs from 'fs';

let content = fs.readFileSync('src/app/(auth)/onboard/actions.ts', 'utf8');

content = content.replace(
  "const shouldAutoApprove = isFirstSuperAdmin || requestedRole === 'super_admin';",
  "const shouldAutoApprove = isFirstSuperAdmin;" // ONLY auto-approve the first ever user
);

fs.writeFileSync('src/app/(auth)/onboard/actions.ts', content);
