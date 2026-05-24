/* ══════════════════════════════════════════════════════════════
   KOS ULTIMATE 2026 — apps/about.js
   About KOS — system info, version, developer details.
   Works like macOS "About This Mac" / Windows "winver".

   VERSION INFO IS NOW IN kos-version.js — do not edit here.
   All ABOUT_INFO fields are read directly from KOS_VERSION.
   ══════════════════════════════════════════════════════════════ */

window.KOSApps = window.KOSApps || {};

/* Safe accessor — falls back gracefully if kos-version.js
   somehow wasn't loaded (should never happen in production). */
const _V = (typeof KOS_VERSION !== 'undefined') ? KOS_VERSION : {
  osName      : 'KOS Ultimate',
  edition     : '2026 Edition',
  version     : 'Alpha 9',
  build       : '9.0.2026',
  buildLabel  : 'Alpha Release',
  releaseDate : 'May 23, 2026',
  license     : 'Personal Use License',
  developer   : 'Kalapurackal Studios',
  devHandle   : '@kalapurackalstudios',
  website     : 'na',
  copyright   : '© 2021 – 2026 Kalapurackal Studios. All rights reserved.',
  tagline     : 'Crafted with care. Built for flow.',
  displayVer  : 'Alpha 9 · 9.0.2026',
};

window.KOSApps.about = {
  init() {
    const body = document.querySelector('.about-body') || document.getElementById('about-body');
    if (!body) return;

    /* ── Live system data ── */
    const ua      = navigator.userAgent;
    const platform = navigator.platform || '—';
    const lang    = navigator.language  || '—';
    const cores   = navigator.hardwareConcurrency || '—';
    const mem     = navigator.deviceMemory ? navigator.deviceMemory + ' GB' : '—';
    const screenW = window.screen.width;
    const screenH = window.screen.height;
    const dpr     = window.devicePixelRatio?.toFixed(1) || '1.0';

    let engine = 'Unknown';
    if (ua.includes('Chrome'))       engine = 'Blink (Chrome)';
    else if (ua.includes('Firefox')) engine = 'Gecko (Firefox)';
    else if (ua.includes('Safari'))  engine = 'WebKit (Safari)';

    body.innerHTML = `
      <!-- Hero -->
      <div class="ab-hero">
        <div class="ab-logo-ring">
          <div class="ab-logo-icon"><i class="fa-solid fa-k"></i></div>
        </div>
        <div class="ab-hero-text">
          <h1 class="ab-os-name">${_V.osName}</h1>
          <p  class="ab-edition">${_V.edition}</p>
          <p  class="ab-tagline">${_V.tagline}</p>
        </div>
      </div>

      <div class="ab-divider"></div>

      <!-- Version info — all from KOS_VERSION -->
      <div class="ab-section">
        <h2 class="ab-section-title">Version Info</h2>
        <div class="ab-info-grid">
          ${_abRow('Version',     _V.version)}
          ${_abRow('Build',       _V.build)}
          ${_abRow('Type',        _V.buildLabel ?? _V.buildType ?? '—')}
          ${_abRow('Released',    _V.releaseDate)}
          ${_abRow('Code Name',   _V.codeName   ?? '—')}
          ${_abRow('License',     _V.license)}
        </div>
      </div>

      <div class="ab-divider"></div>

      <!-- Live system info -->
      <div class="ab-section">
        <h2 class="ab-section-title">System</h2>
        <div class="ab-info-grid">
          ${_abRow('CPU Threads',   cores)}
          ${_abRow('Memory',        mem)}
          ${_abRow('Display',       screenW + ' × ' + screenH + ' @ ' + dpr + 'x')}
          ${_abRow('Language',      lang)}
          ${_abRow('Platform',      platform)}
          ${_abRow('Render Engine', engine)}
        </div>
      </div>

      <div class="ab-divider"></div>

      <!-- Developer -->
      <div class="ab-section">
        <h2 class="ab-section-title">Developer</h2>
        <div class="ab-dev-card">
          <div class="ab-dev-avatar"><i class="fa-solid fa-user-tie"></i></div>
          <div class="ab-dev-info">
            <span class="ab-dev-name">${_V.developer}</span>
            <span class="ab-dev-handle">${_V.devHandle}</span>
            <span class="ab-dev-web">${_V.website}</span>
          </div>
        </div>
      </div>

      <p class="ab-copyright">${_V.copyright}</p>
    `;
  },
};

function _abRow(label, value) {
  return `
    <div class="ab-row">
      <span class="ab-row-label">${label}</span>
      <span class="ab-row-value">${value}</span>
    </div>`;
}

WM.setOnOpen('about', () => window.KOSApps.about.init());
