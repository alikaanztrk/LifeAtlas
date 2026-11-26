# 05 — Privacy, security and open-source safeguards

## Threat model

Timeline data reveals home, work, routes, routines and other sensitive behavior. Threats include unintended network requests, commits/screenshots/logs, malicious imported JSON, XSS/dependency compromise, shared browser profiles, data remnants and misleading export controls. Local-first is not encryption at rest or anonymity. Browser/device users and extensions with access may inspect local data. Be explicit in product copy.

## Network modes

**Strict (default):** app assets fetched from its own static origin as required to load; after load/import, no app-initiated third-party requests, no remote map tiles, geocoding, routing, analytics, CDN fonts, images, crash reporting or telemetry. Use local map style and overlays. App works without internet after assets are available (PWA phase), with strict mode never requesting tile network. Browser extension/OS traffic is outside app control. No coordinates, raw exports, names or dates sent to external services.

**Online basemap (explicit opt-in):** allow only documented tile/style/glyph/sprite endpoints for selected provider. Disclose that tile requests reveal viewport regions/zoom/IP and timing, potentially associated with user's history; no raw JSON or individual locations intentionally uploaded. Consent revocable, map requests cease and online style removed. Keep attribution visible; confirm terms/availability. Do not cache private views or map tiles in PWA without a reviewed license and privacy policy.

Implement network policy centrally where feasible; test with browser request interception. Restrict CSP compatible with workers/WebGL and static host; default self, no arbitrary third-party connect, no inline executable import. Online provider hosts explicitly allowlisted as required (CSP alone does not enforce runtime consent). Set referrer policy no-referrer where feasible. Document GitHub Pages hosting limitations; do not falsely claim custom response headers if unsupported. Avoid remote resources embedded in uploaded strings.

## Storage controls

Session-only default; explicit opt-in for IndexedDB persistence. Describe shared-profile access, storage eviction and lack of encryption. No auto-save of raw JSON. No coordinates or labels in URLs, localStorage, console, network errors, CI or analytics. No private data in service worker caches. Provide dataset deletion and clear-all; cancel active jobs first, invalidate caches and reset derived UI. Do not delete the original file on user's computer; say so. If clear fails, display real error and recovery steps. Browser-level backups/OS remnants outside app control.

## Safe import/export

Validate shape and limits; treat names as plain text (React escaping), no `dangerouslySetInnerHTML` with imports; no eval, prototype pollution, arbitrary HTML/URLs or dynamic imports from data. Safe diagnostics only. CSV later must prevent formula injection. Rewind exports default aggregate-only, no exact coordinates, home/work, fine-grained timestamps, names or traces. If user explicitly chooses a detailed private export, show preview and warn that shared map/route may reveal home; separate action, never upload. Do not claim automatic anonymization guarantees.

## Repository rules

- `.gitignore` patterns for private input directories, Timeline/Location History filenames, Takeout archives, local screenshots, debug output; explicit exceptions only for clearly named synthetic fixture paths. Do not rely solely on file names; check staged diff and release files. Do not automatically copy user's downloads into repo.
- Test fixtures generated from fictitious points/labels/times, no real traces. No user-provided export in public/, dist/, test artifacts, GitHub issues, docs or agent transcript. Never commit credentials. Add artifact scan and review checklist. Avoid logs of filenames if potentially personal.
- The project uses the [MIT license](../LICENSE), approved by the owner for the first release. Check dependency, font and map data licenses and retain required notices. Treat copyleft and unlicensed references as design and research sources unless the owner approves reuse after a license compatibility review. See [third-party notices](../THIRD_PARTY_NOTICES.md), [security reporting](../SECURITY.md) and the [privacy notice](../PRIVACY.md).
- Prepare release locally. No auto push, publishing, PR or remote mutation by agent without owner's instruction.
