/* Fields of Fire — données de jeu (règles v1.1) */
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
    A:  { name: 'Ambassade',  cost: 4, def: 0 }
  };
  FOF.BUILDING_ORDER = ['C', 'F', 'P', 'Ci', 'T', 'A'];

  // Unités d'élite : dépl, puissance [P,F,M,Ma], entretien, condition
  FOF.ELITES = {
    milice:     { name: 'Milice paysanne', move: 1, pow: [1,1,1,1], upkeep: 1, req: ['C', 1] },
    frondeurs:  { name: 'Frondeurs', move: 2, pow: [1,1,0,1], upkeep: 1, req: ['C', 1] },
    pillards:   { name: 'Pillards', move: 1, pow: [0,1,1,1], upkeep: 1, req: ['C', 2] },
    ecumeurs:   { name: 'Écumeurs', move: 2, pow: [1,1,1,2], upkeep: 1, req: ['C', 3] },
    brigands:   { name: 'Brigands', move: 2, pow: [1,1,2,1], upkeep: 1, req: ['C', 3] },
    bandits:    { name: 'Bandits', move: 2, pow: [0,2,2,1], upkeep: 1, req: ['C', 4] },
    nomades:    { name: 'Cavaliers nomades', move: 3, pow: [4,1,1,3], upkeep: 3, req: ['C', 5] },
    fantassins: { name: 'Fantassins', move: 1, pow: [2,2,2,2], upkeep: 2, req: ['F', 2] },
    archers:    { name: 'Archers', move: 1, pow: [1,3,3,2], upkeep: 2, req: ['F', 2] },
    piquiers:   { name: 'Piquiers', move: 1, pow: [4,1,1,4], upkeep: 2, req: ['F', 3] },
    inflourde:  { name: 'Infanterie lourde', move: 1, pow: [3,3,3,2], upkeep: 3, req: ['F', 3] },
    arbaletriers:{ name: 'Arbalétriers', move: 1, pow: [3,2,4,3], upkeep: 3, req: ['F', 3] },
    chevaliers: { name: 'Chevaliers', move: 2, pow: [5,3,1,3], upkeep: 3, req: ['F', 3] },
    archmontes: { name: 'Archers montés', move: 2, pow: [4,3,2,3], upkeep: 3, req: ['F', 4] },
    cuirassiers:{ name: 'Cuirassiers', move: 2, pow: [6,3,2,2], upkeep: 3, req: ['F', 4] },
    garde:      { name: 'Garde royale', move: 1, pow: [4,4,4,4], upkeep: 4, req: ['F', 5] }
  };

  // Unités spéciales : dépl, entretien, condition ('D' = diplomatie), texte
  FOF.SPECIALS = {
    charpentier: { name: 'Charpentier', move: 1, upkeep: 1, req: ['C', 1], text: 'Le territoire où il se trouve gagne +1 en défense quand vous le défendez. Il reste en jeu.' },
    corbeau:     { name: 'Corbeau messager', move: 4, upkeep: 1, req: ['Ci', 1], text: 'Prend la mer sans port. Sur une capitale adverse : +1 diplomatie, puis défausse.' },
    emissaire:   { name: 'Émissaire', move: 1, upkeep: 2, req: ['Ci', 2], text: 'Sur une capitale adverse : +2 diplomatie, puis défausse.' },
    pelerin:     { name: 'Pèlerin', move: 1, upkeep: 2, req: ['T', 2], text: "Sur un temple adverse : +1 diplomatie pour vous et pour son propriétaire, puis défausse." },
    heraut:      { name: 'Héraut', move: 1, upkeep: 1, req: ['D', 7], text: 'Posé sur la capitale. À la collecte, +1 diplomatie si vous n’avez pas attaqué au tour précédent.' },
    ambassadeur: { name: 'Ambassadeur', move: 1, upkeep: 2, req: ['D', 3], text: 'Sur une capitale adverse (hors Tyran) : pacte de non-agression tant qu’il y reste.' },
    colonie:     { name: 'Colonie', move: 1, upkeep: 3, req: ['Ci', 1], text: 'Sur un territoire neutre : vous le prenez et y bâtissez un campement gratuit, puis défausse.' },
    exploratrice:{ name: 'Exploratrice', move: 1, upkeep: 3, req: ['P', 2], text: 'À la collecte, sur un neutre d’un autre continent : vous le prenez et gagnez 1 or, puis défausse.' },
    caboteur:    { name: 'Caboteur', move: 1, upkeep: 1, req: ['P', 1], text: 'À la collecte, sur une case avec le port d’un adversaire : +2 or.' },
    caravanier:  { name: 'Caravanier', move: 1, upkeep: 1, req: ['Ci', 1], text: 'À la collecte, sur une case avec la cité d’un adversaire : +2 or.' },
    espion:      { name: 'Espion', move: 1, upkeep: 1, req: ['Ci', 1], text: 'Au recrutement, payez 1 or pour regarder en secret la carte du dessus du deck.' },
    partisan:    { name: 'Partisan', move: 1, upkeep: 2, req: ['Ci', 2], text: 'Sur un territoire adverse : convertit un de ses aménagements (sauf un temple). Puis défausse.' },
    predicateur: { name: 'Prédicateur', move: 1, upkeep: 2, req: ['T', 3], text: 'Sur un territoire adverse : convertit son temple. Puis défausse.' },
    gouverneur:  { name: 'Gouverneur', move: 1, upkeep: 3, req: ['Ci', 4], text: 'Sur votre territoire : convertit tous les aménagements adverses. Puis défausse.' },
    pretresse:   { name: 'Prêtresse', move: 1, upkeep: 2, req: ['T', 4], text: 'Lors d’un combat sur sa case, vous relancez votre dé une fois (automatique si vous perdez).' },
    trebuchets:  { name: 'Trébuchets', move: 1, upkeep: 5, req: ['F', 5], text: 'Quand vous attaquez sa case ou une case voisine : détruit un aménagement adverse, même si vous perdez.' }
  };

  FOF.LEADERS = {
    odon:    { name: 'Odon le Brave', mod: 1, text: 'Quand il attaque avec des unités d’élite, chacune gagne +1.' },
    gustave: { name: 'Gustave l’Irascible', mod: 2, text: 'Ses campements, forts et ports : +1 défense. Ses cités coûtent 6 or.' },
    edouard: { name: 'Edouard le Sage', mod: 1, text: 'À la collecte, s’il a 3 de diplomatie ou moins : 3 or pour +1 diplomatie (1 fois).' },
    mathilde:{ name: 'Mathilde la Bien-Aimée', mod: 1, text: 'Ses cités coûtent 4 or et donnent +1 défense.' },
    adele:   { name: 'Adèle la Pieuse', mod: 2, text: 'Ses temples coûtent 6 or et donnent +1 défense.' },
    henri:   { name: 'Henri le Stratège', mod: 1, text: 'Toutes ses unités d’élite se déplacent d’1 case de plus.' },
    hugues:  { name: 'Hugues le Bâtisseur', mod: 2, text: 'Ses aménagements coûtent 1 or de moins (minimum 1). À l’essai.' },
    alienor: { name: 'Aliénor l’Amirale', mod: 1, text: 'Ports à 2 or, +1 or par port. Ses unités embarquent depuis toute côte voisine d’un de ses ports. À l’essai.' }
  };

  FOF.PLAYER_COLORS = [
    { id: 'crimson', name: 'Écarlate', hex: '#c8413a' },
    { id: 'azure',   name: 'Azur',     hex: '#3d7fc4' },
    { id: 'emerald', name: 'Émeraude', hex: '#3a9a63' },
    { id: 'gold',    name: 'Or',       hex: '#d8a431' },
    { id: 'violet',  name: 'Pourpre',  hex: '#8b5cb8' },
    { id: 'teal',    name: 'Sarcelle', hex: '#2aa3a9' }
  ];

  FOF.isElite = function (key) { return !!FOF.ELITES[key]; };
  FOF.unitDef = function (key) { return FOF.ELITES[key] || FOF.SPECIALS[key]; };
})(window.FOF = window.FOF || {});
