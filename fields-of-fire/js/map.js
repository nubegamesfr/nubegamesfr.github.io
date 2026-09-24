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
      // v1.9.2 : moins de continents, plus gros. Chaque continent impose une ceinture d'eau ;
      // n continents de 7 cases rendaient impossible de descendre sous ~60 % de mer. Deux ou trois
      // masses (quatre à partir de cinq joueurs) tiennent le budget « mer ≤ 55 % ».
      // à trois joueurs il y a peu de terres : deux masses seulement, sinon la ceinture d'eau
      // de chaque continent fait exploser la part de mer.
      var kmax = n >= 5 ? 4 : 3;
      var k = n <= 3 ? 1 + ri(s, 2) : 2 + ri(s, kmax - 1);
      var vmax = Math.max(8, Math.ceil(total / k) + 5);
      var sizes = [], left = total;
      for (var i = 0; i < k; i++) {
        var rest = k - i - 1, lo = Math.max(5, left - rest * vmax), hi = Math.min(vmax, left - rest * 5);
        if (lo > hi) break;
        var v = i === k - 1 ? left : lo + ri(s, hi - lo + 1);
        sizes.push(v); left -= v;
      }
      if (sizes.length === k && left === 0 && sizes.every(function (v) { return v >= 5 && v <= vmax; })) return { sizes: sizes, extra: 0 };
    }
    var base = [], k2 = n >= 5 ? 3 : (n <= 3 ? 1 : 2), q0 = Math.floor(total / k2);
    for (var q = 0; q < k2; q++) base.push(q === k2 - 1 ? total - q0 * (k2 - 1) : q0);
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
    // v1.9.2 : grille choisie pour que la carte rendue tienne dans un rapport ~2:1, qui remplit
    // mieux un écran large et se lit plus clairement. Géométrie hexagonale : un pas en x vaut
    // √3·R, un pas en y vaut 1,5·R, donc le rapport rendu est 1,155 × W/H — on vise W/H ≈ 1,73.
    // La grille est dimensionnée pour que les terres occupent au moins ~45 % de la carte rendue :
    // au-delà, la mer mange l'écran (mesuré à 60-74 % avant cette correction).
    var aire = Math.round(7 * n / (FOF.LAND_TARGET || (n <= 3 ? 0.40 : 0.46)));
    // Grilles retenues après mesure : rapport rendu entre 1,7 et 1,9 (paysage, sans bande grise
    // en haut) ET mer ≤ 55 % de la surface affichée, ce qui est le plafond fixé par le créateur.
    //   3 j : 8×6  → mer 50 %      5 j : 10×8 → mer 52 %
    //   4 j : 9×7  → mer 50 %      6 j : 11×9 → mer 55 %
    var TABLE = { 3: [8, 6], 4: [9, 7], 5: [10, 8], 6: [11, 9] };
    var ASP = FOF.MAP_ASPECT || 1.56;   // rapport rendu ≈ 1,155 × W/H
    var H = Math.max(5, Math.round(Math.sqrt(aire / ASP)));
    var W = Math.round(ASP * H);
    var tb = (FOF.MAP_WH && FOF.MAP_WH[n]) || TABLE[n];
    if (tb) { W = tb[0]; H = tb[1]; }
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
        // v1.9.2 : croissance compacte — on tire trois candidats et on garde le plus proche du
        // centre du continent. Des masses ramassées laissent beaucoup moins de mer à l'écran
        // qu'une croissance purement aléatoire, qui étire les continents en filaments.
        var cx = 0, cy = 0;
        members[c].forEach(function (i2) { cx += i2 % W; cy += Math.floor(i2 / W); });
        cx /= members[c].length; cy /= members[c].length;
        var pick = null, pd = 1e9;
        for (var tg = 0; tg < 3; tg++) {
          var cand2 = front[ri(s, front.length)];
          var dx2 = (cand2 % W) - cx, dy2 = Math.floor(cand2 / W) - cy;
          var dd2 = dx2 * dx2 + dy2 * dy2 * 1.6;
          if (dd2 < pd) { pd = dd2; pick = cand2; }
        }
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
    // Garde-fou : la mer ne doit jamais recouvrir plus de 55 % de la carte rendue. La zone rendue
    // est la boîte englobante des centres de territoires (voir Board.prepare) ; on compte, dans
    // cette boîte, la part de cases qui ne sont pas des terres.
    var R0 = 10, bx0 = 1e9, bx1 = -1e9, by0 = 1e9, by1 = -1e9;
    terr.forEach(function (t) { var c = FOF.hexCenter(t.hex, W, R0); bx0 = Math.min(bx0, c.x); bx1 = Math.max(bx1, c.x); by0 = Math.min(by0, c.y); by1 = Math.max(by1, c.y); });
    var dansBoite = 0;
    for (var ci = 0; ci < N; ci++) {
      var cc = FOF.hexCenter(ci, W, R0);
      if (cc.x >= bx0 && cc.x <= bx1 && cc.y >= by0 && cc.y <= by1) dansBoite++;
    }
    if (dansBoite && 1 - terr.length / dansBoite > (n <= 3 ? 0.505 : 0.48)) return null;   // marge : la boîte rendue déborde d'un rayon d'hexagone
    return { W: W, H: H, terr: terr, seas: seas, zoneOf: zoneOf, nCont: targets.length };
  }

  var NAMES = ['Aubelande','Brumeval','Cendrelac','Dorvanne','Éperonde','Fauxmont','Givrecœur','Hautelys','Isarde','Joncval','Karnhelm','Lorvanne','Mortebrise','Noirsable','Orgemont','Pierrelune','Quellrive','Rochebrune','Sombrelac','Taillefer','Ulmecombe','Valbrise','Wyrmelande','Ysembre','Zéphirelle','Argenfeu','Boisroux','Corvelle','Dunemar','Estival','Ferhaven','Grisecôte','Harfleur','Ivrelande','Jaspemont','Lancerive','Merlefond','Nordelys','Oriflamme','Pâlemarche','Roncevaux','Sélune','Tourmaline','Vermeil','Vieilleroche','Aiguemorte','Bellegarde','Clairefont'];
  function names(s, terr) { var pool = shuffle(s, NAMES.slice()); terr.forEach(function (t, i) { t.name = pool[i % pool.length]; }); }
})(window.FOF = window.FOF || {});
