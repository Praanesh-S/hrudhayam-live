import { ReactNode } from 'react';

export default function LoginLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0F2B3C] flex items-center justify-center p-4">
      {children}
    </div>
  );
}
