import { useRef, useState } from 'react'
import { useTelegram } from '@/hooks/useTelegram'
import { compresserEtConvertirEnBase64 } from '@/lib/storage'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

interface ImageFieldProps {
  tradeId: string
  stepId: string
  onUpload: (url: string) => void
}

export function ImageField({ tradeId, stepId, onUpload }: ImageFieldProps) {
  const { isLoading, preview, error, fetchLastImage, clearPreview } = useTelegram()
  const [urlInput, setUrlInput] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Confirme une image depuis Telegram → conversion en Base64 locale
  const handleConfirmTelegram = async () => {
    if (!preview) return
    setUploading(true)
    try {
      if (!navigator.onLine) {
        // En hors-ligne : on ne peut pas appeler l'Edge Function Telegram
        // On utilise directement l'URL de preview (URL publique Telegram temporaire)
        onUpload(preview)
        clearPreview()
        return
      }

      // En ligne : récupère l'image via la fonction Supabase et la convertit en Base64
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
      // Conversion en Base64 compressé → visible immédiatement, upload réel fait par SyncManager
      const base64Url = await compresserEtConvertirEnBase64(blob)
      onUpload(base64Url)
      clearPreview()
    } catch (e) {
      console.error('Erreur handleConfirmTelegram:', e)
      // En cas d'erreur, on passe quand même la preview si disponible
      if (preview) {
        onUpload(preview)
        clearPreview()
      }
    }
    setUploading(false)
  }

  // Upload d'un fichier local → conversion en Base64 immédiate (Offline-First)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      // Compression et conversion en Base64 pour stockage local immédiat
      // L'upload vers Supabase Storage sera fait par le SyncManager quand le réseau est dispo
      const base64Url = await compresserEtConvertirEnBase64(file)
      onUpload(base64Url)
    } catch (e) {
      console.error('Erreur compression image:', e)
    }
    setUploading(false)
  }

  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      onUpload(urlInput.trim())
      setUrlInput('')
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {/* TradingView URL */}
      <div className="flex gap-2">
        <input
          type="url"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="https://www.tradingview.com/x/..."
          className="flex-1 bg-bg border border-border2 rounded-md text-txt px-3 py-2 text-[13px] outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={handleUrlSubmit}
          className="px-3 py-2 bg-surface2 border border-border2 rounded-md text-txt2 text-sm hover:text-txt transition-colors"
        >
          OK
        </button>
      </div>

      {/* Telegram */}
      {!preview ? (
        <button
          type="button"
          onClick={() => fetchLastImage(stepId)}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-2 bg-accent/7 border border-accent/20 rounded-md text-[12.5px] text-txt3 hover:border-accent/40 hover:text-accent transition-colors disabled:opacity-50"
        >
          <span>📱</span>
          {isLoading ? 'Récupération...' : 'Récupérer depuis Telegram'}
        </button>
      ) : (
        <div className="border border-border2 rounded-md overflow-hidden">
          <img src={preview} alt="Preview Telegram" className="w-full object-cover max-h-48" />
          <div className="flex gap-2 p-2 bg-surface2">
            <button
              type="button"
              onClick={handleConfirmTelegram}
              disabled={uploading}
              className="flex-1 bg-win/10 text-win border border-win/30 rounded-md py-1.5 text-[12.5px] font-medium hover:bg-win/20 disabled:opacity-50"
            >
              {uploading ? 'Upload...' : '✓ Confirmer'}
            </button>
            <button
              type="button"
              onClick={clearPreview}
              className="flex-1 border border-border2 text-txt2 rounded-md py-1.5 text-[12.5px] hover:text-txt"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-loss text-xs">{error}</p>}

      {/* File upload */}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className={cn(
          'border-2 border-dashed border-border2 rounded-md py-4 text-center text-txt3 text-[12.5px]',
          'hover:border-accent hover:text-accent hover:bg-accent/5 transition-colors cursor-pointer'
        )}
      >
        🖼 Glisser ou cliquer pour uploader
      </button>
    </div>
  )
}
