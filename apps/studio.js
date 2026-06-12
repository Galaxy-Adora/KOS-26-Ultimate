/* ══════════════════════════════════════════════════════════════
   KOS ULTIMATE 2026 — apps/studio.js
   KOS Studio — in-OS app builder. Create, edit, and publish
   custom apps directly into the KOS dock & spotlight.

   When Studio publishes/removes an app it dispatches
   kos:registry-changed — Dock and Spotlight update themselves.
   No direct calls to buildDock() or buildSpotlightGrid().
   ══════════════════════════════════════════════════════════════ */

window.KOSApps = window.KOSApps || {};

/* ─── Safe string helpers ─── */
function _safeText(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function _safeAttr(s) { return _safeText(s).replace(/"/g, '&quot;'); }

const KOSStudio = {
  KEY:           'kos-studio-apps',
  _page:         'home',
  _editingId:    null,
  _editingType:  null,   // 'custom' | 'system'
  _studioTab:    'myapps',
  _activeTab:    'html',
  _activeSysTab: 'sys-css',

  getApps()         { try { return JSON.parse(localStorage.getItem(this.KEY)) || []; } catch { return []; } },
  saveApps(apps)    { localStorage.setItem(this.KEY, JSON.stringify(apps)); },

  open() { this._page = 'home'; this._editingType = null; this._render(); },
  _render() {
    if (this._page === 'home')      this._renderHome();
    else if (this._page === 'editor')    this._renderEditor();
    else if (this._page === 'syseditor') this._renderSysEditor();
  },
/* ════════════════════════════════════════════════════════════
   PASTE THESE THREE METHODS inside the KOSStudio object
   ════════════════════════════════════════════════════════════ */

  /* ── Sound snippet browser for the Studio sidebar ── */
  _buildSoundBrowser() {
    const presets = [
      {
        name: 'Confirm',
        desc: 'Two-tone upward chime',
        code: `KOSSound.register('myapp-confirm', () => {
  KOSSound._rawTone({ freq: 660, dur: 0.10, vol: 0.12, type: 'sine' });
  KOSSound._rawTone({ freq: 880, dur: 0.15, vol: 0.10, type: 'sine', start: 0.09 });
});
// Play it:
KOSSound.play('myapp-confirm');`,
      },
      {
        name: 'Alert',
        desc: 'Harsh descending saw',
        code: `KOSSound.register('myapp-alert', () => {
  KOSSound._rawTone({ freq: 440, dur: 0.12, vol: 0.18, type: 'sawtooth' });
  KOSSound._rawTone({ freq: 330, dur: 0.18, vol: 0.14, type: 'sawtooth', start: 0.10 });
});
KOSSound.play('myapp-alert');`,
      },
      {
        name: 'Ding',
        desc: 'Single bell tone',
        code: `KOSSound.register('myapp-ding', () => {
  KOSSound._rawTone({ freq: 1047, dur: 0.22, vol: 0.10, type: 'sine', decay: 0.16 });
});
KOSSound.play('myapp-ding');`,
      },
      {
        name: 'Blip',
        desc: 'Retro square blip',
        code: `KOSSound.register('myapp-blip', () => {
  KOSSound._rawTone({ freq: 1200, dur: 0.04, vol: 0.10, type: 'square', decay: 0.02 });
});
KOSSound.play('myapp-blip');`,
      },
      {
        name: 'Whoosh',
        desc: 'Descending glide',
        code: `KOSSound.register('myapp-whoosh', () => {
  KOSSound._rawTone({ freq: 800, freq2: 200, dur: 0.18, vol: 0.08, type: 'sine', decay: 0.12 });
});
KOSSound.play('myapp-whoosh');`,
      },
      {
        name: 'Chime',
        desc: 'Three-note ascending',
        code: `KOSSound.register('myapp-chime', () => {
  KOSSound._rawTone({ freq: 523, dur: 0.08, vol: 0.11, type: 'sine' });
  KOSSound._rawTone({ freq: 659, dur: 0.08, vol: 0.09, type: 'sine', start: 0.08 });
  KOSSound._rawTone({ freq: 784, dur: 0.16, vol: 0.08, type: 'sine', start: 0.15, decay: 0.12 });
});
KOSSound.play('myapp-chime');`,
      },
      {
        name: 'Pop',
        desc: 'Short bubble pop',
        code: `KOSSound.register('myapp-pop', () => {
  KOSSound._rawTone({ freq: 400, freq2: 600, dur: 0.06, vol: 0.10, type: 'sine', decay: 0.04 });
});
KOSSound.play('myapp-pop');`,
      },
      {
        name: 'Error Buzz',
        desc: 'Low warning buzz',
        code: `KOSSound.register('myapp-buzz', () => {
  KOSSound._rawTone({ freq: 150, dur: 0.20, vol: 0.18, type: 'sawtooth', decay: 0.14 });
});
KOSSound.play('myapp-buzz');`,
      },
    ];

    return `
      <div style="padding:6px 6px 0;margin-bottom:4px">
        <div style="font-size:0.62rem;font-weight:700;letter-spacing:0.10em;
                    text-transform:uppercase;color:rgba(255,255,255,0.30);
                    padding:4px 4px 8px">
          Sound Snippets
        </div>
        ${presets.map(p => `
          <div class="studio-css-item">
            <div class="studio-css-name">
              <i class="fa-solid fa-music"
                 style="color:#bf5af2;margin-right:5px;font-size:0.75rem"></i>
              ${p.name}
            </div>
            <div class="studio-css-preview"
                 style="color:rgba(255,255,255,0.22);font-size:0.60rem">
              ${p.desc}
            </div>
            <div style="display:flex;gap:5px;margin-top:4px">
              <button class="studio-copy-btn" style="flex:1"
                      title="Paste into JS tab"
                      onclick='KOSStudio._pasteSound(${JSON.stringify(p.code)})'>
                <i class="fa-solid fa-copy"></i> Paste
              </button>
              <button class="studio-copy-btn"
                      style="background:rgba(191,90,242,0.20);
                             border-color:rgba(191,90,242,0.35)"
                      title="Preview this sound"
                      onclick='KOSStudio._previewSound(${JSON.stringify(p.code)})'>
                <i class="fa-solid fa-play"></i>
              </button>
            </div>
          </div>`).join('')}
      </div>`;
  },

  /* ── Paste a sound snippet into the JS textarea ── */
  _pasteSound(code) {
    /* Make sure the JS tab is visible first */
    const jsEl = document.getElementById('studio-code-js');
    if (!jsEl) {
      showToast('Switch to the JS tab first!');
      return;
    }
    const s = jsEl.selectionStart;
    jsEl.value =
      jsEl.value.slice(0, s) + '\n\n' + code + '\n\n' +
      jsEl.value.slice(jsEl.selectionEnd);
    jsEl.selectionStart = jsEl.selectionEnd = s + code.length + 4;
    jsEl.focus();
    this.saveCode();
    window.KOSSound?.play('save');
    showToast('Sound snippet pasted into JS tab!');
  },

  /* ── Temporarily register and play a preview sound ── */
  _previewSound(code) {
    if (!window.KOSSound) {
      showToast('KOSSound is not loaded.');
      return;
    }
    try {
      /* eslint-disable no-new-func */
      new Function(code)();
      /* Extract the registered ID from the code string */
      const match = code.match(/KOSSound\.register\(['"]([^'"]+)['"]/);
      if (match) {
        const id = match[1];
        KOSSound.play(id);
        /* Clean up after 3 seconds */
        setTimeout(() => KOSSound.unregister(id), 3000);
      }
    } catch (e) {
      showToast('Preview error: ' + e.message);
      window.KOSSound?.play('error');
    }
  },


  /* ── Home ── */
  _renderHome() {
    const body = document.getElementById('studio-body');
    if (!body) return;
    const apps   = this.getApps();
    const isSys  = this._studioTab === 'sysapps';
    const sysApps = AppManifest.filter(a =>
      a.initData && a.metadata.isSystemApp &&
      !apps.find(ca => ca.id === a.id)
    );

    body.innerHTML = `
      <div class="studio-home">
        <div class="studio-home-header">
          <div class="studio-logo"><i class="fa-solid fa-code"></i>&nbsp;KOS Studio</div>
          <button class="studio-help-btn" onclick="KOSStudio.showHelp()">
            <i class="fa-solid fa-circle-question"></i> How it works
          </button>
        </div>
        <div class="studio-home-tabs">
          <button class="studio-home-tab ${!isSys ? 'active' : ''}" onclick="KOSStudio._switchHomeTab('myapps')">
            <i class="fa-solid fa-layer-group"></i> My Apps
          </button>
          <button class="studio-home-tab ${isSys ? 'active' : ''}" onclick="KOSStudio._switchHomeTab('sysapps')">
            <i class="fa-solid fa-microchip"></i> System Apps
          </button>
        </div>

        ${!isSys ? `
        <div class="studio-apps-list" id="studio-apps-list">
          ${apps.length === 0
            ? `<div class="studio-empty"><i class="fa-solid fa-code-branch"></i><p>No apps yet.<br>Create your first one!</p></div>`
            : apps.map(app => `
              <div class="studio-app-row">
                <div class="studio-app-icon"><i class="fa-solid fa-window-maximize"></i></div>
                <div class="studio-app-info">
                  <div class="studio-app-name">${_safeText(app.name)}</div>
                  <div class="studio-app-meta">
                    ${app.published
                      ? `<span class="studio-badge ${app.publishType === 'system' ? 'system' : 'published'}">
                           <i class="fa-solid fa-circle-check"></i>
                           ${app.publishType === 'system' ? 'System App' : 'Published'}
                         </span>`
                      : '<span class="studio-badge draft"><i class="fa-regular fa-circle"></i> Draft</span>'}
                  </div>
                </div>
                <div class="studio-app-actions">
                  <button class="studio-action-btn edit" onclick="KOSStudio.editApp('${app.id}')"><i class="fa-solid fa-pen"></i> Edit</button>
                  ${app.published ? `<button class="studio-action-btn open-app" onclick="openApp('${app.id}')"><i class="fa-solid fa-arrow-up-right-from-square"></i> Open</button>` : ''}
                  <button class="studio-action-btn del" onclick="KOSStudio.deleteApp('${app.id}')"><i class="fa-solid fa-trash"></i></button>
                </div>
              </div>`).join('')}
        </div>
        <button class="studio-create-btn" onclick="KOSStudio.createApp()">
          <i class="fa-solid fa-plus"></i>&nbsp;Create New App
        </button>
        ` : `
        <div class="studio-apps-list" id="studio-sys-list">
          <p class="studio-sys-info">Edit any built-in KOS app's CSS and JavaScript. Changes apply every time the app opens.</p>
          ${sysApps.map(app => {
            const overrides = this.getSysOverrides()[app.id];
            const hasOverride = !!(overrides?.css || overrides?.js);
            return `<div class="studio-app-row">
              <div class="studio-app-icon ${app.iconClass}" style="width:40px;height:40px;border-radius:10px;font-size:1rem">
                <i class="fa-solid ${app.faIcon}"></i>
              </div>
              <div class="studio-app-info">
                <div class="studio-app-name">${_safeText(app.name)}</div>
                <div class="studio-app-meta">
                  <span class="studio-badge ${hasOverride ? 'published' : 'draft'}">
                    <i class="fa-solid ${hasOverride ? 'fa-pen-to-square' : 'fa-circle'}"></i>
                    ${hasOverride ? 'Custom Override' : 'Default'}
                  </span>
                </div>
              </div>
              <div class="studio-app-actions">
                <button class="studio-action-btn edit" onclick="KOSStudio.editSysApp('${app.id}')"><i class="fa-solid fa-pen"></i> Edit</button>
                ${hasOverride ? `<button class="studio-action-btn del" onclick="KOSStudio.clearSysOverride('${app.id}');KOSStudio._renderHome()"><i class="fa-solid fa-rotate-left"></i></button>` : ''}
              </div>
            </div>`;
          }).join('')}
        </div>
        `}
      </div>`;
  },

  _switchHomeTab(tab) { this._studioTab = tab; this._renderHome(); },

  /* ── Custom App Editor ── */
  _renderEditor() {
    const body = document.getElementById('studio-body');
    if (!body) return;
    const app = this.getApps().find(a => a.id === this._editingId);
    if (!app) { this._page = 'home'; this._renderHome(); return; }

    body.innerHTML = `
      <div class="studio-editor">
        <div class="studio-editor-topbar">
          <button class="studio-back-btn" onclick="KOSStudio.goHome()">
            <i class="fa-solid fa-chevron-left"></i> My Apps
          </button>
          <input class="studio-name-input" id="studio-app-name" value="${_safeAttr(app.name)}"
                 oninput="KOSStudio.saveName(this.value)" placeholder="App Name">
          <div class="studio-editor-actions">
            <button class="studio-btn studio-btn-launch" onclick="KOSStudio.launchPreview()">
              <i class="fa-solid fa-play"></i> Launch
            </button>
            <button class="studio-btn studio-btn-publish" onclick="KOSStudio.publish()">
              <i class="fa-solid fa-rocket"></i> ${app.published ? 'Update OS' : 'Publish to OS'}
            </button>
          </div>
        </div>
        <div class="studio-editor-body">
          <div class="studio-sidebar">
            <div class="studio-sidebar-title">System CSS</div>
            <div class="studio-css-browser">${this._buildCssBrowser()}</div>
          </div>
          <div class="studio-code-area">
            <div class="studio-tabs">
              <button class="studio-tab active" data-tab="html" onclick="KOSStudio.switchTab('html')">HTML</button>
              <button class="studio-tab" data-tab="css"  onclick="KOSStudio.switchTab('css')">CSS</button>
              <button class="studio-tab" data-tab="js"   onclick="KOSStudio.switchTab('js')">JS</button>
            </div>
            <textarea class="studio-textarea" id="studio-code-html"
              placeholder="<!-- Your HTML here -->"
              oninput="KOSStudio.saveCode()" spellcheck="false">${_safeText(app.html || '')}</textarea>
            <textarea class="studio-textarea studio-hidden" id="studio-code-css"
              placeholder="/* Your CSS here */"
              oninput="KOSStudio.saveCode()" spellcheck="false">${_safeText(app.css || '')}</textarea>
            <textarea class="studio-textarea studio-hidden" id="studio-code-js"
              placeholder="// Your JavaScript here"
              oninput="KOSStudio.saveCode()" spellcheck="false">${_safeText(app.js || '')}</textarea>
          </div>
          <div class="studio-preview-panel studio-hidden" id="studio-preview">
            <div class="studio-preview-bar">
              <span><i class="fa-solid fa-play"></i> Preview — ${_safeText(app.name)}</span>
              <button class="studio-preview-close" onclick="KOSStudio.closePreview()">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
            <iframe class="studio-preview-frame" id="studio-preview-frame"
                    sandbox="allow-scripts allow-same-origin"></iframe>
          </div>
        </div>
      </div>`;
    this._activeTab = 'html';
  },

  /* ── System App Editor ── */
  editSysApp(appId) {
    this._editingId   = appId;
    this._editingType = 'system';
    this._page        = 'syseditor';
    this._renderSysEditor();
  },

  _renderSysEditor() {
    const body = document.getElementById('studio-body');
    if (!body) return;
    const appDef = AppManifest.find(a => a.id === this._editingId);
    if (!appDef) { this._page = 'home'; this._renderHome(); return; }
    const overrides = this.getSysOverrides()[this._editingId] || { css: '', js: '' };

    body.innerHTML = `
      <div class="studio-editor">
        <div class="studio-editor-topbar">
          <button class="studio-back-btn" onclick="KOSStudio.goHome()">
            <i class="fa-solid fa-chevron-left"></i> System Apps
          </button>
          <div class="studio-app-icon ${appDef.iconClass}"
               style="width:28px;height:28px;border-radius:7px;font-size:0.75rem;flex-shrink:0;display:flex;align-items:center;justify-content:center">
            <i class="fa-solid ${appDef.faIcon}" style="color:#fff"></i>
          </div>
          <span style="color:#fff;font-weight:600;font-size:0.9rem;flex:1">${_safeText(appDef.name)}</span>
          <span style="font-size:0.72rem;color:rgba(255,255,255,0.4);background:rgba(0,122,255,0.2);padding:2px 8px;border-radius:5px">System App</span>
          <div class="studio-editor-actions">
            <button class="studio-btn studio-btn-launch" onclick="KOSStudio.previewSysOverride()">
              <i class="fa-solid fa-play"></i> Apply &amp; Open
            </button>
            <button class="studio-btn studio-btn-publish" onclick="KOSStudio.saveSysOverrideFromEditor()">
              <i class="fa-solid fa-floppy-disk"></i> Save Override
            </button>
          </div>
        </div>
        <div class="studio-editor-body">
          <div class="studio-sidebar">
    <div class="studio-sidebar-title">System CSS</div>
    <div class="studio-css-browser">${this._buildCssBrowser()}</div>
    <div class="studio-css-browser" style="border-top:1px solid rgba(255,255,255,0.07);margin-top:4px;padding-top:4px">
      ${this._buildSoundBrowser()}
    </div>
  </div>
          <div class="studio-code-area">
            <div class="studio-tabs">
              <button class="studio-tab" data-tab="sys-html" onclick="KOSStudio.switchSysTab('sys-html')">Live DOM</button>
              <button class="studio-tab active" data-tab="sys-css"  onclick="KOSStudio.switchSysTab('sys-css')">CSS Override</button>
              <button class="studio-tab" data-tab="sys-js"   onclick="KOSStudio.switchSysTab('sys-js')">JS Override</button>
            </div>
            <div class="studio-textarea studio-hidden studio-dom-preview" id="studio-code-sys-html"
                 style="overflow:auto;color:#8be9fd;font-size:0.76rem"></div>
            <textarea class="studio-textarea" id="studio-code-sys-css"
              placeholder="/* Override CSS for ${_safeAttr(appDef.name)} */"
              spellcheck="false">${_safeText(overrides.css)}</textarea>
            <textarea class="studio-textarea studio-hidden" id="studio-code-sys-js"
              placeholder="// Override JS runs each time ${_safeAttr(appDef.name)} opens"
              spellcheck="false">${_safeText(overrides.js)}</textarea>
          </div>
        </div>
      </div>`;
    this._activeSysTab = 'sys-css';
  },

  switchSysTab(tab) {
    this._activeSysTab = tab;
    /* Cache the NodeList queries — querySelectorAll on every tab click is wasteful */
    if (!this._sysTabs)     this._sysTabs    = document.querySelectorAll('.studio-tab');
    if (!this._sysEditors)  this._sysEditors = document.querySelectorAll('.studio-code-area .studio-textarea, .studio-dom-preview');
    this._sysTabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    this._sysEditors.forEach(el => el.classList.toggle('studio-hidden', !el.id.endsWith(tab)));
    if (tab === 'sys-html') {
      const el = document.getElementById('studio-code-sys-html');
      if (el) {
        const win  = document.getElementById('win-' + this._editingId);
        const body = win?.querySelector('.win-body') || win?.querySelector('.br-shell') || win;
        el.textContent = body
          ? body.innerHTML.replace(/<script[\s\S]*?<\/script>/gi, '[script removed]')
          : '// Open the app first to see live DOM';
      }
    }
  },

  saveSysOverrideFromEditor() {
    const css = document.getElementById('studio-code-sys-css')?.value || '';
    const js  = document.getElementById('studio-code-sys-js')?.value  || '';
    this.saveSysOverride(this._editingId, css, js);
    const appName = AppManifest.find(a => a.id === this._editingId)?.name || this._editingId;
    showToast(`✅ Override saved for ${appName}`);
  },

  previewSysOverride() {
    this.saveSysOverrideFromEditor();
    openApp(this._editingId);
    showToast('Applied! App opened.');
  },

  /* ── Publish to OS ── */
  publish() {
    this.saveCode();
    const apps = this.getApps();
    const app  = apps.find(a => a.id === this._editingId);
    if (!app) return;
    if (!app.name.trim()) { showToast('Give your app a name first!'); return; }
    if (app.published) {
      this.saveApps(apps);
      this._updatePublishedApp(app);
      showToast(`✅ "${app.name}" updated!`);
      this._renderEditor();
    } else {
      this._showPublishMenu(app);
    }
  },

  _showPublishMenu(app) {
    const body = document.getElementById('studio-body');
    if (!body || body.querySelector('.studio-publish-overlay')) return;
    const ov = document.createElement('div');
    ov.className = 'studio-publish-overlay';
    ov.innerHTML = `
      <div class="studio-publish-card">
        <div class="studio-publish-title"><i class="fa-solid fa-rocket"></i> Publish "${_safeText(app.name)}"</div>
        <p class="studio-publish-subtitle">How should this app live in KOS?</p>
        <div class="studio-publish-options">
          <div class="studio-publish-option" onclick="KOSStudio._doPublish('custom')">
            <div class="studio-pub-opt-icon" style="background:linear-gradient(135deg,#5e5ce6,#bf5af2)">
              <i class="fa-solid fa-window-maximize"></i>
            </div>
            <div class="studio-pub-opt-text">
              <div class="studio-pub-opt-title">Custom App</div>
              <div class="studio-pub-opt-desc">Saved locally in KOS. Fully editable. Icon appears in Dock &amp; Spotlight.</div>
            </div>
          </div>
          <div class="studio-publish-option" onclick="KOSStudio._doPublish('system')">
            <div class="studio-pub-opt-icon" style="background:linear-gradient(135deg,#007aff,#0040ff)">
              <i class="fa-solid fa-microchip"></i>
            </div>
            <div class="studio-pub-opt-text">
              <div class="studio-pub-opt-title">System App</div>
              <div class="studio-pub-opt-desc">Treated as a built-in KOS app with a system badge.</div>
            </div>
          </div>
        </div>
        <button class="studio-pub-cancel" onclick="this.closest('.studio-publish-overlay').remove()">
          <i class="fa-solid fa-xmark"></i> Cancel
        </button>
      </div>`;
    body.appendChild(ov);
  },

  _doPublish(type) {
    document.querySelector('.studio-publish-overlay')?.remove();
    const apps = this.getApps();
    const app  = apps.find(a => a.id === this._editingId);
    if (!app) return;
    app.published   = true;
    app.publishType = type;
    this.saveApps(apps);
    this._publishToOS(app);
    showToast(`${type === 'system' ? '🔧' : '🚀'} "${app.name}" is live in KOS!`);
    this._renderEditor();
  },

  /* ── OS Integration ── */
  _buildOsAppEntry(app) {
    return {
      id:        app.id,
      name:      app.name,
      iconClass: app.publishType === 'system' ? 'icon-studio' : 'icon-custom-app',
      faIcon:    app.publishType === 'system' ? 'fa-microchip' : 'fa-window-maximize',
      metadata:  { showInDock: true, searchable: true, isSystemApp: false },
      initData:  { w: 820, h: 600, offset: 0, title: app.name, bodyId: app.id + '-body', bodyClass: 'custom-app-body' },
    };
  },

  _publishToOS(app) {
    const osApp = this._buildOsAppEntry(app);
    /* Add to manifest if not already there */
    if (!AppManifest.find(a => a.id === osApp.id)) AppManifest.push(osApp);
    /* Register window with WM */
    WM.registerDynamicApp(osApp);
    WM.setOnOpen(app.id, () => this._renderCustomApp(app.id));
    /* Notify Dock, Spotlight, Task Manager */
    KOSBus.dispatch('kos:registry-changed');
  },

  _updatePublishedApp(app) {
    WM.setOnOpen(app.id, () => this._renderCustomApp(app.id));
    const osApp = AppManifest.find(a => a.id === app.id);
    if (osApp) { osApp.name = app.name; KOSBus.dispatch('kos:registry-changed'); }
    const title = document.querySelector(`#win-${app.id} .win-title`);
    if (title) title.textContent = app.name;
  },

  _unpublishFromOS(id) {
    WM.unregisterDynamicApp(id);
    const idx = AppManifest.findIndex(a => a.id === id);
    if (idx !== -1) AppManifest.splice(idx, 1);
    KOSBus.dispatch('kos:registry-changed');
  },

  _renderCustomApp(appId) {
    const body = document.getElementById(appId + '-body');
    if (!body) return;
    const app = this.getApps().find(a => a.id === appId);
    if (!app) return;
    body.style.cssText = 'padding:0;overflow:hidden;display:block;flex:1;';
    const frame = document.createElement('iframe');
    frame.style.cssText = 'width:100%;height:100%;border:none;display:block;';
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    body.innerHTML = '';
    body.appendChild(frame);
    frame.srcdoc = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>*{box-sizing:border-box}body{margin:0;font-family:sans-serif}${app.css || ''}</style>
</head><body>${app.html || ''}<script>${app.js || ''}<\/script></body></html>`;
  },

  /* ── Session restore (called from kos-init.js) ── */
  restorePublished() {
    this.getApps().filter(a => a.published).forEach(app => {
      if (!AppManifest.find(a => a.id === app.id)) this._publishToOS(app);
    });
  },

  /* ── Misc Editor helpers ── */
  switchTab(tab) {
    this._activeTab = tab;
    if (!this._appTabs)      this._appTabs      = document.querySelectorAll('.studio-tab');
    if (!this._appTextareas) this._appTextareas  = document.querySelectorAll('.studio-textarea');
    this._appTabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    this._appTextareas.forEach(ta =>
      ta.classList.toggle('studio-hidden', !ta.id.endsWith(tab))
    );
    /* Play a subtle click on tab switch */
    window.KOSSound?.play('click');
  },

  saveCode() {
    const htmlEl = document.getElementById('studio-code-html');
    const cssEl  = document.getElementById('studio-code-css');
    const jsEl   = document.getElementById('studio-code-js');
    if (!htmlEl || !cssEl || !jsEl) return;
    const apps = this.getApps();
    const app  = apps.find(a => a.id === this._editingId);
    if (!app) return;
    app.html = htmlEl.value;
    app.css  = cssEl.value;
    app.js   = jsEl.value;
    this.saveApps(apps);
  },

  saveName(name) {
    const apps = this.getApps();
    const app  = apps.find(a => a.id === this._editingId);
    if (!app) return;
    app.name = name || 'Untitled App';
    this.saveApps(apps);
    if (app.published) {
      const osApp = AppManifest.find(a => a.id === app.id);
      if (osApp) { osApp.name = app.name; KOSBus.dispatch('kos:registry-changed'); }
      const title = document.querySelector(`#win-${app.id} .win-title`);
      if (title) title.textContent = app.name;
    }
  },

  launchPreview() {
    this.saveCode();
    const app = this.getApps().find(a => a.id === this._editingId);
    if (!app) return;
    const panel = document.getElementById('studio-preview');
    const frame = document.getElementById('studio-preview-frame');
    if (!panel || !frame) return;
    panel.classList.remove('studio-hidden');
    frame.srcdoc = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>*{box-sizing:border-box}body{margin:0;font-family:sans-serif}${app.css || ''}</style>
</head><body>${app.html || ''}<script>${app.js || ''}<\/script></body></html>`;
  },

  closePreview() { document.getElementById('studio-preview')?.classList.add('studio-hidden'); },

  copyCss(css) {
    navigator.clipboard?.writeText(css).catch(() => {});
    const ta = document.querySelector('.studio-textarea:not(.studio-hidden)');
    if (ta) {
      const s = ta.selectionStart;
      ta.value = ta.value.slice(0, s) + '\n' + css + '\n' + ta.value.slice(ta.selectionEnd);
      ta.selectionStart = ta.selectionEnd = s + css.length + 2;
      ta.focus();
      this.saveCode();
    }
    showToast('CSS snippet pasted!');
  },

  createApp() {
    const id   = 'custom-' + Date.now();
    const apps = this.getApps();
    apps.push({
      id, name: 'My App',
      html: '<div class="container">\n  <h1>Hello KOS!</h1>\n  <p>Your custom app starts here.</p>\n  <button id="btn">Click me</button>\n</div>',
      css:  'body {\n  font-family: sans-serif;\n  padding: 24px;\n  background: #f5f5f5;\n}\n.container {\n  background: #fff;\n  border-radius: 14px;\n  padding: 24px;\n  max-width: 500px;\n  box-shadow: 0 4px 20px rgba(0,0,0,0.08);\n}\nh1 { color: #0063af; margin-bottom: 8px; }\nbutton {\n  margin-top: 16px;\n  padding: 10px 22px;\n  background: #0063af;\n  color: #fff;\n  border: none;\n  border-radius: 8px;\n  cursor: pointer;\n  font-size: 1rem;\n}\nbutton:hover { background: #0050a0; }',
      js:   'document.getElementById("btn").addEventListener("click", () => {\n  alert("Hello from KOS!");\n});',
      published: false,
    });
    this.saveApps(apps);
    this.editApp(id);
  },

  editApp(id) {
    this.saveCode();
    this._editingId   = id;
    this._editingType = 'custom';
    this._page        = 'editor';
    this._renderEditor();
  },

  goHome() {
    if (this._page === 'editor')    this.saveCode();
    if (this._page === 'syseditor') this.saveSysOverrideFromEditor?.();
    this._editingType = null;
    this._page        = 'home';
    this._renderHome();
  },

  deleteApp(id) {
    const apps = this.getApps();
    const app  = apps.find(a => a.id === id);
    if (!app) return;
    if (!confirm(`Delete "${app.name}"? This cannot be undone.`)) return;
    if (app.published) this._unpublishFromOS(id);
    this.saveApps(apps.filter(a => a.id !== id));
    if (this._editingId === id) this._page = 'home';
    this._renderHome();
    showToast(`"${app.name}" deleted`);
  },

  /* ── System Override helpers ── */
  getSysOverrides() {
    try { return JSON.parse(localStorage.getItem(KEY_SYS_OVERRIDES)) || {}; } catch { return {}; }
  },
  saveSysOverride(appId, css, js) {
    const all = this.getSysOverrides();
    all[appId] = { css, js };
    localStorage.setItem(KEY_SYS_OVERRIDES, JSON.stringify(all));
    applySysOverride(appId);
  },
  clearSysOverride(appId) {
    const all = this.getSysOverrides();
    delete all[appId];
    localStorage.setItem(KEY_SYS_OVERRIDES, JSON.stringify(all));
    document.querySelector(`#win-${appId} .sys-override-style`)?.remove();
    showToast('Override cleared');
  },

  showHelp() {
    const body = document.getElementById('studio-body');
    if (!body || body.querySelector('.studio-help-overlay')) return;
    const ov = document.createElement('div');
    ov.className = 'studio-help-overlay';
    ov.innerHTML = `
      <div class="studio-help-card">
        <div class="studio-help-title"><i class="fa-solid fa-code"></i>&nbsp;How KOS Studio Works</div>
        <div class="studio-help-steps">
          <div class="studio-help-step"><span class="studio-step-num">1</span>
            <div><b>Create a new app</b><p>Click "Create New App". Your app gets a starter template with HTML, CSS, and JS.</p></div></div>
          <div class="studio-help-step"><span class="studio-step-num">2</span>
            <div><b>Write code in the editor</b><p>Use the HTML / CSS / JS tabs. Click any CSS snippet on the left sidebar to paste it.</p></div></div>
          <div class="studio-help-step"><span class="studio-step-num">3</span>
            <div><b>Launch to preview</b><p>Click <b>Launch</b> to run your app in the preview panel before publishing.</p></div></div>
          <div class="studio-help-step"><span class="studio-step-num">4</span>
            <div><b>Publish to OS</b><p>Click <b>Publish to OS</b> — your app instantly appears in Dock, Spotlight, and Task Manager.</p></div></div>
          <div class="studio-help-step"><span class="studio-step-num">5</span>
            <div><b>Manage &amp; iterate</b><p>Edit any time. Click "Update OS" to push changes live. Delete an app to remove it completely.</p></div></div>
        </div>
        <button class="studio-help-close" onclick="this.closest('.studio-help-overlay').remove()">Got it!</button>
      </div>`;
    body.appendChild(ov);
  },

  _buildCssBrowser() {
    const snippets = [
      { name: 'Glass Effect',   css: `.glass {\n  background: rgba(255,255,255,0.45);\n  backdrop-filter: blur(25px);\n  border-radius: 18px;\n  border: 1px solid rgba(255,255,255,0.5);\n}` },
      { name: 'Brand Colors',   css: `:root {\n  --brand: #0063af;\n  --neon: #00d4ff;\n  --ease-spring: cubic-bezier(0.34,1.56,0.64,1);\n}` },
      { name: 'App Icon',       css: `.app-icon {\n  width: 52px; height: 52px;\n  border-radius: 26%;\n  display: flex; align-items: center;\n  justify-content: center;\n  color: #fff;\n  box-shadow: 0 4px 16px rgba(0,0,0,0.25);\n}` },
      { name: 'Win Body',       css: `.win-body {\n  overflow-y: auto;\n  padding: 20px;\n  display: flex;\n  flex-direction: column;\n  gap: 24px;\n}` },
      { name: 'Card / Section', css: `.card {\n  background: rgba(0,0,0,0.04);\n  border-radius: 12px;\n  padding: 14px 16px;\n}` },
      { name: 'Toggle Switch',  css: `.toggle {\n  width: 42px; height: 24px;\n  border-radius: 999px;\n  background: #ccc;\n  transition: background 0.25s;\n}\n.toggle.on { background: #34c759; }` },
      { name: 'Pill Button',    css: `.pill-btn {\n  padding: 8px 17px;\n  border-radius: 999px;\n  border: 1px solid rgba(0,99,175,0.3);\n  background: rgba(0,99,175,0.08);\n  color: #0063af;\n  cursor: pointer;\n}` },
      { name: 'Traffic Lights', css: `.tl-red    { background: #ff5f57; }\n.tl-yellow { background: #ffbd2e; }\n.tl-green  { background: #28c840; }` },
      { name: 'Calculator Dark',css: `.calc-wrap {\n  background: #1c1c1e;\n  color: #fff;\n  border-radius: 16px;\n}\n.calc-display { font-size: 3rem; text-align: right; }` },
      { name: 'Toast',          css: `#toast {\n  position: fixed; bottom: 100px;\n  left: 50%; transform: translateX(-50%);\n  background: rgba(30,30,30,0.88);\n  color: #fff; border-radius: 22px;\n  padding: 9px 22px;\n}` },
    ];
    return snippets.map(s => `
      <div class="studio-css-item">
        <div class="studio-css-name">${s.name}</div>
        <div class="studio-css-preview">${_safeText(s.css.slice(0, 55))}…</div>
        <button class="studio-copy-btn" title="Copy &amp; paste into editor"
          onclick='KOSStudio.copyCss(${JSON.stringify(s.css)})'>
          <i class="fa-solid fa-copy"></i>
        </button>
      </div>`).join('');
  },
};

window.KOSApps.studio = KOSStudio;

/* Register init hook with WM */
WM.setOnOpen('studio', () => KOSStudio.open());
