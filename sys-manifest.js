/* ══════════════════════════════════════════════════════════════
   KOS ULTIMATE 2026 — sys-manifest.js
   System File Manifest

   Declares every source file present in the KOS project tree.
   Read by the terminal's  systree  command to render the
   project filesystem without needing server-side access.

   LOAD ORDER  (in index.html, directly after kos-manifest.js)
   ─────────────────────────────────────────────────────────────
     <script defer src="kos-manifest.js"></script>
     <script defer src="sys-manifest.js"></script>   ← ADD HERE
     <script defer src="kos-kernel.js"></script>

   HOW TO KEEP THIS UP TO DATE
   ─────────────────────────────────────────────────────────────
   Whenever you add, rename, or delete a project file:
     1. Add / update / remove its entry in KOS_SYS_MANIFEST.files
     2. Bump  version  and  updated  at the top
   The systree command reads only this file — nothing else needs
   to change.
   ══════════════════════════════════════════════════════════════ */

'use strict';

const KOS_SYS_MANIFEST = Object.freeze({

  /* ── Build metadata ─────────────────────────────────────── */
  name    : 'KOS Ultimate 2026',
  version : '9.0.2026',
  alpha   : 9,
  updated : '2026-05-23',

  /* ── File categories (used as column labels in systree) ─── */
  CATS: Object.freeze({
    KERNEL  : 'kernel',   // core runtime files in /
    APP     : 'app',      // app modules in /apps
    CSS     : 'css',      // stylesheets in /css
    CSS_APP : 'css-app',  // per-app stylesheets in /css/apps
    ASSET   : 'asset',    // media / static assets in /documents
    CONFIG  : 'config',   // config / manifest files
    DOC     : 'doc',      // documentation files
  }),

  /* ══════════════════════════════════════════════════════════
     FILE TABLE
     Each entry:
       path  — relative path from project root
       size  — exact byte count (from build)
       cat   — one of CATS.*
       desc  — one-line description
  ══════════════════════════════════════════════════════════ */
  files: [

    /* ── Root / kernel layer ─────────────────────────────── */
    {
      path : 'index.html',
      size : 13807,
      cat  : 'kernel',
      desc : 'Main HTML entry point — loads all scripts, CSS, and PWA hooks',
    },
    {
      path : 'kos-manifest.js',
      size : 8509,
      cat  : 'kernel',
      desc : 'Application registry — id, icon, permissions, window sizing for every app',
    },
    {
      path : 'sys-manifest.js',
      size : 6200,           // approximate — this file
      cat  : 'kernel',
      desc : 'System file manifest — declares every project file for systree',
    },
    {
      path : 'kos-kernel.js',
      size : 19506,
      cat  : 'kernel',
      desc : 'Core system kernel — KOSBus, theme, wallpaper, avatar, login, clock, toast',
    },
    {
      path : 'kos-fs.js',
      size : 26916,
      cat  : 'kernel',
      desc : 'KOSFS kernel module — unified IndexedDB filesystem, permissions, migration',
    },
    {
      path : 'kos-fs-picker.js',
      size : 30335,
      cat  : 'kernel',
      desc : 'KOSFS file picker UI — shared modal used by all apps to open/upload files',
    },
    {
      path : 'kos-wm.js',
      size : 38836,
      cat  : 'kernel',
      desc : 'Window manager — open, close, minimise, focus, drag, resize, session save',
    },
    {
      path : 'kos-init.js',
      size : 18133,
      cat  : 'kernel',
      desc : 'Boot orchestrator — dock, spotlight, context menu, session restore, KOSFS init',
    },
    {
      path : 'kos-display.js',
      size : 2300,
      cat  : 'kernel',
      desc : 'Display manager — zoom, brightness, font size, bold text (localStorage)',
    },
    {
      path : 'kos-contextmenu.js',
      size : 20924,
      cat  : 'kernel',
      desc : 'Right-click context menu system — desktop, dock, and app-specific menus',
    },
    {
      path : 'terminal.js',
      size : 14504,
      cat  : 'kernel',
      desc : 'System terminal CLI — passwd, wallpaper, purge, systree, sysinfo and more',
    },
    {
      path : 'sw.js',
      size : 2146,
      cat  : 'config',
      desc : 'Service worker — pre-caches all assets for offline PWA support',
    },
    {
      path : 'manifest.json',
      size : 357,
      cat  : 'config',
      desc : 'PWA web app manifest — name, icons, theme colour, display mode',
    },
    {
      path : 'README.md',
      size : 8591,
      cat  : 'doc',
      desc : 'Project readme — setup, architecture overview, contribution notes',
    },
    {
      path : 'KOS_ULTIMATE_2026_ALPHA8_FULL_DOCS.md',
      size : 90200,
      cat  : 'doc',
      desc : 'Full technical documentation — all modules, APIs, and design decisions',
    },

    /* ── App modules  /apps/ ─────────────────────────────── */
    {
      path : 'apps/about.js',
      size : 4984,
      cat  : 'app',
      desc : 'About KOS — version info, system specs, credits',
    },
    {
      path : 'apps/browser.js',
      size : 3433,
      cat  : 'app',
      desc : 'Smooth Browser — embedded iframe web browser with nav bar',
    },
    {
      path : 'apps/calculator.js',
      size : 4348,
      cat  : 'app',
      desc : 'Calculator — arithmetic, keyboard support, history',
    },
    {
      path : 'apps/files.js',
      size : 36839,
      cat  : 'app',
      desc : 'Files — universal file browser, all KOSFS types, drag-drop, download',
    },
    {
      path : 'apps/notes.js',
      size : 9658,
      cat  : 'app',
      desc : 'Notes — plain text editor backed by KOSFS document storage',
    },
    {
      path : 'apps/photos.js',
      size : 33040,
      cat  : 'app',
      desc : 'Photos — image gallery, albums, lightbox, KOSFS image storage',
    },
    {
      path : 'apps/release-notes.js',
      size : 10284,
      cat  : 'app',
      desc : 'Release Notes — alpha/beta changelog viewer',
    },
    {
      path : 'apps/studio.js',
      size : 28851,
      cat  : 'app',
      desc : 'KOS Studio — in-browser app builder, HTML/CSS/JS editor, live preview',
    },
    {
      path : 'apps/task-mgr.js',
      size : 9694,
      cat  : 'app',
      desc : 'Task Manager — running window list, memory and CPU indicators',
    },
    {
      path : 'apps/ui-manager.js',
      size : 30478,
      cat  : 'app',
      desc : 'Settings — theme, wallpaper, avatar, display, apps, storage, password',
    },

    /* ── Core stylesheets  /css/ ─────────────────────────── */
    {
      path : 'css/core-vars.css',
      size : 10135,
      cat  : 'css',
      desc : 'CSS custom properties — colour tokens, spacing scale, font stack',
    },
    {
      path : 'css/shell.css',
      size : 34752,
      cat  : 'css',
      desc : 'Desktop shell — topbar, dock, spotlight, login, boot, power screens',
    },
    {
      path : 'css/wm.css',
      size : 11067,
      cat  : 'css',
      desc : 'Window manager styles — frames, titlebars, glass, resize handles',
    },
    {
      path : 'css/terminal.css',
      size : 2821,
      cat  : 'css',
      desc : 'Terminal styles — output area, prompt, scrollbar, command colours',
    },
    {
      path : 'css/kos-contextmenu.css',
      size : 8762,
      cat  : 'css',
      desc : 'Context menu styles — backdrop, items, separators, hover states',
    },

    /* ── Per-app stylesheets  /css/apps/ ─────────────────── */
    {
      path : 'css/apps/about.css',
      size : 4502,
      cat  : 'css-app',
      desc : 'About app styles',
    },
    {
      path : 'css/apps/browser.css',
      size : 2388,
      cat  : 'css-app',
      desc : 'Smooth Browser styles',
    },
    {
      path : 'css/apps/calculator.css',
      size : 1899,
      cat  : 'css-app',
      desc : 'Calculator styles',
    },
    {
      path : 'css/apps/files.css',
      size : 7894,
      cat  : 'css-app',
      desc : 'Files app styles — sidebar, grid, list, preview overlay',
    },
    {
      path : 'css/apps/notes.css',
      size : 6193,
      cat  : 'css-app',
      desc : 'Notes app styles — editor, note list, toolbar',
    },
    {
      path : 'css/apps/photos.css',
      size : 16231,
      cat  : 'css-app',
      desc : 'Photos app styles — gallery grid, lightbox, albums panel',
    },
    {
      path : 'css/apps/release-notes.css',
      size : 5306,
      cat  : 'css-app',
      desc : 'Release Notes styles',
    },
    {
      path : 'css/apps/studio.css',
      size : 14472,
      cat  : 'css-app',
      desc : 'KOS Studio styles — editor panes, live preview, toolbar',
    },
    {
      path : 'css/apps/task-mgr.css',
      size : 3916,
      cat  : 'css-app',
      desc : 'Task Manager styles — process rows, meters',
    },
    {
      path : 'css/apps/ui-manager.css',
      size : 31325,
      cat  : 'css-app',
      desc : 'Settings app styles — sidebar, cards, toggles, wallpaper grid',
    },

    /* ── Static assets  /documents/ ──────────────────────── */
    {
      path : 'documents/dfw.jpg',
      size : 2455838,
      cat  : 'asset',
      desc : 'Default wallpaper — city skyline at dusk',
    },
    {
      path : 'documents/img_avatar.png',
      size : 8229,
      cat  : 'asset',
      desc : 'Default user avatar',
    },
    {
      path : 'documents/img_avatar2.png',
      size : 8314,
      cat  : 'asset',
      desc : 'Alternate default avatar',
    },
    {
      path : 'documents/kos icon.png',
      size : 2089450,
      cat  : 'asset',
      desc : 'KOS app icon (PWA / launcher)',
    },
    {
      path : 'documents/load1.gif',
      size : 1695831,
      cat  : 'asset',
      desc : 'Boot sequence loading animation',
    },
    {
      path : 'documents/lock.jpg',
      size : 4858521,
      cat  : 'asset',
      desc : 'Lock / login screen background image',
    },
    {
      path : 'documents/restart.gif',
      size : 515569,
      cat  : 'asset',
      desc : 'Restart screen animation',
    },
    {
      path : 'documents/shuting.gif',
      size : 724191,
      cat  : 'asset',
      desc : 'Shutdown screen animation',
    },
    {
      path : 'documents/sleeping.gif',
      size : 1568811,
      cat  : 'asset',
      desc : 'Sleep screen animation',
    },
    {
      path : 'documents/startupsong.mp3',
      size : 176712,
      cat  : 'asset',
      desc : 'KOS boot startup audio',
    },
    {
      path : 'documents/Gemini_Generated_Image_41g5rx41g5rx41g5.png',
      size : 1566780,
      cat  : 'asset',
      desc : 'AI-generated wallpaper asset',
    },
    {
      path : 'documents/KOS  file architecture for KOS26 Ultimate.svg',
      size : 4300,
      cat  : 'asset',
      desc : 'KOS architecture diagram (SVG)',
    },
  ],
});
