'use client';

import { useEffect } from 'react';
import { IosPasteGuard } from '@/components/IosPasteGuard';

export function RegisterSW() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => console.log('[GateZero] SW registered', reg.scope))
      .catch((err) => console.warn('[GateZero] SW failed', err));
  }, []);
  return <IosPasteGuard />;
}
