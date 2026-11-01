export type BookGraphicCategory =
  | "Ornaments"
  | "Dividers"
  | "Botanical"
  | "Symbols"
  | "Frames"
  | "Lines"
  | "Shapes"
  | "Arrows"
  | "Journal";

export type BookGraphicVariant = "line" | "solid" | "frame" | "dotted" | "dashed";

export interface BookGraphic {
  id: string;
  label: string;
  category: BookGraphicCategory;
  variant: BookGraphicVariant;
  svg: string;
  /** Sensible insertion width, as a percentage of the text column. */
  width: number;
}

const DEFAULT_WIDTH: Record<BookGraphicCategory, number> = {
  Ornaments: 34,
  Dividers: 62,
  Botanical: 38,
  Symbols: 26,
  Frames: 100,
  Lines: 72,
  Shapes: 44,
  Arrows: 52,
  Journal: 52,
};

const graphic = (
  id: string,
  label: string,
  category: BookGraphicCategory,
  svg: string,
  variant: BookGraphicVariant = "line",
  width = DEFAULT_WIDTH[category],
): BookGraphic => ({ id, label, category, variant, svg, width });

const art = (body: string, viewBox = "0 0 240 80", strokeWidth = 2.2) =>
  `<svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

const solid = (body: string, viewBox = "0 0 240 80") =>
  `<svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg" fill="currentColor">${body}</svg>`;

const fill = (body: string) => `<g fill="currentColor" stroke="none">${body}</g>`;

const star = (cx: number, cy: number, r: number) => {
  const points = Array.from({ length: 10 }, (_, index) => {
    const radius = index % 2 === 0 ? r : r * 0.42;
    const angle = -Math.PI / 2 + (index * Math.PI) / 5;
    return `${(cx + Math.cos(angle) * radius).toFixed(2)},${(cy + Math.sin(angle) * radius).toFixed(2)}`;
  }).join(" ");
  return `<polygon points="${points}"/>`;
};

const diamond = (cx: number, cy: number, r: number) =>
  `<path d="m${cx} ${cy - r} ${r} ${r}-${r} ${r}-${r}-${r} ${r}-${r}Z"/>`;

const BASE_GRAPHICS: BookGraphic[] = [
  // ---------------------------------------------------------------- Ornaments
  graphic("fleuron", "Fleuron", "Ornaments", art(`
    <path d="M120 16c-8 7-13 15-13 24 0 10 6 18 13 24 7-6 13-14 13-24 0-9-5-17-13-24Z"/>
    <path d="M120 24v34M110 36c7 2 13 2 20 0M110 46c7-2 13-2 20 0"/>
    <path d="M107 29c-13-5-25 0-31 11 10 5 21 3 31-5M133 29c13-5 25 0 31 11-10 5-21 3-31-5"/>
  `)),
  graphic("quatrefoil", "Quatrefoil", "Ornaments", art(`
    <path d="M120 40C109 34 105 24 111 16c5-7 14-7 19 0 6 8 2 18-10 24Z"/>
    <path d="M120 40c6-11 16-15 24-9 7 5 7 14 0 19-8 6-18 2-24-10Z"/>
    <path d="M120 40c11 6 15 16 9 24-5 7-14 7-19 0-6-8-2-18 10-24Z"/>
    <path d="M120 40c-6 11-16 15-24 9-7-5-7-14 0-19 8-6 18-2 24 10Z"/>
    ${fill('<circle cx="120" cy="40" r="4"/>')}
  `)),
  graphic("printer-flower", "Printer’s flower", "Ornaments", art(`
    ${fill(`
      <ellipse cx="120" cy="21" rx="7" ry="14"/>
      <ellipse cx="120" cy="59" rx="7" ry="14"/>
      <ellipse cx="101" cy="40" rx="14" ry="7"/>
      <ellipse cx="139" cy="40" rx="14" ry="7"/>
      <ellipse cx="107" cy="27" rx="7" ry="14" transform="rotate(-45 107 27)"/>
      <ellipse cx="133" cy="27" rx="7" ry="14" transform="rotate(45 133 27)"/>
      <ellipse cx="107" cy="53" rx="7" ry="14" transform="rotate(45 107 53)"/>
      <ellipse cx="133" cy="53" rx="7" ry="14" transform="rotate(-45 133 53)"/>
    `)}
    <circle cx="120" cy="40" r="6"/>
  `, "0 0 240 80", 1.6)),
  graphic("asterism", "Asterism", "Ornaments", art(`
    ${fill(`
      <path d="m120 10 5 15 15 5-15 5-5 15-5-15-15-5 15-5 5-15Z"/>
      <path d="m92 44 4 10 10 4-10 4-4 10-4-10-10-4 10-4 4-10Z"/>
      <path d="m148 44 4 10 10 4-10 4-4 10-4-10-10-4 10-4 4-10Z"/>
    `)}
    <circle cx="120" cy="72" r="1.8"/>
  `, "0 0 240 80", 1.4)),
  graphic("scroll-tail", "Scroll tail", "Ornaments", art(`
    <path d="M46 55c12-18 31-27 52-27 16 0 29 6 39 17 8 9 19 14 34 14"/>
    <path d="M171 59c-15 0-27-5-36-14-9-10-20-15-34-15-19 0-34 8-44 24"/>
    <path d="M64 51c8-10 18-15 31-15 13 0 23 5 30 15"/>
    <path d="M54 61c-8 0-14-5-14-12s6-12 14-12"/>
  `)),
  graphic("colophon", "Colophon", "Ornaments", art(`
    <path d="M82 53c14-8 25-8 38 0 13-8 24-8 38 0V25c-14-8-25-8-38 0-13-8-24-8-38 0v28Z"/>
    <path d="M120 25v28"/>
    <path d="M92 19l6-9M108 17l2-10M132 17l-2-10M148 19l-6-9"/>
    ${fill('<circle cx="120" cy="60" r="2.5"/>')}
  `)),
  graphic("diamond-cluster", "Diamond cluster", "Ornaments", art(`
    ${fill(`
      ${diamond(120, 40, 26)}
      ${diamond(84, 40, 14)}
      ${diamond(156, 40, 14)}
      <circle cx="120" cy="74" r="2.4"/>
      <circle cx="120" cy="6" r="2.4"/>
    `)}
  `, "0 0 240 80", 1.4)),
  graphic("star-cluster", "Star cluster", "Ornaments", art(`
    ${fill(`
      ${star(120, 38, 24)}
      ${star(82, 28, 11)}
      ${star(158, 28, 11)}
      ${star(94, 58, 7)}
      ${star(146, 58, 7)}
    `)}
  `, "0 0 240 80", 1.2)),

  // ----------------------------------------------------------------- Dividers
  graphic("divider-hairline", "Hairline", "Dividers", art(`
    <path d="M24 40h74M142 40h74"/>
    ${fill(diamond(120, 40, 9))}
  `)),
  graphic("divider-dots", "Dot leader", "Dividers", art(`
    <path d="M24 40h58M158 40h58"/>
    ${fill('<circle cx="98" cy="40" r="2.4"/><circle cx="120" cy="40" r="2.4"/><circle cx="142" cy="40" r="2.4"/>')}
  `, "0 0 240 80", 1.8)),
  graphic("divider-diamond", "Diamond rule", "Dividers", art(`
    <path d="M24 40h72M144 40h72"/>
    ${fill(`
      ${diamond(120, 40, 10)}
      ${diamond(96, 40, 4)}
      ${diamond(144, 40, 4)}
    `)}
  `)),
  graphic("divider-botanical", "Botanical rule", "Dividers", art(`
    <path d="M24 40h58M158 40h58"/>
    ${fill(`
      <path d="M120 40c-14-4-21-12-20-23 12 2 20 10 20 23Z"/>
      <path d="M120 40c14-4 21-12 20-23-12 2-20 10-20 23Z"/>
      <path d="M120 40c-6 12-3 20 5 25 4-11 2-19-5-25Z"/>
    `)}
  `)),
  graphic("divider-wave", "Wave rule", "Dividers", art(`
    <path d="M20 38c14-14 28 14 42 0s28 14 42 0 28 14 42 0 28 14 42 0 28 14 42 0"/>
    <path d="M20 49c14-14 28 14 42 0s28 14 42 0 28 14 42 0 28 14 42 0 28 14 42 0" stroke-opacity=".38"/>
  `)),
  graphic("divider-scallop", "Scallop rule", "Dividers", art(`
    <path d="M20 45c8-12 18-12 26 0s18 12 26 0 18-12 26 0 18 12 26 0 18-12 26 0 18 12 26 0 18-12 26 0"/>
  `)),
  graphic("divider-stars", "Star rule", "Dividers", art(`
    <path d="M24 40h58M158 40h58"/>
    ${fill(`
      ${star(120, 40, 12)}
      ${star(95, 40, 5)}
      ${star(145, 40, 5)}
    `)}
  `)),
  graphic("divider-chapter", "Chapter divider", "Dividers", art(`
    <path d="M18 40h58M164 40h58"/>
    <path d="M120 17c-8 7-12 15-12 23s4 16 12 23c8-7 12-15 12-23s-4-16-12-23Z"/>
    <path d="M120 24v32"/>
    <path d="M104 27c-9-3-17 1-21 8 7 4 14 2 21-3M136 27c9-3 17 1 21 8-7 4-14 2-21-3"/>
  `)),

  // ---------------------------------------------------------------- Botanical
  graphic("olive-branch", "Olive branch", "Botanical", art(`
    <path d="M34 64c39-6 59-25 80-52"/>
    ${fill(`
      <path d="M73 51c-3-12-11-19-23-20 1 11 9 18 23 20Z"/>
      <path d="M90 42c7-12 17-17 29-15-4 12-13 17-29 15Z"/>
      <path d="M106 28c-3-11 0-18 8-23 4 10 2 17-8 23Z"/>
      <path d="M57 58c7-9 16-11 25-6-6 8-14 10-25 6Z"/>
      <ellipse cx="82" cy="33" rx="4" ry="5.5" transform="rotate(-28 82 33)"/>
      <ellipse cx="100" cy="20" rx="3.5" ry="5" transform="rotate(-28 100 20)"/>
    `)}
  `)),
  graphic("laurel-wreath", "Laurel wreath", "Botanical", art(`
    <path d="M120 68C86 62 68 44 71 18M120 68c34-6 52-24 49-50"/>
    ${fill(`
      <path d="M83 54c-9-3-15-10-16-19 9 1 15 8 16 19Z"/>
      <path d="M92 61c-8-5-12-13-10-22 8 4 12 12 10 22Z"/>
      <path d="M76 41c-9-2-16-8-18-17 9 0 16 6 18 17Z"/>
      <path d="M76 27c-7-5-10-13-8-21 7 4 10 12 8 21Z"/>
      <path d="M157 54c9-3 15-10 16-19-9 1-15 8-16 19Z"/>
      <path d="M148 61c8-5 12-13 10-22-8 4-12 12-10 22Z"/>
      <path d="M164 41c9-2 16-8 18-17-9 0-16 6-18 17Z"/>
      <path d="M164 27c7-5 10-13 8-21-7 4-10 12-8 21Z"/>
    `)}
  `)),
  graphic("eucalyptus", "Eucalyptus", "Botanical", art(`
    <path d="M120 70V14M120 56c-13-1-22-8-26-18M120 44c13-1 22-8 26-18M120 32c-10-1-17-6-20-14M120 22c10-1 17-6 20-14"/>
    ${fill(`
      <circle cx="100" cy="22" r="9"/>
      <circle cx="140" cy="30" r="9"/>
      <circle cx="97" cy="43" r="10"/>
      <circle cx="143" cy="52" r="10"/>
      <circle cx="103" cy="63" r="8"/>
      <circle cx="137" cy="65" r="7"/>
    `)}
  `)),
  graphic("fern", "Fern frond", "Botanical", art(`
    <path d="M120 70V12"/>
    <path d="M120 62c-17-2-28-11-33-24M120 54c17-2 28-11 33-24M120 46c-14-2-23-9-27-20M120 38c14-2 23-9 27-20M120 30c-11-1-18-6-21-15M120 22c11-1 18-6 21-15"/>
    ${fill(`
      <path d="M120 62c-8 1-14-1-19-6 7-3 14-1 19 6Z"/>
      <path d="M120 54c8 1 14-1 19-6-7-3-14-1-19 6Z"/>
      <path d="M120 46c-7 1-12-1-16-5 6-2 12 0 16 5Z"/>
      <path d="M120 38c7 1 12-1 16-5-6-2-12 0-16 5Z"/>
    `)}
  `)),
  graphic("wildflower", "Wildflower", "Botanical", art(`
    <path d="M88 68c0-20 7-35 20-48M120 68V25M152 68c0-20-7-35-20-48"/>
    ${fill(`
      <circle cx="108" cy="16" r="6"/>
      <circle cx="100" cy="25" r="5"/>
      <circle cx="116" cy="25" r="5"/>
      <circle cx="120" cy="16" r="6"/>
      <circle cx="112" cy="24" r="5"/>
      <circle cx="128" cy="24" r="5"/>
      <circle cx="132" cy="16" r="6"/>
      <circle cx="124" cy="26" r="5"/>
      <circle cx="140" cy="26" r="5"/>
      <circle cx="120" cy="17" r="3.5"/>
    `)}
    <path d="M100 49c-9-1-16 3-21 11M140 45c9-1 16 3 21 11"/>
  `)),
  graphic("ivy-corner", "Ivy corner", "Botanical", art(`
    <path d="M22 138V42c0-11 9-20 20-20h96"/>
    <path d="M22 96c28 0 49-21 49-49V22"/>
    <path d="M30 118c21-4 35-18 39-39 2-14 12-24 26-27"/>
    ${fill(`
      <path d="M42 22c10-1 17 5 18 15-10 0-17-5-18-15Z"/>
      <path d="M71 18c-2 10-9 15-19 14 1-9 8-14 19-14Z"/>
      <path d="M31 53c9 4 13 12 10 21-9-4-13-12-10-21Z"/>
      <path d="M24 81c9 3 14 10 12 19-9-3-14-10-12-19Z"/>
      <path d="M54 44c7-6 15-6 22 0-6 7-14 7-22 0Z"/>
    `)}
  `, "0 0 160 160")),
  graphic("wheat", "Wheat", "Botanical", art(`
    <path d="M120 70V22"/>
    ${fill(`
      <ellipse cx="108" cy="24" rx="5" ry="10" transform="rotate(28 108 24)"/>
      <ellipse cx="132" cy="24" rx="5" ry="10" transform="rotate(-28 132 24)"/>
      <ellipse cx="105" cy="36" rx="5" ry="10" transform="rotate(28 105 36)"/>
      <ellipse cx="135" cy="36" rx="5" ry="10" transform="rotate(-28 135 36)"/>
      <ellipse cx="103" cy="48" rx="5" ry="10" transform="rotate(28 103 48)"/>
      <ellipse cx="137" cy="48" rx="5" ry="10" transform="rotate(-28 137 48)"/>
      <ellipse cx="101" cy="60" rx="5" ry="10" transform="rotate(28 101 60)"/>
      <ellipse cx="139" cy="60" rx="5" ry="10" transform="rotate(-28 139 60)"/>
    `)}
  `)),

  // ----------------------------------------------------------------- Symbols
  graphic("sun", "Sun", "Symbols", art(`
    <circle cx="120" cy="40" r="14"/>
    <path d="M120 9v11M120 60v11M89 40H78M162 40h-11M98 18l8 8M142 54l8 8M142 18l-8 8M98 54l-8 8"/>
    ${fill('<circle cx="120" cy="40" r="4"/>')}
  `)),
  graphic("moon", "Moon & stars", "Symbols", art(`
    ${fill('<path d="M132 13c-20 7-29 27-19 46 8 15 25 21 43 15-8 8-20 12-32 10-25-4-40-27-32-50 6-18 23-29 40-21Z"/>')}
    ${fill(`
      ${star(160, 26, 6)}
      ${star(150, 50, 4)}
    `)}
  `)),
  graphic("compass", "Compass", "Symbols", art(`
    <circle cx="120" cy="40" r="27"/>
    <circle cx="120" cy="40" r="20" stroke-opacity=".38"/>
    ${fill('<path d="m133 27-9 21-21 9 9-21 21-9Z"/>')}
    <path d="M120 8v7M120 65v7M88 40h7M145 40h7"/>
  `)),
  graphic("key", "Key", "Symbols", art(`
    <circle cx="94" cy="40" r="17"/>
    <circle cx="94" cy="40" r="6"/>
    <path d="M110 48l65-24M149 33l9 8M160 29l9 8M123 42l7 7"/>
  `)),
  graphic("quill", "Quill", "Symbols", art(`
    <path d="M74 68c17-24 38-46 86-56 1 35-21 51-49 53"/>
    <path d="M74 68l10-20M74 68l-18 4 4-17M84 48l31 2M96 36l23 3"/>
  `)),
  graphic("inkwell", "Inkwell", "Symbols", art(`
    <path d="M94 28h52v28c0 7-6 12-13 12h-26c-7 0-13-5-13-12V28Z"/>
    <path d="M102 28v-6c0-4 3-7 7-7h22c4 0 7 3 7 7v6M96 42h48"/>
    <path d="M120 10v18M114 22l6 8 6-8"/>
    ${fill('<path d="M104 52c8 4 24 4 32 0v5c0 3-2 5-5 5h-22c-3 0-5-2-5-5v-5Z"/>')}
  `)),
  graphic("open-book", "Open book", "Symbols", art(`
    <path d="M80 51c14-8 26-8 40 0 14-8 26-8 40 0V25c-14-8-26-8-40 0-14-8-26-8-40 0v26Z"/>
    <path d="M120 25v26M88 32c8-2 15-2 23 1M88 40c8-2 15-2 23 1M152 32c-8-2-15-2-23 1M152 40c-8-2-15-2-23 1"/>
    ${fill('<circle cx="120" cy="61" r="2.4"/>')}
  `)),
  graphic("wax-seal", "Wax seal", "Symbols", art(`
    <circle cx="120" cy="34" r="21"/>
    <circle cx="120" cy="34" r="15" stroke-opacity=".42"/>
    ${fill(star(120, 34, 10))}
    <path d="M109 53l-9 18 14-6 6 12 6-12 14 6-9-18"/>
  `)),
  graphic("bookmark", "Bookmark", "Symbols", solid(`
    <path d="M104 12h32v58l-16-12-16 12V12Z"/>
    <path d="M110 22h20M110 30h20" stroke="#fff" stroke-opacity=".7" stroke-width="2"/>
  `)),
  graphic("star-symbol", "Star", "Symbols", solid(star(120, 40, 28), "0 0 240 80")),

  // ------------------------------------------------------------------ Frames
  graphic("frame-page", "Page frame", "Frames", art(`
    <rect x="18" y="18" width="204" height="284" rx="2"/>
    <rect x="27" y="27" width="186" height="266" rx="1" stroke-opacity=".38"/>
    <path d="M18 50c14 0 24-10 24-24M222 50c-14 0-24-10-24-24M18 270c14 0 24 10 24 24M222 270c-14 0-24 10-24 24"/>
    <path d="M38 38c8-6 16-4 20 4-8 4-15 3-20-4ZM202 38c-8-6-16-4-20 4 8 4 15 3 20-4Z"/>
  `, "0 0 240 320")),
  graphic("frame-corner", "Corner flourish", "Frames", art(`
    <path d="M22 138V48c0-14 12-26 26-26h90"/>
    <path d="M22 100c26 0 47-21 47-47V22"/>
    <path d="M32 118c23-4 39-20 43-43 2-15 13-26 28-29"/>
    ${fill(`
      <path d="M46 26c10-1 17 5 18 15-10 0-17-5-18-15Z"/>
      <path d="M76 22c-2 10-9 15-19 14 1-9 8-14 19-14Z"/>
      <path d="M30 61c10 4 14 13 11 22-10-4-14-13-11-22Z"/>
      <path d="M57 49c7-6 15-6 22 0-6 7-14 7-22 0Z"/>
    `)}
  `, "0 0 160 160")),
  graphic("frame-arch", "Arch frame", "Frames", art(`
    <path d="M35 300V125c0-55 38-95 85-95s85 40 85 95v175"/>
    <path d="M47 300V128c0-48 33-84 73-84s73 36 73 84v172" stroke-opacity=".4"/>
    <path d="M35 300h170M35 125h170" stroke-opacity=".28"/>
  `, "0 0 240 320")),
  graphic("frame-botanical", "Botanical frame", "Frames", art(`
    <rect x="24" y="24" width="192" height="272" rx="2"/>
    ${fill(`
      <path d="M24 72c14-3 23-13 25-27 10 12 8 27-4 37-8 6-16 3-21-10Z"/>
      <path d="M216 72c-14-3-23-13-25-27-10 12-8 27 4 37 8 6 16 3 21-10Z"/>
      <path d="M24 248c14 3 23 13 25 27 10-12 8-27-4-37-8-6-16-3-21 10Z"/>
      <path d="M216 248c-14 3-23 13-25 27-10-12-8-27 4-37 8-6 16-3 21 10Z"/>
    `)}
    <path d="M120 24v18M120 278v18"/>
  `, "0 0 240 320")),
  graphic("frame-label", "Label frame", "Frames", art(`
    <path d="M50 22h140l18 18v40l-18 18H50L32 80V40l18-18Z"/>
    <path d="M50 30h136l10 10v32l-10 10H50L40 72V40l10-10Z" stroke-opacity=".35"/>
    <path d="M64 40h112M64 52h74M64 64h94" stroke-opacity=".55"/>
  `, "0 0 240 120")),
  graphic("frame-ticket", "Ticket frame", "Frames", art(`
    <path d="M44 24h152c9 0 16 7 16 16v8c-8 0-14 6-14 14s6 14 14 14v8c0 9-7 16-16 16H44c-9 0-16-7-16-16v-8c8 0 14-6 14-14s-6-14-14-14v-8c0-9 7-16 16-16Z"/>
    <path d="M78 24v64M162 24v64" stroke-dasharray="3 7" stroke-opacity=".45"/>
  `, "0 0 240 120")),
  graphic("frame-photo-corners", "Photo corners", "Frames", art(`
    <path d="M18 18h44v8H30v32h-8V18ZM222 18h-44v8h32v32h8V18ZM18 142h44v-8H30v-32h-8v40ZM222 142h-44v-8h32v-32h8v40Z"/>
    <rect x="44" y="34" width="152" height="92" stroke-dasharray="4 8" stroke-opacity=".32"/>
  `, "0 0 240 160")),
  graphic("frame-deckle", "Deckle frame", "Frames", art(`
    <path d="M30 26c14-3 26 2 40-1s26 3 40-1 26 2 40-1 26 3 40-1 26 2 40-1v60c-14 3-26-2-40 1s-26-3-40 1-26-2-40 1-26-3-40 1-26-2-40 1V26Z" transform="translate(0 10)"/>
    <path d="M30 274c14-3 26 2 40-1s26 3 40-1 26 2 40-1 26 3 40-1 26 2 40-1" transform="translate(0 -10)" stroke-opacity=".4"/>
    <path d="M30 26v248M210 26v248" stroke-opacity=".28"/>
  `, "0 0 240 320")),
  graphic("frame-double", "Double frame", "Frames", art(`
    <rect x="34" y="16" width="172" height="88" rx="2"/>
    <rect x="44" y="26" width="152" height="68" rx="1" stroke-opacity=".4"/>
  `, "0 0 240 120")),

  // ------------------------------------------------------------------- Lines
  graphic("line-fine", "Fine rule", "Lines", art(`<path d="M18 40h204"/>`, "0 0 240 80", 1.2)),
  graphic("line-double", "Double rule", "Lines", art(`<path d="M18 33h204M18 47h204"/>`, "0 0 240 80", 1.6)),
  graphic("line-dotted", "Dotted rule", "Lines", art(`<path d="M18 40h204" stroke-dasharray="1 13"/>`, "0 0 240 80", 3.5)),
  graphic("line-dashed", "Dashed rule", "Lines", art(`<path d="M18 40h204" stroke-dasharray="18 10"/>`)),
  graphic("line-hand", "Hand-drawn rule", "Lines", art(`
    <path d="M20 42c28-6 56-6 84 0 34 7 66 5 96-2"/>
    <path d="M20 49c26-5 53-5 79 0 33 6 65 4 101-2" stroke-width="1.2" stroke-opacity=".45"/>
  `)),
  graphic("line-ruled", "Ruled lines", "Lines", art(`
    <path d="M18 24h204M18 40h204M18 56h204" stroke-opacity=".8"/>
    <path d="M18 24h204" stroke-opacity=".35"/>
  `)),

  // ------------------------------------------------------------------ Shapes
  graphic("shape-circle", "Circle", "Shapes", art(`<circle cx="120" cy="40" r="28"/>`, "0 0 240 80", 2.4)),
  graphic("shape-oval", "Oval", "Shapes", art(`<ellipse cx="120" cy="40" rx="42" ry="26"/>`, "0 0 240 80", 2.4)),
  graphic("shape-arch", "Arch", "Shapes", art(`
    <path d="M68 68V39c0-22 23-37 52-37s52 15 52 37v29H68Z"/>
    <path d="M80 68V41c0-17 18-29 40-29s40 12 40 29v27" stroke-opacity=".35"/>
  `, "0 0 240 80")),
  graphic("shape-tag", "Tag", "Shapes", art(`
    <path d="M68 20h88l30 20-30 20H68c-7 0-12-5-12-12V32c0-7 5-12 12-12Z"/>
    <circle cx="76" cy="40" r="4"/>
  `, "0 0 240 80")),
  graphic("shape-label", "Label", "Shapes", art(`
    <path d="M62 18h124l18 22-18 22H62L44 40l18-22Z"/>
    <path d="M70 26h106l11 14-11 14H70L59 40l11-14Z" stroke-opacity=".35"/>
  `, "0 0 240 80")),
  graphic("shape-stamp", "Postage stamp", "Shapes", art(`
    <path d="M38 26h84v128H38V26Z" stroke-dasharray="5 5"/>
    <rect x="48" y="36" width="64" height="108" stroke-opacity=".4"/>
    <circle cx="80" cy="70" r="14"/>
    <path d="M60 96h40M60 106h40M60 116h26" stroke-opacity=".5"/>
  `, "0 0 160 180")),
  graphic("shape-speech", "Speech bubble", "Shapes", art(`
    <path d="M54 22h132c10 0 18 8 18 18v24c0 10-8 18-18 18h-76l-24 18 4-18H54c-10 0-18-8-18-18V40c0-10 8-18 18-18Z"/>
    <path d="M54 38h132M54 50h98" stroke-opacity=".45"/>
  `, "0 0 240 110")),
  graphic("shape-washi", "Washi tape", "Shapes", art(`
    <path d="M36 30h168l-12 20 12 20H36l12-20-12-20Z" fill="currentColor" fill-opacity=".14" stroke="currentColor"/>
    <path d="M58 38h124M54 46h132M50 54h140M54 62h132M58 70h124" stroke-opacity=".35"/>
  `, "0 0 240 100")),
  graphic("shape-tab", "Index tab", "Shapes", art(`
    <path d="M30 30h80c7 0 12 5 12 12v56c0 7-5 12-12 12H30V30Z"/>
    <path d="M40 40h70M40 52h70M40 64h48" stroke-opacity=".45"/>
  `, "0 0 140 140")),

  // ------------------------------------------------------------------ Arrows
  graphic("arrow-hand", "Hand-drawn arrow", "Arrows", art(`
    <path d="M22 46c38-8 75-8 112 0 23 5 45 4 66-2"/>
    <path d="M178 22l24 21-25 18"/>
    <path d="M22 53c36-6 71-6 106 0" stroke-width="1.1" stroke-opacity=".45"/>
  `)),
  graphic("arrow-curved", "Curved arrow", "Arrows", art(`
    <path d="M34 61c12-38 45-50 92-38 28 7 47 5 68-8"/>
    <path d="M176 7l19 8-11 17"/>
  `)),
  graphic("arrow-pointer", "Pointer", "Arrows", art(`
    <path d="M28 40h160"/>
    ${fill('<path d="M188 18l34 22-34 22V18Z"/>')}
  `)),
  graphic("arrow-dashed", "Dashed arrow", "Arrows", art(`
    <path d="M24 40h150" stroke-dasharray="12 9"/>
    <path d="M158 20l28 20-28 20"/>
  `)),
  graphic("arrow-double", "Double arrow", "Arrows", art(`
    <path d="M46 40h148M64 18 38 40l26 22M176 18l26 22-26 22"/>
  `)),
  graphic("arrow-loop", "Loop arrow", "Arrows", art(`
    <path d="M48 46c12-24 44-31 71-17 21 11 26 34 12 48-12 12-32 10-39-4-6-12 2-25 15-28"/>
    <path d="M98 19l22 10-15 18"/>
  `)),

  // ----------------------------------------------------------------- Journal
  graphic("journal-card", "Journal card", "Journal", art(`
    <rect x="34" y="18" width="172" height="124" rx="4"/>
    <path d="M50 36h140M50 52h140M50 68h140M50 84h140M50 100h104M50 116h84" stroke-opacity=".45"/>
    <circle cx="42" cy="30" r="2" fill="currentColor" stroke="none"/>
  `, "0 0 240 160")),
  graphic("journal-checklist", "Checklist card", "Journal", art(`
    <rect x="34" y="18" width="172" height="124" rx="4"/>
    <path d="M50 34h104M50 58h130M50 78h130M50 98h130M50 118h104" stroke-opacity=".35"/>
    ${fill(`
      <rect x="44" y="48" width="10" height="10" rx="2"/>
      <rect x="44" y="68" width="10" height="10" rx="2"/>
      <rect x="44" y="88" width="10" height="10" rx="2"/>
      <rect x="44" y="108" width="10" height="10" rx="2"/>
    `)}
    <path d="M46 53l3 3 5-7M46 73l3 3 5-7" stroke="#fff" stroke-width="1.6"/>
  `, "0 0 240 160")),
  graphic("journal-habit", "Habit tracker", "Journal", art(`
    <rect x="30" y="18" width="180" height="124" rx="4"/>
    <path d="M48 38h144M48 58h144M48 78h144M48 98h144M48 118h144" stroke-opacity=".35"/>
    <path d="M72 34v100M96 34v100M120 34v100M144 34v100M168 34v100" stroke-opacity=".2"/>
    ${fill(`
      <circle cx="60" cy="48" r="4"/>
      <circle cx="84" cy="48" r="4"/>
      <circle cx="108" cy="48" r="4"/>
      <circle cx="132" cy="48" r="4"/>
      <circle cx="156" cy="48" r="4"/>
      <circle cx="180" cy="48" r="4"/>
    `)}
  `, "0 0 240 160")),
  graphic("journal-week", "Weekly planner", "Journal", art(`
    <rect x="24" y="18" width="192" height="124" rx="4"/>
    <path d="M24 42h192M51 42v100M78 42v100M105 42v100M132 42v100M159 42v100M186 42v100" stroke-opacity=".35"/>
    <path d="M33 34h10M60 34h10M87 34h10M114 34h10M141 34h10M168 34h10M195 34h10" stroke-opacity=".6"/>
    <path d="M33 56h12M60 56h12M87 56h12M114 56h12M141 56h12M168 56h12M195 56h12" stroke-opacity=".25"/>
  `, "0 0 240 160")),
  graphic("journal-mood", "Mood tracker", "Journal", art(`
    <rect x="30" y="18" width="180" height="124" rx="4"/>
    ${fill(Array.from({ length: 14 }, (_, index) => `<circle cx="${48 + (index % 7) * 24}" cy="${48 + Math.floor(index / 7) * 24}" r="6"/>`).join(""))}
    <path d="M48 116h144" stroke-opacity=".35"/>
  `, "0 0 240 160")),
  graphic("journal-photo-corners", "Photo corners", "Journal", art(`
    <path d="M18 18h52v10H28v42h-10V18ZM222 18h-52v10h42v42h10V18ZM18 142h52v-10H28V90h-10v52ZM222 142h-52v-10h42V90h10v52Z"/>
    <rect x="52" y="38" width="136" height="84" stroke-dasharray="4 8" stroke-opacity=".28"/>
  `, "0 0 240 160")),
  graphic("journal-washi", "Washi tape", "Journal", art(`
    <path d="M30 32h180l-14 18 14 18H30l14-18-14-18Z" fill="currentColor" fill-opacity=".12" stroke="currentColor"/>
    <path d="M56 40h130M52 48h138M48 56h146M52 64h138M56 72h130" stroke-opacity=".35"/>
  `, "0 0 240 100")),
  graphic("journal-tab", "Index tab", "Journal", art(`
    <path d="M30 30h80c7 0 12 5 12 12v56c0 7-5 12-12 12H30V30Z"/>
    <path d="M42 42h58M42 54h58M42 66h38" stroke-opacity=".4"/>
  `, "0 0 140 140")),
  graphic("journal-pocket", "Library pocket", "Journal", art(`
    <path d="M38 26h164v108l-82 24-82-24V26Z"/>
    <path d="M38 26h164M50 38h140v80l-70 20-70-20V38Z" stroke-opacity=".35"/>
    <path d="M120 58v44M104 78l16 24 16-24" stroke-opacity=".55"/>
  `, "0 0 240 160")),
  graphic("journal-stamp", "Postage stamp", "Journal", art(`
    <path d="M42 22h76v136H42V22Z" stroke-dasharray="5 5"/>
    <rect x="52" y="32" width="56" height="116" stroke-opacity=".4"/>
    <circle cx="80" cy="64" r="13"/>
    <path d="M60 90h40M60 100h40M60 110h24" stroke-opacity=".5"/>
  `, "0 0 160 180")),
  graphic("journal-envelope", "Envelope", "Journal", art(`
    <rect x="30" y="26" width="180" height="108" rx="3"/>
    <path d="M30 30l90 58 90-58"/>
    <path d="M30 132l60-48M210 132l-60-48" stroke-opacity=".35"/>
  `, "0 0 240 160")),
  graphic("journal-prompt", "Prompt card", "Journal", art(`
    <rect x="34" y="18" width="172" height="124" rx="4"/>
    <path d="M52 38c0-8 6-14 14-14M66 38c0-8 6-14 14-14" stroke-opacity=".6"/>
    <path d="M52 52h128M52 68h128M52 84h128M52 100h100M52 116h80" stroke-opacity=".4"/>
  `, "0 0 240 160")),
  graphic("journal-bookplate", "Bookplate", "Journal", art(`
    <rect x="34" y="18" width="172" height="124" rx="2"/>
    <rect x="44" y="28" width="152" height="104" stroke-opacity=".35"/>
    <path d="M84 52h72M84 64h72M84 76h72M84 88h72M84 100h48" stroke-opacity=".45"/>
    <path d="M56 44c8-6 16-4 20 4-8 4-15 3-20-4ZM184 44c-8-6-16-4-20 4 8 4 15 3 20-4Z" stroke-opacity=".6"/>
  `, "0 0 240 160")),
  graphic("journal-reading-log", "Reading log", "Journal", art(`
    <rect x="30" y="18" width="180" height="124" rx="4"/>
    <path d="M30 42h180M78 42v100M126 42v100M174 42v100M30 66h180M30 90h180M30 114h180" stroke-opacity=".32"/>
    <path d="M42 34h24M90 34h24M138 34h24M186 34h12" stroke-opacity=".6"/>
  `, "0 0 240 160")),
];

const GRAPHIC_WIDTHS: Record<string, number> = {
  "frame-page": 100,
  "frame-corner": 36,
  "frame-arch": 100,
  "frame-botanical": 100,
  "frame-label": 62,
  "frame-ticket": 62,
  "frame-photo-corners": 56,
  "frame-deckle": 100,
  "frame-double": 62,
  "shape-circle": 24,
  "shape-oval": 34,
  "shape-arch": 42,
  "shape-tag": 44,
  "shape-label": 46,
  "shape-stamp": 24,
  "shape-speech": 48,
  "shape-washi": 60,
  "shape-tab": 22,
  "journal-card": 52,
  "journal-checklist": 52,
  "journal-habit": 70,
  "journal-week": 78,
  "journal-mood": 56,
  "journal-photo-corners": 50,
  "journal-washi": 60,
  "journal-tab": 22,
  "journal-pocket": 54,
  "journal-stamp": 24,
  "journal-envelope": 54,
  "journal-prompt": 52,
  "journal-bookplate": 54,
  "journal-reading-log": 72,
};

export const BOOK_GRAPHICS = BASE_GRAPHICS.map((item) => ({ ...item, width: GRAPHIC_WIDTHS[item.id] ?? item.width }));

export const BOOK_GRAPHIC_CATEGORIES = Array.from(new Set(BOOK_GRAPHICS.map((item) => item.category))) as BookGraphicCategory[];

export function graphicDataUri(svg: string, color: string) {
  const bytes = new TextEncoder().encode(svg.replace(/currentColor/g, color));
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}
