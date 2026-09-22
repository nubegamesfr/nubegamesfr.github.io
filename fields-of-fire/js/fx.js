/* Fields of Fire — animations (déplacements, phases, or, conquêtes, constructions, cartes) */
(function (FOF) {
  'use strict';
  var prev = null, reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var PH = { collect: ['Collecte', 'coins'], recruit: ['Recrutement', 'cards'], military: ['Phase militaire', 'swords'], build: ['Construction', 'castle'] };

  function snap(st) {
    return {
      seed: st.seed, phase: st.phase, turnNo: st.turnNo, cur: st.cur, winner: !!st.winner,
      ctrl: st.map.terr.map(function (t) { return t.ctrl; }),
      blds: st.map.terr.map(function (t) { return t.blds.map(function (b) { return b.t + b.o; }).join(','); }),
      gold: st.players.map(function (p) { return p.gold; }),
      dip: st.players.map(function (p) { return p.dip; }),
      logN: st.logN || st.log.length,
      combat: st.lastCombat ? JSON.stringify([st.lastCombat.loc, st.lastCombat.att, st.lastCombat.rolls]) : '',
      units: st.units.length
    };
  }
  function tokPos() {
    var m = {};
    document.querySelectorAll('#tokens .tk').forEach(function (g) { m[g.dataset.tk + '|' + g.dataset.own] = [+g.dataset.x, +g.dataset.y]; });
    return m;
  }
  function board() { return document.getElementById('board'); }
  function fxLayer() {
    var el = document.getElementById('fx');
    if (!el) { el = document.createElement('div'); el.id = 'fx'; el.setAttribute('aria-hidden', 'true'); board().appendChild(el); }
    return el;
  }
  function banner(html, col) {
    var el = fxLayer(), b = document.createElement('div');
    b.className = 'fx-banner'; b.innerHTML = html; if (col) b.style.setProperty('--bc', col);
    el.appendChild(b); setTimeout(function () { b.remove(); }, 1900);
  }
  function floatAt(target, text, cls) {
    if (!target) return;
    var r = target.getBoundingClientRect(), f = document.createElement('div');
    f.className = 'fx-float ' + (cls || ''); f.textContent = text;
    f.style.left = (r.left + r.width / 2) + 'px'; f.style.top = (r.top + 4) + 'px';
    document.body.appendChild(f); setTimeout(function () { f.remove(); }, 1500);
  }
  var KIND = {
    capfall: ['pop', 'castle', 'bad'], devastate: ['pop', 'flame', 'bad'], conquer: ['pop', 'banner', 'good'], tyran: ['tyran', 'crown', 'bad'],
    elim: ['pop', 'skull', 'bad'], pact: ['pop', 'branch', 'good'], pactbreak: ['pop', 'broken', 'bad'], revolt: ['pop', 'flame', 'bad'],
    attackwin: ['toast', 'swords', 'good'], attacklose: ['toast', 'shield', 'bad'], recruit: ['toast', 'cards', 'good'], build: ['toast', 'hammer', 'good'],
    land: ['toast', 'banner', 'good'], gold: ['toast', 'coins', 'good'], deficit: ['toast', 'warn', 'bad'], 'dip+': ['toast', 'branch', 'good'], 'dip-': ['toast', '⚠', 'bad'],
    bad: ['toast', 'warn', 'bad'], cede: ['toast', 'branch', 'good'], cedeterr: ['toast', 'warn', 'bad'], convert: ['toast', 'star', 'good'], card: ['toast', '🂠', ''], win: [null]
  };
  function classify(l) { var r = KIND[l.k]; return r ? [null].concat(r) : [null, 'toast', '•', '']; }
  function toast(text, icon, tone, col) {
    var el = fxLayer(), box = el.querySelector('.fx-toasts');
    if (!box) { box = document.createElement('div'); box.className = 'fx-toasts'; el.appendChild(box); }
    var t = document.createElement('div'); t.className = 'fx-toast ' + (tone || ''); if (col) t.style.setProperty('--tc', col);
    t.innerHTML = '<span class="i">' + (FOF.hasIcon(icon) ? FOF.ic(icon, 17) : icon) + '</span><span>' + FOF.esc(text) + '</span>';
    box.appendChild(t); while (box.children.length > 4) box.firstChild.remove();
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 400); }, 3600);
  }
  function pop(text, icon, tone, col) {
    var el = fxLayer(), p = document.createElement('div');
    p.className = 'fx-pop ' + (tone || ''); if (col) p.style.setProperty('--tc', col);
    p.innerHTML = '<span class="i">' + (FOF.hasIcon(icon) ? FOF.ic(icon, 34) : icon) + '</span><b>' + FOF.esc(text) + '</b>';
    el.appendChild(p); setTimeout(function () { p.remove(); }, 2300);
  }
  FOF.FX_pop = pop;
  function tyranPop(p) {
    if (!p) return;
    var el = document.createElement('div'); el.className = 'fx-tyran';
    el.innerHTML = '<div class="ty-crown">' + FOF.ic('crown', 84) + '</div><div class="ty-t">TYRAN</div><div class="ty-n">' + FOF.esc(p.name) + ' a renié toute parole donnée.</div><div class="ty-s">Tous peuvent désormais l’attaquer sans perdre de diplomatie, et ses terres se révolteront à chaque tour.</div>';
    document.body.appendChild(el); setTimeout(function () { el.classList.add('out'); setTimeout(function () { el.remove(); }, 600); }, 4200);
  }
  var pendingGold = 0;
  FOF.FX_flushGold = function () { if (pendingGold) { var n = pendingGold; pendingGold = 0; setTimeout(function () { goldPop(n); }, 120); } };
  function goldPop(n) {
    var m = document.getElementById('modal');
    if (m && !m.hidden && m.querySelector('.pass')) { pendingGold += n; return; }
    var el = document.createElement('div'); el.className = 'fx-gold' + (n < 0 ? ' loss' : '');
    el.innerHTML = '<i class="coin"></i><div>' + (n > 0 ? '+' : '') + n + ' or<small>' + (n > 0 ? 'Collecte' : 'Entretien') + '</small></div>';
    if (n > 0) for (var k = 0; k < 10; k++) { var s = document.createElement('i'); s.className = 'spark'; var ang = k / 10 * Math.PI * 2; s.style.setProperty('--dx', Math.round(Math.cos(ang) * 120) + 'px'); s.style.setProperty('--dy', Math.round(Math.sin(ang) * 70) + 'px'); s.style.animationDelay = (0.15 + Math.random() * 0.2) + 's'; el.appendChild(s); }
    document.body.appendChild(el); setTimeout(function () { el.remove(); }, 2500);
    setTimeout(function () { FOF.sfx(n > 0 ? 'coins' : 'spend'); }, 150);
  }
  function svgRing(loc, col) {
    var a = FOF.Board.anchor(loc), svg = document.getElementById('tokens'); if (!a || !svg) return;
    var ns = 'http://www.w3.org/2000/svg';
    [0, 1].forEach(function (k) {
      var c = document.createElementNS(ns, 'circle');
      c.setAttribute('cx', a.x); c.setAttribute('cy', a.y); c.setAttribute('r', 10);
      c.setAttribute('class', 'fx-ring'); c.style.stroke = col; c.style.animationDelay = (k * 0.25) + 's';
      svg.appendChild(c);
    });
  }

  FOF.FX = {
    before: function () { return { pos: tokPos() }; },
    after: function (st, before, o) {
      var cur = snap(st);
      if (reduce || !prev || prev.seed !== cur.seed) { prev = cur; return; }
      var anim = FOF.animOn !== false;
      // 1) les pions glissent vers leur nouvelle case
      if (anim) document.querySelectorAll('#tokens .tk').forEach(function (g) {
        var k = g.dataset.tk + '|' + g.dataset.own, p0 = before.pos[k]; if (!p0) { g.classList.add('fx-in'); return; }
        var dx = p0[0] - +g.dataset.x, dy = p0[1] - +g.dataset.y; if (Math.abs(dx) + Math.abs(dy) < 0.5) return;
        var inner = g.querySelector('.tki'); if (!inner) return;
        inner.style.transition = 'none'; inner.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
        inner.getBoundingClientRect();
        requestAnimationFrame(function () { inner.style.transition = 'transform .55s cubic-bezier(.2,.8,.2,1)'; inner.style.transform = 'translate(0px,0px)'; });
        g.classList.add('fx-moved');
      });
      // 2) nouveau tour / nouvelle phase
      if (!cur.winner && anim) {
        if (cur.turnNo !== prev.turnNo) {
          var p = st.players[st.cur];
          banner('<small>Tour ' + st.round + '</small><b>' + FOF.esc(p.name) + '</b><span>' + FOF.esc(FOF.LEADERS[p.leader].name) + '</span>', o.color(p.id));
        } else if (cur.phase !== prev.phase && PH[cur.phase]) {
          banner('<span class="ico">' + FOF.ic(PH[cur.phase][1], 28) + '</span><b>' + PH[cur.phase][0] + '</b>', o.color(st.cur));
        }
      }
      // 3) territoires qui changent de main
      if (anim) cur.ctrl.forEach(function (c, i) { if (c !== prev.ctrl[i]) svgRing('t' + i, c === null ? '#f1d488' : o.color(c)); });
      // 4) nouveaux aménagements
      cur.blds.forEach(function (b, i) {
        if (b === prev.blds[i]) return;
        var a = FOF.Board.anchor('t' + i); if (!a) return;
        if (b.split(',').length >= (prev.blds[i] ? prev.blds[i].split(',').length : 0)) svgRing('t' + i, '#f1d488');
      });
      // 4b) grand pop d'or à la collecte du joueur actif (et en ligne : seulement si c'est moi)
      if (cur.turnNo !== prev.turnNo && !cur.winner && (!o.online || o.seat === st.cur)) {
        var gd = cur.gold[st.cur] - prev.gold[st.cur];
        /* la fenêtre de collecte affiche désormais le bilan détaillé */
      }
      // 5) or et diplomatie qui bougent
      cur.gold.forEach(function (g, i) {
        var d = g - prev.gold[i]; if (!d) return;
        var opp = document.querySelectorAll('#players .opp')[i];
        floatAt(opp && opp.querySelector('.st'), (d > 0 ? '+' : '') + d + ' or', d > 0 ? 'gain' : 'loss');
        if (i === st.cur) { var pu = document.querySelector('#mat .purse'); floatAt(pu, (d > 0 ? '+' : '') + d, d > 0 ? 'gain big' : 'loss big'); if (pu) { pu.classList.remove('bump'); void pu.offsetWidth; pu.classList.add('bump'); } }
      });
      cur.dip.forEach(function (v, i) {
        var d = v - prev.dip[i]; if (!d || st.players[i].tyran) return;
        var opp = document.querySelectorAll('#players .opp')[i];
        floatAt(opp && opp.querySelector('.nm'), (d > 0 ? '+' : '') + d + ' ' + FOF.ic('branch', 13), d > 0 ? 'gain dip' : 'loss dip');
      });
      // 6) messages visuels (pop pour les grands événements, bulles pour le reste) + sons
      var snd = [], n = Math.min(4, cur.logN - prev.logN), popped = false;
      if (n > 0) st.log.slice(-n).forEach(function (l) {
        var r = classify(l); if (!r || !r[1]) return;
        var col = l.p !== null && l.p !== undefined ? o.color(l.p) : null;
        if (r[1] === 'tyran') { tyranPop(st.players[l.p]); snd.push('tyran'); popped = true; return; }
        if (r[1] === 'pop' && !popped) { pop(l.m, r[2], r[3], col); popped = true; snd.push(r[3] === 'bad' ? 'bad' : l.k === 'pact' ? 'dip' : 'conquer'); }
        else toast(l.m, r[2], r[3], col);
        if (l.k === 'recruit') snd.push('recruit');
        if (l.k === 'build') snd.push('build');
        if (l.k === 'dip+') snd.push('dip');
      });
      if (cur.combat && cur.combat !== prev.combat) {
        var c = st.lastCombat, mine = o.online ? (o.seat === c.att ? c.win : o.seat === c.def ? !c.win : null) : c.win;
        FOF.sfx('dice3d'); setTimeout(function () { FOF.sfx(mine === null ? 'clash' : mine ? 'win' : 'loss'); }, 1350);
      } else if (cur.winner && !prev.winner) {
        FOF.sfx(!o.online || o.seat === st.winner.pid ? 'victory' : 'defeat');
      } else if (Date.now() - (FOF.sfxLast || 0) < 700) { /* le clic a déjà fait son bruit */ }
      else if (snd.length) FOF.sfx(snd[0]);
      else if (cur.turnNo !== prev.turnNo) FOF.sfx(o.online && o.seat === st.cur ? 'turn' : 'phase');
      else if (cur.phase !== prev.phase) FOF.sfx('phase');
      else if (document.querySelector('#tokens .tk.fx-moved')) FOF.sfx('move');
      else if (cur.gold[st.cur] > prev.gold[st.cur]) FOF.sfx('coin');
      else if (cur.gold[st.cur] < prev.gold[st.cur]) FOF.sfx('spend');
      prev = cur;
    },
    reset: function () { prev = null; }
  };
  // cartes du marché : animation « distribuée » quand une nouvelle carte arrive dans un emplacement
  var seenSlots = {};
  new MutationObserver(function () {
    document.querySelectorAll('#market .slot').forEach(function (s) {
      var key = s.dataset.slotkey, idx = key.split(':')[0];
      if (seenSlots[idx] !== undefined && seenSlots[idx] !== key.split(':')[1] && !reduce) s.classList.add('deal');
      seenSlots[idx] = key.split(':')[1];
    });
  }).observe(document.documentElement, { childList: true, subtree: true });
})(window.FOF = window.FOF || {});
