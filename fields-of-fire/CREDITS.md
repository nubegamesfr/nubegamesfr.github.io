# Crédits - Fields of Fire (version web)

## Illustrations des cartes, des dirigeants et icônes de bâtiments

**Toutes les illustrations des cartes d'unités, les portraits de dirigeants et les six icônes de
bâtiments appartiennent à Nube Games.** Elles ont été produites pour le jeu, nous en détenons tous
les droits d'usage, et **personne n'est à créditer**.

**Illustrations provisoires (v1.9.21).** Les illustrations générées par IA sont des images de
remplacement le temps de la beta. Elles ne seront pas reprises dans la version finale, qui aura ses
propres illustrations d'artistes. Mention affichée sur l'accueil du jeu et dans `notes.html`.

Cela vaut pour les 40 illustrations d'unités (`assets/units/`, dont la Garde varègue, v1.9.17, le Chroniqueur, v1.9.20, et le Cartographe, v1.9.24), les 10 portraits de dirigeants (dont Yusuf le Marchand, v1.9.19, et Zaynab la Vagabonde, v1.9.24)
(`assets/heroes/`), les icônes de bâtiments `bld-*`, les quatre icônes de terrain `biome-*`,
l'icône de diplomatie `dip` et l'icône de territoires `terr` (`assets/icons/`), chacune dans ses
deux teintes quand elle apparaît sur fond clair et sur fond sombre.

L'illustration de la garnison (`assets/images/garnison.jpg`, v1.9.15) appartient aussi à Nube Games.

La carte historique « Mer de la Manche » (`assets/cartes/manche-*.png`, `js/cartes.js`, v1.9.17) est
tirée des plans dessinés par Nube Games : découpage, noms et terrains sont les leurs.

La texture de planches de bois du fond (`assets/images/table-bois.jpg`, v1.9.13) a été générée
par calcul pour le jeu : aucune photo ni image extérieure n'a servi à la produire.

Les illustrations du domaine public utilisées jusqu'à la version 1.9.8 (peintures et enluminures
reprises sur Wikimedia Commons) ont toutes été remplacées et ne sont plus présentes dans le jeu.

## Points encore à documenter

La couronne (`crown.png`) et le logo Nube Games (`favicon-32`, `favicon.svg`,
`apple-touch-icon`) n'ont pas de source documentée. À confirmer par le créateur avant toute
diffusion commerciale. Toutes les autres images du jeu sont désormais couvertes.

## Formats

| Dossier | Format attendu | Ratio |
|---|---|---|
| `assets/units/<clé>.jpg` | 800 × 488 | 400:244 |
| `assets/heroes/<clé>.jpg` | 576 × 612 | 96:102 |
| `assets/icons/bld-<clé>.png` | hauteur 160, fond transparent | libre |

Les clés sont déclarées dans `js/cards.js` (`HAS_ART`, `HERO_ART`). Déposer un fichier au même nom
suffit, rien d'autre à modifier.

Les icônes de bâtiments existent en deux teintes : `bld-<clé>.png` en encre sombre (#1E1810) pour
les fonds clairs des cartes, `bld-<clé>-or.png` en or (#806934) pour les panneaux sombres et la
carte. Le trait est détouré sur fond transparent.

## Polices

Alegreya Sans (Juan Pablo del Peral), Cinzel (Natanael Gama), Grenze (Omnibus-Type) et
IBM Plex Mono (IBM, Bold Monday), toutes sous licence SIL Open Font License 1.1, hébergées
sur notre propre serveur.

## Musique

Toutes les pistes sont en CC0 (domaine public) et chargées depuis OpenGameArt.
Le crédit n'est pas exigé par cette licence ; il est donné ici par courtoisie.
Voir `js/music.js` pour les adresses exactes.

### Ambiance

- *A Legend Will Rise* - CodeManu
- *Treasure Hunter* - TAD
- *Minstrel Dance* - RandomMind
- *King's Feast* - RandomMind
- *The Bard's Tale* - RandomMind
- *Harvest Season* - RandomMind
- *Exploration* - RandomMind
- *Market Day* - RandomMind
- *Rejoicing* - RandomMind
- *Victory Theme* - RandomMind
- *Lament for a Warrior's Soul* - RandomMind
- *GrassLands Theme* - DST
- *The Ancient Legend* - vitalezzz
- *Adventurer's Path* - vitalezzz
- *Journey With No Name* - iamoneabe
- *Peasant Theme* - nihilocrat (v1.9.19)

### Combat

- *Battle Theme A* - cynicmusic
- *Battle* - Wolfgang_
- *Medieval Battle* - RandomMind
- *War Theme* - Spring Spring
- *Orcs Victorious* - bobjt
- *Hope* - MintoDog
- *Prepare Your Swords* - bojidar-bg (v1.9.19)


## Sons de victoire (v1.9.24)

Trois sons de 4,9 secondes, montés pour le jeu à partir d'enregistrements publiés sous licence
**Creative Commons 0** (domaine public) sur Freesound. Aucune attribution n'est exigée ; les sources
sont notées ici pour la traçabilité.

| Fichier | Sources (identifiant Freesound, auteur) |
|---|---|
| `assets/sons/victoire-militaire.mp3` | 521831 et 521830 « Middle Ages War Cry » (joelcarrsound), 621352 « Male Yelling out a War Cry 3 » (WelvynZPorterSamples), 182112 « Shield / sword hits » (PixelsphereStudios), 376646 « Vikings in battle » (DeadVDI) |
| `assets/sons/victoire-religieuse.mp3` | 869841 « CHOIR_Serbian_Orthodox_Ambience_9 » (SignatureSoundsOrg) |
| `assets/sons/victoire-diplomatique.mp3` | 855457 « Real Trumpet Fanfare 1 » (qubodup) |

Montage : extraits, mixage, fondus, sonie ramenée à -15 LUFS. Choisis d'après leur titre, leur
licence et leur spectrogramme : ils n'ont pas été écoutés avant la mise en ligne.
