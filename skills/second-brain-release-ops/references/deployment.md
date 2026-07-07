# Deployment Reference

Use this when changing Coolify, Cloudflare Tunnel, environment variables, release docs, or production rollout behavior.

## Coolify

- Deploy as a Node/Nixpacks application, not as a static Vite site, because `server.mjs` serves API routes and the SPA.
- Use:
  - Install command: `npm ci`
  - Build command: `npm run build`
  - Start command: `npm run start`
  - Port exposes: `3000`
  - Health check: `/api/health`
- Keep sensitive values runtime-only where possible:
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `GITHUB_TOKEN`
- Public frontend values may use `VITE_` only when they are intentionally browser-safe:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_STRIPE_PUBLIC_KEY`

## Cloudflare Tunnel

- Publish `www.downloadsecondbrain.com` to the Coolify-routed app.
- Do not expose the laptop with router port forwarding.
- Route Stripe and Supabase callbacks through the same public hostname:
  - `https://www.downloadsecondbrain.com`
  - `https://www.downloadsecondbrain.com/api/webhooks/stripe`

## Laptop-Server Safety

- Do not store packaged installers or DMGs on the laptop. Redirect `/api/downloads/*` to GitHub Release asset URLs.
- Avoid local Postgres, Redis, analytics, queues, and file storage unless the user explicitly asks and accepts the load.
- Use small in-memory caches for GitHub release metadata. Start with 300 seconds.
- Cap desktop log payload size, batch size, and per-user request rate.
- Prefer rollbacks through Coolify's previous local image support or Git revert plus redeploy.
- Keep logs structured and short; never emit bearer tokens, service keys, full prompts, local paths, document text, or binary data.

## Required Runtime Variables

```text
PUBLIC_APP_URL=https://www.downloadsecondbrain.com
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID=
GITHUB_RELEASE_REPO=siyam-a-s/second-brain
GITHUB_TOKEN=
RELEASE_CACHE_TTL_SECONDS=300
LOG_MAX_BYTES=65536
LOG_BATCH_MAX=25
LOG_RATE_LIMIT_PER_MINUTE=10
```
