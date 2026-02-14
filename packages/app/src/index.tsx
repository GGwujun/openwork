/* @refresh reload */
import { render } from "solid-js/web";
import { HashRouter, Route, Router, useLocation, useNavigate } from "@solidjs/router";
import { Show, createEffect, createSignal, onMount } from "solid-js";

import { bootstrapTheme } from "./app/theme";
import "./app/index.css";
import AppEntry from "./app/entry";
import LoginPage from "./app/pages/login";
import AuthCallbackPage from "./app/pages/auth-callback";
import { authState, useAuth } from "./app/stores/auth";
import { PlatformProvider, type Platform } from "./app/context/platform";
import ToastContainer from "./app/components/Toast";
import { isTauriRuntime } from "./app/utils";

bootstrapTheme();

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

const RouterComponent = isTauriRuntime() ? HashRouter : Router;

const platform: Platform = {
  platform: isTauriRuntime() ? "desktop" : "web",
  openLink(url: string) {
    if (isTauriRuntime()) {
      void import("@tauri-apps/plugin-opener")
        .then(({ openUrl }) => openUrl(url))
        .catch(() => undefined);
      return;
    }

    window.open(url, "_blank");
  },
  restart: async () => {
    if (isTauriRuntime()) {
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
      return;
    }

    window.location.reload();
  },
  notify: async (title, description, href) => {
    if (!("Notification" in window)) return;

    const permission =
      Notification.permission === "default"
        ? await Notification.requestPermission().catch(() => "denied")
        : Notification.permission;

    if (permission !== "granted") return;

    const inView = document.visibilityState === "visible" && document.hasFocus();
    if (inView) return;

    await Promise.resolve()
      .then(() => {
        const notification = new Notification(title, {
          body: description ?? "",
        });
        notification.onclick = () => {
          window.focus();
          if (href) {
            window.history.pushState(null, "", href);
            window.dispatchEvent(new PopStateEvent("popstate"));
          }
          notification.close();
        };
      })
      .catch(() => undefined);
  },
  storage: (name) => {
    const prefix = name ? `${name}:` : "";
    return {
      getItem: (key) => window.localStorage.getItem(prefix + key),
      setItem: (key, value) => window.localStorage.setItem(prefix + key, value),
      removeItem: (key) => window.localStorage.removeItem(prefix + key),
    };
  },
  fetch,
};

// Auth-aware App wrapper that handles routing based on auth state
function AuthAwareApp() {
  const navigate = useNavigate();
  const location = useLocation();
  const { state, actions } = useAuth();
  const [isReady, setIsReady] = createSignal(false);
  const [currentPath, setCurrentPath] = createSignal(location.pathname);

  // Track pathname changes
  createEffect(() => {
    setCurrentPath(location.pathname);
  });

  // Initialize auth on mount
  onMount(() => {
    console.log("AuthAwareApp mounted, initializing auth...");
    actions.init();
    setIsReady(true);
    console.log("Auth initialized, path:", location.pathname);
  });

  // Handle redirects based on auth state
  createEffect(() => {
    if (!isReady()) return;
    
    const path = currentPath();
    const isPublicRoute = path === "/login" || path === "/auth/callback";
    const isAuth = state.isAuthenticated;
    
    console.log("Effect triggered:", { path, isAuth, isPublicRoute });
    
    // If not authenticated and not on a public route, redirect to login
    if (!isAuth && !isPublicRoute) {
      console.log("Redirecting to login...");
      navigate("/login", { replace: true });
      return;
    }
    
    // If authenticated and on login, redirect to home
    if (isAuth && path === "/login") {
      console.log("Redirecting to home...");
      navigate("/", { replace: true });
    }
  });

  // Render based on current state
  return (
    <Show
      when={isReady()}
      fallback={
        <div class="min-h-screen flex items-center justify-center bg-slate-900">
          <div class="text-slate-400">Initializing...</div>
        </div>
      }
    >
      <Show when={currentPath() === "/login"}>
        <LoginPage />
      </Show>
      <Show when={currentPath() === "/auth/callback"}>
        <AuthCallbackPage />
      </Show>
      <Show when={currentPath() !== "/login" && currentPath() !== "/auth/callback"}>
        <Show
          when={state.isAuthenticated}
          fallback={
            <div class="min-h-screen flex items-center justify-center bg-slate-900">
              <div class="text-slate-400">Please login...</div>
            </div>
          }
        >
          <AppEntry />
        </Show>
      </Show>
    </Show>
  );
}

render(
  () => (
    <PlatformProvider value={platform}>
      <>
        <RouterComponent>
          <Route path="*all" component={AuthAwareApp} />
        </RouterComponent>
        <ToastContainer />
      </>
    </PlatformProvider>
  ),
  root,
);
