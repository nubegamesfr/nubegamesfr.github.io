/* Fields of Fire - musique (v1.9.14 : fondus enchaînés, sonie égalisée) : playlist fantasy + playlist épique pendant les combats.
   Morceaux libres de droits (CC0) hébergés sur OpenGameArt ; un fichier local music/<nom>.mp3 est utilisé s'il existe.
   Volumes séparés : musique et effets sonores. Non synchronisé entre joueurs. */
(function (FOF) {
  'use strict';
  var OGA = 'https://opengameart.org/sites/default/files/';
  /* v1.9.14 - playlist revue avec le créateur :
     - retirées : The Old Tower Inn (et sa version chiptune), The Field of Dreams, Once Upon a Time,
       Defeat Theme ;
     - l'ambiance préférée est « exploration » : les morceaux marqués x reviennent deux fois plus
       souvent que les autres ;
     - g = gain de sonie. Mesurées (EBU R128), les pistes allaient de -8 à -23 LUFS : 15 dB d'écart,
       d'où des morceaux qui éclataient et d'autres qu'on n'entendait pas. Chaque piste est ramenée
       vers -16 LUFS. d = début utile en secondes (silence d'ouverture sauté). */
  function g(lufs) { return Math.pow(10, (-16 - lufs) / 20); }
  var LISTS = {
    calm: [
      { t: 'Exploration', a: 'RandomMind', f: 'exploration.mp3', u: OGA + 'Exploration_0.mp3', x: 1, fav: 1, g: g(-22.0), d: 1.1 },
      { t: 'Adventurer’s Path', a: 'vitalezzz', f: 'adventurers-path.mp3', u: OGA + 'adventurers_path_0.mp3', x: 1, g: g(-13.6) },
      { t: 'Journey With No Name', a: 'iamoneabe', f: 'journey-with-no-name.mp3', u: OGA + 'cresttest_0.mp3', x: 1, g: g(-17.3) },
      { t: 'The Ancient Legend', a: 'vitalezzz', f: 'the-ancient-legend.mp3', u: OGA + 'the_ancient_legend_2.mp3', x: 1, g: g(-15.7) },
      { t: 'GrassLands Theme', a: 'DST', f: 'grasslands-theme.mp3', u: OGA + 'DST-GrassLands.mp3', x: 1, g: g(-13.0) },
      { t: 'A Legend Will Rise', a: 'CodeManu', f: 'a-legend-will-rise.mp3', u: OGA + 'A%20Legend%20Will%20Rise.mp3', x: 1, g: g(-10.1) },
      { t: 'Treasure Hunter', a: 'TAD', f: 'treasure-hunter.mp3', u: OGA + 'treasure_hunter_0.mp3', g: g(-11.9) },
      { t: 'Minstrel Dance', a: 'RandomMind', f: 'minstrel-dance.mp3', u: OGA + 'Minstrel_Dance_0.mp3', g: g(-12.9) },
      { t: 'King’s Feast', a: 'RandomMind', f: 'kings-feast.mp3', u: OGA + 'Kings_Feast_0.mp3', g: g(-14.1), d: 1.2 },
      { t: 'The Bard’s Tale', a: 'RandomMind', f: 'the-bards-tale.mp3', u: OGA + 'The_Bards_Tale.mp3', g: g(-17.6), d: 2.2 },
      { t: 'Harvest Season', a: 'RandomMind', f: 'harvest-season.mp3', u: OGA + 'harvestseason_2.mp3', x: 1, fav: 1, g: g(-11.1), d: 0.5 },
      { t: 'Market Day', a: 'RandomMind', f: 'market-day.mp3', u: OGA + 'Market_Day.mp3', g: g(-8.1) },
      { t: 'Rejoicing', a: 'RandomMind', f: 'rejoicing.mp3', u: OGA + 'Rejoicing_0.mp3', g: g(-12.1), d: 0.5 },
      { t: 'Victory Theme', a: 'RandomMind', f: 'victory-theme.mp3', u: OGA + 'victory_0.mp3', g: g(-10.7) },
      { t: 'Lament for a Warrior’s Soul', a: 'RandomMind', f: 'lament-for-a-warriors-soul.mp3', u: OGA + 'Lament_for_a_Warriors_Soul.mp3', g: g(-17.6), d: 1.6 },
      // v1.9.19 - morceau CC0 ajouté (OpenGameArt), sonie mesurée (EBU R128). Cinq autres ajoutés en même
      // temps ont été retirés à la demande du créateur (07/10/2026).
      { t: 'Peasant Theme', a: 'nihilocrat', f: 'peasant-theme.ogg', u: OGA + 'peasantry.ogg', g: g(-15.7) },
    ],
    battle: [
      { t: 'Battle Theme A', a: 'cynicmusic', f: 'battle-theme-a.mp3', u: OGA + 'battleThemeA.mp3', g: g(-10.3) },
      { t: 'Battle', a: 'Wolfgang_', f: 'battle.mp3', u: OGA + 'Battle.mp3', g: g(-12.0) },
      { t: 'Medieval Battle', a: 'RandomMind', f: 'medieval-battle.mp3', u: OGA + 'battle_8.mp3', g: g(-13.5) },
      { t: 'War Theme', a: 'Spring Spring', f: 'war-theme.ogg', u: OGA + 'war%20theme%20ver%202_0.ogg', g: g(-12.0) },
      { t: 'Orcs Victorious', a: 'bobjt', f: 'orcs-victorious.mp3', u: OGA + 'orcs_victorious_2024.mp3', g: g(-9.7) },
      { t: 'Hope', a: 'MintoDog', f: 'hope.ogg', u: OGA + 'hope_orchestral_battle_music_bpm165_0.ogg', g: g(-9.9) },
      { t: 'Prepare Your Swords', a: 'bojidar-bg', f: 'prepare-your-swords.mp3', u: OGA + 'prepare_your_swords.mp3', g: g(-14.9) }   // v1.9.19
    ]
  };
  /* v1.9.9 - la réglette suit une courbe perceptive et ne dépasse jamais PLAFOND. */
  var PLAFOND = 0.4;
  function ampli(v) { v = Math.max(0, Math.min(1, v)); return PLAFOND * Math.pow(v, 2.5); }
  var prefs = { vol: 0.45, sfx: 0.8, muted: false }, localOK = null; // localOK : les fichiers music/ existent-ils sur ce site ?
  try { var sv = JSON.parse(localStorage.getItem('fof-music')); if (sv) { if (typeof sv.vol === 'number') prefs.vol = sv.vol; if (typeof sv.sfx === 'number') prefs.sfx = sv.sfx; prefs.muted = !!sv.muted; } } catch (e) {}
  function savePrefs() { try { localStorage.setItem('fof-music', JSON.stringify(prefs)); } catch (e) {} }

  /* v1.9.14 - FONDU ENCHAÎNÉ entre les morceaux : chaque piste monte en FONDU_ENTREE secondes, et
     FONDU_SORTIE secondes avant sa fin la suivante démarre pendant qu'elle s'éteint. Chaque piste a
     son propre élément audio : l'ancienne continue de jouer pendant qu'elle baisse. */
  var FONDU_ENTREE = 3, FONDU_SORTIE = 5;
  function Deck(name) { this.name = name; this.debutAuHasard = true; this.order = []; this.pos = 0; this.audio = null; this.env = 0; this.old = []; this.tried = false; this.fails = 0; this.level = 0; this.lastT = 0; this.lastMove = 0; this.retries = 0; this.seekTo = 0; this.everPlayed = false; this.passe = false; }
  Deck.prototype.list = function () { return LISTS[this.name]; };
  Deck.prototype.cur = function () { return this.list()[this.order[this.pos]]; };
  // Mélange de Fisher-Yates ; les morceaux d'exploration (x) occupent deux places sur trois.
  function melange(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
  Deck.prototype.shuffle = function () {
    var L = this.list(), ex = [], au = [];
    // v1.9.20 - fav : morceaux préférés du créateur (Exploration, Harvest Season), deux fois plus présents encore
    L.forEach(function (t, i) { (t.x ? ex : au).push(i); if (t.fav) ex.push(i); });
    if (!ex.length || !au.length) { this.order = melange(L.map(function (_, i) { return i; })); this.pos = 0; return; }
    melange(ex); melange(au);
    var o = [], ie = 0, ia = 0, n = ex.length * 2 + au.length;
    for (var k = 0; o.length < n; k++) {
      if (k % 3 === 2) o.push(au[ia++ % au.length]); else o.push(ex[ie++ % ex.length]);
      if (ia >= au.length && ie >= ex.length * 2) break;
    }
    // pas deux fois le même morceau d'affilée
    for (var q = 1; q < o.length; q++) if (o[q] === o[q - 1]) { var sw = (q + 2) % o.length; var tmp = o[q]; o[q] = o[sw]; o[sw] = tmp; }
    this.order = o; this.pos = 0;
  };
  Deck.prototype.load = function () {
    var self = this;
    if (!this.order.length) this.shuffle();
    var a = new Audio(); a.preload = 'auto';
    var courant = function () { return self.audio === a; };
    a.addEventListener('ended', function () { if (courant()) self.next(); });
    a.addEventListener('playing', function () { if (!courant()) return; self.fails = 0; self.everPlayed = true; self.lastMove = Date.now(); if (!self.tried) localOK = true; ui(); });
    a.addEventListener('timeupdate', function () {
      if (!courant()) return;
      var t = a.currentTime; if (t > self.lastT + 0.05 || t < self.lastT - 1) { self.lastT = t; self.lastMove = Date.now(); if (t > 5) self.retries = 0; }
      // fondu enchaîné : la suivante démarre avant la fin de celle-ci
      var d = a.duration;
      if (!self.passe && d && isFinite(d) && d > FONDU_SORTIE * 3 && d - t <= FONDU_SORTIE) { self.passe = true; self.next(); }
    });
    a.addEventListener('loadedmetadata', function () {
      if (!courant()) return;
      var d = a.duration, piste = self.cur();
      // Le tout premier morceau d'une séance (et chaque morceau de combat) démarre à un endroit
      // quelconque : on entre directement dans la musique. Sinon on saute le silence d'ouverture.
      if ((self.debutAuHasard || self.name === 'battle') && d && isFinite(d) && d > 40) { self.debutAuHasard = false; self.seekTo = Math.random() * d * 0.6; }
      else if (piste && piste.d) self.seekTo = Math.max(self.seekTo, piste.d);
      if (self.seekTo > 0) { try { a.currentTime = Math.min(self.seekTo, d - FONDU_SORTIE - 1); } catch (e) {} self.seekTo = 0; }
    });
    a.addEventListener('error', function () {
      if (!courant()) return;
      if (self.everPlayed && self.retries < 3) return self.recover();
      if (!self.tried) { self.tried = true; if (!self.everPlayed) localOK = false; a.src = self.cur().u; self.play(); }
      else if (++self.fails < self.list().length) setTimeout(function () { self.next(); }, 400);
    });
    // l'ancien morceau s'éteint pendant que le nouveau monte
    if (this.audio) { this.old.push({ audio: this.audio, env: this.env, g: this.gain }); }
    this.audio = a; this.env = 0; this.passe = false; this.gain = (this.cur() && this.cur().g) || 1;
    this.everPlayed = false; this.retries = 0; this.lastT = 0;
    if (localOK === false) { this.tried = true; a.src = this.cur().u; } else { this.tried = false; a.src = 'music/' + this.cur().f; }
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
  // v1.9.15 - pendant une pause, la musique baisse de deux tiers
  var sourdine = 1;
  function vol(base, level, env, gain) { return Math.max(0, Math.min(1, base * level * env * (gain || 1) * sourdine)); }
  Deck.prototype.apply = function () {
    var base = ampli(prefs.vol), lv = this.level;
    if (this.audio) { this.audio.volume = vol(base, lv, this.env, this.gain); this.audio.muted = prefs.muted; }
    this.old.forEach(function (o) { o.audio.volume = vol(base, lv, o.env, o.g); o.audio.muted = prefs.muted; });
  };
  // horloge des fondus (entrée du morceau courant, sortie des précédents)
  var PAS = 0.1;
  setInterval(function () {
    [decks.calm, decks.battle].forEach(function (d) {
      if (d.audio && !d.audio.paused && d.env < 1) d.env = Math.min(1, d.env + PAS / FONDU_ENTREE);
      d.old = d.old.filter(function (o) {
        o.env = Math.max(0, o.env - PAS / FONDU_SORTIE);
        if (o.env <= 0 || o.audio.ended) { try { o.audio.pause(); o.audio.removeAttribute('src'); o.audio.load(); } catch (e) {} return false; }
        return true;
      });
      d.apply();
    });
  }, PAS * 1000);

  var decks = { calm: new Deck('calm'), battle: new Deck('battle') }, active = 'calm', started = false, fadeT = null;
  decks.calm.level = 1;
  // passage ambiance / combat : 1,5 s pour entrer dans le combat, 2 s pour en ressortir
  function fadeTo(name) {
    if (active === name && decks[name].level >= 1) return;
    active = name; var target = decks[name], other = decks[name === 'calm' ? 'battle' : 'calm'];
    var up = name === 'battle' ? 0.067 : 0.05;   // v1.9.15 : la musique de combat ne dure que le temps de la fenêtre de combat (sortie en 2 s)
    if (started && !prefs.muted) { if (name === 'battle' && target.audio && target.audio.paused) target.next(); else target.play(); }
    clearInterval(fadeT);
    fadeT = setInterval(function () {
      target.level = Math.min(1, target.level + up); other.level = Math.max(0, other.level - up);
      target.apply(); other.apply();
      if (target.level >= 1 && other.level <= 0) { clearInterval(fadeT); if (other.audio) other.audio.pause(); other.old.forEach(function (o) { o.audio.pause(); }); other.old = []; }
    }, 100);
    ui();
  }
  FOF.musicMode = function (name) { if (LISTS[name]) fadeTo(name); };
  FOF.musicDuck = function (on) { sourdine = on ? 0.35 : 1; decks.calm.apply(); decks.battle.apply(); };
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
      if (b) { b.innerHTML = off ? FOF.ic('mute', 16) : FOF.ic('note', 16); b.setAttribute('aria-pressed', String(off)); b.title = (off ? 'Activer la musique' : 'Couper la musique') + (d.audio ? ' - en cours : ' + d.cur().t + ' (' + d.cur().a + ')' : ''); }
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
      '<span class="mtitle" title="Musiques libres de droits (CC0) d’OpenGameArt : RandomMind, vitalezzz, iamoneabe, DST, CodeManu, TAD, cynicmusic, Wolfgang_, Spring Spring, bobjt, MintoDog"></span></div>';
  };
  var lastSfx = 0.8;
  document.addEventListener('click', function (e) {
    var m = e.target.closest && e.target.closest('.music');
    if (m && e.target.closest('[data-mute]')) {
      prefs.muted = !prefs.muted; if (!prefs.muted && prefs.vol === 0) prefs.vol = 0.45;
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
