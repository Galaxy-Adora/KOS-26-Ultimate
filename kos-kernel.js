/* ══════════════════════════════════════════════════════════════
   KOS ULTIMATE 2026 — kos-kernel.js
   Core system utilities: storage, theme, wallpaper, avatar,
   screen manager, login/power, clock, toast, event bus.
   This file has zero knowledge of any specific app.
   ══════════════════════════════════════════════════════════════ */

/* ─── 1. STORAGE KEYS ─── */
const KEY_THEME             = 'kos-theme';
const KEY_WALLPAPER         = 'kos-wallpaper';
const KEY_AVATAR            = 'kos-avatar';
const KEY_CUSTOM_AVATARS    = 'kos-custom-avatars';
const KEY_CUSTOM_WALLPAPERS = 'kos-custom-wallpapers';
const KEY_SESSION           = 'kos-session';
const KEY_ICON_PALETTE      = 'kos-icon-palette';
const KEY_SYS_OVERRIDES     = 'kos-sys-overrides';
const KEY_GLASS             = 'kos-glass';  /* 'on' | 'off' */
const KEY_PASSWORD          = 'kos-password';      /* custom password override (terminal: passwd) */
const KEY_NO_PASSWORD       = 'kos-no-password';   /* 'true' → skip login screen (terminal: passwd --nopass) */

/* ─── 2. GLOBAL EVENT BUS ───────────────────────────────────────
   All cross-module communication goes through here.
   No module calls another module's functions directly.

   Events dispatched:
     kos:app-opened     { appId }
     kos:app-closed     { appId }
     kos:app-minimized  { appId }
     kos:app-restored   { appId }
     kos:app-focused    { appId }
     kos:registry-changed  {}     ← apps added/removed at runtime
     kos:theme-changed  { theme }
   ────────────────────────────────────────────────────────────── */
const KOSBus = {
  dispatch(event, detail = {}) {
    window.dispatchEvent(new CustomEvent(event, { detail, bubbles: false }));
  },
  on(event, handler) {
    window.addEventListener(event, handler);
  },
};

/* ─── 3. STOCK DATA ─── */
function _mkAvSVG(c1, c2) {
  const s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/>
    </linearGradient></defs>
    <circle cx="50" cy="50" r="50" fill="url(#g)"/>
    <circle cx="50" cy="36" r="17" fill="rgba(255,255,255,0.90)"/>
    <ellipse cx="50" cy="81" rx="27" ry="22" fill="rgba(255,255,255,0.90)"/>
  </svg>`;
  return 'data:image/svg+xml;base64,' + btoa(s);
}

const STOCK_AVATARS = [
  { id: 'sa-1', label: 'Violet', src: _mkAvSVG('#667eea', '#764ba2') },
  { id: 'sa-2', label: 'Rose',   src: _mkAvSVG('#f093fb', '#f5576c') },
  { id: 'sa-3', label: 'Sky',    src: _mkAvSVG('#4facfe', '#00f2fe') },
  { id: 'sa-4', label: 'Mint',   src: _mkAvSVG('#43e97b', '#38f9d7') },
  { id: 'sa-5', label: 'Sunset', src: _mkAvSVG('#fa709a', '#fee140') },
  { id: 'sa-6', label: 'Nebula', src: _mkAvSVG('#30cfd0', '#330867') },
];

const STOCK_WALLPAPERS = [
  { label: 'Default',    value: "url('documents/dfw.jpg') center/cover no-repeat" },
  { label: 'Deep Space', value: 'linear-gradient(135deg,#1a1a2e 0%,#16213e 45%,#0f3460 100%)' },
  { label: 'Aurora',     value: 'linear-gradient(135deg,#fc466b 0%,#3f5efb 100%)' },
  { label: 'Mint',       value: 'linear-gradient(135deg,#43e97b 0%,#38f9d7 100%)' },
  { label: 'Ocean',      value: 'linear-gradient(135deg,#4facfe 0%,#00f2fe 100%)' },
  { label: 'Sunset',     value: 'linear-gradient(135deg,#fa709a 0%,#fee140 100%)' },
  { label: 'Lavender',   value: 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)' },
  { label: 'Dusk',       value: 'linear-gradient(135deg,#2c3e50 0%,#fd746c 100%)' },
];

const ICON_PALETTES = [
  { id: 'original', name: 'Original', filter: 'none',                             preview: ['#007aff', '#5e5ce6'] },
  { id: 'violet',   name: 'Violet',   filter: 'hue-rotate(40deg) saturate(1.15)', preview: ['#9b59b6', '#bf5af2'] },
  { id: 'rose',     name: 'Rose',     filter: 'hue-rotate(90deg) saturate(1.2)',  preview: ['#ff2d55', '#fa709a'] },
  { id: 'forest',   name: 'Forest',   filter: 'hue-rotate(130deg) saturate(1.1)',  preview: ['#30d158', '#43e97b'] },
  { id: 'ocean',    name: 'Ocean',    filter: 'hue-rotate(175deg) saturate(1.15)', preview: ['#4facfe', '#00f2fe'] },
  { id: 'sunset',   name: 'Sunset',   filter: 'hue-rotate(220deg) saturate(1.25)', preview: ['#ff9f0a', '#fa709a'] },
  { id: 'gold',     name: 'Gold',     filter: 'hue-rotate(265deg) saturate(1.4)', preview: ['#fee140', '#ffbd2e'] },
  { id: 'mono',     name: 'Mono',     filter: 'saturate(0) brightness(1.1)',       preview: ['#8e8e93', '#c7c7cc'] },
];

/* ─── 4. ICON BUILDER ─── */
function buildAppIcon(app) {
  return `<div class="app-icon ${app.iconClass}"><i class="fa-solid ${app.faIcon}"></i></div>`;
}

/* ─── 5. ICON PALETTE ─── */
function getCurrentPaletteId() { return localStorage.getItem(KEY_ICON_PALETTE) || 'original'; }

function applyIconPalette(id) {
  const pal = ICON_PALETTES.find(p => p.id === id) || ICON_PALETTES[0];
  document.documentElement.style.setProperty('--icon-filter', pal.filter);
  localStorage.setItem(KEY_ICON_PALETTE, id);
  if (document.getElementById('ip-grid')) buildIconPaletteGrid();
}

function buildIconPaletteGrid() {
  const grid = document.getElementById('ip-grid');
  if (!grid) return;
  const current = getCurrentPaletteId();
  const frag = document.createDocumentFragment();
  ICON_PALETTES.forEach(pal => {
    const [c1, c2] = pal.preview;
    const div = document.createElement('div');
    div.className = 'ip-swatch' + (current === pal.id ? ' selected' : '');
    div.title = pal.name;
    div.setAttribute('onclick', "applyIconPalette('" + pal.id + "')");
    div.innerHTML =
      '<div class="ip-swatch-icon" style="background:linear-gradient(145deg,' + c1 + ',' + c2 + ')">' +
        '<i class="fa-solid fa-grid-2" style="font-size:1rem;color:#fff;opacity:0.9"></i>' +
      '</div><span>' + pal.name + '</span>';
    frag.appendChild(div);
  });
  grid.replaceChildren(frag);
}

/* ─── 6. THEME ─── */
function applyTheme(theme) {
  document.body.classList.toggle('dark', theme === 'dark');
  const icon = document.getElementById('themeIcon');
  if (icon) icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  const dt = document.getElementById('darkToggle');
  if (dt) dt.classList.toggle('on', theme === 'dark');
  KOSBus.dispatch('kos:theme-changed', { theme });
}

function toggleTheme() {
  const next = document.body.classList.contains('dark') ? 'light' : 'dark';
  localStorage.setItem(KEY_THEME, next);
  applyTheme(next);
}

/* ─── 7a. GLASS UI ─── */
function applyGlass(enabled) {
  document.body.classList.toggle('no-glass', !enabled);
  /* sync the toggle knob in UI Manager if it's open */
  const el = document.getElementById('glassToggle');
  if (el) el.classList.toggle('on', enabled);
  KOSBus.dispatch('kos:glass-changed', { enabled });
}

function toggleGlass() {
  /* no-glass present = glass is OFF → next state is ON (true), and vice-versa */
  const next = document.body.classList.contains('no-glass');
  localStorage.setItem(KEY_GLASS, next ? 'on' : 'off');
  applyGlass(next);
}

/* ─── 7. WALLPAPER ─── */
function getCustomWallpapers() {
  try { return JSON.parse(localStorage.getItem(KEY_CUSTOM_WALLPAPERS)) || []; } catch { return []; }
}
function saveCustomWallpapers(arr) { localStorage.setItem(KEY_CUSTOM_WALLPAPERS, JSON.stringify(arr)); }

function addCustomWallpaper(dataURL) {
  const arr = getCustomWallpapers().filter(x => x !== dataURL);
  arr.unshift(dataURL);
  saveCustomWallpapers(arr.slice(0, 5));
}

function deleteCustomWallpaper(dataURL) {
  saveCustomWallpapers(getCustomWallpapers().filter(x => x !== dataURL));
  if (localStorage.getItem(KEY_WALLPAPER) === dataURL) selectWallpaper('default');
  buildWallpaperGrid();
  if (window.KOSApps?.gallery?.refresh) window.KOSApps.gallery.refresh();
}

function applyWallpaper(stored) {
  const el = document.getElementById('wallpaperEl');
  if (!el) return;
  if (!stored || stored === 'default') {
    el.style.background = STOCK_WALLPAPERS[0].value;
  } else if (stored.startsWith('stock-')) {
    const idx = parseInt(stored.replace('stock-', ''));
    el.style.background = STOCK_WALLPAPERS[idx]?.value || STOCK_WALLPAPERS[0].value;
  } else {
    el.style.background = `url('${stored}') center/cover no-repeat`;
  }
  el.style.backgroundSize = 'cover';
}

function selectWallpaper(value) {
  localStorage.setItem(KEY_WALLPAPER, value);
  applyWallpaper(value);
  buildWallpaperGrid();
}

function handleWallpaperUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const dataURL = e.target.result;
    addCustomWallpaper(dataURL);
    selectWallpaper(dataURL);
    if (window.KOSApps?.gallery?.refresh) window.KOSApps.gallery.refresh();
  };
  reader.readAsDataURL(file);
  event.target.value = '';
}

function buildWallpaperGrid() {
  const grid = document.getElementById('wallpaperGrid');
  if (!grid) return;
  const saved   = localStorage.getItem(KEY_WALLPAPER) || 'default';
  const customs = getCustomWallpapers();
  const frag    = document.createDocumentFragment();

  STOCK_WALLPAPERS.forEach((wp, i) => {
    const key = i === 0 ? 'default' : 'stock-' + i;
    const div = document.createElement('div');
    div.className = 'wp-swatch' + (saved === key ? ' selected' : '');
    div.title = wp.label;
    div.style.cssText = 'background:' + wp.value + ';background-size:cover';
    div.setAttribute('onclick', "selectWallpaper('" + key + "')");
    frag.appendChild(div);
  });

  customs.forEach(src => {
    const isSelected = saved === src;
    const wrap = document.createElement('div');
    wrap.className = 'wp-custom-thumb' + (isSelected ? ' selected' : '');
    const img = document.createElement('img');
    img.src = src; img.alt = 'Custom';
    const btn = document.createElement('button');
    btn.className = 'wp-delete-btn';
    btn.title = 'Delete';
    btn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    btn.setAttribute('onclick', "event.stopPropagation();deleteCustomWallpaper('" + src + "')");
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:absolute;inset:0;cursor:pointer;' +
      (isSelected ? 'border:2.5px solid #007aff;border-radius:10px;' : '');
    overlay.setAttribute('onclick', "selectWallpaper('" + src + "')");
    wrap.appendChild(img); wrap.appendChild(btn); wrap.appendChild(overlay);
    frag.appendChild(wrap);
  });

  const upload = document.createElement('div');
  upload.className = 'wp-upload-tile';
  upload.setAttribute('onclick', "document.getElementById('wallpaperFileInput').click()");
  upload.innerHTML = '<i class="fa-solid fa-image"></i><span>Add Photo</span>';
  frag.appendChild(upload);

  grid.replaceChildren(frag);
}

/* ─── 8. AVATAR ─── */
function getCustomAvatars() {
  try { return JSON.parse(localStorage.getItem(KEY_CUSTOM_AVATARS)) || []; } catch { return []; }
}
function saveCustomAvatars(arr) { localStorage.setItem(KEY_CUSTOM_AVATARS, JSON.stringify(arr)); }

function addCustomAvatar(dataURL) {
  const arr = getCustomAvatars().filter(x => x !== dataURL);
  arr.unshift(dataURL);
  saveCustomAvatars(arr.slice(0, 5));
}

function deleteCustomAvatar(dataURL) {
  saveCustomAvatars(getCustomAvatars().filter(x => x !== dataURL));
  if (localStorage.getItem(KEY_AVATAR) === dataURL) {
    localStorage.removeItem(KEY_AVATAR);
    applyAvatar('');
  }
  buildAvatarSection();
  if (window.KOSApps?.gallery?.refresh) window.KOSApps.gallery.refresh();
}

function applyAvatar(src) {
  const useSrc = src || 'documents/img_avatar.png';
  const loginEl = document.getElementById('loginAvatar');
  const prevEl  = document.getElementById('uimAvatarPreview');
  if (loginEl) loginEl.src = useSrc;
  if (prevEl)  prevEl.src  = useSrc;
}

function selectAvatar(src) {
  localStorage.setItem(KEY_AVATAR, src);
  applyAvatar(src);
  buildAvatarSection();
}

function handleAvatarUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const dataURL = e.target.result;
    addCustomAvatar(dataURL);
    selectAvatar(dataURL);
    if (window.KOSApps?.gallery?.refresh) window.KOSApps.gallery.refresh();
  };
  reader.readAsDataURL(file);
  event.target.value = '';
}

/* Avatar section builder — called by UI Manager */
function buildAvatarSection() {
  const sec = document.getElementById('uim-avatar-section');
  if (!sec) return;
  const current    = localStorage.getItem(KEY_AVATAR) || '';
  const customs    = getCustomAvatars();
  const previewSrc = current || 'documents/img_avatar.png';
  sec.innerHTML = `
    <h3>Profile Image</h3>
    <div class="uim-avatar-row">
      <img class="uim-avatar-preview" id="uimAvatarPreview" src="${previewSrc}" alt="Avatar">
      <div>
        <p style="font-size:0.82rem;color:#888;margin-bottom:10px;">Your current profile photo</p>
        <button class="upload-btn" onclick="document.getElementById('avatarFileInput').click()">
          <i class="fa-solid fa-arrow-up-from-bracket" style="margin-right:6px"></i>Upload Photo
        </button>
      </div>
    </div>
    <div style="margin-top:16px">
      <p style="font-size:0.72rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#888;margin-bottom:10px;">Stock Avatars</p>
      <div class="avatar-grid">
        ${STOCK_AVATARS.map(a => `
          <div class="av-thumb ${current === a.src ? 'selected' : ''}" onclick="selectAvatar('${a.src}')" title="${a.label}">
            <img src="${a.src}" alt="${a.label}">
          </div>
        `).join('')}
      </div>
    </div>
    ${customs.length > 0 ? `
    <div style="margin-top:14px">
      <p style="font-size:0.72rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#888;margin-bottom:10px;">Recent Uploads</p>
      <div class="avatar-grid">
        ${customs.map(src => `
          <div class="av-thumb ${current === src ? 'selected' : ''}" onclick="selectAvatar('${src}')">
            <img src="${src}" alt="Custom">
            <button class="av-delete" onclick="event.stopPropagation();deleteCustomAvatar('${src}')" title="Delete">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        `).join('')}
      </div>
    </div>` : ''}`;
}

/* ─── 9. SCREEN MANAGER ─── */
const screens = {};
document.querySelectorAll('.screen').forEach(s => screens[s.id] = s);
const passwordBox = document.getElementById('passwordBox');

/** Returns the active password — custom override from terminal, or the default. */
function _getPassword() {
  return localStorage.getItem(KEY_PASSWORD) || 'kosul';
}

/** True when auto-login is enabled (passwd --nopass was used in terminal). */
function _isNoPassword() {
  return localStorage.getItem(KEY_NO_PASSWORD) === 'true';
}

function showOnly(id) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  if (id && screens[id]) {
    screens[id].classList.add('active');
    if (id === 'screen-login') setTimeout(() => passwordBox?.focus(), 100);
  }
}

/* ── REPLACE attemptLogin() in kos-kernel.js ── */
function attemptLogin() {
  if (passwordBox.value === _getPassword()) {
    showOnly('screen-desktop');
    if (window.WM) WM.restoreSession();
    /* NEW: dispatch login success so kos-sound.js can play the login sound */
    KOSBus.dispatch('kos:login-success', {});
  } else {
    passwordBox.classList.add('shake');
    setTimeout(() => {
      passwordBox.classList.remove('shake');
      passwordBox.value = '';
    }, 500);
  }
}
/* ─── 11. POWER ─── */
/* ── REPLACE triggerSleep() in kos-kernel.js ── */
function triggerSleep() {
  KOSBus.dispatch('kos:sleep', {});   /* NEW */
  showOnly('screen-sleep');
}

/* ── REPLACE triggerRestart() in kos-kernel.js ── */
function triggerRestart() {
  KOSBus.dispatch('kos:restart', {}); /* NEW */
  if (window.WM) WM.clearSession();
  showOnly('screen-restart');
  setTimeout(() => {
    if (_isNoPassword()) {
      showOnly('screen-desktop');
      if (window.WM) WM.restoreSession();
    } else {
      showOnly('screen-login');
    }
  }, 3000);
}

/* ── REPLACE triggerShutdown() in kos-kernel.js ── */
function triggerShutdown() {
  KOSBus.dispatch('kos:shutdown', {}); /* NEW */
  if (window.WM) WM.clearSession();
  showOnly('screen-shutdown');
  setTimeout(() => {
    window.close();
    document.body.innerHTML = "<div style='background:#000;height:100vh'></div>";
  }, 3000);
}
/* ─── 12. DROPDOWNS ─── */
function toggleMenu(el, event) {
  event.stopPropagation();
  const menu = el.querySelector('.dropdown-menu');
  const isOpen = menu.classList.contains('active');
  closeAllDropdowns();
  if (!isOpen) menu.classList.add('active');
}
function closeAllDropdowns() { document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('active')); }
document.addEventListener('click', closeAllDropdowns);

/* ─── 13. CLOCK ───────────────────────────────────────────────────────
   toLocaleString() is ~10–50× slower than manual formatting because it
   calls into the platform ICU library on every tick. We cache the element
   reference so there's no getElementById on every second.
   ─────────────────────────────────────────────────────────────────── */
const _DAYS_SHORT   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const _MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
let   _clockEl      = null;

function updateClock() {
  if (!_clockEl) _clockEl = document.getElementById('clock');
  if (!_clockEl) return;
  const now  = new Date();
  const h    = now.getHours();
  const m    = now.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = h % 12 || 12;
  /* Pad with leading zero only for minutes */
  const mm   = m < 10 ? '0' + m : m;
  _clockEl.textContent =
    _DAYS_SHORT[now.getDay()] + ' ' +
    (now.getDate() < 10 ? '0' : '') + now.getDate() + ' ' +
    _MONTHS_SHORT[now.getMonth()] + ' ' +
    h12 + ':' + mm + ' ' + ampm;
}
setInterval(updateClock, 1000);
updateClock();

/* ─── 14. TOAST ─── */
let _toastTimer = null;
let _toastEl    = null;
function showToast(msg, duration = 2500) {
  if (!_toastEl) _toastEl = document.getElementById('kos-toast');
  if (!_toastEl) return;
  _toastEl.textContent = msg;
  _toastEl.classList.add('visible');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => _toastEl.classList.remove('visible'), duration);
}

/* ─── 15. SYSTEM APP OVERRIDE ENGINE ─── */
function getSysOverrides() {
  try { return JSON.parse(localStorage.getItem(KEY_SYS_OVERRIDES)) || {}; } catch { return {}; }
}

function applySysOverride(appId) {
  const overrides = getSysOverrides()[appId];
  if (!overrides) return;
  const winEl = document.getElementById('win-' + appId);
  if (!winEl) return;
  if (overrides.css) {
    let styleEl = winEl.querySelector('.sys-override-style');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.className = 'sys-override-style';
      winEl.appendChild(styleEl);
    }
    styleEl.textContent = overrides.css;
  }
  if (overrides.js) {
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function('winEl', 'appId', overrides.js);
      fn(winEl, appId);
    } catch (e) { console.warn('[KOS Override JS]', appId, e); }
  }
}

/* ─── 16. BOOT SEQUENCE ─── */
setTimeout(() => {
  if (_isNoPassword()) {
    /* Auto-login is enabled (set via terminal: passwd --nopass).
       Skip the login screen entirely and go straight to the desktop. */
    showOnly('screen-desktop');
    if (window.WM) WM.restoreSession();
  } else {
    showOnly('screen-login');
  }
}, 4000);

/* ─── 17. APPLY PERSISTED SETTINGS AT STARTUP ─── */
applyTheme(localStorage.getItem(KEY_THEME) || 'light');
applyGlass(localStorage.getItem(KEY_GLASS) !== 'off');


