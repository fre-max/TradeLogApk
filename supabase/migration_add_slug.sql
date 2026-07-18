-- Migration : Ajout de la colonne slug pour identifier les familles système
ALTER TABLE reason_families ADD COLUMN IF NOT EXISTS slug text;

-- Ajouter une contrainte unique sur (user_id, slug) pour permettre le UPSERT
ALTER TABLE reason_families DROP CONSTRAINT IF EXISTS reason_families_user_slug_key;
ALTER TABLE reason_families ADD CONSTRAINT reason_families_user_slug_key UNIQUE (user_id, slug);
