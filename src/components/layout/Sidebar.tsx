import { cn } from '@/lib/utils'
import { useFilterStore, useUIStore } from '@/store'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStrategies } from '@/hooks/useStrategies'

const PAIRS = ['XAUUSD', 'EURUSD', 'GBPUSD', 'NAS100', 'US30', 'BTCUSD']

// ─── Items de navigation ──────────────────────────────────
// Chaque item correspond à une route de l'app
const JOURNAL_ITEMS = [
  { icon: '📋', label: 'Global', path: '/' },
  { icon: '🎯', label: 'Journal Biais', path: '/journal/bias' },
  { icon: '🗺️', label: 'Journal POI', path: '/journal/poi' },
  { icon: '⚡', label: 'Journal Confirmation', path: '/journal/confirmation' },
]

const NAV_ITEMS = [
  { icon: '📊', label: 'Statistiques', path: '/stats' },
  { icon: '📖', label: 'Playbook', path: '/playbook' },
  { icon: '📚', label: 'Catalogue raisons', path: '/catalog' },
  { icon: '🔁', label: 'Backtesting', path: '/backtest' },
]

export function Sidebar() {
  const isSidebarOpen = useUIStore((state) => state.isSidebarOpen)
  const closeSidebar = useUIStore((state) => state.closeSidebar)
  const filterPair = useFilterStore((state) => state.filterPair)
  const filterStrategyId = useFilterStore((state) => state.filterStrategyId)
  const setFilter = useFilterStore((state) => state.setFilter)
  const location = useLocation()
  const navigate = useNavigate()
  const { data: strategies = [] } = useStrategies()

  const estBacktest = location.pathname === '/backtest'

  // Navigation vers une page + fermeture de la sidebar sur mobile/tablette
  const naviguerVers = (path: string) => {
    navigate(path)
    closeSidebar()
  }

  return (
    <>
      {/* Backdrop — visible uniquement quand la sidebar est ouverte (masqué sur desktop sauf en mode backtest) */}
      {isSidebarOpen && (
        <div
          className={cn(
            "fixed inset-0 bg-black/60 z-[140] transition-opacity duration-300",
            !estBacktest && "md:hidden"
          )}
          onClick={closeSidebar}
        />
      )}

      <aside
        className={cn(
          'w-[220px] bg-surface border-r border-border flex flex-col py-5 flex-shrink-0',
          // Mode tiroir par défaut (fixé à gauche avec transition slide)
          'fixed top-0 left-0 h-full z-[150] transition-transform duration-300',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full',
          // Mode permanent côte-à-côte uniquement sur desktop et hors backtest
          !estBacktest && 'md:relative md:translate-x-0'
        )}
      >
        {/* Logo + bouton fermer */}
        <div className="flex items-center gap-2.5 px-4 pb-6">
          <div className="w-7 h-7 bg-accent rounded-md flex items-center justify-center text-white font-semibold text-xs">TL</div>
          <span className="text-txt font-semibold text-[15px] tracking-tight flex-1">TradeLog</span>
          {/* Bouton fermer visible sur mobile, et sur desktop uniquement pour le backtest */}
          <button
            onClick={closeSidebar}
            className={cn(
              "text-txt3 hover:text-txt text-lg leading-none",
              !estBacktest && "md:hidden"
            )}
          >
            ✕
          </button>
        </div>

        {/* Catégories de Journaux */}
        <div className="px-2 mb-4">
          <p className="text-[11px] font-medium text-txt3 uppercase tracking-wider px-2 mb-1">Journaux</p>
          {JOURNAL_ITEMS.map((item) => (
            <NavItem
              key={item.path}
              icon={item.icon}
              label={item.label}
              active={location.pathname === item.path}
              onClick={() => naviguerVers(item.path)}
            />
          ))}
        </div>

        {/* Autres outils de navigation */}
        <div className="px-2 mb-6">
          <p className="text-[11px] font-medium text-txt3 uppercase tracking-wider px-2 mb-1">Outils</p>
          {NAV_ITEMS.map((item) => (
            <NavItem
              key={item.path}
              icon={item.icon}
              label={item.label}
              active={location.pathname === item.path}
              onClick={() => naviguerVers(item.path)}
            />
          ))}
        </div>

        {/* Filtres rapides par paire */}
        <div className="px-2 mb-4">
          <p className="text-[11px] font-medium text-txt3 uppercase tracking-wider px-2 mb-1">Filtres rapides</p>
          
          <div className="px-2 mb-3">
            <select
              value={filterStrategyId || ''}
              onChange={(e) => setFilter('filterStrategyId', e.target.value || null)}
              className="w-full bg-bg border border-border2 rounded-md text-txt px-2 py-1.5 text-[12.5px] outline-none focus:border-accent"
            >
              <option value="">Toutes les stratégies</option>
              {strategies.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.version})</option>
              ))}
            </select>
          </div>
          {PAIRS.map((pair) => (
            <NavItem
              key={pair}
              icon="💹"
              label={pair}
              active={filterPair === pair}
              onClick={() => setFilter('filterPair', filterPair === pair ? null : pair)}
            />
          ))}
        </div>

        <div className="mt-auto px-2 pt-4 border-t border-border">
          <NavItem
            icon="⚙️"
            label="Paramètres"
            active={location.pathname === '/settings'}
            onClick={() => location.pathname === '/settings' ? navigate(-1) : naviguerVers('/settings')}
          />
        </div>
      </aside>
    </>
  )
}

// ─── NavItem ──────────────────────────────────────────────

interface NavItemProps {
  icon: string
  label: string
  active?: boolean
  onClick?: () => void
}

function NavItem({ icon, label, active, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[13.5px] transition-all text-left',
        active
          ? 'bg-accent/10 text-accent'
          : 'text-txt2 hover:bg-surface2 hover:text-txt'
      )}
    >
      <span className="w-4 text-center text-[15px]">{icon}</span>
      {label}
    </button>
  )
}
