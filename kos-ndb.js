/*!
 * kos-ndb.js — KOS Notification Database (KOSNDB) Kernel Module
 * ==============================================================
 * KOS Ultimate 2026 — Target: Alpha 9+
 *
 * A dedicated IndexedDB-backed notification store for the KOS shell.
 * Mirrors the architecture of kos-fs.js but purpose-built for lightweight
 * notification records (no binary blobs — pure JSON metadata only).
 *
 * LOAD ORDER  (in index.html, after kos-fs.js, before kos-wm.js)
 * ──────────────────────────────────────────────────────────────────
 *   <script defer src="kos-ndb.js"></script>
 *
 * INIT  (in kos-init.js, right after KOSFS.init())
 * ──────────────────────────────────────────────────
 *   await KOSNDB.init();
 *
 * POSTING A NOTIFICATION FROM ANY APP
 * ─────────────────────────────────────
 *   // Minimal — title only
 *   await KOSNDB.post('music', { title: 'Now playing: Blinding Lights' });
 *
 *   // Full payload
 *   await KOSNDB.post('gallery', {
 *     title : 'Export complete',
 *     body  : '42 photos saved to Documents.',
 *     icon  : 'fa-solid fa-images',   // FontAwesome class string
 *     tag   : 'export',               // optional; used for dedup (replaces previous with same tag)
 *   });
 *
 * HOW IT WIRES INTO THE PANEL
 * ─────────────────────────────
 *   KOSNDB manages the DOM inside #kn-notif-list automatically.
 *   Deleting a card calls KOSNDB.dismiss(id) → erases from IndexedDB → removes card.
 *   "Clear All" calls KOSNDB.clearAll()      → wipes all records → empties panel.
 *   Any new post()  auto-opens the notification panel via toggleNotifPanel().
 *
 * KOSBUS EVENTS EMITTED
 * ─────────────────────
 *   kos:notif-posted    { id, appId, title, body, icon, tag, timestamp }
 *   kos:notif-dismissed { id }
 *   kos:notif-cleared   {}
 *   kos:ndb-ready       {}
 *
 * © 2024–2026 Kalapurackal Studios. All rights reserved.
 */

'use strict';

window.KOSNDB = (() => {

  /* ═══════════════════════════════════════════════════════════
     §1  CONSTANTS
  ═══════════════════════════════════════════════════════════ */

  const DB_NAME    = 'kos-notifications';
  const DB_VERSION = 1;
  const STORE      = 'notifications';

  /* Maximum notifications retained in DB (oldest trimmed automatically). */
  const MAX_NOTIFS = 100;

  /* ═══════════════════════════════════════════════════════════
     §2  INTERNAL STATE
  ═══════════════════════════════════════════════════════════ */

  let _db = null;

  let _readyResolve, _readyReject;

  /**
   * Public promise — resolves once the DB is open and the panel is hydrated.
   * Await this before any read/write operation.
   *
   * @type {Promise<void>}
   * @example
   * await KOSNDB.ready;
   */
  const ready = new Promise((res, rej) => {
    _readyResolve = res;
    _readyReject  = rej;
  });

  /* ═══════════════════════════════════════════════════════════
     §3  LOW-LEVEL IDB HELPERS
  ═══════════════════════════════════════════════════════════ */

  /** Open (or create) the notifications database. */
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
        store.createIndex('by_timestamp', 'timestamp', { unique: false });
        store.createIndex('by_appId',     'appId',     { unique: false });
        store.createIndex('by_tag',       'tag',       { unique: false });
      };

      req.onsuccess = evt => resolve(evt.target.result);
      req.onerror   = evt => reject(evt.target.error);
      req.onblocked = ()  => reject(new Error('[KOSNDB] IDB open blocked by another tab'));
    });
  }

  /** Get a transaction-backed object store. */
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

  /** Fetch all records, sorted newest-first. */
  async function _getAll() {
    const all = await _p(_store('readonly').getAll());
    return all.sort((a, b) => b.timestamp - a.timestamp);
  }

  /** Delete a record by id (internal, no guard). */
  function _deleteById(id) {
    return _p(_store('readwrite').delete(Number(id)));
  }

  /** Insert a record; returns the new auto-id. */
  function _insert(record) {
    return _p(_store('readwrite').add({
      timestamp : Date.now(),
      read      : false,
      ...record,
    }));
  }

  /* ═══════════════════════════════════════════════════════════
     §4  TAG DEDUPLICATION
  ═══════════════════════════════════════════════════════════ */

  /**
   * If a notification with the same (appId, tag) exists, delete it first.
   * This mirrors how browser Notification API handles the `tag` field.
   */
  async function _deduplicateTag(appId, tag) {
    if (!tag) return;
    const all = await _getAll();
    const dupe = all.find(n => n.appId === appId && n.tag === tag);
    if (dupe) {
      await _deleteById(dupe.id);
      _removeCard(dupe.id);
    }
  }

  /* ═══════════════════════════════════════════════════════════
     §5  OVERFLOW TRIM
  ═══════════════════════════════════════════════════════════ */

  /** Keep the DB under MAX_NOTIFS by trimming the oldest entries. */
  async function _trim() {
    const all = await _getAll();           // already newest-first
    if (all.length <= MAX_NOTIFS) return;
    const stale = all.slice(MAX_NOTIFS);  // oldest records
    for (const n of stale) {
      await _deleteById(n.id);
      _removeCard(n.id);
    }
  }

  /* ═══════════════════════════════════════════════════════════
     §6  DOM HELPERS  (notification panel UI)
  ═══════════════════════════════════════════════════════════ */

  /**
   * Render a single notification card and prepend it into #kn-notif-list.
   * Called both on hydration (existing records) and on new post().
   *
   * @param {{ id, appId, title, body, icon, timestamp }} notif
   * @param {boolean} [prepend=true] — false during initial hydration to append
   */
  function _renderCard(notif, prepend = true) {
    const list = document.getElementById('kn-notif-list');
    if (!list) return;

    // Remove "no notifications" empty state if present
    _syncEmptyState(false);

    // Don't add duplicate cards
    if (list.querySelector(`[data-notif-id="${notif.id}"]`)) return;

    const card = document.createElement('div');
    card.className     = 'kn-notif-item';
    card.dataset.notifId = String(notif.id);

    const iconClass = notif.icon || 'fa-solid fa-bell';
    const timeStr   = _formatTime(notif.timestamp);
    const bodyHtml  = notif.body
      ? `<div class="kn-notif-body">${_esc(notif.body)}</div>`
      : '';

    card.innerHTML = `
      <div class="kn-notif-icon-wrap">
        <i class="${_esc(iconClass)}"></i>
      </div>
      <div class="kn-notif-content">
        <div class="kn-notif-header">
          <span class="kn-notif-app">${_esc(notif.appId)}</span>
          <span class="kn-notif-time">${timeStr}</span>
        </div>
        <div class="kn-notif-title">${_esc(notif.title)}</div>
        ${bodyHtml}
      </div>
      <button class="kn-notif-dismiss" title="Dismiss" aria-label="Dismiss notification">
        <i class="fa-solid fa-xmark"></i>
      </button>
    `;

    card.querySelector('.kn-notif-dismiss').addEventListener('click', e => {
      e.stopPropagation();
      dismiss(notif.id);
    });

    if (prepend) {
      list.prepend(card);
    } else {
      list.appendChild(card);
    }

    _syncClearBtn();
  }

  /** Remove a notification card from the DOM. */
  function _removeCard(id) {
    const card = document.querySelector(`[data-notif-id="${id}"]`);
    if (card) {
      card.classList.add('kn-notif-exit');
      setTimeout(() => {
        card.remove();
        _syncEmptyState();
        _syncClearBtn();
      }, 220);
    }
  }

  /** Show or hide the empty-state placeholder based on live card count. */
  function _syncEmptyState(forceVisible) {
    const list    = document.getElementById('kn-notif-list');
    const empty   = document.getElementById('kn-empty-state');
    if (!list || !empty) return;

    const hasCards = list.querySelectorAll('.kn-notif-item').length > 0;
    const show     = forceVisible === undefined ? !hasCards : !forceVisible;
    empty.style.display = show ? '' : 'none';
  }

  /** Show/hide the "Clear All" button based on card count. */
  function _syncClearBtn() {
    const list = document.getElementById('kn-notif-list');
    const btn  = document.getElementById('kn-clear-btn');
    if (!list || !btn) return;
    const hasCards = list.querySelectorAll('.kn-notif-item').length > 0;
    btn.style.display = hasCards ? '' : 'none';
  }

  /** Show/hide the unread badge dot on the bell button. */
  function _syncBadge(count) {
    const btn = document.getElementById('notif-btn');
    if (!btn) return;
    let badge = btn.querySelector('.kn-badge');
    if (count > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'kn-badge';
        btn.appendChild(badge);
      }
      badge.textContent = count > 99 ? '99+' : String(count);
    } else {
      badge?.remove();
    }
  }

  /** Hydrate the panel with all persisted notifications on boot. */
  async function _hydrate() {
    const all = await _getAll();
    // Render oldest-first so the DOM order ends up newest-at-top
    for (const notif of [...all].reverse()) {
      _renderCard(notif, true);
    }
    _syncEmptyState();
    _syncClearBtn();
    _syncBadge(all.filter(n => !n.read).length);
  }

  /* ═══════════════════════════════════════════════════════════
     §7  FORMATTING UTILITIES
  ═══════════════════════════════════════════════════════════ */

  /** Escape text for safe innerHTML insertion. */
  function _esc(str = '') {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Format a Unix-ms timestamp as a human-readable relative time string.
   * e.g. "just now", "2m ago", "3h ago", "Yesterday", "Mon 19 May"
   *
   * @param {number} ts
   * @returns {string}
   */
  function _formatTime(ts) {
    const delta = Date.now() - ts;
    const sec   = Math.floor(delta / 1000);
    if (sec < 10)   return 'just now';
    if (sec < 60)   return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60)   return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24)    return `${hr}h ago`;
    const d = new Date(ts);
    const now = new Date();
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const MONS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${DAYS[d.getDay()]} ${d.getDate()} ${MONS[d.getMonth()]}`;
  }

  /* ═══════════════════════════════════════════════════════════
     §8  PUBLIC API
  ═══════════════════════════════════════════════════════════ */

  /**
   * Post a new notification from any app.
   * Automatically opens the notification panel and updates the badge.
   *
   * @param {string} appId              - ID of the calling app (e.g. 'gallery', 'music')
   * @param {object} opts
   * @param {string}  opts.title        - Required. Short notification headline.
   * @param {string}  [opts.body]       - Optional secondary text line.
   * @param {string}  [opts.icon]       - FontAwesome class string (default: 'fa-solid fa-bell')
   * @param {string}  [opts.tag]        - Optional dedup key. A new post with the same
   *                                      appId+tag replaces the previous one.
   * @param {object}  [opts.data]       - Optional arbitrary JSON payload for the app to consume.
   * @returns {Promise<number>}           The new notification's integer ID.
   *
   * @example
   * // From photos.js after an export:
   * await KOSNDB.post('gallery', {
   *   title : 'Export complete',
   *   body  : '42 photos saved.',
   *   icon  : 'fa-solid fa-images',
   *   tag   : 'export',
   * });
   */
  async function post(appId, opts = {}) {
    await ready;

    const { title, body = '', icon = 'fa-solid fa-bell', tag = '', data = null } = opts;

    if (!title) throw new TypeError('[KOSNDB] post(): opts.title is required.');

    // Deduplicate by tag if provided
    await _deduplicateTag(appId, tag);

    const record = { appId, title, body, icon, tag, data };
    const id = await _insert(record);

    // Trim overflow
    await _trim();

    // Build the full record (includes id + timestamp) for DOM/bus
    const full = { id, ...record, timestamp: Date.now() };

    // Update panel DOM
    _renderCard(full, true);
    _syncBadge(
      (await _getAll()).filter(n => !n.read).length
    );

    // Auto-open notification panel
    if (typeof toggleNotifPanel === 'function') {
      // Only open if not already open
      const notifEl = document.getElementById('kos-notif-panel');
      if (notifEl && !notifEl.classList.contains('panel-open')) {
        toggleNotifPanel();
      }
    }

    // Emit bus event
    if (window.KOSBus) {
      KOSBus.dispatch('kos:notif-posted', {
        id, appId, title, body, icon, tag, timestamp: full.timestamp,
      });
    }

    return id;
  }

  /**
   * Dismiss (permanently delete) a single notification by ID.
   * Called automatically when the user clicks the × on a card.
   *
   * @param {number} id
   * @returns {Promise<void>}
   */
  async function dismiss(id) {
    await ready;
    await _deleteById(Number(id));
    _removeCard(id);
    _syncBadge(
      (await _getAll()).filter(n => !n.read).length
    );

    if (window.KOSBus) {
      KOSBus.dispatch('kos:notif-dismissed', { id: Number(id) });
    }
  }

  /**
   * Clear ALL notifications — wipes the DB and empties the panel.
   * Bound to the "Clear All" button in the notification panel header.
   *
   * @returns {Promise<void>}
   */
  async function clearAll() {
    await ready;
    await _p(_store('readwrite').clear());

    // Remove all rendered cards
    const list = document.getElementById('kn-notif-list');
    if (list) {
      list.querySelectorAll('.kn-notif-item').forEach(c => c.remove());
    }

    _syncEmptyState();
    _syncClearBtn();
    _syncBadge(0);

    if (window.KOSBus) {
      KOSBus.dispatch('kos:notif-cleared', {});
    }
  }

  /**
   * Return all stored notification records, sorted newest-first.
   * Useful for apps that want to programmatically inspect the notification queue.
   *
   * @returns {Promise<object[]>}
   */
  async function list() {
    await ready;
    return _getAll();
  }

  /**
   * Mark a notification as read (removes badge count, does not delete it).
   *
   * @param {number} id
   * @returns {Promise<void>}
   */
  async function markRead(id) {
    await ready;
    const all = await _getAll();
    const rec = all.find(n => n.id === Number(id));
    if (!rec) return;
    rec.read = true;
    await _p(_store('readwrite').put(rec));
    _syncBadge(all.filter(n => !n.read && n.id !== Number(id)).length);
  }

  /* ═══════════════════════════════════════════════════════════
     §9  INIT
  ═══════════════════════════════════════════════════════════ */

  /**
   * Initialise KOSNDB — open the database and hydrate the panel.
   * Called once by kos-init.js during the boot sequence, right after KOSFS.init().
   *
   * @returns {Promise<void>}
   *
   * @example
   * // In kos-init.js:
   * await KOSFS.init();
   * await KOSNDB.init();   // ← add this line
   */
  async function init() {
    try {
      _db = await _openDB();
      await _hydrate();
      _readyResolve();

      if (window.KOSBus) {
        KOSBus.dispatch('kos:ndb-ready', {});
      }
      console.info('[KOSNDB] Notification database ready.');
    } catch (err) {
      _readyReject(err);
      console.error('[KOSNDB] Init failed:', err);
      throw err;
    }
  }

  /* ═══════════════════════════════════════════════════════════
     §10  PUBLIC SURFACE
  ═══════════════════════════════════════════════════════════ */

  return Object.freeze({
    // Lifecycle
    ready,
    init,

    // Core API — callable from any app
    post,
    dismiss,
    clearAll,
    list,
    markRead,
  });

})();
