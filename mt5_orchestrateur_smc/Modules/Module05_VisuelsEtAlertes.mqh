//+------------------------------------------------------------------+
//|                                     Module05_VisuelsEtAlertes.mqh|
//|              🎼 Chef d'Orchestre SMC - Version MetaTrader 5       |
//|     BLOC 5 : Rendu Graphique MT5, Collines Diag & Alertes        |
//+------------------------------------------------------------------+
#property copyright "JournalMobileAPK - Orchestrateur SMC MT5"
#property strict

#ifndef MODULE_05_VISUELS_ET_ALERTES_MQH
#define MODULE_05_VISUELS_ET_ALERTES_MQH

#include "Module00_TypesEtOutils.mqh"

#define PREFIXE_OBJETS_SMC "SMC_ORCH_"

/**
 * Supprime tous les objets graphiques créés par l'indicateur sur le graphique MT5.
 */
void SupprimerTousObjetsSMC()
{
   ObjectsDeleteAll(0, PREFIXE_OBJETS_SMC);
}

/**
 * Crée un segment de ligne (OBJ_TREND) borné entre deux dates et deux prix sur MT5.
 */
void CreerSegmentLigneMT5(
   string nomObjet,
   datetime date1,
   double prix1,
   datetime date2,
   double prix2,
   color couleur,
   int epaisseur,
   ENUM_LINE_STYLE styleLigne,
   string infoBulle = ""
)
{
   if(ObjectFind(0, nomObjet) >= 0)
      ObjectDelete(0, nomObjet);

   if(!ObjectCreate(0, nomObjet, OBJ_TREND, 0, date1, prix1, date2, prix2))
      return;

   ObjectSetInteger(0, nomObjet, OBJPROP_COLOR, couleur);
   ObjectSetInteger(0, nomObjet, OBJPROP_WIDTH, epaisseur);
   ObjectSetInteger(0, nomObjet, OBJPROP_STYLE, styleLigne);
   ObjectSetInteger(0, nomObjet, OBJPROP_RAY_RIGHT, false);
   ObjectSetInteger(0, nomObjet, OBJPROP_RAY_LEFT, false);
   ObjectSetInteger(0, nomObjet, OBJPROP_BACK, false);
   ObjectSetInteger(0, nomObjet, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, nomObjet, OBJPROP_HIDDEN, true);
   if(infoBulle != "")
      ObjectSetString(0, nomObjet, OBJPROP_TOOLTIP, infoBulle);
}

/**
 * Crée un texte ancré à une coordonnée (temps, prix) sur le graphique MT5 (OBJ_TEXT).
 */
void CreerTexteAncreMT5(
   string nomObjet,
   datetime dateAncre,
   double prixAncre,
   string texte,
   color couleur,
   int taillePolice = 8,
   ENUM_ANCHOR_POINT ancrage = ANCHOR_LEFT_LOWER
)
{
   if(ObjectFind(0, nomObjet) >= 0)
      ObjectDelete(0, nomObjet);

   if(!ObjectCreate(0, nomObjet, OBJ_TEXT, 0, dateAncre, prixAncre))
      return;

   ObjectSetString(0, nomObjet, OBJPROP_TEXT, texte);
   ObjectSetString(0, nomObjet, OBJPROP_FONT, "Segoe UI Semibold");
   ObjectSetInteger(0, nomObjet, OBJPROP_FONTSIZE, taillePolice);
   ObjectSetInteger(0, nomObjet, OBJPROP_COLOR, couleur);
   ObjectSetInteger(0, nomObjet, OBJPROP_ANCHOR, ancrage);
   ObjectSetInteger(0, nomObjet, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, nomObjet, OBJPROP_HIDDEN, true);
}

/**
 * Crée un point discret (cercle Wingdings 159) sur une coordonnée (temps, prix).
 */
void CreerPointGraphiqueMT5(
   string nomObjet,
   datetime datePoint,
   double prixPoint,
   color couleur,
   int largeur = 2,
   string infoBulle = ""
)
{
   if(ObjectFind(0, nomObjet) >= 0)
      ObjectDelete(0, nomObjet);

   if(!ObjectCreate(0, nomObjet, OBJ_ARROW, 0, datePoint, prixPoint))
      return;

   ObjectSetInteger(0, nomObjet, OBJPROP_ARROWCODE, 159);
   ObjectSetInteger(0, nomObjet, OBJPROP_COLOR, couleur);
   ObjectSetInteger(0, nomObjet, OBJPROP_WIDTH, largeur);
   ObjectSetInteger(0, nomObjet, OBJPROP_ANCHOR, ANCHOR_CENTER);
   ObjectSetInteger(0, nomObjet, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, nomObjet, OBJPROP_HIDDEN, true);
   if(infoBulle != "")
      ObjectSetString(0, nomObjet, OBJPROP_TOOLTIP, infoBulle);
}

/**
 * 🎨 Dessine un setup complet sur le graphique MetaTrader 5 :
 *  - Point Doji + Badge de carburant & ZigZag dynamique
 *  - Niveau S/R Shved retenu avec son score
 *  - Micro-segments SL, Entrée, Paliers UOP et TP Optimal (avec ratio R:R)
 *  - En option : Collines de retest validées (⛰️) et Micro-rebonds ignorés (⚪) + Vagues ZigZag
 */
void DessinerSetupOrchestreMT5(
   const SetupOrchestreSMC_MT5 &setup,
   const BougieSMC &bougies[],
   int totalBougies,
   int dureeSegmentsCibles,
   bool afficherPointDoji,
   bool afficherPointsLiquidation,
   bool afficherSegmentSR,
   bool afficherPaliersUOP,
   bool afficherSegmentSL,
   bool afficherSegmentTP,
   bool afficherDiagnosticCollines,
   color couleurAchat,
   color couleurVente
)
{
   bool estAchat     = (setup.type == DIRECTION_ACHAT);
   color couleurBase = estAchat ? couleurAchat : couleurVente;
   string baseId     = PREFIXE_OBJETS_SMC + "S" + IntegerToString(setup.indexDoji) + "_";

   int secondesParBougie = MathMax(60, PeriodSeconds(_Period));
   int indexFinCible     = MathMin(totalBougies - 1, setup.indexDoji + MathMax(1, dureeSegmentsCibles));
   datetime dateFinCible = bougies[indexFinCible].temps;
   if(dateFinCible <= setup.tempsDoji)
      dateFinCible = setup.tempsDoji + (datetime)(secondesParBougie * MathMax(1, dureeSegmentsCibles));

   // 1️⃣ Point sur l'extrême de la mèche du Doji + Badge de liquidation & ZigZag
   if(afficherPointDoji)
   {
      string infoDoji = StringFormat(
         "Setup %s #%d | Score Liq: %d/100 -> ZigZag Depth: %d | Carburant: %d pts",
         estAchat ? "ACHAT" : "VENTE",
         setup.indexDoji,
         setup.scoreZigZag.scoreTotal,
         setup.scoreZigZag.zigzagDepthRetenu,
         setup.carburantInitial
      );
      CreerPointGraphiqueMT5(baseId + "PT_DOJI", setup.tempsDoji, setup.prixSL, couleurBase, 3, infoDoji);
   }

   if(afficherPointsLiquidation)
   {
      string txtLiq = StringFormat(
         "⚡ %dpts • ZZ:%d [%d/100]",
         setup.carburantInitial,
         setup.scoreZigZag.zigzagDepthRetenu,
         setup.scoreZigZag.scoreTotal
      );
      ENUM_ANCHOR_POINT ancreLiq = estAchat ? ANCHOR_LEFT_UPPER : ANCHOR_LEFT_LOWER;
      CreerTexteAncreMT5(baseId + "TXT_LIQ", setup.tempsDoji, setup.prixSL, txtLiq, clrGold, 8, ancreLiq);
   }

   // 2️⃣ Segment discontinu du Support ou de la Résistance Shved retenu
   if(afficherSegmentSR && setup.aMeilleureZone)
   {
      ZoneShvedScoreeSMC z = setup.meilleureZone;
      datetime debutSR     = (z.zone.dateDebut < setup.tempsDebutPlage) ? setup.tempsDebutPlage : z.zone.dateDebut;
      datetime finSR       = setup.tempsDoji;

      string infoSR = StringFormat(
         "%s Shved [%d/100 pts] | %d vraies collines (%d pts) | %d micro-rebonds ignorés",
         estAchat ? "Support" : "Résistance",
         z.score,
         z.nbCollines,
         z.pointsRetests,
         z.nbTouchesIgnorees
      );

      CreerSegmentLigneMT5(
         baseId + "LIGNE_SR",
         debutSR, z.zone.prixMedian,
         finSR,   z.zone.prixMedian,
         couleurBase, 2, STYLE_DASH, infoSR
      );

      string labelSR = StringFormat(
         "%s [%d pts • %d⛰️]",
         estAchat ? "Sup" : "Res",
         z.score,
         z.nbCollines
      );
      CreerTexteAncreMT5(baseId + "TXT_SR", debutSR, z.zone.prixMedian, labelSR, couleurBase, 8, ANCHOR_LEFT_LOWER);

      // ⛰️ 2.B Diagnostic visuel sur le graphique des Collines de Retests & Micro-rebonds ignorés
      if(afficherDiagnosticCollines)
      {
         for(int c = 0; c < z.nbCollines; c++)
         {
            DetailCollineRetestSMC col = z.collines[c];
            string idCol = baseId + "COL_" + IntegerToString(c) + "_";

            color coulCol = clrDeepSkyBlue;
            if(col.qualite == COLLINE_MAJEURE)
               coulCol = clrGold;
            else if(col.qualite == COLLINE_SOLIDE)
               coulCol = clrSpringGreen;

            // Arche de montée vers le sommet de la colline
            CreerSegmentLigneMT5(
               idCol + "MONTEE",
               col.tempsTouchePrecedente, z.zone.prixMedian,
               col.tempsSommetColline,    col.prixSommetColline,
               coulCol, 1, STYLE_DOT
            );
            // Arche de redescente vers la bougie de retest
            CreerSegmentLigneMT5(
               idCol + "DESCENTE",
               col.tempsSommetColline, col.prixSommetColline,
               col.tempsToucheRetest,  z.zone.prixMedian,
               coulCol, 1, STYLE_DOT
            );
            // Point sur la bougie de retest
            CreerPointGraphiqueMT5(idCol + "PT_RETEST", col.tempsToucheRetest, z.zone.prixMedian, coulCol, 2);

            string txtCol = StringFormat(
               "⛰️ R#%d: %.1fx ATR (%db) [+%dpts]",
               col.numeroRetest,
               col.ratioCollineATR,
               col.largeurBougies,
               col.pointsAttribues
            );
            ENUM_ANCHOR_POINT ancreCol = estAchat ? ANCHOR_LOWER : ANCHOR_UPPER;
            CreerTexteAncreMT5(idCol + "TXT", col.tempsSommetColline, col.prixSommetColline, txtCol, coulCol, 8, ancreCol);
         }

         // Affichage des micro-rebonds ignorés (limité aux 4 derniers)
         int debutIgn = MathMax(0, z.nbTouchesIgnorees - 4);
         for(int ig = debutIgn; ig < z.nbTouchesIgnorees; ig++)
         {
            DetailToucheIgnoreeSMC tIgn = z.touchesIgnorees[ig];
            string idIgn = baseId + "IGN_" + IntegerToString(ig) + "_";
            CreerPointGraphiqueMT5(idIgn + "PT", tIgn.temps, tIgn.prix, clrSlateGray, 1);
            string txtIgn = StringFormat("⚪ Ignoré (%.1fx ATR)", tIgn.ratioCollineATR);
            CreerTexteAncreMT5(idIgn + "TXT", tIgn.temps, tIgn.prix, txtIgn, clrSlateGray, 7, estAchat ? ANCHOR_UPPER : ANCHOR_LOWER);
         }
      }
   }

   // 🌊 2.C En mode diagnostic, tracé des vagues du ZigZag Dynamique retenu
   if(afficherDiagnosticCollines && setup.scoreZigZag.nbPivots >= 2)
   {
      for(int p = 1; p < setup.scoreZigZag.nbPivots; p++)
      {
         PivotZigZagSMC p1 = setup.scoreZigZag.pivots[p - 1];
         PivotZigZagSMC p2 = setup.scoreZigZag.pivots[p];
         CreerSegmentLigneMT5(
            baseId + "ZZ_" + IntegerToString(p),
            p1.temps, p1.prix,
            p2.temps, p2.prix,
            clrMediumOrchid, 1, STYLE_DASH
         );
      }
   }

   // 3️⃣ Micro-segment du Stop Loss (SL)
   if(afficherSegmentSL)
   {
      CreerSegmentLigneMT5(
         baseId + "SL",
         setup.tempsDoji, setup.prixSL,
         dateFinCible,    setup.prixSL,
         clrCrimson, 2, STYLE_DASH
      );
      CreerTexteAncreMT5(
         baseId + "TXT_SL",
         dateFinCible, setup.prixSL,
         " 🛑 SL " + FormaterPrixSymbole(setup.prixSL),
         clrCrimson, 8, ANCHOR_LEFT
      );
   }

   // 4️⃣ Micro-segments des Paliers UOP intermédiaires
   if(afficherPaliersUOP && setup.nbPaliersUOP > 0)
   {
      for(int p = 0; p < setup.nbPaliersUOP; p++)
      {
         PalierUOPCandidatSMC pal = setup.paliersUOP[p];
         color coulPal = pal.estBloquant ? clrOrange : clrDodgerBlue;
         string idPal  = baseId + "PAL_" + IntegerToString(p);

         CreerSegmentLigneMT5(
            idPal,
            setup.tempsDoji, pal.prixCible,
            dateFinCible,    pal.prixCible,
            coulPal, 1, STYLE_DOT
         );

         string txtPal = StringFormat(" P%d [%.1fx]", pal.ordre, pal.tauxMoyenChevauchement);
         CreerTexteAncreMT5(idPal + "_TXT", dateFinCible, pal.prixCible, txtPal, coulPal, 7, ANCHOR_LEFT);
      }
   }

   // 5️⃣ Micro-segment du Take Profit Optimal (TP)
   if(afficherSegmentTP && setup.prixTP > 0.0)
   {
      CreerSegmentLigneMT5(
         baseId + "TP",
         setup.tempsDoji, setup.prixTP,
         dateFinCible,    setup.prixTP,
         clrSpringGreen, 2, STYLE_SOLID
      );

      string labelTP = StringFormat(
         " 🎯 TP%d %s (%.2fR)",
         setup.ordreTP,
         FormaterPrixSymbole(setup.prixTP),
         setup.ratioRR
      );
      CreerTexteAncreMT5(
         baseId + "TXT_TP",
         dateFinCible, setup.prixTP,
         labelTP,
         clrSpringGreen, 9, ANCHOR_LEFT
      );

      // Ligne d'entrée discrète
      CreerSegmentLigneMT5(
         baseId + "ENTREE",
         setup.tempsDoji, setup.prixEntree,
         dateFinCible,    setup.prixEntree,
         clrSilver, 1, STYLE_DOT
      );
   }
}

/**
 * 🖥️ Affiche un cartouche HUD discret en haut à gauche du graphique MetaTrader 5
 * pour indiquer que l'indicateur surveille le marché et résumer les setups actifs.
 */
void DessinerPanneauHUD_MT5(
   int totalConfirmes,
   int totalActifs,
   int totalEnAttente3Bougies,
   int totalTPTouches,
   int totalSLTouches,
   bool aDernierSetupActif,
   const SetupOrchestreSMC_MT5 &dernierSetup
)
{
   string nomFond  = PREFIXE_OBJETS_SMC + "HUD_BG";
   string nomL1    = PREFIXE_OBJETS_SMC + "HUD_L1";
   string nomL2    = PREFIXE_OBJETS_SMC + "HUD_L2";
   string nomL3    = PREFIXE_OBJETS_SMC + "HUD_L3";

   if(ObjectFind(0, nomFond) < 0)
      ObjectCreate(0, nomFond, OBJ_RECTANGLE_LABEL, 0, 0, 0);

   ObjectSetInteger(0, nomFond, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(0, nomFond, OBJPROP_XDISTANCE, 12);
   ObjectSetInteger(0, nomFond, OBJPROP_YDISTANCE, 24);
   ObjectSetInteger(0, nomFond, OBJPROP_XSIZE, 540);
   ObjectSetInteger(0, nomFond, OBJPROP_YSIZE, 68);
   ObjectSetInteger(0, nomFond, OBJPROP_BGCOLOR, C'15,23,42');
   ObjectSetInteger(0, nomFond, OBJPROP_BORDER_TYPE, BORDER_FLAT);
   ObjectSetInteger(0, nomFond, OBJPROP_COLOR, C'56,189,248');
   ObjectSetInteger(0, nomFond, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, nomFond, OBJPROP_HIDDEN, true);

   int totalTermines = totalTPTouches + totalSLTouches;
   double winrate    = (totalTermines > 0) ? ((double)totalTPTouches * 100.0 / (double)totalTermines) : 0.0;

   string texteL1 = StringFormat(
      "🎼 ORCHESTRATEUR SMC MT5 (%s • %s) | Actifs: %d | En attente (3b): %d",
      _Symbol, EnumToString(_Period), totalActifs, totalEnAttente3Bougies
   );
   string texteL2 = StringFormat(
      "📊 Historique : %d Confirmés | ✅ TP: %d | 🛑 SL: %d | Winrate: %.1f%%",
      totalConfirmes, totalTPTouches, totalSLTouches, winrate
   );
   string texteL3 = "👀 En veille : alerte envoyée dès qu'un setup valide ses 3 bougies de confirmation.";

   if(aDernierSetupActif)
   {
      texteL3 = StringFormat(
         "🔥 SETUP ACTIF [%s] : Entrée %s | SL %s | TP%d %s (%.2fR) | S/R %dpts | ZZ:%d",
         (dernierSetup.type == DIRECTION_ACHAT) ? "ACHAT" : "VENTE",
         FormaterPrixSymbole(dernierSetup.prixEntree),
         FormaterPrixSymbole(dernierSetup.prixSL),
         dernierSetup.ordreTP,
         FormaterPrixSymbole(dernierSetup.prixTP),
         dernierSetup.ratioRR,
         dernierSetup.scoreShved,
         dernierSetup.scoreZigZag.zigzagDepthRetenu
      );
   }

   string noms[3]   = { nomL1, nomL2, nomL3 };
   string textes[3] = { texteL1, texteL2, texteL3 };
   color couleurs[3]= { C'56,189,248', C'203,213,225', aDernierSetupActif ? clrSpringGreen : clrGold };
   int tailles[3]   = { 9, 8, 8 };

   for(int i = 0; i < 3; i++)
   {
      if(ObjectFind(0, noms[i]) < 0)
         ObjectCreate(0, noms[i], OBJ_LABEL, 0, 0, 0);

      ObjectSetInteger(0, noms[i], OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(0, noms[i], OBJPROP_XDISTANCE, 22);
      ObjectSetInteger(0, noms[i], OBJPROP_YDISTANCE, 30 + i * 19);
      ObjectSetString(0, noms[i], OBJPROP_FONT, "Segoe UI Semibold");
      ObjectSetInteger(0, noms[i], OBJPROP_FONTSIZE, tailles[i]);
      ObjectSetInteger(0, noms[i], OBJPROP_COLOR, couleurs[i]);
      ObjectSetString(0, noms[i], OBJPROP_TEXT, textes[i]);
      ObjectSetInteger(0, noms[i], OBJPROP_SELECTABLE, false);
      ObjectSetInteger(0, noms[i], OBJPROP_HIDDEN, true);
   }
}

/**
 * 🔔 Déclenche l'alerte MetaTrader 5 UNIQUEMENT lorsqu'un setup vient d'être 100% CONFIRMÉ
 * (c'est-à-dire juste après la clôture de la N-ième bougie de confirmation qui a respecté le SL).
 *
 * Canaux supportés :
 *  - Fenêtre Popup MT5 (`Alert`)
 *  - Son (`PlaySound`)
 *  - Notification Push vers l'application mobile MT5 (`SendNotification`)
 *  - Email (`SendMail`)
 */
void DeclencherAlerteSetupConfirmeMT5(
   const SetupOrchestreSMC_MT5 &setup,
   bool activerAlertePopup,
   bool activerAlerteSon,
   string fichierSon,
   bool activerNotificationPushMobile,
   bool activerAlerteEmail,
   datetime &dernierTempsConfirmationAlerte
)
{
   // Sécurité anti-doublon : on n'alerte qu'une seule fois par bougie de confirmation
   if(setup.tempsConfirmation <= dernierTempsConfirmationAlerte)
      return;

   dernierTempsConfirmationAlerte = setup.tempsConfirmation;

   string directionTxt = (setup.type == DIRECTION_ACHAT) ? "🟢 ACHAT (Spring)" : "🔴 VENTE (UTAD)";
   int nbCollines      = setup.aMeilleureZone ? setup.meilleureZone.nbCollines : 0;

   string messageAlerte = StringFormat(
      "🚨 [SMC CONFIRMÉ - 3 BOUGIES OK] %s sur %s (%s) ! Entrée: %s | SL: %s | TP%d: %s (%.2fR) | Score S/R: %d/100 (%d collines) | Score Liq: %d/100 (ZZ:%d)",
      directionTxt,
      _Symbol,
      EnumToString(_Period),
      FormaterPrixSymbole(setup.prixEntree),
      FormaterPrixSymbole(setup.prixSL),
      setup.ordreTP,
      FormaterPrixSymbole(setup.prixTP),
      setup.ratioRR,
      setup.scoreShved,
      nbCollines,
      setup.scoreZigZag.scoreTotal,
      setup.scoreZigZag.zigzagDepthRetenu
   );

   Print("✅ ", messageAlerte);

   // 1️⃣ Fenêtre Popup MetaTrader 5
   if(activerAlertePopup)
   {
      Alert(messageAlerte);
   }
   else if(activerAlerteSon && fichierSon != "")
   {
      // Si la popup est désactivée mais que le son seul est activé
      PlaySound(fichierSon);
   }

   // 2️⃣ Notification Push sur le téléphone mobile (Application MetaTrader 5 iOS / Android)
   if(activerNotificationPushMobile)
   {
      if(!SendNotification(messageAlerte))
      {
         Print("⚠️ [SMC MT5] Échec d'envoi de la notification Push mobile (vérifiez MetaQuotes ID dans Outils > Options > Notifications).");
      }
   }

   // 3️⃣ Envoi d'un Email
   if(activerAlerteEmail)
   {
      string sujetEmail = StringFormat("[SMC MT5] Setup %s Confirmé sur %s (%s)", (setup.type == DIRECTION_ACHAT) ? "ACHAT" : "VENTE", _Symbol, EnumToString(_Period));
      SendMail(sujetEmail, messageAlerte);
   }
}

/**
 * 🎨 Applique automatiquement le thème visuel exact de TradingView (Dark Mode) au graphique MT5 :
 * - Fond : #131722 (Bleu nuit TradingView)
 * - Bougies Haussières (Corps + Mèches) : #26A69A (Vert Teal TradingView)
 * - Bougies Baissières (Corps + Mèches) : #EF5350 (Rouge Corail TradingView)
 * - Grille et Volumes : Masqués pour une lecture 100% pure des bougies
 * - Décalage à droite (Chart Shift) : Activé (18%) avec Zoom optimal (échelle 3)
 *
 * Exemple :
 * AppliquerThemeTradingViewMT5(0);
 */
void AppliquerThemeTradingViewMT5(long chartId = 0)
{
   // 1️⃣ Mode Bougies Japonaises + Zoom lisible + Espace à droite comme sur TradingView
   ChartSetInteger(chartId, CHART_MODE, CHART_CANDLES);
   ChartSetInteger(chartId, CHART_SCALE, 3);
   ChartSetInteger(chartId, CHART_AUTOSCROLL, true);
   ChartSetInteger(chartId, CHART_SHIFT, true);
   ChartSetDouble(chartId,  CHART_SHIFT_SIZE, 18.0);

   // 2️⃣ Masquer la grille, les volumes, les séparateurs de période et la ligne Ask
   ChartSetInteger(chartId, CHART_SHOW_GRID, false);
   ChartSetInteger(chartId, CHART_SHOW_VOLUMES, CHART_VOLUME_HIDE);
   ChartSetInteger(chartId, CHART_SHOW_PERIOD_SEP, false);
   ChartSetInteger(chartId, CHART_SHOW_ASK_LINE, false);
   ChartSetInteger(chartId, CHART_SHOW_OHLC, true);

   // 3️⃣ Palette officielle TradingView Dark (#131722, #B2B5BE, #26A69A, #EF5350)
   ChartSetInteger(chartId, CHART_COLOR_BACKGROUND, C'19,23,34');     // Fond #131722
   ChartSetInteger(chartId, CHART_COLOR_FOREGROUND, C'178,181,190');  // Axes #B2B5BE
   ChartSetInteger(chartId, CHART_COLOR_GRID,       C'30,34,45');     // Grille #1E222D

   // Bougies Haussières (Corps + Mèches) : Vert TradingView #26A69A
   ChartSetInteger(chartId, CHART_COLOR_CANDLE_BULL, C'38,166,154');  // #26A69A
   ChartSetInteger(chartId, CHART_COLOR_CHART_UP,    C'38,166,154');  // #26A69A

   // Bougies Baissières (Corps + Mèches) : Rouge TradingView #EF5350
   ChartSetInteger(chartId, CHART_COLOR_CANDLE_BEAR, C'239,83,80');   // #EF5350
   ChartSetInteger(chartId, CHART_COLOR_CHART_DOWN,  C'239,83,80');   // #EF5350

   // Bougies Doji parfaites (Open == Close) : Gris clair TradingView
   ChartSetInteger(chartId, CHART_COLOR_CHART_LINE,  C'178,181,190');

   // Ligne du prix actuel (Bid) discrète
   ChartSetInteger(chartId, CHART_COLOR_BID,         C'93,96,107');
}

/**
 * 📸 Prend une capture d'écran HD (PNG) du graphique MetaTrader 5 en style TradingView pur
 * (bougies seules sans indicateurs par-dessus) et prépare la fiche dans `MQL5/Files/AlertesTelegram/`.
 *
 * Exemple :
 * ExporterCaptureEtLegendeTelegramSMC("XAUUSD", "H1", setup, 1600, 900);
 */
bool ExporterCaptureEtLegendeTelegramSMC(
   string symbole,
   string nomPeriode,
   const SetupOrchestreSMC_MT5 &setup,
   int largeurPx = 1600,
   int hauteurPx = 900
)
{
   FolderCreate("AlertesTelegram");

   // 1️⃣ Appliquer le style TradingView et s'assurer que le graphique est 100% propre (juste les bougies)
   AppliquerThemeTradingViewMT5(0);
   SupprimerTousObjetsSMC();
   ObjectsDeleteAll(0, "SMC_GARDIEN_DEMO_");
   ChartRedraw(0);

   string horodatageId = IntegerToString((long)TimeLocal()) + "_" + IntegerToString((int)(GetTickCount() % 10000));
   string symPropre    = symbole;
   StringReplace(symPropre, ".", "_");
   StringReplace(symPropre, "/", "_");

   string baseNom   = "AlertesTelegram\\SMC_" + symPropre + "_" + nomPeriode + "_" + horodatageId;
   string fichierPng = baseNom + ".png";
   string fichierTxt = baseNom + ".txt";

   // 2️⃣ Capture d'écran HD du graphique (alignée sur les dernières bougies à droite)
   if(!ChartScreenShot(0, fichierPng, largeurPx, hauteurPx, ALIGN_RIGHT))
   {
      Print("⚠️ [Telegram SMC] Échec de ChartScreenShot pour ", symbole, " ", nomPeriode);
      return false;
   }

   // 3️⃣ Construction de la légende détaillée pour Telegram
   int digitsSym       = (int)SymbolInfoInteger(symbole, SYMBOL_DIGITS);
   string directionTxt = (setup.type == DIRECTION_ACHAT) ? "🟢 ACHAT (Spring)" : "🔴 VENTE (UTAD)";
   int nbCollines      = setup.aMeilleureZone ? setup.meilleureZone.nbCollines : 0;
   int nbTouchesIgn    = setup.aMeilleureZone ? setup.meilleureZone.nbTouchesIgnorees : 0;

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
      symbole,
      nomPeriode,
      directionTxt,
      DoubleToString(setup.prixEntree, digitsSym),
      DoubleToString(setup.prixSL, digitsSym),
      setup.ordreTP,
      DoubleToString(setup.prixTP, digitsSym),
      setup.ratioRR,
      setup.scoreShved,
      nbCollines,
      nbTouchesIgn,
      setup.scoreZigZag.scoreTotal,
      setup.scoreZigZag.zigzagDepthRetenu,
      setup.carburantInitial,
      setup.carburantRestant,
      TimeToString(setup.tempsConfirmation, TIME_DATE | TIME_MINUTES)
   );

   int hTxt = FileOpen(fichierTxt, FILE_WRITE | FILE_TXT | FILE_ANSI, 0, CP_UTF8);
   if(hTxt == INVALID_HANDLE)
   {
      Print("⚠️ [Telegram SMC] Impossible d'écrire la légende Telegram : ", fichierTxt);
      return false;
   }
   FileWriteString(hTxt, legende);
   FileClose(hTxt);

   Print("📸 [Telegram SMC] Capture HD enregistrée et prête pour envoi Telegram : ", fichierPng);
   return true;
}

/**
 * 📸 Prend une capture d'écran de test du graphique actuel pour vérifier la réception sur Telegram en 1 clic.
 */
bool ExporterCaptureTestTelegramSMC(int nbSymbolesSurveilles, int nbSlotsTotal, int largeurPx = 1600, int hauteurPx = 900)
{
   FolderCreate("AlertesTelegram");
   AppliquerThemeTradingViewMT5(0);
   SupprimerTousObjetsSMC();
   ObjectsDeleteAll(0, "SMC_GARDIEN_DEMO_");
   ChartRedraw(0);

   string horodatageId = IntegerToString((long)TimeLocal()) + "_" + IntegerToString((int)(GetTickCount() % 10000));
   string baseNom      = "AlertesTelegram\\TEST_SMC_" + horodatageId;
   string fichierPng   = baseNom + ".png";
   string fichierTxt   = baseNom + ".txt";

   if(!ChartScreenShot(0, fichierPng, largeurPx, hauteurPx, ALIGN_RIGHT))
      return false;

   string legende = StringFormat(
      "✅ TEST CAPTURE HD — SCANNER SMC FTMO\n"
      "━━━━━━━━━━━━━━━━━━━━\n"
      "📊 Graphique affiché : %s (%s)\n"
      "📡 Surveillance active : %d Symboles FTMO (%d Slots)\n"
      "🖼️ Dès qu'un setup validera ses 3 bougies de confirmation, le graphique basculera automatiquement dessus, tracera les zones S/R, les collines ⛰️, le ZigZag et le TP, puis t'enverra cette capture HD ici !",
      _Symbol,
      EnumToString(_Period),
      nbSymbolesSurveilles,
      nbSlotsTotal
   );

   int hTxt = FileOpen(fichierTxt, FILE_WRITE | FILE_TXT | FILE_ANSI, 0, CP_UTF8);
   if(hTxt == INVALID_HANDLE)
      return false;

   FileWriteString(hTxt, legende);
   FileClose(hTxt);
   Print("📸 [Telegram SMC] Capture de test générée : ", fichierPng);
   return true;
}

#endif // MODULE_05_VISUELS_ET_ALERTES_MQH
//+------------------------------------------------------------------+

