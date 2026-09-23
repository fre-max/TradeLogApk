import React, { useEffect, useRef, useState, useCallback, useMemo, useImperativeHandle } from 'react';
import {
  createChart,
  ColorType,
  CandlestickSeries,
  IChartApi,
  ISeriesApi,
  Time,
} from 'lightweight-charts';
// @ts-ignore
import {
  DrawingManager,
  getToolRegistry,
  TrendLine,
  Rectangle,
  FibRetracement,
  HorizontalLine,
  VerticalLine,
  Ray,
  ExtendedLine,
} from '@/lib/lightweight-charts-drawing-custom';
import { useBacktestStore, type PositionSimulee } from '@/store/backtestStore';
import { useUIStore } from '@/store';
import type { BoundingBoxYOLO } from '@/types/dataset';
import {
  calculerProtectedSwings,
  capturerSnapshotProtectedSwings,
} from '@/lib/indicators/protectedSwings';
import { dessinerProtectedSwings } from '@/lib/indicators/protectedSwingsRenderer';
import {
  calculerUnmitigatedVolumeProfile,
  capturerSnapshotUVP,
} from '@/lib/indicators/unmitigatedVolumeProfile';
import { dessinerUnmitigatedVolumeProfile } from '@/lib/indicators/unmitigatedVolumeProfileRenderer';
import {
  calculerZigZag,
  capturerSnapshotZigZag,
} from '@/lib/indicators/zigzag';
import { dessinerZigZag } from '@/lib/indicators/zigzagRenderer';
import {
  calculerLuxAlgoSMC,
  capturerSnapshotSMC,
} from '@/lib/indicators/luxAlgoSMC';
import { recupererIndicateursStockes, evaluerIndicateurScript } from '@/lib/indicators/indicatorEngine';
import { dessinerResultatIndicateur, dessinerPrimitivesIndicateur } from '@/lib/indicators/scriptRenderer';
import type { IndicatorScript, IndicatorExecutionResult } from '@/types/indicatorScript';

// ─── 🛠️ Seuils de détection tactile élargis ──────────────────────────────────
// 30px de tolérance au lieu de 5px par défaut pour faciliter la sélection au doigt.
try {
  (TrendLine as any).HIT_THRESHOLD = 30;
  (Rectangle as any).HIT_THRESHOLD = 30;
  (FibRetracement as any).HIT_THRESHOLD = 30;
  (HorizontalLine as any).HIT_THRESHOLD = 30;
  (VerticalLine as any).HIT_THRESHOLD = 30;
  (Ray as any).HIT_THRESHOLD = 30;
  (ExtendedLine as any).HIT_THRESHOLD = 30;
} catch (e) {
  console.warn('[BacktestChart] HIT_THRESHOLD non modifiable :', e);
}

// ─── Types ───────────────────────────────────────────────────────────────────

/** Représente une position Long ou Short dessinée sur le canvas overlay */
interface PositionCanvas {
  id: string;
  direction: 'long' | 'short';
  prixEntree: number;
  prixSL: number;
  prixTP: number;
  indexEntree: number;           // Index de la bougie d'entrée (pour tracer la ligne verticale)
  dureeEstimeeHeures?: number;   // Durée estimée en heures
  dureeEstimeeBougies?: number;  // Ligne verticale jaune à indexEntree + dureeEstimeeBougies
  dureeEstimeeLargeur?: number;  // Largeur visuelle du bloc de trade en bougies
  selected: boolean;
}

// ─── Configuration des outils de dessin de la bibliothèque ────────────────────
// Les outils pos-long et pos-short sont gérés par notre propre système canvas.
const CONFIG_OUTILS: Record<string, {
  ancres: 1 | 2 | 3;
  instructions: string[];
  couleurPreview: string;
}> = {
  'horizontal-line': {
    ancres: 1,
    instructions: ['Cliquez pour poser la ligne horizontale'],
    couleurPreview: '#2962ff',
  },
  'vertical-line': {
    ancres: 1,
    instructions: ['Cliquez pour poser la ligne verticale'],
    couleurPreview: '#2962ff',
  },
  'trend-line': {
    ancres: 2,
    instructions: ['Point A : cliquez pour commencer', 'Point B : cliquez pour terminer'],
    couleurPreview: '#2962ff',
  },
  'ray': {
    ancres: 2,
    instructions: ['Origine du rayon : cliquez ici', 'Direction : cliquez pour fixer l\'angle'],
    couleurPreview: '#2962ff',
  },
  'extended-line': {
    ancres: 2,
    instructions: ['Point A : cliquez pour commencer', 'Point B : (la ligne s\'étend à l\'infini)'],
    couleurPreview: '#2962ff',
  },
  'rectangle': {
    ancres: 2,
    instructions: ['Premier coin : cliquez ici', 'Coin opposé : cliquez pour fermer'],
    couleurPreview: '#2962ff',
  },
  'fib-retracement': {
    ancres: 2,
    instructions: ['Sommet/creux : cliquez ici', 'Bas/haut opposé : tracez les niveaux Fibonacci'],
    couleurPreview: '#ff9800',
  },
  'text-annotation': {
    ancres: 1,
    instructions: ['Cliquez sur le graphique pour placer une annotation texte'],
    couleurPreview: '#2962ff',
  },
  // Nos outils custom de position
  'pos-long': {
    ancres: 3,
    instructions: [
      '① Entrée : cliquez sur le prix d\'entrée Long',
      '② Stop Loss : cliquez sur votre Stop Loss (en-dessous)',
      '③ Take Profit : cliquez sur votre Take Profit (au-dessus)',
    ],
    couleurPreview: '#26a69a',
  },
  'pos-short': {
    ancres: 3,
    instructions: [
      '① Entrée : cliquez sur le prix d\'entrée Short',
      '② Stop Loss : cliquez sur votre Stop Loss (au-dessus)',
      '③ Take Profit : cliquez sur votre Take Profit (en-dessous)',
    ],
    couleurPreview: '#ef5350',
  },
  'replay-cut': {
    ancres: 1,
    instructions: ['✂️ Cliquez sur une bougie pour démarrer le replay à partir de ce point'],
    couleurPreview: '#f59e0b',
  },
};

interface BacktestChartProps {
  activeTool: string | null;
  onDrawingComplete?: () => void; // Rappelé une fois le tracé terminé pour repasser au curseur
  onScrollToLeft?: () => void;     // Notifie lorsque l'utilisateur a défilé vers le passé proche du début
  height: number;
  theme: 'dark' | 'light';
  timeframe: string;
  onOpenIndicatorModal?: (scriptId?: string, onglet?: 'indicateurs' | 'configuration' | 'editeur' | 'telemetrie') => void;
}

const THEMES = {
  dark: { background: '#131722', text: '#b2b5be', grid: '#1e222d' },
  light: { background: '#ffffff', text: '#131722', grid: '#f0f3fa' },
};

export interface BacktestChartHandle {
  takeScreenshot: () => Promise<Blob | null>;
  cadrerFenetreBougies: (nbBougies: number) => void;
  cadrerSurIndex: (indexCible: number, nbBougiesContexte?: number) => void;
  capturerImageIA: (options: {
    nbBougies: number;
    cibleLargeur?: number;
    cibleHauteur?: number;
  }) => Promise<{
    blobClean: Blob | null;
    blobAnnotated: Blob | null;
    boundingBoxes: BoundingBoxYOLO[];
  }>;
}

export const BacktestChart = React.forwardRef<
  BacktestChartHandle,
  BacktestChartProps
>(({ activeTool, onDrawingComplete, onScrollToLeft, height, theme, timeframe, onOpenIndicatorModal }, ref) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  const donneesCompletes = useBacktestStore((s) => s.donneesCompletes);
  const indexCourant = useBacktestStore((s) => s.indexCourant);
  const ouvrirPosition = useBacktestStore((s) => s.ouvrirPosition);
  const positionActive = useBacktestStore((s) => s.positionActive);
  const estEnLecture = useBacktestStore((s) => s.estEnLecture);
  const fundamentalModeEnabled = useBacktestStore((s) => s.fundamentalModeEnabled);
  const macroEvents = useBacktestStore((s) => s.macroEvents);
  const scriptsIndicateurs = useBacktestStore((s) => s.scriptsIndicateurs);
  const chargerScriptsIndicateurs = useBacktestStore((s) => s.chargerScriptsIndicateurs);
  const toggleVisibiliteScript = useBacktestStore((s) => s.toggleVisibiliteScript);
  const retirerScriptDuGraphique = useBacktestStore((s) => s.retirerScriptDuGraphique);

  // Charge les scripts d'indicateurs à l'initialisation
  useEffect(() => {
    chargerScriptsIndicateurs();
  }, [chargerScriptsIndicateurs]);

  // ─── Calcul Unifié et Dynamique de tous les Indicateurs Scripts Actifs ───
  const resultatsScriptsActifs = useMemo(() => {
    if (donneesCompletes.length === 0) return [];
    const bougiesVisibles = donneesCompletes.slice(0, indexCourant + 1);
    const scripts = scriptsIndicateurs.length > 0 ? scriptsIndicateurs : recupererIndicateursStockes();

    const resultats: Array<{ script: IndicatorScript; resultat: IndicatorExecutionResult }> = [];

    for (const script of scripts) {
      if (script.visibleSurGraphique) {
        try {
          const res = evaluerIndicateurScript(script.code, {
            bougies: bougiesVisibles,
            timeframe: timeframe,
            parametres: script.parametres || {},
          });
          if (res) {
            resultats.push({ script, resultat: res });
          }
        } catch (err) {
          console.warn(`⚠️ [BacktestChart] Erreur d'évaluation pour l'indicateur ${script.nom}:`, err);
        }
      }
    }

    return resultats;
  }, [donneesCompletes, indexCourant, scriptsIndicateurs, timeframe]);

  // Référence mutable pour éviter le stale closure du scroll handler
  const scrollRef = useRef(onScrollToLeft);
  useEffect(() => {
    scrollRef.current = onScrollToLeft;
  }, [onScrollToLeft]);

  // ─── Effet : Affichage dynamique des marqueurs de news sur le graphique ─────
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    if (!fundamentalModeEnabled || macroEvents.length === 0 || donneesCompletes.length === 0) {
      try {
        (series as any).setMarkers([]);
      } catch (err) {
        // Ignorer si la série est en cours de destruction
      }
      return;
    }

    // Association des événements macro avec les bougies du graphique
    const eventsByTime = new Map<Time, typeof macroEvents[0]>();

    for (const ev of macroEvents) {
      const bougieIndex = donneesCompletes.findIndex((b) => {
        const t = typeof b.time === 'number'
          ? b.time * (b.time < 10000000000 ? 1000 : 1)
          : Date.parse((b.time as string).replace(' ', 'T'));
        return t >= ev.timestamp;
      });

      if (bougieIndex !== -1 && bougieIndex < donneesCompletes.length) {
        const bougieTime = donneesCompletes[bougieIndex].time as Time;
        if (!eventsByTime.has(bougieTime)) {
          eventsByTime.set(bougieTime, ev);
        }
      }
    }

    const markersArray: any[] = [];
    eventsByTime.forEach((topEvent, time) => {
      const isPositive = topEvent.score > 0;
      const isNegative = topEvent.score < 0;

      markersArray.push({
        time,
        position: isPositive ? 'belowBar' : 'aboveBar',
        color: isPositive ? '#10b981' : isNegative ? '#f43f5e' : '#64748b',
        shape: isPositive ? 'arrowUp' : isNegative ? 'arrowDown' : 'circle',
        text: `⚡ ${topEvent.asset} ${topEvent.event}`,
        id: topEvent.id,
      });
    });

    try {
      (series as any).setMarkers(markersArray);
    } catch (err) {
      console.warn('⚠️ [BacktestChart] Impossible de mettre à jour les markers macro:', err);
    }
  }, [fundamentalModeEnabled, macroEvents, donneesCompletes]);

  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const managerRef = useRef<DrawingManager | null>(null);

  // Expose les méthodes de capture et de cadrage au composant parent (BacktestWorkspace)
  useImperativeHandle(ref, () => ({
    // Cadre instantanément le graphique sur un nombre précis de bougies jusqu'à la bougie courante
    cadrerFenetreBougies: (nbBougies: number) => {
      const chart = chartRef.current;
      if (!chart) return;
      const currentIndex = stateRef.current.indexCourant;
      const from = Math.max(0, currentIndex - nbBougies + 1);
      const to = currentIndex;
      chart.timeScale().setVisibleLogicalRange({ from, to });
    },

    // Cadre spécifiquement la vue sur un index cible (ex: bougie d'entrée du trade)
    // avec un recul passé pour voir le contexte d'analyse et une marge à droite pour le futur
    cadrerSurIndex: (indexCible: number, nbBougiesContexte = 60) => {
      const chart = chartRef.current;
      if (!chart) return;
      const from = Math.max(0, indexCible - nbBougiesContexte);
      const to = indexCible + 15; // Marge droite pour que la bougie d'entrée soit bien visible
      chart.timeScale().setVisibleLogicalRange({ from, to });
      requestAnimationFrame(() => {
        redessinerOverlay();
      });
    },

    // Capture standardisée pour le dataset d'apprentissage IA
    // Génère l'image Clean (pour l'IA), l'image Annotée (pour l'humain) et calcule les coordonnées YOLO
    capturerImageIA: (options: { nbBougies: number; cibleLargeur?: number; cibleHauteur?: number }): Promise<{
      blobClean: Blob | null;
      blobAnnotated: Blob | null;
      boundingBoxes: BoundingBoxYOLO[];
    }> => {
      return new Promise((resolve) => {
        const chart = chartRef.current;
        const series = seriesRef.current;
        if (!chart || !series) {
          resolve({ blobClean: null, blobAnnotated: null, boundingBoxes: [] });
          return;
        }

        const currentIndex = stateRef.current.indexCourant;
        const nbBougies = options.nbBougies || 80;
        const from = Math.max(0, currentIndex - nbBougies + 1);
        const to = currentIndex;

        // 1. Cadrer exactement la fenêtre temporelle demandée (aucune bougie future visible)
        chart.timeScale().setVisibleLogicalRange({ from, to });

        const couleurs = THEMES[theme] ?? THEMES.dark;

        // 2. Masquer temporairement la grille et les réticules pour obtenir une image 100% propre (sans artefact)
        chart.applyOptions({
          grid: {
            vertLines: { visible: false },
            horzLines: { visible: false },
          },
          crosshair: {
            vertLine: { visible: false },
            horzLine: { visible: false },
          },
        });

        // Laisser 150ms au moteur de rendu canvas pour appliquer le cadrage et le masquage de grille
        setTimeout(() => {
          try {
            // 3. Capture du canvas natif de Lightweight Charts (image brute "clean" pour l'entraînement IA)
            const chartCanvas = chart.takeScreenshot();
            if (!chartCanvas) {
              chart.applyOptions({
                grid: {
                  vertLines: { color: couleurs.grid, visible: true },
                  horzLines: { color: couleurs.grid, visible: true },
                },
                crosshair: {
                  vertLine: { visible: true, labelBackgroundColor: couleurs.background },
                  horzLine: { visible: true, labelBackgroundColor: couleurs.background },
                },
              });
              resolve({ blobClean: null, blobAnnotated: null, boundingBoxes: [] });
              return;
            }

            const canvasLargeur = chartCanvas.width;
            const canvasHauteur = chartCanvas.height;

            // 4. Calcul automatique des coordonnées normalisées YOLO pour la position active
            const boxes: BoundingBoxYOLO[] = [];
            const posActive = stateRef.current.positionActive;
            const posCanvas = stateRef.current.positionsCanvas[0];
            const posCible = posCanvas || (posActive ? {
              direction: posActive.direction,
              prixEntree: posActive.prixEntree,
              prixSL: posActive.stopLoss,
              prixTP: posActive.takeProfit,
              indexEntree: posActive.indexEntree,
              dureeEstimeeLargeur: posActive.dureeEstimeeLargeur || 25,
            } : null);

            if (posCible && typeof posCible.indexEntree === 'number') {
              const xStart = chart.timeScale().logicalToCoordinate(posCible.indexEntree as any);
              const yEntry = series.priceToCoordinate(posCible.prixEntree);
              const ySL = series.priceToCoordinate(posCible.prixSL);
              const yTP = series.priceToCoordinate(posCible.prixTP);

              if (xStart !== null && yEntry !== null && ySL !== null && yTP !== null) {
                // Déterminer la largeur en pixels d'une bougie à l'écran
                let largeurBougie = 6;
                if (currentIndex > 0) {
                  const xCur = chart.timeScale().logicalToCoordinate(currentIndex as any);
                  const xPrev = chart.timeScale().logicalToCoordinate((currentIndex - 1) as any);
                  if (xCur !== null && xPrev !== null) {
                    largeurBougie = Math.abs(xCur - xPrev);
                  }
                }

                const largeurBlocPx = (posCible.dureeEstimeeLargeur || 25) * largeurBougie;
                const xMinPx = Math.max(0, xStart);
                const xMaxPx = Math.min(canvasLargeur, xStart + largeurBlocPx);
                const yMinPx = Math.max(0, Math.min(yEntry, ySL, yTP));
                const yMaxPx = Math.min(canvasHauteur, Math.max(yEntry, ySL, yTP));

                const boxLargeurPx = xMaxPx - xMinPx;
                const boxHauteurPx = yMaxPx - yMinPx;

                // On ne retient la boîte que si elle a une taille minimale significative
                if (boxLargeurPx > 4 && boxHauteurPx > 4) {
                  const xCentre = (xMinPx + boxLargeurPx / 2) / canvasLargeur;
                  const yCentre = (yMinPx + boxHauteurPx / 2) / canvasHauteur;
                  const largeurNorm = boxLargeurPx / canvasLargeur;
                  const hauteurNorm = boxHauteurPx / canvasHauteur;

                  boxes.push({
                    classeId: posCible.direction === 'long' ? 0 : 1,
                    classeNom: posCible.direction,
                    xCentre,
                    yCentre,
                    largeur: largeurNorm,
                    hauteur: hauteurNorm,
                  });
                }
              }
            }

            // 5. Création de l'image annotée (fusion de l'image clean avec l'overlay des positions)
            const canvasAnnotated = document.createElement('canvas');
            canvasAnnotated.width = canvasLargeur;
            canvasAnnotated.height = canvasHauteur;
            const ctxAnnotated = canvasAnnotated.getContext('2d');

            if (ctxAnnotated) {
              ctxAnnotated.drawImage(chartCanvas, 0, 0);
              const overlayCanvas = overlayCanvasRef.current;
              if (overlayCanvas && overlayCanvas.width > 0 && overlayCanvas.height > 0) {
                ctxAnnotated.drawImage(overlayCanvas, 0, 0, canvasLargeur, canvasHauteur);
              }
            }

            // 6. Restauration immédiate des options du graphique
            chart.applyOptions({
              grid: {
                vertLines: { color: couleurs.grid, visible: true },
                horzLines: { color: couleurs.grid, visible: true },
              },
              crosshair: {
                vertLine: { visible: true, labelBackgroundColor: couleurs.background },
                horzLine: { visible: true, labelBackgroundColor: couleurs.background },
              },
            });

            // 7. Conversion des deux canvas en Blobs JPEG
            chartCanvas.toBlob((blobClean) => {
              canvasAnnotated.toBlob((blobAnnotated) => {
                resolve({
                  blobClean,
                  blobAnnotated,
                  boundingBoxes: boxes,
                });
              }, 'image/jpeg', 0.9);
            }, 'image/jpeg', 0.9);
          } catch (err) {
            console.error('❌ [BacktestChart] Erreur lors de la capture IA :', err);
            // Restauration de sécurité en cas d'erreur
            chart.applyOptions({
              grid: {
                vertLines: { color: couleurs.grid, visible: true },
                horzLines: { color: couleurs.grid, visible: true },
              },
              crosshair: {
                vertLine: { visible: true, labelBackgroundColor: couleurs.background },
                horzLine: { visible: true, labelBackgroundColor: couleurs.background },
              },
            });
            resolve({ blobClean: null, blobAnnotated: null, boundingBoxes: [] });
          }
        }, 150);
      });
    },

    // Capture standard classique pour le journal de trading
    takeScreenshot: (): Promise<Blob | null> => {
      return new Promise((resolve) => {
        const chart = chartRef.current;
        if (!chart) {
          resolve(null);
          return;
        }

        setTimeout(() => {
          try {
            const chartCanvas = chart.takeScreenshot();
            if (!chartCanvas) {
              resolve(null);
              return;
            }

            const overlayCanvas = overlayCanvasRef.current;
            const canvasFusion = document.createElement('canvas');

            // Optimisation mobile : limite la largeur à 1200px max pour éviter les canvas 4K en mémoire
            const maxLargeur = 1200;
            const ratio = chartCanvas.width > maxLargeur ? maxLargeur / chartCanvas.width : 1;
            canvasFusion.width = Math.round(chartCanvas.width * ratio);
            canvasFusion.height = Math.round(chartCanvas.height * ratio);
            const ctx = canvasFusion.getContext('2d');

            if (!ctx) {
              chartCanvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.75);
              return;
            }

            ctx.drawImage(chartCanvas, 0, 0, canvasFusion.width, canvasFusion.height);
            if (overlayCanvas && overlayCanvas.width > 0 && overlayCanvas.height > 0) {
              ctx.drawImage(overlayCanvas, 0, 0, canvasFusion.width, canvasFusion.height);
            }

            canvasFusion.toBlob(
              (blob) => resolve(blob),
              'image/jpeg',
              0.75
            );
          } catch (err) {
            console.error('Erreur lors de la capture fusionnée :', err);
            resolve(null);
          }
        }, 50);
      });
    }
  }));

  // État outil de dessin bibliothèque
  const [etapeActuelle, setEtapeActuelle] = useState(0);
  const ancresEnCoursRef = useRef<Array<{ time: any; price: number; px: number; py: number }>>([]);
  const sourisPixelRef = useRef<{ x: number; y: number } | null>(null);
  const [idDessinSelectionne, setIdDessinSelectionne] = useState<string | null>(null);

  // ─── État des positions canvas (notre système custom) ────────────────────────
  const [positionsCanvas, setPositionsCanvas] = useState<PositionCanvas[]>([]);
  const [positionSelectionneeId, setPositionSelectionneeId] = useState<string | null>(null);

  // Synchronisation de la position active du store Zustand vers les positions du canvas
  useEffect(() => {
    if (positionActive) {
      const positionId = 'active-position';
      const mappingActive: PositionCanvas = {
        id: positionId,
        direction: positionActive.direction,
        prixEntree: positionActive.prixEntree,
        prixSL: positionActive.stopLoss,
        prixTP: positionActive.takeProfit,
        indexEntree: positionActive.indexEntree,
        dureeEstimeeLargeur: positionActive.dureeEstimeeLargeur ?? 30,
        dureeEstimeeBougies: positionActive.dureeEstimeeBougies ?? 12,
        dureeEstimeeHeures: positionActive.dureeEstimeeHeures,
        selected: false,
      };

      setPositionsCanvas((prev) => {
        const sansActive = prev.filter((p) => p.id !== positionId);
        return [...sansActive, mappingActive];
      });
    } else {
      setPositionsCanvas((prev) => prev.filter((p) => p.id !== 'active-position'));
    }
  }, [positionActive]);

  // ─── État pour le Drag-and-Drop des poignées ─────────────────────────────────
  const [dragAction, setDragAction] = useState<{
    positionId: string;
    ancreIndex: number;
    initX: number;
    initY: number;
    initPrixEntree: number;
    initPrixSL: number;
    initPrixTP: number;
    initIndexEntree: number;
    initDureeEstimeeLargeur: number;
    initDureeEstimeeBougies: number;
  } | null>(null);

  // Réf stable pour les callbacks
  const stateRef = useRef({
    activeTool,
    indexCourant,
    positionActive,
    donneesCompletes,
    theme,
    positionsCanvas,
    positionSelectionneeId,
    dragAction,
    resultatsScriptsActifs,
  });

  useEffect(() => {
    stateRef.current = {
      activeTool,
      indexCourant,
      positionActive,
      donneesCompletes,
      theme,
      positionsCanvas,
      positionSelectionneeId,
      dragAction,
      resultatsScriptsActifs,
    };
    redessinerOverlay();
  }, [
    activeTool,
    indexCourant,
    positionActive,
    donneesCompletes,
    theme,
    positionsCanvas,
    positionSelectionneeId,
    dragAction,
    resultatsScriptsActifs,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Rendu overlay : P&L actif + positions canvas + prévisualisation ─────────
  const redessinerOverlay = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const {
      activeTool: currentTool,
      indexCourant: currentIndex,
      positionActive: currentPos,
      donneesCompletes: currentData,
      positionsCanvas: currentPositions,
      positionSelectionneeId: selectedId,
      resultatsScriptsActifs: currentScriptsResults,
    } = stateRef.current;

    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return;

    // 0️⃣ Dessin dynamique et unifié de TOUS les indicateurs modulaires en scripts
    const bougiesVisibles = currentData.slice(0, currentIndex + 1);
    if (currentScriptsResults && currentScriptsResults.length > 0) {
      for (const item of currentScriptsResults) {
        try {
          dessinerResultatIndicateur(
            ctx,
            item.resultat,
            item.script,
            chart,
            series,
            bougiesVisibles
          );
        } catch (err) {
          console.warn(`⚠️ [BacktestChart] Erreur de tracé pour ${item.script.nom}:`, err);
        }
      }
    }

    // 1️⃣ Dessin des positions canvas (Long/Short custom)
    for (const pos of currentPositions) {
      dessinerPositionCanvas(ctx, chart, series, pos, selectedId === pos.id, currentData);
    }

    // 2️⃣ Ombrage dynamique P&L de la position active du store
    if (currentPos && currentIndex < currentData.length) {
      const bougieActuelle = currentData[currentIndex];
      if (bougieActuelle) {
        const xEntry = chart.timeScale().timeToCoordinate(currentPos.dateEntree as Time);
        const xCurrent = chart.timeScale().timeToCoordinate(bougieActuelle.time as Time);
        const yEntry = series.priceToCoordinate(currentPos.prixEntree);
        const yCurrent = series.priceToCoordinate(bougieActuelle.close);

        if (xEntry !== null && xCurrent !== null && yEntry !== null && yCurrent !== null) {
          const x = Math.min(xEntry, xCurrent);
          const width = Math.abs(xCurrent - xEntry);
          const y = Math.min(yEntry, yCurrent);
          const hBox = Math.abs(yCurrent - yEntry);
          const estProfit = currentPos.direction === 'long' ? yCurrent < yEntry : yCurrent > yEntry;

          ctx.save();
          ctx.fillStyle = estProfit ? 'rgba(38, 166, 154, 0.18)' : 'rgba(239, 83, 80, 0.18)';
          ctx.fillRect(x, y, width, hBox);
          ctx.strokeStyle = estProfit ? '#26a69a' : '#ef5350';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(xCurrent, yEntry);
          ctx.lineTo(xCurrent, yCurrent);
          ctx.stroke();

          const pnlPct = currentPos.direction === 'long'
            ? ((bougieActuelle.close - currentPos.prixEntree) / currentPos.prixEntree) * 100
            : ((currentPos.prixEntree - bougieActuelle.close) / currentPos.prixEntree) * 100;

          ctx.fillStyle = estProfit ? '#26a69a' : '#ef5350';
          ctx.font = 'bold 10px Inter, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(
            `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%`,
            xCurrent,
            Math.min(yEntry, yCurrent) - 6
          );
          ctx.restore();
        }
      }
    }

    // 3️⃣ Prévisualisation outil en cours de tracé
    const config = currentTool ? CONFIG_OUTILS[currentTool] : null;
    const ancres = ancresEnCoursRef.current;
    const souris = sourisPixelRef.current;

    if (config && ancres.length > 0 && souris) {
      const couleur = config.couleurPreview;
      ctx.save();
      ctx.strokeStyle = couleur;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.globalAlpha = 0.8;

      ancres.forEach((ancre) => {
        ctx.beginPath();
        ctx.arc(ancre.px, ancre.py, 7.5, 0, Math.PI * 2);
        ctx.fillStyle = couleur;
        ctx.fill();
      });

      if (ancres.length >= 1) {
        const derniere = ancres[ancres.length - 1];
        ctx.beginPath();
        ctx.moveTo(derniere.px, derniere.py);
        ctx.lineTo(souris.x, souris.y);
        ctx.stroke();
      }
      ctx.restore();
    }
  }, []);

  /**
   * Dessine une position custom (Long/Short) sur le canvas overlay.
   * - Zone de perte rouge (Entrée → SL)
   * - Zone de gain verte (Entrée → TP)
   * - Ligne horizontale d'entrée bleue
   * - Ligne horizontale SL rouge pointillée
   * - Ligne horizontale TP verte pointillée
   * - Ligne verticale jaune (durée estimée)
   * - Labels avec les prix
   */
  const dessinerPositionCanvas = (
    ctx: CanvasRenderingContext2D,
    chart: IChartApi,
    series: ISeriesApi<any>,
    pos: PositionCanvas,
    estSelectionnee: boolean,
    data: typeof donneesCompletes
  ) => {
    const bougieEntree = data[pos.indexEntree];
    if (!bougieEntree) return;

    const xStart = chart.timeScale().logicalToCoordinate(pos.indexEntree as any);
    const yEntry = series.priceToCoordinate(pos.prixEntree);
    const ySL = series.priceToCoordinate(pos.prixSL);
    const yTP = series.priceToCoordinate(pos.prixTP);

    if (xStart === null || yEntry === null || ySL === null || yTP === null) return;

    // Déterminer la largeur en pixels d'une bougie à l'écran
    let largeurBougie = 6;
    const currentIndex = stateRef.current.indexCourant;
    if (currentIndex > 0) {
      const xCur = chart.timeScale().logicalToCoordinate(currentIndex as any);
      const xPrev = chart.timeScale().logicalToCoordinate((currentIndex - 1) as any);
      if (xCur !== null && xPrev !== null) {
        largeurBougie = Math.abs(xCur - xPrev);
      }
    }

    // Calculer la coordonnée de fin de la boîte de trade (violette)
    const xEnd = xStart + (pos.dureeEstimeeLargeur || 30) * largeurBougie;

    // Calculer la coordonnée de la ligne de durée/délai estimée (jaune)
    const xDuration = xStart + (pos.dureeEstimeeBougies || 12) * largeurBougie;

    const largeur = Math.max(0, xEnd - xStart);

    ctx.save();

    // Zone SL (rouge)
    ctx.fillStyle = 'rgba(239, 83, 80, 0.12)';
    const yZoneSL = Math.min(yEntry, ySL);
    const hZoneSL = Math.abs(ySL - yEntry);
    ctx.fillRect(xStart, yZoneSL, largeur, hZoneSL);

    // Zone TP (verte)
    ctx.fillStyle = 'rgba(38, 166, 154, 0.12)';
    const yZoneTP = Math.min(yEntry, yTP);
    const hZoneTP = Math.abs(yTP - yEntry);
    ctx.fillRect(xStart, yZoneTP, largeur, hZoneTP);

    // Ligne d'entrée (bleue, pleine)
    ctx.strokeStyle = '#2196F3';
    ctx.lineWidth = estSelectionnee ? 2.5 : 1.8;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(xStart, yEntry);
    ctx.lineTo(xEnd, yEntry);
    ctx.stroke();

    // Ligne SL (rouge, pointillée)
    ctx.strokeStyle = '#ef5350';
    ctx.lineWidth = estSelectionnee ? 2 : 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(xStart, ySL);
    ctx.lineTo(xEnd, ySL);
    ctx.stroke();

    // Ligne TP (verte, pointillée)
    ctx.strokeStyle = '#26a69a';
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(xStart, yTP);
    ctx.lineTo(xEnd, yTP);
    ctx.stroke();

    ctx.setLineDash([]);

    // Ligne verticale de durée estimée (jaune pointillée)
    if (pos.dureeEstimeeBougies !== undefined) {
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(xDuration, yZoneTP);
      ctx.lineTo(xDuration, Math.max(yZoneSL + hZoneSL, ySL));
      ctx.stroke();
      ctx.setLineDash([]);

      // Label durée estimée jaune
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 9px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      const labelDuree = pos.dureeEstimeeHeures !== undefined
        ? `⏱ ${pos.dureeEstimeeHeures}h (${pos.dureeEstimeeBougies}b)`
        : `⏱ ${pos.dureeEstimeeBougies}b`;
      ctx.fillText(labelDuree, xDuration, yZoneTP - 8);
    }

    // Labels de prix
    const xLabel = xEnd + 6;
    ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = '#2196F3';
    ctx.fillText(`Entrée: ${pos.prixEntree.toFixed(4)}`, xLabel, yEntry);

    ctx.fillStyle = '#ef5350';
    const riskPct = Math.abs((pos.prixSL - pos.prixEntree) / pos.prixEntree * 100).toFixed(2);
    ctx.fillText(`SL: ${pos.prixSL.toFixed(4)} (${riskPct}%)`, xLabel, ySL);

    ctx.fillStyle = '#26a69a';
    const rewardPct = Math.abs((pos.prixTP - pos.prixEntree) / pos.prixEntree * 100).toFixed(2);
    const risk = Math.abs(pos.prixSL - pos.prixEntree);
    const reward = Math.abs(pos.prixTP - pos.prixEntree);
    const rr = risk > 0 ? (reward / risk).toFixed(1) : '—';
    ctx.fillText(`TP: ${pos.prixTP.toFixed(4)} (+${rewardPct}%) | R:R 1:${rr}`, xLabel, yTP);

    // Tag LONG/SHORT
    ctx.fillStyle = pos.direction === 'long' ? '#26a69a' : '#ef5350';
    ctx.font = 'bold 11px Inter, system-ui, sans-serif';
    ctx.fillText(pos.direction === 'long' ? '▲ LONG' : '▼ SHORT', xStart + 6, yEntry - 14);

    // Poignées de sélection (les 6 ancres interactives)
    if (estSelectionnee) {
      // Déterminer la largeur en pixels d'une bougie à l'écran
      let largeurBougie = 6;
      const currentIndex = stateRef.current.indexCourant;
      if (currentIndex > 0) {
        const xCur = chart.timeScale().timeToCoordinate(data[currentIndex].time as Time);
        const xPrev = chart.timeScale().timeToCoordinate(data[currentIndex - 1].time as Time);
        if (xCur !== null && xPrev !== null) {
          largeurBougie = Math.abs(xCur - xPrev);
        }
      }

      const widthPx = (pos.dureeEstimeeLargeur || 30) * largeurBougie;
      const durationPx = (pos.dureeEstimeeBougies || 12) * largeurBougie;

      ctx.save();
      ctx.lineWidth = 1.5;

      // 0, 1, 2 : Entrée, SL, TP (Blanc avec bordure bleue)
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#2196F3';
      [[xStart, yEntry], [xStart, ySL], [xStart, yTP]].forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(x, y, 7.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });

      // 3 : Largeur (Violet / Magenta)
      ctx.fillStyle = '#9C27B0';
      ctx.strokeStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(xStart + widthPx, yEntry, 8.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 4 : Ligne de durée / Délai estimé (Jaune / Or)
      ctx.fillStyle = '#FFEB3B';
      ctx.strokeStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(xStart + durationPx, yEntry, 8.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 5 : Poignée de déplacement (Carré Orange de translation au milieu de l'entrée)
      ctx.fillStyle = '#FF9800';
      ctx.strokeStyle = '#ffffff';
      ctx.beginPath();
      ctx.rect(xStart + widthPx / 2 - 6.75, yEntry - 6.75, 13.5, 13.5);
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }

    ctx.restore();
  };

  // Helper pour récupérer le nombre de minutes dans une bougie selon l'UT
  const getMinutesParBougie = (tf: string): number => {
    switch (tf) {
      case '1m':
      case 'M1':  return 1;
      case '5m':
      case 'M5':  return 5;
      case '15m':
      case 'M15': return 15;
      case '30m':
      case 'M30': return 30;
      case '1h':
      case 'H1':  return 60;
      case '4h':
      case 'H4':  return 240;
      case '1d':
      case 'D1':  return 1440;
      case '1w':
      case 'W1':  return 10080;
      case '1M':
      case 'Monthly':
      case 'MN':  return 43200;
    }
    return 60;
  };

  // Détecter si on clique sur l'une des 6 poignées (handles) de la position sélectionnée
  const detecterClicPoignee = useCallback((
    px: number,
    py: number,
    pos: PositionCanvas,
    chart: IChartApi,
    series: ISeriesApi<any>,
    data: typeof donneesCompletes
  ): number | null => {
    const bougieEntree = data[pos.indexEntree];
    if (!bougieEntree) return null;

    const xStart = chart.timeScale().logicalToCoordinate(pos.indexEntree as any);
    const yEntry = series.priceToCoordinate(pos.prixEntree);
    const ySL = series.priceToCoordinate(pos.prixSL);
    const yTP = series.priceToCoordinate(pos.prixTP);
    if (xStart === null || yEntry === null || ySL === null || yTP === null) return null;

    // Déterminer la largeur en pixels d'une bougie à l'écran
    let largeurBougie = 6;
    const currentIndex = stateRef.current.indexCourant;
    if (currentIndex > 0) {
      const xCur = chart.timeScale().logicalToCoordinate(currentIndex as any);
      const xPrev = chart.timeScale().logicalToCoordinate((currentIndex - 1) as any);
      if (xCur !== null && xPrev !== null) {
        largeurBougie = Math.abs(xCur - xPrev);
      }
    }

    const widthPx = (pos.dureeEstimeeLargeur || 30) * largeurBougie;
    const durationPx = (pos.dureeEstimeeBougies || 12) * largeurBougie;

    const poignees = [
      { x: xStart, y: yEntry },              // 0 : Entrée
      { x: xStart, y: ySL },                 // 1 : SL
      { x: xStart, y: yTP },                 // 2 : TP
      { x: xStart + widthPx, y: yEntry },    // 3 : Largeur (Violet)
      { x: xStart + durationPx, y: yEntry }, // 4 : Délai (Jaune)
      { x: xStart + widthPx / 2, y: yEntry } // 5 : Déplacement (Orange)
    ];

    const seuilClic = 18; // Rayon de 18px pour une détection tactile et souris très confortable
    for (let i = 0; i < poignees.length; i++) {
      const dist = Math.hypot(px - poignees[i].x, py - poignees[i].y);
      if (dist <= seuilClic) {
        return i;
      }
    }
    return null;
  }, []);

  // ─── Sélection de position canvas par clic ────────────────────────────────────
  const detecterClicPositionCanvas = useCallback((px: number, py: number): string | null => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    const data = stateRef.current.donneesCompletes;
    if (!chart || !series) return null;

    for (const pos of stateRef.current.positionsCanvas) {
      const bougieEntree = data[pos.indexEntree];
      if (!bougieEntree) continue;
      const yEntry = series.priceToCoordinate(pos.prixEntree);
      const ySL = series.priceToCoordinate(pos.prixSL);
      const yTP = series.priceToCoordinate(pos.prixTP);
      if (yEntry === null || ySL === null || yTP === null) continue;

      const yMin = Math.min(ySL, yTP) - 5;
      const yMax = Math.max(ySL, yTP) + 5;

      // Vérifier si on clique proche d'une des lignes horizontales
      if (py >= yMin && py <= yMax) {
        const xStart = chart.timeScale().logicalToCoordinate(pos.indexEntree as any);
        if (xStart !== null && px >= xStart - 5) {
          return pos.id;
        }
      }
    }
    return null;
  }, []);

  // ─── Initialisation du graphique (une seule fois) ─────────────────────────────
  useEffect(() => {
    if (!chartContainerRef.current) return;
    console.log('🚀 [BacktestChart] Initialisation du graphique...');

    const couleurs = THEMES[theme] ?? THEMES.dark;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: couleurs.background },
        textColor: couleurs.text,
        fontFamily: 'Inter, Trebuchet MS, sans-serif',
        fontSize: 12,
      },
      width: chartContainerRef.current.clientWidth,
      height,
      grid: {
        vertLines: { color: couleurs.grid },
        horzLines: { color: couleurs.grid },
      },
      crosshair: {
        mode: 0, // 0 = CrosshairMode.Normal (le réticule suit le curseur de manière fluide)
        vertLine: { labelBackgroundColor: couleurs.background },
        horzLine: { labelBackgroundColor: couleurs.background },
      },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
    });
    chartRef.current = chart;

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });
    seriesRef.current = series;

    const manager = new DrawingManager();
    manager.attach(chart, series as ISeriesApi<any>, chartContainerRef.current);
    managerRef.current = manager;

    const desabonnerSelection = manager.on('drawing:selected', (event: any) => {
      setIdDessinSelectionne(event.drawingId ?? null);
      setPositionSelectionneeId(null); // Désélectionner les positions custom
    });
    const desabonnerDeselection = manager.on('drawing:deselected', () => setIdDessinSelectionne(null));
    const desabonnerSuppression = manager.on('drawing:removed', () => setIdDessinSelectionne(null));

    const gererScale = () => {
      redessinerOverlay();
      
      // Détecter si on se rapproche des premières bougies chargées (Logical Index < 30)
      const range = chart.timeScale().getVisibleLogicalRange();
      if (range && range.from < 30 && stateRef.current.donneesCompletes.length > 100) {
        if (scrollRef.current) {
          scrollRef.current();
        }
      }
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(gererScale);

    // Routage tactile (glissement des dessins bibliothèque avec le doigt)
    const conteneur = chartContainerRef.current;
    const gererPointerDownTactile = (e: PointerEvent) => {
      if (stateRef.current.activeTool === null && e.pointerType === 'touch') {
        (manager as any).handleMouseDown(e);
      }
    };
    const gererPointerMoveTactile = (e: PointerEvent) => {
      if (stateRef.current.activeTool === null && e.pointerType === 'touch') {
        (manager as any).handleMouseMove(e);
      }
    };
    const gererPointerUpTactile = (e: PointerEvent) => {
      if (stateRef.current.activeTool === null && e.pointerType === 'touch') {
        (manager as any).handleMouseUp(e);
      }
    };
    conteneur.addEventListener('pointerdown', gererPointerDownTactile, true);
    conteneur.addEventListener('pointermove', gererPointerMoveTactile, true);
    conteneur.addEventListener('pointerup', gererPointerUpTactile, true);

    // Gestionnaire de clic / drag pour nos poignées de position custom (curseur)
    const gererPointerDownCurseur = (e: PointerEvent) => {
      if (stateRef.current.activeTool !== null) return;

      const rect = conteneur.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      const currentPositions = stateRef.current.positionsCanvas;
      const selectedId = stateRef.current.positionSelectionneeId;

      if (selectedId) {
        const posSelectionnee = currentPositions.find((p) => p.id === selectedId);
        if (posSelectionnee) {
          const indexPoignee = detecterClicPoignee(px, py, posSelectionnee, chart, series, stateRef.current.donneesCompletes);
          if (indexPoignee !== null) {
            // Démarrer le drag d'ancre !
            setDragAction({
              positionId: posSelectionnee.id,
              ancreIndex: indexPoignee,
              initX: e.clientX,
              initY: e.clientY,
              initPrixEntree: posSelectionnee.prixEntree,
              initPrixSL: posSelectionnee.prixSL,
              initPrixTP: posSelectionnee.prixTP,
              initIndexEntree: posSelectionnee.indexEntree,
              initDureeEstimeeLargeur: posSelectionnee.dureeEstimeeLargeur || 30,
              initDureeEstimeeBougies: posSelectionnee.dureeEstimeeBougies || 12,
            });
            e.preventDefault();
            e.stopPropagation();
            return;
          }
        }
      }

      // Sinon, essayer de sélectionner une position en cliquant sur son corps/lignes
      const idClique = detecterClicPositionCanvas(px, py);
      setPositionSelectionneeId(idClique);
      if (idClique) {
        setIdDessinSelectionne(null);
      }
    };

    const gererPointerMoveCurseur = (e: PointerEvent) => {
      const activeDrag = stateRef.current.dragAction;
      if (!activeDrag) return;

      const rect = conteneur.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      const targetPrice = series.coordinateToPrice(py);
      const logical = chart.timeScale().coordinateToLogical(px);
      if (targetPrice === null || logical === null) return;

      const targetIndex = Math.round(logical);
      const data = stateRef.current.donneesCompletes;
      const currentPositions = stateRef.current.positionsCanvas;
      const pos = currentPositions.find(p => p.id === activeDrag.positionId);
      if (!pos) return;

      let updates: Partial<PositionCanvas> = {};

      switch (activeDrag.ancreIndex) {
        case 0: // Entrée
          updates.prixEntree = targetPrice;
          break;
        case 1: // SL
          updates.prixSL = targetPrice;
          break;
        case 2: // TP
          updates.prixTP = targetPrice;
          break;
        case 3: // Largeur
          updates.dureeEstimeeLargeur = Math.max(1, targetIndex - pos.indexEntree);
          break;
        case 4: // Délai
          const deltaIndexDelai = targetIndex - pos.indexEntree;
          const bougiesDelai = Math.max(1, deltaIndexDelai);
          updates.dureeEstimeeBougies = bougiesDelai;
          updates.dureeEstimeeHeures = Number((bougiesDelai * (getMinutesParBougie(timeframe) / 60)).toFixed(2));
          break;
        case 5: // Déplacer tout (Translation)
          const initPrice = series.coordinateToPrice(activeDrag.initY - rect.top);
          if (initPrice !== null) {
            const dyPrice = targetPrice - initPrice;
            updates.prixEntree = activeDrag.initPrixEntree + dyPrice;
            updates.prixSL = activeDrag.initPrixSL + dyPrice;
            updates.prixTP = activeDrag.initPrixTP + dyPrice;
          }
          const initLogical = chart.timeScale().coordinateToLogical(activeDrag.initX - rect.left);
          if (initLogical !== null) {
            const dxIndex = Math.round(logical - initLogical);
            updates.indexEntree = Math.max(0, Math.min(data.length - 1, activeDrag.initIndexEntree + dxIndex));
          }
          break;
      }

      setPositionsCanvas((prev) =>
        prev.map((p) => (p.id === activeDrag.positionId ? { ...p, ...updates } : p))
      );

      // Si c'est la position active, mettre à jour le store Zustand
      if (activeDrag.positionId === 'active-position') {
        const storeUpdates: Partial<PositionSimulee> = {};
        if (updates.prixEntree !== undefined) storeUpdates.prixEntree = updates.prixEntree;
        if (updates.prixSL !== undefined) storeUpdates.stopLoss = updates.prixSL;
        if (updates.prixTP !== undefined) storeUpdates.takeProfit = updates.prixTP;
        if (updates.indexEntree !== undefined) {
          storeUpdates.indexEntree = updates.indexEntree;
          const bougie = data[updates.indexEntree];
          if (bougie) storeUpdates.dateEntree = bougie.time;
        }
        if (updates.dureeEstimeeHeures !== undefined) storeUpdates.dureeEstimeeHeures = updates.dureeEstimeeHeures;
        if (updates.dureeEstimeeBougies !== undefined) storeUpdates.dureeEstimeeBougies = updates.dureeEstimeeBougies;
        if (updates.dureeEstimeeLargeur !== undefined) storeUpdates.dureeEstimeeLargeur = updates.dureeEstimeeLargeur;

        useBacktestStore.getState().modifierPositionActive(storeUpdates);
      }
    };

    const gererPointerUpCurseur = () => {
      setDragAction(null);
    };

    conteneur.addEventListener('pointerdown', gererPointerDownCurseur, true);
    window.addEventListener('pointermove', gererPointerMoveCurseur);
    window.addEventListener('pointerup', gererPointerUpCurseur);

    const observateur = new ResizeObserver(() => {
      if (chartContainerRef.current && chartRef.current) {
        const largeur = chartContainerRef.current.clientWidth;
        chartRef.current.applyOptions({ width: largeur });
        if (overlayCanvasRef.current) overlayCanvasRef.current.width = largeur;
        redessinerOverlay();
      }
    });
    observateur.observe(chartContainerRef.current);

    return () => {
      desabonnerSelection();
      desabonnerDeselection();
      desabonnerSuppression();
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(gererScale);
      conteneur.removeEventListener('pointerdown', gererPointerDownTactile, true);
      conteneur.removeEventListener('pointermove', gererPointerMoveTactile, true);
      conteneur.removeEventListener('pointerup', gererPointerUpTactile, true);
      conteneur.removeEventListener('pointerdown', gererPointerDownCurseur, true);
      window.removeEventListener('pointermove', gererPointerMoveCurseur);
      window.removeEventListener('pointerup', gererPointerUpCurseur);
      manager.detach();
      chart.remove();
      observateur.disconnect();
      chartRef.current = null;
      seriesRef.current = null;
      managerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Thème
  useEffect(() => {
    if (!chartRef.current) return;
    const couleurs = THEMES[theme];
    chartRef.current.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: couleurs.background },
        textColor: couleurs.text,
      },
      grid: { vertLines: { color: couleurs.grid }, horzLines: { color: couleurs.grid } },
    });
    redessinerOverlay();
  }, [theme, redessinerOverlay]);

  // Hauteur
  useEffect(() => {
    if (chartRef.current) chartRef.current.applyOptions({ height });
    if (overlayCanvasRef.current) overlayCanvasRef.current.height = height;
    redessinerOverlay();
  }, [height, redessinerOverlay]);

  const dernierActifRef = useRef<string>('');
  const prevDonneesLengthRef = useRef<number>(0);

  // Replay sync
  useEffect(() => {
    if (!seriesRef.current || donneesCompletes.length === 0) return;

    const timeScale = chartRef.current?.timeScale();
    const rangeVisuellePrecedente = timeScale ? timeScale.getVisibleLogicalRange() : null;

    const donneesVisibles = donneesCompletes
      .slice(0, indexCourant + 1)
      .map((b) => ({ ...b, time: b.time as Time }));
    seriesRef.current.setData(donneesVisibles);

    if (chartRef.current && timeScale) {
      const actifActuel = useBacktestStore.getState().actif;
      const estPremierChargementActif = dernierActifRef.current !== actifActuel;

      if (estPremierChargementActif) {
        dernierActifRef.current = actifActuel;
        timeScale.scrollToPosition(15, false);
      } else if (estEnLecture) {
        timeScale.scrollToPosition(15, false);
      } else if (rangeVisuellePrecedente) {
        // En cas d'injection de données plus anciennes (défilement infini vers le passé)
        // La longueur du tableau augmente. Nous décalons le scroll logique pour conserver
        // les mêmes bougies affichées à l'écran sans aucun sursaut visuel.
        const decalage = donneesCompletes.length - prevDonneesLengthRef.current;
        if (decalage > 0) {
          timeScale.setVisibleLogicalRange({
            from: rangeVisuellePrecedente.from + decalage,
            to: rangeVisuellePrecedente.to + decalage,
          });
        }
      }
    }

    prevDonneesLengthRef.current = donneesCompletes.length;

    // Rafraîchir l'overlay après le rendu de la série
    requestAnimationFrame(() => {
      redessinerOverlay();
    });
  }, [donneesCompletes, indexCourant, estEnLecture, redessinerOverlay]);

  // Désactive temporairement le défilement et le zoom du graphique de Lightweight Charts
  // pendant qu'une poignée de position custom est en train d'être déplacée (dragAction actif).
  // Cela évite que le graphique ne bouge en arrière-plan en même temps que le doigt de l'utilisateur sur tablette.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    if (dragAction !== null) {
      console.log('🔒 [BacktestChart] Désactivation du scroll graphique pour modification de position');
      chart.applyOptions({
        handleScroll: false,
        handleScale: false,
      });
    } else {
      console.log('🔓 [BacktestChart] Réactivation du scroll graphique');
      chart.applyOptions({
        handleScroll: true,
        handleScale: true,
      });
    }
  }, [dragAction]);



  // ─── Duplication et édition de texte sur le graphique ────────────────────────
  const dupliquerDessinSelectionne = useCallback(() => {
    if (!managerRef.current && !positionSelectionneeId) return;

    // 1. Duplication d'une position canvas (Short / Long custom)
    if (positionSelectionneeId) {
      const posOriginale = positionsCanvas.find((p) => p.id === positionSelectionneeId);
      if (posOriginale) {
        const nouvellePos: PositionCanvas = {
          ...posOriginale,
          id: `pos-${Date.now()}`,
          indexEntree: posOriginale.indexEntree + 2, // Légèrement décalée de 2 bougies
          prixEntree: posOriginale.prixEntree * 1.0005,
          prixSL: posOriginale.prixSL * 1.0005,
          prixTP: posOriginale.prixTP * 1.0005,
        };
        setPositionsCanvas((prev) => [...prev, nouvellePos]);
        setPositionSelectionneeId(nouvellePos.id);
        useUIStore.getState().addToast('Position dupliquée !', 'success');
        redessinerOverlay();
        return;
      }
    }

    // 2. Duplication d'un dessin de bibliothèque (TextAnnotation, TrendLine, Rectangle...)
    if (idDessinSelectionne && managerRef.current) {
      const manager = managerRef.current as any;
      const listDrawings: any[] = manager._drawings ? Array.from(manager._drawings.values()) : [];
      const dessinOrigine = listDrawings.find((d) => d.id === idDessinSelectionne || d._id === idDessinSelectionne);

      if (dessinOrigine) {
        const typeOutil = dessinOrigine.type;
        const ancresOriginelles = dessinOrigine.anchors || dessinOrigine._anchors || [];

        // Décaler légèrement la hauteur/prix de l'ancre pour rendre la duplication directement saisissable
        const nouvellesAncres = ancresOriginelles.map((a: any) => ({
          time: a.time,
          price: typeof a.price === 'number' ? a.price * 1.0008 : a.price,
        }));

        const newId = `${typeOutil}-${Date.now()}`;
        const optionsExtra: any = {};

        if (typeOutil === 'text-annotation' && typeof dessinOrigine.getText === 'function') {
          optionsExtra.text = dessinOrigine.getText();
        }

        const cloneDessin = getToolRegistry().createDrawing(
          typeOutil,
          newId,
          nouvellesAncres,
          dessinOrigine.style || {},
          optionsExtra
        );

        if (cloneDessin) {
          manager.addDrawing(cloneDessin);
          setIdDessinSelectionne(newId);
          useUIStore.getState().addToast('Élément dupliqué avec succès !', 'success');
          redessinerOverlay();
        }
      }
    }
  }, [idDessinSelectionne, positionSelectionneeId, positionsCanvas, redessinerOverlay]);

  const editerTexteSelectionne = useCallback(() => {
    if (!idDessinSelectionne || !managerRef.current) return;
    const manager = managerRef.current as any;
    const listDrawings: any[] = manager._drawings ? Array.from(manager._drawings.values()) : [];
    const dessinOrigine = listDrawings.find((d) => d.id === idDessinSelectionne || d._id === idDessinSelectionne);

    if (dessinOrigine && typeof dessinOrigine.setText === 'function') {
      const texteActuel = dessinOrigine.getText ? dessinOrigine.getText() : '';
      const nouveauTexte = window.prompt('Modifier le texte :', texteActuel);
      if (nouveauTexte !== null && nouveauTexte.trim()) {
        dessinOrigine.setText(nouveauTexte.trim());
        redessinerOverlay();
        useUIStore.getState().addToast('Texte mis à jour !', 'success');
      }
    }
  }, [idDessinSelectionne, redessinerOverlay]);

  const estTexteSelectionne = useMemo(() => {
    if (!idDessinSelectionne || !managerRef.current) return false;
    const manager = managerRef.current as any;
    const listDrawings: any[] = manager._drawings ? Array.from(manager._drawings.values()) : [];
    const dessinOrigine = listDrawings.find((d) => d.id === idDessinSelectionne || d._id === idDessinSelectionne);
    return dessinOrigine?.type === 'text-annotation' || typeof dessinOrigine?.setText === 'function';
  }, [idDessinSelectionne]);

  // Clavier : Raccourcis pour Duplication (Ctrl+D / D) et Suppression (Delete)
  useEffect(() => {
    const gererTouche = (e: KeyboardEvent) => {
      if (activeTool !== null) return;
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

      // Duplication : Ctrl+D ou touche 'd' quand un élément est sélectionné
      if ((idDessinSelectionne || positionSelectionneeId) && ((e.ctrlKey && e.key.toLowerCase() === 'd') || e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        dupliquerDessinSelectionne();
        return;
      }

      // Suppression : Delete ou Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (positionSelectionneeId) {
          setPositionsCanvas((prev) => prev.filter((p) => p.id !== positionSelectionneeId));
          setPositionSelectionneeId(null);
        } else if (idDessinSelectionne) {
          managerRef.current?.removeDrawing(idDessinSelectionne);
          setIdDessinSelectionne(null);
        }
      }
    };
    window.addEventListener('keydown', gererTouche);
    return () => window.removeEventListener('keydown', gererTouche);
  }, [activeTool, idDessinSelectionne, positionSelectionneeId, dupliquerDessinSelectionne]);

  // ─── Gestion outil de dessin actif ───────────────────────────────────────────
  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    const manager = managerRef.current;
    const conteneur = chartContainerRef.current;
    const canvas = overlayCanvasRef.current;

    setEtapeActuelle(0);
    ancresEnCoursRef.current = [];
    sourisPixelRef.current = null;

    if (!activeTool || !chart || !series || !manager || !conteneur || !canvas) {
      if (conteneur) {
        conteneur.style.cursor = '';
        conteneur.style.touchAction = '';
      }
      return;
    }

    const config = CONFIG_OUTILS[activeTool];
    if (!config) return;

    conteneur.style.cursor = 'crosshair';
    conteneur.style.touchAction = 'none';

    const eventToAncre = (event: PointerEvent) => {
      const rect = conteneur.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      
      // Essayer d'abord d'obtenir le temps standard (zone passée/présente)
      let time = chart.timeScale().coordinateToTime(px);
      
      // Si on clique dans la zone future (où les bougies ne sont pas encore affichées),
      // coordinateToTime renvoie null. On utilise coordinateToLogical pour retrouver l'index.
      if (time === null) {
        const logical = chart.timeScale().coordinateToLogical(px);
        if (logical !== null) {
          const targetIndex = Math.round(logical);
          const completes = stateRef.current.donneesCompletes;
          if (targetIndex >= 0 && targetIndex < completes.length) {
            time = completes[targetIndex].time as Time;
          }
        }
      }

      const price = series.coordinateToPrice(py);
      if (time === null || price === null) return null;
      return { time, price, px, py };
    };

    const gererMouvement = (event: PointerEvent) => {
      const rect = conteneur.getBoundingClientRect();
      sourisPixelRef.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      redessinerOverlay();
    };

    const gererClic = (event: PointerEvent) => {
      // ✂️ Si l'outil actif est le découpage du replay
      if (activeTool === 'replay-cut') {
        const rect = conteneur.getBoundingClientRect();
        const px = event.clientX - rect.left;
        const logical = chart.timeScale().coordinateToLogical(px);
        if (logical !== null) {
          const targetIndex = Math.round(logical);
          if (targetIndex >= 0 && targetIndex < stateRef.current.donneesCompletes.length) {
            console.log(`✂️ [BacktestChart] Clic pour couper le replay à l'index ${targetIndex}`);
            useBacktestStore.getState().couperReplayAIndex(targetIndex);
            useUIStore.getState().addToast('Point de départ du backtest repositionné avec succès !', 'success');
          }
        }
        if (onDrawingComplete) {
          onDrawingComplete();
        }
        return;
      }

      const ancre = eventToAncre(event);
      if (!ancre) return;

      const estOutil = activeTool === 'pos-long' || activeTool === 'pos-short';

      // Pour les outils bibliothèque, on désélectionne une position canvas si cliquée
      if (!estOutil) {
        const idClique = detecterClicPositionCanvas(ancre.px, ancre.py);
        if (idClique) {
          setPositionSelectionneeId(idClique);
          return;
        }
      }

      ancresEnCoursRef.current.push(ancre);
      const nouvelleEtape = ancresEnCoursRef.current.length;
      setEtapeActuelle(nouvelleEtape);

      if (nouvelleEtape >= config.ancres) {
        const ancresFinales = ancresEnCoursRef.current;

        if (estOutil) {
          // ─ Outil position custom ─
          const direction = activeTool === 'pos-long' ? 'long' as const : 'short' as const;
          const minPB = getMinutesParBougie(timeframe);
          const defBougies = 12; // Valeur par défaut
          const heuresEstim = Number(((defBougies * minPB) / 60).toFixed(2));

          const nouvellePosition: PositionCanvas = {
            id: 'active-position', // ID unique pour la position active
            direction,
            prixEntree: ancresFinales[0].price,
            prixSL: ancresFinales[1].price,
            prixTP: ancresFinales[2].price,
            indexEntree: stateRef.current.indexCourant,
            dureeEstimeeLargeur: 30, // Largeur par défaut
            dureeEstimeeBougies: defBougies,
            dureeEstimeeHeures: heuresEstim,
            selected: false,
          };

          // Ajouter localement et dans le store Zustand
          setPositionsCanvas((prev) => [...prev.filter((p) => p.id !== 'active-position'), nouvellePosition]);

          // Récupération des données télémétriques depuis les résultats des scripts actifs
          const scriptsRes = stateRef.current.resultatsScriptsActifs || [];
          const smcItem = scriptsRes.find((r) => r.script.id === 'script-luxalgo-smc' || r.resultat.typeSpecial === 'luxalgo-smc');
          const swingsItem = scriptsRes.find((r) => r.script.id === 'script-protected-swings' || r.resultat.typeSpecial === 'protected-swings');
          const uvpItem = scriptsRes.find((r) => r.script.id === 'script-unmitigated-profile' || r.resultat.typeSpecial === 'unmitigated-profile');
          const zzItem = scriptsRes.find((r) => r.script.id === 'script-zigzag-smc' || r.resultat.typeSpecial === 'zigzag');

          // 🛡️ Télémétrie : Capture automatique de l'état de l'indicateur Protected Swings
          const snapshotPS = swingsItem?.resultat.donnees
            ? capturerSnapshotProtectedSwings(swingsItem.resultat.donnees as any, stateRef.current.indexCourant)
            : undefined;

          // 📊 Télémétrie : Capture automatique de l'état du profil de volume non mitigué (UVP)
          const snapshotUVP = uvpItem?.resultat.donnees
            ? capturerSnapshotUVP(uvpItem.resultat.donnees as any, nouvellePosition.prixEntree)
            : undefined;

          // 📐 Télémétrie : Capture automatique de la structure de marché ZigZag
          const snapshotZZ = zzItem?.resultat.donnees
            ? capturerSnapshotZigZag(
                zzItem.resultat.donnees as any,
                nouvellePosition.prixEntree,
                stateRef.current.indexCourant
              )
            : undefined;

          // 💎 Télémétrie : Capture automatique de l'état technique LuxAlgo SMC
          const snapshotSMC = smcItem?.resultat.donnees
            ? capturerSnapshotSMC(
                smcItem.resultat.donnees as any,
                nouvellePosition.prixEntree
              )
            : undefined;

          ouvrirPosition(
            direction,
            nouvellePosition.prixEntree,
            nouvellePosition.prixSL,
            nouvellePosition.prixTP,
            heuresEstim,
            defBougies,
            30,
            snapshotPS,
            snapshotUVP,
            snapshotZZ,
            snapshotSMC
          );
          // Sélectionner immédiatement pour pouvoir manipuler les poignées
          setPositionSelectionneeId('active-position');
        } else {
          // ─ Outil bibliothèque ─
          const ancresLibrairie = ancresFinales.map((a) => ({ time: a.time, price: a.price }));
          const idUnique = `${activeTool}-${Date.now()}`;
          
          let optionsExtra: any = {};
          if (activeTool === 'text-annotation') {
            const texteSaisi = window.prompt("Entrez le texte à afficher sur le graphique :", "Mon Annotation");
            if (!texteSaisi || !texteSaisi.trim()) {
              ancresEnCoursRef.current = [];
              setEtapeActuelle(0);
              return;
            }
            optionsExtra.text = texteSaisi.trim();
          }

          const dessin = getToolRegistry().createDrawing(activeTool, idUnique, ancresLibrairie, {}, optionsExtra);
          if (dessin) manager.addDrawing(dessin);
        }

        ancresEnCoursRef.current = [];
        setEtapeActuelle(0);
        sourisPixelRef.current = null;
        redessinerOverlay();

        // Réinitialise l'outil actif vers le curseur après une utilisation unique
        if (onDrawingComplete) {
          onDrawingComplete();
        }
      }
    };

    // Gestion du clic en mode curseur (sélection positions custom)
    const gererClicCurseur = (event: PointerEvent) => {
      if (activeTool === null) {
        const rect = conteneur.getBoundingClientRect();
        const px = event.clientX - rect.left;
        const py = event.clientY - rect.top;
        const idClique = detecterClicPositionCanvas(px, py);
        setPositionSelectionneeId(idClique);
        if (idClique) setIdDessinSelectionne(null);
      }
    };

    conteneur.addEventListener('pointerdown', gererClic, true);
    conteneur.addEventListener('pointermove', gererMouvement, true);

    return () => {
      conteneur.removeEventListener('pointerdown', gererClic, true);
      conteneur.removeEventListener('pointermove', gererMouvement, true);
      conteneur.style.cursor = '';
      conteneur.style.touchAction = '';
      ancresEnCoursRef.current = [];
      sourisPixelRef.current = null;
      redessinerOverlay();
    };
  }, [activeTool, detecterClicPositionCanvas, redessinerOverlay, onDrawingComplete]);

  // Gestion du clic en mode curseur (null) pour sélectionner les positions canvas
  useEffect(() => {
    if (activeTool !== null) return;
    const conteneur = chartContainerRef.current;
    if (!conteneur) return;

    const gererClicCurseur = (event: PointerEvent) => {
      const rect = conteneur.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      const idClique = detecterClicPositionCanvas(px, py);
      setPositionSelectionneeId(idClique);
      if (idClique) setIdDessinSelectionne(null);
    };

    conteneur.addEventListener('pointerdown', gererClicCurseur);
    return () => conteneur.removeEventListener('pointerdown', gererClicCurseur);
  }, [activeTool, detecterClicPositionCanvas]);

  const config = activeTool ? CONFIG_OUTILS[activeTool] : null;
  const messageInstruction = config
    ? config.instructions[Math.min(etapeActuelle, config.instructions.length - 1)]
    : null;
  const progresseAncres = config ? `${etapeActuelle}/${config.ancres}` : null;
  const estOutil = activeTool === 'pos-long' || activeTool === 'pos-short';

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Barre de statut */}
      <div className={`flex items-center gap-3 px-4 py-2 text-[11px] border-b flex-shrink-0 transition-colors
        ${theme === 'dark' ? 'bg-[#1e222d] border-[#2a2e39] text-[#787b86]' : 'bg-[#f0f3fa] border-[#e0e3eb] text-[#434651]'}`}
      >
        {messageInstruction ? (
          <>
            <span className="font-bold text-[#2962ff] font-mono shrink-0">{progresseAncres}</span>
            <span className={`font-medium ${estOutil && activeTool === 'pos-long' ? 'text-[#26a69a]' : estOutil ? 'text-[#ef5350]' : 'text-[#d1d4dc]'}`}>
              {messageInstruction}
            </span>
          </>
        ) : (
          <>
            <span className="opacity-50">↖</span>
            <span>
              {activeTool === null
                ? 'Mode Sélection — Touchez/cliquez un dessin pour le modifier · Del pour supprimer'
                : 'Outil sélectionné — cliquez sur le graphique pour commencer'
              }
            </span>
          </>
        )}
        {activeTool && (
          <span className="ml-auto text-[10px] opacity-50">
            <kbd className={`px-1 rounded text-[9px] ${theme === 'dark' ? 'bg-[#2a2e39]' : 'bg-[#e0e3eb]'}`}>Esc</kbd> pour annuler
          </span>
        )}
      </div>

      <div className="relative flex-1">
        <div ref={chartContainerRef} className="w-full h-full" />
        <canvas
          ref={overlayCanvasRef}
          width={chartContainerRef.current?.clientWidth ?? 800}
          height={height}
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: 10 }}
        />

        {/* ── Légende Flottante des Indicateurs Actifs (Style TradingView) ── */}
        <div className="absolute top-2 left-2 z-20 flex flex-col gap-1 pointer-events-auto select-none max-h-56 overflow-y-auto pr-1">
          {scriptsIndicateurs.filter((s) => s.visibleSurGraphique).map((script) => (
            <div
              key={script.id}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#131722]/90 border border-[#2a2e39] text-[11px] text-slate-200 shadow-md backdrop-blur-xs hover:border-slate-500 transition-colors"
            >
              <span className="font-semibold truncate max-w-[130px]" title={script.nom}>
                {script.nom}
              </span>
              <button
                onClick={() => toggleVisibiliteScript(script.id)}
                className="hover:text-sky-400 text-slate-400 transition-colors px-0.5 text-[10px]"
                title={script.visibleSurGraphique ? 'Masquer le tracé' : 'Réafficher le tracé'}
              >
                {script.visibleSurGraphique ? '👁️' : '👁️‍🗨️'}
              </button>
              {onOpenIndicatorModal && (
                <button
                  onClick={() => onOpenIndicatorModal(script.id, 'configuration')}
                  className="hover:text-amber-400 text-slate-400 transition-colors px-0.5 text-[10px]"
                  title="Configurer les variables externes et paramètres"
                >
                  ⚙️
                </button>
              )}
              <button
                onClick={() => retirerScriptDuGraphique(script.id)}
                className="hover:text-red-400 text-slate-400 font-bold px-0.5 text-[11px] transition-colors"
                title="Retirer l'indicateur du graphique"
              >
                ✕
              </button>
            </div>
          ))}
          {scriptsIndicateurs.filter((s) => s.visibleSurGraphique).length === 0 && onOpenIndicatorModal && (
            <button
              onClick={() => onOpenIndicatorModal(undefined, 'indicateurs')}
              className="flex items-center gap-1 px-2 py-1 rounded bg-[#131722]/70 border border-dashed border-[#2a2e39] hover:border-sky-500 text-[10px] text-slate-400 hover:text-sky-300 transition-colors shadow-sm backdrop-blur-xs"
              title="Ajouter un indicateur sur le graphique"
            >
              <span className="text-sky-400 font-bold">fx</span> + Indicateurs
            </button>
          )}
        </div>

        {/* Barre d'outils d'actions flottante (dessin sélectionné OU position canvas) */}
        {(idDessinSelectionne || positionSelectionneeId) && activeTool === null && (
          <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 flex-wrap bg-[#1e222d]/90 p-1.5 rounded-lg border border-[#2a2e39] shadow-xl backdrop-blur-sm">
            {/* Bouton Dupliquer */}
            <button
              onClick={dupliquerDessinSelectionne}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2962ff] hover:bg-[#1e4bd8] text-white text-[11px] font-bold rounded shadow transition-colors"
              title="Dupliquer l'élément sélectionné (Raccourci : Ctrl+D)"
            >
              <span>📋</span> Dupliquer
            </button>

            {/* Bouton Éditer Texte (si c'est une annotation texte) */}
            {estTexteSelectionne && (
              <button
                onClick={editerTexteSelectionne}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f59e0b] hover:bg-[#d97706] text-white text-[11px] font-bold rounded shadow transition-colors"
                title="Modifier le texte de cette annotation"
              >
                <span>✏️</span> Éditer texte
              </button>
            )}

            {/* Bouton Supprimer */}
            <button
              onClick={() => {
                if (positionSelectionneeId) {
                  setPositionsCanvas((prev) => prev.filter((p) => p.id !== positionSelectionneeId));
                  setPositionSelectionneeId(null);
                } else if (idDessinSelectionne) {
                  managerRef.current?.removeDrawing(idDessinSelectionne);
                  setIdDessinSelectionne(null);
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#ef5350] hover:bg-[#e53935] text-white text-[11px] font-bold rounded shadow transition-colors"
            >
              <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor">
                <path d="M6 2a1 1 0 0 0-1 1v.5H3.5a.5.5 0 0 0 0 1H4v8a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-8h.5a.5.5 0 0 0 0-1H11V3a1 1 0 0 0-1-1H6zm1 1h2v.5H7V3zm-2 2h6v7.5H5V5z"/>
              </svg>
              Supprimer
            </button>

            <span className={`text-[9.5px] px-2 py-1 rounded font-mono ${theme === 'dark' ? 'bg-[#2a2e39] text-[#787b86]' : 'bg-[#e0e3eb] text-[#434651]'}`}>
              <kbd className="font-bold text-txt">Ctrl+D</kbd> dupliquer · <kbd className="font-bold text-txt">Del</kbd> supprimer
            </span>
          </div>
        )}
      </div>
    </div>
  );
});
