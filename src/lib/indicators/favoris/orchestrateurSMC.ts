import type { Bougie } from '@/lib/chartDataHelper';
import type { VisualPrimitives, VisualLabel, VisualLine, VisualBox, VisualPoint } from '@/types/indicatorScript';
import {
  detecterDojisAvecPlage,
  evaluerNiveauxShvedDansPlage,
  convertirTempsEnMs,
  type SignalDojiAvecPlage,
  type ZoneShvedAvecScore,
} from './sandboxDojiShvedPlage';

export type { ZoneShvedAvecScore };
import {
  calculerShvedSupplyDemand,
  type ZoneShved,
} from '@/lib/bot/modules/01_liquidite/shvedSupplyDemand';
import {
  calculerUnmitigatedOverlapProfile,
  type ResultatUOP,
  type TPOptimalUOP,
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

  // ─── ⏱️ Multi-Timeframe & Shved ───
  timeframeSource?: string;             // Unité de temps Shved (défaut: 'M15')
  donneesM1?: Bougie[];                 // Données M1 pour calcul MTF
  chartTimeframe?: string;              // Unité de temps du graphique
  scoreMinimumShved?: number;           // Seuil minimal de score Shved (0 à 100, défaut: 0)

  // ─── ⏳ Range de Confirmation (3 Bougies) ───
  nbBougiesConfirmation?: number;        // Nombre de bougies de confirmation du range (défaut: 3)
  afficherSetupsAnnules?: boolean;       // Afficher les signaux invalidés avec un badge discret (défaut: false)

  // ─── 🧹 Épuration Active : Masquage des Setups Passés (TP ou SL Touché) ───
  masquerSetupsTermines?: boolean;      // Masquer du graphique les setups dont le TP ou SL a déjà été touché (défaut: true)

  // ─── 🚀 Moteur d'Énergie & Coût des Péages UOP (Variables Externes Réglables) ───
  modeCalculTP?: 'STANDARD_SHVED' | 'ENERGIE_FRICTION'; // Méthode de calcul du TP optimal (défaut: 'ENERGIE_FRICTION')
  palierTPVise?: 'AUTO' | 'TP1' | 'TP2' | 'TP3'; // Choix forcé du palier TP ('AUTO', 'TP1', 'TP2', 'TP3') (défaut: 'AUTO')
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
  zigzagDepth?: number;                  // Sensibilité ZigZag UOP (défaut: 8)
  nbVaguesSuperposees?: number;          // Nombre de vagues superposées UOP (défaut: 4)

  // ─── 🛣️ Condition d'Autoroute UOP Obligatoire ───
  exigerAutorouteUOP?: boolean;          // [COND-UOP-04] Exiger une autoroute UOP en face du trade (rejette si faible chevauchement uniquement) (défaut: true)
  minTauxChevauchementAutoroute?: number; // [COND-UOP-04] Taux minimum de bougies de chevauchement requis pour qualifier l'autoroute (défaut: 3.0)

  // ─── 🎯 Filtre Plage Temporelle TP UOP ───
  activerFiltrePlageTP?: boolean;        // [COND-PLAGE-TP-01] Exige que le Doji soit l'extrême absolu de toute la plage entre la bougie contenant le TP et le Doji (défaut: true)
  maxReculPlageTP?: number;              // Nombre max de bougies de recul pour trouver la bougie contenant le prix du TP (défaut: 100)

  // ─── 🎨 Visuels Épurés & Minimalistes (Ergonomie Pro) ───
  modeVisuel?: 'EPURE' | 'COMPLET';      // 'EPURE' (point discret + micro-segments) ou 'COMPLET' (défaut: 'EPURE')
  afficherPointDoji?: boolean;           // Point discret sur la mèche du Doji (défaut: true)
  afficherPointsLiquidation?: boolean;   // Affiche le badge compact des points de liquidité captés sur le Doji (défaut: true)
  afficherSegmentSR?: boolean;           // Segment discontinu du S/R Shved balayé (défaut: true)
  afficherPaliersUOP?: boolean;          // Micro-segments pointillés très fins pour chaque palier d'overlap UOP rencontré (défaut: true)
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
  bougieInvalidationIndex?: number; // Index de la bougie ayant invalidé le SL si annulé

  // Cible Take Profit Optimal (UOP)
  prixTP?: number;              // Prix cible du Take Profit
  ordreTP?: number;             // Ordre du TP choisi (1 pour TP1, 2 pour TP2, 3 pour TP3)
  palierTPVise?: 'AUTO' | 'TP1' | 'TP2' | 'TP3'; // Choix forcé ou automatique du palier
  distanceTP?: number;          // Distance en points entre entrée et TP
  ratioRR?: number;             // Ratio Risque/Rendement (R:R)
  tpSelectionne?: TPOptimalUOP;

  // 🚀 Données du Moteur d'Énergie UOP (Carburant vs Friction)
  carburantInitial?: number;    // Réservoir de carburant capté lors de la liquidation
  carburantRestant?: number;    // Carburant restant à l'ancrage du TP
  paliersTraverses?: number;    // Nombre de murs de liquidité UOP franchis
  estLimiteParPalier?: boolean; // Vrai si le TP a calé devant un palier infranchissable
  paliersAnalyses?: PalierUOPAnalyse[]; // Liste ordonnée des paliers UOP rencontrés sur la route
  etapesPaliersUOP?: EtapePalierUOPDetail[]; // Trajet pas-à-pas à travers chaque palier UOP
  detailsCarburant?: DetailsCarburantLiquidation; // Détails du calcul du carburant initial
  tousPaliersUOPCandidats?: TPOptimalUOP[]; // Tous les paliers UOP candidats disponibles

  // 🎯 Filtre Plage Temporelle TP UOP
  infoPlageTP?: InfoValidationPlageTP; // Détails de validation de la plage temporelle du TP

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
}): ResultatCarburantLiquidation {
  const {
    nombreRetests,
    profondeurMeche,
    hauteurMoyenne,
    pointsParRetest = 100,
    plafondCarburantRetests = 400,
    bonusMecheProfonde = 1.6,
    bonusMecheNormale = 1.3,
  } = options;

  // 1️⃣ Barème configurable des retests S/R ([COND-ENERGIE-01])
  let pointsRetests = pointsParRetest;
  if (nombreRetests <= 0) {
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
  const minTauxChevauchementAutoroute = Math.max(0.5, Number(parametres.minTauxChevauchementAutoroute ?? 3.0));
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

  // 2️⃣ Extraction des Niveaux Shved Supply & Demand
  const resultatShved = calculerShvedSupplyDemand(bougies, {
    timeframeSource: parametres.timeframeSource || 'M15',
    donneesM1: parametres.donneesM1,
    chartTimeframe: parametres.chartTimeframe,
    supprimerZonesCassees: false,
    afficherNonRetestees: true,
    afficherFaibles: true,
    minRetests: 0,
    maxLookbackBars: 250,
    afficherZones: false,
    afficherLignes: false,
    afficherEtiquettes: false,
  });

  const toutesLesZonesShved: ZoneShved[] = [
    ...resultatShved.supports,
    ...resultatShved.resistances,
  ];

  // 3️⃣ Extraction du Profil UOP (Chevauchement & TP Optimaux)
  const resultatUOP: ResultatUOP = calculerUnmitigatedOverlapProfile(bougies, {
    zigzagDepth: Number(parametres.zigzagDepth ?? 8),
    nbVaguesSuperposees: Number(parametres.nbVaguesSuperposees ?? 4),
    inclureVagueCourante: true,
    afficherTPOptimaux: true,
    afficherZigZag: false,
    afficherBarresProfil: false,
    afficherProlongation: false,
  });

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

  // 5️⃣ Traitement et Orchestration de chaque signal
  for (const doji of signauxDojis) {
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
        exigerDebutEtFinDansPlage: true,
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
    // 🛣️ [COND-UOP-04] CONDITION D'AUTOROUTE UOP OBLIGATOIRE EN FACE DU TRADE
    // ────────────────────────────────────────────────────────────────────────────
    // Même si le Doji a capté du carburant par liquidation, si en face de nous
    // il n'y a PAS de vraie autoroute (uniquement un terrain à faible chevauchement
    // ou aucun palier goudronné UOP), on ne considère PAS cela comme un setup !
    const tpsCandidats = estAchat
      ? (resultatUOP.tpOptimauxAchat || []).filter((tp) => tp.prixCible > prixEntree)
      : (resultatUOP.tpOptimauxVente || []).filter((tp) => tp.prixCible < prixEntree);

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

    // B. CIBLE TP OPTIMAL & MOTEUR D'ÉNERGIE UOP (CARBURANT VS FRICTION)
    const palierTPVise = parametres.palierTPVise || 'AUTO';
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
    let statut: StatutSetupSMC = 'CONFIRME';
    let bougiesObservees = 0;
    let bougieInvalidationIndex: number | undefined;

    const indexFinVerification = Math.min(indexDoji + nbBougiesConfirmation, bougies.length - 1);

    for (let k = indexDoji + 1; k <= indexFinVerification; k++) {
      bougiesObservees++;
      const bougieActuelle = bougies[k];

      if (estAchat) {
        // En Achat : si une bougie passe SOUS le plus bas du Doji (prixSL), le setup est invalidé
        if (bougieActuelle.low <= prixSL) {
          statut = 'ANNULE';
          bougieInvalidationIndex = k;
          break;
        }
      } else {
        // En Vente : si une bougie passe AU-DESSUS du plus haut du Doji (prixSL), le setup est invalidé
        if (bougieActuelle.high >= prixSL) {
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
      prixTP,
      ordreTP,
      palierTPVise,
      distanceTP,
      ratioRR,
      tpSelectionne,
      carburantInitial,
      carburantRestant,
      detailsCarburant,
      paliersTraverses,
      estLimiteParPalier,
      paliersAnalyses,
      etapesPaliersUOP,
      tousPaliersUOPCandidats: tpsCandidats,
      infoPlageTP,
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

    // 1️⃣.bis ⚡ Badge Compact de Liquidation : Quantité de points de liquidité captés
    // Affiche par exemple "⚡ 450 pts" de manière très discrète au niveau du Doji
    if (afficherPointsLiquidation && carburantInitial && carburantInitial > 0 && (statut === 'CONFIRME' || statut === 'EN_COURS')) {
      labels.push({
        id: `orchestre-liq-pts-${indexDoji}`,
        prix: prixSL,
        date: dateDoji,
        texte: `⚡ ${carburantInitial} pts`,
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
        lignes.push({
          id: `orchestre-tp-${indexDoji}`,
          prix: prixTP,
          dateDebut: dateDoji,
          dateFin: dateFinCible,
          couleur: '#00E676',
          epaisseur: 1.5,
          style: 'solid',
          label: `TP (${ratioRR}R${carburantInitial ? ` | ${carburantInitial}pts` : ''})`,
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
