/* ══════════════════════════════════════════════════════════════
   KOS ULTIMATE 2026 — kos-sound.js  (COMPLETE FINAL VERSION)
   System Sound Engine — synthesized UI sounds via Web Audio API.
   Zero audio files needed. All sounds are procedurally generated.

   LOAD ORDER (index.html — after kos-kernel.js, before kos-fs.js)
     <script defer src="kos-sound.js"></script>

   QUICK USAGE:
     KOSSound.play('click');
     KOSSound.play('error');
     KOSSound.play('success');
     KOSSound.play('notify');
     KOSSound.setVolume(0.5);
     KOSSound.setMuted(true);
     KOSSound.setTheme('retro');

   CUSTOM SOUNDS:
     KOSSound.register('myapp-ding', () => {
       KOSSound._rawTone({ freq:880, dur:0.12, vol:0.10, type:'sine' });
     });
     KOSSound.play('myapp-ding');
     KOSSound.unregister('myapp-ding');

   ALL SOUND IDs:
     startup, login, windowOpen, windowClose, minimize, restore,
     click, success, error, notify, save, delete, toggle, snap,
     lock, shutter

   ALL THEME IDs:
     default, retro, soft, silent

   _rawTone() PARAMS:
     { type, freq, freq2, vol, start, dur, ramp, decay }

   KOSBUS AUTO-TRIGGERS:
     kos:app-opened    → windowOpen
     kos:app-closed    → windowClose
     kos:app-minimized → minimize
     kos:app-restored  → restore
     kos:theme-changed → toggle
     kos:glass-changed → toggle
     kos:notif-posted  → notify
     kos:fs-write      → save
     kos:fs-delete     → delete
     kos:login-success → login
     kos:sleep         → lock
     kos:restart       → lock
     kos:shutdown      → lock
   ══════════════════════════════════════════════════════════════ */

'use strict';

window.KOSSound = (() => {

  /* ── §1  STATE ─────────────────────────────────────────────── */
  let _ctx         = null;
  let _vol         = 0.6;
  let _muted       = false;
  let _activeTheme = 'default';

  const LS_VOL   = 'kos-sound-vol';
  const LS_MUTED = 'kos-sound-muted';
  const LS_THEME = 'kos-sound-theme';

  try {
    const sv = localStorage.getItem(LS_VOL);
    if (sv !== null) _vol = Math.max(0, Math.min(1, parseFloat(sv)));
    _muted = localStorage.getItem(LS_MUTED) === 'true';
    const st = localStorage.getItem(LS_THEME);
    if (st) _activeTheme = st;
  } catch (_) {}

  /* ── §2  AUDIO CONTEXT ─────────────────────────────────────── */
  function _getCtx() {
    if (_ctx) return _ctx;
    try {
      _ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('[KOSSound] Web Audio API unavailable.', e);
    }
    return _ctx;
  }

  /* ── §3  TONE GENERATOR ────────────────────────────────────── */
  /**
   * @param {object} opts
   * @param {string}  [opts.type='sine']   sine|square|sawtooth|triangle
   * @param {number}  [opts.freq=440]      Start Hz
   * @param {number}  [opts.freq2=null]    End Hz (glide). Omit = no glide.
   * @param {number}  [opts.vol=0.25]      Peak volume 0–1 (scaled by master)
   * @param {number}  [opts.start=0]       Seconds from now
   * @param {number}  [opts.dur=0.12]      Duration seconds
   * @param {number}  [opts.ramp=0.008]    Attack seconds
   * @param {number}  [opts.decay=0.08]    Release seconds
   */
  function _tone(opts) {
    if (_muted) return;
    const ctx = _getCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const {
      type  = 'sine',
      freq  = 440,
      freq2 = null,
      vol   = 0.25,
      start = 0,
      dur   = 0.12,
      ramp  = 0.008,
      decay = 0.08,
    } = opts;

    const now   = ctx.currentTime + start;
    const osc   = ctx.createOscillator();
    const gain  = ctx.createGain();
    const mvol  = vol * _vol;

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (freq2 !== null) osc.frequency.linearRampToValueAtTime(freq2, now + dur);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(mvol, now + ramp);
    gain.gain.setValueAtTime(mvol, now + dur - decay);
    gain.gain.linearRampToValueAtTime(0, now + dur);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  /* ── §4  BUILT-IN SOUNDS ───────────────────────────────────── */
  const SOUNDS = {
    startup: () => {
      _tone({ freq:220, freq2:440, dur:0.18, vol:0.16, type:'sine' });
      _tone({ freq:440, freq2:660, dur:0.22, vol:0.13, type:'sine', start:0.16 });
      _tone({ freq:660, freq2:880, dur:0.28, vol:0.11, type:'sine', start:0.36 });
      _tone({ freq:880,            dur:0.42, vol:0.09, type:'sine', start:0.62, decay:0.28 });
    },
    login: () => {
      _tone({ freq:440, dur:0.10, vol:0.12, type:'sine' });
      _tone({ freq:660, dur:0.10, vol:0.10, type:'sine', start:0.09 });
      _tone({ freq:880, dur:0.22, vol:0.08, type:'sine', start:0.17, decay:0.15 });
    },
    windowOpen:  () => _tone({ freq:660, freq2:880, dur:0.13, vol:0.11, type:'sine' }),
    windowClose: () => _tone({ freq:440, freq2:300, dur:0.13, vol:0.09, type:'sine' }),
    minimize:    () => _tone({ freq:500, freq2:350, dur:0.11, vol:0.08, type:'sine' }),
    restore:     () => _tone({ freq:350, freq2:500, dur:0.11, vol:0.08, type:'sine' }),
    click:       () => _tone({ freq:800, dur:0.050, vol:0.07, type:'sine', decay:0.04 }),
    success: () => {
      _tone({ freq:523, dur:0.10, vol:0.13, type:'sine' });
      _tone({ freq:659, dur:0.10, vol:0.11, type:'sine', start:0.09 });
      _tone({ freq:784, dur:0.18, vol:0.09, type:'sine', start:0.17, decay:0.12 });
    },
    error: () => {
      _tone({ freq:300, dur:0.10, vol:0.18, type:'sawtooth' });
      _tone({ freq:220, dur:0.15, vol:0.14, type:'sawtooth', start:0.08 });
    },
    notify: () => {
      _tone({ freq:880, dur:0.09, vol:0.13, type:'sine' });
      _tone({ freq:660, dur:0.11, vol:0.09, type:'sine', start:0.09 });
    },
    save: () => {
      _tone({ freq:660, dur:0.08, vol:0.10, type:'sine' });
      _tone({ freq:880, dur:0.13, vol:0.08, type:'sine', start:0.07, decay:0.09 });
    },
    delete:  () => _tone({ freq:250, freq2:180, dur:0.18, vol:0.16, type:'sawtooth', decay:0.13 }),
    toggle:  () => _tone({ freq:700, dur:0.065, vol:0.08, type:'sine',   decay:0.04 }),
    snap:    () => _tone({ freq:600, dur:0.055, vol:0.09, type:'square', decay:0.04 }),
    lock:    () => _tone({ freq:440, freq2:220, dur:0.26, vol:0.13, type:'sine',   decay:0.18 }),
    shutter: () => {
      _tone({ freq:1200, dur:0.03, vol:0.09, type:'square', decay:0.02 });
      _tone({ freq:600,  dur:0.05, vol:0.06, type:'sine',   start:0.03 });
    },
  };

  /* ── §5  THEMES ────────────────────────────────────────────── */
  const THEMES = {
    default: {},

    retro: {
      click:       { freq:1200, dur:0.04,  vol:0.09, type:'square', decay:0.02 },
      windowOpen:  { freq:440,  freq2:880, dur:0.09, vol:0.11, type:'square'   },
      windowClose: { freq:880,  freq2:220, dur:0.09, vol:0.09, type:'square'   },
      minimize:    { freq:660,  freq2:440, dur:0.07, vol:0.08, type:'square'   },
      restore:     { freq:440,  freq2:660, dur:0.07, vol:0.08, type:'square'   },
      notify:      { freq:1047, dur:0.06,  vol:0.12, type:'square', decay:0.03 },
      toggle:      { freq:880,  dur:0.05,  vol:0.09, type:'square', decay:0.03 },
      save:        { freq:1319, dur:0.07,  vol:0.09, type:'square', decay:0.05 },
      delete:      { freq:110,  dur:0.14,  vol:0.14, type:'square', decay:0.10 },
      error:       { freq:200,  dur:0.14,  vol:0.16, type:'square'             },
      snap:        { freq:800,  dur:0.04,  vol:0.10, type:'square', decay:0.02 },
      lock:        { freq:220,  freq2:110, dur:0.14, vol:0.12, type:'square', decay:0.10 },
    },

    soft: {
      click:       { freq:600, dur:0.07,  vol:0.04, type:'sine', decay:0.05 },
      windowOpen:  { freq:528, freq2:660, dur:0.17, vol:0.06, type:'sine'   },
      windowClose: { freq:396, freq2:264, dur:0.17, vol:0.05, type:'sine'   },
      minimize:    { freq:440, freq2:330, dur:0.11, vol:0.05, type:'sine'   },
      restore:     { freq:330, freq2:440, dur:0.11, vol:0.05, type:'sine'   },
      notify:      { freq:528, dur:0.12,  vol:0.07, type:'sine', decay:0.08 },
      toggle:      { freq:528, dur:0.08,  vol:0.05, type:'sine', decay:0.06 },
      save:        { freq:528, dur:0.09,  vol:0.06, type:'sine', decay:0.07 },
      delete:      { freq:264, dur:0.13,  vol:0.09, type:'sine', decay:0.09 },
      error:       { freq:220, dur:0.13,  vol:0.10, type:'sine'             },
      snap:        { freq:500, dur:0.06,  vol:0.05, type:'sine', decay:0.04 },
      lock:        { freq:330, freq2:220, dur:0.20, vol:0.07, type:'sine', decay:0.14 },
    },

    silent: { _all_silent: true },
  };

  /* ── §6  CUSTOM SOUND REGISTRY ─────────────────────────────── */
  const _customSounds = new Map();

  /**
   * Register a custom sound from any app.
   * Use namespaced IDs: 'myapp-ding' not 'ding'
   *
   * @param {string}   id   Unique sound ID
   * @param {Function} fn   Function that calls KOSSound._rawTone()
   *
   * @example
   * KOSSound.register('myapp-chime', () => {
   *   KOSSound._rawTone({ freq:880, dur:0.10, vol:0.10, type:'sine' });
   *   KOSSound._rawTone({ freq:1100, dur:0.14, vol:0.08, start:0.09 });
   * });
   */
  function register(id, fn) {
    if (typeof id !== 'string' || typeof fn !== 'function') {
      console.warn('[KOSSound] register(id, fn) — both arguments required.');
      return;
    }
    if (SOUNDS[id]) {
      console.warn(`[KOSSound] "${id}" shadows a built-in. Use a namespaced id.`);
    }
    _customSounds.set(id, fn);
  }

  function unregister(id) {
    _customSounds.delete(id);
  }

  /* ── §7  PLAY ──────────────────────────────────────────────── */
  function play(soundId) {
    if (_muted) return;
    if (THEMES[_activeTheme]?._all_silent) return;

    /* 1 — Custom sounds (highest priority) */
    if (_customSounds.has(soundId)) {
      try { _customSounds.get(soundId)(); } catch (e) {
        console.warn('[KOSSound] Custom sound error:', e);
      }
      return;
    }

    /* 2 — Theme single-tone override */
    const themeMap      = THEMES[_activeTheme] || {};
    const themeOverride = themeMap[soundId];

    if (themeOverride !== undefined) {
      try { _tone(themeOverride); } catch (e) {
        console.warn('[KOSSound] Theme tone error:', e);
      }
      return;
    }

    /* 3 — Default multi-tone SOUNDS definition */
    const fn = SOUNDS[soundId];
    if (!fn) {
      console.warn(
        `[KOSSound] Unknown sound: "${soundId}". ` +
        `Valid: ${Object.keys(SOUNDS).join(', ')}`
      );
      return;
    }
    try { fn(); } catch (e) {
      console.warn('[KOSSound] Playback error:', e);
    }
  }

  /* ── §8  VOLUME & MUTE ─────────────────────────────────────── */
  function setVolume(v) {
    _vol = Math.max(0, Math.min(1, parseFloat(v) || 0));
    try { localStorage.setItem(LS_VOL, _vol); } catch (_) {}
  }

  function setMuted(m) {
    _muted = !!m;
    try { localStorage.setItem(LS_MUTED, _muted); } catch (_) {}
  }

  function getVolume() { return _vol;   }
  function isMuted()   { return _muted; }

  /* ── §9  THEMES ────────────────────────────────────────────── */
  function setTheme(id) {
    if (!THEMES[id]) {
      console.warn(
        `[KOSSound] Unknown theme: "${id}". ` +
        `Valid: ${Object.keys(THEMES).join(', ')}`
      );
      return;
    }
    _activeTheme = id;
    try { localStorage.setItem(LS_THEME, id); } catch (_) {}
    if (id !== 'silent') setTimeout(() => play('click'), 50);
  }

  function getTheme() { return _activeTheme; }

  /* ── §10  KOSBUS AUTO-TRIGGERS ─────────────────────────────── */
  function _wireKOSBus() {
    if (typeof KOSBus === 'undefined') return;
    KOSBus.on('kos:app-opened',    () => play('windowOpen'));
    KOSBus.on('kos:app-closed',    () => play('windowClose'));
    KOSBus.on('kos:app-minimized', () => play('minimize'));
    KOSBus.on('kos:app-restored',  () => play('restore'));
    KOSBus.on('kos:theme-changed', () => play('toggle'));
    KOSBus.on('kos:glass-changed', () => play('toggle'));
    KOSBus.on('kos:notif-posted',  () => play('notify'));
    KOSBus.on('kos:fs-write',      () => play('save'));
    KOSBus.on('kos:fs-delete',     () => play('delete'));
    KOSBus.on('kos:login-success', () => play('login'));
    KOSBus.on('kos:sleep',         () => play('lock'));
    KOSBus.on('kos:restart',       () => play('lock'));
    KOSBus.on('kos:shutdown',      () => play('lock'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _wireKOSBus);
  } else {
    _wireKOSBus();
  }

  /* ── §11  PUBLIC SURFACE ───────────────────────────────────── */
  return Object.freeze({
    play,
    setVolume, getVolume,
    setMuted,  isMuted,
    setTheme,  getTheme,
    register,  unregister,
    _rawTone : _tone,
    sounds   : Object.keys(SOUNDS),
    themes   : Object.keys(THEMES),
  });

})();
