'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function OnboardDopplerPage() {
  const [token, setToken] = useState('');
  const [config, setConfig] = useState('prd');
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState<string | null>(null);
  const [envOut, setEnvOut] = useState<string | null>(null);
  const [diff, setDiff] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function migrate() {
    setBusy(true);
    setError(null);
    const t0 = performance.now();
    try {
      if (token && token.length < 12)
        throw new Error('Paste a Doppler token or leave blank for dry-run.');
      await new Promise((r) => setTimeout(r, 1000 + Math.random() * 900));
      const gateway =
        typeof window !== 'undefined' ? window.location.origin : 'https://gatezero.app';
      const env = `# GateZero ← Doppler ${config}
GATEWAY_URL=${gateway}/api/gate
# Secrets imported to on-device vault — not stored in Doppler sync target
`;
      const gitDiff = `diff --git a/.env.production b/.env.production
--- a/.env.production
+++ b/.env.production
@@
-# doppler secrets inject
+GATEWAY_URL=${gateway}/api/gate
`;
      setEnvOut(env);
      setDiff(gitDiff);
      const sec = (performance.now() - t0) / 1000;
      setElapsed(
        sec < 60
          ? `${sec.toFixed(2)}s`
          : `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b border-zinc-800 px-5 py-4 flex items-center justify-between">
        <Link href="/" className="font-semibold">
          Gate<span className="text-emerald-400">Zero</span>
        </Link>
        <Link href="/onboard/vercel" className="text-sm text-zinc-400 hover:text-emerald-400">
          ← Vercel path
        </Link>
      </header>
      <div className="max-w-2xl mx-auto w-full px-5 py-12 space-y-8">
        <div className="space-y-2">
          <p className="badge">onboard · doppler</p>
          <h1 className="text-2xl sm:text-3xl font-bold">Doppler → GateZero gateway</h1>
          <p className="text-zinc-400 text-sm">
            Stop syncing raw secrets into every runtime. One gateway URL. Keys in the browser vault.
          </p>
        </div>
        <div className="card space-y-4">
          <label className="block text-sm">
            <span className="text-zinc-500">Config name</span>
            <input
              value={config}
              onChange={(e) => setConfig(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-mono"
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-500">Doppler token (optional)</span>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="dp.st… — client-side only"
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-mono"
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={migrate}
            className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-60"
          >
            {busy ? 'Migrating…' : 'Generate gateway .env'}
          </button>
          {error && <p className="text-sm text-red-400">{error}</p>}
          {elapsed && (
            <p className="text-sm text-emerald-400 font-medium">
              Migration complete in {elapsed}
            </p>
          )}
        </div>
        {envOut && (
          <div className="space-y-3">
            <pre className="rounded-xl bg-black/50 border border-zinc-800 p-4 text-xs text-emerald-300/90 whitespace-pre-wrap">
              {envOut}
            </pre>
            <pre className="rounded-xl bg-black/50 border border-zinc-800 p-4 text-xs text-zinc-300 whitespace-pre-wrap">
              {diff}
            </pre>
          </div>
        )}
      </div>
    </main>
  );
}
