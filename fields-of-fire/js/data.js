/* Fields of Fire - données de jeu (règles v1.1) */
(function (FOF) {
  'use strict';
  FOF.BIOMES = ['P', 'F', 'M', 'Ma'];
  FOF.BIOME_NAMES = { P: 'Plaines', F: 'Forêt', M: 'Montagnes', Ma: 'Marécage' };

  FOF.BUILDINGS = {
    C:  { name: 'Campement', cost: 1, def: 1 },
    F:  { name: 'Fort',      cost: 3, def: 3 },
    P:  { name: 'Port',      cost: 3, def: 1 },
    Ci: { name: 'Cité',      cost: 5, def: 0 },
    T:  { name: 'Temple',    cost: 7, def: 0 },
    A:  { name: 'Ambassade',  cost: 8, def: 0 }   // v1.9.14 : 4 → 8 or
  };
  FOF.BUILDING_ORDER = ['C', 'F', 'P', 'Ci', 'T', 'A'];

  // Unités d'élite : dépl, puissance [P,F,M,Ma], entretien, condition
  FOF.ELITES = {
    milice:     { name: 'Milice paysanne', move: 1, pow: [1,1,1,1], upkeep: 2, req: ['C', 1], copies: 3 },
    pillards:   { name: 'Pillards', move: 1, pow: [0,1,1,1], upkeep: 1, req: ['C', 2], copies: 3 },
    ecumeurs:   { name: 'Écumeurs', move: 1, pow: [1,1,1,2], upkeep: 1, req: ['C', 3], copies: 3 },
    brigands:   { name: 'Brigands', move: 1, pow: [1,1,2,1], upkeep: 1, req: ['C', 3], copies: 3 },
    bandits:    { name: 'Bandits', move: 1, pow: [0,2,2,1], upkeep: 1, req: ['C', 4], copies: 3 },
    nomades:    { name: 'Cavaliers nomades', move: 2, pow: [4,1,1,3], upkeep: 2, req: ['C', 5] },
    fantassins: { name: 'Fantassins', move: 1, pow: [2,2,2,2], upkeep: 2, req: ['F', 2], copies: 3 },
    archers:    { name: 'Archers', move: 1, pow: [1,3,3,2], upkeep: 2, req: ['F', 2], copies: 3 },
    piquiers:   { name: 'Piquiers', move: 1, pow: [4,1,1,4], upkeep: 2, req: ['F', 3] },
    inflourde:  { name: 'Infanterie lourde', move: 1, pow: [3,3,3,2], upkeep: 3, req: ['F', 3] },
    arbaletriers:{ name: 'Arbalétriers', move: 1, pow: [3,2,4,3], upkeep: 3, req: ['F', 3] },
    chevaliers: { name: 'Chevaliers', move: 2, pow: [5,3,1,3], upkeep: 3, req: ['F', 3] },
    archmontes: { name: 'Archers montés', move: 2, pow: [4,3,2,3], upkeep: 4, req: ['F', 4] },
    cuirassiers:{ name: 'Cuirassiers', move: 2, pow: [6,3,2,2], upkeep: 4, req: ['F', 4] },
    varegues:   { name: 'Garde varègue', move: 1, pow: [3,3,3,5], upkeep: 3, req: ['P', 3] },   // v1.9.17
    garde:      { name: 'Garde royale', move: 1, pow: [4,4,4,4], upkeep: 4, req: ['F', 5] },
    croises:    { name: 'Croisés', move: 1, pow: [3,3,3,3], upkeep: 2, req: ['T', 4] }
  };

  // Unités spéciales : dépl, entretien, condition ('D' = diplomatie), texte
  FOF.SPECIALS = {
    corbeau:     { name: 'Corbeau messager', move: 3, upkeep: 2, req: ['Ci', 1], copies: 3, text: 'Prend la mer sans port. Sur une capitale adverse, défausser pour +1 de diplomatie.' },
    emissaire:   { name: 'Émissaire', move: 2, upkeep: 3, req: ['Ci', 2], copies: 3, text: 'Sur une capitale adverse, défausser pour +2 de diplomatie.' },
    pelerin:     { name: 'Pèlerin', move: 2, upkeep: 1, req: ['T', 2], copies: 3, text: 'Sur un temple adverse, défausser : +1 de diplomatie pour vous et pour son propriétaire. L’Ambassade ne s’ajoute qu’à votre gain.' },
    heraut:      { name: 'Héraut', move: 0, upkeep: 4, req: ['Ci', 3], text: 'À la collecte, +1 de diplomatie si vous n’avez ni attaqué ni été attaqué depuis votre tour précédent. L’Ambassade n’ajoute rien à ce gain. Cumulable.' },
    ambassadeur: { name: 'Ambassadeur', move: 1, upkeep: 3, req: ['A', 1], copies: 3, text: 'Sur une capitale adverse (hors Tyran) : pacte de non-agression tant qu’il y reste. S’il n’y est plus, quelle qu’en soit la raison, vous perdez 1 de diplomatie.' },
    colonie:     { name: 'Colonie', move: 1, upkeep: 3, req: ['Ci', 1], copies: 3, text: 'Sur un territoire neutre, défausser pour le conquérir et y bâtir un campement.' },
    exploratrice:{ name: 'Exploratrice', move: 2, upkeep: 2, req: ['P', 2], copies: 3, text: 'Sur un territoire neutre d’un autre continent que votre capitale, défausser pour le conquérir et gagner 3 or.' },
    caboteur:    { name: 'Caboteur', move: 1, upkeep: 1, req: ['P', 1], copies: 3, text: 'À la collecte, sur une case avec le port d’un adversaire : +3 or.' },
    caravanier:  { name: 'Caravanier', move: 1, upkeep: 1, req: ['Ci', 1], copies: 3, text: 'À la collecte, sur une case avec la cité d’un adversaire : +3 or.' },
    espion:      { name: 'Espion', move: 1, upkeep: 0, req: ['Ci', 1], copies: 3, text: 'Une seule fois, à tout moment (même au tour d’un autre) : payez 1 or, regardez en secret la carte du dessus du deck et défaussez-la si vous voulez. Puis défaussez l’Espion.' },
    partisan:    { name: 'Partisan', move: 2, upkeep: 2, req: ['Ci', 3], text: 'Sur un territoire adverse, défausser pour convertir tous les aménagements adverses, sauf les temples.' },
    predicateur: { name: 'Prédicateur', move: 1, upkeep: 2, req: ['T', 3], text: 'Sur un territoire adverse : convertit son temple. Puis défausse.' },
    gouverneur:  { name: 'Gouverneur', move: 0, upkeep: 5, req: ['F', 4], text: 'Défausser pour convertir tous les aménagements adverses sur vos territoires, sauf les temples.' },
    pretresse:   { name: 'Prêtresse', move: 1, upkeep: 2, req: ['T', 1], copies: 3, text: 'Lors d’un combat sur sa case, si vous perdez, vous relancez votre dé. Une relance par Prêtresse.' },
    trebuchets:  { name: 'Trébuchets', move: 1, upkeep: 4, req: ['F', 5], text: 'Sur un territoire adverse, peut détruire un aménagement adverse, une fois par tour. C’est une attaque : 1 de diplomatie (sauf contre un Tyran), et elle rompt un pacte.' },
    maitre:      { name: 'Maître d’œuvre', move: 1, upkeep: 1, req: ['T', 1], copies: 3, text: 'Vos temples coûtent 1 or de moins (cumulable).' },
    // v1.9.14 - deux nouvelles unités spéciales (créateur, 28/09/2026)
    calomniateur:{ name: 'Calomniateur', move: 2, upkeep: 3, req: ['Ci', 1], copies: 3, text: 'Sur un territoire adverse, défausser : son propriétaire perd 2 de diplomatie (sans descendre sous 0).' },
    boutefeu:    { name: 'Boutefeu', move: 1, upkeep: 1, req: ['Ci', 2], text: 'Sur un territoire adverse : tant qu’il y reste, tout revenu de cette case est bloqué pour son maître (territoire, cité, unités spéciales).' },
    prelat:      { name: 'Prélat', move: 0, upkeep: 3, req: ['T', 4], text: 'À la collecte, gagnez +2 or par temple que vous possédez (cumulable).' },
    // v1.9.19 - nouvelle unité spéciale (créateur, 07/10/2026)
    chroniqueur: { name: 'Chroniqueur', move: 0, upkeep: 5, req: ['T', 3], text: 'Chaque fois que vous remportez une bataille, en attaque ou en défense : +1 de diplomatie. L’Ambassade ne s’ajoute pas à ce gain. Cumulable.' }
  };


  FOF.LEADERS = {
    odon:    { name: 'Odon le Brave', mod: 2, text: 'Chacune de ses unités d’élite engagée dans un assaut lui donne +1, qu’il mène l’assaut ou non.' },
    gustave: { name: 'Gustave l’Irascible', mod: 3, text: 'Tous ses territoires : +1 défense. Ses cités coûtent 6 or.' },
    edouard: { name: 'Edouard le Sage', mod: 2, text: 'À la collecte, s’il a 3 de diplomatie ou moins : 1 or pour +1 diplomatie. Une seule fois par partie, et seulement s’il n’a ni attaqué ni été attaqué.' },
    mathilde:{ name: 'Mathilde la Bien-Aimée', mod: 2, text: 'Sa première cité coûte 4 or ; les suivantes sont au prix normal.' },
    adele:   { name: 'Adèle la Pieuse', mod: 3, text: 'Ses temples coûtent 6 or et donnent +1 défense.' },
    henri:   { name: 'Henri le Stratège', mod: 2, text: 'Toutes ses unités d’élite se déplacent d’1 case de plus.' },
    hugues:  { name: 'Hugues le Bâtisseur', mod: 3, text: 'Ses forts et ses ports coûtent 1 or de moins.' },
    alienor: { name: 'Alinor l’Amirale', mod: 2, text: 'Ses ports coûtent 2 or et donnent +2 défense.' },
    yusuf:   { name: 'Yusuf le Marchand', mod: 2, text: 'Ses Caboteurs et Caravaniers se déplacent d’1 case de plus et rapportent 5 or.' }   // v1.9.19
  };

  FOF.PLAYER_COLORS = [
    { id: 'crimson', name: 'Écarlate', hex: '#c8413a' },
    { id: 'azure',   name: 'Azur',     hex: '#3d7fc4' },
    { id: 'emerald', name: 'Émeraude', hex: '#3a9a63' },
    { id: 'gold',    name: 'Or',       hex: '#d8a431' },
    { id: 'violet',  name: 'Pourpre',  hex: '#8b5cb8' },
    { id: 'teal',    name: 'Sarcelle', hex: '#2aa3a9' }
  ];

  /* Dirigeants à débloquer : jouables seulement après que le joueur a laissé son e-mail et accepté
     d'être recontacté. Le déblocage vaut pour ce navigateur. Les bots, eux, peuvent les jouer. */
  FOF.LOCKED_LEADERS = ['hugues', 'alienor', 'yusuf'];
  FOF.heroesUnlocked = function () { try { return localStorage.getItem('fof-heroes') === '1'; } catch (e) { return false; } };
  FOF.leaderLocked = function (k) { return FOF.LOCKED_LEADERS.indexOf(k) >= 0 && !FOF.heroesUnlocked(); };
  // dirigeant au hasard pour un joueur humain : jamais un dirigeant verrouillé
  FOF.randomHumanLeader = function (used) {
    var pool = Object.keys(FOF.LEADERS).filter(function (k) { return !FOF.leaderLocked(k) && (used || []).indexOf(k) < 0; });
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : FOF.randomFreeLeader(used || []);
  };

  // v1.9.14 - nombre d'exemplaires de chaque carte dans le deck (2 par défaut, 3 pour certaines)
  FOF.copies = function (key) { var d = FOF.ELITES[key] || FOF.SPECIALS[key]; return d && d.copies ? d.copies : 2; };
  FOF.EDOUARD_COUT = 1;   // v1.9.14 : 4 → 1 or
  FOF.isElite = function (key) { return !!FOF.ELITES[key]; };
  FOF.unitDef = function (key) { return FOF.ELITES[key] || FOF.SPECIALS[key]; };
})(window.FOF = window.FOF || {});
