/* Fields of Fire - moteur de règles (v1.1)
 * L'état de partie est un objet JSON pur ; toutes les modifications passent par FOF.act(state, action).
 * Ce découpage permettra de synchroniser les actions entre ordinateurs (Supabase Realtime) sans changer les règles. */
(function (FOF) {
  'use strict';
  var B = FOF.BUILDINGS;

  /* ---------- création ---------- */
  FOF.newGame = function (cfg) {
    var st = { v: 1, seed: cfg.seed || (Date.now() & 0x7fffffff), n: cfg.players.length, t0: Date.now(), tLast: Date.now(),
      wideSea: true };   // v1.9.11 : un seul type de mer (l'ancienne « mer élargie ») ; champ gardé pour les sauvegardes
    // v1.9.10 - carte préparée à l'avance (FOF.prepareMap) pendant l'écran « Génération de la carte
    // en cours ». On la copie : si l'écriture en ligne est rejouée, la carte d'origine reste intacte.
    var pg = cfg.pregen;
    if (pg && pg.n === st.n) { st.seed = pg.seed; st.map = JSON.parse(JSON.stringify(pg.map)); }
    else if (pg && pg.carte) st.map = FOF.historicMap(pg.carte, st.n);   // v1.9.17 : le nombre de joueurs a changé
    else st.map = FOF.generateMap(st, st.n);
    st.players = cfg.players.map(function (p, i) {
      return { id: i, name: p.name, color: p.color, leader: p.leader, bot: !!p.bot, mod: FOF.LEADERS[p.leader].mod, gold: 3, dip: 2, tyran: false, tyranStamp: null,
        alive: true, capital: null, lpos: null, lArr: 0, lMoved: false, lConq: false, lFought: false, pact: null,
        tally: { gold: 3, recruit: 0, build: 0, battles: 0, wins: 0, losses: 0, conquest: 0, lost: 0, peak: 1, cases: 0 },
        attackedLast: false, attackedNow: false, raidedLast: false, raidedNow: false, edouardUsed: false, flags: {} };
    });
    // v1.5 : dirigeants placés au hasard n'importe où, jamais sur deux cases voisines
    // (on garde, parmi plusieurs tirages, celui qui les écarte le plus)
    // v1.9.17 - FOF.terrDistance : distance en cases sur une carte générée (inchangé), en pas sur une
    // carte historique (voir map.js).
    var TT = st.map.terr, best = null, bestD = -1;
    // v1.9.24 - certaines cases ne peuvent pas servir de départ (îles de la Manche à 6 joueurs)
    var depart = range(TT.length).filter(function (i) { return !TT[i].noCap; });
    /* v1.9.25 (créateur, 24/10/2026) : au moins 2 territoires entre deux capitales par la terre (distance 3).
       Deux capitales que seule la mer relie ne sont pas concernées. Cartes générées et historiques. */
    var dTerre = {};
    function loinParTerre(a, b) { var k = a < b ? a + ':' + b : b + ':' + a; if (dTerre[k] === undefined) dTerre[k] = FOF.distanceTerre(st.map, a, b); return dTerre[k] >= 3; }
    var bestOk = false;
    for (var tr = 0; tr < 4000; tr++) {
      var pick = FOF.shuffle(st, depart.slice()).slice(0, st.players.length), md = 99, okT = true;
      for (var i1 = 0; i1 < pick.length; i1++) for (var i2 = i1 + 1; i2 < pick.length; i2++) {
        md = Math.min(md, FOF.terrDistance(st.map, pick[i1], pick[i2]));
        if (!loinParTerre(pick[i1], pick[i2])) okT = false;
      }
      if (md < 2) continue;
      if ((okT && !bestOk) || (okT === bestOk && md > bestD)) { bestD = md; best = pick; bestOk = okT; }
      if (bestOk && tr >= 60) break;
    }
    if (!best) throw new Error('Couldn’t place the leaders');
    st.players.forEach(function (p, i) { var t = TT[best[i]]; t.ctrl = p.id; p.capital = t.id; p.lpos = 't' + t.id; });
    st.units = []; st.uid = 1;
    st.deck = []; Object.keys(FOF.ELITES).concat(Object.keys(FOF.SPECIALS)).forEach(function (k) { for (var c = 0; c < FOF.copies(k); c++) st.deck.push(k); });
    FOF.shuffle(st, st.deck); st.discard = [];
    st.zone = [draw(st), draw(st), draw(st), draw(st), draw(st)];
    st.turnNo = 1; st.round = 1; st.cur = 0; st.phase = 'collect'; st.log = []; st.pending = []; st.winner = null;
    // v1.9.19 (créateur, 07/10/2026) : un temple de moins pour la victoire religieuse, diplomatie fixée à 12
    st.victory = { mil: 8 + st.n, rel: 5 + st.n, dip: 12 };
    log(st, 'And so the chronicle begins: ' + st.players.length + ' lords vie for ' + st.map.terr.length + ' lands.', undefined, 'start');
    startTurn(st);
    return st;
  };
  // v1.9.10 - génère la carte sans bloquer la page. fin({ n, seed, map }) : à passer tel
  // quel à FOF.newGame({ pregen: ... }). La graine rendue est celle d'après la génération, pour que
  // la suite de la partie (placement, deck) se tire exactement comme avec FOF.generateMap.
  // v1.9.17 - carte : absente ou 'proc' = carte générée ; sinon clé d'une carte historique (FOF.CARTES).
  FOF.prepareMap = function (n, fin, echec, carte) {
    var s = { seed: Date.now() & 0x7fffffff };
    if (carte && carte !== 'proc') {
      var m; try { m = FOF.historicMap(carte, n); } catch (e) { if (echec) echec(e); return; }
      setTimeout(function () { fin({ n: n, seed: s.seed, map: m, carte: carte }); }, 0);
      return;
    }
    FOF.generateMapAsync(s, n, function (map) { fin({ n: n, seed: s.seed, map: map }); }, echec);
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
  FOF.MAX_AGE = 48 * 3600 * 1000;   // une partie laissée de côté plus de 48 h est abandonnée
  FOF.expired = function (st) { return !!st && !st.winner && Date.now() - (st.tLast || st.t0 || Date.now()) > FOF.MAX_AGE; };
  FOF.terrOf = function (st, pid) { return st.map.terr.filter(function (t) { return t.ctrl === pid; }); };
  FOF.countBld = function (st, pid, type) { var n = 0; st.map.terr.forEach(function (t) { t.blds.forEach(function (b) { if (b.o === pid && b.t === type) n++; }); }); return n; };
  FOF.army = function (st, pid) { return st.units.filter(function (u) { return u.owner === pid; }); };
  FOF.locName = function (st, loc) { var z = loc[0] === 's' && st.map.seas[+loc.slice(1)]; if (z && z.name) return z.name; return loc[0] === 't' ? T(st, +loc.slice(1)).name : ['North Sea','Sea of Mists','Silver Sea','Sea of Storms','Purple Sea','Jade Sea','Amber Sea','Sea of Sighs'][+loc.slice(1) % 8]; };
  FOF.pName = function (st, pid) { return st.players[pid].name; };

  FOF.bldCost = function (st, p, type) {
    var c = B[type].cost;
    if (type === 'Ci' && p.leader === 'gustave') c = 6;   // voulu : ses cités coûtent plus cher
    if (type === 'Ci' && p.leader === 'mathilde' && FOF.countBld(st, p.id, 'Ci') === 0) c = 4;
    if (type === 'T' && p.leader === 'adele') c = 6;
    if (type === 'P' && p.leader === 'alienor') c = 2;
    // v1.9.19 - Hugues : forts et ports seulement (les campements reviennent au prix normal, créateur 07/10/2026)
    if (p.leader === 'hugues' && (type === 'F' || type === 'P')) c = Math.max(1, c - 1);
    // v1.9.6 - Maître d'œuvre : la remise s'applique APRÈS le pouvoir du dirigeant, donc elle se
    // cumule avec Adèle (temple 7 → 6 par Adèle → 5 avec le Maître d'œuvre).
    // v1.9.11 - cumulable : deux Maîtres d'œuvre retirent 2 or (décision du créateur, 27/09/2026).
    // v1.9.25 - remise retirée : le Maître d'œuvre fortifie désormais un temple (créateur, 24/10/2026).
    return c;
  };
  FOF.defBonus = function (st, p, t) {
    var d = 0;
    t.blds.forEach(function (b) {
      if (b.o !== p.id) return;
      d += B[b.t].def;
      if (p.leader === 'alienor' && b.t === 'P') d += 1;   // v1.9.14 : ports d'Alinor à +2 défense
      if (p.leader === 'adele' && b.t === 'T') d += 1;
      // v1.9.25 - temple fortifié par un Maître d'œuvre : +2, une seule fois, garde son bonus s'il change de mains
      if (b.t === 'T' && b.fort) d += 2;
    });
    // v1.9.19 - capitale : +3 au lieu de +2 ; Gustave : +1 sur chacun de ses territoires (créateur, 07/10/2026)
    if (t.id === p.capital && t.ctrl === p.id) d += 3;
    if (p.leader === 'gustave' && t.ctrl === p.id) d += 1;
    return d;
  };
  FOF.income = function (st, p) {
    var inc = { terr: FOF.terrOf(st, p.id).length, cities: FOF.countBld(st, p.id, 'Ci'), ports: 0, trade: 0, temples: 0, boutefeu: 0 };
    /* v1.9.17 - Boutefeu (décision du créateur, 30/09/2026) : posté sur le territoire d'un adversaire,
       il bloque TOUT le revenu que le maître du territoire tire de cette case : le territoire (+1), ses
       cités sur la case, et ses Caravaniers / Caboteurs qui s'y trouvent. Les autres joueurs gardent
       leurs revenus. Plusieurs Boutefeux sur la même case ne bloquent pas plus. */
    var bloquees = {};
    st.map.terr.forEach(function (t) {
      if (t.ctrl !== p.id) return;
      if (!st.units.some(function (u) { return u.key === 'boutefeu' && u.pos === 't' + t.id && u.owner !== p.id; })) return;
      bloquees[t.id] = 1;
      inc.boutefeu += 1 + t.blds.filter(function (b) { return b.t === 'Ci' && b.o === p.id; }).length;
    });
    FOF.army(st, p.id).forEach(function (u) {
      if ((u.key === 'caboteur' || u.key === 'caravanier') && u.pos[0] === 't') {
        var typ = u.key === 'caboteur' ? 'P' : 'Ci', tid = +u.pos.slice(1);
        // v1.9.17 : 3 or au lieu de 2
        // v1.9.24 : le bonus de Yusuf (5 or) disparaît avec son nouveau pouvoir (créateur, 08/10/2026)
        var gainC = 3;
        if (T(st, tid).blds.some(function (b) { return b.t === typ && b.o !== p.id; })) { if (bloquees[tid]) inc.boutefeu += gainC; else inc.trade += gainC; }
      }
    });
    // le Boutefeu retire du revenu ce qui vient de la case bloquée (territoire et cités ; le commerce n'y est pas compté)
    var blocTerrCites = 0; Object.keys(bloquees).forEach(function (id) { blocTerrCites += 1 + T(st, +id).blds.filter(function (b) { return b.t === 'Ci' && b.o === p.id; }).length; });
    inc.terr -= Object.keys(bloquees).length;
    inc.cities -= blocTerrCites - Object.keys(bloquees).length;
    // Prélat : v1.9.17 +2 or par temple possédé (cumulable, décision du 27/09/2026 maintenue)
    inc.temples = FOF.army(st, p.id).filter(function (u) { return u.key === 'prelat'; }).length * 2 * FOF.countBld(st, p.id, 'T');
    inc.total = inc.terr + inc.cities + inc.ports + inc.trade + inc.temples;
    inc.upkeep = FOF.army(st, p.id).reduce(function (a, u) { return a + FOF.unitDef(u.key).upkeep; }, 0);
    return inc;
  };
  FOF.unitMove = function (st, u) {
    var d = FOF.unitDef(u.key).move;
    if (FOF.isElite(u.key) && st.players[u.owner].leader === 'henri') d += 1;
    // v1.9.24 - Zaynab la Vagabonde : toutes ses unités spéciales +1 (créateur, 08/10/2026).
    // Le +1 de Yusuf sur Caboteurs et Caravaniers disparaît avec son nouveau pouvoir.
    if (!FOF.isElite(u.key) && st.players[u.owner].leader === 'zaynab') d += 1;
    return d;
  };

  /* ---------- déplacement ---------- */
  function canEmbark(st, tid, piece, p) {
    var t = T(st, tid);
    if (!t.seas.length) return false;
    // v1.9.25 - l'Émissaire en nef ne prend pas la mer sans port (créateur, 24/10/2026)
    if (piece !== 'L' && piece.key === 'corbeau') return true;
    if (t.blds.some(function (b) { return b.t === 'P'; })) return true;
    
    return false;
  }
  function neighbors(st, loc, piece, p) {
    var out = [];
    if (loc[0] === 't') {
      var t = T(st, +loc.slice(1));
      // v1.9.25 - unités côtières (Émissaire en nef, Exploratrice, Caboteur) : mer et territoires côtiers seulement
      var cotier = piece !== 'L' && FOF.unitDef(piece.key).cotier;
      t.adj.forEach(function (a) { if (!cotier || T(st, a).seas.length) out.push('t' + a); });
      if (canEmbark(st, t.id, piece, p)) t.seas.forEach(function (z) { out.push('s' + z); });
    } else {
      var z = st.map.seas[+loc.slice(1)];
      z.adjT.forEach(function (a) { out.push('t' + a); });   // un territoire bordant la mer est côtier
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
  /* v1.9.24 - Cartographe (créateur, 08/10/2026) : tant qu'il est en jeu, les unités et le dirigeant de
     son propriétaire passent directement d'un de ses ports à un autre de ses ports, pour tous leurs
     points de déplacement. Réponses du 08/10 : départ et arrivée sur un territoire que le joueur
     contrôle et qui porte SON port ; le pion doit avoir encore au moins 1 point de déplacement.
     Le pouvoir disparaît avec le Cartographe (défaussé, déserté, détruit). */
  function sonPort(st, p, t) { return t && t.ctrl === p.id && t.blds.some(function (b) { return b.t === 'P' && b.o === p.id; }); }
  FOF.portHops = function (st, p, from, budget) {
    if (!from || from[0] !== 't' || !(budget > 0)) return [];
    if (!st.units.some(function (u) { return u.owner === p.id && u.key === 'cartographe'; })) return [];
    if (!sonPort(st, p, T(st, +from.slice(1)))) return [];
    return st.map.terr.filter(function (t) { return 't' + t.id !== from && sonPort(st, p, t); }).map(function (t) { return 't' + t.id; });
  };

  /* ---------- diplomatie ---------- */
  function loseDip(st, p, n, why) {
    if (p.tyran || n <= 0) return;
    if (p.dip - n < 0) {
      p.dip = 0; p.tyran = true; p.tyranStamp = st.turnNo;
      if (p.pact !== null) {
        // v1.9.12 - l'ambassadeur de l'autre, posté chez le nouveau Tyran, est chassé : son
        // propriétaire perd 1 (le Tyran, lui, n'a plus de diplomatie à perdre).
        var partenaire = st.players[p.pact];
        var chasse = partenaire && st.units.some(function (u) { return u.key === 'ambassadeur' && u.owner === partenaire.id && u.pos === 't' + p.capital; });
        breakPactQuiet(st, p);
        if (chasse) loseDip(st, partenaire, 1, 'ambassador driven out by the Tyrant ' + p.name);
      }
      log(st, p.name + ' has become a Tyrant!', p.id, 'tyran');
    } else { p.dip -= n; }
    if (why) log(st, p.name + ' loses ' + n + ' Diplomacy (' + why + '); the neighboring courts murmur.', p.id, 'dip-');
  }
  // sansRelais : gain que l'Ambassade ne relaie pas (le Héraut, depuis la v1.9.11)
  function gainDip(st, p, n, why, sansRelais) {
    if (p.tyran || !p.alive || n <= 0) return;
    // l'Ambassade relaie : +1 sur un gain obtenu par une action, jamais de revenu passif,
    // et seulement si le joueur n'a ni attaqué ni été attaqué depuis son dernier tour.
    // v1.9.11 - « ni attaqué ni été attaqué DEPUIS votre tour précédent » : l'attaque menée plus tôt
    // dans le tour en cours comptait pas (attaquer puis livrer un Émissaire gardait le +1).
    // v1.9.24 - l'Ambassade relaie même si l'on a combattu : seules certaines cartes (le Héraut)
    // demandent la paix (créateur, 08/10/2026). Avant : ni attaqué ni été attaqué depuis son tour.
    if (!sansRelais && FOF.countBld(st, p.id, 'A')) { n += 1; why += ' + Embassy'; }
    // le plafond suivait la valeur figée 10 : tout seuil au-dessus était inatteignable.
    var g = Math.min(st.victory.dip, p.dip + n) - p.dip; p.dip += g;
    if (g) log(st, p.name + ' gains ' + g + ' Diplomacy (' + why + '); their name rises in the courts.', p.id, 'dip+');
  }
  function breakPactQuiet(st, p) {
    var q = st.players[p.pact]; if (!q) { p.pact = null; return; }
    st.units.filter(function (u) { return u.key === 'ambassadeur' && ((u.owner === p.id && u.pos === 't' + q.capital) || (u.owner === q.id && u.pos === 't' + p.capital)); })
      .forEach(function (u) { discardUnit(st, u); });
    q.pact = null; p.pact = null;
  }
  function breakPact(st, att, def) {
    log(st, att.name + ' betrays the pact that bound them to ' + def.name + '!', att.id, 'pactbreak');
    breakPactQuiet(st, att);
    loseDip(st, att, 2, 'broken pact');
    gainDip(st, def, 1, 'betrayed');
  }

  /* v1.9.9 - un pacte ne vaut QUE tant qu'un ambassadeur se tient sur la capitale de l'autre,
     comme l'annonce le texte de la carte (« tant qu'il y reste »). Dès qu'il la quitte, meurt,
     est défaussé, ou que la capitale déménage, le pacte tombe de lui-même. Ce n'est PAS une
     trahison : pas de -2 / +1. Avant cette version, le pacte survivait au départ de l'ambassadeur,
     et une attaque ultérieure était comptée comme rupture.
     v1.9.11 - décision du créateur (QO-118 puis QO-120) : quand le pacte tombe parce que
     l'ambassadeur n'est plus sur la capitale, QUELLE QU'EN SOIT LA RAISON (rappel, licenciement,
     solde impayée, destruction, déménagement de la capitale hôte), le propriétaire de
     l'ambassadeur perd 1 diplomatie. Seuls cas sans ce -1 : la rupture par une attaque (régime
     -2 / +1 de breakPact) et les pactes effacés par la tyrannie ou l'élimination. */
  // ambassadeurs qui tiennent un pacte, relevés au début de chaque action
  function ambassadeursTenant(st) {
    var out = [];
    st.players.forEach(function (p) {
      if (p.pact === null || p.pact === undefined) return;
      var q = st.players[p.pact];
      if (q && q.pact === p.id && q.capital !== null && st.units.some(function (u) { return u.key === 'ambassadeur' && u.owner === p.id && u.pos === 't' + q.capital; }))
        out.push({ owner: p.id, host: q.id });
    });
    return out;
  }
  function ambassadeurEnPlace(st, p, q) {
    return st.units.some(function (u) {
      return u.key === 'ambassadeur' &&
        ((u.owner === p.id && q.capital !== null && u.pos === 't' + q.capital) ||
         (u.owner === q.id && p.capital !== null && u.pos === 't' + p.capital));
    });
  }
  function verifierPactes(st, tenus) {
    st.players.forEach(function (p) {
      if (p.pact === null || p.pact === undefined) return;
      var q = st.players[p.pact];
      if (!q || !q.alive || q.pact !== p.id) { p.pact = null; return; }
      if (ambassadeurEnPlace(st, p, q)) return;
      p.pact = null; q.pact = null;
      log(st, 'No ambassador left at the capital: the pact between ' + p.name + ' and ' + q.name + ' no longer holds.', p.id, 'pact');
      (tenus || []).forEach(function (x) {
        if ((x.owner === p.id && x.host === q.id) || (x.owner === q.id && x.host === p.id)) {
          var o = st.players[x.owner];
          if (o.alive) loseDip(st, o, 1, 'ambassador withdrawn from ' + st.players[x.host].name + '’s court');
        }
      });
    });
  }
  FOF.pactActif = function (st, p, q) { return p.pact === q.id && q.pact === p.id && ambassadeurEnPlace(st, p, q); };

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
    p.raidedLast = p.raidedNow; p.raidedNow = false;
    p.flags = {}; p.lMoved = false; p.lConq = false; p.lFought = false; p.lFromSea = false;
    FOF.army(st, p.id).forEach(function (u) { u.fromSea = false; });
    FOF.army(st, p.id).forEach(function (u) { u.moved = 0; u.fought = false; u.pacif = false; u.movesLeft = FOF.unitMove(st, u); });
    p.lMovesLeft = 1;
    st.phase = 'collect'; st.phaseClean = true;
    doCollect(st, p);
  }
  function doCollect(st, p) {
    var inc = FOF.income(st, p);
    // Héraut
    // v1.9.11 (retours de playtest validés par le créateur) : bloqué aussi si le joueur a ÉTÉ attaqué
    // depuis son tour précédent, et l'Ambassade ne relaie plus ce gain.
    // v1.9.12 - cumulable : deux Hérauts donnent +2 (décision du créateur, 27/09/2026).
    var nHer = FOF.army(st, p.id).filter(function (u) { return u.key === 'heraut'; }).length;
    if (!p.tyran && !p.attackedLast && !p.raidedLast && nHer) gainDip(st, p, nHer, 'Herald', true);
    /* v1.9.19 - collecte (règle réécrite par le créateur, 07/10/2026) : revenus moins solde ; le solde,
       positif ou négatif, va au trésor. La solde puise donc dans le trésor. Si le trésor devient
       négatif, le joueur reprend des pièces sur ses unités jusqu'à le ramener à 0 ou plus ; chaque
       unité dont il reprend au moins une pièce déserte (il peut reprendre toutes les pièces d'une
       unité qu'il sacrifie, le surplus va au trésor). Faute de pièces, le trésor reste négatif :
       ni recrutement ni construction tant qu'il l'est. Avant : seule la recette du tour comptait. */
    var net = inc.total - inc.upkeep;
    p.gold += net; if (net > 0) p.tally.gold += net;
    st.collect = { inc: inc, net: net, deficit: p.gold < 0 ? -p.gold : 0, taken: 0 };
    log(st, p.name + ' collects taxes: ' + inc.total + ' gold raised, ' + inc.upkeep + ' for the troops’ upkeep, ' + (net >= 0 ? '+' : '−') + Math.abs(net) + ' to the treasury (' + p.gold + ').', p.id, net >= 0 ? 'gold' : 'deficit');
    if (p.gold < 0) {
      var reserve = FOF.army(st, p.id).reduce(function (a, u) { return a + u.gold; }, 0);
      if (reserve <= -p.gold) {
        // pas assez de pièces (ou tout juste) : toutes sont reprises, toutes les unités qui en portaient désertent
        var tout = {}; FOF.army(st, p.id).forEach(function (u) { if (u.gold > 0) tout[u.uid] = u.gold; });
        reprendre(st, p, tout);
      } else st.pending.push({ type: 'deficit', pid: p.id, left: -p.gold });
    }
    checkWin(st);
  }
  // pièces reprises : { uid: nombre }. Les pièces vont au trésor, chaque unité touchée déserte.
  function reprendre(st, p, coins) {
    var total = 0;
    Object.keys(coins).forEach(function (k) {
      var u = st.units.filter(function (x) { return x.uid === +k && x.owner === p.id; })[0]; if (!u) return;
      var n = Math.min(u.gold, coins[k]); if (n <= 0) return;
      total += n; u.gold -= n;
      log(st, 'Unable to pay upkeep, ' + p.name + '’s “' + FOF.unitDef(u.key).name + '” desert (' + n + ' gold taken back).', p.id, 'bad');
      discardUnit(st, u);
    });
    p.gold += total;
    if (st.collect) { st.collect.taken = (st.collect.taken || 0) + total; st.collect.deficit = 0; }
    return total;
  }
  // une sélection est valable si elle couvre le manque et si chaque unité choisie est nécessaire
  FOF.deficitValide = function (st, pid, coins, manque) {
    var parU = {}, somme = 0, ok = true;
    Object.keys(coins).forEach(function (k) {
      var u = st.units.filter(function (x) { return x.uid === +k && x.owner === pid; })[0], n = coins[k];
      if (!n) return;
      if (!u || n < 0 || n > u.gold || n !== Math.floor(n)) ok = false; else { parU[k] = n; somme += n; }
    });
    if (!ok) return 'Invalid selection.';
    if (somme < manque) return 'Still ' + (manque - somme) + ' gold short.';
    var inutile = Object.keys(parU).some(function (k) { return somme - parU[k] >= manque; });
    if (inutile) return 'One of the units you picked isn’t needed: the treasury would already be back to 0 without it.';
    return null;
  };
  /* v1.9.24 - proche de la victoire (créateur, 08/10/2026) : à 2 territoires, 2 temples ou 2 points de
     diplomatie du seuil, ou moins. Sert au halo du portrait et à l'annonce entre deux tours. */
  FOF.procheVictoire = function (st, p) {
    if (!p || !p.alive || st.winner) return [];
    var v = st.victory, out = [];
    if (v.mil - FOF.terrOf(st, p.id).length <= 2) out.push({ t: 'mil', reste: v.mil - FOF.terrOf(st, p.id).length });
    if (v.rel - FOF.countBld(st, p.id, 'T') <= 2) out.push({ t: 'rel', reste: v.rel - FOF.countBld(st, p.id, 'T') });
    if (!p.tyran && v.dip - p.dip <= 2) out.push({ t: 'dip', reste: v.dip - p.dip });
    return out;
  };
  /* v1.9.25 (créateur, 24/10/2026) : l'annonce ne paraît qu'une fois par type de victoire, à la fin du
     tour où le joueur l'atteint. Tant qu'il reste proche, plus d'annonce ; s'il s'éloigne puis revient,
     elle reparaît. p.procheVu garde les types déjà annoncés, st.procheAnnonce l'annonce à montrer. */
  function oublierProche(st) {
    st.players.forEach(function (q) {
      if (!q.procheVu || !q.procheVu.length) return;
      var types = FOF.procheVictoire(st, q).map(function (x) { return x.t; });
      q.procheVu = q.procheVu.filter(function (t) { return types.indexOf(t) >= 0; });
    });
  }
  function annoncerProche(st, p) {
    oublierProche(st);
    var cur = FOF.procheVictoire(st, p), vu = p.procheVu || [];
    var neufs = cur.filter(function (x) { return vu.indexOf(x.t) < 0; });
    p.procheVu = cur.map(function (x) { return x.t; });
    st.procheAnnonce = neufs.length ? { pid: p.id, types: neufs, turnNo: st.turnNo + 1 } : null;
  }
  function nextPlayer(st) {
    annoncerProche(st, st.players[st.cur]);
    var n = st.players.length, i = st.cur, wrapped = false;
    for (var k = 0; k < n; k++) {
      i = (i + 1) % n;
      if (i === 0) wrapped = true;
      if (st.players[i].alive) break;
    }
    if (wrapped) st.round++;
    st.cur = i; st.turnNo++; st.lastCombat = null;
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
          log(st, loser.name + ', cornered in their last stronghold, surrenders their capital to ' + st.players[pd.to].name + '.', loser.id, 'capfall');
          // La case n'est plus une capitale : elle retombe à 2 emplacements. Personne n'est là pour
          // choisir (le cédant est éliminé dans la foulée), on rase donc les derniers bâtis.
          while (cap.blds.length > 2) {
            var bj = cap.blds.pop();
            log(st, 'The ' + B[bj.t].name.toLowerCase() + ' at ' + cap.name + ' is dismantled: the place is no longer a capital.', pd.to, 'bad');
          }
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
    if (st.winner) log(st, '★ Glory to ' + st.players[st.winner.pid].name + ', the victor! Their name passes into legend.', st.winner.pid, 'win');
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
    log(st, 'The house of ' + p.name + ' falls.', p.id, 'elim');
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
      A = elitePower(st, att, t.biome); detA.push(['Elite units (' + FOF.BIOME_NAMES[t.biome] + ')', A]);
      if (lead) { A += p.mod; detA.push(['Leader', p.mod]); }
      if (p.leader === 'odon') { A += att.length; detA.push(['Odon: +1 per elite unit', att.length]); }
      var ep = elitePower(st, du, t.biome); D = ep; detD.push(['Elite units (' + FOF.BIOME_NAMES[t.biome] + ')', ep]);
      if (dl) { D += d.mod; detD.push(['Leader', d.mod]); }
      var db = FOF.defBonus(st, d, t); D += db; if (db) detD.push(['Buildings' + (t.id === d.capital ? ' + capital' : ''), db]);
    } else {
      A = att.length; detA.push(['Elite units at sea (1 each)', A]);
      if (lead) { A += p.mod; detA.push(['Leader', p.mod]); }
      D = du.filter(function (u) { return FOF.isElite(u.key); }).length; detD.push(['Elite units at sea', D]);
      if (dl) { D += d.mod; detD.push(['Leader', d.mod]); }
    }
    var cost = d.tyran ? 0 : 1; if (p.pact === d.id) cost += 2;
    // v1.9.19 : défaite d'office des unités spéciales seules ; chaque spéciale détruite coûte 1 (sauf Tyran)
    var auto = a.kind === 'units' && !dl && !du.some(function (u) { return FOF.isElite(u.key); });
    var nSpe = d.tyran ? 0 : du.filter(function (u) { return !FOF.isElite(u.key); }).length;
    return { auto: auto, nSpe: nSpe, A: A, D: D, detA: detA, detD: detD, att: att, lead: lead, du: du, dl: dl, cost: cost };
  };
  FOF.attackTargets = function (st, loc) {
    var p = FOF.cur(st), out = [];
    var att = FOF.unitsAt(st, loc, p.id).filter(function (u) { return FOF.isElite(u.key) && !u.fought && !u.pacif; });
    var leadOk = p.lpos === loc && !p.lFought && !p.lConq;
    if (!att.length && !leadOk) return out;
    if (loc[0] === 's') return out;   // v1.6 : plus aucun combat en mer, même pour Alinor
    var t = T(st, +loc.slice(1));
    if (t.ctrl !== null && t.ctrl !== p.id && st.players[t.ctrl].alive) out.push({ target: t.ctrl, kind: 'terr' });
    st.players.forEach(function (q) {
      if (q.id === p.id || !q.alive || q.id === t.ctrl) return;
      if (FOF.unitsAt(st, loc, q.id).length || q.lpos === loc) out.push({ target: q.id, kind: 'units' });
    });
    return out;
  };
  // v1.9.6 - le Trébuchet ne se joue plus pendant un assaut : c'est un effet d'unité ordinaire.

  function doAttack(st, a) {
    var p = FOF.cur(st), d = st.players[a.target], loc = a.loc;
    var pv = FOF.previewAttack(st, a);
    if (!pv.att.length && !pv.lead) throw new Error('No unit can attack here.');
    var t = loc[0] === 't' ? T(st, +loc.slice(1)) : null;
    // coûts - v1.9.1 : la reprise d'une terre perdue coûte de nouveau 1 diplomatie. La gratuité,
    // mesurée sur 1 000 parties, faisait passer la voie diplomatique de 29 % à 60 % des victoires.
    p.attackedNow = true; d.raidedNow = true;
    // v1.9.19 - chaque perte de diplomatie est annoncée dans la fenêtre de bataille (créateur, 07/10/2026)
    var pertes = [], dipAvant = p.dip, dipDef = d.dip;
    if (p.pact === d.id) { breakPact(st, p, d); pertes.push('Non-aggression pact broken: ' + p.name + ' loses 2 Diplomacy, ' + d.name + ' gains 1.'); }
    if (!d.tyran) { loseDip(st, p, 1, 'attack'); pertes.push('Attack: ' + p.name + ' loses 1 Diplomacy.'); }
    // v1.9.19 - des unités spéciales seules (ni élite ni dirigeant) attaquées hors de leur territoire ne
    // lancent pas de dé : elles perdent d'office. Un territoire attaqué garde son dé et sa défense
    // passive, même s'il n'est gardé que par des unités spéciales (créateur, 07/10/2026).
    var auto = a.kind === 'units' && !pv.dl && !pv.du.some(function (u) { return FOF.isElite(u.key); });
    // dés
    // v1.9.12 - cumulable : une relance par Prêtresse présente (décision du créateur, 27/09/2026)
    var aPr = FOF.unitsAt(st, loc, p.id).filter(function (u) { return u.key === 'pretresse'; }).length;
    var dPr = pv.du.filter(function (u) { return u.key === 'pretresse'; }).length;
    var rolls = [], ra = 0, rd = 0;
    for (; !auto;) {
      ra = d6(st); rd = d6(st);
      // v1.9.24 : a0 / d0 gardent le premier jet, pa / pd disent qui a relancé grâce à une Prêtresse
      // (l'interface montre chaque relance au clic sur le dé). Le tirage lui-même ne change pas.
      var r = { a: ra, d: rd, a0: ra, d0: rd, notes: [] };
      if (pv.A + ra < pv.D + rd && aPr > 0) { aPr--; ra = d6(st); r.notes.push('Priestess: the attacker rerolls (' + ra + ')'); r.a = ra; r.pa = 1; }
      if (pv.D + rd < pv.A + ra && dPr > 0) { dPr--; rd = d6(st); r.notes.push('Priestess: the defender rerolls (' + rd + ')'); r.d = rd; r.pd = 1; }
      rolls.push(r);
      if (pv.A + ra !== pv.D + rd) break;
    }
    var win = auto || pv.A + ra > pv.D + rd;
    var res = { n: (st.combatN = (st.combatN || 0) + 1), auto: auto, loc: loc, att: p.id, def: d.id, A: pv.A, D: pv.D, detA: pv.detA, detD: pv.detD, rolls: rolls, win: win, events: [], unitsA: pv.att.map(function (u) { return u.key; }), unitsD: pv.du.map(function (u) { return u.key; }), leadA: !!pv.lead, leadD: !!pv.dl, kind: a.kind };
    pv.att.forEach(function (u) { u.fought = true; u.movesLeft = 0; });
    if (pv.lead) { p.lFought = true; p.lMovesLeft = 0; }
    p.tally.battles++; d.tally.battles++; if (win) { p.tally.wins++; d.tally.losses++; } else { p.tally.losses++; d.tally.wins++; }
    if (win) {
      var nSpe = 0;
      pv.du.forEach(function (u) { if (!FOF.isElite(u.key) && !d.tyran) { loseDip(st, p, 1, 'special unit destroyed'); nSpe++; } discardUnit(st, u); });
      if (nSpe) pertes.push(nSpe + ' special unit' + (nSpe > 1 ? 's' : '') + ' destroyed: ' + p.name + ' loses ' + nSpe + ' Diplomacy.');
      res.events.push(auto ? d.name + '’s special units don’t fight: they’re defeated automatically.' : p.name + ' wins!');
      if (a.kind === 'terr' && t && t.ctrl === d.id) st.pending.push({ type: 'conquest', pid: p.id, tid: t.id, def: d.id });
      if (pv.dl) leaderDefeated(st, d, p, res);
    } else {
      pv.att.forEach(function (u) { discardUnit(st, u); });
      res.events.push(d.name + ' wins on defense.');
      if (pv.lead) leaderDefeated(st, p, d, res);
    }
    // v1.9.19 - Chroniqueur : +1 de diplomatie par bataille gagnée, en attaque comme en défense, sans
    // relais de l'Ambassade, cumulable (créateur, 07/10/2026). Il ne bouge pas : peu importe où il est.
    var vainqueur = win ? p : d, nChr = FOF.army(st, vainqueur.id).filter(function (u) { return u.key === 'chroniqueur'; }).length;
    if (nChr && vainqueur.alive && !vainqueur.tyran) {
      var avChr = vainqueur.dip; gainDip(st, vainqueur, nChr, 'Chronicler', true);
      if (vainqueur.dip > avChr) res.events.push('Chronicler: ' + vainqueur.name + ' gains ' + (vainqueur.dip - avChr) + ' Diplomacy.');
    }
    if (pertes.length) {
      res.dip = pertes;
      res.dipBilan = { att: p.tyran ? null : p.dip - dipAvant, def: d.tyran ? null : d.dip - dipDef };
    }
    st.lastCombat = res;
    log(st, p.name + ' launches an assault on ' + d.name + ' at ' + FOF.locName(st, loc) + (auto ? ': their special units are defeated without a fight.' : ': ' + (pv.A + ra) + ' against ' + (pv.D + rd) + ' - ' + (win ? 'the attackers prevail' : 'the defenders hold firm') + '.'), p.id, win ? 'attackwin' : 'attacklose');
    checkWin(st);
  }
  function leaderDefeated(st, loser, winner, res) {
    loser.lpos = 't' + loser.capital; loser.lMovesLeft = 0;
    res.events.push(loser.name + '’s leader is defeated: they return to their capital and must give up a territory.');
    st.pending.push({ type: 'cedeTerritory', pid: loser.id, to: winner.id });
  }

  // v1.9.6 - une ambassade prise dans une conversion est RASÉE, jamais transférée. Sans cela, le
  // Partisan sur une capitale adverse donnait au joueur une seconde ambassade, hors de sa propre
  // capitale : deux règles violées d'un coup (« une seule » et « dans votre capitale »).
  function convertir(st, t, pid, sansTemples) {
    var n = 0, rasees = 0;
    t.blds = t.blds.filter(function (b) {
      if (b.o === pid) return true;
      if (sansTemples && b.t === 'T') return true;
      if (b.t === 'A') { rasees++; return false; }
      b.o = pid; n++; return true;
    });
    return { convertis: n, rasees: rasees };
  }

  /* ---------- effets des unités spéciales ---------- */
  FOF.effectAvailable = function (st, u) {
    var p = st.players[u.owner];
    // v1.9.17 - le Gouverneur se défausse depuis n'importe quelle case, mer comprise (décision du créateur, 30/09/2026)
    if (u.key === 'gouverneur') return FOF.terrOf(st, p.id).some(function (x) { return x.blds.some(function (b) { return b.o !== p.id && b.t !== 'T'; }); }) ? 'Convert enemy buildings' : null;
    if (u.pos[0] !== 't') return null;
    var t = T(st, +u.pos.slice(1));
    var others = st.players.filter(function (q) { return q.id !== p.id && q.alive; });
    switch (u.key) {
      case 'corbeau': case 'emissaire': case 'emnef':
        return others.some(function (q) { return q.capital === t.id && t.ctrl === q.id; }) && !p.tyran ? 'Deliver the message' : null;
      case 'ambassadeur':
        var host = others.filter(function (q) { return q.capital === t.id && t.ctrl === q.id; })[0];
        return host && !host.tyran && !p.tyran && p.pact === null && host.pact === null ? 'Make a pact with ' + host.name : null;
      case 'maitre': return t.blds.some(function (b) { return b.t === 'T' && b.o === p.id && !b.fort; }) ? 'Fortify the temple' : null;
      case 'pelerin': return t.blds.some(function (b) { return b.t === 'T' && b.o !== p.id; }) && !p.tyran ? 'Go on pilgrimage' : null;
      case 'colonie': return t.ctrl === null && t.revoltFrom !== p.id ? 'Found a colony' : null;
      // v1.9.19 - l'Exploratrice agit dès son arrivée, en phase militaire, comme la Colonie (créateur, 07/10/2026)
      case 'exploratrice': return t.ctrl === null && t.revoltFrom !== p.id && t.cont !== T(st, p.capital).cont ? 'Claim this territory' : null;
      // v1.9.11 - le Partisan convertit tout SAUF les temples (décision du créateur, 27/09/2026)
      case 'partisan': return t.ctrl !== null && t.ctrl !== p.id && t.blds.some(function (b) { return b.o !== p.id && b.t !== 'T'; }) ? 'Stir up the buildings' : null;
      case 'predicateur': return t.ctrl !== null && t.ctrl !== p.id && t.blds.some(function (b) { return b.t === 'T' && b.o !== p.id; }) ? 'Convert the temple' : null;
      // v1.9.6 - le Gouverneur agit sur TOUS vos territoires, où qu'il se trouve, temples exclus.
      case 'gouverneur': return FOF.terrOf(st, p.id).some(function (x) { return x.blds.some(function (b) { return b.o !== p.id && b.t !== 'T'; }); }) ? 'Convert enemy buildings' : null;
      // v1.9.6 - le Trébuchet n'est plus lié à un assaut : posé sur un territoire adverse, il rase
      // un aménagement adverse et reste en jeu. Une fois par tour.
      // v1.9.14 - Calomniateur : sur un territoire adverse, fait perdre 2 diplomatie à son propriétaire (plancher 0)
      case 'calomniateur': var vc = t.ctrl !== null && t.ctrl !== p.id ? st.players[t.ctrl] : null; return vc && vc.alive && !vc.tyran && vc.dip > 0 ? 'Slander ' + vc.name : null;
      case 'trebuchets': return !u.fought && t.ctrl !== null && t.ctrl !== p.id && t.blds.some(function (b) { return b.o !== p.id; }) ? 'Destroy a building' : null;
    }
    return null;
  };
  function useEffect(st, u, arg) {
    var p = st.players[u.owner], t = u.pos[0] === 't' ? T(st, +u.pos.slice(1)) : null, name = FOF.unitDef(u.key).name;
    switch (u.key) {
      /* v1.9.25 (créateur, 24/10/2026) : le joueur adverse visité gagne +1 de diplomatie (son Ambassade
         le relaie, un Tyran ne gagne rien). Si les deux atteignent le seuil, le joueur actif gagne
         (checkWin le regarde en premier). */
      case 'corbeau': case 'emissaire': case 'emnef': {
        var hote = st.players.filter(function (q) { return q.id !== p.id && q.capital === t.id && t.ctrl === q.id; })[0];
        gainDip(st, p, u.key === 'corbeau' ? 1 : 2, name);
        if (hote) gainDip(st, hote, 1, 'message received');
        discardUnit(st, u); break;
      }
      case 'maitre': {
        var tf = t.blds.filter(function (b) { return b.t === 'T' && b.o === p.id && !b.fort; })[0];
        tf.fort = true; log(st, p.name + '’s Master Builder fortifies the temple at ' + t.name + ' (+2 defense).', p.id, 'build');
        discardUnit(st, u); break;
      }
      case 'ambassadeur':
        var host = st.players.filter(function (q) { return q.capital === t.id; })[0];
        p.pact = host.id; host.pact = p.id; log(st, p.name + ' and ' + host.name + ' seal a non-aggression pact.', p.id, 'pact'); break;
      case 'calomniateur': {
        var vic = st.players[t.ctrl], perte = Math.min(2, vic.dip);
        vic.dip -= perte;   // jusqu'à 0 : la calomnie ne fait jamais basculer en Tyran
        log(st, p.name + '’s Slanderer spreads rumors in ' + t.name + ': ' + vic.name + ' loses ' + perte + ' Diplomacy.', p.id, 'dip-');
        discardUnit(st, u); break;
      }
      case 'pelerin':
        var tb = t.blds.filter(function (b) { return b.t === 'T' && b.o !== p.id; })[0];
        // v1.9.25 : +2 au lieu de +1 ; l'Ambassade ne s'ajoute qu'au gain du pèlerin (créateur, 24/10/2026)
        gainDip(st, p, 2, name); gainDip(st, st.players[tb.o], 1, 'pilgrim welcomed', true);
        // v1.9.17 - la défausse et le break étaient restés dans le commentaire ci-dessus : l'effet
        // enchaînait sur celui de la Colonie et le Pèlerin prenait le territoire (playtest du 30/09).
        discardUnit(st, u); break;
      case 'colonie':
        if (t.revoltFrom === p.id) throw new Error('This territory rose up against you: you can no longer settle here.');
        t.ctrl = p.id; t.conqStamp = st.turnNo; t.revoltFrom = null; t.takenFrom = null; if (t.blds.length < FOF.slotsOf(st, p, t.id)) t.blds.push({ t: 'C', o: p.id, b: p.id });
        log(st, 'Settlers from ' + p.name + ' set up a camp at ' + t.name + '.', p.id, 'land'); discardUnit(st, u); break;
      case 'exploratrice':
        t.ctrl = p.id; t.conqStamp = st.turnNo; t.revoltFrom = null; t.takenFrom = null; p.gold += 3; log(st, p.name + '’s explorer plants her banner at ' + t.name + ' (+3 gold).', p.id, 'land'); discardUnit(st, u); break;
      case 'partisan': {
        var rp = convertir(st, t, p.id, true);
        log(st, p.name + '’s partisan wins the buildings of ' + t.name + ' over to the cause.', p.id, 'convert');
        if (rp.rasees) log(st, 'The embassy at ' + t.name + ' is ransacked.', p.id, 'bad');
        discardUnit(st, u); break;
      }
      case 'predicateur':
        var tp = t.blds.filter(function (b) { return b.t === 'T' && b.o !== p.id; })[0];
        tp.o = p.id; log(st, p.name + '’s Preacher converts the faithful at the temple of ' + t.name + '.', p.id, 'convert'); discardUnit(st, u); break;
      case 'gouverneur':
        var nbG = 0, rasG = 0;
        FOF.terrOf(st, p.id).forEach(function (x) {
          x.blds = x.blds.filter(function (b) {
            if (b.o === p.id || b.t === 'T') return true;
            if (b.t === 'A') { rasG++; return false; }
            b.o = p.id; nbG++; return true;
          });
        });
        if (rasG) log(st, 'Foreign embassies on ' + p.name + '’s lands are closed.', p.id, 'bad');
        log(st, p.name + '’s Governor wins over ' + nbG + ' foreign building' + (nbG > 1 ? 's' : '') + ' on their lands.', p.id, 'convert');
        discardUnit(st, u); break;
      case 'trebuchets': {
        var candT = t.blds.map(function (b, i) { return i; }).filter(function (i) { return t.blds[i].o !== p.id; });
        var iT = arg !== undefined && candT.indexOf(arg) >= 0 ? arg : candT[0];
        var bT = t.blds[iT], vict = st.players[bT.o];
        /* v1.9.11 - le tir compte comme une ATTAQUE contre le propriétaire de l'aménagement
           (décision du créateur, 27/09/2026) : 1 diplomatie sauf contre un Tyran, rupture d'un pacte
           éventuel, et drapeaux « a attaqué » / « a été attaqué » (Ambassade, Héraut, Edouard).
           Avant, il ne coûtait rien et laissait le pacte intact. */
        p.attackedNow = true; vict.raidedNow = true;
        if (p.pact === vict.id) breakPact(st, p, vict);
        if (!vict.tyran) loseDip(st, p, 1, 'attack (Trebuchets)');
        t.blds.splice(iT, 1);
        // règle générale : raser un temple coûte 1 diplomatie de plus, sauf contre un Tyran
        if (bT.t === 'T' && !vict.tyran) loseDip(st, p, 1, 'temple destroyed');
        u.fought = true; u.movesLeft = 0;
        log(st, p.name + '’s Trebuchets reduce the ' + B[bT.t].name.toLowerCase() + ' at ' + t.name + ' to rubble.', p.id, 'devastate');
        break;
      }
    }
    checkWin(st);
  }

  /* ---------- validations de recrutement ---------- */
  FOF.canBuy = function (st, key) {
    var p = FOF.cur(st), def = FOF.unitDef(key), army = FOF.army(st, p.id);
    if (st.phase !== 'recruit') return 'Not in the Recruit phase.';
    // v1.9.24 : 3 achats le tour où Yusuf active son pouvoir, 1 sinon
    var achats = p.flags.buys || (p.flags.bought ? 1 : 0), maxAchats = p.flags.yusuf ? 3 : 1;
    if (achats >= maxAchats) return maxAchats > 1 ? 'You’ve already made your ' + maxAchats + ' purchases this turn.' : 'You’ve already bought a unit this turn.';
    if (army.length >= 4) return 'Army full (4 units).';
    var el = army.filter(function (u) { return FOF.isElite(u.key); }).length;
    if (FOF.isElite(key) && el >= 3) return 'Already 3 elite units.';
    if (!FOF.isElite(key) && army.length - el >= 3) return 'Already 3 special units.';
    if (p.gold < def.upkeep) return 'Not enough gold (' + def.upkeep + ' needed).';
    if (def.req[0] === 'D') {
      if (p.tyran) return 'A Tyrant can’t recruit this unit.';
      if (p.dip < def.req[1]) return def.req[1] + ' Diplomacy required.';
    } else if (FOF.countBld(st, p.id, def.req[0]) < def.req[1]) return 'Requires: ' + def.req[1] + ' × ' + B[def.req[0]].name + '.';
    // v1.9.9 - la condition de l'Ambassadeur est passée de « 3 diplomatie » à « 1 ambassade ».
    // L'interdiction faite au Tyran, portée jusqu'ici par la branche 'D', est conservée telle quelle :
    // un tyran devenu tel APRÈS avoir bâti son ambassade la garde, mais ne recrute pas d'ambassadeur.
    if (key === 'ambassadeur' && p.tyran) return 'A Tyrant can’t recruit this unit.';
    if (!FOF.deploySpots(st, key).length) return 'No territory to deploy it on.';
    return null;
  };
  FOF.deploySpots = function (st, key) {
    var p = FOF.cur(st), def = FOF.unitDef(key);
    if (def.req[0] === 'D') return [p.capital];
    return FOF.terrOf(st, p.id).filter(function (t) { return t.blds.some(function (b) { return b.t === def.req[0]; }); }).map(function (t) { return t.id; });
  };
  // Nombre d'emplacements d'aménagement d'un territoire : 3 dans la capitale de son propriétaire,
  // 2 partout ailleurs. Utilisé par la construction, la Colonie et le déménagement de capitale.
  // bâtisseur d'un aménagement ; les parties d'avant la v1.9.12 ne le notaient pas : on retient alors le propriétaire
  FOF.batisseur = function (b) { return b.b === undefined ? b.o : b.b; };
  FOF.cedable = function (b, pid) { return b.o === pid && FOF.batisseur(b) === pid; };
  // aménagement étranger le moins cher d'une case (ordre de construction en cas d'égalité)
  FOF.ciblePacification = function (t, pid) {
    var etr = t.blds.filter(function (b) { return b.o !== pid; });
    etr.sort(function (a, b) { return B[a.t].cost - B[b.t].cost || FOF.BUILDING_ORDER.indexOf(a.t) - FOF.BUILDING_ORDER.indexOf(b.t); });
    return etr[0] || null;
  };
  FOF.slotsOf = function (st, p, tid) { return p && p.capital === tid ? 3 : 2; };
  FOF.canBuild = function (st, tid, type) {
    var p = FOF.cur(st), t = T(st, tid);
    if (st.phase !== 'build') return 'Not in the Build phase.';
    if (t.ctrl !== p.id) return 'This territory isn’t yours.';
    // v1.9.6 - emplacements : 3 sur la capitale, 2 sur tout autre territoire. TOUT compte
    // désormais, temple et ambassade inclus (les deux exemptions de la v1.9.2 sont annulées).
    var slots = FOF.slotsOf(st, p, tid);
    if (t.blds.length >= slots) return 'Already ' + slots + ' buildings.';
    if (type !== 'C' && t.blds.some(function (b) { return b.t === type; })) return 'There’s already a ' + B[type].name.toLowerCase() + ' here.';
    if (type === 'P' && !t.seas.length) return 'A port must be on the coast.';
    if (type === 'A' && tid !== p.capital) return 'An embassy can only be built in your capital.';
    if (type === 'A' && p.tyran) return 'A Tyrant no longer has any foreign court.';
    if (p.gold < FOF.bldCost(st, p, type)) return 'Not enough gold.';
    return null;
  };

  /* ---------- point d'entrée unique ---------- */
  FOF.act = function (st, a) {
    if (st.winner) throw new Error('The game is over.');
    st.tLast = Date.now();
    var tenus = ambassadeursTenant(st);
    var p = FOF.cur(st);
    var pend = st.pending[0];
    // v1.9.11 - l'Espion se joue à tout moment, y compris au tour d'un autre et pendant une décision en attente
    var horsTour = a.type === 'spy' || a.type === 'spyDecide';
    if (pend && a.type !== 'resolve' && a.type !== 'deficitTake' && a.type !== 'surrender' && !horsTour) throw new Error('A decision is pending.');
    // v1.9.2 - anti-mauvais-clic : tant qu'aucune action n'a été jouée dans la phase en cours, on
    // peut revenir à la précédente. Toute action qui change l'état salit la phase.
    if (a.type !== 'nextPhase' && a.type !== 'prevPhase' && a.type !== 'surrender' && !horsTour) st.phaseClean = false;
    switch (a.type) {
      case 'prevPhase': {
        var ordp = ['collect', 'recruit', 'military', 'build'], ip = ordp.indexOf(st.phase);
        if (ip <= 0) throw new Error('You’re already in the first phase of your turn.');
        if (!st.phaseClean) throw new Error('You’ve already acted during this phase: you can’t go back.');
        st.phase = ordp[ip - 1]; st.phaseClean = true;
        log(st, p.name + ' goes back to the previous phase.', p.id, 'card');
        break;
      }
      case 'deficitTake': {
        // v1.9.19 : a.coins = { uid: nombre de pièces reprises }, validé d'un bloc
        if (!pend || pend.type !== 'deficit') throw new Error('Not possible.');
        var dp = st.players[pend.pid], errD = FOF.deficitValide(st, dp.id, a.coins || {}, pend.left);
        if (errD) throw new Error(errD);
        reprendre(st, dp, a.coins); st.pending.shift();
        break;
      }
      case 'resolve': resolvePending(st, a); break;
      case 'nextPhase': {
        var order = ['collect', 'recruit', 'military', 'build'];
        var i = order.indexOf(st.phase);
        if (i < 3) { st.phase = order[i + 1]; st.phaseClean = true; }
        else endTurn(st);
        break;
      }
      case 'edouard':
        // v1.9.24 : tant qu'il a 5 de diplomatie ou moins (avant : 3), créateur 08/10/2026
        if (p.leader !== 'edouard' || st.phase !== 'collect' || p.edouardUsed || p.dip > FOF.EDOUARD_MAX || p.gold < FOF.EDOUARD_COUT || p.tyran) throw new Error('Power unavailable.');
        if (p.attackedLast || p.raidedLast) throw new Error('The foreign courts close their doors.');
        p.gold -= FOF.EDOUARD_COUT; p.flags.edouard = true; p.edouardUsed = true; gainDip(st, p, 1, 'Édouard the Wise'); checkWin(st); break;
      /* v1.9.24 - Yusuf le Marchand (créateur, 08/10/2026) : une fois par partie, pendant son recrutement,
         il peut acheter jusqu'à 3 cartes au lieu d'1, au prix normal, plafonds d'armée maintenus
         (réponse du 08/10). Les achats déjà faits ce tour comptent dans les 3. */
      case 'yusuf':
        if (p.leader !== 'yusuf' || st.phase !== 'recruit' || p.yusufUsed) throw new Error('Power unavailable.');
        p.yusufUsed = true; p.flags.yusuf = true;
        log(st, p.name + ' opens their coffers: up to 3 Market purchases this turn.', p.id, 'card'); break;
      case 'discardZone':
        // v1.6 : l'achat et la défausse sont indépendants (1 de chaque par tour) - avant, acheter bloquait la défausse.
        if (st.phase !== 'recruit' || p.flags.discarded) throw new Error('You’ve already discarded a card this turn.');
        if (!st.zone[a.slot]) throw new Error('This Market slot is empty.');
        var defausse = st.zone[a.slot];
        st.discard.push(defausse); st.zone[a.slot] = draw(st); p.flags.discarded = true;
        // v1.9.24 : la chronique nomme la carte défaussée (créateur, 08/10/2026)
        log(st, p.name + ' discards “' + FOF.unitDef(defausse).name + '” from the Market.', p.id, 'card'); break;
      /* v1.9.11 - Espion (décision du créateur, 27/09/2026) : gratuit à l'achat, sans entretien.
         Usage UNIQUE, à tout moment, y compris pendant le tour d'un autre joueur : 1 or, on regarde
         en secret la carte du dessus du deck, puis on choisit de la défausser ou non ('spyDecide').
         L'Espion est défaussé dès qu'il a servi. a.pid = le joueur qui l'utilise. */
      case 'spy': {
        var sp = a.pid === undefined ? p : st.players[a.pid];
        if (!sp || !sp.alive) throw new Error('Spy unavailable.');
        var eu = st.units.filter(function (x) { return x.owner === sp.id && x.key === 'espion'; })[0];
        if (!eu) throw new Error('You don’t have a Spy.');
        st.spies = st.spies || {};
        if (st.spies[sp.id]) throw new Error('First decide what to do with the card you already looked at.');
        if (sp.gold < 1) throw new Error('You need 1 gold to send the Spy.');
        if (!st.deck.length) { st.deck = st.discard; st.discard = []; FOF.shuffle(st, st.deck); }
        if (!st.deck.length) throw new Error('The deck is empty.');
        sp.gold -= 1; discardUnit(st, eu);
        st.spies[sp.id] = { key: st.deck[st.deck.length - 1], n: st.deck.length };
        log(st, sp.name + '’s Spy lifts the top card of the deck.', sp.id, 'card');
        break;
      }
      case 'spyDecide': {
        var sd = a.pid === undefined ? p : st.players[a.pid], vu = st.spies && sd ? st.spies[sd.id] : null;
        if (!vu) throw new Error('No card looked at.');
        delete st.spies[sd.id];
        // la carte a pu être piochée entre-temps : la décision ne vaut que si elle est toujours dessus
        var encore = st.deck.length === vu.n && st.deck[st.deck.length - 1] === vu.key;
        // v1.9.24 : la carte défaussée est nommée (elle est de toute façon visible dans la défausse)
        if (a.discard && encore) { var kSpy = st.deck.pop(); st.discard.push(kSpy); log(st, sd.name + ' discards “' + FOF.unitDef(kSpy).name + '”, the top card of the deck.', sd.id, 'card'); }
        break;
      }
      case 'buy': {
        var key = st.zone[a.slot], err = FOF.canBuy(st, key);
        if (err) throw new Error(err);
        if (FOF.deploySpots(st, key).indexOf(a.tid) < 0) throw new Error('Can’t deploy here.');
        var def = FOF.unitDef(key);
        p.gold -= def.upkeep;
        var nu = { uid: st.uid++, key: key, owner: p.id, pos: 't' + a.tid, gold: def.upkeep, arr: st.turnNo, moved: 0, fought: false, pacif: false };
        nu.movesLeft = FOF.unitMove(st, nu);
        st.units.push(nu); st.zone[a.slot] = draw(st); p.flags.bought = true; p.flags.buys = (p.flags.buys || 0) + 1; p.tally.recruit++;
        log(st, p.name + ' enlists ' + def.name + ' at ' + T(st, a.tid).name + '.', p.id, 'recruit'); break;
      }
      case 'release': {
        var ur = st.units.filter(function (x) { return x.uid === a.uid && x.owner === p.id; })[0];
        // v1.9.2 : on licencie POUR racheter dans le même tour (bouton tête de mort).
        if (!ur || st.phase !== 'recruit') throw new Error('You can only disband units in the Recruit phase.');
        if (p.flags.released) throw new Error('Only one unit can be disbanded per turn.');
        log(st, p.name + ' disbands their ' + FOF.unitDef(ur.key).name + ': the coins invested are lost.', p.id, 'card');
        discardUnit(st, ur); p.flags.released = true; break;
      }
      case 'move': {
        if (st.phase !== 'military') throw new Error('Movement happens in the Military phase.');
        if (a.piece === 'L') {
          if (p.lConq || p.lFought || p.lMovesLeft <= 0) throw new Error('Your leader can’t move anymore.');
          var rl = FOF.reach(st, p.lpos, 'L', p, p.lMovesLeft), hopL = rl[a.to] === undefined && FOF.portHops(st, p, p.lpos, p.lMovesLeft).indexOf(a.to) >= 0;
          if (rl[a.to] === undefined && !hopL) throw new Error('Space out of range.');
          if (hopL) log(st, 'Guided by the Cartographer, ' + p.name + '’s leader sails to the port of ' + T(st, +a.to.slice(1)).name + '.', p.id, 'move');
          // v1.9.24 - bilan : cases parcourues (un passage de port à port compte pour 1)
          p.tally.cases = (p.tally.cases || 0) + (hopL ? 1 : rl[a.to]);
          p.lMovesLeft = hopL ? 0 : p.lMovesLeft - rl[a.to]; p.lFromSea = p.lpos[0] === 's'; p.lpos = a.to; p.lArr = st.turnNo; p.lMoved = true;
        } else {
          var mu = st.units.filter(function (x) { return x.uid === a.piece && x.owner === p.id; })[0];
          if (!mu || mu.fought || mu.pacif || mu.movesLeft <= 0) throw new Error('This unit can’t move anymore.');
          var ru = FOF.reach(st, mu.pos, mu, p, mu.movesLeft), hopU = ru[a.to] === undefined && FOF.portHops(st, p, mu.pos, mu.movesLeft).indexOf(a.to) >= 0;
          if (ru[a.to] === undefined && !hopU) throw new Error('Space out of range.');
          if (hopU) log(st, 'Guided by the Cartographer, ' + p.name + '’s ' + FOF.unitDef(mu.key).name + ' reach the port of ' + T(st, +a.to.slice(1)).name + '.', p.id, 'move');
          p.tally.cases = (p.tally.cases || 0) + (hopU ? 1 : ru[a.to]);
          mu.movesLeft = hopU ? 0 : mu.movesLeft - ru[a.to]; mu.fromSea = mu.pos[0] === 's'; mu.pos = a.to; mu.arr = st.turnNo; mu.moved++;
        }
        break;
      }
      case 'conquer': {
        var lt = p.lpos && p.lpos[0] === 't' ? T(st, +p.lpos.slice(1)) : null;
        if (st.phase !== 'military' || !lt || lt.ctrl !== null || p.lArr >= st.turnNo || p.lMoved || p.lFought) throw new Error('Can’t conquer: your leader must have been on this neutral territory since your previous turn.');
        if (lt.revoltFrom === p.id) throw new Error('This territory rose up against you: its people will never recognize you. Another player must take it back before you can.');
        lt.ctrl = p.id; lt.conqStamp = st.turnNo; lt.revoltFrom = null; lt.takenFrom = null; p.lConq = true; p.lMovesLeft = 0; p.tally.conquest++;
        log(st, p.name + ' plants their banner on ' + lt.name + '.', p.id, 'conquer'); checkWin(st); break;
      }
      case 'attack': if (st.phase !== 'military') throw new Error('Attacks happen in the Military phase.'); doAttack(st, a); break;
      case 'pacify': {
        var pt = T(st, a.tid), el2 = st.units.filter(function (x) { return x.uid === a.uid && x.owner === p.id; })[0];
        if (st.phase !== 'military' || pt.ctrl !== p.id || !(pt.conqStamp < st.turnNo) || !el2 || !FOF.isElite(el2.key) || el2.pos !== 't' + pt.id || el2.arr >= st.turnNo || el2.moved || el2.fought || !pt.blds.some(function (b) { return b.o !== p.id; }))
          throw new Error('Can’t pacify: an elite unit must have been here since your previous turn.');
        // v1.9.14 - une seule pacification par tour, et elle convertit l'aménagement étranger le MOINS
        // CHER de la case (décision du créateur, 28/09/2026). Plus de choix du joueur.
        if (p.flags.pacified) throw new Error('You’ve already pacified a building this turn.');
        var cible = FOF.ciblePacification(pt, p.id);
        el2.pacif = true; el2.movesLeft = 0; p.flags.pacified = true;
        if (cible.t === 'A') {
          // une ambassade ne se rallie pas : elle est rasée (voir convertir()).
          pt.blds.splice(pt.blds.indexOf(cible), 1);
          log(st, p.name + ' shuts down the embassy at ' + pt.name + '.', p.id, 'bad');
        } else {
          cible.o = p.id;
          log(st, p.name + ' pacifies the ' + B[cible.t].name.toLowerCase() + ' at ' + pt.name + ': its people come over to their side.', p.id, 'convert');
        }
        checkWin(st); break;
      }
      case 'effect': {
        var eu = st.units.filter(function (x) { return x.uid === a.uid && x.owner === p.id; })[0];
        if (!eu || !FOF.effectAvailable(st, eu)) throw new Error('Effect unavailable.');
        if (st.phase !== 'military') throw new Error('Effects are played in the Military phase.');
        useEffect(st, eu, a.arg); break;
      }
      case 'build': {
        var e2 = FOF.canBuild(st, a.tid, a.btype); if (e2) throw new Error(e2);
        var c = FOF.bldCost(st, p, a.btype); p.gold -= c; T(st, a.tid).blds.push({ t: a.btype, o: p.id, b: p.id }); p.tally.build++;
        log(st, p.name + ' raises a ' + B[a.btype].name.toLowerCase() + ' at ' + T(st, a.tid).name + ' (' + c + ' gold).', p.id, 'build'); checkWin(st); break;
      }
      case 'replace': {
        var rt = T(st, a.tid), old = rt.blds[a.idx];
        if (st.phase !== 'build' || rt.ctrl !== p.id || !old || old.o !== p.id || old.t === a.btype) throw new Error('Can’t replace.');
        if (a.btype !== 'C' && rt.blds.some(function (b, i) { return i !== a.idx && b.t === a.btype; })) throw new Error('Already on this territory.');
        if (a.btype === 'P' && !rt.seas.length) throw new Error('A port must be on the coast.');
        // v1.9.9 - le remplacement contournait les deux règles de l'ambassade : on pouvait en poser
        // une hors de sa capitale, et un tyran pouvait s'en offrir une.
        if (a.btype === 'A' && a.tid !== p.capital) throw new Error('An embassy can only be built in your capital.');
        if (a.btype === 'A' && p.tyran) throw new Error('A Tyrant no longer has any foreign court.');
        var rc = FOF.bldCost(st, p, a.btype); if (p.gold < rc) throw new Error('Not enough gold.');
        p.gold -= rc; rt.blds[a.idx] = { t: a.btype, o: p.id, b: p.id };
        log(st, p.name + ' razes the ' + B[old.t].name.toLowerCase() + ' at ' + rt.name + ' to raise a ' + B[a.btype].name.toLowerCase() + ' in its place.', p.id, 'build'); checkWin(st); break;
      }
      case 'moveCapital': {
        var ct = T(st, a.tid);
        if (st.phase !== 'build' || ct.ctrl !== p.id || ct.id === p.capital || p.gold < 8) throw new Error('Can’t move the capital.');
        p.gold -= 8;
        // l'Ambassade ne tient qu'à la capitale : la cour partie, elle est rasée.
        var oldCap = T(st, p.capital), razed = false;
        oldCap.blds = oldCap.blds.filter(function (b) {
          if (b.t === 'A' && b.o === p.id) { razed = true; return false; }
          return true;
        });
        p.capital = ct.id;
        log(st, p.name + ' moves their court to ' + ct.name + '.', p.id, 'build');
        if (razed) log(st, p.name + '’s embassy at ' + oldCap.name + ' closes its doors: the court is gone.', p.id, 'bad');
        // v1.9.6 - l'ancienne capitale redevient un territoire ordinaire : 2 emplacements. Si elle
        // en occupe encore 3, le joueur doit en raser un avant de poursuivre.
        if (oldCap.blds.length > FOF.slotsOf(st, p, oldCap.id)) st.pending.push({ type: 'razeSlot', pid: p.id, tid: oldCap.id });
        break;
      }
      case 'cede': throw new Error('Voluntary surrender of territory no longer exists.');
      case 'surrender': {
        var sp = a.pid === undefined ? p : st.players[a.pid];
        if (!sp || !sp.alive || st.winner) throw new Error('Can’t forfeit.');
        log(st, sp.name + ' withdraws from the war.', sp.id, 'elim');
        eliminate(st, sp);
        if (!st.winner && sp.id === st.cur) nextPlayer(st);   // on passe au joueur suivant
        break;
      }
      default: throw new Error('Unknown action: ' + a.type);
    }
    verifierPactes(st, tenus);
    advancePending(st);
    oublierProche(st);
    return st;
  };

  function resolvePending(st, a) {
    var pend = st.pending[0]; if (!pend) throw new Error('No pending decision.');
    if (pend.type === 'conquest') {
      var t = T(st, pend.tid), att = st.players[pend.pid], def = st.players[pend.def];
      st.pending.shift();
      if (a.choice === 'devastate') {
        var temples = t.blds.filter(function (b) { return b.t === 'T' && b.o !== att.id; }).length;
        if (!def.tyran) { loseDip(st, att, 1, 'pillage'); if (temples) loseDip(st, att, temples, 'temple destroyed'); }
        // v1.9.14 - le territoire dévasté ne redevient plus neutre : il revient au vainqueur,
        // tous ses aménagements rasés (le coût en diplomatie ne change pas).
        t.ctrl = att.id; t.conqStamp = st.turnNo; t.revoltFrom = null; t.blds = []; t.takenFrom = null;
        log(st, att.name + ' sacks ' + t.name + ' and seizes it.', att.id, 'devastate');
      } else {
        t.ctrl = att.id; t.conqStamp = st.turnNo; t.revoltFrom = null;
        log(st, att.name + ' seizes ' + t.name + '.', att.id, 'conquer');
      }
      if (def.alive && t.id === def.capital && a.choice !== 'keep') {
        log(st, def.name + '’s capital has fallen!', def.id, 'capfall'); eliminate(st, def);
        // v1.9.15 (décision du créateur, 29/09/2026) : une capitale conquise redevient un territoire
        // ordinaire à 2 emplacements ; s'il lui reste 3 aménagements, le vainqueur en rase un.
        if (!st.winner && att.alive && t.ctrl === att.id && t.blds.length > FOF.slotsOf(st, att, t.id)) st.pending.push({ type: 'razeSlot', pid: att.id, tid: t.id, cause: 'conquete' });
      }
      checkWin(st);
    } else if (pend.type === 'cedeTerritory') {
      var loser = st.players[pend.pid], t2 = T(st, a.tid);
      if (t2.ctrl !== loser.id || t2.id === loser.capital) throw new Error('Choose one of your territories, other than your capital.');
      st.pending.shift();
      t2.ctrl = pend.to; t2.conqStamp = st.turnNo; t2.revoltFrom = null; t2.takenFrom = null;
      log(st, 'Defeated, ' + loser.name + ' gives up ' + t2.name + ' to ' + st.players[pend.to].name + '.', loser.id, 'cedeterr');
      checkWin(st);
    } else if (pend.type === 'revolt') {
      var ty = st.players[pend.pid], t3 = T(st, a.tid);
      if (t3.ctrl !== ty.id || t3.id === ty.capital) throw new Error('Choose a territory other than the capital.');
      st.pending.shift();
      t3.ctrl = null; t3.blds = []; t3.takenFrom = null; t3.revoltFrom = ty.id;   // le tyran ne peut plus la reprendre
      log(st, 'The people of ' + t3.name + ' rise up against the Tyrant ' + ty.name + '.', ty.id, 'revolt');
      nextPlayer(st);
    } else if (pend.type === 'razeSlot') {
      var rp = st.players[pend.pid], rt = T(st, pend.tid), ri2 = a.idx;
      if (!rt.blds[ri2]) throw new Error('Choose a building to raze.');
      var rb = rt.blds[ri2];
      st.pending.shift();
      rt.blds.splice(ri2, 1);
      log(st, 'With the court gone, the ' + B[rb.t].name.toLowerCase() + ' at ' + rt.name + ' is dismantled.', rp.id, 'bad');
      checkWin(st);
    } else throw new Error('Unknown decision.');
  }

  function endTurn(st) {
    st.players.forEach(function (q) { if (q.alive) q.tally.peak = Math.max(q.tally.peak, FOF.terrOf(st, q.id).length); });
    var p = FOF.cur(st);
    if (p.tyran && st.turnNo > p.tyranStamp) {
      var own = FOF.terrOf(st, p.id).filter(function (t) { return t.id !== p.capital; });
      if (!own.length) { log(st, 'The Tyrant ' + p.name + '’s capital rises up: their reign is over.', p.id, 'revolt'); eliminate(st, p); return; }
      st.pending.push({ type: 'revolt', pid: p.id });
      return;
    }
    nextPlayer(st);
  }
})(window.FOF = window.FOF || {});
