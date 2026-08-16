/**
 * GateZero Service Worker — THE MOAT
 * Web Locks + IndexedDB decrypt (<100ms) + proxy + Background Sync + Compute Pressure
 * Master key and secrets live ONLY in IndexedDB. Never localStorage (unavailable here).
 */

const DB_NAME = 'gatekeeper';
const STORE_KEYS = 'keys';
const STORE_META = 'meta';
const STORE_QUEUE = 'usage_queue';

let pausedUntil = 0;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_KEYS)) db.createObjectStore(STORE_KEYS);
      if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META);
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        db.createObjectStore(STORE_QUEUE, { autoIncrement: true });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

function idbGet(store, key) {
  return new Promise((resolve, reject) => {
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getMasterKey() {
  const db = await openDB();
  const tx = db.transaction(STORE_META, 'readonly');
  const jwk = await idbGet(tx.objectStore(STORE_META), 'master-jwk');
  if (!jwk) throw new Error('No master key — import .env first');
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
}

async function decryptFromIDB(keyName) {
  const db = await openDB();
  const tx = db.transaction(STORE_KEYS, 'readonly');
  const record = await idbGet(tx.objectStore(STORE_KEYS), keyName);
  if (!record) return null;
  const masterKey = await getMasterKey();
  const iv = new Uint8Array(record.iv);
  const data = new Uint8Array(record.data);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, masterKey, data);
  return new TextDecoder().decode(decrypted);
}

const PROVIDERS = {
  stripe: 'https://api.stripe.com',
  openai: 'https://api.openai.com',
  anthropic: 'https://api.anthropic.com'
};

const KEY_MAP = {
  stripe: 'STRIPE_SECRET_KEY',
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  supabase: 'SUPABASE_SERVICE_KEY'
};

// Compute Pressure — kill switch
try {
  if (typeof PressureObserver !== 'undefined') {
    const observer = new PressureObserver((records) => {
      const last = records[records.length - 1];
      if (last && last.state === 'critical') {
        pausedUntil = Date.now() + 30000;
        console.warn('[GateZero] CPU critical — pausing gates 30s');
      }
    });
    observer.observe('cpu', { sampleInterval: 1000 });
  }
} catch (_) {}

self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (!url.pathname.startsWith('/api/gate/')) return;

  event.respondWith(
    (async () => {
      if (Date.now() < pausedUntil) {
        return new Response(
          JSON.stringify({
            error: 'Kill switch active',
            reason: 'Compute pressure critical or budget trip',
            retry_after_ms: pausedUntil - Date.now()
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json', 'Retry-After': '30' }
          }
        );
      }

      const parts = url.pathname.split('/').filter(Boolean);
      // api, gate, provider, ...path
      const provider = parts[2];
      const remainingPath = parts.slice(3).join('/');
      if (!provider || !PROVIDERS[provider]) {
        return new Response(JSON.stringify({ error: 'Unknown provider' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const headerKey = event.request.headers.get('x-gatekeeper-key');
      const keyName = headerKey || KEY_MAP[provider] || `${provider.toUpperCase()}_API_KEY`;

      if (!self.navigator || !self.navigator.locks) {
        return new Response(JSON.stringify({ error: 'Web Locks API required' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return self.navigator.locks.request(keyName, { mode: 'exclusive' }, async () => {
        let secret = null;
        try {
          secret = await decryptFromIDB(keyName);
          if (!secret) {
            return new Response(
              JSON.stringify({
                error: `Key ${keyName} not found. Import .env first.`
              }),
              { status: 401, headers: { 'Content-Type': 'application/json' } }
            );
          }

          const targetUrl = `${PROVIDERS[provider]}/${remainingPath}${url.search}`;
          const headers = new Headers(event.request.headers);
          headers.delete('host');
          headers.delete('origin');
          headers.delete('referer');
          headers.delete('x-gatekeeper-key');

          if (provider === 'anthropic') {
            headers.set('x-api-key', secret);
            headers.set('anthropic-version', '2023-06-01');
            headers.delete('Authorization');
          } else {
            headers.set('Authorization', `Bearer ${secret}`);
          }

          let body;
          if (event.request.method !== 'GET' && event.request.method !== 'HEAD') {
            body = await event.request.clone().arrayBuffer();
          }

          const start = Date.now();
          const res = await fetch(targetUrl, {
            method: event.request.method,
            headers,
            body,
            redirect: 'manual'
          });
          const duration = Date.now() - start;
          const resBody = await res.arrayBuffer();

          // Queue usage metadata only
          try {
            const db = await openDB();
            const tx = db.transaction(STORE_QUEUE, 'readwrite');
            tx.objectStore(STORE_QUEUE).add({
              provider,
              keyName,
              status: res.status,
              bytes_out: resBody.byteLength,
              cost: 0.001,
              timestamp: Date.now(),
              duration_ms: duration
            });
            if (self.registration && 'sync' in self.registration) {
              await self.registration.sync.register('gatekeeper-usage');
            }
          } catch (_) {}

          const outHeaders = new Headers(res.headers);
          outHeaders.set('x-gatezero-proxy', '1');
          outHeaders.set('x-gatezero-ms', String(duration));

          return new Response(resBody, {
            status: res.status,
            statusText: res.statusText,
            headers: outHeaders
          });
        } catch (err) {
          console.error('[GateZero] proxy error', err);
          return new Response(
            JSON.stringify({ error: 'Proxy failed', detail: String(err) }),
            { status: 502, headers: { 'Content-Type': 'application/json' } }
          );
        } finally {
          secret = null;
        }
      });
    })()
  );
});

self.addEventListener('sync', (event) => {
  if (event.tag !== 'gatekeeper-usage') return;
  event.waitUntil(
    (async () => {
      const db = await openDB();
      const tx = db.transaction(STORE_QUEUE, 'readwrite');
      const store = tx.objectStore(STORE_QUEUE);
      const all = await new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
      // MVP: log + clear. Production posts metadata to Supabase Edge Function.
      for (const item of all) {
        console.log('[GateZero] usage', item);
      }
      store.clear();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'ARM_KILL') {
    const ms = Number(event.data.ms) || 30000;
    pausedUntil = Date.now() + ms;
    event.ports && event.ports[0] && event.ports[0].postMessage({ ok: true, until: pausedUntil });
  }
  if (event.data && event.data.type === 'PING') {
    event.ports &&
      event.ports[0] &&
      event.ports[0].postMessage({
        type: 'PONG',
        pausedUntil,
        pressure: Date.now() < pausedUntil ? 'critical' : 'nominal'
      });
  }
});
