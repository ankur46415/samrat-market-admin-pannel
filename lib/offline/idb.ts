const DB_NAME = "samrat-offline-v1"
const DB_VERSION = 1

export const STORE_PRODUCTS = "products"
export const STORE_PENDING_BILLS = "pendingBills"
export const STORE_KV = "kv"

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available"))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_PRODUCTS)) {
        db.createObjectStore(STORE_PRODUCTS, { keyPath: "id" })
      }
      if (!db.objectStoreNames.contains(STORE_PENDING_BILLS)) {
        db.createObjectStore(STORE_PENDING_BILLS, { keyPath: "id" })
      }
      if (!db.objectStoreNames.contains(STORE_KV)) {
        db.createObjectStore(STORE_KV)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error("Failed to open offline database"))
  })
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function idbPut<T>(storeName: string, value: T, key?: IDBValidKey): Promise<void> {
  const db = await openDb()
  try {
    const tx = db.transaction(storeName, "readwrite")
    const store = tx.objectStore(storeName)
    await reqToPromise(key !== undefined ? store.put(value, key) : store.put(value))
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

export async function idbGet<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDb()
  try {
    const tx = db.transaction(storeName, "readonly")
    const result = await reqToPromise(tx.objectStore(storeName).get(key))
    return result as T | undefined
  } finally {
    db.close()
  }
}

export async function idbGetAll<T>(storeName: string): Promise<T[]> {
  const db = await openDb()
  try {
    const tx = db.transaction(storeName, "readonly")
    const result = await reqToPromise(tx.objectStore(storeName).getAll())
    return (result as T[]) ?? []
  } finally {
    db.close()
  }
}

export async function idbDelete(storeName: string, key: IDBValidKey): Promise<void> {
  const db = await openDb()
  try {
    const tx = db.transaction(storeName, "readwrite")
    await reqToPromise(tx.objectStore(storeName).delete(key))
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

export async function idbReplaceAll<T extends { id: string }>(storeName: string, values: T[]): Promise<void> {
  const db = await openDb()
  try {
    const tx = db.transaction(storeName, "readwrite")
    const store = tx.objectStore(storeName)
    store.clear()
    for (const row of values) {
      store.put(row)
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"))
    })
  } finally {
    db.close()
  }
}

export async function idbClear(storeName: string): Promise<void> {
  const db = await openDb()
  try {
    const tx = db.transaction(storeName, "readwrite")
    await reqToPromise(tx.objectStore(storeName).clear())
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}
