import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase, type SubscriptionRow } from "../lib/supabase";

type AuthCredentials = {
  email: string;
  password: string;
};

type AuthContextValue = {
  accessToken: string | null;
  error: string | null;
  hasAccessBlocked: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  isSubscribed: boolean;
  isTrialActive: boolean;
  refreshSubscription: () => Promise<void>;
  session: Session | null;
  signIn: (credentials: AuthCredentials) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (credentials: AuthCredentials) => Promise<void>;
  subscription: SubscriptionRow | null;
  user: User | null;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function hasActiveTrial() {
  return false;
}

function hasPaidAccess(subscription: SubscriptionRow | null) {
  return subscription?.status === "active" && Boolean(subscription.stripe_subscription_id);
}

async function fetchSubscription(userId: string) {
  if (!supabase) {
    throw new Error(
      "Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
    );
  }

  const { data, error } = await supabase
    .from("subscriptions")
    .select(
      "user_id, stripe_customer_id, stripe_subscription_id, status, cancel_at_period_end, plan_name, subscription_renews_at, trial_start, trial_end, usage_period_start, usage_period_end, usage_requests, usage_request_limit, updated_at",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refreshSubscription() {
    setError(null);

    if (!user) {
      setSubscription(null);
      return;
    }

    const nextSubscription = await fetchSubscription(user.id);
    setSubscription(nextSubscription);
  }

  useEffect(() => {
    let isMounted = true;

    async function hydrate() {
      if (!supabase || !isSupabaseConfigured) {
        setError(
          "Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
        );
        setIsLoading(false);
        return;
      }

      const supabaseClient = supabase;
      const { data, error: sessionError } = await supabaseClient.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (sessionError) {
        setError(sessionError.message);
        setIsLoading(false);
        return;
      }

      setSession(data.session);
      setUser(data.session?.user ?? null);

      if (data.session?.user) {
        try {
          const nextSubscription = await fetchSubscription(data.session.user.id);

          if (isMounted) {
            setSubscription(nextSubscription);
          }
        } catch (subscriptionError) {
          if (isMounted) {
            setError(
              subscriptionError instanceof Error
                ? subscriptionError.message
                : "Unable to fetch subscription.",
            );
          }
        }
      }

      if (isMounted) {
        setIsLoading(false);
      }
    }

    void hydrate();

    if (!supabase) {
      return () => {
        isMounted = false;
      };
    }

    const supabaseClient = supabase;
    const {
      data: { subscription: authSubscription },
    } = supabaseClient.auth.onAuthStateChange((_, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setError(null);

      if (!nextSession?.user) {
        setSubscription(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      void fetchSubscription(nextSession.user.id)
        .then((nextSubscription) => {
          if (isMounted) {
            setSubscription(nextSubscription);
          }
        })
        .catch((subscriptionError) => {
          if (isMounted) {
            setError(
              subscriptionError instanceof Error
                ? subscriptionError.message
                : "Unable to fetch subscription.",
            );
          }
        })
        .finally(() => {
          if (isMounted) {
            setIsLoading(false);
          }
        });
    });

    return () => {
      isMounted = false;
      authSubscription.unsubscribe();
    };
  }, []);

  async function signUp({ email, password }: AuthCredentials) {
    setError(null);

    if (!supabase) {
      const missingConfigError = new Error(
        "Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
      );
      setError(missingConfigError.message);
      throw missingConfigError;
    }

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      setError(signUpError.message);
      throw signUpError;
    }
  }

  async function signIn({ email, password }: AuthCredentials) {
    setError(null);

    if (!supabase) {
      const missingConfigError = new Error(
        "Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
      );
      setError(missingConfigError.message);
      throw missingConfigError;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      throw signInError;
    }
  }

  async function signOut() {
    setError(null);

    if (!supabase) {
      setSubscription(null);
      return;
    }

    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      setError(signOutError.message);
      throw signOutError;
    }

    setSubscription(null);
  }

  const isTrialActive = hasActiveTrial();
  const isSubscribed = hasPaidAccess(subscription);
  const hasAccessBlocked = false;

  return (
    <AuthContext.Provider
      value={{
        accessToken: session?.access_token ?? null,
        error,
        hasAccessBlocked,
        isAuthenticated: Boolean(user),
        isLoading,
        isSubscribed,
        isTrialActive,
        refreshSubscription,
        session,
        signIn,
        signOut,
        signUp,
        subscription,
        user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider.");
  }

  return context;
}
