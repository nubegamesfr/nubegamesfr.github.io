/* Fields of Fire — moteur de règles (v1.1)
 * L'état de partie est un objet JSON pur ; toutes les modifications passent par FOF.act(state, action).
 * Ce découpage permettra de synchroniser les actions entre ordinateurs (Supabase Realtime) sans changer les règles. */
(function (FOF) {
  'use strict';
  var B = FOF.BUILDINGS;

  /* ---------- création ---------- */
  FOF.newGame = function (cfg) {
    var st = { v: 1, seed: cfg.seed || (Date.now() & 0x7fffffff), n: cfg.players.length };
    st.map = FOF.generateMap(st, st.n);
    st.players = cfg.players.map(function (p, i) {
      return { id: i, name: p.name, color: p.color, leader: p.leader, bot: !!p.bot, mod: FOF.LEADERS[p.leader].mod, gold: 3, dip: 3, tyran: false, tyranStamp: null,
        alive: true, capital: null, lpos: null, lArr: 0, lMoved: false, lConq: false, lFought: false, pact: null,
        attackedLast: false, attackedNow: false, flags: {} };
    });
    // v1.5 : dirigeants placés au hasard n'importe où, jamais sur deux cases voisines
    // (on garde, parmi plusieurs tirages, celui qui les écarte le plus)
    var TT = st.map.terr, W = st.map.W, best = null, bestD = -1;
    for (var tr = 0; tr < 60; tr++) {
      var pick = FOF.shuffle(st, range(TT.length)).slice(0, st.players.length), md = 99;
      for (var i1 = 0; i1 < pick.length; i1++) for (var i2 = i1 + 1; i2 < pick.length; i2++) md = Math.min(md, FOF.hexDistance(TT[pick[i1]].hex, TT[pick[i2]].hex, W));
      if (md >= 2 && md > bestD) { bestD = md; best = pick; }
    }
    if (!best) throw new Error('Placement des dirigeants impossible');
    st.players.forEach(function (p, i) { var t = TT[best[i]]; t.ctrl = p.id; p.capital = t.id; p.lpos = 't' + t.id; });
    st.units = []; st.uid = 1;
    st.deck = []; Object.keys(FOF.ELITES).concat(Object.keys(FOF.SPECIALS)).forEach(function (k) { st.deck.push(k, k); });
    FOF.shuffle(st, st.deck); st.discard = [];
    st.zone = [draw(st), draw(st), draw(st), draw(st), draw(st)];
    st.turnNo = 1; st.round = 1; st.cur = 0; st.phase = 'collect'; st.log = []; st.pending = []; st.winner = null;
    st.victory = { mil: 7 + st.n, rel: st.n === 3 ? 7 : 8, dip: 10 };
    log(st, 'Ainsi s’ouvre la chronique : ' + st.players.length + ' seigneurs se disputent ' + st.map.terr.length + ' terres.', undefined, 'start');
    startTurn(st);
    return st;
  };
  function range(n) { var a = []; for (var i = 0; i < n; i++) a.push(i); return a; }
  function draw(st) {
    if (!st.deck.length) { st.deck = st.discard; st.discard = []; FOF.shuffle(st, st.deck); }
    return st.deck.length ? st.deck.pop() : null;
  }
  function log(st, msg, pid, k) { st.logN = (st.logN || st.log.length) + 1; st.log.push({ t: st.turnNo, p: pid === undefined ? null : pid, m: msg, k: k || '' }); if (st.log.length > 80) st.log.shift(); }
  FOF.log = log;

  /* ---------- lecture ---------- */
  var T = function (st, id) { return st.map.terr[id]; };
  FOF.cur = function (st) { return st.players[st.cur]; };
  FOF.unitsAt = function (st, loc, pid) { return st.units.filter(function (u) { return u.pos === loc && (pid === undefined || u.owner === pid); }); };
  FOF.terrOf = function (st, pid) { return st.map.terr.filter(function (t) { return t.ctrl === pid; }); };
  FOF.countBld = function (st, pid, type) { var n = 0; st.map.terr.forEach(function (t) { t.blds.forEach(function (b) { if (b.o === pid && b.t === type) n++; }); }); return n; };
  FOF.army = function (st, pid) { return st.units.filter(function (u) { return u.owner === pid; }); };
  FOF.locName = function (st, loc) { return loc[0] === 't' ? T(st, +loc.slice(1)).name : 'Mer ' + ['du Nord','des Brumes','d’Argent','des Tempêtes','Pourpre','de Jade','d’Ambre','des Soupirs'][+loc.slice(1) % 8]; };
  FOF.pName = function (st, pid) { return st.players[pid].name; };

  FOF.bldCost = function (st, p, type) {
    var c = B[type].cost;
    if (type === 'Ci' && p.leader === 'gustave') c = 6;
    if (type === 'Ci' && p.leader === 'mathilde') c = 4;
    if (type === 'T' && p.leader === 'adele') c = 6;
    if (type === 'P' && p.leader === 'alienor') c = 1;
    if (p.leader === 'hugues') c = Math.max(1, c - 1);
    return c;
  };
  FOF.defBonus = function (st, p, t) {
    var d = 0;
    t.blds.forEach(function (b) {
      if (b.o !== p.id) return;
      d += B[b.t].def;
      if (p.leader === 'gustave' && (b.t === 'C' || b.t === 'F' || b.t === 'P')) d += 1;
      if (p.leader === 'mathilde' && b.t === 'Ci') d += 1;
      if (p.leader === 'adele' && b.t === 'T') d += 1;
    });
    if (t.id === p.capital && t.ctrl === p.id) d += 2;
    return d;
  };
  FOF.income = function (st, p) {
    var inc = { terr: FOF.terrOf(st, p.id).length, cities: FOF.countBld(st, p.id, 'Ci'), ports: 0, trade: 0 };
    if (p.leader === 'alienor') inc.ports = FOF.countBld(st, p.id, 'P');
    FOF.army(st, p.id).forEach(function (u) {
      if ((u.key === 'caboteur' || u.key === 'caravanier') && u.pos[0] === 't') {
        var typ = u.key === 'caboteur' ? 'P' : 'Ci';
        if (T(st, +u.pos.slice(1)).blds.some(function (b) { return b.t === typ && b.o !== p.id; })) inc.trade += 2;
      }
    });
    inc.total = inc.terr + inc.cities + inc.ports + inc.trade;
    inc.upkeep = FOF.army(st, p.id).reduce(function (a, u) { return a + FOF.unitDef(u.key).upkeep; }, 0);
    return inc;
  };
  FOF.unitMove = function (st, u) {
    var d = FOF.unitDef(u.key).move;
    if (FOF.isElite(u.key) && st.players[u.owner].leader === 'henri') d += 1;
    return d;
  };

  /* ---------- déplacement ---------- */
  function canEmbark(st, tid, piece, p) {
    var t = T(st, tid);
    if (!t.seas.length) return false;
    if (piece !== 'L' && piece.key === 'corbeau') return true;
    if (t.blds.some(function (b) { return b.t === 'P'; })) return true;
    if (piece !== 'L' && p.leader === 'alienor') {
      return t.adj.some(function (a) { return T(st, a).blds.some(function (b) { return b.t === 'P' && b.o === p.id; }); });
    }
    return false;
  }
  function neighbors(st, loc, piece, p) {
    var out = [];
    if (loc[0] === 't') {
      var t = T(st, +loc.slice(1));
      t.adj.forEach(function (a) { out.push('t' + a); });
      if (canEmbark(st, t.id, piece, p)) t.seas.forEach(function (z) { out.push('s' + z); });
    } else {
      var z = st.map.seas[+loc.slice(1)];
      z.adjT.forEach(function (a) { out.push('t' + a); });
      z.adjS.forEach(function (a) { out.push('s' + a); });
    }
    return out;
  }
  FOF.reach = function (st, from, piece, p, budget) {
    var dist = {}; dist[from] = 0; var q = [from];
    while (q.length) {
      var u = q.shift();
      if (dist[u] >= budget) continue;
      neighbors(st, u, piece, p).forEach(function (v) { if (dist[v] === undefined) { dist[v] = dist[u] + 1; q.push(v); } });
    }
    delete dist[from];
    return dist;
  };

  /* ---------- diplomatie ---------- */
  function loseDip(st, p, n, why) {
    if (p.tyran || n <= 0) return;
    if (p.dip - n < 0) {
      p.dip = 0; p.tyran = true; p.tyranStamp = st.turnNo;
      if (p.pact !== null) breakPactQuiet(st, p);
      log(st, p.name + ' renie toute parole donnée : le voici TYRAN, honni de tous !', p.id, 'tyran');
    } else { p.dip -= n; }
    if (why) log(st, p.name + ' perd ' + n + ' de diplomatie (' + why + ') ; les cours voisines murmurent.', p.id, 'dip-');
  }
  function gainDip(st, p, n, why) {
    if (p.tyran || !p.alive || n <= 0) return;
    var g = Math.min(10, p.dip + n) - p.dip; p.dip += g;
    if (g) log(st, p.name + ' gagne ' + g + ' de diplomatie (' + why + ') ; son nom s’élève dans les cours.', p.id, 'dip+');
  }
  function breakPactQuiet(st, p) {
    var q = st.players[p.pact]; if (!q) { p.pact = null; return; }
    st.units.filter(function (u) { return u.key === 'ambassadeur' && ((u.owner === p.id && u.pos === 't' + q.capital) || (u.owner === q.id && u.pos === 't' + p.capital)); })
      .forEach(function (u) { discardUnit(st, u); });
    q.pact = null; p.pact = null;
  }
  function breakPact(st, att, def) {
    log(st, att.name + ' trahit le pacte juré à ' + def.name + ' !', att.id, 'pactbreak');
    breakPactQuiet(st, att);
    loseDip(st, att, 2, 'rupture de pacte');
    gainDip(st, def, 1, 'trahi par un pacte');
  }

  /* ---------- unités ---------- */
  function discardUnit(st, u) {
    var i = st.units.indexOf(u); if (i < 0) return;
    st.units.splice(i, 1); st.discard.push(u.key);
  }
  FOF.discardUnit = discardUnit;

  /* ---------- tour ---------- */
  function startTurn(st) {
    var p = FOF.cur(st);
    p.attackedLast = p.attackedNow; p.attackedNow = false;
    p.flags = {}; p.lMoved = false; p.lConq = false; p.lFought = false;
    FOF.army(st, p.id).forEach(function (u) { u.moved = 0; u.fought = false; u.pacif = false; u.movesLeft = FOF.unitMove(st, u); });
    p.lMovesLeft = 1;
    st.phase = 'collect';
    doCollect(st, p);
  }
  function doCollect(st, p) {
    var inc = FOF.income(st, p);
    // Héraut
    if (!p.tyran && !p.attackedLast && FOF.army(st, p.id).some(function (u) { return u.key === 'heraut'; })) gainDip(st, p, 1, 'Héraut');
    var net = inc.total - inc.upkeep;
    st.collect = { inc: inc, net: net, deficit: net < 0 ? -net : 0 };
    if (net >= 0) { p.gold += net; log(st, p.name + ' lève l’impôt : ' + inc.total + ' écus récoltés, ' + inc.upkeep + ' pour la solde des troupes, +' + net + ' en coffre.', p.id, 'gold'); }
    else {
      log(st, p.name + ' lève l’impôt : ' + inc.total + ' écus, mais la solde en exige ' + inc.upkeep + ' ; il manque ' + (-net) + ' écus au trésor.', p.id, 'deficit');
      var reserve = FOF.army(st, p.id).reduce(function (a, u) { return a + u.gold; }, 0);
      if (reserve < -net) {
        // tout est perdu : toutes les unités sans assez de pièces sont défaussées
        FOF.army(st, p.id).forEach(function (u) { u.gold = 0; });
        settleDeficit(st, p);
      } else {
        st.pending.push({ type: 'deficit', pid: p.id, left: -net });
      }
    }
    checkWin(st);
  }
  function settleDeficit(st, p) {
    FOF.army(st, p.id).slice().forEach(function (u) {
      if (u.gold < FOF.unitDef(u.key).upkeep) { log(st, 'Faute de solde, les ' + FOF.unitDef(u.key).name + ' de ' + p.name + ' désertent.', p.id, 'bad'); discardUnit(st, u); }
    });
    st.collect.deficit = 0;
  }
  function nextPlayer(st) {
    var n = st.players.length, i = st.cur, wrapped = false;
    for (var k = 0; k < n; k++) {
      i = (i + 1) % n;
      if (i === 0) wrapped = true;
      if (st.players[i].alive) break;
    }
    if (wrapped) st.round++;
    st.cur = i; st.turnNo++; st.lastCombat = null; st.spy = null;
    startTurn(st);
  }
  // décisions qui se règlent seules (cession forcée de la capitale)
  function advancePending(st) {
    while (st.pending.length && !st.winner) {
      var pd = st.pending[0];
      if (pd.type === 'cedeTerritory') {
        var loser = st.players[pd.pid];
        if (!loser.alive) { st.pending.shift(); continue; }
        if (FOF.terrOf(st, loser.id).filter(function (t) { return t.id !== loser.capital; }).length === 0) {
          st.pending.shift();
          var cap = T(st, loser.capital); cap.ctrl = pd.to;
          log(st, loser.name + ', acculé en sa dernière forteresse, remet sa capitale à ' + st.players[pd.to].name + '.', loser.id, 'capfall');
          eliminate(st, loser); continue;
        }
      }
      break;
    }
  }

  /* ---------- victoire / élimination ---------- */
  function checkWin(st) {
    if (st.winner) return;
    var alive = st.players.filter(function (p) { return p.alive; });
    if (alive.length === 1) { st.winner = { pid: alive[0].id, type: 'survie' }; return; }
    // le joueur actif d'abord, puis les autres (un effet peut faire gagner quelqu'un pendant le tour d'un autre)
    var order = [st.cur].concat(range(st.players.length).filter(function (i) { return i !== st.cur; }));
    for (var k = 0; k < order.length; k++) {
      var p = st.players[order[k]]; if (!p.alive) continue;
      if (FOF.terrOf(st, p.id).length >= st.victory.mil) { st.winner = { pid: p.id, type: 'mil' }; break; }
      if (FOF.countBld(st, p.id, 'T') >= st.victory.rel) { st.winner = { pid: p.id, type: 'rel' }; break; }
      if (p.dip >= st.victory.dip) { st.winner = { pid: p.id, type: 'dip' }; break; }
    }
    if (st.winner) log(st, '★ Gloire à ' + st.players[st.winner.pid].name + ', qui l’emporte ! Les ménestrels chanteront son nom.', st.winner.pid, 'win');
  }
  FOF.checkWin = checkWin;
  function eliminate(st, p) {
    if (!p.alive) return;
    p.alive = false;
    if (p.pact !== null) { var q = st.players[p.pact]; if (q) q.pact = null; p.pact = null; }
    st.map.terr.forEach(function (t) {
      if (t.ctrl === p.id) { t.ctrl = null; t.blds = []; }
      t.blds = t.blds.filter(function (b) { return b.o !== p.id; });
    });
    FOF.army(st, p.id).slice().forEach(function (u) { discardUnit(st, u); });
    p.lpos = null;
    st.pending = st.pending.filter(function (x) { return x.pid !== p.id; });
    log(st, 'La maison de ' + p.name + ' s’éteint : ses terres retournent à la friche.', p.id, 'elim');
    checkWin(st);
    if (!st.winner && st.cur === p.id) nextPlayer(st);
  }

  /* ---------- combat ---------- */
  function d6(st) { return 1 + FOF.ri(st, 6); }
  function elitePower(st, units, biome) {
    var bi = FOF.BIOMES.indexOf(biome);
    return units.reduce(function (a, u) { return a + (FOF.isElite(u.key) ? FOF.ELITES[u.key].pow[bi] : 0); }, 0);
  }
  FOF.previewAttack = function (st, a) {
    var p = FOF.cur(st), loc = a.loc, t = loc[0] === 't' ? T(st, +loc.slice(1)) : null, d = st.players[a.target];
    var att = FOF.unitsAt(st, loc, p.id).filter(function (u) { return FOF.isElite(u.key) && !u.fought && !u.pacif; });
    // v1.5 : un dirigeant présent sur la case d'où part l'attaque s'engage de facto
    var lead = p.lpos === loc && !p.lFought && !p.lConq;
    var du = FOF.unitsAt(st, loc, d.id), dl = d.lpos === loc;
    var A, D, detA = [], detD = [];
    if (t) {
      A = elitePower(st, att, t.biome); detA.push(['Élites (' + FOF.BIOME_NAMES[t.biome] + ')', A]);
      if (lead) { A += p.mod; detA.push(['Dirigeant', p.mod]); if (p.leader === 'odon') { A += att.length; detA.push(['Odon : +1 par élite', att.length]); } }
      if (p.leader === 'alienor' && t.seas.length) { A += att.length; detA.push(['Aliénor : côte', att.length]); }
      var ep = elitePower(st, du, t.biome); D = ep; detD.push(['Élites (' + FOF.BIOME_NAMES[t.biome] + ')', ep]);
      if (dl) { D += d.mod; detD.push(['Dirigeant', d.mod]); }
      var db = FOF.defBonus(st, d, t); D += db; if (db) detD.push(['Aménagements' + (t.id === d.capital ? ' + capitale' : ''), db]);
    } else {
      A = att.length; detA.push(['Élites en mer (1 chacune)', A]);
      if (lead) { A += p.mod; detA.push(['Dirigeant', p.mod]); }
      D = du.filter(function (u) { return FOF.isElite(u.key); }).length; detD.push(['Élites en mer', D]);
      if (dl) { D += d.mod; detD.push(['Dirigeant', d.mod]); }
    }
    var cost = d.tyran ? 0 : 1; if (p.pact === d.id) cost += 2;
    return { A: A, D: D, detA: detA, detD: detD, att: att, lead: lead, du: du, dl: dl, cost: cost };
  };
  FOF.attackTargets = function (st, loc) {
    var p = FOF.cur(st), out = [];
    var att = FOF.unitsAt(st, loc, p.id).filter(function (u) { return FOF.isElite(u.key) && !u.fought && !u.pacif; });
    var leadOk = p.lpos === loc && !p.lFought && !p.lConq;
    if (!att.length && !leadOk) return out;
    if (loc[0] === 's') {
      if (p.leader !== 'alienor' || !att.length) return out;
      st.players.forEach(function (q) { if (q.id !== p.id && q.alive && FOF.unitsAt(st, loc, q.id).length) out.push({ target: q.id, kind: 'units' }); });
      return out;
    }
    var t = T(st, +loc.slice(1));
    if (t.ctrl !== null && t.ctrl !== p.id && st.players[t.ctrl].alive) out.push({ target: t.ctrl, kind: 'terr' });
    st.players.forEach(function (q) {
      if (q.id === p.id || !q.alive || q.id === t.ctrl) return;
      if (FOF.unitsAt(st, loc, q.id).length || q.lpos === loc) out.push({ target: q.id, kind: 'units' });
    });
    return out;
  };
  FOF.trebuchetFor = function (st, loc) {
    if (loc[0] !== 't') return null;
    var p = FOF.cur(st), t = T(st, +loc.slice(1));
    return FOF.army(st, p.id).filter(function (u) {
      return u.key === 'trebuchets' && !u.fought && u.pos[0] === 't' && (u.pos === loc || t.adj.indexOf(+u.pos.slice(1)) >= 0);
    })[0] || null;
  };

  function doAttack(st, a) {
    var p = FOF.cur(st), d = st.players[a.target], loc = a.loc;
    var pv = FOF.previewAttack(st, a);
    if (!pv.att.length && !pv.lead) throw new Error('Aucune unité ne peut attaquer ici.');
    var t = loc[0] === 't' ? T(st, +loc.slice(1)) : null;
    // coûts
    p.attackedNow = true;
    if (p.pact === d.id) breakPact(st, p, d);
    if (!d.tyran) loseDip(st, p, 1, 'attaque');
    var treb = a.treb ? st.units.filter(function (u) { return u.uid === a.treb; })[0] : null;
    // dés
    var aPr = FOF.unitsAt(st, loc, p.id).some(function (u) { return u.key === 'pretresse'; });
    var dPr = pv.du.some(function (u) { return u.key === 'pretresse'; });
    var rolls = [], ra, rd;
    for (;;) {
      ra = d6(st); rd = d6(st);
      var r = { a: ra, d: rd, notes: [] };
      if (pv.A + ra < pv.D + rd && aPr) { aPr = false; ra = d6(st); r.notes.push('Prêtresse : l’attaquant relance (' + ra + ')'); r.a = ra; }
      if (pv.D + rd < pv.A + ra && dPr) { dPr = false; rd = d6(st); r.notes.push('Prêtresse : le défenseur relance (' + rd + ')'); r.d = rd; }
      rolls.push(r);
      if (pv.A + ra !== pv.D + rd) break;
    }
    var win = pv.A + ra > pv.D + rd;
    var res = { loc: loc, att: p.id, def: d.id, A: pv.A, D: pv.D, detA: pv.detA, detD: pv.detD, rolls: rolls, win: win, events: [], unitsA: pv.att.map(function (u) { return u.key; }), unitsD: pv.du.map(function (u) { return u.key; }), leadA: !!pv.lead, leadD: !!pv.dl, kind: a.kind };
    // Trébuchets : destruction, quel que soit le vainqueur
    if (treb && a.trebBld !== undefined && t) {
      var b = t.blds[a.trebBld];
      if (b && b.o === d.id) {
        t.blds.splice(a.trebBld, 1);
        res.events.push('Les Trébuchets détruisent : ' + B[b.t].name + '.');
        if (b.t === 'T' && !d.tyran) loseDip(st, p, 1, 'temple détruit');
      }
      treb.fought = true;
    }
    pv.att.forEach(function (u) { u.fought = true; u.movesLeft = 0; });
    if (pv.lead) { p.lFought = true; p.lMovesLeft = 0; }
    if (win) {
      pv.du.forEach(function (u) { if (!FOF.isElite(u.key) && !d.tyran) loseDip(st, p, 1, 'unité spéciale détruite'); discardUnit(st, u); });
      res.events.push('Victoire de ' + p.name + ' !');
      if (a.kind === 'terr' && t && t.ctrl === d.id) st.pending.push({ type: 'conquest', pid: p.id, tid: t.id, def: d.id });
      if (pv.dl) leaderDefeated(st, d, p, res);
    } else {
      pv.att.forEach(function (u) { discardUnit(st, u); });
      if (treb && st.units.indexOf(treb) >= 0) discardUnit(st, treb);
      res.events.push('Victoire de ' + d.name + ' en défense.');
      if (pv.lead) leaderDefeated(st, p, d, res);
    }
    st.lastCombat = res;
    log(st, p.name + ' lance l’assaut contre ' + d.name + ' à ' + FOF.locName(st, loc) + ' : ' + (pv.A + ra) + ' contre ' + (pv.D + rd) + ' — ' + (win ? 'les assaillants l’emportent' : 'les défenseurs tiennent bon') + '.', p.id, win ? 'attackwin' : 'attacklose');
    checkWin(st);
  }
  function leaderDefeated(st, loser, winner, res) {
    loser.lpos = 't' + loser.capital; loser.lMovesLeft = 0;
    res.events.push('Le dirigeant de ' + loser.name + ' est vaincu : il retourne à sa capitale et doit céder un territoire.');
    st.pending.push({ type: 'cedeTerritory', pid: loser.id, to: winner.id });
  }

  /* ---------- effets des unités spéciales ---------- */
  FOF.effectAvailable = function (st, u) {
    var p = st.players[u.owner]; if (u.pos[0] !== 't') return null;
    var t = T(st, +u.pos.slice(1));
    var others = st.players.filter(function (q) { return q.id !== p.id && q.alive; });
    switch (u.key) {
      case 'corbeau': case 'emissaire':
        return others.some(function (q) { return q.capital === t.id && t.ctrl === q.id; }) && !p.tyran ? 'Délivrer le message' : null;
      case 'ambassadeur':
        var host = others.filter(function (q) { return q.capital === t.id && t.ctrl === q.id; })[0];
        return host && !host.tyran && !p.tyran && p.pact === null && host.pact === null ? 'Conclure un pacte avec ' + host.name : null;
      case 'pelerin': return t.blds.some(function (b) { return b.t === 'T' && b.o !== p.id; }) && !p.tyran ? 'Faire pèlerinage' : null;
      case 'colonie': return t.ctrl === null ? 'Fonder une colonie' : null;
      case 'exploratrice': return st.phase === 'collect' && t.ctrl === null && t.cont !== T(st, p.capital).cont ? 'Revendiquer ce territoire' : null;
      case 'partisan': return t.ctrl !== null && t.ctrl !== p.id && t.blds.some(function (b) { return b.o === t.ctrl && b.t !== 'T'; }) ? 'Retourner un aménagement' : null;
      case 'predicateur': return t.ctrl !== null && t.ctrl !== p.id && t.blds.some(function (b) { return b.t === 'T' && b.o !== p.id; }) ? 'Convertir le temple' : null;
      case 'gouverneur': return t.ctrl === p.id && t.blds.some(function (b) { return b.o !== p.id; }) ? 'Convertir les aménagements' : null;
    }
    return null;
  };
  function useEffect(st, u, arg) {
    var p = st.players[u.owner], t = T(st, +u.pos.slice(1)), name = FOF.unitDef(u.key).name;
    switch (u.key) {
      case 'corbeau': gainDip(st, p, 1, name); discardUnit(st, u); break;
      case 'emissaire': gainDip(st, p, 2, name); discardUnit(st, u); break;
      case 'ambassadeur':
        var host = st.players.filter(function (q) { return q.capital === t.id; })[0];
        p.pact = host.id; host.pact = p.id; log(st, p.name + ' et ' + host.name + ' scellent un pacte de non-agression.', p.id, 'pact'); break;
      case 'pelerin':
        var tb = t.blds.filter(function (b) { return b.t === 'T' && b.o !== p.id; })[0];
        gainDip(st, p, 1, name); gainDip(st, st.players[tb.o], 1, 'pèlerinage reçu'); discardUnit(st, u); break;
      case 'colonie':
        t.ctrl = p.id; t.conqStamp = st.turnNo; if (t.blds.length < 2) t.blds.push({ t: 'C', o: p.id });
        log(st, 'Des colons de ' + p.name + ' fondent un établissement à ' + t.name + '.', p.id, 'land'); discardUnit(st, u); break;
      case 'exploratrice':
        t.ctrl = p.id; t.conqStamp = st.turnNo; p.gold += 1; log(st, 'L’exploratrice de ' + p.name + ' plante sa bannière à ' + t.name + ' (+1 écu).', p.id, 'land'); discardUnit(st, u); break;
      case 'partisan':
        var cand = t.blds.map(function (b, i) { return i; }).filter(function (i) { return t.blds[i].o === t.ctrl && t.blds[i].t !== 'T'; });
        var idx = arg !== undefined && cand.indexOf(arg) >= 0 ? arg : cand[0];
        t.blds[idx].o = p.id; log(st, 'Le Partisan de ' + p.name + ' soulève ' + B[t.blds[idx].t].name.toLowerCase() + ' de ' + t.name + ' en sa faveur.', p.id, 'convert'); discardUnit(st, u); break;
      case 'predicateur':
        var tp = t.blds.filter(function (b) { return b.t === 'T' && b.o !== p.id; })[0];
        tp.o = p.id; log(st, 'Le Prédicateur de ' + p.name + ' convertit les fidèles du temple de ' + t.name + '.', p.id, 'convert'); discardUnit(st, u); break;
      case 'gouverneur':
        t.blds.forEach(function (b) { b.o = p.id; }); log(st, 'Le Gouverneur de ' + p.name + ' rallie les bâtisses de ' + t.name + '.', p.id, 'convert'); discardUnit(st, u); break;
    }
    checkWin(st);
  }

  /* ---------- validations de recrutement ---------- */
  FOF.canBuy = function (st, key) {
    var p = FOF.cur(st), def = FOF.unitDef(key), army = FOF.army(st, p.id);
    if (st.phase !== 'recruit') return 'Pas en phase de recrutement.';
    if (p.flags.bought) return 'Vous avez déjà acheté une unité ce tour.';
    if (p.flags.released) return 'Vous avez libéré une unité ce tour : achat impossible.';
    if (army.length >= 4) return 'Armée complète (4 unités).';
    var el = army.filter(function (u) { return FOF.isElite(u.key); }).length;
    if (FOF.isElite(key) && el >= 3) return 'Déjà 3 unités d’élite.';
    if (!FOF.isElite(key) && army.length - el >= 2) return 'Déjà 2 unités spéciales.';
    if (p.gold < def.upkeep) return 'Pas assez d’or (' + def.upkeep + ' requis).';
    if (def.req[0] === 'D') {
      if (p.tyran) return 'Un Tyran ne peut pas recruter cette unité.';
      if (p.dip < def.req[1]) return def.req[1] + ' de diplomatie requis.';
    } else if (FOF.countBld(st, p.id, def.req[0]) < def.req[1]) return 'Condition : ' + def.req[1] + ' × ' + B[def.req[0]].name + '.';
    if (!FOF.deploySpots(st, key).length) return 'Aucun territoire pour la déployer.';
    return null;
  };
  FOF.deploySpots = function (st, key) {
    var p = FOF.cur(st), def = FOF.unitDef(key);
    if (def.req[0] === 'D') return [p.capital];
    return FOF.terrOf(st, p.id).filter(function (t) { return t.blds.some(function (b) { return b.t === def.req[0]; }); }).map(function (t) { return t.id; });
  };
  FOF.canBuild = function (st, tid, type) {
    var p = FOF.cur(st), t = T(st, tid);
    if (st.phase !== 'build') return 'Pas en phase de construction.';
    if (t.ctrl !== p.id) return 'Ce territoire ne vous appartient pas.';
    if (t.blds.length >= 2) return 'Déjà 2 aménagements.';
    if (type !== 'C' && t.blds.some(function (b) { return b.t === type; })) return 'Déjà un ' + B[type].name.toLowerCase() + ' ici.';
    if (type === 'P' && !t.seas.length) return 'Un port doit être sur la côte.';
    if (p.gold < FOF.bldCost(st, p, type)) return 'Pas assez d’or.';
    return null;
  };

  /* ---------- point d'entrée unique ---------- */
  FOF.act = function (st, a) {
    if (st.winner) throw new Error('La partie est terminée.');
    var p = FOF.cur(st);
    var pend = st.pending[0];
    if (pend && a.type !== 'resolve' && a.type !== 'deficitTake') throw new Error('Une décision est en attente.');
    switch (a.type) {
      case 'deficitTake': {
        var u = st.units.filter(function (x) { return x.uid === a.uid; })[0];
        if (!pend || pend.type !== 'deficit' || !u || u.owner !== pend.pid || u.gold <= 0) throw new Error('Impossible.');
        u.gold--; pend.left--;
        if (pend.left <= 0) { st.pending.shift(); settleDeficit(st, p); }
        break;
      }
      case 'resolve': resolvePending(st, a); break;
      case 'nextPhase': {
        var order = ['collect', 'recruit', 'military', 'build'];
        var i = order.indexOf(st.phase);
        if (i < 3) { st.phase = order[i + 1]; if (st.phase === 'recruit') st.spy = null; }
        else endTurn(st);
        break;
      }
      case 'edouard':
        if (p.leader !== 'edouard' || st.phase !== 'collect' || p.flags.edouard || p.dip > 3 || p.gold < 3 || p.tyran) throw new Error('Pouvoir indisponible.');
        p.gold -= 3; p.flags.edouard = true; gainDip(st, p, 1, 'Edouard le Sage'); checkWin(st); break;
      case 'discardZone':
        if (st.phase !== 'recruit' || p.flags.discarded || p.flags.bought) throw new Error('Défausse impossible.');
        st.discard.push(st.zone[a.slot]); st.zone[a.slot] = draw(st); p.flags.discarded = true;
        log(st, p.name + ' congédie un mercenaire du marché.', p.id, 'card'); break;
      case 'spy':
        if (st.phase !== 'recruit' || p.flags.spied || p.gold < 1 || !FOF.army(st, p.id).some(function (x) { return x.key === 'espion'; })) throw new Error('Espion indisponible.');
        if (!st.deck.length) { st.deck = st.discard; st.discard = []; FOF.shuffle(st, st.deck); }
        p.gold -= 1; p.flags.spied = true; st.spy = { pid: p.id, key: st.deck[st.deck.length - 1] }; break;
      case 'buy': {
        var key = st.zone[a.slot], err = FOF.canBuy(st, key);
        if (err) throw new Error(err);
        if (FOF.deploySpots(st, key).indexOf(a.tid) < 0) throw new Error('Déploiement impossible ici.');
        var def = FOF.unitDef(key);
        p.gold -= def.upkeep;
        var nu = { uid: st.uid++, key: key, owner: p.id, pos: 't' + a.tid, gold: def.upkeep, arr: st.turnNo, moved: 0, fought: false, pacif: false };
        nu.movesLeft = FOF.unitMove(st, nu);
        st.units.push(nu); st.zone[a.slot] = draw(st); p.flags.bought = true;
        log(st, p.name + ' enrôle des ' + def.name + ' à ' + T(st, a.tid).name + '.', p.id, 'recruit'); break;
      }
      case 'release': {
        var ur = st.units.filter(function (x) { return x.uid === a.uid && x.owner === p.id; })[0];
        if (!ur || st.phase !== 'recruit' || p.flags.bought) throw new Error('Libération impossible.');
        log(st, p.name + ' libère ses ' + FOF.unitDef(ur.key).name + ' de leur serment.', p.id, 'card');
        discardUnit(st, ur); p.flags.released = true; break;
      }
      case 'move': {
        if (st.phase !== 'military') throw new Error('Déplacements en phase militaire.');
        if (a.piece === 'L') {
          if (p.lConq || p.lFought || p.lMovesLeft <= 0) throw new Error('Votre dirigeant ne peut plus bouger.');
          var rl = FOF.reach(st, p.lpos, 'L', p, p.lMovesLeft);
          if (rl[a.to] === undefined) throw new Error('Case hors de portée.');
          p.lMovesLeft -= rl[a.to]; p.lpos = a.to; p.lArr = st.turnNo; p.lMoved = true;
        } else {
          var mu = st.units.filter(function (x) { return x.uid === a.piece && x.owner === p.id; })[0];
          if (!mu || mu.fought || mu.pacif || mu.movesLeft <= 0) throw new Error('Cette unité ne peut plus bouger.');
          var ru = FOF.reach(st, mu.pos, mu, p, mu.movesLeft);
          if (ru[a.to] === undefined) throw new Error('Case hors de portée.');
          mu.movesLeft -= ru[a.to]; mu.pos = a.to; mu.arr = st.turnNo; mu.moved++;
        }
        break;
      }
      case 'conquer': {
        var lt = p.lpos && p.lpos[0] === 't' ? T(st, +p.lpos.slice(1)) : null;
        if (st.phase !== 'military' || !lt || lt.ctrl !== null || p.lArr >= st.turnNo || p.lMoved || p.lFought) throw new Error('Conquête impossible : le dirigeant doit être sur ce territoire neutre depuis votre tour précédent, sans bouger.');
        lt.ctrl = p.id; lt.conqStamp = st.turnNo; p.lConq = true; p.lMovesLeft = 0;
        log(st, p.name + ' plante sa bannière sur ' + lt.name + '.', p.id, 'conquer'); checkWin(st); break;
      }
      case 'attack': if (st.phase !== 'military') throw new Error('Attaques en phase militaire.'); doAttack(st, a); break;
      case 'pacify': {
        var pt = T(st, a.tid), el2 = st.units.filter(function (x) { return x.uid === a.uid && x.owner === p.id; })[0];
        if (st.phase !== 'military' || pt.ctrl !== p.id || !(pt.conqStamp < st.turnNo) || !el2 || !FOF.isElite(el2.key) || el2.pos !== 't' + pt.id || el2.arr >= st.turnNo || el2.moved || el2.fought || !pt.blds.some(function (b) { return b.o !== p.id; }))
          throw new Error('Pacification impossible : une élite doit être en garnison ici depuis votre tour précédent.');
        pt.blds.forEach(function (b) { b.o = p.id; }); el2.pacif = true; el2.movesLeft = 0;
        log(st, p.name + ' pacifie ' + pt.name + ' : ses habitants se rallient.', p.id, 'convert'); checkWin(st); break;
      }
      case 'effect': {
        var eu = st.units.filter(function (x) { return x.uid === a.uid && x.owner === p.id; })[0];
        if (!eu || !FOF.effectAvailable(st, eu)) throw new Error('Effet indisponible.');
        if (st.phase !== 'military' && !(eu.key === 'exploratrice' && st.phase === 'collect')) throw new Error('Les effets se jouent en phase militaire.');
        useEffect(st, eu, a.arg); break;
      }
      case 'build': {
        var e2 = FOF.canBuild(st, a.tid, a.btype); if (e2) throw new Error(e2);
        var c = FOF.bldCost(st, p, a.btype); p.gold -= c; T(st, a.tid).blds.push({ t: a.btype, o: p.id });
        log(st, p.name + ' fait élever ' + B[a.btype].name.toLowerCase() + ' à ' + T(st, a.tid).name + ' (' + c + ' écus).', p.id, 'build'); checkWin(st); break;
      }
      case 'replace': {
        var rt = T(st, a.tid), old = rt.blds[a.idx];
        if (st.phase !== 'build' || rt.ctrl !== p.id || !old || old.o !== p.id || old.t === a.btype) throw new Error('Remplacement impossible.');
        if (a.btype !== 'C' && rt.blds.some(function (b, i) { return i !== a.idx && b.t === a.btype; })) throw new Error('Déjà présent sur ce territoire.');
        if (a.btype === 'P' && !rt.seas.length) throw new Error('Un port doit être sur la côte.');
        var rc = FOF.bldCost(st, p, a.btype); if (p.gold < rc) throw new Error('Pas assez d’or.');
        p.gold -= rc; rt.blds[a.idx] = { t: a.btype, o: p.id };
        log(st, p.name + ' fait raser ' + B[old.t].name.toLowerCase() + ' de ' + rt.name + ' pour y élever ' + B[a.btype].name.toLowerCase() + '.', p.id, 'build'); checkWin(st); break;
      }
      case 'moveCapital': {
        var ct = T(st, a.tid);
        if (st.phase !== 'build' || ct.ctrl !== p.id || ct.id === p.capital || p.gold < 10) throw new Error('Déplacement de capitale impossible.');
        p.gold -= 10; p.capital = ct.id; log(st, p.name + ' transfère sa cour à ' + ct.name + '.', p.id, 'build'); break;
      }
      case 'cede': {
        var cdt = T(st, a.tid);
        if (st.phase !== 'build' || cdt.ctrl === null || cdt.ctrl === p.id || !cdt.blds.some(function (b) { return b.o === p.id; }) || p.tyran) throw new Error('Cession impossible.');
        cdt.blds.forEach(function (b) { if (b.o === p.id) b.o = cdt.ctrl; });
        log(st, p.name + ' remet ses bâtisses de ' + cdt.name + ' à ' + st.players[cdt.ctrl].name + ', en gage de paix.', p.id, 'cede');
        gainDip(st, p, 1, 'cession'); checkWin(st); break;
      }
      default: throw new Error('Action inconnue : ' + a.type);
    }
    advancePending(st);
    return st;
  };

  function resolvePending(st, a) {
    var pend = st.pending[0]; if (!pend) throw new Error('Aucune décision en attente.');
    if (pend.type === 'conquest') {
      var t = T(st, pend.tid), att = st.players[pend.pid], def = st.players[pend.def];
      st.pending.shift();
      if (a.choice === 'devastate') {
        var temples = t.blds.filter(function (b) { return b.t === 'T' && b.o !== att.id; }).length;
        if (!def.tyran) { loseDip(st, att, 1, 'dévastation'); if (temples) loseDip(st, att, temples, 'temple détruit'); }
        t.ctrl = null; t.blds = [];
        log(st, att.name + ' met ' + t.name + ' à sac : il n’en reste que cendres.', att.id, 'devastate');
      } else {
        t.ctrl = att.id; t.conqStamp = st.turnNo;
        log(st, att.name + ' s’empare de ' + t.name + '.', att.id, 'conquer');
      }
      if (def.alive && t.id === def.capital && a.choice !== 'keep') { log(st, 'La capitale de ' + def.name + ' est tombée !', def.id, 'capfall'); eliminate(st, def); }
      checkWin(st);
    } else if (pend.type === 'cedeTerritory') {
      var loser = st.players[pend.pid], t2 = T(st, a.tid);
      if (t2.ctrl !== loser.id || t2.id === loser.capital) throw new Error('Choisissez un de vos territoires, hors capitale.');
      st.pending.shift();
      t2.ctrl = pend.to; t2.conqStamp = st.turnNo;
      log(st, 'Vaincu, ' + loser.name + ' abandonne ' + t2.name + ' à ' + st.players[pend.to].name + '.', loser.id, 'cedeterr');
      checkWin(st);
    } else if (pend.type === 'revolt') {
      var ty = st.players[pend.pid], t3 = T(st, a.tid);
      if (t3.ctrl !== ty.id || t3.id === ty.capital) throw new Error('Choisissez un territoire hors capitale.');
      st.pending.shift();
      t3.ctrl = null; t3.blds = [];
      log(st, 'Le peuple de ' + t3.name + ' se soulève contre le tyran ' + ty.name + ' et chasse ses baillis.', ty.id, 'revolt');
      nextPlayer(st);
    } else throw new Error('Décision inconnue.');
  }

  function endTurn(st) {
    var p = FOF.cur(st);
    if (p.tyran && st.turnNo > p.tyranStamp) {
      var own = FOF.terrOf(st, p.id).filter(function (t) { return t.id !== p.capital; });
      if (!own.length) { log(st, 'La capitale du tyran ' + p.name + ' se soulève : son règne s’achève.', p.id, 'revolt'); eliminate(st, p); return; }
      st.pending.push({ type: 'revolt', pid: p.id });
      return;
    }
    nextPlayer(st);
  }
})(window.FOF = window.FOF || {});
