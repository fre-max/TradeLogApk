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
 * 🌊 Calcule le Score de Prise de Liquidité (sur 100 points) et pilote la Boîte à 3 Vitesses :
 *   1️⃣ Critère 1 — Retests et Collines du S/R (sur 50 points : 0=0pt, 1=15pts, 2=30pts, 3+=50pts)
 *   2️⃣ Critère 2 — Durée de vie / Importance du S/R (sur 25 points)
 *   3️⃣ Critère 3 — Profondeur du Balayage / Mèche (sur 25 points : <0.4x ATR=5pts, 0.4-1.0x=15pts, >1.0x=25pts)
 *
 * Boîte de Vitesses Automatique :
 *   🟢 Vitesse 1 (0 à 39 pts)  ➔ Micro-Vagues (depth 2-3, 2 vagues max, garde-fou dernière vague)
 *   🟡 Vitesse 2 (40 à 69 pts) ➔ Vagues Moyennes (depth 5-7, 3 vagues)
 *   🔥 Vitesse 3 (70 à 100 pts)➔ Grandes Vagues (depth 9-14+, 4 vagues)
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
   int depthMin       = MathMax(1, MathMin(8, zigzagDepthMin));
   int depthMax       = MathMax(depthMin, MathMin(8, zigzagDepthMax));
   int nbRetests      = aZoneScoree ? zoneScoree.nbCollines : 0;

   double ratioProfondeurATR    = NormalizeDouble(MathMax(0.0, profondeurMeche) / atrSecurise, 2);
   double ratioTailleBougieATR  = NormalizeDouble(MathMax(0.0, amplitudeBougieSweep) / atrSecurise, 2);
   double ratioEpaisseurZoneATR = NormalizeDouble(MathMax(0.0, epaisseurZoneSR) / atrSecurise, 2);

   // 🕯️ Calcul de zigzagDepth (de 1 à 8) basé UNIQUEMENT sur la taille du Doji (ratioTailleBougieATR)
   double progDepth = MathMax(0.0, MathMin(1.0, (ratioTailleBougieATR - 1.2) / 2.8));
   int zigzagDepthRetenu = MathMax(depthMin, MathMin(depthMax, (int)MathRound((double)depthMin + progDepth * (double)(depthMax - depthMin))));
   int scoreTotal = (int)MathRound(10.0 + progDepth * 90.0);
   int pointsTailleBougieEtZone = scoreTotal;
   int pointsRetestsSR = 0;
   int pointsProfondeurCassure = 0;

   int vitesseRetenue            = 2;
   int nbVaguesSuperposeesRetenu = 10;
   bool plafondDerniereVague     = false;

   if(zigzagDepthRetenu <= 3)
   {
      // 🟢 VITESSE 1 : Petit / Moyen Doji (Depth 1 à 3) -> 10 vagues superposées
      vitesseRetenue            = 1;
   }
   else if(zigzagDepthRetenu <= 5)
   {
      // 🟡 VITESSE 2 : Grand Doji (Depth 4 à 5) -> 10 vagues superposées
      vitesseRetenue            = 2;
   }
   else
   {
      // 🔥 VITESSE 3 : Très Grand Doji (Depth 6 à 8) -> 10 vagues superposées
      vitesseRetenue            = 3;
   }

   sortieScoreZZ.scoreTotal                = scoreTotal;
   sortieScoreZZ.pointsProfondeurCassure   = pointsProfondeurCassure;
   sortieScoreZZ.pointsTailleBougieEtZone  = pointsTailleBougieEtZone;
   sortieScoreZZ.pointsRetestsSR           = pointsRetestsSR;
   sortieScoreZZ.ratioProfondeurATR        = ratioProfondeurATR;
   sortieScoreZZ.ratioTailleBougieATR      = ratioTailleBougieATR;
   sortieScoreZZ.ratioEpaisseurZoneATR     = ratioEpaisseurZoneATR;
   sortieScoreZZ.nombreRetests             = nbRetests;
   sortieScoreZZ.vitesseRetenue            = vitesseRetenue;
   sortieScoreZZ.zigzagDepthRetenu         = zigzagDepthRetenu;
   sortieScoreZZ.nbVaguesSuperposeesRetenu = nbVaguesSuperposeesRetenu;
   sortieScoreZZ.plafondDerniereVagueActif = plafondDerniereVague;
   sortieScoreZZ.nbPivots                  = 0;
}

/**
 * Détecte les pivots ZigZag alternés (Haut / Bas) sur la plage [0 .. indexFin]
 * selon la profondeur dynamique zigzagDepth (supporte depth = 1 à 8).
 */
int CalculerPivotsZigZagSMC(
   const BougieSMC &bougies[],
   int indexFin,
   int zigzagDepth,
   PivotZigZagSMC &pivotsSortie[]
)
{
   ArrayResize(pivotsSortie, 0);
   int depth = MathMax(1, zigzagDepth);
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

   // Sauvegarde de la section exacte de ZigZag (N vagues = N + 1 pivots) pour l'affichage sur le graphique
   scoreZZ.nbPivots = 0;
   int nbPivotsSection = MathMax(2, nbVaguesSuperposees + 1);
   int debutCopiePiv   = MathMax(0, nbPivots - nbPivotsSection);
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
   bool   trancheConsommee[NOMBRE_TRANCHES_UOP];
   for(int tInit = 0; tInit < NOMBRE_TRANCHES_UOP; tInit++)
   {
      densiteTranche[tInit]   = 0.0;
      trancheConsommee[tInit] = false;
   }

   // Construction de la liste des N vagues [debutIdx .. finIdx] de la section ZigZag
   int vaguesDebut[12];
   int vaguesFin[12];
   int nbVaguesSection = 0;

   if(scoreZZ.nbPivots >= 2)
   {
      for(int vp = 0; vp < scoreZZ.nbPivots - 1 && nbVaguesSection < 11; vp++)
      {
         vaguesDebut[nbVaguesSection] = MathMin(scoreZZ.pivots[vp].index, scoreZZ.pivots[vp + 1].index);
         vaguesFin[nbVaguesSection]   = MathMax(scoreZZ.pivots[vp].index, scoreZZ.pivots[vp + 1].index);
         nbVaguesSection++;
      }
      int dernierPivIdx = scoreZZ.pivots[scoreZZ.nbPivots - 1].index;
      if(indexDoji > dernierPivIdx && nbVaguesSection < 12)
      {
         vaguesDebut[nbVaguesSection] = dernierPivIdx;
         vaguesFin[nbVaguesSection]   = indexDoji;
         nbVaguesSection++;
      }
   }
   else
   {
      vaguesDebut[0]  = idxDebutFenetre;
      vaguesFin[0]    = indexDoji;
      nbVaguesSection = 1;
   }

   // Lecture de DROITE vers la GAUCHE (de la vague la plus récente V1 vers la plus ancienne V10)
   // Règle de Plages de Prix Consommées : chaque vague conserve son propre intervalle [min, max] consommé
   // afin que deux vagues séparées ne bloquent pas artificiellement l'espace intermédiaire !
   double consommeMins[14];
   double consommeMaxs[14];
   int    nbPlagesConsommees = 0;

   for(int vIdx = nbVaguesSection - 1; vIdx >= 0; vIdx--)
   {
      int idxDebV = MathMax(0, vaguesDebut[vIdx]);
      int idxFinV = MathMin(indexDoji, vaguesFin[vIdx]);
      if(idxFinV < idxDebV)
         continue;

      double vagueMin = bougies[idxDebV].low;
      double vagueMax = bougies[idxDebV].high;
      for(int kb = idxDebV; kb <= idxFinV; kb++)
      {
         if(bougies[kb].low < vagueMin)
            vagueMin = bougies[kb].low;
         if(bougies[kb].high > vagueMax)
            vagueMax = bougies[kb].high;
      }

      for(int t = 0; t < NOMBRE_TRANCHES_UOP; t++)
      {
         double basT    = prixMin + t * pasTranche;
         double hautT   = basT + pasTranche;
         double centreT = (basT + hautT) * 0.5;

         // Si la tranche ne fait pas partie de cette vague, on passe
         if(hautT < vagueMin || basT > vagueMax)
            continue;

         // Si cette tranche tombe dans l'une des plages déjà consommées par une vague plus récente (à droite) : IGNORÉE !
         bool dejaDansPlage = false;
         for(int pc = 0; pc < nbPlagesConsommees; pc++)
         {
            if(centreT >= consommeMins[pc] && centreT <= consommeMaxs[pc])
            {
               dejaDansPlage = true;
               break;
            }
         }
         if(trancheConsommee[t] || dejaDansPlage)
            continue;

         double cumulVague = 0.0;
         for(int k = idxDebV; k <= idxFinV; k++)
         {
            cumulVague += CalculerContributionBougieTrancheUOP(
               bougies[k], basT, hautT,
               typeChevauchement, poidsCorps, poidsMeche
            );
         }

         densiteTranche[t]   = cumulVague;
         trancheConsommee[t] = true;
      }

      if(nbPlagesConsommees < 14)
      {
         consommeMins[nbPlagesConsommees] = vagueMin;
         consommeMaxs[nbPlagesConsommees] = vagueMax;
         nbPlagesConsommees++;
      }
   }

   double sommeDensites = 0.0;
   int nbTranchesActives = 0;
   for(int t = 0; t < NOMBRE_TRANCHES_UOP; t++)
   {
      if(densiteTranche[t] > 0.0)
      {
         sommeDensites += densiteTranche[t];
         nbTranchesActives++;
      }
   }

   // Seuil de chevauchement "Bleu Foncé" aligné à 100% avec l'application TypeScript (3 bougies par défaut, 2 en micro-vagues)
   double seuilDense = (nbVaguesSuperposees <= 2) ? 2.0 : 3.0;
   if(nbTranchesActives > 0 && (sommeDensites / (double)nbTranchesActives) < seuilDense)
   {
      seuilDense = MathMax(1.5, (sommeDensites / (double)nbTranchesActives) * 0.85);
   }

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

   // 🛡️ GARDE-FOU SPÉCIAL PETITE LIQUIDITÉ (Vitesse 1 : Score < 40 pts)
   // Si des paliers UOP existent à l'intérieur de la dernière petite vague (avant le sommet/creux précédent),
   // on ne conserve que ceux-là pour éviter un TP1 trop éloigné.
   if(scoreZZ.plafondDerniereVagueActif && ArraySize(paliersSortie) > 0 && nbPivots > 0)
   {
      double borneDerniereVague = 0.0;
      bool aBorne = false;
      for(int p = nbPivots - 1; p >= 0; p--)
      {
         if(estAchat && pivots[p].estHaut && pivots[p].prix > prixEntree)
         {
            borneDerniereVague = pivots[p].prix;
            aBorne = true;
            break;
         }
         if(!estAchat && !pivots[p].estHaut && pivots[p].prix < prixEntree)
         {
            borneDerniereVague = pivots[p].prix;
            aBorne = true;
            break;
         }
      }

      if(aBorne)
      {
         PalierUOPCandidatSMC paliersFiltres[];
         for(int idxP = 0; idxP < ArraySize(paliersSortie); idxP++)
         {
            bool dansVague = estAchat
               ? (paliersSortie[idxP].prixCible <= borneDerniereVague)
               : (paliersSortie[idxP].prixCible >= borneDerniereVague);
            if(dansVague)
            {
               int nf = ArraySize(paliersFiltres);
               ArrayResize(paliersFiltres, nf + 1);
               paliersFiltres[nf]       = paliersSortie[idxP];
               paliersFiltres[nf].ordre = nf + 1;
            }
         }
         if(ArraySize(paliersFiltres) > 0)
         {
            ArrayResize(paliersSortie, ArraySize(paliersFiltres));
            for(int idxCopy = 0; idxCopy < ArraySize(paliersFiltres); idxCopy++)
               paliersSortie[idxCopy] = paliersFiltres[idxCopy];
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

/**
 * 🧲 Recherche un Support (en VENTE) ou une Résistance (en ACHAT) toujours actif (non cassé)
 * situé en face du prix d'entrée, et vérifie si tout le trajet [prixEntree ➔ S/R]
 * est couvert par les corridors de chevauchement UOP avec un bon taux moyen.
 *
 * Exemple :
 * double prixCibleSR = 0.0;
 * bool trouve = TrouverCibleLiquiditeSRAvecChevauchementSMC(
 *    toutesLesZonesShved, totalZonesShved, bougies, indexHorizonVerrouillage,
 *    doji.type, prixEntree, paliersCandidats, nbPaliers,
 *    1.5, 70.0, 1, prixCibleSR
 * );
 */
bool TrouverCibleLiquiditeSRAvecChevauchementSMC(
   const ZoneShvedSMC &toutesLesZonesShved[],
   int totalZonesShved,
   const BougieSMC &bougies[],
   int indexHorizon,
   ENUM_DIRECTION_SMC typeSetup,
   double prixEntree,
   const PalierUOPCandidatSMC &paliersUOP[],
   int nbPaliersUOP,
   double tauxMinChevauchementTrajet,
   double couvertureMinPourcent,
   int ordreCibleVise,
   double &prixCibleSRSortie
)
{
   prixCibleSRSortie = 0.0;
   if(totalZonesShved <= 0 || nbPaliersUOP <= 0)
      return false;

   bool estAchat = (typeSetup == DIRECTION_ACHAT);
   double ciblesValides[];
   double distancesValides[];

   for(int z = 0; z < totalZonesShved; z++)
   {
      ZoneShvedSMC zone = toutesLesZonesShved[z];

      // 1️⃣ En ACHAT on cherche une RESISTANCE au-dessus ; en VENTE un SUPPORT en dessous
      if(estAchat && zone.type != ZONE_RESISTANCE)
         continue;
      if(!estAchat && zone.type != ZONE_SUPPORT)
         continue;

      // 2️⃣ La zone doit être née avant ou à l'horizon de confirmation
      if(zone.indexOrigine > indexHorizon)
         continue;

      double prixCible = estAchat
         ? (zone.prixBas > prixEntree ? zone.prixBas : zone.prixMedian)
         : (zone.prixHaut < prixEntree ? zone.prixHaut : zone.prixMedian);

      if(estAchat && prixCible <= prixEntree)
         continue;
      if(!estAchat && prixCible >= prixEntree)
         continue;

      // 3️⃣ Vérifier que le Support / Résistance est TOUJOURS ACTIF (non cassé jusqu'à indexHorizon)
      bool estCasse = false;
      for(int k = zone.indexOrigine + 1; k <= indexHorizon; k++)
      {
         if(estAchat && bougies[k].close > zone.prixHaut)
         {
            estCasse = true;
            break;
         }
         if(!estAchat && bougies[k].close < zone.prixBas)
         {
            estCasse = true;
            break;
         }
      }
      if(estCasse)
         continue;

      // 4️⃣ Vérifier le taux de chevauchement et la couverture sur le trajet [prixEntree ➔ prixCible]
      double minTrajet = MathMin(prixEntree, prixCible);
      double maxTrajet = MathMax(prixEntree, prixCible);
      double distTotale = MathMax(_Point, maxTrajet - minTrajet);

      double longueurCouverte = 0.0;
      double sommePondereeTaux = 0.0;

      for(int p = 0; p < nbPaliersUOP; p++)
      {
         double basIntersection  = MathMax(minTrajet, paliersUOP[p].prixBasZone);
         double hautIntersection = MathMin(maxTrajet, paliersUOP[p].prixHautZone);
         if(hautIntersection > basIntersection)
         {
            double seg = hautIntersection - basIntersection;
            longueurCouverte  += seg;
            sommePondereeTaux += seg * paliersUOP[p].tauxMoyenChevauchement;
         }
      }

      double pctCouvert = MathMin(100.0, (longueurCouverte / distTotale) * 100.0);
      double tauxMoyenTrajet = (longueurCouverte > 0.0) ? (sommePondereeTaux / distTotale) : 0.0;

      if(pctCouvert >= couvertureMinPourcent && tauxMoyenTrajet >= tauxMinChevauchementTrajet)
      {
         int n = ArraySize(ciblesValides);
         ArrayResize(ciblesValides, n + 1);
         ArrayResize(distancesValides, n + 1);
         ciblesValides[n]    = prixCible;
         distancesValides[n] = distTotale;
      }
   }

   int nbValides = ArraySize(ciblesValides);
   if(nbValides <= 0)
      return false;

   // Tri par distance croissante depuis le prix d'entrée
   for(int i = 0; i < nbValides - 1; i++)
   {
      for(int j = i + 1; j < nbValides; j++)
      {
         if(distancesValides[j] < distancesValides[i])
         {
            double tmpD = distancesValides[i];
            distancesValides[i] = distancesValides[j];
            distancesValides[j] = tmpD;

            double tmpC = ciblesValides[i];
            ciblesValides[i] = ciblesValides[j];
            ciblesValides[j] = tmpC;
         }
      }
   }

   int idxRetenu = MathMax(0, MathMin(nbValides - 1, ordreCibleVise - 1));
   prixCibleSRSortie = ciblesValides[idxRetenu];
   return true;
}

#endif // MODULE_03_ZIGZAG_DYNAMIQUE_UOP_MQH
//+------------------------------------------------------------------+

