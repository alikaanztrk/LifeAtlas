import { useEffect, useRef, useState } from 'react'
import { eventBatches, limits } from '../../domain/limits'
import type { Failure } from '../../domain/limits'
import type { Dataset, Event, ImportReport, Summary } from '../../domain/model'
import type { Commit, Request, Response } from '../../workers/protocol'

export type Retention = Commit['retention']
export type SessionData = { dataset: Dataset; events: Event[] }
export type Preview = { report: ImportReport; summary: Summary | null }
export type ImportState =
  | { step: 'idle'; note?: 'cancelled' }
  | { step: 'working'; progress: Extract<Response, { kind: 'progress' }> }
  | { step: 'review'; preview: Preview }
  | { step: 'saving'; progress: Extract<Response, { kind: 'progress' }>; cancelling?: boolean }
  | { step: 'error'; code: Failure }

type Job = { id: string; worker: Worker; events: Event[]; retention?: Retention; cancelling?: boolean }

export function useImport(callbacks: {
  onDemo: (preview: Preview, events: Event[]) => void
  onResult: (retention: Retention, result: SessionData) => void
  onChanged: () => void
}) {
  const [state, setState] = useState<ImportState>({ step: 'idle' })
  const active = useRef<Job | null>(null)

  useEffect(() => () => active.current?.worker.terminate(), [])

  function close(job: Job) {
    job.worker.terminate()
    if (active.current === job) active.current = null
  }

  function start(files: File[], demo = false) {
    if (active.current || !files.length) return
    const code = files.length > limits.fileCount ? 'tooManyFiles'
      : files.reduce((sum, file) => sum + file.size, 0) > limits.totalBytes ? 'sizeLimit' : undefined
    if (code) {
      setState({ step: 'error', code })
      return
    }
    let worker: Worker
    try {
      worker = new Worker(new URL('../../workers/import.worker.ts', import.meta.url), { type: 'module' })
    } catch {
      setState({ step: 'error', code: 'worker' })
      return
    }
    const job: Job = { id: crypto.randomUUID(), worker, events: [] }
    active.current = job
    setState({ step: 'working', progress: { kind: 'progress', job: job.id, phase: 'read' } })
    worker.onerror = (error) => {
      error.preventDefault()
      if (active.current !== job) return
      close(job)
      setState({ step: 'error', code: 'worker' })
    }
    worker.onmessageerror = () => {
      if (active.current !== job) return
      close(job)
      setState({ step: 'error', code: 'worker' })
    }
    worker.onmessage = ({ data }: MessageEvent<Response>) => {
      if (active.current !== job || data.job !== job.id) return
      switch (data.kind) {
        case 'progress':
          setState(job.retention
            ? { step: 'saving', progress: data, cancelling: job.cancelling }
            : { step: 'working', progress: data })
          break
        case 'preview':
          if (data.demo) {
            close(job)
            setState(data.summary ? { step: 'idle' } : { step: 'error', code: 'noUsableRecords' })
            if (data.summary) callbacks.onDemo(data, job.events)
          } else setState({ step: 'review', preview: data })
          break
        case 'batch':
          for (const item of data.events) job.events.push(item)
          break
        case 'result':
          close(job)
          setState({ step: 'idle' })
          if (job.retention) callbacks.onResult(job.retention, { dataset: data.dataset, events: job.events })
          break
        case 'error':
          close(job)
          if (data.code === 'changed') callbacks.onChanged()
          setState(data.code === 'cancelled' ? { step: 'idle', note: 'cancelled' } : { step: 'error', code: data.code })
          break
      }
    }
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
    worker.postMessage({ kind: 'start', job: job.id, files, zone, demo } satisfies Request)
  }

  function commit(retention: Retention, mode: Commit['mode'], existing: Dataset | null, base?: Event[]) {
    const job = active.current
    if (!job || job.retention || state.step !== 'review' || !state.preview.summary) return
    job.retention = retention
    setState({ step: 'saving', progress: { kind: 'progress', job: job.id, phase: 'analyze' } })
    job.worker.postMessage({ kind: 'commit', job: job.id, retention, mode, existing } satisfies Request)
    if (retention === 'session' && mode === 'merge' && existing) {
      const records = base ?? []
      for (const batch of eventBatches(records)) {
        job.worker.postMessage({
          kind: 'batch', job: job.id, events: batch,
        } satisfies Request)
      }
      job.worker.postMessage({ kind: 'baseReady', job: job.id } satisfies Request)
    }
  }

  function cancel() {
    const job = active.current
    if (job?.retention === 'persistent') {
      if (job.cancelling) return
      job.cancelling = true
      job.worker.postMessage({ kind: 'cancel', job: job.id } satisfies Request)
      setState((previous) => previous.step === 'saving' ? { ...previous, cancelling: true } : previous)
      return
    }
    if (job) close(job)
    setState({ step: 'idle', note: 'cancelled' })
  }

  function discard() {
    const job = active.current
    if (job && !job.retention) close(job)
    setState({ step: 'idle' })
  }

  return { state, start, commit, cancel, discard }
}
