import { createPortal } from "react-dom";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, Italic, Search, Type } from "lucide-react";
import { COVER_FONTS, type CoverFontId } from "../lib/bookCoverDoc";
import { FONT_OPTIONS, fontCss, normalizeFontFamily } from "../lib/fontFamilies";
import { loadSystemFontAssets, loadSystemFonts, systemFontFamilyDetails, type SystemFontAsset, type SystemFontAxis, type SystemFontFamilyDetails } from "../lib/systemFonts";

const CUSTOM_FONT_VALUE = "__noteme_custom_font__";
const PREVIEW_WEIGHTS = [300, 400, 500, 600, 700, 800, 900] as const;
type PreviewWeight = typeof PREVIEW_WEIGHTS[number];
type PreviewStyle = "normal" | "italic";

function sameFont(left: string, right: string) {
  return left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase();
}

export function useSystemFonts() {
  const [fonts, setFonts] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    void loadSystemFonts().then((next) => {
      if (active) setFonts(next);
    });
    return () => {
      active = false;
    };
  }, []);
  return fonts;
}

function useSystemFontCatalog() {
  const fonts = useSystemFonts();
  const [assets, setAssets] = useState<SystemFontAsset[]>([]);
  useEffect(() => {
    let active = true;
    void loadSystemFontAssets().then((next) => {
      if (active) setAssets(next);
    });
    return () => {
      active = false;
    };
  }, []);
  const familyDetails = useMemo(() => systemFontFamilyDetails(assets), [assets]);
  return { fonts, familyDetails };
}

function formatAxisNumber(value: number) {
  if (!Number.isFinite(value)) return "?";
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

function formatAxisSummary(axes: SystemFontAxis[]) {
  return axes
    .slice()
    .sort((left, right) => left.tag.localeCompare(right.tag))
    .map((axis) => `${axis.tag.toLowerCase()} ${formatAxisNumber(axis.min)}–${formatAxisNumber(axis.max)}`)
    .join(" · ");
}

function installedFontMeta(details: SystemFontFamilyDetails | undefined) {
  if (!details) return "Installed";
  const faces = `${details.faceCount} face${details.faceCount === 1 ? "" : "s"}`;
  return details.axes.length > 0 ? `Installed · variable · ${faces}` : `Installed · ${faces}`;
}

function installedFontOption(value: string, family: string, details: SystemFontFamilyDetails | undefined): FontPickerOption {
  return {
    value,
    label: family,
    css: fontCss(family),
    group: "Installed on this computer",
    meta: installedFontMeta(details),
    axisSummary: details ? formatAxisSummary(details.axes) : undefined,
  };
}

export function InstalledFontInput({
  value,
  onChange,
  maxLength = 200,
  placeholder = "e.g. Baskerville, Georgia, serif",
  ariaLabel = "Installed font or fallback stack",
  showHint = true,
}: {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  placeholder?: string;
  ariaLabel?: string;
  showHint?: boolean;
}) {
  const fonts = useSystemFonts();
  const id = `noteme-installed-fonts-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <span className="system-font-input">
      <input
        list={fonts.length > 0 ? id : undefined}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(event) => onChange(normalizeFontFamily(event.target.value, maxLength))}
      />
      {fonts.length > 0 && <datalist id={id}>{fonts.map((font) => <option key={font} value={font} />)}</datalist>}
      {showHint && <small className="system-font-hint">{fonts.length > 0 ? `${fonts.length} installed families available` : "Type an installed family or fallback stack"}</small>}
    </span>
  );
}

interface FontPickerOption {
  value: string;
  label: string;
  css: string;
  group: string;
  meta?: string;
  axisSummary?: string;
}

interface FontPickerMenuProps {
  value: string;
  options: FontPickerOption[];
  onSelect: (value: string) => void;
  customValue?: string;
  customLabel?: string;
  customCss?: string;
  customMeta?: string;
  ariaLabel: string;
}

function optionMatches(option: FontPickerOption, value: string) {
  return option.value === value || sameFont(option.label, value);
}

function FontPickerMenu({
  value,
  options,
  onSelect,
  customValue,
  customLabel = "Custom font stack…",
  customCss,
  customMeta = "Saved",
  ariaLabel,
}: FontPickerMenuProps) {
  const pickerId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [previewWeight, setPreviewWeight] = useState<PreviewWeight>(400);
  const [previewStyle, setPreviewStyle] = useState<PreviewStyle>("normal");
  const [position, setPosition] = useState({ top: 0, left: 0, width: 440 });

  const allOptions = useMemo(() => (
    customValue ? [...options, { value: customValue, label: customLabel, css: customCss || fontCss(value), group: "Custom", meta: customMeta }] : options
  ), [customCss, customLabel, customMeta, customValue, options, value]);
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return allOptions;
    return allOptions.filter((option) => `${option.label} ${option.group} ${option.meta || ""}`.toLocaleLowerCase().includes(normalizedQuery));
  }, [allOptions, query]);
  const selectedOption = allOptions.find((option) => optionMatches(option, value));
  const selectedLabel = selectedOption?.label || (value ? value.split(",")[0].trim() : "Choose a typeface");
  const selectedCss = selectedOption?.css || fontCss(value);
  const listId = `noteme-font-list-${pickerId}`;

  const updatePosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(460, Math.max(280, window.innerWidth - 24));
    const maxHeight = Math.min(560, Math.max(260, window.innerHeight - 24));
    const left = Math.min(Math.max(12, rect.left), Math.max(12, window.innerWidth - width - 12));
    const below = rect.bottom + 8;
    const top = below + maxHeight <= window.innerHeight - 12 ? below : Math.max(12, rect.top - maxHeight - 8);
    setPosition({ top, left, width });
  };

  useEffect(() => {
    if (!open) return;
    updatePosition();
    setQuery("");
    const currentIndex = allOptions.findIndex((option) => optionMatches(option, value));
    setActiveIndex(Math.max(0, currentIndex));
    const frame = window.requestAnimationFrame(() => searchRef.current?.focus());
    const onResize = () => updatePosition();
    const onScroll = () => updatePosition();
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [allOptions, open, value]);

  useEffect(() => {
    if (!open) return;
    const selectedIndex = filteredOptions.findIndex((option) => optionMatches(option, value));
    setActiveIndex((current) => Math.min(current, Math.max(0, filteredOptions.length - 1)) || Math.max(0, selectedIndex));
  }, [filteredOptions, open, value]);

  const selectOption = (option: FontPickerOption) => {
    onSelect(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const moveActive = (delta: number) => {
    if (filteredOptions.length === 0) return;
    setActiveIndex((current) => {
      const next = (current + delta + filteredOptions.length) % filteredOptions.length;
      window.requestAnimationFrame(() => document.getElementById(`${listId}-${next}`)?.scrollIntoView({ block: "nearest" }));
      return next;
    });
  };

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActive(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(Math.max(0, filteredOptions.length - 1));
    } else if ((event.key === "Enter" || event.key === " ") && filteredOptions[activeIndex]) {
      event.preventDefault();
      selectOption(filteredOptions[activeIndex]);
    }
  };

  const groups = useMemo(() => {
    const grouped = new Map<string, FontPickerOption[]>();
    filteredOptions.forEach((option) => grouped.set(option.group, [...(grouped.get(option.group) || []), option]));
    return [...grouped.entries()];
  }, [filteredOptions]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`system-font-trigger${open ? " open" : ""}`}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span className="system-font-trigger-copy">
          <strong>{selectedLabel}</strong>
          <small>{selectedOption?.meta || (value ? "Selected family" : "Choose from presets or installed families")}</small>
        </span>
        <span className="system-font-trigger-preview" style={{ fontFamily: selectedCss }}>Sample</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && createPortal(
        <div
          ref={popoverRef}
          id={listId}
          className="system-font-popover"
          role="dialog"
          aria-label={`${ariaLabel} picker`}
          style={{ top: position.top, left: position.left, width: position.width }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="system-font-popover-head">
            <div>
              <strong>Choose a typeface</strong>
              <small>Preview every family before applying it.</small>
            </div>
            <span className="system-font-popover-count">{filteredOptions.length}</span>
          </div>
          <div className="system-font-preview-controls" aria-label="Typeface preview controls">
            <span className="system-font-preview-kicker"><Type size={12} aria-hidden="true" /> Preview</span>
            <label className="system-font-preview-control">
              <span>Weight</span>
              <select aria-label="Preview weight" value={previewWeight} onChange={(event) => setPreviewWeight(Number(event.target.value) as PreviewWeight)}>
                {PREVIEW_WEIGHTS.map((weight) => <option key={weight} value={weight}>{weight}</option>)}
              </select>
            </label>
            <button
              type="button"
              className={`system-font-preview-italic${previewStyle === "italic" ? " active" : ""}`}
              aria-pressed={previewStyle === "italic"}
              onClick={() => setPreviewStyle((current) => current === "italic" ? "normal" : "italic")}
            >
              <Italic size={12} aria-hidden="true" /> Italic
            </button>
          </div>
          <label className="system-font-search">
            <Search size={14} aria-hidden="true" />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleMenuKeyDown}
              placeholder="Search families…"
              aria-label="Search font families"
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={filteredOptions[activeIndex] ? `${listId}-${activeIndex}` : undefined}
            />
          </label>
          <div className="system-font-list" role="listbox" aria-label="Font families">
            {groups.length > 0 ? groups.map(([group, groupOptions]) => (
              <div key={group} className="system-font-group" role="group" aria-label={group}>
                <div className="system-font-group-label">{group}<span>{groupOptions.length}</span></div>
                {groupOptions.map((option) => {
                  const index = filteredOptions.indexOf(option);
                  const selected = optionMatches(option, value);
                  return (
                    <button
                      key={`${option.value}-${option.label}`}
                      id={`${listId}-${index}`}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      aria-label={`${option.label}${option.meta ? `, ${option.meta}` : ""}${option.axisSummary ? `, ${option.axisSummary}` : ""}`}
                      className={`system-font-option${selected ? " active" : ""}${index === activeIndex ? " focused" : ""}`}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => selectOption(option)}
                    >
                      <span className="system-font-option-name">
                        <strong>{option.label}</strong>
                        {option.meta && <small>{option.meta}</small>}
                        {option.axisSummary && <span className="system-font-axis-summary">{option.axisSummary}</span>}
                      </span>
                      <span className="system-font-option-preview" style={{ fontFamily: option.css, fontStyle: previewStyle, fontWeight: previewWeight }}>Sample</span>
                      <span className="system-font-option-mark" aria-hidden="true">{selected ? <Check size={15} /> : <Type size={15} />}</span>
                    </button>
                  );
                })}
              </div>
            )) : <p className="system-font-empty">No font families match “{query}”.</p>}
          </div>
          <div className="system-font-popover-foot"><Type size={12} /> Samples use the actual family when it is installed.</div>
        </div>,
        document.body,
      )}
    </>
  );
}

export function FontPicker({
  value,
  onChange,
  customPlaceholder = "e.g. Baskerville, Georgia, serif",
  customAriaLabel = "Custom font family or fallback stack",
}: {
  value: string;
  onChange: (value: string) => void;
  customPlaceholder?: string;
  customAriaLabel?: string;
}) {
  const { fonts, familyDetails } = useSystemFontCatalog();
  const isPreset = FONT_OPTIONS.some((option) => option.value === value);
  const installed = fonts.find((font) => sameFont(font, value));
  const isCustom = !isPreset && !installed;
  const selectValue = isCustom ? CUSTOM_FONT_VALUE : installed ?? value;
  const options = useMemo<FontPickerOption[]>(() => [
    ...FONT_OPTIONS.map((option) => ({ ...option, group: "NoteMe presets", meta: "Preset" })),
    ...fonts.map((font) => installedFontOption(font, font, familyDetails.get(font.toLocaleLowerCase()))),
  ], [familyDetails, fonts]);

  return (
    <span className="system-font-picker">
      <FontPickerMenu
        value={selectValue}
        options={options}
        customValue={CUSTOM_FONT_VALUE}
        customLabel={isCustom ? "Saved custom stack" : "Custom font stack…"}
        customCss={fontCss(value)}
        customMeta={isCustom ? "Custom stack" : "Fallback stack"}
        ariaLabel="Font family"
        onSelect={(nextValue) => {
          if (nextValue === CUSTOM_FONT_VALUE) {
            if (!isCustom) onChange("");
            return;
          }
          onChange(nextValue);
        }}
      />
      {isCustom && <InstalledFontInput value={value} onChange={onChange} placeholder={customPlaceholder} ariaLabel={customAriaLabel} />}
    </span>
  );
}

export function CoverFontPicker({
  fontFamily,
  customFont,
  onChange,
}: {
  fontFamily: CoverFontId;
  customFont: string;
  onChange: (patch: { fontFamily?: CoverFontId; customFont?: string }) => void;
}) {
  const { fonts, familyDetails } = useSystemFontCatalog();
  const installed = fonts.find((font) => sameFont(font, customFont));
  const customValue = installed ? `system:${installed}` : customFont ? CUSTOM_FONT_VALUE : "";
  const options = useMemo<FontPickerOption[]>(() => [
    ...COVER_FONTS.map((font) => ({ value: font.id, label: font.label, css: font.css, group: font.group, meta: "Cover preset" })),
    ...fonts.map((font) => installedFontOption(`system:${font}`, font, familyDetails.get(font.toLocaleLowerCase()))),
  ], [familyDetails, fonts]);
  const selectedValue = customValue || fontFamily;

  return (
    <span className="system-font-picker cover-font-picker">
      <FontPickerMenu
        value={selectedValue}
        options={options}
        customValue={customFont && !installed ? CUSTOM_FONT_VALUE : undefined}
        customLabel="Saved installed font"
        customCss={fontCss(customFont)}
        customMeta="Saved custom family"
        ariaLabel="Cover typeface"
        onSelect={(nextValue) => {
          if (nextValue.startsWith("system:")) {
            onChange({ customFont: nextValue.slice("system:".length) });
          } else if (nextValue === CUSTOM_FONT_VALUE) {
            if (!customFont) onChange({ customFont: "" });
          } else {
            onChange({ fontFamily: nextValue as CoverFontId, customFont: "" });
          }
        }}
      />
    </span>
  );
}
