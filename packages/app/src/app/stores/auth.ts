import { createEffect, createSignal, onMount } from "solid-js";
import { createStore } from "solid-js/store";

// Types
export interface UserInfo {
  userId: string;
  name: string;
  avatar?: string;
  department?: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

interface AuthState {
  isAuthenticated: boolean;
  user: UserInfo | null;
  tokens: AuthTokens | null;
  isLoading: boolean;
  error: string | null;
}

// Local storage keys
const AUTH_STORAGE_KEY = "openwork.auth";
const USER_STORAGE_KEY = "openwork.user";

// Create the auth store
const [authState, setAuthState] = createStore<AuthState>({
  isAuthenticated: false,
  user: null,
  tokens: null,
  isLoading: false,
  error: null,
});

// Helper to check if token is expired
const isTokenExpired = (expiresAt: number): boolean => {
  return Date.now() >= expiresAt * 1000;
};

// Load auth from storage on init
const loadAuthFromStorage = () => {
  if (typeof window === "undefined") return;
  
  try {
    const authData = window.localStorage.getItem(AUTH_STORAGE_KEY);
    const userData = window.localStorage.getItem(USER_STORAGE_KEY);
    
    if (authData && userData) {
      const tokens: AuthTokens = JSON.parse(authData);
      const user: UserInfo = JSON.parse(userData);
      
      // Check if token is expired
      if (!isTokenExpired(tokens.expiresAt)) {
        setAuthState({
          isAuthenticated: true,
          user,
          tokens,
          isLoading: false,
          error: null,
        });
      } else {
        // Token expired, clear storage
        clearAuthStorage();
      }
    }
  } catch (error) {
    console.error("Failed to load auth from storage:", error);
    clearAuthStorage();
  }
};

// Save auth to storage
const saveAuthToStorage = (tokens: AuthTokens, user: UserInfo) => {
  if (typeof window === "undefined") return;
  
  try {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(tokens));
    window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } catch (error) {
    console.error("Failed to save auth to storage:", error);
  }
};

// Clear auth storage
const clearAuthStorage = () => {
  if (typeof window === "undefined") return;
  
  try {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    window.localStorage.removeItem(USER_STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear auth storage:", error);
  }
};

// Auth actions
export const authActions = {
  // Initialize auth from storage
  init: () => {
    loadAuthFromStorage();
  },

  // Login with user info and tokens
  login: (user: UserInfo, tokens: AuthTokens) => {
    setAuthState({
      isAuthenticated: true,
      user,
      tokens,
      isLoading: false,
      error: null,
    });
    saveAuthToStorage(tokens, user);
  },

  // Logout
  logout: () => {
    setAuthState({
      isAuthenticated: false,
      user: null,
      tokens: null,
      isLoading: false,
      error: null,
    });
    clearAuthStorage();
  },

  // Set loading state
  setLoading: (loading: boolean) => {
    setAuthState("isLoading", loading);
  },

  // Set error
  setError: (error: string | null) => {
    setAuthState("error", error);
  },

  // Update tokens (for refresh)
  updateTokens: (tokens: AuthTokens) => {
    setAuthState("tokens", tokens);
    if (authState.user) {
      saveAuthToStorage(tokens, authState.user);
    }
  },

  // Check if authenticated
  checkAuth: (): boolean => {
    if (!authState.isAuthenticated || !authState.tokens) {
      return false;
    }
    
    // Check if token is expired
    if (isTokenExpired(authState.tokens.expiresAt)) {
      authActions.logout();
      return false;
    }
    
    return true;
  },
  
  // Check if token needs refresh (within 5 minutes of expiry)
  needsRefresh: (): boolean => {
    if (!authState.tokens) return false;
    
    const expiryTime = authState.tokens.expiresAt * 1000;
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    
    return expiryTime - now < fiveMinutes;
  },
  
  // Schedule automatic token refresh
  scheduleRefresh: () => {
    if (!authState.tokens) return;
    
    const expiryTime = authState.tokens.expiresAt * 1000;
    const now = Date.now();
    const refreshAt = expiryTime - 5 * 60 * 1000; // 5 min before expiry
    
    if (refreshAt > now) {
      const delay = refreshAt - now;
      setTimeout(() => {
        // Trigger refresh - in production this would call Tauri to refresh the token
        console.log("Token refresh scheduled at:", new Date(refreshAt).toISOString());
      }, delay);
    }
  },
};

// Hook to use auth state
export const useAuth = () => {
  return {
    state: authState,
    actions: authActions,
  };
};

// Initialize on module load
loadAuthFromStorage();

export { authState };
