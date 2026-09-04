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
  PlusCircle,
  Ticket
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Profile } from '@/lib/types';

interface SidebarProps {
  profile: Profile;
}

export function SidebarContent({ profile, onNavigate }: { profile: Profile; onNavigate?: () => void }) {
  const pathname = usePathname();

  const mainNavItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['super_admin', 'sub_admin', 'system_admin', null] },
    { name: 'Sell Passes', href: '/sell', icon: PlusCircle, roles: ['super_admin', 'sub_admin'] },
    { name: 'Team Sales & Passes', href: '/guests', icon: UserCheck, roles: ['super_admin', 'sub_admin', 'system_admin', null] },
    { name: 'Door Scanner', href: '/checkin', icon: ScanLine, roles: ['super_admin', 'sub_admin', 'system_admin', null] },
    { name: 'Reports', href: '/reports', icon: BarChart3, roles: ['super_admin', 'sub_admin', 'system_admin', null] },
    { name: 'Mass Email', href: '/email', icon: Mail, roles: ['super_admin', 'system_admin', null] },
  ];

  const adminNavItems = [
    { name: 'Set Up Bands & Quotas', href: '/setup', icon: Settings2, roles: ['super_admin', 'system_admin'] },
    { name: 'Sponsors', href: '/admin/sponsors', icon: Building2, roles: ['super_admin', 'system_admin'] },
    { name: 'User Management', href: '/admin/users', icon: UserCog, roles: ['super_admin', 'system_admin'] },
    { name: 'Access Requests', href: '/admin/requests', icon: ClipboardList, roles: ['super_admin', 'system_admin'] },
    { name: 'Audit Logs', href: '/admin/audit-logs', icon: History, roles: ['super_admin', 'system_admin'] },
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
              prefetch={true}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-gradient-to-r from-[#E8913A] to-[#D97706] text-slate-950 shadow-md shadow-amber-950/20 font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
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
    <div className="flex h-full flex-col bg-white dark:bg-[#0B1E2B] border-r border-slate-200 dark:border-slate-800/80 w-64 select-none transition-colors">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-200 dark:border-slate-800/80">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#E8913A] to-[#D97706] text-slate-950 shadow-md shadow-amber-950/20">
            <Heart className="h-5 w-5 fill-slate-950 stroke-none" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>Hrudhayam</span>
              <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/20">
                LIVE
              </span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Rotary Aarch City
            </div>
          </div>
        </Link>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto py-4 space-y-6">
        <div>
          <div className="px-5 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Operations
          </div>
          {renderNav(filteredMain)}
        </div>

        {filteredAdmin.length > 0 && (
          <div>
            <div className="px-5 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Administration
            </div>
            {renderNav(filteredAdmin)}
          </div>
        )}
      </div>

      {/* User Profile Badge at Bottom */}
      {profile && (
        <div className="p-3 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#07151E]/50">
          <div className="flex items-center gap-3 px-2 py-1.5 rounded-xl">
            <div className="h-8 w-8 rounded-full bg-[#E8913A]/20 border border-[#E8913A]/40 flex items-center justify-center text-xs font-bold text-[#E8913A]">
              {profile.full_name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                {profile.full_name || 'Team Member'}
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 capitalize truncate">
                {profile.role === 'system_admin' ? 'System Admin' : profile.role === 'super_admin' ? 'Super Admin' : 'Sub-Admin'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function Sidebar({ profile }: SidebarProps) {
  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 z-30">
      <SidebarContent profile={profile} />
    </aside>
  );
}
