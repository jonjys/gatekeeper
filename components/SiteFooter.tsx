import Link from 'next/link';
import { COMPANY } from '@/lib/company';

export default function SiteFooter() {
  return (
    <footer className="border-t border-zinc-800/80 px-5 py-5 text-center text-xs text-zinc-500 space-y-2">
      <p>
        GateZero · {COMPANY.byline} · no save → no fee
      </p>
      <p>{COMPANY.footerIdentity}</p>
      <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        <Link href="/contact" className="hover:text-emerald-400">
          Contact
        </Link>
        <Link href="/privacy" className="hover:text-emerald-400">
          Privacy
        </Link>
        <Link href="/terms" className="hover:text-emerald-400">
          Terms
        </Link>
        <a href={COMPANY.website} className="hover:text-emerald-400" rel="noopener noreferrer">
          Nytto Labs
        </a>
      </nav>
    </footer>
  );
}
