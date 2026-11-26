import type { Event } from './model'

export const limits = {
  fileCount: 12,
  fileBytes: 50 * 1024 * 1024,
  totalBytes: 64 * 1024 * 1024,
  inputRecords: 250_000,
  events: 250_000,
  points: 400_000,
  pointsPerPath: 2_000,
  depth: 32,
  stringLength: 32_768,
  objectKeys: 1_024,
  diagnostics: 24,
  provenance: 16,
  batch: 256,
} as const

export function* eventBatches(records: Event[]): Generator<Event[]> {
  let batch: Event[] = []
  let points = 0
  for (const event of records) {
    const size = event.kind === 'path' ? event.points.length : 1
    if (batch.length === limits.batch || points + size > 4_096) {
      yield batch
      batch = []
      points = 0
    }
    batch.push(event)
    points += size
  }
  if (batch.length) yield batch
}

export type Failure =
  | 'tooManyFiles' | 'sizeLimit' | 'inputLimit' | 'noUsableRecords'
  | 'worker' | 'storage' | 'quota' | 'changed' | 'cancelled'

export class ImportFailure extends Error {
  constructor(readonly code: Failure) {
    super(code)
  }
}
