import { useUIStore } from '@/store'
import { cn, formatDate, formatRR } from '@/lib/utils'
import { useState } from 'react'
import { SkeletonSection, SkeletonLine } from '@/components/ui/Skeleton'
import { QuickEntryBanner } from '@/components/trade/QuickEntryBanner'
import type { GeminiAnalysis } from '@/hooks/useQuickEntry'
import { exportPdf } from '@/lib/exportPdf'
import { useNavigate } from 'react-router-dom'
import { useBacktestStore } from '@/store/backtestStore'


// ─── TradeDetail ──────────────────────────────────────────
// Panneau latéral qui affiche le détail complet d'un trade
// Plein écran sur mobile, 900px sur desktop
// Affiche un skeleton si le trade est en cours de chargement

export function TradeDetail() {
  const isDetailOpen = useUIStore((state) => state.isDetailOpen)
  const closeDetail = useUIStore((state) => state.closeDetail)
  const openEditTrade = useUIStore((state) => state.openEditTrade)
  const selectedTrade = useUIStore((state) => state.selectedTrade)
  const [lightbox, setLightbox] = useState<string | null>(null)
  // État de génération du PDF (affiche un spinner pendant le téléchargement des images)
  const [generationPdf, setGenerationPdf] = useState(false)
  const navigate = useNavigate()
  const lancerRestaurationContexte = useBacktestStore((s) => s.lancerRestaurationContexte)


  console.log('🔍 [TradeDetail] Rendu, isDetailOpen =', isDetailOpen, 'selectedTradeId =', selectedTrade?.id)

  const handleClose = () => {
    console.log('🔍 [TradeDetail] Clic bouton fermer / backdrop')
    closeDetail()
  }

  // On n'affiche rien si aucun trade n'est sélectionné
  if (!selectedTrade) {
    console.log('🔍 [TradeDetail] Aucun trade sélectionné, ne rend rien')
    return null
  }

  // Récupérer les étapes par type
  const biais = selectedTrade.steps.find((s) => s.type === 'biais')
  const poi = selectedTrade.steps.find((s) => s.type === 'poi')
  const entry = selectedTrade.steps.find((s) => s.type === 'entry')
  const review = selectedTrade.steps.find((s) => s.type === 'result')
  const news = selectedTrade.steps.find((s) => s.type === 'news')

  // Extraire les données Gemini si le trade est un Quick Entry
  // Les données sont stockées dans fields.extracted de l'étape 'biais'
  const isQuickEntry = selectedTrade.status === 'quick'
  const geminiAnalysis = isQuickEntry && biais?.fields
    ? (biais.fields as any).extracted as GeminiAnalysis | null
    : null

  return (
    <>
      {/* Backdrop — ferme le panneau au clic en dehors */}
      {isDetailOpen && (
        <div className="fixed inset-0 bg-black/70 z-[95]" onClick={handleClose} />
      )}

      <aside
        className={cn(
          // Le panneau prend toute la hauteur et toute la largeur sur mobile
          // Sur desktop il est limité à 860px
          'fixed top-0 right-0 h-full w-full md:w-[860px] bg-surface border-l border-border',
          'flex flex-col z-[100] transition-transform duration-300 overflow-hidden',
          isDetailOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* ─── HEADER ─────────────────────────────────────── */}
        <div className="flex-shrink-0 border-b border-border">

          {/* Ligne 1 : navigation + actions */}
          <div className="flex items-center gap-2 px-4 py-3">
            {/* Bouton retour — uniquement sur mobile */}
            <button
              onClick={closeDetail}
              className="md:hidden flex items-center gap-1 text-txt2 hover:text-txt text-sm font-medium mr-1"
            >
              ← Retour
            </button>

            {/* Nom de la paire */}
            <span className="text-txt text-lg font-bold tracking-tight">{selectedTrade.pair}</span>

            {/* R:R réalisé */}
            {selectedTrade.rr_realized != null && (
              <span className={cn(
                'text-base font-bold ml-1',
                selectedTrade.rr_realized > 0 ? 'text-win' : 'text-loss'
              )}>
                {formatRR(selectedTrade.rr_realized)}
              </span>
            )}

            {/* Boutons à droite */}
            <div className="flex items-center gap-1.5 ml-auto">
              <button
                onClick={async () => {
                  setGenerationPdf(true)
                  try {
                    await exportPdf(selectedTrade)
                  } finally {
                    setGenerationPdf(false)
                  }
                }}
                disabled={generationPdf}
                title="Télécharger le rapport PDF"
                className="px-2.5 py-1.5 bg-surface2 border border-border2 text-txt2 rounded-md text-[12px] font-medium hover:bg-surface hover:text-txt transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                {generationPdf
                  ? <span className="w-3 h-3 border-2 border-txt3/40 border-t-txt2 rounded-full animate-spin" />
                  : '📄'
                }
                <span className="hidden sm:inline">PDF</span>
              </button>
              {selectedTrade.backtest_context && (
                <button
                  onClick={() => {
                    console.log('🔄 [TradeDetail] Lancement de la restauration de backtest :', selectedTrade.backtest_context)
                    lancerRestaurationContexte(selectedTrade.backtest_context)
                    closeDetail()
                    navigate('/backtest')
                  }}
                  title="Revenir au moment exact où ce backtest a été pris"
                  className="px-2.5 py-1.5 bg-accent/25 border border-accent/40 text-accent rounded-md text-[12px] font-semibold hover:bg-accent/40 hover:text-white transition-all flex items-center gap-1"
                >
                  🔄 <span className="hidden sm:inline">Rejouer</span>
                </button>
              )}
              <button
                onClick={() => openEditTrade(selectedTrade)}
                className="px-2.5 py-1.5 bg-accent text-white rounded-md text-[12px] font-medium hover:bg-accent/90 transition-colors"
              >
                Modifier
              </button>

              {/* Bouton fermer — uniquement sur desktop */}
              <button
                onClick={closeDetail}
                className="hidden md:flex items-center justify-center w-7 h-7 text-txt3 hover:text-txt hover:bg-surface2 rounded-md transition-colors text-lg leading-none ml-1"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Ligne 2 : tags statut */}
          <div className="flex items-center gap-1.5 flex-wrap px-4 pb-3">
            <Tag variant={selectedTrade.direction === 'long' ? 'long' : 'short'}>
              {selectedTrade.direction === 'long' ? '↑ Long' : '↓ Short'}
            </Tag>
            {selectedTrade.result && (
              <Tag variant={selectedTrade.result}>
                {selectedTrade.result === 'win' 
                  ? '✓ Win' 
                  : selectedTrade.result === 'loss' 
                    ? '✗ Loss' 
                    : selectedTrade.result === 'breakeven' 
                      ? '— BE' 
                      : '🟡 Missed'}
              </Tag>
            )}
            {selectedTrade.session && <Tag>{selectedTrade.session}</Tag>}
            {selectedTrade.date_backtested && <Tag>{formatDate(selectedTrade.date_backtested)}</Tag>}
          </div>
        </div>

        {/* ─── BODY SCROLLABLE ────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-3 p-4">

            {/* Bannière Quick Entry */}
            {isQuickEntry && geminiAnalysis && (
              <QuickEntryBanner
                analysis={geminiAnalysis}
                onCompleter={() => openEditTrade(selectedTrade)}
              />
            )}

            {/* Infos générales */}
            <Section title="📌 Infos générales">
              {/* Grille 2 colonnes sur mobile, 4 sur desktop */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Info label="Paire" value={selectedTrade.pair} />
                <Info label="Direction" value={selectedTrade.direction === 'long' ? '↑ Long' : '↓ Short'} />
                <Info label="Session" value={selectedTrade.session} />
                <Info label="Date" value={formatDate(selectedTrade.date_backtested)} />
                <Info label="Début" value={selectedTrade.entry_time ?? '—'} />
                <Info label="Fin" value={selectedTrade.exit_time ?? '—'} />
                <Info label="R:R prévu" value={formatRR(selectedTrade.rr_planned)} />
                <Info label="R:R réalisé" value={formatRR(selectedTrade.rr_realized)} highlight />
              </div>
            </Section>

            {/* Annonces Économiques */}
            {news ? (
              <Section title="📢 Annonces Économiques">
                <div className="flex flex-col gap-2.5">
                  {news.fields && (news.fields as any).news && (news.fields as any).news.length > 0 ? (
                    (news.fields as any).news.map((item: any, idx: number) => {
                      const estHigh = item.impact === 'High'
                      return (
                        <div
                          key={idx}
                          className="bg-bg border border-border2 rounded-lg p-3 flex flex-col gap-2"
                        >
                          {/* Badge + devise + nom sur la même ligne */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn(
                              "px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase border flex-shrink-0",
                              estHigh
                                ? "bg-loss/10 text-loss border-loss/25"
                                : "bg-[#f5a623]/10 text-[#f5a623] border-[#f5a623]/25"
                            )}>
                              {estHigh ? '🔴 Fort' : '🟠 Moyen'}
                            </span>
                            <span className="text-txt font-semibold text-[13px]">{item.currency}</span>
                            <span className="text-txt font-medium text-[13px] flex-1 min-w-0 truncate">{item.name}</span>
                            <span className="text-txt3 text-[11px] flex-shrink-0">{item.time || '—'}</span>
                          </div>

                          {/* Valeurs réel / prévu / précédent */}
                          <div className="flex items-center gap-3 text-[11.5px] bg-surface border border-border2 rounded px-2.5 py-1.5 flex-wrap">
                            <div><span className="text-txt3">Réel: </span><span className="font-semibold text-txt">{item.actual || '—'}</span></div>
                            <div className="border-l border-border2 h-3.5 hidden sm:block" />
                            <div><span className="text-txt3">Prévu: </span><span className="text-txt2">{item.forecast || '—'}</span></div>
                            <div className="border-l border-border2 h-3.5 hidden sm:block" />
                            <div><span className="text-txt3">Préc: </span><span className="text-txt2">{item.previous || '—'}</span></div>
                          </div>

                          {/* Interprétation IA */}
                          {item.interpretation && (
                            <div className="text-[12px] text-txt2 border-l-2 border-accent/30 pl-2.5 italic">
                              {item.interpretation}
                            </div>
                          )}
                        </div>
                      )
                    })
                  ) : (
                    <p className="text-txt2 text-[13px] leading-relaxed">
                      {news.notes ?? "Aucune annonce économique majeure n'a été détectée dans l'intervalle de cette position."}
                    </p>
                  )}
                </div>
              </Section>
            ) : (
              selectedTrade.date_backtested && selectedTrade.entry_time && selectedTrade.exit_time && (
                <Section title="📢 Annonces Économiques">
                  <div className="flex items-center gap-2.5 text-txt2 text-[13px] italic">
                    <div className="w-4 h-4 border-2 border-accent/20 border-t-accent rounded-full animate-spin flex-shrink-0" />
                    <span>Recherche en arrière-plan...</span>
                  </div>
                </Section>
              )
            )}

            {/* Biais */}
            {biais && (
              <Section title="🧭 Biais" badge={biais.timeframe ?? undefined}>
                <p className="text-txt2 text-[13.5px] leading-relaxed mb-3">{biais.notes ?? '—'}</p>
                <Thumbnails images={biais.images || []} onOpen={setLightbox} />
              </Section>
            )}

            {/* POI */}
            {poi && (
              <Section title="🎯 POI / Zone" badge={poi.timeframe ?? undefined}>
                <p className="text-txt2 text-[13.5px] leading-relaxed mb-3">{poi.notes ?? '—'}</p>
                <Thumbnails images={poi.images || []} onOpen={setLightbox} />
              </Section>
            )}

            {/* Entrée */}
            {entry && (
              <Section title="⚡ Entrée" badge={entry.timeframe ?? undefined}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <Info label="Setup" value={String((entry.fields as any)?.setup || '—')} />
                  <Info label="Prix entrée" value={(entry.fields as any)?.price != null ? String((entry.fields as any).price) : '—'} />
                  <Info label="Stop Loss" value={(entry.fields as any)?.sl != null ? String((entry.fields as any).sl) : '—'} />
                  <Info label="Take Profit" value={(entry.fields as any)?.tp != null ? String((entry.fields as any).tp) : '—'} />
                </div>
                <p className="text-txt2 text-[13.5px] leading-relaxed mb-3">{entry.notes ?? '—'}</p>
                <Thumbnails images={entry.images || []} onOpen={setLightbox} />
              </Section>
            )}

            {/* Review */}
            {review && (
              <Section title="📝 Review" badge={selectedTrade.emotion ?? undefined}>
                <div className="flex flex-col gap-3">
                  {selectedTrade.result === 'missed' && (
                    <div className="bg-[#f5a623]/10 border border-[#f5a623]/25 rounded-md p-3 mb-1">
                      <div className="text-[10px] font-bold text-[#f5a623] uppercase tracking-wider mb-2">
                        🟡 Détails de l'ordre non déclenché
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-[13px]">
                        <div>
                          <span className="text-txt3 block text-[10px] uppercase tracking-wider mb-0.5">Écart</span>
                          <span className="font-semibold text-txt">
                            {(review.fields as any)?.missed_gap != null ? `${(review.fields as any).missed_gap} pips` : '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-txt3 block text-[10px] uppercase tracking-wider mb-0.5">Raison</span>
                          <span className="font-medium text-txt">
                            {(review.fields as any)?.missed_reason || '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  <ReviewCard icon="✅" label="Ce qui a bien marché" text={(review.fields as Record<string, string>)?.good ?? '—'} />
                  <ReviewCard icon="⚠️" label="À améliorer" text={(review.fields as Record<string, string>)?.bad ?? (review.fields as Record<string, string>)?.improve ?? '—'} />
                  
                  {/* Images de fin de trade / résultat */}
                  {review.images && review.images.length > 0 && (
                    <div className="mt-3">
                      <p className="text-txt3 text-[10px] font-semibold uppercase tracking-wider mb-2">🖼 Graphique de fin / Résultat</p>
                      <Thumbnails images={review.images || []} onOpen={setLightbox} />
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* Espace en bas pour éviter que le contenu soit coupé sur iOS */}
            <div className="h-4" />

          </div>
        </div>
      </aside>

      {/* Lightbox — affiche l'image en grand sur clic */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/92 z-[200] flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button className="absolute top-4 right-4 text-white text-2xl opacity-70 hover:opacity-100 bg-black/30 rounded-full w-9 h-9 flex items-center justify-center">✕</button>
          <img src={lightbox} alt="Chart" className="max-w-full max-h-[90vh] rounded-lg object-contain" />
        </div>
      )}
    </>
  )
}

// ─── Skeleton pour le TradeDetail ─────────────────────────
// Utilisable quand on charge un trade individuel

export function TradeDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-6">
      {/* Header skeleton */}
      <div className="flex items-center gap-3">
        <SkeletonLine width="w-20" />
        <SkeletonLine width="w-14" />
        <SkeletonLine width="w-14" />
      </div>
      {/* Sections skeleton */}
      <SkeletonSection />
      <SkeletonSection />
      <SkeletonSection />
    </div>
  )
}

// ─── Composants helpers ───────────────────────────────────

function Section({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface2 border border-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
        <span className="text-txt3 text-[11.5px] font-semibold uppercase tracking-wider">{title}</span>
        {badge && <span className="ml-auto text-accent text-[12px]">{badge}</span>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function Info({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-txt3 text-[10.5px] uppercase tracking-wider">{label}</span>
      <span className={cn('text-[14px] font-medium', highlight ? 'text-win' : 'text-txt')}>{value}</span>
    </div>
  )
}

type TagVariant = 'long' | 'short' | 'win' | 'loss' | 'breakeven' | 'missed' | 'default'

function Tag({ variant = 'default', children }: { variant?: TagVariant; children: React.ReactNode }) {
  const styles: Record<TagVariant, string> = {
    long: 'bg-accent/10 text-accent',
    short: 'bg-[#f08a4f]/10 text-[#f08a4f]',
    win: 'bg-win/10 text-win',
    loss: 'bg-loss/10 text-loss',
    breakeven: 'bg-be/10 text-be',
    missed: 'bg-[#f5a623]/10 text-[#f5a623]',
    default: 'bg-surface2 text-txt2',
  }
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[11.5px] font-medium', styles[variant])}>
      {children}
    </span>
  )
}

interface StepImageLike { url?: string | null; storage_path?: string | null }

function Thumbnails({ images, onOpen }: { images: StepImageLike[]; onOpen: (url: string) => void }) {
  if (!images.length) return null
  return (
    <div className="flex gap-2 flex-wrap">
      {images.map((img, i) => {
        const src = img.url ?? img.storage_path
        return (
          <button
            key={i}
            onClick={() => src && onOpen(src)}
            className="w-28 h-20 bg-bg border border-border2 rounded-md overflow-hidden flex items-center justify-center hover:border-accent transition-colors flex-shrink-0"
          >
            {src ? (
              <img src={src} alt={`chart-${i}`} className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <div className="text-center text-txt3 text-xs"><div className="text-2xl">🖼</div>Chart</div>
            )}
          </button>
        )
      })}
    </div>
  )
}

function ReviewCard({ icon, label, text }: { icon: string; label: string; text: string }) {
  return (
    <div className="bg-bg border border-border rounded-md p-3">
      <div className="text-txt3 text-[10.5px] uppercase tracking-wider mb-2">{icon} {label}</div>
      <p className="text-txt2 text-[13px] leading-relaxed">{text}</p>
    </div>
  )
}
