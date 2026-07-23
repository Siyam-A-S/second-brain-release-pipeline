# API Contracts Reference

Use this when changing desktop auth, account state, release downloads, update checks, logs, tracing, or Stripe/Supabase integration.

## Authentication

- Desktop auth uses verified Supabase email/password sessions.
- Website auth supports verified email/password plus Google OAuth.
- Authenticated API calls send:

```text
Authorization: Bearer <supabase_access_token>
```

- Validate tokens server-side with `supabaseAdmin.auth.getUser(token)`.
- Require verified email ownership before account, billing, log, or proxy access.
- Return `403` with `code: "email_verification_required"` for unverified email/password sessions.
- Do not accept user id or email headers as authority.
- Google-only users can sign in on the website; desktop Google sign-in requires a future browser OAuth handoff.

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
- Valid signed-in users are active even without a Stripe subscription.
- Return:
  - `email`
  - `userId`
  - `status`
  - `planName`
  - `trialEndsAt`
  - `subscriptionRenewsAt`
  - `usage.label`
  - `usage.used`
  - `usage.limit`
  - `usage.resetAt`
  - `usage.updatedAt`
  - `lastVerifiedAt`
  - `release`
- `status` is `active` for valid signed-in users unless a future banned/disabled account state is added.
- Active Pro subscription returns `planName: "Second Brain Pro"` and daily limit `1000`.
- Missing, expired, canceled, or past-due Pro subscription falls back to `planName: "Second Brain Free"` and the configured free daily limit.
- Do not return Supabase tokens, Stripe IDs, service-role data, passwords, or legacy access keys.

Example response:

```json
{
  "email": "user@example.com",
  "userId": "supabase-user-id",
  "status": "active",
  "planName": "Second Brain Free",
  "trialEndsAt": null,
  "subscriptionRenewsAt": null,
  "usage": {
    "label": "Daily requests",
    "used": 42,
    "limit": 250,
    "resetAt": "2026-07-14T00:00:00.000Z",
    "updatedAt": "2026-07-13T12:00:00.000Z"
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
- Checkout is for the Pro plan only and uses Stripe `mode: "subscription"`.
- Checkout must allow Stripe promotion codes.
- Do not pass `payment_method_types`; let Stripe dynamic payment methods work.
- Free accounts do not require Stripe subscriptions.
- `POST /api/create-billing-portal-session` requires Supabase bearer token and creates a Stripe Billing Portal session for payment method changes, invoice access, and cancellation.
- `POST /api/cancel-subscription` requires Supabase bearer token and schedules the authenticated user's Stripe subscription to cancel at period end.
- `POST /api/resume-subscription` requires Supabase bearer token and removes a scheduled period-end cancellation when Stripe still allows the subscription to continue.
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

## Proxy Usage RPC

- `consume_proxy_usage(p_user_id, p_increment)` enforces daily Free/Pro request limits.
- Return fields are `allowed`, `reason`, `plan_name`, `used`, `limit`, `reset_at`, and `updated_at`.
- Active Pro gets `Second Brain Pro` and `1000` daily requests.
- Any valid signed-in non-Pro user gets `Second Brain Free` and the configured free daily request limit.
- Over-limit responses return `allowed: false` and `reason: "over_limit"`.
