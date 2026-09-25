# Crédits - Fields of Fire (version web)

## Illustrations des cartes, des dirigeants et icônes de bâtiments

**Toutes les illustrations des cartes d'unités, les portraits de dirigeants et les six icônes de
bâtiments appartiennent à Nube Games.** Elles ont été produites pour le jeu, nous en détenons tous
les droits d'usage, et **personne n'est à créditer**.

Cela vaut pour les 33 illustrations d'unités (`assets/units/`), les 8 portraits de dirigeants
(`assets/heroes/`), les icônes de bâtiments `bld-*`, les quatre icônes de terrain `biome-*`,
l'icône de diplomatie `dip` et l'icône de territoires `terr` (`assets/icons/`), chacune dans ses
deux teintes quand elle apparaît sur fond clair et sur fond sombre.

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
- *The Field of Dreams* - pauliuw
- *Treasure Hunter* - TAD
- *Once Upon a Time* - TAD
- *Minstrel Dance* - RandomMind
- *King's Feast* - RandomMind
- *The Bard's Tale* - RandomMind
- *Harvest Season* - RandomMind
- *Exploration* - RandomMind
- *Market Day* - RandomMind
- *Rejoicing* - RandomMind
- *The Old Tower Inn* - RandomMind
- *The Old Tower Inn (chiptune)* - RandomMind
- *Victory Theme* - RandomMind
- *Defeat Theme* - RandomMind
- *Lament for a Warrior's Soul* - RandomMind
- *GrassLands Theme* - DST
- *The Ancient Legend* - vitalezzz
- *Adventurer's Path* - vitalezzz
- *Journey With No Name* - iamoneabe

### Combat

- *Battle Theme A* - cynicmusic
- *Battle* - Wolfgang_
- *Medieval Battle* - RandomMind
- *War Theme* - Spring Spring
- *Orcs Victorious* - bobjt
- *Hope* - MintoDog
