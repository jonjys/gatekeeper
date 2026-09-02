import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/dashboard', '/onboard'] },
    sitemap: 'https://getgatezero.com/sitemap.xml',
    host: 'https://getgatezero.com'
  };
}
