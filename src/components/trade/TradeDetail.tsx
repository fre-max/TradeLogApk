import { useUIStore } from '@/store'
import { cn, formatDate, formatRR } from '@/lib/utils'
import { useState, useMemo } from 'react'
import { SkeletonSection, SkeletonLine } from '@/components/ui/Skeleton'
import { QuickEntryBanner } from '@/components/trade/QuickEntryBanner'
import type { GeminiAnalysis } from '@/hooks/useQuickEntry'
import { exportPdf } from '@/lib/exportPdf'
import { useNavigate } from 'react-router-dom'
import { useBacktestStore } from '@/store/backtestStore'
import { useTradeReasons } from '@/hooks/useTradeReasons'
import { useTradeImages } from '@/hooks/useTradeImages'
import { useCatalog } from '@/hooks/useCatalog'
import { useLocalDatabase } from '@/store/useLocalDatabase'
import { extraireContexteReplay } from '@/lib/replayHelper'

/**
 * Panneau latéral qui affiche le détail complet d'un trade.
 * Affiche l'intégralité des données enregistrées :
 *  - Informations générales (Paire, Direction, R:R, Stratégie, Émotion, Durée)
 *  - Raisons et Concepts de trading avec leurs variantes (Order Block, CHoCH, BOS...)
 *  - Captures d'écran (Avant & Après) par section et dans une Galerie globale
 *  - Biais HTF, Zone POI, Setup d'entrée et Bilan / Review
 *  - Annonces Économiques détectées
 */
export function TradeDetail() {
  const isDetailOpen = useUIStore((state) => state.isDetailOpen)
  const closeDetail = useUIStore((state) => state.closeDetail)
  const openEditTrade = useUIStore((state) => state.openEditTrade)
  const selectedTrade = useUIStore((state) => state.selectedTrade)
  
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [generationPdf, setGenerationPdf] = useState(false)
  const navigate = useNavigate()
  const lancerRestaurationContexte = useBacktestStore((s) => s.lancerRestaurationContexte)

  // Reconstitution intelligente du contexte de replay (compatible avec toutes les positions en DB)
  const contexteReplay = useMemo(() => extraireContexteReplay(selectedTrade), [selectedTrade])

  // 1️⃣ Hooks pour les données associées (Raisons, Images, Stratégies, Familles)
  const { data: tradeReasons } = useTradeReasons(selectedTrade?.id)
  const { data: fetchedImages } = useTradeImages(selectedTrade?.id)
  const { data: catalogItems } = useCatalog()
  const reasonFamilies = useLocalDatabase((s) => s.reasonFamilies)
  const strategies = useLocalDatabase((s) => s.strategies)

  const handleClose = () => {
    closeDetail()
  }

  // 4️⃣ Rassembler toutes les raisons en résolvant leurs titres et leurs variantes depuis le catalogue
  // IMPORTANT : useMemo doit être appelé AVANT tout return conditionnel (règle des Hooks React)
  const raisonsDetaillees = useMemo(() => {
    if (!selectedTrade) return []
    const rawReasons = (tradeReasons && tradeReasons.length > 0)
      ? tradeReasons
      : (selectedTrade.reasons || [])

    if (!rawReasons || rawReasons.length === 0) return []

    return rawReasons.map((r) => {
      const item = catalogItems?.find((cat) => cat.id === r.reason_id)
      const family = item?.family || (item?.family_id ? reasonFamilies.find(f => f.id === item.family_id) : null)

      return {
        id: r.reason_id,
        title: item?.title || 'Concept technique',
        variant: r.variant_name || 'Standard',
        familyIcon: family?.icon || '🧠',
        familyName: family?.name || 'Général',
      }
    })
  }, [tradeReasons, selectedTrade, catalogItems, reasonFamilies])

  // 5️⃣ Rassembler TOUTES les images du trade (depuis les steps, le trade et IndexedDB)
  // IMPORTANT : useMemo doit être appelé AVANT tout return conditionnel (règle des Hooks React)
  const toutesLesImagesDuTrade = useMemo(() => {
    if (!selectedTrade) return []
    const imagesMap = new Map<string, { url: string; phase?: 'avant' | 'apres'; context?: string }>()

    // Images issues des steps
    if (selectedTrade.steps) {
      for (const step of selectedTrade.steps) {
        if (step.images) {
          for (const img of step.images) {
            const url = img.url ?? img.storage_path
            if (url) {
              imagesMap.set(url, {
                url,
                phase: img.phase as any || (step.type === 'result' ? 'apres' : 'avant'),
                context: step.type,
              })
            }
          }
        }
      }
    }

    // Images issues du tableau trade.images
    if (selectedTrade.images) {
      for (const img of selectedTrade.images) {
        if (img.url) {
          imagesMap.set(img.url, { url: img.url, phase: img.phase, context: img.context })
        }
      }
    }

    // Images issues du hook useTradeImages (Supabase / local IDB)
    if (fetchedImages) {
      for (const img of fetchedImages) {
        if (img.url) {
          imagesMap.set(img.url, { url: img.url, phase: img.phase, context: img.context })
        }
      }
    }

    return Array.from(imagesMap.values())
  }, [selectedTrade, fetchedImages])

  // On n'affiche rien si aucun trade n'est sélectionné
  // Ce return doit être APRÈS tous les hooks (règle fondamentale de React)
  if (!selectedTrade) return null

  // 2️⃣ Extraction des étapes du trade (Biais, POI, Entrée, Résultat, News)
  const biais = selectedTrade.steps.find((s) => s.type === 'biais')
  const poi = selectedTrade.steps.find((s) => s.type === 'poi')
  const entry = selectedTrade.steps.find((s) => s.type === 'entry')
  const review = selectedTrade.steps.find((s) => s.type === 'result')
  const news = selectedTrade.steps.find((s) => s.type === 'news')

  // Extraire les données Gemini si le trade est un Quick Entry
  const isQuickEntry = selectedTrade.status === 'quick'
  const geminiAnalysis = isQuickEntry && biais?.fields
    ? (biais.fields as any).extracted as GeminiAnalysis | null
    : null

  // 3️⃣ Stratégie associée au trade
  const strategieAssociee = selectedTrade.strategy_id
    ? strategies.find((s) => s.id === selectedTrade.strategy_id)
    : null

  // Images filtrées par phase
  const imagesAvant = toutesLesImagesDuTrade.filter((img) => img.phase !== 'apres')
  const imagesApres = toutesLesImagesDuTrade.filter((img) => img.phase === 'apres')

  return (
    <>
      {/* Backdrop — ferme le panneau au clic en dehors */}
      {isDetailOpen && (
        <div className="fixed inset-0 bg-black/70 z-[95]" onClick={handleClose} />
      )}

      <aside
        className={cn(
          'fixed top-0 right-0 h-full w-full md:w-[860px] bg-surface border-l border-border',
          'flex flex-col z-[100] transition-transform duration-300 overflow-hidden',
          isDetailOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* ─── HEADER ─────────────────────────────────────── */}
        <div className="flex-shrink-0 border-b border-border">
          {/* Ligne 1 : navigation + actions */}
          <div className="flex items-center gap-2 px-4 py-3">
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

              {contexteReplay && (
                <button
                  onClick={() => {
                    lancerRestaurationContexte(contexteReplay)
                    closeDetail()
                    navigate('/backtest')
                  }}
                  title="Rejouer ce trade sur le graphique du Backtest au moment précis de l'entrée"
                  className="px-2.5 py-1.5 bg-accent/25 border border-accent/40 text-accent rounded-md text-[12px] font-semibold hover:bg-accent/40 hover:text-white transition-all flex items-center gap-1 shadow-sm"
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
            {selectedTrade.emotion && <Tag>😊 {selectedTrade.emotion}</Tag>}
            {selectedTrade.exit_type && <Tag>🏁 Sortie: {selectedTrade.exit_type.toUpperCase()}</Tag>}
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Info label="Paire" value={selectedTrade.pair} />
                <Info label="Direction" value={selectedTrade.direction === 'long' ? '↑ Long' : '↓ Short'} />
                <Info label="Session" value={selectedTrade.session} />
                <Info label="Date" value={formatDate(selectedTrade.date_backtested)} />
                <Info label="Heure d'entrée" value={selectedTrade.entry_time ?? '—'} />
                <Info label="Heure de sortie" value={selectedTrade.exit_time ?? '—'} />
                <Info label="R:R prévu" value={formatRR(selectedTrade.rr_planned)} />
                <Info label="R:R réalisé" value={formatRR(selectedTrade.rr_realized)} highlight />
                
                {strategieAssociee && (
                  <Info label="Stratégie" value={strategieAssociee.name} />
                )}
                {selectedTrade.duree_estimee_heures != null && (
                  <Info label="Durée estimée" value={`${selectedTrade.duree_estimee_heures}h`} />
                )}
                {selectedTrade.duree_reelle_bougies != null && (
                  <Info label="Durée réelle" value={`${selectedTrade.duree_reelle_bougies} bougies`} />
                )}
                {selectedTrade.emotion && (
                  <Info label="Émotion" value={selectedTrade.emotion} />
                )}
              </div>
            </Section>

            {/* ─── 🧠 SECTION RAISONS & CONCEPTS VALIDÉS ─────────────────── */}
            {raisonsDetaillees.length > 0 && (
              <Section title="🧠 Raisons & Concepts de Trading">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {raisonsDetaillees.map((r, idx) => (
                    <div
                      key={idx}
                      className="bg-bg border border-border2 rounded-lg p-3 flex items-center gap-3 shadow-sm hover:border-accent/40 transition-colors"
                    >
                      <span className="text-xl flex-shrink-0 p-2 bg-surface2 rounded-md">
                        {r.familyIcon}
                      </span>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-txt font-semibold text-[13px] truncate">
                          {r.title}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-txt3 text-[11px] font-medium">
                            {r.familyName}
                          </span>
                          <span className="text-txt3 text-[10px]">·</span>
                          <span className="text-accent font-semibold text-[11px] bg-accent/10 px-1.5 py-0.2 rounded">
                            {r.variant}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

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

                          <div className="flex items-center gap-3 text-[11.5px] bg-surface border border-border2 rounded px-2.5 py-1.5 flex-wrap">
                            <div><span className="text-txt3">Réel: </span><span className="font-semibold text-txt">{item.actual || '—'}</span></div>
                            <div className="border-l border-border2 h-3.5 hidden sm:block" />
                            <div><span className="text-txt3">Prévu: </span><span className="text-txt2">{item.forecast || '—'}</span></div>
                            <div className="border-l border-border2 h-3.5 hidden sm:block" />
                            <div><span className="text-txt3">Préc: </span><span className="text-txt2">{item.previous || '—'}</span></div>
                          </div>

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
                <Thumbnails
                  images={biais.images && biais.images.length > 0 ? biais.images : imagesAvant.filter(i => i.context === 'biais' || i.context === 'superieur')}
                  onOpen={setLightbox}
                />
              </Section>
            )}

            {/* POI */}
            {poi && (
              <Section title="🎯 POI / Zone" badge={poi.timeframe ?? undefined}>
                <p className="text-txt2 text-[13.5px] leading-relaxed mb-3">{poi.notes ?? '—'}</p>
                <Thumbnails
                  images={poi.images && poi.images.length > 0 ? poi.images : imagesAvant.filter(i => i.context === 'poi' || i.context === 'intermediaire')}
                  onOpen={setLightbox}
                />
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
                <Thumbnails
                  images={entry.images && entry.images.length > 0 ? entry.images : imagesAvant.filter(i => i.context === 'entry' || i.context === 'inferieur')}
                  onOpen={setLightbox}
                />
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
                  {((review.images && review.images.length > 0) || imagesApres.length > 0) && (
                    <div className="mt-3">
                      <p className="text-txt3 text-[10px] font-semibold uppercase tracking-wider mb-2">🖼 Graphique de fin / Résultat</p>
                      <Thumbnails
                        images={review.images && review.images.length > 0 ? review.images : imagesApres}
                        onOpen={setLightbox}
                      />
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* ─── 🖼 GALERIE GLOBALE DE CAPTURES D'ÉCRAN ─────────────────── */}
            {toutesLesImagesDuTrade.length > 0 && (
              <Section title="🖼️ Galerie de Captures Graphiques">
                <div className="flex flex-col gap-3">
                  <p className="text-txt3 text-[11px]">
                    {toutesLesImagesDuTrade.length} capture(s) d'écran enregistrée(s) pour ce trade. Cliquez sur une image pour l'agrandir.
                  </p>
                  <Thumbnails images={toutesLesImagesDuTrade} onOpen={setLightbox} />
                </div>
              </Section>
            )}

            <div className="h-4" />
          </div>
        </div>
      </aside>

      {/* Lightbox — affiche l'image en grand sur clic */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/92 z-[200] flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 text-white text-2xl opacity-70 hover:opacity-100 bg-black/30 rounded-full w-9 h-9 flex items-center justify-center"
            onClick={() => setLightbox(null)}
          >
            ✕
          </button>
          <img src={lightbox} alt="Chart" className="max-w-full max-h-[90vh] rounded-lg object-contain shadow-2xl" />
        </div>
      )}
    </>
  )
}

// ─── Skeleton pour le TradeDetail ─────────────────────────

export function TradeDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center gap-3">
        <SkeletonLine width="w-20" />
        <SkeletonLine width="w-14" />
        <SkeletonLine width="w-14" />
      </div>
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
  if (!images || !images.length) return null
  return (
    <div className="flex gap-2 flex-wrap">
      {images.map((img, i) => {
        const src = img.url ?? img.storage_path
        return (
          <button
            key={i}
            onClick={() => src && onOpen(src)}
            className="w-28 h-20 bg-bg border border-border2 rounded-md overflow-hidden flex items-center justify-center hover:border-accent transition-colors flex-shrink-0 cursor-zoom-in group relative"
          >
            {src ? (
              <>
                <img src={src} alt={`chart-${i}`} className="w-full h-full object-cover" loading="lazy" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
                  <span className="text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity">🔍</span>
                </div>
              </>
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
