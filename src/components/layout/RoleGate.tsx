import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';
import { ReactNode } from 'react';
import { AppRole } from '@/lib/types';
import { Lock } from 'lucide-react';

interface RoleGateProps {
  allowedRoles: (AppRole | null)[];
  children: ReactNode;
  fallback?: ReactNode;
}

export async function RoleGate({ allowedRoles, children, fallback }: RoleGateProps) {
  const user = await getSessionUser();

  if (!user) {
    redirect('/login');
  }

  // If the user's role is not in the list of allowed roles
  if (!allowedRoles.includes(user.role)) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="h-20 w-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
          <Lock className="h-10 w-10 text-slate-400" />
        </div>
        <h2 className="text-2xl font-semibold text-slate-800 mb-2">Access Restricted</h2>
        <p className="text-slate-500 max-w-md mx-auto mb-8">
          You don&apos;t have permission to view this page. If you believe this is an error, please contact your administrator.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
