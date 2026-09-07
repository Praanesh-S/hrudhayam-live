'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function scrollToMainTop(smooth: boolean = true) {
  if (typeof window === 'undefined') return;

  const behavior = smooth ? 'smooth' : 'auto';
  
  // 1. Scroll window & document
  window.scrollTo({ top: 0, left: 0, behavior });
  document.documentElement.scrollTo({ top: 0, left: 0, behavior });
  document.body.scrollTo({ top: 0, left: 0, behavior });

  // 2. Scroll the main dashboard container (which has overflow-y-auto)
  const mainEl = document.getElementById('main-scroll-container') || document.querySelector('main');
  if (mainEl) {
    mainEl.scrollTo({ top: 0, left: 0, behavior });
  }
}

export function ScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    scrollToMainTop(true);
  }, [pathname]);

  return null;
}
