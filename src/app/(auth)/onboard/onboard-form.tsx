'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { submitOnboardRequest } from './actions';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, AlertCircle, Lock, ShieldCheck } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function OnboardForm({ 
  user 
}: { 
  user: { id: string; email: string; fullName: string; phone: string } 
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullName, setFullName] = useState(user.fullName || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [role, setRole] = useState('super_admin');
  const [notes, setNotes] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    if (password) {
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        setIsLoading(false);
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        setIsLoading(false);
        return;
      }

      // Update password in Supabase Auth
      const { error: pwdError } = await supabase.auth.updateUser({ password });
      if (pwdError) {
        setError(pwdError.message);
        setIsLoading(false);
        return;
      }
    }
    
    const formData = new FormData();
    formData.append('fullName', fullName);
    formData.append('phone', phone);
    formData.append('requestedRole', role);
    formData.append('notes', notes);
    
    try {
      const result = await submitOnboardRequest(formData);
      
      if (result?.error) {
        setError(result.error);
        setIsLoading(false);
      } else {
        window.location.href = '/dashboard';
      }
    } catch (err: any) {
      if (err?.message?.includes('NEXT_REDIRECT')) {
        window.location.href = '/dashboard';
        return;
      }
      setError('An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <Input 
            id="email" 
            name="email" 
            type="email" 
            defaultValue={user.email} 
            readOnly 
            className="bg-slate-50 text-slate-500" 
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="fullName">Full Name <span className="text-red-500">*</span></Label>
          <Input 
            id="fullName" 
            name="fullName" 
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="John Doe" 
            required 
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number (Optional)</Label>
          <Input 
            id="phone" 
            name="phone"
            value={phone} 
            onChange={(e) => setPhone(e.target.value)}
            placeholder="10-digit mobile number" 
            pattern="[0-9]{10}"
            title="Please enter a valid 10-digit mobile number"
          />
        </div>

        {/* Set password for future logins */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Lock className="w-4 h-4 text-[#E8913A]" />
            <span>Set Password for Future Logins</span>
          </div>
          <p className="text-xs text-slate-500">
            Create a password so you can log in instantly without waiting for an email link next time.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={6}
              />
            </div>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <Label>Requested Role <span className="text-red-500">*</span></Label>
          <RadioGroup 
            name="requestedRole" 
            value={role} 
            onValueChange={setRole}
            className="flex flex-col space-y-1"
          >
            <div className="flex items-center space-x-3 p-3 border rounded-md cursor-pointer hover:bg-slate-50">
              <RadioGroupItem value="super_admin" id="super_admin" />
              <Label htmlFor="super_admin" className="flex-1 cursor-pointer">
                <div className="font-medium flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#E8913A]" />
                  Super Admin
                </div>
                <div className="text-sm text-slate-500">Configure bands, approve members, authorize discounts, sell passes</div>
              </Label>
            </div>
            <div className="flex items-center space-x-3 p-3 border rounded-md cursor-pointer hover:bg-slate-50">
              <RadioGroupItem value="sub_admin" id="sub_admin" />
              <Label htmlFor="sub_admin" className="flex-1 cursor-pointer">
                <div className="font-medium">Sub-Admin (Team Member)</div>
                <div className="text-sm text-slate-500">Sell passes, record donor details, issue WhatsApp & printed tickets</div>
              </Label>
            </div>
            <div className="flex items-center space-x-3 p-3 border rounded-md cursor-pointer hover:bg-slate-50">
              <RadioGroupItem value="system_admin" id="system_admin" />
              <Label htmlFor="system_admin" className="flex-1 cursor-pointer">
                <div className="font-medium text-purple-700">System Admin (Technical Role)</div>
                <div className="text-sm text-slate-500">Configure bands, authorize discounts, cancel & reassign seats</div>
              </Label>
            </div>
          </RadioGroup>
        </div>

        {role === 'sub_admin' && (
          <div className="space-y-2 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
            <Label htmlFor="notes">Access Requirements (Optional)</Label>
            <Input 
              id="notes" 
              name="notes" 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Need access to manage Tier 5000 rows A-E" 
            />
          </div>
        )}
      </div>

      <Button 
        type="submit" 
        className="w-full h-11 bg-[#0F2B3C] hover:bg-[#1A4A5E] text-white font-medium"
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Completing Setup...
          </>
        ) : (
          'Submit Access Request'
        )}
      </Button>
    </form>
  );
}
