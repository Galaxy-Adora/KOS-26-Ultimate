/*!
 * kos-setup.js — KOS OOBE First-Boot Setup Wizard
 * ════════════════════════════════════════════════════════════════
 * KOS Ultimate 2026  |  Kalapurackal Studios
 *
 * TWO RESPONSIBILITIES:
 *   §1  KOSUser   — Username stored in IndexedDB (kos-userdata).
 *                   Exposed globally so terminal.js can call it.
 *   §2  KOSSetup  — 7-step first-boot OOBE wizard (Win 11 style).
 *                   Only runs when localStorage('kos_setup_complete')
 *                   is absent. Intercepts the login screen via
 *                   MutationObserver — zero changes to kos-init.js.
 *
 * LOAD ORDER  (add to index.html):
 *   <link rel="stylesheet" href="css/kos-setup.css">   ← in <head>
 *   <script defer src="kos-setup.js"></script>          ← after kos-init.js
 *
 * SETTINGS SAVED:
 *   Username  → IndexedDB  kos-userdata / settings / 'username'
 *   Password  → localStorage  kos_login_password  +  kos-password
 *   Theme     → body class   +  localStorage kos-theme
 *   Glass     → body class   +  localStorage kos-glass
 *   Avatar    → applyAvatar()  or  localStorage kos-avatar
 *   Wallpaper → selectWallpaper()  or  localStorage kos-wallpaper
 *   Palette   → applyIconPalette()  +  localStorage kos-icon-palette
 *   Complete  → localStorage  kos_setup_complete = '1'
 * ════════════════════════════════════════════════════════════════
 */

'use strict';
(function (global) {

  /* ══════════════════════════════════════════════════════════════
     §1  KOSUSER — Username management via IndexedDB
     ══════════════════════════════════════════════════════════════ */

  const _DB_NAME    = 'kos-userdata';
  const _DB_VER     = 1;
  const _STORE      = 'settings';
  const _USERNAME_K = 'username';
  const _FALLBACK   = 'Developer';

  const KOSUser = (() => {

    /* ─── Open / upgrade the kos-userdata IDB ─── */
    function _openDB() {
      return new Promise((res, rej) => {
        const req = indexedDB.open(_DB_NAME, _DB_VER);
        req.onupgradeneeded = e => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(_STORE)) {
            db.createObjectStore(_STORE);   // simple key-value store
          }
        };
        req.onsuccess = e => res(e.target.result);
        req.onerror   = e => rej(e.target.error);
      });
    }

    /* ─── Read username (never throws — falls back to _FALLBACK) ─── */
    async function getUsername() {
      try {
        const db  = await _openDB();
        return await new Promise(res => {
          const req = db.transaction(_STORE, 'readonly')
                        .objectStore(_STORE).get(_USERNAME_K);
          req.onsuccess = e => { db.close(); res(e.target.result || _FALLBACK); };
          req.onerror   = ()  => { db.close(); res(_FALLBACK); };
        });
      } catch (_) { return _FALLBACK; }
    }

    /* ─── Write username + live-update every .login-username ─── */
    async function setUsername(name) {
      const db = await _openDB();
      await new Promise((res, rej) => {
        const req = db.transaction(_STORE, 'readwrite')
                      .objectStore(_STORE).put(name, _USERNAME_K);
        req.onsuccess = () => { db.close(); res(); };
        req.onerror   = e  => { db.close(); rej(e.target.error); };
      });
      _applyToDOM(name);
    }

    /* ─── Push the current username into every element that shows it ─── */
    function _applyToDOM(name) {
      document.querySelectorAll('.login-username')
              .forEach(el => { el.textContent = name; });
      document.querySelectorAll('[data-kos-username]')
              .forEach(el => { el.textContent = name; });
      /* Notify other modules via KOSBus if it exists */
      if (typeof KOSBus !== 'undefined') {
        KOSBus.dispatch('kos:username-changed', { username: name });
      }
    }

    /* ─── Called on EVERY page load — hydrates DOM from IDB ─── */
    async function applyOnBoot() {
      const name = await getUsername();
      _applyToDOM(name);
    }

    return Object.freeze({ getUsername, setUsername, applyOnBoot });
  })();

  global.KOSUser = KOSUser;      // ← terminal.js uses this


  /* ══════════════════════════════════════════════════════════════
     §2  STATIC DATA — palettes · wallpapers · avatars
     ══════════════════════════════════════════════════════════════ */

  /* Merge with the kernel's ICON_PALETTES if defined, else use fallback */
  const _PALETTES = (() => {
    if (typeof ICON_PALETTES !== 'undefined' && Array.isArray(ICON_PALETTES)) {
      return ICON_PALETTES.map(p => ({
        id    : p.id,
        label : p.label || p.id,
        colors: p.colors || p.gradient || ['#007AFF','#FF3B30','#34C759','#FF9F0A','#5E5CE6','#FF6B35'],
      }));
    }
    return [
      { id:'default',    label:'Default',    colors:['#FF6B35','#007AFF','#34C759','#FF9F0A','#5E5CE6','#FF3B30'] },
      { id:'vibrant',    label:'Vibrant',    colors:['#FF2D55','#FF9F0A','#30D158','#0A84FF','#BF5AF2','#FF6B35'] },
      { id:'pastel',     label:'Pastel',     colors:['#AED6F1','#ABEBC6','#FAD7A0','#D7BDE2','#FADADD','#A9DFBF'] },
      { id:'monochrome', label:'Monochrome', colors:['#8E8E93','#636366','#48484A','#3A3A3C','#2C2C2E','#1C1C1E'] },
      { id:'warm',       label:'Warm',       colors:['#FF3B30','#FF6B35','#FF9F0A','#FFCC00','#FF8C00','#FF453A'] },
      { id:'cool',       label:'Cool',       colors:['#007AFF','#5AC8FA','#5E5CE6','#30D158','#00C7BE','#64D2FF'] },
    ];
  })();

  /* Merge with STOCK_WALLPAPERS if available, else build fallback list */
  const _WALLPAPERS = (() => {
    if (typeof STOCK_WALLPAPERS !== 'undefined' && Array.isArray(STOCK_WALLPAPERS) && STOCK_WALLPAPERS.length) {
      return STOCK_WALLPAPERS.map((w, i) => ({
        key  : i === 0 ? 'default' : 'stock-' + i,
        label: w.label || `Wallpaper ${i + 1}`,
        url  : w.url   || w.thumb || (i === 0 ? 'documents/dfw.jpg' : null),
        css  : w.css   || w.gradient || null,
      }));
    }
    return [
      { key:'default', label:'Default',  url:'documents/dfw.jpg',  css:null },
      { key:'stock-1', label:'Aurora',   url:'documents/wp2.jpg',  css:'linear-gradient(135deg,#0f2027,#2c5364)' },
      { key:'stock-2', label:'Sunset',   url:'documents/wp3.jpg',  css:'linear-gradient(135deg,#f7971e,#ffd200)' },
      { key:'stock-3', label:'Forest',   url:'documents/wp4.jpg',  css:'linear-gradient(135deg,#134e5e,#71b280)' },
      { key:'stock-4', label:'Midnight', url:'documents/wp5.jpg',  css:'linear-gradient(135deg,#0f0c29,#302b63)' },
      { key:'stock-5', label:'Rose',     url:'documents/wp6.jpg',  css:'linear-gradient(135deg,#c9d6ff,#e2e2e2)' },
    ];
  })();

  const _AVATAR_PRESETS = [
    'documents/img_avatar.png',
    'documents/img_avatar2.png',
    'documents/img_avatar3.png',
    'documents/img_avatar4.png',
    'documents/img_avatar5.png',
    'documents/img_avatar6.png',
  ];

  const _SETUP_KEY = 'kos_setup_complete';

  /* ══════════════════════════════════════════════════════════════
     §3  KOSSETUP — Wizard
     ══════════════════════════════════════════════════════════════ */

  const KOSSetup = {

    _el   : null,          // #screen-setup DOM element
    _step : 0,
    _TOTAL: 6,             // last step index (steps 0 – 6)

    /* Collected settings before applying on finish */
    _d: {
      username    : '',
      password    : '',
      confirm     : '',
      isDark      : false,
      isGlass     : true,
      avatarSrc   : null,
      wallpaper   : 'default',
      palette     : 'default',
      tosAccepted : false,   // persists checkbox state across Back/Next navigation
    },

    /* ── 1. Entry point called by the boot hook ── */
    init() {
      /* Snapshot current body state so the wizard reflects reality */
      this._d.isDark  = document.body.classList.contains('dark');
      this._d.isGlass = !document.body.classList.contains('no-glass');

      /* Build the screen element and inject into body */
      this._el = document.createElement('div');
      this._el.id        = 'screen-setup';
      this._el.className = 'screen';

      const desk = document.getElementById('screen-desktop');
      if (desk) desk.before(this._el);
      else      document.body.appendChild(this._el);

      this._buildFrame();
      /* ← THIS was the black-screen bug: the element was injected into
         the DOM but never made visible. We must add 'active' ourselves
         because no other code knows this screen exists yet. */
      this._el.classList.add('active');
      this._go(0);
    },

    /* ── 2. Permanent outer skeleton (rendered once) ── */
    _buildFrame() {
      this._el.innerHTML = `
        <div class="kos-setup-bg"></div>
        <div class="kos-setup-card" id="kos-setup-card">
          <div class="kos-setup-progress" id="kos-setup-progress"></div>
          <div class="kos-setup-body"     id="kos-setup-body"></div>
          <div class="kos-setup-footer"   id="kos-setup-footer"></div>
        </div>`;
    },

    /* ── 3. Navigate to a step (also used internally) ── */
    _go(n) {
      this._step = n;
      this._updateProgress();
      this._updateBody();
      this._updateFooter();
    },

    /* ── 4. Progress bar ── */
    _updateProgress() {
      const el = document.getElementById('kos-setup-progress');
      if (!el) return;
      const pct   = Math.round((this._step / this._TOTAL) * 100);
      const label = this._step === 0            ? '' :
                    this._step === this._TOTAL  ? 'All done!' :
                    `Step ${this._step} of ${this._TOTAL - 1}`;
      el.innerHTML = `
        <div class="kos-setup-prog-track">
          <div class="kos-setup-prog-fill" style="width:${pct}%"></div>
        </div>
        <div class="kos-setup-prog-label">${label}</div>`;
    },

    /* ── 5. Body content ── */
    _updateBody() {
      const el = document.getElementById('kos-setup-body');
      if (!el) return;

      /* Trigger CSS entrance animation */
      el.classList.remove('kos-step-in');
      void el.offsetWidth;
      el.classList.add('kos-step-in');

      const RENDERERS = [
        '_stepWelcome',
        '_stepTerms',
        '_stepAccount',
        '_stepAppearance',
        '_stepWallpaper',
        '_stepIcons',
        '_stepDone',
      ];
      el.innerHTML = this[RENDERERS[this._step]]?.() ?? '';
      this._wire();
    },

    /* ── 6. Footer buttons ── */
    _updateFooter() {
      const el = document.getElementById('kos-setup-footer');
      if (!el) return;

      const isFirst = this._step === 0;
      const isDone  = this._step === this._TOTAL;
      const isLast  = this._step === this._TOTAL - 1;   // icons → finish

      const backHTML = (!isFirst && !isDone)
        ? `<button class="kos-setup-btn kos-setup-btn-ghost" id="ks-back">
             <i class="fa-solid fa-chevron-left"></i> Back
           </button>`
        : '<div></div>';

      const nextLabel = isFirst ? 'Get Started <i class="fa-solid fa-arrow-right"></i>'
                      : isLast  ? 'Finish <i class="fa-solid fa-check"></i>'
                      :           'Next <i class="fa-solid fa-chevron-right"></i>';

      const nextHTML = !isDone
        ? `<button class="kos-setup-btn kos-setup-btn-primary" id="ks-next"
                   ${this._step === 1 && !this._d.tosAccepted ? 'disabled' : ''}>${nextLabel}</button>`
        : '';

      el.innerHTML = backHTML + nextHTML;

      document.getElementById('ks-back')?.addEventListener('click', () => this._prev());
      document.getElementById('ks-next')?.addEventListener('click', () => this._next());
    },

    /* ══════════════════════════════════════════════════════════
       STEP RENDERERS
       ══════════════════════════════════════════════════════════ */

    /* Step 0 — Welcome */
    _stepWelcome() {
      return `
        <div class="kos-step kos-step-center">
          <div class="kos-setup-logo">KOS</div>
          <h1 class="kos-setup-h1">Welcome to<br>KOS Ultimate</h1>
          <p class="kos-setup-sub">
            Let's get you set up in a few quick steps.<br>
            Your preferences will be saved automatically.
          </p>
        </div>`;
    },

    /* Step 1 — Terms & Conditions */
    _stepTerms() {
      return `
        <div class="kos-step">
          <h2 class="kos-setup-h2">Terms &amp; Conditions</h2>
          <p class="kos-setup-sub">Please read and accept before continuing.</p>

          <div class="kos-setup-tos">
            <h4>KOS Ultimate — Terms of Use</h4>
            <p>By using KOS Ultimate 2026 ("KOS"), you agree to the following terms.
               This software is provided by Kalapurackal Studios as an educational
               and entertainment project and is made available free of charge.</p>

            <h4>1. Permitted Use</h4>
            <p>KOS is licensed for personal, non-commercial use only. You may not
               redistribute, resell, or represent this software as your own work
               without prior written permission from Kalapurackal Studios.</p>

            <h4>2. Data &amp; Privacy</h4>
            <p>All data you store within KOS — including files, settings, and
               credentials — is saved entirely within your browser's local storage
               and IndexedDB. No data is ever transmitted to any external server.
               Kalapurackal Studios does not collect, access, or retain any personal
               information from users of this software.</p>

            <h4>3. Security</h4>
            <p>The KOS login system is provided for demonstration purposes only.
               Do not store sensitive personal, financial, or confidential information
               within this environment. The built-in password mechanism is not a
               substitute for real security infrastructure.</p>

            <h4>4. Intellectual Property</h4>
            <p>All design, code, and original assets in KOS Ultimate remain the
               intellectual property of Kalapurackal Studios. Third-party assets
               (Google Fonts, Font Awesome Free) are used under their respective
               open licences.</p>

            <h4>5. Disclaimer of Warranties</h4>
            <p>KOS is provided "as is", without warranty of any kind, express or
               implied. Kalapurackal Studios accepts no liability for data loss,
               system incompatibility, browser-storage limits, or any inconvenience
               arising from use of this software.</p>

            <h4>6. Updates to These Terms</h4>
            <p>These terms may be revised with any new release of KOS Ultimate.
               Continued use of the software following an update constitutes your
               acceptance of the revised terms.</p>

            <p style="opacity:.45;font-size:.78rem;margin-top:18px">
              Last updated: May 2026 · KOS Ultimate 2026 Edition
            </p>
          </div>

          <label class="kos-setup-check-row" id="ks-tos-row">
            <div class="kos-setup-checkbox${this._d.tosAccepted ? ' checked' : ''}" id="ks-tos-box"></div>
            <span>I have read and agree to the Terms &amp; Conditions</span>
          </label>
        </div>`;
    },

    /* Step 2 — Account */
    _stepAccount() {
      return `
        <div class="kos-step">
          <h2 class="kos-setup-h2">Your Account</h2>
          <p class="kos-setup-sub">Set your display name and an optional login password.</p>

          <div class="kos-setup-form">
            <div class="kos-setup-field">
              <label class="kos-setup-label">
                Display Name <span style="color:#ff453a">*</span>
              </label>
              <input class="kos-setup-input" type="text" id="ks-username"
                     placeholder="e.g. Alex"
                     maxlength="30"
                     value="${this._escAttr(this._d.username)}"
                     autocomplete="off" spellcheck="false">
              <div class="kos-setup-field-hint">
                2–30 characters. Letters, numbers, spaces, hyphens, dots and underscores.
              </div>
            </div>

            <div class="kos-setup-field">
              <label class="kos-setup-label">
                Login Password
                <span class="kos-setup-optional">(optional — leave blank to skip)</span>
              </label>
              <input class="kos-setup-input" type="password" id="ks-password"
                     placeholder="Minimum 6 characters"
                     autocomplete="new-password">
            </div>

            <div class="kos-setup-field" id="ks-confirm-wrap"
                 style="${this._d.password ? '' : 'display:none'}">
              <label class="kos-setup-label">Confirm Password</label>
              <input class="kos-setup-input" type="password" id="ks-confirm"
                     placeholder="Re-enter your password"
                     autocomplete="new-password">
            </div>

            <div class="kos-setup-acct-err" id="ks-acct-err"></div>
          </div>
        </div>`;
    },

    /* Step 3 — Appearance */
    _stepAppearance() {
      const dark  = this._d.isDark;
      const glass = this._d.isGlass;
      return `
        <div class="kos-step">
          <h2 class="kos-setup-h2">Make It Yours</h2>
          <p class="kos-setup-sub">Choose your theme, glass effect and profile picture.</p>

          <!-- Theme cards -->
          <div class="kos-setup-appear-row">
            <div class="kos-setup-theme-opt ${!dark ? 'selected' : ''}" id="ks-theme-light">
              <div class="kos-theme-preview kos-theme-light-prev"></div>
              <span>Light</span>
            </div>
            <div class="kos-setup-theme-opt ${dark  ? 'selected' : ''}" id="ks-theme-dark">
              <div class="kos-theme-preview kos-theme-dark-prev"></div>
              <span>Dark</span>
            </div>
          </div>

          <!-- Glass toggle (reuses shell.css toggle-switch) -->
          <div class="kos-setup-toggle-row">
            <div class="kos-setup-tgl-label">
              <i class="fa-solid fa-droplet"></i>
              Glass UI
              <span class="kos-setup-tgl-sub">
                Frosted blur on windows, dock and panels
              </span>
            </div>
            <div class="toggle-switch ${glass ? 'on' : ''}" id="ks-glass-toggle">
              <div class="toggle-knob"></div>
            </div>
          </div>

          <!-- Avatar picker -->
          <div class="kos-setup-avatar-section">
            <div class="kos-setup-label" style="margin-bottom:10px">Profile Picture</div>
            <div class="kos-setup-avatar-grid" id="ks-avatar-grid">
              ${_AVATAR_PRESETS.map((src, i) => `
                <div class="kos-setup-avatar-opt ${this._d.avatarSrc === src ? 'selected' : ''}"
                     data-src="${src}" role="button" aria-label="Avatar ${i + 1}">
                  <img src="${src}" alt=""
                       onerror="this.closest('.kos-setup-avatar-opt').style.display='none'">
                </div>`).join('')}
              <label class="kos-setup-avatar-opt kos-avatar-upload"
                     title="Upload your own photo" role="button">
                <input type="file" accept="image/*"
                       id="ks-avatar-upload" hidden>
                <i class="fa-solid fa-plus"></i>
              </label>
            </div>
          </div>
        </div>`;
    },

    /* Step 4 — Wallpaper */
    _stepWallpaper() {
      return `
        <div class="kos-step">
          <h2 class="kos-setup-h2">Desktop Wallpaper</h2>
          <p class="kos-setup-sub">Choose a background for your desktop.</p>
          <div class="kos-setup-wp-grid" id="ks-wp-grid">
            ${_WALLPAPERS.map(w => {
              const bgStyle = w.url
                ? `background-image:url('${w.url}');background-color:#1c1c1e;background-size:cover;background-position:center`
                : `background:${w.css || '#2c2c2e'}`;
              return `
              <div class="kos-setup-wp-opt ${this._d.wallpaper === w.key ? 'selected' : ''}"
                   data-key="${w.key}" title="${w.label}">
                <div class="kos-setup-wp-thumb" style="${bgStyle}"></div>
                <span class="kos-setup-wp-label">${w.label}</span>
              </div>`;
            }).join('')}
          </div>
        </div>`;
    },

    /* Step 5 — Icon palette */
    _stepIcons() {
      return `
        <div class="kos-step">
          <h2 class="kos-setup-h2">Icon Style</h2>
          <p class="kos-setup-sub">Pick a colour palette for your app icons.</p>
          <div class="kos-setup-palette-grid" id="ks-palette-grid">
            ${_PALETTES.map(p => `
              <div class="kos-setup-palette-opt ${this._d.palette === p.id ? 'selected' : ''}"
                   data-id="${p.id}" role="button">
                <div class="kos-palette-swatches">
                  ${p.colors.slice(0, 6).map(c =>
                    `<div class="kos-palette-dot" style="background:${c}"></div>`).join('')}
                </div>
                <span class="kos-setup-palette-label">${p.label}</span>
              </div>`).join('')}
          </div>
        </div>`;
    },

    /* Step 6 — Done */
    _stepDone() {
      const name = this._d.username.trim() || 'there';
      return `
        <div class="kos-step kos-step-center">
          <div class="kos-setup-done-ring">
            <i class="fa-solid fa-check"></i>
          </div>
          <h1 class="kos-setup-h1">You're all set,<br>${this._escHtml(name)}!</h1>
          <p class="kos-setup-sub">
            KOS Ultimate is ready to go.<br>
            All your preferences have been saved.
          </p>
          <button class="kos-setup-btn kos-setup-btn-primary kos-setup-start-btn"
                  id="ks-start">
            Start using KOS &nbsp;<i class="fa-solid fa-arrow-right"></i>
          </button>
        </div>`;
    },

    /* ══════════════════════════════════════════════════════════
       EVENT WIRING (called after every _updateBody)
       ══════════════════════════════════════════════════════════ */
    _wire() {
      const s = this._step;

      /* ── Terms checkbox ──
         NOTE: #ks-next must be queried INSIDE the click handler, not here.
         _wire() runs from _updateBody(), which fires before _updateFooter()
         renders the button — so capturing it at wire-time always gets null. */
      if (s === 1) {
        const box = document.getElementById('ks-tos-box');
        const row = document.getElementById('ks-tos-row');
        row?.addEventListener('click', () => {
          const on   = !box.classList.contains('checked');
          box.classList.toggle('checked', on);
          this._d.tosAccepted = on;             // persist so Back → step 1 restores state
          const next = document.getElementById('ks-next'); // query at click-time
          if (next) next.disabled = !on;
        });
      }

      /* ── Account inputs live-sync ── */
      if (s === 2) {
        const uEl   = document.getElementById('ks-username');
        const pwEl  = document.getElementById('ks-password');
        const cfEl  = document.getElementById('ks-confirm');
        const cfWrap= document.getElementById('ks-confirm-wrap');

        uEl?.addEventListener('input',  e  => { this._d.username = e.target.value; });
        pwEl?.addEventListener('input', e  => {
          this._d.password = e.target.value;
          if (cfWrap) cfWrap.style.display = e.target.value.length ? '' : 'none';
        });
        cfEl?.addEventListener('input', e  => { this._d.confirm  = e.target.value; });
      }

      /* ── Appearance: theme + glass + avatar ── */
      if (s === 3) {
        document.getElementById('ks-theme-light')?.addEventListener('click', () => {
          this._d.isDark = false;
          document.querySelectorAll('.kos-setup-theme-opt')
                  .forEach(el => el.classList.remove('selected'));
          document.getElementById('ks-theme-light')?.classList.add('selected');
          document.body.classList.remove('dark');   /* live preview */
        });
        document.getElementById('ks-theme-dark')?.addEventListener('click', () => {
          this._d.isDark = true;
          document.querySelectorAll('.kos-setup-theme-opt')
                  .forEach(el => el.classList.remove('selected'));
          document.getElementById('ks-theme-dark')?.classList.add('selected');
          document.body.classList.add('dark');      /* live preview */
        });

        const glassToggle = document.getElementById('ks-glass-toggle');
        glassToggle?.addEventListener('click', function () {
          const on = !this.classList.contains('on');
          this.classList.toggle('on', on);
          KOSSetup._d.isGlass = on;
          /* live preview */
          document.body.classList.toggle('no-glass', !on);
        });

        /* Preset avatar clicks */
        document.querySelectorAll('#ks-avatar-grid .kos-setup-avatar-opt[data-src]')
                .forEach(opt => opt.addEventListener('click', () => {
                  document.querySelectorAll('#ks-avatar-grid .kos-setup-avatar-opt')
                          .forEach(o => o.classList.remove('selected'));
                  opt.classList.add('selected');
                  this._d.avatarSrc = opt.dataset.src;
                }));

        /* Upload avatar */
        document.getElementById('ks-avatar-upload')
                ?.addEventListener('change', e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = ev => {
                    this._d.avatarSrc = ev.target.result;
                    document.querySelectorAll('#ks-avatar-grid .kos-setup-avatar-opt')
                            .forEach(o => o.classList.remove('selected'));
                    document.querySelector('.kos-avatar-upload')
                            ?.classList.add('selected');
                  };
                  reader.readAsDataURL(file);
                });
      }

      /* ── Wallpaper selection ── */
      if (s === 4) {
        document.querySelectorAll('#ks-wp-grid .kos-setup-wp-opt')
                .forEach(opt => opt.addEventListener('click', () => {
                  document.querySelectorAll('#ks-wp-grid .kos-setup-wp-opt')
                          .forEach(o => o.classList.remove('selected'));
                  opt.classList.add('selected');
                  this._d.wallpaper = opt.dataset.key;
                }));
      }

      /* ── Palette selection (+ live preview) ── */
      if (s === 5) {
        document.querySelectorAll('#ks-palette-grid .kos-setup-palette-opt')
                .forEach(opt => opt.addEventListener('click', () => {
                  document.querySelectorAll('#ks-palette-grid .kos-setup-palette-opt')
                          .forEach(o => o.classList.remove('selected'));
                  opt.classList.add('selected');
                  this._d.palette = opt.dataset.id;
                  /* Live-preview palette on icons behind the overlay */
                  if (typeof applyIconPalette === 'function') {
                    applyIconPalette(opt.dataset.id);
                  }
                }));
      }

      /* ── Done: launch button ── */
      if (s === 6) {
        document.getElementById('ks-start')
                ?.addEventListener('click', () => this._launch());
      }
    },

    /* ══════════════════════════════════════════════════════════
       NAVIGATION
       ══════════════════════════════════════════════════════════ */

    _next() {
      if (!this._validate()) return;

      /* Moving from icons (5) to done (6): apply everything first */
      if (this._step === 5) this._applyAll();

      this._go(this._step + 1);
    },

    _prev() {
      if (this._step > 0) this._go(this._step - 1);
    },

    /* ══════════════════════════════════════════════════════════
       VALIDATION
       ══════════════════════════════════════════════════════════ */

    _validate() {
      /* Terms — checkbox required */
      if (this._step === 1) {
        return !!document.getElementById('ks-tos-box')?.classList.contains('checked');
      }

      /* Account — username required; passwords must match */
      if (this._step === 2) {
        const uname = document.getElementById('ks-username')?.value.trim() ?? '';
        const pw    = document.getElementById('ks-password')?.value ?? '';
        const conf  = document.getElementById('ks-confirm')?.value  ?? '';
        const err   = document.getElementById('ks-acct-err');

        const _err = msg => { if (err) err.textContent = msg; return false; };

        this._d.username = uname;
        this._d.password = pw;
        this._d.confirm  = conf;

        if (uname.length < 2)  return _err('Display name must be at least 2 characters.');
        if (uname.length > 30) return _err('Display name must be 30 characters or fewer.');
        if (!/^[a-zA-Z0-9 _.‑-]+$/.test(uname))
          return _err('Only letters, numbers, spaces, hyphens, dots and underscores allowed.');
        if (pw && pw.length < 6)
          return _err('Password must be at least 6 characters.');
        if (pw && pw !== conf)
          return _err('Passwords do not match.');

        if (err) err.textContent = '';
        return true;
      }

      return true;
    },

    /* ══════════════════════════════════════════════════════════
       APPLY ALL SETTINGS
       ══════════════════════════════════════════════════════════ */

    _applyAll() {
      const d = this._d;

      /* 1. Theme ───────────────────────────────────────────────── */
      const hasDark  = document.body.classList.contains('dark');
      if (d.isDark !== hasDark) {
        /* Prefer the kernel's toggleTheme() for consistent side-effects */
        if (typeof toggleTheme === 'function') toggleTheme();
        else document.body.classList.toggle('dark', d.isDark);
      }
      localStorage.setItem('kos-theme', d.isDark ? 'dark' : 'light');

      /* 2. Glass ───────────────────────────────────────────────── */
      const hasGlass = !document.body.classList.contains('no-glass');
      if (d.isGlass !== hasGlass) {
        if (typeof toggleGlass === 'function') toggleGlass();
        else document.body.classList.toggle('no-glass', !d.isGlass);
      }
      localStorage.setItem('kos-glass', d.isGlass ? 'on' : 'off');

      /* 3. Password ────────────────────────────────────────────── */
      if (d.password) {
        /* Set both keys to keep terminal.js and ui-manager.js in sync */
        localStorage.setItem('kos_login_password', d.password);
        localStorage.setItem('kos-password',       d.password);
        localStorage.removeItem('kos-no-password');
      }

      /* 4. Avatar ──────────────────────────────────────────────── */
      if (d.avatarSrc) {
        if (typeof applyAvatar === 'function') {
          applyAvatar(d.avatarSrc);
        } else {
          /* Fallback: update login avatar directly */
          const av = document.getElementById('loginAvatar');
          if (av) av.src = d.avatarSrc;
          localStorage.setItem('kos-avatar', d.avatarSrc);
        }
      }

      /* 5. Wallpaper ───────────────────────────────────────────── */
      if (typeof selectWallpaper === 'function') {
        selectWallpaper(d.wallpaper);
      } else {
        localStorage.setItem('kos-wallpaper', d.wallpaper);
        if (typeof applyWallpaper === 'function') applyWallpaper(d.wallpaper);
      }

      /* 6. Icon palette ────────────────────────────────────────── */
      if (typeof applyIconPalette === 'function') applyIconPalette(d.palette);
      localStorage.setItem('kos-icon-palette', d.palette);

      /* 7. Username (async — non-blocking) ─────────────────────── */
      KOSUser.setUsername(d.username.trim() || 'Developer')
             .catch(e => console.warn('[KOSSetup] Username save failed:', e));

      /* 8. Mark setup complete ─────────────────────────────────── */
      localStorage.setItem(_SETUP_KEY, '1');
    },

    /* ══════════════════════════════════════════════════════════
       LAUNCH → DESKTOP
       ══════════════════════════════════════════════════════════ */

    _launch() {
      /* Fade out the setup card */
      const card = document.getElementById('kos-setup-card');
      if (card) {
        card.style.transition = 'opacity 0.45s ease, transform 0.45s ease';
        card.style.opacity    = '0';
        card.style.transform  = 'scale(0.96) translateY(8px)';
      }

      setTimeout(() => {
        /*
         * The KOS "desktop" is not a .screen element — it is the body
         * wallpaper rendered behind all the fixed overlays. Clearing
         * .active from every .screen element is all that is needed to
         * reveal it. Do NOT try getElementById('screen-desktop'); that
         * element does not exist and chasing it caused the black screen.
         */
        document.querySelectorAll('.screen')
                .forEach(s => s.classList.remove('active'));

        /* Let the kernel restore any previously saved app windows.
           On genuine first boot this is a no-op (empty session). */
        try { window.WM?.restoreSession?.(); } catch (_) {}

        /* Notify any listeners that a login just succeeded. */
        try {
          KOSBus?.dispatch('kos:login', { source: 'kos-setup', skipPassword: true });
        } catch (_) {}
      }, 450);
    },

    /* ══════════════════════════════════════════════════════════
       SMALL UTILITIES
       ══════════════════════════════════════════════════════════ */

    _escHtml(s) {
      return String(s)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    },

    _escAttr(s) { return this._escHtml(s); },
  };

  global.KOSSetup = KOSSetup;

  /* ══════════════════════════════════════════════════════════════
     §4  ENTRY POINT
     ══════════════════════════════════════════════════════════════ */

  /* A — Always hydrate .login-username from IDB on every boot */
  KOSUser.applyOnBoot().catch(() => {});

  /* B — Only run the wizard on the very first visit */
  if (!localStorage.getItem(_SETUP_KEY)) {

    /*
     * Strategy: wait for #screen-login to become active (the kernel adds
     * the 'active' class when boot completes). At that moment intercept it:
     * remove 'active' from login and add it to #screen-setup instead.
     * MutationObserver is used so this works regardless of when the kernel
     * fires, without any changes to kos-init.js.
     */
    function _bootHook() {
      const loginEl = document.getElementById('screen-login');
      if (!loginEl) {
        /* DOM not ready yet (edge case) — retry after a tick */
        setTimeout(_bootHook, 50);
        return;
      }

      /* Handle the edge case where login is already active before we ran */
      if (loginEl.classList.contains('active')) {
        loginEl.classList.remove('active');
        KOSSetup.init();
        return;
      }

      const obs = new MutationObserver(() => {
        if (loginEl.classList.contains('active') && !localStorage.getItem(_SETUP_KEY)) {
          loginEl.classList.remove('active');
          KOSSetup.init();
          obs.disconnect();
        }
      });
      obs.observe(loginEl, { attributes: true, attributeFilter: ['class'] });
    }

    /* Run after DOM is ready */
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _bootHook);
    } else {
      _bootHook();
    }
  }

})(window);
