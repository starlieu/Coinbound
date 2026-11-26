# Coinbound

Jeu de simulation de trading avec monnaies et cryptomonnaies virtuelles, cartes à collectionner, équipes et marketplace. Aucune valeur réelle.

## Démarrer le site

Prérequis : Node.js 20 ou plus récent.

```bash
npm install
npm run dev
```

Vite affiche l’adresse locale à ouvrir dans le navigateur. Pour vérifier le build de production :

```bash
npm run build
npm run preview
```

## État actuel

La première interface React + TypeScript est une maquette jouable avec des données de démonstration : tableau de bord, portefeuille fictif, marchés, progression, défi et navigation responsive. Les boutons affichent des retours de démonstration ; il n’existe pas encore de compte, de backend ni de transactions persistantes. Toutes les valeurs sont fictives et sans valeur réelle.

Le socle inclut un manifeste et un service worker de cache pour l’installation PWA. Les icônes dédiées, les tests, l’authentification et les fonctionnalités de jeu restent à construire.

## PWA et application mobile

Le site reste une application web React autonome, installable comme PWA sur les navigateurs compatibles. Pour une future application Android, la piste privilégiée est un client React Native/Expo avec des composants natifs et une couche partagée pour les types, règles métier et accès API. L’interface React web ne sera pas automatiquement réutilisable comme interface native.
