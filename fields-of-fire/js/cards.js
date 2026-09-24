/* Fields of Fire — rendu des cartes d'unité et des fiches de dirigeant (repris des prototypes physiques) */
(function (FOF) {
  'use strict';
  var esc = FOF.esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var HAS_ART = ['corbeau','partisan','predicateur','colonie','emissaire','caboteur','caravanier','trebuchets','exploratrice','gouverneur','pretresse','pillards','ecumeurs','brigands','bandits','nomades','fantassins','cuirassiers','archmontes','inflourde','arbaletriers','archers','garde','chevaliers','piquiers','espion','heraut','ambassadeur','pelerin','milice','maitre'];
  var HERO_ART = ['odon','gustave','edouard','mathilde','adele','henri','hugues','alienor'];
  FOF.unitArt = function (key) { return HAS_ART.indexOf(key) >= 0 ? 'assets/units/' + key + '.jpg' : null; };
  FOF.heroArt = function (key) { return HERO_ART.indexOf(key) >= 0 ? 'assets/heroes/' + key + '.jpg' : null; };
  FOF.heroImg = function (key, cls) {
    var a = FOF.heroArt(key);
    return a ? '<img class="' + (cls || 'portrait') + '" src="' + a + '" alt="">' : '<div class="' + (cls || 'portrait') + ' none"><img src="assets/icons/crown.png" alt=""></div>';
  };
  FOF.starClass = function (v, arr) { var mx = Math.max.apply(null, arr), mn = Math.min.apply(null, arr); if (mx === mn) return 'gold'; return v === mx ? 'hi' : v === mn ? 'lo' : 'gold'; };

  FOF.cardHTML = function (key, opts) {
    opts = opts || {};
    var d = FOF.unitDef(key), elite = FOF.isElite(key), art = FOF.unitArt(key);
    var h = '<div class="ucard parch ' + (elite ? 'elite' : '') + '">';
    h += '<div class="uh"><div class="ribbon">' + esc(d.name) + '</div><span class="arrow" title="Déplacement">' + d.move + '</span></div>';
    h += art ? '<img class="art" src="' + art + '" alt="" loading="lazy">' : '<div class="art none"><img src="assets/icons/crown.png" alt=""></div>';
    if (elite) {
      h += '<div class="biomes">' + FOF.BIOMES.map(function (b, i) {
        return '<div title="' + FOF.BIOME_NAMES[b] + '"><img src="assets/icons/biome-' + b + '.png" alt="' + FOF.BIOME_NAMES[b] + '"><span class="star ' + FOF.starClass(d.pow[i], d.pow) + '">' + d.pow[i] + '</span></div>';
      }).join('') + '</div>';
    } else h += '<div class="txt">' + esc(d.text) + '</div>';
    var cond = d.req[0] === 'D' ? '<span class="cond">' + d.req[1] + ' <small>diplo.</small></span>' : '<span class="cond">' + d.req[1] + ' <img src="assets/icons/bld-' + d.req[0] + '.png" alt="' + FOF.BUILDINGS[d.req[0]].name + '"></span>';
    h += '<div class="ft"><div><small>Entretien</small><span class="coins">' + new Array(d.upkeep + 1).join('<i></i>') + '</span></div><div style="text-align:right"><small>Condition</small>' + cond + '</div></div>';
    if (opts.actions) h += opts.actions;
    return h + '</div>';
  };

  FOF.heroHTML = function (key, opts) {
    opts = opts || {};
    var L = FOF.LEADERS[key], tag = opts.button ? 'button' : 'div';
    return '<' + tag + ' class="hero parch ' + (opts.cls || '') + '" ' + (opts.attrs || '') + '>' + FOF.heroImg(key) +
      '<div class="hbody"><div class="htop"><div class="ribbon">' + esc(L.name) + '</div></div>' +
      '<div class="htop"><span class="star gold" title="Modificateur de combat (tous terrains)">' + L.mod + '</span><span class="arrow" title="Déplacement du dirigeant">1</span>' + (opts.note ? '<span class="tag">' + esc(opts.note) + '</span>' : '') + '</div>' +
      '<div class="power">' + esc(L.text) + '</div></div></' + tag + '>';
  };
})(window.FOF = window.FOF || {});
