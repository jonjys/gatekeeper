'use client';

import { useEffect } from 'react';

/** iOS Safari: blur fields on scroll so the Paste / Klistra in callout does not follow the finger. */
export function IosPasteGuard() {
  useEffect(() => {
    const isField = (el: Element | null): el is HTMLElement =>
      !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');

    const blurActive = () => {
      const ae = document.activeElement;
      if (isField(ae)) ae.blur();
    };

    const onTouchStart = (e: TouchEvent) => {
      const ae = document.activeElement;
      if (!isField(ae)) return;
      const t = e.target as Node | null;
      if (t && (ae === t || ae.contains(t))) return;
      ae.blur();
    };

    window.addEventListener('scroll', blurActive, { passive: true, capture: true });
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    return () => {
      window.removeEventListener('scroll', blurActive, true);
      document.removeEventListener('touchstart', onTouchStart);
    };
  }, []);
  return null;
}
