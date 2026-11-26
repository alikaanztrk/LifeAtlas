import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'
import { offlineBuild } from '../scripts/offline-build'

export default defineConfig(({ command }) => ({
  base: '/LifeAtlas/',
  build: { license: { fileName: 'third-party-licenses.md' } },
  plugins: [
    offlineBuild(),
    {
      name: 'local-development-csp',
      transformIndexHtml: {
        order: 'pre',
        handler: (html) => html.replace('%VITE_DEV_STYLE%', command === 'serve' ? "'unsafe-inline'" : ''),
      },
    },
    {
      name: 'local-and-worker-license-notices',
      apply: 'build',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'lifeatlas-license.txt', source: readFileSync(new URL('../LICENSE', import.meta.url)) })
        this.emitFile({ type: 'asset', fileName: 'geography-notices.txt',
          source: readFileSync(new URL('../src/geography/NOTICE.txt', import.meta.url)) })
        this.emitFile({ type: 'asset', fileName: 'worker-licenses.txt',
          source: ['@noble/hashes/LICENSE', 'maplibre-gl/LICENSE.txt'].map((license) =>
            readFileSync(new URL('../node_modules/' + license, import.meta.url), 'utf8')).join('\n\n') })
      },
    },
  ],
  optimizeDeps: { include: ['@noble/hashes/sha2.js', '@noble/hashes/utils.js', '@js-temporal/polyfill'] },
  esbuild: { jsx: 'automatic' },
  server: {
    host: '127.0.0.1',
    fs: {
      deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/{private,exports,downloads,Takeout,.local}/**',
        '**/{AGENTS,CLAUDE,GEMINI,CODEX_PROMPT,BASLANGIC,PLAN}.md', '**/*.{json,JSON,csv,CSV,zip,ZIP,geojson,gpx,kml,kmz}'],
    },
  },
  preview: { host: '127.0.0.1' },
  test: { include: ['src/**/*.test.ts'] },
}))
