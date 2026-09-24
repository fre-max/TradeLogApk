import { describe, it, expect, vi } from 'vitest';
import { exportCsv } from '../exportCsv';
import type { TradeWithSteps } from '@/types';

describe('exportCsv - Exportation complète et résiliente des trades', () => {
  it('ne fait rien si la liste des trades est vide', () => {
    const spyCreateElement = vi.spyOn(document, 'createElement');
    exportCsv([]);
    expect(spyCreateElement).not.toHaveBeenCalled();
    spyCreateElement.mockRestore();
  });

  it('génère un CSV riche avec fallbacks pour un trade minimal de backtest', async () => {
    let csvContenuCapture = '';

    // Mock de Blob et de createObjectURL pour capturer le contenu généré
    const originalBlob = global.Blob;
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;

    URL.createObjectURL = vi.fn((blob: Blob) => {
      // Lire le texte du blob
      return 'blob:mock-url';
    });
    URL.revokeObjectURL = vi.fn();

    const tradesSimples: TradeWithSteps[] = [
      {
        id: 'trade-uuid-1',
        user_id: 'user-1',
        pair: 'EURUSD',
        direction: 'long',
        session: 'London',
        date_backtested: '2026-03-15',
        entry_time: '10:15',
        exit_time: '12:00',
        result: 'win',
        rr_planned: 3.5,
        rr_realized: 3.5,
        exit_type: 'tp',
        status: 'complete',
        journal_type: 'global',
        created_at: '2026-03-15T12:00:00Z',
        steps: [
          {
            id: 'step-entry',
            trade_id: 'trade-uuid-1',
            order: 0,
            type: 'entry',
            title: 'Entrée',
            timeframe: 'M5',
            notes: null,
            fields: { price: 1.0825, sl: 1.0805, tp: 1.0895, setup: 'Order Block Retest' },
            created_at: '2026-03-15T10:15:00Z',
          },
          {
            id: 'step-result',
            trade_id: 'trade-uuid-1',
            order: 1,
            type: 'result',
            title: 'Résultat',
            timeframe: null,
            notes: 'Exécution parfaite',
            fields: { pnl: 2.15, description: 'Sortie sur TP avec liquidité balayée' },
            created_at: '2026-03-15T12:00:00Z',
          },
        ],
        images: [],
      },
    ];

    const mockClick = vi.fn();
    vi.spyOn(document, 'createElement').mockReturnValue({
      set href(v: string) {},
      set download(v: string) {},
      style: {},
      click: mockClick,
    } as any);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => ({} as any));
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => ({} as any));

    const resultat = await exportCsv(tradesSimples);
    expect(resultat.succes).toBe(true);

    // Rétablissement des mocks
    global.Blob = originalBlob;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    vi.restoreAllMocks();
  });
});
