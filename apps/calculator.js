/* ═══════════════════════════════════════════════════════════
   KOS Calculator — Developer: Joel Jais
   Fix: KOSBus.listen → KOSBus.on (listen does not exist)
   ═══════════════════════════════════════════════════════════ */

WM.setOnOpen('calculator', function () {
    var C = document.getElementById('calc-body');
    if (!C) return;

    if (!document.body.classList.contains('dark') && !document.body.classList.contains('light')) {
        var dm = window.matchMedia('(prefers-color-scheme: dark)');
        function syncDark(e) { document.body.classList.toggle('dark', e.matches); }
        syncDark(dm);
        dm.addEventListener('change', syncDark);
    }

    /* Fixed: was KOSBus.listen() which does not exist — correct method is KOSBus.on() */
    try {
        if (KOSBus) KOSBus.on('kos:glass-changed', function () { fitSize(); });
    } catch (_) {}

    var mode = 'standard';
    var display = '0', first = null, waiting = false, op = null;
    var sciDisplay = '0', sciExpr = '';
    var unitCat = 'length', unitFrom = 'm', unitTo = 'km', unitVal = '1';
    var curFrom = 'USD', curTo = 'EUR', curVal = '1', curRate = '0.92';

    var wrapper, contentEl, screen;

    var modeRatio = {
        standard:   4 / 6.5,
        scientific: 5 / 9.2,
        unit:       4 / 5.2,
        currency:   4 / 5.5,
        about:      3 / 4.2
    };

    var units = {
        length:   { base:'m',  list:['mm','cm','m','km','in','ft','yd','mi'],
                    toBase:{mm:1e-3,cm:.01,m:1,km:1e3,in:.0254,ft:.3048,yd:.9144,mi:1609.344} },
        mass:     { base:'g',  list:['mg','g','kg','oz','lb','ton'],
                    toBase:{mg:1e-3,g:1,kg:1e3,oz:28.3495,lb:453.592,ton:907185} },
        volume:   { base:'L',  list:['mL','L','gal','qt','cup','floz'],
                    toBase:{mL:1e-3,L:1,gal:3.78541,qt:.946353,cup:.236588,floz:.0295735} },
        area:     { base:'m²', list:['mm²','cm²','m²','km²','in²','ft²','ac','ha'],
                    toBase:{'mm²':1e-6,'cm²':1e-4,'m²':1,'km²':1e6,'in²':.00064516,'ft²':.092903,ac:4046.86,ha:1e4} },
        speed:    { base:'m/s',list:['m/s','km/h','mph','ft/s','kn'],
                    toBase:{'m/s':1,'km/h':.277778,'mph':.44704,'ft/s':.3048,'kn':.514444} },
        time:     { base:'s',  list:['ms','s','min','h','day','week','month','year'],
                    toBase:{ms:1e-3,s:1,min:60,h:3600,day:86400,week:604800,month:2592000,year:31536000} },
        data:     { base:'B',  list:['B','KB','MB','GB','TB'],
                    toBase:{B:1,KB:1024,MB:1048576,GB:1073741824,TB:1099511627776} },
        temp:     { base:'C',  list:['C','F','K'], special:true }
    };

    var currencies = {
        USD:1, EUR:.92, GBP:.79, JPY:149, CNY:7.24, RUB:92, CAD:1.36, AUD:1.54,
        INR:83, BRL:4.92, CHF:.88, KRW:1320, SEK:10.45, NOK:10.6, NZD:1.63,
        MXN:17.15, SGD:1.34, HKD:7.82, TRY:30.5, ZAR:18.7
    };
    var curNames = Object.keys(currencies);

    function fmtNum(n) {
        var s = String(n);
        if (s.length > 11) {
            s = parseFloat(s).toPrecision(8);
            if (s.indexOf('e') === -1 && s.indexOf('.') !== -1)
                s = String(Number(parseFloat(s).toFixed(6)));
        }
        return s;
    }

    function clearActiveOp() {
        if (!contentEl) return;
        contentEl.querySelectorAll('.btn-operator.active-op').forEach(function (b) {
            b.classList.remove('active-op');
        });
    }

    function convertTemp(v, from, to) {
        if (from === to) return v;
        var c;
        if (from === 'C') c = v;
        else if (from === 'F') c = (v - 32) * 5/9;
        else c = v - 273.15;
        if (to === 'C') return c;
        if (to === 'F') return c * 9/5 + 32;
        return c + 273.15;
    }

    function doUnitConvert() {
        var cat = units[unitCat];
        if (!cat) return '0';
        if (cat.special) return String(convertTemp(parseFloat(unitVal)||0, unitFrom, unitTo));
        var v = parseFloat(unitVal) || 0;
        return String(v * (cat.toBase[unitFrom]||1) / (cat.toBase[unitTo]||1));
    }

    function doCurConvert() {
        var v = parseFloat(curVal) || 0;
        var rate = parseFloat(curRate) || 0;
        if (!rate || rate <= 0) return '0';
        return String(v * rate);
    }

    function updateCurRate() {
        var cf = currencies[curFrom], ct = currencies[curTo];
        if (cf && ct) curRate = String(ct / cf);
    }

    function updateUnitOut() {
        var o = contentEl.querySelector('[data-cmd="uout"]');
        var sc = contentEl.querySelector('[data-screen="1"]');
        var r = fmtNum(doUnitConvert());
        if (o) o.textContent = r;
        if (sc) sc.textContent = r;
    }

    function updateCurOut() {
        var o = contentEl.querySelector('[data-cmd="cout"]');
        var sc = contentEl.querySelector('[data-screen="1"]');
        var r = fmtNum(doCurConvert());
        if (o) o.textContent = r;
        if (sc) sc.textContent = r;
    }

    function calcOp(o, a, b) {
        switch (o) {
            case '/': return b === 0 ? NaN : a / b;
            case '*': return a * b;
            case '+': return a + b;
            case '-': return a - b;
            default: return NaN;
        }
    }

    function evalSci(expr) {
        var tokens = expr.split(/\s+/);
        var stack = [], curOp = null;
        tokens.forEach(function (tok) {
            if ('+-*/^'.indexOf(tok) !== -1) { curOp = tok; return; }
            if (tok === '(' || tok === ')') return;
            var v = parseFloat(tok);
            if (isNaN(v)) return;
            if (curOp === null) { stack.push(v); return; }
            var left = stack.pop() || 0;
            switch (curOp) {
                case '+': stack.push(left + v); break;
                case '-': stack.push(left - v); break;
                case '*': stack.push(left * v); break;
                case '/': stack.push(left / v); break;
                case '^': stack.push(Math.pow(left, v)); break;
            }
            curOp = null;
        });
        return stack[0] || 0;
    }

    function buildTabs() {
        var names = ['standard','scientific','unit','currency','about'];
        var h = '<div class="mode-tabs">';
        names.forEach(function (t) {
            h += '<button class="mode-tab' + (t === mode ? ' active-tab' : '') + '" data-cmd="mode-' + t + '">' + t.charAt(0).toUpperCase() + t.slice(1) + '</button>';
        });
        h += '</div>';
        return h;
    }

    function buildContent(m) {
        var h = '';

        if (m === 'standard' || m === 'scientific') {
            h += '<div class="calc-screen" data-screen="1">0</div>';
            h += '<div class="calc-grid' + (m === 'scientific' ? ' sci-grid' : '') + '">';
            var btns = m === 'standard' ? [
                { t:'AC',a:'clear',c:'btn-top' }, { t:'±',a:'negate',c:'btn-top' }, { t:'%',a:'percent',c:'btn-top' }, { t:'÷',o:'/',c:'btn-operator' },
                { t:'7',v:'7',c:'btn-num' }, { t:'8',v:'8',c:'btn-num' }, { t:'9',v:'9',c:'btn-num' }, { t:'×',o:'*',c:'btn-operator' },
                { t:'4',v:'4',c:'btn-num' }, { t:'5',v:'5',c:'btn-num' }, { t:'6',v:'6',c:'btn-num' }, { t:'−',o:'-',c:'btn-operator' },
                { t:'1',v:'1',c:'btn-num' }, { t:'2',v:'2',c:'btn-num' }, { t:'3',v:'3',c:'btn-num' }, { t:'+',o:'+',c:'btn-operator' },
                { t:'0',v:'0',c:'btn-num btn-zero' }, { t:'.',v:'.',c:'btn-num' }, { t:'=',a:'eval',c:'btn-operator' }
            ] : [
                { t:'(',a:'paren-open' }, { t:')',a:'paren-close' }, { t:'AC',a:'sclear',c:'btn-top' }, { t:'⌫',a:'bksp',c:'btn-top' }, { t:'%',a:'spercent',c:'btn-top' },
                { t:'sin',a:'sin',c:'btn-sci' }, { t:'cos',a:'cos',c:'btn-sci' }, { t:'tan',a:'tan',c:'btn-sci' }, { t:'ln',a:'ln',c:'btn-sci' }, { t:'log',a:'log',c:'btn-sci' },
                { t:'x²',a:'sq',c:'btn-sci' }, { t:'x³',a:'cube',c:'btn-sci' }, { t:'xⁿ',a:'pow',c:'btn-sci' }, { t:'√',a:'sqrt',c:'btn-sci' }, { t:'1/x',a:'reci',c:'btn-sci' },
                { t:'7',v:'7' }, { t:'8',v:'8' }, { t:'9',v:'9' }, { t:'÷',o:'/',c:'btn-operator' }, { t:'±',a:'sneg',c:'btn-top' },
                { t:'4',v:'4' }, { t:'5',v:'5' }, { t:'6',v:'6' }, { t:'×',o:'*',c:'btn-operator' }, { t:'π',a:'pi',c:'btn-sci' },
                { t:'1',v:'1' }, { t:'2',v:'2' }, { t:'3',v:'3' }, { t:'−',o:'-',c:'btn-operator' }, { t:'e',a:'euler',c:'btn-sci' },
                { t:'0',v:'0' }, { t:'.',v:'.' }, { t:'!',a:'fact',c:'btn-sci' }, { t:'+',o:'+',c:'btn-operator' }, { t:'=',a:'seval',c:'btn-operator' }
            ];
            btns.forEach(function (b) {
                var cls = b.c || 'btn-num';
                var cmd = '';
                if (b.v) cmd = ' data-cmd="' + (m === 'scientific' ? 'sv-' : 'val-') + b.v + '"';
                else if (b.o) cmd = ' data-cmd="' + (m === 'scientific' ? 'sop-' : 'op-') + b.o + '"';
                else if (b.a) cmd = ' data-cmd="' + b.a + '"';
                h += '<button class="calc-btn ' + cls + '"' + cmd + '>' + b.t + '</button>';
            });
            h += '</div>';
        } else if (m === 'unit') {
            var catKeys = Object.keys(units);
            h += '<div class="calc-screen" data-screen="1">0</div>';
            h += '<div class="conv-form">';
            h += '  <label class="conv-label">Category</label>';
            h += '  <select class="conv-select" data-cmd="ucat">';
            catKeys.forEach(function (k) {
                h += '<option value="' + k + '"' + (k === unitCat ? ' selected' : '') + '>' + k.charAt(0).toUpperCase() + k.slice(1) + '</option>';
            });
            h += '  </select>';
            h += '  <div class="conv-row"><span class="conv-label">From</span>';
            h += '    <input class="conv-input" type="text" value="' + unitVal + '" data-cmd="uval">';
            h += '    <select class="conv-select conv-unit-select" data-cmd="ufrom"></select></div>';
            h += '  <div class="conv-row"><span class="conv-label">To</span>';
            h += '    <output class="conv-output" data-cmd="uout">0</output>';
            h += '    <select class="conv-select conv-unit-select" data-cmd="uto"></select></div>';
            h += '  <button class="conv-swap" data-cmd="uswap">⇅ Swap</button>';
            h += '</div>';
        } else if (m === 'currency') {
            updateCurRate();
            h += '<div class="calc-screen" data-screen="1">0</div>';
            h += '<div class="conv-form">';
            h += '  <div class="conv-row"><span class="conv-label">From</span>';
            h += '    <input class="conv-input" type="text" value="' + curVal + '" data-cmd="cval">';
            h += '    <select class="conv-select" data-cmd="cfrom">';
            curNames.forEach(function (c) { h += '<option value="' + c + '"' + (c === curFrom ? ' selected' : '') + '>' + c + '</option>'; });
            h += '    </select></div>';
            h += '  <div class="conv-row"><span class="conv-label">To</span>';
            h += '    <output class="conv-output" data-cmd="cout">0</output>';
            h += '    <select class="conv-select" data-cmd="cto">';
            curNames.forEach(function (c) { h += '<option value="' + c + '"' + (c === curTo ? ' selected' : '') + '>' + c + '</option>'; });
            h += '    </select></div>';
            h += '  <div class="conv-row"><span class="conv-label">Rate</span>';
            h += '    <input class="conv-input" type="text" value="' + curRate + '" data-cmd="crate"></div>';
            h += '  <button class="conv-swap" data-cmd="cswap">⇅ Swap</button>';
            h += '</div>';
        } else if (m === 'about') {
            h += '<div class="about-section">';
            h += '  <div class="about-icon">🧮</div>';
            h += '  <div class="about-name">Calculator</div>';
            h += '  <div class="about-version">v1.0</div>';
            h += '  <div class="about-divider"></div>';
            h += '  <div class="about-label">Developer</div>';
            h += '  <div class="about-value">Joel Jais</div>';
            h += '  <div class="about-label">About</div>';
            h += '  <div class="about-value">A professional multi-mode calculator with standard, scientific, unit conversion, and currency tools.</div>';
            h += '</div>';
        }
        return h;
    }

    function switchMode(m) {
        mode = m;
        if (wrapper) {
            wrapper.querySelectorAll('.mode-tab').forEach(function (t) {
                t.classList.toggle('active-tab', t.getAttribute('data-cmd') === 'mode-' + mode);
            });
            rebuildContent();
        }
    }

    function rebuildContent() {
        if (!contentEl) return;
        contentEl.innerHTML = buildContent(mode);
        screen = contentEl.querySelector('[data-screen="1"]');

        if (mode === 'unit') {
            var cat = units[unitCat];
            var fs = contentEl.querySelector('[data-cmd="ufrom"]');
            var ts = contentEl.querySelector('[data-cmd="uto"]');
            if (fs && ts && cat) {
                cat.list.forEach(function (u) {
                    fs.innerHTML += '<option value="' + u + '"' + (u === unitFrom ? ' selected' : '') + '>' + u + '</option>';
                    ts.innerHTML += '<option value="' + u + '"' + (u === unitTo ? ' selected' : '') + '>' + u + '</option>';
                });
            }
            updateUnitOut();
        }
        if (mode === 'currency') updateCurOut();
        if (mode === 'standard') { display = '0'; first = null; waiting = false; op = null; }
        if (mode === 'scientific') { sciDisplay = '0'; sciExpr = ''; }
        fitSize();
    }

    C.innerHTML = '<div class="apple-calc-wrapper">' + buildTabs() + '<div class="calc-content"></div></div>';
    wrapper = C.querySelector('.apple-calc-wrapper');
    contentEl = C.querySelector('.calc-content');
    rebuildContent();

    function fitSize() {
        if (!wrapper) return;
        var pw = C.clientWidth, ph = C.clientHeight;
        var tr = modeRatio[mode] || 0.6;
        var pct = Math.max(0.75, Math.min(0.95, 0.95 - Math.max(0, pw - 200) / 3600));
        var w = pw * pct, h = w / tr;
        if (h > ph) { h = ph; w = h * tr; }
        wrapper.style.width = Math.floor(w) + 'px';
        wrapper.style.height = Math.floor(h) + 'px';
    }

    var ro = new ResizeObserver(fitSize);
    ro.observe(C);

    C.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-cmd]');
        if (!btn) return;
        var cmd = btn.getAttribute('data-cmd');

        if (cmd.indexOf('mode-') === 0) { switchMode(cmd.slice(5)); return; }

        if (mode === 'unit') {
            if (cmd === 'uswap') { var t = unitFrom; unitFrom = unitTo; unitTo = t; rebuildContent(); }
            return;
        }
        if (mode === 'currency') {
            if (cmd === 'cswap') { var t = curFrom; curFrom = curTo; curTo = t; updateCurRate(); rebuildContent(); }
            return;
        }
        if (mode === 'about') return;

        if (mode === 'standard') {
            if (cmd.indexOf('val-') === 0) {
                var v = cmd.slice(4);
                if (waiting || display === 'Error') { display = v; waiting = false; }
                else {
                    if (v === '.' && display.indexOf('.') !== -1) return;
                    if (display === '0' && v !== '.') display = v;
                    else display += v;
                }
                var clr = contentEl.querySelector('[data-cmd="clear"]');
                if (clr) clr.textContent = 'C';
                if (screen) screen.textContent = fmtNum(display);
                return;
            }
            if (cmd.indexOf('op-') === 0) {
                var ok = cmd.slice(3);
                clearActiveOp();
                btn.classList.add('active-op');
                var inp = parseFloat(display);
                if (op && waiting) { op = ok; return; }
                if (display === 'Error') return;
                if (first === null && !isNaN(inp)) { first = inp; }
                else if (op) {
                    var r = calcOp(op, first, inp);
                    if (!isFinite(r)) { display = 'Error'; if (screen) screen.textContent = 'Error'; return; }
                    display = fmtNum(r); first = r;
                    if (screen) screen.textContent = display;
                }
                waiting = true; op = ok; return;
            }
            if (cmd === 'clear') {
                var cb = contentEl.querySelector('[data-cmd="clear"]');
                if (cb && cb.textContent === 'C') { display = '0'; cb.textContent = 'AC'; }
                else { display = '0'; first = null; waiting = false; op = null; clearActiveOp(); }
                if (screen) screen.textContent = display; return;
            }
            if (cmd === 'negate')  { display = String(parseFloat(display) * -1); if (screen) screen.textContent = fmtNum(display); return; }
            if (cmd === 'percent') { display = String(parseFloat(display) / 100); if (screen) screen.textContent = fmtNum(display); return; }
            if (cmd === 'eval') {
                if (op === null || display === 'Error') return;
                var cur = parseFloat(display);
                if (op && !waiting) {
                    var r2 = calcOp(op, first, cur);
                    if (!isFinite(r2)) display = 'Error';
                    else display = fmtNum(r2);
                    first = null; op = null; waiting = false; clearActiveOp();
                    if (screen) screen.textContent = display;
                }
                return;
            }
            return;
        }

        if (mode === 'scientific') {
            if (cmd.indexOf('sv-') === 0) {
                var sv = cmd.slice(3);
                if (sciDisplay === '0' && sv !== '.') sciDisplay = sv;
                else if (sv === '.' && sciDisplay.indexOf('.') !== -1) return;
                else sciDisplay += sv;
                if (screen) screen.textContent = sciDisplay; return;
            }
            if (cmd.indexOf('sop-') === 0) {
                var sok = cmd.slice(4);
                sciExpr += sciDisplay + ' ' + sok + ' '; sciDisplay = '0';
                if (screen) screen.textContent = sciExpr; return;
            }
            if (cmd === 'sclear')   { sciDisplay = '0'; sciExpr = ''; if (screen) screen.textContent = '0'; return; }
            if (cmd === 'bksp')     { sciDisplay = sciDisplay.slice(0,-1) || '0'; if (screen) screen.textContent = sciDisplay; return; }
            if (cmd === 'sneg')     { sciDisplay = String(parseFloat(sciDisplay)*-1); if (screen) screen.textContent = sciDisplay; return; }
            if (cmd === 'spercent') { sciDisplay = String(parseFloat(sciDisplay)/100); if (screen) screen.textContent = sciDisplay; return; }
            if (cmd === 'pi')    { sciDisplay = '3.141592653589793'; if (screen) screen.textContent = 'π'; return; }
            if (cmd === 'euler') { sciDisplay = '2.718281828459045'; if (screen) screen.textContent = 'e'; return; }
            if (cmd === 'sin')   { sciDisplay = String(Math.sin(parseFloat(sciDisplay)));   if (screen) screen.textContent = fmtNum(sciDisplay); return; }
            if (cmd === 'cos')   { sciDisplay = String(Math.cos(parseFloat(sciDisplay)));   if (screen) screen.textContent = fmtNum(sciDisplay); return; }
            if (cmd === 'tan')   { sciDisplay = String(Math.tan(parseFloat(sciDisplay)));   if (screen) screen.textContent = fmtNum(sciDisplay); return; }
            if (cmd === 'ln')    { sciDisplay = String(Math.log(parseFloat(sciDisplay)));   if (screen) screen.textContent = fmtNum(sciDisplay); return; }
            if (cmd === 'log')   { sciDisplay = String(Math.log10(parseFloat(sciDisplay))); if (screen) screen.textContent = fmtNum(sciDisplay); return; }
            if (cmd === 'sq')    { var sq = parseFloat(sciDisplay); sciDisplay = String(sq*sq);     if (screen) screen.textContent = fmtNum(sciDisplay); return; }
            if (cmd === 'cube')  { var cu = parseFloat(sciDisplay); sciDisplay = String(cu*cu*cu);  if (screen) screen.textContent = fmtNum(sciDisplay); return; }
            if (cmd === 'pow')   { sciExpr += sciDisplay + ' ^ '; sciDisplay = '0'; if (screen) screen.textContent = sciExpr; return; }
            if (cmd === 'sqrt')  { sciDisplay = String(Math.sqrt(parseFloat(sciDisplay))); if (screen) screen.textContent = fmtNum(sciDisplay); return; }
            if (cmd === 'reci')  { sciDisplay = String(1/parseFloat(sciDisplay));          if (screen) screen.textContent = fmtNum(sciDisplay); return; }
            if (cmd === 'fact') {
                var fv = parseInt(sciDisplay,10);
                if (fv < 0 || fv > 170) { if (screen) screen.textContent = 'Error'; return; }
                var fr = 1;
                for (var fi = 2; fi <= fv; fi++) fr *= fi;
                sciDisplay = String(fr); if (screen) screen.textContent = fmtNum(sciDisplay); return;
            }
            if (cmd === 'paren-open')  { sciExpr += sciDisplay + ' ( '; sciDisplay = '0'; if (screen) screen.textContent = sciExpr; return; }
            if (cmd === 'paren-close') { sciExpr += sciDisplay + ' ) '; sciDisplay = '0'; if (screen) screen.textContent = sciExpr; return; }
            if (cmd === 'seval') {
                try {
                    var sr = evalSci(sciExpr + ' ' + sciDisplay);
                    sciDisplay = String(sr); sciExpr = '';
                    if (screen) screen.textContent = fmtNum(sciDisplay);
                } catch (err) {
                    if (screen) screen.textContent = 'Error';
                    sciDisplay = '0'; sciExpr = '';
                }
                return;
            }
            return;
        }
    });

    C.addEventListener('input', function (e) {
        var t = e.target, cmd = t.getAttribute('data-cmd');
        if (!cmd) return;
        if (mode === 'unit' && cmd === 'uval')   { unitVal = t.value; updateUnitOut(); }
        if (mode === 'currency' && cmd === 'cval')  { curVal = t.value; updateCurOut(); }
        if (mode === 'currency' && cmd === 'crate') { curRate = t.value; updateCurOut(); }
    });

    C.addEventListener('change', function (e) {
        var t = e.target, cmd = t.getAttribute('data-cmd');
        if (!cmd) return;
        if (mode === 'unit') {
            if (cmd === 'ucat')  { unitCat = t.value; unitFrom = units[unitCat].list[0]; unitTo = units[unitCat].list[1]||units[unitCat].list[0]; rebuildContent(); }
            if (cmd === 'ufrom') { unitFrom = t.value; updateUnitOut(); }
            if (cmd === 'uto')   { unitTo   = t.value; updateUnitOut(); }
        }
        if (mode === 'currency') {
            if (cmd === 'cfrom') { curFrom = t.value; updateCurRate(); var ri  = contentEl.querySelector('[data-cmd="crate"]'); if (ri)  ri.value  = curRate; updateCurOut(); }
            if (cmd === 'cto')   { curTo   = t.value; updateCurRate(); var ri2 = contentEl.querySelector('[data-cmd="crate"]'); if (ri2) ri2.value = curRate; updateCurOut(); }
        }
    });
});
