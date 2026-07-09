import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Download,
  ExternalLink,
  KeyRound,
  LogOut,
  MonitorDown,
  RotateCcw,
  ShieldCheck,
  UserRound,
  XCircle,
} from "lucide-react";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { z } from "zod";
import { useAuth } from "./hooks/useAuth";

const checkoutSessionSchema = z.object({
  url: z.string().url(),
});

const releaseSchema = z.object({
  release: z.object({
    assets: z.object({
      macos: z
        .object({
          name: z.string(),
          size: z.number().nullable().optional(),
          url: z.string(),
        })
        .nullable(),
      windows: z
        .object({
          name: z.string(),
          size: z.number().nullable().optional(),
          url: z.string(),
        })
        .nullable(),
    }),
    htmlUrl: z.string().url().optional(),
    name: z.string(),
    publishedAt: z.string().nullable().optional(),
    tagName: z.string(),
    version: z.string(),
  }),
});

type LatestRelease = z.infer<typeof releaseSchema>["release"];

async function fetchLatestRelease() {
  const response = await fetch("/api/releases/latest");
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(
      payload && typeof payload.error === "string"
        ? payload.error
        : "Unable to load release.",
    );
  }

  return releaseSchema.parse(payload).release;
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatBytes(value: number | null | undefined) {
  if (!value) {
    return "";
  }

  return `${Math.round(value / 1024 / 1024)} MB`;
}

function AppShell({ children }: { children: ReactNode }) {
  const { isAuthenticated, signOut, user } = useAuth();

  return (
    <div className="min-h-screen bg-[#f6f8fb] text-[#171717]">
      <header className="sticky top-0 z-20 border-b border-black/10 bg-[#f6f8fb]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link className="flex items-center gap-3" to="/">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-[#171717] text-sm font-semibold text-white">
              SB
            </span>
            <span className="text-sm font-semibold uppercase tracking-[0.18em]">
              Second Brain
            </span>
          </Link>

          <nav className="flex items-center gap-2 text-sm">
            <Link
              className="hidden rounded-md px-3 py-2 text-neutral-600 transition hover:bg-white hover:text-neutral-950 sm:inline-flex"
              to="/#download"
            >
              Download
            </Link>
            <Link
              className="rounded-md px-3 py-2 text-neutral-600 transition hover:bg-white hover:text-neutral-950"
              to={isAuthenticated ? "/account" : "/auth"}
            >
              {isAuthenticated ? "Account" : "Sign in"}
            </Link>
            {isAuthenticated ? (
              <button
                className="hidden items-center gap-2 rounded-md border border-black/10 bg-white px-3 py-2 text-neutral-700 shadow-sm transition hover:border-black/20 hover:text-neutral-950 sm:inline-flex"
                onClick={() => {
                  void signOut();
                }}
                type="button"
              >
                <LogOut className="h-4 w-4" />
                {user?.email ?? "Sign out"}
              </button>
            ) : (
              <Link
                className="inline-flex items-center gap-2 rounded-md bg-[#236f5a] px-4 py-2 font-medium text-white shadow-sm transition hover:bg-[#1d5d4c]"
                to="/auth?mode=signup"
              >
                Create account
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}

function ReleaseDownload({ release }: { release: LatestRelease | null }) {
  const windows = release?.assets.windows;
  const macos = release?.assets.macos;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <a
        className={`group flex min-h-24 items-center justify-between rounded-md border border-black/10 bg-white px-5 py-4 shadow-sm transition ${
          windows ? "hover:-translate-y-0.5 hover:border-[#236f5a]/50" : "pointer-events-none opacity-60"
        }`}
        href={windows?.url ?? "#"}
      >
        <span>
          <span className="block font-medium">Windows installer</span>
          <span className="mt-1 block text-sm text-neutral-500">
            {windows ? `${windows.name} ${formatBytes(windows.size)}` : "Coming soon"}
          </span>
        </span>
        <Download className="h-5 w-5 text-[#236f5a] transition group-hover:translate-y-0.5" />
      </a>
      <a
        className={`group flex min-h-24 items-center justify-between rounded-md border border-black/10 bg-white px-5 py-4 shadow-sm transition ${
          macos ? "hover:-translate-y-0.5 hover:border-[#236f5a]/50" : "pointer-events-none opacity-60"
        }`}
        href={macos?.url ?? "#"}
      >
        <span>
          <span className="block font-medium">macOS Apple Silicon</span>
          <span className="mt-1 block text-sm text-neutral-500">
            {macos ? `${macos.name} ${formatBytes(macos.size)}` : "Coming soon"}
          </span>
        </span>
        <Download className="h-5 w-5 text-[#236f5a] transition group-hover:translate-y-0.5" />
      </a>
    </div>
  );
}

function ProductPreview() {
  return (
    <div className="relative overflow-hidden rounded-lg border border-black/10 bg-[#111827] p-4 shadow-2xl shadow-black/20">
      <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex gap-2">
          <span className="h-3 w-3 rounded-full bg-[#e55934]" />
          <span className="h-3 w-3 rounded-full bg-[#f7c948]" />
          <span className="h-3 w-3 rounded-full bg-[#46b58a]" />
        </div>
        <span className="text-xs text-white/50">Second Brain desktop</span>
      </div>
      <div className="grid min-h-[330px] gap-4 md:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-3 rounded-md bg-white/5 p-4">
          {["Research", "Invoices", "Meeting notes", "Local archive"].map((label, index) => (
            <div
              className={`h-11 rounded-md ${
                index === 0 ? "bg-[#46b58a]/25" : "bg-white/10"
              }`}
              key={label}
            />
          ))}
        </div>
        <div className="rounded-md bg-[#f6f8fb] p-5">
          <div className="mb-5 h-7 w-2/3 rounded bg-neutral-900/80" />
          <div className="space-y-3">
            <div className="h-4 w-full rounded bg-neutral-300" />
            <div className="h-4 w-11/12 rounded bg-neutral-300" />
            <div className="h-4 w-8/12 rounded bg-neutral-300" />
          </div>
          <div className="mt-8 grid grid-cols-2 gap-3">
            <div className="h-24 rounded-md border border-black/10 bg-white" />
            <div className="h-24 rounded-md border border-black/10 bg-white" />
          </div>
        </div>
      </div>
    </div>
  );
}

function LandingPage() {
  const [release, setRelease] = useState<LatestRelease | null>(null);
  const [releaseError, setReleaseError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void fetchLatestRelease()
      .then((nextRelease) => {
        if (active) {
          setRelease(nextRelease);
        }
      })
      .catch((error) => {
        if (active) {
          setReleaseError(
            error instanceof Error ? error.message : "Unable to load downloads.",
          );
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <AppShell>
      <section className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[0.95fr_1.05fr] lg:py-20">
        <div className="flex flex-col justify-center">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#236f5a]">
            Desktop memory for private work
          </p>
          <h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-[1.02] tracking-normal text-neutral-950 sm:text-7xl">
            Second Brain
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-neutral-600">
            Download the desktop app, create an account, and keep subscription access,
            diagnostics, and production updates in one quiet place.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              className="inline-flex items-center justify-center gap-2 rounded-md bg-[#236f5a] px-5 py-3 font-medium text-white shadow-sm transition hover:bg-[#1d5d4c]"
              href="#download"
            >
              Download app
              <MonitorDown className="h-4 w-4" />
            </a>
            <Link
              className="inline-flex items-center justify-center gap-2 rounded-md border border-black/10 bg-white px-5 py-3 font-medium text-neutral-900 shadow-sm transition hover:border-black/20"
              to="/auth?mode=signup"
            >
              Create account
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-9 grid gap-3 text-sm text-neutral-600 sm:grid-cols-3">
            {["Supabase auth", "Stripe billing", "GitHub downloads"].map((item) => (
              <div className="flex items-center gap-2" key={item}>
                <CheckCircle2 className="h-4 w-4 text-[#236f5a]" />
                {item}
              </div>
            ))}
          </div>
        </div>
        <ProductPreview />
      </section>

      <section className="border-y border-black/10 bg-white" id="download">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 sm:px-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#e55934]">
              Latest production release
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal text-neutral-950">
              Download from GitHub Releases
            </h2>
            <p className="mt-4 leading-7 text-neutral-600">
              The website points to production release assets on GitHub so your laptop
              server stays light and never serves large installers directly.
            </p>
            <p className="mt-4 text-sm text-neutral-500">
              {release
                ? `Current version ${release.version}, published ${formatDate(release.publishedAt)}.`
                : releaseError ?? "Loading release metadata..."}
            </p>
          </div>
          <ReleaseDownload release={release} />
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-5 py-12 sm:px-8 md:grid-cols-3">
        {[
          {
            icon: UserRound,
            title: "1. Create account",
            text: "Use Supabase email and password authentication for web and desktop access.",
          },
          {
            icon: CreditCard,
            title: "2. Subscribe",
            text: "Stripe Checkout applies eligible trials, promotion codes, and subscription access through webhooks.",
          },
          {
            icon: ShieldCheck,
            title: "3. Sign in on desktop",
            text: "The desktop app sends its Supabase session to account, update, and log APIs.",
          },
        ].map(({ icon: Icon, title, text }) => (
          <article className="rounded-md border border-black/10 bg-white p-6 shadow-sm" key={title}>
            <Icon className="h-6 w-6 text-[#236f5a]" />
            <h3 className="mt-5 text-lg font-semibold">{title}</h3>
            <p className="mt-3 leading-7 text-neutral-600">{text}</p>
          </article>
        ))}
      </section>
    </AppShell>
  );
}

function AuthPage() {
  const {
    error,
    isAuthenticated,
    isLoading,
    signIn,
    signUp,
  } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const isDesktopLogin = params.get("desktop") === "1";
  const prefilledEmail = params.get("email") ?? "";
  const requestedMode = params.get("mode") === "signup" ? "signup" : "signin";
  const [email, setEmail] = useState(prefilledEmail);
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">(requestedMode);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setMode(requestedMode);
  }, [requestedMode]);

  useEffect(() => {
    if (prefilledEmail) {
      setEmail(prefilledEmail);
    }
  }, [prefilledEmail]);

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/account", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setNotice(null);
    setIsSubmitting(true);

    try {
      if (mode === "signup") {
        await signUp({ email, password });
        setNotice("Account created. Check your inbox if Supabase email confirmation is enabled.");
      } else {
        await signIn({ email, password });
        navigate("/account", { replace: true });
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
    <AppShell>
      <section className="mx-auto grid min-h-[calc(100vh-73px)] max-w-6xl items-center gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[0.8fr_1fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#236f5a]">
            Account access
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-normal text-neutral-950 sm:text-5xl">
            {isDesktopLogin
              ? "Sign in to connect the desktop app."
              : "One login for the website and desktop app."}
          </h1>
          <p className="mt-5 max-w-xl leading-8 text-neutral-600">
            Your Supabase session is the desktop authentication source. The app uses
            that session for account checks, production updates, and best-effort logs.
          </p>
        </div>

        <div className="rounded-lg border border-black/10 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6 grid grid-cols-2 gap-2 rounded-md bg-neutral-100 p-1">
            <button
              className={`rounded px-4 py-2 text-sm font-medium transition ${
                mode === "signin" ? "bg-white shadow-sm" : "text-neutral-600"
              }`}
              onClick={() => {
                setMode("signin");
              }}
              type="button"
            >
              Sign in
            </button>
            <button
              className={`rounded px-4 py-2 text-sm font-medium transition ${
                mode === "signup" ? "bg-white shadow-sm" : "text-neutral-600"
              }`}
              onClick={() => {
                setMode("signup");
              }}
              type="button"
            >
              Sign up
            </button>
          </div>

          {isDesktopLogin ? (
            <div className="mb-5 rounded-md border border-[#236f5a]/20 bg-[#236f5a]/10 px-4 py-3 text-sm leading-6 text-[#1d5d4c]">
              Use the same email and password here and in Second Brain desktop.
            </div>
          ) : null}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-neutral-700">Email</span>
              <input
                autoComplete="email"
                className="w-full rounded-md border border-black/10 bg-white px-4 py-3 outline-none transition placeholder:text-neutral-400 focus:border-[#236f5a]"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@downloadsecondbrain.com"
                required
                type="email"
                value={email}
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-neutral-700">
                Password
              </span>
              <input
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                className="w-full rounded-md border border-black/10 bg-white px-4 py-3 outline-none transition placeholder:text-neutral-400 focus:border-[#236f5a]"
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                required
                type="password"
                value={password}
              />
            </label>

            {notice ? (
              <div className="rounded-md border border-[#236f5a]/20 bg-[#236f5a]/10 px-4 py-3 text-sm text-[#1d5d4c]">
                {notice}
              </div>
            ) : null}

            {formError || error ? (
              <div className="rounded-md border border-[#e55934]/20 bg-[#e55934]/10 px-4 py-3 text-sm text-[#9f321c]">
                {formError ?? error}
              </div>
            ) : null}

            <button
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#236f5a] px-5 py-3 font-medium text-white shadow-sm transition hover:bg-[#1d5d4c] disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isLoading || isSubmitting}
              type="submit"
            >
              {isSubmitting
                ? "Submitting..."
                : mode === "signup"
                  ? "Create account"
                  : "Sign in"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>
      </section>
    </AppShell>
  );
}

function StatusPill({ label, tone }: { label: string; tone: "green" | "orange" | "neutral" }) {
  const styles = {
    green: "border-[#236f5a]/20 bg-[#236f5a]/10 text-[#1d5d4c]",
    neutral: "border-black/10 bg-neutral-100 text-neutral-700",
    orange: "border-[#e55934]/20 bg-[#e55934]/10 text-[#9f321c]",
  };

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-sm font-medium ${styles[tone]}`}>
      {label}
    </span>
  );
}

function AccountPage() {
  const {
    accessToken,
    error,
    hasAccessBlocked,
    isAuthenticated,
    isLoading,
    isSubscribed,
    isTrialActive,
    refreshSubscription,
    subscription,
    user,
  } = useAuth();
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [subscriptionActionError, setSubscriptionActionError] = useState<string | null>(null);
  const [subscriptionNotice, setSubscriptionNotice] = useState<string | null>(null);
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [isCancelingSubscription, setIsCancelingSubscription] = useState(false);
  const [isResumingSubscription, setIsResumingSubscription] = useState(false);
  const [release, setRelease] = useState<LatestRelease | null>(null);
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const location = useLocation();

  const statusLabel = useMemo(() => {
    if (subscription?.cancel_at_period_end && (isSubscribed || isTrialActive)) {
      return "Cancellation scheduled";
    }

    if (isSubscribed) {
      return "Access active";
    }

    if (isTrialActive) {
      return "Trial active";
    }

    return "No active subscription";
  }, [isSubscribed, isTrialActive, subscription?.cancel_at_period_end]);

  const statusTone = subscription?.cancel_at_period_end
    ? "orange"
    : isSubscribed || isTrialActive
      ? "green"
      : hasAccessBlocked
        ? "orange"
        : "neutral";

  useEffect(() => {
    const stripeKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;

    if (stripeKey) {
      void loadStripe(stripeKey);
    }
  }, []);

  useEffect(() => {
    let active = true;

    void fetchLatestRelease()
      .then((nextRelease) => {
        if (active) {
          setRelease(nextRelease);
        }
      })
      .catch((nextError) => {
        if (active) {
          setReleaseError(
            nextError instanceof Error ? nextError.message : "Unable to load downloads.",
          );
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleStartCheckout() {
    if (!accessToken) {
      setCheckoutError("Sign in again before checkout.");
      return;
    }

    setCheckoutError(null);
    setPortalError(null);
    setSubscriptionActionError(null);
    setSubscriptionNotice(null);
    setIsStartingCheckout(true);

    try {
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload && typeof payload.error === "string"
            ? payload.error
            : "Unable to create checkout session.",
        );
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

  async function handleOpenBillingPortal() {
    if (!accessToken) {
      setPortalError("Sign in again before managing billing.");
      return;
    }

    setCheckoutError(null);
    setPortalError(null);
    setSubscriptionActionError(null);
    setSubscriptionNotice(null);
    setIsOpeningPortal(true);

    try {
      const response = await fetch("/api/create-billing-portal-session", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload && typeof payload.error === "string"
            ? payload.error
            : "Unable to open billing portal.",
        );
      }

      const { url } = checkoutSessionSchema.parse(payload);
      window.location.assign(url);
    } catch (requestError) {
      setPortalError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to open Stripe billing portal.",
      );
    } finally {
      setIsOpeningPortal(false);
    }
  }

  async function postSubscriptionAction(
    path: string,
    fallbackMessage: string,
    successMessage: string,
  ) {
    if (!accessToken) {
      setSubscriptionActionError("Sign in again before changing your subscription.");
      return;
    }

    setCheckoutError(null);
    setPortalError(null);
    setSubscriptionActionError(null);
    setSubscriptionNotice(null);

    const response = await fetch(path, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(
        payload && typeof payload.error === "string"
          ? payload.error
          : fallbackMessage,
      );
    }

    await refreshSubscription();
    setSubscriptionNotice(
      payload && typeof payload.message === "string" ? payload.message : successMessage,
    );
  }

  async function handleCancelSubscription() {
    const shouldCancel = window.confirm(
      "Cancel this subscription? You will keep access until the current Stripe period ends.",
    );

    if (!shouldCancel) {
      return;
    }

    setIsCancelingSubscription(true);

    try {
      await postSubscriptionAction(
        "/api/cancel-subscription",
        "Unable to cancel subscription.",
        "Subscription cancellation is scheduled.",
      );
    } catch (requestError) {
      setSubscriptionActionError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to cancel subscription.",
      );
    } finally {
      setIsCancelingSubscription(false);
    }
  }

  async function handleResumeSubscription() {
    setIsResumingSubscription(true);

    try {
      await postSubscriptionAction(
        "/api/resume-subscription",
        "Unable to resume subscription.",
        "Subscription cancellation has been removed.",
      );
    } catch (requestError) {
      setSubscriptionActionError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to resume subscription.",
      );
    } finally {
      setIsResumingSubscription(false);
    }
  }

  if (isLoading) {
    return (
      <AppShell>
        <section className="mx-auto grid min-h-[calc(100vh-73px)] max-w-4xl place-items-center px-5 sm:px-8">
          <div className="rounded-md border border-black/10 bg-white px-5 py-4 shadow-sm">
            Loading account...
          </div>
        </section>
      </AppShell>
    );
  }

  if (!isAuthenticated) {
    return <Navigate replace to="/auth" />;
  }

  return (
    <AppShell>
      <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        <div className="flex flex-col gap-4 border-b border-black/10 pb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#236f5a]">
              Account
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-normal text-neutral-950">
              {user?.email ?? "Signed in"}
            </h1>
          </div>
          <StatusPill label={statusLabel} tone={statusTone} />
        </div>

        {location.search.includes("checkout=success") ? (
          <div className="mt-6 rounded-md border border-[#236f5a]/20 bg-[#236f5a]/10 px-4 py-3 text-sm text-[#1d5d4c]">
            Checkout completed. Stripe will sync subscription access shortly.
          </div>
        ) : null}

        {location.search.includes("checkout=canceled") ? (
          <div className="mt-6 rounded-md border border-[#e55934]/20 bg-[#e55934]/10 px-4 py-3 text-sm text-[#9f321c]">
            Checkout was canceled before completion.
          </div>
        ) : null}

        {subscriptionNotice ? (
          <div className="mt-6 rounded-md border border-[#236f5a]/20 bg-[#236f5a]/10 px-4 py-3 text-sm text-[#1d5d4c]">
            {subscriptionNotice}
          </div>
        ) : null}

        {checkoutError || portalError || subscriptionActionError || error ? (
          <div className="mt-6 rounded-md border border-[#e55934]/20 bg-[#e55934]/10 px-4 py-3 text-sm text-[#9f321c]">
            {checkoutError ?? portalError ?? subscriptionActionError ?? error}
          </div>
        ) : null}

        <div className="mt-8 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-lg border border-black/10 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Subscription</h2>
                <p className="mt-2 text-sm leading-6 text-neutral-600">
                  Stripe manages billing, cancellation, promotion codes, and invoices.
                  Supabase stores access state for the website and desktop app.
                </p>
              </div>
              <CreditCard className="h-6 w-6 text-[#236f5a]" />
            </div>
            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-md bg-neutral-100 p-4">
                <dt className="text-sm text-neutral-500">Status</dt>
                <dd className="mt-1 font-medium">{subscription?.status ?? "none"}</dd>
              </div>
              <div className="rounded-md bg-neutral-100 p-4">
                <dt className="text-sm text-neutral-500">Plan</dt>
                <dd className="mt-1 font-medium">{subscription?.plan_name ?? "Second Brain Pro"}</dd>
              </div>
              <div className="rounded-md bg-neutral-100 p-4">
                <dt className="text-sm text-neutral-500">Trial ends</dt>
                <dd className="mt-1 font-medium">{formatDate(subscription?.trial_end)}</dd>
              </div>
              <div className="rounded-md bg-neutral-100 p-4">
                <dt className="text-sm text-neutral-500">
                  {subscription?.cancel_at_period_end ? "Access ends" : "Renews"}
                </dt>
                <dd className="mt-1 font-medium">{formatDate(subscription?.subscription_renews_at)}</dd>
              </div>
              <div className="rounded-md bg-neutral-100 p-4 sm:col-span-2">
                <dt className="text-sm text-neutral-500">Managed requests</dt>
                <dd className="mt-1 font-medium">
                  {subscription
                    ? `${subscription.usage_requests} / ${subscription.usage_request_limit}`
                    : "0 / 1000"}
                </dd>
              </div>
            </dl>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button
                className="inline-flex items-center justify-center gap-2 rounded-md bg-[#236f5a] px-5 py-3 font-medium text-white shadow-sm transition hover:bg-[#1d5d4c] disabled:cursor-not-allowed disabled:opacity-70"
                disabled={isStartingCheckout || isOpeningPortal || isCancelingSubscription || isResumingSubscription}
                onClick={() => {
                  void handleStartCheckout();
                }}
                type="button"
              >
                <CreditCard className="h-4 w-4" />
                {isStartingCheckout ? "Redirecting..." : "Start subscription"}
              </button>
              <button
                className="inline-flex items-center justify-center gap-2 rounded-md border border-black/10 bg-white px-5 py-3 font-medium text-neutral-900 shadow-sm transition hover:border-black/20 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={isStartingCheckout || isOpeningPortal || isCancelingSubscription || isResumingSubscription || !subscription?.stripe_customer_id}
                onClick={() => {
                  void handleOpenBillingPortal();
                }}
                type="button"
              >
                <ExternalLink className="h-4 w-4" />
                {isOpeningPortal ? "Opening..." : "Manage billing"}
              </button>
              {subscription?.stripe_subscription_id && subscription.status !== "canceled" ? (
                subscription.cancel_at_period_end ? (
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-[#236f5a]/30 bg-white px-5 py-3 font-medium text-[#1d5d4c] shadow-sm transition hover:border-[#236f5a]/60 disabled:cursor-not-allowed disabled:opacity-70"
                    disabled={isStartingCheckout || isOpeningPortal || isCancelingSubscription || isResumingSubscription}
                    onClick={() => {
                      void handleResumeSubscription();
                    }}
                    type="button"
                  >
                    <RotateCcw className="h-4 w-4" />
                    {isResumingSubscription ? "Resuming..." : "Resume subscription"}
                  </button>
                ) : (
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-[#e55934]/30 bg-white px-5 py-3 font-medium text-[#9f321c] shadow-sm transition hover:border-[#e55934]/60 disabled:cursor-not-allowed disabled:opacity-70"
                    disabled={isStartingCheckout || isOpeningPortal || isCancelingSubscription || isResumingSubscription}
                    onClick={() => {
                      void handleCancelSubscription();
                    }}
                    type="button"
                  >
                    <XCircle className="h-4 w-4" />
                    {isCancelingSubscription ? "Canceling..." : "Cancel subscription"}
                  </button>
                )
              ) : null}
            </div>
          </section>

          <section className="rounded-lg border border-black/10 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Desktop authentication</h2>
                <p className="mt-2 text-sm leading-6 text-neutral-600">
                  Sign in inside the desktop app with this same email and password.
                  Desktop API calls use the Supabase session bearer token.
                </p>
              </div>
              <KeyRound className="h-6 w-6 text-[#236f5a]" />
            </div>
            <div className="mt-6 rounded-md bg-[#111827] p-4 font-mono text-sm text-white">
              <div>GET /api/desktop/account</div>
              <div className="mt-2 text-white/60">Authorization: Bearer &lt;supabase_access_token&gt;</div>
            </div>
            <p className="mt-4 text-sm leading-6 text-neutral-600">
              Logs go to <span className="font-mono">POST /api/desktop/logs</span> in small
              redacted batches and are best-effort only.
            </p>
          </section>
        </div>

        <section className="mt-5 rounded-lg border border-black/10 bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Downloads and updates</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-600">
                Installers redirect to GitHub assets. Update checks compare against the
                latest production tag.
              </p>
            </div>
            {release?.htmlUrl ? (
              <a
                className="inline-flex items-center gap-2 text-sm font-medium text-[#236f5a]"
                href={release.htmlUrl}
                rel="noreferrer"
                target="_blank"
              >
                View release
                <ExternalLink className="h-4 w-4" />
              </a>
            ) : null}
          </div>
          {releaseError ? (
            <div className="rounded-md border border-[#e55934]/20 bg-[#e55934]/10 px-4 py-3 text-sm text-[#9f321c]">
              {releaseError}
            </div>
          ) : (
            <ReleaseDownload release={release} />
          )}
        </section>
      </section>
    </AppShell>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/account" element={<AccountPage />} />
      <Route path="/login" element={<AuthPage />} />
      <Route path="/checkout" element={<Navigate replace to="/account" />} />
      <Route path="*" element={<Navigate replace to="/" />} />
    </Routes>
  );
}
