import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type SubscriptionRow = {
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: string | null;
  cancel_at_period_end: boolean;
  plan_name: string;
  subscription_renews_at: string | null;
  trial_start: string | null;
  trial_end: string | null;
  usage_period_start: string | null;
  usage_period_end: string | null;
  usage_requests: number;
  usage_request_limit: number;
  updated_at?: string;
};

export type DesktopLogEventRow = {
  id: string;
  user_id: string;
  request_id: string;
  event_name: string;
  level: string;
  message: string | null;
  metadata: Record<string, unknown>;
  app_version: string | null;
  arch: string | null;
  build_channel: string | null;
  device_id: string | null;
  occurred_at: string;
  platform: string | null;
  created_at: string;
};

type Database = {
  public: {
    Tables: {
      subscriptions: {
        Row: SubscriptionRow;
      };
      desktop_log_events: {
        Row: DesktopLogEventRow;
      };
    };
  };
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured
  ? createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;
