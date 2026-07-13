import { loadStripe } from "@stripe/stripe-js";
import {
  Apple,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Download,
  ExternalLink,
  LogOut,
  Menu,
  Monitor,
  MonitorDown,
  RotateCcw,
  ShieldCheck,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type FormEvent,
  type ReactNode,
} from "react";
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

const desktopAccountSchema = z.object({
  email: z.string().nullable(),
  planName: z.string(),
  status: z.string(),
  subscriptionRenewsAt: z.string().nullable().optional(),
  trialEndsAt: z.string().nullable().optional(),
  usage: z.object({
    label: z.string(),
    limit: z.number(),
    resetAt: z.string(),
    updatedAt: z.string().nullable().optional(),
    used: z.number(),
  }),
  userId: z.string(),
});

type LatestRelease = z.infer<typeof releaseSchema>["release"];
type DesktopAccount = z.infer<typeof desktopAccountSchema>;
type DownloadPlatform = "macos" | "windows";
type Tone = "accent" | "danger" | "neutral" | "warning";
type ButtonVariant = "primary" | "secondary";

const containerClass = "mx-auto max-w-[1080px] px-5 sm:px-10";
const cardClass =
  "rounded-[14px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-[var(--shadow-card)]";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

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

function useLatestRelease() {
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

  return { release, releaseError };
}

async function fetchDesktopAccount(accessToken: string) {
  const response = await fetch("/api/desktop/account", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(
      payload && typeof payload.error === "string"
        ? payload.error
        : "Unable to load account usage.",
    );
  }

  return desktopAccountSchema.parse(payload);
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

function detectPlatform(): DownloadPlatform | null {
  if (typeof navigator === "undefined") {
    return null;
  }

  const fingerprint = `${navigator.platform || ""} ${navigator.userAgent || ""}`.toLowerCase();

  if (fingerprint.includes("mac")) {
    return "macos";
  }

  if (fingerprint.includes("win")) {
    return "windows";
  }

  return null;
}

function getAssetForPlatform(release: LatestRelease | null, platform: DownloadPlatform | null) {
  if (!release || !platform) {
    return null;
  }

  return release.assets[platform];
}

function friendlyAuthError(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const lower = value.toLowerCase();

  if (lower.includes("invalid") || lower.includes("credentials")) {
    return "That email or password did not match. Try again.";
  }

  if (lower.includes("already") && (lower.includes("registered") || lower.includes("exists"))) {
    return "An account already exists for that email. Sign in instead.";
  }

  if (lower.includes("email") && lower.includes("confirm")) {
    return "Check your inbox to confirm your email, then sign in.";
  }

  if (lower.includes("password") && (lower.includes("characters") || lower.includes("least"))) {
    return "Use a password with at least 8 characters.";
  }

  if (lower.includes("supabase") || lower.includes("environment")) {
    return "Account services are not configured yet.";
  }

  return "Something went wrong. Try again.";
}

function buttonClasses(variant: ButtonVariant) {
  return cx(
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
    variant === "primary" &&
      "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]",
    variant === "secondary" &&
      "border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:border-[var(--text-primary)]",
  );
}

function Button({
  children,
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
}) {
  return (
    <button className={cx(buttonClasses(variant), className)} {...props}>
      {children}
    </button>
  );
}

function ButtonLink({
  children,
  className,
  variant = "primary",
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: ButtonVariant;
}) {
  return (
    <a className={cx(buttonClasses(variant), className)} {...props}>
      {children}
    </a>
  );
}

function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={cx(cardClass, "p-5 sm:p-6", className)}>{children}</section>;
}

function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  const styles = {
    accent: "border-transparent bg-[var(--accent-tint)] text-[var(--accent-text-on-tint)]",
    danger: "border-[var(--danger-border)] bg-[var(--danger-tint)] text-[var(--danger)]",
    neutral: "border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)]",
    warning: "border-[var(--warning-border)] bg-[var(--warning-tint)] text-[var(--warning)]",
  };

  return (
    <span className={cx("inline-flex rounded-full border px-3 py-1 text-[13px] leading-none", styles[tone])}>
      {children}
    </span>
  );
}

function InlineMessage({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  const styles = {
    accent: "border-[var(--accent-tint)] bg-[var(--accent-tint)] text-[var(--accent-text-on-tint)]",
    danger: "border-[var(--danger-border)] bg-[var(--danger-tint)] text-[var(--danger)]",
    neutral: "border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)]",
    warning: "border-[var(--warning-border)] bg-[var(--warning-tint)] text-[var(--warning)]",
  };

  return (
    <div className={cx("rounded-lg border px-4 py-3 text-sm leading-6", styles[tone])}>
      {children}
    </div>
  );
}

function DataRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-[var(--border-subtle)] py-3 first:border-t-0">
      <dt className="text-sm text-[var(--text-secondary)]">{label}</dt>
      <dd className="text-right text-sm font-medium text-[var(--text-primary)]">{value}</dd>
    </div>
  );
}

function PriceCard({
  amount,
  current = false,
  features,
  name,
}: {
  amount: string;
  current?: boolean;
  features: string[];
  name: string;
}) {
  return (
    <article
      className={cx(
        "rounded-[14px] border bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-card)]",
        current ? "border-[var(--accent)]" : "border-[var(--border-subtle)]",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{name}</h3>
          <p className="mt-2 font-display text-[28px] leading-tight text-[var(--text-primary)]">
            {amount}
          </p>
        </div>
        {current ? <Pill tone="accent">Current</Pill> : null}
      </div>
      <ul className="mt-5 space-y-2 text-sm leading-6 text-[var(--text-secondary)]">
        {features.map((feature) => (
          <li className="flex gap-2" key={feature}>
            <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[var(--accent)]" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function SessionRow({
  action,
  deviceName,
  meta,
  status,
}: {
  action?: ReactNode;
  deviceName: string;
  meta: string;
  status: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-[var(--border-subtle)] py-3 first:border-t-0">
      <div>
        <p className="text-sm font-medium text-[var(--text-primary)]">{deviceName}</p>
        <p className="mt-1 text-[13px] text-[var(--text-muted)]">{meta}</p>
      </div>
      <div className="flex items-center gap-3">
        {status}
        {action}
      </div>
    </div>
  );
}

function NavBar() {
  const { isAuthenticated, signOut, user } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navLinks = [
    { href: "/#product", label: "Product" },
    { href: "/#download", label: "Download" },
    { href: "/#pricing", label: "Pricing" },
  ];

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--border-subtle)] bg-[var(--bg-page)]/90 backdrop-blur">
      <div className={cx(containerClass, "flex items-center justify-between gap-5 py-4")}>
        <Link
          className="flex items-center gap-3 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"
          to="/"
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] font-display text-[15px] text-[var(--text-primary)] shadow-[var(--shadow-card)]">
            Sb
          </span>
          <span className="font-display text-[17px] text-[var(--text-primary)]">Second Brain</span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-medium text-[var(--text-nav)] sm:flex">
          {navLinks.map((link) => (
            <a className="transition hover:text-[var(--text-primary)]" href={link.href} key={link.href}>
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 sm:flex">
          <Link
            className={cx(buttonClasses("secondary"), "min-h-10 px-3")}
            to={isAuthenticated ? "/account" : "/auth"}
          >
            {isAuthenticated ? "Account" : "Sign in"}
          </Link>
          {isAuthenticated ? (
            <Button
              className="min-h-10 px-3"
              onClick={() => {
                void signOut();
              }}
              type="button"
              variant="secondary"
            >
              <LogOut className="h-4 w-4" />
              {user?.email ?? "Sign out"}
            </Button>
          ) : (
            <Link className={cx(buttonClasses("primary"), "min-h-10 px-3")} to="/auth?mode=signup">
              Create account
            </Link>
          )}
        </div>

        <button
          aria-label={isMenuOpen ? "Close navigation" : "Open navigation"}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-primary)] sm:hidden"
          onClick={() => setIsMenuOpen((value) => !value)}
          type="button"
        >
          {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {isMenuOpen ? (
        <div className={cx(containerClass, "pb-4 sm:hidden")}>
          <div className={cx(cardClass, "space-y-2 p-3")}>
            {navLinks.map((link) => (
              <a
                className="block rounded-lg px-3 py-2 text-sm font-medium text-[var(--text-nav)] hover:bg-[var(--accent-tint)] hover:text-[var(--accent-text-on-tint)]"
                href={link.href}
                key={link.href}
                onClick={() => setIsMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <Link
              className="block rounded-lg px-3 py-2 text-sm font-medium text-[var(--text-nav)] hover:bg-[var(--accent-tint)] hover:text-[var(--accent-text-on-tint)]"
              onClick={() => setIsMenuOpen(false)}
              to={isAuthenticated ? "/account" : "/auth"}
            >
              {isAuthenticated ? "Account" : "Sign in"}
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)]">
      <NavBar />
      <main>{children}</main>
    </div>
  );
}

function DownloadCard({
  asset,
  icon,
  platform,
  release,
}: {
  asset: LatestRelease["assets"]["macos"];
  icon: ReactNode;
  platform: string;
  release: LatestRelease | null;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-page)] text-[var(--text-primary)]">
            {icon}
          </span>
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">{platform}</h3>
            <p className="mt-1 text-[13px] text-[var(--text-muted)]">
              {release ? `Version ${release.version}` : "Loading release"}
            </p>
          </div>
        </div>
        <Download className="h-5 w-5 text-[var(--accent)]" />
      </div>
      <p className="mt-5 min-h-10 text-sm leading-6 text-[var(--text-secondary)]">
        {asset ? `${asset.name} ${formatBytes(asset.size)}` : "No production asset is available yet."}
      </p>
      <div className="mt-5">
        <span className={cx(buttonClasses(asset ? "primary" : "secondary"), "w-full")}>
          {asset ? "Download" : "Coming soon"}
        </span>
      </div>
    </>
  );

  if (!asset) {
    return <div className={cx(cardClass, "p-5 opacity-70")}>{content}</div>;
  }

  return (
    <a
      className={cx(cardClass, "block p-5 transition hover:border-[var(--border-default)]")}
      href={asset.url}
    >
      {content}
    </a>
  );
}

function ReleaseDownload({ release }: { release: LatestRelease | null }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <DownloadCard
        asset={release?.assets.macos ?? null}
        icon={<Apple className="h-5 w-5" />}
        platform="macOS Apple Silicon"
        release={release}
      />
      <DownloadCard
        asset={release?.assets.windows ?? null}
        icon={<Monitor className="h-5 w-5" />}
        platform="Windows"
        release={release}
      />
    </div>
  );
}

function ProductPreview() {
  return (
    <Card className="p-0">
      <div className="border-b border-[var(--border-subtle)] px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-medium text-[var(--text-primary)]">Second Brain desktop</p>
          <Pill tone="neutral">Private workspace</Pill>
        </div>
      </div>
      <div className="grid gap-0 md:grid-cols-[0.92fr_1.08fr]">
        <div className="border-b border-[var(--border-subtle)] p-5 md:border-b-0 md:border-r">
          <div className="space-y-3">
            {["Research", "Invoices", "Meeting notes", "Local archive"].map((label, index) => (
              <div
                className={cx(
                  "rounded-xl border px-4 py-3 text-sm",
                  index === 0
                    ? "border-[var(--accent)] bg-[var(--accent-tint)] text-[var(--accent-text-on-tint)]"
                    : "border-[var(--border-subtle)] bg-[var(--bg-page)] text-[var(--text-secondary)]",
                )}
                key={label}
              >
                {label}
              </div>
            ))}
          </div>
        </div>
        <div className="p-5">
          <p className="font-display text-[28px] leading-tight text-[var(--text-primary)]">
            Find the note, file, or answer without breaking flow.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {["Local context", "Account access", "Release updates", "Redacted logs"].map((label) => (
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] p-4" key={label}>
                <CheckCircle2 className="h-4 w-4 text-[var(--accent)]" />
                <p className="mt-3 text-sm font-medium text-[var(--text-primary)]">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function LandingPage() {
  const { release, releaseError } = useLatestRelease();
  const [detectedPlatform, setDetectedPlatform] = useState<DownloadPlatform | null>(null);

  useEffect(() => {
    setDetectedPlatform(detectPlatform());
  }, []);

  const primaryAsset =
    getAssetForPlatform(release, detectedPlatform) ??
    release?.assets.macos ??
    release?.assets.windows ??
    null;
  const primaryDownloadLabel =
    detectedPlatform === "windows"
      ? "Download for Windows"
      : detectedPlatform === "macos"
        ? "Download for Mac"
        : "Download";

  return (
    <AppShell>
      <section className={cx(containerClass, "grid gap-10 py-14 md:grid-cols-[1.1fr_0.9fr] md:py-20")}>
        <div className="flex flex-col justify-center">
          <Pill tone="accent">
            {release ? `Now on version ${release.version}` : "Latest production release"}
          </Pill>
          <h1 className="mt-6 max-w-3xl font-display text-[44px] font-medium leading-[1.08] text-[var(--text-primary)] max-sm:text-[28px]">
            A quiet place for <em className="text-[var(--accent)]">your private work</em>.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-[var(--text-secondary)]">
            Download the desktop app, sign in with your account, and keep Free or
            Pro access, production updates, and support diagnostics in one calm workspace.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={primaryAsset?.url ?? "#download"}>
              <MonitorDown className="h-4 w-4" />
              {primaryDownloadLabel}
            </ButtonLink>
            <ButtonLink href="#download" variant="secondary">
              See other platforms
            </ButtonLink>
          </div>
          <p className="mt-4 text-[13px] leading-6 text-[var(--text-muted)]">
            macOS Apple Silicon and Windows installers are served from GitHub Releases.
          </p>
        </div>
        <ProductPreview />
      </section>

      <section className={cx(containerClass, "py-14")} id="product">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: UserRound,
              title: "Create your account",
              text: "Use Supabase email and password authentication for website and desktop access.",
            },
            {
              icon: CreditCard,
              title: "Upgrade when you need more",
              text: "Free accounts get daily managed requests. Pro raises the limit through Stripe subscription billing.",
            },
            {
              icon: ShieldCheck,
              title: "Sign in on desktop",
              text: "The app sends its Supabase session to account, update, proxy, and log APIs.",
            },
          ].map(({ icon: Icon, title, text }) => (
            <Card className="transition hover:border-[var(--border-default)]" key={title}>
              <Icon className="h-5 w-5 text-[var(--accent)]" />
              <h3 className="mt-5 text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{text}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className={cx(containerClass, "py-14")} id="pricing">
        <div className="grid gap-8 md:grid-cols-[0.85fr_1.15fr] md:items-start">
          <div>
            <h2 className="font-display text-[28px] font-medium leading-tight text-[var(--text-primary)]">
              Simple billing, hosted by <em className="text-[var(--accent)]">Stripe</em>.
            </h2>
            <p className="mt-4 text-sm leading-7 text-[var(--text-secondary)]">
              Signed-in accounts start on Free. Upgrade to Pro from the account page
              when you need a higher daily request limit.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <PriceCard
              amount="Free"
              current
              features={[
                "Supabase account required",
                "250 managed requests per day",
                "GitHub-hosted production updates",
              ]}
              name="Second Brain Free"
            />
            <PriceCard
              amount="$10/mo"
              features={[
                "1000 managed requests per day",
                "Stripe billing portal",
                "Free fallback if canceled",
              ]}
              name="Second Brain Pro"
            />
          </div>
        </div>
      </section>

      <section className="border-y border-[var(--border-subtle)] bg-[var(--bg-surface)]" id="download">
        <div className={cx(containerClass, "grid gap-8 py-14 md:grid-cols-[0.82fr_1.18fr]")}>
          <div>
            <Pill tone="neutral">Downloads</Pill>
            <h2 className="mt-5 font-display text-[28px] font-medium leading-tight text-[var(--text-primary)]">
              Latest production installers
            </h2>
            <p className="mt-4 text-sm leading-7 text-[var(--text-secondary)]">
              The laptop server resolves release metadata and redirects downloads to
              GitHub assets, keeping hosting lightweight.
            </p>
            <p className="mt-4 text-[13px] leading-6 text-[var(--text-muted)]">
              {release
                ? `Current version ${release.version}, published ${formatDate(release.publishedAt)}.`
                : releaseError ?? "Loading release metadata."}
            </p>
          </div>
          <div>
            {releaseError ? <InlineMessage tone="danger">{releaseError}</InlineMessage> : null}
            <ReleaseDownload release={release} />
          </div>
        </div>
      </section>

      <section className={cx(containerClass, "py-14")}>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Install on macOS</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
              Download the DMG, open it, and move Second Brain into Applications.
              Sign in with the same email and password you use on this website.
            </p>
          </Card>
          <Card>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Install on Windows</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
              Download the installer, run setup, and sign in when the account screen
              opens. Updates are checked against the latest production tag.
            </p>
          </Card>
        </div>
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
        setNotice("Account created. Check your inbox if email confirmation is enabled.");
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
      <section className={cx(containerClass, "grid min-h-[calc(100vh-73px)] place-items-center py-14")}>
        <div className="w-full max-w-[420px]">
          <div className="mb-8 text-center">
            <Pill tone={isDesktopLogin ? "accent" : "neutral"}>
              {isDesktopLogin ? "Desktop connection" : "Account access"}
            </Pill>
            <h1 className="mt-5 font-display text-[32px] font-medium leading-tight text-[var(--text-primary)]">
              {isDesktopLogin ? "Sign in to connect Second Brain." : "Sign in to your workspace."}
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
              Use the same email and password on the website and desktop app.
            </p>
          </div>

          <Card>
            <div className="mb-6 grid grid-cols-2 gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-page)] p-1">
              {(["signin", "signup"] as const).map((nextMode) => (
                <button
                  className={cx(
                    "rounded-md px-4 py-2 text-sm font-medium transition",
                    mode === nextMode
                      ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-[var(--shadow-card)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                  )}
                  key={nextMode}
                  onClick={() => {
                    setMode(nextMode);
                    setFormError(null);
                    setNotice(null);
                  }}
                  type="button"
                >
                  {nextMode === "signin" ? "Sign in" : "Sign up"}
                </button>
              ))}
            </div>

            {isDesktopLogin ? (
              <div className="mb-5">
                <InlineMessage tone="accent">
                  Sign in here, then return to the desktop app and use the same account.
                </InlineMessage>
              </div>
            ) : null}

            <form className="space-y-5" onSubmit={handleSubmit}>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[var(--text-primary)]">Email</span>
                <input
                  autoComplete="email"
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3 text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@downloadsecondbrain.com"
                  required
                  type="email"
                  value={email}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[var(--text-primary)]">Password</span>
                <input
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3 text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]"
                  minLength={8}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  required
                  type="password"
                  value={password}
                />
              </label>

              {notice ? <InlineMessage tone="accent">{notice}</InlineMessage> : null}

              {friendlyAuthError(formError ?? error) ? (
                <InlineMessage tone="danger">{friendlyAuthError(formError ?? error)}</InlineMessage>
              ) : null}

              <Button className="w-full" disabled={isLoading || isSubmitting} type="submit">
                {isSubmitting
                  ? "Working"
                  : mode === "signup"
                    ? "Create account"
                    : "Sign in"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          </Card>
        </div>
      </section>
    </AppShell>
  );
}

function AccountPage() {
  const {
    accessToken,
    error,
    isAuthenticated,
    isLoading,
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
  const [account, setAccount] = useState<DesktopAccount | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [isAccountLoading, setIsAccountLoading] = useState(false);
  const { release, releaseError } = useLatestRelease();
  const location = useLocation();

  const isPro = account?.planName === "Second Brain Pro";
  const displayPlanName = account?.planName ?? "Second Brain Free";
  const statusLabel = useMemo(() => {
    if (subscription?.cancel_at_period_end && isPro) {
      return "Cancellation scheduled";
    }

    return displayPlanName;
  }, [displayPlanName, isPro, subscription?.cancel_at_period_end]);

  const statusTone: Tone = subscription?.cancel_at_period_end
    ? "warning"
    : isPro
      ? "accent"
      : "neutral";
  const usageRequests = Number(account?.usage.used ?? 0);
  const usageLimit = Number(account?.usage.limit ?? 250);
  const usageResetAt = account?.usage.resetAt ?? null;
  const usageUpdatedAt = account?.usage.updatedAt ?? null;
  const billingStatus = subscription?.stripe_subscription_id
    ? subscription.status || "Unknown"
    : "Free";

  async function refreshAccountState() {
    if (!accessToken) {
      setAccount(null);
      return;
    }

    setIsAccountLoading(true);
    setAccountError(null);

    try {
      const nextAccount = await fetchDesktopAccount(accessToken);
      setAccount(nextAccount);
    } catch (requestError) {
      setAccountError(
        requestError instanceof Error ? requestError.message : "Unable to load account usage.",
      );
    } finally {
      setIsAccountLoading(false);
    }
  }

  useEffect(() => {
    void refreshAccountState();
  }, [accessToken]);

  useEffect(() => {
    const stripeKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;

    if (stripeKey) {
      void loadStripe(stripeKey);
    }
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
    await refreshAccountState();
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
        <section className={cx(containerClass, "grid min-h-[calc(100vh-73px)] place-items-center py-14")}>
          <Card>Loading account.</Card>
        </section>
      </AppShell>
    );
  }

  if (!isAuthenticated) {
    return <Navigate replace to="/auth" />;
  }

  return (
    <AppShell>
      <section className={cx(containerClass, "py-10 sm:py-14")}>
        <div className="flex flex-col gap-4 border-b border-[var(--border-subtle)] pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Pill tone={statusTone}>{statusLabel}</Pill>
            <h1 className="mt-4 font-display text-[36px] font-medium leading-tight text-[var(--text-primary)] max-sm:text-[28px]">
              Your account
            </h1>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">{user?.email ?? "Signed in"}</p>
        </div>

        <div className="mt-6 space-y-3">
          {location.search.includes("checkout=success") ? (
            <InlineMessage tone="accent">
              Checkout completed. Stripe will sync subscription access shortly.
            </InlineMessage>
          ) : null}

          {location.search.includes("checkout=canceled") ? (
            <InlineMessage tone="warning">Checkout was canceled before completion.</InlineMessage>
          ) : null}

          {subscriptionNotice ? <InlineMessage tone="accent">{subscriptionNotice}</InlineMessage> : null}

          {checkoutError || portalError || subscriptionActionError || accountError || error ? (
            <InlineMessage tone="danger">
              {checkoutError ??
                portalError ??
                subscriptionActionError ??
                accountError ??
                friendlyAuthError(error) ??
                "Something went wrong. Try again."}
            </InlineMessage>
          ) : null}
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-[28px] font-medium leading-tight text-[var(--text-primary)]">
                  Your account
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                  Account access is shared by the website and desktop app.
                </p>
              </div>
              <UserRound className="h-5 w-5 text-[var(--accent)]" />
            </div>

            <dl className="mt-6">
              <DataRow label="Email" value={user?.email ?? "Not available"} />
              <DataRow label="Plan" value={displayPlanName} />
              <DataRow label="Status" value={<Pill tone={statusTone}>{statusLabel}</Pill>} />
              <DataRow label="Billing status" value={billingStatus} />
              <DataRow
                label={subscription?.cancel_at_period_end ? "Access ends" : "Renews"}
                value={isPro ? formatDate(subscription?.subscription_renews_at) : "No paid renewal"}
              />
              <DataRow label="Usage" value={`${usageRequests} / ${usageLimit} daily requests`} />
              <DataRow label="Resets" value={formatDate(usageResetAt)} />
              <DataRow
                label="Last metered"
                value={usageUpdatedAt ? formatDate(usageUpdatedAt) : isAccountLoading ? "Loading" : "Not used today"}
              />
            </dl>

            <div className="mt-7 border-t border-[var(--border-subtle)] pt-5">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Your sessions</h3>
              <div className="mt-3">
                <SessionRow
                  deviceName="This browser"
                  meta="Current website session"
                  status={<Pill tone="accent">Active</Pill>}
                />
                <div className="border-t border-[var(--border-subtle)] py-3 text-sm text-[var(--text-muted)]">
                  No other devices signed in.
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-[28px] font-medium leading-tight text-[var(--text-primary)]">
                  Plan
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                  Stripe manages billing, invoices, cancellation, and payment methods.
                </p>
              </div>
              <CreditCard className="h-5 w-5 text-[var(--accent)]" />
            </div>

            <div className="mt-6 grid gap-4">
              <PriceCard
                amount={statusLabel}
                current
                features={[
                  `${usageLimit} daily requests`,
                  "Production update checks",
                  `${usageLimit} request limit today`,
                ]}
                name={displayPlanName}
              />
              <PriceCard
                amount="Hosted"
                features={[
                  "Stripe billing portal",
                  "Redacted diagnostics",
                  "GitHub release downloads",
                ]}
                name="Support surface"
              />
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <Button
                disabled={isPro || isStartingCheckout || isOpeningPortal || isCancelingSubscription || isResumingSubscription}
                onClick={() => {
                  void handleStartCheckout();
                }}
                type="button"
              >
                <CreditCard className="h-4 w-4" />
                {isStartingCheckout ? "Redirecting" : isPro ? "Pro active" : "Upgrade to Pro"}
              </Button>
              <Button
                disabled={
                  isStartingCheckout ||
                  isOpeningPortal ||
                  isCancelingSubscription ||
                  isResumingSubscription ||
                  !subscription?.stripe_customer_id
                }
                onClick={() => {
                  void handleOpenBillingPortal();
                }}
                type="button"
                variant="secondary"
              >
                <ExternalLink className="h-4 w-4" />
                {isOpeningPortal ? "Opening" : "Manage billing"}
              </Button>
              {subscription?.stripe_subscription_id && subscription.status !== "canceled" ? (
                subscription.cancel_at_period_end ? (
                  <Button
                    className="border-[var(--accent)] text-[var(--accent-text-on-tint)] hover:border-[var(--accent-hover)]"
                    disabled={isStartingCheckout || isOpeningPortal || isCancelingSubscription || isResumingSubscription}
                    onClick={() => {
                      void handleResumeSubscription();
                    }}
                    type="button"
                    variant="secondary"
                  >
                    <RotateCcw className="h-4 w-4" />
                    {isResumingSubscription ? "Resuming" : "Resume subscription"}
                  </Button>
                ) : (
                  <Button
                    className="border-[var(--danger-border)] text-[var(--danger)] hover:border-[var(--danger)]"
                    disabled={isStartingCheckout || isOpeningPortal || isCancelingSubscription || isResumingSubscription}
                    onClick={() => {
                      void handleCancelSubscription();
                    }}
                    type="button"
                    variant="secondary"
                  >
                    <XCircle className="h-4 w-4" />
                    {isCancelingSubscription ? "Canceling" : "Cancel subscription"}
                  </Button>
                )
              ) : null}
            </div>
          </Card>
        </div>

        <section className="mt-5">
          <Card>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-display text-[28px] font-medium leading-tight text-[var(--text-primary)]">
                  Downloads and updates
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                  Installers redirect to GitHub assets. Update checks compare against
                  the latest production tag.
                </p>
              </div>
              {release?.htmlUrl ? (
                <ButtonLink href={release.htmlUrl} rel="noreferrer" target="_blank" variant="secondary">
                  View release
                  <ExternalLink className="h-4 w-4" />
                </ButtonLink>
              ) : null}
            </div>
            {releaseError ? <InlineMessage tone="danger">{releaseError}</InlineMessage> : <ReleaseDownload release={release} />}
          </Card>
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
