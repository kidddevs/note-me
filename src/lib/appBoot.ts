export const WELCOME_SEEN_VERSION_KEY = "app.welcomeSeenVersion";
export const RELEASE_NOTES_SEEN_VERSION_KEY = "app.releaseNotesSeenVersion";

export type BootSurface = "welcome" | "release-notes" | "ready";

export interface BootSurfaceDecision {
  surface: BootSurface;
  releasePending: boolean;
}

/**
 * Keep the first-run and release-note gate deterministic and separate from the
 * native settings transport so it can be checked without opening the database.
 */
export function bootSurfaceForSettings(
  welcomeSeenVersion: string | null,
  releaseNotesSeenVersion: string | null,
  currentVersion: string,
): BootSurfaceDecision {
  const releasePending = releaseNotesSeenVersion !== currentVersion;
  if (!welcomeSeenVersion) return { surface: "welcome", releasePending };
  return { surface: releasePending ? "release-notes" : "ready", releasePending };
}
