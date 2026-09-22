/* Fields of Fire — rendu de la carte (v1.4) : trame haute définition, frontières irrégulières,
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
  function build(st) {
    var m = st.map, W = m.W, H = m.H, seed = m.terr.length * 131 + W;
    var hexT = {}; m.terr.forEach(function (t) { hexT[t.hex] = t.id; });
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
      else if (m.zoneOf[h] !== undefined) { kind[i] = 2; id[i] = m.zoneOf[h]; }
      else kind[i] = 0;
    }
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
      var sc = Math.min(dist[i], CAP) * 10 + hash(i, 3, seed);
      if (!best[key] || sc > best[key].sc) best[key] = { sc: sc, i: i };
      var b = box[key] || (box[key] = { x0: x2, y0: y2, x1: x2, y1: y2 });
      if (x2 < b.x0) b.x0 = x2; if (x2 > b.x1) b.x1 = x2; if (y2 < b.y0) b.y0 = y2; if (y2 > b.y1) b.y1 = y2;
    }
    var anchor = {};
    Object.keys(best).forEach(function (k) { var j = best[k].i; anchor[k] = { x: minX + ((j % gw) + 0.5) / S, y: minY + (((j / gw) | 0) + 0.5) / S }; });
    m.seas.forEach(function (z) { if (!anchor['s' + z.id]) { var c = FOF.hexCenter(z.anchor, W, R); anchor['s' + z.id] = { x: Math.max(minX + 10, Math.min(maxX - 10, c.x)), y: Math.max(minY + 10, Math.min(maxY - 10, c.y)) }; } });
    return { key: st.seed + ':' + m.terr.length, seed: seed, minX: minX, minY: minY, wU: wU, hU: hU, S: S, gw: gw, gh: gh, kind: kind, id: id, dist: dist, shore: shore, coastD: coastD, anchor: anchor, box: box, masks: {}, tint: {} };
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

  var SEA3 = [[92, 206, 222], [52, 150, 214], [34, 104, 190], [26, 78, 162]];
  function mix3(p, v) { var n = p.length - 1, f = Math.max(0, Math.min(n, v * n)), k = Math.min(n - 1, Math.floor(f)), t = f - k, a = p[k], b = p[k + 1]; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function drawBase(st, rs, canvas) {
    var gw = rs.gw, gh = rs.gh, N = gw * gh, S = rs.S, m = st.map;
    canvas.width = gw; canvas.height = gh;
    var kind = rs.kind, id = rs.id, dist = rs.dist, shore = rs.shore, coastD = rs.coastD;
    var biomeOf = m.terr.map(function (t) { return t.biome; });
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
        if (k === 2 && dist[i] < 0.6 * S && ((lx + ly) % Math.round(7 * u)) < 3.5 * u) {
          var nb = [i - 1, i + 1, i - gw, i + gw].some(function (q) { return q >= 0 && q < N && kind[q] === 2 && id[q] !== id[i]; });
          if (!nb) nb = [i - P, i + P, i - gw * P, i + gw * P].some(function (q) { return q >= 0 && q < N && kind[q] === 2 && id[q] !== id[i]; });
          if (nb) col = [170, 214, 245];
        }
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
      var step = { F: 5.2, M: 9, P: 6.2, Ma: 7 }[t.biome] * u, row = 0, n = 0;
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
      byT[tid].forEach(function (e) { VEC[e[1]](c, e[2], e[0], S, e[3]); });
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
    amb.waves = []; for (var w = 0; w < 46 && amb.seaPts.length; w++) amb.waves.push(newWave(true));
    amb.boats = [];
    var near = amb.seaPts.filter(function (p) { return p.near; });
    for (var b2 = 0; b2 < 2 && near.length; b2++) { var p0 = near[(Math.random() * near.length) | 0]; amb.boats.push({ x: p0.x, y: p0.y, a: rnd(0, 6.28), sp: rnd(1.2, 2) }); }
    amb.fox = null; amb.birds = null; amb.nextFox = 3; amb.nextBirds = 8;
  }
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
    // fumée qui s'élève des capitales
    if (amb.st) amb.st.players.forEach(function (pl, pi) {
      if (!pl.alive || pl.capital === null) return;
      var an = rs.anchor['t' + pl.capital]; if (!an) return;
      for (var k2 = 0; k2 < 4; k2++) {
        var ph = ((ts / 1000 + pi * 0.37 + k2 * 0.8) % 3.2) / 3.2;
        var sx2 = X(an.x - 14 + Math.sin(ph * 5 + k2) * 1.5 + ph * 4), sy2 = Y(an.y - 20 - ph * 16);
        c.fillStyle = 'rgba(235,232,225,' + (0.35 * (1 - ph)) + ')'; c.beginPath(); c.arc(sx2, sy2, (1.2 + ph * 3) * K, 0, 7); c.fill();
      }
    });
    // renard qui traverse une forêt
    amb.nextFox -= dt;
    if (!amb.fox && amb.nextFox <= 0 && amb.forest.length > 8) {
      var p1 = amb.forest[(Math.random() * amb.forest.length) | 0], same = amb.forest.filter(function (q) { return q.t === p1.t && Math.abs(q.x - p1.x) > 10; });
      if (same.length) { var p2 = same[(Math.random() * same.length) | 0]; amb.fox = { x0: p1.x, y0: p1.y, x1: p2.x, y1: p2.y, t: 0, d: rnd(6, 9) }; }
      amb.nextFox = rnd(10, 18);
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
    if (!amb.birds && amb.nextBirds <= 0) { var fromL = Math.random() < 0.5; amb.birds = { x: fromL ? rs.minX - 10 : rs.minX + rs.wU + 10, y: rs.minY + rnd(0.15, 0.85) * rs.hU, vx: (fromL ? 1 : -1) * rnd(14, 20), vy: rnd(-3, 3) }; amb.nextBirds = rnd(20, 35); }
    if (amb.birds) {
      var bd = amb.birds; bd.x += bd.vx * dt; bd.y += bd.vy * dt;
      if (bd.x < rs.minX - 20 || bd.x > rs.minX + rs.wU + 20) amb.birds = null;
      else {
        c.strokeStyle = 'rgba(30,26,22,.75)'; c.lineWidth = 0.7 * K;
        [[0, 0], [-5, -3], [-5, 3], [-10, -6]].forEach(function (o, j) {
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
    icons: function () { return []; },
    bounds: function () { return cache ? { x: cache.minX, y: cache.minY, w: cache.wU, h: cache.hU } : null; },
    prepare: function (st, baseCanvas, done) {
      var key = st.seed + ':' + st.map.terr.length;
      if (cache && cache.key === key && baseCanvas.dataset.key === key) { done(); return; }
      loadImages().then(function () { cache = build(st); drawBase(st, cache, baseCanvas); baseCanvas.dataset.key = key; done(); });
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
