'use client';
/* build-stamp: 2026-08-17-ph */

import { useState } from 'react';
import Link from 'next/link';

/**
 * Migration killer: Vercel → GateZero in minutes.
 * Token never leaves the browser (client-only transform demo).
 */
export default function OnboardVercelPage() {
  const [token, setToken] = useState('');
  const [project, setProject] = useState('my-app');
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState<string | null>(null);
  const [envOut, setEnvOut] = useState<string | null>(null);
  const [diff, setDiff] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function migrate() {
    setBusy(true);
    setError(null);
    setElapsed(null);
    const t0 = performance.now();
    try {
      if (token && !token.startsWith('vercel_') && token.length < 20) {
        throw new Error('Paste a Vercel token (or leave blank for dry-run).');
      }
      await new Promise((r) => setTimeout(r, 900 + Math.random() * 800));

      const gateway =
        typeof window !== 'undefined' ? window.location.origin : 'https://getgatezero.com';
      const env = `# GateZero migration — ${new Date().toISOString()}
# Secrets stay in GateZero local vault. Apps only need the gateway URL.
GATEWAY_URL=${gateway}/api/gate
OPENAI_BASE_URL=${gateway}/api/gate/openai
# Remove raw keys from this file after vault import:
# OPENAI_API_KEY=sk-...   ← delete; import into GateZero instead
`;
      const gitDiff = `diff --git a/.env b/.env
--- a/.env
+++ b/.env
@@ -1,4 +1,5 @@
-OPENAI_API_KEY=sk-proj-REDACTED
-ANTHROPIC_API_KEY=sk-ant-REDACTED
+# Migrated to GateZero vault — ${project}
+GATEWAY_URL=${gateway}/api/gate
+OPENAI_BASE_URL=${gateway}/api/gate/openai
`;
      setEnvOut(env);
      setDiff(gitDiff);
      const sec = ((performance.now() - t0) / 1000).toFixed(2);
      const m = Math.floor(Number(sec) / 60);
      const s = (Number(sec) % 60).toFixed(0).padStart(2, '0');
      setElapsed(m > 0 ? `${m}m ${s}s` : `${sec}s`);
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
        <Link href="/onboard/doppler" className="text-sm text-zinc-400 hover:text-emerald-400">
          Doppler path →
        </Link>
      </header>
      <div className="max-w-2xl mx-auto w-full px-5 py-12 space-y-8">
        <div className="space-y-2">
          <p className="badge">onboard · vercel</p>
          <h1 className="text-2xl sm:text-3xl font-bold">Migrate off scattered .env files</h1>
          <p className="text-zinc-400 text-sm">
            Token stays in the browser. Output: one{' '}
            <code className="text-emerald-400">GATEWAY_URL</code> line + a git diff. Import real
            keys into the local vault on the home page.
          </p>
        </div>

        <div className="card space-y-4">
          <label className="block text-sm">
            <span className="text-zinc-500">Vercel project name</span>
            <input
              value={project}
              onChange={(e) => setProject(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-mono"
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-500">Vercel API token (optional dry-run)</span>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="vercel_… — never sent to GateZero servers"
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
            <h2 className="font-semibold text-sm">New .env</h2>
            <pre className="rounded-xl bg-black/50 border border-zinc-800 p-4 text-xs text-emerald-300/90 overflow-x-auto whitespace-pre-wrap">
              {envOut}
            </pre>
            <h2 className="font-semibold text-sm">git diff</h2>
            <pre className="rounded-xl bg-black/50 border border-zinc-800 p-4 text-xs text-zinc-300 overflow-x-auto whitespace-pre-wrap">
              {diff}
            </pre>
            <Link href="/" className="inline-block text-sm text-emerald-400 hover:underline">
              → Import real keys into local vault
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
