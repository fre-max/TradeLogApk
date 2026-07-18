import { useUIStore } from '@/store'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

// ─── Layout partagé ───────────────────────────────────────
// Utilisé par Journal, Stats et Settings pour ne pas dupliquer
// la Sidebar et le Topbar dans chaque page
//
// Exemple avec bouton retour (page Settings) :
// <AppLayout title="Paramètres" showBack>
//   <MonContenu />
// </AppLayout>

interface AppLayoutProps {
  children: React.ReactNode
  title: string
  // Si true, affiche un bouton "← Retour" dans la topbar (utilisé par Settings)
  showBack?: boolean
}

export function AppLayout({ children, title, showBack }: AppLayoutProps) {
  const openSidebar = useUIStore((state) => state.openSidebar)

  return (
    <div className="flex h-screen bg-bg overflow-hidden">
      {/* Sidebar — gère son propre backdrop et animation */}
      <Sidebar />

      {/* Contenu principal */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar title={title} onMenuClick={openSidebar} showBack={showBack} />
        {children}
      </div>
    </div>
  )
}
