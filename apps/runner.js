/* ═══════════════════════════════════════════════════════════════════════
   KOS Snake  ·  Developer: Joel Jais
   rAF loop, fixed-timestep update, clean state machine, proper scale.
   ═══════════════════════════════════════════════════════════════════════ */

WM.setOnOpen('runner', function () {
    var body = document.getElementById('runner-body');
    if (!body) return;

    /* ── HTML ── */
    body.innerHTML = [
        '<div class="snake-app-wrapper">',
            '<div class="snake-hud-panel">',
                '<div class="hud-item classic-brand">SNAKE</div>',
                '<div class="hud-item" id="snake-hud-center">',
                    '<span class="hud-label">SCORE:</span> <span id="snake-score-val">0000</span>',
                    '<span class="hud-label" style="margin-left:16px">HI:</span> <span id="snake-hiscore-val">0000</span>',
                    '<span class="pause-badge" id="snake-pause-badge" style="display:none">PAUSED</span>',
                '</div>',
                '<div class="hud-item menu-toggle-btn" id="snake-menu-btn"><i class="fa fa-sliders"></i> PAUSE</div>',
            '</div>',
            '<div class="snake-viewport-area" id="snake-vp">',
                '<canvas id="snake-canvas-matrix"></canvas>',
                '<div class="snake-modal-overlay" id="snake-system-modal">',
                    '<div class="modal-card liquid-glass">',
                        '<h2 id="modal-headline" class="glow-text">SNAKE</h2>',
                        '<p id="modal-subline">Configure then play:</p>',
                        '<div class="settings-grid">',
                            '<div class="setting-row">',
                                '<label>BOUNDARIES</label>',
                                '<select id="snake-opt-walls">',
                                    '<option value="solid" selected>SOLID (CLASSIC)</option>',
                                    '<option value="wrapped">WRAP (WARP)</option>',
                                '</select>',
                            '</div>',
                            '<div class="setting-row">',
                                '<label>SPEED</label>',
                                '<select id="snake-opt-speed">',
                                    '<option value="60">FAST</option>',
                                    '<option value="110" selected>NORMAL</option>',
                                    '<option value="180">EASY</option>',
                                '</select>',
                            '</div>',
                        '</div>',
                        '<button class="action-btn" id="snake-action-btn">PLAY</button>',
                        '<button class="action-btn secondary" id="snake-end-btn" style="display:none">END GAME</button>',
                    '</div>',
                '</div>',
                '<div id="snake-score-popup" style="display:none"></div>',
            '</div>',
        '</div>'
    ].join('');

    /* ── refs ── */
    var canvas  = body.querySelector('#snake-canvas-matrix');
    var ctx     = canvas.getContext('2d');
    var vp      = body.querySelector('#snake-vp');
    var scEl    = body.querySelector('#snake-score-val');
    var hiEl    = body.querySelector('#snake-hiscore-val');
    var badge   = body.querySelector('#snake-pause-badge');
    var menuBtn = body.querySelector('#snake-menu-btn');
    var modal   = body.querySelector('#snake-system-modal');
    var actBtn  = body.querySelector('#snake-action-btn');
    var endBtn  = body.querySelector('#snake-end-btn');
    var mTitle  = body.querySelector('#modal-headline');
    var mSub    = body.querySelector('#modal-subline');
    var optW    = body.querySelector('#snake-opt-walls');
    var optS    = body.querySelector('#snake-opt-speed');
    var popEl   = body.querySelector('#snake-score-popup');

    /* ── constants ── */
    var COLS = 30, ROWS = 20;
    var DPR = window.devicePixelRatio || 1;

    /* ── state ── */
    var ST = { IDLE:0, PLAYING:1, PAUSED:2, DEAD:3 };
    var state = ST.IDLE;

    var cells = [];
    var food  = { x:0, y:0 };
    var dir   = 'RIGHT';
    var nxt   = 'RIGHT';
    var score = 0, hi = 0;

    var vw = 0, vh = 0;          // canvas logical size (CSS px)
    var sx = 1, sy = 1;          // grid cell size
    var tAcc = 0;                // time accumulator for fixed-step updates
    var tLast = 0;               // last frame timestamp
    var deathFlash = 0;          // seconds remaining for death flash
    var foodPhase = 0;           // food pulse phase
    var pausePhase = 0;          // pause text pulse phase
    var popups = [];             // active score popups [{x,y,born}]

    try { hi = parseInt(localStorage.getItem('kos_snake_hiscore')) || 0; } catch (e) {}
    hiEl.textContent = pad(hi);

    /* ── helpers ── */
    function pad(n) { return String(n).padStart(4, '0'); }

    function rand(min, max) { return Math.floor(Math.random() * (max - min)) + min; }

    /* ── audio ── */
    var actx;
    function ac() {
        if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
        return actx;
    }
    function beep(f, dur, type, vol) {
        try {
            var a = ac();
            if (a.state === 'suspended') a.resume();
            var o = a.createOscillator(), g = a.createGain();
            o.type = type || 'square';
            o.connect(g); g.connect(a.destination);
            o.frequency.setValueAtTime(f, a.currentTime);
            g.gain.setValueAtTime(vol || 0.1, a.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
            o.start(a.currentTime); o.stop(a.currentTime + dur);
        } catch (e) {}
    }
    function sfxEat()  { beep(600,0.08,'square',0.08); beep(900,0.1,'square',0.06); }
    function sfxDie()  { beep(200,0.3,'sawtooth',0.12); }

    /* ── resize ── */
    function resize() {
        var r = vp.getBoundingClientRect();
        vw = r.width; vh = r.height;
        canvas.width  = vw * DPR;
        canvas.height = vh * DPR;
        canvas.style.width  = vw + 'px';
        canvas.style.height = vh + 'px';
        sx = vw / COLS;
        sy = vh / ROWS;
        if (state === ST.IDLE || state === ST.DEAD) render();
    }

    /* ── game init ── */
    function startGame() {
        cells = [
            { x:5, y:Math.floor(ROWS/2) },
            { x:4, y:Math.floor(ROWS/2) },
            { x:3, y:Math.floor(ROWS/2) }
        ];
        dir = 'RIGHT'; nxt = 'RIGHT';
        score = 0; deathFlash = 0; tAcc = 0; tLast = 0;
        popups = [];
        scEl.textContent = pad(0);
        spawnFood();
        state = ST.PLAYING;
        modal.classList.remove('active-overlay');
        badge.style.display = 'none';
        menuBtn.innerHTML = '<i class="fa fa-sliders"></i> PAUSE';
        endBtn.style.display = 'none';
        tLast = performance.now();
        startLoop();
    }

    function spawnFood() {
        for (var t = 0; t < 200; t++) {
            var fx = rand(0, COLS), fy = rand(0, ROWS);
            var ok = true;
            for (var i = 0; i < cells.length; i++) {
                if (cells[i].x === fx && cells[i].y === fy) { ok = false; break; }
            }
            if (ok) { food.x = fx; food.y = fy; return; }
        }
    }

    /* ── state changes ── */
    function pause() {
        if (state !== ST.PLAYING) return;
        state = ST.PAUSED;
        badge.style.display = 'inline';
        menuBtn.innerHTML = '<i class="fa fa-play"></i> RESUME';
        showModal('PAUSED', 'Game paused. Resume or end the game:', 'RESUME', 'END GAME');
    }

    function resume() {
        if (state !== ST.PAUSED) return;
        state = ST.PLAYING;
        badge.style.display = 'none';
        menuBtn.innerHTML = '<i class="fa fa-sliders"></i> PAUSE';
        modal.classList.remove('active-overlay');
        tAcc = 0;
        tLast = performance.now();
        endBtn.style.display = 'none';
    }

    function die() {
        state = ST.DEAD;
        deathFlash = 0.5; // 0.5s flash
        sfxDie();
        if (score > hi) {
            hi = score;
            hiEl.textContent = pad(hi);
            hiEl.classList.remove('hi-blink'); void hiEl.offsetWidth;
            hiEl.classList.add('hi-blink');
            try { localStorage.setItem('kos_snake_hiscore', hi); } catch (e) {}
        }
        badge.style.display = 'none';
        menuBtn.innerHTML = '<i class="fa fa-sliders"></i> PAUSE';
        showModal('GAME OVER', 'Score: ' + pad(score), 'PLAY AGAIN', null);
    }

    function showModal(title, sub, btnText, endBtnText) {
        mTitle.textContent = title;
        mTitle.className = 'glow-text' + (title === 'GAME OVER' ? ' gameover-alert' : '');
        mSub.textContent = sub;
        actBtn.textContent = btnText;
        actBtn.style.display = 'block';
        if (endBtnText) {
            endBtn.textContent = endBtnText;
            endBtn.style.display = 'block';
        } else {
            endBtn.style.display = 'none';
        }
        modal.classList.add('active-overlay');
    }

    /* ── score popup ── */
    function addPopup(gx, gy) {
        popups.push({ x:gx, y:gy, born:performance.now() });
    }

    /* ── update (fixed-step, called at tick rate) ── */
    function update() {
        if (state !== ST.PLAYING) return;

        dir = nxt;
        var hx = cells[0].x, hy = cells[0].y;
        switch (dir) {
            case 'UP': hy--; break;
            case 'DOWN': hy++; break;
            case 'LEFT': hx--; break;
            case 'RIGHT': hx++; break;
        }

        var wrap = optW.value === 'wrapped';
        if (wrap) {
            if (hx < 0) hx = COLS - 1;
            if (hx >= COLS) hx = 0;
            if (hy < 0) hy = ROWS - 1;
            if (hy >= ROWS) hy = 0;
        } else {
            if (hx < 0 || hx >= COLS || hy < 0 || hy >= ROWS) { die(); return; }
        }

        for (var i = 0; i < cells.length; i++) {
            if (cells[i].x === hx && cells[i].y === hy) { die(); return; }
        }

        cells.unshift({ x:hx, y:hy });

        if (hx === food.x && hy === food.y) {
            score += 10;
            scEl.textContent = pad(score);
            sfxEat();
            addPopup(food.x, food.y);
            spawnFood();
        } else {
            cells.pop();
        }
    }

    /* ── render ── */
    function render() {
        var w = vw, h = vh;
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        ctx.clearRect(0, 0, w, h);

        /* ── background ── */
        ctx.fillStyle = '#080b11';
        ctx.fillRect(0, 0, w, h);

        /* ── grid lines ── */
        ctx.strokeStyle = 'rgba(0,255,102,0.04)';
        ctx.lineWidth = 0.5;
        for (var x = 0; x <= COLS; x++) {
            ctx.beginPath(); ctx.moveTo(x * sx, 0); ctx.lineTo(x * sx, h); ctx.stroke();
        }
        for (var y = 0; y <= ROWS; y++) {
            ctx.beginPath(); ctx.moveTo(0, y * sy); ctx.lineTo(w, y * sy); ctx.stroke();
        }

        /* ── food (pulsing) ── */
        if (state !== ST.IDLE) {
            var fp = 1 + Math.sin(foodPhase * 3) * 0.08;
            var fw = (sx - 2) * fp;
            var fh = (sy - 2) * fp;
            var fx = food.x * sx + (sx - fw) / 2;
            var fy = food.y * sy + (sy - fh) / 2;

            ctx.shadowColor = '#ff3366';
            ctx.shadowBlur = 16;
            ctx.fillStyle = '#ff3366';
            roundRect(fx, fy, fw, fh, 3);
            ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.fillRect(fx + 2, fy + 2, fw * 0.35, fh * 0.25);
            ctx.fillStyle = '#2ecc71';
            ctx.fillRect(fx + fw / 2 - 1, fy - 3, 2, 4);
        }

        /* ── snake ── */
        for (var i = 0; i < cells.length; i++) {
            var isHead = i === 0;
            var pad2 = isHead ? 2 : 1;
            var cx = cells[i].x * sx + pad2;
            var cy = cells[i].y * sy + pad2;
            var cw = sx - pad2 * 2;
            var ch = sy - pad2 * 2;
            var rad = isHead ? 5 : 3;

            var t = cells.length > 1 ? i / (cells.length - 1) : 0;
            var gr = Math.round(0 + (1 - t) * 120);
            var gg = Math.round(100 + (1 - t) * 155);
            ctx.shadowColor = isHead ? '#00ff66' : '#009944';
            ctx.shadowBlur = isHead ? 12 : 4;
            ctx.fillStyle = 'rgb(' + gr + ',' + gg + ',50)';
            roundRect(cx, cy, cw, ch, rad);
            ctx.shadowBlur = 0;

            if (isHead) drawEyes(cx, cy, cw, ch);
        }

        /* ── death flash ── */
        if (deathFlash > 0 && Math.floor(deathFlash * 10) % 2 === 0) {
            ctx.fillStyle = 'rgba(255,50,50,0.2)';
            ctx.fillRect(0, 0, w, h);
        }

        /* ── score popups ── */
        var now = performance.now();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 18px "Courier New",monospace';
        for (var pi = popups.length - 1; pi >= 0; pi--) {
            var p = popups[pi];
            var age = (now - p.born) / 1000;
            if (age > 0.6) { popups.splice(pi, 1); continue; }
            var pct = age / 0.6;
            ctx.fillStyle = 'rgba(0,255,102,' + (1 - pct) + ')';
            ctx.fillText('+10', p.x * sx + sx / 2, p.y * sy - pct * 30);
        }

        /* ── paused overlay text ── */
        if (state === ST.PAUSED) {
            var pa = 0.5 + Math.sin(pausePhase * 2) * 0.3;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = 'bold 36px "Courier New",monospace';
            ctx.shadowColor = '#00ff66';
            ctx.shadowBlur = 30;
            ctx.fillStyle = 'rgba(0,255,102,' + pa + ')';
            ctx.fillText('PAUSED', w / 2, h / 2);
            ctx.shadowBlur = 0;
            ctx.font = '14px "Courier New",monospace';
            ctx.fillStyle = 'rgba(255,255,255,' + (pa * 0.5) + ')';
            ctx.fillText('ESC or P to resume', w / 2, h / 2 + 36);
        }
    }

    function drawEyes(cx, cy, cw, ch) {
        var ex = cx + cw / 2, ey = cy + ch / 2;
        var ed = Math.min(cw, ch) * 0.2;
        var eo = Math.min(cw, ch) * 0.22;

        function white(r1, c1, r2, c2) {
            ctx.fillStyle = '#fff';
            ctx.fillRect(ex + r1 - ed / 2, ey + c1 - ed / 2, ed, ed);
            ctx.fillRect(ex + r2 - ed / 2, ey + c2 - ed / 2, ed, ed);
        }
        function pupil(r1, c1, r2, c2) {
            ctx.fillStyle = '#000';
            ctx.fillRect(ex + r1, ey + c1, ed * 0.5, ed * 0.5);
            ctx.fillRect(ex + r2, ey + c2, ed * 0.5, ed * 0.5);
        }

        switch (dir) {
            case 'RIGHT':
                white(eo*0.5, -eo, eo*0.5, eo);
                pupil(eo*0.5+ed*0.1, -eo, eo*0.5+ed*0.1, eo-ed*0.1);
                break;
            case 'LEFT':
                white(-eo*0.5, -eo, -eo*0.5, eo);
                pupil(-eo*0.5-ed*0.1, -eo, -eo*0.5-ed*0.1, eo-ed*0.1);
                break;
            case 'UP':
                white(-eo, -eo*0.5, eo, -eo*0.5);
                pupil(-eo, -eo*0.5+ed*0.1, eo-ed*0.1, -eo*0.5+ed*0.1);
                break;
            case 'DOWN':
                white(-eo, eo*0.5, eo, eo*0.5);
                pupil(-eo, eo*0.5-ed*0.1, eo-ed*0.1, eo*0.5-ed*0.1);
                break;
        }
    }

    function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        ctx.fill();
    }

    /* ── main loop (rAF) ── */
    var loopId = null;

    function startLoop() {
        if (loopId) return;
        loopId = requestAnimationFrame(loop);
    }

    function stopLoop() {
        if (loopId) { cancelAnimationFrame(loopId); loopId = null; }
        if (state === ST.IDLE || state === ST.DEAD) render();
    }

    function loop(now) {
        if (state === ST.IDLE || state === ST.DEAD) {
            loopId = null;
            render();
            return;
        }

        loopId = requestAnimationFrame(loop);

        var dt = Math.min((now - tLast) / 1000, 0.1);
        tLast = now;

        if (state === ST.PLAYING) {
            var tickMs = parseInt(optS.value) || 110;
            tAcc += dt * 1000;
            while (tAcc >= tickMs) {
                update();
                tAcc -= tickMs;
                if (state !== ST.PLAYING) break;
            }
        }

        if (state === ST.PLAYING || state === ST.PAUSED) {
            foodPhase += dt;
            if (state === ST.PAUSED) pausePhase += dt;
        }
        if (deathFlash > 0) deathFlash = Math.max(0, deathFlash - dt);

        render();
    }

    /* ── input ── */
    function onKey(e) {
        var k = e.key;
        if (k === 'Escape' || k === 'p' || k === 'P') {
            e.preventDefault();
            if (state === ST.PLAYING) pause();
            else if (state === ST.PAUSED) resume();
            return;
        }
        if (state !== ST.PLAYING) return;
        if ((k === 'ArrowUp'    || k === 'w' || k === 'W') && dir !== 'DOWN')  { nxt = 'UP';    e.preventDefault(); }
        if ((k === 'ArrowDown'  || k === 's' || k === 'S') && dir !== 'UP')    { nxt = 'DOWN';  e.preventDefault(); }
        if ((k === 'ArrowLeft'  || k === 'a' || k === 'A') && dir !== 'RIGHT') { nxt = 'LEFT';  e.preventDefault(); }
        if ((k === 'ArrowRight' || k === 'd' || k === 'D') && dir !== 'LEFT')  { nxt = 'RIGHT'; e.preventDefault(); }
    }

    /* ── touch swipe ── */
    var tx, ty;
    canvas.addEventListener('touchstart', function (e) {
        if (state !== ST.PLAYING) return;
        tx = e.touches[0].clientX; ty = e.touches[0].clientY;
    });
    canvas.addEventListener('touchend', function (e) {
        if (state !== ST.PLAYING || tx == null) return;
        var dx = e.changedTouches[0].clientX - tx;
        var dy = e.changedTouches[0].clientY - ty;
        tx = null;
        if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
        if (Math.abs(dx) > Math.abs(dy)) {
            if (dx > 0 && dir !== 'LEFT')  nxt = 'RIGHT';
            else                           nxt = 'LEFT';
        } else {
            if (dy > 0 && dir !== 'UP')    nxt = 'DOWN';
            else                           nxt = 'UP';
        }
    });

    /* ── button events ── */
    actBtn.onclick = function () {
        if (state === ST.PAUSED) { resume(); }
        else                     { startGame(); }
    };

    endBtn.onclick = function () {
        if (state !== ST.PAUSED) return;
        die();
    };

    menuBtn.onclick = function () {
        if (state === ST.PLAYING) pause();
        else if (state === ST.PAUSED) resume();
    };

    modal.addEventListener('click', function (e) {
        if (e.target === modal && state === ST.PAUSED) resume();
    });

    window.addEventListener('keydown', onKey);

    /* ── resize ── */
    new ResizeObserver(function () { resize(); }).observe(vp);
    setTimeout(resize, 50);

    /* ── open overlay ── */
    modal.classList.add('active-overlay');
    mTitle.textContent = 'SNAKE';
    mTitle.className = 'glow-text';
    mSub.textContent = 'Configure then play:';
    actBtn.textContent = 'PLAY';
    endBtn.style.display = 'none';

    /* ── cleanup ── */
    WM.setOnClose('runner', function () {
        stopLoop();
        window.removeEventListener('keydown', onKey);
    });
});
