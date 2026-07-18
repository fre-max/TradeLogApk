import { AppLayout } from '@/components/layout/AppLayout'
import { TelegramButton } from '@/components/trade/TelegramButton'
import { TradeDetail } from '@/components/trade/TradeDetail'
import { TradeDrawer } from '@/components/trade/TradeDrawer'
import { TradeTable } from '@/components/trade/TradeTable'
import { useParams } from 'react-router-dom'

// ─── Page Journal ─────────────────────────────────────────
// Page principale qui affiche la liste des trades filtrés
// par type de journal (global, bias, poi, confirmation)
//-----------------------------------
export default function Journal() {
  const { type } = useParams<{ type: string }>()
  const journalType = (type || 'global') as 'global' | 'bias' | 'poi' | 'confirmation'

  // Titre dynamique selon le type de journal
  const titres: Record<string, string> = {
    global: 'Tous Les Trades Fred',
    bias: 'Journal de Biais',
    poi: 'Journal POI / Zones',
    confirmation: 'Journal de Confirmation',
  }

  const title = titres[journalType] || 'Tous Les Trades Fred'

  return (
    <AppLayout title={title}>
      <TradeTable />

      {/* Drawers — se superposent au contenu */}
      <TradeDrawer />
      <TradeDetail />

      {/* Bouton flottant Telegram (Quick Entry) */}
      <TelegramButton />
    </AppLayout>
  )
}
