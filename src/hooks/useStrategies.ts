import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Strategy, StrategyInsert } from '@/types'
import { useLocalDatabase } from '@/store/useLocalDatabase'

const QUERY_KEY = ['strategies'] as const

// Récupérer toutes les stratégies (Lecture locale)
export function useStrategies() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<Strategy[]> => {
      return useLocalDatabase.getState().strategies
    },
  })
}

// Créer une nouvelle stratégie
export function useCreateStrategy() {
  const queryClient = useQueryClient()
  const { strategies, setStrategies } = useLocalDatabase()

  return useMutation({
    mutationFn: async (strategy: StrategyInsert) => {
      // 1. Sauvegarde locale immédiate
      const newStrategy: Strategy = {
        ...(strategy as any),
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        user_id: 'local-user', // ID temporaire
      }
      
      setStrategies([newStrategy, ...strategies])

      // 2. Envoi asynchrone à Supabase (si connecté)
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          supabase.from('strategies').insert({ ...strategy, user_id: user.id, id: newStrategy.id }).then(({ error }) => {
            if (error) console.error('Erreur sync stratégie:', error)
          })
        }
      })

      return newStrategy
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}

// Mettre à jour une stratégie
export function useUpdateStrategy() {
  const queryClient = useQueryClient()
  const { strategies, setStrategies } = useLocalDatabase()

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Strategy> & { id: string }) => {
      // 1. Sauvegarde locale immédiate
      const updatedStrategies = strategies.map(s => 
        s.id === id ? { ...s, ...updates } : s
      )
      setStrategies(updatedStrategies)

      // 2. Envoi asynchrone à Supabase
      supabase.from('strategies').update(updates).eq('id', id).then(({ error }) => {
        if (error) console.error('Erreur update stratégie:', error)
      })

      return updatedStrategies.find(s => s.id === id) as Strategy
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}

// Supprimer une stratégie
export function useDeleteStrategy() {
  const queryClient = useQueryClient()
  const { strategies, setStrategies } = useLocalDatabase()

  return useMutation({
    mutationFn: async (id: string) => {
      // 1. Suppression locale immédiate
      setStrategies(strategies.filter(s => s.id !== id))

      // 2. Suppression asynchrone
      supabase.from('strategies').delete().eq('id', id).then(({ error }) => {
        if (error) console.error('Erreur suppression stratégie:', error)
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ['trades'] })
    },
  })
}
