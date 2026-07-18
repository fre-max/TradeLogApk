import { jsPDF } from 'jspdf'
import type { TradeWithSteps, StepWithImages } from '@/types'

// ─── Constantes de mise en page ──────────────────────────────────────────────

const MARGE  = 15        // mm depuis le bord gauche
const LARGEUR_PAGE = 180 // mm de contenu (A4 = 210 - 2x15mm de marge)
const COULEUR_ACCENT   = [79, 124, 255]  as const  // bleu accent
const COULEUR_TITRE    = [30, 30, 30]    as const  // quasi-noir
const COULEUR_TEXTE    = [80, 80, 80]   as const   // gris foncé
const COULEUR_LEGER    = [140, 140, 140] as const  // gris clair
const COULEUR_WIN      = [62, 207, 110]  as const  // vert
const COULEUR_LOSS     = [240, 79, 79]   as const  // rouge
const COULEUR_BE       = [240, 184, 79]  as const  // orange

/**
 * Génère et télécharge un PDF complet pour un seul trade.
 * Inclut les données de chaque section + les images si disponibles.
 *
 * Exemple :
 * await exportPdf(trade) → télécharge "XAUUSD-Long-2026-06-20.pdf"
 */
export async function exportPdf(trade: TradeWithSteps) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })

  // Position verticale courante — on l'incrémente à chaque bloc
  let y = MARGE

  // ─── 1️⃣ En-tête du trade ─────────────────────────────────────────────────

  y = dessinerEnTete(doc, trade, y)
  y += 6

  // ─── 2️⃣ Sections analytiques ─────────────────────────────────────────────

  const biais  = trade.steps.find((s) => s.type === 'biais') as StepWithImages | undefined
  const poi    = trade.steps.find((s) => s.type === 'poi') as StepWithImages | undefined
  const entry  = trade.steps.find((s) => s.type === 'entry') as StepWithImages | undefined
  const review = trade.steps.find((s) => s.type === 'result') as StepWithImages | undefined

  // Section Biais
  if (biais) {
    const biaisFields = (biais.fields ?? {}) as Record<string, unknown>
    const lignes = [
      `Direction : ${biaisFields.direction ?? '—'}`,
      `Timeframe : ${biais.timeframe ?? '—'}`,
    ]
    const img = trade.images?.find(i => i.phase === 'avant' && (i.context === 'superieur' || i.context === 'global'))
    const imageUrl = img?.url ?? img?.storage_path ?? null
    y = await dessinerSection(doc, '📊 BIAIS', lignes, biais.notes ?? null, imageUrl, y)
    y += 4
  }

  // Section POI
  if (poi) {
    const poiFields = (poi.fields ?? {}) as Record<string, unknown>
    const lignes = [
      `Type : ${String(poiFields.zone_type ?? '—')}`,
      `Timeframe : ${poi.timeframe ?? '—'}`,
    ]
    const img = trade.images?.find(i => i.phase === 'avant' && i.context === 'intermediaire')
    const imageUrl = img?.url ?? img?.storage_path ?? null
    y = await dessinerSection(doc, '📍 POI / ZONE', lignes, poi.notes ?? null, imageUrl, y)
    y += 4
  }

  // Section Entrée
  if (entry) {
    const entryFields = (entry.fields ?? {}) as Record<string, unknown>
    const lignes = [
      `Setup : ${String(entryFields.setup ?? '—')}  |  Timeframe : ${entry.timeframe ?? '—'}`,
      `Prix entrée : ${String(entryFields.price ?? '—')}  |  SL : ${String(entryFields.sl ?? '—')}  |  TP : ${String(entryFields.tp ?? '—')}`,
    ]
    const img = trade.images?.find(i => i.phase === 'avant' && i.context === 'inferieur')
    const imageUrl = img?.url ?? img?.storage_path ?? null
    y = await dessinerSection(doc, '🎯 ENTRÉE', lignes, entry.notes ?? null, imageUrl, y)
    y += 4
  }

  // Section Review
  if (review) {
    const reviewFields = (review.fields ?? {}) as Record<string, unknown>
    const lignesReview = [
      `✅  Ce qui a bien marché :`,
      String(reviewFields.good ?? '—'),
      '',
      `⚠️   À améliorer :`,
      String(reviewFields.bad ?? reviewFields.improve ?? '—'),
    ]
    const img = trade.images?.find(i => i.phase === 'apres')
    const imageUrl = img?.url ?? img?.storage_path ?? null
    y = await dessinerSection(doc, '📝 REVIEW', lignesReview, null, imageUrl, y)
  }

  // ─── 3️⃣ Pied de page ─────────────────────────────────────────────────────

  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(140, 140, 140)
    doc.text(
      `TradeLog · Généré le ${new Date().toLocaleDateString('fr-FR')} · Page ${i}/${totalPages}`,
      MARGE,
      290
    )
  }

  // ─── 4️⃣ Téléchargement ────────────────────────────────────────────────────

  const nomFichier = `${trade.pair}-${trade.direction}-${trade.date_backtested}.pdf`
  doc.save(nomFichier)
}

// ─── Fonction : dessine l'en-tête complet du trade ───────────────────────────

function dessinerEnTete(doc: jsPDF, trade: TradeWithSteps, y: number): number {
  // Bandeau coloré en fond
  doc.setFillColor(20, 20, 30)
  doc.rect(0, 0, 210, 38, 'F')

  // Paire et direction
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(240, 240, 240)
  doc.text(`${trade.pair}`, MARGE, y + 10)

  // Direction avec couleur
  const directionLabel = trade.direction === 'long' ? '↑ LONG' : '↓ SHORT'
  const dirCouleur = trade.direction === 'long' ? COULEUR_WIN : COULEUR_LOSS
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  if (trade.direction === 'long') {
    doc.setTextColor(62, 207, 110)
  } else {
    doc.setTextColor(240, 79, 79)
  }
  doc.text(directionLabel, MARGE + 42, y + 10)

  // Résultat
  if (trade.result) {
    const labelResult = trade.result === 'win' ? '✓ WIN' : trade.result === 'loss' ? '✗ LOSS' : '— BE'
    doc.setFontSize(13)
    if (trade.result === 'win')       doc.setTextColor(62, 207, 110)
    else if (trade.result === 'loss') doc.setTextColor(240, 79, 79)
    else                              doc.setTextColor(240, 184, 79)
    doc.text(labelResult, 210 - MARGE - 25, y + 10, { align: 'right' })
  }

  // Infos secondaires : session, date, R:R
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(180, 180, 180)
  const infos = [
    trade.session,
    trade.date_backtested,
    trade.entry_time ? `Entrée : ${trade.entry_time}` : null,
    trade.rr_planned  ? `R:R Prévu : ${trade.rr_planned}R`  : null,
    trade.rr_realized != null ? `R:R Réalisé : ${trade.rr_realized}R` : null,
    trade.emotion ? `Émotion : ${trade.emotion}` : null,
  ].filter(Boolean).join('  ·  ')

  doc.text(infos, MARGE, y + 20)

  return 42 // retourne la position Y après l'en-tête
}

// ─── Fonction : dessine une section (Biais, POI, etc.) ───────────────────────
// Gère automatiquement le saut de page si plus assez de place

async function dessinerSection(
  doc: jsPDF,
  titre: string,
  lignes: string[],
  notes: string | null,
  imageUrl: string | null,
  y: number
): Promise<number> {
  const HAUTEUR_PAGE = 280 // mm utilisables avant le pied de page

  // Saut de page si besoin (on estime la hauteur minimale de la section à 25mm)
  if (y > HAUTEUR_PAGE - 25) {
    doc.addPage()
    y = MARGE
  }

  // Barre de couleur à gauche du titre de section
  doc.setFillColor(79, 124, 255)
  doc.rect(MARGE, y, 1.5, 5, 'F')

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 30, 30)
  // Supprime les emojis pour éviter les problèmes de rendu PDF
  const titreNettoye = titre.replace(/[\u{1F300}-\u{1FFFF}]/gu, '').trim()
  doc.text(titreNettoye, MARGE + 4, y + 4)
  y += 8

  // Ligne séparatrice légère
  doc.setDrawColor(220, 220, 220)
  doc.setLineWidth(0.3)
  doc.line(MARGE, y, MARGE + LARGEUR_PAGE, y)
  y += 4

  // Chaque ligne de données (timeframe, direction, etc.)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80, 80, 80)

  for (const ligne of lignes) {
    if (y > HAUTEUR_PAGE) { doc.addPage(); y = MARGE }
    // Les lignes vides ont moins d'espace
    if (ligne === '') {
      y += 2
    } else {
      // Wrap automatique si le texte est trop long
      const texteLigne = doc.splitTextToSize(ligne, LARGEUR_PAGE)
      doc.text(texteLigne, MARGE, y)
      y += texteLigne.length * 4.5
    }
  }

  // Notes / texte libre
  if (notes && notes.trim()) {
    y += 2
    doc.setFontSize(8.5)
    doc.setTextColor(140, 140, 140)
    doc.setFont('helvetica', 'italic')
    const lignesNotes = doc.splitTextToSize(notes, LARGEUR_PAGE)
    // Saut de page si les notes débordent
    if (y + lignesNotes.length * 4 > HAUTEUR_PAGE) { doc.addPage(); y = MARGE }
    doc.text(lignesNotes, MARGE, y)
    y += lignesNotes.length * 4 + 2
  }

  // Image si disponible
  if (imageUrl) {
    const imageBase64 = await chargerImageEnBase64(imageUrl)
    if (imageBase64) {
      const HAUTEUR_IMAGE = 55 // mm — hauteur fixe de l'image dans le PDF
      if (y + HAUTEUR_IMAGE > HAUTEUR_PAGE) { doc.addPage(); y = MARGE }

      try {
        doc.addImage(imageBase64.data, imageBase64.format, MARGE, y, LARGEUR_PAGE, HAUTEUR_IMAGE)
        y += HAUTEUR_IMAGE + 3
      } catch {
        // Si l'image plante (format inconnu), on continue sans elle
        console.warn('⚠️ [exportPdf] Image non supportée, ignorée :', imageUrl)
      }
    }
  }

  return y
}

// ─── Utilitaire : télécharge une image et la convertit en base64 ──────────────

interface ImageBase64 {
  data: string
  format: 'JPEG' | 'PNG' | 'WEBP'
}

async function chargerImageEnBase64(url: string): Promise<ImageBase64 | null> {
  try {
    const response = await fetch(url, { mode: 'cors' })
    if (!response.ok) return null

    const blob = await response.blob()
    const contentType = blob.type

    // Détermine le format selon le content-type
    let format: ImageBase64['format'] = 'JPEG'
    if (contentType.includes('png'))  format = 'PNG'
    if (contentType.includes('webp')) format = 'WEBP'

    // Convertit le Blob en base64
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload  = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })

    return { data: base64, format }
  } catch {
    // Si le fetch échoue (CORS, réseau...), on continue sans l'image
    console.warn('⚠️ [exportPdf] Impossible de charger l\'image :', url)
    return null
  }
}
