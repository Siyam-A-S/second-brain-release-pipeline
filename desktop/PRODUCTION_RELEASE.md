# Production Release Guide

Second Brain now ships from one main branch with two build channels.

## Channels

- Development: default channel. Use this for local testing, Windows portable zips, macOS beta DMGs, detailed errors, local runtime controls, and grounding/debug UI.
- Production: set `SECOND_BRAIN_BUILD_CHANNEL=production`. Use this for customer-facing managed-service builds distributed through `https://www.downloadsecondbrain.com`.

Production tags must use:

```text
prod-vX.Y.Z
```

Development tags continue to use:

```text
vX.Y.Z
```

## Build Metadata

Packaged builds expose typed metadata to the renderer through `window.api.app.getBuildInfo()`:

- `channel`: `development` or `production`
- `version`
- `buildId`
- `gitCommit`
- `target`

Portable builds also write `BUILD_INFO.txt` with the same channel signal.

## Development Packaging

The existing test workflows remain unchanged:

```bash
npm run package:win
npm run package:mac:adhoc
```

Development builds keep grounding inspection, raw error details, local runtime settings, model settings, Graphify command output, and debug statuses.

## Production Packaging

Production scripts:

```bash
npm run package:prod:win:installer
npm run package:prod:mac:dmg
```

The production GitHub workflow lives at:

```text
.github/workflows/production-release.yml
```

It uploads:

- `Second-Brain-Setup-<version>-prod.exe`
- `Second-Brain-<version>-prod-mac-arm64.dmg`
- `install-second-brain-runtime.command`

## Runtime Dependencies

Windows production uses the NSIS installer hook in `build/installer.nsh`. It runs:

```text
scripts/production-runtime/install-second-brain-runtime.ps1
```

The script checks or installs Python, uv, Graphify with file support, and `fpdf2`.

macOS production publishes this companion script:

```text
scripts/production-runtime/install-second-brain-runtime.command
```

Users should run it once if the app reports missing runtime support. The app still verifies dependencies at first run and can repair them if the installer or script was skipped.

## Managed Account Access

Production Settings are account-first. Customers create or sign in to their account at:

```text
https://www.downloadsecondbrain.com
```

The desktop app uses the same Supabase email/password account as the website and sends the current Supabase access token to website APIs. Model names, endpoints, local Graphify token controls, and grounding debug views are hidden from production UI.

Desktop endpoints:

- `GET https://www.downloadsecondbrain.com/api/desktop/account`
- `POST https://www.downloadsecondbrain.com/api/desktop/logs`
- `GET https://www.downloadsecondbrain.com/api/updates/:platform/:currentVersion`

Authenticated endpoints use:

```text
Authorization: Bearer <supabase access token>
```

Download and release endpoints:

- `GET https://www.downloadsecondbrain.com/api/releases/latest`
- `GET https://www.downloadsecondbrain.com/api/downloads/windows`
- `GET https://www.downloadsecondbrain.com/api/downloads/macos`

Download endpoints redirect to GitHub Release assets. The laptop server must never host packaged binaries directly.

## Error And Log Policy

Production UI shows this exact user-facing error:

```text
Something went wrong. Try again.
```

Detailed errors are written as JSONL logs under the app user-data directory:

```text
logs/second-brain-YYYY-MM-DD.jsonl
```

Logs redact access keys, bearer tokens, long prompts, raw document-like content, local user paths, and binary payloads. Upload is best-effort and never blocks chat, ingestion, artifact creation, or settings workflows.

Website log intake also caps request size, batch size, and per-user request rate. Each API response includes an `X-Request-Id` header and JSON `requestId` for support correlation.

## Distribution

Production releases should be distributed through `www.downloadsecondbrain.com`, not by sharing development zips. The website should track versions, account status, trial/subscription state, and the download links for the latest production release assets.

Current production release verified through the website API:

- Version: `0.1.4`
- Tag: `prod-v0.1.4`
- GitHub release: `https://github.com/Siyam-A-S/second-brain/releases/tag/prod-v0.1.4`
- Windows website download: `https://www.downloadsecondbrain.com/api/downloads/windows`
- macOS website download: `https://www.downloadsecondbrain.com/api/downloads/macos`
- Windows GitHub asset: `https://github.com/Siyam-A-S/second-brain/releases/download/prod-v0.1.4/Second-Brain-Setup-0.1.4-prod.exe`
- macOS GitHub asset: `https://github.com/Siyam-A-S/second-brain/releases/download/prod-v0.1.4/Second-Brain-0.1.4-prod-mac-arm64.dmg`

## Website Hosting

The release website is a Node/Nixpacks app in Coolify, not a static Vite site, because `server.mjs` serves both the SPA and API routes.

Coolify settings:

- Build pack: Nixpacks
- Install command: `npm ci`
- Build command: `npm run build`
- Start command: `npm run start`
- Port exposes: `3000`
- Health check: `/api/health`
- Runtime-only secrets: `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and optional `GITHUB_TOKEN`

Cloudflare Tunnel should publish `www.downloadsecondbrain.com` to the Coolify-routed service. Supabase site/callback URLs and Stripe webhook URLs should use the public Cloudflare hostname:

```text
https://www.downloadsecondbrain.com
https://www.downloadsecondbrain.com/api/webhooks/stripe
```
