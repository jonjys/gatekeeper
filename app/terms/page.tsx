import type { Metadata } from 'next';
import LegalShell from '@/components/LegalShell';
import { COMPANY, siteUrl } from '@/lib/company';

export const metadata: Metadata = {
  title: 'Terms',
  description:
    'Terms for GateZero, a product by Nytto Labs. Spend-router hops, verified-savings fees, and Stripe seats.',
  alternates: { canonical: '/terms' },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Terms — GateZero',
    url: siteUrl('/terms')
  }
};

const UPDATED = '4 September 2026';

export default function TermsPage() {
  return (
    <LegalShell current="/terms" badge="terms" title="Terms" updated={UPDATED}>
      <p>
        {COMPANY.legalLine} These terms cover GateZero ({COMPANY.productUrl}), an API spend router.
      </p>

      <h2>The product</h2>
      <p>
        You point API traffic at <code>/api/proxy</code> with a workspace token (
        <code>x-gz-key</code>). GateZero may send a cheaper model when you allow it, kill hops when
        a budget is hit, and write a ledger of cost, savings, and fee. Cost is taken from real
        tokens after the upstream hop. Unknown models are not given a cheaper alias and are not
        charged a savings fee.
      </p>
      <p>
        <code>/api/gate</code>, onboard helpers, and on-device vault / YubiKey / passkey UI are
        demos. They are not the spend router.
      </p>

      <h2>Keys and your responsibility</h2>
      <p>
        Vaulting a provider key means GateZero stores it encrypted (AES-256-GCM) and decrypts it in
        memory to call the provider. You should vault a restricted key with a vendor spend cap, not
        a master secret. You can burn a vaulted key at any time. You are responsible for traffic you
        send through the booth and for the provider account behind that key.
      </p>

      <h2>Fees</h2>
      <p>
        Published seats are $0 (Free), $29/mo (Pro), and $299/mo (Enterprise), billed through Stripe
        after Checkout. A success fee applies only to verified savings against the model price
        table: 20% on Free/Pro, 15% on Enterprise. No verified savings → no savings fee. Failed hops
        are not billed. Free tracks the fee on the ledger; Stripe meters it after a customer is
        bound.
      </p>
      <p>
        Cancel Pro or Enterprise in the Stripe Customer Portal (Billing on /start after Checkout).
        Refunds: <a href={`mailto:${COMPANY.emails.billing}`}>{COMPANY.emails.billing}</a>. We do
        not publish a separate guaranteed SLA or refund schedule here.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Do not use GateZero to attack systems, bypass provider terms, or send unlawful content. We
        may arm kill, refuse hops, or close a workspace if traffic would harm the service or a
        provider.
      </p>

      <h2>Availability</h2>
      <p>
        GateZero is provided as a live product without a published uptime commitment on this page.
        Upstream providers (OpenAI, Anthropic, Stripe) are outside our control.
      </p>

      <h2>Contact</h2>
      <p>
        Product support: <a href={`mailto:${COMPANY.emails.support}`}>{COMPANY.emails.support}</a>.
        General and partnerships:{' '}
        <a href={`mailto:${COMPANY.emails.general}`}>{COMPANY.emails.general}</a>. Privacy:{' '}
        <a href={`mailto:${COMPANY.emails.privacy}`}>{COMPANY.emails.privacy}</a>. {COMPANY.legalLine}
      </p>
    </LegalShell>
  );
}
