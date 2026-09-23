/* Fields of Fire — petits effets sonores synthétisés (Web Audio, aucun fichier, libres de droits) */
(function (FOF) {
  'use strict';
  var ctx = null, master = null, on = true, vol = 0.8;
  try { var pv = JSON.parse(localStorage.getItem('fof-music')); if (pv && typeof pv.sfx === 'number') vol = pv.sfx; } catch (e) {}
  on = vol > 0;
  FOF.sfxVolume = function (v) { vol = v; on = v > 0; if (master) master.gain.value = v * 1.5; };
  function ac() {
    if (!ctx) { var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; ctx = new AC(); master = ctx.createGain(); master.gain.value = vol * 1.5; master.connect(ctx.destination); }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(f, t, d, type, vol, f2) {
    var o = ctx.createOscillator(), g = ctx.createGain(), t0 = ctx.currentTime + t;
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + d);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol || 0.3, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + d + 0.05);
  }
  var nbuf = null;
  function noise(t, d, freq, q, vol, type) {
    if (!nbuf) { nbuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate); var a = nbuf.getChannelData(0); for (var i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1; }
    var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), t0 = ctx.currentTime + t;
    s.buffer = nbuf; f.type = type || 'bandpass'; f.frequency.value = freq || 1000; f.Q.value = q || 1;
    g.gain.setValueAtTime(vol || 0.4, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    s.connect(f); f.connect(g); g.connect(master); s.start(t0); s.stop(t0 + d + 0.05);
  }
  function notes(list, type, vol, step, dur) { list.forEach(function (f, i) { tone(f, i * step, dur, type, vol); }); }
  var S = {
    coin: function () { tone(1318, 0, 0.12, 'triangle', 0.22); tone(1976, 0.07, 0.22, 'triangle', 0.18); },
    spend: function () { tone(988, 0, 0.1, 'triangle', 0.16); tone(740, 0.06, 0.16, 'triangle', 0.13); },
    recruit: function () { notes([392, 494, 587, 784], 'triangle', 0.16, 0.07, 0.25); noise(0, 0.18, 3000, 0.7, 0.08, 'highpass'); },
    move: function () { noise(0, 0.09, 180, 1.2, 0.5, 'lowpass'); noise(0.16, 0.09, 160, 1.2, 0.45, 'lowpass'); noise(0.32, 0.09, 170, 1.2, 0.35, 'lowpass'); },
    build: function () { [0, 0.16, 0.32].forEach(function (t) { noise(t, 0.07, 900, 4, 0.5); tone(220, t, 0.08, 'square', 0.05); }); },
    conquer: function () { notes([523, 659, 784, 1046], 'sawtooth', 0.07, 0.09, 0.3); notes([262, 330, 392, 523], 'triangle', 0.12, 0.09, 0.32); },
    phase: function () { tone(880, 0, 0.6, 'sine', 0.12); tone(1320, 0.02, 0.5, 'sine', 0.06); },
    turn: function () { tone(660, 0, 0.7, 'sine', 0.16); tone(990, 0.18, 0.9, 'sine', 0.13); tone(1320, 0.18, 0.6, 'sine', 0.05); },
    dice: function () { for (var i = 0; i < 7; i++) noise(i * 0.045 + Math.random() * 0.02, 0.04, 2400 + Math.random() * 1500, 3, 0.28); },
    clash: function () { noise(0, 0.35, 3500, 0.8, 0.3, 'highpass'); tone(1760, 0, 0.3, 'square', 0.03, 1500); },
    win: function () { S.clash(); notes([523, 659, 784], 'triangle', 0.2, 0.11, 0.35); tone(1046, 0.33, 0.7, 'triangle', 0.22); },
    loss: function () { S.clash(); notes([392, 311, 262], 'sawtooth', 0.07, 0.18, 0.4); tone(131, 0.54, 0.8, 'triangle', 0.2); },
    victory: function () { notes([392, 523, 659, 784, 659, 784, 1046], 'triangle', 0.22, 0.13, 0.4); notes([196, 262, 330, 392], 'sawtooth', 0.05, 0.26, 0.6); },
    defeat: function () { notes([330, 294, 262, 196], 'triangle', 0.18, 0.28, 0.6); },
    dip: function () { tone(784, 0, 0.3, 'sine', 0.12); tone(1175, 0.1, 0.4, 'sine', 0.1); },
    bad: function () { tone(196, 0, 0.35, 'sawtooth', 0.06, 150); tone(98, 0, 0.5, 'triangle', 0.18); },
    // --- sons d'interface (clics) ---
    click: function () { tone(1800, 0, 0.035, 'triangle', 0.08); noise(0, 0.03, 4000, 2, 0.08); },
    tap: function () { noise(0, 0.06, 1400, 1.2, 0.12); tone(420, 0, 0.06, 'sine', 0.06); },
    select: function () { tone(660, 0, 0.12, 'triangle', 0.16); tone(990, 0.05, 0.16, 'triangle', 0.12); },
    march: function () { [0, 0.13, 0.26].forEach(function (t, i) { noise(t, 0.08, 220 - i * 20, 1.4, 0.55, 'lowpass'); tone(90, t, 0.08, 'sine', 0.2); }); },
    page: function () { noise(0, 0.22, 2600, 0.6, 0.16, 'highpass'); tone(520, 0.02, 0.35, 'sine', 0.07); },
    bell: function () { [[523, 0.2], [1046, 0.1], [1444, 0.07], [2825, 0.035]].forEach(function (p) { tone(p[0], 0, 2.2, 'sine', p[1]); }); tone(784, 0.35, 1.8, 'sine', 0.08); },
    coins: function () { for (var i = 0; i < 6; i++) { var t = i * 0.055 + Math.random() * 0.03, f = 2400 + Math.random() * 1600; tone(f, t, 0.18, 'triangle', 0.12); tone(f * 1.51, t, 0.12, 'sine', 0.05); } },
    card: function () { noise(0, 0.16, 1800, 0.7, 0.22); noise(0.05, 0.1, 5000, 0.8, 0.1, 'highpass'); },
    mallet: function () { [0, 0.2].forEach(function (t) { tone(240, t, 0.12, 'sine', 0.4, 110); noise(t, 0.06, 1100, 3, 0.45); noise(t, 0.12, 380, 2, 0.3, 'lowpass'); }); },
    flag: function () { notes([392, 523, 659], 'triangle', 0.16, 0.08, 0.28); noise(0, 0.25, 900, 0.6, 0.08); },
    magic: function () { [1318, 1568, 1976, 2637].forEach(function (f, i) { tone(f, i * 0.06, 0.5, 'sine', 0.08); }); },
    draw: function () { noise(0, 0.28, 5200, 1.5, 0.22, 'bandpass'); tone(2900, 0.05, 0.4, 'sine', 0.04, 3300); },
    // bataille : cri de guerre de la troupe + fracas d'épées
    charge: function () {
      var t0 = ctx.currentTime;
      for (var v = 0; v < 7; v++) {
        var o = ctx.createOscillator(), f = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
        var base = 130 + Math.random() * 120, st2 = t0 + Math.random() * 0.12;
        o.type = 'sawtooth'; o.frequency.setValueAtTime(base, st2); o.frequency.linearRampToValueAtTime(base * 1.35, st2 + 0.35); o.frequency.linearRampToValueAtTime(base * 1.2, st2 + 1.1);
        lfo.frequency.value = 5 + Math.random() * 3; lg.gain.value = base * 0.03; lfo.connect(lg); lg.connect(o.frequency);
        f.type = 'bandpass'; f.frequency.value = 700 + Math.random() * 200; f.Q.value = 1.4; f2.type = 'bandpass'; f2.frequency.value = 1150; f2.Q.value = 2;
        g.gain.setValueAtTime(0.0001, st2); g.gain.exponentialRampToValueAtTime(0.09, st2 + 0.18); g.gain.setValueAtTime(0.09, st2 + 0.8); g.gain.exponentialRampToValueAtTime(0.0001, st2 + 1.3);
        o.connect(f); f.connect(g); o.connect(f2); f2.connect(g); g.connect(master); o.start(st2); lfo.start(st2); o.stop(st2 + 1.4); lfo.stop(st2 + 1.4);
      }
      noise(0, 1.1, 900, 0.5, 0.12);
      [0.35, 0.55, 0.72, 0.95, 1.12].forEach(function (t) { S.steel(t); });
    },
    steel: function (t) {
      t = t || 0; [2130, 3190, 4420, 5870].forEach(function (f, i) { tone(f * (0.97 + Math.random() * 0.06), t, 0.35 - i * 0.05, 'sine', 0.07 - i * 0.012); });
      noise(t, 0.08, 4000, 1, 0.3);
    },
    dice3d: function () { for (var i = 0; i < 12; i++) { var t = i * 0.09 + Math.random() * 0.04; noise(t, 0.035, 1800 + Math.random() * 2500, 4, 0.22 * (1 - i / 14)); tone(300 + Math.random() * 200, t, 0.03, 'triangle', 0.05); } noise(1.15, 0.05, 1200, 3, 0.25); },
    tyran: function () { tone(73, 0, 2.2, 'sawtooth', 0.08); tone(110, 0.1, 2, 'sawtooth', 0.05); tone(98, 0.1, 2, 'triangle', 0.16); noise(0, 1.5, 200, 0.7, 0.2, 'lowpass'); [0, 0.5, 1].forEach(function (t) { tone(55, t, 0.5, 'sine', 0.35, 40); }); },
    error: function () { tone(140, 0, 0.16, 'square', 0.06); tone(110, 0.08, 0.18, 'square', 0.05); }
  };
  var last = {};
  var UI = { charge: 1, click: 1, tap: 1, select: 1, march: 1, page: 1, bell: 1, coins: 1, card: 1, mallet: 1, flag: 1, magic: 1, draw: 1, dip: 1, spend: 1 };
  FOF.sfxLast = 0;
  FOF.sfx = function (name) {
    if (UI[name]) FOF.sfxLast = Date.now();
    if (!on || !S[name]) return;
    var now = Date.now(); if (last[name] && now - last[name] < 120) return; last[name] = now;
    try { if (!ac()) return; S[name](); } catch (e) {}
  };
  FOF.sfxOn = function () { return on; };
  FOF.sfxRaw = S;
  FOF.sfxToggle = function () { on = !on; try { localStorage.setItem('fof-sfx', on ? '1' : '0'); } catch (e) {} if (on) FOF.sfx('coin'); return on; };
  document.addEventListener('click', function () { if (on) ac(); }, { once: true, capture: true });
})(window.FOF = window.FOF || {});
