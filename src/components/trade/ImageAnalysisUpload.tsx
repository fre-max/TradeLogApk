import { useRef, useState } from 'react'
import { useTelegram } from '@/hooks/useTelegram'
import { uploadImage, buildImagePath } from '@/lib/storage'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

interface ImageAnalysisUploadProps {
  onAnalysisComplete: (result: {
    analysis: any
    imageUrl: string
    tradeId: string
  }) => void
  onManualMode: () => void
}

/**
 * Composant de téléversement et d'analyse de graphique par IA.
 * Sert d'écran principal pour la création d'un nouveau trade.
 * 
 * Exemple :
 * <ImageAnalysisUpload
 *   onAnalysisComplete={({ analysis, imageUrl, tradeId }) => chargerTrade(tradeId)}
 *   onManualMode={() => setManualMode(true)}
 * />
 */
export function ImageAnalysisUpload({ onAnalysisComplete, onManualMode }: ImageAnalysisUploadProps) {
  const { isLoading: telegramLoading, preview, fetchLastImage, clearPreview } = useTelegram()
  const [loading, setLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  // 1️⃣ Analyse de l'image via la Edge Function
  const lancerAnalyseIA = async (imageUrl: string, tradeId: string) => {
    try {
      setStatusMessage("🧠 Analyse du graphique par l'IA en cours...")
      const { data, error: analyzeError } = await supabase.functions.invoke(`analyze?url=${encodeURIComponent(imageUrl)}`, {
        method: 'GET'
      })

      if (analyzeError) throw analyzeError

      setStatusMessage("📰 Recherche automatique des news économiques...")
      
      // Retourner le résultat de l'analyse et l'imageUrl
      onAnalysisComplete({
        analysis: data,
        imageUrl,
        tradeId
      })
    } catch (e: any) {
      console.error("❌ [ImageAnalysisUpload] Erreur d'analyse IA :", e)
      setError(e.message || "Impossible d'analyser le graphique. Réessayez ou passez en mode manuel.")
      setLoading(false)
    }
  }

  // 2️⃣ Téléversement du fichier et déclenchement
  const uploaderEtAnalyser = async (file: File | Blob) => {
    setLoading(true)
    setError(null)
    setStatusMessage("📤 Téléversement du graphique sur Supabase...")

    try {
      // Générer l'ID de trade et d'étape côté client à l'avance
      const tradeId = crypto.randomUUID()
      const stepId = crypto.randomUUID()
      const filename = file instanceof File ? file.name : `chart-${Date.now()}.jpg`
      
      const path = buildImagePath(tradeId, stepId, `${Date.now()}-${filename}`)
      const publicUrl = await uploadImage(file, path)
      
      await lancerAnalyseIA(publicUrl, tradeId)
    } catch (e: any) {
      console.error("❌ [ImageAnalysisUpload] Erreur téléversement :", e)
      setError(e.message || "Échec du téléversement du fichier.")
      setLoading(false)
    }
  }

  // 3️⃣ Gestionnaires d'événements
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploaderEtAnalyser(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) {
      uploaderEtAnalyser(file)
    } else {
      setError("Le fichier déposé doit être une image.")
    }
  }

  // 4️⃣ Récupération depuis Telegram
  const handleTelegramClick = async () => {
    setError(null)
    const state = await fetchLastImage()
    if (!state) {
      setError("Aucune image récente trouvée sur le bot Telegram. Envoyez-en une d'abord.")
    }
  }

  const handleConfirmTelegram = async () => {
    if (!preview) return
    setLoading(true)
    setStatusMessage("🔌 Téléchargement de l'image depuis Telegram...")
    
    try {
      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram`
      const session = await supabase.auth.getSession()
      const res = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.data.session?.access_token}`
        },
        body: JSON.stringify({ proxy_image_url: preview })
      })

      if (!res.ok) throw new Error("Échec de la récupération de l'image de Telegram")
      
      const blob = await res.blob()
      await uploaderEtAnalyser(blob)
      clearPreview()
    } catch (e: any) {
      console.error(e)
      setError(e.message || "Échec de l'intégration de la photo Telegram.")
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center h-[400px]">
        {/* Spinner animé */}
        <div className="relative w-16 h-16 mb-6">
          <div className="absolute inset-0 rounded-full border-4 border-accent/20"></div>
          <div className="absolute inset-0 rounded-full border-4 border-accent border-t-transparent animate-spin"></div>
          <div className="absolute inset-4 bg-accent/10 rounded-full flex items-center justify-center text-sm">
            ⚡
          </div>
        </div>
        <h3 className="text-txt font-semibold text-base mb-2">Extraction intelligente en cours</h3>
        <p className="text-txt3 text-sm max-w-[280px] leading-relaxed animate-pulse">
          {statusMessage}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 p-5">
      {/* Zone de drop principale */}
      <div
        ref={dropZoneRef}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "border-2 border-dashed border-border2 hover:border-accent hover:bg-accent/5",
          "rounded-xl p-10 text-center flex flex-col items-center justify-center gap-3",
          "transition-all duration-200 cursor-pointer h-[240px]"
        )}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          className="hidden"
        />
        
        <div className="w-14 h-14 bg-surface2 border border-border2 rounded-2xl flex items-center justify-center text-3xl shadow-sm">
          📸
        </div>
        
        <div>
          <p className="text-txt font-medium text-[14.5px] mb-1">
            Déposez votre capture d'écran ici
          </p>
          <p className="text-txt3 text-[12.5px]">
            Supporte TradingView, MetaTrader, etc.
          </p>
        </div>
        
        <span className="text-accent text-[12.5px] font-medium mt-1">
          Ou cliquez pour parcourir vos fichiers
        </span>
      </div>

      {/* Option alternative : Telegram */}
      {!preview ? (
        <button
          type="button"
          onClick={handleTelegramClick}
          disabled={telegramLoading}
          className={cn(
            "w-full py-3 px-4 rounded-xl border border-border2 bg-surface2",
            "flex items-center justify-center gap-2.5 text-[13px] font-medium text-txt2",
            "hover:bg-bg hover:text-txt transition-all disabled:opacity-50"
          )}
        >
          <span>📱</span>
          {telegramLoading ? "Recherche en cours..." : "Récupérer la dernière image de Telegram"}
        </button>
      ) : (
        <div className="border border-border2 rounded-xl overflow-hidden bg-surface2">
          <div className="relative h-40 bg-black/20 flex items-center justify-center overflow-hidden">
            <img src={preview} alt="Dernière Telegram" className="w-full h-full object-cover" loading="lazy" />
            <div className="absolute top-2 right-2 bg-accent text-white px-2 py-0.5 rounded text-[11px] font-semibold">
              Telegram
            </div>
          </div>
          <div className="flex gap-2.5 p-3">
            <button
              type="button"
              onClick={handleConfirmTelegram}
              className="flex-1 py-2 bg-accent text-white rounded-lg text-[12.5px] font-semibold hover:bg-accent/95 transition-colors"
            >
              ✓ Analyser cette image
            </button>
            <button
              type="button"
              onClick={clearPreview}
              className="flex-1 py-2 border border-border2 text-txt2 hover:text-txt rounded-lg text-[12.5px] font-medium transition-colors"
            >
              Autre image
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-loss/8 border border-loss/20 text-loss rounded-xl p-3 text-[12px] leading-relaxed">
          ⚠️ {error}
        </div>
      )}

      {/* Option secondaire : Mode manuel */}
      <div className="relative flex py-2 items-center">
        <div className="flex-grow border-t border-border"></div>
        <span className="flex-shrink mx-4 text-txt3 text-[11.5px] uppercase tracking-wider">ou</span>
        <div className="flex-grow border-t border-border"></div>
      </div>

      <button
        type="button"
        onClick={onManualMode}
        className={cn(
          "w-full py-2.5 rounded-lg border border-border2 text-[12.5px] font-medium text-txt2",
          "hover:bg-surface2 hover:text-txt transition-colors text-center"
        )}
      >
        Saisir le trade manuellement (sans image)
      </button>
    </div>
  )
}
