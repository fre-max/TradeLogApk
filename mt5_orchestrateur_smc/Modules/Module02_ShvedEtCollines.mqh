//+------------------------------------------------------------------+
//|                                      Module02_ShvedEtCollines.mqh|
//|              🎼 Chef d'Orchestre SMC - Version MetaTrader 5       |
//|     BLOC 2 : Moteur S/R Shved & Vraies Collines de Retests       |
//+------------------------------------------------------------------+
#property copyright "JournalMobileAPK - Orchestrateur SMC MT5"
#property strict

#ifndef MODULE_02_SHVED_ET_COLLINES_MQH
#define MODULE_02_SHVED_ET_COLLINES_MQH

#include "Module00_TypesEtOutils.mqh"

/**
 * Vérifie si la bougie à l'index i est un sommet fractal (Swing High) de rayon "facteur".
 */
bool EstFractalHautSMC(const BougieSMC &bougies[], int total, int index, int facteur)
{
   if(index < facteur || index + facteur >= total)
      return false;

   double hautRef = bougies[index].high;
   for(int k = 1; k <= facteur; k++)
   {
      if(bougies[index - k].high > hautRef)
         return false;
      if(bougies[index + k].high >= hautRef)
         return false;
   }
   return true;
}

/**
 * Vérifie si la bougie à l'index i est un creux fractal (Swing Low) de rayon "facteur".
 */
bool EstFractalBasSMC(const BougieSMC &bougies[], int total, int index, int facteur)
{
   if(index < facteur || index + facteur >= total)
      return false;

   double basRef = bougies[index].low;
   for(int k = 1; k <= facteur; k++)
   {
      if(bougies[index - k].low < basRef)
         return false;
      if(bougies[index + k].low <= basRef)
         return false;
   }
   return true;
}

/**
 * ⛰️ Analyse les contacts d'une zone S/R pour séparer :
 *  1️⃣ Les VRAIS retests : le prix quitte la zone pendant au moins 2 bougies ET forme une vraie
 *     colline / sommet d'au moins 1.5x ATR avant de revenir tester le niveau.
 *     Chaque colline est pondérée selon sa taille :
 *       - Petite colline (1.5x à < 2.5x ATR, >= 2 bougies) ➔ COLLINE_MINEURE (+8 pts)
 *       - Belle colline (2.5x à < 4.0x ATR, >= 3 bougies)  ➔ COLLINE_SOLIDE (+15 pts)
 *       - Grand sommet (>= 4.0x ATR, >= 4 bougies)         ➔ COLLINE_MAJEURE (+25 pts)
 *  2️⃣ Les MICRO-REBONDS ignorés : simple mèche ou rebond < 1.5x ATR ou < 2 bougies,
 *     fusionnés dans la même touche (0 retest supplémentaire).
 *
 * Exemple :
 * AnalyserRetestsAvecCollinesSMC(zone, bougies, total, idxDebut, idxFin, moyHauteur, zoneScoree);
 */
void AnalyserRetestsAvecCollinesSMC(
   const ZoneShvedSMC &zone,
   const BougieSMC &bougies[],
   int totalBougies,
   int indexDebut,
   int indexFin,
   double tailleMoyenneBougie,
   ZoneShvedScoreeSMC &sortieScoree
)
{
   sortieScoree.nbCollines        = 0;
   sortieScoree.nbTouchesIgnorees = 0;

   if(totalBougies <= 0)
      return;

   int debut = MathMax(0, indexDebut);
   int fin   = MathMin(totalBougies - 1, indexFin);
   if(debut > fin)
      return;

   // 1️⃣ Calcul de la hauteur moyenne (ATR) sécurisée sur la fenêtre si non fournie
   double atrReference = tailleMoyenneBougie;
   if(atrReference <= 0.0)
   {
      double sommeHauteurs = 0.0;
      int nbB = 0;
      for(int k = debut; k <= fin; k++)
      {
         sommeHauteurs += MathMax(_Point, bougies[k].high - bougies[k].low);
         nbB++;
      }
      atrReference = (nbB > 0) ? (sommeHauteurs / (double)nbB) : (_Point * 10.0);
   }
   double atrSecurise = MathMax(_Point, atrReference);

   // 2️⃣ Balayage chronologique des bougies pour détecter les contacts et mesurer les collines
   int indexDernierContact = -1;

   for(int k = debut; k <= fin; k++)
   {
      BougieSMC b = bougies[k];
      bool toucheZone = (b.low <= zone.prixHaut && b.high >= zone.prixBas);
      if(!toucheZone)
         continue;

      // Toute première touche dans la fenêtre = point d'ancrage initial
      if(indexDernierContact == -1)
      {
         indexDernierContact = k;
         continue;
      }

      // Nombre de bougies strictement hors de la zone entre les deux contacts
      int largeurBougies = k - indexDernierContact - 1;

      // A. Bougie immédiatement adjacente restant dans la zone : on fusionne le contact continu
      if(largeurBougies <= 0)
      {
         indexDernierContact = k;
         continue;
      }

      // B. Il y a au moins 1 bougie intermédiaire : on mesure le sommet/creux de la colline formée
      int indexSommetColline = indexDernierContact + 1;
      double prixSommetColline = (zone.type == ZONE_SUPPORT)
         ? bougies[indexSommetColline].high
         : bougies[indexSommetColline].low;

      for(int m = indexDernierContact + 1; m < k; m++)
      {
         if(zone.type == ZONE_SUPPORT)
         {
            if(bougies[m].high > prixSommetColline)
            {
               prixSommetColline  = bougies[m].high;
               indexSommetColline = m;
            }
         }
         else
         {
            if(bougies[m].low < prixSommetColline)
            {
               prixSommetColline  = bougies[m].low;
               indexSommetColline = m;
            }
         }
      }

      double hauteurColline = (zone.type == ZONE_SUPPORT)
         ? MathMax(0.0, prixSommetColline - zone.prixMedian)
         : MathMax(0.0, zone.prixMedian - prixSommetColline);

      double ratioCollineATR = NormalizeDouble(hauteurColline / atrSecurise, 2);

      // 3️⃣ Règle 1 : Validation de la colline (>= 2 bougies hors zone ET >= 1.5x ATR)
      if(largeurBougies >= 2 && ratioCollineATR >= 1.5)
      {
         // 4️⃣ Règle 2 : Pondération des points selon l'ampleur de la colline
         ENUM_QUALITE_COLLINE qualite = COLLINE_MINEURE;
         int pointsAttribues          = 8;

         if(ratioCollineATR >= 4.0 && largeurBougies >= 4)
         {
            qualite         = COLLINE_MAJEURE;
            pointsAttribues = 25;
         }
         else if(ratioCollineATR >= 2.5 && largeurBougies >= 3)
         {
            qualite         = COLLINE_SOLIDE;
            pointsAttribues = 15;
         }
         else
         {
            qualite         = COLLINE_MINEURE;
            pointsAttribues = 8;
         }

         if(sortieScoree.nbCollines < MAX_COLLINES_PAR_ZONE)
         {
            int idxC = sortieScoree.nbCollines;
            sortieScoree.collines[idxC].numeroRetest          = idxC + 1;
            sortieScoree.collines[idxC].indexTouchePrecedente = indexDernierContact;
            sortieScoree.collines[idxC].tempsTouchePrecedente = bougies[indexDernierContact].temps;
            sortieScoree.collines[idxC].indexToucheRetest     = k;
            sortieScoree.collines[idxC].tempsToucheRetest     = b.temps;
            sortieScoree.collines[idxC].indexSommetColline    = indexSommetColline;
            sortieScoree.collines[idxC].tempsSommetColline    = bougies[indexSommetColline].temps;
            sortieScoree.collines[idxC].prixSommetColline     = prixSommetColline;
            sortieScoree.collines[idxC].hauteurColline        = hauteurColline;
            sortieScoree.collines[idxC].ratioCollineATR       = ratioCollineATR;
            sortieScoree.collines[idxC].largeurBougies        = largeurBougies;
            sortieScoree.collines[idxC].qualite               = qualite;
            sortieScoree.collines[idxC].pointsAttribues       = pointsAttribues;
            sortieScoree.nbCollines++;
         }

         indexDernierContact = k;
      }
      else
      {
         // ⚪ Micro-rebond ignoré et fusionné dans la même touche
         if(sortieScoree.nbTouchesIgnorees < MAX_TOUCHES_IGNOREES)
         {
            int idxI = sortieScoree.nbTouchesIgnorees;
            sortieScoree.touchesIgnorees[idxI].index           = k;
            sortieScoree.touchesIgnorees[idxI].temps           = b.temps;
            sortieScoree.touchesIgnorees[idxI].prix            = zone.prixMedian;
            sortieScoree.touchesIgnorees[idxI].ratioCollineATR = ratioCollineATR;
            sortieScoree.touchesIgnorees[idxI].largeurBougies  = largeurBougies;
            sortieScoree.nbTouchesIgnorees++;
         }

         // On fusionne la touche pour que la prochaine colline soit mesurée depuis ce dernier contact
         indexDernierContact = k;
      }
   }
}

/**
 * Calcule les zones de Support (Demand) et Résistance (Supply) selon la formule de Shved,
 * avec vérification de vraie colline intermédiaire sur chaque retest.
 *
 * Exemple :
 * ZoneShvedSMC zones[];
 * int nbZones = CalculerShvedSupplyDemandSMC(bougies, total, 500, 2, 0.01, zones);
 */
int CalculerShvedSupplyDemandSMC(
   const BougieSMC &bougies[],
   int totalBougies,
   int maxLookbackBars,
   int periodeATR,
   double zoneFuzzFactor,
   ZoneShvedSMC &zonesSortie[]
)
{
   ArrayResize(zonesSortie, 0);
   int fastFactor = 3;
   int slowFactor = 6;

   if(totalBougies < slowFactor * 2 + 5)
      return 0;

   double tableauATR[];
   CalculerTableauATR(bougies, totalBougies, periodeATR, tableauATR);

   int indexDebut = MathMax(slowFactor, totalBougies - maxLookbackBars);
   int indexFin   = totalBougies - slowFactor - 1;
   datetime dateFinDefaut = bougies[totalBougies - 1].temps;

   for(int i = indexDebut; i <= indexFin; i++)
   {
      double atr = tableauATR[i];
      if(atr <= 0.0)
         atr = MathMax(_Point, bougies[i].high - bougies[i].low);

      double fu = (atr / 2.0) * zoneFuzzFactor;
      bool estFastHaut = EstFractalHautSMC(bougies, totalBougies, i, fastFactor);
      bool estFastBas  = EstFractalBasSMC(bougies, totalBougies, i, fastFactor);

      // ─── 🟥 CAS 1 : Sommet Fractal (Résistance / Supply) ───
      if(estFastHaut)
      {
         bool estSlowHaut = EstFractalHautSMC(bougies, totalBougies, i, slowFactor);
         bool estFaible   = !estSlowHaut;

         double hival = bougies[i].high + fu;
         double loval = MathMax(
            MathMin(bougies[i].close, bougies[i].high - fu),
            bougies[i].high - fu * 2.0
         );

         int testCount           = 0;
         bool estCassee          = false;
         int indexDerniereTouche = i;
         int indexCassure        = totalBougies - 1;
         datetime dateFin        = dateFinDefaut;

         for(int k = i + 1; k < totalBougies; k++)
         {
            BougieSMC b = bougies[k];

            // A. Vérification de retest avec obligation de colline intermédiaire
            if(b.high >= loval && b.low <= hival)
            {
               if(k - indexDerniereTouche <= 1)
               {
                  indexDerniereTouche = k;
               }
               else
               {
                  double creuxMin = loval;
                  for(int m = indexDerniereTouche + 1; m < k; m++)
                  {
                     if(bougies[m].low < creuxMin)
                        creuxMin = bougies[m].low;
                  }
                  double hauteurColline = MathMax(0.0, loval - creuxMin);
                  if(k - indexDerniereTouche >= 3 && hauteurColline >= atr * 1.2)
                     testCount++;
                  indexDerniereTouche = k;
               }
            }

            // B. Vérification de cassure (clôture au-dessus de la résistance)
            if(b.close > hival)
            {
               estCassee    = true;
               indexCassure = k;
               dateFin      = b.temps;
               break;
            }
         }

         int n = ArraySize(zonesSortie);
         ArrayResize(zonesSortie, n + 1);
         zonesSortie[n].idNumerique  = i;
         zonesSortie[n].type         = ZONE_RESISTANCE;
         zonesSortie[n].prixHaut     = hival;
         zonesSortie[n].prixBas      = loval;
         zonesSortie[n].prixMedian   = (hival + loval) / 2.0;
         zonesSortie[n].retests      = testCount;
         zonesSortie[n].estFaible    = estFaible;
         zonesSortie[n].estCassee    = estCassee;
         zonesSortie[n].indexOrigine = i;
         zonesSortie[n].dateDebut    = bougies[i].temps;
         zonesSortie[n].dateFin      = dateFin;
         zonesSortie[n].indexCassure = indexCassure;
      }

      // ─── 🟩 CAS 2 : Creux Fractal (Support / Demand) ───
      if(estFastBas)
      {
         bool estSlowBas = EstFractalBasSMC(bougies, totalBougies, i, slowFactor);
         bool estFaible  = !estSlowBas;

         double loval = bougies[i].low - fu;
         double hival = MathMin(
            MathMax(bougies[i].close, bougies[i].low + fu),
            bougies[i].low + fu * 2.0
         );

         int testCount           = 0;
         bool estCassee          = false;
         int indexDerniereTouche = i;
         int indexCassure        = totalBougies - 1;
         datetime dateFin        = dateFinDefaut;

         for(int k = i + 1; k < totalBougies; k++)
         {
            BougieSMC b = bougies[k];

            // A. Vérification de retest avec obligation de colline intermédiaire
            if(b.low <= hival && b.high >= loval)
            {
               if(k - indexDerniereTouche <= 1)
               {
                  indexDerniereTouche = k;
               }
               else
               {
                  double sommetMax = hival;
                  for(int m = indexDerniereTouche + 1; m < k; m++)
                  {
                     if(bougies[m].high > sommetMax)
                        sommetMax = bougies[m].high;
                  }
                  double hauteurColline = MathMax(0.0, sommetMax - hival);
                  if(k - indexDerniereTouche >= 3 && hauteurColline >= atr * 1.2)
                     testCount++;
                  indexDerniereTouche = k;
               }
            }

            // B. Vérification de cassure (clôture sous le support)
            if(b.close < loval)
            {
               estCassee    = true;
               indexCassure = k;
               dateFin      = b.temps;
               break;
            }
         }

         int n = ArraySize(zonesSortie);
         ArrayResize(zonesSortie, n + 1);
         zonesSortie[n].idNumerique  = i;
         zonesSortie[n].type         = ZONE_SUPPORT;
         zonesSortie[n].prixHaut     = hival;
         zonesSortie[n].prixBas      = loval;
         zonesSortie[n].prixMedian   = (hival + loval) / 2.0;
         zonesSortie[n].retests      = testCount;
         zonesSortie[n].estFaible    = estFaible;
         zonesSortie[n].estCassee    = estCassee;
         zonesSortie[n].indexOrigine = i;
         zonesSortie[n].dateDebut    = bougies[i].temps;
         zonesSortie[n].dateFin      = dateFin;
         zonesSortie[n].indexCassure = indexCassure;
      }
   }

   return ArraySize(zonesSortie);
}

/**
 * Calcule le score de liquidité institutionnelle sur 100 points pour un niveau Shved :
 *  1. Retests pondérés par la taille de leur colline (max 35 pts)
 *  2. Rejets / Hauteur de la montagne (max 30 pts)
 *  3. Proportionnalité liquidation Doji / rejet (max 25 pts)
 *  4. Intégrité de la zone avant le Doji (max 10 pts)
 */
void CalculerScoreZoneShvedSMC(
   const ZoneShvedSMC &zone,
   const BougieSMC &bougies[],
   int totalBougies,
   int indexBougie1,
   datetime tempsBougie1,
   double tailleLiquidation,
   double tailleMoyenneBougie,
   ZoneShvedScoreeSMC &sortieScoree
)
{
   sortieScoree.zone          = zone;
   sortieScoree.estSectionnee = false;
   sortieScoree.estRetenue    = false;

   int indexDepart          = MathMax(0, zone.indexOrigine);
   int finIndex             = MathMin(totalBougies - 1, indexBougie1);
   int finIndexRetestsAvant = MathMax(indexDepart, finIndex - 1);

   // 1️⃣ Analyse des vraies collines de retest survenues strictement avant la bougie de liquidation B1
   AnalyserRetestsAvecCollinesSMC(
      zone,
      bougies,
      totalBougies,
      indexDepart,
      finIndexRetestsAvant,
      tailleMoyenneBougie,
      sortieScoree
   );

   int retestsAvant  = sortieScoree.nbCollines;
   int pointsRetests = 5;

   if(retestsAvant > 0)
   {
      int sommePointsCollines = 0;
      for(int c = 0; c < sortieScoree.nbCollines; c++)
         sommePointsCollines += sortieScoree.collines[c].pointsAttribues;
      pointsRetests = MathMin(35, 5 + sommePointsCollines);
   }

   // 2️⃣ Amplitude moyenne des rejets ("hauteur de la montagne")
   double sommetMax = zone.prixMedian;
   double creuxMin  = zone.prixMedian;

   for(int j = indexDepart; j <= finIndex; j++)
   {
      if(bougies[j].high > sommetMax)
         sommetMax = bougies[j].high;
      if(bougies[j].low < creuxMin)
         creuxMin = bougies[j].low;
   }

   double hauteurTotaleRejet = (zone.type == ZONE_SUPPORT)
      ? (sommetMax - zone.prixMedian)
      : (zone.prixMedian - creuxMin);

   double rejetMoyen = 0.0;
   if(sortieScoree.nbCollines > 0)
   {
      double sommeHauteursCollines = 0.0;
      for(int c = 0; c < sortieScoree.nbCollines; c++)
         sommeHauteursCollines += sortieScoree.collines[c].hauteurColline;
      rejetMoyen = MathMax(_Point, sommeHauteursCollines / (double)sortieScoree.nbCollines);
   }
   else
   {
      rejetMoyen = MathMax(_Point, hauteurTotaleRejet / (double)MathMax(1, retestsAvant));
   }

   double ratioRejetMoyen = rejetMoyen / MathMax(_Point, tailleMoyenneBougie);
   int pointsRejets = 10;
   if(ratioRejetMoyen >= 2.5)
      pointsRejets = 30;
   else if(ratioRejetMoyen >= 1.0)
      pointsRejets = 20;

   // 3️⃣ Proportionnalité de la liquidation (Taille Bougie 1 vs Rejet Moyen)
   double ratioProportion = tailleLiquidation / MathMax(_Point, rejetMoyen);
   int pointsProportionnalite = 5;
   if(ratioProportion >= 0.20 && ratioProportion <= 0.80)
      pointsProportionnalite = 25;
   else if(ratioProportion >= 0.10 && ratioProportion <= 1.20)
      pointsProportionnalite = 15;

   // 4️⃣ Intégrité de la zone (intacte avant le Doji)
   bool estIntacteAvant = (!zone.estCassee || zone.dateFin >= tempsBougie1);
   int pointsIntegrite  = estIntacteAvant ? 10 : 0;

   // 5️⃣ Score total sur 100 points
   int scoreTotal = MathMin(100, pointsRetests + pointsRejets + pointsProportionnalite + pointsIntegrite);

   sortieScoree.score                  = scoreTotal;
   sortieScoree.retestsAvant           = retestsAvant;
   sortieScoree.rejetMoyen             = rejetMoyen;
   sortieScoree.ratioProportion        = ratioProportion;
   sortieScoree.pointsRetests          = pointsRetests;
   sortieScoree.pointsRejets           = pointsRejets;
   sortieScoree.pointsProportionnalite = pointsProportionnalite;
   sortieScoree.pointsIntegrite        = pointsIntegrite;
}

/**
 * 🌟 FONCTION PRINCIPALE DU BLOC 2 : Évalue, filtre et classe par score décroissant
 * les zones Shved dans la plage temporelle d'un signal Doji donné.
 */
int EvaluerNiveauxShvedDansPlageSMC(
   const ZoneShvedSMC &toutesLesZones[],
   int totalZones,
   const SignalDojiPlageSMC &signalDoji,
   const BougieSMC &bougies[],
   int totalBougies,
   bool exigerDebutEtFinDansPlage,
   int scoreMinimum,
   ZoneShvedScoreeSMC &zonesRetenues[]
)
{
   ArrayResize(zonesRetenues, 0);
   datetime tempsDebutPlage = signalDoji.tempsDebutPlage;
   datetime tempsFinPlage   = signalDoji.temps;
   int indexBougie1         = MathMax(0, signalDoji.indexBougie - 1);

   ENUM_TYPE_ZONE_SHVED typeCible = (signalDoji.type == DIRECTION_ACHAT)
      ? ZONE_SUPPORT
      : ZONE_RESISTANCE;

   for(int z = 0; z < totalZones; z++)
   {
      ZoneShvedSMC zone = toutesLesZones[z];

      // 1. Filtrage directionnel strict : Supports pour Achat, Résistances pour Vente
      if(zone.type != typeCible)
         continue;

      bool debutCompris = (zone.dateDebut >= tempsDebutPlage && zone.dateDebut <= tempsFinPlage);
      bool finComprise  = (zone.dateFin >= tempsDebutPlage && zone.dateFin <= tempsFinPlage);

      bool garderZone   = false;
      bool estSectionnee = false;
      ZoneShvedSMC zoneAEvaluer = zone;

      if(debutCompris && finComprise)
      {
         garderZone = true;
      }
      else if(zone.dateDebut < tempsDebutPlage && zone.dateFin >= tempsDebutPlage)
      {
         // ✂️ Zone née avant la plage mais traversant notre plage : on vérifie s'il y a de vraies collines dans la plage
         ZoneShvedScoreeSMC testSection;
         AnalyserRetestsAvecCollinesSMC(
            zone,
            bougies,
            totalBougies,
            signalDoji.indexDebutPlage,
            MathMax(signalDoji.indexDebutPlage, indexBougie1 - 1),
            signalDoji.moyenneHauteur,
            testSection
         );

         if(testSection.nbCollines > 0)
         {
            zoneAEvaluer.dateDebut    = signalDoji.tempsDebutPlage;
            zoneAEvaluer.indexOrigine = signalDoji.indexDebutPlage;
            zoneAEvaluer.retests      = testSection.nbCollines;
            zoneAEvaluer.estFaible    = false;
            garderZone                = true;
            estSectionnee             = true;
         }
         else if(!exigerDebutEtFinDansPlage)
         {
            garderZone = true;
         }
      }
      else if(!exigerDebutEtFinDansPlage && (zone.dateDebut <= tempsFinPlage && zone.dateFin >= tempsDebutPlage))
      {
         garderZone = true;
      }

      if(!garderZone)
         continue;

      ZoneShvedScoreeSMC evalScore;
      CalculerScoreZoneShvedSMC(
         zoneAEvaluer,
         bougies,
         totalBougies,
         indexBougie1,
         bougies[indexBougie1].temps,
         signalDoji.tailleLiquidation,
         signalDoji.moyenneHauteur,
         evalScore
      );
      evalScore.estSectionnee = estSectionnee;

      if(evalScore.score >= scoreMinimum)
      {
         int n = ArraySize(zonesRetenues);
         ArrayResize(zonesRetenues, n + 1);
         zonesRetenues[n] = evalScore;
      }
   }

   // Tri décroissant par score (les zones institutionnelles les plus solides en premier)
   int nbRetenues = ArraySize(zonesRetenues);
   for(int a = 0; a < nbRetenues - 1; a++)
   {
      for(int b = a + 1; b < nbRetenues; b++)
      {
         if(zonesRetenues[b].score > zonesRetenues[a].score)
         {
            ZoneShvedScoreeSMC temp = zonesRetenues[a];
            zonesRetenues[a]        = zonesRetenues[b];
            zonesRetenues[b]        = temp;
         }
      }
   }

   if(nbRetenues > 0)
      zonesRetenues[0].estRetenue = true;

   return nbRetenues;
}

#endif // MODULE_02_SHVED_ET_COLLINES_MQH
//+------------------------------------------------------------------+

