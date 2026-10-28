import { useUIStore } from '@/store'
import { useTrades } from '@/hooks/useTrades'
import { cn } from '@/lib/utils'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { SyncCloudBadge } from '@/components/sync/SyncCloudBadge'

// ─── Topbar ───────────────────────────────────────────────
// Barre horizontale en haut avec :
// - Bouton burger mobile (ouvre la sidebar)
// - Titre de la page (ou sélecteur Backtest Manuel / Bots quand on est dans le backtest)
// - Stats rapides (masquées sur mobile et sur backtest)
// - Bouton "+ Nouveau" (uniquement sur les journaux de trading)

interface TopbarProps {
  title: string
  onMenuClick: () => void
  // Si true, affiche un bouton "← Retour" au lieu du burger mobile
  showBack?: boolean
}

export function Topbar({ title, onMenuClick, showBack }: TopbarProps) {
  const openNewTrade = useUIStore((state) => state.openNewTrade)
  const { data: trades = [] } = useTrades()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  
  const estBacktest = location.pathname === '/backtest'
  const modeParam = searchParams.get('mode')
  const modeActif: 'manuel' | 'bots' = modeParam === 'bots' ? 'bots' : 'manuel'

  console.log('🔝 [Topbar] Rendu du composant')

  // Calcul des stats rapides pour l'affichage dans la topbar
  const totalTrades = trades.length
  const wins = trades.filter((t) => t.result === 'win').length
  const winRate = totalTrades ? Math.round((wins / totalTrades) * 100) : 0
  const avgRR = totalTrades
    ? (trades.reduce((acc, t) => acc + (t.rr_realized ?? 0), 0) / totalTrades).toFixed(2)
    : '—'

  return (
    <header className="h-[52px] border-b border-border flex items-center px-4 gap-3 flex-shrink-0">

      {/* Bouton retour (Settings) OU burger mobile (autres pages) */}
      {showBack ? (
        // Bouton retour visible sur toutes les tailles d'écran quand showBack=true
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-txt2 hover:text-txt transition-colors text-[13.5px]"
        >
          <span className="text-base leading-none">←</span>
          <span className="hidden sm:inline">Retour</span>
        </button>
      ) : (
        // Burger mobile — uniquement sur les pages normales (et visible sur desktop sur la page backtest)
        <button
          className={cn(
            "text-txt2 text-xl hover:opacity-80 transition-opacity",
            !estBacktest && "md:hidden"
          )}
          onClick={onMenuClick}
        >
          ☰
        </button>
      )}

      {/* 2️⃣ Titre standard OU Switch de Backtest (Manuel / Bots) directement dans la Navbar */}
      {estBacktest ? (
        <div className="flex items-center gap-2 flex-1 overflow-x-auto py-1">
          {/* Sélecteur compact de mode Backtest pour économiser l'espace vertical */}
          <div className="flex items-center gap-1 bg-surface2 p-1 rounded-lg border border-border">
            <button
              id="navbar-btn-backtest-manuel"
              onClick={() => setSearchParams({ mode: 'manuel' })}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5',
                modeActif === 'manuel'
                  ? 'bg-surface text-txt shadow-xs font-bold border border-border/80'
                  : 'text-txt3 hover:text-txt'
              )}
            >
              <span>🎯</span>
              <span>Manuel</span>
            </button>

            <button
              id="navbar-btn-backtest-bots"
              onClick={() => setSearchParams({ mode: 'bots' })}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5',
                modeActif === 'bots'
                  ? 'bg-accent text-white shadow-xs font-bold'
                  : 'text-txt3 hover:text-txt'
              )}
            >
              <span>🤖</span>
              <span>Bots</span>
              <span className="text-[9px] bg-white/20 px-1 py-0.2 rounded-full font-bold uppercase">
                SMC
              </span>
            </button>
          </div>
        </div>
      ) : (
        <span className="text-txt font-medium text-[15px] flex-1">{title}</span>
      )}

      {/* 3️⃣ Stats rapides — masquées en mode Backtest et sur mobile */}
      {!estBacktest && (
        <>
          <div className="hidden md:flex items-center gap-4">
            <Stat label="Win rate" value={`${winRate}%`} color="text-win" />
            <Stat label="Moy. R:R" value={avgRR === '—' ? '—' : `${avgRR}R`} color="text-accent" />
            <Stat label="Trades" value={String(totalTrades)} />
          </div>

          {/* Compteur compact mobile — juste le nombre de trades */}
          <span className="md:hidden text-txt3 text-[12px]">
            {totalTrades} trade{totalTrades !== 1 ? 's' : ''}
          </span>
        </>
      )}

      {/* 4️⃣ Badge de synchronisation Cloud — visible sur toutes les pages */}
      <SyncCloudBadge />

      {/* 5️⃣ Bouton nouveau trade — masqué dans l'espace Backtest pour libérer de l'espace */}
      {!estBacktest && (
        <button
          onClick={() => {
            console.log('🔝 [Topbar] Clic bouton + Nouveau')
            openNewTrade()
          }}
          className="bg-accent text-white px-3 py-1.5 rounded-md text-[13px] font-medium hover:bg-accent/90 transition-colors"
        >
          <span className="hidden sm:inline">+ Nouveau</span>
          <span className="sm:hidden">+</span>
        </button>
      )}
    </header>
  )
}

// ─── Stat individuelle ────────────────────────────────────

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[12.5px] text-txt2">
      {label} <span className={cn('font-semibold text-[13px]', color ?? 'text-txt')}>{value}</span>
    </div>
  )
}
