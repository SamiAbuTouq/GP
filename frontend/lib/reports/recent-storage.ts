import type { GeneratedReportRecord } from "./types"

const DB_NAME = "combine3-reports"
const DB_VERSION = 1
const STORE = "recentReports"

type StoredRecord = Omit<GeneratedReportRecord, "generatedAt"> & {
  generatedAtIso: string
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error("Failed to open IndexedDB"))
  })
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"))
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"))
  })
}

function toStored(r: GeneratedReportRecord): StoredRecord {
  // Blob is structured-cloneable and can be stored in IndexedDB.
  const { generatedAt, ...rest } = r
  return { ...rest, generatedAtIso: generatedAt.toISOString() }
}

function fromStored(r: StoredRecord): GeneratedReportRecord {
  const { generatedAtIso, ...rest } = r
  return { ...rest, generatedAt: new Date(generatedAtIso) }
}

export async function loadRecentReports(): Promise<GeneratedReportRecord[]> {
  const db = await openDb()
  const tx = db.transaction(STORE, "readonly")
  const store = tx.objectStore(STORE)
  const req = store.getAll()
  const rows: StoredRecord[] = await new Promise((resolve, reject) => {
    req.onsuccess = () => resolve((req.result ?? []) as StoredRecord[])
    req.onerror = () => reject(req.error ?? new Error("Failed to read reports"))
  })
  await txDone(tx)
  db.close()
  // Sort newest first for UI consistency.
  return rows
    .map(fromStored)
    .sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime())
}

export async function saveRecentReport(r: GeneratedReportRecord): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(STORE, "readwrite")
  tx.objectStore(STORE).put(toStored(r))
  await txDone(tx)
  db.close()
}

export async function deleteRecentReport(id: string): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(STORE, "readwrite")
  tx.objectStore(STORE).delete(id)
  await txDone(tx)
  db.close()
}

export async function clearRecentReports(): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(STORE, "readwrite")
  tx.objectStore(STORE).clear()
  await txDone(tx)
  db.close()
}

