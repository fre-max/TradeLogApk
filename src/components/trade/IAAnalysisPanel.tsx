import { useState } from 'react'
import { cn } from '@/lib/utils'

interface IAAnalysisPanelProps {
  images: { id: string; url: string; phase: 'avant' | 'apres' }[]
  analysantIA: boolean
  onAnalyze: (imageUrl: string) => Promise<void>
}

/**
 * Panel d'assistant IA pour le remplissage rapide.
 * Permet de sélectionner une des captures uploadées pour lancer l'analyse Gemini Vision.
 *
 * Exemple d'utilisation :
 * <IAAnalysisPanel
 *   images={images}
 *   analysantIA={analysantIA}
 *   onAnalyze={analyserImageSelectionnee}
 * />
 */
export function IAAnalysisPanel({
  images,
  analysantIA,
  onAnalyze,
}: IAAnalysisPanelProps) {
  const [selectedImageIdx, setSelectedImageIdx] = useState<number | null>(null)

  if (images.length === 0) return null

  const selectedImage = selectedImageIdx !== null ? images[selectedImageIdx] : null

  const handleLaunch = async () => {
    if (selectedImage) {
      console.log('🚀 [IAAnalysisPanel] Lancement analyse IA sur image:', selectedImage.url)
      await onAnalyze(selectedImage.url)
    }
  }

  return (
    <div className="border border-accent/20 rounded-xl bg-accent/5 p-4.5 space-y-3.5 mb-4 transition-all">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[15px] animate-pulse">🔮</span>
          <span className="text-[12.5px] font-bold text-accent">Assistant IA (Remplissage rapide)</span>
        </div>
        {analysantIA && (
          <span className="flex items-center gap-1.5 text-[10px] text-accent font-medium animate-pulse">
            <span className="w-2.5 h-2.5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            Analyse en cours...
          </span>
        )}
      </div>

      <p className="text-[11.5px] text-txt3 leading-relaxed">
        Sélectionne l'une de tes captures pour que l'IA remplisse automatiquement les données globales (Paire, Direction, R:R, Résultat).
      </p>

      {/* Miniatures d'images */}
      <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-thin">
        {images.map((img, idx) => {
          const isSelected = selectedImageIdx === idx
          return (
            <button
              key={img.id || idx}
              type="button"
              disabled={analysantIA}
              onClick={() => {
                console.log('📸 [IAAnalysisPanel] Image sélectionnée:', idx)
                setSelectedImageIdx(isSelected ? null : idx)
              }}
              className={cn(
                "relative w-24 aspect-video rounded-lg border-2 overflow-hidden transition-all flex-shrink-0 bg-surface2 disabled:opacity-50",
                isSelected ? "border-accent scale-102 shadow-md" : "border-border2 hover:border-accent/40"
              )}
            >
              <img src={img.url} className="w-full h-full object-cover" alt="Capture d'écran" loading="lazy" />
              <div className={cn(
                "absolute inset-0 transition-colors flex items-center justify-center",
                isSelected ? "bg-black/10" : "bg-black/40 hover:bg-black/10"
              )}>
                <span className={cn(
                  "text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider text-white",
                  img.phase === 'avant' ? 'bg-emerald-500/80' : 'bg-loss/80'
                )}>
                  {img.phase}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Bouton de déclenchement */}
      {selectedImage && (
        <button
          type="button"
          disabled={analysantIA}
          onClick={handleLaunch}
          className="w-full py-2 bg-accent hover:bg-accent/90 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
        >
          {analysantIA ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Extraction des données par Gemini...
            </>
          ) : (
            <>🚀 Lancer l'analyse IA sur la capture sélectionnée</>
          )}
        </button>
      )}
    </div>
  )
}
