'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  History,
  Layers,
  Users,
  ScanLine,
  BarChart3,
  Building2,
  PlusCircle,
  Trophy,
  CreditCard,
  Ticket,
  Heart,
  ShieldCheck,
  RotateCcw,
  MessageSquare
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AuthUser } from '@/lib/auth/session';
import { ThemeToggle } from '@/components/theme-toggle';

interface SidebarProps {
  user: AuthUser;
}

export function SidebarContent({ user, onNavigate }: { user: AuthUser; onNavigate?: () => void }) {
  const pathname = usePathname();

  const mainNavItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['super_admin', 'group_admin', 'system_admin', 'tech_coordinator'] },
    { name: 'Sell a Pass', href: '/sell', icon: PlusCircle, roles: ['super_admin', 'group_admin', 'system_admin', 'tech_coordinator'] },
    { name: 'WhatsApp Comms', href: '/email', icon: MessageSquare, roles: ['super_admin', 'group_admin', 'system_admin', 'tech_coordinator'] },
    { name: 'Leaderboards', href: '/leaderboard', icon: Trophy, roles: ['super_admin', 'group_admin', 'system_admin', 'tech_coordinator'] },
    { name: 'Participating Clubs', href: '/clubs', icon: Building2, roles: ['super_admin', 'group_admin', 'system_admin', 'tech_coordinator'] },
    { name: 'Payments & Collections', href: '/payments', icon: CreditCard, roles: ['super_admin', 'group_admin', 'system_admin', 'tech_coordinator'] },
    { name: 'Passes & Guests', href: '/guests', icon: Ticket, roles: ['super_admin', 'group_admin', 'system_admin', 'tech_coordinator'] },
    { name: 'Reports & Export', href: '/reports', icon: BarChart3, roles: ['super_admin', 'group_admin', 'system_admin', 'tech_coordinator'] },
  ];

  const adminNavItems = [
    { name: 'Bands & Protected Seats', href: '/admin/bands', icon: Layers, roles: ['super_admin', 'system_admin'] },
    { name: 'Groups, Members & Logins', href: '/admin/users', icon: Users, roles: ['super_admin', 'system_admin'] },
    { name: 'Sponsors', href: '/admin/sponsors', icon: Building2, roles: ['super_admin', 'system_admin'] },
    { name: 'Pass Operations', href: '/admin/passes', icon: RotateCcw, roles: ['super_admin', 'system_admin'] },
    { name: 'Audit Trail', href: '/admin/audit-logs', icon: History, roles: ['super_admin', 'system_admin'] },
  ];

  const filterNav = (items: typeof mainNavItems) =>
    items.filter((item) => item.roles.includes(user.role));

  const filteredMain = filterNav(mainNavItems);
  const filteredAdmin = filterNav(adminNavItems);

  const renderNav = (items: typeof mainNavItems) => (
    <ul className="space-y-1 px-3">
      {items.map((item) => {
        const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`));
        return (
          <li key={item.name}>
            <Link
              href={item.href}
              prefetch={true}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-gradient-to-r from-[#E8913A] to-[#D97706] text-slate-950 shadow-md shadow-amber-950/20 font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-[#F3ECE0] dark:hover:bg-slate-800/60 hover:text-slate-950 dark:hover:text-white'
              )}
            >
              <item.icon className={cn('h-4.5 w-4.5 shrink-0', isActive ? 'text-slate-950' : 'text-slate-500 dark:text-slate-400')} />
              <span>{item.name}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="flex h-full flex-col bg-[#FFFDF9] dark:bg-[#0B1E2B] border-r border-[#E2D7C5] dark:border-slate-800/80 w-64 select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-[#E2D7C5] dark:border-slate-800/80">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#E8913A] to-[#D97706] text-slate-950 shadow-md shadow-amber-950/20">
            <Heart className="h-5 w-5 fill-slate-950 stroke-none" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>Hrudhayam</span>
              <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-[#D97706] dark:text-[#E8913A] border border-amber-500/30">
                LIVE
              </span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Rotary Aarch City
            </div>
          </div>
        </Link>
      </div>

      {/* Nav List */}
      <div className="flex-1 overflow-y-auto py-4 space-y-6">
        <div>
          <div className="px-5 mb-2 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Pass Management
          </div>
          {renderNav(filteredMain)}
        </div>

        {filteredAdmin.length > 0 && (
          <div>
            <div className="px-5 mb-2 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Administration
            </div>
            {renderNav(filteredAdmin)}
          </div>
        )}
      </div>

      {/* Footer Info & Theme Toggle */}
      <div className="p-3.5 border-t border-[#E2D7C5] dark:border-slate-800/80 bg-[#FAF7F0] dark:bg-slate-900/30 flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1 text-left">
          <div className="text-[11px] font-bold text-slate-900 dark:text-white truncate">
            {user.fullName}
          </div>
          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold uppercase tracking-wider">
            {user.role === 'super_admin' ? 'Super Admin' : user.role === 'system_admin' ? 'System Admin' : user.groupName || 'Group Admin'}
          </div>
        </div>
        <ThemeToggle />
      </div>
    </div>
  );
}

export function Sidebar({ user }: SidebarProps) {
  return <SidebarContent user={user} />;
}
