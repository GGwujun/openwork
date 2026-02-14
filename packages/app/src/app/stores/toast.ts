import { createStore } from "solid-js/store";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
  created_at: number;
}

interface ToastState {
  toasts: Toast[];
}

const [toastState, setToastState] = createStore<ToastState>({
  toasts: [],
});

// Generate unique ID
let toastId = 0;
const generateId = () => `toast-${++toastId}-${Date.now()}`;

// Toast actions
export const toastActions = {
  // Add a toast
  add: (message: string, type: ToastType = "info", duration: number = 5000) => {
    const id = generateId();
    const toast: Toast = {
      id,
      message,
      type,
      duration,
      created_at: Date.now(),
    };
    
    setToastState("toasts", (toasts) => [...toasts, toast]);
    
    // Auto remove after duration
    if (duration > 0) {
      setTimeout(() => {
        toastActions.remove(id);
      }, duration);
    }
    
    return id;
  },
  
  // Remove a toast by ID
  remove: (id: string) => {
    setToastState("toasts", (toasts) => toasts.filter((t) => t.id !== id));
  },
  
  // Clear all toasts
  clear: () => {
    setToastState("toasts", []);
  },
  
  // Shorthand methods
  success: (message: string, duration?: number) => 
    toastActions.add(message, "success", duration),
  error: (message: string, duration?: number) => 
    toastActions.add(message, "error", duration),
  warning: (message: string, duration?: number) => 
    toastActions.add(message, "warning", duration),
  info: (message: string, duration?: number) => 
    toastActions.add(message, "info", duration),
};

// Hook to use toast
export const useToast = () => {
  return {
    state: toastState,
    actions: toastActions,
  };
};

export { toastState };
