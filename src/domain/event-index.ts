import type { Event } from './model'
import type { Window } from './primitives'

export function evidenceBounds(event: Event): Window | undefined {
  if (event.kind === 'raw') return { start: event.point.time.ms, end: event.point.time.ms + 1 }
  if (event.kind !== 'path') {
    return { start: event.start.ms, end: Math.max(event.start.ms + 1, event.end.ms) }
  }
  let start = Math.min(event.start?.ms ?? Infinity, event.end?.ms ?? Infinity)
  let end = Math.max(event.start?.ms ?? -Infinity, event.end?.ms ?? -Infinity)
  for (const point of event.points) if (point.time) {
    start = Math.min(start, point.time.ms)
    end = Math.max(end, point.time.ms)
  }
  return Number.isFinite(start) ? { start, end: end + 1 } : undefined
}

export class EventIndex {
  private readonly rows: { event: Event; bounds: Window; prefixEnd: number }[]

  constructor(private readonly events: Event[]) {
    this.rows = events.flatMap((event) => {
      const bounds = evidenceBounds(event)
      return bounds ? [{ event, bounds, prefixEnd: bounds.end }] : []
    }).sort((a, b) => a.bounds.start - b.bounds.start)
    let end = -Infinity
    for (const row of this.rows) {
      end = Math.max(end, row.bounds.end)
      row.prefixEnd = end
    }
  }

  at(window?: Window, limit = Infinity): Event[] {
    if (!window) return this.events
    let low = 0
    let high = this.rows.length
    while (low < high) {
      const middle = (low + high) >>> 1
      const row = this.rows[middle]
      if (row && row.bounds.start < window.end) low = middle + 1
      else high = middle
    }
    const matches: Event[] = []
    for (let index = low - 1; index >= 0; index--) {
      const row = this.rows[index]
      if (!row || row.prefixEnd <= window.start) break
      if (row.bounds.end > window.start) {
        matches.push(row.event)
        if (matches.length >= limit) break
      }
    }
    return matches.reverse()
  }

  bounds(): Window | undefined {
    const first = this.rows[0]
    const last = this.rows.at(-1)
    return first && last ? { start: first.bounds.start, end: last.prefixEnd } : undefined
  }
}
