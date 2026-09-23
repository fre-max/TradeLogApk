import { describe, it, expect, vi } from 'vitest';
import { convertirTradesPourMT5, exporterTradesPourMT5Json } from '../exportMt5Json';
import type { TradeWithSteps } from '@/types';

describe('exportMt5Json - Exportation des trades pour MetaTrader 5', () => {
  const tradeExemple: TradeWithSteps = {
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    user_id: 'user-123',
    pair: 'EUR/USD',
    direction: 'long',
    session: 'London',
    date_backtested: '2024-03-21',
    entry_time: '14:30',
    result: 'win',
    rr_planned: 3,
    rr_realized: 3.2,
    exit_type: 'tp',
    emotion: 'Confiant',
    status: 'complete',
    journal_type: 'global',
    created_at: '2024-03-21T14:30:00Z',
    steps: [
      {
        id: 'step-1',
        trade_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        order: 1,
        type: 'entry',
        title: 'Entrée M5',
        timeframe: 'M5',
        fields: {
          price: 1.0852,
          sl: 1.0844,
          tp: 1.0876,
          setup: 'Liquidity Sweep + Spring',
        },
        notes: 'Validation du sweep sous le support',
        created_at: '2024-03-21T14:30:00Z',
      },
    ],
  };

  it('convertit correctement un trade en objet standardisé MT5', () => {
    const resultat = convertirTradesPourMT5([tradeExemple]);

    expect(resultat).toHaveLength(1);
    const item = resultat[0];

    // Vérification du symbole sans slash
    expect(item.symbole).toBe('EURUSD');
    // Vérification de l'unité de temps
    expect(item.timeframe).toBe('M5');
    // Vérification du sens MT5
    expect(item.direction).toBe('BUY');
    // Vérification des prix
    expect(item.prix_entree).toBe(1.0852);
    expect(item.stop_loss).toBe(1.0844);
    expect(item.take_profit).toBe(1.0876);
    expect(item.ratio_rr).toBe(3.2);
    expect(item.setup).toBe('Liquidity Sweep + Spring');
    // Vérification du cadrage bougies
    expect(item.nb_bougies_visibles).toBe(80);
    // Vérification du format de date MT5
    expect(item.date_heure).toBe('2024.03.21 14:30:00');
    expect(item.timestamp_unix).toBeGreaterThan(0);
  });

  it('lève une erreur si la liste des trades est vide lors du téléchargement', () => {
    expect(() => exporterTradesPourMT5Json([])).toThrow('Aucun trade disponible à exporter.');
  });
});
