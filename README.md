# Coinbound

Coinbound est un jeu gratuit de trading virtuel multijoueur. Les cours, coins et crédits CB sont fictifs ; aucun paiement ni argent réel n’est échangé.

## Démarrage

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run preview`

Le site utilise JavaScript (ES modules), React et Vite. Le build ne dépend plus de TypeScript. Les comptes, cours du marché, portefeuilles, équipes, annonces et échanges utilisent Supabase ; vérifie la configuration/migrations dans `supabase/`.

## Publication

Le workflow `.github/workflows/static.yml` publie le site sur GitHub Pages. Le chemin `/Coinbound/` est configuré pour le build CI. La PWA et son service worker restent disponibles.
