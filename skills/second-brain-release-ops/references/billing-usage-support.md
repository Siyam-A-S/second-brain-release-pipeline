# Billing, Usage, And Support Reference

Use this when changing subscriptions, cancellation, trials, discounts, usage limits, refunds, account support, or customer-facing billing copy.

## Customer Billing Rules

- Customers must be able to schedule cancellation directly from the account page.
- Keep Stripe Billing Portal available from the account page for payment methods, invoices, and Stripe-hosted billing management.
- Do not cancel subscriptions by editing Supabase rows manually; Stripe webhooks must sync the final access state.
- Direct cancellation APIs should update the Stripe subscription first, then immediately sync the returned Stripe subscription into Supabase.
- Prefer period-end cancellation for paid subscriptions so customers keep access they already paid for.
- If a subscription has `cancel_at_period_end = true`, offer a clear resume action while Stripe still allows it.
- Configure cancellation behavior in Stripe Billing Portal settings. If cancellation is scheduled for period end, preserve access until Stripe marks the subscription inactive.
- Store `cancel_at_period_end` from Stripe so the website can show scheduled cancellation separately from expired access.
- Keep account copy calm and direct: explain that Stripe manages billing and Supabase manages access state.

## Trial Policy

- Trial eligibility is enforced server-side, never by browser state.
- The trial is one per normalized email or phone identity across cancellations and recreated accounts.
- Store trial claims in `billing_trial_claims` as SHA-256 hashes of normalized identities.
- Do not store raw email or phone in `billing_trial_claims`.
- If a user has already claimed a trial, Checkout should create a paid subscription without another trial.
- Existing trial subscriptions should be backfilled into `billing_trial_claims` during migration.

## Discounts And Pricing

- Change subscription fee by creating a new Stripe Price and updating `STRIPE_PRICE_ID` in Coolify for new checkouts.
- Existing customers keep their current Stripe subscription price until migrated or updated in Stripe.
- Use Stripe coupons and promotion codes for discounts. The website should allow promotion codes in Checkout.
- For a specific user, prefer a Stripe customer-specific coupon/promotion code or a manual Stripe subscription discount over custom app billing code.
- Never hard-code free access or discounts in frontend code.

## Usage Limits

- Proxy usage limits live in Supabase `subscriptions.usage_request_limit` and are enforced server-side by the Cloud Run proxy.
- Stripe webhook sync must not reset support-managed usage limits.
- Support can raise or lower a user limit by updating `usage_request_limit`; keep `usage_requests` as the current metered period counter.
- Real proxy metering should write compact counters only. Do not store prompts, document text, embeddings, file paths, raw model responses, or bearer tokens.

## Support Workflow

- Ask for the account email and recent request ID before inspecting logs.
- Use Stripe customer/subscription IDs server-side only; do not expose them in desktop APIs.
- Use Supabase for access state and Stripe for invoices, payment failures, refunds, and cancellation history.
- Refunds should be issued in Stripe, then confirmed by webhook-synced subscription state where relevant.
- Keep support exports local, short-lived, redacted, and ignored by git.
