import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// ─── Type partagé ────────────────────────────────────────────
// Représente une raison sélectionnée avec sa variante choisie
export interface SelectedTradeReason {
  reason_id: string
  variant_name: string
}

/**
 * Récupère les raisons ET leurs variantes associées à un trade spécifique.
 * Retourne un tableau d'objets { reason_id, variant_name }
 *
 * Exemple :
 * const { data: raisons } = useTradeReasons('uuid-trade')
 * // data = [{ reason_id: '...', variant_name: 'Mineur' }, ...]
 */
export function useTradeReasons(tradeId: string | undefined) {
  return useQuery({
    queryKey: ['trade_reasons', tradeId],
    queryFn: async (): Promise<SelectedTradeReason[]> => {
      if (!tradeId) return []
      
      const { useLocalDatabase } = await import('@/store/useLocalDatabase')
      const trade = useLocalDatabase.getState().trades.find(t => t.id === tradeId)
      
      if (trade && trade.reasons) {
        return trade.reasons.map(r => ({
          reason_id: r.reason_id,
          variant_name: r.variant_name || 'Standard'
        }))
      }
      return []
    },
    enabled: !!tradeId,
  })
}

/**
 * Sauvegarde les raisons (avec variantes) pour un trade — remplace les existantes.
 *
 * Exemple :
 * await saveTradeReasons({
 *   tradeId: '...',
 *   reasons: [{ reason_id: '...', variant_name: 'Mineur' }]
 * })
 */
export function useSaveTradeReasons() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      tradeId,
      reasons,
      // Compatibilité avec l'ancien système qui passait juste des IDs
      reasonIds,
    }: {
      tradeId: string
      reasons?: SelectedTradeReason[]
      reasonIds?: string[]
    }) => {
      console.log('🚀 [useSaveTradeReasons] Sauvegarde pour le trade:', tradeId)

      // 1. Supprimer les anciennes raisons pour ce trade
      const { error: deleteError } = await supabase
        .from('trade_reasons')
        .delete()
        .eq('trade_id', tradeId)

      if (deleteError) throw deleteError

      // 2. Construire la liste des raisons à insérer
      // Priorité aux objets complets (reasons), sinon on utilise les IDs simples
      const listeAReinseree: SelectedTradeReason[] = reasons
        ? reasons
        : (reasonIds ?? []).map(id => ({ reason_id: id, variant_name: 'Standard' }))

      if (listeAReinseree.length === 0) {
        console.log('✅ [useSaveTradeReasons] Aucune raison à sauvegarder')
        return
      }

      // 3. Insérer les nouvelles raisons
      const inserts = listeAReinseree.map(r => ({
        trade_id: tradeId,
        reason_id: r.reason_id,
        variant_name: r.variant_name || 'Standard',
      }))

      const { error: insertError } = await supabase
        .from('trade_reasons')
        .insert(inserts)

      if (insertError) throw insertError

      console.log('✅ [useSaveTradeReasons] Raisons sauvegardées :', inserts.length)
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['trade_reasons', variables.tradeId] })
      queryClient.invalidateQueries({ queryKey: ['trades'] })
    },
  })
}
