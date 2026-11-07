import { coverGroupLocked, coverLayerLocked, type BookCoverDocument, type CoverLayer } from "./bookCoverDoc";

/** Placement follows the visible, front-to-back layer list. */
export type CoverLayerPlacement = "before" | "after";

/** Moves a selection as one ordered block, adopting the destination group. */
export function moveCoverLayers(
  doc: BookCoverDocument,
  ids: string[],
  destination: { layerId?: string; groupId?: string | null; placement?: CoverLayerPlacement },
): BookCoverDocument | null {
  const selected = new Set(ids);
  const moving = doc.layers.filter((layer) => selected.has(layer.id));
  if (!moving.length || moving.some((layer) => coverLayerLocked(doc, layer))) return null;
  const target = destination.layerId ? doc.layers.find((layer) => layer.id === destination.layerId) : null;
  if (destination.layerId && (!target || selected.has(destination.layerId))) return null;
  const groupId = target?.groupId ?? destination.groupId ?? null;
  if (groupId && (!doc.groups.some((group) => group.id === groupId) || coverGroupLocked(doc, groupId))) return null;
  const rest = doc.layers.filter((layer) => !selected.has(layer.id));
  let index = 0;
  if (target) {
    index = rest.findIndex((layer) => layer.id === target.id) + (destination.placement === "after" ? 0 : 1);
  } else if (groupId) {
    index = rest.reduce((last, layer, i) => layer.groupId === groupId ? i + 1 : last, rest.length);
  }
  const moved: CoverLayer[] = moving.map((layer) => ({ ...layer, groupId }));
  const layers = [...rest.slice(0, index), ...moved, ...rest.slice(index)];
  if (layers.every((layer, i) => layer.id === doc.layers[i].id && layer.groupId === doc.layers[i].groupId)) return null;
  return { ...doc, layers, groups: doc.groups.map((group) => group.id === groupId ? { ...group, collapsed: false } : group) };
}

/** Moves all selected layers past their next unselected neighbour. */
export function stepCoverLayers(doc: BookCoverDocument, ids: string[], direction: "up" | "down") {
  const selected = new Set(ids);
  const indexes = doc.layers.flatMap((layer, i) => selected.has(layer.id) ? [i] : []);
  if (!indexes.length) return null;
  const index = direction === "up" ? Math.max(...indexes) + 1 : Math.min(...indexes) - 1;
  const target = doc.layers[index];
  return target ? moveCoverLayers(doc, ids, { layerId: target.id, placement: direction === "up" ? "before" : "after" }) : null;
}
