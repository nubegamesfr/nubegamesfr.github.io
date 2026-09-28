/* Fields of Fire - mini-jeu « Taquin » (v1.9.16).
   Une illustration d'unité est découpée en carreaux, un carreau manque. On clique un carreau aligné
   avec la case vide pour le faire glisser (toute la rangée suit). Le mélange part de l'image
   reconstituée et enchaîne des glissements permis : la grille est donc toujours soluble. */
(function (FOF) {
  'use strict';
  var NIVEAUX = { ecuyer: { nom: 'Écuyer', n: 3 }, chevalier: { nom: 'Chevalier', n: 4 }, seigneur: { nom: 'Seigneur', n: 5 } };
  var T = 228;   // côté du plateau en pixels
  FOF.Minijeux.enregistrer({ id: 'taquin', nom: 'Taquin', ic: 'taquin', creer: function (api) {
    var niveau = api.lire('taquin-niveau', 'ecuyer'); if (!NIVEAUX[niveau]) niveau = 'ecuyer';
    var n, cases, vide, coups, fini, art, nom, chrono = api.chrono();
    function toutes() { return Object.keys(FOF.ELITES).concat(Object.keys(FOF.SPECIALS)).filter(function (k) { return FOF.unitArt(k); }); }
    function nouveau() {
      n = NIVEAUX[niveau].n; cases = []; for (var i = 0; i < n * n; i++) cases.push(i);   // la valeur n*n-1 est la case vide
      vide = n * n - 1; coups = 0; fini = false; chrono.remise();
      var ks = toutes(), k = ks[Math.floor(Math.random() * ks.length)]; art = FOF.unitArt(k); nom = FOF.unitDef(k).name;
      var prec = -1;
      for (var m = 0; m < 60 * n * n; m++) {
        var vs = voisins(vide).filter(function (v) { return v !== prec; }), v = vs[Math.floor(Math.random() * vs.length)];
        prec = vide; cases[vide] = cases[v]; cases[v] = n * n - 1; vide = v;
      }
      if (range()) nouveau();
    }
    function voisins(p) { var x = p % n, y = Math.floor(p / n), o = []; if (x) o.push(p - 1); if (x < n - 1) o.push(p + 1); if (y) o.push(p - n); if (y < n - 1) o.push(p + n); return o; }
    function range() { return cases.every(function (v, i) { return v === i; }); }
    function glisser(p) {
      if (fini || p === vide) return false;
      var px = p % n, py = Math.floor(p / n), vx = vide % n, vy = Math.floor(vide / n);
      if (px !== vx && py !== vy) return false;
      var pas = px === vx ? (py < vy ? -n : n) : (px < vx ? -1 : 1);
      if (!chrono.marche) chrono.demarrer();
      while (vide !== p) { var s = vide + pas; cases[vide] = cases[s]; cases[s] = n * n - 1; vide = s; coups++; }
      api.son('tap');
      if (range()) { fini = true; chrono.arreter(); fini = { rec: api.record('taquin-' + niveau, coups, true) }; api.son('flag'); }
      return true;
    }
    function fond(v) {   // position de ce morceau dans l'illustration recadrée au carré
      var t = T / n, W = T * 800 / 488, ox = (W - T) / 2;
      return 'background-image:url(' + art + ');background-size:' + W.toFixed(1) + 'px ' + T + 'px;background-position:' + (-(v % n) * t - ox).toFixed(1) + 'px ' + (-Math.floor(v / n) * t).toFixed(1) + 'px';
    }
    nouveau();
    return {
      temps: function () { return chrono.ms(); },
      pause: function () { chrono.pause(); },
      reprise: function () { chrono.reprise(); },
      html: function () {
        var rec = api.meilleur('taquin-' + niveau), t = T / n;
        var h = '<div class="mj-tete"><div class="mj-titre">Taquin</div><select class="mj-niveau" aria-label="Taille">' +
          Object.keys(NIVEAUX).map(function (k) { return '<option value="' + k + '"' + (k === niveau ? ' selected' : '') + '>' + NIVEAUX[k].nom + ' · ' + NIVEAUX[k].n + '×' + NIVEAUX[k].n + '</option>'; }).join('') + '</select></div>' +
          '<div class="mj-barre"><span title="Coups">' + FOF.ic('move', 13) + ' <b>' + coups + '</b></span><span class="mj-temps" title="Temps">' + FOF.ic('hourglass', 13) + ' <b>' + api.duree(chrono.ms()) + '</b></span>' +
          '<button type="button" class="mj-neuf" title="Nouvelle image">' + FOF.ic('restart', 13) + '</button></div>' +
          '<div class="tq-plateau' + (fini ? ' fini' : '') + '" style="width:' + T + 'px;height:' + T + 'px">';
        cases.forEach(function (v, p) {
          var st = 'width:' + t + 'px;height:' + t + 'px;left:' + (p % n) * t + 'px;top:' + Math.floor(p / n) * t + 'px;';
          if (v === n * n - 1 && !fini) h += '<div class="tq-vide" style="' + st + '"></div>';
          else h += '<button type="button" class="tq-c" data-tq="' + p + '" style="' + st + fond(v) + '" aria-label="carreau ' + (v + 1) + '"></button>';
        });
        h += '</div><div class="mj-pied">' + (fini ? '<b>' + nom + '</b> reconstitué en ' + coups + ' coups.' + (fini.rec ? ' Record.' : '') + ' <button type="button" class="mj-neuf mj-rejouer">Rejouer</button>'
          : rec ? 'Record ' + NIVEAUX[niveau].nom.toLowerCase() + ' : ' + rec + ' coups.' : 'Cliquez un carreau aligné avec la case vide.') + '</div>';
        return h;
      },
      clic: function (e) {
        var b = e.target.closest('[data-tq]'); if (b) return glisser(+b.dataset.tq);
        if (e.target.closest('.mj-neuf')) { nouveau(); return true; }
        return false;
      },
      change: function (e) { if (!e.target.classList.contains('mj-niveau')) return false; niveau = e.target.value; api.ecrire('taquin-niveau', niveau); nouveau(); return true; }
    };
  } });
})(window.FOF = window.FOF || {});
