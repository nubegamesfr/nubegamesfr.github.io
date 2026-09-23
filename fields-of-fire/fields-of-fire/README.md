# Fields of Fire — version web (v1.8, prototype)

Jeu 100 % statique (HTML/CSS/JS, sans build). Servi par GitHub Pages sur https://nubegames.fr/fields-of-fire/ (dossier `fields-of-fire/` du repo `nubegamesfr.github.io`).

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
- **Tchat** des parties en ligne (table `chat_messages`) et **🐞 Signaler un bug** (table `bug_reports`, état de la partie joint ; lecture réservée au tableau de bord Supabase).
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
- **Salon en ligne : drapeaux « prêt »** — chaque joueur se déclare prêt ; l'hôte est prêt d'office (c'est lui qui lance) et les bots comptent comme prêts. Le bouton « Lancer la partie » reste bloqué tant que tout le monde ne l'est pas, et affiche le compte (`2/3 prêts`). Vérifié aussi côté serveur, pour qu'un salon ne puisse pas démarrer par un lancement concurrent.
- **Fenêtres qui restent ouvertes** — le glossaire, le deck, l'aide, le bilan de fin et la fiche de dirigeant ne sont plus refermés (ni rouverts) par l'action d'un autre joueur. Le contenu des fenêtres n'est réécrit que s'il a réellement changé.
- **Icône de diplomatie** : deux mains qui se serrent (`icons.js`, entrée `branch`), partout où la diplomatie apparaît.
- **Construction** : les pions et la couronne de capitale ne captent plus le clic pendant la phase de construction (`#tokens.nohit`), le marteau reste accessible sur toute la case.
- **Trois cartes bon marché** (à l'essai) : Milice paysanne et Frondeurs (élites, 1 campement, 1 or d'entretien) et Charpentier (spéciale, 1 campement, +1 en défense sur son territoire, reste en jeu). De quoi recruter dès les premiers tours.
- **Abandon** : bouton drapeau blanc dans l'en-tête, avec confirmation. Le joueur est traité comme éliminé — territoires neutres, aménagements détruits, unités défaussées. Possible même pendant le tour d'un autre.
- **Animations d'attente** : quand un autre joueur (ou un bot) réfléchit, sa fiche s'anime (reflet, trois points, phase en cours), son pion prend un halo, la carte reçoit un liseré à sa couleur et le bandeau du bas indique depuis combien de temps on attend.
- **Correction de la défausse** : acheter une carte n'empêche plus d'en défausser une (le programme les avait liées à tort ; la règle écrite autorise les deux, dans n'importe quel ordre).
- **Menu radial** : icône de déplacement réduite pour tenir dans la pastille.
- **Edouard le Sage** : confirmation avant l'achat de diplomatie — coût, trésor avant/après, et avertissement renforcé au tour 1 (« avec 1 or il vous restera peu de quoi recruter »).
- **Illustrations manquantes** : les cartes Espion, Héraut, Ambassadeur, Pèlerin, Milice, Frondeurs, Charpentier et les dirigeants Hugues et Aliénor reçoivent de vraies **peintures du domaine public**, recadrées au format des cartes (La Tour, Holbein, Bosch, Bruegel, Titien, Sandys — détail dans `CREDITS.md`). Plus aucune carte ne tombe sur le placeholder couronne. Pour en remplacer une : déposer un fichier au même nom dans `assets/units/<clé>.jpg` (400 × 244) ou `assets/heroes/<clé>.jpg` (300 × 316), rien d'autre à toucher.

## v1.7a — correction de l'IA (23/09/2026)
- **Le bot ignorait cinq cartes** : Pillards, Charpentier, Espion, Prêtresse, Trébuchets n'étaient jamais achetés,
  faute de valeur dans sa grille d'évaluation (`js/bot.js`, `cardValue`). Corrigé : les cinq sont désormais
  évaluées, et les élites bon marché valent davantage quand l'armée est vide (comportement plus humain en début de partie).
- **Style de la carte** : bouton dans l'en-tête qui bascule entre **Enluminure** (par défaut) et
  **Estampe sur bois**, choix mémorisé dans le navigateur (`fof-mapstyle`).
  Le traitement est appliqué au calque du terrain uniquement (`styleBase` dans `board.js`), une seule
  fois par carte : le style fait partie de la clé de cache de `prepare`, donc changer de style suffit
  à le redessiner. Les couleurs des joueurs sont peintes sur le calque `overlay`, elles ne sont donc
  jamais mangées par le traitement — c'était la réserve principale sur l'estampe.
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
  *Note technique : la classe de réduction s'appelle `compact` et non `mini` — `.mini` est déjà
  la vignette d'unité du tapis et imposait sa largeur de 112 px à toute la barre.*
- **Le marché tient toujours à l'écran** (`fitMarket` dans `ui.js`) : après chaque rendu, si les
  cinq cartes dépassent la hauteur du plateau, la barre est resserrée par paliers — `tight`
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
  6 joueurs — voir `claude/06_analyse_equilibrage.md` §16.3.

## v1.8b — audit d'interface (23/09/2026)

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
- **Bouton de phase hors écran sur téléphone et tablette** — le bouton le plus utilisé du jeu se
  trouvait en bas d'une page défilante. Ancré au bas de l'écran sous 900 px.
- Cibles tactiles sous 30 px (contrôles audio, case du didacticiel, pastille de couleur, boutons
  des cartes) : plancher de 34 px sous 820 px de large, et boutons de carte empilés.

Faux positifs volontairement ignorés par l'audit : éléments du plateau recouverts par une fenêtre
ouverte (c'est le but), et éléments sous la ligne de flottaison de l'accueil, qui est un formulaire
défilant.
