# UI text and theme contrast

`src/styles.css` owns light/dark palettes. `--text` is primary ink; `--text-2`,
`--text-3` and `--text-4` are supporting text rather than disabled colors. Keep
them readable on the background, surface and modal colors, including translucent
hover/selected fills. Disabled controls can reduce opacity independently.

Accent and semantic colors have separate foreground tokens for solid buttons:
use `--accent-text` and `--danger-text`, rather than hardcoded white. Light and
dark themes need different foregrounds. Supporting text and semantic labels
target at least 4.5:1 contrast under the
[WCAG normal-text guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
The tests cover declared palette combinations, not a claim of whole-app WCAG
conformance or arbitrary user artwork.

Manuscript inspector captions use at least 11 px, labels and fields 12 px, and
section headings 13 px. Keep controls wrapping when labels grow; do not shrink
them to fit. Notes' `sm/md/lg` preference values remain compatible with saved
settings and map to 14/16/18 px in `src/store/theme.ts`.

Document styling is independent: manuscript pages use `--book-paper`,
`--book-ink` and `--document-accent`; app controls use the application palette.
The page sheet must set `color: var(--book-ink)` so inherited title colors stay
readable when the surrounding app changes theme. Preserve explicit authored
colors and font sizes, including cover artwork and saved paragraph presets.

Run `npm test`, `npm run build` and `git diff --check`. The readability regression
test reads the real CSS palette, composites translucent fills and checks contrast.
Use fresh isolated browser contexts at `/cover-preview.html?screen=manuscript`
and `/notes-preview.html` for both themes. Check inspector labels, inputs,
buttons, notes in all modes, title wrapping and page ink at wide/narrow widths.
Inspect screenshots as well as computed styles. Never open real notes or a user
database for visual QA; see [Notes fixture instructions](NOTES_EDITOR.md).
