/* Fields of Fire - adversaires contrôlés par l'ordinateur (bots), v1.9.12.
   FOF.botAct(st) renvoie UNE action pour le joueur qui doit agir.

   Réécriture complète (27/09/2026), à la demande du créateur : « ils doivent être forts au jeu ».
   Principes :
   - un PLAN par tour : la voie de victoire la plus proche (épée, foi, diplomatie), choisie sur une
     estimation du nombre de tours restant, avec un penchant pour la voie du dirigeant ;
   - une MENACE : si un adversaire approche de la victoire, tout le monde lui tombe dessus
     (temples rasés, territoires repris, capitale visée) ;
   - une économie d'abord : les cités tôt, puis l'argent va à la voie choisie ;
   - des assauts préparés : les élites convergent sur une cible et frappent ensemble quand les
     chances sont bonnes ; le dirigeant ne se risque que si l'assaut est quasi sûr ;
   - la diplomatie comme ressource : pas d'assaut qui ferait basculer en Tyran, sauf pour gagner. */
(function (FOF) {
  'use strict';
  var memo = { key: null, moved: {}, failed: {}, plan: null };
  function mem(st) {
    // identifiant stable : st.seed change à chaque tirage au sort (dés, pioche)
    var k = st.t0 + ':' + st.turnNo + ':' + st.phase;
    if (memo.key !== k) memo = { key: k, moved: {}, failed: {}, plan: null, attackTried: {} };
    return memo;
  }
  function sig(a) { return JSON.stringify(a); }
  FOF.botFailed = function (st, a) { var m = mem(st); m.failed[sig(a)] = true; m.plan = null; };
  function ok(st, a) { return !mem(st).failed[sig(a)]; }

  function T(st, id) { return st.map.terr[id]; }
  function tid(loc) { return loc && loc[0] === 't' ? +loc.slice(1) : null; }
  function bi(b) { return FOF.BIOMES.indexOf(b); }
  var WP = {};
  function winProb(delta) {
    delta = Math.max(-12, Math.min(12, delta));
    if (WP[delta] !== undefined) return WP[delta];
    var w = 0, l = 0; for (var a = 1; a <= 6; a++) for (var b = 1; b <= 6; b++) { if (a + delta > b) w++; else if (a + delta < b) l++; }
    return (WP[delta] = w + l ? w / (w + l) : 0.5);
  }
  function others(st, p) { return st.players.filter(function (q) { return q.id !== p.id && q.alive; }); }
  function pow(key, biome) { return FOF.isElite(key) ? FOF.ELITES[key].pow[bi(biome)] : 0; }
  function elites(st, p) { return FOF.army(st, p.id).filter(function (u) { return FOF.isElite(u.key); }); }
  function netIncome(st, p) { var i = FOF.income(st, p); return i.total - i.upkeep; }
  function cnt(st, p, k) { return FOF.countBld(st, p.id, k); }

  /* ---------- lecture de la partie ---------- */
  // part du chemin parcouru vers chaque victoire (1 = gagné)
  function progress(st, q) {
    var v = st.victory;
    return {
      mil: FOF.terrOf(st, q.id).length / v.mil,
      rel: cnt(st, q, 'T') / v.rel,
      dip: q.tyran ? 0 : q.dip / v.dip
    };
  }
  function bestProgress(st, q) { var g = progress(st, q); return Math.max(g.mil, g.rel, g.dip); }
  // adversaire le plus proche de la victoire, s'il devient dangereux
  function threat(st, p) {
    var worst = null, wv = 0;
    others(st, p).forEach(function (q) {
      var g = progress(st, q), v = st.victory;
      var gap = Math.min(v.mil - FOF.terrOf(st, q.id).length, v.rel - cnt(st, q, 'T'), q.tyran ? 99 : v.dip - q.dip);
      var score = bestProgress(st, q) + (gap <= 1 ? 0.5 : gap <= 2 ? 0.25 : 0);
      if (score > wv) { wv = score; worst = q; }
    });
    return wv >= 0.72 ? worst : null;
  }
  var AFFINITE = { odon: 'mil', henri: 'mil', gustave: 'mil', hugues: 'mil', alienor: 'mil', adele: 'rel', mathilde: 'rel', edouard: 'dip' };
  // estimation grossière du nombre de tours pour chaque voie ; on retient la plus courte
  function plan(st, p) {
    var m = mem(st); if (m.path) return m.path;
    var v = st.victory, terr = FOF.terrOf(st, p.id).length, inc = Math.max(1, netIncome(st, p));
    var neutres = st.map.terr.filter(function (t) { return t.ctrl === null && t.revoltFrom !== p.id; }).length;
    var force = elites(st, p).reduce(function (s, u) { return s + FOF.ELITES[u.key].pow.reduce(function (a, b) { return a + b; }, 0) / 4; }, 0);
    var tMil = (v.mil - terr) * (neutres > v.mil - terr ? 1.7 : 2.4) / (1 + force / 8);
    var tc = FOF.bldCost(st, p, 'T'), temples = cnt(st, p, 'T');
    var tRel = (v.rel - temples) * tc / (inc + 1) + Math.max(0, (v.rel - temples) - libres(st, p)) * 1.5;
    var dipRate = 0.35 + FOF.army(st, p.id).filter(function (u) { return u.key === 'heraut'; }).length + (cnt(st, p, 'A') ? 0.4 : 0) + cnt(st, p, 'Ci') * 0.12;
    var tDip = p.tyran ? 99 : (v.dip - p.dip) / dipRate;
    var t = { mil: tMil, rel: tRel, dip: tDip };
    var aff = AFFINITE[p.leader]; if (aff) t[aff] *= 0.8;
    var best = 'mil'; ['rel', 'dip'].forEach(function (k) { if (t[k] < t[best]) best = k; });
    // on garde le cap choisi au tour précédent sauf écart net (pas de zigzag)
    if (p.botPath && t[p.botPath] < t[best] * 1.3) best = p.botPath;
    p.botPath = best;
    return (m.path = best);
  }
  function libres(st, p) { return FOF.terrOf(st, p.id).reduce(function (s, t) { return s + Math.max(0, FOF.slotsOf(st, p, t.id) - t.blds.length); }, 0); }
  // défense de la case telle que le défenseur la verrait
  function defense(st, t, d, extraUnits) {
    var D = FOF.defBonus(st, d, t);
    FOF.unitsAt(st, 't' + t.id, d.id).forEach(function (u) { D += pow(u.key, t.biome); });
    if (d.lpos === 't' + t.id) D += d.mod;
    return D + (extraUnits || 0);
  }
  // puissance ennemie qui peut atteindre une case au prochain tour
  function menaceSur(st, p, t) {
    var best = 0;
    others(st, p).forEach(function (q) {
      if (p.pact === q.id) return;
      var A = 0;
      FOF.army(st, q.id).forEach(function (u) {
        if (!FOF.isElite(u.key)) return;
        var r = u.pos === 't' + t.id ? 0 : FOF.reach(st, u.pos, u, q, FOF.unitMove(st, u))['t' + t.id];
        if (r !== undefined) A += pow(u.key, t.biome) + (q.leader === 'odon' ? 1 : 0);
      });
      if (q.lpos) { var rl = q.lpos === 't' + t.id ? 0 : FOF.reach(st, q.lpos, 'L', q, 1)['t' + t.id]; if (rl !== undefined && A > 0) A += q.mod; }
      if (A > best) best = A;
    });
    return best;
  }

  /* ---------- décisions en attente ---------- */
  function valeurTerr(st, p, t) {
    var v = 1;
    t.blds.forEach(function (b) { if (b.o === p.id) v += { C: 0.5, F: 1.5, P: 1, Ci: 2.5, T: 3, A: 3 }[b.t] || 1; });
    return v;
  }
  function resolveFor(st) {
    var pd = st.pending[0], p = st.players[pd.pid];
    if (pd.type === 'conquest') {
      // dévaster si la case porte les temples d'un adversaire en course religieuse
      var t = T(st, pd.tid), d = st.players[pd.def], thr = threat(st, p);
      var tDef = t.blds.filter(function (b) { return b.t === 'T' && b.o !== p.id; }).length;
      var enCourse = thr && thr.id === d.id && progress(st, d).rel >= 0.6;
      if (tDef && enCourse && t.id !== d.capital && (p.tyran || d.tyran || p.dip >= 2 + tDef)) return { type: 'resolve', choice: 'devastate' };
      return { type: 'resolve', choice: 'conquer' };
    }
    if (pd.type === 'razeSlot') {
      var rt = T(st, pd.tid), ordre = ['C', 'P', 'F', 'Ci', 'T', 'A'], pick = 0, bv = 1e9;
      rt.blds.forEach(function (b, i) { var v = (b.o === pd.pid ? 10 : 0) + ordre.indexOf(b.t); if (v < bv) { bv = v; pick = i; } });
      return { type: 'resolve', idx: pick };
    }
    if (pd.type === 'deficit') {
      var u = FOF.army(st, pd.pid).filter(function (x) { return x.gold > 0; }).sort(function (a, b) { return valeurUnite(st, p, a) - valeurUnite(st, p, b); })[0];
      return u ? { type: 'deficitTake', uid: u.uid } : null;
    }
    // cession forcée / révolte : le territoire qui vaut le moins, loin de la capitale
    var mine = FOF.terrOf(st, p.id).filter(function (x) { return x.id !== p.capital; });
    mine.sort(function (a, b) { return valeurTerr(st, p, a) - valeurTerr(st, p, b); });
    return mine.length ? { type: 'resolve', tid: mine[0].id } : null;
  }
  function valeurUnite(st, p, u) {
    if (FOF.isElite(u.key)) return FOF.ELITES[u.key].pow.reduce(function (a, b) { return a + b; }, 0);
    return { heraut: 9, emissaire: 8, ambassadeur: 7, prelat: 7, maitre: 6 }[u.key] || 4;
  }

  /* ---------- recrutement ---------- */
  function cibles(st, p, key) {
    var f = SPECIAL_TARGET[key]; if (!f) return [];
    return st.map.terr.filter(function (t) { return f(st, p, t); });
  }
  var SPECIAL_TARGET = {
    corbeau: function (st, p, t) { return !p.tyran && others(st, p).some(function (q) { return q.capital === t.id && t.ctrl === q.id; }); },
    emissaire: function (st, p, t) { return !p.tyran && others(st, p).some(function (q) { return q.capital === t.id && t.ctrl === q.id; }); },
    ambassadeur: function (st, p, t) { return p.pact === null && !p.tyran && others(st, p).some(function (q) { return q.capital === t.id && t.ctrl === q.id && !q.tyran && q.pact === null; }); },
    pelerin: function (st, p, t) { return !p.tyran && t.blds.some(function (b) { return b.t === 'T' && b.o !== p.id; }); },
    colonie: function (st, p, t) { return t.ctrl === null && t.revoltFrom !== p.id; },
    exploratrice: function (st, p, t) { return t.ctrl === null && t.revoltFrom !== p.id && t.cont !== T(st, p.capital).cont; },
    partisan: function (st, p, t) { return t.ctrl !== null && t.ctrl !== p.id && t.blds.some(function (b) { return b.o !== p.id && b.t !== 'T'; }); },
    predicateur: function (st, p, t) { return t.ctrl !== null && t.ctrl !== p.id && t.blds.some(function (b) { return b.t === 'T' && b.o !== p.id; }); },
    caboteur: function (st, p, t) { return t.blds.some(function (b) { return b.t === 'P' && b.o !== p.id; }); },
    caravanier: function (st, p, t) { return t.blds.some(function (b) { return b.t === 'Ci' && b.o !== p.id; }); },
    calomniateur: function (st, p, t) { var q = t.ctrl !== null && t.ctrl !== p.id ? st.players[t.ctrl] : null; return !!q && q.alive && !q.tyran && q.dip > 0; },
    boutefeu: function (st, p, t) { return t.ctrl !== null && t.ctrl !== p.id && t.blds.some(function (b) { return b.t === 'Ci' && b.o !== p.id; }); },
    trebuchets: function (st, p, t) { return t.ctrl !== null && t.ctrl !== p.id && p.pact !== t.ctrl && t.blds.some(function (b) { return b.o !== p.id; }); }
  };
  function cardValue(st, p, key) {
    var path = plan(st, p), d = FOF.unitDef(key), thr = threat(st, p);
    var dipFin = !p.tyran && (st.victory.dip - p.dip) <= 3;
    if (FOF.isElite(key)) {
      var avg = d.pow.reduce(function (s, x) { return s + x; }, 0) / 4;
      var v = avg * 0.9 + (d.move - 1) * 0.5 - d.upkeep * 0.55 + 0.6;
      var n = elites(st, p).length;
      if (path === 'mil') v += 1.2; else if (path === 'dip') v -= 0.8;
      // une armée minimale, quelle que soit la voie : sans elle, impossible de freiner un rival
      if (n === 0 && st.round >= 2) v += 1.6;
      if (thr && path !== 'dip') v += 0.8;
      if (n === 0) v += 0.9;
      return v;
    }
    var has = function (k) { return cibles(st, p, k).length > 0; };
    switch (key) {
      case 'emissaire': return p.tyran ? 0 : (path === 'dip' ? 5 : 2.8) + (cnt(st, p, 'A') ? 0.6 : 0) + (dipFin ? 2 : 0);
      case 'corbeau': return p.tyran ? 0 : (path === 'dip' ? 4 : 2.2) + (dipFin ? 1.5 : 0);
      case 'heraut': return p.tyran ? 0 : (path === 'dip' ? 5.5 : 3);
      case 'pelerin': return !has('pelerin') ? 0 : (path === 'dip' ? 3.8 : 2);
      case 'ambassadeur': return has('ambassadeur') ? (path === 'dip' || path === 'rel' ? 3 : 1) + (menaceSur(st, p, T(st, p.capital)) > 3 ? 1 : 0) : 0;
      case 'colonie': return has('colonie') ? (path === 'mil' ? 4.6 : 3) : 0;
      case 'exploratrice': return has('exploratrice') ? (path === 'mil' ? 3.6 : 2.2) : 0;
      case 'partisan': return has('partisan') ? 3 : 0;
      case 'predicateur': return has('predicateur') ? (path === 'rel' ? 5 : 3) : 0;
      case 'gouverneur': return st.map.terr.some(function (t) { return t.ctrl === p.id && t.blds.some(function (b) { return b.o !== p.id && b.t !== 'T'; }); }) ? 3 : 0;
      case 'caboteur': return has('caboteur') ? 2 : 0;
      case 'caravanier': return has('caravanier') ? 2.4 : 0;
      case 'pretresse': return elites(st, p).length >= 2 ? 1.8 : 0.4;
      case 'maitre': return path === 'rel' ? 4.4 : 1.2;
      case 'prelat': return path === 'rel' ? 3.6 + cnt(st, p, 'T') * 0.5 : cnt(st, p, 'T') * 0.4;
      case 'trebuchets': return has('trebuchets') && (thr || path === 'mil') && !p.tyran && p.dip >= 3 ? 2.6 : 0.6;
      case 'espion': return 0.2;
      case 'calomniateur': return has('calomniateur') ? (thr && !thr.tyran && thr.dip >= 2 ? 3.4 : 1.4) : 0;
      case 'boutefeu': return has('boutefeu') ? (thr ? 2.6 : 1.8) : 0;
      default: return 0.5;
    }
  }
  function recruitAct(st, p) {
    if (p.flags.bought) return null;
    var inc = FOF.income(st, p), best = null, bv = 1.6;
    st.zone.forEach(function (k, i) {
      if (!k || FOF.canBuy(st, k)) return;
      var d = FOF.unitDef(k);
      if (inc.total - inc.upkeep - d.upkeep < (plan(st, p) === 'mil' ? 0 : 1)) return;   // ne jamais plomber l'économie
      var v = cardValue(st, p, k) - Math.max(0, d.upkeep - p.gold + 3) * 0.3;
      if (v > bv) { bv = v; best = i; }
    });
    if (best === null) {
      if (!p.flags.discarded) {
        // on retire du marché la carte la plus utile à celui qui mène, sinon la moins utile pour nous
        var thr = threat(st, p), worst = -1, wv = 1e9;
        st.zone.forEach(function (k, i) {
          if (!k) return;
          var v = cardValue(st, p, k) - (thr ? cardValue(st, thr, k) * 0.6 : 0);
          if (v < wv) { wv = v; worst = i; }
        });
        var dz = { type: 'discardZone', slot: worst }; if (worst >= 0 && ok(st, dz)) return dz;
      }
      return null;
    }
    var spots = FOF.deploySpots(st, st.zone[best]);
    // déployer au plus près de la cible prévue (ou sur la capitale)
    var tidx = spots.indexOf(p.capital) >= 0 ? p.capital : spots[0];
    var a = { type: 'buy', slot: best, tid: tidx };
    return ok(st, a) ? a : null;
  }

  /* ---------- militaire ---------- */
  // coût en diplomatie tolérable pour un assaut
  function peutPayer(st, p, cout, gagne) {
    if (p.tyran || cout === 0) return true;
    if (p.dip - cout >= 0) return plan(st, p) !== 'dip' || (st.victory.dip - p.dip) > 3 || gagne;
    return gagne;   // basculer en Tyran seulement pour gagner la partie
  }
  // meilleur assaut réalisable ce tour-ci (en regroupant les élites qui peuvent atteindre la cible)
  function chercherAssaut(st, p) {
    var path = plan(st, p), thr = threat(st, p), best = null, bs = 0.9;
    var army = elites(st, p).filter(function (u) { return !u.fought && !u.pacif; });
    var leaderLibre = p.lpos && !p.lFought && !p.lConq && !(p.lpos[0] === 't' && T(st, tid(p.lpos)).ctrl === null && p.lArr < st.turnNo);
    var cibl = {};
    st.map.terr.forEach(function (t) {
      if (t.ctrl === null || t.ctrl === p.id) return;
      var q = st.players[t.ctrl]; if (!q.alive) return;
      cibl['t' + t.id] = { t: t, q: q, kind: 'terr' };
    });
    Object.keys(cibl).forEach(function (loc) {
      var c = cibl[loc], t = c.t, q = c.q;
      var grp = army.filter(function (u) { return u.pos === loc || (u.movesLeft > 0 && FOF.reach(st, u.pos, u, p, u.movesLeft)[loc] !== undefined); });
      var lead = leaderLibre && (p.lpos === loc || (p.lMovesLeft > 0 && FOF.reach(st, p.lpos, 'L', p, p.lMovesLeft)[loc] !== undefined));
      if (!grp.length && !lead) return;
      var A = grp.reduce(function (s, u) { return s + pow(u.key, t.biome); }, 0) + (p.leader === 'odon' ? grp.length : 0);
      var D = defense(st, t, q);
      [false, true].forEach(function (avecChef) {
        if (avecChef && !lead) return;
        if (!avecChef && !grp.length) return;
        var a2 = A + (avecChef ? p.mod : 0), pr = winProb(a2 - D);
        var cout = q.tyran ? 0 : 1 + (p.pact === q.id ? 2 : 0);
        var capitale = t.id === q.capital;
        var gagne = path === 'mil' && FOF.terrOf(st, p.id).length + 1 >= st.victory.mil;
        if (!peutPayer(st, p, cout, gagne)) return;
        var val = (path === 'mil' ? 3 : 1.6) + valeurTerr(st, q, t) * 0.5;
        if (capitale) val += 8 + FOF.terrOf(st, q.id).length * 0.3;
        if (thr && thr.id === q.id) val += 3 + t.blds.filter(function (b) { return b.t === 'T' && b.o === q.id; }).length * 2;
        if (q.tyran) val += 1.5;
        if (p.pact === q.id) val -= 4;
        val -= cout * (path === 'dip' ? 2.5 : 0.9);
        if (gagne) val += 30;
        var perte = grp.reduce(function (s, u) { return s + FOF.unitDef(u.key).upkeep; }, 0) * 0.8 + (avecChef ? 4 : 0);
        var seuil = avecChef ? 0.78 : 0.55;
        if (pr < seuil && !gagne) return;
        var e = pr * val - (1 - pr) * perte;
        if (e > bs) { bs = e; best = { loc: loc, target: q.id, kind: 'terr', grp: grp.map(function (u) { return u.uid; }), chef: avecChef }; }
      });
    });
    return best;
  }
  function executerAssaut(st, p, pl) {
    // 1. rassembler les élites sur la case
    for (var i = 0; i < pl.grp.length; i++) {
      var u = st.units.filter(function (x) { return x.uid === pl.grp[i]; })[0];
      if (!u || u.pos === pl.loc || u.fought) continue;
      var mv = { type: 'move', piece: u.uid, to: pl.loc };
      if (ok(st, mv) && FOF.reach(st, u.pos, u, p, u.movesLeft)[pl.loc] !== undefined) return mv;
    }
    if (pl.chef && p.lpos !== pl.loc) {
      var ml = { type: 'move', piece: 'L', to: pl.loc };
      if (ok(st, ml) && FOF.reach(st, p.lpos, 'L', p, p.lMovesLeft)[pl.loc] !== undefined) return ml;
    }
    // 2. frapper (on recalcule : la défense a pu changer)
    var t = T(st, tid(pl.loc)); if (!t || t.ctrl !== pl.target) return null;
    var pv = FOF.previewAttack(st, { loc: pl.loc, target: pl.target, kind: 'terr' });
    if (!pv.att.length && !pv.lead) return null;
    var pr = winProb(pv.A - pv.D);
    if (pr < (pv.lead ? 0.7 : 0.5) && !(plan(st, p) === 'mil' && FOF.terrOf(st, p.id).length + 1 >= st.victory.mil && pr > 0.3)) return null;
    var a = { type: 'attack', loc: pl.loc, target: pl.target, kind: 'terr' };
    return ok(st, a) ? a : null;
  }
  // assaut opportuniste contre des unités isolées sur une case où l'on se trouve déjà
  function assautUnites(st, p) {
    var locs = {};
    elites(st, p).forEach(function (u) { if (!u.fought && !u.pacif) locs[u.pos] = 1; });
    var best = null, bs = 1.2;
    Object.keys(locs).forEach(function (loc) {
      FOF.attackTargets(st, loc).forEach(function (x) {
        if (x.kind !== 'units') return;
        var q = st.players[x.target]; if (p.pact === q.id) return;
        var pv = FOF.previewAttack(st, { loc: loc, target: x.target, kind: 'units' });
        if (pv.lead) return;   // on n'expose pas le dirigeant pour quelques pions
        var pr = winProb(pv.A - pv.D);
        var cout = q.tyran ? 0 : 1 + pv.du.filter(function (u) { return !FOF.isElite(u.key); }).length;
        if (!peutPayer(st, p, cout, false) || pr < 0.7) return;
        var val = pv.du.reduce(function (s, u) { return s + FOF.unitDef(u.key).upkeep + 1; }, 0) - cout * 1.2 + (q.lpos === loc ? 3 : 0);
        var e = pr * val;
        var a = { type: 'attack', loc: loc, target: x.target, kind: 'units' };
        if (e > bs && ok(st, a)) { bs = e; best = a; }
      });
    });
    return best;
  }
  function coureurDip(st, p) {
    var best = null, bv = 0;
    others(st, p).forEach(function (q) {
      if (q.tyran || p.pact === q.id) return;
      var gap = st.victory.dip - q.dip, g = progress(st, q);
      var dipCourse = gap <= 3 || (g.dip >= 0.6 && g.dip >= g.mil && g.dip >= g.rel);
      if (dipCourse && g.dip > bv) { bv = g.dip; best = q; }
    });
    // on ne se sacrifie pas si l'on est soi-même nettement plus près de gagner
    if (best && bestProgress(st, p) > bestProgress(st, best) + 0.15) return null;
    return best;
  }
  function harceler(st, p) {
    var q = coureurDip(st, p); if (!q) return null;
    var m = mem(st); if (m.harcele) return null;
    var cout = 1;
    if (!p.tyran && p.dip - cout < 0) return null;
    // en course soi-même : on ne harcèle que si le rival est devant, et qu'on n'est pas à un pas de gagner
    if (plan(st, p) === 'dip' && !p.tyran && (progress(st, p).dip >= progress(st, q).dip || st.victory.dip - p.dip <= 2)) return null;
    var army = elites(st, p).filter(function (u) { return !u.fought && !u.pacif && u.movesLeft >= 0; });
    var best = null, bs = -1;
    // cibles : ses unités spéciales diplomatiques d'abord, puis n'importe quel territoire à lui
    var locs = {};
    FOF.army(st, q.id).forEach(function (u) { if (u.pos[0] === 't' && ['emissaire', 'corbeau', 'heraut', 'pelerin', 'ambassadeur'].indexOf(u.key) >= 0) locs[u.pos] = { kind: 'units', bonus: 3 }; });
    FOF.terrOf(st, q.id).forEach(function (t) { if (!locs['t' + t.id]) locs['t' + t.id] = { kind: 'terr', bonus: 0 }; });
    Object.keys(locs).forEach(function (loc) {
      var t = T(st, tid(loc)), info = locs[loc];
      var grp = army.filter(function (u) { return u.pos === loc || (u.movesLeft > 0 && FOF.reach(st, u.pos, u, p, u.movesLeft)[loc] !== undefined); });
      if (!grp.length) return;
      var A = grp.reduce(function (s2, u) { return s2 + pow(u.key, t.biome); }, 0) + (p.leader === 'odon' ? grp.length : 0);
      var D = info.kind === 'terr' ? defense(st, t, q) : FOF.unitsAt(st, loc, q.id).reduce(function (s2, u) { return s2 + pow(u.key, t.biome); }, 0) + (q.lpos === loc ? q.mod : 0) + FOF.defBonus(st, q, t) * (t.ctrl === q.id ? 1 : 0);
      var pr = winProb(A - D);
      var sc = info.bonus + pr * 2 - grp.length * 0.1 + (info.kind === 'terr' ? 1 : 0);
      if (sc > bs) { bs = sc; best = { loc: loc, kind: info.kind, grp: grp.map(function (u) { return u.uid; }), pr: pr }; }
    });
    if (!best) return null;
    var mv = executerHarcelement(st, p, q, best);
    if (!mv) m.harcele = true;
    return mv;
  }
  function executerHarcelement(st, p, q, h) {
    for (var i = 0; i < h.grp.length; i++) {
      var u = st.units.filter(function (x) { return x.uid === h.grp[i]; })[0];
      if (!u || u.pos === h.loc || u.fought) continue;
      if (FOF.reach(st, u.pos, u, p, u.movesLeft)[h.loc] === undefined) continue;
      var mv = { type: 'move', piece: u.uid, to: h.loc }; if (ok(st, mv)) return mv;
    }
    var kind = h.kind;
    if (kind === 'units' && !FOF.unitsAt(st, h.loc, q.id).length) kind = 'terr';
    var t = T(st, tid(h.loc)); if (kind === 'terr' && (!t || t.ctrl !== q.id)) return null;
    var a = { type: 'attack', loc: h.loc, target: q.id, kind: kind };
    if (!ok(st, a)) return null;
    try { var pv = FOF.previewAttack(st, a); if (pv.lead) return null; if (!pv.att.length) return null; } catch (e) { return null; }
    mem(st).harcele = true;
    return a;
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
  function militaryAct(st, p) {
    var m = mem(st), lt = p.lpos && p.lpos[0] === 't' ? T(st, tid(p.lpos)) : null, path = plan(st, p), thr = threat(st, p);
    // 1. conquête d'un neutre par le dirigeant
    if (lt && lt.ctrl === null && lt.revoltFrom !== p.id && p.lArr < st.turnNo && !p.lMoved && !p.lFought && !p.lConq) { var c = { type: 'conquer' }; if (ok(st, c)) return c; }
    var army = FOF.army(st, p.id);
    // 2. pacification
    for (var i = 0; i < army.length; i++) {
      var u = army[i], ut = u.pos[0] === 't' ? T(st, tid(u.pos)) : null;
      if (ut && !p.flags.pacified && FOF.isElite(u.key) && ut.ctrl === p.id && ut.conqStamp < st.turnNo && u.arr < st.turnNo && !u.moved && !u.fought && ut.blds.some(function (b) { return b.o !== p.id; })) {
        var pa = { type: 'pacify', uid: u.uid, tid: ut.id }; if (ok(st, pa)) return pa;
      }
    }
    // 3. effets des unités spéciales
    for (i = 0; i < army.length; i++) {
      var su = army[i];
      if (FOF.isElite(su.key) || su.key === 'exploratrice' || !FOF.effectAvailable(st, su)) continue;
      var ea = { type: 'effect', uid: su.uid };
      if (su.key === 'trebuchets') {
        var tt = T(st, tid(su.pos)), ix = -1, br = -1;
        tt.blds.forEach(function (b, k) {
          if (b.o === p.id) return;
          var q = st.players[b.o], cout = q.tyran ? 0 : 1 + (b.t === 'T' ? 1 : 0) + (p.pact === q.id ? 2 : 0);
          if (!peutPayer(st, p, cout, false) || p.pact === q.id) return;
          var r = { Ci: 5, F: 4, T: 3, P: 2, C: 1, A: 6 }[b.t] + (thr && thr.id === q.id ? 4 : 0) + (b.t === 'T' && thr && thr.id === q.id ? 4 : 0) - cout;
          if (r > br) { br = r; ix = k; }
        });
        if (ix < 0 || br < 2) continue;
        ea.arg = ix;
      }
      if (su.key === 'calomniateur') { var vic = st.players[T(st, tid(su.pos)).ctrl]; if (vic.dip < 2 && !(thr && thr.id === vic.id)) continue; }
      if (su.key === 'ambassadeur') { var hote = others(st, p).filter(function (q) { return q.capital === tid(su.pos); })[0]; if (hote && threat(st, p) && threat(st, p).id === hote.id && path === 'mil') continue; }
      if (ok(st, ea)) return ea;
    }
    // 4. harcèlement du coureur diplomatique : une attaque, même peu sûre, lui coupe l'Ambassade et le
    //    Héraut au tour suivant ; ses émissaires en route sont des cibles de choix.
    var har = harceler(st, p); if (har) return har;
    // 5. assaut préparé
    if (!m.plan) m.plan = chercherAssaut(st, p) || false;
    if (m.plan) {
      var ex = executerAssaut(st, p, m.plan);
      if (ex) { if (ex.type === 'attack') m.plan = null; return ex; }
      m.plan = null;
      var pl2 = chercherAssaut(st, p);
      if (pl2 && !m.attackTried[pl2.loc]) { m.attackTried[pl2.loc] = 1; m.plan = pl2; var ex2 = executerAssaut(st, p, pl2); if (ex2) return ex2; m.plan = null; }
    }
    var au = assautUnites(st, p); if (au) return au;
    // 5. dirigeant : vers le neutre le plus proche, sinon rester en sécurité
    if (!m.moved.L && !p.lMoved && !p.lConq && !p.lFought && p.lMovesLeft > 0 && !(lt && lt.ctrl === null && lt.revoltFrom !== p.id)) {
      m.moved.L = true;
      var occ = function (t) { return others(st, p).some(function (q) { return q.lpos === 't' + t.id; }); };
      var neutral = st.map.terr.filter(function (t) { return t.ctrl === null && t.revoltFrom !== p.id && !occ(t); }).map(function (t) { return 't' + t.id; });
      var danger = function (loc) { var tt = loc[0] === 't' ? T(st, tid(loc)) : null; return tt && menaceSur(st, p, tt) > p.mod + 3; };
      var dest = stepToward(st, p, p.lpos, 'L', p.lMovesLeft, neutral, danger);
      if (!dest && p.lpos !== 't' + p.capital && menaceSur(st, p, T(st, p.capital)) > 0) dest = stepToward(st, p, p.lpos, 'L', p.lMovesLeft, ['t' + p.capital], null);
      if (dest) { var mv = { type: 'move', piece: 'L', to: dest }; if (ok(st, mv)) return mv; }
    }
    // 6. unités : garnison si la capitale est menacée, sinon convergence vers la prochaine cible
    var cap = T(st, p.capital), capMen = menaceSur(st, p, cap), capDef = defense(st, cap, p);
    var garde = null;
    if (capMen >= capDef - 1) {
      garde = elites(st, p).filter(function (x) { return !x.fought; }).sort(function (a, b) { return pow(b.key, cap.biome) - pow(a.key, cap.biome); })[0] || null;
    }
    var cible = prochaineCible(st, p);
    for (i = 0; i < army.length; i++) {
      u = army[i];
      if (m.moved[u.uid] || u.fought || u.pacif || u.movesLeft <= 0) continue;
      m.moved[u.uid] = true;
      var goals;
      if (garde && u.uid === garde.uid) goals = ['t' + p.capital];
      else if (FOF.isElite(u.key)) goals = cible ? [cible] : ['t' + p.capital];
      else if (u.key === 'ambassadeur') goals = cibles(st, p, 'ambassadeur').sort(function (a, b) { return menaceSur(st, p, cap) ? 0 : 0; }).map(function (t) { return 't' + t.id; });
      else if (SPECIAL_TARGET[u.key]) goals = cibles(st, p, u.key).map(function (t) { return 't' + t.id; });
      else goals = [];
      if (!goals.length || goals.indexOf(u.pos) >= 0) continue;
      // les élites s'arrêtent AU BORD de la cible (sur une case à nous ou neutre) tant que l'assaut n'est pas prêt
      var avoid = FOF.isElite(u.key) ? function (loc) { var tt = loc[0] === 't' ? T(st, tid(loc)) : null; return tt && tt.ctrl !== null && tt.ctrl !== p.id; } : null;
      var d2 = stepToward(st, p, u.pos, u, u.movesLeft, goals, avoid);
      if (d2 && avoid && avoid(d2)) d2 = null;
      if (d2) { var mu = { type: 'move', piece: u.uid, to: d2 }; if (ok(st, mu)) return mu; }
    }
    // 7. après les déplacements, nouvelle chance
    var fin = chercherAssaut(st, p);
    if (fin && !m.attackTried[fin.loc]) { m.attackTried[fin.loc] = 1; m.plan = fin; var ex3 = executerAssaut(st, p, fin); if (ex3) return ex3; m.plan = null; }
    return null;
  }
  // territoire adverse vers lequel faire converger l'armée (le leader menaçant d'abord)
  function prochaineCible(st, p) {
    var els = elites(st, p); if (!els.length) return null;
    var thr = threat(st, p), path = plan(st, p), cdip = coureurDip(st, p);
    if (cdip) thr = cdip;
    if (path === 'dip' && !thr) return null;
    var A = els.reduce(function (s, u) { return s + FOF.ELITES[u.key].pow.reduce(function (a, b) { return a + b; }, 0) / 4; }, 0);
    var best = null, bs = -1e9, base = els[0];
    var far = FOF.reach(st, base.pos, base, p, 30);
    st.map.terr.forEach(function (t) {
      if (t.ctrl === null || t.ctrl === p.id) return;
      var q = st.players[t.ctrl]; if (!q.alive || p.pact === q.id) return;
      var d = far['t' + t.id]; if (d === undefined) return;
      var D = defense(st, t, q);
      var s = (A - D) * 1.1 - d * 0.7 + (t.id === q.capital ? 2.5 : 0) + (thr && thr.id === q.id ? 4 : 0) + (q.tyran ? 1.5 : 0) + valeurTerr(st, q, t) * 0.3;
      if (s > bs) { bs = s; best = 't' + t.id; }
    });
    return best;
  }

  /* ---------- construction ---------- */
  function buildAct(st, p) {
    var path = plan(st, p), thr = threat(st, p);
    var mine = FOF.terrOf(st, p.id); if (!mine.length) return null;
    var temples = cnt(st, p, 'T'), cities = cnt(st, p, 'Ci'), forts = cnt(st, p, 'F'), camps = cnt(st, p, 'C'), ports = cnt(st, p, 'P');
    var reserve = path === 'rel' ? 0 : 1;
    var best = null, bv = 1.5;
    mine.forEach(function (t) {
      var men = menaceSur(st, p, t);
      FOF.BUILDING_ORDER.forEach(function (k) {
        if (FOF.canBuild(st, t.id, k)) return;
        var cost = FOF.bldCost(st, p, k), v = 0;
        if (p.gold - cost < 0) return;
        if (k === 'Ci') v = (st.round <= 8 ? 6 : 3.4) - cities * 0.5 + (path === 'dip' && cities < 3 ? 2 : 0);
        else if (k === 'T') v = path === 'rel' ? 7 + temples * 0.4 : (st.round > 10 ? 2.6 : 1.2) + (p.leader === 'adele' ? 1 : 0);
        else if (k === 'A') v = (p.tyran || t.id !== p.capital) ? 0 : (path === 'dip' ? 8 : 3.2);
        else if (k === 'F') v = (t.id === p.capital && men > 0 ? 5 : men > 3 ? 3 : 0.6) + (path === 'mil' && forts < 3 ? 2 : 0);
        else if (k === 'C') v = (path === 'mil' && camps < 3 ? 2.6 : 0.8) + (men > 1 ? 0.8 : 0) - camps * 0.2;
        else if (k === 'P') v = ports === 0 && (path === 'mil' || st.round > 6) && !st.map.terr.some(function (x) { return x.ctrl === null && x.cont === T(st, p.capital).cont; }) ? 3 : 0.3;
        // les emplacements rares : une cité ou un temple ne se pose pas sur une case exposée
        if ((k === 'T' || k === 'Ci') && men > FOF.defBonus(st, p, t) + 2 && t.id !== p.capital) v -= 2;
        // épargner pour la voie choisie
        if (path === 'rel' && k !== 'T' && k !== 'Ci' && p.gold - cost < FOF.bldCost(st, p, 'T')) v -= 1.5;
        if (path === 'dip' && k !== 'A' && k !== 'Ci' && !cnt(st, p, 'A') && p.gold - cost < 4) v -= 2;
        if (p.gold - cost < reserve && k !== 'T' && k !== 'A') v -= 0.8;
        if (v > bv) { bv = v; best = { type: 'build', tid: t.id, btype: k }; }
      });
    });
    if (best && ok(st, best)) return best;
    // plus de place : remplacer un aménagement modeste par un temple (voie de la foi) ou une cité
    var tc = FOF.bldCost(st, p, 'T'), cc = FOF.bldCost(st, p, 'Ci');
    var want = (path === 'rel' && p.gold >= tc) ? 'T' : (p.gold >= cc + 1 && cities < 5) ? 'Ci' : null;
    if (!want) return null;
    var RANKR = { C: 1, P: 2, F: 3, Ci: 4 }, rep = null, rr = 9;
    mine.forEach(function (t) {
      if (t.blds.some(function (b) { return b.t === want; })) return;
      t.blds.forEach(function (b, i) {
        if (b.o !== p.id || b.t === 'T' || b.t === 'A' || b.t === want || RANKR[b.t] === undefined) return;
        if (b.t === 'F' && t.id === p.capital && menaceSur(st, p, t) > 0) return;
        if (want === 'Ci' && b.t === 'Ci') return;
        var r = RANKR[b.t] + (menaceSur(st, p, t) > 2 ? 2 : 0);
        if (r < rr) { rr = r; rep = { type: 'replace', tid: t.id, idx: i, btype: want }; }
      });
    });
    return rep && rr <= (want === 'T' ? 3 : 1) && ok(st, rep) ? rep : null;
  }

  /* ---------- collecte ---------- */
  function collectAct(st, p) {
    if (p.leader === 'edouard' && !p.edouardUsed && p.dip < st.victory.dip && p.gold >= FOF.EDOUARD_COUT + 1 && !p.tyran && !p.attackedLast && !p.raidedLast && (p.dip <= 2 || plan(st, p) === 'dip' || p.gold >= 6)) return { type: 'edouard' };
    var a = null;
    FOF.army(st, p.id).forEach(function (u) { if (!a && u.key === 'exploratrice' && FOF.effectAvailable(st, u)) a = { type: 'effect', uid: u.uid }; });
    return a;
  }

  FOF.botAct = function (st) {
    if (st.winner) return null;
    if (st.pending.length) return resolveFor(st);
    var p = FOF.cur(st), a = null;
    if (st.phase === 'collect') a = collectAct(st, p);
    else if (st.phase === 'recruit') a = recruitAct(st, p);
    else if (st.phase === 'military') a = militaryAct(st, p);
    else if (st.phase === 'build') a = buildAct(st, p);
    if (a && !ok(st, a)) a = null;
    return a || { type: 'nextPhase' };
  };
  FOF.botPlan = function (st, p) { return plan(st, p); };
})(window.FOF = window.FOF || {});
