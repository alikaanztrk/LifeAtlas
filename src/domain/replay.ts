import type { Exploration } from './exploration'
import type { Coordinate, Mode } from './model'
import { contains } from './primitives'
import type { Window } from './primitives'

type Position = { at: number; coord: Coordinate }
type Candidate = Position & { source: 'path' | 'raw'; next?: Position }
export type ReplaySample = {
  at: number; coord: Coordinate | null; source: 'path' | 'raw' | 'conflict'; continuous: boolean
}
export type Replay =
  | { kind: 'ready'; samples: ReplaySample[]; gaps: number; conflicts: number }
  | { kind: 'empty' | 'limit' }
export const replayLimit = 32_000

const samePosition = (a: Coordinate, b: Coordinate) => a.lat === b.lat && a.lon === b.lon

export function buildReplay(archive: Exploration, window?: Window, mode?: Mode): Replay {
  const candidates: Candidate[] = []
  for (const event of archive.events(window)) {
    if (event.kind === 'raw' && !mode) {
      candidates.push({ at: event.point.time.ms, coord: event.point.coord, source: 'raw' })
    }
    if (event.kind === 'path' && (!mode || archive.measurements.links.get(event.id)?.mode === mode)) {
      const edges = new Map((archive.measurements.byPath.get(event.id) ?? []).map((edge) => [edge.from, edge.to]))
      for (const [index, point] of event.points.entries()) {
        if (!point.time || !contains(point.time.ms, window)) continue
        const to = edges.get(index)
        const next = to === undefined ? undefined : event.points[to]
        candidates.push({
          at: point.time.ms, coord: point.coord, source: 'path',
          next: next?.time ? { at: next.time.ms, coord: next.coord } : undefined,
        })
        if (candidates.length > replayLimit) return { kind: 'limit' }
      }
    }
    if (candidates.length > replayLimit) return { kind: 'limit' }
  }
  if (!candidates.length) return { kind: 'empty' }
  candidates.sort((a, b) => a.at - b.at)
  const samples: ReplaySample[] = []
  let conflicts = 0
  let gaps = 0
  let previousLinks: Candidate[] = []
  for (let index = 0; index < candidates.length;) {
    const first = candidates[index]!
    let end = index + 1
    while (candidates[end]?.at === first.at) end++
    const group = candidates.slice(index, end)
    const conflict = group.some((candidate) => !samePosition(first.coord, candidate.coord))
    if (conflict) conflicts++
    const previous = samples.at(-1)
    if (previous) {
      previous.continuous = !conflict && previousLinks.some(({ next }) => next?.at === first.at && samePosition(next.coord, first.coord))
      if (!previous.continuous) gaps++
    }
    samples.push({
      at: first.at, coord: conflict ? null : first.coord, continuous: false,
      source: conflict ? 'conflict' : group.some(({ source }) => source === 'path') ? 'path' : 'raw',
    })
    previousLinks = conflict ? [] : group
    index = end
  }
  return { kind: 'ready', samples, gaps, conflicts }
}

function cursor(samples: ReplaySample[], at: number): number {
  let low = 0
  let high = samples.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if (samples[middle]!.at <= at) low = middle + 1
    else high = middle
  }
  return low - 1
}

export function replayFrame(samples: ReplaySample[], at: number) {
  const sample = samples[cursor(samples, at)]
  if (!sample) return { kind: 'gap' } as const
  if (sample.at === at && !sample.coord) return { kind: 'conflict' } as const
  if (!sample.coord || (sample.at !== at && !sample.continuous)) return { kind: 'gap' } as const
  return { kind: sample.at === at ? 'observation' as const : 'held' as const, sample, coord: sample.coord }
}

export function replayStep(samples: ReplaySample[], at: number, step: -1 | 1): number | undefined {
  const index = cursor(samples, at)
  const current = samples[index]
  const target = step === 1 ? index + 1 : current?.at === at ? index - 1 : index
  return samples[target]?.at
}
