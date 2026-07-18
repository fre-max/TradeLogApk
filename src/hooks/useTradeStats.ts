import { useTrades } from './useTrades'
import type { TradeWithSteps } from '@/types'
import { useFilterStore } from '@/store'

// ─── Types pour les statistiques ──────────────────────────

export interface StatsGlobales {
  totalTrades: number
  totalWins: number
  totalLosses: number
  totalBE: number
  winRate: number        // en pourcentage (0-100)
  expectancy: number     // moyenne des R:R réalisés (en R)
  moyenneRR: number      // moyenne des R:R réalisés (trades avec R:R uniquement)
}

export interface StatsGroupe {
  nom: string
  totalTrades: number
  wins: number
  losses: number
  winRate: number
  moyenneRR: number
}

export interface TradeStats {
  globales: StatsGlobales
  parPaire: StatsGroupe[]
  parSession: StatsGroupe[]
  parSetup: StatsGroupe[]
  parEmotion: StatsGroupe[]
  isLoading: boolean
}

// ─── Hook principal ───────────────────────────────────────
// Calcule toutes les statistiques à partir des trades existants
//
// Exemple :
// const { globales, parPaire, isLoading } = useTradeStats()
// console.log(globales.winRate) // 62
// console.log(parPaire[0].nom)  // "XAUUSD"

export function useTradeStats(): TradeStats {
  const { data: allTrades = [], isLoading } = useTrades()
  const filterStrategyId = useFilterStore((state) => state.filterStrategyId)

  // Filtrer les trades si une stratégie est sélectionnée
  const trades = filterStrategyId 
    ? allTrades.filter(t => t.strategy_id === filterStrategyId) 
    : allTrades

  // 1️⃣ Statistiques globales
  const globales = calculerStatsGlobales(trades)

  // 2️⃣ Breakdowns par catégorie
  const parPaire = calculerBreakdown(trades, (t) => t.pair)
  const parSession = calculerBreakdown(trades, (t) => t.session)
  const parSetup = calculerBreakdown(trades, (t) => {
    // On cherche le titre de l'étape d'entrée comme nom du setup
    const entryStep = t.steps.find((s) => s.type === 'entry')
    return entryStep?.title ?? 'Non défini'
  })
  const parEmotion = calculerBreakdown(trades, (t) => t.emotion ?? 'Non défini')

  return { globales, parPaire, parSession, parSetup, parEmotion, isLoading }
}

// ─── Calcul des stats globales ────────────────────────────

function calculerStatsGlobales(trades: TradeWithSteps[]): StatsGlobales {
  const totalTrades = trades.length
  const totalWins = trades.filter((t) => t.result === 'win').length
  const totalLosses = trades.filter((t) => t.result === 'loss').length
  const totalBE = trades.filter((t) => t.result === 'breakeven').length

  // Win rate = wins / total * 100
  const winRate = totalTrades > 0 ? Math.round((totalWins / totalTrades) * 100) : 0

  // Expectancy = moyenne de tous les R:R réalisés (y compris négatifs)
  const tradesAvecRR = trades.filter((t) => t.rr_realized != null)
  const sommeRR = tradesAvecRR.reduce((acc, t) => acc + (t.rr_realized ?? 0), 0)
  const expectancy = tradesAvecRR.length > 0
    ? parseFloat((sommeRR / tradesAvecRR.length).toFixed(2))
    : 0

  // Moyenne R:R = même calcul mais seulement les trades avec un R:R défini
  const moyenneRR = tradesAvecRR.length > 0
    ? parseFloat((sommeRR / tradesAvecRR.length).toFixed(2))
    : 0

  return { totalTrades, totalWins, totalLosses, totalBE, winRate, expectancy, moyenneRR }
}

// ─── Calcul d'un breakdown par groupe ─────────────────────
// Regroupe les trades par une clé (pair, session, setup, émotion)
// et calcule les stats pour chaque groupe

function calculerBreakdown(
  trades: TradeWithSteps[],
  getKey: (trade: TradeWithSteps) => string
): StatsGroupe[] {
  // Regrouper les trades par clé
  const groupes = new Map<string, TradeWithSteps[]>()

  for (const trade of trades) {
    const key = getKey(trade)
    const groupe = groupes.get(key) ?? []
    groupe.push(trade)
    groupes.set(key, groupe)
  }

  // Calculer les stats pour chaque groupe
  const resultats: StatsGroupe[] = []

  for (const [nom, tradesGroupe] of groupes) {
    const totalTrades = tradesGroupe.length
    const wins = tradesGroupe.filter((t) => t.result === 'win').length
    const losses = tradesGroupe.filter((t) => t.result === 'loss').length
    const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0

    const tradesAvecRR = tradesGroupe.filter((t) => t.rr_realized != null)
    const sommeRR = tradesAvecRR.reduce((acc, t) => acc + (t.rr_realized ?? 0), 0)
    const moyenneRR = tradesAvecRR.length > 0
      ? parseFloat((sommeRR / tradesAvecRR.length).toFixed(2))
      : 0

    resultats.push({ nom, totalTrades, wins, losses, winRate, moyenneRR })
  }

  // Trier par nombre de trades décroissant
  resultats.sort((a, b) => b.totalTrades - a.totalTrades)

  return resultats
}
