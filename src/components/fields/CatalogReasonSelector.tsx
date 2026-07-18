import { useState, useRef, useEffect } from 'react'
import { useCatalog } from '@/hooks/useCatalog'
import type { ReasonType, ReasonCatalogItem } from '@/types'
import { cn } from '@/lib/utils'

interface CatalogReasonRef {
  reason_id: string
  variant_name: string
}

interface CatalogReasonSelectorProps {
  contextType: ReasonType | ReasonType[] // Types de raisons à proposer
  value: CatalogReasonRef[]
  onChange: (newValue: CatalogReasonRef[]) => void
  placeholder?: string
}

/**
 * Sélecteur interactif pour associer des concepts techniques du catalogue à un trade.
 * Affiche les concepts sélectionnés sous forme de badges et permet d'ajouter de nouveaux
 * concepts avec leurs variantes.
 * 
 * Exemple d'utilisation :
 * <CatalogReasonSelector
 *   contextType="sl"
 *   value={formData.sl_catalog_reasons}
 *   onChange={(val) => updateField('sl_catalog_reasons', val)}
 * />
 */
export function CatalogReasonSelector({
  contextType,
  value,
  onChange,
  placeholder = "Associer un concept technique...",
}: CatalogReasonSelectorProps) {
  const { data: catalogItems = [], isLoading } = useCatalog()
  const [isOpen, setIsOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<ReasonCatalogItem | null>(null)
  
  const containerRef = useRef<HTMLDivElement>(null)

  // Fermer le menu lors d'un clic en dehors
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSelectedItem(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filtrer les concepts techniques selon le contexte demandé
  const typesCibles = Array.isArray(contextType) ? contextType : [contextType]
  const optionsDisponibles = catalogItems.filter((item) => item.type && typesCibles.includes(item.type as ReasonType))

  // Supprime un concept associé
  const handleRemove = (reasonId: string, variantName: string) => {
    const updated = value.filter(
      (v) => !(v.reason_id === reasonId && v.variant_name === variantName)
    )
    onChange(updated)
  }

  // Choisit un concept (étape 1 de l'association)
  const handleSelectReason = (item: ReasonCatalogItem) => {
    if (item.variants.length === 0) {
      // S'il n'y a pas de variante, on l'associe directement sans variante
      const dejaAssocie = value.some((v) => v.reason_id === item.id)
      if (!dejaAssocie) {
        onChange([...value, { reason_id: item.id, variant_name: 'Standard' }])
      }
      setIsOpen(false)
    } else if (item.variants.length === 1) {
      // S'il n'y a qu'une seule variante, on l'associe aussi directement
      const dejaAssocie = value.some(
        (v) => v.reason_id === item.id && v.variant_name === item.variants[0].name
      )
      if (!dejaAssocie) {
        onChange([...value, { reason_id: item.id, variant_name: item.variants[0].name }])
      }
      setIsOpen(false)
    } else {
      // Sinon, on affiche le menu de choix des variantes (étape 2)
      setSelectedItem(item)
    }
  }

  // Choisit la variante d'un concept (étape 2 de l'association)
  const handleSelectVariant = (variantName: string) => {
    if (!selectedItem) return
    const dejaAssocie = value.some(
      (v) => v.reason_id === selectedItem.id && v.variant_name === variantName
    )
    if (!dejaAssocie) {
      onChange([...value, { reason_id: selectedItem.id, variant_name: variantName }])
    }
    setSelectedItem(null)
    setIsOpen(false)
  }

  // Retrouve le titre d'une raison technique à partir de son ID
  const getReasonTitle = (id: string) => {
    const matched = catalogItems.find((item) => item.id === id)
    return matched ? matched.title : 'Concept inconnu'
  }

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1.5 w-full">
      {/* Badges sélectionnés */}
      <div className="flex flex-wrap gap-1.5 min-h-[30px] items-center">
        {value.map((assoc, idx) => (
          <span
            key={idx}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-accent/10 border border-accent/25 text-accent text-[11.5px] rounded-md font-medium"
          >
            <span>{getReasonTitle(assoc.reason_id)}</span>
            {assoc.variant_name !== 'Standard' && (
              <span className="text-[10px] opacity-75 font-semibold bg-accent/20 px-1 py-0.5 rounded uppercase">
                {assoc.variant_name}
              </span>
            )}
            <button
              type="button"
              onClick={() => handleRemove(assoc.reason_id, assoc.variant_name)}
              className="hover:text-loss transition-colors text-[10px] leading-none ml-0.5"
              title="Retirer"
            >
              ✕
            </button>
          </span>
        ))}

        {/* Bouton d'ajout */}
        <button
          type="button"
          onClick={() => {
            setIsOpen(!isOpen)
            setSelectedItem(null)
          }}
          disabled={isLoading}
          className="px-2.5 py-1 bg-surface2 border border-border2 hover:border-accent/40 rounded text-[11px] text-txt2 hover:text-txt font-semibold transition-all"
        >
          {isLoading ? 'Chargement...' : '+ Associer Concept'}
        </button>
      </div>

      {/* Menu déroulant de sélection */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-72 bg-surface border border-border rounded-xl shadow-2xl z-[150] overflow-hidden animate-slideUp">
          {!selectedItem ? (
            /* Étape 1 : Choix de la raison technique */
            <div className="flex flex-col max-h-60 overflow-y-auto">
              <p className="text-txt3 text-[10px] font-bold px-3.5 py-2 border-b border-border uppercase tracking-wider">
                Choisir une raison technique
              </p>
              {optionsDisponibles.length === 0 ? (
                <div className="px-3.5 py-4 text-center text-txt3 text-xs">
                  Aucun concept de type "{typesCibles.map(t => t.toUpperCase()).join('/')}" dans ton catalogue.<br />
                  <a
                    href="/catalog"
                    className="text-accent hover:underline inline-block mt-2 font-medium"
                  >
                    Aller au catalogue →
                  </a>
                </div>
              ) : (
                optionsDisponibles.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectReason(item)}
                    className="w-full text-left px-3.5 py-2 hover:bg-accent/10 hover:text-accent text-[12.5px] text-txt transition-colors flex items-center justify-between border-b border-border/30 last:border-0"
                  >
                    <span className="font-medium truncate">{item.title}</span>
                    <span className="text-[10px] text-txt3 font-normal">
                      {item.variants.length} variante{item.variants.length > 1 ? 's' : ''}
                    </span>
                  </button>
                ))
              )}
            </div>
          ) : (
            /* Étape 2 : Choix de la variante */
            <div className="flex flex-col">
              <div className="flex items-center justify-between px-3.5 py-2 border-b border-border bg-surface2/30">
                <p className="text-txt3 text-[10px] font-bold uppercase tracking-wider">
                  Choisir la variante
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="text-txt3 hover:text-txt text-[10px] font-medium"
                >
                  ← Retour
                </button>
              </div>
              <div className="flex flex-col p-1">
                {selectedItem.variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => handleSelectVariant(v.name)}
                    className="w-full text-left px-3 py-2 rounded hover:bg-accent/10 hover:text-accent text-[12.5px] text-txt transition-colors"
                  >
                    <span className="font-semibold block">{v.name}</span>
                    {v.notes && (
                      <span className="text-[10.5px] text-txt3 block mt-0.5 line-clamp-1">
                        {v.notes}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
