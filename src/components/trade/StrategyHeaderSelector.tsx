import { useStrategies } from '@/hooks/useStrategies'
import { cn } from '@/lib/utils'

interface StrategyHeaderSelectorProps {
  selectedStrategyId: string
  onSelectStrategy: (strategyId: string) => void
  className?: string
}

/**
 * Composant de sélection rapide de la Stratégie (Playbook) placé en haut du TradeDrawer.
 * Mémorise automatiquement la dernière stratégie sélectionnée pour les futurs trades.
 *
 * Exemple d'utilisation :
 * <StrategyHeaderSelector
 *   selectedStrategyId={formData.strategy_id}
 *   onSelectStrategy={(id) => handleStrategyChange(id)}
 * />
 */
export function StrategyHeaderSelector({
  selectedStrategyId,
  onSelectStrategy,
  className,
}: StrategyHeaderSelectorProps) {
  const { data: strategies } = useStrategies()

  const selectedStrategy = strategies?.find((s) => s.id === selectedStrategyId)

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value
    onSelectStrategy(newId)
    if (newId) {
      localStorage.setItem('journal_last_strategy_id', newId)
    }
  }

  return (
    <div
      className={cn(
        'bg-surface2 border border-border2 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-sm',
        className
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-base p-1.5 bg-accent/10 rounded-lg text-accent">🎯</span>
        <div>
          <span className="text-[10px] font-bold text-txt3 uppercase tracking-wider block">
            Stratégie appliquée
          </span>
          <span className="text-xs font-semibold text-txt">
            {selectedStrategy ? selectedStrategy.name : 'Aucune stratégie sélectionnée'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:ml-auto">
        <select
          value={selectedStrategyId || ''}
          onChange={handleChange}
          className="bg-bg border border-border2 text-txt text-xs font-medium rounded-lg px-3 py-1.5 focus:outline-none focus:border-accent cursor-pointer transition-colors max-w-[220px] truncate"
        >
          <option value="">-- Choisir une stratégie --</option>
          {strategies?.map((strat) => (
            <option key={strat.id} value={strat.id}>
              {strat.name} {strat.version ? `(v${strat.version})` : ''}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
