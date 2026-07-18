import { useState, useEffect } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { supabase } from '@/lib/supabase'
import { useNavigate } from 'react-router-dom'
import { useTrades } from '@/hooks/useTrades'
import { useUIStore } from '@/store'
import { usePinStore } from '@/store/usePinStore'
import { cn } from '@/lib/utils'
import { exportCsv } from '@/lib/exportCsv'
import type { Session } from '@supabase/supabase-js'
import { useOfflineSyncManager } from '@/hooks/useOfflineSyncManager'

export default function Settings() {
  const navigate = useNavigate()
  const { data: trades = [] } = useTrades()
  const addToast = useUIStore((state) => state.addToast)
  const { pin, setPin } = usePinStore()
  const [session, setSession] = useState<Session | null>(null)
  const [newPin, setNewPin] = useState('')
  const [syncEnCours, setSyncEnCours] = useState(false)

  // Récupère la fonction syncAll du SyncManager pour déclencher manuellement
  const { syncAll } = useOfflineSyncManager()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
  }, [])
  
  // ─── Calcul des quotas et de la consommation ────────────────
  // On calcule l'usage de manière dynamique à partir des données en cache de React Query
  let totalSteps = 0
  let totalImagesStockees = 0
  let totalAnalysesGemini = 0

  trades.forEach(trade => {
    totalSteps += trade.steps?.length || 0
    trade.steps?.forEach((step: any) => {
      step.images?.forEach((img: any) => {
        // Les images issues d'upload direct ou de Telegram sont stockées dans le bucket Supabase
        if (img.source === 'upload' || img.source === 'telegram') {
          totalImagesStockees++
        }
        // Chaque image Telegram correspond à un appel à l'API Gemini Vision
        if (img.source === 'telegram') {
          totalAnalysesGemini++
        }
      })
    })
  })

  // Estimation de la taille de stockage (250 Ko en moyenne par capture d'écran)
  const stockageEstimeMo = parseFloat((totalImagesStockees * 0.25).toFixed(2))
  
  // États pour les différentes sections
  const [telegramToken, setTelegramToken] = useState('')
  const [telegramStatus, setTelegramStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')

  // ─── Thème (sombre / clair) ─────────────────────────────────
  // On lit la préférence depuis localStorage au montage du composant
  // Le thème clair est activé par la classe .light sur <html>
  const [isLightMode, setIsLightMode] = useState(() => {
    return document.documentElement.classList.contains('light')
  })

  const [showIncompleteReminder, setShowIncompleteReminder] = useState(true)

  // ─── Sécurité / PIN ─────────────────────────────────────────
  const handleSavePin = async () => {
    if (newPin.length !== 4) {
      addToast('Le code PIN doit faire 4 chiffres', 'error')
      return
    }
    setPin(newPin)
    addToast('Code PIN configuré avec succès !', 'success')
    setNewPin('')

    // Si on est connecté, on sauvegarde aussi sur Supabase
    if (session) {
      const { error } = await supabase.auth.updateUser({
        data: { pin_code: newPin }
      })
      if (!error) {
        addToast('PIN sauvegardé sur le cloud (récupération activée)', 'success')
      }
    }
  }

  const handleRemovePin = async () => {
    setPin(null)
    addToast('Code PIN supprimé', 'success')
    if (session) {
      await supabase.auth.updateUser({ data: { pin_code: null } })
    }
  }

  // ─── Synchronisation manuelle Cloud → Local ─────────────────
  const handleSyncCloud = async () => {
    if (!session) {
      addToast('Vous devez être connecté au cloud pour récupérer vos données', 'error')
      return
    }
    if (!navigator.onLine) {
      addToast('Pas de connexion internet disponible', 'error')
      return
    }
    setSyncEnCours(true)
    try {
      await syncAll()
      addToast('Toutes vos données ont été téléchargées et sauvegardées en local !', 'success')
    } catch (e) {
      addToast('Erreur lors de la récupération des données', 'error')
    } finally {
      setSyncEnCours(false)
    }
  }

  // ─── Authentification ────────────────────────────────────────────
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      setSession(null)
      addToast('Déconnecté du cloud', 'success')
    } catch (error) {
      addToast('Erreur lors de la déconnexion', 'error')
    }
  }

  // ─── Export CSV enrichi (avec liens images) ──────────────────────
  const handleExportCSV = () => {
    if (trades.length === 0) {
      addToast('Aucun trade à exporter', 'error')
      return
    }
    exportCsv(trades)
    addToast(`${trades.length} trade(s) exporté(s) en CSV !`, 'success')
  }

  // ─── Test Telegram ──────────────────────────────────────────
  const handleTestTelegram = async () => {
    if (!telegramToken.trim()) {
      addToast('Veuillez entrer un token Telegram', 'error')
      return
    }

    setTelegramStatus('testing')
    try {
      // Le token Telegram est géré côté serveur par Supabase Edge Functions.
      // On teste juste que la fonction est accessible et que le serveur a bien le token.
      const { data, error } = await supabase.functions.invoke('telegram', {
        body: { ping: true }
      })
      
      if (!error && data?.ok) {
        setTelegramStatus('success')
        addToast('Connexion Telegram réussie !', 'success')
      } else {
        setTelegramStatus('error')
        addToast(error?.message || data?.error || 'Erreur de connexion Telegram', 'error')
      }
    } catch (error) {
      setTelegramStatus('error')
      addToast('Erreur lors du test Telegram', 'error')
    }
  }

  // ─── Toggle Light Mode ────────────────────────────────────
  // Ajoute / retire la classe .light sur <html>
  // Les variables CSS dans index.css réagissent automatiquement
  const handleToggleDarkMode = () => {
    const prochainEtat = !isLightMode
    setIsLightMode(prochainEtat)

    if (prochainEtat) {
      // Activation du thème clair
      document.documentElement.classList.add('light')
      localStorage.setItem('theme', 'light')
    } else {
      // Retour au thème sombre
      document.documentElement.classList.remove('light')
      localStorage.setItem('theme', 'dark')
    }

    addToast(`Thème ${prochainEtat ? 'clair' : 'sombre'} activé`, 'success')
  }

  // ─── Rappel trades incomplets ────────────────────────────────
  const incompleteTrades = trades.filter(t => t.status === 'in_progress' || t.status === 'quick').length

  return (
    <AppLayout title="Paramètres" showBack>
      <div className="flex-1 overflow-y-auto p-4 md:p-6 max-w-4xl">
        
        {/* Section Sécurité */}
        <Section title="🔒 Sécurité">
          {pin ? (
            <SettingRow
              label="Code PIN"
              description="Application verrouillée par code PIN"
              action={
                <button
                  onClick={handleRemovePin}
                  className="px-4 py-2 bg-loss/10 text-loss rounded-md text-[13px] font-medium hover:bg-loss/20 transition-colors"
                >
                  Supprimer
                </button>
              }
            />
          ) : (
            <div className="py-3">
              <p className="text-txt text-[13.5px] font-medium mb-1">Code PIN</p>
              <p className="text-txt3 text-[12px] mb-3">Définissez un code à 4 chiffres pour protéger l'accès local à l'application.</p>
              <div className="flex gap-3">
                <input
                  type="text"
                  maxLength={4}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="Ex: 1234"
                  className="w-24 px-3 py-2 bg-bg border border-border rounded-md text-[13px] text-txt placeholder-txt3 text-center tracking-widest focus:outline-none focus:border-accent"
                />
                <button
                  onClick={handleSavePin}
                  className="px-4 py-2 bg-accent text-white rounded-md text-[13px] font-medium hover:bg-accent/90 transition-colors"
                >
                  Activer
                </button>
              </div>
            </div>
          )}
        </Section>

        {/* Section Compte */}
        <Section title="☁️ Cloud & Synchronisation">
          {session ? (
            <div className="space-y-3">
              <SettingRow
                label="Connecté au Cloud"
                description={`Synchronisation active (${session.user.email})`}
                action={
                  <button
                    onClick={handleLogout}
                    className="px-4 py-2 bg-surface2 text-txt rounded-md text-[13px] font-medium hover:bg-border transition-colors"
                  >
                    Se déconnecter
                  </button>
                }
              />
              {/* Bouton de récupération manuelle des données cloud */}
              <div className="border-t border-border pt-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-txt text-[13.5px] font-medium">Récupérer les données du cloud</p>
                    <p className="text-txt3 text-[12px] mt-0.5">
                      Télécharge tous vos trades, raisons et stratégies depuis Supabase et les sauvegarde sur cet appareil pour une utilisation hors-ligne.
                    </p>
                  </div>
                  <button
                    onClick={handleSyncCloud}
                    disabled={syncEnCours}
                    className={cn(
                      'flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-medium transition-all',
                      syncEnCours
                        ? 'bg-surface2 text-txt3 cursor-not-allowed'
                        : 'bg-accent text-white hover:bg-accent/90 active:scale-95'
                    )}
                  >
                    {syncEnCours ? (
                      <>
                        <span className="animate-spin text-[16px]">⟳</span>
                        En cours...
                      </>
                    ) : (
                      <>
                        ⬇️ Télécharger
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <SettingRow
              label="Mode Hors-ligne"
              description="Connectez-vous pour synchroniser vos trades sur le cloud et activer l'IA."
              action={
                <button
                  onClick={() => navigate('/auth')}
                  className="px-4 py-2 bg-accent text-white rounded-md text-[13px] font-medium hover:bg-accent/90 transition-colors"
                >
                  Se connecter
                </button>
              }
            />
          )}
        </Section>

        {/* Section Données — Export CSV + info PDF */}
        <Section title="📊 Données">
          <SettingRow
            label="Export Excel / CSV"
            description={`Exporte ${trades.length} trade(s) avec toutes les données et liens vers les images`}
            action={
              <button
                onClick={handleExportCSV}
                className="px-4 py-2 bg-accent text-white rounded-md text-[13px] font-medium hover:bg-accent/90 transition-colors whitespace-nowrap"
              >
                📊 Exporter CSV
              </button>
            }
          />
          <div className="border-t border-border pt-3 mt-1">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-txt text-[13.5px] font-medium">Export PDF par trade</p>
                <p className="text-txt3 text-[12px] mt-0.5">
                  Disponible dans le détail de chaque trade — bouton « 📄 PDF »
                </p>
              </div>
              <span className="text-txt3 text-[12px] px-2.5 py-1 bg-surface2 border border-border2 rounded-md whitespace-nowrap flex-shrink-0">
                Dans le détail →
              </span>
            </div>
          </div>
        </Section>

        {/* Section Telegram */}
        <Section title="📱 Configuration Telegram">
          <div className="space-y-4">
            <div>
              <label className="block text-txt text-[13px] font-medium mb-2">Token du bot Telegram</label>
              <input
                type="text"
                value={telegramToken}
                onChange={(e) => setTelegramToken(e.target.value)}
                placeholder="Entrez votre token Telegram..."
                className="w-full px-3 py-2 bg-bg border border-border rounded-md text-[13px] text-txt placeholder-txt3 focus:outline-none focus:border-accent"
              />
            </div>
            <button
              onClick={handleTestTelegram}
              disabled={telegramStatus === 'testing'}
              className={cn(
                'px-4 py-2 rounded-md text-[13px] font-medium transition-colors',
                telegramStatus === 'testing' ? 'bg-txt3 text-txt cursor-not-allowed' :
                telegramStatus === 'success' ? 'bg-win/10 text-win' :
                telegramStatus === 'error' ? 'bg-loss/10 text-loss' :
                'bg-accent text-white hover:bg-accent/90'
              )}
            >
              {telegramStatus === 'testing' ? 'Test en cours...' :
               telegramStatus === 'success' ? '✓ Connexion réussie' :
               telegramStatus === 'error' ? '✗ Erreur' :
               'Tester la connexion'}
            </button>
            <p className="text-txt3 text-[12px]">
              💡 Pour obtenir un token, créez un bot via @BotFather sur Telegram
            </p>
          </div>
        </Section>

        {/* Section Consommation & Quotas */}
        <Section title="⚡ Consommation & Quotas (Free Tier)">
          <div className="space-y-6">
            
            {/* Jauge Gemini IA */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[13px]">
                <span className="text-txt font-medium flex items-center gap-1.5">
                  🔮 Analyses IA (Gemini Vision)
                </span>
                <span className="text-txt3 font-semibold">
                  {totalAnalysesGemini} / 1 500 <span className="text-[11px] font-normal text-txt4">requêtes/jour</span>
                </span>
              </div>
              <div className="w-full h-2 bg-surface2 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-500" 
                  style={{ 
                    width: `${Math.min((totalAnalysesGemini / 1500) * 100, 100)}%`,
                    backgroundColor: '#6366f1' 
                  }}
                />
              </div>
              <p className="text-txt3 text-[11.5px] leading-tight">
                Usage de l'API gratuite de Gemini. Limite de 15 requêtes/minute et 1 500 requêtes/jour.
              </p>
            </div>

            {/* Jauge Stockage Supabase */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[13px]">
                <span className="text-txt font-medium flex items-center gap-1.5">
                  📁 Stockage d'images (Supabase Storage)
                </span>
                <span className="text-txt3 font-semibold">
                  {stockageEstimeMo} Mo / 1 000 Mo <span className="text-[11px] font-normal text-txt4">({totalImagesStockees} fichier{totalImagesStockees > 1 ? 's' : ''})</span>
                </span>
              </div>
              <div className="w-full h-2 bg-surface2 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-500" 
                  style={{ 
                    width: `${Math.min((stockageEstimeMo / 1000) * 100, 100)}%`,
                    backgroundColor: '#3b82f6' 
                  }}
                />
              </div>
              <p className="text-txt3 text-[11.5px] leading-tight">
                Espace disque estimé pour vos captures d'écran (taille moyenne : 250 Ko/image). Quota Supabase Free Tier : 1 Go.
              </p>
            </div>

            {/* Jauge Base de données */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[13px]">
                <span className="text-txt font-medium flex items-center gap-1.5">
                  💾 Base de données (Supabase Postgres)
                </span>
                <span className="text-txt3 font-semibold">
                  {trades.length} / 10 000 <span className="text-[11px] font-normal text-txt4">trades ({totalSteps} étape{totalSteps > 1 ? 's' : ''})</span>
                </span>
              </div>
              <div className="w-full h-2 bg-surface2 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-500" 
                  style={{ 
                    width: `${Math.min((trades.length / 10000) * 100, 100)}%`,
                    backgroundColor: '#10b981' 
                  }}
                />
              </div>
              <p className="text-txt3 text-[11.5px] leading-tight">
                Nombre de trades enregistrés. La base de données Supabase gratuite est limitée à 500 Mo (environ 250 000 trades).
              </p>
            </div>

          </div>
        </Section>

        {/* Section Apparence */}
        <Section title="🎨 Apparence">
          <SettingRow
            label="Thème clair"
            description="Basculer entre le thème sombre (défaut) et le thème clair"
            action={
              <button
                onClick={handleToggleDarkMode}
                className={cn(
                  'w-12 h-6 rounded-full relative transition-colors',
                  isLightMode ? 'bg-accent' : 'bg-surface2'
                )}
              >
                <div
                  className={cn(
                    'w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform',
                    isLightMode ? 'translate-x-6' : 'translate-x-0.5'
                  )}
                />
              </button>
            }
          />
        </Section>

        {/* Section Rappels */}
        <Section title="🔔 Rappels">
          <SettingRow
            label="Trades incomplets"
            description={`${incompleteTrades} trade(s) en cours`}
            action={
              <div className="flex items-center gap-2">
                <span className={cn(
                  'text-[13px] font-medium',
                  incompleteTrades > 0 ? 'text-accent' : 'text-txt3'
                )}>
                  {incompleteTrades} incomplet(s)
                </span>
              </div>
            }
          />
        </Section>

      </div>
    </AppLayout>
  )
}

// ─── Composants helpers ───────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden mb-4">
      <div className="px-4 py-3 border-b border-border">
        <span className="text-txt text-[14px] font-semibold">{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function SettingRow({ 
  label, 
  description, 
  action 
}: { 
  label: string
  description: string
  action: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-txt text-[13.5px] font-medium">{label}</p>
        <p className="text-txt3 text-[12px]">{description}</p>
      </div>
      {action}
    </div>
  )
}
