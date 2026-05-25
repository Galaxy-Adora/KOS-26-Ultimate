'use strict';

/* ══════════════════════════════════════════════════════════════
   KOS ULTIMATE 2026 — sys-manifest.js
   System File Manifest — read by the terminal's systree command.
   ══════════════════════════════════════════════════════════════ */

const KOS_SYS_MANIFEST = Object.freeze({

  name    : 'KOS Ultimate 2026',
  version : '9.0.2026',
  alpha   : 9,
  updated : '2026-05-24',

  CATS: Object.freeze({
    KERNEL  : 'kernel',
    APP     : 'app',
    CSS     : 'css',
    CSS_APP : 'css-app',
    ASSET   : 'asset',
    CONFIG  : 'config',
    DOC     : 'doc',
  }),

  files: [

    /* ── Root / kernel layer ── */
    { path: 'index.html',          size: 13807,  cat: 'kernel',  desc: 'Main HTML entry point' },
    { path: 'kos-version.js',      size: 1800,   cat: 'kernel',  desc: 'Version manifest — single source of truth for version info' },
    { path: 'kos-manifest.js',     size: 8509,   cat: 'kernel',  desc: 'Application registry — id, icon, permissions, window sizing' },
    { path: 'sys-manifest.js',     size: 6200,   cat: 'kernel',  desc: 'System file manifest — declares every project file for systree' },
    { path: 'kos-kernel.js',       size: 19506,  cat: 'kernel',  desc: 'Core kernel — KOSBus, theme, wallpaper, avatar, login, clock, toast' },
    { path: 'kos-fs.js',           size: 26916,  cat: 'kernel',  desc: 'KOSFS kernel module — unified IndexedDB filesystem' },
    { path: 'kos-fs-picker.js',    size: 30335,  cat: 'kernel',  desc: 'KOSFS file picker UI — shared modal for open/upload' },
    { path: 'kos-wm.js',           size: 38836,  cat: 'kernel',  desc: 'Window manager — open, close, drag, resize, snap, session' },
    { path: 'kos-init.js',         size: 18133,  cat: 'kernel',  desc: 'Boot orchestrator — dock, spotlight, session restore' },
    { path: 'kos-display.js',      size: 2300,   cat: 'kernel',  desc: 'Display manager — zoom, brightness, font size, bold text' },
    { path: 'kos-contextmenu.js',  size: 20924,  cat: 'kernel',  desc: 'Right-click context menu system' },
    { path: 'terminal.js',         size: 14504,  cat: 'kernel',  desc: 'System terminal CLI — passwd, wallpaper, purge, systree' },
    { path: 'sw.js',               size: 2146,   cat: 'config',  desc: 'Service worker — cache-first offline PWA support' },
    { path: 'manifest.json',       size: 357,    cat: 'config',  desc: 'PWA web app manifest — name, icons, theme colour' },
    { path: 'README.md',           size: 8591,   cat: 'doc',     desc: 'Project readme — setup, architecture overview' },

    /* ── App modules /apps/ ── */
    { path: 'apps/about.js',         size: 4984,   cat: 'app', desc: 'About KOS — version info, system specs, credits' },
    { path: 'apps/browser.js',       size: 3433,   cat: 'app', desc: 'Web Browser — embedded iframe browser with nav bar' },
    { path: 'apps/calculator.js',    size: 4348,   cat: 'app', desc: 'Calculator — standard, scientific, unit, currency modes' },
    { path: 'apps/files.js',         size: 36839,  cat: 'app', desc: 'Files — universal KOSFS file browser, drag-drop, download' },
    { path: 'apps/notes.js',         size: 9658,   cat: 'app', desc: 'Notes — plain text editor backed by KOSFS document storage' },
    { path: 'apps/photos.js',        size: 33040,  cat: 'app', desc: 'Photos — image gallery, albums, lightbox, PDF support' },
    { path: 'apps/release-notes.js', size: 10284,  cat: 'app', desc: 'Release Notes — changelog viewer' },
    { path: 'apps/studio.js',        size: 28851,  cat: 'app', desc: 'KOS Studio — in-browser app builder, live preview, publish to dock' },
    { path: 'apps/task-mgr.js',      size: 9694,   cat: 'app', desc: 'Task Manager — running window list, memory / CPU indicators' },
    { path: 'apps/ui-manager.js',    size: 30478,  cat: 'app', desc: 'Settings — theme, wallpaper, display, apps, password' },
    { path: 'apps/music.js',         size: 28801,  cat: 'app', desc: 'Music — Spotify-style audio player backed by KOSFS' },
    { path: 'apps/videos.js',        size: 9694,   cat: 'app', desc: 'Videos — video player backed by KOSFS' },
    { path: 'apps/runner.js',        size: 30478,  cat: 'app', desc: 'Retro Snake — canvas snake game' },

    /* ── Core stylesheets /css/ ── */
    { path: 'css/core-vars.css',        size: 10135, cat: 'css', desc: 'CSS custom properties, resets, icon gradients, keyframes' },
    { path: 'css/shell.css',            size: 34752, cat: 'css', desc: 'Desktop shell — topbar, dock, spotlight, login, boot screens' },
    { path: 'css/wm.css',              size: 11067, cat: 'css', desc: 'Window manager styles — frames, titlebars, resize handles' },
    { path: 'css/terminal.css',        size: 2821,  cat: 'css', desc: 'Terminal styles — output area, prompt, command colours' },
    { path: 'css/kos-contextmenu.css', size: 8762,  cat: 'css', desc: 'Context menu styles — items, separators, submenus' },

    /* ── Per-app stylesheets /css/apps/ ── */
    { path: 'css/apps/about.css',         size: 4502,  cat: 'css-app', desc: 'About app styles' },
    { path: 'css/apps/browser.css',       size: 2388,  cat: 'css-app', desc: 'Browser styles' },
    { path: 'css/apps/calculator.css',    size: 1899,  cat: 'css-app', desc: 'Calculator styles' },
    { path: 'css/apps/files.css',         size: 7894,  cat: 'css-app', desc: 'Files app styles — sidebar, grid, list, preview' },
    { path: 'css/apps/notes.css',         size: 6193,  cat: 'css-app', desc: 'Notes app styles — editor, note list, toolbar' },
    { path: 'css/apps/photos.css',        size: 16231, cat: 'css-app', desc: 'Photos app styles — gallery grid, lightbox, albums' },
    { path: 'css/apps/release-notes.css', size: 5306,  cat: 'css-app', desc: 'Release Notes styles' },
    { path: 'css/apps/studio.css',        size: 14472, cat: 'css-app', desc: 'KOS Studio styles — editor panes, live preview, toolbar' },
    { path: 'css/apps/task-mgr.css',      size: 3916,  cat: 'css-app', desc: 'Task Manager styles — process rows, meters' },
    { path: 'css/apps/ui-manager.css',    size: 31325, cat: 'css-app', desc: 'Settings app styles — sidebar, cards, toggles' },
    /* Fixed: these were incorrectly listed as apps/music.css etc. — correct path is css/apps/ */
    { path: 'css/apps/music.css',         size: 2801,  cat: 'css-app', desc: 'Music app styles — Spotify-style layout' },
    { path: 'css/apps/videos.css',        size: 2694,  cat: 'css-app', desc: 'Videos app styles — glass player controls' },
    { path: 'css/apps/runner.css',        size: 3200,  cat: 'css-app', desc: 'Snake game styles — HUD, canvas, overlays' },

    /* ── Static assets /documents/ ── */
    { path: 'documents/dfw.jpg',           size: 2455838, cat: 'asset', desc: 'Default wallpaper — city skyline at dusk' },
    { path: 'documents/img_avatar.png',    size: 8229,    cat: 'asset', desc: 'Default user avatar' },
    { path: 'documents/img_avatar2.png',   size: 8314,    cat: 'asset', desc: 'Alternate default avatar' },
    { path: 'documents/kos icon.png',      size: 2089450, cat: 'asset', desc: 'KOS app icon (PWA / launcher)' },
    { path: 'documents/load1.gif',         size: 1695831, cat: 'asset', desc: 'Boot sequence loading animation' },
    { path: 'documents/startupsong.mp3',   size: 176712,  cat: 'asset', desc: 'KOS boot startup audio' },
  ],
});
