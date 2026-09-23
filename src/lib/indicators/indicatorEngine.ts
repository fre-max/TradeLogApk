import type { IndicatorScript, IndicatorContext, IndicatorExecutionResult, VisualPrimitives, VariableExterneDef } from '@/types/indicatorScript';
import { calculerLuxAlgoSMC } from './luxAlgoSMC';
import { calculerProtectedSwings } from './protectedSwings';
import { calculerZigZag } from './zigzag';
import { calculerUnmitigatedVolumeProfile } from './unmitigatedVolumeProfile';
import { calculerDetectionLiquidite } from './detectionLiquidite';
import { calculerSweepSpringValidation } from './sweepSpringValidation';
import { calculerDetectionLiquiditeEQ } from './detectionLiquiditeEQ';
import { calculerDetectionLiquiditeSRTL } from './detectionLiquiditeSRTL';

// Clé de stockage local pour persister les indicateurs personnalisés sur le smartphone
const CLE_STORAGE_INDICATEURS = 'tradelog_indicator_scripts_v2';
const CLE_STORAGE_VERSION_INDICATEURS = 'tradelog_indicators_catalogue_version';
const VERSION_CATALOGUE_INDICATEURS = '2.4.0';

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
    nom: 'Sweep / Spring Wyckoff Validator',
    description: 'Valide les prises de liquidité (Sweep/Spring) avec règle de proportionnalité temporelle et confirmation par bougies de consolidation. Signaux achat (Spring) et vente (UTAD).',
    auteur: 'Wyckoff Bot / TradeLog',
    version: '1.0.0',
    type: 'overlay',
    actif: true,
    visibleSurGraphique: false,
    collecteActive: true,
    parametres: {
      sensibilitePivot: 5,
      maxLookbackBars: 1000,
      ratioMaxTemps: 0.10,
      nbBougiesConsolidation: 3,
      activerSpringSSL: true,
      activerUTADBSL: true,
    },
    definitionsVariables: [
      {
        cle: 'sensibilitePivot',
        label: 'Sensibilité des Pivots (Module Liquidité)',
        description: 'Nombre de bougies pour valider un pivot du module de détection de liquidité',
        type: 'number',
        valeurParDefaut: 5,
        min: 2,
        max: 20,
        step: 1,
        groupe: 'Connexion au Module Liquidité',
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
        groupe: 'Connexion au Module Liquidité',
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
    misAJourLe: '2026-09-23T00:00:00.000Z',
    code: `/**
 * Indicateur Scriptable : Sweep / Spring Wyckoff Validator
 * Valide les prises de liquidité avec ratio temporel et confirmation
 */
return {
  calculer: function(contexte) {
    const { bougies, parametres } = contexte;
    if (!bougies || bougies.length < 50) return { donnees: {}, primitives: {} };

    const resultat = calculerSweepSpringValidation(bougies, {
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
    if (js.includes('calculerSweepSpringValidation')) {
      js += `\n\n// Enveloppe automatique générée pour le sandbox\nreturn {\n  calculer: function(contexte) {\n    return calculerSweepSpringValidation(contexte.bougies, contexte.parametres);\n  }\n};\n`;
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

      // 🚀 Migration des nouveaux indicateurs officiels (ex: script-detection-liquidite et script-sweep-spring-validation)
      // Exécutée une seule fois lors de la montée de version pour ne jamais réintroduire un indicateur supprimé par l'utilisateur
      const versionEnregistree = localStorage.getItem(CLE_STORAGE_VERSION_INDICATEURS);
      if (versionEnregistree !== VERSION_CATALOGUE_INDICATEURS) {
        const idsExistants = new Set(scripts.map((s) => s.id));
        let aModifie = false;
        for (const indDefaut of INDICATEURS_PAR_DEFAUT) {
          if (!idsExistants.has(indDefaut.id)) {
            scripts.push(indDefaut);
            aModifie = true;
          }
        }
        localStorage.setItem(CLE_STORAGE_VERSION_INDICATEURS, VERSION_CATALOGUE_INDICATEURS);
        if (aModifie) {
          localStorage.setItem(CLE_STORAGE_INDICATEURS, JSON.stringify(scripts));
          console.log('🔄 [IndicatorEngine] Nouveaux indicateurs officiels synchronisés dans le stockage local.');
        }
      }
    }

    // Enrichit chaque indicateur avec ses definitionsVariables si absentes
    return scripts.map((s) => {
      if (s.definitionsVariables && s.definitionsVariables.length > 0) {
        return s;
      }
      const officiel = INDICATEURS_PAR_DEFAUT.find((def) => def.id === s.id);
      if (officiel?.definitionsVariables) {
        return { ...s, definitionsVariables: officiel.definitionsVariables };
      }
      return {
        ...s,
        definitionsVariables: genererDefinitionsVariablesAutomatiques(s.parametres || {}),
      };
    });
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
    localStorage.setItem(CLE_STORAGE_INDICATEURS, JSON.stringify(INDICATEURS_PAR_DEFAUT));
    localStorage.setItem(CLE_STORAGE_VERSION_INDICATEURS, VERSION_CATALOGUE_INDICATEURS);
    console.log('🔄 [IndicatorEngine] Indicateurs réinitialisés aux valeurs d\'origine.');
    return INDICATEURS_PAR_DEFAUT;
  } catch (err) {
    console.error('❌ [IndicatorEngine] Erreur de réinitialisation:', err);
    return INDICATEURS_PAR_DEFAUT;
  }
}

/**
 * Évalue un script d'indicateur dans un bac à sable (sandbox) isolé.
 * 
 * Exemple :
 * const resultat = evaluerIndicateurScript(script.code, { bougies: bougiesM1, parametres: script.parametres });
 */
export function evaluerIndicateurScript(
  codeScript: string,
  contexte: IndicatorContext
): IndicatorExecutionResult | null {
  try {
    // 1️⃣ Isolation et création de la fonction dynamique
    // On transmet au script l'accès aux fonctions de calcul pour les indicateurs officiels
    const constructeurFn = new Function(
      'contexte',
      'calculerLuxAlgoSMC',
      'calculerProtectedSwings',
      'calculerZigZag',
      'calculerUnmitigatedVolumeProfile',
      'calculerDetectionLiquidite',
      'calculerSweepSpringValidation',
      'calculerDetectionLiquiditeEQ',
      'calculerDetectionLiquiditeSRTL',
      codeScript
    );

    const instance = constructeurFn(
      contexte,
      calculerLuxAlgoSMC,
      calculerProtectedSwings,
      calculerZigZag,
      calculerUnmitigatedVolumeProfile,
      calculerDetectionLiquidite,
      calculerSweepSpringValidation,
      calculerDetectionLiquiditeEQ,
      calculerDetectionLiquiditeSRTL
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
