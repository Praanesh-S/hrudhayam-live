'use client';

import { Menu, LogOut, Shield, User, Heart } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { AuthUser } from '@/lib/auth/session';
import { logoutAction } from '@/app/(auth)/login/actions';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { SidebarContent } from './Sidebar';
import { useState } from 'react';

interface HeaderProps {
  user: AuthUser;
}

const getPageTitle = (pathname: string) => {
  if (pathname.startsWith('/dashboard')) return { title: 'Fill & Goal Dashboard', subtitle: 'Live Band Allocations & AED Stations' };
  if (pathname.startsWith('/sell')) return { title: 'Sell a Pass', subtitle: 'Step-by-step Pass Issuance & WhatsApp Delivery' };
  if (pathname.startsWith('/checkin')) return { title: 'Gate Scanner & Check-in', subtitle: 'Barcode QR Validation & Gate Admission' };
  if (pathname.startsWith('/leaderboard')) return { title: 'Competition Leaderboards', subtitle: 'Team & Individual Standings • Prize Freeze' };
  if (pathname.startsWith('/clubs')) return { title: 'Participating Rotary Clubs', subtitle: '₹25,000 Entry Fee & ₹15,000 Pass Allotments' };
  if (pathname.startsWith('/payments')) return { title: 'Structured Payments', subtitle: 'Collection Verification & WhatsApp Reminders' };
  if (pathname.startsWith('/guests')) return { title: 'Passes & Guests Directory', subtitle: 'Search, Re-send WhatsApp & View Pass Status' };
  if (pathname.startsWith('/reports')) return { title: 'Reports & Audit Export', subtitle: 'Master Excel Downloads & Financial Summary' };
  if (pathname.startsWith('/admin/bands')) return { title: 'Bands & Protected Seats', subtitle: 'Capacity Quotas & Earmarked Seat Blocks' };
  if (pathname.startsWith('/admin/members')) return { title: 'Groups, Members & Accounts', subtitle: 'Roster Management & Super Admin Delegation' };
  if (pathname.startsWith('/admin/sponsors')) return { title: 'Sponsors Console', subtitle: 'Packages, Logos & Complimentary Passes' };
  if (pathname.startsWith('/admin/passes')) return { title: 'Pass Operations (System Admin)', subtitle: 'Void Cancellations & Band Reassignments' };
  if (pathname.startsWith('/admin/audit-logs')) return { title: 'Audit Trail', subtitle: 'Immutable System Activity Logs' };
  return { title: 'Hrudhayam LIVE', subtitle: 'Seat & Pass Manager' };
};

export function Header({ user }: HeaderProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { title, subtitle } = getPageTitle(pathname);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const isSystemAdmin = user.role === 'system_admin';
  const isSuperAdmin = user.role === 'super_admin';

  return (
    <header className="bg-[#0B1E2B] border-b border-slate-800 sticky top-0 z-20 shadow-md">
      <div className="flex items-center justify-between px-4 sm:px-6 md:px-8 h-16">
        <div className="flex items-center gap-4">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger
              render={
                <Button variant="ghost" size="icon" className="md:hidden text-slate-300 hover:text-white hover:bg-slate-800">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Open sidebar</span>
                </Button>
              }
            />
            <SheetContent side="left" className="p-0 w-64 bg-[#0B1E2B] border-r border-slate-800">
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              <SidebarContent user={user} onNavigate={() => setMobileMenuOpen(false)} />
            </SheetContent>
          </Sheet>
          
          <div>
            <h1 className="text-base sm:text-lg font-bold text-white tracking-tight leading-none">
              {title}
            </h1>
            <p className="text-[11px] text-slate-400 mt-1 hidden sm:block">
              {subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* User Profile Pill */}
          <div className="flex items-center gap-2.5 bg-[#132B3E] px-3 py-1.5 rounded-full border border-slate-700/80">
            <Avatar className="h-6 w-6 border border-amber-500/40">
              <AvatarFallback className="bg-[#E8913A] text-slate-950 font-black text-[10px]">
                {getInitials(user.fullName || 'User')}
              </AvatarFallback>
            </Avatar>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-semibold text-slate-200 leading-none">
                {user.fullName}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                {isSystemAdmin ? (
                  <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-0.5">
                    <Shield className="w-2.5 h-2.5" /> System Admin
                  </span>
                ) : isSuperAdmin ? (
                  <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-0.5">
                    <Shield className="w-2.5 h-2.5" /> Super Admin
                  </span>
                ) : (
                  <span className="text-[9px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-0.5">
                    <User className="w-2.5 h-2.5" /> {user.groupName || 'Group Admin'}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="h-5 w-px bg-slate-700 hidden sm:block"></div>
          
          <form action={logoutAction}>
            <Button 
              type="submit"
              variant="ghost" 
              size="sm" 
              className="text-slate-300 hover:text-red-400 hover:bg-red-950/40 text-xs font-medium h-8"
            >
              <LogOut className="h-3.5 w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
