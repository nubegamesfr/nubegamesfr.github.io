/* Fields of Fire — génération de carte (hexagones) */
(function (FOF) {
  'use strict';

  // RNG déterministe (mulberry32) : l'état du RNG vit dans la partie pour le futur multijoueur
  FOF.rng = function (state) {
    state.seed = (state.seed + 0x6D2B79F5) | 0;
    var t = state.seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  function ri(s, n) { return Math.floor(FOF.rng(s) * n); }
  function shuffle(s, a) { for (var i = a.length - 1; i > 0; i--) { var j = ri(s, i + 1); var x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
  FOF.shuffle = shuffle; FOF.ri = ri;
  FOF.hexDistance = function (a, b, W) { return hexDist(a, b, W); };

  // Grille « odd-r » (hexagones pointe en haut)
  function nbrs(c, r, W, H) {
    var odd = r & 1;
    var d = odd ? [[1,0],[-1,0],[0,-1],[1,-1],[0,1],[1,1]] : [[1,0],[-1,0],[-1,-1],[0,-1],[-1,1],[0,1]];
    var out = [];
    for (var i = 0; i < 6; i++) {
      var nc = c + d[i][0], nr = r + d[i][1];
      if (nc >= 0 && nr >= 0 && nc < W && nr < H) out.push(nr * W + nc);
    }
    return out;
  }
  FOF.hexCenter = function (idx, W, R) {
    var c = idx % W, r = Math.floor(idx / W);
    var w = Math.sqrt(3) * R;
    return { x: w * (c + 0.5 * (r & 1)) + w / 2 + 4, y: R * 1.5 * r + R + 4 };
  };

  function hexDist(a, b, W) {
    function cube(i) { var c = i % W, r = Math.floor(i / W); var x = c - (r - (r & 1)) / 2; return [x, r, -x - r]; }
    var A = cube(a), B = cube(b);
    return Math.max(Math.abs(A[0]-B[0]), Math.abs(A[1]-B[1]), Math.abs(A[2]-B[2]));
  }

  // v1.5 : continents libres (nombre et tailles au hasard), total = 7 × joueurs
  function continentSizes(s, n) {
    var total = 7 * n;
    for (var tries = 0; tries < 400; tries++) {
      var k = Math.max(2, Math.min(n + 1, n - 1 + ri(s, 3)));
      var sizes = [], left = total;
      for (var i = 0; i < k; i++) {
        var rest = k - i - 1, lo = Math.max(4, left - rest * 12), hi = Math.min(12, left - rest * 4);
        if (lo > hi) break;
        var v = i === k - 1 ? left : lo + ri(s, hi - lo + 1);
        sizes.push(v); left -= v;
      }
      if (sizes.length === k && left === 0 && sizes.every(function (v) { return v >= 4 && v <= 12; })) return { sizes: sizes, extra: 0 };
    }
    var base = []; for (var q = 0; q < n; q++) base.push(7);
    return { sizes: base, extra: 0 };
  }

  FOF.generateMap = function (s, n) {
    for (var attempt = 0; attempt < 400; attempt++) {
      var m = tryGenerate(s, n);
      if (m) return m;
    }
    throw new Error('Carte impossible à générer');
  };

  function tryGenerate(s, n) {
    var wide = !(s && s.wideSea === false);   // « mer élargie » : choix fait à la création de la partie
    var cs = continentSizes(s, n);
    var targets = cs.sizes.slice(); if (cs.extra) targets.push(cs.extra);
    var W = 3 + 2 * n, H = 5 + n;
    var N = W * H, owner = new Array(N).fill(-1);
    function ok(i, c) { // case libre, pas au bord, pas collée à un autre continent
      var col = i % W, row = Math.floor(i / W);
      if (col === 0 || row === 0 || col === W - 1 || row === H - 1) return false;
      if (owner[i] !== -1) return false;
      var nb = nbrs(col, row, W, H);
      for (var k = 0; k < nb.length; k++) if (owner[nb[k]] !== -1 && owner[nb[k]] !== c) return false;
      return true;
    }
    // graines éloignées
    var seeds = [];
    for (var c = 0; c < targets.length; c++) {
      var best = -1, bestD = -1;
      for (var t = 0; t < 60; t++) {
        var cand = ri(s, N);
        if (!ok(cand, c)) continue;
        var d = seeds.length ? Math.min.apply(null, seeds.map(function (x) { return hexDist(x, cand, W); })) : 99;
        if (d > bestD) { bestD = d; best = cand; }
      }
      if (best < 0 || (seeds.length && bestD < 3)) return null;
      seeds.push(best); owner[best] = c;
    }
    // croissance aléatoire, continent par continent en tourniquet
    var members = seeds.map(function (x) { return [x]; });
    var grew = true;
    while (grew) {
      grew = false;
      for (c = 0; c < targets.length; c++) {
        if (members[c].length >= targets[c]) continue;
        var front = [];
        members[c].forEach(function (i) {
          nbrs(i % W, Math.floor(i / W), W, H).forEach(function (j) { if (ok(j, c) && front.indexOf(j) < 0) front.push(j); });
        });
        if (!front.length) return null;
        var pick = front[ri(s, front.length)];
        owner[pick] = c; members[c].push(pick); grew = true;
      }
    }
    // territoires
    var terr = [], hexToT = {};
    for (c = 0; c < targets.length; c++) {
      var biomes = [];
      for (var b = 0; b < members[c].length; b++) biomes.push(FOF.BIOMES[b % 4]);
      shuffle(s, biomes);
      members[c].forEach(function (h, k) {
        var id = terr.length;
        hexToT[h] = id;
        terr.push({ id: id, hex: h, cont: c, biome: biomes[k], ctrl: null, blds: [], adj: [], seas: [], name: '' });
      });
    }
    // zones de mer : cases d'eau à distance ≤ 2 d'une terre, découpées en zones
    var water = [];
    for (var i = 0; i < N; i++) {
      if (owner[i] !== -1) continue;
      var near = false;
      for (var q = 0; q < terr.length && !near; q++) if (hexDist(i, terr[q].hex, W) <= (wide ? 3 : 2)) near = true;
      if (near) water.push(i);
    }
    // v1.9 : mer plus large (rayon 3) et davantage de zones — le large avait trop peu de cases
    var shoreW = water.filter(function (w) { return nbrs(w % W, Math.floor(w / W), W, H).some(function (j) { return owner[j] !== -1; }); });
    var nz = Math.min(wide ? 3 * n + 6 : 2 * n + 4, shoreW.length), zseeds = [shoreW[ri(s, shoreW.length)]];
    while (zseeds.length < nz) {
      var far = -1, fd = -1;
      shoreW.forEach(function (w) { if (zseeds.indexOf(w) >= 0) return; var d = Math.min.apply(null, zseeds.map(function (z) { return hexDist(z, w, W); })); if (d > fd) { fd = d; far = w; } });
      if (far < 0) break;
      zseeds.push(far);
    }
    nz = zseeds.length;
    var zoneOf = {}, queue = [];
    zseeds.forEach(function (z, k) { zoneOf[z] = k; queue.push(z); });
    var waterSet = {}; water.forEach(function (w) { waterSet[w] = true; });
    while (queue.length) {
      var u = queue.shift();
      nbrs(u % W, Math.floor(u / W), W, H).forEach(function (v) { if (waterSet[v] && zoneOf[v] === undefined) { zoneOf[v] = zoneOf[u]; queue.push(v); } });
    }
    var seas = [];
    for (var z = 0; z < nz; z++) seas.push({ id: z, hexes: [], adjT: [], adjS: [], anchor: zseeds[z] });
    water.forEach(function (w) { if (zoneOf[w] !== undefined) seas[zoneOf[w]].hexes.push(w); });
    // adjacences
    terr.forEach(function (t) {
      nbrs(t.hex % W, Math.floor(t.hex / W), W, H).forEach(function (j) {
        if (hexToT[j] !== undefined && t.adj.indexOf(hexToT[j]) < 0) t.adj.push(hexToT[j]);
        if (zoneOf[j] !== undefined && t.seas.indexOf(zoneOf[j]) < 0) t.seas.push(zoneOf[j]);
      });
    });
    seas.forEach(function (z) {
      z.hexes.forEach(function (h) {
        nbrs(h % W, Math.floor(h / W), W, H).forEach(function (j) {
          if (zoneOf[j] !== undefined && zoneOf[j] !== z.id && z.adjS.indexOf(zoneOf[j]) < 0) z.adjS.push(zoneOf[j]);
        });
      });
    });
    terr.forEach(function (t) { t.seas.forEach(function (zi) { if (seas[zi].adjT.indexOf(t.id) < 0) seas[zi].adjT.push(t.id); }); });
    // chaque continent doit toucher la mer, et toutes les zones être reliées
    for (c = 0; c < targets.length; c++) if (!terr.some(function (t) { return t.cont === c && t.seas.length; })) return null;
    if (seas.some(function (z) { return !z.adjT.length; })) return null;
    var seen = { 0: true }, st = [0];
    while (st.length) { var a = st.pop(); seas[a].adjS.forEach(function (b2) { if (!seen[b2]) { seen[b2] = true; st.push(b2); } }); }
    if (Object.keys(seen).length !== nz) return null;
    // ancre d'affichage de chaque zone : case d'eau la plus « centrale »
    seas.forEach(function (z) {
      var bestA = z.anchor, bestScore = -1;
      z.hexes.forEach(function (h) { var sc = nbrs(h % W, Math.floor(h / W), W, H).filter(function (j) { return zoneOf[j] === z.id; }).length; if (sc > bestScore) { bestScore = sc; bestA = h; } });
      z.anchor = bestA;
    });
    names(s, terr);
    return { W: W, H: H, terr: terr, seas: seas, zoneOf: zoneOf, nCont: targets.length };
  }

  var NAMES = ['Aubelande','Brumeval','Cendrelac','Dorvanne','Éperonde','Fauxmont','Givrecœur','Hautelys','Isarde','Joncval','Karnhelm','Lorvanne','Mortebrise','Noirsable','Orgemont','Pierrelune','Quellrive','Rochebrune','Sombrelac','Taillefer','Ulmecombe','Valbrise','Wyrmelande','Ysembre','Zéphirelle','Argenfeu','Boisroux','Corvelle','Dunemar','Estival','Ferhaven','Grisecôte','Harfleur','Ivrelande','Jaspemont','Lancerive','Merlefond','Nordelys','Oriflamme','Pâlemarche','Roncevaux','Sélune','Tourmaline','Vermeil','Vieilleroche','Aiguemorte','Bellegarde','Clairefont'];
  function names(s, terr) { var pool = shuffle(s, NAMES.slice()); terr.forEach(function (t, i) { t.name = pool[i % pool.length]; }); }
})(window.FOF = window.FOF || {});
