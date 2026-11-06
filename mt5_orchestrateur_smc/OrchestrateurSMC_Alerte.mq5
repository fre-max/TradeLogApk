//+------------------------------------------------------------------+
//|                                      OrchestrateurSMC_Alerte.mq5 |
//|              🎼 Chef d'Orchestre SMC - Version MetaTrader 5       |
//|   Indicateur d'Alerte & Diagnostic Visuel (Optimisé Multi-VPS)   |
//+------------------------------------------------------------------+
#property copyright   "JournalMobileAPK - Orchestrateur SMC MT5"
#property version     "1.10"
#property description "Orchestrateur Stratégique SMC (Optimisé VPS : Court-circuit N-3 + Décalage Anti-Pic CPU + Doji + Shved Collines + ZigZag Dynamique 4-20 + UOP)"
#property indicator_chart_window
#property indicator_buffers 2
#property indicator_plots   2

// Plot 1 : Flèche d'alerte Achat sur la 3ème bougie de confirmation
#property indicator_label1  "Setup Achat Confirmé (3b)"
#property indicator_type1   DRAW_ARROW
#property indicator_color1  clrSpringGreen
#property indicator_width1  2

// Plot 2 : Flèche d'alerte Vente sur la 3ème bougie de confirmation
#property indicator_label2  "Setup Vente Confirmé (3b)"
#property indicator_type2   DRAW_ARROW
#property indicator_color2  clrCrimson
#property indicator_width2  2

// ─── 📦 Inclusion des 6 Modules de l'Architecture Modulaire ─────────────────────
#include "Modules/Module00_TypesEtOutils.mqh"
#include "Modules/Module01_DojiEtPlage.mqh"
#include "Modules/Module02_ShvedEtCollines.mqh"
#include "Modules/Module03_ZigZagDynamiqueUOP.mqh"
#include "Modules/Module04_EnergieEtConfirmation.mqh"
#include "Modules/Module05_VisuelsEtAlertes.mqh"
#include "Modules/Module06_MoteurEvaluationRapide.mqh"

// ==============================================================================
// ⚙️ PARAMÈTRES D'ENTRÉE (INPUTS META TRADER 5)
// ==============================================================================

input group "=== 🚀 0. OPTIMISATIONS VPS (ANTI-PIC CPU & COURT-CIRCUIT N-3) ==="
input bool   InpActiverCourtCircuitVPS    = true;         // ⚡ Court-circuit N-3 : arrête le calcul en 0.01ms si aucun Doji récent
input bool   InpActiverDecalageVPS        = true;         // ⏱️ Étaler automatiquement le calcul des paires à XX:00 (Anti-goulot VPS)
input int    InpDelaiMaxDecalageSec       = 8;            // Délai maximal d'étalement entre les paires (en secondes, ex: 0 à 8s)

input group "=== 🔔 1. ALERTES MT5 (APRÈS LES 3 BOUGIES DE CONFIRMATION) ==="
input bool   InpActiverAlertePopup        = true;         // Activer la fenêtre d'alerte Popup + Son sur MT5
input bool   InpActiverNotificationPush   = true;         // Envoyer une notification Push sur le téléphone (App MT5)
input bool   InpActiverAlerteEmail        = false;        // Envoyer un Email lors de la confirmation
input bool   InpActiverSonSeul            = false;        // Jouer un son même si la Popup est désactivée
input string InpFichierSon                = "alert2.wav"; // Fichier sonore d'alerte

input group "=== 🕯️ 2. DÉCLENCHEUR DOJI LIQ/REINT & PLAGE CIBLÉE (BLOC 1) ==="
input bool   InpActiverAchat              = true;         // Autoriser les setups d'Achat (Spring)
input bool   InpActiverVente              = true;         // Autoriser les setups de Vente (UTAD)
input bool   InpActiverFiltreTaille       = true;         // Filtrer les Dojis par taille relative (> moyenne)
input int    InpPeriodeHistorique         = 10;           // Période pour la moyenne de taille des bougies
input double InpMultiplicateurBougie1     = 1.0;          // Multiplicateur minimal Bougie 1 (Liquidation)
input double InpMultiplicateurCorps2      = 1.2;          // Multiplicateur minimal Corps Bougie 2 (Réintégration)
input double InpToleranceDeficit          = 0.30;         // Tolérance de déficit de réintégration (30%)
input double InpToleranceDepassement      = 2.0;          // Tolérance de dépassement favorable (200%)
input int    InpMaxReculRecherche         = 100;          // Recul max (en bougies) pour trouver l'extrême précédent
input int    InpMaxBougiesAnalysees       = 600;          // Nombre de bougies récentes analysées sur le graphique

input group "=== 🛡️ 3. S/R SHVED & VRAIES COLLINES DE RETESTS (BLOC 2) ==="
input int    InpPeriodeATRShved           = 2;            // Période ATR pour l'épaisseur des zones Shved
input double InpZoneFuzzFactor            = 0.01;         // Facteur d'épaisseur des zones Shved (0.01 = précis)
input int    InpScoreMinimumShved         = 0;            // Score minimal Shved requis (/100) pour accepter un setup
input bool   InpExigerDebutEtFinDansPlage = false;        // Exiger que le S/R soit né strictement dans la plage

input group "=== 🌊 4. ZIGZAG DYNAMIQUE (4-20) & PROFIL UOP (BLOC 3) ==="
input bool                         InpActiverZigZagDynamique     = true;        // Adapter la taille des vagues ZigZag (4 à 20) selon la liquidité
input int                          InpZigZagDepthMin             = 4;           // Taille minimale des vagues ZigZag (faible liquidité)
input int                          InpZigZagDepthMax             = 20;          // Taille maximale des vagues ZigZag (forte liquidité)
input int                          InpZigZagDepthSecours         = 8;           // Profondeur ZigZag fixe si le mode dynamique est désactivé
input int                          InpNbVaguesSuperposees        = 4;           // Nombre de vagues ZigZag superposées dans l'UOP
input ENUM_TYPE_CHEVAUCHEMENT_UOP  InpTypeChevauchementUOP       = UOP_PONDERE; // Anatomie UOP (Pondéré Corps/Mèches, Corps seul, Complet)
input double                       InpPoidsCorpsUOP              = 1.0;         // Poids attribué au corps de la bougie dans l'UOP
input double                       InpPoidsMecheUOP              = 0.25;        // Poids attribué aux mèches dans l'UOP
input bool                         InpExigerAutorouteUOP         = true;        // Exiger une vraie autoroute fluide UOP en face du trade
input double                       InpMinTauxAutoroute           = 1.5;         // Taux minimum de chevauchement pour valider l'autoroute
input bool                         InpActiverFiltrePlageTP       = true;        // Exiger que le Doji soit l'extrême absolu depuis la bougie TP
input int                          InpMaxReculPlageTP            = 100;         // Recul max (en bougies) pour trouver la bougie contenant le TP

input group "=== ⚡ 5. MOTEUR D'ÉNERGIE & CONFIRMATION 3 BOUGIES (BLOC 4) ==="
input int                   InpNbBougiesConfirmation     = 3;                       // Nombre de bougies de confirmation devant respecter le SL
input ENUM_MODE_CALCUL_TP   InpModeCalculTP              = MODE_TP_ENERGIE_FRICTION;// Méthode de calcul du Take Profit Optimal
input ENUM_PALIER_TP_VISE   InpPalierTPVise              = PALIER_AUTO;             // Palier TP visé (AUTO, TP1, TP2, TP3)
input int                   InpPointsParRetest           = 100;                     // Points de carburant de base par retest S/R
input int                   InpPlafondCarburantRetests   = 400;                     // Plafond maximal de carburant issu des retests
input double                InpBonusMecheProfonde        = 1.6;                     // Multiplicateur si mèche de cassure > 1.2x ATR
input double                InpBonusMecheNormale         = 1.3;                     // Multiplicateur si mèche de cassure entre 0.5x et 1.2x ATR
input int                   InpPeagePalierUOP            = 100;                     // Péage en carburant pour percer un palier UOP
input double                InpCoutParATR                = 50.0;                    // Consommation de carburant par unité d'ATR parcourue
input double                InpCoutFrictionFortOverlap   = 0.5;                     // Multiplicateur de friction en fort overlap (autoroute)
input double                InpCoutFrictionMoyenOverlap  = 1.0;                     // Multiplicateur de friction en overlap moyen
input double                InpCoutFrictionFaibleOverlap = 2.0;                     // Multiplicateur de friction en faible overlap (vide)
input double                InpSeuilFortOverlap          = 4.0;                     // Seuil de bougies pour qualifier un fort overlap
input double                InpSeuilFaibleOverlap        = 2.0;                     // Seuil en dessous duquel c'est un faible overlap
input double                InpMargeSecuriteDevantPalier = 0.15;                    // Marge de sécurité (en % d'ATR) devant un mur bloquant
input int                   InpSeuilScoreGrandMouvement  = 70;                      // Seuil de score Shved pour viser TP2 en mode Standard

input group "=== 🎨 6. AFFICHAGE VISUEL & DIAGNOSTIC DES COLLINES (BLOC 5) ==="
input bool  InpMasquerSetupsTermines      = true;           // Masquer automatiquement les setups passés (TP ou SL déjà touché)
input bool  InpAfficherPanneauHUD         = true;           // Afficher le tableau de bord HUD en haut à gauche
input bool  InpAfficherDiagnosticCollines = true;           // Tracer les collines de retest (⛰️), micro-rebonds (⚪) et ZigZag
input bool  InpAfficherPointDoji          = true;           // Afficher le point sur la mèche du Doji
input bool  InpAfficherPointsLiquidation  = true;           // Afficher le badge de carburant et ZigZag Depth
input bool  InpAfficherSegmentSR          = true;           // Afficher le segment du Support / Résistance Shved retenu
input bool  InpAfficherPaliersUOP         = true;           // Afficher les micro-segments des paliers UOP
input bool  InpAfficherSegmentSL          = true;           // Afficher le micro-segment Stop Loss (SL)
input bool  InpAfficherSegmentTP          = true;           // Afficher le micro-segment Take Profit (TP + R:R)
input int   InpDureeSegmentsCibles        = 4;              // Longueur (en bougies) des micro-segments SL / TP
input color InpCouleurAchat               = clrSpringGreen; // Couleur pour les setups d'Achat et Supports
input color InpCouleurVente               = clrCrimson;     // Couleur pour les setups de Vente et Résistances

// ─── 📊 Buffers d'indicateur (Flèches sur la bougie de confirmation) ───────────
double g_bufferConfirmationAchat[];
double g_bufferConfirmationVente[];

// ─── 🧠 Variables Globales d'État (Anti-doublon, Court-circuit & Décalage VPS) ──
datetime              g_derniereBarreCalculee          = 0;
datetime              g_dernierTempsConfirmationAlerte = 0;
bool                  g_historiqueInitialCalcule       = false;
int                   g_delaiDecalageMs                = 0;
bool                  g_calculDiffereEnAttente         = false;
bool                  g_aSetupActifEnCache             = false;
SetupOrchestreSMC_MT5 g_dernierSetupActifCache;

//+------------------------------------------------------------------+
//| Initialisation de l'indicateur MetaTrader 5                      |
//+------------------------------------------------------------------+
int OnInit()
{
   SetIndexBuffer(0, g_bufferConfirmationAchat, INDICATOR_DATA);
   PlotIndexSetInteger(0, PLOT_ARROW, 233); // Flèche haussière Wingdings
   PlotIndexSetDouble(0, PLOT_EMPTY_VALUE, 0.0);

   SetIndexBuffer(1, g_bufferConfirmationVente, INDICATOR_DATA);
   PlotIndexSetInteger(1, PLOT_ARROW, 234); // Flèche baissière Wingdings
   PlotIndexSetDouble(1, PLOT_EMPTY_VALUE, 0.0);

   ZeroMemory(g_dernierSetupActifCache);

   // Calcul du décalage temporel unique pour ce couple (Symbole, Timeframe)
   g_delaiDecalageMs = InpActiverDecalageVPS
      ? CalculerDelaiDecalageSymboleMs(_Symbol, _Period, InpDelaiMaxDecalageSec)
      : 0;

   IndicatorSetString(INDICATOR_SHORTNAME, "🎼 Orchestrateur SMC (Alerte 3b)");
   PrintFormat(
      "🚀 [Orchestrateur SMC MT5] Initialisé sur %s (%s) | Décalage VPS attribué : +%d ms | Court-Circuit N-3 : %s",
      _Symbol,
      EnumToString(_Period),
      g_delaiDecalageMs,
      InpActiverCourtCircuitVPS ? "ACTIF" : "INACTIF"
   );
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Nettoyage complet à la fermeture ou au retrait de l'indicateur   |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   SupprimerTousObjetsSMC();
   ChartRedraw(0);
}

//+------------------------------------------------------------------+
//| Exécute l'analyse sur les bougies courantes du graphique         |
//+------------------------------------------------------------------+
void ExecuterAnalyseGraphiqueCourant(int rates_total, const datetime &time[], const double &open[], const double &high[], const double &low[], const double &close[], const long &tick_volume[])
{
   int nbMax         = MathMax(150, InpMaxBougiesAnalysees);
   int decalageDebut = MathMax(0, rates_total - nbMax);
   int totalLocal    = rates_total - decalageDebut;
   int nbBougiesConf = MathMax(1, InpNbBougiesConfirmation);

   BougieSMC bougies[];
   ArrayResize(bougies, totalLocal);
   for(int i = 0; i < totalLocal; i++)
   {
      int idxGlobal     = decalageDebut + i;
      bougies[i].temps  = time[idxGlobal];
      bougies[i].open   = open[idxGlobal];
      bougies[i].high   = high[idxGlobal];
      bougies[i].low    = low[idxGlobal];
      bougies[i].close  = close[idxGlobal];
      bougies[i].volume = tick_volume[idxGlobal];
   }

   // ⚡ OPTIMISATION 1 : COURT-CIRCUIT RAPIDE SUR LES BOUGIES N-3 (0.01 ms)
   // Si l'historique initial a déjà été tracé, on vérifie d'abord s'il y a un Doji récent
   // en cours de confirmation OU si le setup actif en cache vient de toucher son TP/SL.
   if(InpActiverCourtCircuitVPS && g_historiqueInitialCalcule)
   {
      bool activiteDojiRecente = AActiviteRecenteDojiSMC(
         bougies, totalLocal, nbBougiesConf,
         InpActiverAchat, InpActiverVente, InpActiverFiltreTaille,
         InpPeriodeHistorique, InpMultiplicateurBougie1, InpMultiplicateurCorps2,
         InpToleranceDeficit, InpToleranceDepassement, InpMaxReculRecherche
      );

      bool setupActifTouche = false;
      if(g_aSetupActifEnCache && totalLocal >= 2)
      {
         BougieSMC bCloturee = bougies[totalLocal - 2];
         BougieSMC bCourante = bougies[totalLocal - 1];
         bool estAchatCache  = (g_dernierSetupActifCache.type == DIRECTION_ACHAT);

         bool toucheCloturee = estAchatCache
            ? (bCloturee.low <= g_dernierSetupActifCache.prixSL || bCloturee.high >= g_dernierSetupActifCache.prixTP)
            : (bCloturee.high >= g_dernierSetupActifCache.prixSL || bCloturee.low <= g_dernierSetupActifCache.prixTP);

         bool toucheCourante = estAchatCache
            ? (bCourante.low <= g_dernierSetupActifCache.prixSL || bCourante.high >= g_dernierSetupActifCache.prixTP)
            : (bCourante.high >= g_dernierSetupActifCache.prixSL || bCourante.low <= g_dernierSetupActifCache.prixTP);

         setupActifTouche = (toucheCloturee || toucheCourante);
      }

      // S'il n'y a ni Doji récent à confirmer ni changement d'état du setup actif : arrêt en 0.01 ms !
      if(!activiteDojiRecente && !setupActifTouche)
         return;
   }

   // Réinitialisation des buffers de flèches avant recalcul complet
   for(int i = 0; i < rates_total; i++)
   {
      g_bufferConfirmationAchat[i] = 0.0;
      g_bufferConfirmationVente[i] = 0.0;
   }

   // 2️⃣ BLOC 2 : Calcul des niveaux Supports & Résistances Shved (avec vraies collines)
   ZoneShvedSMC toutesLesZonesShved[];
   int totalZonesShved = CalculerShvedSupplyDemandSMC(
      bougies, totalLocal, totalLocal, InpPeriodeATRShved, InpZoneFuzzFactor, toutesLesZonesShved
   );

   // 3️⃣ BLOC 1 : Détection des Dojis de liquidation/réintégration et de leurs plages ciblées
   SignalDojiPlageSMC signauxDojis[];
   int totalDojis = DetecterDojisAvecPlage(
      bougies, totalLocal, 15,
      InpActiverAchat, InpActiverVente, InpActiverFiltreTaille,
      InpPeriodeHistorique, InpMultiplicateurBougie1, InpMultiplicateurCorps2,
      InpToleranceDeficit, InpToleranceDepassement, InpMaxReculRecherche,
      signauxDojis
   );

   SupprimerTousObjetsSMC();

   int totalConfirmes          = 0;
   int totalActifs             = 0;
   int totalEnAttente3Bougies  = 0;
   int totalTPTouches          = 0;
   int totalSLTouches          = 0;
   bool aDernierSetupActif     = false;
   SetupOrchestreSMC_MT5 dernierSetupActif;
   ZeroMemory(dernierSetupActif);

   // 4️⃣ Orchestration complète de chaque signal Doji détecté
   for(int d = 0; d < totalDojis; d++)
   {
      SignalDojiPlageSMC doji = signauxDojis[d];
      bool estAchat           = (doji.type == DIRECTION_ACHAT);
      int indexDoji           = doji.indexBougie;
      double prixEntree       = doji.close2;
      double prixSL           = doji.prixExtreme;
      double distanceSL       = MathMax(_Point, MathAbs(prixEntree - prixSL));

      ZoneShvedScoreeSMC zonesDansPlage[];
      int nbZonesPlage = EvaluerNiveauxShvedDansPlageSMC(
         toutesLesZonesShved, totalZonesShved, doji, bougies, totalLocal,
         InpExigerDebutEtFinDansPlage, 0, zonesDansPlage
      );

      bool aMeilleureZone = (nbZonesPlage > 0);
      int scoreShved      = aMeilleureZone ? zonesDansPlage[0].score : 0;
      if(scoreShved < InpScoreMinimumShved)
         continue;

      double profondeurMeche = distanceSL;
      double epaisseurZoneSR = 0.0;
      ZoneShvedScoreeSMC meilleureZone;
      ZeroMemory(meilleureZone);
      if(aMeilleureZone)
      {
         meilleureZone   = zonesDansPlage[0];
         profondeurMeche = estAchat
            ? MathMax(0.0, meilleureZone.zone.prixMedian - prixSL)
            : MathMax(0.0, prixSL - meilleureZone.zone.prixMedian);
         epaisseurZoneSR = MathAbs(meilleureZone.zone.prixHaut - meilleureZone.zone.prixBas);
      }

      double ampB2 = bougies[indexDoji].high - bougies[indexDoji].low;
      double ampB1 = bougies[MathMax(0, indexDoji - 1)].high - bougies[MathMax(0, indexDoji - 1)].low;
      double amplitudeBougieSweep = MathMax(ampB1, ampB2);

      DetailsScoreLiquidationZigZagSMC scoreZZ;
      ZeroMemory(scoreZZ);
      CalculerScoreLiquidationZigZagSMC(
         profondeurMeche, doji.moyenneHauteur, amplitudeBougieSweep, epaisseurZoneSR,
         aMeilleureZone, meilleureZone, InpZigZagDepthMin, InpZigZagDepthMax, scoreZZ
      );

      int depthActif = InpActiverZigZagDynamique ? scoreZZ.zigzagDepthRetenu : InpZigZagDepthSecours;

      PalierUOPCandidatSMC paliersCandidats[];
      int nbPaliers = CalculerPaliersUOPSMC(
         bougies, indexDoji, doji.type, prixEntree, depthActif, InpNbVaguesSuperposees,
         InpTypeChevauchementUOP, InpPoidsCorpsUOP, InpPoidsMecheUOP, scoreZZ, paliersCandidats
      );

      if(nbPaliers == 0 && depthActif != InpZigZagDepthSecours)
      {
         nbPaliers = CalculerPaliersUOPSMC(
            bougies, indexDoji, doji.type, prixEntree, InpZigZagDepthSecours, InpNbVaguesSuperposees,
            InpTypeChevauchementUOP, InpPoidsCorpsUOP, InpPoidsMecheUOP, scoreZZ, paliersCandidats
         );
      }

      if(InpExigerAutorouteUOP)
      {
         if(nbPaliers <= 0)
            continue;
         bool aUneAutorouteFluide = false;
         for(int p = 0; p < nbPaliers; p++)
         {
            if(paliersCandidats[p].tauxMoyenChevauchement >= InpMinTauxAutoroute)
            {
               aUneAutorouteFluide = true;
               break;
            }
         }
         if(!aUneAutorouteFluide)
            continue;
      }

      int carburantInitial = CalculerCarburantLiquidationSMC(
         aMeilleureZone, meilleureZone, profondeurMeche, doji.moyenneHauteur,
         InpPointsParRetest, InpPlafondCarburantRetests, InpBonusMecheProfonde, InpBonusMecheNormale
      );

      double prixTP           = 0.0;
      int ordreTP             = 1;
      int carburantRestant    = 0;
      int paliersTraverses    = 0;
      bool estLimiteParPalier = false;

      if(InpPalierTPVise != PALIER_AUTO)
      {
         int indexVise = (InpPalierTPVise == PALIER_TP3) ? 2 : ((InpPalierTPVise == PALIER_TP2) ? 1 : 0);
         ordreTP = indexVise + 1;
         if(nbPaliers > 0)
         {
            int idxEff         = MathMin(indexVise, nbPaliers - 1);
            prixTP             = paliersCandidats[idxEff].prixCible;
            ordreTP            = idxEff + 1;
            paliersTraverses   = ordreTP - 1;
            estLimiteParPalier = true;
            paliersCandidats[idxEff].estBloquant = true;
         }
         else
         {
            double multSecours = (ordreTP == 3) ? 3.5 : ((ordreTP == 2) ? 2.5 : 1.5);
            prixTP = estAchat ? (prixEntree + distanceSL * multSecours) : (prixEntree - distanceSL * multSecours);
         }
      }
      else if(InpModeCalculTP == MODE_TP_ENERGIE_FRICTION)
      {
         CalculerPorteeDynamiqueUOPSMC(
            prixEntree, prixSL, doji.type, carburantInitial, paliersCandidats, nbPaliers,
            doji.moyenneHauteur, InpPeagePalierUOP, InpCoutParATR,
            InpCoutFrictionFortOverlap, InpCoutFrictionMoyenOverlap, InpCoutFrictionFaibleOverlap,
            InpSeuilFortOverlap, InpSeuilFaibleOverlap, InpMargeSecuriteDevantPalier,
            prixTP, ordreTP, carburantRestant, paliersTraverses, estLimiteParPalier
         );
      }
      else
      {
         bool viserGrandMouvement = (scoreShved >= InpSeuilScoreGrandMouvement);
         if(nbPaliers > 0)
         {
            int idxChoisi = (viserGrandMouvement && nbPaliers >= 2) ? 1 : 0;
            prixTP        = paliersCandidats[idxChoisi].prixCible;
            ordreTP       = idxChoisi + 1;
         }
         else
         {
            double multSecours = viserGrandMouvement ? 2.5 : 1.5;
            prixTP  = estAchat ? (prixEntree + distanceSL * multSecours) : (prixEntree - distanceSL * multSecours);
            ordreTP = viserGrandMouvement ? 2 : 1;
         }
      }

      int bougieTPIdx      = -1;
      datetime bougieTPTps = 0;
      bool plageTPValide   = true;

      if(prixTP > 0.0)
      {
         plageTPValide = ValiderDojiAvecPlageTPSMC(
            bougies, indexDoji, doji.type, prixTP, InpMaxReculPlageTP, bougieTPIdx, bougieTPTps
         );
         if(InpActiverFiltrePlageTP && !plageTPValide)
            continue;
      }

      SetupOrchestreSMC_MT5 setup;
      ZeroMemory(setup);
      setup.idSetup            = indexDoji;
      setup.type               = doji.type;
      setup.indexDoji          = indexDoji;
      setup.tempsDoji          = doji.temps;
      setup.indexDebutPlage    = doji.indexDebutPlage;
      setup.tempsDebutPlage    = doji.tempsDebutPlage;
      setup.prixEntree         = prixEntree;
      setup.prixSL             = prixSL;
      setup.distanceSL         = distanceSL;
      setup.prixTP             = prixTP;
      setup.ordreTP            = ordreTP;
      setup.distanceTP         = MathAbs(prixTP - prixEntree);
      setup.ratioRR            = NormalizeDouble(setup.distanceTP / MathMax(_Point, distanceSL), 2);
      setup.scoreShved         = scoreShved;
      setup.aMeilleureZone     = aMeilleureZone;
      if(aMeilleureZone)
         setup.meilleureZone   = meilleureZone;
      setup.carburantInitial   = carburantInitial;
      setup.carburantRestant   = carburantRestant;
      setup.paliersTraverses   = paliersTraverses;
      setup.estLimiteParPalier = estLimiteParPalier;
      setup.scoreZigZag        = scoreZZ;
      setup.nbPaliersUOP       = MathMin(MAX_PALIERS_UOP, nbPaliers);
      for(int p = 0; p < setup.nbPaliersUOP; p++)
         setup.paliersUOP[p]   = paliersCandidats[p];
      setup.infoPlageTPValide  = plageTPValide;
      setup.bougieTPIndex      = bougieTPIdx;
      setup.bougieTPTemps      = bougieTPTps;

      VerifierConfirmationEtCycleDeVieSMC(bougies, totalLocal, nbBougiesConf, setup);

      if(setup.statut == SETUP_EN_COURS)
      {
         totalEnAttente3Bougies++;
      }
      else if(setup.statut == SETUP_CONFIRME)
      {
         totalConfirmes++;

         int idxGlobalConfirmation = decalageDebut + setup.indexConfirmation;
         if(idxGlobalConfirmation >= 0 && idxGlobalConfirmation < rates_total)
         {
            if(estAchat)
               g_bufferConfirmationAchat[idxGlobalConfirmation] = bougies[setup.indexConfirmation].low - doji.moyenneHauteur * 0.35;
            else
               g_bufferConfirmationVente[idxGlobalConfirmation] = bougies[setup.indexConfirmation].high + doji.moyenneHauteur * 0.35;
         }

         if(setup.estTermine)
         {
            if(setup.resultatTrade == TRADE_TP_TOUCHE)
               totalTPTouches++;
            else if(setup.resultatTrade == TRADE_SL_TOUCHE)
               totalSLTouches++;
         }
         else
         {
            totalActifs++;
            dernierSetupActif  = setup;
            aDernierSetupActif = true;
         }

         // 🔔 Déclenchement de l'alerte uniquement sur la 3ème bougie de confirmation qui vient de clôturer
         if(!setup.estTermine && setup.indexConfirmation == totalLocal - 2)
         {
            DeclencherAlerteSetupConfirmeMT5(
               setup,
               InpActiverAlertePopup,
               InpActiverSonSeul,
               InpFichierSon,
               InpActiverNotificationPush,
               InpActiverAlerteEmail,
               g_dernierTempsConfirmationAlerte
            );
         }

         bool doitAfficherSurGraphique = (!InpMasquerSetupsTermines || !setup.estTermine);
         if(doitAfficherSurGraphique)
         {
            DessinerSetupOrchestreMT5(
               setup, bougies, totalLocal, InpDureeSegmentsCibles,
               InpAfficherPointDoji, InpAfficherPointsLiquidation, InpAfficherSegmentSR,
               InpAfficherPaliersUOP, InpAfficherSegmentSL, InpAfficherSegmentTP,
               InpAfficherDiagnosticCollines, InpCouleurAchat, InpCouleurVente
            );
         }
      }
   }

   g_aSetupActifEnCache = aDernierSetupActif;
   if(aDernierSetupActif)
      g_dernierSetupActifCache = dernierSetupActif;
   g_historiqueInitialCalcule = true;

   if(InpAfficherPanneauHUD)
   {
      DessinerPanneauHUD_MT5(
         totalConfirmes, totalActifs, totalEnAttente3Bougies,
         totalTPTouches, totalSLTouches, aDernierSetupActif, dernierSetupActif
      );
   }

   ChartRedraw(0);
}

//+------------------------------------------------------------------+
//| Exécution différée par Timer (Décalage Anti-Pic CPU sur VPS)     |
//+------------------------------------------------------------------+
void OnTimer()
{
   EventKillTimer();
   if(!g_calculDiffereEnAttente)
      return;

   g_calculDiffereEnAttente = false;

   MqlRates rates[];
   ArraySetAsSeries(rates, false);
   int nbMax  = MathMax(150, InpMaxBougiesAnalysees);
   int copied = CopyRates(_Symbol, _Period, 0, nbMax, rates);
   if(copied < 25)
      return;

   datetime time[];
   double open[], high[], low[], close[];
   long tick_vol[];
   ArrayResize(time, copied);
   ArrayResize(open, copied);
   ArrayResize(high, copied);
   ArrayResize(low, copied);
   ArrayResize(close, copied);
   ArrayResize(tick_vol, copied);

   for(int i = 0; i < copied; i++)
   {
      time[i]     = rates[i].time;
      open[i]     = rates[i].open;
      high[i]     = rates[i].high;
      low[i]      = rates[i].low;
      close[i]    = rates[i].close;
      tick_vol[i] = rates[i].tick_volume;
   }

   ExecuterAnalyseGraphiqueCourant(copied, time, open, high, low, close, tick_vol);
}

//+------------------------------------------------------------------+
//| Boucle principale de calcul et de surveillance en temps réel     |
//+------------------------------------------------------------------+
int OnCalculate(
   const int rates_total,
   const int prev_calculated,
   const datetime &time[],
   const double &open[],
   const double &high[],
   const double &low[],
   const double &close[],
   const long &tick_volume[],
   const long &volume[],
   const int &spread[]
)
{
   if(rates_total < 25)
      return(0);

   ArraySetAsSeries(time, false);
   ArraySetAsSeries(open, false);
   ArraySetAsSeries(high, false);
   ArraySetAsSeries(low, false);
   ArraySetAsSeries(close, false);
   ArraySetAsSeries(tick_volume, false);
   ArraySetAsSeries(g_bufferConfirmationAchat, false);
   ArraySetAsSeries(g_bufferConfirmationVente, false);

   datetime tempsBarreCourante = time[rates_total - 1];
   if(prev_calculated > 0 && tempsBarreCourante == g_derniereBarreCalculee)
      return(rates_total);

   g_derniereBarreCalculee = tempsBarreCourante;

   // ⏱️ OPTIMISATION 2 : DÉCALAGE TEMPOREL AUTOMATIQUE ENTRE LES PAIRES (ANTI-GOULOT VPS)
   // Lors du tout premier chargement (!g_historiqueInitialCalcule), on calcule tout de suite.
   // Ensuite, à chaque nouvelle bougie (XX:00 / XX:30), si un délai est attribué à ce symbole,
   // on décale l'exécution via OnTimer() pour que les 15 graphiques ne calculent jamais en même temps !
   if(InpActiverDecalageVPS && g_historiqueInitialCalcule && g_delaiDecalageMs > 0)
   {
      g_calculDiffereEnAttente = true;
      EventSetMillisecondTimer(g_delaiDecalageMs);
      return(rates_total);
   }

   ExecuterAnalyseGraphiqueCourant(rates_total, time, open, high, low, close, tick_volume);
   return(rates_total);
}
//+------------------------------------------------------------------+
