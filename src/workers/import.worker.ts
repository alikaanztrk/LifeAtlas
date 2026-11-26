import { mergeEvents } from '../domain/identity'
import { eventBatches, ImportFailure } from '../domain/limits'
import type { Dataset, Event, Format } from '../domain/model'
import { summarize } from '../domain/summary'
import { publishDataset, readEvents, storageFailure } from '../storage/database'
import { prepare } from './prepare'
import { isRequest } from './protocol'
import type { Commit, Response, Start } from './protocol'

const worker = self as DedicatedWorkerGlobalScope
const send = (message: Response) => worker.postMessage(message)
const abort = new AbortController()
let current: Start | undefined
let prepared: Awaited<ReturnType<typeof prepare>> | undefined
let commit: Commit | undefined
let base: Event[] = []
let saving = false

const fail = (job: string, error: unknown) => {
  const code = abort.signal.aborted ? 'cancelled' : error instanceof ImportFailure ? error.code : 'worker'
  send({ kind: 'error', job, code })
}

async function start(message: Start) {
  current = message
  try {
    prepared = await prepare(message.files, message.zone,
      (detail) => send({ kind: 'progress', job: message.job, ...detail }))
    if (message.demo) {
      for (const events of eventBatches(prepared.events)) send({ kind: 'batch', job: message.job, events })
    }
    send({
      kind: 'preview', job: message.job, report: prepared.diagnostics.report(),
      summary: prepared.summary, demo: message.demo,
    })
  } catch (error) {
    fail(message.job, error)
  }
}

async function save(message: Commit) {
  if (saving || !prepared?.summary || !current || current.demo) return
  saving = true
  const { job, retention, mode, existing } = message
  try {
    send({ kind: 'progress', job, phase: 'analyze' })
    const merge = mode === 'merge' && existing !== null
    if (merge && retention === 'persistent') {
      try {
        base = await readEvents(existing)
      } catch (error) {
        throw storageFailure(error)
      }
    }
    const { diagnostics } = prepared
    const normalized = merge ? mergeEvents(base, prepared.events, diagnostics) :
      { events: prepared.events, duplicates: 0 }
    base = []
    const formats = new Set<Format>(merge ? existing.formats : [])
    for (const file of diagnostics.files) if (file.format && file.accepted) formats.add(file.format)
    const dataset: Dataset = {
      id: merge ? existing.id : crypto.randomUUID(),
      revision: crypto.randomUUID(),
      updatedAt: Date.now(),
      formats: [...formats],
      summary: merge ? summarize(normalized.events, current.zone) : prepared.summary,
      report: diagnostics.report(),
      mergedDuplicates: normalized.duplicates,
    }
    const events = normalized.events
    send({ kind: 'progress', job, phase: 'save' })
    if (retention === 'persistent') {
      try {
        await publishDataset(dataset, events, existing?.revision, abort.signal)
      } catch (error) {
        throw storageFailure(error)
      }
    } else {
      for (const batch of eventBatches(events)) {
        abort.signal.throwIfAborted()
        send({ kind: 'batch', job, events: batch })
      }
    }
    send({ kind: 'result', job, dataset })
  } catch (error) {
    fail(job, error)
  }
}

worker.onmessage = (event: MessageEvent<unknown>) => {
  const request = event.data
  if (!isRequest(request)) return
  if (request.kind === 'start' && !current) {
    void start(request)
    return
  }
  if (!current || request.job !== current.job) return
  if (request.kind === 'cancel') abort.abort()
  if (request.kind === 'commit' && !commit && prepared?.summary) {
    commit = request
    if (commit.mode !== 'merge' || commit.retention !== 'session' || !commit.existing) void save(commit)
  } else if (request.kind === 'batch' && commit?.retention === 'session' && !saving) {
    for (const item of request.events) base.push(item)
  } else if (request.kind === 'baseReady' && commit?.retention === 'session') void save(commit)
}
