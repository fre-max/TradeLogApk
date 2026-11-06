//+------------------------------------------------------------------+
//|                                         Module01_DojiEtPlage.mqh |
//|              🎼 Chef d'Orchestre SMC - Version MetaTrader 5       |
//|              BLOC 1 : Détection Doji Liq/Reint & Plage Ciblée    |
//+------------------------------------------------------------------+
#property copyright "JournalMobileAPK - Orchestrateur SMC MT5"
#property strict

#ifndef MODULE_01_DOJI_ET_PLAGE_MQH
#define MODULE_01_DOJI_ET_PLAGE_MQH

#include "Module00_TypesEtOutils.mqh"

/**
 * Vérifie si un duo de bougies (B1 = liquidation, B2 = réintégration) forme un
 * Doji personnalisé valide en Achat (Spring) ou en Vente (UTAD).
 *
 * Exemple :
 * ENUM_DIRECTION_SMC dir;
 * double prixExt;
 * bool ok = VerifierDojiSimple(b1, b2, moyHauteur, moyCorps, true, true, true, 1.0, 1.2, 0.30, 2.0, dir, prixExt);
 */
bool VerifierDojiSimple(
   const BougieSMC &b1,
   const BougieSMC &b2,
   double moyenneHauteur,
   double moyenneCorps,
   bool activerAchat,
   bool activerVente,
   bool activerFiltreTaille,
   double multiplicateurBougie1,
   double multiplicateurCorps2,
   double toleranceDeficit,
   double toleranceDepassement,
   ENUM_DIRECTION_SMC &directionSortie,
   double &prixExtremeSortie
)
{
   double hauteur1 = b1.high - b1.low;
   double corps2   = MathAbs(b2.close - b2.open);
   double rangeRef = MathMax(_Point, moyenneHauteur);

   // 1️⃣ Filtre de taille relative (les bougies du Doji doivent dépasser la moyenne récente)
   if(activerFiltreTaille)
   {
      if(hauteur1 < moyenneHauteur * multiplicateurBougie1)
         return false;
      if(corps2 < moyenneCorps * multiplicateurCorps2)
         return false;
   }

   double margeDeficit     = rangeRef * toleranceDeficit;
   double margeDepassement = MathMax(hauteur1, rangeRef) * toleranceDepassement;

   // 2️⃣ CAS ACHAT (Spring : B1 baissière de liquidation + B2 haussière de réintégration)
   bool b1Baissiere = (b1.close < b1.open);
   bool b2Haussiere = (b2.close > b2.open);

   if(activerAchat && b1Baissiere && b2Haussiere)
   {
      double seuilMinClose2 = b1.open - margeDeficit;
      double seuilMaxClose2 = b1.open + margeDepassement;

      if(b2.close >= seuilMinClose2 && b2.close <= seuilMaxClose2)
      {
         directionSortie   = DIRECTION_ACHAT;
         prixExtremeSortie = MathMin(b1.low, b2.low);
         return true;
      }
   }

   // 3️⃣ CAS VENTE (UTAD : B1 haussière de liquidation + B2 baissière de réintégration)
   bool b1Haussiere = (b1.close > b1.open);
   bool b2Baissiere = (b2.close < b2.open);

   if(activerVente && b1Haussiere && b2Baissiere)
   {
      double seuilMaxClose2Vente = b1.open + margeDeficit;
      double seuilMinClose2Vente = b1.open - margeDepassement;

      if(b2.close <= seuilMaxClose2Vente && b2.close >= seuilMinClose2Vente)
      {
         directionSortie   = DIRECTION_VENTE;
         prixExtremeSortie = MathMax(b1.high, b2.high);
         return true;
      }
   }

   return false;
}

/**
 * Recule dans le passé (depuis i - 2) pour trouver la bougie antérieure ayant atteint
 * ou dépassé le prix extrême du Doji. Définit le début de la plage temporelle ciblée.
 *
 * Exemple :
 * int idxDebut; datetime tDebut; double pDebut;
 * TrouverBougieExtremePrecedente(bougies, indexDoji, DIRECTION_ACHAT, prixSL, 100, idxDebut, tDebut, pDebut);
 */
void TrouverBougieExtremePrecedente(
   const BougieSMC &bougies[],
   int indexDoji,
   ENUM_DIRECTION_SMC type,
   double prixExtremeDoji,
   int maxReculRecherche,
   int &indexSortie,
   datetime &tempsSortie,
   double &prixSortie
)
{
   int debutScan = MathMax(0, indexDoji - 2);
   int finScan   = MathMax(0, indexDoji - 2 - maxReculRecherche);

   if(type == DIRECTION_ACHAT)
   {
      // Achat : on cherche la première bougie antérieure dont le Low <= Low du Doji
      for(int k = debutScan; k >= finScan; k--)
      {
         if(bougies[k].low <= prixExtremeDoji)
         {
            indexSortie = k;
            tempsSortie = bougies[k].temps;
            prixSortie  = bougies[k].low;
            return;
         }
      }

      // Sinon, on prend le plus bas absolu de la fenêtre scrutée
      int plusBasIndex   = debutScan;
      double plusBasPrix = bougies[debutScan].low;
      for(int k = debutScan; k >= finScan; k--)
      {
         if(bougies[k].low < plusBasPrix)
         {
            plusBasPrix  = bougies[k].low;
            plusBasIndex = k;
         }
      }
      indexSortie = plusBasIndex;
      tempsSortie = bougies[plusBasIndex].temps;
      prixSortie  = plusBasPrix;
   }
   else
   {
      // Vente : on cherche la première bougie antérieure dont le High >= High du Doji
      for(int k = debutScan; k >= finScan; k--)
      {
         if(bougies[k].high >= prixExtremeDoji)
         {
            indexSortie = k;
            tempsSortie = bougies[k].temps;
            prixSortie  = bougies[k].high;
            return;
         }
      }

      // Sinon, on prend le plus haut absolu de la fenêtre scrutée
      int plusHautIndex   = debutScan;
      double plusHautPrix = bougies[debutScan].high;
      for(int k = debutScan; k >= finScan; k--)
      {
         if(bougies[k].high > plusHautPrix)
         {
            plusHautPrix  = bougies[k].high;
            plusHautIndex = k;
         }
      }
      indexSortie = plusHautIndex;
      tempsSortie = bougies[plusHautIndex].temps;
      prixSortie  = plusHautPrix;
   }
}

/**
 * 🌟 FONCTION PRINCIPALE DU BLOC 1 : Détecte tous les Dojis de liquidation/réintégration
 * et calcule leur plage temporelle ciblée.
 *
 * Exemple :
 * SignalDojiPlageSMC signaux[];
 * int nb = DetecterDojisAvecPlage(bougies, total, indexDebutScan, true, true, true, 10, 1.0, 1.2, 0.30, 2.0, 100, signaux);
 */
int DetecterDojisAvecPlage(
   const BougieSMC &bougies[],
   int totalBougies,
   int indexDebutScan,
   bool activerAchat,
   bool activerVente,
   bool activerFiltreTaille,
   int periodeHistorique,
   double multiplicateurBougie1,
   double multiplicateurCorps2,
   double toleranceDeficit,
   double toleranceDepassement,
   int maxReculRecherche,
   SignalDojiPlageSMC &resultats[]
)
{
   ArrayResize(resultats, 0);
   if(totalBougies < 10)
      return 0;

   int pHist = MathMax(3, periodeHistorique);
   int debut = MathMax(2, indexDebutScan);

   // Note : en MT5, la bougie (totalBougies - 1) est la bougie en cours non clôturée.
   // On analyse jusqu'à (totalBougies - 2) pour ne valider que des Dojis sur bougies clôturées.
   int fin = totalBougies - 2;

   for(int i = debut; i <= fin; i++)
   {
      BougieSMC b1 = bougies[i - 1];
      BougieSMC b2 = bougies[i];

      // 1️⃣ Calcul de la hauteur moyenne et du corps moyen sur l'historique récent
      int idxDebutRef = MathMax(0, i - 1 - pHist);
      double sommeHauteurs = 0.0;
      double sommeCorps    = 0.0;
      int countRef         = 0;

      for(int k = idxDebutRef; k < i - 1; k++)
      {
         sommeHauteurs += (bougies[k].high - bougies[k].low);
         sommeCorps    += MathAbs(bougies[k].open - bougies[k].close);
         countRef++;
      }

      double moyHauteur = (countRef > 0) ? (sommeHauteurs / (double)countRef) : (b1.high - b1.low);
      double moyCorps   = (countRef > 0) ? (sommeCorps / (double)countRef) : MathAbs(b1.open - b1.close);
      if(moyHauteur <= 0.0)
         moyHauteur = _Point * 10.0;

      // 2️⃣ Vérification de la structure du Doji
      ENUM_DIRECTION_SMC typeDoji = DIRECTION_ACHAT;
      double prixExtreme = 0.0;

      bool estValide = VerifierDojiSimple(
         b1, b2, moyHauteur, moyCorps,
         activerAchat, activerVente, activerFiltreTaille,
         multiplicateurBougie1, multiplicateurCorps2,
         toleranceDeficit, toleranceDepassement,
         typeDoji, prixExtreme
      );

      if(!estValide)
         continue;

      // 3️⃣ Recherche de l'extrême précédent (début de la plage temporelle ciblée)
      int idxPrec       = 0;
      datetime tPrec    = 0;
      double prixPrec   = 0.0;

      TrouverBougieExtremePrecedente(
         bougies, i, typeDoji, prixExtreme, maxReculRecherche,
         idxPrec, tPrec, prixPrec
      );

      double tailleLiq = (typeDoji == DIRECTION_ACHAT)
         ? MathAbs(b1.open - b1.low)
         : MathAbs(b1.high - b1.open);

      int n = ArraySize(resultats);
      ArrayResize(resultats, n + 1);
      resultats[n].estValide            = true;
      resultats[n].type                 = typeDoji;
      resultats[n].indexBougie          = i;
      resultats[n].temps                = b2.temps;
      resultats[n].prixExtreme          = prixExtreme;
      resultats[n].open1                = b1.open;
      resultats[n].close2               = b2.close;
      resultats[n].tailleLiquidation    = tailleLiq;
      resultats[n].indexDebutPlage      = idxPrec;
      resultats[n].tempsDebutPlage      = tPrec;
      resultats[n].prixExtremePrecedent = prixPrec;
      resultats[n].moyenneHauteur       = moyHauteur;
   }

   return ArraySize(resultats);
}

#endif // MODULE_01_DOJI_ET_PLAGE_MQH
//+------------------------------------------------------------------+

