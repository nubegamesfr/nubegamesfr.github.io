/* Fields of Fire - mini-jeu « Chausse-trapes » (démineur, v1.9.15, repris dans l'hôte en v1.9.16).
   Un pré semé de chausse-trapes : on sonde les parcelles, les chiffres disent combien de pièges
   touchent la parcelle, on plante une bannière là où l'on soupçonne un piège.
   Clic : sonder. Clic droit (ou mode bannière) : planter / retirer une bannière.
   Clic sur un chiffre entouré d'assez de bannières : sonde tous ses voisins. */
(function (FOF) {
  'use strict';
  var NIVEAUX = {
    ecuyer:    { nom: 'Écuyer',    l: 9, h: 9,  pieges: 10 },
    chevalier: { nom: 'Chevalier', l: 9, h: 13, pieges: 20 },
    seigneur:  { nom: 'Seigneur',  l: 9, h: 16, pieges: 30 }
  };
  FOF.Minijeux.enregistrer({ id: 'chausse', nom: 'Chausse-trapes (démineur)', ic: 'trap', creer: function (api) {
    var niveau = api.lire('chausse-niveau', 'ecuyer'); if (!NIVEAUX[niveau]) niveau = 'ecuyer';
    var modeBanniere = false, jeu = null, chrono = api.chrono();

    function nouveau() {
      var N = NIVEAUX[niveau];
      jeu = { l: N.l, h: N.h, pieges: N.pieges, cases: [], pret: false, fini: null, bannieres: 0, sondees: 0 };
      for (var i = 0; i < N.l * N.h; i++) jeu.cases.push({ piege: false, n: 0, vue: false, banniere: false });
      chrono.remise();
    }
    function voisins(i) {
      var x = i % jeu.l, y = Math.floor(i / jeu.l), v = [];
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue; var nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < jeu.l && ny < jeu.h) v.push(ny * jeu.l + nx);
      }
      return v;
    }
    // les pièges sont posés au premier coup, jamais sur la parcelle sondée ni autour d'elle
    function semer(premiere) {
      var interdit = [premiere].concat(voisins(premiere)), libres = [];
      for (var i = 0; i < jeu.cases.length; i++) if (interdit.indexOf(i) < 0) libres.push(i);
      for (var k = 0; k < jeu.pieges && libres.length; k++) { var j = Math.floor(Math.random() * libres.length); jeu.cases[libres.splice(j, 1)[0]].piege = true; }
      jeu.cases.forEach(function (c, i) { c.n = voisins(i).filter(function (v) { return jeu.cases[v].piege; }).length; });
      jeu.pret = true; chrono.demarrer();
    }
    function sonder(i) {
      var c = jeu.cases[i]; if (c.vue || c.banniere) return;
      if (!jeu.pret) semer(i);
      if (c.piege) { c.vue = true; c.fatal = true; finir(false); return; }
      var pile = [i];
      while (pile.length) {
        var k = pile.pop(), d = jeu.cases[k]; if (d.vue || d.banniere) continue;
        d.vue = true; jeu.sondees++;
        if (d.n === 0) voisins(k).forEach(function (v) { if (!jeu.cases[v].vue) pile.push(v); });
      }
      if (jeu.sondees === jeu.cases.length - jeu.pieges) finir(true);
    }
    function accorder(i) {
      var c = jeu.cases[i], vs = voisins(i);
      if (!c.vue || !c.n) return;
      if (vs.filter(function (v) { return jeu.cases[v].banniere; }).length !== c.n) return;
      vs.forEach(function (v) { if (!jeu.fini) sonder(v); });
    }
    function planter(i) { var c = jeu.cases[i]; if (c.vue) return; c.banniere = !c.banniere; jeu.bannieres += c.banniere ? 1 : -1; }
    function finir(gagne) {
      chrono.arreter(); jeu.fini = gagne ? 'gagne' : 'perdu';
      if (gagne) jeu.record = api.record('chausse-' + niveau, chrono.ms(), true);
      else jeu.cases.forEach(function (c) { if (c.piege) c.vue = true; });
      api.son(gagne ? 'flag' : 'bad');
    }
    function agir(i, banniere) {
      if (jeu.fini) return false;
      var c = jeu.cases[i];
      if (banniere) { if (jeu.pret) planter(i); } else if (c.vue) accorder(i); else sonder(i);
      return true;
    }
    nouveau();
    return {
      temps: function () { return chrono.ms(); },
      pause: function () { chrono.pause(); },
      reprise: function () { chrono.reprise(); },
      html: function () {
        var h = [], rec = api.meilleur('chausse-' + niveau);
        h.push('<div class="mj-tete"><div class="mj-titre">Chausse-trapes</div>' +
          '<select class="mj-niveau" aria-label="Difficulté">' + Object.keys(NIVEAUX).map(function (k) { return '<option value="' + k + '"' + (k === niveau ? ' selected' : '') + '>' + NIVEAUX[k].nom + '</option>'; }).join('') + '</select></div>');
        h.push('<div class="mj-barre"><span title="Bannières restant à planter">' + FOF.ic('flag', 13) + ' <b>' + (jeu.pieges - jeu.bannieres) + '</b></span>' +
          '<span class="mj-temps" title="Temps">' + FOF.ic('hourglass', 13) + ' <b>' + api.duree(chrono.ms()) + '</b></span>' +
          '<button type="button" class="mj-mode' + (modeBanniere ? ' on' : '') + '" aria-pressed="' + modeBanniere + '" title="Mode bannière : un clic plante une bannière (utile au pavé tactile)">' + FOF.ic('flag', 13) + '</button>' +
          '<button type="button" class="mj-neuf" title="Nouveau pré">' + FOF.ic('restart', 13) + '</button></div>');
        h.push('<div class="mj-grille" style="--l:' + jeu.l + '" role="grid" aria-label="Pré de ' + jeu.l + ' sur ' + jeu.h + ', ' + jeu.pieges + ' chausse-trapes">');
        jeu.cases.forEach(function (c, i) {
          var cls = 'mj-c', txt = '', lbl = 'parcelle non sondée';
          if (c.vue && c.piege) { cls += ' piege' + (c.fatal ? ' fatal' : ''); txt = FOF.ic('trap', 15); lbl = 'chausse-trape'; }
          else if (c.vue) { cls += ' vue n' + c.n; txt = c.n || ''; lbl = c.n ? c.n + ' pièges autour' : 'rien autour'; }
          else if (c.banniere) { cls += ' ban'; txt = FOF.ic('banner', 14); lbl = 'bannière'; if (jeu.fini === 'perdu' && !c.piege) cls += ' faux'; }
          h.push('<button type="button" class="' + cls + '" data-mj="' + i + '" aria-label="' + lbl + '"' + (jeu.fini ? ' tabindex="-1"' : '') + '>' + txt + '</button>');
        });
        h.push('</div>');
        var pied = jeu.fini === 'gagne' ? '<b>Pré traversé en ' + api.duree(chrono.ms()) + '.</b>' + (jeu.record ? ' Nouveau record.' : '')
          : jeu.fini === 'perdu' ? '<b>Pris au piège.</b> Un nouveau pré ?'
          : !jeu.pret ? 'Sondez une parcelle pour commencer. Clic droit : bannière.'
          : rec ? 'Record ' + NIVEAUX[niveau].nom.toLowerCase() + ' : ' + api.duree(rec) : 'Clic droit : bannière. Clic sur un chiffre : sonder autour.';
        h.push('<div class="mj-pied">' + pied + (jeu.fini ? ' <button type="button" class="mj-neuf mj-rejouer">Rejouer</button>' : '') + '</div>');
        return h.join('');
      },
      clic: function (e) {
        var b = e.target.closest('[data-mj]');
        if (b) return agir(+b.dataset.mj, modeBanniere);
        if (e.target.closest('.mj-neuf')) { nouveau(); return true; }
        if (e.target.closest('.mj-mode')) { modeBanniere = !modeBanniere; return true; }
        return false;
      },
      clicDroit: function (e) { var b = e.target.closest('[data-mj]'); return b ? agir(+b.dataset.mj, true) : false; },
      change: function (e) {
        if (!e.target.classList.contains('mj-niveau')) return false;
        niveau = e.target.value; api.ecrire('chausse-niveau', niveau); nouveau(); return true;
      }
    };
  } });
})(window.FOF = window.FOF || {});
