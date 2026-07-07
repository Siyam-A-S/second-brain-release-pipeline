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
  - `account.userId`
  - `account.email`
  - `account.subscription`
  - `account.access.allowed`
  - `account.access.status`
  - `account.access.subscribed`
  - `account.access.trialActive`
  - `release`
- Access is allowed when subscription status is `active` or `trialing`, or when `trial_end` is in the future.

## Desktop Logs API

`POST /api/desktop/logs`
- Requires Supabase bearer token.
- Body shape:

```json
{
  "appVersion": "1.2.3",
  "buildChannel": "production",
  "deviceId": "stable-client-id",
  "events": [
    {
      "event": "chat_failed",
      "level": "error",
      "message": "Something went wrong.",
      "metadata": {},
      "occurredAt": "2026-07-04T12:00:00.000Z"
    }
  ]
}
```

- Enforce `LOG_MAX_BYTES`, `LOG_BATCH_MAX`, and `LOG_RATE_LIMIT_PER_MINUTE`.
- Insert redacted rows into `desktop_log_events`.
- Return `202` with accepted count when stored.
- Upload is best-effort from the desktop perspective; desktop workflows must not block on failures.

## Redaction And Tracing

- Redact bearer tokens, access tokens, refresh tokens, API keys, passwords, secrets, local file paths, prompts, document content, binary payloads, and large strings.
- Add `X-Request-Id` to every response and include `requestId` in JSON payloads.
- Server logs should be structured JSON with request id, level, message, timestamp, and concise details.
- User-facing production desktop errors should remain generic: `Something went wrong. Try again.`

## Stripe And Supabase

- `POST /api/create-checkout-session` requires Supabase bearer token and creates Stripe Checkout subscription sessions.
- Stripe customer and subscription metadata must include `supabase_user_id`.
- Handle:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
- Upsert subscription state by `user_id`.
