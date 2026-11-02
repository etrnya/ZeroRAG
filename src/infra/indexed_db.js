/**
 * ZeroRAG IndexedDB Storage Adapter
 * Implements Strategy A (Flat ArrayBuffer + Chunks Store) for lightning-fast zero-copy cold start.
 */

const DB_NAME = 'ZeroRAG_DB';
const DB_VERSION = 1;

const STORE_WORKSPACES = 'workspaces';
const STORE_CHUNKS = 'chunks';
const STORE_VECTORS = 'vectors';

export class IndexedDBAdapter {
  constructor() {
    this.db = null;
  }

  async _open() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_WORKSPACES)) {
          db.createObjectStore(STORE_WORKSPACES, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_CHUNKS)) {
          db.createObjectStore(STORE_CHUNKS, { keyPath: 'workspace_id' });
        }
        if (!db.objectStoreNames.contains(STORE_VECTORS)) {
          db.createObjectStore(STORE_VECTORS, { keyPath: 'workspace_id' });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Save complete workspace state (Strategy A: single binary buffer)
   * @param {string} workspaceId
   * @param {Object} metadata
   * @param {Array<any>} chunks
   * @param {ArrayBuffer} vectorBuffer
   */
  async saveWorkspace(workspaceId, metadata, chunks, vectorBuffer) {
    const db = await this._open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_WORKSPACES, STORE_CHUNKS, STORE_VECTORS], 'readwrite');

      tx.objectStore(STORE_WORKSPACES).put({
        id: workspaceId,
        metadata,
        updated_at: new Date().toISOString()
      });

      tx.objectStore(STORE_CHUNKS).put({
        workspace_id: workspaceId,
        chunks
      });

      tx.objectStore(STORE_VECTORS).put({
        workspace_id: workspaceId,
        buffer: vectorBuffer,
        byteLength: vectorBuffer.byteLength
      });

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Load workspace state
   * @param {string} workspaceId
   * @returns {Promise<{ metadata: any, chunks: Array<any>, vectorBuffer: ArrayBuffer } | null>}
   */
  async loadWorkspace(workspaceId) {
    const db = await this._open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_WORKSPACES, STORE_CHUNKS, STORE_VECTORS], 'readonly');

      const reqMeta = tx.objectStore(STORE_WORKSPACES).get(workspaceId);
      const reqChunks = tx.objectStore(STORE_CHUNKS).get(workspaceId);
      const reqVectors = tx.objectStore(STORE_VECTORS).get(workspaceId);

      tx.oncomplete = () => {
        if (!reqMeta.result || !reqVectors.result) {
          resolve(null);
          return;
        }

        resolve({
          metadata: reqMeta.result.metadata,
          chunks: reqChunks.result ? reqChunks.result.chunks : [],
          vectorBuffer: reqVectors.result.buffer
        });
      };

      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * List all stored workspaces
   */
  async listWorkspaces() {
    const db = await this._open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_WORKSPACES], 'readonly');
      const req = tx.objectStore(STORE_WORKSPACES).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Delete workspace
   */
  async deleteWorkspace(workspaceId) {
    const db = await this._open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_WORKSPACES, STORE_CHUNKS, STORE_VECTORS], 'readwrite');
      tx.objectStore(STORE_WORKSPACES).delete(workspaceId);
      tx.objectStore(STORE_CHUNKS).delete(workspaceId);
      tx.objectStore(STORE_VECTORS).delete(workspaceId);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Estimate storage usage
   */
  async estimate() {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      const est = await navigator.storage.estimate();
      return {
        usedMB: (est.usage / (1024 * 1024)).toFixed(2),
        quotaMB: (est.quota / (1024 * 1024)).toFixed(0)
      };
    }
    return { usedMB: '0.00', quotaMB: 'N/A' };
  }
}
