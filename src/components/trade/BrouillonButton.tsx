import { useBrouillonStore } from '@/store/brouillonStore'
import type { Brouillon } from '@/store/brouillonStore'
import { BrouillonPanel } from './BrouillonPanel'
import { BrouillonSectionModal } from './BrouillonSectionModal'
import { useLocation } from 'react-router-dom'

/**
 * Bouton flottant "Brouillons" positionné au-dessus du bouton "Bot Telegram".
 * - bottom-20 = juste au-dessus du TelegramButton (bottom-6 + hauteur ~40px)
 * - Affiche un badge avec le nombre de sections remplies (toutes brouillons confondus)
 * - Ouvre le BrouillonPanel au clic
 *
 * Monter ce composant dans App.tsx au même niveau que TelegramButton.
 */
export function BrouillonButton() {
  const { ouvrirPanel, brouillons } = useBrouillonStore()
  const location = useLocation()

  // On masque le bouton de brouillon dans la section Backtest pour libérer de l'espace et éviter les chevauchements
  if (location.pathname === '/backtest') {
    return null
  }

  // Compte le total de sections remplies dans tous les brouillons
  // Exemple : si Brouillon 1 a Biais + POI et Brouillon 2 a Entrée → total = 3
  const totalSectionsRemplies = brouillons.reduce((total: number, brouillon: Brouillon) => {
    return total + Object.values(brouillon.sections).filter(Boolean).length
  }, 0)

  const aSections = totalSectionsRemplies > 0


  return (
    <>
      {/* Bouton flottant — au-dessus du Bot Telegram (bottom-6 + ~52px = bottom-20) */}
      <button
        id="brouillon-btn"
        onClick={ouvrirPanel}
        title="Gérer les brouillons de trade"
        className="fixed bottom-20 right-6 z-[80] flex items-center gap-2 px-4 py-3 rounded-full shadow-xl font-medium text-[13px] transition-all duration-150 hover:scale-105 active:scale-95 bg-[#7c3aed] hover:bg-[#6d28d9] text-white"
      >
        {/* Icône brouillon */}
        <span className="text-base">📋</span>
        <span className="hidden sm:inline">Brouillons</span>

        {/* Badge compteur — s'affiche seulement si au moins 1 section remplie */}
        {aSections && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-[#f59e0b] text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-sm">
            {totalSectionsRemplies}
          </span>
        )}
      </button>

      {/* Panel et modal montés ici pour être proches du bouton dans le DOM */}
      <BrouillonPanel />
      <BrouillonSectionModal />
    </>
  )
}
