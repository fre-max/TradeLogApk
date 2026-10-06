import { describe, it, expect } from 'vitest';
import { extraireContexteReplay } from '../replayHelper';
import type { TradeWithSteps } from '@/types';

describe('🔄 Pont Replay & Laboratoire - extraireContexteReplay', () => {
  it('extrait fidèlement les informations du trade et prépare le contexte pour la sonde', () => {
    const mockTrade: TradeWithSteps = {
      id: 'trade-uuid-1234',
      user_id: 'user-uuid-1',
      pair: 'EURUSD',
      direction: 'long',
      session: 'London',
      date_backtested: '2025-03-15',
      entry_time: '09:30',
      created_at: '2025-03-15T09:30:00Z',
      status: 'complete',
      journal_type: 'global',
      backtest_context: {
        pair: 'EURUSD',
        annee: '2025',
        timeframe: 'M15',
        timestamp: 1742031000,
        noteQualite: 'A+',
        prixEntree: 1.0820,
        stopLoss: 1.0815,
        takeProfit: 1.0840,
      },
      steps: [
        {
          id: 'step-1',
          trade_id: 'trade-uuid-1234',
          order: 0,
          type: 'entry',
          title: 'Spring Wyckoff M15',
          created_at: '2025-03-15T09:30:00Z',
          fields: {
            price: 1.0820,
            sl: 1.0815,
            tp: 1.0840,
            setup: 'Spring Wyckoff M15',
          },
        },
      ],
    };

    const contexte = extraireContexteReplay(mockTrade);

    expect(contexte).toBeDefined();
    expect(contexte?.pair).toBe('EURUSD');
    expect(contexte?.timeframe).toBe('M15');
    expect(contexte?.timestamp).toBe(1742031000);
    expect(contexte?.position?.direction).toBe('long');
    expect(contexte?.position?.prixEntree).toBe(1.0820);
    
    // Vérification de la transmission pour le Laboratoire
    expect(contexte?.tradeInfo).toBeDefined();
    expect(contexte?.tradeInfo?.id).toBe('trade-uuid-1234');
    expect(contexte?.tradeInfo?.noteQualite).toBe('A+');
    expect(contexte?.tradeInfo?.setupName).toBe('Spring Wyckoff M15');
    expect(contexte?.tradeInfo?.titre).toContain('EURUSD - Spring Wyckoff M15');
  });

  it('génère un titre de secours propre si aucun step de setup n est défini', () => {
    const minimalTrade: TradeWithSteps = {
      id: 'abc5678-uuid',
      user_id: 'user-uuid-1',
      pair: 'GBPUSD',
      direction: 'short',
      session: 'NY',
      date_backtested: '2025-04-10',
      created_at: '2025-04-10T14:00:00Z',
      status: 'complete',
      journal_type: 'global',
      steps: [],
    };

    const contexte = extraireContexteReplay(minimalTrade);
    expect(contexte).toBeDefined();
    expect(contexte?.pair).toBe('GBPUSD');
    expect(contexte?.tradeInfo?.noteQualite).toBe('A+');
    expect(contexte?.tradeInfo?.titre).toContain('GBPUSD [Trade #abc5]');
  });
});
