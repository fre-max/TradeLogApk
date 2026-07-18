import { useState } from 'react'
import { cn } from '@/lib/utils'
import { uploadImage } from '@/lib/storage'
import { supabase } from '@/lib/supabase'
import { useUIStore } from '@/store'
import { useTelegram } from '@/hooks/useTelegram'
import type { TradeImage, TradeImagePhase, TradeImageContext } from '@/types'

interface TradeImageManagerProps {
  images: Partial<TradeImage>[]
  onChange: (images: Partial<TradeImage>[]) => void
}

const PHASES: { id: TradeImagePhase; label: string }[] = [
  { id: 'avant', label: 'AVANT (Analyse)' },
  { id: 'apres', label: 'APRÈS (Résultat)' }
]

const CONTEXTS: { id: TradeImageContext; label: string; icon: string }[] = [
  { id: 'global', label: 'Global', icon: '🌍' },
  { id: 'superieur', label: 'Contexte Sup. (HTF)', icon: '🦅' },
  { id: 'intermediaire', label: 'Intermédiaire (ITF)', icon: '🔎' },
  { id: 'inferieur', label: 'Entrée (LTF)', icon: '🎯' },
]

export function TradeImageManager({ images, onChange }: TradeImageManagerProps) {
  const addToast = useUIStore((state) => state.addToast)
  const [uploadingKey, setUploadingKey] = useState<string | null>(null)
  
  // Telegram State
  const { isLoading: telegramLoading, preview, fetchLastImage, clearPreview } = useTelegram()
  const [activeTelegramKey, setActiveTelegramKey] = useState<string | null>(null)

  const handleUploadImage = async (phase: TradeImagePhase, context: TradeImageContext, file: File) => {
    if (!file) return
    const key = `${phase}-${context}`
    setUploadingKey(key)

    try {
      const { compresserEtConvertirEnBase64 } = await import('@/lib/storage')
      const base64Url = await compresserEtConvertirEnBase64(file)
      
      const newImages = [...images]
      const existingIndex = newImages.findIndex(img => img.phase === phase && img.context === context)
      
      // On sauvegarde en "local" pour que l'OfflineSyncManager s'occupe de l'upload réel
      const imgData: Partial<TradeImage> = { 
        phase, 
        context, 
        url: base64Url, 
        source: 'upload', // On garde upload pour l'UI, mais url est base64
        storage_path: 'local_pending' // Marqueur pour le SyncManager
      }

      if (existingIndex >= 0) {
        newImages[existingIndex] = { ...newImages[existingIndex], ...imgData }
      } else {
        newImages.push(imgData as any)
      }
      
      onChange(newImages)
      addToast('Image ajoutée (Hors-ligne)', 'success')
    } catch (e) {
      console.error(e)
      addToast('Erreur lors du traitement local', 'error')
    } finally {
      setUploadingKey(null)
    }
  }

  const handleRemoveImage = (phase: TradeImagePhase, context: TradeImageContext) => {
    onChange(images.filter(img => !(img.phase === phase && img.context === context)))
  }

  const handleFetchTelegram = (key: string) => {
    setActiveTelegramKey(key)
    fetchLastImage('') // Le stepId n'est pas strict pour fetcher la dernière image du user
  }

  const handleConfirmTelegram = async (phase: TradeImagePhase, context: TradeImageContext) => {
    if (!preview) return
    const key = `${phase}-${context}`
    setUploadingKey(key)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        addToast('Connexion requise pour Telegram', 'error')
        setUploadingKey(null)
        return
      }

      // Attention : l'Edge Function Telegram nécessite le réseau. 
      // On vérifie le réseau.
      if (!navigator.onLine) {
        addToast('Réseau requis pour Telegram', 'error')
        setUploadingKey(null)
        return
      }

      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram`
      const res = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({ proxy_image_url: preview })
      })
      
      if (!res.ok) throw new Error('Erreur téléchargement image Telegram')
      
      const blob = await res.blob()
      
      // On convertit le blob téléchargé en Base64 localement, pour cohérence
      const { compresserEtConvertirEnBase64 } = await import('@/lib/storage')
      const base64Url = await compresserEtConvertirEnBase64(blob)
      
      const newImages = [...images]
      const existingIndex = newImages.findIndex(img => img.phase === phase && img.context === context)
      
      const imgData: Partial<TradeImage> = { 
        phase, 
        context, 
        url: base64Url, 
        source: 'telegram',
        storage_path: 'local_pending_telegram'
      }

      if (existingIndex >= 0) {
        newImages[existingIndex] = { ...newImages[existingIndex], ...imgData }
      } else {
        newImages.push(imgData as any)
      }
      
      onChange(newImages)
      addToast('Image Telegram ajoutée (Prêt à synchroniser) !', 'success')
      clearPreview()
      setActiveTelegramKey(null)
    } catch (e) {
      console.error(e)
      addToast('Erreur upload Telegram', 'error')
    } finally {
      setUploadingKey(null)
    }
  }

  return (
    <div className="space-y-6 bg-surface p-5 rounded-xl border border-border shadow-sm">
      {PHASES.map((phaseGroup) => (
        <div key={phaseGroup.id} className="space-y-3">
          <h3 className="text-xs font-bold text-txt uppercase tracking-wider">{phaseGroup.label}</h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {CONTEXTS.map((ctx) => {
              const currentImg = images.find(img => img.phase === phaseGroup.id && img.context === ctx.id)
              const key = `${phaseGroup.id}-${ctx.id}`
              const isUploading = uploadingKey === key

              return (
                <div key={ctx.id} className="flex flex-col gap-1.5">
                  <div className="text-[10px] font-semibold text-txt3 uppercase flex items-center gap-1">
                    <span>{ctx.icon}</span> {ctx.label}
                  </div>
                  
                  <div className="relative group aspect-video bg-bg rounded-lg border border-border2 border-dashed flex items-center justify-center overflow-hidden hover:border-accent transition-colors">
                    {currentImg?.url ? (
                      <>
                        <img 
                          src={currentImg.url} 
                          alt={`${phaseGroup.label} ${ctx.label}`}
                          loading="lazy"
                          className="w-full h-full object-cover bg-black/10"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(phaseGroup.id, ctx.id)}
                            className="bg-loss text-white rounded-full w-8 h-8 flex items-center justify-center text-xs hover:scale-110 transition-transform"
                          >
                            ✕
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* État Uploading global pour cette case */}
                        {isUploading && (
                          <div className="absolute inset-0 bg-bg/80 flex flex-col items-center justify-center z-20">
                            <span className="w-4 h-4 border-2 border-accent/20 border-t-accent rounded-full animate-spin mb-1"></span>
                            <span className="text-[9px] text-accent font-medium uppercase tracking-wider">Upload...</span>
                          </div>
                        )}
                        
                        {/* Mode Prévisualisation Telegram */}
                        {activeTelegramKey === key && preview ? (
                          <div className="absolute inset-0 z-10 bg-bg">
                            <img src={preview} alt="Preview Telegram" className="w-full h-full object-cover opacity-40" />
                            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/20">
                              <button 
                                onClick={() => handleConfirmTelegram(phaseGroup.id, ctx.id)}
                                className="bg-win text-white w-7 h-7 rounded-full flex items-center justify-center text-xs hover:scale-110 transition-transform shadow-md"
                                title="Valider"
                              >✓</button>
                              <button 
                                onClick={() => { clearPreview(); setActiveTelegramKey(null); }}
                                className="bg-loss text-white w-7 h-7 rounded-full flex items-center justify-center text-xs hover:scale-110 transition-transform shadow-md"
                                title="Annuler"
                              >✕</button>
                            </div>
                          </div>
                        ) : (
                          /* Mode Sélection (Fichier ou Telegram) */
                          <div className="flex w-full h-full divide-x divide-border2">
                            <label className={cn(
                              "cursor-pointer flex-1 flex flex-col items-center justify-center hover:bg-accent/5 transition-colors",
                              (telegramLoading && activeTelegramKey === key) && "opacity-50 pointer-events-none"
                            )}>
                              <span className="text-sm mb-1 opacity-60">📁</span>
                              <span className="text-[9px] text-txt3 font-medium uppercase tracking-wider">Fichier</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0]
                                  if (file) handleUploadImage(phaseGroup.id, ctx.id, file)
                                }}
                              />
                            </label>
                            
                            <button
                              type="button"
                              onClick={() => handleFetchTelegram(key)}
                              disabled={telegramLoading && activeTelegramKey === key}
                              className="flex-1 flex flex-col items-center justify-center hover:bg-[#2AABEE]/10 text-txt3 hover:text-[#2AABEE] transition-colors disabled:opacity-50"
                            >
                              {telegramLoading && activeTelegramKey === key ? (
                                <span className="w-4 h-4 border-2 border-[#2AABEE]/20 border-t-[#2AABEE] rounded-full animate-spin mb-1"></span>
                              ) : (
                                <span className="text-sm mb-1 opacity-70">📱</span>
                              )}
                              <span className="text-[9px] font-medium uppercase tracking-wider">Telegram</span>
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
