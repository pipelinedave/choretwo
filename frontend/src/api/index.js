import axios from "axios";
import { supabase } from "./supabase";

const API_BASE = import.meta.env.VITE_API_BASE || "";
const AUTH_BASE = import.meta.env.VITE_AUTH_BASE || "";

// Create axios instances for each service
export const authApi = axios.create({
  baseURL: `${AUTH_BASE}/api/auth`,
  headers: {
    "Content-Type": "application/json",
  },
});

export const choreApi = axios.create({
  baseURL: `${API_BASE}/api/chores`,
  headers: {
    "Content-Type": "application/json",
  },
});

export const logApi = axios.create({
  baseURL: `${API_BASE}/api/logs`,
  headers: {
    "Content-Type": "application/json",
  },
});

export const notifyApi = axios.create({
  baseURL: `${API_BASE}/api/notify`,
  headers: {
    "Content-Type": "application/json",
  },
});

export const aiApi = axios.create({
  baseURL: `${API_BASE}/api/ai`,
  headers: {
    "Content-Type": "application/json",
  },
});

export const settingsApi = axios.create({
  baseURL: `${API_BASE}/api`,
  headers: {
    "Content-Type": "application/json",
  },
});

// JWT Token Interceptor
// Supabase mode: resolve the (auto-refreshed) access token asynchronously
// from the supabase-js session (returns a Promise). Legacy mode: synchronous
// localStorage lookup (Go auth-service JWT) — behavior unchanged.
const attachToken = (config) => {
  if (supabase) {
    return supabase.auth
      .getSession()
      .then(({ data }) => {
        const accessToken = data?.session?.access_token;
        if (accessToken) {
          config.headers.Authorization = `Bearer ${accessToken}`;
        }
        return config;
      })
      .catch(() => config);
  }
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
};

// Request interceptor for all APIs
const apis = [authApi, choreApi, logApi, notifyApi, aiApi, settingsApi];

apis.forEach((api) => {
  api.interceptors.request.use(attachToken, (error) => {
    return Promise.reject(error);
  });

  api.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        // Token expired or invalid (supabase-js already attempted an
        // automatic refresh before this request went out).
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        if (supabase) {
          // Clear the Supabase session state as well so no stale tokens
          // linger after the redirect.
          supabase.auth.signOut().catch(() => {});
        }
        window.location.href = "/login";
      }
      return Promise.reject(error);
    },
  );
});

// Helper to get current token
export const getToken = () => localStorage.getItem("token");

// Helper to set token (called after successful login)
export const setToken = (token) => {
  localStorage.setItem("token", token);
};

// Helper to remove token (called on logout)
export const removeToken = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
};

// Helper to get current user
export const getUser = () => {
  const userStr = localStorage.getItem("user");
  return userStr ? JSON.parse(userStr) : null;
};

// Helper to set user
export const setUser = (user) => {
  localStorage.setItem("user", JSON.stringify(user));
};
