'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  History,
  Settings2,
  Users,
  UserCheck,
  BarChart3,
  ScanLine,
  Mail,
  UserCog,
  ClipboardList,
  Sparkles,
  Heart,
  Building2,
  FolderKanban
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Profile } from '@/lib/types';

interface SidebarProps {
  profile: Profile;
}

export function SidebarContent({ profile, onNavigate }: { profile: Profile; onNavigate?: () => void }) {
  const pathname = usePathname();

  const mainNavItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['super_admin', 'sub_admin', null] },
    { name: 'Set Up Hall', href: '/setup', icon: Settings2, roles: ['super_admin'] },
    { name: 'Allocate Rows', href: '/allocate', icon: Users, roles: ['super_admin'] },
    { name: 'Guests & Passes', href: '/guests', icon: UserCheck, roles: ['super_admin', 'sub_admin', null] },
    { name: 'Group Seating', href: '/groups', icon: FolderKanban, roles: ['super_admin', 'sub_admin', null] },
    { name: 'Reports', href: '/reports', icon: BarChart3, roles: ['super_admin', 'sub_admin', null] },
    { name: 'Door Check-in', href: '/checkin', icon: ScanLine, roles: ['super_admin', 'sub_admin', null] },
    { name: 'Mass Email', href: '/email', icon: Mail, roles: ['super_admin', 'sub_admin', null] },
  ];

  const adminNavItems = [
    { name: 'Sponsors', href: '/admin/sponsors', icon: Building2, roles: ['super_admin'] },
    { name: 'User Management', href: '/admin/users', icon: UserCog, roles: ['super_admin'] },
    { name: 'Access Requests', href: '/admin/requests', icon: ClipboardList, roles: ['super_admin'] },
    { name: 'Audit Logs', href: '/admin/audit-logs', icon: History, roles: ['super_admin'] },
  ];

  const filterNav = (items: typeof mainNavItems) =>
    items.filter((item) => {
      const userRole = profile?.role || null;
      return (item.roles as (string | null)[]).includes(userRole);
    });

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
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-gradient-to-r from-[#E8913A] to-[#D97706] text-white shadow-md shadow-amber-950/20 font-semibold'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
              )}
            >
              <item.icon className={cn('h-4.5 w-4.5 shrink-0', isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400')} />
              <span>{item.name}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="flex h-full flex-col bg-white dark:bg-[#0B1E2B] border-r border-slate-200 dark:border-slate-800/80 w-64 select-none transition-colors">
      {/* Brand Header */}
      <div className="p-5 pb-4 border-b border-slate-200 dark:border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#E8913A] to-[#B45309] flex items-center justify-center text-white font-black text-lg shadow-lg shadow-amber-500/20 dark:shadow-amber-950/40">
            <Heart className="w-5 h-5 fill-white text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-tight leading-none">
              Hrudhayam LIVE
            </h1>
            <p className="text-[11px] text-amber-600 dark:text-amber-300/80 font-medium mt-1">
              Seat & Pass Manager
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto py-5 space-y-6">
        <div>
          <div className="px-5 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Operations
          </div>
          {renderNav(filteredMain)}
        </div>

        {filteredAdmin.length > 0 && (
          <div>
            <div className="px-5 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Administration
            </div>
            {renderNav(filteredAdmin)}
          </div>
        )}
      </div>

      {/* Event Info Footer */}
      <div className="p-4 m-3 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/80">
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Charity Concert</span>
        </div>
        <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-snug">
          9 Oct 2026 • The Music Academy
        </p>
        <div className="mt-2 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
          Rotary Club of Aarch City
        </div>
      </div>
    </div>
  );
}

export function Sidebar({ profile }: SidebarProps) {
  return (
    <div className="h-full flex flex-col">
      <SidebarContent profile={profile} />
    </div>
  );
}
