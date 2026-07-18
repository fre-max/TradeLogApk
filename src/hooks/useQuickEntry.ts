import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { TradeWithSteps } from '@/types'

// ─── Type pour les données extraites par Gemini Vision ────────────────────────
// Représente le JSON retourné par api/analyze.ts ou api/telegram.ts

export interface GeminiAnalysis {
  pair: string | null
  direction: 'long' | 'short' | null
  entry_price: number | null
  sl: number | null
  tp: number | null
  timeframe: string | null
  session: string | null
  rr: number | null
  rr_realized?: number | null
  result?: 'win' | 'loss' | 'breakeven' | null
  date_backtested?: string | null
  entry_time?: string | null
  exit_time?: string | null
  patterns: string[]
  confidence: {
    pair: number
    direction: number
    entry_price: number
    sl: number
    tp: number
    date_backtested?: number
    entry_time?: number
    exit_time?: number
  }
}

// ─── Type pour le résultat retourné par le hook ───────────────────────────────

export interface QuickEntryResult {
  tradeId: string
  analysis: GeminiAnalysis
  trade: TradeWithSteps
}

/**
 * Hook pour créer un trade rapide (Quick Entry) depuis les données Gemini.
 * 
 * Crée le trade en status 'quick' dans Supabase, crée l'étape "Infos générales"
 * avec les données pré-remplies, attache l'image Telegram, puis invalide
 * le cache React Query pour rafraîchir la liste des trades.
 * 
 * Exemple :
 * const { mutateAsync: creerQuickEntry, isPending } = useQuickEntry()
 * const resultat = await creerQuickEntry({ analysis: dataGemini, imageUrl: '...' })
 */
export function useQuickEntry() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      analysis,
      imageUrl
    }: {
      analysis: GeminiAnalysis
      imageUrl: string
    }): Promise<QuickEntryResult> => {
      console.log('🚀 [useQuickEntry] Début création trade rapide...')

      // 1️⃣ Récupérer l'utilisateur connecté via Supabase Auth
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        throw new Error('Utilisateur non connecté ou session expirée')
      }
      console.log('👤 [useQuickEntry] Utilisateur connecté :', user.id)

      // Auto-déduire exit_type
      const autoExitType = analysis.result === 'win' ? 'tp' : (analysis.result === 'loss' ? 'sl' : (analysis.result === 'breakeven' ? 'breakeven' : null))

      // 2️⃣ Créer le trade principal avec status 'quick'
      const tradeData = {
        user_id: user.id,
        pair: analysis.pair || 'XAUUSD',
        direction: (analysis.direction || 'long') as 'long' | 'short',
        session: analysis.session || 'London',
        date_backtested: analysis.date_backtested || new Date().toISOString().split('T')[0],
        entry_time: analysis.entry_time || null,
        exit_time: analysis.exit_time || null,
        result: analysis.result || null,
        rr_planned: analysis.rr ?? null,
        rr_realized: analysis.rr_realized ?? null,
        exit_type: autoExitType,
        emotion: null,
        status: 'quick' as const,
      }

      console.log('📡 [useQuickEntry] Insertion du trade en BDD...', tradeData)
      const { data: insertedTrade, error: tradeError } = await supabase
        .from('trades')
        .insert(tradeData)
        .select()
        .single()

      if (tradeError || !insertedTrade) {
        throw tradeError || new Error('Erreur lors de la création du trade')
      }
      console.log('✅ [useQuickEntry] Trade créé, ID :', insertedTrade.id)

      // 3️⃣ Créer l'étape "Infos générales (Quick Entry)" avec les données Gemini
      const stepData = {
        trade_id: insertedTrade.id,
        order: 0,
        type: 'biais',
        title: 'Quick Entry — IA',
        timeframe: analysis.timeframe || null,
        notes: analysis.patterns?.length
            ? `Patterns SMC identifiés : ${analysis.patterns.join(', ')}`
            : null,
        // On stocke les données Gemini + les niveaux de confiance dans fields
        fields: {
          is_quick_entry: true,
          extracted: analysis,
          entry_price: analysis.entry_price,
          sl: analysis.sl,
          tp: analysis.tp,
          rr: analysis.rr,
          rr_realized: analysis.rr_realized,
          exit_time: analysis.exit_time,
          patterns: analysis.patterns,
          confidence: analysis.confidence,
        },
      }

      console.log('📡 [useQuickEntry] Insertion de l\'étape initiale...')
      const { data: insertedStep, error: stepError } = await supabase
        .from('steps')
        .insert(stepData)
        .select()
        .single()

      if (stepError || !insertedStep) {
        throw stepError || new Error('Erreur lors de la création de l\'étape')
      }
      console.log('✅ [useQuickEntry] Étape créée, ID :', insertedStep.id)

      // 4️⃣ Attacher l'image Telegram à l'étape créée
      const { error: imageError } = await supabase
        .from('step_images')
        .insert({
          step_id: insertedStep.id,
          source: 'telegram',
          url: imageUrl,
          storage_path: null,
        })

      if (imageError) {
        console.error('⚠️ [useQuickEntry] Erreur lors de l\'attachement de l\'image :', imageError)
      } else {
        console.log('✅ [useQuickEntry] Image Telegram attachée à l\'étape')
      }

      // 5️⃣ Déclencher automatiquement la détection des news économiques en arrière-plan (non bloquant)
      if (insertedTrade.date_backtested && insertedTrade.entry_time && insertedTrade.exit_time) {
        console.log('📡 [useQuickEntry] Déclenchement asynchrone de la détection des news...')
        
        supabase.auth.getSession().then(({ data: { session } }) => {
          const token = session?.access_token
          
          supabase.functions.invoke('detect-news', {
            body: {
              trade_id: insertedTrade.id,
              pair: insertedTrade.pair,
              date: insertedTrade.date_backtested,
              entry_time: insertedTrade.entry_time,
              exit_time: insertedTrade.exit_time,
            },
            headers: token ? { Authorization: `Bearer ${token}` } : undefined
          })
          .then(() => {
            console.log('✅ [useQuickEntry] Détection des news terminée en tâche de fond')
            queryClient.invalidateQueries({ queryKey: ['trades'] })
          })
          .catch((newsErr) => {
            console.error('❌ [useQuickEntry] Échec de l\'appel asynchrone à detect-news :', newsErr)
          })
        })
      }

      // 6️⃣ Recharger le trade complet avec étapes et images pour le renvoyer
      const { data: fullTrade, error: refetchError } = await supabase
        .from('trades')
        .select(`
          *,
          steps (
            *,
            images: step_images (*)
          )
        `)
        .eq('id', insertedTrade.id)
        .single()

      if (refetchError || !fullTrade) {
        throw refetchError || new Error('Erreur lors du rechargement final du trade')
      }

      return {
        tradeId: insertedTrade.id,
        analysis,
        trade: fullTrade as TradeWithSteps,
      }
    },

    // 7️⃣ Après la création réussie, invalider le cache pour rafraîchir le tableau
    onSuccess: (resultat) => {
      console.log('✅ [useQuickEntry] Trade rapide créé ! Invalidation du cache React Query...')
      queryClient.invalidateQueries({ queryKey: ['trades'] })
      console.log('✅ [useQuickEntry] Cache invalidé, trade ID :', resultat.tradeId)
    },

    onError: (error: any) => {
      console.error('❌ [useQuickEntry] Échec de la création du trade rapide :', error)
    },
  })
}
