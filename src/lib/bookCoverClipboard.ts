import type { CoverLayer } from "./bookCoverDoc";

export const MAX_CLIPBOARD_LAYERS = 120;

let layerClipboard: CoverLayer[] = [];

function cloneLayers(layers: CoverLayer[]) {
  return JSON.parse(JSON.stringify(layers)) as CoverLayer[];
}

/** Clones on write so later layer edits can never mutate the clipboard. */
export function setCoverLayerClipboard(layers: CoverLayer[]) {
  layerClipboard = cloneLayers(layers.slice(0, MAX_CLIPBOARD_LAYERS));
}

export function getCoverLayerClipboard(): CoverLayer[] {
  return cloneLayers(layerClipboard);
}

export function hasCoverLayerClipboard() {
  return layerClipboard.length > 0;
}

export function clearCoverLayerClipboard() {
  layerClipboard = [];
}
