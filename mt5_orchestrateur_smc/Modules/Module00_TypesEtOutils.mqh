//+------------------------------------------------------------------+
//|                                      Module00_TypesEtOutils.mqh  |
//|              🎼 Chef d'Orchestre SMC - Version MetaTrader 5       |
//|              Structures de données et fonctions utilitaires      |
//+------------------------------------------------------------------+
#property copyright "JournalMobileAPK - Orchestrateur SMC MT5"
#property strict

#ifndef MODULE_00_TYPES_ET_OUTILS_MQH
#define MODULE_00_TYPES_ET_OUTILS_MQH

// ─── 🔢 Constantes de dimensionnement sécurisé (évite les copies complexes MQL5) ───
#define MAX_COLLINES_PAR_ZONE   10
#define MAX_TOUCHES_IGNOREES    10
#define MAX_ZONES_CANDIDATES    15
#define MAX_PALIERS_UOP         6
#define MAX_PIVOTS_ZIGZAG       12

// ─── 📊 Énumérations de Réglages et Statuts ─────────────────────────────────────

// Direction d'un signal ou d'un setup
enum ENUM_DIRECTION_SMC
{
   DIRECTION_ACHAT = 1,   // Achat (Spring / Liquidation Basse)
   DIRECTION_VENTE = -1   // Vente (UTAD / Liquidation Haute)
};

// Type de zone Shved Supply & Demand
enum ENUM_TYPE_ZONE_SHVED
{
   ZONE_SUPPORT    = 1,   // Support (Demand)
   ZONE_RESISTANCE = -1   // Résistance (Supply)
};

// Qualité d'une colline de retest selon sa hauteur en ATR et sa largeur en bougies
enum ENUM_QUALITE_COLLINE
{
   COLLINE_MINEURE = 1,   // Petite colline (1.5x à < 2.5x ATR, >= 2 bougies) -> +8 pts
   COLLINE_SOLIDE  = 2,   // Belle colline (2.5x à < 4.0x ATR, >= 3 bougies)  -> +15 pts
   COLLINE_MAJEURE = 3    // Grand sommet (>= 4.0x ATR, >= 4 bougies)         -> +25 pts
};

// Mode de calcul du Take Profit Optimal
enum ENUM_MODE_CALCUL_TP
{
   MODE_TP_ENERGIE_FRICTION = 0, // Moteur d'Énergie (Carburant vs Friction UOP) [Recommandé]
   MODE_TP_STANDARD_SHVED   = 1  // Proportionnel au Score Shved (TP1 ou TP2)
};

// Choix forcé ou automatique du palier de Take Profit
enum ENUM_PALIER_TP_VISE
{
   PALIER_AUTO = 0,       // Automatique (calculé par le moteur d'énergie)
   PALIER_TP1  = 1,       // Forcer TP1 (1er palier UOP)
   PALIER_TP2  = 2,       // Forcer TP2 (2ème palier UOP)
   PALIER_TP3  = 3        // Forcer TP3 (3ème palier UOP)
};

// Traitement anatomique des bougies dans le calcul de chevauchement UOP
enum ENUM_TYPE_CHEVAUCHEMENT_UOP
{
   UOP_PONDERE         = 0, // Pondéré (Corps = 1.0, Mèches = 0.25) [Recommandé]
   UOP_CORPS_SEUL      = 1, // Corps uniquement (Open..Close)
   UOP_CORPS_ET_MECHES = 2  // Bougie entière (High..Low = 1.0)
};

// Statut de confirmation du setup (après observation des N bougies de confirmation)
enum ENUM_STATUT_SETUP_SMC
{
   SETUP_EN_COURS = 0,    // En attente de la clôture des 3 bougies de confirmation
   SETUP_CONFIRME = 1,    // 100% Confirmé (les 3 bougies ont respecté le Stop Loss)
   SETUP_ANNULE   = -1    // Annulé (l'une des 3 bougies a cassé le Stop Loss)
};

// Issue finale du trade après sa confirmation
enum ENUM_RESULTAT_TRADE_SMC
{
   TRADE_EN_COURS  = 0,   // Trade toujours actif (ni TP ni SL touché)
   TRADE_TP_TOUCHE = 1,   // Gagnant : le prix a atteint le Take Profit
   TRADE_SL_TOUCHE = -1   // Perdant : le prix a touché le Stop Loss
};

// ─── 🧱 Structures de Données Linéaires ─────────────────────────────────────────

/**
 * Représentation d'une bougie (index 0 = plus ancienne, index total-1 = plus récente)
 */
struct BougieSMC
{
   datetime temps;
   double   open;
   double   high;
   double   low;
   double   close;
   long     volume;
};

/**
 * Signal Doji de liquidation/réintégration avec sa plage temporelle ciblée (BLOC 1)
 */
struct SignalDojiPlageSMC
{
   bool               estValide;
   ENUM_DIRECTION_SMC type;
   int                indexBougie;          // Index de la Bougie 2 (réintégration)
   datetime           temps;                // Horodatage de la Bougie 2
   double             prixExtreme;          // Plus bas (Achat) ou Plus haut (Vente) du Doji = Stop Loss
   double             open1;                // Open de la Bougie 1
   double             close2;               // Close de la Bougie 2 = Prix d'entrée
   double             tailleLiquidation;    // Amplitude de la liquidation sur B1
   int                indexDebutPlage;      // Index de la bougie extrême antérieure
   datetime           tempsDebutPlage;      // Date de début de la plage ciblée
   double             prixExtremePrecedent; // Prix de l'extrême antérieur
   double             moyenneHauteur;       // Hauteur moyenne (ATR local) des bougies précédentes
};

/**
 * ⛰️ Détail d'une vraie colline de retest validée sur un Support ou une Résistance
 */
struct DetailCollineRetestSMC
{
   int                  numeroRetest;          // Numéro d'ordre du retest (1, 2, 3...)
   int                  indexTouchePrecedente; // Index du contact précédent sur la zone
   datetime             tempsTouchePrecedente; // Date du contact précédent
   int                  indexToucheRetest;     // Index de la bougie qui revient tester la zone
   datetime             tempsToucheRetest;     // Date de la bougie de retest
   int                  indexSommetColline;    // Index du point culminant de la colline
   datetime             tempsSommetColline;    // Date du point culminant de la colline
   double               prixSommetColline;     // Prix du sommet (Support) ou creux (Résistance)
   double               hauteurColline;        // Hauteur de la colline en prix
   double               ratioCollineATR;       // Hauteur de la colline en multiple d'ATR (ex: 3.2x ATR)
   int                  largeurBougies;        // Nombre de bougies hors zone formant la colline
   ENUM_QUALITE_COLLINE qualite;               // Catégorie (MINEURE, SOLIDE, MAJEURE)
   int                  pointsAttribues;       // Points gagnés (+8, +15 ou +25 pts)
};

/**
 * ⚪ Détail d'un micro-rebond ignoré et fusionné dans la même touche
 */
struct DetailToucheIgnoreeSMC
{
   int      index;             // Index de la bougie ayant retouché la zone sans vraie colline
   datetime temps;             // Date de la bougie ignorée
   double   prix;              // Prix médian de contact
   double   ratioCollineATR;   // Amplitude du micro-rebond en ATR (< 1.5x ATR)
   int      largeurBougies;    // Nombre de bougies hors zone
};

/**
 * Zone de Support ou Résistance Shved brute
 */
struct ZoneShvedSMC
{
   int                  idNumerique;
   ENUM_TYPE_ZONE_SHVED type;
   double               prixHaut;
   double               prixBas;
   double               prixMedian;
   int                  retests;
   bool                 estFaible;
   bool                 estCassee;
   int                  indexOrigine;
   datetime             dateDebut;
   datetime             dateFin;
   int                  indexCassure;
};

/**
 * Zone Shved évaluée et scorée dans la plage temporelle du Doji (BLOC 2)
 */
struct ZoneShvedScoreeSMC
{
   ZoneShvedSMC           zone;
   int                    score;                  // Score global sur 100 points
   int                    retestsAvant;           // Nombre de vrais retests avec colline avant le Doji
   double                 rejetMoyen;             // Amplitude moyenne des collines
   double                 ratioProportion;        // Ratio taille liquidation / rejet moyen
   int                    pointsRetests;          // Points attribués aux retests (max 35)
   int                    pointsRejets;           // Points attribués à la hauteur de rejet (max 30)
   int                    pointsProportionnalite; // Points attribués à la proportionnalité (max 25)
   int                    pointsIntegrite;        // Points bonus intégrité (max 10)
   bool                   estSectionnee;          // Vrai si la zone a été sectionnée au début de la plage
   bool                   estRetenue;             // Vrai si c'est la meilleure zone retenue
   int                    nbCollines;             // Nombre de collines stockées dans le tableau ci-dessous
   DetailCollineRetestSMC collines[MAX_COLLINES_PAR_ZONE];
   int                    nbTouchesIgnorees;      // Nombre de micro-rebonds ignorés stockés ci-dessous
   DetailToucheIgnoreeSMC touchesIgnorees[MAX_TOUCHES_IGNOREES];
};

/**
 * Pivot ZigZag retenu pour l'analyse UOP et l'affichage diagnostic
 */
struct PivotZigZagSMC
{
   int      index;
   datetime temps;
   double   prix;
   bool     estHaut;
};

/**
 * 🌊 Détails du Score de Liquidation (/100) pilotant le ZigZag Dynamique (depth 4 à 20)
 */
struct DetailsScoreLiquidationZigZagSMC
{
   int            scoreTotal;               // Score sur 100 (Cassure /40 + Bougie&Zone /30 + Retests /30)
   int            pointsProfondeurCassure;  // Sur 40 pts
   int            pointsTailleBougieEtZone; // Sur 30 pts
   int            pointsRetestsSR;          // Sur 30 pts (pondéré par les collines)
   double         ratioProfondeurATR;
   double         ratioTailleBougieATR;
   double         ratioEpaisseurZoneATR;
   int            nombreRetests;
   int            zigzagDepthRetenu;        // Taille dynamique des vagues ZigZag (entre 4 et 20)
   int            nbPivots;
   PivotZigZagSMC pivots[MAX_PIVOTS_ZIGZAG];
};

/**
 * Palier de Take Profit candidat issu du profil de chevauchement UOP
 */
struct PalierUOPCandidatSMC
{
   int    ordre;                  // 1 = TP1, 2 = TP2, 3 = TP3
   double prixCible;              // Prix d'ancrage du palier UOP
   double prixBasZone;            // Borne basse du corridor goudronné
   double prixHautZone;           // Borne haute du corridor goudronné
   double tauxMoyenChevauchement; // Densité moyenne de bougies superposées
   double amplitudePoints;        // Hauteur du corridor
   bool   estPerce;               // Vrai si le carburant a permis de percer ce palier
   bool   estBloquant;            // Vrai si le TP s'est arrêté devant ce palier
   int    budgetAvant;            // Carburant avant ce palier
   int    budgetApres;            // Carburant après ce palier
};

/**
 * Setup complet orchestré par le Chef d'Orchestre SMC
 */
struct SetupOrchestreSMC_MT5
{
   int                              idSetup;
   ENUM_DIRECTION_SMC               type;
   ENUM_STATUT_SETUP_SMC            statut;
   int                              indexDoji;
   datetime                         tempsDoji;
   int                              indexConfirmation; // Index de la N-ième bougie de confirmation
   datetime                         tempsConfirmation; // Date de la bougie qui valide définitivement le setup
   int                              indexDebutPlage;
   datetime                         tempsDebutPlage;
   double                           prixEntree;
   double                           prixSL;
   double                           distanceSL;
   double                           prixTP;
   int                              ordreTP;
   double                           distanceTP;
   double                           ratioRR;
   int                              scoreShved;
   bool                             aMeilleureZone;
   ZoneShvedScoreeSMC               meilleureZone;
   int                              carburantInitial;
   int                              carburantRestant;
   int                              paliersTraverses;
   bool                             estLimiteParPalier;
   DetailsScoreLiquidationZigZagSMC scoreZigZag;
   int                              nbPaliersUOP;
   PalierUOPCandidatSMC             paliersUOP[MAX_PALIERS_UOP];
   bool                             infoPlageTPValide;
   int                              bougieTPIndex;
   datetime                         bougieTPTemps;
   int                              bougiesObservees;
   bool                             estTermine;
   ENUM_RESULTAT_TRADE_SMC          resultatTrade;
   int                              indexSortieTrade;
   datetime                         tempsSortieTrade;
};

// ─── 🛠️ Fonctions Utilitaires Mathématiques & Temporelles ───────────────────────

/**
 * Calcule le tableau des valeurs ATR (Average True Range) sur une série de bougies.
 *
 * Exemple :
 * double atr[];
 * CalculerTableauATR(bougies, total, 14, atr);
 */
void CalculerTableauATR(const BougieSMC &bougies[], int total, int periode, double &tableauATR[])
{
   ArrayResize(tableauATR, total);
   if(total <= 0)
      return;

   int p = MathMax(1, periode);
   double cumul = 0.0;

   for(int i = 0; i < total; i++)
   {
      double tr = bougies[i].high - bougies[i].low;
      if(i > 0)
      {
         double hc = MathAbs(bougies[i].high - bougies[i - 1].close);
         double lc = MathAbs(bougies[i].low - bougies[i - 1].close);
         tr = MathMax(tr, MathMax(hc, lc));
      }
      if(tr <= 0.0)
         tr = _Point * 10.0;

      if(i < p)
      {
         cumul += tr;
         tableauATR[i] = cumul / (double)(i + 1);
      }
      else
      {
         tableauATR[i] = ((tableauATR[i - 1] * (p - 1)) + tr) / (double)p;
      }
   }
}

/**
 * Formate un prix selon le nombre de décimales du symbole courant sur MetaTrader 5.
 *
 * Exemple :
 * string texte = FormaterPrixSymbole(1.08542); // "1.08542"
 */
string FormaterPrixSymbole(double prix)
{
   return DoubleToString(prix, _Digits);
}

#endif // MODULE_00_TYPES_ET_OUTILS_MQH
//+------------------------------------------------------------------+

