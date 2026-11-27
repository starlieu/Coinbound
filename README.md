# Coinbound

Coinbound est un jeu gratuit de trading virtuel multijoueur. Les cours, coins et crédits CB sont fictifs ; aucun paiement ni argent réel n’est échangé.

## Démarrage

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run preview`

Le site utilise JavaScript (ES modules), React et Vite. Le build ne dépend pas de TypeScript.

## Configuration Supabase

Le frontend utilise une clé Supabase publiable, jamais une clé `service_role`. Dans le SQL Editor du projet Supabase, exécute `supabase/schema.sql`, puis `supabase/multiplayer.sql`. Les politiques RLS et les fonctions RPC de ces scripts protègent les soldes et les échanges ; ne les remplace pas par des écritures directes depuis le navigateur.

Configure les fournisseurs OAuth et leurs URL de retour dans Supabase si tu veux les proposer. La connexion invité nécessite également d’activer l’authentification anonyme dans Supabase. Si le backend ou un script SQL manque, l’interface affiche l’erreur au lieu d’ouvrir une session invitée locale sans données.

Les scripts fournissent l’inscription/connexion, le profil, le marché, les achats/ventes de coins, la récompense quotidienne, la création d’équipes et la publication d’annonces. Les équipes sont consultables mais pas encore rejoignables ; les annonces ne disposent pas de parcours d’achat. La collection n’est pas encore implémentée. Les badges sont uniquement affichés et les rôles ne sont pas administrables depuis l’interface. Aucun échange réel n’est possible : les CB sont fictifs.

## Publication

Le workflow `.github/workflows/static.yml` publie le site sur GitHub Pages. Le chemin `/Coinbound/` est configuré pour le build CI. La PWA met en cache la coque du site ; les opérations de jeu nécessitent une connexion et le backend Supabase.
