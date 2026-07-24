# Production Deployment Guide

This guide deploys the Second Brain release website from a Squarespace-purchased domain through Cloudflare Tunnel to Coolify on the Ubuntu laptop.

## 0. Production Domain

Use this canonical production domain everywhere:

```text
https://www.downloadsecondbrain.com
```

The apex domain should redirect to the `www` hostname:

```text
https://downloadsecondbrain.com -> https://www.downloadsecondbrain.com
```

## 1. Move DNS Authority To Cloudflare

1. In Cloudflare, add `downloadsecondbrain.com` as a new site.
2. Cloudflare will assign two nameservers.
3. In Squarespace Domains, open the domain DNS/nameserver settings.
4. Turn off DNSSEC before changing nameservers if it is enabled.
5. Replace Squarespace nameservers with the two Cloudflare nameservers.
6. Wait until Cloudflare marks the zone active.
7. Re-enable DNSSEC from Cloudflare after the zone is active if you want DNSSEC for production.

Do not create A records pointing to the laptop. Cloudflare Tunnel should expose the app without inbound router/firewall ports.

## 2. Deploy The Website In Coolify

Create a Coolify application for this repo:

```text
Build pack: Nixpacks
Install command: npm ci
Build command: npm run build
Start command: npm run start
Port exposes: 3000
Health check path: /api/health
```

Set the application domain in Coolify to:

```text
https://www.downloadsecondbrain.com
```

Keep the app as a Node app, not a static Vite site, because `server.mjs` serves both the SPA and API routes.

## 3. Configure Coolify Environment Variables

Use the values from `.env.example`. Do not paste secrets into any `VITE_` variable.

Public browser-safe variables:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_STRIPE_PUBLIC_KEY=
PUBLIC_APP_URL=https://www.downloadsecondbrain.com
GITHUB_RELEASE_REPO=siyam-a-s/second-brain
RELEASE_CACHE_TTL_SECONDS=300
LOG_MAX_BYTES=65536
LOG_BATCH_MAX=25
LOG_RATE_LIMIT_PER_MINUTE=10
```

Runtime-only secrets:

```text
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID=
GITHUB_TOKEN=
```

`GITHUB_TOKEN` is optional for public releases. It is required when `GITHUB_RELEASE_REPO` is private.

For a private release repo, create a fine-grained GitHub personal access token:

- Repository access: only `Siyam-A-S/second-brain`
- Repository permissions: `Contents: read-only`
- Expiration: short and rotated on a calendar

Store it only as the Coolify runtime secret `GITHUB_TOKEN`. Never put it in a `VITE_` variable or commit it to the repo.

## 4. Publish Through Cloudflare Tunnel

Use Cloudflare Zero Trust or `cloudflared` on the Ubuntu laptop.

Create a tunnel route:

```text
Public hostname: www.downloadsecondbrain.com
Service: the Coolify app route or local Coolify proxy URL
```

Common service targets, depending on how Coolify is reachable from the laptop:

```text
http://localhost:<coolify-proxy-port>
http://127.0.0.1:<coolify-proxy-port>
http://<coolify-internal-hostname>
```

Prefer routing to the Coolify proxy/application domain rather than directly to the container port when Coolify is managing domains and health.

Add an apex redirect after `www.downloadsecondbrain.com` works:

```text
https://downloadsecondbrain.com -> https://www.downloadsecondbrain.com
```

Use a Cloudflare Redirect Rule or Bulk Redirect for this; keep the production app canonical at `www`.

## 5. Configure Supabase

In Supabase Auth URL settings, set:

```text
Site URL: https://www.downloadsecondbrain.com
Redirect URLs:
https://www.downloadsecondbrain.com
https://www.downloadsecondbrain.com/auth
https://www.downloadsecondbrain.com/account
```

Apply the migration:

```text
supabase/migrations/202607010001_subscriptions.sql
```

Confirm these tables exist:

```text
subscriptions
desktop_log_events
```

## 6. Configure Stripe

In Stripe Dashboard:

1. Confirm the subscription product and price.
2. Set `STRIPE_PRICE_ID` in Coolify.
3. Add webhook endpoint:

```text
https://www.downloadsecondbrain.com/api/webhooks/stripe
```

Subscribe to:

```text
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
```

Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`.

## 7. First Production Smoke Test

After deployment:

```bash
curl -i https://www.downloadsecondbrain.com/api/health
curl -i https://www.downloadsecondbrain.com/api/releases/latest
curl -I https://www.downloadsecondbrain.com/api/downloads/windows
curl -I https://www.downloadsecondbrain.com/api/downloads/macos
```

Then test in a browser:

1. Open `https://www.downloadsecondbrain.com`.
2. Create a test user.
3. Sign in.
4. Start Stripe Checkout in test mode first.
5. Confirm `/account` shows the signed-in account.
6. Confirm Stripe webhook updates the `subscriptions` row.
7. Confirm download links redirect through the website API to GitHub release assets. For a private release repo, the website exchanges the private asset API URL for a short-lived GitHub asset URL server-side and does not expose `GITHUB_TOKEN`.

## Secure First-Deployment Principles

- Keep the laptop behind Cloudflare Tunnel only; do not open router ports.
- Keep all secrets out of Git and out of `VITE_` variables.
- Use Stripe test mode until the whole checkout and webhook path is proven.
- Use Supabase Row Level Security; the service-role key belongs only on the server.
- Keep GitHub installers on GitHub Releases, never on the laptop.
- Use a separate browser profile or test Stripe customer for first purchases.
- Start with low log intake limits: 64 KB payloads, 25 events per batch, 10 requests per minute per user.
- Keep Coolify resource limits conservative and watch CPU/RAM during the first real traffic.
- Keep rollback simple: one prior Coolify deployment, one known-good git commit, and no manual database edits unless required.
- Capture only request IDs, status codes, event names, and concise errors in logs.
- Never log bearer tokens, refresh tokens, service-role keys, local paths, prompts, document text, or binary content.
