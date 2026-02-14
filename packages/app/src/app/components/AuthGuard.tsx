import { Show, createEffect, onMount } from "solid-js";
import { useNavigate, useLocation } from "@solidjs/router";
import { authState, useAuth } from "../stores/auth";

interface AuthGuardProps {
  children: any;
}

/**
 * AuthGuard component that protects routes requiring authentication
 * Redirects to /login if user is not authenticated
 */
export default function AuthGuard(props: AuthGuardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { actions } = useAuth();

  // Check auth on mount and redirect if needed
  createEffect(() => {
    const isAuth = actions.checkAuth();
    const currentPath = location.pathname;
    
    // Skip auth check for login page
    if (currentPath === "/login") {
      return;
    }
    
    if (!isAuth) {
      // Not authenticated, redirect to login
      navigate("/login", { replace: true });
    }
  });

  // Show children only when authenticated or on login page
  return (
    <Show
      when={authState.isAuthenticated || location.pathname === "/login"}
      fallback={
        <div class="min-h-screen flex items-center justify-center">
          <div class="text-gray-500">Loading...</div>
        </div>
      }
    >
      {props.children}
    </Show>
  );
}
