import type { Metadata } from 'next';
import LegalShell from '@/components/LegalShell';
import { COMPANY, siteUrl } from '@/lib/company';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Contact Nytto Labs about GateZero: support, partnerships, privacy, and billing.',
  alternates: { canonical: '/contact' },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Contact — GateZero',
    url: siteUrl('/contact')
  }
};

const UPDATED = '4 September 2026';

const CHANNELS = [
  { label: 'Product support', email: COMPANY.emails.support },
  { label: 'General / partnerships', email: COMPANY.emails.general },
  { label: 'Privacy / GDPR', email: COMPANY.emails.privacy },
  { label: 'Billing / refunds', email: COMPANY.emails.billing }
] as const;

export default function ContactPage() {
  return (
    <LegalShell current="/contact" badge="contact" title="Contact" updated={UPDATED}>
      <p>
        {COMPANY.byline}. {COMPANY.legalLine}
      </p>
      <ul className="list-none pl-0 space-y-3">
        {CHANNELS.map((c) => (
          <li key={c.email} className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-zinc-500">{c.label}</p>
            <a href={`mailto:${c.email}`} className="font-mono text-sm">
              {c.email}
            </a>
          </li>
        ))}
      </ul>
      <p>
        Company site:{' '}
        <a href={COMPANY.website} rel="noopener noreferrer">
          {COMPANY.website.replace('https://', '')}
        </a>
        . Product: <a href={COMPANY.productUrl}>getgatezero.com</a>. The spend router is{' '}
        <code>/api/proxy</code> — not the demo path <code>/api/gate</code>.
      </p>
      <p className="text-xs text-zinc-500">
        Privacy: <a href="/privacy">/privacy</a>. Terms: <a href="/terms">/terms</a>.
      </p>
    </LegalShell>
  );
}
