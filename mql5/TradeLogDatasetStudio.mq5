//+------------------------------------------------------------------+
//|                                     TradeLogDatasetStudio.mq5    |
//|         Expert Advisor - Studio de Capture Manuelle & Tri Dataset |
//|                         Projet TradeLog                          |
//+------------------------------------------------------------------+
#property copyright "TradeLog"
#property link      "https://tradelog.local"
#property version   "3.00"
#property description "Studio interactif pour naviguer dans l'historique des trades, ajuster le cadrage et le timeframe à la main, et capturer vos images pour l'entraînement IA."

// ─── Paramètres configurables de l'Expert Advisor ─────────────────
input group "─── Source des Données ───"
input string InpNomFichierJSON     = "trades_mt5_dataset_2026-09-23 (2).json"; // Nom du fichier JSON dans MQL5/Files (ou laisser vide pour détection auto)
input string InpFichierProgression = "tradelog_progression.txt";              // Fichier mémorisant l'avancement

input group "─── Dossier & Format des Captures ───"
input string InpDossierSortie      = "dataset_ia";                           // Dossier d'export dans MQL5/Files
input int    InpLargeurImage       = 640;                                    // Largeur de la capture en pixels
input int    InpHauteurImage       = 640;                                    // Hauteur de la capture en pixels
input bool   InpAvancerAutoApresCapture = true;                              // Passer automatiquement au trade suivant après la photo ?

input group "─── Affichage & Confort ───"
input bool   InpAfficherLignesTrade= true;                                   // Afficher les lignes Entrée / SL / TP
input int    InpBougiesApresEntree = 25;                                     // Marge de bougies à droite de l'entrée pour le cadrage

// ─── Structure pour stocker un trade en mémoire ───────────────────
struct TradeItem
{
   string   id;
   string   symbole;
   string   timeframeStr;
   ENUM_TIMEFRAMES tf;
   string   dateLisible;
   datetime dateTrade;
   string   direction;
   string   setup;
   double   prixEntree;
   double   sl;
   double   tp;
   double   rr;
   string   resultat;
   string   session;
   bool     estCapture;
};

// ─── Variables globales du Studio ─────────────────────────────────
TradeItem g_trades[];
int       g_totalTrades      = 0;
int       g_indexActuel      = 0;
bool      g_niveauxVisibles  = true;
string    g_prefixeGUI       = "TL_STUDIO_";

// ─── Variables pour le chargement asynchrone de l'historique ──────
// Quand on demande de naviguer vers un trade, on lance un timer
// qui réessaye toutes les 500ms de vérifier si l'historique est dispo.
// Ça évite le Sleep() qui est interdit/inopérant dans OnChartEvent.
bool      g_attenteHistorique  = false;   // true = on est en train d'attendre l'historique
int       g_tentativesChargement = 0;     // compteur de tentatives
int       g_maxTentatives      = 30;      // on réessaye 30x * 500ms = 15 secondes max
datetime  g_dateAttendue       = 0;       // la date qu'on cherche à afficher

// Constantes de dimensions du panneau HUD
#define HUD_X          15
#define HUD_Y          30
#define HUD_WIDTH      320
#define HUD_HEIGHT     290

//+------------------------------------------------------------------+
//| Fonctions Utilitaires & Décodage JSON                            |
//+------------------------------------------------------------------+

/**
 * Convertit une chaîne de caractères en constante ENUM_TIMEFRAMES MT5.
 */
ENUM_TIMEFRAMES StringToTF(string tf)
{
   StringToUpper(tf);
   if(tf == "M1")   return PERIOD_M1;
   if(tf == "M5")   return PERIOD_M5;
   if(tf == "M15")  return PERIOD_M15;
   if(tf == "M30")  return PERIOD_M30;
   if(tf == "H1")   return PERIOD_H1;
   if(tf == "H4")   return PERIOD_H4;
   if(tf == "D1")   return PERIOD_D1;
   return PERIOD_M5;
}

/**
 * Convertit une période ENUM_TIMEFRAMES en chaîne courte.
 */
string TFToString(ENUM_TIMEFRAMES tf)
{
   if(tf == PERIOD_M1)  return "M1";
   if(tf == PERIOD_M5)  return "M5";
   if(tf == PERIOD_M15) return "M15";
   if(tf == PERIOD_M30) return "M30";
   if(tf == PERIOD_H1)  return "H1";
   if(tf == PERIOD_H4)  return "H4";
   if(tf == PERIOD_D1)  return "D1";
   return "M5";
}

/**
 * Trouve le nom du symbole exact disponible chez le courtier (gère les suffixes ex: EURUSD.r).
 */
string ResoudreSymbole(string base)
{
   if(SymbolSelect(base, true)) return base;
   int total = SymbolsTotal(false);
   for(int i = 0; i < total; i++)
   {
      string s = SymbolName(i, false);
      if(StringFind(s, base) != -1)
      {
         SymbolSelect(s, true);
         return s;
      }
   }
   return base;
}

/**
 * Extrait une valeur d'une clé JSON.
 */
string ExtraireJSON(string json, string cle)
{
   string motif = "\"" + cle + "\"";
   int pos = StringFind(json, motif);
   if(pos == -1) return "";
   
   int posPoints = StringFind(json, ":", pos);
   if(posPoints == -1) return "";
   
   int debut = posPoints + 1;
   while(debut < StringLen(json) && (StringGetCharacter(json, debut) == ' ' || StringGetCharacter(json, debut) == '\t'))
      debut++;
      
   if(StringGetCharacter(json, debut) == '\"')
   {
      debut++;
      int fin = StringFind(json, "\"", debut);
      if(fin == -1) return "";
      return StringSubstr(json, debut, fin - debut);
   }
   else
   {
      int finVirgule = StringFind(json, ",", debut);
      int finAccolade = StringFind(json, "}", debut);
      int fin = (finVirgule != -1 && finAccolade != -1) ? MathMin(finVirgule, finAccolade) : ((finVirgule != -1) ? finVirgule : finAccolade);
      if(fin == -1) return "";
      string val = StringSubstr(json, debut, fin - debut);
      StringTrimLeft(val);
      StringTrimRight(val);
      return val;
   }
}

/**
 * Recherche automatiquement le fichier JSON de dataset dans MQL5/Files si nécessaire.
 */
string DetecterFichierJSON()
{
   if(InpNomFichierJSON != "" && FileIsExist(InpNomFichierJSON))
      return InpNomFichierJSON;
      
   string nomTrouve = "";
   long searchHandle = FileFindFirst("trades_mt5_dataset*.json", nomTrouve);
   if(searchHandle != INVALID_HANDLE)
   {
      FileFindClose(searchHandle);
      PrintFormat("🔍 [TradeLog Studio] Fichier JSON détecté automatiquement : '%s'", nomTrouve);
      return nomTrouve;
   }
   return "trades_mt5_dataset.json";
}

//+------------------------------------------------------------------+
//| Chargement des Données & Mémorisation de la Progression          |
//+------------------------------------------------------------------+

/**
 * Charge tous les trades du JSON et lit le fichier de progression.
 */
bool ChargerDonneesEtProgression()
{
   string fichierJSON = DetecterFichierJSON();
   int handle = FileOpen(fichierJSON, FILE_READ | FILE_TXT | FILE_ANSI);
   if(handle == INVALID_HANDLE)
   {
      PrintFormat("❌ [TradeLog Studio] Impossible d'ouvrir le fichier JSON '%s' dans MQL5/Files.", fichierJSON);
      return false;
   }

   string contenu = "";
   while(!FileIsEnding(handle))
   {
      contenu += FileReadString(handle) + "\n";
   }
   FileClose(handle);

   // Découpage et extraction des objets JSON
   ArrayResize(g_trades, 0);
   int curseur = 0;
   while(true)
   {
      int debut = StringFind(contenu, "{", curseur);
      if(debut == -1) break;
      int fin = StringFind(contenu, "}", debut);
      if(fin == -1) break;

      string bloc = StringSubstr(contenu, debut, (fin - debut) + 1);
      curseur = fin + 1;

      string idTrade = ExtraireJSON(bloc, "id");
      string sym     = ExtraireJSON(bloc, "symbole");
      string tsStr   = ExtraireJSON(bloc, "timestamp_unix");

      if(sym == "" || tsStr == "") continue;

      int taille = ArraySize(g_trades);
      ArrayResize(g_trades, taille + 1);

      g_trades[taille].id           = idTrade;
      g_trades[taille].symbole      = ResoudreSymbole(sym);
      g_trades[taille].timeframeStr = ExtraireJSON(bloc, "timeframe");
      g_trades[taille].tf           = StringToTF(g_trades[taille].timeframeStr);
      g_trades[taille].dateTrade    = (datetime)StringToInteger(tsStr);
      g_trades[taille].dateLisible  = ExtraireJSON(bloc, "date_heure");
      g_trades[taille].direction    = ExtraireJSON(bloc, "direction");
      g_trades[taille].setup        = ExtraireJSON(bloc, "setup");
      g_trades[taille].prixEntree   = StringToDouble(ExtraireJSON(bloc, "prix_entree"));
      g_trades[taille].sl           = StringToDouble(ExtraireJSON(bloc, "stop_loss"));
      g_trades[taille].tp           = StringToDouble(ExtraireJSON(bloc, "take_profit"));
      g_trades[taille].rr           = StringToDouble(ExtraireJSON(bloc, "ratio_rr"));
      g_trades[taille].resultat     = ExtraireJSON(bloc, "resultat");
      g_trades[taille].session      = ExtraireJSON(bloc, "session");
      g_trades[taille].estCapture   = false;
   }

   g_totalTrades = ArraySize(g_trades);
   PrintFormat("✅ [TradeLog Studio] %d trades chargés avec succès depuis '%s'.", g_totalTrades, fichierJSON);

   // Lecture de la progression sauvegardée
   LireFichierProgression();
   return (g_totalTrades > 0);
}

/**
 * Lit le fichier de sauvegarde tradelog_progression.txt pour restaurer l'état.
 */
void LireFichierProgression()
{
   if(!FileIsExist(InpFichierProgression)) return;

   int handle = FileOpen(InpFichierProgression, FILE_READ | FILE_TXT | FILE_ANSI);
   if(handle == INVALID_HANDLE) return;

   while(!FileIsEnding(handle))
   {
      string ligne = FileReadString(handle);
      StringTrimLeft(ligne);
      StringTrimRight(ligne);

      if(StringFind(ligne, "INDEX:") == 0)
      {
         g_indexActuel = (int)StringToInteger(StringSubstr(ligne, 6));
         if(g_indexActuel < 0) g_indexActuel = 0;
         if(g_indexActuel >= g_totalTrades) g_indexActuel = g_totalTrades - 1;
      }
      else if(StringFind(ligne, "CAPTURED:") == 0)
      {
         string capturedId = StringSubstr(ligne, 9);
         for(int i = 0; i < g_totalTrades; i++)
         {
            if(g_trades[i].id == capturedId)
            {
               g_trades[i].estCapture = true;
               break;
            }
         }
      }
   }
   FileClose(handle);
   PrintFormat("💾 [TradeLog Studio] Progression restaurée : Reprise au trade #%d / %d", g_indexActuel + 1, g_totalTrades);
}

/**
 * Sauvegarde la progression (index actuel et IDs capturés) dans le fichier persistant.
 */
void SauvegarderProgression()
{
   int handle = FileOpen(InpFichierProgression, FILE_WRITE | FILE_TXT | FILE_ANSI);
   if(handle == INVALID_HANDLE) return;

   FileWriteString(handle, "INDEX:" + IntegerToString(g_indexActuel) + "\n");
   for(int i = 0; i < g_totalTrades; i++)
   {
      if(g_trades[i].estCapture)
      {
         FileWriteString(handle, "CAPTURED:" + g_trades[i].id + "\n");
      }
   }
   FileClose(handle);
}

//+------------------------------------------------------------------+
//| Interface Utilisateur Interactive (HUD Flottant)                 |
//+------------------------------------------------------------------+

/**
 * Crée un label texte propre sur le graphique.
 */
void CreerLabel(string nom, int x, int y, string texte, color col, int taille = 9, bool gras = false)
{
   string objNom = g_prefixeGUI + nom;
   if(ObjectFind(0, objNom) < 0)
   {
      ObjectCreate(0, objNom, OBJ_LABEL, 0, 0, 0);
      ObjectSetInteger(0, objNom, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(0, objNom, OBJPROP_SELECTABLE, false);
   }
   ObjectSetInteger(0, objNom, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(0, objNom, OBJPROP_YDISTANCE, y);
   ObjectSetString(0, objNom, OBJPROP_TEXT, texte);
   ObjectSetInteger(0, objNom, OBJPROP_COLOR, col);
   ObjectSetInteger(0, objNom, OBJPROP_FONTSIZE, taille);
   ObjectSetString(0, objNom, OBJPROP_FONT, gras ? "Segoe UI Bold" : "Segoe UI");
}

/**
 * Crée un bouton interactif réactif aux clics.
 */
void CreerBouton(string nom, int x, int y, int w, int h, string texte, color colFond, color colTexte = clrWhite)
{
   string objNom = g_prefixeGUI + nom;
   if(ObjectFind(0, objNom) < 0)
   {
      ObjectCreate(0, objNom, OBJ_BUTTON, 0, 0, 0);
      ObjectSetInteger(0, objNom, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(0, objNom, OBJPROP_SELECTABLE, false);
   }
   ObjectSetInteger(0, objNom, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(0, objNom, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(0, objNom, OBJPROP_XSIZE, w);
   ObjectSetInteger(0, objNom, OBJPROP_YSIZE, h);
   ObjectSetString(0, objNom, OBJPROP_TEXT, texte);
   ObjectSetInteger(0, objNom, OBJPROP_BGCOLOR, colFond);
   ObjectSetInteger(0, objNom, OBJPROP_COLOR, colTexte);
   ObjectSetInteger(0, objNom, OBJPROP_FONTSIZE, 9);
   ObjectSetString(0, objNom, OBJPROP_FONT, "Segoe UI Bold");
}

/**
 * Dessine ou met à jour le panneau de contrôle sur le graphique.
 */
void MettreAJourHUD()
{
   if(g_totalTrades == 0) return;

   TradeItem t = g_trades[g_indexActuel];

   // 1. Fond du Panneau
   string bgNom = g_prefixeGUI + "PANEL_BG";
   if(ObjectFind(0, bgNom) < 0)
   {
      ObjectCreate(0, bgNom, OBJ_RECTANGLE_LABEL, 0, 0, 0);
      ObjectSetInteger(0, bgNom, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(0, bgNom, OBJPROP_SELECTABLE, false);
   }
   ObjectSetInteger(0, bgNom, OBJPROP_XDISTANCE, HUD_X);
   ObjectSetInteger(0, bgNom, OBJPROP_YDISTANCE, HUD_Y);
   ObjectSetInteger(0, bgNom, OBJPROP_XSIZE, HUD_WIDTH);
   ObjectSetInteger(0, bgNom, OBJPROP_YSIZE, HUD_HEIGHT);
   ObjectSetInteger(0, bgNom, OBJPROP_BGCOLOR, C'20,24,35');
   ObjectSetInteger(0, bgNom, OBJPROP_BORDER_COLOR, C'45,55,75');
   ObjectSetInteger(0, bgNom, OBJPROP_BORDER_TYPE, BORDER_FLAT);

   // 2. En-tête : Titre & Numérotation
   string titre = StringFormat("TradeLog Studio  [%d / %d]", g_indexActuel + 1, g_totalTrades);
   CreerLabel("TITRE", HUD_X + 12, HUD_Y + 10, titre, clrDodgerBlue, 10, true);

   // Badge Statut
   string statutTxt = t.estCapture ? "✅ CAPTURÉ" : "⏳ À CAPTURER";
   color  statutCol = t.estCapture ? clrLimeGreen : clrGold;
   CreerLabel("STATUT", HUD_X + 225, HUD_Y + 11, statutTxt, statutCol, 9, true);

   // 3. Infos du Trade
   string dirSymbole = StringFormat("%s  ·  %s", t.symbole, (t.direction == "BUY" ? "LONG (BUY)" : "SHORT (SELL)"));
   color  dirCol     = (t.direction == "BUY") ? clrLimeGreen : clrCrimson;
   CreerLabel("SYMBOLE", HUD_X + 12, HUD_Y + 34, dirSymbole, dirCol, 10, true);

   string ligneDate = StringFormat("Date : %s  (TF conseillé: %s)", t.dateLisible, t.timeframeStr);
   CreerLabel("DATE", HUD_X + 12, HUD_Y + 54, ligneDate, clrSilver, 8);

   string ligneRes = StringFormat("Résultat : %s  |  R:R : %.1f  |  Session : %s", 
                                  StringToUpper(t.resultat), t.rr, t.session);
   CreerLabel("RESULTAT", HUD_X + 12, HUD_Y + 70, ligneRes, clrWhite, 8);

   string lignePrix = StringFormat("Entrée: %.5f  SL: %.5f  TP: %.5f", t.prixEntree, t.sl, t.tp);
   CreerLabel("PRIX", HUD_X + 12, HUD_Y + 86, lignePrix, C'170,185,200', 8);

   // 4. Boutons de Navigation
   CreerBouton("BTN_PREV", HUD_X + 12, HUD_Y + 108, 92, 26, "◀ Précédent", C'35,42,55');
   CreerBouton("BTN_NEXT", HUD_X + 114, HUD_Y + 108, 92, 26, "Suivant ▶", C'35,42,55');
   CreerBouton("BTN_PROCHAIN", HUD_X + 216, HUD_Y + 108, 92, 26, "⏭ Non Capturé", C'40,55,75');

   // 5. Boutons Sélecteurs de Timeframes
   CreerLabel("LABEL_TF", HUD_X + 12, HUD_Y + 142, "Changer de Timeframe en 1 clic :", clrSilver, 8);
   CreerBouton("BTN_TF_M1",  HUD_X + 12,  HUD_Y + 158, 38, 22, "M1",  C'30,35,48');
   CreerBouton("BTN_TF_M5",  HUD_X + 54,  HUD_Y + 158, 38, 22, "M5",  C'30,35,48');
   CreerBouton("BTN_TF_M15", HUD_X + 96,  HUD_Y + 158, 38, 22, "M15", C'30,35,48');
   CreerBouton("BTN_TF_M30", HUD_X + 138, HUD_Y + 158, 38, 22, "M30", C'30,35,48');
   CreerBouton("BTN_TF_H1",  HUD_X + 180, HUD_Y + 158, 38, 22, "H1",  C'30,35,48');
   CreerBouton("BTN_TF_H4",  HUD_X + 222, HUD_Y + 158, 38, 22, "H4",  C'30,35,48');
   CreerBouton("BTN_TF_D1",  HUD_X + 264, HUD_Y + 158, 44, 22, "D1",  C'30,35,48');

   // 6. Boutons Outils (Recadrer & Afficher/Masquer Niveaux)
   CreerBouton("BTN_RECADRER", HUD_X + 12, HUD_Y + 188, 142, 24, "📍 Recadrer la Vue", C'35,45,60');
   string txtNiveaux = g_niveauxVisibles ? "📐 Niveaux: VISIBLES" : "📐 Niveaux: MASQUÉS";
   color  colNiveaux = g_niveauxVisibles ? C'25,70,45' : C'60,35,35';
   CreerBouton("BTN_NIVEAUX", HUD_X + 164, HUD_Y + 188, 144, 24, txtNiveaux, colNiveaux);

   // 7. GROS BOUTON DE CAPTURE PHOTO
   CreerBouton("BTN_CAPTURE", HUD_X + 12, HUD_Y + 222, 296, 40, "📸 PRENDRE LA CAPTURE (ESPACE)", C'20,120,60');

   CreerLabel("HELP_KEY", HUD_X + 12, HUD_Y + 268, "Raccourcis : [Espace] Photo · [←/→] Naviguer", clrGray, 8);

   ChartRedraw(0);
}

/**
 * Masque ou réaffiche tous les objets du panneau d'interface.
 */
void MasquerInterfacePanneau(bool masquer)
{
   int total = ObjectsTotal(0, -1, -1);
   for(int i = total - 1; i >= 0; i--)
   {
      string nom = ObjectName(0, i);
      if(StringFind(nom, g_prefixeGUI) == 0)
      {
         ObjectSetInteger(0, nom, OBJPROP_TIMEFRAMES, masquer ? OBJ_NO_PERIODS : OBJ_ALL_PERIODS);
      }
   }
}

/**
 * Supprime tous les éléments de l'interface lors du déchargement.
 */
void NettoyerInterfaceGUI()
{
   ObjectsDeleteAll(0, g_prefixeGUI);
   ObjectsDeleteAll(0, "TL_NIVEAU_");
   ChartRedraw(0);
}

//+------------------------------------------------------------------+
//| Navigation, Cadrage & Traçage des Niveaux                        |
//+------------------------------------------------------------------+

/**
 * Trace les lignes Entrée, SL, TP sur le graphique.
 */
void TracerLignesTrade()
{
   ObjectsDeleteAll(0, "TL_NIVEAU_");
   if(!g_niveauxVisibles || !InpAfficherLignesTrade || g_totalTrades == 0) return;

   TradeItem t = g_trades[g_indexActuel];
   if(t.prixEntree <= 0) return;

   // 1. Entrée (Bleue)
   string objE = "TL_NIVEAU_ENTRY";
   ObjectCreate(0, objE, OBJ_HLINE, 0, 0, t.prixEntree);
   ObjectSetInteger(0, objE, OBJPROP_COLOR, clrDodgerBlue);
   ObjectSetInteger(0, objE, OBJPROP_STYLE, STYLE_SOLID);
   ObjectSetInteger(0, objE, OBJPROP_WIDTH, 2);
   ObjectSetString(0, objE, OBJPROP_TEXT, "ENTRÉE: " + DoubleToString(t.prixEntree, 5));

   // 2. Stop Loss (Rouge)
   if(t.sl > 0)
   {
      string objSL = "TL_NIVEAU_SL";
      ObjectCreate(0, objSL, OBJ_HLINE, 0, 0, t.sl);
      ObjectSetInteger(0, objSL, OBJPROP_COLOR, clrCrimson);
      ObjectSetInteger(0, objSL, OBJPROP_STYLE, STYLE_DASH);
      ObjectSetInteger(0, objSL, OBJPROP_WIDTH, 2);
      ObjectSetString(0, objSL, OBJPROP_TEXT, "STOP LOSS: " + DoubleToString(t.sl, 5));
   }

   // 3. Take Profit (Vert)
   if(t.tp > 0)
   {
      string objTP = "TL_NIVEAU_TP";
      ObjectCreate(0, objTP, OBJ_HLINE, 0, 0, t.tp);
      ObjectSetInteger(0, objTP, OBJPROP_COLOR, clrLimeGreen);
      ObjectSetInteger(0, objTP, OBJPROP_STYLE, STYLE_DASH);
      ObjectSetInteger(0, objTP, OBJPROP_WIDTH, 2);
      ObjectSetString(0, objTP, OBJPROP_TEXT, "TAKE PROFIT: " + DoubleToString(t.tp, 5));
   }
}

/**
 * Fonction centrale : tente de positionner le graphique sur la bougie du trade.
 * Si l'historique n'est pas encore téléchargé, lance un timer pour réessayer.
 * 
 * Exemple d'utilisation : NaviguerVersTrade(5) => affiche le 6e trade du dataset
 */
void NaviguerVersTrade(int index)
{
   if(index < 0 || index >= g_totalTrades) return;
   g_indexActuel = index;

   TradeItem t = g_trades[g_indexActuel];

   PrintFormat("🔄 [TradeLog Studio] Navigation vers trade #%d : %s %s le %s",
               g_indexActuel + 1, t.symbole, t.direction, t.dateLisible);

   // 1️⃣ Si le symbole du trade diffère, on change de paire.
   // ChartSetSymbolPeriod redémarre l'EA (OnDeinit + OnInit).
   // L'OnInit relira la progression sauvegardée et rappellera NaviguerVersTrade.
   if(_Symbol != t.symbole)
   {
      PrintFormat("🔀 [TradeLog Studio] Changement de symbole : %s → %s", _Symbol, t.symbole);
      SauvegarderProgression();
      ChartSetSymbolPeriod(0, t.symbole, (ENUM_TIMEFRAMES)_Period);
      return;
   }

   // 2️⃣ Désactivation autoscroll (sinon le graphique revient au live)
   ChartSetInteger(0, CHART_AUTOSCROLL, false);
   ChartSetInteger(0, CHART_SHIFT, false);

   // 3️⃣ Forcer le téléchargement de l'historique pour cette date
   //     On demande les barres DEPUIS la date du trade
   g_dateAttendue = t.dateTrade;
   
   // On demande l'historique des deux côtés de la date du trade (marge de 200 barres)
   datetime tabTemp[];
   int barresDisponibles = CopyTime(_Symbol, (ENUM_TIMEFRAMES)_Period, t.dateTrade, 200, tabTemp);

   // 4️⃣ Essayer immédiatement de trouver la bougie
   int barIndex = iBarShift(_Symbol, (ENUM_TIMEFRAMES)_Period, t.dateTrade, false);
   
   if(barIndex >= 0 && barIndex < iBars(_Symbol, (ENUM_TIMEFRAMES)_Period))
   {
      // L'historique est déjà disponible, on navigue directement
      PrintFormat("✅ [TradeLog Studio] Bougie trouvée à l'index %d pour la date %s", barIndex, TimeToString(t.dateTrade));
      PositionnerGraphiqueSurBougie(barIndex);
      g_attenteHistorique = false;
   }
   else
   {
      // L'historique n'est pas encore chargé, on lance le timer pour réessayer
      PrintFormat("⏳ [TradeLog Studio] Historique non disponible pour %s au %s. Lancement du téléchargement...",
                  _Symbol, TimeToString(t.dateTrade));
      g_attenteHistorique = true;
      g_tentativesChargement = 0;
      
      // Afficher un message de chargement dans le HUD
      CreerLabel("LOADING", HUD_X + 12, HUD_Y + HUD_HEIGHT + 10, 
                 "⏳ Téléchargement de l'historique en cours...", clrYellow, 10, true);
      ChartRedraw(0);
      
      // Active le timer toutes les 500ms pour vérifier si l'historique est dispo
      EventSetMillisecondTimer(500);
   }

   // 5️⃣ Mise à jour des lignes de niveaux et de l'interface
   TracerLignesTrade();
   MettreAJourHUD();
   SauvegarderProgression();
}

/**
 * Positionne le graphique pour que la bougie du trade soit bien visible.
 * barIndex = distance en nombre de bougies depuis la bougie actuelle (0 = maintenant).
 * 
 * Exemple : si barIndex = 5000, la bougie du trade est 5000 bougies en arrière.
 */
void PositionnerGraphiqueSurBougie(int barIndex)
{
   // On veut que la bougie du trade soit visible avec InpBougiesApresEntree bougies à droite
   int decalage = MathMax(0, barIndex - InpBougiesApresEntree);
   
   // ChartNavigate(0, CHART_END, -decalage) part de la droite et recule de "decalage" bougies
   ChartNavigate(0, CHART_END, -decalage);
   
   // Forcer la mise à jour visuelle du graphique
   ChartRedraw(0);
   
   PrintFormat("📍 [TradeLog Studio] Graphique positionné : barIndex=%d, décalage=%d", barIndex, decalage);
}

/**
 * Appelé par OnTimer toutes les 500ms quand on attend l'historique.
 * Réessaye de trouver la bougie après que MT5 ait eu le temps de télécharger.
 */
void VerifierHistoriqueDisponible()
{
   if(!g_attenteHistorique) return;
   
   g_tentativesChargement++;
   
   TradeItem t = g_trades[g_indexActuel];
   
   // Redemander les barres pour forcer le serveur à les envoyer
   datetime tabTemp[];
   int barresDisponibles = CopyTime(_Symbol, (ENUM_TIMEFRAMES)_Period, t.dateTrade, 200, tabTemp);
   
   // Réessayer iBarShift
   int barIndex = iBarShift(_Symbol, (ENUM_TIMEFRAMES)_Period, t.dateTrade, false);
   
   PrintFormat("🔍 [TradeLog Studio] Tentative %d/%d : iBarShift=%d, CopyTime=%d barres pour %s au %s",
               g_tentativesChargement, g_maxTentatives, barIndex, barresDisponibles,
               _Symbol, TimeToString(t.dateTrade));
   
   if(barIndex >= 0 && barIndex < iBars(_Symbol, (ENUM_TIMEFRAMES)_Period))
   {
      // Historique enfin disponible !
      g_attenteHistorique = false;
      EventKillTimer();
      
      // Supprimer le message de chargement
      ObjectDelete(0, g_prefixeGUI + "LOADING");
      
      PrintFormat("✅ [TradeLog Studio] Historique chargé après %d tentatives ! Bougie trouvée à l'index %d",
                  g_tentativesChargement, barIndex);
      
      PositionnerGraphiqueSurBougie(barIndex);
      TracerLignesTrade();
      ChartRedraw(0);
      return;
   }
   
   // Mise à jour du message de chargement avec le compteur
   string msgChargement = StringFormat("⏳ Chargement historique... (%d/%d)", g_tentativesChargement, g_maxTentatives);
   CreerLabel("LOADING", HUD_X + 12, HUD_Y + HUD_HEIGHT + 10, msgChargement, clrYellow, 10, true);
   ChartRedraw(0);
   
   // Si on a atteint le maximum de tentatives, on abandonne proprement
   if(g_tentativesChargement >= g_maxTentatives)
   {
      g_attenteHistorique = false;
      EventKillTimer();
      
      PrintFormat("⚠️ [TradeLog Studio] Impossible de charger l'historique pour %s au %s après %d tentatives.",
                  _Symbol, TimeToString(t.dateTrade), g_maxTentatives);
      PrintFormat("💡 CONSEIL : Ouvrez manuellement un graphique %s et faites défiler jusqu'au %s pour forcer MT5 à télécharger l'historique.",
                  _Symbol, TimeToString(t.dateTrade));
      
      // Afficher un message d'erreur
      CreerLabel("LOADING", HUD_X + 12, HUD_Y + HUD_HEIGHT + 10,
                 "⚠️ Historique indisponible. Essayez de défiler manuellement.", clrOrangeRed, 9, true);
      ChartRedraw(0);
   }
}

/**
 * Recadre instantanément le graphique sur la date du trade actuel.
 */
void RecadrerSurTradeActuel()
{
   NaviguerVersTrade(g_indexActuel);
}

/**
 * Bascule le graphique sur un nouveau timeframe.
 * IMPORTANT : ChartSetSymbolPeriod provoque un redémarrage complet de l'EA
 * (OnDeinit + OnInit). Donc on sauvegarde la progression AVANT.
 * Le OnInit qui suit renaviguera automatiquement vers le bon trade.
 */
void ChangerTimeframe(string tfStr)
{
   ENUM_TIMEFRAMES nouveauTF = StringToTF(tfStr);
   
   // Si on est déjà sur ce timeframe, juste recadrer
   if((ENUM_TIMEFRAMES)_Period == nouveauTF)
   {
      RecadrerSurTradeActuel();
      return;
   }
   
   PrintFormat("🔄 [TradeLog Studio] Changement de timeframe → %s", tfStr);
   
   // Sauvegarder l'index AVANT le changement car l'EA va redémarrer
   SauvegarderProgression();
   
   // Ceci redémarre l'EA => OnDeinit() puis OnInit() automatiquement
   ChartSetSymbolPeriod(0, _Symbol, nouveauTF);
   // ⚠️ RIEN ne s'exécute après cette ligne car l'EA est redémarré
}

/**
 * Bascule l'affichage des niveaux Entrée / SL / TP.
 */
void ToggleNiveaux()
{
   g_niveauxVisibles = !g_niveauxVisibles;
   TracerLignesTrade();
   MettreAJourHUD();
}

/**
 * Saute au prochain trade qui n'a pas encore été capturé.
 */
void AllerAuProchainNonCapture()
{
   for(int i = g_indexActuel + 1; i < g_totalTrades; i++)
   {
      if(!g_trades[i].estCapture)
      {
         NaviguerVersTrade(i);
         return;
      }
   }
   // Si pas trouvé après, on cherche depuis le début
   for(int i = 0; i < g_indexActuel; i++)
   {
      if(!g_trades[i].estCapture)
      {
         NaviguerVersTrade(i);
         return;
      }
   }
   MessageBox("Félicitations ! Tous les trades ont déjà été capturés.", "TradeLog Studio", MB_OK | MB_ICONINFORMATION);
}

//+------------------------------------------------------------------+
//| Prise de Capture Manuelle & Enregistrement                       |
//+------------------------------------------------------------------+

/**
 * Prend la capture d'écran nette, sans le panneau HUD, et mémorise la photo.
 */
void PrendreCaptureManuelle()
{
   if(g_totalTrades == 0) return;
   
   // Ne pas permettre de capturer si l'historique est encore en chargement
   if(g_attenteHistorique)
   {
      PrintFormat("⏳ [TradeLog Studio] Historique pas encore chargé. Patientez...");
      return;
   }

   TradeItem t = g_trades[g_indexActuel];

   // 1. Masquage temporaire de l'interface pour ne pas polluer l'image
   MasquerInterfacePanneau(true);
   // Masquer aussi le label de chargement s'il existe encore
   ObjectDelete(0, g_prefixeGUI + "LOADING");
   ChartRedraw(0);
   Sleep(100);

   // 2. Dossiers de destination
   FolderCreate(InpDossierSortie);
   FolderCreate(InpDossierSortie + "\\tous");
   FolderCreate(InpDossierSortie + "\\wins");
   FolderCreate(InpDossierSortie + "\\losses");

   // 3. Nommage du fichier image
   string tfActuel = TFToString((ENUM_TIMEFRAMES)_Period);
   string dateLisible = TimeToString(t.dateTrade, TIME_DATE | TIME_MINUTES);
   StringReplace(dateLisible, ".", "");
   StringReplace(dateLisible, ":", "");
   StringReplace(dateLisible, " ", "_");

   string nomRelatif = InpDossierSortie + "\\tous\\" + _Symbol + "_" + tfActuel + "_" + dateLisible + "_" + t.resultat + "_" + t.id + ".png";

   // 4. Capture d'écran carrée
   bool ok = ChartScreenShot(0, nomRelatif, InpLargeurImage, InpHauteurImage, ALIGN_RIGHT);

   if(ok)
   {
      // Copie dans le dossier correspondant
      if(t.resultat == "win")
      {
         string nomWin = InpDossierSortie + "\\wins\\" + _Symbol + "_" + tfActuel + "_" + dateLisible + "_" + t.id + ".png";
         ChartScreenShot(0, nomWin, InpLargeurImage, InpHauteurImage, ALIGN_RIGHT);
      }
      else if(t.resultat == "loss")
      {
         string nomLoss = InpDossierSortie + "\\losses\\" + _Symbol + "_" + tfActuel + "_" + dateLisible + "_" + t.id + ".png";
         ChartScreenShot(0, nomLoss, InpLargeurImage, InpHauteurImage, ALIGN_RIGHT);
      }

      // Marque le trade comme capturé
      g_trades[g_indexActuel].estCapture = true;
      SauvegarderProgression();

      PrintFormat("📸 [TradeLog Studio] Capture réussie pour le trade #%d : %s", g_indexActuel + 1, nomRelatif);
   }
   else
   {
      PrintFormat("❌ [TradeLog Studio] Échec de la capture pour le trade #%d", g_indexActuel + 1);
   }

   // 5. Réaffichage de l'interface
   MasquerInterfacePanneau(false);
   MettreAJourHUD();
   ChartRedraw(0);

   // 6. Avance automatique si activé
   if(ok && InpAvancerAutoApresCapture)
   {
      if(g_indexActuel < g_totalTrades - 1)
      {
         NaviguerVersTrade(g_indexActuel + 1);
      }
   }
}

//+------------------------------------------------------------------+
//| Événements Principaux de l'Expert Advisor                        |
//+------------------------------------------------------------------+

/**
 * Initialisation lors du dépôt de l'EA sur le graphique.
 */
int OnInit()
{
   Print("🚀 [TradeLog Studio v3] Initialisation du Studio de Capture Manuelle...");
   Print("📋 [TradeLog Studio] Symbole actuel du graphique : " + _Symbol);
   Print("📋 [TradeLog Studio] Timeframe actuel : " + TFToString((ENUM_TIMEFRAMES)_Period));

   // Remise à zéro de l'état d'attente (important après un redémarrage par ChangerTimeframe)
   g_attenteHistorique = false;
   g_tentativesChargement = 0;

   // Chargement des données et de l'historique de progression
   if(!ChargerDonneesEtProgression())
   {
      Print("❌ Impossible de charger les données du dataset.");
      return INIT_FAILED;
   }

   // Construction initiale du HUD
   MettreAJourHUD();

   // Navigation vers le trade en cours (avec gestion asynchrone de l'historique)
   NaviguerVersTrade(g_indexActuel);

   return INIT_SUCCEEDED;
}

/**
 * Nettoyage lors de la fermeture ou du changement de graphique.
 */
void OnDeinit(const int reason)
{
   // Stopper le timer si actif
   EventKillTimer();
   
   SauvegarderProgression();
   NettoyerInterfaceGUI();
   Print("👋 [TradeLog Studio] Studio fermé proprement. Progression sauvegardée.");
}

/**
 * Appelé par le timer toutes les 500ms quand on attend l'historique.
 */
void OnTimer()
{
   VerifierHistoriqueDisponible();
}

/**
 * Gestionnaire d'événements interactifs : Clics souris sur les boutons & Raccourcis clavier.
 */
void OnChartEvent(const int id, const long &lparam, const double &dparam, const string &sparam)
{
   // ─── 1. Clics sur les Boutons du Panneau ────────────────────────
   if(id == CHARTEVENT_OBJECT_CLICK)
   {
      if(sparam == g_prefixeGUI + "BTN_NEXT")
      {
         if(g_indexActuel < g_totalTrades - 1)
            NaviguerVersTrade(g_indexActuel + 1);
      }
      else if(sparam == g_prefixeGUI + "BTN_PREV")
      {
         if(g_indexActuel > 0)
            NaviguerVersTrade(g_indexActuel - 1);
      }
      else if(sparam == g_prefixeGUI + "BTN_PROCHAIN")
      {
         AllerAuProchainNonCapture();
      }
      else if(sparam == g_prefixeGUI + "BTN_CAPTURE")
      {
         PrendreCaptureManuelle();
      }
      else if(sparam == g_prefixeGUI + "BTN_RECADRER")
      {
         RecadrerSurTradeActuel();
      }
      else if(sparam == g_prefixeGUI + "BTN_NIVEAUX")
      {
         ToggleNiveaux();
      }
      else if(sparam == g_prefixeGUI + "BTN_TF_M1")  ChangerTimeframe("M1");
      else if(sparam == g_prefixeGUI + "BTN_TF_M5")  ChangerTimeframe("M5");
      else if(sparam == g_prefixeGUI + "BTN_TF_M15") ChangerTimeframe("M15");
      else if(sparam == g_prefixeGUI + "BTN_TF_M30") ChangerTimeframe("M30");
      else if(sparam == g_prefixeGUI + "BTN_TF_H1")  ChangerTimeframe("H1");
      else if(sparam == g_prefixeGUI + "BTN_TF_H4")  ChangerTimeframe("H4");
      else if(sparam == g_prefixeGUI + "BTN_TF_D1")  ChangerTimeframe("D1");

      // Remet le bouton dans l'état non-enfoncé
      ObjectSetInteger(0, sparam, OBJPROP_STATE, false);
      ChartRedraw(0);
   }

   // ─── 2. Raccourcis Clavier ──────────────────────────────────────
   if(id == CHARTEVENT_KEYDOWN)
   {
      // Touche ESPACE (32) : Prendre la photo
      if(lparam == 32)
      {
         PrendreCaptureManuelle();
      }
      // Flèche Droite (39) : Trade suivant
      else if(lparam == 39)
      {
         if(g_indexActuel < g_totalTrades - 1)
            NaviguerVersTrade(g_indexActuel + 1);
      }
      // Flèche Gauche (37) : Trade précédent
      else if(lparam == 37)
      {
         if(g_indexActuel > 0)
            NaviguerVersTrade(g_indexActuel - 1);
      }
   }
}
//+------------------------------------------------------------------+
