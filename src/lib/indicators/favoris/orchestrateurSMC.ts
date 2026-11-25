import { agregerBougies, type Bougie } from '@/lib/chartDataHelper';
import type { VisualPrimitives, VisualLabel, VisualLine, VisualBox, VisualPoint } from '@/types/indicatorScript';
import {
  detecterDojisAvecPlage,
  evaluerNiveauxShvedDansPlage,
  convertirTempsEnMs,
  analyserRetestsAvecCollines,
  type SignalDojiAvecPlage,
  type ZoneShvedAvecScore,
  type DetailCollineRetest,
  type DetailToucheIgnoree,
} from './sandboxDojiShvedPlage';

export { analyserRetestsAvecCollines };
export type { ZoneShvedAvecScore, DetailCollineRetest, DetailToucheIgnoree };
import {
  calculerShvedSupplyDemand,
  type ZoneShved,
} from '@/lib/bot/modules/01_liquidite/shvedSupplyDemand';
import {
  calculerUnmitigatedOverlapProfile,
  type ResultatUOP,
  type TPOptimalUOP,
  type PalierSuperpositionVagues,
  type VagueOverlapProfile,
} from './unmitigatedOverlapProfile';

/**
 * ==============================================================================
 * 🎼 CHEF D'ORCHESTRE STRATÉGIQUE SMC (SMART MONEY CONCEPTS)
 * ==============================================================================
 * Cet indicateur est le CENTRE DE COMMANDEMENT de toute notre stratégie de trading.
 * Son rôle n'est pas de tout recalculer de zéro, mais d'ORCHESTRER intelligemment
 * nos indicateurs favoris spécialisés, de filtrer les faux signaux et de piloter
 * la décision finale d'entrée, de sortie et de tracé visuel sur le graphique.
 * 
 * ------------------------------------------------------------------------------
 * 🧭 TABLE DES MATIÈRES DE CE REGISTRE DOCUMENTAIRE :
 * ------------------------------------------------------------------------------
 * 1️⃣ VUE GLOBALE : CE QUE FAIT CHAQUE INDICATEUR SPÉCIALISÉ
 * 2️⃣ FLUX D'ÉCHANGE DE DONNÉES (QUI ENVOIE QUOI À QUI ?)
 * 3️⃣ CHRONOLOGIE COMPLÈTE POUR OBTENIR UN SETUP VALIDE
 * 4️⃣ 📋 REGISTRE EXHAUSTIF DES CONDITIONS & PARAMÈTRES RÉGLABLES
 *     -> Pour tout ajustement futur, il suffit de désigner le code [COND-XX] !
 * 5️⃣ RENDU VISUEL ÉPURÉ & RÈGLE DE MASQUAGE DES SETUPS PASSÉS
 * 6️⃣ 🚀 NOUVEAU MODÈLE AVANCÉ : MOTEUR D'ÉNERGIE (CARBURANT INITIAL VS FRICTION OVERLAP UOP)
 * 7️⃣ INTÉGRATION FUTURE DU MONEY MANAGEMENT DYNAMIQUE
 * ==============================================================================
 * 
 * 
 * ──────────────────────────────────────────────────────────────────────────────
 * 1️⃣ VUE GLOBALE : CE QUE FAIT CHAQUE INDICATEUR SPÉCIALISÉ
 * ──────────────────────────────────────────────────────────────────────────────
 * 
 * 🔹 A. SANDBOX BLOC 1 : DÉTECTION DU DOJI PERSONNALISÉ & PLAGE CIBLÉE
 *    • Fichier source : `sandboxDojiShvedPlage.ts` (Fonction: detecterDojisAvecPlage)
 *    • Rôle : C'est le DÉCLENCHEUR INITIAL du marché (l'étincelle).
 *      Il repère les manipulations institutionnelles de fausse cassure :
 *      - À l'ACHAT (Spring de Wyckoff) : Une bougie 1 plonge pour liquider les stops
 *        vendeurs/acheteurs, puis la bougie 2 réintègre immédiatement vers le haut.
 *      - À la VENTE (UTAD de Wyckoff) : Une bougie 1 explose à la hausse pour balayer
 *        la liquidité, puis la bougie 2 réintègre violemment vers le bas.
 *      - Il identifie également le point extrême opposé antérieur pour délimiter la
 *        "Plage Temporelle Ciblée" [Début de la plage ➔ Moment du Doji].
 * 
 * 🔹 B. SANDBOX BLOC 2 : MOTEUR S/R SHVED & SCORE DE LIQUIDITÉ (SUR 100 PTS)
 *    • Fichier source : `shvedSupplyDemand.ts` + `sandboxDojiShvedPlage.ts` (Fonction: evaluerNiveauxShvedDansPlage)
 *    • Rôle : C'est le FILTRE DE QUALITÉ INSTITUTIONNELLE.
 *      Il isole les zones de Support / Résistance Shved formées en multi-timeframe (ex: M15) :
 *      - Épuration par direction : Ne conserve QUE les Supports pour un Achat, et QUE les
 *        Résistances pour une Vente.
 *      - Épuration temporelle : Ne garde QUE les zones nées et terminées strictement à l'intérieur
 *        de la plage temporelle ciblée.
 *      - Calcule un Score sur 100 points mesurant la robustesse de la liquidité balayée
 *        (Retests passés, hauteur du rejet/montagne, proportionnalité, intégrité).
 * 
 * 🔹 C. RANGE DE CONFIRMATION (3 BOUGIES CONSÉCUTIVES)
 *    • Fichier source : `orchestrateurSMC.ts` (Intégré nativement dans la boucle de décision)
 *    • Rôle : C'est le FILTRE ANTI-FAUSSE SORTIE & CONFIRMATION DE MARCHÉ.
 *      Le niveau de Stop Loss (SL) est fixé au plus bas (Achat) ou plus haut (Vente) de la mèche du Doji.
 *      On observe impérativement les 3 bougies suivant le Doji :
 *      - Si une seule bougie brise le SL ➔ Le setup est immédiatement ANNULÉ.
 *      - Si les 3 bougies consécutives tiennent au-dessus du SL (Achat) ou en-dessous (Vente) ➔ Le setup est CONFIRMÉ !
 * 
 * 🔹 D. PROFIL DE CHEVAUCHEMENT NON-MITIGÉ (UOP - UNMITIGATED OVERLAP PROFILE)
 *    • Fichier source : `unmitigatedOverlapProfile.ts` (Fonction: calculerUnmitigatedOverlapProfile)
 *    • Rôle : C'est le FOURNISSEUR DU TAKE PROFIT (TP) OPTIMAL.
 *      Au lieu de se baser sur de faux volumes, il calcule le taux de chevauchement horizontal
 *      des vagues ZigZag et extrait les paliers de prix vierges (non-mitigés) où le marché
 *      doit mathématiquement retourner combler le vide institutionnel.
 *      Il fournit ainsi une série de cibles ordonnées : TP1 (conservateur), TP2 (étendu), TP3...
 * 
 * 🔹 E. MONEY MANAGEMENT DYNAMIQUE (PRÊT POUR CONNEXION ULTÉRIEURE)
 *    • Fichier source : `moneyManagementDynamique.ts`
 *    • Rôle : C'est le PILOTE DU CAPITAL ET DU RISQUE FINANCIER.
 *      - Filtrera les trades dont le ratio R:R est inférieur au seuil minimal (ex: 2.5R).
 *      - Calculera la taille exacte de lot en fonction du capital et du % de risque (ex: 1%).
 *      - Pilotera le passage automatique du Stop Loss en Break-Even à 50% du trajet vers le TP.
 * 
 * 
 * ──────────────────────────────────────────────────────────────────────────────
 * 2️⃣ FLUX D'ÉCHANGE DE DONNÉES (QUI ENVOIE QUOI À QUI ?)
 * ──────────────────────────────────────────────────────────────────────────────
 * 
 *   [Graphique / Bougies]
 *            │
 *            ▼
 *  ┌────────────────────────────────────────────────────────────────────────────┐
 *  │ 1. BLOC 1 : DOJI & PLAGE CIBLÉE                                            │
 *  │    • Détecte le Doji (Achat ou Vente)                                      │
 *  │    • Détermine la plage temporelle : [tempsDebutPlage ➔ tempsDoji]         │
 *  │    • Extrait : prixSL (extrême), prixEntree (close2), tailleLiquidation    │
 *  └─────────────────────┬──────────────────────────────────────────────────────┘
 *                        │ Données envoyées :
 *                        │ - Bornes temporelles de la plage
 *                        │ - Sens du signal (ACHAT / VENTE)
 *                        │ - Taille de la bougie de liquidation
 *                        ▼
 *  ┌────────────────────────────────────────────────────────────────────────────┐
 *  │ 2. BLOC 2 : SHVED S/R & SCORING                                            │
 *  │    • Filtre les zones Shved : Supports si Achat, Résistances si Vente      │
 *  │    • Ne garde que les zones strictes dans la plage temporelle              │
 *  │    • Calcule le Score de liquidité sur 100 points                          │
 *  │    • Renvoie la meilleure zone et son score                                │
 *  └─────────────────────┬──────────────────────────────────────────────────────┘
 *                        │ Données renvoyées à l'Orchestrateur :
 *                        │ - meilleureZoneShved (niveaux haut/bas/médian)
 *                        │ - scoreShved (0 à 100 points)
 *                        ▼
 *  ┌────────────────────────────────────────────────────────────────────────────┐
 *  │ 3. ORCHESTRATEUR SMC : VÉRIFICATION DU RANGE DE CONFIRMATION (3 BOUGIES)   │
 *  │    • Scrute les bougies k = Doji + 1, Doji + 2, Doji + 3                   │
 *  │    • Si Low <= prixSL (Achat) ou High >= prixSL (Vente) ➔ ANNULÉ           │
 *  │    • Si les 3 bougies respectent le SL ➔ CONFIRMÉ !                        │
 *  └─────────────────────┬──────────────────────────────────────────────────────┘
 *                        │ Si le setup est confirmé :
 *                        │ Demande au profil UOP les cibles de prix optimales
 *                        ▼
 *  ┌────────────────────────────────────────────────────────────────────────────┐
 *  │ 4. BLOC 3 : PROFIL UOP & SÉLECTION PROPORTIONNELLE DU TP OPTIMAL           │
 *  │    • UOP calcule les paliers de chevauchement non-mitigés                  │
 *  │    • Règle de proportionnalité au score Shved :                           │
 *  │        • Si scoreShved >= 70 pts (Liquidité massive) ➔ Vise TP2 (Étendu)   │
 *  │        • Si scoreShved < 70 pts (Liquidité modérée) ➔ Vise TP1 (Conservateur)
 *  │    • Calcule le Ratio Risque/Rendement (R:R) = distanceTP / distanceSL     │
 *  └─────────────────────┬──────────────────────────────────────────────────────┘
 *                        │
 *                        ▼
 *  ┌────────────────────────────────────────────────────────────────────────────┐
 *  │ 5. SUIVI DU CYCLE DE VIE DU TRADE & ÉPURATION VISUELLE DU GRAPHIQUE        │
 *  │    • Scrute les bougies suivantes : TP touché ? SL touché ? En cours ?     │
 *  │    • Si TP ou SL touché ET masquerSetupsTermines === true :                │
 *  │        ➔ EFFACEMENT COMPLET DU GRAPHIQUE (Évite la surcharge visuelle !)   │
 *  │    • Si Setup Actif :                                                      │
 *  │        ➔ Affiche 1 point discret sur la mèche du Doji                      │
 *  │        ➔ Affiche 1 segment pointillé du Support/Résistance Shved           │
 *  │        ➔ Affiche 2 micro-segments courts de 3 bougies (SL Rouge / TP Vert) │
 *  └────────────────────────────────────────────────────────────────────────────┘
 * 
 * 
 * ──────────────────────────────────────────────────────────────────────────────
 * 3️⃣ CHRONOLOGIE COMPLÈTE POUR OBTENIR UN SETUP VALIDE
 * ──────────────────────────────────────────────────────────────────────────────
 * 
 *  Étape ① : Un Doji de liquidation + réintégration apparaît sur le graphique.
 *  Étape ② : La zone de Support/Résistance balayée dans la plage temporelle ciblée
 *            obtient un score Shved suffisant (>= scoreMinimumShved, par défaut 0).
 *  Étape ③ : Les 3 bougies suivantes se forment sans JAMAIS toucher ou enfoncer
 *            le niveau de Stop Loss fixé sur la mèche extrême du Doji.
 *  Étape ④ : L'indicateur sélectionne le TP Optimal (TP1 ou TP2 selon la force du score),
 *            calcule le R:R et affiche le setup sur le graphique.
 *  Étape ⑤ : Dès que le marché touche le TP ou le SL, le setup bascule en "terminé"
 *            et disparaît automatiquement du graphique pour laisser la place aux futurs trades.
 * 
 * 
 * ──────────────────────────────────────────────────────────────────────────────
 * 4️⃣ 📋 REGISTRE EXHAUSTIF DES CONDITIONS & PARAMÈTRES RÉGLABLES
 * ──────────────────────────────────────────────────────────────────────────────
 * Vous trouverez ci-dessous le registre de TOUTES les conditions actuellement en place.
 * Si vous désirez faire un ajustement, il vous suffit de vous référer au code [COND-XX] :
 * 
 * ------------------------------------------------------------------------------
 * 🏷️ DÉTECTION DU DOJI ET DE LA PLAGE CIBLÉE (SANDBOX BLOC 1)
 * ------------------------------------------------------------------------------
 * • [COND-DOJI-01] Sens de trading autorisé :
 *     - Règle : Filtrer les signaux autorisés (Achat seul, Vente seule, ou les deux).
 *     - Paramètres : `activerAchat: true`, `activerVente: true`
 * 
 * • [COND-DOJI-02] Filtre de taille relative des bougies du Doji :
 *     - Règle : Les bougies 1 et 2 du Doji doivent être plus grandes que la moyenne récente.
 *     - Paramètre : `activerFiltreTaille: true` (défaut: activé)
 *     - Historique de calcul : `periodeHistorique: 10` (moyenne sur les 10 dernières bougies)
 *     - Multiplicateur Bougie 1 : `multiplicateurBougie1: 1.0` (Taille B1 >= 1.0 x moyenne)
 *     - Multiplicateur Bougie 2 : `multiplicateurCorps2: 1.2` (Corps B2 >= 1.2 x moyenne)
 * 
 * • [COND-DOJI-03] Tolérance de réintégration :
 *     - Tolérance de déficit : `toleranceDeficit: 0.30`
 *       (Permet à B2 de s'arrêter à 30% en dessous de l'Open de B1 tout en restant valide).
 *     - Tolérance de dépassement : `toleranceDepassement: 2.0`
 *       (Permet à B2 de dépasser l'Open de B1 jusqu'à 200% de la taille de B1).
 * 
 * • [COND-DOJI-04] Recherche de l'extrême précédent (Plage ciblée) :
 *     - Règle : Recule dans les bougies passées pour trouver le Plus Haut (Achat) ou Plus Bas (Vente) majeur.
 *     - Paramètre : `maxReculRecherche: 100` (Recul maximal de 100 bougies)
 * 
 * ------------------------------------------------------------------------------
 * 🏷️ ZONES SHVED & SCORE DE LIQUIDITÉ (SANDBOX BLOC 2)
 * ------------------------------------------------------------------------------
 * • [COND-SHVED-01] Multi-Timeframe de calcul Shved :
 *     - Paramètre : `timeframeSource: 'M15'` (Calcul des zones sur M15 projeté sur le graphique)
 * 
 * • [COND-SHVED-02] Épuration par direction du trade :
 *     - Règle : Seuls les SUPPORTS sont retenus en Achat, seules les RÉSISTANCES en Vente.
 *     - Paramètre : `filtrerParDirectionSetup: true`
 * 
 * • [COND-SHVED-03] Épuration stricte par la Plage Temporelle :
 *     - Règle : La date de début ET la date de fin du niveau Shved doivent être STRICTEMENT
 *       comprises entre le début de la plage ciblée et la bougie du Doji.
 *     - Paramètre : `exigerDebutEtFinDansPlage: true`
 * 
 * • [COND-SHVED-04] Décomposition du Score de Liquidité sur 100 points :
 *     - Retests passés : Max 35 points (7 pts par retest antérieur au Doji, plafonné à 5 retests).
 *     - Hauteur du Rejet / Montagne : Max 30 points (Mesure de la force du rebond vs ATR).
 *     - Proportionnalité Liquidation/Rejet : Max 25 points (Taille B1 comparée au rejet moyen).
 *     - Intégrité de la zone : Max 10 points (Bonus de récence / fraîcheur de la zone).
 * 
 * • [COND-SHVED-05] Seuil minimal de Score Shved pour accepter un setup :
 *     - Règle : Si le meilleur score Shved est inférieur à ce seuil, le setup est rejeté d'office.
 *     - Paramètre : `scoreMinimumShved: 0` (0 = accepte toute zone Shved balayée, modifiable à 50, 60...)
 * 
 * ------------------------------------------------------------------------------
 * 🏷️ RANGE DE CONFIRMATION (ORCHESTRATEUR CENTRAL)
 * ------------------------------------------------------------------------------
 * • [COND-CONF-01] Nombre de bougies de confirmation :
 *     - Règle : Nombre de bougies consécutives après le Doji devant respecter le SL sans le toucher.
 *     - Paramètre : `nbBougiesConfirmation: 3` (défaut: 3 bougies consécutives)
 * 
 * • [COND-CONF-02] Niveau de référence du Stop Loss :
 *     - Achat : Stop Loss = `prixExtreme` du Doji (Plus Bas / Low de la mèche de liquidation).
 *     - Vente : Stop Loss = `prixExtreme` du Doji (Plus Haut / High de la mèche de liquidation).
 *     - Invalidation immédiate si : Low_k <= SL (en Achat) ou High_k >= SL (en Vente).
 * 
 * • [COND-CONF-03] Gestion des setups annulés :
 *     - Paramètre : `afficherSetupsAnnules: false` (défaut: false, ne pollue pas le chart).
 * 
 * ------------------------------------------------------------------------------
 * 🏷️ PROFIL UOP & CHOIX PROPORTIONNEL DU TP OPTIMAL (MODÈLE STANDARD ACTUEL)
 * ------------------------------------------------------------------------------
 * • [COND-UOP-01] Paramètres d'analyse fractale UOP :
 *     - Sensibilité ZigZag : `zigzagDepth: 8` (amplitude des swings détectés)
 *     - Vagues superposées : `nbVaguesSuperposees: 4` (profondeur d'historique de chevauchement)
 * 
 * • [COND-UOP-02] Règle de Proportionnalité du TP selon le Score Shved :
 *     - Règle :
 *         • Si `scoreShved >= 70 points` ➔ Objectif étendu sélectionné : **TP2** (Grand mouvement).
 *         • Si `scoreShved < 70 points`  ➔ Objectif sécurisé sélectionné : **TP1** (Mouvement standard).
 *     - Paramètre : `seuilScoreGrandMouvement: 70` (seuil de bascule modifiable).
 * 
 * • [COND-UOP-03] Cible de secours si aucun palier UOP n'est disponible :
 *     - Règle : Si le marché n'a pas de palier UOP vierge au-delà de l'entrée :
 *         • Si score >= 70 ➔ TP secours fixé à 2.5 x Distance SL.
 *         • Si score < 70  ➔ TP secours fixé à 1.5 x Distance SL.
 * 
 * ------------------------------------------------------------------------------
 * 🏷️ 🚀 NOUVEAU MODÈLE AVANCÉ : MOTEUR D'ÉNERGIE (CARBURANT VS FRICTION OVERLAP UOP)
 * ------------------------------------------------------------------------------
 * Ce modèle révolutionnaire modélise la capacité réelle d'accélération du marché :
 * Le Doji fournit un RÉSERVOIR DE CARBURANT, et la route vers le haut (UOP) oppose
 * une RÉSISTANCE DE FRICTION. Le TP Optimal est le point exact où le carburant s'épuise
 * ou cale devant un mur d'absorption infranchissable.
 * 
 * 🔹 1. CALCUL DU CARBURANT INITIAL (ÉNERGIE CINÉTIQUE ENGRANGÉE)
 * • [COND-ENERGIE-01] Carburant de Base selon les Retests S/R (L_retests) :
 *     - Règle : Chaque rebond antérieur sur la zone S/R attire des ordres de liquidité.
 *     - Variables Externes Réglables :
 *         • `pointsParRetest: 100` (Points injectés par retest antérieur, défaut: 100)
 *         • `plafondCarburantRetests: 400` (Plafond maximal de carburant attribuable, défaut: 400)
 *     - Formule : `pointsRetests = Math.min(plafondCarburantRetests, nombreRetests * pointsParRetest)`
 * 
 * • [COND-ENERGIE-02] Multiplicateur de Mèche de Balayage (M_meche) :
 *     - Règle : Mesure la profondeur de pénétration de la mèche au-delà du S/R comparée à l'ATR :
 *     - Variables Externes Réglables :
 *         • `bonusMecheProfonde: 1.6` (Multiplicateur si mèche > 1.2 ATR, défaut: 1.6x)
 *         • `bonusMecheNormale: 1.3` (Multiplicateur si mèche 0.5 à 1.2 ATR, défaut: 1.3x)
 *         • Effleurement (< 0.5 ATR) ➔ Multiplicateur = 1.0x
 * 
 * • [COND-ENERGIE-03] Formule du Budget Total Initial (B0) :
 *     - Formule mathématique : `B0 = pointsRetests * multiplicateurMeche`
 *     - Exemple chiffré : Support testé 3 fois (300 pts) avec mèche profonde (x 1.6)
 *       ➔ Budget Total Initial B0 = 300 * 1.6 = 480 points de carburant !
 * 
 * 🔹 2. CONSOMMATION & FRICTION DE LA ROUTE (OVERLAP UOP)
 * • [COND-FRICTION-01] Grille de Consommation Continue selon le Taux d'Overlap :
 *     - Variables Externes Réglables :
 *         • `coutParATR: 50` (Consommation de base en points de carburant par unité d'ATR)
 *         • `coutFrictionFortOverlap: 0.5` (Multiplicateur pour autoroute fluide, défaut: 0.5x)
 *         • `coutFrictionMoyenOverlap: 1.0` (Multiplicateur pour terrain standard, défaut: 1.0x)
 *         • `coutFrictionFaibleOverlap: 2.0` (Multiplicateur pour zone vierge / FVG, défaut: 2.0x)
 *         • `seuilFortOverlap: 4.0` (Bougies de chevauchement pour qualifier l'autoroute, défaut: 4.0)
 *         • `seuilFaibleOverlap: 2.0` (Seuil en dessous duquel le terrain est difficile, défaut: 2.0)
 * 
 * • [COND-FRICTION-02] Forfait Péage de Traversée d'un Palier Non-Mitigé UOP :
 *     - Règle : Chaque palier vierge non-mitigé UOP rencontré sur la trajectoire oppose un mur d'absorption.
 *     - Variable Externe Réglable :
 *         • `peagePalierUOP: 100` (Forfait en points pour traverser et percer un mur UOP, défaut: 100 pts)
 *     - Condition de percée :
 *         • Si Budget Restant >= peagePalierUOP ➔ Le mur est PERCÉ ! Déduction et poursuite.
 *         • Si Budget Restant < peagePalierUOP  ➔ Le mur est INFRANCHISSABLE ! Arrêt immédiat.
 * 
 * • [COND-FRICTION-03] Ancrage Mathématique du Take Profit Optimal :
 *     - Variable Externe Réglable :
 *         • `margeSecuriteDevantPalier: 0.15` (Marge de sécurité en % d'ATR pour sortir avant le mur, défaut: 15%)
 *     - Règle : Si un mur ne peut pas être franchi, le TP est ancré juste devant le palier pour garantir l'exécution.
 *     - Si tous les paliers sont franchis, le TP continue d'avancer selon le carburant restant.
 * 
 * 🔹 3. EXEMPLE COMPLET SIMULÉ PAS-À-PAS :
 *     - Signal d'Achat : Entrée à 1.1000, Stop Loss à 1.0970 (Risque = 30 pips).
 *     - Carburant initial : 3 tests S/R + mèche profonde ➔ B0 = 450 points.
 *     - Étape 1 : Le prix monte de 20 pips dans une zone à fort overlap (20 pips * 0.5 = 10 pts).
 *       ➔ Reste 440 pts.
 *     - Étape 2 : Rencontre du Palier UOP 1 (exige 100 pts). 440 >= 100 ➔ PALIER PERCÉ !
 *       ➔ Reste 340 pts.
 *     - Étape 3 : Le prix monte de 30 pips supplémentaires en overlap moyen (30 * 1.0 = 30 pts).
 *       ➔ Reste 310 pts.
 *     - Étape 4 : Rencontre du Palier UOP 2 (exige 100 pts). 310 >= 100 ➔ PALIER PERCÉ !
 *       ➔ Reste 210 pts.
 *     - Étape 5 : Le prix monte de 40 pips en faible overlap (40 * 2.0 = 80 pts).
 *       ➔ Reste 130 pts.
 *     - Étape 6 : Rencontre du Palier UOP 3 (exige 100 pts). 130 >= 100 ➔ PALIER PERCÉ !
 *       ➔ Reste 30 pts.
 *     - Étape 7 : Le prix monte de 10 pips en faible overlap (10 * 2.0 = 20 pts).
 *       ➔ Reste 10 pts.
 *     - Étape 8 : Rencontre du Palier UOP 4 (exige 100 pts). Reste 10 pts < 100 pts ➔ ÉCHEC DE PERCÉE !
 *     - 🏁 RÉSULTAT FINAL : Le TP Optimal est fixé à 1.1102 (juste devant le Palier 4), soit +102 pips.
 *       ➔ Ratio R:R exceptionnel et validé par la physique du carnet : 102 pips / 30 pips = 3.40R !
 * 
 * ------------------------------------------------------------------------------
 * 🏷️ SUIVI DU CYCLE DE VIE & ÉPURATION ACTIVE DU GRAPHIQUE
 * ------------------------------------------------------------------------------
 * • [COND-VISU-01] Masquage automatique des setups passés / terminés :
 *     - Règle : Dès qu'une bougie future touche le TP (Gagnant) ou le SL (Perdant), le trade
 *       est considéré comme "passé" et est 100% masqué de l'affichage du graphique !
 *     - Paramètre : `masquerSetupsTermines: true` (défaut: true).
 * 
 * • [COND-VISU-02] Style visuel épuré & non-surchargé :
 *     - Paramètre : `modeVisuel: 'EPURE'` (Point discret + micro-segments courts).
 *     - `afficherPointDoji: true` (Petit point discret sur la mèche du Doji).
 *     - `afficherSegmentSR: true` (Segment discontinu sur le niveau S/R Shved balayé).
 *     - `afficherSegmentSL: true` (Micro-segment rouge discontinu court pour le SL).
 *     - `afficherSegmentTP: true` (Micro-segment vert continu court pour le TP avec ratio R:R).
 *     - `dureeSegmentsCibles: 3` (Longueur des micro-segments : 3 bougies seulement).
 * 
 * ------------------------------------------------------------------------------
 * 🏷️ FUTUR PILIER : MONEY MANAGEMENT DYNAMIQUE (PRÊT À CONNECTER)
 * ------------------------------------------------------------------------------
 * • [COND-MM-01] Filtre de Ratio Risque/Rendement (R:R) Minimal :
 *     - Règle : Rejeter tout setup confirmé si son `ratioRR < ratioRRMin`.
 *     - Valeur prévue : `ratioRRMin: 2.5`
 * 
 * • [COND-MM-02] Calcul de position monétaire :
 *     - Règle : `lot = (capitalCompte * risquePourcent / 100) / (distanceSL * valeurPoint)`.
 *     - Valeurs prévues : `capitalCompte: 10000$`, `risquePourcent: 1.0%`
 * 
 * • [COND-MM-03] Déplacement automatique en Break-Even :
 *     - Règle : Passer le Stop Loss au prix d'entrée dès que le cours a parcouru 50% de la distance au TP.
 *     - Valeur prévue : `ratioDeclenchementBE: 0.50`
 * ==============================================================================
 */

// ─── 📊 Interfaces et Types ───────────────────────────────────────────────────

export interface ParametresOrchestrateurSMC {
  // ─── 🕯️ Déclencheur Doji & Plage Sandbox ───
  activerAchat?: boolean;               // Autoriser les signaux d'Achat (Spring) (défaut: true)
  activerVente?: boolean;               // Autoriser les signaux de Vente (UTAD) (défaut: true)
  activerFiltreTaille?: boolean;        // Filtrer les Dojis par taille relative (défaut: true)
  periodeHistorique?: number;           // Nombre de bougies pour la moyenne de taille (défaut: 10)
  multiplicateurBougie1?: number;       // Multiplicateur bougie 1 de liquidation (défaut: 1.0)
  multiplicateurCorps2?: number;        // Multiplicateur bougie 2 de réintégration (défaut: 1.2)
  toleranceDeficit?: number;            // Tolérance de déficit de réintégration (défaut: 0.30)
  toleranceDepassement?: number;        // Tolérance de dépassement favorable (défaut: 2.0)
  maxReculRecherche?: number;           // Recul max pour la plage ciblée (défaut: 100)

  // ─── ⏱️ Multi-Timeframe & Shved + Calque Fractal HTF ➔ LTF ───
  timeframeSource?: string;             // Unité de temps Shved (défaut: 'M15')
  donneesM1?: Bougie[];                 // Données M1 pour calcul MTF
  chartTimeframe?: string;              // Unité de temps du graphique
  scoreMinimumShved?: number;           // Seuil minimal de score Shved (0 à 100, défaut: 0)
  activerCalqueFractalHTF?: boolean;    // 🔬 En Backtest Manuel, projette la Plage H4, les OB protégés et le Grand TP H4 quand on descend en M15/M30 (défaut: true)
  timeframeMaitreFractal?: string;      // 🏛️ Timeframe Maître HTF du calque fractal (défaut: '4h')

  // ─── ⏳ Range de Confirmation (3 Bougies) ───
  nbBougiesConfirmation?: number;        // Nombre de bougies de confirmation du range (défaut: 3)
  afficherSetupsAnnules?: boolean;       // Afficher les signaux invalidés avec un badge discret (défaut: false)
  bornerRangeConfirmationParAmplitudeDoji?: boolean; // Exiger que chaque bougie du range (3 bougies) reste entre SL et Close(B2) ± AmplitudeDuDoji (défaut: true)
  typeVerificationBorneRange?: 'CLOTURE' | 'MECHE'; // Vérifier la clôture ('CLOTURE') ou la mèche ('MECHE') par rapport à Close(B2) ± AmplitudeDuDoji (défaut: 'CLOTURE')
  multiplicateurAmplitudeBorneRange?: number; // Multiplicateur de l'amplitude du Doji pour la borne du range (défaut: 1.0)

  // ─── 🧹 Épuration Active : Masquage des Setups Passés (TP ou SL Touché) ───
  masquerSetupsTermines?: boolean;      // Masquer du graphique les setups dont le TP ou SL a déjà été touché (défaut: true)

  // ─── 🚀 Moteur d'Énergie & Coût des Péages UOP (Variables Externes Réglables) ───
  modeCalculTP?: 'STANDARD_SHVED' | 'ENERGIE_FRICTION'; // Méthode de calcul du TP optimal (défaut: 'ENERGIE_FRICTION')
  palierTPVise?: 'TP1' | 'TP2' | 'TP3' | 'AUTO'; // Choix forcé ou dynamique du palier TP (défaut: 'TP1')
  peagePalierUOP?: number;               // [COND-FRICTION-02] Forfait en points de carburant pour franchir un palier UOP (défaut: 100)
  coutParATR?: number;                   // [COND-FRICTION-01] Consommation de base en points de carburant par unité d'ATR parcourue (défaut: 50)
  coutFrictionFortOverlap?: number;      // [COND-FRICTION-01] Multiplicateur de coût en zone à Fort Overlap / autoroute (défaut: 0.5)
  coutFrictionMoyenOverlap?: number;     // [COND-FRICTION-01] Multiplicateur de coût en zone à Overlap Moyen (défaut: 1.0)
  coutFrictionFaibleOverlap?: number;    // [COND-FRICTION-01] Multiplicateur de coût en zone à Faible Overlap / vide (défaut: 2.0)
  seuilFortOverlap?: number;             // [COND-FRICTION-01] Seuil en bougies de chevauchement pour qualifier un Fort Overlap (défaut: 4.0)
  seuilFaibleOverlap?: number;           // [COND-FRICTION-01] Seuil en bougies de chevauchement en dessous duquel c'est un Faible Overlap (défaut: 2.0)
  margeSecuriteDevantPalier?: number;    // [COND-FRICTION-03] Marge de sécurité en % d'ATR pour ancrer le TP avant le mur (défaut: 0.15 = 15%)
  pointsParRetest?: number;              // [COND-ENERGIE-01] Points de carburant attribués par retest du S/R (défaut: 100)
  plafondCarburantRetests?: number;      // [COND-ENERGIE-01] Plafond maximal de carburant attribuable aux retests (défaut: 400)
  bonusMecheProfonde?: number;           // [COND-ENERGIE-02] Multiplicateur si la mèche de balayage est profonde > 1.2 ATR (défaut: 1.6)
  bonusMecheNormale?: number;            // [COND-ENERGIE-02] Multiplicateur si la mèche de balayage est normale 0.5 - 1.2 ATR (défaut: 1.3)
  seuilScoreGrandMouvement?: number;     // Score Shved pour viser TP2 au lieu de TP1 en mode STANDARD historique (défaut: 70)
  zigzagDepth?: number;                  // Sensibilité ZigZag UOP fixe de secours (défaut: 8)
  activerZigZagDynamique?: boolean;      // 🌊 Adapte automatiquement la taille des vagues ZigZag (4 à 20) selon le Score de Liquidation (défaut: true)
  zigzagDepthMin?: number;               // 🌊 Taille minimale des vagues ZigZag en cas de faible liquidation (défaut: 4)
  zigzagDepthMax?: number;               // 🌊 Taille maximale des vagues ZigZag en cas de liquidation massive (défaut: 20)
  nbVaguesSuperposees?: number;          // Nombre de vagues superposées UOP (défaut: 4)

  // ─── 🛣️ Condition d'Autoroute UOP Obligatoire ───
  exigerAutorouteUOP?: boolean;          // [COND-UOP-04] Exiger une autoroute UOP en face du trade (rejette si faible chevauchement uniquement) (défaut: true)
  minTauxChevauchementAutoroute?: number; // [COND-UOP-04] Taux minimum de bougies de chevauchement requis pour qualifier l'autoroute (défaut: 1.5)

  // ─── 🛡️ Niveaux Shved & Lookback Historique ───
  exigerDebutEtFinDansPlage?: boolean;   // Exiger que le S/R Shved soit né strictement dans la micro-plage du Doji (défaut: false pour capter les S/R majeurs)
  maxLookbackBars?: number;              // Nombre de bougies analysées pour le calcul Shved (défaut: totalité des bougies)

  // ─── 🎯 Filtre Plage Temporelle TP UOP ───
  activerFiltrePlageTP?: boolean;        // [COND-PLAGE-TP-01] Exige que le Doji soit l'extrême absolu de toute la plage entre la bougie contenant le TP et le Doji (défaut: true)
  maxReculPlageTP?: number;              // Nombre max de bougies de recul pour trouver la bougie contenant le prix du TP (défaut: 100)

  // ─── 🧲 Cible de Liquidité S/R Actif (Non Cassé) + Trajet Chevauchement UOP ───
  activerTPCibleLiquiditeSR?: boolean;   // Active la recherche d'un Support/Résistance actif (non cassé) en face comme TP si tout le trajet a un bon chevauchement (défaut: false)
  comportementAbsenceSR?: 'REPLI_TP_UOP' | 'REJETER_SETUP'; // Choix si aucun S/R actif n'est joignable : 'REPLI_TP_UOP' (garde le TP UOP) ou 'REJETER_SETUP' (filtre strict)
  tauxMinChevauchementTrajetSR?: number; // Taux moyen minimum de bougies de chevauchement requis sur tout le trajet vers le S/R cible (défaut: 1.5)
  couvertureMinTrajetSRPourcent?: number;// Pourcentage minimum du trajet vers le S/R devant être couvert par du chevauchement (défaut: 70%)

  // ─── 🕯️ Traitement Anatomique des Bougies UOP (Corps vs Mèches) ───
  typeChevauchementUOP?: 'PONDERE' | 'CORPS_SEUL' | 'CORPS_ET_MECHES'; // Traitement anatomique du chevauchement dans l'UOP (défaut: 'PONDERE')
  poidsCorpsUOP?: number;               // Poids attribué au corps de la bougie (défaut: 1.0)
  poidsMecheUOP?: number;               // Poids attribué aux mèches de la bougie (défaut: 0.25)

  // ─── 🎨 Visuels Épurés & Minimalistes (Ergonomie Pro) ───
  modeVisuel?: 'EPURE' | 'COMPLET';      // 'EPURE' (point discret + micro-segments) ou 'COMPLET' (défaut: 'EPURE')
  afficherPointDoji?: boolean;           // Point discret sur la mèche du Doji (défaut: true)
  afficherPointsLiquidation?: boolean;   // Affiche le badge compact des points de liquidité captés sur le Doji (défaut: true)
  afficherSegmentSR?: boolean;           // Segment discontinu du S/R Shved balayé (défaut: true)
  afficherPaliersUOP?: boolean;          // Micro-segments pointillés très fins pour chaque palier d'overlap UOP rencontré (défaut: true)
  afficherProfilVolumeUOP?: boolean;     // 📊 Affiche l'histogramme Volume Profile des chevauchements ayant déterminé le TP (défaut: true)
  afficherOrderBlocksProteges?: boolean; // 🟦 Trace les rectangles des Order Blocks classiques SMC protégés à l'intérieur de la plage du setup (défaut: true)
  afficherSegmentSL?: boolean;           // Micro-segment court pour le Stop Loss (défaut: true)
  afficherSegmentTP?: boolean;           // Micro-segment court pour le Take Profit (défaut: true)
  dureeSegmentsCibles?: number;          // Nombre de bougies de longueur pour les segments SL/TP/Paliers (défaut: 3)
  bullColor?: string;                    // Couleur Achat / Support (défaut: '#00E676')
  bearColor?: string;                    // Couleur Vente / Résistance (défaut: '#F23645')
}

/**
 * Statut d'un setup de trading SMC
 */
export type StatutSetupSMC = 'CONFIRME' | 'ANNULE' | 'EN_COURS';

/**
 * Issue finale du trade après la confirmation
 */
export type ResultatTradeSMC = 'TP_TOUCHE' | 'SL_TOUCHE' | 'EN_COURS';

/**
 * Palier UOP analysé sur la route du trade
 */
export interface PalierUOPAnalyse {
  prix: number;
  ordre: number;
  estPerce: boolean;
  estBloquant: boolean;
  tauxChevauchement: number;
}

/**
 * Détail pas-à-pas de l'évaluation d'un palier UOP par le moteur d'énergie
 */
export interface EtapePalierUOPDetail {
  ordre: number;
  prixCible: number;
  distancePoints: number;
  tauxChevauchement: number;
  consommationDistance: number;
  peagePalier: number;
  budgetAvant: number;
  budgetApres: number;
  estPerce: boolean;
  estBloquant: boolean;
  explication: string;
}

/**
 * Détails de calcul du carburant initial capté lors du balayage de liquidité
 */
export interface DetailsCarburantLiquidation {
  pointsRetests: number;
  nombreRetests: number;
  multiplicateurMeche: number;
  profondeurMeche: number;
  hauteurMoyenneATR: number;
  carburantTotal: number;
}

/**
 * 🌊 Détails du Score de Prise de Liquidité (sur 100 points) et de la Boîte de Vitesses (3 vitesses)
 * servant à régler dynamiquement le ZigZag et l'indicateur UOP pour un TP1 sur-mesure.
 */
export interface DetailsScoreLiquidationZigZag {
  scoreTotal: number;               // Score final sur 100 points (Retests/Collines /50 + Durée S/R /25 + Mèche /25)
  pointsProfondeurCassure: number;  // Sur 25 pts : profondeur de la mèche de balayage comparée à l'ATR
  pointsTailleBougieEtZone: number; // Sur 25 pts : durée de vie du S/R (ou force bougie + zone)
  pointsRetestsSR: number;          // Sur 50 pts : nombre et qualité des collines de retest avant cassure
  ratioProfondeurATR: number;       // Profondeur de la cassure / ATR moyen
  ratioTailleBougieATR: number;     // Taille de la bougie de liquidation / ATR moyen
  ratioEpaisseurZoneATR: number;    // Épaisseur de la zone S/R / ATR moyen
  dureeVieBougiesSR?: number;       // Âge en bougies du niveau S/R au moment de la liquidation
  nombreRetests: number;            // Nombre de vrais retests du S/R
  vitesseRetenue: 1 | 2 | 3;        // Vitesse automatique (1 = Micro-vagues, 2 = Moyennes, 3 = Grandes)
  zigzagDepthRetenu: number;        // Finesse du ZigZag retenue (ex: 2-3 en Vitesse 1, 5-7 en Vitesse 2, 9-14+ en Vitesse 3)
  zigzagBackstepRetenu: number;     // Backstep ZigZag retenu (1 en Vitesse 1, 2 en Vitesse 2, 3 en Vitesse 3)
  nbVaguesSuperposeesRetenu: number;// Nombre de vagues superposées UOP (2 en Vitesse 1, 3 en Vitesse 2, 4 en Vitesse 3)
  plafondDerniereVagueActif: boolean;// Garde-fou actif en Vitesse 1 (< 40 pts) : confine le TP1 dans la dernière petite vague
  zigzagDepthMin: number;           // Borne minimale (défaut: 2)
  zigzagDepthMax: number;           // Borne maximale (défaut: 14)
  categorieVagues: 'PETITES_VAGUES' | 'VAGUES_MOYENNES' | 'GRANDES_VAGUES';
  resumeExplication: string;        // Explication claire en français affichée sur le graphique
  pivotsZigZag?: { index: number; temps: number | string; prix: number; type: 'HIGH' | 'LOW' }[]; // Pivots ZigZag retenus pour le tracé diagnostic
}

/**
 * Représentation complète d'un Setup orchestré
 */
export interface SetupOrchestreSMC {
  id: string;
  type: 'ACHAT' | 'VENTE';
  statut: StatutSetupSMC;
  indexDoji: number;
  tempsDoji: number | string;

  // Plage temporelle ciblée
  tempsDebutPlage?: number | string;
  indexDebutPlage?: number;

  // Niveaux de prix clés
  prixEntree: number;           // Cours de clôture de la bougie 2 du Doji
  prixSL: number;               // Prix extrême du Doji (Stop Loss naturel)
  distanceSL: number;           // Distance en points de prix entre entrée et SL

  // Score Shved de la liquidité balayée
  scoreShved: number;           // Score sur 100 points
  meilleureZoneShved?: ZoneShvedAvecScore;
  zonesShvedCandidates?: ZoneShvedAvecScore[]; // Toutes les zones S/R Shved trouvées et scorées dans la plage

  // Validation du Range (les 3 bougies)
  bougiesObservees: number;     // Nombre de bougies écoulées après le Doji
  bougieInvalidationIndex?: number; // Index de la bougie ayant invalidé le SL ou dépassé la borne du range si annulé
  borneRangeConfirmation?: number;  // Borne du range de 3 bougies opposée au SL : Close(B2) + AmplitudeDuDoji (Achat) ou Close(B2) - AmplitudeDuDoji (Vente)
  indexConfirmation?: number;   // Index de la 3ème bougie de confirmation où le TP est verrouillé
  tempsConfirmation?: number | string; // Date de la 3ème bougie de confirmation

  // Cible Take Profit Optimal (UOP)
  prixTP?: number;              // Prix cible du Take Profit
  ordreTP?: number;             // Ordre du TP choisi (1 pour TP1, 2 pour TP2, 3 pour TP3)
  palierTPVise?: 'AUTO' | 'TP1' | 'TP2' | 'TP3'; // Choix forcé ou automatique du palier
  distanceTP?: number;          // Distance en points entre entrée et TP
  ratioRR?: number;             // Ratio Risque/Rendement (R:R)
  tpSelectionne?: TPOptimalUOP;

  // 🚀 Données du Moteur d'Énergie UOP (Carburant vs Friction) & ZigZag Dynamique
  carburantInitial?: number;    // Réservoir de carburant capté lors de la liquidation
  carburantRestant?: number;    // Carburant restant à l'ancrage du TP
  paliersTraverses?: number;    // Nombre de murs de liquidité UOP franchis
  estLimiteParPalier?: boolean; // Vrai si le TP a calé devant un palier infranchissable
  paliersAnalyses?: PalierUOPAnalyse[]; // Liste ordonnée des paliers UOP rencontrés sur la route
  etapesPaliersUOP?: EtapePalierUOPDetail[]; // Trajet pas-à-pas à travers chaque palier UOP
  detailsCarburant?: DetailsCarburantLiquidation; // Détails du calcul du carburant initial
  detailsScoreLiquidationZigZag?: DetailsScoreLiquidationZigZag; // 🌊 Score /100 de liquidation et réglage dynamique du ZigZag
  tousPaliersUOPCandidats?: TPOptimalUOP[]; // Tous les paliers UOP candidats disponibles

  // 📊 Données du Profil de Chevauchement ("Volume Profile UOP") ayant déterminé le TP
  stepUOP?: number;             // Pas de prix de chaque barre horizontale du profil
  seuilBleuFonceUOP?: number;   // Seuil de bougies pour qualifier une barre dense ("bleu foncé")
  paliersSuperpositionUOP?: PalierSuperpositionVagues[]; // Barres horizontales cumulées du profil de chevauchement
  vaguesSuperposeesUOP?: VagueOverlapProfile[];          // Les N vagues ZigZag (2, 3 ou 4) utilisées pour ce profil
  borneDernierePetiteVague?: number;                     // 🛡️ Plafond/Plancher Garde-Fou de la dernière petite vague (Vitesse 1)

  // 🎯 Filtre Plage Temporelle TP UOP
  infoPlageTP?: InfoValidationPlageTP; // Détails de validation de la plage temporelle du TP

  // 🧲 Cible de Liquidité S/R Actif (Non Cassé) avec Trajet de Chevauchement validé
  cibleLiquiditeSR?: InfoCibleLiquiditeSR; // Support ou Résistance actif retenu comme Take Profit
  toutesCiblesSRAnalysees?: InfoCibleLiquiditeSR[]; // Tous les S/R actifs en face analysés avec leur taux de chevauchement

  // 🧪 Surcharge Interactive en Temps Réel de la Profondeur ZigZag (par Setup)
  profondeurZigZagOriginale?: number;      // Profondeur calculée automatiquement par l'indicateur selon le Doji
  profondeurZigZagPersonnalisee?: number;  // Profondeur testée en temps réel par l'utilisateur sur ce setup

  // 🟦 Order Blocks Classiques SMC Protégés à l'intérieur de la plage du setup [SL ➔ BorneRange]
  orderBlocksProteges?: OrderBlockClassiqueSMC[];

  // 🔬 Métadonnées du Second Setup Fractal LTF (M15/M30 à l'intérieur de la Plage Maîtresse H4)
  estSecondSetupFractalLTF?: boolean;
  timeframeMaitreHTF?: string;
  prixSLMaitreHTF?: number;
  bornePlageMaitreHTF?: number;

  // Cycle de vie post-confirmation
  estTermine: boolean;          // Vrai si le TP ou le SL a été touché par la suite
  resultatTrade: ResultatTradeSMC; // Issue du trade ('TP_TOUCHE', 'SL_TOUCHE' ou 'EN_COURS')
  indexSortieTrade?: number;    // Index de la bougie où le TP ou le SL a été atteint
  tempsSortieTrade?: number | string; // Date de sortie du trade
}

export interface ResultatOrchestrateurSMC {
  setups: SetupOrchestreSMC[];
  primitives: VisualPrimitives;
  statistiques: {
    totalDetectes: number;
    totalConfirmes: number;
    totalActifs: number;         // Confirmés dont ni le TP ni le SL n'ont encore été touchés
    totalTPTouches: number;      // Setups ayant atteint le TP optimal
    totalSLTouches: number;      // Setups ayant touché le SL
    totalAnnules: number;
    totalEnCours: number;
    totalAchatsConfirmes: number;
    totalVentesConfirmees: number;
    ratioMoyenRR: number;
    tauxReussiteTP: number;      // % de trades gagnants parmi les terminés
  };
}

// ─── 🟦 DÉTECTION DES ORDER BLOCKS CLASSIQUES SMC PROTÉGÉS DANS LA PLAGE ─────

/**
 * Représente un Order Block Classique SMC (dernière bougie opposée avant une impulsion franche)
 * situé à l'intérieur de la plage de prix protégée d'un setup [SL ➔ BorneRange / TP].
 * Tant que le TP du setup n'est pas atteint et que l'OB n'est pas cassé, il reste protégé.
 * Le dernier OB (le plus proche du SL) est le rempart ultime ayant la plus forte probabilité de tenir.
 */
export interface OrderBlockClassiqueSMC {
  id: string;
  type: 'ACHAT' | 'VENTE';
  prixBas: number;
  prixHaut: number;
  prixMedian: number;
  indexBougieOB: number;
  tempsDebut: number | string;
  tempsFin: number | string;
  ordreHierarchie: number; // 1 = OB le plus proche de l'entrée, N = Dernier OB le plus proche du SL
  estDernierOB: boolean;   // Vrai s'il s'agit du dernier Order Block (le plus proche du SL)
  estProtege: boolean;     // Vrai tant qu'aucune bougie n'a clôturé au-delà de l'OB et que le TP n'est pas touché
}

/**
 * Détecte les Order Blocks Classiques SMC (dernière bougie rouge avant impulsion verte en Achat,
 * dernière bougie verte avant impulsion rouge en Vente) à l'intérieur de la plage de prix d'un setup.
 *
 * Exemple :
 * const obs = detecterOrderBlocksClassiquesDansPlage({
 *   bougies, indexDebutScan: 10, indexFinScan: 35,
 *   typeSetup: 'ACHAT', prixSL: 1.0800, prixHautPlage: 1.0860
 * });
 */
export function detecterOrderBlocksClassiquesDansPlage(options: {
  bougies: Bougie[];
  indexDebutScan: number;
  indexFinScan: number;
  typeSetup: 'ACHAT' | 'VENTE';
  prixSL: number;
  prixBorneOpposed: number;
}): OrderBlockClassiqueSMC[] {
  const { bougies, indexDebutScan, indexFinScan, typeSetup, prixSL, prixBorneOpposed } = options;
  if (!bougies || bougies.length < 3) return [];

  const estAchat = typeSetup === 'ACHAT';
  const minPlage = Math.min(prixSL, prixBorneOpposed);
  const maxPlage = Math.max(prixSL, prixBorneOpposed);

  const debut = Math.max(0, indexDebutScan);
  const fin = Math.min(bougies.length - 2, indexFinScan);
  const candidatsBruts: Omit<OrderBlockClassiqueSMC, 'ordreHierarchie' | 'estDernierOB'>[] = [];

  for (let i = debut; i <= fin; i++) {
    const bOB = bougies[i];
    const bImp1 = bougies[i + 1];
    const bImp2 = bougies[Math.min(bougies.length - 1, i + 2)];
    if (!bOB || !bImp1) continue;

    if (estAchat) {
      // Bullish Order Block Classique SMC :
      // Bougie baissière (rouge : close < open) suivie d'une impulsion haussière qui clôture au-dessus du High de la bougie rouge
      const estBougieOpposee = bOB.close < bOB.open;
      const impulsionCassure =
        (bImp1.close > bOB.high && bImp1.close > bImp1.open) ||
        (bImp2 && bImp2.close > bOB.high && bImp2.close > bOB.open);

      if (!estBougieOpposee || !impulsionCassure) continue;

      const prixBas = bOB.low;
      const prixHaut = Math.max(bOB.open, bOB.high);
      const prixMedian = Number(((prixBas + prixHaut) / 2).toFixed(5));

      // L'Order Block doit se situer dans la plage protégée [prixSL .. maxPlage]
      if (prixBas < minPlage - (maxPlage - minPlage) * 0.05 || prixMedian > maxPlage) continue;

      // Vérifier que cet Order Block n'a pas été cassé par une clôture sous son prixBas jusqu'à indexFinScan
      let estCasse = false;
      for (let k = i + 2; k <= Math.min(bougies.length - 1, indexFinScan); k++) {
        if (bougies[k].close < prixBas) {
          estCasse = true;
          break;
        }
      }
      if (estCasse) continue;

      candidatsBruts.push({
        id: `ob-achat-${i}`,
        type: 'ACHAT',
        prixBas,
        prixHaut,
        prixMedian,
        indexBougieOB: i,
        tempsDebut: bOB.time,
        tempsFin: bougies[Math.min(bougies.length - 1, indexFinScan)].time,
        estProtege: true,
      });
    } else {
      // Bearish Order Block Classique SMC :
      // Bougie haussière (verte : close > open) suivie d'une impulsion baissière qui clôture sous le Low de la bougie verte
      const estBougieOpposee = bOB.close > bOB.open;
      const impulsionCassure =
        (bImp1.close < bOB.low && bImp1.close < bImp1.open) ||
        (bImp2 && bImp2.close < bOB.low && bImp2.close < bOB.open);

      if (!estBougieOpposee || !impulsionCassure) continue;

      const prixBas = Math.min(bOB.open, bOB.low);
      const prixHaut = bOB.high;
      const prixMedian = Number(((prixBas + prixHaut) / 2).toFixed(5));

      // L'Order Block doit se situer dans la plage protégée [minPlage .. prixSL]
      if (prixHaut > maxPlage + (maxPlage - minPlage) * 0.05 || prixMedian < minPlage) continue;

      // Vérifier que cet Order Block n'a pas été cassé par une clôture au-dessus de son prixHaut jusqu'à indexFinScan
      let estCasse = false;
      for (let k = i + 2; k <= Math.min(bougies.length - 1, indexFinScan); k++) {
        if (bougies[k].close > prixHaut) {
          estCasse = true;
          break;
        }
      }
      if (estCasse) continue;

      candidatsBruts.push({
        id: `ob-vente-${i}`,
        type: 'VENTE',
        prixBas,
        prixHaut,
        prixMedian,
        indexBougieOB: i,
        tempsDebut: bOB.time,
        tempsFin: bougies[Math.min(bougies.length - 1, indexFinScan)].time,
        estProtege: true,
      });
    }
  }

  // Fallback : si aucun OB interne distinct n'est trouvé, la bougie B1 de liquidation du Doji elle-même constitue le Dernier Order Block !
  if (candidatsBruts.length === 0 && indexFinScan >= 1) {
    const idxDojiB1 = Math.max(0, Math.min(bougies.length - 1, indexFinScan - 3));
    const b1 = bougies[idxDojiB1];
    if (b1) {
      candidatsBruts.push({
        id: `ob-base-${idxDojiB1}`,
        type: typeSetup,
        prixBas: b1.low,
        prixHaut: b1.high,
        prixMedian: Number(((b1.low + b1.high) / 2).toFixed(5)),
        indexBougieOB: idxDojiB1,
        tempsDebut: b1.time,
        tempsFin: bougies[Math.min(bougies.length - 1, indexFinScan)].time,
        estProtege: true,
      });
    }
  }

  // Tri hiérarchique :
  // - En Achat : du plus haut (1er OB rencontré) au plus bas (Dernier OB le plus proche du SL)
  // - En Vente : du plus bas (1er OB rencontré) au plus haut (Dernier OB le plus proche du SL)
  candidatsBruts.sort((a, b) => (estAchat ? b.prixBas - a.prixBas : a.prixHaut - b.prixHaut));

  // Limiter aux 4 meilleurs Order Blocks non chevauchants pour éviter de surcharger le graphique
  const retenus = candidatsBruts.slice(0, 4);

  return retenus.map((ob, idx) => ({
    ...ob,
    ordreHierarchie: idx + 1,
    estDernierOB: idx === retenus.length - 1,
  }));
}

// ─── 🧲 CIBLE DE LIQUIDITÉ S/R ACTIF + TRAJET DE CHEVAUCHEMENT UOP ───────────

/**
 * Détails d'un Support ou d'une Résistance actif (non cassé) évalué comme cible de Take Profit
 * avec vérification du taux de chevauchement UOP sur tout le trajet [Entrée ➔ S/R].
 */
export interface InfoCibleLiquiditeSR {
  zone: ZoneShved;
  prixCible: number;
  distancePoints: number;
  tauxMoyenChevauchementTrajet: number;
  pourcentageTrajetCouvert: number;
  estTrajetValide: boolean;
  motif: string;
}

/**
 * Recherche les Supports (en VENTE) ou Résistances (en ACHAT) toujours actifs (non cassés)
 * situés en face du prix d'entrée, et vérifie pour chacun si tout le trajet [prixEntree ➔ S/R]
 * possède un bon taux de chevauchement dans le profil UOP.
 * 
 * Exemple :
 * const resSR = trouverCiblesLiquiditeSRAvecChevauchement({
 *   toutesLesZonesShved, bougies, indexHorizon: 45, typeSetup: 'ACHAT',
 *   prixEntree: 1.0850, paliersSuperposition: uop.paliersSuperposition, stepUOP: uop.step,
 *   tauxMinChevauchementTrajet: 1.5, couvertureMinPourcent: 70
 * });
 */
export function trouverCiblesLiquiditeSRAvecChevauchement(options: {
  toutesLesZonesShved: ZoneShved[];
  bougies: Bougie[];
  indexHorizon: number;
  typeSetup: 'ACHAT' | 'VENTE';
  prixEntree: number;
  paliersSuperposition: PalierSuperpositionVagues[];
  stepUOP: number;
  tauxMinChevauchementTrajet: number;
  couvertureMinPourcent: number;
  borneMaxVitesse1?: number;
}): {
  ciblesValides: InfoCibleLiquiditeSR[];
  toutesCiblesAnalysees: InfoCibleLiquiditeSR[];
} {
  const {
    toutesLesZonesShved,
    bougies,
    indexHorizon,
    typeSetup,
    prixEntree,
    paliersSuperposition,
    stepUOP,
    tauxMinChevauchementTrajet,
    couvertureMinPourcent,
    borneMaxVitesse1,
  } = options;

  const estAchat = typeSetup === 'ACHAT';
  const toutesCiblesAnalysees: InfoCibleLiquiditeSR[] = [];
  const pasSecurise = Math.max(0.00001, stepUOP || 0.0001);

  for (const zone of toutesLesZonesShved) {
    // 1️⃣ Filtrer selon la direction : en ACHAT on vise une RESISTANCE en haut, en VENTE un SUPPORT en bas
    if (estAchat && zone.type !== 'RESISTANCE') continue;
    if (!estAchat && zone.type !== 'SUPPORT') continue;

    // 2️⃣ La zone doit exister avant ou au moment de la confirmation (pas de fuite du futur)
    const indexNaissance = zone.indexOrigine ?? 0;
    if (indexNaissance > indexHorizon) continue;

    // 3️⃣ Déterminer le niveau de prix cible du S/R (entrée du mur de liquidité)
    const prixCible = estAchat
      ? (zone.prixBas > prixEntree ? zone.prixBas : zone.prixMedian)
      : (zone.prixHaut < prixEntree ? zone.prixHaut : zone.prixMedian);

    // La cible doit être devant le prix d'entrée
    if (estAchat && prixCible <= prixEntree) continue;
    if (!estAchat && prixCible >= prixEntree) continue;

    // Respect éventuel du plafond/plancher de Vitesse 1 (petite liquidité)
    if (borneMaxVitesse1 !== undefined) {
      if (estAchat && prixCible > borneMaxVitesse1) continue;
      if (!estAchat && prixCible < borneMaxVitesse1) continue;
    }

    // 4️⃣ Vérifier que le Support / Résistance est TOUJOURS ACTIF (non cassé jusqu'à indexHorizon)
    let estCasse = false;
    const finVerif = Math.min(indexHorizon, bougies.length - 1);
    for (let k = indexNaissance + 1; k <= finVerif; k++) {
      const b = bougies[k];
      if (!b) continue;
      // Une résistance est cassée si une bougie clôture au-dessus de son prixHaut
      if (estAchat && b.close > zone.prixHaut) {
        estCasse = true;
        break;
      }
      // Un support est cassé si une bougie clôture en dessous de son prixBas
      if (!estAchat && b.close < zone.prixBas) {
        estCasse = true;
        break;
      }
    }
    if (estCasse) continue;

    // 5️⃣ Vérifier le taux de chevauchement UOP sur TOUT LE TRAJET [prixEntree ➔ prixCible]
    const minTrajet = Math.min(prixEntree, prixCible);
    const maxTrajet = Math.max(prixEntree, prixCible);
    const distancePoints = maxTrajet - minTrajet;

    const nbPas = Math.max(1, Math.round(distancePoints / pasSecurise));
    let sommeTauxSurTrajet = 0;
    let nbPasCouverts = 0;
    const tolerancePrix = pasSecurise * 0.85;

    for (let i = 0; i <= nbPas; i++) {
      const prixEchantillon = nbPas === 0
        ? minTrajet
        : minTrajet + (i / nbPas) * distancePoints;

      // Recherche de la barre du profil de chevauchement couvrant ce prix
      let meilleurTauxPas = 0;
      let ecartMin = Infinity;
      for (const palier of paliersSuperposition) {
        const ecart = Math.abs(palier.prix - prixEchantillon);
        if (ecart <= tolerancePrix && ecart < ecartMin) {
          ecartMin = ecart;
          meilleurTauxPas = palier.sommeBougies;
        }
      }

      sommeTauxSurTrajet += meilleurTauxPas;
      if (meilleurTauxPas >= 1) {
        nbPasCouverts++;
      }
    }

    const totalEchantillons = nbPas + 1;
    const tauxMoyenChevauchementTrajet = Number((sommeTauxSurTrajet / totalEchantillons).toFixed(2));
    const pourcentageTrajetCouvert = Number(((nbPasCouverts / totalEchantillons) * 100).toFixed(1));

    const estTrajetValide =
      tauxMoyenChevauchementTrajet >= tauxMinChevauchementTrajet &&
      pourcentageTrajetCouvert >= couvertureMinPourcent;

    const motif = estTrajetValide
      ? `✅ Cible S/R active validée (${zone.type} @ ${prixCible.toFixed(5)} · trajet couvert à ${pourcentageTrajetCouvert}% · chevauchement moy. ${tauxMoyenChevauchementTrajet}b)`
      : `❌ Trajet vers S/R insuffisant (couvert à ${pourcentageTrajetCouvert}% < ${couvertureMinPourcent}% ou moy. ${tauxMoyenChevauchementTrajet}b < ${tauxMinChevauchementTrajet}b)`;

    toutesCiblesAnalysees.push({
      zone,
      prixCible,
      distancePoints,
      tauxMoyenChevauchementTrajet,
      pourcentageTrajetCouvert,
      estTrajetValide,
      motif,
    });
  }

  // Trier par distance croissante depuis le prix d'entrée (le S/R actif le plus proche est TP1)
  toutesCiblesAnalysees.sort((a, b) => a.distancePoints - b.distancePoints);
  const ciblesValides = toutesCiblesAnalysees.filter((c) => c.estTrajetValide);

  return {
    ciblesValides,
    toutesCiblesAnalysees,
  };
}

// ─── 🎯 FILTRE PLAGE TEMPORELLE DU TAKE PROFIT UOP ───────────────────────────

/**
 * Informations de validation et de contexte de la plage TP associée à un setup SMC
 */
export interface InfoValidationPlageTP {
  estValide: boolean;
  motif: string;
  prixTP: number;
  bougieTPIndex?: number;
  bougieTPTemps?: number | string;
  prixExtremePlage?: number;
  prixExtremeDoji?: number;
}

/**
 * Recherche dans le passé la première bougie antérieure dont le range (Low..High)
 * contient le niveau de prix du Take Profit (TP).
 * 
 * Exemple :
 * const repere = trouverBougieContenantPrixTP(bougies, indexDoji, 1.0925, 100);
 * if (repere) console.log('Bougie TP trouvée à l\'index :', repere.index);
 */
export function trouverBougieContenantPrixTP(
  bougies: Bougie[],
  indexDoji: number,
  prixTP: number,
  maxRecul: number = 100
): { index: number; temps: number | string; prix: number } | null {
  const debutScan = Math.max(0, indexDoji - 2);
  const finScan = Math.max(0, indexDoji - 2 - maxRecul);

  // 1️⃣ Recherche de la première bougie antérieure dont le range traverse le prix du TP
  for (let k = debutScan; k >= finScan; k--) {
    const b = bougies[k];
    if (b.low <= prixTP && b.high >= prixTP) {
      return { index: k, temps: b.time, prix: prixTP };
    }
  }

  // 2️⃣ Secours : si aucune bougie ne traverse exactement le cours, on cherche celle dont
  // l'amplitude est la plus proche du prix TP
  let plusProcheIndex = -1;
  let ecartMin = Infinity;
  for (let k = debutScan; k >= finScan; k--) {
    const b = bougies[k];
    const ecart = Math.min(Math.abs(b.high - prixTP), Math.abs(b.low - prixTP));
    if (ecart < ecartMin) {
      ecartMin = ecart;
      plusProcheIndex = k;
    }
  }

  if (plusProcheIndex >= 0) {
    const b = bougies[plusProcheIndex];
    return { index: plusProcheIndex, temps: b.time, prix: prixTP };
  }

  return null;
}

/**
 * 🎯 Vérifie si le Doji personnalisé valide les critères de la Plage TP UOP.
 * 
 * Règle de l'extrême absolu sur la plage temporelle [Bougie TP -> Doji] :
 * - Setup ACHAT (Spring) : Le Low du Doji (Math.min(b1.low, b2.low)) doit être
 *   le prix le plus bas de TOUTE la plage entre la bougie contenant le TP et le Doji.
 * - Setup VENTE (UTAD) : Le High du Doji (Math.max(b1.high, b2.high)) doit être
 *   le prix le plus haut de TOUTE la plage entre la bougie contenant le TP et le Doji.
 * 
 * Exemple :
 * const verif = validerDojiAvecPlageTP(bougies, indexDoji, 'ACHAT', 1.0920, 100);
 * if (!verif.estValide) console.log(verif.motif);
 */
export function validerDojiAvecPlageTP(
  bougies: Bougie[],
  indexBougie2: number,
  typeSetup: 'ACHAT' | 'VENTE',
  prixTP: number,
  maxRecul: number = 100
): {
  estValide: boolean;
  motif: string;
  prixTP: number;
  bougieTPIndex?: number;
  bougieTPTemps?: number | string;
  prixExtremePlage?: number;
  prixExtremeDoji?: number;
} {
  const indexB1 = indexBougie2 - 1;
  const b1 = bougies[indexB1];
  const b2 = bougies[indexBougie2];

  if (!b1 || !b2) {
    return { estValide: false, motif: 'Bougies du Doji introuvables', prixTP };
  }

  // 1️⃣ Trouver la bougie dans le passé contenant le prix du TP
  const repereTP = trouverBougieContenantPrixTP(bougies, indexBougie2, prixTP, maxRecul);
  if (!repereTP) {
    return {
      estValide: false,
      motif: `Rejeté : aucune bougie antérieure contenant le prix TP (${prixTP}) trouvée dans les ${maxRecul} bougies de recul`,
      prixTP,
    };
  }

  const margeFlottante = 1e-6;

  // 2️⃣ Vérifier que le Doji est l'extrême absolu de toute la plage [repereTP.index -> indexBougie2]
  if (typeSetup === 'ACHAT') {
    const lowDoji = Math.min(b1.low, b2.low);
    let plusBasPlage = Infinity;
    let indexPlusBas = -1;

    for (let k = repereTP.index; k <= indexBougie2; k++) {
      if (bougies[k].low < plusBasPlage) {
        plusBasPlage = bougies[k].low;
        indexPlusBas = k;
      }
    }

    const estExtremeDoji = (lowDoji <= plusBasPlage + margeFlottante);

    if (!estExtremeDoji) {
      return {
        estValide: false,
        motif: `Rejeté par filtre Plage TP : le Low du Doji (${lowDoji}) n'est pas le plus bas absolu de la plage (${plusBasPlage} à la bougie #${indexPlusBas})`,
        prixTP,
        bougieTPIndex: repereTP.index,
        bougieTPTemps: repereTP.temps,
        prixExtremePlage: plusBasPlage,
        prixExtremeDoji: lowDoji,
      };
    }

    return {
      estValide: true,
      motif: `✅ Validé par filtre Plage TP : creux ultime de la plage depuis le TP (bougie #${repereTP.index})`,
      prixTP,
      bougieTPIndex: repereTP.index,
      bougieTPTemps: repereTP.temps,
      prixExtremePlage: plusBasPlage,
      prixExtremeDoji: lowDoji,
    };
  } else {
    // VENTE : High du Doji doit être le plus haut de toute la plage
    const highDoji = Math.max(b1.high, b2.high);
    let plusHautPlage = -Infinity;
    let indexPlusHaut = -1;

    for (let k = repereTP.index; k <= indexBougie2; k++) {
      if (bougies[k].high > plusHautPlage) {
        plusHautPlage = bougies[k].high;
        indexPlusHaut = k;
      }
    }

    const estExtremeDoji = (highDoji >= plusHautPlage - margeFlottante);

    if (!estExtremeDoji) {
      return {
        estValide: false,
        motif: `Rejeté par filtre Plage TP : le High du Doji (${highDoji}) n'est pas le plus haut absolu de la plage (${plusHautPlage} à la bougie #${indexPlusHaut})`,
        prixTP,
        bougieTPIndex: repereTP.index,
        bougieTPTemps: repereTP.temps,
        prixExtremePlage: plusHautPlage,
        prixExtremeDoji: highDoji,
      };
    }

    return {
      estValide: true,
      motif: `✅ Validé par filtre Plage TP : sommet ultime de la plage depuis le TP (bougie #${repereTP.index})`,
      prixTP,
      bougieTPIndex: repereTP.index,
      bougieTPTemps: repereTP.temps,
      prixExtremePlage: plusHautPlage,
      prixExtremeDoji: highDoji,
    };
  }
}

// ─── ⚡ MOTEUR D'ÉNERGIE & PORTÉE DYNAMIQUE UOP (CARBURANT VS FRICTION) ─────────

export interface ResultatCarburantLiquidation {
  carburantTotal: number;
  pointsRetests: number;
  multiplicateurMeche: number;
}

/**
 * Calcule le réservoir de carburant initial (liquidité engrangée lors de la liquidation)
 * en combinant la liquidité des retests passés du S/R et la profondeur de la mèche de balayage.
 * 
 * Formule :
 * Carburant = PointsRetests * MultiplicateurMeche
 * 
 * Exemple :
 * const res = calculerCarburantLiquidation({
 *   nombreRetests: 3,
 *   profondeurMeche: 0.0025,
 *   hauteurMoyenne: 0.0018
 * });
 * console.log('Carburant engrangé :', res.carburantTotal); // 450 pts
 */
export function calculerCarburantLiquidation(options: {
  nombreRetests: number;
  profondeurMeche: number;
  hauteurMoyenne: number;
  pointsParRetest?: number;
  plafondCarburantRetests?: number;
  bonusMecheProfonde?: number;
  bonusMecheNormale?: number;
  collinesRetests?: DetailCollineRetest[];
}): ResultatCarburantLiquidation {
  const {
    nombreRetests,
    profondeurMeche,
    hauteurMoyenne,
    pointsParRetest = 100,
    plafondCarburantRetests = 400,
    bonusMecheProfonde = 1.6,
    bonusMecheNormale = 1.3,
    collinesRetests,
  } = options;

  // 1️⃣ Barème configurable des retests S/R ([COND-ENERGIE-01])
  // Si les collines détaillées sont fournies, on pondère chaque retest selon l'ampleur de sa colline
  // (MINEURE = 0.6x, SOLIDE = 1.0x, MAJEURE = 1.5x pointsParRetest)
  let pointsRetests = pointsParRetest;
  if (collinesRetests && collinesRetests.length > 0) {
    const sommeCarburantCollines = collinesRetests.reduce((acc, colline) => {
      const facteurColline =
        colline.qualite === 'MAJEURE' ? 1.5 : colline.qualite === 'SOLIDE' ? 1.0 : 0.6;
      return acc + Math.round(pointsParRetest * facteurColline);
    }, 0);
    pointsRetests = Math.min(plafondCarburantRetests, sommeCarburantCollines);
  } else if (nombreRetests <= 0) {
    pointsRetests = Math.round(pointsParRetest * 0.8);
  } else {
    // Calcul proportionnel au nombre de retests avec plafond paramétrable
    pointsRetests = Math.min(plafondCarburantRetests, nombreRetests * pointsParRetest);
  }

  // 2️⃣ Multiplicateur configurable de pénétration de la mèche ([COND-ENERGIE-02])
  const atrSecurise = Math.max(0.00001, hauteurMoyenne);
  const ratioMecheAtr = Math.max(0, profondeurMeche) / atrSecurise;

  let multiplicateurMeche = 1.0;
  if (ratioMecheAtr > 1.2) {
    multiplicateurMeche = bonusMecheProfonde; // Pénétration profonde (chasse aux stops massive)
  } else if (ratioMecheAtr >= 0.5) {
    multiplicateurMeche = bonusMecheNormale; // Pénétration classique
  } else {
    multiplicateurMeche = 1.0; // Effleurement superficiel
  }

  // 3️⃣ Carburant Total Initial ([COND-ENERGIE-03])
  const carburantTotal = Math.round(pointsRetests * multiplicateurMeche);

  return {
    carburantTotal,
    pointsRetests,
    multiplicateurMeche,
  };
}

/**
 * Calcule le Score de Prise de Liquidité (sur 100 points) et pilote la Boîte de Vitesses (3 vitesses)
 * pour adapter le ZigZag et le nombre de vagues superposées dans l'UOP.
 *
 * Pourquoi cette fonction existe :
 * Plus un Support/Résistance a accumulé d'ordres (retests avec collines, ancienneté, mèche profonde),
 * plus le marché a de carburant pour parcourir de grandes vagues. À l'inverse, sur une petite prise
 * de liquidité locale, le ZigZag doit zoomer sur des micro-vagues (depth 2-3, 2 vagues max) pour
 * proposer un TP1 court, réaliste et atteignable.
 *
 * Barème sur 100 points (3 critères) :
 *   1️⃣ Critère 1 — Retests et Collines du S/R (sur 50 points : 0=0pt, 1=15pts, 2=30pts, 3+=50pts)
 *   2️⃣ Critère 2 — Durée de vie / Importance du S/R (sur 25 points : <15b=5pts, 15-40b=15pts, >40b=25pts)
 *   3️⃣ Critère 3 — Profondeur du Balayage / Mèche (sur 25 points : <0.4x ATR=5pts, 0.4-1.0x=15pts, >1.0x=25pts)
 *
 * Boîte de Vitesses Automatique :
 *   🟢 Vitesse 1 (0 à 39 pts)  ➔ Micro-Vagues (depth 2-3, backstep 1, 2 vagues max, garde-fou dernière vague)
 *   🟡 Vitesse 2 (40 à 69 pts) ➔ Vagues Moyennes (depth 5-7, backstep 2, 3 vagues)
 *   🔥 Vitesse 3 (70 à 100 pts)➔ Grandes Vagues (depth 9-14+, backstep 3, 4 vagues)
 *
 * Exemple d'utilisation :
 * const scoreZigZag = calculerScoreLiquidationZigZag({
 *   profondeurMeche: 0.0020,
 *   hauteurMoyenne: 0.0015,
 *   amplitudeBougieSweep: 0.0032,
 *   epaisseurZoneSR: 0.0012,
 *   nombreRetests: 3,
 *   dureeVieBougiesSR: 45,
 * });
 * console.log(scoreZigZag.scoreTotal); // 100
 * console.log(scoreZigZag.vitesseRetenue); // 3 (Grandes Vagues)
 */
export function calculerScoreLiquidationZigZag(options: {
  profondeurMeche: number;
  hauteurMoyenne: number;
  amplitudeBougieSweep: number;
  epaisseurZoneSR: number;
  nombreRetests: number;
  collinesRetests?: DetailCollineRetest[];
  dureeVieBougiesSR?: number;
  zigzagDepthMin?: number;
  zigzagDepthMax?: number;
}): DetailsScoreLiquidationZigZag {
  // 1️⃣ Sécurisation des valeurs d'entrée pour éviter toute division par zéro
  const atrSecurise = Math.max(0.00001, options.hauteurMoyenne);
  const depthMin = Math.max(1, Math.min(8, Math.round(options.zigzagDepthMin ?? 1)));
  const depthMax = Math.max(depthMin, Math.min(8, Math.round(options.zigzagDepthMax ?? 8)));
  const nbRetests =
    options.collinesRetests !== undefined
      ? options.collinesRetests.length
      : Math.max(0, Math.round(options.nombreRetests));

  // Calcul des ratios de la liquidation (notre Doji personnalisé) par rapport à la moyenne des bougies (ATR)
  const ratioProfondeurATR = Number((Math.max(0, options.profondeurMeche) / atrSecurise).toFixed(2));
  const ratioTailleBougieATR = Number((Math.max(0, options.amplitudeBougieSweep) / atrSecurise).toFixed(2));
  const ratioEpaisseurZoneATR = Number((Math.max(0, options.epaisseurZoneSR) / atrSecurise).toFixed(2));

  // 2️⃣ CALCUL 100% BASÉ UNIQUEMENT SUR LA TAILLE DU DOJI (ratioTailleBougieATR)
  // On ignore volontairement les retests du S/R et la mèche de cassure pour éviter de gonfler zigzagDepth :
  // - Petit Doji (< 1.4x ATR)        ➔ zigzagDepth = 1
  // - Doji standard (1.4x à 1.8x)    ➔ zigzagDepth = 2
  // - Doji moyen (1.8x à 2.2x)       ➔ zigzagDepth = 3
  // - Beau Doji (2.2x à 2.6x)        ➔ zigzagDepth = 4
  // - Grand Doji (2.6x à 3.0x)       ➔ zigzagDepth = 5
  // - Très grand Doji (3.0x à 3.4x)  ➔ zigzagDepth = 6
  // - Doji massif (3.4x à 3.8x)      ➔ zigzagDepth = 7
  // - Doji géant (>= 3.8x ATR)       ➔ zigzagDepth = 8
  const progressionDepth = Math.max(0, Math.min(1, (ratioTailleBougieATR - 1.2) / 2.8));
  const zigzagDepthRetenu = Math.max(
    depthMin,
    Math.min(depthMax, Math.round(depthMin + progressionDepth * (depthMax - depthMin)))
  );

  const scoreTotal = Math.round(10 + progressionDepth * 90);
  const pointsTailleBougieEtZone = scoreTotal;
  const pointsRetestsSR = 0;
  const pointsProfondeurCassure = 0;

  let vitesseRetenue: 1 | 2 | 3 = 2;
  let categorieVagues: 'PETITES_VAGUES' | 'VAGUES_MOYENNES' | 'GRANDES_VAGUES' = 'VAGUES_MOYENNES';
  let zigzagBackstepRetenu = 2;
  // On superpose toujours les 10 dernières vagues (V1 à V10 lues de droite à gauche)
  const nbVaguesSuperposeesRetenu = 10;
  const plafondDerniereVagueActif = false;

  if (zigzagDepthRetenu <= 3) {
    // 🟢 VITESSE 1 : Petit / Moyen Doji (Depth 1 à 3) ➔ Micro-Vagues (10 vagues superposées)
    vitesseRetenue = 1;
    categorieVagues = 'PETITES_VAGUES';
    zigzagBackstepRetenu = 1;
  } else if (zigzagDepthRetenu <= 5) {
    // 🟡 VITESSE 2 : Grand Doji (Depth 4 à 5) ➔ Vagues Moyennes (10 vagues superposées)
    vitesseRetenue = 2;
    categorieVagues = 'VAGUES_MOYENNES';
    zigzagBackstepRetenu = 2;
  } else {
    // 🔥 VITESSE 3 : Très Grand Doji (Depth 6 à 8) ➔ Grandes Vagues (10 vagues superposées)
    vitesseRetenue = 3;
    categorieVagues = 'GRANDES_VAGUES';
    zigzagBackstepRetenu = 3;
  }

  const labelCategorie =
    categorieVagues === 'GRANDES_VAGUES'
      ? 'Vitesse 3 : Grandes Vagues'
      : categorieVagues === 'VAGUES_MOYENNES'
        ? 'Vitesse 2 : Vagues Moyennes'
        : 'Vitesse 1 : Micro-Vagues';

  const resumeExplication = `Taille Doji: ${ratioTailleBougieATR}x ATR (Score: ${scoreTotal}/100) ➔ ${labelCategorie} (ZigZag Depth: ${zigzagDepthRetenu}, ${nbVaguesSuperposeesRetenu} vagues)`;

  return {
    scoreTotal,
    pointsProfondeurCassure,
    pointsTailleBougieEtZone,
    pointsRetestsSR,
    ratioProfondeurATR,
    ratioTailleBougieATR,
    ratioEpaisseurZoneATR,
    dureeVieBougiesSR: options.dureeVieBougiesSR,
    nombreRetests: nbRetests,
    vitesseRetenue,
    zigzagDepthRetenu,
    zigzagBackstepRetenu,
    nbVaguesSuperposeesRetenu,
    plafondDerniereVagueActif,
    zigzagDepthMin: depthMin,
    zigzagDepthMax: depthMax,
    categorieVagues,
    resumeExplication,
  };
}

export interface ResultatPorteeDynamique {
  prixTPOptimal: number;
  ordreTP: number;
  carburantInitial: number;
  carburantRestant: number;
  paliersTraverses: number;
  palierBloquant?: TPOptimalUOP;
  estLimiteParPalier: boolean;
  distancePoints: number;
  paliersAnalyses: PalierUOPAnalyse[];
  etapesDetails: EtapePalierUOPDetail[];
}

/**
 * ==============================================================================
 * 🚀 MOTEUR D'ÉNERGIE & DÉTERMINATION DU TAKE PROFIT OPTIMAL (TP1 vs TP2)
 * ==============================================================================
 * 
 * 💡 COMMENT L'ORCHESTRATEUR CHOISIT-IL ENTRE TP1 ET TP2 ?
 * 
 * Lorsque l'indicateur UOP fournit la liste des cibles potentielles :
 *   • `TP1` = Premier corridor de liquidité goudronnée (cible sécurisée et rapide).
 *   • `TP2` = Deuxième corridor de liquidité situé au-delà du premier grand trou (grand mouvement).
 * 
 * Le Chef d'Orchestre SMC détermine le **TP Optimal** selon 2 modes possibles :
 * 
 * ──────────────────────────────────────────────────────────────────────────────
 * 🔹 MODE 1 : LE MODÈLE D'ÉNERGIE & FRICTION (`modeCalculTP = 'ENERGIE_FRICTION'`, DÉFAUT)
 * ──────────────────────────────────────────────────────────────────────────────
 * Ce modèle simule la physique réelle du carnet d'ordres :
 * 
 * 1. ⛽ PRODUCTION DU CARBURANT INITIAL (Réservoir B0 issu du balayage de liquidité) :
 *    - `pointsRetests` = `nombreRetests * pointsParRetest` (défaut: 100 pts/retest, max 400 pts).
 *    - `multiplicateurMeche` :
 *        • Mèche profonde (> 1.2 x ATR)   ➔ x1.6 (liquidation massive d'ordres stop).
 *        • Mèche normale (0.5 à 1.2 x ATR) ➔ x1.3.
 *        • Mèche courte (< 0.5 x ATR)      ➔ x1.0.
 *    - Carburant Total = `pointsRetests * multiplicateurMeche` (ex: 3 retests * 100 * 1.6 = 480 pts).
 * 
 * 2. 🛣️ CONSOMMATION CONTINUE PENDANT LA TRAJECTOIRE (Friction) :
 *    - Le prix avance vers le TP et consomme du carburant selon la distance franchie (en ATR) :
 *        • `coutParATR` (défaut: 50 pts/ATR).
 *        • Multiplié par le type de terrain : x0.5 (fort overlap / autoroute), x1.0 (moyen), x2.0 (zone vierge).
 * 
 * 3. 🛑 PÉAGE DE PERCÉE DU TP1 & ACCÈS AU TP2 :
 *    - Lorsqu'il arrive au niveau du premier palier non-mitigé (TP1) :
 *        • **Péage requis** : `peagePalierUOP = 100 points`.
 *        • **SI Budget Restant >= 100 pts** :
 *            ➔ Le palier TP1 est **PERCÉ** ✅ ! Le marché absorbe l'obstacle.
 *            ➔ Le prix continue sa route et **VISE LE TP2** !
 *        • **SI Budget Restant < 100 pts** :
 *            ➔ Le palier TP1 forme un **MUR INFRANCHISSABLE** 🛑 !
 *            ➔ Le TP Optimal est ancré **juste devant le palier TP1** avec une marge de sécurité
 *              (`margeSecuriteDevantPalier = 15% d'ATR`).
 * 
 * 4. 🚀 ATTEINTE DU TP2 :
 *    - Si le prix a percé TP1 et a encore assez de carburant pour payer la distance jusqu'à TP2,
 *      le TP Optimal devient **TP2** !
 * 
 * ──────────────────────────────────────────────────────────────────────────────
 * 🔹 MODE 2 : LE MODÈLE STANDARD PAR SCORE SHVED (`modeCalculTP = 'SCORE_SHVED'`)
 * ──────────────────────────────────────────────────────────────────────────────
 * Basé sur une règle proportionnelle simple :
 *   • Si `scoreShved >= seuilScoreGrandMouvement` (défaut: 70 points) :
 *       ➔ Liquidité majeure balayée ➔ On vise directement le **TP2** !
 *   • Si `scoreShved < 70 points` :
 *       ➔ Liquidité mineure ➔ On sécurise sur le **TP1**.
 * 
 * ──────────────────────────────────────────────────────────────────────────────
 * ⚙️ LISTE DES VARIABLES CLÉS POUR AJUSTER TP1 / TP2 DANS VOS TESTS :
 * ──────────────────────────────────────────────────────────────────────────────
 * • `peagePalierUOP` (défaut: 100 pts) :
 *     - Si abaissé à 50 : TP1 est percé beaucoup plus facilement ➔ vise plus souvent TP2.
 *     - Si augmenté à 200 : TP1 est très dur à percer ➔ s'arrête presque toujours à TP1.
 * 
 * • `pointsParRetest` (défaut: 100 pts) :
 *     - Quantité de carburant ajoutée par retest sur le support/résistance.
 * 
 * • `bonusMecheProfonde` (défaut: 1.6x) :
 *     - Multiplicateur de carburant accordé aux mèches de balayage profondes.
 * 
 * • `seuilScoreGrandMouvement` (défaut: 70 pts) :
 *     - Seuil du score Shved pour basculer de TP1 vers TP2 dans le modèle standard.
 * 
 * • `margeSecuriteDevantPalier` (défaut: 0.15, soit 15% d'ATR) :
 *     - Distance de sécurité avant un mur bloquant pour garantir l'exécution de l'ordre.
 * ==============================================================================
 */
export function calculerPorteeDynamiqueUOP(options: {
  prixEntree: number;
  prixSL: number;
  direction: 'ACHAT' | 'VENTE';
  carburantInitial: number;
  tpsCandidats: TPOptimalUOP[];
  hauteurMoyenne: number;
  peagePalierUOP?: number;
  coutParATR?: number;
  coutFrictionFortOverlap?: number;
  coutFrictionMoyenOverlap?: number;
  coutFrictionFaibleOverlap?: number;
  seuilFortOverlap?: number;
  seuilFaibleOverlap?: number;
  margeSecuriteDevantPalier?: number;
}): ResultatPorteeDynamique {
  const {
    prixEntree,
    prixSL,
    direction,
    carburantInitial,
    tpsCandidats,
    hauteurMoyenne,
    peagePalierUOP = 100,
    coutParATR = 50,
    coutFrictionFortOverlap = 0.5,
    coutFrictionMoyenOverlap = 1.0,
    coutFrictionFaibleOverlap = 2.0,
    seuilFortOverlap = 4.0,
    seuilFaibleOverlap = 2.0,
    margeSecuriteDevantPalier = 0.15,
  } = options;

  const estAchat = direction === 'ACHAT';
  const distanceSL = Math.max(0.0001, Math.abs(prixEntree - prixSL));
  const atrSecurise = Math.max(0.0001, hauteurMoyenne);

  // Cas de secours : si aucun palier UOP n'a été trouvé
  if (!tpsCandidats || tpsCandidats.length === 0) {
    const facteurSecours = Math.max(1.5, Number((carburantInitial / 150).toFixed(2)));
    const prixSecours = estAchat
      ? prixEntree + distanceSL * facteurSecours
      : prixEntree - distanceSL * facteurSecours;

    return {
      prixTPOptimal: Number(prixSecours.toFixed(5)),
      ordreTP: 1,
      carburantInitial,
      carburantRestant: 0,
      paliersTraverses: 0,
      estLimiteParPalier: false,
      distancePoints: Math.abs(prixSecours - prixEntree),
      paliersAnalyses: [],
      etapesDetails: [],
    };
  }

  // Trier les paliers par distance croissante depuis le prix d'entrée
  const paliersTries = [...tpsCandidats].sort((a, b) => {
    return Math.abs(a.prixCible - prixEntree) - Math.abs(b.prixCible - prixEntree);
  });

  const paliersAnalyses: PalierUOPAnalyse[] = [];
  const etapesDetails: EtapePalierUOPDetail[] = [];
  let budgetRestant = carburantInitial;
  let prixDernierPoint = prixEntree;
  let paliersTraverses = 0;
  let prixTPOptimal = paliersTries[0].prixCible;
  let ordreTP = 1;
  let palierBloquant: TPOptimalUOP | undefined;
  let estLimiteParPalier = false;

  for (let i = 0; i < paliersTries.length; i++) {
    const palier = paliersTries[i];
    const distancePalier = Math.abs(palier.prixCible - prixDernierPoint);
    const budgetAvant = Math.round(budgetRestant);

    // 1️⃣ Consommation continue selon la distance franchie (en unités ATR) ([COND-FRICTION-01])
    let multiplicateurFriction = coutFrictionMoyenOverlap;
    if (palier.tauxMoyenChevauchement >= seuilFortOverlap) {
      multiplicateurFriction = coutFrictionFortOverlap; // Autoroute fluide (fort overlap)
    } else if (palier.tauxMoyenChevauchement < seuilFaibleOverlap) {
      multiplicateurFriction = coutFrictionFaibleOverlap; // Zone vierge (faible overlap)
    }

    const consommationDistance = (distancePalier / atrSecurise) * coutParATR * multiplicateurFriction;
    const consoArrondie = Math.round(consommationDistance);
    budgetRestant -= consommationDistance;

    // Si le budget est épuisé avant même d'atteindre le palier
    if (budgetRestant <= 0) {
      const proportionRestante = Math.max(0.1, (budgetRestant + consommationDistance) / consommationDistance);
      const avanceeReelle = distancePalier * proportionRestante;
      prixTPOptimal = estAchat ? prixDernierPoint + avanceeReelle : prixDernierPoint - avanceeReelle;
      palierBloquant = palier;
      estLimiteParPalier = true;

      // Palier bloquant (mur infranchissable faute de carburant en chemin)
      paliersAnalyses.push({
        prix: palier.prixCible,
        ordre: i + 1,
        estPerce: false,
        estBloquant: true,
        tauxChevauchement: palier.tauxMoyenChevauchement,
      });

      etapesDetails.push({
        ordre: i + 1,
        prixCible: palier.prixCible,
        distancePoints: Number(distancePalier.toFixed(5)),
        tauxChevauchement: Number(palier.tauxMoyenChevauchement.toFixed(2)),
        consommationDistance: consoArrondie,
        peagePalier: peagePalierUOP,
        budgetAvant,
        budgetApres: 0,
        estPerce: false,
        estBloquant: true,
        explication: `Carburant épuisé en chemin (${budgetAvant} pts disponibles vs ${consoArrondie} pts de friction requis).`,
      });
      break;
    }

    // 2️⃣ Péage de franchissement du palier non-mitigé ([COND-FRICTION-02])
    if (budgetRestant >= peagePalierUOP) {
      // ✅ Palier percé !
      budgetRestant -= peagePalierUOP;
      paliersTraverses++;
      prixDernierPoint = palier.prixCible;
      prixTPOptimal = palier.prixCible;
      ordreTP = i + 1;

      // Enregistrement du palier percé avec succès
      paliersAnalyses.push({
        prix: palier.prixCible,
        ordre: i + 1,
        estPerce: true,
        estBloquant: false,
        tauxChevauchement: palier.tauxMoyenChevauchement,
      });

      etapesDetails.push({
        ordre: i + 1,
        prixCible: palier.prixCible,
        distancePoints: Number(distancePalier.toFixed(5)),
        tauxChevauchement: Number(palier.tauxMoyenChevauchement.toFixed(2)),
        consommationDistance: consoArrondie,
        peagePalier: peagePalierUOP,
        budgetAvant,
        budgetApres: Math.round(budgetRestant),
        estPerce: true,
        estBloquant: false,
        explication: `Palier percé avec succès ! Déduction : ${consoArrondie} pts (friction) + ${peagePalierUOP} pts (péage). Reste ${Math.round(budgetRestant)} pts.`,
      });
    } else {
      // 🛑 Le mur est trop épais ! On ancre le TP juste devant le palier ([COND-FRICTION-03])
      const margeSecurite = atrSecurise * margeSecuriteDevantPalier;
      prixTPOptimal = estAchat
        ? Math.max(prixEntree, palier.prixCible - margeSecurite)
        : Math.min(prixEntree, palier.prixCible + margeSecurite);

      palierBloquant = palier;
      estLimiteParPalier = true;
      ordreTP = i + 1;

      // Enregistrement du palier comme mur bloquant
      paliersAnalyses.push({
        prix: palier.prixCible,
        ordre: i + 1,
        estPerce: false,
        estBloquant: true,
        tauxChevauchement: palier.tauxMoyenChevauchement,
      });

      etapesDetails.push({
        ordre: i + 1,
        prixCible: palier.prixCible,
        distancePoints: Number(distancePalier.toFixed(5)),
        tauxChevauchement: Number(palier.tauxMoyenChevauchement.toFixed(2)),
        consommationDistance: consoArrondie,
        peagePalier: peagePalierUOP,
        budgetAvant,
        budgetApres: Math.round(budgetRestant),
        estPerce: false,
        estBloquant: true,
        explication: `Mur infranchissable ! Carburant restant (${Math.round(budgetRestant)} pts) < Péage (${peagePalierUOP} pts). TP ancré avec marge.`,
      });
      break;
    }
  }

  // 3️⃣ Si tous les paliers sont percés et qu'il reste encore du carburant
  if (!estLimiteParPalier && budgetRestant > 0 && paliersTraverses === paliersTries.length) {
    const palierMax = paliersTries[paliersTries.length - 1];
    const distanceSupplementaire = (budgetRestant / coutParATR) * atrSecurise * 0.5;
    prixTPOptimal = estAchat
      ? palierMax.prixCible + distanceSupplementaire
      : palierMax.prixCible - distanceSupplementaire;
  }

  const distancePoints = Math.abs(prixTPOptimal - prixEntree);

  return {
    prixTPOptimal: Number(prixTPOptimal.toFixed(5)),
    ordreTP,
    carburantInitial,
    carburantRestant: Math.max(0, Math.round(budgetRestant)),
    paliersTraverses,
    palierBloquant,
    estLimiteParPalier,
    distancePoints,
    paliersAnalyses,
    etapesDetails,
  };
}

// ─── 🚀 Fonction Principale de l'Indicateur Chef d'Orchestre ───────────────────

/**
 * Exécute l'orchestration complète :
 * 1. Détecte les Dojis & Plages temporelles.
 * 2. Récupère le score de liquidité Shved de la zone balayée.
 * 3. Valide le Range de confirmation des 3 bougies consécutives.
 * 4. Calcule le TP Optimal UOP proportionnel au score de liquidité.
 * 5. Suit l'état du trade dans les bougies suivantes (TP ou SL touché).
 * 6. Épure le graphique : masque automatiquement les setups déjà passés (TP ou SL touché)
 *    pour ne garder que les trades vivants et actifs !
 * 
 * Exemple d'utilisation :
 * ```typescript
 * const res = calculerOrchestrateurSMC(bougies, {
 *   modeVisuel: 'EPURE',
 *   masquerSetupsTermines: true,
 *   nbBougiesConfirmation: 3
 * });
 * console.log('Setups actifs en cours :', res.statistiques.totalActifs);
 * ```
 */
// Cache mémoire ultra-rapide pour le calcul Maître HTF en mode Cockpit Fractal LTF
let cacheMaitreHTF: {
  cle: string;
  resultat: ResultatOrchestrateurSMC;
} | null = null;

/**
 * Retourne la durée en secondes d'une unité de temps (ex: '4h' -> 14400, '1h' -> 3600)
 * Exemple : obtenirDureeTimeframeSecondes('4h') -> 14400
 */
function obtenirDureeTimeframeSecondes(tf: string): number {
  const clean = tf.trim().toLowerCase();
  if (clean === '1m' || clean === 'm1') return 60;
  if (clean === '5m' || clean === 'm5') return 300;
  if (clean === '15m' || clean === 'm15') return 900;
  if (clean === '30m' || clean === 'm30') return 1800;
  if (clean === '1h' || clean === 'h1') return 3600;
  if (clean === '4h' || clean === 'h4') return 14400;
  if (clean === '1d' || clean === 'd1' || clean === 'daily') return 86400;
  return 14400;
}

/**
 * Recherche par dichotomie (O(log N)) le dernier index dont le timestamp (en ms) est <= tempsCibleMs.
 * Évite de parcourir linéairement des centaines de milliers de bougies.
 * Exemple : trouverDernierIndexAvantTempsMs(bougies, 1700000000000)
 */
function trouverDernierIndexAvantTempsMs(bougies: Bougie[], tempsCibleMs: number): number {
  let gauche = 0;
  let droite = bougies.length - 1;
  let resultat = -1;
  while (gauche <= droite) {
    const milieu = (gauche + droite) >>> 1;
    const tMs = convertirTempsEnMs(bougies[milieu].time);
    if (tMs <= tempsCibleMs) {
      resultat = milieu;
      gauche = milieu + 1;
    } else {
      droite = milieu - 1;
    }
  }
  return resultat;
}

export function calculerOrchestrateurSMC(
  bougies: Bougie[],
  parametres: ParametresOrchestrateurSMC = {}
): ResultatOrchestrateurSMC {
  const labels: VisualLabel[] = [];
  const lignes: VisualLine[] = [];
  const boites: VisualBox[] = [];
  const points: VisualPoint[] = [];

  const resultatVide: ResultatOrchestrateurSMC = {
    setups: [],
    primitives: { labels, lignes, boites, points },
    statistiques: {
      totalDetectes: 0,
      totalConfirmes: 0,
      totalActifs: 0,
      totalTPTouches: 0,
      totalSLTouches: 0,
      totalAnnules: 0,
      totalEnCours: 0,
      totalAchatsConfirmes: 0,
      totalVentesConfirmees: 0,
      ratioMoyenRR: 0,
      tauxReussiteTP: 0,
    },
  };

  if (!bougies || bougies.length < 15) return resultatVide;

  // 1️⃣ Options et Réglages
  const nbBougiesConfirmation = Math.max(1, Number(parametres.nbBougiesConfirmation ?? 3));
  const afficherSetupsAnnules = Boolean(parametres.afficherSetupsAnnules);
  const bornerRangeConfirmationParAmplitudeDoji = parametres.bornerRangeConfirmationParAmplitudeDoji !== false; // Actif par défaut !
  const typeVerificationBorneRange = parametres.typeVerificationBorneRange || 'CLOTURE';
  const multiplicateurAmplitudeBorneRange = Math.max(0.1, Number(parametres.multiplicateurAmplitudeBorneRange ?? 1.0));
  const masquerSetupsTermines = parametres.masquerSetupsTermines !== false; // Actif par défaut !
  const modeCalculTP = parametres.modeCalculTP || 'ENERGIE_FRICTION'; // Moteur d'énergie actif par défaut !

  // 🚀 Variables Externes du Moteur d'Énergie & Coût des Péages UOP
  const peagePalierUOP = Math.max(0, Number(parametres.peagePalierUOP ?? 100));
  const coutParATR = Math.max(1, Number(parametres.coutParATR ?? 50));
  const coutFrictionFortOverlap = Math.max(0.01, Number(parametres.coutFrictionFortOverlap ?? 0.5));
  const coutFrictionMoyenOverlap = Math.max(0.01, Number(parametres.coutFrictionMoyenOverlap ?? 1.0));
  const coutFrictionFaibleOverlap = Math.max(0.01, Number(parametres.coutFrictionFaibleOverlap ?? 2.0));
  const seuilFortOverlap = Math.max(0.1, Number(parametres.seuilFortOverlap ?? 4.0));
  const seuilFaibleOverlap = Math.max(0.1, Number(parametres.seuilFaibleOverlap ?? 2.0));
  const margeSecuriteDevantPalier = Math.max(0, Number(parametres.margeSecuriteDevantPalier ?? 0.15));
  const pointsParRetest = Math.max(10, Number(parametres.pointsParRetest ?? 100));
  const plafondCarburantRetests = Math.max(50, Number(parametres.plafondCarburantRetests ?? 400));
  const bonusMecheProfonde = Math.max(1.0, Number(parametres.bonusMecheProfonde ?? 1.6));
  const bonusMecheNormale = Math.max(1.0, Number(parametres.bonusMecheNormale ?? 1.3));

  const seuilScoreGrandMouvement = Math.max(10, Number(parametres.seuilScoreGrandMouvement ?? 70));
  const scoreMinimumShved = Math.max(0, Number(parametres.scoreMinimumShved ?? 0));
  const exigerAutorouteUOP = parametres.exigerAutorouteUOP !== false; // [COND-UOP-04] Actif par défaut !
  const minTauxChevauchementAutoroute = Math.max(0.5, Number(parametres.minTauxChevauchementAutoroute ?? 1.5));
  const exigerDebutEtFinDansPlage = Boolean(parametres.exigerDebutEtFinDansPlage ?? false);

  // 🧲 Variables Externes : Cible de Liquidité S/R Actif + Trajet Chevauchement UOP
  const activerTPCibleLiquiditeSR = Boolean(parametres.activerTPCibleLiquiditeSR ?? false);
  const comportementAbsenceSR = parametres.comportementAbsenceSR || 'REPLI_TP_UOP';
  const tauxMinChevauchementTrajetSR = Math.max(0.1, Number(parametres.tauxMinChevauchementTrajetSR ?? 1.5));
  const couvertureMinTrajetSRPourcent = Math.max(10, Math.min(100, Number(parametres.couvertureMinTrajetSRPourcent ?? 70)));
  const lookbackShved = Math.max(500, Number(parametres.maxLookbackBars ?? bougies.length));
  const bullColor = parametres.bullColor || '#00E676';
  const bearColor = parametres.bearColor || '#F23645';

  // 🎨 Options Visuelles Épurées
  const modeVisuel = parametres.modeVisuel || 'EPURE';
  const afficherPointDoji = parametres.afficherPointDoji !== false;
  const afficherPointsLiquidation = parametres.afficherPointsLiquidation !== false; // Affiche le badge compact des points captés (défaut: true)
  const afficherSegmentSR = parametres.afficherSegmentSR !== false;
  const afficherPaliersUOP = parametres.afficherPaliersUOP !== false; // Micro-segments pointillés des paliers UOP (défaut: true)
  const afficherSegmentSL = parametres.afficherSegmentSL !== false;
  const afficherSegmentTP = parametres.afficherSegmentTP !== false;
  const dureeSegmentsCibles = Math.max(1, Number(parametres.dureeSegmentsCibles ?? nbBougiesConfirmation));

  // Détection anticipée du Mode Cockpit Fractal LTF (ex: graphique en M15/M30 avec Calque Maître H4 actif)
  // En mode LTF, on ne recalcule PAS le lourd profil UOP à 10 vagues ni Shved sur chaque bougie M15 hors plage :
  // l'autoroute UOP est déjà validée en H4 et on cherche uniquement les Dojis LTF + Range 3 bougies dans la Plage Protégée H4 !
  const activerCalqueFractalHTF = parametres.activerCalqueFractalHTF !== false;
  const tfMaitre = (parametres.timeframeMaitreFractal || '4h').toLowerCase();
  const tfGraphique = (parametres.chartTimeframe || '').toLowerCase();
  const estVueLTF =
    tfGraphique !== '' &&
    tfGraphique !== tfMaitre &&
    ['1m', '5m', '15m', '30m', 'm1', 'm5', 'm15', 'm30', '1h', 'h1'].includes(tfGraphique) &&
    !(tfMaitre === '1h' && (tfGraphique === '1h' || tfGraphique === 'h1'));
  const estModeCockpitFractalLTF = Boolean(
    activerCalqueFractalHTF &&
    estVueLTF &&
    parametres.donneesM1 &&
    parametres.donneesM1.length > 30
  );

  // 2️⃣ Extraction des Niveaux Shved Supply & Demand (uniquement en vue Maître HTF / Standard)
  const resultatShved = estModeCockpitFractalLTF
    ? { supports: [], resistances: [], totalZones: 0, nearestSupport: null, nearestResistance: null, primitives: { boites: [], lignes: [], labels: [] } }
    : calculerShvedSupplyDemand(bougies, {
        timeframeSource: parametres.timeframeSource || 'M15',
        donneesM1: parametres.donneesM1,
        chartTimeframe: parametres.chartTimeframe,
        supprimerZonesCassees: false,
        afficherNonRetestees: true,
        afficherFaibles: true,
        minRetests: 0,
        maxLookbackBars: lookbackShved,
        afficherZones: false,
        afficherLignes: false,
        afficherEtiquettes: false,
      });

  const toutesLesZonesShved: ZoneShved[] = [
    ...resultatShved.supports,
    ...resultatShved.resistances,
  ];

  // 3️⃣ Extraction du Profil UOP (Chevauchement & TP Optimaux pilotés par zigzagDepth de 1 à 8)
  const zigzagDepthDefaut = Math.max(1, Math.min(8, Number(parametres.zigzagDepth ?? 4)));
  const activerZigZagDynamique = parametres.activerZigZagDynamique !== false;
  const zigzagDepthMinParam = Math.max(1, Math.min(8, Number(parametres.zigzagDepthMin ?? 1)));
  const zigzagDepthMaxParam = Math.max(zigzagDepthMinParam, Math.min(8, Number(parametres.zigzagDepthMax ?? 8)));
  const cacheUOPParDepthEtHorizon = new Map<string, ResultatUOP>();

  // Calcule le profil UOP jusqu'à un horizon de bougies donné (verrouillé à la 3ème bougie, 10 dernières vagues superposées)
  const obtenirUOPPourDepthEtHorizon = (
    depthCible: number,
    horizon: number,
    backstepCible = 2,
    nbVaguesCible = 10
  ): ResultatUOP => {
    const depthArrondi = Math.max(1, Math.round(depthCible));
    const cleCache = `${depthArrondi}_${backstepCible}_${nbVaguesCible}_${horizon}`;
    const dejaEnCache = cacheUOPParDepthEtHorizon.get(cleCache);
    if (dejaEnCache) {
      return dejaEnCache;
    }

    // 🔒 Verrouillage : restreint l'historique strictement jusqu'à la 3ème bougie de confirmation
    // Ainsi, les bougies qui se forment plus tard ne changent JAMAIS le TP calculé de ce setup !
    const bougiesHorizon = horizon >= bougies.length - 1
      ? bougies
      : bougies.slice(0, horizon + 1);

    // En Vitesse 1 (2 petites vagues superposées), un chevauchement de 2 bougies suffit à former un couloir local
    const seuilBleuAdapte = nbVaguesCible <= 2 ? 2 : 3;

    const nouveauUOP = calculerUnmitigatedOverlapProfile(bougiesHorizon, {
      zigzagDepth: depthArrondi,
      zigzagBackstep: backstepCible,
      nbVaguesSuperposees: nbVaguesCible,
      seuilBougiesBleuFonce: seuilBleuAdapte,
      typeChevauchementUOP: parametres.typeChevauchementUOP ?? 'CORPS_ET_MECHES',
      poidsCorps: parametres.poidsCorpsUOP ?? 1.0,
      poidsMeche: parametres.poidsMecheUOP ?? 1.0,
      inclureVagueCourante: true,
      afficherTPOptimaux: true,
      afficherZigZag: false,
      afficherBarresProfil: false,
      afficherProlongation: false,
      afficherDebugTP: true, // 🔍 Génère la cartographie détaillée des blocs et creux UOP pour l'inspection sur le graphique
    });
    cacheUOPParDepthEtHorizon.set(cleCache, nouveauUOP);
    return nouveauUOP;
  };

  // 4️⃣ Détection des Dojis personnalisés avec leur plage ciblée (BLOC 1)
  const signauxDojis: SignalDojiAvecPlage[] = detecterDojisAvecPlage(bougies, parametres);

  const setups: SetupOrchestreSMC[] = [];
  let totalDetectes = 0;
  let totalConfirmes = 0;
  let totalActifs = 0;
  let totalTPTouches = 0;
  let totalSLTouches = 0;
  let totalAnnules = 0;
  let totalEnCours = 0;
  let totalAchatsConfirmes = 0;
  let totalVentesConfirmees = 0;
  let sommeRRConfirmes = 0;

  // 5️⃣ Traitement et Orchestration de chaque signal (ignoré en vue Cockpit LTF où seule la Plage HTF fait foi)
  const dojisPourBoucleStandard = estModeCockpitFractalLTF ? [] : signauxDojis;
  for (const doji of dojisPourBoucleStandard) {
    const estAchat = doji.type === 'ACHAT';
    const indexDoji = doji.indexBougie;
    const prixEntree = doji.close2;
    const prixSL = doji.prixExtreme;
    const distanceSL = Math.max(0.0001, Math.abs(prixEntree - prixSL));

    // A. Évaluation des zones Shved dans la plage ciblée (BLOC 2)
    const zonesDansPlage = evaluerNiveauxShvedDansPlage(
      toutesLesZonesShved,
      doji,
      bougies,
      {
        filtrerParDirectionSetup: true,
        exigerDebutEtFinDansPlage: exigerDebutEtFinDansPlage,
        afficherNiveauxCasses: true,
        scoreMinimum: 0,
        topNiveauxScore: 20, // Analyse et score jusqu'à 20 zones candidates dans la plage pour le diagnostic
      }
    );

    const meilleureZone = zonesDansPlage[0];
    const scoreShved = meilleureZone?.score ?? 0;

    // Filtre de score minimal (si demandé par l'utilisateur)
    if (scoreShved < scoreMinimumShved) {
      continue;
    }

    // ────────────────────────────────────────────────────────────────────────────
    // 🌊 [ZIGZAG DYNAMIQUE] SCORE DE LIQUIDATION (/100) & RÉGLAGE DES VAGUES UOP
    // ────────────────────────────────────────────────────────────────────────────
    // On mesure la quantité réelle de liquidité balayée par ce setup (profondeur de
    // la cassure, taille de la bougie de liquidation + épaisseur S/R, nombre de retests)
    // pour adapter dynamiquement la taille des vagues ZigZag (entre 4 et 20).
    let profondeurMecheSetup = distanceSL;
    let epaisseurZoneSRSetup = 0;
    let dureeVieBougiesSRSetup: number | undefined;
    if (meilleureZone) {
      profondeurMecheSetup = estAchat
        ? Math.max(0, meilleureZone.zone.prixMedian - prixSL)
        : Math.max(0, prixSL - meilleureZone.zone.prixMedian);
      epaisseurZoneSRSetup = Math.abs(
        meilleureZone.zone.prixHaut - meilleureZone.zone.prixBas
      );
      if (meilleureZone.zone.indexOrigine !== undefined) {
        dureeVieBougiesSRSetup = Math.max(1, indexDoji - meilleureZone.zone.indexOrigine);
      }
    }

    const bougieDojiActuelle = bougies[indexDoji];
    const bougiePrecedenteDoji = bougies[Math.max(0, indexDoji - 1)];
    const amplitudeBougieSweep = Math.max(
      bougieDojiActuelle ? bougieDojiActuelle.high - bougieDojiActuelle.low : distanceSL,
      bougiePrecedenteDoji ? bougiePrecedenteDoji.high - bougiePrecedenteDoji.low : distanceSL
    );

    const detailsScoreLiquidationZigZag = calculerScoreLiquidationZigZag({
      profondeurMeche: profondeurMecheSetup,
      hauteurMoyenne: doji.moyenneHauteur,
      amplitudeBougieSweep,
      epaisseurZoneSR: epaisseurZoneSRSetup,
      nombreRetests: meilleureZone?.retestsAvant ?? 0,
      collinesRetests: meilleureZone?.collinesRetests,
      dureeVieBougiesSR: dureeVieBougiesSRSetup,
      zigzagDepthMin: zigzagDepthMinParam,
      zigzagDepthMax: zigzagDepthMaxParam,
    });

    // 🔒 VERROUILLAGE DU TP À LA 3ÈME BOUGIE DE CONFIRMATION
    // Si la 3ème bougie a clôturé, l'horizon est bloqué à (indexDoji + nbBougiesConfirmation).
    // Si nous sommes encore dans les bougies d'observation, l'horizon est la dernière bougie connue.
    const indexHorizonConfirmation = Math.min(indexDoji + nbBougiesConfirmation, bougies.length - 1);

    const depthActif = activerZigZagDynamique
      ? detailsScoreLiquidationZigZag.zigzagDepthRetenu
      : zigzagDepthDefaut;
    const backstepActif = activerZigZagDynamique
      ? detailsScoreLiquidationZigZag.zigzagBackstepRetenu
      : 3;
    const nbVaguesActif = Number(parametres.nbVaguesSuperposees ?? 10);

    let uopActifPourSetup: ResultatUOP = obtenirUOPPourDepthEtHorizon(
      depthActif,
      indexHorizonConfirmation,
      backstepActif,
      nbVaguesActif
    );
    const uopRepliDefaut: ResultatUOP = obtenirUOPPourDepthEtHorizon(
      2,
      indexHorizonConfirmation,
      1,
      10
    );

    // Extraction des candidats TP dans la direction du setup
    let tpsCandidats = estAchat
      ? (uopActifPourSetup.tpOptimauxAchat || []).filter((tp) => tp.prixCible > prixEntree)
      : (uopActifPourSetup.tpOptimauxVente || []).filter((tp) => tp.prixCible < prixEntree);

    // Repli de sécurité sur micro-vagues (depth=2, 2 vagues) si l'échantillon de bougies est trop court
    if (tpsCandidats.length === 0 && uopActifPourSetup !== uopRepliDefaut) {
      const tpsRepli = estAchat
        ? (uopRepliDefaut.tpOptimauxAchat || []).filter((tp) => tp.prixCible > prixEntree)
        : (uopRepliDefaut.tpOptimauxVente || []).filter((tp) => tp.prixCible < prixEntree);
      if (tpsRepli.length > 0) {
        tpsCandidats = tpsRepli;
        uopActifPourSetup = uopRepliDefaut;
      }
    }

    // 🌊 Sauvegarde de la SECTION EXACTE de ZigZag ayant servi à calculer le TP de ce setup
    // Pour N vagues superposées (2, 3 ou 4 selon la Vitesse), la section comporte exactement N + 1 pivots !
    const tousPivotsHorizon = uopActifPourSetup.pivots || [];
    const nbPivotsSection = Math.max(2, nbVaguesActif + 1);
    const pivotsPertinents = tousPivotsHorizon.slice(-nbPivotsSection);
    const pivotsAvantDoji = tousPivotsHorizon.filter((p) => p.index <= indexDoji);
    detailsScoreLiquidationZigZag.pivotsZigZag = pivotsPertinents.map((p) => ({
      index: p.index,
      temps: p.temps,
      prix: p.prix,
      type: p.estHaut ? 'HIGH' : 'LOW',
    }));

    // 🛡️ GARDE-FOU SPÉCIAL PETITE LIQUIDITÉ (Vitesse 1 : Score < 40 pts)
    // En petite liquidité, on confine la recherche du TP1 à l'intérieur de la dernière petite vague
    // (sans chercher à casser le sommet ou le creux de la petite vague précédente).
    let borneDernierePetiteVague: number | undefined;
    for (let p = pivotsAvantDoji.length - 1; p >= 0; p--) {
      const piv = pivotsAvantDoji[p];
      if (estAchat && piv.estHaut && piv.prix > prixEntree) {
        borneDernierePetiteVague = piv.prix;
        break;
      }
      if (!estAchat && !piv.estHaut && piv.prix < prixEntree) {
        borneDernierePetiteVague = piv.prix;
        break;
      }
    }

    if (activerZigZagDynamique && detailsScoreLiquidationZigZag.plafondDerniereVagueActif && tpsCandidats.length > 0 && borneDernierePetiteVague !== undefined) {
      const tpsDansDerniereVague = tpsCandidats.filter((tp) =>
        estAchat ? tp.prixCible <= borneDernierePetiteVague! : tp.prixCible >= borneDernierePetiteVague!
      );
      if (tpsDansDerniereVague.length > 0) {
        tpsCandidats = tpsDansDerniereVague;
      }
    }

    // ────────────────────────────────────────────────────────────────────────────
    // 🛣️ [COND-UOP-04] CONDITION D'AUTOROUTE UOP OBLIGATOIRE EN FACE DU TRADE
    // ────────────────────────────────────────────────────────────────────────────
    // Même si le Doji a capté du carburant par liquidation, si en face de nous
    // il n'y a PAS de vraie autoroute (uniquement un terrain à faible chevauchement
    // ou aucun palier goudronné UOP), on ne considère PAS cela comme un setup !

    if (exigerAutorouteUOP) {
      // 1. S'il n'y a aucune route goudronnée UOP détectée en face : REJET DU SETUP !
      if (!tpsCandidats || tpsCandidats.length === 0) {
        continue;
      }

      // 2. Vérifier qu'au moins un palier UOP en face est une vraie autoroute fluide
      // (taux moyen de chevauchement >= seuil minimal d'autoroute)
      const aUneAutorouteFluide = tpsCandidats.some(
        (tp) => tp.tauxMoyenChevauchement >= minTauxChevauchementAutoroute
      );

      if (!aUneAutorouteFluide) {
        // En face, ce n'est qu'une zone à faible chevauchement ➔ REJET DU SETUP !
        continue;
      }
    }

    // B. CIBLE TP OPTIMAL & MOTEUR D'ÉNERGIE UOP (TP1 PAR DÉFAUT)
    const palierTPVise = parametres.palierTPVise || 'TP1';
    let tpSelectionne: TPOptimalUOP | undefined;
    let prixTP: number | undefined;
    let ordreTP: number = 1;
    let carburantInitial: number | undefined;
    let carburantRestant: number | undefined;
    let paliersTraverses: number | undefined;
    let estLimiteParPalier: boolean | undefined;

    let paliersAnalyses: PalierUOPAnalyse[] = [];
    let etapesPaliersUOP: EtapePalierUOPDetail[] | undefined;
    let detailsCarburant: DetailsCarburantLiquidation | undefined;

    if (palierTPVise !== 'AUTO') {
      // 🎯 SÉLECTION DU PALIER FORCÉE PAR L'UTILISATEUR ('TP1', 'TP2', 'TP3')
      // 1. Calcul indicatif du carburant initial de liquidation pour le diagnostic visuel
      let profondeurMeche = distanceSL;
      if (meilleureZone) {
        profondeurMeche = estAchat
          ? Math.max(0, meilleureZone.zone.prixMedian - prixSL)
          : Math.max(0, prixSL - meilleureZone.zone.prixMedian);
      }

      const nombreRetests = meilleureZone?.retestsAvant ?? 0;
      const resCarburant = calculerCarburantLiquidation({
        nombreRetests,
        profondeurMeche,
        hauteurMoyenne: doji.moyenneHauteur,
        pointsParRetest,
        plafondCarburantRetests,
        bonusMecheProfonde,
        bonusMecheNormale,
        collinesRetests: meilleureZone?.collinesRetests,
      });

      carburantInitial = resCarburant.carburantTotal;
      detailsCarburant = {
        pointsRetests: resCarburant.pointsRetests,
        nombreRetests,
        multiplicateurMeche: resCarburant.multiplicateurMeche,
        profondeurMeche,
        hauteurMoyenneATR: doji.moyenneHauteur,
        carburantTotal: resCarburant.carburantTotal,
      };

      // 2. Ordonner les paliers UOP candidats par distance croissante depuis le prix d'entrée
      const paliersTries = [...tpsCandidats].sort(
        (a, b) => Math.abs(a.prixCible - prixEntree) - Math.abs(b.prixCible - prixEntree)
      );

      let indexVise = 0;
      let ordreVise = 1;
      if (palierTPVise === 'TP2') {
        indexVise = 1;
        ordreVise = 2;
      } else if (palierTPVise === 'TP3') {
        indexVise = 2;
        ordreVise = 3;
      }

      if (paliersTries.length > 0) {
        // Ciblage du palier configuré (avec repli sur le plus éloigné si moins de paliers disponibles)
        const indexEffectif = Math.min(indexVise, paliersTries.length - 1);
        tpSelectionne = paliersTries[indexEffectif];
        ordreTP = indexEffectif + 1;
        prixTP = tpSelectionne.prixCible;
        paliersTraverses = ordreTP - 1;
        estLimiteParPalier = true;

        paliersAnalyses = paliersTries.slice(0, ordreTP).map((tp, idx) => ({
          prix: tp.prixCible,
          ordre: idx + 1,
          estPerce: idx < ordreTP - 1,
          estBloquant: idx === ordreTP - 1,
          tauxChevauchement: tp.tauxMoyenChevauchement,
        }));
      } else {
        // Formule de repli sécurisée si aucun palier UOP n'est détecté
        const multiplicateurSecours = ordreVise === 3 ? 3.5 : (ordreVise === 2 ? 2.5 : 1.5);
        prixTP = estAchat
          ? prixEntree + distanceSL * multiplicateurSecours
          : prixEntree - distanceSL * multiplicateurSecours;
        ordreTP = ordreVise;
      }
    } else if (modeCalculTP === 'ENERGIE_FRICTION') {
      // 🚀 MODÈLE D'ÉNERGIE : Liquidité engrangée vs Résistance UOP
      // 1. Calcul de la profondeur de pénétration de la mèche de balayage
      let profondeurMeche = distanceSL;
      if (meilleureZone) {
        profondeurMeche = estAchat
          ? Math.max(0, meilleureZone.zone.prixMedian - prixSL)
          : Math.max(0, prixSL - meilleureZone.zone.prixMedian);
      }

      // 2. Calcul du réservoir de carburant initial ([COND-ENERGIE-01 à 03])
      const nombreRetests = meilleureZone?.retestsAvant ?? 0;
      const resCarburant = calculerCarburantLiquidation({
        nombreRetests,
        profondeurMeche,
        hauteurMoyenne: doji.moyenneHauteur,
        pointsParRetest,
        plafondCarburantRetests,
        bonusMecheProfonde,
        bonusMecheNormale,
        collinesRetests: meilleureZone?.collinesRetests,
      });

      carburantInitial = resCarburant.carburantTotal;
      detailsCarburant = {
        pointsRetests: resCarburant.pointsRetests,
        nombreRetests,
        multiplicateurMeche: resCarburant.multiplicateurMeche,
        profondeurMeche,
        hauteurMoyenneATR: doji.moyenneHauteur,
        carburantTotal: resCarburant.carburantTotal,
      };

      // 3. Simulation du trajet et franchissement des paliers UOP ([COND-FRICTION-01 à 03])
      const resPortee = calculerPorteeDynamiqueUOP({
        prixEntree,
        prixSL,
        direction: doji.type,
        carburantInitial,
        tpsCandidats,
        hauteurMoyenne: doji.moyenneHauteur,
        peagePalierUOP,
        coutParATR,
        coutFrictionFortOverlap,
        coutFrictionMoyenOverlap,
        coutFrictionFaibleOverlap,
        seuilFortOverlap,
        seuilFaibleOverlap,
        margeSecuriteDevantPalier,
      });

      prixTP = resPortee.prixTPOptimal;
      ordreTP = resPortee.ordreTP;
      carburantRestant = resPortee.carburantRestant;
      paliersTraverses = resPortee.paliersTraverses;
      estLimiteParPalier = resPortee.estLimiteParPalier;
      paliersAnalyses = resPortee.paliersAnalyses;
      etapesPaliersUOP = resPortee.etapesDetails;
      tpSelectionne = resPortee.palierBloquant ?? tpsCandidats[Math.min(tpsCandidats.length - 1, Math.max(0, ordreTP - 1))];
    } else {
      // 🏛️ MODÈLE STANDARD : Proportionnalité simple au Score Shved
      const viserGrandMouvement = scoreShved >= seuilScoreGrandMouvement;

      if (tpsCandidats.length > 0) {
        if (viserGrandMouvement && tpsCandidats.length >= 2) {
          tpSelectionne = tpsCandidats[1];
          ordreTP = 2;
        } else {
          tpSelectionne = tpsCandidats[0];
          ordreTP = 1;
        }
        prixTP = tpSelectionne.prixCible;
        paliersAnalyses = tpsCandidats.slice(0, ordreTP).map((tp, idx) => ({
          prix: tp.prixCible,
          ordre: idx + 1,
          estPerce: true,
          estBloquant: false,
          tauxChevauchement: tp.tauxMoyenChevauchement,
        }));
      } else {
        const multiplicateurSecours = viserGrandMouvement ? 2.5 : 1.5;
        prixTP = estAchat
          ? prixEntree + distanceSL * multiplicateurSecours
          : prixEntree - distanceSL * multiplicateurSecours;
        ordreTP = viserGrandMouvement ? 2 : 1;
      }
    }

    // ────────────────────────────────────────────────────────────────────────────
    // 🧲 [OPTIONNEL] CIBLE DE LIQUIDITÉ S/R ACTIF (NON CASSÉ) + TRAJET CHEVAUCHEMENT
    // ────────────────────────────────────────────────────────────────────────────
    // Si activé dans les variables externes, on cherche un Support (en Vente) ou une
    // Résistance (en Achat) toujours actif en face du prix d'entrée, à condition que
    // tout le trajet jusqu'à ce S/R ait un bon taux de chevauchement UOP.
    let cibleLiquiditeSR: InfoCibleLiquiditeSR | undefined;
    let toutesCiblesSRAnalysees: InfoCibleLiquiditeSR[] | undefined;

    if (activerTPCibleLiquiditeSR) {
      const rechercheSR = trouverCiblesLiquiditeSRAvecChevauchement({
        toutesLesZonesShved,
        bougies,
        indexHorizon: indexHorizonConfirmation,
        typeSetup: doji.type,
        prixEntree,
        paliersSuperposition: uopActifPourSetup.paliersSuperposition || [],
        stepUOP: uopActifPourSetup.step || 0.0001,
        tauxMinChevauchementTrajet: tauxMinChevauchementTrajetSR,
        couvertureMinPourcent: couvertureMinTrajetSRPourcent,
        borneMaxVitesse1:
          activerZigZagDynamique && detailsScoreLiquidationZigZag.plafondDerniereVagueActif
            ? borneDernierePetiteVague
            : undefined,
      });

      toutesCiblesSRAnalysees = rechercheSR.toutesCiblesAnalysees;

      if (rechercheSR.ciblesValides.length > 0) {
        // Sélection du S/R actif selon le palier visé (TP1 -> 1er S/R, TP2 -> 2ème S/R, TP3 -> 3ème S/R)
        let indexSR = 0;
        if (palierTPVise === 'TP2') indexSR = 1;
        else if (palierTPVise === 'TP3') indexSR = 2;
        const indexSREffectif = Math.min(indexSR, rechercheSR.ciblesValides.length - 1);

        cibleLiquiditeSR = rechercheSR.ciblesValides[indexSREffectif];
        prixTP = cibleLiquiditeSR.prixCible;
        ordreTP = indexSREffectif + 1;
      } else if (comportementAbsenceSR === 'REJETER_SETUP') {
        // Mode strict choisi par l'utilisateur : aucun S/R actif avec trajet de chevauchement valide ➔ REJET DU SETUP !
        continue;
      }
      // Sinon ('REPLI_TP_UOP') : on garde le prixTP normal du profil de chevauchement UOP
    }

    // ────────────────────────────────────────────────────────────────────────────
    // 🎯 [COND-PLAGE-TP-01] FILTRE PLAGE TEMPORELLE DU TP UOP (ORCHESTRATEUR)
    // ────────────────────────────────────────────────────────────────────────────
    // Vérification que le Doji forme l'extrême absolu de toute la plage entre la bougie
    // qui contient le niveau de prix du TP et la bougie actuelle du Doji :
    // - Achat : Le Low du Doji doit être le prix le plus bas de toute la plage.
    // - Vente : Le High du Doji doit être le prix le plus haut de toute la plage.
    let infoPlageTP: InfoValidationPlageTP | undefined;
    const activerFiltrePlageTP = parametres.activerFiltrePlageTP !== false;
    const maxReculPlageTP = Math.max(10, Number(parametres.maxReculPlageTP ?? parametres.maxReculRecherche ?? 100));

    if (activerFiltrePlageTP && prixTP !== undefined) {
      const verifTP = validerDojiAvecPlageTP(
        bougies,
        indexDoji,
        doji.type,
        prixTP,
        maxReculPlageTP
      );

      if (!verifTP.estValide) {
        // Le setup n'est pas l'extrême absolu sur la plage temporelle du TP ➔ REJET !
        continue;
      }

      infoPlageTP = verifTP;
    }

    const distanceTP = Math.abs(prixTP - prixEntree);
    const ratioRR = Number((distanceTP / distanceSL).toFixed(2));

    // Le setup est validé par tous les filtres géométriques & structurels : on le comptabilise
    totalDetectes++;

    // C. Vérification du RANGE DE CONFIRMATION (les N bougies suivantes)
    // Chaque bougie du range doit rester dans la plage :
    // - Achat : entre [prixSL] et [Close(B2) + AmplitudeDuDoji * multiplicateur]
    // - Vente : entre [Close(B2) - AmplitudeDuDoji * multiplicateur] et [prixSL]
    let statut: StatutSetupSMC = 'CONFIRME';
    let bougiesObservees = 0;
    let bougieInvalidationIndex: number | undefined;
    const borneRangeConfirmation = estAchat
      ? prixEntree + amplitudeBougieSweep * multiplicateurAmplitudeBorneRange
      : prixEntree - amplitudeBougieSweep * multiplicateurAmplitudeBorneRange;

    const indexFinVerification = Math.min(indexDoji + nbBougiesConfirmation, bougies.length - 1);

    for (let k = indexDoji + 1; k <= indexFinVerification; k++) {
      bougiesObservees++;
      const bougieActuelle = bougies[k];

      if (estAchat) {
        // En Achat :
        // 1. Borne basse : la bougie ne doit pas passer SOUS le plus bas du Doji (prixSL)
        const casseSL = bougieActuelle.low <= prixSL;
        // 2. Borne haute : la bougie ne doit pas dépasser Close(B2) + AmplitudeDuDoji
        const prixHautTeste =
          typeVerificationBorneRange === 'MECHE' ? bougieActuelle.high : bougieActuelle.close;
        const depasseBorneHaute =
          bornerRangeConfirmationParAmplitudeDoji && prixHautTeste > borneRangeConfirmation;

        if (casseSL || depasseBorneHaute) {
          statut = 'ANNULE';
          bougieInvalidationIndex = k;
          break;
        }
      } else {
        // En Vente :
        // 1. Borne haute : la bougie ne doit pas passer AU-DESSUS du plus haut du Doji (prixSL)
        const casseSL = bougieActuelle.high >= prixSL;
        // 2. Borne basse : la bougie ne doit pas descendre sous Close(B2) - AmplitudeDuDoji
        const prixBasTeste =
          typeVerificationBorneRange === 'MECHE' ? bougieActuelle.low : bougieActuelle.close;
        const depasseBorneBasse =
          bornerRangeConfirmationParAmplitudeDoji && prixBasTeste < borneRangeConfirmation;

        if (casseSL || depasseBorneBasse) {
          statut = 'ANNULE';
          bougieInvalidationIndex = k;
          break;
        }
      }
    }

    // Si on est encore dans les 3 bougies en fin d'historique et pas encore invalidé
    if (statut !== 'ANNULE' && bougiesObservees < nbBougiesConfirmation) {
      statut = 'EN_COURS';
    }

    // Comptabilisation initiale des statuts
    if (statut === 'CONFIRME') {
      totalConfirmes++;
      sommeRRConfirmes += ratioRR;
      if (estAchat) totalAchatsConfirmes++;
      else totalVentesConfirmees++;
    } else if (statut === 'ANNULE') {
      totalAnnules++;
    } else {
      totalEnCours++;
    }

    // D. SUIVI POST-CONFIRMATION : VÉRIFICATION DU TP OU DU SL TOUCHÉ DANS LE FUTUR
    let estTermine = false;
    let resultatTrade: ResultatTradeSMC = 'EN_COURS';
    let indexSortieTrade: number | undefined;
    let tempsSortieTrade: number | string | undefined;

    if (statut === 'CONFIRME') {
      // On commence à scruter les bougies après la fin de la confirmation
      const indexDebutSuivi = indexDoji + nbBougiesConfirmation + 1;

      for (let k = indexDebutSuivi; k < bougies.length; k++) {
        const b = bougies[k];

        if (estAchat) {
          // En Achat : TP touché si High >= prixTP
          const tpTouche = prixTP !== undefined && b.high >= prixTP;
          // SL touché si Low <= prixSL
          const slTouche = b.low <= prixSL;

          if (tpTouche || slTouche) {
            estTermine = true;
            resultatTrade = tpTouche ? 'TP_TOUCHE' : 'SL_TOUCHE';
            indexSortieTrade = k;
            tempsSortieTrade = b.time;
            break;
          }
        } else {
          // En Vente : TP touché si Low <= prixTP
          const tpTouche = prixTP !== undefined && b.low <= prixTP;
          // SL touché si High >= prixSL
          const slTouche = b.high >= prixSL;

          if (tpTouche || slTouche) {
            estTermine = true;
            resultatTrade = tpTouche ? 'TP_TOUCHE' : 'SL_TOUCHE';
            indexSortieTrade = k;
            tempsSortieTrade = b.time;
            break;
          }
        }
      }

      // Comptabilisation des issues de trades
      if (estTermine) {
        if (resultatTrade === 'TP_TOUCHE') totalTPTouches++;
        else if (resultatTrade === 'SL_TOUCHE') totalSLTouches++;
      } else {
        totalActifs++;
      }
    }

    // Création de l'objet Setup complet (conservé en télémétrie pour les statistiques et diagnostic)
    const orderBlocksProteges = detecterOrderBlocksClassiquesDansPlage({
      bougies,
      indexDebutScan: Math.max(0, doji.indexDebutPlage),
      indexFinScan: indexHorizonConfirmation,
      typeSetup: doji.type,
      prixSL,
      prixBorneOpposed: borneRangeConfirmation,
    });

    const setup: SetupOrchestreSMC = {
      id: `smc-setup-${indexDoji}`,
      type: doji.type,
      statut,
      indexDoji,
      tempsDoji: doji.temps,
      tempsDebutPlage: doji.tempsDebutPlage,
      indexDebutPlage: doji.indexDebutPlage,
      prixEntree,
      prixSL,
      distanceSL,
      scoreShved,
      meilleureZoneShved: meilleureZone,
      zonesShvedCandidates: zonesDansPlage,
      bougiesObservees,
      bougieInvalidationIndex,
      borneRangeConfirmation,
      indexConfirmation: indexHorizonConfirmation,
      tempsConfirmation: bougies[indexHorizonConfirmation]?.time ?? doji.temps,
      prixTP,
      ordreTP,
      palierTPVise,
      distanceTP,
      ratioRR,
      tpSelectionne,
      carburantInitial,
      carburantRestant,
      detailsCarburant,
      detailsScoreLiquidationZigZag,
      paliersTraverses,
      estLimiteParPalier,
      paliersAnalyses,
      etapesPaliersUOP,
      tousPaliersUOPCandidats: tpsCandidats,
      stepUOP: uopActifPourSetup.step,
      seuilBleuFonceUOP: nbVaguesActif <= 2 ? 2 : 3,
      paliersSuperpositionUOP: uopActifPourSetup.paliersSuperposition,
      vaguesSuperposeesUOP: uopActifPourSetup.vaguesSuperposees,
      borneDernierePetiteVague: detailsScoreLiquidationZigZag.plafondDerniereVagueActif ? borneDernierePetiteVague : undefined,
      infoPlageTP,
      cibleLiquiditeSR,
      toutesCiblesSRAnalysees,
      profondeurZigZagOriginale: depthActif,
      orderBlocksProteges,
      estTermine,
      resultatTrade,
      indexSortieTrade,
      tempsSortieTrade,
    };

    setups.push(setup);

    // ────────────────────────────────────────────────────────────────────────────
    // 🧹 ÉPURATION ACTIVE : FILTRAGE DES SETUPS PASSÉS (TP OU SL DÉJÀ TOUCHÉ)
    // ────────────────────────────────────────────────────────────────────────────
    // Si l'option masquerSetupsTermines est activée, on ignore totalement le tracé
    // de ce setup pour garder le graphique vierge de tout historique périmé !
    if (masquerSetupsTermines && estTermine) {
      continue;
    }

    // Si le setup a été annulé par le range de 3 bougies et qu'on ne souhaite pas l'afficher
    if (statut === 'ANNULE' && !afficherSetupsAnnules) {
      continue;
    }

    // ─── 🎨 Génération des Primitives Visuelles pour les Setups Actifs ───
    const couleurPrincipale = estAchat ? bullColor : bearColor;
    const dateDoji = doji.temps;

    // Largeur temporelle des micro-segments SL / TP / Paliers UOP (courte pour ne pas surcharger)
    const indexBougieFinCible = Math.min(bougies.length - 1, indexDoji + dureeSegmentsCibles);
    const dateFinCible = bougies[indexBougieFinCible].time;

    // 1️⃣ Point Discret sur le Doji (au niveau de la mèche extrême)
    if (afficherPointDoji) {
      const couleurPoint = statut === 'CONFIRME'
        ? couleurPrincipale
        : (statut === 'EN_COURS' ? '#FFD600' : '#8E8E93');

      points.push({
        id: `orchestre-pt-${indexDoji}`,
        prix: prixSL,
        date: dateDoji,
        couleur: couleurPoint,
        rayon: 4,
        style: 'plein',
      });
    }

    // 1️⃣.bis ⚡ Badge Compact de Liquidation : Quantité de points de liquidité captés + Profondeur ZigZag
    // Affiche par exemple "⚡ 450 pts · Prof: 4" de manière discrète au niveau du Doji
    if (afficherPointsLiquidation && carburantInitial && carburantInitial > 0 && (statut === 'CONFIRME' || statut === 'EN_COURS')) {
      labels.push({
        id: `orchestre-liq-pts-${indexDoji}`,
        prix: prixSL,
        date: dateDoji,
        texte: `⚡ ${carburantInitial} pts · Prof: ${depthActif}`,
        couleur: couleurPrincipale,
        position: estAchat ? 'below' : 'above',
      });
    }

    // 2️⃣ Segment Discontinu du Support ou Résistance Shved balayé
    if (afficherSegmentSR && meilleureZone && (statut === 'CONFIRME' || statut === 'EN_COURS')) {
      const zoneSR = meilleureZone.zone;
      const dateDebutZoneMs = convertirTempsEnMs(zoneSR.dateDebut);
      const dateDebutPlageMs = convertirTempsEnMs(doji.tempsDebutPlage);

      // Borner le tracé dans la plage ciblée
      const dateDebutLigne = dateDebutZoneMs < dateDebutPlageMs ? doji.tempsDebutPlage : zoneSR.dateDebut;

      lignes.push({
        id: `orchestre-sr-${zoneSR.id}-${indexDoji}`,
        prix: zoneSR.prixMedian,
        dateDebut: dateDebutLigne,
        dateFin: dateDoji,
        couleur: couleurPrincipale,
        epaisseur: 1.5,
        style: 'dashed',
        label: `${estAchat ? 'Sup' : 'Res'} [${scoreShved} pts]`,
      });
    }

    // 2️⃣.bis 🌊 Paliers d'Overlap UOP rencontrés sur la route (Percés vs Murs)
    // Micro-segments pointillés très fins pour chaque palier UOP analysé
    if (afficherPaliersUOP && paliersAnalyses && paliersAnalyses.length > 0 && (statut === 'CONFIRME' || statut === 'EN_COURS')) {
      for (const palier of paliersAnalyses) {
        // Cyan discret pour palier percé, Ambre/Orange pour mur bloquant
        const couleurPalier = palier.estBloquant ? '#FFA726' : '#29B6F6';
        const labelTexte = palier.estBloquant
          ? `Mur P${palier.ordre} 🛑`
          : `P${palier.ordre} ✓`;

        lignes.push({
          id: `orchestre-palier-uop-${indexDoji}-${palier.ordre}`,
          prix: palier.prix,
          dateDebut: dateDoji,
          dateFin: dateFinCible,
          couleur: couleurPalier,
          epaisseur: 1,
          style: 'dotted',
          label: labelTexte,
        });
      }
    }

    // 2️⃣.ter 🟦 Rectangles des Order Blocks Classiques SMC Protégés dans la plage du setup
    const afficherOrderBlocksProteges = parametres.afficherOrderBlocksProteges !== false;
    if (
      afficherOrderBlocksProteges &&
      orderBlocksProteges.length > 0 &&
      (statut === 'CONFIRME' || statut === 'EN_COURS')
    ) {
      for (const ob of orderBlocksProteges) {
        const couleurFondOB = ob.estDernierOB
          ? estAchat
            ? 'rgba(0, 230, 118, 0.20)'
            : 'rgba(242, 54, 69, 0.20)'
          : 'rgba(56, 189, 248, 0.12)';
        const couleurBordOB = ob.estDernierOB
          ? estAchat
            ? '#00E676'
            : '#F23645'
          : 'rgba(56, 189, 248, 0.55)';

        boites.push({
          id: `orchestre-ob-${indexDoji}-${ob.ordreHierarchie}`,
          prixHaut: ob.prixHaut,
          prixBas: ob.prixBas,
          dateDebut: ob.tempsDebut,
          dateFin: dateFinCible,
          couleurFond: couleurFondOB,
          couleurBordure: couleurBordOB,
          label: ob.estDernierOB
            ? `🛡️ Dernier OB #${ob.ordreHierarchie} (Protégé)`
            : `📦 OB #${ob.ordreHierarchie}`,
        });
      }
    }

    // 3️⃣ Micro-segments SL et TP pour les Setups Confirmés Actifs ✅
    if (statut === 'CONFIRME') {
      // Micro-segment court du Stop Loss (Rouge en tirets discrets)
      if (afficherSegmentSL) {
        lignes.push({
          id: `orchestre-sl-${indexDoji}`,
          prix: prixSL,
          dateDebut: dateDoji,
          dateFin: dateFinCible,
          couleur: '#FF3B30',
          epaisseur: 1.5,
          style: 'dashed',
          label: 'SL',
        });
      }

      // Micro-segment court du Take Profit Optimal (Vert continu)
      if (afficherSegmentTP && prixTP !== undefined) {
        const labelCibleTP = cibleLiquiditeSR
          ? `🧲 TP S/R (${ratioRR}R | ${cibleLiquiditeSR.pourcentageTrajetCouvert}% couv.)`
          : `TP (${ratioRR}R${carburantInitial ? ` | ${carburantInitial}pts` : ''})`;

        lignes.push({
          id: `orchestre-tp-${indexDoji}`,
          prix: prixTP,
          dateDebut: dateDoji,
          dateFin: dateFinCible,
          couleur: '#00E676',
          epaisseur: 1.5,
          style: 'solid',
          label: labelCibleTP,
        });
      }

      // Si le trader a choisi le mode 'COMPLET', on ajoute également l'étiquette détaillée
      if (modeVisuel === 'COMPLET') {
        labels.push({
          id: `orchestre-lbl-${indexDoji}`,
          prix: prixSL,
          date: dateDoji,
          texte: `✅ SMC ${estAchat ? 'ACHAT' : 'VENTE'} (Score: ${scoreShved} | R:R ${ratioRR}${carburantInitial ? ` | Carb: ${carburantInitial}pts` : ''})`,
          couleur: couleurPrincipale,
          position: estAchat ? 'below' : 'above',
        });
      }
    }

    // 4️⃣ Si Setup Annulé et affichage explicitement demandé en mode complet
    else if (statut === 'ANNULE' && afficherSetupsAnnules && modeVisuel === 'COMPLET') {
      labels.push({
        id: `orchestre-lbl-annule-${indexDoji}`,
        prix: prixSL,
        date: dateDoji,
        texte: `❌ Annulé (Sortie Range)`,
        couleur: '#8E8E93',
        position: estAchat ? 'below' : 'above',
      });
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 🔬 6️⃣ ENVIRONNEMENT COCKPIT FRACTAL HTF ➔ LTF EN BACKTEST MANUEL (OPTIMISÉ O(log N))
  // ────────────────────────────────────────────────────────────────────────────
  // Lorsque le trader descend sur une petite unité de temps (ex: M15, M30, M5) en Backtest Manuel :
  // 1. On conserve à l'écran le Calque du Setup Maître HTF (ex: H4) avec sa Grande Boîte de Plage Protégée,
  //    la ligne d'aimant du GRAND TP H4 et les Rectangles des Order Blocks Classiques SMC protégés (détectés en LTF).
  // 2. À l'intérieur de cette Plage Protégée H4, on détecte automatiquement les Seconds Setups LTF (Doji + Range 3 bougies)
  //    SANS filtre de Taux de Chevauchement UOP, et on branche leur Petit SL LTF directement sur le Grand TP H4 !
  if (estModeCockpitFractalLTF && parametres.donneesM1 && bougies.length > 0) {
    const derniereBougieVisible = bougies[bougies.length - 1];
    const tempsMaxVisibleMs = convertirTempsEnMs(derniereBougieVisible.time);
    const tempsMinVisibleMs = convertirTempsEnMs(bougies[0].time);

    // 🚀 Optimisation O(1) : agregerBougies sur le tableau complet donneesM1 utilise directement
    // le cache mémoire global cacheAgregationMTF (aucun .filter() sur 370 000 bougies M1 à chaque tic !)
    const toutesBougiesHTF = agregerBougies(parametres.donneesM1, tfMaitre);
    const dureeHTFSec = obtenirDureeTimeframeSecondes(tfMaitre);
    const dureeHTFMs = dureeHTFSec * 1000;
    const bucketCourantStartMs = Math.floor(tempsMaxVisibleMs / dureeHTFMs) * dureeHTFMs;

    // Recherche par dichotomie O(log N) de la dernière bougie HTF strictement antérieure au bucket en cours
    const idxDerniereHTFComplete = trouverDernierIndexAvantTempsMs(
      toutesBougiesHTF,
      bucketCourantStartMs - 1
    );

    if (idxDerniereHTFComplete >= 14) {
      // 🚀 Cache intelligent du calcul Maître HTF : un setup HTF confirmé ne dépend STRICTEMENT que des bougies
      // HTF clôturées (idxDerniereHTFComplete). Ainsi le calcul H4 ne s'exécute qu'UNE FOIS toutes les 16 bougies M15
      // (ou 48 bougies M5) et reste en cache à 0 ms pendant toutes les bougies intermédiaires !
      const tempsPremiereHTF = toutesBougiesHTF[0]?.time ?? '';
      const tempsDerniereHTF = toutesBougiesHTF[idxDerniereHTFComplete]?.time ?? '';
      const cleCacheHTF = `${parametres.donneesM1.length}_${tempsPremiereHTF}_${tempsDerniereHTF}_${tfMaitre}_${idxDerniereHTFComplete}_${parametres.zigzagDepth ?? 4}_${parametres.activerZigZagDynamique ?? true}_${parametres.palierTPVise ?? 'TP1'}_${parametres.exigerAutorouteUOP ?? true}_${parametres.scoreMinimumShved ?? 0}`;

      let resMaitreHTF: ResultatOrchestrateurSMC;
      if (cacheMaitreHTF && cacheMaitreHTF.cle === cleCacheHTF) {
        resMaitreHTF = cacheMaitreHTF.resultat;
      } else {
        // On ne prend que les 140 dernières bougies HTF clôturées (amplement suffisant pour 10 vagues ZigZag H4)
        const debutFenetreHTF = Math.max(0, idxDerniereHTFComplete - 140);
        const bougiesHTF = toutesBougiesHTF.slice(debutFenetreHTF, idxDerniereHTFComplete + 1);

        resMaitreHTF = calculerOrchestrateurSMC(bougiesHTF, {
          ...parametres,
          donneesM1: undefined, // Crucial : évite une double agrégation M1 à l'intérieur du calcul H4 !
          timeframeSource: 'ACTUEL',
          activerCalqueFractalHTF: false, // Évite toute récursion
          masquerSetupsTermines: false,
          chartTimeframe: tfMaitre,
        });
        cacheMaitreHTF = { cle: cleCacheHTF, resultat: resMaitreHTF };
      }

      if (resMaitreHTF) {

        const setupsHTFConfirmes = (resMaitreHTF.setups || []).filter(
          (s) => s.statut === 'CONFIRME' && s.prixTP !== undefined
        );

        for (const setupHTF of setupsHTFConfirmes) {
          if (setupHTF.prixTP === undefined) continue;
          const estAchatHTF = setupHTF.type === 'ACHAT';
          const prixSL_HTF = setupHTF.prixSL;
          const prixTP_HTF = setupHTF.prixTP;
          const borneRange_HTF =
            setupHTF.borneRangeConfirmation ??
            (estAchatHTF
              ? setupHTF.prixEntree + setupHTF.distanceSL * 1.5
              : setupHTF.prixEntree - setupHTF.distanceSL * 1.5);

          const minPlageHTF = Math.min(prixSL_HTF, borneRange_HTF);
          const maxPlageHTF = Math.max(prixSL_HTF, borneRange_HTF);
          const tDebutHTFMs = convertirTempsEnMs(setupHTF.tempsDoji);

          // Vérifier si le Setup HTF a déjà été clôturé (TP_HTF ou SL_HTF touché) avant la fenêtre visible
          let tFinVieHTFMs = Infinity;
          let dateFinZoneLTF: number | string = derniereBougieVisible.time;
          for (const bL of bougies) {
            const tMs = convertirTempsEnMs(bL.time);
            if (tMs <= tDebutHTFMs) continue;
            const tpTouche = estAchatHTF ? bL.high >= prixTP_HTF : bL.low <= prixTP_HTF;
            const slCasse = estAchatHTF ? bL.low < prixSL_HTF : bL.high > prixSL_HTF;
            if (tpTouche || slCasse) {
              tFinVieHTFMs = tMs;
              dateFinZoneLTF = bL.time;
              break;
            }
          }

          // Si le Setup HTF est déjà terminé et que masquerSetupsTermines est actif, on ne l'affiche que s'il est encore en vie
          if (masquerSetupsTermines && tFinVieHTFMs < tempsMaxVisibleMs) {
            continue;
          }
          if (tFinVieHTFMs < tempsMinVisibleMs) {
            continue;
          }

          // Trouver la première bougie LTF correspondant au début du Setup HTF
          const idxDebutLTF = Math.max(
            0,
            bougies.findIndex((b) => convertirTempsEnMs(b.time) >= tDebutHTFMs)
          );
          const dateDebutZoneLTF = bougies[idxDebutLTF]?.time ?? bougies[0].time;

          // A. 📦 Grande Boîte de la Plage Protégée du Setup Maître HTF projetée sur le graphique LTF
          boites.push({
            id: `fractal-htf-plage-${setupHTF.indexDoji}`,
            prixHaut: maxPlageHTF,
            prixBas: minPlageHTF,
            dateDebut: dateDebutZoneLTF,
            dateFin: dateFinZoneLTF,
            couleurFond: estAchatHTF
              ? 'rgba(168, 85, 247, 0.08)'
              : 'rgba(244, 63, 94, 0.08)',
            couleurBordure: estAchatHTF ? '#A855F7' : '#FB7185',
            label: `🏛️ PLAGE PROTÉGÉE ${tfMaitre.toUpperCase()} (${setupHTF.type}) | Grand TP: ${prixTP_HTF.toFixed(4)}`,
          });

          // B. 🎯 Ligne d'Aimant du GRAND TP HTF et du SL Maître HTF
          lignes.push({
            id: `fractal-htf-tp-${setupHTF.indexDoji}`,
            prix: prixTP_HTF,
            dateDebut: dateDebutZoneLTF,
            dateFin: dateFinZoneLTF,
            couleur: '#10B981',
            epaisseur: 2,
            style: 'solid',
            label: `🎯 GRAND TP ${tfMaitre.toUpperCase()} : ${prixTP_HTF.toFixed(4)}`,
          });

          lignes.push({
            id: `fractal-htf-sl-${setupHTF.indexDoji}`,
            prix: prixSL_HTF,
            dateDebut: dateDebutZoneLTF,
            dateFin: dateFinZoneLTF,
            couleur: '#EF4444',
            epaisseur: 1.5,
            style: 'dashed',
            label: `🛑 SL MAÎTRE ${tfMaitre.toUpperCase()} : ${prixSL_HTF.toFixed(4)}`,
          });

          // C. 🟦 Rectangles des Order Blocks Classiques SMC protégés détectés sur les bougies LTF à l'intérieur de la plage HTF
          const idxFinScanOB = bougies.findIndex(
            (b) => convertirTempsEnMs(b.time) >= Math.min(tFinVieHTFMs, tempsMaxVisibleMs)
          );
          const obsInternesLTF = detecterOrderBlocksClassiquesDansPlage({
            bougies,
            indexDebutScan: idxDebutLTF,
            indexFinScan: idxFinScanOB >= 0 ? idxFinScanOB : bougies.length - 1,
            typeSetup: setupHTF.type,
            prixSL: prixSL_HTF,
            prixBorneOpposed: borneRange_HTF,
          });

          for (const ob of obsInternesLTF) {
            boites.push({
              id: `fractal-ltf-ob-${setupHTF.indexDoji}-${ob.ordreHierarchie}`,
              prixHaut: ob.prixHaut,
              prixBas: ob.prixBas,
              dateDebut: ob.tempsDebut,
              dateFin: dateFinZoneLTF,
              couleurFond: ob.estDernierOB
                ? estAchatHTF
                  ? 'rgba(0, 230, 118, 0.24)'
                  : 'rgba(242, 54, 69, 0.24)'
                : 'rgba(56, 189, 248, 0.14)',
              couleurBordure: ob.estDernierOB
                ? estAchatHTF
                  ? '#00E676'
                  : '#F23645'
                : '#38BDF8',
              label: ob.estDernierOB
                ? `🛡️ Dernier OB LTF #${ob.ordreHierarchie} (Rempart SL ${tfMaitre.toUpperCase()})`
                : `📦 OB Protégé LTF #${ob.ordreHierarchie}`,
            });
          }

          // D. 🔬 Détection des Seconds Setups en LTF à l'intérieur de la Plage HTF (SANS filtre de Taux de Chevauchement !)
          for (const dLTF of signauxDojis) {
            if (dLTF.type !== setupHTF.type) continue;
            const tDojiLTFMs = convertirTempsEnMs(dLTF.temps);
            if (tDojiLTFMs < tDebutHTFMs || tDojiLTFMs >= tFinVieHTFMs) continue;

            // Vérifier si ce Doji LTF est déjà dans `setups` (auquel cas on le promeut en Second Setup Fractal connecté au Grand TP HTF)
            const indexExistant = setups.findIndex((s) => s.indexDoji === dLTF.indexBougie);
            const idxDojiL = dLTF.indexBougie;
            const prixEntreeL = dLTF.close2;
            const petitSLL = dLTF.prixExtreme;

            // Doit être situé à l'intérieur de la Plage Protégée du Setup Maître HTF
            const dansPlageHTF =
              (petitSLL >= minPlageHTF && petitSLL <= maxPlageHTF) ||
              (prixEntreeL >= minPlageHTF && prixEntreeL <= maxPlageHTF);
            if (!dansPlageHTF) continue;
            if (estAchatHTF && prixEntreeL >= prixTP_HTF) continue;
            if (!estAchatHTF && prixEntreeL <= prixTP_HTF) continue;

            // Vérification du Range de 3 bougies LTF [petitSLL ➔ Close(B2_LTF) ± AmplitudeDoji_LTF]
            const b1L = bougies[Math.max(0, idxDojiL - 1)];
            const b2L = bougies[idxDojiL];
            const ampDojiL = Math.max(
              b1L ? b1L.high - b1L.low : Math.abs(prixEntreeL - petitSLL),
              b2L ? b2L.high - b2L.low : Math.abs(prixEntreeL - petitSLL)
            );
            const borneRangeL = estAchatHTF
              ? prixEntreeL + ampDojiL * multiplicateurAmplitudeBorneRange
              : prixEntreeL - ampDojiL * multiplicateurAmplitudeBorneRange;

            let statutL: StatutSetupSMC = 'CONFIRME';
            let bougiesObsL = 0;
            const idxFinVerifL = Math.min(idxDojiL + nbBougiesConfirmation, bougies.length - 1);
            for (let k = idxDojiL + 1; k <= idxFinVerifL; k++) {
              bougiesObsL++;
              const bk = bougies[k];
              if (estAchatHTF) {
                if (
                  bk.low <= petitSLL ||
                  (bornerRangeConfirmationParAmplitudeDoji && bk.close > borneRangeL)
                ) {
                  statutL = 'ANNULE';
                  break;
                }
              } else {
                if (
                  bk.high >= petitSLL ||
                  (bornerRangeConfirmationParAmplitudeDoji && bk.close < borneRangeL)
                ) {
                  statutL = 'ANNULE';
                  break;
                }
              }
            }
            if (statutL === 'ANNULE') continue;
            if (bougiesObsL < nbBougiesConfirmation) statutL = 'EN_COURS';

            const distSLL = Math.max(0.0001, Math.abs(prixEntreeL - petitSLL));
            const distGrandTP = Math.abs(prixTP_HTF - prixEntreeL);
            const rrFractal = Number((distGrandTP / distSLL).toFixed(2));

            // Suivi post-confirmation du Second Setup LTF vers le Grand TP HTF
            let estTermL = false;
            let resTradeL: ResultatTradeSMC = 'EN_COURS';
            let idxSortieL: number | undefined;
            let tSortieL: number | string | undefined;

            if (statutL === 'CONFIRME') {
              for (let m = idxDojiL + nbBougiesConfirmation + 1; m < bougies.length; m++) {
                const bm = bougies[m];
                const tpAtteint = estAchatHTF ? bm.high >= prixTP_HTF : bm.low <= prixTP_HTF;
                const slAtteint = estAchatHTF ? bm.low <= petitSLL : bm.high >= petitSLL;
                if (tpAtteint || slAtteint) {
                  estTermL = true;
                  resTradeL = tpAtteint ? 'TP_TOUCHE' : 'SL_TOUCHE';
                  idxSortieL = m;
                  tSortieL = bm.time;
                  break;
                }
              }
            }

            const secondSetupFractal: SetupOrchestreSMC = {
              id: `smc-fractal-ltf-${idxDojiL}`,
              type: dLTF.type,
              statut: statutL,
              indexDoji: idxDojiL,
              tempsDoji: dLTF.temps,
              tempsDebutPlage: dLTF.tempsDebutPlage,
              indexDebutPlage: dLTF.indexDebutPlage,
              prixEntree: prixEntreeL,
              prixSL: petitSLL,
              distanceSL: distSLL,
              scoreShved: setupHTF.scoreShved,
              bougiesObservees: bougiesObsL,
              borneRangeConfirmation: borneRangeL,
              indexConfirmation: idxFinVerifL,
              tempsConfirmation: bougies[idxFinVerifL]?.time ?? dLTF.temps,
              prixTP: prixTP_HTF,
              ordreTP: 1,
              palierTPVise: 'TP1',
              distanceTP: distGrandTP,
              ratioRR: rrFractal,
              orderBlocksProteges: obsInternesLTF,
              estSecondSetupFractalLTF: true,
              timeframeMaitreHTF: tfMaitre.toUpperCase(),
              prixSLMaitreHTF: prixSL_HTF,
              bornePlageMaitreHTF: borneRange_HTF,
              estTermine: estTermL,
              resultatTrade: resTradeL,
              indexSortieTrade: idxSortieL,
              tempsSortieTrade: tSortieL,
            };

            if (indexExistant >= 0) {
              // Promouvoir le setup LTF existant pour le brancher sur le Grand TP du Setup Maître HTF
              setups[indexExistant] = {
                ...setups[indexExistant],
                ...secondSetupFractal,
              };
            } else {
              setups.push(secondSetupFractal);
              totalDetectes++;
              if (statutL === 'CONFIRME') {
                totalConfirmes++;
                sommeRRConfirmes += rrFractal;
              }
            }

            // En mode Cockpit Fractal LTF, on garde visibles toutes les positions LTF prises dans la Plage H4 active
            // afin que le trader visualise clairement chaque objet Position (style TradingView) et son résultat (TP / Petit SL / En cours)
            const dateEntreeLTF = bougies[idxFinVerifL]?.time ?? dLTF.temps;
            const idxFinBoiteLTF = idxSortieL !== undefined
              ? idxSortieL
              : Math.min(bougies.length - 1, idxFinVerifL + Math.max(12, dureeSegmentsCibles * 4));
            const dateFinBoiteLTF = tSortieL ?? bougies[idxFinBoiteLTF]?.time ?? derniereBougieVisible.time;

            // 🟩 Boîte de Gain (Zone TP style TradingView : Entrée LTF ➔ Grand TP H4)
            boites.push({
              id: `fractal-ltf-tv-tp-${idxDojiL}`,
              prixHaut: Math.max(prixEntreeL, prixTP_HTF),
              prixBas: Math.min(prixEntreeL, prixTP_HTF),
              dateDebut: dateEntreeLTF,
              dateFin: dateFinBoiteLTF,
              couleurFond: 'rgba(8, 153, 129, 0.24)',
              couleurBordure: '#089981',
              label: `🎯 TP ${tfMaitre.toUpperCase()} (${rrFractal}R)`,
            });

            // 🟥 Boîte de Risque (Zone SL style TradingView : Entrée LTF ➔ Petit SL LTF)
            boites.push({
              id: `fractal-ltf-tv-sl-${idxDojiL}`,
              prixHaut: Math.max(prixEntreeL, petitSLL),
              prixBas: Math.min(prixEntreeL, petitSLL),
              dateDebut: dateEntreeLTF,
              dateFin: dateFinBoiteLTF,
              couleurFond: 'rgba(242, 54, 69, 0.30)',
              couleurBordure: '#F23645',
              label: `🛑 Petit SL (${tfGraphique.toUpperCase()})`,
            });

            // Point repère sur la mèche du Doji déclencheur LTF
            points.push({
              id: `fractal-ltf-pt-${idxDojiL}`,
              prix: petitSLL,
              date: dLTF.temps,
              couleur: '#F59E0B',
              rayon: 4,
              style: 'plein',
            });
          }
        }
      }
    }
  }

  const ratioMoyenRR = totalConfirmes > 0
    ? Number((sommeRRConfirmes / totalConfirmes).toFixed(2))
    : 0;

  const totalTermines = totalTPTouches + totalSLTouches;
  const tauxReussiteTP = totalTermines > 0
    ? Number(((totalTPTouches / totalTermines) * 100).toFixed(1))
    : 0;

  return {
    setups,
    primitives: { labels, lignes, boites, points },
    statistiques: {
      totalDetectes,
      totalConfirmes,
      totalActifs,
      totalTPTouches,
      totalSLTouches,
      totalAnnules,
      totalEnCours,
      totalAchatsConfirmes,
      totalVentesConfirmees,
      ratioMoyenRR,
      tauxReussiteTP,
    },
  };
}

/**
 * 🧪 Recalcule en temps réel un setup individuel avec une nouvelle valeur de la variable « Profondeur » (zigzagDepth).
 * Permet à l'utilisateur de modifier la profondeur ZigZag d'un setup spécifique en direct sur le graphique
 * pour observer instantanément :
 *  - Les nouvelles vagues de ZigZag (section V1, V2...)
 *  - Le nouvel histogramme Volume Profile de chevauchement UOP (verrouillé à la 3ème bougie)
 *  - Le nouveau Take Profit (TP), le nouveau ratio R:R
 *  - Et si ce trade aurait touché son TP ou son SL avec cette valeur de profondeur !
 *
 * Exemple :
 * const setupTeste = recalculerSetupAvecProfondeurZigZag(setupActuel, bougies, 6);
 */
export function recalculerSetupAvecProfondeurZigZag(
  setup: SetupOrchestreSMC,
  bougies: Bougie[],
  nouvelleProfondeur: number,
  nouveauNbVagues?: number
): SetupOrchestreSMC {
  if (!bougies || bougies.length === 0) return setup;

  const estAchat = setup.type === 'ACHAT';
  const depthCible = Math.max(1, Math.min(20, Math.round(nouvelleProfondeur)));
  const profondeurOriginale =
    setup.profondeurZigZagOriginale ??
    setup.detailsScoreLiquidationZigZag?.zigzagDepthRetenu ??
    4;

  // Détermination automatique cohérente du backstep et superposition des 10 dernières vagues
  const vitesseSimulee: 1 | 2 | 3 = depthCible <= 3 ? 1 : depthCible <= 5 ? 2 : 3;
  const backstepCible = vitesseSimulee === 1 ? 1 : vitesseSimulee === 2 ? 2 : 3;
  const nbVaguesCible =
    nouveauNbVagues !== undefined
      ? Math.max(2, Math.min(20, Math.round(nouveauNbVagues)))
      : 10;

  // 1️⃣ Verrouillage à la 3ème bougie de confirmation du setup
  // On retrouve la bougie exacte dans le tableau par son horodatage (tempsConfirmation / tempsDoji) !
  // Cela évite tout décalage d'index si `bougies` est l'historique complet (> 350 bougies) au lieu de la fenêtre glissante.
  let indexDojiReel = bougies.findIndex((b) => String(b.time) === String(setup.tempsDoji));
  if (indexDojiReel === -1) {
    indexDojiReel = Math.min(setup.indexDoji, bougies.length - 1);
  }

  let indexHorizon =
    setup.tempsConfirmation !== undefined
      ? bougies.findIndex((b) => String(b.time) === String(setup.tempsConfirmation))
      : -1;
  if (indexHorizon === -1) {
    indexHorizon = Math.min(indexDojiReel + 3, bougies.length - 1);
  }

  // On découpe la fenêtre menant exactement jusqu'à la 3ème bougie de confirmation (max 350 bougies comme en mode Auto)
  const indexDebutFenetre = Math.max(0, indexHorizon - 350 + 1);
  const bougiesHorizon = bougies.slice(indexDebutFenetre, indexHorizon + 1);

  const seuilBleuAdapte = nbVaguesCible <= 2 ? 2 : 3;

  // 2️⃣ Recalcul du profil de chevauchement UOP avec cette profondeur
  // Si l'historique avant ce setup est trop court pour une grande profondeur (ex: < 2 pivots),
  // on redescend progressivement le depth effectif pour garantir au moins 2 pivots et 1 vague visible.
  let depthEffectif = depthCible;
  let uopSimule = calculerUnmitigatedOverlapProfile(bougiesHorizon, {
    zigzagDepth: depthEffectif,
    zigzagBackstep: backstepCible,
    nbVaguesSuperposees: nbVaguesCible,
    seuilBougiesBleuFonce: seuilBleuAdapte,
    typeChevauchementUOP: 'CORPS_ET_MECHES',
    poidsCorps: 1.0,
    poidsMeche: 1.0,
    inclureVagueCourante: true,
    afficherTPOptimaux: true,
    afficherZigZag: false,
    afficherBarresProfil: false,
    afficherProlongation: false,
    afficherDebugTP: true,
  });

  while (
    depthEffectif > 1 &&
    (!uopSimule.pivots || uopSimule.pivots.length < 2 || !uopSimule.paliersSuperposition || uopSimule.paliersSuperposition.length === 0)
  ) {
    depthEffectif--;
    uopSimule = calculerUnmitigatedOverlapProfile(bougiesHorizon, {
      zigzagDepth: depthEffectif,
      zigzagBackstep: Math.max(1, Math.min(backstepCible, depthEffectif)),
      nbVaguesSuperposees: nbVaguesCible,
      seuilBougiesBleuFonce: seuilBleuAdapte,
      typeChevauchementUOP: 'CORPS_ET_MECHES',
      poidsCorps: 1.0,
      poidsMeche: 1.0,
      inclureVagueCourante: true,
      afficherTPOptimaux: true,
      afficherZigZag: false,
      afficherBarresProfil: false,
      afficherProlongation: false,
      afficherDebugTP: true,
    });
  }

  // 3️⃣ Extraction de la section de ZigZag (N + 1 pivots) correspondant à cette profondeur
  const tousPivots = uopSimule.pivots || [];
  const nbPivotsSection = Math.max(2, nbVaguesCible + 1);
  const pivotsPertinents = tousPivots.slice(-nbPivotsSection);
  const pivotsZigZagFinaux =
    pivotsPertinents.length >= 2
      ? pivotsPertinents.map((p) => ({
          index: p.index,
          temps: p.temps,
          prix: p.prix,
          type: (p.estHaut ? 'HIGH' : 'LOW') as 'HIGH' | 'LOW',
        }))
      : setup.detailsScoreLiquidationZigZag?.pivotsZigZag || [];

  // 4️⃣ Extraction des nouveaux paliers TP candidats dans la direction du setup
  const tpsCandidats = estAchat
    ? (uopSimule.tpOptimauxAchat || []).filter((tp) => tp.prixCible > setup.prixEntree)
    : (uopSimule.tpOptimauxVente || []).filter((tp) => tp.prixCible < setup.prixEntree);

  const paliersTries = [...tpsCandidats].sort(
    (a, b) => Math.abs(a.prixCible - setup.prixEntree) - Math.abs(b.prixCible - setup.prixEntree)
  );

  const palierTPVise = setup.palierTPVise || 'TP1';
  let indexVise = 0;
  if (palierTPVise === 'TP2') indexVise = 1;
  else if (palierTPVise === 'TP3') indexVise = 2;

  let nouveauTpSelectionne = setup.tpSelectionne;
  let nouveauPrixTP = setup.prixTP;
  let nouvelOrdreTP = setup.ordreTP ?? 1;
  let nouveauxPaliersAnalyses = setup.paliersAnalyses || [];

  if (paliersTries.length > 0) {
    const idxEff = Math.min(indexVise, paliersTries.length - 1);
    nouveauTpSelectionne = paliersTries[idxEff];
    nouvelOrdreTP = idxEff + 1;
    nouveauPrixTP = nouveauTpSelectionne.prixCible;
    nouveauxPaliersAnalyses = paliersTries.slice(0, nouvelOrdreTP).map((tp, idx) => ({
      prix: tp.prixCible,
      ordre: idx + 1,
      estPerce: idx < nouvelOrdreTP - 1,
      estBloquant: idx === nouvelOrdreTP - 1,
      tauxChevauchement: tp.tauxMoyenChevauchement,
    }));
  } else {
    const multSecours = indexVise === 2 ? 3.5 : indexVise === 1 ? 2.5 : 1.5;
    nouveauPrixTP = estAchat
      ? setup.prixEntree + setup.distanceSL * multSecours
      : setup.prixEntree - setup.distanceSL * multSecours;
    nouvelOrdreTP = indexVise + 1;
    nouveauTpSelectionne = undefined;
  }

  const nouvelleDistanceTP =
    nouveauPrixTP !== undefined ? Math.abs(nouveauPrixTP - setup.prixEntree) : setup.distanceTP;
  const nouveauRatioRR =
    nouvelleDistanceTP !== undefined
      ? Number((nouvelleDistanceTP / Math.max(0.0001, setup.distanceSL)).toFixed(2))
      : setup.ratioRR;

  // 5️⃣ Simulation en temps réel de l'issue du trade sur la suite des bougies (TP touché ou SL touché ?)
  let estTermine = false;
  let resultatTrade: ResultatTradeSMC = 'EN_COURS';
  let indexSortieTrade: number | undefined;
  let tempsSortieTrade: number | string | undefined;

  if (setup.statut === 'CONFIRME' && nouveauPrixTP !== undefined) {
    const indexDebutSuivi = indexHorizon + 1;
    for (let k = indexDebutSuivi; k < bougies.length; k++) {
      const b = bougies[k];
      if (!b) continue;
      if (estAchat) {
        const tpTouche = b.high >= nouveauPrixTP;
        const slTouche = b.low <= setup.prixSL;
        if (tpTouche || slTouche) {
          estTermine = true;
          resultatTrade = tpTouche ? 'TP_TOUCHE' : 'SL_TOUCHE';
          indexSortieTrade = k;
          tempsSortieTrade = b.time;
          break;
        }
      } else {
        const tpTouche = b.low <= nouveauPrixTP;
        const slTouche = b.high >= setup.prixSL;
        if (tpTouche || slTouche) {
          estTermine = true;
          resultatTrade = tpTouche ? 'TP_TOUCHE' : 'SL_TOUCHE';
          indexSortieTrade = k;
          tempsSortieTrade = b.time;
          break;
        }
      }
    }
  }

  // 6️⃣ Mise à jour des détails ZigZag du setup avec la profondeur testée
  const detailsZZOrig = setup.detailsScoreLiquidationZigZag;
  const categorieVagues =
    vitesseSimulee === 1
      ? 'PETITES_VAGUES'
      : vitesseSimulee === 2
        ? 'VAGUES_MOYENNES'
        : 'GRANDES_VAGUES';

  const nouveauxDetailsZZ: DetailsScoreLiquidationZigZag | undefined = detailsZZOrig
    ? {
        ...detailsZZOrig,
        vitesseRetenue: vitesseSimulee,
        zigzagDepthRetenu: depthCible,
        zigzagBackstepRetenu: backstepCible,
        nbVaguesSuperposeesRetenu: nbVaguesCible,
        categorieVagues,
        resumeExplication:
          depthCible !== profondeurOriginale
            ? `🧪 Profondeur testée : ${depthCible} (Auto: ${profondeurOriginale}) ➔ ${nbVaguesCible} vagues (Vitesse ${vitesseSimulee})`
            : detailsZZOrig.resumeExplication,
        pivotsZigZag: pivotsZigZagFinaux,
      }
    : undefined;

  return {
    ...setup,
    prixTP: nouveauPrixTP,
    ordreTP: nouvelOrdreTP,
    distanceTP: nouvelleDistanceTP,
    ratioRR: nouveauRatioRR,
    tpSelectionne: nouveauTpSelectionne,
    paliersAnalyses: nouveauxPaliersAnalyses,
    tousPaliersUOPCandidats: tpsCandidats,
    detailsScoreLiquidationZigZag: nouveauxDetailsZZ,
    stepUOP: uopSimule.step || setup.stepUOP,
    seuilBleuFonceUOP: seuilBleuAdapte,
    paliersSuperpositionUOP:
      uopSimule.paliersSuperposition && uopSimule.paliersSuperposition.length > 0
        ? uopSimule.paliersSuperposition
        : setup.paliersSuperpositionUOP,
    vaguesSuperposeesUOP:
      uopSimule.vaguesSuperposees && uopSimule.vaguesSuperposees.length > 0
        ? uopSimule.vaguesSuperposees
        : setup.vaguesSuperposeesUOP,
    profondeurZigZagOriginale: profondeurOriginale,
    profondeurZigZagPersonnalisee: depthCible,
    estTermine,
    resultatTrade,
    indexSortieTrade,
    tempsSortieTrade,
  };
}
