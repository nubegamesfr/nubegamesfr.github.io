/* Fields of Fire - le coin des mini-jeux (v1.9.16), sous la chronique, pendant le tour des autres.
   Ce fichier est l'hôte : une rangée d'onglets, le jeu actif dessous. Chaque jeu vit dans son propre
   fichier (mjchausse.js, mjmoulin.js…) et s'enregistre avec FOF.Minijeux.enregistrer(def).

   Contrat d'un jeu :
     def = { id, nom, ic (nom d'icône FOF.ic), creer: function (api) { return instance; } }
     instance.html()            -> le HTML du jeu (en-tête compris), redessiné à chaque action
     instance.clic(e)           -> true s'il faut redessiner (idem clicDroit, change, touche)
     instance.temps()           -> facultatif : ms écoulées, affichées dans .mj-temps b chaque seconde
     instance.pause() / reprise() -> facultatif : appelés quand le jeu est caché ou montré
   Les jeux ne lisent ni ne modifient l'état de la partie. Leurs parties en cours restent en mémoire
   le temps de la session ; seuls les records et le dernier jeu choisi vont dans le navigateur. */
(function (FOF) {
  'use strict';
  var defs = [], inst = {}, actif = null, root = null, visible = false, tic = null;
  try { actif = localStorage.getItem('fof-mj-actif'); } catch (e) {}

  var api = {
    duree: function (ms) { var s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); },
    son: function (n) { if (FOF.sfx) FOF.sfx(n); },
    lire: function (cle, defaut) { try { var v = JSON.parse(localStorage.getItem('fof-mj-' + cle)); return v === null ? defaut : v; } catch (e) { return defaut; } },
    ecrire: function (cle, v) { try { localStorage.setItem('fof-mj-' + cle, JSON.stringify(v)); } catch (e) {} },
    // record : garde la meilleure valeur (plus petite si petitMieux) ; renvoie true si battu
    record: function (cle, v, petitMieux) {
      var r = api.lire('rec', {}), old = r[cle];
      if (old === undefined || (petitMieux ? v < old : v > old)) { r[cle] = v; api.ecrire('rec', r); return true; }
      return false;
    },
    meilleur: function (cle) { return api.lire('rec', {})[cle]; },
    rendre: function () { rendre(); },
    visible: function () { return visible; },
    // chronomètre qui ne tourne que lorsque le jeu est montré (pause / reprise gérées par l'hôte)
    chrono: function () {
      var c = { ecoule: 0, depuis: 0, marche: false };
      c.demarrer = function () { c.ecoule = 0; c.marche = true; c.depuis = visible ? Date.now() : 0; };
      c.arreter = function () { c.pause(); c.marche = false; };
      c.pause = function () { if (c.depuis) { c.ecoule += Date.now() - c.depuis; c.depuis = 0; } };
      c.reprise = function () { if (c.marche && !c.depuis) c.depuis = Date.now(); };
      c.ms = function () { return c.ecoule + (c.depuis ? Date.now() - c.depuis : 0); };
      c.remise = function () { c.ecoule = 0; c.depuis = 0; c.marche = false; };
      return c;
    }
  };

  function courant() {
    if (!defs.length) return null;
    var d = defs.filter(function (x) { return x.id === actif; })[0] || defs[0];
    actif = d.id;
    if (!inst[d.id]) inst[d.id] = d.creer(api);
    return inst[d.id];
  }
  function rendre() {
    if (!root || !visible) return;
    var j = courant(); if (!j) return;
    var onglets = '<div class="mj-onglets" role="tablist" aria-label="Mini-jeux">' + defs.map(function (d) {
      var on = d.id === actif;
      return '<button type="button" role="tab" class="mj-onglet' + (on ? ' on' : '') + '" aria-selected="' + on + '" data-mjtab="' + d.id + '" title="' + d.nom + '">' + FOF.ic(d.ic, 16) + '</button>';
    }).join('') + '</div>';
    root.innerHTML = onglets + '<div class="mj-zone" data-jeu="' + actif + '">' + j.html() + '</div>';
  }
  function majTemps() {
    var j = inst[actif]; if (!root || !j || !j.temps) return;
    var t = root.querySelector('.mj-temps b'); if (t) t.textContent = api.duree(j.temps());
  }
  function changer(id) {
    if (id === actif) return;
    var j = inst[actif]; if (j && j.pause) j.pause();
    actif = id; try { localStorage.setItem('fof-mj-actif', id); } catch (e) {}
    j = courant(); if (j && j.reprise) j.reprise();
    rendre();
  }
  function passer(nom, e) {
    var j = inst[actif]; if (!j || !j[nom]) return;
    if (j[nom](e)) rendre();
  }
  function brancher() {
    root.addEventListener('click', function (e) {
      var t = e.target.closest('[data-mjtab]'); if (t) { changer(t.dataset.mjtab); return; }
      passer('clic', e);
    });
    root.addEventListener('contextmenu', function (e) { var j = inst[actif]; if (j && j.clicDroit) { e.preventDefault(); if (j.clicDroit(e)) rendre(); } });
    root.addEventListener('change', function (e) { passer('change', e); });
    root.addEventListener('pointerdown', function (e) { passer('appui', e); });
    root.addEventListener('pointerup', function (e) { passer('relache', e); });
    root.addEventListener('pointerover', function (e) { passer('survol', e); });
    // clavier : seulement si le panneau est montré et qu'on n'écrit pas dans un champ
    document.addEventListener('keydown', function (e) {
      if (!visible || !root || e.defaultPrevented) return;
      var tag = (document.activeElement && document.activeElement.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (document.querySelector('#modal:not([hidden]) .modal')) return;
      passer('touche', e);
    });
  }

  FOF.Minijeux = {
    enregistrer: function (def) { defs.push(def); },
    api: api
  };
  // interface attendue par ui.js
  FOF.Minijeu = {
    monter: function (el) { if (root === el) return; root = el; brancher(); },
    afficher: function (oui) {
      if (!root) return;
      oui = !!oui;
      if (oui === visible) return;
      visible = oui; root.hidden = !oui;
      var j = courant();
      if (j) { if (oui && j.reprise) j.reprise(); if (!oui && j.pause) j.pause(); }
      clearInterval(tic); tic = oui ? setInterval(majTemps, 1000) : null;
      if (oui) rendre();
    }
  };
})(window.FOF = window.FOF || {});
