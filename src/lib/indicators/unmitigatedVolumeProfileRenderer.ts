import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import type { ResultatUVP } from './unmitigatedVolumeProfile';
import type { Bougie } from '@/lib/chartDataHelper';

// ─── 🎨 Couleurs du Profil de Volume Non Mitigué ──────────────────────────────
export const COULEURS_UVP = {
  zigzag: '#64748b',            // Ligne brisée ardoise / slate
  vagueBull: 'rgba(38, 166, 154, 0.55)', // Vert clair semi-transparent
  vagueBullBord: '#26a69a',
  vagueBear: 'rgba(239, 83, 80, 0.55)',  // Rouge corail semi-transparent
  vagueBearBord: '#ef5350',
  prolongation: '#ba68c8',       // Orchidée / violet clair pour les niveaux ouverts
  badgeFond: '#1e222d',
  texte: '#e2e8f0',
};

export interface OptionsRenduUVP {
  afficherZigZag?: boolean;       // Tracer la ligne de structure ZigZag
  afficherBarresProfil?: boolean; // Tracer les histogrammes de volume sur chaque vague
  afficherProlongation?: boolean; // Prolonger les niveaux non mitigués vers la droite
}

/**
 * Dessine l'indicateur SMC Unmitigated Volume Profile sur le Canvas 2D de Lightweight Charts.
 * 
 * Exemple :
 * dessinerUnmitigatedVolumeProfile(ctx, resultatUVP, chartApi, seriesApi, bougies, {
 *   afficherZigZag: true,
 *   afficherProlongation: true,
 * });
 */
export function dessinerUnmitigatedVolumeProfile(
  ctx: CanvasRenderingContext2D,
  resultat: ResultatUVP,
  chart: IChartApi,
  series: ISeriesApi<any>,
  bougies: Bougie[],
  options: OptionsRenduUVP = {}
): void {
  const {
    afficherZigZag = true,
    afficherBarresProfil = true,
    afficherProlongation = true,
  } = options;

  if (!resultat || resultat.vagues.length === 0) return;

  const timeScale = chart.timeScale();
  const step = resultat.step;

  // Temps de la dernière bougie visible
  const derniereBougie = bougies[bougies.length - 1];
  const xDerniere = derniereBougie ? timeScale.timeToCoordinate(derniereBougie.time as Time) : null;

  // 1️⃣ Dessin de la structure ZigZag (Ligne brisée)
  if (afficherZigZag && resultat.pivots.length >= 2) {
    ctx.save();
    ctx.strokeStyle = COULEURS_UVP.zigzag;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.beginPath();

    let started = false;
    for (const pt of resultat.pivots) {
      const x = timeScale.timeToCoordinate(pt.temps as Time);
      const y = series.priceToCoordinate(pt.prix);

      if (x !== null && y !== null) {
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
    }
    ctx.stroke();

    // Petits points discrets sur chaque pivot
    ctx.fillStyle = COULEURS_UVP.zigzag;
    for (const pt of resultat.pivots) {
      const x = timeScale.timeToCoordinate(pt.temps as Time);
      const y = series.priceToCoordinate(pt.prix);
      if (x !== null && y !== null) {
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // 2️⃣ Dessin des histogrammes de volume non mitigué sur chaque vague
  if (afficherBarresProfil) {
    ctx.save();

    for (const vague of resultat.vagues) {
      if (vague.volumeMaxNonMitigue <= 0) continue;

      const xDebut = timeScale.timeToCoordinate(vague.tempsDebut as Time);
      const xFin = timeScale.timeToCoordinate(vague.tempsFin as Time);
      if (xDebut === null || xFin === null) continue;

      const largeurVague = Math.abs(xFin - xDebut);
      const xOrigine = Math.min(xDebut, xFin);
      const estHaussiere = vague.estHaussiere;

      ctx.fillStyle = estHaussiere ? COULEURS_UVP.vagueBull : COULEURS_UVP.vagueBear;
      ctx.strokeStyle = estHaussiere ? COULEURS_UVP.vagueBullBord : COULEURS_UVP.vagueBearBord;
      ctx.lineWidth = 1;

      for (const palier of vague.paliers) {
        // N'affiche que les zones NON MITIGUÉES
        if (palier.isMitigated) continue;

        const yHaut = series.priceToCoordinate(palier.price + step);
        const yBas = series.priceToCoordinate(palier.price);
        if (yHaut === null || yBas === null) continue;

        const y = Math.min(yHaut, yBas);
        const hauteur = Math.max(2, Math.abs(yBas - yHaut));

        // Largeur proportionnelle au volume dans cette vague (max 55% de la largeur de la vague)
        const ratio = palier.volume / vague.volumeMaxNonMitigue;
        const largeurBarre = Math.max(6, ratio * largeurVague * 0.55);

        ctx.fillRect(xOrigine, y, largeurBarre, hauteur);
        ctx.strokeRect(xOrigine, y, largeurBarre, hauteur);
      }
    }

    ctx.restore();
  }

  // 3️⃣ Prolongation des niveaux non mitigués ouverts vers la droite
  if (afficherProlongation && resultat.niveauxOuverts.length > 0 && xDerniere !== null) {
    ctx.save();
    ctx.strokeStyle = COULEURS_UVP.prolongation;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);

    for (const niveau of resultat.niveauxOuverts) {
      const xFinVague = timeScale.timeToCoordinate(niveau.tempsFin as Time);
      const yPrix = series.priceToCoordinate(niveau.price);

      if (xFinVague !== null && yPrix !== null && xDerniere > xFinVague) {
        ctx.beginPath();
        ctx.moveTo(xFinVague, yPrix);
        ctx.lineTo(xDerniere + 15, yPrix);
        ctx.stroke();

        // Petit tag de niveau au bout
        ctx.font = '9px Inter, system-ui, sans-serif';
        ctx.fillStyle = COULEURS_UVP.prolongation;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`UVP`, xDerniere + 18, yPrix);
      }
    }

    ctx.restore();
  }
}
