import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import type { ProtectedSwingsResultat } from './protectedSwings';
import type { Bougie } from '@/lib/chartDataHelper';

// ─── 🎨 Couleurs Officielles de l'Indicateur LuxAlgo ─────────────────────────
export const COULEURS_LUXALGO = {
  vertBull: '#089981',        // Vert Émeraude officiel LuxAlgo
  rougeBear: '#f23645',       // Rouge Corail officiel LuxAlgo
  fvgBullFond: 'rgba(8, 153, 129, 0.14)',
  fvgBullBord: 'rgba(8, 153, 129, 0.45)',
  fvgBearFond: 'rgba(242, 54, 69, 0.14)',
  fvgBearBord: 'rgba(242, 54, 69, 0.45)',
  ligneCisd: 'rgba(255, 255, 255, 0.75)',
  ligneVerticale: 'rgba(156, 163, 175, 0.75)', // Gris moyen
  ligneOrigineSweep: 'rgba(148, 163, 184, 0.5)',
};

export interface OptionsRenduProtectedSwings {
  afficherLabels?: boolean;
  afficherNiveaux?: boolean;
  afficherFvg?: boolean;
  afficherSweeps?: boolean;
}

/**
 * Dessine l'ensemble des éléments de l'indicateur Protected Swings sur un contexte Canvas 2D.
 * 
 * S'exécute directement dans la boucle de rendu de l'overlay de BacktestChart.
 * 
 * Exemple :
 * dessinerProtectedSwings(ctx, resultatSwings, chartApi, seriesApi, bougies, {
 *   afficherLabels: true,
 *   afficherNiveaux: true,
 * });
 */
export function dessinerProtectedSwings(
  ctx: CanvasRenderingContext2D,
  resultat: ProtectedSwingsResultat,
  chart: IChartApi,
  series: ISeriesApi<any>,
  bougies: Bougie[],
  options: OptionsRenduProtectedSwings = {}
): void {
  const {
    afficherLabels = true,
    afficherNiveaux = true,
    afficherFvg = true,
    afficherSweeps = true,
  } = options;

  if (!resultat) return;

  const timeScale = chart.timeScale();

  // 1️⃣ Dessin des Fair Value Gaps (FVG)
  if (afficherFvg && resultat.fvgs.length > 0) {
    ctx.save();
    for (const fvg of resultat.fvgs) {
      const xDebut = timeScale.timeToCoordinate(fvg.timeStart as Time);
      const xFin = timeScale.timeToCoordinate(fvg.timeEnd as Time);
      const yHaut = series.priceToCoordinate(fvg.top);
      const yBas = series.priceToCoordinate(fvg.bottom);

      // Si les coordonnées sont valides à l'écran
      if (xDebut !== null && xFin !== null && yHaut !== null && yBas !== null) {
        const x = Math.min(xDebut, xFin);
        const largeur = Math.max(8, Math.abs(xFin - xDebut));
        const y = Math.min(yHaut, yBas);
        const hauteur = Math.max(2, Math.abs(yBas - yHaut));

        const estBull = fvg.dir === 1;
        ctx.fillStyle = estBull ? COULEURS_LUXALGO.fvgBullFond : COULEURS_LUXALGO.fvgBearFond;
        ctx.fillRect(x, y, largeur, hauteur);

        ctx.strokeStyle = estBull ? COULEURS_LUXALGO.fvgBullBord : COULEURS_LUXALGO.fvgBearBord;
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, largeur, hauteur);

        // Petit label FVG discret
        if (largeur > 35 && hauteur > 10) {
          ctx.font = '9px Inter, system-ui, sans-serif';
          ctx.fillStyle = estBull ? COULEURS_LUXALGO.vertBull : COULEURS_LUXALGO.rougeBear;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText('FVG', x + 3, y + 2);
        }
      }
    }
    ctx.restore();
  }

  // 2️⃣ Dessin des balayages de liquidité (Sweeps)
  if (afficherSweeps && resultat.sweeps.length > 0) {
    ctx.save();
    for (const swp of resultat.sweeps) {
      const xOrigine = timeScale.timeToCoordinate(swp.originTime as Time);
      const xSweep = timeScale.timeToCoordinate(swp.time as Time);
      const yPivot = series.priceToCoordinate(swp.sweptPrice);
      const yMèche = series.priceToCoordinate(swp.price);

      if (xOrigine !== null && xSweep !== null && yPivot !== null && yMèche !== null) {
        // Ligne pointillée reliant le pivot balayé au sweep
        ctx.strokeStyle = COULEURS_LUXALGO.ligneOrigineSweep;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(xOrigine, yPivot);
        ctx.lineTo(xSweep, yPivot);
        ctx.stroke();
        ctx.setLineDash([]);

        // Surlignage de la mèche qui a balayé
        const couleurSweep = swp.isHigh ? COULEURS_LUXALGO.rougeBear : COULEURS_LUXALGO.vertBull;
        ctx.fillStyle = couleurSweep;
        ctx.beginPath();
        ctx.arc(xSweep, yMèche, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // 3️⃣ Dessin des Protected Swings Confirmés (PSL & PSH)
  if (resultat.swingsConfirmes.length > 0) {
    ctx.save();

    for (const s of resultat.swingsConfirmes) {
      const xSwing = timeScale.timeToCoordinate(s.swingTime as Time);
      const ySwing = series.priceToCoordinate(s.swingPrice);
      const xNiveau = timeScale.timeToCoordinate(s.levelTime as Time);
      const xConfirmation = timeScale.timeToCoordinate(s.confirmationTime as Time);
      const yNiveau = series.priceToCoordinate(s.levelPrice);

      const couleur = s.isBullish ? COULEURS_LUXALGO.vertBull : COULEURS_LUXALGO.rougeBear;

      // A. Ligne horizontale du niveau CISD
      if (afficherNiveaux && xNiveau !== null && xConfirmation !== null && yNiveau !== null) {
        ctx.strokeStyle = couleur;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(xNiveau, yNiveau);
        ctx.lineTo(xConfirmation, yNiveau);
        ctx.stroke();

        // Label du niveau CISD
        ctx.font = 'bold 9px Inter, system-ui, sans-serif';
        ctx.fillStyle = couleur;
        ctx.textAlign = 'right';
        ctx.textBaseline = s.isBullish ? 'bottom' : 'top';
        ctx.fillText('CISD', xConfirmation - 2, yNiveau + (s.isBullish ? -3 : 3));
      }

      // B. Liaison verticale pointillée entre le swing et son niveau CISD
      if (afficherNiveaux && xSwing !== null && ySwing !== null && yNiveau !== null) {
        ctx.strokeStyle = COULEURS_LUXALGO.ligneVerticale;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(xSwing, ySwing);
        ctx.lineTo(xSwing, yNiveau);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // C. Badge textuel PSL ou PSH
      if (afficherLabels && xSwing !== null && ySwing !== null) {
        const texteLabel = s.type; // "PSL" ou "PSH"
        const estHaussier = s.isBullish;

        ctx.font = 'bold 10px Inter, system-ui, sans-serif';
        const mesureTexte = ctx.measureText(texteLabel);
        const largeurBadge = mesureTexte.width + 10;
        const hauteurBadge = 16;

        const xBadge = xSwing - largeurBadge / 2;
        // PSL en dessous du creux, PSH au-dessus du sommet
        const yBadge = estHaussier ? ySwing + 8 : ySwing - hauteurBadge - 8;

        // Fond du badge arrondi
        ctx.fillStyle = couleur;
        ctx.beginPath();
        ctx.roundRect(xBadge, yBadge, largeurBadge, hauteurBadge, 4);
        ctx.fill();

        // Texte blanc à l'intérieur
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(texteLabel, xSwing, yBadge + hauteurBadge / 2);
      }
    }

    ctx.restore();
  }
}
