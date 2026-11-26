import type { Failure } from '../domain/limits'
import type { Dataset, Event, ImportReport, Summary } from '../domain/model'

export type Phase = 'read' | 'normalize' | 'analyze' | 'save'

export type Start = {
  kind: 'start'; job: string; files: File[]; zone: string; demo: boolean
}
export type Commit = {
  kind: 'commit'; job: string; mode: 'merge' | 'replace'; retention: 'session' | 'persistent';
  existing: Dataset | null
}
export type Request = Start | Commit | { kind: 'batch'; job: string; events: Event[] } |
  { kind: 'baseReady'; job: string } | { kind: 'cancel'; job: string }

export type Response =
  | { kind: 'progress'; job: string; phase: Phase; file?: number; completed?: number; total?: number }
  | { kind: 'preview'; job: string; report: ImportReport; summary: Summary | null; demo: boolean }
  | { kind: 'batch'; job: string; events: Event[] }
  | { kind: 'result'; job: string; dataset: Dataset }
  | { kind: 'error'; job: string; code: Failure }

export function isRequest(input: unknown): input is Request {
  if (typeof input !== 'object' || input === null || !('kind' in input) || !('job' in input) ||
      typeof input.job !== 'string') return false
  switch (input.kind) {
    case 'start':
      return 'files' in input && Array.isArray(input.files) && input.files.every((file: unknown) => file instanceof File) &&
        'zone' in input && typeof input.zone === 'string' && 'demo' in input && typeof input.demo === 'boolean'
    case 'commit':
      return 'mode' in input && (input.mode === 'merge' || input.mode === 'replace') &&
        'retention' in input && (input.retention === 'session' || input.retention === 'persistent') &&
        'existing' in input && (input.existing === null || typeof input.existing === 'object')
    case 'batch': return 'events' in input && Array.isArray(input.events)
    case 'baseReady': case 'cancel': return true
    default: return false
  }
}
