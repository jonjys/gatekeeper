import type { MetadataRoute } from 'next';

const BASE = 'https://getgatezero.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: BASE, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE}/start`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE}/pricing`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/gate`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${BASE}/live`, lastModified: now, changeFrequency: 'hourly', priority: 0.6 }
  ];
}
