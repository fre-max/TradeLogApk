-- Migration : Ajoute le support du replay de backtest depuis le journal
-- Cette colonne stocke le contexte (paire, année, timeframe, timestamp)
ALTER TABLE public.trades
ADD COLUMN IF NOT EXISTS backtest_context jsonb DEFAULT NULL;

COMMENT ON COLUMN public.trades.backtest_context IS 'Stocke le contexte du replay pour le module de backtesting (paire, annee, timeframe, timestamp de la bougie d entrée)';
