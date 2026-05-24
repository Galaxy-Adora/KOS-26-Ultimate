/**
 * KOS Ultimate 2026 — Core System Utility
 * Module: Root System Terminal CLI
 * Location: /terminal.js (Root Directory)
 *
 * New in Alpha 9:
 *   passwd          — change / reset / disable the login password
 *   wallpaper       — reset or switch the desktop wallpaper
 *   purge           — securely wipe KOSFS storage (password-gated)
 *   Interactive prompt system — mid-session masked input for credentials
 */

(function () {
    const appId = 'terminal';

    /* ═══════════════════════════════════════════════════════════
       §1  STORAGE KEYS  (must match kos-kernel.js)
    ═══════════════════════════════════════════════════════════ */
    const KEY_PASSWORD    = 'kos-password';       // custom password override
    const KEY_NO_PASSWORD = 'kos-no-password';    // 'true' → skip login screen
    const DEFAULT_PASS    = 'kosul';

    /* ═══════════════════════════════════════════════════════════
       §2  HELPERS
    ═══════════════════════════════════════════════════════════ */

    /** Returns the current active password (custom or default). */
    function _getPass() {
        return localStorage.getItem(KEY_PASSWORD) || DEFAULT_PASS;
    }

    /** Returns true if password-less login is enabled. */
    function _isNoPass() {
        return localStorage.getItem(KEY_NO_PASSWORD) === 'true';
    }

    /** Verify a supplied string against the current password. */
    function _verifyPass(input) {
        return input === _getPass();
    }

    /* ═══════════════════════════════════════════════════════════
       §3  TERMINAL STATE
    ═══════════════════════════════════════════════════════════ */

    const RootTerminal = {
        history      : [],
        historyIndex : -1,

        /**
         * Interactive mode — when set, every Enter keypress routes here
         * instead of processCommand(). Cleared by the handler itself.
         *
         * Shape:
         *   {
         *     maskInput : boolean,          // hides typed chars
         *     prompt    : string,           // prompt label shown to user
         *     onInput   : async fn(value)   // called with each line
         *   }
         */
        _interactive : null,

        /* ═══════════════════════════════════════════════════════
           §4  COMMANDS
        ═══════════════════════════════════════════════════════ */
        commands: {

            /* ── help ─────────────────────────────────────────── */
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

            /* ── clear ────────────────────────────────────────── */
            'clear': {
                description: 'Flush the console frame view buffer',
                execute: (args, outputEl) => {
                    outputEl.innerHTML = '';
                    return null;
                }
            },

            /* ── sysinfo ──────────────────────────────────────── */
            'sysinfo': {
                description: 'Read core environment and UI metrics',
                execute: () => {
                    const theme  = document.body.classList.contains('dark') ? 'DARK' : 'LIGHT';
                    const glass  = !document.body.classList.contains('no-glass') ? 'ENABLED' : 'DISABLED';
                    const authMode = _isNoPass() ? 'NO-PASSWORD (auto-login)' : 'PASSWORD PROTECTED';
                    return [
                        '⚙  KOS SYSTEM CONFIG DIAGNOSTICS',
                        `   Subsystem Version : 9.0.2026-ROOT_UTILITY`,
                        `   Visual Workspace  : ${theme} MODE`,
                        `   Compositor State  : GLASS ${glass}`,
                        `   Auth Mode         : ${authMode}`,
                        `   Execution Context : MAIN AREA / ROOT`,
                    ];
                }
            },

            /* ── tree ─────────────────────────────────────────── */
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

            /* ══════════════════════════════════════════════════
               NEW:  systree
               Renders the KOS project's actual source file tree
               from KOS_SYS_MANIFEST (sys-manifest.js).
               This shows YOUR CODE files — not KOSFS user data.

               Usage:
                 systree              full project tree
                 systree --kernel     root kernel files only
                 systree --apps       /apps/ folder only
                 systree --css        /css/ folder only
                 systree --docs       /documents/ assets only
                 systree --stats      file counts + sizes by folder
            ══════════════════════════════════════════════════ */
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

                    /* ── helper: format bytes ── */
                    const fmt = b => {
                        if (b >= 1048576) return (b / 1048576).toFixed(1).padStart(6) + ' MB';
                        if (b >= 1024)    return (b / 1024).toFixed(1).padStart(6)    + ' KB';
                        return String(b).padStart(6) + '  B';
                    };

                    /* ── helper: render a flat list as a tree branch ── */
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

                    /* ── --stats ── */
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

                    /* ── filter helpers ── */
                    const kernelFiles = files.filter(f => f.cat === 'kernel' || f.cat === 'config' || f.cat === 'doc');
                    const appFiles    = files.filter(f => f.cat === 'app');
                    const cssFiles    = files.filter(f => f.cat === 'css');
                    const cssAppFiles = files.filter(f => f.cat === 'css-app');
                    const assetFiles  = files.filter(f => f.cat === 'asset');

                    /* ── single-folder flags ── */
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

                    /* ── full tree (default) ── */
                    const lines = [];
                    lines.push(`KOS ${KOS_SYS_MANIFEST.name}  —  Alpha ${KOS_SYS_MANIFEST.alpha}  (${KOS_SYS_MANIFEST.updated})`);
                    lines.push('═'.repeat(62));
                    lines.push('kos-root/');

                    /* kernel / root files */
                    kernelFiles.forEach((f, i) => {
                        const isLastKernel = i === kernelFiles.length - 1 && !appFiles.length && !cssFiles.length && !assetFiles.length;
                        const prefix = isLastKernel ? '└── ' : '├── ';
                        const name   = f.path.split('/').pop();
                        lines.push(`${prefix}${name.padEnd(38)}${fmt(f.size)}  ${f.desc || ''}`);
                    });

                    /* apps/ */
                    const appTotal = appFiles.reduce((s,f)=>s+f.size,0);
                    lines.push(`├── apps/  [${appFiles.length} modules · ${fmt(appTotal).trim()}]`);
                    appFiles.forEach((f, i) => {
                        const last = i === appFiles.length - 1;
                        const name = f.path.split('/').pop();
                        lines.push(`│   ${last?'└──':'├──'} ${name.padEnd(34)}${fmt(f.size)}  ${f.desc||''}`);
                    });

                    /* css/ */
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

                    /* documents/ */
                    const assetTotal = assetFiles.reduce((s,f)=>s+f.size,0);
                    lines.push(`└── documents/  [${assetFiles.length} assets · ${fmt(assetTotal).trim()}]`);
                    assetFiles.forEach((f, i) => {
                        const last = i === assetFiles.length - 1;
                        const name = f.path.split('/').pop();
                        lines.push(`    ${last?'└──':'├──'} ${name.padEnd(42)}${fmt(f.size)}  ${f.desc||''}`);
                    });

                    /* summary */
                    const grand = files.reduce((s,f) => s + f.size, 0);
                    lines.push('');
                    lines.push(`${files.length} files  ·  ${fmt(grand).trim()} total on disk`);
                    lines.push(`Use "systree --stats" for a breakdown by folder.`);

                    return lines;
                }
            },

            /* ── theme ────────────────────────────────────────── */
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

            /* ── glass ────────────────────────────────────────── */
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

            /* ── brightness ───────────────────────────────────── */
            'brightness': {
                description: 'Set panel brightness index (10 – 100)',
                execute: (args) => {
                    const v = parseInt(args[0], 10);
                    if (isNaN(v) || v < 10 || v > 100) return 'Error: value must be 10–100.';
                    window.KOSDisplay?.setBrightness(v / 100);
                    return `Panel backlight → ${v}%`;
                }
            },

            /* ── zoom ─────────────────────────────────────────── */
            'zoom': {
                description: 'Force layout zoom (50 – 250)',
                execute: (args) => {
                    const v = parseInt(args[0], 10);
                    if (isNaN(v) || v < 50 || v > 250) return 'Error: value must be 50–250.';
                    window.KOSDisplay?.setZoom(v / 100);
                    return `Workspace display → ${v}%`;
                }
            },

            /* ── textsize ─────────────────────────────────────── */
            'textsize': {
                description: 'Step typography scale level (1 – 6)',
                execute: (args) => {
                    const v = parseInt(args[0], 10);
                    if (isNaN(v) || v < 1 || v > 6) return 'Error: steps 1–6.';
                    window.KOSDisplay?.setFontSize(v);
                    return `Typography size index → ${v}`;
                }
            },

            /* ── bold ─────────────────────────────────────────── */
            'bold': {
                description: 'Enforce accessibility bold weights  (on | off)',
                execute: (args) => {
                    const t = args[0]?.toLowerCase();
                    if (t !== 'on' && t !== 'off') return 'Usage: bold on  |  bold off';
                    window.KOSDisplay?.setBoldText(t === 'on');
                    return `Bold text → ${t.toUpperCase()}`;
                }
            },

            /* ── displayreset ─────────────────────────────────── */
            'displayreset': {
                description: 'Restore display settings to defaults',
                execute: () => {
                    window.KOSDisplay?.apply?.();
                    return 'Display configuration matrices returned to defaults.';
                }
            },

            /* ══════════════════════════════════════════════════
               NEW:  passwd
               Change / disable / reset the login password.

               Usage:
                 passwd              → interactive 3-step change
                 passwd --nopass     → disable login screen (auto-login)
                 passwd --reset      → restore default password 'kosul'
                 passwd status       → show current auth mode
            ══════════════════════════════════════════════════ */
            'passwd': {
                description: 'Manage login credentials  (--nopass | --reset | status)',
                execute: async (args, outputEl) => {
                    const flag = args[0]?.toLowerCase();

                    /* ── status ── */
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

                    /* ── --reset  (restore default, re-enable login) ── */
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

                    /* ── --nopass  (skip login screen) ── */
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

                    /* ── default: 3-step interactive password change ── */
                    const state = { current: null, next: null };
                    RootTerminal.logLine('Enter current password:', 'system-msg');
                    RootTerminal._startInteractive({
                        maskInput : true,
                        prompt    : '[current password]',
                        onInput   : async (val) => {
                            if (state.current === null) {
                                /* Step 1 — verify current */
                                if (!_verifyPass(val)) {
                                    RootTerminal.logLine('✗  Incorrect password.', 'error-msg');
                                    RootTerminal._stopInteractive();
                                    return;
                                }
                                state.current = val;
                                RootTerminal.logLine('Enter new password:', 'system-msg');
                                return; // stay in interactive, await next input

                            } else if (state.next === null) {
                                /* Step 2 — capture new password */
                                if (val.length < 4) {
                                    RootTerminal.logLine('✗  Password must be at least 4 characters. Try again:', 'error-msg');
                                    return;
                                }
                                state.next = val;
                                RootTerminal.logLine('Confirm new password:', 'system-msg');
                                return;

                            } else {
                                /* Step 3 — confirm */
                                if (val !== state.next) {
                                    RootTerminal.logLine('✗  Passwords do not match. Operation aborted.', 'error-msg');
                                    RootTerminal._stopInteractive();
                                    return;
                                }
                                localStorage.setItem(KEY_PASSWORD, state.next);
                                // Re-enable password login if it was disabled
                                localStorage.removeItem(KEY_NO_PASSWORD);
                                RootTerminal.logLine('✓  Password updated successfully. Changes take effect at next login.', 'system-msg');
                                RootTerminal._stopInteractive();
                            }
                        }
                    });
                    return null;
                }
            },

            /* ══════════════════════════════════════════════════
               NEW:  wallpaper
               Reset or switch the desktop wallpaper.

               Usage:
                 wallpaper reset            → restore default wallpaper
                 wallpaper list             → show available stock wallpapers
                 wallpaper set <name|index> → apply a stock wallpaper by name
            ══════════════════════════════════════════════════ */
            'wallpaper': {
                description: 'Control the desktop wallpaper  (reset | list | set <name>)',
                execute: (args) => {
                    const sub = args[0]?.toLowerCase();

                    /* ── reset ── */
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

                    /* ── list ── */
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

                    /* ── set <name | index> ── */
                    if (sub === 'set') {
                        const target = args[1];
                        if (!target) return 'Usage: wallpaper set <name>  or  wallpaper set <index>';

                        if (typeof STOCK_WALLPAPERS === 'undefined') {
                            return 'STOCK_WALLPAPERS table unavailable.';
                        }

                        // Try as numeric index first
                        const idx = parseInt(target, 10);
                        let key;
                        if (!isNaN(idx) && idx >= 0 && idx < STOCK_WALLPAPERS.length) {
                            key = idx === 0 ? 'default' : 'stock-' + idx;
                        } else {
                            // Try as name (case-insensitive)
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

            /* ══════════════════════════════════════════════════
               NEW:  purge
               Securely delete KOSFS storage. Password required.
               This operation is IRREVERSIBLE.

               Usage:
                 purge --all          → wipe ALL file types
                 purge --photos       → wipe images only
                 purge --videos       → wipe videos only
                 purge --audios       → wipe audio files only
                 purge --documents    → wipe documents only
            ══════════════════════════════════════════════════ */
            'purge': {
                description: 'Securely erase KOSFS storage — IRREVERSIBLE  (requires password)',
                execute: async (args, outputEl) => {
                    const flag = args[0]?.toLowerCase();

                    const VALID_FLAGS = ['--all', '--photos', '--videos', '--audios', '--documents'];
                    if (!flag || !VALID_FLAGS.includes(flag)) {
                        return [
                            'Usage:',
                            '  purge --all         erase everything',
                            '  purge --photos      erase images',
                            '  purge --videos      erase videos',
                            '  purge --audios      erase audio files',
                            '  purge --documents   erase documents',
                            '',
                            '⚠  This operation is IRREVERSIBLE and requires your password.',
                        ];
                    }

                    if (!window.KOSFS) {
                        return 'KOSFS kernel module is unreachable. Purge aborted.';
                    }

                    // Map flag → KOSFS type constant (null = all)
                    const flagTypeMap = {
                        '--photos'   : 'image',
                        '--videos'   : 'video',
                        '--audios'   : 'audio',
                        '--documents': 'document',
                        '--all'      : null,
                    };
                    const targetType = flagTypeMap[flag];
                    const label = flag === '--all' ? 'ALL FILES' : flag.replace('--', '').toUpperCase();

                    RootTerminal.logLine(`⚠  You are about to permanently erase: ${label}`, 'error-msg');
                    RootTerminal.logLine('   This cannot be undone. Enter your password to confirm:', 'system-msg');

                    RootTerminal._startInteractive({
                        maskInput : true,
                        prompt    : '[password to confirm purge]',
                        onInput   : async (val) => {
                            if (!_verifyPass(val)) {
                                RootTerminal.logLine('✗  Incorrect password. Purge aborted.', 'error-msg');
                                RootTerminal._stopInteractive();
                                return;
                            }

                            RootTerminal._stopInteractive();
                            RootTerminal.logLine('⚙  Purge authorised. Beginning erasure…', 'system-msg');

                            try {
                                KOSFS.registerApp('terminal', ['*']);
                                await KOSFS.ready;

                                const filter = targetType ? { type: targetType } : {};
                                const files  = await KOSFS.list('terminal', filter);

                                if (files.length === 0) {
                                    RootTerminal.logLine('  Nothing to erase — storage was already empty.', 'system-msg');
                                    return;
                                }

                                let deleted = 0, failed = 0;
                                for (const file of files) {
                                    try {
                                        await KOSFS.delete('terminal', file.id);
                                        deleted++;
                                    } catch {
                                        failed++;
                                    }
                                }

                                RootTerminal.logLine(
                                    `✓  Purge complete: ${deleted} file${deleted !== 1 ? 's' : ''} erased` +
                                    (failed ? `, ${failed} could not be removed.` : '.'),
                                    'system-msg'
                                );

                                // Notify other open apps so they refresh
                                KOSBus?.dispatch('kos:fs-delete', { deletedBy: 'terminal', bulk: true });

                            } catch (err) {
                                RootTerminal.logLine(`  Purge error: ${err.message}`, 'error-msg');
                            }
                        }
                    });

                    return null;
                }
            },

            /* ── exit ─────────────────────────────────────────── */
            'exit': {
                description: 'Close the terminal window',
                execute: () => {
                    window.WM?.close(appId);
                    return 'Stopping terminal UI task thread…';
                }
            },
        },

        /* ═══════════════════════════════════════════════════════
           §5  INTERACTIVE PROMPT SYSTEM
           Used by passwd and purge to collect masked input
           mid-session without a separate dialog.
        ═══════════════════════════════════════════════════════ */

        /**
         * Begin an interactive multi-step input session.
         * While active, Enter sends input to opts.onInput instead of
         * processCommand(). Typing is optionally masked (passwords).
         *
         * @param {{ maskInput: boolean, prompt: string, onInput: function }} opts
         */
        _startInteractive(opts) {
            this._interactive = opts;
            const input = document.getElementById('term-input-field');
            const label = document.querySelector('.term-prompt');
            if (input) input.type = opts.maskInput ? 'password' : 'text';
            if (label) label.textContent = opts.prompt + ' ›';
        },

        /** End the interactive session and restore normal terminal state. */
        _stopInteractive() {
            this._interactive = null;
            const input = document.getElementById('term-input-field');
            const label = document.querySelector('.term-prompt');
            if (input) { input.type = 'text'; input.value = ''; }
            if (label)   label.textContent = 'system@kos:#';
        },

        /* ═══════════════════════════════════════════════════════
           §6  INIT
        ═══════════════════════════════════════════════════════ */

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

                /* ── Arrow history (only in normal mode) ── */
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

                /* ── Interactive (password) mode ── */
                if (this._interactive) {
                    // Log masked echo so the user sees their action
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

                /* ── Normal command mode ── */
                if (!rawValue) return;
                this.history.push(rawValue);
                this.historyIndex = this.history.length;
                this.logLine(`system@kos:# ${rawValue}`, 'user-cmd');
                await this.processCommand(rawValue, outputArea);
                container.scrollTop = container.scrollHeight;
            });
        },

        /* ═══════════════════════════════════════════════════════
           §7  COMMAND PROCESSOR
        ═══════════════════════════════════════════════════════ */

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
                // Sync any UI toggles in Settings that may have changed
                try { window.KOSApps?.uimanager?._syncThemeToggles?.(); } catch (_) {}
            } catch (err) {
                this.logLine(`RUNTIME ERROR: ${err.message}`, 'error-msg');
            }
        },

        /* ═══════════════════════════════════════════════════════
           §8  LOG HELPER
        ═══════════════════════════════════════════════════════ */

        logLine(text, className = '') {
            const outputArea = document.getElementById('term-output-area');
            if (!outputArea) return;
            const div = document.createElement('div');
            div.className = `term-line ${className}`.trim();
            div.textContent = text;
            outputArea.appendChild(div);

            // Auto-scroll
            const container = outputArea.closest('.term-container');
            if (container) container.scrollTop = container.scrollHeight;
        },
    };

    /* ═══════════════════════════════════════════════════════════
       §9  WM REGISTRATION
    ═══════════════════════════════════════════════════════════ */

    window.KOSApps = window.KOSApps || {};
    window.KOSApps[appId] = { init: () => RootTerminal.init() };

    if (window.WM && typeof window.WM.setOnOpen === 'function') {
        window.WM.setOnOpen(appId, () => RootTerminal.init());
    }

})();
