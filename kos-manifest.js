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
    permissions: ['photos'],
    metadata: { showInDock: true, searchable: true, isSystemApp: true },
    initData: {
      ...winSize(62, [16, 9]),
      ratio: [16, 9], size: 62,
      offset: 0, bodyId: 'gallery-body', special: 'gallery',
    },
  },

  {
    id        : 'files',
    name      : 'Files',
    iconClass : 'icon-files',
    faIcon    : 'fa-folder',
    jsPath    : 'apps/files.js',
    cssPath   : 'css/apps/files.css',
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
    permissions: [],
    metadata: { showInDock: false, searchable: true, isSystemApp: true },
    initData: {
      ...winSize(32, [3, 5]),
      ratio: [3, 5], size: 32,
      offset: 90, bodyId: 'calc-body',
      bodyClass: 'calc-body-wrap',
    },
  },

  {
    id        : 'terminal',
    name      : 'Terminal',
    iconClass : 'icon-terminal',
    faIcon    : 'fa-terminal',
    jsPath    : 'terminal.js', 
    cssPath   : 'css/terminal.css',
    permissions: ['*'], 
    metadata  : { showInDock: true, searchable: true, isSystemApp: true },
    initData  : {
      ...winSize(55, [3, 2]),
      ratio: [3, 2], size: 55,
      offset: 40,
      bodyId: 'terminal-body',
      bodyClass: 'terminal-body-wrap'
    }
  },

  {
    id          : 'browser',
    name        : 'Web Browser',
    iconClass   : 'icon-browser',
    faIcon      : 'fa-compass',
    jsPath      : 'apps/browser.js',
    cssPath     : 'css/apps/browser.css',
    permissions : ['photos', 'documents'], 
    metadata    : { showInDock: true, searchable: true, isSystemApp: false },
    initData    : { width: 800, height: 600, bodyId: 'browser-body' },
  },

  {
    id        : 'studio',
    name      : 'KOS Studio',
    iconClass : 'icon-studio',
    faIcon    : 'fa-code',
    jsPath    : 'apps/studio.js',
    cssPath   : 'css/apps/studio.css',
    permissions: ['apps', 'documents'],
    metadata: { showInDock: true, searchable: true, isSystemApp: true },
    initData: {
      ...winSize(78, [16, 9]),
      ratio: [16, 9], size: 78,
      offset: 0, bodyId: 'studio-body',
    },
  },

  /* ══════════════════════════════════════════════════════════
     ACTIVATED & DEPLOYED APP OBJECTS
  ══════════════════════════════════════════════════════════ */

  {
    id        : 'music',
    name      : 'Music',
    iconClass : 'icon-music',
    faIcon    : 'fa-music',
    jsPath    : 'apps/music.js',              // Linked script
    cssPath   : 'css/apps/music.css',          // Linked styles
    permissions: ['audios', 'videos'],
    metadata: { showInDock: true, searchable: true, isSystemApp: false },
    initData: {
      ...winSize(60, [16, 10]),                // Set fluid desktop footprint dimensions
      ratio: [16, 10], size: 60,
      offset: 30, bodyId: 'music-body',
    },
  },

  {
    id        : 'videos',
    name      : 'Videos',
    iconClass : 'icon-videos',
    faIcon    : 'fa-film',
    jsPath    : 'apps/videos.js',              // Linked code module script target
    cssPath   : 'css/apps/videos.css',          // Linked layout styling rules
    permissions: ['videos', 'audios'],
    metadata: { showInDock: true, searchable: true, isSystemApp: false },
    initData: {
      ...winSize(64, [16, 9]),                 // Fluid canvas responsive design footprints
      ratio: [16, 9], size: 64,
      offset: 35, bodyId: 'videos-body',
    },
  },

  {
    id        : 'voicerecorder',
    name      : 'Voice Recorder',
    iconClass : 'icon-recorder',
    faIcon    : 'fa-microphone',
    jsPath    : null,
    cssPath   : null,
    permissions: ['audios'],
    metadata: { showInDock: false, searchable: true, isSystemApp: false },
    initData: null,
  },

];