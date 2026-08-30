export type VacuumHit = {
  surface: string;
  count: number;
  samples: string[];
};

function mask(v: string): string {
  const t = v.trim();
  if (t.length <= 8) return '****';
  return `${t.slice(0, 3)}…${t.slice(-3)}`;
}

function extractSecrets(text: string): string[] {
  const found: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    if (/^[A-Z_][A-Z0-9_]*=.+/.test(t) || /sk[-_][a-zA-Z0-9]{8,}/.test(t)) {
      const eq = t.indexOf('=');
      const val = eq > 0 ? t.slice(eq + 1).trim() : t;
      found.push(mask(val.replace(/^['"]|['"]$/g, '')));
    }
  }
  return found;
}

/** Tap-only. Never poll clipboard — iOS would spam Klistra in. */
export async function runVacuum(): Promise<{ hits: VacuumHit[]; total: number }> {
  const hits: VacuumHit[] = [];

  try {
    if (navigator.clipboard?.readText) {
      const clip = await navigator.clipboard.readText();
      const samples = extractSecrets(clip);
      if (samples.length) hits.push({ surface: 'clipboard', count: samples.length, samples: samples.slice(0, 5) });
    }
  } catch {
    /* permission */
  }

  try {
    const blob = Object.keys(localStorage)
      .map((k) => `${k}=${localStorage.getItem(k) || ''}`)
      .join('\n');
    const samples = extractSecrets(blob);
    if (samples.length) hits.push({ surface: 'localStorage', count: samples.length, samples: samples.slice(0, 5) });
  } catch {
    /* */
  }

  return { hits, total: hits.reduce((n, h) => n + h.count, 0) };
}

export function mintTrapSecret() {
  const b = new Uint8Array(18);
  crypto.getRandomValues(b);
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `sk-trap_${hex}`;
}
