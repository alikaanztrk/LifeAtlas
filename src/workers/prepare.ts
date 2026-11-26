import { adapt, detect, shapeWithinLimits } from '../domain/adapters'
import { Diagnostics } from '../domain/diagnostics'
import { EventSet, fingerprint, identify } from '../domain/identity'
import { ImportFailure, limits } from '../domain/limits'
import type { FileReport, Source } from '../domain/model'
import type { Response } from './protocol'
import { summarize } from '../domain/summary'

type Progress = Omit<Extract<Response, { kind: 'progress' }>, 'kind' | 'job'>

export function validateSelection(files: File[]) {
  if (files.length > limits.fileCount) throw new ImportFailure('tooManyFiles')
  if (files.reduce((total, file) => total + file.size, 0) > limits.totalBytes) throw new ImportFailure('sizeLimit')
}

export async function prepare(files: File[], zone: string, progress: (detail: Progress) => void) {
  validateSelection(files)
  const diagnostics = new Diagnostics()
  const unique = new EventSet([], (event, omitted) => {
    if (omitted) diagnostics.at(diagnostics.files.length, event.source.index)('provenanceLimit', omitted)
  })
  let totalRecords = 0

  for (const [index, file] of files.entries()) {
    const slot = index + 1
    const warn = diagnostics.at(slot)
    const report: FileReport = { slot, bytes: file.size, input: 0, accepted: 0, skipped: 0 }
    diagnostics.files.push(report)
    if (file.size > limits.fileBytes) {
      report.failure = 'sizeLimit'
      warn('sizeLimit')
      continue
    }
    progress({ phase: 'read', file: slot, completed: slot - 1, total: files.length })
    const bytes = new Uint8Array(await file.arrayBuffer())
    let parsed: unknown
    try {
      parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
    } catch {
      report.failure = 'invalidJson'
      warn('invalidJson')
      continue
    }
    if (!shapeWithinLimits(parsed, warn)) {
      report.failure = 'inputLimit'
      warn('inputLimit')
      continue
    }
    const detected = detect(parsed, warn)
    if (!detected) {
      report.failure = 'unknownFormat'
      warn('unknownFormat')
      continue
    }
    report.format = detected.format
    report.input = detected.entries.length
    if (totalRecords + report.input > limits.inputRecords) {
      report.failure = 'inputLimit'
      report.skipped = report.input
      warn('inputLimit')
      continue
    }
    totalRecords += report.input
    const fileKey = fingerprint(bytes)
    let lastProgress = -Infinity
    for (const [record, value] of detected.entries.entries()) {
      const now = performance.now()
      if (now - lastProgress >= 100) {
        progress({ phase: 'normalize', file: slot, completed: record, total: report.input })
        lastProgress = now
      }
      const source: Source = { fileKey, format: detected.format, index: record + 1, field: '' }
      const events = adapt(value, source, diagnostics.at(slot, record + 1))
      if (events.length) report.accepted++
      else report.skipped++
      for (const event of events) unique.add(identify(event))
    }
  }
  diagnostics.duplicates = unique.duplicates
  progress({ phase: 'analyze' })
  const events = unique.values()
  return { events, diagnostics, summary: events.length ? summarize(events, zone) : null }
}
