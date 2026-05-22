/*!
 * kos-fs.js — KOS File System (KOSFS) Kernel Module
 * ====================================================
 * KOS Ultimate 2026 — Target: Alpha 9+
 *
 * Replaces the four separate IndexedDB stores:
 *   kos-photos (v2)  ─┐
 *   kos-videos (v1)  ─┤  → unified  kos-filesystem (v1)
 *   kos-audios (v1)  ─┤
 *   kos-documents (v1)┘
 *
 * LOAD ORDER  (in index.html, after kos-kernel.js, before kos-wm.js)
 * ──────────────────────────────────────────────────────────────────
 *   <script defer src="kos-fs.js"></script>
 *   <script defer src="kos-fs-picker.js"></script>
 *
 * INIT  (in kos-init.js, alongside KOSDisplay.apply())
 * ──────────────────────────────────────────────────────
 *   await KOSFS.init();
 *
 * PERMISSION SCOPES
 * ─────────────────
 *   'photos'    → read / write IMAGE files
 *   'videos'    → read / write VIDEO files
 *   'audios'    → read / write AUDIO files
 *   'documents' → read / write DOCUMENT files
 *   'apps'      → read / write APP files (Studio only)
 *   '*'         → full access  (system apps only: files, uimanager)
 *
 * KOSBUS EVENTS EMITTED
 * ─────────────────────
 *   kos:fs-ready   {}
 *   kos:fs-write   { id, type, name, size, writtenBy }
 *   kos:fs-delete  { id, type, name, deletedBy }
 *   kos:fs-update  { id, type, patch, updatedBy }
 *
 * QUICK EXAMPLE
 * ─────────────
 *   // In photos.js  init():
 *   KOSFS.registerApp('gallery', ['photos']);
 *   await KOSFS.ready;
 *
 *   // Upload a photo
 *   const id = await KOSFS.write('gallery', file);
 *
 *   // Load it back as a blob URL
 *   const url = await KOSFS.readObjectURL('gallery', id);
 *   img.src = url;
 *
 * © 2024–2026 Kalapurackal Studios. All rights reserved.
 */

'use strict';

window.KOSFS = (() => {

  /* ═══════════════════════════════════════════════════════════
     §1  CONSTANTS
  ═══════════════════════════════════════════════════════════ */

  const DB_NAME     = 'kos-filesystem';
  const DB_VERSION  = 1;
  const STORE       = 'files';
  const MIGRATE_KEY = 'kos-fs-v1-migrated';

  /**
   * Canonical file type strings.
   * Reference these via KOSFS.TYPES.IMAGE etc. in your app code.
   */
  const TYPES = Object.freeze({
    IMAGE    : 'image',
    VIDEO    : 'video',
    AUDIO    : 'audio',
    DOCUMENT : 'document',
    APP      : 'app',
  });

  /**
   * Maps the human-readable permission scope string (used in kos-manifest.js)
   * to the internal TYPES constant.
   */
  const SCOPE_TO_TYPE = Object.freeze({
    photos    : TYPES.IMAGE,
    videos    : TYPES.VIDEO,
    audios    : TYPES.AUDIO,
    documents : TYPES.DOCUMENT,
    apps      : TYPES.APP,
    '*'       : '*',
  });

  /**
   * Legacy IndexedDB databases to migrate into kos-filesystem on first boot.
   * Each entry references the old per-type store.
   */
  const LEGACY_DBS = [
    { dbName: 'kos-photos',    dbVersion: 2, type: TYPES.IMAGE    },
    { dbName: 'kos-videos',    dbVersion: 1, type: TYPES.VIDEO    },
    { dbName: 'kos-audios',    dbVersion: 1, type: TYPES.AUDIO    },
    { dbName: 'kos-documents', dbVersion: 1, type: TYPES.DOCUMENT },
  ];

  /* ═══════════════════════════════════════════════════════════
     §2  INTERNAL STATE
  ═══════════════════════════════════════════════════════════ */

  let _db = null;

  /**
   * App permission registry.
   * Map<appId: string, permissions: Set<fileType | '*'>>
   */
  const _perms = new Map();

  /**
   * Public promise — resolves when the filesystem is fully open
   * and migration is complete. Await before any file operation.
   *
   * @type {Promise<void>}
   *
   * @example
   * await KOSFS.ready;
   * const files = await KOSFS.list('gallery');
   */
  let _readyResolve, _readyReject;
  const ready = new Promise((res, rej) => {
    _readyResolve = res;
    _readyReject  = rej;
  });

  /* ═══════════════════════════════════════════════════════════
     §3  LOW-LEVEL IDB HELPERS
  ═══════════════════════════════════════════════════════════ */

  /** Open (or create) the unified filesystem database. */
  function _openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = evt => {
        const db = evt.target.result;
        if (db.objectStoreNames.contains(STORE)) return;

        const store = db.createObjectStore(STORE, {
          keyPath       : 'id',
          autoIncrement : true,
        });

        // Core indexes
        store.createIndex('by_type',      'type',      { unique: false });
        store.createIndex('by_createdAt', 'createdAt', { unique: false });
        store.createIndex('by_name',      'name',      { unique: false });

        // Multi-value indexes (one entry per array element)
        store.createIndex('by_albumId', 'albumIds', { unique: false, multiEntry: true });
        store.createIndex('by_tag',     'tags',     { unique: false, multiEntry: true });
      };

      req.onsuccess = evt => resolve(evt.target.result);
      req.onerror   = evt => reject(evt.target.error);
      req.onblocked = ()  => reject(new Error('[KOSFS] IDB open blocked by another tab'));
    });
  }

  /** Get a writable or read-only object store in a new transaction. */
  function _store(mode = 'readonly') {
    return _db.transaction(STORE, mode).objectStore(STORE);
  }

  /** Wrap an IDBRequest in a Promise. */
  function _p(req) {
    return new Promise((res, rej) => {
      req.onsuccess = e => res(e.target.result);
      req.onerror   = e => rej(e.target.error);
    });
  }

  /** Fetch a single record by numeric id (internal, no permission gate). */
  function _getById(id) {
    return _p(_store('readonly').get(Number(id)));
  }

  /** Insert a raw record object into the store; returns the new auto-id. */
  function _insert(record) {
    return _p(_store('readwrite').add({
      createdAt  : Date.now(),
      modifiedAt : Date.now(),
      tags       : [],
      albumIds   : [],
      ...record,
    }));
  }

  /* ═══════════════════════════════════════════════════════════
     §4  MIGRATION — legacy IDB stores → kos-filesystem
  ═══════════════════════════════════════════════════════════ */

  async function _migrate() {
    // Only run once
    if (localStorage.getItem(MIGRATE_KEY)) return;

    let total = 0;
    for (const legacy of LEGACY_DBS) {
      total += await _migrateLegacyDB(legacy);
    }

    localStorage.setItem(MIGRATE_KEY, String(Date.now()));
    if (total > 0) {
      console.info(`[KOSFS] Migration complete — ${total} file(s) imported from legacy stores.`);
    }
  }

  async function _migrateLegacyDB({ dbName, dbVersion, type }) {
    let legacyDB = null;
    try {
      legacyDB = await new Promise(resolve => {
        const req = indexedDB.open(dbName, dbVersion);
        req.onsuccess     = e => resolve(e.target.result);
        req.onerror       = ()  => resolve(null);
        // Abort any implicit upgrade (DB didn't previously exist)
        req.onupgradeneeded = e => { e.target.transaction.abort(); resolve(null); };
      });

      if (!legacyDB) return 0;

      const storeName = legacyDB.objectStoreNames[0];
      if (!storeName) { legacyDB.close(); return 0; }

      const records = await _p(
        legacyDB.transaction(storeName, 'readonly').objectStore(storeName).getAll()
      );
      legacyDB.close();

      for (const r of records) {
        // Normalise across different legacy schemas
        const data = r.data instanceof ArrayBuffer ? r.data : null;
        if (!data) continue; // skip malformed records

        await _insert({
          name       : r.name || r.fileName || 'untitled',
          type,
          mimeType   : r.mimeType || r.type  || '',
          size       : r.size     ?? data.byteLength,
          data,
          createdAt  : r.addedAt  || r.date  || Date.now(),
          modifiedAt : Date.now(),
          writtenBy  : 'migration',
          _legacyId  : r.id,    // keep original ID for debugging
          _legacyDB  : dbName,
        });
      }

      return records.length;

    } catch (err) {
      if (legacyDB) try { legacyDB.close(); } catch (_) {}
      console.warn(`[KOSFS] Migration skipped for "${dbName}":`, err.message);
      return 0;
    }
  }

  /* ═══════════════════════════════════════════════════════════
     §5  PERMISSION SYSTEM
  ═══════════════════════════════════════════════════════════ */

  /**
   * Register an app and the file-type scopes it is allowed to access.
   * Must be called inside each app's  init()  before any KOSFS operation.
   *
   * Permission scope strings mirror the  permissions  field you add to each
   * app entry in kos-manifest.js.
   *
   * @param {string}   appId  - App ID (must match the manifest id field)
   * @param {string[]} scopes - e.g. ['photos'], ['photos','videos'], ['*']
   *
   * @example
   * // photos.js  init():
   * KOSFS.registerApp('gallery', ['photos']);
   *
   * // files.js  init():
   * KOSFS.registerApp('files', ['photos', 'videos', 'audios', 'documents']);
   *
   * // ui-manager.js  init():
   * KOSFS.registerApp('uimanager', ['*']);
   */
  function registerApp(appId, scopes = []) {
    const types = new Set();
    for (const scope of scopes) {
      const mapped = SCOPE_TO_TYPE[scope];
      if (mapped === undefined) {
        console.warn(`[KOSFS] Unknown scope "${scope}" for app "${appId}" — ignored.`);
      } else {
        types.add(mapped);
      }
    }
    _perms.set(appId, types);
  }

  /**
   * Check whether an app has a specific permission without throwing.
   *
   * @param {string} appId
   * @param {string} scope - e.g. 'photos', 'videos'
   * @returns {boolean}
   */
  function hasPermission(appId, scope) {
    const types = _perms.get(appId);
    if (!types) return false;
    const type = SCOPE_TO_TYPE[scope] ?? scope;
    return types.has('*') || types.has(type);
  }

  /**
   * Internal guard — throws DOMException('SecurityError') if the app
   * is not registered or lacks the required file-type permission.
   */
  function _guard(appId, fileType) {
    const types = _perms.get(appId);
    if (!types) {
      throw new DOMException(
        `[KOSFS] App "${appId}" has not registered permissions. Call KOSFS.registerApp() in init().`,
        'SecurityError'
      );
    }
    if (types.has('*') || types.has(fileType)) return;
    throw new DOMException(
      `[KOSFS] App "${appId}" lacks "${fileType}" permission.`,
      'SecurityError'
    );
  }

  /* ═══════════════════════════════════════════════════════════
     §6  TYPE INFERENCE
  ═══════════════════════════════════════════════════════════ */

  /**
   * Infer the KOSFS file type from a MIME type string.
   *
   * @param {string} mimeType
   * @returns {string} One of KOSFS.TYPES.*
   */
  function inferType(mimeType = '') {
    if (mimeType.startsWith('image/')) return TYPES.IMAGE;
    if (mimeType.startsWith('video/')) return TYPES.VIDEO;
    if (mimeType.startsWith('audio/')) return TYPES.AUDIO;
    return TYPES.DOCUMENT;
  }

  /* ═══════════════════════════════════════════════════════════
     §7  PUBLIC FILE OPERATIONS
  ═══════════════════════════════════════════════════════════ */

  /**
   * Write a file to the kernel filesystem.
   *
   * @param {string}                           appId    - Calling app ID
   * @param {File|Blob|ArrayBuffer|string}     fileData - The file content
   * @param {object}                           [meta]   - Optional metadata overrides
   * @param {string}  [meta.name]       - Override the file name
   * @param {string}  [meta.type]       - Override inferred file type (KOSFS.TYPES.*)
   * @param {string}  [meta.mimeType]   - Override inferred MIME type
   * @param {string[]}[meta.tags]       - Tag array for filtering
   * @param {string[]}[meta.albumIds]   - Album IDs (used by Photos app)
   * @returns {Promise<number>} The new file's integer ID
   *
   * @example
   * const id = await KOSFS.write('gallery', file, { albumIds: ['favourites'] });
   */
  async function write(appId, fileData, meta = {}) {
    await ready;

    // ── Normalise fileData → ArrayBuffer + metadata ──────────
    let data, mimeType, name, size;

    if (fileData instanceof File) {
      data     = await fileData.arrayBuffer();
      mimeType = meta.mimeType ?? fileData.type;
      name     = meta.name     ?? fileData.name ?? 'untitled';
      size     = fileData.size;

    } else if (fileData instanceof Blob) {
      data     = await fileData.arrayBuffer();
      mimeType = meta.mimeType ?? fileData.type;
      name     = meta.name     ?? 'untitled';
      size     = fileData.size;

    } else if (fileData instanceof ArrayBuffer) {
      data     = fileData;
      mimeType = meta.mimeType ?? 'application/octet-stream';
      name     = meta.name     ?? 'untitled';
      size     = data.byteLength;

    } else if (typeof fileData === 'string') {
      data     = new TextEncoder().encode(fileData).buffer;
      mimeType = meta.mimeType ?? 'text/plain';
      name     = meta.name     ?? 'untitled.txt';
      size     = data.byteLength;

    } else {
      throw new TypeError('[KOSFS] write(): unsupported fileData type. Expected File, Blob, ArrayBuffer, or string.');
    }

    const fileType = meta.type ?? inferType(mimeType);
    _guard(appId, fileType);

    const id = await _insert({
      name,
      type      : fileType,
      mimeType,
      size,
      data,
      tags      : meta.tags     ?? [],
      albumIds  : meta.albumIds ?? [],
      writtenBy : appId,
    });

    KOSBus.emit('kos:fs-write', { id, type: fileType, name, size, writtenBy: appId });
    return id;
  }

  /**
   * Read the full record for a file, including raw ArrayBuffer data.
   * Usually you want `readBlob()` or `readText()` instead.
   *
   * @param {string} appId
   * @param {number} fileId
   * @returns {Promise<object>} Full IDB record
   */
  async function read(appId, fileId) {
    await ready;
    const record = await _getById(fileId);
    if (!record) throw new DOMException(`[KOSFS] File ${fileId} not found.`, 'NotFoundError');
    _guard(appId, record.type);
    return record;
  }

  /**
   * Read a file as a Blob — use for images, video, audio.
   * The Blob has the correct MIME type set automatically.
   *
   * @param {string} appId
   * @param {number} fileId
   * @returns {Promise<Blob>}
   *
   * @example
   * const blob = await KOSFS.readBlob('gallery', id);
   * img.src = URL.createObjectURL(blob);
   */
  async function readBlob(appId, fileId) {
    const rec = await read(appId, fileId);
    return new Blob([rec.data], { type: rec.mimeType });
  }

  /**
   * Read a file as a UTF-8 string — use for documents and text files.
   *
   * @param {string} appId
   * @param {number} fileId
   * @returns {Promise<string>}
   */
  async function readText(appId, fileId) {
    const rec = await read(appId, fileId);
    return new TextDecoder().decode(rec.data);
  }

  /**
   * Create a temporary Object URL for a file.
   * ⚠️  You MUST call URL.revokeObjectURL(url) when you are done to avoid memory leaks.
   *
   * @param {string} appId
   * @param {number} fileId
   * @returns {Promise<string>} blob: URL
   *
   * @example
   * const url = await KOSFS.readObjectURL('gallery', id);
   * img.src = url;
   * // … later …
   * URL.revokeObjectURL(url);
   */
  async function readObjectURL(appId, fileId) {
    const blob = await readBlob(appId, fileId);
    return URL.createObjectURL(blob);
  }

  /**
   * List files accessible to an app (metadata only — no raw data).
   * Results are filtered by the app's registered permissions automatically.
   *
   * @param {string} appId
   * @param {object} [filter]
   * @param {string}   [filter.type]    - Restrict to one KOSFS.TYPES.* value
   * @param {string}   [filter.albumId] - Restrict to a specific album
   * @param {string}   [filter.tag]     - Restrict to files with this tag
   * @param {string}   [filter.name]    - Substring search on file name
   * @param {number}   [filter.limit]   - Max records to return
   * @param {number}   [filter.offset]  - Skip N records (for pagination)
   * @returns {Promise<object[]>} Metadata records sorted newest-first
   *
   * @example
   * const photos = await KOSFS.list('gallery', { type: KOSFS.TYPES.IMAGE });
   */
  async function list(appId, filter = {}) {
    await ready;
    const types = _perms.get(appId);
    if (!types) {
      throw new DOMException(
        `[KOSFS] App "${appId}" has not registered permissions.`, 'SecurityError'
      );
    }

    // Fetch all records from IDB — strip raw data, keep metadata
    const all = await _p(_store('readonly').getAll());
    let rows = all.map(({ data: _d, ...meta }) => meta);

    // ── Permission filter ──────────────────────────────────────
    if (!types.has('*')) {
      rows = rows.filter(r => types.has(r.type));
    }

    // ── Caller filters ─────────────────────────────────────────
    if (filter.type)    rows = rows.filter(r => r.type === filter.type);
    if (filter.albumId) rows = rows.filter(r => r.albumIds?.includes(filter.albumId));
    if (filter.tag)     rows = rows.filter(r => r.tags?.includes(filter.tag));
    if (filter.name) {
      const q = filter.name.toLowerCase();
      rows = rows.filter(r => r.name?.toLowerCase().includes(q));
    }

    // ── Sort: newest first ─────────────────────────────────────
    rows.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

    // ── Pagination ─────────────────────────────────────────────
    const offset = filter.offset ?? 0;
    const limit  = filter.limit  ?? rows.length;
    return rows.slice(offset, offset + limit);
  }

  /**
   * Delete a file. Only the app that created it or an app with '*' permission can delete it.
   *
   * @param {string} appId
   * @param {number} fileId
   * @returns {Promise<void>}
   */
  async function remove(appId, fileId) {
    await ready;
    const record = await _getById(Number(fileId));
    if (!record) throw new DOMException(`[KOSFS] File ${fileId} not found.`, 'NotFoundError');
    _guard(appId, record.type);

    await _p(_store('readwrite').delete(Number(fileId)));
    KOSBus.emit('kos:fs-delete', {
      id        : fileId,
      type      : record.type,
      name      : record.name,
      deletedBy : appId,
    });
  }

  /**
   * Update the metadata of an existing file.
   * You can patch: name, tags, albumIds.
   * Data (binary content) and type cannot be changed after write.
   *
   * @param {string} appId
   * @param {number} fileId
   * @param {object} patch - { name?, tags?, albumIds? }
   * @returns {Promise<void>}
   *
   * @example
   * await KOSFS.updateMeta('gallery', id, { tags: ['favourite'] });
   */
  async function updateMeta(appId, fileId, patch) {
    await ready;
    const record = await _getById(Number(fileId));
    if (!record) throw new DOMException(`[KOSFS] File ${fileId} not found.`, 'NotFoundError');
    _guard(appId, record.type);

    // Only allow patching safe fields — never let callers overwrite type, data, id
    const ALLOWED = ['name', 'tags', 'albumIds'];
    const safe = {};
    for (const key of ALLOWED) {
      if (key in patch) safe[key] = patch[key];
    }

    const updated = { ...record, ...safe, modifiedAt: Date.now() };
    await _p(_store('readwrite').put(updated));

    KOSBus.emit('kos:fs-update', {
      id        : fileId,
      type      : record.type,
      patch     : safe,
      updatedBy : appId,
    });
  }

  /* ═══════════════════════════════════════════════════════════
     §8  STATS / STORAGE INFO
  ═══════════════════════════════════════════════════════════ */

  /**
   * Get storage statistics for files visible to an app.
   *
   * @param {string} appId
   * @returns {Promise<{ count: number, totalSize: number, byType: object }>}
   *
   * @example
   * const stats = await KOSFS.getStats('uimanager');
   * // { count: 42, totalSize: 8388608, byType: { image: 30, document: 12 } }
   */
  async function getStats(appId) {
    const files = await list(appId);
    const byType = {};
    let totalSize = 0;

    for (const f of files) {
      if (!byType[f.type]) byType[f.type] = { count: 0, size: 0 };
      byType[f.type].count++;
      byType[f.type].size += f.size ?? 0;
      totalSize += f.size ?? 0;
    }

    return { count: files.length, totalSize, byType };
  }

  /**
   * System-level storage report — ALL files, no permission gate.
   * Intended for Settings → Storage section (uimanager) only.
   * Prefixed with _ as a convention to discourage casual use.
   *
   * @returns {Promise<{ count: number, totalSize: number, byType: object }>}
   */
  async function _systemStats() {
    await ready;
    const all = await _p(_store('readonly').getAll());
    const byType = {};
    let totalSize = 0;

    for (const r of all) {
      if (!byType[r.type]) byType[r.type] = { count: 0, size: 0 };
      byType[r.type].count++;
      byType[r.type].size += r.size ?? 0;
      totalSize += r.size ?? 0;
    }

    return { count: all.length, totalSize, byType };
  }

  /* ═══════════════════════════════════════════════════════════
     §9  UTILITY HELPERS
  ═══════════════════════════════════════════════════════════ */

  /**
   * Format a byte count into a human-readable string.
   * Useful for storage UI in Settings and Files.
   *
   * @param {number} bytes
   * @returns {string} e.g. "3.2 MB"
   */
  function formatSize(bytes) {
    if (bytes < 1024)             return `${bytes} B`;
    if (bytes < 1024 * 1024)      return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  /**
   * Build a file-type icon class string matching KOS icon conventions.
   * Used by the Files app and the Picker to render type badges.
   *
   * @param {string} type - One of KOSFS.TYPES.*
   * @returns {string} FontAwesome class string
   */
  function typeIcon(type) {
    return {
      [TYPES.IMAGE]    : 'fa-image',
      [TYPES.VIDEO]    : 'fa-film',
      [TYPES.AUDIO]    : 'fa-music',
      [TYPES.DOCUMENT] : 'fa-file-alt',
      [TYPES.APP]      : 'fa-puzzle-piece',
    }[type] ?? 'fa-file';
  }

  /* ═══════════════════════════════════════════════════════════
     §10  INIT
  ═══════════════════════════════════════════════════════════ */

  /**
   * Initialise KOSFS — open the database and run migration.
   * Called once by kos-init.js during the boot sequence.
   *
   * @returns {Promise<void>}
   *
   * @example
   * // In kos-init.js, alongside KOSDisplay.apply():
   * await KOSFS.init();
   */
  async function init() {
    try {
      _db = await _openDB();
      await _migrate();
      _readyResolve();
      KOSBus.emit('kos:fs-ready', {});
      console.info('[KOSFS] Filesystem ready.');
    } catch (err) {
      _readyReject(err);
      console.error('[KOSFS] Init failed:', err);
      throw err;
    }
  }

  /* ═══════════════════════════════════════════════════════════
     §11  PUBLIC SURFACE
  ═══════════════════════════════════════════════════════════ */

  return Object.freeze({
    // Constants
    TYPES,

    // Lifecycle
    ready,
    init,

    // Permission API
    registerApp,
    hasPermission,

    // Type inference
    inferType,

    // File operations
    write,
    read,
    readBlob,
    readText,
    readObjectURL,
    list,
    delete     : remove,
    updateMeta,

    // Stats / info
    getStats,
    formatSize,
    typeIcon,

    // System-only (Settings → Storage)
    _systemStats,
  });

})();
