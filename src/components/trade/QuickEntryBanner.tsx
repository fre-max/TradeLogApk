import { cn } from '@/lib/utils'
import type { GeminiAnalysis } from '@/hooks/useQuickEntry'

interface QuickEntryBannerProps {
  analysis: GeminiAnalysis
  onCompleter: () => void
}

// ─── Seuils de confiance pour les couleurs ────────────────────────────────────
// > 80%  → vert (confiance élevée)
// 50-80% → orange (confiance moyenne)
// < 50%  → rouge (confiance faible)

function getCouleurConfiance(score: number | undefined): string {
  if (score === undefined || score === null) return 'text-txt3'
  if (score >= 0.8) return 'text-win'
  if (score >= 0.5) return 'text-[#f5a623]'
  return 'text-loss'
}

function getBadgeConfiance(score: number | undefined): string {
  if (score === undefined || score === null) return 'bg-surface2 text-txt3 border-border'
  if (score >= 0.8) return 'bg-win/10 text-win border-win/25'
  if (score >= 0.5) return 'bg-[#f5a623]/10 text-[#f5a623] border-[#f5a623]/25'
  return 'bg-loss/10 text-loss border-loss/25'
}

function getPourcentage(score: number | undefined): string {
  if (score === undefined || score === null) return '—'
  return `${Math.round(score * 100)}%`
}

/**
 * Bannière affichée dans le détail d'un trade de statut 'quick'.
 * Résume les données extraites par Gemini Vision avec les scores de confiance.
 * 
 * Exemple :
 * <QuickEntryBanner analysis={trade.analysisData} onCompleter={() => openDrawer()} />
 */
export function QuickEntryBanner({ analysis, onCompleter }: QuickEntryBannerProps) {
  const confidence = analysis.confidence

  // Champs extraits à afficher dans la bannière
  const champsExtraits = [
    { label: 'Paire', value: analysis.pair, score: confidence?.pair },
    { label: 'Direction', value: analysis.direction, score: confidence?.direction },
    { label: 'Timeframe', value: analysis.timeframe, score: undefined },
    { label: 'Session', value: analysis.session, score: undefined },
    { label: 'Entrée', value: analysis.entry_price?.toString(), score: confidence?.entry_price },
    { label: 'SL', value: analysis.sl?.toString(), score: confidence?.sl },
    { label: 'TP', value: analysis.tp?.toString(), score: confidence?.tp },
    { label: 'R:R estimé', value: analysis.rr ? `${analysis.rr}R` : null, score: undefined },
  ]

  return (
    <div className="bg-[#f5a623]/5 border border-[#f5a623]/30 rounded-lg overflow-hidden">

      {/* ─── En-tête de la bannière ─────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#f5a623]/20">
        <div className="flex items-center gap-2">
          {/* Icône IA */}
          <div className="w-6 h-6 bg-[#f5a623]/15 rounded flex items-center justify-center text-sm">
            ⚡
          </div>
          <span className="text-[#f5a623] text-[12.5px] font-semibold uppercase tracking-wider">
            Quick Entry — Extrait par IA
          </span>
        </div>

        {/* Bouton pour compléter l'analyse */}
        <button
          onClick={onCompleter}
          className={cn(
            'text-[11.5px] font-medium px-3 py-1.5 rounded-md transition-colors',
            'bg-accent text-white hover:bg-accent/85 active:scale-95'
          )}
        >
          Compléter l'analyse →
        </button>
      </div>

      {/* ─── Grille des champs extraits ─────────────────────── */}
      <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        {champsExtraits.map(({ label, value, score }) => (
          <div key={label} className="flex flex-col gap-1">
            {/* Label + badge de confiance */}
            <div className="flex items-center gap-1.5">
              <span className="text-txt3 text-[10px] uppercase tracking-wider">{label}</span>
              {score !== undefined && (
                <span
                  className={cn(
                    'text-[9px] font-semibold px-1 py-0 rounded border',
                    getBadgeConfiance(score)
                  )}
                >
                  {getPourcentage(score)}
                </span>
              )}
            </div>

            {/* Valeur extraite — colorée selon la confiance */}
            <span
              className={cn(
                'text-[14px] font-semibold',
                score !== undefined ? getCouleurConfiance(score) : 'text-txt'
              )}
            >
              {value ?? '—'}
            </span>
          </div>
        ))}
      </div>

      {/* ─── Patterns SMC identifiés ────────────────────────── */}
      {analysis.patterns && analysis.patterns.length > 0 && (
        <div className="px-4 pb-4 flex flex-wrap gap-1.5">
          <span className="text-txt3 text-[10.5px] uppercase tracking-wider w-full mb-1">
            Patterns identifiés
          </span>
          {analysis.patterns.map((pattern) => (
            <span
              key={pattern}
              className="px-2 py-0.5 bg-accent/10 text-accent border border-accent/20 rounded text-[11px] font-medium"
            >
              {pattern}
            </span>
          ))}
        </div>
      )}

      {/* ─── Note de bas de page ────────────────────────────── */}
      <div className="px-4 py-2.5 border-t border-[#f5a623]/15 bg-[#f5a623]/3">
        <p className="text-txt3 text-[11px]">
          ⚠️ Ces données sont extraites automatiquement par IA — vérifiez-les avant de finaliser le trade.
        </p>
      </div>
    </div>
  )
}
