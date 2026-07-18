import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ReasonCatalogItem, ReasonCatalogInsert, ReasonVariantInsert } from '@/types'
import { useLocalDatabase } from '@/store/useLocalDatabase'

const QUERY_KEY = ['reason_catalog'] as const

/**
 * Hook pour récupérer la liste complète des raisons techniques avec leurs variantes.
 * Lecture locale prioritaire (Offline-First)
 */
export function useCatalog() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<ReasonCatalogItem[]> => {
      const items = useLocalDatabase.getState().catalogItems
      
      // Tri par date de création décroissante (plus récent en premier)
      return [...items].sort((a, b) => 
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      )
    },
  })
}

/**
 * Hook pour filtrer le catalogue de raisons par le slug d'une famille.
 */
export function useCatalogByFamilySlug(slug: string) {
  const query = useCatalog()
  const data = query.data ? query.data.filter((item: any) => item.family?.slug === slug) : undefined
  return { ...query, data }
}

interface CreateCatalogItemInput {
  item: ReasonCatalogInsert
  variants: Omit<ReasonVariantInsert, 'reason_id'>[]
}

/**
 * Hook pour créer une nouvelle raison technique dans le catalogue avec ses variantes associées.
 */
export function useCreateCatalogItem() {
  const queryClient = useQueryClient()
  const { catalogItems, setCatalogItems, reasonFamilies } = useLocalDatabase()

  return useMutation({
    mutationFn: async ({ item, variants }: CreateCatalogItemInput) => {
      // 1. Création locale
      const newId = crypto.randomUUID()
      const family = reasonFamilies.find(f => f.id === item.family_id)
      
      let type = 'confirmation'
      if (family) {
        const familyName = family.name.toLowerCase()
        if (familyName.includes('biais')) type = 'biais'
        else if (familyName.includes('poi') || familyName.includes('zone')) type = 'poi'
        else if (familyName.includes('sl') || familyName.includes('stop loss') || familyName.includes('loss')) type = 'sl'
        else if (familyName.includes('tp') || familyName.includes('take profit') || familyName.includes('profit')) type = 'tp'
        else if (familyName.includes('trailing')) type = 'trailing'
        else if (familyName.includes('entr') || familyName.includes('setup')) type = 'entry'
      }

      const newItem: ReasonCatalogItem = {
        ...(item as any),
        id: newId,
        created_at: new Date().toISOString(),
        user_id: 'local-user',
        type,
        family: family || null,
        variants: variants.map(v => ({ ...v, id: crypto.randomUUID(), reason_id: newId })) as any
      }

      setCatalogItems([newItem, ...catalogItems])

      // 2. Envoi asynchrone à Supabase
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return;
        supabase.from('reason_catalog').insert({ ...item, user_id: user.id, id: newId }).then(({ error }) => {
          if (error) { console.error('Erreur insert catalog:', error); return; }
          
          if (variants.length > 0) {
            const variantsToInsert = variants.map((v, index) => ({
              ...v,
              id: newItem.variants?.[index]?.id,
              reason_id: newId,
            }))
            supabase.from('reason_variants').insert(variantsToInsert).then(({ error: vError }) => {
              if (vError) console.error('Erreur insert variants:', vError)
            })
          }
        })
      })

      return newItem
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

interface UpdateCatalogItemInput {
  id: string
  item: Partial<ReasonCatalogInsert>
  variants: Omit<ReasonVariantInsert, 'reason_id'>[]
}

/**
 * Hook pour modifier une raison technique existante et ses variantes.
 */
export function useUpdateCatalogItem() {
  const queryClient = useQueryClient()
  const { catalogItems, setCatalogItems } = useLocalDatabase()

  return useMutation({
    mutationFn: async ({ id, item, variants }: UpdateCatalogItemInput) => {
      // 1. Mise à jour locale
      const updatedItems = catalogItems.map(catalogItem => {
        if (catalogItem.id === id) {
          return {
            ...catalogItem,
            ...item,
            variants: variants.map(v => ({ ...v, id: crypto.randomUUID(), reason_id: id })) as any
          }
        }
        return catalogItem
      })
      setCatalogItems(updatedItems)

      // 2. Mise à jour asynchrone
      supabase.from('reason_catalog').update(item).eq('id', id).then(({ error }) => {
        if (error) { console.error('Erreur update catalog:', error); return; }
        
        supabase.from('reason_variants').delete().eq('reason_id', id).then(({ error: delError }) => {
          if (delError) { console.error('Erreur delete variants:', delError); return; }
          
          if (variants.length > 0) {
            const variantsToInsert = variants.map(v => ({ ...v, reason_id: id }))
            supabase.from('reason_variants').insert(variantsToInsert).then(({ error: insError }) => {
              if (insError) console.error('Erreur insert variants:', insError)
            })
          }
        })
      })

      return updatedItems.find(i => i.id === id) as ReasonCatalogItem
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

/**
 * Hook pour supprimer un concept technique du catalogue.
 */
export function useDeleteCatalogItem() {
  const queryClient = useQueryClient()
  const { catalogItems, setCatalogItems } = useLocalDatabase()

  return useMutation({
    mutationFn: async (id: string) => {
      // 1. Suppression locale
      setCatalogItems(catalogItems.filter(i => i.id !== id))

      // 2. Suppression asynchrone
      supabase.from('reason_catalog').delete().eq('id', id).then(({ error }) => {
        if (error) console.error('Erreur delete catalog:', error)
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}
