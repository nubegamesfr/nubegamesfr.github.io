/* Fields of Fire — musique (v1.5) : playlist fantasy + playlist épique pendant les combats.
   Morceaux libres de droits (CC0) hébergés sur OpenGameArt ; un fichier local music/<nom>.mp3 est utilisé s'il existe.
   Volumes séparés : musique et effets sonores. Non synchronisé entre joueurs. */
(function (FOF) {
  'use strict';
  var OGA = 'https://opengameart.org/sites/default/files/';
  var LISTS = {
    calm: [
      { t: 'A Legend Will Rise', a: 'CodeManu', f: 'a-legend-will-rise.mp3', u: OGA + 'A%20Legend%20Will%20Rise.mp3' },
      { t: 'The Field of Dreams', a: 'pauliuw', f: 'the-field-of-dreams.mp3', u: OGA + 'the_field_of_dreams.mp3' },
      { t: 'Treasure Hunter', a: 'TAD', f: 'treasure-hunter.mp3', u: OGA + 'treasure_hunter_0.mp3' },
      { t: 'Minstrel Dance', a: 'RandomMind', f: 'minstrel-dance.mp3', u: OGA + 'Minstrel_Dance_0.mp3' },
      { t: 'King’s Feast', a: 'RandomMind', f: 'kings-feast.mp3', u: OGA + 'Kings_Feast_0.mp3' },
      { t: 'The Bard’s Tale', a: 'RandomMind', f: 'the-bards-tale.mp3', u: OGA + 'The_Bards_Tale.mp3' },
      { t: 'Harvest Season', a: 'RandomMind', f: 'harvest-season.mp3', u: OGA + 'harvestseason_2.mp3' }
    ],
    battle: [
      { t: 'Battle Theme A', a: 'cynicmusic', f: 'battle-theme-a.mp3', u: OGA + 'battleThemeA.mp3' },
      { t: 'Battle', a: 'Wolfgang_', f: 'battle.mp3', u: OGA + 'Battle.mp3' }
    ]
  };
  var prefs = { vol: 0.35, sfx: 0.8, muted: false }, localOK = null; // localOK : les fichiers music/ existent-ils sur ce site ?
  try { var sv = JSON.parse(localStorage.getItem('fof-music')); if (sv) { if (typeof sv.vol === 'number') prefs.vol = sv.vol; if (typeof sv.sfx === 'number') prefs.sfx = sv.sfx; prefs.muted = !!sv.muted; } } catch (e) {}
  function savePrefs() { try { localStorage.setItem('fof-music', JSON.stringify(prefs)); } catch (e) {} }

  // une piste par ambiance, avec fondu enchaîné
  function Deck(name) { this.name = name; this.order = []; this.pos = 0; this.audio = null; this.tried = false; this.fails = 0; this.level = 0; this.lastT = 0; this.lastMove = 0; this.retries = 0; this.seekTo = 0; this.everPlayed = false; }
  Deck.prototype.list = function () { return LISTS[this.name]; };
  Deck.prototype.cur = function () { return this.list()[this.order[this.pos]]; };
  Deck.prototype.shuffle = function () { this.order = this.list().map(function (_, i) { return i; }).sort(function () { return Math.random() - 0.5; }); this.pos = 0; };
  Deck.prototype.load = function () {
    var self = this;
    if (!this.order.length) this.shuffle();
    if (!this.audio) {
      this.audio = new Audio(); this.audio.preload = 'auto';
      this.audio.addEventListener('ended', function () { self.next(); });
      this.audio.addEventListener('playing', function () { self.fails = 0; self.everPlayed = true; self.lastMove = Date.now(); if (!self.tried) localOK = true; ui(); });
      this.audio.addEventListener('timeupdate', function () { var t = self.audio.currentTime; if (t > self.lastT + 0.05 || t < self.lastT - 1) { self.lastT = t; self.lastMove = Date.now(); if (t > 5) self.retries = 0; } });
      this.audio.addEventListener('loadedmetadata', function () { if (self.seekTo > 0) { try { self.audio.currentTime = Math.min(self.seekTo, self.audio.duration - 1); } catch (e) {} self.seekTo = 0; } });
      this.audio.addEventListener('error', function () {
        // coupure réseau en pleine lecture : on reprend le même morceau là où il s'était arrêté
        if (self.everPlayed && self.retries < 3) return self.recover();
        if (!self.tried) { self.tried = true; if (!self.everPlayed) localOK = false; self.audio.src = self.cur().u; self.play(); }
        else if (++self.fails < self.list().length) setTimeout(function () { self.next(); }, 400);
      });
    }
    this.everPlayed = false; this.retries = 0; this.lastT = 0; this.seekTo = 0;
    if (localOK === false) { this.tried = true; this.audio.src = this.cur().u; } else { this.tried = false; this.audio.src = 'music/' + this.cur().f; }
    this.apply();
  };
  // relance le morceau courant à la dernière position connue (après une coupure ou un blocage du flux)
  Deck.prototype.recover = function () {
    if (!this.audio) return;
    this.retries++; var t = this.lastT, src = this.audio.currentSrc || this.audio.src;
    if (this.retries > 3) { this.retries = 0; return this.next(); }
    this.seekTo = t; this.audio.src = src; this.lastMove = Date.now();
    if (this.level > 0) this.play();
  };
  Deck.prototype.next = function () { this.pos++; if (this.pos >= this.order.length) this.shuffle(); this.load(); if (this.level > 0) this.play(); ui(); };
  Deck.prototype.play = function () { if (!this.audio) this.load(); if (started && !prefs.muted) this.audio.play().catch(function () {}); };
  Deck.prototype.apply = function () { if (this.audio) { this.audio.volume = Math.max(0, Math.min(1, prefs.vol * this.level)); this.audio.muted = prefs.muted; } };

  var decks = { calm: new Deck('calm'), battle: new Deck('battle') }, active = 'calm', started = false, fadeT = null;
  decks.calm.level = 1;
  function fadeTo(name) {
    if (active === name && decks[name].level >= 1) return;
    active = name; var target = decks[name], other = decks[name === 'calm' ? 'battle' : 'calm'];
    if (started && !prefs.muted) target.play();
    clearInterval(fadeT);
    fadeT = setInterval(function () {
      target.level = Math.min(1, target.level + 0.08); other.level = Math.max(0, other.level - 0.08);
      target.apply(); other.apply();
      if (target.level >= 1 && other.level <= 0) { clearInterval(fadeT); if (other.audio) other.audio.pause(); }
    }, 80);
    ui();
  }
  FOF.musicMode = function (name) { if (LISTS[name]) fadeTo(name); };
  // chien de garde : si la musique active ne progresse plus depuis 8 s alors qu'elle devrait jouer, on la relance
  setInterval(function () {
    var d = decks[active]; if (!started || prefs.muted || !d.audio || d.level <= 0 || !d.everPlayed) return;
    if (d.audio.paused && !d.audio.ended && document.visibilityState === 'visible') { d.audio.play().catch(function () {}); return; }
    if (!d.audio.paused && Date.now() - d.lastMove > 8000) d.recover();
  }, 3000);
  function start() {
    if (started) return; started = true;
    decks[active].load(); decks[active].play(); ui();
  }
  function applyAll() { decks.calm.apply(); decks.battle.apply(); if (FOF.sfxVolume) FOF.sfxVolume(prefs.sfx); }

  function ui() {
    document.querySelectorAll('.music').forEach(function (el) {
      var off = prefs.muted || prefs.vol === 0, d = decks[active];
      var b = el.querySelector('[data-mute]'), r = el.querySelector('input[data-vol="music"]'), r2 = el.querySelector('input[data-vol="sfx"]'), n = el.querySelector('.mtitle');
      if (b) { b.innerHTML = off ? FOF.ic('mute', 16) : FOF.ic('note', 16); b.setAttribute('aria-pressed', String(off)); b.title = (off ? 'Activer la musique' : 'Couper la musique') + (d.audio ? ' — en cours : ' + d.cur().t + ' (' + d.cur().a + ')' : ''); }
      if (r && document.activeElement !== r) r.value = Math.round(prefs.vol * 100);
      if (r2 && document.activeElement !== r2) r2.value = Math.round(prefs.sfx * 100);
      var fx = el.querySelector('[data-msfx]'); if (fx) { fx.innerHTML = prefs.sfx > 0 ? FOF.ic('bell', 16) : FOF.ic('bellOff', 16); fx.title = prefs.sfx > 0 ? 'Couper les bruitages' : 'Activer les bruitages'; }
      if (n) n.innerHTML = FOF.ic('note', 13) + ' ' + FOF.esc(d.audio ? d.cur().t + ' · ' + d.cur().a : 'Musique');
      el.classList.toggle('off', off); el.classList.toggle('battle', active === 'battle');
    });
  }
  FOF.musicHTML = function () {
    return '<div class="music" role="group" aria-label="Son">' +
      '<button type="button" class="btn small ghost" data-mute="1">' + FOF.ic('note', 16) + '</button><input type="range" min="0" max="100" data-vol="music" aria-label="Volume de la musique" title="Volume de la musique">' +
      '<button type="button" class="btn small ghost" data-msfx="1">' + FOF.ic('bell', 16) + '</button><input type="range" min="0" max="100" data-vol="sfx" aria-label="Volume des bruitages" title="Volume des bruitages">' +
      '<button type="button" class="btn small ghost" data-mskip="1" title="Morceau suivant" aria-label="Morceau suivant">' + FOF.ic('skip', 15) + '</button>' +
      '<span class="mtitle" title="Musiques libres de droits (CC0) : CodeManu, pauliuw, TAD, RandomMind, cynicmusic, Wolfgang_"></span></div>';
  };
  var lastSfx = 0.8;
  document.addEventListener('click', function (e) {
    var m = e.target.closest && e.target.closest('.music');
    if (m && e.target.closest('[data-mute]')) {
      prefs.muted = !prefs.muted; if (!prefs.muted && prefs.vol === 0) prefs.vol = 0.35;
      savePrefs(); applyAll(); if (!started) start(); else if (!prefs.muted) decks[active].play();
      return ui();
    }
    if (m && e.target.closest('[data-msfx]')) { if (prefs.sfx > 0) { lastSfx = prefs.sfx; prefs.sfx = 0; } else prefs.sfx = lastSfx || 0.8; savePrefs(); applyAll(); if (prefs.sfx) FOF.sfx('coin'); return ui(); }
    if (m && e.target.closest('[data-mskip]')) { started = true; decks[active].next(); decks[active].play(); return; }
    if (!m) start(); // premier clic : les navigateurs bloquent la lecture automatique
  }, true);
  document.addEventListener('input', function (e) {
    if (!e.target.closest || !e.target.closest('.music') || e.target.type !== 'range') return;
    var v = +e.target.value / 100;
    if (e.target.dataset.vol === 'sfx') { prefs.sfx = v; }
    else { prefs.vol = v; prefs.muted = v === 0; if (!started) start(); else if (!prefs.muted) decks[active].play(); }
    savePrefs(); applyAll(); ui();
  });
  document.addEventListener('change', function (e) { if (e.target.dataset && e.target.dataset.vol === 'sfx' && prefs.sfx > 0) FOF.sfx('coins'); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') start(); }, true);
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-music-slot]').forEach(function (s) { s.innerHTML = FOF.musicHTML(); });
    applyAll(); ui();
  });
  FOF.musicUI = ui;
})(window.FOF = window.FOF || {});
