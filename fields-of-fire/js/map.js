/* Fields of Fire - génération de carte (hexagones) */
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
  function continentSizes(s, n, k) {
    var total = 7 * n;
    for (var tries = 0; tries < 400; tries++) {
      // Nombre de continents. Jamais un seul (une masse unique retire tout l'intérêt de la mer),
      // jamais plus que ce que la place permet : chaque continent supplémentaire exige une ceinture
      // d'eau, et les terres disponibles valent 7 × joueurs. Mesuré : à 3 joueurs (21 cases) trois
      // masses séparées ne rentrent dans aucune grille tenant le plafond de 55 % de mer.
      //   3 j : 2      4 j : 2-3      5 j : 2-4      6 j : 2-4
      // La grille est ensuite choisie en fonction de k (voir GRID dans tryGenerate) : une masse de
      // plus demande une carte un peu plus large, sinon la génération échoue ou la mer déborde.
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
    var base = [], k2 = 2, q0 = Math.floor(total / k2);
    for (var q = 0; q < k2; q++) base.push(q === k2 - 1 ? total - q0 * (k2 - 1) : q0);
    return { sizes: base, extra: 0 };
  }

  // Nombre de continents. Jamais un seul (une masse unique retire tout l'intérêt de la mer),
  // jamais plus que ce que la place permet : chaque continent supplémentaire exige une ceinture
  // d'eau, et les terres disponibles valent 7 × joueurs. Mesuré : à 3 joueurs (21 cases) trois
  // masses séparées ne tiennent dans aucune grille respectant le plafond de 55 % de mer.
  //   3 j : 2      4 j : 2-3      5 j : 2-4      6 j : 2-4
  var KMAX = { 3: 2, 4: 3, 5: 4, 6: 4 };

  FOF.generateMap = function (s, n) {
    // Le tirage se fait UNE fois, avant les essais. Il était auparavant refait à chaque essai :
    // deux continents réussissent presque toujours du premier coup alors que quatre demandent
    // plusieurs tentatives, si bien que le hasard retombait sur deux dans 87 % des parties
    // (mesuré : 26 cartes à deux continents sur 30 à cinq joueurs). On tient donc le nombre voulu,
    // et on ne descend d'un cran que s'il est réellement impossible à placer.
    var kmax = KMAX[n] || Math.min(n + 1, 4);
    var kVoulu = FOF.FORCE_K || (2 + ri(s, kmax - 1));
    for (var want = kVoulu; want >= 2; want--) {
      for (var attempt = 0; attempt < 300; attempt++) {
        var m = tryGenerate(s, n, want);
        if (m) return m;
      }
    }
    // Filet de sécurité : une carte sur trois cents environ échouait à trois joueurs et la partie
    // ne démarrait pas (« Carte impossible à générer »). Plutôt que d'abandonner, on desserre le
    // filtre de mer par paliers : mieux vaut une carte un peu plus maritime que pas de partie.
    var seuilInitial = FOF.SEA_EST;
    try {
      for (var relache = 0; relache < 4; relache++) {
        FOF.SEA_EST = (n <= 3 ? 0.215 : 0.48) + 0.04 * (relache + 1);
        for (var w2 = kVoulu; w2 >= 2; w2--) {
          for (var a2 = 0; a2 < 200; a2++) {
            var m2 = tryGenerate(s, n, w2);
            if (m2) return m2;
          }
        }
      }
    } finally { FOF.SEA_EST = seuilInitial; }
    throw new Error('Carte impossible à générer');
  };

  function tryGenerate(s, n, k) {
    var wide = !(s && s.wideSea === false);   // « mer élargie » : choix fait à la création de la partie
    var cs = continentSizes(s, n, k);
    var targets = cs.sizes.slice(); if (cs.extra) targets.push(cs.extra);
    // v1.9.2 : grille choisie pour que la carte rendue tienne dans un rapport ~2:1, qui remplit
    // mieux un écran large et se lit plus clairement. Géométrie hexagonale : un pas en x vaut
    // √3·R, un pas en y vaut 1,5·R, donc le rapport rendu est 1,155 × W/H - on vise W/H ≈ 1,73.
    // La grille est dimensionnée pour que les terres occupent au moins ~45 % de la carte rendue :
    // au-delà, la mer mange l'écran (mesuré à 60-74 % avant cette correction).
    var aire = Math.round(7 * n / (FOF.LAND_TARGET || (n <= 3 ? 0.40 : 0.46)));
    // Grilles retenues après mesure, par joueurs ET par nombre de continents. Chaque couple donne
    // un rendu proche de 2:1 et une mer ≤ 55 % de la surface affichée (plafond fixé par le
    // créateur). Un continent de plus consomme de l'eau : il lui faut une grille plus large.
    //   3 j  k2 10×6 → 54 %        5 j  k2 11×7 → 48 %   k3 11×7 → 49 %   k4 12×7 → 55 %
    //   4 j  k2 10×6 → 47 %        6 j  k2 12×8 → 53 %   k3 12×8 → 54 %   k4 12×8 → 55 %
    //        k3 11×6 → 55 %
    var GRID = {
      3: { 2: [10, 6] },
      4: { 2: [10, 6], 3: [11, 6] },
      5: { 2: [11, 7], 3: [11, 7], 4: [12, 7] },
      6: { 2: [12, 8], 3: [12, 8], 4: [12, 8] }
    };
    var TABLE = { 3: [9, 6], 4: [10, 6], 5: [11, 7], 6: [12, 8] };
    var ASP = FOF.MAP_ASPECT || 1.56;   // rapport rendu ≈ 1,155 × W/H
    var H = Math.max(5, Math.round(Math.sqrt(aire / ASP)));
    var W = Math.round(ASP * H);
    var tb = (FOF.MAP_WH && FOF.MAP_WH[n]) || (GRID[n] && GRID[n][cs.sizes.length]) || TABLE[n];
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
    // v1.9.4 : graines RAPPROCHÉES. Elles étaient auparavant placées le plus loin possible les unes
    // des autres : les continents s'étalaient sur toute la grille et la mer occupait les trois
    // quarts de l'écran. On vise maintenant une distance juste suffisante pour qu'ils ne se
    // touchent pas - des masses voisines séparées par des détroits.
    var VISE = 4;
    var seeds = [];
    for (var c = 0; c < targets.length; c++) {
      var best = -1, bestS = 1e9, bestD = 0;
      for (var t = 0; t < 80; t++) {
        var cand = ri(s, N);
        if (!ok(cand, c)) continue;
        var d = seeds.length ? Math.min.apply(null, seeds.map(function (x) { return hexDist(x, cand, W); })) : VISE;
        if (d < 3) continue;                       // jamais collées
        var score = Math.abs(d - VISE);            // ni collées, ni à l'autre bout de la carte
        if (score < bestS) { bestS = score; best = cand; bestD = d; }
      }
      if (best < 0) return null;
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
        // v1.9.2 : croissance compacte - on tire trois candidats et on garde le plus proche du
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
      for (var q = 0; q < terr.length && !near; q++) if (hexDist(i, terr[q].hex, W) <= (FOF.SEA_BAND || (wide ? 3 : 2))) near = true;
      if (near) water.push(i);
    }
    var waterSet = {}; water.forEach(function (w) { waterSet[w] = true; });
    // adjacences terrestres (indépendantes de la mer)
    terr.forEach(function (t) {
      nbrs(t.hex % W, Math.floor(t.hex / W), W, H).forEach(function (j) {
        if (hexToT[j] !== undefined && t.adj.indexOf(hexToT[j]) < 0) t.adj.push(hexToT[j]);
      });
    });
    // chaque continent doit toucher la mer
    for (c = 0; c < targets.length; c++) {
      var touche = terr.some(function (t) {
        return t.cont === c && nbrs(t.hex % W, Math.floor(t.hex / W), W, H).some(function (j) { return waterSet[j]; });
      });
      if (!touche) return null;
    }
    // Garde-fou : la mer ne doit jamais recouvrir plus de 55 % de la carte rendue. La zone rendue
    // est la boîte englobante des centres de territoires (voir Board.prepare) ; on compte, dans
    // cette boîte, la part de cases qui ne sont pas des terres.
    // Ce test passe AVANT la découpe des mers : il rejette l'essentiel des essais ratés pour
    // presque rien, alors que la découpe coûte cher.
    var R0 = 10, bx0 = 1e9, bx1 = -1e9, by0 = 1e9, by1 = -1e9;
    terr.forEach(function (t) { var c = FOF.hexCenter(t.hex, W, R0); bx0 = Math.min(bx0, c.x); bx1 = Math.max(bx1, c.x); by0 = Math.min(by0, c.y); by1 = Math.max(by1, c.y); });
    var dansBoite = 0;
    for (var ci = 0; ci < N; ci++) {
      var cc = FOF.hexCenter(ci, W, R0);
      if (cc.x >= bx0 && cc.x <= bx1 && cc.y >= by0 && cc.y <= by1) dansBoite++;
    }
    var SEUIL = FOF.SEA_EST || (n <= 3 ? 0.215 : 0.48);
    if (dansBoite && 1 - terr.length / dansBoite > SEUIL) return null;   // marge : la boîte rendue déborde d'un rayon d'hexagone
    var decoupe = decouperMers(terr, hexToT, water, waterSet, W, H, wide ? 3 * n + 6 : 2 * n + 4);
    if (!decoupe) return null;
    var seas = decoupe.seas, nz = seas.length;
    terr.forEach(function (t) { t.seas = decoupe.seasOfT[t.id] || []; });
    if (terr.every(function (t) { return !t.seas.length; })) return null;
    if (seas.some(function (z) { return !z.adjT.length; })) return null;
    var seen = { 0: true }, st = [0];
    while (st.length) { var a = st.pop(); seas[a].adjS.forEach(function (b2) { if (!seen[b2]) { seen[b2] = true; st.push(b2); } }); }
    if (Object.keys(seen).length !== nz) return null;
    names(s, terr);
    return { W: W, H: H, terr: terr, seas: seas, water: water, seaRays: decoupe.rayons, seaTri: decoupe.triSea, nCont: targets.length };
  }

  /* ============================================================================
     v1.9.7 - DÉCOUPE DES MERS PAR RAYONS

     Règle : partout où une frontière entre deux territoires atteint la côte, un trait
     part de ce point et file vers le large en prolongeant exactement cette frontière.
     Le trait coupe la première case d'eau en deux, si bien que les deux territoires
     n'accèdent plus à la même mer à cet endroit : chacun a la sienne.

     Conséquence assumée : une case d'eau n'appartient plus forcément à une seule mer.
     Ce n'est pas un problème pour le moteur - une flotte est posée sur une ZONE de mer
     (« s3 »), jamais sur une case. Les cases ne servent qu'à fabriquer et à dessiner.

     Trop de traits feraient trop de mers : on en retire ensuite, entiers, jusqu'au
     nombre voulu. Retirer un trait entier (et jamais un morceau) garantit qu'aucune
     ligne ne se retrouve à flotter au large, détachée de la côte.
     ============================================================================ */
  var RH = 30;                                   // rayon d'une case, en unités logiques
  function coinsDe(h, W) {
    var c = FOF.hexCenter(h, W, RH), o = [];
    for (var k = 0; k < 6; k++) o.push({ x: c.x + RH * Math.sin(k * Math.PI / 3), y: c.y - RH * Math.cos(k * Math.PI / 3) });
    return o;
  }
  function memePt(a, b) { return Math.abs(a.x - b.x) < 0.6 && Math.abs(a.y - b.y) < 0.6; }
  // Débord du trait, en unités logiques, aux deux extrémités (voir peindreMur).
  FOF.RAY_MARGE = 12;
  // Peint un trait dans une trame de cellules. Utilisé à l'identique par map.js (découpe) et par
  // board.js (rendu et clic) : les deux doivent trouver exactement les mêmes faces.
  FOF.peindreMur = function (ray, valeur, mur, ok, cellDe, taille) {
    var p = ray.pts, M = FOF.RAY_MARGE;
    for (var s = 0; s < p.length - 1; s++) {
      var a = p[s], b = p[s + 1];
      var dx = b.x - a.x, dy = b.y - a.y, L = Math.sqrt(dx * dx + dy * dy) || 1;
      var ux = dx / L, uy = dy / L;
      var t0 = s === 0 ? -M : 0, t1 = s === p.length - 2 ? L + M : L;
      var pas = Math.max(2, Math.ceil((t1 - t0) / (taille / 3)));
      for (var k = 0; k <= pas; k++) {
        var t = t0 + (t1 - t0) * k / pas;
        var ci = cellDe(a.x + ux * t, a.y + uy * t);
        if (ci >= 0 && (!ok || ok[ci])) mur[ci] = valeur;
      }
    }
  };
  function peindreMur(ray, valeur, mur, ok, cellDe, taille) { FOF.peindreMur(ray, valeur, mur, ok, cellDe, taille); }
  // inverse de hexCenter : quelle case contient ce point ?
  FOF.hexAt = function (x, y, W, H) {
    var px = x - 4 - Math.sqrt(3) * RH / 2, py = y - RH - 4;
    var q = (Math.sqrt(3) / 3 * px - py / 3) / RH, r = (2 / 3 * py) / RH;
    var cx = q, cz = r, cy = -cx - cz, rx = Math.round(cx), ry = Math.round(cy), rz = Math.round(cz);
    var dx = Math.abs(rx - cx), dy = Math.abs(ry - cy), dz = Math.abs(rz - cz);
    if (dx > dy && dx > dz) rx = -ry - rz; else if (dy <= dz) rz = -rx - ry;
    var col = rx + (rz - (rz & 1)) / 2, row = rz;
    if (col < 0 || row < 0 || col >= W || row >= H) return -1;
    return row * W + col;
  };

  FOF._decouperMers = function (terr, hexToT, water, waterSet, W, H, nVoulu) { return decouperMers(terr, hexToT, water, waterSet, W, H, nVoulu); };
  function decouperMers(terr, hexToT, water, waterSet, W, H, nVoulu) {
    if (!water.length) return null;
    var hexAt = function (x, y) { return FOF.hexAt(x, y, W, H); };

    /* ---- 1. les traits : d'une jonction côtière à une autre ------------------------------
       Une JONCTION CÔTIÈRE est un sommet de la trame où deux territoires se rencontrent et où
       l'eau commence : le point exact où une frontière terrestre atteint la mer.

       Un trait doit relier deux jonctions. S'il s'arrêtait au milieu de la côte d'un territoire,
       il couperait en deux l'accès à la mer de ce territoire sans qu'aucune frontière ne le
       justifie. Seule exception : un trait qui sort par le bord de la carte.

       Entre les deux bouts, le trait enchaîne des BONDS. Un bond traverse une case d'eau de part
       en part, par son centre, et ressort par le sommet opposé : la case est donc bien coupée en
       deux. Depuis une jonction il n'y a qu'une seule case d'eau, donc le premier bond est forcé -
       et c'est exactement le prolongement de la frontière terrestre. Ensuite, le chemin est libre.  */
    function cle(p) { return Math.round(p.x * 4) + ':' + Math.round(p.y * 4); }
    var som = {};
    function noter(p, h, estTerre) {
      var k = cle(p), s = som[k] || (som[k] = { x: p.x, y: p.y, hs: [], terres: 0, eaux: [] });
      if (s.hs.indexOf(h) >= 0) return;
      s.hs.push(h);
      if (estTerre) s.terres++; else s.eaux.push(h);
    }
    terr.forEach(function (t) { coinsDe(t.hex, W).forEach(function (p) { noter(p, t.hex, true); }); });
    water.forEach(function (h) { coinsDe(h, W).forEach(function (p) { noter(p, h, false); }); });
    var estJonction = {}, estSortie = {}, jonctions = [];
    Object.keys(som).forEach(function (k) {
      var s = som[k];
      if (s.terres >= 2 && s.eaux.length) { estJonction[k] = true; jonctions.push(k); }
      // sommet du bord extérieur : il lui manque une case, donc la carte s'arrête là
      // une sortie de carte est un sommet en pleine eau au bord de la trame : jamais un point
      // de côte, sinon le trait finirait sur le rivage d'un territoire sans aucune frontière là.
      if (s.eaux.length && s.hs.length < 3 && s.terres === 0) estSortie[k] = true;
    });
    if (!jonctions.length) return null;

    // Deux façons d'aller d'une jonction à la suivante, en ligne droite comme en tournant :
    //   · le BOND  (2 R) traverse une case d'eau par son centre - c'est lui qui coupe la case ;
    //   · le PAS   (R)   longe l'arête entre deux cases d'eau.
    // Enchaînés dans la même direction, bond et pas font une ligne droite. Changer de direction
    // coûte cher (voir VIRAGE), pour que les traits restent droits et ne longent pas la côte.
    var VIRAGE = 25 * RH;
    function dirDe(a, b) {
      var an = Math.atan2(b.y - a.y, b.x - a.x) / (Math.PI / 3);
      return ((Math.round(an) % 6) + 6) % 6;
    }
    var coupsCache = {};
    function coups(k) {
      if (coupsCache[k]) return coupsCache[k];
      var s = som[k], out = [];
      s.eaux.forEach(function (h) {                                   // bonds
        var c = FOF.hexCenter(h, W, RH), p2 = { x: 2 * c.x - s.x, y: 2 * c.y - s.y }, k2 = cle(p2);
        if (som[k2]) out.push({ k: k2, d: dirDe(s, p2), L: 2 * RH });
      });
      s.hs.forEach(function (h) {                                     // pas le long d'une arête
        coinsDe(h, W).forEach(function (c2) {
          var dd = Math.sqrt((c2.x - s.x) * (c2.x - s.x) + (c2.y - s.y) * (c2.y - s.y));
          if (dd < RH * 0.5 || dd > RH * 1.5) return;                 // seuls les sommets voisins
          var k2 = cle(c2), s2 = som[k2];
          if (!s2) return;
          var deux = s.hs.filter(function (x) { return s2.hs.indexOf(x) >= 0; });
          if (deux.length !== 2) return;                              // arête du bord : on ne la suit pas
          if (deux.some(function (x) { return !waterSet[x]; })) return;
          if (out.some(function (o) { return o.k === k2; })) return;
          out.push({ k: k2, d: dirDe(s, c2), L: RH });
        });
      });
      coupsCache[k] = out;
      return out;
    }
    // Dijkstra sur (sommet, direction) : le plus droit, puis le plus court.
    function cherche(depart, versSortie) {
      // Un partenaire n'est retenu que s'il est PROCHE : un détroit, une baie, un bras de mer.
      // Au-delà, le trait part vers le bord de la carte. Sans cette limite, toutes les jonctions
      // se mariaient entre voisines le long des côtes et le large restait d'un seul tenant -
      // une mer immense qu'on traversait en un déplacement.
      var dist = {}, prec = {}, file = [], MAXL = 40 * RH;
      coups(depart).forEach(function (o) {
        if (!waterSet[0] && false) return;
        var e = depart + '|' + o.d;
        // depuis une jonction, seul le bond dans l'eau est possible : c'est le prolongement exact
        // de la frontière terrestre. On l'impose en n'ouvrant que les bonds.
        if (o.L < 2 * RH) return;
        // même règle dès le premier bond : si l'autre bout du bond frôle une terre sans être une
        // jonction, ce trait ne peut pas exister - on préfère aucun trait à un trait qui semble
        // se raccrocher au rivage n'importe où.
        if (som[o.k].terres > 0 && !estJonction[o.k]) return;
        dist[o.k + '|' + o.d] = o.L; prec[o.k + '|' + o.d] = { k: depart, d: -1 };
        file.push({ k: o.k, d: o.d, c: o.L });
      });
      var vus = {};
      while (file.length) {
        file.sort(function (a, b) { return a.c - b.c; });
        var u = file.shift(), uk = u.k + '|' + u.d;
        if (vus[uk]) continue;
        vus[uk] = true;
        if (u.c > MAXL) break;
        if (versSortie ? estSortie[u.k] : (estJonction[u.k] && u.k !== depart)) {
          var pts = [], cur = { k: u.k, d: u.d };
          while (cur && cur.d >= 0) { pts.unshift({ x: som[cur.k].x, y: som[cur.k].y }); cur = prec[cur.k + '|' + cur.d]; }
          if (cur) pts.unshift({ x: som[cur.k].x, y: som[cur.k].y });
          return { fin: u.k, pts: pts, cout: u.c };
        }
        if (estJonction[u.k]) continue;                               // on ne traverse pas une jonction
        coups(u.k).forEach(function (o) {
          var c2 = u.c + o.L + (o.d === u.d ? 0 : VIRAGE);
          if (o.d === (u.d + 3) % 6) return;                          // demi-tour interdit
          // En chemin, un trait ne frôle jamais la côte : un sommet qui touche une terre sans être
          // une jonction donnerait l'impression que le trait s'y raccroche, alors qu'aucune
          // frontière n'arrive là. Seules les jonctions, où l'on s'arrête, font exception.
          if (som[o.k].terres > 0 && !estJonction[o.k]) return;
          var vk = o.k + '|' + o.d;
          if (dist[vk] !== undefined && dist[vk] <= c2) return;
          dist[vk] = c2; prec[vk] = { k: u.k, d: u.d };
          file.push({ k: o.k, d: o.d, c: c2 });
        });
      }
      return null;
    }

    // mariage des jonctions : les paires les plus droites et les plus courtes d'abord
    // Pour chaque jonction on compare les deux issues possibles - rejoindre une autre jonction,
    // ou sortir par le bord - et on garde la moins chère. Comme un virage coûte très cher, une
    // jonction qui n'a pas de vis-à-vis proche file tout droit vers le large : c'est ce qui
    // découpe la haute mer, au lieu de laisser une seule étendue qu'on traverse d'un coup.
    var propositions = [], versLeBord = {};
    jonctions.forEach(function (a) {
      var rj = cherche(a, false), rb = cherche(a, true);
      if (rb && (!rj || rb.cout < rj.cout)) versLeBord[a] = rb;
      if (rj) propositions.push({ a: a, b: rj.fin, pts: rj.pts, L: rj.cout });
    });
    propositions.sort(function (p, q) { return p.L - q.L; });
    var pris = {}, rayons = [];
    propositions.forEach(function (p) {
      if (pris[p.a] || pris[p.b] || versLeBord[p.a] || versLeBord[p.b]) return;
      pris[p.a] = pris[p.b] = true;
      rayons.push({ pts: p.pts });
    });
    Object.keys(versLeBord).forEach(function (a) {
      if (pris[a] || versLeBord[a].pts.length < 2) return;
      pris[a] = true; rayons.push({ pts: versLeBord[a].pts });
    });
    // les jonctions restées seules envoient leur trait vers le bord de la carte
    jonctions.forEach(function (a) {
      if (pris[a]) return;
      var r = cherche(a, true);
      if (!r || r.pts.length < 2) return;
      pris[a] = true; rayons.push({ pts: r.pts });
    });
    if (!rayons.length) return null;

    /* ---- 2. découpe exacte : chaque case d'eau est faite de six triangles ----------------
       Un bond traverse la case par son centre, d'un sommet au sommet opposé : il suit donc
       exactement deux rayons de l'hexagone et le partage en deux moitiés de trois triangles.
       Un pas longe une arête entre deux cases. Toute la découpe tient donc sur les triangles -
       pas de trame de pixels, pas d'approximation, et le tracé à l'écran tombe au même endroit. */
    var triDe = {};                                    // case d'eau -> index de base de ses 6 triangles
    water.forEach(function (h, i) { triDe[h] = i * 6; });
    var NT = water.length * 6;
    function indexCoin(h, p) {
      var cs = coinsDe(h, W);
      for (var k = 0; k < 6; k++) if (memePt(cs[k], p)) return k;
      return -1;
    }
    function areteVers(h, hv) {                        // quel côté de h touche hv ?
      var cs = coinsDe(h, W), cv = coinsDe(hv, W);
      for (var k = 0; k < 6; k++) {
        var a = cs[k], b = cs[(k + 1) % 6];
        if (cv.some(function (q) { return memePt(a, q); }) && cv.some(function (q) { return memePt(b, q); })) return k;
      }
      return -1;
    }
    // toutes les paires de triangles voisins, avec la clé du trait qui pourrait les séparer
    var paires = [];
    water.forEach(function (h) {
      var base = triDe[h], cs = coinsDe(h, W), c = FOF.hexCenter(h, W, RH);
      for (var k = 0; k < 6; k++) {
        paires.push({ a: base + (k + 5) % 6, b: base + k, c1: 'R' + h + ':' + k });
        var mx = (cs[k].x + cs[(k + 1) % 6].x) / 2, my = (cs[k].y + cs[(k + 1) % 6].y) / 2;
        var hv = hexAt(c.x + (mx - c.x) * 2.1, c.y + (my - c.y) * 2.1);
        if (hv < 0 || !waterSet[hv] || hv <= h) continue;
        var kv = areteVers(hv, h);
        if (kv < 0) continue;
        paires.push({ a: base + k, b: triDe[hv] + kv, c1: 'A' + h + ':' + k, c2: 'A' + hv + ':' + kv });
      }
    });
    // un segment qui part du centre d'une case vers un de ses sommets : c'est un demi-bond,
    // il coupe la case le long d'un seul rayon
    function estRayon(a, b) {
      var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, h = hexAt(mx, my);
      if (h < 0) return false;
      var c = FOF.hexCenter(h, W, RH);
      return memePt(a, c) || memePt(b, c);
    }
    function coupures(liste) {
      var cut = {};
      liste.forEach(function (ray, ri) {
        for (var s = 0; s < ray.pts.length - 1; s++) {
          var a = ray.pts[s], b = ray.pts[s + 1];
          var dx = b.x - a.x, dy = b.y - a.y, L = Math.sqrt(dx * dx + dy * dy);
          var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
          if (L > 1.5 * RH) {                          // BOND : le milieu du segment est le centre de la case
            var h = hexAt(mx, my);
            if (h < 0 || !waterSet[h]) continue;
            var i1 = indexCoin(h, a), i2 = indexCoin(h, b);
            if (i1 < 0 || i2 < 0) continue;
            cut['R' + h + ':' + i1] = ri; cut['R' + h + ':' + i2] = ri;
          } else if (estRayon(a, b)) {                  // RAYON : du centre d'une case vers un sommet
            var hr = hexAt(mx, my);
            if (hr < 0 || !waterSet[hr]) continue;
            var cr = FOF.hexCenter(hr, W, RH);
            var pointe = memePt(a, cr) ? b : a;
            var ir = indexCoin(hr, pointe);
            if (ir >= 0) cut['R' + hr + ':' + ir] = ri;
          } else {                                     // PAS : le milieu est au milieu d'une arête
            var nx = -dy / L, ny = dx / L;
            var h1 = hexAt(mx + nx * RH * 0.35, my + ny * RH * 0.35);
            var h2 = hexAt(mx - nx * RH * 0.35, my - ny * RH * 0.35);
            if (h1 < 0 || h2 < 0 || !waterSet[h1] || !waterSet[h2]) continue;
            var k1 = areteVers(h1, h2); if (k1 >= 0) cut['A' + h1 + ':' + k1] = ri;
            var k2 = areteVers(h2, h1); if (k2 >= 0) cut['A' + h2 + ':' + k2] = ri;
          }
        }
      });
      return cut;
    }
    function construire(liste) {
      var cut = coupures(liste), pere = new Int32Array(NT);
      for (var i = 0; i < NT; i++) pere[i] = i;
      function trouve(x) { while (pere[x] !== x) { pere[x] = pere[pere[x]]; x = pere[x]; } return x; }
      var liens = [];
      paires.forEach(function (p) {
        var r = cut[p.c1];
        if (r === undefined && p.c2) r = cut[p.c2];
        if (r === undefined) { var ra = trouve(p.a), rb = trouve(p.b); if (ra !== rb) pere[rb] = ra; }
        else liens.push({ a: p.a, b: p.b, ray: r });
      });
      var tailles = {};
      for (var t = 0; t < NT; t++) { var r2 = trouve(t); tailles[r2] = (tailles[r2] || 0) + 1; }
      return { pere: pere, trouve: trouve, liens: liens, tailles: tailles };
    }

    /* ---- 3. équilibrage, et deuxième source de traits ------------------------------------
       Une mer trop grande laisse traverser la carte en un seul déplacement ; une mer minuscule
       enferme une flotte. On vise donc une TAILLE, pas un nombre.

       Deux leviers, dans cet ordre :
       · on FUSIONNE, en retirant des traits entiers, tant qu'une mer est sous le plancher ;
       · s'il reste une mer au-dessus du plafond, on la COUPE avec un embranchement.

       L'embranchement est la deuxième source de traits : les jonctions côtières sont toutes au
       bord, elles ne peuvent pas découper le large. Un trait peut donc repartir du milieu d'un
       autre trait - d'un de ses sommets intermédiaires, jamais de son milieu exact - et filer
       tout droit jusqu'à retomber sur un trait, une jonction côtière ou le bord de la carte. */
    var moyenne = NT / Math.max(1, nVoulu);
    var PLANCHER = Math.max(9, Math.round(moyenne * 0.7)), PLAFOND = Math.max(30, Math.round(moyenne * 1.8));

    function equilibrer(G, liste) {
      var trouve = G.trouve, tailles = G.tailles, liens = G.liens, pere = G.pere;
      liste = liste || rayons;
      function unir(a, b) { var ra = trouve(a), rb = trouve(b); if (ra === rb) return; pere[rb] = ra; }
      var aCote = {};
      terr.forEach(function (t) {
        nbrs(t.hex % W, Math.floor(t.hex / W), W, H).forEach(function (j) {
          if (!waterSet[j]) return;
          var kv = areteVers(j, t.hex);
          if (kv >= 0) aCote[trouve(triDe[j] + kv)] = true;
        });
      });
      var rayMort = {}, bloque = {};
      for (var tour = 0; tour < 400; tour++) {
        var petite = -1, ps = 1e9;
        Object.keys(tailles).forEach(function (r) {
          r = +r;
          if (trouve(r) !== r || bloque[r]) return;
          var urgent = !aCote[r];
          if (!urgent && tailles[r] >= PLANCHER) return;
          var score = (urgent ? -1e6 : 0) + tailles[r];
          if (score < ps) { ps = score; petite = r; }
        });
        if (petite < 0) break;
        // la plus petite voisine, d'abord sans dépasser le plafond ; si aucune ne convient,
        // on accepte quand même - mieux vaut une mer un peu grande qu'un confetti
        var choix = -1;
        [true, false].forEach(function (strict) {
          if (choix >= 0) return;
          var cs = 1e9;
          liens.forEach(function (l) {
            if (rayMort[l.ray] || (liste[l.ray] && liste[l.ray].fixe)) return;   // un embranchement ne se retire pas
            var ra = trouve(l.a), rb = trouve(l.b);
            if (ra === rb || (ra !== petite && rb !== petite)) return;
            var autre = ra === petite ? rb : ra;
            if (strict && tailles[autre] + tailles[petite] > PLAFOND) return;
            if (tailles[autre] < cs) { cs = tailles[autre]; choix = l.ray; }
          });
        });
        if (choix < 0) { bloque[petite] = true; continue; }
        rayMort[choix] = true;
        liens.forEach(function (l) {
          if (l.ray !== choix) return;
          var ra = trouve(l.a), rb = trouve(l.b);
          if (ra === rb) return;
          var na = tailles[ra] + tailles[rb];
          unir(ra, rb);
          var nr = trouve(ra);
          tailles[nr] = na; aCote[nr] = aCote[ra] || aCote[rb];
          if (nr !== ra) delete tailles[ra];
          if (nr !== rb) delete tailles[rb];
        });
      }
      return { rayMort: rayMort, aCote: aCote };
    }
    function plusGrande(G) {
      var root = -1, a = 0;
      Object.keys(G.tailles).forEach(function (r) {
        if (G.trouve(+r) !== +r) return;
        if (G.tailles[r] > a) { a = G.tailles[r]; root = +r; }
      });
      return { root: root, taille: a };
    }
    function droitDepuis(k0, dir, surTrait) {
      var pts = [{ x: som[k0].x, y: som[k0].y }], cur = k0;
      for (var i = 0; i < 40; i++) {
        var cs = coups(cur), suiv = null;
        for (var j = 0; j < cs.length; j++) if (cs[j].d === dir) { suiv = cs[j]; break; }
        if (!suiv) break;
        if (som[suiv.k].terres > 0 && !estJonction[suiv.k]) break;   // pas de frôlement de côte
        cur = suiv.k;
        pts.push({ x: som[cur].x, y: som[cur].y });
        if (surTrait[cur] || estJonction[cur] || estSortie[cur]) return pts.length >= 3 ? pts : null;
      }
      return null;
    }
    function embranchements(G, cible, mort) {
      var surTrait = {}, depart = [];
      rayons.forEach(function (ray, ri) {
        if (mort[ri]) return;              // on ne greffe pas sur un trait qui a été retiré
        var lg = 0, cum = [0];
        for (var s = 0; s < ray.pts.length - 1; s++) {
          var dx = ray.pts[s + 1].x - ray.pts[s].x, dy = ray.pts[s + 1].y - ray.pts[s].y;
          lg += Math.sqrt(dx * dx + dy * dy); cum.push(lg);
        }
        ray.pts.forEach(function (p, i) {
          var k = cle(p);
          surTrait[k] = true;
          if (i === 0 || i === ray.pts.length - 1) {
            // Un trait peut aussi repartir du BOUT AU LARGE d'un autre trait. Ces points-là sont
            // en pleine eau, donc sans risque de frôler une côte, et ce sont les seuls qui
            // permettent de trancher la haute mer, loin de toute côte.
            if (som[k] && som[k].terres === 0) {
              var vois = cle(ray.pts[i === 0 ? 1 : ray.pts.length - 2]);
              depart.push({ k: k, avant: vois, apres: vois });
            }
            return;
          }
          if (Math.abs(cum[i] / lg - 0.5) < 0.03) return;            // jamais pile au milieu
          depart.push({ k: k, avant: cle(ray.pts[i - 1]), apres: cle(ray.pts[i + 1]) });
        });
      });
      // deuxième famille de points de départ : le centre d'une case que le trait traverse.
      // C'est indispensable quand un trait ne fait qu'un bond - il n'a alors aucun sommet
      // intermédiaire -, ce qui est le cas courant sur une mer étroite.
      var centres = [];
      rayons.forEach(function (ray, ri) {
        if (mort[ri]) return;
        for (var s2 = 0; s2 < ray.pts.length - 1; s2++) {
          var a2 = ray.pts[s2], b2 = ray.pts[s2 + 1];
          var dx2 = b2.x - a2.x, dy2 = b2.y - a2.y;
          if (Math.sqrt(dx2 * dx2 + dy2 * dy2) <= 1.5 * RH) continue;
          var hc = hexAt((a2.x + b2.x) / 2, (a2.y + b2.y) / 2);
          if (hc < 0 || !waterSet[hc]) continue;
          var seul = ray.pts.length === 2;                 // trait d'un seul bond : son centre EST le milieu
          centres.push({ h: hc, i1: indexCoin(hc, a2), i2: indexCoin(hc, b2), milieu: seul });
        }
      });
      var out = [];
      centres.forEach(function (ct) {
        if (ct.i1 < 0 || ct.i2 < 0) return;
        var c0 = FOF.hexCenter(ct.h, W, RH), cs0 = coinsDe(ct.h, W);
        var borde0 = false;
        for (var q = 0; q < 6; q++) if (G.trouve(triDe[ct.h] + q) === cible) borde0 = true;
        if (!borde0) return;
        for (var k0 = 0; k0 < 6; k0++) {
          if (k0 === ct.i1 || k0 === ct.i2) continue;      // pas dans l'axe du trait
          var kc = cle(cs0[k0]);
          if (!som[kc]) continue;
          if (som[kc].terres > 0 && !estJonction[kc]) continue;
          var pts0 = [{ x: c0.x, y: c0.y }, { x: cs0[k0].x, y: cs0[k0].y }];
          if (surTrait[kc] || estJonction[kc] || estSortie[kc]) { out.push(pts0); continue; }
          var suite = droitDepuis(kc, dirDe(c0, cs0[k0]), surTrait);
          if (suite) out.push(pts0.concat(suite.slice(1)));
        }
      });
      depart.forEach(function (dp) {
        var s0 = som[dp.k];
        if (!s0) return;
        var borde = false;
        s0.eaux.forEach(function (h) {
          var i0 = indexCoin(h, s0);
          if (i0 < 0) return;
          if (G.trouve(triDe[h] + i0) === cible || G.trouve(triDe[h] + (i0 + 5) % 6) === cible) borde = true;
        });
        if (!borde) return;
        var interdits = {};
        [dp.avant, dp.apres].forEach(function (k2) { if (som[k2]) interdits[dirDe(s0, som[k2])] = true; });
        for (var d = 0; d < 6; d++) {
          if (interdits[d]) continue;
          var ch = droitDepuis(dp.k, d, surTrait);
          if (ch) out.push(ch);
        }
      });
      out.sort(function (a, b) { return b.length - a.length; });
      return out.slice(0, 14);
    }

    var F = construire(rayons), MORT = equilibrer(F, rayons);
    for (var ronde = 0; ronde < 20; ronde++) {
      var pg = plusGrande(F);
      if (pg.taille <= PLAFOND) break;
      var cands = embranchements(F, pg.root, MORT.rayMort), mieux = null;
      cands.forEach(function (pts) {
        var liste = rayons.concat([{ pts: pts, fixe: true }]);
        var G = construire(liste);
        var M = equilibrer(G, liste), p2 = plusGrande(G);
        if (p2.taille >= pg.taille) return;
        if (!mieux || p2.taille < mieux.t) mieux = { pts: pts, t: p2.taille, G: G, M: M };
      });
      if (!mieux) break;
      rayons.push({ pts: mieux.pts, fixe: true });
      F = mieux.G; MORT = mieux.M;
    }
    var pere = F.pere, lienTri = F.liens, rayMort = MORT.rayMort;
    function trouve(x) { return F.trouve(x); }

    /* ---- 5. mers, ancres, adjacences ---- */
    var racines = [];
    for (var t2 = 0; t2 < NT; t2++) { var r2 = trouve(t2); if (racines.indexOf(r2) < 0) racines.push(r2); }
    racines.sort(function (a, b) { return a - b; });
    var rang = {}; racines.forEach(function (r, i) { rang[r] = i; });
    var nz = racines.length;
    var seas = [], somme = [];
    for (var z = 0; z < nz; z++) { seas.push({ id: z, hexes: [], adjT: [], adjS: [], anchor: { x: 0, y: 0 } }); somme.push({ x: 0, y: 0, n: 0 }); }
    var triSea = new Int16Array(NT);
    water.forEach(function (h) {
      var base = triDe[h], c = FOF.hexCenter(h, W, RH), cs = coinsDe(h, W);
      for (var k = 0; k < 6; k++) {
        var z2 = rang[trouve(base + k)];
        triSea[base + k] = z2;
        var gx = (c.x + cs[k].x + cs[(k + 1) % 6].x) / 3, gy = (c.y + cs[k].y + cs[(k + 1) % 6].y) / 3;
        somme[z2].x += gx; somme[z2].y += gy; somme[z2].n++;
        if (seas[z2].hexes.indexOf(h) < 0) seas[z2].hexes.push(h);
      }
    });
    for (var z3 = 0; z3 < nz; z3++) {
      if (!somme[z3].n) return null;
      seas[z3].anchor = { x: somme[z3].x / somme[z3].n, y: somme[z3].y / somme[z3].n };
    }
    // mers voisines : celles que sépare un trait encore en place
    lienTri.forEach(function (l) {
      if (rayMort[l.ray]) return;
      var za = rang[trouve(l.a)], zb = rang[trouve(l.b)];
      if (za === undefined || zb === undefined || za === zb) return;
      if (seas[za].adjS.indexOf(zb) < 0) seas[za].adjS.push(zb);
      if (seas[zb].adjS.indexOf(za) < 0) seas[zb].adjS.push(za);
    });
    // accès à la mer : le triangle que chaque territoire voit par-dessus son arête de côte
    var seasOfT = {};
    terr.forEach(function (t) {
      var acc = [];
      nbrs(t.hex % W, Math.floor(t.hex / W), W, H).forEach(function (j) {
        if (!waterSet[j]) return;
        var kv3 = areteVers(j, t.hex);
        if (kv3 < 0) return;
        var zf = rang[trouve(triDe[j] + kv3)];
        if (zf !== undefined && acc.indexOf(zf) < 0) acc.push(zf);
      });
      seasOfT[t.id] = acc;
      acc.forEach(function (zf) { if (seas[zf].adjT.indexOf(t.id) < 0) seas[zf].adjT.push(t.id); });
    });
    // un trait qui ne sépare plus rien n'est pas dessiné
    var utile = {};
    lienTri.forEach(function (l) { if (!rayMort[l.ray] && trouve(l.a) !== trouve(l.b)) utile[l.ray] = true; });
    var restes = rayons.filter(function (r, i) { return utile[i]; });
    return { seas: seas, seasOfT: seasOfT, rayons: restes, triSea: Array.prototype.slice.call(triSea) };
  }

  var NAMES = ['Aubelande','Brumeval','Cendrelac','Dorvanne','Éperonde','Fauxmont','Givrecœur','Hautelys','Isarde','Joncval','Karnhelm','Lorvanne','Mortebrise','Noirsable','Orgemont','Pierrelune','Quellrive','Rochebrune','Sombrelac','Taillefer','Ulmecombe','Valbrise','Wyrmelande','Ysembre','Zéphirelle','Argenfeu','Boisroux','Corvelle','Dunemar','Estival','Ferhaven','Grisecôte','Harfleur','Ivrelande','Jaspemont','Lancerive','Merlefond','Nordelys','Oriflamme','Pâlemarche','Roncevaux','Sélune','Tourmaline','Vermeil','Vieilleroche','Aiguemorte','Bellegarde','Clairefont'];
  function names(s, terr) { var pool = shuffle(s, NAMES.slice()); terr.forEach(function (t, i) { t.name = pool[i % pool.length]; }); }
})(window.FOF = window.FOF || {});
