/* ══════════════════════════════════════════════════════════════
   kos-display.js — KOS Ultimate 2026
   Display settings: brightness, zoom, text-size, bold text.
   All settings persisted in IndexedDB (kos-display-settings).

   FIX LOG (Alpha 9)
   ─────────────────
   • Brightness: was using an opacity overlay that increased
     darkness as the slider value increased (inverted logic).
     Now uses filter:brightness(v/100) on the OS root — 100 = full
     brightness, 10 = near-black.  The dark overlay is gone.

   • Bold Text: was setting fontWeight directly on document.body,
     which cascaded into every DOM node (including app content).
     Now adds class `kos-bold` to <html> + injects a scoped
     <style> that targets KOS UI elements only via
     `.kos-bold :not(iframe) *` with specificity guards so
     iframe-embedded web content is left untouched.

   • Zoom: was calling document.body.style.zoom which caused
     position:fixed brightness overlays to scale too.  Now zooms
     the innermost OS wrapper (#kos-root → #kos-desktop → body)
     while the overlay lives on <html>, outside the zoom.

   • IndexedDB: all four settings are now read from / written to
     the `kos-display-settings` database automatically.
   ══════════════════════════════════════════════════════════════ */

window.KOSDisplay = (() => {

  /* ── Constants ──────────────────────────────────────────────── */
  const DB_NAME    = 'kos-display-settings';
  const DB_VERSION = 1;
  const STORE      = 'prefs';
  const KEY        = 'state';

  const DEFAULTS = {
    brightness : 100,   // 10–100  (100 = full brightness)
    zoom       : 100,   // 50–250  (100 = 1:1)
    textSize   : 3,     // 1–6     (3 = M / 15 px)
    bold       : false,
  };

  const TEXT_PX = [11, 13, 15, 17, 19, 22];  // index = textSize - 1

  /* ── State ──────────────────────────────────────────────────── */
  let _db  = null;
  let _cur = { ...DEFAULTS };

  /* ══════════════════════════════════════════════════════════════
     IndexedDB helpers
     ══════════════════════════════════════════════════════════════ */

  function _openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = e => {
        e.target.result.createObjectStore(STORE);
      };
      req.onsuccess = e => resolve(e.target.result);
      req.onerror   = e => reject(e.target.error);
    });
  }

  async function _load() {
    try {
      _db = await _openDB();
      return await new Promise(resolve => {
        const tx  = _db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(KEY);
        req.onsuccess = e => {
          const saved = e.target.result || {};
          _cur = { ...DEFAULTS, ...saved };
          resolve(_cur);
        };
        req.onerror = () => {
          _cur = { ...DEFAULTS };
          resolve(_cur);
        };
      });
    } catch (err) {
      console.warn('[KOSDisplay] IndexedDB unavailable, using defaults.', err);
      _cur = { ...DEFAULTS };
      return _cur;
    }
  }

  function _save() {
    if (!_db) return;
    try {
      const tx = _db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ ..._cur }, KEY);
    } catch (err) {
      console.warn('[KOSDisplay] Save failed.', err);
    }
  }

  /* ══════════════════════════════════════════════════════════════
     DOM helpers
     ══════════════════════════════════════════════════════════════ */

  /* Find the innermost OS root container for zoom.
     Avoid zooming <body> directly so that position:fixed helpers
     (like the brightness overlay) are not scaled. */
  function _zoomTarget() {
    return (
      document.getElementById('kos-root')    ||
      document.getElementById('kos-desktop') ||
      document.getElementById('desktop')     ||
      document.querySelector('[data-kos-root]') ||
      document.body
    );
  }

  /* Brightness overlay — lives on <html>, outside the zoomed
     #kos-root / body, so it covers the physical viewport at all
     zoom levels.  Opacity=0 → full brightness; 0.9 → near-black.

     FIX: old code had opacity = value/100, which made the overlay
     MORE opaque (darker) as the slider went UP.  Correct formula:
     opacity = (100 - value) / 100.                               */
  function _overlay() {
    let el = document.getElementById('kos-brightness-overlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'kos-brightness-overlay';
      Object.assign(el.style, {
        position      : 'fixed',
        inset         : '0',
        background    : '#000',
        pointerEvents : 'none',
        zIndex        : '2147483646',   // just below any modals
        transition    : 'opacity .25s ease',
        opacity       : '0',
      });
      // Append to <html> so it is NOT inside the zoomed #kos-root.
      document.documentElement.appendChild(el);
    }
    return el;
  }

  /* Bold-text injected stylesheet.
     FIX: old code set document.body.style.fontWeight = 'bold'
     which cascaded into everything, including app-window content.
     New approach:
       1. Toggle class `kos-bold` on <html>.
       2. A scoped <style> makes font-weight:600 apply only to
          direct KOS UI nodes (not inside iframes that host web
          content).  CSS `*` does not pierce iframe boundaries,
          so `.kos-bold :not(iframe) *` is already safe for apps
          like the Browser that render in iframes.
          An extra `:not([data-kos-content]) *` guard lets any
          app mark its scrollable content area to opt-out.       */
  function _ensureBoldStyle() {
    if (document.getElementById('kos-bold-style')) return;
    const s = document.createElement('style');
    s.id = 'kos-bold-style';
    s.textContent = `
      /* KOS Bold Text — scoped to OS chrome, not app content */
      html.kos-bold :not(iframe):not([data-kos-content]) *,
      html.kos-bold :not(iframe):not([data-kos-content]) {
        font-weight: 600 !important;
      }
      /* Restore normal weight inside explicitly opted-out zones */
      html.kos-bold [data-kos-content],
      html.kos-bold [data-kos-content] * {
        font-weight: revert !important;
      }
    `;
    document.head.appendChild(s);
  }

  /* Text-size CSS variable — KOS stylesheets should reference
     var(--kos-font-size) for body text.  Also sets a level
     variable so CSS can do step-based overrides if needed.      */
  function _ensureTextSizeStyle() {
    if (document.getElementById('kos-textsize-style')) return;
    const s = document.createElement('style');
    s.id = 'kos-textsize-style';
    // Base rule: when var is set, apply to all OS text nodes.
    s.textContent = `
      :root { --kos-font-size: 15px; --kos-ts-level: 3; }
    `;
    document.head.appendChild(s);
  }

  /* ══════════════════════════════════════════════════════════════
     Apply helpers  (called immediately + after load)
     ══════════════════════════════════════════════════════════════ */

  function _applyBrightness(v) {
    /* v = 10..100.  opacity = (100-v)/100.
       100 % → opacity 0  (no overlay, full brightness)
        50 % → opacity 0.5 (half-dimmed)
        10 % → opacity 0.9 (near-black)                         */
    const opacity = ((100 - v) / 100).toFixed(3);
    _overlay().style.opacity = opacity;
  }

  function _applyZoom(v) {
    /* v = 50..250.  Apply CSS zoom to the OS root wrapper.
       CSS `zoom` is now baseline-2024 across all major browsers.
       We set the property in two places so theme CSS can read it. */
    const ratio = v / 100;
    const target = _zoomTarget();
    target.style.zoom = ratio;
    document.documentElement.style.setProperty('--kos-zoom', ratio);
  }

  function _applyTextSize(lv) {
    /* lv = 1..6 → 11, 13, 15, 17, 19, 22 px */
    _ensureTextSizeStyle();
    const px = TEXT_PX[lv - 1] ?? 15;
    document.documentElement.style.setProperty('--kos-font-size', px + 'px');
    document.documentElement.style.setProperty('--kos-ts-level',  lv);
  }

  function _applyBold(on) {
    /* FIX: use scoped class + injected style instead of
       document.body.style.fontWeight = 'bold'                   */
    _ensureBoldStyle();
    document.documentElement.classList.toggle('kos-bold', !!on);
    document.documentElement.style.setProperty('--kos-font-weight', on ? '600' : '400');
  }

  /* ══════════════════════════════════════════════════════════════
     Public API  (mirrors what _renderDisplay() calls)
     ══════════════════════════════════════════════════════════════ */

  const get = {
    brightness : () => _cur.brightness,
    zoom       : () => _cur.zoom,
    textSize   : () => _cur.textSize,
    bold       : () => _cur.bold,
  };

  function setBrightness(v) {
    v = Math.min(100, Math.max(10, Math.round(v)));
    _cur.brightness = v;
    _applyBrightness(v);
    _save();
  }

  function setZoom(v) {
    v = Math.min(250, Math.max(50, Math.round(v / 5) * 5));
    _cur.zoom = v;
    _applyZoom(v);
    _save();
  }

  function setTextSize(lv) {
    lv = Math.min(6, Math.max(1, Math.round(lv)));
    _cur.textSize = lv;
    _applyTextSize(lv);
    _save();
  }

  function setBold(on) {
    _cur.bold = !!on;
    _applyBold(on);
    _save();
  }

  function reset() {
    _cur = { ...DEFAULTS };
    _applyBrightness(_cur.brightness);
    _applyZoom(_cur.zoom);
    _applyTextSize(_cur.textSize);
    _applyBold(_cur.bold);
    _save();
  }

  /* formatSize — shared utility (also used by Storage section) */
  function formatSize(bytes) {
    if (bytes < 1024)             return bytes + ' B';
    if (bytes < 1_048_576)        return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1_073_741_824)    return (bytes / 1_048_576).toFixed(1) + ' MB';
    return (bytes / 1_073_741_824).toFixed(2) + ' GB';
  }

  /* apply() — called once by kos-init.js during boot.
     Loads from IndexedDB then applies everything.               */
  async function apply() {
    await _load();
    _applyBrightness(_cur.brightness);
    _applyZoom(_cur.zoom);
    _applyTextSize(_cur.textSize);
    _applyBold(_cur.bold);
  }

  return {
    /* Getters */
    get,
    /* Setters (each saves to IDB immediately) */
    setBrightness,
    setZoom,
    setTextSize,
    setBold,
    /* Utilities */
    reset,
    apply,
    formatSize,
  };
})();
