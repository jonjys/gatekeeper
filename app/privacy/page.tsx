import type { Metadata } from 'next';
import LegalShell from '@/components/LegalShell';
import { COMPANY, siteUrl } from '@/lib/company';
import { PRICE_AS_OF, PRICE_SOURCE } from '@/lib/engine/prices';

export const metadata: Metadata = {
  title: 'Privacy',
  description:
    'How GateZero, a product by Nytto Labs, handles provider keys, hop metadata, billing, and GDPR requests.',
  alternates: { canonical: '/privacy' },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Privacy — GateZero',
    url: siteUrl('/privacy')
  }
};

const UPDATED = '4 September 2026';

export default function PrivacyPage() {
  return (
    <LegalShell current="/privacy" badge="privacy" title="Privacy" updated={UPDATED}>
      <p>
        {COMPANY.legalLine} GateZero ({COMPANY.productUrl}) is an API spend router. This page
        describes the real data flow of that product. It does not claim that provider keys stay on
        your device.
      </p>

      <h2>Who we are</h2>
      <p>
        Operator: {COMPANY.operator}, {COMPANY.country}. Website:{' '}
        <a href={COMPANY.website}>{COMPANY.website.replace('https://', '')}</a>. Privacy and GDPR
        requests: <a href={`mailto:${COMPANY.emails.privacy}`}>{COMPANY.emails.privacy}</a>.
      </p>

      <h2>What GateZero does with keys</h2>
      <p>
        The money path is a <strong className="text-zinc-200">server-side proxy</strong> at{' '}
        <code>/api/proxy</code>. It is not the leftover demo at <code>/api/gate</code>.
      </p>
      <ul>
        <li>
          When you vault an OpenAI or Anthropic key, it leaves your device and is stored at rest
          with AES-256-GCM, wrapped by a server key (<code>GATEZERO_VAULT_KEY</code>).
        </li>
        <li>
          On each hop, the server decrypts that credential <em>in memory</em> so it can authenticate
          the upstream request to the provider. Keys leave the device for that hop. We do not
          pretend this is “keys never leave the device.”
        </li>
        <li>
          Use a restricted provider key with a spend cap — not a master secret. You can burn a
          vaulted key at any time from the booth.
        </li>
        <li>
          The credentials table stores ciphertext plus a masked preview (first and last characters
          only), not the plaintext key.
        </li>
      </ul>
      <p>
        Browser demos (on-device IndexedDB vault, YubiKey, passkeys, Service Worker{' '}
        <code>/api/gate</code>) are labeled as demos. They are not the spend router.
      </p>

      <h2>Hop data, cost, and the ledger</h2>
      <p>
        Cost is computed after the upstream response, from real token usage when the provider
        returns it. Unknown models have no price row: they are forwarded without a cheaper alias,
        and we do not invent savings or a savings fee.
      </p>
      <p>
        Model list prices used for that comparison are {PRICE_SOURCE}, as of {PRICE_AS_OF}. If we
        cannot verify a saving against that table, the savings fee is $0.
      </p>
      <p>The spend-router ledger records hop metadata, not a copy of your prompt as a ledger field:</p>
      <ul>
        <li>provider, model, path, action, HTTP status</li>
        <li>baseline / actual / savings / fee amounts derived from tokens and the price table</li>
        <li>workspace id, optional idempotency key, timestamps</li>
      </ul>
      <p>
        Request and response bodies are processed in memory to route the model and price the hop.
        If a client sends an Idempotency-Key, the upstream response may be stored so a retry does
        not hit the provider twice. GET hops may be cached briefly in memory for the same reason.
      </p>

      <h2>Billing</h2>
      <p>
        Seat subscriptions and the metered savings fee run through Stripe after Checkout binds a
        customer to the workspace. Free workspaces can track a fee on the ledger; Stripe is not
        charged unless there is verified savings and a Stripe customer. Billing and refunds:{' '}
        <a href={`mailto:${COMPANY.emails.billing}`}>{COMPANY.emails.billing}</a>.
      </p>

      <h2>Infrastructure we use to run the product</h2>
      <p>
        GateZero is hosted on Vercel. Workspace, vault ciphertext, and ledger data are stored in
        Supabase. Payments use Stripe. Those processors see what they need to provide hosting,
        database, and billing — not a separate marketing profile we invented for this page.
      </p>

      <h2>What we do not collect here</h2>
      <p>
        This site does not run a third-party product analytics pixel. Operational logs record
        workspace id, provider, status, and cost. Secrets must not appear in logs or error bodies;
        report a leak to{' '}
        <a href={`mailto:${COMPANY.emails.privacy}`}>{COMPANY.emails.privacy}</a>.
      </p>

      <h2>Your rights (GDPR)</h2>
      <p>
        If the GDPR applies to you, you may ask to access, correct, delete, restrict, or export
        personal data we hold, or object to processing, by writing to{' '}
        <a href={`mailto:${COMPANY.emails.privacy}`}>{COMPANY.emails.privacy}</a>. You may also
        contact your local supervisory authority. Product support is{' '}
        <a href={`mailto:${COMPANY.emails.support}`}>{COMPANY.emails.support}</a>.
      </p>

      <h2>Contact</h2>
      <p>
        {COMPANY.legalLine} Full list:{' '}
        <a href="/contact">Contact</a>.
      </p>
    </LegalShell>
  );
}
