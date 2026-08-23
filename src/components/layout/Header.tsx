'use client';

import { Menu, LogOut, Shield, User, Heart } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Profile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { SidebarContent } from './Sidebar';
import { useState } from 'react';

interface HeaderProps {
  profile: Profile;
}

const getPageTitle = (pathname: string) => {
  if (pathname.startsWith('/dashboard')) return { title: 'Event Dashboard', subtitle: 'Overview & Venue Seating' };
  if (pathname.startsWith('/setup')) return { title: 'Set Up Hall & Pricing', subtitle: 'Assign Price Tiers to Rows & Manage Capacity' };
  if (pathname.startsWith('/allocate')) return { title: 'Row Allocation', subtitle: 'Assign Rows & Manage Team Access' };
  if (pathname.startsWith('/guests')) return { title: 'Guests & Donation Passes', subtitle: 'Pass Management & E-Ticket Delivery' };
  if (pathname.startsWith('/reports')) return { title: 'Financial Reports', subtitle: 'Pass Reconciliation & Excel Export' };
  if (pathname.startsWith('/checkin')) return { title: 'Door Check-in Scanner', subtitle: 'Live QR Code Verification' };
  if (pathname.startsWith('/email')) return { title: 'Mass Email Dispatcher', subtitle: 'Filtered Delivery & Resend Queue' };
  if (pathname.startsWith('/admin/users')) return { title: 'User Management', subtitle: 'Team Roles & Permissions' };
  if (pathname.startsWith('/admin/requests')) return { title: 'Access Requests', subtitle: 'Review & Approve Staff' };
  return { title: 'Dashboard', subtitle: 'Hrudhayam LIVE' };
};

export function Header({ profile }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const isSuperAdmin = profile?.role === 'super_admin';

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
              <SidebarContent profile={profile} onNavigate={() => setMobileMenuOpen(false)} />
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

        <div className="flex items-center gap-3 sm:gap-4">
          {/* User Profile Pill */}
          <div className="flex items-center gap-2.5 bg-[#132B3E] px-3 py-1.5 rounded-full border border-slate-700/80">
            <Avatar className="h-6 w-6 border border-amber-400/40">
              <AvatarFallback className="bg-[#E8913A] text-slate-950 font-black text-[10px]">
                {getInitials(profile?.full_name || 'Admin')}
              </AvatarFallback>
            </Avatar>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-semibold text-slate-200 leading-none">
                {profile?.full_name || 'User'}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                {isSuperAdmin ? (
                  <span className="text-[9px] font-bold text-[#E8913A] uppercase tracking-wider flex items-center gap-0.5">
                    <Shield className="w-2.5 h-2.5" /> Super Admin
                  </span>
                ) : (
                  <span className="text-[9px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-0.5">
                    <User className="w-2.5 h-2.5" /> Sub-Admin
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="h-5 w-px bg-slate-700 hidden sm:block"></div>
          
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-slate-300 hover:text-red-300 hover:bg-red-950/40 text-xs font-medium h-8"
            onClick={handleSignOut}
          >
            <LogOut className="h-3.5 w-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
