import type { ReactNode } from 'react';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';

export default function LegalShell({
  current,
  badge,
  title,
  updated,
  children
}: {
  current: string;
  badge: string;
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen flex flex-col">
      <SiteHeader current={current} />
      <article className="flex-1 max-w-3xl mx-auto w-full px-5 py-14 space-y-8">
        <header className="space-y-3">
          <p className="badge">{badge}</p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{title}</h1>
          <p className="text-xs text-zinc-500">Last updated {updated}</p>
        </header>
        <div className="space-y-6 text-sm text-zinc-400 leading-relaxed [&_h2]:text-zinc-50 [&_h2]:text-lg [&_h2]:font-semibold [&_a]:text-emerald-400 hover:[&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2 [&_code]:text-emerald-300/90 [&_code]:font-mono [&_code]:text-[0.8rem]">
          {children}
        </div>
      </article>
      <SiteFooter />
    </main>
  );
}
