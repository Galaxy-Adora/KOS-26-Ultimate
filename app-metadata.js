/* ══════════════════════════════════════════════════════════════
   KOS ULTIMATE 2026 — app-metadata.js
   Centralized App Metadata Registry

   This file is the single source of truth for extended app info
   displayed in the KOS App Store.

   LOAD ORDER (index.html — must come before app-store.js)
   ─────────────────────────────────────────────────────────────
     <script defer src="app-metadata.js"></script>   ← add after kos-manifest.js
     <script defer src="app-store.js"></script>

   HOW TO ADD METADATA FOR A NEW APP
   ─────────────────────────────────────────────────────────────
     Add a new entry to window.KOS_APP_METADATA keyed by app ID.
     All fields are optional — the store will show fallbacks.

   METADATA BLOCK FORMAT (copy to top of any app's .js file)
   ─────────────────────────────────────────────────────────────
   ╔══════════════════════════════════════════════════════════╗
   ║  APP METADATA — consumed by KOS App Store (app-store.js) ║
   ║  ────────────────────────────────────────────────────── ║
   ║  Name        : Your App Name                             ║
   ║  ID          : your-app-id                               ║
   ║  Version     : 1.0.0                                     ║
   ║  Released    : May 28, 2026                              ║
   ║  Developer   : Your Name / Studio                        ║
   ║  Link        : https://your-site.com                     ║
   ║  Category    : Productivity                              ║
   ║  Permissions : ['documents']                             ║
   ║  Description : What this app does…                       ║
   ╚══════════════════════════════════════════════════════════╝
   ══════════════════════════════════════════════════════════════ */

'use strict';

window.KOS_APP_METADATA = {

  /* ──────────────────────────────────────────────────────────
     SETTINGS  (ui-manager)
     ────────────────────────────────────────────────────────── */
  'uimanager': {
    displayName    : 'Settings',
    version        : '9.0.2026',
    versionDate    : 'May 24, 2026',
    developer      : 'Kalapurackal Studios',
    devLink        : 'https://galaxy-adora.github.io/KOS-26-Ultimate/',
    category       : 'System',
    shortDesc      : 'Personalise and control every aspect of your KOS experience.',
    description    : 'Settings is the central hub for customising every aspect of KOS. Control your appearance with wallpapers, avatars, and iOS 18-style icon colour palettes. Manage system-wide display settings including zoom level (50–250%), text size (6 levels), brightness, and bold text accessibility mode.\n\nSecure your session with a custom login password — set, change, or remove it without leaving the app. Browse every installed KOS app, see which are pinned to the dock and searchable in Spotlight, and launch them directly.\n\nThe Display section stores all preferences in IndexedDB, ensuring your setup survives page reloads and browser restarts.',
    whatsNew       : [
      'New Display section — zoom, text size, bold text, and brightness in one place',
      'Password & Security section with cleaner three-field flow',
      'Settings search highlights matching sidebar items and navigates on tap',
      'About KOS now reads from kos-version.js — single source of truth',
      'Animated section transitions with slide-in/out CSS keyframes',
      'Display settings persisted to IndexedDB (not just localStorage)',
    ],
    screenshotLabels : ['Appearance', 'Display', 'Password & Security', 'Apps'],
    size           : '~31 KB',
    codeSize       : 30478,
    permissions    : ['*'],
    isSystemApp    : true,
    tags           : ['settings', 'preferences', 'appearance', 'theme', 'wallpaper', 'password'],
    minKOSVersion  : 'Alpha 1',
    addedInVersion : 'Alpha 1',
  },

  /* ──────────────────────────────────────────────────────────
     PHOTOS  (gallery)
     ────────────────────────────────────────────────────────── */
  'gallery': {
    displayName    : 'Photos',
    version        : '9.1.2026',
    versionDate    : 'May 24, 2026',
    developer      : 'Kalapurackal Studios',
    devLink        : 'https://galaxy-adora.github.io/KOS-26-Ultimate/',
    category       : 'Media',
    shortDesc      : 'Your personal image gallery with albums, favourites, and lightbox viewer.',
    description    : 'Photos is your personal media gallery powered by the KOSFS unified kernel filesystem. Browse, organise, and enjoy your images with a macOS-style two-column interface featuring a collapsible sidebar with album navigation.\n\nSupports multiple album views — Library, Favourites, Uploads, PDFs, Avatars, and Wallpapers — each with live item count badges. The full-screen lightbox viewer shows EXIF metadata, lets you favourite photos, set wallpapers, and delete files. Import images and PDFs by clicking the Import button or dragging files directly onto the grid.\n\nAll media is stored as ArrayBuffer in IndexedDB via KOSFS — raw binary never touches RAM outside of the LRU blob cache, which caps at 40 Object URLs and revokes evicted entries automatically.',
    whatsNew       : [
      'PDF support — import and view PDF files alongside photos',
      'Full KOSFS Alpha 9 unified filesystem integration',
      'LRU blob URL cache (cap: 40) with automatic revocation on eviction',
      'IntersectionObserver lazy loading — only visible thumbnails fetched',
      'Dedicated "PDFs" sidebar album for document organisation',
      'Wallpaper button hidden in lightbox for PDF files',
      'Cleanup on WM close — all Object URLs revoked, observer disconnected',
    ],
    screenshotLabels : ['Library', 'Lightbox Viewer', 'Albums Sidebar', 'PDF View'],
    size           : '~33 KB',
    codeSize       : 33040,
    permissions    : ['photos', 'documents'],
    isSystemApp    : true,
    tags           : ['photos', 'gallery', 'images', 'media', 'PDF', 'albums', 'favourites'],
    minKOSVersion  : 'Alpha 2',
    addedInVersion : 'Alpha 2',
  },

  /* ──────────────────────────────────────────────────────────
     FILES
     ────────────────────────────────────────────────────────── */
  'files': {
    displayName    : 'Files',
    version        : '9.0.2026',
    versionDate    : 'May 24, 2026',
    developer      : 'Kalapurackal Studios',
    devLink        : 'https://galaxy-adora.github.io/KOS-26-Ultimate/',
    category       : 'Productivity',
    shortDesc      : 'Browse, manage, and organise all your KOS files in one place.',
    description    : 'Files is a full-featured Windows Explorer-inspired file browser with a liquid glass aesthetic. A sidebar gives instant access to all storage categories — Photos, Videos, Audios, Documents, System apps, and Custom Studio apps.\n\nSwitch between grid and list views. Upload new files with the ribbon toolbar Import button or drag and drop onto the content area. Download any file with a single click. Multi-select support coming soon.\n\nIntelligent inter-app routing: double-clicking an audio file opens it in the Music app, video files go to the Videos player, and text documents route directly to the Notes editor. A built-in liquid glass confirmation dialog replaces the browser\'s native confirm() popup for delete operations.',
    whatsNew       : [
      'Windows Explorer-style ribbon toolbar with context-sensitive button states',
      'In-app liquid glass dialog — no more native browser confirm() popups',
      'Audio files route directly to Music app on double-click',
      'Document files route to Notes app on double-click',
      'Drag-and-drop upload zone covering the full content area',
      'Status bar shows item count and selected file size in real time',
      'LRU blob URL cache (cap: 30) with automatic eviction and revocation',
    ],
    screenshotLabels : ['Photos Folder', 'Documents', 'Grid View', 'List View'],
    size           : '~37 KB',
    codeSize       : 36839,
    permissions    : ['*'],
    isSystemApp    : true,
    tags           : ['files', 'explorer', 'documents', 'browser', 'storage', 'upload', 'download'],
    minKOSVersion  : 'Alpha 6',
    addedInVersion : 'Alpha 6',
  },

  /* ──────────────────────────────────────────────────────────
     NOTES
     ────────────────────────────────────────────────────────── */
  'notes': {
    displayName    : 'Notes',
    version        : '9.0.2026',
    versionDate    : 'May 24, 2026',
    developer      : 'Kalapurackal Studios',
    devLink        : 'https://galaxy-adora.github.io/KOS-26-Ultimate/',
    category       : 'Productivity',
    shortDesc      : 'A clean, distraction-free text editor backed by the KOS filesystem.',
    description    : 'Notes is a clean, distraction-free text editor fully integrated with the KOSFS kernel filesystem. Every note is persisted as a plain text document in the unified IndexedDB store — no localStorage fragility.\n\nCreate notes with one tap. Import any text file from your device — .txt, .md, .json, .html, .css, and .js are all supported. Inline title renaming directly in the toolbar means no separate dialogs. Auto-save on blur means you never lose work.\n\nNotes syncs in real time with the Files app via KOSBus events: documents created, updated, or deleted in either app reflect immediately in both. The overwrite-on-save pattern (delete old + write new) is an intentional KOSFS design that keeps the ID fresh.',
    whatsNew       : [
      'Full KOSFS Alpha 9 integration — notes stored in unified IDB',
      'Real-time two-way sync with Files app via KOSBus fs events',
      'Upload any plain text file — .txt, .md, .json, .html, .css, .js',
      'Auto-save on title blur — focus leaves, note saves instantly',
      'Inline title renaming directly in the editor toolbar',
      'Upload button beside New Note for one-tap file import',
    ],
    screenshotLabels : ['Editor', 'Note List', 'Create Note', 'File Import'],
    size           : '~10 KB',
    codeSize       : 9658,
    permissions    : ['documents'],
    isSystemApp    : true,
    tags           : ['notes', 'text', 'editor', 'writing', 'documents', 'markdown'],
    minKOSVersion  : 'Alpha 6',
    addedInVersion : 'Alpha 6',
  },

  /* ──────────────────────────────────────────────────────────
     WEB BROWSER
     ────────────────────────────────────────────────────────── */
  'browser': {
    displayName    : 'Web Browser',
    version        : '9.0.2026',
    versionDate    : 'May 24, 2026',
    developer      : 'Kalapurackal Studios',
    devLink        : 'https://galaxy-adora.github.io/KOS-26-Ultimate/',
    category       : 'Internet',
    shortDesc      : 'Browse the open web from inside KOS with a glass-chrome browser.',
    description    : 'A sandboxed web browser built directly into KOS as a floating window. Navigate any URL with full back/forward session history, bookmark pages with the star icon, and reload at any time with the rotate-right button.\n\nThe liquid glass toolbar chrome adapts beautifully to light and dark mode. A lock icon indicates HTTPS status at a glance. URLs are intelligently normalised — type a search query and the browser routes to DuckDuckGo; enter a bare domain and it prepends https:// automatically.\n\nPages load in a sandboxed iframe. Cross-origin restrictions apply as normal — this is a real browser, not a simulation.',
    whatsNew       : [
      'KOSFS Alpha 9 integration for future bookmark persistence',
      'Liquid glass chrome with seamless light and dark mode',
      'Smart URL normalisation: queries → DuckDuckGo, domains → https://',
      'HTTPS lock icon with visual status in the address bar',
      'Per-tab history tracking with back/forward cursor',
    ],
    screenshotLabels : ['Navigation Bar', 'Wikipedia', 'DuckDuckGo Search'],
    size           : '~3.4 KB',
    codeSize       : 3433,
    permissions    : ['documents'],
    isSystemApp    : true,
    tags           : ['browser', 'web', 'internet', 'navigation', 'iframe'],
    minKOSVersion  : 'Alpha 2',
    addedInVersion : 'Alpha 2',
  },

  /* ──────────────────────────────────────────────────────────
     CALCULATOR
     Developer: Joel Jais
     ────────────────────────────────────────────────────────── */
  'calculator': {
    displayName    : 'Calculator',
    version        : '1.0.0',
    versionDate    : 'April 1, 2026',
    developer      : 'Joel Jais',
    devLink        : '',
    category       : 'Utilities',
    shortDesc      : 'Standard, scientific, unit converter, and currency calculator in one.',
    description    : 'A professional multi-mode calculator for KOS with four distinct operating modes, all accessible via tabs at the top.\n\nStandard mode provides clean arithmetic with operator highlighting and floating-point noise suppression via toPrecision(10). Scientific mode adds trigonometric functions (sin, cos, tan), logarithms (ln, log₁₀), factorial, powers, parentheses, π, and Euler\'s number — with a mini expression evaluator.\n\nUnit Converter handles eight categories: length, mass, volume, area, speed, time, and data — each with comprehensive unit lists. Currency Converter includes 20 major world currencies with live-editable exchange rates so you can override the built-in rates anytime.\n\nThe window is mode-aware and self-sizing — each mode locks to an appropriate aspect ratio for comfortable use.',
    whatsNew       : [
      'Four modes: Standard, Scientific, Unit Converter, Currency',
      'Scientific: sin/cos/tan, ln/log, factorial, x², x³, xⁿ, √, 1/x',
      'Scientific: parentheses, π, and Euler\'s number constants',
      'Unit converter: length, mass, volume, area, speed, time, data (8 categories)',
      'Currency converter: 20 major currencies with editable exchange rates',
      'Mode-aware aspect ratio locking via ResizeObserver',
      'Floating-point display noise suppressed with toPrecision(10)',
    ],
    screenshotLabels : ['Standard', 'Scientific', 'Unit Converter', 'Currency'],
    size           : '~4.3 KB',
    codeSize       : 4348,
    permissions    : [],
    isSystemApp    : true,
    tags           : ['calculator', 'math', 'science', 'units', 'currency', 'conversion'],
    minKOSVersion  : 'Alpha 4',
    addedInVersion : 'Alpha 4',
  },

  /* ──────────────────────────────────────────────────────────
     TERMINAL
     ────────────────────────────────────────────────────────── */
  'terminal': {
    displayName    : 'Terminal',
    version        : '9.0.2026',
    versionDate    : 'May 24, 2026',
    developer      : 'Kalapurackal Studios',
    devLink        : 'https://galaxy-adora.github.io/KOS-26-Ultimate/',
    category       : 'Developer',
    shortDesc      : 'Root-level command-line access to KOS system internals.',
    description    : 'Root System Terminal gives you direct command-line access to KOS internals with a Liquid Glass dark UI.\n\nManage the login password interactively with passwd — a 3-step masked flow lets you change, reset to default, or completely disable the login screen with --nopass. Control wallpapers (reset, list stock options, set by name or index). Inspect the entire KOSFS virtual filesystem with tree, rendered as a Unicode box-drawing directory listing. Render the KOS source file tree from sys-manifest.js with systree (supports --kernel, --apps, --css, --docs, --stats flags). Securely purge all or selected KOSFS storage types with the password-gated purge command.\n\nCommand history is navigable with arrow keys. Async commands (tree, purge) show real-time output as they process.',
    whatsNew       : [
      'passwd — interactive 3-step masked password change flow',
      'passwd --nopass — enable auto-login (skip login screen on boot)',
      'passwd --reset — restore default password "kosul"',
      'wallpaper reset / list / set <name|index> — full wallpaper control from CLI',
      'purge --all/--photos/--videos/--audios/--documents — password-gated storage wipe',
      'systree — renders KOS source file tree from sys-manifest.js',
      'systree --stats — per-folder file counts and total sizes',
    ],
    screenshotLabels : ['Commands', 'sysinfo Output', 'tree Command', 'passwd Flow'],
    size           : '~14.5 KB',
    codeSize       : 14504,
    permissions    : ['*'],
    isSystemApp    : true,
    tags           : ['terminal', 'cli', 'developer', 'system', 'root', 'passwd', 'filesystem'],
    minKOSVersion  : 'Alpha 1',
    addedInVersion : 'Alpha 1',
  },

  /* ──────────────────────────────────────────────────────────
     KOS STUDIO
     ────────────────────────────────────────────────────────── */
  'studio': {
    displayName    : 'KOS Studio',
    version        : '9.0.2026',
    versionDate    : 'May 24, 2026',
    developer      : 'Kalapurackal Studios',
    devLink        : 'https://galaxy-adora.github.io/KOS-26-Ultimate/',
    category       : 'Developer',
    shortDesc      : 'Build, preview, and publish custom KOS apps — no external tools needed.',
    description    : 'KOS Studio is the in-OS application builder that lets you create, preview, and publish custom apps directly into the KOS dock and Spotlight — entirely within the browser.\n\nWrite HTML, CSS, and JavaScript in a three-pane code editor. A CSS snippet sidebar provides ready-to-paste system patterns (glass effects, brand colours, app icons, toggle switches, and more). Hit Launch to preview your app live in a sandboxed iframe before publishing.\n\nPublish as a Custom App (stored locally, icon in dock) or System App (treated as a built-in KOS app with a system badge). Published apps survive page reload via session restore. The System Apps tab lets you inject CSS and JavaScript overrides into any built-in KOS app — changes apply every time the app opens.',
    whatsNew       : [
      'System Apps tab — inject CSS/JS overrides into any built-in KOS app',
      'Live DOM inspector in the system app editor (sys-html tab)',
      'CSS snippet browser: 10 ready-to-paste system patterns in the sidebar',
      'Publish menu: choose Custom App or System App launch type',
      'Published apps auto-restored on page reload via KOSStudio.restorePublished()',
      'Update OS button for already-published apps pushes changes live instantly',
    ],
    screenshotLabels : ['Code Editor', 'Live Preview', 'System Apps', 'Publish Menu'],
    size           : '~29 KB',
    codeSize       : 28851,
    permissions    : ['apps', 'documents'],
    isSystemApp    : true,
    tags           : ['studio', 'builder', 'developer', 'code editor', 'html', 'css', 'javascript'],
    minKOSVersion  : 'Alpha 3',
    addedInVersion : 'Alpha 3',
  },

  /* ──────────────────────────────────────────────────────────
     TASK MANAGER
     ────────────────────────────────────────────────────────── */
  'taskmanager': {
    displayName    : 'Task Manager',
    version        : '9.0.2026',
    versionDate    : 'May 24, 2026',
    developer      : 'Kalapurackal Studios',
    devLink        : 'https://galaxy-adora.github.io/KOS-26-Ultimate/',
    category       : 'System',
    shortDesc      : 'Live process monitoring with real memory data and force-quit.',
    description    : 'Task Manager provides a real-time view of KOS system resources and all running processes. The memory panel reads live data from the browser\'s performance.memory API (Chromium) — you see actual JavaScript heap usage, not estimates.\n\nThe process list shows every open KOS window with simulated per-app memory and CPU values. Force-quit any app with a single click. Protected system processes (KOS System, KOS UI Layer) cannot be terminated.\n\nBuilt with maximum performance in mind: element references are cached once at init, rows are patched in-place rather than rebuilt on each tick, a DocumentFragment is used for new row inserts, and KOSBus listener callbacks are debounced through requestAnimationFrame to prevent rapid open/close events from flooding the list.',
    whatsNew       : [
      'In-place DOM patching — existing rows updated, not destroyed, each refresh',
      'DocumentFragment batch insert for new process rows',
      'KOSBus open/close listeners debounced via rAF — no rapid rebuild floods',
      'Polling interval optimised from 3 s → 4 s (25% fewer main-thread wakeups)',
      'Cached element refs — no getElementById calls inside the 4-second loop',
      'Minimized windows set to content-visibility: hidden for zero-cost rendering',
    ],
    screenshotLabels : ['Process List', 'Memory Panel', 'Force Quit'],
    size           : '~9.7 KB',
    codeSize       : 9694,
    permissions    : [],
    isSystemApp    : true,
    tags           : ['task manager', 'processes', 'memory', 'cpu', 'system', 'force quit'],
    minKOSVersion  : 'Alpha 1',
    addedInVersion : 'Alpha 1',
  },

  /* ──────────────────────────────────────────────────────────
     ABOUT KOS
     ────────────────────────────────────────────────────────── */
  'about': {
    displayName    : 'About KOS',
    version        : '9.0.2026',
    versionDate    : 'May 24, 2026',
    developer      : 'Kalapurackal Studios',
    devLink        : 'https://galaxy-adora.github.io/KOS-26-Ultimate/',
    category       : 'System',
    shortDesc      : 'System version, live hardware specs, and developer credits.',
    description    : 'About KOS shows comprehensive information about your KOS installation in a clean macOS-inspired layout.\n\nThe Version Info section reads all data from kos-version.js — the single source of truth — displaying the version string, build number, build type (Alpha/Beta/RC/Stable), release date, code name, and license type.\n\nThe System section shows live hardware data fetched at open time from browser APIs: CPU thread count, device memory estimate, screen resolution with device pixel ratio, user locale, platform string, and browser rendering engine (Blink, Gecko, or WebKit detected from the user agent).\n\nThe Developer card credits Kalapurackal Studios with a gradient avatar, handle, and website link.',
    whatsNew       : [
      'All version data sourced from kos-version.js — no more hardcoded strings',
      'Code Name field added to the Version Info section',
      'Live CPU thread count via navigator.hardwareConcurrency',
      'Device memory estimate via navigator.deviceMemory',
      'Screen resolution with exact device pixel ratio',
      'Browser engine detection: Blink (Chrome), Gecko (Firefox), WebKit (Safari)',
    ],
    screenshotLabels : ['Version Info', 'System Specs', 'Developer Card'],
    size           : '~5 KB',
    codeSize       : 4984,
    permissions    : [],
    isSystemApp    : true,
    tags           : ['about', 'version', 'system info', 'hardware', 'credits', 'developer'],
    minKOSVersion  : 'Alpha 5',
    addedInVersion : 'Alpha 5',
  },

  /* ──────────────────────────────────────────────────────────
     RELEASE NOTES
     ────────────────────────────────────────────────────────── */
  'releasenotes': {
    displayName    : 'Release Notes',
    version        : '9.0.2026',
    versionDate    : 'May 24, 2026',
    developer      : 'Kalapurackal Studios',
    devLink        : 'https://galaxy-adora.github.io/KOS-26-Ultimate/',
    category       : 'System',
    shortDesc      : 'Discover what\'s new in every KOS release.',
    description    : 'Release Notes displays the complete KOS changelog in a clean, data-driven format. The latest version is always shown prominently at the top with a coloured tag pill and date stamp. Previous releases are listed below as compact cards.\n\nAdding a new version requires only prepending a new object to the RELEASES array in release-notes.js — no template changes, no HTML edits, no build step. The renderer handles everything automatically.\n\nColoured tags (green = performance, orange = feature, purple = launch, blue = major) provide instant visual context for each release type. Release Notes opens automatically on first KOS boot and can be reopened anytime from Spotlight or the System menu.',
    whatsNew       : [
      'Opens automatically on first KOS boot (cleared after first view)',
      'Data-driven: add a version by prepending to RELEASES array only',
      'Coloured tag pills: Performance, Feature Update, Major, Alpha, etc.',
      'Latest version card prominently featured and visually distinct',
      'Section grouping: New Features, Improvements, Bug Fixes, Performance',
    ],
    screenshotLabels : ['Latest Release', 'Changelog History', 'Feature Sections'],
    size           : '~10.3 KB',
    codeSize       : 10284,
    permissions    : [],
    isSystemApp    : true,
    tags           : ['changelog', 'updates', 'version history', 'release notes', 'whats new'],
    minKOSVersion  : 'Alpha 5',
    addedInVersion : 'Alpha 5',
  },

  /* ──────────────────────────────────────────────────────────
     MUSIC
     ────────────────────────────────────────────────────────── */
  'music': {
    displayName    : 'Music',
    version        : '9.0.2026',
    versionDate    : 'May 24, 2026',
    developer      : 'Kalapurackal Studios',
    devLink        : 'https://galaxy-adora.github.io/KOS-26-Ultimate/',
    category       : 'Media',
    shortDesc      : 'A Spotify-inspired music player for your local audio library.',
    description    : 'Music is a Spotify-inspired local audio player with a rich dark glass aesthetic. Import audio files from your device to build a persistent library backed by the KOSFS kernel filesystem — your music survives page reloads.\n\nThe persistent bottom player deck gives you play/pause, previous/next track, shuffle, and loop controls alongside a scrubable progress bar and volume slider. The track list shows file names, sizes, and currently playing state with a animated bars indicator.\n\nInter-app integration: double-clicking any audio file in the Files app instantly routes it to Music for playback without needing to manually switch apps. Delete tracks with a confirmation dialog built directly into the app — no browser alerts.',
    whatsNew       : [
      'Spotify-inspired two-column layout with dark glass sidebar',
      'Persistent bottom player deck — controls always visible',
      'Shuffle mode and loop toggle',
      'Inter-app routing: audio files in Files open directly in Music',
      'Per-track delete with in-app glass dialog confirmation',
      'Object URL lifecycle management — old URLs revoked on track change',
      'Search bar filters the track list by name in real time',
    ],
    screenshotLabels : ['Library', 'Now Playing', 'Player Deck', 'Track Controls'],
    size           : '~29 KB',
    codeSize       : 28801,
    permissions    : ['audios', 'videos'],
    isSystemApp    : false,
    tags           : ['music', 'audio', 'player', 'spotify', 'media', 'mp3'],
    minKOSVersion  : 'Alpha 8',
    addedInVersion : 'Alpha 8',
  },

  /* ──────────────────────────────────────────────────────────
     VIDEOS
     ────────────────────────────────────────────────────────── */
  'videos': {
    displayName    : 'Videos',
    version        : '9.0.2026',
    versionDate    : 'May 24, 2026',
    developer      : 'Kalapurackal Studios',
    devLink        : 'https://galaxy-adora.github.io/KOS-26-Ultimate/',
    category       : 'Media',
    shortDesc      : 'A full-window video player with auto-hiding liquid glass controls.',
    description    : 'Videos is a sleek, full-window video player with a liquid glass control overlay that auto-hides during playback. Import any video file from your device — it\'s stored in KOSFS and available across sessions.\n\nThe glass controls panel contains a seek bar with MM:SS timestamps, rewind 10 s, play/pause, fast-forward 10 s, a mute toggle, and a volume slider. Controls appear on mouse movement and fade away after 2.8 seconds of inactivity for a clean, immersive viewing experience. Click anywhere on the video canvas to toggle play/pause.\n\nInter-app integration: double-clicking a video file in Files automatically opens the Videos player and begins playback via the playVideoDirectly() inter-app API.',
    whatsNew       : [
      'KOSFS integration — videos stored in unified filesystem, persist on reload',
      'Auto-hiding controls with 2.8s inactivity timeout',
      'Click-to-play/pause on the full video canvas',
      'Inter-app routing: video files in Files open directly in Videos',
      'Object URL revocation on WM window close prevents memory leaks',
      'WM.setOnClose hook — guaranteed cleanup even on force-quit',
    ],
    screenshotLabels : ['Player', 'Glass Controls', 'Import Flow'],
    size           : '~9.7 KB',
    codeSize       : 9694,
    permissions    : ['videos', 'audios'],
    isSystemApp    : false,
    tags           : ['video', 'player', 'media', 'film', 'mp4', 'streaming'],
    minKOSVersion  : 'Alpha 8',
    addedInVersion : 'Alpha 8',
  },

  /* ──────────────────────────────────────────────────────────
     RETRO SNAKE  (runner)
     Developer: Joel Jais
     ────────────────────────────────────────────────────────── */
  'runner': {
    displayName    : 'Retro Snake',
    version        : '1.0.0',
    versionDate    : 'May 24, 2026',
    developer      : 'Joel Jais',
    devLink        : '',
    category       : 'Games',
    shortDesc      : 'Neon Snake with customisable speed, wall modes, and persistent high score.',
    description    : 'Retro Snake is a neon-lit reimagining of the classic Snake game, hand-coded in Canvas 2D with a fixed-timestep requestAnimationFrame game loop for butter-smooth movement at any frame rate.\n\nConfigure your game before each session: choose Solid walls (classic — hit the edge and it\'s over) or Wrap-Around boundaries (warp to the other side). Three speed settings: Fast, Normal, and Easy.\n\nThe snake has animated eyes that track movement direction. A glowing pulsing food pellet bounces gently on the canvas. Floating +10 score popup animations appear at the food position when eaten. Your highest score is saved in localStorage and displayed in the HUD permanently.\n\nKeyboard (WASD and arrow keys), Escape/P to pause, and touch swipe controls are all supported.',
    whatsNew       : [
      'Fixed-timestep rAF game loop — butter-smooth at any frame rate',
      'Neon visual aesthetic: glowing snake, pulsing food, grid lines',
      'Snake eyes animated to track current movement direction',
      'Floating +10 score popup with fade-out animation on food collection',
      'Solid walls vs. wrap-around boundary mode selection',
      'Touch swipe input support for larger touch screens',
      'High score persisted in localStorage — survives page reloads',
    ],
    screenshotLabels : ['Gameplay', 'Settings Menu', 'Game Over', 'Paused'],
    size           : '~30 KB',
    codeSize       : 30478,
    permissions    : [],
    isSystemApp    : false,
    tags           : ['game', 'snake', 'retro', 'arcade', 'canvas', 'neon'],
    minKOSVersion  : 'Alpha 9',
    addedInVersion : 'Alpha 9',
  },

  /* ──────────────────────────────────────────────────────────
     KOS APP STORE  (appstore)
     ────────────────────────────────────────────────────────── */
  'store': {
    displayName    : 'KOS App Store',
    version        : '1.0.0',
    versionDate    : 'May 28, 2026',
    developer      : 'Kalapurackal Studios',
    devLink        : 'https://galaxy-adora.github.io/KOS-26-Ultimate/',
    category       : 'System',
    shortDesc      : 'Discover and manage every app on your KOS system.',
    description    : 'KOS App Store is your central hub for discovering, browsing, and managing all applications installed on KOS — both built-in system apps and custom apps built with KOS Studio.\n\nBrowse by category (System, Media, Productivity, Utilities, Games, Developer, Internet, Custom) or search by name, description, or tags. Every app has a dedicated detail page showing its description, full version history, What\'s New section, storage and code size, permission scopes, developer info, and the KOS version it was added in.\n\nSystem apps are clearly badged with a microchip indicator. Custom Studio apps are shown with a code badge. Tap Open on any card to launch the app immediately.',
    whatsNew       : [
      'Initial release — all KOS apps browsable in one place',
      'Category filter pills: All, System, Media, Productivity, Utilities, Games, Developer, Internet, Custom',
      'Full-detail app pages with description, What\'s New, and version info',
      'Storage and code size shown per app',
      'Permission scope display for all apps',
      'Custom KOS Studio apps shown alongside system apps',
      'Real-time search across name, description, and tags',
    ],
    screenshotLabels : ['App Grid', 'App Detail', 'Category Filter', 'Search'],
    size           : '~15 KB',
    codeSize       : 15000,
    permissions    : [],
    isSystemApp    : true,
    tags           : ['store', 'apps', 'discover', 'manage', 'catalog', 'browse'],
    minKOSVersion  : 'Alpha 9',
    addedInVersion : 'Alpha 9',
  },

};
