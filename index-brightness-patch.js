/* ══════════════════════════════════════════════════════════════
   index.html PATCH — two functions to fix in the inline <script>
   ══════════════════════════════════════════════════════════════

   ISSUE 1: qsSetBrightness passes v/100 to KOSDisplay.setBrightness,
   but setBrightness() expects a value in the range 10–100 (not 0–1).
   Result: moving the slider to 50% passes 0.5, which is clamped to 10
   (near-black screen).

   ISSUE 2: _syncBrightness() reads from localStorage('kos-brightness')
   but KOSDisplay stores its state in IndexedDB, not localStorage.
   The sync never actually works.

   REPLACE the existing qsSetBrightness function with this: */

function qsSetBrightness(val) {
  const v = parseInt(val, 10);
  const sl = document.getElementById('qs-bright-slider');
  if (sl) sl.style.setProperty('--qs-fill', v + '%');
  document.getElementById('qs-bright-val').textContent = v;
  /* Pass v directly — KOSDisplay.setBrightness expects 10–100, not 0–1 */
  if (window.KOSDisplay && typeof window.KOSDisplay.setBrightness === 'function') {
    window.KOSDisplay.setBrightness(v);
  } else {
    const opacity = (100 - v) / 100 * 0.88;
    const overlay = document.getElementById('kos-brightness-overlay');
    if (overlay) overlay.style.background = 'rgba(0,0,0,' + opacity.toFixed(3) + ')';
  }
}

/* REPLACE the existing _syncBrightness function with this:
   Reads from KOSDisplay.get.brightness() (the live in-memory value)
   instead of a localStorage key that is never written. */

function _syncBrightness() {
  if (!window.KOSDisplay) return;
  const pct = KOSDisplay.get.brightness();   /* returns 10–100 */
  if (isNaN(pct)) return;
  const sl = document.getElementById('qs-bright-slider');
  if (sl) { sl.value = pct; sl.style.setProperty('--qs-fill', pct + '%'); }
  const vl = document.getElementById('qs-bright-val');
  if (vl) vl.textContent = pct;
}
