import { Show, createSignal, onMount } from "solid-js";
import { useNavigate, useSearchParams } from "@solidjs/router";
import { invoke } from "@tauri-apps/api/core";
import { Loader2, CheckCircle, XCircle } from "lucide-solid";
import { useAuth } from "../stores/auth";
import { isTauriRuntime } from "../utils";

interface WeComUserInfo {
  user_id: string;
  name: string;
  avatar?: string;
  department?: string[];
}

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { actions } = useAuth();
  
  const [status, setStatus] = createSignal<"loading" | "success" | "error">("loading");
  const [error, setError] = createSignal<string | null>(null);

  onMount(async () => {
    if (!isTauriRuntime()) {
      setStatus("error");
      setError("This page must be accessed from the desktop app");
      return;
    }

    const code = Array.isArray(searchParams.code) ? searchParams.code[0] : searchParams.code;
    const state = Array.isArray(searchParams.state) ? searchParams.state[0] : searchParams.state;

    if (!code || !state) {
      setStatus("error");
      setError("Missing authorization code or state");
      return;
    }

    try {
      // Get user info from state
      const response = await invoke<{ user_info?: WeComUserInfo | null }>(
        "check_login_status",
        { state }
      );

      if (response.user_info) {
        // Login successful
        actions.login(
          {
            userId: response.user_info.user_id,
            name: response.user_info.name,
            avatar: response.user_info.avatar,
            department: response.user_info.department,
          },
          {
            accessToken: code, // In production, this should be the actual token
            expiresAt: Date.now() / 1000 + 7200,
          }
        );

        setStatus("success");
        
        // Redirect to main app after 1 second
        setTimeout(() => {
          navigate("/", { replace: true });
        }, 1000);
      } else {
        setStatus("error");
        setError("User information not found");
      }
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Authentication failed");
    }
  });

  return (
    <div class="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div class="w-full max-w-md bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 shadow-2xl text-center">
        <Show
          when={status() === "loading"}
          fallback={
            <Show
              when={status() === "success"}
              fallback={
                <div>
                  <XCircle class="w-16 h-16 text-red-400 mx-auto mb-4" />
                  <h1 class="text-xl font-bold text-white mb-2">登录失败</h1>
                  <p class="text-red-400 mb-4">{error()}</p>
                  <button
                    onClick={() => navigate("/login", { replace: true })}
                    class="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors"
                  >
                    返回登录页面
                  </button>
                </div>
              }
            >
              <div>
                <CheckCircle class="w-16 h-16 text-green-400 mx-auto mb-4" />
                <h1 class="text-xl font-bold text-white mb-2">登录成功</h1>
                <p class="text-slate-400">正在跳转到应用...</p>
              </div>
            </Show>
          }
        >
          <Loader2 class="w-16 h-16 text-blue-500 animate-spin mx-auto mb-4" />
          <h1 class="text-xl font-bold text-white mb-2">正在处理登录...</h1>
          <p class="text-slate-400">请稍候</p>
        </Show>
      </div>
    </div>
  );
}
