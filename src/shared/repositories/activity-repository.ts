import { STORAGE_KEYS } from '../constants.js'
import { getLocalStorage, setLocalStorage } from '../storage.js'
import {
  CURATOR_DATA_STORES,
  applyCuratorDataStoreDelta,
  isCuratorDataDbAvailable,
  readCuratorDataStore,
  readCuratorDataStoreMeta,
  resetCuratorDataDbForTest,
  replaceCuratorDataStore,
  writeCuratorDataStoreMeta
} from './curator-data-db.js'

const NEW_TAB_ACTIVITY_REPOSITORY_META_KEY = 'newTabActivity'

export interface NewTabActivityRepositoryRecord {
  bookmarkId: string
  title: string
  url: string
  openCount: number
  firstOpenedAt: number
  lastOpenedAt: number
}

export interface NewTabActivityRepositoryState {
  pinnedIds: string[]
  records: Record<string, NewTabActivityRepositoryRecord>
}

export async function loadNewTabActivityFromRepository(
  normalizeActivity: (rawActivity: unknown) => NewTabActivityRepositoryState
): Promise<NewTabActivityRepositoryState> {
  const idbActivity = await loadNewTabActivityFromIndexedDb(normalizeActivity).catch(() => null)
  if (idbActivity) {
    const localActivity = await loadNewTabActivityFromLocalStorage(normalizeActivity).catch(() => normalizeActivity(null))
    if (
      Object.keys(localActivity.records).length &&
      (
        Object.keys(idbActivity.records).length === 0 ||
        getLatestActivityUpdatedAt(localActivity.records) > getLatestActivityUpdatedAt(idbActivity.records)
      )
    ) {
      await migrateNewTabActivityToIndexedDb(localActivity).catch(() => {})
      return localActivity
    }
    return {
      pinnedIds: localActivity.pinnedIds,
      records: idbActivity.records
    }
  }

  const localActivity = await loadNewTabActivityFromLocalStorage(normalizeActivity)
  if (Object.keys(localActivity.records).length && isCuratorDataDbAvailable()) {
    await migrateNewTabActivityToIndexedDb(localActivity).catch(() => {})
  }
  return localActivity
}

export async function saveNewTabActivityToRepository(
  activity: NewTabActivityRepositoryState,
  normalizeActivity: (rawActivity: unknown) => NewTabActivityRepositoryState
): Promise<NewTabActivityRepositoryState> {
  const normalized = normalizeActivity(activity)
  if (!isCuratorDataDbAvailable()) {
    await writeNewTabActivityToLocalStorage(normalized)
    return normalized
  }

  try {
    await replaceNewTabActivityInIndexedDb(normalized)
    await compactNewTabActivityLocalStorage(normalized).catch(() => {})
  } catch {
    await writeNewTabActivityToLocalStorage(normalized)
  }
  return normalized
}

export async function upsertNewTabActivityRecordInRepository(
  activity: NewTabActivityRepositoryState,
  record: NewTabActivityRepositoryRecord,
  normalizeActivity: (rawActivity: unknown) => NewTabActivityRepositoryState
): Promise<NewTabActivityRepositoryState> {
  const normalized = normalizeActivity({
    ...activity,
    records: {
      ...activity.records,
      [record.bookmarkId]: record
    }
  })
  if (!isCuratorDataDbAvailable()) {
    await writeNewTabActivityToLocalStorage(normalized)
    return normalized
  }

  try {
    await applyCuratorDataStoreDelta(
      CURATOR_DATA_STORES.activityRecords,
      [record],
      []
    )
    await writeNewTabActivityRepositoryMeta(normalized)
    await compactNewTabActivityLocalStorage(normalized).catch(() => {})
  } catch {
    await writeNewTabActivityToLocalStorage(normalized)
  }
  return normalized
}

export async function removeNewTabActivityRecordInRepository(
  activity: NewTabActivityRepositoryState,
  bookmarkId: string,
  normalizeActivity: (rawActivity: unknown) => NewTabActivityRepositoryState
): Promise<NewTabActivityRepositoryState> {
  const normalizedId = String(bookmarkId || '').trim()
  const records = { ...activity.records }
  delete records[normalizedId]
  const normalized = normalizeActivity({
    pinnedIds: activity.pinnedIds.filter((id) => id !== normalizedId),
    records
  })
  if (!isCuratorDataDbAvailable()) {
    await writeNewTabActivityToLocalStorage(normalized)
    return normalized
  }

  try {
    await applyCuratorDataStoreDelta(
      CURATOR_DATA_STORES.activityRecords,
      [],
      [normalizedId]
    )
    await writeNewTabActivityRepositoryMeta(normalized)
    await compactNewTabActivityLocalStorage(normalized).catch(() => {})
  } catch {
    await writeNewTabActivityToLocalStorage(normalized)
  }
  return normalized
}

export function resetNewTabActivityRepositoryForTest(): void {
  resetCuratorDataDbForTest()
}

async function loadNewTabActivityFromIndexedDb(
  normalizeActivity: (rawActivity: unknown) => NewTabActivityRepositoryState
): Promise<NewTabActivityRepositoryState | null> {
  if (!isCuratorDataDbAvailable()) {
    return null
  }

  const meta = await readCuratorDataStoreMeta(NEW_TAB_ACTIVITY_REPOSITORY_META_KEY)
  if (!meta) {
    return null
  }

  const records = await readCuratorDataStore<NewTabActivityRepositoryRecord>(CURATOR_DATA_STORES.activityRecords)
  if (records.length < meta.recordCount) {
    return null
  }

  return normalizeActivity({
    records: Object.fromEntries(records.map((record) => [record.bookmarkId, record]))
  })
}

async function loadNewTabActivityFromLocalStorage(
  normalizeActivity: (rawActivity: unknown) => NewTabActivityRepositoryState
): Promise<NewTabActivityRepositoryState> {
  const stored = await getLocalStorage([STORAGE_KEYS.newTabActivity])
  return normalizeActivity(stored[STORAGE_KEYS.newTabActivity])
}

async function migrateNewTabActivityToIndexedDb(activity: NewTabActivityRepositoryState): Promise<void> {
  await replaceNewTabActivityInIndexedDb(activity)
  await compactNewTabActivityLocalStorage(activity).catch(() => {})
}

async function replaceNewTabActivityInIndexedDb(activity: NewTabActivityRepositoryState): Promise<void> {
  await replaceCuratorDataStore(
    CURATOR_DATA_STORES.activityRecords,
    Object.values(activity.records)
  )
  await writeNewTabActivityRepositoryMeta(activity)
}

async function writeNewTabActivityRepositoryMeta(activity: NewTabActivityRepositoryState): Promise<void> {
  await writeCuratorDataStoreMeta({
    key: NEW_TAB_ACTIVITY_REPOSITORY_META_KEY,
    version: 1,
    updatedAt: getLatestActivityUpdatedAt(activity.records),
    recordCount: Object.keys(activity.records || {}).length,
    migratedAt: Date.now(),
    compactedAt: Date.now()
  })
}

async function compactNewTabActivityLocalStorage(activity: NewTabActivityRepositoryState): Promise<void> {
  await setLocalStorage({
    [STORAGE_KEYS.newTabActivity]: {
      pinnedIds: activity.pinnedIds,
      records: {},
      migratedTo: 'indexedDB',
      repository: NEW_TAB_ACTIVITY_REPOSITORY_META_KEY,
      recordCount: Object.keys(activity.records || {}).length,
      updatedAt: getLatestActivityUpdatedAt(activity.records),
      compactedAt: Date.now()
    }
  })
}

async function writeNewTabActivityToLocalStorage(activity: NewTabActivityRepositoryState): Promise<void> {
  await setLocalStorage({
    [STORAGE_KEYS.newTabActivity]: activity
  })
}

function getLatestActivityUpdatedAt(records: Record<string, NewTabActivityRepositoryRecord>): number {
  return Object.values(records || {}).reduce((latest, record) => {
    return Math.max(latest, Number(record.lastOpenedAt) || 0)
  }, 0)
}
