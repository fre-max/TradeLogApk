import type { Bougie } from '@/lib/chartDataHelper';

/**
 * Primitives graphiques universelles que les scripts d'indicateurs
 * peuvent retourner pour être affichées automatiquement sur le graphique.
 */

// Boîte de zone (ex: Order Block, FVG, Range, Zone Discount/Premium)
export interface VisualBox {
  id?: string;
  prixHaut: number;
  prixBas: number;
  dateDebut: string | number;
  dateFin?: string | number; // Si absent, s'étend jusqu'à la dernière bougie
  couleurFond?: string;      // Ex: 'rgba(38, 166, 154, 0.2)'
  couleurBordure?: string;   // Ex: '#26a69a'
  opacite?: number;
  label?: string;            // Ex: 'OB Bullish', 'FVG'
}

// Ligne de structure ou niveau clé (ex: BOS, CHoCH, Swing High, POC, Pivot)
export interface VisualLine {
  id?: string;
  prix: number;              // Prix de départ (ou prix horizontal unique)
  prixFin?: number;           // Prix d'arrivée (si différent de prix, trace une ligne oblique / trendline !)
  dateDebut: string | number;
  dateFin?: string | number;
  couleur?: string;          // Ex: '#2962ff'
  epaisseur?: number;        // Ex: 1.5
  style?: 'solid' | 'dashed' | 'dotted';
  label?: string;            // Ex: 'CHoCH +', 'Trendline BSL'
}

// Étiquette textuelle (ex: HH, HL, LH, LL, Signal BUY/SELL)
export interface VisualLabel {
  id?: string;
  prix: number;
  date: string | number;
  texte: string;             // Ex: 'HH', 'CHOCH'
  couleur?: string;          // Couleur du texte
  couleurFond?: string;      // Fond du badge (optionnel)
  position?: 'above' | 'below'; // Au-dessus du sommet ou en-dessous du creux
}

// Courbe continue (ex: EMA, SMA, VWAP, Bandes de Bollinger)
export interface VisualCurve {
  nom: string;
  couleur: string;
  points: Array<{
    time: string | number;
    value: number;
  }>;
}

// Point discret sur le graphique (ex: Point sur une bougie mère, sommet, creux)
export interface VisualPoint {
  id?: string;
  prix: number;
  date: string | number;
  couleur?: string;
  rayon?: number; // Rayon en pixels (ex: 4px)
  style?: 'plein' | 'contour';
}

/**
 * Ensemble de toutes les primitives visuelles retournées par un script
 */
export interface VisualPrimitives {
  boites?: VisualBox[];
  lignes?: VisualLine[];
  labels?: VisualLabel[];
  courbes?: VisualCurve[];
  points?: VisualPoint[];
}

/**
 * Données d'entrée fournies à la méthode calculer() du script
 */
export interface IndicatorContext {
  // Historique des bougies visibles jusqu'au moment présent
  bougies: Bougie[];
  // Unité de temps actuelle (ex: 'M1', 'M5', 'H1', 'H4')
  timeframe?: string;
  // Données brutes M1 (optionnelles) pour le calcul Multi-Timeframe (MTF)
  donneesM1?: Bougie[];
  // Résultats des indicateurs précédemment évalués sur le graphique (pour binômes et interconnexions automatiques)
  resultatsPrecedents?: Array<{ script: IndicatorScript; resultat: IndicatorExecutionResult }>;
  // Liste des indicateurs actuellement cochés / visibles sur le graphique
  scriptsActifs?: IndicatorScript[];
  // Paramètres personnalisables configurés par l'utilisateur
  parametres: Record<string, number | string | boolean>;
}

/**
 * Résultat de l'exécution d'un indicateur
 */
export interface IndicatorExecutionResult {
  // Données télémétriques structurées (accessibles par les bots de trading et l'IA)
  donnees: Record<string, any>;
  // Éléments visuels à tracer sur le graphique TradingView
  primitives?: VisualPrimitives;
  // Type de moteur de rendu dédié pour les indicateurs avancés (LuxAlgo SMC, Protected Swings, etc.)
  typeSpecial?: 'luxalgo-smc' | 'protected-swings' | 'zigzag' | 'unmitigated-profile' | string;
}

/**
 * Définition d'une variable externe (Input / Paramètre) personnalisable par l'utilisateur.
 * Permet de générer automatiquement un formulaire visuel élégant (sliders, switchs, selects).
 * 
 * Exemple :
 * const param: VariableExterneDef = {
 *   cle: 'swingLength',
 *   label: 'Longueur des Swings',
 *   type: 'number',
 *   valeurParDefaut: 20,
 *   min: 5,
 *   max: 100,
 *   groupe: 'Structure'
 * };
 */
export interface VariableExterneDef {
  cle: string;                            // Nom de la clé dans l'objet parametres
  label: string;                          // Nom lisible en français affiché à l'écran
  description?: string;                   // Explication pédagogique pour le trader
  type: 'number' | 'boolean' | 'string' | 'select'; // Type du champ UI
  valeurParDefaut: number | string | boolean;       // Valeur d'origine
  min?: number;                           // Valeur minimale (pour type 'number')
  max?: number;                           // Valeur maximale (pour type 'number')
  step?: number;                          // Pas de variation (ex: 0.1 ou 1)
  options?: Array<{ label: string; value: string | number }>; // Options (pour type 'select')
  groupe?: string;                        // Regroupement visuel (ex: 'Calculs', 'Affichage')
}

/**
 * Modèle complet d'un indicateur scriptable sauvegardé dans TradeLog.
 * 
 * Exemple :
 * const indicateur: IndicatorScript = {
 *   id: 'fvg-detector-v1',
 *   nom: 'FVG Imbalance Detector',
 *   description: 'Détecte les zones Fair Value Gaps',
 *   type: 'overlay',
 *   code: 'return { calculer: ({ bougies }) => ({ donnees: {}, primitives: {} }) };',
 *   parametres: { seuilMin: 0.0005 },
 *   actif: true,
 *   visibleSurGraphique: true,
 *   collecteActive: true,
 *   creeLe: '2026-09-23T00:00:00.000Z',
 *   misAJourLe: '2026-09-23T00:00:00.000Z',
 * };
 */
export interface IndicatorScript {
  id: string;
  nom: string;
  description: string;
  auteur?: string;
  version?: string;
  type: 'overlay' | 'panneau';
  code: string; // Code JavaScript du script
  parametres: Record<string, number | string | boolean>;
  // Métadonnées descriptives des paramètres externes pour générer l'interface de réglage
  definitionsVariables?: VariableExterneDef[];
  actif: boolean; // Si activé dans la configuration
  visibleSurGraphique: boolean; // Si affiché sur le canvas
  collecteActive: boolean; // Si les données sont capturées pour les trades / bots
  creeLe: string;
  misAJourLe: string;
}

