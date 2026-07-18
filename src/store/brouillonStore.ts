import { create } from 'zustand'
import type { TradeImage } from '@/types'

// ─── Types des sections de brouillon ─────────────────────────────────────────

// Données du Biais (avec image optionnelle)
export interface BrouillonBiais {
  biais_timeframe: string
  biais_direction: string
  biais_reasons: string
}

// Données du POI (avec image optionnelle)
export interface BrouillonPoi {
  poi_timeframe: string
  poi_type: string
  poi_confluences: string
}

// Données de l'Entrée (avec image optionnelle)
export interface BrouillonEntry {
  entry_timeframe: string
  entry_setup: string
  entry_price: string
  entry_sl: string
  entry_tp: string
  entry_trailing: string
  entry_reasons: string
}

// Données du Résultat (sans image)
export interface BrouillonResult {
  result: string
  rr_planned: string
  rr_realized: string
  exit_type: string
  emotion: string
  review_good: string
  review_bad: string
}

// Sections stockées dans un brouillon
export interface BrouillonSections {
  biais?: BrouillonBiais
  poi?: BrouillonPoi
  entry?: BrouillonEntry
  result?: BrouillonResult
  images?: Partial<TradeImage>[]
}

// Un brouillon complet (slot 1, 2 ou 3)
export interface Brouillon {
  id: 1 | 2 | 3
  sections: BrouillonSections
  // Date ISO de la dernière mise à jour (pour afficher "il y a X min")
  updatedAt: string | null
}

// Types des sections qu'on peut éditer
export type SectionType = 'biais' | 'poi' | 'entry' | 'result' | 'images'

// ─── State du store ───────────────────────────────────────────────────────────

interface BrouillonState {
  // Les 3 slots de brouillons
  brouillons: [Brouillon, Brouillon, Brouillon]

  // Panel principal (liste des 3 brouillons)
  isPanelOpen: boolean
  ouvrirPanel: () => void
  fermerPanel: () => void

  // Modal d'édition d'une section
  modalOuvert: boolean
  slotActif: 1 | 2 | 3 | null
  sectionActive: SectionType | null
  ouvrirModal: (slotId: 1 | 2 | 3, section: SectionType) => void
  fermerModal: () => void

  // Actions sur les brouillons
  sauvegarderSection: (slotId: 1 | 2 | 3, section: SectionType, data: BrouillonSections[SectionType]) => void
  effacerBrouillon: (slotId: 1 | 2 | 3) => void
}

// ─── Clé localStorage ────────────────────────────────────────────────────────

const CLE_STORAGE = 'trade-brouillons'

// Crée un brouillon vide pour un slot donné
function creerBrouillonVide(id: 1 | 2 | 3): Brouillon {
  return { id, sections: {}, updatedAt: null }
}

// Charge les brouillons depuis localStorage au démarrage
// Retourne les 3 slots avec les données persistées ou vides
function chargerBrouillonsDepuisStorage(): [Brouillon, Brouillon, Brouillon] {
  try {
    const donneesBrutes = localStorage.getItem(CLE_STORAGE)
    if (!donneesBrutes) return [creerBrouillonVide(1), creerBrouillonVide(2), creerBrouillonVide(3)]
    const parsed = JSON.parse(donneesBrutes)
    // On s'assure que les 3 slots existent toujours
    return [
      parsed[0] ?? creerBrouillonVide(1),
      parsed[1] ?? creerBrouillonVide(2),
      parsed[2] ?? creerBrouillonVide(3),
    ]
  } catch {
    // Si le JSON est corrompu, on repart de zéro
    return [creerBrouillonVide(1), creerBrouillonVide(2), creerBrouillonVide(3)]
  }
}

// Sauvegarde les 3 brouillons dans localStorage
function persisterBrouillons(brouillons: [Brouillon, Brouillon, Brouillon]) {
  localStorage.setItem(CLE_STORAGE, JSON.stringify(brouillons))
}

// ─── Store Zustand ────────────────────────────────────────────────────────────

export const useBrouillonStore = create<BrouillonState>((set, get) => ({
  // Chargement initial depuis localStorage
  brouillons: chargerBrouillonsDepuisStorage(),

  // Panel principal
  isPanelOpen: false,
  ouvrirPanel: () => set({ isPanelOpen: true }),
  fermerPanel: () => set({ isPanelOpen: false }),

  // Modal d'édition
  modalOuvert: false,
  slotActif: null,
  sectionActive: null,
  ouvrirModal: (slotId, section) =>
    set({ modalOuvert: true, slotActif: slotId, sectionActive: section }),
  fermerModal: () =>
    set({ modalOuvert: false, slotActif: null, sectionActive: null }),

  // Sauvegarde les données d'une section dans le brouillon du slot donné
  // Exemple : sauvegarderSection(1, 'biais', { biais_timeframe: 'D1', ... })
  sauvegarderSection: (slotId, section, data) => {
    const { brouillons } = get()

    // On copie le tableau pour ne pas muter l'état directement
    const nouveauxBrouillons = [...brouillons] as [Brouillon, Brouillon, Brouillon]
    const index = slotId - 1

    nouveauxBrouillons[index] = {
      ...nouveauxBrouillons[index],
      sections: {
        ...nouveauxBrouillons[index].sections,
        [section]: data,
      },
      updatedAt: new Date().toISOString(),
    }

    persisterBrouillons(nouveauxBrouillons)
    set({ brouillons: nouveauxBrouillons })
  },

  // Efface complètement un brouillon (remet à l'état vide)
  // Exemple : effacerBrouillon(2)
  effacerBrouillon: (slotId) => {
    const { brouillons } = get()
    const nouveauxBrouillons = [...brouillons] as [Brouillon, Brouillon, Brouillon]
    nouveauxBrouillons[slotId - 1] = creerBrouillonVide(slotId)
    persisterBrouillons(nouveauxBrouillons)
    set({ brouillons: nouveauxBrouillons })
  },
}))
