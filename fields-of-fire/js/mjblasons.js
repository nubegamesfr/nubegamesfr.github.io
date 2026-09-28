/* Fields of Fire - mini-jeu « Blasons » (picross / nonogramme, v1.9.16).
   Les chiffres au bout de chaque ligne et de chaque colonne donnent, dans l'ordre, la longueur des
   suites de cases pleines. On noircit les cases (clic, ou glisser pour en peindre plusieurs), on
   marque d'une croix celles qu'on sait vides (clic droit, ou mode croix). Une fois toutes les lignes
   justes, le dessin apparaît : ce sont les icônes du jeu. Les grilles ont été générées à partir des
   icônes et vérifiées : chacune se résout par la seule logique des lignes, sans deviner. */
(function (FOF) {
  'use strict';
  var GRILLES = [{"nom":"La Tour","src":"bld-F","n":10,"g":"0011111100001111110000100001000011000100001011010000100001000010000100001000010000100001000011111100"},{"nom":"L'Ancre","src":"bld-P","n":10,"g":"0000110000000111000000011110000011111100000011000001001100100110110110011111111000110111000000110000"},{"nom":"La Tente","src":"bld-C","n":10,"g":"0000000000000011000000011110000011111100001111111001111111100110110110011111111011111111110000000000"},{"nom":"La Maison","src":"bld-Ci","n":10,"g":"0000000000111111111110010010011111001111111100111111110011111111111111010011001000001100000000000000"},{"nom":"L'Église","src":"bld-T","n":10,"g":"0000110000000011000000011110000001111000000111100000110011000111001110011111111001111111100111111110"},{"nom":"L'Ambassade","src":"bld-A","n":10,"g":"0000000000111111111110010010011111001111110100101111111111111111111111111011011111011110110000000000"},{"nom":"Le Sceau","src":"dip","n":10,"g":"0000001111000000100100000100010001111011001111110001111111001100111100111111100011110000001110000000"},{"nom":"La Bannière","src":"terr","n":10,"g":"0000111101000011111100001100110000111111000011001000001100000001111000011100111011000000111000000001"},{"nom":"Le Chêne","src":"biome-F","n":10,"g":"0001111000001100110001100001100110110110010111101001011110100110110110001111110000001100000001111000"},{"nom":"Le Marais","src":"biome-Ma","n":10,"g":"0000000000011000000011110000001111000110111100011101111111101111000111111000000111110011110011111100"},{"nom":"Les Champs","src":"biome-P","n":10,"g":"0000000000111100011100001100001111100001111111111111111111111111111111111111111110010010010000000000"},{"nom":"La Couronne","src":"crown","n":10,"g":"0000000000000010000000101101001100110011110111101111111111111111111111111111111111000000110000000000"},{"nom":"La Tour","src":"bld-F","n":12,"g":"001111111100001111111100001100001100000100001100000101101000000101101000001101101100001100001100001100001100001100001100001100001100001111111100"},{"nom":"L'Ancre","src":"bld-P","n":12,"g":"000011110000000011110000000011110000000111111000000111111000000001100000011001100110011101101110011101101110011111111110001111111100000011110000"},{"nom":"La Tente","src":"bld-C","n":12,"g":"000000000000000001100000000011100000000011110000001111111100001111111100001111111100011111101110011111111110111111111110111111111111000000000000"},{"nom":"La Maison","src":"bld-Ci","n":12,"g":"000000000000011111111110100010010001100110011001111100001111111100001111111100001111111111111111111111111111010001100010010001100010000000000000"},{"nom":"L'Église","src":"bld-T","n":12,"g":"000001100000000001100000000001100000000011110000000111111000000011110000000110011000011100011110011101101110010111111010010111111010011111111110"},{"nom":"L'Ambassade","src":"bld-A","n":12,"g":"000000000000011111111110100010010001100110011001111100001111101010010101111011110111111011110111111111111111111101101111110100101011000000000000"},{"nom":"Le Sceau","src":"dip","n":12,"g":"000000001111000000011011000000110001000001100011000011111110000111111100001111111100111001111100111001111000111111010000111110000000111100000000"},{"nom":"Le Chêne","src":"biome-F","n":12,"g":"000011110000001110011100001100001100011001100110011001100110010111111010010011110010011001110110001111111100000111111000000011110000000111111000"},{"nom":"Le Marais","src":"biome-Ma","n":12,"g":"000000000000001100000000111110000000111110000000111110000110111110001111011111111110111100001111111100000111110000000011011111111110000011110000"},{"nom":"Les Champs","src":"biome-P","n":12,"g":"000000000000111000000111000111111000110001100000111111101111111111111111111111111111111111111111111111111110111111111101000000000000000000000000"},{"nom":"La Couronne","src":"crown","n":12,"g":"000000000000000000000000000001100000011001100110111001100111111101101111111111111111111111111111111111111111111001100111010000000010000000000000"}];
  function indices(l) { var o = [], n = 0; l.forEach(function (v) { if (v === 1) n++; else if (n) { o.push(n); n = 0; } }); if (n) o.push(n); return o.length ? o : [0]; }
  function egal(a, b) { return a.length === b.length && a.every(function (x, i) { return x === b[i]; }); }
  FOF.Minijeux.enregistrer({ id: 'blasons', nom: 'Blasons (picross)', ic: 'blason', creer: function (api) {
    var faits = api.lire('blasons-faits', []), num = api.lire('blasons-num', 0), g, lignes, colonnes, fini, croix = false, peinture = null, chrono = api.chrono();
    if (!GRILLES[num]) num = 0;
    function charger(k) {
      num = k; api.ecrire('blasons-num', k);
      var P = GRILLES[k], n = P.n; g = new Array(n * n).fill(0); fini = false; peinture = null;
      lignes = []; colonnes = [];
      for (var r = 0; r < n; r++) lignes.push(indices(P.g.slice(r * n, r * n + n).split('').map(Number)));
      for (var c = 0; c < n; c++) { var col = []; for (var r2 = 0; r2 < n; r2++) col.push(+P.g[r2 * n + c]); colonnes.push(indices(col)); }
      chrono.remise();
    }
    function ligneOk(r) { var n = GRILLES[num].n; return egal(indices(g.slice(r * n, r * n + n)), lignes[r]); }
    function colonneOk(c) { var n = GRILLES[num].n, col = []; for (var r = 0; r < n; r++) col.push(g[r * n + c]); return egal(indices(col), colonnes[c]); }
    function verifier() {
      var n = GRILLES[num].n;
      for (var i = 0; i < n; i++) if (!ligneOk(i) || !colonneOk(i)) return;
      fini = true; chrono.arreter();
      if (faits.indexOf(num) < 0) { faits.push(num); api.ecrire('blasons-faits', faits); }
      fini = { record: api.record('blasons-' + num, chrono.ms(), true) };
      api.son('flag');
    }
    function peindre(i, v) {
      if (fini || g[i] === v) return false;
      if (!chrono.marche) chrono.demarrer();
      g[i] = v; verifier(); return true;
    }
    charger(num);
    return {
      temps: function () { return chrono.ms(); },
      pause: function () { chrono.pause(); peinture = null; },
      reprise: function () { chrono.reprise(); },
      html: function () {
        var P = GRILLES[num], n = P.n, maxL = Math.max.apply(null, lignes.map(function (l) { return l.length; })), maxC = Math.max.apply(null, colonnes.map(function (l) { return l.length; }));
        var h = '<div class="mj-tete"><div class="mj-titre">Blasons</div><select class="mj-niveau bl-choix" aria-label="Grille">' +
          GRILLES.map(function (x, k) { var ok = faits.indexOf(k) >= 0; return '<option value="' + k + '"' + (k === num ? ' selected' : '') + '>' + (k + 1) + '. ' + (ok ? x.nom + ' ✓' : 'Blason ' + x.n + '×' + x.n) + '</option>'; }).join('') + '</select></div>';
        h += '<div class="mj-barre"><span class="mj-temps" title="Temps">' + FOF.ic('hourglass', 13) + ' <b>' + api.duree(chrono.ms()) + '</b></span><span title="Grilles résolues">' + FOF.ic('check', 13) + ' <b>' + faits.length + '/' + GRILLES.length + '</b></span>' +
          '<button type="button" class="mj-mode' + (croix ? ' on' : '') + '" aria-pressed="' + croix + '" title="Mode croix : un clic marque une case vide">' + FOF.ic('close', 13) + '</button>' +
          '<button type="button" class="mj-neuf" title="Effacer la grille">' + FOF.ic('restart', 13) + '</button></div>';
        h += '<div class="bl-jeu' + (fini ? ' fini' : '') + '" style="--n:' + n + ';--lc:' + maxL + ';--cc:' + maxC + '"><div class="bl-coin">' + (fini ? '<img src="assets/icons/' + P.src + '.png" alt="">' : '') + '</div><div class="bl-cols">';
        colonnes.forEach(function (cl, c) { h += '<div class="bl-ci' + (colonneOk(c) ? ' ok' : '') + '">' + cl.map(function (x) { return '<i>' + x + '</i>'; }).join('') + '</div>'; });
        h += '</div><div class="bl-lignes">';
        lignes.forEach(function (cl, r) { h += '<div class="bl-li' + (ligneOk(r) ? ' ok' : '') + '">' + cl.map(function (x) { return '<i>' + x + '</i>'; }).join('') + '</div>'; });
        h += '</div><div class="bl-grille">';
        g.forEach(function (v, i) {
          var x = i % n, y = Math.floor(i / n);
          h += '<button type="button" class="bl-c' + (v === 1 ? ' plein' : v === 2 ? ' croix' : '') + (x % 5 === 4 && x < n - 1 ? ' bd' : '') + (y % 5 === 4 && y < n - 1 ? ' bb' : '') + '" data-bl="' + i + '" aria-label="case ' + (y + 1) + ', ' + (x + 1) + '"></button>';
        });
        h += '</div></div><div class="mj-pied">' + (fini ? '<b>' + P.nom + '</b>, en ' + api.duree(chrono.ms()) + '.' + (fini.record ? ' Record.' : '') + ' <button type="button" class="mj-neuf mj-suivant">Suivant</button>'
          : 'Clic : noircir (glisser pour peindre). Clic droit : croix.') + '</div>';
        return h;
      },
      appui: function (e) {
        var b = e.target.closest('[data-bl]'); if (!b || fini) return false;
        var i = +b.dataset.bl, droit = e.button === 2, mode = droit || croix ? 2 : 1;
        peinture = { v: g[i] === mode ? 0 : mode };
        return peindre(i, peinture.v);
      },
      survol: function (e) { if (!peinture || !(e.buttons & 3)) { peinture = null; return false; } var b = e.target.closest('[data-bl]'); return b ? peindre(+b.dataset.bl, peinture.v) : false; },
      relache: function () { peinture = null; return false; },
      clicDroit: function () { return false; },
      clic: function (e) {
        if (e.target.closest('.mj-suivant')) { var k = num; for (var t = 1; t <= GRILLES.length; t++) { var c = (num + t) % GRILLES.length; if (faits.indexOf(c) < 0) { k = c; break; } } charger(k === num ? (num + 1) % GRILLES.length : k); return true; }
        if (e.target.closest('.mj-neuf')) { charger(num); return true; }
        if (e.target.closest('.mj-mode')) { croix = !croix; return true; }
        return false;
      },
      change: function (e) { if (!e.target.classList.contains('bl-choix')) return false; charger(+e.target.value); return true; }
    };
  } });
})(window.FOF = window.FOF || {});
