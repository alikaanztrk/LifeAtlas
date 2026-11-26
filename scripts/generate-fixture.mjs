import { mkdir, open } from 'node:fs/promises'
import { resolve } from 'node:path'

const mib = Number(process.argv[2] ?? 10)
if (!Number.isInteger(mib) || mib < 1 || mib > 100) {
  throw new Error('Choose a whole size from 1 to 100 MiB')
}

const directory = resolve('.local')
const output = resolve(directory, 'synthetic-stress-' + mib + '-mib.json')
await mkdir(directory, { recursive: true })
const file = await open(output, 'w')
const head = '{"semanticSegments":['
const tail = ']}'
const target = mib * 1024 * 1024
const origin = Date.UTC(2010, 0, 1)
let size = Buffer.byteLength(head + tail)
let rows = 0
let chunk = head
try {
  while (size < target) {
    const at = origin + rows * 30 * 60_000
    const lat = -47.1 + rows % 13 / 10_000
    const start = { lat, lon: -140.1 }
    const end = { lat, lon: -140.09 }
    const options = {
      startTime: new Date(at).toISOString(),
      endTime: new Date(at + 20 * 60_000).toISOString(),
      activity: { start, end, distanceMeters: 1_000, topCandidate: { type: 'CYCLING' } },
      syntheticPadding: 'LifeAtlas generated synthetic test row; no real positions or journeys',
    }
    const row = (rows ? ',' : '') + JSON.stringify(options)
    const length = Buffer.byteLength(row)
    if (size + length > target) break
    chunk += row
    size += length
    rows++
    if (chunk.length >= 262_144) {
      await file.writeFile(chunk)
      chunk = ''
    }
  }
  await file.writeFile(chunk + tail)
} finally {
  await file.close()
}
console.log('Synthetic fixture: ' + mib + ' MiB target, ' + size + ' bytes, ' + rows + ' input rows.')
