const origin = 'https://tiles.openfreemap.org'
export const manifestUrl = origin + '/planet'

export function tileTemplate(input: unknown): string {
  if (!input || typeof input !== 'object' || !('tiles' in input) || !Array.isArray(input.tiles)) throw new Error()
  const tile: unknown = input.tiles[0]
  if (typeof tile !== 'string' ||
    !/^https:\/\/tiles\.openfreemap\.org\/planet\/\d{8}_\d{6}_pt\/\{z\}\/\{x\}\/\{y\}\.pbf$/.test(tile)) throw new Error()
  return tile
}

export function tileAddress(template: string, path: string): string {
  const match = /^\/(\d{1,2})\/(\d{1,5})\/(\d{1,5})$/.exec(path)
  if (!match) throw new Error()
  const [z, x, y] = match.slice(1).map(Number)
  if (z === undefined || x === undefined || y === undefined || z > 14 || x >= 2 ** z || y >= 2 ** z) throw new Error()
  return template.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y))
}

export function openFreeMapRequest(address: string, signal: AbortSignal) {
  if (address !== manifestUrl && !/^https:\/\/tiles\.openfreemap\.org\/planet\/\d{8}_\d{6}_pt\/\d{1,2}\/\d{1,5}\/\d{1,5}\.pbf$/.test(address)) {
    throw new Error()
  }
  return fetch(address, {
    signal, method: 'GET', credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer',
  })
}
