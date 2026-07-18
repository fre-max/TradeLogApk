import { useEffect } from 'react'
import { useUIStore } from '@/store'
import { cn } from '@/lib/utils'
import type { Toast } from '@/store'

// ─── Conteneur de toasts ──────────────────────────────────
// Se place au niveau global (App.tsx) pour afficher les notifications
// Position : bas droite sur desktop, bas centré sur mobile
//
// Exemple d'utilisation depuis n'importe quel composant :
// const { addToast } = useUIStore()
// addToast('Erreur de connexion Supabase', 'error')
// addToast('Trade enregistré !', 'success')

export function ToastContainer() {
  const toasts = useUIStore((state) => state.toasts)

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 left-4 md:left-auto md:w-[380px] z-[300] flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  )
}

// ─── Toast individuel ─────────────────────────────────────
// Auto-dismiss après 5 secondes
// Clic sur ✕ pour fermer manuellement

function ToastItem({ toast }: { toast: Toast }) {
  const removeToast = useUIStore((state) => state.removeToast)

  // Auto-dismiss après 5 secondes
  useEffect(() => {
    const timer = setTimeout(() => {
      removeToast(toast.id)
    }, 5000)

    return () => clearTimeout(timer)
  }, [toast.id, removeToast])

  // Styles selon le type de toast
  const styles = {
    error: 'border-loss/30 bg-loss/10 text-loss',
    success: 'border-win/30 bg-win/10 text-win',
    info: 'border-accent/30 bg-accent/10 text-accent',
  }

  // Icônes selon le type
  const icons = {
    error: '❌',
    success: '✅',
    info: 'ℹ️',
  }

  return (
    <div
      className={cn(
        'flex items-start gap-2.5 px-4 py-3 rounded-lg border backdrop-blur-sm',
        'animate-[slideUp_0.3s_ease-out]',
        'bg-surface/95',
        styles[toast.type]
      )}
    >
      <span className="text-sm flex-shrink-0 mt-0.5">{icons[toast.type]}</span>
      <p className="text-[13px] flex-1 leading-relaxed">{toast.message}</p>
      <button
        onClick={() => removeToast(toast.id)}
        className="text-txt3 hover:text-txt text-sm leading-none flex-shrink-0 mt-0.5"
      >
        ✕
      </button>
    </div>
  )
}
