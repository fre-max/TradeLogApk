import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ReasonFamily, ReasonFamilyInsert } from '@/types'
import { useLocalDatabase } from '@/store/useLocalDatabase'

const QUERY_KEY = ['reason_families'] as const

/**
 * Récupère la liste des familles de raisons (Entrée, TP, etc.) - Lecture locale
 */
export function useReasonFamilies() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<ReasonFamily[]> => {
      let families = useLocalDatabase.getState().reasonFamilies
      
      // Si la base locale est vide, on initialise avec les familles par défaut
      if (families.length === 0) {
        const systemFamilies: ReasonFamily[] = [
          { id: crypto.randomUUID(), user_id: 'local-user', name: 'Raisons Biais — Avant Position', icon: '🧭', order: 0, slug: 'biais_avant', created_at: new Date().toISOString() },
          { id: crypto.randomUUID(), user_id: 'local-user', name: 'Raisons Biais — Après Dénouement', icon: '🔄', order: 1, slug: 'biais_apres', created_at: new Date().toISOString() },
          { id: crypto.randomUUID(), user_id: 'local-user', name: 'Raisons POI — Avant Position', icon: '🎯', order: 2, slug: 'poi_avant', created_at: new Date().toISOString() },
          { id: crypto.randomUUID(), user_id: 'local-user', name: 'Raisons POI — Après Dénouement', icon: '🔄', order: 3, slug: 'poi_apres', created_at: new Date().toISOString() },
          { id: crypto.randomUUID(), user_id: 'local-user', name: 'Raisons Entrée — Avant Position', icon: '⚡', order: 4, slug: 'entree_avant', created_at: new Date().toISOString() },
          { id: crypto.randomUUID(), user_id: 'local-user', name: 'Raisons Entrée — Après Dénouement', icon: '🔄', order: 5, slug: 'entree_apres', created_at: new Date().toISOString() },
        ]
        useLocalDatabase.getState().setReasonFamilies(systemFamilies)
        families = systemFamilies
      }
      
      // Trier par ordre croissant
      return [...families].sort((a, b) => (a.order || 0) - (b.order || 0))
    },
  })
}

/**
 * Crée une nouvelle famille
 */
export function useCreateReasonFamily() {
  const queryClient = useQueryClient()
  const { reasonFamilies, setReasonFamilies } = useLocalDatabase()

  return useMutation({
    mutationFn: async (family: ReasonFamilyInsert) => {
      // 1. Sauvegarde locale immédiate
      const newFamily: ReasonFamily = {
        ...(family as any),
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        user_id: 'local-user',
      }
      
      setReasonFamilies([...reasonFamilies, newFamily])

      // 2. Envoi asynchrone à Supabase
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          supabase.from('reason_families').insert({ ...family, user_id: user.id, id: newFamily.id }).then(({ error }) => {
            if (error) console.error('Erreur sync reason_family:', error)
          })
        }
      })

      return newFamily
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

/**
 * Supprime une famille (supprimera en cascade les raisons associées)
 */
export function useDeleteReasonFamily() {
  const queryClient = useQueryClient()
  const { reasonFamilies, setReasonFamilies } = useLocalDatabase()

  return useMutation({
    mutationFn: async (id: string) => {
      // 1. Suppression locale immédiate
      setReasonFamilies(reasonFamilies.filter(f => f.id !== id))

      // 2. Suppression asynchrone sur Supabase
      supabase.from('reason_families').delete().eq('id', id).then(({ error }) => {
        if (error) console.error('Erreur suppression reason_family:', error)
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ['reason_catalog'] })
    },
  })
}

/**
 * Met à jour le nom d'une famille
 */
export function useUpdateReasonFamily() {
  const queryClient = useQueryClient()
  const { reasonFamilies, setReasonFamilies } = useLocalDatabase()

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      // 1. Modification locale
      setReasonFamilies(reasonFamilies.map(f => 
        f.id === id ? { ...f, name } : f
      ))

      // 2. Modification asynchrone
      supabase.from('reason_families').update({ name }).eq('id', id).then(({ error }) => {
        if (error) console.error('Erreur update reason_family:', error)
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

