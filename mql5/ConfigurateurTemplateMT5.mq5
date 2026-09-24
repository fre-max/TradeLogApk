//+------------------------------------------------------------------+
//|                                   ConfigurateurTemplateMT5.mq5   |
//|             Script de configuration et sauvegarde de Template     |
//|                         Projet TradeLog                          |
//+------------------------------------------------------------------+
#property copyright "TradeLog"
#property link      "https://tradelog.local"
#property version   "1.01"
#property script_show_inputs

// ─── Paramètres configurables à l'exécution du script ─────────────
input group "─── Paramètres du Template TradeLog ───"
input string InpNomFichierTemplate   = "TradeLog.tpl"; // Nom du template à sauvegarder dans MT5
input int    InpNiveauZoom           = 3;              // Niveau de zoom standardisé (1 à 5)
input bool   InpActiverDecalage      = true;           // Décaler le graphique par rapport au bord droit
input double InpPourcentDecalage     = 12.0;           // Taille du décalage (en %)
input bool   InpSupprimerIndicateurs = true;           // Retirer TOUS les indicateurs (Graphique 100% nu)

input group "─── Couleurs et Visuel ───"
input color  InpCouleurFond          = C'19,23,34';     // Fond sombre TradingView/TradeLog (RGB: 19, 23, 34)
input color  InpCouleurTexte         = clrWhite;        // Couleur des prix et échelles
input color  InpCouleurHausse        = clrLimeGreen;    // Bougies haussières (corps et mèches)
input color  InpCouleurBaisse        = clrCrimson;      // Bougies baissières (corps et mèches)
input bool   InpAfficherGrille       = false;           // Afficher la grille (recommandé: false pour l'IA)

/**
 * Supprime absolument tous les indicateurs techniques et sous-fenêtres du graphique
 * pour garantir un affichage 100% "Price Action pur" (bougies nues sans aucun indicateur).
 * 
 * Exemple :
 * SupprimerTousLesIndicateurs(ChartID());
 */
void SupprimerTousLesIndicateurs(long chart_id)
{
   // Nombre total de sous-fenêtres sur le graphique (0 = graphique principal, 1, 2... = sous-fenêtres)
   int totalFenetres = (int)ChartGetInteger(chart_id, CHART_WINDOWS_TOTAL);
   
   // Parcours de toutes les fenêtres de la dernière à la première
   for(int w = totalFenetres - 1; w >= 0; w--)
   {
      int totalIndicateurs = ChartIndicatorsTotal(chart_id, w);
      for(int i = totalIndicateurs - 1; i >= 0; i--)
      {
         string nomIndicateur = ChartIndicatorName(chart_id, w, i);
         if(nomIndicateur != "")
         {
            ChartIndicatorDelete(chart_id, w, nomIndicateur);
            PrintFormat("🧹 [Nettoyage] Indicateur retiré du template : '%s' (fenêtre %d)", nomIndicateur, w);
         }
      }
   }
}

/**
 * Fonction principale exécutée lorsque le script est déposé sur un graphique MT5.
 */
void OnStart()
{
   long chart_id = ChartID();
   Print("🎨 [TradeLog] Configuration du graphique épuré en cours...");

   // 1️⃣ Retrait de tous les indicateurs techniques pour avoir un graphique 100% nu
   if(InpSupprimerIndicateurs)
   {
      SupprimerTousLesIndicateurs(chart_id);
   }

   // 2️⃣ Suppression de tous les objets graphiques résiduels
   ObjectsDeleteAll(chart_id, 0, -1);

   // 3️⃣ Masquage des éléments parasites (grille, séparateurs, boutons, volumes)
   ChartSetInteger(chart_id, CHART_SHOW_GRID, InpAfficherGrille);
   ChartSetInteger(chart_id, CHART_SHOW_VOLUMES, CHART_VOLUME_HIDE); // Désactive totalement l'indicateur de volume
   ChartSetInteger(chart_id, CHART_SHOW_PERIOD_SEP, false);
   ChartSetInteger(chart_id, CHART_SHOW_OHLC, false);
   ChartSetInteger(chart_id, CHART_SHOW_ONE_CLICK, false);
   ChartSetInteger(chart_id, CHART_SHOW_ASK_LINE, false);
   ChartSetInteger(chart_id, CHART_SHOW_BID_LINE, false);
   ChartSetInteger(chart_id, CHART_AUTOSCROLL, true);
   
   // 4️⃣ Positionnement et décalage du bord droit
   ChartSetInteger(chart_id, CHART_SHIFT, InpActiverDecalage);
   if(InpActiverDecalage)
   {
      ChartSetDouble(chart_id, CHART_SHIFT_SIZE, InpPourcentDecalage);
   }

   // 5️⃣ Type d'affichage : Bougies japonaises pures et zoom
   ChartSetInteger(chart_id, CHART_MODE, CHART_CANDLES);
   ChartSetInteger(chart_id, CHART_SCALE, InpNiveauZoom);

   // 6️⃣ Application de la palette de couleurs propre TradeLog
   ChartSetInteger(chart_id, CHART_COLOR_BACKGROUND, InpCouleurFond);
   ChartSetInteger(chart_id, CHART_COLOR_FOREGROUND, InpCouleurTexte);
   ChartSetInteger(chart_id, CHART_COLOR_CHART_UP, InpCouleurHausse);
   ChartSetInteger(chart_id, CHART_COLOR_CHART_DOWN, InpCouleurBaisse);
   ChartSetInteger(chart_id, CHART_COLOR_CANDLE_BULL, InpCouleurHausse);
   ChartSetInteger(chart_id, CHART_COLOR_CANDLE_BEAR, InpCouleurBaisse);
   ChartSetInteger(chart_id, CHART_COLOR_CHART_LINE, clrSilver);

   // 7️⃣ Rafraîchissement visuel immédiat
   ChartRedraw(chart_id);

   // 8️⃣ Sauvegarde du template propre dans le répertoire des templates MT5
   bool sauvegardeOk = ChartSaveTemplate(chart_id, InpNomFichierTemplate);
   if(sauvegardeOk)
   {
      PrintFormat("✅ [TradeLog] Template nu '%s' (sans aucun indicateur) sauvegardé avec succès !", InpNomFichierTemplate);
      MessageBox(
         "Le template graphique 100% nu (sans aucun indicateur, sans volume) a été enregistré sous :\n\n" +
         InpNomFichierTemplate + "\n\n" +
         "Vos graphiques et captures seront parfaitement épurés !",
         "TradeLog - Template 100% Price Action",
         MB_OK | MB_ICONINFORMATION
      );
   }
   else
   {
      PrintFormat("❌ [TradeLog] Erreur lors de l'enregistrement du template '%s'.", InpNomFichierTemplate);
   }
}
//+------------------------------------------------------------------+
