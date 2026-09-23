/* Fields of Fire — adversaires contrôlés par l'ordinateur (bots).
   FOF.botAct(st) renvoie UNE action à jouer pour le joueur qui doit agir (ou null).
   Heuristiques simples : conquérir les neutres avec le dirigeant, recruter des élites rentables,
   attaquer quand les chances sont bonnes, bâtir cités / temples / forts, ne pas devenir Tyran à la légère. */
(function (FOF) {
  'use strict';
  var memo = { key: null, moved: {}, failed: {} };
  function mem(st) {
    var k = st.seed + ':' + st.turnNo + ':' + st.phase;
    if (memo.key !== k) memo = { key: k, moved: {}, failed: {} };
    return memo;
  }
  function sig(a) { return JSON.stringify(a); }
  FOF.botFailed = function (st, a) { mem(st).failed[sig(a)] = true; };
  function ok(st, a) { return !mem(st).failed[sig(a)]; }

  function T(st, id) { return st.map.terr[id]; }
  function tid(loc) { return loc && loc[0] === 't' ? +loc.slice(1) : null; }
  function bi(b) { return FOF.BIOMES.indexOf(b); }
  function winProb(delta) { var w = 0, l = 0; for (var a = 1; a <= 6; a++) for (var b = 1; b <= 6; b++) { if (a + delta > b) w++; else if (a + delta < b) l++; } return w + l ? w / (w + l) : 0.5; }
  function others(st, p) { return st.players.filter(function (q) { return q.id !== p.id && q.alive; }); }
  function enemyTerr(st, p, t) { return t.ctrl !== null && t.ctrl !== p.id && st.players[t.ctrl].alive && p.pact !== t.ctrl; }
  function elitePow(st, units, biome) { return units.reduce(function (s, u) { return s + (FOF.isElite(u.key) ? FOF.unitDef(u.key).pow[bi(biome)] : 0); }, 0); }
  function estDef(st, t) {
    var d = st.players[t.ctrl], D = FOF.defBonus(st, d, t) + elitePow(st, FOF.unitsAt(st, 't' + t.id, d.id), t.biome);
    if (d.lpos === 't' + t.id) D += d.mod;
    return D;
  }

  // meilleure case atteignable ce tour pour se rapprocher d'une des cibles
  function stepToward(st, p, from, obj, budget, targets, avoid) {
    if (!targets.length || budget <= 0) return null;
    var far = FOF.reach(st, from, obj, p, 40); far[from] = 0;
    var best = null, bd = 1e9;
    targets.forEach(function (tl) { if (far[tl] !== undefined && far[tl] < bd) { bd = far[tl]; best = tl; } });
    if (!best || best === from) return null;
    var now = FOF.reach(st, from, obj, p, budget), pick = null, pd = bd;
    Object.keys(now).forEach(function (c) {
      if (avoid && avoid(c) && c !== best) return;
      var d = c === best ? 0 : FOF.reach(st, c, obj, p, 40)[best];
      if (d === undefined) return;
      if (d < pd || (d === pd && pick && pick[0] === 's' && c[0] === 't')) { pd = d; pick = c; }
    });
    return pick;
  }

  var SPECIAL_TARGET = {
    corbeau: function (st, p, t) { return !p.tyran && others(st, p).some(function (q) { return q.capital === t.id && t.ctrl === q.id; }); },
    emissaire: function (st, p, t) { return !p.tyran && others(st, p).some(function (q) { return q.capital === t.id && t.ctrl === q.id; }); },
    ambassadeur: function (st, p, t) { return p.pact === null && !p.tyran && others(st, p).some(function (q) { return q.capital === t.id && t.ctrl === q.id && !q.tyran && q.pact === null; }); },
    pelerin: function (st, p, t) { return !p.tyran && t.blds.some(function (b) { return b.t === 'T' && b.o !== p.id; }); },
    colonie: function (st, p, t) { return t.ctrl === null; },
    exploratrice: function (st, p, t) { return t.ctrl === null && t.cont !== T(st, p.capital).cont; },
    partisan: function (st, p, t) { return enemyTerr(st, p, t) && t.blds.some(function (b) { return b.o === t.ctrl && b.t !== 'T'; }); },
    predicateur: function (st, p, t) { return enemyTerr(st, p, t) && t.blds.some(function (b) { return b.t === 'T' && b.o !== p.id; }); },
    gouverneur: function (st, p, t) { return t.ctrl === p.id && t.blds.some(function (b) { return b.o !== p.id; }); },
    caboteur: function (st, p, t) { return t.blds.some(function (b) { return b.t === 'P' && b.o !== p.id; }); },
    caravanier: function (st, p, t) { return t.blds.some(function (b) { return b.t === 'Ci' && b.o !== p.id; }); }
  };

  /* ---------- décisions en attente ---------- */
  function resolveFor(st) {
    var pd = st.pending[0], p = st.players[pd.pid];
    if (pd.type === 'conquest') return { type: 'resolve', choice: 'conquer' };
    if (pd.type === 'deficit') {
      var u = FOF.army(st, pd.pid).filter(function (x) { return x.gold > 0; }).sort(function (a, b) { return FOF.unitDef(a.key).upkeep - FOF.unitDef(b.key).upkeep; })[0];
      return u ? { type: 'deficitTake', uid: u.uid } : null;
    }
    // céder / révolte : le territoire qui vaut le moins
    var mine = FOF.terrOf(st, p.id).filter(function (t) { return t.id !== p.capital; });
    mine.sort(function (a, b) { return a.blds.filter(function (x) { return x.o === p.id; }).length - b.blds.filter(function (x) { return x.o === p.id; }).length; });
    return mine.length ? { type: 'resolve', tid: mine[0].id } : null;
  }

  /* ---------- recrutement ---------- */
  function cardValue(st, p, key) {
    var d = FOF.unitDef(key);
    if (FOF.isElite(key)) { var avg = d.pow.reduce(function (s, v) { return s + v; }, 0) / 4; return avg + (d.move - 1) * 0.6 - d.upkeep * 0.45 + 0.8; }
    var anyT = function (k) { return st.map.terr.some(function (t) { return SPECIAL_TARGET[k](st, p, t); }); };
    switch (key) {
      case 'emissaire': return p.tyran ? 0 : 3.2;
      case 'corbeau': return p.tyran ? 0 : 2.6;
      case 'heraut': return p.tyran ? 0 : 3;
      case 'colonie': return anyT('colonie') ? 2.6 : 0;
      case 'exploratrice': return anyT('exploratrice') ? 2.2 : 0;
      case 'partisan': return anyT('partisan') ? 2.2 : 0;
      case 'predicateur': return anyT('predicateur') ? 2.6 : 0;
      case 'pelerin': return anyT('pelerin') ? 2 : 0;
      case 'gouverneur': return anyT('gouverneur') ? 2.4 : 0;
      case 'caboteur': return anyT('caboteur') ? 1.8 : 0;
      case 'caravanier': return anyT('caravanier') ? 1.8 : 0;
      case 'ambassadeur': return anyT('ambassadeur') ? 1.5 : 0;
      case 'pretresse': return 1.2;
      default: return 0.5;
    }
  }
  function recruitAct(st, p) {
    if (p.flags.bought) return null;
    var inc = FOF.income(st, p), best = null, bv = 1.9;
    st.zone.forEach(function (k, i) {
      if (!k || FOF.canBuy(st, k)) return;
      var d = FOF.unitDef(k);
      if (p.gold - d.upkeep < 1 && st.round > 2) return;              // garder une petite réserve
      if (inc.total - inc.upkeep - d.upkeep < -1) return;                // ne pas plomber les revenus
      var v = cardValue(st, p, k); if (v > bv) { bv = v; best = i; }
    });
    if (best === null) {
      // rien d'intéressant : on fait tourner le marché
      if (!p.flags.discarded) {
        var worst = -1, wv = 1e9;
        st.zone.forEach(function (k, i) { if (!k) return; var v = FOF.canBuy(st, k) ? -1 : cardValue(st, p, k); if (v < wv) { wv = v; worst = i; } });
        var dz = { type: 'discardZone', slot: worst }; if (worst >= 0 && ok(st, dz)) return dz;
      }
      return null;
    }
    var spots = FOF.deploySpots(st, st.zone[best]);
    var tidx = spots.indexOf(p.capital) >= 0 ? p.capital : spots[0];
    var a = { type: 'buy', slot: best, tid: tidx };
    return ok(st, a) ? a : null;
  }

  /* ---------- militaire ---------- */
  function attackAct(st, p) {
    var locs = {}; if (p.lpos && !p.lFought && !p.lConq) locs[p.lpos] = 1;
    FOF.army(st, p.id).forEach(function (u) { if (FOF.isElite(u.key) && !u.fought && !u.pacif) locs[u.pos] = 1; });
    var best = null, bs = 0;
    Object.keys(locs).forEach(function (loc) {
      FOF.attackTargets(st, loc).forEach(function (x) {
        var q = st.players[x.target]; if (p.pact === q.id) return;
        var pv = FOF.previewAttack(st, { loc: loc, target: x.target, kind: x.kind });
        var pr = winProb(pv.A - pv.D), need = pv.lead ? 0.72 : 0.6;
        if (x.kind === 'units') need += 0.08;
        if (pr < need) return;
        if (!p.tyran && pv.cost > 0 && p.dip - pv.cost < 0) return;     // éviter de devenir Tyran
        var t = loc[0] === 't' ? T(st, tid(loc)) : null;
        var val = x.kind === 'terr' ? 2 + (t && t.id === q.capital ? 4 : 0) + (t ? t.blds.length * 0.5 : 0) : 1;
        if (q.tyran) val += 1;
        var sc = pr * val;
        var a = { type: 'attack', loc: loc, target: x.target, kind: x.kind };
        if (sc > bs && ok(st, a)) { bs = sc; best = a; }
      });
    });
    return best;
  }
  function militaryAct(st, p) {
    var m = mem(st), lt = p.lpos && p.lpos[0] === 't' ? T(st, tid(p.lpos)) : null;
    // 1. conquête d'un neutre
    if (lt && lt.ctrl === null && p.lArr < st.turnNo && !p.lMoved && !p.lFought && !p.lConq) { var c = { type: 'conquer' }; if (ok(st, c)) return c; }
    var army = FOF.army(st, p.id);
    // 2. pacification
    for (var i = 0; i < army.length; i++) {
      var u = army[i], ut = u.pos[0] === 't' ? T(st, tid(u.pos)) : null;
      if (ut && FOF.isElite(u.key) && ut.ctrl === p.id && ut.conqStamp < st.turnNo && u.arr < st.turnNo && !u.moved && !u.fought && ut.blds.some(function (b) { return b.o !== p.id; })) {
        var pa = { type: 'pacify', uid: u.uid, tid: ut.id }; if (ok(st, pa)) return pa;
      }
    }
    // 3. effets des unités spéciales
    for (i = 0; i < army.length; i++) {
      if (FOF.isElite(army[i].key) || army[i].key === 'exploratrice' || !FOF.effectAvailable(st, army[i])) continue;
      var ea = { type: 'effect', uid: army[i].uid };
      if (army[i].key === 'partisan') { var tt = T(st, tid(army[i].pos)), ix = -1, bestRank = -1, RANK = { Ci: 4, F: 3, P: 2, C: 1 }; tt.blds.forEach(function (b, k) { if (b.o === tt.ctrl && b.t !== 'T' && RANK[b.t] > bestRank) { bestRank = RANK[b.t]; ix = k; } }); ea.arg = ix; }
      if (ok(st, ea)) return ea;
    }
    // 4. attaques favorables
    var at = attackAct(st, p); if (at) return at;
    // 5. déplacements
    // 5a. dirigeant : vers le territoire neutre le plus proche (il reste sur un neutre pour le prendre au tour suivant)
    if (!m.moved.L && !p.lMoved && !p.lConq && !p.lFought && p.lMovesLeft > 0 && !(lt && lt.ctrl === null)) {
      m.moved.L = true;
      var neutral = st.map.terr.filter(function (t) { return t.ctrl === null && !others(st, p).some(function (q) { return q.lpos === 't' + t.id; }); }).map(function (t) { return 't' + t.id; });
      var danger = function (loc) { return st.units.some(function (x) { return x.pos === loc && x.owner !== p.id && FOF.isElite(x.key); }); };
      var dest = stepToward(st, p, p.lpos, 'L', p.lMovesLeft, neutral, danger);
      if (dest) { var mv = { type: 'move', piece: 'L', to: dest }; if (ok(st, mv)) return mv; }
    }
    // 5b. unités
    var elites = army.filter(function (u) { return FOF.isElite(u.key); });
    var target = null;
    if (elites.length) {
      var bestS = -1e9;
      st.map.terr.forEach(function (t) {
        if (!enemyTerr(st, p, t)) return;
        var q = st.players[t.ctrl]; if (!p.tyran && !q.tyran && p.dip < 1) return;
        var A = elitePow(st, elites, t.biome), D = estDef(st, t);
        var far = FOF.reach(st, elites[0].pos, elites[0], p, 12)['t' + t.id];
        if (far === undefined) return;
        var s = (A - D) * 1.2 - far * 0.8 + (t.id === q.capital ? 2 : 0) + t.blds.length * 0.3 + (q.tyran ? 1.5 : 0);
        if (A - D >= 1 && s > bestS) { bestS = s; target = 't' + t.id; }
      });
    }
    for (i = 0; i < army.length; i++) {
      u = army[i];
      if (m.moved[u.uid] || u.fought || u.pacif || u.movesLeft <= 0) continue;
      m.moved[u.uid] = true;
      var goals;
      if (FOF.isElite(u.key)) goals = target ? [target] : ['t' + p.capital];
      else if (SPECIAL_TARGET[u.key]) goals = st.map.terr.filter(function (t) { return SPECIAL_TARGET[u.key](st, p, t); }).map(function (t) { return 't' + t.id; });
      else goals = [];
      if (goals.indexOf(u.pos) >= 0) continue;
      var d2 = stepToward(st, p, u.pos, u, u.movesLeft, goals, null);
      if (d2) { var mu = { type: 'move', piece: u.uid, to: d2 }; if (ok(st, mu)) return mu; }
    }
    // 6. après les déplacements, nouvelle chance d'attaquer
    return attackAct(st, p);
  }

  /* ---------- construction ---------- */
  function buildAct(st, p) {
    // céder ses aménagements en terre étrangère : +1 diplomatie
    if (!p.tyran) {
      var cd = st.map.terr.filter(function (t) { return t.ctrl !== null && t.ctrl !== p.id && t.blds.some(function (b) { return b.o === p.id; }) && !t.blds.some(function (b) { return b.o === p.id && b.t === 'T'; }); })[0];
      if (cd) { var ca = { type: 'cede', tid: cd.id }; if (ok(st, ca)) return ca; }
    }
    var mine = FOF.terrOf(st, p.id); if (!mine.length) return null;
    var cnt = function (k) { return FOF.countBld(st, p.id, k); };
    var temples = cnt('T'), cities = cnt('Ci'), forts = cnt('F'), camps = cnt('C'), ports = cnt('P');
    var enemyNear = function (t) { return t.adj.some(function (j) { var o = T(st, j).ctrl; return o !== null && o !== p.id; }); };
    var best = null, bv = 1.6;
    mine.forEach(function (t) {
      FOF.BUILDING_ORDER.forEach(function (k) {
        if (FOF.canBuild(st, t.id, k)) return;
        var cost = FOF.bldCost(st, p, k), v = 0;
        if (k === 'Ci') v = (st.round < 14 ? 5.2 : 2.5) - cities * 0.45;
        else if (k === 'T') v = 2.4 + temples * 0.9 + (p.leader === 'adele' ? 1.5 : 0) + (st.round > 6 ? 0.8 : 0) + (p.gold > 15 ? 3 : 0);
        else if (k === 'F') v = (t.id === p.capital ? 3.6 : enemyNear(t) ? 2.6 : 1.4) + (forts < 3 ? 0.8 : 0);
        else if (k === 'C') v = camps < 5 ? 2.6 - camps * 0.25 : 1;
        else if (k === 'P') v = ports === 0 ? 2.2 : 0.6;
        if (k === 'T' || k === 'Ci') v += enemyNear(t) ? -0.8 : 0.4;
        // garder de quoi viser un temple quand on en approche
        if (k !== 'T' && temples >= 3 && p.gold - cost < FOF.bldCost(st, p, 'T')) v -= 1;
        if (p.gold - cost < 0) return;
        if (v > bv) { bv = v; best = { type: 'build', tid: t.id, btype: k }; }
      });
    });
    if (best && ok(st, best)) return best;
    // plus de place : remplacer un campement / port / fort par un temple (ou une cité) quand on en a les moyens
    var tc = FOF.bldCost(st, p, 'T'), cc = FOF.bldCost(st, p, 'Ci'), RANKR = { C: 1, P: 2, F: 3, Ci: 4 };
    var want = p.gold >= tc ? 'T' : (p.gold >= cc && cities < 4 ? 'Ci' : null);
    if (!want) return null;
    var rep = null, rr = 9;
    mine.forEach(function (t) {
      if (want !== 'C' && t.blds.some(function (b) { return b.t === want; })) return;
      t.blds.forEach(function (b, i) {
        if (b.o !== p.id || b.t === 'T' || b.t === want) return;
        if (b.t === 'F' && t.id === p.capital) return;
        var r = RANKR[b.t] + (enemyNear(t) ? 1 : 0);
        if (r < rr) { rr = r; rep = { type: 'replace', tid: t.id, idx: i, btype: want }; }
      });
    });
    return rep && ok(st, rep) ? rep : null;
  }

  FOF.botAct = function (st) {
    if (st.winner) return null;
    if (st.pending.length) return resolveFor(st);
    var p = FOF.cur(st), a = null;
    if (st.phase === 'collect') {
      if (p.leader === 'edouard' && !p.flags.edouard && p.dip <= 3 && p.gold >= 6 && !p.tyran) a = { type: 'edouard' };
      if (!a) FOF.army(st, p.id).forEach(function (u) { if (!a && u.key === 'exploratrice' && FOF.effectAvailable(st, u)) a = { type: 'effect', uid: u.uid }; });
    } else if (st.phase === 'recruit') a = recruitAct(st, p);
    else if (st.phase === 'military') a = militaryAct(st, p);
    else if (st.phase === 'build') a = buildAct(st, p);
    if (a && !ok(st, a)) a = null;
    return a || { type: 'nextPhase' };
  };
})(window.FOF = window.FOF || {});
