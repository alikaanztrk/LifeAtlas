import { ImportFailure } from '../domain/limits'

export const databaseName = 'LifeAtlas'

export async function hasLocalArchive() {
  if (typeof indexedDB.databases !== 'function') return true
  return withDatabaseLock(databaseName, async () => (await indexedDB.databases()).some((entry) => entry.name === databaseName))
}

export async function withDatabaseLock<T>(name: string, task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  return globalThis.navigator?.locks ? navigator.locks.request('LifeAtlas dataset writes:' + name, { signal }, task) : task()
}

export function storageFailure(error: unknown): ImportFailure {
  if (error instanceof ImportFailure) return error
  const isQuota = (value: unknown, depth = 0): boolean => {
    if (!value || typeof value !== 'object' || depth > 3) return false
    return ('name' in value && value.name === 'QuotaExceededError') ||
      ('inner' in value && isQuota(value.inner, depth + 1)) ||
      ('failures' in value && Array.isArray(value.failures) &&
        value.failures.some((item: unknown) => isQuota(item, depth + 1)))
  }
  return new ImportFailure(isQuota(error) ? 'quota' : 'storage')
}
