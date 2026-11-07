import { Crosshair } from "lucide-react";

/** A shared focal-point control for image frames and the full-wrap background. */
export function CoverImageFocus({ src, fit, focusX, focusY, onChange, label, aspectRatio = 1.6, filter }: {
  src: string;
  fit: "cover" | "contain";
  focusX: number;
  focusY: number;
  onChange: (x: number, y: number) => void;
  label: string;
  aspectRatio?: number;
  filter?: string;
}) {
  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  const update = (element: HTMLElement, x: number, y: number) => {
    const rect = element.getBoundingClientRect();
    onChange(clamp((x - rect.left) / rect.width), clamp((y - rect.top) / rect.height));
  };
  const ratio = Math.max(0.05, Math.min(30, aspectRatio));
  return <div className="cover-image-focus-editor">
    <div className="cover-image-focus-head"><span>Drag to set crop focus</span><button type="button" className="cover-mini-button" onClick={() => onChange(0.5, 0.5)}><Crosshair size={12} /> Center</button></div>
    <div
      className="cover-image-focus-preview"
      style={{ aspectRatio: ratio, width: ratio < 1.6 ? `${ratio / 1.6 * 100}%` : "100%" }}
      role="slider" tabIndex={0} aria-label={label} aria-valuemin={0} aria-valuemax={100}
      aria-valuenow={Math.round(focusX * 100)} aria-valuetext={`${Math.round(focusX * 100)}% horizontal, ${Math.round(focusY * 100)}% vertical`}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture(event.pointerId);
        update(event.currentTarget, event.clientX, event.clientY);
      }}
      onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId) && event.buttons === 1) update(event.currentTarget, event.clientX, event.clientY); }}
      onPointerUp={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
      onPointerCancel={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
      onKeyDown={(event) => {
        const step = event.shiftKey ? 0.1 : 0.01;
        if (!event.key.startsWith("Arrow") && event.key !== "Home") return;
        event.preventDefault(); event.stopPropagation();
        if (event.key === "Home") onChange(0.5, 0.5);
        else onChange(clamp(focusX + (event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0)), clamp(focusY + (event.key === "ArrowDown" ? step : event.key === "ArrowUp" ? -step : 0)));
      }}
    >
      <img src={src} alt="" draggable={false} style={{ objectFit: fit, objectPosition: `${focusX * 100}% ${focusY * 100}%`, filter }} />
      <Crosshair className="cover-image-focus-target" size={22} style={{ left: `${focusX * 100}%`, top: `${focusY * 100}%` }} aria-hidden="true" />
    </div>
  </div>;
}
