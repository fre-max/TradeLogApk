-- 1. Nettoyage des anciennes tables (ATTENTION : efface les données existantes du catalogue)
DROP TABLE IF EXISTS trade_reasons CASCADE;
DROP TABLE IF EXISTS reason_variants CASCADE;
DROP TABLE IF EXISTS reason_catalog CASCADE;
DROP TABLE IF EXISTS reason_families CASCADE;

-- 2. Création de la table des familles de raisons (ex: Entrée, TP, Vitesse...)
CREATE TABLE reason_families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  icon text,
  "order" int DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- 3. Création du nouveau catalogue lié aux familles
CREATE TABLE reason_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  family_id uuid REFERENCES reason_families(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- 4. Création des variantes (conservé pour la rétrocompatibilité ou une utilisation future)
CREATE TABLE reason_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reason_id uuid REFERENCES reason_catalog(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  image_url text,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- 5. Création de la table de jointure Trades <-> Raisons (pour la sélection multiple)
CREATE TABLE trade_reasons (
  trade_id uuid REFERENCES trades(id) ON DELETE CASCADE NOT NULL,
  reason_id uuid REFERENCES reason_catalog(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (trade_id, reason_id)
);

-- 6. Row Level Security (RLS)
ALTER TABLE reason_families ENABLE ROW LEVEL SECURITY;
ALTER TABLE reason_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE reason_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_reasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_families" ON reason_families FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "owner_catalog" ON reason_catalog FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "owner_variants" ON reason_variants FOR ALL USING (
  EXISTS (
    SELECT 1 FROM reason_catalog 
    WHERE reason_catalog.id = reason_variants.reason_id 
    AND reason_catalog.user_id = auth.uid()
  )
);
CREATE POLICY "owner_trade_reasons" ON trade_reasons FOR ALL USING (
  EXISTS (
    SELECT 1 FROM trades 
    WHERE trades.id = trade_reasons.trade_id 
    AND trades.user_id = auth.uid()
  )
);
