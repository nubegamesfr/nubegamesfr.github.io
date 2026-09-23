/* Fields of Fire — didacticiel facultatif (3 tours).
   Il montre l'interface puis commente chaque phase ; il ne bloque jamais le joueur,
   qui peut faire autre chose que ce qui est proposé, passer une étape ou tout arrêter. */
(function (FOF) {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var on = false, seen = {}, cur = null, timer = null;

  // when : { round, phase } — l'étape apparaît quand la partie arrive là (round 0 = avant tout)
  var STEPS = [
    { id: 'board', sel: '#boardWrap', title: 'La carte', text: 'Voici le royaume. Chaque case est un territoire (plaines, forêt, montagnes, marécage) ou une zone de mer. Votre bannière marque votre capitale, vos pions sont posés dessus.', when: { round: 1, phase: 'collect' } },
    { id: 'mat', sel: '#mat', title: 'Votre tapis', text: 'En bas : votre dirigeant, votre or, vos trois pistes de victoire (territoires, temples, diplomatie) et vos unités. Le grand bouton à droite fait passer à la phase suivante.', when: { round: 1, phase: 'collect' } },
    { id: 'tools', sel: 'header.bar', title: 'Vos outils', text: 'En haut : la Chronique (tout ce qui se passe), les Règles, le Glossaire (pacifier, dévaster, tyran…), le Deck (ce qu’il reste à piocher) et le son. Tout est consultable à tout moment.', when: { round: 1, phase: 'collect' } },
    { id: 'collect', sel: '#modal .modal.collect', title: '1 · La collecte', text: 'Chaque tour commence par vos revenus : 1 écu par territoire, 1 de plus par cité, moins la solde de vos unités. Le détail est affiché ligne par ligne.', when: { round: 1, phase: 'collect' } },
    { id: 'recruit', sel: '#market', title: '2 · Le recrutement', text: 'Cinq cartes sont en vitrine. Vous pouvez en acheter une (son prix est son entretien) et en défausser une. Les cartes que vous pouvez payer clignotent ; après l’achat, cliquez un territoire qui clignote pour y poser l’unité.', when: { round: 1, phase: 'recruit' } },
    { id: 'military', sel: '#boardWrap', title: '3 · La phase militaire', text: 'Cliquez un de vos pions : les cases atteignables clignotent en blanc. Sur votre dirigeant, un petit menu s’ouvre (se déplacer, conquérir, attaquer). Amenez-le sur un territoire neutre : vous le prendrez au tour suivant.', when: { round: 1, phase: 'military' } },
    { id: 'build', sel: '#boardWrap', title: '4 · La construction', text: 'Cliquez un de vos territoires (ou son petit marteau) pour bâtir : campement 1, fort 3, port 3, cité 5, temple 7. Les cités rapportent de l’or, les forts défendent, les temples mènent à la victoire religieuse.', when: { round: 1, phase: 'build' } },
    { id: 'conquer', sel: '#boardWrap', title: 'Prendre un territoire neutre', text: 'Si votre dirigeant est resté sur un neutre depuis votre tour précédent, le menu propose « Conquérir ». Il ne se déplace pas ce tour-là : la terre est à vous sans combat.', when: { round: 2, phase: 'military' } },
    { id: 'attack', sel: '#mat', title: 'Attaquer', text: 'Pour attaquer, amenez vos unités d’élite sur la case visée : elles combattent ensemble. Chaque assaut coûte 1 diplomatie. Si votre dirigeant est sur la case, il mène l’assaut, et une défaite lui coûte un territoire.', when: { round: 2, phase: 'military' } },
    { id: 'gloss', sel: '#glossBtn', title: 'Un mot inconnu ?', text: 'Pacifier, céder, dévaster, tyran… le Glossaire explique tout le vocabulaire du jeu. Le Deck, juste à côté, montre les cartes encore disponibles.', when: { round: 2, phase: 'build' } },
    { id: 'victory', sel: '#mat .tracks', title: 'Gagner la partie', text: 'Trois chemins : conquérir assez de territoires, élever assez de temples, ou atteindre 10 de diplomatie. La victoire est immédiate. À vous de jouer : le didacticiel s’arrête ici.', when: { round: 3, phase: 'collect' } }
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
    el.innerHTML = '<div class="tuto-head">' + FOF.ic('book', 16) + ' Didacticiel <span class="muted">' + n + '/' + STEPS.length + '</span>' +
      '<button class="btn small ghost" data-tutoquit="1" title="Arrêter le didacticiel">' + FOF.ic('close', 14) + '</button></div>' +
      '<h4>' + FOF.esc(step.title) + '</h4><p>' + FOF.esc(step.text) + '</p>' +
      '<div class="tuto-acts"><button class="btn small" data-tutoquit="1">Ne plus afficher</button><button class="btn small primary" data-tutonext="1">J’ai compris</button></div>';
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
