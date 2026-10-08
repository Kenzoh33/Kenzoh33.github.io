/* 404 page: a table tennis game against the computer, drawn on a canvas.
   Real table proportions, real scoring (first to 11, win by 2, serve
   switches every 2 points), and hit sounds synthesized with the Web Audio
   API, so no image or audio files are loaded. Everything game-related is
   hidden in the HTML and only shown here, so without JS the page is just
   the message and a link home. */
(function () {
  // World units are centimetres on a real table: 274 x 152.5, net 15.25 high,
  // table top at z = 0, floor 76 cm below it.
  var L = 274, TW = 152.5, NET_H = 15.25, FLOOR = -76;
  var G = 620, BOUNCE = 0.84, PADDLE_Z = 14, HIT_R = 30, CPU_REACH = 22;
  var WORLD_W = 470, WORLD_H = 235;
  var TABLE_TOP = '#2E5D47', TABLE_FAR = '#36694F', TABLE_SIDE = '#1B3A2B', LINE = '#F4F1EA';

  var cv = document.getElementById('oob-table');
  if (!cv || !cv.getContext) return;
  var ctx = cv.getContext('2d');
  var scoreEl = document.getElementById('oob-score');
  var statusEl = document.getElementById('oob-status');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('.oob-tools, .oob [hidden]').forEach(function (el) { el.hidden = false; });
  var s = 1, dpr = 1, cssW = 0, cssH = 0, shakeX = 0, shakeY = 0, shake = 0;
  var colors = {};

  function readColors() {
    var cs = getComputedStyle(document.documentElement);
    ['--bg', '--bg-alt', '--ink', '--ink-soft'].forEach(function (k) { colors[k] = cs.getPropertyValue(k).trim(); });
    colors.dark = document.documentElement.dataset.theme === 'dark';
  }
  readColors();
  // Follow the site's theme toggle (main.js) and the system setting live
  new MutationObserver(readColors).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  function resize() {
    var r = cv.getBoundingClientRect();
    cssW = r.width; cssH = r.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr);
    s = cssW / WORLD_W;
  }
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(cv);
  else window.addEventListener('resize', resize);
  resize();

  // Oblique projection: x runs along the table, y is depth (far to near), z is height
  function P(x, y, z) {
    return [(x + 97 + (y - TW / 2) * 0.12) * s + shakeX, (55 + (y + 45) * 0.55 - z * 0.85) * s + shakeY];
  }
  function unproject(mx, my) {
    var y = ((my - shakeY) / s - 55 + PADDLE_Z * 0.85) / 0.55 - 45;
    var x = (mx - shakeX) / s - 97 - (y - TW / 2) * 0.12;
    return { x: x, y: y };
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function onTable(x, y) { return x >= 0 && x <= L && y >= 0 && y <= TW; }
  function sideOf(x) { return x < L / 2 ? 'you' : 'cpu'; }
  function other(w) { return w === 'you' ? 'cpu' : 'you'; }

  // ---------- sound (synthesized, no files) ----------
  var ac = null, muted = false, noise = null;
  function audio() {
    if (!ac) { var A = window.AudioContext || window.webkitAudioContext; if (!A) return; ac = new A();
      noise = ac.createBuffer(1, ac.sampleRate * 0.05, ac.sampleRate);
      var d = noise.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    if (ac.state === 'suspended') ac.resume();
  }
  var SFX = { table: [2600, 1500, 0.035, 0.22, 3200], paddle: [1250, 650, 0.06, 0.32, 2400],
              net: [380, 180, 0.09, 0.14, 600], floor: [1800, 1100, 0.04, 0.12, 2800],
              win: [784, 784, 0.22, 0.07, 0], lose: [330, 330, 0.22, 0.06, 0] };
  function sfx(type, vol) {
    if (!ac || muted) return;
    var c = SFX[type], t = ac.currentTime, v = c[3] * (vol == null ? 1 : vol);
    var o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(c[0], t); o.frequency.exponentialRampToValueAtTime(c[1], t + c[2]);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0008, t + c[2]);
    o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + c[2] + 0.02);
    if (c[4]) {
      var src = ac.createBufferSource(), f = ac.createBiquadFilter(), ng = ac.createGain();
      src.buffer = noise; f.type = 'bandpass'; f.frequency.value = c[4];
      ng.gain.setValueAtTime(v * 0.9, t); ng.gain.exponentialRampToValueAtTime(0.0008, t + 0.025);
      src.connect(f); f.connect(ng); ng.connect(ac.destination); src.start(t); src.stop(t + 0.045);
    }
  }

  // ---------- state ----------
  var you = { x: -45, y: TW / 2, vx: 0, vy: 0, swing: 0, pts: 0 };
  var cpu = { x: L + 45, y: TW / 2, vx: 0, vy: 0, swing: 0, pts: 0 };
  var target = { x: you.x, y: you.y };
  var cpuAim = { x: cpu.x, y: cpu.y }, cpuThink = 0, cpuServeIn = 0;
  var ball = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, netted: false };
  var phase = 'wait';            // wait | live | dead | over
  var server = 'you', lastHitter = 'you';
  var serveStage = -1;           // 0: needs bounce on server side, 1: then receiver side, -1: rally
  var sideBounces = 0, rally = 0;
  var rings = [], popups = [], trail = [];
  var keys = {};
  var paused = false, pointDelay = 0;

  function paddle(w) { return w === 'you' ? you : cpu; }

  function updateServer() {
    var t = you.pts + cpu.pts;
    var block = (you.pts >= 10 && cpu.pts >= 10) ? t : Math.floor(t / 2);
    server = block % 2 === 0 ? 'you' : 'cpu';
  }
  function renderScore() {
    scoreEl.innerHTML =
      '<span class="who' + (server === 'you' ? ' serving' : '') + '">You</span>' +
      '<span>' + you.pts + '</span><span class="sep">&middot;</span><span>' + cpu.pts + '</span>' +
      '<span class="who' + (server === 'cpu' ? ' serving' : '') + '">CPU</span>';
  }
  function holdBall() {
    var p = paddle(server), dir = server === 'you' ? 1 : -1;
    var bob = Math.sin(performance.now() / 260) * 3;
    ball.x = p.x + dir * 11; ball.y = p.y; ball.z = 26 + bob;
    ball.vx = ball.vy = ball.vz = 0; ball.netted = false;
  }

  // Ballistic aim: land at (tx, ty) on the table T seconds from now
  function aim(tx, ty, T) {
    ball.vx = (tx - ball.x) / T;
    ball.vy = (ty - ball.y) / T;
    ball.vz = (-ball.z + 0.5 * G * T * T) / T;
  }

  function doServe() {
    var p = paddle(server), dir = server === 'you' ? 1 : -1;
    var x0 = dir > 0 ? Math.min(p.x + 11, -6) : Math.max(p.x - 11, L + 6);
    var y0 = clamp(p.y, 12, TW - 12), z0 = 26;
    var wantDepth = 0.5 + Math.random() * 0.3, best = null;
    // Search for a serve that bounces on our half, clears the net, then lands on theirs
    for (var f = 0.12; f <= 0.32; f += 0.02) {
      var x1 = dir > 0 ? L * f : L * (1 - f);
      for (var T1 = 0.25; T1 <= 1.1; T1 += 0.01) {
        var vx = (x1 - x0) / T1;
        var vz0 = (-z0 + 0.5 * G * T1 * T1) / T1;
        var vzb = -(vz0 - G * T1) * BOUNCE;
        var T2 = 2 * vzb / G, x2 = x1 + vx * T2;
        var tn = (L / 2 - x1) / vx, zn = vzb * tn - 0.5 * G * tn * tn;
        var depth = dir * (x2 - L / 2) / (L / 2);
        if (zn > NET_H + 2 && depth > 0.25 && depth < 0.9) {
          var err = Math.abs(depth - wantDepth);
          if (!best || err < best.err) best = { err: err, T1: T1, T2: T2, x1: x1 };
        }
      }
    }
    if (!best) best = { T1: 0.5, T2: 0.5, x1: dir > 0 ? L * 0.25 : L * 0.75 };
    var y2 = TW / 2 + (Math.random() - 0.5) * TW * 0.65;
    ball.x = x0; ball.y = y0; ball.z = z0; ball.netted = false;
    ball.vx = (best.x1 - x0) / best.T1;
    ball.vy = (y2 - y0) / (best.T1 + best.T2);
    ball.vz = (-z0 + 0.5 * G * best.T1 * best.T1) / best.T1;
    phase = 'live'; lastHitter = server; serveStage = 0; sideBounces = 0; rally = 0;
    p.swing = 1; sfx('paddle', 0.8);
    statusEl.textContent = '';
  }

  function strike(who) {
    var p = paddle(who), dir = who === 'you' ? 1 : -1, T, tx, ty, power = 0;
    if (who === 'you') {
      var off = clamp((ball.y - p.y) / HIT_R, -1, 1);
      power = clamp(p.vx, 0, 900) / 900;                      // forward swing speed
      T = clamp(0.95 - rally * 0.006 - power * 0.42, 0.42, 0.95);
      tx = L / 2 + L / 2 * (0.42 + power * 0.5 + Math.random() * 0.08);
      ty = TW / 2 + off * TW * 0.46 + clamp(p.vy, -400, 400) * 0.03;
    } else {
      T = clamp(1.0 - rally * 0.006, 0.75, 1.0) * (0.95 + Math.random() * 0.1);
      tx = L / 2 - L / 2 * (0.4 + Math.random() * 0.45);
      var away = you.y < TW / 2 ? 1 : -1;                      // tends to play away from you
      ty = TW / 2 + (Math.random() < 0.4 ? away : -away) * Math.random() * TW * 0.3;
      if (Math.random() < 0.14 + rally * 0.01) {             // unforced errors
        var k = Math.random();
        if (k < 0.4) ty = TW / 2 + (Math.random() < 0.5 ? -1 : 1) * TW * 0.6;
        else if (k < 0.75) tx = -8 - Math.random() * 25;
        else T *= 0.5;
      }
    }
    aim(tx, ty, T);
    ball.netted = false;
    lastHitter = who; serveStage = -1; sideBounces = 0; rally++;
    p.swing = 1;
    sfx('paddle', 0.7 + power * 0.6);
    if (power > 0.65 && !reduced) shake = 5 * power;
    statusEl.textContent = rally >= 3 ? 'Rally ' + rally : '';
  }

  function award(winner, reason) {
    if (phase !== 'live') return;
    phase = 'dead';
    paddle(winner).pts++;
    popups.push({ text: reason, sub: winner === 'you' ? 'Your point' : 'Point CPU', t: 0 });
    sfx(winner === 'you' ? 'win' : 'lose');
    renderScore();
    pointDelay = 1.3;           // counted down in update(), so pausing freezes it too
  }

  function next() {
    var lead = you.pts - cpu.pts;
    if ((you.pts >= 11 || cpu.pts >= 11) && Math.abs(lead) >= 2) {
      phase = 'over';
      popups.push({ text: lead > 0 ? 'Game, you' : 'Game, CPU', sub: you.pts + ' – ' + cpu.pts, t: -1 });
      statusEl.textContent = lead > 0
        ? 'You took it ' + you.pts + '–' + cpu.pts + '. Space for a rematch.'
        : 'CPU wins ' + cpu.pts + '–' + you.pts + '. Space to play again.';
      return;
    }
    updateServer(); renderScore();
    phase = 'wait'; cpuServeIn = 1.1;
    var tag = '';
    if (you.pts >= 10 && cpu.pts >= 10 && lead === 0) tag = 'Deuce. ';
    else if (you.pts >= 10 && lead > 0) tag = 'Game point. ';
    else if (cpu.pts >= 10 && lead < 0) tag = 'Game point, CPU. ';
    statusEl.textContent = tag + (server === 'you' ? 'Your serve. Press Space or click.' : 'CPU to serve.');
  }

  function restart() {
    you.pts = cpu.pts = 0; popups = []; rings = []; rally = 0; pointDelay = 0;
    updateServer(); renderScore();
    phase = 'wait'; statusEl.textContent = 'Your serve. Press Space or click.';
  }

  var pauseBtn = document.getElementById('oob-pause');
  function setPaused(v) {
    if (v && phase === 'over') return;
    paused = v;
    pauseBtn.textContent = paused ? 'Resume' : 'Pause';
    pauseBtn.setAttribute('aria-pressed', paused ? 'true' : 'false');
    if (paused) keys = {};
  }
  pauseBtn.addEventListener('click', function () { setPaused(!paused); cv.focus(); });
  document.getElementById('oob-end').addEventListener('click', function () { setPaused(false); restart(); cv.focus(); });
  document.addEventListener('visibilitychange', function () { if (document.hidden && phase !== 'over') setPaused(true); });

  function tableBounce(sd) {
    var recv = other(lastHitter);
    if (serveStage === 0) { if (sd === lastHitter) { serveStage = 1; return; } return award(recv, 'Fault'); }
    if (serveStage === 1) { if (sd === recv) { serveStage = -1; sideBounces = 1; return; } return award(recv, ball.netted ? 'Net' : 'Fault'); }
    if (sd === lastHitter) return award(recv, ball.netted ? 'Net' : 'Fault');
    if (++sideBounces >= 2) award(lastHitter, 'Double bounce');
  }
  function ballDead() {
    if (serveStage === -1 && sideBounces >= 1) award(lastHitter, lastHitter === 'you' ? 'Winner' : 'Missed it');
    else award(other(lastHitter), ball.netted ? 'Net' : 'Out');
  }

  function tryHit(who) {
    if (phase !== 'live' || lastHitter === who || serveStage !== -1 || sideBounces < 1) return;
    var p = paddle(who), dx = ball.x - p.x, dy = ball.y - p.y;
    var reach = who === 'you' ? HIT_R : CPU_REACH;
    if (dx * dx + dy * dy < reach * reach && ball.z > -40 && ball.z < 55) strike(who);
  }

  function physics(h) {
    var px = ball.x, pz = ball.z;
    ball.vz -= G * h;
    ball.x += ball.vx * h; ball.y += ball.vy * h; ball.z += ball.vz * h;
    if (!ball.netted && (px - L / 2) * (ball.x - L / 2) < 0 && ball.z < NET_H && ball.z > -2 &&
        ball.y > -15.25 && ball.y < TW + 15.25) {
      ball.netted = true;
      ball.x = L / 2 - Math.sign(ball.vx) * 1.5;
      ball.vx *= -0.12; ball.vy *= 0.3; ball.vz = Math.min(ball.vz, 0) * 0.2;
      sfx('net');
    }
    if (ball.z <= 0 && pz > 0 && onTable(ball.x, ball.y)) {
      ball.z = 0; ball.vz = -ball.vz * BOUNCE;
      rings.push({ x: ball.x, y: ball.y, t: 0 });
      sfx('table', clamp(Math.abs(ball.vz) / 250, 0.3, 1));
      if (phase === 'live') tableBounce(sideOf(ball.x));
    }
    if (ball.z <= FLOOR) {
      ball.z = FLOOR; ball.vz = -ball.vz * 0.45; ball.vx *= 0.6; ball.vy *= 0.6;
      if (ball.vz > 40) sfx('floor', clamp(ball.vz / 200, 0.2, 1));
      if (phase === 'live') ballDead();
    }
    if (phase === 'live' && (ball.x < -170 || ball.x > L + 170 || ball.y < -120 || ball.y > TW + 120)) ballDead();
    tryHit('you'); tryHit('cpu');
  }

  // CPU looks ahead along the ball's path to where it can make contact
  function predict() {
    var b = { x: ball.x, y: ball.y, z: ball.z, vx: ball.vx, vy: ball.vy, vz: ball.vz }, h = 1 / 120;
    var bounced = serveStage === -1 && sideBounces >= 1;
    for (var i = 0; i < 480; i++) {
      var pz = b.z;
      b.vz -= G * h; b.x += b.vx * h; b.y += b.vy * h; b.z += b.vz * h;
      if (b.z <= 0 && pz > 0 && onTable(b.x, b.y)) { b.z = 0; b.vz = -b.vz * BOUNCE; if (b.x > L / 2) bounced = true; }
      if (bounced && (b.x >= L + 6 || (b.vz < 0 && b.z < 22 && b.x > L * 0.85))) return b;
      if (b.z < FLOOR) return null;
    }
    return null;
  }

  function movePaddle(p, tx, ty, maxV, dt, ease) {
    var nx, ny;
    if (ease) { nx = p.x + (tx - p.x) * Math.min(1, dt * 22); ny = p.y + (ty - p.y) * Math.min(1, dt * 22); }
    else {
      var dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy), m = Math.min(d, maxV * dt);
      nx = d ? p.x + dx / d * m : p.x; ny = d ? p.y + dy / d * m : p.y;
    }
    p.vx = p.vx * 0.5 + ((nx - p.x) / dt) * 0.5;
    p.vy = p.vy * 0.5 + ((ny - p.y) / dt) * 0.5;
    p.x = nx; p.y = ny;
  }

  function update(dt) {
    if (paused) return;
    // your paddle
    var kx = (keys.arrowright || keys.d ? 1 : 0) - (keys.arrowleft || keys.a ? 1 : 0);
    var ky = (keys.arrowdown || keys.s ? 1 : 0) - (keys.arrowup || keys.w ? 1 : 0);
    target.x += kx * 260 * dt; target.y += ky * 260 * dt;
    target.x = clamp(target.x, -80, 30); target.y = clamp(target.y, -40, TW + 40);
    movePaddle(you, target.x, target.y, 0, dt, true);

    // CPU paddle
    cpuThink -= dt;
    if (cpuThink <= 0) {
      cpuThink = 0.22;
      if (phase === 'live' && lastHitter === 'you') {
        var pr = predict();
        if (pr) { cpuAim.x = pr.x + 4; cpuAim.y = pr.y + (Math.random() - 0.5) * 28; }
      } else if (!(phase === 'wait' && server === 'cpu')) { cpuAim.x = L + 50; cpuAim.y = TW / 2; }
    }
    cpuAim.x = clamp(cpuAim.x, L - 30, L + 80);
    movePaddle(cpu, cpuAim.x, cpuAim.y, 160 + Math.min(rally, 10) * 3, dt, false);

    if (phase === 'wait') {
      holdBall();
      if (server === 'cpu') { cpuServeIn -= dt; if (cpuServeIn <= 0) doServe(); }
    } else {
      for (var i = 0; i < 4; i++) physics(dt / 4);
      if (phase === 'dead') { pointDelay -= dt; if (pointDelay <= 0) next(); }
    }

    you.swing = Math.max(0, you.swing - dt * 5);
    cpu.swing = Math.max(0, cpu.swing - dt * 5);
    rings.forEach(function (r) { r.t += dt; }); rings = rings.filter(function (r) { return r.t < 0.4; });
    popups.forEach(function (p) { if (p.t >= 0) p.t += dt; }); popups = popups.filter(function (p) { return p.t < 1.3; });
    shake *= Math.pow(0.002, dt);
    shakeX = (Math.random() - 0.5) * shake; shakeY = (Math.random() - 0.5) * shake;
  }

  // ---------- drawing ----------
  function poly(pts) {
    ctx.beginPath();
    pts.forEach(function (p, i) { var q = P(p[0], p[1], p[2]); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); });
    ctx.closePath();
  }
  function ellipseAt(x, y, z, rx, ry) {
    var q = P(x, y, z); ctx.beginPath(); ctx.ellipse(q[0], q[1], rx, ry, 0, 0, Math.PI * 2);
  }

  function drawFloor() {
    // No floor fill: the canvas is transparent so the table sits on the page.
    // Only the table's soft shadow is drawn.
    ctx.save();
    ctx.filter = 'blur(' + Math.round(10 * s) + 'px)';
    ctx.fillStyle = colors.dark ? 'rgba(0,0,0,0.45)' : 'rgba(40,30,20,0.18)';
    poly([[-6, -6, FLOOR], [L + 6, -6, FLOOR], [L + 6, TW + 6, FLOOR], [-6, TW + 6, FLOOR]]); ctx.fill();
    ctx.restore();
  }

  function drawShadow(x, y, z, size) {
    var surf = (onTable(x, y) && z >= -0.5) ? 0 : FLOOR;
    var hgt = Math.max(0, z - surf);
    var r = size * (1 + hgt * 0.012) * s;
    ctx.fillStyle = 'rgba(0,0,0,' + Math.max(0.06, 0.32 - hgt * 0.004) + ')';
    ellipseAt(x, y, surf, r, r * 0.55); ctx.fill();
  }

  function drawTable() {
    // legs
    ctx.strokeStyle = colors.dark ? '#77716A' : '#3a3632'; ctx.lineWidth = Math.max(2, 4 * s); ctx.lineCap = 'round';
    [[18, 14], [L - 18, 14], [18, TW - 14], [L - 18, TW - 14], [L / 2 - 6, TW - 14], [L / 2 + 6, TW - 14]].forEach(function (l) {
      var a = P(l[0], l[1], -3), b = P(l[0], l[1], FLOOR);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    });
    // edges
    ctx.fillStyle = TABLE_SIDE;
    poly([[0, TW, 0], [L, TW, 0], [L, TW, -4], [0, TW, -4]]); ctx.fill();
    poly([[L, 0, 0], [L, TW, 0], [L, TW, -4], [L, 0, -4]]); ctx.fill();
    // top
    var a = P(0, 0, 0), b = P(0, TW, 0);
    var g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
    g.addColorStop(0, TABLE_FAR); g.addColorStop(1, TABLE_TOP);
    ctx.fillStyle = g; poly([[0, 0, 0], [L, 0, 0], [L, TW, 0], [0, TW, 0]]); ctx.fill();
    var c = P(L * 0.42, TW * 0.4, 0);
    var sh = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], 160 * s);
    sh.addColorStop(0, 'rgba(255,255,255,0.10)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sh; poly([[0, 0, 0], [L, 0, 0], [L, TW, 0], [0, TW, 0]]); ctx.fill();
    // white lines
    ctx.strokeStyle = LINE; ctx.lineJoin = 'miter';
    ctx.lineWidth = Math.max(1.5, 2 * s);
    poly([[1, 1, 0], [L - 1, 1, 0], [L - 1, TW - 1, 0], [1, TW - 1, 0]]); ctx.stroke();
    ctx.lineWidth = Math.max(1, 0.8 * s);
    var m1 = P(0, TW / 2, 0), m2 = P(L, TW / 2, 0);
    ctx.beginPath(); ctx.moveTo(m1[0], m1[1]); ctx.lineTo(m2[0], m2[1]); ctx.stroke();
  }

  function drawNet() {
    var y0 = -15.25, y1 = TW + 15.25, x = L / 2;
    ctx.fillStyle = 'rgba(20,22,20,0.28)';
    poly([[x, y0, 0], [x, y1, 0], [x, y1, NET_H], [x, y0, NET_H]]); ctx.fill();
    ctx.strokeStyle = 'rgba(15,15,15,0.35)'; ctx.lineWidth = 1;
    for (var y = y0; y <= y1; y += 5) { var a = P(x, y, 0), b = P(x, y, NET_H); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    for (var z = 3; z < NET_H; z += 3) { var c = P(x, y0, z), d = P(x, y1, z); ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.stroke(); }
    ctx.strokeStyle = LINE; ctx.lineWidth = Math.max(2, 2.2 * s);
    var t1 = P(x, y0, NET_H), t2 = P(x, y1, NET_H);
    ctx.beginPath(); ctx.moveTo(t1[0], t1[1]); ctx.lineTo(t2[0], t2[1]); ctx.stroke();
    ctx.strokeStyle = colors.dark ? '#8A847C' : '#202020'; ctx.lineWidth = Math.max(2, 2.6 * s);
    [y0, y1].forEach(function (yy) { var a = P(x, yy, -3), b = P(x, yy, NET_H + 1); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); });
  }

  function drawPaddle(p, who) {
    var q = P(p.x, p.y, PADDLE_Z);
    var r = 12.5 * s * (1 + p.swing * 0.16);
    var tilt = clamp(p.vy, -400, 400) * 0.0006;
    ctx.save();
    ctx.translate(q[0], q[1]);
    ctx.rotate((who === 'you' ? Math.PI * 0.82 : Math.PI * 0.18) + tilt - (who === 'you' ? 1 : -1) * p.swing * 0.5);
    ctx.fillStyle = '#7A4E28';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(r * 0.7, -r * 0.24, r * 1.15, r * 0.48, r * 0.18);
    else ctx.rect(r * 0.7, -r * 0.24, r * 1.15, r * 0.48);
    ctx.fill();
    ctx.fillStyle = '#A9773F';
    ctx.fillRect(r * 0.8, -r * 0.08, r * 0.95, r * 0.16);
    ctx.restore();
    ctx.save();
    ctx.translate(q[0], q[1]);
    ctx.fillStyle = '#D8B07B';
    ctx.beginPath(); ctx.ellipse(0, 0, r * 1.07, r * 0.88, 0, 0, Math.PI * 2); ctx.fill();
    var g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    if (who === 'you') { g.addColorStop(0, '#E0483D'); g.addColorStop(1, '#A82720'); }
    else { g.addColorStop(0, '#3A3A3A'); g.addColorStop(1, '#151515'); }
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.81, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawBall() {
    var q = P(ball.x, ball.y, ball.z);
    var r = (3.3 + Math.max(0, ball.z) * 0.012) * s;
    trail.forEach(function (t, i) {
      ctx.fillStyle = 'rgba(255,255,255,' + (0.05 + i * 0.05) + ')';
      ctx.beginPath(); ctx.arc(t[0], t[1], r * (0.5 + i * 0.08), 0, Math.PI * 2); ctx.fill();
    });
    var g = ctx.createRadialGradient(q[0] - r * 0.35, q[1] - r * 0.35, r * 0.1, q[0], q[1], r);
    g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, '#E6E0D4');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 0.75; ctx.stroke();
    var speed = Math.hypot(ball.vx, ball.vy);
    if (reduced || speed < 250 || phase === 'wait') trail = [];
    else { trail.push(q); if (trail.length > 6) trail.shift(); }
  }

  function drawOverlay() {
    popups.forEach(function (p) {
      var t = Math.max(0, p.t), a = p.t < 0 ? 1 : Math.min(1, (1.3 - t) / 0.4);
      var y = cssH * 0.2 - t * 12;
      ctx.globalAlpha = a; ctx.textAlign = 'center';
      ctx.fillStyle = colors['--ink'];
      ctx.font = 'italic 750 ' + Math.round(cssW * 0.05) + 'px Newsreader, Georgia, serif';
      ctx.fillText(p.text, cssW / 2, y);
      ctx.fillStyle = colors['--ink-soft'];
      ctx.font = '625 ' + Math.max(11, Math.round(cssW * 0.014)) + 'px Archivo, sans-serif';
      ctx.fillText(p.sub.toUpperCase(), cssW / 2, y + cssW * 0.028);
      ctx.globalAlpha = 1;
    });
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    drawFloor();
    // things on the floor or below the far edge sit behind the table
    var ballUnder = ball.z < 0 && !onTable(ball.x, ball.y);
    if (ballUnder) drawShadow(ball.x, ball.y, ball.z, 3.3);
    [you, cpu].forEach(function (p) { if (!onTable(p.x, p.y)) drawShadow(p.x, p.y, PADDLE_Z, 11); });
    if (ballUnder && ball.y < 0) drawBall();
    drawTable();
    rings.forEach(function (r) {
      var k = r.t / 0.4, rr = (3 + k * 14) * s;
      ctx.strokeStyle = 'rgba(244,241,234,' + (0.7 * (1 - k)) + ')'; ctx.lineWidth = 1.2;
      ellipseAt(r.x, r.y, 0, rr, rr * 0.55); ctx.stroke();
    });
    if (!ballUnder) drawShadow(ball.x, ball.y, ball.z, 3.3);
    [you, cpu].forEach(function (p) { if (onTable(p.x, p.y)) drawShadow(p.x, p.y, PADDLE_Z, 11); });
    drawNet();
    var objs = [{ y: you.y, f: function () { drawPaddle(you, 'you'); } },
                { y: cpu.y, f: function () { drawPaddle(cpu, 'cpu'); } }];
    if (!(ballUnder && ball.y < 0)) objs.push({ y: ball.y, f: drawBall });
    objs.sort(function (a, b) { return a.y - b.y; }).forEach(function (o) { o.f(); });
    drawOverlay();
    if (paused) {
      ctx.globalAlpha = 0.7; ctx.fillStyle = colors['--bg']; ctx.fillRect(0, 0, cssW, cssH); ctx.globalAlpha = 1;
      ctx.textAlign = 'center'; ctx.fillStyle = colors['--ink'];
      ctx.font = 'italic 750 ' + Math.round(cssW * 0.055) + 'px Newsreader, Georgia, serif';
      ctx.fillText('Paused', cssW / 2, cssH * 0.47);
      ctx.fillStyle = colors['--ink-soft'];
      ctx.font = '625 ' + Math.max(11, Math.round(cssW * 0.014)) + 'px Archivo, sans-serif';
      ctx.fillText('PRESS ESC, SPACE OR CLICK TO RESUME', cssW / 2, cssH * 0.47 + cssW * 0.032);
    }
  }

  // ---------- input ----------
  function act() {
    audio();
    if (paused) return setPaused(false);
    if (phase === 'wait' && server === 'you') doServe();
    else if (phase === 'over') restart();
  }
  window.addEventListener('keydown', function (e) {
    var k = e.key.toLowerCase(), t = e.target;
    if (e.metaKey || e.ctrlKey || e.altKey) return;              // leave Cmd+K etc. to the palette
    if (t.closest && t.closest('dialog')) return;                 // palette is open
    if (k === 'escape' || k === 'p') { setPaused(!paused); return; }
    if (t.closest && t.closest('button, a')) return;              // Space/Enter keep working on buttons
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].indexOf(k) !== -1) e.preventDefault();
    if (k === ' ') act();
    keys[k] = true;
  });
  window.addEventListener('keyup', function (e) { keys[e.key.toLowerCase()] = false; });
  window.addEventListener('blur', function () { keys = {}; });
  function pointerTo(e) {
    var r = cv.getBoundingClientRect(), w = unproject(e.clientX - r.left, e.clientY - r.top);
    target.x = clamp(w.x, -80, 30); target.y = clamp(w.y, -40, TW + 40);
  }
  cv.addEventListener('pointermove', pointerTo);
  cv.addEventListener('pointerdown', function (e) { cv.focus(); cv.setPointerCapture(e.pointerId); pointerTo(e); act(); });

  document.getElementById('oob-sound').addEventListener('click', function () {
    muted = !muted;
    this.textContent = 'Sound: ' + (muted ? 'off' : 'on');
    this.setAttribute('aria-pressed', muted ? 'false' : 'true');
    if (!muted) audio();
  });

  var last = performance.now();
  function loop(now) {
    var dt = Math.min(0.033, (now - last) / 1000); last = now;
    update(dt); draw();
    requestAnimationFrame(loop);
  }
  updateServer(); renderScore();
  requestAnimationFrame(loop);
})();
