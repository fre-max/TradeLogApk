import { cn } from '@/lib/utils'

// ─── Type pour les statuts possibles d'un trade ───────────────────────────────

type TradeStatus = 'quick' | 'in_progress' | 'complete'

interface StatusBadgeProps {
  status: TradeStatus
}

// ─── Définition des libellés et couleurs de chaque statut ────────────────────

const statusConfig: Record<TradeStatus, { label: string; style: string }> = {
  quick: {
    label: '🟡 À compléter',
    style: 'bg-[#f5a623]/10 text-[#f5a623] border border-[#f5a623]/25',
  },
  in_progress: {
    label: '🔵 En cours',
    style: 'bg-accent/10 text-accent border border-accent/25',
  },
  complete: {
    label: '🟢 Complet',
    style: 'bg-win/10 text-win border border-win/25',
  },
}

/**
 * Badge de statut du trade — à afficher dans le tableau ou le détail.
 * 
 * Exemple :
 * <StatusBadge status="quick" />     → 🟡 À compléter
 * <StatusBadge status="in_progress" /> → 🔵 En cours
 * <StatusBadge status="complete" />  → 🟢 Complet
 */
export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig.in_progress

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium whitespace-nowrap',
        config.style
      )}
    >
      {config.label}
    </span>
  )
}
