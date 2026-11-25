//+------------------------------------------------------------------+
//|                                   OrchestrateurSMC_Fractal_EA.mq5|
//|              🎼 Chef d'Orchestre SMC - Expert Advisor MT5        |
//|     Système Fractal HTF (H4 + UOP 10 Vagues) ➔ LTF (M15 / M30)  |
//|     Avec Order Blocks Protégés & Objets Position TradingView     |
//+------------------------------------------------------------------+
#property copyright   "JournalMobileAPK - Orchestrateur SMC Fractal EA"
#property version     "2.00"
#property strict
#property description "Expert Advisor de Backtest MT5 - Système Fractal SMC (HTF -> LTF)"
#property description "1. Setup Maître HTF (H4) : Doji + Shved + ZigZag (1..8) + UOP 10 vagues + Range 3b."
#property description "2. Plage Protégée [SL_H4 -> Close(B2_H4) +/- AmpDoji] + Order Blocks Classiques LTF."
#property description "3. Entrée LTF (M15/M30) sur 2ème Setup (sans filtre UOP) : Petit SL LTF -> Grand TP H4."
#property description "4. Trace les boîtes de Position style TradingView (Zone TP Verte + Zone SL Rouge)."

// ─── 📦 Inclusion des 6 Modules de l'Orchestrateur SMC ─────────────────────────
#include "Modules/Module00_TypesEtOutils.mqh"
#include "Modules/Module01_DojiEtPlage.mqh"
#include "Modules/Module02_ShvedEtCollines.mqh"
#include "Modules/Module03_ZigZagDynamiqueUOP.mqh"
#include "Modules/Module04_EnergieEtConfirmation.mqh"
#include "Modules/Module05_VisuelsEtAlertes.mqh"
#include "Modules/Module06_MoteurEvaluationRapide.mqh"

// ─── 📊 Énumérations Spécifiques au Robot (EA) ─────────────────────────────────
enum ENUM_MODE_STRATEGIE_EA
{
   EA_MODE_FRACTAL_HTF_VERS_LTF = 0, // 🔬 Fractal HTF (H4) ➔ Entrée LTF (Graphique M15/M30) [Recommandé]
   EA_MODE_MONO_TIMEFRAME       = 1  // 📈 Mono-Timeframe (Exécute le setup complet sur l'UT du graphique)
};

enum ENUM_MODE_CALCUL_LOT_EA
{
   LOT_POURCENTAGE_RISQUE = 0, // 💰 Pourcentage de risque du capital par trade (ex: 1.0%)
   LOT_FIXE               = 1  // 📏 Lot fixe constant (ex: 0.10 lot)
};

// Structure représentant un Order Block Classique SMC protégé dans la plage HTF
struct OrderBlockClassiqueMT5
{
   int                ordreHierarchie; // 1 = proche entrée, N = Dernier OB (rempart proche du SL HTF)
   bool               estDernierOB;    // Vrai s'il est le plus proche du SL Maître HTF
   ENUM_DIRECTION_SMC type;
   int                indexBougie;
   datetime           tempsDebut;
   double             prixHaut;
   double             prixBas;
   double             prixMedian;
   bool               aFVG;
   bool               estMitige;
};

// ==============================================================================
// ⚙️ PARAMÈTRES D'ENTRÉE DE L'EXPERT ADVISOR (INPUTS STRATEGY TESTER MT5)
// ==============================================================================

input group "=== 🏛️ 0. ARCHITECTURE FRACTALE HTF ➔ LTF & EXÉCUTION ==="
input ENUM_MODE_STRATEGIE_EA InpModeStrategie             = EA_MODE_FRACTAL_HTF_VERS_LTF; // Mode de fonctionnement du Robot
input ENUM_TIMEFRAMES        InpTimeframeMaitreHTF        = PERIOD_H4;                    // Timeframe Maître HTF (Plage Protégée & Grand TP)
input bool                   InpExigerContactOrderBlock   = false;                        // Exiger que le 2ème setup LTF touche un Order Block protégé
input bool                   InpUniquementDernierOB       = false;                        // Exiger un contact avec le Dernier OB (le plus proche du SL H4)
input int                    InpMaxPositionsParSetupHTF   = 2;                            // Nombre max de positions LTF autorisées par Setup H4
input bool                   InpAutoriserReentreeSiSL     = true;                         // Autoriser une nouvelle entrée LTF si un Petit SL LTF est touché (tant que H4 tient)
input double                 InpRatioRRMinimum            = 1.0;                          // Ratio R:R minimum requis pour ouvrir une position (1.0 = aligné avec l'App)

input group "=== 💰 1. MONEY MANAGEMENT & GESTION DU RISQUE ==="
input ENUM_MODE_CALCUL_LOT_EA InpModeCalculLot            = LOT_POURCENTAGE_RISQUE;       // Méthode de calcul de la taille de lot
input double                  InpRisqueParTradePct        = 1.0;                          // Risque par trade en % du capital (si mode Pourcentage)
input double                  InpLotFixe                  = 0.10;                         // Taille du lot fixe (si mode Lot Fixe)
input int                     InpMargeSecuriteSLPoints    = 0;                            // Marge de sécurité ajoutée derrière le Petit SL (0 = SL exact comme sur l'App)
input bool                    InpActiverBreakEven         = false;                        // Mettre à Break-Even (SL au prix d'entrée) après X R de gain
input double                  InpDeclenchementBE_RR       = 3.0;                          // Gain en R:R déclenchant le passage à Break-Even
input long                    InpMagicNumber              = 20261125;                     // Magic Number unique de l'EA
input int                     InpSlippagePoints           = 30;                           // Slippage maximal toléré (en Points)

input group "=== 🕯️ 2. DÉCLENCHEUR DOJI LIQ/REINT & RANGE 3 BOUGIES (BLOC 1) ==="
input bool   InpActiverAchat              = true;  // Autoriser les setups d'Achat (Spring)
input bool   InpActiverVente              = true;  // Autoriser les setups de Vente (UTAD)
input bool   InpActiverFiltreTailleHTF    = true;  // Filtrer la taille du Doji en HTF (H4)
input bool   InpActiverFiltreTailleLTF    = false; // Filtrer la taille du Doji en LTF (M15/M30 - false recommandé)
input int    InpPeriodeHistorique         = 10;    // Période pour la moyenne de taille des bougies
input double InpMultiplicateurBougie1     = 1.0;   // Multiplicateur minimal Bougie 1 (Liquidation)
input double InpMultiplicateurCorps2      = 1.2;   // Multiplicateur minimal Corps Bougie 2 (Réintégration)
input double InpToleranceDeficit          = 0.30;  // Tolérance de déficit de réintégration (30%)
input double InpToleranceDepassement      = 2.0;   // Tolérance de dépassement favorable (200%)
input int    InpMaxReculRecherche         = 100;   // Recul max (en bougies) pour trouver l'extrême précédent
input int    InpNbBougiesConfirmation     = 3;     // Nombre de bougies de confirmation du Range (bornées par Close(B2) ± AmpDoji)

input group "=== 🌊 3. ZIGZAG DYNAMIQUE (1..8) & AUTOROUTE UOP 10 VAGUES (HTF) ==="
input bool                         InpActiverZigZagDynamique     = true;                // Varier zigzagDepth de 1 à 8 uniquement selon la taille du Doji HTF
input int                          InpZigZagDepthMin             = 1;                   // Profondeur ZigZag minimale (1)
input int                          InpZigZagDepthMax             = 8;                   // Profondeur ZigZag maximale (8)
input int                          InpZigZagDepthSecours         = 4;                   // Profondeur ZigZag fixe si mode dynamique désactivé
input int                          InpNbVaguesSuperposees        = 10;                  // Nombre de vagues ZigZag superposées dans l'UOP (10 dernières vagues)
input ENUM_TYPE_CHEVAUCHEMENT_UOP  InpTypeChevauchementUOP       = UOP_CORPS_ET_MECHES; // Anatomie UOP (Corps + Mèches = 1.0 par défaut)
input double                       InpPoidsCorpsUOP              = 1.0;                 // Poids du corps dans l'UOP
input double                       InpPoidsMecheUOP              = 1.0;                 // Poids des mèches dans l'UOP
input bool                         InpExigerAutorouteUOP_HTF     = true;                // Exiger une autoroute UOP fluide en HTF (H4)
input double                       InpMinTauxAutorouteHTF        = 1.5;                 // Taux minimum de chevauchement de l'autoroute HTF
input bool                         InpActiverFiltrePlageTP_HTF   = true;                // Exiger que le Doji HTF soit l'extrême depuis la bougie TP
input int                          InpMaxReculPlageTP            = 100;                 // Recul max (en bougies) pour la bougie TP

input group "=== ⚡ 4. S/R SHVED & MOTEUR D'ÉNERGIE DU GRAND TP HTF ==="
input int                          InpPeriodeATRShved            = 2;                        // Période ATR zones Shved
input double                       InpZoneFuzzFactor             = 0.01;                     // Épaisseur zones Shved
input int                          InpScoreMinimumShved          = 0;                        // Score minimal Shved requis (/100)
input bool                         InpExigerDebutEtFinDansPlage  = false;                    // Exiger S/R né dans la plage
input ENUM_MODE_CALCUL_TP          InpModeCalculTP               = MODE_TP_ENERGIE_FRICTION; // Méthode de calcul du Grand TP HTF
input ENUM_PALIER_TP_VISE          InpPalierTPVise               = PALIER_TP1;               // Palier TP visé (TP1, TP2, TP3, AUTO)
input int                          InpPointsParRetest            = 100;                      // Points de carburant par retest S/R
input int                          InpPlafondCarburantRetests    = 400;                      // Plafond carburant des retests
input double                       InpBonusMecheProfonde         = 1.6;                      // Bonus mèche profonde (> 1.2x ATR)
input double                       InpBonusMecheNormale          = 1.3;                      // Bonus mèche normale (0.5x à 1.2x ATR)
input int                          InpPeagePalierUOP             = 100;                      // Péage en carburant par palier UOP
input double                       InpCoutParATR                 = 50.0;                     // Consommation par ATR parcouru
input double                       InpCoutFrictionFortOverlap    = 0.5;                      // Friction en fort overlap
input double                       InpCoutFrictionMoyenOverlap   = 1.0;                      // Friction en overlap moyen
input double                       InpCoutFrictionFaibleOverlap  = 2.0;                      // Friction en faible overlap
input double                       InpSeuilFortOverlap           = 4.0;                      // Seuil fort overlap
input double                       InpSeuilFaibleOverlap         = 2.0;                      // Seuil faible overlap
input double                       InpMargeSecuriteDevantPalier  = 0.15;                     // Marge devant mur bloquant (% ATR)
input int                          InpSeuilScoreGrandMouvement   = 70;                       // Seuil score Shved grand mouvement
input bool                         InpActiverTPCibleLiquiditeSR  = false;                    // 🧲 Cibler un S/R Actif avec trajet UOP
input ENUM_COMPORTEMENT_ABSENCE_SR InpComportementAbsenceSR      = ABSENCE_SR_REPLI_UOP;     // Comportement si absence de S/R actif
input double                       InpTauxMinChevauchementSR     = 1.5;                      // Taux min chevauchement trajet S/R
input double                       InpCouvertureMinTrajetSRPct   = 70.0;                     // Couverture min (%) trajet S/R

input group "=== 🎨 5. OBJETS GRAPHIQUES STYLE TRADINGVIEW (BACKTEST VISUEL) ==="
input bool   InpDessinerObjetsTradingView = true; // Tracer les boîtes de Position TradingView (TP Vert / SL Rouge), Plage H4 et Order Blocks
input bool   InpAfficherTableauBordEA     = true; // Afficher le tableau de bord HUD en haut à gauche

// ==============================================================================
// 🧠 VARIABLES GLOBALES D'ÉTAT DU ROBOT
// ==============================================================================
datetime              g_derniereBarreLTF               = 0;
datetime              g_derniereBarreHTF               = 0;
bool                  g_aSetupMaitreHTFActif           = false;
SetupOrchestreSMC_MT5 g_setupMaitreHTFActif;
double                g_bornePlageMaitreHTF            = 0.0;
int                   g_nbTradesPrisSurSetupHTFActuel  = 0;
datetime              g_dernierDojiLTFTradeTemps       = 0;
int                   g_compteurObjetsPositionTV       = 0;
int                   g_totalSetupsHTFDetectes         = 0;
int                   g_totalPositionsLTFOuvertes      = 0;
string                g_prefixeEA                      = "SMC_FRACTAL_EA_";

//+------------------------------------------------------------------+
//| 🔧 Détecte automatiquement le mode de remplissage du broker      |
//+------------------------------------------------------------------+
ENUM_ORDER_TYPE_FILLING ObtenirModeRemplissageBroker(string sym)
{
   uint filling = (uint)SymbolInfoInteger(sym, SYMBOL_FILLING_MODE);
   if((filling & SYMBOL_FILLING_FOK) != 0)
      return ORDER_FILLING_FOK;
   if((filling & SYMBOL_FILLING_IOC) != 0)
      return ORDER_FILLING_IOC;
   return ORDER_FILLING_RETURN;
}

//+------------------------------------------------------------------+
//| 💰 Calcule la taille de lot optimale selon le Petit SL LTF       |
//| Exemple : CalculerLotSelonRisque(1.0850, 1.0835) -> 0.45 lot     |
//+------------------------------------------------------------------+
double CalculerLotSelonRisque(double prixEntree, double prixSL)
{
   double lotMin  = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double lotMax  = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
   double lotStep = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   if(lotMin <= 0.0)  lotMin  = 0.01;
   if(lotMax <= 0.0)  lotMax  = 100.0;
   if(lotStep <= 0.0) lotStep = 0.01;

   if(InpModeCalculLot == LOT_FIXE)
   {
      double lotBrut = MathMax(lotMin, MathMin(lotMax, InpLotFixe));
      return NormalizeDouble(MathFloor(lotBrut / lotStep) * lotStep, 2);
   }

   double capital     = AccountInfoDouble(ACCOUNT_BALANCE);
   double montantRisq = capital * (MathMax(0.05, InpRisqueParTradePct) / 100.0);
   double distanceSL  = MathAbs(prixEntree - prixSL);
   double tickSize    = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
   double tickValue   = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE);

   if(distanceSL <= _Point || tickSize <= 0.0 || tickValue <= 0.0)
      return lotMin;

   double perteParLot = (distanceSL / tickSize) * tickValue;
   if(perteParLot <= 0.0)
      return lotMin;

   double lotCalcule = montantRisq / perteParLot;
   lotCalcule        = MathFloor(lotCalcule / lotStep) * lotStep;
   lotCalcule        = MathMax(lotMin, MathMin(lotMax, lotCalcule));

   return NormalizeDouble(lotCalcule, 2);
}

//+------------------------------------------------------------------+
//| 🔍 Vérifie si une position de cet EA est actuellement ouverte    |
//+------------------------------------------------------------------+
bool APositionOuverteEA()
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0)
         continue;
      if(PositionGetString(POSITION_SYMBOL) == _Symbol &&
         PositionGetInteger(POSITION_MAGIC) == InpMagicNumber)
      {
         return true;
      }
   }
   return false;
}

//+------------------------------------------------------------------+
//| 🛡️ Gère le passage automatique à Break-Even des positions actives|
//+------------------------------------------------------------------+
void GererBreakEvenPositionsActives()
{
   if(!InpActiverBreakEven || InpDeclenchementBE_RR <= 0.0)
      return;

   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0)
         continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol ||
         PositionGetInteger(POSITION_MAGIC) != InpMagicNumber)
         continue;

      long   typePos    = PositionGetInteger(POSITION_TYPE);
      double prixOuvert = PositionGetDouble(POSITION_PRICE_OPEN);
      double slActuel   = PositionGetDouble(POSITION_SL);
      double tpActuel   = PositionGetDouble(POSITION_TP);
      double prixActuel = (typePos == POSITION_TYPE_BUY)
         ? SymbolInfoDouble(_Symbol, SYMBOL_BID)
         : SymbolInfoDouble(_Symbol, SYMBOL_ASK);

      double risqueInitial = MathAbs(prixOuvert - slActuel);
      if(risqueInitial <= _Point * 2.0)
         continue;

      if(typePos == POSITION_TYPE_BUY && slActuel < prixOuvert)
      {
         double gainActuel = prixActuel - prixOuvert;
         if(gainActuel >= risqueInitial * InpDeclenchementBE_RR)
         {
            double nouveauSL = NormalizeDouble(prixOuvert + _Point * 2.0, _Digits);
            MqlTradeRequest req;
            MqlTradeResult  res;
            ZeroMemory(req);
            ZeroMemory(res);
            req.action   = TRADE_ACTION_SLTP;
            req.position = ticket;
            req.symbol   = _Symbol;
            req.sl       = nouveauSL;
            req.tp       = tpActuel;
            if(!OrderSend(req, res))
               PrintFormat("⚠️ [EA SMC] Échec mise à Break-Even BUY (#%I64u) Code=%d", ticket, res.retcode);
         }
      }
      else if(typePos == POSITION_TYPE_SELL && (slActuel > prixOuvert || slActuel == 0.0))
      {
         double gainActuel = prixOuvert - prixActuel;
         if(gainActuel >= risqueInitial * InpDeclenchementBE_RR)
         {
            double nouveauSL = NormalizeDouble(prixOuvert - _Point * 2.0, _Digits);
            MqlTradeRequest req;
            MqlTradeResult  res;
            ZeroMemory(req);
            ZeroMemory(res);
            req.action   = TRADE_ACTION_SLTP;
            req.position = ticket;
            req.symbol   = _Symbol;
            req.sl       = nouveauSL;
            req.tp       = tpActuel;
            if(!OrderSend(req, res))
               PrintFormat("⚠️ [EA SMC] Échec mise à Break-Even SELL (#%I64u) Code=%d", ticket, res.retcode);
         }
      }
   }
}

//+------------------------------------------------------------------+
//| 📦 Détecte les Order Blocks Classiques SMC protégés dans la plage|
//|    du Setup Maître HTF [SL_HTF ➔ Close(B2_HTF) ± AmplitudeDoji]  |
//+------------------------------------------------------------------+
int DetecterOrderBlocksClassiquesDansPlageMT5(
   const BougieSMC &bougiesLTF[],
   int indexDebutScan,
   int indexFinScan,
   ENUM_DIRECTION_SMC directionSetupHTF,
   double prixSL_HTF,
   double borneRange_HTF,
   OrderBlockClassiqueMT5 &obsSortie[]
)
{
   ArrayResize(obsSortie, 0);
   if(indexFinScan - indexDebutScan < 3)
      return 0;

   bool   estAchat = (directionSetupHTF == DIRECTION_ACHAT);
   double minPlage = MathMin(prixSL_HTF, borneRange_HTF);
   double maxPlage = MathMax(prixSL_HTF, borneRange_HTF);

   int debut = MathMax(1, indexDebutScan);
   int fin   = MathMin(ArraySize(bougiesLTF) - 3, indexFinScan);

   for(int i = debut; i <= fin; i++)
   {
      BougieSMC b0 = bougiesLTF[i];
      BougieSMC b1 = bougiesLTF[i + 1];
      BougieSMC b2 = bougiesLTF[i + 2];

      double amp0   = MathMax(_Point, b0.high - b0.low);
      double corps1 = MathAbs(b1.close - b1.open);
      double corps2 = MathAbs(b2.close - b2.open);

      if(estAchat)
      {
         // Order Block Haussier : dernière bougie baissière avant forte impulsion haussière
         bool estBougieBaissiere = (b0.close < b0.open);
         bool impulsionHaussiere = (b1.close > b0.high) || (b1.close > b1.open && b2.close > b0.high && (corps1 + corps2) >= amp0 * 1.1);
         if(!estBougieBaissiere || !impulsionHaussiere)
            continue;

         double prixBas  = b0.low;
         double prixHaut = MathMax(b0.open, b0.high);
         double median   = (prixHaut + prixBas) * 0.5;

         if(prixBas < minPlage || median > maxPlage)
            continue;

         bool aFVG = (b2.low > b0.high);

         // Vérifier que l'Order Block n'a pas été cassé (invalidé sous son bas) après i+2
         bool estCasse = false;
         for(int k = i + 3; k <= indexFinScan && k < ArraySize(bougiesLTF); k++)
         {
            if(bougiesLTF[k].low < prixBas)
            {
               estCasse = true;
               break;
            }
         }
         if(estCasse)
            continue;

         int n = ArraySize(obsSortie);
         ArrayResize(obsSortie, n + 1);
         obsSortie[n].ordreHierarchie = n + 1;
         obsSortie[n].estDernierOB    = false;
         obsSortie[n].type            = DIRECTION_ACHAT;
         obsSortie[n].indexBougie     = i;
         obsSortie[n].tempsDebut      = b0.temps;
         obsSortie[n].prixHaut        = prixHaut;
         obsSortie[n].prixBas         = prixBas;
         obsSortie[n].prixMedian      = median;
         obsSortie[n].aFVG            = aFVG;
         obsSortie[n].estMitige       = false;
      }
      else
      {
         // Order Block Baissier : dernière bougie haussière avant forte impulsion baissière
         bool estBougieHaussiere = (b0.close > b0.open);
         bool impulsionBaissiere = (b1.close < b0.low) || (b1.close < b1.open && b2.close < b0.low && (corps1 + corps2) >= amp0 * 1.1);
         if(!estBougieHaussiere || !impulsionBaissiere)
            continue;

         double prixHaut = b0.high;
         double prixBas  = MathMin(b0.open, b0.low);
         double median   = (prixHaut + prixBas) * 0.5;

         if(prixHaut > maxPlage || median < minPlage)
            continue;

         bool aFVG = (b2.high < b0.low);

         bool estCasse = false;
         for(int k = i + 3; k <= indexFinScan && k < ArraySize(bougiesLTF); k++)
         {
            if(bougiesLTF[k].high > prixHaut)
            {
               estCasse = true;
               break;
            }
         }
         if(estCasse)
            continue;

         int n = ArraySize(obsSortie);
         ArrayResize(obsSortie, n + 1);
         obsSortie[n].ordreHierarchie = n + 1;
         obsSortie[n].estDernierOB    = false;
         obsSortie[n].type            = DIRECTION_VENTE;
         obsSortie[n].indexBougie     = i;
         obsSortie[n].tempsDebut      = b0.temps;
         obsSortie[n].prixHaut        = prixHaut;
         obsSortie[n].prixBas         = prixBas;
         obsSortie[n].prixMedian      = median;
         obsSortie[n].aFVG            = aFVG;
         obsSortie[n].estMitige       = false;
      }
   }

   // Hiérarchie : identifier le Dernier OB Protégé (le plus proche du SL Maître HTF)
   int totalOB = ArraySize(obsSortie);
   if(totalOB > 0)
   {
      int    idxDernier  = 0;
      double distMinSL   = DBL_MAX;
      for(int j = 0; j < totalOB; j++)
      {
         double dist = estAchat
            ? MathAbs(obsSortie[j].prixBas - prixSL_HTF)
            : MathAbs(prixSL_HTF - obsSortie[j].prixHaut);
         if(dist < distMinSL)
         {
            distMinSL  = dist;
            idxDernier = j;
         }
      }
      obsSortie[idxDernier].estDernierOB = true;
   }

   return totalOB;
}

//+------------------------------------------------------------------+
//| 📐 Dessine l'Objet Position Longue / Courte style TradingView    |
//|    sur le graphique MetaTrader 5 (Zone TP Verte + Zone SL Rouge) |
//+------------------------------------------------------------------+
void DessinerObjetPositionTradingViewMT5(
   int idPosition,
   ENUM_DIRECTION_SMC direction,
   datetime tempsEntree,
   datetime tempsFinProjection,
   double prixEntree,
   double prixSL,
   double prixTP,
   double ratioRR,
   double lot
)
{
   if(!InpDessinerObjetsTradingView)
      return;

   bool   estAchat = (direction == DIRECTION_ACHAT);
   string baseId   = g_prefixeEA + "TV_POS_" + IntegerToString(idPosition) + "_";

   // 1️⃣ 🟩 Boîte de Gain (Zone TP Verte style TradingView #089981)
   string nomBoiteTP = baseId + "TP_BOX";
   ObjectDelete(0, nomBoiteTP);
   if(ObjectCreate(0, nomBoiteTP, OBJ_RECTANGLE, 0, tempsEntree, prixEntree, tempsFinProjection, prixTP))
   {
      ObjectSetInteger(0, nomBoiteTP, OBJPROP_COLOR, C'8,153,129');
      ObjectSetInteger(0, nomBoiteTP, OBJPROP_FILL, true);
      ObjectSetInteger(0, nomBoiteTP, OBJPROP_BACK, true);
      ObjectSetInteger(0, nomBoiteTP, OBJPROP_WIDTH, 1);
      ObjectSetInteger(0, nomBoiteTP, OBJPROP_SELECTABLE, false);
   }

   // 2️⃣ 🟥 Boîte de Risque (Zone SL Rouge style TradingView #F23645)
   string nomBoiteSL = baseId + "SL_BOX";
   ObjectDelete(0, nomBoiteSL);
   if(ObjectCreate(0, nomBoiteSL, OBJ_RECTANGLE, 0, tempsEntree, prixEntree, tempsFinProjection, prixSL))
   {
      ObjectSetInteger(0, nomBoiteSL, OBJPROP_COLOR, C'242,54,69');
      ObjectSetInteger(0, nomBoiteSL, OBJPROP_FILL, true);
      ObjectSetInteger(0, nomBoiteSL, OBJPROP_BACK, true);
      ObjectSetInteger(0, nomBoiteSL, OBJPROP_WIDTH, 1);
      ObjectSetInteger(0, nomBoiteSL, OBJPROP_SELECTABLE, false);
   }

   // 3️⃣ ⚪ Ligne Centrale d'Entrée
   string nomLigneEntree = baseId + "ENTRY_LINE";
   ObjectDelete(0, nomLigneEntree);
   if(ObjectCreate(0, nomLigneEntree, OBJ_TREND, 0, tempsEntree, prixEntree, tempsFinProjection, prixEntree))
   {
      ObjectSetInteger(0, nomLigneEntree, OBJPROP_COLOR, clrWhiteSmoke);
      ObjectSetInteger(0, nomLigneEntree, OBJPROP_WIDTH, 2);
      ObjectSetInteger(0, nomLigneEntree, OBJPROP_RAY_RIGHT, false);
      ObjectSetInteger(0, nomLigneEntree, OBJPROP_SELECTABLE, false);
   }

   // 4️⃣ 📐 Diagonale Pointillée de Trajectoire TradingView
   string nomDiagonale = baseId + "DIAG_LINE";
   ObjectDelete(0, nomDiagonale);
   if(ObjectCreate(0, nomDiagonale, OBJ_TREND, 0, tempsEntree, prixEntree, tempsFinProjection, prixTP))
   {
      ObjectSetInteger(0, nomDiagonale, OBJPROP_COLOR, C'16,185,129');
      ObjectSetInteger(0, nomDiagonale, OBJPROP_STYLE, STYLE_DOT);
      ObjectSetInteger(0, nomDiagonale, OBJPROP_WIDTH, 1);
      ObjectSetInteger(0, nomDiagonale, OBJPROP_RAY_RIGHT, false);
      ObjectSetInteger(0, nomDiagonale, OBJPROP_SELECTABLE, false);
   }

   // 5️⃣ 🏷️ Étiquette R:R & Lot au niveau de l'entrée
   string nomLabel = baseId + "LABEL";
   ObjectDelete(0, nomLabel);
   if(ObjectCreate(0, nomLabel, OBJ_TEXT, 0, tempsEntree, prixEntree))
   {
      string txt = StringFormat(
         "  %s LTF (%.2f lot) | R/R: %.2fR | TP H4: %s",
         estAchat ? "▲ LONG" : "▼ SHORT",
         lot,
         ratioRR,
         DoubleToString(prixTP, _Digits)
      );
      ObjectSetString(0, nomLabel, OBJPROP_TEXT, txt);
      ObjectSetString(0, nomLabel, OBJPROP_FONT, "Arial Bold");
      ObjectSetInteger(0, nomLabel, OBJPROP_FONTSIZE, 8);
      ObjectSetInteger(0, nomLabel, OBJPROP_COLOR, clrGold);
      ObjectSetInteger(0, nomLabel, OBJPROP_ANCHOR, ANCHOR_LEFT_LOWER);
      ObjectSetInteger(0, nomLabel, OBJPROP_SELECTABLE, false);
   }
}

//+------------------------------------------------------------------+
//| 🏛️ Dessine le Calque Maître HTF (Plage Protégée H4, Grand TP H4 |
//|    et Rectangles d'Order Blocks LTF) sur le graphique MT5        |
//+------------------------------------------------------------------+
void DessinerCalqueMaitreHTF_MT5(
   const SetupOrchestreSMC_MT5 &setupHTF,
   double borneRangeHTF,
   datetime tempsFinLTF,
   const OrderBlockClassiqueMT5 &obsLTF[],
   int totalOB
)
{
   if(!InpDessinerObjetsTradingView)
      return;

   bool   estAchat = (setupHTF.type == DIRECTION_ACHAT);
   string baseHTF  = g_prefixeEA + "HTF_" + IntegerToString(setupHTF.idSetup) + "_";
   datetime tFin   = tempsFinLTF + PeriodSeconds(_Period) * 20;

   // 1️⃣ Grande Boîte de la Plage Protégée H4 [SL_H4 ➔ Close(B2_H4) ± AmplitudeDoji_H4]
   string nomPlage = baseHTF + "PLAGE_BOX";
   ObjectDelete(0, nomPlage);
   if(ObjectCreate(0, nomPlage, OBJ_RECTANGLE, 0, setupHTF.tempsDoji, setupHTF.prixSL, tFin, borneRangeHTF))
   {
      ObjectSetInteger(0, nomPlage, OBJPROP_COLOR, estAchat ? C'126,34,206' : C'190,18,60');
      ObjectSetInteger(0, nomPlage, OBJPROP_FILL, false);
      ObjectSetInteger(0, nomPlage, OBJPROP_WIDTH, 2);
      ObjectSetInteger(0, nomPlage, OBJPROP_STYLE, STYLE_DASH);
      ObjectSetInteger(0, nomPlage, OBJPROP_BACK, true);
      ObjectSetInteger(0, nomPlage, OBJPROP_SELECTABLE, false);
   }

   // 2️⃣ Ligne d'Aimant du GRAND TP H4
   string nomLigneTP = baseHTF + "GRAND_TP";
   ObjectDelete(0, nomLigneTP);
   if(ObjectCreate(0, nomLigneTP, OBJ_TREND, 0, setupHTF.tempsDoji, setupHTF.prixTP, tFin, setupHTF.prixTP))
   {
      ObjectSetInteger(0, nomLigneTP, OBJPROP_COLOR, clrSpringGreen);
      ObjectSetInteger(0, nomLigneTP, OBJPROP_WIDTH, 2);
      ObjectSetInteger(0, nomLigneTP, OBJPROP_RAY_RIGHT, false);
      ObjectSetInteger(0, nomLigneTP, OBJPROP_SELECTABLE, false);
   }

   string nomTxtTP = baseHTF + "GRAND_TP_TXT";
   ObjectDelete(0, nomTxtTP);
   if(ObjectCreate(0, nomTxtTP, OBJ_TEXT, 0, setupHTF.tempsDoji, setupHTF.prixTP))
   {
      string tfNom = EnumToString(InpTimeframeMaitreHTF);
      ObjectSetString(0, nomTxtTP, OBJPROP_TEXT, StringFormat("  🎯 GRAND TP %s : %s (Prof.ZigZag: %d)", tfNom, DoubleToString(setupHTF.prixTP, _Digits), setupHTF.scoreZigZag.zigzagDepthRetenu));
      ObjectSetString(0, nomTxtTP, OBJPROP_FONT, "Arial Bold");
      ObjectSetInteger(0, nomTxtTP, OBJPROP_FONTSIZE, 8);
      ObjectSetInteger(0, nomTxtTP, OBJPROP_COLOR, clrSpringGreen);
      ObjectSetInteger(0, nomTxtTP, OBJPROP_SELECTABLE, false);
   }

   // 3️⃣ Ligne du SL Maître H4
   string nomLigneSL = baseHTF + "SL_MAITRE";
   ObjectDelete(0, nomLigneSL);
   if(ObjectCreate(0, nomLigneSL, OBJ_TREND, 0, setupHTF.tempsDoji, setupHTF.prixSL, tFin, setupHTF.prixSL))
   {
      ObjectSetInteger(0, nomLigneSL, OBJPROP_COLOR, clrCrimson);
      ObjectSetInteger(0, nomLigneSL, OBJPROP_WIDTH, 2);
      ObjectSetInteger(0, nomLigneSL, OBJPROP_STYLE, STYLE_DASH);
      ObjectSetInteger(0, nomLigneSL, OBJPROP_RAY_RIGHT, false);
      ObjectSetInteger(0, nomLigneSL, OBJPROP_SELECTABLE, false);
   }

   // 4️⃣ Rectangles des Order Blocks Classiques SMC protégés détectés en LTF
   for(int i = 0; i < totalOB && i < 8; i++)
   {
      string nomOB = baseHTF + "OB_" + IntegerToString(i + 1);
      ObjectDelete(0, nomOB);
      if(ObjectCreate(0, nomOB, OBJ_RECTANGLE, 0, obsLTF[i].tempsDebut, obsLTF[i].prixHaut, tFin, obsLTF[i].prixBas))
      {
         color cOB = obsLTF[i].estDernierOB
            ? (estAchat ? C'0,200,83' : C'213,0,0')
            : C'2,132,199';
         ObjectSetInteger(0, nomOB, OBJPROP_COLOR, cOB);
         ObjectSetInteger(0, nomOB, OBJPROP_FILL, true);
         ObjectSetInteger(0, nomOB, OBJPROP_BACK, true);
         ObjectSetInteger(0, nomOB, OBJPROP_WIDTH, obsLTF[i].estDernierOB ? 2 : 1);
         ObjectSetInteger(0, nomOB, OBJPROP_SELECTABLE, false);
      }
   }
}

//+------------------------------------------------------------------+
//| 🖥️ Affiche le Tableau de Bord HUD de l'EA en haut à gauche       |
//+------------------------------------------------------------------+
void MettreAJourTableauBordEA()
{
   if(!InpAfficherTableauBordEA)
      return;

   string nomHUD = g_prefixeEA + "HUD_INFO";
   if(ObjectFind(0, nomHUD) < 0)
   {
      ObjectCreate(0, nomHUD, OBJ_LABEL, 0, 0, 0);
      ObjectSetInteger(0, nomHUD, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(0, nomHUD, OBJPROP_XDISTANCE, 14);
      ObjectSetInteger(0, nomHUD, OBJPROP_YDISTANCE, 26);
      ObjectSetString(0, nomHUD, OBJPROP_FONT, "Consolas");
      ObjectSetInteger(0, nomHUD, OBJPROP_FONTSIZE, 9);
   }

   string modeTxt = (InpModeStrategie == EA_MODE_FRACTAL_HTF_VERS_LTF)
      ? StringFormat("FRACTAL %s -> %s", EnumToString(InpTimeframeMaitreHTF), EnumToString(_Period))
      : StringFormat("MONO-TF (%s)", EnumToString(_Period));

   string statutHTF = "Aucun setup HTF actif";
   if(g_aSetupMaitreHTFActif)
   {
      statutHTF = StringFormat(
         "Setup %s Actif | SL H4: %s | Grand TP H4: %s (Prof:%d)",
         (g_setupMaitreHTFActif.type == DIRECTION_ACHAT) ? "ACHAT" : "VENTE",
         DoubleToString(g_setupMaitreHTFActif.prixSL, _Digits),
         DoubleToString(g_setupMaitreHTFActif.prixTP, _Digits),
         g_setupMaitreHTFActif.scoreZigZag.zigzagDepthRetenu
      );
   }

   string resume = StringFormat(
      "🎼 EA Orchestrateur SMC [%s] | Setups H4: %d | Trades LTF: %d | %s",
      modeTxt,
      g_totalSetupsHTFDetectes,
      g_totalPositionsLTFOuvertes,
      statutHTF
   );

   ObjectSetString(0, nomHUD, OBJPROP_TEXT, resume);
   ObjectSetInteger(0, nomHUD, OBJPROP_COLOR, g_aSetupMaitreHTFActif ? clrSpringGreen : clrLightSkyBlue);
}

//+------------------------------------------------------------------+
//| 🚀 Exécute un ordre d'Achat ou de Vente réel sur MetaTrader 5    |
//+------------------------------------------------------------------+
bool OuvrirPositionMarketMT5(
   ENUM_DIRECTION_SMC direction,
   double prixSLBrut,
   double prixTPCible,
   string commentaireOrdre,
   datetime tempsSignal,
   datetime tempsFinProjection
)
{
   bool   estAchat = (direction == DIRECTION_ACHAT);
   double ask      = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double bid      = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double prixExec = estAchat ? ask : bid;

   // Ajout de la marge de sécurité derrière le Petit SL
   double margeSL = (double)MathMax(0, InpMargeSecuriteSLPoints) * _Point;
   double slFinal = estAchat ? (prixSLBrut - margeSL) : (prixSLBrut + margeSL);
   double tpFinal = prixTPCible;

   slFinal = NormalizeDouble(slFinal, _Digits);
   tpFinal = NormalizeDouble(tpFinal, _Digits);

   // Vérification de cohérence des niveaux SL et TP par rapport au prix d'exécution
   double stopLevelPoints = (double)SymbolInfoInteger(_Symbol, SYMBOL_TRADE_STOPS_LEVEL) * _Point;
   double distMinStop     = MathMax(_Point * 5.0, stopLevelPoints);

   if(estAchat)
   {
      if(slFinal >= prixExec - distMinStop || tpFinal <= prixExec + distMinStop)
         return false;
   }
   else
   {
      if(slFinal <= prixExec + distMinStop || tpFinal >= prixExec - distMinStop)
         return false;
   }

   double distanceSL = MathAbs(prixExec - slFinal);
   double distanceTP = MathAbs(tpFinal - prixExec);
   double ratioRR    = NormalizeDouble(distanceTP / MathMax(_Point, distanceSL), 2);

   if(ratioRR < InpRatioRRMinimum)
   {
      PrintFormat("ℹ️ [EA SMC] Trade ignoré car Ratio R:R (%.2fR) < Minimum requis (%.2fR)", ratioRR, InpRatioRRMinimum);
      return false;
   }

   double lot = CalculerLotSelonRisque(prixExec, slFinal);

   MqlTradeRequest req;
   MqlTradeResult  res;
   ZeroMemory(req);
   ZeroMemory(res);

   req.action       = TRADE_ACTION_DEAL;
   req.symbol       = _Symbol;
   req.volume       = lot;
   req.type         = estAchat ? ORDER_TYPE_BUY : ORDER_TYPE_SELL;
   req.price        = prixExec;
   req.sl           = slFinal;
   req.tp           = tpFinal;
   req.deviation    = InpSlippagePoints;
   req.magic        = InpMagicNumber;
   req.comment      = commentaireOrdre;
   req.type_filling = ObtenirModeRemplissageBroker(_Symbol);

   if(!OrderSend(req, res))
   {
      PrintFormat("❌ [EA SMC] Échec OrderSend (%s) Code=%d : %s", commentaireOrdre, res.retcode, res.comment);
      return false;
   }

   g_totalPositionsLTFOuvertes++;
   g_compteurObjetsPositionTV++;

   PrintFormat(
      "✅ [EA SMC] POSITION %s OUVERTE (%.2f lot) @ %s | Petit SL: %s | Grand TP: %s | R:R = %.2fR",
      estAchat ? "BUY" : "SELL",
      lot,
      DoubleToString(prixExec, _Digits),
      DoubleToString(slFinal, _Digits),
      DoubleToString(tpFinal, _Digits),
      ratioRR
   );

   // Tracé de l'objet Position Longue / Courte style TradingView sur le graphique MT5
   DessinerObjetPositionTradingViewMT5(
      g_compteurObjetsPositionTV,
      direction,
      tempsSignal,
      tempsFinProjection,
      prixExec,
      slFinal,
      tpFinal,
      ratioRR,
      lot
   );

   return true;
}

//+------------------------------------------------------------------+
//| 🏛️ Met à jour l'analyse du Timeframe Maître HTF (ex: H4)         |
//|    et détecte tout nouveau Setup Maître H4 confirmé              |
//+------------------------------------------------------------------+
void MettreAJourSetupMaitreHTF()
{
   MqlRates ratesHTF[];
   ArraySetAsSeries(ratesHTF, false);
   int nbMaxHTF = 250;
   int copied   = CopyRates(_Symbol, InpTimeframeMaitreHTF, 0, nbMaxHTF, ratesHTF);
   if(copied < 30)
      return;

   BougieSMC bougiesHTF[];
   ArrayResize(bougiesHTF, copied);
   for(int i = 0; i < copied; i++)
   {
      bougiesHTF[i].temps  = ratesHTF[i].time;
      bougiesHTF[i].open   = ratesHTF[i].open;
      bougiesHTF[i].high   = ratesHTF[i].high;
      bougiesHTF[i].low    = ratesHTF[i].low;
      bougiesHTF[i].close  = ratesHTF[i].close;
      bougiesHTF[i].volume = ratesHTF[i].tick_volume;
   }

   // 1️⃣ Si un Setup Maître HTF est déjà actif, vérifier s'il a touché son Grand TP H4 ou cassé son SL Maître H4
   if(g_aSetupMaitreHTFActif)
   {
      BougieSMC bCloturee = bougiesHTF[copied - 2];
      BougieSMC bCourante = bougiesHTF[copied - 1];
      bool estAchatHTF    = (g_setupMaitreHTFActif.type == DIRECTION_ACHAT);

      bool tpTouche = estAchatHTF
         ? (bCloturee.high >= g_setupMaitreHTFActif.prixTP || bCourante.high >= g_setupMaitreHTFActif.prixTP)
         : (bCloturee.low <= g_setupMaitreHTFActif.prixTP || bCourante.low <= g_setupMaitreHTFActif.prixTP);

      bool slCasse = estAchatHTF
         ? (bCloturee.low <= g_setupMaitreHTFActif.prixSL || bCourante.low <= g_setupMaitreHTFActif.prixSL)
         : (bCloturee.high >= g_setupMaitreHTFActif.prixSL || bCourante.high >= g_setupMaitreHTFActif.prixSL);

      if(tpTouche || slCasse)
      {
         PrintFormat(
            "🏁 [EA SMC] Setup Maître %s terminé (%s).",
            EnumToString(InpTimeframeMaitreHTF),
            tpTouche ? "🎯 GRAND TP ATTEINT" : "🛑 SL MAÎTRE CASSÉ"
         );
         g_aSetupMaitreHTFActif = false;
      }
   }

   // 2️⃣ Rechercher un nouveau Setup Maître HTF confirmé sur la dernière bougie HTF clôturée
   datetime tempsBarreHTFCourante = bougiesHTF[copied - 1].temps;
   if(tempsBarreHTFCourante == g_derniereBarreHTF && g_aSetupMaitreHTFActif)
      return;
   g_derniereBarreHTF = tempsBarreHTFCourante;

   int nbConf = MathMax(1, InpNbBougiesConfirmation);
   // On inspecte les Dojis récents ayant pu être confirmés sur les dernières bougies HTF clôturées
   int idxDerniereHTFCloturee = copied - 2;
   int idxDebutScanDojiHTF    = MathMax(15, idxDerniereHTFCloturee - nbConf - 8);

   for(int idxCandidat = idxDerniereHTFCloturee - nbConf; idxCandidat >= idxDebutScanDojiHTF; idxCandidat--)
   {
      SignalDojiPlageSMC dojiHTF;
      if(!ExtraireDojiSurIndexPrecisSMC(
         bougiesHTF, copied, idxCandidat,
         InpActiverAchat, InpActiverVente, InpActiverFiltreTailleHTF,
         InpPeriodeHistorique, InpMultiplicateurBougie1, InpMultiplicateurCorps2,
         InpToleranceDeficit, InpToleranceDepassement, InpMaxReculRecherche,
         dojiHTF
      ))
         continue;

      SetupOrchestreSMC_MT5 setupCandidat;
      if(!EvaluerDojiCompletUniqueSMC(
         dojiHTF, bougiesHTF, copied,
         InpPeriodeATRShved, InpZoneFuzzFactor, InpScoreMinimumShved, InpExigerDebutEtFinDansPlage,
         InpActiverZigZagDynamique, InpZigZagDepthMin, InpZigZagDepthMax, InpZigZagDepthSecours,
         InpNbVaguesSuperposees, InpTypeChevauchementUOP, InpPoidsCorpsUOP, InpPoidsMecheUOP,
         InpExigerAutorouteUOP_HTF, InpMinTauxAutorouteHTF, InpActiverFiltrePlageTP_HTF, InpMaxReculPlageTP,
         nbConf, InpModeCalculTP, InpPalierTPVise,
         InpPointsParRetest, InpPlafondCarburantRetests, InpBonusMecheProfonde, InpBonusMecheNormale,
         InpPeagePalierUOP, InpCoutParATR,
         InpCoutFrictionFortOverlap, InpCoutFrictionMoyenOverlap, InpCoutFrictionFaibleOverlap,
         InpSeuilFortOverlap, InpSeuilFaibleOverlap, InpMargeSecuriteDevantPalier,
         InpSeuilScoreGrandMouvement, _Point, _Digits, setupCandidat,
         InpActiverTPCibleLiquiditeSR, InpComportementAbsenceSR, InpTauxMinChevauchementSR, InpCouvertureMinTrajetSRPct
      ))
         continue;

      // Le setup HTF doit être CONFIRMÉ et toujours EN VIE (ni TP ni SL touché)
      if(setupCandidat.statut == SETUP_CONFIRME && !setupCandidat.estTermine && setupCandidat.prixTP > 0.0)
      {
         // Si c'est un nouveau Setup Maître HTF
         if(!g_aSetupMaitreHTFActif || g_setupMaitreHTFActif.tempsDoji != setupCandidat.tempsDoji)
         {
            int idxB1 = MathMax(0, idxCandidat - 1);
            double ampDojiHTF = MathMax(
               bougiesHTF[idxCandidat].high - bougiesHTF[idxCandidat].low,
               bougiesHTF[idxB1].high - bougiesHTF[idxB1].low
            );
            bool estAchat = (setupCandidat.type == DIRECTION_ACHAT);
            g_bornePlageMaitreHTF = estAchat
               ? (setupCandidat.prixEntree + ampDojiHTF)
               : (setupCandidat.prixEntree - ampDojiHTF);

            g_setupMaitreHTFActif          = setupCandidat;
            g_aSetupMaitreHTFActif         = true;
            g_nbTradesPrisSurSetupHTFActuel = 0;
            g_totalSetupsHTFDetectes++;

            PrintFormat(
               "🏛️ [EA SMC] NOUVEAU SETUP MAÎTRE %s CONFIRMÉ (%s) | Plage Protégée: [%s -> %s] | Grand TP: %s | Prof.ZigZag: %d",
               EnumToString(InpTimeframeMaitreHTF),
               estAchat ? "ACHAT" : "VENTE",
               DoubleToString(setupCandidat.prixSL, _Digits),
               DoubleToString(g_bornePlageMaitreHTF, _Digits),
               DoubleToString(setupCandidat.prixTP, _Digits),
               setupCandidat.scoreZigZag.zigzagDepthRetenu
            );
         }
         break;
      }
   }
}

//+------------------------------------------------------------------+
//| 🔬 Scanne le Timeframe LTF (Graphique courant M15/M30) à         |
//|    l'intérieur de la Plage Protégée H4 (SANS filtre UOP)         |
//+------------------------------------------------------------------+
void ScannerEtExecuterSecondSetupLTF()
{
   if(!g_aSetupMaitreHTFActif)
      return;

   MqlRates ratesLTF[];
   ArraySetAsSeries(ratesLTF, false);
   int nbMaxLTF = 300;
   int copied   = CopyRates(_Symbol, _Period, 0, nbMaxLTF, ratesLTF);
   if(copied < 25)
      return;

   BougieSMC bougiesLTF[];
   ArrayResize(bougiesLTF, copied);
   int idxDebutHTFDansLTF = 0;

   for(int i = 0; i < copied; i++)
   {
      bougiesLTF[i].temps  = ratesLTF[i].time;
      bougiesLTF[i].open   = ratesLTF[i].open;
      bougiesLTF[i].high   = ratesLTF[i].high;
      bougiesLTF[i].low    = ratesLTF[i].low;
      bougiesLTF[i].close  = ratesLTF[i].close;
      bougiesLTF[i].volume = ratesLTF[i].tick_volume;

      if(ratesLTF[i].time < g_setupMaitreHTFActif.tempsDoji)
         idxDebutHTFDansLTF = i;
   }

   bool   estAchatHTF = (g_setupMaitreHTFActif.type == DIRECTION_ACHAT);
   double prixSL_HTF  = g_setupMaitreHTFActif.prixSL;
   double prixTP_HTF  = g_setupMaitreHTFActif.prixTP;
   double minPlageHTF = MathMin(prixSL_HTF, g_bornePlageMaitreHTF);
   double maxPlageHTF = MathMax(prixSL_HTF, g_bornePlageMaitreHTF);

   // 1️⃣ Vérifier sur les bougies LTF si le Setup Maître HTF vient d'être invalidé ou d'atteindre son Grand TP
   BougieSMC bCourante = bougiesLTF[copied - 1];
   if((estAchatHTF && (bCourante.low <= prixSL_HTF || bCourante.high >= prixTP_HTF)) ||
      (!estAchatHTF && (bCourante.high >= prixSL_HTF || bCourante.low <= prixTP_HTF)))
   {
      g_aSetupMaitreHTFActif = false;
      return;
   }

   // 2️⃣ Détecter les Order Blocks Classiques SMC protégés en LTF dans la plage H4
   OrderBlockClassiqueMT5 obsProt[];
   int totalOB = DetecterOrderBlocksClassiquesDansPlageMT5(
      bougiesLTF,
      idxDebutHTFDansLTF,
      copied - 2,
      g_setupMaitreHTFActif.type,
      prixSL_HTF,
      g_bornePlageMaitreHTF,
      obsProt
   );

   // Dessiner la Plage Protégée H4, le Grand TP H4 et les Order Blocks LTF sur le graphique
   DessinerCalqueMaitreHTF_MT5(
      g_setupMaitreHTFActif,
      g_bornePlageMaitreHTF,
      bCourante.temps,
      obsProt,
      totalOB
   );

   // 3️⃣ Vérifier si nous avons le droit d'ouvrir une nouvelle position LTF
   if(g_nbTradesPrisSurSetupHTFActuel >= InpMaxPositionsParSetupHTF)
      return;
   if(!InpAutoriserReentreeSiSL && g_nbTradesPrisSurSetupHTFActuel >= 1)
      return;
   if(APositionOuverteEA())
      return;

   // 4️⃣ Vérifier si un Doji LTF vient tout juste de terminer ses 3 bougies de confirmation (sur la bougie clôturée copied - 2)
   //    SANS filtre de Taux de Chevauchement UOP (car l'autoroute a déjà été validée en H4 !)
   int nbConf             = MathMax(1, InpNbBougiesConfirmation);
   int idxConfirmationLTF = copied - 2;
   int idxCandidatDojiLTF = idxConfirmationLTF - nbConf;

   if(idxCandidatDojiLTF < 5 || bougiesLTF[idxCandidatDojiLTF].temps < g_setupMaitreHTFActif.tempsDoji)
      return;
   if(bougiesLTF[idxCandidatDojiLTF].temps == g_dernierDojiLTFTradeTemps)
      return;

   SignalDojiPlageSMC dojiLTF;
   if(!ExtraireDojiSurIndexPrecisSMC(
      bougiesLTF, copied, idxCandidatDojiLTF,
      estAchatHTF, !estAchatHTF, InpActiverFiltreTailleLTF,
      InpPeriodeHistorique, InpMultiplicateurBougie1, InpMultiplicateurCorps2,
      InpToleranceDeficit, InpToleranceDepassement, InpMaxReculRecherche,
      dojiLTF
   ))
      return;

   if(dojiLTF.type != g_setupMaitreHTFActif.type)
      return;

   double prixEntreeLTF = dojiLTF.close2;
   double petitSL_LTF   = dojiLTF.prixExtreme;

   // A. Le Doji LTF doit se situer à l'intérieur de la Plage Protégée H4 [SL_H4 ➔ Close(B2_H4) ± AmplitudeDoji_H4]
   bool dansPlageHTF =
      (petitSL_LTF >= minPlageHTF && petitSL_LTF <= maxPlageHTF) ||
      (prixEntreeLTF >= minPlageHTF && prixEntreeLTF <= maxPlageHTF);
   if(!dansPlageHTF)
      return;

   // B. Optionnel : Exiger que le Doji LTF prenne appui dans un Order Block Classique protégé
   if(InpExigerContactOrderBlock)
   {
      bool toucheOB = false;
      for(int j = 0; j < totalOB; j++)
      {
         if(InpUniquementDernierOB && !obsProt[j].estDernierOB)
            continue;
         bool chevauche = estAchatHTF
            ? (petitSL_LTF <= obsProt[j].prixHaut && prixEntreeLTF >= obsProt[j].prixBas)
            : (petitSL_LTF >= obsProt[j].prixBas && prixEntreeLTF <= obsProt[j].prixHaut);
         if(chevauche)
         {
            toucheOB = true;
            break;
         }
      }
      if(!toucheOB)
         return;
   }

   // C. Vérifier les 3 bougies de confirmation LTF : chacune doit rester dans [Petit SL_LTF ➔ Close(B2_LTF) ± AmplitudeDoji_LTF]
   double ampDojiLTF = MathMax(
      bougiesLTF[idxCandidatDojiLTF].high - bougiesLTF[idxCandidatDojiLTF].low,
      bougiesLTF[idxCandidatDojiLTF - 1].high - bougiesLTF[idxCandidatDojiLTF - 1].low
   );
   double borneRangeLTF = estAchatHTF
      ? (prixEntreeLTF + ampDojiLTF)
      : (prixEntreeLTF - ampDojiLTF);

   for(int k = idxCandidatDojiLTF + 1; k <= idxConfirmationLTF; k++)
   {
      if(estAchatHTF)
      {
         if(bougiesLTF[k].low <= petitSL_LTF || bougiesLTF[k].close > borneRangeLTF)
            return;
      }
      else
      {
         if(bougiesLTF[k].high >= petitSL_LTF || bougiesLTF[k].close < borneRangeLTF)
            return;
      }
   }

   // D. Exécution de la Position LTF : Petit SL LTF ➔ Grand TP H4 !
   datetime tSignal = bougiesLTF[idxConfirmationLTF].temps;
   datetime tFinTV  = tSignal + PeriodSeconds(_Period) * 24;
   string   comm    = StringFormat("SMC_Fractal_%s_TP_%s", EnumToString(_Period), EnumToString(InpTimeframeMaitreHTF));

   if(OuvrirPositionMarketMT5(dojiLTF.type, petitSL_LTF, prixTP_HTF, comm, tSignal, tFinTV))
   {
      g_dernierDojiLTFTradeTemps = dojiLTF.temps;
      g_nbTradesPrisSurSetupHTFActuel++;
   }
}

//+------------------------------------------------------------------+
//| 📈 Mode Mono-Timeframe (Exécute le setup complet sur le graphique|
//+------------------------------------------------------------------+
void ScannerEtExecuterMonoTimeframe()
{
   if(APositionOuverteEA())
      return;

   MqlRates rates[];
   ArraySetAsSeries(rates, false);
   int nbMax  = 300;
   int copied = CopyRates(_Symbol, _Period, 0, nbMax, rates);
   if(copied < 30)
      return;

   BougieSMC bougies[];
   ArrayResize(bougies, copied);
   for(int i = 0; i < copied; i++)
   {
      bougies[i].temps  = rates[i].time;
      bougies[i].open   = rates[i].open;
      bougies[i].high   = rates[i].high;
      bougies[i].low    = rates[i].low;
      bougies[i].close  = rates[i].close;
      bougies[i].volume = rates[i].tick_volume;
   }

   int nbConf          = MathMax(1, InpNbBougiesConfirmation);
   int idxConfirmation = copied - 2;
   int idxCandidatDoji = idxConfirmation - nbConf;
   if(idxCandidatDoji < 15)
      return;

   SignalDojiPlageSMC doji;
   if(!ExtraireDojiSurIndexPrecisSMC(
      bougies, copied, idxCandidatDoji,
      InpActiverAchat, InpActiverVente, InpActiverFiltreTailleHTF,
      InpPeriodeHistorique, InpMultiplicateurBougie1, InpMultiplicateurCorps2,
      InpToleranceDeficit, InpToleranceDepassement, InpMaxReculRecherche,
      doji
   ))
      return;

   if(doji.temps == g_dernierDojiLTFTradeTemps)
      return;

   SetupOrchestreSMC_MT5 setup;
   if(!EvaluerDojiCompletUniqueSMC(
      doji, bougies, copied,
      InpPeriodeATRShved, InpZoneFuzzFactor, InpScoreMinimumShved, InpExigerDebutEtFinDansPlage,
      InpActiverZigZagDynamique, InpZigZagDepthMin, InpZigZagDepthMax, InpZigZagDepthSecours,
      InpNbVaguesSuperposees, InpTypeChevauchementUOP, InpPoidsCorpsUOP, InpPoidsMecheUOP,
      InpExigerAutorouteUOP_HTF, InpMinTauxAutorouteHTF, InpActiverFiltrePlageTP_HTF, InpMaxReculPlageTP,
      nbConf, InpModeCalculTP, InpPalierTPVise,
      InpPointsParRetest, InpPlafondCarburantRetests, InpBonusMecheProfonde, InpBonusMecheNormale,
      InpPeagePalierUOP, InpCoutParATR,
      InpCoutFrictionFortOverlap, InpCoutFrictionMoyenOverlap, InpCoutFrictionFaibleOverlap,
      InpSeuilFortOverlap, InpSeuilFaibleOverlap, InpMargeSecuriteDevantPalier,
      InpSeuilScoreGrandMouvement, _Point, _Digits, setup,
      InpActiverTPCibleLiquiditeSR, InpComportementAbsenceSR, InpTauxMinChevauchementSR, InpCouvertureMinTrajetSRPct
   ))
      return;

   if(setup.statut == SETUP_CONFIRME && !setup.estTermine && setup.prixTP > 0.0)
   {
      datetime tSignal = bougies[idxConfirmation].temps;
      datetime tFinTV  = tSignal + PeriodSeconds(_Period) * 20;
      string   comm    = StringFormat("SMC_Mono_%s_Prof%d", EnumToString(_Period), setup.scoreZigZag.zigzagDepthRetenu);

      if(OuvrirPositionMarketMT5(setup.type, setup.prixSL, setup.prixTP, comm, tSignal, tFinTV))
      {
         g_dernierDojiLTFTradeTemps = doji.temps;
      }
   }
}

//+------------------------------------------------------------------+
//| Initialisation de l'Expert Advisor                               |
//+------------------------------------------------------------------+
int OnInit()
{
   ZeroMemory(g_setupMaitreHTFActif);
   g_aSetupMaitreHTFActif = false;

   PrintFormat(
      "🚀 [EA Orchestrateur SMC Fractal] Initialisé sur %s | Graphique LTF: %s | Maître HTF: %s | Mode: %s",
      _Symbol,
      EnumToString(_Period),
      EnumToString(InpTimeframeMaitreHTF),
      (InpModeStrategie == EA_MODE_FRACTAL_HTF_VERS_LTF) ? "FRACTAL HTF -> LTF" : "MONO-TIMEFRAME"
   );

   MettreAJourTableauBordEA();
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Nettoyage à la fermeture de l'EA                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   ObjectsDeleteAll(0, g_prefixeEA);
   ChartRedraw(0);
}

//+------------------------------------------------------------------+
//| Boucle principale sur chaque Tick du Strategy Tester MT5         |
//+------------------------------------------------------------------+
void OnTick()
{
   // 1️⃣ Gestion continue du Break-Even sur les positions en cours
   GererBreakEvenPositionsActives();

   // 2️⃣ Exécution uniquement à l'ouverture d'une nouvelle bougie du graphique (ultra-rapide en Backtest MT5 !)
   datetime tempsBarreCourante = iTime(_Symbol, _Period, 0);
   if(tempsBarreCourante == 0 || tempsBarreCourante == g_derniereBarreLTF)
      return;
   g_derniereBarreLTF = tempsBarreCourante;

   // 3️⃣ Logique de Stratégie selon le mode choisi
   if(InpModeStrategie == EA_MODE_FRACTAL_HTF_VERS_LTF)
   {
      MettreAJourSetupMaitreHTF();
      ScannerEtExecuterSecondSetupLTF();
   }
   else
   {
      ScannerEtExecuterMonoTimeframe();
   }

   MettreAJourTableauBordEA();
}
//+------------------------------------------------------------------+
