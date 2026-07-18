import { useState } from 'react'
import { useReasonFamilies } from '@/hooks/useReasonFamilies'
import { useCatalog, useCreateCatalogItem } from '@/hooks/useCatalog'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────
// Représente une raison sélectionnée avec une variante choisie (ex: "BOS - Mineur")
interface SelectedReason {
  reason_id: string
  variant_name: string
}

interface TradeReasonsAccordionsProps {
  // On reçoit ET on envoie un tableau d'objets { reason_id, variant_name }
  selectedReasonIds: string[]
  onChange: (newIds: string[]) => void
  // Optionnel : pour accès complet aux objets sélectionnés avec variantes
  selectedReasons?: SelectedReason[]
  onChangeReasons?: (newReasons: SelectedReason[]) => void
  familySlug?: string
}

/**
 * Sélecteur de raisons dynamiques groupées par famille (accordéon).
 * Affiche les familles et leurs raisons pour sélection multiple.
 * Si une raison a des variantes, un sous-menu apparaît pour en choisir une.
 *
 * Exemple :
 * <TradeReasonsAccordions
 *   selectedReasonIds={['uuid1', 'uuid2']}
 *   onChange={setSelectedReasonIds}
 * />
 */
export function TradeReasonsAccordions({
  selectedReasonIds,
  onChange,
  selectedReasons: selectedReasonsExt,
  onChangeReasons,
  familySlug,
}: TradeReasonsAccordionsProps) {
  const { data: families, isLoading: loadingFamilies } = useReasonFamilies()
  const { data: catalogItems, isLoading: loadingCatalog } = useCatalog()
  const { mutateAsync: createCatalogItem } = useCreateCatalogItem()

  // Saisie pour l'ajout rapide de concept
  const [nouveauConcept, setNouveauConcept] = useState('')

  // Accordéons ouverts (on peut en avoir plusieurs ouverts simultanément)
  const [openFamilyIds, setOpenFamilyIds] = useState<Set<string>>(new Set())

  // Menu de sélection de variante : indique quelle raison est en attente de variante
  const [pendingVariantReasonId, setPendingVariantReasonId] = useState<string | null>(null)

  // État interne des raisons sélectionnées avec variantes (si pas géré par le parent)
  const [internalSelectedReasons, setInternalSelectedReasons] = useState<SelectedReason[]>([])

  // Utilise l'état externe si fourni, sinon l'état interne
  const selectedReasons = selectedReasonsExt ?? internalSelectedReasons

  // Met à jour les deux représentations (IDs seuls + objets complets)
  const updateSelection = (newReasons: SelectedReason[]) => {
    if (onChangeReasons) {
      onChangeReasons(newReasons)
    } else {
      setInternalSelectedReasons(newReasons)
    }
    // Toujours mettre à jour les IDs simples pour la compatibilité
    onChange(newReasons.map(r => r.reason_id))
  }

  if (loadingFamilies || loadingCatalog) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-12 bg-surface2 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  if (!families || families.length === 0) {
    return (
      <div className="py-6 text-center">
        <p className="text-txt3 text-[12.5px]">Aucune famille de raisons configurée.</p>
        <a href="/catalog" className="text-accent text-[12px] hover:underline mt-1 inline-block">
          → Aller au catalogue pour en créer
        </a>
      </div>
    )
  }

  // Ouvre ou ferme un accordéon de famille
  const toggleFamily = (familyId: string) => {
    setOpenFamilyIds(prev => {
      const next = new Set(prev)
      if (next.has(familyId)) {
        next.delete(familyId)
      } else {
        next.add(familyId)
      }
      return next
    })
  }

  // Sélectionne / désélectionne une raison (si pas de variantes → sélection directe)
  const handleReasonClick = (reasonId: string, hasVariants: boolean) => {
    const dejaSelectionnee = selectedReasons.some(r => r.reason_id === reasonId)

    if (dejaSelectionnee) {
      // Désélection : on retire toutes les sélections de cette raison
      updateSelection(selectedReasons.filter(r => r.reason_id !== reasonId))
      setPendingVariantReasonId(null)
    } else if (hasVariants) {
      // A des variantes → affiche le sous-menu de sélection de variante
      setPendingVariantReasonId(pendingVariantReasonId === reasonId ? null : reasonId)
    } else {
      // Pas de variantes → sélection directe avec variante "Standard"
      updateSelection([...selectedReasons, { reason_id: reasonId, variant_name: 'Standard' }])
      setPendingVariantReasonId(null)
    }
  }

  // Sélectionne une variante spécifique pour une raison
  const handleVariantSelect = (reasonId: string, variantName: string) => {
    const existingIdx = selectedReasons.findIndex(
      r => r.reason_id === reasonId && r.variant_name === variantName
    )

    if (existingIdx >= 0) {
      // Déjà sélectionnée → retirer
      const next = [...selectedReasons]
      next.splice(existingIdx, 1)
      updateSelection(next)
    } else {
      // Ajouter cette variante (on peut avoir plusieurs variantes d'une même raison)
      updateSelection([...selectedReasons, { reason_id: reasonId, variant_name: variantName }])
    }
    // Ne pas fermer le sous-menu pour permettre la multi-sélection de variantes
  }

  // Ajoute un nouveau concept au catalogue dans la famille correspondante
  const handleAjouterConcept = async () => {
    if (!nouveauConcept.trim() || !familySlug) return
    const family = families?.find(f => f.slug === familySlug)
    if (!family) return

    try {
      console.log('🚀 [TradeReasonsAccordions] Ajout rapide au catalogue du concept:', nouveauConcept)
      const insertedItem = await createCatalogItem({
        item: {
          family_id: family.id,
          title: nouveauConcept.trim(),
        },
        variants: []
      })

      // Coche automatiquement le nouveau concept créé
      updateSelection([...selectedReasons, { reason_id: insertedItem.id, variant_name: 'Standard' }])
      setNouveauConcept('')
    } catch (e) {
      console.error("❌ [TradeReasonsAccordions] Échec de l'ajout rapide de concept :", e)
    }
  }

  // Récupère toutes les variantes sélectionnées pour une raison donnée
  const getSelectedVariants = (reasonId: string) =>
    selectedReasons.filter(r => r.reason_id === reasonId).map(r => r.variant_name)

  const familiesAffichees = familySlug
    ? families.filter(f => f.slug === familySlug)
    : families

  return (
    <div className="space-y-2">
      {familiesAffichees.map(family => {
        // Raisons appartenant à cette famille
        const familyReasons = catalogItems?.filter(item => item.family_id === family.id) || []
        // Combien sont sélectionnées dans cette famille
        const selectedCount = familyReasons.filter(r =>
          selectedReasons.some(sr => sr.reason_id === r.id)
        ).length
        const isOpen = familySlug ? true : openFamilyIds.has(family.id)
        const hideHeader = Boolean(familySlug)

        return (
          <div key={family.id} className={cn("border border-border2 rounded-xl overflow-hidden transition-all", hideHeader && "border-none bg-transparent rounded-none")}>
            {/* ─── Header Accordéon ───────────────────────────── */}
            {!hideHeader && (
              <button
                type="button"
                onClick={() => toggleFamily(family.id)}
                className="w-full flex items-center justify-between px-4 py-3 bg-surface hover:bg-surface2 transition-colors text-left"
              >
              <div className="flex items-center gap-2.5">
                {/* Icône de la famille si disponible */}
                {family.icon && (
                  <span className="text-[16px] leading-none">{family.icon}</span>
                )}
                <span className="text-[13.5px] font-semibold text-txt">{family.name}</span>
                {/* Badge compteur */}
                {selectedCount > 0 && (
                  <span className="bg-accent text-white text-[10px] font-bold px-2 py-0.5 rounded-full leading-tight">
                    {selectedCount}
                  </span>
                )}
                {/* Badge "vide" si la famille n'a aucune raison */}
                {familyReasons.length === 0 && (
                  <span className="text-[10px] text-txt3 bg-surface2 border border-border2 px-1.5 py-0.5 rounded">
                    vide
                  </span>
                )}
              </div>
              <span className={cn(
                'text-txt3 text-[10px] transition-transform duration-200',
                isOpen ? 'rotate-180' : ''
              )}>
                ▼
              </span>
            </button>
            )}

            {/* ─── Liste des Raisons ──────────────────────────── */}
            {isOpen && (
              <div className={cn("bg-surface2 border-t border-border2 p-3 space-y-1.5", hideHeader && "bg-transparent border-t-0 p-0")}>
                {familyReasons.length === 0 ? (
                  <p className="text-xs text-txt3 py-2 px-1 text-center italic">
                    Aucune raison dans cette famille — va dans le Catalogue pour en ajouter.
                  </p>
                ) : (
                  familyReasons.map(reason => {
                    const selectedVariants = getSelectedVariants(reason.id)
                    const isSelected = selectedVariants.length > 0
                    const hasVariants = reason.variants && reason.variants.length > 0
                    const showVariantMenu = pendingVariantReasonId === reason.id

                    return (
                      <div key={reason.id} className="flex flex-col gap-0">
                        {/* ─── Bouton Raison ──────────────────── */}
                        <button
                          type="button"
                          onClick={() => handleReasonClick(reason.id, Boolean(hasVariants))}
                          className={cn(
                            'w-full flex items-start text-left gap-2.5 px-3 py-2.5 rounded-lg border transition-all',
                            isSelected
                              ? 'bg-accent/10 border-accent/40 text-accent'
                              : 'bg-surface border-border2 text-txt2 hover:border-accent/30 hover:bg-surface2',
                            showVariantMenu && !isSelected
                              ? 'border-accent/40 bg-accent/5'
                              : ''
                          )}
                        >
                          {/* Checkbox visuelle */}
                          <div className={cn(
                            'mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors',
                            isSelected ? 'bg-accent border-accent text-white' : 'border-border3'
                          )}>
                            {isSelected && <span className="text-[10px] leading-none">✓</span>}
                          </div>

                          {/* Titre + description + badges variantes sélectionnées */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={cn(
                                'text-[13px] font-medium leading-tight',
                                isSelected ? 'text-accent' : 'text-txt'
                              )}>
                                {reason.title}
                              </span>
                              {/* Indicateur de variantes disponibles */}
                              {hasVariants && (
                                <span className="text-[10px] text-txt3 bg-surface2 border border-border2 px-1.5 rounded">
                                  {reason.variants.length} var.
                                </span>
                              )}
                            </div>
                            {reason.description && (
                              <span className="text-[11.5px] text-txt3 line-clamp-1 mt-0.5 block">
                                {reason.description}
                              </span>
                            )}
                            {/* Badges des variantes sélectionnées */}
                            {selectedVariants.length > 0 && selectedVariants[0] !== 'Standard' && (
                              <div className="flex gap-1 flex-wrap mt-1.5">
                                {selectedVariants.map(vname => (
                                  <span
                                    key={vname}
                                    className="text-[10px] font-bold uppercase bg-accent/20 text-accent px-1.5 py-0.5 rounded"
                                  >
                                    {vname}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Indicateur de sous-menu variantes */}
                          {hasVariants && (
                            <span className={cn(
                              'text-[10px] text-txt3 transition-transform self-center flex-shrink-0',
                              showVariantMenu ? 'rotate-90 text-accent' : ''
                            )}>▶</span>
                          )}
                        </button>

                        {/* ─── Sous-menu Variantes ──────────── */}
                        {showVariantMenu && hasVariants && (
                          <div className="ml-6 mt-1 mb-1.5 border-l-2 border-accent/30 pl-3 flex flex-col gap-1">
                            <p className="text-[10px] text-txt3 uppercase tracking-wider font-bold mb-1">
                              Choisir une ou plusieurs variantes :
                            </p>
                            {reason.variants.map(variant => {
                              const isVariantSelected = selectedVariants.includes(variant.name)
                              return (
                                <button
                                  key={variant.id}
                                  type="button"
                                  onClick={() => handleVariantSelect(reason.id, variant.name)}
                                  className={cn(
                                    'w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-md border transition-all text-[12.5px]',
                                    isVariantSelected
                                      ? 'bg-accent/15 border-accent/40 text-accent font-medium'
                                      : 'bg-surface border-border2 text-txt2 hover:bg-surface2 hover:border-accent/20'
                                  )}
                                >
                                  <div className={cn(
                                    'w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0',
                                    isVariantSelected ? 'bg-accent border-accent text-white' : 'border-border3'
                                  )}>
                                    {isVariantSelected && <span className="text-[8px]">✓</span>}
                                  </div>
                                  <div className="flex-1">
                                    <span className="font-medium block leading-tight">{variant.name}</span>
                                    {variant.notes && (
                                      <span className="text-[11px] text-txt3 line-clamp-1">{variant.notes}</span>
                                    )}
                                  </div>
                                  {/* Vignette de variante si image disponible */}
                                  {variant.image_url && (
                                    <img
                                      src={variant.image_url}
                                      alt={variant.name}
                                      className="w-8 h-6 object-cover rounded border border-border2 flex-shrink-0"
                                    />
                                  )}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}

                {/* Ajout rapide de concept à la volée dans la famille système courante */}
                {familySlug && (
                  <div className="mt-3.5 pt-3 border-t border-border2 flex gap-2 animate-fadeIn">
                    <input
                      type="text"
                      placeholder="➕ Ajouter un concept à cette famille..."
                      value={nouveauConcept}
                      onChange={(e) => setNouveauConcept(e.target.value)}
                      className="flex-1 bg-bg border border-border2 rounded-md text-txt px-3 py-1.5 text-[12.5px] outline-none focus:border-accent"
                    />
                    <button
                      type="button"
                      onClick={handleAjouterConcept}
                      className="px-3 py-1.5 bg-accent text-white rounded-md text-[12px] font-semibold hover:bg-accent/90 transition-colors flex-shrink-0"
                    >
                      Ajouter
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* ─── Résumé des sélections ──────────────────────────── */}
      {selectedReasons.length > 0 && (
        <div className="mt-3 p-3 bg-accent/5 border border-accent/20 rounded-lg">
          <p className="text-[10px] text-txt3 uppercase tracking-wider font-bold mb-2">
            Raisons sélectionnées ({selectedReasons.length}) :
          </p>
          <div className="flex flex-wrap gap-1.5">
            {selectedReasons.map((sr, idx) => {
              const item = catalogItems?.find(c => c.id === sr.reason_id)
              return (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 text-[11px] bg-accent/15 text-accent border border-accent/25 px-2 py-1 rounded-md font-medium"
                >
                  {item?.title ?? 'Concept inconnu'}
                  {sr.variant_name !== 'Standard' && (
                    <span className="text-[9px] uppercase font-bold bg-accent/30 px-1 rounded">
                      {sr.variant_name}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => updateSelection(selectedReasons.filter((_, i) => i !== idx))}
                    className="hover:text-loss transition-colors leading-none ml-0.5"
                  >
                    ✕
                  </button>
                </span>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
