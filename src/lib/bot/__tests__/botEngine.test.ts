import { describe, it, expect, beforeEach } from 'vitest';
import {
  BOTS_PAR_DEFAUT,
  recupererBotsStockes,
  sauvegarderBotStocke,
  supprimerBotStocke,
  evaluerBotScript,
  executerSimulationBatch,
} from '../botEngine';
import type { Bougie } from '@/lib/chartDataHelper';
import type { BotContext, TradingBot } from '@/types/bot';

describe('Moteur de Bots de Trading - botEngine', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('charge correctement les bots par défaut depuis le stockage local', () => {
    const bots = recupererBotsStockes();
    expect(bots.length).toBeGreaterThanOrEqual(3);
    expect(bots.some((b) => b.id === 'bot-smc-choch-v1')).toBe(true);
    expect(bots.some((b) => b.id === 'bot-swings-breakout-v1')).toBe(true);
    expect(bots.some((b) => b.id === 'bot-zigzag-reversal-v1')).toBe(true);
  });

  it('sauvegarde un nouveau bot et permet sa récupération', () => {
    const nouveauBot: TradingBot = {
      id: 'bot-custom-test',
      nom: 'Mon Bot Test',
      description: 'Test unitaire',
      code: 'return { onBar: () => null };',
      parametres: { ratioRR: 3 },
      actif: true,
      creeLe: new Date().toISOString(),
      misAJourLe: new Date().toISOString(),
    };

    sauvegarderBotStocke(nouveauBot);
    const bots = recupererBotsStockes();
    const trouve = bots.find((b) => b.id === 'bot-custom-test');
    expect(trouve).toBeDefined();
    expect(trouve?.nom).toBe('Mon Bot Test');

    supprimerBotStocke('bot-custom-test');
    const apresSuppression = recupererBotsStockes();
    expect(apresSuppression.find((b) => b.id === 'bot-custom-test')).toBeUndefined();
  });

  it('évalue un script JavaScript valide sans erreur', () => {
    const codeAchat = `
      return {
        onBar: function(ctx) {
          if (ctx.bougie.close > ctx.bougie.open) {
            return {
              action: 'BUY',
              prixEntree: ctx.bougie.close,
              stopLoss: ctx.bougie.low,
              takeProfit: ctx.bougie.close + 0.0020
            };
          }
          return null;
        }
      };
    `;

    const fauxContexte: BotContext = {
      bougie: { time: '2025-01-01 10:00', open: 1.0800, high: 1.0850, low: 1.0790, close: 1.0840 },
      index: 10,
      historique: [],
      indicateurs: { smc: null, swings: null, zigzag: null, uvp: null },
      positionActive: null,
      compte: { capitalInitial: 10000, capitalActuel: 10000, tradesEffectues: 0 },
      parametres: {},
    };

    const decision = evaluerBotScript(codeAchat, fauxContexte);
    expect(decision).not.toBeNull();
    expect(decision?.action).toBe('BUY');
    expect(decision?.prixEntree).toBe(1.0840);
  });

  it('gère les erreurs de syntaxe ou d exception dans le script utilisateur en toute sécurité', () => {
    const codeErreur = `
      // Provoque une erreur intentionnelle
      return {
        onBar: function(ctx) {
          throw new Error('Erreur script utilisateur');
        }
      };
    `;

    const fauxContexte: BotContext = {
      bougie: { time: '2025-01-01 10:00', open: 1.08, high: 1.09, low: 1.07, close: 1.085 },
      index: 5,
      historique: [],
      indicateurs: { smc: null, swings: null, zigzag: null, uvp: null },
      positionActive: null,
      compte: { capitalInitial: 10000, capitalActuel: 10000, tradesEffectues: 0 },
      parametres: {},
    };

    // Ne doit pas lever d'exception et retourner null
    const decision = evaluerBotScript(codeErreur, fauxContexte);
    expect(decision).toBeNull();
  });

  it('exécute une simulation batch complète et génère le rapport de performance', () => {
    // Génère une série de 100 bougies fictives
    const bougies: Bougie[] = [];
    let prix = 1.0800;
    for (let i = 0; i < 100; i++) {
      const variation = (i % 2 === 0 ? 0.0005 : -0.0003);
      prix += variation;
      bougies.push({
        time: `2025-01-01T${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00Z`,
        open: prix,
        high: prix + 0.0004,
        low: prix - 0.0004,
        close: prix + (variation > 0 ? 0.0002 : -0.0002),
      });
    }

    const botSimple: TradingBot = {
      id: 'bot-simple-batch',
      nom: 'Bot Simple Batch',
      description: 'Achète dès que possible',
      code: `
        return {
          onBar: function(ctx) {
            if (ctx.index === 60) {
              return {
                action: 'BUY',
                prixEntree: ctx.bougie.close,
                stopLoss: ctx.bougie.close - 0.0002,
                takeProfit: ctx.bougie.close + 0.0004
              };
            }
            return null;
          }
        };
      `,
      parametres: { ratioRR: 2, risquePourcent: 1 },
      actif: true,
      creeLe: new Date().toISOString(),
      misAJourLe: new Date().toISOString(),
    };

    const rapport = executerSimulationBatch(botSimple, bougies, { capitalInitial: 10000 });

    expect(rapport).toBeDefined();
    expect(rapport.capitalInitial).toBe(10000);
    expect(rapport.periode.totalBougies).toBe(100);
    expect(Array.isArray(rapport.trades)).toBe(true);
    expect(Array.isArray(rapport.courbeEquity)).toBe(true);
  });
});
