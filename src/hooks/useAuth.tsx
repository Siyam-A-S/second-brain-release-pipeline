import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, type SubscriptionRow } from "../lib/supabase";

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
  session: Session | null;
  signIn: (credentials: AuthCredentials) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (credentials: AuthCredentials) => Promise<void>;
  subscription: SubscriptionRow | null;
  user: User | null;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function hasActiveTrial(subscription: SubscriptionRow | null) {
  if (!subscription?.trial_end) {
    return false;
  }

  return new Date(subscription.trial_end).getTime() > Date.now();
}

function hasPaidAccess(subscription: SubscriptionRow | null) {
  return subscription?.status === "active" || subscription?.status === "trialing";
}

async function fetchSubscription(userId: string) {
  const { data, error } = await supabase
    .from("subscriptions")
    .select(
      "user_id, stripe_customer_id, stripe_subscription_id, status, trial_start, trial_end",
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

  useEffect(() => {
    let isMounted = true;

    async function hydrate() {
      const { data, error: sessionError } = await supabase.auth.getSession();

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

    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange((_, nextSession) => {
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

    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      setError(signOutError.message);
      throw signOutError;
    }

    setSubscription(null);
  }

  const isTrialActive = hasActiveTrial(subscription);
  const isSubscribed = hasPaidAccess(subscription);
  const hasAccessBlocked = Boolean(user) && !isTrialActive && !isSubscribed;

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
