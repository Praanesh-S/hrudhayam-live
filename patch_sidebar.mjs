import fs from 'fs';

let content = fs.readFileSync('src/components/layout/Sidebar.tsx', 'utf8');

const adminSection = `
        <div className="pt-4 mt-4 border-t border-[#1E3A4C]">
          <p className="px-3 mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">
            Administration
          </p>
          <NavItem href="/admin/users" icon={ShieldAlert}>User Management</NavItem>
          <NavItem href="/admin/requests" icon={ShieldAlert}>Access Requests</NavItem>
          <NavItem href="/admin/audit-logs" icon={ShieldAlert}>Audit Logs</NavItem>
        </div>
`;

content = content.replace(
  /<div className="pt-4 mt-4 border-t border-\[#1E3A4C\]">[\s\S]*?<\/div>/,
  adminSection.trim()
);

fs.writeFileSync('src/components/layout/Sidebar.tsx', content);
