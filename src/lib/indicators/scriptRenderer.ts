import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import type { Bougie } from '@/lib/chartDataHelper';
import type { VisualPrimitives, VisualBox, VisualLine, VisualLabel, VisualCurve, VisualPoint, IndicatorExecutionResult, IndicatorScript } from '@/types/indicatorScript';
import type { SetupOrchestreSMC } from './favoris/orchestrateurSMC';
import type { SignalSandboxPlage, ZoneShvedAvecScore } from './favoris/sandboxDojiShvedPlage';
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

/**
 * ⛰️ Dessine directement sur le graphique les collines de retest validées (avec leur hauteur en ATR,
 * leur largeur en bougies et leurs points attribués) ainsi que les micro-rebonds ignorés/fusionnés.
 *
 * Pourquoi cette fonction existe :
 * Permet à l'utilisateur de vérifier visuellement pourquoi un retour sur S/R a été compté comme
 * un vrai retest (vraie colline >= 1.5x ATR sur >= 2 bougies) ou ignoré (simple mèche / micro-rebond).
 */
function dessinerCollinesEtTouchesZoneSR(
  ctx: CanvasRenderingContext2D,
  zoneScoree: ZoneShvedAvecScore,
  timeScale: ReturnType<IChartApi['timeScale']>,
  series: ISeriesApi<'Candlestick'>,
  bougies: Bougie[]
): void {
  const yZone = series.priceToCoordinate(zoneScoree.zone.prixMedian);
  if (yZone === null) return;

  const estSupport = zoneScoree.zone.type === 'SUPPORT';
  const collines = zoneScoree.collinesRetests || [];
  const ignorees = zoneScoree.touchesIgnorees || [];

  // 1️⃣ Tracé des VRAIES COLLINES de retest validées
  for (const colline of collines) {
    const xDepart = obtenirXPourTemps(timeScale, colline.tempsTouchePrecedente, bougies);
    const xSommet = obtenirXPourTemps(timeScale, colline.tempsSommetColline, bougies);
    const xRetest = obtenirXPourTemps(timeScale, colline.tempsToucheRetest, bougies);
    const ySommet = series.priceToCoordinate(colline.prixSommetColline);

    if (xSommet === null || xRetest === null || ySommet === null) continue;

    // Couleur selon l'ampleur de la colline (MAJEURE = Or, SOLIDE = Émeraude, MINEURE = Cyan)
    const couleurColline =
      colline.qualite === 'MAJEURE'
        ? '#FBBF24'
        : colline.qualite === 'SOLIDE'
          ? '#10B981'
          : '#38BDF8';
    const couleurFondColline =
      colline.qualite === 'MAJEURE'
        ? 'rgba(251, 191, 36, 0.14)'
        : colline.qualite === 'SOLIDE'
          ? 'rgba(16, 185, 129, 0.14)'
          : 'rgba(56, 189, 248, 0.12)';

    // A. Triangle / Arche matérialisant la colline entre les deux touches
    if (xDepart !== null) {
      ctx.beginPath();
      ctx.moveTo(xDepart, yZone);
      ctx.lineTo(xSommet, ySommet);
      ctx.lineTo(xRetest, yZone);
      ctx.closePath();
      ctx.fillStyle = couleurFondColline;
      ctx.fill();

      ctx.beginPath();
      ctx.strokeStyle = couleurColline;
      ctx.lineWidth = 1.6;
      ctx.setLineDash([4, 3]);
      ctx.moveTo(xDepart, yZone);
      ctx.lineTo(xSommet, ySommet);
      ctx.lineTo(xRetest, yZone);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // B. Point au sommet de la colline
    ctx.beginPath();
    ctx.arc(xSommet, ySommet, 4, 0, Math.PI * 2);
    ctx.fillStyle = couleurColline;
    ctx.fill();
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // C. Point d'impact du Retest sur la zone S/R
    ctx.beginPath();
    ctx.arc(xRetest, yZone, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = couleurColline;
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // D. Étiquette au sommet de la colline indiquant sa taille et ses points
    const texteColline = `⛰️ R#${colline.numeroRetest} : ${colline.ratioCollineATR}x ATR (${colline.largeurBougies}b) [+${colline.pointsAttribues}pts]`;
    ctx.font = 'bold 9px sans-serif';
    const wColline = ctx.measureText(texteColline).width;
    const xBadge = xSommet - wColline / 2 - 5;
    const yBadge = estSupport ? ySommet - 19 : ySommet + 5;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.fillRect(xBadge, yBadge, wColline + 10, 15);
    ctx.strokeStyle = couleurColline;
    ctx.lineWidth = 1;
    ctx.strokeRect(xBadge, yBadge, wColline + 10, 15);

    ctx.fillStyle = couleurColline;
    ctx.fillText(texteColline, xBadge + 5, yBadge + 11);
  }

  // 2️⃣ Tracé des MICRO-REBONDS ignorés / fusionnés (limité aux 4 derniers pour éviter toute surcharge)
  const ignoreesAffichees = ignorees.slice(-4);
  for (const ign of ignoreesAffichees) {
    const xIgn = obtenirXPourTemps(timeScale, ign.temps, bougies);
    if (xIgn === null) continue;

    // Petit cercle gris ardoise sur la zone indiquant la fusion
    ctx.beginPath();
    ctx.arc(xIgn, yZone, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1;
    ctx.stroke();

    const texteIgn = `⚪ Ignoré (${ign.ratioCollineATR}x ATR, ${ign.largeurBougies}b)`;
    ctx.font = '8.5px sans-serif';
    const wIgn = ctx.measureText(texteIgn).width;
    const xBadgeIgn = xIgn - wIgn / 2 - 4;
    const yBadgeIgn = estSupport ? yZone + 6 : yZone - 18;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(xBadgeIgn, yBadgeIgn, wIgn + 8, 13);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(xBadgeIgn, yBadgeIgn, wIgn + 8, 13);

    ctx.fillStyle = '#94A3B8';
    ctx.fillText(texteIgn, xBadgeIgn + 4, yBadgeIgn + 9.5);
  }
}

/**
 * 🔍 Projette sur le canvas la surbrillance temporaire d'un setup SMC sélectionné en diagnostic.
 * Affiche la plage temporelle ciblée, toutes les zones S/R Shved candidates analysées avec leurs scores,
 * ainsi que le tracé complet des paliers UOP.
 */
export function dessinerSurbrillanceDiagnosticSMC(
  ctx: CanvasRenderingContext2D,
  setup: SetupOrchestreSMC,
  chart: IChartApi,
  series: ISeriesApi<'Candlestick'>,
  bougies: Bougie[]
): void {
  if (!setup || !chart || !series) return;
  const timeScale = chart.timeScale();

  const xDoji = obtenirXPourTemps(timeScale, setup.tempsDoji, bougies);
  const xDebutPlage = setup.tempsDebutPlage ? obtenirXPourTemps(timeScale, setup.tempsDebutPlage, bougies) : null;
  const estAchat = setup.type === 'ACHAT';

  ctx.save();

  // ────────────────────────────────────────────────────────────────────────────
  // 1️⃣ Ombrage de la Plage Temporelle Ciblée [DebutPlage ➔ Doji]
  // ────────────────────────────────────────────────────────────────────────────
  if (xDebutPlage !== null && xDoji !== null && xDoji > xDebutPlage) {
    const largeurPlage = xDoji - xDebutPlage;

    // Fond subtil bleuté
    ctx.fillStyle = 'rgba(41, 182, 246, 0.05)';
    ctx.fillRect(xDebutPlage, 0, largeurPlage, ctx.canvas.height);

    // Ligne verticale de début de plage
    ctx.strokeStyle = 'rgba(41, 182, 246, 0.4)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xDebutPlage, 0);
    ctx.lineTo(xDebutPlage, ctx.canvas.height);
    ctx.stroke();

    // Petit badge discret en haut de la plage
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(xDebutPlage + 2, 8, 120, 18);
    ctx.strokeStyle = 'rgba(41, 182, 246, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(xDebutPlage + 2, 8, 120, 18);

    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 9.5px sans-serif';
    ctx.fillText('📍 Début Recherche S/R', xDebutPlage + 8, 20);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 2️⃣ Supports et Résistances Shved analysés (avec changement de couleur net)
  // ────────────────────────────────────────────────────────────────────────────
  // Affiche TOUS les supports et résistances analysés pour ce setup,
  // en distinguant clairement la zone retenue par rapport aux zones rejetées.
  const zones = setup.zonesShvedCandidates || (setup.meilleureZoneShved ? [setup.meilleureZoneShved] : []);
  for (const z of zones) {
    const estRetenue = setup.meilleureZoneShved?.zone.id === z.zone.id;
    const yMed = series.priceToCoordinate(z.zone.prixMedian);
    if (yMed === null) continue;

    const yBas = series.priceToCoordinate(z.zone.prixBas);
    const yHautCoord = series.priceToCoordinate(z.zone.prixHaut);

    const xDebutLigne = obtenirXPourTemps(timeScale, z.zone.dateDebut, bougies) ?? (xDebutPlage ?? 0);
    const xFinLigne = xDoji ?? ctx.canvas.width;
    const largeurZone = Math.max(10, xFinLigne - xDebutLigne);

    const estSupport = z.zone.type === 'SUPPORT';

    // A. Boîte de la zone de prix [prixBas, prixHaut]
    if (yBas !== null && yHautCoord !== null) {
      const yHaut = Math.min(yBas, yHautCoord);
      const hauteurZone = Math.max(4, Math.abs(yBas - yHautCoord));

      if (estRetenue) {
        // ⭐ ZONE RETENUE : Vert émeraude éclatant pour support, Cyan néon pour résistance
        const couleurFond = estSupport ? 'rgba(0, 230, 118, 0.18)' : 'rgba(0, 229, 255, 0.18)';
        const couleurBord = estSupport ? '#00E676' : '#00E5FF';

        ctx.fillStyle = couleurFond;
        ctx.fillRect(xDebutLigne, yHaut, largeurZone, hauteurZone);

        ctx.strokeStyle = couleurBord;
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.strokeRect(xDebutLigne, yHaut, largeurZone, hauteurZone);
      } else {
        // ZONES ÉCARTÉES : Gris ardoise discret et atténué
        ctx.fillStyle = 'rgba(148, 163, 184, 0.06)';
        ctx.fillRect(xDebutLigne, yHaut, largeurZone, hauteurZone);

        ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(xDebutLigne, yHaut, largeurZone, hauteurZone);
      }
    }

    // B. Ligne médiane
    ctx.beginPath();
    if (estRetenue) {
      ctx.strokeStyle = estSupport ? '#00E676' : '#00E5FF';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
    } else {
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
    }
    ctx.moveTo(xDebutLigne, yMed);
    ctx.lineTo(xFinLigne, yMed);
    ctx.stroke();

    // C. Badge d'identification du Support / Résistance
    ctx.setLineDash([]);
    if (estRetenue) {
      // Badge très visible pour la zone retenue
      const texteRetenu = `⭐ ${estSupport ? 'SUPPORT' : 'RÉSISTANCE'} UTILISÉ [${z.score} pts]`;
      ctx.font = 'bold 10px sans-serif';
      const wTexte = ctx.measureText(texteRetenu).width;

      const badgeX = xDebutLigne + 4;
      const badgeY = yMed - 18;

      ctx.fillStyle = estSupport ? 'rgba(6, 44, 24, 0.92)' : 'rgba(8, 47, 73, 0.92)';
      ctx.fillRect(badgeX, badgeY, wTexte + 12, 16);

      ctx.strokeStyle = estSupport ? '#00E676' : '#00E5FF';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(badgeX, badgeY, wTexte + 12, 16);

      ctx.fillStyle = estSupport ? '#00E676' : '#00E5FF';
      ctx.fillText(texteRetenu, badgeX + 6, badgeY + 12);

      // ⛰️ Affichage visuel des vraies collines de retest et des micro-rebonds ignorés sur la zone retenue
      dessinerCollinesEtTouchesZoneSR(ctx, z, timeScale, series, bougies);
    } else {
      // Badge discret pour les zones candidates écartées
      const texteEcarte = `${estSupport ? 'Support' : 'Résistance'} écarté (${z.score} pts)`;
      ctx.font = '9px sans-serif';
      const wTexte = ctx.measureText(texteEcarte).width;

      const badgeX = xDebutLigne + 4;
      const badgeY = yMed - 15;

      ctx.fillStyle = 'rgba(30, 41, 59, 0.8)';
      ctx.fillRect(badgeX, badgeY, wTexte + 8, 13);

      ctx.fillStyle = '#94A3B8';
      ctx.fillText(texteEcarte, badgeX + 4, badgeY + 10);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 3️⃣ Quantité de Liquidité Balayée / Score ZigZag Dynamique (/100) au Doji
  // ────────────────────────────────────────────────────────────────────────────
  const carburant = setup.carburantInitial ?? setup.detailsCarburant?.carburantTotal ?? 0;
  const infoScoreZZ = setup.detailsScoreLiquidationZigZag;

  // 🌊 A. Tracé visuel des vagues ZigZag dynamiques retenues sur les bougies
  if (infoScoreZZ?.pivotsZigZag && infoScoreZZ.pivotsZigZag.length >= 2) {
    const coordsPivots: { x: number; y: number; prix: number; type: 'HIGH' | 'LOW' }[] = [];
    for (const piv of infoScoreZZ.pivotsZigZag) {
      const xPiv = obtenirXPourTemps(timeScale, piv.temps, bougies);
      const yPiv = series.priceToCoordinate(piv.prix);
      if (xPiv !== null && yPiv !== null) {
        coordsPivots.push({ x: xPiv, y: yPiv, prix: piv.prix, type: piv.type });
      }
    }

    if (coordsPivots.length >= 2) {
      // Ligne brisée reliant les pivots ZigZag
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.85)'; // Violet lumineux pour distinguer les vagues ZigZag
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.moveTo(coordsPivots[0].x, coordsPivots[0].y);
      for (let i = 1; i < coordsPivots.length; i++) {
        ctx.lineTo(coordsPivots[i].x, coordsPivots[i].y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Points aux sommets/creux des vagues ZigZag
      for (let i = 0; i < coordsPivots.length; i++) {
        const pt = coordsPivots[i];
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = pt.type === 'HIGH' ? '#C084FC' : '#38BDF8';
        ctx.fill();
        ctx.strokeStyle = '#0F172A';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      // Étiquette sur le premier segment de vague ZigZag visible
      const milieuX = (coordsPivots[0].x + coordsPivots[1].x) / 2;
      const milieuY = (coordsPivots[0].y + coordsPivots[1].y) / 2;
      const texteVague = `🌊 ZigZag Dynamique (Depth: ${infoScoreZZ.zigzagDepthRetenu})`;
      ctx.font = 'bold 9px sans-serif';
      const wVague = ctx.measureText(texteVague).width;
      ctx.fillStyle = 'rgba(30, 27, 75, 0.90)';
      ctx.fillRect(milieuX - wVague / 2 - 5, milieuY - 10, wVague + 10, 15);
      ctx.strokeStyle = '#A855F7';
      ctx.lineWidth = 1;
      ctx.strokeRect(milieuX - wVague / 2 - 5, milieuY - 10, wVague + 10, 15);
      ctx.fillStyle = '#E9D5FF';
      ctx.fillText(texteVague, milieuX - wVague / 2, milieuY + 1);
    }
  }

  // ⚡ B. Badge d'information de liquidité & Score ZigZag au niveau du Doji
  if (xDoji !== null && (carburant > 0 || infoScoreZZ)) {
    const ySL = series.priceToCoordinate(setup.prixSL);
    if (ySL !== null) {
      // Halo d'énergie de liquidation
      ctx.beginPath();
      ctx.arc(xDoji, ySL, 8, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(245, 158, 11, 0.25)';
      ctx.fill();

      const badgeLiqX = xDoji + 10;
      const badgeLiqY = estAchat ? ySL + 8 : ySL - 42;
      const texteLiq1 = infoScoreZZ
        ? `⚡ Score Liq : ${infoScoreZZ.scoreTotal}/100 ➔ ZigZag Depth : ${infoScoreZZ.zigzagDepthRetenu} (Carburant: ${carburant}pts)`
        : `⚡ Liquidation : ${carburant} pts pris`;
      const texteLiq2 = infoScoreZZ
        ? `Cassure: ${infoScoreZZ.pointsProfondeurCassure}/40 (${infoScoreZZ.ratioProfondeurATR}x ATR) | Bougie+S/R: ${infoScoreZZ.pointsTailleBougieEtZone}/30 | Retests: ${infoScoreZZ.pointsRetestsSR}/30 (${infoScoreZZ.nombreRetests}x)`
        : '';

      ctx.font = 'bold 10px sans-serif';
      const wLiq1 = ctx.measureText(texteLiq1).width;
      ctx.font = '9px sans-serif';
      const wLiq2 = texteLiq2 ? ctx.measureText(texteLiq2).width : 0;
      const wBoiteLiq = Math.max(wLiq1, wLiq2) + 14;
      const hBoiteLiq = texteLiq2 ? 32 : 18;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      ctx.fillRect(badgeLiqX, badgeLiqY, wBoiteLiq, hBoiteLiq);

      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(badgeLiqX, badgeLiqY, wBoiteLiq, hBoiteLiq);

      ctx.font = 'bold 10px sans-serif';
      ctx.fillStyle = '#FBBF24';
      ctx.fillText(texteLiq1, badgeLiqX + 7, badgeLiqY + 13);

      if (texteLiq2) {
        ctx.font = '9px sans-serif';
        ctx.fillStyle = '#E2E8F0';
        ctx.fillText(texteLiq2, badgeLiqX + 7, badgeLiqY + 26);
      }
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 4️⃣ Profil de Chevauchement UOP & Détermination Profonde du TP (100% VISUEL)
  // ────────────────────────────────────────────────────────────────────────────
  const xDebutTrade = xDoji ?? 0;
  const xFinTrade = Math.min(ctx.canvas.width - 20, xDebutTrade + 260);

  const yEntree = series.priceToCoordinate(setup.prixEntree);
  const ySL = series.priceToCoordinate(setup.prixSL);
  const yTP = setup.prixTP !== undefined ? series.priceToCoordinate(setup.prixTP) : null;
  const debugTP = setup.tpSelectionne?.debug;

  // A. Tracé des tronçons goudronnés (blocs d'overlap dense Sweep UOP : A, B, C...)
  if (debugTP && debugTP.troncons && debugTP.troncons.length > 0) {
    const xBlocDebut = xDebutTrade + 15;
    const xBlocFin = Math.min(ctx.canvas.width - 30, xDebutTrade + 220);
    const largeurBloc = Math.max(40, xBlocFin - xBlocDebut);

    for (const troncon of debugTP.troncons) {
      const yTBas = series.priceToCoordinate(troncon.prixBas);
      const yTHaut = series.priceToCoordinate(troncon.prixHaut);
      if (yTBas === null || yTHaut === null) continue;

      const yHautReel = Math.min(yTBas, yTHaut);
      const hauteurReelle = Math.max(3, Math.abs(yTBas - yTHaut));

      // 🛣️ Fond bleu azur institutionnel pour la zone goudronnée
      ctx.fillStyle = 'rgba(2, 132, 199, 0.14)';
      ctx.fillRect(xBlocDebut, yHautReel, largeurBloc, hauteurReelle);

      // Bordure fine
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 2]);
      ctx.strokeRect(xBlocDebut, yHautReel, largeurBloc, hauteurReelle);

      // Liseré latéral gauche pour matérialiser la route
      ctx.fillStyle = '#0284C7';
      ctx.fillRect(xBlocDebut, yHautReel, 3, hauteurReelle);

      // Badge du tronçon goudronné
      ctx.setLineDash([]);
      ctx.font = 'bold 9px sans-serif';
      const labelTroncon = `🛣️ Bloc Overlap [${troncon.lettre}] : ${troncon.prixBas.toFixed(4)} ➔ ${troncon.prixHaut.toFixed(4)} (${troncon.sommeBougies}b)`;
      const wL = ctx.measureText(labelTroncon).width;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(xBlocDebut + 6, yHautReel + 2, wL + 8, 13);
      ctx.fillStyle = '#38BDF8';
      ctx.fillText(labelTroncon, xBlocDebut + 10, yHautReel + 11);
    }

    // B. Tracé des creux (trous) : Creux <= 5% (Absorbés) vs Creux > 5% (Rupture)
    if (debugTP.trous && debugTP.trous.length > 0) {
      for (const trou of debugTP.trous) {
        const yCrBas = series.priceToCoordinate(trou.prixBas);
        const yCrHaut = series.priceToCoordinate(trou.prixHaut);
        if (yCrBas === null || yCrHaut === null) continue;

        const yTrouHaut = Math.min(yCrBas, yCrHaut);
        const hauteurTrou = Math.max(2, Math.abs(yCrBas - yCrHaut));

        if (trou.estAbsorbe) {
          // ⚡ CREUX INFÉRIEUR AUX 5% (ABSORBÉ PAR LA FORMULE DE CUMUL DE LA ROUTE)
          ctx.fillStyle = 'rgba(245, 158, 11, 0.16)';
          ctx.fillRect(xBlocDebut, yTrouHaut, largeurBloc, hauteurTrou);

          // Tirets ambrés
          ctx.strokeStyle = '#F59E0B';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.moveTo(xBlocDebut, yTrouHaut);
          ctx.lineTo(xBlocFin, yTrouHaut);
          ctx.moveTo(xBlocDebut, yTrouHaut + hauteurTrou);
          ctx.lineTo(xBlocFin, yTrouHaut + hauteurTrou);
          ctx.stroke();

          // Badge explicatif
          ctx.setLineDash([]);
          ctx.font = 'bold 9.5px sans-serif';
          const labelTrou = `⚡ Creux ${trou.ratioPourcent}% <= 5% : ABSORBÉ (Route continue)`;
          const wT = ctx.measureText(labelTrou).width;

          ctx.fillStyle = 'rgba(41, 24, 4, 0.92)';
          ctx.fillRect(xBlocDebut + 12, yTrouHaut + Math.max(0, (hauteurTrou - 15) / 2), wT + 8, 15);
          ctx.strokeStyle = '#F59E0B';
          ctx.lineWidth = 1;
          ctx.strokeRect(xBlocDebut + 12, yTrouHaut + Math.max(0, (hauteurTrou - 15) / 2), wT + 8, 15);

          ctx.fillStyle = '#FBBF24';
          ctx.fillText(labelTrou, xBlocDebut + 16, yTrouHaut + Math.max(0, (hauteurTrou - 15) / 2) + 11);
        } else {
          // 🛑 CREUX SUPÉRIEUR AUX 5% (RUPTURE NETTE DE L'AUTOROUTE ➔ ANCRAGE DU TP)
          ctx.fillStyle = 'rgba(239, 68, 68, 0.18)';
          ctx.fillRect(xBlocDebut, yTrouHaut, largeurBloc, hauteurTrou);

          ctx.strokeStyle = '#EF4444';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([5, 3]);
          ctx.strokeRect(xBlocDebut, yTrouHaut, largeurBloc, hauteurTrou);

          // Badge d'alerte de rupture
          ctx.setLineDash([]);
          ctx.font = 'bold 10px sans-serif';
          const labelRupture = `🛑 Rupture ${trou.ratioPourcent}% > 5% : Arrêt route ➔ TP ancré`;
          const wR = ctx.measureText(labelRupture).width;

          ctx.fillStyle = 'rgba(69, 10, 10, 0.94)';
          ctx.fillRect(xBlocDebut + 12, yTrouHaut + Math.max(0, (hauteurTrou - 16) / 2), wR + 10, 16);
          ctx.strokeStyle = '#EF4444';
          ctx.lineWidth = 1.2;
          ctx.strokeRect(xBlocDebut + 12, yTrouHaut + Math.max(0, (hauteurTrou - 16) / 2), wR + 10, 16);

          ctx.fillStyle = '#FCA5A5';
          ctx.fillText(labelRupture, xBlocDebut + 17, yTrouHaut + Math.max(0, (hauteurTrou - 16) / 2) + 12);
        }
      }
    }
  }

  // C. Paliers UOP standards (si pas de debug détaillé ou en complément de trajectoire)
  const etapesUOP = setup.etapesPaliersUOP || [];
  for (const etape of etapesUOP) {
    const yPalier = series.priceToCoordinate(etape.prixCible);
    if (yPalier === null) continue;

    const xDebutPalier = xDoji ?? 0;
    const xFinPalier = Math.min(ctx.canvas.width - 20, xDebutPalier + 160);

    ctx.beginPath();
    ctx.strokeStyle = etape.estBloquant ? '#F97316' : '#38BDF8';
    ctx.lineWidth = etape.estBloquant ? 2 : 1.2;
    ctx.setLineDash(etape.estBloquant ? [6, 3] : [3, 3]);
    ctx.moveTo(xDebutPalier, yPalier);
    ctx.lineTo(xFinPalier, yPalier);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.font = 'bold 9px sans-serif';
    const labelPalier = etape.estBloquant
      ? `🛑 Mur Overlap P${etape.ordre} [${etape.tauxChevauchement}x] (-${etape.peagePalier}pts)`
      : `✓ Palier P${etape.ordre} [${etape.tauxChevauchement}x] (${etape.budgetApres}pts restant)`;

    const wLabel = ctx.measureText(labelPalier).width;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.fillRect(xFinPalier - wLabel - 6, yPalier - 13, wLabel + 8, 14);

    ctx.fillStyle = etape.estBloquant ? '#FB923C' : '#38BDF8';
    ctx.fillText(labelPalier, xFinPalier - wLabel - 2, yPalier - 2);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 5️⃣ Take Profit (TP) Optimal et Stop Loss (SL) du Setup
  // ────────────────────────────────────────────────────────────────────────────

  // A. Ligne et Zone de Stop Loss (SL)
  if (ySL !== null && yEntree !== null) {
    // Ombrage rouge de risque
    const yHautSL = Math.min(yEntree, ySL);
    const hautSL = Math.max(2, Math.abs(yEntree - ySL));
    ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
    ctx.fillRect(xDebutTrade, yHautSL, xFinTrade - xDebutTrade, hautSL);

    // Ligne SL
    ctx.beginPath();
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([5, 3]);
    ctx.moveTo(xDebutTrade, ySL);
    ctx.lineTo(xFinTrade, ySL);
    ctx.stroke();

    // Badge SL
    ctx.setLineDash([]);
    const texteSL = `🛑 SL : ${setup.prixSL.toFixed(2)}`;
    ctx.font = 'bold 9.5px sans-serif';
    const wSL = ctx.measureText(texteSL).width;

    ctx.fillStyle = 'rgba(69, 10, 10, 0.9)';
    ctx.fillRect(xFinTrade - wSL - 8, ySL - 14, wSL + 8, 15);
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 1;
    ctx.strokeRect(xFinTrade - wSL - 8, ySL - 14, wSL + 8, 15);

    ctx.fillStyle = '#FCA5A5';
    ctx.fillText(texteSL, xFinTrade - wSL - 4, ySL - 2);
  }

  // B. Ligne et Zone de Take Profit Optimal (TP)
  if (yTP !== null && yEntree !== null) {
    // Ombrage vert de profit
    const yHautTP = Math.min(yEntree, yTP);
    const hautTP = Math.max(2, Math.abs(yEntree - yTP));
    ctx.fillStyle = 'rgba(0, 230, 118, 0.09)';
    ctx.fillRect(xDebutTrade, yHautTP, xFinTrade - xDebutTrade, hautTP);

    // Ligne TP continue bien nette
    ctx.beginPath();
    ctx.strokeStyle = '#00E676';
    ctx.lineWidth = 2.2;
    ctx.setLineDash([]);
    ctx.moveTo(xDebutTrade, yTP);
    ctx.lineTo(xFinTrade, yTP);
    ctx.stroke();

    // Badge Take Profit lumineux
    const texteTP = `🎯 TP OPTIMAL (UOP) : ${setup.prixTP?.toFixed(2)} (${setup.ratioRR}R)`;
    ctx.font = 'bold 10.5px sans-serif';
    const wTP = ctx.measureText(texteTP).width;

    ctx.fillStyle = 'rgba(6, 44, 24, 0.95)';
    ctx.fillRect(xFinTrade - wTP - 10, yTP - 16, wTP + 10, 18);
    ctx.strokeStyle = '#00E676';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(xFinTrade - wTP - 10, yTP - 16, wTP + 10, 18);

    ctx.fillStyle = '#69F0AE';
    ctx.fillText(texteTP, xFinTrade - wTP - 5, yTP - 3);

    // ────────────────────────────────────────────────────────────────────────────
    // 🚀 VECTEUR DE TRAJECTOIRE D'ÉNERGIE (FLÈCHE DE PROGRESSION ENTRE LES PALIERS)
    // ────────────────────────────────────────────────────────────────────────────
    // Matérialise l'ascension du trade depuis l'Entrée jusqu'au TP en traversant chaque palier
    const xTrajectoire = xDebutTrade + 28;
    const directionHaut = yTP < yEntree; // En pixel, monter = y diminue

    // Faisceau lumineux vertical
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(0, 230, 118, 0.5)';
    ctx.lineWidth = 3;
    ctx.setLineDash([]);
    ctx.moveTo(xTrajectoire, yEntree);
    ctx.lineTo(xTrajectoire, yTP);
    ctx.stroke();

    // Nœud lumineux de départ (Entrée)
    ctx.beginPath();
    ctx.arc(xTrajectoire, yEntree, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#00E676';
    ctx.fill();

    // Nœuds lumineux pour chaque palier UOP traversé sur la trajectoire
    for (const etape of etapesUOP) {
      const yP = series.priceToCoordinate(etape.prixCible);
      if (yP !== null) {
        ctx.beginPath();
        ctx.arc(xTrajectoire, yP, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = etape.estBloquant ? '#F97316' : '#38BDF8';
        ctx.fill();
        ctx.strokeStyle = '#0F172A';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Pointe de flèche terminale pointant vers le Take Profit
    ctx.beginPath();
    const tailleFleche = 6;
    if (directionHaut) {
      ctx.moveTo(xTrajectoire - tailleFleche, yTP + tailleFleche);
      ctx.lineTo(xTrajectoire, yTP);
      ctx.lineTo(xTrajectoire + tailleFleche, yTP + tailleFleche);
    } else {
      ctx.moveTo(xTrajectoire - tailleFleche, yTP - tailleFleche);
      ctx.lineTo(xTrajectoire, yTP);
      ctx.lineTo(xTrajectoire + tailleFleche, yTP - tailleFleche);
    }
    ctx.strokeStyle = '#00E676';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // ────────────────────────────────────────────────────────────────────────────
    // ⚡ MINI-JAUGE VERTICALE D'ÉNERGIE & CARBURANT SUR LE GRAPHIQUE
    // ────────────────────────────────────────────────────────────────────────────
    // Dessinée sur la droite du bloc de trade pour visualiser le niveau de réservoir
    const carbuInitial = setup.carburantInitial ?? setup.detailsCarburant?.carburantTotal ?? 0;
    const carbuRestant = setup.carburantRestant ?? 0;
    if (carbuInitial > 0) {
      const xJauge = xFinTrade + 8;
      const hautJauge = 70;
      const largJauge = 12;
      const yJauge = Math.min(yEntree, yTP) + Math.max(0, (Math.abs(yEntree - yTP) - hautJauge) / 2);

      const ratioCarburant = Math.max(0, Math.min(1, carbuRestant / carbuInitial));
      const hauteurRemplie = hautJauge * ratioCarburant;

      // Boîte de la jauge (cadre)
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fillRect(xJauge, yJauge, largJauge, hautJauge);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(xJauge, yJauge, largJauge, hautJauge);

      // Niveau de carburant restant (remplissage vert/cyan dégradé)
      const yRemplissage = yJauge + (hautJauge - hauteurRemplie);
      ctx.fillStyle = ratioCarburant > 0.4 ? '#00E676' : (ratioCarburant > 0.15 ? '#FBBF24' : '#EF4444');
      ctx.fillRect(xJauge + 1.5, yRemplissage, largJauge - 3, hauteurRemplie);

      // Étiquette en haut de la jauge
      ctx.font = 'bold 8px sans-serif';
      ctx.fillStyle = '#38BDF8';
      ctx.fillText(`⚡${carbuInitial}`, xJauge - 2, yJauge - 4);

      // Étiquette en bas (reste)
      ctx.font = '8px sans-serif';
      ctx.fillStyle = '#CBD5E1';
      ctx.fillText(`${carbuRestant}p`, xJauge - 2, yJauge + hautJauge + 10);
    }
  }

  // C. Ligne d'Entrée
  if (yEntree !== null) {
    ctx.beginPath();
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([3, 3]);
    ctx.moveTo(xDebutTrade, yEntree);
    ctx.lineTo(xFinTrade, yEntree);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.font = '9px sans-serif';
    ctx.fillStyle = '#CBD5E1';
    ctx.fillText(`Entrée : ${setup.prixEntree.toFixed(2)}`, xDebutTrade + 6, yEntree - 3);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 6️⃣ Cartouche HUD Épuré en Haut du Canvas
  // ────────────────────────────────────────────────────────────────────────────
  const texteHUDLigne1 = `🔍 DIAGNOSTIC TP SMC #${setup.indexDoji} (${setup.type}) | S/R Retenu: ${setup.scoreShved}pts | Carburant: ${carburant}pts | TP: ${setup.prixTP ?? '-'} (${setup.ratioRR ?? '-'}R)`;
  const texteHUDLigne2 = debugTP?.syntheseExplication
    ? `🛣️ Règle UOP : ${debugTP.syntheseExplication}`
    : `🛣️ Règle UOP : Paliers traversés: ${setup.paliersTraverses ?? 0} | Arrêt devant le premier mur infranchissable`;
  const texteHUDLigne3 = infoScoreZZ
    ? `🌊 ${infoScoreZZ.resumeExplication}`
    : '';

  ctx.font = 'bold 10px sans-serif';
  const wHUD1 = ctx.measureText(texteHUDLigne1).width;
  ctx.font = '9px sans-serif';
  const wHUD2 = ctx.measureText(texteHUDLigne2).width;
  const wHUD3 = texteHUDLigne3 ? ctx.measureText(texteHUDLigne3).width : 0;
  const wHUD = Math.max(wHUD1, wHUD2, wHUD3);
  const hHUD = texteHUDLigne3 ? 52 : 36;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.fillRect(10, 8, wHUD + 18, hHUD);
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(10, 8, wHUD + 18, hHUD);

  ctx.font = 'bold 10px sans-serif';
  ctx.fillStyle = '#38BDF8';
  ctx.fillText(texteHUDLigne1, 18, 22);

  ctx.font = '9px sans-serif';
  ctx.fillStyle = '#CBD5E1';
  ctx.fillText(texteHUDLigne2, 18, 36);

  if (texteHUDLigne3) {
    ctx.font = 'bold 9px sans-serif';
    ctx.fillStyle = '#C084FC';
    ctx.fillText(texteHUDLigne3, 18, 50);
  }

  ctx.restore();
}

/**
 * 🔍 Projette sur le canvas la surbrillance temporaire d'un setup Sandbox Doji Shved inspecté en diagnostic.
 * Affiche la plage temporelle ciblée, TOUS les supports (Achat) ou résistances (Vente) candidats de la plage
 * avec leurs scores, en mettant en valeur la zone retenue (étoilée) et la zone sélectionnée/cliquée.
 */
export function dessinerSurbrillanceDiagnosticSandbox(
  ctx: CanvasRenderingContext2D,
  signal: SignalSandboxPlage,
  chart: IChartApi,
  series: ISeriesApi<'Candlestick'>,
  bougies: Bougie[],
  zoneSelectionneeId?: string | null
): void {
  if (!signal || !chart || !series) return;
  const timeScale = chart.timeScale();

  const xDoji = obtenirXPourTemps(timeScale, signal.temps, bougies);
  const xDebutPlage = signal.tempsDebutPlage ? obtenirXPourTemps(timeScale, signal.tempsDebutPlage, bougies) : null;
  const estAchat = signal.type === 'ACHAT';

  ctx.save();

  // ────────────────────────────────────────────────────────────────────────────
  // 1️⃣ Ombrage de la Plage Temporelle Ciblée [DebutPlage ➔ Doji]
  // ────────────────────────────────────────────────────────────────────────────
  if (xDebutPlage !== null && xDoji !== null && xDoji > xDebutPlage) {
    const largeurPlage = xDoji - xDebutPlage;

    // Fond subtil bleuté
    ctx.fillStyle = 'rgba(41, 182, 246, 0.05)';
    ctx.fillRect(xDebutPlage, 0, largeurPlage, ctx.canvas.height);

    // Ligne verticale de début de plage
    ctx.strokeStyle = 'rgba(41, 182, 246, 0.4)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xDebutPlage, 0);
    ctx.lineTo(xDebutPlage, ctx.canvas.height);
    ctx.stroke();

    // Badge discret début de plage
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(xDebutPlage + 2, 8, 126, 18);
    ctx.strokeStyle = 'rgba(41, 182, 246, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(xDebutPlage + 2, 8, 126, 18);

    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 9.5px sans-serif';
    ctx.fillText('📍 Début Recherche S/R', xDebutPlage + 8, 20);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 2️⃣ Supports ou Résistances analysés dans la plage (TOUS les candidats)
  // ────────────────────────────────────────────────────────────────────────────
  const zonesCandidates = signal.toutesZonesCandidates || signal.niveauxShved || [];
  const idZoneRetenue = signal.zoneRetenue?.zone?.id ?? (signal.niveauxShved && signal.niveauxShved.length > 0 ? signal.niveauxShved[0].zone.id : null);

  for (const z of zonesCandidates) {
    const estRetenue = idZoneRetenue === z.zone.id;
    const estInspectee = Boolean(zoneSelectionneeId && zoneSelectionneeId === z.zone.id);
    const yMed = series.priceToCoordinate(z.zone.prixMedian);
    if (yMed === null) continue;

    const yBas = series.priceToCoordinate(z.zone.prixBas);
    const yHautCoord = series.priceToCoordinate(z.zone.prixHaut);

    const xDebutLigne = obtenirXPourTemps(timeScale, z.zone.dateDebut, bougies) ?? (xDebutPlage ?? 0);
    const xFinLigne = xDoji ?? ctx.canvas.width;
    const largeurZone = Math.max(12, xFinLigne - xDebutLigne);
    const estSupport = z.zone.type === 'SUPPORT';

    // A. Boîte de la zone de prix [prixBas, prixHaut]
    if (yBas !== null && yHautCoord !== null) {
      const yHaut = Math.min(yBas, yHautCoord);
      const hauteurZone = Math.max(4, Math.abs(yBas - yHautCoord));

      if (estInspectee) {
        // 🔍 ZONE CLIQUEE / INSPECTÉE : Halo doré éclatant
        ctx.fillStyle = 'rgba(251, 191, 36, 0.28)';
        ctx.fillRect(xDebutLigne, yHaut, largeurZone, hauteurZone);
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([]);
        ctx.strokeRect(xDebutLigne, yHaut, largeurZone, hauteurZone);
      } else if (estRetenue) {
        // ⭐ ZONE RETENUE (GAGNANTE DU TRI) : Vert émeraude éclatant pour support, Cyan pour résistance
        const couleurFond = estSupport ? 'rgba(0, 230, 118, 0.20)' : 'rgba(0, 229, 255, 0.20)';
        const couleurBord = estSupport ? '#00E676' : '#00E5FF';

        ctx.fillStyle = couleurFond;
        ctx.fillRect(xDebutLigne, yHaut, largeurZone, hauteurZone);
        ctx.strokeStyle = couleurBord;
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.strokeRect(xDebutLigne, yHaut, largeurZone, hauteurZone);
      } else {
        // ZONES ÉCARTÉES : Teinte douce ambre/ardoise avec bordure pointillée
        ctx.fillStyle = 'rgba(148, 163, 184, 0.07)';
        ctx.fillRect(xDebutLigne, yHaut, largeurZone, hauteurZone);
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.40)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(xDebutLigne, yHaut, largeurZone, hauteurZone);
      }
    }

    // B. Ligne médiane
    ctx.beginPath();
    if (estInspectee) {
      ctx.strokeStyle = '#FBBF24';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 3]);
    } else if (estRetenue) {
      ctx.strokeStyle = estSupport ? '#00E676' : '#00E5FF';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
    } else {
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.50)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
    }
    ctx.moveTo(xDebutLigne, yMed);
    ctx.lineTo(xFinLigne, yMed);
    ctx.stroke();

    // C. Badge d'identification
    ctx.setLineDash([]);
    if (estInspectee) {
      const texteInspect = `🔍 ${estSupport ? 'SUPPORT' : 'RÉSISTANCE'} INSPECTÉ [${z.score} pts]`;
      ctx.font = 'bold 10px sans-serif';
      const wTexte = ctx.measureText(texteInspect).width;
      const badgeX = xDebutLigne + 4;
      const badgeY = yMed - 18;

      ctx.fillStyle = 'rgba(30, 27, 75, 0.95)';
      ctx.fillRect(badgeX, badgeY, wTexte + 12, 16);
      ctx.strokeStyle = '#FBBF24';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(badgeX, badgeY, wTexte + 12, 16);

      ctx.fillStyle = '#FBBF24';
      ctx.fillText(texteInspect, badgeX + 6, badgeY + 12);

      // ⛰️ Affichage visuel des collines de retest pour la zone manuellement inspectée
      dessinerCollinesEtTouchesZoneSR(ctx, z, timeScale, series, bougies);
    } else if (estRetenue) {
      const texteRetenu = `⭐ ${estSupport ? 'SUPPORT' : 'RÉSISTANCE'} RETENU [${z.score} pts]`;
      ctx.font = 'bold 10px sans-serif';
      const wTexte = ctx.measureText(texteRetenu).width;
      const badgeX = xDebutLigne + 4;
      const badgeY = yMed - 18;

      ctx.fillStyle = estSupport ? 'rgba(6, 44, 24, 0.92)' : 'rgba(8, 47, 73, 0.92)';
      ctx.fillRect(badgeX, badgeY, wTexte + 12, 16);
      ctx.strokeStyle = estSupport ? '#00E676' : '#00E5FF';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(badgeX, badgeY, wTexte + 12, 16);

      ctx.fillStyle = estSupport ? '#00E676' : '#00E5FF';
      ctx.fillText(texteRetenu, badgeX + 6, badgeY + 12);

      // ⛰️ Affichage visuel des vraies collines de retest et des micro-rebonds ignorés sur la zone retenue
      dessinerCollinesEtTouchesZoneSR(ctx, z, timeScale, series, bougies);
    } else {
      const texteEcarte = `${estSupport ? 'Sup' : 'Res'} candidat (${z.score} pts)`;
      ctx.font = '9px sans-serif';
      const wTexte = ctx.measureText(texteEcarte).width;
      const badgeX = xDebutLigne + 4;
      const badgeY = yMed - 15;

      ctx.fillStyle = 'rgba(30, 41, 59, 0.8)';
      ctx.fillRect(badgeX, badgeY, wTexte + 8, 13);
      ctx.fillStyle = '#94A3B8';
      ctx.fillText(texteEcarte, badgeX + 4, badgeY + 10);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 3️⃣ Marqueur du Doji analysé
  // ────────────────────────────────────────────────────────────────────────────
  if (xDoji !== null) {
    const yExtreme = series.priceToCoordinate(signal.prixExtreme);
    if (yExtreme !== null) {
      ctx.beginPath();
      ctx.arc(xDoji, yExtreme, 7, 0, Math.PI * 2);
      ctx.fillStyle = estAchat ? 'rgba(0, 230, 118, 0.35)' : 'rgba(242, 54, 69, 0.35)';
      ctx.fill();
      ctx.strokeStyle = estAchat ? '#00E676' : '#F23645';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const badgeDojiX = xDoji + 10;
      const badgeDojiY = estAchat ? yExtreme + 8 : yExtreme - 26;
      const texteDoji = `🎯 Doji ${signal.type} (#${signal.indexBougie}) [${zonesCandidates.length} S/R candidats]`;

      ctx.font = 'bold 10px sans-serif';
      const wDoji = ctx.measureText(texteDoji).width;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.fillRect(badgeDojiX, badgeDojiY, wDoji + 12, 18);
      ctx.strokeStyle = estAchat ? '#00E676' : '#F23645';
      ctx.lineWidth = 1;
      ctx.strokeRect(badgeDojiX, badgeDojiY, wDoji + 12, 18);

      ctx.fillStyle = '#F8FAFC';
      ctx.fillText(texteDoji, badgeDojiX + 6, badgeDojiY + 13);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 4️⃣ Cartouche HUD en Haut du Canvas
  // ────────────────────────────────────────────────────────────────────────────
  const texteHUD = `🔍 DIAGNOSTIC SANDBOX DOJI #${signal.indexBougie} (${signal.type}) | S/R Retenu: ${signal.zoneRetenue ? signal.zoneRetenue.score + 'pts' : 'Aucun'} | ${zonesCandidates.length} niveaux analysés dans la plage`;
  ctx.font = 'bold 10px sans-serif';
  const wHUD = ctx.measureText(texteHUD).width;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.fillRect(10, 8, wHUD + 16, 20);
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(10, 8, wHUD + 16, 20);

  ctx.fillStyle = '#38BDF8';
  ctx.fillText(texteHUD, 18, 22);

  ctx.restore();
}


