/**
 * Approved public facts for GateZero / Nytto Labs.
 * Do not invent org numbers, VAT numbers, street address, certifications, or extra emails.
 * Do not publish fkornelind@nyttolabs.com, personal identity numbers, or residential addresses.
 */
export const SITE_ORIGIN = 'https://getgatezero.com';

export const COMPANY = {
  operator: 'Nytto Labs',
  proprietor: 'Fredrik Kornelind',
  country: 'Sweden',
  form: 'Swedish sole trader',
  fTax: 'Approved for F-tax',
  vat: 'VAT registered',
  website: 'https://nyttolabs.com',
  product: 'GateZero',
  productUrl: SITE_ORIGIN,
  legalLine:
    'Operated by Nytto Labs (Fredrik Kornelind), a Swedish sole trader approved for F-tax and registered for VAT.',
  byline: 'A product by Nytto Labs',
  footerIdentity: 'Nytto Labs · Sweden · approved for F-tax · VAT registered',
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
