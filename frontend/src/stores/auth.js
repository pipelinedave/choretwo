import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { supabase } from "@/api/supabase";
import {
  authApi,
  getToken,
  setToken,
  removeToken,
  getUser,
  setUser,
} from "@/api";

export const useAuthStore = defineStore("auth", () => {
  const user = ref(getUser());
  const token = ref(getToken());
  const loading = ref(false);
  const error = ref(null);

  const isAuthenticated = computed(() => !!token.value && !!user.value);

  // Dual-mode auth: Supabase (production, VITE_SUPABASE_* set) vs. legacy
  // Go auth-service flow (local dev / Playwright E2E with USE_MOCK_AUTH).
  const isSupabaseMode = computed(() => !!supabase);

  // --- Supabase helpers -----------------------------------------------------

  // Map a Supabase user onto the app-wide user shape ({ id, email, name }).
  function mapSupabaseUser(supabaseUser) {
    const meta = supabaseUser.user_metadata || {};
    return {
      id: supabaseUser.id,
      email: supabaseUser.email,
      name:
        meta.full_name ||
        meta.name ||
        supabaseUser.email?.split("@")[0] ||
        "User",
    };
  }

  function applySupabaseSession(session) {
    if (!session) return;
    token.value = session.access_token;
    user.value = mapSupabaseUser(session.user);
    // Mirror into localStorage so the shared helpers and the 401 cleanup
    // in the axios interceptor stay uniform across both modes.
    setToken(session.access_token);
    setUser(user.value);
  }

  // Magic-link redirect target: /auth-callback (+ optional ?redirect= for
  // deep links, picked up again by CallbackView after the session is set).
  function buildCallbackUrl(redirectUrl) {
    const base = `${window.location.origin}/auth-callback`;
    return redirectUrl && redirectUrl !== "/"
      ? `${base}?redirect=${encodeURIComponent(redirectUrl)}`
      : base;
  }

  // Wait for supabase-js to consume the magic-link tokens from the URL
  // (detectSessionInUrl runs asynchronously during client init) and expose
  // the resulting session. Covers the race where SIGNED_IN fired before the
  // store subscribed to onAuthStateChange.
  async function waitForSupabaseSession(timeoutMs = 5000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const { data } = await supabase.auth.getSession();
      if (data?.session) return data.session;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    return null;
  }

  if (supabase) {
    // Restore an existing session (page reload) and keep token/user in sync
    // with SIGNED_IN / TOKEN_REFRESHED / SIGNED_OUT events.
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) applySupabaseSession(data.session);
    });
    supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        applySupabaseSession(session);
      } else if (event === "SIGNED_OUT") {
        token.value = null;
        user.value = null;
        removeToken();
      }
    });
  }

  // --- Actions --------------------------------------------------------------

  /**
   * Supabase mode: `login(email, redirectUrl)` sends a magic link to the
   * given address. Legacy mode: `login(redirectUrl)` redirects to the Go
   * auth-service login page (unchanged behavior).
   */
  async function login(emailOrRedirect, redirectUrl = "/") {
    error.value = null;

    if (supabase) {
      loading.value = true;
      try {
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email: emailOrRedirect,
          options: { emailRedirectTo: buildCallbackUrl(redirectUrl) },
        });
        if (otpError) {
          error.value = otpError.message;
          return false;
        }
        return true;
      } finally {
        loading.value = false;
      }
    }

    const params = new URLSearchParams({ redirect: emailOrRedirect });
    window.location.href = "/api/auth/login?" + params.toString();
  }

  /** Supabase only: OAuth redirect (env-gated Google button). */
  async function loginWithGoogle(redirectUrl = "/") {
    if (!supabase) return false;
    error.value = null;

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: buildCallbackUrl(redirectUrl) },
    });
    if (oauthError) {
      error.value = oauthError.message;
      return false;
    }
    // Browser navigates to Google; the redirect lands on /auth-callback.
    return true;
  }

  async function handleCallback() {
    loading.value = true;
    error.value = null;

    if (supabase) {
      try {
        const session = await waitForSupabaseSession();
        if (!session) {
          throw new Error("No session in callback URL");
        }
        applySupabaseSession(session);
        // Remove leftover auth fragments/query params from the address bar.
        window.history.replaceState({}, "", window.location.pathname);
        return true;
      } catch (err) {
        console.error("Callback error:", err);
        error.value = err.message || "Authentication failed";
        return false;
      } finally {
        loading.value = false;
      }
    }

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const tokenFromUrl = urlParams.get("token");

      console.log(
        "Callback: tokenFromUrl",
        tokenFromUrl ? "present" : "missing",
      );

      if (!tokenFromUrl) {
        throw new Error("No token in callback URL");
      }

      setToken(tokenFromUrl);
      token.value = tokenFromUrl;

      console.log("Callback: fetching user data");

      const response = await authApi.get("/user");
      user.value = response.data;
      setUser(response.data);

      console.log("Callback: success, user:", user.value);

      window.history.replaceState({}, "", window.location.pathname);

      return true;
    } catch (err) {
      console.error("Callback error:", err);
      error.value = err.message || "Authentication failed";
      removeToken();
      token.value = null;
      user.value = null;
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function fetchUser() {
    if (supabase) {
      // No /api/auth/user endpoint in Supabase mode — re-derive the user
      // from the (auto-refreshed) local session instead of the network.
      if (!token.value) return;
      const { data } = await supabase.auth.getSession();
      if (data?.session) applySupabaseSession(data.session);
      return;
    }

    if (!token.value) return;

    try {
      const response = await authApi.get("/user");
      user.value = response.data;
      setUser(response.data);
    } catch (err) {
      console.error("Failed to fetch user:", err);
      logout();
    }
  }

  async function logout() {
    loading.value = true;

    try {
      if (supabase) {
        await supabase.auth.signOut().catch(() => {});
      } else {
        // Call logout endpoint if exists
        await authApi.post("/logout").catch(() => {});
      }
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      removeToken();
      token.value = null;
      user.value = null;
      loading.value = false;

      // Redirect to login
      window.location.href = "/login";
    }
  }

  async function restoreAuth() {
    if (supabase) {
      if (token.value && user.value) return true;
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        applySupabaseSession(data.session);
        return true;
      }
      return false;
    }

    if (!token.value || !user.value) {
      const storedToken = getToken();
      const storedUser = getUser();

      if (storedToken && storedUser) {
        token.value = storedToken;
        user.value = storedUser;

        // Verify token is still valid
        try {
          await fetchUser();
          return true;
        } catch {
          logout();
          return false;
        }
      }
      return false;
    }
    return true;
  }

  function clearError() {
    error.value = null;
  }

  return {
    user,
    token,
    loading,
    error,
    isAuthenticated,
    isSupabaseMode,
    login,
    loginWithGoogle,
    handleCallback,
    fetchUser,
    logout,
    restoreAuth,
    clearError,
  };
});
