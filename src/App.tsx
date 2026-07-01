import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CreditCard,
  LockKeyhole,
  LogOut,
  MonitorDown,
  UserRound,
} from "lucide-react";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { z } from "zod";
import { useAuth } from "./hooks/useAuth";

const checkoutSessionSchema = z.object({
  url: z.string().url(),
});

async function fetchLatestReleaseAssets() {
  // Replace this placeholder with a real fetch to:
  // https://api.github.com/repos/siyam-a-s/second-brain/releases/latest
  // Then map the release assets into macOS / Windows download button URLs.
  return {
    macosUrl: "#",
    windowsUrl: "#",
  };
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function Shell({ children }: { children: ReactNode }) {
  const { isAuthenticated, signOut, user } = useAuth();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.18),_transparent_35%),linear-gradient(180deg,_#0f172a_0%,_#111827_45%,_#020617_100%)] text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8 sm:px-8">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <Link className="text-lg font-semibold tracking-[0.24em] text-amber-200" to="/">
            SECOND BRAIN
          </Link>
          <nav className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
            <Link
              className="rounded-full border border-white/10 px-4 py-2 transition hover:border-amber-300/40 hover:text-white"
              to="/login"
            >
              {isAuthenticated ? "Account" : "Login"}
            </Link>
            <Link
              className="rounded-full bg-amber-300 px-4 py-2 font-medium text-slate-950 transition hover:bg-amber-200"
              to="/checkout"
            >
              Checkout
            </Link>
            {isAuthenticated ? (
              <button
                className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 transition hover:border-white/25 hover:text-white"
                onClick={() => {
                  void signOut();
                }}
                type="button"
              >
                <LogOut className="h-4 w-4" />
                {user?.email ?? "Sign out"}
              </button>
            ) : null}
          </nav>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}

function LandingPage() {
  const [downloadUrls, setDownloadUrls] = useState({
    macosUrl: "#",
    windowsUrl: "#",
  });

  useEffect(() => {
    let isActive = true;

    void fetchLatestReleaseAssets().then((assets) => {
      if (isActive) {
        setDownloadUrls(assets);
      }
    });

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <Shell>
      <section className="grid flex-1 items-center gap-10 py-16 lg:grid-cols-[1.15fr_0.85fr] lg:py-24">
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          initial={{ opacity: 0, y: 18 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          <p className="text-sm uppercase tracking-[0.3em] text-amber-200/80">
            Desktop capture. Search. Recall.
          </p>
          <h1 className="max-w-3xl font-serif text-5xl leading-tight text-white sm:text-6xl">
            Second Brain
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-slate-300">
            Private desktop memory, account access, and subscription billing now share
            one consistent entry point across the landing page and portal.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 font-medium text-slate-950 transition hover:bg-slate-200"
              href={downloadUrls.macosUrl}
            >
              macOS Download
              <MonitorDown className="h-4 w-4" />
            </a>
            <a
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-6 py-3 font-medium text-white transition hover:border-amber-300/50 hover:bg-white/5"
              href={downloadUrls.windowsUrl}
            >
              Windows Download
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </motion.div>

        <motion.div
          animate={{ opacity: 1, scale: 1 }}
          initial={{ opacity: 0, scale: 0.96 }}
          transition={{ delay: 0.1, duration: 0.45 }}
          className="rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-2xl shadow-amber-500/10 backdrop-blur"
        >
          <p className="text-sm uppercase tracking-[0.25em] text-slate-400">
            Account Lifecycle
          </p>
          <div className="mt-6 space-y-4">
            <Link
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-4 transition hover:border-amber-300/40"
              to="/login"
            >
              <span className="flex items-center gap-3">
                <LockKeyhole className="h-5 w-5 text-amber-200" />
                <span>Create account or sign in</span>
              </span>
              <ArrowRight className="h-4 w-4 text-slate-400" />
            </Link>
            <Link
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-4 transition hover:border-amber-300/40"
              to="/checkout"
            >
              <span className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-amber-200" />
                <span>Start a 2-day trial</span>
              </span>
              <ArrowRight className="h-4 w-4 text-slate-400" />
            </Link>
          </div>
        </motion.div>
      </section>
    </Shell>
  );
}

function LoginPage() {
  const {
    error,
    isAuthenticated,
    isLoading,
    signIn,
    signUp,
    subscription,
    user,
  } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      if (mode === "signup") {
        await signUp({ email, password });
      } else {
        await signIn({ email, password });
      }
    } catch (submitError) {
      setFormError(
        submitError instanceof Error ? submitError.message : "Authentication failed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Shell>
      <section className="flex flex-1 items-center justify-center py-16">
        <div className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-white/5 p-8 backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-amber-200/80">
                /login
              </p>
              <h2 className="mt-4 font-serif text-4xl text-white">Supabase Auth</h2>
            </div>
            <div className="rounded-full border border-white/10 bg-slate-950/40 p-1">
              <button
                className={`rounded-full px-4 py-2 text-sm transition ${
                  mode === "signin" ? "bg-amber-300 text-slate-950" : "text-slate-300"
                }`}
                onClick={() => setMode("signin")}
                type="button"
              >
                Sign in
              </button>
              <button
                className={`rounded-full px-4 py-2 text-sm transition ${
                  mode === "signup" ? "bg-amber-300 text-slate-950" : "text-slate-300"
                }`}
                onClick={() => setMode("signup")}
                type="button"
              >
                Sign up
              </button>
            </div>
          </div>

          {isAuthenticated ? (
            <div className="mt-8 rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-6">
              <div className="flex items-center gap-3">
                <UserRound className="h-5 w-5 text-emerald-200" />
                <div>
                  <p className="text-sm text-emerald-100">Authenticated</p>
                  <p className="text-lg text-white">{user?.email ?? "Unknown email"}</p>
                </div>
              </div>
              <p className="mt-4 text-sm text-slate-200">
                Subscription status: {subscription?.status ?? "No subscription row yet"}
              </p>
              <Link
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 font-medium text-slate-950 transition hover:bg-slate-200"
                to="/checkout"
              >
                Continue to checkout
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              <label className="block">
                <span className="mb-2 block text-sm text-slate-300">Email</span>
                <input
                  autoComplete="email"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-amber-300/50"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@downloadsecondbrain.com"
                  type="email"
                  value={email}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-slate-300">Password</span>
                <input
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-amber-300/50"
                  minLength={8}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  type="password"
                  value={password}
                />
              </label>

              {formError || error ? (
                <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  {formError ?? error}
                </div>
              ) : null}

              <button
                className="inline-flex w-full items-center justify-center rounded-full bg-amber-300 px-5 py-3 font-medium text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={isLoading || isSubmitting}
                type="submit"
              >
                {isSubmitting
                  ? "Submitting..."
                  : mode === "signup"
                    ? "Create account"
                    : "Sign in"}
              </button>
            </form>
          )}
        </div>
      </section>
    </Shell>
  );
}

function CheckoutCard() {
  const { accessToken, error, isSubscribed, isTrialActive, subscription, user } = useAuth();
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const location = useLocation();

  const statusLabel = useMemo(() => {
    if (isSubscribed) {
      return "Access active";
    }

    if (isTrialActive) {
      return "Trial running";
    }

    return "No active subscription";
  }, [isSubscribed, isTrialActive]);

  useEffect(() => {
    const stripeKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;

    if (stripeKey) {
      void loadStripe(stripeKey);
    }
  }, []);

  async function handleStartTrial() {
    if (!user?.id || !user.email || !accessToken) {
      setCheckoutError("Your session is incomplete. Sign in again before checkout.");
      return;
    }

    setCheckoutError(null);
    setIsStartingCheckout(true);

    try {
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "x-supabase-user-email": user.email,
          "x-supabase-user-id": user.id,
        },
        body: JSON.stringify({}),
      });

      const payload = await response.json();

      if (!response.ok) {
        const message =
          payload && typeof payload.error === "string"
            ? payload.error
            : "Unable to create checkout session.";
        throw new Error(message);
      }

      const { url } = checkoutSessionSchema.parse(payload);
      window.location.assign(url);
    } catch (requestError) {
      setCheckoutError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to start Stripe checkout.",
      );
    } finally {
      setIsStartingCheckout(false);
    }
  }

  return (
    <Shell>
      <section className="flex flex-1 items-center justify-center py-16">
        <div className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-white/5 p-8 backdrop-blur">
          <div className="flex flex-col gap-3 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-amber-200/80">
                /checkout
              </p>
              <h2 className="mt-4 font-serif text-4xl text-white">Stripe Subscription</h2>
            </div>
            <div className="rounded-full border border-white/10 bg-slate-950/40 px-4 py-2 text-sm text-slate-200">
              {statusLabel}
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-5">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
                Account
              </p>
              <p className="mt-3 text-lg text-white">{user?.email ?? "Unknown user"}</p>
              <p className="mt-2 text-sm text-slate-300">
                Supabase user ID: {user?.id ?? "Unavailable"}
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-5">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
                Trial window
              </p>
              <p className="mt-3 text-lg text-white">
                {subscription?.status ?? "No subscription"}
              </p>
              <p className="mt-2 text-sm text-slate-300">
                Start: {formatDate(subscription?.trial_start ?? null)}
              </p>
              <p className="mt-1 text-sm text-slate-300">
                End: {formatDate(subscription?.trial_end ?? null)}
              </p>
            </div>
          </div>

          {location.search.includes("success=1") ? (
            <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              Checkout completed. Stripe will sync the subscription row via webhook shortly.
            </div>
          ) : null}

          {location.search.includes("canceled=1") ? (
            <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              Checkout was canceled before completion.
            </div>
          ) : null}

          {checkoutError || error ? (
            <div className="mt-6 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {checkoutError ?? error}
            </div>
          ) : null}

          <button
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-amber-300 px-6 py-3 font-medium text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={isStartingCheckout}
            onClick={() => {
              void handleStartTrial();
            }}
            type="button"
          >
            <CreditCard className="h-4 w-4" />
            {isStartingCheckout ? "Redirecting..." : "Start 2-Day Free Trial"}
          </button>
        </div>
      </section>
    </Shell>
  );
}

function CheckoutPage() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Shell>
        <section className="flex flex-1 items-center justify-center py-16">
          <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-4 text-slate-200">
            Loading account state...
          </div>
        </section>
      </Shell>
    );
  }

  if (!isAuthenticated) {
    return <Navigate replace to="/login" />;
  }

  return <CheckoutCard />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/checkout" element={<CheckoutPage />} />
    </Routes>
  );
}
