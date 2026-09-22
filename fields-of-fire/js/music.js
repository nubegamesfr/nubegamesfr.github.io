/* Fields of Fire — musique de taverne (RandomMind, domaine public CC0). Non synchronisée entre joueurs. */
(function (FOF) {
  'use strict';
  var OGA = 'https://opengameart.org/sites/default/files/';
  var TRACKS = [
    { t: 'The Old Tower Inn', f: 'the-old-tower-inn.mp3', u: OGA + 'The_Old_Tower_Inn.mp3' },
    { t: 'Minstrel Dance', f: 'minstrel-dance.mp3', u: OGA + 'Minstrel_Dance_0.mp3' },
    { t: 'King’s Feast', f: 'kings-feast.mp3', u: OGA + 'Kings_Feast_0.mp3' },
    { t: 'The Bard’s Tale', f: 'the-bards-tale.mp3', u: OGA + 'The_Bards_Tale.mp3' },
    { t: 'Market Day', f: 'market-day.mp3', u: OGA + 'Market_Day.mp3' },
    { t: 'Harvest Season', f: 'harvest-season.mp3', u: OGA + 'harvestseason_2.mp3' }
  ];
  var audio = null, order = [], pos = 0, started = false, triedRemote = false, fails = 0, dead = false;
  var prefs = { vol: 0.35, muted: false };
  try { var sv = JSON.parse(localStorage.getItem('fof-music')); if (sv) prefs = { vol: typeof sv.vol === 'number' ? sv.vol : 0.35, muted: !!sv.muted }; } catch (e) {}
  function savePrefs() { try { localStorage.setItem('fof-music', JSON.stringify(prefs)); } catch (e) {} }
  function shuffle() { order = TRACKS.map(function (_, i) { return i; }).sort(function () { return Math.random() - 0.5; }); pos = 0; }
  function cur() { return TRACKS[order[pos]]; }
  function load(next) {
    if (!audio) {
      audio = new Audio(); audio.preload = 'auto';
      audio.addEventListener('ended', function () { skip(); });
      audio.addEventListener('playing', function () { fails = 0; dead = false; ui(); });
      audio.addEventListener('error', function () {
        // fichier local absent : on tente la source d'origine, sinon piste suivante
        if (!triedRemote) { triedRemote = true; audio.src = cur().u; if (started && !prefs.muted) audio.play().catch(function () {}); }
        else if (++fails < TRACKS.length) setTimeout(skip, 400);
        else { dead = true; ui(); }
      });
    }
    triedRemote = false;
    audio.src = 'music/' + cur().f;
    apply();
    if (started && !prefs.muted) audio.play().catch(function () {});
    ui();
  }
  function skip() { pos++; if (pos >= order.length) shuffle(); load(); }
  function apply() { if (!audio) return; audio.volume = prefs.vol; audio.muted = prefs.muted; }
  function start() {
    if (started) return; started = true;
    if (!audio) { shuffle(); load(); }
    if (!prefs.muted) audio.play().catch(function () { started = false; });
    ui();
  }
  function ui() {
    document.querySelectorAll('.music').forEach(function (el) {
      var off = prefs.muted || prefs.vol === 0;
      var b = el.querySelector('[data-mute]'), r = el.querySelector('input[type=range]'), n = el.querySelector('.mtitle');
      if (b) { b.textContent = off ? '🔇' : prefs.vol < 0.4 ? '🔉' : '🔊'; b.setAttribute('aria-label', off ? 'Activer la musique' : 'Couper la musique'); b.setAttribute('aria-pressed', String(off)); }
      if (r && document.activeElement !== r) r.value = Math.round(prefs.vol * 100);
      if (n) n.textContent = dead ? 'Musique indisponible' : audio ? '♪ ' + cur().t : '♪ Musique de taverne';
      el.classList.toggle('off', off);
      var fx = el.querySelector('[data-msfx]'); if (fx && FOF.sfxOn) { var o2 = FOF.sfxOn(); fx.textContent = o2 ? '🔔' : '🔕'; fx.setAttribute('aria-pressed', String(!o2)); fx.title = o2 ? 'Couper les effets sonores' : 'Activer les effets sonores'; }
    });
  }
  FOF.musicHTML = function () {
    return '<div class="music" role="group" aria-label="Musique"><button type="button" class="btn small ghost" data-mute="1" title="Couper / activer la musique">🔊</button>' +
      '<input type="range" min="0" max="100" step="1" aria-label="Volume de la musique" title="Volume">' +
      '<button type="button" class="btn small ghost" data-mskip="1" title="Morceau suivant" aria-label="Morceau suivant">⏭</button>' +
      '<button type="button" class="btn small ghost" data-msfx="1" title="Effets sonores" aria-label="Effets sonores">🔔</button>' +
      '<span class="mtitle" title="Musique : RandomMind (domaine public, CC0)"></span></div>';
  };
  document.addEventListener('click', function (e) {
    var m = e.target.closest('.music');
    if (m && e.target.closest('[data-mute]')) {
      prefs.muted = !prefs.muted; if (!prefs.muted && prefs.vol === 0) prefs.vol = 0.35;
      savePrefs(); apply(); if (!started) start(); else if (!prefs.muted && audio.paused) audio.play().catch(function () {});
      return ui();
    }
    if (m && e.target.closest('[data-msfx]')) { FOF.sfxToggle(); return ui(); }
    if (m && e.target.closest('[data-mskip]')) { started = true; fails = 0; dead = false; if (!audio) shuffle(); skip(); return; }
    if (!m) start(); // premier clic n'importe où : la musique démarre (les navigateurs bloquent la lecture automatique)
  }, true);
  document.addEventListener('input', function (e) {
    if (!e.target.closest || !e.target.closest('.music') || e.target.type !== 'range') return;
    prefs.vol = +e.target.value / 100; prefs.muted = prefs.vol === 0; savePrefs(); apply();
    if (!started) start(); else if (!prefs.muted && audio && audio.paused) audio.play().catch(function () {});
    ui();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') start(); }, true);
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-music-slot]').forEach(function (s) { s.innerHTML = FOF.musicHTML(); });
    ui();
  });
  FOF.musicUI = ui;
})(window.FOF = window.FOF || {});
