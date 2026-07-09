# Website Server Handoff For Second Brain Desktop

This handoff is for the agent working on `www.downloadsecondbrain.com` and the managed desktop backend. The production desktop app now authenticates with Supabase email/password and sends Supabase session bearer tokens to website and proxy APIs.

## Required Public Build Config

The desktop production build receives these public values from GitHub Actions repository variables:

```text
SECOND_BRAIN_SUPABASE_URL
SECOND_BRAIN_SUPABASE_ANON_KEY
SECOND_BRAIN_WEBSITE_URL=https://www.downloadsecondbrain.com
SECOND_BRAIN_PROXY_URL=https://graphify-proxy-724616525781.us-central1.run.app
```

The Supabase anon key is client-public configuration. Do not expose server-only keys such as Supabase service-role keys, Stripe secrets, proxy secrets, or admin tokens to the desktop app.

## Desktop Authentication Flow

Production desktop first-run shows account sign-in. The user enters the same Supabase email/password used on the website.

Website login deep link:

```text
https://www.downloadsecondbrain.com/login?email=<email>&desktop=1
```

Desktop stores Supabase access and refresh tokens in Electron Main using secure storage. Tokens are not exposed to the renderer. All desktop-to-server requests use:

```http
Authorization: Bearer <supabase_access_token>
```

The server should validate the bearer token against Supabase on every privileged desktop request, derive the user ID from the validated token, then load plan, trial, usage, and entitlement state server-side.

## Required Website API

### `GET /api/desktop/account`

Auth:

```http
Authorization: Bearer <supabase_access_token>
```

Purpose:

- Verify the desktop user session.
- Return account, plan, trial, subscription, and usage state.
- Provide enough status for the desktop app to decide whether managed AI access should be active.

Recommended response shape:

```json
{
  "email": "user@example.com",
  "userId": "supabase-user-id",
  "status": "trialing",
  "planName": "Second Brain Pro",
  "trialEndsAt": "2026-08-01T00:00:00.000Z",
  "subscriptionRenewsAt": null,
  "usage": {
    "periodStart": "2026-07-01T00:00:00.000Z",
    "periodEnd": "2026-08-01T00:00:00.000Z",
    "requests": 42,
    "requestLimit": 1000
  },
  "lastVerifiedAt": "2026-07-09T00:00:00.000Z",
  "release": null
}
```

Allowed `status` values should include at least:

```text
signed_out
trialing
active
past_due
canceled
expired
```

The desktop app should never need a service key, Stripe secret, or proxy signing credential.

For v1, website usage can be the lightweight monthly default from Supabase
subscription columns until the managed AI proxy writes real usage totals.

### `POST /api/desktop/logs`

Auth:

```http
Authorization: Bearer <supabase_access_token>
```

Purpose:

- Accept small redacted JSONL-style diagnostic batches from production desktop.
- Never require logs for core app functionality.
- Return success quickly; upload is best-effort from desktop.

Recommended request shape:

```json
{
  "appVersion": "0.1.5",
  "channel": "production",
  "platform": "win32",
  "arch": "x64",
  "events": [
    {
      "timestamp": "2026-07-09T00:00:00.000Z",
      "type": "chat.proxy_failure",
      "message": "redacted summary",
      "detail": {
        "requestId": "uuid",
        "status": 502
      }
    }
  ]
}
```

Server requirements:

- Validate Supabase bearer token.
- Rate-limit by user ID and device if available.
- Store logs separately from user content.
- Do not require raw document contents, prompts, file paths, binary payloads, or bearer tokens.
- Redact again server-side defensively.

## AI Proxy Contract

The managed AI proxy must accept the same Supabase bearer token:

```http
Authorization: Bearer <supabase_access_token>
```

Proxy responsibilities:

- Validate the Supabase token server-side.
- Resolve the user, plan, subscription/trial state, and usage limits.
- Reject inactive or over-limit accounts with a compact JSON error.
- Forward approved requests to Vertex/OpenAI-compatible backend.
- Return chat-compatible JSON to the desktop app.

Desktop Graphify proxy mode passes:

```text
OPENAI_API_KEY=<supabase_access_token>
OPENAI_BASE_URL=https://graphify-proxy-724616525781.us-central1.run.app/v1
OPENAI_MODEL=<managed model>
```

So the proxy must support OpenAI-compatible `/v1/chat/completions` behavior for Graphify CLI subprocesses, in addition to the app chat endpoint currently used by desktop.

## Release Asset Integration

Production releases use tags:

```text
prod-vX.Y.Z
```

The website should discover or pin the latest production release from:

```text
https://github.com/Siyam-A-S/second-brain/releases
```

Current production asset naming:

```text
Second-Brain-Setup-<version>-prod.exe
Second-Brain-<version>-prod-mac-arm64.dmg
```

The website download page should show platform-specific download buttons and should not distribute development zips.

## Support Notes

Production desktop packages bundle a minimal Python/Graphify runtime inside Electron resources. End users should only install the app. They should not need to install Python, uv, Graphify, or `fpdf2` manually for the default PDF/Office/Graphify workflows.

Video/transcription support is intentionally excluded from the default runtime bundle for size. Treat it as a future optional add-on unless the desktop release notes say otherwise.
