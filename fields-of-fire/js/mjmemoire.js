/* Fields of Fire - mini-jeu « Mémoire des armées » (paires, v1.9.16).
   Les cartes sont retournées face cachée ; on en découvre deux à chaque essai. Deux illustrations
   identiques restent visibles, sinon elles se retournent. Les illustrations sont celles des unités
   du jeu, tirées au hasard à chaque partie ; le nom de l'unité s'affiche quand la paire est trouvée. */
(function (FOF) {
  'use strict';
  var NIVEAUX = { ecuyer: { nom: 'Écuyer', paires: 8 }, chevalier: { nom: 'Chevalier', paires: 10 }, seigneur: { nom: 'Seigneur', paires: 12 } };
  function melanger(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  FOF.Minijeux.enregistrer({ id: 'memoire', nom: 'Mémoire des armées (paires)', ic: 'cards', creer: function (api) {
    var niveau = api.lire('memoire-niveau', 'ecuyer'); if (!NIVEAUX[niveau]) niveau = 'ecuyer';
    var cartes, ouvertes, essais, trouvees, fini, attente = null, chrono = api.chrono();
    function toutes() { return Object.keys(FOF.ELITES).concat(Object.keys(FOF.SPECIALS)).filter(function (k) { return FOF.unitArt(k); }); }
    function nouveau() {
      clearTimeout(attente); attente = null;
      var ks = melanger(toutes()).slice(0, NIVEAUX[niveau].paires);
      cartes = melanger(ks.concat(ks)).map(function (k) { return { k: k, vue: false, gagnee: false }; });
      ouvertes = []; essais = 0; trouvees = 0; fini = false; chrono.remise();
    }
    function retourner(i) {
      var c = cartes[i]; if (fini || c.vue || c.gagnee || ouvertes.length >= 2) return false;
      if (!chrono.marche) chrono.demarrer();
      c.vue = true; ouvertes.push(i); api.son('card');
      if (ouvertes.length === 2) {
        essais++;
        var a = cartes[ouvertes[0]], b = cartes[ouvertes[1]];
        if (a.k === b.k) {
          a.gagnee = b.gagnee = true; ouvertes = []; trouvees++;
          if (trouvees === cartes.length / 2) {
            fini = true; chrono.arreter();
            fini = { rec: api.record('memoire-' + niveau, essais, true) }; api.son('flag');
          }
        } else attente = setTimeout(function () { a.vue = b.vue = false; ouvertes = []; attente = null; api.rendre(); }, 950);
      }
      return true;
    }
    nouveau();
    return {
      temps: function () { return chrono.ms(); },
      pause: function () { chrono.pause(); },
      reprise: function () { chrono.reprise(); },
      html: function () {
        var rec = api.meilleur('memoire-' + niveau);
        var h = '<div class="mj-tete"><div class="mj-titre">Mémoire des armées</div><select class="mj-niveau" aria-label="Nombre de paires">' +
          Object.keys(NIVEAUX).map(function (k) { return '<option value="' + k + '"' + (k === niveau ? ' selected' : '') + '>' + NIVEAUX[k].nom + ' · ' + NIVEAUX[k].paires + ' paires</option>'; }).join('') + '</select></div>' +
          '<div class="mj-barre"><span title="Essais">' + FOF.ic('eye', 13) + ' <b>' + essais + '</b></span><span class="mj-temps" title="Temps">' + FOF.ic('hourglass', 13) + ' <b>' + api.duree(chrono.ms()) + '</b></span>' +
          '<button type="button" class="mj-neuf" title="Nouvelle partie">' + FOF.ic('restart', 13) + '</button></div><div class="me-grille">';
        cartes.forEach(function (c, i) {
          var face = c.vue || c.gagnee, nom = FOF.unitDef(c.k).name;
          h += '<button type="button" class="me-c' + (face ? ' face' : '') + (c.gagnee ? ' gagnee' : '') + '" data-me="' + i + '" aria-label="' + (face ? nom : 'carte cachée') + '"' + (c.gagnee ? ' title="' + nom + '"' : '') + '>' +
            (face ? '<img src="' + FOF.unitArt(c.k) + '" alt="">' : '') + '</button>';
        });
        h += '</div><div class="mj-pied">' + (fini ? '<b>Toutes les paires en ' + essais + ' essais</b>, ' + api.duree(chrono.ms()) + '.' + (fini.rec ? ' Record.' : '') + ' <button type="button" class="mj-neuf mj-rejouer">Rejouer</button>'
          : rec ? 'Record ' + NIVEAUX[niveau].nom.toLowerCase() + ' : ' + rec + ' essais.' : 'Retrouvez les paires d’unités.') + '</div>';
        return h;
      },
      clic: function (e) {
        var b = e.target.closest('[data-me]'); if (b) return retourner(+b.dataset.me);
        if (e.target.closest('.mj-neuf')) { nouveau(); return true; }
        return false;
      },
      change: function (e) { if (!e.target.classList.contains('mj-niveau')) return false; niveau = e.target.value; api.ecrire('memoire-niveau', niveau); nouveau(); return true; }
    };
  } });
})(window.FOF = window.FOF || {});
