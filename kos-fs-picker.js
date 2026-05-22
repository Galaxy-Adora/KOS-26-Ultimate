/*!
 * kos-fs-picker.js — KOSFS Shared File Picker Component
 * =======================================================
 * KOS Ultimate 2026 — Target: Alpha 9+
 *
 * A kernel-level UI overlay that any app can use to let the user
 * pick files from the KOS Filesystem, or upload new files directly.
 * Respects each app's registered KOSFS permissions — apps only see
 * the file types they're allowed to access.
 *
 * LOAD ORDER  (in index.html, directly after kos-fs.js)
 * ──────────────────────────────────────────────────────
 *   <script defer src="kos-fs.js"></script>
 *   <script defer src="kos-fs-picker.js"></script>
 *
 * API
 * ───
 *   // Open the picker and wait for the user to select or cancel
 *   const result = await KOSFS.Picker.open({
 *     appId    : 'gallery',           // required — your app ID
 *     types    : ['image'],           // optional — restrict visible types
 *     multiple : false,               // optional — allow multi-select
 *     title    : 'Pick a photo',      // optional — overlay title
 *     allowUpload : true,             // optional — show "Upload" tab (default true)
 *   });
 *
 *   if (result === null) {
 *     // User cancelled
 *   } else if (Array.isArray(result)) {
 *     // multiple: true — result is an array of metadata objects
 *     for (const meta of result) { … }
 *   } else {
 *     // multiple: false — result is a single metadata object
 *     const { id, name, type, mimeType, size, createdAt } = result;
 *     const blob = await KOSFS.readBlob('gallery', id);
 *   }
 *
 * © 2024–2026 Kalapurackal Studios. All rights reserved.
 */

'use strict';

window.KOSFS = window.KOSFS || {};

KOSFS.Picker = (() => {

  /* ═══════════════════════════════════════════════════════════
     §1  CSS INJECTION
     Injected once on first call. Scoped to .kosfs-picker-*.
  ═══════════════════════════════════════════════════════════ */

  const STYLE_ID = 'kos-fs-picker-style';

  function _injectCSS() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
/* ── Overlay ──────────────────────────────────────────── */
.kosfs-picker-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  z-index: 19000;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: kpFadeIn 0.18s ease;
}

/* ── Modal shell ──────────────────────────────────────── */
.kosfs-picker-modal {
  background: rgba(4, 18, 38, 0.92);
  border: 1px solid rgba(0, 212, 255, 0.18);
  border-radius: 18px;
  box-shadow: 0 32px 80px rgba(0, 0, 0, 0.6),
              0 0 0 1px rgba(255,255,255,0.04) inset;
  width: min(720px, 92vw);
  max-height: 78vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: kpSlideUp 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* ── Header ───────────────────────────────────────────── */
.kosfs-picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 0;
  flex-shrink: 0;
}
.kosfs-picker-title {
  font-family: 'Rajdhani', sans-serif;
  font-size: 17px;
  font-weight: 600;
  color: rgba(215, 240, 255, 0.95);
  letter-spacing: 0.02em;
}
.kosfs-picker-close {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.07);
  color: rgba(215, 240, 255, 0.7);
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, color 0.15s;
}
.kosfs-picker-close:hover {
  background: rgba(255, 60, 60, 0.25);
  color: #fff;
}

/* ── Tabs ─────────────────────────────────────────────── */
.kosfs-picker-tabs {
  display: flex;
  gap: 4px;
  padding: 12px 20px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}
.kosfs-picker-tab {
  padding: 7px 14px;
  border-radius: 8px 8px 0 0;
  border: none;
  background: transparent;
  color: rgba(130, 185, 215, 0.55);
  font-family: 'Rajdhani', sans-serif;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
  position: relative;
  bottom: -1px;
}
.kosfs-picker-tab:hover { color: rgba(215, 240, 255, 0.75); }
.kosfs-picker-tab.active {
  color: rgba(215, 240, 255, 0.95);
  background: rgba(0, 99, 175, 0.18);
  border: 1px solid rgba(0, 212, 255, 0.18);
  border-bottom-color: rgba(4, 18, 38, 0.92);
}

/* ── Toolbar (search + type filter) ──────────────────── */
.kosfs-picker-toolbar {
  display: flex;
  gap: 8px;
  padding: 12px 20px;
  flex-shrink: 0;
}
.kosfs-picker-search {
  flex: 1;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 7px 12px;
  color: rgba(215, 240, 255, 0.9);
  font-family: 'Rajdhani', sans-serif;
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
}
.kosfs-picker-search::placeholder { color: rgba(130, 185, 215, 0.4); }
.kosfs-picker-search:focus { border-color: rgba(0, 212, 255, 0.4); }

.kosfs-picker-type-filter {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 7px 10px;
  color: rgba(215, 240, 255, 0.9);
  font-family: 'Rajdhani', sans-serif;
  font-size: 13px;
  outline: none;
  cursor: pointer;
}

/* ── File grid ────────────────────────────────────────── */
.kosfs-picker-grid {
  flex: 1;
  overflow-y: auto;
  padding: 0 20px 12px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 8px;
  align-content: start;
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 212, 255, 0.2) transparent;
}

/* ── File card ────────────────────────────────────────── */
.kosfs-picker-card {
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  border: 1.5px solid transparent;
  cursor: pointer;
  transition: background 0.14s, border-color 0.14s, transform 0.1s;
  overflow: hidden;
  position: relative;
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
}
.kosfs-picker-card:hover {
  background: rgba(0, 99, 175, 0.15);
  border-color: rgba(0, 212, 255, 0.2);
}
.kosfs-picker-card.selected {
  border-color: #00d4ff;
  background: rgba(0, 212, 255, 0.1);
  box-shadow: 0 0 0 2px rgba(0, 212, 255, 0.3);
}
.kosfs-picker-card-thumb {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: rgba(255,255,255,0.02);
}
.kosfs-picker-card-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.kosfs-picker-card-thumb .kosfs-picker-type-icon {
  font-size: 28px;
  color: rgba(0, 212, 255, 0.5);
}
.kosfs-picker-card-label {
  padding: 4px 6px;
  font-family: 'Rajdhani', sans-serif;
  font-size: 11px;
  color: rgba(215, 240, 255, 0.6);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  background: rgba(0,0,0,0.3);
}
.kosfs-picker-card-check {
  position: absolute;
  top: 5px;
  right: 5px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #00d4ff;
  color: #000;
  font-size: 10px;
  display: none;
  align-items: center;
  justify-content: center;
}
.kosfs-picker-card.selected .kosfs-picker-card-check { display: flex; }

/* ── Empty + Loading states ───────────────────────────── */
.kosfs-picker-empty {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 40px 20px;
  color: rgba(130, 185, 215, 0.4);
  font-family: 'Rajdhani', sans-serif;
  font-size: 14px;
  text-align: center;
}
.kosfs-picker-empty i { font-size: 36px; opacity: 0.4; }

/* ── Upload tab ───────────────────────────────────────── */
.kosfs-picker-upload-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 30px 20px;
  margin: 0 20px 12px;
  border: 2px dashed rgba(0, 212, 255, 0.2);
  border-radius: 14px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  color: rgba(130, 185, 215, 0.6);
  font-family: 'Rajdhani', sans-serif;
  text-align: center;
}
.kosfs-picker-upload-area:hover,
.kosfs-picker-upload-area.drag-over {
  border-color: rgba(0, 212, 255, 0.5);
  background: rgba(0, 212, 255, 0.04);
  color: rgba(215, 240, 255, 0.8);
}
.kosfs-picker-upload-area i { font-size: 40px; opacity: 0.5; }
.kosfs-picker-upload-area span { font-size: 14px; line-height: 1.5; }
.kosfs-picker-upload-area strong { color: #00d4ff; }
.kosfs-picker-upload-progress {
  width: 100%;
  max-width: 280px;
  height: 4px;
  background: rgba(255,255,255,0.08);
  border-radius: 2px;
  overflow: hidden;
  display: none;
}
.kosfs-picker-upload-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #0063af, #00d4ff);
  border-radius: 2px;
  width: 0%;
  transition: width 0.3s ease;
}

/* ── Footer ───────────────────────────────────────────── */
.kosfs-picker-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}
.kosfs-picker-count {
  font-family: 'Rajdhani', sans-serif;
  font-size: 12px;
  color: rgba(130, 185, 215, 0.5);
}
.kosfs-picker-actions { display: flex; gap: 8px; }
.kosfs-picker-btn {
  padding: 7px 18px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  font-family: 'Rajdhani', sans-serif;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.kosfs-picker-btn-cancel {
  background: rgba(255,255,255,0.04);
  color: rgba(215, 240, 255, 0.7);
}
.kosfs-picker-btn-cancel:hover { background: rgba(255,255,255,0.08); }
.kosfs-picker-btn-confirm {
  background: linear-gradient(135deg, #0063af, #0094d4);
  color: #fff;
  border-color: transparent;
}
.kosfs-picker-btn-confirm:hover { background: linear-gradient(135deg, #0075cc, #00b4f0); }
.kosfs-picker-btn-confirm:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

/* ── Animations ───────────────────────────────────────── */
@keyframes kpFadeIn  { from { opacity: 0 } to { opacity: 1 } }
@keyframes kpSlideUp { from { transform: translateY(20px); opacity: 0 } to { transform: none; opacity: 1 } }
`;
    document.head.appendChild(style);
  }

  /* ═══════════════════════════════════════════════════════════
     §2  INTERNAL STATE
  ═══════════════════════════════════════════════════════════ */

  let _overlayEl  = null;
  let _resolveFn  = null;
  let _opts       = {};       // current open() options
  let _selected   = new Set(); // set of file id numbers
  let _allFiles   = [];       // current list of metadata from KOSFS.list()
  let _activeTab  = 'browse'; // 'browse' | 'upload'
  let _filterType = '';
  let _searchTerm = '';

  /* ═══════════════════════════════════════════════════════════
     §3  DOM HELPERS
  ═══════════════════════════════════════════════════════════ */

  function _el(tag, cls, attrs = {}) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    Object.assign(e, attrs);
    return e;
  }

  function _icon(faClass) {
    const i = document.createElement('i');
    i.className = `fas ${faClass}`;
    return i;
  }

  /* ═══════════════════════════════════════════════════════════
     §4  GRID RENDERING
  ═══════════════════════════════════════════════════════════ */

  function _buildCard(meta) {
    const card = _el('div', 'kosfs-picker-card');
    card.dataset.id = meta.id;

    const thumb = _el('div', 'kosfs-picker-card-thumb');
    card.appendChild(thumb);

    if (meta.type === KOSFS.TYPES.IMAGE) {
      // Lazy-load image
      const img = _el('img');
      img.alt = meta.name;
      img.loading = 'lazy';
      // Load async to avoid blocking render
      KOSFS.readObjectURL(_opts.appId, meta.id)
        .then(url => {
          img.src = url;
          // Store url on card element for cleanup later
          if (!card._objectURLs) card._objectURLs = [];
          card._objectURLs.push(url);
        })
        .catch(() => {
          thumb.appendChild(_icon(KOSFS.typeIcon(meta.type)));
        });
      thumb.appendChild(img);
    } else {
      thumb.appendChild(_icon(KOSFS.typeIcon(meta.type)));
    }

    const label = _el('div', 'kosfs-picker-card-label', { textContent: meta.name });
    card.appendChild(label);

    const check = _el('div', 'kosfs-picker-card-check');
    check.appendChild(_icon('fa-check'));
    card.appendChild(check);

    if (_selected.has(meta.id)) card.classList.add('selected');

    card.addEventListener('click', () => _toggleSelect(meta.id, card));

    return card;
  }

  function _renderGrid() {
    const grid = _overlayEl.querySelector('.kosfs-picker-grid');
    if (!grid) return;

    // Revoke any previous object URLs to avoid leaks
    grid.querySelectorAll('.kosfs-picker-card').forEach(c => {
      if (c._objectURLs) c._objectURLs.forEach(u => URL.revokeObjectURL(u));
    });
    grid.innerHTML = '';

    let files = _allFiles;

    // Apply type filter
    if (_filterType) {
      files = files.filter(f => f.type === _filterType);
    }

    // Apply search
    if (_searchTerm) {
      const q = _searchTerm.toLowerCase();
      files = files.filter(f => f.name?.toLowerCase().includes(q));
    }

    if (files.length === 0) {
      const empty = _el('div', 'kosfs-picker-empty');
      empty.appendChild(_icon('fa-folder-open'));
      const msg = _el('span', null, {
        textContent: _allFiles.length === 0
          ? 'No files stored yet. Upload something first.'
          : 'No files match your filter.',
      });
      empty.appendChild(msg);
      grid.appendChild(empty);
    } else {
      const frag = document.createDocumentFragment();
      files.forEach(meta => frag.appendChild(_buildCard(meta)));
      grid.appendChild(frag);
    }

    _updateFooter();
  }

  function _toggleSelect(id, card) {
    if (_opts.multiple) {
      if (_selected.has(id)) {
        _selected.delete(id);
        card.classList.remove('selected');
      } else {
        _selected.add(id);
        card.classList.add('selected');
      }
    } else {
      // Single select — deselect all, select this
      _overlayEl.querySelectorAll('.kosfs-picker-card.selected').forEach(c => {
        c.classList.remove('selected');
      });
      if (_selected.has(id)) {
        _selected.clear();
      } else {
        _selected.clear();
        _selected.add(id);
        card.classList.add('selected');
      }
    }
    _updateFooter();
  }

  function _updateFooter() {
    const confirmBtn = _overlayEl.querySelector('.kosfs-picker-btn-confirm');
    const countEl    = _overlayEl.querySelector('.kosfs-picker-count');
    if (!confirmBtn || !countEl) return;

    confirmBtn.disabled = _selected.size === 0;

    if (_selected.size === 0) {
      countEl.textContent = `${_allFiles.length} file${_allFiles.length !== 1 ? 's' : ''}`;
    } else if (_opts.multiple) {
      countEl.textContent = `${_selected.size} selected`;
    } else {
      const id   = [..._selected][0];
      const meta = _allFiles.find(f => f.id === id);
      countEl.textContent = meta
        ? `${meta.name} · ${KOSFS.formatSize(meta.size ?? 0)}`
        : '1 selected';
    }
  }

  /* ═══════════════════════════════════════════════════════════
     §5  TABS
  ═══════════════════════════════════════════════════════════ */

  function _switchTab(tab) {
    _activeTab = tab;
    const browsePane = _overlayEl.querySelector('.kosfs-picker-browse-pane');
    const uploadPane = _overlayEl.querySelector('.kosfs-picker-upload-pane');
    const tabs       = _overlayEl.querySelectorAll('.kosfs-picker-tab');

    if (tab === 'browse') {
      browsePane.style.display = 'contents';
      uploadPane.style.display = 'none';
    } else {
      browsePane.style.display = 'none';
      uploadPane.style.display = 'flex';
    }

    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  }

  /* ═══════════════════════════════════════════════════════════
     §6  UPLOAD TAB LOGIC
  ═══════════════════════════════════════════════════════════ */

  function _buildUploadPane() {
    const pane = _el('div', 'kosfs-picker-upload-pane');
    pane.style.cssText = 'display:none; flex-direction:column; align-items:center; justify-content:center; flex:1;';

    const area = _el('div', 'kosfs-picker-upload-area');
    area.appendChild(_icon('fa-cloud-upload-alt'));

    const text = _el('span');
    text.innerHTML = 'Drag & drop files here, or <strong>click to browse</strong>';
    area.appendChild(text);

    const sub = _el('span', null, { textContent: 'Files are stored in the KOS Filesystem and shared across all apps.' });
    sub.style.cssText = 'font-size:11px; opacity:0.6;';
    area.appendChild(sub);

    const progressWrap = _el('div', 'kosfs-picker-upload-progress');
    const progressBar  = _el('div', 'kosfs-picker-upload-progress-bar');
    progressWrap.appendChild(progressBar);
    area.appendChild(progressWrap);

    // Hidden file input
    const input = _el('input');
    input.type = 'file';
    input.multiple = true;
    input.style.display = 'none';
    area.appendChild(input);

    // Determine accepted MIME types from filter
    const acceptedTypes = (_opts.types ?? []).flatMap(t => ({
      image    : ['image/*'],
      video    : ['video/*'],
      audio    : ['audio/*'],
      document : ['text/*', 'application/pdf', 'application/msword'],
    }[t] ?? []));
    if (acceptedTypes.length) input.accept = acceptedTypes.join(',');

    area.addEventListener('click', () => input.click());

    area.addEventListener('dragover', e => {
      e.preventDefault();
      area.classList.add('drag-over');
    });
    area.addEventListener('dragleave', () => area.classList.remove('drag-over'));
    area.addEventListener('drop', e => {
      e.preventDefault();
      area.classList.remove('drag-over');
      _handleUpload([...e.dataTransfer.files], progressWrap, progressBar);
    });

    input.addEventListener('change', () => {
      _handleUpload([...input.files], progressWrap, progressBar);
      input.value = '';
    });

    pane.appendChild(area);
    return pane;
  }

  async function _handleUpload(files, progressWrap, progressBar) {
    if (!files.length) return;
    progressWrap.style.display = 'block';

    let done = 0;
    const ids = [];

    for (const file of files) {
      try {
        const id = await KOSFS.write(_opts.appId, file);
        ids.push(id);
        done++;
        progressBar.style.width = `${(done / files.length) * 100}%`;
      } catch (err) {
        console.error('[KOSFS Picker] Upload error:', err.message);
        showToast?.(`Upload failed: ${err.message}`, 'error');
      }
    }

    progressWrap.style.display = 'none';
    progressBar.style.width = '0%';

    if (ids.length) {
      showToast?.(`${ids.length} file${ids.length > 1 ? 's' : ''} uploaded`);
      // Refresh the browse tab's file list
      await _refreshFiles();
      _switchTab('browse');
    }
  }

  /* ═══════════════════════════════════════════════════════════
     §7  FILE LIST REFRESH
  ═══════════════════════════════════════════════════════════ */

  async function _refreshFiles() {
    const filter = { limit: 500 };
    if (_opts.types?.length === 1) filter.type = _opts.types[0];
    try {
      _allFiles = await KOSFS.list(_opts.appId, filter);
    } catch (err) {
      _allFiles = [];
      console.error('[KOSFS Picker] list() failed:', err.message);
    }
    _renderGrid();
  }

  /* ═══════════════════════════════════════════════════════════
     §8  OVERLAY BUILD
  ═══════════════════════════════════════════════════════════ */

  function _build(opts) {
    _injectCSS();

    const overlay = _el('div', 'kosfs-picker-overlay');

    /* ── Modal ── */
    const modal = _el('div', 'kosfs-picker-modal');

    /* ── Header ── */
    const header = _el('div', 'kosfs-picker-header');
    const title  = _el('div', 'kosfs-picker-title', {
      textContent: opts.title ?? 'Open File',
    });
    const closeBtn = _el('button', 'kosfs-picker-close');
    closeBtn.appendChild(_icon('fa-times'));
    closeBtn.addEventListener('click', () => _cancel());
    header.appendChild(title);
    header.appendChild(closeBtn);
    modal.appendChild(header);

    /* ── Tabs ── */
    if (opts.allowUpload !== false) {
      const tabBar    = _el('div', 'kosfs-picker-tabs');
      const tabBrowse = _el('button', 'kosfs-picker-tab active', { textContent: 'Browse' });
      tabBrowse.dataset.tab = 'browse';
      const tabUpload = _el('button', 'kosfs-picker-tab', { textContent: 'Upload' });
      tabUpload.dataset.tab = 'upload';
      tabBrowse.addEventListener('click', () => _switchTab('browse'));
      tabUpload.addEventListener('click', () => _switchTab('upload'));
      tabBar.appendChild(tabBrowse);
      tabBar.appendChild(tabUpload);
      modal.appendChild(tabBar);
    }

    /* ── Browse pane wrapper ── */
    const browsePane = _el('div', 'kosfs-picker-browse-pane');
    browsePane.style.cssText = 'display: contents;';

    /* Toolbar */
    const toolbar = _el('div', 'kosfs-picker-toolbar');

    const search = _el('input', 'kosfs-picker-search');
    search.type = 'text';
    search.placeholder = 'Search files…';
    search.addEventListener('input', e => {
      _searchTerm = e.target.value.trim();
      _renderGrid();
    });
    toolbar.appendChild(search);

    // Type filter dropdown — only if the picker allows multiple types
    const allowedTypes = opts.types ?? Object.values(KOSFS.TYPES);
    if (allowedTypes.length > 1) {
      const typeSelect = _el('select', 'kosfs-picker-type-filter');
      const allOpt = new Option('All types', '');
      typeSelect.appendChild(allOpt);
      allowedTypes.forEach(t => {
        const opt = new Option(t.charAt(0).toUpperCase() + t.slice(1) + 's', t);
        typeSelect.appendChild(opt);
      });
      typeSelect.addEventListener('change', e => {
        _filterType = e.target.value;
        _renderGrid();
      });
      toolbar.appendChild(typeSelect);
    }

    browsePane.appendChild(toolbar);

    /* Grid */
    const grid = _el('div', 'kosfs-picker-grid');
    browsePane.appendChild(grid);

    modal.appendChild(browsePane);

    /* ── Upload pane ── */
    if (opts.allowUpload !== false) {
      modal.appendChild(_buildUploadPane());
    }

    /* ── Footer ── */
    const footer  = _el('div', 'kosfs-picker-footer');
    const countEl = _el('div', 'kosfs-picker-count', { textContent: 'Loading…' });
    footer.appendChild(countEl);

    const actions    = _el('div', 'kosfs-picker-actions');
    const cancelBtn  = _el('button', 'kosfs-picker-btn kosfs-picker-btn-cancel', {
      textContent: 'Cancel',
    });
    cancelBtn.addEventListener('click', () => _cancel());
    actions.appendChild(cancelBtn);

    const confirmBtn = _el('button', 'kosfs-picker-btn kosfs-picker-btn-confirm', {
      textContent: opts.multiple ? 'Select Files' : 'Open',
      disabled   : true,
    });
    confirmBtn.addEventListener('click', () => _confirm());
    actions.appendChild(confirmBtn);

    footer.appendChild(actions);
    modal.appendChild(footer);

    overlay.appendChild(modal);

    // Dismiss on backdrop click
    overlay.addEventListener('click', e => {
      if (e.target === overlay) _cancel();
    });

    // Keyboard support
    document.addEventListener('keydown', _onKeyDown);

    return overlay;
  }

  /* ═══════════════════════════════════════════════════════════
     §9  KEYBOARD HANDLER
  ═══════════════════════════════════════════════════════════ */

  function _onKeyDown(e) {
    if (!_overlayEl) return;
    if (e.key === 'Escape') { e.preventDefault(); _cancel(); }
    if (e.key === 'Enter' && _selected.size > 0) { e.preventDefault(); _confirm(); }
  }

  /* ═══════════════════════════════════════════════════════════
     §10  RESOLVE / REJECT
  ═══════════════════════════════════════════════════════════ */

  function _cancel() {
    _cleanup();
    if (_resolveFn) _resolveFn(null);
    _resolveFn = null;
  }

  function _confirm() {
    const selectedMeta = _allFiles.filter(f => _selected.has(f.id));
    _cleanup();
    if (_resolveFn) {
      _resolveFn(_opts.multiple ? selectedMeta : selectedMeta[0] ?? null);
    }
    _resolveFn = null;
  }

  function _cleanup() {
    document.removeEventListener('keydown', _onKeyDown);
    if (_overlayEl) {
      // Revoke any open object URLs before removing DOM
      _overlayEl.querySelectorAll('.kosfs-picker-card').forEach(c => {
        if (c._objectURLs) c._objectURLs.forEach(u => URL.revokeObjectURL(u));
      });
      _overlayEl.remove();
      _overlayEl = null;
    }
    _selected.clear();
    _allFiles   = [];
    _filterType = '';
    _searchTerm = '';
  }

  /* ═══════════════════════════════════════════════════════════
     §11  PUBLIC  open()
  ═══════════════════════════════════════════════════════════ */

  /**
   * Open the file picker and wait for the user's selection.
   *
   * @param {object}   opts
   * @param {string}   opts.appId        - Calling app ID (must be KOSFS.registerApp'd)
   * @param {string[]} [opts.types]      - Restrict to these KOSFS.TYPES values
   * @param {boolean}  [opts.multiple]   - Allow multi-select (default false)
   * @param {string}   [opts.title]      - Picker title (default 'Open File')
   * @param {boolean}  [opts.allowUpload]- Show Upload tab (default true)
   *
   * @returns {Promise<object|object[]|null>}
   *   null if cancelled,
   *   single metadata object if multiple=false,
   *   array of metadata objects if multiple=true
   */
  function open(opts = {}) {
    if (!opts.appId) throw new Error('[KOSFS.Picker] opts.appId is required');
    if (_overlayEl)  throw new Error('[KOSFS.Picker] Picker is already open');

    _opts     = opts;
    _selected = new Set();

    return new Promise(async resolve => {
      _resolveFn = resolve;

      _overlayEl = _build(opts);
      document.body.appendChild(_overlayEl);

      // Load files asynchronously
      await _refreshFiles();
    });
  }

  /* ═══════════════════════════════════════════════════════════
     §12  PUBLIC SURFACE
  ═══════════════════════════════════════════════════════════ */

  return Object.freeze({ open });

})();
