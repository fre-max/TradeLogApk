import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import type { ResultatUOP, DebugTronconTP, DebugTrouTP } from './unmitigatedOverlapProfile';
import type { Bougie } from '@/lib/chartDataHelper';

// ─── 🎨 Couleurs du Profil de Chevauchement Non-Mitigué ─────────────────────────
export const COULEURS_UOP = {
  zigzag: '#64748b',
  barreForte: 'rgba(14, 165, 233, 0.70)',   // Cyan électrique pour fort chevauchement
  barreForteBord: '#0284c7',
  barreMoyenne: 'rgba(56, 189, 248, 0.50)', // Bleu ciel pour chevauchement modéré
  barreMoyenneBord: '#38bdf8',
  barreMitigee: 'rgba(148, 163, 184, 0.20)',// Gris estompé pour paliers mitigés
  barreMitigeeBord: 'rgba(148, 163, 184, 0.40)',
  prolongation: '#10b981',                  // Vert émeraude pour les niveaux vierges ouverts
  texte: '#e2e8f0',
};

export interface OptionsRenduUOP {
  afficherZigZag?: boolean;
  afficherBarresProfil?: boolean;
  afficherProlongation?: boolean;
  uniquementNonMitigues?: boolean;
  afficherTexte?: boolean;       // Afficher le texte au bout des prolongations (défaut: false pour ne pas surcharger)
  afficherTPOptimaux?: boolean;  // Afficher les lignes de TP Optimaux Achat & Vente (défaut: true)
  seuilBougiesBleuFonce?: number;// Seuil min de bougies pour afficher une barre bleu foncé (défaut: 3)
  afficherDebugTP?: boolean;     // Mode debug : affiche les tronçons goudronnés, trous et ratios du calcul TP (défaut: false)
}

/**
 * Dessine l'indicateur Profil de Chevauchement Non-Mitigué (UOP) sur le Canvas 2D.
 * 
 * Exemple :
 * dessinerUnmitigatedOverlapProfile(ctx, resultatUOP, chartApi, seriesApi, bougies);
 */
export function dessinerUnmitigatedOverlapProfile(
  ctx: CanvasRenderingContext2D,
  resultat: ResultatUOP,
  chart: IChartApi,
  series: ISeriesApi<any>,
  bougies: Bougie[],
  options: OptionsRenduUOP = {}
): void {
  const {
    afficherZigZag = true,
    afficherBarresProfil = true,
    afficherProlongation = true,
    uniquementNonMitigues = false,
    afficherTexte = false,
    afficherTPOptimaux = true,
    seuilBougiesBleuFonce = 3,
    afficherDebugTP = false,
  } = options;

  if (!resultat || resultat.vagues.length === 0) return;

  const timeScale = chart.timeScale();
  const step = resultat.step;

  const derniereBougie = bougies[bougies.length - 1];
  const xDerniere = derniereBougie ? timeScale.timeToCoordinate(derniereBougie.time as Time) : null;

  // 1️⃣ Ligne ZigZag de structure
  if (afficherZigZag && resultat.pivots.length >= 2) {
    ctx.save();
    ctx.strokeStyle = COULEURS_UOP.zigzag;
    ctx.lineWidth = 1.5;
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

    ctx.fillStyle = COULEURS_UOP.zigzag;
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

  // 2️⃣ Barres horizontales de chevauchement sur chaque vague
  if (afficherBarresProfil) {
    ctx.save();

    for (const vague of resultat.vagues) {
      if (vague.maxBougiesChevauchement <= 0) continue;

      const xDebut = timeScale.timeToCoordinate(vague.tempsDebut as Time);
      const xFin = timeScale.timeToCoordinate(vague.tempsFin as Time);
      if (xDebut === null || xFin === null) continue;

      const largeurVague = Math.abs(xFin - xDebut);
      const xOrigine = Math.min(xDebut, xFin);

      for (const palier of vague.paliers) {
        if (uniquementNonMitigues && palier.isMitigated) continue;

        const yHaut = series.priceToCoordinate(palier.price + step);
        const yBas = series.priceToCoordinate(palier.price);
        if (yHaut === null || yBas === null) continue;

        const y = Math.min(yHaut, yBas);
        const hauteur = Math.max(2, Math.abs(yBas - yHaut));

        // Largeur basée sur le NOMBRE DE BOUGIES DE CHEVAUCHEMENT (max 50% de la largeur de la vague)
        const ratio = palier.nbBougiesChevauchement / vague.maxBougiesChevauchement;
        const largeurBarre = Math.max(8, ratio * largeurVague * 0.50);

        const estFort = palier.nbBougiesChevauchement >= seuilBougiesBleuFonce;

        if (palier.isMitigated) {
          ctx.fillStyle = COULEURS_UOP.barreMitigee;
          ctx.strokeStyle = COULEURS_UOP.barreMitigeeBord;
        } else {
          ctx.fillStyle = estFort ? COULEURS_UOP.barreForte : COULEURS_UOP.barreMoyenne;
          ctx.strokeStyle = estFort ? COULEURS_UOP.barreForteBord : COULEURS_UOP.barreMoyenneBord;
        }

        ctx.lineWidth = 1;
        ctx.fillRect(xOrigine, y, largeurBarre, hauteur);
        ctx.strokeRect(xOrigine, y, largeurBarre, hauteur);
      }
    }

    ctx.restore();
  }

  // 3️⃣ Prolongation des niveaux non-mitigés vers la droite
  if (afficherProlongation && resultat.niveauxOuverts.length > 0 && xDerniere !== null) {
    ctx.save();
    ctx.strokeStyle = COULEURS_UOP.prolongation;
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

        if (afficherTexte) {
          ctx.font = 'bold 9px Inter, system-ui, sans-serif';
          ctx.fillStyle = COULEURS_UOP.prolongation;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(`🎯 ${niveau.nbBougiesChevauchement}b`, xDerniere + 18, yPrix);
        }
      }
    }

    ctx.restore();
  }

  // 4️⃣ Tracé des Lignes de Take Profit Optimaux (TPO) Achat & Vente
  if (afficherTPOptimaux && xDerniere !== null) {
    ctx.save();

    // 🟢 Tracé des TP Achat (Vert émeraude)
    if (resultat.tpOptimauxAchat && resultat.tpOptimauxAchat.length > 0) {
      for (const tp of resultat.tpOptimauxAchat) {
        const yPrix = series.priceToCoordinate(tp.prixCible);
        if (yPrix === null) continue;

        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.8;
        ctx.setLineDash([5, 4]);

        ctx.beginPath();
        ctx.moveTo(xDerniere, yPrix);
        ctx.lineTo(xDerniere + 90, yPrix);
        ctx.stroke();

        // Badge texte TP Achat
        ctx.font = 'bold 9.5px Inter, system-ui, sans-serif';
        ctx.fillStyle = '#10b981';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`🎯 TP${tp.ordre} ACHAT : ${tp.prixCible.toFixed(4)} (+${tp.amplitudePoints.toFixed(4)})`, xDerniere + 95, yPrix);
      }
    }

    // 🔴 Tracé des TP Vente (Rose / Rouge corail)
    if (resultat.tpOptimauxVente && resultat.tpOptimauxVente.length > 0) {
      for (const tp of resultat.tpOptimauxVente) {
        const yPrix = series.priceToCoordinate(tp.prixCible);
        if (yPrix === null) continue;

        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 1.8;
        ctx.setLineDash([5, 4]);

        ctx.beginPath();
        ctx.moveTo(xDerniere, yPrix);
        ctx.lineTo(xDerniere + 90, yPrix);
        ctx.stroke();

        // Badge texte TP Vente
        ctx.font = 'bold 9.5px Inter, system-ui, sans-serif';
        ctx.fillStyle = '#f43f5e';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`🎯 TP${tp.ordre} VENTE : ${tp.prixCible.toFixed(4)} (-${tp.amplitudePoints.toFixed(4)})`, xDerniere + 95, yPrix);
      }
    }

    ctx.restore();
  }

  // 5️⃣ Mode Debug Visuel des TP Optimaux
  // Dessine les tronçons goudronnés (rectangles verts) et les trous (rectangles orange/rouge)
  // avec les lettres (A, B, C...) et les ratios de tolérance pour chaque TP
  if (afficherDebugTP && xDerniere !== null) {
    ctx.save();

    // Couleurs du mode debug
    const COULEUR_TRONCON_FOND = 'rgba(16, 185, 129, 0.15)';     // Vert émeraude semi-transparent
    const COULEUR_TRONCON_BORDURE = 'rgba(16, 185, 129, 0.70)';   // Vert émeraude pour le contour
    const COULEUR_TROU_ABSORBE_FOND = 'rgba(251, 191, 36, 0.15)'; // Orange doré semi-transparent (trou toléré)
    const COULEUR_TROU_ABSORBE_BORDURE = 'rgba(251, 191, 36, 0.70)';
    const COULEUR_TROU_REJETE_FOND = 'rgba(244, 63, 94, 0.15)';   // Rose/rouge pour trou rejeté
    const COULEUR_TROU_REJETE_BORDURE = 'rgba(244, 63, 94, 0.70)';

    // Largeur fixe des rectangles de debug, positionnés à droite de la dernière bougie
    const largeurDebug = 65;
    const decalageXDebug = 10; // Décalage à droite de la dernière bougie

    // Fonction réutilisable pour dessiner les zones de debug d'un TP (Achat ou Vente)
    function dessinerDebugTP(
      tp: { debug?: { troncons: DebugTronconTP[]; trous: DebugTrouTP[] } },
      couleurTexte: string,
      decalageOrdre: number
    ): void {
      if (!tp.debug) return;

      const xBase = xDerniere! + decalageXDebug + decalageOrdre * (largeurDebug + 5);

      // Dessin de chaque tronçon goudronné (zone bleu foncé)
      for (const troncon of tp.debug.troncons) {
        const yHaut = series.priceToCoordinate(troncon.prixHaut);
        const yBas = series.priceToCoordinate(troncon.prixBas);
        if (yHaut === null || yBas === null) continue;

        const y = Math.min(yHaut, yBas);
        const h = Math.max(2, Math.abs(yBas - yHaut));

        // Rectangle vert semi-transparent pour la zone goudronnée
        ctx.fillStyle = COULEUR_TRONCON_FOND;
        ctx.fillRect(xBase, y, largeurDebug, h);

        ctx.strokeStyle = COULEUR_TRONCON_BORDURE;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([]);
        ctx.strokeRect(xBase, y, largeurDebug, h);

        // Label avec la lettre du tronçon (A, B, C, D...) et le nombre de bougies
        ctx.font = 'bold 10px Inter, system-ui, sans-serif';
        ctx.fillStyle = couleurTexte;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const yMilieu = y + h / 2;
        // Affiche "A (18b)" pour le tronçon A avec 18 bougies
        ctx.fillText(`${troncon.lettre} (${troncon.sommeBougies}b)`, xBase + largeurDebug / 2, yMilieu);
      }

      // Dessin de chaque trou entre tronçons
      for (const trou of tp.debug.trous) {
        const yHaut = series.priceToCoordinate(trou.prixHaut);
        const yBas = series.priceToCoordinate(trou.prixBas);
        if (yHaut === null || yBas === null) continue;

        const y = Math.min(yHaut, yBas);
        const h = Math.max(2, Math.abs(yBas - yHaut));

        // Couleur différente selon que le trou a été absorbé ou rejeté
        const fondTrou = trou.estAbsorbe ? COULEUR_TROU_ABSORBE_FOND : COULEUR_TROU_REJETE_FOND;
        const bordureTrou = trou.estAbsorbe ? COULEUR_TROU_ABSORBE_BORDURE : COULEUR_TROU_REJETE_BORDURE;

        ctx.fillStyle = fondTrou;
        ctx.fillRect(xBase, y, largeurDebug, h);

        ctx.strokeStyle = bordureTrou;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.strokeRect(xBase, y, largeurDebug, h);

        // Label avec le ratio du trou et son statut
        ctx.font = 'bold 9px Inter, system-ui, sans-serif';
        ctx.fillStyle = trou.estAbsorbe ? '#f59e0b' : '#f43f5e';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const yMilieuTrou = y + h / 2;
        const icone = trou.estAbsorbe ? '✅' : '❌';
        ctx.fillText(`${icone} ${trou.ratioPourcent}%`, xBase + largeurDebug / 2, yMilieuTrou);
      }
    }

    // Dessin du debug pour chaque TP Achat
    if (resultat.tpOptimauxAchat) {
      for (let i = 0; i < resultat.tpOptimauxAchat.length; i++) {
        dessinerDebugTP(resultat.tpOptimauxAchat[i], '#10b981', i);
      }
    }

    // Dessin du debug pour chaque TP Vente
    if (resultat.tpOptimauxVente) {
      for (let i = 0; i < resultat.tpOptimauxVente.length; i++) {
        dessinerDebugTP(resultat.tpOptimauxVente[i], '#f43f5e', i);
      }
    }

    ctx.restore();
  }
}
