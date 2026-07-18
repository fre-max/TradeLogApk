import type { TradeWithSteps, StepWithImages } from '@/types'

/**
 * Génère et télécharge un fichier CSV avec tous les trades.
 * Les URLs des images sont incluses comme liens cliquables — Excel les rend automatiquement cliquables.
 *
 * Exemple :
 * exportCsv(trades) → télécharge "tradelog_2026-06-24.csv"
 */
export function exportCsv(trades: TradeWithSteps[]) {
  if (trades.length === 0) return

  // ─── 1️⃣ Définition des colonnes ────────────────────────────────────────────

  const entetes = [
    'Date',
    'Paire',
    'Direction',
    'Session',
    'Heure entrée',
    'R:R Prévu',
    'R:R Réalisé',
    'Résultat',
    'Sortie via',
    'Émotion',
    'Statut',
    // Sections analytiques
    'Biais TF',
    'Biais Direction',
    'Biais Raisons',
    'POI TF',
    'POI Type',
    'POI Confluences',
    'Entrée TF',
    'Entrée Setup',
    'Prix entrée',
    'Stop Loss',
    'Take Profit',
    'Review +',
    'Review -',
    // Liens images — cliquables dans Excel / Google Sheets
    'Chart Biais (URL)',
    'Chart POI (URL)',
    'Chart Entrée (URL)',
  ]

  // ─── 2️⃣ Conversion de chaque trade en ligne CSV ─────────────────────────────

  const lignes = trades.map((trade) => {
    // Récupère les étapes du trade par type
    const biais = trade.steps.find((s) => s.type === 'biais') as StepWithImages | undefined
    const poi   = trade.steps.find((s) => s.type === 'poi') as StepWithImages | undefined
    const entry = trade.steps.find((s) => s.type === 'entry') as StepWithImages | undefined
    const review = trade.steps.find((s) => s.type === 'result') as StepWithImages | undefined

    // Récupère les champs spécifiques de chaque section
    const biaisFields  = (biais?.fields ?? {}) as Record<string, unknown>
    const poiFields    = (poi?.fields   ?? {}) as Record<string, unknown>
    const entryFields  = (entry?.fields ?? {}) as Record<string, unknown>
    const reviewFields = (review?.fields ?? {}) as Record<string, unknown>

    // Récupère la première image de chaque section (URL ou storage_path)
    const getImgUrl = (phase: string, context: string) => {
      const img = trade.images?.find(i => i.phase === phase && i.context === context)
      return img?.url ?? img?.storage_path ?? ''
    }
    const imageUrlBiais  = getImgUrl('avant', 'superieur') || getImgUrl('avant', 'global')
    const imageUrlPoi    = getImgUrl('avant', 'intermediaire')
    const imageUrlEntry  = getImgUrl('avant', 'inferieur')

    // Construit la ligne dans l'ordre des entêtes
    return [
      trade.date_backtested,
      trade.pair,
      trade.direction,
      trade.session,
      trade.entry_time ?? '',
      trade.rr_planned  ?? '',
      trade.rr_realized ?? '',
      trade.result      ?? '',
      trade.exit_type   ?? '',
      trade.emotion     ?? '',
      trade.status,
      // Biais
      biais?.timeframe ?? '',
      String(biaisFields.direction ?? ''),
      biais?.notes ?? '',
      // POI
      poi?.timeframe ?? '',
      String(poiFields.zone_type ?? ''),
      poi?.notes ?? '',
      // Entrée
      entry?.timeframe ?? '',
      String(entryFields.setup   ?? ''),
      String(entryFields.price   ?? ''),
      String(entryFields.sl      ?? ''),
      String(entryFields.tp      ?? ''),
      // Review
      String(reviewFields.good   ?? ''),
      String(reviewFields.bad ?? reviewFields.improve ?? ''),
      // URLs images
      imageUrlBiais,
      imageUrlPoi,
      imageUrlEntry,
    ]
  })

  // ─── 3️⃣ Assemblage du contenu CSV ──────────────────────────────────────────

  // Échappe les guillemets dans les valeurs et entoure chaque cellule de guillemets
  // Cela gère les virgules et sauts de ligne dans les notes
  const echapperCellule = (valeur: unknown): string => {
    const texte = String(valeur ?? '')
    // Si la valeur contient des guillemets, on les double (convention CSV)
    return `"${texte.replace(/"/g, '""')}"`
  }

  const csvContent = [
    entetes.map(echapperCellule).join(','),
    ...lignes.map((ligne) => ligne.map(echapperCellule).join(',')),
  ].join('\n')

  // ─── 4️⃣ Téléchargement du fichier ──────────────────────────────────────────

  // Le BOM \ufeff force Excel à reconnaître l'UTF-8 (accents, emojis)
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const lien = document.createElement('a')
  lien.href = URL.createObjectURL(blob)
  lien.download = `tradelog_export_${new Date().toISOString().split('T')[0]}.csv`
  lien.click()
  URL.revokeObjectURL(lien.href)
}
