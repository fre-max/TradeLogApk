import type { IndicatorScript, IndicatorContext, IndicatorExecutionResult, VisualPrimitives, VariableExterneDef } from '@/types/indicatorScript';
import { calculerLuxAlgoSMC } from './luxAlgoSMC';
import { calculerProtectedSwings } from './protectedSwings';
import { calculerZigZag } from './zigzag';
import { calculerUnmitigatedVolumeProfile } from './unmitigatedVolumeProfile';
import {
  calculerDetectionLiquidite,
  calculerSweepSpringValidation,
  calculerDetectionLiquiditeEQ,
  calculerDetectionLiquiditeSRTL,
  calculerShvedSupplyDemand,
  calculerUnmitigatedOverlapProfile,
  calculerFractalLtfEntry,
  calculerMoneyManagementRules,
  calculerMtfConductor,
  calculerCompleteSetupVisualizer,
} from '@/lib/bot/modules';
import { calculerOverMitigationHighway } from './overMitigationHighway';
import { calculerMethodeACompression } from './methodeACompressionRatio';
import { calculerMethodeBOverlap } from './methodeBOverlapSurface';
import { calculerMethodeCSlice } from './methodeCSliceDensity';
import { calculerWyckoffPointAndFigure } from './wyckoffPointFigure';
import { calculerFractalZigZag } from './fractalZigZag';
import { calculerCandlestickPatterns } from './candlestickPatterns';
import { calculerLiquidationReintegration } from './liquidationReintegration';
import { calculerLiquidationSweepCombo } from './liquidationSweepCombo';
import { calculerLiquidationSweepPointFigure } from './liquidationSweepPointFigure';
import { calculerLiquidationSweepShved } from './liquidationSweepShved';
import { calculerLiquidationSweepChevauchementExtremes } from './liquidationSweepChevauchementExtremes';
import { calculerLiquidationSweepChevauchementVagueOpposee } from './liquidationSweepChevauchementVagueOpposee';
import { calculerLiquidationSweepChevauchementMultiVagues } from './liquidationSweepChevauchementMultiVagues';

// Clé de stockage local pour persister les indicateurs personnalisés sur le smartphone
const CLE_STORAGE_INDICATEURS = 'tradelog_indicator_scripts_v2';
const CLE_STORAGE_VERSION_INDICATEURS = 'tradelog_indicators_catalogue_version';
const CLE_STORAGE_INDICATEURS_SUPPRIMES = 'tradelog_indicators_deleted_ids';
const VERSION_CATALOGUE_INDICATEURS = '3.16.0';

/**
 * 5 indicateurs officiels et modulaires pré-installés par défaut.
 * Ces scripts peuvent être consultés, édités ou dupliqués directement dans l'application.
 */
export const INDICATEURS_PAR_DEFAUT: IndicatorScript[] = [
  {
    id: 'script-luxalgo-smc',
    nom: 'LuxAlgo Smart Money Concepts (SMC)',
    description: 'Cartographie complète SMC : Order Blocks mitigés/non-mitigés, cassures BOS / CHoCH, zones Premium/Discount et Equal Highs/Lows.',
    auteur: 'LuxAlgo / TradeLog',
    version: '2.0.0',
    type: 'overlay',
    actif: true,
    visibleSurGraphique: true,
    collecteActive: true,
    parametres: {
      swingLength: 20,
      internalLength: 5,
      maxOrderBlocks: 10,
      afficherCassures: true,
      afficherOrderBlocks: true,
      afficherZonesPD: true,
    },
    definitionsVariables: [
      {
        cle: 'swingLength',
        label: 'Longueur des Swings Majeurs',
        description: 'Nombre de bougies nécessaires pour valider un sommet ou un creux majeur',
        type: 'number',
        valeurParDefaut: 20,
        min: 5,
        max: 100,
        step: 1,
        groupe: 'Structure de Marché',
      },
      {
        cle: 'internalLength',
        label: 'Longueur Structure Interne',
        description: 'Sensibilité pour la sous-structure et les micro-cassures',
        type: 'number',
        valeurParDefaut: 5,
        min: 2,
        max: 50,
        step: 1,
        groupe: 'Structure de Marché',
      },
      {
        cle: 'maxOrderBlocks',
        label: "Nombre Max d'Order Blocks",
        description: 'Limite le nombre d\'Order Blocks affichés simultanément à l\'écran',
        type: 'number',
        valeurParDefaut: 10,
        min: 1,
        max: 30,
        step: 1,
        groupe: 'Zones Institutionnelles',
      },
      {
        cle: 'afficherCassures',
        label: 'Afficher les Cassures (BOS / CHoCH)',
        description: 'Trace les lignes horizontales des cassures de structure validées',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Affichage Graphique',
      },
      {
        cle: 'afficherOrderBlocks',
        label: 'Afficher les Boîtes Order Blocks',
        description: 'Colore les zones institutionnelles d\'achats et de ventes',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Affichage Graphique',
      },
      {
        cle: 'afficherZonesPD',
        label: 'Afficher Zones Premium & Discount',
        description: 'Délimite les 50% supérieurs (Premium) et inférieurs (Discount) du range',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Affichage Graphique',
      },
    ],
    creeLe: '2026-09-23T00:00:00.000Z',
    misAJourLe: '2026-09-23T00:00:00.000Z',
    code: `/**
 * Indicateur Scriptable : LuxAlgo Smart Money Concepts
 * Calcule la structure de marché (BOS/CHoCH), Order Blocks et zones Premium/Discount.
 */
return {
  calculer: function(contexte) {
    const { bougies, parametres } = contexte;
    if (!bougies || bougies.length < 10) {
      return { donnees: {}, primitives: {} };
    }

    // Appel au moteur SMC optimisé
    const smc = calculerLuxAlgoSMC(bougies, {
      swingLength: Number(parametres.swingLength || 20),
      internalLength: Number(parametres.internalLength || 5),
      maxOrderBlocks: Number(parametres.maxOrderBlocks || 10),
    });

    const boites = [];
    const lignes = [];
    const labels = [];

    // 1️⃣ Conversion des Order Blocks en primitives boîtes
    if (parametres.afficherOrderBlocks && smc.orderBlocks) {
      for (const ob of smc.orderBlocks) {
        const estBullish = ob.type === 'BULLISH';
        boites.push({
          id: 'ob-' + ob.indexDebut,
          prixHaut: ob.high,
          prixBas: ob.low,
          dateDebut: ob.tempsDebut,
          couleurFond: estBullish ? 'rgba(38, 166, 154, 0.22)' : 'rgba(239, 83, 80, 0.22)',
          couleurBordure: estBullish ? '#26a69a' : '#ef5350',
          label: (estBullish ? '+OB' : '-OB') + (ob.mitigated ? ' (Mitigé)' : ''),
        });
      }
    }

    // 2️⃣ Conversion des cassures de structure (BOS / CHoCH)
    if (parametres.afficherCassures && smc.cassures) {
      for (const c of smc.cassures) {
        const estBull = c.direction === 'BULLISH';
        lignes.push({
          id: 'cassure-' + c.indexCassure,
          prix: c.prixCassure,
          dateDebut: c.tempsPivot,
          dateFin: c.tempsCassure,
          couleur: estBull ? '#26a69a' : '#ef5350',
          style: c.type === 'CHoCH' ? 'dashed' : 'solid',
          label: c.type + (estBull ? ' ▲' : ' ▼'),
        });
      }
    }

    // Retour des données télémétriques pour les bots et des primitives pour le canvas
    return {
      donnees: smc,
      primitives: { boites, lignes, labels },
      typeSpecial: 'luxalgo-smc'
    };
  }
};`
  },
  {
    id: 'script-protected-swings',
    nom: 'Protected Swings (LuxAlgo)',
    description: 'Identifie les creux et sommets protégés, les balayages de liquidité (Sweeps) et les niveaux institutionnels clés.',
    auteur: 'LuxAlgo / TradeLog',
    version: '1.2.0',
    type: 'overlay',
    actif: true,
    visibleSurGraphique: true,
    collecteActive: true,
    parametres: {
      sweepSensitivity: 5,
      afficherLabels: true,
      afficherNiveaux: true,
    },
    definitionsVariables: [
      {
        cle: 'sweepSensitivity',
        label: 'Sensibilité des Balayages (Sweeps)',
        description: 'Marge de sensibilité en bougies pour détecter les mèches de liquidité',
        type: 'number',
        valeurParDefaut: 5,
        min: 1,
        max: 25,
        step: 1,
        groupe: 'Détection des Niveaux',
      },
      {
        cle: 'afficherLabels',
        label: 'Afficher les Badges Prot High/Low',
        description: 'Indique par du texte le prix des sommets et creux protégés',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Affichage Graphique',
      },
      {
        cle: 'afficherNiveaux',
        label: 'Afficher les Lignes Horizontales',
        description: 'Trace les niveaux de supports/résistances institutionnels protégés',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Affichage Graphique',
      },
    ],
    creeLe: '2026-09-23T00:00:00.000Z',
    misAJourLe: '2026-09-23T00:00:00.000Z',
    code: `/**
 * Indicateur Scriptable : Protected Swings
 * Détecte les swings hauts/bas protégés et les sweeps de liquidité
 */
return {
  calculer: function(contexte) {
    const { bougies, parametres } = contexte;
    if (!bougies || bougies.length < 5) return { donnees: {}, primitives: {} };

    const resultat = calculerProtectedSwings(bougies, {
      sweepSensitivity: Number(parametres.sweepSensitivity || 5),
    });

    const lignes = [];
    const labels = [];

    // Niveaux Swing High protégés
    if (resultat.swingsHigh) {
      for (const sh of resultat.swingsHigh) {
        lignes.push({
          prix: sh.prix,
          dateDebut: sh.date,
          couleur: '#2962ff',
          style: 'solid',
          label: 'Prot High (' + sh.prix.toFixed(4) + ')'
        });
      }
    }

    // Niveaux Swing Low protégés
    if (resultat.swingsLow) {
      for (const sl of resultat.swingsLow) {
        lignes.push({
          prix: sl.prix,
          dateDebut: sl.date,
          couleur: '#ff9800',
          style: 'solid',
          label: 'Prot Low (' + sl.prix.toFixed(4) + ')'
        });
      }
    }

    return {
      donnees: resultat,
      primitives: { lignes, labels },
      typeSpecial: 'protected-swings'
    };
  }
};`
  },
  {
    id: 'script-zigzag-smc',
    nom: 'ZigZag Structure SMC',
    description: 'Décompose les vagues de marché avec étiquetage automatique des extrêmes structuraux (HH, HL, LH, LL).',
    auteur: 'TradeLog Quant',
    version: '1.0.0',
    type: 'overlay',
    actif: true,
    visibleSurGraphique: true,
    collecteActive: true,
    parametres: {
      depth: 5,
      afficherLabels: true,
    },
    definitionsVariables: [
      {
        cle: 'depth',
        label: 'Profondeur des Vagues (Depth)',
        description: 'Nombre de bougies pour valider un pivot haut ou bas sans nouvel extrême',
        type: 'number',
        valeurParDefaut: 5,
        min: 2,
        max: 50,
        step: 1,
        groupe: 'Calcul de Structure',
      },
      {
        cle: 'afficherLabels',
        label: 'Afficher les Labels Structuraux (HH, HL, LH, LL)',
        description: 'Colore les sommets et creux pour identifier la tendance de marché',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Affichage Graphique',
      },
    ],
    creeLe: '2026-09-23T00:00:00.000Z',
    misAJourLe: '2026-09-23T00:00:00.000Z',
    code: `/**
 * Indicateur Scriptable : ZigZag Structure
 * Trace les segments de creux/sommets avec labels HH/HL/LH/LL
 */
return {
  calculer: function(contexte) {
    const { bougies, parametres } = contexte;
    if (!bougies || bougies.length < 5) return { donnees: {}, primitives: {} };

    const zigzag = calculerZigZag(bougies, {
      depth: Number(parametres.depth || 5),
      afficherLabelsSMC: true,
    });

    const lignes = [];
    const labels = [];

    if (zigzag.pivots && zigzag.pivots.length >= 2) {
      for (let i = 1; i < zigzag.pivots.length; i++) {
        const p1 = zigzag.pivots[i - 1];
        const p2 = zigzag.pivots[i];
        lignes.push({
          prix: p2.prix,
          dateDebut: p1.date,
          dateFin: p2.date,
          couleur: '#d1d4dc',
          style: 'solid',
        });

        if (p2.labelSMC) {
          labels.push({
            prix: p2.prix,
            date: p2.date,
            texte: p2.labelSMC,
            couleur: p2.type === 'high' ? '#ef5350' : '#26a69a',
            position: p2.type === 'high' ? 'above' : 'below',
          });
        }
      }
    }

    return {
      donnees: zigzag,
      primitives: { lignes, labels },
      typeSpecial: 'zigzag'
    };
  }
};`
  },
  {
    id: 'script-unmitigated-profile',
    nom: 'SMC Unmitigated Volume Profile',
    description: 'Profil de volume sur vagues ZigZag identifiant les POC et zones non encore retestées par le prix.',
    auteur: 'TradeLog SMC',
    version: '1.0.0',
    type: 'overlay',
    actif: true,
    visibleSurGraphique: true,
    collecteActive: true,
    parametres: {
      zigzagDepth: 8,
      maxVagues: 5,
    },
    definitionsVariables: [
      {
        cle: 'zigzagDepth',
        label: 'Profondeur de Vague ZigZag',
        description: 'Sensibilité du découpage des vagues de volume',
        type: 'number',
        valeurParDefaut: 8,
        min: 3,
        max: 40,
        step: 1,
        groupe: 'Paramètres du Profil',
      },
      {
        cle: 'maxVagues',
        label: 'Nombre de Vagues Analysées',
        description: 'Nombre de segments ZigZag récents pris en compte pour agréger les volumes',
        type: 'number',
        valeurParDefaut: 5,
        min: 1,
        max: 15,
        step: 1,
        groupe: 'Paramètres du Profil',
      },
    ],
    creeLe: '2026-09-23T00:00:00.000Z',
    misAJourLe: '2026-09-23T00:00:00.000Z',
    code: `/**
 * Indicateur Scriptable : Unmitigated Volume Profile
 * Calcule les zones de liquidité non mitigées et les POC
 */
return {
  calculer: function(contexte) {
    const { bougies, parametres } = contexte;
    if (!bougies || bougies.length < 10) return { donnees: {}, primitives: {} };

    const uvp = calculerUnmitigatedVolumeProfile(bougies, {
      zigzagDepth: Number(parametres.zigzagDepth || 8),
      maxVagues: Number(parametres.maxVagues || 5),
    });

    const lignes = [];
    const boites = [];

    // Lignes de POC (Point of Control) sur les vagues
    if (uvp.paliers) {
      for (const p of uvp.paliers) {
        lignes.push({
          prix: p.prix,
          dateDebut: bougies[Math.max(0, bougies.length - 80)].time,
          couleur: '#e91e63',
          style: 'solid',
          label: 'POC'
        });
      }
    }

    return {
      donnees: uvp,
      primitives: { boites, lignes },
      typeSpecial: 'unmitigated-profile'
    };
  }
};`
  },
  {
    id: 'script-fvg-imbalance',
    nom: 'Fair Value Gap (FVG) Simple',
    description: 'Détecteur d\'imbalance en 3 bougies. Modèle de script prêt à l\'emploi pour créer vos propres indicateurs personnalisés.',
    auteur: 'Exemple Modèle',
    version: '1.0.0',
    type: 'overlay',
    actif: false,
    visibleSurGraphique: false,
    collecteActive: true,
    parametres: {
      couleurHaussiere: 'rgba(38, 166, 154, 0.25)',
      couleurBaissiere: 'rgba(239, 83, 80, 0.25)',
    },
    definitionsVariables: [
      {
        cle: 'couleurHaussiere',
        label: 'Couleur FVG Haussier',
        description: 'Couleur de remplissage pour les zones de déséquilibre acheteuses',
        type: 'string',
        valeurParDefaut: 'rgba(38, 166, 154, 0.25)',
        groupe: 'Style Visuel',
      },
      {
        cle: 'couleurBaissiere',
        label: 'Couleur FVG Baissier',
        description: 'Couleur de remplissage pour les zones de déséquilibre vendeuses',
        type: 'string',
        valeurParDefaut: 'rgba(239, 83, 80, 0.25)',
        groupe: 'Style Visuel',
      },
    ],
    creeLe: '2026-09-23T00:00:00.000Z',
    misAJourLe: '2026-09-23T00:00:00.000Z',
    code: `/**
 * Modèle de script : Détecteur FVG
 * Montre comment créer un indicateur personnalisé en 20 lignes de code !
 */
return {
  calculer: function(contexte) {
    const { bougies, parametres } = contexte;
    const boites = [];

    if (!bougies || bougies.length < 3) return { donnees: {}, primitives: { boites } };

    // Parcours des bougies pour repérer les gaps entre bougie i-2 et i
    for (let i = 2; i < bougies.length; i++) {
      const b0 = bougies[i - 2];
      const b2 = bougies[i];

      // FVG Haussier (Achat)
      if (b2.low > b0.high) {
        boites.push({
          prixHaut: b2.low,
          prixBas: b0.high,
          dateDebut: b0.time,
          dateFin: b2.time,
          couleurFond: String(parametres.couleurHaussiere || 'rgba(38, 166, 154, 0.25)'),
          couleurBordure: '#26a69a',
          label: 'FVG +'
        });
      }
      // FVG Baissier (Vente)
      else if (b2.high < b0.low) {
        boites.push({
          prixHaut: b0.low,
          prixBas: b2.high,
          dateDebut: b0.time,
          dateFin: b2.time,
          couleurFond: String(parametres.couleurBaissiere || 'rgba(239, 83, 80, 0.25)'),
          couleurBordure: '#ef5350',
          label: 'FVG -'
        });
      }
    }

    return {
      donnees: { totalFVG: boites.length },
      primitives: { boites }
    };
  }
};`
  },
  {
    id: 'script-detection-liquidite',
    nom: 'Détection Liquidité (BSL / SSL)',
    description: 'Détecte les niveaux de liquidité BSL (sommets) et SSL (creux) via les pivots hauts/bas. Expose les zones où les stop-loss s\'accumulent.',
    auteur: 'Wyckoff Bot / TradeLog',
    version: '1.0.0',
    type: 'overlay',
    actif: true,
    visibleSurGraphique: true,
    collecteActive: true,
    parametres: {
      sensibilitePivot: 5,
      maxLookbackBars: 1000,
      afficherLignes: true,
      afficherEtiquettes: true,
    },
    definitionsVariables: [
      {
        cle: 'sensibilitePivot',
        label: 'Sensibilité des Pivots',
        description: 'Nombre de bougies à gauche et à droite pour confirmer un pivot haut ou bas',
        type: 'number',
        valeurParDefaut: 5,
        min: 2,
        max: 20,
        step: 1,
        groupe: 'Paramètres de Détection',
      },
      {
        cle: 'maxLookbackBars',
        label: 'Bougies Historiques Analysées',
        description: 'Nombre maximum de bougies en arrière à analyser',
        type: 'number',
        valeurParDefaut: 1000,
        min: 100,
        max: 5000,
        step: 100,
        groupe: 'Paramètres de Détection',
      },
      {
        cle: 'afficherLignes',
        label: 'Afficher les Lignes BSL / SSL',
        description: 'Trace les lignes horizontales prolongées des niveaux de liquidité',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Affichage Graphique',
      },
      {
        cle: 'afficherEtiquettes',
        label: 'Afficher les Étiquettes',
        description: 'Affiche les labels BSL (Acheteurs) et SSL (Vendeurs) sur le graphique',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Affichage Graphique',
      },
    ],
    creeLe: '2026-09-23T00:00:00.000Z',
    misAJourLe: '2026-09-23T00:00:00.000Z',
    code: `/**
 * Indicateur Scriptable : Détection Liquidité (BSL / SSL)
 * Identifie les niveaux où la liquidité s'accumule (sommets BSL et creux SSL)
 */
return {
  calculer: function(contexte) {
    const { bougies, parametres } = contexte;
    if (!bougies || bougies.length < 20) return { donnees: {}, primitives: {} };

    const resultat = calculerDetectionLiquidite(bougies, {
      sensibilitePivot: Number(parametres.sensibilitePivot || 5),
      maxLookbackBars: Number(parametres.maxLookbackBars || 1000),
    });

    const lignes = [];
    const labels = [];

    // Tracé des lignes BSL (résistances / sommets de liquidité acheteuse)
    for (const n of resultat.niveaux) {
      if (n.type === 'BSL' && parametres.afficherLignes) {
        lignes.push({
          id: 'bsl-' + n.indexOrigine,
          prix: n.prix,
          dateDebut: n.tempsOrigine,
          dateFin: n.tempsFin,
          couleur: '#f23645',
          style: 'dashed',
          label: parametres.afficherEtiquettes ? 'BSL (Acheteurs)' : '',
        });
      }
      if (n.type === 'SSL' && parametres.afficherLignes) {
        lignes.push({
          id: 'ssl-' + n.indexOrigine,
          prix: n.prix,
          dateDebut: n.tempsOrigine,
          dateFin: n.tempsFin,
          couleur: '#089981',
          style: 'dashed',
          label: parametres.afficherEtiquettes ? 'SSL (Vendeurs)' : '',
        });
      }
    }

    return {
      donnees: resultat,
      primitives: { lignes, labels },
      typeSpecial: 'detection-liquidite'
    };
  }
};`
  },
  {
    id: 'script-sweep-spring-validation',
    nom: 'Détection de Liquidation (Sweep / Spring)',
    description: 'Valide les liquidations et balayages de liquidité (Springs/UTAD). Détecte automatiquement l\'indicateur de liquidité binôme actif sur le graphique (Shved, Zones S/R, EQH/EQL, etc.).',
    auteur: 'Wyckoff Bot / TradeLog',
    version: '2.0.0',
    type: 'overlay',
    actif: true,
    visibleSurGraphique: true,
    collecteActive: true,
    parametres: {
      sourceLiquidite: 'auto',
      timeframeLiquidite: 'M15',
      sensibilitePivot: 5,
      maxLookbackBars: 1000,
      ratioMaxTemps: 0.10,
      nbBougiesConsolidation: 3,
      activerSpringSSL: true,
      activerUTADBSL: true,
    },
    definitionsVariables: [
      {
        cle: 'sourceLiquidite',
        label: 'Module Source de Liquidité',
        description: 'Module de liquidité à analyser. En mode Automatique, détecte automatiquement l\'indicateur de liquidité actif sur le graphique.',
        type: 'select',
        valeurParDefaut: 'auto',
        options: [
          { label: 'Automatique (Détecte le binôme sur le graphique)', value: 'auto' },
          { label: 'Forcer Shved Supply & Demand', value: 'shved' },
          { label: 'Forcer Pivots Hauts/Bas Standards', value: 'pivots' },
        ],
        groupe: 'Connexion au Module Liquidité (Binôme)',
      },
      {
        cle: 'timeframeLiquidite',
        label: 'Unité de Temps de la Liquidité (Option B / MTF)',
        description: 'Unité de temps de la liquidité interne analysée (ex: M15 sur graphique H4)',
        type: 'select',
        valeurParDefaut: 'M15',
        options: [
          { label: 'Graphique Actuel', value: 'ACTUEL' },
          { label: 'M1 (1 minute)', value: 'M1' },
          { label: 'M5 (5 minutes)', value: 'M5' },
          { label: 'M15 (15 minutes)', value: 'M15' },
          { label: 'M30 (30 minutes)', value: 'M30' },
          { label: 'H1 (1 heure)', value: 'H1' },
          { label: 'H4 (4 heures)', value: 'H4' },
          { label: 'D1 (Journalier)', value: 'D1' },
        ],
        groupe: 'Connexion au Module Liquidité (Binôme)',
      },
      {
        cle: 'sensibilitePivot',
        label: 'Sensibilité des Pivots (si mode Pivots)',
        description: 'Nombre de bougies pour valider un pivot du module de détection de liquidité',
        type: 'number',
        valeurParDefaut: 5,
        min: 2,
        max: 20,
        step: 1,
        groupe: 'Connexion au Module Liquidité (Binôme)',
      },
      {
        cle: 'maxLookbackBars',
        label: 'Bougies Historiques Analysées',
        description: 'Nombre de bougies en arrière à analyser',
        type: 'number',
        valeurParDefaut: 1000,
        min: 100,
        max: 5000,
        step: 100,
        groupe: 'Connexion au Module Liquidité (Binôme)',
      },
      {
        cle: 'ratioMaxTemps',
        label: 'Ratio Max Temps Hors Structure',
        description: 'Proportion maximale du temps passé hors de la structure (1/10 = 0.10)',
        type: 'number',
        valeurParDefaut: 0.10,
        min: 0.01,
        max: 0.50,
        step: 0.01,
        groupe: 'Règles du Sweep (Spring)',
      },
      {
        cle: 'nbBougiesConsolidation',
        label: 'Bougies de Confirmation',
        description: 'Nombre de bougies consécutives confinées pour valider le signal',
        type: 'number',
        valeurParDefaut: 3,
        min: 1,
        max: 10,
        step: 1,
        groupe: 'Règles du Sweep (Spring)',
      },
      {
        cle: 'activerSpringSSL',
        label: 'Valider les Springs d\'Achat (SSL)',
        description: 'Active la détection des Springs haussiers sur les creux de liquidité',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Directions',
      },
      {
        cle: 'activerUTADBSL',
        label: 'Valider les UTAD de Vente (BSL)',
        description: 'Active la détection des Upthrusts baissiers sur les sommets de liquidité',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Directions',
      },
    ],
    creeLe: '2026-09-23T00:00:00.000Z',
    misAJourLe: '2026-09-24T00:00:00.000Z',
    code: `/**
 * Indicateur Scriptable : Sweep / Spring Wyckoff Validator
 * Valide les prises de liquidité avec ratio temporel et confirmation
 */
return {
  calculer: function(contexte) {
    const { bougies, parametres, donneesM1, resultatsPrecedents, scriptsActifs } = contexte;
    if (!bougies || bougies.length < 50) return { donnees: {}, primitives: {} };

    const resultat = calculerSweepSpringValidation(bougies, {
      sourceLiquidite: (parametres.sourceLiquidite || 'auto'),
      timeframeLiquidite: String(parametres.timeframeLiquidite || 'M15'),
      donneesM1: donneesM1,
      resultatsPrecedents: resultatsPrecedents,
      scriptsActifs: scriptsActifs,
      sensibilitePivot: Number(parametres.sensibilitePivot || 5),
      maxLookbackBars: Number(parametres.maxLookbackBars || 1000),
      ratioMaxTemps: Number(parametres.ratioMaxTemps || 0.10),
      nbBougiesConsolidation: Number(parametres.nbBougiesConsolidation || 3),
      activerSpringSSL: Boolean(parametres.activerSpringSSL),
      activerUTADBSL: Boolean(parametres.activerUTADBSL),
    });

    const boites = [];
    const labels = [];

    // Zones de consolidation validées (rectangles colorés)
    for (const b of resultat.boites) {
      boites.push({
        id: 'sweep-' + b.indexDebut + '-' + b.type,
        prixHaut: b.prixHaut,
        prixBas: b.prixBas,
        dateDebut: b.tempsDebut,
        dateFin: b.tempsFin,
        couleurFond: b.type === 'achat'
          ? 'rgba(8, 153, 129, 0.20)'
          : 'rgba(242, 54, 69, 0.20)',
        couleurBordure: b.type === 'achat' ? '#089981' : '#f23645',
        label: b.type === 'achat' ? '🟢 Spring' : '🔴 UTAD',
      });
    }

    // Flèches de signaux (labels positionnés)
    for (const s of resultat.signaux) {
      labels.push({
        id: 'signal-' + s.indexSignal + '-' + s.direction,
        prix: s.prixEntree,
        date: s.tempsSignal,
        texte: s.direction === 'achat' ? '▲ Spring' : '▼ UTAD',
        couleur: s.direction === 'achat' ? '#00c853' : '#ff1744',
        position: s.direction === 'achat' ? 'below' : 'above',
      });
    }

    return {
      donnees: resultat,
      primitives: { boites, labels },
      typeSpecial: 'sweep-spring'
    };
  }
};`
  },
  {
    id: 'script-fractal-ltf-entry',
    nom: 'Entrées Fractales LTF (Order Blocks & micro-BOS)',
    description: 'Scanne la zone protégée issue de la liquidation pour détecter les Order Blocks fractals et déclencher des entrées sniper avec Stop Loss ultra-serré.',
    auteur: 'TradeLog Bot / SMC',
    version: '1.0.0',
    type: 'overlay',
    actif: true,
    visibleSurGraphique: true,
    collecteActive: true,
    parametres: {
      choixNiveauEntree: 'median_ob',
      tamponSLPips: 1.0,
      activerAchats: true,
      activerVentes: true,
      afficherZoneProtegee: true,
      afficherOrderBlocks: true,
      afficherLignesEntreeSL: true,
      maxLookbackBars: 600,
    },
    definitionsVariables: [
      {
        cle: 'choixNiveauEntree',
        label: "Niveau d'Exécution de l'Entrée",
        description: "Point de déclenchement dans l'Order Block (50% Médian recommandé pour un R:R maximal)",
        type: 'select',
        valeurParDefaut: 'median_ob',
        options: [
          { label: "50% Équilibre de l'Order Block (Sniper)", value: 'median_ob' },
          { label: "Bordure Extérieure de l'Order Block (Agressif)", value: 'bordure_ob' },
          { label: "Clôture de la Bougie de Retest (Prudent)", value: 'cloture_confirmation' },
        ],
        groupe: "Exécution & Déclencheur",
      },
      {
        cle: 'tamponSLPips',
        label: 'Marge SL sous Prix Protégé (Pips)',
        description: 'Pips de sécurité ajoutés au-delà du creux ou sommet extrême de liquidation',
        type: 'number',
        valeurParDefaut: 1.0,
        min: 0.0,
        max: 10.0,
        step: 0.5,
        groupe: "Gestion du Risque & Invalidation",
      },
      {
        cle: 'activerAchats',
        label: "Activer les Signaux d'Achat (Long)",
        description: 'Détecte les Order Blocks haussiers après les Springs de liquidité',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Directions',
      },
      {
        cle: 'activerVentes',
        label: 'Activer les Signaux de Vente (Short)',
        description: 'Détecte les Order Blocks baissiers après les UTAD de liquidité',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Directions',
      },
      {
        cle: 'afficherZoneProtegee',
        label: 'Afficher la Boîte de Zone Protégée',
        description: 'Trace le rectangle [Prix Protégé ↔ BOS de réintégration]',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Affichage Graphique',
      },
      {
        cle: 'afficherOrderBlocks',
        label: "Afficher les Boîtes d'Order Blocks LTF",
        description: 'Affiche les rectangles des Order Blocks internes validés',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Affichage Graphique',
      },
      {
        cle: 'afficherLignesEntreeSL',
        label: 'Afficher les Lignes Entry et SL',
        description: "Trace les lignes horizontales d'entrée et de Stop Loss avec labels pips",
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Affichage Graphique',
      },
      {
        cle: 'maxLookbackBars',
        label: 'Bougies Historiques Analysées',
        description: 'Nombre de bougies récentes analysées pour les entrées fractales',
        type: 'number',
        valeurParDefaut: 600,
        min: 100,
        max: 3000,
        step: 50,
        groupe: 'Historique',
      },
    ],
    creeLe: '2026-10-02T00:00:00.000Z',
    misAJourLe: '2026-10-02T00:00:00.000Z',
    code: `/**
 * Indicateur Scriptable : Entrées Fractales LTF
 * Détecte les Order Blocks et génère des entrées chirurgicales dans la zone protégée
 */
return {
  calculer: function(contexte) {
    const { bougies, parametres, resultatsPrecedents, donneesM1 } = contexte;
    if (!bougies || bougies.length < 30) return { donnees: {}, primitives: {} };

    return calculerFractalLtfEntry(bougies, {
      choixNiveauEntree: String(parametres.choixNiveauEntree || 'median_ob'),
      tamponSLPips: Number(parametres.tamponSLPips || 1.0),
      activerAchats: parametres.activerAchats !== false,
      activerVentes: parametres.activerVentes !== false,
      afficherZoneProtegee: parametres.afficherZoneProtegee !== false,
      afficherOrderBlocks: parametres.afficherOrderBlocks !== false,
      afficherLignesEntreeSL: parametres.afficherLignesEntreeSL !== false,
      maxLookbackBars: Number(parametres.maxLookbackBars || 600),
      resultatsPrecedents: resultatsPrecedents,
      donneesM1: donneesM1,
    });
  }
};`
  },
  {
    id: 'script-money-management',
    nom: 'Money Management Dynamique (R:R, Lot & Break-Even)',
    description: 'Relie l\'entrée chirurgicale LTF au TP Optimal pour calculer le R:R, dimensionner la taille de lot exacte et piloter le passage à Break-Even.',
    auteur: 'TradeLog Bot / SMC',
    version: '1.0.0',
    type: 'overlay',
    actif: true,
    visibleSurGraphique: true,
    collecteActive: true,
    parametres: {
      ratioRRMin: 2.5,
      capitalCompte: 10000,
      risquePourcent: 1.0,
      ratioDeclenchementBE: 0.50,
      afficherBoiteTrade: true,
      afficherNiveauBE: true,
      afficherBadgeResume: true,
    },
    definitionsVariables: [
      {
        cle: 'ratioRRMin',
        label: 'Ratio Risque/Rendement Minimal (R:R Min)',
        description: 'Seuil de rentabilité mathématique. Rejette automatiquement les trades en dessous de ce ratio (ex: 2.5)',
        type: 'number',
        valeurParDefaut: 2.5,
        min: 1.0,
        max: 10.0,
        step: 0.1,
        groupe: 'Filtre de Rentabilité',
      },
      {
        cle: 'capitalCompte',
        label: 'Capital du Compte ($)',
        description: 'Solde du compte servant de base pour le calcul du risque monétaire et de la taille de lot',
        type: 'number',
        valeurParDefaut: 10000,
        min: 100,
        max: 1000000,
        step: 500,
        groupe: 'Dimensionnement de Position',
      },
      {
        cle: 'risquePourcent',
        label: 'Risque par Trade (% Capital)',
        description: 'Pourcentage maximum du capital alloué au risque de perte sur ce setup (ex: 1.0% = 100$ sur 10k)',
        type: 'number',
        valeurParDefaut: 1.0,
        min: 0.1,
        max: 5.0,
        step: 0.1,
        groupe: 'Dimensionnement de Position',
      },
      {
        cle: 'ratioDeclenchementBE',
        label: 'Seuil de Déclenchement Break-Even (%)',
        description: 'Proportion de la distance vers le TP à laquelle le Stop Loss est remonté à Break-Even (ex: 0.50 = 50%)',
        type: 'number',
        valeurParDefaut: 0.50,
        min: 0.20,
        max: 0.80,
        step: 0.05,
        groupe: 'Gestion Active du Trade',
      },
      {
        cle: 'afficherBoiteTrade',
        label: 'Afficher la Boîte de Trade (Gain / Risque)',
        description: 'Dessine les rectangles verts et rouges du ratio Risque/Rendement sur le graphique',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Affichage Graphique',
      },
      {
        cle: 'afficherNiveauBE',
        label: 'Afficher la Ligne de Seuil Break-Even',
        description: 'Trace une ligne en pointillés jaunes indiquant le niveau cible pour sécuriser le trade',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Affichage Graphique',
      },
      {
        cle: 'afficherBadgeResume',
        label: 'Afficher le Badge de Synthèse',
        description: 'Affiche l\'étiquette récapitulative : R:R, taille de lot recommandée et gain monétaire estimé',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Affichage Graphique',
      },
    ],
    creeLe: '2026-10-02T00:00:00.000Z',
    misAJourLe: '2026-10-02T00:00:00.000Z',
    code: `/**
 * Indicateur Scriptable : Money Management Dynamique
 * Évalue le R:R, calcule la taille de lot et pilote les sécurisations Break-Even
 */
return {
  calculer: function(contexte) {
    const { bougies, parametres, resultatsPrecedents } = contexte;
    if (!bougies || bougies.length < 20) return { donnees: {}, primitives: {} };

    return calculerMoneyManagementRules(bougies, {
      ratioRRMin: Number(parametres.ratioRRMin || 2.5),
      capitalCompte: Number(parametres.capitalCompte || 10000),
      risquePourcent: Number(parametres.risquePourcent || 1.0),
      ratioDeclenchementBE: Number(parametres.ratioDeclenchementBE || 0.50),
      afficherBoiteTrade: parametres.afficherBoiteTrade !== false,
      afficherNiveauBE: parametres.afficherNiveauBE !== false,
      afficherBadgeResume: parametres.afficherBadgeResume !== false,
      resultatsPrecedents: resultatsPrecedents,
    });
  }
};`
  },
  {
    id: 'script-mtf-conductor',
    nom: 'Chef d\'Orchestre MTF (Le Drone)',
    description: 'Supervise les unités de temps supérieures (H4/D1) pour piloter l\'extension du TP (Mode Runner) ou la réduction préventive avant un obstacle macro.',
    auteur: 'TradeLog Bot / SMC',
    version: '1.0.0',
    type: 'overlay',
    actif: true,
    visibleSurGraphique: true,
    collecteActive: true,
    parametres: {
      timeframeHTF: 'H4',
      facteurExtensionRunner: 1.5,
      margeObstaclePips: 3.0,
      filtrerContreTendance: true,
      afficherHUDDrone: true,
      afficherLigneTPAjuste: true,
      afficherZonesObstacles: true,
    },
    definitionsVariables: [
      {
        cle: 'timeframeHTF',
        label: 'Unité de Temps Supérieure (HTF)',
        description: 'Timeframe analysé par le drone pour évaluer la macro-structure et les obstacles',
        type: 'select',
        valeurParDefaut: 'H4',
        options: [
          { label: 'H1 (1 heure)', value: 'H1' },
          { label: 'H4 (4 heures)', value: 'H4' },
          { label: 'D1 (Journalier)', value: 'D1' },
        ],
        groupe: 'Supervision Macro',
      },
      {
        cle: 'facteurExtensionRunner',
        label: 'Multiplicateur TP Runner (Extension)',
        description: 'Facteur d\'extension du Take Profit lorsque l\'autoroute HTF est totalement dégagée (ex: 1.5 = +50%)',
        type: 'number',
        valeurParDefaut: 1.5,
        min: 1.1,
        max: 3.0,
        step: 0.1,
        groupe: 'Ajustement des Cibles',
      },
      {
        cle: 'margeObstaclePips',
        label: 'Marge Retrait Obstacle (Pips)',
        description: 'Distance en pips de retrait pour sortir avant une résistance ou un support HTF majeur',
        type: 'number',
        valeurParDefaut: 3.0,
        min: 1.0,
        max: 20.0,
        step: 0.5,
        groupe: 'Ajustement des Cibles',
      },
      {
        cle: 'filtrerContreTendance',
        label: 'Détecter les Trades Contre-Tendance',
        description: 'Alerte et réduit le risque si le trade LTF est à contre-courant du flux macro HTF',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Sécurité & Risque',
      },
      {
        cle: 'afficherHUDDrone',
        label: 'Afficher le Badge HUD du Drone',
        description: 'Affiche le statut et la recommandation du drone directement sur le graphique',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Affichage Graphique',
      },
      {
        cle: 'afficherLigneTPAjuste',
        label: 'Afficher la Ligne du TP Ajusté',
        description: 'Trace la ligne pointillée violette (Runner) ou orange (Sécurité) suggérée par le drone',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Affichage Graphique',
      },
      {
        cle: 'afficherZonesObstacles',
        label: 'Afficher les Boîtes d\'Obstacles HTF',
        description: 'Projette les rectangles des zones de Supply/Demand HTF identifiées',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Affichage Graphique',
      },
    ],
    creeLe: '2026-10-02T00:00:00.000Z',
    misAJourLe: '2026-10-02T00:00:00.000Z',
    code: `/**
 * Indicateur Scriptable : Chef d'Orchestre MTF (Le Drone)
 * Analyse la structure macro pour moduler le TP (Extension Runner ou Réduction Sécurité)
 */
return {
  calculer: function(contexte) {
    const { bougies, parametres, resultatsPrecedents, donneesM1 } = contexte;
    if (!bougies || bougies.length < 20) return { donnees: {}, primitives: {} };

    return calculerMtfConductor(bougies, {
      timeframeHTF: String(parametres.timeframeHTF || 'H4'),
      facteurExtensionRunner: Number(parametres.facteurExtensionRunner || 1.5),
      margeObstaclePips: Number(parametres.margeObstaclePips || 3.0),
      filtrerContreTendance: parametres.filtrerContreTendance !== false,
      afficherHUDDrone: parametres.afficherHUDDrone !== false,
      afficherLigneTPAjuste: parametres.afficherLigneTPAjuste !== false,
      afficherZonesObstacles: parametres.afficherZonesObstacles !== false,
      resultatsPrecedents: resultatsPrecedents,
      donneesM1: donneesM1,
    });
  }
};`
  },
  {
    id: 'script-complete-setup-visualizer',
    nom: 'Aperçu du Bot : Setup Complet & Confluences',
    description: 'Consolide les 6 modules en un setup de trading unifié. Affiche la boîte de position exacte du bot, le palier Break-Even, le TP Runner et la checklist des 6 confluences.',
    auteur: 'TradeLog Bot / SMC',
    version: '1.0.0',
    type: 'overlay',
    actif: true,
    visibleSurGraphique: true,
    collecteActive: true,
    parametres: {
      ratioRRMin: 2.5,
      scoreMinConfluences: 5,
      afficherBoitePosition: true,
      afficherPanneauChecklist: true,
      afficherLigneRunner: true,
    },
    definitionsVariables: [
      {
        cle: 'ratioRRMin',
        label: 'Ratio Risque/Rendement Minimal (R:R)',
        description: 'Exigence minimale de R:R pour considérer le setup du bot comme prêt à trader',
        type: 'number',
        valeurParDefaut: 2.5,
        min: 1.5,
        max: 10.0,
        step: 0.1,
        groupe: 'Critères de Validation',
      },
      {
        cle: 'scoreMinConfluences',
        label: 'Score Minimal de Confluences (sur 6)',
        description: 'Nombre de signaux confluents requis (Sweep, Prix Protégé, OB LTF, TP UOP, R:R, Drone MTF)',
        type: 'number',
        valeurParDefaut: 5,
        min: 3,
        max: 6,
        step: 1,
        groupe: 'Critères de Validation',
      },
      {
        cle: 'afficherBoitePosition',
        label: 'Afficher la Boîte de Position Complète',
        description: 'Trace les rectangles de gain (vert) et de risque (rouge) du trade avec Entry, SL et TP',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Affichage Graphique',
      },
      {
        cle: 'afficherPanneauChecklist',
        label: 'Afficher le Statut et la Checklist',
        description: 'Affiche le badge récapitulatif du bot : confluences réunies et autorisation d\'exécution',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Affichage Graphique',
      },
      {
        cle: 'afficherLigneRunner',
        label: 'Afficher la Cible Runner Étendue',
        description: 'Trace la ligne violette du TP Runner lorsque le drone MTF conseille d\'étendre l\'objectif',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Affichage Graphique',
      },
    ],
    creeLe: '2026-10-02T00:00:00.000Z',
    misAJourLe: '2026-10-02T00:00:00.000Z',
    code: `/**
 * Indicateur Scriptable : Aperçu du Bot (Setup Complet & Confluences)
 * Synthétise les 6 modules dans une boîte de position unifiée
 */
return {
  calculer: function(contexte) {
    const { bougies, parametres, resultatsPrecedents } = contexte;
    if (!bougies || bougies.length < 20) return { donnees: {}, primitives: {} };

    return calculerCompleteSetupVisualizer(bougies, {
      ratioRRMin: Number(parametres.ratioRRMin || 2.5),
      scoreMinConfluences: Number(parametres.scoreMinConfluences || 5),
      afficherBoitePosition: parametres.afficherBoitePosition !== false,
      afficherPanneauChecklist: parametres.afficherPanneauChecklist !== false,
      afficherLigneRunner: parametres.afficherLigneRunner !== false,
      resultatsPrecedents: resultatsPrecedents,
    });
  }
};`
  },
  {
    id: 'script-detection-liquidite-eq',
    nom: 'Détection Liquidité EQH / EQL (Double Tops/Bottoms)',
    description: 'Détecte les accumulations de liquidité institutionnelle sur les sommets égaux (Equal Highs / BSL) et creux égaux (Equal Lows / SSL) selon le modèle SMC Sweep Profiler.',
    auteur: 'Wyckoff Bot / TradeLog',
    version: '1.0.0',
    type: 'overlay',
    actif: true,
    visibleSurGraphique: true,
    collecteActive: true,
    parametres: {
      profondeurPivot: 5,
      tolerancePips: 1.5,
      minBougiesEntrePivots: 4,
      maxBougiesEntrePivots: 75,
      maxBougiesHistorique: 600,
      afficherLignes: true,
      afficherEtiquettes: true,
      masquerNiveauxBalayes: false,
    },
    definitionsVariables: [
      {
        cle: 'profondeurPivot',
        label: 'Sensibilité des Pivots',
        description: 'Nombre de bougies à gauche et à droite pour valider un sommet ou un creux',
        type: 'number',
        valeurParDefaut: 5,
        min: 2,
        max: 20,
        step: 1,
        groupe: 'Détection des Pivots',
      },
      {
        cle: 'tolerancePips',
        label: 'Tolérance Alignement (Pips)',
        description: 'Écart maximal de prix en pips entre deux sommets ou creux pour être considérés comme égaux',
        type: 'number',
        valeurParDefaut: 1.5,
        min: 0.1,
        max: 10.0,
        step: 0.1,
        groupe: 'Règles d\'Alignement',
      },
      {
        cle: 'minBougiesEntrePivots',
        label: 'Écart Minimal (Bougies)',
        description: 'Nombre minimum de bougies séparant les deux sommets ou creux',
        type: 'number',
        valeurParDefaut: 4,
        min: 2,
        max: 30,
        step: 1,
        groupe: 'Espacement Temporel',
      },
      {
        cle: 'maxBougiesEntrePivots',
        label: 'Écart Maximal (Bougies)',
        description: 'Nombre maximum de bougies séparant les deux sommets ou creux',
        type: 'number',
        valeurParDefaut: 75,
        min: 10,
        max: 200,
        step: 5,
        groupe: 'Espacement Temporel',
      },
      {
        cle: 'maxBougiesHistorique',
        label: 'Bougies Historiques Analysées',
        description: 'Nombre de bougies en arrière à scanner',
        type: 'number',
        valeurParDefaut: 600,
        min: 50,
        max: 2000,
        step: 50,
        groupe: 'Historique',
      },
      {
        cle: 'afficherLignes',
        label: 'Afficher les Niveaux EQH / EQL',
        description: 'Trace les lignes horizontales reliant les pivots et prolongées',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Affichage Graphique',
      },
      {
        cle: 'afficherEtiquettes',
        label: 'Afficher les Étiquettes de Statut',
        description: 'Affiche les badges EQH (BSL) et EQL (SSL) avec état Actif ou Purgé',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Affichage Graphique',
      },
      {
        cle: 'masquerNiveauxBalayes',
        label: 'Masquer les Niveaux Purgés',
        description: 'N\'affiche que les niveaux où la liquidité n\'a pas encore été balayée',
        type: 'boolean',
        valeurParDefaut: false,
        groupe: 'Filtrage',
      },
    ],
    creeLe: '2026-09-23T00:00:00.000Z',
    misAJourLe: '2026-09-23T00:00:00.000Z',
    code: `/**
 * Indicateur Scriptable : Détection Liquidité EQH / EQL
 * Identifie les accumulations de liquidité sur Double Tops (EQH) et Double Bottoms (EQL).
 */
return {
  calculer: function(contexte) {
    const { bougies, parametres } = contexte;
    if (!bougies || bougies.length < 20) return { donnees: {}, primitives: {} };

    const resultat = calculerDetectionLiquiditeEQ(bougies, {
      profondeurPivot: Number(parametres.profondeurPivot || 5),
      tolerancePips: Number(parametres.tolerancePips || 1.5),
      minBougiesEntrePivots: Number(parametres.minBougiesEntrePivots || 4),
      maxBougiesEntrePivots: Number(parametres.maxBougiesEntrePivots || 75),
      maxBougiesHistorique: Number(parametres.maxBougiesHistorique || 600),
    });

    const lignes = [];
    const labels = [];
    const boites = [];
    const masquerBalayes = Boolean(parametres.masquerNiveauxBalayes);

    for (const niveau of resultat.niveaux) {
      if (masquerBalayes && niveau.estSwept) continue;

      const estEQH = niveau.type === 'EQH';
      const couleur = estEQH ? '#f59e0b' : '#0ea5e9'; // Doré pour EQH (BSL), Cyan pour EQL (SSL)

      // 1️⃣ Ligne horizontale de niveau de liquidité
      if (parametres.afficherLignes !== false) {
        lignes.push({
          id: 'eq-' + niveau.id,
          prix: niveau.prix,
          dateDebut: niveau.tempsPivot1,
          dateFin: niveau.tempsFin,
          couleur: couleur,
          style: niveau.estSwept ? 'solid' : 'dashed',
          label: (estEQH ? 'EQH (BSL)' : 'EQL (SSL)') + (niveau.estSwept ? ' [Purgé]' : ' [Actif]'),
        });
      }

      // 2️⃣ Étiquettes de repère sur le second pivot
      if (parametres.afficherEtiquettes !== false) {
        labels.push({
          id: 'lbl-' + niveau.id,
          prix: niveau.prix,
          date: niveau.tempsPivot2,
          texte: estEQH ? '🎯 EQH' : '🎯 EQL',
          couleur: couleur,
          position: estEQH ? 'above' : 'below',
        });
      }

      // 3️⃣ Si le niveau a été balayé, petite zone encadrant le sweep
      if (niveau.estSwept && niveau.prixSweep && niveau.tempsSweep) {
        boites.push({
          id: 'box-sweep-' + niveau.id,
          prixHaut: Math.max(niveau.prix, niveau.prixSweep),
          prixBas: Math.min(niveau.prix, niveau.prixSweep),
          dateDebut: niveau.tempsSweep,
          couleurFond: estEQH ? 'rgba(239, 68, 68, 0.20)' : 'rgba(16, 185, 129, 0.20)',
          couleurBordure: estEQH ? '#ef4444' : '#10b981',
          label: estEQH ? '🔴 Sweep EQH' : '🟢 Sweep EQL',
        });
      }
    }

    return {
      donnees: resultat,
      primitives: { lignes, labels, boites },
      typeSpecial: 'detection-liquidite-eq'
    };
  }
};`
  },
  {
    id: 'script-detection-liquidite-srtl',
    nom: 'Détection Liquidité : Zones S/R',
    description: 'Détecte les zones de liquidité horizontales sur les Supports (SSL) et Résistances (BSL) avec au minimum 2 retests et marges rectangulaires visibles.',
    auteur: 'TradeLog AI / Wyckoff',
    version: '2.0.0',
    type: 'overlay',
    actif: true,
    visibleSurGraphique: true,
    collecteActive: true,
    parametres: {
      profondeurPivot: 5,
      margeZonePips: 4.0,
      epaisseurBufferPips: 1.5,
      minTouches: 2,
      minBougiesEntrePivots: 4,
      maxBougiesHistorique: 600,
      afficherZones: true,
      afficherLignes: true,
      afficherEtiquettes: true,
      masquerZonesCassees: false,
    },
    definitionsVariables: [
      {
        cle: 'profondeurPivot',
        label: 'Sensibilité des Pivots',
        description: 'Nombre de bougies à gauche et à droite pour valider un sommet ou un creux',
        type: 'number',
        valeurParDefaut: 5,
        min: 2,
        max: 20,
        step: 1,
        groupe: 'Détection des Pivots',
      },
      {
        cle: 'margeZonePips',
        label: 'Marge Tolérance Retests (Pips)',
        description: 'Marge autorisée pour qu\'un retest fasse partie de la zone même s\'il dépasse légèrement',
        type: 'number',
        valeurParDefaut: 4.0,
        min: 0.5,
        max: 20.0,
        step: 0.5,
        groupe: 'Marge & Tolérance',
      },
      {
        cle: 'epaisseurBufferPips',
        label: 'Épaisseur Rectangle (Pips)',
        description: 'Marge ajoutée pour donner du corps et de l\'épaisseur visible au rectangle',
        type: 'number',
        valeurParDefaut: 1.5,
        min: 0.5,
        max: 10.0,
        step: 0.5,
        groupe: 'Marge & Tolérance',
      },
      {
        cle: 'minTouches',
        label: 'Retests Minima Requis (>=2)',
        description: 'Nombre minimum de points d\'ancrage pour valider une zone de liquidité',
        type: 'number',
        valeurParDefaut: 2,
        min: 2,
        max: 6,
        step: 1,
        groupe: 'Validation',
      },
      {
        cle: 'minBougiesEntrePivots',
        label: 'Écart Minimal entre Retests',
        description: 'Nombre minimum de bougies séparant deux retests',
        type: 'number',
        valeurParDefaut: 4,
        min: 2,
        max: 30,
        step: 1,
        groupe: 'Espacement Temporel',
      },
      {
        cle: 'maxBougiesHistorique',
        label: 'Bougies Historiques Analysées',
        description: 'Nombre de bougies en arrière à scanner',
        type: 'number',
        valeurParDefaut: 600,
        min: 50,
        max: 2000,
        step: 50,
        groupe: 'Historique',
      },
      {
        cle: 'afficherZones',
        label: 'Afficher les Rectangles de Zones',
        description: 'Affiche les boîtes de zones de liquidité sur le graphique',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Affichage Graphique',
      },
      {
        cle: 'afficherLignes',
        label: 'Afficher les Lignes Médianes',
        description: 'Trace la ligne médiane horizontale de la zone',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Affichage Graphique',
      },
      {
        cle: 'afficherEtiquettes',
        label: 'Afficher les Étiquettes (Badges)',
        description: 'Affiche le statut et le nombre de touches sur le graphique',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Affichage Graphique',
      },
      {
        cle: 'masquerZonesCassees',
        label: 'Masquer les Zones Cassées',
        description: 'Masque les zones qui ont été invalidées par une clôture franche',
        type: 'boolean',
        valeurParDefaut: false,
        groupe: 'Filtrage',
      },
    ],
    creeLe: '2026-09-23T00:00:00.000Z',
    misAJourLe: '2026-09-23T00:00:00.000Z',
    code: `/**
 * Indicateur Scriptable : Détection Liquidité Zones S/R
 * Détecte les zones de liquidité sur Supports/Résistances avec marge et retests obligatoires.
 */
return {
  calculer: function(contexte) {
    const { bougies, parametres } = contexte;
    if (!bougies || bougies.length < 20) return { donnees: {}, primitives: {} };

    const res = calculerDetectionLiquiditeSRTL(bougies, {
      profondeurPivot: Number(parametres.profondeurPivot || 5),
      margeZonePips: Number(parametres.margeZonePips || 4.0),
      epaisseurBufferPips: Number(parametres.epaisseurBufferPips || 1.5),
      minTouches: Number(parametres.minTouches || 2),
      minBougiesEntrePivots: Number(parametres.minBougiesEntrePivots || 4),
      maxBougiesHistorique: Number(parametres.maxBougiesHistorique || 600),
      masquerZonesCassees: Boolean(parametres.masquerZonesCassees),
      afficherZones: parametres.afficherZones !== false,
      afficherLignes: parametres.afficherLignes !== false,
      afficherEtiquettes: parametres.afficherEtiquettes !== false,
    });

    return {
      donnees: res,
      primitives: res.primitives,
      typeSpecial: 'detection-liquidite-srtl'
    };
  }
};`
  },
  {
    id: 'script-shved-supply-demand',
    nom: 'Détection de Liquidité : Shved Supply & Demand',
    description: 'Détecte les zones institutionnelles de Demande (Support/SSL) et d\'Offre (Supply/BSL) via ATR dynamique. Retire les zones cassées et masque par défaut les zones non retestées.',
    auteur: 'Shved / TradeLog AI',
    version: '1.0.0',
    type: 'overlay',
    actif: true,
    visibleSurGraphique: true,
    collecteActive: true,
    parametres: {
      timeframeSource: 'M15',
      supprimerZonesCassees: true,
      afficherNonRetestees: false,
      minRetests: 1,
      afficherFaibles: false,
      zoneFuzzFactor: 0.75,
      zoneExtend: true,
      fractalFastFactor: 3.0,
      fractalSlowFactor: 6.0,
      zoneMerge: true,
      maxLookbackBars: 800,
      afficherZones: true,
      afficherLignes: true,
      afficherEtiquettes: true,
    },
    definitionsVariables: [
      {
        cle: 'timeframeSource',
        label: 'Unité de Temps de la Liquidité (Option B / MTF)',
        description: 'Calcule les zones de liquidité sur la basse unité de temps (M15, M30, M5) et les projette sur le graphique actuel (ex: H4)',
        type: 'select',
        valeurParDefaut: 'M15',
        options: [
          { label: 'Graphique Actuel', value: 'ACTUEL' },
          { label: 'M1 (1 minute)', value: 'M1' },
          { label: 'M5 (5 minutes)', value: 'M5' },
          { label: 'M15 (15 minutes)', value: 'M15' },
          { label: 'M30 (30 minutes)', value: 'M30' },
          { label: 'H1 (1 heure)', value: 'H1' },
          { label: 'H4 (4 heures)', value: 'H4' },
          { label: 'D1 (Journalier)', value: 'D1' },
        ],
        groupe: 'Multi-Timeframe (MTF / Option B)',
      },
      {
        cle: 'supprimerZonesCassees',
        label: 'Retirer les Zones Cassées',
        description: 'Supprime immédiatement les supports ou résistances dès qu\'une bougie clôture au-delà (pas de Turncoat conservé)',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Règles de Liquidité & Invalidation',
      },
      {
        cle: 'afficherNonRetestees',
        label: 'Afficher les Zones Non Retestées',
        description: 'Affiche ou masque les zones neuves sans rebond (Désactivé par défaut car la liquidité nécessite un retest)',
        type: 'boolean',
        valeurParDefaut: false,
        groupe: 'Règles de Liquidité & Invalidation',
      },
      {
        cle: 'minRetests',
        label: 'Retests Minima Requis',
        description: 'Nombre minimum de rebonds pour valider une zone de liquidité',
        type: 'number',
        valeurParDefaut: 1,
        min: 1,
        max: 5,
        step: 1,
        groupe: 'Règles de Liquidité & Invalidation',
      },
      {
        cle: 'afficherFaibles',
        label: 'Afficher les Zones Faibles',
        description: 'Affiche les zones issues uniquement de micro-fractals rapides',
        type: 'boolean',
        valeurParDefaut: false,
        groupe: 'Règles de Liquidité & Invalidation',
      },
      {
        cle: 'zoneFuzzFactor',
        label: 'Facteur ATR Épaisseur Zone',
        description: 'Multiplicateur de l\'ATR pour l\'épaisseur et la marge de tolérance du rectangle',
        type: 'number',
        valeurParDefaut: 0.75,
        min: 0.25,
        max: 2.5,
        step: 0.05,
        groupe: 'Sensibilité & Épaisseur',
      },
      {
        cle: 'zoneExtend',
        label: 'Étendre la Zone au-delà de la Mèche',
        description: 'Étend la zone pour englober la mèche extrême et son buffer ATR',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Sensibilité & Épaisseur',
      },
      {
        cle: 'fractalFastFactor',
        label: 'Sensibilité Fractale Rapide',
        description: 'Rayon de bougies pour les sommets/creux réactifs',
        type: 'number',
        valeurParDefaut: 3.0,
        min: 2.0,
        max: 10.0,
        step: 0.5,
        groupe: 'Structure & Pivots',
      },
      {
        cle: 'fractalSlowFactor',
        label: 'Sensibilité Fractale Majeure',
        description: 'Rayon de bougies pour les sommets/creux majeurs solides',
        type: 'number',
        valeurParDefaut: 6.0,
        min: 3.0,
        max: 20.0,
        step: 0.5,
        groupe: 'Structure & Pivots',
      },
      {
        cle: 'zoneMerge',
        label: 'Fusionner les Zones Superposées',
        description: 'Combine les zones qui se chevauchent sur la même tranche de prix',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Agrégation & Nettoyage',
      },
      {
        cle: 'afficherZones',
        label: 'Afficher les Boîtes Rectangulaires',
        description: 'Dessine les rectangles vert (Demand/SSL) et rouge (Supply/BSL)',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Affichage Graphique',
      },
      {
        cle: 'afficherLignes',
        label: 'Afficher les Lignes Médianes',
        description: 'Trace la ligne médiane horizontale de chaque zone',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Affichage Graphique',
      },
      {
        cle: 'afficherEtiquettes',
        label: 'Afficher les Badges de Force',
        description: 'Affiche le nombre de retests et le statut (Vérifié / Prouvé)',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Affichage Graphique',
      },
    ],
    creeLe: '2026-09-24T00:00:00.000Z',
    misAJourLe: '2026-09-24T00:00:00.000Z',
    code: `/**
 * Indicateur Scriptable : Shved Supply & Demand
 * Détecte les zones de liquidité horizontales avec ATR dynamique.
 * Élimine les zones cassées et masque par défaut les zones non retestées.
 */
return {
  calculer: function(contexte) {
    const { bougies, parametres, donneesM1, timeframe } = contexte;
    if (!bougies || bougies.length < 20) return { donnees: {}, primitives: {} };

    const res = calculerShvedSupplyDemand(bougies, {
      timeframeSource: String(parametres.timeframeSource || 'M15'),
      donneesM1: donneesM1,
      chartTimeframe: timeframe,
      supprimerZonesCassees: parametres.supprimerZonesCassees !== false,
      afficherNonRetestees: Boolean(parametres.afficherNonRetestees),
      minRetests: Number(parametres.minRetests || 1),
      afficherFaibles: Boolean(parametres.afficherFaibles),
      zoneFuzzFactor: Number(parametres.zoneFuzzFactor || 0.75),
      zoneExtend: parametres.zoneExtend !== false,
      fractalFastFactor: Number(parametres.fractalFastFactor || 3.0),
      fractalSlowFactor: Number(parametres.fractalSlowFactor || 6.0),
      zoneMerge: parametres.zoneMerge !== false,
      maxLookbackBars: Number(parametres.maxLookbackBars || 800),
      afficherZones: parametres.afficherZones !== false,
      afficherLignes: parametres.afficherLignes !== false,
      afficherEtiquettes: parametres.afficherEtiquettes !== false,
    });

    return {
      donnees: res,
      primitives: res.primitives,
      typeSpecial: 'shved-supply-demand'
    };
  }
};`
  },
  {
    id: 'script-overmitigation-highway',
    nom: 'Couloir d\'Over-Mitigation (Autoroute vers le TP)',
    description: 'Analyse l\'espace entre le prix actuel et la liquidité opposée (TP). Vérifie l\'absence d\'imbalances (FVG) et calcule le score d\'autoroute dégagée (Highway Score).',
    auteur: 'Wyckoff SMC / TradeLog',
    version: '1.0.0',
    type: 'overlay',
    actif: true,
    visibleSurGraphique: true,
    collecteActive: true,
    parametres: {
      direction: 'achat',
      seuilAutoroutePourcent: 80,
      prixTPManuel: 0,
      nbPaliersAnalyse: 15,
      maxLookbackBars: 300,
    },
    definitionsVariables: [
      {
        cle: 'direction',
        label: 'Direction du Setup',
        description: 'Direction du trade anticipé vers la cible',
        type: 'select',
        valeurParDefaut: 'achat',
        options: [
          { label: 'Achat (Vers Résistance / BSL)', value: 'achat' },
          { label: 'Vente (Vers Support / SSL)', value: 'vente' },
        ],
        groupe: 'Configuration du Couloir',
      },
      {
        cle: 'seuilAutoroutePourcent',
        label: 'Seuil de Validation de l\'Autoroute (%)',
        description: 'Pourcentage minimum de mitigation requis pour valider le couloir libre',
        type: 'number',
        valeurParDefaut: 80,
        min: 50,
        max: 100,
        step: 5,
        groupe: 'Règles de Décision',
      },
      {
        cle: 'prixTPManuel',
        label: 'Prix TP Manuel (0 = Auto)',
        description: 'Si 0, l\'indicateur cible automatiquement la liquidité opposée la plus proche',
        type: 'number',
        valeurParDefaut: 0,
        min: 0,
        max: 100000,
        step: 0.0001,
        groupe: 'Cible de Prix',
      },
      {
        cle: 'nbPaliersAnalyse',
        label: 'Nombre de Paliers Verticaux',
        description: 'Précision du découpage du couloir de prix pour évaluer les traversées',
        type: 'number',
        valeurParDefaut: 15,
        min: 5,
        max: 30,
        step: 1,
        groupe: 'Sensibilité Mathématique',
      },
      {
        cle: 'maxLookbackBars',
        label: 'Historique des Bougies (Lookback)',
        description: 'Nombre de bougies passées analysées pour mesurer l\'historique d\'échange',
        type: 'number',
        valeurParDefaut: 300,
        min: 50,
        max: 800,
        step: 25,
        groupe: 'Sensibilité Mathématique',
      },
    ],
    creeLe: '2026-09-26T00:00:00.000Z',
    misAJourLe: '2026-09-26T00:00:00.000Z',
    code: `/**
 * Indicateur Scriptable : Couloir d'Over-Mitigation & Autoroute vers le TP
 * Évalue la propreté du chemin vers la liquidité opposée.
 */
return {
  calculer: function(contexte) {
    const { bougies, parametres, resultatsPrecedents } = contexte;
    if (!bougies || bougies.length < 15) return { donnees: {}, primitives: {} };

    const res = calculerOverMitigationHighway(bougies, {
      direction: String(parametres.direction || 'achat'),
      prixTPManuel: Number(parametres.prixTPManuel || 0),
      seuilAutoroutePourcent: Number(parametres.seuilAutoroutePourcent || 80),
      nbPaliersAnalyse: Number(parametres.nbPaliersAnalyse || 15),
      maxLookbackBars: Number(parametres.maxLookbackBars || 300),
      resultatsPrecedents: resultatsPrecedents,
    });

    return {
      donnees: res,
      primitives: res.primitives,
      typeSpecial: 'overmitigation-highway'
    };
  }
};`
  },
  {
    id: 'script-methode-a-compression',
    nom: '[Test 1/3] Bougie Mère Non-Mitigée : Chevauchement Direct (Méthode A)',
    description: 'Partitionne la zone de prix par bougies mères non-mitigées et compte uniquement les bougies qui la suivent directement (arrêt au premier saut/imbalance).',
    auteur: 'TradeLog AI / Research',
    version: '2.0.0',
    type: 'overlay',
    actif: true,
    visibleSurGraphique: true,
    collecteActive: true,
    parametres: {
      lookbackBars: 500,
      seuilOverlapPourcent: 50,
      minBougiesDirectes: 3,
      uniquementNonMitigues: false,
      prolongerNonMitigues: true,
      afficherPoints: true,
      afficherBoites: false,
      afficherTexte: false,
    },
    definitionsVariables: [
      {
        cle: 'lookbackBars',
        label: 'Historique Analysé (Bougies)',
        description: 'Nombre de bougies récentes analysées depuis la bougie courante (ex: 500 bougies)',
        type: 'number',
        valeurParDefaut: 500,
        min: 50,
        max: 1000,
        step: 50,
        groupe: 'Historique',
      },
      {
        cle: 'seuilOverlapPourcent',
        label: 'Seuil Chevauchement Direct (%)',
        description: 'Pourcentage minimal de surface commune entre deux bougies directes',
        type: 'number',
        valeurParDefaut: 50,
        min: 25,
        max: 85,
        step: 5,
        groupe: 'Règles de Détection',
      },
      {
        cle: 'minBougiesDirectes',
        label: 'Bougies Directes Minimum (Fort Trafic)',
        description: 'Nombre de bougies consécutives directes pour qualifier un fort trafic (ex: 3 bougies)',
        type: 'number',
        valeurParDefaut: 3,
        min: 2,
        max: 8,
        step: 1,
        groupe: 'Règles de Détection',
      },
      {
        cle: 'uniquementNonMitigues',
        label: 'Uniquement Non-Mitigés',
        description: 'Ne conserver que les bougies mères dont la tranche n\'a jamais été revisitée par le futur',
        type: 'boolean',
        valeurParDefaut: false,
        groupe: 'Filtre de Mitigation',
      },
      {
        cle: 'prolongerNonMitigues',
        label: 'Prolonger vers la Droite',
        description: 'Étendre les bougies mères non mitigées jusqu\'à la bougie courante',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Filtre de Mitigation',
      },
      {
        cle: 'afficherPoints',
        label: 'Afficher les Points sur Bougies Mères',
        description: 'Place un point épuré (vert/rouge) sur chaque bougie mère',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Affichage & Épure',
      },
      {
        cle: 'afficherBoites',
        label: 'Afficher les Boîtes Rectangulaires',
        description: 'Dessine les rectangles de zone sur le cours (désactivé par défaut pour ne pas surcharger)',
        type: 'boolean',
        valeurParDefaut: false,
        groupe: 'Affichage & Épure',
      },
      {
        cle: 'afficherTexte',
        label: 'Afficher les Étiquettes de Texte',
        description: 'Affiche les badges texte (désactivé par défaut pour un graphique propre)',
        type: 'boolean',
        valeurParDefaut: false,
        groupe: 'Affichage & Épure',
      },
    ],
    creeLe: '2026-09-26T00:00:00.000Z',
    misAJourLe: '2026-09-28T00:00:00.000Z',
    code: `/**
 * Indicateur Scriptable : Méthode A - Bougie Mère Non-Mitigée & Chevauchement Direct
 * Séquence contiguë stricte : points épurés sur les bougies mères
 */
return {
  calculer: function(contexte) {
    const { bougies, parametres } = contexte;
    if (!bougies || bougies.length < 3) return { donnees: {}, primitives: {} };

    const res = calculerMethodeACompression(bougies, {
      lookbackBars: Number(parametres.lookbackBars || 500),
      seuilOverlapPourcent: Number(parametres.seuilOverlapPourcent || 50),
      minBougiesDirectes: Number(parametres.minBougiesDirectes || 3),
      uniquementNonMitigues: Boolean(parametres.uniquementNonMitigues),
      prolongerNonMitigues: parametres.prolongerNonMitigues !== false,
      afficherPoints: parametres.afficherPoints !== false,
      afficherBoites: Boolean(parametres.afficherBoites),
      afficherTexte: Boolean(parametres.afficherTexte),
    });

    return {
      donnees: res,
      primitives: res.primitives,
      typeSpecial: 'methode-a-compression'
    };
  }
};`
  },
  {
    id: 'script-methode-b-overlap',
    nom: '[Test 2/3] Chevauchement Non-Mitigé : Surface Commune (Méthode B)',
    description: 'Mesure l\'intersection géométrique exacte entre bougies successives. Met en valeur les chaînes où 3+ bougies partagent plus de 55% de leur surface de prix et prolonge les bandes non mitigées.',
    auteur: 'TradeLog AI / Research',
    version: '1.1.0',
    type: 'overlay',
    actif: true,
    visibleSurGraphique: true,
    collecteActive: true,
    parametres: {
      minBougiesChaine: 3,
      seuilOverlapPourcent: 55,
      uniquementNonMitigues: false,
      prolongerNonMitigues: true,
      maxLookbackBars: 300,
    },
    definitionsVariables: [
      {
        cle: 'minBougiesChaine',
        label: 'Longueur Minimale de la Chaîne',
        description: 'Nombre minimum de bougies successives qui doivent se chevaucher (ex: 3 bougies)',
        type: 'number',
        valeurParDefaut: 3,
        min: 2,
        max: 8,
        step: 1,
        groupe: 'Règles de la Chaîne',
      },
      {
        cle: 'seuilOverlapPourcent',
        label: 'Seuil de Surface Commune (%)',
        description: 'Pourcentage minimal d\'intersection entre deux bougies consécutives pour valider le contact',
        type: 'number',
        valeurParDefaut: 55,
        min: 30,
        max: 90,
        step: 5,
        groupe: 'Règles de la Chaîne',
      },
      {
        cle: 'uniquementNonMitigues',
        label: 'Uniquement Non-Mitigés',
        description: 'Ne conserver que les couloirs qui n\'ont jamais été revisités par le prix futur',
        type: 'boolean',
        valeurParDefaut: false,
        groupe: 'Filtre de Mitigation',
      },
      {
        cle: 'prolongerNonMitigues',
        label: 'Prolonger vers la Droite',
        description: 'Étendre la surface commune non mitigée jusqu\'à la bougie courante',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Filtre de Mitigation',
      },
      {
        cle: 'maxLookbackBars',
        label: 'Historique des Bougies (Lookback)',
        description: 'Nombre de bougies récentes analysées sur le graphique',
        type: 'number',
        valeurParDefaut: 300,
        min: 50,
        max: 800,
        step: 25,
        groupe: 'Historique',
      },
    ],
    creeLe: '2026-09-26T00:00:00.000Z',
    misAJourLe: '2026-09-27T00:00:00.000Z',
    code: `/**
 * Indicateur Scriptable : Méthode B - Surface Commune Bougie à Bougie Non-Mitigée
 * Intersection géométrique entre bougies avec prolongation des couloirs vierges
 */
return {
  calculer: function(contexte) {
    const { bougies, parametres } = contexte;
    if (!bougies || bougies.length < 3) return { donnees: {}, primitives: {} };

    const res = calculerMethodeBOverlap(bougies, {
      minBougiesChaine: Number(parametres.minBougiesChaine || 3),
      seuilOverlapPourcent: Number(parametres.seuilOverlapPourcent || 55),
      uniquementNonMitigues: Boolean(parametres.uniquementNonMitigues),
      prolongerNonMitigues: parametres.prolongerNonMitigues !== false,
      maxLookbackBars: Number(parametres.maxLookbackBars || 300),
    });

    return {
      donnees: res,
      primitives: res.primitives,
      typeSpecial: 'methode-b-overlap'
    };
  }
};`
  },
  {
    id: 'script-methode-c-slice',
    nom: '[Test 3/3] Chevauchement Non-Mitigé : Tranches Couloir (Méthode C)',
    description: 'Découpe l\'espace vertical en tranches horizontales, calcule le trafic de bougies par niveau et prolonge les tranches denses non mitigées.',
    auteur: 'TradeLog AI / Research',
    version: '1.1.0',
    type: 'overlay',
    actif: true,
    visibleSurGraphique: true,
    collecteActive: true,
    parametres: {
      direction: 'achat',
      nbTranches: 12,
      minBougiesParTranche: 3,
      prixTPManuel: 0,
      uniquementNonMitigues: false,
      prolongerNonMitigues: true,
      maxLookbackBars: 300,
    },
    definitionsVariables: [
      {
        cle: 'direction',
        label: 'Direction de l\'Analyse',
        description: 'Sens du couloir vers l\'objectif',
        type: 'select',
        valeurParDefaut: 'achat',
        options: [
          { label: 'Achat (Vers le Haut)', value: 'achat' },
          { label: 'Vente (Vers le Bas)', value: 'vente' },
        ],
        groupe: 'Orientation',
      },
      {
        cle: 'nbTranches',
        label: 'Nombre de Tranches Horizontales',
        description: 'Nombre de niveaux découpant le couloir de prix',
        type: 'number',
        valeurParDefaut: 12,
        min: 5,
        max: 25,
        step: 1,
        groupe: 'Résolution',
      },
      {
        cle: 'minBougiesParTranche',
        label: 'Bougies Minimum par Tranche',
        description: 'Seuil de bougies pour qu\'une tranche soit déclarée dense (en vert)',
        type: 'number',
        valeurParDefaut: 3,
        min: 2,
        max: 10,
        step: 1,
        groupe: 'Règles de Densité',
      },
      {
        cle: 'uniquementNonMitigues',
        label: 'Uniquement Non-Mitigés',
        description: 'Ne tracer que les tranches à fort trafic non revisitées',
        type: 'boolean',
        valeurParDefaut: false,
        groupe: 'Filtre de Mitigation',
      },
      {
        cle: 'prolongerNonMitigues',
        label: 'Prolonger vers la Droite',
        description: 'Prolonger les niveaux non mitigés vers la bougie courante',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Filtre de Mitigation',
      },
      {
        cle: 'prixTPManuel',
        label: 'Prix Cible Manuel (0 = Auto)',
        description: 'Niveau TP haut du couloir (si 0, calculé automatiquement)',
        type: 'number',
        valeurParDefaut: 0,
        min: 0,
        max: 100000,
        step: 0.0001,
        groupe: 'Cible de Prix',
      },
      {
        cle: 'maxLookbackBars',
        label: 'Historique des Bougies (Lookback)',
        description: 'Nombre de bougies récentes analysées sur le graphique',
        type: 'number',
        valeurParDefaut: 300,
        min: 50,
        max: 800,
        step: 25,
        groupe: 'Historique',
      },
    ],
    creeLe: '2026-09-26T00:00:00.000Z',
    misAJourLe: '2026-09-27T00:00:00.000Z',
    code: `/**
 * Indicateur Scriptable : Méthode C - Tranches Horizontales de Trafic Non-Mitigées
 * Découpe du couloir avec calcul du trafic de bougies et mise en avant des niveaux vierges
 */
return {
  calculer: function(contexte) {
    const { bougies, parametres } = contexte;
    if (!bougies || bougies.length < 15) return { donnees: {}, primitives: {} };

    const res = calculerMethodeCSlice(bougies, {
      direction: String(parametres.direction || 'achat'),
      nbTranches: Number(parametres.nbTranches || 12),
      minBougiesParTranche: Number(parametres.minBougiesParTranche || 3),
      prixTPManuel: Number(parametres.prixTPManuel || 0),
      uniquementNonMitigues: Boolean(parametres.uniquementNonMitigues),
      prolongerNonMitigues: parametres.prolongerNonMitigues !== false,
      maxLookbackBars: Number(parametres.maxLookbackBars || 300),
    });

    return {
      donnees: res,
      primitives: res.primitives,
      typeSpecial: 'methode-c-slice'
    };
  }
};`
  },
  {
    id: 'script-unmitigated-overlap-profile',
    nom: 'Profil de Chevauchement Non-Mitigé (UOP)',
    description: 'Volume Profile basé sur le vrai taux de chevauchement des bougies (et non les ticks). Détecte les paliers non mitigés et identifie les plages de prix uniformes.',
    auteur: 'TradeLog AI / Research',
    version: '1.0.0',
    type: 'overlay',
    actif: true,
    visibleSurGraphique: true,
    collecteActive: true,
    parametres: {
      zigzagDepth: 8,
      zigzagDeviation: 0,
      zigzagBackstep: 3,
      inclureVagueCourante: true,
      nbVaguesSuperposees: 4,
      minVaguesSuperposition: 1,
      maxVagues: 4,
      lookbackBars: 500,
      seuilBougiesBleuFonce: 3,
      minBougiesUniforme: 2,
      toleranceUniformite: 1,
      prolongerNiveaux: true,
      uniquementNonMitigues: false,
      afficherZigZag: true,
      afficherBarresProfil: true,
      afficherProlongation: true,
      afficherTPOptimaux: true,
      seuilMargeTrouPourcent: 5,
      maxTPAffiches: 3,
    },
    definitionsVariables: [
      {
        cle: 'zigzagDepth',
        label: 'Sensibilité Pivots ZigZag',
        description: 'Nombre de bougies de confirmation à gauche et à droite pour délimiter les sommets et creux',
        type: 'number',
        valeurParDefaut: 8,
        min: 2,
        max: 50,
        step: 1,
        groupe: 'Structure ZigZag',
      },
      {
        cle: 'zigzagDeviation',
        label: 'Déviation Minimale ZigZag',
        description: 'Écart minimum en points de prix requis pour valider un renversement de tendance',
        type: 'number',
        valeurParDefaut: 0,
        min: 0,
        max: 50,
        step: 0.1,
        groupe: 'Structure ZigZag',
      },
      {
        cle: 'zigzagBackstep',
        label: 'Backstep Barres ZigZag',
        description: 'Distance minimale en nombre de barres entre deux pivots successifs de type opposé',
        type: 'number',
        valeurParDefaut: 3,
        min: 1,
        max: 20,
        step: 1,
        groupe: 'Structure ZigZag',
      },
      {
        cle: 'inclureVagueCourante',
        label: 'Calculer ZigZag avec Vague Courante',
        description: 'Connecte dynamiquement le dernier pivot à la bougie en cours (close actuel) pour suivre le marché en direct',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Structure ZigZag',
      },
      {
        cle: 'nbVaguesSuperposees',
        label: 'Nombre de Vagues Superposées',
        description: 'Nombre de vagues ZigZag (vagues précédentes + vague courante) superposées pour déterminer le TP Optimal',
        type: 'number',
        valeurParDefaut: 4,
        min: 1,
        max: 15,
        step: 1,
        groupe: 'Superposition des Vagues',
      },
      {
        cle: 'minVaguesSuperposition',
        label: 'Vagues Min par Palier TP',
        description: 'Nombre minimum de vagues distinctes devant traverser un palier pour qualifier un corridor de TP Optimal',
        type: 'number',
        valeurParDefaut: 1,
        min: 1,
        max: 5,
        step: 1,
        groupe: 'Superposition des Vagues',
      },
      {
        cle: 'lookbackBars',
        label: 'Historique des Bougies',
        description: 'Nombre de bougies analysées sur le graphique',
        type: 'number',
        valeurParDefaut: 500,
        min: 50,
        max: 1000,
        step: 50,
        groupe: 'Historique',
      },
      {
        cle: 'seuilBougiesBleuFonce',
        label: 'Seuil Bougies Bleu Foncé (Sweep)',
        description: 'Nombre minimum de bougies de chevauchement pour qu\'un palier soit considéré comme une zone de Sweep (barre bleu foncé)',
        type: 'number',
        valeurParDefaut: 3,
        min: 1,
        max: 10,
        step: 1,
        groupe: 'Corridors Uniformes & TPO',
      },
      {
        cle: 'toleranceUniformite',
        label: 'Tolérance Écart Bougies',
        description: 'Écart maximal de bougies entre paliers successifs pour être déclarés uniformes',
        type: 'number',
        valeurParDefaut: 1,
        min: 0,
        max: 5,
        step: 1,
        groupe: 'Corridors Uniformes & TPO',
      },
      {
        cle: 'uniquementNonMitigues',
        label: 'Uniquement Non-Mitigés',
        description: 'Ne retenir que les paliers et plages qui n\'ont jamais été revisités après leur formation',
        type: 'boolean',
        valeurParDefaut: false,
        groupe: 'Filtre de Mitigation',
      },
      {
        cle: 'prolongerNiveaux',
        label: 'Prolonger Niveaux Vierges',
        description: 'Prolonger les niveaux non mitigés vers la bougie courante',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Filtre de Mitigation',
      },
      {
        cle: 'afficherZigZag',
        label: 'Afficher les Lignes ZigZag',
        description: 'Affiche la structure brisée ZigZag sur le cours',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Options d\'Affichage',
      },
      {
        cle: 'afficherBarresProfil',
        label: 'Afficher les Barres de Profil',
        description: 'Affiche l\'histogramme horizontal du profil de chevauchement sur chaque vague',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Options d\'Affichage',
      },
      {
        cle: 'afficherProlongation',
        label: 'Afficher Lignes en Pointillés',
        description: 'Affiche les pointillés verts prolongeant les niveaux vierges vers la droite',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Options d\'Affichage',
      },
      {
        cle: 'afficherTPOptimaux',
        label: 'Afficher Take Profit Optimaux (TPO)',
        description: 'Calcule et affiche simultanément les TP Optimaux Achat (vert) et Vente (rouge) par superposition de vagues',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Take Profit Optimaux (TPO)',
      },
      {
        cle: 'seuilMargeTrouPourcent',
        label: 'Marge Tolérance Micro-Creux (%)',
        description: 'Pourcentage maximum de trou toléré (ex: 5%) au sein d\'une zone uniforme sans interrompre le TP',
        type: 'number',
        valeurParDefaut: 5,
        min: 1,
        max: 20,
        step: 1,
        groupe: 'Take Profit Optimaux (TPO)',
      },
      {
        cle: 'maxTPAffiches',
        label: 'Nombre Max de TP par Direction',
        description: 'Nombre maximal de niveaux de Take Profit affichés (TP1, TP2, TP3...)',
        type: 'number',
        valeurParDefaut: 3,
        min: 1,
        max: 5,
        step: 1,
        groupe: 'Take Profit Optimaux (TPO)',
      },
    ],
    creeLe: '2026-09-28T00:00:00.000Z',
    misAJourLe: '2026-09-29T00:00:00.000Z',
    code: `/**
 * Indicateur Scriptable : Profil de Chevauchement Non-Mitigé (UOP)
 * Volume Profile mesurant le taux de chevauchement réel et calculant les TP Optimaux Achat/Vente
 * par superposition des vagues précédentes et de la vague courante du ZigZag.
 */
return {
  calculer: function(contexte) {
    const { bougies, parametres } = contexte;
    if (!bougies || bougies.length < 15) return { donnees: {}, primitives: {} };

    const res = calculerUnmitigatedOverlapProfile(bougies, {
      zigzagDepth: Number(parametres.zigzagDepth || 8),
      zigzagDeviation: Number(parametres.zigzagDeviation || 0),
      zigzagBackstep: Number(parametres.zigzagBackstep || 3),
      inclureVagueCourante: parametres.inclureVagueCourante !== false,
      nbVaguesSuperposees: Number(parametres.nbVaguesSuperposees || parametres.maxVagues || 4),
      minVaguesSuperposition: Number(parametres.minVaguesSuperposition || 1),
      maxVagues: Number(parametres.nbVaguesSuperposees || parametres.maxVagues || 4),
      lookbackBars: Number(parametres.lookbackBars || 500),
      seuilBougiesBleuFonce: Number(parametres.seuilBougiesBleuFonce || 3),
      minBougiesUniforme: Number(parametres.minBougiesUniforme || 2),
      toleranceUniformite: Number(parametres.toleranceUniformite || 1),
      prolongerNiveaux: parametres.prolongerNiveaux !== false,
      uniquementNonMitigues: Boolean(parametres.uniquementNonMitigues),
      afficherZigZag: parametres.afficherZigZag !== false,
      afficherBarresProfil: parametres.afficherBarresProfil !== false,
      afficherProlongation: parametres.afficherProlongation !== false,
      afficherTPOptimaux: parametres.afficherTPOptimaux !== false,
      seuilMargeTrouPourcent: Number(parametres.seuilMargeTrouPourcent || 5),
      maxTPAffiches: Number(parametres.maxTPAffiches || 3),
    });

    return {
      donnees: res,
      primitives: res.primitives,
      typeSpecial: 'unmitigated-overlap-profile'
    };
  }
};`
  },
  {
    id: 'script-wyckoff-point-figure',
    nom: 'Wyckoff Point & Figure (Spring & UTAD)',
    description: 'Détecte les structures de Range, les Springs et les UTAD grâce au lissage géométrique Point & Figure (P&F), avec calcul de l\'objectif de Cause à Effet et filtre de volume institutionnel personnalisable.',
    auteur: 'TradeLog AI / Wyckoff',
    version: '1.0.0',
    type: 'overlay',
    actif: false,
    visibleSurGraphique: true,
    collecteActive: true,
    parametres: {
      modeTailleBox: 'auto_atr',
      ratioBoxATR: 0.5,
      tailleBoxPips: 10,
      reversalCount: 3,
      colonnesMinRange: 4,
      minRetestsRequis: 2,
      maxLookbackBars: 1000,
      activerFiltreVolume: true,
      typeValidationVolume: 'climax_ou_test',
      seuilRatioVolume: 1.3,
      periodeMoyenneVolume: 20,
      activerFiltreGrandesBougies: true,
      multiplicateurTailleATR: 1.3,
      exigerRetourSuperieurOuEgal: true,
      maxBougiesHorsRange: 3,
      ratioMecheRejetSimple: 0.40,
      activerSpring: true,
      activerUTAD: true,
      afficherRanges: true,
      afficherLignesNiveaux: true,
      afficherCiblesWyckoff: true,
    },
    definitionsVariables: [
      {
        cle: 'modeTailleBox',
        label: 'Mode de Calcul de la Boîte (Box Size)',
        description: 'Calcul automatique basé sur l\'ATR de volatilité ou taille fixe en pips',
        type: 'select',
        valeurParDefaut: 'auto_atr',
        options: [
          { label: 'Automatique (ATR Dynamique)', value: 'auto_atr' },
          { label: 'Fixe (Pips définis manuellement)', value: 'fixe' },
        ],
        groupe: 'Configuration Point et Figure',
      },
      {
        cle: 'ratioBoxATR',
        label: 'Ratio ATR (si mode Auto)',
        description: 'Fraction de l\'ATR utilisée pour dimensionner une boîte P&F (ex: 0.5 = 50% de l\'ATR)',
        type: 'number',
        valeurParDefaut: 0.5,
        min: 0.1,
        max: 2.0,
        step: 0.1,
        groupe: 'Configuration Point et Figure',
      },
      {
        cle: 'tailleBoxPips',
        label: 'Taille de Boîte Fixe (si mode Fixe)',
        description: 'Taille d\'une boîte Point & Figure en pips',
        type: 'number',
        valeurParDefaut: 10,
        min: 1,
        max: 200,
        step: 1,
        groupe: 'Configuration Point et Figure',
      },
      {
        cle: 'reversalCount',
        label: 'Seuil de Retournement (Boîtes)',
        description: 'Nombre de boîtes nécessaires pour changer de colonne (Standard Wyckoff = 3 boîtes)',
        type: 'number',
        valeurParDefaut: 3,
        min: 1,
        max: 5,
        step: 1,
        groupe: 'Configuration Point et Figure',
      },
      {
        cle: 'colonnesMinRange',
        label: 'Largeur Minimale du Range (Colonnes P&F)',
        description: 'Nombre minimum de colonnes P&F consécutives pour valider une phase de Range / Accumulation',
        type: 'number',
        valeurParDefaut: 4,
        min: 2,
        max: 20,
        step: 1,
        groupe: 'Structure du Range & Retests',
      },
      {
        cle: 'minRetestsRequis',
        label: 'Retests Minima Requis du Niveau (Touches)',
        description: 'Nombre minimum de colonnes P&F distinctes ayant rebondi sur le support/résistance pour valider sa solidité (2 = Standard, 3 = Majeur, >=4 = Institutionnel A+)',
        type: 'number',
        valeurParDefaut: 2,
        min: 1,
        max: 8,
        step: 1,
        groupe: 'Structure du Range & Retests',
      },
      {
        cle: 'maxLookbackBars',
        label: 'Historique Analysé (Bougies)',
        description: 'Nombre maximum de bougies récentes à convertir en colonnes Point et Figure',
        type: 'number',
        valeurParDefaut: 1000,
        min: 100,
        max: 3000,
        step: 100,
        groupe: 'Structure du Range & Retests',
      },
      {
        cle: 'activerFiltreVolume',
        label: 'Activer le Filtre de Volume Wyckoff',
        description: 'Active la confirmation par le volume (Effort vs Résultat). Si désactivé, le setup est validé uniquement sur la géométrie P&F.',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Filtre Volume Wyckoff (Optionnel)',
      },
      {
        cle: 'typeValidationVolume',
        label: 'Type d\'Analyse du Volume',
        description: 'Règle de validation du volume requise lors du Spring / UTAD',
        type: 'select',
        valeurParDefaut: 'climax_ou_test',
        options: [
          { label: 'Absorption (Fort Climax) OU Assèchement (Faible Test)', value: 'climax_ou_test' },
          { label: 'Uniquement Fort Volume d\'Absorption (Climax)', value: 'climax' },
          { label: 'Uniquement Faible Volume d\'Épuisement (Test)', value: 'test' },
        ],
        groupe: 'Filtre Volume Wyckoff (Optionnel)',
      },
      {
        cle: 'seuilRatioVolume',
        label: 'Ratio Volume vs Moyenne',
        description: 'Facteur multiplicateur du volume moyen pour qualifier un Climax ou un Test',
        type: 'number',
        valeurParDefaut: 1.3,
        min: 1.0,
        max: 4.0,
        step: 0.1,
        groupe: 'Filtre Volume Wyckoff (Optionnel)',
      },
      {
        cle: 'periodeMoyenneVolume',
        label: 'Période Moyenne de Volume',
        description: 'Nombre de bougies pour calculer le volume moyen de référence',
        type: 'number',
        valeurParDefaut: 20,
        min: 5,
        max: 100,
        step: 5,
        groupe: 'Filtre Volume Wyckoff (Optionnel)',
      },
      {
        cle: 'activerFiltreGrandesBougies',
        label: 'Activer le Filtre Grandes Bougies (V-Shape & Pinbar)',
        description: 'Exige que le Spring / UTAD soit formé de grandes bougies dynamiques ou d\'un rejet Pinbar violent',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Filtre Grandes Bougies & V-Shape',
      },
      {
        cle: 'multiplicateurTailleATR',
        label: 'Seuil Multiplicateur ATR (Taille Totale)',
        description: 'Multiplicateur de l\'ATR pour qualifier une bougie de "Grande" (High - Low)',
        type: 'number',
        valeurParDefaut: 1.3,
        min: 1.0,
        max: 3.0,
        step: 0.1,
        groupe: 'Filtre Grandes Bougies & V-Shape',
      },
      {
        cle: 'exigerRetourSuperieurOuEgal',
        label: 'Exiger Bougie Retour >= Liquidation',
        description: 'En cas de V-Shape en 2/3 bougies, la bougie de réintégration doit être au moins aussi grande que la bougie de sortie',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Filtre Grandes Bougies & V-Shape',
      },
      {
        cle: 'maxBougiesHorsRange',
        label: 'Rapidité Maximale (Bougies Hors Range)',
        description: 'Nombre maximum de bougies tolérées en dehors du range avant réintégration',
        type: 'number',
        valeurParDefaut: 3,
        min: 1,
        max: 6,
        step: 1,
        groupe: 'Filtre Grandes Bougies & V-Shape',
      },
      {
        cle: 'ratioMecheRejetSimple',
        label: 'Ratio Mèche Rejet (Pinbar 1 Bougie)',
        description: 'Pour un Spring/UTAD en 1 bougie seule, fraction minimale de la bougie constituée par la mèche de rejet',
        type: 'number',
        valeurParDefaut: 0.40,
        min: 0.25,
        max: 0.80,
        step: 0.05,
        groupe: 'Filtre Grandes Bougies & V-Shape',
      },
      {
        cle: 'activerSpring',
        label: 'Détecter les Springs (Achats)',
        description: 'Active la détection des faux franchissements baissiers sous les supports de Range P&F',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Directions & Signaux',
      },
      {
        cle: 'activerUTAD',
        label: 'Détecter les UTAD (Ventes)',
        description: 'Active la détection des Upthrusts haussiers au-dessus des résistances de Range P&F',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Directions & Signaux',
      },
      {
        cle: 'afficherRanges',
        label: 'Afficher les Boîtes de Trading Range',
        description: 'Trace les zones rectangulaires délimitant les trading ranges P&F',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Affichage Graphique',
      },
      {
        cle: 'afficherLignesNiveaux',
        label: 'Afficher les Lignes S/R avec Compteur de Retests',
        description: 'Trace les niveaux horizontaux de supports/résistances avec indication de la force et du nombre de retests',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Affichage Graphique',
      },
      {
        cle: 'afficherCiblesWyckoff',
        label: 'Projeter les Cibles de Cause à Effet',
        description: 'Trace les lignes horizontales d\'objectifs de prix calculés selon le comptage horizontal Wyckoff',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Affichage Graphique',
      },
    ],
    creeLe: '2026-10-07T00:00:00.000Z',
    misAJourLe: '2026-10-07T00:00:00.000Z',
    code: `/**
 * Indicateur Scriptable : Wyckoff Point & Figure (Spring & UTAD)
 * Combine le filtrage de bruit Point & Figure, la détection des Springs / UTAD
 * et un filtre de volume institutionnel débrayable.
 */
return {
  calculer: function(contexte) {
    const { bougies, parametres } = contexte;
    if (!bougies || bougies.length < 50) return { donnees: {}, primitives: {} };

    const res = calculerWyckoffPointAndFigure(bougies, parametres);
    return {
      donnees: res,
      primitives: {
        boites: res.boites,
        lignes: res.lignes,
        labels: res.labels
      },
      typeSpecial: 'wyckoff-point-figure'
    };
  }
};`
  },
  {
    id: 'script-fractal-zigzag',
    nom: 'ZigZag Fractal Multi-Niveaux (Multi-Depth)',
    description: 'Imbrique 3 échelles de ZigZag (Macro, Intermédiaire, Micro) pour décomposer les vagues fractales, mesurer la confluence 3/3 et détecter les essoufflements précoces.',
    auteur: 'TradeLog AI / SMC',
    version: '1.0.0',
    type: 'overlay',
    actif: false,
    visibleSurGraphique: true,
    collecteActive: true,
    parametres: {
      profondeurMacro: 21,
      profondeurIntermediaire: 8,
      profondeurMicro: 3,
      lookbackBars: 600,
      afficherLignesMacro: true,
      afficherLignesIntermediaires: true,
      afficherLignesMicro: true,
      afficherLabelsMacro: true,
      afficherAlerteRetournement: true,
      afficherBadgeConfluence: true,
    },
    definitionsVariables: [
      {
        cle: 'profondeurMacro',
        label: 'Profondeur Vague Macro (HTF)',
        description: 'Sensibilité du ZigZag majeur définissant la grande orientation (défaut: 21)',
        type: 'number',
        valeurParDefaut: 21,
        min: 10,
        max: 60,
        step: 1,
        groupe: 'Échelles Fractales',
      },
      {
        cle: 'profondeurIntermediaire',
        label: 'Profondeur Vague Intermédiaire (MTF)',
        description: 'Sensibilité des sous-vagues de respiration et de swing (défaut: 8)',
        type: 'number',
        valeurParDefaut: 8,
        min: 5,
        max: 25,
        step: 1,
        groupe: 'Échelles Fractales',
      },
      {
        cle: 'profondeurMicro',
        label: 'Profondeur Micro-Vague (LTF)',
        description: 'Sensibilité de la micro-structure et des cassures internes (défaut: 3)',
        type: 'number',
        valeurParDefaut: 3,
        min: 2,
        max: 10,
        step: 1,
        groupe: 'Échelles Fractales',
      },
      {
        cle: 'lookbackBars',
        label: 'Historique de Bougies Analysé',
        description: 'Nombre de bougies récentes prises en compte pour le calcul',
        type: 'number',
        valeurParDefaut: 600,
        min: 100,
        max: 2000,
        step: 50,
        groupe: 'Échelles Fractales',
      },
      {
        cle: 'afficherLignesMacro',
        label: 'Afficher la Ligne Macro (Or Épais)',
        description: 'Trace la grande vague directrice sur le graphique',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Affichage des Vagues',
      },
      {
        cle: 'afficherLignesIntermediaires',
        label: 'Afficher les Lignes Intermédiaires (Bleu)',
        description: 'Trace les vagues secondaires de swing',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Affichage des Vagues',
      },
      {
        cle: 'afficherLignesMicro',
        label: 'Afficher les Lignes Micro (Cyan Pointillé)',
        description: 'Trace les micro-impulsions et respirations internes',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Affichage des Vagues',
      },
      {
        cle: 'afficherLabelsMacro',
        label: 'Afficher les Labels HH / LL Macro',
        description: 'Indique les sommets et creux majeurs de la structure',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Analyses & Alertes',
      },
      {
        cle: 'afficherAlerteRetournement',
        label: 'Alerte Retournement Précoce (Micro CHoCH)',
        description: 'Alerte visuelle lorsque la micro-structure casse à contre-sens de la grande vague macro',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Analyses & Alertes',
      },
      {
        cle: 'afficherBadgeConfluence',
        label: 'Afficher le Badge de Confluence (3/3)',
        description: 'Affiche un badge de synthèse des 3 niveaux sur la dernière bougie',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Analyses & Alertes',
      },
    ],
    creeLe: '2026-10-08T00:00:00.000Z',
    misAJourLe: '2026-10-08T00:00:00.000Z',
    code: `/**
 * Indicateur Scriptable : ZigZag Fractal Multi-Niveaux
 * Superpose 3 niveaux fractals de vagues pour visualiser l'imbrication du marché.
 */
return {
  calculer: function(contexte) {
    const { bougies, parametres } = contexte;
    if (!bougies || bougies.length < 40) return { donnees: {}, primitives: {} };

    const res = calculerFractalZigZag(bougies, parametres);
    return {
      donnees: res,
      primitives: {
        boites: res.boites,
        lignes: res.lignes,
        labels: res.labels
      },
      typeSpecial: 'fractal-zigzag'
    };
  }
};`
  },
  {
    id: 'script-candlestick-patterns-repo32',
    nom: 'Candlesticks Patterns Identified (repo32)',
    description: 'Détection automatique de 15 figures en chandeliers japonais (Doji, Engulfing, Harami, Hammer, Morning/Evening Star, Kickers...) selon le script officiel TradingView de repo32 (mise à jour 1-17-26).',
    auteur: 'repo32 / TradeLog',
    version: '1.17.26',
    type: 'overlay',
    actif: true,
    visibleSurGraphique: true,
    collecteActive: true,
    parametres: {
      dojiSize: 0.05,
      activerFiltreTendance: false,
      trendBars: 5,
      bullColor: '#00E676',
      bearColor: '#F23645',
      dojiColor: '#FFFFFF',
      activerDoji: true,
      activerBearishHarami: true,
      activerBullishHarami: true,
      activerBearishEngulfing: true,
      activerBullishEngulfing: true,
      activerPiercingLine: true,
      activerBullishBelt: true,
      activerBullishKicker: true,
      activerBearishKicker: true,
      activerHangingMan: true,
      activerEveningStar: true,
      activerMorningStar: true,
      activerShootingStar: true,
      activerHammer: true,
      activerInvertedHammer: true,
    },
    definitionsVariables: [
      {
        cle: 'dojiSize',
        label: 'Taille Relative du Doji',
        description: 'Proportion maximale du corps par rapport à la hauteur totale (0.05 = 5%)',
        type: 'number',
        valeurParDefaut: 0.05,
        min: 0.01,
        max: 0.20,
        step: 0.01,
        groupe: 'Sensibilité & Tendance',
      },
      {
        cle: 'activerFiltreTendance',
        label: 'Activer le Filtre de Tendance',
        description: 'Filtre les motifs selon la tendance précédente des barres (désactivé par défaut comme dans la mise à jour 1-17-26 pour voir tous les motifs)',
        type: 'boolean',
        valeurParDefaut: false,
        groupe: 'Sensibilité & Tendance',
      },
      {
        cle: 'trendBars',
        label: 'Nombre de Barres de Tendance',
        description: 'Nombre de bougies pour estimer la tendance précédente si le filtre est activé',
        type: 'number',
        valeurParDefaut: 5,
        min: 1,
        max: 50,
        step: 1,
        groupe: 'Sensibilité & Tendance',
      },
      {
        cle: 'bullColor',
        label: 'Couleur des Motifs Haussiers',
        description: 'Couleur des étiquettes haussières (Engulfing, Harami, Hammer, Morning Star...)',
        type: 'string',
        valeurParDefaut: '#00E676',
        groupe: 'Couleurs & Style',
      },
      {
        cle: 'bearColor',
        label: 'Couleur des Motifs Baissiers',
        description: 'Couleur des étiquettes baissières (Engulfing, Harami, Hanging Man, Evening Star...)',
        type: 'string',
        valeurParDefaut: '#F23645',
        groupe: 'Couleurs & Style',
      },
      {
        cle: 'dojiColor',
        label: 'Couleur du Doji',
        description: 'Couleur de l\'étiquette pour les bougies Doji',
        type: 'string',
        valeurParDefaut: '#FFFFFF',
        groupe: 'Couleurs & Style',
      },
      {
        cle: 'activerDoji',
        label: 'Détecter les Doji',
        description: 'Affiche les Dojis sur le graphique',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Sélection des Motifs',
      },
      {
        cle: 'activerBullishEngulfing',
        label: 'Bullish Engulfing (Avalement Haussier)',
        description: 'Affiche les avalements haussiers',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Sélection des Motifs',
      },
      {
        cle: 'activerBearishEngulfing',
        label: 'Bearish Engulfing (Avalement Baissier)',
        description: 'Affiche les avalements baissiers',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Sélection des Motifs',
      },
      {
        cle: 'activerBullishHarami',
        label: 'Bullish Harami (Harami Haussier)',
        description: 'Affiche les haramis haussiers',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Sélection des Motifs',
      },
      {
        cle: 'activerBearishHarami',
        label: 'Bearish Harami (Harami Baissier)',
        description: 'Affiche les haramis baissiers',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Sélection des Motifs',
      },
      {
        cle: 'activerHammer',
        label: 'Hammer (Marteau "H")',
        description: 'Affiche les marteaux haussiers avec le label "H"',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Sélection des Motifs',
      },
      {
        cle: 'activerInvertedHammer',
        label: 'Inverted Hammer (Marteau Inversé "IH")',
        description: 'Affiche les marteaux inversés avec le label "IH"',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Sélection des Motifs',
      },
      {
        cle: 'activerMorningStar',
        label: 'Morning Star (Étoile du Matin)',
        description: 'Affiche les étoiles du matin sur 3 bougies',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Sélection des Motifs',
      },
      {
        cle: 'activerEveningStar',
        label: 'Evening Star (Étoile du Soir)',
        description: 'Affiche les étoiles du soir sur 3 bougies',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Sélection des Motifs',
      },
      {
        cle: 'activerShootingStar',
        label: 'Shooting Star (Étoile Filante)',
        description: 'Affiche les étoiles filantes baissières',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Sélection des Motifs',
      },
      {
        cle: 'activerHangingMan',
        label: 'Hanging Man (Pendu)',
        description: 'Affiche les pendus baissiers',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Sélection des Motifs',
      },
      {
        cle: 'activerPiercingLine',
        label: 'Piercing Line (Pénétrante Haussière)',
        description: 'Affiche les lignes pénétrantes',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Sélection des Motifs',
      },
      {
        cle: 'activerBullishBelt',
        label: 'Bullish Belt (Ceinture Haussière)',
        description: 'Affiche les ceintures haussières (Belt Hold)',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Sélection des Motifs',
      },
      {
        cle: 'activerBullishKicker',
        label: 'Bullish Kicker',
        description: 'Affiche les kickers haussiers',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Sélection des Motifs',
      },
      {
        cle: 'activerBearishKicker',
        label: 'Bearish Kicker',
        description: 'Affiche les kickers baissiers',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Sélection des Motifs',
      },
    ],
    creeLe: '2026-10-09T00:00:00.000Z',
    misAJourLe: '2026-10-09T00:00:00.000Z',
    code: `/**
 * Indicateur Scriptable : Candlesticks Patterns Identified (repo32)
 * Détecte les 15 figures en chandeliers japonais selon le script TradingView de repo32.
 */
return {
  calculer: function(contexte) {
    const { bougies, parametres } = contexte;
    if (!bougies || bougies.length < 2) return { donnees: {}, primitives: {} };

    const res = calculerCandlestickPatterns(bougies, parametres);
    return {
      donnees: res,
      primitives: res.primitives,
      typeSpecial: 'candlestick-patterns'
    };
  }
};`
  },
  {
    id: 'script-liquidation-reintegration',
    nom: 'Liquidation & Réintégration (Liq / Reint)',
    description: 'Détecte les setups exclusifs de sweep / liquidation suivis d\'une réintégration impulsive immédiate : Bougie 1 étendue (corps+mèches >= 1.75x moyenne), Bougie 2 au corps plein (>= 1.75x moyenne) et clôture millimétrée au niveau de l\'ouverture de départ (marge <= 5%).',
    auteur: 'TradeLog Strategy',
    version: '1.0.0',
    type: 'overlay',
    actif: true,
    visibleSurGraphique: true,
    collecteActive: true,
    parametres: {
      toleranceDeficit: 0.05,
      toleranceDepassement: 0.25,
      activerFiltreTaille: true,
      periodeHistorique: 10,
      multiplicateurBougie1: 1.75,
      multiplicateurCorps2: 1.75,
      activerAchat: true,
      activerVente: true,
      bullColor: '#00E676',
      bearColor: '#F23645',
      texteLabel: 'Liq\\nReint',
      activerFiltreTendance: false,
      trendBars: 5,
    },
    definitionsVariables: [
      {
        cle: 'toleranceDeficit',
        label: 'Tolérance en Retrait (En deçà d\'Open 1)',
        description: 'Marge maximale admise si la réintégration reste un peu courte par rapport à l\'ouverture de départ (0.05 = 5% de la hauteur moyenne)',
        type: 'number',
        valeurParDefaut: 0.05,
        min: 0.01,
        max: 0.20,
        step: 0.01,
        groupe: 'Règles de Proximité Asymétrique',
      },
      {
        cle: 'toleranceDepassement',
        label: 'Tolérance en Dépassement Favorable',
        description: 'Marge élargie autorisée si la réintégration dépasse l\'ouverture de départ dans le sens du retournement (0.25 = 25% de la hauteur moyenne)',
        type: 'number',
        valeurParDefaut: 0.25,
        min: 0.05,
        max: 1.00,
        step: 0.05,
        groupe: 'Règles de Proximité Asymétrique',
      },
      {
        cle: 'activerFiltreTaille',
        label: 'Activer le Filtre de Taille & Impulsion',
        description: 'Exige que les bougies dépassent la moyenne récente pour confirmer un vrai sweep et un fort engagement',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Filtres de Momentum',
      },
      {
        cle: 'periodeHistorique',
        label: 'Période Récente de Référence',
        description: 'Nombre de bougies d\'historique servant à calculer la moyenne de référence',
        type: 'number',
        valeurParDefaut: 10,
        min: 3,
        max: 50,
        step: 1,
        groupe: 'Filtres de Momentum',
      },
      {
        cle: 'multiplicateurBougie1',
        label: 'Multiplicateur Bougie 1 (Entière)',
        description: 'Multiplicateur minimum pour toute la bougie 1 de liquidation (corps + mèches) par rapport à la moyenne des tailles',
        type: 'number',
        valeurParDefaut: 1.75,
        min: 1.0,
        max: 5.0,
        step: 0.05,
        groupe: 'Filtres de Momentum',
      },
      {
        cle: 'multiplicateurCorps2',
        label: 'Multiplicateur Bougie 2 (Corps Pur)',
        description: 'Multiplicateur minimum pour le corps de la bougie 2 de réintégration (sans les mèches) par rapport à la moyenne des corps',
        type: 'number',
        valeurParDefaut: 1.75,
        min: 1.0,
        max: 5.0,
        step: 0.05,
        groupe: 'Filtres de Momentum',
      },
      {
        cle: 'activerAchat',
        label: 'Activer Signaux d\'Achat (Long)',
        description: 'Affiche les signaux de réintégration haussière après liquidation vendeuse',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Directions & Filtres',
      },
      {
        cle: 'activerVente',
        label: 'Activer Signaux de Vente (Short)',
        description: 'Affiche les signaux de réintégration baissière après liquidation acheteuse',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Directions & Filtres',
      },
      {
        cle: 'bullColor',
        label: 'Couleur Signal Achat',
        description: 'Couleur de l\'étiquette acheteuse',
        type: 'string',
        valeurParDefaut: '#00E676',
        groupe: 'Couleurs & Style',
      },
      {
        cle: 'bearColor',
        label: 'Couleur Signal Vente',
        description: 'Couleur de l\'étiquette vendeuse',
        type: 'string',
        valeurParDefaut: '#F23645',
        groupe: 'Couleurs & Style',
      },
      {
        cle: 'texteLabel',
        label: 'Texte Affiché sur le Graphique',
        description: 'Texte de l\'étiquette (utiliser \\n pour un retour à la ligne)',
        type: 'string',
        valeurParDefaut: 'Liq\\nReint',
        groupe: 'Couleurs & Style',
      },
      {
        cle: 'activerFiltreTendance',
        label: 'Activer Filtre de Tendance Globale',
        description: 'Exige que le signal aille dans le sens opposé à la tendance des barres précédentes',
        type: 'boolean',
        valeurParDefaut: false,
        groupe: 'Directions & Filtres',
      },
      {
        cle: 'trendBars',
        label: 'Barres d\'Estimation de Tendance',
        description: 'Nombre de bougies pour estimer la tendance préalable',
        type: 'number',
        valeurParDefaut: 5,
        min: 1,
        max: 50,
        step: 1,
        groupe: 'Directions & Filtres',
      },
    ],
    creeLe: '2026-10-11T00:00:00.000Z',
    misAJourLe: '2026-10-11T00:00:00.000Z',
    code: `/**
 * Indicateur Scriptable Autonome : Liquidation & Réintégration (Liq / Reint)
 * Détecte les setups impulsifs de sweep suivis d'une réintégration immédiate.
 */
return {
  calculer: function(contexte) {
    const { bougies, parametres } = contexte;
    if (!bougies || bougies.length < 2) return { donnees: {}, primitives: {} };

    const res = calculerLiquidationReintegration(bougies, parametres);
    return {
      donnees: res,
      primitives: res.primitives,
      typeSpecial: 'liquidation-reintegration'
    };
  }
};`
  },
  {
    id: 'script-liquidation-sweep-combo',
    nom: 'Liq/Reint + Sweep Liquidité (BSL/SSL)',
    description: 'Combine le setup de chandelier Liquidation & Réintégration avec la détection de la liquidité balayée. Montre précisément la ligne du niveau SSL ou BSL qui a été balayé par la mèche extrême, la zone de sweep et le signal de reprise.',
    auteur: 'TradeLog Strategy',
    version: '1.0.0',
    type: 'overlay',
    actif: true,
    visibleSurGraphique: true,
    collecteActive: true,
    parametres: {
      exigerLiquiditeBalayee: true,
      modeSelectionLiquidite: 'SCORE_OPTIMAL',
      sensibilitePivotLiquidite: 3,
      lookbackLiquidite: 80,
      distanceMinBougies: 3,
      reliefMinPivot: 0.5,
      penetrationMaxRatio: 1.5,
      penetrationMinRatio: 0.05,
      exigerNiveauIntact: true,
      toleranceDeficit: 0.05,
      toleranceDepassement: 0.25,
      activerFiltreTaille: true,
      periodeHistorique: 10,
      multiplicateurBougie1: 1.75,
      multiplicateurCorps2: 1.75,
      activerAchat: true,
      activerVente: true,
      afficherLigneLiquidite: true,
      afficherZoneSweep: false,
      afficherBadgeScore: true,
      bullColor: '#00E676',
      bearColor: '#F23645',
      texteLabel: 'Liq/Reint',
      activerFiltreTendance: false,
      trendBars: 5,
    },
    definitionsVariables: [
      {
        cle: 'exigerLiquiditeBalayee',
        label: 'Exiger Liquidité Antérieure Balayée',
        description: 'Ne valide le setup QUE si le point extrême (mèche) a réellement balayé un creux (SSL) ou sommet (BSL) préalable',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Sélection de la Liquidité Adaptée',
      },
      {
        cle: 'modeSelectionLiquidite',
        label: 'Mode de Sélection de Liquidité',
        description: 'SCORE_OPTIMAL (compromis relief/pénétration/proximité), SWING_MAJEUR (plus fort relief) ou RECENT_VALIDE (premier niveau récent)',
        type: 'select',
        valeurParDefaut: 'SCORE_OPTIMAL',
        options: [
          { label: 'Score Optimal (Recommandé)', value: 'SCORE_OPTIMAL' },
          { label: 'Swing Majeur (Plus Fort Relief)', value: 'SWING_MAJEUR' },
          { label: 'Récent Valide (Structure Immédiate)', value: 'RECENT_VALIDE' },
        ],
        groupe: 'Sélection de la Liquidité Adaptée',
      },
      {
        cle: 'sensibilitePivotLiquidite',
        label: 'Sensibilité Détection Pivot',
        description: 'Nombre de bougies à gauche et à droite pour valider un sommet ou un creux',
        type: 'number',
        valeurParDefaut: 3,
        min: 2,
        max: 10,
        step: 1,
        groupe: 'Sélection de la Liquidité Adaptée',
      },
      {
        cle: 'lookbackLiquidite',
        label: 'Historique Recherche (Bougies)',
        description: 'Nombre maximal de bougies antérieures scannées pour trouver le niveau balayé',
        type: 'number',
        valeurParDefaut: 80,
        min: 10,
        max: 300,
        step: 10,
        groupe: 'Sélection de la Liquidité Adaptée',
      },
      {
        cle: 'distanceMinBougies',
        label: 'Distance Minimale (Bougies)',
        description: 'Écart minimal en bougies pour ignorer le micro-bruit interne immédiat',
        type: 'number',
        valeurParDefaut: 3,
        min: 1,
        max: 20,
        step: 1,
        groupe: 'Sélection de la Liquidité Adaptée',
      },
      {
        cle: 'reliefMinPivot',
        label: 'Relief Minimal du Pivot (Ratio)',
        description: 'Hauteur minimale du creux ou sommet par rapport à la taille moyenne d\'une bougie (0.5 = 50% de la taille moyenne)',
        type: 'number',
        valeurParDefaut: 0.5,
        min: 0.1,
        max: 3.0,
        step: 0.1,
        groupe: 'Proportionnalité & Pénétration',
      },
      {
        cle: 'penetrationMaxRatio',
        label: 'Pénétration Maximale Tolérée (Ratio)',
        description: 'Dépassement maximal au-delà du niveau pour éviter les cassures franches / breakouts violents (1.5 = 150%)',
        type: 'number',
        valeurParDefaut: 1.5,
        min: 0.5,
        max: 5.0,
        step: 0.1,
        groupe: 'Proportionnalité & Pénétration',
      },
      {
        cle: 'penetrationMinRatio',
        label: 'Pénétration Minimale Requise (Ratio)',
        description: 'Dépassement minimal nécessaire pour confirmer le déclenchement effectif des stop-loss (0.05 = 5%)',
        type: 'number',
        valeurParDefaut: 0.05,
        min: 0.01,
        max: 0.5,
        step: 0.01,
        groupe: 'Proportionnalité & Pénétration',
      },
      {
        cle: 'exigerNiveauIntact',
        label: 'Exiger Niveau Intact (Non-Mitigé)',
        description: 'Garantit que le niveau n\'a jamais été percé avant notre setup (liquidité fraîche)',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Proportionnalité & Pénétration',
      },
      {
        cle: 'afficherBadgeScore',
        label: 'Afficher Badge de Score & Qualité',
        description: 'Affiche la note de pertinence sur 100 et le statut majeur/mineur sur l\'étiquette',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Visuels & Graphique',
      },
      {
        cle: 'toleranceDeficit',
        label: 'Tolérance en Retrait (En deçà d\'Open 1)',
        description: 'Marge maximale admise si la réintégration reste un peu courte par rapport à l\'ouverture de départ (0.05 = 5% de la hauteur moyenne)',
        type: 'number',
        valeurParDefaut: 0.05,
        min: 0.01,
        max: 0.20,
        step: 0.01,
        groupe: 'Règles de Proximité Asymétrique',
      },
      {
        cle: 'toleranceDepassement',
        label: 'Tolérance en Dépassement Favorable',
        description: 'Marge élargie autorisée si la réintégration dépasse l\'ouverture de départ dans le sens du retournement (0.25 = 25% de la hauteur moyenne)',
        type: 'number',
        valeurParDefaut: 0.25,
        min: 0.05,
        max: 1.00,
        step: 0.05,
        groupe: 'Règles de Proximité Asymétrique',
      },
      {
        cle: 'activerFiltreTaille',
        label: 'Activer le Filtre de Taille & Impulsion',
        description: 'Exige que les bougies dépassent la moyenne récente pour confirmer un vrai sweep et un fort engagement',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Filtres de Momentum',
      },
      {
        cle: 'periodeHistorique',
        label: 'Période Récente de Référence',
        description: 'Nombre de bougies d\'historique servant à calculer la moyenne de référence',
        type: 'number',
        valeurParDefaut: 10,
        min: 3,
        max: 50,
        step: 1,
        groupe: 'Filtres de Momentum',
      },
      {
        cle: 'multiplicateurBougie1',
        label: 'Multiplicateur Bougie 1 (Entière)',
        description: 'Multiplicateur minimum pour toute la bougie 1 de liquidation (corps + mèches) par rapport à la moyenne des tailles',
        type: 'number',
        valeurParDefaut: 1.75,
        min: 1.0,
        max: 5.0,
        step: 0.05,
        groupe: 'Filtres de Momentum',
      },
      {
        cle: 'multiplicateurCorps2',
        label: 'Multiplicateur Bougie 2 (Corps Pur)',
        description: 'Multiplicateur minimum pour le corps de la bougie 2 de réintégration (sans les mèches) par rapport à la moyenne des corps',
        type: 'number',
        valeurParDefaut: 1.75,
        min: 1.0,
        max: 5.0,
        step: 0.05,
        groupe: 'Filtres de Momentum',
      },
      {
        cle: 'activerAchat',
        label: 'Activer Signaux d\'Achat (Long)',
        description: 'Affiche les signaux d\'achat (Spring / Sweep de creux SSL)',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Directions & Filtres',
      },
      {
        cle: 'activerVente',
        label: 'Activer Signaux de Vente (Short)',
        description: 'Affiche les signaux de vente (UTAD / Sweep de sommet BSL)',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Directions & Filtres',
      },
      {
        cle: 'bullColor',
        label: 'Couleur Signal Achat',
        description: 'Couleur de l\'étiquette et de la ligne de liquidité balayée acheteuse',
        type: 'string',
        valeurParDefaut: '#00E676',
        groupe: 'Visuels & Graphique',
      },
      {
        cle: 'bearColor',
        label: 'Couleur Signal Vente',
        description: 'Couleur de l\'étiquette et de la ligne de liquidité balayée vendeuse',
        type: 'string',
        valeurParDefaut: '#F23645',
        groupe: 'Visuels & Graphique',
      },
      {
        cle: 'texteLabel',
        label: 'Texte du Signal',
        description: 'Texte affiché sur le graphique au moment de la confirmation',
        type: 'string',
        valeurParDefaut: 'Liq/Reint',
        groupe: 'Visuels & Graphique',
      },
      {
        cle: 'activerFiltreTendance',
        label: 'Activer Filtre de Tendance Globale',
        description: 'Exige que le signal aille dans le sens opposé à la tendance des barres précédentes',
        type: 'boolean',
        valeurParDefaut: false,
        groupe: 'Directions & Filtres',
      },
      {
        cle: 'trendBars',
        label: 'Barres d\'Estimation de Tendance',
        description: 'Nombre de bougies pour estimer la tendance préalable',
        type: 'number',
        valeurParDefaut: 5,
        min: 1,
        max: 50,
        step: 1,
        groupe: 'Directions & Filtres',
      },
    ],
    creeLe: '2026-10-11T00:00:00.000Z',
    misAJourLe: '2026-10-11T00:00:00.000Z',
    code: `/**
 * Indicateur Scriptable : Liq/Reint + Sweep Liquidité (BSL/SSL)
 * Détecte le setup de réintégration et identifie la liquidité antérieure balayée.
 */
return {
  calculer: function(contexte) {
    const { bougies, parametres } = contexte;
    if (!bougies || bougies.length < 5) return { donnees: {}, primitives: {} };

    const res = calculerLiquidationSweepCombo(bougies, parametres);
    return {
      donnees: res,
      primitives: res.primitives,
      typeSpecial: 'liquidation-sweep-combo'
    };
  }
};`
  },
  {
    id: 'script-liquidation-sweep-pf',
    nom: 'Liq/Reint + Sweep Point & Figure (P&F)',
    description: 'Combine le setup de chandelier Liquidation & Réintégration avec la détection du palier de Support ou Résistance Point & Figure (P&F) le plus testé (« le niveau carré »). Trace le niveau P&F, la boîte de la cause Wyckoff et la zone de sweep.',
    auteur: 'TradeLog / Wyckoff P&F',
    version: '1.0.0',
    type: 'overlay',
    actif: true,
    visibleSurGraphique: true,
    collecteActive: true,
    parametres: {
      exigerNiveauPFBalaye: true,
      modeTailleBox: 'auto_atr',
      periodeATR: 14,
      ratioBoxATR: 0.5,
      tailleBoxPips: 10,
      reversalCount: 3,
      minColonnesAlignees: 2,
      lookbackBars: 60,
      exigerPalierIntact: true,
      detecterDoubleLiquidation: true,
      toleranceDeficit: 0.05,
      toleranceDepassement: 0.25,
      activerFiltreTaille: true,
      periodeHistorique: 10,
      multiplicateurBougie1: 1.75,
      multiplicateurCorps2: 1.75,
      activerAchat: true,
      activerVente: true,
      afficherLignePF: true,
      afficherZoneSweep: false,
      afficherBoiteCausePF: false,
      bullColor: '#00E676',
      bearColor: '#F23645',
      texteLabel: 'Liq/Reint',
      activerFiltreTendance: false,
      trendBars: 5,
    },
    definitionsVariables: [
      {
        cle: 'exigerNiveauPFBalaye',
        label: 'Exiger Palier P&F Balayé',
        description: 'Ne valide le setup QUE si la mèche extrême a percé un niveau carré de support ou résistance P&F',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Grille Point & Figure',
      },
      {
        cle: 'modeTailleBox',
        label: 'Mode Taille de Boîte P&F',
        description: 'Calcul automatique selon l\'ATR ou pas fixe en pips',
        type: 'select',
        valeurParDefaut: 'auto_atr',
        options: [
          { label: 'Automatique (ATR Adaptatif)', value: 'auto_atr' },
          { label: 'Fixe en Pips', value: 'fixe' },
        ],
        groupe: 'Grille Point & Figure',
      },
      {
        cle: 'reversalCount',
        label: 'Nombre de Boîtes Retournement (Reversal)',
        description: 'Seuil de retournement pour changer de colonne (3 = standard Wyckoff)',
        type: 'number',
        valeurParDefaut: 3,
        min: 1,
        max: 5,
        step: 1,
        groupe: 'Grille Point & Figure',
      },
      {
        cle: 'minColonnesAlignees',
        label: 'Min Colonnes Alignées (Palier Carré)',
        description: 'Nombre minimum de colonnes P&F arrêtées sur le même niveau pour valider un support/résistance carré (défaut: 2)',
        type: 'number',
        valeurParDefaut: 2,
        min: 2,
        max: 6,
        step: 1,
        groupe: 'Grille Point & Figure',
      },
      {
        cle: 'lookbackBars',
        label: 'Historique Analyse P&F (Bougies)',
        description: 'Nombre de bougies récentes analysées pour construire la consolidation P&F (défaut: 60)',
        type: 'number',
        valeurParDefaut: 60,
        min: 20,
        max: 200,
        step: 10,
        groupe: 'Grille Point & Figure',
      },
      {
        cle: 'exigerPalierIntact',
        label: 'Palier Intact Uniquement (Non Consommé)',
        description: 'Exige qu\'aucune bougie antérieure n\'ait clôturé au-delà du palier avant le setup (Unmitigated)',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Fraîcheur & Précision de Liquidité',
      },
      {
        cle: 'detecterDoubleLiquidation',
        label: 'Détecter Doubles Liquidations (Re-Sweep)',
        description: 'Identifie si une 1ère incursion a eu lieu récemment et que le setup fait une 2ème liquidation de confirmation',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Fraîcheur & Précision de Liquidité',
      },
      {
        cle: 'afficherLignePF',
        label: 'Afficher Ligne Horizontale P&F',
        description: 'Trace le niveau horizontal du palier P&F carré balayé',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Visuels & Graphique',
      },
      {
        cle: 'afficherBoiteCausePF',
        label: 'Afficher Boîte de Cause P&F',
        description: 'Affiche la boîte de consolidation Wyckoff proportionnelle à la largeur des colonnes alignées',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Visuels & Graphique',
      },
      {
        cle: 'afficherZoneSweep',
        label: 'Afficher Zone de Sweep',
        description: 'Affiche la boîte rectangulaire illustrant l\'espace percé sous/sur le palier',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Visuels & Graphique',
      },
      {
        cle: 'toleranceDeficit',
        label: 'Tolérance en Retrait (En deçà d\'Open 1)',
        description: 'Marge maximale admise si la réintégration reste un peu courte (0.05 = 5%)',
        type: 'number',
        valeurParDefaut: 0.05,
        min: 0.01,
        max: 0.20,
        step: 0.01,
        groupe: 'Règles de Proximité Asymétrique',
      },
      {
        cle: 'toleranceDepassement',
        label: 'Tolérance en Dépassement Favorable',
        description: 'Marge élargie autorisée si la réintégration dépasse l\'ouverture (0.25 = 25%)',
        type: 'number',
        valeurParDefaut: 0.25,
        min: 0.05,
        max: 1.00,
        step: 0.05,
        groupe: 'Règles de Proximité Asymétrique',
      },
      {
        cle: 'activerFiltreTaille',
        label: 'Activer Filtre de Taille & Impulsion',
        description: 'Exige que les bougies dépassent la moyenne récente',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Filtres de Momentum',
      },
      {
        cle: 'multiplicateurBougie1',
        label: 'Multiplicateur Bougie 1 (Entière)',
        description: 'Taille minimale par rapport à la moyenne récente (défaut: 1.75x)',
        type: 'number',
        valeurParDefaut: 1.75,
        min: 1.0,
        max: 5.0,
        step: 0.05,
        groupe: 'Filtres de Momentum',
      },
      {
        cle: 'multiplicateurCorps2',
        label: 'Multiplicateur Bougie 2 (Corps Pur)',
        description: 'Taille minimale du corps par rapport à la moyenne des corps (défaut: 1.75x)',
        type: 'number',
        valeurParDefaut: 1.75,
        min: 1.0,
        max: 5.0,
        step: 0.05,
        groupe: 'Filtres de Momentum',
      },
      {
        cle: 'activerAchat',
        label: 'Activer Signaux d\'Achat (Long)',
        description: 'Affiche les springs et balayages de supports P&F',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Directions & Filtres',
      },
      {
        cle: 'activerVente',
        label: 'Activer Signaux de Vente (Short)',
        description: 'Affiche les UTAD et balayages de résistances P&F',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Directions & Filtres',
      },
      {
        cle: 'bullColor',
        label: 'Couleur Signal Achat',
        description: 'Couleur de l\'étiquette et de la ligne de support P&F',
        type: 'string',
        valeurParDefaut: '#00E676',
        groupe: 'Visuels & Graphique',
      },
      {
        cle: 'bearColor',
        label: 'Couleur Signal Vente',
        description: 'Couleur de l\'étiquette et de la ligne de résistance P&F',
        type: 'string',
        valeurParDefaut: '#F23645',
        groupe: 'Visuels & Graphique',
      },
    ],
    creeLe: '2026-10-12T00:00:00.000Z',
    misAJourLe: '2026-10-12T00:00:00.000Z',
    code: `/**
 * Indicateur Scriptable : Liq/Reint + Sweep Point & Figure (P&F)
 * Détecte le setup de réintégration et identifie le palier carré P&F balayé.
 */
return {
  calculer: function(contexte) {
    const { bougies, parametres } = contexte;
    if (!bougies || bougies.length < 10) return { donnees: {}, primitives: {} };

    const res = calculerLiquidationSweepPointFigure(bougies, parametres);
    return {
      donnees: res,
      primitives: res.primitives,
      typeSpecial: 'liquidation-sweep-pf'
    };
  }
};`
  },
  {
    id: 'script-liquidation-sweep-shved',
    nom: 'Liq/Reint + Sweep Shved Supply & Demand',
    description: 'Combine le setup de chandelier Liquidation & Réintégration avec les zones institutionnelles Shved Supply & Demand. Identifie quelle zone de Demande (Support) ou Offre (Résistance) a été balayée, en priorisant les zones les plus solides (PROVEN / grand nombre de retests) et en supportant l\'analyse multi-timeframe LTF.',
    auteur: 'TradeLog / Shved Strategy',
    version: '1.0.0',
    type: 'overlay',
    actif: true,
    visibleSurGraphique: true,
    collecteActive: true,
    parametres: {
      exigerZoneShvedBalayee: true,
      forceMinimaleZone: 'TOUTES',
      minRetests: 0,
      timeframeSource: 'ACTUEL',
      lookbackMaxBars: 40,
      exigerZoneIntacte: true,
      detecterDoubleLiquidation: true,
      periodeATR: 7,
      zoneFuzzFactor: 0.75,
      toleranceDeficit: 0.05,
      toleranceDepassement: 0.25,
      activerFiltreTaille: true,
      periodeHistorique: 10,
      multiplicateurBougie1: 1.75,
      multiplicateurCorps2: 1.75,
      activerAchat: true,
      activerVente: true,
      afficherZoneShved: false,
      afficherZoneSweep: false,
      afficherLigneConnexion: true,
      bullColor: '#00E676',
      bearColor: '#F23645',
      texteLabel: 'Liq/Reint',
      activerFiltreTendance: false,
      trendBars: 5,
    },
    definitionsVariables: [
      {
        cle: 'exigerZoneShvedBalayee',
        label: 'Exiger Zone Shved Balayée',
        description: 'Ne valide le setup QUE si la mèche extrême a percé une vraie zone Shved Supply ou Demand',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Zones Shved Supply & Demand',
      },
      {
        cle: 'forceMinimaleZone',
        label: 'Force Minimale de Zone Requise',
        description: 'Filtre de solidité institutionnelle (PROVEN_SEULEMENT = > 3 retests)',
        type: 'select',
        valeurParDefaut: 'TOUTES',
        options: [
          { label: 'Toutes les Zones (Untested, Verified, Proven)', value: 'TOUTES' },
          { label: 'Au moins Vérifiée (Verified & Proven)', value: 'VERIFIED_MIN' },
          { label: 'Prouvée / Majeure Uniquement (> 3 retests)', value: 'PROVEN_SEULEMENT' },
        ],
        groupe: 'Zones Shved Supply & Demand',
      },
      {
        cle: 'minRetests',
        label: 'Nombre Minimum de Retests',
        description: 'Seuil minimum de rebonds constatés (0 = inclut les zones fraîches immédiates)',
        type: 'number',
        valeurParDefaut: 0,
        min: 0,
        max: 10,
        step: 1,
        groupe: 'Zones Shved Supply & Demand',
      },
      {
        cle: 'lookbackMaxBars',
        label: 'Fenêtre Récente (Lookback Bougies)',
        description: 'Nombre de bougies récentes analysées pour trouver la zone balayée (défaut: 40)',
        type: 'number',
        valeurParDefaut: 40,
        min: 10,
        max: 200,
        step: 5,
        groupe: 'Fraîcheur & Précision de Liquidité',
      },
      {
        cle: 'exigerZoneIntacte',
        label: 'Zone Intacte Uniquement (Non Consommée)',
        description: 'Exige qu\'aucune bougie antérieure n\'ait clôturé au-delà de la zone avant le setup (Unmitigated)',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Fraîcheur & Précision de Liquidité',
      },
      {
        cle: 'detecterDoubleLiquidation',
        label: 'Détecter Doubles Liquidations (Re-Sweep)',
        description: 'Identifie si une 1ère incursion a eu lieu récemment et que le setup fait une 2ème liquidation de confirmation',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Fraîcheur & Précision de Liquidité',
      },
      {
        cle: 'timeframeSource',
        label: 'Unité de Temps Source (LTF / HTF)',
        description: 'Timeframe d\'analyse des zones (ACTUEL, M15, M5, H1, etc.)',
        type: 'string',
        valeurParDefaut: 'ACTUEL',
        groupe: 'Zones Shved Supply & Demand',
      },
      {
        cle: 'periodeATR',
        label: 'Période ATR Shved (Tolérance)',
        description: 'Période pour dimensionner l\'épaisseur dynamique de chaque zone',
        type: 'number',
        valeurParDefaut: 7,
        min: 3,
        max: 20,
        step: 1,
        groupe: 'Dimensions Shved',
      },
      {
        cle: 'zoneFuzzFactor',
        label: 'Facteur d\'Épaisseur Zone (ATR)',
        description: 'Multiplicateur de l\'ATR pour l\'épaisseur du rectangle de zone (défaut: 0.75)',
        type: 'number',
        valeurParDefaut: 0.75,
        min: 0.1,
        max: 2.0,
        step: 0.05,
        groupe: 'Dimensions Shved',
      },
      {
        cle: 'afficherZoneShved',
        label: 'Afficher Rectangle Zone Shved',
        description: 'Affiche la boîte de la zone d\'offre ou de demande balayée',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Visuels & Graphique',
      },
      {
        cle: 'afficherZoneSweep',
        label: 'Afficher Boîte de Sweep',
        description: 'Affiche le rectangle semi-transparent sous/sur la zone',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Visuels & Graphique',
      },
      {
        cle: 'afficherLigneConnexion',
        label: 'Afficher Ligne Médiane de Zone',
        description: 'Trace la ligne pointillée horizontale au centre de la zone',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Visuels & Graphique',
      },
      {
        cle: 'toleranceDeficit',
        label: 'Tolérance en Retrait (En deçà d\'Open 1)',
        description: 'Marge maximale admise si la réintégration reste un peu courte (0.05 = 5%)',
        type: 'number',
        valeurParDefaut: 0.05,
        min: 0.01,
        max: 0.20,
        step: 0.01,
        groupe: 'Règles de Proximité Asymétrique',
      },
      {
        cle: 'toleranceDepassement',
        label: 'Tolérance en Dépassement Favorable',
        description: 'Marge élargie autorisée si la réintégration dépasse l\'ouverture (0.25 = 25%)',
        type: 'number',
        valeurParDefaut: 0.25,
        min: 0.05,
        max: 1.00,
        step: 0.05,
        groupe: 'Règles de Proximité Asymétrique',
      },
      {
        cle: 'activerFiltreTaille',
        label: 'Activer Filtre de Taille & Impulsion',
        description: 'Exige que les bougies dépassent la moyenne récente',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Filtres de Momentum',
      },
      {
        cle: 'multiplicateurBougie1',
        label: 'Multiplicateur Bougie 1 (Entière)',
        description: 'Taille minimale par rapport à la moyenne récente (défaut: 1.75x)',
        type: 'number',
        valeurParDefaut: 1.75,
        min: 1.0,
        max: 5.0,
        step: 0.05,
        groupe: 'Filtres de Momentum',
      },
      {
        cle: 'multiplicateurCorps2',
        label: 'Multiplicateur Bougie 2 (Corps Pur)',
        description: 'Taille minimale du corps par rapport à la moyenne des corps (défaut: 1.75x)',
        type: 'number',
        valeurParDefaut: 1.75,
        min: 1.0,
        max: 5.0,
        step: 0.05,
        groupe: 'Filtres de Momentum',
      },
      {
        cle: 'activerAchat',
        label: 'Activer Signaux d\'Achat (Long)',
        description: 'Affiche les sweeps de zones Demand (Support)',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Directions & Filtres',
      },
      {
        cle: 'activerVente',
        label: 'Activer Signaux de Vente (Short)',
        description: 'Affiche les sweeps de zones Supply (Résistance)',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Directions & Filtres',
      },
      {
        cle: 'bullColor',
        label: 'Couleur Signal Achat',
        description: 'Couleur de l\'étiquette et de la zone Demand',
        type: 'string',
        valeurParDefaut: '#00E676',
        groupe: 'Visuels & Graphique',
      },
      {
        cle: 'bearColor',
        label: 'Couleur Signal Vente',
        description: 'Couleur de l\'étiquette et de la zone Supply',
        type: 'string',
        valeurParDefaut: '#F23645',
        groupe: 'Visuels & Graphique',
      },
    ],
    creeLe: '2026-10-12T00:00:00.000Z',
    misAJourLe: '2026-10-12T00:00:00.000Z',
    code: `/**
 * Indicateur Scriptable : Liq/Reint + Sweep Shved Supply & Demand
 * Détecte le setup de réintégration et identifie la zone Shved balayée.
 */
return {
  calculer: function(contexte) {
    const { bougies, parametres } = contexte;
    if (!bougies || bougies.length < 10) return { donnees: {}, primitives: {} };

    const res = calculerLiquidationSweepShved(bougies, parametres);
    return {
      donnees: res,
      primitives: res.primitives,
      typeSpecial: 'liquidation-sweep-shved'
    };
  }
};`
  },
  {
    id: 'script-liq-sweep-chevauchement-extremes',
    nom: 'Liq/Reint + Sweep Chevauchement Extrêmes (Mèches)',
    description: 'Combine le setup Liquidation & Réintégration avec le chevauchement concentré sur les mèches extrêmes (Face Basse pour Spring, Face Haute pour UTAD). Trace un segment horizontal discontinu.',
    auteur: 'TradeLog Institutional',
    version: '1.0.0',
    type: 'overlay',
    actif: true,
    visibleSurGraphique: true,
    collecteActive: true,
    parametres: {
      lookbackBars: 50,
      minBougiesChevauchement: 2,
      exigerPalierIntact: true,
      exigerNiveauBalaye: true,
      toleranceDeficit: 0.05,
      toleranceDepassement: 0.25,
      activerFiltreTaille: true,
      periodeHistorique: 10,
      multiplicateurBougie1: 1.75,
      multiplicateurCorps2: 1.75,
      activerAchat: true,
      activerVente: true,
      afficherSegmentDiscontinue: true,
      bullColor: '#00E676',
      bearColor: '#F23645',
      texteLabel: 'Liq/Reint',
      activerFiltreTendance: false,
      trendBars: 5,
    },
    definitionsVariables: [
      {
        cle: 'lookbackBars',
        label: 'Historique des Mèches (Bougies)',
        description: 'Nombre de bougies antérieures scannées pour accumuler les mèches extrêmes',
        type: 'number',
        valeurParDefaut: 50,
        min: 10,
        max: 200,
        step: 5,
        groupe: 'Chevauchement des Extrêmes',
      },
      {
        cle: 'minBougiesChevauchement',
        label: 'Min Bougies de Chevauchement',
        description: 'Nombre minimum de mèches superposées sur le palier pour qualifier la liquidité',
        type: 'number',
        valeurParDefaut: 2,
        min: 1,
        max: 10,
        step: 1,
        groupe: 'Chevauchement des Extrêmes',
      },
      {
        cle: 'exigerPalierIntact',
        label: 'Exiger Palier Non Consommé (Unmitigated)',
        description: 'Exige qu\'aucune clôture antérieure ne soit passée au-delà du palier',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Chevauchement des Extrêmes',
      },
      {
        cle: 'exigerNiveauBalaye',
        label: 'Exiger Niveau Balayé',
        description: 'Filtre les signaux pour n\'afficher que ceux qui purgent une vraie zone extrême',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Chevauchement des Extrêmes',
      },
      {
        cle: 'afficherSegmentDiscontinue',
        label: 'Afficher Segment Discontinu',
        description: 'Trace le niveau de liquidité balayé sous forme de segment en ligne discontinue (dashed)',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Visuels & Graphique',
      },
      {
        cle: 'bullColor',
        label: 'Couleur Signal Achat',
        description: 'Couleur du Spring et du segment face basse',
        type: 'string',
        valeurParDefaut: '#00E676',
        groupe: 'Visuels & Graphique',
      },
      {
        cle: 'bearColor',
        label: 'Couleur Signal Vente',
        description: 'Couleur de l\'UTAD et du segment face haute',
        type: 'string',
        valeurParDefaut: '#F23645',
        groupe: 'Visuels & Graphique',
      },
    ],
    creeLe: '2026-10-14T00:00:00.000Z',
    misAJourLe: '2026-10-14T00:00:00.000Z',
    code: `return {
  calculer: function(contexte) {
    const { bougies, parametres } = contexte;
    if (!bougies || bougies.length < 5) return { donnees: {}, primitives: {} };

    const res = calculerLiquidationSweepChevauchementExtremes(bougies, parametres);
    return {
      donnees: res,
      primitives: res.primitives,
      typeSpecial: 'liquidation-sweep-chevauchement-extremes'
    };
  }
};`
  },
  {
    id: 'script-liq-sweep-chevauchement-vague-opposee',
    nom: 'Liq/Reint + Sweep Chevauchement Vague Opposée (ZigZag)',
    description: 'Analyse le profil de chevauchement de la vague ZigZag opposée antérieure (descente pour Spring, montée pour UTAD) et trace un segment en ligne discontinue sur le palier balayé.',
    auteur: 'TradeLog Institutional',
    version: '1.0.0',
    type: 'overlay',
    actif: true,
    visibleSurGraphique: true,
    collecteActive: true,
    parametres: {
      zigzagDepth: 4,
      zigzagDeviation: 0,
      zigzagBackstep: 2,
      lookbackBars: 100,
      minBougiesChevauchement: 2,
      exigerNiveauBalaye: true,
      toleranceDeficit: 0.05,
      toleranceDepassement: 0.25,
      activerFiltreTaille: true,
      periodeHistorique: 10,
      multiplicateurBougie1: 1.75,
      multiplicateurCorps2: 1.75,
      activerAchat: true,
      activerVente: true,
      afficherSegmentDiscontinue: true,
      bullColor: '#00E676',
      bearColor: '#F23645',
      texteLabel: 'Liq/Reint',
      activerFiltreTendance: false,
      trendBars: 5,
    },
    definitionsVariables: [
      {
        cle: 'zigzagDepth',
        label: 'Sensibilité Pivots ZigZag (Depth)',
        description: 'Nombre de barres d\'isolation pour valider les vagues',
        type: 'number',
        valeurParDefaut: 4,
        min: 2,
        max: 20,
        step: 1,
        groupe: 'Structure ZigZag Vague Opposée',
      },
      {
        cle: 'minBougiesChevauchement',
        label: 'Min Bougies de Chevauchement',
        description: 'Seuil minimal de trafic dans la vague opposée',
        type: 'number',
        valeurParDefaut: 2,
        min: 1,
        max: 10,
        step: 1,
        groupe: 'Structure ZigZag Vague Opposée',
      },
      {
        cle: 'exigerNiveauBalaye',
        label: 'Exiger Niveau Balayé',
        description: 'Exige que le palier de la vague opposée ait été balayé par la mèche extrême',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Structure ZigZag Vague Opposée',
      },
      {
        cle: 'afficherSegmentDiscontinue',
        label: 'Afficher Segment Discontinu',
        description: 'Trace le niveau de la vague balayé en ligne discontinue (dashed)',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Visuels & Graphique',
      },
      {
        cle: 'bullColor',
        label: 'Couleur Signal Achat',
        description: 'Couleur du Spring et du segment vague opposée',
        type: 'string',
        valeurParDefaut: '#00E676',
        groupe: 'Visuels & Graphique',
      },
      {
        cle: 'bearColor',
        label: 'Couleur Signal Vente',
        description: 'Couleur de l\'UTAD et du segment vague opposée',
        type: 'string',
        valeurParDefaut: '#F23645',
        groupe: 'Visuels & Graphique',
      },
    ],
    creeLe: '2026-10-14T00:00:00.000Z',
    misAJourLe: '2026-10-14T00:00:00.000Z',
    code: `return {
  calculer: function(contexte) {
    const { bougies, parametres } = contexte;
    if (!bougies || bougies.length < 5) return { donnees: {}, primitives: {} };

    const res = calculerLiquidationSweepChevauchementVagueOpposee(bougies, parametres);
    return {
      donnees: res,
      primitives: res.primitives,
      typeSpecial: 'liquidation-sweep-chevauchement-vague-opposee'
    };
  }
};`
  },
  {
    id: 'script-liq-sweep-chevauchement-multi-vagues',
    nom: 'Liq/Reint + Sweep Chevauchement Multi-Vagues (UOP)',
    description: 'Superpose les vagues ZigZag récentes et identifie la zone dense de chevauchement (bleu foncé) balayée par le pattern. Trace un segment en ligne discontinue.',
    auteur: 'TradeLog Institutional',
    version: '1.0.0',
    type: 'overlay',
    actif: true,
    visibleSurGraphique: true,
    collecteActive: true,
    parametres: {
      nbVaguesSuperposees: 4,
      zigzagDepth: 4,
      zigzagDeviation: 0,
      zigzagBackstep: 2,
      seuilBougiesBleuFonce: 3,
      lookbackBars: 150,
      exigerNiveauBalaye: true,
      toleranceDeficit: 0.05,
      toleranceDepassement: 0.25,
      activerFiltreTaille: true,
      periodeHistorique: 10,
      multiplicateurBougie1: 1.75,
      multiplicateurCorps2: 1.75,
      activerAchat: true,
      activerVente: true,
      afficherSegmentDiscontinue: true,
      bullColor: '#00E676',
      bearColor: '#F23645',
      texteLabel: 'Liq/Reint',
      activerFiltreTendance: false,
      trendBars: 5,
    },
    definitionsVariables: [
      {
        cle: 'nbVaguesSuperposees',
        label: 'Nombre de Vagues Superposées',
        description: 'Nombre de vagues ZigZag récentes superposées pour mesurer la concentration de liquidité',
        type: 'number',
        valeurParDefaut: 4,
        min: 1,
        max: 8,
        step: 1,
        groupe: 'Superposition Multi-Vagues UOP',
      },
      {
        cle: 'seuilBougiesBleuFonce',
        label: 'Seuil Zone Forte (Bougies)',
        description: 'Nombre minimum de bougies cumulées pour qualifier une zone dense de liquidité',
        type: 'number',
        valeurParDefaut: 3,
        min: 2,
        max: 10,
        step: 1,
        groupe: 'Superposition Multi-Vagues UOP',
      },
      {
        cle: 'exigerNiveauBalaye',
        label: 'Exiger Niveau Balayé',
        description: 'Exige qu\'une zone forte UOP ait été balayée par la mèche extrême',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Superposition Multi-Vagues UOP',
      },
      {
        cle: 'afficherSegmentDiscontinue',
        label: 'Afficher Segment Discontinu',
        description: 'Trace la zone UOP balayée sous forme de segment en ligne discontinue (dashed)',
        type: 'boolean',
        valeurParDefaut: true,
        groupe: 'Visuels & Graphique',
      },
      {
        cle: 'bullColor',
        label: 'Couleur Signal Achat',
        description: 'Couleur du Spring et du segment UOP',
        type: 'string',
        valeurParDefaut: '#00E676',
        groupe: 'Visuels & Graphique',
      },
      {
        cle: 'bearColor',
        label: 'Couleur Signal Vente',
        description: 'Couleur de l\'UTAD et du segment UOP',
        type: 'string',
        valeurParDefaut: '#F23645',
        groupe: 'Visuels & Graphique',
      },
    ],
    creeLe: '2026-10-14T00:00:00.000Z',
    misAJourLe: '2026-10-14T00:00:00.000Z',
    code: `return {
  calculer: function(contexte) {
    const { bougies, parametres } = contexte;
    if (!bougies || bougies.length < 5) return { donnees: {}, primitives: {} };

    const res = calculerLiquidationSweepChevauchementMultiVagues(bougies, parametres);
    return {
      donnees: res,
      primitives: res.primitives,
      typeSpecial: 'liquidation-sweep-chevauchement-multi-vagues'
    };
  }
};`
  }
];

/**
 * Génère automatiquement des définitions de variables externes visuelles
 * à partir d'un objet de paramètres brut, en déduisant intelligemment les types.
 * 
 * Exemple :
 * const defs = genererDefinitionsVariablesAutomatiques({ periode: 14, afficher: true });
 */
export function genererDefinitionsVariablesAutomatiques(
  parametres: Record<string, any>
): VariableExterneDef[] {
  if (!parametres || typeof parametres !== 'object') return [];

  return Object.entries(parametres).map(([cle, valeur]) => {
    // Formatage du nom affiché (camelCase ou snake_case -> Mots Séparés)
    const labelLisible = cle
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/^\w/, (c) => c.toUpperCase())
      .trim();

    if (typeof valeur === 'boolean') {
      return {
        cle,
        label: labelLisible,
        type: 'boolean' as const,
        valeurParDefaut: valeur,
        groupe: 'Options d\'Affichage',
      };
    }

    if (typeof valeur === 'number') {
      const estEntier = Number.isInteger(valeur);
      return {
        cle,
        label: labelLisible,
        type: 'number' as const,
        valeurParDefaut: valeur,
        min: valeur < 0 ? valeur * 2 : 0,
        max: valeur === 0 ? 100 : Math.max(valeur * 3, 50),
        step: estEntier ? 1 : 0.1,
        groupe: 'Paramètres Numériques',
      };
    }

    return {
      cle,
      label: labelLisible,
      type: 'string' as const,
      valeurParDefaut: String(valeur ?? ''),
      groupe: 'Paramètres Généraux',
    };
  });
}

/**
 * Nettoie et convertit un script TypeScript en JavaScript pur exécutable dans le bac à sable.
 * Retire les imports de modules, les interfaces, les exports et les annotations de types.
 * 
 * Exemple :
 * const codeJS = convertirScriptTypeScriptEnJavaScript(codeTS);
 */
export function convertirScriptTypeScriptEnJavaScript(codeTS: string): string {
  if (!codeTS) return '';

  let js = codeTS;

  // 1️⃣ Supprimer les déclarations d'imports (qui provoquent SyntaxError dans new Function)
  // Ex: import type { Bougie } from '@/lib/chartDataHelper';
  // Ex: import { calculerDetectionLiquidite } from './detectionLiquidite';
  js = js.replace(/import\s+(?:type\s+)?(?:{[^}]*}|[A-Za-z0-9_$\s*,]+)\s+from\s+['"][^'"]+['"];?/g, '');

  // 2️⃣ Supprimer les interfaces et alias de type TypeScript
  // Ex: export interface SignalSweepSpring { ... }
  js = js.replace(/(?:export\s+)?interface\s+[A-Za-z0-9_$]+\s*(?:<[^>]*>)?(?:\s+extends\s+[A-Za-z0-9_$,\s]+)?\s*\{[\s\S]*?\n\}/g, '');
  // Ex: export type Direction = 'achat' | 'vente';
  js = js.replace(/(?:export\s+)?type\s+[A-Za-z0-9_$]+\s*(?:<[^>]*>)?\s*=\s*[^;]+;/g, '');

  // 3️⃣ Supprimer les mots-clés d'export
  // Ex: export function foo() -> function foo()
  // Ex: export const bar = -> const bar =
  js = js.replace(/export\s+(?:default\s+)?(function|const|let|var|class)\b/g, '$1 ');
  js = js.replace(/export\s+\{[^}]*\};?/g, '');

  // 4️⃣ Nettoyer les casts TypeScript "as any", "as const", "as Type"
  js = js.replace(/\s+as\s+[A-Za-z0-9_$<>\[\]|&]+/g, '');

  // 5️⃣ Nettoyer les annotations de types simples de paramètres et retours
  js = js.replace(/:\s*(?:string|number|boolean|any|void|unknown|never|Bougie\[\]|IndicatorContext|IndicatorExecutionResult|Record<[^>]+>|Array<[^>]+>|{\s*[^}]*\})\b/g, '');

  // 6️⃣ Si le fichier TypeScript est un module complet contenant `calculerSweepSpringValidation`
  // ou `calculerDetectionLiquidite` mais sans bloc `return { calculer: ... }`,
  // l'envelopper automatiquement pour créer un indicateur immédiatement exécutable :
  if (!js.includes('return {') && !js.includes('return{')) {
    if (js.includes('calculerUnmitigatedVolumeProfile')) {
      js += `\n\n// Enveloppe automatique générée pour le sandbox\nreturn {\n  calculer: function(contexte) {\n    return calculerUnmitigatedVolumeProfile(contexte.bougies, contexte.parametres);\n  }\n};\n`;
    } else if (js.includes('calculerUnmitigatedOverlapProfile')) {
      js += `\n\n// Enveloppe automatique générée pour le sandbox\nreturn {\n  calculer: function(contexte) {\n    return calculerUnmitigatedOverlapProfile(contexte.bougies, contexte.parametres);\n  }\n};\n`;
    } else if (js.includes('calculerCompleteSetupVisualizer')) {
      js += `\n\n// Enveloppe automatique générée pour le sandbox\nreturn {\n  calculer: function(contexte) {\n    return calculerCompleteSetupVisualizer(contexte.bougies, contexte.parametres);\n  }\n};\n`;
    } else if (js.includes('calculerMtfConductor')) {
      js += `\n\n// Enveloppe automatique générée pour le sandbox\nreturn {\n  calculer: function(contexte) {\n    return calculerMtfConductor(contexte.bougies, contexte.parametres);\n  }\n};\n`;
    } else if (js.includes('calculerMoneyManagementRules')) {
      js += `\n\n// Enveloppe automatique générée pour le sandbox\nreturn {\n  calculer: function(contexte) {\n    return calculerMoneyManagementRules(contexte.bougies, contexte.parametres);\n  }\n};\n`;
    } else if (js.includes('calculerFractalLtfEntry')) {
      js += `\n\n// Enveloppe automatique générée pour le sandbox\nreturn {\n  calculer: function(contexte) {\n    return calculerFractalLtfEntry(contexte.bougies, contexte.parametres);\n  }\n};\n`;
    } else if (js.includes('calculerSweepSpringValidation')) {
      js += `\n\n// Enveloppe automatique générée pour le sandbox\nreturn {\n  calculer: function(contexte) {\n    return calculerSweepSpringValidation(contexte.bougies, contexte.parametres);\n  }\n};\n`;
    } else if (js.includes('calculerWyckoffPointAndFigure')) {
      js += `\n\n// Enveloppe automatique générée pour le sandbox\nreturn {\n  calculer: function(contexte) {\n    return calculerWyckoffPointAndFigure(contexte.bougies, contexte.parametres);\n  }\n};\n`;
    } else if (js.includes('calculerFractalZigZag')) {
      js += `\n\n// Enveloppe automatique générée pour le sandbox\nreturn {\n  calculer: function(contexte) {\n    return calculerFractalZigZag(contexte.bougies, contexte.parametres);\n  }\n};\n`;
    } else if (js.includes('calculerCandlestickPatterns')) {
      js += `\n\n// Enveloppe automatique générée pour le sandbox\nreturn {\n  calculer: function(contexte) {\n    return calculerCandlestickPatterns(contexte.bougies, contexte.parametres);\n  }\n};\n`;
    } else if (js.includes('calculerLiquidationSweepPointFigure')) {
      js += `\n\n// Enveloppe automatique générée pour le sandbox\nreturn {\n  calculer: function(contexte) {\n    return calculerLiquidationSweepPointFigure(contexte.bougies, contexte.parametres);\n  }\n};\n`;
    } else if (js.includes('calculerLiquidationSweepShved')) {
      js += `\n\n// Enveloppe automatique générée pour le sandbox\nreturn {\n  calculer: function(contexte) {\n    return calculerLiquidationSweepShved(contexte.bougies, contexte.parametres);\n  }\n};\n`;
    } else if (js.includes('calculerLiquidationSweepChevauchementExtremes')) {
      js += `\n\n// Enveloppe automatique générée pour le sandbox\nreturn {\n  calculer: function(contexte) {\n    return calculerLiquidationSweepChevauchementExtremes(contexte.bougies, contexte.parametres);\n  }\n};\n`;
    } else if (js.includes('calculerLiquidationSweepChevauchementVagueOpposee')) {
      js += `\n\n// Enveloppe automatique générée pour le sandbox\nreturn {\n  calculer: function(contexte) {\n    return calculerLiquidationSweepChevauchementVagueOpposee(contexte.bougies, contexte.parametres);\n  }\n};\n`;
    } else if (js.includes('calculerLiquidationSweepChevauchementMultiVagues')) {
      js += `\n\n// Enveloppe automatique générée pour le sandbox\nreturn {\n  calculer: function(contexte) {\n    return calculerLiquidationSweepChevauchementMultiVagues(contexte.bougies, contexte.parametres);\n  }\n};\n`;
    } else if (js.includes('calculerLiquidationSweepCombo')) {
      js += `\n\n// Enveloppe automatique générée pour le sandbox\nreturn {\n  calculer: function(contexte) {\n    return calculerLiquidationSweepCombo(contexte.bougies, contexte.parametres);\n  }\n};\n`;
    } else if (js.includes('calculerLiquidationReintegration')) {
      js += `\n\n// Enveloppe automatique générée pour le sandbox\nreturn {\n  calculer: function(contexte) {\n    return calculerLiquidationReintegration(contexte.bougies, contexte.parametres);\n  }\n};\n`;
    } else if (js.includes('calculerDetectionLiquiditeSRTL')) {
      js += `\n\n// Enveloppe automatique générée pour le sandbox\nreturn {\n  calculer: function(contexte) {\n    return calculerDetectionLiquiditeSRTL(contexte.bougies, contexte.parametres);\n  }\n};\n`;
    } else if (js.includes('calculerDetectionLiquiditeEQ')) {
      js += `\n\n// Enveloppe automatique générée pour le sandbox\nreturn {\n  calculer: function(contexte) {\n    return calculerDetectionLiquiditeEQ(contexte.bougies, contexte.parametres);\n  }\n};\n`;
    } else if (js.includes('calculerDetectionLiquidite')) {
      js += `\n\n// Enveloppe automatique générée pour le sandbox\nreturn {\n  calculer: function(contexte) {\n    return calculerDetectionLiquidite(contexte.bougies, contexte.parametres);\n  }\n};\n`;
    } else if (/function\s+calculer\s*\(/.test(js)) {
      js += `\n\n// Enveloppe automatique générée pour le sandbox\nreturn {\n  calculer: calculer\n};\n`;
    }
  }

  return js.trim();
}

/**
 * Récupère la liste de tous les indicateurs scriptables enregistrés sur le smartphone.
 * Si aucun script n'est encore enregistré, initialise avec les indicateurs par défaut.
 * Assure que chaque script dispose de définitions de variables externes visuelles.
 * Synchronise automatiquement les nouveaux indicateurs officiels s'ils manquent.
 * 
 * Exemple :
 * const mesIndicateurs = recupererIndicateursStockes();
 */
export function recupererIndicateursStockes(): IndicatorScript[] {
  try {
    const jsonStocke = localStorage.getItem(CLE_STORAGE_INDICATEURS);
    let scripts: IndicatorScript[] = [];

    if (!jsonStocke) {
      localStorage.setItem(CLE_STORAGE_INDICATEURS, JSON.stringify(INDICATEURS_PAR_DEFAUT));
      localStorage.setItem(CLE_STORAGE_VERSION_INDICATEURS, VERSION_CATALOGUE_INDICATEURS);
      scripts = INDICATEURS_PAR_DEFAUT;
    } else {
      const parsed = JSON.parse(jsonStocke) as IndicatorScript[];
      scripts = Array.isArray(parsed) && parsed.length > 0 ? parsed : INDICATEURS_PAR_DEFAUT;

      const versionEnregistree = localStorage.getItem(CLE_STORAGE_VERSION_INDICATEURS);
      const supprimesRaw = localStorage.getItem(CLE_STORAGE_INDICATEURS_SUPPRIMES);
      const supprimesList: string[] = supprimesRaw ? JSON.parse(supprimesRaw) : [];
      const setSupprimes = new Set(supprimesList);

      const idsExistants = new Set(scripts.map((s) => s.id));
      let aModifie = false;

      // 🚀 Ajout automatique immédiat de tout nouvel indicateur officiel (ex: Liq/Reint + Sweep)
      // s'il manque dans la liste et n'a pas été explicitement supprimé par l'utilisateur
      for (const indDefaut of INDICATEURS_PAR_DEFAUT) {
        if (!idsExistants.has(indDefaut.id) && !setSupprimes.has(indDefaut.id)) {
          scripts.push(indDefaut);
          idsExistants.add(indDefaut.id);
          aModifie = true;
          console.log(`✨ [IndicatorEngine] Nouvel indicateur officiel injecté automatiquement : ${indDefaut.nom}`);
        }
      }

      // 🚀 Migration des mises à jour lors d'une montée de version du catalogue
      if (versionEnregistree !== VERSION_CATALOGUE_INDICATEURS) {
        for (const indDefaut of INDICATEURS_PAR_DEFAUT) {
          if (indDefaut.id.startsWith('script-') && !setSupprimes.has(indDefaut.id)) {
            const idx = scripts.findIndex((s) => s.id === indDefaut.id);
            if (idx !== -1) {
              scripts[idx] = {
                ...indDefaut,
                visibleSurGraphique: scripts[idx].visibleSurGraphique !== undefined ? scripts[idx].visibleSurGraphique : indDefaut.visibleSurGraphique,
                parametres: { ...indDefaut.parametres, ...scripts[idx].parametres },
              };
              aModifie = true;
            }
          }
        }
        localStorage.setItem(CLE_STORAGE_VERSION_INDICATEURS, VERSION_CATALOGUE_INDICATEURS);
      }

      if (aModifie) {
        localStorage.setItem(CLE_STORAGE_INDICATEURS, JSON.stringify(scripts));
        console.log('🔄 [IndicatorEngine] Stockage local des indicateurs synchronisé.');
      }
    }

    // 🔄 Migration à la volée et nettoyage automatique pour garantir que les définitions officielles
    // sont toujours parfaitement à jour (notamment la proximité asymétrique : toleranceDeficit et toleranceDepassement)
    let aModifieAuVol = false;
    const scriptsAjustes = scripts.map((s) => {
      const officiel = INDICATEURS_PAR_DEFAUT.find((def) => def.id === s.id);
      if (officiel) {
        const paramsMigres = { ...officiel.parametres, ...(s.parametres || {}) };
        if (paramsMigres.toleranceProximite !== undefined) {
          if (paramsMigres.toleranceDeficit === undefined) {
            paramsMigres.toleranceDeficit = paramsMigres.toleranceProximite;
          }
          if (paramsMigres.toleranceDepassement === undefined) {
            paramsMigres.toleranceDepassement = 0.25;
          }
          delete paramsMigres.toleranceProximite;
          aModifieAuVol = true;
        }

        return {
          ...s,
          nom: officiel.nom,
          description: officiel.description,
          code: officiel.code,
          definitionsVariables: officiel.definitionsVariables,
          parametres: paramsMigres,
        };
      }

      // Si c'est un indicateur importé ou personnalisé de Combo Sweep Liquidité
      if (s.id.includes('combo') || s.nom.toLowerCase().includes('combo') || s.nom.toLowerCase().includes('sweep')) {
        const officielCombo = INDICATEURS_PAR_DEFAUT.find((def) => def.id === 'script-liquidation-sweep-combo');
        if (officielCombo?.definitionsVariables) {
          return {
            ...s,
            definitionsVariables: officielCombo.definitionsVariables,
            parametres: { ...officielCombo.parametres, ...(s.parametres || {}) },
          };
        }
      }

      // Si c'est un indicateur importé ou personnalisé de Liquidation & Réintégration
      if (s.id.includes('liquidation') || s.nom.toLowerCase().includes('liquidation')) {
        const officielLiq = INDICATEURS_PAR_DEFAUT.find((def) => def.id === 'script-liquidation-reintegration');
        if (officielLiq?.definitionsVariables) {
          const paramsMigres = { ...officielLiq.parametres, ...(s.parametres || {}) };
          if (paramsMigres.toleranceProximite !== undefined) {
            if (paramsMigres.toleranceDeficit === undefined) {
              paramsMigres.toleranceDeficit = paramsMigres.toleranceProximite;
            }
            if (paramsMigres.toleranceDepassement === undefined) {
              paramsMigres.toleranceDepassement = 0.25;
            }
            delete paramsMigres.toleranceProximite;
            aModifieAuVol = true;
          }
          return {
            ...s,
            definitionsVariables: officielLiq.definitionsVariables,
            parametres: paramsMigres,
          };
        }
      }

      if (s.definitionsVariables && s.definitionsVariables.length > 0) {
        return s;
      }
      return {
        ...s,
        definitionsVariables: genererDefinitionsVariablesAutomatiques(s.parametres || {}),
      };
    });

    if (aModifieAuVol) {
      localStorage.setItem(CLE_STORAGE_INDICATEURS, JSON.stringify(scriptsAjustes));
    }
    return scriptsAjustes;
  } catch (err) {
    console.warn('⚠️ [IndicatorEngine] Impossible de lire les indicateurs du stockage local:', err);
    return INDICATEURS_PAR_DEFAUT;
  }
}

/**
 * Sauvegarde ou met à jour un indicateur scriptable.
 * 
 * Exemple :
 * sauvegarderIndicateurStocke(monIndicateur);
 */
export function sauvegarderIndicateurStocke(indicateur: IndicatorScript): void {
  try {
    const scripts = recupererIndicateursStockes();
    const indexExistant = scripts.findIndex(s => s.id === indicateur.id);
    const scriptAJour = {
      ...indicateur,
      misAJourLe: new Date().toISOString(),
    };

    if (indexExistant >= 0) {
      scripts[indexExistant] = scriptAJour;
    } else {
      scripts.push(scriptAJour);
    }

    localStorage.setItem(CLE_STORAGE_INDICATEURS, JSON.stringify(scripts));
    console.log(`✅ [IndicatorEngine] Indicateur "${indicateur.nom}" sauvegardé avec succès.`);
  } catch (err) {
    console.error('❌ [IndicatorEngine] Erreur lors de la sauvegarde de l\'indicateur:', err);
  }
}

/**
 * Supprime un indicateur personnalisé.
 */
export function supprimerIndicateurStocke(idIndicateur: string): void {
  try {
    const scripts = recupererIndicateursStockes();
    const filtres = scripts.filter(s => s.id !== idIndicateur);
    localStorage.setItem(CLE_STORAGE_INDICATEURS, JSON.stringify(filtres));

    // Mémorise la suppression pour ne pas le réinjecter automatiquement au redémarrage
    const supprimesRaw = localStorage.getItem(CLE_STORAGE_INDICATEURS_SUPPRIMES);
    const supprimesList: string[] = supprimesRaw ? JSON.parse(supprimesRaw) : [];
    if (!supprimesList.includes(idIndicateur)) {
      supprimesList.push(idIndicateur);
      localStorage.setItem(CLE_STORAGE_INDICATEURS_SUPPRIMES, JSON.stringify(supprimesList));
    }

    console.log(`🗑️ [IndicatorEngine] Indicateur "${idIndicateur}" supprimé.`);
  } catch (err) {
    console.error('❌ [IndicatorEngine] Erreur lors de la suppression de l\'indicateur:', err);
  }
}

/**
 * Réinitialise tous les indicateurs aux versions officielles par défaut.
 */
export function reinitialiserIndicateursParDefaut(): IndicatorScript[] {
  try {
    localStorage.removeItem(CLE_STORAGE_INDICATEURS_SUPPRIMES);
    localStorage.setItem(CLE_STORAGE_INDICATEURS, JSON.stringify(INDICATEURS_PAR_DEFAUT));
    localStorage.setItem(CLE_STORAGE_VERSION_INDICATEURS, VERSION_CATALOGUE_INDICATEURS);
    console.log('🔄 [IndicatorEngine] Indicateurs réinitialisés aux valeurs d\'origine.');
    return INDICATEURS_PAR_DEFAUT;
  } catch (err) {
    console.error('❌ [IndicatorEngine] Erreur de réinitialisation:', err);
    return INDICATEURS_PAR_DEFAUT;
  }
}

// ─── 🚀 Cache de Compilation V8 des Scripts d'Indicateurs ──────────────────────
// Évite de réinstancier new Function() à chaque nouvelle bougie.
// Accélère l'exécution d'un facteur 5x à 10x lors du replay et du backtest.
const cacheFonctionsScripts = new Map<string, Function>();

function recupererConstructeurScript(codeScript: string): Function {
  let fn = cacheFonctionsScripts.get(codeScript);
  if (!fn) {
    fn = new Function(
      'contexte',
      'calculerLuxAlgoSMC',
      'calculerProtectedSwings',
      'calculerZigZag',
      'calculerUnmitigatedVolumeProfile',
      'calculerDetectionLiquidite',
      'calculerSweepSpringValidation',
      'calculerDetectionLiquiditeEQ',
      'calculerDetectionLiquiditeSRTL',
      'calculerShvedSupplyDemand',
      'calculerOverMitigationHighway',
      'calculerMethodeACompression',
      'calculerMethodeBOverlap',
      'calculerMethodeCSlice',
      'calculerUnmitigatedOverlapProfile',
      'calculerFractalLtfEntry',
      'calculerMoneyManagementRules',
      'calculerMtfConductor',
      'calculerCompleteSetupVisualizer',
      'calculerWyckoffPointAndFigure',
      'calculerFractalZigZag',
      'calculerCandlestickPatterns',
      'calculerLiquidationReintegration',
      'calculerLiquidationSweepCombo',
      'calculerLiquidationSweepPointFigure',
      'calculerLiquidationSweepShved',
      'calculerLiquidationSweepChevauchementExtremes',
      'calculerLiquidationSweepChevauchementVagueOpposee',
      'calculerLiquidationSweepChevauchementMultiVagues',
      codeScript
    );
    cacheFonctionsScripts.set(codeScript, fn);
  }
  return fn;
}

/**
 * Évalue un script d'indicateur dans un bac à sable (sandbox) isolé.
 * Utilise le cache de compilation V8 pour des performances optimales.
 * 
 * Exemple :
 * const resultat = evaluerIndicateurScript(script.code, { bougies: bougiesM1, parametres: script.parametres });
 */
export function evaluerIndicateurScript(
  codeScript: string,
  contexte: IndicatorContext
): IndicatorExecutionResult | null {
  try {
    // 1️⃣ Récupération de la fonction dynamique depuis le cache haute performance
    const constructeurFn = recupererConstructeurScript(codeScript);

    const instance = constructeurFn(
      contexte,
      calculerLuxAlgoSMC,
      calculerProtectedSwings,
      calculerZigZag,
      calculerUnmitigatedVolumeProfile,
      calculerDetectionLiquidite,
      calculerSweepSpringValidation,
      calculerDetectionLiquiditeEQ,
      calculerDetectionLiquiditeSRTL,
      calculerShvedSupplyDemand,
      calculerOverMitigationHighway,
      calculerMethodeACompression,
      calculerMethodeBOverlap,
      calculerMethodeCSlice,
      calculerUnmitigatedOverlapProfile,
      calculerFractalLtfEntry,
      calculerMoneyManagementRules,
      calculerMtfConductor,
      calculerCompleteSetupVisualizer,
      calculerWyckoffPointAndFigure,
      calculerFractalZigZag,
      calculerCandlestickPatterns,
      calculerLiquidationReintegration,
      calculerLiquidationSweepCombo,
      calculerLiquidationSweepPointFigure,
      calculerLiquidationSweepShved,
      calculerLiquidationSweepChevauchementExtremes,
      calculerLiquidationSweepChevauchementVagueOpposee,
      calculerLiquidationSweepChevauchementMultiVagues
    );

    // 2️⃣ Si le script expose une méthode calculer()
    if (instance && typeof instance.calculer === 'function') {
      const res = instance.calculer(contexte);
      return validerResultatIndicateur(res);
    }

    // 3️⃣ Si le script retourne directement le résultat
    if (instance && typeof instance === 'object') {
      return validerResultatIndicateur(instance);
    }

    return null;
  } catch (erreur: any) {
    console.warn(`⚠️ [IndicatorEngine] Erreur d'exécution de l'indicateur :`, erreur.message);
    return null;
  }
}

/**
 * Valide et sécurise l'objet retourné par l'indicateur.
 */
function validerResultatIndicateur(res: any): IndicatorExecutionResult {
  if (!res || typeof res !== 'object') {
    return { donnees: {}, primitives: {} };
  }

  const primitives: VisualPrimitives = {
    boites: Array.isArray(res.primitives?.boites) ? res.primitives.boites : [],
    lignes: Array.isArray(res.primitives?.lignes) ? res.primitives.lignes : [],
    labels: Array.isArray(res.primitives?.labels) ? res.primitives.labels : [],
    courbes: Array.isArray(res.primitives?.courbes) ? res.primitives.courbes : [],
  };

  return {
    donnees: res.donnees && typeof res.donnees === 'object' ? res.donnees : {},
    primitives: primitives,
    typeSpecial: res.typeSpecial,
  };
}
