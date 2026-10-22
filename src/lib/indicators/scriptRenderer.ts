import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import type { Bougie } from '@/lib/chartDataHelper';
import type { VisualPrimitives, VisualBox, VisualLine, VisualLabel, VisualCurve, VisualPoint, IndicatorExecutionResult, IndicatorScript } from '@/types/indicatorScript';
import type { SetupOrchestreSMC } from './favoris/orchestrateurSMC';
import type { SignalSandboxPlage } from './favoris/sandboxDojiShvedPlage';
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
  // 3️⃣ Quantité de Liquidité Balayée / Carburant Capté au Doji
  // ────────────────────────────────────────────────────────────────────────────
  const carburant = setup.carburantInitial ?? setup.detailsCarburant?.carburantTotal ?? 0;
  if (xDoji !== null && carburant > 0) {
    const ySL = series.priceToCoordinate(setup.prixSL);
    if (ySL !== null) {
      // Halo d'énergie de liquidation
      ctx.beginPath();
      ctx.arc(xDoji, ySL, 8, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(245, 158, 11, 0.25)';
      ctx.fill();

      // Badge d'information de liquidité
      const badgeLiqX = xDoji + 10;
      const badgeLiqY = estAchat ? ySL + 8 : ySL - 28;
      const texteLiq = `⚡ Liquidation : ${carburant} pts pris`;

      ctx.font = 'bold 10px sans-serif';
      const wLiq = ctx.measureText(texteLiq).width;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.fillRect(badgeLiqX, badgeLiqY, wLiq + 12, 18);

      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(badgeLiqX, badgeLiqY, wLiq + 12, 18);

      ctx.fillStyle = '#FBBF24';
      ctx.fillText(texteLiq, badgeLiqX + 6, badgeLiqY + 13);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 4️⃣ Profil de Chevauchement UOP (Paliers Percés vs Murs Bloquants)
  // ────────────────────────────────────────────────────────────────────────────
  const etapesUOP = setup.etapesPaliersUOP || [];
  for (const etape of etapesUOP) {
    const yPalier = series.priceToCoordinate(etape.prixCible);
    if (yPalier === null) continue;

    const xDebutPalier = xDoji ?? 0;
    const xFinPalier = Math.min(ctx.canvas.width - 20, xDebutPalier + 160);

    ctx.beginPath();
    ctx.strokeStyle = etape.estBloquant ? '#F97316' : '#38BDF8';
    ctx.lineWidth = etape.estBloquant ? 2 : 1.5;
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
  const xDebutTrade = xDoji ?? 0;
  const xFinTrade = Math.min(ctx.canvas.width - 20, xDebutTrade + 200);

  const yEntree = series.priceToCoordinate(setup.prixEntree);
  const ySL = series.priceToCoordinate(setup.prixSL);
  const yTP = setup.prixTP !== undefined ? series.priceToCoordinate(setup.prixTP) : null;

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
  const texteHUD = `🔍 DIAGNOSTIC GRAPHIQUE SMC #${setup.indexDoji} (${setup.type}) | S/R Retenu: ${setup.scoreShved}pts | Carburant: ${carburant}pts | TP: ${setup.prixTP ?? '-'} (${setup.ratioRR ?? '-'}R)`;
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


