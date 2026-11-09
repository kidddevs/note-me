# Working on NoteMe

Read `README.md` and `docs/ARCHITECTURE.md` before changing code. For Books Studio
cover work, also read `docs/COVER_DESIGNER.md` and the relevant part of
`docs/BOOKS_STUDIO_AUDIT.md`. For shared artwork, image placement or publishing,
also read `docs/STUDIO_IMAGES.md`.
For library cards, export choices, save dialogs or print output, read
`docs/STUDIO_PUBLISHING.md`.
For canvas selection, transforms, arrangement or undo, read `docs/STUDIO_SELECTION.md`.
For section status, word budgets, due dates or chapter saves, read `docs/STUDIO_PLANNING.md`.

## Conventions

- This is a local-first Tauri 2 desktop app, with React 18, TypeScript, and Vite.
  Rust owns SQLite and native file operations. Keep production persistence behind
  the existing typed API and Zustand stores.
- Inspect the current diff first and preserve work already in progress.
- Keep changes focused, follow the existing studio styling, and ask before adding
  production dependencies. Use appropriate icons for feedback and controls;
  do not introduce dot indicators or pulsing dots.
- Do not modify local databases or delete user books, images, templates, palettes,
  or history during QA. Use the isolated cover development fixture for browser QA.
- Do not commit, push, or change branches unless the user authorizes that work.

## Validation and documentation

- Run `npm test` after changing JavaScript or TypeScript. It includes TypeScript,
  the Node publishing/cover tests, and Rust validation/migration tests.
- Run `npm run build` for UI or publishing changes and `git diff --check` before
  delivery. There is currently no `npm run lint` script.
- Add focused behavioral regression coverage for changed utilities. Document
  changed public utility contracts in `docs/`.
- Browser checks should exercise real interactions and rendering. Distinguish
  fixture-based browser checks from native Tauri/database validation.
- Update the relevant docs when changing behavior or persistence. Never put
  screenshots, build output, or machine-specific state in commits.
- When a push is authorized, verify the pushed branch with `git ls-remote` and
  compare it with local `HEAD`. Do not claim delivery from a successful commit alone.
