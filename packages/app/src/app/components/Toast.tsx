import { For, Show } from "solid-js";
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-solid";
import { toastState, toastActions } from "../stores/toast";

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const styles = {
  success: "bg-green-500/10 border-green-500/20 text-green-400",
  error: "bg-red-500/10 border-red-500/20 text-red-400",
  warning: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400",
  info: "bg-blue-500/10 border-blue-500/20 text-blue-400",
};

export default function ToastContainer() {
  return (
    <div class="fixed top-4 right-4 z-[9999] flex flex-col gap-2">
      <For each={toastState.toasts}>
        {(toast) => {
          const Icon = icons[toast.type];
          return (
            <div
              class={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg min-w-[300px] max-w-[500px] animate-in slide-in-from-right ${styles[toast.type]}`}
              style={{ animation: "slideIn 0.2s ease-out" }}
            >
              <Icon class="w-5 h-5 flex-shrink-0" />
              <p class="flex-1 text-sm font-medium">{toast.message}</p>
              <button
                onClick={() => toastActions.remove(toast.id)}
                class="flex-shrink-0 p-1 rounded hover:bg-white/10 transition-colors"
              >
                <X class="w-4 h-4" />
              </button>
            </div>
          );
        }}
      </For>
    </div>
  );
}
