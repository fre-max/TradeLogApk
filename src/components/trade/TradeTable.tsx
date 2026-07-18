import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table'
import { useState, useEffect, useMemo } from 'react'
import { useTrades, useDeleteTrade } from '@/hooks/useTrades'
import { useUIStore, useFilterStore } from '@/store'
import { formatDate, formatRR, cn } from '@/lib/utils'
import { SkeletonTableRow } from '@/components/ui/Skeleton'
import { StatusBadge } from '@/components/trade/StatusBadge'
import { useParams } from 'react-router-dom'
import type { TradeWithSteps } from '@/types'

// ─── TradeTable ───────────────────────────────────────────
// Tableau principal des trades avec :
// - Onglets (Tableau / Calendrier / Courbe)
// - Skeleton loader pendant le chargement
// - Empty state enrichi quand 0 trades
// - Tri par colonnes
// - Adaptation dynamique des colonnes selon le sous-journal choisi

export function TradeTable() {
  const { data: trades = [], isLoading, isError } = useTrades()
  const { mutateAsync: deleteTrade, isPending: isDeleting } = useDeleteTrade()
  const openDetail = useUIStore((state) => state.openDetail)
  const openEditTrade = useUIStore((state) => state.openEditTrade)
  const openNewTrade = useUIStore((state) => state.openNewTrade)
  const addToast = useUIStore((state) => state.addToast)
  const filterPair = useFilterStore((state) => state.filterPair)
  const filterResult = useFilterStore((state) => state.filterResult)
  const filterStrategyId = useFilterStore((state) => state.filterStrategyId)
  const [sorting, setSorting] = useState<SortingState>([])

  // On récupère le type de journal depuis les paramètres d'URL ( bias, poi, confirmation, global )
  const { type } = useParams<{ type: string }>()
  const journalType = (type || 'global') as 'global' | 'bias' | 'poi' | 'confirmation'

  // ─── Définition des colonnes ──────────────────────────────
  const col = createColumnHelper<TradeWithSteps>()

  const columns = useMemo(() => {
    // Colonnes communes à toutes les configurations de journal
    const baseCols = [
      col.accessor('created_at', {
        header: 'Ajouté le',
        cell: (info) => <span className="text-txt2">{formatDate(info.getValue())}</span>,
      }),
      col.accessor('pair', {
        header: 'Paire',
        cell: (info) => <span className="text-txt font-medium">{info.getValue()}</span>,
      }),
      col.accessor('direction', {
        header: journalType === 'bias' ? 'Biais' : 'Direction',
        cell: (info) => (
          <Badge variant={info.getValue() === 'long' ? 'long' : 'short'}>
            {info.getValue() === 'long' ? '↑ Long' : '↓ Short'}
          </Badge>
        ),
      }),
    ]

    // Configuration des colonnes pour le Journal de Biais
    if (journalType === 'bias') {
      return [
        ...baseCols,
        col.accessor('steps', {
          id: 'biais_timeframe',
          header: 'UT Biais',
          cell: (info) => {
            const step = info.getValue().find((s) => s.type === 'biais')
            return <span className="text-txt2">{step?.timeframe ?? '—'}</span>
          },
        }),
        col.accessor('entry_time', {
          header: 'Début Biais',
          cell: (info) => <span className="text-txt2">{info.getValue() ? String(info.getValue()).slice(0, 5) : '—'}</span>,
        }),
        col.accessor('exit_time', {
          header: 'Fin Biais',
          cell: (info) => <span className="text-txt2">{info.getValue() ? String(info.getValue()).slice(0, 5) : '—'}</span>,
        }),
        col.accessor('result', {
          header: 'Biais Correct ?',
          cell: (info) => {
            const v = info.getValue()
            if (!v) return <span className="text-txt3">—</span>
            return <Badge variant={v}>{v === 'win' ? '✓ Oui' : v === 'loss' ? '✗ Non' : v === 'missed' ? '∅ Manqué' : '— BE'}</Badge>
          },
        }),
        col.accessor('status', {
          header: 'Statut',
          cell: (info) => {
            const statut = (info.getValue() || 'in_progress') as 'quick' | 'in_progress' | 'complete'
            return <StatusBadge status={statut} />
          },
        }),
        col.display({
          id: 'actions',
          header: 'Actions',
          cell: (info) => (
            <div className="flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  openEditTrade(info.row.original)
                }}
                className="px-3 py-1.5 bg-accent text-white rounded-md text-[11.5px] font-medium hover:bg-accent/90 transition-colors"
              >
                Modifier
              </button>
            </div>
          ),
        }),
      ]
    }

    // Configuration des colonnes pour le Journal des Zones POI
    if (journalType === 'poi') {
      return [
        ...baseCols,
        col.accessor('steps', {
          id: 'poi_timeframe',
          header: 'UT POI',
          cell: (info) => {
            const step = info.getValue().find((s) => s.type === 'poi')
            return <span className="text-txt2">{step?.timeframe ?? '—'}</span>
          },
        }),
        col.accessor('steps', {
          id: 'poi_type',
          header: 'Type POI',
          cell: (info) => {
            const step = info.getValue().find((s) => s.type === 'poi')
            const fields = (step?.fields ?? {}) as Record<string, unknown>
            return <span className="text-txt2">{String(fields.zone_type || '—')}</span>
          },
        }),
        col.accessor('result', {
          header: 'Réaction ?',
          cell: (info) => {
            const v = info.getValue()
            if (!v) return <span className="text-txt3">—</span>
            return <Badge variant={v}>{v === 'win' ? '✓ Réagi' : v === 'loss' ? '✗ Cassé' : v === 'missed' ? '∅ Manqué' : '— BE'}</Badge>
          },
        }),
        col.accessor('status', {
          header: 'Statut',
          cell: (info) => {
            const statut = (info.getValue() || 'in_progress') as 'quick' | 'in_progress' | 'complete'
            return <StatusBadge status={statut} />
          },
        }),
        col.display({
          id: 'actions',
          header: 'Actions',
          cell: (info) => (
            <div className="flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  openEditTrade(info.row.original)
                }}
                className="px-3 py-1.5 bg-accent text-white rounded-md text-[11.5px] font-medium hover:bg-accent/90 transition-colors"
              >
                Modifier
              </button>
            </div>
          ),
        }),
      ]
    }

    // Configuration des colonnes pour le Journal des Confirmations LTF
    if (journalType === 'confirmation') {
      return [
        ...baseCols,
        col.accessor('steps', {
          id: 'setup_ltf',
          header: 'Setup LTF',
          cell: (info) => {
            const step = info.getValue().find((s) => s.type === 'entry')
            const fields = (step?.fields ?? {}) as Record<string, unknown>
            return <span className="text-txt2">{String(fields.setup || '—')}</span>
          },
        }),
        col.accessor('rr_planned', {
          header: 'R:R Prévu',
          cell: (info) => <span className="text-txt font-medium">{formatRR(info.getValue())}</span>,
        }),
        col.accessor('rr_realized', {
          header: 'R:R Réalisé',
          cell: (info) => <span className="text-txt font-medium">{formatRR(info.getValue())}</span>,
        }),
        col.accessor('result', {
          header: 'Résultat',
          cell: (info) => {
            const v = info.getValue()
            if (!v) return <span className="text-txt3">—</span>
            return <Badge variant={v}>{v === 'win' ? '✓ Win' : v === 'loss' ? '✗ Loss' : v === 'missed' ? '∅ Missed' : '— BE'}</Badge>
          },
        }),
        col.accessor('emotion', {
          header: 'Émotion',
          cell: (info) => <span className="text-txt2">{info.getValue() ?? '—'}</span>,
        }),
        col.accessor('status', {
          header: 'Statut',
          cell: (info) => {
            const statut = (info.getValue() || 'in_progress') as 'quick' | 'in_progress' | 'complete'
            return <StatusBadge status={statut} />
          },
        }),
        col.display({
          id: 'actions',
          header: 'Actions',
          cell: (info) => (
            <div className="flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  openEditTrade(info.row.original)
                }}
                className="px-3 py-1.5 bg-accent text-white rounded-md text-[11.5px] font-medium hover:bg-accent/90 transition-colors"
              >
                Modifier
              </button>
            </div>
          ),
        }),
      ]
    }

    // Par défaut, configuration du Journal Global (affichage classique)
    return [
      ...baseCols,
      col.accessor('steps', {
        header: 'Setup',
        cell: (info) => {
          const entryStep = info.getValue().find((s) => s.type === 'entry')
          return <span className="text-txt2">{entryStep?.title ?? '—'}</span>
        },
      }),
      col.accessor('session', {
        header: 'Session',
        cell: (info) => <span className="text-txt2">{info.getValue()}</span>,
      }),
      col.accessor('rr_realized', {
        header: 'R:R',
        cell: (info) => <span className="text-txt font-medium">{formatRR(info.getValue())}</span>,
      }),
      col.accessor('result', {
        header: 'Résultat',
        cell: (info) => {
          const v = info.getValue()
          if (!v) return <span className="text-txt3">—</span>
          return <Badge variant={v}>{v === 'win' ? '✓ Win' : v === 'loss' ? '✗ Loss' : v === 'missed' ? '∅ Missed' : '— BE'}</Badge>
        },
      }),
      col.accessor('status', {
        header: 'Statut',
        cell: (info) => {
          const statut = (info.getValue() || 'in_progress') as 'quick' | 'in_progress' | 'complete'
          return <StatusBadge status={statut} />
        },
      }),
      col.accessor('steps', {
        id: 'steps_count',
        header: 'Étapes',
        cell: (info) => (
          <div className="flex gap-1">
            {info.getValue().map((_, i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-accent" />
            ))}
          </div>
        ),
      }),
      col.display({
        id: 'actions',
        header: 'Actions',
        cell: (info) => (
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                openEditTrade(info.row.original)
              }}
              className="px-3 py-1.5 bg-accent text-white rounded-md text-[11.5px] font-medium hover:bg-accent/90 transition-colors"
            >
              Modifier
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (confirm('Êtes-vous sûr de vouloir supprimer ce trade ?')) {
                  deleteTrade(info.row.original.id)
                    .then(() => {
                      addToast('Trade supprimé avec succès', 'success')
                    })
                    .catch((err) => {
                      addToast(err.message || 'Erreur lors de la suppression', 'error')
                    })
                }
              }}
              disabled={isDeleting}
              className="px-3 py-1.5 bg-loss/10 text-loss border border-loss/30 rounded-md text-[11.5px] font-medium hover:bg-loss/20 transition-colors disabled:opacity-50"
            >
              Supprimer
            </button>
          </div>
        ),
      }),
    ]
  }, [journalType, isDeleting])

  console.log('📊 [TradeTable] Rendu :', { 
    isLoading, 
    isError, 
    totalTrades: trades.length, 
    filterPair, 
    filterResult,
    journalType
  })

  // Filtrage côté client mémoïsé pour stabiliser la référence et inclure le type de journal
  const filtered = useMemo(() => {
    return trades.filter((t) => {
      // Filtre Type de Journal
      if (journalType !== 'global' && (t.journal_type || 'global') !== journalType) return false
      // Filtre Paire
      if (filterPair && t.pair !== filterPair) return false
      // Filtre Résultat
      if (filterResult && t.result !== filterResult) return false
      // Filtre Stratégie
      if (filterStrategyId && t.strategy_id !== filterStrategyId) return false
      return true
    })
  }, [trades, filterPair, filterResult, filterStrategyId, journalType])

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 25, // Limite à 25 trades par page pour le mobile et les performances
      },
    },
  })

  return (
    <div className="flex-1 overflow-auto">
      {/* Onglets */}
      <div className="flex gap-0 px-4 border-b border-border">
        {['📋 Tableau', '📅 Calendrier', '📈 Courbe'].map((tab, i) => (
          <div
            key={tab}
            className={cn(
              'px-3 py-2.5 text-[13px] cursor-pointer border-b-2 whitespace-nowrap',
              i === 0
                ? 'text-txt border-accent'
                : 'text-txt2 border-transparent hover:text-txt'
            )}
          >
            {tab}
          </div>
        ))}
      </div>

      {/* Contenu du tableau */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-[700px]">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-border">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className="px-3 py-2.5 text-left text-[11.5px] font-medium text-txt3 uppercase tracking-wider cursor-pointer hover:text-txt2 whitespace-nowrap"
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === 'asc' ? ' ↑' : header.column.getIsSorted() === 'desc' ? ' ↓' : ''}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {/* Skeleton loader — 6 lignes animées */}
            {isLoading && (
              <>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <SkeletonTableRow key={i} />
                ))}
              </>
            )}

            {/* Lignes réelles */}
            {!isLoading && table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => {
                  console.log('🔍 [TradeTable] Clic ligne trade (ouverture détail) :', row.original.id)
                  openDetail(row.original)
                }}
                className="border-b border-border cursor-pointer hover:bg-surface2 transition-colors"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-3 text-[13.5px] whitespace-nowrap">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Contrôles de pagination */}
        {!isLoading && filtered.length > 0 && (
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 px-4 py-3 border-t border-border bg-surface2/10 text-xs">
            <div className="text-txt3">
              Affichage de{' '}
              <span className="font-semibold text-txt2">
                {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}
              </span>{' '}
              à{' '}
              <span className="font-semibold text-txt2">
                {Math.min(
                  (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                  filtered.length
                )}
              </span>{' '}
              sur <span className="font-semibold text-txt">{filtered.length}</span> trades
            </div>
            
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="px-2.5 py-1.5 bg-surface border border-border rounded text-txt2 disabled:opacity-40 hover:text-txt transition-colors text-[11px] font-medium"
              >
                ◀ Précédent
              </button>
              <span className="text-txt3">
                Page <span className="font-semibold text-txt2">{table.getState().pagination.pageIndex + 1}</span> sur{' '}
                <span className="font-semibold text-txt2">{table.getPageCount()}</span>
              </span>
              <button
                type="button"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="px-2.5 py-1.5 bg-surface border border-border rounded text-txt2 disabled:opacity-40 hover:text-txt transition-colors text-[11px] font-medium"
              >
                Suivant ▶
              </button>
            </div>
          </div>
        )}

        {/* Empty state enrichi — quand 0 trades après chargement */}
        {!isLoading && filtered.length === 0 && (
          <div className="py-20 flex flex-col items-center justify-center gap-4">
            {/* Illustration */}
            <div className="w-20 h-20 bg-surface2 rounded-2xl flex items-center justify-center text-4xl border border-border">
              📊
            </div>

            {/* Texte */}
            <div className="text-center">
              <p className="text-txt font-medium text-[15px] mb-1">Aucun trade enregistré</p>
              <p className="text-txt3 text-sm max-w-[280px]">
                Commencez votre journal de backtesting en ajoutant votre premier trade
              </p>
            </div>

            {/* Bouton CTA */}
            <button
              onClick={() => {
                console.log('➕ [TradeTable] Clic bouton CTA (ouverture formulaire)')
                openNewTrade()
              }}
              className="bg-accent text-white px-5 py-2.5 rounded-lg text-[13.5px] font-medium hover:bg-accent/90 transition-colors flex items-center gap-2"
            >
              + Créer mon premier trade
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Badge ────────────────────────────────────────────────

type BadgeVariant = 'win' | 'loss' | 'breakeven' | 'missed' | 'long' | 'short'

function Badge({ variant, children }: { variant: BadgeVariant; children: React.ReactNode }) {
  const styles: Record<BadgeVariant, string> = {
    win: 'bg-win/10 text-win',
    loss: 'bg-loss/10 text-loss',
    breakeven: 'bg-be/10 text-be',
    missed: 'bg-txt3/10 text-txt3',
    long: 'bg-accent/10 text-accent',
    short: 'bg-[#f08a4f]/10 text-[#f08a4f]',
  }
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[11.5px] font-medium', styles[variant])}>
      {children}
    </span>
  )
}
