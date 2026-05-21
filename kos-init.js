/* ══════════════════════════════════════════════════════════════
   KOS ULTIMATE 2026 — kos-init.js (Merged + Optimised)
   Includes: Boot Orchestrator, Spotlight Search, and Dock Module.
   ══════════════════════════════════════════════════════════════ */

/* ─── Cached element refs (populated once on first use) ─── */
let _spotlightOverlay = null;
let _spotlightInput   = null;
let _spotlightGrid    = null;
let _filterRaf        = null;   /* rAF handle for debounced filter */

/* ─── Spotlight Search Logic ─── */
function buildSpotlightGrid() {
  if (!_spotlightGrid) _spotlightGrid = document.getElementById('spotlight-grid');
  const grid = _spotlightGrid;
  if (!grid) return;
  grid.innerHTML = '';

  AppManifest
    .filter(a => a.metadata.searchable)
    .forEach(app => {
      const div = document.createElement('div');
      div.className = 'spotlight-app';
      div.dataset.appName = app.name.toLowerCase();
      div.innerHTML = `${buildAppIcon(app)}<span>${app.name}</span>`;
      div.addEventListener('click', () => {
        closeSpotlight();
        WM.launch(app.id);
      });
      grid.appendChild(div);
    });
}

function openSpotlight() {
  closeAllDropdowns();
  if (!_spotlightOverlay) _spotlightOverlay = document.getElementById('spotlight-overlay');
  _spotlightOverlay?.classList.add('active');
  if (!_spotlightInput) _spotlightInput = document.getElementById('spotlight-input');
  setTimeout(() => _spotlightInput?.focus(), 80);
}

function closeSpotlight() {
  if (!_spotlightOverlay) _spotlightOverlay = document.getElementById('spotlight-overlay');
  _spotlightOverlay?.classList.remove('active');
  if (!_spotlightInput) _spotlightInput = document.getElementById('spotlight-input');
  if (_spotlightInput) _spotlightInput.value = '';
  filterSpotlight('');
}

function handleSpotlightBackdrop(e) {
  if (!_spotlightOverlay) _spotlightOverlay = document.getElementById('spotlight-overlay');
  if (e.target === _spotlightOverlay) closeSpotlight();
}

/* filterSpotlight is called on every keystroke.
   Debounce via rAF: if another key comes before the next paint,
   cancel the pending frame and reschedule — avoids redundant DOM walks. */
function filterSpotlight(query) {
  if (_filterRaf) cancelAnimationFrame(_filterRaf);
  _filterRaf = requestAnimationFrame(() => {
    _filterRaf = null;
    const q = query.toLowerCase().trim();
    if (!_spotlightGrid) _spotlightGrid = document.getElementById('spotlight-grid');
    if (!_spotlightGrid) return;
    _spotlightGrid.querySelectorAll('.spotlight-app').forEach(el => {
      el.classList.toggle('hidden', !!(q && !el.dataset.appName.includes(q)));
    });
  });
}

/* ─── Dock Module Logic ───────────────────────────────────────
   Fully decoupled from the Window Manager.
   To change ANY dock behaviour, only edit this section.

   LISTENS TO:
     kos:app-opened              → marks icon as running
     kos:app-closed              → removes running indicator
     kos:app-minimized           → keeps running indicator
     kos:app-restored            → marks as running
     kos:windows-visible-changed → auto-hide logic
     kos:registry-changed        → full dock rebuild (Studio publish)
     kos:request-spotlight-close → close spotlight (forwarded from WM)
   ─────────────────────────────────────────────────────────────── */
function renderDock() {
  const container = document.getElementById('dock-apps');
  if (!container) return;
  container.innerHTML = '';
  container.style.cssText = 'display:flex;align-items:flex-end;gap:10px;';

  AppManifest
    .filter(a => a.metadata.showInDock)
    .forEach(app => {
      const div = document.createElement('div');
      div.className = 'dock-item';
      div.dataset.appId = app.id;
      div.title = app.name;
      div.innerHTML = `${buildAppIcon(app)}<span class="dock-label">${app.name}</span>`;
      div.addEventListener('click', () => WM.launch(app.id));
      container.appendChild(div);
    });

  /* ── Running-apps section ─────────────────────────────────────
     Shows icons of apps that are open but NOT pinned to the dock.
     Created once; subsequent renderDock calls clear it and re-sync
     from WM.registry so running state is never lost on rebuild.
  ─────────────────────────────────────────────────────────────── */
  let runSep = document.getElementById('dock-running-sep');
  let runContainer = document.getElementById('dock-running-apps');

  if (!runContainer) {
    runSep = document.createElement('div');
    runSep.className = 'dock-separator';
    runSep.id = 'dock-running-sep';
    runSep.style.display = 'none';

    runContainer = document.createElement('div');
    runContainer.id = 'dock-running-apps';
    runContainer.style.cssText = 'display:flex;align-items:flex-end;gap:10px;';

    /* Insert right after #dock-apps, before any existing separator/spotlight */
    container.insertAdjacentElement('afterend', runSep);
    runSep.insertAdjacentElement('afterend', runContainer);
  } else {
    runContainer.innerHTML = '';
    runSep.style.display = 'none';
  }

  /* Re-sync open apps from WM registry after a manifest rebuild */
  if (window.WM && WM.registry) {
    Object.entries(WM.registry).forEach(([appId, state]) => {
      if (state.open) _setRunning(appId, true);
    });
  }
}

const _dockEl = document.getElementById('dock');

/** Helper: is this appId pinned in the dock manifest? */
function _isPinned(appId) {
  return AppManifest.some(a => a.id === appId && a.metadata.showInDock);
}

/**
 * _setRunning(appId, isRunning)
 *
 * • Pinned apps   → toggle .dock-running on their existing #dock-apps item.
 * • Non-pinned    → add / remove a temporary item in #dock-running-apps.
 *   The separator (#dock-running-sep) is shown only when the section is non-empty.
 */
function _setRunning(appId, isRunning) {
  /* Cache the dock-apps container reference */
  const dockApps = document.getElementById('dock-apps');
  const pinnedItem = dockApps?.querySelector(`.dock-item[data-app-id="${appId}"]`);
  if (pinnedItem) {
    pinnedItem.classList.toggle('dock-running', isRunning);
    return;
  }

  /* --- Non-pinned: dynamic running section --- */
  const runContainer = document.getElementById('dock-running-apps');
  const runSep       = document.getElementById('dock-running-sep');
  if (!runContainer) return;

  const existing = runContainer.querySelector(`.dock-item[data-app-id="${appId}"]`);

  if (isRunning && !existing) {
    const app = AppManifest.find(a => a.id === appId);
    if (!app) return;

    const div = document.createElement('div');
    div.className = 'dock-item dock-running';
    div.dataset.appId = appId;
    div.title = app.name;
    div.innerHTML = `${buildAppIcon(app)}<span class="dock-label">${app.name}</span>`;
    div.addEventListener('click', () => WM.launch(app.id));
    runContainer.appendChild(div);

    if (runSep) runSep.style.display = '';
  } else if (!isRunning && existing) {
    existing.remove();
    if (runSep && runContainer.children.length === 0) runSep.style.display = 'none';
  }
}

/* ─── Global Event Listeners ─── */
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSpotlight(); }, { passive: true });

function _setSpotlightClearance(dockIsHidden) {
  document.documentElement.style.setProperty(
    '--spotlight-dock-clearance',
    dockIsHidden ? '20px' : '100px'
  );
}

document.getElementById('dock-trigger-zone')?.addEventListener('mouseenter', () => {
  _dockEl?.classList.remove('dock-hidden');
  _setSpotlightClearance(false);
}, { passive: true });

_dockEl?.addEventListener('mouseleave', () => {
  const hasVisible = Object.values(WM.registry).some(w => w.open && !w.minimized);
  if (hasVisible) {
    _dockEl.classList.add('dock-hidden');
    _setSpotlightClearance(true);
  }
}, { passive: true });

/* Event Bus listeners */
KOSBus.on('kos:registry-changed', () => {
  buildSpotlightGrid();
  renderDock();
});

KOSBus.on('kos:request-spotlight-close', () => closeSpotlight());

KOSBus.on('kos:windows-visible-changed', e => {
  if (!_dockEl) return;
  const dockHidden = e.detail.hasVisible;
  _dockEl.classList.toggle('dock-hidden', dockHidden);
  _setSpotlightClearance(dockHidden);  /* keep spotlight panel in sync */
});

KOSBus.on('kos:app-opened',    e => _setRunning(e.detail.appId, true));
KOSBus.on('kos:app-restored',  e => _setRunning(e.detail.appId, true));
KOSBus.on('kos:app-minimized', e => _setRunning(e.detail.appId, true));
KOSBus.on('kos:app-closed',    e => _setRunning(e.detail.appId, false));

/* ─── Boot Orchestrator ─── */
(function init() {
  /* 1. Restore persisted user preferences */
  applyWallpaper(localStorage.getItem(KEY_WALLPAPER));
  applyAvatar(localStorage.getItem(KEY_AVATAR));
  applyIconPalette(getCurrentPaletteId());

  /* 2. Apply any saved CSS/JS overrides */
  const overrideMap = getSysOverrides();
  Object.keys(overrideMap).forEach(appId => {
    /* Overrides are applied lazily on open via WM.open() */
  });

  /* 3. Restore any apps published via KOS Studio */
  KOSStudio.restorePublished();

  /* 4. Build Dock from manifest */
  renderDock();

  /* 5. Build Spotlight grid from manifest */
  buildSpotlightGrid();

  /* 6. Set initial spotlight clearance — dock is visible at boot */
  _setSpotlightClearance(false);

  /* 7. Restore previous session
     FIX #9: this call was missing entirely — the comment existed but no code
     ran, meaning windows, positions, and maximized state were never restored
     across page loads. */
  WM.restoreSession();
})();

/* ─── Screen HTML Patch ──────────────────────────────────────────
   Injects pure-CSS markup for boot / sleep / restart / shutdown,
   and rebuilds the login screen DOM with a live clock block.
   ─────────────────────────────────────────────────────────────── */
(function patchScreenHTML() {

  /* ── Boot ── */
  const boot = document.getElementById('screen-boot');
  if (boot) {
    boot.innerHTML = `
      <span class="boot-studio-name">Kalapurackal Studios</span>
      <span class="boot-wordmark">KOS Ultimate</span>
      <span class="boot-tagline">Starting up</span>
      <div class="boot-progress-track">
        <div class="boot-progress-fill"></div>
      </div>`;
  }

  /* ── Login — Win11 style rebuild ──────────────────────────────
     Reshapes the existing DOM without destroying onclick handlers.
     Strategy:
       1. Wrap clock + card in .login-center-col.
       2. Add .login-arrow-btn to .login-input-wrap (proxies signin).
       3. Inject .login-bottom-bar (system buttons proxy pill-btn clicks).
     The original .login-actions pill-btns remain in the DOM (hidden by
     CSS) so any login.js onclick bindings continue to work unchanged.
  ─────────────────────────────────────────────────────────────── */
  const loginScreen = document.getElementById('screen-login');
  if (loginScreen) {

    /* ── 1. Build center column wrapper (once only) ── */
    if (!loginScreen.querySelector('.login-center-col')) {
      const card = loginScreen.querySelector('.login-card');

      const clockWrap = document.createElement('div');
      clockWrap.className = 'login-clock-wrap';
      clockWrap.innerHTML = `
        <div class="login-time" id="login-clock-time"></div>
        <div class="login-date" id="login-clock-date"></div>`;

      const centerCol = document.createElement('div');
      centerCol.className = 'login-center-col';

      if (card) {
        loginScreen.insertBefore(centerCol, card);
        centerCol.appendChild(clockWrap);
        centerCol.appendChild(card);
      } else {
        loginScreen.appendChild(centerCol);
        centerCol.appendChild(clockWrap);
      }
    }

    /* ── 2. Inject arrow submit button into the input row ── */
    const inputWrap = loginScreen.querySelector('.login-input-wrap');
    if (inputWrap && !inputWrap.querySelector('.login-arrow-btn')) {
      /* Enter key on the field fires the arrow button */
      const field = inputWrap.querySelector('.login-input');
      if (field) {
        field.addEventListener('keydown', e => {
          if (e.key === 'Enter') inputWrap.querySelector('.login-arrow-btn')?.click();
        });
      }

      const arrowBtn = document.createElement('button');
      arrowBtn.className = 'login-arrow-btn';
      arrowBtn.title = 'Sign in';
      arrowBtn.innerHTML = '<i class="fa-solid fa-arrow-right"></i>';
      arrowBtn.addEventListener('click', () => {
        /* Proxy to the hidden .pill-btn.signin so existing login JS fires */
        const signIn = loginScreen.querySelector('.pill-btn.signin');
        if (signIn) signIn.click();
      });
      inputWrap.appendChild(arrowBtn);
    }

    /* ── 3. Build bottom system bar (once only) ── */
    if (!loginScreen.querySelector('.login-bottom-bar')) {
      /* Collect non-signin pill-btns and proxy them as system buttons */
      const otherBtns = [
        ...loginScreen.querySelectorAll('.pill-btn:not(.signin)')
      ];

      const sysBtnHTML = otherBtns.map((btn, i) =>
        `<button class="login-sys-btn" data-proxy-idx="${i}"
                 title="${btn.title || btn.textContent.trim()}">
           ${btn.innerHTML}
         </button>`
      ).join('');

      const bar = document.createElement('div');
      bar.className = 'login-bottom-bar';
      bar.innerHTML = `
        <div class="login-bottom-left">
         
        </div>
        <div class="login-bottom-right">
        
          </button>
          ${sysBtnHTML}
        </div>`;

      loginScreen.appendChild(bar);

      /* Wire proxy clicks after inserting into DOM */
      bar.querySelectorAll('.login-sys-btn[data-proxy-idx]').forEach(sb => {
        const idx = parseInt(sb.dataset.proxyIdx, 10);
        sb.addEventListener('click', () => otherBtns[idx]?.click());
      });
    }

    /* ── 4. Live clock — updates every second ──
       Arrays hoisted out of the tick function so they are allocated once.
       Element refs cached; guard prevents double-interval if patch runs twice. */
    if (!loginScreen.dataset.clockInit) {
      loginScreen.dataset.clockInit = '1';
      const _LC_DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      const _LC_MONTHS = ['January','February','March','April','May','June',
                          'July','August','September','October','November','December'];
      const _lcTime = document.getElementById('login-clock-time');
      const _lcDate = document.getElementById('login-clock-date');

      function _tickClock() {
        if (!_lcTime || !_lcDate) return;
        const now = new Date();
        const hh  = now.getHours();
        const mm  = now.getMinutes();
        const h12 = hh % 12 || 12;
        _lcTime.textContent = h12 + ':' + (mm < 10 ? '0' : '') + mm;
        _lcDate.textContent = _LC_DAYS[now.getDay()] + ', ' +
          _LC_MONTHS[now.getMonth()] + ' ' + now.getDate();
      }
      _tickClock();
      setInterval(_tickClock, 1000);
    }
  }

  /* ── Sleep ── */
  const sleep = document.getElementById('screen-sleep');
  if (sleep) {
    sleep.innerHTML = `
      <span class="sleep-label">Sleep</span>
      <span class="sleep-hint">Click anywhere to wake</span>`;
  }

  /* ── Restart ── */
  const restart = document.getElementById('screen-restart');
  if (restart) {
    restart.innerHTML = `
      <div class="restart-spinner"></div>
      <span class="restart-label">Restarting</span>`;
  }

  /* ── Shutdown ── */
  const shutdown = document.getElementById('screen-shutdown');
  if (shutdown) {
    shutdown.innerHTML = `
      <div class="shutdown-ring"></div>
      <span class="shutdown-label">Shutting down</span>`;
  }

})();

/* ─── Login Password Patch ───────────────────────────────────────
   Wraps the global attemptLogin() (defined in kos-kernel.js) to
   support a user-defined password persisted in localStorage.

   Behaviour:
   • If no custom password has ever been saved → falls through to
     the original kernel logic unchanged (default KOS login).
   • If a custom password exists → validates against it here and
     transitions to the desktop on success, shows an inline error
     on failure.  The original kernel function is NOT called in
     this branch so there is no double-check.
─────────────────────────────────────────────────────────────────── */
(function patchLoginPassword() {
  /* Key shared with UI Manager — do not change without updating both files */
  const KOS_PW_KEY = 'kos_login_password';

  /* Grab the original before we overwrite it */
  const _origLogin = window.attemptLogin;

  window.attemptLogin = function () {
    const stored = localStorage.getItem(KOS_PW_KEY);

    /* ── No custom password saved → original kernel handles it ── */
    if (stored === null) return _origLogin && _origLogin();

    const box  = document.getElementById('passwordBox');
    const err  = document.getElementById('loginError');
    const card = document.querySelector('.login-card');
    if (!box) return;

    if (box.value === stored) {
      /* ✓ Correct — clear field, remove any error, go to desktop */
      box.value = '';
      if (err) err.textContent = '';
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      document.getElementById('screen-desktop')?.classList.add('active');
    } else {
      /* ✗ Wrong — show error and shake the card */
      if (err) err.textContent = 'Incorrect password. Please try again.';
      box.value = '';
      box.focus();
      if (card) {
        card.classList.remove('login-shake');
        void card.offsetWidth;          /* force reflow to restart animation */
        card.classList.add('login-shake');
      }
    }
  };
})();