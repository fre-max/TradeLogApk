//+------------------------------------------------------------------+
//|                                       ScannerMultiPairesSMC.mq5  |
//|              🎼 Chef d'Orchestre SMC - Version MetaTrader 5       |
//|  Scanner VPS FTMO Multi-Actifs & Multi-UT (Saut Instantané + N-3)|
//+------------------------------------------------------------------+
#property copyright   "JournalMobileAPK - Orchestrateur SMC MT5"
#property version     "1.20"
#property description "Scanner Central VPS Spécial FTMO : Détecte automatiquement tous les symboles FTMO (Forex, Métaux, Indices, Matières Premières, Cryptos) sur M30/H1/H4/D1 depuis 1 seul graphique !"
#property indicator_chart_window
#property indicator_plots 0

// ─── 📦 Inclusion des 6 Modules de l'Architecture Modulaire ─────────────────────
#include "Modules/Module00_TypesEtOutils.mqh"
#include "Modules/Module01_DojiEtPlage.mqh"
#include "Modules/Module02_ShvedEtCollines.mqh"
#include "Modules/Module03_ZigZagDynamiqueUOP.mqh"
#include "Modules/Module04_EnergieEtConfirmation.mqh"
#include "Modules/Module05_VisuelsEtAlertes.mqh"
#include "Modules/Module06_MoteurEvaluationRapide.mqh"

/**
 * Mode de récupération des symboles à surveiller
 */
enum ENUM_MODE_SELECTION_SYMBOLES
{
   MODE_SYMBOLES_AUTO_COURTIER    = 0, // 🌐 Automatique : Tous les symboles FTMO / Courtier (selon filtres ci-dessous)
   MODE_SYMBOLES_MARKET_WATCH     = 1, // 👁️ Market Watch : Tous les symboles affichés dans l'Observatoire du marché
   MODE_SYMBOLES_LISTE_MANUELLE   = 2  // ✍️ Manuel : Uniquement la liste écrite dans InpListePairesManuelles
};

/**
 * Catégories d'actifs FTMO identifiées automatiquement
 */
enum ENUM_CATEGORIE_ACTIF_FTMO
{
   CAT_FTMO_FOREX_MAJEUR_MINEUR = 0, // Forex Majeures & Mineures (28 paires)
   CAT_FTMO_FOREX_EXOTIQUE      = 1, // Forex Exotiques (TRY, ZAR, MXN, PLN, CZK, HUF, SEK, NOK, SGD, HKD...)
   CAT_FTMO_METAUX              = 2, // Métaux précieux (XAUUSD, XAGUSD, XPTUSD, XPDUSD...)
   CAT_FTMO_INDICES_CASH        = 3, // Indices boursiers (US100.cash, US30.cash, GER40.cash, US500.cash...)
   CAT_FTMO_MATIERES_PREMIERES  = 4, // Énergies & Matières premières (USOIL.cash, UKOIL.cash, NATGAS.cash...)
   CAT_FTMO_CRYPTOS             = 5, // Cryptomonnaies (BTCUSD, ETHUSD, SOLUSD, XRPUSD...)
   CAT_FTMO_ACTIONS_STOCKS      = 6, // Actions / Stocks CFD (AAPL, NVDA, TSLA...)
   CAT_FTMO_AUTRE               = 7  // Autre actif
};

// ==============================================================================
// ⚙️ PARAMÈTRES D'ENTRÉE DU SCANNER MULTI-PAIRES VPS (SPÉCIAL FTMO)
// ==============================================================================

input group "=== 📡 0. SÉLECTION AUTOMATIQUE DES SYMBOLES FTMO ==="
input ENUM_MODE_SELECTION_SYMBOLES InpModeSelectionSymboles = MODE_SYMBOLES_AUTO_COURTIER; // Mode de détection des symboles
input bool   InpInclureForexMajeursMineurs = true;         // ✅ Inclure le Forex Majeures & Mineures (EURUSD, GBPJPY...)
input bool   InpExclureForexExotiques      = true;         // 🛡️ Exclure les paires Forex Exotiques (USDTRY, USDZAR, USDMXN... spreads élevés)
input bool   InpInclureMetaux              = true;         // ✅ Inclure les Métaux (XAUUSD, XAGUSD, XAUEUR...)
input bool   InpInclureIndices             = true;         // ✅ Inclure les Indices Cash (US100.cash, US30.cash, GER40.cash...)
input bool   InpInclureMatieresPremieres   = true;         // ✅ Inclure les Énergies & Matières Premières (USOIL.cash, UKOIL.cash...)
input bool   InpInclureCryptos             = true;         // ✅ Inclure les Cryptos (BTCUSD, ETHUSD, SOLUSD...)
input bool   InpInclureActionsStocks       = false;        // ⬜ Inclure les Actions / Stocks CFD (désactivé par défaut à cause des gaps quotidiens)
input string InpListePairesManuelles       = "EURUSD,GBPUSD,USDJPY,AUDUSD,USDCAD,USDCHF,NZDUSD,EURGBP,EURJPY,GBPJPY,XAUUSD,US100.cash,US30.cash,GER40.cash,BTCUSD"; // Liste manuelle (utilisée si Mode = Manuel)

input group "=== ⏱️ 0B. TIMEFRAMES & CADENCE DU SCANNER VPS ==="
input bool   InpScannerM30                 = true;         // Surveiller le Timeframe M30
input bool   InpScannerH1                  = true;         // Surveiller le Timeframe H1
input bool   InpScannerH4                  = true;         // Surveiller le Timeframe H4
input bool   InpScannerD1                  = true;         // Surveiller le Timeframe D1
input int    InpCadenceFileAttenteMs       = 100;          // ⏱️ Cadence entre 2 analyses réelles (100 ms = 10 analyses/sec, zéro pic CPU)
input int    InpNbBougiesParScan           = 350;          // Nombre de bougies chargées par paire lors d'une vérification

input group "=== 🔔 1. ALERTES MT5 & CAPTURE HD TELEGRAM (APRÈS 3 BOUGIES) ==="
input bool   InpActiverCaptureTelegram     = true;         // 📸 Envoyer la capture d'écran HD du graphique + fiche sur Telegram
input int    InpLargeurCapturePx           = 1600;         // Largeur de la capture d'écran HD envoyée sur Telegram (px)
input int    InpHauteurCapturePx           = 900;          // Hauteur de la capture d'écran HD envoyée sur Telegram (px)
input bool   InpActiverAlertePopup         = true;         // Activer la fenêtre d'alerte Popup + Son sur MT5
input bool   InpActiverNotificationPush    = true;         // Envoyer une notification Push sur le téléphone (App MT5)
input bool   InpActiverAlerteEmail         = false;        // Envoyer un Email lors de la confirmation
input bool   InpActiverSonSeul             = false;        // Jouer un son même si la Popup est désactivée
input string InpFichierSon                 = "alert2.wav"; // Fichier sonore d'alerte

input group "=== 🕯️ 2. DÉCLENCHEUR DOJI LIQ/REINT & PLAGE CIBLÉE (BLOC 1) ==="
input bool   InpActiverAchat               = true;         // Autoriser les setups d'Achat (Spring)
input bool   InpActiverVente               = true;         // Autoriser les setups de Vente (UTAD)
input bool   InpActiverFiltreTaille        = true;         // Filtrer les Dojis par taille relative (> moyenne)
input int    InpPeriodeHistorique          = 10;           // Période pour la moyenne de taille des bougies
input double InpMultiplicateurBougie1      = 1.0;          // Multiplicateur minimal Bougie 1 (Liquidation)
input double InpMultiplicateurCorps2       = 1.2;          // Multiplicateur minimal Corps Bougie 2 (Réintégration)
input double InpToleranceDeficit           = 0.30;         // Tolérance de déficit de réintégration (30%)
input double InpToleranceDepassement       = 2.0;          // Tolérance de dépassement favorable (200%)
input int    InpMaxReculRecherche          = 100;          // Recul max (en bougies) pour trouver l'extrême précédent

input group "=== 🛡️ 3. S/R SHVED & VRAIES COLLINES DE RETESTS (BLOC 2) ==="
input int    InpPeriodeATRShved            = 2;            // Période ATR pour l'épaisseur des zones Shved
input double InpZoneFuzzFactor             = 0.01;         // Facteur d'épaisseur des zones Shved (0.01 = précis)
input int    InpScoreMinimumShved          = 0;            // Score minimal Shved requis (/100) pour accepter un setup
input bool   InpExigerDebutEtFinDansPlage  = false;        // Exiger que le S/R soit né strictement dans la plage

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

input group "=== 🎨 6. STYLE TRADINGVIEW & AFFICHAGE SUR LE GRAPHIQUE ==="
input bool  InpAppliquerStyleTradingView  = true;           // 🎨 Appliquer automatiquement le thème TradingView Dark (#131722, #26A69A, #EF5350)
input bool  InpTracerSetupPaireCourante   = false;          // Tracer les objets du setup sur le graphique (false = Bougies pures uniquement !)
input bool  InpAfficherDiagnosticCollines = false;          // Tracer les collines de retest (⛰️) et le ZigZag Dynamique

#define PREFIXE_SCANNER_SMC "SMC_SCAN_"
#define MAX_LIGNES_TABLEAU  14

/**
 * Représente un slot de surveillance (1 Symbole x 1 Timeframe) dans la file d'attente dynamique
 */
struct SlotSurveillanceSMC
{
   string                symbole;
   ENUM_TIMEFRAMES       periode;
   string                nomPeriode;
   datetime              derniereBarreScannee;
   datetime              prochainEssaiTelechargement;
   datetime              dernierTempsAlerte;
   bool                  estInitialise;
   bool                  aSetupValide;
   SetupOrchestreSMC_MT5 setup;
};

SlotSurveillanceSMC g_slots[];
int                 g_nbSlotsTotal                  = 0;
int                 g_nbSymbolesRetenus             = 0;
int                 g_indexSlotCourant              = 0;
int                 g_pageTableau                   = 0;
int                 g_slotCaptureTelegramEnAttente  = -1;
int                 g_ticksAttenteCaptureTelegram   = 0;
datetime            g_derniereBarreGraphiqueActif   = 0;
bool                g_fileInitialisee               = false; // Indique si la découverte des symboles a été effectuée dans OnTimer

/**
 * Convertit un ENUM_TIMEFRAMES en nom court lisible ("M30", "H1", "H4", "D1")
 */
string ObtenirNomCourtTimeframe(ENUM_TIMEFRAMES tf)
{
   if(tf == PERIOD_M15) return "M15";
   if(tf == PERIOD_M30) return "M30";
   if(tf == PERIOD_H1)  return "H1";
   if(tf == PERIOD_H4)  return "H4";
   if(tf == PERIOD_D1)  return "D1";
   return EnumToString(tf);
}

/**
 * Vérifie si le nom d'une paire Forex contient une devise exotique (spreads souvent élevés chez FTMO).
 * Exemple : EstPaireForexExotique("USDTRY") -> true ; EstPaireForexExotique("EURUSD") -> false
 */
bool EstDeviseExotiqueDansSymbole(string symMaj)
{
   string devisesExotiques[] = {
      "TRY", "ZAR", "MXN", "PLN", "CZK", "HUF", "SEK", "NOK",
      "SGD", "HKD", "CNH", "CNY", "RUB", "DKK", "THB", "ILS",
      "BRL", "INR", "KRW", "TWD", "RON", "BGN"
   };
   int nbExo = ArraySize(devisesExotiques);
   for(int i = 0; i < nbExo; i++)
   {
      if(StringFind(symMaj, devisesExotiques[i]) >= 0)
         return true;
   }
   return false;
}

/**
 * Vérifie si le symbole commence par ou contient l'un des mots-clés fournis.
 */
bool ContientMotCleSymbole(string texteMaj, string &motsCles[])
{
   int n = ArraySize(motsCles);
   for(int i = 0; i < n; i++)
   {
      if(StringFind(texteMaj, motsCles[i]) >= 0)
         return true;
   }
   return false;
}

/**
 * 🔍 Identifie automatiquement la catégorie FTMO d'un symbole à partir de son chemin (SYMBOL_PATH)
 * et de son nom sur MetaTrader 5.
 *
 * Exemple :
 * ENUM_CATEGORIE_ACTIF_FTMO cat = DeterminerCategorieSymboleFTMO("US100.cash"); // -> CAT_FTMO_INDICES_CASH
 */
/**
 * 🔍 Identifie automatiquement la catégorie FTMO d'un symbole à partir de son chemin (SYMBOL_PATH)
 * et de son nom sur MetaTrader 5.
 *
 * Exemple :
 * ENUM_CATEGORIE_ACTIF_FTMO cat = DeterminerCategorieSymboleFTMO("US100.cash"); // -> CAT_FTMO_INDICES_CASH
 */
ENUM_CATEGORIE_ACTIF_FTMO DeterminerCategorieSymboleFTMO(string sym)
{
   string symMaj  = sym;
   StringToUpper(symMaj);

   // 🚀 Accélération ultra-rapide : élimine instantanément les milliers d'actions CFD sans appel RPC lent
   if(!InpInclureActionsStocks)
   {
      if(StringFind(symMaj, "#") == 0 || StringFind(symMaj, ".US") > 0 || StringFind(symMaj, ".DE") > 0 || StringFind(symMaj, ".FR") > 0 || StringFind(symMaj, ".UK") > 0)
         return CAT_FTMO_ACTIONS_STOCKS;
   }

   string pathMaj = SymbolInfoString(sym, SYMBOL_PATH);
   StringToUpper(pathMaj);

   string descMaj = SymbolInfoString(sym, SYMBOL_DESCRIPTION);
   StringToUpper(descMaj);

   // 0️⃣ Détection prioritaire des Actions / Stocks CFD (pour éviter de confondre des tickers comme 'GOLD' ou 'SOL')
   string clesActionsPath[] = {"STOCK", "EQUIT", "SHARE", "COMPAN", "NASDAQ\\STOCK", "NYSE\\STOCK"};
   if(ContientMotCleSymbole(pathMaj, clesActionsPath))
      return CAT_FTMO_ACTIONS_STOCKS;

   // 1️⃣ Détection des Métaux précieux (XAU, XAG, XPT, XPD, Gold, Silver...)
   string clesMetauxPath[] = {"METAL", "BULLION", "PRECIOUS"};
   string clesMetauxSym[]  = {"XAU", "XAG", "XPT", "XPD", "XCU"};
   if(ContientMotCleSymbole(pathMaj, clesMetauxPath) || ContientMotCleSymbole(symMaj, clesMetauxSym))
      return CAT_FTMO_METAUX;
   if(symMaj == "GOLD" || symMaj == "SILVER" || StringFind(symMaj, "GOLD") == 0)
   {
      if(StringFind(pathMaj, "STOCK") < 0)
         return CAT_FTMO_METAUX;
   }

   // 2️⃣ Détection des Cryptomonnaies (BTC, ETH, SOL, XRP...)
   string clesCryptoPath[] = {"CRYPTO", "COIN", "DIGITAL", "BITCOIN"};
   string clesCryptoSym[]  = {
      "BTCUSD", "ETHUSD", "SOLUSD", "XRPUSD", "ADAUSD", "BNBUSD", "DOGEUSD", "LTCUSD", "DOTUSD",
      "AVAXUSD", "BCHUSD", "LINKUSD", "MATICUSD", "UNIUSD", "XLMUSD", "NEARUSD", "ATOMUSD"
   };
   if(ContientMotCleSymbole(pathMaj, clesCryptoPath) || ContientMotCleSymbole(symMaj, clesCryptoSym))
      return CAT_FTMO_CRYPTOS;

   // 3️⃣ Détection des Indices Boursiers Cash / Futures (US100, GER40, US30, SP500, DXY...)
   string clesIndicesPath[] = {"INDIC", "INDEX", "CASH IND"};
   string clesIndicesSym[]  = {
      "US30", "US100", "US500", "US2000", "GER40", "GER30", "DE40", "DE30", "DAX",
      "UK100", "FRA40", "EU50", "STOXX", "JP225", "AUS200", "SPN35", "HK50",
      "NL25", "SWI20", "NAS100", "USTEC", "SPX", "DJ30", "DX.F", "DXY", "USDX", "VIX", ".CASH", "SP500"
   };
   // Attention : USOIL, UKOIL et NATGAS sont des énergies
   string clesEnergiesSym[] = {
      "USOIL", "UKOIL", "WTI", "BRENT", "XTI", "XBR", "NATGAS", "NGAS", "XNG",
      "OIL", "COCOA", "COFFEE", "CORN", "SOYBEAN", "SUGAR", "WHEAT", "COTTON"
   };
   if(ContientMotCleSymbole(symMaj, clesEnergiesSym))
      return CAT_FTMO_MATIERES_PREMIERES;

   if(ContientMotCleSymbole(pathMaj, clesIndicesPath) || ContientMotCleSymbole(symMaj, clesIndicesSym))
      return CAT_FTMO_INDICES_CASH;

   // 4️⃣ Détection des Matières Premières / Énergies / Agriculture
   string clesCommodPath[] = {"COMMOD", "ENERG", "OIL", "AGRI", "SOFT", "RAW"};
   if(ContientMotCleSymbole(pathMaj, clesCommodPath))
      return CAT_FTMO_MATIERES_PREMIERES;

   // 5️⃣ Détection du Forex (Majeures/Mineures vs Exotiques)
   string clesForexPath[] = {"FOREX", "FX", "CURRENC", "MAJORS", "MINORS", "CROSSES", "EXOTIC"};
   ENUM_SYMBOL_CALC_MODE calcMode = (ENUM_SYMBOL_CALC_MODE)SymbolInfoInteger(sym, SYMBOL_TRADE_CALC_MODE);

   bool estForex = ContientMotCleSymbole(pathMaj, clesForexPath) || (calcMode == SYMBOL_CALC_MODE_FOREX);
   if(!estForex && StringLen(symMaj) >= 6)
   {
      string devisesMajeures[] = {"EUR", "USD", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD"};
      int nbMatch = 0;
      for(int d = 0; d < ArraySize(devisesMajeures); d++)
      {
         if(StringFind(symMaj, devisesMajeures[d]) >= 0)
            nbMatch++;
      }
      if(nbMatch >= 2)
         estForex = true;
   }

   if(estForex)
   {
      if(StringFind(pathMaj, "EXOTIC") >= 0 || EstDeviseExotiqueDansSymbole(symMaj))
         return CAT_FTMO_FOREX_EXOTIQUE;
      return CAT_FTMO_FOREX_MAJEUR_MINEUR;
   }

   // 6️⃣ Détection par défaut des Actions
   if(calcMode == SYMBOL_CALC_MODE_CFD || StringFind(pathMaj, "STOCK") >= 0)
      return CAT_FTMO_ACTIONS_STOCKS;

   return CAT_FTMO_AUTRE;
}

/**
 * Vérifie si un symbole doit être retenu selon les filtres de catégories FTMO choisis par l'utilisateur.
 */
bool SymboleEstAutoriseParFiltresFTMO(string sym)
{
   ENUM_CATEGORIE_ACTIF_FTMO cat = DeterminerCategorieSymboleFTMO(sym);

   switch(cat)
   {
      case CAT_FTMO_FOREX_MAJEUR_MINEUR:
         return InpInclureForexMajeursMineurs;
      case CAT_FTMO_FOREX_EXOTIQUE:
         return (InpInclureForexMajeursMineurs && !InpExclureForexExotiques);
      case CAT_FTMO_METAUX:
         return InpInclureMetaux;
      case CAT_FTMO_INDICES_CASH:
         return InpInclureIndices;
      case CAT_FTMO_MATIERES_PREMIERES:
         return InpInclureMatieresPremieres;
      case CAT_FTMO_CRYPTOS:
         return InpInclureCryptos;
      case CAT_FTMO_ACTIONS_STOCKS:
         return InpInclureActionsStocks;
      default:
         return false;
   }
}

/**
 * Ajoute un symbole et ses Timeframes sélectionnés dans la file d'attente dynamique.
 */
void AjouterSymboleDansFileScanner(string sym, ENUM_TIMEFRAMES &listeTF[], int nbTF)
{
   StringTrimLeft(sym);
   StringTrimRight(sym);
   if(sym == "")
      return;

   // Tente la sélection dans le Market Watch, mais ne bloque PAS si le symbole existe sur le serveur
   ResetLastError();
   bool selOk = SymbolSelect(sym, true);
   bool custom = false;
   bool existe = SymbolExist(sym, custom);

   // Si le symbole n'existe vraiment pas du tout chez ce courtier
   if(!selOk && !existe && SymbolInfoDouble(sym, SYMBOL_BID) <= 0)
   {
      return;
   }

   g_nbSymbolesRetenus++;

   for(int t = 0; t < nbTF; t++)
   {
      int idx = g_nbSlotsTotal;
      g_nbSlotsTotal++;
      ArrayResize(g_slots, g_nbSlotsTotal, 256);

      ZeroMemory(g_slots[idx]);
      g_slots[idx].symbole                     = sym;
      g_slots[idx].periode                     = listeTF[t];
      g_slots[idx].nomPeriode                  = ObtenirNomCourtTimeframe(listeTF[t]);
      g_slots[idx].derniereBarreScannee        = 0;
      g_slots[idx].prochainEssaiTelechargement = 0;
      g_slots[idx].dernierTempsAlerte          = 0;
      g_slots[idx].estInitialise               = false;
      g_slots[idx].aSetupValide                = false;
   }
}

/**
 * Construit la file d'attente complète de tous les couples (Symbole FTMO x Timeframe) à surveiller.
 */
void InitialiserFileAttenteScanner()
{
   ArrayFree(g_slots);
   g_nbSlotsTotal      = 0;
   g_nbSymbolesRetenus = 0;
   g_indexSlotCourant  = 0;
   g_pageTableau       = 0;

   ENUM_TIMEFRAMES listeTF[4];
   int nbTF = 0;
   if(InpScannerM30) { listeTF[nbTF] = PERIOD_M30; nbTF++; }
   if(InpScannerH1)  { listeTF[nbTF] = PERIOD_H1;  nbTF++; }
   if(InpScannerH4)  { listeTF[nbTF] = PERIOD_H4;  nbTF++; }
   if(InpScannerD1)  { listeTF[nbTF] = PERIOD_D1;  nbTF++; }

   if(nbTF == 0)
   {
      Print("⚠️ [Scanner SMC FTMO] Aucun Timeframe sélectionné ! Activation de H1 par défaut.");
      listeTF[0] = PERIOD_H1;
      nbTF = 1;
   }

   if(InpModeSelectionSymboles == MODE_SYMBOLES_LISTE_MANUELLE)
   {
      string pairesBrutes[];
      int nbPaires = StringSplit(InpListePairesManuelles, ',', pairesBrutes);
      for(int p = 0; p < nbPaires; p++)
         AjouterSymboleDansFileScanner(pairesBrutes[p], listeTF, nbTF);
   }
   else
   {
      bool uniquementMarketWatch = (InpModeSelectionSymboles == MODE_SYMBOLES_MARKET_WATCH);
      int totalServeur = SymbolsTotal(uniquementMarketWatch);

      for(int i = 0; i < totalServeur; i++)
      {
         string sym = SymbolName(i, uniquementMarketWatch);
         if(sym == "")
            continue;

         if(SymboleEstAutoriseParFiltresFTMO(sym))
            AjouterSymboleDansFileScanner(sym, listeTF, nbTF);
      }
   }

   // 🛡️ Filet de sécurité absolu : Si aucun symbole n'a pu être retenu, activer automatiquement les paires majeures
   if(g_nbSymbolesRetenus == 0)
   {
      Print("⚠️ [Scanner SMC FTMO] Aucun symbole automatique retenu. Activation de la liste des paires majeures...");
      string pairesSecours[] = {
         "EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD", "USDCHF", "NZDUSD",
         "EURGBP", "EURJPY", "GBPJPY", "EURCAD", "EURAUD", "GBPAUD", "XAUUSD",
         "US100", "US100.cash", "USTEC", "NAS100", "US30", "US30.cash", "DJ30",
         "GER40", "GER40.cash", "DE40", "DAX", "SP500", "US500", "USOIL", "BTCUSD"
      };
      for(int s = 0; s < ArraySize(pairesSecours); s++)
      {
         AjouterSymboleDansFileScanner(pairesSecours[s], listeTF, nbTF);
      }
   }

   PrintFormat(
      "✅ [Scanner FTMO SMC] %d symboles retenus (%d slots Paire x Timeframe), cadencés à %d ms avec Saut Instantané des bougies non clôturées !",
      g_nbSymbolesRetenus,
      g_nbSlotsTotal,
      MathMax(50, InpCadenceFileAttenteMs)
   );
}

/**
 * 🔔 Envoie une alerte MT5 / Push Mobile / Capture HD Telegram spécifique au Scanner.
 * Exporte immédiatement la fiche texte et les données de chandeliers TradingView
 * sans JAMAIS changer le graphique de MT5 (évite le redémarrage et la perte d'état).
 */
void DeclencherAlerteScannerMT5(int indexSlot, const BougieSMC &bougies[], int totalBougies)
{
   if(indexSlot < 0 || indexSlot >= g_nbSlotsTotal)
      return;

   if(g_slots[indexSlot].setup.tempsConfirmation <= g_slots[indexSlot].dernierTempsAlerte)
      return;

   g_slots[indexSlot].dernierTempsAlerte = g_slots[indexSlot].setup.tempsConfirmation;

   int digitsSym       = (int)SymbolInfoInteger(g_slots[indexSlot].symbole, SYMBOL_DIGITS);
   string directionTxt = (g_slots[indexSlot].setup.type == DIRECTION_ACHAT) ? "🟢 ACHAT (Spring)" : "🔴 VENTE (UTAD)";
   int nbCollines      = g_slots[indexSlot].setup.aMeilleureZone ? g_slots[indexSlot].setup.meilleureZone.nbCollines : 0;
   int nbTouchesIgn    = g_slots[indexSlot].setup.aMeilleureZone ? g_slots[indexSlot].setup.meilleureZone.nbTouchesIgnorees : 0;

   string msg = StringFormat(
      "🚨 [SCANNER SMC - 3 BOUGIES OK] %s sur %s (%s) ! Entrée: %s | SL: %s | TP%d: %s (%.2fR) | S/R: %d/100 (%d⛰️) | Liq: %d/100 (ZZ:%d)",
      directionTxt,
      g_slots[indexSlot].symbole,
      g_slots[indexSlot].nomPeriode,
      DoubleToString(g_slots[indexSlot].setup.prixEntree, digitsSym),
      DoubleToString(g_slots[indexSlot].setup.prixSL, digitsSym),
      g_slots[indexSlot].setup.ordreTP,
      DoubleToString(g_slots[indexSlot].setup.prixTP, digitsSym),
      g_slots[indexSlot].setup.ratioRR,
      g_slots[indexSlot].setup.scoreShved,
      nbCollines,
      g_slots[indexSlot].setup.scoreZigZag.scoreTotal,
      g_slots[indexSlot].setup.scoreZigZag.zigzagDepthRetenu
   );

   Print("✅ ", msg);

   if(InpActiverAlertePopup)
      Alert(msg);
   else if(InpActiverSonSeul && InpFichierSon != "")
      PlaySound(InpFichierSon);

   if(InpActiverNotificationPush)
      SendNotification(msg);

   if(InpActiverAlerteEmail)
      SendMail("[Scanner SMC MT5] Setup Confirmé " + g_slots[indexSlot].symbole + " " + g_slots[indexSlot].nomPeriode, msg);

   // 📸 Exportation Telegram instantanée (Légende complète + Données chandeliers TradingView)
   if(InpActiverCaptureTelegram)
   {
      FolderCreate("AlertesTelegram");
      string symPropre = g_slots[indexSlot].symbole;
      StringReplace(symPropre, ".", "_");
      StringReplace(symPropre, "/", "_");
      string horodatageId = IntegerToString((long)TimeLocal()) + "_" + IntegerToString((int)(GetTickCount() % 10000));
      string baseNom      = "AlertesTelegram\\SMC_" + symPropre + "_" + g_slots[indexSlot].nomPeriode + "_" + horodatageId;
      string fichierTxt   = baseNom + ".txt";
      string fichierJson  = baseNom + ".json";
      string fichierPng   = baseNom + ".png";

      // 1️⃣ Écriture de la fiche texte détaillée
      int hTxt = FileOpen(fichierTxt, FILE_WRITE | FILE_TXT | FILE_ANSI, 0, CP_UTF8);
      if(hTxt != INVALID_HANDLE)
      {
         string legende = StringFormat(
            "🚨 SETUP SMC CONFIRMÉ (3/3 BOUGIES)\n"
            "━━━━━━━━━━━━━━━━━━━━\n"
            "📊 Actif : %s (%s)\n"
            "🧭 Sens : %s\n"
            "🎯 Entrée : %s\n"
            "🛑 Stop Loss : %s\n"
            "💰 Take Profit (TP%d) : %s (Ratio %.2fR)\n"
            "━━━━━━━━━━━━━━━━━━━━\n"
            "🛡️ Score S/R Shved : %d/100 (%d vraies collines ⛰️ | %d micro-touches ignorées)\n"
            "🌊 Score Liquidité : %d/100 (ZigZag dynamique : %d)\n"
            "⚡ Carburant Initial / Restant : %d pts / %d pts\n"
            "🕒 Heure Confirmation : %s",
            g_slots[indexSlot].symbole,
            g_slots[indexSlot].nomPeriode,
            directionTxt,
            DoubleToString(g_slots[indexSlot].setup.prixEntree, digitsSym),
            DoubleToString(g_slots[indexSlot].setup.prixSL, digitsSym),
            g_slots[indexSlot].setup.ordreTP,
            DoubleToString(g_slots[indexSlot].setup.prixTP, digitsSym),
            g_slots[indexSlot].setup.ratioRR,
            g_slots[indexSlot].setup.scoreShved,
            nbCollines,
            nbTouchesIgn,
            g_slots[indexSlot].setup.scoreZigZag.scoreTotal,
            g_slots[indexSlot].setup.scoreZigZag.zigzagDepthRetenu,
            g_slots[indexSlot].setup.carburantInitial,
            g_slots[indexSlot].setup.carburantRestant,
            TimeToString(g_slots[indexSlot].setup.tempsConfirmation, TIME_DATE | TIME_MINUTES)
         );
         FileWriteString(hTxt, legende);
         FileClose(hTxt);
      }

      // 2️⃣ Écriture des données JSON pour tracé pur TradingView par le relais Python
      int hJson = FileOpen(fichierJson, FILE_WRITE | FILE_TXT | FILE_ANSI, 0, CP_UTF8);
      if(hJson != INVALID_HANDLE)
      {
         string dirSimple = (g_slots[indexSlot].setup.type == DIRECTION_ACHAT) ? "ACHAT" : "VENTE";
         FileWriteString(hJson, "{\n");
         FileWriteString(hJson, StringFormat("  \"symbole\": \"%s\",\n", g_slots[indexSlot].symbole));
         FileWriteString(hJson, StringFormat("  \"periode\": \"%s\",\n", g_slots[indexSlot].nomPeriode));
         FileWriteString(hJson, StringFormat("  \"direction\": \"%s\",\n", dirSimple));
         FileWriteString(hJson, StringFormat("  \"entree\": %s,\n", DoubleToString(g_slots[indexSlot].setup.prixEntree, digitsSym)));
         FileWriteString(hJson, StringFormat("  \"sl\": %s,\n", DoubleToString(g_slots[indexSlot].setup.prixSL, digitsSym)));
         FileWriteString(hJson, StringFormat("  \"tp\": %s,\n", DoubleToString(g_slots[indexSlot].setup.prixTP, digitsSym)));
         FileWriteString(hJson, "  \"bougies\": [\n");

         int debutB = MathMax(0, totalBougies - 45);
         for(int b = debutB; b < totalBougies; b++)
         {
            string sep = (b < totalBougies - 1) ? "," : "";
            string ligne = StringFormat(
               "    {\"open\": %f, \"high\": %f, \"low\": %f, \"close\": %f}%s\n",
               bougies[b].open, bougies[b].high, bougies[b].low, bougies[b].close, sep
            );
            FileWriteString(hJson, ligne);
         }
         FileWriteString(hJson, "  ]\n");
         FileWriteString(hJson, "}\n");
         FileClose(hJson);
      }

      // 3️⃣ Si le graphique MT5 est déjà sur ce symbole, prendre aussi la capture d'écran MT5
      if(g_slots[indexSlot].symbole == _Symbol && g_slots[indexSlot].periode == _Period)
      {
         ObjectsDeleteAll(0, PREFIXE_SCANNER_SMC);
         SupprimerTousObjetsSMC();
         AppliquerThemeTradingViewMT5(0);
         ChartRedraw(0);
         ChartScreenShot(0, fichierPng, InpLargeurCapturePx, InpHauteurCapturePx, ALIGN_RIGHT);
         DessinerTableauScannerMultiPaires();
         TracerSetupDuGraphiqueOuvert();
         ChartRedraw(0);
      }
   }
}

/**
 * ⚡ Vérifie en 0.001 ms si un slot a une nouvelle bougie à analyser ou s'il doit être initialisé.
 * Permet au Timer de sauter instantanément tous les slots dont la bougie n'a pas bougé !
 */
bool SlotBesoinAnalyseMaintenant(int indexSlot)
{
   if(indexSlot < 0 || indexSlot >= g_nbSlotsTotal)
      return false;

   datetime maintenant = TimeCurrent();
   if(g_slots[indexSlot].prochainEssaiTelechargement > maintenant)
      return false;

   if(!g_slots[indexSlot].estInitialise)
      return true;

   datetime tempsBarre1[1];
   if(CopyTime(g_slots[indexSlot].symbole, g_slots[indexSlot].periode, 0, 1, tempsBarre1) <= 0)
      return false;

   return (tempsBarre1[0] != g_slots[indexSlot].derniereBarreScannee);
}

/**
 * ⚡ Analyse un seul slot (1 Symbole x 1 Timeframe) de la file d'attente en utilisant le Court-Circuit N-3 !
 */
bool AnalyserUnSlotDeLaFile(int indexSlot)
{
   if(indexSlot < 0 || indexSlot >= g_nbSlotsTotal)
      return false;

   string sym             = g_slots[indexSlot].symbole;
   ENUM_TIMEFRAMES tf     = g_slots[indexSlot].periode;
   int nbBougiesConf      = MathMax(1, InpNbBougiesConfirmation);

   // 1️⃣ Vérification de la bougie courante
   datetime tempsBarre1[1];
   if(CopyTime(sym, tf, 0, 1, tempsBarre1) <= 0)
   {
      // Le courtier est en train de télécharger l'historique de ce symbole en arrière-plan : on réessaiera dans 5s
      g_slots[indexSlot].prochainEssaiTelechargement = TimeCurrent() + 5;
      return false;
   }

   bool premiereAnalyseSlot = (!g_slots[indexSlot].estInitialise);
   if(!premiereAnalyseSlot && tempsBarre1[0] == g_slots[indexSlot].derniereBarreScannee)
      return false;

   // 2️⃣ Chargement des bougies du slot
   int nbCharger = MathMax(180, InpNbBougiesParScan);
   MqlRates rates[];
   ArraySetAsSeries(rates, false);
   int totalLocal = CopyRates(sym, tf, 0, nbCharger, rates);
   if(totalLocal < 30)
   {
      // Historique pas encore prêt en cache : on laisse MT5 le télécharger et on réessaiera dans 5s
      g_slots[indexSlot].prochainEssaiTelechargement = TimeCurrent() + 5;
      return false;
   }

   g_slots[indexSlot].derniereBarreScannee        = tempsBarre1[0];
   g_slots[indexSlot].prochainEssaiTelechargement = 0;
   g_slots[indexSlot].estInitialise               = true;

   BougieSMC bougies[];
   ArrayResize(bougies, totalLocal);
   for(int i = 0; i < totalLocal; i++)
   {
      bougies[i].temps  = rates[i].time;
      bougies[i].open   = rates[i].open;
      bougies[i].high   = rates[i].high;
      bougies[i].low    = rates[i].low;
      bougies[i].close  = rates[i].close;
      bougies[i].volume = rates[i].tick_volume;
   }

   double pointSym = SymbolInfoDouble(sym, SYMBOL_POINT);
   if(pointSym <= 0.0)
      pointSym = 0.00001;
   int digitsSym = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);

   // 3️⃣ COURT-CIRCUIT N-3 :
   // Lors d'une mise à jour en temps réel (!premiereAnalyseSlot), on regarde uniquement les
   // toutes dernières bougies (autour de totalLocal - 2 - nbBougiesConf).
   // Lors du tout premier passage (premiereAnalyseSlot), on regarde les 25 dernières bougies
   // pour trouver un éventuel setup déjà actif sur cette paire.
   int fenetreRecul  = premiereAnalyseSlot ? 25 : (nbBougiesConf + 2);
   int idxDebutVerif = MathMax(15, totalLocal - 2 - fenetreRecul);
   int idxFinVerif   = totalLocal - 2;

   bool aTrouveSetup = false;
   SetupOrchestreSMC_MT5 meilleurSetupTrouve;
   ZeroMemory(meilleurSetupTrouve);

   for(int idxCandidat = idxFinVerif; idxCandidat >= idxDebutVerif; idxCandidat--)
   {
      SignalDojiPlageSMC dojiCandidat;
      bool estDoji = ExtraireDojiSurIndexPrecisSMC(
         bougies, totalLocal, idxCandidat,
         InpActiverAchat, InpActiverVente, InpActiverFiltreTaille,
         InpPeriodeHistorique, InpMultiplicateurBougie1, InpMultiplicateurCorps2,
         InpToleranceDeficit, InpToleranceDepassement, InpMaxReculRecherche,
         dojiCandidat
      );

      if(!estDoji)
         continue;

      SetupOrchestreSMC_MT5 setupEval;
      bool setupValide = EvaluerDojiCompletUniqueSMC(
         dojiCandidat, bougies, totalLocal,
         InpPeriodeATRShved, InpZoneFuzzFactor, InpScoreMinimumShved, InpExigerDebutEtFinDansPlage,
         InpActiverZigZagDynamique, InpZigZagDepthMin, InpZigZagDepthMax, InpZigZagDepthSecours,
         InpNbVaguesSuperposees, InpTypeChevauchementUOP, InpPoidsCorpsUOP, InpPoidsMecheUOP,
         InpExigerAutorouteUOP, InpMinTauxAutoroute, InpActiverFiltrePlageTP, InpMaxReculPlageTP,
         nbBougiesConf, InpModeCalculTP, InpPalierTPVise,
         InpPointsParRetest, InpPlafondCarburantRetests, InpBonusMecheProfonde, InpBonusMecheNormale,
         InpPeagePalierUOP, InpCoutParATR,
         InpCoutFrictionFortOverlap, InpCoutFrictionMoyenOverlap, InpCoutFrictionFaibleOverlap,
         InpSeuilFortOverlap, InpSeuilFaibleOverlap, InpMargeSecuriteDevantPalier,
         InpSeuilScoreGrandMouvement, pointSym, digitsSym,
         setupEval
      );

      if(setupValide && !setupEval.estTermine)
      {
         aTrouveSetup        = true;
         meilleurSetupTrouve = setupEval;
         break; // On garde le setup actif ou en attente le plus récent de ce slot
      }
   }

   g_slots[indexSlot].aSetupValide = aTrouveSetup;
   if(aTrouveSetup)
   {
      g_slots[indexSlot].setup = meilleurSetupTrouve;

      // 🔔 Si ce setup vient tout juste de valider sa 3ème bougie de confirmation sur la dernière barre clôturée : ALERTE !
      if(meilleurSetupTrouve.statut == SETUP_CONFIRME && meilleurSetupTrouve.indexConfirmation == totalLocal - 2)
      {
         if(premiereAnalyseSlot)
         {
            // Au tout premier démarrage du scanner, on mémorise pour éviter d'alerter d'anciens signaux
            g_slots[indexSlot].dernierTempsAlerte = meilleurSetupTrouve.tempsConfirmation;
         }
         else
         {
            DeclencherAlerteScannerMT5(indexSlot, bougies, totalLocal);
         }
      }
   }

   return true;
}

/**
 * 🖥️ Dessine le Tableau de Bord Interactif du Scanner FTMO Multi-Paires sur le graphique.
 * Inclut la barre de progression d'initialisation et la pagination `[◀ Préc.]` / `[Suiv. ▶]` !
 */
void DessinerTableauScannerMultiPaires()
{
   ObjectsDeleteAll(0, PREFIXE_SCANNER_SMC);

   int indicesActifs[];
   int nbConfirmesActifs = 0;
   int nbEnAttente       = 0;
   int nbInitialises     = 0;

   for(int i = 0; i < g_nbSlotsTotal; i++)
   {
      if(g_slots[i].estInitialise)
         nbInitialises++;
   }

   // 1. D'abord les setups 100% CONFIRMÉS et actifs
   for(int i = 0; i < g_nbSlotsTotal; i++)
   {
      if(g_slots[i].aSetupValide && g_slots[i].setup.statut == SETUP_CONFIRME && !g_slots[i].setup.estTermine)
      {
         int n = ArraySize(indicesActifs);
         ArrayResize(indicesActifs, n + 1);
         indicesActifs[n] = i;
         nbConfirmesActifs++;
      }
   }

   // 2. Ensuite les setups EN ATTENTE des 3 bougies de confirmation
   for(int i = 0; i < g_nbSlotsTotal; i++)
   {
      if(g_slots[i].aSetupValide && g_slots[i].setup.statut == SETUP_EN_COURS)
      {
         int n = ArraySize(indicesActifs);
         ArrayResize(indicesActifs, n + 1);
         indicesActifs[n] = i;
         nbEnAttente++;
      }
   }

   int totalActifs = ArraySize(indicesActifs);
   int nbPages     = MathMax(1, (totalActifs + MAX_LIGNES_TABLEAU - 1) / MAX_LIGNES_TABLEAU);
   if(g_pageTableau >= nbPages) g_pageTableau = nbPages - 1;
   if(g_pageTableau < 0)        g_pageTableau = 0;

   int idxDebutPage      = g_pageTableau * MAX_LIGNES_TABLEAU;
   int nbLignesAffichees = MathMax(0, MathMin(MAX_LIGNES_TABLEAU, totalActifs - idxDebutPage));
   int hauteurPanneau    = 68 + MathMax(1, nbLignesAffichees) * 22;

   string nomFond = PREFIXE_SCANNER_SMC + "BG";
   ObjectCreate(0, nomFond, OBJ_RECTANGLE_LABEL, 0, 0, 0);
   ObjectSetInteger(0, nomFond, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(0, nomFond, OBJPROP_XDISTANCE, 12);
   ObjectSetInteger(0, nomFond, OBJPROP_YDISTANCE, 24);
   ObjectSetInteger(0, nomFond, OBJPROP_XSIZE, 660);
   ObjectSetInteger(0, nomFond, OBJPROP_YSIZE, hauteurPanneau);
   ObjectSetInteger(0, nomFond, OBJPROP_BGCOLOR, C'15,23,42');
   ObjectSetInteger(0, nomFond, OBJPROP_BORDER_TYPE, BORDER_FLAT);
   ObjectSetInteger(0, nomFond, OBJPROP_COLOR, C'56,189,248');
   ObjectSetInteger(0, nomFond, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, nomFond, OBJPROP_HIDDEN, true);

   // En-tête du Scanner avec suivi d'initialisation FTMO
   string etatScanTxt = (nbInitialises < g_nbSlotsTotal)
      ? StringFormat("⏳ Scan initial: %d/%d (%d%%)", nbInitialises, g_nbSlotsTotal, (g_nbSlotsTotal > 0 ? (nbInitialises * 100) / g_nbSlotsTotal : 100))
      : StringFormat("✅ %d Symboles (%d Slots)", g_nbSymbolesRetenus, g_nbSlotsTotal);

   string nomTitre = PREFIXE_SCANNER_SMC + "TITRE";
   ObjectCreate(0, nomTitre, OBJ_LABEL, 0, 0, 0);
   ObjectSetInteger(0, nomTitre, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(0, nomTitre, OBJPROP_XDISTANCE, 22);
   ObjectSetInteger(0, nomTitre, OBJPROP_YDISTANCE, 30);
   ObjectSetString(0, nomTitre, OBJPROP_FONT, "Segoe UI Semibold");
   ObjectSetInteger(0, nomTitre, OBJPROP_FONTSIZE, 9);
   ObjectSetInteger(0, nomTitre, OBJPROP_COLOR, C'56,189,248');
   ObjectSetString(0, nomTitre, OBJPROP_TEXT, StringFormat(
      "📡 SCANNER FTMO SMC | %s | 🔥 Confirmés: %d | ⏳ Attente (3b): %d",
      etatScanTxt, nbConfirmesActifs, nbEnAttente
   ));

   // Boutons de pagination si plus de 14 setups sont actifs en même temps
   if(nbPages > 1)
   {
      string nomBtnPrev = PREFIXE_SCANNER_SMC + "PAGE_PREV";
      ObjectCreate(0, nomBtnPrev, OBJ_BUTTON, 0, 0, 0);
      ObjectSetInteger(0, nomBtnPrev, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(0, nomBtnPrev, OBJPROP_XDISTANCE, 535);
      ObjectSetInteger(0, nomBtnPrev, OBJPROP_YDISTANCE, 28);
      ObjectSetInteger(0, nomBtnPrev, OBJPROP_XSIZE, 38);
      ObjectSetInteger(0, nomBtnPrev, OBJPROP_YSIZE, 18);
      ObjectSetString(0, nomBtnPrev, OBJPROP_FONT, "Segoe UI Semibold");
      ObjectSetInteger(0, nomBtnPrev, OBJPROP_FONTSIZE, 8);
      ObjectSetString(0, nomBtnPrev, OBJPROP_TEXT, "◀");
      ObjectSetInteger(0, nomBtnPrev, OBJPROP_COLOR, clrWhite);
      ObjectSetInteger(0, nomBtnPrev, OBJPROP_BGCOLOR, C'30,41,59');

      string nomLblPage = PREFIXE_SCANNER_SMC + "PAGE_LBL";
      ObjectCreate(0, nomLblPage, OBJ_LABEL, 0, 0, 0);
      ObjectSetInteger(0, nomLblPage, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(0, nomLblPage, OBJPROP_XDISTANCE, 578);
      ObjectSetInteger(0, nomLblPage, OBJPROP_YDISTANCE, 30);
      ObjectSetString(0, nomLblPage, OBJPROP_FONT, "Segoe UI Semibold");
      ObjectSetInteger(0, nomLblPage, OBJPROP_FONTSIZE, 8);
      ObjectSetInteger(0, nomLblPage, OBJPROP_COLOR, clrGold);
      ObjectSetString(0, nomLblPage, OBJPROP_TEXT, StringFormat("%d/%d", g_pageTableau + 1, nbPages));

      string nomBtnNext = PREFIXE_SCANNER_SMC + "PAGE_NEXT";
      ObjectCreate(0, nomBtnNext, OBJ_BUTTON, 0, 0, 0);
      ObjectSetInteger(0, nomBtnNext, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(0, nomBtnNext, OBJPROP_XDISTANCE, 620);
      ObjectSetInteger(0, nomBtnNext, OBJPROP_YDISTANCE, 28);
      ObjectSetInteger(0, nomBtnNext, OBJPROP_XSIZE, 38);
      ObjectSetInteger(0, nomBtnNext, OBJPROP_YSIZE, 18);
      ObjectSetString(0, nomBtnNext, OBJPROP_FONT, "Segoe UI Semibold");
      ObjectSetInteger(0, nomBtnNext, OBJPROP_FONTSIZE, 8);
      ObjectSetString(0, nomBtnNext, OBJPROP_TEXT, "▶");
      ObjectSetInteger(0, nomBtnNext, OBJPROP_COLOR, clrWhite);
      ObjectSetInteger(0, nomBtnNext, OBJPROP_BGCOLOR, C'30,41,59');
   }

   // Bouton [📸 Test Telegram] pour envoyer instantanément une capture du graphique ouvert sur Telegram
   string nomBtnTestTg = PREFIXE_SCANNER_SMC + "BTN_TEST_TG";
   ObjectCreate(0, nomBtnTestTg, OBJ_BUTTON, 0, 0, 0);
   ObjectSetInteger(0, nomBtnTestTg, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(0, nomBtnTestTg, OBJPROP_XDISTANCE, 540);
   ObjectSetInteger(0, nomBtnTestTg, OBJPROP_YDISTANCE, 48);
   ObjectSetInteger(0, nomBtnTestTg, OBJPROP_XSIZE, 120);
   ObjectSetInteger(0, nomBtnTestTg, OBJPROP_YSIZE, 18);
   ObjectSetString(0, nomBtnTestTg, OBJPROP_FONT, "Segoe UI Semibold");
   ObjectSetInteger(0, nomBtnTestTg, OBJPROP_FONTSIZE, 8);
   ObjectSetString(0, nomBtnTestTg, OBJPROP_TEXT, "📸 Test Telegram");
   ObjectSetInteger(0, nomBtnTestTg, OBJPROP_COLOR, clrWhite);
   ObjectSetInteger(0, nomBtnTestTg, OBJPROP_BGCOLOR, C'2,132,199');
   ObjectSetInteger(0, nomBtnTestTg, OBJPROP_BORDER_COLOR, clrAqua);

   string nomSousTitre = PREFIXE_SCANNER_SMC + "SOUSTITRE";
   ObjectCreate(0, nomSousTitre, OBJ_LABEL, 0, 0, 0);
   ObjectSetInteger(0, nomSousTitre, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(0, nomSousTitre, OBJPROP_XDISTANCE, 22);
   ObjectSetInteger(0, nomSousTitre, OBJPROP_YDISTANCE, 50);
   ObjectSetString(0, nomSousTitre, OBJPROP_FONT, "Segoe UI");
   ObjectSetInteger(0, nomSousTitre, OBJPROP_FONTSIZE, 8);
   ObjectSetInteger(0, nomSousTitre, OBJPROP_COLOR, C'148,163,184');
   ObjectSetString(0, nomSousTitre, OBJPROP_TEXT, "💡 Cliquez sur [🔍 SYMBOLE TF] pour basculer le graphique dessus et afficher son setup complet :");

   if(nbLignesAffichees == 0)
   {
      string nomVide = PREFIXE_SCANNER_SMC + "VIDE";
      ObjectCreate(0, nomVide, OBJ_LABEL, 0, 0, 0);
      ObjectSetInteger(0, nomVide, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(0, nomVide, OBJPROP_XDISTANCE, 22);
      ObjectSetInteger(0, nomVide, OBJPROP_YDISTANCE, 72);
      ObjectSetString(0, nomVide, OBJPROP_FONT, "Segoe UI Semibold");
      ObjectSetInteger(0, nomVide, OBJPROP_FONTSIZE, 8);
      ObjectSetInteger(0, nomVide, OBJPROP_COLOR, clrGold);
      ObjectSetString(0, nomVide, OBJPROP_TEXT, "👀 Aucun setup actif pour l'instant sur les symboles FTMO surveillés. Veille VPS en cours...");
      return;
   }

   for(int r = 0; r < nbLignesAffichees; r++)
   {
      int idxSlot             = indicesActifs[idxDebutPage + r];
      SlotSurveillanceSMC sl  = g_slots[idxSlot];
      bool estConfirme        = (sl.setup.statut == SETUP_CONFIRME);
      bool estAchat           = (sl.setup.type == DIRECTION_ACHAT);
      int digitsSym           = (int)SymbolInfoInteger(sl.symbole, SYMBOL_DIGITS);
      int yLigne              = 70 + r * 22;

      // Bouton cliquable [🔍 SYMBOLE TF]
      string nomBtn = PREFIXE_SCANNER_SMC + "BTN_" + IntegerToString(idxSlot);
      ObjectCreate(0, nomBtn, OBJ_BUTTON, 0, 0, 0);
      ObjectSetInteger(0, nomBtn, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(0, nomBtn, OBJPROP_XDISTANCE, 22);
      ObjectSetInteger(0, nomBtn, OBJPROP_YDISTANCE, yLigne - 2);
      ObjectSetInteger(0, nomBtn, OBJPROP_XSIZE, 122);
      ObjectSetInteger(0, nomBtn, OBJPROP_YSIZE, 18);
      ObjectSetString(0, nomBtn, OBJPROP_FONT, "Segoe UI Semibold");
      ObjectSetInteger(0, nomBtn, OBJPROP_FONTSIZE, 8);
      ObjectSetString(0, nomBtn, OBJPROP_TEXT, "🔍 " + sl.symbole + " " + sl.nomPeriode);
      ObjectSetInteger(0, nomBtn, OBJPROP_COLOR, clrWhite);
      ObjectSetInteger(0, nomBtn, OBJPROP_BGCOLOR, (sl.symbole == _Symbol && sl.periode == _Period) ? C'2,132,199' : C'30,41,59');
      ObjectSetInteger(0, nomBtn, OBJPROP_BORDER_COLOR, estConfirme ? clrSpringGreen : clrGold);

      // Texte détaillé de la ligne
      string statutTxt = estConfirme
         ? "✅ CONFIRMÉ (3/3b)"
         : StringFormat("⏳ ATTENTE (%d/%db)", sl.setup.bougiesObservees, MathMax(1, InpNbBougiesConfirmation));

      string detailLigne = StringFormat(
         "%s | %s | Entrée: %s | SL: %s | TP%d: %s (%.2fR) | S/R: %dpts (%d⛰️) | ZZ:%d",
         statutTxt,
         estAchat ? "ACHAT" : "VENTE",
         DoubleToString(sl.setup.prixEntree, digitsSym),
         DoubleToString(sl.setup.prixSL, digitsSym),
         sl.setup.ordreTP,
         DoubleToString(sl.setup.prixTP, digitsSym),
         sl.setup.ratioRR,
         sl.setup.scoreShved,
         sl.setup.aMeilleureZone ? sl.setup.meilleureZone.nbCollines : 0,
         sl.setup.scoreZigZag.zigzagDepthRetenu
      );

      string nomTxt = PREFIXE_SCANNER_SMC + "ROW_" + IntegerToString(idxSlot);
      ObjectCreate(0, nomTxt, OBJ_LABEL, 0, 0, 0);
      ObjectSetInteger(0, nomTxt, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(0, nomTxt, OBJPROP_XDISTANCE, 152);
      ObjectSetInteger(0, nomTxt, OBJPROP_YDISTANCE, yLigne);
      ObjectSetString(0, nomTxt, OBJPROP_FONT, "Segoe UI Semibold");
      ObjectSetInteger(0, nomTxt, OBJPROP_FONTSIZE, 8);
      ObjectSetInteger(0, nomTxt, OBJPROP_COLOR, estConfirme ? (estAchat ? clrSpringGreen : clrTomato) : clrGold);
      ObjectSetString(0, nomTxt, OBJPROP_TEXT, detailLigne);
   }
}

/**
 * 🎨 Trace automatiquement sur le graphique courant le setup actif de la paire ouverte à l'écran.
 */
void TracerSetupDuGraphiqueOuvert()
{
   SupprimerTousObjetsSMC();
   if(!InpTracerSetupPaireCourante)
      return;

   for(int i = 0; i < g_nbSlotsTotal; i++)
   {
      if(g_slots[i].symbole == _Symbol && g_slots[i].periode == _Period && g_slots[i].aSetupValide)
      {
         MqlRates rates[];
         ArraySetAsSeries(rates, false);
         int nbCharger  = MathMax(180, InpNbBougiesParScan);
         int totalLocal = CopyRates(_Symbol, _Period, 0, nbCharger, rates);
         if(totalLocal < 30)
            break;

         BougieSMC bougies[];
         ArrayResize(bougies, totalLocal);
         for(int k = 0; k < totalLocal; k++)
         {
            bougies[k].temps  = rates[k].time;
            bougies[k].open   = rates[k].open;
            bougies[k].high   = rates[k].high;
            bougies[k].low    = rates[k].low;
            bougies[k].close  = rates[k].close;
            bougies[k].volume = rates[k].tick_volume;
         }

         DessinerSetupOrchestreMT5(
            g_slots[i].setup,
            bougies,
            totalLocal,
            4,
            true, true, true, true, true, true,
            InpAfficherDiagnosticCollines,
            clrSpringGreen,
            clrCrimson
         );
         break;
      }
   }
}

//+------------------------------------------------------------------+
//| Initialisation du Scanner Multi-Paires FTMO VPS                  |
//+------------------------------------------------------------------+
int OnInit()
{
   if(InpAppliquerStyleTradingView)
      AppliquerThemeTradingViewMT5(0);

   // 🚀 L'initialisation lourde (découverte des 12000+ symboles) est différée dans OnTimer
   // Cela garantit qu'OnInit() réponde en < 1 ms et ne soit JAMAIS supprimé par MT5 !
   g_fileInitialisee = false;
   DessinerTableauScannerMultiPaires();
   ChartRedraw(0);
   EventSetMillisecondTimer(MathMax(50, InpCadenceFileAttenteMs));
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Nettoyage complet à la fermeture du Scanner                      |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   g_fileInitialisee = false;
   ObjectsDeleteAll(0, PREFIXE_SCANNER_SMC);
   SupprimerTousObjetsSMC();
   ChartRedraw(0);
}

//+------------------------------------------------------------------+
//| File d'attente intelligente avec Saut Instantané :               |
//| Saute les slots dont la bougie n'a pas clôturé (0.001 ms) et     |
//| analyse 1 slot ayant réellement une nouvelle bougie par tick !   |
//+------------------------------------------------------------------+
void OnTimer()
{
   // 1️⃣ Initialisation différée au tout premier tick du Timer (évite le timeout d'OnInit)
   if(!g_fileInitialisee)
   {
      InitialiserFileAttenteScanner();
      g_fileInitialisee = true;
      DessinerTableauScannerMultiPaires();
      ChartRedraw(0);
      return;
   }

   if(g_nbSlotsTotal <= 0)
      return;

   // 📸 Si une capture d'écran HD Telegram est en attente après bascule automatique du graphique
   if(g_slotCaptureTelegramEnAttente >= 0 && g_slotCaptureTelegramEnAttente < g_nbSlotsTotal)
   {
      if(g_ticksAttenteCaptureTelegram > 0)
         g_ticksAttenteCaptureTelegram--;

      if(g_ticksAttenteCaptureTelegram <= 0)
      {
         int idxCap = g_slotCaptureTelegramEnAttente;
         g_slotCaptureTelegramEnAttente = -1;

         // Masquer temporairement le tableau pour capturer uniquement les bougies pures style TradingView
         ObjectsDeleteAll(0, PREFIXE_SCANNER_SMC);
         SupprimerTousObjetsSMC();
         ExporterCaptureEtLegendeTelegramSMC(
            g_slots[idxCap].symbole,
            g_slots[idxCap].nomPeriode,
            g_slots[idxCap].setup,
            InpLargeurCapturePx,
            InpHauteurCapturePx
         );
         DessinerTableauScannerMultiPaires();
         TracerSetupDuGraphiqueOuvert();
         ChartRedraw(0);
         return;
      }
   }

   bool aMisAJour   = false;
   int  slotAnalyse = -1;

   // On cherche le prochain slot ayant besoin d'une analyse réelle (nouvelle bougie ou non initialisé)
   for(int essais = 0; essais < g_nbSlotsTotal; essais++)
   {
      int idx = g_indexSlotCourant;
      g_indexSlotCourant++;
      if(g_indexSlotCourant >= g_nbSlotsTotal)
         g_indexSlotCourant = 0;

      if(SlotBesoinAnalyseMaintenant(idx))
      {
         aMisAJour   = AnalyserUnSlotDeLaFile(idx);
         slotAnalyse = idx;
         break; // 1 seule analyse complète par tick de Timer = 0% surcharge CPU !
      }
   }

   // Rafraîchit le tableau si un slot a été analysé
   if(aMisAJour)
   {
      // Pendant le scan initial de 300+ slots, on rafraîchit l'affichage tous les 10 slots pour garder MT5 ultra-fluide
      bool rafraichirUI = (slotAnalyse % 10 == 0) || (g_slots[slotAnalyse].aSetupValide) || (g_indexSlotCourant == 0);
      if(rafraichirUI)
      {
         DessinerTableauScannerMultiPaires();
         if(g_slots[slotAnalyse].symbole == _Symbol && g_slots[slotAnalyse].periode == _Period)
            TracerSetupDuGraphiqueOuvert();
         ChartRedraw(0);
      }
   }
}

//+------------------------------------------------------------------+
//| Gestion du clic sur un bouton [🔍 SYMBOLE TF] ou Pagination      |
//+------------------------------------------------------------------+
void OnChartEvent(
   const int id,
   const long &lparam,
   const double &dparam,
   const string &sparam
)
{
   if(id != CHARTEVENT_OBJECT_CLICK)
      return;

   // 0. Clic sur le bouton [📸 Test Telegram]
   if(sparam == PREFIXE_SCANNER_SMC + "BTN_TEST_TG")
   {
      ObjectSetInteger(0, sparam, OBJPROP_STATE, false);
      // Masquer temporairement tous les objets pour capturer uniquement les bougies pures style TradingView
      ObjectsDeleteAll(0, PREFIXE_SCANNER_SMC);
      SupprimerTousObjetsSMC();

      bool envoyeSetupCourant = false;
      for(int i = 0; i < g_nbSlotsTotal; i++)
      {
         if(g_slots[i].symbole == _Symbol && g_slots[i].periode == _Period && g_slots[i].aSetupValide)
         {
            ExporterCaptureEtLegendeTelegramSMC(
               g_slots[i].symbole,
               g_slots[i].nomPeriode,
               g_slots[i].setup,
               InpLargeurCapturePx,
               InpHauteurCapturePx
            );
            envoyeSetupCourant = true;
            break;
         }
      }
      if(!envoyeSetupCourant)
         ExporterCaptureTestTelegramSMC(g_nbSymbolesRetenus, g_nbSlotsTotal, InpLargeurCapturePx, InpHauteurCapturePx);

      DessinerTableauScannerMultiPaires();
      TracerSetupDuGraphiqueOuvert();
      ChartRedraw(0);
      return;
   }

   // 1. Clic sur Pagination Précédent / Suivant
   if(sparam == PREFIXE_SCANNER_SMC + "PAGE_PREV")
   {
      ObjectSetInteger(0, sparam, OBJPROP_STATE, false);
      if(g_pageTableau > 0)
      {
         g_pageTableau--;
         DessinerTableauScannerMultiPaires();
         ChartRedraw(0);
      }
      return;
   }
   if(sparam == PREFIXE_SCANNER_SMC + "PAGE_NEXT")
   {
      ObjectSetInteger(0, sparam, OBJPROP_STATE, false);
      g_pageTableau++;
      DessinerTableauScannerMultiPaires();
      ChartRedraw(0);
      return;
   }

   // 2. Clic sur un bouton [🔍 SYMBOLE TF]
   string prefixeBtn = PREFIXE_SCANNER_SMC + "BTN_";
   if(StringFind(sparam, prefixeBtn) == 0)
   {
      string numStr = StringSubstr(sparam, StringLen(prefixeBtn));
      int idxSlot   = (int)StringToInteger(numStr);

      ObjectSetInteger(0, sparam, OBJPROP_STATE, false);

      if(idxSlot >= 0 && idxSlot < g_nbSlotsTotal)
      {
         string symCible        = g_slots[idxSlot].symbole;
         ENUM_TIMEFRAMES tfCible = g_slots[idxSlot].periode;
         PrintFormat("🔍 [Scanner FTMO SMC] Bascule du graphique vers %s (%s)...", symCible, g_slots[idxSlot].nomPeriode);
         ChartSetSymbolPeriod(0, symCible, tfCible);
      }
   }
}

//+------------------------------------------------------------------+
//| OnCalculate minimal (tout le travail est étalé dans OnTimer)     |
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
   if(rates_total > 0 && time[rates_total - 1] != g_derniereBarreGraphiqueActif)
   {
      g_derniereBarreGraphiqueActif = time[rates_total - 1];
      DessinerTableauScannerMultiPaires();
      TracerSetupDuGraphiqueOuvert();
   }
   return(rates_total);
}
//+------------------------------------------------------------------+
