-- Migration : Ajout de la colonne variant_name dans trade_reasons
-- Exécute ce script dans l'éditeur SQL de Supabase

-- 1. Modifier la PRIMARY KEY pour permettre plusieurs variantes d'une même raison sur le même trade
ALTER TABLE trade_reasons DROP CONSTRAINT IF EXISTS trade_reasons_pkey;

-- 2. Ajouter la colonne variant_name (vaut 'Standard' si la raison n'a pas de variante)
ALTER TABLE trade_reasons
  ADD COLUMN IF NOT EXISTS variant_name text NOT NULL DEFAULT 'Standard';

-- 3. Ajouter un ID propre pour identifier chaque ligne
ALTER TABLE trade_reasons
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();

-- 4. Recréer une clé primaire sur l'ID
ALTER TABLE trade_reasons ADD PRIMARY KEY (id);

-- 5. Créer un index unique pour éviter les doublons (même trade, même raison, même variante)
CREATE UNIQUE INDEX IF NOT EXISTS trade_reasons_unique_idx
  ON trade_reasons (trade_id, reason_id, variant_name);
