'use client';

import { useState } from 'react';
import { encryptAndSave, detectProvider, maskSecret, listKeys } from '@/lib/crypto';
import { upsertKeyMeta } from '@/lib/supabase';

type Preview = { name: string; provider: string; masked: string };

export default function ImportEnvButton({
  onImported
}: {
  onImported?: (keys: Preview[]) => void;
}) {
  const [status, setStatus] = useState<'idle' | 'reading' | 'done' | 'error'>('idle');
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleImport() {
    setStatus('reading');
    setError(null);
    setPreviews([]);

    try {
      if (!('showOpenFilePicker' in window)) {
        throw new Error('File System Access API requires Chrome or Edge 86+.');
      }

      const [handle] = await window.showOpenFilePicker({
        multiple: false,
        excludeAcceptAllOption: true,
        types: [
          {
            description: '.env files',
            accept: { 'text/plain': ['.env', '.env.local', '.env.production', '.txt'] }
          }
        ]
      });

      const file = await handle.getFile();
      const text = await file.text();
      const lines = text.split(/\r?\n/);
      const imported: Preview[] = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq === -1) continue;
        const name = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (!name || !value) continue;
        if (
          !/KEY|SECRET|TOKEN|PASSWORD|PASS/i.test(name)
        ) {
          continue;
        }

        const provider = detectProvider(name);
        await encryptAndSave(name, value, provider);
        await upsertKeyMeta(name, provider);
        imported.push({ name, provider, masked: maskSecret(value) });
      }

      if (imported.length === 0) {
        setError('No KEY / SECRET / TOKEN entries found.');
        setStatus('error');
        return;
      }

      setPreviews(imported);
      setStatus('done');
      onImported?.(imported);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setStatus('idle');
        return;
      }
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      <button
        type="button"
        onClick={handleImport}
        disabled={status === 'reading'}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3.5 text-base font-semibold text-black shadow-lg shadow-emerald-500/25 hover:bg-emerald-400 disabled:opacity-60 transition"
      >
        {status === 'reading' ? 'Reading .env…' : 'Import .env'}
      </button>
      <p className="text-xs text-zinc-500 text-center">
        Chrome / Edge · File System Access · keys never uploaded
      </p>

      {error && <p className="text-sm text-red-400 text-center">{error}</p>}

      {status === 'done' && previews.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 space-y-2">
          <p className="text-sm text-emerald-400 font-medium">
            {previews.length} key{previews.length > 1 ? 's' : ''} welded locally
          </p>
          <ul className="space-y-1.5 font-mono text-sm text-zinc-300">
            {previews.map((k) => (
              <li key={k.name} className="flex justify-between gap-3">
                <span className="truncate">{k.name}</span>
                <span className="text-zinc-500 shrink-0">{k.masked}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
