# Coinbound

Coinbound est un jeu gratuit de trading virtuel multijoueur. Les cours, coins et crédits CB sont fictifs ; aucun paiement ni argent réel n’est échangé.

## Démarrage

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run preview`

Le site utilise JavaScript (ES modules), React et Vite. Le build ne dépend pas de TypeScript.

## Configuration Supabase

Le frontend utilise une clé Supabase publiable, jamais une clé `service_role`. Pour une installation neuve, exécute dans le SQL Editor, dans cet ordre : `supabase/schema.sql`, `supabase/multiplayer.sql`, puis `supabase/multiplayer_moderation.sql`. Pour un projet ayant déjà les deux premiers scripts, exécute seulement le nouveau script `multiplayer_moderation.sql`. Les politiques RLS et les fonctions RPC protègent les soldes, les achats et les actions de modération ; ne les remplace pas par des écritures directes depuis le navigateur.

Configure les fournisseurs OAuth et leurs URL de retour dans Supabase si tu veux les proposer. La connexion invité nécessite également d’activer l’authentification anonyme dans Supabase. Si le backend ou un script SQL manque, l’interface affiche l’erreur au lieu d’ouvrir une session invitée locale sans données.

Après application des trois scripts, les joueurs peuvent créer et rejoindre des équipes, publier des annonces et acheter celles des autres avec des CB fictifs transférés côté serveur. Les annonces peuvent être signalées ; les rôles `Moderator`, `Admin` et `Owner` ont une file de modération, et seuls `Admin`/`Owner` peuvent gérer les rôles selon leurs permissions. Les décisions de modération et changements de rôle sont audités côté serveur.

La modération couvre actuellement les annonces. Les sanctions de compte et la modération de chat ne sont pas implémentées; la collection non plus. Les badges sont affichés, mais leur gestion n’est pas encore disponible. Aucune valeur réelle n’est échangée.

## Publication

Le workflow `.github/workflows/static.yml` publie le site sur GitHub Pages. Le chemin `/Coinbound/` est configuré pour le build CI. La PWA met en cache la coque du site ; les opérations de jeu nécessitent une connexion et le backend Supabase.
