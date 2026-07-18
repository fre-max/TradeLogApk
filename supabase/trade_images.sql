-- 1. Nettoyage de l'ancienne table (ATTENTION : efface les données existantes)
DROP TABLE IF EXISTS step_images CASCADE;

-- 2. Création de la nouvelle table d'images structurées
CREATE TABLE trade_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid REFERENCES trades(id) ON DELETE CASCADE NOT NULL,
  phase text NOT NULL CHECK (phase IN ('avant', 'apres')),
  context text NOT NULL CHECK (context IN ('superieur', 'intermediaire', 'inferieur', 'global')),
  url text NOT NULL,
  source text NOT NULL DEFAULT 'upload' CHECK (source IN ('upload', 'telegram', 'url')),
  storage_path text,
  created_at timestamptz DEFAULT now() NOT NULL,
  -- On s'assure de ne pas avoir de doublons pour un même emplacement
  UNIQUE(trade_id, phase, context)
);

-- 3. Row Level Security (RLS)
ALTER TABLE trade_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_trade_images" ON trade_images FOR ALL USING (
  EXISTS (
    SELECT 1 FROM trades 
    WHERE trades.id = trade_images.trade_id 
    AND trades.user_id = auth.uid()
  )
);
