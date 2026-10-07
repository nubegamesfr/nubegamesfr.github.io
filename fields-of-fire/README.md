# Fields of Fire - version web (beta 1.9.21, prototype)

Jeu 100 % statique (HTML/CSS/JS, sans build). Servi par GitHub Pages sur https://nubegames.fr/fields-of-fire/ (dossier `fields-of-fire/` du repo `nubegamesfr.github.io`).

## v1.9.21 - notes de mise à jour, illustrations provisoires (07/10/2026)

- Nouvelle page publique `notes.html` (« Note de mise à jour », lien en bas de l'accueil) : toutes
  les versions, de la plus récente à la plus ancienne, en langage de joueur. **À compléter à chaque
  nouvelle version**, en même temps que ce README.
- Mention mise en évidence sur l'accueil et en tête de `notes.html` : les illustrations générées par
  IA sont provisoires, ne seront pas reprises, les illustrations définitives viendront plus tard.

## v1.9.20 - retours du créateur sur la 1.9.19 (07/10/2026)

- Frontières de mer des cartes générées : plus de segments droits. Le trait suit la vraie limite
  entre les zones, lissé en courbe douce ; les zones elles-mêmes ne bougent plus.
- Musiques : retrait de The Lord's Court, Merchants and Sea Salt, A Knight's Challenge, The Woodsman
  et Crowded Pub. Exploration et Harvest Season, préférées du créateur, passent environ deux fois
  plus souvent que les autres morceaux d'exploration.
- Illustration du Chroniqueur.

## v1.9.19 - retours du créateur du 07/10/2026

- **Règles** : capitale à +3 en défense (au lieu de +2) ; victoire religieuse à 5 + joueurs temples
  (un de moins) ; victoire diplomatique à 12, quel que soit le nombre de joueurs. Des unités
  spéciales seules (ni élite ni dirigeant) attaquées hors de leur territoire sont défaites d'office,
  sans dé ; un territoire garde son dé et sa défense passive. Les pertes de diplomatie (attaque,
  rupture de pacte, unités spéciales détruites) sont détaillées avant l'assaut et dans la bataille.
- **Collecte** : revenus moins solde vont au trésor, en plus ou en moins. Si le trésor passe sous 0,
  le joueur reprend des pièces sur ses unités (nouvelle fenêtre : on clique les pièces, on peut les
  relâcher) ; toute unité touchée déserte, toutes ses pièces peuvent être reprises. Faute de pièces,
  le trésor reste négatif : ni recrutement ni construction. Avant, seule la recette du tour comptait.
- **Unités** : Exploratrice en phase militaire dès son arrivée, +3 or ; déplacements (Nomades et
  Partisan 2 ; Bandits, Pillards, Écumeurs, Brigands 1 ; Héraut, Gouverneur, Prélat 0) ; Écumeurs,
  Brigands, Bandits et Fantassins en 3 exemplaires ; nouvelle spéciale **Chroniqueur** (0 déplacement,
  entretien 5, 3 temples, 2 exemplaires : +1 diplomatie par bataille gagnée, en attaque comme en
  défense, sans l'Ambassade, cumulable). Deck : 93 cartes.
- **Dirigeants** : nouveau **Yusuf le Marchand** (étoile 2, Caboteurs et Caravaniers +1 déplacement et
  5 or, à débloquer par e-mail avec Hugues et Alinor) ; Gustave : +1 défense sur tous ses territoires,
  cités à 6 ; Hugues : forts et ports à -1 (les campements reviennent au prix normal).
- **Interface** : en phase militaire, un clic sur une unité ouvre le même menu circulaire que le
  dirigeant (se déplacer, attaquer, pacifier, effet) ; une pile s'ouvre d'abord en bulles
  individuelles. Carte historique : pions, pastilles et menus 20 % plus grands, et plus rien ne sort
  du cadre. Sept musiques CC0 de plus (six d'ambiance, une de combat).
- **Cartes générées** : frontières de mer droites, redessinées depuis les vraies limites des zones ;
  le large est rattaché à la mer voisine, plus aucun trait ne s'arrête au milieu de l'eau.

## v1.9.18 - statistiques (04/10/2026)

- Une partie n'est enregistrée et comptée que si elle dure au moins 5 minutes, dépasse le tour 1 et compte au moins un
  joueur humain (décision du 04/10 : les tables humains + bots comptent désormais, les tables 100 %
  bots jamais). Chaque joueur porte `bot` dans `players`. `stats.html` applique les mêmes conditions
  aux lignes déjà en base et indique le nombre de bots par partie.

## v1.9.17 - playtest du 30/09, cartes historiques (01/10/2026)

- **Cartes historiques** : le salon propose deux familles, cartes procédurales (générées) et cartes
  historiques (dessinées). Première carte : **Mer de la Manche**, une version par nombre de joueurs
  (21, 28, 35 et 42 territoires), découpage validé par le créateur le 01/10/2026. Le graphe est dans
  `js/cartes.js`, la forme exacte des territoires dans `assets/cartes/manche-N.png` (trame
  d'étiquettes lue par le rendu). Capitales tirées au hasard, jamais voisines. En ligne, la carte est
  choisie par l'hôte. Les statistiques notent la carte jouée (champ `victory_cfg.carte`).
- **Cartes générées** : un continent ne peut plus contenir autant de cases qu'il en faut pour la
  victoire militaire (au plus 7 + joueurs). Il faut donc 3 continents à 3 et 4 joueurs, 3 ou 4 à
  5 joueurs, 4 à 6 joueurs. Plafond de mer à l'écran relevé à 60 % (décision du créateur).
- **Règles (playtest)** : Prêtresse et Cavaliers nomades à 2 d'entretien ; Prélat : 4 temples,
  entretien 3, +2 or par temple à la collecte ; Caravanier et Caboteur : +3 or ; Boutefeu : bloque
  tout le revenu que le maître tire de la case (territoire, cités, Caravanier / Caboteur) ;
  Gouverneur : se défausse depuis n'importe quelle case, mer comprise ; nouvelle élite
  **Garde varègue** (3 ports, entretien 3, 3/3/3/5, déplacement 1, 2 exemplaires, deck à 87 cartes).
- **Corrections** : le Pèlerin prenait le territoire (son effet enchaînait sur celui de la Colonie) ;
  un pion faisait des allers-retours à chaque action quand un joueur avait deux piles sur la carte ;
  le bouton de l'Espion ne répondait plus dès qu'une fenêtre était ouverte (il passe au-dessus), et
  en ligne son usage pouvait se perdre si le joueur actif jouait au même moment.

## v1.9.16 - sept mini-jeux pendant le tour des autres (29/09/2026)

- Le coin sous la chronique devient une rangée d'onglets ; chaque jeu garde sa partie en cours quand
  on passe à un autre, et ses records dans le navigateur. Rien ne touche à l'état de la partie.
- **Chausse-trapes** (démineur, déjà là), **Le Moulin** (jeu de la marelle contre l'ordinateur,
  trois niveaux), **Trésor** (façon 2048, des oboles à la Couronne), **Blasons** (23 picross tirés
  des icônes du jeu, tous solubles par la seule logique des lignes), **Mémoire des armées** (paires
  d'illustrations d'unités), **Taquin** (une illustration à reconstituer, 3×3 à 5×5), **Réussite de
  la Cour** (patience du Golf aux couleurs latines ; le Roi et le 1 se suivent, sinon moins de 1 %
  des donnes se gagnent).
- Code : `js/minijeu.js` (hôte) et un fichier par jeu (`js/mj*.js`).
- Vérifié : 76 assertions sur les règles (moulin, 2048, réussite), 60 parties complètes de moulin
  entre niveaux sans coup illégal, chaque jeu joué dans le navigateur sans erreur JS.

## v1.9.15 - habillage, pause, Chausse-trapes, nouvelles icônes (29/09/2026)

- **Règles (décisions du créateur)** : le seuil de victoire diplomatique est aligné sur le seuil
  religieux (6 + nombre de joueurs) ; une capitale conquise qui garde 3 aménagements redevient un
  territoire ordinaire et le vainqueur en rase un. Dévaster : nouvelle définition au glossaire
  (et la fenêtre de conquête ne dit plus que le territoire redevient neutre).
- **Habillage** : « Encre et braise » par défaut, « Feutre et or » au choix (bouton écu dans l'en-tête
  et sur l'accueil, mémorisé dans le navigateur). Le bois et cuir est remplacé.
- **Icônes** : nouvelles icônes des aménagements, des terrains, de la diplomatie et des territoires
  (dessins du créateur, détourés, deux teintes, trait épaissi pour la carte).
- **Illustrations** : Calomniateur, Boutefeu, et la garnison dans la fenêtre de combat.
- **Pause** en partie locale (bouton dans l'en-tête) : les bots s'arrêtent, la musique baisse.
- **Chausse-trapes** : un démineur médiéval sous la chronique pendant le tour des autres
  (trois niveaux, records gardés dans le navigateur).
- **Son** : la musique de combat ne joue que pendant la fenêtre de combat ; plus de bruits de
  bataille, seulement les dés ; luth en majeur si l'on gagne, en mineur si l'on perd.
- **Corrections** : la fiche du joueur n° 2 affichait la sienne ; en réduisant la main, le plateau
  rétrécissait (la pile du deck cachée gardait sa hauteur) ; revenu par tour sur chaque bannière ;
  fiches des joueurs coupées entre 900 et 1280 px.
- **Bots** : ils acceptent de devenir Tyran après le tour 25 s'ils ne visent pas la diplomatie
  (avec le nouveau seuil, des tables entières restaient figées à 0).
- Vérifié : 71 assertions de scénarios, 120 parties de bots à 3-6 joueurs (120 terminées, 0 erreur
  moteur, 0 violation d'invariant), partie de 4 bots dans le navigateur sans erreur JS.

## v1.9.14 - retours de playtest, nouvelles cartes, bulles de pions (28/09/2026)

- **Règles (décisions du créateur)** : la cession volontaire d'un aménagement est supprimée (la
  cession forcée d'un territoire après la défaite d'un dirigeant reste) ; dévaster donne le
  territoire au vainqueur, tous ses aménagements rasés, coût inchangé ; pacifier convertit un seul
  aménagement par tour, le moins cher d'abord ; Ambassade à 8 or ; Edouard : 1 or pour +1
  diplomatie ; Aliénor devient **Alinor**, ses ports coûtent 2 or et donnent +2 défense.
- **Cartes** : Corbeau messager (entretien 2, déplacement 3), Émissaire (3), Ambassadeur (3),
  Héraut (4). Espion : texte corrigé. Nouvelles spéciales **Calomniateur** (Cité ×1, entretien 3,
  déplacement 2 : défaussé sur un territoire adverse, son propriétaire perd 2 diplomatie, sans
  descendre sous 0) et **Boutefeu** (Cité ×2, entretien 1, déplacement 1 : tant qu'il reste sur
  un territoire adverse, la cité de la case ne rapporte rien à la collecte). Quinze cartes passent
  à 3 exemplaires : deck de 85 cartes, 35 modèles. Calomniateur et Boutefeu n'ont pas encore
  d'illustration (couronne provisoire).
- **Carte** : une bulle par joueur et par case (dirigeant, sinon l'unité la plus puissante),
  puissance totale en haut à gauche, nombre de pions en bas à droite. Au survol, à tout moment,
  une fenêtre montre les cartes du groupe. Bulles légèrement plus petites.
- **Interface** : diplomatie affichée « actuelle / seuil » pour chaque joueur ; bouton Pacifier
  indique l'aménagement visé ; catalogue avec le nombre d'exemplaires ; glossaire nettoyé.
- **Son** : Old Tower Inn, Field of Dreams, Once Upon a Time et Defeat Theme retirés ; volumes
  égalisés (-16 LUFS) ; fondu enchaîné entre les pistes ; « Exploration » et les pistes de la
  même humeur reviennent plus souvent ; musique de combat plus douce à l'entrée et à la sortie ;
  nouveau bruit de dés (secousse, rebonds, arrêt).
- Vérifié : 63 assertions de scénarios, 120 parties de bots à 3-6 joueurs sans erreur moteur ni
  violation d'invariant.

## v1.9.13 - texture de bois, fonds gris corrigés (27/09/2026)

- **Nouvelle texture de bois** pour la table : longues planches de noyer, veinage fin, joints
  décalés (`assets/images/table-bois.jpg`, 2048 × 1024, 230 Ko, raccord parfait sur les quatre
  bords, générée pour le jeu). Elle remplace le bruit dessiné en CSS.
- **Rectangle gris dans les fenêtres** : la barre des boutons en bas de chaque fenêtre gardait la
  couleur de l'ancien thème. Corrigé, ainsi que les autres restes gris : panneau des joueurs,
  menu contextuel de la carte, tchat, bulles, menu circulaire du dirigeant, champs de saisie.

## v1.9.12 - bots réécrits, direction artistique « table de guerre », catalogue (27/09/2026)

- **Bots entièrement réécrits** (`js/bot.js`) : un plan par tour (la voie de victoire la plus
  proche, avec un penchant pour celle du dirigeant), une économie tournée vers ce plan, des assauts
  préparés (les élites convergent puis frappent ensemble), une garnison quand la capitale est
  menacée, le harcèlement de celui qui court vers la victoire diplomatique, et le refus de lui
  offrir des cessions. Mesuré sur 120 parties à 3-6 joueurs, moitié nouveaux / moitié anciens
  bots : **92 % des victoires pour les nouveaux**, médiane 13 tours (parties humaines : 15).
  Ce ne sont pas des mesures d'équilibrage.
- **Direction artistique « table de guerre »** : plateau de bois, sous-mains de cuir cousus,
  ferrures de laiton, sceau de cire pour les actions décisives, feutre vert pour le marché.
  Tout en CSS, aucun fichier ajouté.
- **Accueil** : un catalogue montre les 8 dirigeants et les 33 cartes du deck (filtre élites /
  spéciales).
- **Règles (décisions du créateur)** : Pèlerin - l'Ambassade ne s'ajoute qu'au gain de celui qui
  joue la carte, pas au gain reçu ; Héraut et Prêtresse cumulables ; si l'hôte d'un ambassadeur
  devient Tyran, le propriétaire de l'ambassadeur perd 1 ; seuls les aménagements que l'on a bâtis
  soi-même peuvent être cédés (le bâtisseur est désormais noté sur chaque aménagement).

## v1.9.11 - retours de playtest et décisions du créateur (27/09/2026)

- **Un seul type de mer** : la « mer classique » est supprimée (case à cocher retirée de l'accueil et
  du salon). Toutes les cartes suivent la règle stricte des 4 débarquements. Mesuré sur 400 cartes
  (100 par effectif) : 0 hors règle ; génération médiane 36 à 295 ms, pire cas 1,5 s à 4 joueurs.
- **Écran de génération** : carte d'hexagones qui se lève en vagues sous une rose des vents.
- **Ambassadeur** : si l'ambassadeur n'est plus sur la capitale, quelle qu'en soit la raison
  (rappel, licenciement, solde impayée, destruction, déménagement de la capitale hôte), son
  propriétaire perd 1 diplomatie. La rupture par une attaque garde son régime (-2 / +1).
- **Trébuchets** : un tir est une attaque contre le propriétaire de l'aménagement : 1 diplomatie
  (sauf contre un Tyran), rupture d'un pacte, et il compte comme « avoir attaqué / été attaqué »
  (Ambassade, Héraut, Edouard). Le joueur choisit l'aménagement visé, coût affiché. Peut viser
  l'aménagement d'un tiers sur le territoire adverse.
- **Partisan** : convertit tout sauf les temples.
- **Maître d'œuvre, Prélat** : cumulables (deux exemplaires = double effet).
- **Espion** : gratuit, sans entretien. Usage unique, à tout moment, même au tour d'un autre joueur :
  1 or, il regarde la carte du dessus du deck, on la défausse ou non, puis l'Espion est défaussé.
  Bouton dans le panneau des joueurs.
- **Héraut** : bloqué aussi si l'on a été attaqué depuis son tour précédent (signalé en playtest),
  et l'Ambassade n'ajoute plus rien à son gain.
- **Ambassade** : le relais tenait compte des attaques du tour précédent mais pas de celles du tour
  en cours. Attaquer puis livrer un Émissaire le même tour ne donne plus le +1.
- **Bug corrigé - construction bloquée** : la fenêtre de confirmation de remplacement s'ouvrait
  sans savoir quel aménagement remplacer ; l'interface plantait à chaque affichage et la phase de
  construction restait bloquée. Même défaut sur la confirmation de déménagement de capitale.
- **Passage en Tyran annoncé à tous** : l'annonce se perdait souvent, pour deux raisons. Les effets
  visuels comparaient l'état d'une partie par sa graine aléatoire, qui change à chaque lancer de
  dés : après un combat, toutes les annonces étaient sautées. Et le Tyran n'était cherché que dans
  les 4 dernières lignes de chronique. Il est maintenant détecté sur l'état des joueurs, affiché
  aussi avec les animations réduites, et se ferme d'un clic.
- **Pions en mer hors de la carte** : une mer coupée par le bord du cadre plaçait ses pions contre
  ce bord. Le bord compte désormais comme une frontière, et les pions restent dans le cadre
  (1 500 pions posés en mer sur 30 cartes : 0 hors cadre).

## v1.9.10 - règle stricte des 4 débarquements, rappel de l'Ambassadeur (27/09/2026)

- **Mers (mer élargie)** : la règle des 4 débarquements devient stricte. Une carte dont une mer
  ouvre sur plus de 4 territoires n'est plus jamais servie : on en génère une autre. Pendant ce
  temps, un écran « Génération de la carte en cours » s'affiche ; personne n'est renvoyé du salon.
  Mesuré sur 400 cartes en mer élargie : 44 hors règle en 1.9.9 (toutes à 4 joueurs, soit 44 %
  des cartes à 4), 0 en 1.9.10. Conséquence : à 4 joueurs, toutes les cartes ont 3 continents (les
  cartes à 2 continents n'étaient jamais conformes).
- **Mer classique** : la règle stricte n'y est PAS appliquée pour l'instant. Aucune carte conforme
  n'a été obtenue à 4 joueurs en mer classique (1 500 essais par nombre de continents) : la rendre
  stricte bloquerait le lancement. Comportement de la 1.9.9 conservé en attendant une décision.
- **Ambassadeur** : le rappeler de la capitale de l'autre coûte désormais 1 diplomatie à son
  propriétaire, si ce départ fait tomber le pacte. Texte de la carte et glossaire mis à jour.

## v1.9.9 - illustrations propres, pacte de l'Ambassadeur, retours de playtest (25/09/2026)

- **Illustrations** : les 33 cartes d'unités, les 8 portraits de dirigeants et les 6 icônes de
  bâtiments sont remplacés par des visuels appartenant à Nube Games. Plus aucune œuvre extérieure
  dans le jeu : `CREDITS.md`, les mentions légales, les CGU et les pages du site sont mis à jour.
  Second lot : les quatre icônes de terrain (`biome-*`), l'icône de diplomatie (`dip`, un traité scellé,
  qui remplace le pictogramme SVG) et l'icône de territoires (`terr`, une bannière
  au lion, qui remplace `terr.svg`, supprimé) ; le campement et l'ambassade sont redessinés.
  Formats : unités 800 × 488, dirigeants 576 × 612, icônes détourées sur fond transparent en deux
  teintes (#1E1810 pour les fonds clairs, #806934 pour les fonds sombres).
- **Accueil refait** : l'écran restait collé en haut de la page avec un grand vide dessous, les deux
  cartes de mode n'avaient pas la même hauteur (celle du jeu local se terminait dans le blanc), et
  les pictogrammes étaient des émojis au milieu d'un jeu entièrement dessiné. Désormais : bloc centré
  verticalement (`align-content: safe center`, qui repart du haut dès que le contenu dépasse),
  jaquette agrandie avec cadre doré et titre en dégradé, deux cartes de même hauteur finissant toutes
  les deux par une action, pictogrammes pris dans les icônes du jeu, bouton principal doré au lieu du
  bleu (limité à `#setup`), et les trois paragraphes de mentions regroupés dans un pied de page
  compact. Le bandeau musique ne recouvre plus la jaquette sur téléphone.
- **Ambassadeur - pacte** : le pacte de non-agression ne tient plus que tant qu'un ambassadeur se
  trouve sur la capitale de l'autre, comme l'annonçait déjà le texte de la carte. Dès qu'il part,
  meurt ou que la capitale déménage, le pacte tombe SANS perte de diplomatie : ce n'est pas une
  trahison. Corrige le bug signalé en playtest (conquérir un territoire donnait un point de
  diplomatie à l'adversaire au titre d'une rupture de pacte dont l'ambassadeur était déjà parti).
- **Ambassadeur - recrutement** : condition passée de « 3 diplomatie » à « 1 ambassade ». Un Tyran
  ne peut toujours pas le recruter.
- **Ambassade** : le remplacement d'aménagement permettait d'en poser une hors de sa capitale, et
  à un Tyran d'en avoir une. Les deux contrôles manquants sont ajoutés.
- **Remplacer un aménagement** demande désormais confirmation (coût, perte sèche de l'ancien,
  avertissement si c'est un temple).
- **Drapeau de capitale** retiré de la carte : le contour doré et la couronne suffisent.
- **Musique** : volume nettement baissé. La réglette était linéaire et montait jusqu'à pleine
  échelle ; elle suit maintenant une courbe perceptive plafonnée (-8 dB au maximum, environ -25 dB
  au réglage par défaut, soit 15 dB sous la version précédente). Piste « Exploring Town » retirée.
- **Fiche de dirigeant** : cliquer son propre portrait ouvrait la fiche du joueur ACTIF quand ce
  n'était pas son tour en ligne. C'est bien la sienne désormais.
- **Mers - RÈGLE NOUVELLE du créateur** : *une mer ne doit pas permettre de débarquer sur plus de
  4 territoires à la fois* (`FOF.MAX_DEBARQUEMENTS`). Le découpage ne vise donc plus une taille en
  cases mais un nombre de débarquements. Conséquence acceptée par le créateur : **une mer peut ne
  border aucune terre** - c'est de la pleine mer, on y navigue, on n'y débarque pas. C'est ce qui
  rend possibles les coupes au large, qui isolent forcément de telles poches.
  Trois corrections rendaient la chose faisable : les traits peuvent désormais partir de n'importe
  quel sommet de la mer visée (auparavant seulement d'un trait existant, donc jamais du large) ;
  une coupe se juge sur la liste complète des mers et non sur la seule plus grande (deux mers à
  égalité bloquaient toute coupe) ; une fusion de petites mers ne peut plus dépasser la règle des 4.
  Mesuré sur 200 cartes : **0 échec de génération, 85 % des cartes respectent la règle** (max 4),
  les 15 % restantes gardent une mer à 5. Toutes à 4 ou 5 joueurs : certaines côtes n'offrent
  aucun tracé possible. Dans ce cas la meilleure carte rencontrée est servie plutôt que de refuser
  de lancer la partie (`FOF.dernierePireDeb` donne le chiffre servi).
  La plus grande mer passe de 26 cases à 10 au maximum ; comptez ~165 ms pour générer une carte.

## Modes
- **Jeu local** : 3 à 6 joueurs sur un seul écran, sauvegarde automatique dans le navigateur.
- **Jeu en ligne** : un joueur crée un salon (code à 5 caractères, lien `?salon=CODE`), les autres le rejoignent ; chacun choisit nom, couleur et dirigeant ; l'hôte lance à 3–6 joueurs. Seul le joueur dont c'est le tour (ou qui doit prendre une décision) peut agir ; les autres voient la partie se mettre à jour (~1,5 s).

## Serveur (Supabase, projet `fields-of-fire`, région Paris)
Config dans `js/config.js` (URL + clé publique « publishable », faite pour être visible).
- `rooms` : salons (code, hôte, sièges, état complet de la partie en JSON, `version` pour les écritures optimistes).
- `game_stats` : une ligne par partie (local ou en ligne), mise à jour à chaque tour : mode, joueurs, dirigeants, durée, tours, terminée/abandonnée, vainqueur, type de victoire, or moyen, tyrans, détail par joueur (JSON).
- Vues : `game_summary` (une ligne lisible par partie) et `leader_stats` (taux de victoire, or moyen… par dirigeant).
- Tableau de bord : `stats.html` (exports CSV parties / dirigeants / joueurs). Export aussi possible depuis Supabase → Table Editor → Export CSV.

Limites du prototype : pas de comptes, quiconque a le code d'un salon peut y écrire ; les données de stats sont anonymes (pas de noms de joueurs).

## Fichiers
`index.html` · `stats.html` · `css/style.css` · `js/` : config, data (cartes et dirigeants), map (génération), engine (règles), cards (rendu des cartes/fiches), board (carte organique en canvas), net (salons en ligne), stats (statistiques), ui (interface de partie), main (accueil, salon) · `assets/` (illustrations des cartes et héros, icônes).

## Ambiance (v1.3)
- **Musique** (`js/music.js`) : playlist de 6 morceaux de taverne de RandomMind (OpenGameArt, domaine public CC0), lecture aléatoire, volume / coupure / morceau suivant dans l'en-tête, réglages mémorisés. Démarre au premier clic (règle des navigateurs). Lit `music/<fichier>.mp3` s'il existe, sinon la source OpenGameArt. Non synchronisée entre joueurs.
- **Effets sonores** (`js/sfx.js`) : synthétisés en Web Audio (aucun fichier) : or, recrutement, pas, construction, dés, victoire/défaite de combat, conquête, phase, tour, victoire finale, erreur. Bouton 🔔 pour les couper.
- **Animations** (`js/fx.js`) : pions qui glissent, bandeau de phase et de tour, +/− or et diplomatie flottants, onde sur les territoires conquis ou bâtis, cartes distribuées dans le marché, pop pour les grands événements (conquête, capitale tombée, Tyran, pacte, élimination), bulles pour le reste, confettis de victoire. Respecte « réduire les animations » du système.
- **Carte** : couleurs et motifs distincts par terrain (épis, arbres, hachures, roseaux) + pastilles d'icônes.

## v1.4 (retours de playtest)
- Carte redessinée : rendu haute définition, terrains illustrés (montagnes, forêts, champs de blé, mares et roseaux), mer avec hauts-fonds et écume, ombre portée des terres, carte plus resserrée (moins d'océan vide).
- Territoires teintés à la couleur de leur propriétaire (bordure épaisse), drapeau de la couleur du joueur sur chaque capitale.
- Noms des cases au survol seulement (infobulle : terrain, propriétaire, aménagements).
- Déplacement : les cases atteignables clignotent en blanc. Zoom à la molette et déplacement de la carte à la souris.
- Construction : un maillet en bois apparaît sur les territoires où l'on peut bâtir.
- Grand pop « +N or » à la collecte.
- Textes agrandis (~15 %), joueurs en bandeau horizontal, chronique repliable (bouton 📜).
- Sons à chaque clic selon l'action (maillet, cloche de fin de tour, pièces, carte, pas, épée…).
- Statistiques remises à zéro le 22/09/2026.

## v1.5 (playtest 2)
- **Règles** : zone de recrutement à 5 cartes ; carte libre (dirigeants seulement non adjacents, 2 × joueurs + 4 zones de mer, aucune isolée) ; le dirigeant sur la case d'attaque ou attaquée combat d'office (avertissement + annulation possible), et il peut attaquer des unités.
- **Tour** : la collecte est une fenêtre de début de tour (bilan détaillé : territoires, cités, commerce, solde de chaque unité), puis « Passer au recrutement ». Le stepper n'affiche plus que Recrutement / Militaire / Construction.
- **Recrutement** : cartes achetables qui clignotent, cases de déploiement qui clignotent en blanc, « Suivant » bloqué tant que l'unité n'est pas déployée ou annulée, un clic hors zone ne perd plus l'achat, marché réouvrable à tout moment.
- **Militaire** : menu circulaire autour du dirigeant (Se déplacer / Conquérir / Attaquer) ; fenêtre d'attaque mise en avant ; bataille avec les unités engagées et dés 3D ; grand pop-up « Tyran ».
- **Carte** : nouvel habillage façon carte de jeu de rôle (mer bleue vive, plages et falaises, forêts denses de feuillus et sapins, montagnes enneigées, prairies fleuries avec champs, marécages à mares et roseaux, cadre doré) ; sur grand écran, joueurs à gauche et chronique à droite pour agrandir la carte ; aménagements au centre du territoire, maillet au centre, défense au survol, petites animations (vagues, voiliers, renard en forêt, oiseaux), bouton ✨ pour couper les animations, flammes autour du portrait du joueur, aperçu de la carte au survol de ses unités.
- **Son** : volumes séparés musique / bruitages, playlist fantasy + musique épique pendant les combats (CC0 : CodeManu, pauliuw, TAD, RandomMind, cynicmusic, Wolfgang_), charge + épées + dés.
- **Chronique** au ton médiéval ; Partisan : choix de l'aménagement à convertir ; Temple marqué « victoire religieuse ».
- **Tchat** des parties en ligne (table `chat_messages`) et **🐞 Signaler un bug** (table `bug_reports`, état de la partie joint). **La lecture de cette table reste réservée au tableau de bord Supabase** : `bugs.html` est une page publique, elle ne doit jamais pouvoir afficher des noms ou des adresses e-mail.
- **Bots** (`js/bot.js`) : en partie locale, chaque siège peut être « 👤 Humain » ou « 🤖 Ordinateur » (bouton « Jouer contre des bots » pour tout remplir d’un coup). En ligne, l’hôte peut « Ajouter un bot » dans le salon ; les bots sont joués par le navigateur de l’hôte (si l’hôte quitte, ils s’arrêtent). Heuristiques : conquête des neutres, recrutement rentable, attaques à ≥ 60 % de chances sans devenir Tyran, cités / temples / forts, remplacement de bâtiments quand il n’y a plus de place. Simulation : 100 % des parties entre bots se terminent (médiane ≈ 20 tours).
- **Adaptation à la fenêtre** : colonnes latérales dès 1280 px, marché et tapis compactés sur les petites hauteurs, en-tête qui passe sur deux lignes sous 1100 px, carte à la largeur du téléphone.
- **Animations** : ombres de nuages, reflets sur la mer, fumée des capitales, pions du joueur actif qui respirent, bouton principal qui brille, joueur actif qui luit. Mer plus propre (dégradé net + petites vagues dessinées). Flammes autour du portrait **seulement pour un Tyran**. Drapeau de capitale à gauche des aménagements (plus de recouvrement).
- **Poids réseau** : la chronique stockée dans l’état est limitée aux 80 dernières entrées (état ≈ 14 Ko au lieu de 30 Ko) pour ménager le quota Supabase.

## v1.6 (playtest 3)
- **Icônes dessinées** (`js/icons.js`) à la place des émojis : botte (déplacement), bannière (conquête), épées (attaque), bouclier, couronne, marteau, parchemin, livre, cartes, dé, heaume (bots)…
- **Bots** : bouton d'en-tête « Bots : normal / rapide / très rapide » (le très rapide correspond à l'ancienne vitesse).
- **Didacticiel** facultatif de 3 tours (case à cocher au lancement, `js/tutorial.js`) : tour de l'interface (carte, tapis, chronique, glossaire, deck), puis une bulle par phase. Ne bloque rien, s'arrête d'un clic.
- **Glossaire** et **Deck** ouvrables à tout moment depuis l'en-tête (l'en-tête reste cliquable par-dessus les fenêtres).
- **Bilan de fin de partie** (bouton dans la fenêtre de victoire) : territoires, record de territoires, temples, cités, forts, or, diplomatie, recrues, constructions, batailles livrées et gagnées.
- **Placement** : drapeau de capitale, aménagements et pions sont posés à un endroit qui tient entièrement dans la case (`Board.place`).
- **Abandon automatique** d'une partie sans action depuis 48 h (reprise locale et salon en ligne), la partie est alors marquée abandonnée dans les statistiques.
- **Animations de la carte** : poissons qui sautent, papillons dans les prairies, lucioles dans les marécages, plus d'oiseaux, de vagues et de voiliers.
- **Attaque à plusieurs unités** : déjà le fonctionnement du jeu ; toutes vos élites présentes sur la case attaquent ensemble, et le dirigeant s'y joint s'il est là.
- **Équilibrage v1.6** : Aliénor l'Amirale gagnait 42 % des parties simulées à 4 joueurs (attendu 25 %). Ports à 2 or (au lieu de 1), modificateur de combat 1 (au lieu de 2) et suppression du +1 par élite contre un territoire côtier → 33 %. Hugues le Bâtisseur mesuré à 25 % : inchangé.
- **v1.6 · combat en mer retiré** : plus aucun combat dans une zone de mer, pour personne (Aliénor comprise). Il ne lui reste que ses ports à 2 or, le +1 or par port et l'embarquement élargi ; mesurée à 32 % de victoires sur 1 200 parties simulées à 4 joueurs.

## v1.7 (playtest 4)
- **Salon en ligne : drapeaux « prêt »** - chaque joueur se déclare prêt ; l'hôte est prêt d'office (c'est lui qui lance) et les bots comptent comme prêts. Le bouton « Lancer la partie » reste bloqué tant que tout le monde ne l'est pas, et affiche le compte (`2/3 prêts`). Vérifié aussi côté serveur, pour qu'un salon ne puisse pas démarrer par un lancement concurrent.
- **Fenêtres qui restent ouvertes** - le glossaire, le deck, l'aide, le bilan de fin et la fiche de dirigeant ne sont plus refermés (ni rouverts) par l'action d'un autre joueur. Le contenu des fenêtres n'est réécrit que s'il a réellement changé.
- **Icône de diplomatie** : deux mains qui se serrent (`icons.js`, entrée `branch`), partout où la diplomatie apparaît.
- **Construction** : les pions et la couronne de capitale ne captent plus le clic pendant la phase de construction (`#tokens.nohit`), le marteau reste accessible sur toute la case.
- **Trois cartes bon marché** (à l'essai) : Milice paysanne et Frondeurs (élites, 1 campement, 1 or d'entretien) et Charpentier (spéciale, 1 campement, +1 en défense sur son territoire, reste en jeu). De quoi recruter dès les premiers tours.
- **Abandon** : bouton drapeau blanc dans l'en-tête, avec confirmation. Le joueur est traité comme éliminé - territoires neutres, aménagements détruits, unités défaussées. Possible même pendant le tour d'un autre.
- **Animations d'attente** : quand un autre joueur (ou un bot) réfléchit, sa fiche s'anime (reflet, trois points, phase en cours), son pion prend un halo, la carte reçoit un liseré à sa couleur et le bandeau du bas indique depuis combien de temps on attend.
- **Correction de la défausse** : acheter une carte n'empêche plus d'en défausser une (le programme les avait liées à tort ; la règle écrite autorise les deux, dans n'importe quel ordre).
- **Menu radial** : icône de déplacement réduite pour tenir dans la pastille.
- **Edouard le Sage** : confirmation avant l'achat de diplomatie - coût, trésor avant/après, et avertissement renforcé au tour 1 (« avec 1 or il vous restera peu de quoi recruter »).
- **Illustrations manquantes** : les cartes Espion, Héraut, Ambassadeur, Pèlerin, Milice, Frondeurs, Charpentier et les dirigeants Hugues et Aliénor reçoivent de vraies **peintures du domaine public**, recadrées au format des cartes (La Tour, Holbein, Bosch, Bruegel, Titien, Sandys - détail dans `CREDITS.md`). Plus aucune carte ne tombe sur le placeholder couronne. Pour en remplacer une : déposer un fichier au même nom dans `assets/units/<clé>.jpg` (400 × 244) ou `assets/heroes/<clé>.jpg` (300 × 316), rien d'autre à toucher.

## v1.7a - correction de l'IA (23/09/2026)
- **Le bot ignorait cinq cartes** : Pillards, Charpentier, Espion, Prêtresse, Trébuchets n'étaient jamais achetés,
  faute de valeur dans sa grille d'évaluation (`js/bot.js`, `cardValue`). Corrigé : les cinq sont désormais
  évaluées, et les élites bon marché valent davantage quand l'armée est vide (comportement plus humain en début de partie).
- **Style de la carte** : bouton dans l'en-tête qui bascule entre **Enluminure** (par défaut) et
  **Estampe sur bois**, choix mémorisé dans le navigateur (`fof-mapstyle`).
  Le traitement est appliqué au calque du terrain uniquement (`styleBase` dans `board.js`), une seule
  fois par carte : le style fait partie de la clé de cache de `prepare`, donc changer de style suffit
  à le redessiner. Les couleurs des joueurs sont peintes sur le calque `overlay`, elles ne sont donc
  jamais mangées par le traitement - c'était la réserve principale sur l'estampe.
  Ajouter un style : une entrée dans `FOF.MAP_STYLES` et une branche dans `styleBase`.
- Aucune règle du jeu n'a changé. Voir `claude/06_analyse_equilibrage.md` dans le projet pour la campagne
  d'équilibrage complète (environ 40 000 parties simulées, 3 à 6 joueurs) et les six correctifs proposés,
  qui eux attendent validation.

## v1.8 (playtest 5)
- **Didacticiel au premier plan** : l'encart passe au-dessus de tout (`z-index: 200`) et se remet
  tout seul si un rendu de l'interface l'a masqué (`tutorial.js`, boucle `tick`). Il ne se ferme
  plus que par ses propres boutons.
- **Marché : les cartes ne disparaissent plus.** Pendant le recrutement la zone reste toujours
  affichée. Le bouton « Regarder la carte ▾ » la passe en vignettes (nom + illustration, 473 px → 234 px
  de haut) au lieu de la masquer ; « Agrandir les cartes ▴ » ou un clic sur les vignettes la rouvre.
  Après un achat elle se réduit d'elle-même, le temps de déployer l'unité. Le bouton
  « Voir la zone de recrutement » devient inutile et a été retiré.
  *Note technique : la classe de réduction s'appelle `compact` et non `mini` - `.mini` est déjà
  la vignette d'unité du tapis et imposait sa largeur de 112 px à toute la barre.*
- **Le marché tient toujours à l'écran** (`fitMarket` dans `ui.js`) : après chaque rendu, si les
  cinq cartes dépassent la hauteur du plateau, la barre est resserrée par paliers - `tight`
  (illustration et texte réduits), puis `tighter` (texte et pied de carte masqués), puis `row1`
  (les cinq sur une seule rangée, plafond de hauteur et défilement annulés). Mesuré sur douze
  formats de 1920×1080 à 390×844 : aucune carte ni bouton « Acheter » coupé, contre 5 cartes et
  3 boutons inaccessibles auparavant sur téléphone. Les grands écrans gardent la carte pleine.
- **Quitter ≠ abandonner.** Le drapeau blanc ouvre désormais trois choix : continuer,
  **mettre en pause 48 h** (la partie et le salon sont conservés, on reprend avec le même code ;
  sans action pendant 48 h elle est abandonnée par la règle existante) ou abandonner tout de suite.
- **Remise à zéro du prototype (23/09/2026)** : les parties commencées avant cette date sont closes
  (`FOF.PURGE_BEFORE` dans `net.js`, appliqué aussi à la sauvegarde locale), et `stats.html`
  ne compte plus que les parties postérieures. Rien n'est supprimé dans la base : le tableau des
  dirigeants est simplement recalculé côté page à partir des parties retenues, au lieu de lire la
  vue `leader_stats` qui agrège tout depuis toujours.
- **Équilibrage appliqué** (validé par le créateur le 23/09/2026, premier correctif de règles depuis
  le début du projet) :
  - correction d'un défaut : le plafond de diplomatie suivait la valeur figée 10 alors que le seuil
    de victoire est une variable, donc tout seuil au-dessus de 10 était inatteignable ;
  - nouvel aménagement **Ambassade** (4 or, capitale uniquement, hors limite des 2 aménagements) :
    aucune diplomatie passive, mais **+1 sur chaque gain obtenu par une action**, à condition de
    n'avoir ni attaqué ni été attaqué depuis son tour précédent. Nouveau drapeau `raidedNow` /
    `raidedLast` sur le joueur, tourné en début de tour comme `attackedNow` / `attackedLast` ;
  - **Edouard** : 4 or, une seule fois par partie (`p.edouardUsed`), et seulement en paix ;
  - **Mathilde** : plus de bonus de défense ; la remise ne vaut que pour sa première cité ;
  - **Odon** (bonus d'élites indépendant de sa présence), **Hugues** (remise limitée aux campements,
    forts et ports), **Gustave** (cités à 5 or), **Aliénor** (plus de revenu de port, embarquement
    ramené au port) ;
  - **seuils de victoire** : militaire 8 + joueurs, religieuse 6 + joueurs, diplomatique 4 + joueurs.
  Vérifié par 1 600 parties simulées sur les fichiers livrés : répartition des victoires
  36/35/29 à 3 joueurs, 36/38/26 à 4, 27/37/36 à 5, 20/38/42 à 6. La voie militaire reste faible à
  6 joueurs - voir `claude/06_analyse_equilibrage.md` §16.3.

## v1.8b - audit d'interface (23/09/2026)

Un contrôle automatisé (`audit_ui.js`, hors dépôt) parcourt 7 formats d'écran × 12 états de
l'interface (accueil, création de partie, collecte, recrutement, marché plein et réduit, militaire,
construction, glossaire, deck, règles, fenêtre de départ) et vérifie, pour chaque élément
cliquable : présence à l'écran, atteignabilité réelle au clic (`elementFromPoint`), taille minimale
de cible tactile, débordement horizontal de la page, fenêtres plus hautes que l'écran, textes
tronqués. **524 signalements au départ, 0 à l'arrivée.**

Défauts réels trouvés et corrigés :

- **Boutons de zoom inaccessibles pendant toute la phase de recrutement, à toutes les tailles**
  y compris 1920×1080 : le marché (`z-index: 5`) passait devant `.board-tools` (`z-index: 3`).
  Ils passent devant et se décalent de la hauteur du marché, publiée dans `--mh` par `renderMarket` ;
  sous 900 px de large ils remontent en haut du plateau.
- **Marché réduit à 238 px de large sur une tablette de 768 px**, avec des cartes de 38 px et des
  boutons de 22 : la largeur du marché suivait son contenu. Ancrée à celle du plateau
  (`.market { width: 100% }`), plus colonnes en `1fr` sous 900 px.
- **Bouton « Fermer » des Règles sous le bord de l'écran** en 1366×768 et plus bas : la barre
  d'actions des fenêtres est désormais collante en bas de la fenêtre.
- **Bouton de phase hors écran sur téléphone et tablette** - le bouton le plus utilisé du jeu se
  trouvait en bas d'une page défilante. Ancré au bas de l'écran sous 900 px.
- Cibles tactiles sous 30 px (contrôles audio, case du didacticiel, pastille de couleur, boutons
  des cartes) : plancher de 34 px sous 820 px de large, et boutons de carte empilés.

Faux positifs volontairement ignorés par l'audit : éléments du plateau recouverts par une fenêtre
ouverte (c'est le but), et éléments sous la ligne de flottaison de l'accueil, qui est un formulaire
défilant.

## v1.8c - jouabilité sur téléphone (23/09/2026)

Essai réel d'un tour complet en 390×844 : l'en-tête occupait deux rangées de onze boutons, la barre
des joueurs était coupée au bord de l'écran, la carte tombait à 366×275 pendant que le tapis en
prenait 400, le menu radial couvrait un tiers de la carte, et la page défilait. Mise en page
téléphone ajoutée sous 620 px :

- en-tête sur une seule rangée qui défile latéralement, libellés masqués sur les boutons à icône ;
- barre des joueurs en rangée défilante avec accroche (`scroll-snap`), une fiche par écran ;
- tapis compacté : pistes en compteurs chiffrés (`1/11`) au lieu des rangées de cases, portrait et
  textes réduits - la carte passe de 351 à 439 px de haut et la page ne défile plus ;
- menu radial resserré (boutons 50 px, rayon 54 au lieu de 78) ;
- légende des terrains masquée, bandeau de phase réduit et remonté au-dessus des cartes ;
- commandes de l'en-tête réordonnées (chronique, règles, deck, glossaire, style d'abord ; ambiance
  et signalement de bug à la fin) avec un voile au bord droit pour signaler que la rangée continue.

**Tactile** (`ui.js`) : le zoom n'existait qu'à la molette et le déplacement de la carte qu'à la
souris. Ajout du pincement à deux doigts (mesuré : ×2 à l'écartement, retour au resserrement) et du
glissement à un doigt quand la carte est zoomée (150 px de glissement → 150 px de défilement), avec
suppression du clic parasite en fin de glissement.

Limite connue : en portrait la carte est bornée par la largeur de l'écran (366 px), quelle que soit
la hauteur disponible. Les territoires font une quarantaine de pixels - jouable, mais le zoom et le
pincement sont utiles. Le paysage reste plus confortable.

## v1.8d - retours de playtest (23/09/2026)

- **Le bas de la carte restait caché par le marché réduit.** La carte était dimensionnée sur toute
  la hauteur du plateau alors que les vignettes en recouvrent le bas : 450 px de carte masqués en
  1500×950. `renderBoard` dessine maintenant le marché d'abord et retranche sa hauteur de la place
  disponible quand il est réduit ; le retrait `margin-top: -10px` est annulé dans cet état.
  Mesuré : 0 px masqué en 1500×950, 1366×768 et 390×844 (contre 450, 425 et 273).
- **Réglages regroupés.** Le style de carte, la vitesse des bots et les animations occupaient chacun
  un bouton dans un en-tête déjà chargé. Un seul bouton `Réglages` (engrenage) ouvre une fenêtre qui
  porte les trois, avec le choix courant mis en évidence ; elle reste ouverte pendant qu'on bascule,
  ce qui permet de comparer les deux styles de carte. Les contrôles de musique et de bruitages
  l'ont rejointe : l'en-tête passe de 14 à 8 boutons. `musicUI()` ne fait que rafraîchir des
  contrôles existants, la fenêtre les pose donc elle-même avec `musicHTML()` à chaque rendu.

## v1.8e - retours de playtest (23/09/2026)

- **La page clignotait pendant le tour d'un bot.** Deux causes cumulées, toutes deux introduites en
  v1.8 : `fitMarket` retirait puis remettait ses paliers à chaque rendu (le marché s'affichait en
  grand avant de se resserrer), et le marché était dessiné même pendant le tour d'un bot, donc sa
  hauteur alternait entre 447 px et 0 à chaque passage. Le palier est désormais mis en cache
  (clé : taille du plateau + nombre de cartes), le contenu du marché n'est réécrit que s'il a
  changé, et le marché n'apparaît plus que pour le joueur dont c'est le tour. Mesuré sur 160 relevés
  pendant que les bots jouent : une seule taille de carte, une seule hauteur de marché.
- **Le SVG passait devant les territoires en phase de construction.** `nohit` ne neutralisait que
  les pions (`.tk`) : la **bannière de capitale** et les icônes d'aménagement captaient toujours le
  clic, donc impossible de bâtir sur la case sous une bannière - ce qui bloquait la partie une fois
  une capitale déplacée. Toute la couche `#tokens` est maintenant neutralisée en phase de
  construction, le maillet excepté. Vérifié : un clic au centre exact de la bannière atteint la
  carte et ouvre le panneau de construction.
- **L'Ambassade s'affichait « undefined »** dans le menu de construction : la table des effets
  n'avait pas d'entrée pour elle. Les six aménagements ont désormais un libellé court et une
  infobulle complète au survol.
- **Nouvelle page `bugs.html`** : les signalements envoyés depuis le jeu ne partent pas par e-mail,
  ils sont écrits dans la table `bug_reports`. Cette page les lit, les affiche avec leur contexte
  (version, mode, phase, tour, salon, navigateur, état de la partie) et les exporte en CSV. Si la
  base refuse la lecture, la page le dit explicitement : il faut alors ouvrir une policy SELECT sur
  `bug_reports`, ou consulter la table depuis le tableau de bord Supabase.
- Textes des dirigeants remis en accord avec le moteur : Gustave (cités à 5 or), Edouard (4 or, une
  fois par partie, en paix), Mathilde (première cité seulement), Hugues (campements, forts, ports),
  Aliénor (ports à 2 or), Odon (bonus indépendant de sa présence).
