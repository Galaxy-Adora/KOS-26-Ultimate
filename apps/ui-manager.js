/* ══════════════════════════════════════════════════════════════
   KOS ULTIMATE 2026 — apps/ui-manager.js
   Settings App — macOS-style, liquid glass UI.
   File kept as ui-manager.js; display name is "Settings".
   ══════════════════════════════════════════════════════════════ */

window.KOSApps = window.KOSApps || {};

const KOS_PW_KEY = 'kos_login_password';

/* ── Section manifest ─────────────────────────────────────────── */
const _SECTS = [
  { id:'appearance',    label:'Appearance',          icon:'fa-palette',          color:'#FF6B35', group:'Personal' },
  { id:'apps',          label:'Apps',                icon:'fa-table-cells',      color:'#007AFF', group:'Personal' },
  { id:'security',      label:'Password & Security', icon:'fa-shield-halved',    color:'#34C759', group:'Personal' },
  { id:'storage',       label:'Storage',             icon:'fa-server',           color:'#FF2D55', group:'System'   },
  { id:'reset',         label:'Reset Options',       icon:'fa-arrow-rotate-left',color:'#FF3B30', group:'System'   },
  { id:'display',       label:'Display',             icon:'fa-display',          color:'#5E5CE6', group:'System'   },
  { id:'sound',         label:'Sound',               icon:'fa-volume-high',      color:'#FF9F0A', group:'System'   },
  { id:'notifications', label:'Notifications',       icon:'fa-bell',             color:'#FF9F0A', group:'System',  soon:true },
  { id:'privacy',       label:'Privacy & Safety',    icon:'fa-eye-slash',        color:'#30D158', group:'System',  soon:true },
  { id:'accessibility', label:'Accessibility',       icon:'fa-universal-access', color:'#0A84FF', group:'System',  soon:true },
  { id:'network',       label:'Network',             icon:'fa-wifi',             color:'#5AC8FA', group:'System',  soon:true },
  { id:'about',         label:'About KOS',           icon:'fa-circle-info',      color:'#8E8E93', group:'About'   },
];

/* ── Searchable index ─────────────────────────────────────────── */
const _IDX = [
  { s:'sound',        label:'System Sounds',  sub:'Enable or disable UI audio feedback'      },
  { s:'sound',        label:'Master Volume',  sub:'Adjust the volume of all system sounds'   },
  { s:'sound',        label:'Sound Theme',    sub:'Choose a sound personality for the OS'    },
  { s:'sound',        label:'Preview Sounds', sub:'Click any sound to hear it'               },
  { s:'appearance',   label:'Dark Mode',      sub:'Switch between light and dark interface'         },
  { s:'appearance',   label:'Glass UI',       sub:'Frosted blur on windows, dock and panels'        },
  { s:'appearance',   label:'Wallpaper',      sub:'Change the desktop background image'             },
  { s:'appearance',   label:'Icon Style',     sub:'Colour palette tinting for all app icons'        },
  { s:'appearance',   label:'Login Avatar',   sub:'Profile picture displayed on the login screen'   },
  { s:'apps',         label:'Installed Apps', sub:'Browse and launch all KOS applications'          },
  { s:'security',     label:'Change Password',sub:'Update your custom KOS login password'           },
  { s:'security',     label:'Set Password',   sub:'Create a new login password (min 6 characters)'  },
  { s:'security',     label:'Remove Password',sub:'Remove custom password, restore system default'  },
  { s:'storage',      label:'Analyse Storage',sub:'Check space distribution for media, apps, and user data'},
  { s:'reset',        label:'Factory Reset',  sub:'Reset system settings or wipe the entire OS setup data' },
  { s:'about',        label:'About KOS',      sub:'System version, storage info and credits'        },
  { s:'display',      label:'Screen Zoom',    sub:'Scale the entire OS interface from 50% to 250%'  },
  { s:'display',      label:'Text Size',      sub:'Adjust system font size across 6 levels'         },
  { s:'display',      label:'Bold Text',      sub:'Increase font weight across the entire system'   },
  { s:'display',      label:'Brightness',     sub:'Adjust the display brightness level'             },
  { s:'display',      label:'Reset Display',  sub:'Restore all display settings to defaults'        },
];

/* ── Main app object ──────────────────────────────────────────── */
window.KOSApps.uimanager = {
  _activeId:    'appearance',
  _searchQ:     '',
  _statusTimer: null,

  /* ─── init: called by WM on every window open ─── */
  init() {
    KOSFS.registerApp('uimanager', ['*']); // Ensure file access hooks are mapped
    const body = document.getElementById('uim-body');
    if (!body) return;
    this._activeId = 'appearance';
    this._searchQ  = '';
    body.classList.add('st-host');

    body.innerHTML = `
      <div class="st-root">
        <!-- ── Sidebar ── -->
        <aside class="st-sidebar">
          <div class="st-sidebar-header">
            <div class="st-app-title">Settings</div>
          </div>
          <div class="st-search-wrap">
            <i class="fa-solid fa-magnifying-glass st-si"></i>
            <input class="st-search" id="st-search-input" type="text"
                   placeholder="Search Settings…" autocomplete="off"
                   oninput="KOSApps.uimanager._onSearch(this.value)">
            <button class="st-search-x" id="st-search-x" style="display:none"
                    onclick="KOSApps.uimanager._clearSearch()">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <nav class="st-nav" id="st-nav">${this._buildNav()}</nav>
        </aside>

        <!-- ── Content ── -->
        <main class="st-content" id="st-content">
          ${this._renderSection(this._activeId)}
        </main>
      </div>`;

    this._wireNav();
    this._runBuilders();
  },

  _wireNav() {
    document.querySelectorAll('.st-nav-item').forEach(el => {
      el.addEventListener('click', () => {
        if (el.dataset.soon) return;
        this.navigate(el.dataset.id);
      });
    });
  },

  _runBuilders() {
    if (this._activeId === 'appearance') {
      requestAnimationFrame(() => {
        try { buildIconPaletteGrid?.(); } catch(e){}
        try { buildAvatarSection?.();   } catch(e){}
        try { buildWallpaperGrid?.();   } catch(e){}
      });
    } else if (this._activeId === 'storage') {
      this._updateStorageDataMetrics();
    }
  },

  _buildNav() {
    const groups = [...new Set(_SECTS.map(s => s.group))];
    return groups.map(g => {
      const items = _SECTS.filter(s => s.group === g);
      return `
        <div class="st-nav-group">
          <div class="st-nav-glabel">${g}</div>
          ${items.map(s => `
            <div class="st-nav-item ${s.id === this._activeId ? 'active' : ''} ${s.soon ? 'soon' : ''}"
                 data-id="${s.id}" ${s.soon ? 'data-soon="1"' : ''}>
              <div class="st-nav-ico" style="background:${s.color}">
                <i class="fa-solid ${s.icon}"></i>
              </div>
              <span class="st-nav-lbl">${s.label}</span>
              ${s.soon ? '<span class="st-soon-pill">Soon</span>' : ''}
            </div>`).join('')}
        </div>`;
    }).join('');
  },

  navigate(id) {
    this._activeId = id;
    window.KOSSound?.play('click');     /* NEW — navigation click sound */
    document.querySelectorAll('.st-nav-item').forEach(el =>
      el.classList.toggle('active', el.dataset.id === id));
    const c = document.getElementById('st-content');
    if (!c) return;
    c.classList.add('st-leaving');
    setTimeout(() => {
      c.innerHTML = this._renderSection(id);
      c.classList.remove('st-leaving');
      c.classList.add('st-entering');
      setTimeout(() => c.classList.remove('st-entering'), 280);
      this._runBuilders();
    }, 110);
  },

  _renderSection(id) {
    const s = _SECTS.find(x => x.id === id);
    if (!s) return '';
    if (s.soon) return this._renderSoon(s);
    return ({
      appearance: () => this._renderAppearance(),
      apps:       () => this._renderApps(),
      security:   () => this._renderSecurity(),
      storage:    () => this._renderStorage(),
      reset:      () => this._renderReset(),
      display:    () => this._renderDisplay(),
      about:      () => this._renderAbout(),
      sound:      () => this._renderSound(),
    }[id] || (() => this._renderSoon(s)))();
  },

  /* ══════════════════ STORAGE ANALYSIS (ONE UI STYLE) ══════════════════ */
  _renderStorage() {
    return `
      <div class="st-sec-head">
        <div class="st-sec-ico" style="background:#FF2D55"><i class="fa-solid fa-server"></i></div>
        <div>
          <div class="st-sec-title">Storage</div>
          <div class="st-sec-sub">Device space tracking &amp; KOSFS database analytics</div>
        </div>
      </div>

      <div class="st-card" style="padding: 20px 16px;">
        <div class="oneui-storage-summary">
          <div class="oneui-storage-main-pct" id="st-total-pct">0%</div>
          <div class="oneui-storage-main-lbl">
            <span id="st-total-used">0 B</span> used of <span id="st-total-capacity">512 MB (Simulated Limit)</span>
          </div>
        </div>

        <div class="oneui-progress-bar" id="oneui-bar-stack">
          <!-- Dynamically populated via JS segments -->
        </div>

        <!-- Vertically Stacked Storage Items -->
        <div class="oneui-vertical-list" id="oneui-legend">
          <div class="oneui-list-item">
            <div class="dot" style="background:#FF9500"></div>
            <span class="lbl">Photos</span>
            <span class="val">Calculating...</span>
          </div>
          <div class="oneui-list-item">
            <div class="dot" style="background:#FF3B30"></div>
            <span class="lbl">Videos</span>
            <span class="val">Calculating...</span>
          </div>
          <div class="oneui-list-item">
            <div class="dot" style="background:#34C759"></div>
            <span class="lbl">Audio</span>
            <span class="val">Calculating...</span>
          </div>
          <div class="oneui-list-item">
            <div class="dot" style="background:#007AFF"></div>
            <span class="lbl">Documents</span>
            <span class="val">Calculating...</span>
          </div>
          <div class="oneui-list-item">
            <div class="dot" style="background:#AF52DE"></div>
            <span class="lbl">Applications</span>
            <span class="val">Calculating...</span>
          </div>
          <div class="oneui-list-item">
            <div class="dot" style="background:#5AC8FA"></div>
            <span class="lbl">System Data</span>
            <span class="val">Calculating...</span>
          </div>
        </div>
      </div>`;
  },

  async _updateStorageDataMetrics() {
    try {
      const fsStats = await KOSFS._systemStats();
      
      // Calculate individual sizes
      let photosSize = fsStats.byType['image']?.size || 0;
      let videosSize = fsStats.byType['video']?.size || 0;
      let audiosSize = fsStats.byType['audio']?.size || 0;
      let docsSize   = fsStats.byType['document']?.size || 0;
      let appsSize   = fsStats.byType['app']?.size || 0;

      // Calculate configuration data size (localStorage parsing weight)
      let lsSize = 0;
      for (let key in localStorage) {
        if (Object.hasOwn(localStorage, key)) {
          lsSize += (key.length + localStorage[key].length) * 2;
        }
      }
      let systemDataSize = lsSize + 1024 * 1024; // Base OS allocation index padding

      let totalUsed = photosSize + videosSize + audiosSize + docsSize + appsSize + systemDataSize;
      let maxCap = 512 * 1024 * 1024; // Simulated 512MB capacity quota ceiling
      let overallPct = Math.min(((totalUsed / maxCap) * 100), 100).toFixed(1);

      // Render Text fields
      document.getElementById('st-total-pct').textContent = `${overallPct}%`;
      document.getElementById('st-total-used').textContent = KOSFS.formatSize(totalUsed);

      // Percentages for stacking tracks
      const pctPhotos = ((photosSize / maxCap) * 100);
      const pctVideos = ((videosSize / maxCap) * 100);
      const pctAudio  = ((audiosSize / maxCap) * 100);
      const pctDocs   = ((docsSize / maxCap) * 100);
      const pctApps   = ((appsSize / maxCap) * 100);
      const pctSys    = ((systemDataSize / maxCap) * 100);

      // Generate Stacked Bar Graph
      document.getElementById('oneui-bar-stack').innerHTML = `
        <div class="segment" style="background:#FF9500; width:${pctPhotos}%"></div>
        <div class="segment" style="background:#FF3B30; width:${pctVideos}%"></div>
        <div class="segment" style="background:#34C759; width:${pctAudio}%"></div>
        <div class="segment" style="background:#007AFF; width:${pctDocs}%"></div>
        <div class="segment" style="background:#AF52DE; width:${pctApps}%"></div>
        <div class="segment" style="background:#5AC8FA; width:${pctSys}%"></div>
      `;

      // Render specific detail grid components
      const categories = [
        { label: 'Photos', size: photosSize },
        { label: 'Videos', size: videosSize },
        { label: 'Audio', size: audiosSize },
        { label: 'Documents', size: docsSize },
        { label: 'Applications', size: appsSize },
        { label: 'System Data', size: systemDataSize }
      ];

      const legendItems = document.getElementById('oneui-legend').children;
      categories.forEach((cat, index) => {
        if(legendItems[index]) {
          legendItems[index].querySelector('.val').textContent = KOSFS.formatSize(cat.size);
        }
      });

    } catch (e) {
      console.error("Storage analyzer failed to update metrics:", e);
    }
  },

  /* ══════════════════ SYSTEM RECOVERY / RESETS ══════════════════ */
  _renderReset() {
    return `
      <div class="st-sec-head">
        <div class="st-sec-ico" style="background:#FF3B30"><i class="fa-solid fa-arrow-rotate-left"></i></div>
        <div>
          <div class="st-sec-title">Reset Options</div>
          <div class="st-sec-sub">Wipe environment states or completely reset parameters</div>
        </div>
      </div>

      <div class="st-card">
        <div class="st-clabel">Authorization Profile Verification</div>
        <div style="padding: 12px 16px;">
          <input type="password" id="reset-auth-pw" class="uim-pw-input" placeholder="Enter custom login password to authenticate details...">
          <div class="uim-pw-status" id="uim-reset-status" style="padding: 6px 0 0 0;"></div>
        </div>
      </div>

      <div class="st-card">
        <div class="st-clabel">Available Execution Directives</div>
        
        <div class="st-row">
          <div class="st-rl">
            <div class="st-rlabel">Reset System Settings</div>
            <div class="st-rsub">Reverts display metrics, themes, custom styles, and adjustments back to factory presets.</div>
          </div>
          <button class="dp-reset-btn" onclick="KOSApps.uimanager._executeSystemWipe('settings')">Reset Configuration</button>
        </div>
        
        <div class="st-div"></div>
        
        <div class="st-row">
          <div class="st-rl">
            <div class="st-rlabel">Format KOSFS Filesystem Only</div>
            <div class="st-rsub">Purges the dynamic IndexedDB system file cache. Completely deletes all photos, videos, and documentation.</div>
          </div>
          <button class="dp-reset-btn" onclick="KOSApps.uimanager._executeSystemWipe('kosfs')">Format Filesystem</button>
        </div>

        <div class="st-div"></div>

        <div class="st-row">
          <div class="st-rl">
            <div class="st-rlabel">Wipe Whole OS Environment (Factory Clear)</div>
            <div class="st-rsub">Clears entire localStorage instances and local databases, immediately kicking the client back to the core setup screens.</div>
          </div>
          <button class="dp-reset-btn" style="background:rgba(255,59,48,0.15); color:#FF3B30; border-color:rgba(255,59,48,0.3);" onclick="KOSApps.uimanager._executeSystemWipe('full')">Factory Clear</button>
        </div>
      </div>`;
  },

  _executeSystemWipe(mode) {
    const statusEl = document.getElementById('uim-reset-status');
    const inputPw = document.getElementById('reset-auth-pw').value;
    const activePassword = localStorage.getItem(KOS_PW_KEY);

    if (activePassword && inputPw !== activePassword) {
      statusEl.textContent = "Security validation exception: Incorrect administrative password.";
      statusEl.className = "uim-pw-status error";
      return;
    }
    if (!activePassword && inputPw !== "") {
      statusEl.textContent = "Validation mismatch: No system password is set. Leave input blank to clear components.";
      statusEl.className = "uim-pw-status error";
      return;
    }

    if (!confirm(`Are you absolutely sure you want to proceed with: Reset Option [${mode.toUpperCase()}]\nThis action cannot be reverted.`)) {
      return;
    }

    statusEl.textContent = "Authorization verified. Processing tasks...";
    statusEl.className = "uim-pw-status success";

    setTimeout(() => {
      if (mode === 'settings') {
        localStorage.removeItem('kos_theme_dark');
        localStorage.removeItem('kos_ui_glass');
        if (window.KOSDisplay && typeof KOSDisplay.reset === 'function') {
          KOSDisplay.reset();
        }
        alert('System configuration parameters reverted safely to default variables.');
        window.location.reload();

      } else if (mode === 'kosfs') {
        const dropReq = indexedDB.deleteDatabase('kos-filesystem');
        dropReq.onsuccess = () => {
          alert('KOSFS structural database layers successfully formatted.');
          window.location.reload();
        };
        dropReq.onerror = () => {
          alert('An explicit hardware lock error prevented the prompt removal of tables.');
        };

      } else if (mode === 'full') {
        localStorage.clear();
        const dropAllReq = indexedDB.deleteDatabase('kos-filesystem');
        dropAllReq.onsuccess = dropAllReq.onerror = () => {
          alert('System architecture context wiped entirely. Redirecting to initialization setups.');
          window.location.reload();
        };
      }
    }, 1200);
  },

  /* ─── Appearance ─── */
  _renderAppearance() {
    const isDark  = document.body.classList.contains('dark');
    const isGlass = !document.body.classList.contains('no-glass');
    return `
      <div class="st-sec-head">
        <div class="st-sec-ico" style="background:#FF6B35"><i class="fa-solid fa-palette"></i></div>
        <div>
          <div class="st-sec-title">Appearance</div>
          <div class="st-sec-sub">Customise how KOS looks and feels</div>
        </div>
      </div>

      <div class="st-card">
        <div class="st-clabel">Theme</div>
        <div class="st-row">
          <div class="st-rl">
            <div class="st-rlabel">Dark Mode</div>
            <div class="st-rsub">Switch between light and dark interface</div>
          </div>
          <div class="toggle-switch ${isDark?'on':''}" id="darkToggle"
               onclick="toggleTheme();KOSApps.uimanager._syncThemeToggles()">
            <div class="toggle-knob"></div>
          </div>
        </div>
        <div class="st-div"></div>
        <div class="st-row">
          <div class="st-rl">
            <div class="st-rlabel">Glass UI</div>
            <div class="st-rsub">Frosted blur on windows, dock and panels</div>
          </div>
          <div class="toggle-switch ${isGlass?'on':''}" id="glassToggle"
               onclick="toggleGlass();KOSApps.uimanager._syncThemeToggles()">
            <div class="toggle-knob"></div>
          </div>
        </div>
      </div>

      <div class="st-card">
        <div class="st-clabel">Icon Style</div>
        <div class="st-card-desc">iOS 18-style tinting — all app icons adapt to your colour palette.</div>
        <div class="ip-grid" id="ip-grid" style="padding:0 16px 12px"></div>
      </div>

      <div class="st-card">
        <div class="st-clabel">Login Avatar</div>
        <div id="uim-avatar-section"></div>
      </div>

      <div class="st-card">
        <div class="st-clabel">Wallpaper</div>
        <div class="wallpaper-grid" id="wallpaperGrid" style="padding:4px 16px 14px"></div>
      </div>`;
  },

  _syncThemeToggles() {
    const isDark  = document.body.classList.contains('dark');
    const isGlass = !document.body.classList.contains('no-glass');
    document.getElementById('darkToggle') ?.classList.toggle('on', isDark);
    document.getElementById('glassToggle')?.classList.toggle('on', isGlass);
  },

  /* ─── Apps ─── */
  _renderApps() {
    const apps = (typeof AppManifest !== 'undefined' ? AppManifest : []);
    const rows = apps.map(app => {
      const iconHtml = (typeof buildAppIcon === 'function')
        ? buildAppIcon(app)
        : `<div class="app-icon"><i class="fa-solid fa-cube"></i></div>`;
      const dock = app.metadata?.showInDock;
      const spot = app.metadata?.searchable;
      return `
        <div class="st-app-row" data-name="${app.name.toLowerCase()}">
          <div class="st-app-ico-wrap">${iconHtml}</div>
          <div class="st-app-info">
            <div class="st-app-name">${app.name}</div>
            <div class="st-app-pills">
              ${dock ? '<span class="st-pill dock">Dock</span>' : ''}
              ${spot ? '<span class="st-pill spot">Spotlight</span>' : ''}
            </div>
          </div>
          <button class="st-app-open" onclick="openApp('${app.id}')">
            <i class="fa-solid fa-arrow-up-right-from-square"></i> Open
          </button>
        </div>`;
    }).join('');

    return `
      <div class="st-sec-head">
        <div class="st-sec-ico" style="background:#007AFF"><i class="fa-solid fa-table-cells"></i></div>
        <div>
          <div class="st-sec-title">Apps</div>
          <div class="st-sec-sub">${apps.length} application${apps.length!==1?'s':''} installed</div>
        </div>
      </div>

      <div class="st-apps-search-wrap">
        <i class="fa-solid fa-magnifying-glass"></i>
        <input type="text" class="st-apps-search" placeholder="Search apps…"
               oninput="KOSApps.uimanager._filterApps(this.value)">
      </div>

      <div class="st-card st-apps-card" id="st-apps-list">
        ${rows || '<div class="st-empty"><i class="fa-solid fa-box-open"></i><span>No apps found</span></div>'}
      </div>`;
  },

  _filterApps(q) {
    const lq = q.toLowerCase().trim();
    document.querySelectorAll('.st-app-row').forEach(r => {
      r.style.display = (!lq || (r.dataset.name||'').includes(lq)) ? '' : 'none';
    });
  },

  /* ─── Password & Security ─── */
  _renderSecurity() {
    const hasPw = localStorage.getItem(KOS_PW_KEY) !== null;
    return `
      <div class="st-sec-head">
        <div class="st-sec-ico" style="background:#34C759"><i class="fa-solid fa-shield-halved"></i></div>
        <div>
          <div class="st-sec-title">Password &amp; Security</div>
          <div class="st-sec-sub">Manage your KOS login credentials</div>
        </div>
      </div>

      <div class="st-card">
        <div class="st-clabel">Login Password</div>
        <div class="uim-pw-badge ${hasPw?'set':'unset'}">
          <i class="fa-solid ${hasPw?'fa-lock':'fa-lock-open'}"></i>
          <span>${hasPw
            ? 'Custom login password is active'
            : 'No custom password — using system default'}</span>
        </div>
        <div class="uim-pw-status" id="uim-pw-status"></div>
        <div class="uim-pw-form">
          ${hasPw ? `
          <div class="uim-pw-field-row">
            <label class="uim-pw-label">Current Password</label>
            <input class="uim-pw-input" type="password" id="uim-pw-current"
                   placeholder="Enter your current password" autocomplete="off">
          </div>` : ''}
          <div class="uim-pw-field-row">
            <label class="uim-pw-label">New Password</label>
            <input class="uim-pw-input" type="password" id="uim-pw-new"
                   placeholder="Minimum 6 characters" autocomplete="new-password">
          </div>
          <div class="uim-pw-field-row">
            <label class="uim-pw-label">Confirm Password</label>
            <input class="uim-pw-input" type="password" id="uim-pw-confirm"
                   placeholder="Re-enter new password" autocomplete="new-password">
          </div>
          <div class="uim-pw-actions">
            <button class="uim-pw-save-btn" onclick="KOSApps.uimanager.savePassword()">
              <i class="fa-solid fa-floppy-disk"></i>
              ${hasPw ? 'Update Password' : 'Set Password'}
            </button>
            ${hasPw ? `
            <button class="uim-pw-clear-btn" onclick="KOSApps.uimanager.clearPassword()">
              <i class="fa-solid fa-trash"></i> Remove
            </button>` : ''}
          </div>
        </div>
      </div>`;
  },

  /* ─── Display ─── */
  _renderDisplay() {
    const D          = window.KOSDisplay;
    const zoom       = D ? D.get.zoom()       : 100;
    const brightness = D ? D.get.brightness() : 100;

    return `
      <div class="st-sec-head">
        <div class="st-sec-ico" style="background:#5E5CE6"><i class="fa-solid fa-display"></i></div>
        <div>
          <div class="st-sec-title">Display</div>
          <div class="st-sec-sub">Scale, text size and brightness — applied system-wide</div>
        </div>
      </div>

      <div class="st-card">
        <div class="st-clabel">Brightness</div>
        <div class="dp-slider-row">
          <i class="fa-solid fa-sun dp-sun-sm"></i>
          <input type="range" class="dp-slider" id="dp-brightness"
                 min="10" max="100" step="5" value="${brightness}"
                 oninput="KOSDisplay.setBrightness(+this.value);
                          document.getElementById('dp-bright-val').textContent=this.value+'%'">
          <i class="fa-solid fa-sun dp-sun-lg"></i>
          <span class="dp-val" id="dp-bright-val">${brightness}%</span>
        </div>
      </div>

      <div class="st-card">
        <div class="st-clabel">Screen Zoom</div>
        <div class="dp-presets">
          ${[75,100,125,150,200].map(p=>`
            <button class="dp-preset ${zoom===p?'active':''}"
                    onclick="KOSDisplay.setZoom(${p});"
                    data-v="${p}">${p}%</button>`).join('')}
        </div>
      </div>`;
  },

  _renderSoon(sect) { 
    return `<div style="padding:24px; color:var(--st-txt2);">Feature approaching implementation.</div>`; 
  },

  /* ─── About ─── */
  _renderAbout() {
    return `
      <div class="st-sec-head">
        <div class="st-sec-ico" style="background:#8E8E93"><i class="fa-solid fa-circle-info"></i></div>
        <div>
          <div class="st-sec-title">About KOS</div>
          <div class="st-sec-sub">System architecture data</div>
        </div>
      </div>`;
  },

  _onSearch(raw) {
    this._searchQ = raw.trim();
    const xBtn = document.getElementById('st-search-x');
    if (xBtn) xBtn.style.display = raw ? '' : 'none';
    if (!this._searchQ) { this._clearSearch(); return; }
  },

  _clearSearch() {
    this._searchQ = '';
    const inp = document.getElementById('st-search-input');
    if (inp) inp.value = '';
    const c = document.getElementById('st-content');
    if (c) c.innerHTML = this._renderSection(this._activeId);
    this._runBuilders();
  },

  savePassword() {
    const stored  = localStorage.getItem(KOS_PW_KEY);
    const hasPw   = stored !== null;
    const current = (document.getElementById('uim-pw-current')?.value || '');
    const newPw   = (document.getElementById('uim-pw-new')?.value     || '');
    const confirm = (document.getElementById('uim-pw-confirm')?.value || '');
    if (hasPw && current !== stored)  { this._status('Current password is incorrect.','error'); return; }
    if (newPw.length < 6)             { this._status('New password must be at least 6 characters.','error'); return; }
    if (newPw !== confirm)            { this._status('Passwords do not match.','error'); return; }
    localStorage.setItem(KOS_PW_KEY, newPw);
    window.KOSSound?.play('success');   /* NEW */
    this._status('Password updated successfully.','success');
    setTimeout(() => this.navigate('security'), 1100);
  },

  clearPassword() {
    localStorage.removeItem(KOS_PW_KEY);
    window.KOSSound?.play('delete');   /* NEW */
    this._status('Password removed successfully.','success');
    setTimeout(() => this.navigate('security'), 1100);
  },

  _status(msg, type) {
    const el = document.getElementById('uim-pw-status');
    if (!el) return;
    el.textContent = msg;
    el.className = `uim-pw-status ${type}`;
    if (this._statusTimer) clearTimeout(this._statusTimer);
    this._statusTimer = setTimeout(() => {
      el.textContent = '';
      el.className = 'uim-pw-status';
    }, 4000);
  },

  _renderSound() {
    const S       = window.KOSSound;
    const enabled = S ? !S.isMuted() : true;
    const vol     = S ? Math.round(S.getVolume() * 100) : 60;
    const theme   = S ? S.getTheme() : 'default';

    const ALL_SOUNDS = [
      { id:'startup',     label:'Startup',         icon:'fa-power-off'         },
      { id:'login',       label:'Login',           icon:'fa-right-to-bracket'  },
      { id:'windowOpen',  label:'Window Open',     icon:'fa-window-maximize'   },
      { id:'windowClose', label:'Window Close',    icon:'fa-window-minimize'   },
      { id:'click',       label:'Click',           icon:'fa-hand-pointer'      },
      { id:'success',     label:'Success',         icon:'fa-circle-check'      },
      { id:'error',       label:'Error',           icon:'fa-circle-xmark'      },
      { id:'notify',      label:'Notification',    icon:'fa-bell'              },
      { id:'save',        label:'Save',            icon:'fa-floppy-disk'       },
      { id:'delete',      label:'Delete',          icon:'fa-trash'             },
      { id:'minimize',    label:'Minimize',        icon:'fa-minus'             },
      { id:'restore',     label:'Restore',         icon:'fa-window-restore'    },
      { id:'snap',        label:'Snap',            icon:'fa-up-right-and-down-left-from-center' },
      { id:'toggle',      label:'Toggle',          icon:'fa-toggle-on'         },
      { id:'lock',        label:'Sleep',           icon:'fa-moon'              },
      { id:'shutter',     label:'Shutter',         icon:'fa-camera'            },
    ];

    const THEME_OPTS = [
      { id:'default', label:'Default',  sub:'Clean macOS-style',      icon:'fa-apple-whole'  },
      { id:'retro',   label:'Retro',    sub:'Chiptune square-wave',   icon:'fa-gamepad'      },
      { id:'soft',    label:'Soft',     sub:'Barely-there feedback',  icon:'fa-feather'      },
      { id:'silent',  label:'Silent',   sub:'No UI sounds at all',    icon:'fa-volume-xmark' },
    ];

    return `
      <div class="st-sec-head">
        <div class="st-sec-ico" style="background:#FF9F0A">
          <i class="fa-solid fa-volume-high"></i>
        </div>
        <div>
          <div class="st-sec-title">Sound</div>
          <div class="st-sec-sub">System UI audio feedback and sound effects</div>
        </div>
      </div>

      <!-- ── Master toggle + volume slider ── -->
      <div class="st-card">
        <div class="st-clabel">Master</div>

        <div class="st-row">
          <div class="st-rl">
            <div class="st-rlabel">System Sounds</div>
            <div class="st-rsub">UI feedback for windows, actions and notifications</div>
          </div>
          <div class="toggle-switch ${enabled ? 'on' : ''}" id="snd-master-toggle"
               onclick="
                 const on = !this.classList.contains('on');
                 this.classList.toggle('on', on);
                 window.KOSSound?.setMuted(!on);
                 document.getElementById('snd-vol-row').style.opacity  = on ? '1' : '0.38';
                 document.getElementById('snd-theme-card').style.opacity = on ? '1' : '0.38';
                 document.getElementById('snd-test-card').style.opacity  = on ? '1' : '0.38';
                 if (on) window.KOSSound?.play('toggle');
               ">
            <div class="toggle-knob"></div>
          </div>
        </div>

        <div class="st-div"></div>

        <div id="snd-vol-row" style="opacity:${enabled ? '1' : '0.38'}">
          <div class="dp-slider-row">
            <i class="fa-solid fa-volume-low  dp-sun-sm"></i>
            <input type="range" class="dp-slider" id="snd-vol-slider"
                   min="0" max="100" value="${vol}"
                   oninput="
                     window.KOSSound?.setVolume(this.value / 100);
                     document.getElementById('snd-vol-val').textContent = this.value + '%';
                     if (typeof qsSetVolume === 'function') qsSetVolume(this.value);
                   ">
            <i class="fa-solid fa-volume-high dp-sun-lg"></i>
            <span class="dp-val" id="snd-vol-val">${vol}%</span>
          </div>
        </div>
      </div>

      <!-- ── Sound theme picker ── -->
      <div class="st-card" id="snd-theme-card"
           style="opacity:${enabled ? '1' : '0.38'}">
        <div class="st-clabel">Sound Theme</div>
        <p class="st-card-desc">Choose the personality of your system sounds.</p>
        <div style="
          display:grid;
          grid-template-columns:repeat(2,1fr);
          gap:10px;
          padding:4px 16px 16px;
        ">
          ${THEME_OPTS.map(t => `
            <button
              id="snd-theme-${t.id}"
              onclick="
                window.KOSSound?.setTheme('${t.id}');
                document.querySelectorAll('[id^=snd-theme-]')
                  .forEach(b => {
                    b.style.background   = 'var(--st-input-bg)';
                    b.style.boxShadow    = 'none';
                    b.style.color        = 'var(--st-txt1)';
                  });
                this.style.background = 'var(--st-active-bg)';
                this.style.boxShadow  = '0 0 0 1.5px var(--st-active-col)';
              "
              style="
                display:flex; flex-direction:column; align-items:flex-start;
                gap:5px; padding:12px 14px; border-radius:12px; border:none;
                cursor:pointer; text-align:left; font-family:inherit;
                background:${t.id === theme ? 'var(--st-active-bg)' : 'var(--st-input-bg)'};
                color:var(--st-txt1);
                box-shadow:${t.id === theme ? '0 0 0 1.5px var(--st-active-col)' : 'none'};
                transition:background 0.15s, box-shadow 0.15s;
              ">
              <span style="display:flex;align-items:center;gap:8px">
                <i class="fa-solid ${t.icon}"
                   style="color:var(--st-active-col);font-size:0.82rem;width:14px"></i>
                <strong style="font-size:0.88rem">${t.label}</strong>
              </span>
              <span style="
                font-size:0.74rem;
                color:var(--st-txt2);
                padding-left:22px;
                line-height:1.4;
              ">${t.sub}</span>
            </button>
          `).join('')}
        </div>
      </div>

      <!-- ── Sound preview grid ── -->
      <div class="st-card" id="snd-test-card"
           style="opacity:${enabled ? '1' : '0.38'}">
        <div class="st-clabel">Preview All Sounds</div>
        <p class="st-card-desc">Click any button to hear the sound.</p>
        <div style="
          display:grid;
          grid-template-columns:repeat(auto-fill, minmax(130px, 1fr));
          gap:8px;
          padding:4px 16px 16px;
        ">
          ${ALL_SOUNDS.map(s => `
            <button
              onclick="window.KOSSound?.play('${s.id}')"
              style="
                display:flex; align-items:center; gap:8px;
                padding:9px 12px; border-radius:10px; border:none;
                cursor:pointer; text-align:left; font-family:inherit;
                font-size:0.80rem; font-weight:500;
                background:var(--st-input-bg); color:var(--st-txt1);
                transition:background 0.14s, color 0.14s;
              "
              onmouseover="this.style.background='var(--st-active-bg)';
                           this.style.color='var(--st-active-col)'"
              onmouseout="this.style.background='var(--st-input-bg)';
                          this.style.color='var(--st-txt1)'">
              <i class="fa-solid ${s.icon}"
                 style="width:14px;text-align:center;
                        opacity:0.7;font-size:0.78rem"></i>
              ${s.label}
            </button>
          `).join('')}
        </div>
      </div>

      <!-- ── Tips ── -->
      <div class="st-card">
        <div class="st-clabel">How It Works</div>
        <div class="st-tip-row">
          <div class="st-tip-ico info"><i class="fa-solid fa-circle-info"></i></div>
          <span>Sounds play automatically for window events, notifications
                and file operations. Any app can also call
                <code>KOSSound.play('error')</code> directly.</span>
        </div>
        <div class="st-div" style="margin:0 16px"></div>
        <div class="st-tip-row">
          <div class="st-tip-ico warn"><i class="fa-solid fa-triangle-exclamation"></i></div>
          <span>Browsers require a user interaction before audio can start.
                Sounds will work normally after your first click on the desktop.</span>
        </div>
        <div class="st-div" style="margin:0 16px"></div>
        <div class="st-tip-row">
          <div class="st-tip-ico info"><i class="fa-solid fa-code"></i></div>
          <span>Register custom sounds from KOS Studio's JS tab:
                <code>KOSSound.register('myapp-ding', () => {
                  KOSSound._rawTone({ freq:880, dur:0.12, vol:0.10 });
                });</code></span>
        </div>
      </div>`;
  }
};

/* ── Register with WM ── */
WM.setOnOpen('uimanager', () => window.KOSApps.uimanager.init());