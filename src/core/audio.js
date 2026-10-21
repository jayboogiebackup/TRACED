// Every sound in the game is synthesised here with Web Audio — no audio files.
// (Optional override: drop a real clip at public/sounds/dashie.mp3.)

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.volume = 0.8;
    this.voiceEnabled = true;
    this.loops = {};
  }

  // must be called from a user gesture
  init() {
    if (this.ctx) {
      if (this.ctx.state !== 'running') this.ctx.resume();
      return;
    }
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 12;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    this.master.connect(comp).connect(ctx.destination);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.makeImpulse(2.8, 2.6);
    this.reverbOut = ctx.createGain();
    this.reverbOut.gain.value = 0.5;
    this.reverb.connect(this.reverbOut).connect(this.master);

    this.bus = {};
    for (const name of ['amb', 'sfx', 'ui', 'voice', 'music']) {
      const g = ctx.createGain();
      g.connect(this.master);
      const send = ctx.createGain();
      send.gain.value = name === 'ui' ? 0.05 : name === 'music' ? 0.35 : 0.28;
      g.connect(send).connect(this.reverb);
      this.bus[name] = g;
    }
    this.bus.ui.gain.value = 0.55;
    this.bus.music.gain.value = 0.0;

    // muffled "through the ceiling" bus for things happening upstairs
    this.upstairs = ctx.createBiquadFilter();
    this.upstairs.type = 'lowpass';
    this.upstairs.frequency.value = 420;
    this.upstairs.Q.value = 0.7;
    const upG = ctx.createGain();
    upG.gain.value = 1.4;
    this.upstairs.connect(upG).connect(this.bus.sfx);

    // telephone line: band-limited and a bit crunchy
    this.phoneLine = ctx.createBiquadFilter();
    this.phoneLine.type = 'bandpass';
    this.phoneLine.frequency.value = 1300;
    this.phoneLine.Q.value = 0.55;
    const crunch = ctx.createWaveShaper();
    crunch.curve = this.distCurve(18);
    const lineG = ctx.createGain();
    lineG.gain.value = 0.9;
    this.phoneLine.connect(crunch).connect(lineG).connect(this.bus.voice);

    this.buffers = {
      white: this.makeNoise('white', 3),
      pink: this.makeNoise('pink', 3),
      brown: this.makeNoise('brown', 4),
    };
    this.ready = true;
    this.prerender();
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  get now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  // ───────────────────────── building blocks ─────────────────────────
  makeNoise(kind, seconds) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (kind === 'white') d[i] = w;
        else if (kind === 'pink') {
          b0 = 0.99886 * b0 + w * 0.0555179;
          b1 = 0.99332 * b1 + w * 0.0750759;
          b2 = 0.969 * b2 + w * 0.153852;
          b3 = 0.8665 * b3 + w * 0.3104856;
          b4 = 0.55 * b4 + w * 0.5329522;
          b5 = -0.7616 * b5 - w * 0.016898;
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
          b6 = w * 0.115926;
        } else {
          last = (last + 0.02 * w) / 1.02;
          d[i] = last * 3.5;
        }
      }
    }
    return buf;
  }

  makeImpulse(seconds, decay) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        // early reflections off concrete + diffuse tail
        const er = i < ctx.sampleRate * 0.06 && Math.random() < 0.004 ? (Math.random() * 2 - 1) * 0.9 : 0;
        d[i] = ((Math.random() * 2 - 1) * Math.pow(1 - t, decay) + er) * 0.6;
      }
    }
    return buf;
  }

  distCurve(k) {
    const n = 1024;
    const c = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      c[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
    }
    return c;
  }

  env(param, t, a, peak, decay, sustain = 0.0001, hold = 0) {
    param.cancelScheduledValues(t);
    param.setValueAtTime(0.0001, t);
    param.linearRampToValueAtTime(peak, t + a);
    if (hold) param.setValueAtTime(peak, t + a + hold);
    param.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t + a + hold + decay);
  }

  osc(type, freq, t, dur, o = {}) {
    const ctx = this.ctx;
    const os = ctx.createOscillator();
    os.type = type;
    os.frequency.setValueAtTime(freq, t);
    if (o.freqEnd) os.frequency.exponentialRampToValueAtTime(o.freqEnd, t + (o.glide ?? dur));
    if (o.detune) os.detune.value = o.detune;
    const g = ctx.createGain();
    this.env(g.gain, t, o.attack ?? 0.005, o.gain ?? 0.2, dur, 0.0001, o.hold ?? 0);
    let node = os.connect(g);
    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = o.filter.type || 'lowpass';
      f.frequency.value = o.filter.freq;
      f.Q.value = o.filter.Q ?? 1;
      node = g.connect(f);
    }
    if (o.pan !== undefined) {
      const p = ctx.createStereoPanner();
      p.pan.value = o.pan;
      node = node.connect(p);
    }
    node.connect(o.dest || this.bus.sfx);
    os.start(t);
    os.stop(t + (o.attack ?? 0.005) + (o.hold ?? 0) + dur + 0.05);
    return os;
  }

  noise(t, dur, o = {}) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.buffers[o.color || 'white'];
    src.loop = true;
    if (o.rate) src.playbackRate.value = o.rate;
    const g = ctx.createGain();
    this.env(g.gain, t, o.attack ?? 0.003, o.gain ?? 0.2, dur, 0.0001, o.hold ?? 0);
    let node = src;
    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = o.filter.type || 'bandpass';
      f.frequency.setValueAtTime(o.filter.freq, t);
      if (o.filter.freqEnd) f.frequency.exponentialRampToValueAtTime(o.filter.freqEnd, t + dur);
      f.Q.value = o.filter.Q ?? 1;
      node = node.connect(f);
    }
    node = node.connect(g);
    if (o.pan !== undefined) {
      const p = ctx.createStereoPanner();
      p.pan.value = o.pan;
      node = node.connect(p);
    }
    node.connect(o.dest || this.bus.sfx);
    src.start(t, Math.random() * 2);
    src.stop(t + (o.attack ?? 0.003) + (o.hold ?? 0) + dur + 0.05);
    return src;
  }

  playBuffer(buf, o = {}) {
    if (!this.ready || !buf) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = !!o.loop;
    if (o.rate) src.playbackRate.value = o.rate;
    const g = this.ctx.createGain();
    g.gain.value = o.gain ?? 1;
    let node = src.connect(g);
    if (o.pan !== undefined) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = o.pan;
      node = node.connect(p);
    }
    node.connect(o.dest || this.bus.sfx);
    src.start(o.when ?? this.now);
    return { src, gain: g };
  }

  // things that are expensive to build every time get rendered offline once
  async prerender() {
    this.ringBuf = await this.renderOffline(2.15, (ctx, out) => {
      // electromechanical bell: clapper hits two gongs alternately at 20 Hz
      const gongA = [1176, 2612, 3984, 5320, 6920];
      const gongB = [1408, 3060, 4410, 5888];
      const strikes = 40;
      for (let i = 0; i < strikes; i++) {
        const t = i * 0.05;
        const parts = i % 2 ? gongA : gongB;
        parts.forEach((f, k) => {
          const os = ctx.createOscillator();
          os.type = 'sine';
          os.frequency.value = f * (1 + (Math.random() - 0.5) * 0.002);
          const g = ctx.createGain();
          const amp = (0.16 / (k + 1)) * (i === 0 ? 1.3 : 1);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(amp, t + 0.002);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25 + 0.12 / (k + 1));
          os.connect(g).connect(out);
          os.start(t);
          os.stop(t + 0.5);
        });
        // clapper click + the plastic shell rattling on the table
        const n = ctx.createBufferSource();
        n.buffer = this.buffers.white;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 220 + Math.random() * 80;
        bp.Q.value = 3;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.0001, t);
        ng.gain.linearRampToValueAtTime(0.5, t + 0.002);
        ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
        n.connect(bp).connect(ng).connect(out);
        n.start(t, Math.random());
        n.stop(t + 0.06);
      }
    });
  }

  async renderOffline(seconds, build) {
    const sr = this.ctx.sampleRate;
    const off = new OfflineAudioContext(2, Math.ceil(sr * seconds), sr);
    const out = off.createGain();
    out.connect(off.destination);
    // offline contexts can't share buffers made by the live context's helpers, so copy noise
    const saved = this.buffers;
    build(off, out);
    this.buffers = saved;
    return off.startRendering();
  }

  // ───────────────────────── ambience ─────────────────────────
  startDrone(intensity = 1) {
    if (!this.ready || this.loops.drone) return;
    const ctx = this.ctx;
    const t = this.now;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.5 * intensity, t + 4);
    out.connect(this.bus.amb);

    const rumble = ctx.createBufferSource();
    rumble.buffer = this.buffers.brown;
    rumble.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 160;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 70;
    lfo.connect(lfoG).connect(lp.frequency);
    const rg = ctx.createGain();
    rg.gain.value = 0.55;
    rumble.connect(lp).connect(rg).connect(out);

    const tones = [];
    for (const [f, g] of [
      [41.2, 0.13],
      [41.9, 0.11],
      [61.7, 0.05],
      [87.3, 0.025],
    ]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.value = g;
      o.connect(og).connect(out);
      o.start();
      tones.push(o);
    }
    // the faint high whine you hear in a silent room
    const whine = ctx.createOscillator();
    whine.frequency.value = 2873;
    const wg = ctx.createGain();
    wg.gain.value = 0.0;
    const wl = ctx.createOscillator();
    wl.frequency.value = 0.031;
    const wlg = ctx.createGain();
    wlg.gain.value = 0.0035;
    wl.connect(wlg).connect(wg.gain);
    whine.connect(wg).connect(out);
    whine.start();
    wl.start();

    rumble.start();
    lfo.start();
    const nodes = [rumble, lfo, whine, wl, ...tones];
    this.loops.drone = { out, nodes };

    // creaks, drips, distant clanks
    const tick = () => {
      if (!this.loops.drone) return;
      const r = Math.random();
      if (r < 0.45) this.creak();
      else if (r < 0.8) this.drip();
      else this.clank();
      this.loops.drone.timer = setTimeout(tick, rand(5000, 13000));
    };
    this.loops.drone.timer = setTimeout(tick, 4000);
  }

  setDrone(level, time = 2) {
    const d = this.loops.drone;
    if (d) d.out.gain.setTargetAtTime(Math.max(0.0001, level * 0.5), this.now, time / 3);
  }

  stopDrone(fade = 2) {
    const d = this.loops.drone;
    if (!d) return;
    clearTimeout(d.timer);
    d.out.gain.setTargetAtTime(0.0001, this.now, fade / 4);
    setTimeout(() => d.nodes.forEach((n) => n.stop()), fade * 1000 + 200);
    this.loops.drone = null;
  }

  creak(dest) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = this.now + 0.01;
    const dur = rand(0.5, 1.4);
    // stick-slip: a very low sawtooth with jittery rate through a woody resonance
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    const base = rand(18, 34);
    o.frequency.setValueAtTime(base, t);
    for (let i = 1; i < 8; i++) o.frequency.linearRampToValueAtTime(base * rand(0.6, 1.6), t + (dur * i) / 8);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(rand(500, 900), t);
    bp.frequency.linearRampToValueAtTime(rand(700, 1300), t + dur);
    bp.Q.value = 9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(rand(0.08, 0.16), t + dur * 0.3);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    const p = ctx.createStereoPanner();
    p.pan.value = rand(-0.8, 0.8);
    o.connect(bp).connect(g).connect(p).connect(dest || this.bus.amb);
    o.start(t);
    o.stop(t + dur + 0.1);
  }

  drip() {
    if (!this.ready) return;
    const t = this.now + 0.01;
    const f = rand(1400, 2200);
    this.osc('sine', f, t, 0.12, { gain: 0.07, freqEnd: f * 0.55, glide: 0.06, dest: this.bus.amb, pan: rand(-0.6, 0.6) });
  }

  clank() {
    if (!this.ready) return;
    const t = this.now + 0.01;
    const f = rand(180, 320);
    const pan = rand(-1, 1);
    [1, 2.31, 3.89, 5.43].forEach((r, i) =>
      this.osc('sine', f * r, t, 1.8 - i * 0.3, { gain: 0.035 / (i + 1), dest: this.bus.amb, pan }),
    );
    this.noise(t, 0.05, { gain: 0.06, filter: { type: 'bandpass', freq: 900, Q: 2 }, dest: this.bus.amb, pan });
  }

  // dim fluorescent / bulb buzz
  startBuzz() {
    if (!this.ready || this.loops.buzz) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 120;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 480;
    bp.Q.value = 4;
    const g = ctx.createGain();
    g.gain.value = 0.012;
    o.connect(bp).connect(g).connect(this.bus.amb);
    o.start();
    this.loops.buzz = { o, g };
  }
  setBuzz(v) {
    if (this.loops.buzz) this.loops.buzz.g.gain.setTargetAtTime(v * 0.012, this.now, 0.02);
  }

  // laptop + mining rigs
  startFans() {
    if (!this.ready || this.loops.fans) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.buffers.pink;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    src.connect(lp).connect(g).connect(this.bus.amb);
    const hum = ctx.createOscillator();
    hum.frequency.value = 118;
    const hg = ctx.createGain();
    hg.gain.value = 0.0001;
    hum.connect(hg).connect(this.bus.amb);
    const whine = ctx.createOscillator();
    whine.frequency.value = 6200;
    const wg = ctx.createGain();
    wg.gain.value = 0.0001;
    whine.connect(wg).connect(this.bus.amb);
    src.start();
    hum.start();
    whine.start();
    this.loops.fans = { g, lp, hg, wg, nodes: [src, hum, whine] };
    this.setFans(0.15);
  }
  setFans(load) {
    const f = this.loops.fans;
    if (!f) return;
    const t = this.now;
    f.g.gain.setTargetAtTime(0.04 + load * 0.22, t, 1.5);
    f.lp.frequency.setTargetAtTime(500 + load * 1400, t, 1.5);
    f.hg.gain.setTargetAtTime(0.004 + load * 0.03, t, 1.5);
    f.wg.gain.setTargetAtTime(load > 0.5 ? (load - 0.5) * 0.004 : 0.0001, t, 1.5);
  }

  // ───────────────────────── the phone ─────────────────────────
  ringOnce(gain = 0.55) {
    if (!this.ringBuf) return;
    this.playBuffer(this.ringBuf, { gain, dest: this.bus.sfx });
  }

  startRinging(gain = 0.55) {
    this.stopRinging();
    const loop = { alive: true };
    this.loops.ring = loop;
    const go = () => {
      if (!loop.alive) return;
      this.ringOnce(gain);
      loop.onRing && loop.onRing();
      loop.timer = setTimeout(go, 6000);
    };
    // the bell may still be rendering on the very first frame
    const begin = () => (this.ringBuf ? go() : setTimeout(begin, 50));
    begin();
    return loop;
  }
  stopRinging() {
    const r = this.loops.ring;
    if (r) {
      r.alive = false;
      clearTimeout(r.timer);
    }
    this.loops.ring = null;
  }

  pickup() {
    if (!this.ready) return;
    const t = this.now;
    this.noise(t, 0.05, { gain: 0.5, filter: { type: 'bandpass', freq: 900, Q: 1.2 } });
    this.osc('sine', 140, t, 0.12, { gain: 0.5, freqEnd: 55 });
    this.noise(t + 0.09, 0.015, { gain: 0.35, filter: { type: 'highpass', freq: 3000 } });
    this.noise(t + 0.22, 0.03, { gain: 0.25, filter: { type: 'bandpass', freq: 1800, Q: 2 } });
  }

  hangupClick() {
    if (!this.ready) return;
    const t = this.now;
    this.noise(t, 0.02, { gain: 0.5, filter: { type: 'bandpass', freq: 1500, Q: 1 }, dest: this.phoneLine });
    this.osc('square', 90, t, 0.05, { gain: 0.15, dest: this.phoneLine });
  }

  startLine() {
    if (!this.ready || this.loops.line) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.buffers.white;
    src.loop = true;
    const g = ctx.createGain();
    g.gain.value = 0.018;
    src.connect(g).connect(this.phoneLine);
    src.start();
    // crackle
    const loop = { src, g, alive: true };
    const crackle = () => {
      if (!loop.alive) return;
      const t = this.now;
      for (let i = 0; i < (Math.random() * 5) | 0; i++)
        this.noise(t + i * rand(0.01, 0.05), 0.006, { gain: rand(0.05, 0.25), dest: this.phoneLine });
      loop.timer = setTimeout(crackle, rand(200, 1400));
    };
    crackle();
    this.loops.line = loop;
  }
  stopLine() {
    const l = this.loops.line;
    if (!l) return;
    l.alive = false;
    clearTimeout(l.timer);
    l.src.stop();
    this.loops.line = null;
  }

  dialTone(dur = 4) {
    if (!this.ready) return;
    const t = this.now;
    this.osc('sine', 350, t, dur, { gain: 0.12, attack: 0.01, hold: dur - 0.2, dest: this.phoneLine });
    this.osc('sine', 440, t, dur, { gain: 0.12, attack: 0.01, hold: dur - 0.2, dest: this.phoneLine });
  }

  dialClick(n) {
    if (!this.ready) return;
    // rotary dial: the dial returns, pulsing n times
    const t = this.now + 0.05;
    this.noise(t - 0.05, 0.25, { gain: 0.06, filter: { type: 'bandpass', freq: 2400, Q: 3 } });
    for (let i = 0; i < n; i++) {
      this.noise(t + 0.25 + i * 0.1, 0.012, { gain: 0.25, filter: { type: 'bandpass', freq: 1600, Q: 4 } });
    }
    return 0.3 + n * 0.1;
  }

  breathOnLine(heavy = 0.5) {
    if (!this.ready) return;
    const t = this.now;
    this.noise(t, 1.2, { gain: 0.08 * heavy, attack: 0.6, filter: { type: 'bandpass', freq: 900, freqEnd: 1300, Q: 1.4 }, dest: this.phoneLine, color: 'pink' });
    this.noise(t + 1.3, 1.6, { gain: 0.1 * heavy, attack: 0.2, filter: { type: 'bandpass', freq: 1200, freqEnd: 600, Q: 1.2 }, dest: this.phoneLine, color: 'pink' });
  }

  // ───────────────────────── voices ─────────────────────────
  // Garbled formant "voice" used under subtitles (and when TTS is unavailable)
  babble(text, o = {}) {
    if (!this.ready) return 0;
    const dest = o.dest || this.phoneLine;
    const pitch = o.pitch ?? 92;
    const rate = o.rate ?? 0.075;
    const vowels = [
      [730, 1090],
      [270, 2290],
      [530, 1840],
      [570, 840],
      [300, 870],
      [640, 1190],
    ];
    let t = this.now + 0.02;
    const words = text.split(/\s+/).filter(Boolean);
    for (const w of words) {
      const syl = Math.max(1, Math.round(w.replace(/[^a-z]/gi, '').length / 3));
      for (let s = 0; s < syl; s++) {
        const [f1, f2] = pick(vowels);
        const dur = rate * rand(0.8, 1.6);
        const ctx = this.ctx;
        const os = ctx.createOscillator();
        os.type = 'sawtooth';
        const p = pitch * rand(0.9, 1.12);
        os.frequency.setValueAtTime(p, t);
        os.frequency.linearRampToValueAtTime(p * rand(0.85, 1.05), t + dur);
        const b1 = ctx.createBiquadFilter();
        b1.type = 'bandpass';
        b1.frequency.value = f1;
        b1.Q.value = 6;
        const b2 = ctx.createBiquadFilter();
        b2.type = 'bandpass';
        b2.frequency.value = f2;
        b2.Q.value = 8;
        const g = ctx.createGain();
        this.env(g.gain, t, 0.015, o.gain ?? 0.9, dur);
        os.connect(b1).connect(g);
        os.connect(b2).connect(g);
        g.connect(dest);
        os.start(t);
        os.stop(t + dur + 0.05);
        // consonant hiss
        if (Math.random() < 0.4) this.noise(t, 0.04, { gain: 0.08, filter: { type: 'highpass', freq: 3500 }, dest });
        t += dur;
      }
      t += rate * 0.6;
    }
    return t - this.now;
  }

  // Spoken lines through the browser's speech engine, pitched down.
  speak(text, o = {}) {
    return new Promise((resolve) => {
      const synth = window.speechSynthesis;
      if (!this.voiceEnabled || !synth) return resolve(false);
      const voice = this.pickVoice(o.female);
      if (!voice) return resolve(false);
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text.replace(/[*_]/g, ''));
      u.voice = voice;
      u.pitch = o.pitch ?? 0.15;
      u.rate = o.rate ?? 0.86;
      u.volume = Math.min(1, (o.volume ?? 0.9) * this.volume * 1.2);
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve(true);
      };
      u.onend = finish;
      u.onerror = finish;
      // some engines never fire onend
      setTimeout(finish, 1200 + text.length * 110);
      synth.speak(u);
    });
  }
  stopSpeaking() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }
  pickVoice(female) {
    const synth = window.speechSynthesis;
    if (!synth) return null;
    const voices = synth.getVoices().filter((v) => /^en/i.test(v.lang));
    if (!voices.length) return null;
    const local = voices.filter((v) => v.localService);
    const pool = local.length ? local : voices;
    const prefs = female
      ? [/zira/i, /samantha/i, /female/i, /victoria/i, /karen/i, /hazel/i]
      : [/david/i, /mark/i, /guy/i, /fred/i, /alex/i, /daniel/i, /male/i, /george/i];
    for (const re of prefs) {
      const v = pool.find((x) => re.test(x.name));
      if (v) return v;
    }
    return pool[0];
  }

  whisper(o = {}) {
    if (!this.ready) return;
    const t = this.now + 0.01;
    const pan = o.pan ?? rand(-1, 1);
    const n = 4 + ((Math.random() * 5) | 0);
    let tt = t;
    for (let i = 0; i < n; i++) {
      const d = rand(0.08, 0.22);
      const f = pick([700, 1100, 1700, 2400, 3200]);
      this.noise(tt, d, { gain: o.gain ?? 0.12, attack: 0.03, filter: { type: 'bandpass', freq: f, freqEnd: f * rand(0.8, 1.3), Q: 5 }, pan, color: 'pink' });
      if (Math.random() < 0.5) this.noise(tt, 0.06, { gain: (o.gain ?? 0.12) * 0.6, filter: { type: 'highpass', freq: 5000 }, pan });
      tt += d + rand(0, 0.06);
    }
  }

  // ───────────────────────── scares & cutscenes ─────────────────────────
  glitch(dur = 0.6, gain = 0.25) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = this.now;
    const o = ctx.createOscillator();
    o.type = 'square';
    for (let i = 0; i < dur * 40; i++) o.frequency.setValueAtTime(rand(60, 2400), t + i / 40);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain * 0.4, t);
    for (let i = 0; i < dur * 25; i++) g.gain.setValueAtTime(Math.random() < 0.6 ? gain * 0.4 : 0, t + i / 25);
    g.gain.setValueAtTime(0, t + dur);
    o.connect(g).connect(this.bus.sfx);
    o.start(t);
    o.stop(t + dur + 0.05);
    for (let i = 0; i < 6; i++)
      this.noise(t + rand(0, dur), rand(0.02, 0.09), { gain: gain * 0.8, filter: { type: 'bandpass', freq: rand(400, 6000), Q: 1 } });
  }

  tapeStop(dur = 1.4) {
    if (!this.ready) return;
    const t = this.now;
    [55, 82.4, 110, 164.8].forEach((f) =>
      this.osc('sawtooth', f, t, dur, { gain: 0.08, freqEnd: f * 0.08, glide: dur, attack: 0.01, filter: { type: 'lowpass', freq: 900 } }),
    );
    this.noise(t, dur, { gain: 0.1, filter: { type: 'lowpass', freq: 2000, freqEnd: 80 } });
  }

  impact(gain = 0.7) {
    if (!this.ready) return;
    const t = this.now;
    this.osc('sine', 90, t, 1.6, { gain, freqEnd: 28, glide: 1.2 });
    this.noise(t, 0.6, { gain: gain * 0.6, color: 'brown', filter: { type: 'lowpass', freq: 400 } });
    this.noise(t, 0.08, { gain: gain * 0.4, filter: { type: 'bandpass', freq: 2500, Q: 0.8 } });
  }

  // horror "stinger": dissonant swell
  stinger(gain = 0.25) {
    if (!this.ready) return;
    const t = this.now;
    [233.1, 246.9, 349.2, 493.9, 523.3].forEach((f, i) =>
      this.osc('sawtooth', f, t, 2.2, { gain: gain / 5, attack: 0.03, filter: { type: 'lowpass', freq: 2400 }, detune: rand(-12, 12), pan: (i - 2) * 0.3 }),
    );
    this.noise(t, 1.2, { gain: gain * 0.5, filter: { type: 'highpass', freq: 2000, freqEnd: 8000 } });
  }

  heartbeat(gain = 0.6) {
    if (!this.ready) return;
    const t = this.now;
    this.osc('sine', 62, t, 0.16, { gain, freqEnd: 38 });
    this.osc('sine', 55, t + 0.24, 0.2, { gain: gain * 0.7, freqEnd: 34 });
  }

  startHeart(bpm = 70, gain = 0.5) {
    this.stopHeart();
    const loop = { alive: true, bpm, gain };
    const go = () => {
      if (!loop.alive) return;
      this.heartbeat(loop.gain);
      loop.timer = setTimeout(go, 60000 / loop.bpm);
    };
    go();
    this.loops.heart = loop;
    return loop;
  }
  stopHeart() {
    if (this.loops.heart) {
      this.loops.heart.alive = false;
      clearTimeout(this.loops.heart.timer);
      this.loops.heart = null;
    }
  }

  startBreathing(rate = 0.25, gain = 0.12) {
    this.stopBreathing();
    const loop = { alive: true };
    const go = () => {
      if (!loop.alive) return;
      const t = this.now;
      this.noise(t, 1.1, { gain, attack: 0.7, filter: { type: 'bandpass', freq: 700, freqEnd: 1100, Q: 1.1 }, color: 'pink', dest: this.bus.amb });
      this.noise(t + 1.5, 1.4, { gain: gain * 1.2, attack: 0.15, filter: { type: 'bandpass', freq: 1000, freqEnd: 450, Q: 1 }, color: 'pink', dest: this.bus.amb });
      loop.timer = setTimeout(go, 1000 / rate);
    };
    go();
    this.loops.breath = loop;
  }
  stopBreathing() {
    if (this.loops.breath) {
      this.loops.breath.alive = false;
      clearTimeout(this.loops.breath.timer);
      this.loops.breath = null;
    }
  }

  siren(dist = 1, dur = 9) {
    // dist 1 = far away, 0 = outside the window
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = this.now;
    const o1 = ctx.createOscillator();
    o1.type = 'sawtooth';
    const o2 = ctx.createOscillator();
    o2.type = 'square';
    const cyc = 4.2;
    for (let k = 0; k * cyc < dur; k++) {
      const s = t + k * cyc;
      o1.frequency.setValueAtTime(620, s);
      o1.frequency.linearRampToValueAtTime(1480, s + cyc * 0.45);
      o1.frequency.linearRampToValueAtTime(620, s + cyc);
    }
    o2.frequency.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 600 + (1 - dist) * 3400;
    const g = ctx.createGain();
    const peak = 0.03 + (1 - dist) * 0.16;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 2.5);
    g.gain.setValueAtTime(peak, t + dur - 2.5);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    const p = ctx.createStereoPanner();
    p.pan.setValueAtTime(-0.7, t);
    p.pan.linearRampToValueAtTime(0.7, t + dur);
    o1.connect(lp).connect(g).connect(p).connect(this.bus.sfx);
    o1.start(t);
    o1.stop(t + dur + 0.1);
  }

  radio(text = 'unit twelve responding', o = {}) {
    if (!this.ready) return 0;
    const t = this.now;
    const ctx = this.ctx;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1600;
    bp.Q.value = 1.4;
    const ws = ctx.createWaveShaper();
    ws.curve = this.distCurve(40);
    const g = ctx.createGain();
    g.gain.value = o.gain ?? 0.55;
    bp.connect(ws).connect(g).connect(this.bus.sfx);
    this.noise(t, 0.12, { gain: 0.35, filter: { type: 'bandpass', freq: 2200, Q: 0.8 }, dest: bp });
    const len = this.babble(text, { dest: bp, pitch: o.pitch ?? 118, rate: 0.06, gain: 0.7 });
    this.noise(t + 0.1, len, { gain: 0.05, dest: bp });
    this.noise(t + len + 0.12, 0.18, { gain: 0.4, filter: { type: 'bandpass', freq: 2400, Q: 0.8 }, dest: bp });
    this.osc('sine', 1240, t + len + 0.32, 0.07, { gain: 0.12, dest: bp });
    return len + 0.5;
  }

  knock(n = 3, heavy = false) {
    if (!this.ready) return;
    const t = this.now;
    for (let i = 0; i < n; i++) {
      const s = t + i * (heavy ? 0.42 : 0.28) + rand(0, 0.03);
      this.osc('sine', heavy ? 95 : 140, s, 0.18, { gain: heavy ? 0.9 : 0.5, freqEnd: 60, dest: this.upstairs });
      this.noise(s, 0.09, { gain: heavy ? 0.9 : 0.5, filter: { type: 'bandpass', freq: 260, Q: 2 }, dest: this.upstairs });
    }
    if (heavy) this.noise(t, n * 0.42, { gain: 0.05, filter: { type: 'bandpass', freq: 3000, Q: 3 }, dest: this.upstairs });
  }

  footsteps(n = 6, interval = 0.55, gain = 0.5) {
    if (!this.ready) return;
    const t = this.now;
    for (let i = 0; i < n; i++) {
      const s = t + i * interval + rand(-0.04, 0.04);
      this.osc('sine', rand(70, 95), s, 0.12, { gain, freqEnd: 45, dest: this.upstairs });
      this.noise(s, 0.06, { gain: gain * 0.7, color: 'brown', filter: { type: 'lowpass', freq: 300 }, dest: this.upstairs });
      if (Math.random() < 0.25) setTimeout(() => this.creak(this.bus.sfx), (s - t) * 1000);
    }
  }

  doorKick() {
    if (!this.ready) return;
    const t = this.now;
    this.impact(1);
    this.noise(t, 0.9, { gain: 0.6, filter: { type: 'lowpass', freq: 1800, freqEnd: 200 } });
    for (let i = 0; i < 14; i++) this.noise(t + rand(0, 0.5), rand(0.005, 0.03), { gain: rand(0.2, 0.5), filter: { type: 'bandpass', freq: rand(1500, 5000), Q: 2 } });
    [310, 512, 777].forEach((f) => this.osc('triangle', f, t + 0.05, 1.2, { gain: 0.05 }));
  }

  // ───────────────────────── laptop & UI ─────────────────────────
  click(gain = 0.35) {
    if (!this.ready) return;
    const t = this.now;
    this.noise(t, 0.012, { gain, filter: { type: 'bandpass', freq: 3800, Q: 1.5 }, dest: this.bus.ui });
    this.osc('sine', 1900, t, 0.02, { gain: gain * 0.4, dest: this.bus.ui });
  }
  hover() {
    if (!this.ready) return;
    this.osc('sine', 2600, this.now, 0.012, { gain: 0.04, dest: this.bus.ui });
  }
  key() {
    if (!this.ready) return;
    const t = this.now;
    this.noise(t, 0.018, { gain: 0.25, filter: { type: 'bandpass', freq: rand(2500, 4800), Q: 2 }, dest: this.bus.ui });
    this.osc('sine', rand(180, 260), t, 0.03, { gain: 0.08, dest: this.bus.ui });
  }
  typeTick() {
    if (!this.ready) return;
    this.noise(this.now, 0.01, { gain: 0.06, filter: { type: 'bandpass', freq: rand(2800, 4200), Q: 3 }, dest: this.bus.ui });
  }
  open() {
    if (!this.ready) return;
    const t = this.now;
    this.osc('triangle', 520, t, 0.08, { gain: 0.12, dest: this.bus.ui });
    this.osc('triangle', 780, t + 0.06, 0.12, { gain: 0.1, dest: this.bus.ui });
  }
  close() {
    if (!this.ready) return;
    const t = this.now;
    this.osc('triangle', 700, t, 0.07, { gain: 0.1, dest: this.bus.ui });
    this.osc('triangle', 440, t + 0.05, 0.1, { gain: 0.08, dest: this.bus.ui });
  }
  notify() {
    if (!this.ready) return;
    const t = this.now;
    this.osc('sine', 988, t, 0.25, { gain: 0.14, dest: this.bus.ui });
    this.osc('sine', 1319, t + 0.11, 0.4, { gain: 0.12, dest: this.bus.ui });
  }
  creepyNotify() {
    if (!this.ready) return;
    const t = this.now;
    this.osc('sine', 466, t, 0.6, { gain: 0.14, dest: this.bus.ui });
    this.osc('sine', 494, t + 0.18, 0.9, { gain: 0.12, dest: this.bus.ui });
  }
  error() {
    if (!this.ready) return;
    const t = this.now;
    this.osc('square', 110, t, 0.18, { gain: 0.08, filter: { type: 'lowpass', freq: 900 }, dest: this.bus.ui });
    this.osc('square', 104, t + 0.2, 0.22, { gain: 0.08, filter: { type: 'lowpass', freq: 900 }, dest: this.bus.ui });
  }
  cash(big = false) {
    if (!this.ready) return;
    const t = this.now;
    // register bell + drawer + coins
    [2093, 2637, 3136].forEach((f, i) => this.osc('sine', f, t + 0.05, big ? 0.9 : 0.5, { gain: 0.07 / (i + 1), dest: this.bus.ui }));
    this.noise(t, 0.08, { gain: 0.18, filter: { type: 'bandpass', freq: 1200, Q: 1 }, dest: this.bus.ui });
    for (let i = 0; i < (big ? 8 : 3); i++) this.coin(t + 0.12 + i * rand(0.04, 0.09));
  }
  coin(t = this.now) {
    if (!this.ready) return;
    const f = rand(3800, 5200);
    this.osc('sine', f, t, 0.12, { gain: 0.05, dest: this.bus.ui });
    this.osc('sine', f * 1.5, t, 0.08, { gain: 0.03, dest: this.bus.ui });
  }
  win(level = 1) {
    if (!this.ready) return;
    const t = this.now;
    const notes = level > 1 ? [523, 659, 784, 1047, 1319, 1568] : [523, 659, 784, 1047];
    notes.forEach((f, i) => this.osc('square', f, t + i * 0.07, 0.22, { gain: 0.05, filter: { type: 'lowpass', freq: 3000 }, dest: this.bus.ui }));
    if (level > 1) this.cash(true);
  }
  lose() {
    if (!this.ready) return;
    const t = this.now;
    [392, 370, 349, 262].forEach((f, i) => this.osc('square', f, t + i * 0.14, 0.25, { gain: 0.05, filter: { type: 'lowpass', freq: 1400 }, dest: this.bus.ui }));
  }
  reelTick() {
    if (!this.ready) return;
    this.noise(this.now, 0.01, { gain: 0.1, filter: { type: 'bandpass', freq: 2000, Q: 4 }, dest: this.bus.ui });
  }
  boom() {
    if (!this.ready) return;
    const t = this.now;
    this.noise(t, 0.7, { gain: 0.4, color: 'brown', filter: { type: 'lowpass', freq: 900, freqEnd: 100 }, dest: this.bus.ui });
    this.osc('sine', 120, t, 0.5, { gain: 0.3, freqEnd: 30, dest: this.bus.ui });
  }
  squelch() {
    if (!this.ready) return;
    const t = this.now;
    // a wet organ-shaped noise. you're welcome
    for (let i = 0; i < 3; i++)
      this.noise(t + i * 0.09, 0.14, { gain: 0.25, color: 'pink', filter: { type: 'bandpass', freq: rand(300, 700), freqEnd: rand(150, 1200), Q: 6 }, dest: this.bus.ui });
    this.osc('sine', 180, t, 0.25, { gain: 0.15, freqEnd: 70, dest: this.bus.ui });
  }
  blip(f = 880, d = 0.05, g = 0.06) {
    if (!this.ready) return;
    this.osc('square', f, this.now, d, { gain: g, filter: { type: 'lowpass', freq: 3500 }, dest: this.bus.ui });
  }
  powerUp() {
    if (!this.ready) return;
    const t = this.now;
    this.osc('sawtooth', 60, t, 1.2, { gain: 0.06, freqEnd: 240, glide: 1, filter: { type: 'lowpass', freq: 800 } });
    this.noise(t, 1.5, { gain: 0.05, filter: { type: 'bandpass', freq: 400, freqEnd: 3000, Q: 2 } });
  }
  bootChime() {
    if (!this.ready) return;
    const t = this.now;
    // a minor chord that doesn't quite resolve
    [146.8, 174.6, 220, 277.2, 349.2].forEach((f, i) =>
      this.osc('triangle', f, t + i * 0.09, 3.2, { gain: 0.045, attack: 0.3, filter: { type: 'lowpass', freq: 1800 }, pan: (i - 2) * 0.25 }),
    );
    [587.3, 880].forEach((f, i) => this.osc('sine', f, t + 0.5 + i * 0.2, 2.5, { gain: 0.03 }));
  }
  rat() {
    if (!this.ready) return;
    const t = this.now;
    const pan = rand(-1, 1);
    for (let i = 0; i < 3; i++) {
      const s = t + i * rand(0.08, 0.16);
      this.osc('sine', rand(3200, 4400), s, 0.06, { gain: 0.04, freqEnd: rand(4000, 5600), glide: 0.04, pan, dest: this.bus.amb });
    }
    this.noise(t + 0.3, 0.5, { gain: 0.03, filter: { type: 'highpass', freq: 3000 }, pan, dest: this.bus.amb });
  }
  ekg(on = true) {
    if (!this.ready) return;
    if (!on) {
      this.osc('sine', 980, this.now, 0.1, { gain: 0.12 });
      return;
    }
    this.osc('sine', 980, this.now, 6, { gain: 0.12, hold: 5, attack: 0.01 });
  }
  quack() {
    if (!this.ready) return;
    const t = this.now;
    this.osc('sawtooth', 560, t, 0.16, { gain: 0.1, freqEnd: 380, filter: { type: 'bandpass', freq: 1100, Q: 3 }, dest: this.bus.ui });
  }

  // ───────────────────────── tension score ─────────────────────────
  // A pulse that speeds up and a dissonant pad that swells as the police get closer.
  startScore() {
    if (!this.ready || this.loops.score) return;
    const ctx = this.ctx;
    const pad = ctx.createGain();
    pad.gain.value = 0.0001;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 500;
    pad.connect(lp).connect(this.bus.music);
    const oscs = [];
    for (const f of [73.4, 77.8, 110, 116.5, 155.6]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = rand(-8, 8);
      o.connect(pad);
      o.start();
      oscs.push(o);
    }
    const s = { pad, lp, oscs, level: 0, next: this.now + 0.5, beat: 0, alive: true };
    const tick = () => {
      if (!s.alive) return;
      const bpm = 52 + s.level * 80;
      while (s.next < this.now + 0.2) {
        const t = s.next;
        const accent = s.beat % 4 === 0;
        this.osc('sine', accent ? 49 : 55, t, 0.28, { gain: 0.25 + s.level * 0.25, freqEnd: 36, dest: this.bus.music });
        if (s.level > 0.55 && s.beat % 2 === 1)
          this.noise(t, 0.03, { gain: 0.04 + s.level * 0.05, filter: { type: 'highpass', freq: 6000 }, dest: this.bus.music });
        if (s.level > 0.8) this.osc('sine', 1760, t, 0.03, { gain: 0.02, dest: this.bus.music });
        s.beat++;
        s.next += 60 / bpm;
      }
      s.timer = setTimeout(tick, 50);
    };
    tick();
    this.loops.score = s;
    this.bus.music.gain.setTargetAtTime(1, this.now, 2);
  }
  setScore(level) {
    const s = this.loops.score;
    if (!s) return;
    s.level = level;
    s.pad.gain.setTargetAtTime(0.004 + level * level * 0.05, this.now, 1);
    s.lp.frequency.setTargetAtTime(300 + level * 1600, this.now, 1);
  }
  stopScore(fade = 1) {
    const s = this.loops.score;
    if (!s) return;
    s.alive = false;
    clearTimeout(s.timer);
    s.pad.gain.setTargetAtTime(0.0001, this.now, fade / 3);
    setTimeout(() => s.oscs.forEach((o) => o.stop()), fade * 1000 + 300);
    this.loops.score = null;
  }

  // ───────────────────────── easter egg ─────────────────────────
  async dashie() {
    if (!this.ready) return;
    if (this.dashieBuf === undefined) {
      this.dashieBuf = null;
      try {
        const res = await fetch('sounds/dashie.mp3');
        if (res.ok && (res.headers.get('content-type') || '').includes('audio')) {
          this.dashieBuf = await this.ctx.decodeAudioData(await res.arrayBuffer());
        }
      } catch (e) {
        /* no clip supplied — synthesise one */
      }
    }
    if (this.dashieBuf) {
      this.playBuffer(this.dashieBuf, { gain: 1, dest: this.bus.ui });
      return;
    }
    // air horn + hype
    const t = this.now;
    [0, 0.32, 0.64].forEach((d, k) =>
      [466, 554, 698].forEach((f) =>
        this.osc('sawtooth', f, t + d, k === 2 ? 0.7 : 0.22, { gain: 0.05, freqEnd: f * 0.97, filter: { type: 'lowpass', freq: 3500 }, dest: this.bus.ui }),
      ),
    );
    const synth = window.speechSynthesis;
    if (synth) {
      synth.cancel();
      const v = this.pickVoice(false);
      const a = new SpeechSynthesisUtterance('Whaaaaaaaaat\'s up!');
      const b = new SpeechSynthesisUtterance("It's Dashie!");
      for (const u of [a, b]) {
        if (v) u.voice = v;
        u.volume = Math.min(1, this.volume * 1.2);
      }
      a.rate = 0.62;
      a.pitch = 1.7;
      b.rate = 1.25;
      b.pitch = 1.5;
      synth.speak(a);
      synth.speak(b);
    }
  }
}

export const audio = new AudioEngine();
