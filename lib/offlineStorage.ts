import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'habakkuk-offline';
const STORE_NAME = 'sync_queue';
const METADATA_STORE = 'metadata';
const DB_VERSION = 3; // Upgraded version to include metadata store

export interface QueuedAction {
  id: string;
  url: string;
  method: string;
  body: any;
  headers: Record<string, string>;
  synced: boolean;
  createdAt: string;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

export const getDB = () => {
  if (typeof window === 'undefined') return null;

  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('transactions', { keyPath: 'id' });
        }
        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          }
        }
        if (oldVersion < 3) {
          if (!db.objectStoreNames.contains(METADATA_STORE)) {
            db.createObjectStore(METADATA_STORE);
          }
        }
      },
    });
  }

  return dbPromise;
};

export const queueMutation = async (url: string, method: string, body: any, headers: Record<string, string> = {}) => {
  const db = await getDB();
  if (!db) return null;

  const action: QueuedAction = {
    id: Date.now().toString(),
    url,
    method,
    body,
    headers,
    synced: false,
    createdAt: new Date().toISOString(),
  };

  await db.add(STORE_NAME, action);

  // Register sync via service worker if available
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then((sw: any) => {
      if (sw.sync) sw.sync.register('sync-mutations');
    });
  }

  return action;
};

export const getPendingActions = async (): Promise<QueuedAction[]> => {
  const db = await getDB();
  if (!db) return [];

  const all = await db.getAll(STORE_NAME);
  return all.filter(action => !action.synced);
};

export const markActionSynced = async (id: string) => {
  const db = await getDB();
  if (!db) return;

  const action = await db.get(STORE_NAME, id);
  if (action) {
    action.synced = true;
    await db.put(STORE_NAME, action);
  }
};

export const saveOfflineTransaction = async (transaction: any) => {
  const db = await getDB();
  if (!db) return;
  await db.put('transactions', transaction);
};

export const getOfflineTransaction = async (id: string) => {
  const db = await getDB();
  if (!db) return null;
  return await db.get('transactions', id);
};

export const saveMetadata = async (key: string, data: any) => {
  const db = await getDB();
  if (!db) return;
  await db.put(METADATA_STORE, data, key);
};

export const getMetadata = async (key: string) => {
  const db = await getDB();
  if (!db) return null;
  return await db.get(METADATA_STORE, key);
};
