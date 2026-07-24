import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { TradeImage } from '@/types'

export function useTradeImages(tradeId: string | undefined) {
  return useQuery({
    queryKey: ['trade_images', tradeId],
    queryFn: async () => {
      if (!tradeId) return []
      // En mode hors-ligne, lire la base locale Zustand/IndexedDB
      if (!navigator.onLine) {
        const { useLocalDatabase } = await import('@/store/useLocalDatabase')
        const trade = useLocalDatabase.getState().trades.find(t => t.id === tradeId)
        return trade?.images || []
      }
      try {
        const { data, error } = await supabase
          .from('trade_images')
          .select('*')
          .eq('trade_id', tradeId)
          
        if (error) throw error
        return data as TradeImage[]
      } catch (err) {
        console.warn('⚠️ [useTradeImages] Erreur réseau/Supabase, repli sur le cache local :', err)
        const { useLocalDatabase } = await import('@/store/useLocalDatabase')
        const trade = useLocalDatabase.getState().trades.find(t => t.id === tradeId)
        return trade?.images || []
      }
    },
    enabled: !!tradeId
  })
}

export function useSaveTradeImages() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ tradeId, images }: { tradeId: string, images: Partial<TradeImage>[] }) => {
      console.log('🚀 [useSaveTradeImages] Sauvegarde des images en local pour le trade:', tradeId)
      const { useLocalDatabase } = await import('@/store/useLocalDatabase');
      const { updateTrade, trades } = useLocalDatabase.getState();
      
      const trade = trades.find(t => t.id === tradeId);
      if (trade) {
        // MAJ locale
        const finalImages = images.map(img => ({
          ...img,
          trade_id: tradeId,
          source: img.source || 'upload',
          storage_path: img.storage_path || null
        })) as TradeImage[];
        updateTrade(tradeId, { ...trade, images: finalImages });
      }

      // Supabase en arrière-plan (sans bloquer si on est hors ligne)
      // L'OfflineSyncManager s'occupera d'uploader les Base64 plus tard
      // Mais on garde un push simple ici pour les cas connectés
      const runSupabaseUpdate = async () => {
        try {
          // Si on est pas en ligne ou que les images sont des base64 locaux, on laisse l'OfflineSyncManager s'en occuper
          if (!navigator.onLine) return;
          const hasLocalBase64 = images.some(img => img.storage_path?.startsWith('local_pending') || img.url?.startsWith('data:image/'));
          if (hasLocalBase64) return; // SyncManager le fera
          
          await supabase.from('trade_images').delete().eq('trade_id', tradeId)
          if (images.length > 0) {
            const inserts = images.map(img => ({
              trade_id: tradeId,
              phase: img.phase!,
              context: img.context!,
              url: img.url!,
              source: img.source || 'upload',
              storage_path: img.storage_path || null
            }))
            await supabase.from('trade_images').insert(inserts)
          }
        } catch (e) {
          console.error('Erreur Supabase save images background', e);
        }
      }
      runSupabaseUpdate();
      
      console.log('✅ [useSaveTradeImages] Images sauvegardées localement !')
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['trade_images', vars.tradeId] })
      queryClient.invalidateQueries({ queryKey: ['trades'] })
    }
  })
}
