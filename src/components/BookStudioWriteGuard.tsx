import { useEffect } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { createBookStudioCloseHandler } from "../lib/bookStudioClose";
import { notify } from "../store/toast";

export function BookStudioWriteGuard() {
  useEffect(() => {
    if (!isTauri()) return;
    const window = getCurrentWindow();
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    const close = createBookStudioCloseHandler(
      async () => { if (!cancelled) await window.destroy(); },
      (error) => notify("error", "Close paused: Studio could not finish saving", `The window stayed open so you can retry. ${String(error)}`),
    );
    void window.onCloseRequested((event) => {
      if (cancelled) { event.preventDefault(); return; }
      return close(event);
    }).then((stop) => { if (cancelled) stop(); else unlisten = stop; })
      .catch((error) => { if (!cancelled) notify("error", "Studio save protection could not start", String(error)); });
    return () => { cancelled = true; unlisten?.(); };
  }, []);
  return null;
}
