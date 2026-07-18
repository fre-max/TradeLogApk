import { AppLayout } from '@/components/layout/AppLayout'
import { BacktestWorkspace } from '@/components/backtest/BacktestWorkspace'

/**
 * Page principale de l'espace de backtesting interactif.
 * Intègre le BacktestWorkspace complet.
 */
export default function Backtest() {
  return (
    <AppLayout title="Espace Backtesting">
      <BacktestWorkspace />
    </AppLayout>
  )
}
