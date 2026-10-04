/* Fields of Fire - statistiques de parties (une ligne par partie dans la table game_stats)

   v1.9.8 - SEULES LES PARTIES 100 % HUMAINES SONT ENREGISTRÉES.
   Les bots suivent une stratégie simple et régulière : leurs parties durent cinq à six fois plus
   longtemps que celles de vrais joueurs et ne disent rien de l'équilibrage réel. Une seule IA à la
   table suffit donc à écarter la partie : rien n'est envoyé, ni en cours de jeu, ni à l'abandon. */
(function (FOF) {
  'use strict';
  /* v1.9.18 - décision du 04/10/2026 (Awen) : une partie compte dès qu'au moins un humain est à la
     table ; seules les parties 100 % bots sont écartées. Chaque joueur porte désormais « bot » dans
     players, pour pouvoir séparer les tables mixtes à l'analyse. Et une partie de moins de 5 minutes
     n'est jamais envoyée (ni en cours, ni à la fin, ni à l'abandon). */
  FOF.STATS_DUREE_MIN = 300;   // secondes
  function humainsSeuls(st) {   // nom conservé : « au moins un humain »
    return !!st && !!st.players && st.players.some(function (p) { return !p.bot; });
  }
  FOF.statsHumainsSeuls = humainsSeuls;
  // v1.9.18 - et une partie restée au tour 1 non plus (décision du 04/10/2026)
  function assezLongue(st) { return !!st.meta && st.round >= 2 && (Date.now() - new Date(st.meta.startedAt)) / 1000 >= FOF.STATS_DUREE_MIN; }
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
      return { seat: i, leader: p.leader, bot: !!p.bot, alive: p.alive, tyran: !!p.tyran, gold: p.gold, avg_gold: g[1] ? +(g[0] / g[1]).toFixed(2) : p.gold, dip: p.dip,
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
      players: players, app_version: FOF.CONFIG.version,
      // v1.9.17 - la carte jouée (« proc » = générée) est rangée dans ce champ JSON : pas de nouvelle colonne en base
      victory_cfg: Object.assign({}, st.victory, { carte: (st.map && st.map.hist) || 'proc' })
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
      if (!assezLongue(st)) return;   // ni ligne ni fin envoyées avant 5 minutes
      if (ended) st.meta.sentEnd = true;
      send(row(st));
    }
  };
  // Les parties sauvegardées avant cette version peuvent contenir des bots : on revérifie ici,
  // sinon une vieille sauvegarde rejouée enverrait encore sa ligne à l'abandon.
  FOF.statsAbandon = function (st) { if (st && st.meta && !st.winner && humainsSeuls(st) && assezLongue(st)) send(row(st, { abandoned: true })); };
})(window.FOF = window.FOF || {});
