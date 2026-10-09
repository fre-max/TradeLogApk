import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import type { Bougie } from '@/lib/chartDataHelper';
import type { VisualPrimitives, VisualBox, VisualLine, VisualLabel, VisualCurve, VisualPoint, IndicatorExecutionResult, IndicatorScript } from '@/types/indicatorScript';
import { dessinerLuxAlgoSMC } from './luxAlgoSMCRenderer';
import { dessinerProtectedSwings } from './protectedSwingsRenderer';
import { dessinerZigZag } from './zigzagRenderer';
import { dessinerUnmitigatedVolumeProfile } from './unmitigatedVolumeProfileRenderer';
import { dessinerUnmitigatedOverlapProfile } from '@/lib/bot/modules';

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
  } else if (resultat.typeSpecial === 'unmitigated-overlap-profile' && resultat.donnees) {
    dessinerUnmitigatedOverlapProfile(ctx, resultat.donnees as any, chart, series, bougies, script.parametres);
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
      dessinerBoiteZone(ctx, boite, timeScale, series, xDerniere, bougies);
    }
  }

  // 2️⃣ Rendu des Lignes de Structure (BOS, CHoCH, Niveaux clés)
  if (primitives.lignes && primitives.lignes.length > 0) {
    for (const ligne of primitives.lignes) {
      dessinerLigneStructure(ctx, ligne, timeScale, series, xDerniere, bougies);
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
      dessinerEtiquetteLabel(ctx, label, timeScale, series, bougies);
    }
  }

  // 5️⃣ Rendu des Points Discrets (ex: Points sur les bougies mères)
  if (primitives.points && primitives.points.length > 0) {
    for (const pt of primitives.points) {
      dessinerPointDiscret(ctx, pt, timeScale, series, bougies);
    }
  }

  ctx.restore();
}

/**
 * Calcule la coordonnée X sur le canvas pour une date donnée.
 * Si la date ne correspond pas exactement à une bougie HTF (ex: bougie M15 projetée sur H4)
 * ou si le niveau a été créé avant la première bougie affichée,
 * trouve intelligemment la position X correspondante sans jamais masquer le support/résistance.
 */
function obtenirXPourTemps(
  timeScale: any,
  dateTemps: string | number,
  bougies: Bougie[]
): number | null {
  // 1️⃣ Tentative directe via le moteur Lightweight Charts
  const coordDirecte = timeScale.timeToCoordinate(dateTemps as Time);
  if (coordDirecte !== null) return coordDirecte;

  if (!bougies || bougies.length === 0) return null;

  const tSec = typeof dateTemps === 'number'
    ? dateTemps
    : Math.floor(Date.parse(dateTemps) / 1000);

  const premiere = bougies[0];
  const tPremiere: number = typeof premiere.time === 'number'
    ? premiere.time
    : Math.floor(Date.parse(premiere.time as string) / 1000);

  // 2️⃣ Si le niveau a été créé dans le passé avant la première bougie visible,
  // on l'ancre au début de l'écran visible pour que le trader voie la ligne sur tout le graphique
  if (tSec <= tPremiere) {
    const xPremiere = timeScale.timeToCoordinate(premiere.time as Time);
    return xPremiere !== null ? xPremiere : 0;
  }

  const derniere = bougies[bougies.length - 1];
  const tDerniere: number = typeof derniere.time === 'number'
    ? derniere.time
    : Math.floor(Date.parse(derniere.time as string) / 1000);

  // 3️⃣ Si le temps est postérieur à la dernière bougie, ancre sur la dernière
  if (tSec >= tDerniere) {
    return timeScale.timeToCoordinate(derniere.time as Time);
  }

  // 4️⃣ Interpolation intelligente : trouve la bougie HTF contenant cette date LTF (la plus proche <= tSec)
  let indexProche = -1;
  for (let i = 0; i < bougies.length; i++) {
    const timeVal = bougies[i].time;
    const tB: number = typeof timeVal === 'number'
      ? timeVal
      : Math.floor(Date.parse(timeVal as string) / 1000);
    if (tB <= tSec) {
      indexProche = i;
    } else {
      break;
    }
  }

  if (indexProche !== -1) {
    return timeScale.timeToCoordinate(bougies[indexProche].time as Time);
  }

  return null;
}

/**
 * Dessine une boîte rectangulaire de zone (Order Block, FVG, etc.)
 */
function dessinerBoiteZone(
  ctx: CanvasRenderingContext2D,
  boite: VisualBox,
  timeScale: any,
  series: ISeriesApi<'Candlestick'>,
  xDerniere: number | null,
  bougies: Bougie[]
): void {
  const xDebut = obtenirXPourTemps(timeScale, boite.dateDebut, bougies);
  const xFin = boite.dateFin ? obtenirXPourTemps(timeScale, boite.dateFin, bougies) : xDerniere;
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
  xDerniere: number | null,
  bougies: Bougie[]
): void {
  const xDebut = obtenirXPourTemps(timeScale, ligne.dateDebut, bougies);
  const xFin = ligne.dateFin ? obtenirXPourTemps(timeScale, ligne.dateFin, bougies) : xDerniere;
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
 * Dessine une étiquette textuelle (ex: HH, HL, signaux, figures en chandeliers)
 * Supporte automatiquement les textes multi-lignes séparés par \n (ex: "Bearish\nHarami")
 */
function dessinerEtiquetteLabel(
  ctx: CanvasRenderingContext2D,
  label: VisualLabel,
  timeScale: any,
  series: ISeriesApi<'Candlestick'>,
  bougies: Bougie[]
): void {
  const x = obtenirXPourTemps(timeScale, label.date, bougies);
  const y = series.priceToCoordinate(label.prix);

  if (x === null || y === null) return;

  const texte = String(label.texte || '');
  const lignes = texte.split('\n');
  const estAuDessus = label.position !== 'below';

  ctx.font = 'bold 9.5px monospace';
  const hauteurLigne = 11;
  const totalHauteur = lignes.length * hauteurLigne;

  // Calcul de la largeur maximale parmi toutes les lignes du label
  let largeurMax = 0;
  for (const ligne of lignes) {
    const w = ctx.measureText(ligne).width;
    if (w > largeurMax) largeurMax = w;
  }

  // Détermination de la position verticale Y
  const yDepart = estAuDessus
    ? y - 10 - totalHauteur + hauteurLigne
    : y + 16;

  // Fond du badge (si spécifié)
  if (label.couleurFond) {
    ctx.fillStyle = label.couleurFond;
    const yFond = estAuDessus ? y - 10 - totalHauteur : y + 6;
    ctx.fillRect(x - largeurMax / 2 - 3, yFond, largeurMax + 6, totalHauteur + 4);
  }

  // Dessin de chaque ligne de texte centrée
  ctx.fillStyle = label.couleur || '#ffffff';
  for (let idx = 0; idx < lignes.length; idx++) {
    const ligne = lignes[idx];
    const w = ctx.measureText(ligne).width;
    ctx.fillText(ligne, x - w / 2, yDepart + idx * hauteurLigne);
  }
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

/**
 * Dessine un point discret et net sur une bougie (ex: bougie mère).
 * Évite de surcharger le graphique avec des boîtes ou des textes encombrants.
 * 
 * Exemple :
 * dessinerPointDiscret(ctx, pt, timeScale, series, bougies);
 */
function dessinerPointDiscret(
  ctx: CanvasRenderingContext2D,
  point: VisualPoint,
  timeScale: any,
  series: ISeriesApi<'Candlestick'>,
  bougies: Bougie[]
): void {
  const x = obtenirXPourTemps(timeScale, point.date, bougies);
  const y = series.priceToCoordinate(point.prix);

  if (x === null || y === null) return;

  const rayon = point.rayon || 4;
  const couleur = point.couleur || '#0ea5e9';

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, rayon, 0, Math.PI * 2);

  if (point.style === 'contour') {
    ctx.strokeStyle = couleur;
    ctx.lineWidth = 2;
    ctx.stroke();
  } else {
    // Point plein avec fine bordure blanche pour détachement visuel parfait
    ctx.fillStyle = couleur;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  ctx.restore();
}

