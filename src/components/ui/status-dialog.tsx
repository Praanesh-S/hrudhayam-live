'use client';

import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type StatusDialogType = 'success' | 'error' | 'warning' | 'info';

export interface StatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type?: StatusDialogType;
  title: string;
  message: string | React.ReactNode;
  actionText?: string;
  onAction?: () => void;
  secondaryActionText?: string;
  onSecondaryAction?: () => void;
}

export function StatusDialog({
  open,
  onOpenChange,
  type = 'info',
  title,
  message,
  actionText = 'OK, Understood',
  onAction,
  secondaryActionText,
  onSecondaryAction,
}: StatusDialogProps) {
  // Handle ESC key to close
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  const handleAction = () => {
    if (onAction) {
      onAction();
    }
    onOpenChange(false);
  };

  const handleSecondaryAction = () => {
    if (onSecondaryAction) {
      onSecondaryAction();
    }
    onOpenChange(false);
  };

  const icons = {
    success: (
      <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 mx-auto shadow-lg shadow-emerald-950/40">
        <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
      </div>
    ),
    error: (
      <div className="w-16 h-16 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center text-red-400 mx-auto shadow-lg shadow-red-950/40">
        <AlertCircle className="w-10 h-10 stroke-[2.5]" />
      </div>
    ),
    warning: (
      <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-500 flex items-center justify-center text-amber-400 mx-auto shadow-lg shadow-amber-950/40">
        <AlertTriangle className="w-10 h-10 stroke-[2.5]" />
      </div>
    ),
    info: (
      <div className="w-16 h-16 rounded-full bg-sky-500/20 border-2 border-sky-500 flex items-center justify-center text-sky-400 mx-auto shadow-lg shadow-sky-950/40">
        <Info className="w-10 h-10 stroke-[2.5]" />
      </div>
    ),
  };

  const buttonClasses = {
    success: 'bg-emerald-500 hover:bg-emerald-600 text-slate-950',
    error: 'bg-red-500 hover:bg-red-600 text-white',
    warning: 'bg-[#E8913A] hover:bg-[#D97706] text-slate-950',
    info: 'bg-sky-500 hover:bg-sky-600 text-slate-950',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-150"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="relative bg-[#131F2E] border-2 border-slate-700 text-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 text-center animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close "X" Button */}
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Big Icon */}
        <div>{icons[type]}</div>

        {/* Title & Message */}
        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            {title}
          </h2>
          <div className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal">
            {message}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 space-y-2">
          <Button
            type="button"
            onClick={handleAction}
            className={cn(
              'w-full h-12 sm:h-14 font-black text-sm sm:text-base rounded-2xl shadow-lg transition-transform active:scale-95',
              buttonClasses[type]
            )}
          >
            {actionText}
          </Button>

          {secondaryActionText && (
            <Button
              type="button"
              variant="ghost"
              onClick={handleSecondaryAction}
              className="w-full h-11 text-slate-400 hover:text-white font-bold text-xs sm:text-sm rounded-xl"
            >
              {secondaryActionText}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
