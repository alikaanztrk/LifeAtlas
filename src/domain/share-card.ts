import { knownMeters, semanticVisits } from './exploration'
import type { RewindReport } from './rewind'

export const shareFields = ['coverage', 'distance', 'movement', 'visits'] as const
export type ShareField = typeof shareFields[number]
export type ShareLayout = 'portrait' | 'square'

export const cardDimensions: Record<ShareLayout, { width: number; height: number }> = {
  portrait: { width: 1080, height: 1920 }, square: { width: 1080, height: 1080 },
}

export type ShareMeasurement =
  | { kind: 'coverage'; count: number; total: number }
  | { kind: 'distance'; meters: number; recorded: number | null; estimated: number | null }
  | { kind: 'movement'; ms: number }
  | { kind: 'visits'; count: number }

export function shareMeasurements(report: RewindReport, fields: readonly ShareField[]): ShareMeasurement[] {
  const summary = report.summary
  if (!summary || !summary.evidenceDays) return []
  const result: ShareMeasurement[] = []
  if (fields.includes('coverage')) result.push({ kind: 'coverage', count: summary.evidenceDays, total: report.includedDays })
  const meters = knownMeters(summary.distance)
  if (fields.includes('distance') && meters !== null) {
    result.push({ kind: 'distance', meters, recorded: summary.distance.recorded, estimated: summary.distance.estimated })
  }
  if (fields.includes('movement') && summary.movementMs !== null) result.push({ kind: 'movement', ms: summary.movementMs })
  const visits = semanticVisits(summary)
  if (fields.includes('visits') && visits !== null) result.push({ kind: 'visits', count: visits })
  return result
}
