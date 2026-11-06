import { BookOpen, Check, ChevronDown, StickyNote } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useWorkspace, type WorkspaceMode } from "../store/workspace";

const WORKSPACES: {
  id: WorkspaceMode;
  title: string;
  subtitle: string;
  Icon: typeof StickyNote;
}[] = [
  { id: "notes", title: "NoteMe", subtitle: "Notes & tasks", Icon: StickyNote },
  { id: "books", title: "Books Studio", subtitle: "Long-form writing", Icon: BookOpen },
];

export function WorkspaceSwitcher() {
  const mode = useWorkspace((state) => state.mode);
  const setMode = useWorkspace((state) => state.setMode);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const current = WORKSPACES.find((workspace) => workspace.id === mode) ?? WORKSPACES[0];
  const Mark = current.Icon;

  const openMenu = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({ top: rect.bottom + 6, left: rect.left, width: Math.max(232, rect.width) });
    setOpen(true);
  };

  const closeMenu = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) requestAnimationFrame(() => buttonRef.current?.focus());
  };

  const choose = (next: WorkspaceMode) => {
    closeMenu();
    if (next !== mode) setMode(next);
  };

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => menuRef.current?.querySelector<HTMLButtonElement>("[aria-checked='true']")?.focus());
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu(true);
        return;
      }
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>("[role='menuitemradio']") ?? []);
      if (items.length === 0) return;
      event.preventDefault();
      const currentIndex = Math.max(0, items.indexOf(document.activeElement as HTMLButtonElement));
      const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (currentIndex + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items[nextIndex].focus();
    };
    const onResize = () => setOpen(false);
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`workspace-switcher ${open ? "open" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        title={`Switch workspace · ${current.title}`}
        onClick={() => { if (open) closeMenu(); else openMenu(); }}
      >
        <span className={`workspace-switcher-mark ${current.id}`} aria-hidden="true"><Mark size={17} /></span>
        <span className="workspace-switcher-copy"><strong>{current.title}</strong><small>{current.subtitle}</small></span>
        <ChevronDown className="workspace-switcher-chevron" size={14} aria-hidden="true" />
      </button>
      {open && position && createPortal(
        <div
          ref={menuRef}
          className="workspace-switcher-menu"
          role="menu"
          aria-label="Switch workspace"
          style={{ top: position.top, left: position.left, width: position.width }}
        >
          <div className="workspace-switcher-menu-head">Switch workspace</div>
          {WORKSPACES.map((workspace) => {
            const OptionMark = workspace.Icon;
            const active = workspace.id === mode;
            return (
              <button
                key={workspace.id}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                className={`workspace-switcher-option ${active ? "active" : ""}`}
                onClick={() => choose(workspace.id)}
              >
                <span className={`workspace-switcher-mark small ${workspace.id}`} aria-hidden="true"><OptionMark size={15} /></span>
                <span className="workspace-switcher-option-copy"><strong>{workspace.title}</strong><small>{workspace.subtitle}</small></span>
                {active && <Check size={14} className="workspace-switcher-check" aria-hidden="true" />}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
}
