-- Initialisation des familles système permanentes pour tous les utilisateurs existants
-- Exécuter ce script dans l'éditeur SQL de Supabase après la migration

INSERT INTO reason_families (user_id, name, icon, "order", slug)
SELECT id, 'Raisons Biais — Avant Position', '🧭', 0, 'biais_avant' FROM auth.users
UNION ALL
SELECT id, 'Raisons Biais — Après Dénouement', '🔄', 1, 'biais_apres' FROM auth.users
UNION ALL
SELECT id, 'Raisons POI — Avant Position', '🎯', 2, 'poi_avant' FROM auth.users
UNION ALL
SELECT id, 'Raisons POI — Après Dénouement', '🔄', 3, 'poi_apres' FROM auth.users
UNION ALL
SELECT id, 'Raisons Entrée — Avant Position', '⚡', 4, 'entree_avant' FROM auth.users
UNION ALL
SELECT id, 'Raisons Entrée — Après Dénouement', '🔄', 5, 'entree_apres' FROM auth.users
ON CONFLICT (user_id, slug) DO UPDATE
SET name = EXCLUDED.name, icon = EXCLUDED.icon, "order" = EXCLUDED.order;
