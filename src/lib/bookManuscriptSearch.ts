import { canvasBlocks, type CanvasBlock } from "./bookPublishing";

export interface ManuscriptSearchOptions { matchCase?: boolean; wholeWord?: boolean }
export interface ManuscriptMatch { start: number; end: number; blockStart: number }

const WORD = /[\p{L}\p{N}\p{M}_’']/u;
const literalPattern = (query: string) => query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Search only prose runs that can be replaced without touching portable markup. */
function proseRuns(block: CanvasBlock, fences: Array<{ start: number; end: number }>) {
  const text = block.display;
  const offset = block.start + block.editPrefix.length;
  const visible = new Uint8Array(text.length).fill(1);
  const hide = (start: number, end: number) => visible.fill(0, Math.max(0, start), Math.min(text.length, end));
  for (const fence of fences) {
    if (fence.start < offset + text.length && fence.end > offset) hide(fence.start - offset, fence.end - offset);
  }
  for (const match of text.matchAll(/!\[[^\]]*\]\([^)]+\)(?:\{[^}]*\})?/g)) hide(match.index!, match.index! + match[0].length);
  for (const match of text.matchAll(/\[([^\]]+)\]\([^)]+\)/g)) {
    hide(match.index!, match.index! + 1);
    hide(match.index! + 1 + match[1].length, match.index! + match[0].length);
  }
  // Use the same paired inline markers as the publishing renderer. Keep the text.
  for (const [pattern, size] of [
    [/`([^`]+)`/g, 1], [/\*\*([^*]+)\*\*/g, 2], [/__([^_]+)__/g, 2],
    [/\*([^*]+)\*/g, 1], [/_([^_]+)_/g, 1], [/~~([^~]+)~~/g, 2], [/\+\+([^+]+)\+\+/g, 2],
  ] as const) {
    for (const match of text.matchAll(pattern)) {
      hide(match.index!, match.index! + size);
      hide(match.index! + match[0].length - size, match.index! + match[0].length);
    }
  }
  for (const match of text.matchAll(/^[ \t]*(?:(?:[-*+]|\d+[.)])\s+|>\s?)/gm)) hide(match.index!, match.index! + match[0].length);
  for (const match of text.matchAll(/^[ \t]*(?:---|\*\*\*)[ \t]*$|\u200B/gm)) hide(match.index!, match.index! + match[0].length);
  const runs: Array<{ start: number; end: number }> = [];
  for (let index = 0; index < text.length;) {
    if (!visible[index]) { index += 1; continue; }
    const start = index;
    while (index < text.length && visible[index]) index += 1;
    runs.push({ start, end: index });
  }
  return { text, offset, visible, runs };
}

function adjacentWord(text: string, visible: Uint8Array, index: number, direction: -1 | 1) {
  while (index >= 0 && index < text.length && !visible[index]) index += direction;
  if (index < 0 || index >= text.length) return false;
  if (direction === -1 && /[\uDC00-\uDFFF]/.test(text[index])) index -= 1;
  return WORD.test(String.fromCodePoint(text.codePointAt(index)!));
}

export function findManuscriptMatches(content: string, query: string, options: ManuscriptSearchOptions = {}): ManuscriptMatch[] {
  if (!query.trim()) return [];
  const pattern = new RegExp(literalPattern(query), options.matchCase ? "gu" : "giu");
  const fences = Array.from(content.matchAll(/^[ \t]*```[^\n]*(?:\n|$)[\s\S]*?(?:^[ \t]*```[ \t]*(?:\n|$)|$(?![\s\S]))/gm), (match) => ({ start: match.index!, end: match.index! + match[0].length }));
  const matches: ManuscriptMatch[] = [];
  for (const block of canvasBlocks(content)) {
    if (block.kind !== "text") continue;
    const { text, offset, visible, runs } = proseRuns(block, fences);
    for (const run of runs) for (const match of text.slice(run.start, run.end).matchAll(pattern)) {
      const start = run.start + match.index!;
      const end = start + match[0].length;
      if (options.wholeWord && (adjacentWord(text, visible, start - 1, -1) || adjacentWord(text, visible, end, 1))) continue;
      matches.push({ start: offset + start, end: offset + end, blockStart: block.start });
    }
  }
  return matches;
}

/** Recompute ranges against the supplied revision; replacement strings are literal. */
export function replaceManuscriptText(content: string, query: string, replacement: string, options: ManuscriptSearchOptions = {}, index?: number) {
  const matches = findManuscriptMatches(content, query, options);
  const selected = index === undefined ? matches : matches.slice(index, index + 1);
  if (!selected.length || index !== undefined && (!Number.isInteger(index) || index < 0)) return { content, count: 0, nextIndex: 0 };
  let next = content;
  for (let at = selected.length - 1; at >= 0; at -= 1) {
    const match = selected[at];
    next = next.slice(0, match.start) + replacement + next.slice(match.end);
  }
  const cursor = selected[0].start + replacement.length;
  const nextIndex = index === undefined ? 0 : Math.max(0, findManuscriptMatches(next, query, options).findIndex((match) => match.start >= cursor));
  return { content: next, count: selected.length, nextIndex };
}

/** Mark preview HTML only. Never pass the resulting markup to a contentEditable. */
export function highlightManuscriptMatches(source: string, matches: ManuscriptMatch[], blockStart: number, activeStart: number | undefined, render: (source: string) => string) {
  if (!matches.length) return render(source);
  let prefix = "\uE000\uE001";
  while (source.includes(prefix)) prefix += "\uE001";
  const tokens = new Map<string, ManuscriptMatch | null>();
  let marked = source;
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const match = matches[index];
    const id = index.toString(16).split("").map((digit) => String.fromCharCode(0xe100 + parseInt(digit, 16))).join("");
    const open = `${prefix}${id}\uE002`, close = `${prefix}${id}\uE003`;
    tokens.set(open, match); tokens.set(close, null);
    marked = marked.slice(0, match.start - blockStart) + open + marked.slice(match.start - blockStart, match.end - blockStart) + close + marked.slice(match.end - blockStart);
  }
  let active: ManuscriptMatch | null = null;
  // Mark each rendered text fragment separately to retain nested typography spans.
  return render(marked).split(/(<[^>]*>)/g).map((part) => {
    if (part.startsWith("<")) return part;
    let result = "", cursor = 0;
    const append = (text: string) => active && text ? `<mark class="books-find-highlight" data-manuscript-find="${active.start}" data-manuscript-find-current="${active.start === activeStart}">${text}</mark>` : text;
    while (cursor < part.length) {
      const start = part.indexOf(prefix, cursor);
      if (start < 0) { result += append(part.slice(cursor)); break; }
      result += append(part.slice(cursor, start));
      const end = part.indexOf("\uE002", start + prefix.length);
      const close = part.indexOf("\uE003", start + prefix.length);
      const tokenEnd = end < 0 ? close : close < 0 ? end : Math.min(end, close);
      const token = part.slice(start, tokenEnd + 1);
      if (tokenEnd < 0 || !tokens.has(token)) { result += append(part.slice(start)); break; }
      active = tokens.get(token)!;
      cursor = tokenEnd + 1;
    }
    return result;
  }).join("");
}
