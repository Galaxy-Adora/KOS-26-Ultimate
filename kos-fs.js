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

  /* Storage cap (IndexedDB "disk size") — user-adjustable in Setup/Settings.
     Stored in localStorage as bytes. Min 256MB enforced everywhere. */
  const CAP_KEY      = 'kos-fs-storage-cap';
  const MB           = 1024 * 1024;
  const MIN_CAP      = 256 * MB;          // 256 MB hard minimum
  const DEFAULT_CAP  = 2048 * MB;         // 2 GB default
  const WARN_RATIO   = 0.9;               // warn at 90% usage

  const TYPES = Object.freeze({
    IMAGE    : 'image',
    VIDEO    : 'video',
    AUDIO    : 'audio',
    DOCUMENT : 'document',
    APP      : 'app',
  });

  const SCOPE_TO_TYPE = Object.freeze({
    photos    : TYPES.IMAGE,
    videos    : TYPES.VIDEO,
    audios    : TYPES.AUDIO,
    documents : TYPES.DOCUMENT,
    apps      : TYPES.APP,
    '*'       : '*',
  });

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
  const _perms = new Map();

  let _readyResolve, _readyReject;
  let ready = new Promise((res, rej) => {
    _readyResolve = res;
    _readyReject  = rej;
  });

  /* ═══════════════════════════════════════════════════════════
     §3  LOW-LEVEL IDB HELPERS
  ═══════════════════════════════════════════════════════════ */

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

        store.createIndex('by_type',      'type',      { unique: false });
        store.createIndex('by_createdAt', 'createdAt', { unique: false });
        store.createIndex('by_name',      'name',      { unique: false });
        store.createIndex('by_albumId', 'albumIds', { unique: false, multiEntry: true });
        store.createIndex('by_tag',     'tags',     { unique: false, multiEntry: true });
      };

      req.onsuccess = evt => resolve(evt.target.result);
      req.onerror   = evt => reject(evt.target.error);
      req.onblocked = ()  => reject(new Error('[KOSFS] IDB open blocked by another tab'));
    });
  }

  function _store(mode = 'readonly') {
    return _db.transaction(STORE, mode).objectStore(STORE);
  }

  function _p(req) {
    return new Promise((res, rej) => {
      req.onsuccess = e => res(e.target.result);
      req.onerror   = e => rej(e.target.error);
    });
  }

  function _getById(id) {
    return _p(_store('readonly').get(Number(id)));
  }

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
        const data = r.data instanceof ArrayBuffer ? r.data : null;
        if (!data) continue;

        await _insert({
          name       : r.name || r.fileName || 'untitled',
          type,
          mimeType   : r.mimeType || r.type  || '',
          size       : r.size     ?? data.byteLength,
          data,
          createdAt  : r.addedAt  || r.date  || Date.now(),
          modifiedAt : Date.now(),
          writtenBy  : 'migration',
          _legacyId  : r.id,
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

  function hasPermission(appId, scope) {
    const types = _perms.get(appId);
    if (!types) return false;
    const type = SCOPE_TO_TYPE[scope] ?? scope;
    return types.has('*') || types.has(type);
  }

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

  function inferType(mimeType = '') {
    if (mimeType.startsWith('image/')) return TYPES.IMAGE;
    if (mimeType.startsWith('video/')) return TYPES.VIDEO;
    if (mimeType.startsWith('audio/')) return TYPES.AUDIO;
    return TYPES.DOCUMENT;
  }

  /* ═══════════════════════════════════════════════════════════
     §7  PUBLIC FILE OPERATIONS & AUTH / RESET FIX
  ═══════════════════════════════════════════════════════════ */

  /**
   * System Reset: Safely drops current IndexedDB files, clears migration history,
   * wipes authorization keys from localStorage, and restarts the environment.
   * Only apps with system-level '*' access can trigger this.
   */
  async function reset(appId) {
    // Only apps with system root access can execute a factory system reset
    _guard(appId, '*');

    console.warn(`[KOSFS] Reset initiated by app: "${appId}". Purging storage & system passwords...`);

    // 1. Close current database reference
    if (_db) {
      _db.close();
      _db = null;
    }

    // 2. Erase core Filesystem database from IndexedDB
    await new Promise((resolve, reject) => {
      const deleteReq = indexedDB.deleteDatabase(DB_NAME);
      deleteReq.onsuccess = () => resolve();
      deleteReq.onerror   = (e) => reject(e.target.error);
      deleteReq.onblocked = () => {
        console.warn('[KOSFS] Reset database deletion blocked by background operations.');
        resolve(); // Bypass to proceed with storage scrub
      };
    });

    // 3. Purge LocalStorage records (Migration states, Passwords, Token configurations)
    localStorage.removeItem(MIGRATE_KEY);
    localStorage.removeItem('kos-auth-password');
    localStorage.removeItem('kos-session-token');
    
    // Clear out registered application memories 
    _perms.clear();

    // 4. Re-configure operational lifecycle promises for a pristine reboot state
    ready = new Promise((res, rej) => {
      _readyResolve = res;
      _readyReject  = rej;
    });

    // 5. Instantly trigger a baseline setup loop
    await init();
    KOSBus.dispatch('kos:fs-reset-complete', { triggeredBy: appId });
  }

  /* ═══════════════════════════════════════════════════════════
     §7b  STORAGE CAP ("disk size") MANAGEMENT
  ═══════════════════════════════════════════════════════════ */

  function getCap() {
    try {
      const raw = localStorage.getItem(CAP_KEY);
      const n   = raw !== null ? parseInt(raw, 10) : DEFAULT_CAP;
      return Number.isFinite(n) && n >= MIN_CAP ? n : DEFAULT_CAP;
    } catch (_) {
      return DEFAULT_CAP;
    }
  }

  function setCap(bytes) {
    const n = Math.max(MIN_CAP, Math.floor(Number(bytes) || 0));
    try { localStorage.setItem(CAP_KEY, String(n)); } catch (_) {}
    KOSBus.dispatch('kos:fs-cap-changed', { cap: n });
    return n;
  }

  async function getUsage() {
    const stats = await _systemStats();
    const cap   = getCap();
    return {
      used      : stats.totalSize,
      cap,
      free      : Math.max(0, cap - stats.totalSize),
      ratio     : cap > 0 ? stats.totalSize / cap : 0,
      nearFull  : cap > 0 && (stats.totalSize / cap) >= WARN_RATIO,
      full      : stats.totalSize >= cap,
    };
  }

  async function _checkQuota(incomingSize) {
    const stats = await _systemStats();
    const cap   = getCap();
    if (stats.totalSize + incomingSize > cap) {
      const err = new DOMException(
        `[KOSFS] Storage cap exceeded (${formatSize(stats.totalSize)} / ${formatSize(cap)}). ` +
        `Free up space or increase the storage limit in Settings.`,
        'QuotaExceededError'
      );
      KOSBus.dispatch('kos:fs-quota-exceeded', {
        used: stats.totalSize, incoming: incomingSize, cap
      });
      throw err;
    }
    if ((stats.totalSize + incomingSize) / cap >= WARN_RATIO) {
      KOSBus.dispatch('kos:fs-quota-warning', {
        used: stats.totalSize + incomingSize, cap
      });
    }
  }

  async function write(appId, fileData, meta = {}) {
    await ready;
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
      throw new TypeError('[KOSFS] write(): unsupported fileData type.');
    }

    const fileType = meta.type ?? inferType(mimeType);
    _guard(appId, fileType);

    await _checkQuota(size);

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

    KOSBus.dispatch('kos:fs-write', { id, type: fileType, name, size, writtenBy: appId });
    return id;
  }

  async function read(appId, fileId) {
    await ready;
    const record = await _getById(fileId);
    if (!record) throw new DOMException(`[KOSFS] File ${fileId} not found.`, 'NotFoundError');
    _guard(appId, record.type);
    return record;
  }

  async function readBlob(appId, fileId) {
    const rec = await read(appId, fileId);
    return new Blob([rec.data], { type: rec.mimeType });
  }

  async function readText(appId, fileId) {
    const rec = await read(appId, fileId);
    return new TextDecoder().decode(rec.data);
  }

  async function readObjectURL(appId, fileId) {
    const blob = await readBlob(appId, fileId);
    return URL.createObjectURL(blob);
  }

  async function list(appId, filter = {}) {
    await ready;
    const types = _perms.get(appId);
    if (!types) {
      throw new DOMException(`[KOSFS] App "${appId}" has not registered permissions.`, 'SecurityError');
    }

    const all = await _p(_store('readonly').getAll());
    let rows = all.map(({ data: _d, ...meta }) => meta);

    if (!types.has('*')) {
      rows = rows.filter(r => types.has(r.type));
    }

    if (filter.type)    rows = rows.filter(r => r.type === filter.type);
    if (filter.albumId) rows = rows.filter(r => r.albumIds?.includes(filter.albumId));
    if (filter.tag)     rows = rows.filter(r => r.tags?.includes(filter.tag));
    if (filter.name) {
      const q = filter.name.toLowerCase();
      rows = rows.filter(r => r.name?.toLowerCase().includes(q));
    }

    rows.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

    const offset = filter.offset ?? 0;
    const limit  = filter.limit  ?? rows.length;
    return rows.slice(offset, offset + limit);
  }

  async function remove(appId, fileId) {
    await ready;
    const record = await _getById(Number(fileId));
    if (!record) throw new DOMException(`[KOSFS] File ${fileId} not found.`, 'NotFoundError');
    _guard(appId, record.type);

    await _p(_store('readwrite').delete(Number(fileId)));
    KOSBus.dispatch('kos:fs-delete', {
      id        : fileId,
      type      : record.type,
      name      : record.name,
      deletedBy : appId,
    });
  }

  async function updateMeta(appId, fileId, patch) {
    await ready;
    const record = await _getById(Number(fileId));
    if (!record) throw new DOMException(`[KOSFS] File ${fileId} not found.`, 'NotFoundError');
    _guard(appId, record.type);

    const ALLOWED = ['name', 'tags', 'albumIds'];
    const safe = {};
    for (const key of ALLOWED) {
      if (key in patch) safe[key] = patch[key];
    }

    const updated = { ...record, ...safe, modifiedAt: Date.now() };
    await _p(_store('readwrite').put(updated));

    KOSBus.dispatch('kos:fs-update', {
      id        : fileId,
      type      : record.type,
      patch     : safe,
      updatedBy : appId,
    });
  }

  /* ═══════════════════════════════════════════════════════════
     §8  STATS / STORAGE INFO
  ═══════════════════════════════════════════════════════════ */

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

  function formatSize(bytes) {
    if (bytes < 1024)             return `${bytes} B`;
    if (bytes < 1024 * 1024)      return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

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

  async function init() {
    try {
      _db = await _openDB();
      await _migrate();
      _readyResolve();
      KOSBus.dispatch('kos:fs-ready', {});
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
    TYPES,
    ready,
    init,
    registerApp,
    hasPermission,
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
    
    // System Purge & Password Reset Implementation
    reset,

    // Stats / info
    getStats,
    formatSize,
    typeIcon,
    _systemStats,

    // Storage cap ("disk size")
    getCap,
    setCap,
    getUsage,
    MIN_CAP,
    DEFAULT_CAP,
  });

})();