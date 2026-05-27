/**
 * KOS Ultimate 2026 — Core System Utility
 * Module: Root System Terminal CLI
 * Location: /terminal.js (Root Directory)
 */

(function () {
    const appId = 'terminal';

    const KEY_PASSWORD    = 'kos-password';
    const KEY_NO_PASSWORD = 'kos-no-password';
    const DEFAULT_PASS    = 'kosul';

    /* ── Password helpers ──────────────────────────────────────────
       KOS has two password localStorage keys:
         'kos-password'       — written by the terminal's passwd command
         'kos_login_password' — written by Settings app and the OOBE setup
       Verification must accept input matching EITHER stored key so that
       purge (and passwd) work regardless of which path the user used to
       set their password. The hardcoded default 'kosul' is only used when
       no custom password exists at all.
       ──────────────────────────────────────────────────────────────── */
    const KEY_SETTINGS_PW = 'kos_login_password';   // ui-manager / kos-setup.js

    function _getPass() {
        return localStorage.getItem(KEY_PASSWORD)
            || localStorage.getItem(KEY_SETTINGS_PW)
            || DEFAULT_PASS;
    }

    function _isNoPass() {
        return localStorage.getItem(KEY_NO_PASSWORD) === 'true';
    }

    function _verifyPass(input) {
        const termPw = localStorage.getItem(KEY_PASSWORD);
        const setPw  = localStorage.getItem(KEY_SETTINGS_PW);
        // Accept against whichever key(s) are populated, or the fallback default.
        if (termPw && input === termPw) return true;
        if (setPw  && input === setPw)  return true;
        if (!termPw && !setPw && input === DEFAULT_PASS) return true;
        return false;
    }

    const RootTerminal = {
        history      : [],
        historyIndex : -1,
        _interactive : null,

        commands: {

            'help': {
                description: 'List all available environment utilities',
                execute: () => [
                    '┌─ KOS SYSTEM CLI ─────────────────────────────────────┐',
                    ...Object.entries(RootTerminal.commands).map(
                        ([cmd, def]) => `│  ${cmd.padEnd(16)} ${def.description}`
                    ),
                    '└──────────────────────────────────────────────────────┘',
                ]
            },

            'clear': {
                description: 'Flush the console frame view buffer',
                execute: (args, outputEl) => {
                    outputEl.innerHTML = '';
                    return null;
                }
            },

            'sysinfo': {
                description: 'Read core environment and UI metrics',
                execute: () => {
                    const theme  = document.body.classList.contains('dark') ? 'DARK' : 'LIGHT';
                    const glass  = !document.body.classList.contains('no-glass') ? 'ENABLED' : 'DISABLED';
                    const authMode = _isNoPass() ? 'NO-PASSWORD (auto-login)' : 'PASSWORD PROTECTED';
                    const _V = (typeof KOS_VERSION !== 'undefined') ? KOS_VERSION : null;
                    return [
                        '⚙  KOS SYSTEM CONFIG DIAGNOSTICS',
                        `   OS Name           : ${_V ? _V.displayProduct  : 'KOS Ultimate 2026 Edition'}`,
                        `   Version           : ${_V ? _V.version          : 'Alpha 9'}`,
                        `   Build             : ${_V ? _V.build            : '9.0.2026'}  [${_V ? _V.buildLabel : 'Alpha'}]`,
                        `   Released          : ${_V ? _V.releaseDate      : '—'}`,
                        `   Code Name         : ${_V ? (_V.codeName ?? '—') : '—'}`,
                        `   Visual Workspace  : ${theme} MODE`,
                        `   Compositor State  : GLASS ${glass}`,
                        `   Auth Mode         : ${authMode}`,
                        `   Execution Context : MAIN AREA / ROOT`,
                        `   Developer         : ${_V ? _V.developer        : 'Kalapurackal Studios'}`,
                    ];
                }
            },

            'tree': {
                description: 'Display visual tree map of all KOSFS IndexedDB records',
                execute: async (args, outputEl) => {
                    if (!window.KOSFS || typeof window.KOSFS.list !== 'function') {
                        return 'File System Error: KOSFS kernel module is unreachable.';
                    }
                    RootTerminal.logLine('Querying master IndexedDB space indexes…', 'system-msg');
                    try {
                        KOSFS.registerApp('terminal', ['*']);
                        const files = await KOSFS.list('terminal', {});
                        if (!files || files.length === 0) {
                            return '✨ KOSFS Storage empty. No files or media records discovered.';
                        }
                        const treeData = {
                            '📁 images': [], '📁 videos': [], '📁 audio': [],
                            '📁 documents': [], '📁 applications': [], '📁 unknown': [],
                        };
                        files.forEach(file => {
                            let bucket = '📁 unknown';
                            if (window.KOSFS.TYPES) {
                                const T = KOSFS.TYPES;
                                if (file.type === T.IMAGE)    bucket = '📁 images';
                                else if (file.type === T.VIDEO)    bucket = '📁 videos';
                                else if (file.type === T.AUDIO)    bucket = '📁 audio';
                                else if (file.type === T.DOCUMENT) bucket = '📁 documents';
                                else if (file.type === T.APP)      bucket = '📁 applications';
                            }
                            const sz  = KOSFS.formatSize ? KOSFS.formatSize(file.size) : `${(file.size / 1024).toFixed(1)} KB`;
                            const ext = file.mimeType ? file.mimeType.split('/').pop().toUpperCase() : 'RAW';
                            treeData[bucket].push(`📄 ${file.name}  [${ext} • ${sz}]`);
                        });
                        const lines = ['root/'];
                        const buckets = Object.keys(treeData);
                        buckets.forEach((b, bi) => {
                            if (!treeData[b].length) return;
                            const last = bi === buckets.length - 1;
                            lines.push(`${last ? '└── ' : '├── '}${b}`);
                            const prefix = last ? '    ' : '│   ';
                            treeData[b].forEach((f, fi) => {
                                lines.push(`${prefix}${fi === treeData[b].length - 1 ? '└── ' : '├── '}${f}`);
                            });
                        });
                        return lines;
                    } catch (err) {
                        return `Storage Core Read Exception: ${err.message}`;
                    }
                }
            },

            'systree': {
                description: 'Render the KOS source file tree from sys-manifest.js  (--kernel | --apps | --css | --docs | --stats)',
                execute: (args) => {
                    if (typeof KOS_SYS_MANIFEST === 'undefined') {
                        return [
                            'sys-manifest.js is not loaded.',
                            'Add this to index.html after kos-manifest.js:',
                            '  <script defer src="sys-manifest.js"></script>',
                        ];
                    }

                    const flag  = args[0]?.toLowerCase();
                    const files = KOS_SYS_MANIFEST.files;

                    const fmt = b => {
                        if (b >= 1048576) return (b / 1048576).toFixed(1).padStart(6) + ' MB';
                        if (b >= 1024)    return (b / 1024).toFixed(1).padStart(6)    + ' KB';
                        return String(b).padStart(6) + '  B';
                    };

                    const branch = (items, indent = '') => {
                        const out = [];
                        items.forEach((f, i) => {
                            const last   = i === items.length - 1;
                            const prefix = indent + (last ? '└── ' : '├── ');
                            const name   = f.path.split('/').pop();
                            const sz     = fmt(f.size);
                            const desc   = f.desc ? `  ${f.desc}` : '';
                            out.push(`${prefix}${name.padEnd(36)}${sz}${desc}`);
                        });
                        return out;
                    };

                    if (flag === '--stats') {
                        const groups = {
                            'Kernel files  (/)':      files.filter(f => f.cat === 'kernel'),
                            'Config files  (/)':      files.filter(f => f.cat === 'config'),
                            'App modules   (/apps/)': files.filter(f => f.cat === 'app'),
                            'Core CSS      (/css/)':  files.filter(f => f.cat === 'css'),
                            'App CSS  (/css/apps/)':  files.filter(f => f.cat === 'css-app'),
                            'Assets  (/documents/)':  files.filter(f => f.cat === 'asset'),
                            'Docs  (/)':              files.filter(f => f.cat === 'doc'),
                        };
                        const lines = [
                            `KOS ${KOS_SYS_MANIFEST.name}  v${KOS_SYS_MANIFEST.version}  — storage report`,
                            '─'.repeat(60),
                        ];
                        let grand = 0, grandN = 0;
                        Object.entries(groups).forEach(([label, grp]) => {
                            if (!grp.length) return;
                            const total = grp.reduce((s, f) => s + f.size, 0);
                            grand  += total;
                            grandN += grp.length;
                            lines.push(
                                `  ${label.padEnd(26)} ${String(grp.length).padStart(3)} files   ${fmt(total)}`
                            );
                        });
                        lines.push('─'.repeat(60));
                        lines.push(`  ${'TOTAL'.padEnd(26)} ${String(grandN).padStart(3)} files   ${fmt(grand)}`);
                        return lines;
                    }

                    const kernelFiles = files.filter(f => f.cat === 'kernel' || f.cat === 'config' || f.cat === 'doc');
                    const appFiles    = files.filter(f => f.cat === 'app');
                    const cssFiles    = files.filter(f => f.cat === 'css');
                    const cssAppFiles = files.filter(f => f.cat === 'css-app');
                    const assetFiles  = files.filter(f => f.cat === 'asset');

                    if (flag === '--kernel') {
                        return [
                            `kos-root/  [kernel + config layer]`,
                            ...branch(kernelFiles),
                            '',
                            `${kernelFiles.length} files  ·  ${fmt(kernelFiles.reduce((s,f)=>s+f.size,0))}`,
                        ];
                    }
                    if (flag === '--apps') {
                        return [
                            'kos-root/apps/',
                            ...branch(appFiles),
                            '',
                            `${appFiles.length} app modules  ·  ${fmt(appFiles.reduce((s,f)=>s+f.size,0))}`,
                        ];
                    }
                    if (flag === '--css') {
                        const lines = ['kos-root/css/'];
                        lines.push(...branch(cssFiles));
                        lines.push('    └── apps/');
                        cssAppFiles.forEach((f, i) => {
                            const last = i === cssAppFiles.length - 1;
                            const name = f.path.split('/').pop();
                            lines.push(`        ${last ? '└── ' : '├── '}${name.padEnd(32)}${fmt(f.size)}`);
                        });
                        const total = [...cssFiles, ...cssAppFiles].reduce((s,f)=>s+f.size,0);
                        lines.push('', `${cssFiles.length + cssAppFiles.length} stylesheets  ·  ${fmt(total)}`);
                        return lines;
                    }
                    if (flag === '--docs') {
                        return [
                            'kos-root/documents/  [static assets]',
                            ...branch(assetFiles),
                            '',
                            `${assetFiles.length} assets  ·  ${fmt(assetFiles.reduce((s,f)=>s+f.size,0))}`,
                        ];
                    }

                    const lines = [];
                    lines.push(`KOS ${KOS_SYS_MANIFEST.name}  —  Alpha ${KOS_SYS_MANIFEST.alpha}  (${KOS_SYS_MANIFEST.updated})`);
                    lines.push('═'.repeat(62));
                    lines.push('kos-root/');

                    kernelFiles.forEach((f, i) => {
                        const isLastKernel = i === kernelFiles.length - 1 && !appFiles.length && !cssFiles.length && !assetFiles.length;
                        const prefix = isLastKernel ? '└── ' : '├── ';
                        const name   = f.path.split('/').pop();
                        lines.push(`${prefix}${name.padEnd(38)}${fmt(f.size)}  ${f.desc || ''}`);
                    });

                    const appTotal = appFiles.reduce((s,f)=>s+f.size,0);
                    lines.push(`├── apps/  [${appFiles.length} modules · ${fmt(appTotal).trim()}]`);
                    appFiles.forEach((f, i) => {
                        const last = i === appFiles.length - 1;
                        const name = f.path.split('/').pop();
                        lines.push(`│   ${last?'└──':'├──'} ${name.padEnd(34)}${fmt(f.size)}  ${f.desc||''}`);
                    });

                    const cssTotal = [...cssFiles,...cssAppFiles].reduce((s,f)=>s+f.size,0);
                    lines.push(`├── css/  [${cssFiles.length + cssAppFiles.length} sheets · ${fmt(cssTotal).trim()}]`);
                    cssFiles.forEach((f, i) => {
                        const name = f.path.split('/').pop();
                        lines.push(`│   ├── ${name.padEnd(34)}${fmt(f.size)}  ${f.desc||''}`);
                    });
                    lines.push(`│   └── apps/  [${cssAppFiles.length} app stylesheets]`);
                    cssAppFiles.forEach((f, i) => {
                        const last = i === cssAppFiles.length - 1;
                        const name = f.path.split('/').pop();
                        lines.push(`│       ${last?'└──':'├──'} ${name.padEnd(30)}${fmt(f.size)}  ${f.desc||''}`);
                    });

                    const assetTotal = assetFiles.reduce((s,f)=>s+f.size,0);
                    lines.push(`└── documents/  [${assetFiles.length} assets · ${fmt(assetTotal).trim()}]`);
                    assetFiles.forEach((f, i) => {
                        const last = i === assetFiles.length - 1;
                        const name = f.path.split('/').pop();
                        lines.push(`    ${last?'└──':'├──'} ${name.padEnd(42)}${fmt(f.size)}  ${f.desc||''}`);
                    });

                    const grand = files.reduce((s,f) => s + f.size, 0);
                    lines.push('');
                    lines.push(`${files.length} files  ·  ${fmt(grand).trim()} total on disk`);
                    lines.push(`Use "systree --stats" for a breakdown by folder.`);

                    return lines;
                }
            },

            'theme': {
                description: 'Mutate global visual theme  (light | dark)',
                execute: (args) => {
                    const t = args[0]?.toLowerCase();
                    if (t !== 'light' && t !== 'dark') return 'Usage: theme light  |  theme dark';
                    const cur = document.body.classList.contains('dark') ? 'dark' : 'light';
                    if (cur !== t) typeof toggleTheme === 'function' && toggleTheme();
                    return `System theme → ${t.toUpperCase()}`;
                }
            },

            'glass': {
                description: 'Toggle liquid glass compositor  (on | off)',
                execute: (args) => {
                    const t = args[0]?.toLowerCase();
                    if (t !== 'on' && t !== 'off') return 'Usage: glass on  |  glass off';
                    const isOn = !document.body.classList.contains('no-glass');
                    if ((t === 'on') !== isOn) typeof toggleGlass === 'function' && toggleGlass();
                    return `Compositor liquid glass → ${t.toUpperCase()}`;
                }
            },

            'brightness': {
                description: 'Set panel brightness index (10 – 100)',
                execute: (args) => {
                    const v = parseInt(args[0], 10);
                    if (isNaN(v) || v < 10 || v > 100) return 'Error: value must be 10–100.';
                    /* setBrightness expects 10–100, not a 0–1 fraction */
                    window.KOSDisplay?.setBrightness(v);
                    return `Panel backlight → ${v}%`;
                }
            },

            'zoom': {
                description: 'Force layout zoom (50 – 250)',
                execute: (args) => {
                    const v = parseInt(args[0], 10);
                    if (isNaN(v) || v < 50 || v > 250) return 'Error: value must be 50–250.';
                    /* setZoom expects the percentage value directly (50–250) */
                    window.KOSDisplay?.setZoom(v);
                    return `Workspace display → ${v}%`;
                }
            },

            'textsize': {
                description: 'Step typography scale level (1 – 6)',
                execute: (args) => {
                    const v = parseInt(args[0], 10);
                    if (isNaN(v) || v < 1 || v > 6) return 'Error: steps 1–6.';
                    /* correct method name is setTextSize, not setFontSize */
                    window.KOSDisplay?.setTextSize(v);
                    return `Typography size index → ${v}`;
                }
            },

            'bold': {
                description: 'Enforce accessibility bold weights  (on | off)',
                execute: (args) => {
                    const t = args[0]?.toLowerCase();
                    if (t !== 'on' && t !== 'off') return 'Usage: bold on  |  bold off';
                    /* correct method name is setBold, not setBoldText */
                    window.KOSDisplay?.setBold(t === 'on');
                    return `Bold text → ${t.toUpperCase()}`;
                }
            },

            'displayreset': {
                description: 'Restore display settings to defaults',
                execute: () => {
                    /* correct method is reset(), not apply() */
                    window.KOSDisplay?.reset();
                    return 'Display configuration matrices returned to defaults.';
                }
            },

            'passwd': {
                description: 'Manage login credentials  (--nopass | --reset | status)',
                execute: async (args, outputEl) => {
                    const flag = args[0]?.toLowerCase();

                    if (flag === 'status') {
                        const mode = _isNoPass()
                            ? 'NO-PASSWORD  (auto-login enabled)'
                            : 'PASSWORD PROTECTED';
                        const custom = localStorage.getItem(KEY_PASSWORD)
                            ? 'Custom password is set.'
                            : `Default password is active  (${DEFAULT_PASS}).`;
                        return [
                            `Auth mode  : ${mode}`,
                            `Credential : ${custom}`,
                        ];
                    }

                    if (flag === '--reset') {
                        RootTerminal.logLine('Verify current password to reset auth:', 'system-msg');
                        RootTerminal._startInteractive({
                            maskInput : true,
                            prompt    : '[current password]',
                            onInput   : async (val) => {
                                if (!_verifyPass(val)) {
                                    RootTerminal.logLine('✗  Incorrect password. Reset aborted.', 'error-msg');
                                    RootTerminal._stopInteractive();
                                    return;
                                }
                                localStorage.removeItem(KEY_PASSWORD);
                                localStorage.removeItem(KEY_NO_PASSWORD);
                                RootTerminal.logLine(`✓  Password reset to default ("${DEFAULT_PASS}"). Login screen re-enabled.`, 'system-msg');
                                RootTerminal._stopInteractive();
                            }
                        });
                        return null;
                    }

                    if (flag === '--nopass') {
                        if (_isNoPass()) {
                            return 'Auto-login is already active. Use "passwd --reset" to re-enable the login screen.';
                        }
                        RootTerminal.logLine('Enter current password to enable auto-login:', 'system-msg');
                        RootTerminal._startInteractive({
                            maskInput : true,
                            prompt    : '[current password]',
                            onInput   : async (val) => {
                                if (!_verifyPass(val)) {
                                    RootTerminal.logLine('✗  Incorrect password. Operation aborted.', 'error-msg');
                                    RootTerminal._stopInteractive();
                                    return;
                                }
                                localStorage.setItem(KEY_NO_PASSWORD, 'true');
                                RootTerminal.logLine('✓  Auto-login enabled. Login screen will be skipped on next boot.', 'system-msg');
                                RootTerminal._stopInteractive();
                            }
                        });
                        return null;
                    }

                    const state = { current: null, next: null };
                    RootTerminal.logLine('Enter current password:', 'system-msg');
                    RootTerminal._startInteractive({
                        maskInput : true,
                        prompt    : '[current password]',
                        onInput   : async (val) => {
                            if (state.current === null) {
                                if (!_verifyPass(val)) {
                                    RootTerminal.logLine('✗  Incorrect password.', 'error-msg');
                                    RootTerminal._stopInteractive();
                                    return;
                                }
                                state.current = val;
                                RootTerminal.logLine('Enter new password:', 'system-msg');
                                return;
                            } else if (state.next === null) {
                                if (val.length < 4) {
                                    RootTerminal.logLine('✗  Password must be at least 4 characters. Try again:', 'error-msg');
                                    return;
                                }
                                state.next = val;
                                RootTerminal.logLine('Confirm new password:', 'system-msg');
                                return;
                            } else {
                                if (val !== state.next) {
                                    RootTerminal.logLine('✗  Passwords do not match. Operation aborted.', 'error-msg');
                                    RootTerminal._stopInteractive();
                                    return;
                                }
                                localStorage.setItem(KEY_PASSWORD, state.next);
                                localStorage.removeItem(KEY_NO_PASSWORD);
                                RootTerminal.logLine('✓  Password updated successfully. Changes take effect at next login.', 'system-msg');
                                RootTerminal._stopInteractive();
                            }
                        }
                    });
                    return null;
                }
            },

            /* ── USERNAME COMMAND ─────────────────────────────────
               Reads / writes the display username in IndexedDB.
               The KOSUser global is provided by kos-setup.js.
               If kos-setup.js is not loaded, falls back to direct IDB.
               ─────────────────────────────────────────────────────── */
            'username': {
                description: 'Manage display username  (status | set <name>)',
                execute: async (args) => {
                    const sub = (args[0] ?? '').toLowerCase();

                    /* ── Inline IDB helpers (work even without kos-setup.js) ── */
                    const _openUserDB = () => new Promise((res, rej) => {
                        const req = indexedDB.open('kos-userdata', 1);
                        req.onupgradeneeded = e => {
                            if (!e.target.result.objectStoreNames.contains('settings'))
                                e.target.result.createObjectStore('settings');
                        };
                        req.onsuccess = e => res(e.target.result);
                        req.onerror   = e => rej(e.target.error);
                    });

                    const _readUser = async () => {
                        const db  = await _openUserDB();
                        return new Promise(res => {
                            const req = db.transaction('settings','readonly')
                                          .objectStore('settings').get('username');
                            req.onsuccess = e => { db.close(); res(e.target.result || 'Developer'); };
                            req.onerror   = ()  => { db.close(); res('Developer'); };
                        });
                    };

                    const _writeUser = async name => {
                        const db  = await _openUserDB();
                        return new Promise((res, rej) => {
                            const req = db.transaction('settings','readwrite')
                                          .objectStore('settings').put(name, 'username');
                            req.onsuccess = () => { db.close(); res(); };
                            req.onerror   = e  => { db.close(); rej(e.target.error); };
                        });
                    };

                    /* ── status / bare call ── */
                    if (!sub || sub === 'status') {
                        const current = await _readUser();
                        return [
                            '  ┌─ USERNAME STATUS ────────────────────────────────┐',
                            `  │  Current username : ${current}`,
                            '  │  Stored in       : IndexedDB  kos-userdata',
                            '  │',
                            '  │  Usage: username set <your-name>',
                            '  └──────────────────────────────────────────────────┘',
                        ];
                    }

                    /* ── set ── */
                    if (sub === 'set') {
                        const newName = args.slice(1).join(' ').trim();
                        if (!newName)
                            return 'Usage: username set <your-name>';
                        if (newName.length < 2)
                            return '✗  Username must be at least 2 characters.';
                        if (newName.length > 30)
                            return '✗  Username must be 30 characters or fewer.';
                        if (!/^[a-zA-Z0-9 _.‑-]+$/.test(newName))
                            return '✗  Only letters, numbers, spaces, hyphens, dots and underscores allowed.';

                        try {
                            /* Prefer KOSUser (from kos-setup.js) — updates DOM automatically */
                            if (window.KOSUser && typeof KOSUser.setUsername === 'function') {
                                await KOSUser.setUsername(newName);
                            } else {
                                await _writeUser(newName);
                                /* Manual DOM update as fallback */
                                document.querySelectorAll('.login-username')
                                        .forEach(el => { el.textContent = newName; });
                                document.querySelectorAll('[data-kos-username]')
                                        .forEach(el => { el.textContent = newName; });
                            }
                            return [
                                `  ✓  Username updated to "${newName}"`,
                                '     Change is visible on the login screen immediately.',
                            ];
                        } catch (err) {
                            return `  ✗  Failed to save username: ${err.message}`;
                        }
                    }

                    return '  Usage: username  |  username status  |  username set <name>';
                }
            },

            'wallpaper': {
                description: 'Control the desktop wallpaper  (reset | list | set <name>)',
                execute: (args) => {
                    const sub = args[0]?.toLowerCase();

                    if (!sub || sub === 'reset') {
                        if (typeof selectWallpaper === 'function') {
                            selectWallpaper('default');
                        } else {
                            localStorage.removeItem('kos-wallpaper');
                            const el = document.getElementById('wallpaperEl');
                            if (el) el.style.background = '';
                        }
                        return '✓  Wallpaper reset to system default.';
                    }

                    if (sub === 'list') {
                        if (typeof STOCK_WALLPAPERS === 'undefined') {
                            return 'STOCK_WALLPAPERS table unavailable.';
                        }
                        return [
                            '  Available stock wallpapers:',
                            ...STOCK_WALLPAPERS.map((w, i) =>
                                `  ${String(i).padEnd(3)}  ${w.label}`
                            ),
                            '',
                            '  Usage: wallpaper set <name>  |  wallpaper set <index>',
                        ];
                    }

                    if (sub === 'set') {
                        const target = args[1];
                        if (!target) return 'Usage: wallpaper set <name>  or  wallpaper set <index>';

                        if (typeof STOCK_WALLPAPERS === 'undefined') {
                            return 'STOCK_WALLPAPERS table unavailable.';
                        }

                        const idx = parseInt(target, 10);
                        let key;
                        if (!isNaN(idx) && idx >= 0 && idx < STOCK_WALLPAPERS.length) {
                            key = idx === 0 ? 'default' : 'stock-' + idx;
                        } else {
                            const match = STOCK_WALLPAPERS.findIndex(
                                w => w.label.toLowerCase() === target.toLowerCase()
                            );
                            if (match === -1) {
                                return `Not found: "${target}". Run "wallpaper list" to see options.`;
                            }
                            key = match === 0 ? 'default' : 'stock-' + match;
                        }

                        if (typeof selectWallpaper === 'function') {
                            selectWallpaper(key);
                        } else {
                            localStorage.setItem('kos-wallpaper', key);
                            typeof applyWallpaper === 'function' && applyWallpaper(key);
                        }

                        const name = STOCK_WALLPAPERS[key === 'default' ? 0 : parseInt(key.split('-')[1])]?.label;
                        return `✓  Wallpaper set to "${name}".`;
                    }

                    return 'Usage: wallpaper reset | list | set <name>';
                }
            },

            'purge': {
                description: 'Erase KOSFS storage or factory-reset KOS  (--all | --photos | --videos | --audios | --documents)',
                execute: async (args, outputEl) => {
                    const flag = args[0]?.toLowerCase();

                    /* ── Usage ── */
                    const VALID_FLAGS = ['--all', '--photos', '--videos', '--audios', '--documents'];
                    if (!flag || !VALID_FLAGS.includes(flag)) {
                        return [
                            '  Usage:',
                            '  ┌───────────────────────────────────────────────────────────┐',
                            '  │  purge --all         FACTORY RESET — wipes everything     │',
                            '  │                      and returns to first-boot setup       │',
                            '  │  purge --photos      erase all image files                │',
                            '  │  purge --videos      erase all video files                │',
                            '  │  purge --audios      erase all audio files                │',
                            '  │  purge --documents   erase all document files             │',
                            '  └───────────────────────────────────────────────────────────┘',
                            '',
                            '  ⚠  All operations are IRREVERSIBLE and require your password.',
                        ];
                    }

                    if (!window.KOSFS) {
                        return '✗  KOSFS kernel module is unreachable. Purge aborted.';
                    }

                    /* ═══════════════════════════════════════════════════════════
                       FACTORY RESET  (--all)
                       Three-step confirmation: warning → type RESET → password
                       ═══════════════════════════════════════════════════════════ */
                    if (flag === '--all') {

                        RootTerminal.logLine('', '');
                        RootTerminal.logLine('  ╔══════════════════════════════════════════════════════╗', 'error-msg');
                        RootTerminal.logLine('  ║           ⚠  FACTORY RESET WARNING  ⚠               ║', 'error-msg');
                        RootTerminal.logLine('  ╠══════════════════════════════════════════════════════╣', 'error-msg');
                        RootTerminal.logLine('  ║  This will PERMANENTLY erase:                        ║', 'error-msg');
                        RootTerminal.logLine('  ║    • All files in KOSFS (photos, videos, docs…)      ║', 'error-msg');
                        RootTerminal.logLine('  ║    • Your username, password and login settings      ║', 'error-msg');
                        RootTerminal.logLine('  ║    • All appearance preferences (theme, wallpaper…)  ║', 'error-msg');
                        RootTerminal.logLine('  ║    • All app data stored in localStorage             ║', 'error-msg');
                        RootTerminal.logLine('  ║                                                      ║', 'error-msg');
                        RootTerminal.logLine('  ║  KOS will reload and show the first-boot setup       ║', 'error-msg');
                        RootTerminal.logLine('  ║  screen exactly as if installed fresh.               ║', 'error-msg');
                        RootTerminal.logLine('  ║                                                      ║', 'error-msg');
                        RootTerminal.logLine('  ║  THIS CANNOT BE UNDONE.                              ║', 'error-msg');
                        RootTerminal.logLine('  ╚══════════════════════════════════════════════════════╝', 'error-msg');
                        RootTerminal.logLine('', '');
                        RootTerminal.logLine('  Step 1 of 2 — Type  RESET  to confirm, or anything else to cancel:', 'system-msg');

                        RootTerminal._startInteractive({
                            maskInput : false,
                            prompt    : '[type RESET to confirm]',
                            onInput   : async (confirmWord) => {

                                /* ── Step 1: must type RESET exactly ── */
                                if (confirmWord.trim() !== 'RESET') {
                                    RootTerminal.logLine('  Cancelled — factory reset aborted.', 'system-msg');
                                    RootTerminal._stopInteractive();
                                    return;
                                }

                                RootTerminal.logLine('  Step 2 of 2 — Enter your KOS password to authorise:', 'system-msg');

                                /* ── Step 2: password ── */
                                RootTerminal._startInteractive({
                                    maskInput : true,
                                    prompt    : '[password]',
                                    onInput   : async (pw) => {
                                        if (!_verifyPass(pw)) {
                                            RootTerminal.logLine('  ✗  Incorrect password. Factory reset aborted.', 'error-msg');
                                            RootTerminal._stopInteractive();
                                            return;
                                        }

                                        RootTerminal._stopInteractive();
                                        RootTerminal.logLine('', '');
                                        RootTerminal.logLine('  ✓  Authorised. Beginning factory reset…', 'system-msg');

                                        /* ── 1. Wipe KOSFS files ── */
                                        try {
                                            KOSFS.registerApp('terminal', ['*']);
                                            await KOSFS.ready;
                                            const files = await KOSFS.list('terminal', {});
                                            let del = 0;
                                            for (const f of files) {
                                                try { await KOSFS.delete('terminal', f.id); del++; }
                                                catch (_) {}
                                            }
                                            RootTerminal.logLine(`  ⚙  KOSFS: ${del} file${del !== 1 ? 's' : ''} erased.`, 'system-msg');
                                        } catch (e) {
                                            RootTerminal.logLine(`  ⚠  KOSFS wipe partial: ${e.message}`, 'error-msg');
                                        }

                                        /* ── 2. Wipe kos-userdata IDB (username store) ── */
                                        await new Promise(res => {
                                            try {
                                                const req = indexedDB.deleteDatabase('kos-userdata');
                                                req.onsuccess = res;
                                                req.onerror   = res;
                                                req.onblocked = res;
                                            } catch (_) { res(); }
                                        });
                                        RootTerminal.logLine('  ⚙  kos-userdata: cleared.', 'system-msg');

                                        /* ── 3. Wipe KOS localStorage keys ── */
                                        const KOS_LS_KEYS = [
                                            'kos-theme', 'kos-glass', 'kos-wallpaper',
                                            'kos-avatar', 'kos-icon-palette',
                                            'kos-password', 'kos_login_password',
                                            'kos-no-password',
                                            'kos_setup_complete',
                                            'kos_first_boot_complete',
                                            'kos-fs-v1-migrated',
                                            'kos-display-zoom', 'kos-display-text',
                                            'kos-display-bold', 'kos-display-brightness',
                                            'kos-studio-apps', 'kos-session',
                                            'kos-wallpaper-custom',
                                        ];
                                        let lsCleared = 0;
                                        for (const k of KOS_LS_KEYS) {
                                            if (localStorage.getItem(k) !== null) {
                                                localStorage.removeItem(k);
                                                lsCleared++;
                                            }
                                        }
                                        /* Also sweep any remaining kos- prefixed keys */
                                        const extra = Object.keys(localStorage)
                                            .filter(k => k.startsWith('kos'));
                                        for (const k of extra) {
                                            localStorage.removeItem(k);
                                            lsCleared++;
                                        }
                                        RootTerminal.logLine(`  ⚙  localStorage: ${lsCleared} key${lsCleared !== 1 ? 's' : ''} removed.`, 'system-msg');

                                        /* ── 4. Dispatch so live modules can clean up ── */
                                        KOSBus?.dispatch('kos:factory-reset', { initiatedBy: 'terminal' });

                                        /* ── 5. Countdown and reload ── */
                                        RootTerminal.logLine('', '');
                                        RootTerminal.logLine('  ✓  Factory reset complete.', 'system-msg');
                                        RootTerminal.logLine('  ↻  Reloading in 3…', 'system-msg');

                                        let t = 2;
                                        const tick = setInterval(() => {
                                            RootTerminal.logLine(`  ↻  Reloading in ${t}…`, 'system-msg');
                                            if (t-- <= 0) {
                                                clearInterval(tick);
                                                location.reload();
                                            }
                                        }, 1000);
                                    }
                                });
                            }
                        });

                        return null;
                    }

                    /* ═══════════════════════════════════════════════════════════
                       PARTIAL FILE PURGE  (--photos | --videos | --audios | --documents)
                       Single-step: password only.
                       ═══════════════════════════════════════════════════════════ */
                    const flagTypeMap = {
                        '--photos'   : KOSFS.TYPES?.IMAGE    || 'image',
                        '--videos'   : KOSFS.TYPES?.VIDEO    || 'video',
                        '--audios'   : KOSFS.TYPES?.AUDIO    || 'audio',
                        '--documents': KOSFS.TYPES?.DOCUMENT || 'document',
                    };
                    const targetType = flagTypeMap[flag];
                    const label      = flag.replace('--', '').toUpperCase();

                    RootTerminal.logLine(`  ⚠  About to permanently erase all ${label}. This cannot be undone.`, 'error-msg');
                    RootTerminal.logLine('     Enter your password to confirm:', 'system-msg');

                    RootTerminal._startInteractive({
                        maskInput : true,
                        prompt    : '[password to confirm]',
                        onInput   : async (pw) => {
                            if (!_verifyPass(pw)) {
                                RootTerminal.logLine('  ✗  Incorrect password. Purge aborted.', 'error-msg');
                                RootTerminal._stopInteractive();
                                return;
                            }

                            RootTerminal._stopInteractive();
                            RootTerminal.logLine(`  ⚙  Erasing ${label}…`, 'system-msg');

                            try {
                                KOSFS.registerApp('terminal', ['*']);
                                await KOSFS.ready;

                                const files = await KOSFS.list('terminal', { type: targetType });

                                if (files.length === 0) {
                                    RootTerminal.logLine(`  ✓  Nothing to erase — no ${label} found in storage.`, 'system-msg');
                                    return;
                                }

                                let deleted = 0, failed = 0;
                                for (const file of files) {
                                    try   { await KOSFS.delete('terminal', file.id); deleted++; }
                                    catch { failed++; }
                                }

                                RootTerminal.logLine(
                                    `  ✓  Purge complete: ${deleted} ${label.toLowerCase()} file${deleted !== 1 ? 's' : ''} erased` +
                                    (failed ? ` (${failed} could not be removed).` : '.'),
                                    'system-msg'
                                );

                                KOSBus?.dispatch('kos:fs-delete', { deletedBy: 'terminal', bulk: true, type: targetType });

                            } catch (err) {
                                RootTerminal.logLine(`  ✗  Purge error: ${err.message}`, 'error-msg');
                            }
                        }
                    });

                    return null;
                }
            },

            'exit': {
                description: 'Close the terminal window',
                execute: () => {
                    window.WM?.close(appId);
                    return 'Stopping terminal UI task thread…';
                }
            },
        },

        _startInteractive(opts) {
            this._interactive = opts;
            const input = document.getElementById('term-input-field');
            const label = document.querySelector('.term-prompt');
            if (input) input.type = opts.maskInput ? 'password' : 'text';
            if (label) label.textContent = opts.prompt + ' ›';
        },

        _stopInteractive() {
            this._interactive = null;
            const input = document.getElementById('term-input-field');
            const label = document.querySelector('.term-prompt');
            if (input) { input.type = 'text'; input.value = ''; }
            if (label)   label.textContent = 'system@kos:#';
        },

        init() {
            const body = document.getElementById('terminal-body');
            if (!body) return;

            body.innerHTML = `
                <div class="term-container">
                    <div class="term-output" id="term-output-area">
                        <div class="term-line system-msg">╔══ KOS SYSTEM CONSOLE ══════════════════════════╗</div>
                        <div class="term-line system-msg">║  Type "help" for a list of available commands. ║</div>
                        <div class="term-line system-msg">╚════════════════════════════════════════════════╝</div>
                    </div>
                    <div class="term-input-line">
                        <span class="term-prompt">system@kos:#</span>
                        <input type="text" class="term-raw-input" id="term-input-field"
                               autocomplete="off" spellcheck="false" autofocus>
                    </div>
                </div>
            `;

            const inputField = document.getElementById('term-input-field');
            const outputArea = document.getElementById('term-output-area');
            const container  = body.querySelector('.term-container');

            container.addEventListener('click', () => inputField.focus());

            inputField.addEventListener('keydown', async (e) => {

                if (e.key === 'ArrowUp' && !this._interactive) {
                    e.preventDefault();
                    if (this.historyIndex > 0) {
                        this.historyIndex--;
                        inputField.value = this.history[this.historyIndex];
                    }
                    return;
                }
                if (e.key === 'ArrowDown' && !this._interactive) {
                    e.preventDefault();
                    if (this.historyIndex < this.history.length - 1) {
                        this.historyIndex++;
                        inputField.value = this.history[this.historyIndex];
                    } else {
                        this.historyIndex = this.history.length;
                        inputField.value  = '';
                    }
                    return;
                }

                if (e.key !== 'Enter') return;

                const rawValue = inputField.value.trim();
                inputField.value = '';

                if (this._interactive) {
                    this.logLine(`${this._interactive.prompt} › ${'•'.repeat(rawValue.length || 1)}`, 'user-cmd');
                    try {
                        await this._interactive.onInput(rawValue);
                    } catch (err) {
                        this.logLine(`RUNTIME ERROR: ${err.message}`, 'error-msg');
                        this._stopInteractive();
                    }
                    container.scrollTop = container.scrollHeight;
                    return;
                }

                if (!rawValue) return;
                this.history.push(rawValue);
                this.historyIndex = this.history.length;
                this.logLine(`system@kos:# ${rawValue}`, 'user-cmd');
                await this.processCommand(rawValue, outputArea);
                container.scrollTop = container.scrollHeight;
            });
        },

        async processCommand(rawInput, outputArea) {
            const parts   = rawInput.trim().split(/\s+/);
            const cmdName = parts[0].toLowerCase();
            const args    = parts.slice(1);

            if (!this.commands[cmdName]) {
                this.logLine(`sys-err: unknown utility target: "${cmdName}"  — try "help"`, 'error-msg');
                return;
            }

            try {
                const result = await this.commands[cmdName].execute(args, outputArea);
                if (result === null) return;
                if (Array.isArray(result)) {
                    result.forEach(line => this.logLine(line));
                } else if (result !== undefined) {
                    this.logLine(result);
                }
                try { window.KOSApps?.uimanager?._syncThemeToggles?.(); } catch (_) {}
            } catch (err) {
                this.logLine(`RUNTIME ERROR: ${err.message}`, 'error-msg');
            }
        },

        logLine(text, className = '') {
            const outputArea = document.getElementById('term-output-area');
            if (!outputArea) return;
            const div = document.createElement('div');
            div.className = `term-line ${className}`.trim();
            div.textContent = text;
            outputArea.appendChild(div);

            const container = outputArea.closest('.term-container');
            if (container) container.scrollTop = container.scrollHeight;
        },
    };

    window.KOSApps = window.KOSApps || {};
    window.KOSApps[appId] = { init: () => RootTerminal.init() };

    if (window.WM && typeof window.WM.setOnOpen === 'function') {
        window.WM.setOnOpen(appId, () => RootTerminal.init());
    }

})();
