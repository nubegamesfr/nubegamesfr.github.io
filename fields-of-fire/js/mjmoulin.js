/* Fields of Fire - mini-jeu « Le Moulin » (jeu de la marelle / des neuf pions, v1.9.16).
   Règles du jeu médiéval : 24 intersections, 9 pions chacun.
   1. Pose : chacun pose un pion à tour de rôle sur une intersection libre.
   2. Déplacement : une fois tous les pions posés, on glisse un pion vers une intersection voisine libre.
   3. Vol : un joueur réduit à 3 pions peut sauter sur n'importe quelle intersection libre.
   Aligner 3 pions sur une ligne forme un moulin : on retire alors un pion adverse qui n'est pas dans un
   moulin (sauf si tous le sont). On perd avec moins de 3 pions, ou si l'on ne peut plus bouger.
   Nulle après 40 coups de déplacement sans prise. Le joueur a les pions clairs et commence. */
(function (FOF) {
  'use strict';
  // intersections sur une grille 7 × 7
  var P = [[0,0],[3,0],[6,0],[1,1],[3,1],[5,1],[2,2],[3,2],[4,2],[0,3],[1,3],[2,3],[4,3],[5,3],[6,3],[2,4],[3,4],[4,4],[1,5],[3,5],[5,5],[0,6],[3,6],[6,6]];
  var MOULINS = [[0,1,2],[3,4,5],[6,7,8],[9,10,11],[12,13,14],[15,16,17],[18,19,20],[21,22,23],
                 [0,9,21],[3,10,18],[6,11,15],[1,4,7],[16,19,22],[8,12,17],[5,13,20],[2,14,23]];
  var ADJ = P.map(function () { return []; });
  MOULINS.forEach(function (m) { [[0,1],[1,2]].forEach(function (p) { ADJ[m[p[0]]].push(m[p[1]]); ADJ[m[p[1]]].push(m[p[0]]); }); });

  /* ---------- règles pures (testables sans interface) ---------- */
  var R = {};
  R.neuf = function () { return { b: new Array(24).fill(0), aPoser: [0, 9, 9], trait: 1, sansPrise: 0, fini: null }; };
  R.copie = function (s) { return { b: s.b.slice(), aPoser: s.aPoser.slice(), trait: s.trait, sansPrise: s.sansPrise, fini: s.fini }; };
  R.nb = function (s, p) { var n = 0; for (var i = 0; i < 24; i++) if (s.b[i] === p) n++; return n; };
  R.dansMoulin = function (b, i, p) { return MOULINS.some(function (m) { return m.indexOf(i) >= 0 && b[m[0]] === p && b[m[1]] === p && b[m[2]] === p; }); };
  R.retirables = function (b, p) {   // pions de p que l'adversaire peut retirer
    var tous = [], hors = [];
    for (var i = 0; i < 24; i++) if (b[i] === p) { tous.push(i); if (!R.dansMoulin(b, i, p)) hors.push(i); }
    return hors.length ? hors : tous;
  };
  R.vole = function (s, p) { return s.aPoser[p] === 0 && R.nb(s, p) === 3; };
  // déplacements élémentaires (sans le retrait) : {de, vers}
  R.pas = function (s, p) {
    var out = [], i;
    if (s.aPoser[p] > 0) { for (i = 0; i < 24; i++) if (!s.b[i]) out.push({ de: -1, vers: i }); return out; }
    var vol = R.vole(s, p);
    for (i = 0; i < 24; i++) if (s.b[i] === p) {
      var cibles = vol ? P.map(function (_, k) { return k; }) : ADJ[i];
      cibles.forEach(function (k) { if (!s.b[k]) out.push({ de: i, vers: k }); });
    }
    return out;
  };
  // coups complets, retrait compris : {de, vers, ret} (ret = -1 sans moulin)
  R.coups = function (s, p) {
    var o = 3 - p, out = [];
    R.pas(s, p).forEach(function (m) {
      var b = s.b.slice(); if (m.de >= 0) b[m.de] = 0; b[m.vers] = p;
      var rs = R.dansMoulin(b, m.vers, p) ? R.retirables(b, o) : [];
      if (rs.length) rs.forEach(function (r) { out.push({ de: m.de, vers: m.vers, ret: r }); });
      else out.push({ de: m.de, vers: m.vers, ret: -1 });   // moulin sans pion adverse à prendre : rien à retirer
    });
    return out;
  };
  // joue un coup complet et renvoie le nouvel état (fin de partie comprise)
  R.jouer = function (s, m) {
    var n = R.copie(s), p = s.trait, o = 3 - p, posait = n.aPoser[p] > 0;
    if (m.de >= 0) n.b[m.de] = 0; else n.aPoser[p]--;
    n.b[m.vers] = p;
    if (m.ret >= 0) { n.b[m.ret] = 0; n.sansPrise = 0; } else if (!posait) n.sansPrise++;
    n.trait = o;
    if (n.aPoser[o] === 0 && R.nb(n, o) + n.aPoser[o] < 3) n.fini = p;
    else if (!R.pas(n, o).length) n.fini = p;
    else if (n.sansPrise >= 40) n.fini = 'nulle';
    return n;
  };
  // évaluation du point de vue de p
  R.eval = function (s, p) {
    if (s.fini === p) return 1000; if (s.fini && s.fini !== 'nulle') return -1000; if (s.fini === 'nulle') return 0;
    var o = 3 - p, v = 12 * (R.nb(s, p) + s.aPoser[p] - R.nb(s, o) - s.aPoser[o]);
    MOULINS.forEach(function (m) {
      var a = 0, c = 0, v0 = 0; m.forEach(function (i) { if (s.b[i] === p) a++; else if (s.b[i] === o) c++; else v0++; });
      if (a === 2 && v0 === 1) v += 3; if (c === 2 && v0 === 1) v -= 3; if (a === 3) v += 2; if (c === 3) v -= 2;
    });
    if (s.aPoser[p] === 0 && s.aPoser[o] === 0) v += 0.3 * (R.pas(s, p).length - R.pas(s, o).length);
    return v;
  };
  function alphabeta(s, prof, a, b, p) {
    if (s.fini || prof === 0) return R.eval(s, p);
    var cs = R.coups(s, s.trait);
    if (s.trait === p) { var best = -1e9; for (var i = 0; i < cs.length; i++) { best = Math.max(best, alphabeta(R.jouer(s, cs[i]), prof - 1, a, b, p)); a = Math.max(a, best); if (a >= b) break; } return best; }
    var worst = 1e9; for (var j = 0; j < cs.length; j++) { worst = Math.min(worst, alphabeta(R.jouer(s, cs[j]), prof - 1, a, b, p)); b = Math.min(b, worst); if (a >= b) break; } return worst;
  }
  // choix de l'ordinateur ; prof 0 = écuyer (au hasard, saisit un moulin une fois sur deux)
  R.choisir = function (s, prof) {
    var p = s.trait, cs = R.coups(s, p);
    if (!cs.length) return null;
    if (!prof) {
      var prises = cs.filter(function (c) { return c.ret >= 0; });
      if (prises.length && Math.random() < 0.5) return prises[Math.floor(Math.random() * prises.length)];
      return cs[Math.floor(Math.random() * cs.length)];
    }
    // on mélange avant de trier : à valeur égale, pas toujours le même coup
    cs.sort(function () { return Math.random() - 0.5; });
    cs.sort(function (x, y) { return (y.ret >= 0) - (x.ret >= 0); });
    var best = null, bv = -1e9;
    cs.forEach(function (c) { var v = alphabeta(R.jouer(s, c), prof - 1, -1e9, 1e9, p); if (v > bv) { bv = v; best = c; } });
    return best;
  };
  FOF.MoulinRegles = R;

  /* ---------- interface ---------- */
  var NIVEAUX = { ecuyer: { nom: 'Écuyer', prof: 0 }, chevalier: { nom: 'Chevalier', prof: 2 }, seigneur: { nom: 'Seigneur', prof: 3 } };
  FOF.Minijeux.enregistrer({ id: 'moulin', nom: 'Le Moulin (jeu de la marelle)', ic: 'moulin', creer: function (api) {
    var niveau = api.lire('moulin-niveau', 'chevalier'); if (!NIVEAUX[niveau]) niveau = 'chevalier';
    var s, sel = -1, enAttente = null, retrait = null, dernier = null, pensee = null;
    function nouveau() { s = R.neuf(); sel = -1; enAttente = null; retrait = null; dernier = null; clearTimeout(pensee); pensee = null; }
    function finPartie() {
      if (!s.fini) return;
      var v = api.lire('moulin-bilan', {}), k = niveau; v[k] = v[k] || [0, 0, 0];
      v[k][s.fini === 1 ? 0 : s.fini === 2 ? 1 : 2]++; api.ecrire('moulin-bilan', v);
      api.son(s.fini === 1 ? 'flag' : s.fini === 2 ? 'bad' : 'page');
    }
    function tourOrdi() {
      if (s.fini || s.trait !== 2 || pensee) return;
      pensee = setTimeout(function joue() {
        if (!api.visible()) { pensee = setTimeout(joue, 500); return; }   // on attend que le joueur revienne
        pensee = null;
        var c = R.choisir(s, NIVEAUX[niveau].prof); if (!c) return;
        s = R.jouer(s, c); dernier = c; api.son('click'); finPartie(); api.rendre();
      }, 450);
    }
    function jouerHumain(c) { s = R.jouer(s, c); dernier = c; sel = -1; enAttente = null; retrait = null; api.son('click'); finPartie(); tourOrdi(); }
    function clicPoint(i) {
      if (s.fini || s.trait !== 1 || pensee) return false;
      if (retrait) {   // on vient de former un moulin : on choisit le pion adverse à retirer
        if (retrait.indexOf(i) < 0) return false;
        jouerHumain({ de: enAttente.de, vers: enAttente.vers, ret: i }); return true;
      }
      var pas = R.pas(s, 1);
      if (s.aPoser[1] > 0 || sel >= 0) {
        var m = pas.filter(function (x) { return x.vers === i && (s.aPoser[1] > 0 || x.de === sel); })[0];
        if (m) {
          var b = s.b.slice(); if (m.de >= 0) b[m.de] = 0; b[m.vers] = 1;
          var rs = R.dansMoulin(b, m.vers, 1) ? R.retirables(b, 2) : [];
          if (rs.length) { enAttente = m; retrait = rs; return true; }
          jouerHumain({ de: m.de, vers: m.vers, ret: -1 }); return true;
        }
      }
      if (s.b[i] === 1 && s.aPoser[1] === 0) { sel = pas.some(function (x) { return x.de === i; }) ? (sel === i ? -1 : i) : -1; return true; }
      return false;
    }
    nouveau();
    return {
      html: function () {
        var S = 32, O = 18, W = S * 6 + O * 2;
        var bLive = s.b.slice(); if (enAttente) { if (enAttente.de >= 0) bLive[enAttente.de] = 0; bLive[enAttente.vers] = 1; }
        var cibles = {};
        if (!s.fini && s.trait === 1 && !retrait && (s.aPoser[1] > 0 || sel >= 0)) R.pas(s, 1).forEach(function (m) { if (s.aPoser[1] > 0 || m.de === sel) cibles[m.vers] = 1; });
        var g = ['<svg class="mj-moulin" viewBox="0 0 ' + W + ' ' + W + '" role="img" aria-label="Plateau du moulin">'];
        [0, 1, 2].forEach(function (k) { var a = O + k * S, l = (6 - 2 * k) * S; g.push('<rect x="' + a + '" y="' + a + '" width="' + l + '" height="' + l + '" class="ml-l"/>'); });
        g.push('<path class="ml-l" d="M' + (O + 3 * S) + ' ' + O + 'V' + (O + 2 * S) + 'M' + (O + 3 * S) + ' ' + (O + 4 * S) + 'V' + (O + 6 * S) + 'M' + O + ' ' + (O + 3 * S) + 'H' + (O + 2 * S) + 'M' + (O + 4 * S) + ' ' + (O + 3 * S) + 'H' + (O + 6 * S) + '"/>');
        P.forEach(function (pt, i) {
          var x = O + pt[0] * S, y = O + pt[1] * S, v = bLive[i];
          var cls = 'ml-pt' + (cibles[i] ? ' cible' : '') + (retrait && retrait.indexOf(i) >= 0 ? ' prise' : '') + (i === sel ? ' sel' : '') + (dernier && (dernier.vers === i) && s.trait === 1 ? ' dernier' : '');
          g.push('<g class="' + cls + '" data-pt="' + i + '"><circle class="ml-zone" cx="' + x + '" cy="' + y + '" r="14"/>' +
            (v ? '<circle class="ml-pion p' + v + '" cx="' + x + '" cy="' + y + '" r="10.5"/>' : '<circle class="ml-trou" cx="' + x + '" cy="' + y + '" r="3.4"/>') + '</g>');
        });
        g.push('</svg>');
        var bilan = api.lire('moulin-bilan', {})[niveau] || [0, 0, 0];
        var etat = s.fini === 1 ? '<b>Victoire.</b>' : s.fini === 2 ? '<b>Défaite.</b>' : s.fini === 'nulle' ? '<b>Partie nulle</b> (40 coups sans prise).'
          : retrait ? 'Moulin ! Retirez un pion sombre (entouré).'
          : s.trait === 2 ? 'L’adversaire réfléchit…'
          : s.aPoser[1] > 0 ? 'Posez un pion sur une intersection libre.'
          : R.vole(s, 1) ? 'Plus que 3 pions : vous pouvez sauter n’importe où.'
          : sel >= 0 ? 'Choisissez où glisser ce pion.' : 'Choisissez un pion à déplacer.';
        return '<div class="mj-tete"><div class="mj-titre">Le Moulin</div><select class="mj-niveau" aria-label="Adversaire">' +
          Object.keys(NIVEAUX).map(function (k) { return '<option value="' + k + '"' + (k === niveau ? ' selected' : '') + '>' + NIVEAUX[k].nom + '</option>'; }).join('') + '</select></div>' +
          '<div class="mj-barre"><span title="Vos pions : sur le plateau / à poser"><i class="ml-mini p1"></i> <b>' + R.nb(s, 1) + '</b>' + (s.aPoser[1] ? ' +' + s.aPoser[1] : '') + '</span>' +
          '<span title="Pions adverses : sur le plateau / à poser"><i class="ml-mini p2"></i> <b>' + R.nb(s, 2) + '</b>' + (s.aPoser[2] ? ' +' + s.aPoser[2] : '') + '</span>' +
          '<button type="button" class="mj-neuf" title="Nouvelle partie">' + FOF.ic('restart', 13) + '</button></div>' +
          g.join('') + '<div class="mj-pied">' + etat + ' <span class="mj-bilan" title="Victoires, défaites, nulles à ce niveau">' + bilan[0] + ' V · ' + bilan[1] + ' D</span>' +
          (s.fini ? ' <button type="button" class="mj-neuf mj-rejouer">Rejouer</button>' : '') + '</div>';
      },
      clic: function (e) {
        var p = e.target.closest('[data-pt]'); if (p) return clicPoint(+p.dataset.pt);
        if (e.target.closest('.mj-neuf')) { nouveau(); return true; }
        return false;
      },
      change: function (e) {
        if (!e.target.classList.contains('mj-niveau')) return false;
        niveau = e.target.value; api.ecrire('moulin-niveau', niveau); nouveau(); return true;
      },
      reprise: function () { tourOrdi(); }
    };
  } });
})(window.FOF = window.FOF || {});
