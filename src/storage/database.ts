import Dexie from 'dexie'
import type { Table } from 'dexie'
import { eventBatches, ImportFailure } from '../domain/limits'
import type { Dataset, Event } from '../domain/model'
import { emptyJournal, isJournal } from '../domain/edits'
import type { Journal } from '../domain/edits'
import { databaseName, withDatabaseLock } from './browser'
export { storageFailure } from './browser'

const slot = 'archive'
type StoredDataset = { slot: string; dataset: Dataset }
type StoredEvent = { datasetId: string; id: string; start?: number; event: Event }
type StoredJournal = { datasetId: string; journal: Journal }
export type ArchiveSnapshot = { dataset: Dataset; journal: Journal }

export class AtlasDatabase extends Dexie {
  datasets!: Table<StoredDataset, string>
  events!: Table<StoredEvent, [string, string]>
  edits!: Table<StoredJournal, string>

  constructor(name = databaseName) {
    super(name)
    this.version(1).stores({
      datasets: 'slot',
      events: '[datasetId+id], datasetId, [datasetId+start]',
    })
    this.version(2).stores({ edits: 'datasetId' })
    this.on('versionchange', () => { this.close() })
  }
}

function start(event: Event): number | undefined {
  if (event.kind === 'raw') return event.point.time.ms
  return event.start?.ms ?? (event.kind === 'path' ? event.points.find((point) => point.time)?.time?.ms : undefined)
}

async function current(db: AtlasDatabase) {
  return (await db.datasets.get(slot))?.dataset ?? null
}

function requireRevision(dataset: Dataset | null, expected: string | undefined) {
  if (dataset?.revision !== expected) throw new ImportFailure('changed')
}

export async function readDataset(db = new AtlasDatabase()): Promise<Dataset | null> {
  return (await readArchive(db))?.dataset ?? null
}

export async function readArchive(db = new AtlasDatabase()): Promise<ArchiveSnapshot | null> {
  try {
    return await withDatabaseLock(db.name, async () => {
      if (!await databaseExists(db.name)) return null
      await db.open()
      return await db.transaction('r', db.datasets, db.edits, async () => {
        const dataset = await current(db)
        if (!dataset) return null
        const journal = (await db.edits.get(dataset.id))?.journal ?? emptyJournal
        if (!isJournal(journal)) throw new ImportFailure('storage')
        return { dataset, journal }
      })
    })
  } finally {
    db.close()
  }
}

export async function writeJournal(dataset: Dataset, expected: string, journal: Journal, db = new AtlasDatabase()) {
  if (!isJournal(journal)) throw new ImportFailure('storage')
  try {
    await withDatabaseLock(db.name, async () => {
      if (!await databaseExists(db.name)) throw new ImportFailure('changed')
      await db.open()
      await db.transaction('rw', db.datasets, db.edits, async () => {
        const active = await current(db)
        requireRevision(active, dataset.revision)
        if (active?.id !== dataset.id) throw new ImportFailure('changed')
        const previous = (await db.edits.get(dataset.id))?.journal ?? emptyJournal
        if (previous.revision !== expected) throw new ImportFailure('changed')
        await db.edits.put({ datasetId: dataset.id, journal })
      })
    })
  } finally {
    db.close()
  }
}

export async function readEvents(expected: Dataset, db = new AtlasDatabase()): Promise<Event[]> {
  try {
    return await withDatabaseLock(db.name, async () => {
      if (!await databaseExists(db.name)) throw new ImportFailure('changed')
      await db.open()
      return await db.transaction('r', db.datasets, db.events, async () => {
        requireRevision(await current(db), expected.revision)
        const records = await db.events.where('datasetId').equals(expected.id).toArray()
        return records.map(({ event }) => event)
      })
    })
  } finally {
    db.close()
  }
}

async function databaseExists(name: string): Promise<boolean> {
  return typeof indexedDB.databases === 'function'
    ? (await indexedDB.databases()).some((entry) => entry.name === name)
    : Dexie.exists(name)
}

export async function publishDataset(
  dataset: Dataset, records: Event[], expected: string | undefined,
  signal?: AbortSignal, db = new AtlasDatabase(),
): Promise<void> {
  try {
    await withDatabaseLock(db.name, async () => {
      signal?.throwIfAborted()
      if (expected !== undefined && !await databaseExists(db.name)) throw new ImportFailure('changed')
      await db.open()
      await db.transaction('rw', db.datasets, db.events, db.edits, async (transaction) => {
        const abort = () => transaction.abort()
        signal?.addEventListener('abort', abort, { once: true })
        try {
          signal?.throwIfAborted()
          const previous = await current(db)
          requireRevision(previous, expected)
          if (previous?.id !== dataset.id) await db.edits.clear()
          await db.events.clear()
          for (const batch of eventBatches(records)) {
            signal?.throwIfAborted()
            await db.events.bulkAdd(batch.map((event) => ({
              datasetId: dataset.id, id: event.id, start: start(event), event,
            })))
          }
          signal?.throwIfAborted()
          await db.datasets.put({ slot, dataset })
        } finally {
          signal?.removeEventListener('abort', abort)
        }
      })
    }, signal)
  } finally {
    db.close()
  }
}

export async function eraseDataset(expected: string | undefined, drop = false, db = new AtlasDatabase()) {
  try {
    await withDatabaseLock(db.name, async () => {
      if (!await databaseExists(db.name)) {
        requireRevision(null, expected)
        return
      }
      await db.open()
      if (drop) {
        requireRevision(await current(db), expected)
        db.close()
        await db.delete()
      } else {
        await db.transaction('rw', db.datasets, db.events, db.edits, async () => {
          requireRevision(await current(db), expected)
          await db.events.clear()
          await db.edits.clear()
          await db.datasets.clear()
        })
      }
    })
  } finally {
    db.close()
  }
}
