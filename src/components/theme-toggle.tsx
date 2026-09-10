'use client';

import { useTheme } from 'next-themes';
import { Sun, Moon, Laptop } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggle({ className, showLabel = false }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted ? (resolvedTheme === 'dark' || theme === 'dark') : true;

  if (!mounted) {
    return (
      <Button
        variant="outline"
        size="icon"
        className={cn(
          "w-9 h-9 rounded-xl bg-[#132B3E] border-slate-700 text-slate-300",
          className
        )}
      >
        <Sun className="h-4 w-4 text-amber-400" />
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size={showLabel ? "default" : "icon"}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={cn(
        "rounded-xl border transition-all cursor-pointer",
        showLabel ? "h-9 px-3 gap-2 text-xs font-bold" : "w-9 h-9",
        isDark
          ? "bg-[#132B3E] hover:bg-[#1A384F] border-slate-700 text-amber-300 hover:text-amber-200"
          : "bg-[#FAF7F0] hover:bg-[#F3ECE0] border-[#D2C4AF] text-slate-800 hover:text-slate-950 shadow-xs",
        className
      )}
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      aria-label={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
    >
      {isDark ? (
        <>
          <Sun className="h-4 w-4 text-amber-400" />
          {showLabel && <span>Light Mode</span>}
        </>
      ) : (
        <>
          <Moon className="h-4 w-4 text-slate-700" />
          {showLabel && <span>Dark Mode</span>}
        </>
      )}
      {!showLabel && <span className="sr-only">Toggle theme</span>}
    </Button>
  );
}
