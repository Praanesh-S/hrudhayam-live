'use server';
import { revalidatePath } from "next/cache";

import { createClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';

export async function toggleUserActive(userId: string, active: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('Unauthorized');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'super_admin') throw new Error('Forbidden');

  await supabase.from('profiles').update({ is_active: active }).eq('id', userId);
  revalidatePath('/admin/users');
}

export async function toggleDoorDuty(userId: string, doorDuty: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('Unauthorized');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'super_admin') throw new Error('Forbidden');

  await supabase.from('profiles').update({ door_duty: doorDuty }).eq('id', userId);
  revalidatePath('/admin/users');
}

export async function updateUserRole(userId: string, role: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('Unauthorized');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'super_admin') throw new Error('Forbidden');

  await supabase.from('profiles').update({ role }).eq('id', userId);
  revalidatePath('/admin/users');
}

export async function deleteUser(userId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('Unauthorized');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'super_admin') throw new Error('Forbidden');

  // Uses supabase admin client in real app to delete auth user, but for now just profile
  await supabase.from('profiles').delete().eq('id', userId);
  revalidatePath('/admin/users');
}
