# Coinbound

Coinbound est un jeu local gratuit de trading simulé et de collection. Les cours, devises, portefeuilles, badges, utilisateurs et annonces sont fictifs ; aucune valeur réelle n'est échangée. Aucun portefeuille blockchain ni service financier n'est connecté.

## Démarrage

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run preview`

Les cours et taux fictifs évoluent toutes les deux secondes. Les données sont conservées dans le `localStorage` du navigateur. Les profils, équipes, classements et annonces restent locaux à cet appareil — il n'y a pas de backend ni de visibilité entre joueurs.

## Rôles locaux

Le premier profil est Owner. Le panneau Admin local permet au Owner/Admin de gérer les rôles, badges et profils enregistrés ; Developer dispose de l'accès en lecture. Les permissions sont une convention d'interface uniquement, sans sécurité serveur. Les utilisateurs ajoutés sont des profils de démonstration dans le stockage local, pas des comptes authentifiés.

## Déploiement

Le workflow `.github/workflows/static.yml` construit et déploie sur GitHub Pages. Le chemin de base `/Coinbound/` est activé en CI. L'application est installable en PWA et inclut un manifest, un service worker et une icône SVG.
