import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import type { ResultatLuxAlgoSMC, CassureStructure, OrderBlockSMC } from './luxAlgoSMC';
import type { Bougie } from '@/lib/chartDataHelper';

// ─── 🎨 Palette Officielle LuxAlgo SMC ────────────────────────────────────────
export const COULEURS_SMC = {
  vertHaussier: '#089981',               // Vert Émeraude LuxAlgo
  rougeBaissier: '#f23645',              // Rouge Corail LuxAlgo
  obBullFond: 'rgba(49, 121, 245, 0.18)', // Bleu clair translucide
  obBullBord: 'rgba(49, 121, 245, 0.65)',
  obBearFond: 'rgba(247, 124, 128, 0.18)',// Rose saumon translucide
  obBearBord: 'rgba(247, 124, 128, 0.65)',
  fvgBullFond: 'rgba(8, 153, 129, 0.12)',
  fvgBearFond: 'rgba(242, 54, 69, 0.12)',
  ligneEQH: '#f59e0b',                   // Ambre
  ligneEQL: '#10b981',                   // Émeraude
  fondBadge: 'rgba(15, 23, 42, 0.85)',
  texteBlanc: '#ffffff',
  zonePremium: 'rgba(242, 54, 69, 0.08)',
  zoneDiscount: 'rgba(8, 153, 129, 0.08)',
  zoneEquilibre: 'rgba(148, 163, 184, 0.35)',
};

export interface OptionsRenduLuxAlgoSMC {
  afficherCassures?: boolean;   // Lignes et labels BOS / CHoCH
  afficherOrderBlocks?: boolean;// Boîtes des Blocs d'Ordres non mitigés
  afficherEQH?: boolean;        // Égalités de sommets et creux (EQH / EQL)
  afficherFVG?: boolean;        // Fair Value Gaps
  afficherStrongWeak?: boolean; // Lignes Strong / Weak High & Low
  afficherZonesPD?: boolean;    // Zones Premium, Discount & Équilibre
}

/**
 * Dessine un badge compact centré sur une ligne de structure
 */
function dessinerLabelCassure(
  ctx: CanvasRenderingContext2D,
  texte: string,
  x: number,
  y: number,
  couleurBord: string
): void {
  ctx.save();
  ctx.font = 'bold 9px Inter, system-ui, sans-serif';
  const paddingX = 4;
  const paddingY = 2;
  const metrics = ctx.measureText(texte);
  const w = metrics.width + paddingX * 2;
  const h = 13;

  const rx = x - w / 2;
  const ry = y - h / 2;

  // Fond du badge
  ctx.fillStyle = COULEURS_SMC.fondBadge;
  ctx.strokeStyle = couleurBord;
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(rx, ry, w, h, 2);
  } else {
    ctx.rect(rx, ry, w, h);
  }
  ctx.fill();
  ctx.stroke();

  // Texte
  ctx.fillStyle = couleurBord;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(texte, x, y);
  ctx.restore();
}

/**
 * Rendu Canvas 2D complet pour l'indicateur LuxAlgo Smart Money Concepts
 * 
 * S'exécute directement dans la boucle de rendu de l'overlay de BacktestChart.
 * 
 * Exemple :
 * dessinerLuxAlgoSMC(ctx, resultatSMC, chartApi, seriesApi, bougies, {
 *   afficherCassures: true,
 *   afficherOrderBlocks: true,
 * });
 */
export function dessinerLuxAlgoSMC(
  ctx: CanvasRenderingContext2D,
  resultat: ResultatLuxAlgoSMC,
  chart: IChartApi,
  series: ISeriesApi<any>,
  bougies: Bougie[],
  options: OptionsRenduLuxAlgoSMC = {}
): void {
  const {
    afficherCassures = true,
    afficherOrderBlocks = true,
    afficherEQH = true,
    afficherFVG = false,
    afficherStrongWeak = true,
    afficherZonesPD = true,
  } = options;

  if (!resultat) return;

  const timeScale = chart.timeScale();
  const dernierTemps = bougies[bougies.length - 1]?.time;

  // 1️⃣ Dessin des Zones Premium / Discount / Équilibre (fond discret à droite)
  if (afficherZonesPD && resultat.premiumDiscount) {
    const pd = resultat.premiumDiscount;
    const yHaut = series.priceToCoordinate(pd.hautRange);
    const yBas = series.priceToCoordinate(pd.basRange);
    const yEq = series.priceToCoordinate(pd.prixEquilibre);

    if (yHaut !== null && yBas !== null && yEq !== null) {
      ctx.save();
      const largeurBande = 60;
      const xDroite = ctx.canvas.width;
      const xGauche = Math.max(0, xDroite - largeurBande);

      // Zone Premium (partie supérieure)
      const yPremBas = series.priceToCoordinate(pd.zonePremium.bas);
      if (yPremBas !== null) {
        ctx.fillStyle = COULEURS_SMC.zonePremium;
        ctx.fillRect(xGauche, Math.min(yHaut, yPremBas), largeurBande, Math.abs(yPremBas - yHaut));
      }

      // Zone Discount (partie inférieure)
      const yDiscHaut = series.priceToCoordinate(pd.zoneDiscount.haut);
      if (yDiscHaut !== null) {
        ctx.fillStyle = COULEURS_SMC.zoneDiscount;
        ctx.fillRect(xGauche, Math.min(yDiscHaut, yBas), largeurBande, Math.abs(yBas - yDiscHaut));
      }

      // Ligne d'Équilibre médiane (50%)
      ctx.strokeStyle = COULEURS_SMC.zoneEquilibre;
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(xGauche, yEq);
      ctx.lineTo(xDroite, yEq);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label EQ
      ctx.font = '8px Inter, system-ui, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`EQ (50%)`, xDroite - 4, yEq - 2);

      ctx.restore();
    }
  }

  // 2️⃣ Dessin des Fair Value Gaps (FVG)
  if (afficherFVG && resultat.fvgs.length > 0) {
    ctx.save();
    for (const fvg of resultat.fvgs) {
      if (fvg.mitige) continue;

      const xDebut = timeScale.timeToCoordinate(fvg.temps as Time);
      const yHaut = series.priceToCoordinate(fvg.haut);
      const yBas = series.priceToCoordinate(fvg.bas);

      if (xDebut !== null && yHaut !== null && yBas !== null) {
        const xFin = ctx.canvas.width;
        const w = Math.max(10, xFin - xDebut);
        const y = Math.min(yHaut, yBas);
        const h = Math.max(2, Math.abs(yBas - yHaut));

        const estBull = fvg.biais === 1;
        ctx.fillStyle = estBull ? COULEURS_SMC.fvgBullFond : COULEURS_SMC.fvgBearFond;
        ctx.fillRect(xDebut, y, w, h);

        ctx.strokeStyle = estBull ? 'rgba(8, 153, 129, 0.4)' : 'rgba(242, 54, 69, 0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(xDebut, y, w, h);
      }
    }
    ctx.restore();
  }

  // 3️⃣ Dessin des Blocs d'Ordres (Order Blocks - OB)
  if (afficherOrderBlocks && resultat.orderBlocks.length > 0) {
    ctx.save();
    for (const ob of resultat.orderBlocks) {
      if (ob.mitige) continue;

      const xDebut = timeScale.timeToCoordinate(ob.temps as Time);
      const yHaut = series.priceToCoordinate(ob.haut);
      const yBas = series.priceToCoordinate(ob.bas);

      if (xDebut !== null && yHaut !== null && yBas !== null) {
        const xFin = ctx.canvas.width;
        const largeur = Math.max(12, xFin - xDebut);
        const y = Math.min(yHaut, yBas);
        const hauteur = Math.max(3, Math.abs(yBas - yHaut));

        const estBull = ob.biais === 1;
        ctx.fillStyle = estBull ? COULEURS_SMC.obBullFond : COULEURS_SMC.obBearFond;
        ctx.fillRect(xDebut, y, largeur, hauteur);

        ctx.strokeStyle = estBull ? COULEURS_SMC.obBullBord : COULEURS_SMC.obBearBord;
        ctx.lineWidth = ob.internal ? 1 : 1.5;
        ctx.strokeRect(xDebut, y, largeur, hauteur);

        // Petit tag OB à gauche de la boîte
        if (largeur > 30 && hauteur > 8) {
          ctx.font = 'bold 8px Inter, system-ui, sans-serif';
          ctx.fillStyle = estBull ? '#60a5fa' : '#f87171';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(ob.internal ? 'iOB' : 'OB', xDebut + 3, y + 2);
        }
      }
    }
    ctx.restore();
  }

  // 4️⃣ Dessin des cassures de structure (BOS et CHoCH)
  if (afficherCassures && resultat.cassures.length > 0) {
    ctx.save();
    for (const c of resultat.cassures) {
      const x1 = timeScale.timeToCoordinate(c.tempsDebut as Time);
      const x2 = timeScale.timeToCoordinate(c.tempsFin as Time);
      const y = series.priceToCoordinate(c.prix);

      if (x1 !== null && x2 !== null && y !== null) {
        const couleur = c.biais === 1 ? COULEURS_SMC.vertHaussier : COULEURS_SMC.rougeBaissier;

        // Ligne de structure : tirets fins pour interne, ligne continue pour swing
        ctx.strokeStyle = couleur;
        ctx.lineWidth = c.internal ? 1 : 1.5;
        if (c.internal) {
          ctx.setLineDash([3, 3]);
        } else {
          ctx.setLineDash([]);
        }

        ctx.beginPath();
        ctx.moveTo(x1, y);
        ctx.lineTo(x2, y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Label au milieu de la cassure
        const midX = (x1 + x2) / 2;
        const libelle = c.internal ? `i${c.type}` : c.type;
        dessinerLabelCassure(ctx, libelle, midX, y, couleur);
      }
    }
    ctx.restore();
  }

  // 5️⃣ Dessin des Equal Highs / Equal Lows (EQH / EQL)
  if (afficherEQH && resultat.equalHighsLows.length > 0) {
    ctx.save();
    for (const eq of resultat.equalHighsLows) {
      if (eq.mitige) continue;

      const x1 = timeScale.timeToCoordinate(eq.temps1 as Time);
      const x2 = timeScale.timeToCoordinate(eq.temps2 as Time);
      const y = series.priceToCoordinate(eq.prix);

      if (x1 !== null && x2 !== null && y !== null) {
        const couleur = eq.type === 'EQH' ? COULEURS_SMC.ligneEQH : COULEURS_SMC.ligneEQL;

        // Ligne reliant les deux pivots égaux et prolongée vers la droite
        const xFin = Math.min(ctx.canvas.width, x2 + 60);
        ctx.strokeStyle = couleur;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);

        ctx.beginPath();
        ctx.moveTo(x1, y);
        ctx.lineTo(xFin, y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Badge EQH / EQL
        dessinerLabelCassure(ctx, eq.type, (x1 + x2) / 2, y, couleur);
      }
    }
    ctx.restore();
  }

  // 6️⃣ Dessin des extrêmes Strong / Weak High & Low
  if (afficherStrongWeak && resultat.strongWeakExtremes && dernierTemps) {
    const sw = resultat.strongWeakExtremes;
    const xFin = ctx.canvas.width;

    ctx.save();
    ctx.font = 'bold 9px Inter, system-ui, sans-serif';

    // Strong / Weak High
    const prixHaut = sw.strongHigh ?? sw.weakHigh;
    if (prixHaut !== undefined && sw.tempsHaut) {
      const xHaut = timeScale.timeToCoordinate(sw.tempsHaut as Time);
      const yHaut = series.priceToCoordinate(prixHaut);
      if (xHaut !== null && yHaut !== null) {
        const estStrong = sw.strongHigh !== undefined;
        const col = estStrong ? COULEURS_SMC.rougeBaissier : '#94a3b8';

        ctx.strokeStyle = col;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 2]);
        ctx.beginPath();
        ctx.moveTo(xHaut, yHaut);
        ctx.lineTo(xFin, yHaut);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = col;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(estStrong ? '🔴 Strong High' : '⚪ Weak High', xHaut + 4, yHaut - 2);
      }
    }

    // Strong / Weak Low
    const prixBas = sw.strongLow ?? sw.weakLow;
    if (prixBas !== undefined && sw.tempsBas) {
      const xBas = timeScale.timeToCoordinate(sw.tempsBas as Time);
      const yBas = series.priceToCoordinate(prixBas);
      if (xBas !== null && yBas !== null) {
        const estStrong = sw.strongLow !== undefined;
        const col = estStrong ? COULEURS_SMC.vertHaussier : '#94a3b8';

        ctx.strokeStyle = col;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 2]);
        ctx.beginPath();
        ctx.moveTo(xBas, yBas);
        ctx.lineTo(xFin, yBas);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = col;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(estStrong ? '🟢 Strong Low' : '⚪ Weak Low', xBas + 4, yBas + 2);
      }
    }
    ctx.restore();
  }
}
