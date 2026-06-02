/* ══════════════════════════════════════════════════════════════
   KOS ULTIMATE 2026 — apps/app-store.js
   ╔══════════════════════════════════════════════════════════╗
   ║  APP METADATA — consumed by KOS App Store (self)         ║
   ║  Name        : KOS App Store                             ║
   ║  ID          : store          (matches kos-manifest.js)  ║
   ║  bodyId      : store-body     (matches kos-manifest.js)  ║
   ║  Version     : 1.0.0                                     ║
   ║  Released    : May 28, 2026                              ║
   ║  Developer   : Kalapurackal Studios                      ║
   ║  Link        : https://galaxy-adora.github.io/KOS-26-Ultimate/ ║
   ║  Category    : System                                    ║
   ╚══════════════════════════════════════════════════════════╝

   Place at: apps/app-store.js
   CSS at  : css/apps/app-store.css
   Requires: app-metadata.js loaded before this file
   ══════════════════════════════════════════════════════════════ */

'use strict';
window.KOSApps = window.KOSApps || {};

/* ── Category → FontAwesome icon ───────────────────────────── */
const _KS_CAT_ICONS = {
  All          : 'fa-border-all',
  System       : 'fa-microchip',
  Media        : 'fa-photo-film',
  Productivity : 'fa-briefcase',
  Utilities    : 'fa-wrench',
  Games        : 'fa-gamepad',
  Developer    : 'fa-code',
  Internet     : 'fa-globe',
  Custom       : 'fa-wand-magic-sparkles',
};

/* ── Category → gradient colours ───────────────────────────── */
const _KS_CAT_COLORS = {
  System       : '#636366',
  Media        : '#fc3c44',
  Productivity : '#007aff',
  Utilities    : '#ff9f0a',
  Games        : '#30d158',
  Developer    : '#5e5ce6',
  Internet     : '#4facfe',
  Custom       : '#bf5af2',
};

/* ─────────────────────────────────────────────────────────────
   MAIN OBJECT
   ───────────────────────────────────────────────────────────── */
const KOSAppStore = {
  _view      : 'home',
  _detailId  : null,
  _searchQ   : '',
  _category  : 'All',
  _categories: ['All','System','Media','Productivity','Utilities','Games','Developer','Internet','Custom'],

  /* ── bodyId helper — always 'store-body' ───────────────── */
  _body() { return document.getElementById('store-body'); },

  /* ════════════════════════════════════════════════════════════
     INIT — called by WM every time the window opens
     ════════════════════════════════════════════════════════════ */
  init() {
    const body = this._body();
    if (!body) return;
    this._view     = 'home';
    this._searchQ  = '';
    this._category = 'All';
    this._renderHome(body);
  },

  /* ════════════════════════════════════════════════════════════
     DATA HELPERS
     ════════════════════════════════════════════════════════════ */

  /* All apps: system manifest + published Studio custom apps */
  _getAllApps() {
    const sys = (typeof AppManifest !== 'undefined' ? AppManifest : [])
      .filter(a => a.initData)          // skip coming-soon nulls
      .map(a => ({ ...a, _isCustom: false }));

    let custom = [];
    try {
      custom = JSON.parse(localStorage.getItem('kos-studio-apps') || '[]')
        .filter(a => a.published)
        .map(a => ({
          id        : a.id,
          name      : a.name,
          iconClass : a.publishType === 'system' ? 'icon-studio' : 'icon-custom-app',
          faIcon    : a.publishType === 'system' ? 'fa-microchip' : 'fa-window-maximize',
          metadata  : { isSystemApp: false },
          permissions: [],
          _isCustom : true,
          _studio   : a,
        }));
    } catch (_) {}

    return [...sys, ...custom];
  },

  /* Merge AppManifest entry with KOS_APP_METADATA for rich display */
  _getMeta(appId, app) {
    const m = (window.KOS_APP_METADATA || {})[appId] || {};
    const isCustom = app?._isCustom || false;
    return {
      version        : m.version        || '1.0.0',
      versionDate    : m.versionDate    || '—',
      developer      : m.developer      || (isCustom ? 'KOS Studio' : 'Kalapurackal Studios'),
      devLink        : m.devLink        || '',
      category       : m.category       || (isCustom ? 'Custom' : 'System'),
      shortDesc      : m.shortDesc      || 'A KOS application.',
      description    : m.description    || (isCustom
        ? 'A custom app built with KOS Studio.'
        : 'No description available.'),
      whatsNew       : m.whatsNew       || ['Initial release.'],
      screenshotLabels: m.screenshotLabels || [],
      size           : m.size           || this._guessSize(appId, app),
      codeSize       : m.codeSize       || 0,
      permissions    : m.permissions    !== undefined ? m.permissions : (app?.permissions || []),
      isSystemApp    : m.isSystemApp    !== undefined ? m.isSystemApp : !!(app?.metadata?.isSystemApp),
      tags           : m.tags           || [],
      addedInVersion : m.addedInVersion || '—',
    };
  },

  _guessSize(appId, app) {
    if (app?._isCustom && app._studio) {
      const b = ((app._studio.html||'').length + (app._studio.css||'').length + (app._studio.js||'').length) * 2;
      return b < 1024 ? `${b} B` : `~${(b/1024).toFixed(1)} KB`;
    }
    if (typeof KOS_SYS_MANIFEST !== 'undefined') {
      const f = KOS_SYS_MANIFEST.files.find(fi => fi.path.includes(appId));
      if (f) return `~${(f.size/1024).toFixed(0)} KB`;
    }
    return '—';
  },

  /* Filter list by current search + category */
  _filterApps(apps) {
    let list = [...apps];
    if (this._category !== 'All') {
      list = list.filter(a => {
        if (this._category === 'Custom') return a._isCustom;
        
        // Custom explicit filter groups mapping user requirements
        if (this._category === 'Developer') {
          return ['devhub', 'studio', 'store'].includes(a.id);
        }
        if (this._category === 'Media') {
          return ['files', 'gallery', 'videos', 'music'].includes(a.id);
        }
        if (this._category === 'Utilities') {
          return ['calculator', 'notes', 'music', 'videos', 'terminal', 'uimanager', 'files'].includes(a.id);
        }
        if (this._category === 'Productivity') {
          return ['calculator', 'notes'].includes(a.id);
        }
        if (this._category === 'Games') {
          return ['runner'].includes(a.id);
        }
        if (this._category === 'Internet') {
          return ['browser'].includes(a.id);
        }

        const m = (window.KOS_APP_METADATA || {})[a.id] || {};
        return (m.category || (a._isCustom ? 'Custom' : 'System')) === this._category;
      });
    }
    if (this._searchQ) {
      const q = this._searchQ.toLowerCase();
      list = list.filter(a => {
        const m = (window.KOS_APP_METADATA || {})[a.id] || {};
        return (
          (a.name || '').toLowerCase().includes(q) ||
          (m.shortDesc    || '').toLowerCase().includes(q) ||
          (m.description  || '').toLowerCase().includes(q) ||
          (m.developer    || '').toLowerCase().includes(q) ||
          (m.category     || '').toLowerCase().includes(q) ||
          (m.tags         || []).some(t => t.toLowerCase().includes(q))
        );
      });
    }
    return list;
  },

  /* ════════════════════════════════════════════════════════════
     HOME VIEW
     ════════════════════════════════════════════════════════════ */
  _renderHome(body) {
    if (!body) body = this._body();
    if (!body) return;

    const all      = this._getAllApps();
    const filtered = this._filterApps(all);

    /* Count per category for pill badges */
    const counts = {};
    this._categories.forEach(c => {
      counts[c] = c === 'All' ? all.length : all.filter(a => {
        if (c === 'Custom') return a._isCustom;
        const m = (window.KOS_APP_METADATA || {})[a.id] || {};
        return (m.category || (a._isCustom ? 'Custom' : 'System')) === c;
      }).length;
    });

    body.innerHTML = `
      <div class="ks-shell">

        <!-- Top bar -->
        <div class="ks-topbar">
          <div class="ks-topbar-title">App Store</div>
          <div class="ks-search-wrap">
            <i class="fa-solid fa-magnifying-glass ks-search-icon"></i>
            <input class="ks-search-input" type="text"
                   placeholder="Search apps, developers, categories…"
                   value="${this._esc(this._searchQ)}"
                   oninput="KOSAppStore._onSearch(this.value)"
                   autocomplete="off">
            ${this._searchQ
              ? `<button class="ks-search-clear" onclick="KOSAppStore._clearSearch()">
                   <i class="fa-solid fa-xmark"></i>
                 </button>`
              : ''}
          </div>
        </div>

        <!-- Category pills -->
        <div class="ks-cat-bar" id="ks-cat-bar">
          ${this._categories.map(c => `
            <button class="ks-cat-pill ${c === this._category ? 'active' : ''}"
                    onclick="KOSAppStore._setCategory('${c}')">
              <i class="fa-solid ${_KS_CAT_ICONS[c] || 'fa-grid-2'}"></i>
              <span>${c}</span>
              ${counts[c] > 0 ? `<span class="ks-cat-count">${counts[c]}</span>` : ''}
            </button>`).join('')}
        </div>

        <!-- Scroll body -->
        <div class="ks-scroll-body">

          ${!this._searchQ && this._category === 'All' ? this._buildHero(all) : ''}

          <div class="ks-results-bar">
            <span class="ks-results-count">
              ${this._searchQ
                ? `${filtered.length} result${filtered.length !== 1 ? 's' : ''} for "<strong>${this._esc(this._searchQ)}</strong>"`
                : `${this._category === 'All' ? 'All Apps' : this._category}
                   <span style="opacity:.4;font-weight:400"> ${filtered.length}</span>`}
            </span>
          </div>

          ${filtered.length === 0
            ? `<div class="ks-empty-state">
                 <i class="fa-solid fa-magnifying-glass"></i>
                 <p>No apps match "<strong>${this._esc(this._searchQ || this._category)}</strong>"</p>
                 <button class="ks-empty-reset"
                         onclick="KOSAppStore._searchQ='';KOSAppStore._category='All';KOSAppStore._renderHome();">
                   Clear Filters
                 </button>
               </div>`
            : `<div class="ks-app-list">
                 ${filtered.map(app => this._buildRow(app)).join('')}
               </div>`}

          <div style="height:24px"></div>
        </div>
      </div>`;

    /* Re-focus search input if user was typing */
    if (this._searchQ) {
      const inp = body.querySelector('.ks-search-input');
      if (inp) { inp.focus(); inp.selectionStart = inp.selectionEnd = inp.value.length; }
    }
  },

  _buildHero(all) {
    /* Pick first non-system app that has metadata, else fall back to first app */
    const pick = all.find(a =>
      !a._isCustom && !a?.metadata?.isSystemApp &&
      (window.KOS_APP_METADATA || {})[a.id]
    ) || all.find(a => (window.KOS_APP_METADATA || {})[a.id]) || all[0];
    if (!pick) return '';

    const m   = this._getMeta(pick.id, pick);
    const col = _KS_CAT_COLORS[m.category] || '#007aff';
    return `
      <div class="ks-hero-card" onclick="KOSAppStore._goDetail('${pick.id}')">
        <div class="ks-hero-bg"
             style="background:linear-gradient(135deg,${col},${col}88)"></div>
        <div class="ks-hero-glow"></div>
        <div class="ks-hero-content">
          <span class="ks-hero-eyebrow">Featured</span>
          <div class="ks-hero-icon-row">
            <div class="app-icon ${pick.iconClass || 'icon-custom-app'}"
                 style="width:56px;height:56px;border-radius:14px;font-size:1.4rem">
              <i class="fa-solid ${pick.faIcon || 'fa-window-maximize'}"></i>
            </div>
          </div>
          <div class="ks-hero-name">${this._esc(pick.name)}</div>
          <div class="ks-hero-desc">${this._esc(m.shortDesc)}</div>
          <div class="ks-hero-action">
            <span class="ks-hero-cat-pill">${m.category}</span>
            <i class="fa-solid fa-chevron-right" style="color:rgba(255,255,255,.6);font-size:.8rem"></i>
          </div>
        </div>
      </div>`;
  },

  _buildRow(app) {
    const m      = this._getMeta(app.id, app);
    const isSys  = m.isSystemApp && !app._isCustom;
    const col    = _KS_CAT_COLORS[m.category] || '#636366';
    return `
      <div class="ks-list-row" onclick="KOSAppStore._goDetail('${app.id}')">
        <div class="ks-row-icon-wrap">
          <div class="app-icon ${app.iconClass || 'icon-custom-app'}"
               style="width:58px;height:58px;border-radius:14px;font-size:1.35rem;flex-shrink:0">
            <i class="fa-solid ${app.faIcon || 'fa-window-maximize'}"></i>
          </div>
          ${isSys
            ? `<div class="ks-sys-badge" title="System App"><i class="fa-solid fa-microchip"></i></div>`
            : ''}
          ${app._isCustom
            ? `<div class="ks-custom-badge" title="Custom App"><i class="fa-solid fa-code"></i></div>`
            : ''}
        </div>
        <div class="ks-row-body">
          <div class="ks-row-name">${this._esc(app.name)}</div>
          <div class="ks-row-cat" style="color:${col}">${m.category}</div>
          <div class="ks-row-desc">${this._esc(m.shortDesc)}</div>
          <div class="ks-row-meta">
            <span class="ks-row-ver">v${m.version}</span>
            <span class="ks-row-dev">
              <i class="fa-solid fa-user-tie" style="font-size:.5rem;margin-right:3px"></i>
              ${this._esc(m.developer)}
            </span>
          </div>
        </div>
        <div class="ks-row-action">
          <button class="ks-open-btn"
                  onclick="event.stopPropagation();openApp('${app.id}')">
            Open
          </button>
          <i class="fa-solid fa-chevron-right ks-row-chevron"></i>
        </div>
      </div>`;
  },

  /* ════════════════════════════════════════════════════════════
     DETAIL VIEW
     ════════════════════════════════════════════════════════════ */
  _goDetail(id) {
    this._view     = 'detail';
    this._detailId = id;
    const body = this._body();
    if (body) this._renderDetail(body);
  },

  _renderDetail(body) {
    if (!body) body = this._body();
    if (!body) return;

    const all = this._getAllApps();
    const app = all.find(a => a.id === this._detailId)
             || (typeof AppManifest !== 'undefined' && AppManifest.find(a => a.id === this._detailId))
             || null;

    if (!app) { this._goHome(); return; }

    const m   = this._getMeta(app.id, app);
    const col = _KS_CAT_COLORS[m.category] || '#007aff';
    const PERM = {
      '*': 'Full filesystem access', photos:'Photos library',
      videos:'Video library', audios:'Audio library',
      documents:'Documents', apps:'App packages',
    };

    body.innerHTML = `
      <div class="ks-shell ks-detail-shell">

        <!-- Back bar -->
        <div class="ks-detail-topbar">
          <button class="ks-back-btn" onclick="KOSAppStore._goHome()">
            <i class="fa-solid fa-chevron-left"></i> All Apps
          </button>
          <button class="ks-open-btn ks-open-btn-top"
                  onclick="openApp('${app.id}')">
            Open
          </button>
        </div>

        <div class="ks-scroll-body">

          <!-- Hero -->
          <div class="ks-detail-hero"
               style="background:linear-gradient(160deg,${col}18,${col}05)">
            <div class="app-icon ${app.iconClass || 'icon-custom-app'}"
                 style="width:96px;height:96px;border-radius:24px;font-size:2.2rem;
                        flex-shrink:0;box-shadow:0 12px 40px ${col}55">
              <i class="fa-solid ${app.faIcon || 'fa-window-maximize'}"></i>
            </div>
            <div class="ks-hero-info">
              <h1 class="ks-detail-appname">${this._esc(app.name)}</h1>
              <div class="ks-detail-devname">
                ${m.devLink
                  ? `<a href="${m.devLink}" target="_blank" class="ks-dev-link">${this._esc(m.developer)}</a>`
                  : this._esc(m.developer)}
              </div>
              <div class="ks-detail-badge-row">
                ${m.isSystemApp && !app._isCustom
                  ? `<span class="ks-badge ks-badge-sys">
                       <i class="fa-solid fa-microchip"></i> System App
                     </span>`
                  : ''}
                ${app._isCustom
                  ? `<span class="ks-badge ks-badge-custom">
                       <i class="fa-solid fa-code"></i> Studio App
                     </span>`
                  : ''}
                <span class="ks-badge ks-badge-cat"
                      style="background:${col}22;color:${col}">
                  ${m.category}
                </span>
              </div>
              <div class="ks-detail-stats-row">
                <div class="ks-stat-chip">
                  <div class="ks-stat-val">${m.size}</div>
                  <div class="ks-stat-lbl">Size</div>
                </div>
                <div class="ks-stat-chip">
                  <div class="ks-stat-val">${m.version}</div>
                  <div class="ks-stat-lbl">Version</div>
                </div>
                <div class="ks-stat-chip">
                  <div class="ks-stat-val">${m.addedInVersion}</div>
                  <div class="ks-stat-lbl">Added In</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Open button -->
          <div class="ks-cta-row">
            <button class="ks-cta-btn"
                    style="background:linear-gradient(135deg,${col},${col}bb)"
                    onclick="openApp('${app.id}')">
              <i class="fa-solid fa-arrow-up-right-from-square"></i> Open App
            </button>
          </div>

          ${m.screenshotLabels.length ? `
          <!-- Feature cards -->
          <div class="ks-screenshots">
            ${m.screenshotLabels.map((lbl, i) => {
              const h  = (i * 55 + 200) % 360;
              const h2 = (h + 40) % 360;
              return `<div class="ks-screenshot-card"
                           style="background:linear-gradient(145deg,hsl(${h},45%,18%),hsl(${h2},45%,12%));
                                  border-color:hsl(${h},40%,30%)">
                <div class="ks-ss-icon">
                  <i class="fa-solid ${app.faIcon || 'fa-window-maximize'}"></i>
                </div>
                <div class="ks-ss-label">${this._esc(lbl)}</div>
              </div>`;
            }).join('')}
          </div>` : ''}

          <!-- Description -->
          <div class="ks-detail-section">
            <div class="ks-section-hd">
              <div class="ks-section-title">About this App</div>
            </div>
            <div class="ks-description">
              ${this._esc(m.description).replace(/\n\n/g,'</p><p class="ks-desc-para">').replace(/\n/g,'<br>')}
            </div>
            ${m.tags.length
              ? `<div class="ks-tags">
                   ${m.tags.map(t => `<span class="ks-tag">#${this._esc(t)}</span>`).join('')}
                 </div>`
              : ''}
          </div>

          <!-- What's New -->
          <div class="ks-detail-section">
            <div class="ks-section-hd">
              <div class="ks-section-title">What's New</div>
              <div class="ks-section-sub">
                <span class="ks-ver-pill">v${m.version}</span>
                ${m.versionDate}
              </div>
            </div>
            <ul class="ks-whatsnew">
              ${m.whatsNew.map(item => `
                <li class="ks-wn-item">
                  <i class="fa-solid fa-circle-check ks-wn-icon" style="color:${col}"></i>
                  <span>${this._esc(item)}</span>
                </li>`).join('')}
            </ul>
          </div>

          <!-- Information -->
          <div class="ks-detail-section">
            <div class="ks-section-hd">
              <div class="ks-section-title">Information</div>
            </div>
            <div class="ks-info-table">
              ${this._infoRow('Developer',
                  m.devLink
                    ? `<a href="${m.devLink}" target="_blank" class="ks-dev-link">
                         ${this._esc(m.developer)}
                         <i class="fa-solid fa-arrow-up-right-from-square"
                            style="font-size:.5rem;margin-left:3px"></i>
                       </a>`
                    : this._esc(m.developer), true)}
              ${this._infoRow('Version',    m.version)}
              ${this._infoRow('Released',   m.versionDate)}
              ${this._infoRow('Size',       m.size)}
              ${this._infoRow('Category',   m.category)}
              ${this._infoRow('App Type',
                  app._isCustom    ? 'Custom (KOS Studio)'
                : m.isSystemApp    ? 'System App'
                                   : 'User App')}
              ${this._infoRow('Added In',   m.addedInVersion !== '—' ? `KOS ${m.addedInVersion}` : null)}
              ${m.permissions.length
                ? this._infoRow('Permissions',
                    m.permissions.map(p => PERM[p] || p).join(' · '))
                : this._infoRow('Permissions', 'None')}
            </div>
          </div>

          ${m.codeSize > 0 ? `
          <!-- Storage -->
          <div class="ks-detail-section">
            <div class="ks-section-hd">
              <div class="ks-section-title">Storage</div>
            </div>
            <div class="ks-storage-block">
              <div class="ks-stor-row">
                <div class="ks-stor-icon" style="background:${col}22;color:${col}">
                  <i class="fa-solid fa-code"></i>
                </div>
                <div class="ks-stor-info">
                  <div class="ks-stor-label">Application Code</div>
                  <div class="ks-stor-bar-wrap">
                    <div class="ks-stor-bar"
                         style="background:${col};width:${Math.min(100,m.codeSize/500)}%"></div>
                  </div>
                </div>
                <div class="ks-stor-val">
                  ${m.codeSize < 1024 ? m.codeSize+' B' : (m.codeSize/1024).toFixed(1)+' KB'}
                </div>
              </div>
              ${m.permissions.length
                ? `<div class="ks-stor-row">
                     <div class="ks-stor-icon"
                          style="background:#30d15822;color:#30d158">
                       <i class="fa-solid fa-database"></i>
                     </div>
                     <div class="ks-stor-info">
                       <div class="ks-stor-label">KOSFS Data Access</div>
                       <div class="ks-stor-sub">
                         ${m.permissions.map(p => PERM[p]||p).join(', ')}
                       </div>
                     </div>
                   </div>`
                : ''}
              <p class="ks-stor-note">
                <i class="fa-solid fa-circle-info"></i>
                Open the Files app to see total storage used per file type.
              </p>
            </div>
          </div>` : ''}

          <div style="height:32px"></div>
        </div>
      </div>`;
  },

  /* ── Small helpers ─────────────────────────────────────────── */
  _infoRow(label, value, isHTML = false) {
    if (!value || value === '—') return '';
    return `<div class="ks-info-row">
      <span class="ks-info-label">${label}</span>
      <span class="ks-info-value">${isHTML ? value : this._esc(String(value))}</span>
    </div>`;
  },

  _esc(s) {
    return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;')
                  .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  },

  /* ── Navigation ────────────────────────────────────────────── */
  _goHome() {
    this._view     = 'home';
    this._detailId = null;
    const body = this._body();
    if (body) this._renderHome(body);
  },

  _onSearch(q) {
    this._searchQ = q.trim();
    const body = this._body();
    if (body) this._renderHome(body);
  },

  _clearSearch() {
    this._searchQ = '';
    const body = this._body();
    if (body) this._renderHome(body);
  },

  _setCategory(cat) {
    this._category = cat;
    const body = this._body();
    if (body) this._renderHome(body);
    /* Scroll active pill into view */
    setTimeout(() => {
      const bar  = document.getElementById('ks-cat-bar');
      const pill = bar?.querySelector('.ks-cat-pill.active');
      if (pill && bar) bar.scrollLeft = pill.offsetLeft - bar.clientWidth / 2 + pill.clientWidth / 2;
    }, 0);
  },
};

/* ─── Single clean registration — no duplicates ──────────────── */
window.KOSApps.store = KOSAppStore;

WM.setOnOpen('store', () => KOSAppStore.init());

KOSBus.on('kos:registry-changed', () => {
  if (window.WM?.registry?.['store']?.open &&
      !window.WM?.registry?.['store']?.minimized) {
    const body = KOSAppStore._body();
    if (body && KOSAppStore._view === 'home') KOSAppStore._renderHome(body);
  }
});
