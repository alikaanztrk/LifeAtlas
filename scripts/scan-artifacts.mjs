import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

function paths(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const next = join(directory, entry.name)
    if (!entry.isFile() && !entry.isDirectory()) throw new Error('Release assets must be regular files and directories')
    return entry.isDirectory() ? paths(next) : [next.replaceAll('\\', '/')]
  })
}

const publicFiles = new Set(['public/atlas-mark.svg', 'public/atlas-192.png', 'public/atlas-512.png', 'public/lifeatlas.webmanifest'])
const distContent = /^dist\/(?:index\.html|atlas-mark\.svg|atlas-(?:192|512)\.png|lifeatlas\.webmanifest|service-worker\.js|\.nojekyll|third-party-licenses\.md|(?:lifeatlas-license|worker-licenses)\.txt|assets\/[a-zA-Z0-9_.-]+\.(?:js|css))$/
const approvedJson = /^(?:package(?:-lock)?\.json|tsconfig\.json|src\/fixtures\/synthetic-[a-z-]+\.json)$/
const sensitive = /(?:^|\/)(?:\.local|private|exports|downloads|screenshots)(?:\/|$)|(?:takeout|timeline|location[ _-]?history|records)[^/]*\.(?:json|csv|zip)$|\.(?:zip|gpx|kml|kmz|geojson|log)$/i

if (!existsSync('dist')) throw new Error('Build the application before scanning')
const publicFailures = paths('public').filter((entry) => !publicFiles.has(entry)).length
const output = paths('dist')
const artifactFailures = output.filter((entry) => !distContent.test(entry)).length
const indexed = existsSync('.git') ? execFileSync('git', ['ls-files', '--cached', '-z'], { encoding: 'utf8' })
  .split('\0').filter(Boolean) : []
const indexFailures = indexed.filter((entry) => !approvedJson.test(entry) &&
  (entry.toLowerCase().endsWith('.json') || sensitive.test(entry))).length

if (publicFailures || artifactFailures || indexFailures) {
  throw new Error('Unexpected paths. public: ' + publicFailures + ', dist: ' + artifactFailures + ', Git index: ' + indexFailures)
}

const worker = readFileSync('dist/service-worker.js', 'utf8')
const workerPrefix = 'const LIFEATLAS_BUILD='
const [header, ...code] = worker.split('\n')
if (!header.startsWith(workerPrefix) || !header.endsWith(';')) throw new Error('Offline manifest is missing')
const { version, assets } = JSON.parse(header.slice(workerPrefix.length, -1))
const expected = output.filter((path) => path !== 'dist/.nojekyll' && path !== 'dist/service-worker.js')
  .map((path) => [path.slice('dist/'.length), 'sha256-' + createHash('sha256').update(readFileSync(path)).digest('base64')])
  .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
const hash = createHash('sha256').update(code.join('\n')).update(JSON.stringify(expected)).digest('hex')
if (version !== hash || JSON.stringify(assets) !== JSON.stringify(expected)) {
  throw new Error('Offline manifest must contain each approved static asset with its build digest')
}
console.log('Artifact paths and offline asset digests passed for the build and available Git index.')
