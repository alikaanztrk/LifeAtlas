import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { expect, test } from 'vitest'
import { Geography } from '../domain/geography'
import type { CountryOutlines, SettlementPoint } from '../domain/geography'
import type { Visit } from '../domain/model'
import { PlaceIndex } from '../domain/places'

const box = (a: number, b: number, c: number, d: number) => [[a, b], [c, b], [c, d], [a, d], [a, b]]
const outlines: CountryOutlines = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { code: 'TR' }, geometry: { type: 'MultiPolygon', coordinates: [[
      box(0, 0, 1, 1), box(.55, .55, .65, .65),
    ]] } },
    { type: 'Feature', properties: { code: 'GR' }, geometry: { type: 'MultiPolygon', coordinates: [[box(-1, 0, 0, 1)]] } },
  ],
}
const towns: SettlementPoint[] = [[1, 'Çınar', .1, .06, 'TR'], [2, 'Synthetic neighbor', .1, -.001, 'GR']]
const source = { fileKey: 'synthetic', format: 'ios', index: 0, field: 'visit' } as const
const visit = (id: string, lon?: number, label?: string): Visit => ({
  id, source, kind: 'visit', coord: lon === undefined ? undefined : { lat: .1, lon }, label,
  start: { ms: 10 }, end: { ms: 20 },
})

test('matches only land and nearby settlements in that country', () => {
  const atlas = new Geography(outlines, towns)
  expect(atlas.locate({ lat: .1, lon: .001 })).toEqual({ country: 'TR', settlement: { id: 1, name: 'Çınar' } })
  expect(atlas.locate({ lat: .2, lon: .8 })).toEqual({ country: 'TR', settlement: undefined })
  expect(atlas.locate({ lat: .6, lon: .6 })).toBeUndefined()
  expect(atlas.locate({ lat: 0, lon: -3 })).toBeUndefined()
  expect(atlas.locate()).toBeUndefined()
})

test('keeps source and manual names separate from location matches and searches the local names', () => {
  const atlas = new Geography(outlines, towns)
  const events = [visit('named', .06, 'Test gallery'), visit('missing', undefined), visit('away', -3)]
  const index = new PlaceIndex(events)
  const groups = index.withEdits([], (point) => atlas.locate(point))
  expect(groups.list({ locale: 'tr-TR', sort: 'visits', page: 0, search: 'cinar' }).rows)
    .toMatchObject([{ name: 'Test gallery', area: { country: 'TR', settlement: { id: 1 } } }])
  expect(groups.list({ locale: 'tr-TR', sort: 'visits', page: 0, search: 'turkiye' }).matches).toBe(1)
  expect(groups.list({ locale: 'tr-TR', sort: 'visits', page: 0, search: '' }).scoped).toBe(3)
  const edited = index.withEdits([{ kind: 'label', visit: 'named', label: { name: 'My gallery', tags: [], category: 'none' } }])
  expect(edited.labelFor('named', 'Test gallery')).toBe('My gallery')
  expect(atlas.summarize(events)).toMatchObject({ basis: 'visits', inspected: 3, matched: 1, countries: 1, settlements: 1 })
})

test('the bundled data resolves public settlement centres and leaves open ocean unmatched', () => {
  const asset = (path: string) => JSON.parse(gunzipSync(readFileSync(new URL('../geography/' + path, import.meta.url))).toString('utf8'))
  const atlas = new Geography(asset('atlas-countries.mapdata'), asset('atlas-settlements.mapdata'))
  expect(atlas.locate({ lat: 41.01384, lon: 28.94966 })).toMatchObject({ country: 'TR', settlement: { name: 'İstanbul' } })
  expect(atlas.locate({ lat: 48.85341, lon: 2.3488 })).toMatchObject({ country: 'FR', settlement: { name: 'Paris' } })
  expect(atlas.locate({ lat: 0, lon: -140 })).toBeUndefined()
})
