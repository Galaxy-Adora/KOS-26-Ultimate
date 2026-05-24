/* ══════════════════════════════════════════════════════════════
   KOS ULTIMATE 2026 — kos-version.js
   System Version Manifest — Single Source of Truth

   THIS IS THE ONLY FILE YOU EDIT WHEN RELEASING A NEW VERSION.

   Every place in KOS that shows version info reads from this
   object — About KOS, Settings → About, Release Notes, the
   Terminal sysinfo command, and sys-manifest.js all pull from
   KOS_VERSION automatically.

   LOAD ORDER (index.html — must be FIRST, before everything)
   ─────────────────────────────────────────────────────────────
     <script defer src="kos-version.js"></script>   ← line 1
     <script defer src="kos-manifest.js"></script>
     <script defer src="sys-manifest.js"></script>
     ...

   HOW TO CUT A NEW RELEASE — change these fields only:
   ─────────────────────────────────────────────────────────────
     version      → 'Alpha 10'
     versionNum   → 10
     build        → '10.0.2026'
     buildType    → 'alpha' | 'beta' | 'rc' | 'stable'
     buildLabel   → 'Alpha Release' | 'Beta' | 'Release Candidate' | 'Stable'
     releaseDate  → 'June 1, 2026'
     releaseDateISO → '2026-06-01'
     codeName     → 'Nova'   (optional per-release codename)

   Everything else (osName, developer, copyright …) only changes
   when the product itself changes, not per build.
   ══════════════════════════════════════════════════════════════ */

'use strict';

const KOS_VERSION = Object.freeze({

  /* ── Product identity (rarely changes) ─────────────────── */
  osName      : 'KOS Ultimate',
  edition     : '2026 Edition',
  tagline     : 'Crafted with care. Built for flow.',
  license     : 'Personal Use License',

  /* ── ✏️  UPDATE THESE ON EVERY RELEASE ─────────────────── */
  version        : 'Alpha 9',          // human-readable version label
  versionNum     : '9',                  // integer — used for comparisons
  build          : '9.0.2026',         // build identifier shown in UI
  buildType      : 'alpha',            // 'alpha' | 'beta' | 'rc' | 'stable'
  buildLabel     : 'Alpha Release',    // tag shown in Release Notes card
  buildStability : 'Unstable',         // 'Unstable' | 'Beta' | 'RC' | 'Stable'
  codeName       : 'Zenith',           // optional release codename
  releaseDate    : 'May 24, 2026',     // displayed in About + Release Notes
  releaseDateISO : '2026-05-24',       // ISO 8601 — machine-readable

  /* ── Developer (changes only if studio name changes) ───── */
  developer   : 'Galaxy Adora',
  devHandle   : '@galaxy_adora',
  website     : 'https://galaxy-adora.github.io/KOS-26-Ultimate/',
  copyright   : '© 2021 – 2026 Kalapurackal Studios. All rights reserved.',

  /* ── Pre-composed display strings ───────────────────────
     Computed once here so every app gets the exact same
     formatted string without independently concatenating. */
  get displayFull()    { return `${this.osName} ${this.edition} · ${this.version}`; },
  get displayShort()   { return `${this.version} (${this.build})`; },
  get displayBuild()   { return `Build ${this.build} · ${this.buildLabel}`; },
  get displayProduct() { return `${this.osName} ${this.edition}`; },
  get displayVer()     { return `${this.version} · ${this.build}`; },
  get displayBadge()   { return `v${this.version}`; },
  get displayFull2()   { return `${this.osName} 2026 · ${this.displayBuild}`; },

});
