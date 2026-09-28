/* Fields of Fire - accueil : choix du mode (local / en ligne), salon, choix des dirigeants par fiches */
(function (FOF) {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return FOF.esc(s); };
  var count = 4, rows = [], picking = null, room = null, step = 'mode';
  var tutoWanted = true; try { tutoWanted = localStorage.getItem('fof-tuto') !== '0'; } catch (e) {}
  var DEFAULT_NAMES = ['Aurèle', 'Bérénice', 'Corentin', 'Daphné', 'Élouan', 'Faustine'];
  var LEAD_KEYS = Object.keys(FOF.LEADERS);
  var TRIAL = ['hugues', 'alienor'];
  /* ---------- dirigeants à débloquer ----------
     Hugues et Alinor ne sont pas jouables tant que le joueur n'a pas laissé son adresse e-mail et
     accepté d'être recontacté. Le déblocage est mémorisé dans le navigateur. Les bots peuvent les
     jouer : c'est ce qui donne envie de les débloquer. */
  var LOCKED = FOF.LOCKED_LEADERS;
  function isLocked(k) { return FOF.leaderLocked(k); }
  // Les dirigeants verrouillés sont repoussés en fin de liste : avec 6 sièges au plus pour 8
  // dirigeants, ils ne sont jamais distribués tant qu'ils ne sont pas débloqués - ni au joueur,
  // ni aux autres sièges de la partie locale, qui sont eux aussi des humains.
  function shuffled() {
    var l = LEAD_KEYS.slice().sort(function () { return Math.random() - 0.5; });
    return l.filter(function (k) { return !isLocked(k); }).concat(l.filter(isLocked));
  }
  function colorHex(id) { return FOF.PLAYER_COLORS.filter(function (c) { return c.id === id; })[0].hex; }
  // les seuils étaient figés dans une table et ne suivaient plus l'équilibrage : on les calcule.
  function winText(n) {
    if (!n) return '';
    return 'À ' + n + ' joueurs : ' + (7 * n) + ' territoires sur la carte. Victoire à ' + (8 + n) + ' territoires, '
      + (6 + n) + ' temples ou ' + (6 + n) + ' de diplomatie.';
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
      '<p class="gen-titre">Génération de la carte en cours…</p><p class="gen-etape" id="genEtape">Levée des continents</p></div>';
    document.body.appendChild(el);
    var etapes = ['Levée des continents', 'Tracé des côtes', 'Partage des mers', 'Tracé des frontières'], ie = 0;
    el._t = setInterval(function () { var e = $('genEtape'); if (!e) return; ie = (ie + 1) % etapes.length; e.classList.remove('in'); void e.offsetWidth; e.textContent = etapes[ie]; e.classList.add('in'); }, 900);
  }
  function myName() { var v = ($('myName').value || '').trim().slice(0, 16); try { localStorage.setItem('fof-name', v); } catch (e) {} return v; }

  function show(s) {
    step = s;
    $('stepMode').hidden = s !== 'mode'; $('stepLocal').hidden = s !== 'local'; $('stepLobby').hidden = s !== 'lobby';
    var cat = $('catalog'); if (cat) { cat.hidden = s !== 'mode'; if (s === 'mode') renderCatalog(); }
    if (s === 'mode') renderMode(); if (s === 'local') renderLocal(); if (s === 'lobby') renderLobby();
  }

  /* ---------- choix du mode ---------- */
  function renderMode() {
    var on = FOF.onlineEnabled();
    $('stepMode').classList.toggle('offline', !on);
    $('onlineNote').hidden = on;
    var saved = FOF.loadSaved(), sOn = FOF.loadOnline(), h = [];
    if (saved && !saved.winner) h.push('<button class="btn" type="button" data-resume="local">Reprendre la partie locale (tour ' + saved.round + ', ' + saved.players.length + ' joueurs)</button>');
    if (on && sOn) h.push('<button class="btn" type="button" data-resume="online">Revenir au salon ' + esc(sOn.code) + '</button>');
    $('resumeBox').innerHTML = h.join('');
  }

  /* ---------- catalogue : tous les dirigeants et toutes les cartes du deck (v1.9.12) ---------- */
  var catTab = 'heroes', catFiltre = 'tout';
  function renderCatalog() {
    var el = $('catalog'); if (!el) return;
    var h = ['<div class="cat-head"><h2 id="catTitle">L’arsenal</h2><p>Les dirigeants que l’on peut incarner et les ' + (Object.keys(FOF.ELITES).length + Object.keys(FOF.SPECIALS).length) + ' cartes du deck (' + Object.keys(FOF.ELITES).concat(Object.keys(FOF.SPECIALS)).reduce(function (s, k) { return s + FOF.copies(k); }, 0) + ' exemplaires en tout).</p>' +
      '<div class="cat-tabs" role="tablist">' +
      '<button type="button" role="tab" aria-selected="' + (catTab === 'heroes') + '" class="cat-tab' + (catTab === 'heroes' ? ' on' : '') + '" data-cattab="heroes">Dirigeants <b>' + LEAD_KEYS.length + '</b></button>' +
      '<button type="button" role="tab" aria-selected="' + (catTab === 'cards') + '" class="cat-tab' + (catTab === 'cards' ? ' on' : '') + '" data-cattab="cards">Cartes du deck <b>' + (Object.keys(FOF.ELITES).length + Object.keys(FOF.SPECIALS).length) + '</b></button></div></div>'];
    if (catTab === 'heroes') {
      h.push('<div class="cat-grid heroes">' + LEAD_KEYS.map(function (k) {
        return FOF.heroHTML(k, { note: isLocked(k) ? 'à débloquer' : '' });
      }).join('') + '</div>');
    } else {
      h.push('<div class="cat-filters">' + [['tout', 'Toutes'], ['el', 'Élites'], ['sp', 'Spéciales']].map(function (f) {
        return '<button type="button" class="chip' + (catFiltre === f[0] ? ' on' : '') + '" data-catf="' + f[0] + '">' + f[1] + '</button>';
      }).join('') + '</div>');
      var keys = [];
      if (catFiltre !== 'sp') keys = keys.concat(Object.keys(FOF.ELITES));
      if (catFiltre !== 'el') keys = keys.concat(Object.keys(FOF.SPECIALS));
      h.push('<div class="cat-grid cards">' + keys.map(function (k) { return '<div class="cat-card">' + FOF.cardHTML(k) + '<span class="cat-x" title="Exemplaires dans le deck">×' + FOF.copies(k) + '</span></div>'; }).join('') + '</div>');
    }
    el.innerHTML = h.join('');
  }

  /* ---------- jeu local ---------- */
  function initRows() {
    var ls = shuffled(); rows = [];
    for (var i = 0; i < 6; i++) rows.push({ name: DEFAULT_NAMES[i], color: FOF.PLAYER_COLORS[i].id, leader: ls[i] });
  }
  function renderLocal() {
    $('countPick').innerHTML = '<span class="muted" style="margin-right:6px">Joueurs</span>' + [3, 4, 5, 6].map(function (n) { return '<button type="button" aria-pressed="' + (n === count) + '" data-count="' + n + '">' + n + '</button>'; }).join('') + '<button type="button" class="allbots" data-allbots="1" title="Vous contre l’ordinateur">' + FOF.ic('helm', 15) + ' Jouer contre des bots</button>';
    $('rows').innerHTML = rows.slice(0, count).map(function (r, i) {
      var hex = colorHex(r.color);
      return '<div class="prow" style="border-left:4px solid ' + hex + '"><button type="button" class="swatch" data-swatch="' + i + '" style="background:' + hex + '" aria-label="Changer de couleur"></button>' +
        '<div class="pname-box"><input id="pname' + i + '" data-name="' + i + '" value="' + esc(r.name) + '" maxlength="16" aria-label="Nom du joueur ' + (i + 1) + '">' +
        '<button type="button" class="btn small bot-toggle' + (r.bot ? ' on' : '') + '" data-bot="' + i + '" aria-pressed="' + !!r.bot + '" title="Joueur humain ou ordinateur">' + (r.bot ? FOF.ic('helm', 14) + ' Ordinateur' : FOF.ic('person', 14) + ' Humain') + '</button></div>' +
        FOF.heroHTML(r.leader, { button: true, attrs: 'type="button" data-pickhero="' + i + '" title="Changer de dirigeant"', note: TRIAL.indexOf(r.leader) >= 0 ? 'à l’essai · changer ▾' : 'changer ▾' }) + '</div>';
    }).join('');
    $('winInfo').textContent = winText(count);
    var tw = document.getElementById('tutoOpt');
    if (tw) tw.innerHTML = '<label class="tuto-check"><input type="checkbox" id="tutoChk"' + (tutoWanted ? ' checked' : '') + '> ' + FOF.ic('book', 15) + ' Didacticiel (3 tours, on peut l’arrêter à tout moment)</label>';
  }

  /* ---------- salon en ligne ---------- */
  // L'hôte et les bots comptent toujours comme prêts : l'hôte se déclare en lançant la partie.
  function seatReady(s, row) { return !!(s.bot || s.cid === row.host_id || s.ready); }
  function renderLobby() {
    if (!room || !room.row) return;
    var row = room.row, me = room.seatIndex(), n = row.seats.length, host = room.isHost();
    var nRdy = row.seats.filter(function (s) { return seatReady(s, row); }).length, allRdy = nRdy === n;
    var link = location.origin + location.pathname + '?salon=' + row.code;
    var h = ['<div class="lobby-head"><div><div class="section-title">Code du salon</div><div class="big-code" id="roomCode">' + row.code + '</div></div>' +
      '<div class="share"><p>Donnez ce code aux autres joueurs (bouton « Rejoindre une partie »), ou envoyez-leur le lien :</p><div class="linkbox"><input readonly value="' + esc(link) + '" id="roomLink"><button class="btn small" type="button" data-copy="1">Copier le lien</button></div></div></div>'];
    h.push('<div class="seats">');
    row.seats.forEach(function (s, i) {
      var mine = i === me, hex = colorHex(s.color);
      var rdy = seatReady(s, row);
      var badge = '<span class="rdy' + (rdy ? ' on' : '') + '">' + FOF.ic(rdy ? 'check' : 'hourglass', 13) + ' ' + (rdy ? 'pr\u00eat' : 'pas pr\u00eat') + '</span>';
      if (mine && !host) badge = '<button type="button" class="rdy btn-rdy' + (rdy ? ' on' : '') + '" data-oready="' + (rdy ? '0' : '1') + '">' + FOF.ic(rdy ? 'check' : 'hourglass', 13) + ' ' + (rdy ? 'je suis pr\u00eat' : 'se d\u00e9clarer pr\u00eat') + '</button>';
      h.push('<div class="prow seat' + (mine ? ' mine' : '') + '" style="border-left:4px solid ' + hex + '">' +
        (mine ? '<button type="button" class="swatch" data-oswatch="1" style="background:' + hex + '" aria-label="Changer de couleur"></button>' : '<span class="swatch" style="background:' + hex + '"></span>') +
        (mine ? '<input id="seatName" value="' + esc(s.name) + '" maxlength="16" aria-label="Votre nom">' : '<div class="seat-name"><b>' + esc(s.name) + '</b>' + (s.cid === row.host_id ? '<small>hôte</small>' : s.bot ? '<small>' + FOF.ic('helm', 12) + ' ordinateur' + (host ? ' · <button type="button" class="linkbtn" data-rmbot="' + esc(s.cid) + '">retirer</button>' : '') + '</small>' : '') + '</div>') +
        badge +
        (mine ? FOF.heroHTML(s.leader, { button: true, attrs: 'type="button" data-opick="1" title="Changer de dirigeant"', note: 'vous · changer ▾' }) : FOF.heroHTML(s.leader, { note: 'joueur ' + (i + 1) })) + '</div>');
    });
    for (var k = n; k < 6; k++) h.push('<div class="prow seat empty"><span class="swatch"></span><div class="seat-name muted">Place libre' + (k < 3 ? ' · minimum 3 joueurs' : '') + '</div></div>');
    h.push('</div><p class="note">' + winText(Math.max(3, n)) + '</p><div class="setup-actions">');
    if (host && n < 6) h.push('<button class="btn" type="button" data-addbot="1">' + FOF.ic('helm', 15) + ' Ajouter un bot</button>');
    if (host) {
      var lock = n < 3 || !allRdy;
      var lbl = n < 3 ? 'En attente de joueurs (' + n + '/3 minimum)'
        : !allRdy ? 'En attente des joueurs prêts (' + nRdy + '/' + n + ')'
        : 'Lancer la partie à ' + n + ' joueurs';
      h.push('<button class="btn primary" type="button" data-ostart="1" ' + (lock ? 'disabled' : '') + '>' + lbl + '</button>');
    } else h.push('<span class="waiting">' + (allRdy ? 'Tout le monde est prêt - en attente du lancement par l’hôte…' : 'Déclarez-vous prêt quand vous êtes installé (' + nRdy + '/' + n + ' prêts).') + '</span>');
    h.push('<button class="btn" type="button" data-oleave="1">Quitter le salon</button></div>');
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
    if (room.seatIndex() < 0) { var c = room.code; leaveLocal(); setErr('Vous avez quitté le salon ' + c + '.'); return; }
    if (row.status !== 'lobby' && row.state) {
      var r = room; room = null; r.listeners = []; r.stop();
      picking = null; renderPicker();
      FOF.startUI(row.state, r); return;
    }
    if (step !== 'lobby') show('lobby'); else if (!document.activeElement || document.activeElement.id !== 'seatName') renderLobby();
    if (picking && picking.online) renderPicker();
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
    el.innerHTML = '<div class="modal-bg"><div class="modal wide"><h2>Choisissez le dirigeant de <span style="color:' + colorHex(who.color) + '">' + esc(who.name || 'ce joueur') + '</span></h2>' +
      '<p class="muted">Chaque fiche indique le modificateur de combat du dirigeant (étoile), son déplacement (flèche) et son pouvoir.' + (online ? ' Un dirigeant déjà choisi par un autre joueur n’est pas disponible.' : ' Un dirigeant déjà pris peut être échangé : cliquez dessus pour intervertir.') + '</p>' +
      '<div class="gallery">' + LEAD_KEYS.map(function (k) {
        var o = owner[k], mine = k === myKey, taken = o !== undefined && !mine;
        var name = taken ? (online ? room.row.seats[o].name : rows[o].name) : '';
        var lock = isLocked(k);
        var note = lock ? 'à débloquer' : mine ? 'actuel' : taken ? 'pris par ' + name + (online ? '' : ' · échanger') : TRIAL.indexOf(k) >= 0 ? 'à l’essai' : '';
        return FOF.heroHTML(k, { button: true, cls: (lock ? 'locked ' : '') + (mine ? 'chosen' : taken ? 'taken' : ''), attrs: 'type="button" data-hero="' + k + '"' + (online && taken ? ' disabled' : ''), note: note });
      }).join('') + '</div><div class="actions"><button class="btn" type="button" data-closepick="1">Fermer</button></div></div></div>';
  }


  /* ---------- déblocage des deux dirigeants ---------- */
  function showUnlock(k) {
    var el = $('heroPick'); if (!el) return;
    var nom = FOF.LEADERS[k] ? FOF.LEADERS[k].name : 'ce dirigeant';
    el.hidden = false;
    el.innerHTML = '<div class="modal-bg"><div class="modal" style="max-width:520px">' +
      '<h2>Débloquer ' + esc(nom) + '</h2>' +
      '<p class="muted">' + esc(nom) + ' et ' + esc(FOF.LEADERS[LOCKED[0] === k ? LOCKED[1] : LOCKED[0]].name) +
      ' se débloquent ensemble, définitivement, sur ce navigateur.</p>' +
      '<label class="fld"><span>Votre adresse e-mail</span>' +
      '<input id="unlockMail" type="email" inputmode="email" autocomplete="email" placeholder="vous@exemple.fr" maxlength="120"></label>' +
      '<label class="chk"><input id="unlockOk" type="checkbox"> <span>J’accepte d’être recontacté par Nube Games au sujet de l’avancée de Fields of Fire (conseils de jeu, statistiques des dirigeants et des cartes, nouvelles versions). Désinscription à tout moment.</span></label>' +
      '<p class="muted" style="font-size:12px">Votre adresse ne sert qu’à cela. Elle est conservée chez Supabase, notre hébergeur de base de données (Europe), et n’est transmise à personne d’autre. Désinscription à tout moment par le formulaire de contact.</p>' +
      '<p id="unlockErr" class="err" role="alert"></p>' +
      '<div class="actions"><button class="btn" type="button" data-unlockclose="1">Plus tard</button>' +
      '<button class="btn primary" type="button" data-unlockgo="1">Débloquer</button></div></div></div>';
    var f = $('unlockMail'); if (f) f.focus();
  }
  function doUnlock() {
    var mail = (($('unlockMail') || {}).value || '').trim();
    var okBox = $('unlockOk'), err = $('unlockErr'), btn = document.querySelector('[data-unlockgo]');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) { err.textContent = 'Entrez une adresse e-mail valide.'; return; }
    if (!okBox || !okBox.checked) { err.textContent = 'Cochez la case pour accepter d’être recontacté.'; return; }
    err.textContent = ''; if (btn) btn.disabled = true;
    var row = { message: 'Déblocage des dirigeants', contact: mail.slice(0, 120),
      context: { source: 'unlock-heroes', consent: true, version: FOF.CONFIG.version, url: location.href } };
    function fini() {
      try { localStorage.setItem('fof-heroes', '1'); } catch (e) {}
      $('heroPick').innerHTML = '<div class="modal-bg"><div class="modal" style="max-width:480px;text-align:center">' +
        '<h2>C’est débloqué</h2><p>' + esc(FOF.LEADERS.hugues.name) + ' et ' + esc(FOF.LEADERS.alienor.name) +
        ' sont désormais jouables. Merci, vous serez tenu au courant de la suite.</p>' +
        '<div class="actions" style="justify-content:center"><button class="btn primary" type="button" data-unlockdone="1">Choisir mon dirigeant</button></div></div></div>';
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
        if (!tableAbsente(e1)) { err.textContent = 'Envoi impossible : ' + e1.message; if (btn) btn.disabled = false; return; }
        FOF.sbReq('POST', 'bug_reports', row, 'return=minimal').then(fini, function (e) {
          err.textContent = 'Envoi impossible : ' + e.message; if (btn) btn.disabled = false;
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
      var b = e.target.closest('[data-mode],[data-resume],[data-back],[data-count],[data-swatch],[data-pickhero],[data-copy],[data-oswatch],[data-opick],[data-ostart],[data-oready],[data-oleave],[data-bot],[data-addbot],[data-rmbot],[data-allbots]'); if (!b) return;
      var d = b.dataset; setErr('');
      if (d.mode === 'local') return show('local');
      if (d.mode === 'create' || d.mode === 'join') {
        var nm = myName();
        if (!nm) { setErr('Entrez votre nom d’abord.'); $('myName').focus(); return; }
        var code = FOF.normCode($('joinCode').value);
        if (d.mode === 'join' && code.length !== 5) { setErr('Le code de salon fait 5 caractères.'); $('joinCode').focus(); return; }
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
      if (d.bot !== undefined) { var rb = rows[+d.bot]; rb.bot = !rb.bot; if (rb.bot && /^(Joueur|Aurèle|Bérénice|Corentin|Daphné|Eudes|Félicie)/.test(rb.name)) rb.name = 'Bot ' + FOF.LEADERS[rb.leader].name.split(' ')[0]; return renderLocal(); }
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
      if (d.copy) { var inp = $('roomLink'); inp.select(); try { navigator.clipboard.writeText(inp.value); } catch (x) { document.execCommand('copy'); } b.textContent = 'Lien copié ✓'; return; }
      if (d.oswatch) return mySeatUpdate(function (s, row) {
        var taken = row.seats.map(function (x) { return x.color; }), ids = FOF.PLAYER_COLORS.map(function (c) { return c.id; }), idx = ids.indexOf(s.color);
        for (var k = 1; k <= 6; k++) { var c = ids[(idx + k) % 6]; if (taken.indexOf(c) < 0) { s.color = c; return; } }
        return false;
      });
      if (d.opick) { picking = { online: true }; return renderPicker(); }
      if (d.oready !== undefined) { var want = d.oready === '1'; return mySeatUpdate(function (s) { s.ready = want; }); }
      if (d.ostart) {
        b.disabled = true;
        var nPrev = room.row ? room.row.seats.length : 0;
        ecranGeneration(true);
        // La carte est préparée AVANT l'écriture du salon. Si le nombre de joueurs a changé entre-temps
        // (départ de dernière seconde), newGame la refait elle-même, de façon synchrone.
        FOF.prepareMap(nPrev, function (pg) {
          room.mutate(function (row) {
            if (row.status !== 'lobby' || row.seats.length < 3) return null;
            if (!row.seats.every(function (s) { return seatReady(s, row); })) return null;
            var st = FOF.newGame({ pregen: pg, players: row.seats.map(function (s, i) { return { name: s.name || 'Joueur ' + (i + 1), color: s.color, leader: s.leader, bot: !!s.bot }; }) });
            FOF.statsInit(st, 'online', row.code);
            FOF.statsTick(st);
            return { status: 'playing', state: st };
          }).then(function () { ecranGeneration(false); }, function (err) { ecranGeneration(false); setErr(err.message); b.disabled = false; });
        }, function (err) { ecranGeneration(false); setErr(err.message); b.disabled = false; });
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
      if (e.target.closest('[data-unlockclose]') || e.target.closest('[data-unlockdone]')) return renderPicker();
      if (e.target.classList.contains('modal-bg') || e.target.closest('[data-closepick]')) { picking = null; return renderPicker(); }
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
      var players = rows.slice(0, count).map(function (r, i) { return { name: (r.name || 'Joueur ' + (i + 1)).trim(), color: r.color, leader: r.leader, bot: !!r.bot }; });
      var chk = document.getElementById('tutoChk');
      tutoWanted = chk ? chk.checked : tutoWanted;
      try { localStorage.setItem('fof-tuto', tutoWanted ? '1' : '0'); localStorage.removeItem('fof-widesea'); } catch (e) {}
      var btn = $('startBtn'); if (btn.disabled) return;
      btn.disabled = true; ecranGeneration(true);
      FOF.prepareMap(players.length, function (pg) {
        ecranGeneration(false); btn.disabled = false;
        FOF.startUI(FOF.newGame({ players: players, pregen: pg }));
        if (tutoWanted && FOF.tutorialStart) FOF.tutorialStart();
      }, function (err) {
        ecranGeneration(false); btn.disabled = false;
        $('winInfo').textContent = 'La carte n’a pas pu être générée (' + err.message + '). Relancez la partie.';
      });
    });
    FOF.showSetup();
    // reprise automatique seulement dans l'onglet qui était déjà assis dans ce salon (après un rechargement)
    var q = new URLSearchParams(location.search).get('salon'), so = FOF.loadOnline(), mine = null;
    try { mine = sessionStorage.getItem('fof-cid'); } catch (e) {}
    if (q && so && so.code === FOF.normCode(q) && so.cid === mine && FOF.onlineEnabled()) FOF.resumeRoom(so.code, so.cid).then(enterRoom, function () {});
  });
})(window.FOF = window.FOF || {});
