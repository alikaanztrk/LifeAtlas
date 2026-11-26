# Third-party notices

LifeAtlas code and cartographic artwork were created for this project. The GitHub repositories listed in the [reference review](docs/09_PHASE_0_REFERENCE_REVIEW.md) informed architectural and product decisions. Their code, images and datasets were not incorporated.

## Application dependencies

| Package | Installed version | License | Purpose |
| --- | --- | --- | --- |
| React and React DOM | 19.3.1 | MIT | Application and DOM rendering |
| Scheduler | 0.28.0 | MIT | React DOM dependency |
| Dexie | 4.4.7 | Apache-2.0 | IndexedDB and transactions |
| i18next | 27.2.9 | MIT | Local Turkish and English catalogs |
| Lucide React | 1.81.0 | ISC | Interface icons |
| @noble/hashes | 2.4.0 | MIT | Local deterministic SHA-256 fingerprints |
| @js-temporal/polyfill | 0.5.1 | ISC | Time zone-aware calendar windows |
| JSBI | 4.3.2 | Apache-2.0 | Temporal polyfill dependency |
| MapLibre GL JS | 6.19.0 | BSD-3-Clause | Local map and vector-tile renderer |
| Apache ECharts | 6.1.0 | Apache-2.0 | Overview charts using tree-shaken bar, pie and Canvas modules |

Development uses Vite 7.3.8, TypeScript 5.9.3, ESLint 10.15.0, Vitest 4.1.12, Playwright 1.65.1, fake-indexeddb 6.2.8 and axe-core 4.14.1. The npm lockfile lists the full resolved dependency graph. The production build includes the license text for the application and its bundled dependencies, including the import Worker.

The optional online basemap uses OpenFreeMap's public vector tiles. Its on-screen attribution credits OpenFreeMap, © OpenMapTiles and © OpenStreetMap contributors. The style and local grid are LifeAtlas code. [OpenFreeMap quick start](https://openfreemap.org/quick_start/) · [OpenStreetMap copyright and ODbL](https://www.openstreetmap.org/copyright)
