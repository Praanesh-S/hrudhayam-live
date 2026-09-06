'use client';

import { useState } from 'react';
import { loginAction, setInitialPasswordAction } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Lock, Loader2, AlertCircle, KeyRound, User, ShieldCheck } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function LoginPage() {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // First login forced password set
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('loginId', loginId);
    formData.append('password', password);

    try {
      const res = await loginAction(formData);
      if (res?.error) {
        setError(res.error);
        setIsLoading(false);
      } else if (res?.mustChangePassword) {
        setMustChangePassword(true);
        setIsLoading(false);
      }
    } catch (err: any) {
      if (err?.message?.includes('NEXT_REDIRECT')) {
        return;
      }
      setError(err.message || 'Invalid credentials.');
      setIsLoading(false);
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      setIsLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      setIsLoading(false);
      return;
    }

    const formData = new FormData();
    formData.append('newPassword', newPassword);
    formData.append('confirmPassword', confirmPassword);

    try {
      const res = await setInitialPasswordAction(formData);
      if (res?.error) {
        setError(res.error);
        setIsLoading(false);
      }
    } catch (err: any) {
      if (err?.message?.includes('NEXT_REDIRECT')) {
        return;
      }
      setError(err.message || 'Failed to update password.');
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md shadow-2xl bg-[#131F2E] border border-slate-800 text-white rounded-2xl overflow-hidden">
      <CardHeader className="space-y-3 text-center pb-4 pt-6">
        <div className="w-16 h-16 mx-auto bg-slate-800/80 border-2 border-amber-500/40 rounded-2xl flex items-center justify-center shadow-inner">
          {mustChangePassword ? (
            <ShieldCheck className="w-8 h-8 text-amber-500" />
          ) : (
            <KeyRound className="w-8 h-8 text-[#E8913A]" />
          )}
        </div>
        <div>
          <CardTitle className="text-3xl font-black tracking-tight">
            Hrudhayam <span className="text-[#E8913A]">LIVE</span>
          </CardTitle>
          <CardDescription className="text-sm font-medium text-slate-400 mt-1">
            {mustChangePassword 
              ? 'Security Setup • Set Your New Password' 
              : 'Seat & Pass Manager • Coordinator Portal'}
          </CardDescription>
        </div>
      </CardHeader>
      
      <CardContent className="px-6 pb-6">
        {error && (
          <Alert variant="destructive" className="mb-5 bg-red-950/50 border-red-800 text-red-200">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <AlertTitle className="text-sm font-bold">Notice</AlertTitle>
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}

        {mustChangePassword ? (
          <form onSubmit={handleSetPassword} className="space-y-4">
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 text-xs">
              This is your first login. Please set a secure password of at least 6 characters.
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-sm font-semibold text-slate-200">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" />
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pl-11 h-12 bg-[#1A2839] border-[#2A3F55] text-white text-base rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-semibold text-slate-200">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Re-type new password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-11 h-12 bg-[#1A2839] border-[#2A3F55] text-white text-base rounded-xl"
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-bold text-base transition-colors rounded-xl mt-2"
              disabled={isLoading || !newPassword || !confirmPassword}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Updating Password...
                </>
              ) : (
                'Save Password & Enter App'
              )}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="loginId" className="text-sm font-semibold text-slate-200">
                Login ID (Mobile Number or Username)
              </Label>
              <div className="relative">
                <User className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" />
                <Input
                  id="loginId"
                  name="loginId"
                  type="text"
                  placeholder="e.g. 9841068826 or admin"
                  required
                  autoFocus
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  className="pl-11 h-12 bg-[#1A2839] border-[#2A3F55] text-white text-base rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold text-slate-200">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" />
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Enter your password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-11 h-12 bg-[#1A2839] border-[#2A3F55] text-white text-base rounded-xl"
                />
              </div>
            </div>
            
            <Button 
              type="submit" 
              className="w-full h-12 bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-bold text-base transition-colors shadow-lg shadow-amber-950/30 rounded-xl mt-2"
              disabled={isLoading || !loginId || !password}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Signing In...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>
        )}
      </CardContent>

      <CardFooter className="flex justify-center border-t border-slate-800/80 py-4 text-xs text-slate-400 bg-slate-900/40">
        Rotary Club of Aarch City Madras • Hrudhayam LIVE
      </CardFooter>
    </Card>
  );
}
