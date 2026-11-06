//+------------------------------------------------------------------+
//|                                   Module03_ZigZagDynamiqueUOP.mqh|
//|              🎼 Chef d'Orchestre SMC - Version MetaTrader 5       |
//|  BLOC 3 : Score Liquidation, ZigZag Dynamique (4-20) & Profil UOP|
//+------------------------------------------------------------------+
#property copyright "JournalMobileAPK - Orchestrateur SMC MT5"
#property strict

#ifndef MODULE_03_ZIGZAG_DYNAMIQUE_UOP_MQH
#define MODULE_03_ZIGZAG_DYNAMIQUE_UOP_MQH

#include "Module00_TypesEtOutils.mqh"

#define NOMBRE_TRANCHES_UOP 60

/**
 * 🌊 Calcule le Score d'Ampleur de Liquidation (sur 100 points) pour régler dynamiquement
 * la taille des vagues ZigZag (`zigzagDepthRetenu` entre `zigzagDepthMin=4` et `zigzagDepthMax=20`).
 *
 * Barème sur 100 points :
 *   1️⃣ Pilier 1 — Profondeur de la cassure au-delà du S/R (sur 40 points)
 *   2️⃣ Pilier 2 — Taille de la bougie de liquidation + Épaisseur du S/R (sur 30 points)
 *   3️⃣ Pilier 3 — Retests pondérés par la taille de leurs collines (sur 30 points)
 */
void CalculerScoreLiquidationZigZagSMC(
   double profondeurMeche,
   double hauteurMoyenneATR,
   double amplitudeBougieSweep,
   double epaisseurZoneSR,
   bool aZoneScoree,
   const ZoneShvedScoreeSMC &zoneScoree,
   int zigzagDepthMin,
   int zigzagDepthMax,
   DetailsScoreLiquidationZigZagSMC &sortieScoreZZ
)
{
   double atrSecurise = MathMax(_Point, hauteurMoyenneATR);
   int depthMin       = MathMax(2, zigzagDepthMin);
   int depthMax       = MathMax(depthMin + 1, zigzagDepthMax);
   int nbRetests      = aZoneScoree ? zoneScoree.nbCollines : 0;

   double ratioProfondeurATR    = NormalizeDouble(MathMax(0.0, profondeurMeche) / atrSecurise, 2);
   double ratioTailleBougieATR  = NormalizeDouble(MathMax(0.0, amplitudeBougieSweep) / atrSecurise, 2);
   double ratioEpaisseurZoneATR = NormalizeDouble(MathMax(0.0, epaisseurZoneSR) / atrSecurise, 2);

   // 1️⃣ PILIER 1 : Profondeur de la cassure au-delà du S/R (sur 40 points max)
   int pointsProfondeurCassure = 5;
   if(ratioProfondeurATR >= 1.2)
      pointsProfondeurCassure = 40;
   else if(ratioProfondeurATR >= 0.8)
      pointsProfondeurCassure = 34;
   else if(ratioProfondeurATR >= 0.5)
      pointsProfondeurCassure = 26;
   else if(ratioProfondeurATR >= 0.3)
      pointsProfondeurCassure = 18;
   else if(ratioProfondeurATR >= 0.1)
      pointsProfondeurCassure = 10;
   else
      pointsProfondeurCassure = 5;

   // 2️⃣ PILIER 2 : Taille de la bougie de liquidation (20 pts) + Épaisseur S/R (10 pts) = 30 pts max
   int pointsBougie = 5;
   if(ratioTailleBougieATR >= 2.0)
      pointsBougie = 20;
   else if(ratioTailleBougieATR >= 1.4)
      pointsBougie = 15;
   else if(ratioTailleBougieATR >= 1.0)
      pointsBougie = 10;
   else
      pointsBougie = 5;

   int pointsZoneSR = 2;
   if(ratioEpaisseurZoneATR >= 0.8)
      pointsZoneSR = 10;
   else if(ratioEpaisseurZoneATR >= 0.4)
      pointsZoneSR = 7;
   else if(ratioEpaisseurZoneATR > 0.0)
      pointsZoneSR = 4;
   else
      pointsZoneSR = 2;

   int pointsTailleBougieEtZone = MathMin(30, pointsBougie + pointsZoneSR);

   // 3️⃣ PILIER 3 : Retests pondérés par la taille de leur colline (sur 30 points max)
   int pointsRetestsSR = 5;
   if(aZoneScoree && zoneScoree.nbCollines > 0)
   {
      int sommePtsCollines = 0;
      for(int c = 0; c < zoneScoree.nbCollines; c++)
         sommePtsCollines += zoneScoree.collines[c].pointsAttribues;
      pointsRetestsSR = MathMin(30, 5 + sommePtsCollines);
   }

   // 4️⃣ Score Total sur 100 et Conversion en Profondeur ZigZag Dynamique (4 à 20)
   int scoreTotal = MathMin(100, MathMax(0, pointsProfondeurCassure + pointsTailleBougieEtZone + pointsRetestsSR));
   int zigzagDepthRetenu = (int)MathRound((double)depthMin + ((double)scoreTotal / 100.0) * (double)(depthMax - depthMin));

   sortieScoreZZ.scoreTotal               = scoreTotal;
   sortieScoreZZ.pointsProfondeurCassure  = pointsProfondeurCassure;
   sortieScoreZZ.pointsTailleBougieEtZone = pointsTailleBougieEtZone;
   sortieScoreZZ.pointsRetestsSR          = pointsRetestsSR;
   sortieScoreZZ.ratioProfondeurATR       = ratioProfondeurATR;
   sortieScoreZZ.ratioTailleBougieATR     = ratioTailleBougieATR;
   sortieScoreZZ.ratioEpaisseurZoneATR    = ratioEpaisseurZoneATR;
   sortieScoreZZ.nombreRetests            = nbRetests;
   sortieScoreZZ.zigzagDepthRetenu        = zigzagDepthRetenu;
   sortieScoreZZ.nbPivots                 = 0;
}

/**
 * Détecte les pivots ZigZag alternés (Haut / Bas) sur la plage [0 .. indexFin]
 * selon la profondeur dynamique zigzagDepth.
 */
int CalculerPivotsZigZagSMC(
   const BougieSMC &bougies[],
   int indexFin,
   int zigzagDepth,
   PivotZigZagSMC &pivotsSortie[]
)
{
   ArrayResize(pivotsSortie, 0);
   int depth = MathMax(2, zigzagDepth);
   if(indexFin < depth * 2)
      return 0;

   int debutScan = MathMax(depth, indexFin - 400);

   for(int i = debutScan; i <= indexFin - depth; i++)
   {
      bool estHaut = true;
      bool estBas  = true;
      double hRef  = bougies[i].high;
      double lRef  = bougies[i].low;

      for(int k = 1; k <= depth; k++)
      {
         if(bougies[i - k].high > hRef || bougies[i + k].high >= hRef)
            estHaut = false;
         if(bougies[i - k].low < lRef || bougies[i + k].low <= lRef)
            estBas = false;
      }

      if(!estHaut && !estBas)
         continue;

      bool typeActuelHaut = estHaut;
      double prixActuel   = typeActuelHaut ? hRef : lRef;

      int nbP = ArraySize(pivotsSortie);
      if(nbP == 0)
      {
         ArrayResize(pivotsSortie, 1);
         pivotsSortie[0].index   = i;
         pivotsSortie[0].temps   = bougies[i].temps;
         pivotsSortie[0].prix    = prixActuel;
         pivotsSortie[0].estHaut = typeActuelHaut;
      }
      else
      {
         // Si deux pivots de même nature se suivent, on conserve le plus extrême
         if(pivotsSortie[nbP - 1].estHaut == typeActuelHaut)
         {
            bool plusExtreme = typeActuelHaut
               ? (prixActuel >= pivotsSortie[nbP - 1].prix)
               : (prixActuel <= pivotsSortie[nbP - 1].prix);

            if(plusExtreme)
            {
               pivotsSortie[nbP - 1].index = i;
               pivotsSortie[nbP - 1].temps = bougies[i].temps;
               pivotsSortie[nbP - 1].prix  = prixActuel;
            }
         }
         else
         {
            ArrayResize(pivotsSortie, nbP + 1);
            pivotsSortie[nbP].index   = i;
            pivotsSortie[nbP].temps   = bougies[i].temps;
            pivotsSortie[nbP].prix    = prixActuel;
            pivotsSortie[nbP].estHaut = typeActuelHaut;
         }
      }
   }

   return ArraySize(pivotsSortie);
}

/**
 * Calcule la contribution anatomique d'une bougie (Corps vs Mèches) sur une tranche de prix.
 */
double CalculerContributionBougieTrancheUOP(
   const BougieSMC &b,
   double basTranche,
   double hautTranche,
   ENUM_TYPE_CHEVAUCHEMENT_UOP typeChevauchement,
   double poidsCorps,
   double poidsMeche
)
{
   if(b.high < basTranche || b.low > hautTranche)
      return 0.0;

   double corpsHaut = MathMax(b.open, b.close);
   double corpsBas  = MathMin(b.open, b.close);
   bool toucheCorps = (corpsHaut >= basTranche && corpsBas <= hautTranche);

   if(typeChevauchement == UOP_CORPS_SEUL)
      return toucheCorps ? 1.0 : 0.0;

   if(typeChevauchement == UOP_CORPS_ET_MECHES)
      return 1.0;

   // Mode UOP_PONDERE (Corps = poidsCorps, Mèche seule = poidsMeche)
   return toucheCorps ? poidsCorps : poidsMeche;
}

/**
 * 🛣️ Calcule le Profil de Chevauchement Non-Mitigé (UOP) sur les dernières vagues ZigZag
 * et extrait les paliers candidats de Take Profit (TP1, TP2, TP3) en appliquant la règle
 * d'absorption des petits creux <= 5% de la route cumulée.
 */
int CalculerPaliersUOPSMC(
   const BougieSMC &bougies[],
   int indexDoji,
   ENUM_DIRECTION_SMC directionSetup,
   double prixEntree,
   int zigzagDepth,
   int nbVaguesSuperposees,
   ENUM_TYPE_CHEVAUCHEMENT_UOP typeChevauchement,
   double poidsCorps,
   double poidsMeche,
   DetailsScoreLiquidationZigZagSMC &scoreZZ,
   PalierUOPCandidatSMC &paliersSortie[]
)
{
   ArrayResize(paliersSortie, 0);

   PivotZigZagSMC pivots[];
   int nbPivots = CalculerPivotsZigZagSMC(bougies, indexDoji, zigzagDepth, pivots);

   // Sauvegarde des 6 derniers pivots dans scoreZZ pour l'affichage diagnostic sur le graphique
   scoreZZ.nbPivots = 0;
   int debutCopiePiv = MathMax(0, nbPivots - 6);
   for(int p = debutCopiePiv; p < nbPivots && scoreZZ.nbPivots < MAX_PIVOTS_ZIGZAG; p++)
   {
      scoreZZ.pivots[scoreZZ.nbPivots] = pivots[p];
      scoreZZ.nbPivots++;
   }

   int idxDebutFenetre = MathMax(0, indexDoji - 120);
   if(nbPivots >= 2)
   {
      int idxPivotAncien = MathMax(0, nbPivots - MathMax(2, nbVaguesSuperposees) - 1);
      idxDebutFenetre    = pivots[idxPivotAncien].index;
   }

   // Bornes de prix sur la fenêtre des vagues analysées
   double prixMin = bougies[idxDebutFenetre].low;
   double prixMax = bougies[idxDebutFenetre].high;
   for(int k = idxDebutFenetre; k <= indexDoji; k++)
   {
      if(bougies[k].low < prixMin)
         prixMin = bougies[k].low;
      if(bougies[k].high > prixMax)
         prixMax = bougies[k].high;
   }

   double amplitudeTotale = prixMax - prixMin;
   if(amplitudeTotale <= _Point * 5.0)
      return 0;

   double pasTranche = amplitudeTotale / (double)NOMBRE_TRANCHES_UOP;
   double densiteTranche[NOMBRE_TRANCHES_UOP];
   double sommeDensites = 0.0;
   int nbTranchesActives = 0;

   for(int t = 0; t < NOMBRE_TRANCHES_UOP; t++)
   {
      double basT  = prixMin + t * pasTranche;
      double hautT = basT + pasTranche;
      double cumul = 0.0;

      for(int k = idxDebutFenetre; k <= indexDoji; k++)
      {
         cumul += CalculerContributionBougieTrancheUOP(
            bougies[k], basT, hautT,
            typeChevauchement, poidsCorps, poidsMeche
         );
      }

      densiteTranche[t] = cumul;
      if(cumul > 0.0)
      {
         sommeDensites += cumul;
         nbTranchesActives++;
      }
   }

   double seuilDense = (nbTranchesActives > 0)
      ? MathMax(1.5, (sommeDensites / (double)nbTranchesActives) * 0.85)
      : 1.5;

   // Regroupement des tranches situées devant le prix d'entrée avec absorption des creux <= 5%
   bool estAchat = (directionSetup == DIRECTION_ACHAT);

   if(estAchat)
   {
      // En Achat : on monte depuis prixEntree vers prixMax
      int tDepart = (int)MathFloor((prixEntree - prixMin) / pasTranche);
      tDepart = MathMax(0, MathMin(NOMBRE_TRANCHES_UOP - 1, tDepart));

      bool enRoute           = false;
      double basRoute        = 0.0;
      double hautRoute       = 0.0;
      double sommeRoute      = 0.0;
      int nbTranchesRoute    = 0;
      int tranchesCreuxEnCours = 0;

      for(int t = tDepart; t < NOMBRE_TRANCHES_UOP; t++)
      {
         double basT  = prixMin + t * pasTranche;
         double hautT = basT + pasTranche;
         bool estDense = (densiteTranche[t] >= seuilDense);

         if(estDense)
         {
            if(!enRoute)
            {
               enRoute            = true;
               basRoute           = basT;
               hautRoute          = hautT;
               sommeRoute         = densiteTranche[t];
               nbTranchesRoute    = 1;
               tranchesCreuxEnCours = 0;
            }
            else
            {
               hautRoute          = hautT;
               sommeRoute        += densiteTranche[t];
               nbTranchesRoute   += (1 + tranchesCreuxEnCours);
               tranchesCreuxEnCours = 0;
            }
         }
         else if(enRoute)
         {
            tranchesCreuxEnCours++;
            double hauteurRouteCumulee = MathMax(pasTranche, hautRoute - basRoute);
            double hauteurCreux        = tranchesCreuxEnCours * pasTranche;
            double ratioCreux          = hauteurCreux / hauteurRouteCumulee;

            // Si le creux dépasse 5% de la route cumulée (ou >= 2 tranches vides), la route s'arrête : on ancre un Palier TP !
            if(ratioCreux > 0.05 && tranchesCreuxEnCours >= 2)
            {
               int n = ArraySize(paliersSortie);
               if(n < MAX_PALIERS_UOP && hautRoute > prixEntree)
               {
                  ArrayResize(paliersSortie, n + 1);
                  paliersSortie[n].ordre                  = n + 1;
                  paliersSortie[n].prixCible              = hautRoute;
                  paliersSortie[n].prixBasZone            = basRoute;
                  paliersSortie[n].prixHautZone           = hautRoute;
                  paliersSortie[n].tauxMoyenChevauchement = sommeRoute / (double)MathMax(1, nbTranchesRoute);
                  paliersSortie[n].amplitudePoints        = hautRoute - basRoute;
                  paliersSortie[n].estPerce               = false;
                  paliersSortie[n].estBloquant            = false;
                  paliersSortie[n].budgetAvant            = 0;
                  paliersSortie[n].budgetApres            = 0;
               }
               enRoute            = false;
               tranchesCreuxEnCours = 0;
            }
         }
      }

      if(enRoute && hautRoute > prixEntree)
      {
         int n = ArraySize(paliersSortie);
         if(n < MAX_PALIERS_UOP)
         {
            ArrayResize(paliersSortie, n + 1);
            paliersSortie[n].ordre                  = n + 1;
            paliersSortie[n].prixCible              = hautRoute;
            paliersSortie[n].prixBasZone            = basRoute;
            paliersSortie[n].prixHautZone           = hautRoute;
            paliersSortie[n].tauxMoyenChevauchement = sommeRoute / (double)MathMax(1, nbTranchesRoute);
            paliersSortie[n].amplitudePoints        = hautRoute - basRoute;
            paliersSortie[n].estPerce               = false;
            paliersSortie[n].estBloquant            = false;
            paliersSortie[n].budgetAvant            = 0;
            paliersSortie[n].budgetApres            = 0;
         }
      }
   }
   else
   {
      // En Vente : on descend depuis prixEntree vers prixMin
      int tDepart = (int)MathFloor((prixEntree - prixMin) / pasTranche);
      tDepart = MathMax(0, MathMin(NOMBRE_TRANCHES_UOP - 1, tDepart));

      bool enRoute           = false;
      double hautRoute       = 0.0;
      double basRoute        = 0.0;
      double sommeRoute      = 0.0;
      int nbTranchesRoute    = 0;
      int tranchesCreuxEnCours = 0;

      for(int t = tDepart; t >= 0; t--)
      {
         double basT  = prixMin + t * pasTranche;
         double hautT = basT + pasTranche;
         bool estDense = (densiteTranche[t] >= seuilDense);

         if(estDense)
         {
            if(!enRoute)
            {
               enRoute            = true;
               hautRoute          = hautT;
               basRoute           = basT;
               sommeRoute         = densiteTranche[t];
               nbTranchesRoute    = 1;
               tranchesCreuxEnCours = 0;
            }
            else
            {
               basRoute           = basT;
               sommeRoute        += densiteTranche[t];
               nbTranchesRoute   += (1 + tranchesCreuxEnCours);
               tranchesCreuxEnCours = 0;
            }
         }
         else if(enRoute)
         {
            tranchesCreuxEnCours++;
            double hauteurRouteCumulee = MathMax(pasTranche, hautRoute - basRoute);
            double hauteurCreux        = tranchesCreuxEnCours * pasTranche;
            double ratioCreux          = hauteurCreux / hauteurRouteCumulee;

            if(ratioCreux > 0.05 && tranchesCreuxEnCours >= 2)
            {
               int n = ArraySize(paliersSortie);
               if(n < MAX_PALIERS_UOP && basRoute < prixEntree)
               {
                  ArrayResize(paliersSortie, n + 1);
                  paliersSortie[n].ordre                  = n + 1;
                  paliersSortie[n].prixCible              = basRoute;
                  paliersSortie[n].prixBasZone            = basRoute;
                  paliersSortie[n].prixHautZone           = hautRoute;
                  paliersSortie[n].tauxMoyenChevauchement = sommeRoute / (double)MathMax(1, nbTranchesRoute);
                  paliersSortie[n].amplitudePoints        = hautRoute - basRoute;
                  paliersSortie[n].estPerce               = false;
                  paliersSortie[n].estBloquant            = false;
                  paliersSortie[n].budgetAvant            = 0;
                  paliersSortie[n].budgetApres            = 0;
               }
               enRoute            = false;
               tranchesCreuxEnCours = 0;
            }
         }
      }

      if(enRoute && basRoute < prixEntree)
      {
         int n = ArraySize(paliersSortie);
         if(n < MAX_PALIERS_UOP)
         {
            ArrayResize(paliersSortie, n + 1);
            paliersSortie[n].ordre                  = n + 1;
            paliersSortie[n].prixCible              = basRoute;
            paliersSortie[n].prixBasZone            = basRoute;
            paliersSortie[n].prixHautZone           = hautRoute;
            paliersSortie[n].tauxMoyenChevauchement = sommeRoute / (double)MathMax(1, nbTranchesRoute);
            paliersSortie[n].amplitudePoints        = hautRoute - basRoute;
            paliersSortie[n].estPerce               = false;
            paliersSortie[n].estBloquant            = false;
            paliersSortie[n].budgetAvant            = 0;
            paliersSortie[n].budgetApres            = 0;
         }
      }
   }

   return ArraySize(paliersSortie);
}

/**
 * 🎯 Vérifie le Filtre Plage Temporelle TP UOP ([COND-PLAGE-TP-01]) :
 * Recherche la première bougie antérieure contenant le prix du TP et vérifie que
 * le Doji est bien l'extrême absolu (plus bas en Achat, plus haut en Vente) sur toute la plage.
 */
bool ValiderDojiAvecPlageTPSMC(
   const BougieSMC &bougies[],
   int indexDoji,
   ENUM_DIRECTION_SMC typeSetup,
   double prixTP,
   int maxRecul,
   int &bougieTPIndexSortie,
   datetime &bougieTPTempsSortie
)
{
   int debutScan = MathMax(0, indexDoji - 2);
   int finScan   = MathMax(0, indexDoji - 2 - maxRecul);

   int indexRepere = -1;

   // 1️⃣ Recherche de la première bougie antérieure dont le range traverse le prix du TP
   for(int k = debutScan; k >= finScan; k--)
   {
      if(bougies[k].low <= prixTP && bougies[k].high >= prixTP)
      {
         indexRepere = k;
         break;
      }
   }

   // 2️⃣ Secours : bougie la plus proche du prix TP
   if(indexRepere < 0)
   {
      double ecartMin = DBL_MAX;
      for(int k = debutScan; k >= finScan; k--)
      {
         double ecart = MathMin(MathAbs(bougies[k].high - prixTP), MathAbs(bougies[k].low - prixTP));
         if(ecart < ecartMin)
         {
            ecartMin    = ecart;
            indexRepere = k;
         }
      }
   }

   if(indexRepere < 0)
      return false;

   bougieTPIndexSortie = indexRepere;
   bougieTPTempsSortie = bougies[indexRepere].temps;

   int indexB1 = MathMax(0, indexDoji - 1);
   double marge = _Point * 0.5;

   // 3️⃣ Vérification que le Doji est l'extrême absolu sur [indexRepere .. indexDoji]
   if(typeSetup == DIRECTION_ACHAT)
   {
      double lowDoji     = MathMin(bougies[indexB1].low, bougies[indexDoji].low);
      double plusBasPlage = DBL_MAX;
      for(int k = indexRepere; k <= indexDoji; k++)
      {
         if(bougies[k].low < plusBasPlage)
            plusBasPlage = bougies[k].low;
      }
      return (lowDoji <= plusBasPlage + marge);
   }
   else
   {
      double highDoji     = MathMax(bougies[indexB1].high, bougies[indexDoji].high);
      double plusHautPlage = -DBL_MAX;
      for(int k = indexRepere; k <= indexDoji; k++)
      {
         if(bougies[k].high > plusHautPlage)
            plusHautPlage = bougies[k].high;
      }
      return (highDoji >= plusHautPlage - marge);
   }
}

#endif // MODULE_03_ZIGZAG_DYNAMIQUE_UOP_MQH
//+------------------------------------------------------------------+

