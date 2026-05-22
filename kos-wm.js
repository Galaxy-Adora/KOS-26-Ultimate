/* ══════════════════════════════════════════════════════════════
   KOS ULTIMATE 2026 — kos-wm.js
   Window Manager — decoupled from Dock and Spotlight.
   Reads AppManifest for app metadata.
   Communicates outward ONLY via KOSBus events.

   ADDING A WINDOW FEATURE: only edit this file.
   ══════════════════════════════════════════════════════════════ */

const WM = {
  registry: {},       // id → { el, open, minimized, maximized, savedRect }
  zTop: 500,
  TOPBAR_H: 54,
  MIN_W: 300,
  MIN_H: 200,
  _loadedAssets: {},  // id → true  (tracks injected CSS/JS)
  _focusedId:    null,  // track current focused window to avoid full loop
  _saveTimer:    null,  // debounce handle for saveSession

  /* ─────────────────────────────────────────────────────────────
     saveSession debounced — localStorage.setItem + JSON.stringify
     is synchronous and blocks the main thread. Debouncing to 400 ms
     means rapid actions (drag, quick-open) only write once.
     ───────────────────────────────────────────────────────────── */
  _scheduleSave() {
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this.saveSession(), 400);
  },

  /* ─────────────────────────────────────────────────────────────
     PUBLIC API
     ───────────────────────────────────────────────────────────── */

  /**
   * Launch an app by id.
   * If its window exists → open/restore/focus.
   * If no window → bounce icon + toast.
   * CSS/JS are injected on first launch.
   */
  launch(id) {
    const app = AppManifest.find(a => a.id === id);
    if (!app) return;

    // Close spotlight if open (no import needed — uses event)
    KOSBus.dispatch('kos:request-spotlight-close');

    const w = this.registry[id];

    if (w) {
      if (!w.open)      this.open(id);
      else if (w.minimized) this.restore(id);
      else              this.focus(id);
      return;
    }

    /* No window — no initData → coming-soon bounce */
    if (!app.initData) {
      showToast(`${app.name} — coming soon`);
      const dockIcon = document.querySelector(`.dock-item[data-app-id="${id}"] .app-icon`);
      if (dockIcon) {
        dockIcon.style.animation = 'bounce 0.5s var(--ease-spring)';
        setTimeout(() => dockIcon.style.animation = '', 500);
      }
      return;
    }

    /* First launch: inject CSS, then build window and open */
    this._injectAssets(app, () => {
      const desktop = document.getElementById('screen-desktop');
      const el = this._buildWindowDOM(app);
      desktop.appendChild(el);
      this.register(app);
      this.open(id);
    });
  },

  open(id) {
    const w = this.registry[id];
    if (!w) return;
    w.el.classList.add('win-open');
    w.el.classList.remove('win-minimized');
    w.open = true; w.minimized = false;
    this.focus(id);
    /* Call the app's onOpen lifecycle hook if registered */
    if (w.onOpen) w.onOpen();
    applySysOverride(id);
    this._syncDockHide();
    this._scheduleSave();
    KOSBus.dispatch('kos:app-opened', { appId: id });
  },

  close(id) {
    const w = this.registry[id];
    if (!w) return;
    /* Clear topbar controls if this was the maximized window */
    if (w.maximized) this._clearTopbarControls();
    /* Clear snap topbar controls if this was a snapped window */
    if (w.snapped) this._clearSnapControls(id);
    w.el.classList.remove('win-open', 'win-minimized', 'win-maximized',
                          'win-snapped-left', 'win-snapped-right');
    w.open = false; w.minimized = false; w.maximized = false; w.snapped = null;
    /* Reset maximize icon */
    const maxBtn = w.el.querySelector('.win-ctrl-btn[data-action="maximize"] i');
    if (maxBtn) maxBtn.className = 'fa-solid fa-window-maximize';
    this._syncDockHide();
    this._scheduleSave();
    KOSBus.dispatch('kos:app-closed', { appId: id });
  },

  minimize(id) {
    const w = this.registry[id];
    if (!w || !w.open) return;
    /* If maximized, clear topbar controls but keep maximized state
       so the window restores to maximized when brought back */
    if (w.maximized) {
      this._clearTopbarControls();
    }
    /* If snapped, hide snap topbar controls (keep w.snapped so restore re-injects) */
    if (w.snapped) {
      this._clearSnapControls(id);
    }
    w.el.classList.add('win-minimized');
    w.minimized = true;
    this._syncDockHide();
    this._scheduleSave();
    KOSBus.dispatch('kos:app-minimized', { appId: id });
  },

  restore(id) {
    const w = this.registry[id];
    if (!w) return;
    w.el.classList.remove('win-minimized');
    w.minimized = false;
    /* Re-inject topbar controls if restoring a maximized window */
    if (w.maximized) {
      this._injectTopbarControls(id);
    }
    /* Re-inject snap topbar controls if restoring a snapped window */
    if (w.snapped) {
      this._injectSnapControls(id, w.snapped);
    }
    this.focus(id);
    this._syncDockHide();
    this._scheduleSave();
    KOSBus.dispatch('kos:app-restored', { appId: id });
  },

  maximize(id) {
    const w = this.registry[id];
    if (!w) return;
    const maxBtn = w.el.querySelector('.win-ctrl-btn[data-action="maximize"] i');

    if (w.maximized) {
      /* ── UN-MAXIMIZE ── */
      /* 1. Fade the topbar controls out first, then snap geometry */
      this._clearTopbarControls();

      /* Small delay so controls fade before titlebar re-expands */
      setTimeout(() => {
        w.el.classList.add('win-animating');
        w.el.classList.remove('win-maximized');
        w.maximized = false;

        if (w.savedRect) {
          const r = w.savedRect;
          Object.assign(w.el.style, {
            left: r.left, top: r.top, width: r.width, height: r.height,
          });
        }

        if (maxBtn) maxBtn.className = 'fa-solid fa-window-maximize';

        setTimeout(() => w.el.classList.remove('win-animating'), 480);
      }, 120);

    } else {
      /* ── MAXIMIZE ── */
      w.savedRect = {
        left: w.el.style.left, top: w.el.style.top,
        width: w.el.style.width, height: w.el.style.height,
      };

      w.el.classList.add('win-animating', 'win-maximized');
      w.maximized = true;

      /* 52 = maximized topbar height (top:0 + height:52px) — must match CSS */
      const MAX_TOPBAR_H = 44;
      Object.assign(w.el.style, {
        left: '0', top: MAX_TOPBAR_H + 'px',
        width: '100vw', height: `calc(100vh - ${MAX_TOPBAR_H}px)`,
      });

      if (maxBtn) maxBtn.className = 'fa-solid fa-window-restore';
      document.querySelector('.topbar')?.classList.add('topbar-maximized');

      /* Inject floating topbar controls slightly after geometry starts */
      setTimeout(() => this._injectTopbarControls(id), 80);
      setTimeout(() => w.el.classList.remove('win-animating'), 480);
    }

    this._scheduleSave();
  },

  focus(id) {
    const w = this.registry[id];
    if (!w) return;
    this.zTop++;
    w.el.style.zIndex = this.zTop;
    /* Only remove focus class from the PREVIOUS focused window — not all windows.
       This is O(1) instead of O(n) and avoids touching every window's DOM on click. */
    if (this._focusedId && this._focusedId !== id) {
      const prev = this.registry[this._focusedId];
      if (prev) prev.el.classList.remove('win-focused');
    }
    this._focusedId = id;
    w.el.classList.add('win-focused');
    KOSBus.dispatch('kos:app-focused', { appId: id });
  },

  /* ─── Session ─── */
  saveSession() {
    const state = {};
    Object.entries(this.registry).forEach(([id, w]) => {
      state[id] = {
        open: w.open, minimized: w.minimized, maximized: w.maximized,
        snapped: w.snapped,
        left: w.el.style.left, top: w.el.style.top,
        width: w.el.style.width, height: w.el.style.height,
      };
    });
    localStorage.setItem(KEY_SESSION, JSON.stringify(state));
  },

  restoreSession() {
    let raw;
    try { raw = JSON.parse(localStorage.getItem(KEY_SESSION)); } catch { return; }
    if (!raw) return;
    Object.entries(raw).forEach(([id, s]) => {
      const app = AppManifest.find(a => a.id === id);
      if (!app || !app.initData) return;
      /* Ensure window exists */
      if (!this.registry[id]) {
        const desktop = document.getElementById('screen-desktop');
        const el = this._buildWindowDOM(app);
        desktop.appendChild(el);
        this._injectAssets(app, () => {});
        this.register(app);
      }
      const w = this.registry[id];
      if (!w) return;
      if (s.left)   w.el.style.left   = s.left;
      if (s.top)    w.el.style.top    = s.top;
      if (s.width)  w.el.style.width  = s.width;
      if (s.height) w.el.style.height = s.height;
      if (s.open) {
        this.open(id);
        if (s.minimized) this.minimize(id);
        if (s.maximized) this.maximize(id);
      }
    });
  },

  clearSession() { localStorage.removeItem(KEY_SESSION); },

  /* ─────────────────────────────────────────────────────────────
     INTERNAL — TOPBAR CONTROLS
     When a window is maximised, its own titlebar collapses and
     floating controls are injected into the topbar area.
     These stay in the window's DOM subtree via JS reference but
     live at body level (bypassing transform stacking context).
     ───────────────────────────────────────────────────────────── */
  _injectTopbarControls(id) {
    const app   = AppManifest.find(a => a.id === id);
    const label = app ? (app.initData?.title || app.name) : id;

    /* ── Animate system-name swap ── */
    const sysName = document.querySelector('.system-name');
    if (sysName && !sysName.dataset.kosOriginal) {
      sysName.dataset.kosOriginal = sysName.textContent;
      sysName.classList.add('sysname-fading');
      setTimeout(() => {
        sysName.textContent = label;
        sysName.classList.remove('sysname-fading');
      }, 180);
    }

    /* ── Build or reuse the floating controls panel ── */
    let ctrl = document.getElementById('topbar-win-controls');
    if (!ctrl) {
      ctrl = document.createElement('div');
      ctrl.id = 'topbar-win-controls';
      document.body.appendChild(ctrl);
    }
    ctrl.dataset.winId = id;

    ctrl.innerHTML = `
      <button class="win-ctrl-btn twc-btn" data-action="minimize" title="Minimize">
        <i class="fa-solid fa-minus"></i>
      </button>
      <button class="win-ctrl-btn twc-btn" data-action="maximize" title="Restore">
        <i class="fa-solid fa-window-restore"></i>
      </button>
      <button class="win-ctrl-btn twc-btn" data-action="close" title="Close">
        <i class="fa-solid fa-xmark"></i>
      </button>`;

    ctrl.querySelectorAll('.twc-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const wId   = document.getElementById('topbar-win-controls')?.dataset.winId;
        const action = btn.dataset.action;
        if (!wId) return;
        if (action === 'close')    this.close(wId);
        if (action === 'minimize') this.minimize(wId);
        if (action === 'maximize') this.maximize(wId);
      });
    });

    /* Trigger entrance animation on next frame */
    requestAnimationFrame(() => {
      requestAnimationFrame(() => ctrl.classList.add('twc-visible'));
    });
  },

  _clearTopbarControls() {
    /* ── Restore system-name ── */
    const sysName = document.querySelector('.system-name');
    if (sysName?.dataset.kosOriginal) {
      const orig = sysName.dataset.kosOriginal;
      delete sysName.dataset.kosOriginal;
      sysName.classList.add('sysname-fading');
      setTimeout(() => {
        sysName.textContent = orig;
        sysName.classList.remove('sysname-fading');
      }, 180);
    }

    /* ── Always restore the topbar to its normal floating-pill state ──
       This must happen here (not only in maximize()) so that closing or
       minimizing while maximized also resets the topbar width. */
    document.querySelector('.topbar')?.classList.remove('topbar-maximized');

    /* ── Animate controls out then remove ── */
    const ctrl = document.getElementById('topbar-win-controls');
    if (ctrl) {
      ctrl.classList.remove('twc-visible');
      setTimeout(() => { ctrl.parentNode && ctrl.remove(); }, 350);
    }
  },

  /* ─────────────────────────────────────────────────────────────
     SNAP TOPBAR CONTROLS
     When a window is side-snapped, its titlebar collapses and
     floating controls appear in the topbar on the matching edge:
       left-snapped  window → controls at far-left  of topbar
       right-snapped window → controls at far-right of topbar
     ───────────────────────────────────────────────────────────── */
  _injectSnapControls(id, zone) {
    const panelId = zone === 'left' ? 'topbar-snap-left' : 'topbar-snap-right';

    let ctrl = document.getElementById(panelId);
    if (!ctrl) {
      ctrl = document.createElement('div');
      ctrl.id = panelId;
      document.body.appendChild(ctrl);
    }
    ctrl.dataset.winId = id;
    ctrl.dataset.zone  = zone;

    ctrl.innerHTML = `
      <button class="win-ctrl-btn twc-btn" data-action="minimize" title="Minimize">
        <i class="fa-solid fa-minus"></i>
      </button>
      <button class="win-ctrl-btn twc-btn" data-action="unsnap" title="Restore">
        <i class="fa-solid fa-window-restore"></i>
      </button>
      <button class="win-ctrl-btn twc-btn" data-action="close" title="Close">
        <i class="fa-solid fa-xmark"></i>
      </button>`;

    ctrl.querySelectorAll('.twc-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const wId    = ctrl.dataset.winId;
        const action = btn.dataset.action;
        if (!wId) return;
        if (action === 'close')    this.close(wId);
        if (action === 'minimize') this.minimize(wId);
        if (action === 'unsnap') {
          /* Restore to pre-snap floating geometry */
          this._clearSnapControls(wId);
          this._unsnapWindow(wId);
          this.focus(wId);
          this._scheduleSave();
        }
      });
    });

    /* Double-rAF trick for entrance animation (avoids forced reflow) */
    requestAnimationFrame(() => {
      requestAnimationFrame(() => ctrl.classList.add('snap-ctrl-visible'));
    });
  },

  _clearSnapControls(id) {
    const w = this.registry[id];
    if (!w?.snapped) return;
    const panelId = w.snapped === 'left' ? 'topbar-snap-left' : 'topbar-snap-right';
    const ctrl = document.getElementById(panelId);
    /* Guard: only remove if this panel belongs to the window being cleared */
    if (ctrl && ctrl.dataset.winId === id) {
      ctrl.classList.remove('snap-ctrl-visible');
      setTimeout(() => { ctrl.parentNode && ctrl.remove(); }, 320);
    }
  },

  /* ─────────────────────────────────────────────────────────────
     INTERNAL — ASSET INJECTION
     Injects app CSS (once) then calls callback.
     JS is already loaded via <script> tags in index.html
     for simplicity / cross-origin compatibility.
     ───────────────────────────────────────────────────────────── */
  _injectAssets(app, cb) {
    if (this._loadedAssets[app.id]) { cb(); return; }
    if (app.cssPath) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = app.cssPath;
      link.onload = () => { this._loadedAssets[app.id] = true; cb(); };
      link.onerror = () => {
        console.error(`[KOS WM] Module CSS not found: ${app.cssPath}`);
        this._loadedAssets[app.id] = true; cb();
      };
      document.head.appendChild(link);
    } else {
      this._loadedAssets[app.id] = true;
      cb();
    }
  },

  /* ─────────────────────────────────────────────────────────────
     INTERNAL — WINDOW DOM BUILDER
     ───────────────────────────────────────────────────────────── */
  _buildWindowDOM(app) {
    const cfg = app.initData || {};
    const el  = document.createElement('div');
    el.id = 'win-' + app.id;

    if (cfg.special === 'gallery') {
      el.className = 'kos-window gallery-window';
    } else {
      el.className = 'kos-window glass';
      if (cfg.special === 'browser') el.classList.add('browser-window');
    }

    /* Resize handles — 8 directions */
    ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach(dir => {
      const h = document.createElement('div');
      h.className = `resize-handle ${dir}`;
      h.dataset.dir = dir;
      el.appendChild(h);
    });

    /* Titlebar */
    if (cfg.special === 'browser') {
      el.appendChild(this._buildBrowserTabstrip(app));
    } else {
      const tb = document.createElement('div');
      tb.className = 'win-titlebar' + (cfg.special === 'gallery' ? ' gallery-titlebar' : '');
      tb.innerHTML = `
        <div class="win-title-spacer"></div>
        <span class="win-title${cfg.special === 'gallery' ? ' gallery-win-title' : ''}">${cfg.title || app.name}</span>
        <div class="win-controls">
          <button class="win-ctrl-btn" data-action="minimize" data-win="${app.id}" title="Minimize"><i class="fa-solid fa-minus"></i></button>
          <button class="win-ctrl-btn" data-action="maximize" data-win="${app.id}" title="Maximize"><i class="fa-solid fa-window-maximize"></i></button>
          <button class="win-ctrl-btn" data-action="close"    data-win="${app.id}" title="Close"><i class="fa-solid fa-xmark"></i></button>
        </div>`;
      el.appendChild(tb);
    }

    /* Content area */
    if (cfg.special === 'browser') {
      el.appendChild(this._buildBrowserBody());
    } else if (cfg.special === 'gallery') {
      const main = document.createElement('div');
      main.className = 'gallery-main';
      main.id = 'gallery-body';
      el.appendChild(main);
      el.appendChild(this._buildLightboxDOM());
    } else {
      const body = document.createElement('div');
      body.className = 'win-body' + (cfg.bodyClass ? ' ' + cfg.bodyClass : '');
      body.id = cfg.bodyId || (app.id + '-body');
      el.appendChild(body);
    }

    return el;
  },

  /* ─── Browser DOM helpers ─── */
  _buildBrowserTabstrip(app) {
    const div = document.createElement('div');
    div.className = 'win-titlebar br-tabstrip';
    div.innerHTML = `
      <div class="win-title-spacer"></div>
      <div class="br-tabs-row" id="br-tabs-row"></div>
      <div class="win-controls">
        <button class="win-ctrl-btn" data-action="minimize" data-win="${app.id}" title="Minimize"><i class="fa-solid fa-minus"></i></button>
        <button class="win-ctrl-btn" data-action="maximize" data-win="${app.id}" title="Maximize"><i class="fa-solid fa-window-maximize"></i></button>
        <button class="win-ctrl-btn" data-action="close"    data-win="${app.id}" title="Close"><i class="fa-solid fa-xmark"></i></button>
      </div>`;
    return div;
  },

  _buildBrowserBody() {
    const wrap = document.createElement('div');
    wrap.className = 'br-shell';
    wrap.innerHTML = `
      <div class="br-toolbar">
        <button class="br-nav-btn" id="br-btn-back"   onclick="Browser.back()"    title="Back"><i class="fa-solid fa-arrow-left"></i></button>
        <button class="br-nav-btn" id="br-btn-fwd"    onclick="Browser.forward()" title="Forward"><i class="fa-solid fa-arrow-right"></i></button>
        <button class="br-nav-btn" id="br-btn-reload" onclick="Browser.reload()"  title="Reload"><i class="fa-solid fa-rotate-right" id="br-reload-icon"></i></button>
        <div class="br-urlbar">
          <i class="fa-solid fa-lock br-lock-icon" id="br-lock-icon"></i>
          <input class="br-url-input" id="br-url-input" type="text"
                 placeholder="Search or enter URL"
                 onfocus="this.select()"
                 onkeydown="Browser.handleKey(event)">
          <button class="br-urlbar-btn" onclick="Browser.bookmark()" title="Bookmark">
            <i class="fa-regular fa-star" id="br-star-icon"></i>
          </button>
        </div>
        <button class="br-nav-btn br-more-btn" title="More options"><i class="fa-solid fa-ellipsis-vertical"></i></button>
      </div>
      <div class="br-progress-bar" id="br-progress-bar"></div>
      <iframe class="br-frame" id="br-frame" src="https://en.wikipedia.org"></iframe>`;
    return wrap;
  },

  _buildLightboxDOM() {
    const lb = document.createElement('div');
    lb.className = 'gallery-lightbox';
    lb.id = 'gallery-lightbox';
    lb.innerHTML = `
      <div class="lb-overlay-bg"></div>
      <button class="lb-close" id="lb-close"><i class="fa-solid fa-chevron-left"></i></button>
      <div class="lb-center"><img class="lb-img" id="lb-img" src="" alt=""></div>
      <div class="lb-bar">
        <button class="lb-action-btn" id="lb-set-wp"><i class="fa-solid fa-image"></i><span>Set as Wallpaper</span></button>
        <span class="lb-label-badge" id="lb-label"></span>
        <button class="lb-action-btn lb-danger" id="lb-delete"><i class="fa-solid fa-trash"></i><span>Delete</span></button>
      </div>`;
    return lb;
  },

  /* ─────────────────────────────────────────────────────────────
     INTERNAL — REGISTER WINDOW
     Sets up initial geometry, traffic light listeners,
     drag and resize. Called after DOM is inserted.
     ───────────────────────────────────────────────────────────── */
  register(app) {
    const id  = typeof app === 'string' ? app : app.id;
    const cfg = typeof app === 'string' ? {} : (app.initData || {});
    const el  = document.getElementById('win-' + id);
    if (!el) return;

    const w = Math.min(cfg.w || 500, window.innerWidth  * 0.95);
    const h = Math.min(cfg.h || 600, window.innerHeight * 0.85);
    const off = cfg.offset || 0;
    el.style.width  = w + 'px';
    el.style.height = h + 'px';
    el.style.left   = Math.max(0, (window.innerWidth  - w) / 2 + off * 0.3) + 'px';
    el.style.top    = (this.TOPBAR_H + 30 + off * 0.4) + 'px';

    this.registry[id] = {
      el, open: false, minimized: false, maximized: false,
      snapped: null,   // null | 'left' | 'right'
      savedRect: null,
      onOpen: null,    // set by app modules via WM.setOnOpen(id, fn)
    };

    /* Attach onOpen from the KOSApps namespace if the module is already loaded */
    const appMod = window.KOSApps?.[id];
    if (appMod?.init) {
      this.registry[id].onOpen = () => appMod.init(el.querySelector('.win-body, .gallery-main, .br-shell') || el);
    }

    /* Consume any pending setOnOpen() hook — takes priority over KOSApps fallback */
    if (this._pendingOnOpen?.[id]) {
      this.registry[id].onOpen = this._pendingOnOpen[id];
      delete this._pendingOnOpen[id];
    }

    /* Window controls */
    el.querySelectorAll('.win-ctrl-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const action = btn.dataset.action;
        if (action === 'close')    this.close(id);
        if (action === 'minimize') this.minimize(id);
        if (action === 'maximize') this.maximize(id);
      });
    });

    el.addEventListener('mousedown', () => this.focus(id));
    this._makeDraggable(id);
    this._makeResizable(id);
  },

  /**
   * Allow app modules to register their init hook after the WM has loaded.
   * Called by each app's JS file (e.g., apps/browser.js).
   */
  setOnOpen(id, fn) {
    if (this.registry[id]) this.registry[id].onOpen = fn;
    else {
      /* App may not have a window yet (lazy). Store for when register() runs. */
      this._pendingOnOpen = this._pendingOnOpen || {};
      this._pendingOnOpen[id] = fn;
    }
  },

  /* ─── Dock auto-hide sync (WM emits event; Dock handles the hiding) ─── */
  _syncDockHide() {
    const hasVisible = Object.values(this.registry).some(w => w.open && !w.minimized);
    KOSBus.dispatch('kos:windows-visible-changed', { hasVisible });
  },

  /* ─────────────────────────────────────────────────────────────
     DRAG  +  WINDOW SNAPPING
     ─────────────────────────────────────────────────────────────
     Snap zones (detected from live cursor position):
       TOP   — cursor Y ≤ TOPBAR_H + 8 px   → fullscreen (maximize)
       LEFT  — cursor X ≤ 12 px             → left  50 % of screen
       RIGHT — cursor X ≥ vw − 12 px        → right 50 % of screen

     While in a zone the snap ghost overlay is shown.
     On mouseup inside a zone the window is snapped.
     Grabbing a snapped window's titlebar instantly un-snaps it
     and re-anchors the drag so the cursor feels natural.
     ───────────────────────────────────────────────────────────── */
  _makeDraggable(id) {
    const w = this.registry[id];
    if (!w) return;
    const handle = w.el.querySelector('.win-titlebar');
    if (!handle) return;

    let sx, sy, sl, st, dragging = false;
    let activeZone = null;   // null | 'top' | 'left' | 'right'
    let _dragRaf   = null;   // rAF handle — at most one paint per frame
    let _lastDragE = null;   // freshest mousemove event, consumed inside rAF
    let _cachedW   = 0;      // offsetWidth read ONCE on mousedown, not per-move

    const SNAP_TOP_PX  = this.TOPBAR_H + 8;
    const SNAP_EDGE_PX = 12;

    handle.addEventListener('mousedown', e => {
      if (e.target.closest('.win-ctrl-btn') || e.target.closest('.br-tab') ||
          e.target.closest('.br-newtab-btn') || e.target.closest('.br-tab-x')) return;
      if (w.maximized) return;

      /* ── Un-snap on grab ──
         Restore original window geometry, then re-anchor the drag
         origin so the cursor feels naturally connected to the window. */
      if (w.snapped) {
        this._unsnapWindow(id);
        /* After restoring, anchor drag from the now-restored position */
        sl = parseInt(w.el.style.left) || 0;
        st = parseInt(w.el.style.top)  || 0;
        sx = e.clientX;
        sy = e.clientY;
      } else {
        sx = e.clientX; sy = e.clientY;
        sl = parseInt(w.el.style.left) || 0;
        st = parseInt(w.el.style.top)  || 0;
      }

      /* Read offsetWidth ONCE here — never inside the hot mousemove loop */
      _cachedW = w.el.offsetWidth;

      /* Promote window to its own GPU layer; strip CSS transitions for zero-lag drag */
      w.el.style.willChange = 'left, top';
      w.el.classList.add('win-dragging');

      dragging = true;
      this.focus(id);
      e.preventDefault();
    });

    document.addEventListener('mousemove', e => {
      if (!dragging) return;
      _lastDragE = e;           // always store the freshest event
      if (_dragRaf) return;     // a frame is already queued — skip
      _dragRaf = requestAnimationFrame(() => {
        _dragRaf = null;
        const ev = _lastDragE;

        let nl = sl + ev.clientX - sx;
        let nt = st + ev.clientY - sy;
        nt = Math.max(this.TOPBAR_H, Math.min(nt, window.innerHeight - 60));
        nl = Math.max(-_cachedW + 100, Math.min(nl, window.innerWidth - 100));
        w.el.style.left = nl + 'px';
        w.el.style.top  = nt + 'px';

        /* ── Detect snap zone from live cursor position ── */
        const cx = ev.clientX;
        const cy = ev.clientY;
        let zone = null;
        if      (cy <= SNAP_TOP_PX)                       zone = 'top';
        else if (cx <= SNAP_EDGE_PX)                      zone = 'left';
        else if (cx >= window.innerWidth - SNAP_EDGE_PX) zone = 'right';

        if (zone !== activeZone) {
          activeZone = zone;
          zone ? this._showSnapGhost(zone) : this._hideSnapGhost();
        }
      });
    }, { passive: true });

    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;

      /* Cancel any pending frame and remove GPU + no-transition hints */
      if (_dragRaf) { cancelAnimationFrame(_dragRaf); _dragRaf = null; }
      w.el.style.willChange = '';
      w.el.classList.remove('win-dragging');

      this._hideSnapGhost();
      if (activeZone) {
        this._snapWindow(id, activeZone);
      } else {
        this._scheduleSave();
      }
      activeZone = null;
    });
  },

  /* ─────────────────────────────────────────────────────────────
     SNAP — apply a snap zone to a window
     ───────────────────────────────────────────────────────────── */
  _snapWindow(id, zone) {
    const w = this.registry[id];
    if (!w) return;

    /* Top snap → delegate to existing maximize() */
    if (zone === 'top') {
      this.maximize(id);
      return;
    }

    /* Save pre-snap geometry so we can restore on un-snap / drag */
    w.savedRect = {
      left:   w.el.style.left,
      top:    w.el.style.top,
      width:  w.el.style.width,
      height: w.el.style.height,
    };

    const tb = this.TOPBAR_H;
    w.el.classList.add('win-animating');

    if (zone === 'left') {
      Object.assign(w.el.style, {
        left: '0px',         top:    tb + 'px',
        width: '50vw',       height: `calc(100vh - ${tb}px)`,
      });
      w.el.classList.add('win-snapped-left');
      w.el.classList.remove('win-snapped-right');
    } else {
      /* right */
      Object.assign(w.el.style, {
        left: '50vw',        top:    tb + 'px',
        width: '50vw',       height: `calc(100vh - ${tb}px)`,
      });
      w.el.classList.add('win-snapped-right');
      w.el.classList.remove('win-snapped-left');
    }

    w.snapped = zone;
    setTimeout(() => w.el.classList.remove('win-animating'), 440);

    /* Inject floating topbar controls on the matching edge slightly after
       geometry starts animating, so button fade-in feels sequenced */
    setTimeout(() => this._injectSnapControls(id, zone), 80);

    this._scheduleSave();
  },

  /* ─────────────────────────────────────────────────────────────
     UN-SNAP — restore window to its pre-snap geometry
     ───────────────────────────────────────────────────────────── */
  _unsnapWindow(id) {
    const w = this.registry[id];
    if (!w || !w.snapped) return;

    /* Clear topbar snap controls for this edge before un-snapping */
    this._clearSnapControls(id);

    w.el.classList.remove('win-snapped-left', 'win-snapped-right');
    w.snapped = null;

    if (w.savedRect) {
      const r = w.savedRect;
      Object.assign(w.el.style, {
        left: r.left, top: r.top, width: r.width, height: r.height,
      });
    }
  },

  /* ─────────────────────────────────────────────────────────────
     SNAP GHOST — translucent preview overlay shown during drag
     ───────────────────────────────────────────────────────────── */
  _showSnapGhost(zone) {
    let ghost = document.getElementById('kos-snap-ghost');
    if (!ghost) {
      ghost = document.createElement('div');
      ghost.id = 'kos-snap-ghost';
      document.body.appendChild(ghost);
    }

    const tb = this.TOPBAR_H;
    const vw = window.innerWidth;

    /* Reset inline geometry */
    Object.assign(ghost.style, {
      top: tb + 'px', bottom: '0', left: '', right: '', width: '',
    });

    if (zone === 'top') {
      Object.assign(ghost.style, { left: '0', right: '0' });
    } else if (zone === 'left') {
      Object.assign(ghost.style, { left: '0', width: '50vw' });
    } else {
      /* right */
      Object.assign(ghost.style, { left: '50vw', right: '0' });
    }

    ghost.dataset.zone = zone;

    /* Trigger entrance animation without forcing a synchronous reflow.
       void offsetWidth is a known perf anti-pattern — it causes a full
       style+layout flush. Use the rAF double-frame trick instead:
       rAF1 ensures the classList.remove is painted, rAF2 adds visible. */
    ghost.classList.remove('kos-snap-ghost--visible');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => ghost.classList.add('kos-snap-ghost--visible'));
    });
  },

  _hideSnapGhost() {
    const ghost = document.getElementById('kos-snap-ghost');
    if (ghost) ghost.classList.remove('kos-snap-ghost--visible');
  },

  /* ─────────────────────────────────────────────────────────────
     RESIZE — 8-directional handles
     ───────────────────────────────────────────────────────────── */
  _makeResizable(id) {
    const w = this.registry[id];
    if (!w) return;

    w.el.querySelectorAll('.resize-handle').forEach(handle => {
      handle.addEventListener('mousedown', e => {
        if (w.maximized) return;
        e.preventDefault(); e.stopPropagation();

        const dir = handle.dataset.dir;
        const startX = e.clientX, startY = e.clientY;
        const startL = parseInt(w.el.style.left)   || 0;
        const startT = parseInt(w.el.style.top)    || 0;
        const startW = w.el.offsetWidth;
        const startH = w.el.offsetHeight;
        this.focus(id);

        /* Promote to GPU layer; strip transitions for zero-lag resize */
        w.el.style.willChange = 'left, top, width, height';
        w.el.classList.add('win-resizing');

        const onMove = (() => {
          let _resizeRaf  = null;
          let _lastResize = null;
          return e => {
            _lastResize = e;
            if (_resizeRaf) return;
            _resizeRaf = requestAnimationFrame(() => {
              _resizeRaf = null;
              const ev = _lastResize;
              const dx = ev.clientX - startX;
              const dy = ev.clientY - startY;
              let nl = startL, nt = startT, nw = startW, nh = startH;

              if (dir.includes('e')) nw = Math.max(this.MIN_W, startW + dx);
              if (dir.includes('s')) nh = Math.max(this.MIN_H, startH + dy);
              if (dir.includes('w')) {
                const cw = Math.max(this.MIN_W, startW - dx);
                nl = startL + (startW - cw);
                nw = cw;
              }
              if (dir.includes('n')) {
                const ch = Math.max(this.MIN_H, startH - dy);
                nt = Math.max(this.TOPBAR_H, startT + (startH - ch));
                nh = ch;
              }

              w.el.style.left   = nl + 'px';
              w.el.style.top    = nt + 'px';
              w.el.style.width  = nw + 'px';
              w.el.style.height = nh + 'px';
            });
          };
        })();

        const onUp = () => {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          w.el.style.willChange = '';
          w.el.classList.remove('win-resizing');
          this._scheduleSave();
        };

        document.addEventListener('mousemove', onMove, { passive: true });
        document.addEventListener('mouseup', onUp);
      });
    });
  },

  /* ─────────────────────────────────────────────────────────────
     STUDIO HELPERS — used by studio.js to dynamically publish apps
     ───────────────────────────────────────────────────────────── */
  registerDynamicApp(appDef) {
    /* appDef shape: { id, name, iconClass, faIcon, initData } */
    const desktop = document.getElementById('screen-desktop');
    if (!document.getElementById('win-' + appDef.id)) {
      const el = this._buildWindowDOM(appDef);
      desktop.appendChild(el);
      this.register(appDef);
    }
  },

  unregisterDynamicApp(id) {
    this.close(id);
    const winEl = document.getElementById('win-' + id);
    if (winEl) winEl.remove();
    delete this.registry[id];
  },
};

/* ─── Global openApp shorthand ─── */
function openApp(id) { WM.launch(id); }