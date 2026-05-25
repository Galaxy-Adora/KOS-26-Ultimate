/* ═══════════════════════════════════════════════════════════
   KOS ULTIMATE 2026 — apps/music.js
   Music Engine — Spotify-style Liquid Glass player.
   ═══════════════════════════════════════════════════════════ */

'use strict';
window.KOSApps = window.KOSApps || {};

/* Fixed: was 'files', which hijacked the Files app's KOSFS registration.
   Music app must register under its own ID with audio permissions. */
const MUSIC_APP_ID    = 'music';
const AUDIO_TYPE_MATCH = 'audio';

const MU = {
  _tracks        : [],
  _activeIdx     : -1,
  _audio         : new Audio(),
  _isPlaying     : false,
  _isShuffle     : false,
  _isLoop        : false,
  _searchQuery   : '',
  _modalResolve  : null,
  _currentBlobUrl: null,
};

window.KOSApps.music = {
  async init() {
    const body = document.getElementById('music-body');
    if (!body) return;

    /* Fixed: register this app with KOSFS before any list/read/write calls */
    const manifest = (typeof AppManifest !== 'undefined')
      ? AppManifest.find(a => a.id === MUSIC_APP_ID)
      : null;
    KOSFS.registerApp(MUSIC_APP_ID, manifest?.permissions || ['audios']);
    await KOSFS.ready;

    _renderPlayerShell(body);
    _bindAudioListeners();
    await _loadAudioLibrary();

    KOSBus.on('kos:fs-write',  () => _silentReload());
    KOSBus.on('kos:fs-delete', () => _silentReload());
  },

  async playTrackDirectly(fileId) {
    await KOSFS.ready;
    await _loadAudioLibrary();
    const targetIndex = MU._tracks.findIndex(t => String(t.id) === String(fileId));
    if (targetIndex !== -1) {
      _selectTrackByIndex(targetIndex);
    } else {
      _showMusicToast('Track could not be found in the audio library.');
    }
  },
};

/* ── Shell render ── */
function _renderPlayerShell(body) {
  body.innerHTML = `
    <div class="mu-app">
      <input type="file" id="mu-native-uploader" accept="audio/*" multiple style="display:none">

      <aside class="mu-sidebar">
        <div class="mu-logo">
          <i class="fa-brands fa-spotify"></i>
          <span>KOS Studio</span>
        </div>
        <nav class="mu-nav-group">
          <div class="mu-nav-item active"><i class="fa-solid fa-house"></i> <span>Home</span></div>
          <div class="mu-nav-item"><i class="fa-solid fa-magnifying-glass"></i> <span>Search Library</span></div>
          <div class="mu-nav-item"><i class="fa-solid fa-lines-leaning"></i> <span>Your Playlists</span></div>
        </nav>
      </aside>

      <main class="mu-main-view">
        <header class="mu-top-bar">
          <div class="mu-search-wrapper">
            <i class="fa-solid fa-magnifying-glass mu-search-icon"></i>
            <input type="text" id="mu-search-bar"
                   placeholder="What do you want to listen to?"
                   oninput="window._muFilterTracks(this.value)">
          </div>
          <button class="mu-btn-import"
                  onclick="document.getElementById('mu-native-uploader').click()">
            <i class="fa-solid fa-arrow-up-from-bracket"></i> Import Track
          </button>
        </header>

        <div class="mu-content-scroll">
          <h2 class="mu-view-header">Tracks Vault</h2>
          <div id="mu-dynamic-tracks-view"></div>
        </div>
      </main>

      <footer class="mu-player-deck">
        <div class="mu-deck-now-playing">
          <div class="mu-deck-thumb" id="mu-deck-cover">
            <i class="fa-solid fa-music"></i>
          </div>
          <div class="mu-deck-info">
            <div class="mu-deck-track-name" id="mu-deck-track-title">No track selected</div>
            <div class="mu-deck-artist" id="mu-deck-track-artist">Local Storage</div>
          </div>
        </div>

        <div class="mu-deck-controls">
          <div class="mu-control-buttons">
            <button class="mu-btn-flat" id="mu-btn-shuffle"
                    onclick="window._muToggleShuffle()" title="Shuffle">
              <i class="fa-solid fa-shuffle"></i>
            </button>
            <button class="mu-btn-flat" onclick="window._muStepBack()" title="Previous">
              <i class="fa-solid fa-backward-step"></i>
            </button>
            <button class="mu-btn-circ" id="mu-btn-play-pause"
                    onclick="window._muTogglePlayback()" title="Play / Pause">
              <i class="fa-solid fa-play"></i>
            </button>
            <button class="mu-btn-flat" onclick="window._muStepForward()" title="Next">
              <i class="fa-solid fa-forward-step"></i>
            </button>
            <button class="mu-btn-flat" id="mu-btn-loop"
                    onclick="window._muToggleLoop()" title="Loop">
              <i class="fa-solid fa-repeat"></i>
            </button>
          </div>
          <div class="mu-timeline-container">
            <span id="mu-time-current">0:00</span>
            <div class="mu-progress-bar" id="mu-progress-track"
                 onclick="window._muSeekAudio(event)">
              <div class="mu-progress-fill" id="mu-progress-fill"></div>
            </div>
            <span id="mu-time-duration">0:00</span>
          </div>
        </div>

        <div class="mu-deck-right-utilities">
          <i class="fa-solid fa-volume-high" style="font-size:13px"></i>
          <div class="mu-volume-slider" id="mu-volume-rail"
               onclick="window._muAdjustVolume(event)">
            <div class="mu-progress-fill" id="mu-volume-fill" style="width:80%"></div>
          </div>
        </div>
      </footer>

      <div class="mu-modal-overlay" id="mu-modal-overlay">
        <div class="mu-dialog-box">
          <h3 style="margin:0 0 12px;font-size:16px">Confirm Delete</h3>
          <p id="mu-dialog-text" style="margin:0;font-size:13px;color:#b3b3b3;line-height:1.5"></p>
          <div class="mu-dialog-buttons">
            <button class="mu-dialog-btn mu-btn-cancel"
                    onclick="window._muCloseModal(false)">Cancel</button>
            <button class="mu-dialog-btn mu-btn-confirm"
                    onclick="window._muCloseModal(true)">Delete Track</button>
          </div>
        </div>
      </div>

      <div class="mu-toast" id="mu-toast"></div>
    </div>
  `;

  document.getElementById('mu-native-uploader').addEventListener('change', e => {
    _handleAudioUpload(Array.from(e.currentTarget.files || []));
    e.currentTarget.value = '';
  });
}

/* ── Data layer ── */
async function _loadAudioLibrary() {
  const container = document.getElementById('mu-dynamic-tracks-view');
  if (!container) return;
  try {
    MU._tracks = await KOSFS.list(MUSIC_APP_ID, { type: AUDIO_TYPE_MATCH });
    _renderTracksList();
  } catch (err) {
    container.innerHTML = `<div class="mu-empty-state"><span>Error loading audio library.</span></div>`;
  }
}

async function _silentReload() {
  const activeId = MU._activeIdx !== -1 ? MU._tracks[MU._activeIdx]?.id : null;
  MU._tracks = await KOSFS.list(MUSIC_APP_ID, { type: AUDIO_TYPE_MATCH });
  if (activeId) {
    MU._activeIdx = MU._tracks.findIndex(t => t.id === activeId);
  }
  _renderTracksList();
}

function _renderTracksList() {
  const container = document.getElementById('mu-dynamic-tracks-view');
  if (!container) return;

  let filtered = MU._tracks;
  if (MU._searchQuery) {
    filtered = filtered.filter(t =>
      (t.name || '').toLowerCase().includes(MU._searchQuery)
    );
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="mu-empty-state">
        <i class="fa-solid fa-music" style="font-size:40px;margin-bottom:12px;opacity:0.3"></i>
        <span>No audio files found. Import tracks to get started.</span>
      </div>`;
    return;
  }

  container.innerHTML = `
    <table class="mu-track-table">
      <thead>
        <tr class="mu-th-row">
          <th style="width:40px;text-align:center">#</th>
          <th>Title</th>
          <th>Size</th>
          <th style="width:60px;text-align:center">
            <i class="fa-regular fa-trash-can"></i>
          </th>
        </tr>
      </thead>
      <tbody>
        ${filtered.map((track, i) => {
          const globalIdx = MU._tracks.findIndex(t => t.id === track.id);
          const isCurrent = globalIdx === MU._activeIdx;
          return `
            <tr class="mu-track-row${isCurrent ? ' playing' : ''}"
                onclick="window._muSelectTrackByIndex(${globalIdx})">
              <td style="text-align:center;color:#b3b3b3">
                ${isCurrent && MU._isPlaying
                  ? '<i class="fa-solid fa-bars-staggered" style="color:#1ed760"></i>'
                  : i + 1}
              </td>
              <td>
                <div class="mu-track-meta-col">
                  <div class="mu-track-icon-box">
                    <i class="fa-solid fa-music"></i>
                  </div>
                  <div class="mu-track-title" title="${_esc(track.name)}">
                    ${_esc(track.name)}
                  </div>
                </div>
              </td>
              <td style="color:#b3b3b3">${KOSFS.formatSize(track.size || 0)}</td>
              <td style="text-align:center">
                <button class="mu-track-action-btn"
                        onclick="window._muTriggerTrackPurge('${track.id}', event)">
                  <i class="fa-regular fa-trash-can"></i>
                </button>
              </td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

window._muFilterTracks = function (query) {
  MU._searchQuery = query.trim().toLowerCase();
  _renderTracksList();
};

/* ── Audio engine ── */
function _bindAudioListeners() {
  MU._audio.addEventListener('timeupdate', () => {
    const current  = MU._audio.currentTime || 0;
    const duration = MU._audio.duration    || 0;
    const fill = document.getElementById('mu-progress-fill');
    if (fill && duration > 0) fill.style.width = `${(current / duration) * 100}%`;
    const txtCur = document.getElementById('mu-time-current');
    if (txtCur) txtCur.textContent = _fmtDuration(current);
  });

  MU._audio.addEventListener('loadedmetadata', () => {
    const txtDur = document.getElementById('mu-time-duration');
    if (txtDur) txtDur.textContent = _fmtDuration(MU._audio.duration || 0);
  });

  MU._audio.addEventListener('ended', () => {
    if (MU._isLoop) {
      MU._audio.currentTime = 0;
      MU._audio.play().catch(() => {});
    } else {
      window._muStepForward();
    }
  });
}

window._muSelectTrackByIndex = async function (index) {
  if (index < 0 || index >= MU._tracks.length) return;

  if (MU._currentBlobUrl) {
    URL.revokeObjectURL(MU._currentBlobUrl);
    MU._currentBlobUrl = null;
  }

  MU._activeIdx = index;
  const track = MU._tracks[index];

  const titleEl = document.getElementById('mu-deck-track-title');
  const coverEl = document.getElementById('mu-deck-cover');
  if (titleEl) titleEl.textContent = track.name;
  if (coverEl) coverEl.innerHTML =
    `<i class="fa-solid fa-compact-disc fa-spin" style="color:#1ed760"></i>`;

  try {
    MU._currentBlobUrl = await KOSFS.readObjectURL(MUSIC_APP_ID, track.id);
    MU._audio.src = MU._currentBlobUrl;
    MU._isPlaying = true;
    _syncPlayPauseBtn();
    _renderTracksList();

    MU._audio.play().catch(() => {
      _showMusicToast('Playback could not start — check browser autoplay settings.');
      MU._isPlaying = false;
      _syncPlayPauseBtn();
    });
  } catch (err) {
    _showMusicToast('Failed to load track from storage.');
  }
};

window._muTogglePlayback = function () {
  if (MU._activeIdx === -1 && MU._tracks.length > 0) {
    window._muSelectTrackByIndex(0);
    return;
  }
  if (MU._activeIdx === -1) return;

  const coverEl = document.getElementById('mu-deck-cover');
  if (MU._isPlaying) {
    MU._audio.pause();
    MU._isPlaying = false;
    if (coverEl) coverEl.innerHTML = `<i class="fa-solid fa-music"></i>`;
  } else {
    MU._audio.play().catch(() => {});
    MU._isPlaying = true;
    if (coverEl) coverEl.innerHTML =
      `<i class="fa-solid fa-compact-disc fa-spin" style="color:#1ed760"></i>`;
  }
  _syncPlayPauseBtn();
  _renderTracksList();
};

window._muStepForward = function () {
  if (!MU._tracks.length) return;
  if (MU._isShuffle) {
    window._muSelectTrackByIndex(Math.floor(Math.random() * MU._tracks.length));
  } else {
    window._muSelectTrackByIndex((MU._activeIdx + 1) % MU._tracks.length);
  }
};

window._muStepBack = function () {
  if (!MU._tracks.length) return;
  const prev = MU._activeIdx <= 0 ? MU._tracks.length - 1 : MU._activeIdx - 1;
  window._muSelectTrackByIndex(prev);
};

window._muToggleShuffle = function () {
  MU._isShuffle = !MU._isShuffle;
  document.getElementById('mu-btn-shuffle')?.classList.toggle('active', MU._isShuffle);
};

window._muToggleLoop = function () {
  MU._isLoop = !MU._isLoop;
  document.getElementById('mu-btn-loop')?.classList.toggle('active', MU._isLoop);
};

window._muSeekAudio = function (e) {
  const bar = document.getElementById('mu-progress-track');
  if (!bar || !MU._audio.duration) return;
  MU._audio.currentTime = (e.offsetX / bar.clientWidth) * MU._audio.duration;
};

window._muAdjustVolume = function (e) {
  const rail = document.getElementById('mu-volume-rail');
  if (!rail) return;
  const pct = Math.max(0, Math.min(1, e.offsetX / rail.clientWidth));
  MU._audio.volume = pct;
  const fill = document.getElementById('mu-volume-fill');
  if (fill) fill.style.width = `${pct * 100}%`;
};

function _syncPlayPauseBtn() {
  const btn = document.getElementById('mu-btn-play-pause');
  if (btn) btn.innerHTML = MU._isPlaying
    ? `<i class="fa-solid fa-pause"></i>`
    : `<i class="fa-solid fa-play"></i>`;
}

/* ── Upload ── */
async function _handleAudioUpload(files) {
  if (!files.length) return;
  _showMusicToast(`Uploading ${files.length} track${files.length > 1 ? 's' : ''}…`);
  let loaded = 0;
  for (const f of files) {
    try {
      await KOSFS.write(MUSIC_APP_ID, f);
      loaded++;
    } catch (err) {
      console.error('[Music] upload error:', err);
    }
  }
  if (loaded > 0) {
    _showMusicToast(`${loaded} track${loaded > 1 ? 's' : ''} imported.`);
    await _loadAudioLibrary();
  } else {
    _showMusicToast('Upload failed — check KOSFS permissions.');
  }
}

/* ── Delete ── */
window._muTriggerTrackPurge = function (fileId, event) {
  event.stopPropagation();
  const match = MU._tracks.find(t => String(t.id) === String(fileId));
  if (!match) return;

  _showConfirmModal(`Delete "${match.name}"?`).then(async (approved) => {
    if (!approved) return;

    if (MU._activeIdx !== -1 && MU._tracks[MU._activeIdx]?.id === fileId) {
      MU._audio.pause();
      MU._audio.src = '';
      MU._isPlaying = false;
      MU._activeIdx = -1;
      _syncPlayPauseBtn();
      const titleEl = document.getElementById('mu-deck-track-title');
      const coverEl = document.getElementById('mu-deck-cover');
      if (titleEl) titleEl.textContent = 'No track selected';
      if (coverEl) coverEl.innerHTML = `<i class="fa-solid fa-music"></i>`;
      if (MU._currentBlobUrl) {
        URL.revokeObjectURL(MU._currentBlobUrl);
        MU._currentBlobUrl = null;
      }
    }

    try {
      await KOSFS.delete(MUSIC_APP_ID, fileId);
      _showMusicToast('Track deleted.');
      await _loadAudioLibrary();
    } catch {
      _showMusicToast('Delete failed.');
    }
  });
};

/* ── Modal ── */
function _showConfirmModal(text) {
  return new Promise(resolve => {
    const el  = document.getElementById('mu-modal-overlay');
    const txt = document.getElementById('mu-dialog-text');
    if (!el || !txt) return resolve(false);
    txt.textContent = text;
    el.classList.add('active');
    MU._modalResolve = resolve;
  });
}

window._muCloseModal = function (decision) {
  document.getElementById('mu-modal-overlay')?.classList.remove('active');
  if (MU._modalResolve) { MU._modalResolve(decision); MU._modalResolve = null; }
};

/* ── Helpers ── */
function _showMusicToast(msg) {
  const el = document.getElementById('mu-toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('visible');
  clearTimeout(MU._toastTimer);
  MU._toastTimer = setTimeout(() => el.classList.remove('visible'), 2500);
}

function _fmtDuration(s) {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec < 10 ? '0' : ''}${sec}`;
}

function _esc(s) {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── WM registration ── */
if (typeof WM !== 'undefined') {
  WM.setOnOpen('music', () => window.KOSApps.music.init());
}
