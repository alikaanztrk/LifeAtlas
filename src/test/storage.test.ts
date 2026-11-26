import 'fake-indexeddb/auto'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Dataset } from '../domain/model'
import { demoFile } from '../fixtures/demo'
import { AtlasDatabase, eraseDataset, publishDataset, readDataset, readEvents, storageFailure } from '../storage/database'
import { prepare } from '../workers/prepare'

let db: AtlasDatabase
let data: Awaited<ReturnType<typeof prepare>>
let baseline: Dataset

beforeEach(async () => {
  db = new AtlasDatabase('test-atlas-' + crypto.randomUUID())
  data = await prepare([demoFile()], 'UTC', () => {})
  if (!data.summary) throw new Error('Missing synthetic data')
  baseline = {
    id: 'synthetic-base', revision: 'one', updatedAt: 0, formats: ['android'],
    summary: data.summary, report: data.diagnostics.report(), mergedDuplicates: 0,
  }
  await publishDataset(baseline, data.events, undefined, undefined, db)
})

afterEach(async () => { await db.delete() })

test('retrieves metadata and canonical records, then deletes individual and all data', async () => {
  expect(await readDataset(db)).toEqual(baseline)
  expect(await readEvents(baseline, db)).toHaveLength(24)
  await eraseDataset('one', false, db)
  expect(await readDataset(db)).toBeNull()
  await db.open()
  expect(await db.events.count()).toBe(0)
  db.close()
  await eraseDataset(undefined, true, db)
  expect((await indexedDB.databases()).some(({ name }) => name === db.name)).toBe(false)
})

test('rolls back a replacement on quota or write failure after rows were cleared', async () => {
  const failure = new DOMException('synthetic storage failure', 'QuotaExceededError')
  const insert = vi.spyOn(db.events, 'bulkAdd').mockRejectedValueOnce(failure)
  const replacement = { ...baseline, id: 'synthetic-next', revision: 'two' }
  const outcome = publishDataset(replacement, data.events, 'one', undefined, db)
  await expect(outcome).rejects.toThrow()
  await outcome.catch((error: unknown) => expect(storageFailure(error).code).toBe('quota'))
  insert.mockRestore()
  expect(await readDataset(db)).toEqual(baseline)
  expect(await readEvents(baseline, db)).toHaveLength(24)
})

test('aborts the active transaction and rolls back staging when cancellation arrives', async () => {
  const controller = new AbortController()
  db.events.hook('creating', () => { controller.abort() })
  await expect(publishDataset({ ...baseline, revision: 'two' }, data.events, 'one', controller.signal, db))
    .rejects.toThrow()
  expect(await readDataset(db)).toEqual(baseline)
  expect(await readEvents(baseline, db)).toHaveLength(24)
})

test('protects newer revisions from stale replace, read or erase', async () => {
  const replacement = { ...baseline, revision: 'two' }
  await publishDataset(replacement, data.events, 'one', undefined, db)
  await expect(publishDataset(baseline, [], 'one', undefined, db)).rejects.toMatchObject({ code: 'changed' })
  await expect(readEvents(baseline, db)).rejects.toMatchObject({ code: 'changed' })
  await expect(eraseDataset('one', true, db)).rejects.toMatchObject({ code: 'changed' })
  expect(await readDataset(db)).toEqual(replacement)
})
