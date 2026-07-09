# App Development Agent Instructions

Use this file as the prompt or handoff for an agent working in the Second Brain Electron app repository.

## Prompt

You are working in the Second Brain desktop app codebase. Integrate the production release website at:

```text
https://www.downloadsecondbrain.com
```

Read the release-pipeline artifacts before coding:

- `desktop/AGENTS.md`
- `desktop/PRODUCTION_RELEASE.md`

Implement the desktop side of production account access, update checks, and best-effort diagnostics.

## Required Behavior

- Keep development builds unchanged unless a shared contract must be introduced.
- In production builds, Settings must be account-first:
  - Users sign in with the same Supabase email/password account used on the website.
  - Store Supabase session tokens securely using the app's existing secure storage pattern, or add a Main-process secure storage service if none exists.
  - Do not ask users for account access keys; the release website now uses Supabase sessions.
- Desktop API calls must use:

```text
Authorization: Bearer <supabase access token>
```

- Account status must call:

```text
GET https://www.downloadsecondbrain.com/api/desktop/account
```

- Account status returns flat fields:

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
  "lastVerifiedAt": "2026-07-09T00:00:00.000Z"
}
```

- Treat `signed_out`, `trialing`, `active`, `past_due`, `canceled`, and `expired` as the account state set.
- Update checks must call:

```text
GET https://www.downloadsecondbrain.com/api/updates/:platform/:currentVersion
```

- Diagnostics upload must call:

```text
POST https://www.downloadsecondbrain.com/api/desktop/logs
```

- Diagnostics upload body:

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
      "message": "redacted summary",
      "detail": {
        "requestId": "request-id",
        "status": 502
      }
    }
  ]
}
```

- Download buttons or links may open:

```text
https://www.downloadsecondbrain.com/api/downloads/windows
https://www.downloadsecondbrain.com/api/downloads/macos
```

## Architecture Rules

- Keep network auth, token refresh, log upload, and update checks in Electron Main or a trusted service layer.
- Expose only typed, narrow preload IPC to the renderer.
- Keep React renderer focused on forms, status display, and user actions.
- Preserve local-first behavior: capture, search, ingestion, graph, and existing vault workflows must work without an active website session unless the feature explicitly requires managed account access.
- Never log bearer tokens, refresh tokens, passwords, prompts, document content, binary payloads, or full local paths.
- Production UI should show this generic error for unexpected failures:

```text
Something went wrong. Try again.
```

- Detailed local logs should remain JSONL under the app user-data directory:

```text
logs/second-brain-YYYY-MM-DD.jsonl
```

## Suggested Implementation Steps

1. Locate current production settings, build-channel checks, preload API, and Main-process service patterns.
2. Add a typed account service:
   - sign in with Supabase email/password
   - refresh session
   - sign out
   - fetch `/api/desktop/account`
   - expose account state to renderer
3. Update production Settings UI:
   - email/password sign-in form
   - signed-in account state
   - subscription/access state
   - trial/subscription dates
   - sign-out action
   - link to `https://www.downloadsecondbrain.com/account`
4. Add update metadata checks:
   - map Electron platform to `windows` or `macos`
   - pass current production version
   - surface update availability without blocking startup
5. Add diagnostics upload:
   - batch small redacted events
   - upload best-effort only
   - retry later or drop safely when offline
   - include app version, build channel, stable device id if already available, and event timestamps
6. Keep development debug settings visible in development builds only.
7. Validate packaged behavior, not just Vite/Electron dev mode.

## Acceptance Criteria

- Production user can sign in from the desktop app using Supabase email/password.
- Production desktop app can fetch account status from `/api/desktop/account`.
- Subscription blocked, trialing, active, canceled, and signed-out states render clearly.
- Missing/expired token triggers a recoverable sign-in state.
- Log upload never blocks chat, ingestion, artifact creation, settings, or app quit.
- Log payloads are redacted before leaving the app.
- Update checks tolerate offline/network failure and do not block startup.
- Development channel still exposes local runtime/model/debug controls.
- Production channel hides model endpoints, Graphify budgets, raw command output, and grounding debug views.
- Packaged Windows and macOS builds can still find runtime dependencies and write local logs.

## Validation Commands

Run the closest equivalents available in the app repo:

```bash
npm run build
npm run package:win
npm run package:mac:adhoc
npm run package:prod:win:installer
npm run package:prod:mac:dmg
```

If packaging all targets is too slow, at minimum run the build plus one packaged production build on the current OS and document the skipped target.
