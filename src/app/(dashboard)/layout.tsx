import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || !profile.is_active) {
    redirect('/onboard');
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:flex-shrink-0 border-r border-border">
        <Sidebar profile={profile} />
      </div>

      {/* Main Content */}
      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        <Header profile={profile} />
        
        <main className="flex-1 relative overflow-y-auto focus:outline-none bg-background">
          <div className="py-6 px-4 sm:px-6 md:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
