# Billing, Usage, And Support Reference

Use this when changing subscriptions, cancellation, trials, discounts, usage limits, refunds, account support, or customer-facing billing copy.

## Customer Billing Rules

- Production access is signed-in freemium: valid Supabase users get Free without a Stripe subscription.
- Pro is a Stripe subscription priced at `$10/month`.
- Customers must be able to schedule cancellation directly from the account page.
- Keep Stripe Billing Portal available from the account page for payment methods, invoices, and Stripe-hosted billing management.
- Do not cancel subscriptions by editing Supabase rows manually; Stripe webhooks must sync the final access state.
- Direct cancellation APIs should update the Stripe subscription first, then immediately sync the returned Stripe subscription into Supabase.
- Prefer period-end cancellation for paid subscriptions so customers keep access they already paid for.
- If a subscription has `cancel_at_period_end = true`, offer a clear resume action while Stripe still allows it.
- Configure cancellation behavior in Stripe Billing Portal settings. If cancellation is scheduled for period end, preserve access until Stripe marks the subscription inactive.
- Store `cancel_at_period_end` from Stripe so the website can show scheduled cancellation separately from expired access.
- Keep account copy calm and direct: explain that Stripe manages Pro billing and Supabase manages access state.

## Trial Policy

- Do not add production free trials unless the product rules explicitly change again.
- Free is the default entitlement for signed-in users.
- Canceled, expired, or past-due Pro users fall back to Free instead of being blocked.

## Discounts And Pricing

- Change the Pro subscription fee by creating a new Stripe Price and updating `STRIPE_PRICE_ID` in Coolify for new checkouts.
- Existing customers keep their current Stripe subscription price until migrated or updated in Stripe.
- Use Stripe coupons and promotion codes for discounts. The website should allow promotion codes in Checkout.
- For a specific user, prefer a Stripe customer-specific coupon/promotion code or a manual Stripe subscription discount over custom app billing code.
- Never hard-code free access or discounts in frontend code.

## Usage Limits

- Proxy usage limits are daily and enforced by `consume_proxy_usage`.
- Free default is `250` daily requests; Pro default is `1000` daily requests.
- Keep the website account API and Cloud Run proxy aligned with Supabase `account_entitlement_settings`.
- Stripe webhook sync must not reset support-managed usage limits.
- Support can adjust global plan limits by updating `account_entitlement_settings`.
- Real proxy metering should write compact counters only. Do not store prompts, document text, embeddings, file paths, raw model responses, or bearer tokens.

## Support Workflow

- Ask for the account email and recent request ID before inspecting logs.
- Use Stripe customer/subscription IDs server-side only; do not expose them in desktop APIs.
- Use Supabase for access state and Stripe for invoices, payment failures, refunds, and cancellation history.
- Refunds should be issued in Stripe, then confirmed by webhook-synced subscription state where relevant.
- Keep support exports local, short-lived, redacted, and ignored by git.
