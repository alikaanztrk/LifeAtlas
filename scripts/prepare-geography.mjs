import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'

const source = new URL('../.local/atlas-input/', import.meta.url)
const output = new URL('../src/geography/', import.meta.url)
const boundaries = await readFile(new URL('countries.geojson', source))
const gazetteer = await readFile(new URL('cities5000.txt', source))
const coordinate = (value) => Math.round(value * 100_000) / 100_000
const region = (value) => typeof value === 'string' && /^[A-Z]{2}$/.test(value)
const plain = (value) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replaceAll('ı', 'i')

const countries = JSON.parse(boundaries).features.map(({ properties, geometry }) => {
  const code = [properties.ISO_A2_EH, properties.ISO_A2].find(region) ?? null
  const polygons = geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates]
  return {
    type: 'Feature', properties: { code },
    geometry: { type: 'MultiPolygon', coordinates: polygons.map((polygon) =>
      polygon.map((ring) => ring.map((pair) => pair.slice(0, 2).map(coordinate)))) },
  }
})
const settlements = gazetteer.toString('utf8').split(/\r?\n/).flatMap((line) => {
  const [id, name, , aliases, lat, lon, kind, feature, country] = line.split('\t')
  if (kind !== 'P' || !/^PPL(?:A[2-5]?|C)?$/.test(feature) || !region(country) || !name) return []
  const native = country === 'TR' ? aliases.split(',').find((alias) => /[ıİşŞğĞçÇöÖüÜ]/.test(alias) && plain(alias) === plain(name)) : undefined
  return [[Number(id), native ?? name, coordinate(Number(lat)), coordinate(Number(lon)), country]]
})
if (countries.length < 200 || settlements.length < 30_000) throw new Error('Public reference data appears incomplete')
await writeFile(new URL('atlas-countries.mapdata', output), gzipSync(JSON.stringify({ type: 'FeatureCollection', features: countries }), { level: 9 }))
await writeFile(new URL('atlas-settlements.mapdata', output), gzipSync(JSON.stringify(settlements), { level: 9 }))

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex')
console.log({ countries: countries.length, settlements: settlements.length, countrySource: digest(boundaries), settlementSource: digest(gazetteer) })
