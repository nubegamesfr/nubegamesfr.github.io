/* Fields of Fire — jeu en ligne : salons (code), synchronisation de l'état par Supabase (REST + sondage) */
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
        return r.text().then(function (t) { var j = t ? JSON.parse(t) : null; if (!r.ok) { var e = new Error((j && j.message) || ('Erreur serveur ' + r.status)); e.status = r.status; e.code = j && j.code; throw e; } return j; });
      });
  }
  FOF.sbReq = req;

  // identifiant de ce joueur (par onglet, pour pouvoir tester à plusieurs onglets)
  FOF.clientId = function () {
    var k = 'fof-cid', v = null;
    try { v = sessionStorage.getItem(k); } catch (e) {}
    if (!v) { v = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); try { sessionStorage.setItem(k, v); } catch (e) {} }
    return v;
  };
  function newCode() { var s = ''; for (var i = 0; i < 5; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)]; return s; }
  FOF.normCode = function (c) { return String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5); };

  /* ---------- Salon ---------- */
  function Room(code, cid) { this.code = code; this.cid = cid; this.row = null; this.timer = null; this.listeners = []; this.busy = false; }
  Room.prototype.seatIndex = function () { var s = this.row ? this.row.seats : []; for (var i = 0; i < s.length; i++) if (s[i].cid === this.cid) return i; return -1; };
  Room.prototype.isHost = function () { return this.row && this.row.host_id === this.cid; };
  Room.prototype.on = function (fn) { this.listeners.push(fn); };
  Room.prototype.emit = function () { var self = this; this.listeners.forEach(function (f) { f(self.row); }); };
  Room.prototype.fetch = function () {
    var self = this;
    return req('GET', 'rooms?code=eq.' + this.code + '&select=*').then(function (rows) {
      if (!rows || !rows.length) throw new Error('Salon introuvable : ' + self.code);
      self.row = rows[0]; return self.row;
    });
  };
  Room.prototype.poll = function () {
    var self = this;
    if (this.busy) return Promise.resolve();
    var v = this.row ? this.row.version : -1;
    return req('GET', 'rooms?code=eq.' + this.code + '&version=gt.' + v + '&select=*').then(function (rows) {
      if (rows && rows.length && (!self.row || rows[0].version > self.row.version)) { self.row = rows[0]; self.emit(); }
    }).catch(function () {});
  };
  Room.prototype.start = function (ms) { var self = this; this.stop(); this.timer = setInterval(function () { self.poll(); }, ms || 1500); };
  Room.prototype.stop = function () { if (this.timer) clearInterval(this.timer); this.timer = null; };
  // écriture optimiste : on n'écrit que si personne n'a modifié le salon entre-temps
  Room.prototype.cas = function (patch) {
    var self = this, v = this.row.version, body = Object.assign({}, patch, { version: v + 1, updated_at: new Date().toISOString() });
    this.busy = true;
    return req('PATCH', 'rooms?code=eq.' + this.code + '&version=eq.' + v, body, 'return=representation').then(function (rows) {
      self.busy = false;
      if (rows && rows.length) { self.row = rows[0]; return true; }
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
        if (tries <= 0) throw new Error('Le salon est trop sollicité, réessayez.');
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
    var cid = FOF.clientId();
    function attempt(n) {
      var code = newCode();
      var row = { code: code, host_id: cid, status: 'lobby', seats: [{ cid: cid, name: name, color: FOF.PLAYER_COLORS[0].id, leader: FOF.randomFreeLeader([]) }], version: 0 };
      return req('POST', 'rooms', row, 'return=representation').then(function (rows) {
        var r = new Room(code, cid); r.row = rows[0]; return r;
      }, function (e) { if (e.status === 409 && n > 0) return attempt(n - 1); throw e; });
    }
    return attempt(5);
  };
  FOF.joinRoom = function (code, name) {
    var r = new Room(FOF.normCode(code), FOF.clientId());
    return r.fetch().then(function (row) {
      if (r.seatIndex() >= 0) return checkStale(r); // déjà assis (reconnexion)
      if (row.status !== 'lobby') throw new Error('La partie a déjà commencé.');
      if (row.seats.length >= 6) throw new Error('Le salon est complet (6 joueurs).');
      return r.mutate(function (row) {
        if (row.status !== 'lobby' || row.seats.length >= 6) return null;
        if (row.seats.some(function (s) { return s.cid === r.cid; })) return null;
        var usedC = row.seats.map(function (s) { return s.color; }), usedL = row.seats.map(function (s) { return s.leader; });
        var col = FOF.PLAYER_COLORS.filter(function (c) { return usedC.indexOf(c.id) < 0; })[0].id;
        row.seats.push({ cid: r.cid, name: name, color: col, leader: FOF.randomFreeLeader(usedL) });
        return { seats: row.seats };
      }).then(function () { if (r.seatIndex() < 0) throw new Error('Impossible de rejoindre ce salon.'); return r; });
    });
  };
  // v1.8 : toutes les parties commencées avant cette date sont retirées (remise à zéro du prototype).
  // Les salons restent dans la base, ils ne sont simplement plus jouables.
  FOF.PURGE_BEFORE = Date.parse('2026-09-23T16:47:30Z');

  // une partie sans action depuis plus de 48 h est close automatiquement
  function checkStale(r) {
    var row = r.row;
    if (row && row.status === 'playing' && row.state && row.state.t0 < FOF.PURGE_BEFORE) {
      FOF.statsAbandon(row.state);
      return r.cas({ status: 'closed' }).catch(function () {}).then(function () {
        throw new Error('Cette partie date d’avant la remise à zéro du 23/09 : elle a été close. Créez un nouveau salon.');
      });
    }
    if (!row || row.status !== 'playing' || !row.state || !FOF.expired(row.state)) return r;
    FOF.statsAbandon(row.state);
    return r.cas({ status: 'closed' }).catch(function () {}).then(function () { throw new Error('Partie abandonnée : plus aucune action depuis 48 heures.'); });
  }
  FOF.resumeRoom = function (code, cid) {
    try { sessionStorage.setItem('fof-cid', cid); } catch (e) {}
    var r = new Room(code, cid);
    return r.fetch().then(function () { if (r.seatIndex() < 0) throw new Error('Vous ne faites plus partie de ce salon.'); return checkStale(r); });
  };
  FOF.randomFreeLeader = function (used) {
    var free = Object.keys(FOF.LEADERS).filter(function (k) { return used.indexOf(k) < 0; });
    return free[Math.floor(Math.random() * free.length)];
  };
  FOF.saveOnline = function (code, cid) { try { localStorage.setItem('fof-online', JSON.stringify({ code: code, cid: cid, at: Date.now() })); } catch (e) {} };
  FOF.loadOnline = function () { try { return JSON.parse(localStorage.getItem('fof-online')); } catch (e) { return null; } };
  FOF.clearOnline = function () { try { localStorage.removeItem('fof-online'); } catch (e) {} };
})(window.FOF = window.FOF || {});
