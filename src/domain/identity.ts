import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex } from '@noble/hashes/utils.js'
import { limits, ImportFailure } from './limits'
import type { Event, Source } from './model'
import type { Diagnostics } from './diagnostics'

const encoder = new TextEncoder()

export function fingerprint(value: string | Uint8Array): string {
  return bytesToHex(sha256(typeof value === 'string' ? encoder.encode(value) : value))
}

function sourceIdentity(source: Source) {
  return [source.fileKey, source.index, source.field]
}

export function sources(event: Event): Source[] {
  return [event.source, ...(event.additionalSources ?? [])]
}

function eventIdentity(event: Event): unknown[] {
  switch (event.kind) {
    case 'visit':
      return [event.kind, event.start.ms, event.end.ms, event.placeId ?? event.coord ?? sourceIdentity(event.source)]
    case 'activity':
      return [
        event.kind, event.start.ms, event.end.ms,
        event.mode === 'unknown' ? event.originalMode?.toUpperCase() ?? 'unknown' : event.mode,
        event.startCoord, event.endCoord, event.recordedMeters,
        event.startCoord || event.endCoord || event.recordedMeters !== undefined ? null : sourceIdentity(event.source),
      ]
    case 'path':
      return [event.kind, event.start?.ms, event.end?.ms, event.points.map((point) =>
        [point.coord, point.time?.ms, point.breakBefore]) ]
    case 'raw':
      return [event.kind, event.point.time.ms, event.point.coord, event.point.accuracy]
  }
}

export function identify(event: Event): Event {
  return { ...event, id: fingerprint(JSON.stringify(eventIdentity(event))) }
}

function combine(existing: Event, incoming: Event): { event: Event; omitted: number } {
  const allSources = sources(existing)
  const keys = new Set(allSources.map((item) => JSON.stringify(sourceIdentity(item))))
  let omitted = 0
  for (const source of sources(incoming)) {
    const key = JSON.stringify(sourceIdentity(source))
    if (keys.has(key)) continue
    keys.add(key)
    if (allSources.length < limits.provenance) allSources.push(source)
    else omitted++
  }
  const additionalSources = allSources.slice(1)
  if (existing.kind === 'visit' && incoming.kind === 'visit') {
    return { omitted, event: {
      ...existing, additionalSources, coord: existing.coord ?? incoming.coord,
      label: existing.label ?? incoming.label, confidence: existing.confidence ?? incoming.confidence,
    } }
  }
  return { omitted, event: { ...existing, additionalSources } }
}

export class EventSet {
  private readonly byId = new Map<string, Event>()
  private pointCount = 0
  duplicates = 0

  constructor(
    initial: Event[] = [],
    private readonly onDuplicate?: (event: Event, omitted: number) => void,
  ) {
    for (const event of initial) this.add(event)
  }

  add(event: Event): void {
    const previous = this.byId.get(event.id)
    if (previous) {
      this.duplicates++
      const combined = combine(previous, event)
      this.byId.set(event.id, combined.event)
      this.onDuplicate?.(event, combined.omitted)
      return
    }
    this.pointCount += event.kind === 'path' ? event.points.length : event.kind === 'raw' ? 1 : 0
    if (this.byId.size >= limits.events || this.pointCount > limits.points) throw new ImportFailure('inputLimit')
    this.byId.set(event.id, event)
  }

  values(): Event[] {
    return Array.from(this.byId.values())
  }
}

export function mergeEvents(base: Event[], incoming: Event[], diagnostics?: Diagnostics) {
  let omitted = 0
  const set = new EventSet(base, (_event, count) => { omitted += count })
  for (const event of incoming) set.add(event)
  if (omitted && diagnostics) diagnostics.counts.provenanceLimit =
    (diagnostics.counts.provenanceLimit ?? 0) + omitted
  return { events: set.values(), duplicates: set.duplicates, omitted }
}
