# Contributing to LifeAtlas

LifeAtlas is a browser-based explorer for private Google Maps Timeline exports. Use synthetic records for development, testing, screenshots and bug reports.

## Set up the project

Use Node.js 22.13+ on the 22.x line or Node.js 24+, npm and current Chrome. Run `npm ci` and `npm run dev`, then open `http://127.0.0.1:5173/LifeAtlas/`. The built-in demo is the quickest way to see the workspace. For a local stress input, run `npm run fixture:generate -- 50`.

Read [the architecture](docs/03_ARCHITECTURE.md), [data engine rules](docs/04_DATA_ENGINE.md) and [privacy requirements](docs/05_PRIVACY.md) before changing those areas. Keep parsing and calculation logic in the domain and workers, keep user-facing copy in English and Turkish, and document changes to third-party assets and libraries in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Verify a change

```sh
npm run lint
npm run typecheck
npm run test
npm run build
npm run scan:artifacts
npm run test:e2e
```

For Playwright setup, see [README.md](README.md#verification). Use the production preview when changing install, offline startup or updates. Verify the relevant keyboard interaction, no-data state, both languages and both themes. Consult [the acceptance checks](docs/06_TESTING.md) for the affected feature.

Review your staged files and the generated `dist/` before sharing work. Keep real exports, coordinates, filenames, dates, labels and screenshots showing a real archive outside the project. Report ordinary issues with a synthetic reproducer and the app/browser version. See [SECURITY.md](SECURITY.md) for vulnerabilities.
