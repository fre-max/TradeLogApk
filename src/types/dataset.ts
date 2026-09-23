/**
 * Types pour le système de collecte et d'annotation de données IA.
 * Permet de standardiser les captures d'images, les métadonnées et le format d'annotation YOLO.
 */

// Boîte englobante normalisée au format YOLO (valeurs relatives entre 0.0 et 1.0)
export interface BoundingBoxYOLO {
  classeId: number;       // 0: Setup Achat (Long), 1: Setup Vente (Short), 2: Zone POI
  classeNom: string;     // 'long' | 'short' | 'poi' | 'negative'
  xCentre: number;       // Coordonnée X du centre de la boîte (0 = gauche, 1 = droite)
  yCentre: number;       // Coordonnée Y du centre de la boîte (0 = haut, 1 = bas)
  largeur: number;       // Largeur de la boîte relative à la largeur de l'image (0..1)
  hauteur: number;       // Hauteur de la boîte relative à la hauteur de l'image (0..1)
}

// Représente un échantillon complet collecté pour le dataset
export interface EchantillonIA {
  id: string;                      // Identifiant unique (UUID)
  dateCreation: string;            // Date ISO de la capture
  paire: string;                   // Ex: 'EURUSD', 'XAUUSD', 'BTCUSD'
  timeframe: string;               // Ex: 'M5', 'M15', 'H1'
  typeEchantillon: 'positif' | 'negatif'; // 'positif' = setup valide, 'negatif' = faux signal / pas de setup
  direction: 'long' | 'short' | 'neutre';
  
  // Paramètres de standardisation
  nbBougies: number;               // Nombre exact de bougies visibles dans le cadre (ex: 80)
  dateBougieDeclencheur: string | number; // Date/timestamp de la bougie de déclenchement (dernière bougie visible)
  
  // Données de trading associées
  prixEntree?: number;
  stopLoss?: number;
  takeProfit?: number;
  ratioRR?: number;
  resultatTrade?: 'win' | 'loss' | 'breakeven' | 'missed' | 'inconnu';
  sessionTrading?: 'Asian' | 'London' | 'New York';
  scoreMacro?: number;
  
  // Images (stockées en base64 pour un accès immédiat offline dans IndexedDB)
  imageCleanBase64: string;        // Graphique nu (sans grille, sans indicateurs) pour l'IA
  imageAnnotatedBase64: string;    // Graphique avec boîtes et niveaux pour le contrôle humain
  
  // Annotations
  boundingBoxes: BoundingBoxYOLO[]; // Liste des boîtes au format YOLO
}

// Configuration du Mode Studio IA
export interface AIDatasetConfig {
  modeActif: boolean;              // Indique si la barre d'outils IA est active
  nbBougiesCadre: number;          // Nombre de bougies à cadrer (60, 80 ou 100)
  resolutionCible: number;         // Largeur/hauteur en pixels (ex: 800)
  masquerGrille: boolean;          // Toujours true pour l'IA
  autoSauvegardeYOLO: boolean;     // Générer automatiquement le fichier .txt
}
