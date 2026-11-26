# 08 — Research references and reuse policy

Research checked: 26 November 2026. Public repository descriptions were checked; source code has not been executed or audited. Do not assume licenses, claims, features or maintenance status without verifying the current repository and exact revision. Use as references, not dependencies or mandatory forks. Do not include personal data when consulting upstream issues.

| Reference | What to examine | Reuse guidance |
|---|---|---|
| [manolotis/google-timeline-visualizer](https://github.com/manolotis/google-timeline-visualizer) | Browser-local import, shared date range, analytics, worker/IndexedDB pipeline | Strongest architectural reference; verify license and implementation, prefer own adapters |
| [ahmedtanjim/timeline-heatmap](https://github.com/ahmedtanjim/timeline-heatmap) | Local heatmaps, export handling, map layers and safe user guidance | Verify current license, attribution and network behavior |
| [Dawarich](https://github.com/Freika/dawarich) | Trips, places, self-hosted timeline analytics UX | Feature inspiration only by default; no backend adoption or copyleft code reuse without license review |
| [imarinzone/mytravelrecap](https://github.com/imarinzone/mytravelrecap) | Editorial story, infographics and scroll transitions | Rewind inspiration; original visual treatment, verify license before reuse |
| [prasann/google-timeline-parser](https://github.com/prasann/google-timeline-parser) | Semantic segment extraction and format handling | Compare structural edge cases; do not blindly use CSV workflow |
| [slesaad/bigfoot](https://github.com/slesaad/bigfoot) | Trips and route visualization, legacy format | Inspiration; avoid personal dataset output and mandatory API key |
| [atmecode/timeline](https://github.com/atmecode/timeline) | Animated timeline visualization | Playback inspiration; verify license and format support |

Additional previously discussed repos (not reconfirmed in this research pass): `harshdhamaniya/location-analyzer`, `mahlernim/google-timeline-visualizer`. Optional leads only; do not assume they exist, have specific licenses or work. No need to use them to complete project.

## Data and platform documentation

- [Google Maps Timeline help](https://support.google.com/maps/answer/6258979) — official product behavior; not a formal JSON schema contract.
- [Timeline export format notes](https://timelinemap.app/whats-in-the-file) — community field reference; cross-check against fixtures, not authoritative guarantee.
- [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/) — maps, style and layers.
- [OpenFreeMap](https://openfreemap.org/) — candidate optional online basemap; verify provider policy, endpoints and attribution before integrating.
- [OpenStreetMap copyright](https://www.openstreetmap.org/copyright) — map attribution/license information; don't assume OSM public tile servers support bulk/offline use.
- [Dexie](https://dexie.org/docs/) — IndexedDB storage and transactions.
- [Vite static deploy](https://vite.dev/guide/static-deploy.html) — subpath build and GitHub Pages guidance.
- [Codex prompting guide](https://developers.openai.com/cookbook/examples/gpt-5/codex_prompting_guide) and [long-running plans](https://developers.openai.com/cookbook/articles/codex_exec_plans) — repository agent instructions and living plan pattern.

## Research workflow for Codex

Before reuse: inspect LICENSE at exact upstream commit, dependency licenses, required notices, code suitability and whether private data can be leaked; record source URL, revision, files/ideas reused, license and attribution in `THIRD_PARTY_NOTICES.md`. If no clear license, do not copy. If license is incompatible or unclear, implement independently. No upstream issue/PR, fork/push or remote action without explicit owner instruction. No brand/logo copying.
