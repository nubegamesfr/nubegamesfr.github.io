/* Fields of Fire - jeu en ligne : salons (code), synchronisation de l'état par Supabase (REST + sondage) */
(function (FOF) {
  'use strict';
  var C = FOF.CONFIG;
  var ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  FOF.onlineEnabled = function () { return !!(C.supabaseUrl && C.supabaseKey); };

  function req(method, path, body, prefer) {
    var h = { apikey: C.supabaseKey, Authorization: 'Bearer ' + C.supabaseKey, 'Content-Type': 'application/json' };
    if (prefer) h.Prefer = prefer;
    return fetch(C.supabaseUrl.replace(/\/$/, '') + '/rest/v1/' + path, { method: method, headers: h, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) {
        if (r.status === 204) return null;
        return r.text().then(function (t) { var j = t ? JSON.parse(t) : null; if (!r.ok) { var e = new Error((j && j.message) || ('Server error ' + r.status)); e.status = r.status; e.code = j && j.code; throw e; } return j; });
      });
  }
  FOF.sbReq = req;
  // v1.9.28 - les salons et le tchat passent par des fonctions serveur (voir securite-1-fonctions.sql)
  function rpc(fn, args) { return req('POST', 'rpc/' + fn, args); }

  /* v1.9.28 - identité de ce joueur (par onglet, pour pouvoir tester à plusieurs onglets).
     Le secret ne quitte l'onglet que vers les fonctions serveur ; les sièges du salon, lisibles par
     tous les joueurs, n'en contiennent que l'empreinte (sha256, 32 caractères), calculée aussi par
     le serveur. Lire un salon ne permet donc plus de jouer à la place de quelqu'un. */
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  function empreinte(sec) {
    if (!window.crypto || !crypto.subtle) return Promise.reject(new Error('This browser can’t play online (insecure connection or outdated browser).'));
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(sec)).then(function (h) { return hex(h).slice(0, 32); });
  }
  FOF.identity = function () {
    var sec = null, cid = null;
    try { sec = sessionStorage.getItem('fof-sec'); cid = sessionStorage.getItem('fof-cid'); } catch (e) {}
    if (sec && cid) return Promise.resolve({ cid: cid, sec: sec });
    var a = new Uint8Array(16); crypto.getRandomValues(a); sec = hex(a);
    return empreinte(sec).then(function (c) {
      try { sessionStorage.setItem('fof-sec', sec); sessionStorage.setItem('fof-cid', c); } catch (e) {}
      return { cid: c, sec: sec };
    });
  };

  /* v1.9.28 - tout ce qui vient du serveur est revu avant affichage : un client modifié pourrait y
     glisser du code HTML (noms, types de bâtiments, journal). Les textes du jeu ne contiennent
     jamais ces caractères ; on les retire donc partout dans l'état et les sièges. */
  var INTERDITS = /[<>"`]/g;
  function nettoie(o) {
    if (typeof o === 'string') return o.replace(INTERDITS, '');
    if (Array.isArray(o)) { for (var i = 0; i < o.length; i++) o[i] = nettoie(o[i]); return o; }
    if (o && typeof o === 'object') { for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) o[k] = nettoie(o[k]); return o; }
    return o;
  }
  FOF.nettoie = nettoie;
  function ligne(rows) { return rows && rows.length ? nettoie(rows[0]) : null; }
  function newCode() { var s = ''; for (var i = 0; i < 5; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)]; return s; }
  FOF.normCode = function (c) { return String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5); };

  /* ---------- Salon ---------- */
  function Room(code, id) { this.code = code; this.cid = id.cid; this.sec = id.sec; this.row = null; this.timer = null; this.listeners = []; this.busy = false; }
  Room.prototype.seatIndex = function () { var s = this.row ? this.row.seats : []; for (var i = 0; i < s.length; i++) if (s[i].cid === this.cid) return i; return -1; };
  Room.prototype.isHost = function () { return this.row && this.row.host_id === this.cid; };
  Room.prototype.on = function (fn) { this.listeners.push(fn); };
  Room.prototype.emit = function () { var self = this; this.listeners.forEach(function (f) { f(self.row); }); };
  Room.prototype.fetch = function () {
    var self = this;
    return rpc('fof_room_get', { p_code: this.code }).then(function (rows) {
      var r = ligne(rows); if (!r) throw new Error('Room not found: ' + self.code);
      self.row = r; return self.row;
    });
  };
  Room.prototype.poll = function () {
    var self = this;
    if (this.busy) return Promise.resolve();
    var v = this.row ? this.row.version : -1;
    return rpc('fof_room_get', { p_code: this.code, p_after: v }).then(function (rows) {
      var r = ligne(rows);
      if (r && (!self.row || r.version > self.row.version)) { self.row = r; self.emit(); }
    }).catch(function () {});
  };
  Room.prototype.start = function (ms) { var self = this; this.stop(); this.timer = setInterval(function () { self.poll(); }, ms || 1500); };
  Room.prototype.stop = function () { if (this.timer) clearInterval(this.timer); this.timer = null; };
  // écriture optimiste : on n'écrit que si personne n'a modifié le salon entre-temps
  Room.prototype.cas = function (patch) {
    var self = this, v = this.row.version;
    this.busy = true;
    return rpc('fof_room_write', { p_code: this.code, p_sec: this.sec, p_version: v, p_patch: patch }).then(function (rows) {
      self.busy = false;
      var r = ligne(rows);
      if (r) { self.row = r; return true; }
      return false;
    }, function (e) { self.busy = false; throw e; });
  };
  // modifier le salon à partir de sa dernière version (réessaie en cas de conflit)
  Room.prototype.mutate = function (fn, tries) {
    var self = this; tries = tries === undefined ? 5 : tries;
    return this.fetch().then(function (row) {
      var patch = fn(JSON.parse(JSON.stringify(row)));
      if (!patch) return false;
      return self.cas(patch).then(function (ok) {
        if (ok) { self.emit(); return true; }
        if (tries <= 0) throw new Error('The room is too busy, please try again.');
        return self.mutate(fn, tries - 1);
      });
    });
  };
  // pousser un nouvel état de partie (seul le joueur dont c'est le tour le fait)
  Room.prototype.pushState = function (state) {
    var self = this;
    return this.cas({ state: state, status: state.winner ? 'ended' : 'playing' }).then(function (ok) {
      if (!ok) return self.fetch().then(function () { self.emit(); return false; });
      return true;
    });
  };

  FOF.createRoom = function (name) {
    return FOF.identity().then(function (id) {
      function attempt(n) {
        var code = newCode();
        var seat = { cid: id.cid, name: name, color: FOF.PLAYER_COLORS[0].id, leader: FOF.randomHumanLeader([]) };
        return rpc('fof_room_create', { p_code: code, p_sec: id.sec, p_seat: seat }).then(function (rows) {
          var r = new Room(code, id); r.row = ligne(rows); return r;
        }, function (e) { if (e.status === 409 && n > 0) return attempt(n - 1); throw e; });
      }
      return attempt(5);
    });
  };
  FOF.joinRoom = function (code, name) {
    return FOF.identity().then(function (id) { return joindre(new Room(FOF.normCode(code), id), name); });
  };
  function joindre(r, name) {
    return r.fetch().then(function (row) {
      if (r.seatIndex() >= 0) return checkStale(r); // déjà assis (reconnexion)
      if (row.status !== 'lobby') throw new Error('The game has already started.');
      if (row.seats.length >= 6) throw new Error('The room is full (6 players).');
      return r.mutate(function (row) {
        if (row.status !== 'lobby' || row.seats.length >= 6) return null;
        if (row.seats.some(function (s) { return s.cid === r.cid; })) return null;
        var usedC = row.seats.map(function (s) { return s.color; }), usedL = row.seats.map(function (s) { return s.leader; });
        var col = FOF.PLAYER_COLORS.filter(function (c) { return usedC.indexOf(c.id) < 0; })[0].id;
        row.seats.push({ cid: r.cid, name: name, color: col, leader: FOF.randomHumanLeader(usedL) });
        return { seats: row.seats };
      }).then(function () { if (r.seatIndex() < 0) throw new Error('Couldn’t join this room.'); return r; });
    });
  }
  // v1.8 : toutes les parties commencées avant cette date sont retirées (remise à zéro du prototype).
  // Les salons restent dans la base, ils ne sont simplement plus jouables.
  FOF.PURGE_BEFORE = Date.parse('2026-09-23T16:47:30Z');

  // une partie sans action depuis plus de 48 h est close automatiquement
  function checkStale(r) {
    var row = r.row;
    if (row && row.status === 'playing' && row.state && row.state.t0 < FOF.PURGE_BEFORE) {
      FOF.statsAbandon(row.state);
      return r.cas({ status: 'closed' }).catch(function () {}).then(function () {
        throw new Error('This game predates the 09/23 reset and has been closed. Please create a new room.');
      });
    }
    if (!row || row.status !== 'playing' || !row.state || !FOF.expired(row.state)) return r;
    FOF.statsAbandon(row.state);
    return r.cas({ status: 'closed' }).catch(function () {}).then(function () { throw new Error('Game abandoned: no moves for 48 hours.'); });
  }
  // sec absent : salon rejoint avec une version antérieure à la 1.9.28 (l'identifiant servait de secret)
  FOF.resumeRoom = function (code, cid, sec) {
    sec = sec || cid;
    try { sessionStorage.setItem('fof-cid', cid); sessionStorage.setItem('fof-sec', sec); } catch (e) {}
    var r = new Room(code, { cid: cid, sec: sec });
    return r.fetch().then(function () { if (r.seatIndex() < 0) throw new Error('You’re no longer in this room.'); return checkStale(r); });
  };
  FOF.randomFreeLeader = function (used) {
    var free = Object.keys(FOF.LEADERS).filter(function (k) { return used.indexOf(k) < 0; });
    return free[Math.floor(Math.random() * free.length)];
  };
  FOF.saveOnline = function (code, cid, sec) { try { localStorage.setItem('fof-online', JSON.stringify({ code: code, cid: cid, sec: sec, at: Date.now() })); } catch (e) {} };
  // tchat (v1.9.28 : fonctions serveur ; le nom et la couleur sont repris du siège par le serveur)
  FOF.chatList = function (r, after) { return rpc('fof_chat_list', { p_code: r.code, p_after: after }).then(function (rows) { return nettoie(rows || []); }); };
  FOF.chatSend = function (r, msg) { return rpc('fof_chat_send', { p_code: r.code, p_sec: r.sec, p_msg: msg }); };
  FOF.loadOnline = function () { try { return JSON.parse(localStorage.getItem('fof-online')); } catch (e) { return null; } };
  FOF.clearOnline = function () { try { localStorage.removeItem('fof-online'); } catch (e) {} };
})(window.FOF = window.FOF || {});
