/**
 * KOS Ultimate 2026 — Core System Utility
 * Module: Root System Terminal CLI
 * Location: /terminal.js (Root Directory)
 */

(function () {
    const appId = 'terminal';

    const RootTerminal = {
        history: [],
        historyIndex: -1,

        commands: {
            'help': {
                description: 'List all available environment utilities',
                execute: () => [
                    'System CLI Commands:',
                    ...Object.keys(RootTerminal.commands).map(cmd => `  ${cmd.padEnd(14)} - ${RootTerminal.commands[cmd].description}`)
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
                    const zoom = localStorage.getItem('kos_zoom') || '100';
                    const theme = document.body.classList.contains('dark') ? 'DARK' : 'LIGHT';
                    const glass = !document.body.classList.contains('no-glass') ? 'ENABLED' : 'DISABLED';
                    return [
                        '⚙️ KOS SYSTEM CONFIG DIAGNOSTICS',
                        `Subsystem Version : 8.0.2026-ROOT_UTILITY`,
                        `Visual Workspace  : ${theme} MODE`,
                        `Compositor State  : GLASS ${glass}`,
                        `Viewport Scale    : ${zoom}%`,
                        `Execution Context : MAIN AREA / ROOT`
                    ];
                }
            },
            'tree': {
                description: 'Display an interactive visual tree map of all system IndexedDB records',
                execute: async (args, outputEl) => {
                    // Safety check to ensure the file system core layer is up and running
                    if (!window.KOSFS || typeof window.KOSFS.list !== 'function') {
                        return 'File System Error: The KOSFS kernel filesystem module is currently unreachable.';
                    }

                    RootTerminal.logLine('Querying master IndexedDB space indexes...', 'system-msg');
                    
                    try {
                        // Pass an empty string or 'system' to scan all records across the database context
                        const files = await window.KOSFS.list('', {});
                        
                        if (!files || files.length === 0) {
                            return '✨ KOSFS Storage empty. No files or media records discovered.';
                        }

                        // Initialize the virtual directory tree schema map
                        const treeData = {
                            '📁 images': [],
                            '📁 videos': [],
                            '📁 audio': [],
                            '📁 documents': [],
                            '📁 applications': [],
                            '📁 unknown': []
                        };

                        // Map across objects and catalog types leveraging KOSFS native type constants
                        files.forEach(file => {
                            let typeBucket = '📁 unknown';
                            
                            if (window.KOSFS.TYPES) {
                                switch (file.type) {
                                    case window.KOSFS.TYPES.IMAGE:       typeBucket = '📁 images'; break;
                                    case window.KOSFS.TYPES.VIDEO:       typeBucket = '📁 videos'; break;
                                    case window.KOSFS.TYPES.AUDIO:       typeBucket = '📁 audio'; break;
                                    case window.KOSFS.TYPES.DOCUMENT:    typeBucket = '📁 documents'; break;
                                    case window.KOSFS.TYPES.APP:         typeBucket = '📁 applications'; break;
                                }
                            }

                            // Humanize size metrics using native helper if available
                            const sizeText = (window.KOSFS.formatSize) ? window.KOSFS.formatSize(file.size) : `${(file.size / 1024).toFixed(1)} KB`;
                            const fileExtension = file.mimeType ? file.mimeType.split('/').pop().toUpperCase() : 'RAW';
                            
                            treeData[typeBucket].push(`📄 ${file.name} [${fileExtension} • ${sizeText}]`);
                        });

                        // Render out the folder mapping structure using clear branch characters
                        const treeLines = ['root/'];
                        const buckets = Object.keys(treeData);

                        buckets.forEach((bucket, bIdx) => {
                            const isLastBucket = bIdx === buckets.length - 1;
                            const bucketPrefix = isLastBucket ? '└── ' : '├── ';
                            const childPrefix = isLastBucket ? '    ' : '│   ';

                            // Only print folders that contain items to keep the terminal looking clean
                            if (treeData[bucket].length > 0) {
                                treeLines.push(`${bucketPrefix}${bucket}`);
                                
                                treeData[bucket].forEach((fileStr, fIdx) => {
                                    const isLastFile = fIdx === treeData[bucket].length - 1;
                                    const filePrefix = isLastFile ? '└── ' : '├── ';
                                    treeLines.push(`${childPrefix}${filePrefix}${fileStr}`);
                                });
                            }
                        });

                        return treeLines;
                    } catch (err) {
                        return `Storage Core Read Exception: ${err.message}`;
                    }
                }
            },
            'theme': {
                description: 'Mutate global visual theme (light/dark)',
                execute: (args) => {
                    const target = args[0]?.toLowerCase();
                    if (target === 'light' || target === 'dark') {
                        if (typeof window.toggleTheme === 'function') {
                            window.toggleTheme();
                        } else {
                            document.body.classList.toggle('dark', target === 'dark');
                        }
                        return `System theme modified to: ${target.toUpperCase()}`;
                    }
                    return 'Error: Use "theme light" or "theme dark".';
                }
            },
            'glass': {
                description: 'Toggle liquid glass layer state (on/off)',
                execute: (args) => {
                    const target = args[0]?.toLowerCase();
                    if (target === 'on' || target === 'off') {
                        if (typeof window.toggleGlass === 'function') {
                            window.toggleGlass();
                        } else {
                            document.body.classList.toggle('no-glass', target === 'off');
                        }
                        return `Compositor liquid glass switched: ${target.toUpperCase()}`;
                    }
                    return 'Error: Use "glass on" or "glass off".';
                }
            },
            'brightness': {
                description: 'Set screen panel brightness index (10-100)',
                execute: (args) => {
                    const val = parseInt(args[0], 10);
                    if (isNaN(val) || val < 10 || val > 100) return 'Error: Bounds must be 10-100.';
                    window.KOSDisplay?.setBrightness(val);
                    return `Panel backlight assigned: ${val}%`;
                }
            },
            'zoom': {
                description: 'Force layout zoom metrics (50-250)',
                execute: (args) => {
                    const val = parseInt(args[0], 10);
                    if (isNaN(val) || val < 50 || val > 250) return 'Error: Bounds must be 50-250.';
                    window.KOSDisplay?.setZoom(val);
                    return `Workspace display scaled: ${val}%`;
                }
            },
            'textsize': {
                description: 'Step typography level engine scale (1-6)',
                execute: (args) => {
                    const lvl = parseInt(args[0], 10);
                    if (isNaN(lvl) || lvl < 1 || lvl > 6) return 'Error: Steps scale 1-6.';
                    window.KOSDisplay?.setTextSize(lvl);
                    return `Typography size index altered: ${lvl}`;
                }
            },
            'bold': {
                description: 'Enforce accessibility layout weights (on/off)',
                execute: (args) => {
                    const target = args[0]?.toLowerCase();
                    if (target === 'on' || target === 'off') {
                        window.KOSDisplay?.setBold(target === 'on');
                        return `Font render modification applied.`;
                    }
                    return 'Error: Use "bold on" or "bold off".';
                }
            },
            'displayreset': {
                description: 'Restore video array settings to default',
                execute: () => {
                    window.KOSDisplay?.reset();
                    return 'Video layout configuration matrices returned to defaults.';
                }
            },
            'exit': {
                description: 'Destroy current console window instance',
                execute: () => {
                    window.WM?.close(appId);
                    return 'Stopping terminal UI task thread...';
                }
            }
        },

        init() {
            const body = document.getElementById('terminal-body');
            if (!body) return;

            body.innerHTML = `
                <div class="term-container">
                    <div class="term-output" id="term-output-area">
                        <div class="term-line system-msg">🔒 KOS SYSTEM CONSOLE ACTIVE</div>
                        <div class="term-line system-msg">Type "tree" to generate an structural layout map of active database files.</div>
                    </div>
                    <div class="term-input-line">
                        <span class="term-prompt">system@kos:#</span>
                        <input type="text" class="term-raw-input" id="term-input-field" autocomplete="off" spellcheck="false" autofocus />
                    </div>
                </div>
            `;

            const inputField = document.getElementById('term-input-field');
            const outputArea = document.getElementById('term-output-area');
            const container = body.querySelector('.term-container');

            container.addEventListener('click', () => inputField.focus());

            // Handle Key Bindings with proper asynchronous pipeline support
            inputField.addEventListener('keydown', async (e) => {
                if (e.key === 'Enter') {
                    const rawValue = inputField.value.trim();
                    if (!rawValue) return;

                    this.history.push(rawValue);
                    this.historyIndex = this.history.length;

                    this.logLine(`system@kos:# ${rawValue}`, 'user-cmd');
                    await this.processCommand(rawValue, outputArea);

                    inputField.value = '';
                    container.scrollTop = container.scrollHeight;
                } 
                else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    if (this.historyIndex > 0) {
                        this.historyIndex--;
                        inputField.value = this.history[this.historyIndex];
                    }
                } 
                else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    if (this.historyIndex < this.history.length - 1) {
                        this.historyIndex++;
                        inputField.value = this.history[this.historyIndex];
                    } else {
                        this.historyIndex = this.history.length;
                        inputField.value = '';
                    }
                }
            });
        },

        async processCommand(rawInput, outputArea) {
            const parts = rawInput.split(/\s+/);
            const cmdName = parts[0].toLowerCase();
            const args = parts.slice(1);

            if (this.commands[cmdName]) {
                try {
                    // Resolve commands whether they return synchronous outputs or async promises
                    const result = await this.commands[cmdName].execute(args, outputArea);
                    if (result === null) return;
                    
                    if (Array.isArray(result)) {
                        result.forEach(line => this.logLine(line));
                    } else if (result) {
                        this.logLine(result);
                    }
                    
                    if (window.KOSApps?.uimanager?._syncThemeToggles) {
                        try { window.KOSApps.uimanager._syncThemeToggles(); } catch (_) {}
                    }
                } catch (err) {
                    this.logLine(`RUNTIME ERROR: ${err.message}`, 'error-msg');
                }
            } else {
                this.logLine(`sys-err: unknown utility target: "${cmdName}"`, 'error-msg');
            }
        },

        logLine(text, className = '') {
            const outputArea = document.getElementById('term-output-area');
            if (!outputArea) return;

            const div = document.createElement('div');
            div.className = `term-line ${className}`;
            div.textContent = text;
            outputArea.appendChild(div);
        }
    };

    window.KOSApps = window.KOSApps || {};
    window.KOSApps[appId] = {
        init: () => RootTerminal.init()
    };

    if (window.WM && typeof window.WM.setOnOpen === 'function') {
        window.WM.setOnOpen(appId, () => RootTerminal.init());
    }
})();