import { useBrouillonStore } from '@/store/brouillonStore'
import type { Brouillon, SectionType } from '@/store/brouillonStore'
import { cn } from '@/lib/utils'
import { useState } from 'react'

// Définit les sections affichées dans chaque slot avec leur icône
const SECTIONS_INFO: { key: SectionType; label: string; emoji: string }[] = [
  { key: 'images', label: 'Images (Avant/Après)', emoji: '🖼️' },
  { key: 'biais', label: 'Biais', emoji: '📊' },
  { key: 'poi', label: 'POI / Zone', emoji: '📍' },
  { key: 'entry', label: 'Entrée', emoji: '🎯' },
  { key: 'result', label: 'Résultat', emoji: '📈' },
]

/**
 * Panel latéral/drawer qui liste les 3 slots de brouillons.
 * Chaque slot affiche les sections remplies et permet d'éditer ou d'effacer.
 *
 * S'ouvre depuis BrouillonButton, ferme en cliquant sur l'overlay.
 */
export function BrouillonPanel() {
  const { isPanelOpen, fermerPanel, brouillons, ouvrirModal, effacerBrouillon } = useBrouillonStore()

  // Quel slot est en cours de demande de confirmation d'effacement
  const [confirmEffacement, setConfirmEffacement] = useState<1 | 2 | 3 | null>(null)

  if (!isPanelOpen) return null

  // Compte le nombre de sections remplies dans un brouillon
  const compterSections = (b: Brouillon) => {
    let count = Object.values(b.sections).filter(Boolean).length
    if (b.sections.images && b.sections.images.length === 0) count -= 1
    return count
  }

  // Formate la date relative "il y a X min / heures / jours"
  const formaterDate = (iso: string | null): string => {
    if (!iso) return ''
    const diff = (Date.now() - new Date(iso).getTime()) / 1000
    if (diff < 60) return 'il y a quelques secondes'
    if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`
    if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`
    return `il y a ${Math.floor(diff / 86400)}j`
  }

  const handleEffacer = (slotId: 1 | 2 | 3) => {
    if (confirmEffacement === slotId) {
      // Deuxième clic : confirme l'effacement
      effacerBrouillon(slotId)
      setConfirmEffacement(null)
    } else {
      // Premier clic : demande confirmation
      setConfirmEffacement(slotId)
    }
  }

  return (
    <>
      {/* Overlay sombre */}
      <div
        className="fixed inset-0 bg-black/50 z-[110]"
        onClick={() => {
          setConfirmEffacement(null)
          fermerPanel()
        }}
      />

      {/* Panel latéral (depuis la droite) */}
      <aside className="fixed top-0 right-0 h-full w-full sm:w-[400px] bg-surface border-l border-border z-[120] flex flex-col shadow-2xl">
        {/* En-tête */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-txt font-semibold text-[15px]">📋 Brouillons de Trade</h2>
            <p className="text-txt3 text-[12px] mt-0.5">
              Pré-remplissez les sections avant de créer le trade
            </p>
          </div>
          <button
            onClick={fermerPanel}
            className="text-txt3 hover:text-txt text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Corps : liste des 3 slots */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
          {brouillons.map((brouillon) => {
            const nbSections = compterSections(brouillon)
            const estVide = nbSections === 0
            const enConfirmation = confirmEffacement === brouillon.id

            return (
              <div
                key={brouillon.id}
                className={cn(
                  'border rounded-xl p-4 transition-all',
                  estVide ? 'border-border2 bg-surface2/50' : 'border-accent/20 bg-accent/5'
                )}
              >
                {/* En-tête du slot */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold',
                      estVide ? 'bg-border2 text-txt3' : 'bg-accent text-white'
                    )}>
                      {brouillon.id}
                    </span>
                    <div>
                      <span className="text-txt font-medium text-[13.5px]">
                        Brouillon {brouillon.id}
                      </span>
                      {!estVide && brouillon.updatedAt && (
                        <p className="text-txt3 text-[11px]">{formaterDate(brouillon.updatedAt)}</p>
                      )}
                    </div>
                  </div>

                  {/* Badge nombre de sections + bouton effacer */}
                  <div className="flex items-center gap-2">
                    {!estVide && (
                      <span className="text-[11px] bg-accent/15 text-accent px-2 py-0.5 rounded-full font-medium">
                        {nbSections}/5
                      </span>
                    )}
                    {!estVide && (
                      <button
                        onClick={() => handleEffacer(brouillon.id)}
                        className={cn(
                          'text-[11px] px-2 py-1 rounded-md transition-colors',
                          enConfirmation
                            ? 'bg-loss/15 text-loss border border-loss/30 font-medium'
                            : 'text-txt3 hover:text-loss border border-transparent hover:border-loss/20'
                        )}
                      >
                        {enConfirmation ? '⚠️ Confirmer' : '🗑 Effacer'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Liste des sections */}
                <div className="flex flex-col gap-1.5">
                  {SECTIONS_INFO.map(({ key, label, emoji }) => {
                    const sectionsData = brouillon.sections[key]
                    const remplie = Boolean(sectionsData && (!Array.isArray(sectionsData) || sectionsData.length > 0))

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setConfirmEffacement(null)
                          ouvrirModal(brouillon.id, key)
                        }}
                        className={cn(
                          'flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all w-full group',
                          remplie
                            ? 'bg-accent/8 hover:bg-accent/15 border border-accent/20'
                            : 'bg-surface hover:bg-surface2 border border-border2'
                        )}
                      >
                        {/* Indicateur rempli / vide */}
                        <span className={cn(
                          'w-4 h-4 rounded-full border flex items-center justify-center text-[9px] flex-shrink-0',
                          remplie ? 'bg-accent border-accent text-white' : 'border-border2'
                        )}>
                          {remplie ? '✓' : ''}
                        </span>

                        <span className="text-[12.5px] flex-1">
                          <span className="mr-1">{emoji}</span>
                          <span className={remplie ? 'text-txt font-medium' : 'text-txt3'}>{label}</span>
                        </span>

                        {/* Miniature image si disponible */}
                        {remplie && key === 'images' && Array.isArray(sectionsData) && sectionsData.length > 0 && (
                          <img
                            src={(sectionsData as any)[0].url}
                            alt=""
                            className="w-8 h-6 object-cover rounded border border-border2 flex-shrink-0"
                          />
                        )}

                        <span className="text-txt3 text-[11px] opacity-0 group-hover:opacity-100 transition-opacity">
                          {remplie ? 'Éditer →' : 'Ajouter →'}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {/* Message si brouillon vide */}
                {estVide && (
                  <p className="text-txt3 text-[11.5px] text-center mt-3 opacity-60">
                    Cliquez sur une section pour commencer
                  </p>
                )}
              </div>
            )
          })}
        </div>

        {/* Pied : légende */}
        <div className="px-5 py-3 border-t border-border flex-shrink-0">
          <p className="text-txt3 text-[11px] text-center">
            💡 Les brouillons sont sauvegardés localement et ne expirent jamais
          </p>
        </div>
      </aside>
    </>
  )
}
