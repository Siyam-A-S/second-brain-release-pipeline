import { ArrowRight, CreditCard, LockKeyhole, MonitorDown } from "lucide-react";
import { motion } from "framer-motion";
import { Link, Route, Routes } from "react-router-dom";

async function fetchLatestReleaseAssets() {
  // Replace this placeholder with a real fetch to:
  // https://api.github.com/repos/siyam-a-s/second-brain/releases/latest
  // Then map the release assets into macOS / Windows download button URLs.
  return {
    macosUrl: "#",
    windowsUrl: "#",
  };
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.18),_transparent_35%),linear-gradient(180deg,_#0f172a_0%,_#111827_45%,_#020617_100%)] text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8 sm:px-8">
        <header className="flex items-center justify-between border-b border-white/10 pb-6">
          <Link className="text-lg font-semibold tracking-[0.24em] text-amber-200" to="/">
            SECOND BRAIN
          </Link>
          <nav className="flex items-center gap-3 text-sm text-slate-300">
            <Link className="rounded-full border border-white/10 px-4 py-2 transition hover:border-amber-300/40 hover:text-white" to="/login">
              Login
            </Link>
            <Link className="rounded-full bg-amber-300 px-4 py-2 font-medium text-slate-950 transition hover:bg-amber-200" to="/checkout">
              Checkout
            </Link>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}

function LandingPage() {
  return (
    <Shell>
      <section className="grid flex-1 items-center gap-10 py-16 lg:grid-cols-[1.2fr_0.8fr] lg:py-24">
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
            Landing page and user portal scaffold for the desktop app. Wire the
            release API, Supabase auth, and Stripe billing into these entry points.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 font-medium text-slate-950 transition hover:bg-slate-200"
              href="#"
            >
              macOS Download
              <MonitorDown className="h-4 w-4" />
            </a>
            <a
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-6 py-3 font-medium text-white transition hover:border-amber-300/50 hover:bg-white/5"
              href="#"
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
            Portal Routes
          </p>
          <div className="mt-6 space-y-4">
            <Link
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-4 transition hover:border-amber-300/40"
              to="/login"
            >
              <span className="flex items-center gap-3">
                <LockKeyhole className="h-5 w-5 text-amber-200" />
                <span>Supabase Login</span>
              </span>
              <ArrowRight className="h-4 w-4 text-slate-400" />
            </Link>
            <Link
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-4 transition hover:border-amber-300/40"
              to="/checkout"
            >
              <span className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-amber-200" />
                <span>Stripe Checkout</span>
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
  return (
    <Shell>
      <section className="flex flex-1 items-center justify-center py-16">
        <div className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-white/5 p-8 backdrop-blur">
          <p className="text-sm uppercase tracking-[0.25em] text-amber-200/80">
            /login
          </p>
          <h2 className="mt-4 font-serif text-4xl text-white">Supabase Auth Placeholder</h2>
          <p className="mt-4 text-slate-300">
            Initialize the Supabase client with `VITE_SUPABASE_URL` and
            `VITE_SUPABASE_ANON_KEY`, then mount your sign-in or magic-link flow here.
          </p>
        </div>
      </section>
    </Shell>
  );
}

function CheckoutPage() {
  return (
    <Shell>
      <section className="flex flex-1 items-center justify-center py-16">
        <div className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-white/5 p-8 backdrop-blur">
          <p className="text-sm uppercase tracking-[0.25em] text-amber-200/80">
            /checkout
          </p>
          <h2 className="mt-4 font-serif text-4xl text-white">Stripe Placeholder</h2>
          <p className="mt-4 text-slate-300">
            Use `VITE_STRIPE_PUBLIC_KEY` with Stripe.js, then connect this route to your
            checkout session creation flow.
          </p>
        </div>
      </section>
    </Shell>
  );
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
