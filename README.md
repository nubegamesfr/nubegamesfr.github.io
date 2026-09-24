# nubegames.fr

Site vitrine de Nube Games et hébergement du prototype **Fields of Fire**.
100 % statique (HTML/CSS/JS, sans build), servi par GitHub Pages depuis ce dépôt.

## Organisation

| Chemin | Contenu |
|---|---|
| `index.html` | accueil français |
| `en/index.html` | accueil anglais |
| `mentions-legales.html`, `confidentialite.html`, `conditions.html` | pages légales |
| `404.html` | page d'erreur |
| `css/style.css`, `js/main.js` | feuille de style et script du site |
| `assets/images/` | visuels du site |
| `fields-of-fire/` | le jeu, avec son propre README et son journal de versions |
| `.nojekyll` | désactive Jekyll côté GitHub Pages |
| `robots.txt`, `sitemap.xml` | indexation |

## Réglages du formulaire de contact

Tout est en haut de `js/main.js`, dans l'objet `SITE` :

| Clé | Rôle |
|---|---|
| `supabaseUrl` | URL du projet Supabase |
| `supabaseKey` | clé **publishable** (publique par nature, la sécurité vient des politiques RLS) |
| `contactMail` | adresse affichée en secours si l'envoi échoue |
| `playUrl` | lien vers le jeu |

Le formulaire écrit dans la table `bug_reports` du projet Supabase du jeu, avec
`context.source = 'site'`. Les messages sont donc au même endroit que les signalements du jeu.
**Il n'y a plus de dépendance à FormSubmit ni à aucun service tiers de formulaire.**

## Sécurité des données - à tenir

- **Ne jamais ouvrir la lecture anonyme de `bug_reports`.** La table contient des noms, des adresses
  e-mail et l'état complet de parties. Elle se consulte dans Supabase, derrière un compte.
- Les tables `rooms` et `chat_messages` sont lisibles par les clients anonymes : c'est nécessaire au
  jeu en ligne. N'y écrivez donc rien de sensible, et le jeu prévient les joueurs.
- Le moteur de règles tourne dans le navigateur. Pour une partie en ligne, un client modifié peut
  écrire un état arbitraire : c'est acceptable pour un prototype entre gens qui se connaissent,
  pas pour un classement public.

## Mise en ligne

Déposer le contenu à la racine du dépôt `nubegamesfr/nubegamesfr.github.io`.
GitHub Pages publie automatiquement.
