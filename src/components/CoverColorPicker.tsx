import { createContext, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Palette, Pipette, RotateCcw, X } from "lucide-react";

const RECENT_KEY = "noteme.cover.colorRecents";

import { normalizeCoverHex as normalizeHex, parseCoverColor, rgbaToHex, rgbToHsv, hsvToRgb, type Rgba, type Hsv } from "../lib/bookCoverColor";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const CoverColorContext = createContext<{
  palette: string[];
  onSaveColor?: (color: string) => void;
  onPickColor?: (apply: (color: string) => void) => void;
}>({ palette: [] });

export function CoverColorProvider({ palette, onSaveColor, onPickColor, children }: {
  palette: string[];
  onSaveColor: (color: string) => void;
  onPickColor: (apply: (color: string) => void) => void;
  children: ReactNode;
}) {
  return <CoverColorContext.Provider value={{ palette, onSaveColor, onPickColor }}>{children}</CoverColorContext.Provider>;
}

function readRecentColors(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is string => typeof entry === "string" && Boolean(normalizeHex(entry))).slice(0, 10);
  } catch {
    return [];
  }
}

function rememberColor(value: string) {
  if (typeof window === "undefined") return;
  const normalized = normalizeHex(value);
  if (!normalized) return;
  try {
    const next = [normalized, ...readRecentColors().filter((entry) => entry !== normalized)].slice(0, 10);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Recent colours are a convenience, not a requirement.
  }
}

function HueWheel({ hsv, onChange }: { hsv: Hsv; onChange: (hue: number, saturation: number) => void }) {
  const wheelRef = useRef<HTMLDivElement>(null);
  const update = (clientX: number, clientY: number) => {
    const element = wheelRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const angle = (Math.atan2(clientY - centerY, clientX - centerX) * 180) / Math.PI;
    const saturation = clamp(Math.hypot(clientX - centerX, clientY - centerY) / (rect.width / 2), 0, 1);
    onChange(saturation > 0.01 ? (angle + 90 + 360) % 360 : hsv.h, saturation);
  };
  const thumbAngle = ((hsv.h - 90) * Math.PI) / 180;
  const radius = hsv.s * 47;
  return (
    <div
      ref={wheelRef}
      className="cover-color-wheel"
      role="slider"
      aria-label="Hue and saturation"
      aria-valuetext={`${Math.round(hsv.h)} degrees hue, ${Math.round(hsv.s * 100)}% saturation`}
      aria-valuemin={0}
      aria-valuemax={360}
      aria-valuenow={Math.round(hsv.h)}
      tabIndex={0}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        const element = wheelRef.current;
        if (element) element.dataset.dragging = "true";
        update(event.clientX, event.clientY);
      }}
      onPointerMove={(event) => {
        if (wheelRef.current?.dataset.dragging !== "true" || event.buttons !== 1) return;
        update(event.clientX, event.clientY);
      }}
      onPointerUp={(event) => {
        if (wheelRef.current) delete wheelRef.current.dataset.dragging;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={(event) => {
        if (wheelRef.current) delete wheelRef.current.dataset.dragging;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") { event.preventDefault(); onChange((hsv.h - 1 + 360) % 360, hsv.s); }
        if (event.key === "ArrowRight") { event.preventDefault(); onChange((hsv.h + 1) % 360, hsv.s); }
        if (event.key === "ArrowDown") { event.preventDefault(); onChange(hsv.h, clamp(hsv.s - 0.01, 0, 1)); }
        if (event.key === "ArrowUp") { event.preventDefault(); onChange(hsv.h, clamp(hsv.s + 0.01, 0, 1)); }
      }}
    >
      <span
        className="cover-color-wheel-thumb"
        style={{ left: `${50 + Math.cos(thumbAngle) * radius}%`, top: `${50 + Math.sin(thumbAngle) * radius}%` }}
      />
    </div>
  );
}

function SaturationValueArea({ hsv, onChange }: { hsv: Hsv; onChange: (saturation: number, value: number) => void }) {
  const areaRef = useRef<HTMLDivElement>(null);
  const update = (clientX: number, clientY: number) => {
    const element = areaRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    onChange(clamp((clientX - rect.left) / rect.width, 0, 1), clamp(1 - (clientY - rect.top) / rect.height, 0, 1));
  };
  return (
    <div
      ref={areaRef}
      className="cover-color-sv"
      role="slider"
      aria-label="Saturation and brightness"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(hsv.s * 100)}
      aria-valuetext={`${Math.round(hsv.s * 100)}% saturation, ${Math.round(hsv.v * 100)}% brightness`}
      tabIndex={0}
      style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent), hsl(${hsv.h} 100% 50%)` }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        const element = areaRef.current;
        if (element) element.dataset.dragging = "true";
        update(event.clientX, event.clientY);
      }}
      onPointerMove={(event) => {
        if (areaRef.current?.dataset.dragging !== "true" || event.buttons !== 1) return;
        update(event.clientX, event.clientY);
      }}
      onPointerUp={(event) => {
        if (areaRef.current) delete areaRef.current.dataset.dragging;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={(event) => {
        if (areaRef.current) delete areaRef.current.dataset.dragging;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onKeyDown={(event) => {
        const step = event.shiftKey ? 0.1 : 0.01;
        if (event.key === "ArrowLeft") { event.preventDefault(); onChange(clamp(hsv.s - step, 0, 1), hsv.v); }
        if (event.key === "ArrowRight") { event.preventDefault(); onChange(clamp(hsv.s + step, 0, 1), hsv.v); }
        if (event.key === "ArrowDown") { event.preventDefault(); onChange(hsv.s, clamp(hsv.v - step, 0, 1)); }
        if (event.key === "ArrowUp") { event.preventDefault(); onChange(hsv.s, clamp(hsv.v + step, 0, 1)); }
      }}
    >
      <span className="cover-color-sv-thumb" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: rgbaToHex({ ...hsvToRgb(hsv), a: 1 }) }} />
    </div>
  );
}

function NumberInput({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return (
    <label className="cover-color-number">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={Math.round(value)}
        onChange={(event) => {
          const next = Number.parseFloat(event.target.value);
          if (Number.isFinite(next)) onChange(clamp(next, min, max));
        }}
      />
    </label>
  );
}

function ColorPopover({ value, onChange, trigger, id, onClose }: { value: string; onChange: (value: string) => void; trigger: HTMLButtonElement | null; id: string; onClose: () => void }) {
  const { palette, onSaveColor, onPickColor } = useContext(CoverColorContext);
  const [position, setPosition] = useState({ left: 8, top: 52 });
  const initial = parseCoverColor(value);
  const [hsv, setHsv] = useState<Hsv>(() => rgbToHsv(initial));
  const [alpha, setAlpha] = useState(initial.a);
  const [hexDraft, setHexDraft] = useState(value);
  const [recent, setRecent] = useState<string[]>(() => readRecentColors());
  const lastEmitted = useRef(value.toLocaleLowerCase());
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value.toLocaleLowerCase() === lastEmitted.current) return;
    const next = parseCoverColor(value);
    setHsv(rgbToHsv(next));
    setAlpha(next.a);
    setHexDraft(value);
    lastEmitted.current = value.toLocaleLowerCase();
  }, [value]);

  useLayoutEffect(() => {
    const place = () => {
      if (!trigger || !popoverRef.current) return;
      const anchor = trigger.getBoundingClientRect();
      const rect = popoverRef.current.getBoundingClientRect();
      const left = clamp(anchor.right - rect.width, 8, Math.max(8, window.innerWidth - rect.width - 8));
      const below = anchor.bottom + 7;
      const preferred = below + rect.height <= window.innerHeight - 8 ? below : anchor.top - rect.height - 7;
      const top = clamp(preferred, 52, Math.max(52, window.innerHeight - rect.height - 8));
      setPosition((current) => current.left === left && current.top === top ? current : { left, top });
    };
    place();
    const observer = new ResizeObserver(place);
    if (popoverRef.current) observer.observe(popoverRef.current);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    popoverRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => { observer.disconnect(); window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [trigger]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (popoverRef.current?.contains(target)) return;
      if (trigger?.contains(target)) return;
      onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, trigger]);

  const emit = (nextHsv: Hsv, nextAlpha = alpha) => {
    const hex = rgbaToHex({ ...hsvToRgb(nextHsv), a: nextAlpha });
    lastEmitted.current = hex.toLocaleLowerCase();
    setHsv(nextHsv);
    setAlpha(nextAlpha);
    setHexDraft(hex);
    onChange(hex);
  };

  const setFromRgba = (patch: Partial<Rgba>) => {
    const next = { ...hsvToRgb(hsv), a: alpha, ...patch };
    emit(rgbToHsv(next), next.a);
  };

  const rgba = useMemo(() => ({ ...hsvToRgb(hsv), a: alpha }), [hsv, alpha]);
  const currentHex = rgbaToHex({ ...hsvToRgb(hsv), a: alpha });
  const commitHex = () => {
    const normalized = normalizeHex(hexDraft);
    if (!normalized) { setHexDraft(currentHex); return; }
    const parsed = parseCoverColor(normalized);
    emit(rgbToHsv(parsed), parsed.a);
    rememberColor(normalized);
  };

  return createPortal(
    <div
      ref={popoverRef}
      id={id}
      className="cover-color-popover"
      role="dialog"
      aria-label="Colour picker"
      style={{ left: position.left, top: position.top }}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") { event.preventDefault(); onClose(); }
        if (event.key === "Tab") {
          const items = popoverRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, [tabindex="0"]');
          const first = items?.[0];
          const last = items?.[items.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}
    >
      <div className="cover-color-popover-head">
        <span><strong>Colour</strong><small>HSV · RGB · alpha</small></span>
        <button type="button" onClick={() => { rememberColor(currentHex); onClose(); }} aria-label="Close colour picker"><X size={13} /></button>
      </div>
      <div className="cover-color-picker-layout">
        <HueWheel hsv={hsv} onChange={(hue, saturation) => emit({ ...hsv, h: hue, s: saturation })} />
        <SaturationValueArea hsv={hsv} onChange={(saturation, brightness) => emit({ ...hsv, s: saturation, v: brightness })} />
      </div>
      <div className="cover-color-numbers hsv">
        <NumberInput label="H" value={hsv.h} min={0} max={360} onChange={(hue) => emit({ ...hsv, h: hue })} />
        <NumberInput label="S" value={hsv.s * 100} min={0} max={100} onChange={(saturation) => emit({ ...hsv, s: saturation / 100 })} />
        <NumberInput label="V" value={hsv.v * 100} min={0} max={100} onChange={(brightness) => emit({ ...hsv, v: brightness / 100 })} />
      </div>
      <div className="cover-color-numbers rgb">
        <NumberInput label="R" value={rgba.r} min={0} max={255} onChange={(red) => setFromRgba({ r: red })} />
        <NumberInput label="G" value={rgba.g} min={0} max={255} onChange={(green) => setFromRgba({ g: green })} />
        <NumberInput label="B" value={rgba.b} min={0} max={255} onChange={(blue) => setFromRgba({ b: blue })} />
      </div>
      <label className="cover-color-alpha">
        <span>Alpha<small>{Math.round(alpha * 100)}%</small></span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={alpha}
          onChange={(event) => emit(hsv, Number(event.target.value))}
          style={{ background: `linear-gradient(to right, transparent, ${rgbaToHex({ ...hsvToRgb(hsv), a: 1 })})` }}
        />
      </label>
      <div className="cover-color-hex-row">
        <label><span>Hex</span><input aria-label="Colour hex" value={hexDraft} spellCheck={false} onChange={(event) => setHexDraft(event.target.value)} onBlur={commitHex} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commitHex(); } }} /></label>
        <span className={`cover-color-alpha-preview ${alpha < 1 ? "has-alpha" : ""}`} title="Current colour"><span style={{ background: currentHex }} /></span>
      </div>
      {(onSaveColor || onPickColor) && <div className="cover-color-tools">
        {onPickColor && <button type="button" onClick={() => { onPickColor(onChange); onClose(); }}><Pipette size={12} /> Sample cover</button>}
        {onSaveColor && <button type="button" onClick={() => { onSaveColor(currentHex); rememberColor(currentHex); }}><Palette size={12} /> Save colour</button>}
      </div>}
      {palette.length > 0 && <div className="cover-color-recent"><span><strong>Document colours</strong></span><div>{palette.map((entry) => <button key={entry} type="button" title={entry} aria-label={`Use document colour ${entry}`} style={{ background: entry }} onClick={() => { const parsed = parseCoverColor(entry); emit(rgbToHsv(parsed), parsed.a); }} />)}</div></div>}

      <div className="cover-color-recent">
        <span><strong>Recent</strong><button type="button" onClick={() => { setRecent([]); try { window.localStorage.removeItem(RECENT_KEY); } catch { /* noop */ } }}><RotateCcw size={10} /> Clear</button></span>
        <div>
          {recent.length === 0 ? <small>Colours you use will appear here.</small> : recent.map((entry) => (
            <button key={entry} type="button" title={entry} aria-label={`Use recent colour ${entry}`} style={{ background: entry }} onClick={() => {
              const parsed = parseCoverColor(entry);
              emit(rgbToHsv(parsed), parsed.a);
              rememberColor(entry);
            }} />
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function CoverColorTrigger({ value, onChange, label, compact = false }: { value: string; onChange: (value: string) => void; label: string; compact?: boolean }) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const id = useId();
  const closePicker = () => {
    rememberColor(value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`cover-color-trigger ${compact ? "compact" : ""}`}
        style={{ ["--cover-swatch" as string]: value }}
        aria-label={label}
        title={`${label} · ${value}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => { if (open) closePicker(); else setOpen(true); }}
      >
        <span style={{ background: value }} />
      </button>
      {open && <ColorPopover value={value} onChange={onChange} trigger={triggerRef.current} id={id} onClose={closePicker} />}
    </>
  );
}

export function CoverColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    const normalized = normalizeHex(draft);
    if (normalized) { onChange(normalized); rememberColor(normalized); setDraft(normalized); }
    else setDraft(value);
  };
  return (
    <div className="cover-color-field">
      <span>{label}</span>
      <span className="cover-color-input-wrap">
        <CoverColorTrigger value={value} onChange={onChange} label={`${label} colour`} />
        <input type="text" aria-label={`${label} hex value`} value={draft} spellCheck={false} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => {
          if (event.key === "Enter") { event.preventDefault(); commit(); }
          if (event.key === "Escape") { event.stopPropagation(); setDraft(value); }
        }} />
      </span>
    </div>
  );
}

export function CoverColorSwatch({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  return <CoverColorTrigger value={value} onChange={onChange} label={label} compact />;
}
