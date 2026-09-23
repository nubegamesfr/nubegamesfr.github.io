# Fields of Fire — version web (v1.7, prototype)

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
- **Illustrations manquantes** : les cartes Espion, Héraut, Ambassadeur, Pèlerin, Milice, Frondeurs, Charpentier et les dirigeants Hugues et Aliénor reçoivent une **plaque emblème** gravée (fond peint sombre + emblème doré) à la place du placeholder générique. Ce sont des images générées ici, à remplacer par de vraies illustrations quand le créateur en fournira : il suffit de déposer le fichier au même nom dans `assets/units/<clé>.jpg` (400 × 244) ou `assets/heroes/<clé>.jpg` (300 × 316).
