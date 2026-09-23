import { useState, useEffect } from 'react';
import { useLocalDatabase } from '@/store/useLocalDatabase';
import { useOfflineSyncStore } from '@/store/offlineSyncStore';
import { useBacktestStore, type PositionSimulee } from '@/store/backtestStore';
import { useUIStore } from '@/store';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import type { TradeWithSteps } from '@/types';

interface BacktestTradeModalProps {
  ouvert: boolean;
  onFermer: () => void;
  position: PositionSimulee | null;
  paire: string;
  timeframe: string;
  annee: string;
  journal_type?: string;
  onOuvrirFormulaireComplet?: () => void;
  promiseCapture?: Promise<{ id: string; url: string; source: 'upload'; phase: 'avant' | 'apres'; storage_path?: string } | null> | null;
  onRecapturer?: (phase: 'avant' | 'apres') => Promise<{ id: string; url: string; source: 'upload'; phase: 'avant' | 'apres' } | null>;
}

/**
 * Fiche modale tactile ultra-légère et instantanée (< 16ms) pour enregistrer
 * ou planifier un trade de Backtest directement sur smartphone.
 * 
 * Évite le chargement lourd du TradeDrawer de bureau sur mobile.
 */
export function BacktestTradeModal({
  ouvert,
  onFermer,
  position,
  paire,
  timeframe,
  annee,
  journal_type = 'backtest',
  onOuvrirFormulaireComplet,
  promiseCapture,
  onRecapturer,
}: BacktestTradeModalProps) {
  const strategies = useLocalDatabase((s) => s.strategies);
  const addTrade = useLocalDatabase((s) => s.addTrade);
  const localUpdateTrade = useLocalDatabase((s) => s.updateTrade);
  const trades = useLocalDatabase((s) => s.trades);
  const ajouterALaFile = useOfflineSyncStore((s) => s.ajouterALaFile);
  const modifierPositionActive = useBacktestStore((s) => s.modifierPositionActive);
  const archiverPositionActive = useBacktestStore((s) => s.archiverPositionActive);
  const addToast = useUIStore((s) => s.addToast);

  // Stratégie sélectionnée
  const [strategyId, setStrategyId] = useState(() => {
    return localStorage.getItem('journal_last_strategy_id') || '';
  });

  // Note de clôture / Bilan
  const [description, setDescription] = useState('');

  // Image capturée (asynchrone)
  const [imageCapture, setImageCapture] = useState<{ id: string; url: string; phase: 'avant' | 'apres' } | null>(null);
  const [capturant, setCapturant] = useState(false);
  const [enregistrant, setEnregistrant] = useState(false);

  // Résolution asynchrone de la capture du graphique sans jamais bloquer l'affichage de la modale
  useEffect(() => {
    if (!ouvert || !promiseCapture) return;

    setCapturant(true);
    promiseCapture
      .then((res) => {
        if (res) {
          setImageCapture({ id: res.id, url: res.url, phase: res.phase });
        }
      })
      .catch((err) => {
        console.warn('⚠️ [BacktestTradeModal] Échec capture asynchrone :', err);
      })
      .finally(() => {
        setCapturant(false);
      });
  }, [ouvert, promiseCapture]);

  if (!ouvert || !position) return null;

  const estCloturee = Boolean(position.estCloturee);
  const estLong = position.direction === 'long';

  // Calculs financiers & R:R
  const plannedDiff = Math.abs(position.takeProfit - position.prixEntree);
  const plannedRisk = Math.abs(position.prixEntree - position.stopLoss);
  const rrPrevu = plannedRisk > 0 ? (plannedDiff / plannedRisk).toFixed(2) : '1.00';

  const realizedDiff = Math.abs((position.prixSortie || 0) - position.prixEntree);
  const rrRealise = plannedRisk > 0 ? (realizedDiff / plannedRisk).toFixed(2) : '0';

  // Session de trading calculée
  const timestampUnix = typeof position.dateEntree === 'number'
    ? position.dateEntree
    : Math.floor(new Date(position.dateEntree).getTime() / 1000);

  const dateFormatee = new Date(timestampUnix * 1000).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const handleChangerStrategie = (id: string) => {
    setStrategyId(id);
    if (id) {
      localStorage.setItem('journal_last_strategy_id', id);
    }
  };

  // Recapturer manuellement si besoin
  const handleRecaptureManuelle = async () => {
    if (!onRecapturer || capturant) return;
    setCapturant(true);
    try {
      const res = await onRecapturer(estCloturee ? 'apres' : 'avant');
      if (res) {
        setImageCapture({ id: res.id, url: res.url, phase: res.phase });
        addToast('Capture d\'écran mise à jour', 'success');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCapturant(false);
    }
  };

  // Enregistrement rapide et fluide
  const handleEnregistrer = async () => {
    setEnregistrant(true);
    try {
      // 1. Récupération de l'utilisateur connecté via session locale (offline-ready)
      let userId = 'local-user';
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) userId = session.user.id;
      } catch (e) {
        // En mode hors ligne
      }

      const dateTexte = new Date(timestampUnix * 1000).toISOString().split('T')[0];
      const imagesPayload = imageCapture
        ? [{
            id: imageCapture.id,
            trade_id: position.tradeIdSupabase || crypto.randomUUID(),
            url: imageCapture.url,
            source: 'upload' as const,
            phase: imageCapture.phase,
            context: 'intermediaire' as const,
            storage_path: 'local_pending',
          }]
        : [];

      // Contexte pour le Replay automatique
      const contextReplay = {
        pair: paire,
        annee,
        timeframe,
        timestamp: timestampUnix,
        prixEntree: position.prixEntree,
        stopLoss: position.stopLoss,
        takeProfit: position.takeProfit,
        direction: position.direction,
        dureeEstimeeHeures: position.dureeEstimeeHeures,
        dureeEstimeeBougies: position.dureeEstimeeBougies,
      };

      if (!estCloturee) {
        // ─── ÉTAPE 1 : PLANIFICATION ───────────────────────────
        const tradeId = position.tradeIdSupabase || crypto.randomUUID();
        const stepIds = {
          biais: crypto.randomUUID(),
          poi: crypto.randomUUID(),
          entry: crypto.randomUUID(),
          result: crypto.randomUUID(),
        };

        const tradePayload: any = {
          id: tradeId,
          user_id: userId,
          pair: paire,
          direction: position.direction,
          session: 'London',
          date_backtested: dateTexte,
          entry_time: new Date(timestampUnix * 1000).toTimeString().slice(0, 5),
          exit_time: null,
          result: 'win',
          rr_planned: parseFloat(rrPrevu),
          rr_realized: null,
          exit_type: 'tp',
          emotion: null,
          strategy_id: strategyId || null,
          journal_type: journal_type,
          status: 'in_progress',
          backtest_context: contextReplay,
          created_at: new Date().toISOString(),
        };

        const stepsPayload = [
          {
            id: stepIds.biais,
            trade_id: tradeId,
            order: 0,
            type: 'biais',
            title: 'Biais',
            timeframe: 'H4',
            notes: null,
            fields: { direction: estLong ? 'Haussier' : 'Baissier' },
          },
          {
            id: stepIds.entry,
            trade_id: tradeId,
            order: 1,
            type: 'entry',
            title: 'Entrée',
            timeframe,
            notes: null,
            fields: {
              price: position.prixEntree,
              sl: position.stopLoss,
              tp: position.takeProfit,
            },
          },
        ];

        // 1. Sauvegarde instantanée en mémoire locale
        addTrade({
          ...tradePayload,
          steps: stepsPayload,
          images: imagesPayload,
          reasons: [],
        } as TradeWithSteps);

        // 2. File d'attente pour Supabase
        ajouterALaFile({
          tradeId,
          action: 'INSERT',
          tradeData: tradePayload,
          steps: stepsPayload,
          images: imagesPayload,
          reasons: [],
        });

        // 3. Mise à jour de la position dans le moteur de Backtest
        modifierPositionActive({
          tradeIdSupabase: tradeId,
          stepIdsSupabase: stepIds,
          planificationEnregistree: true,
        });

        addToast('Planification enregistrée avec succès !', 'success');
        onFermer();
      } else {
        // ─── ÉTAPE 2 : RÉSOLUTION / CLÔTURE ────────────────────
        const resultatMapping = position.resultat || 'win';
        const exitTypeMapping = position.resultat === 'win' ? 'tp'
          : position.resultat === 'loss' ? 'sl'
          : position.resultat === 'breakeven' ? 'breakeven'
          : 'manual';

        // CAS A : Le trade a déjà été planifié à l'étape 1 → MISE À JOUR sur le même ID (aucun doublon !)
        if (position.tradeIdSupabase) {
          const tradeId = position.tradeIdSupabase;
          const updatePayload: any = {
            id: tradeId,
            result: resultatMapping,
            rr_realized: parseFloat(rrRealise),
            exit_type: exitTypeMapping,
            status: 'complete',
            duree_reelle_bougies: position.dureeReelleBougies || null,
          };

          const existingTrade = trades.find((t) => t.id === tradeId);
          if (existingTrade) {
            localUpdateTrade(tradeId, {
              ...existingTrade,
              ...updatePayload,
              notes: description || (existingTrade as any).notes || null,
              images: [...(existingTrade.images || []), ...imagesPayload],
            } as any);
          }

          // Mise en file d'attente Supabase (UPDATE garanti sur le même ID)
          ajouterALaFile({
            tradeId,
            action: 'UPDATE',
            tradeData: updatePayload,
            images: imagesPayload,
          });
        } else {
          // CAS B : Clôture directe sans planification préalable → Création complète du trade (INSERT)
          const tradeId = crypto.randomUUID();
          const stepIds = {
            biais: crypto.randomUUID(),
            poi: crypto.randomUUID(),
            entry: crypto.randomUUID(),
            result: crypto.randomUUID(),
          };

          const tradePayload: any = {
            id: tradeId,
            user_id: userId,
            pair: paire,
            direction: position.direction,
            session: 'London',
            date_backtested: dateTexte,
            entry_time: new Date(timestampUnix * 1000).toTimeString().slice(0, 5),
            exit_time: new Date().toTimeString().slice(0, 5),
            result: resultatMapping,
            rr_planned: parseFloat(rrPrevu),
            rr_realized: parseFloat(rrRealise),
            exit_type: exitTypeMapping,
            emotion: null,
            strategy_id: strategyId || null,
            journal_type: journal_type,
            status: 'complete',
            duree_reelle_bougies: position.dureeReelleBougies || null,
            backtest_context: contextReplay,
            created_at: new Date().toISOString(),
          };

          const stepsPayload = [
            {
              id: stepIds.entry,
              trade_id: tradeId,
              order: 0,
              type: 'entry',
              title: 'Entrée',
              timeframe,
              notes: null,
              fields: {
                price: position.prixEntree,
                sl: position.stopLoss,
                tp: position.takeProfit,
              },
            },
            {
              id: stepIds.result,
              trade_id: tradeId,
              order: 1,
              type: 'result',
              title: 'Résultat',
              timeframe,
              notes: description || null,
              fields: {
                result: resultatMapping,
                pnl: position.pnl || 0,
              },
            },
          ];

          addTrade({
            ...tradePayload,
            steps: stepsPayload,
            images: imagesPayload,
            reasons: [],
          } as TradeWithSteps);

          ajouterALaFile({
            tradeId,
            action: 'INSERT',
            tradeData: tradePayload,
            steps: stepsPayload,
            images: imagesPayload,
            reasons: [],
          });
        }

        // Clôture et archivage dans l'historique de session
        archiverPositionActive();
        addToast('Trade clôturé et archivé dans le journal !', 'success');
        onFermer();
      }
    } catch (err: any) {
      console.error('❌ [BacktestTradeModal] Erreur sauvegarde :', err);
      addToast(err.message || 'Erreur lors de l\'enregistrement', 'error');
    } finally {
      setEnregistrant(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      {/* Conteneur principal Bottom-Sheet / Modal */}
      <div className="w-full sm:max-w-md bg-[#161a25] border-t sm:border border-[#2a2e39] rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[90vh]">
        {/* Poignée tactile de glissement (Pill handle) pour mobile */}
        <div className="w-12 h-1 bg-white/25 rounded-full mx-auto my-1.5 sm:hidden shrink-0" />
        
        {/* En-tête */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2e39] bg-[#1a1f2c]">
          <div className="flex items-center gap-2">
            <span className="text-base">{estCloturee ? '🏁' : '📋'}</span>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">
                {estCloturee ? 'Résolution & Clôture' : 'Planification du Trade'}
              </h2>
              <span className="text-[10px] text-gray-400 font-mono">
                {paire} · {timeframe.toUpperCase()} · {dateFormatee}
              </span>
            </div>
          </div>
          <button
            onClick={onFermer}
            disabled={enregistrant}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Corps scrollable */}
        <div className="p-4 space-y-3.5 overflow-y-auto flex-1">
          
          {/* Carte Résumé de la Position */}
          <div className="p-3 rounded-xl bg-[#11141c] border border-[#232733] space-y-2.5">
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  'px-2.5 py-0.5 rounded-md text-[11px] font-bold tracking-wide uppercase',
                  estLong
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                )}
              >
                {estLong ? '▲ Position Long' : '▼ Position Short'}
              </span>

              {estCloturee ? (
                <span
                  className={cn(
                    'text-xs font-bold font-mono px-2 py-0.5 rounded',
                    (position.pnl || 0) >= 0
                      ? 'text-emerald-400 bg-emerald-950/40'
                      : 'text-rose-400 bg-rose-950/40'
                  )}
                >
                  {(position.pnl || 0) >= 0 ? '+' : ''}{(position.pnl || 0).toFixed(2)}% P&L
                </span>
              ) : (
                <span className="text-xs font-bold text-indigo-400 font-mono">
                  R:R {rrPrevu}
                </span>
              )}
            </div>

            {/* Grille des Prix (responsive compact) */}
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-center text-xs">
              <div className="p-1.5 rounded-lg bg-white/[0.03] border border-white/5">
                <span className="block text-[8.5px] sm:text-[9px] text-gray-400 uppercase font-semibold">Entrée</span>
                <span className="font-mono text-white text-[10.5px] sm:text-[11.5px] font-medium truncate block">{position.prixEntree.toFixed(5)}</span>
              </div>
              <div className="p-1.5 rounded-lg bg-rose-500/[0.06] border border-rose-500/20">
                <span className="block text-[8.5px] sm:text-[9px] text-rose-400 uppercase font-semibold">Stop Loss</span>
                <span className="font-mono text-rose-300 text-[10.5px] sm:text-[11.5px] font-medium truncate block">{position.stopLoss.toFixed(5)}</span>
              </div>
              <div className="p-1.5 rounded-lg bg-emerald-500/[0.06] border border-emerald-500/20">
                <span className="block text-[8.5px] sm:text-[9px] text-emerald-400 uppercase font-semibold">Take Profit</span>
                <span className="font-mono text-emerald-300 text-[10.5px] sm:text-[11.5px] font-medium truncate block">{position.takeProfit.toFixed(5)}</span>
              </div>
            </div>

            {estCloturee && (
              <div className="flex items-center justify-between pt-1 border-t border-white/5 text-xs text-gray-400">
                <span>R:R Réalisé : <strong className="text-white font-mono">{rrRealise}R</strong></span>
                <span>Résultat : <strong className="text-white uppercase">{position.resultat}</strong></span>
              </div>
            )}
          </div>

          {/* Sélecteur de Stratégie */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-gray-300 flex items-center gap-1.5">
              <span>🎯</span>
              <span>Stratégie associée (Playbook)</span>
            </label>
            <select
              value={strategyId}
              onChange={(e) => handleChangerStrategie(e.target.value)}
              className="w-full h-9 px-3 bg-[#11141c] border border-[#2a2e39] focus:border-indigo-500 rounded-lg text-xs text-white outline-none"
            >
              <option value="">Aucune stratégie spécifique</option>
              {strategies.map((strat) => (
                <option key={strat.id} value={strat.id}>
                  {strat.name} ({strat.version})
                </option>
              ))}
            </select>
          </div>

          {/* Statut & Aperçu de la Capture d'écran */}
          <div className="p-2.5 rounded-xl bg-[#11141c] border border-[#232733] flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              {imageCapture ? (
                <img
                  src={imageCapture.url}
                  alt="Aperçu graphique"
                  className="w-12 h-8 object-cover rounded border border-white/10"
                />
              ) : (
                <div className="w-12 h-8 rounded bg-white/5 flex items-center justify-center text-xs">
                  {capturant ? (
                    <span className="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    '📸'
                  )}
                </div>
              )}
              <div className="truncate text-xs">
                <span className="block font-medium text-white truncate">
                  {imageCapture
                    ? 'Capture du graphique attachée'
                    : capturant
                    ? 'Capture en cours...'
                    : 'Aucune capture'}
                </span>
                <span className="text-[10px] text-gray-400">
                  {imageCapture ? 'Qualité optimisée (légère)' : 'Traitement asynchrone'}
                </span>
              </div>
            </div>

            {onRecapturer && (
              <button
                type="button"
                onClick={handleRecaptureManuelle}
                disabled={capturant}
                className="px-2 py-1 bg-white/5 hover:bg-white/10 text-gray-300 rounded text-[10px] font-semibold transition-colors disabled:opacity-50"
              >
                {capturant ? '...' : 'Recapturer'}
              </button>
            )}
          </div>

          {/* Si position clôturée : champ de notes / bilan */}
          {estCloturee && (
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-300 flex items-center gap-1.5">
                <span>📝</span>
                <span>Bilan / Notes d'exécution</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Respect du plan, émotions, raison de clôture..."
                rows={2}
                className="w-full p-2.5 bg-[#11141c] border border-[#2a2e39] focus:border-indigo-500 rounded-lg text-xs text-white placeholder:text-gray-500 outline-none resize-none"
              />
            </div>
          )}

          {/* Lien optionnel pour basculer vers le formulaire complet */}
          {onOuvrirFormulaireComplet && (
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => {
                  onFermer();
                  onOuvrirFormulaireComplet();
                }}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 underline font-medium"
              >
                Accéder au formulaire complet (confluences, Biais HTF...) →
              </button>
            </div>
          )}
        </div>

        {/* Barre d'action inférieure (avec safe-area) */}
        <div className="p-3 border-t border-[#2a2e39] bg-[#1a1f2c] flex gap-2 shrink-0 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
          <button
            type="button"
            onClick={onFermer}
            disabled={enregistrant}
            className="flex-1 py-2.5 rounded-xl border border-[#2a2e39] text-gray-300 hover:text-white hover:bg-white/5 text-xs font-semibold transition-colors disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleEnregistrer}
            disabled={enregistrant}
            className={cn(
              'flex-[2] py-2.5 rounded-xl text-white text-xs font-bold transition-all shadow-lg flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-[0.98]',
              estCloturee
                ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/30'
                : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/30'
            )}
          >
            {enregistrant ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Enregistrement...</span>
              </>
            ) : estCloturee ? (
              <span>🏁 Clôturer & Archiver</span>
            ) : (
              <span>💾 Valider la Planification</span>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
