/**
 * Approved public facts for GateZero / Nytto Labs.
 * Do not invent org numbers, VAT, street address, certifications, or extra emails.
 */
export const SITE_ORIGIN = 'https://getgatezero.com';

export const COMPANY = {
  operator: 'Nytto Labs',
  country: 'Sweden',
  website: 'https://nyttolabs.com',
  product: 'GateZero',
  productUrl: SITE_ORIGIN,
  legalLine: 'Operated by Nytto Labs, Sweden.',
  byline: 'A product by Nytto Labs',
  emails: {
    general: 'hello@nyttolabs.com',
    support: 'support@nyttolabs.com',
    privacy: 'privacy@nyttolabs.com',
    billing: 'billing@nyttolabs.com'
  }
} as const;

export const LEGAL_PATHS = ['/privacy', '/terms', '/contact'] as const;

export function siteUrl(path = '/'): string {
  if (!path || path === '/') return SITE_ORIGIN;
  return `${SITE_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}
