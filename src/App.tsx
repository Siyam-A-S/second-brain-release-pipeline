import { loadStripe } from "@stripe/stripe-js";
import {
  Apple,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
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
  useRef,
  useState,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type DragEvent,
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
type DemoFileKind = "pdf" | "xlsx" | "docx" | "md" | "image";
type DemoState = "idle" | "dragging" | "building" | "ready" | "limit_reached" | "unsupported";

type DemoFile = {
  id: string;
  kind: DemoFileKind;
  label: string;
  accent: string;
};

type DemoNode = {
  id: string;
  label: string;
  type: "source" | "concept" | "entity" | "question" | "insight";
  community: number;
  degree: number;
};

type DemoLink = {
  source: string;
  target: string;
  relation: string;
  weight: number;
};

type DemoGraph = {
  file: DemoFile;
  links: DemoLink[];
  nodes: DemoNode[];
};

type PositionedDemoNode = DemoNode & {
  x: number;
  y: number;
};

type PositionedDemoGraph = DemoGraph & {
  nodes: PositionedDemoNode[];
};

const containerClass = "mx-auto max-w-[1080px] px-5 sm:px-10";
const cardClass =
  "rounded-[14px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-[var(--shadow-card)]";
const MAX_DEMO_DROPS_PER_SESSION = 8;
const BUILD_ANIMATION_MS = 900;
const GRAPH_SETTLE_MS = 1800;

const demoFiles: DemoFile[] = [
  { id: "research-pdf", kind: "pdf", label: "Research.pdf", accent: "#BE3A4A" },
  { id: "budget-xlsx", kind: "xlsx", label: "Budget.xlsx", accent: "#2E7D4F" },
  { id: "proposal-docx", kind: "docx", label: "Proposal.docx", accent: "#2869B8" },
  { id: "notes-md", kind: "md", label: "Notes.md", accent: "#596170" },
  { id: "whiteboard-image", kind: "image", label: "Whiteboard.png", accent: "#7A4BC2" },
];

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

function getFileIcon(kind: DemoFileKind) {
  if (kind === "xlsx") {
    return FileSpreadsheet;
  }

  if (kind === "image") {
    return ImageIcon;
  }

  return FileText;
}

function getDemoLabels(kind: DemoFileKind) {
  const labelsByKind: Record<DemoFileKind, string[]> = {
    docx: [
      "Source",
      "Goal",
      "Timeline",
      "Stakeholder",
      "Constraint",
      "Milestone",
      "Decision",
      "Scope",
      "Risk",
      "Review",
      "Next Step",
      "Owner",
      "Launch",
    ],
    image: [
      "Source",
      "Diagram",
      "Component",
      "Flow",
      "Question",
      "Pattern",
      "Next Step",
      "Boundary",
      "Signal",
    ],
    md: [
      "Source",
      "Idea",
      "Todo",
      "Reference",
      "Topic",
      "Follow-up",
      "Insight",
      "Note",
      "Link",
      "Draft",
    ],
    pdf: [
      "Source",
      "Methods",
      "Dataset",
      "Claim",
      "Result",
      "Citation",
      "Open Question",
      "Summary",
      "Evidence",
      "Figure",
      "Author",
      "Finding",
      "Limit",
      "Thread",
    ],
    xlsx: [
      "Source",
      "Revenue",
      "Costs",
      "Forecast",
      "Risk",
      "Vendor",
      "Quarter",
      "Runway",
      "Delta",
      "Target",
      "Margin",
      "Scenario",
    ],
  };

  return labelsByKind[kind];
}

function getNodeType(index: number): DemoNode["type"] {
  if (index === 0) {
    return "source";
  }

  if (index % 7 === 0) {
    return "question";
  }

  if (index % 5 === 0) {
    return "insight";
  }

  return index % 2 === 0 ? "entity" : "concept";
}

function buildDemoGraph(file: DemoFile): DemoGraph {
  const labels = getDemoLabels(file.kind);
  const linkCounts: Record<DemoFileKind, number> = {
    docx: 19,
    image: 12,
    md: 14,
    pdf: 22,
    xlsx: 18,
  };
  const nodes = labels.map((label, index) => ({
    community: index === 0 ? 0 : (index % 4) + 1,
    degree: index === 0 ? 7 : 2 + (index % 4),
    id: `${file.kind}-${index}`,
    label: index === 0 ? file.label : label,
    type: getNodeType(index),
  }));
  const links: DemoLink[] = [];
  const targetLinkCount = linkCounts[file.kind];

  for (let index = 1; index < nodes.length && links.length < targetLinkCount; index += 1) {
    links.push({
      relation: index % 2 === 0 ? "supports" : "mentions",
      source: nodes[0].id,
      target: nodes[index].id,
      weight: 0.5 + ((index % 4) * 0.16),
    });
  }

  for (let index = 1; links.length < targetLinkCount; index += 1) {
    const source = nodes[index % nodes.length];
    const target = nodes[((index * 3) % (nodes.length - 1)) + 1];

    if (source.id !== target.id && !links.some((link) => link.source === source.id && link.target === target.id)) {
      links.push({
        relation: index % 3 === 0 ? "connects" : "extends",
        source: source.id,
        target: target.id,
        weight: 0.35 + ((index % 5) * 0.11),
      });
    }
  }

  return { file, links, nodes };
}

function positionDemoGraph(graph: DemoGraph): PositionedDemoGraph {
  const nodes = graph.nodes.map((node, index) => {
    if (index === 0) {
      return { ...node, x: 0.5, y: 0.5 };
    }

    const ring = index % 3 === 0 ? 0.36 : 0.27;
    const angle = (index / Math.max(graph.nodes.length - 1, 1)) * Math.PI * 2 - Math.PI / 2;
    const communityOffset = (node.community - 2) * 0.025;

    return {
      ...node,
      x: 0.5 + Math.cos(angle) * ring + communityOffset,
      y: 0.5 + Math.sin(angle) * ring - communityOffset,
    };
  });

  return { ...graph, nodes };
}

function useReducedMotionPreference() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }

    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => setPrefersReducedMotion(query.matches);
    syncPreference();
    query.addEventListener("change", syncPreference);

    return () => {
      query.removeEventListener("change", syncPreference);
    };
  }, []);

  return prefersReducedMotion;
}

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ height: 0, width: 0 });

  useEffect(() => {
    const element = ref.current;

    if (!element || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      const rect = entry.contentRect;
      setSize({ height: rect.height, width: rect.width });
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  return { ref, size };
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
          <span className="block h-10 w-10 overflow-hidden rounded-xl">
            <img
              alt=""
              aria-hidden="true"
              className="h-full w-full object-cover"
              src="/icon.ico"
            />
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
            {["Research", "Dataset", "Meeting notes", "Local paper archive", "Slide Deck", "Report", "Email"].map((label) => (
              <div
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] px-4 py-3 text-sm text-[var(--text-secondary)]"
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
          <ul className="mt-6 grid gap-3 text-sm font-medium text-[var(--text-primary)] sm:grid-cols-2">
            {["Local context", "Account access", "Release updates", "Redacted logs"].map((label) => (
              <li className="flex items-center gap-2" key={label}>
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                <span>{label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}

function DemoGraphCanvas({
  activeNodeId,
  graph,
  isBuilding,
  prefersReducedMotion,
}: {
  activeNodeId: string | null;
  graph: PositionedDemoGraph | null;
  isBuilding: boolean;
  prefersReducedMotion: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isVisibleRef = useRef(true);
  const { ref: wrapRef, size } = useElementSize<HTMLDivElement>();

  useEffect(() => {
    const element = wrapRef.current;

    if (!element || typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      isVisibleRef.current = entry.isIntersecting;
    });
    observer.observe(element);

    return () => observer.disconnect();
  }, [wrapRef]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || !graph || size.width < 20 || size.height < 20) {
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    const ctx = context;
    const currentGraph = graph;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.floor(size.width);
    const height = Math.floor(size.height);
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const nodeColors: Record<DemoNode["type"], string> = {
      concept: "#6F7F4B",
      entity: "#755A88",
      insight: "#2F766D",
      question: "#9A6A35",
      source: currentGraph.file.accent,
    };
    const startedAt = performance.now();
    let frameId = 0;

    function easeOut(value: number) {
      return 1 - Math.pow(1 - value, 3);
    }

    function draw(now: number) {
      const isVisible = isVisibleRef.current && document.visibilityState !== "hidden";
      const settleProgress = prefersReducedMotion
        ? 1
        : easeOut(Math.min((now - startedAt) / GRAPH_SETTLE_MS, 1));
      const nodePositions = new Map<string, { x: number; y: number; node: PositionedDemoNode }>();
      const entryX = width * 0.2;
      const entryY = height * 0.72;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, "#FAF4DF");
      gradient.addColorStop(1, "#F5EFD5");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      for (const node of currentGraph.nodes) {
        const targetX = node.x * width;
        const targetY = node.y * height;
        const startOffset = node.community * 8;
        nodePositions.set(node.id, {
          node,
          x: entryX + (targetX - entryX) * settleProgress + Math.sin(node.degree + settleProgress * 4) * startOffset * (1 - settleProgress),
          y: entryY + (targetY - entryY) * settleProgress + Math.cos(node.degree + settleProgress * 4) * startOffset * (1 - settleProgress),
        });
      }

      for (const link of currentGraph.links) {
        const source = nodePositions.get(link.source);
        const target = nodePositions.get(link.target);

        if (!source || !target) {
          continue;
        }

        const isActive = activeNodeId === source.node.id || activeNodeId === target.node.id || source.node.type === "source";
        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.strokeStyle = isActive ? "rgba(0, 102, 102, 0.34)" : "rgba(94, 88, 72, 0.17)";
        ctx.lineWidth = isActive ? 1.6 : 1;
        ctx.stroke();

        if (!prefersReducedMotion && isVisible && settleProgress > 0.55) {
          const particleProgress = ((now * (0.00012 + link.weight * 0.00008)) + link.weight) % 1;
          const particleX = source.x + (target.x - source.x) * particleProgress;
          const particleY = source.y + (target.y - source.y) * particleProgress;
          ctx.beginPath();
          ctx.arc(particleX, particleY, isActive ? 2.4 : 1.8, 0, Math.PI * 2);
          ctx.fillStyle = isActive ? "rgba(0, 102, 102, 0.72)" : "rgba(117, 90, 136, 0.35)";
          ctx.fill();
        }
      }

      for (const { node, x, y } of nodePositions.values()) {
        const isActive = activeNodeId === node.id || node.type === "source";
        const radius = node.type === "source" ? 13 : 7 + Math.min(node.degree, 6);

        ctx.beginPath();
        ctx.arc(x + 1, y + 2, radius + 1, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(54, 48, 32, 0.12)";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = isActive ? "#006666" : nodeColors[node.type];
        ctx.fill();
        ctx.lineWidth = isActive ? 2 : 1;
        ctx.strokeStyle = isActive ? "rgba(255, 255, 255, 0.92)" : "rgba(255, 255, 255, 0.62)";
        ctx.stroke();

        if (node.type === "source" || isActive || node.degree >= 5 || currentGraph.nodes.length <= 10) {
          const text = node.label.length > 16 ? `${node.label.slice(0, 15)}...` : node.label;
          ctx.font = "500 12px IBM Plex Sans, system-ui, sans-serif";
          const metrics = ctx.measureText(text);
          const labelWidth = metrics.width + 14;
          const labelX = Math.min(Math.max(x - labelWidth / 2, 8), width - labelWidth - 8);
          const labelY = Math.min(y + radius + 9, height - 26);

          ctx.fillStyle = "rgba(255, 250, 240, 0.88)";
          ctx.strokeStyle = "rgba(228, 225, 214, 0.88)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(labelX, labelY, labelWidth, 22, 8);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "#211F19";
          ctx.fillText(text, labelX + 7, labelY + 15);
        }
      }

      if (isBuilding) {
        const pulse = prefersReducedMotion ? 0.18 : 0.16 + Math.sin(now / 120) * 0.06;
        ctx.fillStyle = `rgba(0, 102, 102, ${pulse})`;
        ctx.fillRect(0, 0, width, height);
      }

      if (!prefersReducedMotion || settleProgress < 1) {
        frameId = window.requestAnimationFrame(draw);
      }
    }

    frameId = window.requestAnimationFrame(draw);

    return () => window.cancelAnimationFrame(frameId);
  }, [activeNodeId, graph, isBuilding, prefersReducedMotion, size.height, size.width]);

  return (
    <div
      className="relative min-h-[300px] overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[#f7f1d8] shadow-inner sm:min-h-[360px]"
      ref={wrapRef}
    >
      {graph ? (
        <canvas
          aria-label={`Demo graph from ${graph.file.label}`}
          className="absolute inset-0 h-full w-full"
          ref={canvasRef}
          role="img"
        />
      ) : (
        <div className="grid min-h-[300px] place-items-center px-6 text-center text-sm leading-6 text-[var(--text-secondary)] sm:min-h-[360px]">
          <div>
            <div className="mx-auto mb-4 h-2 w-32 rounded-full bg-[rgba(0,102,102,0.2)]" />
            Choose a mock file to preview a local graph.
          </div>
        </div>
      )}
    </div>
  );
}

function InteractiveGraphDropDemo() {
  const [selectedFile, setSelectedFile] = useState<DemoFile | null>(null);
  const [demoState, setDemoState] = useState<DemoState>("idle");
  const [dropCount, setDropCount] = useState(0);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const buildTimerRef = useRef<number | null>(null);
  const prefersReducedMotion = useReducedMotionPreference();
  const graph = useMemo(
    () => (selectedFile ? positionDemoGraph(buildDemoGraph(selectedFile)) : null),
    [selectedFile],
  );
  const statusText = demoState === "building"
    ? "Mapping connections..."
    : demoState === "ready" && graph
      ? `${Math.max(graph.nodes.length - 1, 0)} concepts · ${graph.links.length} relationships`
      : demoState === "limit_reached"
        ? "Demo limit reached. Refresh to play again."
        : demoState === "unsupported"
          ? "This website demo uses mock files only."
          : "Drop a mock file";

  useEffect(() => {
    if (!graph) {
      return;
    }

    setActiveNodeId(graph.nodes[0]?.id ?? null);
  }, [graph]);

  useEffect(() => {
    return () => {
      if (buildTimerRef.current) {
        window.clearTimeout(buildTimerRef.current);
      }
    };
  }, []);

  function startDemo(file: DemoFile) {
    if (dropCount >= MAX_DEMO_DROPS_PER_SESSION) {
      setDemoState("limit_reached");
      return;
    }

    if (buildTimerRef.current) {
      window.clearTimeout(buildTimerRef.current);
    }

    setDropCount((value) => value + 1);
    setSelectedFile(file);
    setDemoState("building");

    buildTimerRef.current = window.setTimeout(() => {
      setDemoState("ready");
      buildTimerRef.current = null;
    }, prefersReducedMotion ? 180 : BUILD_ANIMATION_MS);
  }

  function getDraggedMockFile(event: DragEvent<HTMLElement>) {
    const mockId =
      event.dataTransfer.getData("application/x-second-brain-demo-file") ||
      event.dataTransfer.getData("text/plain");
    return demoFiles.find((file) => file.id === mockId) ?? null;
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();

    if (event.dataTransfer.files.length > 0) {
      setDemoState("unsupported");
      return;
    }

    const file = getDraggedMockFile(event);

    if (!file) {
      setDemoState("unsupported");
      return;
    }

    startDemo(file);
  }

  return (
    <section className={cx(containerClass, "py-14")} id="graph-demo">
      <div className="grid gap-8 md:grid-cols-[0.82fr_1.18fr] md:items-start">
        <div>
          <Pill tone="neutral">Interactive demo</Pill>
          <h2 className="mt-5 font-display text-[32px] font-medium leading-tight text-[var(--text-primary)]">
            Drop files. Watch your knowledge connect.
          </h2>
          <p className="mt-4 text-sm leading-7 text-[var(--text-secondary)]">
            Second Brain turns notes, PDFs, spreadsheets, documents, and images into a local graph you can explore.
          </p>
          <p className="mt-4 text-[13px] leading-6 text-[var(--text-muted)]">
            This is a visual mock demo. It never uploads files, parses documents, or calls AI.
          </p>
        </div>

        <Card className="p-4 sm:p-5">
          <div className="overflow-x-auto pb-2">
            <div className="flex min-w-max gap-3">
              {demoFiles.map((file) => {
                const Icon = getFileIcon(file.kind);

                return (
                  <button
                    aria-label={`Preview graph from ${file.label}`}
                    className="group flex min-w-[142px] items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] px-3 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_1px_2px_rgba(30,28,20,0.05)] transition hover:-translate-y-0.5 hover:border-[var(--border-default)] active:translate-y-0"
                    draggable
                    key={file.id}
                    onClick={() => startDemo(file)}
                    onDragStart={(event) => {
                      event.dataTransfer.setData("application/x-second-brain-demo-file", file.id);
                      event.dataTransfer.setData("text/plain", file.id);
                      event.dataTransfer.effectAllowed = "copy";
                      setDemoState("dragging");
                    }}
                    style={{ "--file-accent": file.accent } as CSSProperties}
                    type="button"
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--border-subtle)] bg-white text-[var(--file-accent)]">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span>
                      <span className="block text-sm font-medium text-[var(--text-primary)]">{file.label}</span>
                      <span className="mt-0.5 block text-[12px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
                        {file.kind}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div
            aria-label="Second Brain demo drop zone"
            className={cx(
              "mt-4 rounded-xl border border-dashed px-4 py-4 text-center text-sm font-medium transition",
              demoState === "dragging"
                ? "border-[var(--accent)] bg-[var(--accent-tint)] text-[var(--accent-text-on-tint)]"
                : "border-[var(--border-default)] bg-[var(--bg-page)] text-[var(--text-secondary)]",
            )}
            onDragLeave={() => {
              if (demoState === "dragging") {
                setDemoState(selectedFile ? "ready" : "idle");
              }
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
              setDemoState("dragging");
            }}
            onDrop={handleDrop}
            role="region"
          >
            {statusText}
          </div>

          <div className="mt-4">
            <DemoGraphCanvas
              activeNodeId={activeNodeId}
              graph={graph}
              isBuilding={demoState === "building"}
              prefersReducedMotion={prefersReducedMotion}
            />
          </div>

          <p className="mt-4 text-[13px] leading-6 text-[var(--text-muted)]">
            {graph
              ? `Demo graph with ${Math.max(graph.nodes.length - 1, 0)} concepts and ${graph.links.length} relationships.`
              : "Demo graph will appear here after choosing a mock file."}
          </p>
        </Card>
      </div>
    </section>
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
            Your local Context Manager, <em className="text-[var(--accent)]">your second brain</em>.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-[var(--text-secondary)]">
            Drop anything in it.  Chat on it. Generate artifacts. Track remainders and deadlines.
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

      <InteractiveGraphDropDemo />

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
