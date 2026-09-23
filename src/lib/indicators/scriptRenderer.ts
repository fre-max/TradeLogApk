import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import type { Bougie } from '@/lib/chartDataHelper';
import type { VisualPrimitives, VisualBox, VisualLine, VisualLabel, VisualCurve, IndicatorExecutionResult, IndicatorScript } from '@/types/indicatorScript';
import { dessinerLuxAlgoSMC } from './luxAlgoSMCRenderer';
import { dessinerProtectedSwings } from './protectedSwingsRenderer';
import { dessinerZigZag } from './zigzagRenderer';
import { dessinerUnmitigatedVolumeProfile } from './unmitigatedVolumeProfileRenderer';

/**
 * Fonction unifiée pour projeter le rendu d'un indicateur scriptable sur le canvas.
 * Exécute soit le moteur de rendu spécialisé (LuxAlgo SMC, Protected Swings, etc.)
 * soit le moteur universel de primitives visuelles.
 * 
 * Exemple :
 * dessinerResultatIndicateur(ctx, resultat, script, chart, series, bougies);
 */
export function dessinerResultatIndicateur(
  ctx: CanvasRenderingContext2D,
  resultat: IndicatorExecutionResult,
  script: IndicatorScript,
  chart: IChartApi,
  series: ISeriesApi<'Candlestick'>,
  bougies: Bougie[]
): void {
  if (!resultat) return;

  // 1️⃣ Si l'indicateur utilise un affichage spécialisé haute fidélité
  if (resultat.typeSpecial === 'luxalgo-smc' && resultat.donnees) {
    dessinerLuxAlgoSMC(ctx, resultat.donnees as any, chart, series, bougies, script.parametres);
  } else if (resultat.typeSpecial === 'protected-swings' && resultat.donnees) {
    dessinerProtectedSwings(ctx, resultat.donnees as any, chart, series, bougies, script.parametres);
  } else if (resultat.typeSpecial === 'zigzag' && resultat.donnees) {
    dessinerZigZag(ctx, resultat.donnees as any, chart, series, bougies, script.parametres);
  } else if (resultat.typeSpecial === 'unmitigated-profile' && resultat.donnees) {
    dessinerUnmitigatedVolumeProfile(ctx, resultat.donnees as any, chart, series, bougies, script.parametres);
  }

  // 2️⃣ Rendu des primitives graphiques universelles (boîtes, lignes, labels, courbes)
  if (resultat.primitives) {
    dessinerPrimitivesIndicateur(ctx, resultat.primitives, chart, series, bougies);
  }
}

/**
 * Moteur universel de rendu graphique Canvas pour les scripts d'indicateurs.
 * Reçoit les primitives d'un script (boîtes, lignes, labels, courbes)
 * et les projette avec précision sur le canvas de Lightweight Charts.
 * 
 * Exemple :
 * dessinerPrimitivesIndicateur(ctx, resultat.primitives, chart, series, bougies);
 */
export function dessinerPrimitivesIndicateur(
  ctx: CanvasRenderingContext2D,
  primitives: VisualPrimitives | undefined,
  chart: IChartApi,
  series: ISeriesApi<'Candlestick'>,
  bougies: Bougie[]
): void {
  if (!primitives) return;

  const timeScale = chart.timeScale();
  const derniereBougie = bougies.length > 0 ? bougies[bougies.length - 1] : null;
  const xDerniere = derniereBougie ? timeScale.timeToCoordinate(derniereBougie.time as Time) : null;

  ctx.save();

  // 1️⃣ Rendu des Boîtes de Zone (Order Blocks, FVG, Ranges)
  if (primitives.boites && primitives.boites.length > 0) {
    for (const boite of primitives.boites) {
      dessinerBoiteZone(ctx, boite, timeScale, series, xDerniere);
    }
  }

  // 2️⃣ Rendu des Lignes de Structure (BOS, CHoCH, Niveaux clés)
  if (primitives.lignes && primitives.lignes.length > 0) {
    for (const ligne of primitives.lignes) {
      dessinerLigneStructure(ctx, ligne, timeScale, series, xDerniere);
    }
  }

  // 3️⃣ Rendu des Courbes (EMA, SMA, etc.)
  if (primitives.courbes && primitives.courbes.length > 0) {
    for (const courbe of primitives.courbes) {
      dessinerCourbeContinue(ctx, courbe, timeScale, series);
    }
  }

  // 4️⃣ Rendu des Étiquettes Textuelles (Labels, Signaux)
  if (primitives.labels && primitives.labels.length > 0) {
    for (const label of primitives.labels) {
      dessinerEtiquetteLabel(ctx, label, timeScale, series);
    }
  }

  ctx.restore();
}

/**
 * Dessine une boîte rectangulaire de zone (Order Block, FVG, etc.)
 */
function dessinerBoiteZone(
  ctx: CanvasRenderingContext2D,
  boite: VisualBox,
  timeScale: any,
  series: ISeriesApi<'Candlestick'>,
  xDerniere: number | null
): void {
  const xDebut = timeScale.timeToCoordinate(boite.dateDebut as Time);
  const xFin = boite.dateFin ? timeScale.timeToCoordinate(boite.dateFin as Time) : xDerniere;
  const yHaut = series.priceToCoordinate(boite.prixHaut);
  const yBas = series.priceToCoordinate(boite.prixBas);

  if (xDebut === null || yHaut === null || yBas === null) return;

  const x1 = Math.min(xDebut, xFin ?? xDebut + 50);
  const x2 = Math.max(xDebut, xFin ?? xDebut + 50);
  const largeur = Math.max(8, x2 - x1);

  const yTop = Math.min(yHaut, yBas);
  const hauteur = Math.max(3, Math.abs(yBas - yHaut));

  // Fond de la boîte
  ctx.fillStyle = boite.couleurFond || 'rgba(38, 166, 154, 0.2)';
  ctx.fillRect(x1, yTop, largeur, hauteur);

  // Bordure
  ctx.strokeStyle = boite.couleurBordure || '#26a69a';
  ctx.lineWidth = 1;
  ctx.strokeRect(x1, yTop, largeur, hauteur);

  // Label textuel discret dans le coin
  if (boite.label && largeur > 25) {
    ctx.font = 'bold 9px monospace';
    ctx.fillStyle = boite.couleurBordure || '#ffffff';
    ctx.fillText(boite.label, x1 + 4, yTop + 10);
  }
}

/**
 * Dessine une ligne de structure avec style (solid, dashed, dotted) et étiquette
 */
function dessinerLigneStructure(
  ctx: CanvasRenderingContext2D,
  ligne: VisualLine,
  timeScale: any,
  series: ISeriesApi<'Candlestick'>,
  xDerniere: number | null
): void {
  const xDebut = timeScale.timeToCoordinate(ligne.dateDebut as Time);
  const xFin = ligne.dateFin ? timeScale.timeToCoordinate(ligne.dateFin as Time) : xDerniere;
  const y1 = series.priceToCoordinate(ligne.prix);
  const y2 = ligne.prixFin !== undefined ? series.priceToCoordinate(ligne.prixFin) : y1;

  if (xDebut === null || y1 === null || y2 === null) return;

  const x1 = xDebut;
  const x2 = xFin !== null ? xFin : x1 + 100;

  ctx.beginPath();
  ctx.strokeStyle = ligne.couleur || '#2962ff';
  ctx.lineWidth = ligne.epaisseur || 1.5;

  if (ligne.style === 'dashed') {
    ctx.setLineDash([5, 3]);
  } else if (ligne.style === 'dotted') {
    ctx.setLineDash([2, 2]);
  } else {
    ctx.setLineDash([]);
  }

  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Étiquette au-dessus ou au milieu de la ligne (horizontale ou oblique)
  if (ligne.label) {
    ctx.font = 'bold 9.5px sans-serif';
    ctx.fillStyle = ligne.couleur || '#ffffff';
    const milX = (x1 + x2) / 2;
    const milY = (y1 + y2) / 2;
    ctx.fillText(ligne.label, milX - 15, milY - 4);
  }
}

/**
 * Dessine une étiquette textuelle (ex: HH, HL, signal)
 */
function dessinerEtiquetteLabel(
  ctx: CanvasRenderingContext2D,
  label: VisualLabel,
  timeScale: any,
  series: ISeriesApi<'Candlestick'>
): void {
  const x = timeScale.timeToCoordinate(label.date as Time);
  const y = series.priceToCoordinate(label.prix);

  if (x === null || y === null) return;

  const estAuDessus = label.position !== 'below';
  const yCible = estAuDessus ? y - 12 : y + 16;

  ctx.font = 'bold 9.5px monospace';
  const largeurTexte = ctx.measureText(label.texte).width;

  // Fond du badge (si spécifié)
  if (label.couleurFond) {
    ctx.fillStyle = label.couleurFond;
    ctx.fillRect(x - largeurTexte / 2 - 3, yCible - 8, largeurTexte + 6, 12);
  }

  // Texte
  ctx.fillStyle = label.couleur || '#ffffff';
  ctx.fillText(label.texte, x - largeurTexte / 2, yCible);
}

/**
 * Dessine une courbe continue (ex: EMA 20, SMA 50)
 */
function dessinerCourbeContinue(
  ctx: CanvasRenderingContext2D,
  courbe: VisualCurve,
  timeScale: any,
  series: ISeriesApi<'Candlestick'>
): void {
  if (!courbe.points || courbe.points.length < 2) return;

  ctx.beginPath();
  ctx.strokeStyle = courbe.couleur || '#2962ff';
  ctx.lineWidth = 1.5;

  let premier = true;
  for (const pt of courbe.points) {
    const x = timeScale.timeToCoordinate(pt.time as Time);
    const y = series.priceToCoordinate(pt.value);

    if (x === null || y === null) continue;

    if (premier) {
      ctx.moveTo(x, y);
      premier = false;
    } else {
      ctx.lineTo(x, y);
    }
  }

  ctx.stroke();
}
