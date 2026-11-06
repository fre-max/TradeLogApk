//+------------------------------------------------------------------+
//|                               Module06_MoteurEvaluationRapide.mqh|
//|              🎼 Chef d'Orchestre SMC - Version MetaTrader 5       |
//|   BLOC 6 : Court-Circuit N-3, Décalage VPS & Évaluation Unitaire |
//+------------------------------------------------------------------+
#property copyright "JournalMobileAPK - Orchestrateur SMC MT5"
#property strict

#ifndef MODULE_06_MOTEUR_EVALUATION_RAPIDE_MQH
#define MODULE_06_MOTEUR_EVALUATION_RAPIDE_MQH

#include "Module00_TypesEtOutils.mqh"
#include "Module01_DojiEtPlage.mqh"
#include "Module02_ShvedEtCollines.mqh"
#include "Module03_ZigZagDynamiqueUOP.mqh"
#include "Module04_EnergieEtConfirmation.mqh"

/**
 * ⏱️ Calcule un délai de décalage automatique (en millisecondes) unique pour chaque
 * couple (Symbole, Timeframe) afin d'étaler les calculs à la clôture des bougies (XX:00 / XX:30)
 * et d'éviter tout goulot d'étranglement CPU sur le VPS.
 *
 * Exemple :
 * int delaiMs = CalculerDelaiDecalageSymboleMs("GBPUSD", PERIOD_H1, 10);
 */
int CalculerDelaiDecalageSymboleMs(string symbole, ENUM_TIMEFRAMES periode, int delaiMaxSecondes)
{
   if(delaiMaxSecondes <= 0)
      return 0;

   uint hash = 2166136261U;
   int len   = StringLen(symbole);
   for(int i = 0; i < len; i++)
   {
      hash ^= (uint)StringGetCharacter(symbole, i);
      hash *= 16777619U;
   }

   hash ^= (uint)PeriodSeconds(periode);
   hash *= 16777619U;

   int maxMs = MathMax(500, delaiMaxSecondes * 1000);
   return (int)(hash % (uint)maxMs);
}

/**
 * ⚡ COURT-CIRCUIT ULTRA-RAPIDE (0.01 ms) :
 * Vérifie uniquement si une bougie précise `indexCandidat` est un Doji Liq/Reint valide.
 * Permet d'éviter 95% des calculs lourds (Shved + Collines + ZigZag + UOP) lorsqu'aucun
 * Doji n'est en train de terminer ses 3 bougies de confirmation !
 */
bool ExtraireDojiSurIndexPrecisSMC(
   const BougieSMC &bougies[],
   int totalBougies,
   int indexCandidat,
   bool activerAchat,
   bool activerVente,
   bool activerFiltreTaille,
   int periodeHistorique,
   double multiplicateurBougie1,
   double multiplicateurCorps2,
   double toleranceDeficit,
   double toleranceDepassement,
   int maxReculRecherche,
   SignalDojiPlageSMC &dojiSortie
)
{
   ZeroMemory(dojiSortie);
   if(indexCandidat < 2 || indexCandidat >= totalBougies - 1)
      return false;

   BougieSMC b1 = bougies[indexCandidat - 1];
   BougieSMC b2 = bougies[indexCandidat];

   int pHist       = MathMax(3, periodeHistorique);
   int idxDebutRef = MathMax(0, indexCandidat - 1 - pHist);
   double sommeH   = 0.0;
   double sommeC   = 0.0;
   int countRef    = 0;

   for(int k = idxDebutRef; k < indexCandidat - 1; k++)
   {
      sommeH += (bougies[k].high - bougies[k].low);
      sommeC += MathAbs(bougies[k].open - bougies[k].close);
      countRef++;
   }

   double moyHauteur = (countRef > 0) ? (sommeH / (double)countRef) : (b1.high - b1.low);
   double moyCorps   = (countRef > 0) ? (sommeC / (double)countRef) : MathAbs(b1.open - b1.close);
   if(moyHauteur <= 0.0)
      moyHauteur = _Point * 10.0;

   ENUM_DIRECTION_SMC typeDoji = DIRECTION_ACHAT;
   double prixExtreme          = 0.0;

   bool estValide = VerifierDojiSimple(
      b1, b2, moyHauteur, moyCorps,
      activerAchat, activerVente, activerFiltreTaille,
      multiplicateurBougie1, multiplicateurCorps2,
      toleranceDeficit, toleranceDepassement,
      typeDoji, prixExtreme
   );

   if(!estValide)
      return false;

   int idxPrec     = 0;
   datetime tPrec  = 0;
   double prixPrec = 0.0;

   TrouverBougieExtremePrecedente(
      bougies, indexCandidat, typeDoji, prixExtreme, maxReculRecherche,
      idxPrec, tPrec, prixPrec
   );

   double tailleLiq = (typeDoji == DIRECTION_ACHAT)
      ? MathAbs(b1.open - b1.low)
      : MathAbs(b1.high - b1.open);

   dojiSortie.estValide            = true;
   dojiSortie.type                 = typeDoji;
   dojiSortie.indexBougie          = indexCandidat;
   dojiSortie.temps                = b2.temps;
   dojiSortie.prixExtreme          = prixExtreme;
   dojiSortie.open1                = b1.open;
   dojiSortie.close2               = b2.close;
   dojiSortie.tailleLiquidation    = tailleLiq;
   dojiSortie.indexDebutPlage      = idxPrec;
   dojiSortie.tempsDebutPlage      = tPrec;
   dojiSortie.prixExtremePrecedent = prixPrec;
   dojiSortie.moyenneHauteur       = moyHauteur;
   return true;
}

/**
 * ⚡ Vérifie en moins de 0.02 ms si l'une des toutes dernières bougies clôturées
 * contient un Doji en cours de confirmation ou venant tout juste de terminer ses N bougies.
 */
bool AActiviteRecenteDojiSMC(
   const BougieSMC &bougies[],
   int totalBougies,
   int nbBougiesConfirmation,
   bool activerAchat,
   bool activerVente,
   bool activerFiltreTaille,
   int periodeHistorique,
   double multiplicateurBougie1,
   double multiplicateurCorps2,
   double toleranceDeficit,
   double toleranceDepassement,
   int maxReculRecherche
)
{
   int indexDerniereCloturee = totalBougies - 2;
   int indexDebutVerif       = MathMax(2, indexDerniereCloturee - nbBougiesConfirmation - 1);

   SignalDojiPlageSMC dojiTest;
   for(int idx = indexDebutVerif; idx <= indexDerniereCloturee; idx++)
   {
      if(ExtraireDojiSurIndexPrecisSMC(
         bougies, totalBougies, idx,
         activerAchat, activerVente, activerFiltreTaille,
         periodeHistorique, multiplicateurBougie1, multiplicateurCorps2,
         toleranceDeficit, toleranceDepassement, maxReculRecherche,
         dojiTest
      ))
      {
         return true;
      }
   }
   return false;
}

/**
 * 🚀 Évalue un signal Doji unique de bout en bout (Shved + Collines + ZigZag Dynamique + UOP + Confirmation).
 * Ne calcule les zones Shved que si nécessaire !
 */
bool EvaluerDojiCompletUniqueSMC(
   const SignalDojiPlageSMC &doji,
   const BougieSMC &bougies[],
   int totalLocal,
   int periodeATRShved,
   double zoneFuzzFactor,
   int scoreMinimumShved,
   bool exigerDebutEtFinDansPlage,
   bool activerZigZagDynamique,
   int zigzagDepthMin,
   int zigzagDepthMax,
   int zigzagDepthSecours,
   int nbVaguesSuperposees,
   ENUM_TYPE_CHEVAUCHEMENT_UOP typeChevauchementUOP,
   double poidsCorpsUOP,
   double poidsMecheUOP,
   bool exigerAutorouteUOP,
   double minTauxAutoroute,
   bool activerFiltrePlageTP,
   int maxReculPlageTP,
   int nbBougiesConfirmation,
   ENUM_MODE_CALCUL_TP modeCalculTP,
   ENUM_PALIER_TP_VISE palierTPVise,
   int pointsParRetest,
   int plafondCarburantRetests,
   double bonusMecheProfonde,
   double bonusMecheNormale,
   int peagePalierUOP,
   double coutParATR,
   double coutFrictionFortOverlap,
   double coutFrictionMoyenOverlap,
   double coutFrictionFaibleOverlap,
   double seuilFortOverlap,
   double seuilFaibleOverlap,
   double margeSecuriteDevantPalier,
   int seuilScoreGrandMouvement,
   double pointSymbole,
   int digitsSymbole,
   SetupOrchestreSMC_MT5 &setupSortie
)
{
   ZeroMemory(setupSortie);
   bool estAchat     = (doji.type == DIRECTION_ACHAT);
   int indexDoji     = doji.indexBougie;
   double prixEntree = doji.close2;
   double prixSL     = doji.prixExtreme;
   double distanceSL = MathMax(pointSymbole, MathAbs(prixEntree - prixSL));

   // 1️⃣ Court-circuit immédiat : vérifier d'abord si les bougies suivant le Doji n'ont pas déjà cassé le SL !
   // Si le SL a déjà été cassé pendant les 3 bougies de confirmation, inutile de calculer Shved ni l'UOP !
   int indexDerniereCloturee = totalLocal - 2;
   int finConfirmation       = MathMin(indexDerniereCloturee, indexDoji + nbBougiesConfirmation);
   for(int k = indexDoji + 1; k <= finConfirmation; k++)
   {
      bool slCasse = estAchat ? (bougies[k].low <= prixSL) : (bougies[k].high >= prixSL);
      if(slCasse)
         return false;
   }

   // 2️⃣ Calcul des zones Shved uniquement parce que le Doji a survécu !
   ZoneShvedSMC toutesLesZonesShved[];
   int totalZonesShved = CalculerShvedSupplyDemandSMC(
      bougies, totalLocal, totalLocal, periodeATRShved, zoneFuzzFactor, toutesLesZonesShved
   );

   ZoneShvedScoreeSMC zonesDansPlage[];
   int nbZonesPlage = EvaluerNiveauxShvedDansPlageSMC(
      toutesLesZonesShved, totalZonesShved, doji, bougies, totalLocal,
      exigerDebutEtFinDansPlage, 0, zonesDansPlage
   );

   bool aMeilleureZone = (nbZonesPlage > 0);
   int scoreShved      = aMeilleureZone ? zonesDansPlage[0].score : 0;
   if(scoreShved < scoreMinimumShved)
      return false;

   // 3️⃣ Score de Liquidation (/100) & ZigZag Dynamique (4 à 20)
   double profondeurMeche = distanceSL;
   double epaisseurZoneSR = 0.0;
   ZoneShvedScoreeSMC meilleureZone;
   ZeroMemory(meilleureZone);

   if(aMeilleureZone)
   {
      meilleureZone   = zonesDansPlage[0];
      profondeurMeche = estAchat
         ? MathMax(0.0, meilleureZone.zone.prixMedian - prixSL)
         : MathMax(0.0, prixSL - meilleureZone.zone.prixMedian);
      epaisseurZoneSR = MathAbs(meilleureZone.zone.prixHaut - meilleureZone.zone.prixBas);
   }

   double ampB2 = bougies[indexDoji].high - bougies[indexDoji].low;
   double ampB1 = bougies[MathMax(0, indexDoji - 1)].high - bougies[MathMax(0, indexDoji - 1)].low;
   double amplitudeBougieSweep = MathMax(ampB1, ampB2);

   DetailsScoreLiquidationZigZagSMC scoreZZ;
   ZeroMemory(scoreZZ);
   CalculerScoreLiquidationZigZagSMC(
      profondeurMeche, doji.moyenneHauteur, amplitudeBougieSweep, epaisseurZoneSR,
      aMeilleureZone, meilleureZone, zigzagDepthMin, zigzagDepthMax, scoreZZ
   );

   int depthActif = activerZigZagDynamique ? scoreZZ.zigzagDepthRetenu : zigzagDepthSecours;

   // 4️⃣ Profil UOP
   PalierUOPCandidatSMC paliersCandidats[];
   int nbPaliers = CalculerPaliersUOPSMC(
      bougies, indexDoji, doji.type, prixEntree, depthActif, nbVaguesSuperposees,
      typeChevauchementUOP, poidsCorpsUOP, poidsMecheUOP, scoreZZ, paliersCandidats
   );

   if(nbPaliers == 0 && depthActif != zigzagDepthSecours)
   {
      nbPaliers = CalculerPaliersUOPSMC(
         bougies, indexDoji, doji.type, prixEntree, zigzagDepthSecours, nbVaguesSuperposees,
         typeChevauchementUOP, poidsCorpsUOP, poidsMecheUOP, scoreZZ, paliersCandidats
      );
   }

   if(exigerAutorouteUOP)
   {
      if(nbPaliers <= 0)
         return false;
      bool aAutoroute = false;
      for(int p = 0; p < nbPaliers; p++)
      {
         if(paliersCandidats[p].tauxMoyenChevauchement >= minTauxAutoroute)
         {
            aAutoroute = true;
            break;
         }
      }
      if(!aAutoroute)
         return false;
   }

   // 5️⃣ Carburant & Take Profit Optimal
   int carburantInitial = CalculerCarburantLiquidationSMC(
      aMeilleureZone, meilleureZone, profondeurMeche, doji.moyenneHauteur,
      pointsParRetest, plafondCarburantRetests, bonusMecheProfonde, bonusMecheNormale
   );

   double prixTP           = 0.0;
   int ordreTP             = 1;
   int carburantRestant    = 0;
   int paliersTraverses    = 0;
   bool estLimiteParPalier = false;

   if(palierTPVise != PALIER_AUTO)
   {
      int indexVise = (palierTPVise == PALIER_TP3) ? 2 : ((palierTPVise == PALIER_TP2) ? 1 : 0);
      ordreTP = indexVise + 1;
      if(nbPaliers > 0)
      {
         int idxEff         = MathMin(indexVise, nbPaliers - 1);
         prixTP             = paliersCandidats[idxEff].prixCible;
         ordreTP            = idxEff + 1;
         paliersTraverses   = ordreTP - 1;
         estLimiteParPalier = true;
         paliersCandidats[idxEff].estBloquant = true;
      }
      else
      {
         double multSecours = (ordreTP == 3) ? 3.5 : ((ordreTP == 2) ? 2.5 : 1.5);
         prixTP = estAchat ? (prixEntree + distanceSL * multSecours) : (prixEntree - distanceSL * multSecours);
      }
   }
   else if(modeCalculTP == MODE_TP_ENERGIE_FRICTION)
   {
      CalculerPorteeDynamiqueUOPSMC(
         prixEntree, prixSL, doji.type, carburantInitial, paliersCandidats, nbPaliers,
         doji.moyenneHauteur, peagePalierUOP, coutParATR,
         coutFrictionFortOverlap, coutFrictionMoyenOverlap, coutFrictionFaibleOverlap,
         seuilFortOverlap, seuilFaibleOverlap, margeSecuriteDevantPalier,
         prixTP, ordreTP, carburantRestant, paliersTraverses, estLimiteParPalier
      );
   }
   else
   {
      bool viserGrand = (scoreShved >= seuilScoreGrandMouvement);
      if(nbPaliers > 0)
      {
         int idxChoisi = (viserGrand && nbPaliers >= 2) ? 1 : 0;
         prixTP        = paliersCandidats[idxChoisi].prixCible;
         ordreTP       = idxChoisi + 1;
      }
      else
      {
         double multSecours = viserGrand ? 2.5 : 1.5;
         prixTP  = estAchat ? (prixEntree + distanceSL * multSecours) : (prixEntree - distanceSL * multSecours);
         ordreTP = viserGrand ? 2 : 1;
      }
   }

   prixTP = NormalizeDouble(prixTP, digitsSymbole);

   // 6️⃣ Filtre Plage Temporelle TP UOP
   int bougieTPIdx      = -1;
   datetime bougieTPTps = 0;
   bool plageTPValide   = true;

   if(prixTP > 0.0)
   {
      plageTPValide = ValiderDojiAvecPlageTPSMC(
         bougies, indexDoji, doji.type, prixTP, maxReculPlageTP, bougieTPIdx, bougieTPTps
      );
      if(activerFiltrePlageTP && !plageTPValide)
         return false;
   }

   // 7️⃣ Assemblage & Confirmation
   setupSortie.idSetup            = indexDoji;
   setupSortie.type               = doji.type;
   setupSortie.indexDoji          = indexDoji;
   setupSortie.tempsDoji          = doji.temps;
   setupSortie.indexDebutPlage    = doji.indexDebutPlage;
   setupSortie.tempsDebutPlage    = doji.tempsDebutPlage;
   setupSortie.prixEntree         = prixEntree;
   setupSortie.prixSL             = prixSL;
   setupSortie.distanceSL         = distanceSL;
   setupSortie.prixTP             = prixTP;
   setupSortie.ordreTP            = ordreTP;
   setupSortie.distanceTP         = MathAbs(prixTP - prixEntree);
   setupSortie.ratioRR            = NormalizeDouble(setupSortie.distanceTP / MathMax(pointSymbole, distanceSL), 2);
   setupSortie.scoreShved         = scoreShved;
   setupSortie.aMeilleureZone     = aMeilleureZone;
   if(aMeilleureZone)
      setupSortie.meilleureZone   = meilleureZone;
   setupSortie.carburantInitial   = carburantInitial;
   setupSortie.carburantRestant   = carburantRestant;
   setupSortie.paliersTraverses   = paliersTraverses;
   setupSortie.estLimiteParPalier = estLimiteParPalier;
   setupSortie.scoreZigZag        = scoreZZ;
   setupSortie.nbPaliersUOP       = MathMin(MAX_PALIERS_UOP, nbPaliers);
   for(int p = 0; p < setupSortie.nbPaliersUOP; p++)
      setupSortie.paliersUOP[p]   = paliersCandidats[p];
   setupSortie.infoPlageTPValide  = plageTPValide;
   setupSortie.bougieTPIndex      = bougieTPIdx;
   setupSortie.bougieTPTemps      = bougieTPTps;

   VerifierConfirmationEtCycleDeVieSMC(bougies, totalLocal, nbBougiesConfirmation, setupSortie);
   return (setupSortie.statut != SETUP_ANNULE);
}

#endif // MODULE_06_MOTEUR_EVALUATION_RAPIDE_MQH
//+------------------------------------------------------------------+

