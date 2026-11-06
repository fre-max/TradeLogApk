//+------------------------------------------------------------------+
//|                                Module04_EnergieEtConfirmation.mqh|
//|              🎼 Chef d'Orchestre SMC - Version MetaTrader 5       |
//|  BLOC 4 : Carburant vs Friction UOP & Confirmation des 3 Bougies |
//+------------------------------------------------------------------+
#property copyright "JournalMobileAPK - Orchestrateur SMC MT5"
#property strict

#ifndef MODULE_04_ENERGIE_ET_CONFIRMATION_MQH
#define MODULE_04_ENERGIE_ET_CONFIRMATION_MQH

#include "Module00_TypesEtOutils.mqh"

/**
 * ⛽ Calcule le réservoir de carburant initial (liquidité engrangée lors de la liquidation)
 * en pondérant chaque retest par l'ampleur de sa colline (MINEURE = 0.6x, SOLIDE = 1.0x, MAJEURE = 1.5x)
 * et en appliquant le multiplicateur de profondeur de mèche.
 */
int CalculerCarburantLiquidationSMC(
   bool aZoneScoree,
   const ZoneShvedScoreeSMC &zoneScoree,
   double profondeurMeche,
   double hauteurMoyenneATR,
   int pointsParRetest,
   int plafondCarburantRetests,
   double bonusMecheProfonde,
   double bonusMecheNormale
)
{
   int pointsRetests = pointsParRetest;

   if(aZoneScoree && zoneScoree.nbCollines > 0)
   {
      int sommeCarburantCollines = 0;
      for(int c = 0; c < zoneScoree.nbCollines; c++)
      {
         double facteurColline = 0.6;
         if(zoneScoree.collines[c].qualite == COLLINE_MAJEURE)
            facteurColline = 1.5;
         else if(zoneScoree.collines[c].qualite == COLLINE_SOLIDE)
            facteurColline = 1.0;

         sommeCarburantCollines += (int)MathRound((double)pointsParRetest * facteurColline);
      }
      pointsRetests = MathMin(plafondCarburantRetests, sommeCarburantCollines);
   }
   else
   {
      pointsRetests = (int)MathRound((double)pointsParRetest * 0.8);
   }

   double atrSecurise   = MathMax(_Point, hauteurMoyenneATR);
   double ratioMecheAtr = MathMax(0.0, profondeurMeche) / atrSecurise;

   double multiplicateurMeche = 1.0;
   if(ratioMecheAtr > 1.2)
      multiplicateurMeche = bonusMecheProfonde;
   else if(ratioMecheAtr >= 0.5)
      multiplicateurMeche = bonusMecheNormale;

   return (int)MathRound((double)pointsRetests * multiplicateurMeche);
}

/**
 * 🚀 Simule l'avancée du prix depuis l'entrée à travers les paliers UOP selon le budget
 * de carburant initial et la résistance de friction, pour ancrer le Take Profit Optimal.
 */
void CalculerPorteeDynamiqueUOPSMC(
   double prixEntree,
   double prixSL,
   ENUM_DIRECTION_SMC direction,
   int carburantInitial,
   PalierUOPCandidatSMC &tpsCandidats[],
   int nbCandidats,
   double hauteurMoyenneATR,
   int peagePalierUOP,
   double coutParATR,
   double coutFrictionFortOverlap,
   double coutFrictionMoyenOverlap,
   double coutFrictionFaibleOverlap,
   double seuilFortOverlap,
   double seuilFaibleOverlap,
   double margeSecuriteDevantPalier,
   double &prixTPOptimalSortie,
   int &ordreTPSortie,
   int &carburantRestantSortie,
   int &paliersTraversesSortie,
   bool &estLimiteParPalierSortie
)
{
   bool estAchat      = (direction == DIRECTION_ACHAT);
   double distanceSL  = MathMax(_Point, MathAbs(prixEntree - prixSL));
   double atrSecurise = MathMax(_Point, hauteurMoyenneATR);

   // Cas de secours si aucun palier UOP n'est disponible
   if(nbCandidats <= 0)
   {
      double facteurSecours = MathMax(1.5, (double)carburantInitial / 150.0);
      prixTPOptimalSortie      = estAchat ? (prixEntree + distanceSL * facteurSecours) : (prixEntree - distanceSL * facteurSecours);
      ordreTPSortie            = 1;
      carburantRestantSortie   = 0;
      paliersTraversesSortie   = 0;
      estLimiteParPalierSortie = false;
      return;
   }

   double budgetRestant    = (double)carburantInitial;
   double prixDernierPoint = prixEntree;
   int paliersTraverses    = 0;
   double prixTPOptimal    = tpsCandidats[0].prixCible;
   int ordreTP             = 1;
   bool estLimite          = false;

   for(int i = 0; i < nbCandidats; i++)
   {
      double distancePalier = MathAbs(tpsCandidats[i].prixCible - prixDernierPoint);
      int budgetAvant       = (int)MathRound(budgetRestant);

      // 1️⃣ Consommation continue selon la distance franchie (en ATR) et le taux d'overlap
      double multFriction = coutFrictionMoyenOverlap;
      if(tpsCandidats[i].tauxMoyenChevauchement >= seuilFortOverlap)
         multFriction = coutFrictionFortOverlap;
      else if(tpsCandidats[i].tauxMoyenChevauchement < seuilFaibleOverlap)
         multFriction = coutFrictionFaibleOverlap;

      double consoDistance = (distancePalier / atrSecurise) * coutParATR * multFriction;
      budgetRestant -= consoDistance;

      tpsCandidats[i].budgetAvant = budgetAvant;

      // Si le budget s'épuise en chemin avant d'atteindre le palier
      if(budgetRestant <= 0.0)
      {
         double propRestante = MathMax(0.1, (budgetRestant + consoDistance) / MathMax(0.0001, consoDistance));
         double avancee      = distancePalier * propRestante;
         prixTPOptimal       = estAchat ? (prixDernierPoint + avancee) : (prixDernierPoint - avancee);
         estLimite           = true;
         ordreTP             = i + 1;

         tpsCandidats[i].estPerce    = false;
         tpsCandidats[i].estBloquant = true;
         tpsCandidats[i].budgetApres = 0;
         budgetRestant               = 0.0;
         break;
      }

      // 2️⃣ Péage de franchissement du palier UOP
      if(budgetRestant >= (double)peagePalierUOP)
      {
         budgetRestant -= (double)peagePalierUOP;
         paliersTraverses++;
         prixDernierPoint = tpsCandidats[i].prixCible;
         prixTPOptimal    = tpsCandidats[i].prixCible;
         ordreTP          = i + 1;

         tpsCandidats[i].estPerce    = true;
         tpsCandidats[i].estBloquant = false;
         tpsCandidats[i].budgetApres = (int)MathRound(budgetRestant);
      }
      else
      {
         // 🛑 Mur trop épais : on ancre le TP juste devant le palier avec la marge de sécurité
         double margeSecurite = atrSecurise * margeSecuriteDevantPalier;
         prixTPOptimal = estAchat
            ? MathMax(prixEntree + _Point, tpsCandidats[i].prixCible - margeSecurite)
            : MathMin(prixEntree - _Point, tpsCandidats[i].prixCible + margeSecurite);

         estLimite = true;
         ordreTP   = i + 1;

         tpsCandidats[i].estPerce    = false;
         tpsCandidats[i].estBloquant = true;
         tpsCandidats[i].budgetApres = (int)MathRound(budgetRestant);
         break;
      }
   }

   // 3️⃣ Si tous les paliers ont été percés et qu'il reste encore du carburant
   if(!estLimite && budgetRestant > 0.0 && paliersTraverses == nbCandidats)
   {
      double dernierPalier = tpsCandidats[nbCandidats - 1].prixCible;
      double distSupp      = (budgetRestant / MathMax(1.0, coutParATR)) * atrSecurise * 0.5;
      prixTPOptimal        = estAchat ? (dernierPalier + distSupp) : (dernierPalier - distSupp);
   }

   prixTPOptimalSortie      = NormalizeDouble(prixTPOptimal, _Digits);
   ordreTPSortie            = ordreTP;
   carburantRestantSortie   = MathMax(0, (int)MathRound(budgetRestant));
   paliersTraversesSortie   = paliersTraverses;
   estLimiteParPalierSortie = estLimite;
}

/**
 * ⏳ Vérifie la confirmation du Range (les N bougies clôturées après le Doji doivent
 * respecter le Stop Loss sans jamais le toucher) puis suit l'issue du trade (TP ou SL touché).
 *
 * Règle MT5 importante :
 * La bougie à l'index (totalBougies - 1) est la bougie en cours de formation.
 * La dernière bougie 100% clôturée est donc (totalBougies - 2).
 */
void VerifierConfirmationEtCycleDeVieSMC(
   const BougieSMC &bougies[],
   int totalBougies,
   int nbBougiesConfirmation,
   SetupOrchestreSMC_MT5 &setup
)
{
   bool estAchat              = (setup.type == DIRECTION_ACHAT);
   int indexDerniereCloturee  = totalBougies - 2;
   int indexFinConfirmation   = setup.indexDoji + nbBougiesConfirmation;

   setup.statut           = SETUP_EN_COURS;
   setup.bougiesObservees = 0;
   setup.estTermine       = false;
   setup.resultatTrade    = TRADE_EN_COURS;
   setup.indexSortieTrade = -1;
   setup.tempsSortieTrade = 0;

   // 1️⃣ Observation des N bougies de confirmation (bougies clôturées uniquement)
   int finObs = MathMin(indexDerniereCloturee, indexFinConfirmation);
   for(int k = setup.indexDoji + 1; k <= finObs; k++)
   {
      setup.bougiesObservees++;
      bool slCasse = estAchat
         ? (bougies[k].low <= setup.prixSL)
         : (bougies[k].high >= setup.prixSL);

      if(slCasse)
      {
         setup.statut = SETUP_ANNULE;
         return;
      }
   }

   // Vérifier aussi si la bougie en cours (totalBougies - 1) a déjà cassé le SL pendant la phase d'attente
   if(setup.bougiesObservees < nbBougiesConfirmation && totalBougies - 1 > setup.indexDoji)
   {
      BougieSMC bCourante = bougies[totalBougies - 1];
      bool slCasseEnCours = estAchat
         ? (bCourante.low <= setup.prixSL)
         : (bCourante.high >= setup.prixSL);
      if(slCasseEnCours)
      {
         setup.statut = SETUP_ANNULE;
         return;
      }
      // Toujours en attente de la clôture des 3 bougies
      setup.statut = SETUP_EN_COURS;
      return;
   }

   // 2️⃣ Les N bougies de confirmation sont toutes clôturées sans casser le SL : SETUP 100% CONFIRMÉ !
   setup.statut            = SETUP_CONFIRME;
   setup.indexConfirmation = indexFinConfirmation;
   setup.tempsConfirmation = bougies[indexFinConfirmation].temps;

   // 3️⃣ Suivi du cycle de vie post-confirmation (de indexFinConfirmation + 1 jusqu'à la bougie courante)
   for(int m = indexFinConfirmation + 1; m < totalBougies; m++)
   {
      BougieSMC bm = bougies[m];
      bool slTouche = estAchat ? (bm.low <= setup.prixSL)  : (bm.high >= setup.prixSL);
      bool tpTouche = estAchat ? (bm.high >= setup.prixTP) : (bm.low <= setup.prixTP);

      if(slTouche)
      {
         setup.estTermine       = true;
         setup.resultatTrade    = TRADE_SL_TOUCHE;
         setup.indexSortieTrade = m;
         setup.tempsSortieTrade = bm.temps;
         break;
      }
      if(tpTouche)
      {
         setup.estTermine       = true;
         setup.resultatTrade    = TRADE_TP_TOUCHE;
         setup.indexSortieTrade = m;
         setup.tempsSortieTrade = bm.temps;
         break;
      }
   }
}

#endif // MODULE_04_ENERGIE_ET_CONFIRMATION_MQH
//+------------------------------------------------------------------+

