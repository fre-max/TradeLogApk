import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'
import Journal from '@/pages/Journal'
import Stats from '@/pages/Stats'
import Settings from '@/pages/Settings'
import Auth from '@/pages/Auth'
import Catalog from '@/pages/Catalog'
import Playbook from '@/pages/Playbook'
import Backtest from '@/pages/Backtest'
import { ToastContainer } from '@/components/ui/Toast'
import { useOfflineSyncManager } from '@/hooks/useOfflineSyncManager'
import { PinGuard } from '@/components/auth/PinGuard'

// Configuration de TanStack Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 min de cache
      retry: 1,
    },
  },
})

// Restaure la préférence de thème dès le démarrage (avant le premier rendu React)
// Sans ça, le thème se réinitialise au sombre à chaque refresh de page
const themeEnregistre = localStorage.getItem('theme')
if (themeEnregistre === 'light') {
  document.documentElement.classList.add('light')
}

export function AppContent() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  // Initialiser la synchronisation hors-ligne (file d'attente)
  useOfflineSyncManager()

  // Écouter les changements d'authentification Supabase
  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data }) => setSession(data.session))
      .catch((error) => {
        console.error('❌ [Supabase] Erreur session:', error)
        setSession(null)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  // On retire l'écran de chargement bloquant pour le mode hors-ligne
  // afin que l'application s'affiche instantanément.

  return (
    <PinGuard>
      <HashRouter>
        <Routes>
          {/* Routes en accès libre (Offline-First) */}
          <Route path="/" element={<Journal />} />
          <Route path="/journal/:type" element={<Journal />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/playbook" element={<Playbook />} />
          <Route path="/backtest" element={<Backtest />} />

          {/* Auth — redirige vers / si déjà connecté, sinon affiche la page de connexion */}
          <Route
            path="/auth"
            element={!session ? <Auth /> : <Navigate to="/" replace />}
          />
        </Routes>

        {/* Toasts globaux — visibles sur toutes les pages */}
        <ToastContainer />
      </HashRouter>
    </PinGuard>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  )
}
