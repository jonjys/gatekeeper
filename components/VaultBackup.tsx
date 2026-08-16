'use client';

import { useState } from 'react';
import { exportVaultToFile, importVaultFromFile } from '@/lib/vault-file';
import { writeAudit } from '@/lib/audit';

export default function VaultBackup() {
  const [status, setStatus] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState<string | null>(null);

  async function run(
    fn: () => Promise<{ count: number }>,
    label: string,
    action: 'export' | 'import'
  ) {
    setStatus('busy');
    setMsg(null);
    try {
      const { count } = await fn();
      setStatus('done');
      setMsg(`${label}: ${count} key${count === 1 ? '' : 's'}`);
      await writeAudit({ action, detail: `${count} keys` });
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setStatus('idle');
        return;
      }
      setStatus('error');
      setMsg(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Encrypted vault file</h3>
        <span className="badge">File System Access</span>
      </div>
      <p className="text-xs text-zinc-500">
        Export/import AES-GCM ciphertext only. Never leaves your disk. No upload.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={status === 'busy'}
          onClick={() => run(exportVaultToFile, 'Exported', 'export')}
          className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:border-emerald-500/50 transition disabled:opacity-60"
        >
          Export .gkvault
        </button>
        <button
          type="button"
          disabled={status === 'busy'}
          onClick={() => run(importVaultFromFile, 'Imported', 'import')}
          className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:border-emerald-500/50 transition disabled:opacity-60"
        >
          Import .gkvault
        </button>
      </div>
      {msg && (
        <p className={`text-xs ${status === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>
          {msg}
        </p>
      )}
    </div>
  );
}
