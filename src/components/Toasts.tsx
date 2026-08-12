import { CheckCircle2, Info, TriangleAlert, X, XCircle } from "lucide-react";
import { useToast, type ToastType } from "../store/toast";

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 size={16} color="var(--success)" />,
  info: <Info size={16} color="var(--accent)" />,
  warning: <TriangleAlert size={16} color="var(--warning)" />,
  error: <XCircle size={16} color="var(--danger)" />,
};

export function Toasts() {
  const toasts = useToast((s) => s.toasts);
  const dismiss = useToast((s) => s.dismiss);
  if (toasts.length === 0) return null;
  return (
    <div className="toast-region">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`}>
          <span className="toast-icon">{ICONS[t.type]}</span>
          <div className="toast-body">
            <div className="toast-title">{t.title}</div>
            {t.message && <div className="toast-msg">{t.message}</div>}
          </div>
          <button className="icon-btn toast-close" onClick={() => dismiss(t.id)}>
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}
