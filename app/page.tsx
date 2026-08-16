'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ImportEnvButton from '@/components/ImportEnvButton';
import CostRadar from '@/components/CostRadar';
import { listKeys } from '@/lib/crypto';

export default function HomePage() {
  const [keyCount, setKeyCount] = useState(0);
  const [uses] = useState(0);
  const [est] = useState(0);

  useEffect(() => {
    listKeys()
      .then((k) => setKeyCount(k.length))
      .catch(() => {});
  }, []);

  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b border-zinc-800/80 px-5 sm:px-8 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-lg">
            🔒
          </span>
          <span className="font-semibold tracking-tight text-lg">
            Gate<span className="text-emerald-400">Zero</span>
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm text-zinc-400">
          <span className="font-mono hidden sm:inline">
            {uses} uses · est. ${est.toFixed(2)}/mo
          </span>
          <Link href="/pricing" className="hidden sm:inline hover:text-emerald-400">
            Pricing
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg border border-zinc-700 px-3 py-1.5 hover:border-emerald-500/40 hover:text-emerald-400 transition"
          >
            Dashboard
          </Link>
        </div>
      </header>

      <div className="flex-1 max-w-3xl mx-auto w-full px-5 sm:px-8 py-12 sm:py-16 space-y-12">
        <section className="space-y-5 text-center sm:text-left">
          <div className="flex flex-wrap justify-center sm:justify-start gap-2">
            <span className="badge">zero-trust</span>
            <span className="badge">local-first</span>
            <span className="badge">kill-switch</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-[1.15]">
            Keys never leave.{' '}
            <span className="text-emerald-400">Spend never surprises.</span>
          </h1>
          <p className="text-zinc-400 text-base sm:text-lg max-w-xl leading-relaxed">
            Weld every .env into an encrypted on-device store. Web Locks for exclusive
            use. CostRadar kills traffic when budget is hit. No secret on our servers.
          </p>
        </section>

        <section className="grid sm:grid-cols-3 gap-3">
          <div className="card space-y-2">
            <p className="text-emerald-400 text-xs font-semibold uppercase tracking-wider">Weld</p>
            <p className="font-medium text-zinc-100">Import .env to AES-GCM</p>
            <p className="text-sm text-zinc-500">Masked only. File System Access — no upload.</p>
          </div>
          <div className="card space-y-2">
            <p className="text-emerald-400 text-xs font-semibold uppercase tracking-wider">Lock</p>
            <p className="font-medium text-zinc-100">Web Locks. One process.</p>
            <p className="text-sm text-zinc-500">~50ms plaintext under exclusive lock, then drop.</p>
          </div>
          <div className="card space-y-2">
            <p className="text-emerald-400 text-xs font-semibold uppercase tracking-wider">Kill</p>
            <p className="font-medium text-zinc-100">Budget hit → blocked</p>
            <p className="text-sm text-zinc-500">All keys blocked locally. Stops $14k surprises.</p>
          </div>
        </section>

        <p className="text-center text-sm text-zinc-500">
          Unlock vault with Face ID / Touch ID · Passkey + YubiKey for spend ≥ $5k
        </p>

        <CostRadar />

        <section className="card space-y-5">
          <div>
            <h2 className="text-lg font-semibold">Weld .env in 10 seconds</h2>
            <p className="text-sm text-zinc-500 mt-1">
              {keyCount > 0
                ? `${keyCount} key${keyCount > 1 ? 's' : ''} already in local vault`
                : 'Nothing stored yet — pick your .env file'}
            </p>
          </div>
          <ImportEnvButton onImported={(keys) => setKeyCount((c) => c + keys.length)} />
        </section>

        <section className="card space-y-3">
          <h3 className="font-medium">Point traffic at GateZero</h3>
          <pre className="text-xs sm:text-sm bg-black/50 rounded-xl p-4 overflow-x-auto text-emerald-300/90 leading-relaxed">
{`// before
fetch('https://api.openai.com/v1/chat/completions', {…})

// after
fetch('/api/gate/openai/v1/chat/completions', {
  headers: { 'x-gatekeeper-key': 'OPENAI_API_KEY' },
  …
})`}
          </pre>
          <p className="text-xs text-zinc-500">
            Service Worker injects the real key under Web Locks. Network tab stays clean.
          </p>
        </section>
      </div>

      <footer className="border-t border-zinc-800/80 px-5 py-5 text-center text-xs text-zinc-500">
        Built with GateZero · Is this app profitable? →{' '}
        <a href="https://fredcast.se" target="_blank" rel="noopener noreferrer" className="text-emerald-500 hover:underline">
          fredcast.se
        </a>
      </footer>
    </main>
  );
}
