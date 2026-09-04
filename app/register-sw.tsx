'use client';

import { useEffect } from 'react';
import { IosPasteGuard } from '@/components/IosPasteGuard';

/** Product pages do not register the demo Service Worker. Drop leftover /api/gate interceptors. */
export function RegisterSW() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    void navigator.serviceWorker.getRegistrations().then((regs) => {
      for (const r of regs) void r.unregister();
    });
  }, []);
  return <IosPasteGuard />;
}
