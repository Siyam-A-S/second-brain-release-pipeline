---
name: second-brain-release-ops
description: Project-specific release operations for the Second Brain release website, desktop API, and managed AI proxy. Use when working in this repo on production website UX, Supabase auth and migrations, Stripe subscriptions and webhooks, GitHub Release downloads or updates, desktop account/log APIs, Coolify deployment, Cloudflare Tunnel exposure, Cloud Run/gcloud proxy operations, proxy metering, log extraction, safe laptop-server hosting, logging, tracing, or release documentation.
---

# Second Brain Release Ops

## Ground Rules

- Treat this repo as the public production entry point for the Second Brain desktop app.
- Keep the Ubuntu laptop server light: no local database, no binary artifact hosting, no analytics warehouse, and no heavy background workers for v1.
- Use Supabase for auth and durable data, Stripe for billing, GitHub Releases for packaged app assets, Coolify for the Node/Nixpacks app, Cloudflare Tunnel for public website HTTPS exposure, and Cloud Run for the managed AI proxy.
- Before changing desktop integration behavior, read `desktop/AGENTS.md` and `desktop/PRODUCTION_RELEASE.md`.

## Workflow

1. Inspect the live repo first: `server.mjs`, `src/App.tsx`, `src/hooks/useAuth.tsx`, `src/lib/supabase.ts`, `.env.example`, `nixpacks.toml`, and `supabase/migrations/`.
2. For deployment, hosting, env vars, rollback, or laptop safety work, read `references/deployment.md`.
3. For account, download, update, logging, tracing, or desktop API work, read `references/api-contracts.md`.
4. For Cloud Run proxy, gcloud, managed AI, proxy metering, or Cloud Logging extraction work, read `references/cloud-run-proxy.md`.
5. Preserve the production contract unless the user explicitly changes it: desktop auth uses Supabase sessions, downloads redirect to GitHub assets, logs are best-effort, and managed AI uses the Supabase bearer-token proxy.
6. Verify with `npm run build`; also smoke API routes locally when runtime secrets are available.

## Implementation Preferences

- Keep server code small and stateless. Prefer in-memory TTL cache for GitHub release metadata before adding persistent cache tables.
- Keep frontend UI simple, modern, and operational: download, account creation, subscription state, desktop sign-in guidance, and release status.
- Never place service-role keys, Stripe secrets, webhook secrets, or GitHub tokens in `VITE_` variables.
- Keep proxy credentials, Vertex settings, service-account keys, and Supabase service-role values out of repo files; use Cloud Run secrets or runtime env vars.
- Add or preserve request IDs on API responses and structured server logs.
- Favor bounded payloads, explicit schemas, and redaction over broad log collection.
- Keep extracted operational logs local, short-lived, redacted, and ignored by git.

## Validation Checklist

- `npm run build`
- Stripe Checkout creation uses a valid Supabase bearer token.
- Stripe webhook syncs subscription create, update, delete, and checkout completion.
- `/api/releases/latest`, `/api/downloads/windows`, `/api/downloads/macos`, and `/api/updates/:platform/:version` handle missing GitHub assets cleanly.
- `/api/desktop/account` rejects missing/expired tokens and returns subscription access state for valid tokens.
- `/api/desktop/logs` enforces size, batch, and rate limits and redacts sensitive fields.
- Cloud Run proxy changes validate Supabase bearer tokens, enforce plan/usage, emit request IDs, and write bounded metering data.
- Coolify config exposes port `3000` and uses runtime-only secrets.
