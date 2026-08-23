'use client';
import { Button } from '@/components/ui/button';
import { toggleUserActive, toggleDoorDuty } from '../actions';
import { useState, useTransition } from 'react';

export function UsersForm({ profile, currentUserId }: { profile: any, currentUserId: string }) {
  const [isPending, startTransition] = useTransition();

  const handleToggleActive = () => {
    startTransition(async () => {
      await toggleUserActive(profile.id, !profile.is_active);
    });
  };

  const handleToggleDoorDuty = () => {
    startTransition(async () => {
      await toggleDoorDuty(profile.id, !profile.door_duty);
    });
  };

  if (profile.id === currentUserId) return <span className="text-xs text-muted-foreground">Current User</span>;

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={handleToggleActive} disabled={isPending}>
        {profile.is_active ? 'Deactivate' : 'Activate'}
      </Button>
      <Button variant="outline" size="sm" onClick={handleToggleDoorDuty} disabled={isPending}>
        Toggle Door Duty
      </Button>
    </div>
  );
}
