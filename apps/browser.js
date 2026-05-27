/* ══════════════════════════════════════════════════════════════
   KOS ULTIMATE 2026 — apps/browser.js
   Fix: removed KOSFS.registerApp + await KOSFS.ready — the
   browser never calls any KOSFS file operation so the
   registration was dead overhead.
   ══════════════════════════════════════════════════════════════ */

window.KOSApps = window.KOSApps || {};

window.KOSApps.browser = {
  history: [],
  historyIndex: -1,

  init() {
    /* No KOSFS operations performed — registration removed */
    this.renderUI();
    this.bindEvents();
    this.navigateTo('https://en.wikipedia.org');
  },

  renderUI() {
    const body = document.getElementById('browser-body');
    if (!body) return;

    body.innerHTML = `
      <div class="chrome-container">
        <div class="chrome-navbar">
          <div class="chrome-actions">
            <button class="chrome-btn" id="br-back" disabled>
              <i class="fas fa-arrow-left"></i>
            </button>
            <button class="chrome-btn" id="br-forward" disabled>
              <i class="fas fa-arrow-right"></i>
            </button>
            <button class="chrome-btn" id="br-refresh">
              <i class="fas fa-redo"></i>
            </button>
          </div>
          <div class="chrome-omnibox">
            <i class="fas fa-lock" id="br-lock-icon"></i>
            <input type="text" class="chrome-input" id="br-url-input"
                   placeholder="Search or type a URL" />
          </div>
        </div>
        <div class="chrome-content">
          <iframe class="chrome-frame" id="br-iframe" src="about:blank"></iframe>
        </div>
      </div>
    `;
  },

  bindEvents() {
    const input     = document.getElementById('br-url-input');
    const backBtn   = document.getElementById('br-back');
    const forwardBtn = document.getElementById('br-forward');
    const refreshBtn = document.getElementById('br-refresh');
    const iframe    = document.getElementById('br-iframe');

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        let url = input.value.trim();
        if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
        this.navigateTo(url);
      }
    });

    backBtn.addEventListener('click',    () => this.goBack());
    forwardBtn.addEventListener('click', () => this.goForward());
    refreshBtn.addEventListener('click', () => { if (iframe) iframe.src = iframe.src; });
  },

  navigateTo(url) {
    const iframe = document.getElementById('br-iframe');
    const input  = document.getElementById('br-url-input');
    if (!iframe) return;

    if (this.historyIndex === -1 || this.history[this.historyIndex] !== url) {
      this.history = this.history.slice(0, this.historyIndex + 1);
      this.history.push(url);
      this.historyIndex++;
    }

    input.value = url;
    iframe.src  = url;
    this.updateNavButtons();
  },

  goBack() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.navigateTo(this.history[this.historyIndex]);
    }
  },

  goForward() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.navigateTo(this.history[this.historyIndex]);
    }
  },

  updateNavButtons() {
    const backBtn    = document.getElementById('br-back');
    const forwardBtn = document.getElementById('br-forward');
    if (backBtn)    backBtn.disabled    = this.historyIndex <= 0;
    if (forwardBtn) forwardBtn.disabled = this.historyIndex >= this.history.length - 1;
  },
};

WM.setOnOpen('browser', () => window.KOSApps.browser.init());
