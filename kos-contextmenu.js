/* ══════════════════════════════════════════════════════════════
   KOS ULTIMATE 2026 — kos-contextmenu.js
   Right-click context menu system.
   ══════════════════════════════════════════════════════════════ */

const KOSContextMenu = (() => {

  let _menuEl   = null;
  let _appMenus = {};
  let _zoneRegs = [];

  const BLOCKED = [
    '#screen-boot',
    '#screen-login',
    '#screen-shutdown',
    '#screen-restart',
    '#screen-sleep',
    '#dock',
    '#dock-trigger-zone',
    '#spotlight-overlay',
  ];

  const BUILT_IN_ZONES = [
    { selector: '.topbar',  build: _buildTopbarMenu  },
    { selector: '.desktop', build: _buildDesktopMenu },
  ];

  /* ── Desktop menu ── */
  function _buildDesktopMenu() {
    return [
      { type: 'label', label: 'Desktop' },
      {
        label  : 'Change Wallpaper',
        icon   : 'fa-image',
        /* corrected: 'uimanager' is the Settings app id */
        action : () => WM.launch('uimanager'),
      },
      {
        label  : 'New Folder',
        icon   : 'fa-folder-plus',
        action : () => KOSBus.dispatch('kos:desktop-new-folder', {}),
      },
      {
        label  : 'Sort Icons',
        icon   : 'fa-arrow-up-a-z',
        sub    : [
          { label: 'By Name', icon: 'fa-font',       action: () => KOSBus.dispatch('kos:sort-icons', { by: 'name' }) },
          { label: 'By Date', icon: 'fa-calendar',    action: () => KOSBus.dispatch('kos:sort-icons', { by: 'date' }) },
          { label: 'By Kind', icon: 'fa-layer-group', action: () => KOSBus.dispatch('kos:sort-icons', { by: 'kind' }) },
        ],
      },
      {
        label  : 'Refresh',
        icon   : 'fa-rotate-right',
        shortcut: 'F5',
        action : () => KOSBus.dispatch('kos:desktop-refresh', {}),
      },
      { type: 'sep' },
      {
        label  : 'Display Settings',
        icon   : 'fa-display',
        /* corrected: navigate directly to the settings app (display section opens on click inside) */
        action : () => WM.launch('uimanager'),
      },
      { type: 'sep' },
      {
        label  : 'About KOS',
        icon   : 'fa-circle-info',
        action : () => WM.launch('about'),
      },
    ];
  }

  /* ── Topbar menu ── */
  function _buildTopbarMenu() {
    return [
      { type: 'label', label: 'System' },
      {
        label  : 'Open Spotlight',
        icon   : 'fa-magnifying-glass',
        shortcut: '⌘Space',
        action : () => {
          if (typeof openSpotlight === 'function') openSpotlight();
        },
      },
      { type: 'sep' },
      {
        label  : 'System Preferences',
        icon   : 'fa-sliders',
        /* corrected: 'uimanager' not 'settings' */
        action : () => WM.launch('uimanager'),
      },
      {
        label  : 'About This System',
        icon   : 'fa-circle-info',
        action : () => WM.launch('about'),
      },
      { type: 'sep' },
      {
        label  : 'Sleep',
        icon   : 'fa-moon',
        shortcut: '⌘L',
        /* corrected: call the actual kernel power function directly */
        action : () => typeof triggerSleep === 'function' && triggerSleep(),
      },
      { type: 'sep' },
      {
        label  : 'Restart',
        icon   : 'fa-rotate-right',
        /* corrected: call the actual kernel power function directly */
        action : () => typeof triggerRestart === 'function' && triggerRestart(),
      },
      {
        label  : 'Shut Down…',
        icon   : 'fa-power-off',
        variant: 'danger',
        /* corrected: call the actual kernel power function directly */
        action : () => typeof triggerShutdown === 'function' && triggerShutdown(),
      },
    ];
  }

  /* ── Default app window menu ── */
  function _buildDefaultAppMenu(appId) {
    const reg = window.WM?.registry?.[appId] ?? {};
    return [
      { type: 'label', label: appId },
      {
        label  : 'Minimize',
        icon   : 'fa-minus',
        disabled: reg.minimized,
        action : () => WM.minimize(appId),
      },
      {
        label  : reg.maximized ? 'Restore' : 'Maximize',
        icon   : reg.maximized ? 'fa-compress' : 'fa-expand',
        action : () => WM.maximize(appId),
      },
      { type: 'sep' },
      {
        label  : 'Close',
        icon   : 'fa-xmark',
        variant: 'danger',
        shortcut: '⌘W',
        action : () => WM.close(appId),
      },
    ];
    /* Removed WM.center(appId) — that method does not exist in kos-wm.js */
  }

  /* ── DOM builder ── */
  function _ensureEl() {
    if (_menuEl) return;
    _menuEl = document.createElement('div');
    _menuEl.id = 'kos-ctx-menu';
    _menuEl.setAttribute('role', 'menu');
    document.body.appendChild(_menuEl);
  }

  function _renderItems(items, parent) {
    parent.innerHTML = '';

    items.forEach(item => {
      if (item.type === 'label') {
        const el = document.createElement('div');
        el.className   = 'ctx-section-label';
        el.textContent = item.label;
        parent.appendChild(el);
        return;
      }

      if (item.type === 'sep') {
        const el = document.createElement('div');
        el.className = 'ctx-sep';
        parent.appendChild(el);
        return;
      }

      const el = document.createElement('div');
      el.className   = 'ctx-item';
      el.setAttribute('role', 'menuitem');
      if (item.variant === 'danger') el.classList.add('ctx-danger');
      if (item.disabled)             el.classList.add('ctx-disabled');

      const check = document.createElement('span');
      check.className = 'ctx-check';
      check.innerHTML = item.checked ? '<i class="fa-solid fa-check"></i>' : '';
      el.appendChild(check);

      if (item.icon) {
        const ico = document.createElement('i');
        ico.className = `fa-solid ${item.icon} ctx-icon`;
        el.appendChild(ico);
      } else {
        const spc = document.createElement('span');
        spc.className = 'ctx-icon';
        el.appendChild(spc);
      }

      const lbl = document.createElement('span');
      lbl.className   = 'ctx-label';
      lbl.textContent = item.label;
      el.appendChild(lbl);

      if (item.shortcut) {
        const sh = document.createElement('span');
        sh.className   = 'ctx-shortcut';
        sh.textContent = item.shortcut;
        el.appendChild(sh);
      }

      if (item.sub?.length) {
        const arrow = document.createElement('span');
        arrow.className = 'ctx-arrow';
        arrow.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
        el.appendChild(arrow);

        const subEl = document.createElement('div');
        subEl.className = 'ctx-submenu';
        _renderItems(item.sub, subEl);
        el.appendChild(subEl);

        el.addEventListener('mouseenter', () => {
          const rect = subEl.getBoundingClientRect();
          subEl.classList.toggle('ctx-flip-x', rect.right > window.innerWidth - 12);
        });
      }

      if (!item.disabled && !item.sub?.length && typeof item.action === 'function') {
        el.addEventListener('click', e => {
          e.stopPropagation();
          close();
          item.action();
        });
      }

      parent.appendChild(el);
    });
  }

  /* ── Positioning ── */
  function _position(x, y) {
    _menuEl.style.visibility = 'hidden';
    _menuEl.style.display    = 'block';

    const mw = _menuEl.offsetWidth;
    const mh = _menuEl.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const left = Math.min(x, vw - mw - 8);
    const top  = Math.min(y, vh - mh - 8);

    _menuEl.style.setProperty('--ctx-origin-x', x > vw / 2 ? 'right'  : 'left');
    _menuEl.style.setProperty('--ctx-origin-y', y > vh / 2 ? 'bottom' : 'top');

    _menuEl.style.left       = `${Math.max(8, left)}px`;
    _menuEl.style.top        = `${Math.max(8, top)}px`;
    _menuEl.style.visibility = '';
    _menuEl.style.display    = '';
  }

  /* ── Zone resolution ── */
  function _resolveMenu(target) {
    for (const sel of BLOCKED) {
      if (target.closest(sel)) return null;
    }

    const desktop = document.getElementById('screen-desktop');
    if (!desktop?.classList.contains('active')) return null;

    const winEl = target.closest('.window[data-app-id]');
    if (winEl) {
      const appId = winEl.dataset.appId;
      if (_appMenus[appId]) {
        const reg = window.WM?.registry?.[appId] ?? {};
        return [
          { type: 'label', label: reg.title ?? appId },
          ..._appMenus[appId],
        ];
      }
      return _buildDefaultAppMenu(appId);
    }

    for (const { selector, menuDef } of _zoneRegs) {
      if (target.closest(selector)) {
        return typeof menuDef === 'function' ? menuDef(target) : menuDef;
      }
    }

    for (const { selector, build } of BUILT_IN_ZONES) {
      if (target.closest(selector)) return build(target);
    }

    if (
      target.closest('.desktop') ||
      target.closest('#screen-desktop') ||
      target === document.body
    ) {
      return _buildDesktopMenu();
    }

    return null;
  }

  /* ── Open / Close ── */
  function open(x, y, menuDef) {
    _ensureEl();
    _renderItems(menuDef, _menuEl);
    _position(x, y);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        _menuEl.classList.add('ctx-visible');
      });
    });
  }

  function close() {
    if (!_menuEl) return;
    _menuEl.classList.remove('ctx-visible');
  }

  /* ── Global event wiring ── */
  document.addEventListener('contextmenu', e => {
    const menuDef = _resolveMenu(e.target);

    const desktop = document.getElementById('screen-desktop');
    if (desktop?.classList.contains('active')) {
      e.preventDefault();
    }

    if (!menuDef) { close(); return; }

    e.preventDefault();
    close();
    open(e.clientX, e.clientY, menuDef);
  });

  document.addEventListener('pointerdown', e => {
    if (_menuEl && !_menuEl.contains(e.target)) close();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') close();
  });

  document.addEventListener('scroll', close, { passive: true, capture: true });

  if (typeof KOSBus !== 'undefined') {
    KOSBus.on('kos:request-spotlight-open', () => close());
  }

  /* ── Public API ── */
  function register(appId, menuDef) {
    _appMenus[appId] = menuDef;
  }

  function registerZone(selector, menuDef) {
    _zoneRegs.unshift({ selector, menuDef });
  }

  function unregister(appId) {
    delete _appMenus[appId];
  }

  function openAt(x, y, menuDef) {
    _ensureEl();
    open(x, y, menuDef);
  }

  return { register, unregister, registerZone, open: openAt, close };

})();
