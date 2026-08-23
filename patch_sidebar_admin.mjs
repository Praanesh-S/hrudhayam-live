import fs from 'fs';
let content = fs.readFileSync('src/components/layout/Sidebar.tsx', 'utf8');

if (!content.includes('History')) {
  content = content.replace(
    "import {\n  LayoutDashboard,",
    "import {\n  LayoutDashboard,\n  History,"
  );
  
  content = content.replace(
    "{ name: 'Access Requests', href: '/admin/requests', icon: ClipboardList, roles: ['super_admin'] },",
    "{ name: 'Access Requests', href: '/admin/requests', icon: ClipboardList, roles: ['super_admin'] },\n    { name: 'Audit Logs', href: '/admin/audit-logs', icon: History, roles: ['super_admin'] },"
  );
}

fs.writeFileSync('src/components/layout/Sidebar.tsx', content);
