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
    A:  { name: 'Ambassade',  cost: 10, def: 0 }  // v1.9.14 : 4 → 8 or ; v1.9.25 : 10 or (créateur, 24/10/2026)
  };
  FOF.BUILDING_ORDER = ['C', 'F', 'P', 'Ci', 'T', 'A'];

  // Unités d'élite : dépl, puissance [P,F,M,Ma], solde (champ upkeep), condition
  FOF.ELITES = {
    milice:     { name: 'Milice paysanne', move: 1, pow: [1,1,1,1], upkeep: 2, req: ['C', 1], copies: 3 },
    pillards:   { name: 'Pillards', move: 1, pow: [0,1,1,1], upkeep: 1, req: ['C', 2], copies: 3 },
    ecumeurs:   { name: 'Écumeurs', move: 1, pow: [1,1,1,2], upkeep: 1, req: ['C', 3], copies: 3 },
    brigands:   { name: 'Brigands', move: 1, pow: [1,1,2,1], upkeep: 1, req: ['C', 3], copies: 3 },
    bandits:    { name: 'Bandits', move: 1, pow: [0,2,2,1], upkeep: 1, req: ['C', 4], copies: 3 },
    nomades:    { name: 'Cavaliers nomades', move: 2, pow: [4,1,1,3], upkeep: 2, req: ['C', 5] },
    fantassins: { name: 'Fantassins', move: 1, pow: [2,2,2,2], upkeep: 2, req: ['F', 2], copies: 3 },
    archers:    { name: 'Archers', move: 1, pow: [1,3,3,2], upkeep: 2, req: ['F', 2], copies: 3 },
    piquiers:   { name: 'Piquiers', move: 1, pow: [3,1,1,4], upkeep: 2, req: ['F', 2] },   // v1.9.25 : plaine 4 → 3, Fort×3 → ×2
    inflourde:  { name: 'Infanterie lourde', move: 1, pow: [3,3,3,2], upkeep: 3, req: ['F', 3] },
    arbaletriers:{ name: 'Arbalétriers', move: 1, pow: [3,2,4,2], upkeep: 3, req: ['F', 3] },   // v1.9.25 : marécage 3 → 2
    chevaliers: { name: 'Chevaliers', move: 2, pow: [5,3,1,3], upkeep: 4, req: ['F', 3] },   // v1.9.25 : solde 3 → 4
    archmontes: { name: 'Archers montés', move: 2, pow: [4,3,2,4], upkeep: 4, req: ['F', 4] },   // v1.9.25 : marécage 3 → 4
    cuirassiers:{ name: 'Cuirassiers', move: 2, pow: [6,3,2,2], upkeep: 4, req: ['F', 4] },
    varegues:   { name: 'Garde varègue', move: 1, pow: [3,3,3,5], upkeep: 3, req: ['P', 3] },   // v1.9.17
    garde:      { name: 'Garde royale', move: 1, pow: [4,4,4,4], upkeep: 5, req: ['F', 5] },   // v1.9.25 : solde 4 → 5
    croises:    { name: 'Croisés', move: 1, pow: [3,3,3,3], upkeep: 2, req: ['T', 4] }
  };

  // Unités spéciales : dépl, solde, condition ('D' = diplomatie), texte
  // v1.9.25 (créateur, 24/10/2026) : Corbeau, Émissaire à cheval, Émissaire en nef et Pèlerin donnent aussi +1 de
  // diplomatie au joueur visé. Son Ambassade s'ajoute à ce +1, sauf pour le Pèlerin (réponses du 24/10).
  // « retire » : carte sortie du jeu, gardée ici pour les parties déjà commencées (0 exemplaire dans le deck).
  // « cotier » : ne va jamais sur un territoire sans côte (mer et territoires côtiers seulement).
  FOF.SPECIALS = {
    corbeau:     { name: 'Corbeau messager', move: 3, upkeep: 1, req: ['Ci', 1], copies: 3, text: 'Prend la mer sans port. Sur une capitale adverse, défausser pour +1 de diplomatie. +1 de diplomatie au joueur adverse.' },
    emissaire:   { name: 'Émissaire à cheval', move: 2, upkeep: 2, req: ['Ci', 2], copies: 3, text: 'Sur une capitale adverse, défausser pour +2 de diplomatie. +1 de diplomatie au joueur adverse.' },
    emnef:       { name: 'Émissaire en nef', move: 2, upkeep: 2, req: ['P', 2], copies: 3, cotier: true, text: 'Sur une capitale adverse, défausser pour +2 de diplomatie. +1 de diplomatie au joueur adverse.' },
    pelerin:     { name: 'Pèlerin', move: 2, upkeep: 1, req: ['T', 2], copies: 3, text: 'Sur un temple adverse, défausser pour +2 de diplomatie. +1 de diplomatie au joueur adverse. L’Ambassade ne s’ajoute qu’à votre gain.' },
    heraut:      { name: 'Héraut', move: 0, upkeep: 4, req: ['Ci', 3], text: 'À la collecte, +1 de diplomatie si vous n’avez ni attaqué ni été attaqué depuis votre tour précédent. L’Ambassade n’ajoute rien à ce gain. Cumulable.' },
    ambassadeur: { name: 'Ambassadeur', move: 1, upkeep: 3, req: ['A', 1], copies: 3, text: 'Sur une capitale adverse (hors Tyran) : pacte de non-agression tant qu’il y reste. S’il n’y est plus, quelle qu’en soit la raison, vous perdez 1 de diplomatie.' },
    colonie:     { name: 'Colonie', move: 1, upkeep: 3, req: ['Ci', 1], copies: 3, text: 'Sur un territoire neutre, défausser pour le conquérir et y bâtir un campement.' },
    exploratrice:{ name: 'Exploratrice', move: 2, upkeep: 2, req: ['P', 2], copies: 3, cotier: true, text: 'Sur un territoire neutre d’un autre continent que votre capitale, défausser pour le conquérir et gagner 3 or.' },
    caboteur:    { name: 'Caboteur', move: 1, upkeep: 1, req: ['P', 1], copies: 3, cotier: true, text: 'À la collecte, sur une case avec le port d’un adversaire : +3 or.' },
    caravanier:  { name: 'Caravanier', move: 1, upkeep: 1, req: ['Ci', 1], copies: 3, text: 'À la collecte, sur une case avec la cité d’un adversaire : +3 or.' },
    espion:      { name: 'Espion', move: 1, upkeep: 0, req: ['Ci', 1], copies: 3, text: 'Une seule fois, à tout moment (même au tour d’un autre) : payez 1 or, regardez en secret la carte du dessus du deck et défaussez-la si vous voulez. Puis défaussez l’Espion.' },
    partisan:    { name: 'Partisan', move: 2, upkeep: 2, req: ['Ci', 3], text: 'Sur un territoire adverse, défausser pour convertir tous les aménagements adverses, sauf les temples.' },
    predicateur: { name: 'Prédicateur', move: 1, upkeep: 2, req: ['T', 3], text: 'Sur un territoire adverse, défausser pour convertir son temple.' },
    gouverneur:  { name: 'Gouverneur', move: 0, upkeep: 5, req: ['F', 4], retire: true, text: 'Défausser pour convertir tous les aménagements adverses sur vos territoires, sauf les temples.' },
    pretresse:   { name: 'Prêtresse', move: 1, upkeep: 2, req: ['T', 1], copies: 3, text: 'Lors d’un combat sur sa case, si vous perdez, vous relancez votre dé. Une relance par Prêtresse.' },
    trebuchets:  { name: 'Trébuchets', move: 1, upkeep: 4, req: ['F', 5], retire: true, text: 'Sur un territoire adverse, peut détruire un aménagement adverse, une fois par tour. C’est une attaque : 1 de diplomatie (sauf contre un Tyran), et elle rompt un pacte.' },
    // v1.9.25 - nouvel effet (créateur, 24/10/2026) : +2 défense sur un de vos temples, non cumulable, le bonus
    // reste au temple s'il change de propriétaire. L'ancienne remise d'1 or sur les temples disparaît.
    maitre:      { name: 'Maître d’œuvre', move: 1, upkeep: 1, req: ['T', 1], copies: 3, text: 'Sur un temple allié, défausser pour donner +2 défense au temple.' },
    // v1.9.14 - deux nouvelles unités spéciales (créateur, 28/09/2026)
    calomniateur:{ name: 'Calomniateur', move: 2, upkeep: 3, req: ['Ci', 1], copies: 3, text: 'Sur un territoire adverse, défausser pour que son propriétaire perde 2 de diplomatie (sans descendre sous 0).' },
    boutefeu:    { name: 'Boutefeu', move: 1, upkeep: 1, req: ['Ci', 2], text: 'Sur un territoire adverse, tant qu’il y reste, tout revenu de cette case est bloqué pour son maître (territoire, cité, unités spéciales).' },
    prelat:      { name: 'Prélat', move: 0, upkeep: 4, req: ['T', 4], text: 'À la collecte, gagnez +2 or par temple que vous possédez (cumulable).' },
    // v1.9.19 - nouvelle unité spéciale (créateur, 07/10/2026)
    chroniqueur: { name: 'Chroniqueur', move: 0, upkeep: 5, req: ['T', 3], text: 'Chaque fois que vous remportez une bataille, en attaque ou en défense : +1 de diplomatie. L’Ambassade ne s’ajoute pas à ce gain. Cumulable.' },
    // v1.9.24 - nouvelle unité spéciale (créateur, 08/10/2026). 2 exemplaires, ports sur vos territoires, 1 point de déplacement minimum (réponses du 08/10)
    cartographe: { name: 'Cartographe', move: 0, upkeep: 3, req: ['P', 3], text: 'Vos unités et votre dirigeant peuvent se déplacer directement d’un de vos ports à un autre de vos ports. Cela coûte tous leurs points de déplacement.' }
  };


  // v1.9.24 - attaque de base de tous les dirigeants à 3 (créateur, 08/10/2026)
  FOF.LEADERS = {
    odon:    { name: 'Odon le Brave', mod: 3, text: 'Chacune de ses unités d’élite engagée dans un assaut lui donne +1, qu’il mène l’assaut ou non.' },
    gustave: { name: 'Gustave l’Irascible', mod: 3, text: 'Tous ses territoires : +1 défense. Ses cités coûtent 6 or.' },
    edouard: { name: 'Édouard le Sage', mod: 3, text: 'Une fois par partie, en temps de paix, s’il a 5 de diplomatie ou moins : 1 or contre 1 point de diplomatie.' },
    mathilde:{ name: 'Mathilde la Bien-Aimée', mod: 3, text: 'Sa première cité coûte 4 or.' },
    adele:   { name: 'Adèle la Pieuse', mod: 3, text: 'Ses temples coûtent 6 or et donnent +1 défense.' },
    henri:   { name: 'Henri le Stratège', mod: 3, text: 'Toutes ses unités d’élite se déplacent d’1 case de plus.' },
    hugues:  { name: 'Hugues le Bâtisseur', mod: 3, text: 'Ses forts et ses ports coûtent 1 or de moins.' },
    alienor: { name: 'Alinor l’Amirale', mod: 3, text: 'Ses ports coûtent 2 or et donnent +2 défense.' },
    // v1.9.24 - nouveau pouvoir (créateur, 08/10/2026) : 3 achats au lieu d'1 pendant un tour de
    // recrutement, au prix normal, plafonds d'armée maintenus (réponse du 08/10)
    yusuf:   { name: 'Yusuf le Marchand', mod: 3, text: 'Une fois par partie, il peut acheter 3 cartes dans le marché.' },
    zaynab:  { name: 'Zaynab la Vagabonde', mod: 3, text: 'Toutes ses unités spéciales se déplacent d’1 case de plus.' }   // v1.9.24
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
  FOF.LOCKED_LEADERS = ['hugues', 'alienor', 'yusuf', 'zaynab'];   // v1.9.24 : Zaynab à débloquer (réponse du 08/10)
  FOF.heroesUnlocked = function () { try { return localStorage.getItem('fof-heroes') === '1'; } catch (e) { return false; } };
  FOF.leaderLocked = function (k) { return FOF.LOCKED_LEADERS.indexOf(k) >= 0 && !FOF.heroesUnlocked(); };
  // dirigeant au hasard pour un joueur humain : jamais un dirigeant verrouillé
  FOF.randomHumanLeader = function (used) {
    var pool = Object.keys(FOF.LEADERS).filter(function (k) { return !FOF.leaderLocked(k) && (used || []).indexOf(k) < 0; });
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : FOF.randomFreeLeader(used || []);
  };

  // v1.9.14 - nombre d'exemplaires de chaque carte dans le deck (2 par défaut, 3 pour certaines)
  FOF.copies = function (key) { var d = FOF.ELITES[key] || FOF.SPECIALS[key]; return !d || d.retire ? 0 : d.copies ? d.copies : 2; };
  // v1.9.25 - les cartes en jeu (hors cartes retirées), pour l'arsenal et les mini-jeux
  FOF.cartesEnJeu = function (filtre) { return (filtre === 'sp' ? [] : Object.keys(FOF.ELITES)).concat(filtre === 'el' ? [] : Object.keys(FOF.SPECIALS)).filter(function (k) { return FOF.copies(k) > 0; }); };
  FOF.EDOUARD_COUT = 1;   // v1.9.14 : 4 → 1 or
  FOF.EDOUARD_MAX = 5;    // v1.9.24 : utilisable tant qu'il a 5 de diplomatie ou moins (avant : 3)
  FOF.isElite = function (key) { return !!FOF.ELITES[key]; };
  FOF.unitDef = function (key) { return FOF.ELITES[key] || FOF.SPECIALS[key]; };
})(window.FOF = window.FOF || {});
