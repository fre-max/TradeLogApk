import { useState, useMemo } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { supabase } from '@/lib/supabase'
import { useTradeStats, type StatsGroupe } from '@/hooks/useTradeStats'
import { useTrades } from '@/hooks/useTrades'
import { useCatalog } from '@/hooks/useCatalog'
import type { TradeWithSteps, ReasonCatalogItem } from '@/types'
import { Skeleton, SkeletonLine } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'

// ─── Onglets de breakdown ─────────────────────────────────
const BREAKDOWN_TABS = [
  { key: 'paire', label: 'Par Paire' },
  { key: 'session', label: 'Par Session' },
  { key: 'setup', label: 'Par Setup' },
  { key: 'emotion', label: 'Par Émotion' },
  { key: 'reasons', label: '📊 Efficience Raisons (Catalogue)' },
  { key: 'insights', label: '🔮 Insights & Recommandations' },
] as const

type BreakdownKey = (typeof BREAKDOWN_TABS)[number]['key']

// Traduction des types du catalogue
const TYPE_LABELS: Record<string, string> = {
  biais: 'Biais',
  poi: 'POI / Zone',
  entry: 'Entrée',
  sl: 'Stop Loss',
  tp: 'Take Profit',
  trailing: 'Trailing Stop',
  confirmation: 'Confirmation',
}

// ─── Page Statistiques ────────────────────────────────────
// Affiche les métriques globales + breakdowns par catégorie
// Utilise useTradeStats() pour les calculs

export default function Stats() {
  const { globales, parPaire, parSession, parSetup, parEmotion, isLoading } = useTradeStats()
  const { data: trades = [], isLoading: tradesLoading } = useTrades()
  const { data: catalogItems = [], isLoading: catalogLoading } = useCatalog()
  const [activeTab, setActiveTab] = useState<BreakdownKey>('paire')

  // Sélectionner les données du breakdown actif
  const breakdownData: Record<Exclude<BreakdownKey, 'reasons' | 'insights'>, StatsGroupe[]> = {
    paire: parPaire,
    session: parSession,
    setup: parSetup,
    emotion: parEmotion,
  }
  const donneesActives = activeTab !== 'reasons' && activeTab !== 'insights'
    ? (breakdownData as any)[activeTab] as StatsGroupe[]
    : []

  // ─── Calculs locaux pour l'onglet d'Insights ──────────────────
  const insightBiais = useMemo(() => {
    const longs = trades.filter((t) => t.direction === 'long')
    const shorts = trades.filter((t) => t.direction === 'short')

    const calc = (list: typeof trades) => {
      const total = list.length
      if (total === 0) return { count: 0, wins: 0, winRate: 0, rrSum: 0, expectancy: 0 }
      const wins = list.filter((t) => t.result === 'win').length
      const winRate = Math.round((wins / total) * 100)
      const rrSum = list.reduce((acc, t) => acc + (t.rr_realized || 0), 0)
      const expectancy = parseFloat((rrSum / total).toFixed(2))
      return { count: total, wins, winRate, rrSum, expectancy }
    }

    return {
      long: calc(longs),
      short: calc(shorts),
    }
  }, [trades])

  const insightMeilleurePaire = useMemo(() => {
    if (parPaire.length === 0) return null
    const valides = parPaire.filter(p => p.totalTrades >= 1)
    if (valides.length === 0) return null
    const trie = [...valides].sort((a, b) => b.moyenneRR - a.moyenneRR || b.winRate - a.winRate)
    return trie[0]
  }, [parPaire])

  const insightSessions = useMemo(() => {
    if (parSession.length === 0) return null
    const valides = parSession.filter(s => s.totalTrades >= 1)
    if (valides.length === 0) return null
    const trie = [...valides].sort((a, b) => b.moyenneRR - a.moyenneRR || b.winRate - a.winRate)
    const meilleure = trie[0]
    const pire = trie[trie.length - 1]
    return { meilleure, pire: pire === meilleure ? null : pire }
  }, [parSession])

  const insightMeilleurSetup = useMemo(() => {
    if (parSetup.length === 0) return null
    const valides = parSetup.filter(s => s.totalTrades >= 1)
    if (valides.length === 0) return null
    const trie = [...valides].sort((a, b) => b.moyenneRR - a.moyenneRR || b.winRate - a.winRate)
    return trie[0]
  }, [parSetup])

  const insightPireEmotion = useMemo(() => {
    if (parEmotion.length === 0) return null
    const valides = parEmotion.filter(e => e.totalTrades >= 1 && e.nom !== '')
    if (valides.length === 0) return null
    // Trier par moyenneRR ascendante (la plus négative d'abord)
    const trie = [...valides].sort((a, b) => a.moyenneRR - b.moyenneRR || a.winRate - b.winRate)
    return trie[0]
  }, [parEmotion])

  const insightTemporel = useMemo(() => {
    const tradesAvecDuree = trades.filter(
      (t) => t.duree_estimee_bougies != null && t.duree_reelle_bougies != null
    )
    if (tradesAvecDuree.length === 0) return null

    let totalEstimeeHeures = 0
    let countEstimeeHeures = 0
    let totalEstimeeBougies = 0
    let totalReelleBougies = 0
    let totalEcartBougies = 0
    
    trades.forEach((t) => {
      if (t.duree_estimee_heures != null) {
        totalEstimeeHeures += Number(t.duree_estimee_heures)
        countEstimeeHeures++
      }
      if (t.duree_estimee_bougies != null && t.duree_reelle_bougies != null) {
        totalEstimeeBougies += Number(t.duree_estimee_bougies)
        totalReelleBougies += Number(t.duree_reelle_bougies)
        totalEcartBougies += Math.abs(Number(t.duree_estimee_bougies) - Number(t.duree_reelle_bougies))
      }
    })

    const moyEstimeeHeures = countEstimeeHeures > 0 ? parseFloat((totalEstimeeHeures / countEstimeeHeures).toFixed(1)) : 0
    const moyEstimeeBougies = tradesAvecDuree.length > 0 ? Math.round(totalEstimeeBougies / tradesAvecDuree.length) : 0
    const moyReelleBougies = tradesAvecDuree.length > 0 ? Math.round(totalReelleBougies / tradesAvecDuree.length) : 0
    const moyEcartBougies = tradesAvecDuree.length > 0 ? parseFloat((totalEcartBougies / tradesAvecDuree.length).toFixed(1)) : 0
    
    const precision = totalEstimeeBougies > 0 
      ? Math.max(0, Math.round((1 - (totalEcartBougies / totalEstimeeBougies)) * 100))
      : 0

    return {
      moyEstimeeHeures,
      moyEstimeeBougies,
      moyReelleBougies,
      moyEcartBougies,
      precision,
      totalTradesDuree: tradesAvecDuree.length
    }
  }, [trades])

  // ─── Calcul de l'Efficience des Raisons du Catalogue ────────────────
  const calculerEfficienceRaisons = () => {
    const statsMap = new Map<string, {
      title: string
      variant: string
      type: string
      count: number
      wins: number
      losses: number
      be: number
      rrSum: number
    }>()

    trades.forEach((trade: TradeWithSteps) => {
      const reasonsDuTrade: { reason_id: string; variant_name: string }[] = []

      trade.steps.forEach((step: any) => {
        const fields = (step.fields ?? {}) as Record<string, any>
        if (step.type === 'biais' || step.type === 'poi') {
          const list = fields.catalog_reasons ?? []
          if (Array.isArray(list)) {
            list.forEach((r: any) => {
              if (r.reason_id) reasonsDuTrade.push(r)
            })
          }
        } else if (step.type === 'entry') {
          const cat = fields.catalog_reasons ?? {}
          if (cat && typeof cat === 'object') {
            Object.values(cat).forEach((list: any) => {
              if (Array.isArray(list)) {
                list.forEach((r: any) => {
                  if (r.reason_id) reasonsDuTrade.push(r)
                })
              }
            })
          }
        }
      })

      // Dédupliquer les concepts identiques sur un même trade
      const clesUniques = new Set<string>()
      const uniqueReasons: typeof reasonsDuTrade = []
      reasonsDuTrade.forEach((r: any) => {
        const cle = `${r.reason_id}-${r.variant_name}`
        if (!clesUniques.has(cle)) {
          clesUniques.add(cle)
          uniqueReasons.push(r)
        }
      })

      // Remplir la map
      uniqueReasons.forEach((r: any) => {
        const catalogItem = catalogItems.find((item: ReasonCatalogItem) => item.id === r.reason_id)
        if (!catalogItem) return

        const cle = `${r.reason_id}-${r.variant_name}`
        const exist = statsMap.get(cle) ?? {
          title: catalogItem.title,
          variant: r.variant_name,
          type: catalogItem.type || 'confirmation',
          count: 0,
          wins: 0,
          losses: 0,
          be: 0,
          rrSum: 0,
        }

        exist.count += 1
        if (trade.result === 'win') exist.wins += 1
        else if (trade.result === 'loss') exist.losses += 1
        else if (trade.result === 'breakeven') exist.be += 1

        if (trade.rr_realized != null) {
          exist.rrSum += trade.rr_realized
        }

        statsMap.set(cle, exist)
      })
    })

    return Array.from(statsMap.values()).map((s) => {
      const winRate = s.count > 0 ? Math.round((s.wins / s.count) * 100) : 0
      const expectancy = s.count > 0 ? parseFloat((s.rrSum / s.count).toFixed(2)) : 0
      return {
        ...s,
        winRate,
        expectancy,
      }
    }).sort((a, b) => b.count - a.count)
  }

  // ─── Calcul de l'analyse des confluences multiples (Combinaisons de 2 raisons) ───
  const calculerCombinaisonsEfficience = () => {
    const combinaisonsMap = new Map<string, {
      nomA: string
      nomB: string
      count: number
      wins: number
      losses: number
      be: number
      rrSum: number
    }>()

    trades.forEach((trade: TradeWithSteps) => {
      const reasonsDuTrade: string[] = []

      trade.steps.forEach((step: any) => {
        const fields = (step.fields ?? {}) as Record<string, any>
        if (step.type === 'biais' || step.type === 'poi') {
          const list = fields.catalog_reasons ?? []
          if (Array.isArray(list)) {
            list.forEach((r: any) => {
              if (r.reason_id) {
                const item = catalogItems.find((ci: ReasonCatalogItem) => ci.id === r.reason_id)
                if (item) reasonsDuTrade.push(`${item.title} (${r.variant_name})`)
              }
            })
          }
        } else if (step.type === 'entry') {
          const cat = fields.catalog_reasons ?? {}
          if (cat && typeof cat === 'object') {
            Object.values(cat).forEach((list: any) => {
              if (Array.isArray(list)) {
                list.forEach((r: any) => {
                  if (r.reason_id) {
                    const item = catalogItems.find((ci: ReasonCatalogItem) => ci.id === r.reason_id)
                    if (item) reasonsDuTrade.push(`${item.title} (${r.variant_name})`)
                  }
                })
              }
            })
          }
        }
      })

      const uniqueNames = Array.from(new Set(reasonsDuTrade)).sort()

      for (let i = 0; i < uniqueNames.length; i++) {
        for (let j = i + 1; j < uniqueNames.length; j++) {
          const nomA = uniqueNames[i]
          const nomB = uniqueNames[j]
          const cle = `${nomA} + ${nomB}`

          const exist = combinaisonsMap.get(cle) ?? {
            nomA,
            nomB,
            count: 0,
            wins: 0,
            losses: 0,
            be: 0,
            rrSum: 0,
          }

          exist.count += 1
          if (trade.result === 'win') exist.wins += 1
          else if (trade.result === 'loss') exist.losses += 1
          else if (trade.result === 'breakeven') exist.be += 1

          if (trade.rr_realized != null) {
            exist.rrSum += trade.rr_realized
          }

          combinaisonsMap.set(cle, exist)
        }
      }
    })

    return Array.from(combinaisonsMap.entries())
      .map(([cle, data]) => {
        const winRate = data.count > 0 ? Math.round((data.wins / data.count) * 100) : 0
        const expectancy = data.count > 0 ? parseFloat((data.rrSum / data.count).toFixed(2)) : 0
        return {
          combinaison: cle,
          ...data,
          winRate,
          expectancy,
        }
      })
      .filter((c) => c.count >= 2)
      .sort((a, b) => b.count - a.count)
  }

  const effRaisons = activeTab === 'reasons' ? calculerEfficienceRaisons() : []
  const effCombinaisons = activeTab === 'reasons' ? calculerCombinaisonsEfficience() : []
  const chargementCatalogue = tradesLoading || catalogLoading

  return (
    <AppLayout title="Statistiques">
      <div className="flex-1 overflow-y-auto p-4 md:p-6">

        {/* ─── Section 1 : Métriques globales ──────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <MetricCard
            label="Win Rate"
            value={isLoading ? null : `${globales.winRate}%`}
            icon="🎯"
            color={globales.winRate >= 50 ? 'text-win' : 'text-loss'}
          />
          <MetricCard
            label="Expectancy"
            value={isLoading ? null : `${globales.expectancy > 0 ? '+' : ''}${globales.expectancy}R`}
            icon="📈"
            color={globales.expectancy >= 0 ? 'text-win' : 'text-loss'}
          />
          <MetricCard
            label="Moy. R:R"
            value={isLoading ? null : `${globales.moyenneRR}R`}
            icon="⚖️"
            color="text-accent"
          />
          <MetricCard
            label="Total Trades"
            value={isLoading ? null : String(globales.totalTrades)}
            icon="📋"
            subtitle={
              isLoading
                ? undefined
                : `${globales.totalWins}W / ${globales.totalLosses}L / ${globales.totalBE}BE`
            }
          />
        </div>

        {/* ─── Section 2 : Breakdowns ──────────────────────── */}
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          {/* Onglets */}
          <div className="flex border-b border-border overflow-x-auto">
            {BREAKDOWN_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'px-4 py-3 text-[13px] font-medium whitespace-nowrap border-b-2 transition-colors',
                  activeTab === tab.key
                    ? 'text-accent border-accent'
                    : 'text-txt2 border-transparent hover:text-txt hover:bg-surface2'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tableau de breakdown ou Écran d'analyse du Catalogue */}
          {activeTab !== 'reasons' && activeTab !== 'insights' && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[500px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-2.5 text-left text-[11.5px] font-medium text-txt3 uppercase tracking-wider">Nom</th>
                    <th className="px-4 py-2.5 text-left text-[11.5px] font-medium text-txt3 uppercase tracking-wider">Trades</th>
                    <th className="px-4 py-2.5 text-left text-[11.5px] font-medium text-txt3 uppercase tracking-wider">Wins</th>
                    <th className="px-4 py-2.5 text-left text-[11.5px] font-medium text-txt3 uppercase tracking-wider">Losses</th>
                    <th className="px-4 py-2.5 text-left text-[11.5px] font-medium text-txt3 uppercase tracking-wider">Win Rate</th>
                    <th className="px-4 py-2.5 text-left text-[11.5px] font-medium text-txt3 uppercase tracking-wider">Avg R:R</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Skeleton pendant le chargement */}
                  {isLoading && [1, 2, 3, 4].map((i) => (
                    <tr key={i} className="border-b border-border">
                      <td className="px-4 py-3"><SkeletonLine width="w-20" /></td>
                      <td className="px-4 py-3"><SkeletonLine width="w-8" /></td>
                      <td className="px-4 py-3"><SkeletonLine width="w-8" /></td>
                      <td className="px-4 py-3"><SkeletonLine width="w-8" /></td>
                      <td className="px-4 py-3"><SkeletonLine width="w-12" /></td>
                      <td className="px-4 py-3"><SkeletonLine width="w-12" /></td>
                    </tr>
                  ))}

                  {/* Données réelles */}
                  {!isLoading && donneesActives.map((groupe) => (
                    <tr key={groupe.nom} className="border-b border-border hover:bg-surface2 transition-colors">
                      <td className="px-4 py-3 text-[13.5px] text-txt font-medium">{groupe.nom}</td>
                      <td className="px-4 py-3 text-[13.5px] text-txt2">{groupe.totalTrades}</td>
                      <td className="px-4 py-3 text-[13.5px] text-win">{groupe.wins}</td>
                      <td className="px-4 py-3 text-[13.5px] text-loss">{groupe.losses}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'text-[13.5px] font-medium',
                            groupe.winRate >= 50 ? 'text-win' : 'text-loss'
                          )}>
                            {groupe.winRate}%
                          </span>
                          <div className="w-16 h-1.5 bg-bg rounded-full overflow-hidden hidden md:block">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all',
                                groupe.winRate >= 50 ? 'bg-win' : 'bg-loss'
                              )}
                              style={{ width: `${groupe.winRate}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[13.5px] text-accent font-medium">
                        {groupe.moyenneRR > 0 ? '+' : ''}{groupe.moyenneRR}R
                      </td>
                    </tr>
                  ))}

                  {/* Aucune donnée */}
                  {!isLoading && donneesActives.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-txt3 text-sm">
                        Aucune donnée disponible — ajoutez des trades pour voir les statistiques
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'reasons' && (
            /* 📊 ÉCRAN D'ANALYSE D'EFFICIENCE DU CATALOGUE TECHNIQUE */
            <div className="p-4 md:p-6 space-y-6 bg-surface">
              
              {/* 📖 CARTE D'EXPLICATIONS PÉDAGOGIQUES (Pour guider l'user) */}
              <div className="bg-accent/5 border border-accent/15 rounded-xl p-5">
                <h4 className="text-accent text-[13.5px] font-semibold flex items-center gap-2">
                  <span>ℹ️</span> Comment fonctionne l'analyse d'efficience ?
                </h4>
                <p className="text-txt2 text-[12.5px] mt-2 leading-relaxed">
                  Cette section extrait et croise les concepts de ton **catalogue technique** associés à tes trades fermés pour isoler scientifiquement ce qui fonctionne.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-3.5 border-t border-border">
                  <div>
                    <span className="text-[10px] font-bold text-txt3 uppercase tracking-wider block">1. Extraction</span>
                    <span className="text-txt text-xs mt-1 block">Récupération des tags rattachés à chaque étape du trade (Biais, POI, SL, Entrée).</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-txt3 uppercase tracking-wider block">2. Efficience unitaire</span>
                    <span className="text-txt text-xs mt-1 block">Calcul individuel du Win Rate et du R:R moyen réalisé pour chaque variante technique.</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-txt3 uppercase tracking-wider block">3. Confluences multiples</span>
                    <span className="text-txt text-xs mt-1 block">Analyse des paires de concepts se produisant sur un même trade pour mesurer leur synergie.</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-txt3 uppercase tracking-wider block">4. Stratégie</span>
                    <span className="text-txt text-xs mt-1 block">Identification des configurations optimales à reproduire et des facteurs à éviter.</span>
                  </div>
                </div>
              </div>

              {/* Loader */}
              {chargementCatalogue && (
                <div className="py-12 text-center text-txt3 text-xs animate-pulse">
                  Calcul des confluences et extraction statistique...
                </div>
              )}

              {/* Aucun trade rattaché */}
              {!chargementCatalogue && effRaisons.length === 0 && (
                <div className="py-12 text-center text-txt3 text-xs">
                  Aucun concept technique du catalogue n'a encore été associé à tes trades.<br />
                  <span className="block mt-1 text-[11px]">Édite un trade du journal et associe-y des concepts du catalogue pour commencer à collecter des statistiques.</span>
                </div>
              )}

              {!chargementCatalogue && effRaisons.length > 0 && (
                <div className="space-y-6">
                  {/* 🚀 INSIGHTS (Meilleures confluences / Facteurs de perte) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Points forts */}
                    <div className="bg-win/5 border border-win/15 rounded-xl p-4.5">
                      <h5 className="text-win text-xs font-semibold flex items-center gap-1.5 uppercase tracking-wide">
                        🔥 Confluences Fortes (Taux {'>'}= 50%)
                      </h5>
                      <div className="mt-3 space-y-2">
                        {effRaisons.filter(r => r.winRate >= 50).slice(0, 3).map((r, i) => (
                          <div key={i} className="flex justify-between items-center text-xs">
                            <span className="text-txt font-medium">{r.title} <span className="text-txt3 text-[10px] uppercase font-bold bg-bg px-1 rounded">{r.variant}</span></span>
                            <span className="text-win font-semibold">{r.winRate}% WR ({r.count} Tr.)</span>
                          </div>
                        ))}
                        {effRaisons.filter(r => r.winRate >= 50).length === 0 && (
                          <span className="text-txt3 text-xs block italic">Aucune donnée significative trouvée pour le moment.</span>
                        )}
                      </div>
                    </div>

                    {/* Points faibles */}
                    <div className="bg-loss/5 border border-loss/15 rounded-xl p-4.5">
                      <h5 className="text-loss text-xs font-semibold flex items-center gap-1.5 uppercase tracking-wide">
                        ⚠️ Facteurs de Perte (Taux {'<'} 50%)
                      </h5>
                      <div className="mt-3 space-y-2">
                        {effRaisons.filter(r => r.winRate < 50).slice(0, 3).map((r, i) => (
                          <div key={i} className="flex justify-between items-center text-xs">
                            <span className="text-txt font-medium">{r.title} <span className="text-txt3 text-[10px] uppercase font-bold bg-bg px-1 rounded">{r.variant}</span></span>
                            <span className="text-loss font-semibold">{r.winRate}% WR ({r.count} Tr.)</span>
                          </div>
                        ))}
                        {effRaisons.filter(r => r.winRate < 50).length === 0 && (
                          <span className="text-txt3 text-xs block italic">Aucun signal de perte critique récurrent détecté. Félicitations !</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* TABLEAU DES STATISTIQUES UNITAIRES */}
                  <div>
                    <h5 className="text-txt text-xs font-semibold uppercase tracking-wider mb-3">
                      Efficience individuelle par concept
                    </h5>
                    <div className="overflow-x-auto border border-border/80 rounded-lg">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b border-border bg-surface2/30">
                            <th className="px-4 py-2 text-left text-[11px] font-bold text-txt3 uppercase">Concept</th>
                            <th className="px-4 py-2 text-left text-[11px] font-bold text-txt3 uppercase">Variante</th>
                            <th className="px-4 py-2 text-left text-[11px] font-bold text-txt3 uppercase">Usage</th>
                            <th className="px-4 py-2 text-left text-[11px] font-bold text-txt3 uppercase">Trades (W/L/BE)</th>
                            <th className="px-4 py-2 text-left text-[11px] font-bold text-txt3 uppercase">Win Rate</th>
                            <th className="px-4 py-2 text-left text-[11px] font-bold text-txt3 uppercase">Espérance R:R</th>
                          </tr>
                        </thead>
                        <tbody>
                          {effRaisons.map((r, idx) => (
                            <tr key={idx} className="border-b border-border/40 hover:bg-surface2/40 transition-colors">
                              <td className="px-4 py-2.5 text-xs text-txt font-medium">
                                <span className="text-txt3 text-[9px] uppercase font-bold mr-1.5 px-1 bg-border rounded">
                                  {TYPE_LABELS[r.type] || r.type}
                                </span>
                                {r.title}
                              </td>
                              <td className="px-4 py-2.5 text-xs text-txt2 font-semibold uppercase">{r.variant}</td>
                              <td className="px-4 py-2.5 text-xs text-txt3">{r.count} fois</td>
                              <td className="px-4 py-2.5 text-xs text-txt2">
                                <span className="text-win">{r.wins}W</span> / <span className="text-loss">{r.losses}L</span> / <span className="text-be">{r.be}BE</span>
                              </td>
                              <td className="px-4 py-2.5 text-xs font-bold">
                                <span className={r.winRate >= 50 ? 'text-win' : 'text-loss'}>{r.winRate}%</span>
                              </td>
                              <td className="px-4 py-2.5 text-xs font-bold text-accent">
                                {r.expectancy > 0 ? '+' : ''}{r.expectancy}R
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* ANALYSE DES COMBINAISONS (CONFLUENCES MULTIPLES) */}
                  {effCombinaisons.length > 0 && (
                    <div className="pt-4 border-t border-border">
                      <h5 className="text-txt text-xs font-semibold uppercase tracking-wider mb-2.5">
                        Multi-Confluences (Synergies de 2 concepts)
                      </h5>
                      <p className="text-txt3 text-[11px] mb-3">
                        Cette table montre comment se comportent les trades lorsque deux concepts précis sont validés simultanément. (Min. 2 occurrences requis)
                      </p>
                      <div className="overflow-x-auto border border-border/80 rounded-lg">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="border-b border-border bg-surface2/30">
                              <th className="px-4 py-2 text-left text-[11px] font-bold text-txt3 uppercase">Synergie</th>
                              <th className="px-4 py-2 text-left text-[11px] font-bold text-txt3 uppercase">Usage</th>
                              <th className="px-4 py-2 text-left text-[11px] font-bold text-txt3 uppercase">Trades (W/L/BE)</th>
                              <th className="px-4 py-2 text-left text-[11px] font-bold text-txt3 uppercase">Win Rate</th>
                              <th className="px-4 py-2 text-left text-[11px] font-bold text-txt3 uppercase">Espérance R:R</th>
                            </tr>
                          </thead>
                          <tbody>
                            {effCombinaisons.map((c, idx) => (
                              <tr key={idx} className="border-b border-border/40 hover:bg-surface2/40 transition-colors">
                                <td className="px-4 py-2.5 text-xs text-txt font-medium flex flex-wrap gap-1">
                                  <span className="text-accent bg-accent/5 px-2 py-0.5 rounded border border-accent/20">{c.nomA}</span>
                                  <span className="text-txt3 text-[10px] self-center">+</span>
                                  <span className="text-accent bg-accent/5 px-2 py-0.5 rounded border border-accent/20">{c.nomB}</span>
                                </td>
                                <td className="px-4 py-2.5 text-xs text-txt3">{c.count} fois</td>
                                <td className="px-4 py-2.5 text-xs text-txt2">
                                  <span className="text-win">{c.wins}W</span> / <span className="text-loss">{c.losses}L</span> / <span className="text-be">{c.be}BE</span>
                                </td>
                                <td className="px-4 py-2.5 text-xs font-bold">
                                  <span className={c.winRate >= 50 ? 'text-win' : 'text-loss'}>{c.winRate}%</span>
                                </td>
                                <td className="px-4 py-2.5 text-xs font-bold text-accent">
                                  {c.expectancy > 0 ? '+' : ''}{c.expectancy}R
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

            </div>
          )}
        </div>
      )}

              {/* ─── Onglet Insights & Recommandations ───────────────── */}
              {activeTab === 'insights' && (
                <div className="p-5 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* 1. Biais directionnel */}
                    <InsightCard
                      title="Quel biais directionnel fonctionne le mieux ?"
                      icon="⚖️"
                      description={
                        insightBiais.long.count === 0 && insightBiais.short.count === 0 ? (
                          "Pas assez de données pour comparer les performances d'achat et de vente."
                        ) : (
                          <>
                            {insightBiais.short.expectancy > insightBiais.long.expectancy ? (
                              <span>
                                Le biais <strong className="text-[#f08a4f]">Short (Ventes)</strong> 📉 performe mieux avec une espérance de <strong>+{insightBiais.short.expectancy}R</strong> par trade (Win Rate: {insightBiais.short.winRate}%) contre +{insightBiais.long.expectancy}R (Win Rate: {insightBiais.long.winRate}%) pour les Longs.
                              </span>
                            ) : (
                              <span>
                                Le biais <strong className="text-accent">Long (Achats)</strong> 🚀 performe mieux avec une espérance de <strong>+{insightBiais.long.expectancy}R</strong> par trade (Win Rate: {insightBiais.long.winRate}%) contre +{insightBiais.short.expectancy}R (Win Rate: {insightBiais.short.winRate}%) pour les Shorts.
                              </span>
                            )}
                          </>
                        )
                      }
                    />

                    {/* 2. Meilleure paire */}
                    <InsightCard
                      title="Quelle est ma meilleure paire de trading ?"
                      icon="🎯"
                      badge={insightMeilleurePaire?.nom}
                      description={
                        insightMeilleurePaire ? (
                          <span>
                            C'est la paire <strong>{insightMeilleurePaire.nom}</strong> avec un Win Rate de <strong>{insightMeilleurePaire.winRate}%</strong> et un R:R cumulé moyen de <strong>+{insightMeilleurePaire.moyenneRR}R</strong> sur {insightMeilleurePaire.totalTrades} positions.
                          </span>
                        ) : (
                          "Pas assez de données de paires disponibles."
                        )
                      }
                    />

                    {/* 3. Session */}
                    <InsightCard
                      title="Quelle session devrais-je privilégier ?"
                      icon="⏰"
                      description={
                        insightSessions ? (
                          <span>
                            Privilégie la session <strong>{insightSessions.meilleure.nom}</strong> (WR: {insightSessions.meilleure.winRate}%, +{insightSessions.meilleure.moyenneRR}R).
                            {insightSessions.pire && (
                              <>
                                {" "}Évite ou réduis le risque lors de la session <strong>{insightSessions.pire.nom}</strong> où ton espérance chute à <strong className="text-loss">{insightSessions.pire.moyenneRR}R</strong>.
                              </>
                            )}
                          </span>
                        ) : (
                          "Pas assez de données de sessions disponibles."
                        )
                      }
                    />

                    {/* 4. Setup */}
                    <InsightCard
                      title="Quel est mon setup d'entrée le plus rentable ?"
                      icon="🔧"
                      badge={insightMeilleurSetup?.nom}
                      description={
                        insightMeilleurSetup ? (
                          <span>
                            Le setup <strong>{insightMeilleurSetup.nom}</strong> offre ton meilleur R:R moyen avec une espérance de <strong>+{insightMeilleurSetup.moyenneRR}R</strong> par trade (sur {insightMeilleurSetup.totalTrades} positions).
                          </span>
                        ) : (
                          "Pas assez de données de setups enregistrées."
                        )
                      }
                    />

                    {/* 5. Émotion */}
                    <InsightCard
                      title="Quel état émotionnel nuit le plus à mes performances ?"
                      icon="🧠"
                      description={
                        insightPireEmotion ? (
                          insightPireEmotion.moyenneRR < 0 ? (
                            <span>
                              L'état émotionnel <strong>{insightPireEmotion.nom}</strong> est ton plus grand obstacle actuel, provoquant une espérance négative de <strong className="text-loss">{insightPireEmotion.moyenneRR}R</strong> par trade. Fais une pause ou coupe tes écrans dès que tu ressens cette émotion.
                            </span>
                          ) : (
                            <span>
                              Tu t'en sors le moins bien sous l'état <strong>{insightPireEmotion.nom}</strong> (+{insightPireEmotion.moyenneRR}R).
                            </span>
                          )
                        ) : (
                          "Pas assez d'états émotionnels enregistrés."
                        )
                      }
                    />

                    {/* 6. Analyse Temporelle (⏱️) */}
                    <InsightCard
                      title="Quelle est ma précision d'estimation de temps ?"
                      icon="⏱️"
                      badge={insightTemporel ? `${insightTemporel.precision}% de précision` : undefined}
                      description={
                        insightTemporel ? (
                          <span>
                            Tes trades durent en moyenne <strong>{insightTemporel.moyReelleBougies} bougies</strong>, contre une estimation initiale moyenne de <strong>{insightTemporel.moyEstimeeHeures}h ({insightTemporel.moyEstimeeBougies} bougies)</strong>. L'écart temporel moyen est de <strong>{insightTemporel.moyEcartBougies} bougies</strong>.
                          </span>
                        ) : (
                          "Pas assez de données d'analyses temporelles enregistrées (place des trades avec SL/TP et durée estimée sur le graphique de backtest)."
                        )
                      }
                    />

                  </div>

                  {/* Analyse IA interactive */}
                  <AssistantCoachingIA trades={trades} />
                </div>
              )}
            </div>
          </div>
    </AppLayout>
  )
}

// ─── Composants Helpers d'Insights & Coaching ────────────────

interface InsightCardProps {
  title: string
  description: React.ReactNode
  icon: string
  badge?: string
}

function InsightCard({ title, description, icon, badge }: InsightCardProps) {
  return (
    <div className="bg-surface border border-border/80 rounded-xl p-4.5 space-y-3 shadow-sm hover:shadow-md transition-all relative overflow-hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xl p-1.5 bg-bg border border-border2 rounded-lg leading-none">{icon}</span>
          <h4 className="text-[13.5px] font-semibold text-txt leading-tight">{title}</h4>
        </div>
        {badge && (
          <span className="text-[10px] font-semibold px-2 py-0.5 bg-accent/10 text-accent border border-accent/20 rounded-full whitespace-nowrap">
            {badge}
          </span>
        )}
      </div>
      <p className="text-[12.5px] text-txt2 leading-relaxed pl-1">
        {description}
      </p>
    </div>
  )
}

interface AssistantCoachingIAProps {
  trades: any[]
}

function AssistantCoachingIA({ trades }: AssistantCoachingIAProps) {
  const [loading, setLoading] = useState(false)
  const [conseils, setConseils] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  const lancerCoachingIA = async () => {
    setLoading(true)
    setErreur(null)
    console.log("🚀 [Stats] Lancement de la demande de coaching IA...")

    try {
      // 1. Préparer un résumé léger des statistiques pour Gemini
      const resumeStats = {
        totalTrades: trades.length,
        winRate: trades.length > 0 ? Math.round((trades.filter((t: any) => t.result === 'win').length / trades.length) * 100) : 0,
        resultats: {
          wins: trades.filter((t: any) => t.result === 'win').length,
          losses: trades.filter((t: any) => t.result === 'loss').length,
          be: trades.filter((t: any) => t.result === 'breakeven').length,
          missed: trades.filter((t: any) => t.result === 'missed').length,
        },
        direction: {
          longs: trades.filter((t: any) => t.direction === 'long').length,
          shorts: trades.filter((t: any) => t.direction === 'short').length,
          longWins: trades.filter((t: any) => t.direction === 'long' && t.result === 'win').length,
          shortWins: trades.filter((t: any) => t.direction === 'short' && t.result === 'win').length,
        },
        pairs: Array.from(new Set(trades.map((t: any) => t.pair))).map((p: any) => {
          const pairTrades = trades.filter((t: any) => t.pair === p)
          return {
            pair: p,
            total: pairTrades.length,
            wins: pairTrades.filter((t: any) => t.result === 'win').length,
          }
        }),
        sessions: Array.from(new Set(trades.map((t: any) => t.session))).map((s: any) => {
          const sessionTrades = trades.filter((t: any) => t.session === s)
          return {
            session: s,
            total: sessionTrades.length,
            wins: sessionTrades.filter((t: any) => t.result === 'win').length,
          }
        }),
        emotions: Array.from(new Set(trades.map((t: any) => t.emotion).filter(Boolean))).map((e: any) => {
          const emotionTrades = trades.filter((t: any) => t.emotion === e)
          return {
            emotion: e,
            total: emotionTrades.length,
            wins: emotionTrades.filter((t: any) => t.result === 'win').length,
          }
        })
      }

      // 2. Invoker l'Edge Function d'analyse en mode coaching
      const response = await supabase.functions.invoke('analyze', {
        body: {
          mode: 'coaching',
          stats: resumeStats,
        }
      })

      if (response.error) throw response.error

      if (response.data?.analysis) {
        setConseils(response.data.analysis)
        console.log("✅ [Stats] Plan d'action IA généré avec succès.")
      } else {
        throw new Error("L'IA n'a pas retourné d'analyse valide.")
      }

    } catch (err: any) {
      console.error("❌ [Stats] Échec de la récupération des conseils IA :", err)
      setErreur(err.message || "Impossible de récupérer les insights de l'IA.")
    } finally {
      setLoading(false)
    }
  }

  // Permet d'afficher du markdown basique (gras, listes) de façon brute et sûre
  const formaterMarkdownSimple = (text: string) => {
    return text.split('\n').map((ligne, idx) => {
      let cleanLigne = ligne.trim()
      
      if (cleanLigne.startsWith('###')) {
        return <h4 key={idx} className="text-sm font-bold text-accent mt-3 mb-1">{cleanLigne.replace('###', '').trim()}</h4>
      }
      if (cleanLigne.startsWith('##')) {
        return <h3 key={idx} className="text-base font-bold text-txt mt-4 mb-2 border-b border-border/40 pb-1">{cleanLigne.replace('##', '').trim()}</h3>
      }
      
      const estUnePuce = cleanLigne.startsWith('*') || cleanLigne.startsWith('-')
      if (estUnePuce) {
        cleanLigne = cleanLigne.substring(1).trim()
      }

      const segments = cleanLigne.split('**')
      const formattedText = segments.map((seg, i) => {
        if (i % 2 === 1) {
          return <strong key={i} className="text-txt font-semibold">{seg}</strong>
        }
        return seg
      })

      if (estUnePuce) {
        return (
          <li key={idx} className="ml-4 list-disc text-xs text-txt2 leading-relaxed py-0.5">
            {formattedText}
          </li>
        )
      }

      return cleanLigne ? (
        <p key={idx} className="text-xs text-txt2 leading-relaxed py-1">
          {formattedText}
        </p>
      ) : <div key={idx} className="h-2" />
    })
  }

  return (
    <div className="mt-6 bg-surface border border-border rounded-xl p-5 space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-[14px] font-bold text-txt">🔮 Plan d'action personnalisé par l'IA</h3>
          <p className="text-txt3 text-[11px]">Génère un diagnostic de performance et des conseils de coaching d'après ton historique de trades.</p>
        </div>
        <button
          type="button"
          onClick={lancerCoachingIA}
          disabled={loading || trades.length === 0}
          className="px-4 py-2 bg-gradient-to-r from-accent to-[#7c3aed] text-white hover:opacity-90 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md disabled:opacity-50 flex-shrink-0"
        >
          {loading ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              Génération du plan...
            </>
          ) : (
            <>
              <span>🔮</span>
              <span>Analyser mon Trading par l'IA</span>
            </>
          )}
        </button>
      </div>

      {erreur && (
        <div className="p-3.5 bg-loss/10 border border-loss/20 text-loss rounded-lg text-xs font-medium">
          ⚠️ {erreur}
        </div>
      )}

      {conseils && (
        <div className="p-5 bg-bg/40 border border-border2 rounded-lg space-y-2 max-w-none animate-fadeIn">
          <div className="flex items-center gap-2 mb-3 border-b border-border pb-2.5">
            <span className="text-lg">🧠</span>
            <span className="text-xs font-bold text-txt uppercase tracking-wider">Recommandations de Gemini Coaching</span>
          </div>
          <div className="space-y-1">
            {formaterMarkdownSimple(conseils)}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Carte de métrique ────────────────────────────────────
// Affiche une métrique clé (win rate, expectancy, etc.)
// Avec skeleton si value est null

interface MetricCardProps {
  label: string
  value: string | null
  icon: string
  color?: string
  subtitle?: string
}

function MetricCard({ label, value, icon, color, subtitle }: MetricCardProps) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4 flex flex-col gap-2">
      {/* Header avec icône */}
      <div className="flex items-center justify-between">
        <span className="text-txt3 text-[11.5px] font-medium uppercase tracking-wider">{label}</span>
        <span className="text-lg">{icon}</span>
      </div>

      {/* Valeur principale */}
      {value === null ? (
        <Skeleton className="w-20 h-7" />
      ) : (
        <span className={cn('text-2xl font-bold tracking-tight', color ?? 'text-txt')}>
          {value}
        </span>
      )}

      {/* Sous-texte optionnel */}
      {subtitle && (
        <span className="text-txt3 text-[11.5px]">{subtitle}</span>
      )}
    </div>
  )
}
