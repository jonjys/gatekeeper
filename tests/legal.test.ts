import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import sitemap from '../app/sitemap';
import robots from '../app/robots';
import { COMPANY, LEGAL_PATHS, SITE_ORIGIN, siteUrl } from '../lib/company';
import { PRICE_AS_OF, PRICE_SOURCE } from '../lib/engine/prices';
import { jsonError } from '../lib/engine/errors';
import { redactForLog, slog } from '../lib/engine/log';

const IDENTITY_SOURCES = [
  'lib/company.ts',
  'components/SiteFooter.tsx',
  'app/privacy/page.tsx',
  'app/terms/page.tsx',
  'app/contact/page.tsx',
  'app/page.tsx'
];

function readIdentitySource() {
  return IDENTITY_SOURCES.map((rel) => readFileSync(resolve(process.cwd(), rel), 'utf8')).join(
    '\n'
  );
}

describe('company facts', () => {
  it('only publishes approved Nytto Labs identity and contacts', () => {
    expect(COMPANY.operator).toBe('Nytto Labs');
    expect(COMPANY.proprietor).toBe('Fredrik Kornelind');
    expect(COMPANY.country).toBe('Sweden');
    expect(COMPANY.form).toBe('Swedish sole trader');
    expect(COMPANY.fTax).toBe('Approved for F-tax');
    expect(COMPANY.vat).toBe('VAT registered');
    expect(COMPANY.website).toBe('https://nyttolabs.com');
    expect(COMPANY.legalLine).toBe(
      'Operated by Nytto Labs (Fredrik Kornelind), a Swedish sole trader approved for F-tax and registered for VAT.'
    );
    expect(COMPANY.byline).toBe('A product by Nytto Labs');
    expect(COMPANY.footerIdentity).toBe(
      'Nytto Labs · Sweden · approved for F-tax · VAT registered'
    );
    expect(COMPANY.emails).toEqual({
      general: 'hello@nyttolabs.com',
      support: 'support@nyttolabs.com',
      privacy: 'privacy@nyttolabs.com',
      billing: 'billing@nyttolabs.com'
    });
    expect(SITE_ORIGIN).toBe('https://getgatezero.com');
    expect(siteUrl('/privacy')).toBe('https://getgatezero.com/privacy');
  });

  it('does not publish withheld legal details or stale registration claims', () => {
    const published = JSON.stringify(COMPANY);
    const source = readIdentitySource();
    expect(published).not.toMatch(/fkornelind@/i);
    expect(source).not.toMatch(/fkornelind@/i);
    expect(source).not.toMatch(/registration in progress/i);
    expect(source).not.toMatch(/not VAT registered/i);
    expect(source).not.toMatch(/personnummer/i);
    expect(COMPANY.legalLine).toMatch(/approved for F-tax/i);
    expect(COMPANY.legalLine).toMatch(/registered for VAT/i);
    expect(published).not.toMatch(/\d{6}-\d{4}/);
    expect(published).not.toMatch(/SE\d{10}01/i);
  });
});

describe('discoverability', () => {
  it('sitemaps Contact, Privacy, and Terms on the apex', () => {
    const urls = sitemap().map((e) => e.url);
    for (const path of LEGAL_PATHS) {
      expect(urls).toContain(`${SITE_ORIGIN}${path}`);
    }
    expect(urls.every((u) => u.startsWith(SITE_ORIGIN))).toBe(true);
  });

  it('robots allows legal pages and points at the sitemap', () => {
    const r = robots();
    const rules = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    const allow = rules?.allow;
    const allowed = Array.isArray(allow) ? allow : [allow];
    expect(allowed).toEqual(expect.arrayContaining(['/privacy', '/terms', '/contact']));
    expect(r.sitemap).toBe(`${SITE_ORIGIN}/sitemap.xml`);
  });
});

describe('price table citation', () => {
  it('exports source and date', () => {
    expect(PRICE_SOURCE).toMatch(/OpenAI/);
    expect(PRICE_SOURCE).toMatch(/Anthropic/);
    expect(PRICE_AS_OF).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe('log redaction', () => {
  it('strips secrets from fields and string values', () => {
    const out = redactForLog({
      secret: 'sk-secret-value-aaaaaaaa',
      authorization: 'Bearer sk-live-nope',
      detail: 'upstream Authorization: Bearer sk-ant-abcdef123456 failed',
      workspace: '11111111-1111-1111-1111-111111111111'
    }) as Record<string, unknown>;
    expect(out.secret).toBe('[redacted]');
    expect(out.authorization).toBe('[redacted]');
    expect(String(out.detail)).not.toMatch(/sk-ant-/);
    expect(out.workspace).toBe('11111111-1111-1111-1111-111111111111');
  });

  it('does not print secrets via slog', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    slog('vault_decrypt', { level: 'error', token: 'gz_live_' + 'ab'.repeat(16), detail: 'ok' });
    const line = String(spy.mock.calls[0]?.[0]);
    expect(line).toContain('[redacted]');
    expect(line).not.toMatch(/gz_live_[a-f]/);
    spy.mockRestore();
  });
});

describe('error envelope redaction', () => {
  it('redacts secret-shaped detail', async () => {
    const res = jsonError('upstream_failed', 504, { detail: 'Bearer sk-test_abc123456789' });
    const body = await res.json();
    expect(String(body.detail)).not.toMatch(/sk-test_/);
  });
});
