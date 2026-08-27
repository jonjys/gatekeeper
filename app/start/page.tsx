export const dynamic = 'force-dynamic';

export default function StartPage() {
  return (
    <main className="min-h-screen max-w-xl mx-auto px-5 py-12 space-y-8">
      <p className="badge">gatezero 2.0</p>
      <h1 className="text-3xl font-bold tracking-tight">Connect once. Traffic pays itself.</h1>
      <ol className="space-y-4 text-sm text-zinc-300 list-decimal pl-5">
        <li>
          <code className="text-emerald-400">POST /api/v1/workspace</code> — get <code>gz_live_…</code>
        </li>
        <li>
          <code className="text-emerald-400">POST /api/v1/credentials</code> header <code>x-gz-key</code>, body{' '}
          <code>{`{ "provider":"openai", "secret":"sk-..." }`}</code>
        </li>
        <li>
          Point your app at <code>/api/proxy/openai/v1/chat/completions</code>
        </li>
        <li>Set monthly budget. Fail-closed kill is default.</li>
      </ol>
      <pre className="text-xs bg-black/50 rounded-xl p-4 overflow-x-auto text-emerald-300/90">{`curl -s -X POST $HOST/api/v1/workspace \\
  -H 'content-type: application/json' \\
  -d '{"monthlyBudgetUsd":50}'

# then
curl -s $HOST/api/proxy/openai/v1/chat/completions \\
  -H 'content-type: application/json' \\
  -H 'x-gz-key: gz_live_…' \\
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"hi"}]}'`}</pre>
      <p className="text-xs text-zinc-500">
        Server proxy encrypts provider keys at rest (AES-256-GCM) and decrypts in memory per request.
        Browser Service Worker mode still keeps keys on-device. We do not claim keys never leave for the
        server proxy.
      </p>
    </main>
  );
}
