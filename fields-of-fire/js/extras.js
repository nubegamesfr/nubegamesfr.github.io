/* Fields of Fire - bouton animations, signalement de bug, tchat du mode en ligne */
(function (FOF) {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return FOF.esc(s); };

  /* ---------- animations on/off ---------- */
  FOF.animOn = true;
  try { if (localStorage.getItem('fof-anim') === '0') FOF.animOn = false; } catch (e) {}
  function applyAnim() {
    document.body.classList.toggle('no-anim', !FOF.animOn);
    var b = $('animBtn'); if (b) { b.setAttribute('aria-pressed', String(FOF.animOn)); b.title = FOF.animOn ? 'Désactiver les animations' : 'Activer les animations'; b.classList.toggle('off', !FOF.animOn); }
  }

  /* ---------- signaler un bug ---------- */
  function openBug() {
    var el = $('bugModal');
    el.innerHTML = '<div class="modal-bg"><div class="modal"><h2>' + FOF.ic('bug', 20) + ' Signaler un bug</h2>'+'<p class="muted">Décrivez ce qui s’est passé et ce que vous attendiez. L’état de la partie est joint automatiquement pour nous aider à reproduire le problème.</p>' +
      '<textarea id="bugText" rows="6" maxlength="3000" placeholder="Ex. : j’ai acheté une unité mais je ne pouvais la déployer nulle part…"></textarea>' +
      '<input id="bugContact" maxlength="120" placeholder="Votre nom ou contact (facultatif)">' +
      '<p class="err" id="bugErr"></p><div class="actions"><button class="btn" data-bugclose="1">Annuler</button><button class="btn primary" data-bugsend="1">Envoyer</button></div></div></div>';
    el.hidden = false; setTimeout(function () { var t = $('bugText'); if (t) t.focus(); }, 50);
  }
  function sendBug(btn) {
    var msg = ($('bugText').value || '').trim(); if (msg.length < 5) { $('bugErr').textContent = 'Décrivez le problème en quelques mots.'; return; }
    var st = FOF.currentState && FOF.currentState(), net = FOF.currentNet && FOF.currentNet();
    var ctx = { version: FOF.CONFIG.version, url: location.href, ua: navigator.userAgent, screen: innerWidth + 'x' + innerHeight,
      mode: net ? 'online' : st ? 'local' : 'accueil', room: net ? net.code : null,
      phase: st ? st.phase : null, round: st ? st.round : null, turn: st ? st.turnNo : null, cur: st ? st.cur : null };
    var row = { message: msg, contact: ($('bugContact').value || '').trim().slice(0, 120) || null, context: ctx, state: st || null };
    btn.disabled = true;
    if (!FOF.sbReq || !FOF.CONFIG.supabaseUrl) { $('bugErr').textContent = 'Envoi impossible (serveur non configuré).'; btn.disabled = false; return; }
    FOF.sbReq('POST', 'bug_reports', row, 'return=minimal').then(function () {
      $('bugModal').innerHTML = '<div class="modal-bg"><div class="modal" style="text-align:center"><h2>Merci !</h2><p>Votre signalement a bien été envoyé.</p><div class="actions" style="justify-content:center"><button class="btn primary" data-bugclose="1">Fermer</button></div></div></div>';
    }, function (e) { $('bugErr').textContent = 'Envoi impossible : ' + e.message; btn.disabled = false; });
  }

  /* ---------- tchat (parties en ligne) ---------- */
  var chat = { open: false, last: 0, code: null, timer: null, unread: 0, msgs: [] };
  function chatRoom() { var net = FOF.currentNet && FOF.currentNet(); return net ? net : null; }
  function chatTick() {
    var net = chatRoom();
    $('chatBtn').hidden = !net;
    if (!net) { $('chatPanel').hidden = true; if (chat.code) { chat.code = null; chat.msgs = []; chat.last = 0; } return; }
    if (chat.code !== net.code) { chat.code = net.code; chat.msgs = []; chat.last = 0; chat.unread = 0; renderChat(); }
    FOF.sbReq('GET', 'chat_messages?room_code=eq.' + net.code + '&id=gt.' + chat.last + '&order=id.asc&limit=100&select=id,name,color,msg,cid').then(function (rows) {
      if (!rows || !rows.length) return;
      rows.forEach(function (r) { chat.last = Math.max(chat.last, r.id); chat.msgs.push(r); if (!chat.open && r.cid !== net.cid) chat.unread++; });
      if (chat.msgs.length > 200) chat.msgs = chat.msgs.slice(-200);
      if (rows.some(function (r) { return r.cid !== net.cid; }) && FOF.sfx) FOF.sfx(chat.open ? 'tap' : 'select');
      renderChat();
    }).catch(function () {});
  }
  function hex(id) { var c = (FOF.PLAYER_COLORS || []).filter(function (x) { return x.id === id; })[0]; return c ? c.hex : '#ccc'; }
  function renderChat() {
    var b = $('chatBtn'); if (b) b.innerHTML = FOF.ic('chat', 17) + (chat.unread ? '<span class="badge">' + chat.unread + '</span>' : '');
    var list = $('chatList'); if (!list) return;
    list.innerHTML = chat.msgs.map(function (m) { return '<div class="cmsg"><b style="color:' + hex(m.color) + '">' + esc(m.name) + '</b> ' + esc(m.msg) + '</div>'; }).join('') || '<div class="muted">Aucun message. Dites bonjour !</div>';
    list.scrollTop = list.scrollHeight;
  }
  function sendChat() {
    var net = chatRoom(), inp = $('chatInput'); if (!net || !inp) return;
    var msg = inp.value.trim().slice(0, 300); if (!msg) return;
    var seat = net.row && net.row.seats ? net.row.seats[net.seatIndex()] : null;
    inp.value = '';
    FOF.sbReq('POST', 'chat_messages', { room_code: net.code, cid: net.cid, name: seat ? seat.name : 'Joueur', color: seat ? seat.color : null, msg: msg }, 'return=minimal').then(chatTick, function (e) { inp.value = msg; alertLine('Message non envoyé : ' + e.message); });
  }
  function alertLine(t) { var l = $('chatList'); if (l) { l.insertAdjacentHTML('beforeend', '<div class="err">' + esc(t) + '</div>'); l.scrollTop = l.scrollHeight; } }

  document.addEventListener('DOMContentLoaded', function () {
    applyAnim();
    document.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('#animBtn,#bugBtn,#chatBtn,[data-bugclose],[data-bugsend],[data-chatsend],[data-chatclose]'); if (!t) return;
      if (t.id === 'animBtn') { FOF.animOn = !FOF.animOn; try { localStorage.setItem('fof-anim', FOF.animOn ? '1' : '0'); } catch (x) {} applyAnim(); if (FOF.rerender) FOF.rerender(); }
      if (t.id === 'bugBtn') openBug();
      if (t.dataset.bugclose) { $('bugModal').hidden = true; $('bugModal').innerHTML = ''; }
      if (t.dataset.bugsend) sendBug(t);
      if (t.id === 'chatBtn') { chat.open = !$('chatPanel').hidden ? false : true; $('chatPanel').hidden = !chat.open; if (chat.open) { chat.unread = 0; renderChat(); setTimeout(function () { $('chatInput').focus(); }, 30); } else renderChat(); }
      if (t.dataset.chatclose) { chat.open = false; $('chatPanel').hidden = true; }
      if (t.dataset.chatsend) sendChat();
    });
    document.addEventListener('keydown', function (e) { if (e.target.id === 'chatInput' && e.key === 'Enter') { e.preventDefault(); sendChat(); } if (e.key === 'Escape' && !$('bugModal').hidden) { $('bugModal').hidden = true; } });
    chat.timer = setInterval(chatTick, 2500);
  });
})(window.FOF = window.FOF || {});
