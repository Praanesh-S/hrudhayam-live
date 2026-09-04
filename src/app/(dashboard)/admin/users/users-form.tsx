'use client';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toggleUserActive, toggleDoorDuty, updateUserRole } from '../actions';
import { useTransition } from 'react';
import { toast } from 'sonner';

export function UsersForm({ profile, currentUserId }: { profile: any; currentUserId: string }) {
  const [isPending, startTransition] = useTransition();

  const handleToggleActive = () => {
    startTransition(async () => {
      try {
        await toggleUserActive(profile.id, !profile.is_active);
        toast.success(`User ${profile.is_active ? 'deactivated' : 'activated'}`);
      } catch {
        toast.error('Failed to update account status');
      }
    });
  };

  const handleToggleDoorDuty = () => {
    startTransition(async () => {
      try {
        await toggleDoorDuty(profile.id, !profile.door_duty);
        toast.success('Door duty permission updated');
      } catch {
        toast.error('Failed to update door duty');
      }
    });
  };

  const handleRoleChange = (newRole: string) => {
    startTransition(async () => {
      try {
        await updateUserRole(profile.id, newRole);
        toast.success(`Role updated to ${newRole}`);
      } catch {
        toast.error('Failed to update user role');
      }
    });
  };

  if (profile.id === currentUserId) {
    return <span className="text-xs text-slate-500 font-medium">Current User</span>;
  }

  return (
    <div className="flex items-center gap-2 justify-end">
      <Select 
        value={profile.role || 'sub_admin'} 
        onValueChange={handleRoleChange}
        disabled={isPending}
      >
        <SelectTrigger className="bg-[#1A2839] border-[#2A3F55] text-white text-xs h-8 w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-[#131F2E] border-[#223345] text-white">
          <SelectItem value="super_admin">Super Admin</SelectItem>
          <SelectItem value="sub_admin">Sub-Admin</SelectItem>
          <SelectItem value="system_admin">System Admin</SelectItem>
        </SelectContent>
      </Select>

      <Button 
        variant="outline" 
        size="sm" 
        onClick={handleToggleActive} 
        disabled={isPending}
        className="bg-[#1A2839] hover:bg-[#24364A] text-slate-200 border-[#2A3F55] text-xs h-8"
      >
        {profile.is_active ? 'Deactivate' : 'Activate'}
      </Button>

      <Button 
        variant="outline" 
        size="sm" 
        onClick={handleToggleDoorDuty} 
        disabled={isPending}
        className="bg-[#1A2839] hover:bg-[#24364A] text-sky-400 border-[#2A3F55] text-xs h-8"
      >
        {profile.door_duty ? 'Revoke Door' : 'Grant Door'}
      </Button>
    </div>
  );
}
