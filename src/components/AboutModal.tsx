import { useEffect, useState } from "react";
import {
  Check,
  Download,
  ExternalLink,
  Info,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import packageJson from "../../package.json";

const CURRENT_VERSION = packageJson.version;
const RELEASE_API_URL = "https://api.github.com/repos/kidddevs/note-me/releases/latest";
const RELEASES_URL = "https://github.com/kidddevs/note-me/releases/latest";

type ReleaseAsset = {
  name: string;
  browser_download_url: string;
};

type GithubRelease = {
  tag_name: string;
  name?: string;
  html_url: string;
  body?: string;
  published_at?: string;
  assets?: ReleaseAsset[];
};

type UpdateStatus = "idle" | "checking" | "current" | "available" | "error";

function versionParts(version: string) {
  return version
    .replace(/^v/i, "")
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);
}

function isNewerVersion(latest: string, current: string) {
  const latestParts = versionParts(latest);
  const currentParts = versionParts(current);
  for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
    if ((latestParts[i] ?? 0) !== (currentParts[i] ?? 0)) {
      return (latestParts[i] ?? 0) > (currentParts[i] ?? 0);
    }
  }
  return false;
}

function releaseDownloadUrl(release: GithubRelease) {
  const assets = release.assets ?? [];
  const macAsset = assets.find((asset) =>
    /\.dmg$/i.test(asset.name) && /(aarch64|arm64|apple|mac)/i.test(asset.name),
  );
  return macAsset?.browser_download_url ?? assets.find((asset) => /\.dmg$/i.test(asset.name))?.browser_download_url ?? release.html_url;
}

async function openExternal(url: string) {
  try {
    await openUrl(url);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

function formatReleaseDate(value?: string) {
  if (!value) return "Latest release";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function AboutModal({
  onClose,
  autoCheckKey = 0,
}: {
  onClose: () => void;
  autoCheckKey?: number;
}) {
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [release, setRelease] = useState<GithubRelease | null>(null);

  const checkForUpdates = async () => {
    setStatus("checking");
    setRelease(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(RELEASE_API_URL, {
        headers: { Accept: "application/vnd.github+json" },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Update check failed (${response.status})`);

      const nextRelease = (await response.json()) as GithubRelease;
      if (!nextRelease.tag_name || !nextRelease.html_url) {
        throw new Error("Invalid release response");
      }
      setRelease(nextRelease);
      setStatus(isNewerVersion(nextRelease.tag_name, CURRENT_VERSION) ? "available" : "current");
    } catch {
      setStatus("error");
    } finally {
      window.clearTimeout(timeout);
    }
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (autoCheckKey > 0) void checkForUpdates();
  }, [autoCheckKey]);

  const downloadUrl = release ? releaseDownloadUrl(release) : "";
  const latestVersion = release?.tag_name.replace(/^v/i, "") ?? "";

  return (
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal about-modal" role="dialog" aria-modal="true" aria-labelledby="about-noteme-title">
        <div className="modal-header">
          <Info size={16} color="var(--accent)" />
          <h3 id="about-noteme-title">About NoteMe</h3>
          <button className="icon-btn" onClick={onClose} title="Close (Esc)" aria-label="Close">
            <X size={14} />
          </button>
        </div>

        <div className="modal-body about-modal-body">
          <section className="about-card about-identity-card">
            <div className="about-app-icon" aria-hidden="true">
              <span>N</span>
            </div>
            <div className="about-identity-copy">
              <h4>NoteMe</h4>
              <p>Local-first notes, thoughtfully made for your desktop.</p>
              <span className="about-version-pill">Version {CURRENT_VERSION}</span>
            </div>
          </section>

          <section className="about-card">
            <div className="about-card-heading">
              <div className="about-card-icon"><ShieldCheck size={15} /></div>
              <div>
                <h4>Private by design</h4>
                <p>Your notes stay on this device.</p>
              </div>
            </div>
            <p className="about-card-copy">
              NoteMe stores notes locally in SQLite. No account, cloud sync, or telemetry is required.
            </p>
          </section>

          <section className="about-card about-update-card">
            <div className="about-card-heading">
              <div className="about-card-icon"><RefreshCw size={15} /></div>
              <div>
                <h4>Check for Updates</h4>
                <p>Stay current with the latest NoteMe release.</p>
              </div>
            </div>

            <div className={`update-status update-status-${status}`}>
              {status === "checking" && <LoaderCircle size={14} className="spin" />}
              {status === "current" && <Check size={14} />}
              <span>
                {status === "idle" && "No update check has run yet."}
                {status === "checking" && "Checking for updates…"}
                {status === "current" && `You're up to date on version ${CURRENT_VERSION}.`}
                {status === "available" && `Version ${latestVersion} is ready to download.`}
                {status === "error" && "Could not reach the update service right now."}
              </span>
            </div>

            <div className="about-update-actions">
              <button className="btn primary small" onClick={() => void checkForUpdates()} disabled={status === "checking"}>
                {status === "checking" ? <LoaderCircle size={14} className="spin" /> : <RefreshCw size={14} />}
                {status === "checking" ? "Checking…" : "Check Now"}
              </button>
              <button className="btn small" onClick={() => void openExternal(RELEASES_URL)}>
                <ExternalLink size={14} /> Release Notes
              </button>
            </div>
          </section>

          {status === "available" && release && (
            <section className="about-card update-download-card">
              <div className="about-card-heading">
                <div className="about-card-icon update-download-icon"><Download size={15} /></div>
                <div>
                  <h4>Update available</h4>
                  <p>{release.name || `NoteMe ${latestVersion}`} · {formatReleaseDate(release.published_at)}</p>
                </div>
              </div>
              {release.body && (
                <p className="about-card-copy update-release-notes">{release.body.split("\n")[0]}</p>
              )}
              <button className="btn primary small update-download-button" onClick={() => void openExternal(downloadUrl)}>
                <Download size={14} /> Download Update
              </button>
            </section>
          )}
        </div>

        <div className="modal-footer about-modal-footer">
          <span>Built for focused, local-first work.</span>
          <button className="btn small" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
