import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import OnboardForm from './onboard-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock } from 'lucide-react';

export default async function OnboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Check profile status
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, phone, is_active')
    .eq('id', user.id)
    .maybeSingle();

  // If user has a role assigned and is active, go to dashboard
  if (profile && profile.role && profile.is_active) {
    redirect('/dashboard');
  }

  // Check if they have a pending access request
  const { data: accessRequest } = await supabase
    .from('access_requests')
    .select('status')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (accessRequest && accessRequest.status === 'pending') {
    return (
      <div className="min-h-screen bg-[#0F2B3C] flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl bg-[#131F2E] border-0">
          <CardContent className="flex flex-col items-center justify-center space-y-4 py-12 text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-2">
              <Clock className="w-8 h-8 text-blue-500" />
            </div>
            <div>
              <h3 className="font-semibold text-xl text-white mb-2">Request Pending</h3>
              <p className="text-slate-400 px-4">
                Your request for access has been submitted and is waiting for approval by an administrator. You will be notified once approved.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F2B3C] flex items-center justify-center p-4 py-12">
      <Card className="w-full max-w-xl shadow-xl bg-[#131F2E] border-0">
        <CardHeader className="space-y-2 pb-6 border-b">
          <CardTitle className="text-2xl font-bold tracking-tight text-white">
            Complete Your Profile
          </CardTitle>
          <CardDescription className="text-base">
            Request access to the Hrudhayam Seat & Pass Manager
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <OnboardForm 
            user={{
              id: user.id,
              email: user.email || '',
              fullName: profile?.full_name || '',
              phone: profile?.phone || ''
            }} 
          />
        </CardContent>
      </Card>
    </div>
  );
}
