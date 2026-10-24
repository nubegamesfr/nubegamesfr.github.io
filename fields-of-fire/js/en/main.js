/* Fields of Fire - accueil : choix du mode (local / en ligne), salon, choix des dirigeants par fiches */
(function (FOF) {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return FOF.esc(s); };
  var count = 4, rows = [], picking = null, room = null, step = 'mode';
  var tutoWanted = true; try { tutoWanted = localStorage.getItem('fof-tuto') !== '0'; } catch (e) {}
  // v1.9.17 - choix de la carte : 'proc' (générée) ou la clé d'une carte historique (FOF.CARTES)
  var carte = 'proc'; try { carte = localStorage.getItem('fof-carte') || 'proc'; } catch (e) {}
  function carteValide(c) { return c && (c === 'proc' || (FOF.CARTES && FOF.CARTES[c])) ? c : 'proc'; }
  carte = carteValide(carte);
  function carteDuSalon(row) { var h = row.seats.filter(function (s) { return s.cid === row.host_id; })[0]; return carteValide(h && h.carte); }
  // deux familles : cartes procédurales (générées à chaque partie) et cartes historiques (dessinées)
  function mapPickHTML(val, actif) {
    function bouton(c, nom, titre) {
      return '<button type="button" class="mp-b" data-carte="' + c + '" aria-pressed="' + (val === c) + '"' + (actif ? '' : ' disabled') + ' title="' + esc(titre) + '">' + esc(nom) + '</button>';
    }
    return '<span class="muted mp-l">Map</span>' +
      '<div class="mp-grp"><small>Generated</small>' + bouton('proc', 'Random', 'A brand-new map generated for every game') + '</div>' +
      '<div class="mp-grp"><small>Historical</small>' + FOF.historicList().map(function (h) { return bouton(h.cle, h.nom, 'Hand-drawn map, ' + Math.min.apply(null, h.joueurs) + ' to ' + Math.max.apply(null, h.joueurs) + ' players'); }).join('') + '</div>';
  }
  var DEFAULT_NAMES = ['Aurelian', 'Berenice', 'Corwin', 'Daphne', 'Elwin', 'Faustine'];
  var LEAD_KEYS = Object.keys(FOF.LEADERS);
  var TRIAL = ['hugues', 'alienor', 'yusuf', 'zaynab'];
  /* ---------- dirigeants à débloquer ----------
     Hugues et Alinor ne sont pas jouables tant que le joueur n'a pas laissé son adresse e-mail et
     accepté d'être recontacté. Le déblocage est mémorisé dans le navigateur. Les bots peuvent les
     jouer : c'est ce qui donne envie de les débloquer. */
  var LOCKED = FOF.LOCKED_LEADERS;
  function isLocked(k) { return FOF.leaderLocked(k); }
  // « Hugues le Bâtisseur, Alinor l’Amirale et Yusuf le Marchand » (v1.9.19 : trois dirigeants)
  function nomsVerrou() { var n = LOCKED.map(function (k) { return esc(FOF.LEADERS[k].name); }); return n.length > 1 ? n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1] : n.join(''); }
  // Les dirigeants verrouillés sont repoussés en fin de liste : avec 6 sièges au plus pour 8
  // dirigeants, ils ne sont jamais distribués tant qu'ils ne sont pas débloqués - ni au joueur,
  // ni aux autres sièges de la partie locale, qui sont eux aussi des humains.
  function shuffled() {
    var l = LEAD_KEYS.slice().sort(function () { return Math.random() - 0.5; });
    return l.filter(function (k) { return !isLocked(k); }).concat(l.filter(isLocked));
  }
  function colorHex(id) { return FOF.PLAYER_COLORS.filter(function (c) { return c.id === id; })[0].hex; }
  // les seuils étaient figés dans une table et ne suivaient plus l'équilibrage : on les calcule.
  function winText(n, c) {
    if (!n) return '';
    var nomC = c && c !== 'proc' && FOF.CARTES[c] ? ' (' + FOF.CARTES[c].nom + ')' : '';
    return 'With ' + n + ' players: ' + (7 * n) + ' territories on the map' + nomC + '. Win with ' + (8 + n) + ' territories, '
      + (5 + n) + ' temples or 12 Diplomacy.';
  }
  function setErr(msg) { $('netErr').textContent = msg || ''; }
  /* v1.9.10 - écran « Génération de la carte en cours ». La carte doit respecter strictement la
     règle des 4 débarquements : il faut parfois plusieurs passes (jusqu'à ~1 s mesurée à 4 joueurs).
     Personne n'est renvoyé du salon pendant ce temps : on affiche simplement ce voile. */
  function ecranGeneration(on) {
    var el = $('genMap');
    if (!on) {
      if (!el || el.classList.contains('fin')) return;
      el.classList.add('fin'); setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 450);
      clearInterval(el._t); return;
    }
    if (el) return;
    // v1.9.11 - une carte d'hexagones qui se dessine en vagues depuis le centre, sous une rose des
    // vents. Tout est en SVG + CSS : aucun fichier ni bibliothèque en plus.
    var W = 13, H = 8, R = 13, sq = Math.sqrt(3) * R, cx = (W - 1) / 2, cy = (H - 1) / 2, hx = [];
    var TERRE = ['#b3d65a', '#2d6b2f', '#aca596', '#526043', '#8fb04a'], MER = ['#1d3d62', '#24507d', '#1a3453'];
    function pts(x, y) { var a = []; for (var k = 0; k < 6; k++) { var an = Math.PI / 180 * (60 * k - 30); a.push((x + R * .94 * Math.cos(an)).toFixed(1) + ',' + (y + R * .94 * Math.sin(an)).toFixed(1)); } return a.join(' '); }
    for (var r = 0; r < H; r++) for (var c = 0; c < W; c++) {
      var x = sq * (c + .5 * (r & 1)) + sq, y = R * 1.5 * r + R + 4;
      var d = Math.sqrt(Math.pow((c - cx) / W * 2, 2) + Math.pow((r - cy) / H * 2, 2));
      var terre = Math.random() > d * .9 - .05, col = terre ? TERRE[(Math.random() * TERRE.length) | 0] : MER[(Math.random() * MER.length) | 0];
      hx.push('<polygon class="gh' + (terre ? ' t' : '') + '" points="' + pts(x, y) + '" style="fill:' + col + ';--d:' + (d * .7 + Math.random() * .2).toFixed(2) + 's"/>');
    }
    var vw = Math.ceil(sq * (W + 1.5)), vh = Math.ceil(R * 1.5 * H + R + 8);
    var rose = '<g class="gr-rose"><circle r="46" /><circle r="38" class="fine"/>' +
      [0, 45, 90, 135, 180, 225, 270, 315].map(function (a, i) { return '<path transform="rotate(' + a + ')" d="M0 -' + (i % 2 ? 30 : 44) + ' L5 0 L0 5 L-5 0 Z" class="' + (i % 2 ? 'b' : 'a') + '"/>'; }).join('') + '<circle r="4" class="c"/></g>';
    el = document.createElement('div'); el.id = 'genMap'; el.className = 'gen-map';
    el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
    el.innerHTML = '<div class="gen-scene">' +
      '<svg class="gen-hex" viewBox="0 0 ' + vw + ' ' + vh + '" aria-hidden="true">' + hx.join('') + '</svg><div class="gen-halo" aria-hidden="true"></div>' +
      '<svg class="gen-rose" viewBox="-50 -50 100 100" aria-hidden="true">' + rose + '</svg>' +
      '<p class="gen-titre">Generating the map…</p><p class="gen-etape" id="genEtape">Raising the continents</p></div>';
    document.body.appendChild(el);
    var etapes = ['Raising the continents', 'Drawing the coastlines', 'Dividing the seas', 'Drawing the borders'], ie = 0;
    el._t = setInterval(function () { var e = $('genEtape'); if (!e) return; ie = (ie + 1) % etapes.length; e.classList.remove('in'); void e.offsetWidth; e.textContent = etapes[ie]; e.classList.add('in'); }, 900);
  }
  function myName() { var v = ($('myName').value || '').trim().slice(0, 16); try { localStorage.setItem('fof-name', v); } catch (e) {} return v; }

  function show(s) {
    step = s;
    $('stepMode').hidden = s !== 'mode'; $('stepLocal').hidden = s !== 'local'; $('stepLobby').hidden = s !== 'lobby';
    var ian = $('iaNote'); if (ian) ian.hidden = s !== 'mode';
    var cat = $('catalog'); if (cat) { cat.hidden = s !== 'mode'; if (s === 'mode') renderCatalog(); }
    if (s === 'mode') renderMode(); if (s === 'local') renderLocal(); if (s === 'lobby') renderLobby();
  }

  /* ---------- choix du mode ---------- */
  function renderMode() {
    var on = FOF.onlineEnabled();
    $('stepMode').classList.toggle('offline', !on);
    $('onlineNote').hidden = on;
    var saved = FOF.loadSaved(), sOn = FOF.loadOnline(), h = [];
    if (saved && !saved.winner) h.push('<button class="btn" type="button" data-resume="local">Resume local game (round ' + saved.round + ', ' + saved.players.length + ' players)</button>');
    if (on && sOn) h.push('<button class="btn" type="button" data-resume="online">Back to room ' + esc(sOn.code) + '</button>');
    $('resumeBox').innerHTML = h.join('');
  }

  /* ---------- catalogue : tous les dirigeants et toutes les cartes du deck (v1.9.12) ---------- */
  var catTab = 'heroes', catFiltre = 'tout';
  function renderCatalog() {
    var el = $('catalog'); if (!el) return;
    var h = ['<div class="cat-head"><h2 id="catTitle">The Armory</h2><p>The leaders you can play and the ' + FOF.cartesEnJeu().length + ' cards in the deck (' + FOF.cartesEnJeu().reduce(function (s, k) { return s + FOF.copies(k); }, 0) + ' copies in total).</p>' +
      '<div class="cat-tabs" role="tablist">' +
      '<button type="button" role="tab" aria-selected="' + (catTab === 'heroes') + '" class="cat-tab' + (catTab === 'heroes' ? ' on' : '') + '" data-cattab="heroes">Leaders <b>' + LEAD_KEYS.length + '</b></button>' +
      '<button type="button" role="tab" aria-selected="' + (catTab === 'cards') + '" class="cat-tab' + (catTab === 'cards' ? ' on' : '') + '" data-cattab="cards">Deck Cards <b>' + FOF.cartesEnJeu().length + '</b></button></div></div>'];
    if (catTab === 'heroes') {
      h.push('<div class="cat-grid heroes">' + LEAD_KEYS.map(function (k) {
        return FOF.heroHTML(k, { note: isLocked(k) ? 'locked' : '' });
      }).join('') + '</div>');
    } else {
      h.push('<div class="cat-filters">' + [['tout', 'All'], ['el', 'Elite'], ['sp', 'Special']].map(function (f) {
        return '<button type="button" class="chip' + (catFiltre === f[0] ? ' on' : '') + '" data-catf="' + f[0] + '">' + f[1] + '</button>';
      }).join('') + '</div>');
      var keys = FOF.cartesEnJeu(catFiltre);   // v1.9.25 : sans les cartes retirées (Trébuchets, Gouverneur)
      h.push('<div class="cat-grid cards">' + keys.map(function (k) { return '<div class="cat-card">' + FOF.cardHTML(k) + '<span class="cat-x" title="Copies in the deck">×' + FOF.copies(k) + '</span></div>'; }).join('') + '</div>');
    }
    el.innerHTML = h.join('');
  }

  /* ---------- jeu local ---------- */
  function initRows() {
    var ls = shuffled(); rows = [];
    for (var i = 0; i < 6; i++) rows.push({ name: DEFAULT_NAMES[i], color: FOF.PLAYER_COLORS[i].id, leader: ls[i] });
  }
  function renderLocal() {
    $('countPick').innerHTML = '<span class="muted" style="margin-right:6px">Players</span>' + [3, 4, 5, 6].map(function (n) { return '<button type="button" aria-pressed="' + (n === count) + '" data-count="' + n + '">' + n + '</button>'; }).join('') + '<button type="button" class="allbots" data-allbots="1" title="You against the computer">' + FOF.ic('helm', 15) + ' Play against bots</button>';
    $('rows').innerHTML = rows.slice(0, count).map(function (r, i) {
      var hex = colorHex(r.color);
      return '<div class="prow" style="border-left:4px solid ' + hex + '"><button type="button" class="swatch" data-swatch="' + i + '" style="background:' + hex + '" aria-label="Change color"></button>' +
        '<div class="pname-box"><input id="pname' + i + '" data-name="' + i + '" value="' + esc(r.name) + '" maxlength="16" aria-label="Name of player ' + (i + 1) + '">' +
        '<button type="button" class="btn small bot-toggle' + (r.bot ? ' on' : '') + '" data-bot="' + i + '" aria-pressed="' + !!r.bot + '" title="Human or computer player">' + (r.bot ? FOF.ic('helm', 14) + ' Computer' : FOF.ic('person', 14) + ' Human') + '</button></div>' +
        FOF.heroHTML(r.leader, { button: true, attrs: 'type="button" data-pickhero="' + i + '" title="Change leader"', note: TRIAL.indexOf(r.leader) >= 0 ? 'trial · change ▾' : 'change ▾' }) + '</div>';
    }).join('');
    $('mapPick').innerHTML = mapPickHTML(carte, true);
    $('winInfo').textContent = winText(count, carte);
    var tw = document.getElementById('tutoOpt');
    if (tw) tw.innerHTML = '<label class="tuto-check"><input type="checkbox" id="tutoChk"' + (tutoWanted ? ' checked' : '') + '> ' + FOF.ic('book', 15) + ' Tutorial (3 rounds, you can stop it anytime)</label>';
  }

  /* ---------- salon en ligne ---------- */
  // L'hôte et les bots comptent toujours comme prêts : l'hôte se déclare en lançant la partie.
  function seatReady(s, row) { return !!(s.bot || s.cid === row.host_id || s.ready); }
  function renderLobby() {
    if (!room || !room.row) return;
    var row = room.row, me = room.seatIndex(), n = row.seats.length, host = room.isHost();
    var nRdy = row.seats.filter(function (s) { return seatReady(s, row); }).length, allRdy = nRdy === n;
    var link = location.origin + location.pathname + '?salon=' + row.code;
    var h = ['<div class="lobby-head"><div><div class="section-title">Room code</div><div class="big-code" id="roomCode">' + row.code + '</div></div>' +
      '<div class="share"><p>Give this code to the other players (“Join a game” button), or send them the link:</p><div class="linkbox"><input readonly value="' + esc(link) + '" id="roomLink"><button class="btn small" type="button" data-copy="1">Copy link</button></div></div></div>'];
    h.push('<div class="seats">');
    row.seats.forEach(function (s, i) {
      var mine = i === me, hex = colorHex(s.color);
      var rdy = seatReady(s, row);
      var badge = '<span class="rdy' + (rdy ? ' on' : '') + '">' + FOF.ic(rdy ? 'check' : 'hourglass', 13) + ' ' + (rdy ? 'ready' : 'not ready') + '</span>';
      if (mine && !host) badge = '<button type="button" class="rdy btn-rdy' + (rdy ? ' on' : '') + '" data-oready="' + (rdy ? '0' : '1') + '">' + FOF.ic(rdy ? 'check' : 'hourglass', 13) + ' ' + (rdy ? 'ready' : 'I’m ready') + '</button>';
      h.push('<div class="prow seat' + (mine ? ' mine' : '') + '" style="border-left:4px solid ' + hex + '">' +
        (mine ? '<button type="button" class="swatch" data-oswatch="1" style="background:' + hex + '" aria-label="Change color"></button>' : '<span class="swatch" style="background:' + hex + '"></span>') +
        (mine ? '<input id="seatName" value="' + esc(s.name) + '" maxlength="16" aria-label="Your name">' : '<div class="seat-name"><b>' + esc(s.name) + '</b>' + (s.cid === row.host_id ? '<small>host</small>' : s.bot ? '<small>' + FOF.ic('helm', 12) + ' computer' + (host ? ' · <button type="button" class="linkbtn" data-rmbot="' + esc(s.cid) + '">remove</button>' : '') + '</small>' : '') + '</div>') +
        badge +
        (mine ? FOF.heroHTML(s.leader, { button: true, attrs: 'type="button" data-opick="1" title="Change leader"', note: 'you · change ▾' }) : FOF.heroHTML(s.leader, { note: 'player ' + (i + 1) })) + '</div>');
    });
    for (var k = n; k < 6; k++) h.push('<div class="prow seat empty"><span class="swatch"></span><div class="seat-name muted">Open seat' + (k < 3 ? ' · 3 players minimum' : '') + '</div></div>');
    var cs = carteDuSalon(row);
    h.push('</div><div class="map-pick">' + mapPickHTML(cs, host) + (host ? '' : '<small class="muted mp-note">picked by the host</small>') + '</div>');
    h.push('<p class="note">' + winText(Math.max(3, n), cs) + '</p><div class="setup-actions">');
    if (host && n < 6) h.push('<button class="btn" type="button" data-addbot="1">' + FOF.ic('helm', 15) + ' Add a bot</button>');
    if (host) {
      var lock = n < 3 || !allRdy;
      var lbl = n < 3 ? 'Waiting for players (' + n + '/3 minimum)'
        : !allRdy ? 'Waiting for players to be ready (' + nRdy + '/' + n + ')'
        : 'Start the game with ' + n + ' players';
      h.push('<button class="btn primary" type="button" data-ostart="1" ' + (lock ? 'disabled' : '') + '>' + lbl + '</button>');
    } else h.push('<span class="waiting">' + (allRdy ? 'Everyone’s ready - waiting for the host to start…' : 'Click ready once you’re all set (' + nRdy + '/' + n + ' ready).') + '</span>');
    h.push('<button class="btn" type="button" data-oleave="1">Leave room</button></div>');
    $('lobby').innerHTML = h.join('');
  }
  function enterRoom(r) {
    room = r; FOF.saveOnline(r.code, r.cid);
    try { history.replaceState(null, '', location.pathname + '?salon=' + r.code); } catch (e) {}
    r.on(onRoom); r.start(1500);
    onRoom(r.row);
  }
  function onRoom(row) {
    if (!room) return;
    if (room.seatIndex() < 0) { var c = room.code; leaveLocal(); setErr('You left room ' + c + '.'); return; }
    if (row.status !== 'lobby' && row.state) {
      var r = room; room = null; r.listeners = []; r.stop();
      picking = null; renderPicker();
      FOF.startUI(row.state, r); return;
    }
    if (step !== 'lobby') show('lobby'); else if (!document.activeElement || document.activeElement.id !== 'seatName') renderLobby();
    // v1.9.25 - la fenêtre de déblocage (e-mail) reste ouverte quand un autre joueur change de dirigeant
    if (picking && picking.online && !picking.unlock) renderPicker();
  }
  function leaveLocal() { if (room) { room.stop(); room.listeners = []; } room = null; FOF.clearOnline(); try { history.replaceState(null, '', location.pathname); } catch (e) {} show('mode'); }
  function mySeatUpdate(fn) {
    if (!room) return;
    room.mutate(function (row) {
      var i = -1; row.seats.forEach(function (s, k) { if (s.cid === room.cid) i = k; });
      if (i < 0 || row.status !== 'lobby') return null;
      if (fn(row.seats[i], row) === false) return null;
      return { seats: row.seats };
    }).catch(function (e) { setErr(e.message); });
  }

  /* ---------- galerie des dirigeants ---------- */
  function renderPicker() {
    var el = $('heroPick');
    if (!picking) { el.hidden = true; el.innerHTML = ''; return; }
    var who, owner = {}, myKey, online = picking.online;
    if (online) {
      if (!room || !room.row) { picking = null; return renderPicker(); }
      var seats = room.row.seats, me = room.seatIndex();
      seats.forEach(function (x, i) { owner[x.leader] = i; });
      who = seats[me]; myKey = who.leader;
    } else {
      rows.slice(0, count).forEach(function (x, i) { owner[x.leader] = i; });
      who = rows[picking.idx]; myKey = who.leader;
    }
    el.hidden = false;
    el.innerHTML = '<div class="modal-bg"><div class="modal wide"><h2>Choose a leader for <span style="color:' + colorHex(who.color) + '">' + esc(who.name || 'this player') + '</span></h2>' +
      '<p class="muted">Each card shows the leader’s combat modifier (star), movement (arrow) and power.' + (online ? ' A leader already picked by another player isn’t available.' : ' A leader who’s already taken can be swapped: click it to trade.') + '</p>' +
      '<div class="gallery">' + LEAD_KEYS.map(function (k) {
        var o = owner[k], mine = k === myKey, taken = o !== undefined && !mine;
        var name = taken ? (online ? room.row.seats[o].name : rows[o].name) : '';
        var lock = isLocked(k);
        var note = lock ? 'locked' : mine ? 'current' : taken ? 'taken by ' + name + (online ? '' : ' · swap') : TRIAL.indexOf(k) >= 0 ? 'trial' : '';
        return FOF.heroHTML(k, { button: true, cls: (lock ? 'locked ' : '') + (mine ? 'chosen' : taken ? 'taken' : ''), attrs: 'type="button" data-hero="' + k + '"' + (online && taken ? ' disabled' : ''), note: note });
      }).join('') + '</div><div class="actions"><button class="btn" type="button" data-closepick="1">Close</button></div></div></div>';
  }


  /* ---------- déblocage des deux dirigeants ---------- */
  function showUnlock(k) {
    var el = $('heroPick'); if (!el) return;
    if (picking) picking.unlock = k;
    var nom = FOF.LEADERS[k] ? FOF.LEADERS[k].name : 'this leader';
    el.hidden = false;
    el.innerHTML = '<div class="modal-bg"><div class="modal" style="max-width:520px">' +
      '<h2>Unlock ' + esc(nom) + '</h2>' +
      '<p class="muted">' + nomsVerrou() + ' unlock together, for good, on this browser.</p>' +
      '<label class="fld"><span>Your email address</span>' +
      '<input id="unlockMail" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com" maxlength="120"></label>' +
      '<label class="chk"><input id="unlockOk" type="checkbox"> <span>I agree to be contacted by Nube Games about how Fields of Fire is coming along (game tips, leader and card stats, new versions). Unsubscribe anytime.</span></label>' +
      '<p class="muted" style="font-size:12px">Your address is only used for that. It’s stored with Supabase, our database host (Europe), and never shared with anyone else. Unsubscribe anytime through the contact form.</p>' +
      '<p id="unlockErr" class="err" role="alert"></p>' +
      '<div class="actions"><button class="btn" type="button" data-unlockclose="1">Later</button>' +
      '<button class="btn primary" type="button" data-unlockgo="1">Unlock</button></div></div></div>';
    var f = $('unlockMail'); if (f) f.focus();
  }
  function doUnlock() {
    var mail = (($('unlockMail') || {}).value || '').trim();
    var okBox = $('unlockOk'), err = $('unlockErr'), btn = document.querySelector('[data-unlockgo]');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) { err.textContent = 'Please enter a valid email address.'; return; }
    if (!okBox || !okBox.checked) { err.textContent = 'Check the box to agree to be contacted.'; return; }
    err.textContent = ''; if (btn) btn.disabled = true;
    var row = { message: 'Unlocking leaders', contact: mail.slice(0, 120),
      context: { source: 'unlock-heroes', consent: true, version: FOF.CONFIG.version, url: location.href } };
    function fini() {
      try { localStorage.setItem('fof-heroes', '1'); } catch (e) {}
      $('heroPick').innerHTML = '<div class="modal-bg"><div class="modal" style="max-width:480px;text-align:center">' +
        '<h2>Unlocked!</h2><p>' + nomsVerrou() +
        ' are now playable. Thanks - we’ll keep you posted.</p>' +
        '<div class="actions" style="justify-content:center"><button class="btn primary" type="button" data-unlockdone="1">Choose my leader</button></div></div></div>';
    }
    if (!FOF.sbReq || !FOF.CONFIG.supabaseUrl) { fini(); return; }
    // Le repli vers bug_reports ne vaut QUE si la table dédiée n'existe pas encore. Une erreur de
    // droits ou de réseau ne doit pas faire atterrir une adresse e-mail dans la table des bugs :
    // ce sont deux traitements différents, et l'utilisateur n'a pas consenti à ça.
    function tableAbsente(e) {
      var m = (e && e.message ? e.message : '') + '';
      return /PGRST205|PGRST20[0-9]|does not exist|n.existe pas|Not Found|404/i.test(m);
    }
    FOF.sbReq('POST', 'newsletter_signups', { email: mail.slice(0, 120), consent: true, source: 'unlock-heroes' }, 'return=minimal')
      .then(fini, function (e1) {
        if (!tableAbsente(e1)) { err.textContent = 'Couldn’t send: ' + e1.message; if (btn) btn.disabled = false; return; }
        FOF.sbReq('POST', 'bug_reports', row, 'return=minimal').then(fini, function (e) {
          err.textContent = 'Couldn’t send: ' + e.message; if (btn) btn.disabled = false;
        });
      });
  }
  FOF.showSetup = function () {
    $('setup').hidden = false; $('game').hidden = true; picking = null; renderPicker();
    initRows(); setErr('');
    var q = new URLSearchParams(location.search).get('salon');
    if (q) $('joinCode').value = FOF.normCode(q);
    show('mode');
  };

  document.addEventListener('DOMContentLoaded', function () {
    FOF.bindBar();
    try { $('myName').value = localStorage.getItem('fof-name') || ''; } catch (e) {}
    $('setup').addEventListener('click', function (e) {
      var cb = e.target.closest('[data-cattab],[data-catf]');
      if (cb) { if (cb.dataset.cattab) catTab = cb.dataset.cattab; if (cb.dataset.catf) catFiltre = cb.dataset.catf; return renderCatalog(); }
      var bc = e.target.closest('[data-carte]');
      if (bc && !bc.disabled) {
        var vc = carteValide(bc.dataset.carte);
        if (step === 'lobby') return mySeatUpdate(function (s, row) { if (row.host_id !== room.cid) return false; s.carte = vc; });
        carte = vc; try { localStorage.setItem('fof-carte', carte); } catch (x) {}
        return renderLocal();
      }
      var b = e.target.closest('[data-mode],[data-resume],[data-back],[data-count],[data-swatch],[data-pickhero],[data-copy],[data-oswatch],[data-opick],[data-ostart],[data-oready],[data-oleave],[data-bot],[data-addbot],[data-rmbot],[data-allbots]'); if (!b) return;
      var d = b.dataset; setErr('');
      if (d.mode === 'local') return show('local');
      if (d.mode === 'create' || d.mode === 'join') {
        var nm = myName();
        if (!nm) { setErr('Enter your name first.'); $('myName').focus(); return; }
        var code = FOF.normCode($('joinCode').value);
        if (d.mode === 'join' && code.length !== 5) { setErr('Room codes are 5 characters long.'); $('joinCode').focus(); return; }
        b.disabled = true;
        (d.mode === 'create' ? FOF.createRoom(nm) : FOF.joinRoom(code, nm)).then(enterRoom, function (err) { setErr(err.message); }).then(function () { b.disabled = false; });
        return;
      }
      if (d.resume === 'local') { var s = FOF.loadSaved(); if (s) FOF.startUI(s); return; }
      if (d.resume === 'online') {
        var so = FOF.loadOnline(); if (!so) return;
        FOF.resumeRoom(so.code, so.cid).then(enterRoom, function (err) { FOF.clearOnline(); setErr(err.message); renderMode(); });
        return;
      }
      if (d.bot !== undefined) { var rb = rows[+d.bot]; rb.bot = !rb.bot; if (rb.bot && (/^(Joueur|Player|Eudes|Félicie|Bot )/.test(rb.name) || DEFAULT_NAMES.indexOf(rb.name) >= 0)) rb.name = 'Bot ' + FOF.LEADERS[rb.leader].name.split(' ')[0]; return renderLocal(); }
      if (d.allbots) { rows.slice(1, count).forEach(function (r) { r.bot = true; r.name = 'Bot ' + FOF.LEADERS[r.leader].name.split(' ')[0]; }); return renderLocal(); }
      if (d.addbot) {
        return room.mutate(function (row) {
          if (row.status !== 'lobby' || row.seats.length >= 6 || row.host_id !== room.cid) return null;
          var usedC = row.seats.map(function (s) { return s.color; }), usedL = row.seats.map(function (s) { return s.leader; });
          var col = FOF.PLAYER_COLORS.filter(function (c) { return usedC.indexOf(c.id) < 0; })[0].id, ld = FOF.randomHumanLeader(usedL);
          row.seats.push({ cid: 'bot-' + Math.random().toString(36).slice(2, 8), name: 'Bot ' + FOF.LEADERS[ld].name.split(' ')[0], color: col, leader: ld, bot: true });
          return { seats: row.seats };
        }).catch(function (err) { setErr(err.message); });
      }
      if (d.rmbot) {
        var rid = d.rmbot;
        return room.mutate(function (row) { if (row.status !== 'lobby' || row.host_id !== room.cid) return null; return { seats: row.seats.filter(function (s) { return s.cid !== rid; }) }; }).catch(function (err) { setErr(err.message); });
      }
      if (d.back) return show('mode');
      if (d.count) { count = +d.count; return renderLocal(); }
      if (d.pickhero !== undefined) { picking = { idx: +d.pickhero }; return renderPicker(); }
      if (d.swatch !== undefined) {
        var i = +d.swatch, taken = rows.slice(0, count).map(function (r) { return r.color; });
        var idx = FOF.PLAYER_COLORS.map(function (c) { return c.id; }).indexOf(rows[i].color);
        for (var k = 1; k <= 6; k++) { var c = FOF.PLAYER_COLORS[(idx + k) % 6].id; if (taken.indexOf(c) < 0) { rows[i].color = c; break; } }
        return renderLocal();
      }
      if (d.copy) { var inp = $('roomLink'); inp.select(); try { navigator.clipboard.writeText(inp.value); } catch (x) { document.execCommand('copy'); } b.textContent = 'Link copied ✓'; return; }
      if (d.oswatch) return mySeatUpdate(function (s, row) {
        var taken = row.seats.map(function (x) { return x.color; }), ids = FOF.PLAYER_COLORS.map(function (c) { return c.id; }), idx = ids.indexOf(s.color);
        for (var k = 1; k <= 6; k++) { var c = ids[(idx + k) % 6]; if (taken.indexOf(c) < 0) { s.color = c; return; } }
        return false;
      });
      if (d.opick) { picking = { online: true }; return renderPicker(); }
      if (d.oready !== undefined) { var want = d.oready === '1'; return mySeatUpdate(function (s) { s.ready = want; }); }
      if (d.ostart) {
        b.disabled = true;
        var nPrev = room.row ? room.row.seats.length : 0, cSalon = room.row ? carteDuSalon(room.row) : 'proc';
        if (cSalon === 'proc') ecranGeneration(true);
        // La carte est préparée AVANT l'écriture du salon. Si le nombre de joueurs a changé entre-temps
        // (départ de dernière seconde), newGame la refait elle-même, de façon synchrone.
        FOF.prepareMap(nPrev, function (pg) {
          room.mutate(function (row) {
            if (row.status !== 'lobby' || row.seats.length < 3) return null;
            if (!row.seats.every(function (s) { return seatReady(s, row); })) return null;
            var st = FOF.newGame({ pregen: pg, players: row.seats.map(function (s, i) { return { name: s.name || 'Player ' + (i + 1), color: s.color, leader: s.leader, bot: !!s.bot }; }) });
            FOF.statsInit(st, 'online', row.code);
            FOF.statsTick(st);
            return { status: 'playing', state: st };
          }).then(function () { ecranGeneration(false); }, function (err) { ecranGeneration(false); setErr(err.message); b.disabled = false; });
        }, function (err) { ecranGeneration(false); setErr(err.message); b.disabled = false; }, cSalon);
        return;
      }
      if (d.oleave) {
        var r = room;
        r.mutate(function (row) {
          var seats = row.seats.filter(function (s) { return s.cid !== r.cid; });
          if (row.status !== 'lobby') return null;
          var patch = { seats: seats };
          if (row.host_id === r.cid) { patch.host_id = seats.length ? seats[0].cid : r.cid; if (!seats.length) patch.status = 'closed'; }
          return patch;
        }).catch(function () {}).then(function () { leaveLocal(); });
      }
    });
    $('setup').addEventListener('change', function (e) {
      if (e.target.id === 'seatName') { var v = e.target.value.trim().slice(0, 16); if (v) { try { localStorage.setItem('fof-name', v); } catch (x) {} mySeatUpdate(function (s) { s.name = v; }); } }
    });
    $('setup').addEventListener('keydown', function (e) { if (e.target.id === 'seatName' && e.key === 'Enter') e.target.blur(); if (e.target.id === 'joinCode' && e.key === 'Enter') $('joinBtn').click(); });
    $('heroPick').addEventListener('click', function (e) {
      if (e.target.closest('[data-unlockgo]')) return doUnlock();
      if (e.target.closest('[data-unlockclose]') || e.target.closest('[data-unlockdone]')) { if (picking) delete picking.unlock; return renderPicker(); }
      if (e.target.classList.contains('modal-bg') || e.target.closest('[data-closepick]')) { picking = null; return renderPicker(); }
      if (picking && picking.unlock) return;   // clics dans la fenêtre de déblocage
      var b = e.target.closest('[data-hero]'); if (!b || b.disabled) return;
      var k = b.dataset.hero;
      if (isLocked(k)) return showUnlock(k);
      if (picking.online) {
        picking = null; renderPicker();
        return mySeatUpdate(function (s, row) { if (row.seats.some(function (x) { return x.leader === k && x.cid !== room.cid; })) return false; s.leader = k; });
      }
      var other = -1;
      rows.forEach(function (x, i) { if (x.leader === k && i !== picking.idx) other = i; });
      if (other >= 0) rows[other].leader = rows[picking.idx].leader;
      rows[picking.idx].leader = k; picking = null; renderPicker(); renderLocal();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && picking) { picking = null; renderPicker(); } });
    $('setup').addEventListener('input', function (e) { if (e.target.dataset.name !== undefined) rows[+e.target.dataset.name].name = e.target.value; if (e.target.id === 'joinCode') e.target.value = FOF.normCode(e.target.value); });
    $('shuffleBtn').addEventListener('click', function () {
      var ls = shuffled();
      rows.forEach(function (r, i) { r.leader = ls[i]; }); renderLocal();
    });
    $('startBtn').addEventListener('click', function () {
      var players = rows.slice(0, count).map(function (r, i) { return { name: (r.name || 'Player ' + (i + 1)).trim(), color: r.color, leader: r.leader, bot: !!r.bot }; });
      var chk = document.getElementById('tutoChk');
      tutoWanted = chk ? chk.checked : tutoWanted;
      try { localStorage.setItem('fof-tuto', tutoWanted ? '1' : '0'); localStorage.removeItem('fof-widesea'); } catch (e) {}
      var btn = $('startBtn'); if (btn.disabled) return;
      btn.disabled = true; if (carte === 'proc') ecranGeneration(true);
      FOF.prepareMap(players.length, function (pg) {
        ecranGeneration(false); btn.disabled = false;
        FOF.startUI(FOF.newGame({ players: players, pregen: pg }));
        if (tutoWanted && FOF.tutorialStart) FOF.tutorialStart();
      }, function (err) {
        ecranGeneration(false); btn.disabled = false;
        $('winInfo').textContent = 'The map couldn’t be generated (' + err.message + '). Please restart the game.';
      }, carte);
    });
    FOF.showSetup();
    // reprise automatique seulement dans l'onglet qui était déjà assis dans ce salon (après un rechargement)
    var q = new URLSearchParams(location.search).get('salon'), so = FOF.loadOnline(), mine = null;
    try { mine = sessionStorage.getItem('fof-cid'); } catch (e) {}
    if (q && so && so.code === FOF.normCode(q) && so.cid === mine && FOF.onlineEnabled()) FOF.resumeRoom(so.code, so.cid).then(enterRoom, function () {});
  });
})(window.FOF = window.FOF || {});
