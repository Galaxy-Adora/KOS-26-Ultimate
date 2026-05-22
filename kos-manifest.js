/*!
 * kos-manifest.js — Application Registry
 * ========================================
 * KOS Ultimate 2026 — Updated for Alpha 9 (KOSFS integration)
 *
 * CHANGE FROM ALPHA 8
 * ────────────────────
 * Each app entry now has a  `permissions`  field — an array of
 * KOSFS scope strings. This declares which file types the app
 * is allowed to read and write via the KOS Filesystem kernel.
 *
 * PERMISSION SCOPES
 * ─────────────────
 *   'photos'    → IMAGE files
 *   'videos'    → VIDEO files
 *   'audios'    → AUDIO files
 *   'documents' → DOCUMENT files
 *   'apps'      → APP files  (Studio only)
 *   '*'         → full access (system apps: files, uimanager)
 *
 * The  permissions  array is read by  KOSFS.registerApp()  in
 * each app's  init()  function. The manifest field is the single
 * source of truth — your app code never hardcodes scopes.
 *
 * ADDING A NEW APP
 * ─────────────────
 * 1. Add entry here (with appropriate permissions array)
 * 2. Add <script defer src="apps/myapp.js"> in index.html
 * 3. Create  apps/myapp.js  and  css/apps/myapp.css
 * 4. In myapp.js init(), call:
 *      const myPerms = AppManifest.find(a => a.id === 'myapp').permissions;
 *      KOSFS.registerApp('myapp', myPerms);
 *
 * © 2021–2026 Kalapurackal Studios. All rights reserved.
 */

'use strict';

/* ─────────────────────────────────────────────────────────────
   Responsive window sizing helper (unchanged from previous builds)
───────────────────────────────────────────────────────────── */
function winSize(pct, [rw, rh]) {
  const vw = window.innerWidth  * (pct / 100);
  const vh = window.innerHeight * (pct / 100);
  const h  = Math.min(vw * (rh / rw), window.innerHeight * 0.88);
  return { width: Math.round(vw), height: Math.round(h) };
}

/* ─────────────────────────────────────────────────────────────
   AppManifest — single source of truth for all KOS applications
───────────────────────────────────────────────────────────── */
const AppManifest = [

  /* ══════════════════════════════════════════════════════════
     SYSTEM APPS
  ══════════════════════════════════════════════════════════ */

  {
    id        : 'uimanager',
    name      : 'Settings',
    iconClass : 'icon-settings',
    faIcon    : 'fa-sliders-h',
    jsPath    : 'apps/ui-manager.js',
    cssPath   : 'css/apps/ui-manager.css',

    /**
     * Settings needs full access so it can display the Storage section
     * (file counts and sizes across ALL types) and allow the user to
     * manage / delete files from within Settings → Storage.
     */
    permissions: ['*'],

    metadata: { showInDock: true, searchable: true, isSystemApp: true },
    initData: {
      ...winSize(52, [16, 10]),
      ratio: [16, 10], size: 52,
      offset: 0, bodyId: 'uim-body',
    },
  },

  {
    id        : 'taskmanager',
    name      : 'Task Manager',
    iconClass : 'icon-taskmanager',
    faIcon    : 'fa-tachometer-alt',
    jsPath    : 'apps/task-mgr.js',
    cssPath   : 'css/apps/task-mgr.css',

    /**
     * Task Manager doesn't directly read/write user files —
     * it only monitors running processes. No file permissions needed.
     */
    permissions: [],

    metadata: { showInDock: false, searchable: true, isSystemApp: true },
    initData: {
      ...winSize(42, [4, 3]),
      ratio: [4, 3], size: 42,
      offset: 60, bodyId: 'task-body',
    },
  },

  {
    id        : 'about',
    name      : 'About KOS',
    iconClass : 'icon-about',
    faIcon    : 'fa-info-circle',
    jsPath    : 'apps/about.js',
    cssPath   : 'css/apps/about.css',

    /** About app only shows system info — no file access required. */
    permissions: [],

    metadata: { showInDock: false, searchable: true, isSystemApp: true },
    initData: {
      ...winSize(36, [3, 4]),
      ratio: [3, 4], size: 36,
      offset: 80, bodyId: 'about-body',
    },
  },

  {
    id        : 'releasenotes',
    name      : 'Release Notes',
    iconClass : 'icon-releasenotes',
    faIcon    : 'fa-clipboard-list',
    jsPath    : 'apps/release-notes.js',
    cssPath   : 'css/apps/release-notes.css',

    /** Release Notes is read-only static content — no file permissions. */
    permissions: [],

    metadata: { showInDock: false, searchable: true, isSystemApp: true },
    initData: {
      ...winSize(40, [2, 3]),
      ratio: [2, 3], size: 40,
      offset: 90, bodyId: 'relnotes-body',
    },
  },

  /* ══════════════════════════════════════════════════════════
     USER-FACING MEDIA & FILE APPS
  ══════════════════════════════════════════════════════════ */

  {
    id        : 'gallery',
    name      : 'Photos',
    iconClass : 'icon-photos',
    faIcon    : 'fa-images',
    jsPath    : 'apps/photos.js',
    cssPath   : 'css/apps/photos.css',

    /**
     * Photos app only works with image files.
     * It will NOT see videos, audio, or documents in KOSFS.list().
     */
    permissions: ['photos'],

    metadata: { showInDock: true, searchable: true, isSystemApp: true },
    initData: {
      ...winSize(62, [16, 9]),
      ratio: [16, 9], size: 62,
      offset: 0, bodyId: 'gallery-body',
    },
  },

  {
    id        : 'files',
    name      : 'Files',
    iconClass : 'icon-files',
    faIcon    : 'fa-folder',
    jsPath    : 'apps/files.js',
    cssPath   : 'css/apps/files.css',

    /**
     * Files app is the universal file browser — it can see and manage
     * every file type stored in KOSFS.
     * '*' is equivalent to ['photos','videos','audios','documents','apps']
     * but using '*' is more future-proof as new types are added.
     */
    permissions: ['*'],

    metadata: { showInDock: true, searchable: true, isSystemApp: true },
    initData: {
      ...winSize(58, [4, 3]),
      ratio: [4, 3], size: 58,
      offset: 0, bodyId: 'files-body',
    },
  },

  {
    id        : 'notes',
    name      : 'Notes',
    iconClass : 'icon-notes',
    faIcon    : 'fa-sticky-note',
    jsPath    : 'apps/notes.js',
    cssPath   : 'css/apps/notes.css',

    /**
     * Notes only reads and writes text documents.
     * Photos, videos, and audio files are not visible to it.
     */
    permissions: ['documents'],

    metadata: { showInDock: true, searchable: true, isSystemApp: true },
    initData: {
      ...winSize(52, [16, 10]),
      ratio: [16, 10], size: 52,
      offset: 20, bodyId: 'notes-body',
    },
  },

  /* ══════════════════════════════════════════════════════════
     UTILITY APPS
  ══════════════════════════════════════════════════════════ */

  {
    id        : 'calculator',
    name      : 'Calculator',
    iconClass : 'icon-calculator',
    faIcon    : 'fa-calculator',
    jsPath    : 'apps/calculator.js',
    cssPath   : 'css/apps/calculator.css',

    /** Pure computation — no file system access needed. */
    permissions: [],

    metadata: { showInDock: false, searchable: true, isSystemApp: true },
    initData: {
      ...winSize(32, [3, 5]),
      ratio: [3, 5], size: 32,
      offset: 90, bodyId: 'calc-body',
      bodyClass: 'calc-body-wrap',
    },
  },
  /* ── Root System Terminal ─────────── 3:2 @ 55% ── */
  {
    id: 'terminal',
    name: 'Terminal',
    iconClass: 'icon-terminal',
    faIcon: 'fa-terminal',
    jsPath: 'terminal.js', // Located right in the main root directory
    cssPath: 'css/terminal.css', // Keeping CSS tucked away to keep your root clean
    metadata: { 
      showInDock: true, 
      searchable: true, 
      isSystemApp: true // Marked as a system-level app
    },
    initData: {
      ...winSize(55, [3, 2]),
      ratio: [3, 2], size: 55,
      offset: 40,
      bodyId: 'terminal-body',
      bodyClass: 'terminal-body-wrap'
    }
  },
  {
    id        : 'browser',
    name      : 'Smooth Browser',
    iconClass : 'icon-browser',
    faIcon    : 'fa-globe',
    jsPath    : 'apps/browser.js',
    cssPath   : 'css/apps/browser.css',

    /**
     * Browser can download files to KOSFS (e.g. "Save page as document").
     * It needs documents write permission for that feature.
     * Extend to ['photos','documents'] if you add image saving later.
     */
    permissions: ['documents'],

    metadata: { showInDock: true, searchable: true, isSystemApp: true },
    initData: {
      ...winSize(72, [16, 10]),
      ratio: [16, 10], size: 72,
      offset: 0, bodyId: 'browser-body',
    },
  },

  {
    id        : 'studio',
    name      : 'KOS Studio',
    iconClass : 'icon-studio',
    faIcon    : 'fa-code',
    jsPath    : 'apps/studio.js',
    cssPath   : 'css/apps/studio.css',

    /**
     * Studio creates and manages custom apps.
     * 'apps' scope lets it read/write APP-type files in KOSFS.
     * It can also read documents (to import code/text files).
     */
    permissions: ['apps', 'documents'],

    metadata: { showInDock: true, searchable: true, isSystemApp: true },
    initData: {
      ...winSize(78, [16, 9]),
      ratio: [16, 9], size: 78,
      offset: 0, bodyId: 'studio-body',
    },
  },
   /* ── Root System Terminal ─────────── 3:2 @ 55% ── */
  {
    id: 'terminal',
    name: 'Terminal',
    iconClass: 'icon-terminal',
    faIcon: 'fa-terminal',
    jsPath: 'terminal.js',          // Main root folder
    cssPath: 'css/terminal.css',    // Custom root-level CSS path
    metadata: { 
      showInDock: true, 
      searchable: true, 
      isSystemApp: true 
    },
    initData: {
      ...winSize(55, [3, 2]),
      ratio: [3, 2], size: 55,
      offset: 40,
      bodyId: 'terminal-body',
      bodyClass: 'terminal-body-wrap'
    }
  },
  /* ══════════════════════════════════════════════════════════
     COMING SOON APPS (jsPath: null = launch bounce + toast)
  ══════════════════════════════════════════════════════════ */

  {
    id        : 'music',
    name      : 'Music',
    iconClass : 'icon-music',
    faIcon    : 'fa-music',
    jsPath    : null,
    cssPath   : null,

    /**
     * When implemented, Music will need audio (and possibly video for music videos).
     * Declaring it now means no manifest change is needed when the app ships.
     */
    permissions: ['audios', 'videos'],

    metadata: { showInDock: true, searchable: true, isSystemApp: false },
    initData: null,
  },

  {
    id        : 'videos',
    name      : 'Videos',
    iconClass : 'icon-videos',
    faIcon    : 'fa-film',
    jsPath    : null,
    cssPath   : null,

    /** Video player — needs video files and optionally audio. */
    permissions: ['videos', 'audios'],

    metadata: { showInDock: true, searchable: true, isSystemApp: false },
    initData: null,
  },

  {
    id        : 'voicerecorder',
    name      : 'Voice Recorder',
    iconClass : 'icon-recorder',
    faIcon    : 'fa-microphone',
    jsPath    : null,
    cssPath   : null,

    /** Voice Recorder writes audio files, reads them back for playback. */
    permissions: ['audios'],

    metadata: { showInDock: false, searchable: true, isSystemApp: false },
    initData: null,
  },

];
