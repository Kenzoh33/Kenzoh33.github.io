// About page turntable: spins the record and plays five old-school hip-hop
// beats synthesized live with the Web Audio API. No audio files are loaded.
// Browsers only allow sound after the visitor interacts with the page, so it
// tries to start on load and otherwise starts on the first click or keypress.
(function () {
  var root = document.querySelector('.turntable');
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!root || !AC) return; // buttons stay disabled: a still drawing, no dead controls

  var deck = root.querySelector('.turntable-deck');
  var nextBtn = root.querySelector('.turntable-next');
  var title = root.querySelector('.turntable-title');
  var record = root.querySelector('.record');
  var bars = root.querySelectorAll('.turntable-bars span');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  deck.disabled = false;
  nextBtn.disabled = false;

  // ---- Beats. Patterns are 32 sixteenth-notes (2 bars):
  // "x" = hit, "o" = soft hit (ghost note), "." = rest.
  // roots: one bass note per bar, cycling every 4 bars.
  var BEATS = [
    {
      name: 'boom-bap', bpm: 90, swing: 0.33, label: '#2F4B3C', crackle: true,
      kick:  'x.....x.x.......x.....x.x.x.....',
      snare: '....x.......x.......x.......x...',
      hat:   'x.x.x.x.x.x.x.x.x.x.x.x.x.x.x...',
      open:  '..............................x.',
      bass:  'x.....x.x.......x.....x.x.x.....',
      roots: [110.0, 87.31, 130.81, 98.0]
    },
    {
      name: 'breakbeat', bpm: 96, swing: 0.2, label: '#4E7560', crackle: true,
      kick:  'x.x.......x.....x.x.......x..x..',
      snare: '....x..o.o..x..o....x..o.o..x.o.',
      hat:   'xoxoxoxoxoxoxoxoxoxoxoxoxoxoxoxo',
      bass:  'x.....x...x.....x.....x...x.....',
      roots: [82.41, 73.42, 98.0, 110.0]
    },
    {
      name: '808 electro', bpm: 110, swing: 0, label: '#6B6560',
      boom:  'x.....x...x.....x.....x...x..x..',
      clap:  '....x.......x.......x.......x...',
      bell:  '..x.....x.x.......x.....x.x..x..',
      hat:   'xoxoxoxoxoxoxoxoxoxoxoxoxoxoxoxo'
    },
    {
      name: 'jazz loop', bpm: 86, swing: 0.4, label: '#8A7A5C', crackle: true,
      kick:  'o.........o.....o.........o.....',
      rim:   '....x.......x.......x.......x..o',
      hat:   'o.o.o.o.o.o.o.o.o.o.o.o.o.o.o.o.',
      bass:  'x.......x.......x.......x.......',
      roots: [73.42, 98.0, 65.41, 110.0],
      keys:  'x..........x....x..........x....',
      chords: [
        [146.83, 174.61, 220.0, 261.63], // Dm7
        [196.0, 246.94, 293.66, 349.23], // G7
        [130.81, 164.81, 196.0, 246.94], // Cmaj7
        [110.0, 130.81, 164.81, 196.0]   // Am7
      ]
    },
    {
      name: 'g-funk', bpm: 94, swing: 0.15, label: '#3F5F58',
      kick:  'x......x..x.....x......x..x.....',
      clap:  '....x.......x.......x.......x...',
      hat:   'x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.',
      bass:  'x..x......x.x...x..x......x.x...',
      roots: [82.41, 82.41, 110.0, 123.47],
      // [step, frequency, length in steps]; each note slides from the last one
      lead: [[0, 659.25, 6], [8, 783.99, 4], [12, 739.99, 4], [16, 659.25, 8], [26, 587.33, 6]]
    }
  ];
  var BARS_PER_BEAT = 16;
  var VOLUME = 0.2;

  // ---- Record spin: 33 1/3 rpm is one turn per 1.8s. Speed eases toward
  // its target, so the record spins up on load and winds down on pause.
  var RPM_DEG = 360 / 1.8;
  var angle = 0, speed = 0, target = reduced ? 0 : RPM_DEG;
  var last = null, looping = false, playing = false;

  function frame(now) {
    if (last !== null) {
      var dt = Math.min((now - last) / 1000, 0.1);
      speed += (target - speed) * Math.min(dt * 4, 1);
      angle = (angle + speed * dt) % 360;
      record.setAttribute('transform', 'rotate(' + angle.toFixed(2) + ' 82 80)');
    }
    last = now;
    if (playing) drawBars();
    if (playing || target > 0 || speed > 0.5) {
      requestAnimationFrame(frame);
    } else {
      looping = false;
      last = null;
    }
  }
  function startLoop() {
    if (reduced || looping) return;
    looping = true;
    requestAnimationFrame(frame);
  }
  startLoop();

  // ---- Audio graph: instruments -> master gain -> compressor -> analyser -> speakers
  var ctx, master, analyser, freq, noiseBuf, timer, nextTime;
  var beatIndex = 0, step = 0, leadHz = 0;
  var BAR_BINS = [1, 2, 4, 8, 16, 32, 48]; // log-spaced analyser bins, low to high

  function setup() {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0;
    var comp = ctx.createDynamicsCompressor();
    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.7;
    freq = new Uint8Array(analyser.frequencyBinCount);
    master.connect(comp);
    comp.connect(analyser);
    analyser.connect(ctx.destination);

    // One second of white noise, reused by every noise-based drum.
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    var data = noiseBuf.getChannelData(0);
    for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }

  // ---- Instruments
  function decay(gain, t, peak, length) {
    gain.gain.setValueAtTime(peak, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + length);
  }

  function tone(t, type, hz, peak, length) {
    var osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = hz;
    decay(gain, t, peak, length);
    osc.connect(gain); gain.connect(master);
    osc.start(t); osc.stop(t + length + 0.02);
    return osc;
  }

  function noise(t, type, hz, peak, length) {
    var src = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    src.buffer = noiseBuf;
    filter.type = type;
    filter.frequency.value = hz;
    decay(gain, t, peak, length);
    src.connect(filter); filter.connect(gain); gain.connect(master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + length + 0.02);
  }

  function kick(t, v, long) {
    // A sine whose pitch drops fast is the "boom"; the 808 version rings longer.
    var osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.frequency.setValueAtTime(long ? 120 : 150, t);
    osc.frequency.exponentialRampToValueAtTime(long ? 40 : 45, t + (long ? 0.2 : 0.12));
    decay(gain, t, v, long ? 0.9 : 0.4);
    osc.connect(gain); gain.connect(master);
    osc.start(t); osc.stop(t + (long ? 0.95 : 0.42));
  }

  function snare(t, v) {
    noise(t, 'highpass', 1200, 0.5 * v, 0.2);
    tone(t, 'triangle', 180, 0.4 * v, 0.1);
  }

  function clap(t) {
    // Several hands a few milliseconds apart.
    noise(t, 'bandpass', 1500, 0.4, 0.02);
    noise(t + 0.012, 'bandpass', 1500, 0.4, 0.02);
    noise(t + 0.024, 'bandpass', 1500, 0.5, 0.15);
  }

  function rim(t, v) {
    tone(t, 'triangle', 1700, 0.3 * v, 0.03);
    noise(t, 'highpass', 3000, 0.2 * v, 0.02);
  }

  function cowbell(t) {
    var filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    filter.type = 'bandpass';
    filter.frequency.value = 800;
    decay(gain, t, 0.25, 0.3);
    filter.connect(gain); gain.connect(master);
    [540, 800].forEach(function (hz) {
      var osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = hz;
      osc.connect(filter);
      osc.start(t); osc.stop(t + 0.32);
    });
  }

  function hat(t, v, open) {
    noise(t, 'highpass', 7000, (open ? 0.12 : 0.09) * v, open ? 0.25 : 0.04);
  }

  function bass(t, hz, length) {
    var osc = ctx.createOscillator(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = hz;
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.5, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + length);
    osc.connect(filter); filter.connect(gain); gain.connect(master);
    osc.start(t); osc.stop(t + length + 0.02);
  }

  function keys(t, chord) {
    // Electric-piano-ish: each note is a pair of slightly detuned sines.
    var filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1800;
    filter.connect(master);
    chord.forEach(function (hz) {
      [-4, 4].forEach(function (cents) {
        var osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.frequency.value = hz;
        osc.detune.value = cents;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.05, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
        osc.connect(gain); gain.connect(filter);
        osc.start(t); osc.stop(t + 1.45);
      });
    });
  }

  function lead(t, hz, length) {
    // The G-funk whistle: a sine that slides into each note, with vibrato.
    var osc = ctx.createOscillator(), gain = ctx.createGain();
    var lfo = ctx.createOscillator(), depth = ctx.createGain();
    osc.frequency.setValueAtTime(leadHz || hz, t);
    osc.frequency.exponentialRampToValueAtTime(hz, t + 0.09);
    lfo.frequency.value = 6;
    depth.gain.value = hz * 0.012;
    lfo.connect(depth); depth.connect(osc.frequency);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.12, t + 0.04);
    gain.gain.setValueAtTime(0.12, t + length * 0.8);
    gain.gain.exponentialRampToValueAtTime(0.001, t + length);
    osc.connect(gain); gain.connect(master);
    osc.start(t); osc.stop(t + length + 0.02);
    lfo.start(t); lfo.stop(t + length + 0.02);
    leadHz = hz;
  }

  function hit(pattern, i) {
    if (!pattern) return 0;
    var c = pattern.charAt(i);
    return c === 'x' ? 1 : c === 'o' ? 0.4 : 0;
  }

  // ---- Look-ahead scheduler: a 25ms timer queues every note due in the next
  // 100ms on the audio clock, so timing stays tight even if the page is busy.
  function schedule() {
    while (nextTime < ctx.currentTime + 0.1) {
      if (step > 0 && step % (16 * BARS_PER_BEAT) === 0) selectBeat(beatIndex + 1);
      var beat = BEATS[beatIndex];
      var sixteenth = 60 / beat.bpm / 4;
      var i = step % 32;
      var bar = Math.floor(step / 16) % 4;
      var t = nextTime + (i % 4 === 2 ? sixteenth * beat.swing : 0);
      var v;

      if ((v = hit(beat.kick, i))) kick(t, v, false);
      if (hit(beat.boom, i)) kick(t, 1, true);
      if ((v = hit(beat.snare, i))) snare(t, v);
      if (hit(beat.clap, i)) clap(t);
      if ((v = hit(beat.rim, i))) rim(t, v);
      if (hit(beat.bell, i)) cowbell(t);
      if ((v = hit(beat.hat, i))) hat(t, v, false);
      if (hit(beat.open, i)) hat(t, 1, true);
      if (hit(beat.bass, i)) bass(t, beat.roots[bar], sixteenth * 5);
      if (hit(beat.keys, i)) keys(t, beat.chords[bar]);
      if (beat.lead) {
        beat.lead.forEach(function (n) {
          if (n[0] === i) lead(t, n[1], n[2] * sixteenth);
        });
      }
      if (beat.crackle && Math.random() < 0.2) noise(t + Math.random() * sixteenth, 'highpass', 2500, 0.03, 0.01);

      nextTime += sixteenth;
      step++;
    }
  }

  function selectBeat(index) {
    beatIndex = (index + BEATS.length) % BEATS.length;
    step = 0;
    leadHz = 0;
    var beat = BEATS[beatIndex];
    title.textContent = '0' + (beatIndex + 1) + ' · ' + beat.name + ' · ' + beat.bpm + ' BPM';
    root.style.setProperty('--label', beat.label);
  }

  function drawBars() {
    analyser.getByteFrequencyData(freq);
    for (var i = 0; i < bars.length; i++) {
      var level = Math.max(0.06, freq[BAR_BINS[i]] / 255);
      bars[i].style.transform = 'scaleY(' + level.toFixed(3) + ')';
    }
  }

  function setPlaying(on) {
    playing = on;
    root.classList.toggle('is-playing', on);
    deck.setAttribute('aria-pressed', on ? 'true' : 'false');
    deck.setAttribute('aria-label', (on ? 'Pause' : 'Play') + ' the beat');
    target = on && !reduced ? RPM_DEG : 0;
    if (on) {
      startLoop();
    } else {
      for (var i = 0; i < bars.length; i++) bars[i].style.transform = '';
    }
  }

  function play() {
    if (playing) return;
    if (!ctx) setup();
    ctx.resume();
    var now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(0, now);
    master.gain.linearRampToValueAtTime(VOLUME, now + 1); // fade in, never a jolt
    step = 0;
    nextTime = now + 0.05;
    schedule();
    timer = setInterval(schedule, 25);
    setPlaying(true);
  }

  function pause() {
    if (!playing) return;
    clearInterval(timer);
    ctx.suspend();
    setPlaying(false);
  }

  // ---- Remember a visitor's pause (their browser only), so it never
  // auto-starts on them again. Storage can be blocked, so guard every access.
  var STORE_KEY = 'turntable-paused';
  function pausedBefore() {
    try { return localStorage.getItem(STORE_KEY) === '1'; } catch (e) { return false; }
  }
  function rememberPause(on) {
    try {
      if (on) localStorage.setItem(STORE_KEY, '1');
      else localStorage.removeItem(STORE_KEY);
    } catch (e) { /* private mode or storage disabled: just don't remember */ }
  }

  // ---- Auto-start: try now; if the browser blocks sound, start on the first
  // click or keypress anywhere else on the page.
  function firstInteraction(e) {
    if (root.contains(e.target)) return; // the turntable's own buttons handle themselves
    disarm();
    play();
  }
  function disarm() {
    document.removeEventListener('pointerdown', firstInteraction, true);
    document.removeEventListener('keydown', firstInteraction, true);
  }

  if (!pausedBefore()) {
    setup();
    ctx.resume().then(function () {
      if (ctx.state === 'running' && !playing) { disarm(); play(); }
    });
    document.addEventListener('pointerdown', firstInteraction, true);
    document.addEventListener('keydown', firstInteraction, true);
  }

  // ---- Controls
  deck.addEventListener('click', function () {
    disarm();
    if (playing) { pause(); rememberPause(true); }
    else { play(); rememberPause(false); }
  });

  nextBtn.addEventListener('click', function () {
    disarm();
    selectBeat(beatIndex + 1);
    if (playing) {
      nextTime = ctx.currentTime + 0.05;
    } else {
      play();
      rememberPause(false);
    }
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) pause();
  });

  selectBeat(0);
})();
