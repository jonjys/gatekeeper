import type { MetadataRoute } from 'next';
import { SITE_ORIGIN } from '@/lib/company';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const pages: Array<{
    path: string;
    changeFrequency: NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>;
    priority: number;
  }> = [
    { path: '/', changeFrequency: 'daily', priority: 1 },
    { path: '/start', changeFrequency: 'weekly', priority: 0.9 },
    { path: '/pricing', changeFrequency: 'weekly', priority: 0.8 },
    { path: '/gate', changeFrequency: 'daily', priority: 0.7 },
    { path: '/live', changeFrequency: 'hourly', priority: 0.6 },
    { path: '/contact', changeFrequency: 'monthly', priority: 0.5 },
    { path: '/privacy', changeFrequency: 'monthly', priority: 0.5 },
    { path: '/terms', changeFrequency: 'monthly', priority: 0.5 }
  ];
  return pages.map((p) => ({
    url: p.path === '/' ? SITE_ORIGIN : `${SITE_ORIGIN}${p.path}`,
    lastModified: now,
    changeFrequency: p.changeFrequency,
    priority: p.priority
  }));
}
