'use client';

import { useState } from 'react';
import { loginWithPassword, registerWithPassword } from './actions';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mail, Lock, Loader2, CheckCircle2, AlertCircle, KeyRound } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  // 1. Password Sign In
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('email', email);
    formData.append('password', password);

    try {
      const res = await loginWithPassword(formData);
      if (res?.error) {
        setError(res.error);
        setIsLoading(false);
      }
    } catch (err: any) {
      if (err?.message?.includes('NEXT_REDIRECT')) {
        return;
      }
      setError(err.message || 'Invalid email or password.');
      setIsLoading(false);
    }
  };

  // 2. Direct Sign Up
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

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

    const formData = new FormData();
    formData.append('email', email);
    formData.append('password', password);
    formData.append('fullName', fullName);

    try {
      const res = await registerWithPassword(formData);
      if (res?.error) {
        setError(res.error);
        setIsLoading(false);
      } else if (res?.success) {
        setSuccessMessage(res.message);
        setIsSuccess(true);
        setIsLoading(false);
      }
    } catch (err: any) {
      if (err?.message?.includes('NEXT_REDIRECT')) {
        return;
      }
      setError(err.message || 'Sign up failed.');
      setIsLoading(false);
    }
  };

  // 3. Magic Link Sign In
  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        throw error;
      }

      setSuccessMessage('Check your email for the magic sign-in link.');
      setIsSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send magic link. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md shadow-xl bg-[#131F2E] border-0">
      <CardHeader className="space-y-2 text-center pb-3">
        <div className="w-14 h-14 mx-auto bg-slate-100 rounded-full flex items-center justify-center mb-1">
          <KeyRound className="w-7 h-7 text-[#E8913A]" />
        </div>
        <div>
          <CardTitle className="text-2xl font-bold tracking-tight text-[#0F2B3C]">
            Hrudhayam LIVE
          </CardTitle>
          <CardDescription className="text-sm font-medium text-slate-400 mt-0.5">
            Seat & Pass Manager
          </CardDescription>
        </div>
      </CardHeader>
      
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Notice</AlertTitle>
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}

        {isSuccess ? (
          <div className="flex flex-col items-center justify-center space-y-4 py-4 text-center">
            <CheckCircle2 className="w-12 h-12 text-[#16A34A]" />
            <div>
              <h3 className="font-semibold text-lg text-[#0F2B3C] mb-2">Success</h3>
              <p className="text-slate-400 text-sm">{successMessage}</p>
            </div>
            <Button 
              variant="outline" 
              className="mt-2 w-full"
              onClick={() => setIsSuccess(false)}
            >
              Back to Sign In
            </Button>
          </div>
        ) : (
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4 text-xs">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Register</TabsTrigger>
              <TabsTrigger value="magiclink">Email Link</TabsTrigger>
            </TabsList>

            {/* Tab 1: Sign In with Password */}
            <TabsContent value="signin">
              <form onSubmit={handlePasswordLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">Email address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="name@example.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-11"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      placeholder="••••••••"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 h-11"
                    />
                  </div>
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full h-11 bg-[#0F2B3C] hover:bg-[#1A4A5E] text-white font-medium text-base transition-colors"
                  disabled={isLoading || !email || !password}
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
            </TabsContent>

            {/* Tab 2: Direct Sign Up */}
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="fullName" className="text-xs font-medium">Full Name</Label>
                  <Input
                    id="fullName"
                    name="fullName"
                    placeholder="Your Name"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="h-10"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="signup-email" className="text-xs font-medium">Email address</Label>
                  <Input
                    id="signup-email"
                    name="email"
                    type="email"
                    placeholder="name@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-10"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="signup-password" className="text-xs font-medium">Password</Label>
                    <Input
                      id="signup-password"
                      name="password"
                      type="password"
                      placeholder="••••••••"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="confirm-password" className="text-xs font-medium">Confirm</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="••••••••"
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="h-10"
                    />
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-10 bg-[#E8913A] hover:bg-[#d07f30] text-white font-medium text-sm transition-colors mt-2"
                  disabled={isLoading || !email || !password || !fullName}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Account...
                    </>
                  ) : (
                    'Create Account & Sign In'
                  )}
                </Button>
              </form>
            </TabsContent>

            {/* Tab 3: Magic Link */}
            <TabsContent value="magiclink">
              <form onSubmit={handleMagicLink} className="space-y-4">
                <p className="text-xs text-slate-400">
                  Enter your email to receive a passwordless sign-in link.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="magic-email" className="text-sm font-medium">Email address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                    <Input
                      id="magic-email"
                      name="magic-email"
                      type="email"
                      placeholder="name@example.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-11"
                    />
                  </div>
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full h-11 bg-[#0F2B3C] hover:bg-[#1A4A5E] text-white font-medium text-base transition-colors"
                  disabled={isLoading || !email}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Sending Link...
                    </>
                  ) : (
                    'Send Sign-In Link'
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
      {!isSuccess && (
        <CardFooter className="flex justify-center border-t py-3 text-xs text-slate-400">
          Hrudhayam LIVE Internal Admin Portal
        </CardFooter>
      )}
    </Card>
  );
}
