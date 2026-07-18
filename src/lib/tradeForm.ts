import type { TradeWithSteps, StepWithImages } from '@/types'
import type { GeminiAnalysis } from '@/hooks/useQuickEntry'

export const INITIAL_FORM_STATE = {
  pair: 'XAUUSD',
  date_backtested: new Date().toISOString().split('T')[0],
  session: 'London',
  entry_time: '',
  exit_time: '',
  direction: 'long' as 'long' | 'short',
  rr_planned: '',
  rr_realized: '',
  result: 'win' as 'win' | 'loss' | 'breakeven' | 'missed' | null,
  exit_type: 'tp' as 'tp' | 'sl' | 'breakeven' | 'trailing' | 'manual',
  emotion: '',
  strategy_id: '',
  journal_type: 'global' as 'global' | 'bias' | 'poi' | 'confirmation',
  description: '', // Seul champ de description libre global
  duree_estimee_heures: '',
  duree_estimee_bougies: '',
  duree_reelle_bougies: '',
  backtest_context: null as any, // Stocke les informations de restauration pour le Replay (paire, année, timestamp, etc.)


  biais_timeframe: 'H4',
  biais_direction: 'Haussier',
  biais_reasons: '', // Déprécié, gardé pour compatibilité de compilation

  poi_timeframe: 'H1',
  poi_type: 'Order Block',
  poi_confluences: '', // Déprécié, gardé pour compatibilité de compilation

  entry_timeframe: 'M5',
  entry_setup: '',
  entry_price: '',
  entry_sl: '',
  entry_tp: '',
  entry_trailing: '',
  entry_reasons: '', // Déprécié, gardé pour compatibilité de compilation
  
  // Champs spécifiques aux missed trades (ordres non déclenchés)
  missed_gap: '',
  missed_reason: '', // Déprécié, gardé pour compatibilité de compilation

  review_good: '', // Déprécié, gardé pour compatibilité de compilation
  review_bad: '', // Déprécié, gardé pour compatibilité de compilation

  // Listes d'images associées à chaque étape du formulaire avec leur phase (avant/apres)
  biais_images: [] as { id: string; url: string; source: 'telegram' | 'upload' | 'url'; phase: 'avant' | 'apres' }[],
  poi_images: [] as { id: string; url: string; source: 'telegram' | 'upload' | 'url'; phase: 'avant' | 'apres' }[],
  entry_images: [] as { id: string; url: string; source: 'telegram' | 'upload' | 'url'; phase: 'avant' | 'apres' }[],
  
  // Raisons techniques issues du catalogue (liées aux étapes, conservé pour mapping interne)
  biais_catalog_reasons: [] as { reason_id: string; variant_name: string }[],
  poi_catalog_reasons: [] as { reason_id: string; variant_name: string }[],
  entry_catalog_reasons: [] as { reason_id: string; variant_name: string }[],
  sl_catalog_reasons: [] as { reason_id: string; variant_name: string }[],
  tp_catalog_reasons: [] as { reason_id: string; variant_name: string }[],
  trailing_catalog_reasons: [] as { reason_id: string; variant_name: string }[],
}

export type FormDataState = typeof INITIAL_FORM_STATE

export interface EditStepIds {
  biais?: string
  poi?: string
  entry?: string
  result?: string
}

function str(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v)
}

function numStr(v: unknown): string {
  if (v === null || v === undefined || v === '') return ''
  return String(v)
}

/** Convertit un trade BDD en état de formulaire (création ou édition). */
export function tradeToFormData(trade: TradeWithSteps, existingImages: any[] = []): FormDataState {
  const biais = trade.steps.find((s) => s.type === 'biais') as StepWithImages | undefined
  const poi = trade.steps.find((s) => s.type === 'poi') as StepWithImages | undefined
  const entry = trade.steps.find((s) => s.type === 'entry') as StepWithImages | undefined
  const review = trade.steps.find((s) => s.type === 'result') as StepWithImages | undefined

  const biaisFields = (biais?.fields ?? {}) as Record<string, unknown>
  const poiFields = (poi?.fields ?? {}) as Record<string, unknown>
  const entryFields = (entry?.fields ?? {}) as Record<string, unknown>
  const reviewFields = (review?.fields ?? {}) as Record<string, unknown>
  const gemini = biaisFields.extracted as GeminiAnalysis | undefined

  // Trie les images par contexte (provenant de la table trade_images)
  const biaisImages = existingImages
    .filter((img) => img.context === 'superieur')
    .map((img) => ({ id: img.id, url: img.url, source: img.source, phase: img.phase }))
  const poiImages = existingImages
    .filter((img) => img.context === 'intermediaire')
    .map((img) => ({ id: img.id, url: img.url, source: img.source, phase: img.phase }))
  const entryImages = existingImages
    .filter((img) => img.context === 'inferieur')
    .map((img) => ({ id: img.id, url: img.url, source: img.source, phase: img.phase }))

  return {
    pair: trade.pair,
    date_backtested: trade.date_backtested,
    session: trade.session,
    entry_time: trade.entry_time ?? '',
    exit_time: trade.exit_time ?? '',
    direction: trade.direction,
    rr_planned: numStr(trade.rr_planned ?? gemini?.rr),
    rr_realized: numStr(trade.rr_realized),
    result: trade.result ?? null,
    exit_type: trade.exit_type ?? 'tp',
    emotion: trade.emotion ?? '',
    strategy_id: trade.strategy_id ?? '',
    journal_type: trade.journal_type ?? 'global',
    description: review?.notes ?? str(reviewFields.description),
    duree_estimee_heures: numStr(trade.duree_estimee_heures),
    duree_estimee_bougies: numStr(trade.duree_estimee_bougies),
    duree_reelle_bougies: numStr(trade.duree_reelle_bougies),

    biais_timeframe: biais?.timeframe ?? gemini?.timeframe ?? 'H4',
    biais_direction: str(biaisFields.direction) || (gemini?.direction === 'short' ? 'Baissier' : gemini?.direction === 'long' ? 'Haussier' : 'Haussier'),
    biais_reasons: biais?.notes ?? '',

    poi_timeframe: poi?.timeframe ?? 'H1',
    poi_type: str(poiFields.zone_type) || 'Order Block',
    poi_confluences: poi?.notes ?? '',

    entry_timeframe: entry?.timeframe ?? gemini?.timeframe ?? 'M5',
    entry_setup: str(entryFields.setup),
    entry_price: numStr(entryFields.price ?? gemini?.entry_price),
    entry_sl: numStr(entryFields.sl ?? gemini?.sl),
    entry_tp: numStr(entryFields.tp ?? gemini?.tp),
    entry_trailing: str(entryFields.trailing),
    entry_reasons: entry?.notes ?? '',

    // Champs spécifiques aux missed trades
    missed_gap: numStr(reviewFields.missed_gap),
    missed_reason: str(reviewFields.missed_reason),

    review_good: str(reviewFields.good),
    review_bad: str(reviewFields.bad ?? reviewFields.improve),

    // Listes d'images
    biais_images: biaisImages.length > 0 ? biaisImages : (biais?.images?.map(img => ({ id: img.id, url: img.url || '', source: (img.source || 'upload') as any, phase: (img.phase || 'avant') as any })) ?? []),
    poi_images: poiImages.length > 0 ? poiImages : (poi?.images?.map(img => ({ id: img.id, url: img.url || '', source: (img.source || 'upload') as any, phase: (img.phase || 'avant') as any })) ?? []),
    entry_images: entryImages.length > 0 ? entryImages : (entry?.images?.map(img => ({ id: img.id, url: img.url || '', source: (img.source || 'upload') as any, phase: (img.phase || 'avant') as any })) ?? []),
    
    // Extractions des raisons du catalogue depuis les JSONB des étapes
    biais_catalog_reasons: ((biaisFields.catalog_reasons ?? []) as any[]).map(r => ({
      reason_id: String(r.reason_id),
      variant_name: String(r.variant_name),
    })),
    poi_catalog_reasons: ((poiFields.catalog_reasons ?? []) as any[]).map(r => ({
      reason_id: String(r.reason_id),
      variant_name: String(r.variant_name),
    })),
    entry_catalog_reasons: (((entryFields.catalog_reasons as any)?.entry ?? []) as any[]).map(r => ({
      reason_id: String(r.reason_id),
      variant_name: String(r.variant_name),
    })),
    sl_catalog_reasons: (((entryFields.catalog_reasons as any)?.sl ?? []) as any[]).map(r => ({
      reason_id: String(r.reason_id),
      variant_name: String(r.variant_name),
    })),
    tp_catalog_reasons: (((entryFields.catalog_reasons as any)?.tp ?? []) as any[]).map(r => ({
      reason_id: String(r.reason_id),
      variant_name: String(r.variant_name),
    })),
    trailing_catalog_reasons: (((entryFields.catalog_reasons as any)?.trailing ?? []) as any[]).map(r => ({
      reason_id: String(r.reason_id),
      variant_name: String(r.variant_name),
    })),
    backtest_context: (trade as any).backtest_context ?? null,
  }
}

export function extractStepIds(trade: TradeWithSteps): EditStepIds {
  return {
    biais: trade.steps.find((s) => s.type === 'biais')?.id,
    poi: trade.steps.find((s) => s.type === 'poi')?.id,
    entry: trade.steps.find((s) => s.type === 'entry')?.id,
    result: trade.steps.find((s) => s.type === 'result')?.id,
  }
}

/** Détermine le statut après sauvegarde. */
export function computeTradeStatus(
  formData: FormDataState,
  previousStatus: TradeWithSteps['status']
): TradeWithSteps['status'] {
  const hasResult = Boolean(formData.result && formData.rr_realized)

  if (hasResult && formData.emotion) {
    return 'complete'
  }

  if (previousStatus === 'quick') {
    return 'in_progress'
  }

  return previousStatus === 'complete' ? 'complete' : 'in_progress'
}

export interface StepPayload {
  id?: string
  trade_id: string
  order: number
  type: string
  title: string
  timeframe: string | null
  notes: string | null
  fields: Record<string, unknown> | null
}

export function buildStepPayloads(
  tradeId: string,
  formData: FormDataState,
  stepIds: EditStepIds,
  preserveBiaisFields?: Record<string, unknown> | null
): StepPayload[] {
  return [
    {
      id: stepIds.biais,
      trade_id: tradeId,
      order: 0,
      type: 'biais',
      title: 'Biais',
      timeframe: formData.biais_timeframe,
      notes: null,
      fields: {
        ...(preserveBiaisFields ?? {}),
        direction: formData.biais_direction,
        catalog_reasons: formData.biais_catalog_reasons,
      },
    },
    {
      id: stepIds.poi,
      trade_id: tradeId,
      order: 1,
      type: 'poi',
      title: 'POI / Zone',
      timeframe: formData.poi_timeframe,
      notes: null,
      fields: { 
        zone_type: formData.poi_type,
        catalog_reasons: formData.poi_catalog_reasons,
      },
    },
    {
      id: stepIds.entry,
      trade_id: tradeId,
      order: 2,
      type: 'entry',
      title: 'Entrée',
      timeframe: formData.entry_timeframe,
      notes: null,
      fields: {
        setup: formData.entry_setup,
        price: formData.entry_price ? parseFloat(formData.entry_price) : null,
        sl: formData.entry_sl ? parseFloat(formData.entry_sl) : null,
        tp: formData.entry_tp ? parseFloat(formData.entry_tp) : null,
        trailing: formData.entry_trailing || null,
        catalog_reasons: {
          entry: formData.entry_catalog_reasons,
          sl: formData.sl_catalog_reasons,
          tp: formData.tp_catalog_reasons,
          trailing: formData.trailing_catalog_reasons,
        },
      },
    },
    {
      id: stepIds.result,
      trade_id: tradeId,
      order: 3,
      type: 'result',
      title: 'Résultat & Review',
      timeframe: null,
      notes: formData.description || null,
      fields: {
        description: formData.description,
        missed_gap: formData.result === 'missed' && formData.missed_gap ? parseFloat(formData.missed_gap) : null,
      },
    },
  ]
}

export function buildTradePayload(formData: FormDataState, status: TradeWithSteps['status']) {
  return {
    pair: formData.pair,
    direction: formData.direction,
    session: formData.session,
    date_backtested: formData.date_backtested,
    entry_time: formData.entry_time || null,
    exit_time: formData.exit_time || null,
    result: formData.result,
    rr_planned: formData.rr_planned ? parseFloat(formData.rr_planned) : null,
    rr_realized: formData.rr_realized ? parseFloat(formData.rr_realized) : null,
    exit_type: formData.exit_type,
    emotion: formData.emotion || null,
    strategy_id: formData.strategy_id || null,
    journal_type: formData.journal_type,
    duree_estimee_heures: formData.duree_estimee_heures ? parseFloat(formData.duree_estimee_heures) : null,
    duree_estimee_bougies: formData.duree_estimee_bougies ? parseInt(formData.duree_estimee_bougies, 10) : null,
    duree_reelle_bougies: formData.duree_reelle_bougies ? parseInt(formData.duree_reelle_bougies, 10) : null,
    backtest_context: formData.backtest_context || null,
    status,
  }
}
