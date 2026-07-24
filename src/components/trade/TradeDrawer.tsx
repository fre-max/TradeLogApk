import { useEffect, useState, useMemo, useRef } from 'react'
import { useUIStore } from '@/store'
import { useBacktestStore } from '@/store/backtestStore'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useUpdateTrade } from '@/hooks/useTrades'
import { useQuickEntry } from '@/hooks/useQuickEntry'
import { ImageAnalysisUpload } from './ImageAnalysisUpload'
import { useQueryClient } from '@tanstack/react-query'
import { useTradeReasons, useSaveTradeReasons, type SelectedTradeReason } from '@/hooks/useTradeReasons'
import { useTradeImages, useSaveTradeImages } from '@/hooks/useTradeImages'
import { TradeTypeSelector } from './TradeTypeSelector'
import { GlobalInfosPanel } from './GlobalInfosPanel'
import { TradeSectionPanel } from './TradeSectionPanel'
import { IAAnalysisPanel } from './IAAnalysisPanel'
import { StrategyHeaderSelector } from './StrategyHeaderSelector'
import {
  buildStepPayloads,
  buildTradePayload,
  computeTradeStatus,
  extractStepIds,
  INITIAL_FORM_STATE,
  tradeToFormData,
  type EditStepIds,
  type FormDataState,
} from '@/lib/tradeForm'

export type { FormDataState }

export function TradeDrawer({
  isInline = false,
  backtestMode = false,
  onCaptureGraphique,
}: {
  isInline?: boolean
  backtestMode?: boolean
  // Fonction de capture manuelle du graphique (disponible uniquement en mode backtest)
  // Exemple : onCaptureGraphique('avant') → retourne l'objet image {id, url, source, phase}
  onCaptureGraphique?: (phase: 'avant' | 'apres') => Promise<{ id: string; url: string; source: 'upload'; phase: 'avant' | 'apres' } | null>
}) {
  const isNewTradeOpen = useUIStore((state) => state.isNewTradeOpen)
  const editingTrade = useUIStore((state) => state.editingTrade)
  const prefillData = useUIStore((state) => state.prefillData)
  const closeNewTrade = useUIStore((state) => state.closeNewTrade)
  const openDetail = useUIStore((state) => state.openDetail)
  const openEditTrade = useUIStore((state) => state.openEditTrade)
  const addToast = useUIStore((state) => state.addToast)

  // Backtest store hooks
  const positionActive = useBacktestStore((s) => s.positionActive)
  const modifierPositionActive = useBacktestStore((s) => s.modifierPositionActive)
  const archiverPositionActive = useBacktestStore((s) => s.archiverPositionActive)
  const annulerPositionActive = useBacktestStore((s) => s.annulerPositionActive)

  const isEditMode = Boolean(editingTrade)
  const { mutateAsync: updateTrade, isPending: isUpdating } = useUpdateTrade()
  const { mutateAsync: creerQuickEntry, isPending: isCreatingQuick } = useQuickEntry()
  const queryClient = useQueryClient()

  // États du formulaire
  const [formData, setFormData] = useState<FormDataState>(INITIAL_FORM_STATE)
  const [stepIds, setStepIds] = useState<EditStepIds>({})
  const [selectedReasons, setSelectedReasons] = useState<SelectedTradeReason[]>([])
  const [saving, setSaving] = useState(false)

  // Contrôles de navigation et d'étapes dans le Drawer
  const [manualMode, setManualMode] = useState(false)
  const [selectedStartType, setSelectedStartType] = useState<'bias' | 'poi' | 'confirmation' | null>(null)
  const [analysantIA, setAnalysantIA] = useState(false)
  const [globalInfosParDefaut, setGlobalInfosParDefaut] = useState(true)
  const [showRappelDialog, setShowRappelDialog] = useState(false)
  const [afficherPlanEtape1, setAfficherPlanEtape1] = useState(false)

  // UUIDs temporaires pour la création d'un nouveau trade et de ses étapes
  const [tempIds, setTempIds] = useState(() => ({
    tradeId: crypto.randomUUID(),
    biais: crypto.randomUUID(),
    poi: crypto.randomUUID(),
    entry: crypto.randomUUID(),
    result: crypto.randomUUID(),
  }))

  const { data: existingReasons } = useTradeReasons(isEditMode ? editingTrade?.id : undefined)
  const { data: existingImages } = useTradeImages(isEditMode ? editingTrade?.id : undefined)

  const { mutateAsync: saveTradeReasons } = useSaveTradeReasons()
  const { mutateAsync: saveTradeImages } = useSaveTradeImages()

  // Extrait toutes les images insérées dans les différentes étapes
  const toutesLesImages = useMemo(() => {
    return [
      ...(formData.biais_images || []).map(img => ({ ...img, phase: img.phase as 'avant' | 'apres' })),
      ...(formData.poi_images || []).map(img => ({ ...img, phase: img.phase as 'avant' | 'apres' })),
      ...(formData.entry_images || []).map(img => ({ ...img, phase: img.phase as 'avant' | 'apres' })),
    ]
  }, [formData.biais_images, formData.poi_images, formData.entry_images])

  // Synchronise les données si on édite un trade existant
  useEffect(() => {
    if (isEditMode) {
      if (existingReasons) setSelectedReasons(existingReasons)
      if (existingImages) {
        setFormData(tradeToFormData(editingTrade!, existingImages))
      } else {
        setFormData(tradeToFormData(editingTrade!))
      }
      setStepIds(extractStepIds(editingTrade!))
      setManualMode(true)
      setSelectedStartType('bias') // Par défaut
    }
  }, [existingReasons, existingImages, isEditMode, editingTrade])

  // Handler pour changer la stratégie et la mémoriser dans localStorage
  const handleSelectStrategy = (strategyId: string) => {
    setFormData((prev) => ({ ...prev, strategy_id: strategyId }))
    if (strategyId) {
      localStorage.setItem('journal_last_strategy_id', strategyId)
    }
  }

  // Réinitialise l'état à l'ouverture pour un nouveau trade
  useEffect(() => {
    if (!isNewTradeOpen) return

    if (!editingTrade) {
      const lastStrategyId = localStorage.getItem('journal_last_strategy_id') || ''
      if (prefillData) {
        setFormData({
          ...INITIAL_FORM_STATE,
          strategy_id: lastStrategyId,
          ...prefillData,
        })
        setManualMode(true)
        setSelectedStartType('bias') // Ouvre directement le formulaire pre-rempli
      } else {
        setFormData({
          ...INITIAL_FORM_STATE,
          strategy_id: lastStrategyId,
        })
        setManualMode(false)
        setSelectedStartType(null)
      }
      setStepIds({})
      setSelectedReasons([])
      if (backtestMode && positionActive?.tradeIdSupabase && positionActive.stepIdsSupabase) {
        setTempIds({
          tradeId: positionActive.tradeIdSupabase as any,
          biais: positionActive.stepIdsSupabase.biais as any,
          poi: positionActive.stepIdsSupabase.poi as any,
          entry: positionActive.stepIdsSupabase.entry as any,
          result: positionActive.stepIdsSupabase.result as any,
        })
      } else {
        setTempIds({
          tradeId: crypto.randomUUID(),
          biais: crypto.randomUUID(),
          poi: crypto.randomUUID(),
          entry: crypto.randomUUID(),
          result: crypto.randomUUID(),
        })
      }
    }
  }, [isNewTradeOpen, editingTrade, prefillData, backtestMode, positionActive])

  // Synchronise les informations calculées de la position active du Backtest vers le formulaire
  useEffect(() => {
    if (backtestMode && positionActive) {
      setFormData((prev) => {
        const resultMapping = positionActive.resultat === 'win' ? 'win' as const
          : positionActive.resultat === 'loss' ? 'loss' as const
          : positionActive.resultat === 'breakeven' ? 'breakeven' as const
          : 'missed' as const;

        const plannedDiff = Math.abs(positionActive.takeProfit - positionActive.prixEntree);
        const plannedRisk = Math.abs(positionActive.prixEntree - positionActive.stopLoss);
        const rrP = plannedRisk > 0 ? (plannedDiff / plannedRisk).toFixed(1) : '';

        const realizedDiff = Math.abs((positionActive.prixSortie || 0) - positionActive.prixEntree);
        const realizedRisk = Math.abs(positionActive.prixEntree - positionActive.stopLoss);
        const rrR = positionActive.estCloturee && realizedRisk > 0 ? (realizedDiff / realizedRisk).toFixed(1) : '';

        return {
          ...prev,
          entry_price: positionActive.prixEntree.toFixed(5),
          entry_sl: positionActive.stopLoss.toFixed(5),
          entry_tp: positionActive.takeProfit.toFixed(5),
          rr_planned: rrP,
          rr_realized: rrR || prev.rr_realized,
          result: resultMapping,
        };
      });
    }
  }, [backtestMode, positionActive])

  // Fermeture via le bouton ✕ ou ← (peut annuler la position si nécessaire)
  const handleClose = () => {
    if (!saving && !isUpdating && !isCreatingQuick && !analysantIA) {
      if (backtestMode) {
        if (!positionActive?.planificationEnregistree) {
          // Étape 1 non sauvée → annuler complètement la position du graphique
          annulerPositionActive()
        } else if (positionActive?.estCloturee) {
          // Étape 2 abandonnée → archiver sans sauver la résolution
          archiverPositionActive()
        }
        // Si planifié mais pas encore clôturé → juste fermer, la position reste sur le graphique
      }
      closeNewTrade()
    }
  }

  // Annulation explicite via le bouton "Annuler" (même comportement que handleClose)
  const resetAndClose = () => {
    setFormData(INITIAL_FORM_STATE)
    setStepIds({})
    setSelectedReasons([])
    setSelectedStartType(null)
    setManualMode(false)
    if (backtestMode) {
      if (!positionActive?.planificationEnregistree) {
        // Étape 1 non sauvée → annuler la position du graphique
        annulerPositionActive()
      } else if (positionActive?.estCloturee) {
        // Étape 2 abandonnée → archiver sans sauver la résolution
        archiverPositionActive()
      }
      // Si planifié mais pas clôturé → juste fermer, le replay peut continuer
    }
    closeNewTrade()
  }

  // Fermeture après un enregistrement réussi : ne touche PAS à la position de backtest
  // car handleSave l'a déjà gérée (modifierPositionActive ou archiverPositionActive)
  const fermerApresEnregistrement = () => {
    setFormData(INITIAL_FORM_STATE)
    setStepIds({})
    setSelectedReasons([])
    setSelectedStartType(null)
    setManualMode(false)
    closeNewTrade()
  }

  // Appelle l'Edge Function d'analyse IA pour pré-remplir le formulaire
  const analyserImageSelectionnee = async (url: string) => {
    setAnalysantIA(true)
    console.log("🚀 [TradeDrawer] Lancement de l'analyse IA sur l'image :", url)
    try {
      const response = await supabase.functions.invoke(`analyze?url=${encodeURIComponent(url)}&mode=setup`, {
        method: 'GET'
      })

      if (response.error) throw response.error

      const res = response.data
      console.log('✅ [TradeDrawer] Analyse IA terminée. Résultats :', res)

      // Injecte les données récoltées par l'IA dans les infos globales du formulaire
      setFormData((prev) => ({
        ...prev,
        pair: res.pair || prev.pair,
        direction: (res.direction || prev.direction) as 'long' | 'short',
        session: res.session || prev.session,
        entry_price: res.entry_price ? String(res.entry_price) : prev.entry_price,
        entry_sl: res.sl ? String(res.sl) : prev.entry_sl,
        entry_tp: res.tp ? String(res.tp) : prev.entry_tp,
        rr_planned: res.rr ? String(res.rr) : prev.rr_planned,
        rr_realized: res.rr_realized != null ? String(res.rr_realized) : prev.rr_realized,
        result: res.result || prev.result,
        missed_gap: res.missed_gap != null ? String(res.missed_gap) : prev.missed_gap,
        exit_type: res.result === 'win' ? 'tp' : (res.result === 'loss' ? 'sl' : (res.result === 'breakeven' ? 'breakeven' : prev.exit_type)),
      }))

      addToast("Données du trade pré-remplies par l'IA !", "success")
    } catch (e: any) {
      console.error("❌ [TradeDrawer] Échec de l'analyse IA :", e)
      addToast(e.message || "Erreur lors de l'analyse par l'IA.", "error")
    } finally {
      setAnalysantIA(false)
    }
  }

  const handleSave = async (forceSave = false) => {
    // Garde-fou : rappel si les données globales n'ont pas été remplies / restent par défaut
    if (!forceSave && globalInfosParDefaut) {
      console.log("⚠️ [TradeDrawer] Infos globales par défaut détectées. Affichage du rappel.")
      setShowRappelDialog(true)
      return
    }

    setShowRappelDialog(false)
    setSaving(true)

    try {
      // Récupère l'utilisateur uniquement si en ligne pour éviter tout timeout réseau bloquant
      let user = null
      if (navigator.onLine) {
        try {
          const { data: { session } } = await supabase.auth.getSession()
          user = session?.user || null
        } catch (sessionErr) {
          console.warn('⚠️ [TradeDrawer] Impossible de récupérer la session locale :', sessionErr)
        }

        // Si pas de session locale en cache et en ligne, on tente d'appeler getUser()
        if (!user) {
          try {
            const { data: { user: fetchedUser } } = await supabase.auth.getUser()
            user = fetchedUser
          } catch (userErr) {
            console.warn('⚠️ [TradeDrawer] Impossible de contacter Supabase pour getUser() :', userErr)
          }
        }
      }

      // En mode offline, on utilise 'local-user' si aucun utilisateur n'est connecté
      const userId = user?.id || 'local-user'

      const { useLocalDatabase } = await import('@/store/useLocalDatabase')
      const { useOfflineSyncStore } = await import('@/store/offlineSyncStore')
      const { addTrade, updateTrade: localUpdateTrade } = useLocalDatabase.getState()
      const { ajouterALaFile } = useOfflineSyncStore.getState()
      const tradeIdActuel = isEditMode && editingTrade ? editingTrade.id : tempIds.tradeId

      // Images Structurées
      const imagesPourSauvegarde = [
        ...(formData.biais_images || []).map((img) => ({ id: img.id, trade_id: tradeIdActuel, url: img.url, source: img.source, phase: img.phase, context: 'superieur' as const, storage_path: img.storage_path })),
        ...(formData.poi_images || []).map((img) => ({ id: img.id, trade_id: tradeIdActuel, url: img.url, source: img.source, phase: img.phase, context: 'intermediaire' as const, storage_path: img.storage_path })),
        ...(formData.entry_images || []).map((img) => ({ id: img.id, trade_id: tradeIdActuel, url: img.url, source: img.source, phase: img.phase, context: 'inferieur' as const, storage_path: img.storage_path })),
      ]

      // 1️⃣ Sauvegarde ou création du Trade
      const estDejaEnregistreEnBacktest = backtestMode && positionActive?.planificationEnregistree

      if (isEditMode && editingTrade) {
        const biaisStep = editingTrade.steps.find((s) => s.type === 'biais')
        const preserveBiaisFields = (biaisStep?.fields ?? null) as Record<string, unknown> | null
        
        const status = computeTradeStatus(formData, editingTrade.status)
        const tradePayload = buildTradePayload(formData, status)
        const stepsPayload = buildStepPayloads(tradeIdActuel, formData, stepIds, preserveBiaisFields)

        const fullTrade: any = {
          ...editingTrade,
          ...tradePayload,
          steps: stepsPayload,
          images: imagesPourSauvegarde,
          reasons: selectedReasons
        }

        // MAJ Locale immédiate
        localUpdateTrade(tradeIdActuel, fullTrade)

        // Mise en file d'attente (UPDATE)
        ajouterALaFile({
          tradeId: tradeIdActuel,
          action: 'UPDATE',
          tradeData: tradePayload,
          steps: stepsPayload,
          reasons: selectedReasons,
          images: imagesPourSauvegarde
        })

      } else if (estDejaEnregistreEnBacktest && positionActive?.tradeIdSupabase) {
        // Mode Backtest - Étape 2 (Mise à jour / Résolution)
        const status = computeTradeStatus(formData, positionActive.estCloturee ? 'complete' : 'in_progress')
        const tradePayload = buildTradePayload(formData, status)
        const stepsPayload = buildStepPayloads(positionActive.tradeIdSupabase, formData, {
          biais: tempIds.biais, poi: tempIds.poi, entry: tempIds.entry, result: tempIds.result,
        })

        // On récupère le trade local
        const trades = useLocalDatabase.getState().trades
        const existingTrade = trades.find(t => t.id === positionActive.tradeIdSupabase)
        if (existingTrade) {
          localUpdateTrade(positionActive.tradeIdSupabase, {
            ...existingTrade,
            ...(tradePayload as any),
            steps: stepsPayload as any,
            images: imagesPourSauvegarde as any,
            reasons: selectedReasons as any
          })
        }

        // Mise en file d'attente (UPDATE)
        ajouterALaFile({
          tradeId: positionActive.tradeIdSupabase,
          action: 'UPDATE',
          tradeData: tradePayload,
          steps: stepsPayload,
          reasons: selectedReasons,
          images: imagesPourSauvegarde
        })

      } else {
        // Mode normal ou Backtest Étape 1 (Insertion initiale)
        const status = computeTradeStatus(formData, backtestMode ? 'in_progress' : 'in_progress')
        const tradeData = {
          id: tempIds.tradeId,
          user_id: userId,
          created_at: new Date().toISOString(),
          ...buildTradePayload(formData, status),
        }
        const stepsToInsert = buildStepPayloads(tempIds.tradeId, formData, {
          biais: tempIds.biais, poi: tempIds.poi, entry: tempIds.entry, result: tempIds.result,
        })

        // MAJ Locale immédiate
        addTrade({
          ...(tradeData as any),
          steps: stepsToInsert as any,
          images: imagesPourSauvegarde as any,
          reasons: selectedReasons as any
        })

        // Mise en file d'attente (INSERT)
        ajouterALaFile({
          tradeId: tempIds.tradeId,
          action: 'INSERT',
          tradeData: tradeData,
          steps: stepsToInsert,
          reasons: selectedReasons,
          images: imagesPourSauvegarde
        })
      }

      // 4️⃣ Toast et invalidation du cache React Query
      await queryClient.invalidateQueries({ queryKey: ['trades'] })
      addToast(
        isEditMode
          ? 'Trade mis à jour (Hors-Ligne)'
          : backtestMode && !positionActive?.estCloturee
            ? 'Planification du trade enregistrée (Hors-Ligne)'
            : 'Le trade a été enregistré (Hors-Ligne)',
        'success'
      )

      if (isEditMode && editingTrade) {
        // Réouvre le détail avec les données locales
        const updatedTrade = useLocalDatabase.getState().trades.find(t => t.id === editingTrade.id)
        if (updatedTrade) openDetail(updatedTrade as any)
      }

      // 5️⃣ On ferme le drawer
      fermerApresEnregistrement()

      // 6️⃣ Synchronisation avec le store de backtesting
      if (backtestMode) {
        if (positionActive?.estCloturee) {
          archiverPositionActive()
        } else {
          modifierPositionActive({
            tradeIdSupabase: tempIds.tradeId,
            stepIdsSupabase: {
              biais: tempIds.biais,
              poi: tempIds.poi,
              entry: tempIds.entry,
              result: tempIds.result,
            },
            planificationEnregistree: true,
          })
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erreur lors de la sauvegarde'
      addToast(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const enCours = saving || isUpdating || isCreatingQuick || analysantIA

  return (
    <>
      {isNewTradeOpen && !isInline && (
        <div className="fixed inset-0 bg-black/70 z-[90]" onClick={handleClose} />
      )}

      <aside
        className={cn(
          isInline
            ? 'relative w-full h-full bg-surface'
            : 'fixed top-0 right-0 h-full w-full md:w-[680px] bg-surface border-l border-border z-[100] transition-transform duration-300 ' + (isNewTradeOpen ? 'translate-x-0' : 'translate-x-full'),
          'flex flex-col'
        )}
      >
        {/* En-tête */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border flex-shrink-0">
          <button
            onClick={handleClose}
            disabled={enCours}
            className="md:hidden text-txt2 hover:text-txt text-lg leading-none disabled:opacity-50"
          >
            ←
          </button>
          <div className="flex-1 min-w-0">
            {backtestMode && positionActive ? (
              // En mode backtest : afficher le contexte de la position
              <>
                <h2 className="text-txt font-semibold text-sm tracking-tight">
                  {positionActive.estCloturee ? '🏁 Résolution du Trade' : '📋 Planification du Trade'}
                </h2>
                <p className="text-txt3 text-[11px] font-mono">
                  <span className={positionActive.direction === 'long' ? 'text-[#26a69a]' : 'text-[#ef5350]'}>
                    {positionActive.direction === 'long' ? '▲ LONG' : '▼ SHORT'}
                  </span>
                  {' · '}
                  <span>E: {positionActive.prixEntree.toFixed(5)}</span>
                  {' · '}
                  <span className="text-red-400">SL: {positionActive.stopLoss.toFixed(5)}</span>
                  {' · '}
                  <span className="text-emerald-400">TP: {positionActive.takeProfit.toFixed(5)}</span>
                  {positionActive.estCloturee && positionActive.pnl !== undefined && (
                    <span className={`ml-2 font-bold ${positionActive.pnl >= 0 ? 'text-[#26a69a]' : 'text-[#ef5350]'}`}>
                      {positionActive.pnl >= 0 ? '+' : ''}{positionActive.pnl.toFixed(2)}%
                    </span>
                  )}
                </p>
              </>
            ) : (
              // Mode journal normal
              <>
                <h2 className="text-txt font-semibold text-base tracking-tight">
                  {isEditMode ? 'Modifier le trade' : 'Nouveau trade'}
                </h2>
                {isEditMode && editingTrade && (
                  <p className="text-txt3 text-[12px] truncate">
                    {editingTrade.pair} · {editingTrade.direction.toUpperCase()} · {editingTrade.date_backtested}
                  </p>
                )}
              </>
            )}
          </div>
          <button
            onClick={handleClose}
            disabled={enCours}
            className="text-txt3 hover:text-txt text-xl leading-none disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        {/* Zone de contenu principale scrollable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          
          {/* Composant tout en haut : Sélection et mémorisation de la stratégie (Playbook) */}
          <StrategyHeaderSelector
            selectedStrategyId={formData.strategy_id}
            onSelectStrategy={handleSelectStrategy}
          />
          
          {/* Phase 0A : Drag/Drop d'images initial (Quick entry) */}
          {!isEditMode && !manualMode && (
            <ImageAnalysisUpload
              onAnalysisComplete={async ({ analysis, imageUrl }) => {
                try {
                  const res = await creerQuickEntry({ analysis, imageUrl })
                  openEditTrade(res.trade)
                  addToast('Graphique analysé et trade créé ! Complète les détails.', 'success')
                } catch (e: any) {
                  addToast(e.message || "Erreur lors de la création du trade par IA", 'error')
                }
              }}
              onManualMode={() => setManualMode(true)}
            />
          )}

          {/* Phase 0B : Sélection du point d'entrée du journal */}
          {!isEditMode && manualMode && !selectedStartType && (
            <TradeTypeSelector onSelect={(type) => setSelectedStartType(type)} />
          )}

          {/* Phase 1 : Formulaire principal structuré */}
          {manualMode && selectedStartType && (
            <div className="space-y-4">
              
              {/* Garde-fou visuel (Bannière d'avertissement) - Masqué en mode backtest */}
              {!backtestMode && globalInfosParDefaut && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-500 text-xs flex items-center gap-2">
                  <span>⚠️</span>
                  <span>Les informations globales du trade (Paire, Session, R:R...) semblent être par défaut. Pense à les modifier ou utilise l'assistant IA ci-dessous.</span>
                </div>
              )}

              {/* 1. Informations Globales (Masqué par défaut) - Masqué en mode backtest */}
              {!backtestMode && (
                <GlobalInfosPanel
                  formData={formData}
                  setFormData={setFormData}
                  onDefaultStatusChange={(isDef) => setGlobalInfosParDefaut(isDef)}
                />
              )}

              {/* En mode Backtest Étape 2 (Résolution) : option pour revoir si besoin le plan initial de l'Étape 1 */}
              {backtestMode && positionActive?.estCloturee && (
                <div className="flex items-center justify-between p-3 bg-surface2 border border-border2 rounded-lg text-xs">
                  <span className="text-txt3">Les informations d'avant-position (Étape 1) sont masquées.</span>
                  <button
                    type="button"
                    onClick={() => setAfficherPlanEtape1(!afficherPlanEtape1)}
                    className="text-accent font-semibold hover:underline flex items-center gap-1"
                  >
                    {afficherPlanEtape1 ? '🙈 Masquer le plan initial' : '👁️ Voir le plan initial (Étape 1)'}
                  </button>
                </div>
              )}

              {/* 2. Les 3 Panels de section (Biais, POI, Entrée) */}
              <TradeSectionPanel
                sectionKey="biais"
                title="Biais de Marché"
                icon="🧭"
                defaultOpen={selectedStartType === 'bias'}
                formData={formData}
                setFormData={setFormData}
                tradeId={isEditMode && editingTrade ? editingTrade.id : tempIds.tradeId}
                stepId={isEditMode && stepIds.biais ? stepIds.biais : tempIds.biais}
                selectedReasons={selectedReasons}
                setSelectedReasons={setSelectedReasons}
                masquerApres={backtestMode && !positionActive?.estCloturee}
                masquerAvant={backtestMode && positionActive?.estCloturee && !afficherPlanEtape1}
                onCaptureGraphique={onCaptureGraphique}
              />

              <TradeSectionPanel
                sectionKey="poi"
                title="Point d'Intérêt (POI)"
                icon="🎯"
                defaultOpen={selectedStartType === 'poi'}
                formData={formData}
                setFormData={setFormData}
                tradeId={isEditMode && editingTrade ? editingTrade.id : tempIds.tradeId}
                stepId={isEditMode && stepIds.poi ? stepIds.poi : tempIds.poi}
                selectedReasons={selectedReasons}
                setSelectedReasons={setSelectedReasons}
                masquerApres={backtestMode && !positionActive?.estCloturee}
                masquerAvant={backtestMode && positionActive?.estCloturee && !afficherPlanEtape1}
                onCaptureGraphique={onCaptureGraphique}
              />

              <TradeSectionPanel
                sectionKey="entry"
                title="Prise de Position & Entrée"
                icon="⚡"
                defaultOpen={selectedStartType === 'confirmation'}
                formData={formData}
                setFormData={setFormData}
                tradeId={isEditMode && editingTrade ? editingTrade.id : tempIds.tradeId}
                stepId={isEditMode && stepIds.entry ? stepIds.entry : tempIds.entry}
                selectedReasons={selectedReasons}
                setSelectedReasons={setSelectedReasons}
                masquerApres={backtestMode && !positionActive?.estCloturee}
                masquerAvant={backtestMode && positionActive?.estCloturee && !afficherPlanEtape1}
                onCaptureGraphique={onCaptureGraphique}
              />

              {/* 3. Section de Résolution (Bilan final - visible uniquement en mode backtest et quand la position est clôturée) */}
              {backtestMode && positionActive?.estCloturee && (
                <div className="border border-border2 rounded-xl overflow-hidden bg-surface mb-3 transition-all p-5 space-y-4">
                  <div className="flex items-center gap-2 border-b border-border/40 pb-2">
                    <span className="text-blue-500 text-xs">🏁</span>
                    <h3 className="text-xs font-bold text-txt uppercase tracking-wider">Résolution & Bilan du Trade (Après)</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-2 rounded bg-surface2 border border-border2">
                      <span className="text-txt3 block mb-0.5 uppercase text-[9px]">P&L réalisé</span>
                      <span className={`font-mono font-bold text-[13px] ${(positionActive.pnl || 0) >= 0 ? 'text-[#26a69a]' : 'text-[#ef5350]'}`}>
                        {(positionActive.pnl || 0) >= 0 ? '+' : ''}{(positionActive.pnl || 0).toFixed(2)}%
                      </span>
                    </div>
                    <div className="p-2 rounded bg-surface2 border border-border2">
                      <span className="text-txt3 block mb-0.5 uppercase text-[9px]">Résultat final</span>
                      <span className={`font-bold text-[13px] uppercase ${formData.result === 'win' ? 'text-[#26a69a]' : formData.result === 'loss' ? 'text-[#ef5350]' : 'text-txt'}`}>
                        {formData.result === 'win' ? '✓ WIN' : formData.result === 'loss' ? '✗ LOSS' : '— BE'}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-txt3 text-[10px] font-bold uppercase tracking-wider block">Notes de clôture / Bilan</label>
                    <textarea
                      className="w-full min-h-[80px] p-2.5 bg-surface2 border border-border2 rounded-lg text-txt text-[12px] placeholder:text-txt3 focus:outline-none focus:border-accent"
                      placeholder="Décris comment le trade s'est déroulé, tes émotions ou si tu as respecté ton plan..."
                      value={formData.description || ''}
                      onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              {/* 4. Assistant IA (Remplissage rapide si des images existent) - Masqué en mode backtest */}
              {!backtestMode && (
                <IAAnalysisPanel
                  images={toutesLesImages}
                  analysantIA={analysantIA}
                  onAnalyze={analyserImageSelectionnee}
                />
              )}

            </div>
          )}
        </div>

        {/* Barre d'action inférieure (si le formulaire est actif) */}
        {(isEditMode || (manualMode && selectedStartType)) && (
          <div className="flex justify-end gap-3 px-5 py-4 border-t border-border flex-shrink-0 bg-surface">
            <button
              onClick={resetAndClose}
              disabled={enCours}
              className="px-4 py-2 border border-border2 rounded-md text-txt2 text-[13px] font-medium hover:bg-surface2 hover:text-txt transition-colors disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              onClick={() => handleSave(false)}
              disabled={enCours}
              className="px-4 py-2 bg-accent text-white rounded-md text-[13px] font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {saving
                ? 'Enregistrement...'
                : isEditMode
                  ? 'Mettre à jour'
                  : backtestMode
                    ? positionActive?.estCloturee
                      ? 'Enregistrer & Clôturer'
                      : 'Enregistrer la Planification'
                    : 'Enregistrer'}
            </button>
          </div>
        )}

        {/* Dialogue de rappel anti-oubli (garde-fou) */}
        {showRappelDialog && (
          <div className="absolute inset-0 bg-black/85 z-[150] flex items-center justify-center p-6 animate-fadeIn animate-duration-200">
            <div className="bg-surface border border-border rounded-xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
              <div className="text-center space-y-2">
                <span className="text-3xl">⚠️</span>
                <h3 className="text-txt font-semibold text-sm">Données non modifiées</h3>
                <p className="text-txt3 text-xs leading-relaxed">
                  Tu t'apprêtes à enregistrer ce trade avec les informations globales par défaut. Es-tu sûr de vouloir continuer ou souhaites-tu d'abord les modifier ?
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-2 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => handleSave(true)}
                  className="w-full py-2 bg-accent text-white hover:bg-accent/90 transition-colors rounded-md text-xs font-semibold text-center"
                >
                  💾 Enregistrer quand même
                </button>
                <button
                  type="button"
                  onClick={() => setShowRappelDialog(false)}
                  className="w-full py-2 bg-surface2 border border-border2 text-txt hover:bg-surface transition-colors rounded-md text-xs font-semibold text-center"
                >
                  Modifier les informations
                </button>
              </div>
            </div>
          </div>
        )}

      </aside>
    </>
  )
}
