/* Fields of Fire — interface (hot-seat, 3 à 6 joueurs sur le même écran) */
(function (FOF) {
  'use strict';
  var calmT = null, radial = null, st = null, sel = null, mode = null, pop = null, err = '', modal = null, lastTurnShown = 0, zoom = 1, marketOpen = true, net = null, combatSig = '';
  var SAVE = 'fof-save-v1';
  var $ = function (id) { return document.getElementById(id); };
  var esc = FOF.esc;
  function color(pid) { var p = st.players[pid]; return FOF.PLAYER_COLORS.filter(function (c) { return c.id === p.color; })[0].hex; }
  function bIcon(t, h) { return '<img src="assets/icons/bld-' + t + '.png" alt="' + FOF.BUILDINGS[t].name + '"' + (h ? ' style="height:' + h + 'px"' : '') + '>'; }

  function save() { if (net) return; try { localStorage.setItem(SAVE, JSON.stringify(st)); } catch (e) {} }
  FOF.loadSaved = function () { try { var s = localStorage.getItem(SAVE); return s ? JSON.parse(s) : null; } catch (e) { return null; } };
  FOF.clearSaved = function () { try { localStorage.removeItem(SAVE); } catch (e) {} };

  // net : salon en ligne (null = jeu local sur un seul écran)
  FOF.startUI = function (state, room) {
    st = state; sel = null; mode = null; pop = null; err = ''; modal = null; lastTurnShown = 0; zoom = 1; marketOpen = true;
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

  function dispatch(a, keepPop, force) {
    if (!force && !myTurn()) { err = isBotActor() ? 'L’ordinateur est en train de jouer…' : 'Ce n’est pas à vous de jouer.'; return render(); }
    try { FOF.act(st, a); err = ''; }
    catch (e) { err = e.message; if (FOF.sfx && !force) FOF.sfx('error'); }
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
    if (st.turnNo !== lastTurnShown && !st.winner && !modal) { lastTurnShown = st.turnNo; if ((!net || net.seatIndex() === st.cur) && !st.players[st.cur].bot) modal = { kind: 'turn' }; }
    if (st.winner) modal = { kind: 'victory' };
    var before = FOF.FX ? FOF.FX.before() : null;
    renderHeader(); renderOpponents(); renderBoard(); renderMat(); renderRight(); renderModal();
    if (FOF.FX) FOF.FX.after(st, before, { color: color, myTurn: myTurn(), online: !!net, seat: net ? net.seatIndex() : null });
    // musique épique pendant les combats
    if (FOF.musicMode) {
      var battle = modal && (modal.kind === 'attack' || modal.kind === 'combat');
      if (battle) { clearTimeout(calmT); calmT = null; FOF.musicMode('battle'); }
      else if (!calmT) calmT = setTimeout(function () { calmT = null; if (!(modal && (modal.kind === 'attack' || modal.kind === 'combat'))) FOF.musicMode('calm'); }, 5000);
    }
    scheduleBot();
  }

  /* ---------- adversaires ordinateur : ils jouent une action à la fois, à un rythme lisible ---------- */
  var botT = null;
  function botActive() {
    if (!st || st.winner || !isBotActor()) return false;
    if (net && !net.isHost()) return false;          // en ligne, c'est l'hôte qui fait jouer les bots
    return true;
  }
  function scheduleBot() {
    if (botT || !botActive()) return;
    var fast = FOF.animOn === false, delay = fast ? 300 : 700;
    if (modal && modal.kind === 'combat') delay = fast ? 1500 : 3200;
    botT = setTimeout(function () {
      botT = null; if (!botActive()) return;
      if (modal && modal.kind === 'combat') { modal = null; if (FOF.FX_flushGold) FOF.FX_flushGold(); }
      var a = FOF.botAct(st); if (!a) return;
      dispatch(a, false, true);
      if (err) { FOF.botFailed(st, a); err = ''; render(); }
    }, delay);
  }

  var PHASES = [['collect', 'Collecte'], ['recruit', 'Recrutement'], ['military', 'Militaire'], ['build', 'Construction']];
  function renderHeader() {
    var pi = PHASES.map(function (x) { return x[0]; }).indexOf(st.phase);
    $('phases').innerHTML = PHASES.map(function (x, i) { if (x[0] === 'collect') return ''; return '<span class="phase ' + (i === pi ? 'on' : i < pi ? 'done' : '') + '"><span class="n">' + i + '</span><span class="t">' + x[1] + '</span></span>'; }).join('');
    $('roundChip').innerHTML = 'Tour ' + st.round + (net ? ' · <span class="room-code" title="Code du salon">' + net.code + '</span> · vous : <b style="color:' + color(net.seatIndex()) + '">' + esc(st.players[net.seatIndex()].name) + '</b>' : '');
  }

  function renderOpponents() {
    $('players').innerHTML = '<div class="section-title">Dirigeants</div>' + st.players.map(function (p) {
      var terr = FOF.terrOf(st, p.id).length, tem = FOF.countBld(st, p.id, 'T');
      var pills = (p.tyran ? '<span class="pill tyran">Tyran</span>' : '') + (p.pact !== null ? '<span class="pill pact">Pacte</span>' : '') + (!p.alive ? '<span class="pill">Éliminé</span>' : '');
      return '<div class="opp ' + (p.id === st.cur ? 'active ' : '') + (!p.alive ? 'dead' : '') + '" style="--pc:' + color(p.id) + '">' + FOF.heroImg(p.leader) +
        '<div><div class="nm"><span>' + esc(p.name) + (p.bot ? ' <small title="Ordinateur">🤖</small>' : '') + '</span>' + pills + '</div><div class="ld">' + esc(FOF.LEADERS[p.leader].name) + '</div>' +
        '<div class="st"><span title="Or"><span class="coin" style="width:11px;height:11px;vertical-align:-1px"></span> <b>' + p.gold + '</b></span>' +
        '<span title="Diplomatie">🤝 <b>' + (p.tyran ? '—' : p.dip) + '</b></span>' +
        '<span title="Territoires"><img class="icn" src="assets/icons/terr.svg" alt=""> <b>' + terr + '/' + st.victory.mil + '</b></span>' +
        '<span title="Temples"><img class="icn" src="assets/icons/bld-T.png" alt=""> <b>' + tem + '/' + st.victory.rel + '</b></span></div></div></div>';
    }).join('');
  }

  /* ---------- carte ---------- */
  function renderBoard() {
    var b = FOF.Board.bounds();
    var board = $('board'), wrap = $('boardWrap');
    if (!b) return;
    var fit = Math.min((board.clientWidth - 24) / b.w, (board.clientHeight - 24) / b.h);
    if (!(fit > 0)) fit = 1;
    var sc = fit * zoom;
    wrap.style.width = Math.round(b.w * sc) + 'px'; wrap.style.height = Math.round(b.h * sc) + 'px';
    wrap.style.marginTop = zoom === 1 ? Math.max(12, (board.clientHeight - b.h * sc) / 2) + 'px' : '12px';
    wrap.dataset.scale = sc;
    var picks = pickTargets();
    FOF.Board.overlay(st, $('ovCv'), { sel: sel, picks: picks }, color);
    FOF.Board.ambient(st, $('amCv'));
    var blink = null;
    if (mode && mode.kind === 'move') blink = mode.reach;
    else if (mode && mode.kind === 'deploy') { blink = {}; mode.spots.forEach(function (tid) { blink['t' + tid] = 1; }); }
    FOF.Board.reach(st, $('rcCv'), blink);
    $('tokens').setAttribute('viewBox', b.x + ' ' + b.y + ' ' + b.w + ' ' + b.h);
    $('tokens').innerHTML = tokensSVG();
    renderPopover(sc);
    renderRadial(sc, b);
    var ban = banner();
    $('banner').hidden = !ban; if (ban) $('banner').innerHTML = '<span>' + ban + '</span>' + (mode ? '<button class="btn small" data-cancel="1">Annuler</button>' : '');
    renderMarket();
  }
  function tokensSVG() {
    var out = ['<defs>'], m = st.map, p = FOF.cur(st);
    st.players.forEach(function (q) { out.push('<clipPath id="cl' + q.id + '"><circle r="10.5"/></clipPath>'); });
    out.push('<clipPath id="clu"><circle r="8"/></clipPath></defs>');
    // drapeaux de capitale, aménagements, marteaux de construction
    var canBuildHere = st.phase === 'build' && myTurn() && !st.pending.length && !st.winner;
    var mallets = [];
    m.terr.forEach(function (t) {
      var a = FOF.Board.anchor('t' + t.id); if (!a) return;
      // capitale : drapeau à gauche, aménagements à sa droite (le groupe reste centré, rien ne se chevauche)
      var isCap = t.ctrl !== null && st.players[t.ctrl].capital === t.id && st.players[t.ctrl].alive;
      var nb = t.blds.length, groupW = (isCap ? 16 : 0) + nb * 17 - (nb ? 2 : 0), gx0 = a.x - groupW / 2;
      if (isCap) {
        var fc = color(t.ctrl);
        out.push('<g class="flag" transform="translate(' + (nb ? gx0 : a.x - 6) + ' ' + (a.y - 1) + ')"><line x1="0" y1="0" x2="0" y2="-19" stroke="#2a2118" stroke-width="1.6" stroke-linecap="round"/><path class="flagcloth" d="M0.8 -18.5 C5 -20.5 8 -16 13 -17.5 L13 -9 C8 -7.5 5 -12 0.8 -10 Z" fill="' + fc + '" stroke="#1b1712" stroke-width=".7"/><circle cx="0" cy="-19.5" r="1.4" fill="#e2b448"/></g>');
      }
      t.blds.forEach(function (bd, i) {
        var bx = gx0 + (isCap ? 16 : 0) + i * 17, by = a.y - 16;
        out.push('<rect x="' + bx + '" y="' + by + '" width="15" height="15" rx="3" fill="#f7efd9" stroke="' + color(bd.o) + '" stroke-width="2"/><image href="assets/icons/bld-' + bd.t + '.png" x="' + (bx + 2) + '" y="' + (by + 2) + '" width="11" height="11"/>');
      });
      if (canBuildHere && ['C', 'F', 'P', 'Ci', 'T'].some(function (ty) { return !FOF.canBuild(st, t.id, ty); })) {
        mallets.push('<g class="mallet" data-tloc="t' + t.id + '" transform="translate(' + (nb ? gx0 + groupW + 11 : isCap ? a.x + 16 : a.x) + ' ' + (a.y - 8.5) + ')"><g class="bob"><circle r="9" fill="#f7efd9" stroke="#8a5a2b" stroke-width="1.4"/><g transform="rotate(-35)"><rect x="-1.2" y="-2" width="2.4" height="10" rx="1" fill="#9a6a3a" stroke="#4a2f16" stroke-width=".6"/><rect x="-5.5" y="-6.5" width="11" height="5.5" rx="1.4" fill="#c08a52" stroke="#4a2f16" stroke-width=".7"/><line x1="-2.5" y1="-6.3" x2="-2.5" y2="-1.2" stroke="#4a2f16" stroke-width=".5"/><line x1="2.5" y1="-6.3" x2="2.5" y2="-1.2" stroke="#4a2f16" stroke-width=".5"/></g><title>Construire ici</title></g></g>');
      }
    });
    // pions
    var byLoc = {};
    st.players.forEach(function (q) { if (q.alive && q.lpos) (byLoc[q.lpos] = byLoc[q.lpos] || []).push({ leader: true, owner: q.id }); });
    st.units.forEach(function (u) { (byLoc[u.pos] = byLoc[u.pos] || []).push(u); });
    Object.keys(byLoc).forEach(function (loc) {
      var a = FOF.Board.anchor(loc); if (!a) return;
      var list = byLoc[loc], n = Math.min(list.length, 5), gap = 24;
      list.slice(0, 5).forEach(function (it, i) {
        var x = a.x + (i - (n - 1) / 2) * gap, y = a.y + 15;
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
        out.push(g + '<title>' + esc(it.leader ? FOF.LEADERS[st.players[it.owner].leader].name : FOF.unitDef(it.key).name) + ' — ' + esc(st.players[it.owner].name) + '</title></g></g></g>');
      });
      if (list.length > 5) out.push('<text class="tlabel" x="' + (a.x + 3 * gap) + '" y="' + (a.y + 6) + '">+' + (list.length - 5) + '</text>');
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
    if (owner) h += '<small>🛡 Défense : <b>+' + FOF.defBonus(st, owner, t) + '</b>' + (cap ? ' (dont +2 de capitale)' : '') + ' + dé</small>';
    else h += '<small>🛡 Neutre : se conquiert sans combat</small>';
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
    items.push('<button class="rbtn move" data-move="L" ' + (canMove ? '' : 'disabled') + '><b>🏃</b><span>Se déplacer</span></button>');
    if (t && t.ctrl === null) {
      var ok = p.lArr < st.turnNo && !p.lMoved && !p.lFought && !p.lConq;
      items.push('<button class="rbtn conquer" data-conquer="1" ' + (ok ? '' : 'disabled title="Il doit être ici depuis votre tour précédent, sans avoir bougé"') + '><b>🚩</b><span>Conquérir</span></button>');
    }
    if (FOF.attackTargets(st, radial.loc).length) items.push('<button class="rbtn attack" data-attack="' + radial.loc + '"><b>⚔</b><span>Attaquer</span></button>');
    items.push('<button class="rbtn close" data-closeradial="1"><b>✕</b><span>Fermer</span></button>');
    var n = items.length, R = 78;
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
    else h.push('<div class="sub">Zone de mer — on n’y combat pas (sauf Aliénor).</div>');
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
    if (st.phase === 'military' && FOF.attackTargets(st, loc).length) h.push('<div style="margin-top:10px"><button class="btn attack-cta" data-attack="' + loc + '">⚔ Attaquer</button></div>');
    if (h.length <= 2 && !(t && t.blds.length)) return h.join('') + '<p class="muted" style="margin:0">Rien à faire ici pour l’instant.</p>';
    return h.join('');
  }
  function leaderRow(p, t) {
    var acts = [];
    if (st.phase === 'military') {
      acts.push('<button class="btn small primary" data-move="L" ' + (p.lConq || p.lFought || p.lMovesLeft <= 0 ? 'disabled' : '') + '>Déplacer</button>');
      if (t && t.ctrl === null) {
        var ok = p.lArr < st.turnNo && !p.lMoved && !p.lFought;
        acts.push('<button class="btn small primary" data-conquer="1" ' + (ok ? '' : 'disabled') + '>Conquérir</button>');
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
  function buildPanel(p, t) {
    var h = ['<div class="section-title" style="margin-top:4px">Bâtir ici · ' + p.gold + ' or</div><div class="bgrid">'];
    FOF.BUILDING_ORDER.forEach(function (b) {
      var e = FOF.canBuild(st, t.id, b), B = FOF.BUILDINGS[b];
      var eff = { C: '+1 déf.', F: '+3 déf.', P: '+1 déf., mer', Ci: '+1 or/tour', T: 'victoire religieuse' }[b];
      h.push('<button class="bbtn parch" data-build="' + b + '" data-tid="' + t.id + '" ' + (e ? 'disabled title="' + esc(e) + '"' : 'title="' + B.name + ' : ' + eff + '"') + '>' + bIcon(b) + '<span>' + B.name + '</span><span class="price">' + FOF.bldCost(st, p, b) + '<span class="coin"></span></span><small>' + eff + '</small></button>');
    });
    h.push('</div>');
    var mine = t.blds.map(function (b, i) { return [b, i]; }).filter(function (x) { return x[0].o === p.id; });
    mine.forEach(function (x) {
      h.push('<div class="section-title" style="margin-top:10px">Remplacer ' + FOF.BUILDINGS[x[0].t].name.toLowerCase() + ' par</div><div class="bgrid">' + FOF.BUILDING_ORDER.filter(function (b) { return b !== x[0].t; }).map(function (b) {
        var bad = p.gold < FOF.bldCost(st, p, b) || (b !== 'C' && t.blds.some(function (o, i) { return i !== x[1] && o.t === b; })) || (b === 'P' && !t.seas.length);
        return '<button class="bbtn parch" data-replace="' + b + '" data-idx="' + x[1] + '" data-tid="' + t.id + '" ' + (bad ? 'disabled' : '') + '>' + bIcon(b, 20) + '<span class="price">' + FOF.bldCost(st, p, b) + '<span class="coin"></span></span></button>';
      }).join('') + '</div>');
    });
    if (t.id !== p.capital) h.push('<div style="margin-top:10px"><button class="btn small" data-capital="' + t.id + '" ' + (p.gold < 10 ? 'disabled' : '') + '>♛ Installer la capitale ici · 10 or</button></div>');
    return h.join('');
  }

  /* ---------- marché ---------- */
  function renderMarket() {
    var el = $('market'), p = FOF.cur(st);
    if (st.phase !== 'recruit' || !marketOpen || st.pending.length) { el.hidden = true; $('marketToggle').hidden = st.phase !== 'recruit'; return; }
    $('marketToggle').hidden = true;
    var spy = FOF.army(st, p.id).some(function (u) { return u.key === 'espion'; });
    var h = ['<h3>Zone de recrutement · 1 achat et 1 défausse par tour <button class="btn small ghost" data-hidemarket="1">Masquer ▾</button></h3><div class="market-inner">'];
    h.push('<div class="deckpile"><img src="assets/cardback.jpg" alt="Deck"><span>Deck : <b class="num">' + st.deck.length + '</b><br>Défausse : <b class="num">' + st.discard.length + '</b></span>' +
      (spy ? '<button class="btn small" data-act="spy" ' + (p.flags.spied || p.gold < 1 ? 'disabled' : '') + '>Espion (1 or)</button>' : '') +
      (st.spy && st.spy.pid === p.id ? '<span>Dessus : <b>' + esc(FOF.unitDef(st.spy.key).name) + '</b></span>' : '') + '</div>');
    st.zone.forEach(function (k, i) {
      if (!k) { h.push('<div></div>'); return; }
      var why = FOF.canBuy(st, k), d = FOF.unitDef(k);
      var acts = '<div class="acts"><button class="btn buy" data-buy="' + i + '" ' + (why ? 'disabled' : '') + '>Acheter · ' + d.upkeep + ' or</button><button class="btn" data-discard="' + i + '" ' + (p.flags.discarded || p.flags.bought ? 'disabled' : '') + '>Défausser</button></div><div class="why">' + esc(why || '') + '</div>';
      h.push('<div class="slot' + (why || !myTurn() ? '' : ' can-buy') + '" data-slotkey="' + i + ':' + k + ':' + st.deck.length + '">' + FOF.cardHTML(k, { actions: acts }) + '</div>');
    });
    h.push('</div>');
    el.innerHTML = h.join(''); el.hidden = false;
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
      (p.tyran ? '<div class="track"><span class="lbl">🤝 Diplomatie</span><span class="pill tyran">Tyran : plus de diplomatie</span></div>' : track('Diplomatie', '🤝 ', p.dip, v.dip)) + '</div>' +
      '<div class="army">' + (army.length ? army.map(function (u) {
        var a = FOF.unitArt(u.key), done = u.fought || u.pacif || u.movesLeft <= 0;
        return '<div class="mini ' + (FOF.isElite(u.key) ? 'elite ' : '') + (st.phase === 'military' && done ? 'done' : '') + '" data-mini="' + u.uid + '" data-key="' + u.key + '">' + (a ? '<img src="' + a + '" alt="">' : '<img src="assets/cardback.jpg" alt="">') +
          (st.phase === 'military' && !done ? '<span class="mv">' + u.movesLeft + '</span>' : '') + '<div class="mn">' + esc(FOF.unitDef(u.key).name) + '</div><div class="ms">' + esc(FOF.locName(st, u.pos)) + ' · réserve ' + u.gold + '</div></div>';
      }).join('') : '<span class="muted" style="font-size:13px">Aucune unité. Recrutez-en pendant la phase de recrutement.</span>') + '</div></div>');
    var hint = HINTS[st.phase];
    if (!myTurn()) { var ap = st.players[actor()]; hint = ap.bot ? ['<span class="bot-think">🤖 <b>' + esc(ap.name) + '</b> réfléchit<i>.</i><i>.</i><i>.</i></span>', 'Tour de ' + esc(ap.name) + '…'] : ['Les autres joueurs voient la partie en direct. Vous pouvez consulter la carte.', 'Tour de ' + esc(ap.name) + '…']; }
    var blocked = mode && mode.kind === 'deploy';
    if (blocked) hint = ['Déployez d’abord votre unité (territoire qui clignote) ou annulez l’achat.', hint[1]];
    h.push('<div class="cta"><div class="hint">' + hint[0] + '</div><button class="btn primary go" data-next="1" ' + (st.pending.length || st.winner || !myTurn() || blocked ? 'disabled' : '') + '>' + hint[1] + '</button>' +
      (st.phase === 'recruit' && myTurn() && !marketOpen ? '<button class="btn small" data-showmarket="1">🛒 Ouvrir le marché</button>' : '') +
      (p.leader === 'edouard' && st.phase === 'collect' ? '<button class="btn small" data-act="edouard" ' + (p.flags.edouard || p.dip > 3 || p.gold < 3 || p.tyran ? 'disabled' : '') + '>Edouard : 3 or → +1 diplomatie</button>' : '') + '</div>');
    $('mat').innerHTML = h.join('');
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
    $('right').innerHTML = h.join('');
  }

  /* ---------- modales ---------- */
  function renderModal() {
    var el = $('modal'), pd = st.pending[0], h = null;
    if (st.winner) {
      var w = st.players[st.winner.pid], label = { mil: 'Victoire militaire', rel: 'Victoire religieuse', dip: 'Victoire diplomatique', survie: 'Dernier dirigeant debout' }[st.winner.type];
      h = '<div class="modal victory" style="text-align:center"><div class="confetti" aria-hidden="true">' + new Array(40).join('<i></i>') + '</div><div class="vcrown" style="width:140px;margin:0 auto 10px">' + FOF.heroImg(w.leader) + '</div><h2 style="color:' + color(w.id) + ';font-size:30px">' + esc(w.name) + '</h2><p class="verdict">' + label + '</p><p class="muted">' + esc(FOF.LEADERS[w.leader].name) + ' · tour ' + st.round + '</p><div class="actions" style="justify-content:center"><button class="btn primary" data-act="newgame">Nouvelle partie</button></div></div>';
    } else if (modal && modal.kind === 'combat' && st.lastCombat) h = combatHTML(st.lastCombat);
    else if (pd && net && net.seatIndex() !== pd.pid && (pd.type === 'conquest' || pd.type === 'deficit')) h = '<div class="modal"><h2>En attente</h2><p><b>' + esc(st.players[pd.pid].name) + '</b> prend une décision…</p></div>';
    else if (pd && pd.type === 'conquest') {
      var t = st.map.terr[pd.tid], d = st.players[pd.def];
      h = '<div class="modal">' + passHTML(pd.pid) + '<h2>' + esc(t.name) + ' est tombé</h2><p>Que faites-vous du territoire ?</p><div class="choice-grid">' +
        '<button class="btn primary" data-resolve="conquer"><b>Conquérir</b><br><small>Le territoire devient le vôtre. Les aménagements restent à leur propriétaire (pacifiez-les au tour suivant).</small></button>' +
        '<button class="btn danger" data-resolve="devastate"><b>Dévaster</b><br><small>Il redevient neutre, tout est détruit.' + (d.tyran ? '' : ' −1 diplomatie (et −1 par temple).') + '</small></button></div></div>';
    } else if (pd && pd.type === 'deficit') {
      var p = st.players[pd.pid];
      h = '<div class="modal">' + passHTML(pd.pid) + '<h2>Entretien impayé</h2><p>Il manque <b class="num">' + pd.left + '</b> or. Reprenez des pièces posées sur vos unités. Une unité à qui il manque une pièce sera défaussée.</p>' +
        FOF.army(st, p.id).map(function (u) { var a = FOF.unitArt(u.key); return '<div class="pc-row" style="--pc:' + color(p.id) + '">' + (a ? '<img src="' + a + '" alt="">' : '') + '<div class="t"><b>' + esc(FOF.unitDef(u.key).name) + '</b><small>réserve ' + u.gold + ' / entretien ' + FOF.unitDef(u.key).upkeep + '</small></div><button class="btn small" data-take="' + u.uid + '" ' + (u.gold <= 0 ? 'disabled' : '') + '>Reprendre 1 or</button></div>'; }).join('') + '</div>';
    } else if (modal && modal.kind === 'attack') h = attackHTML(modal);
    else if (modal && modal.kind === 'turn') h = collectHTML();
    else if (modal && modal.kind === 'help') h = helpHTML();
    else if (modal && modal.kind === 'hero') { var hp = FOF.cur(st); h = '<div class="modal"><h2>' + esc(hp.name) + '</h2>' + FOF.heroHTML(hp.leader) + '<div class="actions"><button class="btn primary" data-close="1">Fermer</button></div></div>'; }
    else if (modal && modal.kind === 'confirmNew') h = '<div class="modal"><h2>' + (net ? 'Quitter la partie en ligne ?' : 'Nouvelle partie ?') + '</h2><p>' + (net ? 'Vous pourrez la rejoindre à nouveau avec le code <b>' + net.code + '</b>.' : 'La partie en cours sera perdue.') + '</p><div class="actions"><button class="btn" data-close="1">Annuler</button><button class="btn danger" data-act="newgame">' + (net ? 'Quitter' : 'Recommencer') + '</button></div></div>';
    el.hidden = !h; el.innerHTML = h ? '<div class="modal-bg">' + h + '</div>' : '';
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
    if (cp.leader === 'edouard') acts.push('<button class="btn" data-act="edouard" ' + (cp.flags.edouard || cp.dip > 3 || cp.gold < 3 || cp.tyran ? 'disabled' : '') + '>Edouard : 3 or → +1 diplomatie</button>');
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
      (die ? dieHTML(die, color(q.id)) + '<div class="total num reveal">' + tot + '</div>' : '<div class="total num">' + tot + ' + 🎲</div>') + '</div>';
  }
  function attackHTML(m) {
    var tg = FOF.attackTargets(st, m.loc), p = FOF.cur(st);
    if (!tg.length) { modal = null; return null; }
    if (m.target === undefined) { m.target = tg[0].target; m.kind = tg[0].kind; }
    var treb = FOF.trebuchetFor(st, m.loc), t = m.loc[0] === 't' ? st.map.terr[+m.loc.slice(1)] : null;
    var pv = FOF.previewAttack(st, { loc: m.loc, target: m.target });
    var d = st.players[m.target], prob = Math.round(winProb(pv.A - pv.D) * 100);
    var h = ['<div class="modal attack"><h2>⚔ Déclarer la guerre — ' + esc(FOF.locName(st, m.loc)) + '</h2>'];
    h.push('<div class="section-title">Cible</div><div style="display:flex;gap:6px;flex-wrap:wrap">' + tg.map(function (x) { var q = st.players[x.target]; return '<button class="btn small ' + (x.target === m.target && x.kind === m.kind ? 'primary' : '') + '" data-tsel="' + x.target + '|' + x.kind + '">' + (x.kind === 'terr' ? 'Territoire de ' : 'Unités de ') + esc(q.name) + '</button>'; }).join('') + '</div>');
    if (pv.lead) h.push('<div class="lead-warn">⚠ <b>' + esc(FOF.LEADERS[p.leader].name) + '</b> mène l’assaut en personne (+' + p.mod + (p.leader === 'odon' ? ', +1 par élite' : '') + '). En cas de défaite, vous céderez un territoire au vainqueur et votre dirigeant reviendra à votre capitale.</div>');
    if (treb && t) {
      var bl = t.blds.map(function (b, i) { return [b, i]; }).filter(function (x) { return x[0].o === m.target; });
      if (bl.length) h.push('<div class="section-title" style="margin-top:10px">Trébuchets</div><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn small ' + (m.trebBld === undefined ? 'primary' : '') + '" data-treb="-1">Ne pas tirer</button>' + bl.map(function (x) { return '<button class="btn small ' + (m.trebBld === x[1] ? 'primary' : '') + '" data-treb="' + x[1] + '">Détruire ' + FOF.BUILDINGS[x[0].t].name + '</button>'; }).join('') + '</div>');
    }
    h.push('<div class="duel">' + sideHTML(p, pv.detA, pv.A, 0, pv.att.map(function (u) { return u.key; }), pv.lead) + '<div class="vs">⚔</div>' + sideHTML(d, pv.detD, pv.D, 0, pv.du.map(function (u) { return u.key; }), pv.dl) + '</div>');
    h.push('<p>Chances de victoire : <b class="num">' + prob + ' %</b> · Coût : <b class="num">' + (pv.cost ? '−' + pv.cost + ' diplomatie' + (p.pact === d.id ? ' (rupture du pacte !)' : '') : 'aucun (cible Tyran)') + '</b></p>');
    h.push('<p class="muted">Si vous perdez, toutes vos unités engagées sont défaussées.</p><div class="actions"><button class="btn" data-close="1">Annuler</button><button class="btn attack-go" data-go="1">⚔ Lancer l’assaut 🎲</button></div></div>');
    return h.join('');
  }
  function combatHTML(c) {
    var a = st.players[c.att], d = st.players[c.def], last = c.rolls[c.rolls.length - 1];
    return '<div class="modal battle ' + (c.win ? 'awin' : 'dwin') + '"><h2>Bataille de ' + esc(FOF.locName(st, c.loc)) + '</h2><div class="duel">' + sideHTML(a, c.detA, c.A + last.a, last.a, c.unitsA, c.leadA) + '<div class="vs">⚔</div>' + sideHTML(d, c.detD, c.D + last.d, last.d, c.unitsD, c.leadD) + '</div>' +
      (c.rolls.length > 1 ? '<p class="muted">Égalité : relancé ' + (c.rolls.length - 1) + ' fois.</p>' : '') +
      c.rolls.map(function (r) { return r.notes.map(function (n) { return '<p class="muted">' + esc(n) + '</p>'; }).join(''); }).join('') +
      '<div class="verdict">' + (c.win ? 'Victoire de ' + esc(a.name) : esc(d.name) + ' tient bon') + '</div><div>' + c.events.map(function (e) { return '<p>' + esc(e) + '</p>'; }).join('') + '</div>' +
      '<div class="actions"><button class="btn primary" data-close="1">Continuer</button></div></div>';
  }
  function helpHTML() {
    var v = st.victory;
    return '<div class="modal help"><h2>Aide-mémoire</h2>' +
      '<h3>Victoire (immédiate)</h3><ul><li>Militaire : ' + v.mil + ' territoires</li><li>Religieuse : ' + v.rel + ' temples</li><li>Diplomatique : ' + v.dip + ' de diplomatie</li></ul>' +
      '<h3>Se déplacer</h3><ul><li>En phase militaire, cliquez un de vos pions : les cases atteignables clignotent en blanc. Cliquez-en une.</li><li>Le badge vert sur un pion indique les cases qui lui restent.</li><li>Pour prendre la mer, partez d’un territoire avec un port (le vôtre ou celui d’un autre).</li></ul>' +
      '<h3>Conquérir un neutre</h3><ul><li>Votre dirigeant doit être sur le territoire neutre depuis votre tour précédent, et ne pas bouger : bouton « Conquérir ».</li></ul>' +
      '<h3>Construire</h3><ul><li>En phase de construction, cliquez un de vos territoires : la fenêtre de construction s’ouvre. 2 aménagements par territoire (2 campements possibles).</li></ul>' +
      '<h3>Combat</h3><ul><li>1 dé + puissance des élites selon le terrain + dirigeant ; le défenseur ajoute ses aménagements et +2 sur sa capitale. Égalité : on relance.</li><li>Chaque attaque coûte 1 diplomatie (sauf contre un Tyran). Sous 0 : vous devenez Tyran.</li></ul>' +
      '<div class="actions"><button class="btn primary" data-close="1">Fermer</button></div></div>';
  }

  /* ================= événements ================= */
  document.addEventListener('click', function (e) {
    if (!st) return;
    if (radial && !e.target.closest('#radial')) radial = null;
    if (e.target.closest('#boardWrap') && !e.target.closest('#popover') && !e.target.closest('#radial')) { if (!dragMoved) boardClick(e); return; }
    var el = e.target.closest('[data-closeradial],[data-act],[data-buy],[data-discard],[data-move],[data-conquer],[data-pacify],[data-effect],[data-build],[data-replace],[data-capital],[data-cede],[data-attack],[data-close],[data-resolve],[data-take],[data-tsel],[data-treb],[data-go],[data-next],[data-closepop],[data-cancel],[data-mini],[data-hidemarket],[data-showmarket],[data-heroinfo],[data-collectgo]');
    if (!el) return;
    var ds = el.dataset, p = FOF.cur(st);
    var VIEW = ds.closeradial || ds.closepop || ds.cancel || ds.hidemarket || ds.showmarket || ds.close || ds.heroinfo || ds.act === 'newgame';
    if (FOF.sfx) FOF.sfx(clickSound(ds));
    if (ds.heroinfo) { modal = { kind: 'hero' }; return render(); }
    if (ds.closeradial) { radial = null; return render(); }
    if (radial && (ds.move || ds.conquer || ds.attack)) radial = null;
    if (ds.collectgo) { modal = null; if (st.phase === 'collect' && !st.pending.length) return dispatch({ type: 'nextPhase' }); return render(); }
    if (!VIEW && !myTurn()) { err = 'Ce n’est pas à vous de jouer.'; pop = null; return render(); }
    if (ds.next) { if (mode && mode.kind === 'deploy') { err = 'Déployez votre unité ou annulez l’achat.'; return render(); } mode = null; pop = null; return dispatch({ type: 'nextPhase' }); }
    if (ds.act === 'edouard') return dispatch({ type: 'edouard' });
    if (ds.act === 'spy') return dispatch({ type: 'spy' });
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
    if (ds.capital) return dispatch({ type: 'moveCapital', tid: +ds.capital });
    if (ds.cede) return dispatch({ type: 'cede', tid: +ds.cede });
    if (ds.attack) { pop = null; modal = { kind: 'attack', loc: ds.attack, withLeader: false }; return render(); }
    if (ds.tsel) { var parts = ds.tsel.split('|'); modal.target = +parts[0]; modal.kind = parts[1]; modal.trebBld = undefined; return render(); }
    if (ds.treb) { modal.trebBld = +ds.treb < 0 ? undefined : +ds.treb; return render(); }
    if (ds.go) { var m = modal, treb = FOF.trebuchetFor(st, m.loc); modal = null; return dispatch({ type: 'attack', loc: m.loc, target: m.target, kind: m.kind, withLeader: !!m.withLeader, treb: treb && m.trebBld !== undefined ? treb.uid : undefined, trebBld: m.trebBld }); }
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
    if (ds.cede || ds.pacify || ds.act === 'edouard') return 'dip';
    if (ds.move || ds.mini) return 'select';
    if (ds.conquer) return 'flag';
    if (ds.effect) return 'magic';
    if (ds.go) return 'charge';
    if (ds.attack || ds.tsel || ds.treb) return 'draw';
    if (ds.take) return 'spend';
    if (ds.act === 'spy') return 'card';
    return 'click';
  }
  document.addEventListener('change', function (e) { if (e.target.id === 'withLeader' && modal) { modal.withLeader = e.target.checked; render(); } });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && st) { if (mode) { if (mode.kind === 'deploy') marketOpen = true; mode = null; } else if (pop) pop = null; else if (modal && (modal.kind === 'attack' || modal.kind === 'help')) modal = null; render(); } });
  window.addEventListener('resize', function () { if (st) render(); });
  FOF.bindBar = function () {
    var g = $('game'), lb = $('logBtn'), open = window.innerWidth >= 1500;
    try { var sv = localStorage.getItem('fof-log2'); if (sv !== null) open = sv === '1'; } catch (e) {}
    function setLog(o) { g.classList.toggle('no-right', !o); lb.setAttribute('aria-pressed', String(o)); try { localStorage.setItem('fof-log2', o ? '1' : '0'); } catch (e) {} if (st) render(); }
    setLog(open);
    lb.addEventListener('click', function () { setLog(g.classList.contains('no-right')); });
    $('helpBtn').addEventListener('click', function () { if (!st) return; modal = { kind: 'help' }; render(); });
    $('newBtn').addEventListener('click', function () { if (!st) return; modal = { kind: 'confirmNew' }; render(); });
    $('zoomIn').addEventListener('click', function () { zoom = Math.min(3.2, zoom * 1.25); render(); });
    $('zoomOut').addEventListener('click', function () { zoom = Math.max(1, zoom / 1.25); render(); });
  };
})(window.FOF = window.FOF || {});
