//+------------------------------------------------------------------+
//|                                     GenerateurCapturesMT5.mq5    |
//|               Script d'automatisation des captures pour l'IA     |
//|                         Projet TradeLog                          |
//+------------------------------------------------------------------+
#property copyright "TradeLog"
#property link      "https://tradelog.local"
#property version   "1.00"
#property script_show_inputs

// ─── Paramètres configurables dans la fenêtre du script ────────────
input string InpNomFichierJSON   = "trades_mt5_dataset.json"; // Nom du fichier JSON dans MQL5/Files
input string InpDossierSortie    = "dataset_ia";             // Sous-dossier de destination dans MQL5/Files
input int    InpLargeurImage     = 640;                      // Largeur carrée standard pour l'IA (YOLO)
input int    InpHauteurImage     = 640;                      // Hauteur carrée standard pour l'IA (YOLO)
input int    InpNiveauZoom       = 3;                        // Zoom du graphique (1 à 5, standard: 3)
input int    InpPauseAffichageMs = 250;                      // Pause en ms pour laisser le temps au graphique de se dessiner

/**
 * Convertit une chaîne de timeframe en constante ENUM_TIMEFRAMES de MetaTrader 5.
 * Exemple : "M5" -> PERIOD_M5
 */
ENUM_TIMEFRAMES ConvertirTimeframe(string tf)
{
   StringToUpper(tf);
   if(tf == "M1")   return PERIOD_M1;
   if(tf == "M5")   return PERIOD_M5;
   if(tf == "M15")  return PERIOD_M15;
   if(tf == "M30")  return PERIOD_M30;
   if(tf == "H1")   return PERIOD_H1;
   if(tf == "H4")   return PERIOD_H4;
   if(tf == "D1")   return PERIOD_D1;
   return PERIOD_M5; // Valeur par défaut
}

/**
 * Extrait la valeur d'une clé spécifique dans un fragment de texte JSON.
 * Exemple : ExtraireValeurJSON(bloc, "symbole") -> "EURUSD"
 */
string ExtraireValeurJSON(string json, string cle)
{
   string motif = "\"" + cle + "\"";
   int posCle = StringFind(json, motif);
   if(posCle == -1) return "";
   
   // Cherche le caractère deux-points après la clé
   int posDeuxPoints = StringFind(json, ":", posCle);
   if(posDeuxPoints == -1) return "";
   
   // Avance après le ":"
   int debut = posDeuxPoints + 1;
   while(debut < StringLen(json) && (StringGetCharacter(json, debut) == ' ' || StringGetCharacter(json, debut) == '\t'))
      debut++;
      
   // Si la valeur est entre guillemets (chaîne de caractères)
   if(StringGetCharacter(json, debut) == '\"')
   {
      debut++;
      int fin = StringFind(json, "\"", debut);
      if(fin == -1) return "";
      return StringSubstr(json, debut, fin - debut);
   }
   else
   {
      // Valeur numérique ou booléenne (s'arrête à la virgule ou accolade fermante)
      int finVirgule = StringFind(json, ",", debut);
      int finAccolade = StringFind(json, "}", debut);
      int fin = -1;
      
      if(finVirgule != -1 && finAccolade != -1)
         fin = MathMin(finVirgule, finAccolade);
      else if(finVirgule != -1)
         fin = finVirgule;
      else
         fin = finAccolade;
         
      if(fin == -1) return "";
      string val = StringSubstr(json, debut, fin - debut);
      StringTrimLeft(val);
      StringTrimRight(val);
      return val;
   }
}

/**
 * Applique un style visuel 100% propre (sans grille, sans bruits)
 * pour que l'image soit parfaitement adaptée à l'entraînement d'un modèle de vision.
 */
void ConfigurerStyleGraphique(long chart_id)
{
   // 1️⃣ Masquage des éléments parasites (grille, séparateurs, boutons)
   ChartSetInteger(chart_id, CHART_SHOW_GRID, false);
   ChartSetInteger(chart_id, CHART_SHOW_PERIOD_SEP, false);
   ChartSetInteger(chart_id, CHART_SHOW_OHLC, false);
   ChartSetInteger(chart_id, CHART_SHOW_ONE_CLICK, false);
   ChartSetInteger(chart_id, CHART_AUTOSCROLL, false);
   
   // 2️⃣ Type de graphique : Bougies japonaises
   ChartSetInteger(chart_id, CHART_MODE, CHART_CANDLES);
   ChartSetInteger(chart_id, CHART_SCALE, InpNiveauZoom);
   
   // 3️⃣ Palette de couleurs standardisée (Thème Sombre Propre)
   ChartSetInteger(chart_id, CHART_COLOR_BACKGROUND, C'19,23,34'); // Fond sombre identique à TradeLog
   ChartSetInteger(chart_id, CHART_COLOR_FOREGROUND, clrWhite);
   ChartSetInteger(chart_id, CHART_COLOR_CHART_UP, clrLimeGreen);
   ChartSetInteger(chart_id, CHART_COLOR_CHART_DOWN, clrCrimson);
   ChartSetInteger(chart_id, CHART_COLOR_CANDLE_BULL, clrLimeGreen);
   ChartSetInteger(chart_id, CHART_COLOR_CANDLE_BEAR, clrCrimson);
   ChartSetInteger(chart_id, CHART_COLOR_CHART_LINE, clrSilver);
}

/**
 * Fonction principale exécutée lors du lancement du script dans MetaTrader 5.
 */
void OnStart()
{
   Print("🚀 [TradeLog] Démarrage de la génération des captures d'écran...");
   
   // 1️⃣ Ouverture et lecture du fichier JSON exporté dans MQL5/Files
   int handle = FileOpen(InpNomFichierJSON, FILE_READ | FILE_TXT | FILE_ANSI);
   if(handle == INVALID_HANDLE)
   {
      PrintFormat("❌ Erreur : Impossible d'ouvrir le fichier '%s' dans le dossier MQL5/Files. Veuillez y copier le fichier JSON exporté.", InpNomFichierJSON);
      return;
   }
   
   string contenuTotal = "";
   while(!FileIsEnding(handle))
   {
      contenuTotal += FileReadString(handle) + "\n";
   }
   FileClose(handle);
   
   if(StringLen(contenuTotal) == 0)
   {
      Print("❌ Erreur : Le fichier JSON est vide.");
      return;
   }
   
   // 2️⃣ Création du sous-dossier de destination
   FolderCreate(InpDossierSortie);
   FolderCreate(InpDossierSortie + "\\wins");
   FolderCreate(InpDossierSortie + "\\losses");
   FolderCreate(InpDossierSortie + "\\tous");

   int nbTradesTotal = 0;
   int nbCapturesReussies = 0;
   
   // 3️⃣ Parcours des objets du tableau JSON
   int curseur = 0;
   while(true)
   {
      int debutObjet = StringFind(contenuTotal, "{", curseur);
      if(debutObjet == -1) break;
      
      int finObjet = StringFind(contenuTotal, "}", debutObjet);
      if(finObjet == -1) break;
      
      string blocTrade = StringSubstr(contenuTotal, debutObjet, (finObjet - debutObjet) + 1);
      curseur = finObjet + 1;
      nbTradesTotal++;
      
      // Extraction des métadonnées du trade
      string idTrade     = ExtraireValeurJSON(blocTrade, "id");
      string symbole     = ExtraireValeurJSON(blocTrade, "symbole");
      string tfStr       = ExtraireValeurJSON(blocTrade, "timeframe");
      string timestampStr= ExtraireValeurJSON(blocTrade, "timestamp_unix");
      string direction   = ExtraireValeurJSON(blocTrade, "direction");
      string resultat    = ExtraireValeurJSON(blocTrade, "resultat");
      
      if(symbole == "" || timestampStr == "")
      {
         PrintFormat("⚠️ Trade #%d ignoré (données manquantes).", nbTradesTotal);
         continue;
      }
      
      datetime dateTrade = (datetime)StringToInteger(timestampStr);
      ENUM_TIMEFRAMES tf = ConvertirTimeframe(tfStr);
      
      // Assure que le symbole est actif dans le Market Watch
      SymbolSelect(symbole, true);
      
      // 4️⃣ Ouverture du graphique
      long chart_id = ChartOpen(symbole, tf);
      if(chart_id == 0)
      {
         PrintFormat("⚠️ Impossible d'ouvrir le graphique pour %s (%s). Vérifiez le nom du symbole chez votre courtier.", symbole, tfStr);
         continue;
      }
      
      // Application des styles visuels
      ConfigurerStyleGraphique(chart_id);
      
      // Recherche de l'index de la bougie correspondant au timestamp
      int barIndex = iBarShift(symbole, tf, dateTrade, false);
      if(barIndex >= 0)
      {
         // Déplace le graphique pour que la bougie d'entrée soit visible à droite
         ChartNavigate(chart_id, CHART_END, -barIndex);
      }
      else
      {
         PrintFormat("⚠️ Historique insuffisant pour %s à la date %s.", symbole, TimeToString(dateTrade));
      }
      
      // Pause obligatoire pour laisser le temps au moteur graphique de peindre le canvas
      Sleep(InpPauseAffichageMs);
      
      // 5️⃣ Nommage et enregistrement de la capture
      // Nom clair : EURUSD_M5_20240321_WIN_id.png
      string dateLisible = TimeToString(dateTrade, TIME_DATE);
      StringReplace(dateLisible, ".", "");
      
      string nomImage = InpDossierSortie + "\\tous\\" + symbole + "_" + tfStr + "_" + dateLisible + "_" + resultat + "_" + idTrade + ".png";
      
      // Prise de la capture d'écran
      bool captureOk = ChartScreenShot(chart_id, nomImage, InpLargeurImage, InpHauteurImage, ALIGN_RIGHT);
      
      if(captureOk)
      {
         // Copie également dans le dossier win/loss pour faciliter le tri
         if(resultat == "win")
         {
            string nomWin = InpDossierSortie + "\\wins\\" + symbole + "_" + tfStr + "_" + dateLisible + "_" + idTrade + ".png";
            ChartScreenShot(chart_id, nomWin, InpLargeurImage, InpHauteurImage, ALIGN_RIGHT);
         }
         else if(resultat == "loss")
         {
            string nomLoss = InpDossierSortie + "\\losses\\" + symbole + "_" + tfStr + "_" + dateLisible + "_" + idTrade + ".png";
            ChartScreenShot(chart_id, nomLoss, InpLargeurImage, InpHauteurImage, ALIGN_RIGHT);
         }
         
         nbCapturesReussies++;
         PrintFormat("✅ [%d/%d] Capture réussie : %s (%s)", nbTradesTotal, nbTradesTotal, symbole, tfStr);
      }
      else
      {
         PrintFormat("❌ Échec capture pour le trade %s", idTrade);
      }
      
      // Fermeture du graphique pour libérer la mémoire
      ChartClose(chart_id);
      Sleep(50);
   }
   
   PrintFormat("🎉 [TradeLog] Terminé ! %d captures créées sur %d trades dans MQL5/Files/%s", nbCapturesReussies, nbTradesTotal, InpDossierSortie);
}
//+------------------------------------------------------------------+
