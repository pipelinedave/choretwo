// Supabase Auth client (optional feature).
//
// If VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are NOT set (local dev with
// the Go auth-service, Playwright E2E with USE_MOCK_AUTH), `supabase` stays
// `null` and the app falls back to the legacy auth flow (/api/auth/login
// redirect + ?token= callback). No crash, pure feature detection.
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          // Session persists in localStorage under `sb-<ref>-auth-token`.
          persistSession: true,
          // Refresh access tokens shortly before expiry (JWT lifetime ~1h).
          autoRefreshToken: true,
          // Consume `#access_token=...` (implicit flow — supabase-js default
          // for magic links) or `?code=...` (PKCE) on page load and clean up
          // the URL afterwards.
          detectSessionInUrl: true,
        },
      })
    : null;

/** True when Supabase auth is configured (production mode). */
export const isSupabaseAuth = () => Boolean(supabase);
