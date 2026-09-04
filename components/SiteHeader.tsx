import Link from 'next/link';

export default function SiteHeader({ current }: { current?: string }) {
  const item = (href: string, label: string) => (
    <Link
      href={href}
      className={`text-sm ${current === href ? 'text-emerald-400' : 'text-zinc-400 hover:text-emerald-400'}`}
    >
      {label}
    </Link>
  );
  return (
    <header className="border-b border-zinc-800/80 px-5 sm:px-8 py-4 flex items-center justify-between">
      <Link href="/" className="font-semibold tracking-tight">
        Gate<span className="text-emerald-400">Zero</span>
      </Link>
      <nav className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1">
        {item('/start', 'Start')}
        {item('/gate', 'Index')}
        {item('/pricing', 'Pricing')}
        {item('/contact', 'Contact')}
      </nav>
    </header>
  );
}
