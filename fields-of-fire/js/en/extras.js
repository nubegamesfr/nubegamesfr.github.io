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
    var b = $('animBtn'); if (b) { b.setAttribute('aria-pressed', String(FOF.animOn)); b.title = FOF.animOn ? 'Turn off animations' : 'Turn on animations'; b.classList.toggle('off', !FOF.animOn); }
  }

  /* ---------- signaler un bug ---------- */
  function openBug() {
    var el = $('bugModal');
    el.innerHTML = '<div class="modal-bg"><div class="modal"><h2>' + FOF.ic('bug', 20) + ' Report a Bug</h2>'+'<p class="muted">Tell us what happened and what you expected. The game state is attached automatically to help us reproduce the problem.</p>' +
      '<textarea id="bugText" rows="6" maxlength="3000" placeholder="E.g. I bought a unit but couldn’t deploy it anywhere…"></textarea>' +
      '<input id="bugContact" maxlength="120" placeholder="Your name or contact (optional)">' +
      '<p class="err" id="bugErr"></p><div class="actions"><button class="btn" data-bugclose="1">Cancel</button><button class="btn primary" data-bugsend="1">Send</button></div></div></div>';
    el.hidden = false; setTimeout(function () { var t = $('bugText'); if (t) t.focus(); }, 50);
  }
  function sendBug(btn) {
    var msg = ($('bugText').value || '').trim(); if (msg.length < 5) { $('bugErr').textContent = 'Describe the problem in a few words.'; return; }
    var st = FOF.currentState && FOF.currentState(), net = FOF.currentNet && FOF.currentNet();
    var ctx = { version: FOF.CONFIG.version, url: location.href, ua: navigator.userAgent, screen: innerWidth + 'x' + innerHeight,
      mode: net ? 'online' : st ? 'local' : 'accueil', room: net ? net.code : null,
      phase: st ? st.phase : null, round: st ? st.round : null, turn: st ? st.turnNo : null, cur: st ? st.cur : null };
    var row = { message: msg, contact: ($('bugContact').value || '').trim().slice(0, 120) || null, context: ctx, state: st || null };
    btn.disabled = true;
    if (!FOF.sbReq || !FOF.CONFIG.supabaseUrl) { $('bugErr').textContent = 'Couldn’t send (server not set up).'; btn.disabled = false; return; }
    FOF.sbReq('POST', 'bug_reports', row, 'return=minimal').then(function () {
      $('bugModal').innerHTML = '<div class="modal-bg"><div class="modal" style="text-align:center"><h2>Thank you!</h2><p>Your report has been sent.</p><div class="actions" style="justify-content:center"><button class="btn primary" data-bugclose="1">Close</button></div></div></div>';
    }, function (e) { $('bugErr').textContent = 'Couldn’t send: ' + e.message; btn.disabled = false; });
  }

  /* ---------- tchat (parties en ligne) ---------- */
  var chat = { open: false, last: 0, code: null, timer: null, unread: 0, msgs: [] };
  function chatRoom() { var net = FOF.currentNet && FOF.currentNet(); return net ? net : null; }
  function chatTick() {
    var net = chatRoom();
    $('chatBtn').hidden = !net;
    if (!net) { $('chatPanel').hidden = true; if (chat.code) { chat.code = null; chat.msgs = []; chat.last = 0; } return; }
    if (chat.code !== net.code) { chat.code = net.code; chat.msgs = []; chat.last = 0; chat.unread = 0; renderChat(); }
    FOF.chatList(net, chat.last).then(function (rows) {
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
    list.innerHTML = chat.msgs.map(function (m) { return '<div class="cmsg"><b style="color:' + hex(m.color) + '">' + esc(m.name) + '</b> ' + esc(m.msg) + '</div>'; }).join('') || '<div class="muted">No messages yet. Say hi!</div>';
    list.scrollTop = list.scrollHeight;
  }
  function sendChat() {
    var net = chatRoom(), inp = $('chatInput'); if (!net || !inp) return;
    var msg = inp.value.trim().slice(0, 300); if (!msg) return;
    inp.value = '';
    FOF.chatSend(net, msg).then(chatTick, function (e) { inp.value = msg; alertLine('Message not sent: ' + e.message); });
  }
  function alertLine(t) { var l = $('chatList'); if (l) { l.insertAdjacentHTML('beforeend', '<div class="err">' + esc(t) + '</div>'); l.scrollTop = l.scrollHeight; } }

  document.addEventListener('DOMContentLoaded', function () {
    applyAnim();
    document.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('#animBtn,#bugBtn,#bugBtn2,#chatBtn,[data-bugclose],[data-bugsend],[data-chatsend],[data-chatclose]'); if (!t) return;
      if (t.id === 'animBtn') { FOF.animOn = !FOF.animOn; try { localStorage.setItem('fof-anim', FOF.animOn ? '1' : '0'); } catch (x) {} applyAnim(); if (FOF.rerender) FOF.rerender(); }
      if (t.id === 'bugBtn' || t.id === 'bugBtn2') openBug();   // v1.9.28 : bugBtn2 n'a plus d'onclick (CSP)
      if (t.dataset.bugclose) { $('bugModal').hidden = true; $('bugModal').innerHTML = ''; }
      if (t.dataset.bugsend) sendBug(t);
      if (t.id === 'chatBtn') { chat.open = !$('chatPanel').hidden ? false : true; $('chatPanel').hidden = !chat.open; if (chat.open) { chat.unread = 0; renderChat(); setTimeout(function () { $('chatInput').focus(); }, 30); } else renderChat(); }
      if (t.dataset.chatclose) { chat.open = false; $('chatPanel').hidden = true; }
      if (t.dataset.chatsend) sendChat();
    });
    document.addEventListener('keydown', function (e) { if (e.target.id === 'chatInput' && e.key === 'Enter') { e.preventDefault(); sendChat(); } if (e.key === 'Escape' && !$('bugModal').hidden) { $('bugModal').hidden = true; } });
    chat.timer = setInterval(chatTick, 2500);
  });

  /* ---------- v1.9.15 - habillage : « Encre et braise » par défaut, « Feutre et or » au choix ---------- */
  var HABILLAGES = { braise: 'Ink and Ember', feutre: 'Felt and Gold' };
  function habillage() { var t = document.documentElement.dataset.theme; return HABILLAGES[t] ? t : 'braise'; }
  function majBoutonsHabillage() {
    var cur = habillage(), next = cur === 'braise' ? 'feutre' : 'braise';
    document.querySelectorAll('[data-theme-toggle]').forEach(function (b) {
      b.title = 'Theme: ' + HABILLAGES[cur] + ' (click for ' + HABILLAGES[next] + ')';
      b.innerHTML = FOF.ic('theme', 16) + (b.classList.contains('setup-theme') ? ' <span>' + HABILLAGES[cur] + '</span>' : '');
      b.setAttribute('aria-label', b.title);
    });
  }
  FOF.setTheme = function (t) {
    if (!HABILLAGES[t]) t = 'braise';
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('fof-theme', t); } catch (e) {}
    majBoutonsHabillage();
    if (FOF.rerender) FOF.rerender();
  };
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-theme-toggle]'); if (!b) return;
    FOF.setTheme(habillage() === 'braise' ? 'feutre' : 'braise');
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', majBoutonsHabillage); else majBoutonsHabillage();
})(window.FOF = window.FOF || {});
