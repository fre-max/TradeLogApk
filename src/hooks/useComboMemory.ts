import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ComboMemory } from '@/types'

export function useComboMemory(fieldKey: string) {
  const queryClient = useQueryClient()

  const { data: suggestions = [] } = useQuery({
    queryKey: ['combo_memory', fieldKey],
    queryFn: async (): Promise<ComboMemory[]> => {
      const { data, error } = await supabase
        .from('combo_memory')
        .select('*')
        .eq('field_key', fieldKey)
        .order('used_count', { ascending: false })
        .limit(20)

      if (error) throw error
      return data
    },
  })

  const { mutate: saveValue } = useMutation({
    mutationFn: async (value: string) => {
      const existing = suggestions.find((s) => s.value === value)

      if (existing) {
        await supabase
          .from('combo_memory')
          .update({ used_count: existing.used_count + 1, last_used: new Date().toISOString() })
          .eq('id', existing.id)
      } else {
        await supabase
          .from('combo_memory')
          .insert({ field_key: fieldKey, value, used_count: 1, last_used: new Date().toISOString() })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['combo_memory', fieldKey] })
    },
  })

  return { suggestions, saveValue }
}
