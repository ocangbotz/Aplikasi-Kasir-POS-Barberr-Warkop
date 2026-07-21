/**
 * db-cache.js — wrapper IndexedDB untuk offline support:
 *  - `offlineQueue`: antrean aksi (mis. transaksi) yang dibuat saat offline,
 *    dikirim ulang otomatis saat online kembali (dipakai mulai Fase 4/5).
 *  - `cache`: cache generik ber-TTL untuk data GET-like (settings, master data)
 *    supaya UI tetap tampil cepat/offline walau request terbaru gagal.
 *  - `drafts`: autosave draft form (transaksi belum selesai diisi).
 *
 * Bergantung pada `indexedDB` global browser — tidak bisa & tidak perlu diuji
 * lewat Node (mirip Db.js di backend yang bergantung SpreadsheetApp). Helper
 * murni (`isCacheEntryExpired`) dipisah supaya tetap testable.
 */

const DB_NAME = 'pos-barber-warkop';
const DB_VERSION = 1;
const STORES = { QUEUE: 'offlineQueue', CACHE: 'cache', DRAFTS: 'drafts' };

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORES.QUEUE)) {
        db.createObjectStore(STORES.QUEUE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.CACHE)) {
        db.createObjectStore(STORES.CACHE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORES.DRAFTS)) {
        db.createObjectStore(STORES.DRAFTS, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function reqToResult(store, req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbPut(storeName, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => resolve(value);
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbGet(storeName, key) {
  const db = await openDb();
  const tx = db.transaction(storeName, 'readonly');
  return reqToResult(tx.objectStore(storeName), tx.objectStore(storeName).get(key));
}

export async function idbGetAll(storeName) {
  const db = await openDb();
  const tx = db.transaction(storeName, 'readonly');
  return reqToResult(tx.objectStore(storeName), tx.objectStore(storeName).getAll());
}

export async function idbDelete(storeName, key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---- Offline queue (aksi yang gagal terkirim / dibuat saat offline) ----

export async function enqueueAction(action, payload) {
  const item = {
    id: 'Q-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
    action,
    payload,
    createdAt: new Date().toISOString(),
    status: 'pending'
  };
  await idbPut(STORES.QUEUE, item);
  return item;
}

export function getQueuedActions() {
  return idbGetAll(STORES.QUEUE);
}

export function removeQueuedAction(id) {
  return idbDelete(STORES.QUEUE, id);
}

// ---- Cache generik ber-TTL ----

/** Murni: cek apakah entry cache sudah kedaluwarsa. Diuji lewat Node. */
export function isCacheEntryExpired(entry, nowMs) {
  if (!entry || typeof entry.expiresAt !== 'number') return true;
  return (nowMs || Date.now()) >= entry.expiresAt;
}

export async function setCache(key, value, ttlMs) {
  const entry = { key, value, expiresAt: Date.now() + (ttlMs || 5 * 60 * 1000) };
  await idbPut(STORES.CACHE, entry);
  return entry;
}

export async function getCache(key) {
  const entry = await idbGet(STORES.CACHE, key);
  if (!entry || isCacheEntryExpired(entry)) return null;
  return entry.value;
}

// ---- Draft autosave ----

export function saveDraft(draftId, data) {
  return idbPut(STORES.DRAFTS, { id: draftId, data, updatedAt: new Date().toISOString() });
}

export function getDraft(draftId) {
  return idbGet(STORES.DRAFTS, draftId);
}

export function deleteDraft(draftId) {
  return idbDelete(STORES.DRAFTS, draftId);
}

export { STORES };
