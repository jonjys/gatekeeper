'use client';

import { useEffect, useState } from 'react';
import { writeAudit } from '@/lib/audit';

const CRED_KEY = 'gatezero-passkey-id';
const HIGH_SPEND = 5000;

function bufferToBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function base64ToBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

type Props = {
  estimatedSpendUsd?: number;
  onUnlocked?: () => void;
};

export default function PasskeyGate({ estimatedSpendUsd = 0, onUnlocked }: Props) {
  const [hasCred, setHasCred] = useState(false);
  const [status, setStatus] = useState<'idle' | 'busy' | 'ok' | 'error'>('idle');
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setHasCred(!!localStorage.getItem(CRED_KEY));
  }, []);

  async function register() {
    setStatus('busy');
    setMsg(null);
    try {
      if (!window.PublicKeyCredential) {
        throw new Error('WebAuthn not supported in this browser.');
      }
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const userId = crypto.getRandomValues(new Uint8Array(16));

      const cred = (await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: 'GateZero', id: window.location.hostname },
          user: {
            id: userId,
            name: 'gatezero-vault',
            displayName: 'GateZero Vault'
          },
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 },
            { type: 'public-key', alg: -257 }
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
            residentKey: 'preferred'
          },
          timeout: 60000,
          attestation: 'none'
        }
      })) as PublicKeyCredential | null;

      if (!cred) throw new Error('Registration cancelled.');
      localStorage.setItem(CRED_KEY, bufferToBase64(cred.rawId));
      setHasCred(true);
      setStatus('ok');
      setMsg('Passkey registered (platform authenticator).');
      await writeAudit({ action: 'passkey', detail: 'register' });
    } catch (err: unknown) {
      setStatus('error');
      setMsg(err instanceof Error ? err.message : String(err));
    }
  }

  async function unlock() {
    setStatus('busy');
    setMsg(null);
    try {
      const idB64 = localStorage.getItem(CRED_KEY);
      if (!idB64) throw new Error('No passkey — register first.');
      const challenge = crypto.getRandomValues(new Uint8Array(32));

      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          rpId: window.location.hostname,
          allowCredentials: [
            {
              type: 'public-key',
              id: base64ToBuffer(idB64)
            }
          ],
          userVerification: 'required',
          timeout: 60000
        }
      });

      if (!assertion) throw new Error('Unlock cancelled.');
      sessionStorage.setItem('gatezero-passkey-ok', String(Date.now()));
      setStatus('ok');
      setMsg('Vault unlocked with passkey.');
      await writeAudit({ action: 'passkey', detail: 'unlock' });
      onUnlocked?.();
    } catch (err: unknown) {
      setStatus('error');
      setMsg(err instanceof Error ? err.message : String(err));
    }
  }

  const highSpend = estimatedSpendUsd >= HIGH_SPEND;

  return (
    <div className={`card space-y-3 ${highSpend ? 'border-violet-500/40' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-sm">Passkey unlock</h3>
        <span className="badge border-violet-500/40 bg-violet-500/10 text-violet-300">
          WebAuthn
        </span>
      </div>
      <p className="text-xs text-zinc-400">
        Unlock vault with Face ID / Touch ID.
        {highSpend
          ? ' Spend ≥ $5000 also requires YubiKey touch.'
          : ' Required path for high-spend teams.'}
      </p>
      <div className="flex flex-wrap gap-2">
        {!hasCred ? (
          <button
            type="button"
            disabled={status === 'busy'}
            onClick={register}
            className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-400 disabled:opacity-60"
          >
            Register passkey
          </button>
        ) : (
          <button
            type="button"
            disabled={status === 'busy'}
            onClick={unlock}
            className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-400 disabled:opacity-60"
          >
            Unlock with Face ID / Touch ID
          </button>
        )}
      </div>
      {msg && (
        <p className={`text-xs ${status === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>
          {msg}
        </p>
      )}
    </div>
  );
}

export function isPasskeyUnlocked(maxAgeMs = 5 * 60 * 1000): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  const ts = Number(sessionStorage.getItem('gatezero-passkey-ok') || 0);
  return ts > 0 && Date.now() - ts < maxAgeMs;
}
