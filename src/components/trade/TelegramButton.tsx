import { useState } from 'react'
import { useTelegram } from '@/hooks/useTelegram'
import { useQuickEntry } from '@/hooks/useQuickEntry'
import { useUIStore } from '@/store'
import { cn } from '@/lib/utils'
import { useQueryClient } from '@tanstack/react-query'

/**
 * Bouton flottant en bas à droite pour déclencher le Quick Entry via Telegram.
 * 
 * Comportement selon le mode retourné par /api/telegram :
 * - 'quick' ou 'quick_fallback' → crée automatiquement le trade (status: 'quick')
 * - 'analyse' → ouvre le drawer et pré-remplit les champs
 * - 'standard' → retourne juste l'URL de l'image (comportement classique)
 * 
 * Affiche une modale de résumé après l'action.
 */
export function TelegramButton() {
  const { fetchLastMessage, testBotConnection, isLoading: telegramLoading } = useTelegram()
  const { mutateAsync: creerQuickEntry, isPending: quickEntryPending } = useQuickEntry()
  const addToast = useUIStore((state) => state.addToast)
  const openNewTrade = useUIStore((state) => state.openNewTrade)
  const queryClient = useQueryClient()

  // État local pour afficher le résumé d'action
  const [showResultat, setShowResultat] = useState(false)
  const [resultatMessage, setResultatMessage] = useState('')

  const enChargement = telegramLoading || quickEntryPending

  const handleCheck = async () => {
    console.log('📱 [TelegramButton] Vérification du dernier message Telegram...')
    setShowResultat(false)

    // On demande explicitement le mode 'quick' : analyse Gemini + création du trade automatique
    const etat = await fetchLastMessage(undefined, 'quick')

    if (etat.error || !etat.preview) {
      addToast(etat.error || 'Aucune image trouvée dans le bot', 'error')
      return
    }

    if (etat.mode === 'quick' && etat.analysis) {
      try {
        // Le trade a déjà été créé par la fonction Edge Supabase en arrière-plan.
        // On a simplement besoin de rafraîchir les données de l'interface et de notifier l'utilisateur.
        queryClient.invalidateQueries({ queryKey: ['trades'] })
        setResultatMessage(
          `✅ Trade rapide créé par le bot ! (${etat.analysis.pair || 'Paire inconnue'} ${etat.analysis.direction || ''}) — Complète l'analyse dès que possible.`
        )
        setShowResultat(true)
        addToast('Trade rapide récupéré et synchronisé !', 'success')
        console.log('✅ [TelegramButton] Trade rapide synchronisé, ID :', etat.tradeId)
      } catch (err: any) {
        console.error('❌ [TelegramButton] Erreur de synchronisation du trade :', err)
        addToast('Erreur lors de la synchronisation du trade', 'error')
      }
    } else if (etat.mode === 'quick_fallback' && etat.analysis) {
      try {
        // En cas de fallback, on crée le trade côté client via le hook
        const resultat = await creerQuickEntry({
          analysis: etat.analysis,
          imageUrl: etat.preview,
        })
        setResultatMessage(
          `✅ Trade rapide créé ! (${resultat.analysis.pair || 'Paire inconnue'} ${resultat.analysis.direction || ''}) — Complète l'analyse dès que possible.`
        )
        setShowResultat(true)
        addToast('Trade rapide créé avec succès !', 'success')
        console.log('✅ [TelegramButton] Trade rapide créé via client, ID :', resultat.tradeId)
      } catch (err: any) {
        console.error('❌ [TelegramButton] Erreur création trade rapide :', err)
        addToast(err.message || 'Erreur lors de la création du trade', 'error')
      }

    } else if (etat.mode === 'analyse' && etat.analysis) {
      // Mode "a" : on ouvre le formulaire et on notifie l'utilisateur de pré-remplir
      // TODO: Pour pré-remplir le formulaire, il faudra étendre TradeDrawer pour accepter des props initiales
      openNewTrade()
      addToast(
        `IA : ${etat.analysis.pair || '?'} ${etat.analysis.direction || ''} — Formulaire ouvert. Pré-remplissage manuel requis.`,
        'info'
      )
      console.log('ℹ️ [TelegramButton] Mode analyse, formulaire ouvert. Données IA :', etat.analysis)

    } else {
      addToast('Image Telegram récupérée — liaison OK (sans analyse IA)', 'success')
    }
  }

  const handleTestConnexion = async () => {
    setShowResultat(false)
    const statut = await testBotConnection()

    if (!statut.ok || !statut.bot) {
      addToast(statut.error || 'Connexion au bot impossible', 'error')
      return
    }

    const webhookMsg = statut.webhook?.active
      ? '⚠️ Webhook actif — désactive-le pour le Quick Entry'
      : '✓ Polling OK'

    addToast(
      `Bot @${statut.bot.username} connecté — ${statut.queue?.pendingPhotos ?? 0} photo(s) en attente — ${webhookMsg}`,
      statut.webhook?.active ? 'info' : 'success'
    )
  }

  const handleClick = (e: React.MouseEvent) => {
    if (e.shiftKey) {
      void handleTestConnexion()
      return
    }
    void handleCheck()
  }

  return (
    <>
      {/* ─── Bouton flottant ──────────────────────────────────── */}
      <button
        id="telegram-quick-entry-btn"
        onClick={handleClick}
        disabled={enChargement}
        title="Cliquer = récupérer la dernière photo | Shift+clic = tester la connexion"
        className={cn(
          'fixed bottom-6 right-6 z-[80]',
          'flex items-center gap-2 px-4 py-3 rounded-full shadow-xl',
          'bg-accent text-white font-medium text-[13px]',
          'hover:bg-accent/90 active:scale-95 transition-all duration-150',
          'disabled:opacity-60 disabled:cursor-not-allowed'
        )}
      >
        {/* Icône Telegram */}
        <span className="text-base">📱</span>
        <span className="hidden sm:inline">
          {enChargement ? 'Analyse en cours...' : 'Bot Telegram'}
        </span>
        {enChargement && (
          <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
        )}
      </button>

      {/* ─── Toast de résultat (modale légère en bas à droite) ─── */}
      {showResultat && (
        <div
          className={cn(
            'fixed bottom-20 right-6 z-[81] max-w-[320px]',
            'bg-surface border border-border rounded-xl shadow-2xl p-4',
            'animate-in slide-in-from-bottom-2 duration-200'
          )}
        >
          <div className="flex items-start gap-3">
            <span className="text-xl">⚡</span>
            <div className="flex-1">
              <p className="text-txt text-[13px] font-medium mb-1">Quick Entry réussi</p>
              <p className="text-txt3 text-[12px] leading-relaxed">{resultatMessage}</p>
            </div>
            <button
              onClick={() => setShowResultat(false)}
              className="text-txt3 hover:text-txt text-sm leading-none mt-0.5"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  )
}
