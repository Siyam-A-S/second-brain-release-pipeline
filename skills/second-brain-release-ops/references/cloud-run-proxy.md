# Cloud Run Proxy Reference

Use this when managing the managed AI proxy, gcloud configuration, Cloud Run deploys, proxy metering, or Cloud Logging extraction.

## Operating Model

- Keep the website/API on Coolify and the managed AI proxy on Cloud Run.
- Do not run Vertex/OpenAI proxy traffic through the laptop server.
- Default service name: `graphify-proxy`.
- Default region: `us-central1`.
- Public base URL used by desktop:

```text
https://graphify-proxy-724616525781.us-central1.run.app
```

## Before Mutating Cloud Resources

Run read-only checks first:

```bash
gcloud auth list
gcloud config get-value project
gcloud run services list --region us-central1
gcloud run services describe graphify-proxy --region us-central1 --format yaml
```

If the active account, project, service, or region is unclear, stop and ask. Never deploy to a guessed project.

## Proxy Contract

- Accept `Authorization: Bearer <supabase_access_token>`.
- Validate tokens server-side with Supabase Auth or Supabase Admin APIs.
- Resolve user subscription/trial/usage state before forwarding model requests.
- Reject inactive, expired, or over-limit users with compact JSON errors.
- Support OpenAI-compatible `POST /v1/chat/completions` for Graphify CLI proxy mode.
- Forward approved requests to Vertex/OpenAI-compatible backend.
- Preserve or generate request IDs and include them in logs and responses.

Desktop Graphify proxy mode passes:

```text
OPENAI_API_KEY=<supabase_access_token>
OPENAI_BASE_URL=https://graphify-proxy-724616525781.us-central1.run.app/v1
```

## Deployment Guardrails

- Store secrets in Cloud Run env vars backed by Secret Manager where possible.
- Never commit service-account keys, Supabase service-role keys, Vertex credentials, or proxy signing secrets.
- Keep resource limits modest for v1:
  - `--memory 512Mi`
  - `--cpu 1`
  - `--concurrency 20`
  - `--min-instances 0`
  - `--max-instances 2`
- Prefer canary-style deploys and smoke tests before sending desktop traffic.
- Do not add local Redis, local Postgres, or a laptop-hosted queue for proxy metering.

Example deploy shape:

```bash
gcloud run deploy graphify-proxy \
  --region us-central1 \
  --source . \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --concurrency 20 \
  --min-instances 0 \
  --max-instances 2
```

Add `--set-env-vars` only for non-secret values. Add `--set-secrets` for secrets.

## Metering

- Meter accepted model requests by validated Supabase user ID.
- Store compact usage rows or counters in Supabase, not on the laptop.
- Count request start, completion/failure status, model, token estimates when available, and request ID.
- Avoid storing prompts, document text, embeddings, file paths, raw model responses, or bearer tokens.
- Enforce the website account defaults until real usage rows exist: monthly period, `requests`, and `requestLimit`.

## Log Extraction To Laptop

Use Cloud Logging for short diagnostic pulls. Keep extracted files in `.ops-logs/`, redact before sharing, and never commit them.

```bash
mkdir -p .ops-logs
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="graphify-proxy" AND severity>=WARNING' \
  --freshness=2h \
  --limit=100 \
  --format=json > ".ops-logs/cloud-run-$(date -u +%Y%m%dT%H%M%SZ).json"
```

For request tracing, filter by request ID:

```bash
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="graphify-proxy" AND jsonPayload.requestId="<request-id>"' \
  --freshness=24h \
  --limit=50 \
  --format=json
```

Redact before analysis output:

- bearer tokens and API keys
- Supabase service-role values
- emails unless needed for account support
- prompts and document text
- local paths
- binary payloads
- full model responses

## Smoke Tests

After deploy:

```bash
curl -i https://graphify-proxy-724616525781.us-central1.run.app/health
curl -i https://graphify-proxy-724616525781.us-central1.run.app/v1/chat/completions
```

Expected behavior:

- Health endpoint returns a compact success payload.
- Missing bearer token returns `401`.
- Invalid bearer token returns `401`.
- Valid but inactive account returns `403`.
- Valid active/trialing account reaches the model backend and writes metering.
