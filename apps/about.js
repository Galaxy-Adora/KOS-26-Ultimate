/* ══════════════════════════════════════════════════════════════
   KOS ULTIMATE 2026 — apps/about.js
   About KOS — system info, version, developer details.
   Works like macOS "About This Mac" / Windows "winver".

   HOW TO UPDATE THIS PAGE:
   ─ Change version, build date, or developer info in the
     ABOUT_INFO block below. Everything else renders automatically.
   ══════════════════════════════════════════════════════════════ */

window.KOSApps = window.KOSApps || {};

/* ── ✏️  EDIT HERE — all display strings live in this one block ── */
const ABOUT_INFO = {
  osName:       'KOS Ultimate',
  edition:      '2026 Edition',
  version:      'Alpha 6',
  build:        'Build 6.0 (Unstable)',
  launchDate:   'April 3, 2026',
  developer:    'Kalapurackal Studios',
  devHandle:    '@kalapurackalstudios',
  website:      'na',
  copyright:    '© 2021 – 2026 Kalapurackal Studios. All rights reserved.',
  license:      'Personal Use License',
  tagline:      'Crafted with care. Built for flow.',
};
/* ─────────────────────────────────────────────────────────────── */

window.KOSApps.about = {
  init() {
    const body = document.querySelector('.about-body') || document.getElementById('about-body');
    if (!body) return;

    /* ── Gather live system data ── */
    const ua       = navigator.userAgent;
    const platform = navigator.platform || '—';
    const lang     = navigator.language || '—';
    const cores    = navigator.hardwareConcurrency || '—';
    const mem      = navigator.deviceMemory ? navigator.deviceMemory + ' GB' : '—';
    const screenW  = window.screen.width;
    const screenH  = window.screen.height;
    const dpr      = window.devicePixelRatio?.toFixed(1) || '1.0';

    /* Browser engine sniff */
    let engine = 'Unknown';
    if (ua.includes('Chrome'))  engine = 'Blink (Chrome)';
    else if (ua.includes('Firefox')) engine = 'Gecko (Firefox)';
    else if (ua.includes('Safari'))  engine = 'WebKit (Safari)';

    body.innerHTML = `
      <!-- ── Hero block ── -->
      <div class="ab-hero">
        <div class="ab-logo-ring">
          <div class="ab-logo-icon">
            <i class="fa-solid fa-k"></i>
          </div>
        </div>
        <div class="ab-hero-text">
          <h1 class="ab-os-name">${ABOUT_INFO.osName}</h1>
          <p  class="ab-edition">${ABOUT_INFO.edition}</p>
          <p  class="ab-tagline">${ABOUT_INFO.tagline}</p>
        </div>
      </div>

      <div class="ab-divider"></div>

      <!-- ── Version block ── -->
      <div class="ab-section">
        <h2 class="ab-section-title">Version Info</h2>
        <div class="ab-info-grid">
          ${_abRow('Version',     ABOUT_INFO.version)}
          ${_abRow('Build',       ABOUT_INFO.build)}
          ${_abRow('Launched',    ABOUT_INFO.launchDate)}
          ${_abRow('License',     ABOUT_INFO.license)}
        </div>
      </div>

      <div class="ab-divider"></div>

      <!-- ── System block ── -->
      <div class="ab-section">
        <h2 class="ab-section-title">System</h2>
        <div class="ab-info-grid">
          ${_abRow('CPU Threads', cores)}
          ${_abRow('Memory',      mem)}
          ${_abRow('Display',     screenW + ' × ' + screenH + ' @ ' + dpr + 'x')}
          ${_abRow('Language',    lang)}
          ${_abRow('Platform',    platform)}
          ${_abRow('Render Engine', engine)}
        </div>
      </div>

      <div class="ab-divider"></div>

      <!-- ── Developer block ── -->
      <div class="ab-section">
        <h2 class="ab-section-title">Developer</h2>
        <div class="ab-dev-card">
          <div class="ab-dev-avatar">
            <i class="fa-solid fa-user-tie"></i>
          </div>
          <div class="ab-dev-info">
            <span class="ab-dev-name">${ABOUT_INFO.developer}</span>
            <span class="ab-dev-handle">${ABOUT_INFO.devHandle}</span>
            <span class="ab-dev-web">${ABOUT_INFO.website}</span>
          </div>
        </div>
      </div>

      <!-- ── Copyright footer ── -->
      <p class="ab-copyright">${ABOUT_INFO.copyright}</p>
    `;
  },
};

/* Small helper — renders a label/value row */
function _abRow(label, value) {
  return `
    <div class="ab-row">
      <span class="ab-row-label">${label}</span>
      <span class="ab-row-value">${value}</span>
    </div>`;
}

/* Register init hook with WM */
WM.setOnOpen('about', () => window.KOSApps.about.init());