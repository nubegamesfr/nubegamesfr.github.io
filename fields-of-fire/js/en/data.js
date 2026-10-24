/* Fields of Fire - données de jeu (règles v1.1) */
(function (FOF) {
  'use strict';
  FOF.BIOMES = ['P', 'F', 'M', 'Ma'];
  FOF.BIOME_NAMES = { P: 'Plains', F: 'Forest', M: 'Mountains', Ma: 'Swamp' };

  FOF.BUILDINGS = {
    C:  { name: 'Camp', cost: 1, def: 1 },
    F:  { name: 'Fort',      cost: 3, def: 3 },
    P:  { name: 'Port',      cost: 3, def: 1 },
    Ci: { name: 'City',      cost: 5, def: 0 },
    T:  { name: 'Temple',    cost: 7, def: 0 },
    A:  { name: 'Embassy',  cost: 10, def: 0 }  // v1.9.14 : 4 → 8 or ; v1.9.25 : 10 or (créateur, 24/10/2026)
  };
  FOF.BUILDING_ORDER = ['C', 'F', 'P', 'Ci', 'T', 'A'];

  // Unités d'élite : dépl, puissance [P,F,M,Ma], solde (champ upkeep), condition
  FOF.ELITES = {
    milice:     { name: 'Peasant Militia', move: 1, pow: [1,1,1,1], upkeep: 2, req: ['C', 1], copies: 3 },
    pillards:   { name: 'Raiders', move: 1, pow: [0,1,1,1], upkeep: 1, req: ['C', 2], copies: 3 },
    ecumeurs:   { name: 'Corsairs', move: 1, pow: [1,1,1,2], upkeep: 1, req: ['C', 3], copies: 3 },
    brigands:   { name: 'Brigands', move: 1, pow: [1,1,2,1], upkeep: 1, req: ['C', 3], copies: 3 },
    bandits:    { name: 'Bandits', move: 1, pow: [0,2,2,1], upkeep: 1, req: ['C', 4], copies: 3 },
    nomades:    { name: 'Nomad Riders', move: 2, pow: [4,1,1,3], upkeep: 2, req: ['C', 5] },
    fantassins: { name: 'Footmen', move: 1, pow: [2,2,2,2], upkeep: 2, req: ['F', 2], copies: 3 },
    archers:    { name: 'Archers', move: 1, pow: [1,3,3,2], upkeep: 2, req: ['F', 2], copies: 3 },
    piquiers:   { name: 'Pikemen', move: 1, pow: [3,1,1,4], upkeep: 2, req: ['F', 2] },   // v1.9.25 : plaine 4 → 3, Fort×3 → ×2
    inflourde:  { name: 'Heavy Infantry', move: 1, pow: [3,3,3,2], upkeep: 3, req: ['F', 3] },
    arbaletriers:{ name: 'Crossbowmen', move: 1, pow: [3,2,4,2], upkeep: 3, req: ['F', 3] },   // v1.9.25 : marécage 3 → 2
    chevaliers: { name: 'Knights', move: 2, pow: [5,3,1,3], upkeep: 4, req: ['F', 3] },   // v1.9.25 : solde 3 → 4
    archmontes: { name: 'Horse Archers', move: 2, pow: [4,3,2,4], upkeep: 4, req: ['F', 4] },   // v1.9.25 : marécage 3 → 4
    cuirassiers:{ name: 'Cuirassiers', move: 2, pow: [6,3,2,2], upkeep: 4, req: ['F', 4] },
    varegues:   { name: 'Varangian Guard', move: 1, pow: [3,3,3,5], upkeep: 3, req: ['P', 3] },   // v1.9.17
    garde:      { name: 'Royal Guard', move: 1, pow: [4,4,4,4], upkeep: 5, req: ['F', 5] },   // v1.9.25 : solde 4 → 5
    croises:    { name: 'Crusaders', move: 1, pow: [3,3,3,3], upkeep: 2, req: ['T', 4] }
  };

  // Unités spéciales : dépl, solde, condition ('D' = diplomatie), texte
  // v1.9.25 (créateur, 24/10/2026) : Corbeau, Émissaire à cheval, Émissaire en nef et Pèlerin donnent aussi +1 de
  // diplomatie au joueur visé. Son Ambassade s'ajoute à ce +1, sauf pour le Pèlerin (réponses du 24/10).
  // « retire » : carte sortie du jeu, gardée ici pour les parties déjà commencées (0 exemplaire dans le deck).
  // « cotier » : ne va jamais sur un territoire sans côte (mer et territoires côtiers seulement).
  FOF.SPECIALS = {
    corbeau:     { name: 'Messenger Raven', move: 3, upkeep: 1, req: ['Ci', 1], copies: 3, text: 'Can put to sea without a port. On an enemy capital, discard for +1 Diplomacy. +1 Diplomacy to that opponent.' },
    emissaire:   { name: 'Mounted Envoy', move: 2, upkeep: 2, req: ['Ci', 2], copies: 3, text: 'On an enemy capital, discard for +2 Diplomacy. +1 Diplomacy to that opponent.' },
    emnef:       { name: 'Envoy by Sea', move: 2, upkeep: 2, req: ['P', 2], copies: 3, cotier: true, text: 'On an enemy capital, discard for +2 Diplomacy. +1 Diplomacy to that opponent.' },
    pelerin:     { name: 'Pilgrim', move: 2, upkeep: 1, req: ['T', 2], copies: 3, text: 'On an enemy temple, discard for +2 Diplomacy. +1 Diplomacy to that opponent. Your Embassy only adds to your own gain.' },
    heraut:      { name: 'Herald', move: 0, upkeep: 4, req: ['Ci', 3], text: 'During Income, +1 Diplomacy if you haven’t attacked or been attacked since your last turn. Your Embassy adds nothing to this gain. Stackable.' },
    ambassadeur: { name: 'Ambassador', move: 1, upkeep: 3, req: ['A', 1], copies: 3, text: 'On an enemy capital (except a Tyrant’s): non-aggression pact for as long as it stays there. If it leaves, for any reason, you lose 1 Diplomacy.' },
    colonie:     { name: 'Colony', move: 1, upkeep: 3, req: ['Ci', 1], copies: 3, text: 'On a neutral territory, discard to conquer it and build a camp there.' },
    exploratrice:{ name: 'Explorer', move: 2, upkeep: 2, req: ['P', 2], copies: 3, cotier: true, text: 'On a neutral territory on a different continent from your capital, discard to conquer it and gain 3 gold.' },
    caboteur:    { name: 'Coastal Trader', move: 1, upkeep: 1, req: ['P', 1], copies: 3, cotier: true, text: 'During Income, on a space with an opponent’s port: +3 gold.' },
    caravanier:  { name: 'Caravan Master', move: 1, upkeep: 1, req: ['Ci', 1], copies: 3, text: 'During Income, on a space with an opponent’s city: +3 gold.' },
    espion:      { name: 'Spy', move: 1, upkeep: 0, req: ['Ci', 1], copies: 3, text: 'Once, at any time (even on someone else’s turn): pay 1 gold, secretly look at the top card of the deck and discard it if you want. Then discard the Spy.' },
    partisan:    { name: 'Partisan', move: 2, upkeep: 2, req: ['Ci', 3], text: 'On an enemy territory, discard to convert all enemy buildings there, except temples.' },
    predicateur: { name: 'Preacher', move: 1, upkeep: 2, req: ['T', 3], text: 'On an enemy territory, discard to convert its temple.' },
    gouverneur:  { name: 'Governor', move: 0, upkeep: 5, req: ['F', 4], retire: true, text: 'Discard to convert all enemy buildings on your territories, except temples.' },
    pretresse:   { name: 'Priestess', move: 1, upkeep: 2, req: ['T', 1], copies: 3, text: 'In a battle on her space, if you lose, you reroll your die. One reroll per Priestess.' },
    trebuchets:  { name: 'Trebuchets', move: 1, upkeep: 4, req: ['F', 5], retire: true, text: 'On an enemy territory, can destroy one enemy building, once per turn. This counts as an attack: 1 Diplomacy (unless the target is a Tyrant), and it breaks any pact.' },
    // v1.9.25 - nouvel effet (créateur, 24/10/2026) : +2 défense sur un de vos temples, non cumulable, le bonus
    // reste au temple s'il change de propriétaire. L'ancienne remise d'1 or sur les temples disparaît.
    maitre:      { name: 'Master Builder', move: 1, upkeep: 1, req: ['T', 1], copies: 3, text: 'On one of your temples, discard to give that temple +2 defense.' },
    // v1.9.14 - deux nouvelles unités spéciales (créateur, 28/09/2026)
    calomniateur:{ name: 'Slanderer', move: 2, upkeep: 3, req: ['Ci', 1], copies: 3, text: 'On an enemy territory, discard to make its owner lose 2 Diplomacy (not below 0).' },
    boutefeu:    { name: 'Firebrand', move: 1, upkeep: 1, req: ['Ci', 2], text: 'On an enemy territory, as long as it stays there, all income from that space is blocked for its owner (territory, city, special units).' },
    prelat:      { name: 'Prelate', move: 0, upkeep: 4, req: ['T', 4], text: 'During Income, gain +2 gold for each temple you own (stackable).' },
    // v1.9.19 - nouvelle unité spéciale (créateur, 07/10/2026)
    chroniqueur: { name: 'Chronicler', move: 0, upkeep: 5, req: ['T', 3], text: 'Every time you win a battle, attacking or defending: +1 Diplomacy. Your Embassy doesn’t add to this gain. Stackable.' },
    // v1.9.24 - nouvelle unité spéciale (créateur, 08/10/2026). 2 exemplaires, ports sur vos territoires, 1 point de déplacement minimum (réponses du 08/10)
    cartographe: { name: 'Cartographer', move: 0, upkeep: 3, req: ['P', 3], text: 'Your units and your leader can move straight from one of your ports to another of your ports. This uses up all their movement points.' }
  };


  // v1.9.24 - attaque de base de tous les dirigeants à 3 (créateur, 08/10/2026)
  FOF.LEADERS = {
    odon:    { name: 'Odon the Brave', mod: 3, text: 'Each of his elite units taking part in an assault gives him +1, whether or not he leads it.' },
    gustave: { name: 'Gustave the Wrathful', mod: 3, text: 'All his territories: +1 defense. His cities cost 6 gold.' },
    edouard: { name: 'Édouard the Wise', mod: 3, text: 'Once per game, in peacetime, if he has 5 Diplomacy or less: 1 gold for 1 Diplomacy.' },
    mathilde:{ name: 'Mathilde the Beloved', mod: 3, text: 'Her first city costs 4 gold.' },
    adele:   { name: 'Adèle the Pious', mod: 3, text: 'Her temples cost 6 gold and give +1 defense.' },
    henri:   { name: 'Henri the Strategist', mod: 3, text: 'All his elite units move 1 extra space.' },
    hugues:  { name: 'Hugues the Builder', mod: 3, text: 'His forts and ports cost 1 less gold.' },
    alienor: { name: 'Alinor the Admiral', mod: 3, text: 'Her ports cost 2 gold and give +2 defense.' },
    // v1.9.24 - nouveau pouvoir (créateur, 08/10/2026) : 3 achats au lieu d'1 pendant un tour de
    // recrutement, au prix normal, plafonds d'armée maintenus (réponse du 08/10)
    yusuf:   { name: 'Yusuf the Merchant', mod: 3, text: 'Once per game, he can buy 3 cards from the Market.' },
    zaynab:  { name: 'Zaynab the Wanderer', mod: 3, text: 'All her special units move 1 extra space.' }   // v1.9.24
  };

  FOF.PLAYER_COLORS = [
    { id: 'crimson', name: 'Scarlet', hex: '#c8413a' },
    { id: 'azure',   name: 'Azure',     hex: '#3d7fc4' },
    { id: 'emerald', name: 'Emerald', hex: '#3a9a63' },
    { id: 'gold',    name: 'Gold',       hex: '#d8a431' },
    { id: 'violet',  name: 'Purple',  hex: '#8b5cb8' },
    { id: 'teal',    name: 'Teal', hex: '#2aa3a9' }
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
