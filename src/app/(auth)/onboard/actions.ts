'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function submitOnboardRequest(formData: FormData) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return { error: 'Not authenticated' };
    }

    const fullName = formData.get('fullName') as string;
    const phone = formData.get('phone') as string;
    const requestedRole = formData.get('requestedRole') as string;
    const notes = formData.get('notes') as string;

    if (!fullName) {
      return { error: 'Full name is required' };
    }

    const adminClient = createAdminClient();

    // Check if any active super admin exists in the system
    const { data: existingSuperAdmins } = await adminClient
      .from('profiles')
      .select('id')
      .eq('role', 'super_admin')
      .eq('is_active', true);

    const isFirstSuperAdmin = !existingSuperAdmins || existingSuperAdmins.length === 0;
    const shouldAutoApprove = isFirstSuperAdmin;

    const finalRole = shouldAutoApprove ? 'super_admin' : null;
    const finalIsActive = shouldAutoApprove ? true : false;
    const requestStatus = shouldAutoApprove ? 'approved' : 'pending';

    // Upsert profile
    const { error: profileError } = await adminClient
      .from('profiles')
      .upsert({
        id: user.id,
        email: user.email!,
        full_name: fullName,
        phone: phone || null,
        role: finalRole,
        is_active: finalIsActive,
        updated_at: new Date().toISOString(),
      });

    if (profileError) {
      console.error('Profile update error:', profileError);
      return { error: 'Failed to update profile' };
    }

    // Insert access request
    const { error: requestError } = await adminClient
      .from('access_requests')
      .insert({
        user_id: user.id,
        requested_role: requestedRole,
        notes: notes || null,
        status: requestStatus,
        reviewed_by: shouldAutoApprove ? user.id : null,
        reviewed_at: shouldAutoApprove ? new Date().toISOString() : null,
      });

    if (requestError) {
      console.error('Access request error:', requestError);
    }

    if (shouldAutoApprove) {
      redirect('/dashboard');
    }

    revalidatePath('/onboard');
    return { success: true };
  } catch (error: any) {
    if (error?.message?.includes('NEXT_REDIRECT')) {
      throw error;
    }
    console.error('Onboarding action error:', error);
    return { error: 'An unexpected error occurred' };
  }
}
