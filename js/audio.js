/* ============================================================
   audio.js — WebAudio synth SFX + procedural synthwave score
   No external assets. Everything is generated on the fly.
   ============================================================ */
(function () {
  'use strict';
  const G = window.G;
  const U = G.U;

  const A = (G.Audio = {
    ctx: null,
    master: null,
    sfxBus: null,
    musicBus: null,
    ready: false,
    muted: false,
    sfxVol: 0.7,
    musicVol: 0.34,
    noiseBuf: null,
    laserOsc: null,
    laserGain: null,
    mood: 'none',
    _nextNote: 0,
    _step: 0,
    _timer: null,
    _lastSfx: {},
    samples: {},
  });

  // Existing open-source UI samples (Kenney UI Audio, CC0). The synth is still
  // the fallback and handles every gameplay sound.
  const SAMPLE_MAP = {
    ui: 'click1.ogg',
    ui2: 'switch1.ogg',
    deny: 'switch2.ogg',
    hover: 'rollover1.ogg',
  };

  A.loadSamples = function () {
    if (typeof Audio === 'undefined') return;
    for (const key in SAMPLE_MAP) {
      const file = SAMPLE_MAP[key];
      if (A.samples[file]) continue;
      try {
        const a = new Audio('assets/audio/kenney/' + file);
        a.preload = 'auto';
        a.volume = 0;
        A.samples[file] = a;
      } catch (e) { /* keep synth fallback */ }
    }
  };

  A.playSample = function (file) {
    const base = A.samples[file];
    if (!base) return false;
    try {
      const a = base.cloneNode();
      a.volume = Math.max(0, Math.min(1, A.sfxVol * 0.55));
      a.currentTime = 0;
      const p = a.play();
      if (p && p.catch) p.catch(() => {});
      return true;
    } catch (e) {
      return false;
    }
  };

  A.loadSamples();

  const NOTE = {
    A1: 55.0, C2: 65.41, D2: 73.42, E2: 82.41, F2: 87.31, G2: 98.0,
    A2: 110.0, B2: 123.47, C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0,
    A3: 220.0, B3: 246.94, C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0,
    A4: 440.0, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99,
    A5: 880.0, C6: 1046.5, E6: 1318.5, G6: 1568.0,
  };

  A.init = function () {
    if (A.ready) {
      if (A.ctx.state === 'suspended') A.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    try {
      A.ctx = new Ctx();
    } catch (e) {
      return;
    }
    A.master = A.ctx.createGain();
    A.master.gain.value = A.muted ? 0 : 0.8;
    A.master.connect(A.ctx.destination);
    A.sfxBus = A.ctx.createGain();
    A.sfxBus.gain.value = A.sfxVol;
    A.sfxBus.connect(A.master);
    A.musicBus = A.ctx.createGain();
    A.musicBus.gain.value = A.musicVol;
    A.musicBus.connect(A.master);

    // a touch of room: soften the top end
    const comp = A.ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 22;
    comp.ratio.value = 5;
    comp.attack.value = 0.004;
    comp.release.value = 0.22;
    A.master.disconnect();
    A.master.connect(comp);
    comp.connect(A.ctx.destination);

    const len = A.ctx.sampleRate * 1.0;
    A.noiseBuf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
    const data = A.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    A.ready = true;
    if (A.ctx.state === 'suspended') A.ctx.resume();
    A._startSequencer();
    if (A.mood === 'none') A.setMood('menu');
    else {
      const m = A.mood;
      A.mood = 'none';
      A.setMood(m);
    }
  };

  A.setSfx = function (v) {
    A.sfxVol = U.clamp(v, 0, 1);
    if (A.sfxBus) A.sfxBus.gain.value = A.sfxVol;
  };
  A.setMusic = function (v) {
    A.musicVol = U.clamp(v, 0, 1);
    if (A.musicBus) A.musicBus.gain.value = A.musicVol * 0.75;
  };
  A.setMuted = function (m) {
    A.muted = !!m;
    if (A.master) A.master.gain.value = A.muted ? 0 : 0.8;
  };
  A.toggleMute = function () {
    A.setMuted(!A.muted);
    return A.muted;
  };

  // ---------------- primitives ----------------
  function now() { return A.ctx.currentTime; }

  function noise(dur, gainAmt, filterType, freq, q, t0, sweepTo) {
    if (!A.ready) return;
    const t = t0 || now();
    const src = A.ctx.createBufferSource();
    src.buffer = A.noiseBuf;
    src.loop = true;
    const f = A.ctx.createBiquadFilter();
    f.type = filterType || 'bandpass';
    f.frequency.setValueAtTime(freq || 1200, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), t + dur);
    f.Q.value = q == null ? 0.9 : q;
    const g = A.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, gainAmt), t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(A.sfxBus);
    src.start(t); src.stop(t + dur + 0.02);
  }

  function tone(type, f0, f1, dur, vol, t0, attack, dest) {
    if (!A.ready) return;
    const t = t0 || now();
    const o = A.ctx.createOscillator();
    o.type = type || 'square';
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = A.ctx.createGain();
    const atk = attack || 0.004;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || A.sfxBus);
    o.start(t); o.stop(t + dur + 0.03);
  }

  function kick(t, vol) {
    if (!A.ready) return;
    const o = A.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
    const g = A.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g); g.connect(A.musicBus);
    o.start(t); o.stop(t + 0.24);
  }
  function snare(t, vol) {
    const src = A.ctx.createBufferSource();
    src.buffer = A.noiseBuf;
    const f = A.ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 1400;
    const g = A.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    src.connect(f); f.connect(g); g.connect(A.musicBus);
    src.start(t); src.stop(t + 0.16);
    const o = A.ctx.createOscillator();
    o.type = 'triangle'; o.frequency.setValueAtTime(190, t);
    const og = A.ctx.createGain();
    og.gain.setValueAtTime(vol * 0.6, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    o.connect(og); og.connect(A.musicBus);
    o.start(t); o.stop(t + 0.1);
  }
  function hat(t, vol) {
    const src = A.ctx.createBufferSource();
    src.buffer = A.noiseBuf;
    const f = A.ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 7000;
    const g = A.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
    src.connect(f); f.connect(g); g.connect(A.musicBus);
    src.start(t); src.stop(t + 0.05);
  }
  function musicNote(type, freq, t, dur, vol, filterFreq) {
    const o = A.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    const f = A.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq || 1800;
    const g = A.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(A.musicBus);
    o.start(t); o.stop(t + dur + 0.02);
  }

  // ---------------- sfx ----------------
  A.play = function (name, opt) {
    if (A.muted) return;
    const sample = SAMPLE_MAP[name];
    if (sample && A.samples[sample]) {
      A.playSample(sample);
      return;
    }
    if (!A.ready) return;
    opt = opt || {};
    const t = now();
    const pitch = opt.pitch || 1;
    switch (name) {
      case 'shoot':
        tone('square', 900 * pitch, 320 * pitch, 0.055, 0.07);
        noise(0.035, 0.04, 'highpass', 2600, 0.7);
        break;
      case 'shoot2':
        noise(0.09, 0.12, 'bandpass', 1700, 1.4, t, 500);
        tone('triangle', 320, 130, 0.09, 0.06);
        break;
      case 'laser':
        tone('sawtooth', 1500 * pitch, 900, 0.07, 0.028);
        tone('square', 760, 1200, 0.06, 0.02);
        break;
      case 'hit':
        noise(0.05, 0.1, 'bandpass', 900 + Math.random() * 600, 1.2);
        tone('square', 240 * pitch, 90, 0.05, 0.045);
        break;
      case 'crit':
        noise(0.07, 0.12, 'bandpass', 2200, 1.6);
        tone('square', 880, 240, 0.09, 0.06);
        break;
      case 'hurt':
        tone('sawtooth', 150, 55, 0.28, 0.18);
        noise(0.2, 0.2, 'lowpass', 900, 1.0, t, 200);
        break;
      case 'die':
        noise(0.24, 0.18, 'lowpass', 1200, 0.8, t, 120);
        tone('square', 180, 40, 0.22, 0.09);
        break;
      case 'dodge':
        noise(0.18, 0.1, 'highpass', 700, 0.7, t, 4000);
        tone('sine', 620, 1200, 0.12, 0.035);
        break;
      case 'pickup':
        tone('sine', 880 * pitch, 1320 * pitch, 0.07, 0.05);
        break;
      case 'coin':
        tone('square', 1180, 1180, 0.045, 0.04);
        tone('square', 1760, 1760, 0.09, 0.03, t + 0.045);
        break;
      case 'xp':
        tone('sine', 720, 1080, 0.05, 0.028);
        break;
      case 'heal':
        tone('sine', 420, 880, 0.3, 0.07);
        tone('sine', 660, 1320, 0.32, 0.04, t + 0.05);
        break;
      case 'levelup':
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
          tone('square', f, f, 0.22, 0.055, t + i * 0.075);
          tone('triangle', f / 2, f / 2, 0.3, 0.04, t + i * 0.075);
        });
        noise(0.4, 0.05, 'highpass', 5000, 0.7);
        break;
      case 'ui':
        tone('square', 720, 720, 0.03, 0.025);
        break;
      case 'ui2':
        tone('square', 460, 460, 0.04, 0.03);
        tone('square', 640, 640, 0.04, 0.02, t + 0.04);
        break;
      case 'deny':
        tone('sawtooth', 160, 120, 0.16, 0.07);
        break;
      case 'door':
        tone('sine', 110, 220, 0.5, 0.05);
        noise(0.5, 0.05, 'lowpass', 500, 0.8, t, 120);
        break;
      case 'spawn':
        noise(0.28, 0.07, 'bandpass', 400, 1.4, t, 1800);
        break;
      case 'explode':
        noise(0.38, 0.22, 'lowpass', 1000, 0.6, t, 90);
        tone('sine', 120, 34, 0.34, 0.16);
        break;
      case 'gaze':
        tone('sine', 620, 1180, 0.28, 0.05);
        tone('sine', 930, 1550, 0.24, 0.03, t + 0.04);
        noise(0.25, 0.04, 'bandpass', 1800, 1.4, t, 900);
        break;
      case 'enter':
        noise(0.26, 0.13, 'lowpass', 520, 0.8, t, 200);
        tone('square', 96, 32, 0.24, 0.11);
        tone('sawtooth', 340, 80, 0.18, 0.05);
        break;
      case 'thunder':
        noise(0.9, 0.09, 'lowpass', 220, 0.9, t);
        tone('sine', 42, 24, 1.1, 0.06, t + 0.05);
        break;
      case 'break':
        noise(0.16, 0.1, 'lowpass', 1100, 0.9);
        tone('square', 140, 55, 0.12, 0.055);
        tone('triangle', 260, 90, 0.1, 0.03);
        break;
      case 'meleeSwing':
        tone('square', 190, 80, 0.09, 0.035);
        noise(0.08, 0.05, 'highpass', 1200, 0.8);
        break;
      case 'meleeHit':
        tone('square', 130, 46, 0.13, 0.085, t, 0);
        noise(0.13, 0.11, 'lowpass', 900, 0.8);
        tone('sine', 70, 34, 0.18, 0.07);
        break;
      case 'skill':
        tone('sawtooth', 220, 1400, 0.34, 0.09);
        noise(0.42, 0.16, 'highpass', 800, 0.6, t, 5000);
        tone('sine', 90, 40, 0.4, 0.12);
        break;
      case 'deadlineCharge':
        tone('sine', 180, 1180, 0.42, 0.045);
        tone('sawtooth', 90, 220, 0.4, 0.025);
        noise(0.42, 0.04, 'highpass', 1600, 0.9, t, 700);
        break;
      case 'deadlineSlash':
        noise(0.38, 0.2, 'highpass', 1100, 0.7, t, 7200);
        tone('sawtooth', 980, 90, 0.34, 0.09);
        tone('sine', 70, 28, 0.46, 0.14);
        tone('square', 1760, 880, 0.12, 0.035);
        break;
      case 'hotfix':
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone('square', f, f, 0.1, 0.035, t + i * 0.055));
        noise(0.22, 0.08, 'bandpass', 700, 1.2, t, 2400);
        tone('sine', 110, 55, 0.25, 0.07);
        break;
      case 'turretShot':
        tone('square', 1400, 900, 0.035, 0.018);
        noise(0.03, 0.02, 'highpass', 3800, 0.7);
        break;
      case 'boss':
        tone('sawtooth', 64, 42, 1.0, 0.22);
        tone('square', 98, 72, 0.9, 0.1);
        noise(1.1, 0.14, 'lowpass', 480, 0.8, t, 90);
        break;
      case 'warn':
        tone('square', 520, 520, 0.08, 0.04);
        tone('square', 390, 390, 0.1, 0.04, t + 0.11);
        break;
      case 'victory':
        [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
          tone('square', f, f, 0.5, 0.06, t + i * 0.12);
          tone('triangle', f * 0.5, f * 0.5, 0.6, 0.04, t + i * 0.12);
        });
        break;
      case 'gameover':
        [392, 349.23, 311.13, 261.63].forEach((f, i) => {
          tone('sawtooth', f, f * 0.98, 0.5, 0.055, t + i * 0.18);
        });
        break;
      case 'click':
        tone('square', 300, 300, 0.02, 0.02);
        break;
    }
  };

  A.startLaser = function () {
    if (!A.ready || A.muted || A.laserOsc) return;
    const o = A.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 1200;
    const lfo = A.ctx.createOscillator();
    lfo.type = 'sine'; lfo.frequency.value = 38;
    const lfoGain = A.ctx.createGain(); lfoGain.gain.value = 180;
    lfo.connect(lfoGain); lfoGain.connect(o.frequency);
    const f = A.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 1600; f.Q.value = 2;
    const g = A.ctx.createGain();
    g.gain.setValueAtTime(0.0001, now());
    g.gain.linearRampToValueAtTime(0.032, now() + 0.05);
    o.connect(f); f.connect(g); g.connect(A.sfxBus);
    o.start(); lfo.start();
    A.laserOsc = o; A.laserLfo = lfo; A.laserGain = g;
  };
  A.stopLaser = function () {
    if (!A.ready || !A.laserOsc) return;
    const t = now();
    try {
      A.laserGain.gain.cancelScheduledValues(t);
      A.laserGain.gain.setValueAtTime(A.laserGain.gain.value, t);
      A.laserGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      A.laserOsc.stop(t + 0.1);
      A.laserLfo.stop(t + 0.1);
    } catch (e) {}
    A.laserOsc = null; A.laserGain = null; A.laserLfo = null;
  };

  // ---------------- music ----------------
  A.setMood = function (mood) {
    A.mood = mood;
    A._step = 0;
    A._nextNote = A.ready ? now() + 0.1 : 0;
    if (mood === 'none') A.stopLaser();
  };

  const PATTERNS = {
    menu: {
      bpm: 76,
      bass: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      bassNotes: [NOTE.A1, NOTE.A1, NOTE.F2, NOTE.F2],
      arp: [NOTE.A3, NOTE.C4, NOTE.E4, NOTE.G4, NOTE.E4, NOTE.C4, NOTE.E4, NOTE.G4,
        NOTE.F3, NOTE.A3, NOTE.C4, NOTE.E4, NOTE.C4, NOTE.A3, NOTE.C4, NOTE.E4],
      arpEvery: 2,
      drums: null,
    },
    battle: {
      bpm: 128,
      bass: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0],
      bassNotes: [NOTE.A1, NOTE.A1, NOTE.C2, NOTE.G2],
      arp: [NOTE.A4, NOTE.C5, NOTE.E5, NOTE.A5, NOTE.E5, NOTE.C5, NOTE.E5, NOTE.G5,
        NOTE.F4, NOTE.A4, NOTE.C5, NOTE.F5, NOTE.C5, NOTE.A4, NOTE.C5, NOTE.E5],
      arpEvery: 1,
      drums: 'battle',
    },
    boss: {
      bpm: 148,
      bass: [1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1],
      bassNotes: [NOTE.A1, NOTE.A1, NOTE.F2, NOTE.E2],
      arp: [NOTE.A4, NOTE.B4, NOTE.C5, NOTE.E5, NOTE.F5, NOTE.E5, NOTE.C5, NOTE.B4,
        NOTE.A4, NOTE.C5, NOTE.E5, NOTE.G5, NOTE.E5, NOTE.C5, NOTE.B4, NOTE.A4],
      arpEvery: 1,
      drums: 'boss',
    },
    shop: {
      bpm: 92,
      bass: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      bassNotes: [NOTE.F2, NOTE.C2, NOTE.A2, NOTE.G2],
      arp: [NOTE.F4, NOTE.A4, NOTE.C5, NOTE.A4, NOTE.F4, NOTE.G4, NOTE.A4, NOTE.C5,
        NOTE.C4, NOTE.E4, NOTE.G4, NOTE.E4, NOTE.C4, NOTE.D4, NOTE.E4, NOTE.G4],
      arpEvery: 2,
      drums: 'soft',
    },
  };

  A._startSequencer = function () {
    if (A._timer) return;
    A._nextNote = now() + 0.1;
    A._timer = setInterval(() => {
      if (!A.ready) return;
      const p = PATTERNS[A.mood];
      if (!p) return;
      const stepDur = 60 / p.bpm / 4;
      while (A._nextNote < now() + 0.18) {
        A._schedStep(p, A._nextNote, stepDur);
        A._nextNote += stepDur;
        A._step++;
      }
    }, 25);
  };

  A._schedStep = function (p, t, dur) {
    const s = A._step % 16;
    const bar = Math.floor(A._step / 16) % 4;
    if (!A.muted) {
      if (p.bass[s] && p.bassNotes) {
        const f = p.bassNotes[bar];
        musicNote('triangle', f, t, dur * 1.7, 0.14, 380);
        musicNote('sawtooth', f * 2, t, dur * 1.2, 0.035, 700);
      }
      if (A.mood !== 'menu' && A.mood !== 'shop' && s % 2 === 0) {
        const f = p.arp[s] || p.arp[s - 1];
        if (f) musicNote('square', f, t, dur * 0.9, 0.028, 2200);
      } else if ((A.mood === 'menu' || A.mood === 'shop') && s % 4 === 0) {
        const f = p.arp[s];
        if (f) musicNote('triangle', f, t, dur * 3.2, 0.04, 1600);
      }
      if (p.drums === 'battle') {
        if (s === 0 || s === 8 || (s === 6 && bar % 2)) kick(t, 0.22);
        if (s === 4 || s === 12) snare(t, 0.1);
        if (s % 2 === 0) hat(t, s % 4 === 0 ? 0.035 : 0.018);
      } else if (p.drums === 'boss') {
        if (s === 0 || s === 4 || s === 8 || s === 12) kick(t, 0.26);
        if (s === 4 || s === 12) snare(t, 0.12);
        if (s % 2 === 1) hat(t, 0.03);
      } else if (p.drums === 'soft') {
        if (s === 0) kick(t, 0.12);
        if (s % 4 === 2) hat(t, 0.02);
      }
      // ambient pad every bar
      if (s === 0 && (A.mood === 'menu' || A.mood === 'shop')) {
        const root = p.bassNotes[bar];
        musicNote('sine', root * 4, t, dur * 14, 0.025, 1200);
        musicNote('sine', root * 6, t, dur * 14, 0.018, 1200);
      }
    }
  };
})();
