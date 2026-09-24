import type { TradeWithSteps, StepWithImages } from '@/types'
import { useLocalDatabase } from '@/store/useLocalDatabase'
import { exporterEtTelechargerFichier } from '@/lib/telechargementFichier'

/**
 * Génère et télécharge un fichier CSV complet avec tous les trades du journal.
 * Compatible Web (PC) et Mobile Natif (Android / Tablette via Capacitor).
 * 
 * Points forts :
 * - Extrait intelligemment toutes les données (prix, SL, TP, P&L, durées, stratégie, notes).
 * - Multiples systèmes de repli (fallbacks) : vérifie les étapes (steps), le contexte de backtest
 *   et les champs directs pour ne laisser AUCUNE cellule vide inutilement.
 * - Encodage UTF-8 avec BOM (\ufeff) pour ouverture parfaite et sans bug d'accent dans Excel / Sheets.
 *
 * Exemple :
 * await exportCsv(trades) → télécharge ou partage "tradelog_export_2026-09-23.csv"
 */
export async function exportCsv(trades: TradeWithSteps[]): Promise<{ succes: boolean; message: string }> {
  if (!trades || trades.length === 0) {
    return { succes: false, message: 'Aucun trade à exporter.' }
  }

  // Récupération de la liste des stratégies en cache pour afficher les vrais noms au lieu des UUIDs
  const strategies = useLocalDatabase.getState().strategies || []
  const strategyMap = new Map(strategies.map((s) => [s.id, s.name]))

  // ─── 1️⃣ Définition des colonnes du CSV ──────────────────────────────────────

  const entetes = [
    'ID Trade',
    'Date',
    'Paire',
    'Direction',
    'Session',
    'Heure entrée',
    'Heure sortie',
    'Prix entrée',
    'Stop Loss',
    'Take Profit',
    'Prix sortie',
    'R:R Prévu',
    'R:R Réalisé',
    'P&L',
    'Résultat',
    'Type sortie',
    'Durée (bougies)',
    'Durée (heures)',
    'Stratégie',
    'Setup',
    'Timeframe',
    'Émotion',
    'Statut',
    'Biais (TF & Direction)',
    'POI (Zone & Confluences)',
    'Notes & Analyse',
    'Image Avant (URL)',
    'Image Après (URL)',
  ]

  // ─── 2️⃣ Conversion de chaque trade en ligne complète ─────────────────────────

  const lignes = trades.map((trade, index) => {
    // 1. Récupération des étapes (steps)
    const biaisStep = trade.steps?.find((s) => s.type === 'biais') as StepWithImages | undefined
    const poiStep   = trade.steps?.find((s) => s.type === 'poi') as StepWithImages | undefined
    const entryStep = trade.steps?.find((s) => s.type === 'entry') as StepWithImages | undefined
    const reviewStep = trade.steps?.find((s) => s.type === 'result') as StepWithImages | undefined

    const biaisFields  = (biaisStep?.fields ?? {}) as Record<string, unknown>
    const poiFields    = (poiStep?.fields   ?? {}) as Record<string, unknown>
    const entryFields  = (entryStep?.fields ?? {}) as Record<string, unknown>
    const reviewFields = (reviewStep?.fields ?? {}) as Record<string, unknown>

    // 2. Date et Heures (avec fallbacks)
    const dateTrade = trade.date_backtested
      || (trade.backtest_context?.timestamp ? new Date(trade.backtest_context.timestamp * 1000).toISOString().split('T')[0] : '')
      || (trade.created_at ? String(trade.created_at).split('T')[0] : '')

    const heureEntree = trade.entry_time
      || (trade.backtest_context?.timestamp ? new Date(trade.backtest_context.timestamp * 1000).toTimeString().slice(0, 5) : '')
      || ''

    const heureSortie = trade.exit_time || ''

    // 3. Identification de l'actif et de la direction
    const paire = trade.pair || trade.backtest_context?.pair || 'EURUSD'
    const direction = (trade.direction || trade.backtest_context?.direction || 'long').toUpperCase()
    const session = trade.session || 'London'

    // 4. Prix et Niveaux (Recherche dans entry.fields, trade racine, ou backtest_context)
    const prixEntree = entryFields.price
      ?? (trade as any).entry_price
      ?? trade.backtest_context?.prixEntree
      ?? ''

    const stopLoss = entryFields.sl
      ?? (trade as any).entry_sl
      ?? trade.backtest_context?.stopLoss
      ?? ''

    const takeProfit = entryFields.tp
      ?? (trade as any).entry_tp
      ?? trade.backtest_context?.takeProfit
      ?? ''

    const prixSortie = (trade as any).exit_price
      ?? (trade.backtest_context as any)?.prixSortie
      ?? ''

    // 5. Calculs des Ratios R:R et du PnL
    let rrPrevuStr = ''
    if (trade.rr_planned !== undefined && trade.rr_planned !== null) {
      rrPrevuStr = String(trade.rr_planned)
    } else if (prixEntree && stopLoss && takeProfit) {
      const pE = parseFloat(String(prixEntree))
      const sl = parseFloat(String(stopLoss))
      const tp = parseFloat(String(takeProfit))
      const distRisk = Math.abs(pE - sl)
      const distReward = Math.abs(tp - pE)
      if (distRisk > 0) rrPrevuStr = (distReward / distRisk).toFixed(2)
    }

    let rrRealiseStr = ''
    if (trade.result === 'missed') {
      rrRealiseStr = '0.00'
    } else if (trade.rr_realized !== undefined && trade.rr_realized !== null) {
      rrRealiseStr = String(trade.rr_realized)
    }

    let pnlStr = ''
    if (trade.result === 'missed') {
      pnlStr = '0.00%'
    } else if ((trade as any).pnl !== undefined && (trade as any).pnl !== null) {
      const pnlNum = Number((trade as any).pnl)
      pnlStr = `${pnlNum >= 0 ? '+' : ''}${pnlNum.toFixed(2)}%`
    } else if (reviewFields.pnl !== undefined && reviewFields.pnl !== null) {
      const pnlNum = Number(reviewFields.pnl)
      pnlStr = `${pnlNum >= 0 ? '+' : ''}${pnlNum.toFixed(2)}%`
    }

    // 6. Résultat et Type de sortie
    const resultat = (trade.result || (trade.status === 'complete' ? 'win' : 'en_cours')).toUpperCase()
    const exitType = (trade.exit_type || '').toUpperCase()

    // 7. Durées
    const dureeBougies = trade.duree_reelle_bougies
      ?? trade.duree_estimee_bougies
      ?? (trade.backtest_context?.dureeEstimeeBougies ?? '')

    const dureeHeures = trade.duree_estimee_heures
      ?? (trade.backtest_context?.dureeEstimeeHeures ?? '')

    // 8. Stratégie & Setup
    const stratNom = (trade.strategy_id ? strategyMap.get(trade.strategy_id) : null)
      || (trade as any).strategy_name
      || 'Discrétionnaire'

    const setupNom = String(entryFields.setup ?? (trade as any).entry_setup ?? (trade as any).setup ?? '')
    const tfEntree = entryStep?.timeframe ?? trade.backtest_context?.timeframe ?? (trade as any).entry_timeframe ?? 'M5'

    // 9. Contexte Biais & POI
    const biaisDir = String(biaisFields.direction ?? '')
    const biaisTf  = biaisStep?.timeframe ?? ''
    const biaisDesc = [biaisTf, biaisDir].filter(Boolean).join(' ')

    const poiType = String(poiFields.zone_type ?? '')
    const poiTf   = poiStep?.timeframe ?? ''
    const poiDesc = [poiTf, poiType].filter(Boolean).join(' ')

    // 10. Notes / Description du trade
    const notesTrade = String(
      (trade as any).notes
      || reviewFields.description
      || reviewStep?.notes
      || (trade as any).description
      || ''
    )

    // 11. URLs d'images (on évite d'inclure du base64 brut pour garder un CSV léger et propre)
    const getCleanImgUrl = (phase: string) => {
      const img = trade.images?.find((i) => i.phase === phase)
      if (!img) return ''
      if (img.url && !img.url.startsWith('data:')) return img.url
      if (img.storage_path) return img.storage_path
      return ''
    }

    const imgAvantUrl = getCleanImgUrl('avant')
    const imgApresUrl = getCleanImgUrl('apres')

    return [
      trade.id || `trade_${index + 1}`,
      dateTrade,
      paire,
      direction,
      session,
      heureEntree,
      heureSortie,
      prixEntree,
      stopLoss,
      takeProfit,
      prixSortie,
      rrPrevuStr,
      rrRealiseStr,
      pnlStr,
      resultat,
      exitType,
      dureeBougies,
      dureeHeures,
      stratNom,
      setupNom,
      tfEntree,
      trade.emotion ?? '',
      trade.status ?? 'complete',
      biaisDesc,
      poiDesc,
      notesTrade,
      imgAvantUrl,
      imgApresUrl,
    ]
  })

  // ─── 3️⃣ Assemblage du contenu CSV ──────────────────────────────────────────

  const echapperCellule = (valeur: unknown): string => {
    const texte = String(valeur ?? '')
    // Si la valeur contient des guillemets, on les double (convention CSV standard)
    return `"${texte.replace(/"/g, '""')}"`
  }

  const csvContent = [
    entetes.map(echapperCellule).join(';'), // Point-virgule comme séparateur pour Excel FR
    ...lignes.map((ligne) => ligne.map(echapperCellule).join(';')),
  ].join('\r\n')

  // ─── 4️⃣ Téléchargement universel (Android APK ou Navigateur Web) ─────────
  const nomFichier = `tradelog_export_${new Date().toISOString().split('T')[0]}.csv`
  const contenuAvecBom = '\ufeff' + csvContent

  const resultat = await exporterEtTelechargerFichier(
    nomFichier,
    contenuAvecBom,
    'text/csv;charset=utf-8;'
  )

  console.log(`✅ [Export CSV] ${trades.length} trade(s) exporté(s). Résultat :`, resultat.message)
  return resultat
}
