/* Fields of Fire — interface (hot-seat, 3 à 6 joueurs sur le même écran) */
(function (FOF) {
  'use strict';
  var calmT = null, radial = null, st = null, sel = null, mode = null, pop = null, err = '', modal = null, lastTurnShown = 0, zoom = 1, marketOpen = true, net = null, combatSig = '';
  // pile d'annulation : uniquement les déplacements de la phase militaire, tant qu'aucune action
  // irréversible (combat, conquête, effet, changement de phase) n'a été jouée depuis.
  var undoStack = [];
  // taille retenue du plateau (voir renderBoard) : évite que la carte saute à chaque rendu
  var fitBox = null;
  var SAVE = 'fof-save-v1';
  var $ = function (id) { return document.getElementById(id); };
  var esc = FOF.esc;
  // v1.9 : pendant le tour d'un adversaire, l'interface se redessinait entièrement à chaque action
  // (jusqu'à plusieurs fois par seconde). Réécrire un bloc identique provoque un reflow et un
  // clignotement. On n'écrit plus que si le contenu a réellement changé.
  function setHTML(el, html) {
    if (!el) return;
    if (el.dataset.sig === html) return;
    el.dataset.sig = html; el.innerHTML = html;
  }
  function color(pid) { var p = st.players[pid]; return FOF.PLAYER_COLORS.filter(function (c) { return c.id === p.color; })[0].hex; }
  function bIcon(t, h) { return '<img src="assets/icons/bld-' + t + '.png" alt="' + FOF.BUILDINGS[t].name + '"' + (h ? ' style="height:' + h + 'px"' : '') + '>'; }
  // v1.9.6 — variante dorée, pour les boutons à fond sombre (construction, remplacement).
  function bIconOr(t, h) { return '<img src="assets/icons/bld-' + t + '-or.png" alt="' + FOF.BUILDINGS[t].name + '"' + (h ? ' style="height:' + h + 'px"' : '') + '>'; }

  function save() { if (net) return; try { localStorage.setItem(SAVE, JSON.stringify(st)); } catch (e) {} }
  FOF.loadSaved = function () {
    try {
      var raw = localStorage.getItem(SAVE), o = raw ? JSON.parse(raw) : null;
      if (o && FOF.expired && FOF.expired(o)) { FOF.statsAbandon(o); FOF.clearSaved(); return null; }  // abandon automatique après 48 h
      // v1.8 : les parties locales d'avant la remise à zéro sont retirées elles aussi
      if (o && FOF.PURGE_BEFORE && o.t0 < FOF.PURGE_BEFORE) { FOF.statsAbandon(o); FOF.clearSaved(); return null; }
      return o;
    } catch (e) { return null; }
  };
  FOF.clearSaved = function () { try { localStorage.removeItem(SAVE); } catch (e) {} };

  // net : salon en ligne (null = jeu local sur un seul écran)
  FOF.startUI = function (state, room) {
    st = state; sel = null; mode = null; pop = null; err = ''; modal = null; lastTurnShown = 0; zoom = 1; marketOpen = true; fitBox = null; undoStack.length = 0;
    if (net) net.stop();
    net = room || null; combatSig = sig(st.lastCombat);
    if (!net) FOF.statsInit(st, 'local');
    $('setup').hidden = true; $('game').hidden = false;
    document.body.classList.toggle('online', !!net);
    FOF.Board.prepare(st, $('baseCv'), function () { render(); });
    if (net) {
      net.on(function (row) {
        if (!row.state || !st) return;
        var mine = myTurn();
        st = row.state;
        if (!myTurn()) { mode = null; if (modal && modal.kind === 'attack') modal = null; }
        var s2 = sig(st.lastCombat);
        if (s2 !== combatSig) { combatSig = s2; if (st.lastCombat && !modal) modal = { kind: 'combat' }; }
        render();
      });
      net.start(1500);
    }
    render(); save();
  };
  function sig(c) { return c ? JSON.stringify([c.loc, c.att, c.def, c.rolls]) : ''; }
  function actor() { var pd = st.pending[0]; return pd ? pd.pid : st.cur; }
  function isBotActor() { var w = st && st.players[actor()]; return !!(w && w.bot); }
  function myTurn() { if (isBotActor()) return false; return !net || net.seatIndex() === actor(); }
  FOF.myTurn = function () { return !!st && myTurn(); };
  FOF.currentNet = function () { return net; };
  FOF.currentState = function () { return st; };
  FOF.rerender = function () { if (st) render(); };

  function canUndo() { return !!(undoStack.length && st && st.phase === 'military' && !st.pending.length && !st.winner && myTurn()); }
  function undoMove() {
    if (!canUndo()) return;
    var snap = undoStack.pop();
    try { st = JSON.parse(snap); } catch (e) { undoStack.length = 0; return; }
    mode = null; pop = null; err = ''; sel = null;
    if (FOF.FX) FOF.FX.reset();
    if (net) net.pushState(st).then(function (ok) { if (!ok) { err = 'Synchronisation : l’état a été rechargé.'; render(); } }, function (e) { err = 'Connexion perdue : ' + e.message; render(); });
    if (FOF.sfx) FOF.sfx('move');
    render(); save();
  }
  function dispatch(a, keepPop, force) {
    if (!force && !myTurn()) { err = isBotActor() ? 'L’ordinateur est en train de jouer…' : 'Ce n’est pas à vous de jouer.'; return render(); }
    // un déplacement est annulable ; tout le reste vide la pile
    var pushed = false;
    if (a.type === 'move' && st.phase === 'military' && !st.pending.length) {
      try { undoStack.push(JSON.stringify(st)); pushed = true; } catch (e) {}
      while (undoStack.length > 20) undoStack.shift();
    } else undoStack.length = 0;
    try { FOF.act(st, a); err = ''; }
    catch (e) { err = e.message; if (pushed) undoStack.pop(); if (FOF.sfx && !force) FOF.sfx('error'); }
    if (!err) {
      FOF.statsTick(st);
      if (a.type === 'attack') combatSig = sig(st.lastCombat);
      if (net) net.pushState(st).then(function (ok) { if (!ok) { err = 'Synchronisation : l’état a été rechargé.'; render(); } }, function (e) { err = 'Connexion perdue : ' + e.message; render(); });
    }
    if (a.type === 'attack' && !err) modal = { kind: 'combat' };
    if (a.type === 'nextPhase' || a.type === 'resolve') { mode = null; pop = null; }
    if (!keepPop && !err) pop = null;
    if (a.type === 'nextPhase' && st.phase === 'recruit') marketOpen = true;
    render(); save();
  }

  /* ================= rendu ================= */
  function render() {
    if (!st) return;
    var viewModal = modal && (modal.kind === 'gloss' || modal.kind === 'deck' || modal.kind === 'help' || modal.kind === 'endstats' || modal.kind === 'hero' || modal.kind === 'edouardc' || modal.kind === 'settings' || modal.kind === 'capitalc' || modal.kind === 'killc' || modal.kind === 'stack');
    if (st.turnNo !== lastTurnShown && !st.winner && !viewModal && !modal) { lastTurnShown = st.turnNo; if ((!net || net.seatIndex() === st.cur) && !st.players[st.cur].bot) modal = { kind: 'turn' }; }
    if (st.winner && !viewModal) modal = { kind: 'victory' };
    var before = FOF.FX ? FOF.FX.before() : null;
    renderHeader(); renderOpponents(); renderBoard(); renderMat(); renderRight(); renderModal();
    var waiting = !st.winner && !myTurn();
    document.body.classList.toggle('waiting', waiting);
    document.body.style.setProperty('--wc', color(actor()));
    if (waiting) startWaitClock();
    tickWait();
    if (FOF.FX) FOF.FX.after(st, before, { color: color, myTurn: myTurn(), online: !!net, seat: net ? net.seatIndex() : null });
    // musique épique pendant les combats
    if (FOF.musicMode) {
      var battle = isBattle();
      if (battle) { clearTimeout(calmT); calmT = null; FOF.musicMode('battle'); }
      else if (!calmT) calmT = setTimeout(function () { calmT = null; if (!isBattle()) FOF.musicMode('calm'); }, 15000);
    }
    updateSpeedBtn();
    scheduleBot();
  }

  // musique de bataille : seulement quand un humain est concerné (pas pour les combats entre bots)
  function isBattle() {
    if (!modal || (modal.kind !== 'attack' && modal.kind !== 'combat')) return false;
    if (modal.kind === 'attack') return true;
    var c = st.lastCombat; if (!c) return false;
    var hum = function (pid) { var q = st.players[pid]; return q && !q.bot && (!net || net.seatIndex() === pid); };
    return hum(c.att) || hum(c.def);
  }
  /* ---------- adversaires ordinateur : ils jouent une action à la fois, à un rythme lisible ---------- */
  var botT = null;
  var SPEEDS = ['normal', 'rapide', 'turbo'], SPEED_MS = { normal: 1800, rapide: 950, turbo: 450 }, SPEED_LBL = { normal: 'Bots : normal', rapide: 'Bots : rapide', turbo: 'Bots : très rapide' };
  var botSpeed = 'rapide';
  try { var svS = localStorage.getItem('fof-botspeed'); if (SPEEDS.indexOf(svS) >= 0) botSpeed = svS; } catch (e) {}
  function updateSpeedBtn() {
    var b = $('speedBtn'); if (!b) return;
    b.hidden = !(st && st.players.some(function (q) { return q.bot; }));
    b.innerHTML = FOF.ic('helm', 15) + ' <span class="lbl">' + SPEED_LBL[botSpeed] + '</span>';
    b.title = 'Vitesse des actions des bots (cliquez pour changer)';
  }
  function botActive() {
    if (!st || st.winner || !isBotActor()) return false;
    if (net && !net.isHost()) return false;          // en ligne, c'est l'hôte qui fait jouer les bots
    return true;
  }
  function scheduleBot() {
    if (botT || !botActive()) return;
    var delay = SPEED_MS[botSpeed] * (FOF.animOn === false ? 0.6 : 1);
    if (modal && modal.kind === 'combat') delay = Math.max(1600, delay * 2.6);
    botT = setTimeout(function () {
      botT = null; if (!botActive()) return;
      if (modal && modal.kind === 'combat') { modal = null; if (FOF.FX_flushGold) FOF.FX_flushGold(); }
      var a = FOF.botAct(st); if (!a) return;
      dispatch(a, false, true);
      if (err) { FOF.botFailed(st, a); err = ''; render(); }
    }, delay);
  }

  var PHASES = [['collect', 'Collecte'], ['recruit', 'Recrutement'], ['military', 'Militaire'], ['build', 'Construction']];
  var PHASE_ING = { collect: 'compte ses revenus', recruit: 'parcourt le marché', military: 'manœuvre ses troupes', build: 'bâtit son royaume' };
  var PHASE_SHORT = { collect: 'compte', recruit: 'recrute', military: 'manœuvre', build: 'bâtit' };

  /* horloge d'attente : rafra\u00eechit les « depuis X » sans re-rendre toute l'interface */
  function sinceTxt(t) {
    var s = Math.max(0, Math.round((Date.now() - t) / 1000));
    if (s < 5) return '';
    if (s < 60) return 'depuis ' + s + ' s';
    var m = Math.floor(s / 60);
    return 'depuis ' + m + ' min' + (m > 1 ? '' : '') + (s % 60 >= 30 ? ' 30' : '');
  }
  var waitTimer = null;
  function tickWait() {
    var l = document.querySelectorAll('.wsec');
    for (var i = 0; i < l.length; i++) l[i].textContent = sinceTxt(+l[i].dataset.since);
  }
  function startWaitClock() { if (!waitTimer) waitTimer = setInterval(tickWait, 1000); }
  function renderHeader() {
    var pi = PHASES.map(function (x) { return x[0]; }).indexOf(st.phase);
    setHTML($('phases'), PHASES.map(function (x, i) { if (x[0] === 'collect') return ''; return '<span class="phase ' + (i === pi ? 'on' : i < pi ? 'done' : '') + '"><span class="n">' + i + '</span><span class="t">' + x[1] + '</span></span>'; }).join(''));
    setHTML($('roundChip'), 'Tour ' + st.round + (net ? ' · <span class="room-code" title="Code du salon">' + net.code + '</span> · vous : <b style="color:' + color(net.seatIndex()) + '">' + esc(st.players[net.seatIndex()].name) + '</b>' : ''));
  }

  function renderOpponents() {
    setHTML($('players'), '<div class="section-title">Dirigeants</div>' + st.players.map(function (p) {
      var terr = FOF.terrOf(st, p.id).length, tem = FOF.countBld(st, p.id, 'T');
      var pills = (p.tyran ? '<span class="pill tyran">Tyran</span>' : '') + (p.pact !== null ? '<span class="pill pact">Pacte</span>' : '') + (!p.alive ? '<span class="pill">Éliminé</span>' : '');
      var busy = p.id === actor() && p.alive && !st.winner && !myTurn();
      return '<div class="opp ' + (p.id === st.cur ? 'active ' : '') + (busy ? 'thinking ' : '') + (!p.alive ? 'dead' : '') + '" data-heroinfo="' + p.id + '" title="Voir la fiche de ' + esc(FOF.LEADERS[p.leader].name) + '" style="--pc:' + color(p.id) + '">' + FOF.heroImg(p.leader) +
        '<div><div class="nm"><span>' + esc(p.name) + (p.bot ? ' <small title="Ordinateur" class="botmark">' + FOF.ic('helm', 13) + '</small>' : '') + '</span>' + pills + '</div><div class="ld">' + esc(FOF.LEADERS[p.leader].name) + '</div>' +
        '<div class="st"><span title="Or"><span class="coin" style="width:11px;height:11px;vertical-align:-1px"></span> <b>' + p.gold + '</b></span>' +
        '<span title="Diplomatie">' + FOF.ic('branch', 17) + ' <b>' + (p.tyran ? '—' : p.dip) + '</b></span>' +
        '<span title="Territoires"><img class="icn" src="assets/icons/terr.svg" alt=""> <b>' + terr + '/' + st.victory.mil + '</b></span>' +
        '<span title="Temples"><img class="icn" src="assets/icons/bld-T.png" alt=""> <b>' + tem + '/' + st.victory.rel + '</b></span></div>' +
        (busy ? '<div class="thinking-row">' + FOF.ic(p.bot ? 'helm' : 'crown', 13) + ' <span>' + (p.bot ? 'réfléchit' : PHASE_SHORT[st.phase]) + '</span><i class="d"></i><i class="d"></i><i class="d"></i></div>' : '') +
        '</div></div>';
    }).join(''));
  }

  /* ---------- carte ---------- */
  function renderBoard() {
    var b = FOF.Board.bounds();
    var board = $('board'), wrap = $('boardWrap');
    if (!b) return;
    // v1.8 : le marché est dessiné d'abord, car sa hauteur décide de la place laissée à la carte.
    renderMarket();
    var mkt = $('market');
    // en mode réduit, la carte doit tenir entièrement au-dessus des vignettes : sinon son bas
    // reste caché derrière, ce qui est exactement ce qu'on cherchait à éviter en la réduisant.
    var mh = (mkt && !mkt.hidden && mkt.classList.contains('compact')) ? mkt.offsetHeight : 0;
    var dispoH = Math.max(80, board.clientHeight - 24 - (mh ? mh + 14 : 0));   // 14 px : le dégradé qui coiffe le marché
    // v1.9.1 — LE clignotement du mode en ligne : la barre du bas montre le joueur actif, et sa
    // hauteur change d'un joueur à l'autre (armée plus ou moins fournie, texte sur une ou deux
    // lignes). Le plateau se recalculait à chaque fois et sautait de 823×569 à 781×540 plusieurs
    // fois par seconde. On garde la taille tant que la place disponible n'a pas vraiment changé.
    var availW = Math.max(80, board.clientWidth - 24), availH = dispoH;
    var mapKey = Math.round(b.w) + 'x' + Math.round(b.h);
    if (!fitBox || fitBox.key !== mapKey || fitBox.mh !== mh ||
        Math.abs(availW - fitBox.w) > 4 || Math.abs(availH - fitBox.h) > 18) {
      fitBox = { key: mapKey, w: availW, h: availH, mh: mh };
    }
    var fit = Math.min(fitBox.w / b.w, fitBox.h / b.h);
    if (!(fit > 0)) fit = 1;
    var sc = fit * zoom;
    wrap.style.width = Math.round(b.w * sc) + 'px'; wrap.style.height = Math.round(b.h * sc) + 'px';
    wrap.style.marginTop = zoom === 1 ? Math.max(12, (fitBox.h - b.h * sc) / 2) + 'px' : '12px';
    wrap.dataset.scale = sc;
    var picks = pickTargets();
    FOF.Board.overlay(st, $('ovCv'), { sel: sel, picks: picks }, color);
    FOF.Board.ambient(st, $('amCv'));
    var blink = null;
    if (mode && mode.kind === 'move') blink = mode.reach;
    else if (mode && mode.kind === 'deploy') { blink = {}; mode.spots.forEach(function (tid) { blink['t' + tid] = 1; }); }
    FOF.Board.reach(st, $('rcCv'), blink);
    $('tokens').setAttribute('viewBox', b.x + ' ' + b.y + ' ' + b.w + ' ' + b.h);
    setHTML($('tokens'), tokensSVG());
    renderPopover(sc);
    renderRadial(sc, b);
    var ban = banner();
    $('banner').hidden = !ban; if (ban) $('banner').innerHTML = '<span>' + ban + '</span>' + (mode ? '<button class="btn small" data-cancel="1">Annuler</button>' : '');
  }
  function tokensSVG() {
    var out = ['<defs>'], m = st.map, p = FOF.cur(st);
    st.players.forEach(function (q) { out.push('<clipPath id="cl' + q.id + '"><circle r="10.5"/></clipPath>'); });
    out.push('<clipPath id="clu"><circle r="8"/></clipPath></defs>');
    // drapeaux de capitale, aménagements, marteaux de construction
    var canBuildHere = st.phase === 'build' && myTurn() && !st.pending.length && !st.winner;
    $('tokens').classList.toggle('nohit', st.phase === 'build');
    var mallets = [];
    // pions par case (calculés d'abord : drapeau + aménagements + pions doivent tenir dans la case)
    var byLoc = {};
    st.players.forEach(function (q) { if (q.alive && q.lpos) (byLoc[q.lpos] = byLoc[q.lpos] || []).push({ leader: true, owner: q.id }); });
    st.units.forEach(function (u) { (byLoc[u.pos] = byLoc[u.pos] || []).push(u); });
    var spot = {};
    function anchorOf(loc, nb, isCap, hasMallet) {
      if (spot[loc]) return spot[loc];
      var list = byLoc[loc] || [], n = Math.min(list.length, 5);
      var topW = (isCap ? 16 : 0) + nb * 17 + (hasMallet ? 24 : 0), tokW = n ? (n - 1) * 24 + 30 : 0;
      var W = Math.max(topW, tokW, 20), up = (nb || isCap) ? 25 : 14, down = n ? 20 : 6;
      return (spot[loc] = (FOF.Board.place(loc, W, up, down) || FOF.Board.anchor(loc)));
    }
    m.terr.forEach(function (t) {
      if (!FOF.Board.anchor('t' + t.id)) return;
      var hasMallet = canBuildHere && ['C', 'F', 'P', 'Ci', 'T'].some(function (ty) { return !FOF.canBuild(st, t.id, ty); });
      var a = anchorOf('t' + t.id, t.blds.length, false, hasMallet);
      // v1.9 : le drapeau de capitale n'est plus dessiné dans la couche SVG (il passait devant
      // les fenêtres de construction). Il est peint sur le calque d'ambiance, sous l'interface.
      var nb = t.blds.length, groupW = nb * 17 - (nb ? 2 : 0), gx0 = a.x - groupW / 2;
      t.blds.forEach(function (bd, i) {
        var bx = gx0 + i * 17, by = a.y - 16;
        // v1.9.6 — pastilles d'aménagement : fond sombre et icône dorée. Le fond beige et l'icône
        // noire se fondaient dans les terrains clairs de la carte.
        out.push('<rect x="' + bx + '" y="' + by + '" width="15" height="15" rx="3" fill="#201b14" stroke="' + color(bd.o) + '" stroke-width="2"/><image href="assets/icons/bld-' + bd.t + '-or.png" x="' + (bx + 2) + '" y="' + (by + 2) + '" width="11" height="11"/>');
      });
      if (hasMallet) {
        mallets.push('<g class="mallet" data-tloc="t' + t.id + '" transform="translate(' + (nb ? gx0 + groupW + 11 : a.x) + ' ' + (a.y - 8.5) + ')"><g class="bob"><circle r="9" fill="#f7efd9" stroke="#8a5a2b" stroke-width="1.4"/><g transform="rotate(-35)"><rect x="-1.2" y="-2" width="2.4" height="10" rx="1" fill="#9a6a3a" stroke="#4a2f16" stroke-width=".6"/><rect x="-5.5" y="-6.5" width="11" height="5.5" rx="1.4" fill="#c08a52" stroke="#4a2f16" stroke-width=".7"/><line x1="-2.5" y1="-6.3" x2="-2.5" y2="-1.2" stroke="#4a2f16" stroke-width=".5"/><line x1="2.5" y1="-6.3" x2="2.5" y2="-1.2" stroke="#4a2f16" stroke-width=".5"/></g><title>Construire ici</title></g></g>');
      }
    });
    // pions
    function puissanceDe(it, biome) {
      if (it.leader) return st.players[it.owner].mod;
      if (!FOF.isElite(it.key)) return 0;
      var d = FOF.unitDef(it.key);
      return biome ? d.pow[FOF.BIOMES.indexOf(biome)] : 0;
    }
    Object.keys(byLoc).forEach(function (loc) {
      if (!FOF.Board.anchor(loc)) return;
      var a = anchorOf(loc, 0, false, false);
      var tb = loc[0] === 't' ? m.terr[+loc.slice(1)].biome : null;
      var list = byLoc[loc], n = Math.min(list.length, 5), gap = 24;
      list.slice(0, 5).forEach(function (it, i) {
        var x = a.x + (i - (n - 1) / 2) * gap, y = a.y + 13;
        var col = color(it.owner), mine = it.owner === p.id, piece = it.leader ? 'L' : it.uid;
        var movable = mine && st.phase === 'military' && !st.pending.length && (it.leader ? !(p.lConq || p.lFought || p.lMovesLeft <= 0) : !(it.fought || it.pacif || it.movesLeft <= 0));
        var selected = mine && mode && mode.kind === 'move' && mode.piece === piece;
        var g = '<g class="tk' + (movable ? ' can' : '') + (it.owner === st.cur ? ' cur' : '') + '" data-tk="' + piece + '" data-tloc="' + loc + '" data-own="' + it.owner + '" data-x="' + x + '" data-y="' + y + '" transform="translate(' + x + ' ' + y + ')"><g class="tki"><g transform="scale(1.28)">';
        if (it.leader) {
          var art = FOF.heroArt(st.players[it.owner].leader);
          g += '<circle r="11.5" fill="' + col + '"/>' + (art ? '<image href="' + art + '" x="-10.5" y="-10.5" width="21" height="22" preserveAspectRatio="xMidYMin slice" clip-path="url(#cl' + it.owner + ')"/>' : '<text y="4" text-anchor="middle" font-size="12" fill="#fff">♛</text>') +
            '<circle class="ring" r="11.5" fill="none" stroke="' + (selected ? '#fff' : col) + '" stroke-width="' + (selected ? 3.5 : 2.5) + '"/><circle cx="8" cy="-8" r="4.2" fill="#f1d488" stroke="#2a2218" stroke-width=".8"/><text x="8" y="-7.6" class="mvbadge" style="font-size:5.5px">♛</text>';
        } else {
          var ua = FOF.unitArt(it.key), el = FOF.isElite(it.key);
          g += (el ? '<circle r="9" fill="' + col + '"/>' : '<rect x="-8.5" y="-8.5" width="17" height="17" rx="3" fill="' + col + '"/>') +
            (ua ? '<image href="' + ua + '" x="-8" y="-8" width="16" height="16" preserveAspectRatio="xMidYMid slice" clip-path="url(#clu)"/>' : '<text y="3" text-anchor="middle" font-size="8" font-weight="800" fill="#fff">' + esc(FOF.unitDef(it.key).name.slice(0, 2)) + '</text>') +
            (el ? '<circle class="ring" r="9" fill="none" stroke="' + (selected ? '#fff' : col) + '" stroke-width="' + (selected ? 3 : 2.2) + '"/>' : '<rect class="ring" x="-8.5" y="-8.5" width="17" height="17" rx="3" fill="none" stroke="' + (selected ? '#fff' : col) + '" stroke-width="2.2"/>');
        }
        if (movable) { var ml = it.leader ? p.lMovesLeft : it.movesLeft; g += '<circle cx="-8" cy="9" r="4.6" fill="#4aa43d" stroke="#1d3a17" stroke-width=".8"/><text x="-8" y="9.3" class="mvbadge" style="fill:#fff">' + ml + '</text>'; }
        // v1.9.2 — pastille rouge en haut à gauche : la puissance de combat sur ce terrain, comme
        // la couronne dorée du dirigeant. Sur le dernier pion visible d'une pile, elle totalise la
        // puissance de TOUTES les troupes cachées derrière.
        var pw = puissanceDe(it, tb);
        if (i === n - 1 && list.length > n) list.slice(n).forEach(function (rest) { pw += puissanceDe(rest, tb); });
        if (pw > 0) g += '<circle cx="-8" cy="-8" r="4.6" fill="#c8413a" stroke="#2a1512" stroke-width=".9"/><text x="-8" y="-7.6" class="mvbadge" style="fill:#fff;font-size:6px">' + pw + '</text>';
        out.push(g + '<title>' + esc(it.leader ? FOF.LEADERS[st.players[it.owner].leader].name : FOF.unitDef(it.key).name) + ' — ' + esc(st.players[it.owner].name) + (pw > 0 ? ' · puissance ' + pw : '') + '</title></g></g></g>');
      });
      // v1.9.2 : au-delà de cinq pions les jetons se chevauchent. Le « +N » est maintenant un
      // bouton qui ouvre la liste complète de ce qui se trouve sur la case.
      if (list.length > 5) {
        var lx = a.x + 3 * gap, ly = a.y + 6;
        out.push('<g class="tmore" data-stack="' + loc + '"><circle cx="' + lx + '" cy="' + (ly - 4) + '" r="11" fill="#242328" stroke="#d4b04f" stroke-width="1.6"/>' +
          '<text class="tlabel" x="' + lx + '" y="' + ly + '" style="fill:#f1d488;stroke:none">+' + (list.length - 5) + '</text>' +
          '<title>Voir les ' + list.length + ' pions de cette case</title></g>');
      }
    });
    return out.join('') + mallets.join('');
  }
  function pickTargets() {
    var pd = st.pending[0];
    if (pd && (pd.type === 'cedeTerritory' || pd.type === 'revolt')) { var pl = st.players[pd.pid]; return FOF.terrOf(st, pl.id).filter(function (t) { return t.id !== pl.capital; }).map(function (t) { return t.id; }); }
    if (mode && mode.kind === 'deploy') return null;
    return null;
  }
  function banner() {
    var pd = st.pending[0];
    if (pd && pd.type === 'cedeTerritory') return '<b>' + esc(st.players[pd.pid].name) + '</b> doit céder un territoire à ' + esc(st.players[pd.to].name) + ' : cliquez un territoire vert.';
    if (pd && pd.type === 'revolt') return 'Tyrannie : <b>' + esc(st.players[pd.pid].name) + '</b> choisit le territoire qui se révolte (en vert).';
    if (pd && pd.type === 'razeSlot') return '<b>' + esc(st.players[pd.pid].name) + '</b> doit raser un aménagement de son ancienne capitale, devenue un territoire ordinaire.';
    if (mode && mode.kind === 'deploy') return 'Où déployer <b>' + esc(FOF.unitDef(st.zone[mode.slot]).name) + '</b> ? Cliquez un territoire qui clignote en blanc (l’achat se fait au déploiement).';
    if (mode && mode.kind === 'move') return 'Déplacer <b>' + esc(mode.label) + '</b> : cliquez une case qui clignote en blanc (' + mode.left + ' case' + (mode.left > 1 ? 's' : '') + ' max).';
    return '';
  }

  /* ---------- zoom à la molette et déplacement de la carte à la souris ---------- */
  var drag = null, dragMoved = false;
  function setZoom(z, cx, cy) {
    var board = $('board'), wrap = $('boardWrap'), r = wrap.getBoundingClientRect(), br = board.getBoundingClientRect();
    var fx = (cx - r.left) / r.width, fy = (cy - r.top) / r.height;
    zoom = Math.max(1, Math.min(3.2, z)); render();
    var r2 = wrap.getBoundingClientRect();
    board.scrollLeft += (r2.left + fx * r2.width) - cx; board.scrollTop += (r2.top + fy * r2.height) - cy;
  }
  document.addEventListener('wheel', function (e) {
    if (!st || !e.target.closest || !e.target.closest('#boardWrap') || e.target.closest('#popover')) return;
    e.preventDefault(); setZoom(zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX, e.clientY);
  }, { passive: false });
  /* v1.8 : tactile. Le zoom n'existait qu'à la molette et le déplacement qu'à la souris : sur
     téléphone on ne pouvait ni pincer pour zoomer, ni tirer la carte de façon fiable. */
  var tDrag = null, tPinch = null, tMoved = false;
  function surCarte(e) {
    var t = e.target;
    return st && t && t.closest && t.closest('#boardWrap') && !t.closest('#popover') && !t.closest('#radial');
  }
  function ecart(e) {
    var a = e.touches[0], b2 = e.touches[1];
    return Math.hypot(a.clientX - b2.clientX, a.clientY - b2.clientY);
  }
  document.addEventListener('touchstart', function (e) {
    if (!surCarte(e)) return;
    if (e.touches.length === 2) {
      var a = e.touches[0], b2 = e.touches[1];
      tPinch = { d: ecart(e), z: zoom, cx: (a.clientX + b2.clientX) / 2, cy: (a.clientY + b2.clientY) / 2 };
      tDrag = null; tMoved = true;
    } else if (e.touches.length === 1 && zoom > 1) {
      var bd = $('board');
      tDrag = { x: e.touches[0].clientX, y: e.touches[0].clientY, sl: bd.scrollLeft, stp: bd.scrollTop };
      tMoved = false;
    }
  }, { passive: false });
  document.addEventListener('touchmove', function (e) {
    if (tPinch && e.touches.length === 2) {
      e.preventDefault();
      var d = ecart(e); if (!tPinch.d) return;
      setZoom(tPinch.z * (d / tPinch.d), tPinch.cx, tPinch.cy);
      return;
    }
    if (!tDrag || e.touches.length !== 1) return;
    var dx = e.touches[0].clientX - tDrag.x, dy = e.touches[0].clientY - tDrag.y;
    if (!tMoved && Math.abs(dx) + Math.abs(dy) < 8) return;
    tMoved = true; e.preventDefault();
    var bd2 = $('board');
    bd2.scrollLeft = tDrag.sl - dx; bd2.scrollTop = tDrag.stp - dy;
  }, { passive: false });
  document.addEventListener('touchend', function (e) {
    if (e.touches.length === 0) { tPinch = null; tDrag = null; }
  });
  // un glissement ne doit pas être pris pour un appui sur une case
  document.addEventListener('click', function (e) {
    if (tMoved && surCarte(e)) { tMoved = false; e.stopPropagation(); e.preventDefault(); }
  }, true);

  document.addEventListener('mousedown', function (e) {
    if (!st || e.button !== 0 || !e.target.closest('#boardWrap') || e.target.closest('#popover') || zoom <= 1) return;
    var b = $('board'); drag = { x: e.clientX, y: e.clientY, sl: b.scrollLeft, stp: b.scrollTop }; dragMoved = false;
  });
  document.addEventListener('mousemove', function (e) {
    if (!drag) return; var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!dragMoved && Math.abs(dx) + Math.abs(dy) < 6) return;
    dragMoved = true; var b = $('board'); b.scrollLeft = drag.sl - dx; b.scrollTop = drag.stp - dy; b.classList.add('panning');
  });
  document.addEventListener('mouseup', function () { if (drag) { drag = null; $('board').classList.remove('panning'); setTimeout(function () { dragMoved = false; }, 0); } });

  /* ---------- survol : nom et infos de la case ---------- */
  var hoverRaf = 0, hoverEv = null;
  function hoverInfo(loc) {
    if (loc[0] === 's') return '<b>' + esc(FOF.locName(st, loc)) + '</b><small>Zone de mer</small>';
    var t = st.map.terr[+loc.slice(1)], owner = t.ctrl === null ? null : st.players[t.ctrl];
    var cap = owner && owner.capital === t.id;
    var h = '<b>' + (cap ? '⚑ ' : '') + esc(t.name) + '</b><small><img src="assets/icons/biome-' + t.biome + '.png" alt=""> ' + FOF.BIOME_NAMES[t.biome] + (t.seas.length ? ' · côtier' : '') + '</small>';
    h += '<small>' + (owner ? '<i class="dot" style="background:' + color(owner.id) + '"></i>' + esc(owner.name) + (cap ? ' · capitale' : '') : 'Neutre') + '</small>';
    if (owner) h += '<small>' + FOF.ic('shield', 14) + ' Défense : <b>+' + FOF.defBonus(st, owner, t) + '</b>' + (cap ? ' (dont +2 de capitale)' : '') + ' + dé</small>';
    else h += '<small>' + FOF.ic('shield', 14) + ' Neutre : se conquiert sans combat</small>';
    if (t.blds.length) h += '<small>' + t.blds.map(function (b) { return '<img src="assets/icons/bld-' + b.t + '.png" alt=""> ' + FOF.BUILDINGS[b.t].name + (b.o !== t.ctrl ? ' (' + esc(st.players[b.o].name) + ')' : ''); }).join(' · ') + '</small>';
    return h;
  }
  function onHover() {
    hoverRaf = 0; var e = hoverEv, tip = $('hoverTip'); if (!st || !e || !tip) return;
    if (radial || pop || (e.target.closest && e.target.closest('#radial,#popover'))) { tip.hidden = true; return; }
    var wrap = $('boardWrap'), rect = wrap.getBoundingClientRect(), b = FOF.Board.bounds();
    var tk = e.target.closest && e.target.closest('.tk');
    var loc = tk ? tk.dataset.tloc : b ? FOF.Board.locAt(st, b.x + (e.clientX - rect.left) / rect.width * b.w, b.y + (e.clientY - rect.top) / rect.height * b.h) : null;
    if (!loc || e.target.closest('#popover') || e.target.closest('#radial')) { tip.hidden = true; return; }
    if (tip.dataset.loc !== loc) { tip.innerHTML = hoverInfo(loc); tip.dataset.loc = loc; }
    tip.hidden = false;
    var x = e.clientX + 16, y = e.clientY + 18;
    if (x + tip.offsetWidth > window.innerWidth - 8) x = e.clientX - tip.offsetWidth - 12;
    if (y + tip.offsetHeight > window.innerHeight - 8) y = e.clientY - tip.offsetHeight - 12;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  document.addEventListener('mousemove', function (e) {
    if (!st || !e.target.closest || !e.target.closest('#boardWrap')) { var t = $('hoverTip'); if (t && !t.hidden) t.hidden = true; return; }
    hoverEv = e; if (!hoverRaf) hoverRaf = requestAnimationFrame(onHover);
  });

  /* ---------- survol d'un pion : on révèle toute la pile de la case ---------- */
  document.addEventListener('mouseover', function (e) {
    if (!st || !e.target.closest) return;
    var tk = e.target.closest('#tokens .tk, #tokens .tmore');
    var tip = $('hoverTip'); if (!tip) return;
    if (!tk) { if (tip.dataset.pile) { tip.hidden = true; tip.dataset.pile = ''; tip.dataset.loc = ''; } return; }
    var loc = tk.dataset.tloc; if (!loc) return;
    var uns = FOF.unitsAt(st, loc), lds = st.players.filter(function (q) { return q.alive && q.lpos === loc; });
    if (uns.length + lds.length < 2) { if (tip.dataset.pile) { tip.hidden = true; tip.dataset.pile = ''; } return; }
    var bio = loc[0] === 't' ? st.map.terr[+loc.slice(1)].biome : null;
    var tot = 0;
    var lignes = lds.map(function (q) { tot += q.mod; return '<small><i class="dot" style="background:' + color(q.id) + '"></i>' + esc(FOF.LEADERS[q.leader].name) + ' · <b>+' + q.mod + '</b></small>'; })
      .concat(uns.map(function (u) {
        var d = FOF.unitDef(u.key), pw = FOF.isElite(u.key) && bio ? d.pow[FOF.BIOMES.indexOf(bio)] : 0;
        tot += pw;
        return '<small><i class="dot" style="background:' + color(u.owner) + '"></i>' + esc(d.name) + ' · ' + (pw ? '<b>' + pw + '</b>' : 'spéciale') + '</small>';
      }));
    tip.innerHTML = '<b>' + esc(FOF.locName(st, loc)) + ' · ' + (uns.length + lds.length) + ' pions</b>' + lignes.join('') +
      '<small style="border-top:1px solid #4d4739;margin-top:3px;padding-top:3px">Puissance cumulée : <b>' + tot + '</b></small>';
    tip.hidden = false; tip.dataset.pile = '1'; tip.dataset.loc = loc;
    var r = tk.getBoundingClientRect();
    tip.style.left = Math.max(8, Math.min(window.innerWidth - tip.offsetWidth - 8, r.left + r.width / 2 - tip.offsetWidth / 2)) + 'px';
    tip.style.top = Math.max(8, r.top - tip.offsetHeight - 10) + 'px';
  });

  /* ---------- survol d'une de mes unités : la carte en grand ---------- */
  document.addEventListener('mouseover', function (e) {
    var ct = $('cardTip'); if (!ct || !e.target.closest) return;
    var m = e.target.closest('[data-key]');
    if (!m || !FOF.unitDef(m.dataset.key)) { if (!ct.hidden) ct.hidden = true; return; }
    if (ct.dataset.key !== m.dataset.key) { ct.innerHTML = FOF.cardHTML(m.dataset.key); ct.dataset.key = m.dataset.key; }
    ct.hidden = false;
    var r = m.getBoundingClientRect(), w = ct.offsetWidth, hh = ct.offsetHeight;
    ct.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
    ct.style.top = Math.max(8, r.top - hh - 10) + 'px';
  });

  /* ---------- clics sur la carte ---------- */
  function boardClick(e) {
    if (!st) return;
    var tk = e.target.closest('.tk'), ml = e.target.closest('.mallet');
    var wrap = $('boardWrap'), rect = wrap.getBoundingClientRect(), b = FOF.Board.bounds();
    var px = e.clientX - rect.left, py = e.clientY - rect.top;
    var loc = tk ? tk.dataset.tloc : ml ? ml.dataset.tloc : FOF.Board.locAt(st, b.x + px / rect.width * b.w, b.y + py / rect.height * b.h);
    if (FOF.sfx) FOF.sfx(mode && mode.kind === 'move' && loc && mode.reach[loc] !== undefined ? 'march' : tk && +tk.dataset.own === st.cur ? 'select' : 'tap');
    if (!loc) { pop = null; if (mode && mode.kind === 'deploy') err = 'Cliquez un territoire qui clignote en blanc pour déployer votre unité (ou « Annuler »).'; else mode = null; render(); return; }
    // clic sur un de mes pions en phase militaire : on part directement en déplacement
    if (tk && !mode && !st.pending.length && st.phase === 'military' && +tk.dataset.own === st.cur && myTurn()) {
      var piece = tk.dataset.tk === 'L' ? 'L' : +tk.dataset.tk;
      if (piece === 'L') { radial = { loc: loc, x: +tk.dataset.x, y: +tk.dataset.y }; sel = loc; pop = null; render(); return; }
      if (startMove(piece)) { sel = loc; pop = null; render(); return; }
    }
    onCase(loc, px, py);
  }
  function startMove(piece) {
    var p = FOF.cur(st), from, budget, label, obj;
    if (piece === 'L') { if (p.lConq || p.lFought || p.lMovesLeft <= 0) return false; obj = 'L'; from = p.lpos; budget = p.lMovesLeft; label = FOF.LEADERS[p.leader].name; }
    else { obj = st.units.filter(function (u) { return u.uid === piece; })[0]; if (!obj || obj.fought || obj.pacif || obj.movesLeft <= 0) return false; from = obj.pos; budget = obj.movesLeft; label = FOF.unitDef(obj.key).name; }
    var reach = FOF.reach(st, from, obj, p, budget);
    if (!Object.keys(reach).length) { err = label + ' ne peut aller nulle part (un port est nécessaire pour prendre la mer).'; return true; }
    mode = { kind: 'move', piece: piece, reach: reach, label: label, left: budget }; err = '';
    return true;
  }
  function onCase(loc, px, py) {
    var pd = st.pending[0];
    if (pd && (pd.type === 'cedeTerritory' || pd.type === 'revolt')) { if (loc[0] === 't' && myTurn()) dispatch({ type: 'resolve', tid: +loc.slice(1) }); return; }
    if (mode && mode.kind === 'deploy') {
      if (loc[0] === 't' && mode.spots.indexOf(+loc.slice(1)) >= 0) { var slot = mode.slot; mode = null; sel = loc; dispatch({ type: 'buy', slot: slot, tid: +loc.slice(1) }); return; }
      err = 'Impossible de déployer ici : cliquez un territoire qui clignote en blanc (ou « Annuler »).'; pop = null; render(); return;
    }
    if (mode && mode.kind === 'move') {
      if (mode.reach[loc] !== undefined) { var piece = mode.piece; mode = null; sel = loc; dispatch({ type: 'move', piece: piece, to: loc }); if (!err) openPopAfterMove(loc); return; }
      mode = null;
    }
    sel = loc; err = '';
    pop = { loc: loc, x: px, y: py };
    render();
  }
  function openPopAfterMove(loc) {
    // après un déplacement, proposer attaque / conquête / effet s'il y en a
    var a = FOF.Board.anchor(loc), b = FOF.Board.bounds(), sc = +$('boardWrap').dataset.scale;
    var hasAction = FOF.attackTargets(st, loc).length || FOF.unitsAt(st, loc, st.cur).some(function (u) { return FOF.effectAvailable(st, u); });
    if (hasAction) { pop = { loc: loc, x: (a.x - b.x) * sc, y: (a.y - b.y) * sc }; render(); }
  }

  /* ---------- menu circulaire autour du dirigeant (phase militaire) ---------- */
  function renderRadial(sc, b) {
    var el = $('radial');
    if (!radial || !st || st.phase !== 'military' || !myTurn() || st.pending.length || modal) { el.hidden = true; return; }
    var p = FOF.cur(st), t = radial.loc[0] === 't' ? st.map.terr[+radial.loc.slice(1)] : null, items = [];
    var canMove = !(p.lConq || p.lFought || p.lMovesLeft <= 0);
    items.push('<button class="rbtn move" data-move="L" ' + (canMove ? '' : 'disabled') + '><b>' + FOF.ic('move', 20) + '</b><span>Se déplacer</span></button>');
    if (t && t.ctrl === null) {
      var revolted = t.revoltFrom === p.id;   // un tyran ne reprend pas une terre qui s'est soulevée contre lui
      var ok = !revolted && p.lArr < st.turnNo && !p.lMoved && !p.lFought && !p.lConq;
      items.push('<button class="rbtn conquer" data-conquer="1" ' + (ok ? '' : 'disabled title="' + (revolted ? 'Cette terre s’est soulevée contre vous : elle ne vous reconnaîtra plus' : 'Il doit être ici depuis votre tour précédent, sans avoir bougé') + '"') + '><b>' + FOF.ic('banner', 22) + '</b><span>Conquérir</span></button>');
    }
    if (FOF.attackTargets(st, radial.loc).length) items.push('<button class="rbtn attack" data-attack="' + radial.loc + '"><b>' + FOF.ic('swords', 22) + '</b><span>Attaquer</span></button>');
    items.push('<button class="rbtn close" data-closeradial="1"><b>' + FOF.ic('close', 18) + '</b><span>Fermer</span></button>');
    // rayon réduit sur téléphone : à 78 px le menu couvrait un tiers de la carte
    var n = items.length, R = window.innerWidth <= 620 ? 54 : 78;
    el.innerHTML = items.map(function (h, i) { var ang = -Math.PI / 2 + i * 2 * Math.PI / n; return h.replace('class="rbtn', 'style="left:' + Math.round(Math.cos(ang) * R) + 'px;top:' + Math.round(Math.sin(ang) * R) + 'px" class="rbtn'); }).join('') + '<div class="rhint">' + esc(FOF.LEADERS[p.leader].name) + '</div>';
    el.style.left = ((radial.x - b.x) * sc) + 'px'; el.style.top = ((radial.y - b.y) * sc) + 'px';
    el.hidden = false;
  }

  /* ---------- popover contextuel ---------- */
  function renderPopover(sc) {
    var el = $('popover');
    if (!pop || st.pending.length || modal) { el.hidden = true; return; }
    var html = popContent(pop.loc);
    if (!html) { el.hidden = true; return; }
    el.innerHTML = '<button class="x" data-closepop="1" aria-label="Fermer">×</button>' + html + '<div class="err">' + esc(err) + '</div>';
    el.hidden = false;
    var wrap = $('boardWrap'), W = wrap.clientWidth, H = wrap.clientHeight;
    var x = pop.x + 18, y = pop.y - 30;
    if (x + 300 > W) x = pop.x - 308;
    el.style.left = Math.max(6, x) + 'px';
    el.style.top = Math.max(6, Math.min(y, H - el.offsetHeight - 6)) + 'px';
  }
  function popContent(loc) {
    var p = FOF.cur(st), m = st.map, t = loc[0] === 't' ? m.terr[+loc.slice(1)] : null, h = [];
    h.push('<h4>' + esc(FOF.locName(st, loc)) + '</h4>');
    if (t) h.push('<div class="sub">' + FOF.BIOME_NAMES[t.biome] + (t.seas.length ? ' · côtier' : '') + ' · ' + (t.ctrl === null ? 'neutre' : '<b style="color:' + color(t.ctrl) + '">' + esc(st.players[t.ctrl].name) + '</b>' + (st.players[t.ctrl].capital === t.id ? ' (capitale)' : '')) + (t.ctrl !== null ? ' · défense +' + FOF.defBonus(st, st.players[t.ctrl], t) : '') + '</div>');
    else h.push('<div class="sub">Zone de mer — on n’y combat pas.</div>');
    if (t && t.blds.length) h.push('<div class="blds-now">' + t.blds.map(function (b) { return '<span class="bchip" style="--bc:' + color(b.o) + '">' + bIcon(b.t) + FOF.BUILDINGS[b.t].name + (b.o !== t.ctrl ? ' · ' + esc(st.players[b.o].name) : '') + '</span>'; }).join('') + '</div>');

    if (st.phase === 'build' && t) {
      if (t.ctrl === p.id) h.push(buildPanel(p, t));
      else if (t.ctrl !== null && t.blds.some(function (b) { return b.o === p.id; }) && !p.tyran) h.push('<button class="btn primary" data-cede="' + t.id + '">Céder mes aménagements (+1 diplomatie)</button>');
    }
    // pièces
    var rows = [];
    if (p.lpos === loc) rows.push(leaderRow(p, t));
    FOF.unitsAt(st, loc, p.id).forEach(function (u) { rows.push(unitRow(p, u, t)); });
    st.players.forEach(function (q) {
      if (q.id === p.id) return;
      if (q.lpos === loc) rows.push('<div class="pc-row" style="--pc:' + color(q.id) + '">' + FOF.heroImg(q.leader, '') + '<div class="t">' + esc(FOF.LEADERS[q.leader].name) + '<small>Dirigeant de ' + esc(q.name) + '</small></div></div>');
      FOF.unitsAt(st, loc, q.id).forEach(function (u) { var a = FOF.unitArt(u.key); rows.push('<div class="pc-row" style="--pc:' + color(q.id) + '">' + (a ? '<img src="' + a + '" alt="">' : '') + '<div class="t">' + esc(FOF.unitDef(u.key).name) + '<small>' + esc(q.name) + '</small></div></div>'); });
    });
    h.push(rows.join(''));
    if (st.phase === 'military' && FOF.attackTargets(st, loc).length) h.push('<div style="margin-top:10px"><button class="btn attack-cta" data-attack="' + loc + '">' + FOF.ic('swords', 16) + ' Attaquer</button></div>');
    if (h.length <= 2 && !(t && t.blds.length)) return h.join('') + '<p class="muted" style="margin:0">Rien à faire ici pour l’instant.</p>';
    return h.join('');
  }
  function leaderRow(p, t) {
    var acts = [];
    if (st.phase === 'military') {
      acts.push('<button class="btn small primary" data-move="L" ' + (p.lConq || p.lFought || p.lMovesLeft <= 0 ? 'disabled' : '') + '>Déplacer</button>');
      if (t && t.ctrl === null) {
        var revolted2 = t.revoltFrom === p.id;
        var ok = !revolted2 && p.lArr < st.turnNo && !p.lMoved && !p.lFought;
        acts.push('<button class="btn small primary" data-conquer="1" ' + (ok ? '' : 'disabled title="' + (revolted2 ? 'Cette terre s’est soulevée contre vous' : 'Votre dirigeant doit être ici depuis votre tour précédent') + '"') + '>Conquérir</button>');
      }
    }
    var info = p.lConq ? 'a conquis ce tour' : p.lFought ? 'a combattu' : (p.lMovesLeft || 0) + ' déplacement';
    if (t && t.ctrl === null && st.phase === 'military' && !(p.lArr < st.turnNo && !p.lMoved)) info += ' · conquête possible au prochain tour s’il reste ici';
    return '<div class="pc-row" style="--pc:' + color(p.id) + '">' + FOF.heroImg(p.leader, '') + '<div class="t"><b>' + esc(FOF.LEADERS[p.leader].name) + '</b><small>' + info + '</small></div>' + acts.join('') + '</div>';
  }
  function unitRow(p, u, t) {
    var d = FOF.unitDef(u.key), acts = [], a = FOF.unitArt(u.key);
    var info = u.fought ? 'a combattu' : u.pacif ? 'pacifie' : u.movesLeft + ' déplacement' + (u.movesLeft > 1 ? 's' : '');
    if (st.phase === 'military') {
      acts.push('<button class="btn small primary" data-move="' + u.uid + '" ' + (u.fought || u.pacif || u.movesLeft <= 0 ? 'disabled' : '') + '>Déplacer</button>');
      if (t && FOF.isElite(u.key) && t.ctrl === p.id && t.blds.some(function (b) { return b.o !== p.id; })) {
        var ok = t.conqStamp < st.turnNo && u.arr < st.turnNo && !u.moved && !u.fought;
        acts.push('<button class="btn small" data-pacify="' + u.uid + '" ' + (ok ? '' : 'disabled title="Une élite doit être ici depuis votre tour précédent"') + '>Pacifier</button>');
      }
    }
    var eff = FOF.effectAvailable(st, u);
    if (eff && u.key === 'partisan' && st.phase === 'military' && t) {
      // le joueur choisit l'aménagement à retourner
      t.blds.forEach(function (b, i) { if (b.o === t.ctrl && b.t !== 'T') acts.push('<button class="btn small primary" data-effect="' + u.uid + '" data-arg="' + i + '">Retourner : ' + esc(FOF.BUILDINGS[b.t].name) + '</button>'); });
    } else if (eff && (st.phase === 'military' || (u.key === 'exploratrice' && st.phase === 'collect'))) acts.push('<button class="btn small primary" data-effect="' + u.uid + '">' + esc(eff) + '</button>');
    return '<div class="pc-row" style="--pc:' + color(p.id) + '">' + (a ? '<img src="' + a + '" alt="">' : '') + '<div class="t"><b>' + esc(d.name) + '</b><small>' + info + '</small></div>' + acts.join('') + '</div>';
  }
  // v1.8 : l'Ambassade n'avait pas d'entrée ici et s'affichait « undefined ».
  // [libellé court sous le bouton, infobulle au survol]
  var BLD_EFF = {
    C:  ['+1 déf.',             'Campement — +1 en défense sur cette case.'],
    F:  ['+3 déf.',             'Fort — +3 en défense sur cette case.'],
    P:  ['+1 déf.',             'Port — +1 en défense, et vos unités peuvent embarquer depuis cette case.'],
    Ci: ['+1 or/tour',          'Cité — +1 or à chaque collecte. Beaucoup de cartes exigent des cités.'],
    T:  ['victoire religieuse', 'Temple — compte pour la victoire religieuse. Il occupe un emplacement d’aménagement. Le détruire coûte 1 diplomatie à l’assaillant.'],
    A:  ['+1 par gain diplo.',  'Ambassade — chaque gain de diplomatie obtenu par une action (unité, carte, pouvoir, cession) en rapporte 1 de plus. Uniquement si vous n’avez ni attaqué ni été attaqué depuis votre dernier tour. Une seule, dans votre capitale, où elle occupe un emplacement.']
  };
  function buildPanel(p, t) {
    var slots = FOF.slotsOf(st, p, t.id);
    var h = ['<div class="section-title" style="margin-top:4px">Bâtir ici · ' + p.gold + ' or <span class="muted" style="font-weight:400">· ' + t.blds.length + '/' + slots + ' emplacement' + (slots > 1 ? 's' : '') + (t.id === p.capital ? ' (capitale)' : '') + '</span></div><div class="bgrid">'];
    FOF.BUILDING_ORDER.forEach(function (b) {
      var e = FOF.canBuild(st, t.id, b), B = FOF.BUILDINGS[b];
      var ef = BLD_EFF[b] || ['', B.name];
      h.push('<button class="bbtn" data-build="' + b + '" data-tid="' + t.id + '" ' + (e ? 'disabled title="' + esc(e) + '"' : 'title="' + esc(ef[1]) + '"') + '>' + bIconOr(b) + '<span>' + B.name + '</span><span class="price">' + FOF.bldCost(st, p, b) + '<span class="coin"></span></span><small>' + esc(ef[0]) + '</small></button>');
    });
    h.push('</div>');
    var mine = t.blds.map(function (b, i) { return [b, i]; }).filter(function (x) { return x[0].o === p.id; });
    mine.forEach(function (x) {
      h.push('<div class="section-title" style="margin-top:10px">Remplacer ' + FOF.BUILDINGS[x[0].t].name.toLowerCase() + ' par</div><div class="bgrid">' + FOF.BUILDING_ORDER.filter(function (b) { return b !== x[0].t; }).map(function (b) {
        var bad = p.gold < FOF.bldCost(st, p, b) || (b !== 'C' && t.blds.some(function (o, i) { return i !== x[1] && o.t === b; })) || (b === 'P' && !t.seas.length);
        return '<button class="bbtn" data-replace="' + b + '" data-idx="' + x[1] + '" data-tid="' + t.id + '" ' + (bad ? 'disabled' : '') + '>' + bIconOr(b, 20) + '<span class="price">' + FOF.bldCost(st, p, b) + '<span class="coin"></span></span></button>';
      }).join('') + '</div>');
    });
    if (t.id !== p.capital) h.push('<div style="margin-top:10px"><button class="btn small gold" data-capital="' + t.id + '" ' + (p.gold < 8 ? 'disabled' : '') + '>Installer la capitale ici · 8 or</button></div>');
    return h.join('');
  }

  /* ---------- marché ---------- */
  function renderMarket() {
    var el = $('market'), p = FOF.cur(st);
    // v1.8 : pendant le recrutement le marché ne se ferme plus jamais. Il se réduit seulement,
    // pour laisser voir la carte sans perdre de vue les cinq cartes en vitrine.
    var bd0 = $('board');
    // le marché appartient au joueur actif : l'afficher pendant le tour d'un bot le faisait
    // apparaître et disparaître à chaque passage, ce qui faisait clignoter toute la page.
    if (st.phase !== 'recruit' || st.pending.length || !myTurn()) { el.hidden = true; if (bd0) bd0.style.setProperty('--mh', '0px'); return; }
    var mini = !marketOpen;
    el.className = 'market' + (mini ? ' compact' : '');
    var spy = FOF.army(st, p.id).some(function (u) { return u.key === 'espion'; });
    var toggle = mini
      ? '<button class="btn small ghost" data-showmarket="1" title="Réafficher les cartes en entier">Agrandir les cartes ▴</button>'
      : '<button class="btn small ghost" data-hidemarket="1" title="Réduire les cartes pour regarder la carte">Regarder la carte ▾</button>';
    var h = ['<h3>Zone de recrutement · 1 achat et 1 défausse par tour ' + toggle + '</h3>' +
      '<div class="market-inner"' + (mini && !(mode && mode.kind === 'deploy') ? ' data-showmarket="1" title="Cliquez pour revoir les cartes en entier"' : '') + '>'];
    h.push('<div class="deckpile"><img src="assets/cardback.jpg" alt="Deck"><span>Deck : <b class="num">' + st.deck.length + '</b><br>Défausse : <b class="num">' + st.discard.length + '</b></span>' +
      (spy ? '<button class="btn small gold" data-act="spy" ' + (p.flags.spied || p.gold < 1 ? 'disabled' : '') + '>Espion (1 or)</button>' : '') +
      (st.spy && st.spy.pid === p.id ? '<span>Dessus : <b>' + esc(FOF.unitDef(st.spy.key).name) + '</b></span>' : '') + '</div>');
    st.zone.forEach(function (k, i) {
      if (!k) { h.push('<div></div>'); return; }
      var why = FOF.canBuy(st, k), d = FOF.unitDef(k);
      var acts = '<div class="acts"><button class="btn buy" data-buy="' + i + '" ' + (why ? 'disabled' : '') + '>Acheter · ' + d.upkeep + ' or</button><button class="btn" data-discard="' + i + '" ' + (p.flags.discarded || (mode && mode.kind === 'deploy') ? 'disabled' : '') + '>Défausser</button></div><div class="why">' + esc(why || '') + '</div>';
      h.push('<div class="slot' + (why || !myTurn() ? '' : ' can-buy') + '" data-slotkey="' + i + ':' + k + ':' + st.deck.length + '">' + FOF.cardHTML(k, { actions: acts }) + '</div>');
    });
    h.push('</div>');
    // v1.8 : on ne réécrit le marché que si son contenu a réellement changé. Sinon, pendant le tour
    // d'un bot, chaque rendu reconstruisait les cinq cartes et la barre clignotait.
    var htm = h.join('');
    if (el.dataset.sig !== htm) { el.innerHTML = htm; el.dataset.sig = htm; }
    el.hidden = false;
    if (!mini) fitMarket(el);
    if (bd0) bd0.style.setProperty('--mh', el.offsetHeight + 'px');   // pour décaler les boutons de zoom
  }
  // v1.8 : sur un écran court, les cartes débordaient du plateau et il fallait faire défiler pour
  // voir les dernières (et parfois pour atteindre le bouton Acheter). On resserre par paliers.
  // Le palier est mis en cache : le recalculer à chaque rendu faisait réapparaître le marché en
  // grand avant de le resserrer, ce qui faisait clignoter la barre et la carte à chaque tour de bot.
  var fitKey = '', fitTier = '';
  function fitMarket(el) {
    var bd = $('board'); if (!bd) return;
    var key = bd.clientWidth + 'x' + bd.clientHeight + ':' + el.querySelectorAll('.ucard').length;
    if (key === fitKey) {                             // rien n'a bougé : on réapplique le palier connu
      var voulu = 'market' + (fitTier ? ' ' + fitTier : '');
      if (el.className !== voulu) el.className = voulu;
      return;
    }
    fitKey = key;
    el.classList.remove('tight', 'tighter', 'row1');
    var avail = bd.clientHeight - 48;                 // on garde un bandeau de carte visible
    fitTier = '';
    if (el.offsetHeight <= avail) return;
    el.classList.add('tight'); fitTier = 'tight';
    if (el.offsetHeight <= avail) return;
    el.classList.add('tighter'); fitTier = 'tight tighter';
    if (el.offsetHeight <= avail) return;
    el.classList.add('row1'); fitTier = 'tight tighter row1';   // dernier recours : les cinq sur une rangée
  }

  /* ---------- tapis du joueur actif ---------- */
  function track(label, icon, val, max) {
    var boxes = ''; for (var i = 1; i <= max; i++) boxes += '<i class="' + (i <= val ? 'on ' : '') + (i === max ? 'goal' : '') + '"></i>';
    return '<div class="track"><span class="lbl">' + icon + label + '</span><span class="boxes">' + boxes + '</span><b class="num">' + val + '/' + max + '</b></div>';
  }
  var HINTS = {
    collect: ['Revenus encaissés. Une Exploratrice peut agir maintenant.', 'Passer au recrutement →'],
    recruit: ['Achetez au plus 1 unité et défaussez au plus 1 carte.', 'Passer à la phase militaire →'],
    military: ['Cliquez un de vos pions pour le déplacer (badge vert = cases restantes). Cliquez une case pour attaquer, conquérir ou pacifier.', 'Passer à la construction →'],
    build: ['Cliquez un de vos territoires pour bâtir.', 'Terminer mon tour ✓']
  };
  function renderMat() {
    var p = FOF.cur(st), v = st.victory, army = FOF.army(st, p.id), inc = st.collect ? st.collect.inc : FOF.income(st, p);
    var h = ['<div class="me' + (p.tyran ? ' tyran' : '') + '" style="--pc:' + color(p.id) + '"><div class="pwrap">' + FOF.heroImg(p.leader) + (p.tyran ? '<div class="flames" aria-hidden="true">' + '<i></i>'.repeat(14) + '</div>' : '') + '</div>' + '<div class="who"><div class="ribbon" style="background:' + color(p.id) + ';color:#fff;border-color:#1b1a1d">' + esc(p.name) + '</div>' +
      '<div class="line"><span class="star gold" style="width:24px;height:24px;font-size:13px">' + p.mod + '</span><span>' + esc(FOF.LEADERS[p.leader].name) + '</span>' + (p.tyran ? '<span class="pill tyran">Tyran</span>' : '') + (p.pact !== null ? '<span class="pill pact">Pacte avec ' + esc(st.players[p.pact].name) + '</span>' : '') + '</div>' +
      '<div class="purse" data-gold="' + p.id + ':' + p.gold + '" title="Revenu : ' + inc.total + ' − entretien ' + inc.upkeep + '"><span class="coin"></span><b>' + p.gold + '</b><span class="muted" style="font-size:12.5px">or · revenu ' + (inc.total - inc.upkeep >= 0 ? '+' : '') + (inc.total - inc.upkeep) + '/tour</span></div></div></div>'];
    h[0] = h[0].replace('<div class="me', '<div data-heroinfo="1" title="Voir la fiche du dirigeant" class="me');
    h.push('<div style="display:flex;gap:18px;align-items:center;min-width:0;flex-wrap:wrap"><div class="tracks" style="--pc:' + color(p.id) + '">' +
      track('Territoires', '<img class="icn" src="assets/icons/terr.svg" alt="">', FOF.terrOf(st, p.id).length, v.mil) +
      track('Temples', '<img class="icn" src="assets/icons/bld-T.png" alt="">', FOF.countBld(st, p.id, 'T'), v.rel) +
      (p.tyran ? '<div class="track"><span class="lbl">' + FOF.ic('branch', 19) + ' Diplomatie</span><span class="pill tyran">Tyran : plus de diplomatie</span></div>' : track('Diplomatie', FOF.ic('branch', 19) + ' ', p.dip, v.dip)) + '</div>' +
      '<div class="army">' + (army.length ? army.map(function (u) {
        var a = FOF.unitArt(u.key), done = u.fought || u.pacif || u.movesLeft <= 0;
        // v1.9.2 : bouton tête de mort — licencier une unité pour libérer une place et racheter
        var lic = st.phase === 'recruit' && myTurn() && !p.flags.released && !st.pending.length && !st.winner;
        return '<div class="mini ' + (FOF.isElite(u.key) ? 'elite ' : '') + (st.phase === 'military' && done ? 'done' : '') + '" data-mini="' + u.uid + '" data-key="' + u.key + '">' +
          (lic ? '<button class="mini-kill" data-release="' + u.uid + '" title="Licencier cette unité pour faire de la place (les pièces engagées sont perdues)">' + FOF.ic('skull', 15) + '</button>' : '') +
          (a ? '<img src="' + a + '" alt="">' : '<img src="assets/cardback.jpg" alt="">') +
          (st.phase === 'military' && !done ? '<span class="mv">' + u.movesLeft + '</span>' : '') + '<div class="mn">' + esc(FOF.unitDef(u.key).name) + '</div><div class="ms">' + esc(FOF.locName(st, u.pos)) + ' · réserve ' + u.gold + '</div></div>';
      }).join('') : '<span class="muted" style="font-size:13px">Aucune unité. Recrutez-en pendant la phase de recrutement.</span>') + '</div></div>');
    var hint = HINTS[st.phase];
    if (!myTurn()) {
      var ap = st.players[actor()];
      var who = '<span class="wdot" style="background:' + color(ap.id) + '"></span><b>' + esc(ap.name) + '</b>';
      hint = ap.bot
        ? ['<span class="bot-think">' + FOF.ic('helm', 16) + ' ' + who + ' réfléchit<i>.</i><i>.</i><i>.</i></span>', 'Tour de ' + esc(ap.name) + '…']
        : ['<span class="bot-think">' + FOF.ic('crown', 16) + ' ' + who + ' ' + PHASE_ING[st.phase] + '<i>.</i><i>.</i><i>.</i> <span class="wsec" data-since="' + (st.tLast || Date.now()) + '"></span></span><span class="wbar" aria-hidden="true"><i style="background:' + color(ap.id) + '"></i></span>', 'Tour de ' + esc(ap.name) + '…'];
    }
    var blocked = mode && mode.kind === 'deploy';
    if (blocked) hint = ['Déployez d’abord votre unité (territoire qui clignote) ou annulez l’achat.', hint[1]];
    // v1.9 : le bouton n'est plus désactivé par un mode en cours (déploiement) — il l'était, et
    // une interface restée coincée rendait la fin de tour impossible. Il explique et débloque.
    h.push('<div class="cta"><div class="hint">' + hint[0] + '</div>' +
      (st.phaseClean && st.phase !== 'collect' && !st.pending.length && !st.winner && myTurn() && !(mode && mode.kind === 'deploy')
        ? '<button class="btn small undo" data-backphase="1" title="Aucune action jouée dans cette phase : vous pouvez y revenir">← Phase précédente</button>' : '') +
      (canUndo() ? '<button class="btn small undo" data-undo="1" title="Le pion revient d’où il vient et peut repartir ailleurs">' + FOF.ic('move', 14) + ' Annuler le déplacement</button>' : '') +
      '<button class="btn primary go" data-next="1" ' + (st.pending.length || st.winner || !myTurn() ? 'disabled' : '') + '>' + hint[1] + '</button>' +
      (p.leader === 'edouard' && st.phase === 'collect' ? '<button class="btn small gold" data-act="edouard" ' + (p.edouardUsed || p.dip > 3 || p.gold < 4 || p.tyran || p.attackedLast || p.raidedLast ? 'disabled' : '') + '>Edouard : 4 or → +1 diplomatie</button>' : '') + '</div>');
    setHTML($('mat'), h.join(''));
  }

  /* ---------- panneau droit ---------- */
  function renderRight() {
    var h = [];
    var p = FOF.cur(st);
    if (st.phase === 'build') {
      var ced = st.map.terr.filter(function (t) { return t.ctrl !== null && t.ctrl !== p.id && t.blds.some(function (b) { return b.o === p.id; }); });
      if (ced.length && !p.tyran) h.push('<div class="box"><div class="section-title">Céder (+1 diplomatie)</div>' + ced.map(function (t) { return '<div class="kv"><span>' + esc(t.name) + '</span><button class="btn small" data-cede="' + t.id + '">Céder</button></div>'; }).join('') + '</div>');
    }
    if (err && !pop) h.push('<div class="box"><div class="err" style="margin:0">' + esc(err) + '</div></div>');
    h.push('<div class="box"><div class="section-title">Chronique</div><div class="log">' + st.log.slice(-50).reverse().map(function (l) { return '<div style="--lc:' + (l.p === null ? '#555' : color(l.p)) + '">' + esc(l.m) + '</div>'; }).join('') + '</div></div>');
    setHTML($('right'), h.join(''));
  }

  /* ---------- modales ---------- */
  // ouvre le glossaire / le deck par-dessus ce qui est affiché, et rend la main ensuite
  var prevModal = null;
  function openOver(kind) {
    if (modal && modal.kind !== kind) prevModal = modal; else if (!modal) prevModal = null;
    modal = { kind: kind }; render();
  }
  // v1.8 : réglages regroupés. Le style de carte, la vitesse des bots et les animations
  // occupaient chacun un bouton dans un en-tête déjà très chargé.
  function settingsHTML() {
    function chx(attr, val, cur, lbl) {
      return '<button class="btn' + (val === cur ? ' primary' : '') + '" data-' + attr + '="' + val + '">' + esc(lbl) + '</button>';
    }
    var cur = FOF.mapStyle ? FOF.mapStyle() : '';
    var styles = (FOF.MAP_STYLES || []).map(function (x) { return chx('setstyle', x.id, cur, x.name); }).join('');
    var vit = SPEEDS.map(function (k) { return chx('setspeed', k, botSpeed, SPEED_LBL[k].replace('Bots : ', '')); }).join('');
    var anim = FOF.animOn !== false;
    var avecBots = st && st.players.some(function (q) { return q.bot; });
    return '<div class="modal settings"><h2>' + FOF.ic('gear', 20) + ' Réglages</h2>' +
      '<div class="set-row"><div class="set-lbl"><b>Style de la carte</b><small>Le rendu du plateau.</small></div><div class="set-opts">' + styles + '</div></div>' +
      (avecBots ? '<div class="set-row"><div class="set-lbl"><b>Vitesse des bots</b><small>Délai entre leurs actions.</small></div><div class="set-opts">' + vit + '</div></div>' : '') +
      '<div class="set-row"><div class="set-lbl"><b>Son</b><small>Musique de taverne et bruitages.</small></div><div class="set-opts"><div class="set-audio" data-music-slot></div></div></div>' +
      '<div class="set-row"><div class="set-lbl"><b>Animations</b><small>Déplacements, bandeaux et effets.</small></div><div class="set-opts">' +
        '<button class="btn' + (anim ? ' primary' : '') + '" data-setanim="1">Activées</button>' +
        '<button class="btn' + (anim ? '' : ' primary') + '" data-setanim="0">Réduites</button></div></div>' +
      '<p class="muted" style="font-size:13px;margin:10px 0 0;text-align:right">Fields of Fire · version <b>' + FOF.CONFIG.version + '</b>' +
        ' — si ce numéro n\u2019est pas le dernier publié, rechargez la page en forçant le cache (Ctrl+Maj+R, ou Cmd+Maj+R).</p>' +
      '<div class="actions"><button class="btn primary" data-close="1">Fermer</button></div></div>';
  }
  function renderModal() {
    var el = $('modal'), pd = st.pending[0], h = null;
    if (st.winner) {
      var w = st.players[st.winner.pid], label = { mil: 'Victoire militaire', rel: 'Victoire religieuse', dip: 'Victoire diplomatique', survie: 'Dernier dirigeant debout' }[st.winner.type];
      h = '<div class="modal victory" style="text-align:center"><div class="confetti" aria-hidden="true">' + new Array(40).join('<i></i>') + '</div><div class="vcrown" style="width:140px;margin:0 auto 10px">' + FOF.heroImg(w.leader) + '</div><h2 style="color:' + color(w.id) + ';font-size:30px">' + esc(w.name) + '</h2><p class="verdict">' + label + '</p><p class="muted">' + esc(FOF.LEADERS[w.leader].name) + ' · tour ' + st.round + '</p><div class="actions" style="justify-content:center"><button class="btn" data-endstats="1">' + FOF.ic('scroll', 15) + ' Statistiques de la partie</button><button class="btn primary" data-act="newgame">Nouvelle partie</button></div></div>';
      if (modal && modal.kind === 'endstats') h = endStatsHTML();
    } else if (modal && modal.kind === 'combat' && st.lastCombat) h = combatHTML(st.lastCombat);
    else if (pd && net && net.seatIndex() !== pd.pid && (pd.type === 'conquest' || pd.type === 'deficit' || pd.type === 'razeSlot')) h = '<div class="modal"><h2>En attente</h2><p><b>' + esc(st.players[pd.pid].name) + '</b> prend une décision…</p></div>';
    else if (pd && pd.type === 'conquest') {
      var t = st.map.terr[pd.tid], d = st.players[pd.def];
      h = '<div class="modal">' + passHTML(pd.pid) + '<h2>' + esc(t.name) + ' est tombé</h2><p>Que faites-vous du territoire ?</p><div class="choice-grid">' +
        '<button class="btn primary" data-resolve="conquer"><b>Conquérir</b><br><small>Le territoire devient le vôtre. Les aménagements restent à leur propriétaire (pacifiez-les au tour suivant).</small></button>' +
        '<button class="btn danger" data-resolve="devastate"><b>Dévaster</b><br><small>Il redevient neutre, tout est détruit.' + (d.tyran ? '' : ' −1 diplomatie (et −1 par temple).') + '</small></button></div></div>';
    } else if (pd && pd.type === 'deficit') {
      var p = st.players[pd.pid];
      h = '<div class="modal">' + passHTML(pd.pid) + '<h2>Entretien impayé</h2><p>Il manque <b class="num">' + pd.left + '</b> or. Reprenez des pièces posées sur vos unités. Une unité à qui il manque une pièce sera défaussée.</p>' +
        FOF.army(st, p.id).map(function (u) { var a = FOF.unitArt(u.key); return '<div class="pc-row" style="--pc:' + color(p.id) + '">' + (a ? '<img src="' + a + '" alt="">' : '') + '<div class="t"><b>' + esc(FOF.unitDef(u.key).name) + '</b><small>réserve ' + u.gold + ' / entretien ' + FOF.unitDef(u.key).upkeep + '</small></div><button class="btn small" data-take="' + u.uid + '" ' + (u.gold <= 0 ? 'disabled' : '') + '>Reprendre 1 or</button></div>'; }).join('') + '</div>';
    } else if (pd && pd.type === 'razeSlot') {
      // v1.9.6 — l'ancienne capitale repasse de 3 à 2 emplacements : il faut en raser un.
      var rt = st.map.terr[pd.tid];
      h = '<div class="modal">' + passHTML(pd.pid) + '<h2>' + FOF.ic('warn', 20) + ' ' + esc(rt.name) + ' n’est plus votre capitale</h2>' +
        '<p>Un territoire ordinaire ne porte que <b>2 aménagements</b>. Choisissez celui que vous rasez — il est perdu, sans remboursement.</p>' +
        '<div class="choice-grid">' + rt.blds.map(function (b, i) {
          return '<button class="btn danger" data-resolve="raze" data-idx="' + i + '">' + bIconOr(b.t, 20) + ' <b>' + esc(FOF.BUILDINGS[b.t].name) + '</b>' +
            (b.o !== pd.pid ? '<br><small>appartient à ' + esc(st.players[b.o].name) + '</small>' : '') + '</button>';
        }).join('') + '</div></div>';
    } else if (modal && modal.kind === 'attack') h = attackHTML(modal);
    else if (modal && modal.kind === 'turn') h = collectHTML();
    else if (modal && modal.kind === 'killc') {
      var uk = st.units.filter(function (x) { return x.uid === modal.uid; })[0];
      h = uk ? '<div class="modal edouardc"><h2>' + FOF.ic('skull', 20) + ' Licencier ' + esc(FOF.unitDef(uk.key).name) + ' ?</h2>' +
        '<p>L’unité quitte le jeu et sa carte retourne à la défausse. Vous récupérez la place, pas l’or : les <b>' + uk.gold + ' pièce' + (uk.gold > 1 ? 's' : '') + '</b> posées sur sa carte sont perdues.</p>' +
        '<p class="warn-line">Une seule unité licenciée par tour. Vous pourrez acheter à sa place dans ce même tour de recrutement.</p>' +
        '<div class="actions"><button class="btn" data-close="1">Annuler</button><button class="btn gold" data-killgo="1">Licencier</button></div></div>'
        : '<div class="modal"><p>Unité introuvable.</p><div class="actions"><button class="btn primary" data-close="1">Fermer</button></div></div>';
    }
    else if (modal && modal.kind === 'stack') {
      var sl = modal.loc, sun = FOF.unitsAt(st, sl), slead = st.players.filter(function (q) { return q.alive && q.lpos === sl; });
      h = '<div class="modal gloss"><h2>' + esc(FOF.locName(st, sl)) + ' · ' + (sun.length + slead.length) + ' pions</h2><div class="glosswrap"><div class="stacklist">' +
        slead.map(function (q) {
          return '<div class="pc-row" style="--pc:' + color(q.id) + '">' + FOF.heroImg(q.leader, 'portrait') +
            '<div class="t"><b>' + esc(FOF.LEADERS[q.leader].name) + '</b><small>Dirigeant de ' + esc(q.name) + ' · combat +' + q.mod + '</small></div></div>';
        }).join('') +
        sun.map(function (u) {
          var d = FOF.unitDef(u.key), ar = FOF.unitArt(u.key), ow = st.players[u.owner];
          return '<div class="pc-row" style="--pc:' + color(u.owner) + '">' + (ar ? '<img src="' + ar + '" alt="">' : '') +
            '<div class="t"><b>' + esc(d.name) + '</b><small>' + esc(ow.name) + ' · ' + (FOF.isElite(u.key) ? 'élite' : 'spéciale') +
            ' · entretien ' + d.upkeep + ' · réserve ' + u.gold + (u.owner === st.cur ? ' · ' + u.movesLeft + ' déplacement' + (u.movesLeft > 1 ? 's' : '') : '') + '</small></div></div>';
        }).join('') +
        '</div></div><div class="actions"><button class="btn primary" data-close="1">Fermer</button></div></div>';
    }
    else if (modal && modal.kind === 'capitalc') {
      var ct = st.map.terr[modal.tid], cp = FOF.cur(st);
      h = '<div class="modal edouardc"><h2>' + FOF.ic('crown', 20) + ' Transférer votre capitale ?</h2>' +
        '<p>Votre cour quitterait <b>' + esc(st.map.terr[cp.capital].name) + '</b> pour <b>' + esc(ct.name) + '</b>.</p>' +
        '<div class="ed-ledger"><span>Coût</span><b class="num">8 <i class="coin"></i></b><span>Après le transfert</span><b class="num' + (cp.gold - 8 < 2 ? ' low' : '') + '">' + (cp.gold - 8) + ' <i class="coin"></i></b></div>' +
        (FOF.countBld(st, cp.id, 'A')
          ? '<p class="warn-line danger">' + FOF.ic('warn', 16) + ' Votre <b>Ambassade</b> sera <b>détruite</b> : elle ne tient qu’à la capitale et ne suit pas la cour. Il faudra la rebâtir (4 or) dans la nouvelle.</p>'
          : '') +
        (st.map.terr[cp.capital].blds.filter(function (b) { return b.t !== 'A'; }).length > 2
          ? '<p class="warn-line danger">' + FOF.ic('warn', 16) + ' <b>' + esc(st.map.terr[cp.capital].name) + '</b> redeviendra un territoire ordinaire : <b>2 emplacements au lieu de 3</b>. Vous devrez y <b>raser un aménagement</b> juste après le transfert.</p>'
          : '') +
        '<p class="warn-line">La capitale donne +2 en défense et un troisième emplacement d’aménagement. Perdre la capitale vous élimine.</p>' +
        '<div class="actions"><button class="btn" data-close="1">Annuler</button><button class="btn gold" data-capitalgo="1">Oui, transférer · 8 or</button></div></div>';
    }
    else if (modal && modal.kind === 'settings') h = settingsHTML();
    else if (modal && modal.kind === 'help') h = helpHTML();
    else if (modal && modal.kind === 'gloss') h = glossHTML();
    else if (modal && modal.kind === 'deck') h = deckHTML();
    else if (modal && modal.kind === 'hero') {
      var hp = modal.pid !== undefined ? st.players[modal.pid] : FOF.cur(st);
      h = '<div class="modal"><h2 style="color:' + color(hp.id) + '">' + esc(hp.name) + '</h2>' + FOF.heroHTML(hp.leader) +
        '<div class="actions"><button class="btn primary" data-close="1">Fermer</button></div></div>';
    }
    else if (modal && modal.kind === 'surrender') {
      var me = net ? st.players[net.seatIndex()] : FOF.cur(st);
      // v1.8 : quitter ne veut pas forcément dire abandonner. On propose d'abord la mise en pause.
      h = '<div class="modal surrender"><h2>' + FOF.ic('flag', 22) + ' Quitter la partie ?</h2>' +
        '<p><b>' + esc(me.name) + '</b> s’apprête à quitter. Deux possibilités :</p>' +
        '<p><b>Mettre en pause 48 h</b> — la partie est conservée telle quelle. ' +
        (net ? 'Reprenez-la quand vous voulez avec le code <b>' + net.code + '</b>. ' : 'Vous la retrouverez depuis l’accueil. ') +
        'Si personne n’y touche pendant 48 heures, elle est abandonnée automatiquement.</p>' +
        '<p><b>Abandonner maintenant</b> — vos territoires redeviennent neutres, vos aménagements sont détruits et vos unités défaussées.</p>' +
        '<p class="warn-line">L’abandon est irréversible.</p>' +
        '<div class="actions"><button class="btn" data-close="1">Continuer la partie</button>' +
        '<button class="btn primary" data-pause="1">Mettre en pause 48 h</button>' +
        '<button class="btn danger" data-surrender="1">Abandonner maintenant</button></div></div>';
    }
    else if (modal && modal.kind === 'edouardc') {
      var ep = FOF.cur(st), after = ep.gold - 4;
      h = '<div class="modal edouardc"><h2>' + FOF.ic('branch', 20) + ' Acheter 1 diplomatie ?</h2>' +
        '<p>Le pouvoir d’Edouard le Sage vous coûtera <b class="num">4</b> or et vous fera passer de <b class="num">' + ep.dip + '</b> à <b class="num">' + (ep.dip + 1) + '</b> en diplomatie' + (FOF.countBld(st, ep.id, 'A') ? ', <b>+2 avec votre Ambassade</b>' : '') + '.</p><p class="warn-line">Ce pouvoir ne sert qu’<b>une seule fois par partie</b>.</p>' +
        '<div class="ed-ledger"><span>Trésor</span><b class="num">' + ep.gold + ' <i class="coin"></i></b><span>Après l’achat</span><b class="num' + (after < 2 ? ' low' : '') + '">' + after + ' <i class="coin"></i></b></div>' +
        (st.round <= 1 ? '<p class="warn-line">Nous sommes au <b>tour 1</b> : avec ' + after + ' or il vous restera peu de quoi recruter. La plupart des unités coûtent 1 à 3 or.</p>'
          : after < 2 ? '<p class="warn-line">Il ne vous restera que ' + after + ' or pour ce tour.</p>' : '') +
        '<div class="actions"><button class="btn" data-close="1">Annuler</button><button class="btn gold" data-act="edouardgo">Oui, payer 4 or</button></div></div>';
    }
    else if (modal && modal.kind === 'confirmNew') h = '<div class="modal"><h2>' + (net ? 'Quitter la partie en ligne ?' : 'Nouvelle partie ?') + '</h2><p>' + (net ? 'Vous pourrez la rejoindre à nouveau avec le code <b>' + net.code + '</b>.' : 'La partie en cours sera perdue.') + '</p><div class="actions"><button class="btn" data-close="1">Annuler</button><button class="btn danger" data-act="newgame">' + (net ? 'Quitter' : 'Recommencer') + '</button></div></div>';
    var html = h ? '<div class="modal-bg">' + h + '</div>' : '';
    if (el.dataset.sig !== html) {
      el.innerHTML = html; el.dataset.sig = html;
      // musicUI() ne fait que rafraîchir des contrôles existants : il faut les poser d'abord
      var slotA = el.querySelector('[data-music-slot]');
      if (slotA && FOF.musicHTML) { slotA.innerHTML = FOF.musicHTML(); if (FOF.musicUI) FOF.musicUI(); }
    }
    el.hidden = !h;
  }
  function passHTML(pid) { return pid !== st.cur ? '<div class="pass" style="background:' + color(pid) + '33;border:1px solid ' + color(pid) + '">Décision de <b>' + esc(st.players[pid].name) + '</b></div>' : ''; }
  function winProb(delta) { var w = 0, l = 0; for (var a = 1; a <= 6; a++) for (var b = 1; b <= 6; b++) { if (a + delta > b) w++; else if (a + delta < b) l++; } return w + l ? w / (w + l) : 0.5; }
  /* ---------- début de tour = collecte : bilan détaillé de l'or ---------- */
  function collectHTML() {
    var cp = FOF.cur(st), c = st.collect, inc = c ? c.inc : FOF.income(st, cp), rows = [];
    function row(lbl, v, cls) { rows.push('<div class="lg ' + (cls || '') + '"><span>' + lbl + '</span><b>' + (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v) + '</b></div>'); }
    row('<img class="icn" src="assets/icons/terr.svg" alt=""> Territoires × ' + inc.terr, inc.terr, 'plus');
    if (inc.cities) row('<img class="icn" src="assets/icons/bld-Ci.png" alt=""> Cités × ' + inc.cities, inc.cities, 'plus');
    if (inc.ports) row('<img class="icn" src="assets/icons/bld-P.png" alt=""> Ports d’Aliénor × ' + inc.ports, inc.ports, 'plus');
    FOF.army(st, cp.id).forEach(function (u) {
      if ((u.key === 'caboteur' || u.key === 'caravanier') && u.pos[0] === 't') {
        var typ = u.key === 'caboteur' ? 'P' : 'Ci', tt = st.map.terr[+u.pos.slice(1)];
        if (tt.blds.some(function (b) { return b.t === typ && b.o !== cp.id; })) row('Commerce : ' + esc(FOF.unitDef(u.key).name) + ' à ' + esc(tt.name), 2, 'plus');
      }
    });
    FOF.army(st, cp.id).forEach(function (u) { row('Solde : ' + esc(FOF.unitDef(u.key).name), -FOF.unitDef(u.key).upkeep, 'minus'); });
    var net = c ? c.net : inc.total - inc.upkeep;
    var acts = [];
    if (cp.leader === 'edouard') acts.push('<button class="btn gold" data-act="edouard" ' + (cp.edouardUsed || cp.dip > 3 || cp.gold < 4 || cp.tyran || cp.attackedLast || cp.raidedLast ? 'disabled' : '') + '>Edouard : 4 or → +1 diplomatie</button>');
    FOF.army(st, cp.id).forEach(function (u) { if (u.key === 'exploratrice') { var eff = FOF.effectAvailable(st, u); acts.push('<button class="btn" data-effect="' + u.uid + '" ' + (eff ? '' : 'disabled title="Elle doit être sur un territoire neutre d’un autre continent"') + '>Exploratrice : ' + (eff ? 'revendiquer ' + esc(FOF.locName(st, u.pos)) : 'rien à revendiquer ici') + '</button>'); } });
    return '<div class="modal collect"><div class="pass" style="background:' + color(cp.id) + '33;border:1px solid ' + color(cp.id) + '">' + (net ? 'À vous de jouer, <b>' + esc(cp.name) + '</b> !' : 'Passez l’écran à <b>' + esc(cp.name) + '</b>') + '</div>' +
      '<div class="collect-top">' + FOF.heroImg(cp.leader) + '<div><div class="ribbon" style="background:' + color(cp.id) + ';color:#fff">' + esc(cp.name) + '</div><div class="muted">' + esc(FOF.LEADERS[cp.leader].name) + ' · tour ' + st.round + '</div></div></div>' +
      '<div class="gold-big ' + (net < 0 ? 'neg' : '') + '"><i class="coin"></i><span>' + (net >= 0 ? '+' : '−') + Math.abs(net) + '</span><small>écus ce tour</small></div>' +
      '<div class="ledger">' + rows.join('') + '<div class="lg tot"><span>Trésor</span><b>' + cp.gold + ' <i class="coin"></i></b></div></div>' +
      (c && c.deficit ? '<p class="warn-line">Il manquait ' + c.deficit + ' écus : des pièces ont été reprises sur vos unités.</p>' : '') +
      (cp.tyran ? '<p class="warn-line">Vous êtes Tyran : un de vos territoires se révoltera à la fin du tour.</p>' : '') +
      (acts.length ? '<div class="collect-acts">' + acts.join('') + '</div>' : '') +
      '<div class="actions"><button class="btn primary go" data-collectgo="1">Passer au recrutement →</button></div></div>';
  }
  var FACE = { 1: 'rotateX(0deg) rotateY(0deg)', 2: 'rotateY(-90deg)', 3: 'rotateX(-90deg)', 4: 'rotateX(90deg)', 5: 'rotateY(90deg)', 6: 'rotateY(180deg)' };
  var PIPS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
  function dieHTML(v, col) {
    var faces = [[1, 'f1'], [2, 'f2'], [3, 'f3'], [4, 'f4'], [5, 'f5'], [6, 'f6']].map(function (f) {
      var pips = ''; for (var k = 1; k <= 9; k++) pips += '<i' + (PIPS[f[0]].indexOf(k) >= 0 ? ' class="on"' : '') + '></i>';
      return '<div class="face ' + f[1] + '">' + pips + '</div>';
    }).join('');
    return '<div class="die3d" style="--dc:' + col + '"><div class="cube" style="--final:' + FACE[v] + '">' + faces + '</div></div>';
  }
  // un camp du combat : les unités qui s'affrontent (et le dirigeant seulement s'il est engagé)
  function sideHTML(q, det, tot, die, units, lead, delay) {
    units = units || [];
    var troops = units.map(function (k) { var a = FOF.unitArt(k); return '<div class="trp' + (FOF.isElite(k) ? ' el' : '') + '">' + (a ? '<img src="' + a + '" alt="">' : '<div class="noart">' + esc(FOF.unitDef(k).name.slice(0, 2)) + '</div>') + '<span>' + esc(FOF.unitDef(k).name) + '</span></div>'; });
    if (lead) troops.unshift('<div class="trp lead">' + FOF.heroImg(q.leader, '') + '<span>' + esc(FOF.LEADERS[q.leader].name) + '</span></div>');
    if (!troops.length) troops.push('<div class="trp none"><img src="assets/icons/terr.svg" alt=""><span>Garnison (aménagements)</span></div>');
    return '<div class="side" style="--sc:' + color(q.id) + '"><h4>' + esc(q.name) + '</h4><div class="troops">' + troops.join('') + '</div>' + det.map(function (x) { return '<div class="kv"><span>' + esc(x[0]) + '</span><b class="num">+' + x[1] + '</b></div>'; }).join('') +
      (die ? dieHTML(die, color(q.id)) + '<div class="total num reveal">' + tot + '</div>' : '<div class="total num">' + tot + ' + ' + FOF.ic('dice', 16) + '</div>') + '</div>';
  }
  function attackHTML(m) {
    var tg = FOF.attackTargets(st, m.loc), p = FOF.cur(st);
    if (!tg.length) { modal = null; return null; }
    // v1.8 : la cible de l'attaque a son propre champ. Elle écrasait auparavant modal.kind,
    // qui sert à identifier la fenêtre : au rendu suivant la fenêtre d'attaque disparaissait,
    // ce qui rendait les Trébuchets inutilisables (le choix fermait l'écran sans rien faire).
    if (m.target === undefined) { m.target = tg[0].target; m.tkind = tg[0].kind; }
    var pv = FOF.previewAttack(st, { loc: m.loc, target: m.target });
    var d = st.players[m.target], prob = Math.round(winProb(pv.A - pv.D) * 100);
    var h = ['<div class="modal attack"><h2>' + FOF.ic('swords', 22) + ' Déclarer la guerre — ' + esc(FOF.locName(st, m.loc)) + '</h2>'];
    h.push('<div class="section-title">Cible</div><div style="display:flex;gap:6px;flex-wrap:wrap">' + tg.map(function (x) { var q = st.players[x.target]; return '<button class="btn small ' + (x.target === m.target && x.kind === m.tkind ? 'primary' : '') + '" data-tsel="' + x.target + '|' + x.kind + '">' + (x.kind === 'terr' ? 'Territoire de ' : 'Unités de ') + esc(q.name) + '</button>'; }).join('') + '</div>');
    if (pv.lead) h.push('<div class="lead-warn">' + FOF.ic('warn', 17) + ' <b>' + esc(FOF.LEADERS[p.leader].name) + '</b> mène l’assaut en personne (+' + p.mod + (p.leader === 'odon' ? ', +1 par élite' : '') + '). En cas de défaite, vous céderez un territoire au vainqueur et votre dirigeant reviendra à votre capitale.</div>');
    h.push('<div class="duel">' + sideHTML(p, pv.detA, pv.A, 0, pv.att.map(function (u) { return u.key; }), pv.lead) + '<div class="vs">' + FOF.ic('swords', 22) + '</div>' + sideHTML(d, pv.detD, pv.D, 0, pv.du.map(function (u) { return u.key; }), pv.dl) + '</div>');
    h.push('<p>Chances de victoire : <b class="num">' + prob + ' %</b> · Coût : <b class="num">' + (pv.cost ? '−' + pv.cost + ' diplomatie' + (p.pact === d.id ? ' (rupture du pacte !)' : '') : 'aucun (cible Tyran)') + '</b></p>');
    h.push('<p class="muted">Si vous perdez, toutes vos unités engagées sont défaussées.</p><div class="actions"><button class="btn" data-close="1">Annuler</button><button class="btn attack-go" data-go="1">' + FOF.ic('swords', 17) + ' Lancer l’assaut</button></div></div>');
    return h.join('');
  }
  function combatHTML(c) {
    var a = st.players[c.att], d = st.players[c.def], last = c.rolls[c.rolls.length - 1];
    return '<div class="modal battle ' + (c.win ? 'awin' : 'dwin') + '"><h2>Bataille de ' + esc(FOF.locName(st, c.loc)) + '</h2><div class="duel">' + sideHTML(a, c.detA, c.A + last.a, last.a, c.unitsA, c.leadA) + '<div class="vs">' + FOF.ic('swords', 22) + '</div>' + sideHTML(d, c.detD, c.D + last.d, last.d, c.unitsD, c.leadD) + '</div>' +
      (c.rolls.length > 1 ? '<p class="muted">Égalité : relancé ' + (c.rolls.length - 1) + ' fois.</p>' : '') +
      c.rolls.map(function (r) { return r.notes.map(function (n) { return '<p class="muted">' + esc(n) + '</p>'; }).join(''); }).join('') +
      '<div class="verdict">' + (c.win ? 'Victoire de ' + esc(a.name) : esc(d.name) + ' tient bon') + '</div><div>' + c.events.map(function (e) { return '<p>' + esc(e) + '</p>'; }).join('') + '</div>' +
      '<div class="actions"><button class="btn primary" data-close="1">Continuer</button></div></div>';
  }
  /* ---------- fin de partie : le bilan, façon tableau de campagne ---------- */
  function endStatsHTML() {
    var w = st.winner ? st.players[st.winner.pid] : null;
    var mins = Math.max(1, Math.round((Date.now() - (st.t0 || Date.now())) / 60000));
    var rows = st.players.slice().sort(function (x, y) { return (y.alive ? 1 : 0) - (x.alive ? 1 : 0) || FOF.terrOf(st, y.id).length - FOF.terrOf(st, x.id).length; });
    var head = ['Dirigeant', 'Terr.', 'Record', 'Temples', 'Cités', 'Forts', 'Or', 'Dipl.', 'Recrues', 'Bâtis', 'Batailles', 'Gagnées'];
    var h = ['<div class="modal endstats"><h2>' + FOF.ic('scroll', 22) + ' Bilan de la partie</h2>',
      '<p class="muted">' + st.round + ' tours · ' + mins + ' min · ' + st.players.length + ' joueurs' + (w ? ' · vainqueur : ' + esc(w.name) : '') + '</p>',
      '<div class="statwrap"><table class="stats"><thead><tr>' + head.map(function (x) { return '<th>' + x + '</th>'; }).join('') + '</tr></thead><tbody>'];
    rows.forEach(function (q) {
      var t = q.tally || {};
      h.push('<tr class="' + (w && q.id === w.id ? 'win' : q.alive ? '' : 'out') + '" style="--pc:' + color(q.id) + '"><td class="who"><span><span class="dot" style="background:' + color(q.id) + '"></span>' + esc(q.name) + (q.bot ? ' ' + FOF.ic('helm', 12) : '') + '</span><small>' + esc(FOF.LEADERS[q.leader].name) + (q.tyran ? ' · Tyran' : '') + (q.alive ? '' : ' · éliminé') + '</small></td>' +
        [FOF.terrOf(st, q.id).length, t.peak || 0, FOF.countBld(st, q.id, 'T'), FOF.countBld(st, q.id, 'Ci'), FOF.countBld(st, q.id, 'F'), q.gold, q.tyran ? '—' : q.dip, t.recruit || 0, t.build || 0, t.battles || 0, t.wins || 0].map(function (x) { return '<td class="num">' + x + '</td>'; }).join('') + '</tr>');
    });
    h.push('</tbody></table></div><div class="actions"><button class="btn" data-closestats="1">Retour</button><button class="btn primary" data-act="newgame">Nouvelle partie</button></div></div>');
    return h.join('');
  }

  /* ---------- glossaire ---------- */
  // texte réécrit par le créateur du jeu (v1.9) — ne pas reformuler sans son accord
  var GLOSS = [
    ['Case', 'Un territoire ou une zone de mer.'],
    ['Territoire', 'Une case de terre. Il en existe 4 types : plaines, forêts, montagnes, marécage.'],
    ['Zone de mer', 'Une étendue d’eau. On ne s’y bat jamais, et il faut partir d’un port pour y entrer.'],
    ['Neutre', 'Territoire sans maître. Votre dirigeant peut le prendre en le conquérant. Pour ce faire, il faut rester dessus un tour pour pouvoir le conquérir au prochain tour.'],
    ['Capitale', 'La case de départ de votre dirigeant : +2 en défense. La perdre, c’est perdre la partie.'],
    ['Dirigeant', 'Votre héros. Aucun entretien, ajoute son bonus au combat sur sa case, et seul lui peut conquérir un territoire neutre.'],
    ['Unité d’élite', 'Une troupe qui se bat. Sa puissance dépend du terrain de la case.'],
    ['Unité spéciale', 'Une unité qui ne peut pas attaquer mais se défend, et qui a un effet propre (diplomatie, or, conversion…).'],
    ['Aménagement', 'Campement, fort, port, cité ou temple. Il appartient à un joueur, qui peut être différent du maître du territoire.'],
    ['Entretien', 'Le coût par tour d’une unité. Si l’or manque, vous reprenez des pièces posées sur vos cartes ; une unité à court de pièces est renvoyée.'],
    ['Conquérir', 'Prendre un territoire neutre avec son dirigeant, ou garder un territoire ennemi après une victoire (les aménagements restent à leur propriétaire).'],
    ['Dévaster', 'Après une victoire, tout raser : le territoire redevient neutre et tous les aménagements disparaissent. Coûte 1 diplomatie de plus.'],
    ['Pacifier', 'Sur un de vos territoires où restent des aménagements d’un autre joueur : laissez-y une unité d’élite un tour entier et ils deviennent les vôtres.'],
    ['Convertir', 'Changer le propriétaire d’un aménagement.'],
    ['Remplacer', 'Changer le type d’un de vos aménagements en payant le prix du nouveau. L’ancien disparaît.'],
    ['Céder', 'Donnez vos aménagements situés chez un autre joueur : +1 diplomatie par territoire. Il ne peut pas refuser.'],
    ['Diplomatie', 'Ressource qui dépend de vos interactions avec les autres joueurs. Vous pouvez en gagner et en perdre.'],
    ['Tyran', 'Ce que devient celui qui attaque sans diplomatie : il n’en gagne plus, tout le monde peut l’attaquer gratuitement, et un de ses territoires se révolte à chaque tour.'],
    ['Pacte', 'Accord de non-agression apporté par l’Ambassadeur. Le rompre coûte 2 diplomatie.'],
    ['Zone de recrutement', 'Les 5 cartes face visible du marché. Un achat et une défausse par tour.'],
    ['Déployer', 'Poser l’unité achetée sur un de vos territoires qui possède l’aménagement demandé par sa carte.']
  ];
  function glossHTML() {
    return '<div class="modal gloss"><h2>' + FOF.ic('book', 22) + ' Glossaire</h2><div class="glosswrap"><dl>' +
      GLOSS.map(function (g) { return '<dt>' + esc(g[0]) + '</dt><dd>' + esc(g[1]) + '</dd>'; }).join('') +
      '</dl></div><div class="actions"><button class="btn primary" data-close="1">Fermer</button></div></div>';
  }

  /* ---------- le deck, consultable à tout moment ---------- */
  function deckHTML() {
    function group(list) {
      var c = {}; list.forEach(function (k) { c[k] = (c[k] || 0) + 1; });
      return Object.keys(c).sort(function (x, y) { return FOF.unitDef(x).name.localeCompare(FOF.unitDef(y).name); })
        .map(function (k) { return '<li class="' + (FOF.isElite(k) ? 'el' : 'sp') + '" data-key="' + k + '"><b>' + c[k] + '×</b> ' + esc(FOF.unitDef(k).name) + '<small>' + (FOF.isElite(k) ? 'élite' : 'spéciale') + ' · entretien ' + FOF.unitDef(k).upkeep + '</small></li>'; }).join('');
    }
    // v1.9.2 : la zone de recrutement est consultable ici à tout moment, et survoler n'importe
    // quelle ligne affiche la carte en grand (le survol marche sur tout élément [data-key]).
    var zone = st.zone.filter(Boolean).map(function (k) {
      var ar = FOF.unitArt(k);
      return '<div class="zcard" data-key="' + k + '">' + (ar ? '<img src="' + ar + '" alt="">' : '<img src="assets/cardback.jpg" alt="">') +
        '<span>' + esc(FOF.unitDef(k).name) + '</span></div>';
    }).join('');
    return '<div class="modal deckview"><h2>' + FOF.ic('cards', 22) + ' Le deck</h2>' +
      '<div class="section-title">Zone de recrutement · les 5 cartes face visible</div>' +
      '<div class="zonestrip">' + (zone || '<span class="muted">Zone vide</span>') + '</div>' +
      '<p class="muted" style="margin-top:12px">Il reste <b class="num">' + st.deck.length + '</b> cartes à piocher et <b class="num">' + st.discard.length + '</b> à la défausse. L’ordre de la pioche reste secret. <b>Survolez une ligne pour voir la carte en grand.</b></p>' +
      '<div class="deckcols"><div><div class="section-title">Encore dans la pioche</div><ul class="decklist">' + (group(st.deck) || '<li class="muted">Pioche vide</li>') + '</ul></div>' +
      '<div><div class="section-title">Défausse</div><ul class="decklist">' + (group(st.discard) || '<li class="muted">Rien pour l’instant</li>') + '</ul></div></div>' +
      '<div class="actions"><button class="btn primary" data-close="1">Fermer</button></div></div>';
  }

  function helpHTML() {
    var v = st.victory, B = FOF.BUILDINGS, n = st.n;
    function bl(k) { return '<b>' + B[k].name + '</b> ' + B[k].cost + ' or'; }
    return '<div class="modal help"><h2>' + FOF.ic('help', 22) + ' Les règles</h2>' +

      '<div class="section-title">Le but</div>' +
      '<p>Trois façons de gagner, ouvertes à tous dès le premier tour. La victoire est <b>immédiate</b> dès qu\'une condition est remplie. À ' + n + ' joueurs :</p>' +
      '<ul class="rules-l"><li><b>Militaire</b> — contrôler <b>' + v.mil + ' territoires</b>, votre capitale comprise.</li>' +
      '<li><b>Religieuse</b> — posséder <b>' + v.rel + ' temples</b>, y compris en terre étrangère.</li>' +
      '<li><b>Diplomatique</b> — atteindre <b>' + v.dip + ' de diplomatie</b>.</li></ul>' +

      '<div class="section-title">Le tour, en quatre phases</div>' +
      '<ol class="rules-l"><li><b>Collecte</b> — vous encaissez 1 or par territoire, 1 de plus par cité, moins la solde de vos unités. Si vous ne pouvez pas payer, une unité déserte.</li>' +
      '<li><b>Recrutement</b> — cinq cartes sont face visible. Vous pouvez en <b>acheter une</b> et en <b>défausser une</b>, dans l\'ordre que vous voulez. Le prix d\'achat est égal à l\'entretien de la carte.</li>' +
      '<li><b>Militaire</b> — vous déplacez vos pions, vous conquérez, vous attaquez.</li>' +
      '<li><b>Construction</b> — vous bâtissez autant que votre or le permet.</li></ol>' +

      '<div class="section-title">Se déplacer</div>' +
      '<p>Cliquez un de vos pions : les cases atteignables clignotent en blanc, cliquez-en une. Le badge vert sur un pion indique les cases qu\'il lui reste.</p>' +
      '<p><b>La mer.</b> Pour <b>prendre la mer</b> il faut partir d\'un territoire qui porte un port — le vôtre ou celui d\'un autre joueur. Une fois en mer, vous <b>débarquez où vous voulez</b> : toutes les côtes voisines de la zone sont ouvertes, port ou pas. Le Corbeau messager prend la mer sans port.</p>' +

      '<div class="section-title">Conquérir un territoire neutre</div>' +
      '<p>Sans combat, et sans votre armée : votre <b>dirigeant</b> doit se trouver sur le territoire neutre <b>depuis votre tour précédent</b>, sans avoir bougé ni combattu. Le bouton « Conquérir » apparaît alors dans son menu.</p>' +

      '<div class="section-title">Combattre</div>' +
      '<p>Amenez vos unités sur la case visée, puis cliquez-la. Toutes vos unités présentes combattent ensemble.</p>' +
      '<ul class="rules-l"><li><b>Attaquant</b> : 1 dé + la puissance de chaque élite <b>selon le terrain de la case</b> + son dirigeant s\'il est présent.</li>' +
      '<li><b>Défenseur</b> : 1 dé + ses unités + son dirigeant + la défense de <b>ses</b> aménagements sur la case + <b>2</b> si c\'est sa capitale.</li>' +
      '<li>Égalité : on relance les dés.</li>' +
      '<li>Chaque attaque coûte <b>1 diplomatie</b>, sauf contre un Tyran.</li>' +
      '<li>Si votre dirigeant menait l\'assaut et que vous perdez, vous cédez un territoire au vainqueur et il rentre à votre capitale.</li></ul>' +

      '<div class="section-title">Bâtir</div>' +
      '<p>En phase de construction, cliquez un de vos territoires. <b>Deux aménagements par case</b> au maximum, jamais deux du même type — sauf le campement, qu\'on peut doubler.</p>' +
      '<ul class="rules-l"><li>' + bl('C') + ' · +1 en défense.</li>' +
      '<li>' + bl('F') + ' · +3 en défense.</li>' +
      '<li>' + bl('P') + ' · +1 en défense, et permet d\'embarquer.</li>' +
      '<li>' + bl('Ci') + ' · +1 or à chaque collecte. Beaucoup de cartes exigent des cités.</li>' +
      '<li>' + bl('T') + ' · compte pour la victoire religieuse.</li>' +
      '<li>' + bl('T') + ' · le temple <b>ne compte pas</b> dans la limite de deux aménagements.</li>' +
      '<li>' + bl('A') + ' · dans votre capitale uniquement, une seule, et <b>elle ne compte pas</b> dans la limite de deux. Chaque gain de diplomatie obtenu par une action vous en rapporte <b>1 de plus</b>, à condition de n\'avoir ni attaqué ni été attaqué depuis votre dernier tour.</li></ul>' +
      '<p>Vous pouvez aussi <b>remplacer</b> un de vos aménagements en payant le prix du nouveau, ou <b>transférer votre capitale</b> sur un de vos territoires pour 10 or — votre Ambassade, qui ne tient qu’à la cour, est alors <b>détruite</b>.</p>' +

      '<div class="section-title">Diplomatie et tyrannie</div>' +
      '<p>La diplomatie est à la fois une voie de victoire et la monnaie de la guerre.</p>' +
      '<ul class="rules-l"><li>Vous en <b>perdez</b> 1 par attaque, et 1 de plus pour dévaster.</li>' +
      '<li>Vous en <b>gagnez</b> en jouant des émissaires sur les capitales adverses, et en cédant volontairement vos aménagements chez un autre joueur (+1 par territoire cédé).</li>' +
      '<li>À <b>0</b>, un joueur qui attaque quand même devient <b>Tyran</b> : il ne gagne plus jamais de diplomatie, tout le monde peut l\'attaquer sans rien payer, et un de ses territoires se révolte à chaque tour.</li>' +
      '<li>Un territoire qui s’est soulevé contre un tyran lui est <b>fermé</b> : il ne peut plus le conquérir ni s’y établir tant qu’un autre joueur ne l\'a pas repris.</li></ul>' +

      '<div class="section-title">Fin de partie</div>' +
      '<p>Un joueur qui perd sa capitale est <b>éliminé</b>. S\'il ne reste qu\'un joueur en vie, il l\'emporte. Une partie laissée de côté plus de 48 heures est abandonnée.</p>' +

      '<div class="actions"><button class="btn primary" data-close="1">Fermer</button></div></div>';
  }

  /* ================= événements ================= */
  document.addEventListener('click', function (e) {
    if (!st) return;
    if (radial && !e.target.closest('#radial')) radial = null;
    if (e.target.closest('#boardWrap') && !e.target.closest('#popover') && !e.target.closest('#radial')) { if (!dragMoved) boardClick(e); return; }
    var el = e.target.closest('[data-capitalgo],[data-setstyle],[data-setspeed],[data-setanim],[data-pause],[data-surrender],[data-endstats],[data-closestats],[data-closeradial],[data-act],[data-buy],[data-discard],[data-move],[data-conquer],[data-pacify],[data-effect],[data-build],[data-replace],[data-capital],[data-cede],[data-attack],[data-close],[data-resolve],[data-take],[data-tsel],[data-go],[data-next],[data-closepop],[data-cancel],[data-mini],[data-hidemarket],[data-showmarket],[data-heroinfo],[data-collectgo],[data-undo],[data-release],[data-killgo],[data-stack],[data-backphase]');
    if (!el) return;
    var ds = el.dataset, p = FOF.cur(st);
    var VIEW = ds.undo || ds.release || ds.stack || ds.capital || ds.capitalgo || ds.setstyle !== undefined || ds.setspeed !== undefined || ds.setanim !== undefined || ds.pause || ds.surrender || ds.closeradial || ds.closepop || ds.cancel || ds.hidemarket || ds.showmarket || ds.close || ds.heroinfo || ds.endstats || ds.closestats || ds.act === 'newgame';
    if (FOF.sfx) FOF.sfx(clickSound(ds));
    if (ds.surrender) {
      var sid = net ? net.seatIndex() : st.cur;
      modal = null;
      return dispatch({ type: 'surrender', pid: sid }, false, true);
    }
    if (ds.endstats) { modal = { kind: 'endstats' }; return render(); }
    if (ds.closestats) { modal = null; return render(); }
    if (ds.close && modal && (modal.kind === 'gloss' || modal.kind === 'deck' || modal.kind === 'edouardc' || modal.kind === 'settings' || modal.kind === 'capitalc' || modal.kind === 'killc' || modal.kind === 'stack')) { modal = prevModal; prevModal = null; return render(); }
    if (ds.heroinfo) { modal = { kind: 'hero' }; if (ds.heroinfo !== '1') modal.pid = +ds.heroinfo; return render(); }
    if (ds.closeradial) { radial = null; return render(); }
    if (radial && (ds.move || ds.conquer || ds.attack)) radial = null;
    if (ds.collectgo) { modal = null; if (st.phase === 'collect' && !st.pending.length) return dispatch({ type: 'nextPhase' }); return render(); }
    if (!VIEW && !myTurn()) { err = 'Ce n’est pas à vous de jouer.'; pop = null; return render(); }
    if (ds.undo) return undoMove();
    if (ds.backphase) { mode = null; pop = null; modal = null; return dispatch({ type: 'prevPhase' }); }
    if (ds.release) { modal = { kind: 'killc', uid: +ds.release }; return render(); }
    if (ds.killgo) { var uk = modal.uid; modal = null; return dispatch({ type: 'release', uid: uk }); }
    if (ds.stack) { modal = { kind: 'stack', loc: ds.stack }; return render(); }
    if (ds.next) { if (mode && mode.kind === 'deploy') { err = 'Déployez d’abord votre unité sur un territoire qui clignote, ou annulez l’achat.'; marketOpen = true; return render(); } mode = null; pop = null; modal = null; return dispatch({ type: 'nextPhase' }); }
    if (ds.act === 'edouard') { openOver('edouardc'); return; }
    if (ds.act === 'edouardgo') { modal = prevModal; prevModal = null; return dispatch({ type: 'edouard' }); }
    if (ds.act === 'spy') return dispatch({ type: 'spy' });
    // v1.8 : pause — on quitte l'écran de jeu sans rien abandonner. La sauvegarde locale et le
    // salon en ligne restent en place ; la règle des 48 h existante ferme la partie si personne ne revient.
    if (ds.setstyle !== undefined) {
      FOF.setMapStyle(ds.setstyle);
      if (st) FOF.Board.prepare(st, $('baseCv'), function () { render(); });
      return render();
    }
    if (ds.setspeed !== undefined) {
      botSpeed = ds.setspeed; try { localStorage.setItem('fof-botspeed', botSpeed); } catch (e2) {}
      return render();
    }
    if (ds.setanim !== undefined) {
      FOF.animOn = ds.setanim === '1';
      try { localStorage.setItem('fof-anim', FOF.animOn ? '1' : '0'); } catch (e3) {}
      document.body.classList.toggle('no-anim', !FOF.animOn);
      return render();
    }
    if (ds.pause) {
      if (net) { net.stop(); net = null; }
      document.body.classList.remove('online');
      st = null; modal = null; $('modal').hidden = true; $('game').hidden = true; FOF.showSetup(); return;
    }
    if (ds.act === 'newgame') { if (net) { net.stop(); net = null; FOF.clearOnline(); } else { FOF.statsAbandon(st); FOF.clearSaved(); } document.body.classList.remove('online'); st = null; modal = null; $('modal').hidden = true; $('game').hidden = true; FOF.showSetup(); return; }
    if (ds.closepop) { pop = null; err = ''; return render(); }
    if (ds.cancel) { var wasDeploy = mode && mode.kind === 'deploy'; mode = null; if (wasDeploy) marketOpen = true; return render(); }
    if (ds.hidemarket) { marketOpen = false; return render(); }
    if (ds.showmarket) { marketOpen = true; return render(); }
    if (ds.buy !== undefined) {
      var k = st.zone[+ds.buy], spots = FOF.deploySpots(st, k);
      if (spots.length === 1) { sel = 't' + spots[0]; return dispatch({ type: 'buy', slot: +ds.buy, tid: spots[0] }); }
      mode = { kind: 'deploy', slot: +ds.buy, spots: spots }; marketOpen = false; return render();
    }
    if (ds.discard !== undefined) return dispatch({ type: 'discardZone', slot: +ds.discard });
    if (ds.mini) {
      var u = st.units.filter(function (x) { return x.uid === +ds.mini; })[0]; if (!u) return;
      sel = u.pos; pop = null;
      if (st.phase === 'military') startMove(u.uid);
      return render();
    }
    if (ds.move) { if (startMove(ds.move === 'L' ? 'L' : +ds.move)) pop = null; return render(); }
    if (ds.conquer) return dispatch({ type: 'conquer' });
    if (ds.pacify) return dispatch({ type: 'pacify', uid: +ds.pacify, tid: +sel.slice(1) }, true);
    if (ds.effect) return dispatch({ type: 'effect', uid: +ds.effect, arg: ds.arg !== undefined ? +ds.arg : undefined }, true);
    if (ds.build) return dispatch({ type: 'build', tid: +ds.tid, btype: ds.build }, true);
    if (ds.replace) return dispatch({ type: 'replace', tid: +ds.tid, idx: +ds.idx, btype: ds.replace }, true);
    // v1.8 : un clic malheureux transférait la cour et coûtait 10 or sans prévenir (signalé en playtest).
    if (ds.capital) { openOver('capitalc'); modal.tid = +ds.capital; return render(); }
    if (ds.capitalgo) { var tidc = modal.tid; modal = prevModal; prevModal = null; return dispatch({ type: 'moveCapital', tid: tidc }); }
    if (ds.cede) return dispatch({ type: 'cede', tid: +ds.cede });
    if (ds.attack) { pop = null; modal = { kind: 'attack', loc: ds.attack, withLeader: false }; return render(); }
    if (ds.tsel) { var parts = ds.tsel.split('|'); modal.target = +parts[0]; modal.tkind = parts[1]; return render(); }
    if (ds.go) { var m = modal; modal = null; return dispatch({ type: 'attack', loc: m.loc, target: m.target, kind: m.tkind, withLeader: !!m.withLeader }); }
    if (ds.resolve === 'raze') return dispatch({ type: 'resolve', idx: +ds.idx });
    if (ds.resolve) return dispatch({ type: 'resolve', choice: ds.resolve });
    if (ds.take) return dispatch({ type: 'deficitTake', uid: +ds.take });
    if (ds.close) { modal = null; render(); if (FOF.FX_flushGold) FOF.FX_flushGold(); return; }
  });
  function clickSound(ds) {
    if (ds.next) return st.phase === 'build' ? 'bell' : 'page';
    if (ds.collectgo) return 'page';
    if (ds.buy !== undefined) return 'coins';
    if (ds.discard !== undefined) return 'card';
    if (ds.build || ds.replace || ds.capital) return 'mallet';
    if (ds.cede || ds.pacify || ds.act === 'edouard' || ds.act === 'edouardgo') return 'dip';
    if (ds.move || ds.mini) return 'select';
    if (ds.conquer) return 'flag';
    if (ds.effect) return 'magic';
    if (ds.go) return 'charge';
    if (ds.attack || ds.tsel) return 'draw';
    if (ds.take) return 'spend';
    if (ds.act === 'spy') return 'card';
    return 'click';
  }
  document.addEventListener('change', function (e) { if (e.target.id === 'withLeader' && modal) { modal.withLeader = e.target.checked; render(); } });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && st) { if (mode) { if (mode.kind === 'deploy') marketOpen = true; mode = null; } else if (pop) pop = null; else if (modal && (modal.kind === 'attack' || modal.kind === 'help')) modal = null; render(); } });
  window.addEventListener('resize', function () { if (st) render(); });
  FOF.bindBar = function () {
    var g = $('game'), lb = $('logBtn'), open = window.innerWidth >= 1500;
    try { var sv = localStorage.getItem('fof-log2'); if (sv !== null) open = sv === '1'; } catch (e) {}
    function setLog(o) { g.classList.toggle('no-right', !o); lb.setAttribute('aria-pressed', String(o)); try { localStorage.setItem('fof-log2', o ? '1' : '0'); } catch (e) {} if (st) render(); }
    setLog(open);
    lb.addEventListener('click', function () { setLog(g.classList.contains('no-right')); });
    $('helpBtn').addEventListener('click', function () { if (!st) return; modal = { kind: 'help' }; render(); });
    $('flagBtn').addEventListener('click', function () { if (!st || st.winner) return; modal = { kind: 'surrender' }; render(); });
    $('glossBtn').addEventListener('click', function () { if (!st) return; openOver('gloss'); });
    $('deckBtn').addEventListener('click', function () { if (!st) return; openOver('deck'); });
    $('newBtn').addEventListener('click', function () { if (!st) return; modal = { kind: 'confirmNew' }; render(); });
    var setB = $('setBtn');
    if (setB) setB.addEventListener('click', function () { if (!st) return; openOver('settings'); });
    $('zoomIn').addEventListener('click', function () { zoom = Math.min(3.2, zoom * 1.25); render(); });
    $('zoomOut').addEventListener('click', function () { zoom = Math.max(1, zoom / 1.25); render(); });
  };
})(window.FOF = window.FOF || {});
