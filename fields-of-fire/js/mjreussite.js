/* Fields of Fire - mini-jeu « Solitaire » (Klondike, v1.9.25 ; remplace la Réussite de la Cour).
   Jeu de 52 cartes aux couleurs latines : coupes et deniers sont rouges, épées et bâtons sont noirs.
   Valeurs 1 à 10, Valet, Cavalier, Roi. Sept colonnes (1 à 7 cartes, la dernière retournée), une
   pioche qui se retourne une carte à la fois (tours de pioche illimités) et quatre fondations.
   Colonnes : on descend d'une valeur en alternant rouge et noir ; une colonne vide ne prend qu'un Roi.
   Fondations : une par couleur, du 1 au Roi. But : tout monter sur les fondations. */
(function (FOF) {
  'use strict';
  var COUL = ['coupe', 'denier', 'epee', 'baton'], NOMC = { coupe: 'coupes', denier: 'deniers', epee: 'épées', baton: 'bâtons' };
  var RANG = ['', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'V', 'C', 'R'];
  var NOMR = ['', 'as', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'valet', 'cavalier', 'roi'];
  var R = {};
  R.rouge = function (c) { return c.c === 'coupe' || c.c === 'denier'; };
  R.donne = function (alea) {
    alea = alea || Math.random;
    var jeu = []; COUL.forEach(function (c) { for (var r = 1; r <= 13; r++) jeu.push({ c: c, r: r, v: false }); });
    for (var i = jeu.length - 1; i > 0; i--) { var j = Math.floor(alea() * (i + 1)), t = jeu[i]; jeu[i] = jeu[j]; jeu[j] = t; }
    var cols = []; for (var k = 0; k < 7; k++) { var col = jeu.splice(0, k + 1); col[k].v = true; cols.push(col); }
    return { cols: cols, pioche: jeu, def: [], fond: { coupe: [], denier: [], epee: [], baton: [] } };
  };
  // la carte (ou la pile qui commence par elle) peut-elle aller sur cette colonne ?
  R.surColonne = function (c, col) {
    if (!col.length) return c.r === 13;
    var d = col[col.length - 1];
    return d.v && d.r === c.r + 1 && R.rouge(d) !== R.rouge(c);
  };
  R.surFondation = function (c, s) { return s.fond[c.c].length === c.r - 1; };
  R.gagne = function (s) { return COUL.every(function (c) { return s.fond[c].length === 13; }); };
  FOF.SolitaireRegles = R;

  FOF.Minijeux.enregistrer({ id: 'solitaire', nom: 'Solitaire', regles: '<p>But : ranger les 52 cartes sur les quatre cases du haut à droite (les fondations), une par couleur, du 1 au Roi.</p><p>Les cartes sont rouges (coupes, deniers) ou noires (épées, bâtons). Leur ordre : 1, 2… 10, Valet, Cavalier, Roi.</p><p>Dans les sept colonnes, on pose une carte sur une carte d’une valeur juste au-dessus et de l’autre couleur (un 6 noir sur un 7 rouge). On peut déplacer une carte avec toutes celles posées dessus. Une carte cachée se retourne quand elle se retrouve au bout de sa colonne. Une colonne vide n’accepte qu’un Roi.</p><p>La pioche (en haut à gauche) retourne une carte à la fois ; une fois vide, cliquez-la pour la reprendre.</p><p>Faites glisser une carte (ou une pile) jusqu’à sa place. Vous pouvez aussi la cliquer, puis cliquer où la poser : les places possibles s’éclairent. Cliquez-la une seconde fois pour l’envoyer seule au meilleur endroit.</p>', ic: 'reussite', creer: function (api) {
    var s, fini, histo, sel, coups, chrono = api.chrono();
    var tire = null, finTire = 0;   // v1.9.25 : glisser-déposer (souris et doigt)
    function nouveau() { s = R.donne(); fini = false; histo = []; sel = null; coups = 0; chrono.remise(); }
    function memo() { histo.push(JSON.stringify(s)); if (histo.length > 80) histo.shift(); }
    function demarrer() { if (!chrono.marche) chrono.demarrer(); }
    // pile désignée par une sélection : { de: 'col'|'def'|'fond', i, k }
    function pile(x) {
      if (x.de === 'col') return s.cols[x.i].slice(x.k);
      if (x.de === 'def') return s.def.length ? [s.def[s.def.length - 1]] : [];
      var f = s.fond[x.i]; return f.length ? [f[f.length - 1]] : [];
    }
    function retirer(x, n) {
      if (x.de === 'col') { s.cols[x.i].splice(s.cols[x.i].length - n, n); var col = s.cols[x.i]; if (col.length) col[col.length - 1].v = true; }
      else if (x.de === 'def') s.def.pop();
      else s.fond[x.i].pop();
    }
    // destinations permises : ['fond', couleur] ou ['col', i]
    function destinations(x) {
      var p = pile(x); if (!p.length) return [];
      var c = p[0], out = [];
      if (p.length === 1 && x.de !== 'fond' && R.surFondation(c, s)) out.push(['fond', c.c]);
      s.cols.forEach(function (col, i) { if (!(x.de === 'col' && x.i === i) && R.surColonne(c, col)) out.push(['col', i]); });
      return out;
    }
    function deplacer(x, dest) {
      var p = pile(x); demarrer(); memo();
      retirer(x, p.length);
      if (dest[0] === 'fond') s.fond[dest[1]].push(p[0]); else Array.prototype.push.apply(s.cols[dest[1]], p);
      coups++; sel = null; api.son('card'); verifierFin(); return true;
    }
    function verifierFin() {
      if (!R.gagne(s)) return;
      fini = { ms: chrono.ms() }; chrono.arreter();
      fini.rec = api.record('solitaire', Math.round(fini.ms / 1000), true); api.son('flag');
    }
    function piocher() {
      if (fini) return false;
      demarrer(); memo(); sel = null;
      if (s.pioche.length) { var c = s.pioche.pop(); c.v = true; s.def.push(c); }
      else if (s.def.length) { s.pioche = s.def.reverse().map(function (c) { c.v = false; return c; }); s.def = []; }
      else { histo.pop(); return false; }
      api.son('card'); return true;
    }
    // tout est visible et la pioche vide : on peut finir d'un coup
    function finissable() {
      return !fini && !s.pioche.length && !s.def.length && s.cols.every(function (col) { return col.every(function (c) { return c.v; }); });
    }
    function terminer() {
      demarrer(); memo();
      var bouge = true;
      while (bouge) {
        bouge = false;
        s.cols.forEach(function (col) { var c = col[col.length - 1]; if (c && R.surFondation(c, s)) { s.fond[c.c].push(col.pop()); coups++; bouge = true; } });
      }
      sel = null; api.son('card'); verifierFin(); return true;
    }
    function memeSel(a, b) { return a && b && a.de === b.de && a.i === b.i && a.k === b.k; }
    function choisir(x) {
      if (fini) return false;
      if (sel) {
        // une destination éclairée ?
        var d = destinations(sel), cible = x.de === 'col' ? ['col', x.i] : x.de === 'fond' ? ['fond', x.i] : null;
        var ok = cible && d.filter(function (y) { return y[0] === cible[0] && y[1] === cible[1]; })[0];
        if (ok) return deplacer(sel, ok);
        if (memeSel(sel, x)) { var best = d[0]; if (best) return deplacer(sel, best); api.son('error'); sel = null; return true; }
      }
      var p = x.de === 'col' && x.k >= 0 ? s.cols[x.i][x.k] : null;
      if (x.de === 'col' && (x.k < 0 || !p || !p.v)) { sel = null; return true; }
      if (!pile(x).length) { sel = null; return true; }
      sel = x; return true;
    }
    // glisser : la carte (et celles posées dessus) suit le pointeur dans un fantôme ; au lâcher,
    // la place sous le pointeur reçoit la pile si la règle le permet, sinon rien ne bouge
    function lacher(e) {
      document.removeEventListener('pointermove', bouger); document.removeEventListener('pointerup', lacher); document.removeEventListener('pointercancel', lacher);
      var t = tire; tire = null; if (!t || !t.fantome) return;
      t.fantome.remove(); finTire = Date.now();
      var cible = null;
      if (e.type === 'pointerup') {
        var sous = document.elementFromPoint(e.clientX, e.clientY), b = sous && sous.closest('[data-so]');
        if (b && b.dataset.so === 'col') cible = ['col', +b.dataset.i]; else if (b && b.dataset.so === 'fond') cible = ['fond', b.dataset.i];
      }
      var ok = cible && destinations(t.x).filter(function (y) { return y[0] === cible[0] && y[1] === cible[1]; })[0];
      if (ok) deplacer(t.x, ok); else sel = null;
      api.rendre();
    }
    function bouger(e) {
      var t = tire; if (!t) return;
      if (!t.fantome) {
        if (Math.abs(e.clientX - t.px) + Math.abs(e.clientY - t.py) < 7) return;
        var r = t.el.getBoundingClientRect(), f = document.createElement('div');
        f.className = 'so-fantome'; f.style.width = r.width + 'px';
        t.els.forEach(function (n) { f.appendChild(n.cloneNode(true)); });
        document.body.appendChild(f);
        t.fantome = f; t.dx = e.clientX - r.left; t.dy = e.clientY - r.top;
        sel = t.x; api.rendre();   // les places possibles s'éclairent
      }
      e.preventDefault();
      t.fantome.style.transform = 'translate(' + (e.clientX - t.dx) + 'px,' + (e.clientY - t.dy) + 'px)';
    }
    function carte(c, cls, attrs) {
      if (!c.v) return '<span class="rs-carte dos' + (cls ? ' ' + cls : '') + '"' + (attrs || '') + ' aria-label="carte cachée"></span>';
      return '<span class="rs-carte ' + c.c + (R.rouge(c) ? ' rouge' : ' noire') + (cls ? ' ' + cls : '') + '"' + (attrs || '') + ' aria-label="' + NOMR[c.r] + ' de ' + NOMC[c.c] + '"><b>' + RANG[c.r] + '</b>' + FOF.ic(c.c, 15) + '</span>';
    }
    function attr(de, i, k) { return ' data-so="' + de + '" data-i="' + i + '" data-k="' + k + '" role="button" tabindex="0"'; }
    nouveau();
    return {
      temps: function () { return chrono.ms(); },
      pause: function () { chrono.pause(); },
      reprise: function () { chrono.reprise(); },
      html: function () {
        var rec = api.meilleur('solitaire'), dests = sel ? destinations(sel) : [];
        function eclaire(t, i) { return dests.some(function (y) { return y[0] === t && y[1] === i; }) ? ' cible' : ''; }
        function choisie(de, i, k) { return sel && sel.de === de && sel.i === i && (de !== 'col' || k >= sel.k) ? ' choisie' : ''; }
        var range = COUL.reduce(function (n, c) { return n + s.fond[c].length; }, 0);
        var h = '<div class="mj-tete"><div class="mj-titre">Solitaire</div><button type="button" class="mj-neuf" title="Nouvelle donne">' + FOF.ic('restart', 13) + '</button></div>' +
          '<div class="mj-barre"><span title="Cartes rangées sur les fondations">' + FOF.ic('reussite', 13) + ' <b>' + range + '/52</b></span><span class="mj-temps" title="Temps">' + FOF.ic('hourglass', 13) + ' <b>' + api.duree(chrono.ms()) + '</b></span>' +
          '<button type="button" class="rs-annuler" title="Annuler le dernier coup"' + (histo.length && !fini ? '' : ' disabled') + '><span style="display:inline-flex;transform:rotate(180deg)">' + FOF.ic('arrow', 13) + '</span></button></div>';
        var dTop = s.def[s.def.length - 1];
        h += '<div class="so-haut"><button type="button" class="rs-pioche so-pioche' + (s.pioche.length ? '' : ' vide') + '"' + (fini || (!s.pioche.length && !s.def.length) ? ' disabled' : '') + ' title="' + (s.pioche.length ? 'Retourner une carte de la pioche' : 'Reprendre la pioche') + '"><span>' + (s.pioche.length || FOF.ic('restart', 13)) + '</span></button>' +
          '<div class="so-place">' + (dTop ? carte(dTop, choisie('def', 0, 0), attr('def', 0, 0)) : '') + '</div><div></div>';
        COUL.forEach(function (c) {
          var f = s.fond[c], top = f[f.length - 1];
          h += '<div class="so-place so-fond' + eclaire('fond', c) + '" data-so="fond" data-i="' + c + '" data-k="0" title="Fondation des ' + NOMC[c] + '">' + (top ? carte(top, choisie('fond', c, 0)) : '<span class="so-vide">' + FOF.ic(c, 15) + '</span>') + '</div>';
        });
        h += '</div><div class="rs-cols so-cols">';
        s.cols.forEach(function (col, i) {
          h += '<div class="rs-col so-col' + eclaire('col', i) + '" data-so="col" data-i="' + i + '" data-k="-1">';
          col.forEach(function (c, k) { h += carte(c, (c.v ? 'vue' : '') + choisie('col', i, k), attr('col', i, k)); });
          h += '</div>';
        });
        h += '</div>';
        h += '<div class="mj-pied">' + (fini ? '<b>Tout est rangé en ' + api.duree(fini.ms) + '</b>, ' + coups + ' coups.' + (fini.rec ? ' Record.' : '') + ' <button type="button" class="mj-neuf mj-rejouer">Rejouer</button>'
          : finissable() ? '<button type="button" class="so-finir">Tout ranger</button>'
          : rec !== undefined ? 'Record : ' + api.duree(rec * 1000) + '.' : 'Rangez toutes les cartes sur les fondations.') + '</div>';
        return h;
      },
      appui: function (e) {
        if (fini || e.button > 0) return false;
        var b = e.target.closest('[data-so]'); if (!b) return false;
        var x = { de: b.dataset.so, i: b.dataset.so === 'fond' ? b.dataset.i : +b.dataset.i, k: +b.dataset.k };
        if (x.de === 'col' && (x.k < 0 || !s.cols[x.i][x.k] || !s.cols[x.i][x.k].v)) return false;
        if (!pile(x).length) return false;
        var el = x.de === 'fond' ? b.querySelector('.rs-carte') : b, els = [el];
        if (x.de === 'col') for (var n = el.nextElementSibling; n; n = n.nextElementSibling) els.push(n);
        tire = { x: x, el: el, els: els, px: e.clientX, py: e.clientY };
        document.addEventListener('pointermove', bouger, { passive: false }); document.addEventListener('pointerup', lacher); document.addEventListener('pointercancel', lacher);
        return false;
      },
      clic: function (e) {
        if (Date.now() - finTire < 350) return false;   // le clic qui suit un glisser
        if (e.target.closest('.mj-neuf')) { nouveau(); return true; }
        if (e.target.closest('.rs-annuler')) { if (!histo.length || fini) return false; s = JSON.parse(histo.pop()); sel = null; return true; }
        if (e.target.closest('.so-pioche')) return piocher();
        if (e.target.closest('.so-finir')) return terminer();
        var b = e.target.closest('[data-so]');
        if (b) return choisir({ de: b.dataset.so, i: b.dataset.so === 'fond' ? b.dataset.i : +b.dataset.i, k: +b.dataset.k });
        if (sel) { sel = null; return true; }
        return false;
      },
      touche: function (e) {
        if (e.key === 'Escape' && sel) { sel = null; return true; }
        if (e.key !== 'Enter' && e.key !== ' ') return false;
        var b = document.activeElement && document.activeElement.closest && document.activeElement.closest('[data-so]'); if (!b) return false;
        e.preventDefault(); return choisir({ de: b.dataset.so, i: b.dataset.so === 'fond' ? b.dataset.i : +b.dataset.i, k: +b.dataset.k });
      }
    };
  } });
})(window.FOF = window.FOF || {});
