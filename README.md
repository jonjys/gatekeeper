# GateZero - The last API gateway you'll ever need

Your keys never leave your machine. Your money never leaves your pocket.

Local-first gateway that proxies, locks, rotates and bills all API traffic. **2% take rate.**

## Stack

Next.js 14 + Supabase + Stripe + Vercel PWA.

**Moat:** Web Locks · File System Access · Service Worker · Background Sync · Compute Pressure.

## Security

Keys in IndexedDB + WebCrypto AES-GCM. Never sent to server. SW holds plaintext <100ms under exclusive lock.

## Dev

```bash
cp .env.example .env.local
pnpm i
pnpm dev
```

Open localhost:3000 → **Import .env** → change fetches to `/api/gate/{provider}/…`.

## License

AGPL-3.0. Self-host free. We bill 2% on hosted.
