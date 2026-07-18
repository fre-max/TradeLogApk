-- ─────────────────────────────────────────────────────────────────────────────
-- Migration : ajout du tracking de la durée estimée par trade (heures & bougies)
-- 
-- Objectif : permettre au trader de comparer son estimation de durée (en heures)
-- avant le TP avec la durée réelle observée, pour améliorer son analyse temporelle.
--
-- Exemple : "J'estimais ce trade à 4 heures (8 bougies), il en a pris 14 bougies."
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE trades
  -- Durée estimée en heures par le trader AVANT le TP (saisie décimale, ex: 1.5, 4, 24)
  ADD COLUMN IF NOT EXISTS duree_estimee_heures NUMERIC,

  -- Conversion automatique de la durée estimée en nombre de bougies
  -- Exemple : 4 heures en graphique 30m = 8 bougies
  ADD COLUMN IF NOT EXISTS duree_estimee_bougies INTEGER,

  -- Timeframe utilisé lors du backtest pour contextualiser la durée
  -- Exemple : '1h', '4h', '1d'
  ADD COLUMN IF NOT EXISTS timeframe_backtest TEXT,

  -- Durée réelle en bougies depuis l'entrée jusqu'à la sortie (calculée par le replay)
  ADD COLUMN IF NOT EXISTS duree_reelle_bougies INTEGER;

-- Index pour accélérer les requêtes de statistiques temporelles
CREATE INDEX IF NOT EXISTS idx_trades_duree_estimee
  ON trades (duree_estimee_heures)
  WHERE duree_estimee_heures IS NOT NULL;

-- Commentaire descriptif pour la documentation de la table
COMMENT ON COLUMN trades.duree_estimee_heures IS
  'Durée estimée en heures par le trader pour atteindre le TP (renseigné au moment du trade en backtest)';

COMMENT ON COLUMN trades.duree_estimee_bougies IS
  'Nombre de bougies estimé par le trader pour atteindre le TP (calculé à partir de duree_estimee_heures)';

COMMENT ON COLUMN trades.duree_reelle_bougies IS
  'Durée réelle en bougies de la position (indexSortie - indexEntree). Calculé automatiquement à la clôture.';

COMMENT ON COLUMN trades.timeframe_backtest IS
  'Unité de temps (timeframe) utilisée lors de la session de backtest (ex: 1h, 4h). Contextualise duree_estimee_bougies et duree_estimee_heures.';
