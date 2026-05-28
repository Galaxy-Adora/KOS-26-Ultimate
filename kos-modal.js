/* ══════════════════════════════════════════════════════════════
   KOS ULTIMATE 2026 — kos-modal.js
   System-level modal dialog API.

   Sits above every window, dock, spotlight, and panel.
   All calls return Promises so apps can await results cleanly.

   LOAD ORDER (index.html — add after kos-kernel.js):
     <script defer src="kos-modal.js"></script>

   QUICK REFERENCE
   ───────────────
     // Alert
     await KOSModal.alert({ title:'Saved', message:'File saved.', variant:'success' });

     // Confirm
     const ok = await KOSModal.confirm({ title:'Delete?', destructive:true });
     if (ok) deleteFile();

     // Prompt
     const name = await KOSModal.prompt({ title:'Rename', placeholder:'New name…' });
     if (name) rename(name);

     // Progress
     const prog = KOSModal.progress({ title:'Copying…', indeterminate:true });
     await doWork();
     prog.update({ value:100, sub:'Done!' });
     prog.close();

     // Loading spinner (shorthand)
     const spin = KOSModal.loading({ title:'Processing…' });
     spin.close();

     // Action sheet
     const choice = await KOSModal.sheet({
       title: 'Export As',
       actions: [
         { id:'pdf',  label:'PDF Document',   icon:'fa-file-pdf',   variant:'primary' },
         { id:'png',  label:'PNG Image',       icon:'fa-file-image'  },
         { id:'csv',  label:'CSV Spreadsheet', icon:'fa-table'       },
       ],
     });

     // Force-quit dialog (system)
     await KOSModal.forceQuit({ appName:'Smooth Browser' });

     // Low storage warning
     await KOSModal.lowStorage({ used:'14.2 GB', total:'16 GB' });

     // Custom HTML
     const modal = KOSModal.custom({ render(card, close) { ... } });
     modal.close();

   ══════════════════════════════════════════════════════════════ */

'use strict';

window.KOSModal = (() => {

  /* ═══════════════════════════════════════════════════════════
     §1  CONSTANTS
  ═══════════════════════════════════════════════════════════ */

  /** Base z-index. Each new modal in the stack gets +1. */
  const Z_BASE = 50000;

  /** Default icon per semantic variant. */
  const VARIANT_ICONS = {
    info     : 'fa-circle-info',
    warning  : 'fa-triangle-exclamation',
    error    : 'fa-circle-xmark',
    success  : 'fa-circle-check',
    system   : 'fa-gears',
    question : 'fa-circle-question',
  };

  /* ═══════════════════════════════════════════════════════════
     §2  INTERNAL STACK
     Each open modal is pushed onto _stack.
     Modals below the top get a "stacked" CSS class so they
     appear slightly scaled-back, giving depth cues.
  ═══════════════════════════════════════════════════════════ */

  let _stack  = [];
  let _nextId = 1;

  function _pushToStack(entry) {
    /* Re-classify all current modals as stacked */
    _stack.forEach((m, i) => {
      const depth = _stack.length - i;               // 1 = just below new top
      m.overlayEl.classList.remove('kos-modal-stacked-1', 'kos-modal-stacked-2');
      if (depth >= 1) m.overlayEl.classList.add(`kos-modal-stacked-${Math.min(depth, 2)}`);
    });
    _stack.push(entry);
  }

  function _removeFromStack(id) {
    const idx = _stack.findIndex(m => m.id === id);
    if (idx === -1) return null;
    const [entry] = _stack.splice(idx, 1);
    /* Re-classify remaining entries */
    _stack.forEach((m, i) => {
      m.overlayEl.classList.remove('kos-modal-stacked-1', 'kos-modal-stacked-2');
      const depth = _stack.length - 1 - i;
      if (depth >= 1) m.overlayEl.classList.add(`kos-modal-stacked-${Math.min(depth, 2)}`);
    });
    return entry;
  }

  /* ═══════════════════════════════════════════════════════════
     §3  DOM LIFECYCLE HELPERS
  ═══════════════════════════════════════════════════════════ */

  /**
   * Create the fixed overlay element and animate it in.
   * Each modal gets its own overlay so stacking works via DOM order.
   */
  function _createOverlay() {
    const el = document.createElement('div');
    el.className = 'kos-modal-overlay';
    /* Incremented z-index so newer modals always sit on top */
    el.style.zIndex = Z_BASE + _stack.length;
    document.body.appendChild(el);
    /* Double rAF ensures the CSS transition fires after paint */
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('kos-modal-active')));
    return el;
  }

  /**
   * Animate overlay out and remove it from the DOM.
   */
  function _destroyOverlay(overlayEl) {
    overlayEl.classList.remove('kos-modal-active');
    setTimeout(() => overlayEl.remove(), 350);
  }

  /**
   * Close a modal by id, invoke its stored cleanup, resolve if needed.
   */
  function _close(id) {
    const entry = _removeFromStack(id);
    if (!entry) return;
    entry.cleanup?.();
    _destroyOverlay(entry.overlayEl);
  }

  /* ═══════════════════════════════════════════════════════════
     §4  LOW-LEVEL DOM BUILDERS
     Small composable helpers — keeps the type-specific builders
     short and readable.
  ═══════════════════════════════════════════════════════════ */

  function _el(tag, cls, attrs = {}) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    Object.assign(e, attrs);
    return e;
  }

  function _sep() {
    return _el('div', 'kos-modal-sep');
  }

  function _buildIcon(variant, customIcon) {
    const iconCls = customIcon || VARIANT_ICONS[variant] || 'fa-circle-info';
    const wrap = _el('div', `kos-modal-icon-wrap variant-${variant || 'info'}`);
    wrap.innerHTML = `<i class="fa-solid ${iconCls}"></i>`;
    return wrap;
  }

  function _buildTitle(text) {
    const el = _el('p', 'kos-modal-title', { textContent: text || '' });
    return el;
  }

  function _buildMessage(text) {
    if (!text && text !== 0) return null;
    return _el('p', 'kos-modal-message', { textContent: String(text) });
  }

  function _buildDetail(text) {
    if (!text) return null;
    return _el('div', 'kos-modal-detail', { textContent: String(text) });
  }

  function _buildBtn(label, cls, onClick) {
    const btn = _el('button', `kos-modal-btn ${cls}`, { textContent: label });
    btn.addEventListener('click', onClick);
    return btn;
  }

  /**
   * Build a horizontal or single-button row.
   * @param {Array<{label,cls,onClick}>} specs
   */
  function _buildButtonRow(specs) {
    const horizontal = specs.length > 1;
    const row = _el('div', `kos-modal-buttons${horizontal ? ' horizontal' : ''}`);
    specs.forEach(({ label, cls, onClick }) => {
      row.appendChild(_buildBtn(label, cls, onClick));
    });
    return row;
  }

  /**
   * Build the standard .kos-modal-body (icon + title + optional message + extras).
   * Returns { bodyEl, titleEl, msgEl } so callers can update them later.
   */
  function _buildBody(opts, extras = []) {
    const bodyEl = _el('div', 'kos-modal-body');
    if (opts.variant !== 'none' && !opts.noIcon) {
      bodyEl.appendChild(_buildIcon(opts.variant || 'info', opts.icon));
    }
    const titleEl = _buildTitle(opts.title || '');
    bodyEl.appendChild(titleEl);
    let msgEl = null;
    if (opts.message) {
      msgEl = _buildMessage(opts.message);
      bodyEl.appendChild(msgEl);
    }
    let detEl = null;
    if (opts.detail) {
      detEl = _buildDetail(opts.detail);
      bodyEl.appendChild(detEl);
    }
    extras.forEach(e => { if (e) bodyEl.appendChild(e); });
    return { bodyEl, titleEl, msgEl, detEl };
  }

  /**
   * Wire global keyboard handling for a modal.
   * Stores a cleanup fn on the entry so _close() can remove it.
   */
  function _wireKeyboard(id, handlers) {
    const onKey = (e) => {
      const handler = handlers[e.key];
      if (handler) { e.preventDefault(); handler(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }

  /* ═══════════════════════════════════════════════════════════
     §5  PUBLIC MODAL TYPES
  ═══════════════════════════════════════════════════════════ */

  /* ───────────────────────────────────────────────────────────
     5.1  ALERT
     One message + one OK button.
     Promise resolves (void) when the user dismisses.

     Options:
       title       string
       message     string  (optional)
       detail      string  (optional — monospace detail block)
       variant     'info' | 'warning' | 'error' | 'success' | 'system'
       icon        string  (FA icon class override)
       okLabel     string  (default 'OK')
       autoClose   number  (ms, optional — auto-close after N ms)
  ─────────────────────────────────────────────────────────── */
  function alert(opts = {}) {
    return new Promise(resolve => {
      const id         = _nextId++;
      const overlayEl  = _createOverlay();
      const card       = _el('div', 'kos-modal-card');

      const { bodyEl } = _buildBody(opts);
      card.appendChild(bodyEl);
      card.appendChild(_sep());

      const dismiss = () => { _close(id); resolve(); };

      card.appendChild(
        _buildButtonRow([
          { label: opts.okLabel || 'OK', cls: 'btn-primary', onClick: dismiss },
        ])
      );
      overlayEl.appendChild(card);

      const cleanup = _wireKeyboard(id, { Enter: dismiss, ' ': dismiss, Escape: dismiss });
      _pushToStack({ id, overlayEl, cleanup });

      /* Auto-close countdown */
      let countdownTimer = null;
      if (opts.autoClose > 0) {
        const countdown = _el('div', 'kos-modal-countdown');
        let remaining = Math.ceil(opts.autoClose / 1000);
        countdown.textContent = `Auto-closing in ${remaining}s`;
        bodyEl.appendChild(countdown);

        countdownTimer = setInterval(() => {
          remaining--;
          countdown.textContent = `Auto-closing in ${remaining}s`;
          if (remaining <= 0) { clearInterval(countdownTimer); dismiss(); }
        }, 1000);
        setTimeout(dismiss, opts.autoClose);
      }

      /* Focus OK button after entrance animation */
      const okBtn = card.querySelector('.kos-modal-btn');
      setTimeout(() => okBtn?.focus(), 320);
    });
  }


  /* ───────────────────────────────────────────────────────────
     5.2  CONFIRM
     Two buttons — Cancel (left) and Confirm (right).
     Promise resolves with boolean: true = confirmed, false = cancelled.

     Options:
       title         string
       message       string  (optional)
       detail        string  (optional)
       variant       string  (default 'question')
       icon          string
       confirmLabel  string  (default 'OK')
       cancelLabel   string  (default 'Cancel')
       destructive   boolean (confirm button turns red)
  ─────────────────────────────────────────────────────────── */
  function confirm(opts = {}) {
    return new Promise(resolve => {
      const id        = _nextId++;
      const overlayEl = _createOverlay();
      const card      = _el('div', 'kos-modal-card');

      const { bodyEl } = _buildBody({ ...opts, variant: opts.variant || 'question' });
      card.appendChild(bodyEl);
      card.appendChild(_sep());

      const cancel  = () => { _close(id); resolve(false); };
      const confirm = () => { _close(id); resolve(true);  };

      const confirmCls = opts.destructive ? 'btn-destructive' : 'btn-primary';

      card.appendChild(
        _buildButtonRow([
          { label: opts.cancelLabel  || 'Cancel', cls: 'btn-cancel',   onClick: cancel  },
          { label: opts.confirmLabel || 'OK',     cls: confirmCls,     onClick: confirm },
        ])
      );
      overlayEl.appendChild(card);

      const cleanup = _wireKeyboard(id, { Enter: confirm, Escape: cancel });
      _pushToStack({ id, overlayEl, cleanup });

      /* Focus the confirm button so Enter works intuitively */
      setTimeout(() => card.querySelectorAll('.kos-modal-btn')[1]?.focus(), 320);
    });
  }


  /* ───────────────────────────────────────────────────────────
     5.3  PROMPT
     Text input + Cancel / OK buttons.
     Promise resolves with the string value, or null if cancelled.

     Options:
       title         string
       message       string  (optional)
       placeholder   string
       defaultValue  string
       inputType     'text' | 'password' | 'email' | 'number'
       multiline     boolean (renders <textarea> instead of <input>)
       confirmLabel  string  (default 'OK')
       cancelLabel   string  (default 'Cancel')
       variant       string
       icon          string
       validate      fn(value) → string|null  (return error msg or null)
  ─────────────────────────────────────────────────────────── */
  function prompt(opts = {}) {
    return new Promise(resolve => {
      const id        = _nextId++;
      const overlayEl = _createOverlay();
      const card      = _el('div', 'kos-modal-card');

      /* Build input element */
      let inputEl;
      if (opts.multiline) {
        inputEl = _el('textarea', 'kos-modal-input multiline');
        inputEl.rows = 4;
      } else {
        inputEl = _el('input', 'kos-modal-input');
        inputEl.type = opts.inputType || 'text';
      }
      inputEl.placeholder = opts.placeholder || '';
      inputEl.value       = opts.defaultValue || '';

      /* Optional inline error label */
      const errEl = _el('p', 'kos-modal-message');
      errEl.style.cssText = 'color:#ff3b30;font-size:0.78rem;margin:4px 0 0;display:none;';

      const { bodyEl } = _buildBody(opts, [inputEl, errEl]);
      card.appendChild(bodyEl);
      card.appendChild(_sep());

      const cancel  = () => { _close(id); resolve(null); };
      const confirm = () => {
        const val = inputEl.value;
        if (typeof opts.validate === 'function') {
          const err = opts.validate(val);
          if (err) {
            errEl.textContent = err;
            errEl.style.display = '';
            inputEl.focus();
            /* Shake the input */
            inputEl.style.animation = 'none';
            requestAnimationFrame(() => {
              inputEl.style.animation = 'kos-modal-shake 0.38s ease';
            });
            return;
          }
        }
        _close(id);
        resolve(val);
      };

      card.appendChild(
        _buildButtonRow([
          { label: opts.cancelLabel  || 'Cancel', cls: 'btn-cancel',  onClick: cancel  },
          { label: opts.confirmLabel || 'OK',     cls: 'btn-primary', onClick: confirm },
        ])
      );
      overlayEl.appendChild(card);

      /* Enter submits (unless multiline where Enter = newline) */
      if (!opts.multiline) {
        inputEl.addEventListener('keydown', e => {
          if (e.key === 'Enter') { e.preventDefault(); confirm(); }
        });
      }

      const cleanup = _wireKeyboard(id, { Escape: cancel });
      _pushToStack({ id, overlayEl, cleanup });

      /* Auto-focus and select the input text */
      setTimeout(() => { inputEl.focus(); inputEl.select(); }, 320);
    });
  }


  /* ───────────────────────────────────────────────────────────
     5.4  PROGRESS
     Updatable progress bar — NOT promise-based.
     Returns a controller object: { id, update(opts), close() }.

     Options:
       title         string
       message       string (optional, shown below title)
       sub           string (below progress bar — e.g. '12 of 40 files')
       value         number (0–max, default 0)
       max           number (default 100)
       indeterminate boolean (shimmer animation)
       cancelable    boolean (show Cancel button)
       cancelLabel   string
       onCancel      fn     (called when Cancel clicked)
       variant       string (default 'system')
       icon          string
  ─────────────────────────────────────────────────────────── */
  function progress(opts = {}) {
    const id        = _nextId++;
    const overlayEl = _createOverlay();
    const card      = _el('div', 'kos-modal-card');

    const max    = opts.max   ?? 100;
    const initV  = opts.value ?? 0;
    const pct    = opts.indeterminate ? 0 : Math.round((initV / max) * 100);

    /* Progress DOM elements */
    const track  = _el('div', 'kos-modal-progress-track');
    const fill   = _el('div', `kos-modal-progress-fill${opts.indeterminate ? ' indeterminate' : ''}`);
    fill.style.width = opts.indeterminate ? '45%' : pct + '%';
    track.appendChild(fill);

    const subEl  = _el('div', 'kos-modal-progress-sub', { textContent: opts.sub || '' });
    const pctEl  = _el('div', 'kos-modal-progress-pct', {
      textContent: opts.indeterminate ? '' : pct + '%',
    });

    const row    = _el('div', 'kos-modal-progress-row');
    row.appendChild(subEl);
    row.appendChild(pctEl);

    const wrap   = _el('div', 'kos-modal-progress-wrap');
    wrap.appendChild(track);
    wrap.appendChild(row);

    const { bodyEl, titleEl, msgEl } = _buildBody(
      { ...opts, variant: opts.variant || 'system' },
      [wrap]
    );
    card.appendChild(bodyEl);

    /* Cancel button */
    if (opts.cancelable) {
      card.appendChild(_sep());
      const onCancel = () => {
        _close(id);
        if (typeof opts.onCancel === 'function') opts.onCancel();
      };
      card.appendChild(
        _buildButtonRow([
          { label: opts.cancelLabel || 'Cancel', cls: 'btn-destructive', onClick: onCancel },
        ])
      );
    }

    overlayEl.appendChild(card);
    _pushToStack({ id, overlayEl, cleanup: null });

    /* Return the controller */
    return {
      id,
      /**
       * Update the progress modal in-place (no DOM rebuild).
       * @param {object} u
       * @param {string} [u.title]
       * @param {string} [u.message]
       * @param {string} [u.sub]
       * @param {number} [u.value]
       * @param {number} [u.max]
       */
      update(u = {}) {
        if (u.title   !== undefined && titleEl) titleEl.textContent = u.title;
        if (u.message !== undefined && msgEl)   msgEl.textContent   = u.message;
        if (u.sub     !== undefined)             subEl.textContent   = u.sub;

        if (!opts.indeterminate && u.value !== undefined) {
          const newMax = u.max ?? max;
          const newPct = Math.min(100, Math.round((u.value / newMax) * 100));
          fill.style.width   = newPct + '%';
          pctEl.textContent  = newPct + '%';
        }
      },
      close() { _close(id); },
    };
  }


  /* ───────────────────────────────────────────────────────────
     5.5  LOADING  (spinner shorthand — alias over progress)
     Returns a controller: { id, setTitle(s), setMessage(s), close() }

     Options:
       title    string
       message  string
       variant  string (default 'system')
  ─────────────────────────────────────────────────────────── */
  function loading(opts = {}) {
    const id        = _nextId++;
    const overlayEl = _createOverlay();
    const card      = _el('div', 'kos-modal-card');

    const spinner = _el('div', 'kos-modal-spinner');
    const titleEl = _buildTitle(opts.title || 'Please Wait');
    const msgEl   = opts.message ? _buildMessage(opts.message) : null;

    const bodyEl = _el('div', 'kos-modal-body');
    bodyEl.appendChild(spinner);
    bodyEl.appendChild(titleEl);
    if (msgEl) bodyEl.appendChild(msgEl);

    card.appendChild(bodyEl);
    overlayEl.appendChild(card);
    _pushToStack({ id, overlayEl, cleanup: null });

    return {
      id,
      setTitle(t)   { titleEl.textContent = t; },
      setMessage(m) { if (msgEl) msgEl.textContent = m; },
      close()       { _close(id); },
    };
  }


  /* ───────────────────────────────────────────────────────────
     5.6  SHEET  (action sheet — multiple choices stacked vertically)
     Promise resolves with the chosen action's `id` string,
     or null if the user taps Cancel.

     Options:
       title       string  (optional header title)
       message     string  (optional subtitle)
       actions     Array<{
                     id       : string,
                     label    : string,
                     icon     : string  (FA icon, optional),
                     variant  : 'primary' | 'destructive' | '' (optional),
                     disabled : boolean,
                   }>
       showCancel  boolean (default true)
       cancelLabel string  (default 'Cancel')
  ─────────────────────────────────────────────────────────── */
  function sheet(opts = {}) {
    return new Promise(resolve => {
      const id        = _nextId++;
      const overlayEl = _createOverlay();
      const card      = _el('div', 'kos-modal-card');

      /* Optional header */
      if (opts.title || opts.message) {
        const hdr = _el('div', 'kos-modal-sheet-header');
        if (opts.title) {
          hdr.appendChild(_el('p', 'kos-modal-sheet-header-title', { textContent: opts.title }));
        }
        if (opts.message) {
          hdr.appendChild(_el('p', 'kos-modal-sheet-header-sub', { textContent: opts.message }));
        }
        card.appendChild(hdr);
      }

      /* Actions */
      const actionsWrap = _el('div', 'kos-modal-sheet-actions');
      (opts.actions || []).forEach(action => {
        const btn = _el('button', `kos-modal-sheet-btn${action.variant ? ' btn-' + action.variant : ''}${action.disabled ? ' btn-disabled' : ''}`);

        if (action.icon) {
          const ico = _el('i', `fa-solid ${action.icon} kos-sheet-icon`);
          btn.appendChild(ico);
        }
        btn.appendChild(document.createTextNode(action.label || ''));

        if (!action.disabled) {
          btn.addEventListener('click', () => {
            _close(id);
            resolve(action.id || action.label || null);
          });
        }
        actionsWrap.appendChild(btn);
      });
      card.appendChild(actionsWrap);

      /* Cancel */
      if (opts.showCancel !== false) {
        card.appendChild(_sep());
        const cancel = () => { _close(id); resolve(null); };
        card.appendChild(
          _buildButtonRow([
            { label: opts.cancelLabel || 'Cancel', cls: 'btn-cancel', onClick: cancel },
          ])
        );
      }

      overlayEl.appendChild(card);
      const cleanup = _wireKeyboard(id, {
        Escape: () => { _close(id); resolve(null); },
      });
      _pushToStack({ id, overlayEl, cleanup });
    });
  }


  /* ───────────────────────────────────────────────────────────
     5.7  CUSTOM
     Caller provides a render function (or raw HTML string)
     and manages the modal's lifecycle manually.
     Returns { id, close() }.

     Options:
       render  fn(cardEl, closeFn)  — inject whatever DOM you want
       html    string               — raw innerHTML (alternative to render)
       width   string               — CSS max-width override (default '460px')
  ─────────────────────────────────────────────────────────── */
  function custom(opts = {}) {
    const id        = _nextId++;
    const overlayEl = _createOverlay();
    const card      = _el('div', 'kos-modal-card');

    if (opts.width) card.style.maxWidth = opts.width;

    const closeFn = () => _close(id);

    if (typeof opts.render === 'function') {
      opts.render(card, closeFn);
    } else if (opts.html) {
      card.innerHTML = opts.html;
    }

    overlayEl.appendChild(card);
    const cleanup = opts.closeOnEscape !== false
      ? _wireKeyboard(id, { Escape: closeFn })
      : null;

    _pushToStack({ id, overlayEl, cleanup });
    return { id, close: closeFn };
  }


  /* ═══════════════════════════════════════════════════════════
     §6  SYSTEM-LEVEL PRESET DIALOGS
     Pre-wired dialogs for common OS-level scenarios.
     Each is just a thin wrapper around the primitives above.
  ═══════════════════════════════════════════════════════════ */

  /**
   * Force-quit a hung app.
   * Returns Promise<boolean> — true = force quit, false = cancel.
   *
   * @param {{ appName: string, reason?: string }} opts
   */
  function forceQuit(opts = {}) {
    return confirm({
      title        : `"${opts.appName || 'App'}" is not responding`,
      message      : opts.reason || 'You can force quit this application, but any unsaved changes will be lost.',
      detail       : opts.detail,
      variant      : 'error',
      confirmLabel : 'Force Quit',
      cancelLabel  : 'Wait',
      destructive  : true,
    });
  }

  /**
   * Unsaved changes warning before closing a document.
   * Returns Promise<'save'|'discard'|null>
   *
   * @param {{ docName?: string }} opts
   */
  function unsavedChanges(opts = {}) {
    const name = opts.docName ? `"${opts.docName}"` : 'This document';
    return sheet({
      title   : 'Unsaved Changes',
      message : `${name} has unsaved changes. Do you want to save before closing?`,
      actions : [
        { id: 'save',    label: 'Save',           variant: 'primary' },
        { id: 'discard', label: "Don't Save",     variant: 'destructive' },
      ],
      cancelLabel: 'Cancel',
    });
  }

  /**
   * Low storage warning.
   * Returns Promise<'manage'|null>
   *
   * @param {{ used?: string, total?: string, percent?: number }} opts
   */
  function lowStorage(opts = {}) {
    const pct  = opts.percent ?? 90;
    const used = opts.used  ?? '—';
    const tot  = opts.total ?? '—';
    return sheet({
      title   : 'Storage Almost Full',
      message : `${used} of ${tot} used (${pct}%). Free up space to continue saving files.`,
      actions : [
        { id: 'manage', label: 'Manage Storage', icon: 'fa-hard-drive', variant: 'primary' },
      ],
      cancelLabel: 'Later',
    });
  }

  /**
   * Permission request dialog (e.g. mic, camera, files).
   * Returns Promise<boolean>
   *
   * @param {{ resource: string, appName?: string, reason?: string }} opts
   */
  function requestPermission(opts = {}) {
    const app = opts.appName ? `"${opts.appName}"` : 'An app';
    return confirm({
      title        : `Allow Access to ${opts.resource || 'this resource'}?`,
      message      : opts.reason || `${app} wants to access your ${(opts.resource || '').toLowerCase()}.`,
      variant      : 'warning',
      confirmLabel : 'Allow',
      cancelLabel  : 'Deny',
    });
  }

  /**
   * Restart required — shown after system updates or setting changes
   * that need a reboot to take effect.
   * Returns Promise<boolean> — true = restart now, false = later.
   *
   * @param {{ reason?: string }} opts
   */
  function restartRequired(opts = {}) {
    return confirm({
      title        : 'Restart Required',
      message      : opts.reason || 'A restart is required for changes to take effect.',
      variant      : 'system',
      icon         : 'fa-rotate-right',
      confirmLabel : 'Restart Now',
      cancelLabel  : 'Later',
    });
  }

  /**
   * Generic error report (usually for uncaught exceptions).
   * Returns Promise<void>.
   *
   * @param {{ title?: string, message?: string, detail?: string }} opts
   */
  function error(opts = {}) {
    return alert({
      title   : opts.title   || 'An Error Occurred',
      message : opts.message || 'Something went wrong. Please try again.',
      detail  : opts.detail,
      variant : 'error',
      okLabel : 'OK',
    });
  }

  /**
   * Success confirmation — auto-closes after 2.5 s by default.
   * Returns Promise<void>.
   */
  function success(opts = {}) {
    return alert({
      title     : opts.title   || 'Done',
      message   : opts.message || '',
      variant   : 'success',
      okLabel   : opts.okLabel || 'OK',
      autoClose : opts.autoClose ?? 2500,
    });
  }

  /**
   * Delete confirmation with standardised wording.
   * Returns Promise<boolean>
   *
   * @param {{ itemName?: string, message?: string }} opts
   */
  function confirmDelete(opts = {}) {
    const item = opts.itemName ? `"${opts.itemName}"` : 'this item';
    return confirm({
      title        : `Delete ${item}?`,
      message      : opts.message || 'This action cannot be undone.',
      variant      : 'error',
      confirmLabel : 'Delete',
      cancelLabel  : 'Cancel',
      destructive  : true,
    });
  }

  /**
   * Password / authentication gate.
   * Returns Promise<string|null> — the entered password, or null.
   *
   * @param {{ title?: string, message?: string }} opts
   */
  function authenticate(opts = {}) {
    return prompt({
      title       : opts.title   || 'Authentication Required',
      message     : opts.message || 'Enter your password to continue.',
      variant     : 'system',
      icon        : 'fa-lock',
      inputType   : 'password',
      placeholder : 'Password',
      confirmLabel: 'Unlock',
    });
  }

  /**
   * About / info panel (read-only rich detail).
   * Returns Promise<void>.
   *
   * @param {{ title: string, rows: Array<[string,string]>, footer?: string }} opts
   */
  function infoPanel(opts = {}) {
    return custom({
      closeOnEscape: true,
      render(card, close) {
        /* Body */
        const body = _el('div', 'kos-modal-body');
        body.appendChild(_buildIcon('info'));
        body.appendChild(_buildTitle(opts.title || 'Information'));

        if (opts.rows && opts.rows.length) {
          const table = _el('div');
          table.style.cssText = 'width:100%;margin-top:6px;text-align:left;';
          opts.rows.forEach(([k, v]) => {
            const row = _el('div');
            row.style.cssText = 'display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px solid rgba(0,0,0,0.06);font-family:Outfit,sans-serif;font-size:0.82rem;';
            const keyEl = _el('span', '', { textContent: k });
            keyEl.style.color = 'rgba(0,0,0,0.45)';
            const valEl = _el('span', '', { textContent: v });
            valEl.style.cssText = 'font-family:Share Tech Mono,monospace;color:rgba(0,0,0,0.82);word-break:break-all;text-align:right;';
            row.appendChild(keyEl);
            row.appendChild(valEl);
            table.appendChild(row);
          });
          body.appendChild(table);
        }

        if (opts.footer) {
          const ft = _el('p', 'kos-modal-message', { textContent: opts.footer });
          ft.style.marginTop = '8px';
          body.appendChild(ft);
        }

        card.appendChild(body);
        card.appendChild(_sep());
        card.appendChild(_buildButtonRow([
          { label: 'OK', cls: 'btn-primary', onClick: close },
        ]));
      },
    });
  }


  /* ═══════════════════════════════════════════════════════════
     §7  GLOBAL CONTROLS
  ═══════════════════════════════════════════════════════════ */

  /**
   * Close the top-most modal (most recently opened).
   */
  function closeTop() {
    if (_stack.length) {
      const top = _stack[_stack.length - 1];
      _close(top.id);
    }
  }

  /**
   * Close ALL open modals immediately.
   */
  function closeAll() {
    /* Reverse order so cleanup runs newest → oldest */
    [..._stack].reverse().forEach(m => {
      m.cleanup?.();
      _destroyOverlay(m.overlayEl);
    });
    _stack = [];
  }

  /**
   * True if any modal is currently open.
   */
  function isOpen() {
    return _stack.length > 0;
  }

  /**
   * Number of currently open modals.
   */
  function stackDepth() {
    return _stack.length;
  }


  /* ═══════════════════════════════════════════════════════════
     §8  CSS SHAKE KEYFRAME  (injected once for prompt validation)
  ═══════════════════════════════════════════════════════════ */
  (function _injectShake() {
    if (document.getElementById('kos-modal-shake-style')) return;
    const s = document.createElement('style');
    s.id = 'kos-modal-shake-style';
    s.textContent = `
      @keyframes kos-modal-shake {
        0%,100% { transform: translateX(0); }
        18%     { transform: translateX(-8px); }
        36%     { transform: translateX( 8px); }
        54%     { transform: translateX(-5px); }
        72%     { transform: translateX( 5px); }
        88%     { transform: translateX(-2px); }
      }
    `;
    document.head.appendChild(s);
  })();


  /* ═══════════════════════════════════════════════════════════
     §9  PUBLIC SURFACE  (frozen — never mutated at runtime)
  ═══════════════════════════════════════════════════════════ */
  return Object.freeze({
    /* ── Primitives ── */
    alert,
    confirm,
    prompt,
    progress,
    loading,
    sheet,
    custom,

    /* ── System presets ── */
    error,
    success,
    forceQuit,
    unsavedChanges,
    lowStorage,
    requestPermission,
    restartRequired,
    confirmDelete,
    authenticate,
    infoPanel,

    /* ── Stack controls ── */
    closeTop,
    closeAll,
    isOpen,
    stackDepth,
  });

})();
