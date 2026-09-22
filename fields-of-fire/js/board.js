/* Fields of Fire — rendu de la carte : frontières irrégulières dessinées à la main (canvas) + pions (SVG) */
(function (FOF) {
  'use strict';
  var R = 30, PX = 1;            // PX : taille d'un pixel logique de la trame
  var IMG = {}, imgReady = null;
  function loadImages() {
    if (imgReady) return imgReady;
    var names = ['biome-P', 'biome-F', 'biome-M', 'biome-Ma'];
    imgReady = Promise.all(names.map(function (n) {
      return new Promise(function (res) { var im = new Image(); im.onload = function () { IMG[n] = im; res(); }; im.onerror = function () { res(); }; im.src = 'assets/icons/' + n + '.png'; });
    }));
    return imgReady;
  }
  // bruit de valeur déterministe
  function hash(x, y, s) { var h = x * 374761393 + y * 668265263 + s * 982451653; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function vnoise(x, y, s) {
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
    return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
  }
  function pixToHex(x, y, W) {
    var w = Math.sqrt(3) * R, px = x - 4 - w / 2, py = y - R - 4;
    var q = (Math.sqrt(3) / 3 * px - py / 3) / R, r = (2 / 3 * py) / R;
    var cx = q, cz = r, cy = -cx - cz, rx = Math.round(cx), ry = Math.round(cy), rz = Math.round(cz);
    var dx = Math.abs(rx - cx), dy = Math.abs(ry - cy), dz = Math.abs(rz - cz);
    if (dx > dy && dx > dz) rx = -ry - rz; else if (dy <= dz) rz = -rx - ry;
    var row = rz, col = rx + (row - (row & 1)) / 2;
    return { col: col, row: row };
  }

  // Trame d'appartenance calculée une fois par carte
  var cache = null;
  function buildRaster(st) {
    var m = st.map, W = m.W, H = m.H, seed = st.map.terr.length * 131 + W;
    var hexT = {}; m.terr.forEach(function (t) { hexT[t.hex] = t.id; });
    var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    m.terr.map(function (t) { return t.hex; }).concat(Object.keys(m.zoneOf).map(Number)).forEach(function (h) {
      var c = FOF.hexCenter(h, W, R); minX = Math.min(minX, c.x - R * 0.9); maxX = Math.max(maxX, c.x + R * 0.9); minY = Math.min(minY, c.y - R * 0.9); maxY = Math.max(maxY, c.y + R * 0.9);
    });
    var gw = Math.ceil((maxX - minX) / PX), gh = Math.ceil((maxY - minY) / PX), N = gw * gh;
    var kind = new Int8Array(N), id = new Int16Array(N);
    for (var gy = 0; gy < gh; gy++) for (var gx = 0; gx < gw; gx++) {
      var x = minX + gx * PX, y = minY + gy * PX;
      var wx = x + R * 0.42 * vnoise(x / 38, y / 38, seed) + R * 0.16 * vnoise(x / 11, y / 11, seed + 7);
      var wy = y + R * 0.42 * vnoise(x / 38 + 50, y / 38, seed + 3) + R * 0.16 * vnoise(x / 11, y / 11 + 90, seed + 9);
      var hc = pixToHex(wx, wy, W), i = gy * gw + gx;
      if (hc.col < 0 || hc.row < 0 || hc.col >= W || hc.row >= H) { kind[i] = 0; continue; }
      var h = hc.row * W + hc.col;
      if (hexT[h] !== undefined) { kind[i] = 1; id[i] = hexT[h]; }
      else if (m.zoneOf[h] !== undefined) { kind[i] = 2; id[i] = m.zoneOf[h]; }
      else kind[i] = 0;
    }
    // distance au bord (0..6) pour les liserés
    var dist = new Uint8Array(N).fill(9), q = [];
    for (i = 0; i < N; i++) {
      var gx2 = i % gw, gy2 = (i / gw) | 0, edge = false;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var nx = gx2 + d[0], ny = gy2 + d[1]; if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) { edge = true; return; }
        var j = ny * gw + nx; if (kind[j] !== kind[i] || id[j] !== id[i]) edge = true;
      });
      if (edge) { dist[i] = 0; q.push(i); }
    }
    while (q.length) {
      var u = q.shift(), ux = u % gw, uy = (u / gw) | 0;
      if (dist[u] >= 8) continue;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var nx = ux + d[0], ny = uy + d[1]; if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) return;
        var j = ny * gw + nx; if (dist[j] > dist[u] + 1 && kind[j] === kind[u] && id[j] === id[u]) { dist[j] = dist[u] + 1; q.push(j); }
      });
    }
    // ancre de chaque territoire / zone : point le plus intérieur
    var anchorT = {}, anchorS = {}, best = {};
    for (i = 0; i < N; i++) {
      if (kind[i] !== 1 && kind[i] !== 2) continue;
      var key = (kind[i] === 1 ? 't' : 's') + id[i], sc = dist[i] * 10 + hash(i, 3, seed);
      if (!best[key] || sc > best[key].sc) best[key] = { sc: sc, i: i };
    }
    Object.keys(best).forEach(function (k) { var i2 = best[k].i; (k[0] === 't' ? anchorT : anchorS)[+k.slice(1)] = { x: minX + (i2 % gw) * PX, y: minY + ((i2 / gw) | 0) * PX }; });
    // les zones de mer : ancre centrée sur la case d'ancrage prévue
    m.seas.forEach(function (z) { var c = FOF.hexCenter(z.anchor, W, R); anchorS[z.id] = { x: c.x, y: c.y }; });
    return { key: st.seed + ':' + m.terr.length, minX: minX, minY: minY, gw: gw, gh: gh, kind: kind, id: id, dist: dist, anchorT: anchorT, anchorS: anchorS, w: gw * PX, h: gh * PX, seed: seed };
  }

  var BIOME_LAND = { P: [233, 222, 170], F: [205, 214, 164], M: [224, 205, 176], Ma: [200, 214, 196] };
  function drawBase(st, rs, canvas) {
    var ctx = canvas.getContext('2d'), gw = rs.gw, gh = rs.gh;
    var img = ctx.createImageData(gw, gh), d = img.data, m = st.map;
    for (var i = 0; i < gw * gh; i++) {
      var k = rs.kind[i], x = i % gw, y = (i / gw) | 0, n = hash(x >> 1, y >> 1, 11) * 10 - 5, r, g, b;
      if (k === 1) {
        var c = BIOME_LAND[m.terr[rs.id[i]].biome]; r = c[0] + n; g = c[1] + n; b = c[2] + n;
        if (rs.dist[i] === 0) {
          // côte : trait épais ; frontière intérieure : trait fin
          var coast = isCoast(rs, i);
          if (coast) { r = 42; g = 34; b = 24; } else { r = r * 0.55; g = g * 0.55; b = b * 0.55; }
        } else if (rs.dist[i] === 1 && isCoast(rs, i, 2)) { r = 60; g = 50; b = 38; }
      } else if (k === 2) {
        var sh = Math.min(rs.dist[i], 8) * 2;
        r = 168 + sh + n; g = 190 + sh + n; b = 190 + sh + n;
        if (rs.dist[i] === 0 && zoneEdge(rs, i) && ((x + y) % 7 < 4)) { r = 110; g = 130; b = 134; }
      } else { r = 150 + n; g = 174 + n; b = 176 + n; }
      d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255;
    }
    canvas.width = gw; canvas.height = gh;
    ctx.putImageData(img, 0, 0);
    // vaguelettes et icônes de terrain (dessinées à 1 unité = PX)
    ctx.save(); ctx.scale(1 / PX, 1 / PX); ctx.translate(-rs.minX, -rs.minY);
    ctx.strokeStyle = 'rgba(60,80,86,.45)'; ctx.lineWidth = 1.1;
    for (var s = 0; s < gw * gh / 900; s++) {
      var j = Math.floor(hash(s, 5, rs.seed) * gw * gh);
      if (rs.kind[j] !== 2 && rs.kind[j] !== 0) continue;
      if (rs.dist[j] < 4 && rs.kind[j] === 2) continue;
      var sx = rs.minX + (j % gw) * PX, sy = rs.minY + ((j / gw) | 0) * PX;
      ctx.beginPath(); ctx.moveTo(sx - 4, sy); ctx.quadraticCurveTo(sx - 2, sy - 2.5, sx, sy); ctx.quadraticCurveTo(sx + 2, sy + 2.5, sx + 4, sy); ctx.stroke();
    }
    ctx.globalAlpha = 0.8;
    m.terr.forEach(function (t) {
      var ic = IMG['biome-' + t.biome]; if (!ic) return;
      var pts = [], tries = 0;
      while (pts.length < 3 && tries < 400) {
        tries++;
        var jj = Math.floor(hash(t.id * 97 + tries, 7, rs.seed) * gw * gh);
        if (rs.kind[jj] !== 1 || rs.id[jj] !== t.id || rs.dist[jj] < 6) continue;
        var px = rs.minX + (jj % gw) * PX, py = rs.minY + ((jj / gw) | 0) * PX, a = rs.anchorT[t.id];
        if (Math.abs(px - a.x) < 16 && Math.abs(py - a.y) < 18) continue;
        if (pts.some(function (p) { return Math.abs(p.x - px) < 11 && Math.abs(p.y - py) < 11; })) continue;
        pts.push({ x: px, y: py });
      }
      pts.forEach(function (p) { var s2 = 10 / Math.max(ic.width, ic.height); ctx.drawImage(ic, p.x - ic.width * s2 / 2, p.y - ic.height * s2 / 2, ic.width * s2, ic.height * s2); });
    });
    ctx.restore();
  }
  function isCoast(rs, i, rad) {
    rad = rad || 1; var gw = rs.gw, x = i % gw, y = (i / gw) | 0;
    for (var dy = -rad; dy <= rad; dy++) for (var dx = -rad; dx <= rad; dx++) {
      var nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= gw || ny >= rs.gh) continue;
      if (rs.kind[ny * gw + nx] !== 1) return true;
    }
    return false;
  }
  function zoneEdge(rs, i) {
    var gw = rs.gw, x = i % gw, y = (i / gw) | 0;
    return [[1, 0], [0, 1], [-1, 0], [0, -1]].some(function (d) { var nx = x + d[0], ny = y + d[1]; if (nx < 0 || ny < 0 || nx >= gw || ny >= rs.gh) return false; var j = ny * gw + nx; return rs.kind[j] === 2 && rs.id[j] !== rs.id[i]; });
  }

  function hexToRgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function drawOverlay(st, rs, canvas, view, colorOf) {
    var ctx = canvas.getContext('2d'), gw = rs.gw, gh = rs.gh;
    canvas.width = gw; canvas.height = gh;
    var img = ctx.createImageData(gw, gh), d = img.data, m = st.map;
    var ownCol = {}; m.terr.forEach(function (t) { if (t.ctrl !== null) ownCol[t.id] = hexToRgb(colorOf(t.ctrl)); });
    var reach = view.reach || {}, picks = {}; (view.picks || []).forEach(function (t) { picks['t' + t] = 1; });
    for (var i = 0; i < gw * gh; i++) {
      var k = rs.kind[i]; if (k !== 1 && k !== 2) continue;
      var loc = (k === 1 ? 't' : 's') + rs.id[i], di = rs.dist[i], a = 0, c = null;
      if (k === 1 && ownCol[rs.id[i]]) { c = ownCol[rs.id[i]]; a = di <= 2 ? 0.95 : di <= 5 ? 0.35 : 0.2; if (di === 0) a = 0; }
      if (reach[loc] !== undefined) { c = [255, 196, 64]; a = di <= 3 ? 0.95 : 0.42; }
      if (picks[loc]) { c = [70, 190, 110]; a = di <= 3 ? 0.95 : 0.4; }
      if (view.sel === loc && di <= 3 && di > 0) { c = [255, 255, 245]; a = 1; }
      if (!c) continue;
      d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = Math.round(a * 255);
    }
    ctx.putImageData(img, 0, 0);
  }

  FOF.Board = {
    R: R,
    locAt: function (st, lx, ly) {
      var rs = cache; if (!rs) return null;
      var gx = Math.floor((lx - rs.minX) / PX), gy = Math.floor((ly - rs.minY) / PX);
      if (gx < 0 || gy < 0 || gx >= rs.gw || gy >= rs.gh) return null;
      var i = gy * rs.gw + gx; return rs.kind[i] === 1 ? 't' + rs.id[i] : rs.kind[i] === 2 ? 's' + rs.id[i] : null;
    },
    anchor: function (loc) { if (!cache) return { x: 0, y: 0 }; return loc[0] === 't' ? cache.anchorT[+loc.slice(1)] : cache.anchorS[+loc.slice(1)]; },
    bounds: function () { return cache ? { x: cache.minX, y: cache.minY, w: cache.w, h: cache.h } : null; },
    prepare: function (st, baseCanvas, done) {
      var key = st.seed + ':' + st.map.terr.length;
      if (cache && cache.key === key && baseCanvas.dataset.key === key) { done(); return; }
      loadImages().then(function () {
        cache = buildRaster(st); drawBase(st, cache, baseCanvas); baseCanvas.dataset.key = key; done();
      });
    },
    overlay: function (st, canvas, view, colorOf) { if (cache) drawOverlay(st, cache, canvas, view, colorOf); }
  };
})(window.FOF = window.FOF || {});
