//+------------------------------------------------------------------+
//|                                     GenerateurCapturesMT5.mq5    |
//|               Script d'automatisation des captures pour l'IA     |
//|                         Projet TradeLog                          |
//+------------------------------------------------------------------+
#property copyright "TradeLog"
#property link      "https://tradelog.local"
#property version   "1.10"
#property script_show_inputs

// ─── Paramètres configurables dans la fenêtre du script ────────────
input group "─── Fichiers et Export ───"
input string InpNomFichierJSON   = "trades_mt5_dataset.json"; // Nom du fichier JSON dans MQL5/Files
input string InpDossierSortie    = "dataset_ia";             // Sous-dossier de destination dans MQL5/Files
input int    InpLargeurImage     = 640;                      // Largeur carrée standard pour l'IA (YOLO)
input int    InpHauteurImage     = 640;                      // Hauteur carrée standard pour l'IA (YOLO)
input int    InpNiveauZoom       = 3;                        // Zoom du graphique (1 à 5, standard: 3)
input int    InpPauseAffichageMs = 1000;                      // Pause en ms pour laisser le temps au graphique de se dessiner (recommandé: 400-500)
input int    InpBougiesApresEntree = 25;                     // Nombre de bougies après l'entrée visibles dans la capture

input group "─── Template et Style Graphique ───"
input bool   InpUtiliserTemplateExistant = true;             // Appliquer le template TradeLog.tpl ?
input string InpNomTemplate              = "TradeLog.tpl";   // Nom du fichier template (.tpl) si utilisé
input bool   InpSauvegarderTemplate      = false;            // Sauvegarder ce style comme template officiel TradeLog.tpl ?
input color  InpCouleurFond              = C'19,23,34';      // Fond sombre (#131722) identique à l'application
input color  InpCouleurTexte             = clrWhite;         // Texte et échelles de prix
input color  InpCouleurHausse            = C'38,166,154';    // Bougies haussières (#26a69a) identiques à l'application
input color  InpCouleurBaisse            = C'239,83,80';     // Bougies baissières (#ef5350) identiques à l'application
input bool   InpAfficherGrille           = false;            // Afficher la grille (désactivée pour l'IA)
input bool   InpSupprimerIndicateurs     = true;             // Retirer systématiquement tous les indicateurs (Graphique 100% nu)
input bool   InpTracerNiveauxTrade       = false;            // Tracer les lignes Entrée, SL et TP (false = bougies 100% nues)

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
 * Résout le nom exact du symbole chez le courtier (gère les suffixes comme .r, .m, .pro, _i).
 * Exemple : "EURUSD" -> "EURUSD.r" si le compte utilise des paires à suffixe.
 */
string ResoudreSymboleCourtier(string baseSymbole)
{
   // 1. Test direct
   if(SymbolSelect(baseSymbole, true)) return baseSymbole;

   // 2. Recherche parmi tous les symboles disponibles sur le compte courtier
   int totalSymboles = SymbolsTotal(false);
   for(int i = 0; i < totalSymboles; i++)
   {
      string nom = SymbolName(i, false);
      if(StringFind(nom, baseSymbole) != -1)
      {
         SymbolSelect(nom, true);
         return nom;
      }
   }
   return baseSymbole;
}

/**
 * Force MetaTrader 5 à télécharger et synchroniser les bougies historiques depuis le serveur du courtier.
 */
bool ForcerTelechargementHistorique(string symbole, ENUM_TIMEFRAMES tf, datetime dateTrade)
{
   datetime tabTemps[];
   int tentatives = 0;
   
   while(tentatives < 25)
   {
      // Demande 50 barres à partir de la date du trade
      int nbBarres = CopyTime(symbole, tf, dateTrade, 50, tabTemps);
      if(nbBarres > 0)
      {
         return true; // Données prêtes en mémoire locale
      }
      Sleep(100);
      tentatives++;
   }
   return false;
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
 * Supprime absolument tous les indicateurs techniques et sous-fenêtres du graphique
 * pour garantir un affichage 100% "Price Action pur" (bougies nues).
 */
void SupprimerTousLesIndicateurs(long chart_id)
{
   int totalFenetres = (int)ChartGetInteger(chart_id, CHART_WINDOWS_TOTAL);
   for(int w = totalFenetres - 1; w >= 0; w--)
   {
      int totalIndicateurs = ChartIndicatorsTotal(chart_id, w);
      for(int i = totalIndicateurs - 1; i >= 0; i--)
      {
         string nomIndicateur = ChartIndicatorName(chart_id, w, i);
         if(nomIndicateur != "")
         {
            ChartIndicatorDelete(chart_id, w, nomIndicateur);
         }
      }
   }
}

/**
 * Applique un template .tpl ou configure un style visuel 100% propre et reproductible
 * pour garantir que chaque capture d'écran ait exactement la même apparence sans aucun indicateur.
 */
void AppliquerStyleOuTemplate(long chart_id)
{
   bool templateApplique = false;
   if(InpUtiliserTemplateExistant && InpNomTemplate != "")
   {
      templateApplique = ChartApplyTemplate(chart_id, InpNomTemplate);
      if(templateApplique)
      {
         PrintFormat("🎨 [Template] Modèle '%s' appliqué sur le graphique.", InpNomTemplate);
         Sleep(150); // Laisse le temps au template de s'appliquer
      }
   }
   
   if(!templateApplique)
   {
      // 1️⃣ Retrait de tous les indicateurs existants et masquage des volumes
      if(InpSupprimerIndicateurs)
      {
         SupprimerTousLesIndicateurs(chart_id);
      }
      ObjectsDeleteAll(chart_id, 0, -1);

      // 2️⃣ Masquage des éléments parasites (grille, séparateurs, boutons, volumes)
      ChartSetInteger(chart_id, CHART_SHOW_GRID, InpAfficherGrille);
      ChartSetInteger(chart_id, CHART_SHOW_VOLUMES, CHART_VOLUME_HIDE); // Aucun volume
      ChartSetInteger(chart_id, CHART_SHOW_PERIOD_SEP, false);
      ChartSetInteger(chart_id, CHART_SHOW_OHLC, false);
      ChartSetInteger(chart_id, CHART_SHOW_ONE_CLICK, false);
      ChartSetInteger(chart_id, CHART_SHOW_ASK_LINE, false);
      ChartSetInteger(chart_id, CHART_SHOW_BID_LINE, false);
      
      // 3️⃣ Type de graphique : Bougies japonaises et zoom
      ChartSetInteger(chart_id, CHART_MODE, CHART_CANDLES);
      ChartSetInteger(chart_id, CHART_SCALE, InpNiveauZoom);
      
      // 4️⃣ Palette de couleurs standardisée (Thème Sombre TradeLog)
      ChartSetInteger(chart_id, CHART_COLOR_BACKGROUND, InpCouleurFond);
      ChartSetInteger(chart_id, CHART_COLOR_FOREGROUND, InpCouleurTexte);
      ChartSetInteger(chart_id, CHART_COLOR_CHART_UP, InpCouleurHausse);
      ChartSetInteger(chart_id, CHART_COLOR_CHART_DOWN, InpCouleurBaisse);
      ChartSetInteger(chart_id, CHART_COLOR_CANDLE_BULL, InpCouleurHausse);
      ChartSetInteger(chart_id, CHART_COLOR_CANDLE_BEAR, InpCouleurBaisse);
      ChartSetInteger(chart_id, CHART_COLOR_CHART_LINE, clrSilver);
      
      // 5️⃣ Sauvegarde automatique comme template standard TradeLog.tpl si demandé
      if(InpSauvegarderTemplate)
      {
         ChartSaveTemplate(chart_id, "TradeLog.tpl");
      }
   }
   else if(InpSupprimerIndicateurs)
   {
      // Même si un template a été chargé, on s'assure qu'aucun indicateur indésirable n'y figure
      SupprimerTousLesIndicateurs(chart_id);
      ChartSetInteger(chart_id, CHART_SHOW_VOLUMES, CHART_VOLUME_HIDE);
   }

   // DÉSACTIVATION OBLIGATOIRE DE L'AUTOSCROLL ET DU DÉCALAGE
   // Empêche MT5 de ramener automatiquement la vue à l'extrême droite du marché
   ChartSetInteger(chart_id, CHART_AUTOSCROLL, false);
   ChartSetInteger(chart_id, CHART_SHIFT, false);
}

/**
 * Trace les lignes horizontales d'Entrée, Stop Loss et Take Profit sur le graphique avant la capture.
 */
void TracerNiveauxTrade(long chart_id, double entree, double sl, double tp, string direction, string idTrade)
{
   if(entree <= 0) return;
   
   string prefixe = "TL_" + idTrade + "_";
   
   // 1. Ligne d'Entrée (Bleue, pleine)
   string objEntree = prefixe + "ENTRY";
   ObjectCreate(chart_id, objEntree, OBJ_HLINE, 0, 0, entree);
   ObjectSetInteger(chart_id, objEntree, OBJPROP_COLOR, clrDodgerBlue);
   ObjectSetInteger(chart_id, objEntree, OBJPROP_STYLE, STYLE_SOLID);
   ObjectSetInteger(chart_id, objEntree, OBJPROP_WIDTH, 2);
   ObjectSetString(chart_id, objEntree, OBJPROP_TEXT, "ENTREE (" + direction + "): " + DoubleToString(entree, 5));
   
   // 2. Ligne Stop Loss (Rouge, pointillée)
   if(sl > 0)
   {
      string objSL = prefixe + "SL";
      ObjectCreate(chart_id, objSL, OBJ_HLINE, 0, 0, sl);
      ObjectSetInteger(chart_id, objSL, OBJPROP_COLOR, clrCrimson);
      ObjectSetInteger(chart_id, objSL, OBJPROP_STYLE, STYLE_DASH);
      ObjectSetInteger(chart_id, objSL, OBJPROP_WIDTH, 2);
      ObjectSetString(chart_id, objSL, OBJPROP_TEXT, "STOP LOSS: " + DoubleToString(sl, 5));
   }
   
   // 3. Ligne Take Profit (Verte, pointillée)
   if(tp > 0)
   {
      string objTP = prefixe + "TP";
      ObjectCreate(chart_id, objTP, OBJ_HLINE, 0, 0, tp);
      ObjectSetInteger(chart_id, objTP, OBJPROP_COLOR, clrLimeGreen);
      ObjectSetInteger(chart_id, objTP, OBJPROP_STYLE, STYLE_DASH);
      ObjectSetInteger(chart_id, objTP, OBJPROP_WIDTH, 2);
      ObjectSetString(chart_id, objTP, OBJPROP_TEXT, "TAKE PROFIT: " + DoubleToString(tp, 5));
   }
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
   
   // 2️⃣ Création des sous-dossiers de destination
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
      string symboleBrut = ExtraireValeurJSON(blocTrade, "symbole");
      string tfStr       = ExtraireValeurJSON(blocTrade, "timeframe");
      string timestampStr= ExtraireValeurJSON(blocTrade, "timestamp_unix");
      string direction   = ExtraireValeurJSON(blocTrade, "direction");
      string resultat    = ExtraireValeurJSON(blocTrade, "resultat");
      
      if(symboleBrut == "" || timestampStr == "")
      {
         PrintFormat("⚠️ Trade #%d ignoré (symbole ou timestamp manquant).", nbTradesTotal);
         continue;
      }
      
      // Résolution du symbole réel chez le courtier (ex: EURUSD -> EURUSD.r)
      string symbole = ResoudreSymboleCourtier(symboleBrut);
      
      datetime dateTrade = (datetime)StringToInteger(timestampStr);
      ENUM_TIMEFRAMES tf = ConvertirTimeframe(tfStr);
      
      // Extraction des niveaux de prix
      double prixEntree = StringToDouble(ExtraireValeurJSON(blocTrade, "prix_entree"));
      double sl         = StringToDouble(ExtraireValeurJSON(blocTrade, "stop_loss"));
      double tp         = StringToDouble(ExtraireValeurJSON(blocTrade, "take_profit"));
      
      // Assure que le symbole est actif dans le Market Watch
      SymbolSelect(symbole, true);
      
      // 4️⃣ Ouverture du graphique
      long chart_id = ChartOpen(symbole, tf);
      if(chart_id == 0)
      {
         PrintFormat("⚠️ Impossible d'ouvrir le graphique pour %s (%s). Vérifiez le nom du symbole chez votre courtier.", symbole, tfStr);
         continue;
      }
      
      // Désactiver impérativement l'autoscroll pour éviter que le graphique ne revienne aux bougies en direct
      ChartSetInteger(chart_id, CHART_AUTOSCROLL, false);
      ChartSetInteger(chart_id, CHART_SHIFT, false);
      
      // Application du template
      AppliquerStyleOuTemplate(chart_id);
      
      // 5️⃣ Téléchargement et synchronisation forcée de l'historique
      bool syncOk = ForcerTelechargementHistorique(symbole, tf, dateTrade);
      if(!syncOk)
      {
         PrintFormat("⚠️ [Trade %s] Historique lent à charger pour %s (%s) à la date %s. Nouvelle tentative...", idTrade, symbole, tfStr, TimeToString(dateTrade));
         Sleep(300);
      }
      
      // Recherche de l'index de la bougie correspondant au timestamp exact
      // exact_mode = false : trouve la bougie la plus proche si la date tombe entre deux barres
      int barIndex = iBarShift(symbole, tf, dateTrade, false);
      
      if(barIndex < 0)
      {
         PrintFormat("❌ [Trade %s] Bougie INTROUVABLE pour %s (%s) à la date %s. Capture ignorée pour ne pas enregistrer une fausse image.", idTrade, symbole, tfStr, TimeToString(dateTrade));
         ChartClose(chart_id);
         continue;
      }
      
      // Date réelle de la bougie trouvée
      datetime dateBougieReelle = iTime(symbole, tf, barIndex);
      
      // 6️⃣ Cadrage parfait de la bougie
      // On veut afficher la bougie d'entrée avec quelques bougies après (InpBougiesApresEntree)
      // pour voir le déclenchement et l'évolution du trade
      int decalageDepuisFin = MathMax(0, barIndex - InpBougiesApresEntree);
      
      // Navigation vers la position précise dans le passé
      ChartNavigate(chart_id, CHART_END, -decalageDepuisFin);
      
      // Traçage des lignes de repère (si activé)
      if(InpTracerNiveauxTrade)
      {
         TracerNiveauxTrade(chart_id, prixEntree, sl, tp, direction, idTrade);
      }
      
      // Forçage du rafraîchissement complet du canvas graphique
      ChartRedraw(chart_id);
      
      // Pause pour laisser le temps au moteur graphique DirectX de peindre la fenêtre
      Sleep(InpPauseAffichageMs);
      
      // 7️⃣ Nommage et enregistrement de la capture
      // Nom clair : EURUSD_M5_20240321_143000_WIN_id.png
      string dateLisible = TimeToString(dateBougieReelle, TIME_DATE | TIME_MINUTES);
      StringReplace(dateLisible, ".", "");
      StringReplace(dateLisible, ":", "");
      StringReplace(dateLisible, " ", "_");
      
      string nomImage = InpDossierSortie + "\\tous\\" + symbole + "_" + tfStr + "_" + dateLisible + "_" + resultat + "_" + idTrade + ".png";
      
      // Prise de la capture d'écran
      // ⚠️ Utiliser ALIGN_LEFT pour que la capture respecte le positionnement historique
      // et ne force pas un saut vers la bougie courante (temps réel)
      bool captureOk = ChartScreenShot(chart_id, nomImage, InpLargeurImage, InpHauteurImage, ALIGN_LEFT);
      
      if(captureOk)
      {
         // Copie également dans le dossier win/loss pour faciliter le tri
         if(resultat == "win")
         {
            string nomWin = InpDossierSortie + "\\wins\\" + symbole + "_" + tfStr + "_" + dateLisible + "_" + idTrade + ".png";
            ChartScreenShot(chart_id, nomWin, InpLargeurImage, InpHauteurImage, ALIGN_LEFT);
         }
         else if(resultat == "loss")
         {
            string nomLoss = InpDossierSortie + "\\losses\\" + symbole + "_" + tfStr + "_" + dateLisible + "_" + idTrade + ".png";
            ChartScreenShot(chart_id, nomLoss, InpLargeurImage, InpHauteurImage, ALIGN_LEFT);
         }
         
         nbCapturesReussies++;
         PrintFormat("✅ [%d/%d] Capture réussie : %s (%s) à la date %s (Barre #%d)", 
                     nbTradesTotal, nbTradesTotal, symbole, tfStr, TimeToString(dateBougieReelle), barIndex);
      }
      else
      {
         PrintFormat("❌ Échec capture pour le trade %s", idTrade);
      }
      
      // Nettoyage des objets graphiques
      ObjectsDeleteAll(chart_id, "TL_");
      
      // Fermeture du graphique pour libérer la mémoire
      ChartClose(chart_id);
      Sleep(80);
   }
   
   PrintFormat("🎉 [TradeLog] Terminé ! %d captures créées sur %d trades dans MQL5/Files/%s", nbCapturesReussies, nbTradesTotal, InpDossierSortie);
}
//+------------------------------------------------------------------+
