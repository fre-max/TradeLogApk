import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { TradeInsert, TradeWithSteps } from '@/types'
import {
  buildStepPayloads,
  buildTradePayload,
  computeTradeStatus,
  type EditStepIds,
  type FormDataState,
} from '@/lib/tradeForm'
import { useOfflineSyncStore } from '@/store/offlineSyncStore'
import { useLocalDatabase } from '@/store/useLocalDatabase'

const QUERY_KEY = ['trades'] as const

// Récupère tous les trades de manière instantanée et réactive depuis le store local
export function useTrades() {
  const trades = useLocalDatabase((state) => state.trades)

  return {
    data: trades,
    isLoading: false,
    isError: false,
  }
}

// Récupère un trade individuel de manière réactive depuis le store local
export function useTrade(id: string) {
  const trade = useLocalDatabase((state) => state.trades.find((t) => t.id === id))

  return {
    data: trade,
    isLoading: false,
    isError: !trade,
  }
}

// Create trade (Écriture locale puis file d'attente Supabase)
export function useCreateTrade() {
  const queryClient = useQueryClient()
  const { ajouterALaFile } = useOfflineSyncStore()
  const { addTrade } = useLocalDatabase()

  return useMutation({
    mutationFn: async (trade: TradeInsert) => {
      // 1. Sauvegarde instantanée en local (Mode Offline-First)
      const newTradeId = crypto.randomUUID()
      let userId = 'local-user'
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user?.id) userId = session.user.id
      } catch (e) {
        // Mode hors ligne
      }

      const localTrade: TradeWithSteps = {
        ...(trade as any),
        id: newTradeId,
        created_at: new Date().toISOString(),
        user_id: userId,
        steps: [],
        images: [],
      }
      
      addTrade(localTrade)

      // 2. Mise en file d'attente pour Supabase (se synchronisera quand la session sera active)
      ajouterALaFile({
        tradeId: newTradeId,
        action: 'INSERT',
        tradeData: { ...trade, id: newTradeId, user_id: userId }
      })

      return localTrade
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}

// Delete trade (Suppression locale puis file d'attente)
export function useDeleteTrade() {
  const queryClient = useQueryClient()
  const { deleteTrade } = useLocalDatabase()
  const { ajouterALaFile } = useOfflineSyncStore()

  return useMutation({
    mutationFn: async (id: string) => {
      // Suppression locale immédiate
      deleteTrade(id)

      // Mise en file d'attente pour Supabase
      ajouterALaFile({
        tradeId: id,
        action: 'DELETE',
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}

// Synchronise les images d'une étape entre le formulaire et la base de données
// Supprime les images retirées et insère les nouvelles
async function synchroniserStepImages(
  stepId: string,
  imagesForm: { id: string; url: string; source: string; phase?: string }[]
) {
  // Déprécié : la gestion des images passe par trade_images directement
  console.log(`📡 [syncImages] Bypass de synchronisation des images pour le step : ${stepId}`);
  return;
}



interface UpdateTradeInput {
  tradeId: string
  formData: FormDataState
  stepIds: EditStepIds
  previousStatus: TradeWithSteps['status']
  preserveBiaisFields?: Record<string, unknown> | null
}

/** Met à jour un trade existant et ses étapes. */
export function useUpdateTrade() {
  const queryClient = useQueryClient()
  const { updateTrade, trades } = useLocalDatabase()

  return useMutation({
    mutationFn: async ({
      tradeId,
      formData,
      stepIds,
      previousStatus,
      preserveBiaisFields,
    }: UpdateTradeInput): Promise<TradeWithSteps> => {
      const status = computeTradeStatus(formData, previousStatus)
      const tradePayload = buildTradePayload(formData, status)
      
      // 1. Mise à jour immédiate en local
      const existingTrade = trades.find((t) => t.id === tradeId)
      if (!existingTrade) throw new Error('Trade introuvable en local')

      const stepsPayload = buildStepPayloads(tradeId, formData, stepIds, preserveBiaisFields)
      
      const fullTrade: TradeWithSteps = {
        ...existingTrade,
        ...(tradePayload as any),
        steps: stepsPayload as any, // Remplacement local des étapes
      }

      updateTrade(tradeId, fullTrade)

      // 2. Mise à jour asynchrone sur Supabase (uniquement si connecté au réseau)
      if (navigator.onLine) {
        supabase.from('trades').update(tradePayload).eq('id', tradeId).then(async ({ error: tradeError }) => {
          if (tradeError) {
            console.error('Erreur de mise à jour du trade sur Supabase:', tradeError)
            return
          }

          for (const step of stepsPayload) {
            if (step.id) {
              const { id, ...stepData } = step
              const { error: stepError } = await supabase.from('steps').upsert({ id, ...stepData })
              if (stepError) console.error('Erreur upsert step sur Supabase:', stepError)
            }
          }

          // Détection des news asynchrone
          if (fullTrade.date_backtested && fullTrade.entry_time && fullTrade.exit_time) {
            supabase.auth.getSession().then(({ data: { session } }) => {
              const token = session?.access_token
              if (!token) return;
              
              supabase.functions.invoke('detect-news', {
                body: {
                  trade_id: fullTrade.id,
                  pair: fullTrade.pair,
                  date: fullTrade.date_backtested,
                  entry_time: fullTrade.entry_time,
                  exit_time: fullTrade.exit_time,
                },
                headers: { Authorization: `Bearer ${token}` }
              })
              .then(() => queryClient.invalidateQueries({ queryKey: QUERY_KEY }))
              .catch(err => console.error('Erreur detect-news:', err))
            })
          }
        })
      } else {
        // En mode hors-ligne, on ajoute la mise à jour dans la file d'attente de synchronisation
        useOfflineSyncStore.getState().ajouterALaFile({
          tradeId,
          action: 'UPDATE',
          tradeData: tradePayload,
          steps: stepsPayload,
        })
      }

      return fullTrade
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}
