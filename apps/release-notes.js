/* ══════════════════════════════════════════════════════════════
   KOS ULTIMATE 2026 — apps/release-notes.js
   Release Notes — a clean, scrollable changelog viewer.

   HOW TO ADD A NEW VERSION:
   ─ Add a NEW object at the TOP of the RELEASES array below.
   ─ Each entry has: version, date, tag (e.g. 'Major'), and
     a sections array of { title, items[] } groups.
   ─ The first entry in RELEASES is always shown as "Latest".
   ─ That is literally all you need to do. ✓
   ══════════════════════════════════════════════════════════════ */

window.KOSApps = window.KOSApps || {};

/* ══════════════════════════════════════════════════════════════
   ✏️  EDIT THIS BLOCK — add a new object at the TOP for each
   new release. Older entries stay below automatically.
   ══════════════════════════════════════════════════════════════ */
const RELEASES = [

  /* ── Latest release — always first ── */
  {
    version:  'Alpha 8',
    date:     'May 23, 2026',
    tag:      'System Foundation Update',
    tagColor: 'blue',
    sections: [
      {
        title: '🚀 New Features',
        items: [
          'KOSFS unified filesystem kernel — all user files (images, audio, video, documents) now live in a single kos-filesystem IndexedDB store instead of four separate per-type databases',
          'KOSFS automatic migration — existing data from kos-photos, kos-videos, kos-audios, and kos-documents is silently migrated to the unified store on first boot after upgrade',
          'KOSFS File Picker — shared modal file picker (kos-fs-picker.js) used by all apps for opening, browsing, and uploading files, replacing each app\'s own ad-hoc input logic',
          'Terminal app — full system CLI with commands: help, clear, sysinfo, tree (renders full filesystem tree from KOSFS), theme, and glass; supports arrow-key command history navigation',
          'Music app — dedicated audio player backed by KOSFS audio storage',
          'Videos app — dedicated video player backed by KOSFS video storage',
          'Display Manager (kos-display.js) — Screen Zoom (50–250%), Text Size (6 levels), Bold Text toggle, and Brightness slider; persistent across sessions via localStorage',
          'System File Manifest (sys-manifest.js) — declares every project source file with path, size, category, and description; powers the terminal tree command without server access',
          'Topbar redesign — macOS-style menu bar replacing the old minimal layout; new KOS logo menu, File menu, Window menu, and an expanded System menu, all fully wired to real app and WM actions',
          'Topbar status bar — right-side Wi-Fi indicator, Volume dropdown with live slider, Battery indicator using the Battery Status API (hides gracefully when unavailable), and a Notification Center bell',
          'Notification Center — slide-in panel triggered from the topbar bell; shows current date and notification area',
          'KOSFS permission model — each app declares its allowed file types in the app manifest; KOSFS enforces access so apps can only read and write their permitted types',
        ],
      },
      {
        title: '✨ Improvements',
        items: [
          'Settings → Display section now delegates entirely to KOSDisplay module for zoom, text size, bold text, and brightness — settings are applied live without a reload',
          'Settings → About section now shows live KOSFS storage usage via KOSFS._systemStats()',
          'Notes app fully migrated to KOSFS — create, save, rename, delete, and upload all go through the unified filesystem; cross-app sync with Files app now works via KOSBus fs events',
          'Window menu in topbar lets you Minimize or Zoom the currently focused window, Minimize All, or Close All directly from the menu bar without touching the window controls',
          'File menu in topbar provides quick access to New Note, Open Files, and New App in Studio with one click',
          'Apps menu in topbar shows a curated shortcut list — Terminal, Task Manager, Settings, Files, Notes, Browser — plus the Spotlight search button at the top',
          'Volume control in topbar slider actually sets .volume on all active audio and video elements on the page',
          'Battery icon updates live — reflects real charge level and shows a charging indicator when plugged in via the Battery Status API',
        ],
      },
      {
        title: '🐛 Bug Fixes',
        items: [
          'Release Notes app window opened but the content area was completely blank — the init() function was querying for .rn-body and #rn-body which never exist; fixed to use the correct #releasenotes-body element that the Window Manager actually creates',
          'Apps using WM.setOnOpen() could silently fail if their init() queried a container element by a hardcoded id that did not match what the WM built from the app manifest',
          'KOSFS KOSBus compatibility — kos-fs.js called KOSBus.emit() but kos-kernel.js only defined KOSBus.dispatch(); resolved by aliasing emit to dispatch so all filesystem events fire correctly',
        ],
      },
    ],
  },

  /* ── Previous releases ── */
  {
    version:  'Alpha 7',
    date:     'May 21, 2026',
    tag:      'Performance Update',
    tagColor: 'green',
    sections: [
      {
        title: '⚡ Performance',
        items: [
          'Task Manager now uses in-place DOM updates — existing rows are patched instead of destroyed and rebuilt on every refresh tick',
          'Task Manager polling interval increased from 3s to 4s, reducing unnecessary main-thread work by 25%',
          'Task Manager KOSBus listeners debounced via requestAnimationFrame so rapid app state changes no longer flood the process list',
          'Task Manager element references are now cached once on init instead of queried on every refresh cycle',
          'Task Manager process list rebuilt using DocumentFragment, avoiding a full subtree parse on each tick',
          'Spotlight search filter debounced via requestAnimationFrame — redundant DOM walks on rapid keystrokes are eliminated',
          'Window session saves debounced to 400ms — rapid actions like dragging and quick-open no longer trigger repeated localStorage writes',
          'Photos app now stores images as ArrayBuffer (IDB v2) instead of base64, significantly reducing memory overhead',
          'Photos app metadata kept in RAM separately from image data — raw blobs are never held in memory simultaneously',
          'Photos app LRU blob cache capped at 40 object URLs — evicted URLs are immediately revoked to prevent memory leaks',
          'Photos app uses IntersectionObserver for lazy loading — only visible thumbnails are fetched from IndexedDB',
          'App stylesheets are now injected lazily on first launch instead of being linked at boot, reducing initial page load',
          'Google Fonts and FontAwesome loaded non-render-blocking using the media=print swap trick — no longer delays first paint',
        ],
      },
      {
        title: '🚀 New Features',
        items: [
          'Mobile blocker screen added — devices with screen width below 768px now see a dedicated unsupported device notice instead of a broken UI',
          'Notes app now fully synced with Files app — documents created in Notes appear in Files and vice versa',
          'About KOS now displays live system info including CPU core count, device memory, screen resolution, device pixel ratio, and browser engine',
          'KOS Studio now supports editing system app CSS and HTML live via the new System Apps tab',
          'Service Worker upgraded to cache-first strategy (kos-v2) — KOS can now run fully offline after the first load',
        ],
      },
      {
        title: '✨ Improvements',
        items: [
          'Window Manager minimum window size enforced at 300×200px to prevent unusable collapsed windows',
          'Dock rebuilds automatically when KOS Studio publishes or removes a custom app via kos:registry-changed event',
          'Context menu zone resolution order tightened — blocked zones, app menus, custom zones, and built-in zones now resolve in strict priority order',
          'winSize() responsive sizing helper now clamps window height to viewport before applying aspect ratio, preventing off-screen windows on smaller displays',
        ],
      },
    ],
  },

  /* ── Previous releases ── */

  {
    version:  'Alpha 6',
    date:     'April 3, 2026',
    tag:      'Alpha Release',
    tagColor: 'orange',
    sections: [
      {
        title: '🚀 New Features',
        items: [
          'Added App named Files which users can now upload audio video and txt according to the folder',
          'Added App named Notes where users can now create and edit uploaded txt files',
        ],
      },
    ],
  },

  {
    version:  'Alpha 5',
    date:     'April 2, 2026',
    tag:      'Alpha Release',
    tagColor: 'orange',
    sections: [
      {
        title: '🚀 New Features',
        items: [
          'Added right click menu with custom menus on different areas',
          'Added App named Release Notes',
          'Added App named About KOS',
          'apps not in dock now appears in dock when the app is opened',
        ],
      },
      {
        title: '✨ Improvements',
        items: [
          'Now users can see the release notes in the os',
          'Now users can see the KOS Software information in the os',
        ],
      },
      {
        title: '🐛 Bug Fixes',
        items: [
          'Fixed bug in spotlight that goes below screen so that user cannot see the apps',
        ],
      },
    ],
  },
  {
    version:  'Alpha 4 Restructure',
    date:     'april 1, 2025',
    tag:      'Code optimisation',
    tagColor: 'green',
    sections: [
      {
        title: '✨ Improvements',
        items: [
          'Complete code for the OS is rewritten for more os stability and better feature/app integrations',
          'Better ui enhancements for topnav  With smooth animations',
        ],
      },
    ],
  },

  {
    version:  'Alpha 4',
    date:     'March 30, 2026',
    tag:      'Feature Update',
    tagColor: 'orange',
    sections: [
      {
        title: '🚀 New Features',
        items: [
          'New app called calculator',
        ],
      },
      {
        title: '🐛 Bug Fixes',
        items: [
          'Fixed bug of duplicate icons in dock',
        ],
      },
    ],
  },

  {
    version:  'Alpha 3',
    date:     'March 30, 2026',
    tag:      'Feature Update',
    tagColor: 'orange',
    sections: [
      {
        title: '🚀 New Features',
        items: [
          'New app called KOS Studio for making custom apps for users',
        ],
      },
    ],
  },
  {
    version:  'Alpha 2',
    date:     'March 29, 2026',
    tag:      'Feature Update',
    tagColor: 'orange',
    sections: [
      {
        title: '🚀 New Features',
        items: [
          'New app called photos with ability to set wallpaper inside the app',
          'New app called browser to search web',
        ],
      },
      {
        title: '🐛 Bug Fixes',
        items: [
          'Fixed the bootlooping issue in Alpha 1',
        ],
      },
    ],
  },
  {
    version:  'Alpha 1',
    date:     'March 28, 2026',
    tag:      'First Update',
    tagColor: 'purple',
    sections: [
      {
        title: '🚀 New Features',
        items: [
          'Fresh new ui for KOS',
          'Complete code rewritten',
        ],
      },
    ],
  },
];
/* ══════════════════════════════════════════════════════════════ */

window.KOSApps.releasenotes = {
  init() {
    const body = document.getElementById('releasenotes-body');
    if (!body) return;

    const [latest, ...older] = RELEASES;

    let html = `
      <!-- ── Header ── -->
      <div class="rn-header">
        <div class="rn-header-icon"><i class="fa-solid fa-newspaper"></i></div>
        <div>
          <h1 class="rn-main-title">Release Notes</h1>
          <p  class="rn-main-sub">KOS Ultimate · What's changed</p>
        </div>
      </div>

      <!-- ── Latest version card ── -->
      <div class="rn-latest-card">
        <div class="rn-ver-row">
          <span class="rn-version-badge">v${latest.version}</span>
          <span class="rn-tag rn-tag-${latest.tagColor}">${latest.tag}</span>
          <span class="rn-date">${latest.date}</span>
        </div>
        ${_rnSections(latest.sections)}
      </div>
    `;

    if (older.length > 0) {
      html += `<div class="rn-older-label">Previous Releases</div>`;
      older.forEach(rel => {
        html += `
          <div class="rn-older-card">
            <div class="rn-ver-row">
              <span class="rn-version-badge rn-version-small">v${rel.version}</span>
              <span class="rn-tag rn-tag-${rel.tagColor}">${rel.tag}</span>
              <span class="rn-date">${rel.date}</span>
            </div>
            ${_rnSections(rel.sections)}
          </div>`;
      });
    }

    body.innerHTML = html;
  },
};

/* ── Renders section groups (title + bullet list) ── */
function _rnSections(sections) {
  return sections.map(sec => `
    <div class="rn-section">
      <h3 class="rn-section-title">${sec.title}</h3>
      <ul class="rn-list">
        ${sec.items.map(item => `<li class="rn-item">${item}</li>`).join('')}
      </ul>
    </div>
  `).join('');
}

/* Register init hook with WM */
WM.setOnOpen('releasenotes', () => window.KOSApps.releasenotes.init());