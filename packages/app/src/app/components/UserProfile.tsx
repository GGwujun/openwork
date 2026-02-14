import { Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { LogOut, User } from "lucide-solid";
import { authState, useAuth } from "../stores/auth";

export default function UserProfile() {
  const navigate = useNavigate();
  const { actions } = useAuth();

  const handleLogout = () => {
    actions.logout();
    navigate("/login", { replace: true });
  };

  return (
    <div class="flex items-center gap-3 px-4 py-3 bg-slate-800/50 rounded-lg border border-slate-700">
      {/* Avatar */}
      <div class="flex-shrink-0">
        <Show
          when={authState.user?.avatar}
          fallback={
            <div class="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
              <User class="w-5 h-5 text-blue-400" />
            </div>
          }
        >
          <img
            src={authState.user!.avatar!}
            alt={authState.user?.name}
            class="w-10 h-10 rounded-full object-cover border border-slate-600"
          />
        </Show>
      </div>

      {/* User Info */}
      <div class="flex-1 min-w-0">
        <div class="text-sm font-medium text-white truncate">
          {authState.user?.name || "Unknown User"}
        </div>
        <div class="text-xs text-slate-400 truncate">
          {authState.user?.department?.[0] || "企业微信用户"}
        </div>
      </div>

      {/* Logout Button */}
      <button
        onClick={handleLogout}
        class="flex-shrink-0 p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
        title="退出登录"
      >
        <LogOut class="w-5 h-5" />
      </button>
    </div>
  );
}
