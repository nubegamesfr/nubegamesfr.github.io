/* Fields of Fire — petits effets sonores synthétisés (Web Audio, aucun fichier, libres de droits) */
(function (FOF) {
  'use strict';
  var ctx = null, master = null, on = true;
  try { var v = localStorage.getItem('fof-sfx'); if (v === '0') on = false; } catch (e) {}
  function ac() {
    if (!ctx) { var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination); }
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
    error: function () { tone(140, 0, 0.16, 'square', 0.06); tone(110, 0.08, 0.18, 'square', 0.05); }
  };
  var last = {};
  FOF.sfx = function (name) {
    if (!on || !S[name]) return;
    var now = Date.now(); if (last[name] && now - last[name] < 120) return; last[name] = now;
    try { if (!ac()) return; S[name](); } catch (e) {}
  };
  FOF.sfxOn = function () { return on; };
  FOF.sfxToggle = function () { on = !on; try { localStorage.setItem('fof-sfx', on ? '1' : '0'); } catch (e) {} if (on) FOF.sfx('coin'); return on; };
  document.addEventListener('click', function () { if (on) ac(); }, { once: true, capture: true });
})(window.FOF = window.FOF || {});
