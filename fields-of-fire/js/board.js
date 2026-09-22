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

  // couleurs (terre : parchemin teinté ; encre du motif)
  var LAND = { P: [236, 216, 146], F: [160, 196, 124], M: [196, 182, 160], Ma: [138, 184, 166] };
  var INK = { P: '#9a7a2a', F: '#2f6128', M: '#5e4c3c', Ma: '#245a4c' };
  var SEA_DEEP = [52, 98, 122], SEA_SHALLOW = [132, 186, 192];

  var cache = null;
  function build(st) {
    var m = st.map, W = m.W, H = m.H, seed = m.terr.length * 131 + W;
    var hexT = {}; m.terr.forEach(function (t) { hexT[t.hex] = t.id; });
    // cadrage serré sur les terres (+ une bande de mer)
    var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    m.terr.forEach(function (t) { var c = FOF.hexCenter(t.hex, W, R); minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x); minY = Math.min(minY, c.y); maxY = Math.max(maxY, c.y); });
    var pad = R * 1.9; minX -= pad; minY -= pad; maxX += pad; maxY += pad;
    var wU = maxX - minX, hU = maxY - minY;
    var S = Math.max(1.4, Math.min(3, 2400 / wU));
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

  function drawBase(st, rs, canvas) {
    var gw = rs.gw, gh = rs.gh, N = gw * gh, S = rs.S, m = st.map;
    canvas.width = gw; canvas.height = gh;
    var ctx = canvas.getContext('2d'), img = ctx.createImageData(gw, gh), d = img.data;
    var kind = rs.kind, id = rs.id, dist = rs.dist, shore = rs.shore, coastD = rs.coastD;
    var biomeOf = m.terr.map(function (t) { return t.biome; });
    var sh = Math.round(2.2 * S), shy = Math.round(3.2 * S);
    for (var i = 0; i < N; i++) {
      var x = i % gw, y = (i / gw) | 0, k = kind[i], r, g, b;
      var grain = (hash(x, y, 5) - 0.5) * 7 + vnoise(x / (40 * S), y / (40 * S), 3) * 6;
      if (k === 1) {
        var c = LAND[biomeOf[id[i]]], di = dist[i];
        // léger dégradé vers l'intérieur de chaque territoire (effet de relief)
        var rel = 1 - 0.1 * Math.max(0, 1 - di / (9 * S));
        r = c[0] * rel + grain; g = c[1] * rel + grain; b = c[2] * rel + grain;
        var cd = coastD[i];
        if (cd < 1.3 * S) { r = 44; g = 38; b = 34; }                                    // trait de côte
        else if (cd < 3.2 * S) { r = r * 0.9 + 22; g = g * 0.9 + 20; b = b * 0.9 + 12; } // liseré de sable
        else if (di < 0.7 * S) { r = r * 0.5; g = g * 0.5; b = b * 0.5; }              // frontière intérieure
      } else {
        var t = Math.min(1, shore[i] / (13 * S)); t = t * t * (3 - 2 * t);
        r = SEA_SHALLOW[0] + (SEA_DEEP[0] - SEA_SHALLOW[0]) * t + grain * 0.6;
        g = SEA_SHALLOW[1] + (SEA_DEEP[1] - SEA_SHALLOW[1]) * t + grain * 0.6;
        b = SEA_SHALLOW[2] + (SEA_DEEP[2] - SEA_SHALLOW[2]) * t + grain * 0.6;
        // écume le long des côtes
        if (shore[i] < 1.6 * S) { r += 40; g += 40; b += 36; }
        // ombre portée des terres
        var sx = x - sh, sy = y - shy;
        if (sx >= 0 && sy >= 0 && kind[sy * gw + sx] === 1) { r *= 0.8; g *= 0.8; b *= 0.82; }
        // limites des zones de mer, en pointillés
        if (k === 2 && dist[i] < 0.6 * S && ((x + y) % Math.round(7 * S)) < 3.5 * S) {
          var o = rs.kind; var nb = [i - 1, i + 1, i - gw, i + gw].some(function (j) { return j >= 0 && j < N && o[j] === 2 && id[j] !== id[i]; });
          if (nb) { r += 38; g += 44; b += 44; }
        }
        if (k === 0) { r *= 0.92; g *= 0.92; b *= 0.94; }
      }
      d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    // décor illustré par terrain : montagnes, arbres, épis, roseaux et mares
    var deco = [];
    var STEP = { M: 8.5, F: 5.6, P: 7, Ma: 8 };
    m.terr.forEach(function (t) {
      var bk = t.biome, step = STEP[bk], a = rs.anchor['t' + t.id], bx = rs.box['t' + t.id];
      if (!bx) return;
      var x0 = rs.minX + bx.x0 / S, x1 = rs.minX + bx.x1 / S, y0 = rs.minY + bx.y0 / S, y1 = rs.minY + bx.y1 / S, n = 0;
      for (var uy = y0; uy <= y1; uy += step * 0.86) for (var ux = x0 + ((Math.round((uy - y0) / (step * 0.86)) & 1) ? step / 2 : 0); ux <= x1; ux += step) {
        n++;
        var jx = ux + (hash(n, t.id, 21) - 0.5) * step * 0.7, jy = uy + (hash(n, t.id, 22) - 0.5) * step * 0.6;
        var gx = Math.floor((jx - rs.minX) * S), gy = Math.floor((jy - rs.minY) * S);
        if (gx < 0 || gy < 0 || gx >= gw || gy >= gh) continue;
        var j = gy * gw + gx;
        if (kind[j] !== 1 || id[j] !== t.id || dist[j] < 2 * S || coastD[j] < 3 * S) continue;
        if (Math.abs(jx - a.x) < 16 && jy - a.y > -15 && jy - a.y < 21) continue;   // place pour les pions
        deco.push({ b: bk, x: (jx - rs.minX) * S, y: (jy - rs.minY) * S, r: hash(n, t.id, 23) });
      }
    });
    deco.sort(function (p, q) { return p.y - q.y; });
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    deco.forEach(function (o) { DRAW[o.b](ctx, o.x, o.y, S, o.r); });
  }

  // dessins vectoriels des terrains (x, y = pied du motif, en pixels ; k = pixels par unité)
  var DRAW = {
    M: function (c, x, y, k, r) {
      var h = (6 + r * 3.5) * k, w = (5 + r * 2) * k;
      c.fillStyle = 'rgba(60,45,35,.18)'; c.beginPath(); c.ellipse(x + 1.5 * k, y + 0.5 * k, w * 0.9, 1.6 * k, 0, 0, 7); c.fill();
      c.fillStyle = '#8c7b69'; c.beginPath(); c.moveTo(x - w, y); c.lineTo(x, y - h); c.lineTo(x + w, y); c.closePath(); c.fill();
      c.fillStyle = '#b3a38f'; c.beginPath(); c.moveTo(x - w, y); c.lineTo(x, y - h); c.lineTo(x - w * 0.12, y); c.closePath(); c.fill();
      c.fillStyle = '#f4f1ea'; c.beginPath(); c.moveTo(x - w * 0.3, y - h * 0.7); c.lineTo(x, y - h); c.lineTo(x + w * 0.3, y - h * 0.7); c.lineTo(x + w * 0.1, y - h * 0.62); c.lineTo(x - w * 0.05, y - h * 0.72); c.closePath(); c.fill();
      c.strokeStyle = '#4a3c30'; c.lineWidth = 0.9 * k; c.beginPath(); c.moveTo(x - w, y); c.lineTo(x, y - h); c.lineTo(x + w, y); c.stroke();
    },
    F: function (c, x, y, k, r) {
      var s = (2.6 + r * 1.1) * k;
      c.fillStyle = 'rgba(30,50,20,.2)'; c.beginPath(); c.ellipse(x + 1 * k, y + 0.6 * k, s * 0.9, 1.3 * k, 0, 0, 7); c.fill();
      c.strokeStyle = '#5a3d22'; c.lineWidth = 1.1 * k; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - s * 0.9); c.stroke();
      c.fillStyle = r > 0.5 ? '#3f7a34' : '#4c8a3c'; c.beginPath(); c.arc(x, y - s * 1.35, s, 0, 7); c.fill();
      c.fillStyle = 'rgba(190,230,140,.45)'; c.beginPath(); c.arc(x - s * 0.35, y - s * 1.65, s * 0.42, 0, 7); c.fill();
      c.strokeStyle = '#24461d'; c.lineWidth = 0.7 * k; c.beginPath(); c.arc(x, y - s * 1.35, s, 0, 7); c.stroke();
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

  FOF.Board = {
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
