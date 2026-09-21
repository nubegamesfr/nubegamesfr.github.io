# nubegames.fr

Site officiel de **Nube Games** : une landing page qui présente le studio et prépare le terrain pour **Fields of Fire**, son premier jeu de société (en prototype).

Site 100 % statique (HTML, CSS, JavaScript vanilla), sans framework, sans dépendance, sans tracker. Hébergé gratuitement sur GitHub Pages.

## Structure

```
/
├── index.html              La landing page (une seule page)
├── 404.html                Page d'erreur
├── css/style.css           Tous les styles (tokens de couleur en haut du fichier)
├── js/main.js              Animations + CONFIGURATION du site (en haut du fichier)
├── assets/
│   ├── fonts/              Unbounded, Manrope, Cinzel (auto-hébergées, aucun appel à Google)
│   ├── images/             Logos (SVG vectorisés), couverture du prototype, couronne, image de partage
│   └── icons/              Favicons et icônes
├── CNAME                   Domaine personnalisé pour GitHub Pages
├── .nojekyll               Désactive Jekyll (fichiers servis tels quels)
├── robots.txt / sitemap.xml / site.webmanifest
└── README.md
```

## Modifier le site au quotidien

Tout ce qui change souvent est en haut de `js/main.js` :

```js
const SITE = {
  formId: '…',      // identifiant FormSubmit du formulaire (l'adresse e-mail n'apparaît pas dans le code)
  playUrl: '',      // URL du jeu en ligne : le bouton passe de « Bientôt disponible » à « Jouer »
  playEmbed: false, // true = le jeu s'ouvre directement dans la page (iframe)
  github: ''        // lien GitHub, affiché dans le footer si renseigné
};
```

Dans `index.html`, des commentaires signalent les zones à compléter :

- **Fiche du jeu** (`.facts`) : remplacer « À annoncer » par le nombre de joueurs, la durée…
- **Galerie** (`.reveal-grid`) : remplacer chaque tuile `.locked` par une image (plateau, matériel, règles…).
- **Frise du projet** (`.steps`) : changer les étiquettes « En cours », « À venir »…

Pour ajouter plus tard des screenshots, vidéos, règles ou actualités : ajouter une `<section class="section">` dans `index.html`, en réutilisant les classes existantes (`.kicker`, `.h2`, `.lead`, `.reveal`).

## Tester en local

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

## Mise en ligne sur GitHub Pages

1. Créer un repository sur GitHub (ex. `nubegames.fr`), public (Pages est gratuit sur les repos publics).
2. Y envoyer tout le contenu de ce dossier (à la racine du repo, pas dans un sous-dossier).
3. Repository → **Settings → Pages** :
   - *Source* : **Deploy from a branch**
   - *Branch* : `main` / `/ (root)` → **Save**
4. Toujours dans **Settings → Pages → Custom domain** : saisir `nubegames.fr` → **Save**
   (le fichier `CNAME` du repo contient déjà ce domaine).
5. Recommandé : vérifier le domaine sur GitHub (profil ou organisation → **Settings → Pages → Add a domain**). GitHub fournit un enregistrement TXT à ajouter chez OVH. Cela empêche quiconque d'utiliser le domaine sur un autre repo.

## DNS chez OVH

Espace client OVH → **Noms de domaine → nubegames.fr → Zone DNS**.

**1. Supprimer** les enregistrements existants qui pointent ailleurs pour :
- `nubegames.fr` de type **A** (souvent l'IP de la page d'attente OVH) et **AAAA** s'il y en a ;
- `www.nubegames.fr` de type **A**, **AAAA** ou **CNAME**.

Ne pas toucher aux enregistrements **MX**, **SPF/TXT** ou **SRV** (e-mails).

**2. Ajouter** :

| Sous-domaine | Type  | Cible                  |
|--------------|-------|------------------------|
| *(vide)*     | A     | `185.199.108.153`      |
| *(vide)*     | A     | `185.199.109.153`      |
| *(vide)*     | A     | `185.199.110.153`      |
| *(vide)*     | A     | `185.199.111.153`      |
| *(vide)*     | AAAA  | `2606:50c0:8000::153`  |
| *(vide)*     | AAAA  | `2606:50c0:8001::153`  |
| *(vide)*     | AAAA  | `2606:50c0:8002::153`  |
| *(vide)*     | AAAA  | `2606:50c0:8003::153`  |
| `www`        | CNAME | `<utilisateur-github>.github.io.` |

Remplacer `<utilisateur-github>` par le nom du compte (ou de l'organisation) GitHub qui possède le repo. Le point final est ajouté automatiquement par OVH.

**3. Attendre la propagation** (quelques minutes à quelques heures). GitHub Pages redirige automatiquement `www.nubegames.fr` vers `nubegames.fr`.

**4. HTTPS** : une fois le DNS validé dans **Settings → Pages**, cocher **Enforce HTTPS** (le certificat est gratuit, émis par GitHub ; il peut mettre jusqu'à 24 h à apparaître).

Vérifier depuis un terminal :

```bash
dig nubegames.fr +noall +answer
dig www.nubegames.fr +noall +answer
```

## Formulaire de contact / playtest

Le formulaire (section Playtests) envoie les messages via **FormSubmit** (gratuit, sans compte, sans serveur). Le site n'utilise qu'un identifiant aléatoire (`formId`) : l'adresse de réception n'apparaît nulle part dans le code. Pour changer d'adresse de réception, activer un nouvel identifiant sur formsubmit.co et remplacer `formId`.

## Crédits techniques

- Polices : Unbounded, Manrope, Cinzel (SIL Open Font License), servies depuis le site.
- Logos : vectorisés à partir du logo Nube Games fourni.
- Visuel du jeu : couverture du prototype de Fields of Fire fournie par Nube Games.
- Polices allégées (sous-ensemble latin + accents français) : si un caractère inhabituel s'affiche dans une autre police, régénérer les polices complètes depuis Fontsource.
