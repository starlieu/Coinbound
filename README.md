# Coinbound

Coinbound est un jeu gratuit de trading virtuel multijoueur. Les cours, coins et crédits CB sont fictifs ; aucun paiement ni argent réel n’est échangé.

## Démarrage

- Python 3 suffit pour lancer un serveur local :
  - `python3 -m http.server 8000`
  - ouvre `http://localhost:8000`

Le site est écrit en HTML5, CSS et JavaScript natifs avec des modules ES. Il n’a pas de dépendances à installer ni d’étape de compilation.

## Configuration Supabase

Le frontend utilise une clé Supabase publiable, jamais une clé `service_role`. Dans le SQL Editor du projet Supabase, exécute `supabase/schema.sql`, puis `supabase/multiplayer.sql`. Les politiques RLS et les fonctions RPC de ces scripts protègent les soldes et les échanges ; ne les remplace pas par des écritures directes depuis le navigateur.

Configure les fournisseurs OAuth et leurs URL de retour dans Supabase si tu veux les proposer. La connexion invité nécessite également d’activer l’authentification anonyme dans Supabase. Si le backend ou un script SQL manque, l’interface affiche l’erreur au lieu d’ouvrir une session invitée locale sans données.

Les scripts fournissent l’inscription/connexion, le profil, le marché, les achats/ventes de coins, la récompense quotidienne, la création d’équipes et la publication d’annonces. Les équipes sont consultables mais pas encore rejoignables ; les annonces ne disposent pas de parcours d’achat. La collection n’est pas encore implémentée. Les badges sont uniquement affichés et les rôles ne sont pas administrables depuis l’interface. Aucun échange réel n’est possible : les CB sont fictifs.

## Publication

Publie la racine du dépôt avec GitHub Pages, sans étape de build. La PWA met en cache la coque du site ; les opérations de jeu nécessitent une connexion et le backend Supabase.
