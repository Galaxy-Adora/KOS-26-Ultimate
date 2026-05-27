/* ══════════════════════════════════════════════════════════════
   KOS ULTIMATE 2026 — kos-init.js (Merged + Optimised)
   ══════════════════════════════════════════════════════════════ */

let _spotlightOverlay = null;
let _spotlightInput   = null;
let _spotlightGrid    = null;
let _filterRaf        = null;

// --- FIRST BOOT AUTO-OPEN ---
if (!localStorage.getItem('kos_first_boot_complete')) {
    if (typeof WM !== 'undefined' && typeof WM.launch === 'function') {
        WM.launch('releasenotes');
        localStorage.setItem('kos_first_boot_complete', 'true');
        if (typeof showToast === 'function') {
            showToast('Welcome to KOS Ultimate 2026!');
        }
    }
}

/* ─── Spotlight ─── */
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

/* ─── Dock ─── */
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

    container.insertAdjacentElement('afterend', runSep);
    runSep.insertAdjacentElement('afterend', runContainer);
  } else {
    runContainer.innerHTML = '';
    runSep.style.display = 'none';
  }

  if (window.WM && WM.registry) {
    Object.entries(WM.registry).forEach(([appId, state]) => {
      if (state.open) _setRunning(appId, true);
    });
  }
}

const _dockEl = document.getElementById('dock');

function _isPinned(appId) {
  return AppManifest.some(a => a.id === appId && a.metadata.showInDock);
}

function _setRunning(appId, isRunning) {
  const dockApps = document.getElementById('dock-apps');
  const pinnedItem = dockApps?.querySelector(`.dock-item[data-app-id="${appId}"]`);
  if (pinnedItem) {
    pinnedItem.classList.toggle('dock-running', isRunning);
    return;
  }

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

/* ─── Global event listeners ─── */
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

KOSBus.on('kos:registry-changed', () => {
  buildSpotlightGrid();
  renderDock();
});

KOSBus.on('kos:request-spotlight-close', () => closeSpotlight());

KOSBus.on('kos:windows-visible-changed', e => {
  if (!_dockEl) return;
  const dockHidden = e.detail.hasVisible;
  _dockEl.classList.toggle('dock-hidden', dockHidden);
  _setSpotlightClearance(dockHidden);
});

KOSBus.on('kos:app-opened',    e => _setRunning(e.detail.appId, true));
KOSBus.on('kos:app-restored',  e => _setRunning(e.detail.appId, true));
KOSBus.on('kos:app-minimized', e => _setRunning(e.detail.appId, true));
KOSBus.on('kos:app-closed',    e => _setRunning(e.detail.appId, false));

/* ─── Boot Orchestrator ─── */
(async function init() {

  /* 1. Apply display settings once — prevents flash of unstyled content */
  if (typeof KOSDisplay !== 'undefined') KOSDisplay.apply();
  /* REMOVED: duplicate KOSDisplay.apply() call that followed step 1b */

  /* 2. Initialise KOSFS kernel filesystem */
  if (typeof KOSFS !== 'undefined') {
    try { await KOSFS.init(); }
    catch (e) { console.error('[KOS Boot] KOSFS.init() failed:', e); }
  }

  /* 3. Restore persisted user preferences */
  applyWallpaper(localStorage.getItem(KEY_WALLPAPER));
  applyAvatar(localStorage.getItem(KEY_AVATAR));
  applyIconPalette(getCurrentPaletteId());

  /* 4. Restore Studio-published custom apps */
  KOSStudio.restorePublished();

  /* 5. Build dock and spotlight from manifest */
  renderDock();
  buildSpotlightGrid();

  /* 6. Set initial spotlight clearance — dock visible at boot */
  _setSpotlightClearance(false);

  /* 7. Restore previous session windows */
  WM.restoreSession();

  /* REMOVED: the dead getSysOverrides() + empty forEach block that was here.
     System overrides are applied lazily per-app inside WM.open(), so
     iterating the override map at boot time served no purpose. */

})();

/* ─── Screen HTML Patch ─── */
(function patchScreenHTML() {

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

  const loginScreen = document.getElementById('screen-login');
  if (loginScreen) {

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

    const inputWrap = loginScreen.querySelector('.login-input-wrap');
    if (inputWrap && !inputWrap.querySelector('.login-arrow-btn')) {
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
        const signIn = loginScreen.querySelector('.pill-btn.signin');
        if (signIn) signIn.click();
      });
      inputWrap.appendChild(arrowBtn);
    }

    if (!loginScreen.querySelector('.login-bottom-bar')) {
      const otherBtns = [...loginScreen.querySelectorAll('.pill-btn:not(.signin)')];

      const sysBtnHTML = otherBtns.map((btn, i) =>
        `<button class="login-sys-btn" data-proxy-idx="${i}"
                 title="${btn.title || btn.textContent.trim()}">
           ${btn.innerHTML}
         </button>`
      ).join('');

      const bar = document.createElement('div');
      bar.className = 'login-bottom-bar';
      bar.innerHTML = `
        <div class="login-bottom-left"></div>
        <div class="login-bottom-right">${sysBtnHTML}</div>`;

      loginScreen.appendChild(bar);

      bar.querySelectorAll('.login-sys-btn[data-proxy-idx]').forEach(sb => {
        const idx = parseInt(sb.dataset.proxyIdx, 10);
        sb.addEventListener('click', () => otherBtns[idx]?.click());
      });
    }

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

  const sleep = document.getElementById('screen-sleep');
  if (sleep) {
    sleep.innerHTML = `
      <span class="sleep-label">Sleep</span>
      <span class="sleep-hint">Click anywhere to wake</span>`;
  }

  const restart = document.getElementById('screen-restart');
  if (restart) {
    restart.innerHTML = `
      <div class="restart-spinner"></div>
      <span class="restart-label">Restarting</span>`;
  }

  const shutdown = document.getElementById('screen-shutdown');
  if (shutdown) {
    shutdown.innerHTML = `
      <div class="shutdown-ring"></div>
      <span class="shutdown-label">Shutting down</span>`;
  }

})();
