import { create } from "zustand";

export type ToastType = "success" | "info" | "warning" | "error";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  time: number;
}

interface ToastState {
  toasts: Toast[];
  push: (type: ToastType, title: string, message?: string, duration?: number) => void;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

export const useToast = create<ToastState>((set, get) => ({
  toasts: [],
  push: (type, title, message, duration = 4200) => {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [...s.toasts.slice(-4), { id, type, title, message, time: Date.now() }] }));
    if (duration > 0) {
      setTimeout(() => get().dismiss(id), duration);
    }
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  dismissAll: () => set({ toasts: [] }),
}));

export function notify(type: ToastType, title: string, message?: string, duration?: number) {
  useToast.getState().push(type, title, message, duration);
}
