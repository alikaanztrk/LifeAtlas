import { useEffect, useRef, useState } from 'react'
import { eventBatches } from '../domain/limits'
import type { Dataset, Event } from '../domain/model'
import type { ExploreQuery, ExploreRequest, ExploreResponse, ExploreResult } from '../workers/explore-protocol'
import type { Journal } from '../domain/edits'

export type ArchiveSource = { kind: 'saved'; dataset: Dataset } | { kind: 'memory'; events: Event[] }

type Request = { sequence: number; key: string; query: ExploreQuery }
type Answer = { key: string; result?: ExploreResult }
type Connection = { worker: Worker; ready: boolean; running?: Request; queued?: Request }

function flush(connection: Connection) {
  if (!connection.ready || connection.running || !connection.queued) return
  const { sequence, query } = connection.queued
  connection.running = connection.queued
  connection.queued = undefined
  connection.worker.postMessage({ type: 'query', sequence, query } satisfies ExploreRequest)
}

export function useArchiveQuery(source: ArchiveSource, query: ExploreQuery | null, version: string, journal: Journal) {
  const [answer, setAnswer] = useState<Answer>()
  const [startupError, setStartupError] = useState(false)
  const [retry, setRetry] = useState(0)
  const active = useRef<Connection | null>(null)
  const sequence = useRef(0)
  const request = query ? JSON.stringify(query) : ''
  const key = request ? version + ':' + journal.revision + ':' + request : ''
  const saved = source.kind === 'saved' ? source.dataset : undefined
  const records = source.kind === 'memory' ? source.events : undefined

  useEffect(() => {
    let worker: Worker
    try {
      worker = new Worker(new URL('../workers/explore.worker.ts', import.meta.url), { type: 'module' })
    } catch {
      setStartupError(true)
      return
    }
    const connection: Connection = { worker, ready: false }
    active.current = connection
    const error = () => { if (active.current === connection) setStartupError(true) }
    worker.onerror = (event) => { event.preventDefault(); error() }
    worker.onmessageerror = error
    worker.onmessage = ({ data }: MessageEvent<ExploreResponse>) => {
      if (active.current !== connection) return
      if (data.type === 'ready') {
        connection.ready = true
        flush(connection)
        return
      }
      if (data.type === 'error' && data.sequence === undefined) {
        error()
        return
      }
      const running = connection.running
      if (!running || running.sequence !== data.sequence) return
      connection.running = undefined
      if (!connection.queued) {
        setAnswer({ key: running.key, result: data.type === 'result' ? data.result : undefined })
      }
      flush(connection)
    }
    worker.postMessage({ type: 'seed', saved } satisfies ExploreRequest)
    let timer: number | undefined
    if (records) {
      const batches = eventBatches(records)
      const push = () => {
        for (let index = 0; index < 16; index++) {
          const batch = batches.next()
          if (batch.done) {
            worker.postMessage({ type: 'seedDone' } satisfies ExploreRequest)
            return
          }
          worker.postMessage({ type: 'batch', events: batch.value } satisfies ExploreRequest)
        }
        timer = window.setTimeout(push, 0)
      }
      push()
    }
    return () => {
      clearTimeout(timer)
      worker.terminate()
      active.current = null
    }
  }, [saved, records, retry])

  useEffect(() => {
    const connection = active.current
    if (!connection) return
    connection.worker.postMessage({ type: 'journal', journal } satisfies ExploreRequest)
  }, [journal, retry, saved, records])

  useEffect(() => {
    const connection = active.current
    if (!connection) return
    connection.queued = key ? { sequence: ++sequence.current, key, query: JSON.parse(request) as ExploreQuery } : undefined
    flush(connection)
  }, [key, request, retry, saved, records])

  return {
    result: answer?.key === key ? answer.result : undefined,
    error: startupError || Boolean(key && answer?.key === key && !answer.result),
    retry: () => { setStartupError(false); setAnswer(undefined); setRetry((count) => count + 1) },
  }
}
