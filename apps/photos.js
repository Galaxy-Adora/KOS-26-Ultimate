/* ══════════════════════════════════════════════════════════════
   KOS ULTIMATE 2026 — apps/photos.js  (Alpha 9 build)
   KOSFS kernel-level IDB integration + PDF support
   ══════════════════════════════════════════════════════════════

   Memory contract
   ───────────────
   • _idbMeta[]   : KOSFS metadata only — NO data/buf in RAM ever
   • _blobCache   : LRU Map<id, objectURL>, capped at BLOB_CAP
   • _currentImgs : index array rebuilt once per render cycle
   • _kbHandler   : tracked so it is removed on cleanup
   • _lazyObs     : IntersectionObserver disconnected on cleanup
   All blob URLs are revoked when evicted or on window close.

   KOSFS Integration (Alpha 9)
   ───────────────────────────
   • Scopes registered: ['photos', 'documents']
   • Reads  : KOSFS.list() → metadata; KOSFS.readObjectURL() → blob URL
   • Writes : KOSFS.write() — accepts File directly, infers type
   • Deletes: KOSFS.delete()
   • Legacy : direct kos-photos IDB used as graceful fallback
               when KOSFS is not loaded (pre-Alpha-9 environments)

   PDF Support
   ───────────
   • Accepted file types: image/* + application/pdf
   • Grid cells: icon-based placeholder (no broken <img>)
   • Lightbox  : <embed> viewer, wallpaper button hidden
   • Sidebar   : dedicated "PDFs" album tab
   • Toast     : separate counts for photos vs PDFs on import
   ══════════════════════════════════════════════════════════════ */

'use strict';
window.KOSApps = window.KOSApps || {};

/* ─── Constants ─── */
const BLOB_CAP       = 40;
const GALLERY_APP_ID = 'gallery';

/* ─── Module-level state ─── */
let _idbMeta     = [];          // KOSFS metadata records — no file data in RAM
let _blobCache   = new Map();   // LRU  id → objectURL
let _currentImgs = [];          // filtered list for current render cycle
let _lazyObs     = null;        // IntersectionObserver ref
let _kbHandler   = null;        // keydown handler ref for clean removal
let _renderTimer = null;        // debounce handle

let _sidebarAlbum = 'library';
let _galleryView  = 'grid';
let _favourites   = new Set(JSON.parse(localStorage.getItem('kos_photo_favs') || '[]'));

let _lbIdx = -1;    // lightbox index into _currentImgs
let _lbSrc = '';    // lightbox resolved blob URL or plain URL

/* ══════════════════════════════════════════════════════════════
   1. KOSFS kernel filesystem integration
   ══════════════════════════════════════════════════════════════ */

/**
 * Register this app with the KOSFS kernel and wait for the
 * filesystem to be ready. Returns true if KOSFS is available,
 * false if we'll fall back to the legacy direct-IDB path.
 */
async function kosfsInit() {
  if (!window.KOSFS) {
    console.warn('[Photos] KOSFS not found — running on legacy kos-photos IDB');
    return false;
  }
  KOSFS.registerApp(GALLERY_APP_ID, ['photos', 'documents']);
  await KOSFS.ready;
  return true;
}

/** Pull lightweight metadata from KOSFS (no binary data in RAM). */
async function kosfsLoadMeta() {
  if (!window.KOSFS) return _legacyLoadMeta();
  return KOSFS.list(GALLERY_APP_ID);   // strips data field automatically
}

/* ══════════════════════════════════════════════════════════════
   2. Blob URL LRU cache  — KOSFS path + legacy fallback
   ══════════════════════════════════════════════════════════════ */
async function getBlobUrl(id) {
  if (_blobCache.has(id)) {
    /* LRU hit: move entry to tail */
    const url = _blobCache.get(id);
    _blobCache.delete(id);
    _blobCache.set(id, url);
    return url;
  }

  /* Evict oldest entry when at capacity */
  if (_blobCache.size >= BLOB_CAP) {
    const oldest = _blobCache.keys().next().value;
    URL.revokeObjectURL(_blobCache.get(oldest));
    _blobCache.delete(oldest);
  }

  try {
    const url = window.KOSFS
      ? await KOSFS.readObjectURL(GALLERY_APP_ID, id)   // KOSFS path (caller must revoke — our LRU does this)
      : await _legacyGetBlobUrl(id);                     // legacy fallback
    if (!url) return null;
    _blobCache.set(id, url);
    return url;
  } catch { return null; }
}

function revokeAllBlobs() {
  _blobCache.forEach(url => URL.revokeObjectURL(url));
  _blobCache.clear();
}

/* ══════════════════════════════════════════════════════════════
   3. Legacy direct-IDB fallback (kos-photos, schema v2)
      Used only when KOSFS is not loaded (pre-Alpha-9 builds).
      Kept to avoid breaking existing installs.
   ══════════════════════════════════════════════════════════════ */
const _LG_IDB_NAME  = 'kos-photos';
const _LG_IDB_VER   = 2;
const _LG_IDB_STORE = 'uploads';
let   _lgConn = null;

async function _legacyGetDB() {
  if (_lgConn) return _lgConn;
  _lgConn = await new Promise((res, rej) => {
    const req = indexedDB.open(_LG_IDB_NAME, _LG_IDB_VER);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(_LG_IDB_STORE))
        db.createObjectStore(_LG_IDB_STORE, { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });
  return _lgConn;
}

/** Cursor-walk legacy IDB, strip binary fields, normalise to KOSFS-like shape. */
async function _legacyLoadMeta() {
  const db = await _legacyGetDB();
  return new Promise((res, rej) => {
    const records = [];
    const req = db.transaction(_LG_IDB_STORE, 'readonly')
                  .objectStore(_LG_IDB_STORE).openCursor();
    req.onsuccess = e => {
      const cursor = e.target.result;
      if (!cursor) { res(records); return; }
      const { src: _s, buf: _b, data: _d, ...m } = cursor.value;
      const mime = m.mime || m.mimeType || '';
      records.push({
        id: m.id,
        name: m.name,
        size: m.size,
        mimeType: mime,
        type: mime.includes('pdf') ? 'document' : 'image',
        createdAt: m.date ? new Date(m.date).getTime() : Date.now(),
        tags: [],
        albumIds: [],
        _legacy: true,
      });
      cursor.continue();
    };
    req.onerror = e => rej(e.target.error);
  });
}

/** Fetch one legacy record's binary data and return an object URL. */
async function _legacyGetBlobUrl(id) {
  const db = await _legacyGetDB();
  return new Promise((res, rej) => {
    const req = db.transaction(_LG_IDB_STORE, 'readonly')
                  .objectStore(_LG_IDB_STORE).get(id);
    req.onsuccess = async e => {
      const r = e.target.result;
      if (!r) { res(null); return; }
      let blob;
      if (r.buf)       blob = new Blob([r.buf], { type: r.mime || r.mimeType });
      else if (r.data) blob = new Blob([r.data], { type: r.mime || r.mimeType });
      else if (r.src)  { const rsp = await fetch(r.src); blob = await rsp.blob(); }
      else             { res(null); return; }
      res(URL.createObjectURL(blob));
    };
    req.onerror = e => rej(e.target.error);
  });
}

/** Write a file to the legacy IDB (PDF-aware). */
async function _legacyAdd(file) {
  const buf = await file.arrayBuffer();
  const db  = await _legacyGetDB();
  return new Promise((res, rej) => {
    const req = db.transaction(_LG_IDB_STORE, 'readwrite')
                  .objectStore(_LG_IDB_STORE)
                  .add({
                    buf, name: file.name, mime: file.type,
                    size: file.size, width: 0, height: 0,
                    date: new Date(file.lastModified || Date.now()).toISOString(),
                    itype: file.type.includes('pdf') ? 'document' : 'upload',
                  });
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });
}

async function _legacyDelete(id) {
  const db = await _legacyGetDB();
  return new Promise((res, rej) => {
    const req = db.transaction(_LG_IDB_STORE, 'readwrite')
                  .objectStore(_LG_IDB_STORE).delete(id);
    req.onsuccess = () => res();
    req.onerror   = e => rej(e.target.error);
  });
}

/* ══════════════════════════════════════════════════════════════
   4. App object
   ══════════════════════════════════════════════════════════════ */
window.KOSApps.gallery = {
  async init() {
    const body = document.getElementById('gallery-body');
    if (!body) return;
    _injectPdfStyles();              // inject PDF-specific CSS once
    await kosfsInit();               // register with kernel filesystem
    _idbMeta = await kosfsLoadMeta().catch(() => []);
    renderShell(body);
    attachStaticListeners();
    scheduleRender();
  },

  async refresh() {
    const body = document.getElementById('gallery-body');
    if (!body || !WM?.registry['gallery']?.open) return;
    _idbMeta = await kosfsLoadMeta().catch(() => _idbMeta);
    updateSidebarCounts();
    scheduleRender();
  },
};

/* ══════════════════════════════════════════════════════════════
   5. PDF-specific CSS injection
      Adds styles for the embed viewer, PDF grid cells, and
      the PDF icon placeholder — only injected once per page.
   ══════════════════════════════════════════════════════════════ */
function _injectPdfStyles() {
  if (document.getElementById('ph-pdf-styles')) return;
  const style = document.createElement('style');
  style.id = 'ph-pdf-styles';
  style.textContent = `
    /* ── PDF embed in lightbox ── */
    .ph-lb-pdf {
      width: 100%;
      height: 100%;
      border: none;
      border-radius: var(--radius, 8px);
      background: #1a1a1a;
      display: block;
    }
    .ph-lb-pdf.lb-hidden { display: none !important; }

    /* ── PDF grid cell ── */
    .ph-cell--pdf {
      background: linear-gradient(145deg,
        color-mix(in srgb, var(--accent, #e05) 6%, var(--surface-2, #1e1e1e)),
        var(--surface-2, #1e1e1e)
      );
    }
    .ph-cell-pdf-thumb {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px;
      box-sizing: border-box;
    }
    .ph-cell-pdf-thumb i {
      font-size: clamp(1.8rem, 4vw, 2.8rem);
      color: #e05;
      opacity: 0.85;
      filter: drop-shadow(0 2px 6px rgba(0,0,0,.5));
    }
    .ph-cell-pdf-name {
      font-size: 0.6rem;
      color: var(--text-2, rgba(255,255,255,.5));
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      text-align: center;
      padding: 0 4px;
    }

    /* ── PDFs sidebar badge dot ── */
    #sb-docs { background: #e05; }
  `;
  document.head.appendChild(style);
}

/* ══════════════════════════════════════════════════════════════
   6. Shell — rendered once per open, never on data refresh
   ══════════════════════════════════════════════════════════════ */
function renderShell(body) {
  body.innerHTML = `
    <div class="ph-app" id="ph-app">
      <aside class="ph-sidebar">
        <div class="ph-sidebar-section-label">Library</div>
        <nav class="ph-sidebar-nav" id="ph-sidenav">
          <div class="ph-nav-item" data-album="library">
            <i class="fa-solid fa-photo-film"></i><span>Photos</span>
          </div>
          <div class="ph-nav-item" data-album="favourites">
            <i class="fa-solid fa-heart"></i><span>Favourites</span>
            <span class="ph-sidebar-badge" id="sb-favs"></span>
          </div>
        </nav>
        <div class="ph-sidebar-section-label">Albums</div>
        <nav class="ph-sidebar-nav" id="ph-sidenav2">
          <div class="ph-nav-item" data-album="uploads">
            <i class="fa-solid fa-cloud-arrow-up"></i><span>Uploads</span>
            <span class="ph-sidebar-badge" id="sb-uploads"></span>
          </div>
          <div class="ph-nav-item" data-album="documents">
            <i class="fa-solid fa-file-pdf"></i><span>PDFs</span>
            <span class="ph-sidebar-badge" id="sb-docs"></span>
          </div>
          <div class="ph-nav-item" data-album="avatars">
            <i class="fa-solid fa-user-circle"></i><span>Avatars</span>
            <span class="ph-sidebar-badge" id="sb-avatars"></span>
          </div>
          <div class="ph-nav-item" data-album="wallpapers">
            <i class="fa-solid fa-panorama"></i><span>Wallpapers</span>
            <span class="ph-sidebar-badge" id="sb-walls"></span>
          </div>
        </nav>
        <div class="ph-sidebar-bottom">
          <button class="ph-upload-btn" id="ph-upload-btn">
            <i class="fa-solid fa-plus"></i> Import
          </button>
        </div>
      </aside>

      <main class="ph-main">
        <div class="ph-toolbar">
          <div class="ph-toolbar-title" id="ph-toolbar-title">Photos</div>
          <div class="ph-toolbar-actions">
            <div class="ph-view-toggle" id="ph-view-toggle">
              <button class="ph-view-btn" data-view="grid"   title="Grid"><i class="fa-solid fa-grid-2"></i></button>
              <button class="ph-view-btn" data-view="months" title="Months"><i class="fa-solid fa-calendar-days"></i></button>
            </div>
            <button class="ph-import-fab" id="ph-import-fab" title="Import Photos or PDFs">
              <i class="fa-solid fa-plus"></i>
            </button>
          </div>
        </div>
        <div class="ph-scroll-area" id="ph-scroll-area"></div>
      </main>

      <div class="ph-lightbox" id="gallery-lightbox" aria-hidden="true">
        <div class="ph-lb-topbar" id="ph-lb-topbar">
          <button class="ph-lb-btn" data-lb="close" title="Close"><i class="fa-solid fa-chevron-left"></i></button>
          <span class="ph-lb-title" id="lb-label">Photo</span>
          <div class="ph-lb-actions-right">
            <button class="ph-lb-btn" data-lb="fav"   title="Favourite"><i class="fa-regular fa-heart"></i></button>
            <button class="ph-lb-btn" data-lb="open"  title="Open in new tab"><i class="fa-solid fa-arrow-up-right-from-square"></i></button>
            <button class="ph-lb-btn lb-setwp-btn"    data-lb="setwp" title="Set as wallpaper" id="lb-setwp-btn"><i class="fa-solid fa-display"></i></button>
            <button class="ph-lb-btn ph-lb-danger lb-hidden" data-lb="del" title="Delete"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
        <div class="ph-lb-body">
          <div class="ph-lb-img-wrap">
            <img   class="ph-lb-img"               id="lb-img" src="" alt="" decoding="async">
            <embed class="ph-lb-pdf lb-hidden"      id="lb-pdf" type="application/pdf" title="PDF Viewer">
          </div>
          <aside class="ph-lb-info">
            <div class="ph-lb-info-title">Info</div>
            <div id="lb-exif"></div>
          </aside>
        </div>
      </div>

      <div class="ph-toast" id="ph-toast" aria-live="polite"></div>

      <!-- Accept images AND PDFs — the only change to the file input -->
      <input type="file" id="ph-file-input"
             accept="image/*,application/pdf"
             multiple style="display:none">
    </div>`;

  _syncSidebarUI();
  _syncViewUI();
  updateSidebarCounts();
}

/* ══════════════════════════════════════════════════════════════
   7. Event listeners — attached ONCE per shell; use delegation
   ══════════════════════════════════════════════════════════════ */
function attachStaticListeners() {
  const triggerUpload = () => document.getElementById('ph-file-input')?.click();

  /* Sidebar nav — two nav groups, one delegated handler each */
  document.getElementById('ph-sidenav')?.addEventListener('click', e => {
    const item = e.target.closest('.ph-nav-item');
    if (item) phSetAlbum(item.dataset.album);
  });
  document.getElementById('ph-sidenav2')?.addEventListener('click', e => {
    const item = e.target.closest('.ph-nav-item');
    if (item) phSetAlbum(item.dataset.album);
  });

  /* View toggle */
  document.getElementById('ph-view-toggle')?.addEventListener('click', e => {
    const btn = e.target.closest('.ph-view-btn');
    if (btn) phSetView(btn.dataset.view);
  });

  /* Import buttons */
  document.getElementById('ph-upload-btn')?.addEventListener('click', triggerUpload);
  document.getElementById('ph-import-fab')?.addEventListener('click', triggerUpload);

  /* File input — handles both images and PDFs */
  document.getElementById('ph-file-input')?.addEventListener('change', handleFileInput);

  /* Grid — single delegated handler for cell + delete clicks */
  document.getElementById('ph-scroll-area')?.addEventListener('click', e => {
    const del  = e.target.closest('.ph-cell-del');
    const cell = e.target.closest('.ph-cell');
    if (del && cell) {
      e.stopPropagation();
      deleteCell(+cell.dataset.idx);
    } else if (cell) {
      openLightboxAtIdx(+cell.dataset.idx);
    }
  });

  /* Lightbox topbar — delegated */
  document.getElementById('ph-lb-topbar')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-lb]');
    if (!btn) return;
    ({
      close: closeLightbox,
      fav:   _toggleFav,
      open:  () => _lbSrc && window.open(_lbSrc, '_blank'),
      setwp: _setAsWallpaper,
      del:   _deleteCurrent,
    })[btn.dataset.lb]?.();
  });

  /* Keyboard — tracked for removal on cleanup */
  if (_kbHandler) document.removeEventListener('keydown', _kbHandler);
  _kbHandler = e => { if (e.key === 'Escape') closeLightbox(); };
  document.addEventListener('keydown', _kbHandler);
}

/* ══════════════════════════════════════════════════════════════
   8. Data layer — builds _currentImgs ONCE per render cycle
   ══════════════════════════════════════════════════════════════ */
function buildImageList() {
  const list = [];

  /* Stock avatars (no IDB) */
  (window.STOCK_AVATARS || []).forEach(a => list.push({
    src: a.src, label: a.label, type: 'avatar', deletable: false, idbId: null,
    name: a.label, size: null, width: null, height: null, date: null, mime: null, isPdf: false,
  }));

  /* Default wallpaper */
  list.push({
    src: 'documents/dfw.jpg', label: 'Default Wallpaper', type: 'wallpaper',
    deletable: false, idbId: null,
    name: 'DFW Default', size: null, width: null, height: null, date: null, mime: null, isPdf: false,
  });

  /* Custom avatars */
  if (typeof getCustomAvatars === 'function')
    getCustomAvatars().forEach(src => list.push({
      src, label: 'Avatar', type: 'avatar', deletable: true, idbId: null,
      name: src.split('/').pop(), size: null, width: null, height: null, date: null, mime: null, isPdf: false,
    }));

  /* Custom wallpapers */
  if (typeof getCustomWallpapers === 'function')
    getCustomWallpapers().forEach(src => list.push({
      src, label: 'Wallpaper', type: 'wallpaper', deletable: true, idbId: null,
      name: src.split('/').pop(), size: null, width: null, height: null, date: null, mime: null, isPdf: false,
    }));

  /* KOSFS / legacy IDB files — metadata only, src resolved lazily */
  _idbMeta.forEach(m => {
    const mime  = m.mimeType || m.mime || '';
    const isPdf = mime.includes('pdf') || m.type === 'document';
    list.push({
      src:       null,
      label:     m.name,
      type:      isPdf ? 'document' : 'upload',
      deletable: true,
      idbId:     m.id,
      name:      m.name,
      size:      m.size  ?? null,
      width:     null,     // KOSFS doesn't store dimensions; omit from exif
      height:    null,
      date:      m.createdAt ? new Date(m.createdAt).toISOString() : null,
      mime,
      isPdf,
    });
  });

  return list;
}

function filterImages(all) {
  const favKey = i => i.src || String(i.idbId);
  switch (_sidebarAlbum) {
    case 'uploads':    return all.filter(i => i.idbId != null);
    case 'documents':  return all.filter(i => i.isPdf);
    case 'avatars':    return all.filter(i => i.type === 'avatar');
    case 'wallpapers': return all.filter(i => i.type === 'wallpaper');
    case 'favourites': return all.filter(i => _favourites.has(favKey(i)));
    default:           return all;   // 'library' — everything
  }
}

/* ══════════════════════════════════════════════════════════════
   9. Sidebar counts — derived from _idbMeta, not full rebuild
   ══════════════════════════════════════════════════════════════ */
function updateSidebarCounts() {
  const all    = buildImageList();
  const favKey = i => i.src || String(i.idbId);
  const set    = (id, n) => { const el = document.getElementById(id); if (el) el.textContent = n || ''; };

  set('sb-uploads', _idbMeta.length);
  set('sb-docs',    _idbMeta.filter(m => (m.mimeType || m.mime || '').includes('pdf') || m.type === 'document').length);
  set('sb-avatars', all.filter(i => i.type === 'avatar').length);
  set('sb-walls',   all.filter(i => i.type === 'wallpaper').length);
  set('sb-favs',    all.filter(i => _favourites.has(favKey(i))).length);
}

/* ══════════════════════════════════════════════════════════════
   10. Render — debounced 1 frame, rebuilds only scroll area
   ══════════════════════════════════════════════════════════════ */
function scheduleRender() {
  clearTimeout(_renderTimer);
  _renderTimer = setTimeout(doRender, 16);
}

function doRender() {
  const scroll = document.getElementById('ph-scroll-area');
  if (!scroll) return;

  _lazyObs?.disconnect();

  const all = buildImageList();
  _currentImgs = filterImages(all);

  if (!_currentImgs.length) {
    const isDocsTab = _sidebarAlbum === 'documents';
    scroll.innerHTML = `
      <div class="ph-empty">
        <i class="fa-regular ${isDocsTab ? 'fa-file-pdf' : 'fa-images'}"></i>
        <p>No ${isDocsTab ? 'PDFs' : 'photos'} here yet.</p>
        <button class="ph-empty-import" id="ph-empty-import">
          Import ${isDocsTab ? 'a PDF' : 'Photos'}
        </button>
      </div>`;
    document.getElementById('ph-empty-import')
      ?.addEventListener('click', () => document.getElementById('ph-file-input')?.click());
    return;
  }

  scroll.innerHTML = _galleryView === 'months'
    ? _buildMonthsHTML(_currentImgs)
    : _buildGridHTML(_currentImgs);

  _setupLazyLoader(scroll);
}

function _buildGridHTML(imgs) {
  const n = imgs.length;
  return `<div class="ph-count-bar">${n} item${n !== 1 ? 's' : ''}</div>
          <div class="ph-grid">${imgs.map(_cellHTML).join('')}</div>`;
}

function _buildMonthsHTML(imgs) {
  const groups = new Map();
  const noDate = [];

  imgs.forEach((img, i) => {
    if (!img.date) { noDate.push(i); return; }
    const d   = new Date(img.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!groups.has(key)) groups.set(key, {
      label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      idxs:  [],
    });
    groups.get(key).idxs.push(i);
  });

  const total = imgs.length;
  let html = `<div class="ph-count-bar">${total} item${total !== 1 ? 's' : ''}</div>`;

  [...groups.keys()].sort().reverse().forEach(k => {
    const g = groups.get(k);
    html += `<div class="ph-month-group">
      <div class="ph-month-label">${g.label}</div>
      <div class="ph-grid">${g.idxs.map(i => _cellHTML(imgs[i], i)).join('')}</div>
    </div>`;
  });

  if (noDate.length)
    html += `<div class="ph-month-group">
      <div class="ph-month-label">Other</div>
      <div class="ph-grid">${noDate.map(i => _cellHTML(imgs[i], i)).join('')}</div>
    </div>`;

  return html;
}

/**
 * Build one grid cell.
 * • Images: lazy <img> via IntersectionObserver (existing behaviour)
 * • PDFs:   icon placeholder — no broken <img>, observer skips these
 */
function _cellHTML(img, idx) {
  const isIDB  = img.idbId != null;
  const favKey = img.src || String(img.idbId);
  const isFav  = _favourites.has(favKey);
  const isPdf  = img.isPdf;

  /* Media element: PDF icon placeholder vs lazy image */
  const mediaEl = isPdf
    ? `<div class="ph-cell-pdf-thumb">
         <i class="fa-solid fa-file-pdf"></i>
         <span class="ph-cell-pdf-name">${_esc(img.name || 'PDF')}</span>
       </div>`
    : `<img${isIDB ? '' : ` src="${_esc(img.src || '')}" loading="lazy"`} alt="${_esc(img.label || '')}">`;

  return `<div class="ph-cell${isPdf ? ' ph-cell--pdf' : ''}"
               data-idx="${idx}"
               ${isIDB ? `data-idb-id="${img.idbId}"` : ''}
               ${isPdf  ? 'data-pdf="1"'               : ''}>
    ${mediaEl}
    ${isFav ? `<span class="ph-cell-fav"><i class="fa-solid fa-heart"></i></span>` : ''}
    <div class="ph-cell-overlay">
      <span class="ph-cell-type">${isPdf ? 'PDF' : _esc(img.type)}</span>
      ${img.deletable ? `<button class="ph-cell-del" title="Delete"><i class="fa-solid fa-trash"></i></button>` : ''}
    </div>
  </div>`;
}

/* ══════════════════════════════════════════════════════════════
   11. Lazy loader — IntersectionObserver for image cells only
       PDF cells (data-pdf="1") are excluded; they use the icon.
   ══════════════════════════════════════════════════════════════ */
function _setupLazyLoader(root) {
  /* Select IDB image cells only — not PDFs, not static-src cells */
  const cells = root.querySelectorAll('.ph-cell[data-idb-id]:not([data-pdf])');
  if (!cells.length) return;

  _lazyObs = new IntersectionObserver(async (entries, obs) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const cell = entry.target;
      obs.unobserve(cell);
      const el = cell.querySelector('img');
      if (!el || el.src) continue;
      const url = await getBlobUrl(+cell.dataset.idbId);
      if (url && el.isConnected) el.src = url;
    }
  }, { root, rootMargin: '300px 0px' });

  cells.forEach(c => _lazyObs.observe(c));
}

/* ══════════════════════════════════════════════════════════════
   12. Lightbox — unified viewer for images and PDFs
   ══════════════════════════════════════════════════════════════ */
async function openLightboxAtIdx(idx) {
  if (idx < 0 || idx >= _currentImgs.length) return;
  const img = _currentImgs[idx];

  let src = img.src;
  if (!src && img.idbId != null) src = await getBlobUrl(img.idbId);
  if (!src) return;

  _lbIdx = idx;
  _lbSrc = src;

  const lb        = document.getElementById('gallery-lightbox');
  const lbImg     = document.getElementById('lb-img');
  const lbPdf     = document.getElementById('lb-pdf');
  const lbl       = document.getElementById('lb-label');
  const setwpBtn  = document.getElementById('lb-setwp-btn');

  if (lbl) lbl.textContent = img.label || img.name || img.type;

  if (img.isPdf) {
    /* ── PDF mode ── */
    if (lbImg) { lbImg.classList.add('lb-hidden'); lbImg.src = ''; }
    if (lbPdf) { lbPdf.classList.remove('lb-hidden'); lbPdf.src = src; }
    /* Wallpaper action is meaningless for PDFs — hide the button */
    setwpBtn?.classList.add('lb-hidden');
  } else {
    /* ── Image mode ── */
    if (lbPdf) { lbPdf.classList.add('lb-hidden'); lbPdf.removeAttribute('src'); }
    if (lbImg) { lbImg.classList.remove('lb-hidden'); lbImg.src = src; }
    setwpBtn?.classList.remove('lb-hidden');
  }

  lb?.querySelector('[data-lb="del"]')?.classList.toggle('lb-hidden', !img.deletable);
  _updateFavBtn();
  _renderExif(img);
  lb?.classList.add('lb-open');
  lb?.setAttribute('aria-hidden', 'false');
}

function closeLightbox() {
  const lb    = document.getElementById('gallery-lightbox');
  const lbImg = document.getElementById('lb-img');
  const lbPdf = document.getElementById('lb-pdf');
  lb?.classList.remove('lb-open');
  lb?.setAttribute('aria-hidden', 'true');
  if (lbImg) { lbImg.src = ''; lbImg.classList.remove('lb-hidden'); }
  if (lbPdf) { lbPdf.removeAttribute('src'); lbPdf.classList.add('lb-hidden'); }
  _lbIdx = -1;
  _lbSrc = '';
}

function _toggleFav() {
  const img = _currentImgs[_lbIdx];
  if (!img) return;
  const key = img.src || String(img.idbId);
  _favourites.has(key) ? _favourites.delete(key) : _favourites.add(key);
  localStorage.setItem('kos_photo_favs', JSON.stringify([..._favourites]));
  _updateFavBtn();
  scheduleRender();
}

function _updateFavBtn() {
  const img = _currentImgs[_lbIdx];
  if (!img) return;
  const btn = document.querySelector('[data-lb="fav"]');
  if (!btn) return;
  const isFav = _favourites.has(img.src || String(img.idbId));
  btn.querySelector('i').className = isFav ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
  btn.classList.toggle('ph-lb-faved', isFav);
}

function _setAsWallpaper() {
  const img = _currentImgs[_lbIdx];
  if (!img || img.isPdf || !_lbSrc) return;   // PDFs can't be wallpapers
  if (img.type === 'wallpaper') {
    const key = img.src === 'documents/dfw.jpg' ? 'default' : _lbSrc;
    if (typeof selectWallpaper === 'function') selectWallpaper(key);
  } else {
    if (typeof addCustomWallpaper === 'function') addCustomWallpaper(_lbSrc);
    if (typeof selectWallpaper    === 'function') selectWallpaper(_lbSrc);
  }
  showToast('Wallpaper set');
  closeLightbox();
  window.KOSApps.gallery.refresh();
}

async function _deleteCurrent() {
  const idx = _lbIdx;
  closeLightbox();
  await deleteCell(idx);
}

function _renderExif(img) {
  const el = document.getElementById('lb-exif');
  if (!el) return;
  const rows = [
    img.name              && ['File name',  img.name],
    img.mime              && ['Type',        img.mime],
    img.size              && ['Size',        _fmtBytes(img.size)],
    img.width && img.height && ['Dimensions', `${img.width} × ${img.height} px`],
    img.date              && ['Date',        _fmtDate(img.date)],
    img.type              && ['Album',       img.isPdf ? 'Documents' : img.type[0].toUpperCase() + img.type.slice(1)],
  ].filter(Boolean);
  el.innerHTML = rows.length
    ? rows.map(([k, v]) =>
        `<div class="ph-exif-row">
           <span class="ph-exif-key">${_esc(k)}</span>
           <span class="ph-exif-val">${_esc(String(v))}</span>
         </div>`
      ).join('')
    : `<div class="ph-exif-na">No metadata available</div>`;
}

/* ══════════════════════════════════════════════════════════════
   13. Delete — KOSFS path with legacy fallback
   ══════════════════════════════════════════════════════════════ */
async function deleteCell(idx) {
  const img = _currentImgs[idx];
  if (!img?.deletable) return;

  if (img.idbId != null) {
    /* Revoke cached blob URL immediately */
    if (_blobCache.has(img.idbId)) {
      URL.revokeObjectURL(_blobCache.get(img.idbId));
      _blobCache.delete(img.idbId);
    }
    if (window.KOSFS) {
      await KOSFS.delete(GALLERY_APP_ID, img.idbId).catch(console.error);
    } else {
      await _legacyDelete(img.idbId).catch(console.error);
    }
  } else {
    /* Non-IDB assets: custom avatars / wallpapers */
    if (img.type === 'avatar'    && typeof deleteCustomAvatar    === 'function') deleteCustomAvatar(img.src);
    if (img.type === 'wallpaper' && typeof deleteCustomWallpaper === 'function') deleteCustomWallpaper(img.src);
  }

  /* Remove from favourites */
  const key = img.src || String(img.idbId);
  _favourites.delete(key);
  localStorage.setItem('kos_photo_favs', JSON.stringify([..._favourites]));

  _idbMeta = await kosfsLoadMeta().catch(() => _idbMeta);
  scheduleRender();
}

/* ══════════════════════════════════════════════════════════════
   14. Upload — writes through KOSFS kernel filesystem
       KOSFS.write() accepts a File directly and infers the
       type (image → TYPES.IMAGE, PDF → TYPES.DOCUMENT).
       Legacy IDB path is used as fallback when KOSFS is absent.
   ══════════════════════════════════════════════════════════════ */
async function handleFileInput(e) {
  const inp   = e.currentTarget;
  const files = Array.from(inp.files || []);
  inp.value   = '';   // reset so re-selecting same file works

  const accepted = files.filter(f => f.type.startsWith('image/') || f.type === 'application/pdf');
  const skipped  = files.length - accepted.length;

  for (const file of accepted) await _importFile(file);

  _idbMeta = await kosfsLoadMeta().catch(() => _idbMeta);
  scheduleRender();

  if (accepted.length) {
    const imgs = accepted.filter(f => f.type.startsWith('image/')).length;
    const pdfs = accepted.filter(f => f.type === 'application/pdf').length;
    const parts = [];
    if (imgs) parts.push(`${imgs} photo${imgs !== 1 ? 's' : ''}`);
    if (pdfs) parts.push(`${pdfs} PDF${pdfs !== 1 ? 's' : ''}`);
    showToast(`${parts.join(' and ')} imported`);
  }
  if (skipped) showToast(`${skipped} unsupported file${skipped !== 1 ? 's' : ''} skipped`);
}

async function _importFile(file) {
  if (window.KOSFS) {
    /* ── KOSFS kernel path ─────────────────────────────────────
       Pass the File object directly; KOSFS normalises it to
       ArrayBuffer internally and infers the type from MIME.
       ───────────────────────────────────────────────────────── */
    await KOSFS.write(GALLERY_APP_ID, file, {
      name: file.name,
      tags: ['uploaded'],
    });
    return;
  }

  /* ── Legacy direct-IDB path ────────────────────────────────── */
  await _legacyAdd(file);
}

/* ══════════════════════════════════════════════════════════════
   15. Sidebar / toolbar state
   ══════════════════════════════════════════════════════════════ */
function phSetAlbum(album) {
  _sidebarAlbum = album;
  _syncSidebarUI();
  const titles = {
    library:    'Photos',
    uploads:    'Uploads',
    documents:  'PDFs',
    avatars:    'Avatars',
    wallpapers: 'Wallpapers',
    favourites: 'Favourites',
  };
  const tb = document.getElementById('ph-toolbar-title');
  if (tb) tb.textContent = titles[album] || 'Photos';
  scheduleRender();
}

function phSetView(view) {
  _galleryView = view;
  _syncViewUI();
  scheduleRender();
}

function _syncSidebarUI() {
  document.querySelectorAll('.ph-nav-item').forEach(el =>
    el.classList.toggle('active', el.dataset.album === _sidebarAlbum)
  );
}

function _syncViewUI() {
  document.querySelectorAll('.ph-view-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.view === _galleryView)
  );
}

/* ══════════════════════════════════════════════════════════════
   16. Toast
   ══════════════════════════════════════════════════════════════ */
function showToast(msg) {
  const t = document.getElementById('ph-toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 2400);
}

/* ══════════════════════════════════════════════════════════════
   17. Cleanup — called by WM on window close
   ══════════════════════════════════════════════════════════════ */
function cleanup() {
  revokeAllBlobs();
  _lazyObs?.disconnect();
  _lazyObs = null;
  if (_kbHandler) { document.removeEventListener('keydown', _kbHandler); _kbHandler = null; }
  clearTimeout(_renderTimer);
  _renderTimer = null;
  _currentImgs = [];
  _idbMeta     = [];
  _lbIdx = -1;
  _lbSrc = '';
  /* KOSFS connection intentionally kept — it is a process-level singleton */
}

/* ══════════════════════════════════════════════════════════════
   18. Utilities
   ══════════════════════════════════════════════════════════════ */
function _fmtBytes(n) {
  if (n < 1024)        return `${n} B`;
  if (n < 1_048_576)   return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1_048_576).toFixed(2)} MB`;
}

function _fmtDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

/** Minimal HTML entity escaping for untrusted strings in innerHTML. */
function _esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ══════════════════════════════════════════════════════════════
   apps/photos.js — SECTION 19 REPLACEMENT
   
   Replace everything from "Legacy global shims" (section 19)
   to the end of the file with the content below.
   
   What was removed:
     window.openLightbox    — no other file calls this
     window.setGalleryTab   — no other file calls this
     window.galleryDelete   — no other file calls this
     window.phTriggerUpload — no other file calls this
     window.phSetAlbum      — no other file calls this
     window.phSetView       — no other file calls this
     window.phDeleteCell    — no other file calls this
   
   All seven were legacy exports from an older API revision.
   The current app uses internal module functions directly.
   ══════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════
   20. WM registration  (keep this — it's the only thing needed)
   ══════════════════════════════════════════════════════════════ */
if (typeof WM !== 'undefined') {
  WM.setOnOpen('gallery',    () => window.KOSApps.gallery.init());
  WM.setOnClose?.('gallery', cleanup);
}
/* ══════════════════════════════════════════════════════════════
   20. WM registration
   ══════════════════════════════════════════════════════════════ */
if (typeof WM !== 'undefined') {
  WM.setOnOpen('gallery',    () => window.KOSApps.gallery.init());
  WM.setOnClose?.('gallery', cleanup);
}
