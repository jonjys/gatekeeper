'use client';

import { useState } from 'react';

/**
 * WebUSB gate for high-value keys.
 * Requires a physical HID/USB security key touch before decrypting
 * secrets that proxy spend above the threshold (default $1000).
 * Moat: server-side gateways cannot require a local USB touch.
 */

const THRESHOLD_USD = 1000;

type Props = {
  estimatedSpendUsd?: number;
  onUnlocked?: () => void;
};

export default function YubiGate({ estimatedSpendUsd = 0, onUnlocked }: Props) {
  const [status, setStatus] = useState<'idle' | 'waiting' | 'ok' | 'error'>('idle');
  const [msg, setMsg] = useState<string | null>(null);

  const needsTouch = estimatedSpendUsd >= THRESHOLD_USD;

  async function requestTouch() {
    setStatus('waiting');
    setMsg(null);
    try {
      if (!('usb' in navigator)) {
        throw new Error('WebUSB requires Chrome/Edge. Touch gate unavailable.');
      }

      const filters = [
        { vendorId: 0x1050 },
        { vendorId: 0x2581 },
        { vendorId: 0x18d1 }
      ];

      const device = await navigator.usb.requestDevice({ filters });
      await device.open();
      if (device.configuration === null) {
        await device.selectConfiguration(1);
      }
      if (device.configuration?.interfaces?.length) {
        const iface = device.configuration.interfaces[0].interfaceNumber;
        try {
          await device.claimInterface(iface);
        } catch {
          /* open is enough for some keys */
        }
      }

      sessionStorage.setItem('gatezero-yubi-ok', String(Date.now()));
      setStatus('ok');
      setMsg(`Unlocked with ${device.productName || 'USB key'}`);
      onUnlocked?.();

      try {
        await device.close();
      } catch {
        /* ignore */
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'NotFoundError') {
        setStatus('idle');
        return;
      }
      setStatus('error');
      setMsg(err instanceof Error ? err.message : String(err));
    }
  }

  if (!needsTouch && status !== 'ok') {
    return (
      <p className="text-xs text-zinc-500">
        YubiKey touch required when estimated spend ≥ ${THRESHOLD_USD}.
      </p>
    );
  }

  return (
    <div className="card space-y-3 border-amber-500/30">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-sm">YubiGate</h3>
        <span className="badge border-amber-500/40 bg-amber-500/10 text-amber-400">
          WebUSB
        </span>
      </div>
      <p className="text-xs text-zinc-400">
        High-value proxy (≥ ${THRESHOLD_USD}). Physical key touch required before
        decrypt under Web Lock.
      </p>
      <button
        type="button"
        onClick={requestTouch}
        disabled={status === 'waiting'}
        className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-60 transition"
      >
        {status === 'waiting' ? 'Touch key…' : status === 'ok' ? 'Unlocked' : 'Touch YubiKey'}
      </button>
      {msg && (
        <p className={`text-xs ${status === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>
          {msg}
        </p>
      )}
    </div>
  );
}

export function isYubiUnlocked(maxAgeMs = 5 * 60 * 1000): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  const ts = Number(sessionStorage.getItem('gatezero-yubi-ok') || 0);
  return ts > 0 && Date.now() - ts < maxAgeMs;
}
