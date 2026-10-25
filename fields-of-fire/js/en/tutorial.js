/* Fields of Fire - didacticiel facultatif (3 tours).
   Il montre l'interface puis commente chaque phase ; il ne bloque jamais le joueur,
   qui peut faire autre chose que ce qui est proposé, passer une étape ou tout arrêter. */
(function (FOF) {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var on = false, seen = {}, cur = null, timer = null;

  // when : { round, phase } - l'étape apparaît quand la partie arrive là (round 0 = avant tout)
  var STEPS = [
    { id: 'board', sel: '#boardWrap', title: 'The Map', text: 'This is the kingdom. Every space is either a territory (plains, forest, mountains, swamp) or a sea zone. Your capital has a border striped in your colour, and your leader’s piece stands on it.', when: { round: 1, phase: 'collect' } },
    { id: 'mat', sel: '#mat', title: 'Your Banner', text: 'At the bottom: your leader, your gold, your three paths to victory (territories, temples, Diplomacy) and your units. The big button on the right moves on to the next phase.', when: { round: 1, phase: 'collect' } },
    { id: 'tools', sel: 'header.bar', title: 'Information', text: 'At the top: the Chronicle (everything that happens), the Rules, the Glossary, the Deck and the sound. You can check any of them at any time.', when: { round: 1, phase: 'collect' } },
    { id: 'collect', sel: '#modal .modal.collect', title: '1 · Income', text: 'Every turn starts with your income: 1 gold per territory, 1 more per city, plus whatever your special units bring in. Your units’ upkeep is then subtracted. The breakdown is shown line by line.', when: { round: 1, phase: 'collect' } },
    { id: 'recruit', sel: '#market', title: '2 · Recruit', text: 'Five cards are on display. You can buy one and discard one each turn. A card costs as much gold as its upkeep and requires a building, shown at the bottom right. The “Buy” button lights up when you meet both conditions. After buying, click a flashing territory to place the unit there.', when: { round: 1, phase: 'recruit' } },
    { id: 'military', sel: '#boardWrap', title: '3 · Military Phase', text: 'Click one of your pieces to act with it. To move it, click one of the reachable spaces flashing white. On your leader, a small menu opens (move, conquer, attack). Bring your leader onto a neutral territory: you’ll take it next turn.', when: { round: 1, phase: 'military' } },
    { id: 'build', sel: '#boardWrap', title: '4 · Build', text: 'Click one of your territories (or its little hammer) to build: camp 1 gold, fort 3, port 3, city 5, temple 7, embassy 10 (capital only). Your capital has three slots, other territories two. Hover over a building to see what it does.', when: { round: 1, phase: 'build' } },
    { id: 'conquer', sel: '#boardWrap', title: 'Taking a Neutral Territory', text: 'If your leader has stayed on a neutral territory since your previous turn, the menu offers “Conquer”. Pick it and the territory is yours. Note: your leader can’t do anything else that turn.', when: { round: 2, phase: 'military' } },
    { id: 'sea', sel: '#boardWrap', title: 'Crossing the Sea', text: 'To put to sea, a piece must leave from a coastal territory with a port (the Messenger Raven needs none). Once at sea, it can land on any territory bordering its zone. Each sea zone touches two to four territories.', when: { round: 2, phase: 'military' } },
    { id: 'attack', sel: '#mat', title: 'Attacking', text: 'To attack, bring your elite units onto the target space: they fight together, and your leader leads the assault if present. Each assault costs 1 Diplomacy, plus 1 for each enemy special unit destroyed. If your leader is defeated, it returns to your capital and you give the winner a territory of your choice. Beware: a loss that would take your Diplomacy below zero makes you a Tyrant.', when: { round: 2, phase: 'military' } },
    { id: 'gloss', sel: '#glossBtn', title: 'Don’t know a word?', text: 'Pacify, pillage, Tyrant… the Glossary explains all the game’s vocabulary. The Deck shows the cards still available and those in the discard pile.', when: { round: 2, phase: 'build' } },
    { id: 'victory', sel: '#mat .tracks', title: 'Winning the Game', text: 'Three paths: conquer enough territories, raise enough temples, or reach 12 Diplomacy. Victory is immediate. Your move: the tutorial ends here.', when: { round: 3, phase: 'collect' } }
  ];

  function box() {
    var el = $('tutoBox');
    if (!el) {
      el = document.createElement('div'); el.id = 'tutoBox'; el.hidden = true;
      document.body.appendChild(el);
    }
    return el;
  }
  function clearHi() { document.querySelectorAll('.tuto-hi').forEach(function (e) { e.classList.remove('tuto-hi'); }); }

  function show(step) {
    cur = step; seen[step.id] = true;
    var el = box(), n = STEPS.indexOf(step) + 1;
    el.innerHTML = '<div class="tuto-head">' + FOF.ic('book', 16) + ' Tutorial <span class="muted">' + n + '/' + STEPS.length + '</span>' +
      '<button class="btn small ghost tuto-x" data-tutoquit="1" title="Stop the tutorial">' + FOF.ic('close', 14) + '</button></div>' +
      '<h4>' + FOF.esc(step.title) + '</h4><p>' + FOF.esc(step.text) + '</p>' +
      '<div class="tuto-acts"><button class="btn small" data-tutoquit="1">Don’t show again</button><button class="btn small primary" data-tutonext="1">Got it</button></div>';
    el.hidden = false;
    clearHi();
    var t = step.sel && document.querySelector(step.sel);
    if (t) { t.classList.add('tuto-hi'); var r = t.getBoundingClientRect(); el.classList.toggle('left', r.left + r.width / 2 > window.innerWidth / 2); }
    if (FOF.sfx) FOF.sfx('page');
  }
  function hide() { cur = null; clearHi(); var el = $('tutoBox'); if (el) el.hidden = true; }

  function tick() {
    if (!on) return;
    var st = FOF.currentState && FOF.currentState();
    if (!st || st.winner) return hide();
    // v1.8 : le didacticiel ne doit jamais disparaître à cause d'une action de l'interface.
    // Si l'encart a été masqué ou retiré du document par un rendu, on le remet tel qu'il était.
    if (cur) {
      var b = $('tutoBox');
      if (!b || !b.isConnected || b.hidden) show(cur);
      return;                              // une étape est déjà affichée
    }
    for (var i = 0; i < STEPS.length; i++) {
      var s = STEPS[i];
      if (seen[s.id]) continue;
      if (s.when.round > st.round) return;  // les suivantes viendront plus tard
      if (s.when.round < st.round) { seen[s.id] = true; continue; }
      if (s.when.phase !== st.phase) continue;
      if (s.sel && !document.querySelector(s.sel)) continue;
      if (st.players[st.cur].bot) return;   // on ne commente pas le tour d'un bot
      return show(s);
    }
    if (STEPS.every(function (x) { return seen[x.id]; })) stop();
  }

  FOF.tutorialStart = function () {
    on = true; seen = {}; cur = null;
    clearInterval(timer); timer = setInterval(tick, 700);
    document.body.classList.add('tuto-on');
    tick();
  };
  function stop() { on = false; clearInterval(timer); timer = null; hide(); document.body.classList.remove('tuto-on'); }
  FOF.tutorialStop = stop;
  FOF.tutorialOn = function () { return on; };

  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-tutonext],[data-tutoquit]');
    if (!t) return;
    if (t.dataset.tutoquit) return stop();
    hide(); setTimeout(tick, 200);
  });
})(window.FOF = window.FOF || {});
