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
export function winSize(pct, [rw, rh]) {
  const vw = window.innerWidth  * (pct / 100);
  const vh = window.innerHeight * (pct / 100);
  const h  = Math.min(vw * (rh / rw), window.innerHeight * 0.88);
  return { width: Math.round(vw), height: Math.round(h) };
}


