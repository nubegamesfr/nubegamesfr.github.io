/* Fields of Fire - statistiques de parties (une ligne par partie dans la table game_stats)

   v1.9.8 - SEULES LES PARTIES 100 % HUMAINES SONT ENREGISTRÉES.
   Les bots suivent une stratégie simple et régulière : leurs parties durent cinq à six fois plus
   longtemps que celles de vrais joueurs et ne disent rien de l'équilibrage réel. Une seule IA à la
   table suffit donc à écarter la partie : rien n'est envoyé, ni en cours de jeu, ni à l'abandon. */
(function (FOF) {
  'use strict';
  function humainsSeuls(st) {
    return !!st && !!st.players && !st.players.some(function (p) { return p.bot; });
  }
  FOF.statsHumainsSeuls = humainsSeuls;
  function uuid() { return (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); })); }

  // à appeler une fois à la création de la partie
  FOF.statsInit = function (st, mode, room) {
    if (st.meta) return;
    if (!humainsSeuls(st)) return;                     // une IA à la table : aucune trace
    st.meta = { gid: uuid(), mode: mode, room: room || null, startedAt: new Date().toISOString(), lastTurn: 0, gold: st.players.map(function () { return [0, 0]; }), maxTerr: st.players.map(function () { return 0; }) };
  };
  function sample(st) {
    st.players.forEach(function (p, i) {
      if (!p.alive) return;
      st.meta.gold[i][0] += p.gold; st.meta.gold[i][1]++;
      st.meta.maxTerr[i] = Math.max(st.meta.maxTerr[i], FOF.terrOf(st, p.id).length);
    });
  }
  function row(st, extra) {
    var m = st.meta, now = new Date(), w = st.winner;
    var players = st.players.map(function (p, i) {
      var g = m.gold[i];
      return { seat: i, leader: p.leader, alive: p.alive, tyran: !!p.tyran, gold: p.gold, avg_gold: g[1] ? +(g[0] / g[1]).toFixed(2) : p.gold, dip: p.dip,
        territories: FOF.terrOf(st, p.id).length, max_territories: m.maxTerr[i], temples: FOF.countBld(st, p.id, 'T'), cities: FOF.countBld(st, p.id, 'Ci'),
        units: FOF.army(st, p.id).length, winner: !!(w && w.pid === p.id) };
    });
    var alive = players.filter(function (p) { return p.alive; });
    return Object.assign({
      id: m.gid, mode: m.mode, room_code: m.room, n_players: st.players.length,
      leaders: st.players.map(function (p) { return p.leader; }),
      started_at: m.startedAt, updated_at: now.toISOString(),
      duration_sec: Math.round((now - new Date(m.startedAt)) / 1000),
      rounds: st.round, turns: st.turnNo, phase: st.phase,
      finished: !!w, abandoned: false,
      ended_at: w ? now.toISOString() : null,
      winner_leader: w ? st.players[w.pid].leader : null, winner_seat: w ? w.pid : null, victory_type: w ? w.type : null,
      avg_gold: players.length ? +(players.reduce(function (s, p) { return s + p.avg_gold; }, 0) / players.length).toFixed(2) : null,
      n_tyrans: players.filter(function (p) { return p.tyran; }).length, n_alive: alive.length,
      players: players, victory_cfg: st.victory, app_version: FOF.CONFIG.version
    }, extra || {});
  }
  function send(r) {
    if (!FOF.CONFIG.supabaseUrl || !FOF.CONFIG.supabaseKey) return;
    FOF.sbReq('POST', 'game_stats?on_conflict=id', r, 'resolution=merge-duplicates,return=minimal').catch(function (e) { console.warn('stats', e.message); });
  }
  // à appeler après chaque action par le client qui a joué
  FOF.statsTick = function (st) {
    if (!st.meta || !humainsSeuls(st)) return;
    var ended = !!st.winner && !st.meta.sentEnd;
    if (st.turnNo !== st.meta.lastTurn || ended) {
      if (st.turnNo !== st.meta.lastTurn) { sample(st); st.meta.lastTurn = st.turnNo; }
      if (ended) st.meta.sentEnd = true;
      send(row(st));
    }
  };
  // Les parties sauvegardées avant cette version peuvent contenir des bots : on revérifie ici,
  // sinon une vieille sauvegarde rejouée enverrait encore sa ligne à l'abandon.
  FOF.statsAbandon = function (st) { if (st && st.meta && !st.winner && humainsSeuls(st)) send(row(st, { abandoned: true })); };
})(window.FOF = window.FOF || {});
