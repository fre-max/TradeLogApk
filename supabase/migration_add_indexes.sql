-- Migration : Ajout d'index pour les clés étrangères et les filtres fréquents
-- Améliore considérablement les temps de chargement sur les grandes bases de données.

-- Index sur la table trades (user_id et strategy_id)
CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_strategy_id ON trades(strategy_id);

-- Index sur la table steps (trade_id)
CREATE INDEX IF NOT EXISTS idx_steps_trade_id ON steps(trade_id);

-- Index sur la table step_images (step_id)
CREATE INDEX IF NOT EXISTS idx_step_images_step_id ON step_images(step_id);

-- Index sur la table de liaison des concepts (trade_reasons)
CREATE INDEX IF NOT EXISTS idx_trade_reasons_trade_id ON trade_reasons(trade_id);
CREATE INDEX IF NOT EXISTS idx_trade_reasons_reason_id ON trade_reasons(reason_id);

-- Index sur le catalogue de raisons (user_id)
CREATE INDEX IF NOT EXISTS idx_reason_catalog_user_id ON reason_catalog(user_id);
CREATE INDEX IF NOT EXISTS idx_reason_catalog_family_id ON reason_catalog(family_id);
