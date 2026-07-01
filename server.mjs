import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Stripe from "stripe";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "dist");
const indexFile = path.join(distDir, "index.html");
const port = Number(process.env.PORT || 3000);

const configSchema = z.object({
  PUBLIC_APP_URL: z.string().url(),
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

const checkoutHeaderSchema = z.object({
  authorization: z.string().regex(/^Bearer\s.+$/),
  "x-supabase-user-email": z.string().email(),
  "x-supabase-user-id": z.string().uuid(),
});

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendFile(filePath, res) {
  const ext = path.extname(filePath);
  const contentType = contentTypes[ext] || "application/octet-stream";

  res.writeHead(200, { "Content-Type": contentType });
  createReadStream(filePath).pipe(res);
}

async function readBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

async function authenticateCheckoutRequest(req) {
  const headerResult = checkoutHeaderSchema.safeParse(req.headers);

  if (!headerResult.success) {
    throw Object.assign(new Error("Missing or invalid authentication headers."), {
      statusCode: 401,
    });
  }

  const headers = headerResult.data;
  const accessToken = headers.authorization.replace(/^Bearer\s/, "");
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);

  if (error || !data.user) {
    throw Object.assign(new Error("Supabase session validation failed."), {
      statusCode: 401,
    });
  }

  if (data.user.id !== headers["x-supabase-user-id"]) {
    throw Object.assign(new Error("User header does not match authenticated session."), {
      statusCode: 403,
    });
  }

  if ((data.user.email || "") !== headers["x-supabase-user-email"]) {
    throw Object.assign(new Error("Email header does not match authenticated session."), {
      statusCode: 403,
    });
  }

  return {
    email: headers["x-supabase-user-email"],
    userId: headers["x-supabase-user-id"],
  };
}

async function getOrCreateCustomer(userId, email) {
  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw Object.assign(new Error(error.message), { statusCode: 500 });
  }

  if (data?.stripe_customer_id) {
    return data.stripe_customer_id;
  }

  const customer = await stripe.customers.create({
    email,
    metadata: {
      supabase_user_id: userId,
    },
  });

  return customer.id;
}

async function handleCreateCheckoutSession(req, res) {
  try {
    const user = await authenticateCheckoutRequest(req);
    const customerId = await getOrCreateCustomer(user.userId, user.email);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.userId,
      line_items: [
        {
          price: env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      success_url: `${env.PUBLIC_APP_URL}/checkout?success=1`,
      cancel_url: `${env.PUBLIC_APP_URL}/checkout?canceled=1`,
      metadata: {
        supabase_user_id: user.userId,
      },
      subscription_data: {
        trial_period_days: 2,
        metadata: {
          supabase_user_id: user.userId,
        },
      },
    });

    if (!session.url) {
      throw Object.assign(new Error("Stripe did not return a checkout URL."), {
        statusCode: 500,
      });
    }

    sendJson(res, 200, { url: session.url });
  } catch (error) {
    sendJson(res, error.statusCode || 500, {
      error: error instanceof Error ? error.message : "Unable to create checkout session.",
    });
  }
}

async function upsertSubscriptionFromStripe(subscription) {
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

  const payload = {
    user_id: userId,
    stripe_customer_id:
      typeof subscription.customer === "string" ? subscription.customer : null,
    stripe_subscription_id: subscription.id,
    status: subscription.status,
    trial_start: subscription.trial_start
      ? new Date(subscription.trial_start * 1000).toISOString()
      : null,
    trial_end: subscription.trial_end
      ? new Date(subscription.trial_end * 1000).toISOString()
      : null,
  };

  const { error } = await supabaseAdmin.from("subscriptions").upsert(payload, {
    onConflict: "user_id",
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function handleStripeWebhook(req, res) {
  try {
    const signature = req.headers["stripe-signature"];

    if (typeof signature !== "string") {
      sendJson(res, 400, { error: "Missing Stripe signature." });
      return;
    }

    const rawBody = await readBody(req);
    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );

    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await upsertSubscriptionFromStripe(event.data.object);
        break;
      default:
        break;
    }

    sendJson(res, 200, { received: true });
  } catch (error) {
    sendJson(res, 400, {
      error: error instanceof Error ? error.message : "Webhook handling failed.",
    });
  }
}

async function serveStaticApp(req, res) {
  const requestPath = new URL(req.url || "/", `http://${req.headers.host}`).pathname;
  const normalizedPath = requestPath === "/" ? "/index.html" : requestPath;
  const targetPath = path.normalize(path.join(distDir, normalizedPath));

  if (!targetPath.startsWith(distDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const fileStat = await stat(targetPath);

    if (fileStat.isFile()) {
      sendFile(targetPath, res);
      return;
    }
  } catch {
    // Fall through to the SPA fallback when the requested asset is not present.
  }

  if (existsSync(indexFile)) {
    sendFile(indexFile, res);
    return;
  }

  res.writeHead(404);
  res.end("Build output not found. Run `npm run build` first.");
}

const server = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/api/create-checkout-session") {
    await handleCreateCheckoutSession(req, res);
    return;
  }

  if (req.method === "POST" && req.url === "/api/webhooks/stripe") {
    await handleStripeWebhook(req, res);
    return;
  }

  await serveStaticApp(req, res);
});

server.listen(port, () => {
  console.log(`Second Brain web server listening on port ${port}`);
});
