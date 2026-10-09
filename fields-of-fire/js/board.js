/* Fields of Fire - rendu de la carte (v1.4) : trame haute définition, frontières irrégulières,
   motifs « papier peint » par terrain, mer avec hauts-fonds, surbrillances par masques. */
(function (FOF) {
  'use strict';
  var R = 30;                      // rayon d'une case hexagonale de base (unités logiques)
  var IMG = {}, imgReady = null;
  function loadImages() {
    if (imgReady) return imgReady;
    var names = ['biome-P', 'biome-F', 'biome-M', 'biome-Ma'];
    imgReady = Promise.all(names.map(function (n) {
      return new Promise(function (res) { var im = new Image(); im.onload = function () { IMG[n] = im; res(); }; im.onerror = function () { res(); }; im.src = 'assets/icons/' + n + '.png'; });
    }));
    return imgReady;
  }
  function hash(x, y, s) { var h = x * 374761393 + y * 668265263 + s * 982451653; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function vnoise(x, y, s) {
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
    return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
  }
  function pixToHex(x, y) {
    var px = x - 4 - Math.sqrt(3) * R / 2, py = y - R - 4;
    var q = (Math.sqrt(3) / 3 * px - py / 3) / R, r = (2 / 3 * py) / R;
    var cx = q, cz = r, cy = -cx - cz, rx = Math.round(cx), ry = Math.round(cy), rz = Math.round(cz);
    var dx = Math.abs(rx - cx), dy = Math.abs(ry - cy), dz = Math.abs(rz - cz);
    if (dx > dy && dx > dz) rx = -ry - rz; else if (dy <= dz) rz = -rx - ry;
    return { col: rx + (rz - (rz & 1)) / 2, row: rz };
  }

  // couleurs (v1.5 : palette plus vive, façon carte peinte)
  var LAND = { P: [242, 214, 118], F: [112, 176, 82], M: [176, 164, 146], Ma: [104, 170, 140] };
  var INK = { P: '#9a7a2a', F: '#2f6128', M: '#5e4c3c', Ma: '#245a4c' };
  var SEA_DEEP = [22, 76, 128], SEA_SHALLOW = [82, 196, 204], SAND = [240, 222, 170];
  var RELIEF = { P: 0.3, F: 0.55, M: 1.2, Ma: 0.2 };
  var MOTTLE = { P: 10, F: 22, M: 12, Ma: 14 };

  var cache = null;
  /* v1.9.17 - cartes historiques : la trame d'étiquettes (une valeur par pixel, voir js/cartes.js)
     remplace les hexagones déformés. Chargée une fois par carte et gardée en mémoire. */
  var trames = {};
  function chargerTrame(m) {
    if (!m.hist) return Promise.resolve(null);
    var cle = m.hist + '-' + m.terr.length / 7;
    if (trames[cle]) return trames[cle];
    trames[cle] = new Promise(function (res, rej) {
      var im = new Image();
      im.onload = function () {
        var c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
        var x = c.getContext('2d'); x.drawImage(im, 0, 0);
        var d = x.getImageData(0, 0, c.width, c.height).data, lab = new Uint8Array(c.width * c.height);
        for (var i = 0; i < lab.length; i++) lab[i] = d[i * 4];
        res({ w: c.width, h: c.height, lab: lab });
      };
      im.onerror = function () { delete trames[cle]; rej(new Error('Trame de carte introuvable : ' + cle)); };
      im.src = 'assets/cartes/' + cle + '.png?v=' + encodeURIComponent((FOF.CONFIG && FOF.CONFIG.version) || '');
    });
    return trames[cle];
  }
  function build(st, trame) {
    var m = st.map;
    if (m.hist) return buildHist(st, trame);
    var W = m.W, H = m.H, seed = m.terr.length * 131 + W;
    var hexT = {}; m.terr.forEach(function (t) { hexT[t.hex] = t.id; });
    // v1.9.7 - une case d'eau n'appartient plus forcément à une seule mer : les traits la coupent
    // par son centre. Chaque case est donc lue en six triangles, et map.js dit à quelle mer va
    // chacun (voir seaTri). Le pixel trouve son triangle par l'angle depuis le centre de la case.
    var iEau = {}; (m.water || []).forEach(function (h, i) { iEau[h] = i; });
    // cadrage serré sur les terres (+ une bande de mer)
    var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    m.terr.forEach(function (t) { var c = FOF.hexCenter(t.hex, W, R); minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x); minY = Math.min(minY, c.y); maxY = Math.max(maxY, c.y); });
    var pad = R * 1.9; minX -= pad; minY -= pad; maxX += pad; maxY += pad;
    var wU = maxX - minX, hU = maxY - minY;
    var S = Math.max(1.6, Math.min(3.4, 3000 / wU));
    var gw = Math.ceil(wU * S), gh = Math.ceil(hU * S), N = gw * gh;
    var kind = new Int8Array(N), id = new Int16Array(N);
    for (var gy = 0; gy < gh; gy++) for (var gx = 0; gx < gw; gx++) {
      var x = minX + (gx + 0.5) / S, y = minY + (gy + 0.5) / S;
      var wx = x + R * 0.42 * vnoise(x / 38, y / 38, seed) + R * 0.16 * vnoise(x / 11, y / 11, seed + 7) + R * 0.05 * vnoise(x / 3.5, y / 3.5, seed + 11);
      var wy = y + R * 0.42 * vnoise(x / 38 + 50, y / 38, seed + 3) + R * 0.16 * vnoise(x / 11, y / 11 + 90, seed + 9) + R * 0.05 * vnoise(x / 3.5 + 20, y / 3.5, seed + 13);
      var hc = pixToHex(wx, wy), i = gy * gw + gx;
      if (hc.col < 0 || hc.row < 0 || hc.col >= W || hc.row >= H) { kind[i] = 0; continue; }
      var h = hc.row * W + hc.col;
      if (hexT[h] !== undefined) { kind[i] = 1; id[i] = hexT[h]; }
      else if (iEau[h] !== undefined && m.seaTri) {
        var cc = FOF.hexCenter(h, W, R);
        var ang = Math.atan2(wy - cc.y, wx - cc.x) * 180 / Math.PI + 90;
        var kk = Math.floor((((ang % 360) + 360) % 360) / 60) % 6;
        kind[i] = 2; id[i] = m.seaTri[iEau[h] * 6 + kk];
      }
      else kind[i] = 0;
    }
    // v1.9.19 - le large (au-delà de la bande d'eau découpée en mers) est rattaché à la mer la plus
    // proche : les frontières de mer vont ainsi jusqu'au bord de la carte au lieu de s'arrêter au
    // milieu de l'eau, ce qui faisait des traits isolés, sans rien délimiter.
    if (!FOF.SANS_REDRESSE) {
      var fl = new Int32Array(N), hl = 0, tl = 0;
      for (var q0 = 0; q0 < N; q0++) if (kind[q0] === 2) fl[tl++] = q0;
      while (hl < tl) {
        var u0 = fl[hl++], x0 = u0 % gw;
        if (x0 > 0) larg(u0 - 1); if (x0 < gw - 1) larg(u0 + 1); if (u0 >= gw) larg(u0 - gw); if (u0 + gw < N) larg(u0 + gw);
      }
    }
    function larg(j) { if (kind[j] === 0) { kind[j] = 2; id[j] = id[u0]; fl[tl++] = j; } }
    var u0;
    var segs = FOF.SANS_REDRESSE ? null : redresserMers(kind, id, gw, gh, S);
    var rs = finir(st, { seed: seed, minX: minX, minY: minY, maxX: maxX, maxY: maxY, wU: wU, hU: hU, S: S, gw: gw, gh: gh, kind: kind, id: id, W: W });
    rs.seaSegs = segs;
    return rs;
  }

  /* v1.9.20 - frontières de mer (retours du créateur, 07/10/2026). La 1.9.19 les avait rendues
     droites, en segments : trop raide. On garde maintenant les zones de mer telles que le moteur les
     a découpées et on trace leur VRAIE limite, lissée en courbe douce (moyenne glissante sur environ
     18 unités, deux passes) : plus d'ondulations serrées, plus de traits au milieu de l'eau (le large est rattaché
     à la mer voisine, voir build), et le trait colle toujours à la limite réelle des zones.
     Renvoie des polylignes en pixels de trame, ou null. */
  function redresserMers(kind, id, gw, gh, S) {
    var N = gw * gh, i, x, y;
    // 1. pixels frontière : mer a qui touche (4-voisins) une mer b ≠ a ; regroupés par paire
    var front = new Int32Array(N).fill(-1), paires = {}, nP = 0;
    for (i = 0; i < N; i++) {
      if (kind[i] !== 2) continue;
      x = i % gw; var a = id[i], b = -1;
      if (x < gw - 1 && kind[i + 1] === 2 && id[i + 1] !== a) b = id[i + 1];
      else if (i + gw < N && kind[i + gw] === 2 && id[i + gw] !== a) b = id[i + gw];
      else if (x > 0 && kind[i - 1] === 2 && id[i - 1] !== a) b = id[i - 1];
      else if (i >= gw && kind[i - gw] === 2 && id[i - gw] !== a) b = id[i - gw];
      if (b < 0) continue;
      var cle = Math.min(a, b) + ':' + Math.max(a, b);
      if (paires[cle] === undefined) paires[cle] = nP++;
      front[i] = paires[cle];
    }
    if (!nP) return null;
    // v1.9.24 - distance à la terre (en pixels de trame) : loin des côtes, le trait peut être plus droit
    var dTerre = new Int32Array(N).fill(1 << 20), fq = new Int32Array(N), fh = 0, ft = 0;
    for (i = 0; i < N; i++) if (kind[i] === 1) { dTerre[i] = 0; fq[ft++] = i; }
    while (fh < ft) { var uq = fq[fh++], xq = uq % gw, dq = dTerre[uq] + 1; [xq > 0 ? uq - 1 : -1, xq < gw - 1 ? uq + 1 : -1, uq - gw, uq + gw].forEach(function (j) { if (j >= 0 && j < N && dTerre[j] > dq) { dTerre[j] = dq; fq[ft++] = j; } }); }
    function tolerance(pt) { var j = Math.min(gh - 1, Math.max(0, pt[1] | 0)) * gw + Math.min(gw - 1, Math.max(0, pt[0] | 0)); return dTerre[j] > 14 * S ? 11 * S : 4.5 * S; }
    // 2. composantes (8-connexité) de chaque frontière, ordonnées puis lissées
    var vu = new Uint8Array(N), segs = [], file = new Int32Array(N), dist = new Int32Array(N);
    function voisins8(k, f) { var kx = k % gw; for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; var nx = kx + dx, j = k + dy * gw + dx; if (nx < 0 || nx >= gw || j < 0 || j >= N) continue; f(j); } }
    for (i = 0; i < N; i++) {
      if (front[i] < 0 || vu[i]) continue;
      var membres = [], f0 = front[i], h2 = 0, t2 = 0; file[t2++] = i; vu[i] = 1;
      while (h2 < t2) { var u2 = file[h2++]; membres.push(u2); voisins8(u2, function (j) { if (!vu[j] && front[j] === f0) { vu[j] = 1; file[t2++] = j; } }); }
      if (membres.length < 2) continue;
      var marque = {}; membres.forEach(function (k) { marque[k] = 1; });
      // bouts : le plus loin d'un pixel quelconque, puis le plus loin de celui-là (dans la composante)
      membres.forEach(function (k) { dist[k] = -1; });
      var bout1 = parcours(membres[0]); parcours(bout1);
      var ordre = membres.filter(function (k) { return dist[k] >= 0; }).sort(function (p1, p2) { return dist[p1] - dist[p2]; });
      // centre de chaque couche de distance = trajet ordonné, puis moyenne glissante (bouts fixes)
      var couches = [], kc;
      ordre.forEach(function (k) { var dd = dist[k]; (couches[dd] = couches[dd] || [0, 0, 0]); couches[dd][0] += k % gw; couches[dd][1] += (k / gw) | 0; couches[dd][2]++; });
      var chemin = []; couches.forEach(function (c) { if (c) chemin.push([c[0] / c[2] + 0.5, c[1] / c[2] + 0.5]); });
      if (chemin.length < 2) continue;
      // deux passes de moyenne glissante, fenêtre de ±9 unités : courbe douce, bouts fixes
      var fen = Math.max(2, Math.round(9 * S)), lisse = chemin;
      for (var passeL = 0; passeL < 2; passeL++) {
        var src = lisse; lisse = [];
        for (kc = 0; kc < src.length; kc++) {
          if (kc === 0 || kc === src.length - 1) { lisse.push(src[kc]); continue; }
          var r = Math.min(fen, kc, src.length - 1 - kc), sx = 0, sy = 0;
          for (var q3 = kc - r; q3 <= kc + r; q3++) { sx += src[q3][0]; sy += src[q3][1]; }
          lisse.push([sx / (2 * r + 1), sy / (2 * r + 1)]);
        }
      }
      // v1.9.24 - « un peu plus droit » (créateur, 08/10/2026) : la courbe lissée est simplifiée
      // (Douglas-Peucker, écart maximal de 4,5 unités à la vraie limite près des côtes, 11 au large) ; les traits de moins de
      // 10 unités, ou qui suivent le bord du cadre, sont des restes de découpage : on ne les trace pas.
      var poly = simplifier(lisse, tolerance), lg = 0;
      for (kc = 1; kc < poly.length; kc++) lg += Math.hypot(poly[kc][0] - poly[kc - 1][0], poly[kc][1] - poly[kc - 1][1]);
      var marge = 3 * S, surBord = poly.every(function (p0) { return p0[0] < marge || p0[1] < marge || p0[0] > gw - marge || p0[1] > gh - marge; });
      if (lg >= 10 * S && !surBord) segs.push(poly);

      function parcours(dep) {   // parcours limité à la composante
        membres.forEach(function (k) { dist[k] = -1; });
        var hh = 0, tt = 0, der = dep; file[tt++] = dep; dist[dep] = 0;
        while (hh < tt) { var uu = file[hh++]; der = uu; voisins8(uu, function (j) { if (marque[j] && dist[j] === -1) { dist[j] = dist[uu] + 1; file[tt++] = j; } }); }
        return der;
      }
    }
    if (!segs.length) return null;
    return segs;
  }
  // Douglas-Peucker : garde les points qui s'écartent de la corde de plus que tol(point)
  function simplifier(pts, tol) {
    if (pts.length < 3) return pts.slice();
    var garder = new Uint8Array(pts.length); garder[0] = garder[pts.length - 1] = 1;
    var pile = [[0, pts.length - 1]];
    while (pile.length) {
      var seg = pile.pop(), i0 = seg[0], i1 = seg[1], ax = pts[i0][0], ay = pts[i0][1], bx = pts[i1][0], by = pts[i1][1];
      var dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1e-9, dmax = -1, imax = -1;
      for (var i = i0 + 1; i < i1; i++) { var d = Math.abs(dy * (pts[i][0] - ax) - dx * (pts[i][1] - ay)) / L; if (d > dmax) { dmax = d; imax = i; } }
      if (imax > 0 && dmax > tol(pts[imax])) { garder[imax] = 1; pile.push([i0, imax], [imax, i1]); }
    }
    return pts.filter(function (p0, i) { return garder[i]; });
  }
  function buildHist(st, tr) {
    var m = st.map, S = FOF.HIST_S, gw = tr.w, gh = tr.h, N = gw * gh;
    var kind = new Int8Array(N), id = new Int16Array(N), lab = tr.lab;
    for (var i = 0; i < N; i++) {
      var v = lab[i];
      if (v >= 100) { kind[i] = 2; id[i] = v - 100; } else if (v > 0) { kind[i] = 1; id[i] = v - 1; } else kind[i] = 0;
    }
    return finir(st, { seed: m.terr.length * 131 + 7, minX: 0, minY: 0, maxX: gw / S, maxY: gh / S, wU: gw / S, hU: gh / S, S: S, gw: gw, gh: gh, kind: kind, id: id, W: 0, hist: true });
  }
  function finir(st, o) {
    var m = st.map, seed = o.seed, minX = o.minX, minY = o.minY, maxX = o.maxX, maxY = o.maxY, wU = o.wU, hU = o.hU, S = o.S, gw = o.gw, gh = o.gh, N = gw * gh, kind = o.kind, id = o.id, W = o.W;
    // champ de distance au bord de sa région, et distance de la mer à la terre
    var CAP = Math.round(14 * S);
    function bfs(isSeed, same) {
      var d = new Uint8Array(N).fill(255), q = new Int32Array(N), qh = 0, qt = 0;
      for (var i = 0; i < N; i++) if (isSeed(i)) { d[i] = 0; q[qt++] = i; }
      while (qh < qt) {
        var u = q[qh++], du = d[u]; if (du >= CAP) continue;
        var ux = u % gw;
        if (ux > 0) step(u - 1); if (ux < gw - 1) step(u + 1); if (u >= gw) step(u - gw); if (u + gw < N) step(u + gw);
      }
      function step(j) { if (d[j] > d[u] + 1 && same(u, j)) { d[j] = d[u] + 1; q[qt++] = j; } }
      return d;
    }
    function edge(i) {
      var x = i % gw, k = kind[i], v = id[i];
      return (x > 0 && (kind[i - 1] !== k || id[i - 1] !== v)) || (x < gw - 1 && (kind[i + 1] !== k || id[i + 1] !== v)) ||
        (i >= gw && (kind[i - gw] !== k || id[i - gw] !== v)) || (i + gw < N && (kind[i + gw] !== k || id[i + gw] !== v));
    }
    var dist = bfs(edge, function (a, b) { return kind[a] === kind[b] && id[a] === id[b]; });
    function landAdj(i) {
      if (kind[i] === 1) return false; var x = i % gw;
      return (x > 0 && kind[i - 1] === 1) || (x < gw - 1 && kind[i + 1] === 1) || (i >= gw && kind[i - gw] === 1) || (i + gw < N && kind[i + gw] === 1);
    }
    var shore = bfs(landAdj, function (a, b) { return kind[b] !== 1; });
    // côte : pixels de terre qui touchent la mer
    function coast(i) {
      var x = i % gw; return (x > 0 && kind[i - 1] !== 1) || (x < gw - 1 && kind[i + 1] !== 1) || (i >= gw && kind[i - gw] !== 1) || (i + gw < N && kind[i + gw] !== 1);
    }
    var coastD = bfs(function (i) { return kind[i] === 1 && coast(i); }, function (a, b) { return kind[b] === 1; });
    // ancres : point le plus intérieur de chaque région + boîtes englobantes
    var best = {}, box = {};
    for (var i = 0; i < N; i++) {
      if (kind[i] !== 1 && kind[i] !== 2) continue;
      var key = (kind[i] === 1 ? 't' : 's') + id[i], x2 = i % gw, y2 = (i / gw) | 0;
      // v1.9.11 - une mer coupée par le bord du cadre avait son « point le plus intérieur » collé à
      // ce bord : les pions posés en mer sortaient de la carte (signalé en playtest). Le bord du
      // cadre compte désormais comme une frontière pour les mers.
      var dd = Math.min(dist[i], CAP);
      if (kind[i] === 2) dd = Math.min(dd, x2, gw - 1 - x2, y2, gh - 1 - y2);
      var sc = dd * 10 + hash(i, 3, seed);
      if (!best[key] || sc > best[key].sc) best[key] = { sc: sc, i: i };
      var b = box[key] || (box[key] = { x0: x2, y0: y2, x1: x2, y1: y2 });
      if (x2 < b.x0) b.x0 = x2; if (x2 > b.x1) b.x1 = x2; if (y2 < b.y0) b.y0 = y2; if (y2 > b.y1) b.y1 = y2;
    }
    var anchor = {};
    Object.keys(best).forEach(function (k) { var j = best[k].i; anchor[k] = { x: minX + ((j % gw) + 0.5) / S, y: minY + (((j / gw) | 0) + 0.5) / S }; });
    m.seas.forEach(function (z) {
      if (anchor['s' + z.id]) return;
      if (o.hist) return;
      var c = z.anchor && z.anchor.x !== undefined ? z.anchor : FOF.hexCenter(z.anchor, W, R);
      anchor['s' + z.id] = { x: Math.max(minX + 10, Math.min(maxX - 10, c.x)), y: Math.max(minY + 10, Math.min(maxY - 10, c.y)) };
    });
    return { key: st.seed + ':' + m.terr.length, hist: !!o.hist, seed: seed, minX: minX, minY: minY, wU: wU, hU: hU, S: S, gw: gw, gh: gh, kind: kind, id: id, dist: dist, shore: shore, coastD: coastD, anchor: anchor, box: box, masks: {}, tint: {} };
  }

  /* ---------- v1.5b : habillage « carte 16 bits » (pixel art tramé, sprites) ---------- */
  function hex2(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function pal(a) { return a.map(hex2); }
  var PX = {
    P: pal(['#7fb83f', '#94c94c', '#aad65c', '#c4e27a']),          // prairie claire
    F: pal(['#265e2a', '#2f7030', '#3a8236', '#4a943e']),          // sous-bois
    M: pal(['#8e8676', '#a39b89', '#b8b09e', '#cfc8b6']),          // rocaille
    Ma: pal(['#4d5c3c', '#5a6b44', '#687a4c', '#778a57']),         // tourbe
    deep: pal(['#1f56b0', '#2662c0', '#2e70cc', '#377dd6']),
    shal: pal(['#3592d6', '#43a8de', '#58bee6', '#7cd4ec']),
    sand: pal(['#d9bf7c', '#e6cf92', '#f0dea8']),
    cliff: pal(['#5b4a38', '#735f48', '#8c775b'])
  };
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function tone(p, v) { // v dans [0,1] : dégradé doux entre les teintes de la palette
    var n = p.length, f = Math.max(0, Math.min(n - 1, v * (n - 1))), k = Math.min(n - 2, Math.floor(f)), t = f - k, a = p[k], b = p[k + 1];
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }
  // sprites en pixels : . transparent ; lettres = couleurs
  var SPR = {
    tree: { c: { d: '#173f1a', c: '#2b6e27', b: '#3f8f32', a: '#6cbf45', h: '#a6e06a', t: '#5a3a1e', s: 'S' }, m: [
      '..dddd..', '.dcbbad.', 'dcbbaahd', 'dcbbbaad', 'dccbbbbd', 'ddccbbcd', '.ddccdd.', '..sdts..', '...st...'] },
    pine: { c: { d: '#123a1c', c: '#1f5a2a', b: '#2d7536', a: '#4f9a45', t: '#5a3a1e', s: 'S' }, m: [
      '...d...', '..dad..', '..dbd..', '.dabcd.', '.dbbcd.', 'dabbccd', 'dbbcccd', '.ddddd.', '..sts..'] },
    bush: { c: { d: '#2c5a1e', b: '#5c9a34', a: '#86c24c', s: 'S' }, m: ['.dbd.', 'dbaad', 'dbbbd', '.sss.'] },
    reed: { c: { g: '#35602a', l: '#5f8f3c', r: '#6b4424' }, m: ['r.r..', 'rgr.r', 'glg.r', 'g.glg', 'g.g.g', 'glg.g'] },
    rock: { c: { d: '#4e4a44', b: '#8f897e', a: '#c3bdb0', s: 'S' }, m: ['.dbd.', 'dbaad', 'dbbbd', 'sdddd'] }
  };
  Object.keys(SPR).forEach(function (k) { var c = SPR[k].c; Object.keys(c).forEach(function (q) { if (c[q] !== 'S') c[q] = hex2(c[q]); }); });

  // décor vectoriel (style carte de jeu de rôle), x, y = pied du motif en pixels, k = pixels par unité
  function ell(c, x, y, rx, ry, col) { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 7); c.fill(); }
  var VEC = {
    F: function (c, x, y, k, r) {
      if (r < 0.28) { // sapin
        var h = (4.6 + r * 3) * k, w = (1.6 + r * 0.8) * k;
        ell(c, x + 0.8 * k, y + 0.3 * k, w * 0.9, 0.9 * k, 'rgba(10,35,12,.35)');
        c.fillStyle = '#4a2f18'; c.fillRect(x - 0.35 * k, y - 1.2 * k, 0.7 * k, 1.2 * k);
        for (var L = 0; L < 3; L++) {
          var yb = y - 0.9 * k - L * h * 0.24, ww = w * (1 - L * 0.22), hh = h * 0.45;
          c.fillStyle = '#1c5530'; c.beginPath(); c.moveTo(x - ww, yb); c.lineTo(x, yb - hh); c.lineTo(x + ww, yb); c.closePath(); c.fill();
          c.fillStyle = '#2f7a3e'; c.beginPath(); c.moveTo(x - ww, yb); c.lineTo(x, yb - hh); c.lineTo(x - ww * 0.05, yb); c.closePath(); c.fill();
        }
        return;
      }
      var s = (1.5 + r * 0.8) * k;
      ell(c, x + 0.9 * k, y + 0.2 * k, s * 1.05, s * 0.45, 'rgba(10,35,12,.32)');
      ell(c, x, y - s * 0.9, s * 1.08, s, '#1f5e24');
      ell(c, x - s * 0.12, y - s * 1.02, s * 0.9, s * 0.82, r > 0.7 ? '#3a8f35' : '#46a03a');
      ell(c, x - s * 0.36, y - s * 1.28, s * 0.46, s * 0.4, '#79c450');
      ell(c, x - s * 0.46, y - s * 1.4, s * 0.18, s * 0.15, 'rgba(220,250,160,.8)');
    },
    M: function (c, x, y, k, r) {
      if (r >= 0.85) { // rochers
        var b = (1.4 + r) * k; ell(c, x + 0.5 * k, y + 0.2 * k, b * 1.2, b * 0.4, 'rgba(40,35,30,.3)');
        ell(c, x, y - b * 0.5, b, b * 0.7, '#7d766b'); ell(c, x - b * 0.25, y - b * 0.7, b * 0.55, b * 0.4, '#b9b2a4'); return;
      }
      var h = (6 + r * 3.5) * k, w = (3.8 + r * 1.4) * k, j1 = (hash(x, y, 3) - 0.5) * w * 0.5;
      ell(c, x + 1.2 * k, y + 0.4 * k, w * 1.05, 1.3 * k, 'rgba(40,35,30,.28)');
      var tx = x + j1 * 0.3, ty = y - h;
      c.fillStyle = '#6f675c'; c.beginPath(); c.moveTo(x - w, y); c.lineTo(tx, ty); c.lineTo(x + w, y); c.closePath(); c.fill();          // face ombrée
      c.fillStyle = '#b4ab9b'; c.beginPath(); c.moveTo(x - w, y); c.lineTo(tx, ty); c.lineTo(x + w * 0.05 + j1 * 0.2, y); c.closePath(); c.fill(); // face éclairée
      c.strokeStyle = 'rgba(90,82,72,.8)'; c.lineWidth = 0.5 * k; c.beginPath(); c.moveTo(tx, ty); c.lineTo(x + w * 0.05 + j1 * 0.2, y); c.stroke();
      // neige
      var sn = 0.36 + r * 0.12;
      c.fillStyle = '#f7fbff'; c.beginPath(); c.moveTo(tx, ty);
      c.lineTo(tx - w * sn, ty + h * sn); c.lineTo(tx - w * sn * 0.45, ty + h * sn * 0.8); c.lineTo(tx - w * 0.05, ty + h * sn * 1.05); c.lineTo(tx + w * sn * 0.35, ty + h * sn * 0.75); c.lineTo(tx + w * sn, ty + h * sn); c.closePath(); c.fill();
      c.fillStyle = 'rgba(170,190,215,.9)'; c.beginPath(); c.moveTo(tx, ty); c.lineTo(tx + w * sn, ty + h * sn); c.lineTo(tx + w * sn * 0.35, ty + h * sn * 0.75); c.lineTo(tx + w * 0.04, ty + h * sn * 0.9); c.closePath(); c.fill();
      c.strokeStyle = '#3f3a33'; c.lineWidth = 0.75 * k; c.beginPath(); c.moveTo(x - w, y); c.lineTo(tx, ty); c.lineTo(x + w, y); c.stroke();
    },
    Ma: function (c, x, y, k, r) {
      if (r < 0.6) { // mare
        var rx = (2 + r * 3.3) * k, ry = (1 + r * 1.1) * k;
        ell(c, x, y, rx + 0.5 * k, ry + 0.45 * k, 'rgba(44,60,34,.9)');
        var g = c.createLinearGradient(x, y - ry, x, y + ry); g.addColorStop(0, '#3a8c86'); g.addColorStop(1, '#6fc4b6');
        ell(c, x, y, rx, ry, g);
        c.strokeStyle = 'rgba(230,255,250,.7)'; c.lineWidth = 0.45 * k; c.beginPath(); c.ellipse(x - rx * 0.2, y - ry * 0.1, rx * 0.45, ry * 0.3, 0, 3.4, 5.8); c.stroke();
        if (r > 0.3) { ell(c, x + rx * 0.4, y + ry * 0.2, 0.9 * k, 0.5 * k, '#7fbf4f'); ell(c, x + rx * 0.4 + 0.3 * k, y + ry * 0.2 - 0.2 * k, 0.25 * k, 0.2 * k, '#f2a6c8'); }
        return;
      }
      c.lineWidth = 0.55 * k;
      [-1.8, -0.9, 0, 1, 1.9].forEach(function (dx, i) {
        var h = (3 + ((i * 7 + r * 10) % 3)) * k; c.strokeStyle = i % 2 ? '#5f8f3c' : '#35602a';
        c.beginPath(); c.moveTo(x + dx * k, y); c.quadraticCurveTo(x + dx * k, y - h * 0.6, x + dx * k + (i - 2) * 0.35 * k, y - h); c.stroke();
        if (i === 1 || i === 3) ell(c, x + dx * k + (i - 2) * 0.35 * k, y - h, 0.4 * k, 0.95 * k, '#6b4424');
      });
    },
    P: function (c, x, y, k, r) {
      if (r < 0.4) { // bosquet
        ell(c, x + 0.6 * k, y + 0.2 * k, 1.8 * k, 0.6 * k, 'rgba(30,60,15,.3)');
        ell(c, x, y - 1 * k, 1.7 * k, 1.35 * k, '#4a8f2e'); ell(c, x - 0.4 * k, y - 1.35 * k, 0.8 * k, 0.6 * k, '#8acb52');
      } else if (r < 0.52) { // champ de blé
        c.save(); c.translate(x, y); c.rotate((r - 0.46) * 2.5);
        c.fillStyle = '#e0c264'; c.fillRect(-3.6 * k, -2.2 * k, 7.2 * k, 4.4 * k);
        c.strokeStyle = '#c29a36'; c.lineWidth = 0.4 * k; for (var q = -1.6; q <= 1.6; q += 0.8) { c.beginPath(); c.moveTo(-3.6 * k, q * k); c.lineTo(3.6 * k, q * k); c.stroke(); }
        c.strokeStyle = 'rgba(90,70,30,.5)'; c.lineWidth = 0.35 * k; c.strokeRect(-3.6 * k, -2.2 * k, 7.2 * k, 4.4 * k);
        c.restore();
      } else { // fleurs
        var fc = ['#fff27a', '#ffffff', '#ff8a8a', '#c9a0ff'][(r * 40 | 0) % 4];
        ell(c, x, y, 0.35 * k, 0.35 * k, fc); ell(c, x + 1.2 * k, y + 0.5 * k, 0.3 * k, 0.3 * k, fc); ell(c, x - 0.9 * k, y + 0.8 * k, 0.3 * k, 0.3 * k, '#fff27a');
      }
    }
  };

  /* v1.9.24 - proposition « Carte ancienne » : motifs à l'encre sur lavis, façon carte gravée.
     Montagnes en triangles hachurés, forêts en houppiers cerclés d'encre, plaines en touffes et
     sillons, marais en roseaux et traits d'eau. Rien de pixelisé : tout est tracé au trait. */
  var INK = '#3b2a1c';
  var VEC_ANC = {
    M: function (c, x, y, k, r) {
      var h = (6.5 + r * 3.5) * k, w = (4.2 + r * 1.6) * k, tx = x + (hash(x, y, 3) - 0.5) * w * 0.25, ty = y - h;
      c.fillStyle = 'rgba(240,228,200,.9)'; c.beginPath(); c.moveTo(x - w, y); c.lineTo(tx, ty); c.lineTo(x + w, y); c.closePath(); c.fill();
      c.strokeStyle = INK; c.lineWidth = 0.75 * k;
      c.beginPath(); c.moveTo(x - w, y); c.lineTo(tx, ty); c.lineTo(x + w, y); c.stroke();
      c.lineWidth = 0.42 * k; c.strokeStyle = 'rgba(59,42,28,.8)';
      for (var q = 1; q <= 4; q++) { var f = q / 5, ax = tx + (x + w - tx) * f, ay = ty + (y - ty) * f; c.beginPath(); c.moveTo(ax, ay); c.lineTo(ax - w * 0.32 * (1 - f * 0.4), ay + h * 0.12); c.stroke(); }
    },
    F: function (c, x, y, k, r) {
      var s2 = (1.7 + r * 0.7) * k;
      c.strokeStyle = INK; c.lineWidth = 0.45 * k; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - s2 * 0.9); c.stroke();
      c.fillStyle = r > 0.5 ? '#8ea46a' : '#7a945c'; c.beginPath(); c.arc(x, y - s2 * 1.55, s2, 0, 7); c.fill();
      c.lineWidth = 0.6 * k; c.beginPath(); c.arc(x, y - s2 * 1.55, s2, 0, 7); c.stroke();
      c.strokeStyle = 'rgba(59,42,28,.55)'; c.lineWidth = 0.35 * k; c.beginPath(); c.arc(x + s2 * 0.15, y - s2 * 1.5, s2 * 0.62, 0.2, 1.9); c.stroke();
    },
    P: function (c, x, y, k, r) {
      c.strokeStyle = 'rgba(80,62,34,.85)'; c.lineWidth = 0.45 * k;
      if (r < 0.35) {   // sillons d'un champ
        c.save(); c.translate(x, y); c.rotate((r - 0.18) * 2);
        for (var q = -2; q <= 2; q++) { c.beginPath(); c.moveTo(-3 * k, q * 0.9 * k); c.lineTo(3 * k, q * 0.9 * k); c.stroke(); }
        c.restore(); return;
      }
      [-1.2, 0, 1.2].forEach(function (dx, i) { c.beginPath(); c.moveTo(x + dx * k, y); c.lineTo(x + dx * k + (i - 1) * 0.5 * k, y - (1.4 + (i === 1 ? 0.6 : 0)) * k); c.stroke(); });
    },
    Ma: function (c, x, y, k, r) {
      c.strokeStyle = 'rgba(52,74,70,.85)'; c.lineWidth = 0.42 * k;
      for (var q = 0; q < 2; q++) { var yy = y + q * 1.1 * k; c.beginPath(); c.moveTo(x - 2.6 * k, yy); c.quadraticCurveTo(x - 1.3 * k, yy - 0.5 * k, x, yy); c.quadraticCurveTo(x + 1.3 * k, yy + 0.5 * k, x + 2.6 * k, yy); c.stroke(); }
      c.strokeStyle = INK; c.lineWidth = 0.4 * k;
      [-1.4, -0.4, 0.7, 1.6].forEach(function (dx, i) { var h2 = (2 + (i % 2) * 0.9 + r) * k; c.beginPath(); c.moveTo(x + dx * k, y - 0.3 * k); c.lineTo(x + dx * k + (i - 1.5) * 0.25 * k, y - h2); c.stroke(); });
    }
  };
  var ANC_LAND = { P: [230, 216, 160], F: [150, 172, 110], M: [200, 186, 164], Ma: [158, 178, 164] };

  var SEA3 = [[92, 206, 222], [52, 150, 214], [34, 104, 190], [26, 78, 162]];
  function mix3(p, v) { var n = p.length - 1, f = Math.max(0, Math.min(n, v * n)), k = Math.min(n - 1, Math.floor(f)), t = f - k, a = p[k], b = p[k + 1]; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  /* ---------- styles de carte (v1.8) ----------
     Traitement appliqué au calque du terrain seulement, une fois par carte.
     Les couleurs des joueurs sont peintes sur un autre calque (overlay) : elles ne sont pas touchées. */
  var STYLES = ['enluminure', 'ancienne'];
  FOF.MAP_STYLES = [
    { id: 'enluminure', name: 'Enluminure' },
    // v1.9.24 : « Carte ancienne » remplace « Estampe sur bois » (créateur, 09/10/2026)
    { id: 'ancienne', name: 'Carte ancienne' }
  ];
  FOF.mapStyle = function () {
    var v; try { v = localStorage.getItem('fof-mapstyle'); } catch (e) {}
    if (v === 'estampe') v = 'ancienne';                      // ancien choix « Estampe sur bois » : on bascule sur son remplaçant
    return STYLES.indexOf(v) >= 0 ? v : 'enluminure';        // enluminure par défaut
  };
  FOF.setMapStyle = function (s) {
    if (STYLES.indexOf(s) < 0) return;
    try { localStorage.setItem('fof-mapstyle', s); } catch (e) {}
    document.documentElement.setAttribute('data-mapstyle', s);
  };
  // v1.9.24 : la légende des terrains suit le style de carte (couleurs de « Carte ancienne »)
  try { document.documentElement.setAttribute('data-mapstyle', FOF.mapStyle()); } catch (e) {}

  function clamp8(v) { return v < 0 ? 0 : v > 255 ? 255 : v; }
  function lum8(r, g, b) { return 0.299 * r + 0.587 * g + 0.114 * b; }
  function isSea8(r, g, b) { return b > 90 && b > r + 25 && b > g + 10; }
  // le halo cyan des côtes est ce qui date le plus le rendu : on le ramène vers la mer
  function killGlow(a, i) {
    var r = a[i], g = a[i + 1], b = a[i + 2];
    if (b > 165 && g > 150 && r < g - 35) {
      var m = (g + b) / 2;
      a[i] = clamp8(r * 0.5 + 18); a[i + 1] = clamp8(g - (m - 120) * 0.62); a[i + 2] = clamp8(b - (m - 120) * 0.34);
    }
  }
  function vignette(ctx, w, h, col) {
    var g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, col);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }

  // couleur exacte écrite par le rendu de base pour la limite entre deux zones de mer
  function isSeaBorder(r, g, b) { return Math.abs(r - 170) < 9 && Math.abs(g - 214) < 9 && Math.abs(b - 245) < 9; }
  function styleBase(canvas, style) {
    var w = canvas.width, h = canvas.height;
    if (!w || !h) return;
    var ctx = canvas.getContext('2d'), d;
    try { d = ctx.getImageData(0, 0, w, h); } catch (e) { return; }   // canvas « teinté » : on laisse tel quel
    var a = d.data, i, r, g, b, L;
    /* v1.9.24 - proposition « Carte ancienne » : couleurs adoucies, terres tirées vers le parchemin
       (chaque terrain garde sa teinte, moins criarde), mer gris-bleu passé, grain de papier, bords
       assombris comme un vieux document, filet sépia. Le style par défaut ne change pas. */
    if (style === 'ancienne') {
      // la base est déjà peinte au lavis (drawBase) : on n'ajoute que le vieillissement et le cadre
      vignette(ctx, w, h, 'rgba(92,62,30,.42)');
      ctx.strokeStyle = '#4a3420'; ctx.lineWidth = Math.max(4, Math.round(Math.min(w, h) * 0.006));
      ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
      ctx.strokeStyle = 'rgba(74,52,32,.6)'; ctx.lineWidth = Math.max(1, ctx.lineWidth / 3);
      var ins = Math.max(8, Math.round(Math.min(w, h) * 0.014));
      ctx.strokeRect(ins, ins, w - 2 * ins, h - 2 * ins);
      return;
    }
    // enluminure : mer de lapis, terres en pierres précieuses, filet d'or
    for (i = 0; i < a.length; i += 4) {
      if (!a[i + 3]) continue;
      r = a[i]; g = a[i + 1]; b = a[i + 2]; L = lum8(r, g, b) / 255;
      if (isSeaBorder(r, g, b)) { a[i] = 196; a[i + 1] = 226; a[i + 2] = 248; continue; }   // pointillé de zone
      if (isSea8(r, g, b)) {
        a[i] = clamp8(22 + L * 46); a[i + 1] = clamp8(46 + L * 62); a[i + 2] = clamp8(118 + L * 92);
      } else {
        var Lm = lum8(r, g, b), s = 1.3;
        a[i] = clamp8((Lm + (r - Lm) * s) * 0.94 + 16);
        a[i + 1] = clamp8((Lm + (g - Lm) * s) * 0.9 + 10);
        a[i + 2] = clamp8((Lm + (b - Lm) * s) * 0.82);
      }
    }
    ctx.putImageData(d, 0, 0);
    vignette(ctx, w, h, 'rgba(12,8,24,.58)');
    var gg = ctx.createLinearGradient(0, 0, 0, h);
    gg.addColorStop(0, '#f6e27a'); gg.addColorStop(0.5, '#d4af37'); gg.addColorStop(1, '#9a7b1f');
    ctx.strokeStyle = gg;
    ctx.lineWidth = Math.max(6, Math.round(Math.min(w, h) * 0.008));
    ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
    ctx.lineWidth = 2;
    var inset = Math.max(14, Math.round(Math.min(w, h) * 0.016));
    ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
  }

  /* v1.9.7 - les frontières de mer sont de vraies lignes, tracées après la trame.
     La carte est ondulée par un bruit : un point de l'écran est déplacé avant d'être
     rattaché à une case. Pour que le trait tombe exactement sur la frontière peinte, on
     applique donc la déformation À L'ENVERS à chacun de ses points. */
  function deform(x, y, seed) {
    return {
      x: x + R * 0.42 * vnoise(x / 38, y / 38, seed) + R * 0.16 * vnoise(x / 11, y / 11, seed + 7) + R * 0.05 * vnoise(x / 3.5, y / 3.5, seed + 11),
      y: y + R * 0.42 * vnoise(x / 38 + 50, y / 38, seed + 3) + R * 0.16 * vnoise(x / 11, y / 11 + 90, seed + 9) + R * 0.05 * vnoise(x / 3.5 + 20, y / 3.5, seed + 13)
    };
  }
  function deformInv(tx, ty, seed) {
    var x = tx, y = ty;
    for (var k = 0; k < 6; k++) { var d = deform(x, y, seed); x += (tx - d.x) * 0.7; y += (ty - d.y) * 0.7; }
    return { x: x, y: y };
  }
  function tracerMers(ctx, st, rs) {
    var m = st.map;
    if (rs.seaSegs) return tracerSegments(ctx, rs);
    if (!m.seaRays || !m.seaRays.length) return;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.setLineDash([7 * rs.S, 4.6 * rs.S]);
    ctx.lineWidth = 1.6 * rs.S;
    ctx.strokeStyle = 'rgba(246,252,255,.96)';
    ctx.shadowColor = 'rgba(8,24,50,.75)'; ctx.shadowBlur = 2 * rs.S;
    if (FOF.mapStyle && FOF.mapStyle() === 'ancienne') { ctx.strokeStyle = 'rgba(59,42,28,.82)'; ctx.shadowBlur = 0; }
    m.seaRays.forEach(function (ray) {
      ctx.beginPath();
      var premier = true;
      for (var s = 0; s < ray.pts.length - 1; s++) {
        var a = ray.pts[s], b = ray.pts[s + 1], n = 6;
        for (var k = (s === 0 ? 0 : 1); k <= n; k++) {
          var qx = a.x + (b.x - a.x) * k / n, qy = a.y + (b.y - a.y) * k / n;
          var p = rs.hist ? { x: qx, y: qy } : deformInv(qx, qy, rs.seed);   // carte historique : pas d'ondulation
          var px = (p.x - rs.minX) * rs.S, py = (p.y - rs.minY) * rs.S;
          if (premier) { ctx.moveTo(px, py); premier = false; } else ctx.lineTo(px, py);
        }
      }
      ctx.stroke();
    });
    ctx.restore();
  }

  // v1.9.20 - frontières lissées (pixels de trame), tracées seulement sur la mer
  function tracerSegments(ctx, rs) {
    var cv = document.createElement('canvas'); cv.width = rs.gw; cv.height = rs.gh;
    var c = cv.getContext('2d');
    // lisibilité : trait un peu plus épais que l'ancien (1,6), ombre plus marquée pour détacher le trait de l'eau
    c.lineCap = 'round'; c.lineJoin = 'round'; c.setLineDash([8 * rs.S, 4.4 * rs.S]); c.lineWidth = 2 * rs.S;
    c.strokeStyle = 'rgba(248,252,255,.97)'; c.shadowColor = 'rgba(6,18,40,.9)'; c.shadowBlur = 2.6 * rs.S;
    if (FOF.mapStyle && FOF.mapStyle() === 'ancienne') { c.strokeStyle = 'rgba(59,42,28,.82)'; c.shadowBlur = 0; c.lineWidth = 1.5 * rs.S; c.setLineDash([6 * rs.S, 4 * rs.S]); }
    rs.seaSegs.forEach(function (g) { c.beginPath(); c.moveTo(g[0][0], g[0][1]); for (var k = 1; k < g.length; k++) c.lineTo(g[k][0], g[k][1]); c.stroke(); });
    // masque : on efface ce qui tomberait sur la terre ou hors des zones de mer
    var mk = c.getImageData(0, 0, rs.gw, rs.gh), d = mk.data;
    for (var i = 0, n = rs.gw * rs.gh; i < n; i++) if (rs.kind[i] !== 2) d[i * 4 + 3] = 0;
    c.putImageData(mk, 0, 0);
    ctx.drawImage(cv, 0, 0);
  }
  function drawBase(st, rs, canvas) {
    var gw = rs.gw, gh = rs.gh, N = gw * gh, S = rs.S, m = st.map;
    canvas.width = gw; canvas.height = gh;
    var kind = rs.kind, id = rs.id, dist = rs.dist, shore = rs.shore, coastD = rs.coastD;
    var biomeOf = m.terr.map(function (t) { return t.biome; });
    var ANC = FOF.mapStyle && FOF.mapStyle() === 'ancienne';   // v1.9.24 : proposition « Carte ancienne »
    var P = 1, lw = Math.ceil(gw / P), lh = Math.ceil(gh / P), u = S / P; // u = pixels bas-déf par unité
    var low = document.createElement('canvas'); low.width = lw; low.height = lh;
    var lc = low.getContext('2d'), img = lc.createImageData(lw, lh), d = img.data;
    function at(lx, ly) { var x = Math.min(gw - 1, lx * P + (P >> 1)), y = Math.min(gh - 1, ly * P + (P >> 1)); return y * gw + x; }
    // relief fictif (ombrage)
    var hg = new Float32Array(lw * lh), LK = new Int8Array(lw * lh), LI = new Int16Array(lw * lh);
    for (var ly = 0; ly < lh; ly++) for (var lx = 0; lx < lw; lx++) {
      var i = at(lx, ly), j = ly * lw + lx; LK[j] = kind[i]; LI[j] = id[i];
      if (kind[i] === 1) hg[j] = Math.min(1, coastD[i] / (10 * S)) * 3 + Math.min(1, dist[i] / (5 * S)) * 1.2 + vnoise(lx / (7 * u), ly / (7 * u), 17) * (biomeOf[id[i]] === 'M' ? 2.2 : 0.9);
    }
    var shx = Math.round(1.6 * u), shy = Math.round(2.4 * u);
    for (ly = 0; ly < lh; ly++) for (lx = 0; lx < lw; lx++) {
      j = ly * lw + lx; i = at(lx, ly);
      var k = LK[j], col;
      if (ANC) {
        // lavis : teinte plate par terrain, très légère variation, côte et frontières à l'encre
        var gr = vnoise(lx / (9 * u), ly / (9 * u), 31) * 10 + (hash(lx, ly, 7) - 0.5) * 7;
        if (k === 1) {
          var bmA = biomeOf[LI[j]], base = ANC_LAND[bmA], cdA = coastD[i] / S, diA = dist[i] / S;
          col = [base[0] + gr, base[1] + gr, base[2] + gr * 0.8];
          if (cdA < 0.8) col = [59, 42, 28];
          else if (cdA < 2.2) col = [col[0] * 0.9, col[1] * 0.88, col[2] * 0.84];
          else if (diA < 0.42) col = [92, 70, 48];
        } else {
          var sA = shore[i] / S, dpA = Math.min(1, Math.max(0, (sA - 1) / 16));
          col = [184 - dpA * 52 + gr * 0.6, 204 - dpA * 44 + gr * 0.6, 196 - dpA * 30 + gr * 0.5];
          // lignes d'eau parallèles à la côte, comme sur une gravure
          if (sA > 1.4 && sA < 9 && Math.abs(((sA - 1.4) % 2.6) - 1.3) < 0.22) col = [col[0] * 0.8, col[1] * 0.83, col[2] * 0.86];
        }
        var oA = j * 4; d[oA] = clamp8(col[0]); d[oA + 1] = clamp8(col[1]); d[oA + 2] = clamp8(col[2]); d[oA + 3] = 255;
        continue;
      }
      if (k === 1) {
        var bm = biomeOf[LI[j]], cd = coastD[i] / S, di = dist[i] / S;
        var sl = (lx > 0 && ly > 0) ? (hg[j - 1] - hg[j] + hg[j - lw] - hg[j]) : 0;
        var v = 0.55 + sl * 0.9 + vnoise(lx / (6 * u), ly / (6 * u), 31) * 0.3;
        if (bm === 'Ma') v = 0.45 + sl * 0.6 + vnoise(lx / (5 * u), ly / (5 * u), 51) * 0.3;
        col = tone(PX[bm], Math.max(0, Math.min(1, v)), lx, ly);
        var cliffy = vnoise(lx / (6 * u), ly / (6 * u), 61) > 0.15;
        if (cd < 0.9) col = [58, 46, 34];                                            // trait de côte
        else if (cd < 2.3) col = cliffy && bm !== 'Ma' ? tone(PX.cliff, 1 - (cd - 0.9) / 1.4 + sl, lx, ly) : tone(PX.sand, (cd - 0.9) / 1.4 + 0.2, lx, ly);
        else if (di < 0.55) col = [col[0] * 0.38 + 26, col[1] * 0.38 + 22, col[2] * 0.38 + 14];   // frontière
        else if (di < 1.2) col = [Math.min(255, col[0] + 16), Math.min(255, col[1] + 16), Math.min(255, col[2] + 12)]; // liseré clair
      } else {
        // mer : dégradé net selon la distance à la côte (hauts-fonds → large), très légère variation d'ensemble
        var s0 = shore[i] / S, depth = Math.min(1, Math.max(0, (s0 - 1.2) / 11)); depth = depth * depth * (3 - 2 * depth);
        var big = vnoise(lx / (40 * u), ly / (40 * u), 43) * 6;
        col = mix3(SEA3, depth);
        col = [col[0] + big, col[1] + big, col[2] + big * 0.6];
        if (s0 >= 2.6 && s0 < 3.1) col = [col[0] + 18, col[1] + 22, col[2] + 18];   // liseré des hauts-fonds
        if (s0 < 1.1) col = [236, 250, 252];                                          // écume
        else if (s0 < 1.7) col = [150, 222, 236];
        if (s0 >= 1.1) { var sx = lx - shx, sy = ly - shy; if (sx >= 0 && sy >= 0 && LK[sy * lw + sx] === 1) col = [col[0] * 0.78, col[1] * 0.8, col[2] * 0.86]; }
        // v1.9.7 : le trait pointillé des zones de mer n'est plus peint ici, pixel par pixel.
        //          Il est tracé après coup, comme une vraie ligne, depuis le point où une
        //          frontière de territoire atteint la côte (voir tracerMers).
        if (k === 0) col = [col[0] * 0.88, col[1] * 0.9, col[2] * 0.94];
      }
      var o = j * 4; d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
    }
    function put(x, y, c) { if (x < 0 || y < 0 || x >= lw || y >= lh) return; var o = (y * lw + x) * 4; if (c === 'S') { d[o] *= 0.62; d[o + 1] *= 0.66; d[o + 2] *= 0.7; return; } d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; }
    function stamp(name, x, y) { var s = SPR[name], mm = s.m, x0 = x - (mm[0].length >> 1), y0 = y - mm.length + 1; for (var r = 0; r < mm.length; r++) for (var q = 0; q < mm[r].length; q++) { var ch = mm[r][q]; if (ch !== '.') put(x0 + q, y0 + r, s.c[ch]); } }
    function okLand(x, y, tid, margin) {
      if (x < 0 || y < 0 || x >= lw || y >= lh) return false; var jj = y * lw + x, ii = at(x, y);
      return LK[jj] === 1 && LI[jj] === tid && coastD[ii] > 2.6 * S && dist[ii] > margin * S;
    }
    function peak(cx, cy, h, w, r) {
      for (var yy = 0; yy <= h; yy++) {
        var half = Math.round(w * yy / h);
        for (var xx = -half; xx <= half; xx++) {
          var edge = Math.abs(xx) === half || yy === h, rel = yy / h, rough = hash(cx + xx, cy + yy, 83);
          var c = edge ? [70, 64, 58] : xx < -half * 0.15 + (rough - 0.5) * 2 ? [206, 200, 188] : xx < half * 0.4 ? [160, 153, 140] : [118, 111, 101];
          if (!edge && rel < 0.38 + (rough - 0.5) * 0.18) c = xx < 1 ? [250, 252, 255] : [214, 226, 238];
          put(cx + xx, cy - h + yy, c);
        }
      }
      for (var z = -w + 1; z < w; z++) put(cx + z + 1, cy + 1, 'S');
    }
    function pool(cx, cy, rx, ry) {
      for (var yy = -ry; yy <= ry; yy++) for (var xx = -rx; xx <= rx; xx++) {
        var e = (xx * xx) / (rx * rx) + (yy * yy) / (ry * ry); if (e > 1) continue;
        var c = e > 0.62 ? (yy < 0 ? [138, 196, 170] : [38, 78, 66]) : (xx + yy < -rx * 0.4 && e < 0.3 ? [118, 204, 196] : [58, 132, 128]);
        put(cx + xx, cy + yy, c);
      }
      if (hash(cx, cy, 91) > 0.5) { put(cx + 1, cy, [104, 170, 74]); put(cx + 2, cy, [104, 170, 74]); }
    }
    // décor par territoire (en pixels bas-déf), trié de haut en bas
    var deco = [];
    m.terr.forEach(function (t) {
      var bx = rs.box['t' + t.id], a = rs.anchor['t' + t.id]; if (!bx || !a) return;
      var ax = (a.x - rs.minX) * u, ay = (a.y - rs.minY) * u;
      var x0 = Math.floor(bx.x0 / P), x1 = Math.ceil(bx.x1 / P), y0 = Math.floor(bx.y0 / P), y1 = Math.ceil(bx.y1 / P);
      // grille régulière décalée, faible jitter : motifs espacés et répartis sur toute la case
      var step = { F: 5.2, M: 9, P: 6.2, Ma: 7 }[t.biome] * u * (ANC ? { F: 1.15, M: 1.05, P: 1.55, Ma: 1.35 }[t.biome] : 1), row = 0, n = 0;
      for (var yy = y0 + step * 0.3; yy <= y1; yy += step * 0.82, row++) for (var xx = x0 + ((row & 1) ? step / 2 : 0); xx <= x1; xx += step) {
        n++;
        var px = Math.round(xx + (hash(n, t.id, 21) - 0.5) * step * 0.3), py = Math.round(yy + (hash(n, t.id, 22) - 0.5) * step * 0.3), r = hash(n, t.id, 23);
        if (Math.abs(px - ax) < 6 * u && py - ay > -8 * u && py - ay < 11 * u) continue;   // place pour le drapeau, les aménagements et les pions
        if (okLand(px, py, t.id, t.biome === 'M' ? 1.2 : 0.9)) deco.push([py, t.biome, px, r, t.id]);
      }
    });
    deco.sort(function (p, q) { return p[0] - q[0]; });
    lc.putImageData(img, 0, 0);
    var ctx = canvas.getContext('2d'); ctx.drawImage(low, 0, 0);
    // chaque territoire est dessiné sur un calque découpé à sa forme : aucun motif ne déborde sur une case voisine
    var byT = {}; deco.forEach(function (e) { (byT[e[4]] = byT[e[4]] || []).push(e); });
    Object.keys(byT).forEach(function (tid) {
      var bx = rs.box['t' + tid]; if (!bx) return;
      var w = bx.x1 - bx.x0 + 1, h = bx.y1 - bx.y0 + 1, lay = document.createElement('canvas'); lay.width = w; lay.height = h;
      var c = lay.getContext('2d'); c.lineCap = 'round'; c.lineJoin = 'round'; c.translate(-bx.x0, -bx.y0);
      byT[tid].forEach(function (e) { (ANC ? VEC_ANC : VEC)[e[1]](c, e[2], e[0], S, e[3]); });
      c.setTransform(1, 0, 0, 1, 0, 0);
      var mk = c.createImageData(w, h), md = mk.data, v = +tid, inB = 0.8 * S, inC = 1.6 * S;
      for (var yy = 0; yy < h; yy++) for (var xx = 0; xx < w; xx++) {
        var ii = (bx.y0 + yy) * gw + bx.x0 + xx;
        if (kind[ii] === 1 && id[ii] === v && dist[ii] >= inB && coastD[ii] >= inC) md[(yy * w + xx) * 4 + 3] = 255;
      }
      var mc = document.createElement('canvas'); mc.width = w; mc.height = h; mc.getContext('2d').putImageData(mk, 0, 0);
      c.globalCompositeOperation = 'destination-in'; c.drawImage(mc, 0, 0);
      ctx.drawImage(lay, bx.x0, bx.y0);
    });
    if (ANC) { tracerMers(ctx, st, rs); return; }   // pas de vagues ni de voile bleu : le style ancien finit ici
    // petites vagues dessinées au large, espacées régulièrement
    ctx.strokeStyle = 'rgba(210,235,255,.33)'; ctx.lineWidth = 0.45 * S; ctx.lineCap = 'round';
    var wsx = 22 * S, wsy = 13 * S, wr = 0;
    for (var wy = wsy / 2; wy < gh; wy += wsy, wr++) for (var wx = (wr & 1 ? wsx / 2 : 0) + wsx / 3; wx < gw; wx += wsx) {
      var jx2 = wx + (hash(wx | 0, wy | 0, 5) - 0.5) * wsx * 0.5, jy2 = wy + (hash(wx | 0, wy | 0, 6) - 0.5) * wsy * 0.5;
      var qi = (Math.min(gh - 1, jy2 | 0)) * gw + Math.min(gw - 1, jx2 | 0);
      if (kind[qi] === 1 || shore[qi] < 6 * S) continue;
      var ww = 2.4 * S;
      ctx.beginPath(); ctx.moveTo(jx2 - ww, jy2); ctx.quadraticCurveTo(jx2 - ww / 2, jy2 - ww * 0.45, jx2, jy2); ctx.quadraticCurveTo(jx2 + ww / 2, jy2 - ww * 0.45, jx2 + ww, jy2); ctx.stroke();
    }
    var vg = ctx.createRadialGradient(gw / 2, gh / 2, Math.min(gw, gh) * 0.5, gw / 2, gh / 2, Math.max(gw, gh) * 0.78);
    vg.addColorStop(0, 'rgba(8,20,50,0)'); vg.addColorStop(1, 'rgba(8,20,50,.28)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, gw, gh);
    tracerMers(ctx, st, rs);            // en dernier : les frontières de mer ne sont pas assombries
  }

  // dessins vectoriels des terrains (x, y = pied du motif, en pixels ; k = pixels par unité)
  var DRAW = {
    M: function (c, x, y, k, r) {
      var h = (6 + r * 3.5) * k, w = (5 + r * 2) * k;
      c.fillStyle = 'rgba(60,45,35,.18)'; c.beginPath(); c.ellipse(x + 1.5 * k, y + 0.5 * k, w * 0.9, 1.6 * k, 0, 0, 7); c.fill();
      c.fillStyle = '#7d6c5c'; c.beginPath(); c.moveTo(x - w, y); c.lineTo(x, y - h); c.lineTo(x + w, y); c.closePath(); c.fill();
      c.fillStyle = '#c2b09a'; c.beginPath(); c.moveTo(x - w, y); c.lineTo(x, y - h); c.lineTo(x - w * 0.12, y); c.closePath(); c.fill();
      c.fillStyle = '#f4f1ea'; c.beginPath(); c.moveTo(x - w * 0.3, y - h * 0.7); c.lineTo(x, y - h); c.lineTo(x + w * 0.3, y - h * 0.7); c.lineTo(x + w * 0.1, y - h * 0.62); c.lineTo(x - w * 0.05, y - h * 0.72); c.closePath(); c.fill();
      c.strokeStyle = '#4a3c30'; c.lineWidth = 0.9 * k; c.beginPath(); c.moveTo(x - w, y); c.lineTo(x, y - h); c.lineTo(x + w, y); c.stroke();
    },
    F: function (c, x, y, k, r) {
      var s = (2.5 + r * 1.3) * k;
      c.fillStyle = 'rgba(20,45,15,.28)'; c.beginPath(); c.ellipse(x + 1.2 * k, y + 0.6 * k, s * 0.95, 1.3 * k, 0, 0, 7); c.fill();
      if (r < 0.35) { // sapin
        c.fillStyle = '#5a3d22'; c.fillRect(x - 0.5 * k, y - 1.6 * k, 1 * k, 1.6 * k);
        [[0, 1.1], [1.6, 0.85], [3.0, 0.6]].forEach(function (L) {
          var yy = y - 1.2 * k - L[0] * k, w = s * L[1] * 1.15;
          c.fillStyle = '#1f5e2c'; c.beginPath(); c.moveTo(x - w, yy); c.lineTo(x, yy - s * 1.1); c.lineTo(x + w, yy); c.closePath(); c.fill();
          c.fillStyle = '#2f7c3a'; c.beginPath(); c.moveTo(x - w, yy); c.lineTo(x, yy - s * 1.1); c.lineTo(x - w * 0.1, yy); c.closePath(); c.fill();
        });
        return;
      }
      c.strokeStyle = '#5a3d22'; c.lineWidth = 1.1 * k; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - s * 0.9); c.stroke();
      c.fillStyle = r > 0.7 ? '#2f7a2c' : '#3b8c34'; c.beginPath(); c.arc(x, y - s * 1.35, s, 0, 7); c.fill();
      c.fillStyle = '#58a844'; c.beginPath(); c.arc(x - s * 0.25, y - s * 1.55, s * 0.62, 0, 7); c.fill();
      c.fillStyle = 'rgba(210,240,150,.55)'; c.beginPath(); c.arc(x - s * 0.42, y - s * 1.75, s * 0.3, 0, 7); c.fill();
      c.strokeStyle = '#1d4a1a'; c.lineWidth = 0.6 * k; c.beginPath(); c.arc(x, y - s * 1.35, s, 0, 7); c.stroke();
    },
    P: function (c, x, y, k, r) {
      c.strokeStyle = r > 0.5 ? '#b8932f' : '#a58326'; c.lineWidth = 0.9 * k;
      for (var i = -1; i <= 1; i++) {
        var bx = x + i * 1.8 * k, h = (5 + (i === 0 ? 1.8 : 0) + r) * k;
        c.beginPath(); c.moveTo(bx, y); c.quadraticCurveTo(bx + i * 0.8 * k, y - h * 0.6, bx + i * 1.4 * k, y - h); c.stroke();
        c.fillStyle = '#d7b54a'; c.beginPath(); c.ellipse(bx + i * 1.4 * k, y - h, 0.8 * k, 1.7 * k, i * 0.3, 0, 7); c.fill();
      }
    },
    Ma: function (c, x, y, k, r) {
      c.fillStyle = 'rgba(70,130,140,.55)'; c.beginPath(); c.ellipse(x, y, (4 + r * 2.5) * k, (1.4 + r * 0.6) * k, 0, 0, 7); c.fill();
      c.strokeStyle = 'rgba(220,245,245,.55)'; c.lineWidth = 0.6 * k; c.beginPath(); c.ellipse(x - 0.8 * k, y - 0.3 * k, 2 * k, 0.5 * k, 0, 3.4, 6); c.stroke();
      c.strokeStyle = '#3e6b3a'; c.lineWidth = 0.9 * k;
      [-3.2, -2.2, 3, 3.8].forEach(function (dx, i) {
        var h = (4 + ((i + r * 4) % 3)) * k; c.beginPath(); c.moveTo(x + dx * k, y); c.lineTo(x + dx * k + (i % 2 ? 0.8 : -0.8) * k, y - h); c.stroke();
        if (i === 1) { c.fillStyle = '#6b4a2a'; c.beginPath(); c.ellipse(x + dx * k - 0.8 * k, y - h, 0.7 * k, 1.6 * k, 0, 0, 7); c.fill(); }
      });
    }
  };

  // masques par région : « fill » (toute la région) et « band » (bordure intérieure)
  function mask(rs, loc, type) {
    var k = loc + ':' + type; if (rs.masks[k]) return rs.masks[k];
    var b = rs.box[loc]; if (!b) return null;
    var w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1, c = document.createElement('canvas'); c.width = w; c.height = h;
    var cx = c.getContext('2d'), im = cx.createImageData(w, h), dd = im.data;
    var kk = loc[0] === 't' ? 1 : 2, v = +loc.slice(1), band = 3.2 * rs.S;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var i = (b.y0 + y) * rs.gw + b.x0 + x; if (rs.kind[i] !== kk || rs.id[i] !== v) continue;
      var a = type === 'fill' ? 255 : (rs.dist[i] <= band ? 255 : 0);
      dd[(y * w + x) * 4 + 3] = a;
    }
    cx.putImageData(im, 0, 0);
    return (rs.masks[k] = { c: c, x: b.x0, y: b.y0 });
  }
  function tinted(rs, loc, type, color) {
    var k = loc + ':' + type + ':' + color; if (rs.tint[k]) return rs.tint[k];
    var mk = mask(rs, loc, type); if (!mk) return null;
    var c = document.createElement('canvas'); c.width = mk.c.width; c.height = mk.c.height;
    var cx = c.getContext('2d'); cx.drawImage(mk.c, 0, 0); cx.globalCompositeOperation = 'source-in'; cx.fillStyle = color; cx.fillRect(0, 0, c.width, c.height);
    return (rs.tint[k] = { c: c, x: mk.x, y: mk.y });
  }
  // v1.9.6 - liseré rayé des capitales : alternance couleur du joueur / blanc, en diagonale,
  // comme un ruban de chantier. Motif de 16 px qui se répète sans couture.
  var rayCache = {};
  function rayures(cx, col) {
    if (rayCache[col]) return cx.createPattern(rayCache[col], 'repeat');
    var s2 = 16, tuile = document.createElement('canvas'); tuile.width = tuile.height = s2;
    var t2 = tuile.getContext('2d');
    t2.fillStyle = '#ffffff'; t2.fillRect(0, 0, s2, s2);
    t2.fillStyle = col;
    t2.beginPath(); t2.moveTo(0, 0); t2.lineTo(s2 / 2, 0); t2.lineTo(0, s2 / 2); t2.closePath(); t2.fill();
    t2.beginPath(); t2.moveTo(s2, 0); t2.lineTo(s2, s2 / 2); t2.lineTo(s2 / 2, s2); t2.lineTo(0, s2); t2.closePath(); t2.fill();
    rayCache[col] = tuile;
    return cx.createPattern(tuile, 'repeat');
  }
  function tintedRay(rs, loc, type, color) {
    var k = loc + ':' + type + ':ray:' + color; if (rs.tint[k]) return rs.tint[k];
    var mk = mask(rs, loc, type); if (!mk) return null;
    var c = document.createElement('canvas'); c.width = mk.c.width; c.height = mk.c.height;
    var cx = c.getContext('2d'); cx.drawImage(mk.c, 0, 0);
    cx.globalCompositeOperation = 'source-in';
    // le motif est décalé pour suivre la position réelle du masque sur la carte : deux capitales
    // voisines n'affichent donc pas des rayures alignées par hasard.
    cx.translate(-mk.x % 16, -mk.y % 16);
    cx.fillStyle = rayures(cx, color);
    cx.fillRect(0, 0, c.width + 32, c.height + 32);
    return (rs.tint[k] = { c: c, x: mk.x, y: mk.y });
  }
  function paintRay(ctx, rs, loc, type, color, alpha) {
    var t = tintedRay(rs, loc, type, color); if (!t) return;
    ctx.globalAlpha = alpha; ctx.drawImage(t.c, t.x, t.y); ctx.globalAlpha = 1;
  }
  function paint(ctx, rs, loc, type, color, alpha) {
    var t = tinted(rs, loc, type, color); if (!t) return;
    ctx.globalAlpha = alpha; ctx.drawImage(t.c, t.x, t.y); ctx.globalAlpha = 1;
  }

  /* ---------- vie de la carte : vagues, renard, oiseaux, voilier ---------- */
  var amb = { cv: null, raf: 0, t0: 0, waves: [], fox: null, birds: null, boats: [], key: null, forest: [], seaPts: [] };
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function ambSetup(st) {
    var rs = cache; amb.key = rs.key; amb.forest = []; amb.seaPts = [];
    // points d'eau profonde et intérieurs de forêts (en unités)
    for (var k = 0; k < 4000; k++) {
      var gx = (Math.random() * rs.gw) | 0, gy = (Math.random() * rs.gh) | 0, i = gy * rs.gw + gx, ux = rs.minX + gx / rs.S, uy = rs.minY + gy / rs.S;
      if (rs.kind[i] !== 1 && rs.shore[i] > 4 * rs.S) amb.seaPts.push({ x: ux, y: uy, near: rs.shore[i] < 12 * rs.S });
      else if (rs.kind[i] === 1 && st.map.terr[rs.id[i]].biome === 'F' && rs.dist[i] > 4 * rs.S) amb.forest.push({ x: ux, y: uy, t: rs.id[i] });
    }
    // prairies et marécages, pour les papillons et les lucioles
    amb.plain = []; amb.marsh = [];
    for (var k2 = 0; k2 < 3000; k2++) {
      var gx2 = (Math.random() * rs.gw) | 0, gy2 = (Math.random() * rs.gh) | 0, i2 = gy2 * rs.gw + gx2;
      if (rs.kind[i2] !== 1 || rs.dist[i2] < 3 * rs.S) continue;
      var bm = st.map.terr[rs.id[i2]].biome, pt = { x: rs.minX + gx2 / rs.S, y: rs.minY + gy2 / rs.S };
      if (bm === 'P') amb.plain.push(pt); else if (bm === 'Ma') amb.marsh.push(pt);
    }
    amb.waves = []; for (var w = 0; w < 70 && amb.seaPts.length; w++) amb.waves.push(newWave(true));
    amb.boats = [];
    var near = amb.seaPts.filter(function (p) { return p.near; });
    for (var b2 = 0; b2 < 4 && near.length; b2++) { var p0 = near[(Math.random() * near.length) | 0]; amb.boats.push({ x: p0.x, y: p0.y, a: rnd(0, 6.28), sp: rnd(1.2, 2.2) }); }
    // papillons (prairies) et lucioles (marécages), présents en permanence
    amb.flies = [];
    for (var f2 = 0; f2 < 10 && amb.plain.length; f2++) { var pp = amb.plain[(Math.random() * amb.plain.length) | 0]; amb.flies.push({ kind: 'b', x: pp.x, y: pp.y, x0: pp.x, y0: pp.y, t: rnd(0, 6), sp: rnd(0.7, 1.4) }); }
    for (var g2 = 0; g2 < 14 && amb.marsh.length; g2++) { var mp = amb.marsh[(Math.random() * amb.marsh.length) | 0]; amb.flies.push({ kind: 'l', x: mp.x, y: mp.y, x0: mp.x, y0: mp.y, t: rnd(0, 6), sp: rnd(0.4, 0.9) }); }
    amb.fish = []; amb.nextFish = 2;
    amb.fox = null; amb.birds = null; amb.nextFox = 3; amb.nextBirds = 4;
  }
  function inTerr(ux, uy, tid) {
    var rs = cache; if (!rs) return false;
    var gx = Math.floor((ux - rs.minX) * rs.S), gy = Math.floor((uy - rs.minY) * rs.S);
    if (gx < 0 || gy < 0 || gx >= rs.gw || gy >= rs.gh) return false;
    var i = gy * rs.gw + gx;
    return rs.kind[i] === 1 && rs.id[i] === tid;
  }
  // v1.9.2 - « mieux montrer les capitales » : on souligne le contour entier de la case en or.
  // Le tracé est construit une fois par carte et par taille de canevas, puis simplement rempli.
  var outCache = { key: null, v: {} };
  function capOutlinePath(tid) {
    var rs = cache; if (!rs || !amb.cv) return null;
    var kk = rs.key + ':' + amb.cv.width;
    if (outCache.key !== kk) outCache = { key: kk, v: {} };
    if (outCache.v[tid] !== undefined) return outCache.v[tid];
    var pth = new Path2D(), n = 0, gw = rs.gw, gh = rs.gh;
    for (var gy = 1; gy < gh - 1; gy++) {
      for (var gx = 1; gx < gw - 1; gx++) {
        var i = gy * gw + gx;
        if (rs.kind[i] !== 1 || rs.id[i] !== tid) continue;
        // on trace un liseré À L'INTÉRIEUR de la case : sur le bord exact, le calque des couleurs
        // de joueur (en « multiply ») mangerait l'or.
        var e = Math.max(2, Math.round(rs.S * 1.6));
        function hors(k) { return k < 0 || k >= rs.kind.length || rs.kind[k] !== 1 || rs.id[k] !== tid; }
        var surBord = hors(i - 1) || hors(i + 1) || hors(i - gw) || hors(i + gw);
        var pres = hors(i - e) || hors(i + e) || hors(i - gw * e) || hors(i + gw * e);
        if (surBord || !pres) continue;
        var x = gx * 0.5, y = gy * 0.5;
        pth.moveTo(x + 1.3, y); pth.arc(x, y, 1.3, 0, 7); n++;
      }
    }
    return (outCache.v[tid] = n ? pth : null);
  }
  // rayon du plus grand anneau qui tient sur la case de la capitale (ou null)
  var ringCache = { key: null, v: {} };
  function capRing(tid, an) {
    var rs = cache; if (!rs) return null;
    if (ringCache.key !== rs.key) ringCache = { key: rs.key, v: {} };
    if (ringCache.v[tid] !== undefined) return ringCache.v[tid];
    var res = null;
    var RS = [21, 18, 15.5, 13];
    for (var si = 0; si < RS.length && !res; si++) {
      var r = RS[si], ok = true;
      for (var q = 0; q < 16 && ok; q++) {
        var ang = q / 16 * Math.PI * 2;
        if (!inTerr(an.x + Math.cos(ang) * r, an.y + Math.sin(ang) * r, tid)) ok = false;
      }
      if (ok) res = r;
    }
    return (ringCache.v[tid] = res);
  }
  function capHex(cid) { var c = (FOF.PLAYER_COLORS || []).filter(function (x) { return x.id === cid; })[0]; return c ? c.hex : '#b33'; }
  function newWave(anyAge) { var p = amb.seaPts[(Math.random() * amb.seaPts.length) | 0]; return { x: p.x, y: p.y, age: anyAge ? rnd(0, 4) : 0, life: rnd(3, 5), s: rnd(3, 5.5) }; }
  function isSea(ux, uy) { var rs = cache, gx = ((ux - rs.minX) * rs.S) | 0, gy = ((uy - rs.minY) * rs.S) | 0; if (gx < 0 || gy < 0 || gx >= rs.gw || gy >= rs.gh) return false; var i = gy * rs.gw + gx; return rs.kind[i] !== 1 && rs.shore[i] > 3 * rs.S; }
  function frame(ts) {
    amb.raf = requestAnimationFrame(frame);
    if (FOF.animOn === false || document.hidden || !cache || !amb.cv) { if (amb.cv && amb.cv.dataset.clear !== '1') { amb.cv.getContext('2d').clearRect(0, 0, amb.cv.width, amb.cv.height); amb.cv.dataset.clear = '1'; } return; }
    amb.cv.dataset.clear = '0';
    var dt = Math.min(0.1, (ts - (amb.t0 || ts)) / 1000); amb.t0 = ts;
    var rs = cache, K = rs.S * 0.5, c = amb.cv.getContext('2d');
    if (amb.cv.width !== Math.round(rs.gw * 0.5)) { amb.cv.width = Math.round(rs.gw * 0.5); amb.cv.height = Math.round(rs.gh * 0.5); }
    c.clearRect(0, 0, amb.cv.width, amb.cv.height);
    function X(u) { return (u - rs.minX) * K; } function Y(u) { return (u - rs.minY) * K; }
    // vagues
    c.lineCap = 'round';
    amb.waves.forEach(function (w, i) {
      w.age += dt; if (w.age > w.life) { amb.waves[i] = newWave(false); return; }
      var a = Math.sin(Math.PI * w.age / w.life), dx = w.age * 1.6;
      c.strokeStyle = 'rgba(225,245,250,' + (0.55 * a) + ')'; c.lineWidth = 0.9 * K;
      var x = X(w.x + dx), y = Y(w.y), s = w.s * K;
      c.beginPath(); c.moveTo(x - s, y); c.quadraticCurveTo(x - s / 2, y - s * 0.45, x, y); c.quadraticCurveTo(x + s / 2, y + s * 0.45, x + s, y); c.stroke();
    });
    // voiliers
    amb.boats.forEach(function (b) {
      var nx = b.x + Math.cos(b.a) * b.sp * dt, ny = b.y + Math.sin(b.a) * b.sp * dt * 0.6;
      if (!isSea(nx + Math.cos(b.a) * 8, ny + Math.sin(b.a) * 6)) b.a += rnd(1.5, 3); else { b.x = nx; b.y = ny; }
      var x = X(b.x), y = Y(b.y) + Math.sin(ts / 600) * 0.5 * K, f = Math.cos(b.a) >= 0 ? 1 : -1;
      c.fillStyle = '#6b4a2a'; c.beginPath(); c.moveTo(x - 4 * K, y); c.lineTo(x + 4 * K, y); c.lineTo(x + 2.6 * K, y + 1.8 * K); c.lineTo(x - 2.6 * K, y + 1.8 * K); c.closePath(); c.fill();
      c.fillStyle = '#f3ecd8'; c.beginPath(); c.moveTo(x, y - 0.4 * K); c.lineTo(x, y - 7 * K); c.lineTo(x + f * 4.2 * K, y - 1 * K); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(230,245,250,.5)'; c.lineWidth = 0.6 * K; c.beginPath(); c.moveTo(x - f * 5 * K, y + 1.4 * K); c.lineTo(x - f * 9 * K, y + 1.8 * K); c.stroke();
    });
    // ombres de nuages qui glissent sur la carte
    var CW = rs.wU, CH = rs.hU;
    if (!amb.clouds || amb.clouds.key !== rs.key) { amb.clouds = { key: rs.key, list: [] }; for (var ci = 0; ci < 4; ci++) amb.clouds.list.push({ x: rs.minX + Math.random() * CW, y: rs.minY + Math.random() * CH, r: rnd(40, 75), sp: rnd(2.5, 5) }); }
    amb.clouds.list.forEach(function (cl) {
      cl.x += cl.sp * dt; if (cl.x - cl.r * 1.6 > rs.minX + CW) { cl.x = rs.minX - cl.r * 1.6; cl.y = rs.minY + Math.random() * CH; }
      var gx = X(cl.x), gy = Y(cl.y), R0 = cl.r * K;
      [[0, 0, 1], [0.7, 0.15, 0.7], [-0.65, 0.1, 0.65]].forEach(function (o) {
        var g = c.createRadialGradient(gx + o[0] * R0, gy + o[1] * R0, 0, gx + o[0] * R0, gy + o[1] * R0, R0 * o[2]);
        g.addColorStop(0, 'rgba(10,25,40,.13)'); g.addColorStop(1, 'rgba(10,25,40,0)');
        c.fillStyle = g; c.beginPath(); c.ellipse(gx + o[0] * R0, gy + o[1] * R0, R0 * o[2], R0 * o[2] * 0.6, 0, 0, 7); c.fill();
      });
    });
    // reflets de soleil sur la mer
    if (!amb.glints) amb.glints = [];
    if (amb.glints.length < 10 && amb.seaPts.length && Math.random() < dt * 6) { var sp0 = amb.seaPts[(Math.random() * amb.seaPts.length) | 0]; amb.glints.push({ x: sp0.x, y: sp0.y, t: 0, d: rnd(0.8, 1.6) }); }
    amb.glints = amb.glints.filter(function (g) {
      g.t += dt; var a = Math.sin(Math.PI * Math.min(1, g.t / g.d)); if (g.t > g.d) return false;
      var x = X(g.x), y = Y(g.y), r = (1 + a * 1.6) * K;
      c.strokeStyle = 'rgba(255,255,255,' + (0.8 * a) + ')'; c.lineWidth = 0.5 * K;
      c.beginPath(); c.moveTo(x - r, y); c.lineTo(x + r, y); c.moveTo(x, y - r * 0.7); c.lineTo(x, y + r * 0.7); c.stroke();
      return true;
    });
    // fumée qui s'élève des capitales + drapeau (peint ici, sous l'interface : dans la couche SVG
    // il passait devant les fenêtres de construction)
    if (amb.st) amb.st.players.forEach(function (pl, pi) {
      if (!pl.alive || pl.capital === null) return;
      var an = rs.anchor['t' + pl.capital]; if (!an) return;
      // le drapeau ne doit JAMAIS déborder de la case : on cherche le plus grand format et le
      // décalage qui tiennent entièrement sur le territoire, sinon on ne le dessine pas.
      // v1.9.2 : anneau doré autour de la capitale - statique, sous l'interface, pour qu'on la
      // repère d'un coup d'œil même quand le drapeau est petit.
      // v1.9.9 - le drapeau de capitale est retiré : le contour doré de la case et la couronne
      // le rendaient redondant, et il encombrait une case déjà chargée.
      for (var k2 = 0; k2 < 4; k2++) {
        var ph = ((ts / 1000 + pi * 0.37 + k2 * 0.8) % 3.2) / 3.2;
        var sx2 = X(an.x - 14 + Math.sin(ph * 5 + k2) * 1.5 + ph * 4), sy2 = Y(an.y - 20 - ph * 16);
        c.fillStyle = 'rgba(235,232,225,' + (0.35 * (1 - ph)) + ')'; c.beginPath(); c.arc(sx2, sy2, (1.2 + ph * 3) * K, 0, 7); c.fill();
      }
    });
    // poissons qui sautent au large
    amb.nextFish -= dt;
    if (amb.nextFish <= 0 && amb.seaPts.length) {
      var fp = amb.seaPts[(Math.random() * amb.seaPts.length) | 0];
      amb.fish.push({ x: fp.x, y: fp.y, t: 0, d: rnd(0.8, 1.2), dir: Math.random() < 0.5 ? 1 : -1 });
      amb.nextFish = rnd(2.5, 6);
    }
    amb.fish = amb.fish.filter(function (f) {
      f.t += dt; var q2 = f.t / f.d; if (q2 >= 1) return false;
      var jump = Math.sin(Math.PI * q2), x3 = X(f.x + f.dir * q2 * 3.5), y3 = Y(f.y) - jump * 5 * K;
      c.save(); c.translate(x3, y3); c.rotate(f.dir * (q2 - 0.5) * 1.6); c.scale(f.dir, 1);
      c.fillStyle = 'rgba(225,245,250,.85)'; c.beginPath(); c.ellipse(0, 0, 1.9 * K, 0.85 * K, 0, 0, 7); c.fill();
      c.beginPath(); c.moveTo(-1.7 * K, 0); c.lineTo(-3 * K, -0.9 * K); c.lineTo(-3 * K, 0.9 * K); c.closePath(); c.fill();
      c.restore();
      if (q2 > 0.75) { c.strokeStyle = 'rgba(235,250,255,' + (1 - q2) * 2 + ')'; c.lineWidth = 0.5 * K; c.beginPath(); c.ellipse(X(f.x + f.dir * 3.5), Y(f.y), 2.6 * K * (q2 - 0.7) * 3, 0.9 * K * (q2 - 0.7) * 3, 0, 0, 7); c.stroke(); }
      return true;
    });
    // papillons dans les prairies, lucioles dans les marécages
    (amb.flies || []).forEach(function (f) {
      f.t += dt * f.sp;
      var ox = Math.sin(f.t * 0.9) * 5 + Math.sin(f.t * 2.3) * 1.4, oy = Math.cos(f.t * 0.7) * 3.4 + Math.sin(f.t * 3.1) * 0.9;
      var x4 = X(f.x0 + ox), y4 = Y(f.y0 + oy);
      if (f.kind === 'b') {
        var wing = Math.abs(Math.sin(f.t * 9)) * 0.9 + 0.25;
        c.fillStyle = 'rgba(255,246,190,.95)';
        c.beginPath(); c.ellipse(x4 - 0.7 * K, y4, 0.75 * K, 0.75 * K * wing, -0.5, 0, 7); c.fill();
        c.beginPath(); c.ellipse(x4 + 0.7 * K, y4, 0.75 * K, 0.75 * K * wing, 0.5, 0, 7); c.fill();
        c.fillStyle = 'rgba(90,70,40,.9)'; c.fillRect(x4 - 0.15 * K, y4 - 0.5 * K, 0.3 * K, 1 * K);
      } else {
        var glow = 0.35 + 0.65 * Math.abs(Math.sin(f.t * 1.7));
        var g3 = c.createRadialGradient(x4, y4, 0, x4, y4, 2.4 * K);
        g3.addColorStop(0, 'rgba(230,255,150,' + (0.9 * glow) + ')'); g3.addColorStop(1, 'rgba(180,255,120,0)');
        c.fillStyle = g3; c.beginPath(); c.arc(x4, y4, 2.4 * K, 0, 7); c.fill();
      }
    });
    // renard qui traverse une forêt
    amb.nextFox -= dt;
    if (!amb.fox && amb.nextFox <= 0 && amb.forest.length > 8) {
      var p1 = amb.forest[(Math.random() * amb.forest.length) | 0], same = amb.forest.filter(function (q) { return q.t === p1.t && Math.abs(q.x - p1.x) > 10; });
      if (same.length) { var p2 = same[(Math.random() * same.length) | 0]; amb.fox = { x0: p1.x, y0: p1.y, x1: p2.x, y1: p2.y, t: 0, d: rnd(6, 9) }; }
      amb.nextFox = rnd(6, 12);
    }
    if (amb.fox) {
      var fx = amb.fox; fx.t += dt; var q = Math.min(1, fx.t / fx.d);
      if (q >= 1) amb.fox = null;
      else {
        var ux2 = fx.x0 + (fx.x1 - fx.x0) * q, uy2 = fx.y0 + (fx.y1 - fx.y0) * q, dir = fx.x1 >= fx.x0 ? 1 : -1, fade = Math.min(1, q * 6, (1 - q) * 6);
        var x2 = X(ux2), y2 = Y(uy2), step = Math.sin(fx.t * 14);
        c.save(); c.globalAlpha = fade; c.translate(x2, y2); c.scale(dir * K * 0.55, K * 0.55);
        c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(0, 3.6, 6, 1.1, 0, 0, 7); c.fill();
        c.strokeStyle = '#7a3d12'; c.lineWidth = 1; c.beginPath(); c.moveTo(-2.5, 1); c.lineTo(-2.5 + step, 3.5); c.moveTo(2.5, 1); c.lineTo(2.5 - step, 3.5); c.stroke();
        c.fillStyle = '#d9731f'; c.beginPath(); c.ellipse(0, 0, 4.2, 2.1, 0, 0, 7); c.fill();
        c.beginPath(); c.moveTo(-3.8, -0.4); c.quadraticCurveTo(-8, -2 + step * 0.4, -9, 1.4); c.quadraticCurveTo(-6.5, 1.2, -3.6, 1); c.fill();
        c.fillStyle = '#f5ead8'; c.beginPath(); c.arc(-8.6, 1.1, 0.9, 0, 7); c.fill();
        c.fillStyle = '#d9731f'; c.beginPath(); c.arc(4.2, -1.4, 1.9, 0, 7); c.fill();
        c.beginPath(); c.moveTo(3.4, -2.9); c.lineTo(3.9, -4.8); c.lineTo(4.7, -3); c.fill(); c.beginPath(); c.moveTo(4.8, -2.9); c.lineTo(5.6, -4.6); c.lineTo(5.9, -2.6); c.fill();
        c.beginPath(); c.moveTo(5.6, -1.6); c.lineTo(7.4, -0.8); c.lineTo(5.6, -0.4); c.fill();
        c.fillStyle = '#1b1208'; c.beginPath(); c.arc(7.3, -0.8, 0.35, 0, 7); c.fill();
        c.restore();
      }
    }
    // vol d'oiseaux
    amb.nextBirds -= dt;
    if (!amb.birds && amb.nextBirds <= 0) { var fromL = Math.random() < 0.5; amb.birds = { x: fromL ? rs.minX - 10 : rs.minX + rs.wU + 10, y: rs.minY + rnd(0.15, 0.85) * rs.hU, vx: (fromL ? 1 : -1) * rnd(14, 20), vy: rnd(-3, 3) }; amb.nextBirds = rnd(7, 16); }
    if (amb.birds) {
      var bd = amb.birds; bd.x += bd.vx * dt; bd.y += bd.vy * dt;
      if (bd.x < rs.minX - 20 || bd.x > rs.minX + rs.wU + 20) amb.birds = null;
      else {
        c.strokeStyle = 'rgba(30,26,22,.75)'; c.lineWidth = 0.7 * K;
        [[0, 0], [-5, -3], [-5, 3], [-10, -6], [-10, 1], [-15, -3]].forEach(function (o, j) {
          var bx = X(bd.x + o[0] * Math.sign(bd.vx)), by = Y(bd.y + o[1]), fl = Math.sin(ts / 110 + j) * 1.2 * K, w = 2.2 * K;
          c.beginPath(); c.moveTo(bx - w, by - fl); c.quadraticCurveTo(bx - w / 2, by - w * 0.4, bx, by); c.quadraticCurveTo(bx + w / 2, by - w * 0.4, bx + w, by - fl); c.stroke();
        });
      }
    }
  }

  FOF.Board = {
    ambient: function (st, canvas) { amb.st = st;
      amb.cv = canvas;
      if (cache && amb.key !== cache.key) ambSetup(st);
      if (!amb.raf) amb.raf = requestAnimationFrame(frame);
    },
    R: R,
    locAt: function (st, lx, ly) {
      var rs = cache; if (!rs) return null;
      var gx = Math.floor((lx - rs.minX) * rs.S), gy = Math.floor((ly - rs.minY) * rs.S);
      if (gx < 0 || gy < 0 || gx >= rs.gw || gy >= rs.gh) return null;
      var i = gy * rs.gw + gx; return rs.kind[i] === 1 ? 't' + rs.id[i] : rs.kind[i] === 2 ? 's' + rs.id[i] : null;
    },
    anchor: function (loc) { return cache ? cache.anchor[loc] || null : { x: 0, y: 0 }; },
    // v1.9.24 : surface approximative d'une case (boîte englobante), pour placer d'abord les plus petites
    taille: function (loc) { var b = cache && cache.box[loc]; return b ? (b.x1 - b.x0 + 1) * (b.y1 - b.y0 + 1) : 1e9; },
    // vrai si le point (unités) appartient à la région demandée
    inside: function (loc, ux, uy) {
      var rs = cache; if (!rs) return false;
      var gx = Math.round((ux - rs.minX) * rs.S), gy = Math.round((uy - rs.minY) * rs.S);
      if (gx < 0 || gy < 0 || gx >= rs.gw || gy >= rs.gh) return false;
      var i = gy * rs.gw + gx, k = loc[0] === 't' ? 1 : 2;
      return rs.kind[i] === k && rs.id[i] === +loc.slice(1);
    },
    // cherche autour de l'ancre une position où le rectangle (largeur w, de -up à +down) tient dans la case
    // v1.9.24 - avoid : rectangles déjà occupés (pions, aménagements d'autres cases) à ne pas chevaucher.
    // Les points du milieu des bords sont aussi vérifiés : une île au milieu d'une mer ne passe plus
    // entre les quatre coins (Golfe de Saint-Malo et îles anglo-normandes, créateur 08/10/2026).
    place: function (loc, w, up, down, avoid) {
      var rs = cache, a = rs && rs.anchor[loc]; if (!a) return null;
      var self = FOF.Board, hw = w / 2;
      function libre(x, y) {
        if (!avoid || !avoid.length) return true;
        for (var k = 0; k < avoid.length; k++) { var b = avoid[k]; if (x - hw < b.x1 && x + hw > b.x0 && y - up < b.y1 && y + down > b.y0) return false; }
        return true;
      }
      function dedans(x, y) {
        return self.inside(loc, x, y) && self.inside(loc, x - hw, y - up) && self.inside(loc, x + hw, y - up) &&
          self.inside(loc, x - hw, y + down) && self.inside(loc, x + hw, y + down) &&
          self.inside(loc, x, y - up) && self.inside(loc, x, y + down) && self.inside(loc, x - hw, y) && self.inside(loc, x + hw, y);
      }
      function fits(x, y) { return dedans(x, y) && libre(x, y); }
      if (fits(a.x, a.y)) return { x: a.x, y: a.y };
      var steps = [0]; for (var st0 = 3; st0 <= (avoid && avoid.length ? 96 : 22); st0 += st0 < 24 ? 3 : 5) steps.push(st0, -st0);
      for (var r = 1; r < steps.length; r++) for (var i = 0; i <= r; i++) {
        var cand = [[steps[r], steps[i]], [steps[i], steps[r]]];
        for (var c = 0; c < 2; c++) { var x = a.x + cand[c][0], y = a.y + cand[c][1]; if (fits(x, y)) return { x: x, y: y }; }
      }
      // aucune place libre en entier dans la case : on accepte que les coins débordent un peu
      // (centre et milieux des bords toujours dans la case), toujours sans chevaucher les voisins
      if (avoid && avoid.length) {
        var lache = function (x, y) { return self.inside(loc, x, y) && self.inside(loc, x, y - up * 0.7) && self.inside(loc, x, y + down * 0.7) && self.inside(loc, x - hw * 0.7, y) && self.inside(loc, x + hw * 0.7, y) && libre(x, y); };
        for (var r2 = 0; r2 < steps.length; r2++) for (var i2 = 0; i2 <= r2; i2++) {
          var cd2 = [[steps[r2], steps[i2]], [steps[i2], steps[r2]]];
          for (var c2 = 0; c2 < 2; c2++) { var x2 = a.x + cd2[c2][0], y2 = a.y + cd2[c2][1]; if (lache(x2, y2)) return { x: x2, y: y2 }; }
        }
        // toujours rien : on garde la règle d'avant (dans la case, sans tenir compte des voisins)
        return self.place(loc, w, up, down);
      }
      // rien ne tient : on réduit la marge et on se contente du centre de la case
      for (var k2 = 0.8; k2 >= 0.2; k2 -= 0.2) {
        var hw2 = hw * k2, up2 = up * k2, dn2 = down * k2;
        if (self.inside(loc, a.x - hw2, a.y - up2) && self.inside(loc, a.x + hw2, a.y + dn2)) return { x: a.x, y: a.y };
      }
      return { x: a.x, y: a.y };
    },
    icons: function () { return []; },
    // v1.9.19 - contrôle : mers vues sur la trame autour de chaque territoire, et segments droits
    diag: function () {
      var rs = cache; if (!rs) return null;
      var vu = {}, N = rs.gw * rs.gh;
      for (var i = 0; i < N; i++) {
        if (rs.kind[i] !== 1) continue;
        var x = i % rs.gw;
        [x > 0 ? i - 1 : -1, x < rs.gw - 1 ? i + 1 : -1, i - rs.gw, i + rs.gw].forEach(function (j) {
          if (j < 0 || j >= N || rs.kind[j] !== 2) return;
          var k = rs.id[i] + ':' + rs.id[j]; vu[k] = (vu[k] || 0) + 1;
        });
      }
      return { segs: rs.seaSegs ? rs.seaSegs.length : null, contacts: vu };
    },
    bounds: function () { return cache ? { x: cache.minX, y: cache.minY, w: cache.wU, h: cache.hU } : null; },
    prepare: function (st, baseCanvas, done) {
      // le style fait partie de la clé de cache : changer de style suffit à redessiner le terrain
      var key = st.seed + ':' + st.map.terr.length + ':' + (st.map.hist || '') + ':' + FOF.mapStyle();
      if (cache && cache.key === key && baseCanvas.dataset.key === key) { done(); return; }
      Promise.all([loadImages(), chargerTrame(st.map)]).then(function (r) {
        cache = build(st, r[1]); cache.key = key;
        drawBase(st, cache, baseCanvas);
        styleBase(baseCanvas, FOF.mapStyle());
        baseCanvas.dataset.key = key; done();
      }).catch(function (e) { if (window.console) console.error(e); });
    },
    // couche des propriétaires, sélection et cibles à choisir
    overlay: function (st, canvas, view, colorOf) {
      var rs = cache; if (!rs) return;
      if (canvas.width !== rs.gw || canvas.height !== rs.gh) { canvas.width = rs.gw; canvas.height = rs.gh; }
      var ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, rs.gw, rs.gh);
      st.map.terr.forEach(function (t) {
        if (t.ctrl === null) return;
        var col = colorOf(t.ctrl);
        paint(ctx, rs, 't' + t.id, 'fill', col, 0.3);
        paint(ctx, rs, 't' + t.id, 'band', col, 0.95);
        // v1.9.2 - la capitale se repère au premier coup d'œil : sa case vire à l'or et son
        // liseré est doublé d'un trait doré.
        var pl = st.players[t.ctrl];
        if (pl && pl.alive && pl.capital === t.id) {
          // la case vire à l'or pour signaler la capitale, mais son liseré reste à la couleur du
          // joueur : on le repose par-dessus l'or, sinon toutes les capitales semblaient brunes.
          paint(ctx, rs, 't' + t.id, 'fill', '#e8b73a', 0.34);
          paintRay(ctx, rs, 't' + t.id, 'band', col, 1);
          paintRay(ctx, rs, 't' + t.id, 'band', col, 1);
        }
      });
      (view.picks || []).forEach(function (tid) { paint(ctx, rs, 't' + tid, 'fill', '#46c46e', 0.45); paint(ctx, rs, 't' + tid, 'band', '#2fa857', 1); });
      if (view.sel) paint(ctx, rs, view.sel, 'band', '#ffffff', 1);
    },
    // cases atteignables : calque séparé qui clignote (CSS)
    reach: function (st, canvas, reach) {
      var rs = cache; if (!rs) return;
      if (canvas.width !== rs.gw || canvas.height !== rs.gh) { canvas.width = rs.gw; canvas.height = rs.gh; }
      var ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, rs.gw, rs.gh);
      var locs = reach ? Object.keys(reach) : [];
      locs.forEach(function (loc) { paint(ctx, rs, loc, 'fill', '#ffffff', 0.42); paint(ctx, rs, loc, 'band', '#ffffff', 1); });
      canvas.classList.toggle('on', locs.length > 0);
    }
  };
})(window.FOF = window.FOF || {});
