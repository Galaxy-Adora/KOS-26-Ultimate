# KOS Ultimate 2026 (Alpha 8) — Core System Documentation

Welcome to the central repository documentation for **KOS Ultimate 2026 (Alpha 8)**, a web-based, client-side desktop operating system simulation designed for speed, modularity, and offline capability.

This repository implements a completely decentralized, serverless architecture running entirely inside the web browser as an installable Progressive Web App (PWA).

---

## 🚀 Quick Start & Core Credentials

* **Host Environment:** Runs via any static web server (e.g., Nginx, GitHub Pages, Live Server) with no runtime build steps or backend servers.
* **System Lock Screen Credentials:**
    * **Default System Password:** `kosul`
    * *Security Note:* The password can be customized or fully removed inside the **Settings App** (`Settings` → `Password & Security`). If a custom password is set, it overrides the default and is stored locally via `localStorage`.

---

## 🏛️ Architectural Foundations

KOS Ultimate operates under five structural rules designed to keep the system responsive, predictable, and memory-safe:

1.  **Zero Cross-Module Direct Calls:** Components never invoke functions on other modules directly. Inter-process communication (IPC) is strictly bound to `KOSBus`, a lightweight reactive wrapper around browser custom events.
2.  **Manifest-Driven Architecture:** `kos-manifest.js` serves as the central application registry and single source of truth. The Dock, Spotlight launcher, Window Manager, and Settings read fields dynamically from this schema. Registering a new app requires zero modifications to system shells—only an addition to the manifest array.
3.  **Lazy Asset Injection:** To maintain instant initial boot velocities, application-specific scripts and styles are decoupled from the main page load. Script tags and style nodes are dynamically generated and injected into the DOM by the Window Manager (`WM`) only when the respective app is launched for the first time.
4.  **Memory-Safe Media Pipelines:** High-overhead data types (such as raw images, audio buffers, and videos) are cached exclusively as binary `ArrayBuffer` payloads inside IndexedDB. Only structural metadata remains in memory. Heavy blobs convert to DOM Object URLs dynamically and are proactively garbage-collected using an LRU cache eviction policy.
5.  **Debounced Storage Persistence:** Critical state serialization (such as active window coordinates, icon palette grids, and spotlight state) is shifted into animation loops via `requestAnimationFrame` or debounced to shield the main thread from thread-blocking disk I/O.

---

## 📂 System Directory Structure

```text
alpha 8/
├── index.html                    ← Single page layout & strict script execution order
├── manifest.json                 ← Web App Manifest for native desktop/mobile installs
├── sw.js                         ← Service Worker managing the Cache-First offline pipeline
│
├── kos-manifest.js               ← Global AppManifest registry (Single Source of Truth)
├── kos-kernel.js                 ← Low-level primitives: KOSBus, Themes, Toast, Clock, Power
├── kos-wm.js                     ← Window Manager singleton (Drag, Resize, Focus, Snapping)
├── kos-init.js                   ← Boot sequence orchestrator, Spotlight search, Dock views
├── kos-contextmenu.js            ← Desktop & Window systemic right-click context tracking
├── kos-display.js                ← Screen Zoom, Typography layout scaling, brightness rules
│
├── kos-fs.js                     ← [Alpha 9 Module] Unified browser filesystem layer
├── kos-fs-picker.js              ← [Alpha 9 Module] Shared system file selection modal
│
├── terminal.js                   ← System Root Terminal (IIFE executing internal commands)
│
├── apps/                         ← Modular System Application Execution Contexts
│   ├── browser.js                ← Tabbed browser simulator running secure sandboxed iframes
│   ├── calculator.js             ← High-precision calculator with structural number layout
│   ├── files.js                  ← File browser equipped with specific type filters
│   ├── notes.js                  ← Workspace text editor fully wired into KOSFS
│   ├── photos.js                 ← LRU-backed gallery app with lazy-loading viewports
│   ├── release-notes.js          ← Dynamic data-driven systemic changelog pipeline
│   ├── studio.js                 ← Internal app builder with local live sandbox compiler
│   ├── task-mgr.js               ← Real-time heap memory, process trees, and force-quits
│   ├── ui-manager.js             ← Settings controller handling themes, access, and security
│   └── about.js                  ← Live hardware analyzer and build details
│
└── css/                          ← System Stylesheets
    ├── core-vars.css             ← Theme vectors, systemic color variables, animations
    ├── shell.css                 ← Display targets, login screen, desktop nodes, topbar
    ├── wm.css                    ← Drag boundaries, window geometry, resize grids
    └── apps/                     ← Scoped app layout styling rules
```

---

## ⏳ Critical Execution Order (`index.html`)

Scripts must load strictly sequentially via `defer` execution flags. Disruption of this chain causes dependency breaks across global systems:

1.  **`kos-manifest.js`**: Populates the underlying `AppManifest` array before system engines initialize.
2.  **`kos-kernel.js`**: Declares `KOSBus`, sets systemic core state flags, and configures theme configurations.
3.  **`kos-wm.js`**: Instantiates the parent Window Manager (`WM`) using definitions loaded from the manifest.
4.  *Alpha 9 Modules Insertion point (`kos-fs.js`, `kos-fs-picker.js`)*.
5.  **`apps/*`**: App packages register lifecycle execution bindings via `WM.setOnOpen(appId, callback)`.
6.  **`kos-display.js`**: Injects view engine configurations, scaling rules, and zoom factors to prevent visual styling flashes.
7.  **`kos-init.js`**: Executes the absolute final boot sequences, initializes structural DOM overlays, builds desktop elements, and restores historical active sessions.

---

## 🎛️ System Infrastructure Interconnects (`KOSBus`)

Cross-module coordination relies entirely on event vectors dispatched through `KOSBus`. Below is the architectural telemetry table mapping standard lifecycle transitions:

| Event Identifier | Data Context Payload | Origin Source | Active Subscribing Listeners |
|---|---|---|---|
| `kos:app-opened` | `{ appId }` | `WM.open()` | Dock UI (sync states), Task Manager |
| `kos:app-closed` | `{ appId }` | `WM.close()` | Dock UI (remove run states), Task Manager |
| `kos:app-minimized` | `{ appId }` | `WM.minimize()` | Dock UI (toggle visibility indicators) |
| `kos:app-restored` | `{ appId }` | `WM.restore()` | Dock UI (re-focus execution bounds) |
| `kos:registry-changed` | `{}` | KOS Studio | Dock UI / Spotlight (trigger layout rebuild) |
| `kos:theme-changed` | `{ theme }` | `applyTheme()` | Connected client application instances |
| `kos:glass-changed` | `{ enabled }` | `applyGlass()` | Active desktop glass panels |
| `kos:fs-write` | `{ id, type, name, size, writtenBy }` | `KOSFS.write()` | Notes App (hot-reload reactive files list) |

---

## 🛠️ Upcoming Alpha 9 Filesystem Strategy

The architecture lays out the migration path from isolated, single-app legacy database systems (`kos-photos`, `kos-videos`, etc.) to a centralized filesystem kernel called **KOSFS** (`kos-fs.js`).

To upgrade individual apps to support the centralized storage engine, ensure your initialization loop registers permission blocks explicitly:

```javascript
// Add this snippet inside your app module's init block to access KOSFS
const manifest = AppManifest.find(app => app.id === 'your_app_id');
KOSFS.registerApp('your_app_id', manifest.permissions);
await KOSFS.ready;

// File creation execution sample under Alpha 9 standards:
await KOSFS.write('your_app_id', textBuffer, {
  name: 'document.txt',
  mimeType: 'text/plain'
});
```

*Developer Integration Warning:* While `kos-fs.js` triggers events via `KOSBus.emit()`, Alpha 8 core modules utilize `KOSBus.dispatch()`. When executing the Alpha 9 upgrade script, register an alias binding inside `kos-kernel.js`: `KOSBus.emit = KOSBus.dispatch.bind(KOSBus);` to guarantee systemic compatibility.
