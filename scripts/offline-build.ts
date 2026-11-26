import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { transformWithEsbuild } from 'vite'
import type { Plugin } from 'vite'

const publicAssets = ['atlas-mark.svg', 'atlas-192.png', 'atlas-512.png', 'lifeatlas.webmanifest']
const bundledAsset = /^assets\/[\w.-]+\.(?:js|css)$/

export function offlineBuild(): Plugin {
  return {
    name: 'lifeatlas-offline-build',
    apply: 'build',
    writeBundle: {
      order: 'post',
      async handler(options, bundle) {
        if (!options.dir) throw new Error('Offline build requires a static output directory')
        const dir = options.dir
        const paths = [
          'index.html', 'lifeatlas-license.txt', 'worker-licenses.txt', 'third-party-licenses.md',
          ...publicAssets, ...Object.keys(bundle).filter((path) => bundledAsset.test(path)),
        ].sort()
        const assets = await Promise.all(paths.map(async (path) => {
          const contents = await readFile(resolve(dir, path))
          const integrity = 'sha256-' + createHash('sha256').update(contents).digest('base64')
          return [path, integrity] as const
        }))
        const template = await readFile(new URL('../src/pwa/worker.ts', import.meta.url), 'utf8')
        const { code } = await transformWithEsbuild(template, 'offline-worker.ts', { target: 'es2022', minify: true })
        const manifest = JSON.stringify(assets)
        const version = createHash('sha256').update(code).update(manifest).digest('hex')
        await writeFile(resolve(dir, 'service-worker.js'),
          'const LIFEATLAS_BUILD=' + JSON.stringify({ version, assets }) + ';\n' + code)
        await writeFile(resolve(dir, '.nojekyll'), '')
      },
    },
  }
}
