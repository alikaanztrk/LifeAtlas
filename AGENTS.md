# AGENTS.md — LifeAtlas

Repository-level instructions for Codex and other coding agents. Applies to the entire repository. LifeAtlas is a privacy-first, open-source, browser-based personal location history explorer. Read these rules before modifying anything.

## 1. Required context

Read `CODEX_PROMPT.md`, then `docs/01_PRODUCT.md`, `docs/02_UI_UX.md`, `docs/03_ARCHITECTURE.md`, `docs/04_DATA_ENGINE.md`, `docs/05_PRIVACY.md`, `docs/06_TESTING.md`, `docs/07_ROADMAP.md` and `docs/08_REFERENCES.md`. Read `PLAN.md` for current state. These files define the product; do not silently replace them with a different product. If an explicit new owner instruction conflicts with a spec, follow the owner and document the change. Never weaken privacy or silently change data semantics.

## 2. Non-negotiable rules

- Application name: **LifeAtlas**. Tagline: **Your life, mapped.**
- Static web app for modern desktop Chrome; responsive layouts and PWA are targets. No backend, login, server database, API key requirement, tracking or telemetry.
- Real Timeline exports are sensitive. Never commit, upload, print to logs, send to an LLM or include their contents in screenshots, bug reports, tests, build output, generated docs or public assets. Use synthetic fixtures only. Do not inspect a private export unless the owner explicitly supplies it for that purpose; inspect only necessary structural metadata locally.
- All parsing, normalization, analytics, user edits and storage run locally in the browser. No external geocoding or routing calls with personal coordinates. Map tiles are an explicitly disclosed, separately enabled network exception; strict privacy mode disables them and all app-initiated remote requests.
- No fabricated place names, GPS traces, transport modes, coverage or statistics. Missing and zero are distinct. Demo values must be conspicuously marked and isolated from real datasets.
- Never silently drop malformed records. Validate, recover valid entries, count errors and expose safe diagnostics. Preserve provenance and distinguish recorded data from estimates.
- Never publish, deploy, push, create a remote repository, open a PR or commit unless the owner explicitly requests that specific action. Prepare local changes and report them. Do not alter unrelated files or reset user changes.
- Use original UI and code by default. Public repositories are references, not blanket permission to copy. Check exact upstream license and attribution requirements before any reuse. No incompatible code or unlicensed assets. Record approved reuse in `THIRD_PARTY_NOTICES.md`.

## 3. Engineering conventions

- React + TypeScript strict + Vite. Use npm with a committed lockfile; select compatible stable dependencies and document versions. Tailwind/shadcn-style accessible components, MapLibre GL JS, ECharts, Dexie/IndexedDB, Web Workers, Turf or focused geospatial utilities, i18next. Verify necessity and licensing of added dependencies.
- Separate pure domain logic from UI, adapters, persistence and workers. No calculation logic hidden in components. Use typed worker messages, runtime guards/validation, deterministic algorithms and explicit error states.
- Use feature-based modules, small components, shared tokens and reusable primitives. Avoid `any`, unnecessary global state, unbounded caches and giant components. Prefer accessible HTML, keyboard interaction and reduced-motion support.
- Use translation keys for user-facing strings, English source identifiers, locale-aware formatting (`tr-TR`, `en`), and explicit units. Store coordinates in WGS84; GeoJSON positions are `[longitude, latitude]`.
- Do not make version-specific API assumptions. Check installed types/docs. Never invent commands or claim a feature works without testing.

## 4. Workflow for each task

1. Inspect working tree, existing files, package scripts and `PLAN.md` (do not overwrite existing work).
2. Read relevant specs. For nontrivial tasks, write/update an actionable plan with milestones, acceptance criteria, open decisions and verification commands in `PLAN.md`.
3. Implement the smallest coherent vertical slice; include loading, empty, partial, error and success states. Use synthetic data; keep unfinished features clearly labeled or hidden.
4. Run relevant automated checks. Expected project commands after scaffolding: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, `npm run test:e2e`. Add missing scripts when appropriate. Run only real available commands and report failures honestly.
5. Verify actual interaction in Chrome/Playwright when available. Check console, network requests, responsiveness, keyboard navigation, theme contrast and no-data behavior.
6. Update `PLAN.md` with status, tests actually run, failures, risks and next action. Update specs only for approved decisions.
7. Stop at the requested milestone; report summary, paths, commands/results and remaining limitations in Turkish. Do not claim deployment or passing checks that were not performed.

## 5. Definition of done

A feature is done only when its acceptance checks pass, data and privacy invariants are preserved, UI is usable with real and empty datasets, tests cover relevant edge cases, and documentation is updated. A visual mock or hardcoded placeholder is not a completed feature. No suppressed errors, fake metrics, skipped tests disguised as passes, or hidden data uploads.
