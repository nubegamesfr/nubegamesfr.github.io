/* Fields of Fire - mini-jeu « Trésor » (façon 2048, v1.9.16).
   Une grille de 4 × 4 ; chaque poussée fait glisser toutes les pièces d'un côté, deux pièces de même
   valeur fusionnent en la pièce suivante : obole, denier, sou, gros, écu, florin, ducat, bourse,
   coffre, trésor, couronne. Une nouvelle pièce apparaît après chaque poussée. La partie s'arrête
   quand plus rien ne peut bouger. Flèches du clavier, boutons sous la grille, ou glisser la souris. */
(function (FOF) {
  'use strict';
  var NOMS = ['', 'Obole', 'Denier', 'Sou', 'Gros', 'Écu', 'Florin', 'Ducat', 'Bourse', 'Coffre', 'Trésor', 'Couronne', 'Royaume', 'Empire'];
  var N = 4;
  /* règles pures : la grille est un tableau de 16 rangs (0 vide, k = pièce de valeur 2^k) */
  var R = {};
  R.glisserLigne = function (l) {   // vers le début de la ligne ; renvoie [ligne, points]
    var v = l.filter(function (x) { return x; }), out = [], pts = 0;
    for (var i = 0; i < v.length; i++) {
      if (i + 1 < v.length && v[i] === v[i + 1]) { out.push(v[i] + 1); pts += Math.pow(2, v[i] + 1); i++; }
      else out.push(v[i]);
    }
    while (out.length < N) out.push(0);
    return [out, pts];
  };
  R.pousser = function (g, dir) {   // dir : 'g', 'd', 'h', 'b' ; renvoie {g, pts, bouge}
    var ng = g.slice(), pts = 0, bouge = false;
    for (var k = 0; k < N; k++) {
      var idx = [];
      for (var j = 0; j < N; j++) {
        if (dir === 'g') idx.push(k * N + j); else if (dir === 'd') idx.push(k * N + (N - 1 - j));
        else if (dir === 'h') idx.push(j * N + k); else idx.push((N - 1 - j) * N + k);
      }
      var r = R.glisserLigne(idx.map(function (i) { return g[i]; }));
      pts += r[1];
      idx.forEach(function (i, j) { if (ng[i] !== r[0][j]) bouge = true; ng[i] = r[0][j]; });
    }
    return { g: ng, pts: pts, bouge: bouge };
  };
  R.poser = function (g, alea) {
    alea = alea || Math.random;
    var libres = []; g.forEach(function (v, i) { if (!v) libres.push(i); });
    if (!libres.length) return g;
    var ng = g.slice(); ng[libres[Math.floor(alea() * libres.length)]] = alea() < 0.9 ? 1 : 2; return ng;
  };
  R.bloque = function (g) { return ['g', 'd', 'h', 'b'].every(function (d) { return !R.pousser(g, d).bouge; }); };
  FOF.TresorRegles = R;

  var DIRS = { ArrowLeft: 'g', ArrowRight: 'd', ArrowUp: 'h', ArrowDown: 'b' };
  FOF.Minijeux.enregistrer({ id: 'tresor', nom: 'Trésor (façon 2048)', ic: 'coins', creer: function (api) {
    var g, score, fini, couronne, depart = null, neuves = {};
    function nouveau() { g = R.poser(R.poser(new Array(N * N).fill(0))); score = 0; fini = false; couronne = false; neuves = {}; }
    function pousser(d) {
      if (fini) return false;
      var r = R.pousser(g, d); if (!r.bouge) return false;
      var avant = r.g.slice(); g = R.poser(r.g); score += r.pts;
      neuves = {}; g.forEach(function (v, i) { if (v && !avant[i]) neuves[i] = 1; });
      if (!couronne && g.some(function (v) { return v >= 11; })) { couronne = true; api.son('flag'); }
      if (R.bloque(g)) { fini = true; api.record('tresor-score', score, false); api.record('tresor-piece', Math.max.apply(null, g), false); api.son('page'); }
      else if (r.pts) api.son('click');
      return true;
    }
    nouveau();
    return {
      html: function () {
        var best = api.meilleur('tresor-score') || 0;
        var h = '<div class="mj-tete"><div class="mj-titre">Trésor</div><button type="button" class="mj-neuf" title="Nouvelle partie">' + FOF.ic('restart', 13) + '</button></div>' +
          '<div class="mj-barre"><span title="Score">' + FOF.ic('coins', 13) + ' <b>' + score + '</b></span><span title="Meilleur score">' + FOF.ic('crown', 13) + ' <b>' + Math.max(best, fini ? score : 0) + '</b></span></div>' +
          '<div class="tr-grille" tabindex="0" aria-label="Grille du trésor. Flèches du clavier pour pousser.">';
        g.forEach(function (v, i) {
          h += '<div class="tr-c' + (v ? ' v' + Math.min(v, 13) : '') + (neuves[i] ? ' neuve' : '') + '">' + (v ? '<b>' + Math.pow(2, v) + '</b><small>' + NOMS[Math.min(v, 13)] + '</small>' : '') + '</div>';
        });
        h += '</div><div class="tr-fleches">' + [['g', 180, 'Pousser à gauche'], ['h', -90, 'Pousser vers le haut'], ['b', 90, 'Pousser vers le bas'], ['d', 0, 'Pousser à droite']].map(function (f) {
          return '<button type="button" data-dir="' + f[0] + '" aria-label="' + f[2] + '" title="' + f[2] + '"><span style="display:inline-flex;transform:rotate(' + f[1] + 'deg)">' + FOF.ic('arrow', 15) + '</span></button>'; }).join('') + '</div>';
        h += '<div class="mj-pied">' + (fini ? '<b>Plus un geste possible.</b> ' + score + ' points. <button type="button" class="mj-neuf mj-rejouer">Rejouer</button>'
          : couronne ? '<b>La Couronne est à vous !</b> Continuez pour l’Empire.' : 'Deux pièces pareilles fusionnent. Visez la Couronne (2048).') + '</div>';
        return h;
      },
      clic: function (e) {
        var b = e.target.closest('[data-dir]'); if (b) return pousser(b.dataset.dir);
        if (e.target.closest('.mj-neuf')) { nouveau(); return true; }
        return false;
      },
      touche: function (e) { var d = DIRS[e.key]; if (!d) return false; e.preventDefault(); return pousser(d); },
      appui: function (e) { if (e.target.closest('.tr-grille')) depart = [e.clientX, e.clientY]; return false; },
      relache: function (e) {
        if (!depart) return false; var dx = e.clientX - depart[0], dy = e.clientY - depart[1]; depart = null;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return false;
        return pousser(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'd' : 'g') : (dy > 0 ? 'b' : 'h'));
      }
    };
  } });
})(window.FOF = window.FOF || {});
