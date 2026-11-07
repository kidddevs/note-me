import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Check, ImagePlus, Images, LoaderCircle, Save, Search, ShieldCheck, Star, Trash2, Upload, X } from "lucide-react";
import {
  deleteCoverImageAsset, filterCoverImageAssets, IMAGE_LIBRARY_CHANGED, listCoverImageAssets,
  MAX_COVER_IMAGE_ASSETS, prepareCoverImageAsset, readBookImageFile, readPortableBookImageSource, saveCoverImageAsset, updateCoverImageAsset,
  type CoverImageAsset, type CoverImageInput, type CoverImageDetailsPatch, type CoverImageOrientation,
} from "../lib/bookImageLibrary";
import { notify } from "../store/toast";

type DetailsDraft = { name: string; alt: string; credit: string; license: string; tags: string };
const draftFor = (asset: CoverImageAsset): DetailsDraft => ({ name: asset.name, alt: asset.alt, credit: asset.credit, license: asset.license, tags: asset.tags.join(", ") });

/** One local photo collection shared by manuscript artwork and cover frames. */
export function BookImageLibrary({ onClose, onUse, onUseBackground, actionLabel = "Place image" }: {
  onClose: () => void;
  onUse: (asset: CoverImageAsset) => void;
  onUseBackground?: (asset: CoverImageAsset) => void;
  actionLabel?: string;
}) {
  const [assets, setAssets] = useState<CoverImageAsset[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DetailsDraft | null>(null);
  const [query, setQuery] = useState("");
  const [orientation, setOrientation] = useState<CoverImageOrientation>("all");
  const [favorites, setFavorites] = useState(false);
  const [busy, setBusy] = useState("loading");
  const [error, setError] = useState("");
  const [pendingUpload, setPendingUpload] = useState<CoverImageInput | null>(null);
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const selected = assets.find((asset) => asset.id === selectedId) ?? null;
  const filtered = filterCoverImageAssets(assets, query, orientation, favorites);
  const dirty = selected && draft && JSON.stringify(draftFor(selected)) !== JSON.stringify(draft);

  useEffect(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    let active = true;
    const refresh = () => void listCoverImageAssets().then((next) => { if (active) setAssets(next); });
    void listCoverImageAssets().then((next) => {
      if (!active) return;
      setAssets(next); setBusy("");
      if (next[0]) { setSelectedId(next[0].id); setDraft(draftFor(next[0])); }
      searchRef.current?.focus();
    });
    window.addEventListener(IMAGE_LIBRARY_CHANGED, refresh);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.removeEventListener(IMAGE_LIBRARY_CHANGED, refresh);
      window.removeEventListener("focus", refresh);
      if (trigger?.isConnected) trigger.focus();
    };
  }, []);

  const run = async (action: () => Promise<void>, label = "saving") => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(label); setError(""); setPendingUpload(null);
    try { await action(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { busyRef.current = false; setBusy(""); }
  };

  const saveDetails = async () => {
    if (!selected || !draft || !dirty) return selected;
    const patch: CoverImageDetailsPatch = { ...draft, tags: draft.tags.split(",").map((tag) => tag.trim()).filter(Boolean) };
    const saved = await updateCoverImageAsset(selected.id, patch);
    if (!saved) throw new Error("Image details could not be saved. Your draft is still here.");
    setAssets((current) => current.map((asset) => asset.id === saved.id ? saved : asset));
    setDraft(draftFor(saved));
    return saved;
  };

  const close = () => void run(async () => { await saveDetails(); onClose(); });
  const select = (asset: CoverImageAsset) => void run(async () => {
    await saveDetails(); setSelectedId(asset.id); setDraft(draftFor(asset)); setConfirmRemoval(false);
  });
  const place = (background = false) => void run(async () => {
    const asset = await saveDetails();
    if (!asset) return;
    (background ? onUseBackground : onUse)?.(asset);
    onClose();
  });
  const upload = (file: File | undefined) => {
    if (!file) return;
    void run(async () => {
      await saveDetails();
      const input = await readBookImageFile(file);
      const saved = await saveCoverImageAsset(input);
      if (!saved) {
        setPendingUpload(input);
        setError(`The library copy could not be saved. It holds ${MAX_COVER_IMAGE_ASSETS} images; existing copies have been kept. You can still place this image directly.`);
        return;
      }
      setPendingUpload(null);
      setAssets(await listCoverImageAssets()); setSelectedId(saved.id); setDraft(draftFor(saved));
      setQuery(""); setOrientation("all"); setFavorites(false); setConfirmRemoval(false);
    }, "uploading");
  };
  const remove = () => void run(async () => {
    if (!selected || !await deleteCoverImageAsset(selected.id)) throw new Error("The library image could not be removed.");
    const next = assets.filter((asset) => asset.id !== selected.id);
    setAssets(next); setSelectedId(next[0]?.id ?? null); setDraft(next[0] ? draftFor(next[0]) : null); setConfirmRemoval(false);
  }, "removing");
  const toggleFavorite = () => void run(async () => {
    const asset = await saveDetails();
    if (!asset) return;
    const saved = await updateCoverImageAsset(asset.id, { favorite: !asset.favorite });
    if (!saved) throw new Error("The favorite could not be saved.");
    setAssets((current) => current.map((item) => item.id === saved.id ? saved : item));
  });

  return createPortal(
    <div className="studio-images-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) close(); }}>
      <section ref={dialogRef} className="studio-images-dialog" role="dialog" aria-modal="true" aria-labelledby="studio-images-title" aria-busy={Boolean(busy)} onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") { event.preventDefault(); if (!busy) { if (confirmRemoval) setConfirmRemoval(false); else close(); } }
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") { event.preventDefault(); void run(async () => { await saveDetails(); }); }
        if (event.key !== "Tab") return;
        const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex='0']") ?? []).filter((item) => item.getClientRects().length);
        const first = items[0], last = items[items.length - 1];
        if (!first) return;
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}>
        <header className="studio-images-head">
          <div><span className="books-eyebrow"><Images size={13} /> Shared artwork</span><h2 id="studio-images-title">Studio image library</h2><p>Keep photos ready for your pages and covers.</p></div>
          <button type="button" onClick={close} disabled={Boolean(busy)} aria-label="Close image library"><X size={18} /></button>
        </header>
        <div className="studio-images-toolbar">
          <label className="studio-images-search"><Search size={15} /><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search names, tags or credits" aria-label="Search studio images" />{query && <button type="button" onClick={() => setQuery("")} aria-label="Clear image search"><X size={13} /></button>}</label>
          <select aria-label="Image orientation" value={orientation} onChange={(event) => setOrientation(event.target.value as CoverImageOrientation)}><option value="all">All shapes</option><option value="landscape">Landscape</option><option value="portrait">Portrait</option><option value="square">Square</option></select>
          <button type="button" className={favorites ? "active" : ""} onClick={() => setFavorites((value) => !value)} aria-pressed={favorites} aria-label="Show favorite images" title="Show favorites"><Star size={15} fill={favorites ? "currentColor" : "none"} /></button>
          <button type="button" className="studio-images-upload" onClick={() => uploadRef.current?.click()} disabled={Boolean(busy)}>{busy === "uploading" ? <LoaderCircle size={14} className="cover-tool-busy" /> : <Upload size={14} />}<span>{busy === "uploading" ? "Reading image" : "Add image"}</span></button>
          <input ref={uploadRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml" hidden onChange={(event) => { upload(event.target.files?.[0]); event.target.value = ""; }} />
        </div>
        {error && <div className="studio-images-error" role="alert"><AlertTriangle size={15} /><span>{error}</span>{pendingUpload && <button type="button" disabled={Boolean(busy)} onClick={() => {
          const transient = prepareCoverImageAsset(pendingUpload, [], new Date(), "unsaved-studio-image");
          if (transient) { onUse(transient); onClose(); }
        }}><ImagePlus size={13} /> Place without library copy</button>}<button type="button" onClick={onClose}>{dirty ? "Close without saving details" : "Close library"}</button></div>}
        <div className="studio-images-body">
          <div className="studio-images-collection">
            <div className="studio-images-count"><span>{filtered.length} {filtered.length === 1 ? "image" : "images"}{favorites ? " in favorites" : ""}</span><small>{assets.length} / {MAX_COVER_IMAGE_ASSETS} saved locally</small></div>
            <div className="studio-images-grid" role="group" aria-label="Saved studio images">
              {filtered.map((asset) => <button type="button" key={asset.id} className={`studio-image-card ${selectedId === asset.id ? "selected" : ""}`} aria-pressed={selectedId === asset.id} aria-label={`View ${asset.name}`} onClick={() => select(asset)} disabled={Boolean(busy)}><span className="studio-image-card-photo"><img src={asset.src} alt="" loading="lazy" draggable={false} />{asset.favorite && <Star size={13} fill="currentColor" />}{selectedId === asset.id && <Check className="studio-image-selected" size={14} />}</span><strong>{asset.name}</strong><small>{asset.width && asset.height ? `${asset.width.toLocaleString()} × ${asset.height.toLocaleString()}` : "Original image"}</small></button>)}
            </div>
            {!filtered.length && <div className="studio-images-empty">{busy === "loading" ? <LoaderCircle size={28} className="cover-tool-busy" /> : <Images size={30} />}<strong>{assets.length ? "No matching images" : "Your photo shelf starts here"}</strong><p>{assets.length ? "Try another search or shape filter." : "Add an image once, then reuse it in manuscript pages, cover layers and backgrounds."}</p></div>}
          </div>
          {selected && draft && <aside className="studio-image-details">
            <div className="studio-image-detail-photo"><img src={selected.src} alt={draft.alt} /></div>
            <div className="studio-image-detail-top"><span>Image details</span><button type="button" disabled={Boolean(busy)} onClick={toggleFavorite} aria-pressed={selected.favorite} aria-label={selected.favorite ? "Unfavorite image" : "Favorite image"}><Star size={14} fill={selected.favorite ? "currentColor" : "none"} /></button></div>
            <form onSubmit={(event) => { event.preventDefault(); void run(async () => { await saveDetails(); }); }}>
              {([['name', 'Name', 80], ['alt', 'Alt text', 500], ['credit', 'Photo credit', 240], ['license', 'License / source notes', 500], ['tags', 'Tags, separated by commas', 420]] as const).map(([key, label, maxLength]) => <label key={key}><span>{label}</span><input value={draft[key]} maxLength={maxLength} disabled={Boolean(busy)} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} /></label>)}
              <button type="submit" className="studio-image-save" disabled={!dirty || Boolean(busy)}>{busy === "saving" ? <LoaderCircle size={13} className="cover-tool-busy" /> : dirty ? <Save size={13} /> : <Check size={13} />}{dirty ? "Save details" : "Details saved"}</button>
            </form>
            <p className="studio-image-details-note">Details travel with new placements. Existing pages and covers keep their own copy.</p>
            {confirmRemoval ? <div className="studio-image-remove-confirm" role="alert"><strong>Remove this library copy?</strong><p>Images already placed in your books and covers will stay.</p><div><button type="button" onClick={() => setConfirmRemoval(false)} disabled={Boolean(busy)}>Keep image</button><button type="button" className="danger" onClick={remove} disabled={Boolean(busy)}><Trash2 size={12} /> Remove</button></div></div> : <button type="button" className="studio-image-remove" onClick={() => setConfirmRemoval(true)} disabled={Boolean(busy)}><Trash2 size={12} /> Remove from library</button>}
          </aside>}
        </div>
        <footer className="studio-images-footer"><span><ShieldCheck size={13} /> On this device</span><div>{onUseBackground && <button type="button" onClick={() => place(true)} disabled={!selected || Boolean(busy)}><ImagePlus size={14} /> Use as background</button>}<button type="button" className="studio-image-place" onClick={() => place()} disabled={!selected || Boolean(busy)}><ImagePlus size={14} /> {actionLabel}</button></div></footer>
      </section>
    </div>, document.body,
  );
}


/** Save the source, without baking the frame crop or effects into the shared original. */
export function SaveStudioImageButton({ image, className = "books-shared-image-button" }: {
  image: Pick<CoverImageInput, "name" | "src" | "alt" | "credit" | "license">;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const source = await readPortableBookImageSource(image.src);
      const saved = await saveCoverImageAsset({ ...image, ...source });
      if (!saved) throw new Error("The library may be full or local storage unavailable.");
      notify("success", "Image saved to studio library", "Reuse this source in manuscript pages, cover layers and backgrounds.");
    } catch (error) { notify("error", "Image could not be saved", String(error)); }
    finally { setBusy(false); }
  };
  return <button type="button" className={className} onClick={() => void save()} disabled={busy || !image.src}>{busy ? <LoaderCircle size={13} className="cover-tool-busy" /> : <Images size={13} />} {busy ? "Saving image" : "Save image to studio library"}</button>;
}
