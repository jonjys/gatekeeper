import type { MetadataRoute } from 'next';
import { SITE_ORIGIN } from '@/lib/company';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/privacy', '/terms', '/contact'],
      disallow: ['/api/', '/dashboard', '/onboard']
    },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
    host: SITE_ORIGIN
  };
}
