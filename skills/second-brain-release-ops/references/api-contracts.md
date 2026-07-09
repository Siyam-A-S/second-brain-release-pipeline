# API Contracts Reference

Use this when changing desktop auth, account state, release downloads, update checks, logs, tracing, or Stripe/Supabase integration.

## Authentication

- Desktop and website auth use Supabase email/password sessions.
- Authenticated API calls send:

```text
Authorization: Bearer <supabase_access_token>
```

- Validate tokens server-side with `supabaseAdmin.auth.getUser(token)`.
- Do not accept user id or email headers as authority.

## Public Release APIs

`GET /api/releases/latest`
- Returns latest non-draft, non-prerelease GitHub release whose tag starts with `prod-v`.
- Response includes release version, tag, published date, HTML URL, and platform assets.

`GET /api/downloads/windows`
`GET /api/downloads/macos`
- Redirect to GitHub `browser_download_url`.
- Never stream binary assets through the laptop server.

`GET /api/updates/:platform/:currentVersion`
- Platform aliases may normalize to `windows` or `macos`.
- Compare semantic versions when possible.
- If parsing fails, return the latest production release and set `updateAvailable` conservatively.

## Desktop Account API

`GET /api/desktop/account`
- Requires Supabase bearer token.
- Return:
  - `email`
  - `userId`
  - `status`
  - `planName`
  - `trialEndsAt`
  - `subscriptionRenewsAt`
  - `usage.periodStart`
  - `usage.periodEnd`
  - `usage.requests`
  - `usage.requestLimit`
  - `lastVerifiedAt`
  - `release`
- Allowed status values are `signed_out`, `trialing`, `active`, `past_due`, `canceled`, and `expired`.
- Authenticated requests without active or trialing access return `expired`, `past_due`, or `canceled` instead of exposing Stripe internals.
- Do not return Supabase tokens, Stripe IDs, service-role data, passwords, or legacy access keys.

Example response:

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
    "requests": 0,
    "requestLimit": 1000
  },
  "lastVerifiedAt": "2026-07-09T00:00:00.000Z",
  "release": null,
  "requestId": "request-id"
}
```

## Desktop Logs API

`POST /api/desktop/logs`
- Requires Supabase bearer token.
- Body shape:

```json
{
  "appVersion": "0.1.5",
  "channel": "production",
  "platform": "win32",
  "arch": "x64",
  "deviceId": "stable-client-id",
  "events": [
    {
      "timestamp": "2026-07-09T00:00:00.000Z",
      "type": "chat.proxy_failure",
      "level": "error",
      "message": "redacted summary",
      "detail": {
        "requestId": "request-id",
        "status": 502
      }
    }
  ]
}
```

- Enforce `LOG_MAX_BYTES`, `LOG_BATCH_MAX`, and `LOG_RATE_LIMIT_PER_MINUTE`.
- Rate-limit by user ID and stable device ID when provided.
- Insert redacted rows into `desktop_log_events`.
- Return `202` with accepted count when stored.
- Upload is best-effort from the desktop perspective; desktop workflows must not block on failures.
- The server accepts the previous `buildChannel`, `event`, `metadata`, and `occurredAt` keys only for compatibility; new desktop work should use `channel`, `type`, `detail`, and `timestamp`.

## Redaction And Tracing

- Redact bearer tokens, access tokens, refresh tokens, API keys, passwords, secrets, local file paths, prompts, document content, binary payloads, and large strings.
- Add `X-Request-Id` to every response and include `requestId` in JSON payloads.
- Server logs should be structured JSON with request id, level, message, timestamp, and concise details.
- User-facing production desktop errors should remain generic: `Something went wrong. Try again.`

## Stripe And Supabase

- `POST /api/create-checkout-session` requires Supabase bearer token and creates Stripe Checkout subscription sessions.
- Checkout must allow Stripe promotion codes.
- Checkout applies the trial only when the normalized email or phone identity has not already claimed one.
- Trial claims are stored as hashed identities in `billing_trial_claims`; do not store raw email or phone there.
- `POST /api/create-billing-portal-session` requires Supabase bearer token and creates a Stripe Billing Portal session for payment method changes, invoice access, and cancellation.
- Stripe customer and subscription metadata must include `supabase_user_id`.
- Stripe webhook sync must preserve support-managed usage overrides such as `usage_request_limit`.
- Store Stripe `cancel_at_period_end` so the account page can show scheduled cancellation while access remains active.
- Handle:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
- Upsert subscription state by `user_id`.
- Stripe remains the source of truth for billing events; Supabase remains the source of truth for website, desktop, and proxy access checks.
