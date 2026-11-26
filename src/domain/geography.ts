import type { FeatureCollection, MultiPolygon, Position } from 'geojson'
import type { Coordinate, Event } from './model'
import { distanceMeters } from './primitives'

export type CountryOutlines = FeatureCollection<MultiPolygon, { code: string | null }>
export type SettlementPoint = [id: number, name: string, latitude: number, longitude: number, country: string]
export type Area = { country: string; settlement?: { id: number; name: string } }
export type AreaSummary = {
  basis: 'visits' | 'positions'
  inspected: number
  matched: number
  countries: number
  settlements: number
  regions: { code: string; count: number }[]
  towns: { area: Area; count: number }[]
}
type Edge = { x: number; lower: number; upper: number; slope: number }
type Ring = Map<number, Edge[]>
type Polygon = { code: string; outer: Ring; holes: Ring[]; west: number; south: number; east: number; north: number }

const countryCell = 5
const edgeBand = .5
const townCell = .25
const townRadius = 12_000
const lonCells = 360 / townCell
const cell = (degree: number, size: number) => Math.floor(degree / size)
const key = (x: number, y: number) => x + ',' + y

function insert<Key, Item>(index: Map<Key, Item[]>, id: Key, item: Item) {
  const bucket = index.get(id)
  if (bucket) bucket.push(item)
  else index.set(id, [item])
}

function polygonBounds(positions: Position[]) {
  const box = { west: 180, south: 90, east: -180, north: -90 }
  for (const [lon = 0, lat = 0] of positions) {
    box.west = Math.min(box.west, lon)
    box.east = Math.max(box.east, lon)
    box.south = Math.min(box.south, lat)
    box.north = Math.max(box.north, lat)
  }
  return box
}

function indexRing(positions: Position[]): Ring {
  const ring: Ring = new Map()
  let previous = positions.at(-1)
  for (const next of positions) {
    const [x = 0, y = 0] = next
    const [px = 0, py = 0] = previous ?? next
    previous = next
    if (y === py) continue
    const lower = Math.min(y, py)
    const upper = Math.max(y, py)
    const edge = { x: y < py ? x : px, lower, upper, slope: (px - x) / (py - y) }
    for (let row = cell(lower, edgeBand); row <= cell(upper, edgeBand); row++) insert(ring, row, edge)
  }
  return ring
}

function inside({ lon, lat }: Coordinate, ring: Ring) {
  let crossed = false
  for (const edge of ring.get(cell(lat, edgeBand)) ?? []) {
    if (lat >= edge.lower && lat < edge.upper && lon < edge.x + (lat - edge.lower) * edge.slope) crossed = !crossed
  }
  return crossed
}

export class Geography {
  private readonly countries = new Map<string, Polygon[]>()
  private readonly towns = new Map<string, SettlementPoint[]>()
  private readonly memo = new Map<string, Area | undefined>()

  constructor(outlines: CountryOutlines, settlements: SettlementPoint[]) {
    for (const feature of outlines.features) {
      const { code } = feature.properties
      if (!code) continue
      for (const [outer, ...holes] of feature.geometry.coordinates) {
        if (!outer?.length) continue
        const box = { code, outer: indexRing(outer), holes: holes.map(indexRing), ...polygonBounds(outer) }
        for (let x = cell(box.west, countryCell); x <= cell(box.east, countryCell); x++) {
          for (let y = cell(box.south, countryCell); y <= cell(box.north, countryCell); y++) {
            insert(this.countries, key(x, y), box)
          }
        }
      }
    }
    for (const town of settlements) {
      insert(this.towns, key(cell(town[3] + 180, townCell) % lonCells, cell(town[2], townCell)), town)
    }
  }

  private country(coord: Coordinate) {
    const { lon, lat } = coord
    let match: string | undefined
    for (const box of this.countries.get(key(cell(lon, countryCell), cell(lat, countryCell))) ?? []) {
      if (lon < box.west || lon > box.east || lat < box.south || lat > box.north) continue
      if (!inside(coord, box.outer) || box.holes.some((ring) => inside(coord, ring))) continue
      if (match && match !== box.code) return
      match = box.code
    }
    return match
  }

  private nearest({ lon, lat }: Coordinate, country: string) {
    if (Math.abs(lat) > 89) return
    const margin = .111 / Math.cos((Math.abs(lat) + .111) * Math.PI / 180)
    let distance = townRadius
    let match: Area['settlement']
    for (let y = cell(lat - .111, townCell); y <= cell(lat + .111, townCell); y++) {
      for (let x = cell(lon + 180 - margin, townCell); x <= cell(lon + 180 + margin, townCell); x++) {
        const wrapped = (x + lonCells) % lonCells
        for (const [id, name, latitude, longitude, code] of this.towns.get(key(wrapped, y)) ?? []) {
          if (code !== country) continue
          const meters = distanceMeters({ lon, lat }, { lat: latitude, lon: longitude })
          if (meters < distance || (meters === distance && (!match || id < match.id))) {
            distance = meters
            match = { id, name }
          }
        }
      }
    }
    return match
  }

  locate(coord?: Coordinate): Area | undefined {
    if (!coord) return
    const identity = key(coord.lon, coord.lat)
    if (this.memo.has(identity)) return this.memo.get(identity)
    const country = this.country(coord)
    const area = country ? { country, settlement: this.nearest(coord, country) } : undefined
    if (this.memo.size >= 8_192) {
      const oldest = this.memo.keys().next().value
      if (oldest !== undefined) this.memo.delete(oldest)
    }
    this.memo.set(identity, area)
    return area
  }

  summarize(events: Event[]): AreaSummary {
    const basis = events.some((event) => event.kind === 'visit') ? 'visits' : 'positions'
    const countries = new Map<string, number>()
    const towns = new Map<number, { area: Area; count: number }>()
    let inspected = 0
    let matched = 0
    for (const event of events) {
      if (basis === 'visits' ? event.kind !== 'visit' : event.kind !== 'raw') continue
      inspected++
      const area = this.locate(event.kind === 'visit' ? event.coord : event.kind === 'raw' ? event.point.coord : undefined)
      if (!area) continue
      matched++
      countries.set(area.country, (countries.get(area.country) ?? 0) + 1)
      if (!area.settlement) continue
      const entry = towns.get(area.settlement.id) ?? { area, count: 0 }
      entry.count++
      towns.set(area.settlement.id, entry)
    }
    return {
      basis, inspected, matched, countries: countries.size, settlements: towns.size,
      regions: Array.from(countries, ([code, count]) => ({ code, count }))
        .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code)).slice(0, 5),
      towns: [...towns.values()].sort((a, b) => b.count - a.count ||
        (a.area.settlement?.id ?? 0) - (b.area.settlement?.id ?? 0)).slice(0, 5),
    }
  }
}
