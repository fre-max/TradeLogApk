//+------------------------------------------------------------------+
//|                                         GardienDemoActif_EA.mq5  |
//|        Robot "Keep-Alive" Anti-Expiration pour Compte Démo MT5   |
//|   Ouvre et referme 1 micro-trade (0.01 lot) tous les X jours     |
//|   pour empêcher le broker de fermer le compte démo inactif.      |
//+------------------------------------------------------------------+
#property copyright "SMC Orchestrateur - Gardien Démo Actif"
#property version   "1.00"
#property strict
#property description "Empêche la fermeture automatique de votre compte Démo MT5 pour inactivité."
#property description "Exécute un micro aller-retour (0.01 lot) tous les X jours uniquement sur compte DÉMO."

//--- Paramètres configurables par l'utilisateur
input group "=== 🛡️ PARAMÈTRES ANTI-INACTIVITÉ DÉMO ==="
input int    InpIntervalleJours          = 5;        // Intervalle entre deux micro-trades (en jours)
input string InpSymboleKeepAlive         = "EURUSD"; // Symbole utilisé pour le micro-trade (vide = graphique actuel)
input bool   InpForcerAuPremierLancement = true;     // Faire 1 micro-trade dès le lancement si historique vide
input bool   InpAfficherStatutGraphique  = true;     // Afficher le bandeau de statut en bas à gauche

//--- Variables globales simples
datetime g_dernierTradeKeepAlive = 0;
bool     g_premierTestEffectue   = false;
string   g_prefixeObjets         = "SMC_GARDIEN_DEMO_";
long     g_magicGardien          = 20260505;

/**
 * 🔧 Détecte automatiquement le mode de remplissage d'ordre supporté par le broker (FOK, IOC ou RETURN).
 * Indispensable car certains brokers (IC Markets, FTMO, Pepperstone) exigent IOC ou FOK.
 *
 * Exemple :
 * ENUM_ORDER_TYPE_FILLING mode = ObtenirModeRemplissageSymbole("EURUSD");
 */
ENUM_ORDER_TYPE_FILLING ObtenirModeRemplissageSymbole(string sym)
{
   uint filling = (uint)SymbolInfoInteger(sym, SYMBOL_FILLING_MODE);
   if((filling & SYMBOL_FILLING_FOK) != 0)
      return ORDER_FILLING_FOK;
   if((filling & SYMBOL_FILLING_IOC) != 0)
      return ORDER_FILLING_IOC;
   return ORDER_FILLING_RETURN;
}

/**
 * 🔍 Recherche la date du dernier trade exécuté sur ce compte Démo dans l'historique MT5.
 * Permet de savoir exactement depuis combien de jours le compte n'a pas eu d'activité.
 *
 * Exemple :
 * datetime dateDernier = ObtenirDateDernierTradeCompte();
 */
datetime ObtenirDateDernierTradeCompte()
{
   datetime maintenant = TimeCurrent();
   // On regarde l'historique des 90 derniers jours
   datetime debutRecherche = maintenant - (90 * 86400);

   if(!HistorySelect(debutRecherche, maintenant))
      return 0;

   int totalDeals = HistoryDealsTotal();
   datetime datePlusRecente = 0;

   for(int i = totalDeals - 1; i >= 0; i--)
   {
      ulong ticketDeal = HistoryDealGetTicket(i);
      if(ticketDeal == 0)
         continue;

      // On vérifie qu'il s'agit bien d'un trade (achat ou vente), pas juste du dépôt initial
      long typeDeal = HistoryDealGetInteger(ticketDeal, DEAL_TYPE);
      if(typeDeal == DEAL_TYPE_BUY || typeDeal == DEAL_TYPE_SELL)
      {
         datetime tempsDeal = (datetime)HistoryDealGetInteger(ticketDeal, DEAL_TIME);
         if(tempsDeal > datePlusRecente)
            datePlusRecente = tempsDeal;
         break;
      }
   }

   return datePlusRecente;
}

/**
 * 🎯 Trouve un symbole valide et ouvert au trading pour exécuter le micro-trade de maintien en vie.
 * Essaie d'abord le symbole demandé (ex: EURUSD), sinon utilise le symbole du graphique actuel.
 *
 * Exemple :
 * string sym = ChoisirSymbolePourKeepAlive(); // -> "EURUSD"
 */
string ChoisirSymbolePourKeepAlive()
{
   string candidat = InpSymboleKeepAlive;
   StringTrimLeft(candidat);
   StringTrimRight(candidat);

   // 1️⃣ Si l'utilisateur a laissé vide, on prend le symbole du graphique
   if(candidat == "")
      return _Symbol;

   // 2️⃣ Vérifier si le symbole exact existe sur ce broker
   if(SymbolSelect(candidat, true))
   {
      double bid = SymbolInfoDouble(candidat, SYMBOL_BID);
      if(bid > 0)
         return candidat;
   }

   // 3️⃣ Sinon, chercher un symbole qui commence par ce nom (ex: EURUSD.cash, EURUSD.raw, EURUSDm)
   int total = SymbolsTotal(false);
   for(int i = 0; i < total; i++)
   {
      string nomServeur = SymbolName(i, false);
      if(StringFind(nomServeur, candidat) == 0)
      {
         if(SymbolSelect(nomServeur, true))
         {
            double bid = SymbolInfoDouble(nomServeur, SYMBOL_BID);
            if(bid > 0)
               return nomServeur;
         }
      }
   }

   // 4️⃣ En dernier recours, utiliser le symbole du graphique courant
   return _Symbol;
}

/**
 * ⚡ Exécute un micro aller-retour immédiat (Ouverture 0.01 lot -> Fermeture immédiate)
 * uniquement pour remettre à zéro le compteur d'inactivité du broker Démo.
 *
 * Exemple :
 * bool succes = ExecuterMicroTradeKeepAlive();
 */
bool ExecuterMicroTradeKeepAlive()
{
   // 1️⃣ SÉCURITÉ ABSOLUE : Ne JAMAIS exécuter sur un compte réel en argent réel !
   ENUM_ACCOUNT_TRADE_MODE modeCompte = (ENUM_ACCOUNT_TRADE_MODE)AccountInfoInteger(ACCOUNT_TRADE_MODE);
   if(modeCompte == ACCOUNT_TRADE_MODE_REAL)
   {
      Print("❌ [GardienDémo] SÉCURITÉ : Ce compte est un compte RÉEL ! Aucun ordre ne sera passé.");
      return false;
   }

   // 2️⃣ Vérifier que le bouton "Algo Trading" est bien activé dans MetaTrader 5
   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED) || !MQLInfoInteger(MQL_TRADE_ALLOWED))
   {
      Print("⚠️ [GardienDémo] Le bouton 'Algo Trading' de MetaTrader 5 est désactivé. Activez-le en haut de MT5.");
      return false;
   }

   // 3️⃣ Sélectionner le symbole et son lot minimum (généralement 0.01)
   string sym = ChoisirSymbolePourKeepAlive();
   double lotMin = SymbolInfoDouble(sym, SYMBOL_VOLUME_MIN);
   if(lotMin <= 0)
      lotMin = 0.01;

   double ask = SymbolInfoDouble(sym, SYMBOL_ASK);
   if(ask <= 0)
      return false;

   Print("🚀 [GardienDémo] Début du micro-trade anti-inactivité sur ", sym, " (Lot: ", DoubleToString(lotMin, 2), ")...");

   // 4️⃣ Préparation de la requête d'ouverture d'ordre Achat (0.01 lot)
   MqlTradeRequest reqOuverture;
   MqlTradeResult  resOuverture;
   ZeroMemory(reqOuverture);
   ZeroMemory(resOuverture);

   reqOuverture.action       = TRADE_ACTION_DEAL;
   reqOuverture.symbol       = sym;
   reqOuverture.volume       = lotMin;
   reqOuverture.type         = ORDER_TYPE_BUY;
   reqOuverture.price        = ask;
   reqOuverture.deviation    = 50;
   reqOuverture.magic        = g_magicGardien;
   reqOuverture.comment      = "KeepAlive_Demo_SMC";
   reqOuverture.type_filling = ObtenirModeRemplissageSymbole(sym);

   if(!OrderSend(reqOuverture, resOuverture))
   {
      Print("❌ [GardienDémo] Échec d'ouverture du micro-trade (Code ", resOuverture.retcode, ") : ", resOuverture.comment);
      return false;
   }

   Print("✅ [GardienDémo] Micro-ordre ouvert avec succès ! Fermeture immédiate dans 1 seconde...");
   Sleep(1000);

   // 5️⃣ Refermer immédiatement la position ouverte par ce robot (MagicNumber 20260505)
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticketPos = PositionGetTicket(i);
      if(ticketPos == 0)
         continue;

      if(PositionGetInteger(POSITION_MAGIC) == g_magicGardien)
      {
         string symPos = PositionGetString(POSITION_SYMBOL);
         double volPos = PositionGetDouble(POSITION_VOLUME);
         double bidPos = SymbolInfoDouble(symPos, SYMBOL_BID);

         MqlTradeRequest reqFermeture;
         MqlTradeResult  resFermeture;
         ZeroMemory(reqFermeture);
         ZeroMemory(resFermeture);

         reqFermeture.action       = TRADE_ACTION_DEAL;
         reqFermeture.position     = ticketPos;
         reqFermeture.symbol       = symPos;
         reqFermeture.volume       = volPos;
         reqFermeture.type         = ORDER_TYPE_SELL;
         reqFermeture.price        = bidPos;
         reqFermeture.deviation    = 50;
         reqFermeture.magic        = g_magicGardien;
         reqFermeture.comment      = "Close_KeepAlive_SMC";
         reqFermeture.type_filling = ObtenirModeRemplissageSymbole(symPos);

         if(OrderSend(reqFermeture, resFermeture))
            Print("✅ [GardienDémo] Micro-position refermée immédiatement ! Compteur d'inactivité du broker remis à zéro.");
         else
            Print("⚠️ [GardienDémo] Erreur lors de la fermeture immédiate (Code ", resFermeture.retcode, ")");
      }
   }

   g_dernierTradeKeepAlive = TimeCurrent();
   return true;
}

/**
 * 🎨 Affiche une petite étiquette discrète en bas à gauche du graphique pour rassurer l'utilisateur.
 */
void MettreAJourAffichageStatut()
{
   if(!InpAfficherStatutGraphique)
      return;

   string nomLabel = g_prefixeObjets + "STATUT";
   if(ObjectFind(0, nomLabel) < 0)
   {
      ObjectCreate(0, nomLabel, OBJ_LABEL, 0, 0, 0);
      ObjectSetInteger(0, nomLabel, OBJPROP_CORNER, CORNER_LEFT_LOWER);
      ObjectSetInteger(0, nomLabel, OBJPROP_XDISTANCE, 12);
      ObjectSetInteger(0, nomLabel, OBJPROP_YDISTANCE, 24);
      ObjectSetString(0, nomLabel, OBJPROP_FONT, "Consolas");
      ObjectSetInteger(0, nomLabel, OBJPROP_FONTSIZE, 9);
   }

   ENUM_ACCOUNT_TRADE_MODE modeCompte = (ENUM_ACCOUNT_TRADE_MODE)AccountInfoInteger(ACCOUNT_TRADE_MODE);
   if(modeCompte == ACCOUNT_TRADE_MODE_REAL)
   {
      ObjectSetString(0, nomLabel, OBJPROP_TEXT, "⚠️ Gardien Démo : Désactivé (Compte RÉEL détecté)");
      ObjectSetInteger(0, nomLabel, OBJPROP_COLOR, clrOrangeRed);
      return;
   }

   bool algoActif = (TerminalInfoInteger(TERMINAL_TRADE_ALLOWED) && MQLInfoInteger(MQL_TRADE_ALLOWED));
   if(!algoActif)
   {
      ObjectSetString(0, nomLabel, OBJPROP_TEXT, "⚠️ Gardien Démo : Cliquez sur 'Algo Trading' en haut de MT5 pour activer");
      ObjectSetInteger(0, nomLabel, OBJPROP_COLOR, clrGold);
      return;
   }

   if(g_dernierTradeKeepAlive == 0)
      g_dernierTradeKeepAlive = ObtenirDateDernierTradeCompte();

   int joursEcoules = 0;
   if(g_dernierTradeKeepAlive > 0)
      joursEcoules = (int)((TimeCurrent() - g_dernierTradeKeepAlive) / 86400);

   int joursRestants = MathMax(0, InpIntervalleJours - joursEcoules);
   string texte = "🛡️ Gardien Démo Actif | Dernier trade : il y a " + IntegerToString(joursEcoules) +
                  "j | Prochain ping auto dans : " + IntegerToString(joursRestants) + "j";

   ObjectSetString(0, nomLabel, OBJPROP_TEXT, texte);
   ObjectSetInteger(0, nomLabel, OBJPROP_COLOR, C'38,166,154'); // Vert TradingView
}

//+------------------------------------------------------------------+
//| Initialisation du robot                                          |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("🚀 [GardienDémo] Démarrage du Gardien Anti-Expiration de Compte Démo...");

   g_dernierTradeKeepAlive = ObtenirDateDernierTradeCompte();
   if(g_dernierTradeKeepAlive > 0)
   {
      Print("ℹ️ [GardienDémo] Dernier trade détecté sur ce compte le : ", TimeToString(g_dernierTradeKeepAlive));
   }
   else
   {
      Print("ℹ️ [GardienDémo] Aucun trade récent trouvé dans l'historique du compte Démo.");
   }

   // Vérification toutes les 60 secondes
   EventSetTimer(60);
   MettreAJourAffichageStatut();

   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Nettoyage à la fermeture du robot                                |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   ObjectsDeleteAll(0, g_prefixeObjets);
}

//+------------------------------------------------------------------+
//| Vérification périodique (toutes les minutes)                     |
//+------------------------------------------------------------------+
void OnTimer()
{
   MettreAJourAffichageStatut();

   // Sécurité : uniquement si ce n'est PAS un compte réel
   if((ENUM_ACCOUNT_TRADE_MODE)AccountInfoInteger(ACCOUNT_TRADE_MODE) == ACCOUNT_TRADE_MODE_REAL)
      return;

   // Ne tenter le micro-trade qu'en semaine (Lundi = 1 à Vendredi = 5) entre 08h00 et 20h00 heure serveur
   MqlDateTime dt;
   TimeToStruct(TimeCurrent(), dt);
   if(dt.day_of_week == 0 || dt.day_of_week == 6)
      return;
   if(dt.hour < 8 || dt.hour > 20)
      return;

   // Cas 1 : Premier lancement et aucun trade dans l'historique
   if(!g_premierTestEffectue && g_dernierTradeKeepAlive == 0 && InpForcerAuPremierLancement)
   {
      g_premierTestEffectue = true;
      ExecuterMicroTradeKeepAlive();
      MettreAJourAffichageStatut();
      return;
   }

   // Cas 2 : Le délai de X jours est dépassé depuis le dernier trade
   int secondesIntervalle = InpIntervalleJours * 86400;
   if(g_dernierTradeKeepAlive > 0 && (TimeCurrent() - g_dernierTradeKeepAlive) >= secondesIntervalle)
   {
      ExecuterMicroTradeKeepAlive();
      MettreAJourAffichageStatut();
   }
}

//+------------------------------------------------------------------+
//| Fonction OnTick (au cas où le Timer met du temps au démarrage)   |
//+------------------------------------------------------------------+
void OnTick()
{
   if(!g_premierTestEffectue && g_dernierTradeKeepAlive == 0 && InpForcerAuPremierLancement)
   {
      OnTimer();
   }
}
//+------------------------------------------------------------------+
