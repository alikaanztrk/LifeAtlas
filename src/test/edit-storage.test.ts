import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { expect, test } from 'vitest'
import { emptyJournal } from '../domain/edits'
import type { Journal } from '../domain/edits'
import type { Dataset } from '../domain/model'
import { demoFile } from '../fixtures/demo'
import { AtlasDatabase, eraseDataset, publishDataset, readArchive, readEvents, writeJournal } from '../storage/database'
import { prepare } from '../workers/prepare'

async function archive() {
  const result = await prepare([demoFile()], 'UTC', () => {})
  if (!result.summary) throw new Error('synthetic setup')
  const dataset: Dataset = { id: 'synthetic-dataset', revision: 'v1', updatedAt: 0, formats: ['android'],
    summary: result.summary, report: result.diagnostics.report(), mergedDuplicates: 0 }
  return { dataset, events: result.events }
}

test('migrates a version-one archive and keeps normalized records intact', async () => {
  const name = 'lifeatlas-migration-test-' + crypto.randomUUID()
  const original = new Dexie(name)
  original.version(1).stores({ datasets: 'slot', events: '[datasetId+id], datasetId, [datasetId+start]' })
  const { dataset, events } = await archive()
  try {
    await original.table('datasets').put({ slot: 'archive', dataset })
    await original.table('events').bulkAdd(events.map((event) => ({ datasetId: dataset.id, id: event.id, event })))
    original.close()
    const newConnection = () => new AtlasDatabase(name)
    expect(await readArchive(newConnection())).toEqual({ dataset, journal: emptyJournal })
    expect(await readEvents(dataset, newConnection())).toHaveLength(events.length)
  } finally { original.close(); await original.delete() }
})

test('checks edit versions atomically and keeps edits on merge, then clears them on replacement and erase', async () => {
  const name = 'lifeatlas-edit-test-' + crypto.randomUUID()
  const db = () => new AtlasDatabase(name)
  const { dataset, events } = await archive()
  const visit = events.find((event) => event.kind === 'visit')
  if (!visit) throw new Error('synthetic setup')
  const journal = (revision: string, label: string): Journal => ({
    revision, actions: [{ kind: 'label', visit: visit.id, label: { name: label, tags: [], category: 'none' } }],
  })
  try {
    await publishDataset(dataset, events, undefined, undefined, db())
    const concurrent = await Promise.allSettled([
      writeJournal(dataset, emptyJournal.revision, journal('one', 'Synthetic 1'), db()),
      writeJournal(dataset, emptyJournal.revision, journal('two', 'Synthetic 2'), db()),
    ])
    expect(concurrent.filter(({ status }) => status === 'fulfilled')).toHaveLength(1)
    expect(concurrent.find(({ status }) => status === 'rejected')).toMatchObject({ reason: { code: 'changed' } })
    const before = await readArchive(db())
    const merged = { ...dataset, revision: 'merge' }
    await publishDataset(merged, events, dataset.revision, undefined, db())
    expect((await readArchive(db()))?.journal).toEqual(before?.journal)
    await expect(writeJournal(dataset, before?.journal.revision ?? '', journal('late', 'Stale synthetic'), db()))
      .rejects.toMatchObject({ code: 'changed' })
    const replacement = { ...dataset, id: 'synthetic-replacement', revision: 'replace' }
    await publishDataset(replacement, events, merged.revision, undefined, db())
    expect((await readArchive(db()))?.journal).toEqual(emptyJournal)
    await writeJournal(replacement, emptyJournal.revision, journal('new', 'Synthetic replacement edit'), db())
    await eraseDataset(replacement.revision, false, db())
    expect(await readArchive(db())).toBeNull()
    const remaining = db()
    await remaining.open()
    expect(await remaining.edits.count()).toBe(0)
    remaining.close()
  } finally { await db().delete() }
})
