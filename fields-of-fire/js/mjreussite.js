/* Fields of Fire - mini-jeu « Réussite de la Cour » (patience du Golf, v1.9.16).
   Jeu de 52 cartes aux couleurs latines (coupes, deniers, épées, bâtons), valeurs 1 à 10, Valet,
   Cavalier, Roi. Sept colonnes de cinq cartes découvertes ; seule la dernière carte de chaque colonne
   est jouable. On la pose sur la défausse si sa valeur est juste au-dessus ou juste en dessous de la
   carte du dessus ; le Roi et le 1 se suivent (Cavalier, Roi, 1, 2…). Quand plus rien ne va,
   on retourne la pioche. But : vider les sept colonnes. Score = cartes restées dans les colonnes. */
(function (FOF) {
  'use strict';
  var COUL = ['coupe', 'denier', 'epee', 'baton'], NOMC = { coupe: 'coupes', denier: 'deniers', epee: 'épées', baton: 'bâtons' };
  var RANG = ['', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'V', 'C', 'R'];
  var NOMR = ['', 'as', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'valet', 'cavalier', 'roi'];
  var R = {};
  // variante « bouclée » : le Roi et le 1 se suivent. Mesuré sur 4 000 donnes jouées par un glouton :
  // 0,8 % de réussites avec la règle classique (rien sur un Roi), 18 % en bouclant ; c'est la seconde.
  R.jouable = function (carte, dessus) { var e = dessus ? Math.abs(carte.r - dessus.r) : 0; return !!dessus && (e === 1 || e === 12); };
  R.donne = function (alea) {
    alea = alea || Math.random;
    var jeu = []; COUL.forEach(function (c) { for (var r = 1; r <= 13; r++) jeu.push({ c: c, r: r }); });
    for (var i = jeu.length - 1; i > 0; i--) { var j = Math.floor(alea() * (i + 1)), t = jeu[i]; jeu[i] = jeu[j]; jeu[j] = t; }
    var cols = []; for (var k = 0; k < 7; k++) cols.push(jeu.splice(0, 5));
    var def = [jeu.pop()];
    return { cols: cols, pioche: jeu, def: def };
  };
  R.coupsPossibles = function (s) { var d = s.def[s.def.length - 1]; return s.cols.map(function (col, i) { return col.length && R.jouable(col[col.length - 1], d) ? i : -1; }).filter(function (i) { return i >= 0; }); };
  FOF.ReussiteRegles = R;

  FOF.Minijeux.enregistrer({ id: 'reussite', nom: 'Réussite de la Cour (patience)', ic: 'reussite', creer: function (api) {
    var s, fini, histo, chrono = api.chrono();
    function nouveau() { s = R.donne(); fini = false; histo = []; chrono.remise(); }
    function restantes() { return s.cols.reduce(function (n, c) { return n + c.length; }, 0); }
    function verifierFin() {
      var reste = restantes();
      if (!reste) fini = { gagne: true, score: -s.pioche.length };
      else if (!s.pioche.length && !R.coupsPossibles(s).length) fini = { gagne: false, score: reste };
      if (fini) { chrono.arreter(); fini.rec = api.record('reussite', fini.score, true); api.son(fini.gagne ? 'flag' : 'page'); }
    }
    function memo() { histo.push(JSON.stringify(s)); if (histo.length > 60) histo.shift(); }
    function jouer(i) {
      var col = s.cols[i]; if (fini || !col.length) return false;
      var c = col[col.length - 1]; if (!R.jouable(c, s.def[s.def.length - 1])) { api.son('error'); return false; }
      if (!chrono.marche) chrono.demarrer();
      memo(); s.def.push(col.pop()); api.son('card'); verifierFin(); return true;
    }
    function piocher() {
      if (fini || !s.pioche.length) return false;
      if (!chrono.marche) chrono.demarrer();
      memo(); s.def.push(s.pioche.pop()); api.son('card'); verifierFin(); return true;
    }
    function carte(c, cls, attrs) {
      return '<span class="rs-carte ' + c.c + (cls ? ' ' + cls : '') + '"' + (attrs || '') + ' aria-label="' + NOMR[c.r] + ' de ' + NOMC[c.c] + '"><b>' + RANG[c.r] + '</b>' + FOF.ic(c.c, 15) + '</span>';
    }
    nouveau();
    return {
      temps: function () { return chrono.ms(); },
      pause: function () { chrono.pause(); },
      reprise: function () { chrono.reprise(); },
      html: function () {
        var rec = api.meilleur('reussite'), d = s.def[s.def.length - 1], possibles = R.coupsPossibles(s);
        var h = '<div class="mj-tete"><div class="mj-titre">Réussite de la Cour</div><button type="button" class="mj-neuf" title="Nouvelle donne">' + FOF.ic('restart', 13) + '</button></div>' +
          '<div class="mj-barre"><span title="Cartes restant dans les colonnes">' + FOF.ic('reussite', 13) + ' <b>' + restantes() + '</b></span><span class="mj-temps" title="Temps">' + FOF.ic('hourglass', 13) + ' <b>' + api.duree(chrono.ms()) + '</b></span>' +
          '<button type="button" class="rs-annuler" title="Annuler le dernier coup"' + (histo.length && !fini ? '' : ' disabled') + '><span style="display:inline-flex;transform:rotate(180deg)">' + FOF.ic('arrow', 13) + '</span></button></div><div class="rs-cols">';
        s.cols.forEach(function (col, i) {
          h += '<div class="rs-col">';
          col.forEach(function (c, k) {
            var der = k === col.length - 1;
            h += der ? carte(c, 'der' + (possibles.indexOf(i) >= 0 ? ' ok' : ''), ' data-rs="' + i + '" role="button" tabindex="0"') : carte(c, '');
          });
          h += '</div>';
        });
        h += '</div><div class="rs-bas"><button type="button" class="rs-pioche"' + (s.pioche.length && !fini ? '' : ' disabled') + ' title="Retourner une carte de la pioche"><span>' + s.pioche.length + '</span></button>' +
          '<div class="rs-def">' + (d ? carte(d, 'dessus') : '') + '</div><div class="rs-aide">Posez une carte d’une valeur juste au-dessus ou en dessous. Le Roi et le 1 se suivent.</div></div>';
        h += '<div class="mj-pied">' + (fini ? (fini.gagne ? '<b>Colonnes vidées !</b> ' + (s.pioche.length ? 'Avec ' + s.pioche.length + ' cartes d’avance.' : '') : '<b>Plus rien à jouer.</b> ' + fini.score + ' cartes restantes.') + (fini.rec ? ' Record.' : '') + ' <button type="button" class="mj-neuf mj-rejouer">Rejouer</button>'
          : rec !== undefined ? 'Record : ' + (rec <= 0 ? 'colonnes vidées' + (rec < 0 ? ' avec ' + (-rec) + ' d’avance' : '') : rec + ' cartes restantes') + '.' : 'Videz les sept colonnes.') + '</div>';
        return h;
      },
      clic: function (e) {
        var b = e.target.closest('[data-rs]'); if (b) return jouer(+b.dataset.rs);
        if (e.target.closest('.rs-pioche')) return piocher();
        if (e.target.closest('.rs-annuler')) { if (!histo.length || fini) return false; s = JSON.parse(histo.pop()); return true; }
        if (e.target.closest('.mj-neuf')) { nouveau(); return true; }
        return false;
      },
      touche: function (e) { if (e.key !== 'Enter' && e.key !== ' ') return false; var b = document.activeElement && document.activeElement.closest && document.activeElement.closest('[data-rs]'); if (!b) return false; e.preventDefault(); return jouer(+b.dataset.rs); }
    };
  } });
})(window.FOF = window.FOF || {});
