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
  { id:'display',       label:'Display',             icon:'fa-display',          color:'#5E5CE6', group:'System'           },
  { id:'notifications', label:'Notifications',       icon:'fa-bell',             color:'#FF9F0A', group:'System',  soon:true },
  { id:'privacy',       label:'Privacy & Safety',    icon:'fa-eye-slash',        color:'#30D158', group:'System',  soon:true },
  { id:'accessibility', label:'Accessibility',       icon:'fa-universal-access', color:'#0A84FF', group:'System',  soon:true },
  { id:'network',       label:'Network',             icon:'fa-wifi',             color:'#5AC8FA', group:'System',  soon:true },
  { id:'about',         label:'About KOS',           icon:'fa-circle-info',      color:'#8E8E93', group:'About'   },
];

/* ── Searchable index ─────────────────────────────────────────── */
const _IDX = [
  { s:'appearance', label:'Dark Mode',         sub:'Switch between light and dark interface'         },
  { s:'appearance', label:'Glass UI',           sub:'Frosted blur on windows, dock and panels'        },
  { s:'appearance', label:'Wallpaper',          sub:'Change the desktop background image'             },
  { s:'appearance', label:'Icon Style',         sub:'Colour palette tinting for all app icons'        },
  { s:'appearance', label:'Login Avatar',       sub:'Profile picture displayed on the login screen'   },
  { s:'apps',       label:'Installed Apps',     sub:'Browse and launch all KOS applications'          },
  { s:'security',   label:'Change Password',    sub:'Update your custom KOS login password'           },
  { s:'security',   label:'Set Password',       sub:'Create a new login password (min 6 characters)'  },
  { s:'security',   label:'Remove Password',    sub:'Remove custom password, restore system default'  },
  { s:'about',      label:'About KOS',          sub:'System version, storage info and credits'        },
  { s:'display',    label:'Screen Zoom',         sub:'Scale the entire OS interface from 50% to 250%'  },
  { s:'display',    label:'Text Size',           sub:'Adjust system font size across 6 levels'         },
  { s:'display',    label:'Bold Text',           sub:'Increase font weight across the entire system'   },
  { s:'display',    label:'Brightness',          sub:'Adjust the display brightness level'             },
  { s:'display',    label:'Reset Display',       sub:'Restore all display settings to defaults'        },
  { s:'notifications', label:'Do Not Disturb',  sub:'Silence all notifications'                       },
  { s:'privacy',    label:'Usage Analytics',    sub:'Share anonymous usage data with KOS team'        },
  { s:'accessibility', label:'Reduce Motion',   sub:'Minimise animation and motion effects'           },
  { s:'network',    label:'Proxy Settings',     sub:'Configure network proxy and DNS'                 },
];

/* ── Main app object ──────────────────────────────────────────── */
window.KOSApps.uimanager = {
  _activeId:    'appearance',
  _searchQ:     '',
  _statusTimer: null,

  /* ─── init: called by WM on every window open ─── */
  init() {
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
    if (this._activeId !== 'appearance') return;
    requestAnimationFrame(() => {
      try { buildIconPaletteGrid?.(); } catch(e){}
      try { buildAvatarSection?.();   } catch(e){}
      try { buildWallpaperGrid?.();   } catch(e){}
    });
  },

  /* ─── Sidebar nav HTML ─── */
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

  /* ─── Navigate to section ─── */
  navigate(id) {
    this._activeId = id;
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

  /* ─── Section dispatcher ─── */
  _renderSection(id) {
    const s = _SECTS.find(x => x.id === id);
    if (!s) return '';
    if (s.soon) return this._renderSoon(s);
    return ({
      appearance: () => this._renderAppearance(),
      apps:       () => this._renderApps(),
      security:   () => this._renderSecurity(),
      display:    () => this._renderDisplay(),
      about:      () => this._renderAbout(),
    }[id] || (() => this._renderSoon(s)))();
  },

  /* ══════════════════ SECTION RENDERERS ══════════════════ */

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
      </div>

      <div class="st-card">
        <div class="st-clabel">Security Tips</div>
        <div class="st-tip-row">
          <div class="st-tip-ico info"><i class="fa-solid fa-circle-info"></i></div>
          <span>Your password is stored locally in this browser only. Clearing browser data will reset it.</span>
        </div>
        <div class="st-div" style="margin:0 16px"></div>
        <div class="st-tip-row">
          <div class="st-tip-ico warn"><i class="fa-solid fa-triangle-exclamation"></i></div>
          <span>If you forget your password, open DevTools → Application → Local Storage and remove <code>kos_login_password</code>.</span>
        </div>
      </div>`;
  },

  /* ─── Display ─── */
  _renderDisplay() {
    /* Safe reads — KOSDisplay may not exist if script failed to load */
    const D          = window.KOSDisplay;
    const zoom       = D ? D.get.zoom()       : 100;
    const textSize   = D ? D.get.textSize()   : 3;
    const bold       = D ? D.get.bold()       : false;
    const brightness = D ? D.get.brightness() : 100;

    const LEVELS = ['XS','S','M','L','XL','XXL'];

    return `
      <div class="st-sec-head">
        <div class="st-sec-ico" style="background:#5E5CE6">
          <i class="fa-solid fa-display"></i>
        </div>
        <div>
          <div class="st-sec-title">Display</div>
          <div class="st-sec-sub">Scale, text size and brightness — applied system-wide</div>
        </div>
      </div>

      <!-- ── Brightness ── -->
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

      <!-- ── Screen Zoom ── -->
      <div class="st-card">
        <div class="st-clabel">Screen Zoom</div>
        <div class="dp-presets">
          ${[75,100,125,150,200].map(p=>`
            <button class="dp-preset ${zoom===p?'active':''}"
                    onclick="KOSDisplay.setZoom(${p});
                             document.querySelectorAll('.dp-preset').forEach(b=>b.classList.toggle('active',+b.dataset.v===${p}));
                             document.getElementById('dp-zoom-slider').value=${p};
                             document.getElementById('dp-zoom-val').textContent='${p}%'"
                    data-v="${p}">${p}%</button>`).join('')}
        </div>
        <div class="dp-slider-row" style="margin-top:10px">
          <span class="dp-edge-lbl">50%</span>
          <input type="range" class="dp-slider" id="dp-zoom-slider"
                 min="50" max="250" step="5" value="${zoom}"
                 oninput="KOSDisplay.setZoom(+this.value);
                          document.getElementById('dp-zoom-val').textContent=this.value+'%';
                          document.querySelectorAll('.dp-preset').forEach(b=>b.classList.toggle('active',+b.dataset.v===+this.value))">
          <span class="dp-edge-lbl">250%</span>
          <span class="dp-val" id="dp-zoom-val">${zoom}%</span>
        </div>
        <div class="st-tip-row">
          <div class="st-tip-ico info"><i class="fa-solid fa-circle-info"></i></div>
          <span>Zoom scales the entire OS interface — windows, dock and all panels. Default is 100%.</span>
        </div>
      </div>

      <!-- ── Text Size ── -->
      <div class="st-card">
        <div class="st-clabel">Text Size</div>
        <div class="dp-textsize-wrap">
          <span class="dp-tsa sm" aria-hidden="true">A</span>
          <div class="dp-ts-track">
            ${[1,2,3,4,5,6].map(l=>`
              <button class="dp-ts-dot ${textSize===l?'active':''}"
                      data-lv="${l}"
                      title="${LEVELS[l-1]}"
                      onclick="KOSDisplay.setTextSize(${l});
                               document.querySelectorAll('.dp-ts-dot').forEach(d=>d.classList.toggle('active',+d.dataset.lv===${l}));
                               document.getElementById('dp-ts-preview').textContent='${LEVELS[l-1]}  ·  ${['11px','13px','15px','17px','19px','22px'][l-1]}'">
              </button>`).join('')}
          </div>
          <span class="dp-tsa lg" aria-hidden="true">A</span>
        </div>
        <div class="dp-ts-preview-row">
          <span id="dp-ts-preview">${LEVELS[textSize-1]}  ·  ${['11px','13px','15px','17px','19px','22px'][textSize-1]}</span>
          <span class="dp-ts-sample" id="dp-ts-sample"
                style="font-size:${[11,13,15,17,19,22][textSize-1]}px">
            The quick brown fox
          </span>
        </div>
      </div>

      <!-- ── Accessibility ── -->
      <div class="st-card">
        <div class="st-clabel">Accessibility</div>
        <div class="st-row">
          <div class="st-rl">
            <div class="st-rlabel">Bold Text</div>
            <div class="st-rsub">Increases font weight across windows, dock and menus</div>
          </div>
          <div class="toggle-switch ${bold?'on':''}" id="dp-bold-toggle"
               onclick="const on=!this.classList.contains('on');
                        this.classList.toggle('on',on);
                        KOSDisplay.setBold(on)">
            <div class="toggle-knob"></div>
          </div>
        </div>
      </div>

      <!-- ── Reset ── -->
      <div class="st-card">
        <div class="st-clabel">Reset</div>
        <div class="st-row">
          <div class="st-rl">
            <div class="st-rlabel">Reset Display Settings</div>
            <div class="st-rsub">Restores zoom (100%), text size (M), brightness (100%) and disables bold</div>
          </div>
          <button class="dp-reset-btn"
                  onclick="KOSDisplay.reset(); KOSApps.uimanager.navigate('display')">
            Reset
          </button>
        </div>
      </div>`;
  },

  /* ─── Coming Soon ─── */
  _renderSoon(sect) {
    const PREVIEWS = {
      display:       [['Brightness','Adjust display brightness','fa-sun'],
                      ['Resolution Scaling','2× Retina display support','fa-expand'],
                      ['Night Mode','Reduce blue light after sunset','fa-moon']],
      notifications: [['Notification Style','Banners, alerts or none','fa-comment'],
                      ['Do Not Disturb','Silence all notifications','fa-bell-slash'],
                      ['Sounds','Play audio for alerts','fa-volume-high']],
      privacy:       [['Usage Analytics','Share anonymous data with KOS team','fa-chart-pie'],
                      ['Clipboard Access','Per-app clipboard permissions','fa-clipboard'],
                      ['Crash Reports','Send crash logs automatically','fa-bug']],
      accessibility: [['Reduce Motion','Minimise animation effects','fa-film'],
                      ['Font Size','Scale the system font','fa-text-height'],
                      ['High Contrast','Increase UI contrast ratio','fa-circle-half-stroke']],
      network:       [['Proxy','Configure network proxy','fa-server'],
                      ['DNS','Set a custom DNS resolver','fa-globe'],
                      ['Connection Info','View active network details','fa-ethernet']],
    };
    const rows = (PREVIEWS[sect.id]||[]).map(([lbl,sub,ico],i,a)=>`
      <div class="st-row st-row-dim">
        <div class="st-rl">
          <div class="st-rlabel">${lbl}</div>
          <div class="st-rsub">${sub}</div>
        </div>
        <i class="fa-solid ${ico}" style="color:var(--st-txt3);font-size:.85rem"></i>
      </div>${i<a.length-1?'<div class="st-div"></div>':''}`).join('');

    return `
      <div class="st-sec-head">
        <div class="st-sec-ico" style="background:${sect.color}">
          <i class="fa-solid ${sect.icon}"></i>
        </div>
        <div>
          <div class="st-sec-title">${sect.label}</div>
          <div class="st-sec-sub">Coming in a future KOS update</div>
        </div>
      </div>
      <div class="st-soon-hero">
        <div class="st-soon-ring">
          <i class="fa-solid fa-hammer"></i>
        </div>
        <div class="st-soon-title">Under Construction</div>
        <div class="st-soon-body">
          This section is planned for an upcoming KOS release.<br>
          Here's a preview of what's coming:
        </div>
        <div class="st-soon-badge-large">Coming Soon</div>
      </div>
      ${rows ? `<div class="st-card" style="opacity:.4;pointer-events:none">${rows}</div>` : ''}`;
  },

  /* ─── About ─── */
  _renderAbout() {
    const lsKB = (() => {
      try {
        let b = 0;
        for (let k in localStorage) if (Object.hasOwn(localStorage,k)) b += (k.length+localStorage[k].length)*2;
        return (b/1024).toFixed(1)+' KB';
      } catch{ return 'N/A'; }
    })();
    const info = [
      ['Version',      'KOS Ultimate 2026 · Build 2.0'],
      ['Viewport',     `${innerWidth} × ${innerHeight} px`],
      ['Colour Scheme', document.body.classList.contains('dark') ? 'Dark' : 'Light'],
      ['Glass UI',     !document.body.classList.contains('no-glass') ? 'Enabled' : 'Disabled'],
      ['Local Storage', lsKB],
      ['Platform',     navigator.platform || 'Unknown'],
    ];
    return `
      <div class="st-sec-head">
        <div class="st-sec-ico" style="background:#8E8E93"><i class="fa-solid fa-circle-info"></i></div>
        <div>
          <div class="st-sec-title">About KOS</div>
          <div class="st-sec-sub">System information &amp; credits</div>
        </div>
      </div>

      <div class="st-about-hero">
        <div class="st-about-mark">KOS</div>
        <div class="st-about-product">KOS Ultimate</div>
        <div class="st-about-ver">Version 2026 · Build 2.0</div>
      </div>

      <div class="st-card">
        <div class="st-clabel">System</div>
        ${info.map(([k,v],i,a)=>`
          <div class="st-row">
            <div class="st-rlabel">${k}</div>
            <div class="st-rval">${v}</div>
          </div>${i<a.length-1?'<div class="st-div"></div>':''}`).join('')}
      </div>

      <div class="st-card">
        <div class="st-clabel">Credits</div>
        <div class="st-tip-row">
          <div class="st-tip-ico" style="background:rgba(255,59,48,.15);color:#ff3b30">
            <i class="fa-solid fa-heart"></i>
          </div>
          <span>KOS Ultimate 2026 — Designed &amp; crafted by Kalapurackal Studios</span>
        </div>
        <div class="st-div" style="margin:0 16px"></div>
        <div class="st-tip-row">
          <div class="st-tip-ico info"><i class="fa-solid fa-code"></i></div>
          <span>Built with vanilla JS, CSS glass effects, and a whole lot of care.</span>
        </div>
      </div>`;
  },

  /* ══════════════════ SEARCH ══════════════════ */

  _onSearch(raw) {
    this._searchQ = raw.trim();
    const xBtn = document.getElementById('st-search-x');
    if (xBtn) xBtn.style.display = raw ? '' : 'none';

    if (!this._searchQ) { this._clearSearch(); return; }

    /* Dim non-matching nav items */
    const lq = this._searchQ.toLowerCase();
    document.querySelectorAll('.st-nav-item').forEach(el => {
      const lbl = el.querySelector('.st-nav-lbl')?.textContent?.toLowerCase()||'';
      el.style.opacity = lbl.includes(lq) ? '1' : '0.28';
    });

    /* Build results */
    const hits = _IDX.filter(x =>
      x.label.toLowerCase().includes(lq) || x.sub.toLowerCase().includes(lq));
    const sect = id => _SECTS.find(s => s.id === id);

    const c = document.getElementById('st-content');
    if (!c) return;
    c.innerHTML = `
      <div class="st-sec-title" style="margin-bottom:20px;font-size:1rem">
        ${hits.length} result${hits.length!==1?'s':''} for "<em>${this._searchQ}</em>"
      </div>
      ${hits.length ? `
      <div class="st-card">
        ${hits.map((h,i,a) => {
          const s = sect(h.s);
          return `
          <div class="st-row st-search-hit"
               onclick="KOSApps.uimanager._clearSearch();KOSApps.uimanager.navigate('${h.s}')">
            <div class="st-search-sico" style="background:${s?.color}">
              <i class="fa-solid ${s?.icon}"></i>
            </div>
            <div class="st-rl">
              <div class="st-rlabel">${h.label}</div>
              <div class="st-rsub">${s?.label} · ${h.sub}</div>
            </div>
            <i class="fa-solid fa-chevron-right" style="color:var(--st-txt3);font-size:.65rem;flex-shrink:0"></i>
          </div>${i<a.length-1?'<div class="st-div"></div>':''}`;
        }).join('')}
      </div>` : `
      <div class="st-empty">
        <i class="fa-solid fa-magnifying-glass"></i>
        <span>No settings found for "<strong>${this._searchQ}</strong>"</span>
      </div>`}`;
  },

  _clearSearch() {
    this._searchQ = '';
    const inp = document.getElementById('st-search-input');
    const xBtn = document.getElementById('st-search-x');
    if (inp)  inp.value = '';
    if (xBtn) xBtn.style.display = 'none';
    document.querySelectorAll('.st-nav-item').forEach(el => el.style.opacity = '');
    const c = document.getElementById('st-content');
    if (c) c.innerHTML = this._renderSection(this._activeId);
    this._runBuilders();
  },

  /* ══════════════════ PASSWORD ACTIONS ══════════════════ */

  _status(msg, type) {
    const el = document.getElementById('uim-pw-status');
    if (!el) return;
    el.textContent = msg;
    el.className = 'uim-pw-status ' + type;
    clearTimeout(this._statusTimer);
    this._statusTimer = setTimeout(() => {
      el.textContent = '';
      el.className = 'uim-pw-status';
    }, 3000);
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
    this._status('Password updated successfully.','success');
    setTimeout(() => this.navigate('security'), 1100);
  },

  clearPassword() {
    const stored  = localStorage.getItem(KOS_PW_KEY);
    const current = (document.getElementById('uim-pw-current')?.value || '');
    if (stored && current !== stored) { this._status('Enter your current password first.','error'); return; }
    localStorage.removeItem(KOS_PW_KEY);
    this._status('Password removed. System default restored.','success');
    setTimeout(() => this.navigate('security'), 1100);
  },
};

/* ── Register with WM ── */
WM.setOnOpen('uimanager', () => window.KOSApps.uimanager.init());
