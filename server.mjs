import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import Stripe from "stripe";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "dist");
const indexFile = path.join(distDir, "index.html");
const port = Number(process.env.PORT || 3000);

const configSchema = z.object({
  GITHUB_RELEASE_REPO: z.string().min(1).default("siyam-a-s/second-brain"),
  GITHUB_TOKEN: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(1).optional(),
  ),
  LOG_BATCH_MAX: z.coerce.number().int().min(1).max(100).default(25),
  LOG_MAX_BYTES: z.coerce.number().int().min(1024).max(262144).default(65536),
  LOG_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).max(120).default(10),
  PUBLIC_APP_URL: z.string().url(),
  RELEASE_CACHE_TTL_SECONDS: z.coerce.number().int().min(15).max(3600).default(300),
  STRIPE_PRICE_ID: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_URL: z.string().url(),
});

const env = configSchema.parse(process.env);

const stripe = new Stripe(env.STRIPE_SECRET_KEY);
const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const desktopLogBodySchema = z.object({
  appVersion: z.string().max(80).optional(),
  arch: z.string().max(40).optional(),
  buildChannel: z.string().max(40).optional(),
  channel: z.string().max(40).optional(),
  deviceId: z.string().max(120).optional(),
  platform: z.string().max(40).optional(),
  events: z
    .array(
      z
        .object({
          detail: z.record(z.string(), z.unknown()).optional(),
          event: z.string().max(120).optional(),
          level: z.enum(["debug", "info", "warn", "error"]).default("info").optional(),
          message: z.string().max(2000).optional(),
          metadata: z.record(z.string(), z.unknown()).optional(),
          occurredAt: z.string().datetime().optional(),
          timestamp: z.string().datetime().optional(),
          type: z.string().max(120).optional(),
        })
        .passthrough()
        .refine((event) => event.event || event.type, {
          message: "Each log event requires event or type.",
        }),
    )
    .min(1),
});

const releaseCache = {
  expiresAt: 0,
  value: null,
};

const logRateLimit = new Map();

function getRequestId(req) {
  const incoming = req.headers["x-request-id"];

  if (typeof incoming === "string" && incoming.length <= 120) {
    return incoming;
  }

  return randomUUID();
}

function logRequest(level, requestId, message, details = {}) {
  const payload = {
    level,
    message,
    requestId,
    timestamp: new Date().toISOString(),
    ...details,
  };

  const writer = level === "error" ? console.error : console.log;
  writer(JSON.stringify(payload));
}

function sendJson(res, statusCode, payload, requestId, headers = {}) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "X-Request-Id": requestId,
    ...headers,
  });
  res.end(JSON.stringify({ ...payload, requestId }));
}

function sendRedirect(res, statusCode, location, requestId) {
  res.writeHead(statusCode, {
    Location: location,
    "X-Request-Id": requestId,
  });
  res.end();
}

function sendFile(filePath, res, requestId) {
  const ext = path.extname(filePath);
  const contentType = contentTypes[ext] || "application/octet-stream";

  res.writeHead(200, { "Content-Type": contentType, "X-Request-Id": requestId });
  createReadStream(filePath).pipe(res);
}

async function readBody(req, maxBytes = 1024 * 1024) {
  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    const nextChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += nextChunk.byteLength;

    if (totalBytes > maxBytes) {
      throw Object.assign(new Error("Request body is too large."), {
        statusCode: 413,
      });
    }

    chunks.push(nextChunk);
  }

  return Buffer.concat(chunks);
}

async function readJson(req, maxBytes) {
  const rawBody = await readBody(req, maxBytes);

  if (rawBody.byteLength === 0) {
    return {};
  }

  return JSON.parse(rawBody.toString("utf8"));
}

async function authenticateSupabaseRequest(req) {
  const authorization = req.headers.authorization;

  if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) {
    throw Object.assign(new Error("Missing bearer token."), { statusCode: 401 });
  }

  const accessToken = authorization.replace(/^Bearer\s/, "");
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);

  if (error || !data.user) {
    throw Object.assign(new Error("Supabase session validation failed."), {
      statusCode: 401,
    });
  }

  return data.user;
}

function normalizeEmail(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized.includes("@") ? normalized : null;
}

function normalizePhone(value) {
  const digitsOnly = String(value || "").replace(/\D/g, "");
  return digitsOnly.length >= 10 ? digitsOnly : null;
}

function hashTrialIdentity(value) {
  return createHash("sha256").update(value).digest("hex");
}

function getTrialIdentityCandidates(user) {
  const candidates = [];
  const email = normalizeEmail(user.email);

  if (email) {
    candidates.push({
      identity_hash: hashTrialIdentity(email),
      identity_type: "email",
    });
  }

  const phoneValues = [
    user.phone,
    user.user_metadata?.phone,
    user.user_metadata?.phone_number,
    user.app_metadata?.phone,
  ];
  const phone = normalizePhone(phoneValues.find(Boolean));

  if (phone) {
    candidates.push({
      identity_hash: hashTrialIdentity(phone),
      identity_type: "phone",
    });
  }

  return candidates;
}

function isUniqueConstraintError(error) {
  return error?.code === "23505" || /duplicate key|unique constraint/i.test(error?.message || "");
}

async function hasTrialClaim(identities) {
  for (const identity of identities) {
    const { data, error } = await supabaseAdmin
      .from("billing_trial_claims")
      .select("identity_type, identity_hash")
      .eq("identity_type", identity.identity_type)
      .eq("identity_hash", identity.identity_hash)
      .maybeSingle();

    if (error) {
      throw Object.assign(new Error(error.message), { statusCode: 500 });
    }

    if (data) {
      return true;
    }
  }

  return false;
}

async function claimTrialIdentities(user, customerId) {
  const identities = getTrialIdentityCandidates(user);

  if (!identities.length || await hasTrialClaim(identities)) {
    return false;
  }

  const now = new Date().toISOString();
  const rows = identities.map((identity) => ({
    ...identity,
    claimed_at: now,
    first_user_id: user.id,
    last_seen_at: now,
    stripe_customer_id: customerId,
  }));
  const { error } = await supabaseAdmin.from("billing_trial_claims").insert(rows);

  if (!error) {
    return true;
  }

  if (isUniqueConstraintError(error)) {
    return false;
  }

  throw Object.assign(new Error(error.message), { statusCode: 500 });
}

function isMissingColumnError(error, columnNames) {
  const haystack = `${error?.code || ""} ${error?.message || ""} ${error?.details || ""}`;
  return columnNames.some((columnName) => haystack.includes(columnName));
}

function normalizeSubscriptionRow(subscription) {
  if (!subscription) {
    return null;
  }

  return {
    plan_name: "Second Brain Pro",
    cancel_at_period_end: false,
    subscription_renews_at: null,
    usage_period_end: null,
    usage_period_start: null,
    usage_request_limit: 1000,
    usage_requests: 0,
    ...subscription,
  };
}

async function fetchSubscription(userId) {
  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select(
      "user_id, stripe_customer_id, stripe_subscription_id, status, cancel_at_period_end, trial_start, trial_end, plan_name, subscription_renews_at, usage_period_start, usage_period_end, usage_requests, usage_request_limit, updated_at",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error && isMissingColumnError(error, [
    "plan_name",
    "cancel_at_period_end",
    "subscription_renews_at",
    "usage_period_start",
    "usage_period_end",
    "usage_requests",
    "usage_request_limit",
  ])) {
    const { data: fallbackData, error: fallbackError } = await supabaseAdmin
      .from("subscriptions")
      .select(
        "user_id, stripe_customer_id, stripe_subscription_id, status, trial_start, trial_end, updated_at",
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (fallbackError) {
      throw Object.assign(new Error(fallbackError.message), { statusCode: 500 });
    }

    return normalizeSubscriptionRow(fallbackData);
  }

  if (error) {
    throw Object.assign(new Error(error.message), { statusCode: 500 });
  }

  return normalizeSubscriptionRow(data);
}

function toIsoFromStripeTimestamp(timestamp) {
  return timestamp ? new Date(timestamp * 1000).toISOString() : null;
}

function getStripeCurrentPeriodEnd(subscription) {
  if (subscription.current_period_end) {
    return toIsoFromStripeTimestamp(subscription.current_period_end);
  }

  const itemPeriodEnd = subscription.items?.data?.find((item) => item.current_period_end)
    ?.current_period_end;
  return toIsoFromStripeTimestamp(itemPeriodEnd);
}

function getStripePlanName(subscription) {
  const firstItem = subscription.items?.data?.[0];
  const nickname = firstItem?.price?.nickname;

  if (nickname) {
    return nickname;
  }

  const product = firstItem?.price?.product;

  if (product && typeof product === "object" && "name" in product) {
    return product.name;
  }

  return "Second Brain Pro";
}

function getDesktopAccountStatus(subscription) {
  const status = subscription?.status || null;
  const trialEndMs = subscription?.trial_end
    ? new Date(subscription.trial_end).getTime()
    : 0;
  const trialActive = Boolean(trialEndMs && trialEndMs > Date.now());

  if (status === "trialing" || trialActive) {
    return "trialing";
  }

  if (status === "active" || status === "past_due" || status === "canceled") {
    return status;
  }

  return "expired";
}

function getDefaultUsagePeriod(now = new Date()) {
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  return {
    periodEnd: periodEnd.toISOString(),
    periodStart: periodStart.toISOString(),
  };
}

function toDesktopUsage(subscription) {
  const defaults = getDefaultUsagePeriod();

  return {
    periodEnd: subscription?.usage_period_end || defaults.periodEnd,
    periodStart: subscription?.usage_period_start || defaults.periodStart,
    requestLimit: Number(subscription?.usage_request_limit ?? 1000),
    requests: Number(subscription?.usage_requests ?? 0),
  };
}

async function getOrCreateCustomer(userId, email) {
  const subscription = await fetchSubscription(userId);

  if (subscription?.stripe_customer_id) {
    return subscription.stripe_customer_id;
  }

  const customer = await stripe.customers.create({
    email,
    metadata: {
      supabase_user_id: userId,
    },
  });

  const payload = {
    user_id: userId,
    stripe_customer_id: customer.id,
    status: subscription?.status || null,
    cancel_at_period_end: subscription?.cancel_at_period_end || false,
    stripe_subscription_id: subscription?.stripe_subscription_id || null,
    plan_name: subscription?.plan_name || "Second Brain Pro",
    subscription_renews_at: subscription?.subscription_renews_at || null,
    trial_end: subscription?.trial_end || null,
    trial_start: subscription?.trial_start || null,
    usage_period_end: subscription?.usage_period_end || null,
    usage_period_start: subscription?.usage_period_start || null,
    usage_request_limit: subscription?.usage_request_limit || 1000,
    usage_requests: subscription?.usage_requests || 0,
  };
  const { error } = await upsertSubscriptionPayload(payload);

  if (error) {
    throw Object.assign(new Error(error.message), { statusCode: 500 });
  }

  return customer.id;
}

async function handleCreateCheckoutSession(req, res, requestId) {
  try {
    const user = await authenticateSupabaseRequest(req);

    if (!user.email) {
      throw Object.assign(new Error("Authenticated user has no email address."), {
        statusCode: 400,
      });
    }

    const customerId = await getOrCreateCustomer(user.id, user.email);
    const trialEligible = await claimTrialIdentities(user, customerId);
    const subscriptionData = {
      metadata: {
        supabase_user_id: user.id,
      },
    };

    if (trialEligible) {
      subscriptionData.trial_period_days = 2;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      allow_promotion_codes: true,
      line_items: [
        {
          price: env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      success_url: `${env.PUBLIC_APP_URL}/account?checkout=success`,
      cancel_url: `${env.PUBLIC_APP_URL}/account?checkout=canceled`,
      metadata: {
        supabase_user_id: user.id,
      },
      subscription_data: subscriptionData,
    });

    if (!session.url) {
      throw Object.assign(new Error("Stripe did not return a checkout URL."), {
        statusCode: 500,
      });
    }

    sendJson(res, 200, { url: session.url }, requestId);
  } catch (error) {
    sendJson(res, error.statusCode || 500, {
      error: error instanceof Error ? error.message : "Unable to create checkout session.",
    }, requestId);
  }
}

async function handleCreateBillingPortalSession(req, res, requestId) {
  try {
    const user = await authenticateSupabaseRequest(req);
    const subscription = await fetchSubscription(user.id);
    const customerId = subscription?.stripe_customer_id;

    if (!customerId) {
      throw Object.assign(new Error("No Stripe customer exists for this account."), {
        statusCode: 400,
      });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${env.PUBLIC_APP_URL}/account`,
    });

    if (!session.url) {
      throw Object.assign(new Error("Stripe did not return a billing portal URL."), {
        statusCode: 500,
      });
    }

    sendJson(res, 200, { url: session.url }, requestId);
  } catch (error) {
    sendJson(res, error.statusCode || 500, {
      error: error instanceof Error ? error.message : "Unable to open billing portal.",
    }, requestId);
  }
}

async function resolveStripeSubscriptionUser(subscription) {
  let userId = subscription.metadata?.supabase_user_id || null;

  if (!userId && typeof subscription.customer === "string") {
    const customer = await stripe.customers.retrieve(subscription.customer);

    if (!customer.deleted) {
      userId = customer.metadata?.supabase_user_id || null;
    }
  }

  if (!userId) {
    throw new Error("Unable to resolve Supabase user from Stripe subscription metadata.");
  }

  return userId;
}

async function upsertSubscriptionPayload(payload) {
  const { error } = await supabaseAdmin.from("subscriptions").upsert(payload, {
    onConflict: "user_id",
  });

  if (!error || !isMissingColumnError(error, [
    "plan_name",
    "cancel_at_period_end",
    "subscription_renews_at",
    "usage_period_start",
    "usage_period_end",
    "usage_requests",
    "usage_request_limit",
  ])) {
    return { error };
  }

  const {
    cancel_at_period_end: _cancelAtPeriodEnd,
    plan_name: _planName,
    subscription_renews_at: _subscriptionRenewsAt,
    usage_period_end: _usagePeriodEnd,
    usage_period_start: _usagePeriodStart,
    usage_request_limit: _usageRequestLimit,
    usage_requests: _usageRequests,
    ...fallbackPayload
  } = payload;

  return supabaseAdmin.from("subscriptions").upsert(fallbackPayload, {
    onConflict: "user_id",
  });
}

async function upsertSubscriptionFromStripe(subscription) {
  const userId = await resolveStripeSubscriptionUser(subscription);
  const payload = {
    user_id: userId,
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    stripe_customer_id:
      typeof subscription.customer === "string" ? subscription.customer : null,
    stripe_subscription_id: subscription.id,
    status: subscription.status,
    plan_name: getStripePlanName(subscription),
    subscription_renews_at: getStripeCurrentPeriodEnd(subscription),
    trial_start: toIsoFromStripeTimestamp(subscription.trial_start),
    trial_end: toIsoFromStripeTimestamp(subscription.trial_end),
    updated_at: new Date().toISOString(),
  };

  const { error } = await upsertSubscriptionPayload(payload);

  if (error) {
    throw new Error(error.message);
  }
}

async function handleStripeWebhook(req, res, requestId) {
  try {
    const signature = req.headers["stripe-signature"];

    if (typeof signature !== "string") {
      sendJson(res, 400, { error: "Missing Stripe signature." }, requestId);
      return;
    }

    const rawBody = await readBody(req);
    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;

        if (typeof session.subscription === "string") {
          const subscription = await stripe.subscriptions.retrieve(session.subscription);
          await upsertSubscriptionFromStripe(subscription);
        }

        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await upsertSubscriptionFromStripe(event.data.object);
        break;
      default:
        break;
    }

    sendJson(res, 200, { received: true }, requestId);
  } catch (error) {
    logRequest("error", requestId, "stripe_webhook_failed", {
      error: error instanceof Error ? error.message : "Unknown webhook error",
    });
    sendJson(res, 400, {
      error: error instanceof Error ? error.message : "Webhook handling failed.",
    }, requestId);
  }
}

function normalizePlatform(platform) {
  const normalized = String(platform || "").toLowerCase();

  if (["win", "windows", "exe", "nsis"].includes(normalized)) {
    return "windows";
  }

  if (["mac", "macos", "darwin", "dmg", "arm64"].includes(normalized)) {
    return "macos";
  }

  return null;
}

function parseVersion(value) {
  const match = String(value || "").match(/(\d+)\.(\d+)\.(\d+)/);

  if (!match) {
    return null;
  }

  return match.slice(1).map((part) => Number(part));
}

function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);

  if (!a || !b) {
    return null;
  }

  for (let index = 0; index < 3; index += 1) {
    if (a[index] > b[index]) {
      return 1;
    }

    if (a[index] < b[index]) {
      return -1;
    }
  }

  return 0;
}

function selectReleaseAssets(release) {
  const assets = Array.isArray(release.assets) ? release.assets : [];

  const windows = assets.find((asset) =>
    /Second-Brain-Setup-.*-prod\.exe$/i.test(asset.name),
  ) || assets.find((asset) => /\.exe$/i.test(asset.name));

  const macos = assets.find((asset) =>
    /Second-Brain-.*-prod-mac-arm64\.dmg$/i.test(asset.name),
  ) || assets.find((asset) => /\.dmg$/i.test(asset.name));

  return {
    macos: macos
      ? {
          name: macos.name,
          size: macos.size,
          url: `${env.PUBLIC_APP_URL}/api/downloads/macos`,
        }
      : null,
    windows: windows
      ? {
          name: windows.name,
          size: windows.size,
          url: `${env.PUBLIC_APP_URL}/api/downloads/windows`,
        }
      : null,
  };
}

function toPublicRelease(release) {
  return {
    assets: selectReleaseAssets(release),
    body: release.body || "",
    htmlUrl: release.html_url,
    name: release.name || release.tag_name,
    publishedAt: release.published_at,
    tagName: release.tag_name,
    version: release.tag_name?.replace(/^prod-v/i, "") || release.tag_name,
  };
}

async function fetchGitHubJson(url) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "second-brain-release-pipeline",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw Object.assign(new Error(`GitHub returned ${response.status}.`), {
      statusCode: 502,
    });
  }

  return response.json();
}

async function getLatestProductionRelease() {
  if (releaseCache.value && releaseCache.expiresAt > Date.now()) {
    return releaseCache.value;
  }

  const releases = await fetchGitHubJson(
    `https://api.github.com/repos/${env.GITHUB_RELEASE_REPO}/releases?per_page=20`,
  );
  const release = Array.isArray(releases) && releases.find(
    (item) =>
      !item.draft &&
      !item.prerelease &&
      typeof item.tag_name === "string" &&
      item.tag_name.startsWith("prod-v"),
  );

  if (!release) {
    throw Object.assign(new Error("No production GitHub release was found."), {
      statusCode: 404,
    });
  }

  releaseCache.value = release;
  releaseCache.expiresAt = Date.now() + env.RELEASE_CACHE_TTL_SECONDS * 1000;
  return release;
}

async function handleLatestRelease(_req, res, requestId) {
  try {
    const release = await getLatestProductionRelease();
    sendJson(res, 200, { release: toPublicRelease(release) }, requestId, {
      "Cache-Control": `public, max-age=${Math.min(env.RELEASE_CACHE_TTL_SECONDS, 300)}`,
    });
  } catch (error) {
    sendJson(res, error.statusCode || 500, {
      error: error instanceof Error ? error.message : "Unable to fetch release.",
    }, requestId);
  }
}

async function handleDownload(platform, res, requestId) {
  try {
    const normalizedPlatform = normalizePlatform(platform);

    if (!normalizedPlatform) {
      sendJson(res, 404, { error: "Unknown platform." }, requestId);
      return;
    }

    const release = await getLatestProductionRelease();
    const assets = Array.isArray(release.assets) ? release.assets : [];
    const asset = assets.find((candidate) => {
      if (normalizedPlatform === "windows") {
        return /Second-Brain-Setup-.*-prod\.exe$/i.test(candidate.name);
      }

      return /Second-Brain-.*-prod-mac-arm64\.dmg$/i.test(candidate.name);
    });

    if (!asset?.browser_download_url) {
      sendJson(res, 404, { error: "No release asset exists for this platform." }, requestId);
      return;
    }

    sendRedirect(res, 302, asset.browser_download_url, requestId);
  } catch (error) {
    sendJson(res, error.statusCode || 500, {
      error: error instanceof Error ? error.message : "Unable to resolve download.",
    }, requestId);
  }
}

async function handleUpdate(platform, currentVersion, res, requestId) {
  try {
    const normalizedPlatform = normalizePlatform(platform);

    if (!normalizedPlatform) {
      sendJson(res, 404, { error: "Unknown platform." }, requestId);
      return;
    }

    const release = await getLatestProductionRelease();
    const publicRelease = toPublicRelease(release);
    const comparison = compareVersions(publicRelease.version, currentVersion);
    const updateAvailable = comparison === null ? true : comparison > 0;

    sendJson(res, 200, {
      platform: normalizedPlatform,
      release: publicRelease,
      updateAvailable,
    }, requestId);
  } catch (error) {
    sendJson(res, error.statusCode || 500, {
      error: error instanceof Error ? error.message : "Unable to check updates.",
    }, requestId);
  }
}

async function handleDesktopAccount(req, res, requestId) {
  try {
    const user = await authenticateSupabaseRequest(req);
    const [subscription, release] = await Promise.all([
      fetchSubscription(user.id),
      getLatestProductionRelease().catch(() => null),
    ]);

    sendJson(res, 200, {
      email: user.email || null,
      lastVerifiedAt: new Date().toISOString(),
      planName: subscription?.plan_name || "Second Brain Pro",
      release: release ? toPublicRelease(release) : null,
      status: getDesktopAccountStatus(subscription),
      subscriptionRenewsAt: subscription?.subscription_renews_at || null,
      trialEndsAt: subscription?.trial_end || null,
      usage: toDesktopUsage(subscription),
      userId: user.id,
    }, requestId);
  } catch (error) {
    sendJson(res, error.statusCode || 500, {
      error: error instanceof Error ? error.message : "Unable to fetch account.",
    }, requestId);
  }
}

function getLogRateKey(userId, deviceId) {
  const windowId = Math.floor(Date.now() / 60000);
  return `${userId}:${deviceId || "unknown-device"}:${windowId}`;
}

function assertLogRateLimit(userId, deviceId) {
  const key = getLogRateKey(userId, deviceId);
  const nextCount = (logRateLimit.get(key) || 0) + 1;
  logRateLimit.set(key, nextCount);

  if (logRateLimit.size > 5000) {
    const currentWindow = Math.floor(Date.now() / 60000);

    for (const cachedKey of logRateLimit.keys()) {
      if (!cachedKey.endsWith(`:${currentWindow}`)) {
        logRateLimit.delete(cachedKey);
      }
    }
  }

  if (nextCount > env.LOG_RATE_LIMIT_PER_MINUTE) {
    throw Object.assign(new Error("Log rate limit exceeded."), { statusCode: 429 });
  }
}

function redactValue(value) {
  if (typeof value === "string") {
    return value
      .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [redacted]")
      .replace(/(access[_-]?token|refresh[_-]?token|api[_-]?key|password|secret)\s*[:=]\s*([^&\s,}]+)/gi, "$1=[redacted]")
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted-email]")
      .replace(/\b(sk|pk|whsec)_(test|live)_[A-Za-z0-9_]+/gi, "[redacted-secret]")
      .replace(/[A-Z]:\\Users\\[^\\\s]+/gi, "[redacted-path]")
      .replace(/\/home\/[^/\s]+/gi, "[redacted-path]")
      .slice(0, 2000);
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => redactValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).slice(0, 50).map(([key, item]) => {
        if (/token|password|secret|prompt|document|content|binary|path/i.test(key)) {
          return [key, "[redacted]"];
        }

        return [key, redactValue(item)];
      }),
    );
  }

  return value;
}

async function handleDesktopLogs(req, res, requestId) {
  try {
    const user = await authenticateSupabaseRequest(req);
    const payload = desktopLogBodySchema.parse(await readJson(req, env.LOG_MAX_BYTES));
    assertLogRateLimit(user.id, payload.deviceId);

    const events = payload.events.slice(0, env.LOG_BATCH_MAX);
    const rows = events.map((event) => ({
      app_version: payload.appVersion || null,
      arch: payload.arch || null,
      build_channel: payload.channel || payload.buildChannel || null,
      device_id: payload.deviceId || null,
      event_name: event.type || event.event,
      level: event.level || "info",
      message: event.message ? redactValue(event.message) : null,
      metadata: redactValue(event.detail || event.metadata || {}),
      occurred_at: event.timestamp || event.occurredAt || new Date().toISOString(),
      platform: payload.platform || null,
      request_id: requestId,
      user_id: user.id,
    }));

    let { error } = await supabaseAdmin.from("desktop_log_events").insert(rows);

    if (error && isMissingColumnError(error, ["arch", "platform"])) {
      const fallbackRows = rows.map(({ arch: _arch, platform: _platform, ...row }) => row);
      ({ error } = await supabaseAdmin.from("desktop_log_events").insert(fallbackRows));
    }

    if (error) {
      throw Object.assign(new Error(error.message), { statusCode: 500 });
    }

    sendJson(res, 202, { accepted: rows.length }, requestId);
  } catch (error) {
    const statusCode = error.statusCode || 400;
    logRequest(statusCode >= 500 ? "error" : "info", requestId, "desktop_logs_rejected", {
      error: error instanceof Error ? error.message : "Invalid log payload",
      statusCode,
    });
    sendJson(res, statusCode, {
      error: error instanceof Error ? error.message : "Unable to accept desktop logs.",
    }, requestId);
  }
}

async function handleHealth(_req, res, requestId) {
  sendJson(res, 200, {
    ok: true,
    service: "second-brain-web",
    timestamp: new Date().toISOString(),
  }, requestId);
}

async function serveStaticApp(req, res, requestId) {
  const requestPath = new URL(req.url || "/", `http://${req.headers.host}`).pathname;
  const normalizedPath = requestPath === "/" ? "/index.html" : requestPath;
  const targetPath = path.normalize(path.join(distDir, normalizedPath));

  if (!targetPath.startsWith(distDir)) {
    res.writeHead(403, { "X-Request-Id": requestId });
    res.end("Forbidden");
    return;
  }

  try {
    const fileStat = await stat(targetPath);

    if (fileStat.isFile()) {
      sendFile(targetPath, res, requestId);
      return;
    }
  } catch {
    // Fall through to the SPA fallback when the requested asset is not present.
  }

  if (existsSync(indexFile)) {
    sendFile(indexFile, res, requestId);
    return;
  }

  res.writeHead(404, { "X-Request-Id": requestId });
  res.end("Build output not found. Run `npm run build` first.");
}

const server = http.createServer(async (req, res) => {
  const requestId = getRequestId(req);
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  const isGetLike = req.method === "GET" || req.method === "HEAD";

  try {
    if (isGetLike && url.pathname === "/api/health") {
      await handleHealth(req, res, requestId);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/create-checkout-session") {
      await handleCreateCheckoutSession(req, res, requestId);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/create-billing-portal-session") {
      await handleCreateBillingPortalSession(req, res, requestId);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/webhooks/stripe") {
      await handleStripeWebhook(req, res, requestId);
      return;
    }

    if (isGetLike && url.pathname === "/api/releases/latest") {
      await handleLatestRelease(req, res, requestId);
      return;
    }

    const downloadMatch = url.pathname.match(/^\/api\/downloads\/([^/]+)$/);

    if (isGetLike && downloadMatch) {
      await handleDownload(downloadMatch[1], res, requestId);
      return;
    }

    const updateMatch = url.pathname.match(/^\/api\/updates\/([^/]+)\/([^/]+)$/);

    if (isGetLike && updateMatch) {
      await handleUpdate(updateMatch[1], decodeURIComponent(updateMatch[2]), res, requestId);
      return;
    }

    if (isGetLike && url.pathname === "/api/desktop/account") {
      await handleDesktopAccount(req, res, requestId);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/desktop/logs") {
      await handleDesktopLogs(req, res, requestId);
      return;
    }

    if (url.pathname.startsWith("/api/")) {
      sendJson(res, 404, { error: "API route not found." }, requestId);
      return;
    }

    await serveStaticApp(req, res, requestId);
  } catch (error) {
    logRequest("error", requestId, "request_failed", {
      error: error instanceof Error ? error.message : "Unknown request error",
      method: req.method,
      path: url.pathname,
    });
    sendJson(res, error.statusCode || 500, {
      error: error instanceof Error ? error.message : "Request failed.",
    }, requestId);
  }
});

server.listen(port, () => {
  console.log(`Second Brain web server listening on port ${port}`);
});
