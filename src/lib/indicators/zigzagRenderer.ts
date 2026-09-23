import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import type { ResultatZigZag, PivotZigZag, VagueZigZagMesuree } from './zigzag';
import type { Bougie } from '@/lib/chartDataHelper';

// ─── 🎨 Palette de couleurs ZigZag et SMC ────────────────────────────────────
export const COULEURS_ZIGZAG = {
  lignePolyline: '#38bdf8',               // Bleu ciel moderne pour la ligne de structure
  vertHH: '#089981',                      // Vert émeraude pour Higher High / Higher Low
  rougeLL: '#f23645',                     // Rouge corail pour Lower Low / Lower High
  neutrePivot: '#94a3b8',                 // Gris ardoise pour les pivots de base
  fondBadgeVert: 'rgba(8, 153, 129, 0.85)',
  fondBadgeRouge: 'rgba(242, 54, 69, 0.85)',
  fondBadgeNeutre: 'rgba(51, 65, 85, 0.85)',
  fondMetrique: 'rgba(15, 23, 42, 0.75)',  // Fond sombre translucide pour les mesures
  texteBlanc: '#ffffff',
  texteMetrique: '#cbd5e1',
};

export interface OptionsRenduZigZag {
  afficherLabels?: boolean;    // Afficher les badges structurels HH, HL, LH, LL
  afficherMetriques?: boolean; // Afficher pips et nombre de bougies sur les vagues
  epaisseurLigne?: number;     // Épaisseur du trait ZigZag (défaut: 2)
}

/**
 * Dessine un badge rectangulaire arrondi avec texte centré
 */
function dessinerBadge(
  ctx: CanvasRenderingContext2D,
  texte: string,
  x: number,
  y: number,
  couleurFond: string,
  couleurTexte: string
): void {
  ctx.save();
  ctx.font = 'bold 10px Inter, system-ui, sans-serif';
  const paddingX = 4;
  const paddingY = 2;
  const metrics = ctx.measureText(texte);
  const w = metrics.width + paddingX * 2;
  const h = 14;

  const rx = x - w / 2;
  const ry = y - h / 2;

  // Dessin du rectangle à coins arrondis
  ctx.fillStyle = couleurFond;
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(rx, ry, w, h, 3);
  } else {
    ctx.rect(rx, ry, w, h);
  }
  ctx.fill();

  // Texte du badge
  ctx.fillStyle = couleurTexte;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(texte, x, y);
  ctx.restore();
}

/**
 * Dessine l'indicateur ZigZag (lignes, pivots SMC et métriques) sur le Canvas 2D
 * 
 * Exemple :
 * dessinerZigZag(ctx, resultatZigZag, chartApi, seriesApi, bougies, {
 *   afficherLabels: true,
 *   afficherMetriques: true,
 * });
 */
export function dessinerZigZag(
  ctx: CanvasRenderingContext2D,
  resultat: ResultatZigZag,
  chart: IChartApi,
  series: ISeriesApi<any>,
  bougies: Bougie[],
  options: OptionsRenduZigZag = {}
): void {
  const {
    afficherLabels = true,
    afficherMetriques = true,
    epaisseurLigne = 2,
  } = options;

  if (!resultat || resultat.pivots.length === 0) return;

  const timeScale = chart.timeScale();
  const pivots = resultat.pivots;

  // 1️⃣ Conversion des coordonnées temporelles et de prix en pixels écran
  const pointsEcran: { x: number; y: number; pivot: PivotZigZag }[] = [];

  for (const p of pivots) {
    const x = timeScale.timeToCoordinate(p.temps as Time);
    const y = series.priceToCoordinate(p.prix);

    if (x !== null && y !== null) {
      pointsEcran.push({ x, y, pivot: p });
    }
  }

  if (pointsEcran.length < 2) return;

  // 2️⃣ Dessin des segments de la polyline ZigZag
  ctx.save();
  ctx.strokeStyle = COULEURS_ZIGZAG.lignePolyline;
  ctx.lineWidth = epaisseurLigne;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(pointsEcran[0].x, pointsEcran[0].y);

  for (let i = 1; i < pointsEcran.length; i++) {
    ctx.lineTo(pointsEcran[i].x, pointsEcran[i].y);
  }
  ctx.stroke();
  ctx.restore();

  // 3️⃣ Dessin des métriques de vague (amplitude pips et durée en bougies)
  if (afficherMetriques && resultat.vagues.length > 0) {
    ctx.save();
    for (let i = 0; i < pointsEcran.length - 1; i++) {
      const p1 = pointsEcran[i];
      const p2 = pointsEcran[i + 1];
      const vague = resultat.vagues[i];

      if (!vague) continue;

      // Positionnement au milieu géométrique du segment
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;

      // Texte explicite (ex: "+34.5 p (8b)")
      const signe = vague.estHaussiere ? '+' : '-';
      const texteVague = `${signe}${vague.amplitudePips}p (${vague.nbBougies}b)`;

      ctx.font = '9px Inter, system-ui, sans-serif';
      const w = ctx.measureText(texteVague).width + 6;
      const h = 12;

      // Petit fond sombre pour détacher le texte de la ligne
      ctx.fillStyle = COULEURS_ZIGZAG.fondMetrique;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(midX - w / 2, midY - h / 2, w, h, 2);
      } else {
        ctx.rect(midX - w / 2, midY - h / 2, w, h);
      }
      ctx.fill();

      // Texte
      ctx.fillStyle = vague.estHaussiere ? '#34d399' : '#f87171';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(texteVague, midX, midY);
    }
    ctx.restore();
  }

  // 4️⃣ Dessin des points de pivots et de leurs labels SMC (HH, HL, LH, LL)
  for (let i = 0; i < pointsEcran.length; i++) {
    const { x, y, pivot } = pointsEcran[i];

    // Cercle d'ancrage sur le sommet ou creux
    ctx.save();
    const estHaussier = pivot.labelSMC === 'HH' || pivot.labelSMC === 'HL';
    const estBaissier = pivot.labelSMC === 'LH' || pivot.labelSMC === 'LL';
    const couleurPivot = estHaussier
      ? COULEURS_ZIGZAG.vertHH
      : estBaissier
        ? COULEURS_ZIGZAG.rougeLL
        : COULEURS_ZIGZAG.neutrePivot;

    ctx.fillStyle = couleurPivot;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Badge structurel SMC
    if (afficherLabels && pivot.labelSMC !== 'PIVOT') {
      const couleurFond = estHaussier
        ? COULEURS_ZIGZAG.fondBadgeVert
        : estBaissier
          ? COULEURS_ZIGZAG.fondBadgeRouge
          : COULEURS_ZIGZAG.fondBadgeNeutre;

      // Décalage vertical : au-dessus pour les sommets, en-dessous pour les creux
      const offsetY = pivot.estHaut ? -12 : 12;
      dessinerBadge(ctx, pivot.labelSMC, x, y + offsetY, couleurFond, COULEURS_ZIGZAG.texteBlanc);
    }
  }
}
