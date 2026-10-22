import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useBacktestStore, type PositionSimulee, type ContexteRestaurationReplay } from '@/store/backtestStore';
import { parserCsvPrix, agregerBougies } from '@/lib/chartDataHelper';
import type { Bougie } from '@/lib/chartDataHelper';
import { BacktestChart, type BacktestChartHandle } from './BacktestChart';
import { FundamentalHeaderBadge } from './FundamentalHeaderBadge';
import { MacroAccordionTable } from './MacroAccordionTable';
import { MacroCSVUploader } from './MacroCSVUploader';
import { AIDatasetModal } from './AIDatasetModal';
import { BacktestTradeModal } from './BacktestTradeModal';
import { BacktestIndicatorsModal } from './BacktestIndicatorsModal';
import { BacktestBotModal } from './BacktestBotModal';
import type { TradingBot } from '@/types/bot';
import { evaluerBotScript } from '@/lib/bot/botEngine';
import { calculerLuxAlgoSMC } from '@/lib/indicators/luxAlgoSMC';
import { calculerProtectedSwings } from '@/lib/indicators/protectedSwings';
import { calculerZigZag } from '@/lib/indicators/zigzag';
import { calculerUnmitigatedVolumeProfile } from '@/lib/indicators/unmitigatedVolumeProfile';
import { recupererIndicateursStockes, evaluerIndicateurScript } from '@/lib/indicators/indicatorEngine';
import { sauvegarderEchantillon, recupererTousLesEchantillons } from '@/lib/datasetStorage';
import type { EchantillonIA } from '@/types/dataset';
import { useUIStore } from '@/store';
import { TradeDrawer } from '@/components/trade/TradeDrawer';
import { supabase } from '@/lib/supabase';
import { uploadImage, compresserEtConvertirEnBase64 } from '@/lib/storage';
import { sauvegarderBougiesM1Cache, recupererBougiesM1Cache } from '@/lib/backtestCache';
import { ModalInspecteurSetup } from '@/components/laboratoire/ModalInspecteurSetup';
import { ModalBanqueSetups } from '@/components/laboratoire/ModalBanqueSetups';
import { useLaboratoireStore } from '@/store/laboratoireStore';

// ─── Définition de tous les outils de la barre latérale ───────────────────────
// Chaque outil correspond exactement au type string attendu par getToolRegistry().createDrawing()
// id: null = mode curseur (sélection/déplacement des dessins existants)
const OUTILS_TRACAGE = [
  { group: 'Curseur', items: [
    // L'outil souris (id=null) active le mode "Sélection" géré par le DrawingManager
    { id: null, label: 'CURSOR', title: 'Curseur — Sélectionner et déplacer les dessins (aucun tracé)' },
  ]},
  { group: 'Lignes', items: [
    { id: 'trend-line',       label: 'LINE',  title: 'Ligne de Tendance — 2 clics : point A puis point B' },
    { id: 'horizontal-line', label: 'H',     title: 'Ligne Horizontale — 1 clic : un seul point suffit' },
    { id: 'ray',             label: 'RAY',   title: 'Rayon — 2 clics : origine puis direction' },
    { id: 'extended-line',   label: 'EXT',   title: 'Ligne Étendue — 2 clics : s\'étend à l\'infini' },
    { id: 'vertical-line',   label: 'V',     title: 'Ligne Verticale — 1 clic : un seul point suffit' },
  ]},
  { group: 'Formes', items: [
    { id: 'rectangle',       label: 'RECT',  title: 'Rectangle / Zone POI — 2 clics : coin supérieur puis inférieur' },
  ]},
  { group: 'Annotations', items: [
    { id: 'text-annotation', label: 'TEXT',  title: 'Annotation Texte 📝 — 1 clic pour ajouter du texte sur le graphique' },
  ]},
  { group: 'Fibonacci', items: [
    { id: 'fib-retracement', label: 'FIB',   title: 'Fibonacci Retracement — 2 clics : sommet puis creux (ou inverse)' },
  ]},
  { group: 'Trading', items: [
    { id: 'pos-long',  label: 'LONG',  title: 'Position Long ▲ — 3 clics : ① Entrée  ② Stop Loss  ③ Take Profit' },
    { id: 'pos-short', label: 'SHORT', title: 'Position Short ▼ — 3 clics : ① Entrée  ② Stop Loss  ③ Take Profit' },
  ]},
  { group: 'Laboratoire', items: [
    { id: 'setup-probe', label: '🎯 SONDE', title: 'Sonder Setup Wyckoff / Liquidation — 1 clic sur la bougie du Sweep' },
    { id: 'inspect-setup', label: '🔍 DIAG', title: 'Diagnostic Setup (SMC & Sandbox) — Affiche et inspecte les S/R analysés, les scores et la sélection' },
  ]},
];

// Timeframes disponibles pour l'API Binance
const TIMEFRAMES = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '30m', value: '30m' },
  { label: '1h', value: '1h' },
  { label: '4h', value: '4h' },
  { label: '1d', value: '1d' },
  { label: '1w', value: '1w' },
  { label: '1M', value: '1M' },
];



// ─── Palettes de couleurs du Workspace selon le thème ─────────────────────────
// Miroir des couleurs TradingView (sombre / clair)
function getThemeClasses(theme: 'dark' | 'light') {
  const dark = theme === 'dark';
  return {
    bgWorkspace: dark ? 'bg-[#131722] text-[#b2b5be]' : 'bg-white text-[#131722]',
    bgHeader:    dark ? 'bg-[#1e222d] border-[#2a2e39]' : 'bg-[#f0f3fa] border-[#e0e3eb]',
    bgSidebar:   dark ? 'bg-[#1e222d] border-[#2a2e39]' : 'bg-[#f8f9fd] border-[#e0e3eb]',
    bgPanel:     dark ? 'bg-[#1e222d] border-[#2a2e39]' : 'bg-[#f8f9fd] border-[#e0e3eb]',
    textMuted:   dark ? 'text-[#787b86]' : 'text-[#434651]',
    textNormal:  dark ? 'text-[#d1d4dc]' : 'text-[#131722]',
    btnBase:     dark
      ? 'text-[#787b86] hover:bg-[#2a2e39] hover:text-[#d1d4dc]'
      : 'text-[#434651] hover:bg-[#e0e3eb] hover:text-[#131722]',
    btnActive:   'bg-[#2962ff] text-white shadow-md',
    separator:   dark ? 'bg-[#2a2e39]' : 'bg-[#e0e3eb]',
    select:      dark
      ? 'bg-[#2a2e39] text-[#d1d4dc]'
      : 'bg-white border border-[#e0e3eb] text-[#131722]',
    inputBg:     dark ? 'bg-[#131722]' : 'bg-white',
    divider:     dark ? 'divide-[#2a2e39]' : 'divide-[#e0e3eb]',
    border:      dark ? 'border-[#2a2e39]' : 'border-[#e0e3eb]',
    hoverRow:    dark ? 'hover:bg-[#131722]' : 'hover:bg-[#f0f3fa]',
    helpText:    dark ? 'text-[#4a4e5a]' : 'text-[#9598a1]',
    kbdBg:       dark ? 'bg-[#2a2e39]' : 'bg-[#e0e3eb]',
    errBg:       'bg-red-900/30 border-red-700/40 text-red-400',
  };
}

/**
 * Workspace de Backtesting complet — reproduit l'environnement de TradingView Replay.
 * 
 * Fonctionnalités :
 *  - Graphique interactif avec outils de dessin (trend-line, rectangle, fib, positions...)
 *  - Replay bougie par bougie avec contrôles Play/Pause
 *  - Thème clair / sombre (style TradingView)
 *  - Mode plein écran (Esc pour quitter)
 *  - Importation CSV et chargement Binance
 *  - Export des trades simulés vers le Journal
 *  - Raccourcis clavier (Espace, →, Esc)
 */
export function BacktestWorkspace() {

  // ─── États locaux ────────────────────────────────────────────────────────────
  const [largeurFenetre, setLargeurFenetre] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  const [hauteurFenetre, setHauteurFenetre] = useState(typeof window !== 'undefined' ? window.innerHeight : 800);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [outilActif, setOutilActif] = useState<string | null>(null);
  const [estPleinEcran, setEstPleinEcran] = useState(false);
  // En plein écran, les outils et le replay sont toujours visibles (plus de toggle)
  const [theme, setTheme] = useState<'dark' | 'light'>('light');


  // Cache des données brutes M1 pour la ré-agrégation MTF à la volée et le scroll infini
  const [donneesM1Chargees, setDonneesM1Chargees] = useState<Bougie[]>([]);
  const [anneeMinimumChargee, setAnneeMinimumChargee] = useState<number>(2025);
  const isFetchingPrevYear = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Positionnement dynamique des widgets par rapport au parent
  const [hasDraggedUt, setHasDraggedUt] = useState(false);
  const [utPos, setUtPos] = useState({ x: 80, y: 20 });
  const [isDraggingUt, setIsDraggingUt] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const [hasDraggedReplay, setHasDraggedReplay] = useState(false);
  const [replayPos, setReplayPos] = useState({ x: 0, y: 0 });
  const [isDraggingReplay, setIsDraggingReplay] = useState(false);
  const dragOffsetReplayRef = useRef({ x: 0, y: 0 });

  // Gère le début du déplacement (curseur & tactile)
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    // Utilisation de nativeEvent ou cast en any pour éviter les erreurs d'incompatibilité TS2352
    const eventAny = e as any;
    const clientX = 'touches' in eventAny ? eventAny.touches[0].clientX : eventAny.clientX;
    const clientY = 'touches' in eventAny ? eventAny.touches[0].clientY : eventAny.clientY;

    const handle = e.currentTarget as HTMLElement;
    const widget = handle.parentElement;
    if (!widget) return;

    const rect = widget.getBoundingClientRect();
    const parent = widget.parentElement;
    if (!parent) return;
    const parentRect = parent.getBoundingClientRect();

    // Position relative de départ
    const initialX = rect.left - parentRect.left;
    const initialY = rect.top - parentRect.top;

    setIsDraggingUt(true);
    setHasDraggedUt(true);
    setUtPos({ x: initialX, y: initialY });
    dragOffsetRef.current = {
      x: clientX - initialX,
      y: clientY - initialY,
    };
  };

  // Gère le début du déplacement du Dock de Replay
  const handleDragReplayStart = (e: React.MouseEvent | React.TouchEvent) => {
    const eventAny = e as any;
    const clientX = 'touches' in eventAny ? eventAny.touches[0].clientX : eventAny.clientX;
    const clientY = 'touches' in eventAny ? eventAny.touches[0].clientY : eventAny.clientY;

    const handle = e.currentTarget as HTMLElement;
    const widget = handle.parentElement;
    if (!widget) return;

    const rect = widget.getBoundingClientRect();
    const parent = widget.parentElement;
    if (!parent) return;
    const parentRect = parent.getBoundingClientRect();

    const initialX = rect.left - parentRect.left;
    const initialY = rect.top - parentRect.top;

    setIsDraggingReplay(true);
    setHasDraggedReplay(true);
    setReplayPos({ x: initialX, y: initialY });
    dragOffsetReplayRef.current = {
      x: clientX - initialX,
      y: clientY - initialY,
    };
  };


  // Met à jour la position de l'UT pendant le drag
  useEffect(() => {
    if (!isDraggingUt) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      
      const nextX = Math.max(10, Math.min(clientX - dragOffsetRef.current.x, window.innerWidth - 350));
      const nextY = Math.max(10, Math.min(clientY - dragOffsetRef.current.y, window.innerHeight - 150));
      
      setUtPos({ x: nextX, y: nextY });
    };

    const handleEnd = () => {
      setIsDraggingUt(false);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: true });
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDraggingUt]);

  // Met à jour la position du Dock de Replay pendant le drag
  useEffect(() => {
    if (!isDraggingReplay) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      
      const nextX = Math.max(10, Math.min(clientX - dragOffsetReplayRef.current.x, window.innerWidth - 300));
      const nextY = Math.max(10, Math.min(clientY - dragOffsetReplayRef.current.y, window.innerHeight - 100));
      
      setReplayPos({ x: nextX, y: nextY });
    };

    const handleEnd = () => {
      setIsDraggingReplay(false);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: true });
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDraggingReplay]);

  // Convertit le timeframe de Binance vers le format attendu par le journal
  const mapperTimeframe = (tf: string) => {
    switch (tf) {
      case '1m': return 'M1';
      case '5m': return 'M5';
      case '15m': return 'M15';
      case '30m': return 'M30';
      case '1h': return 'H1';
      case '4h': return 'H4';
      case '1d': return 'D1';
      case '1w': return 'W1';
      case '1M': return 'Monthly';
      default: return 'H1';
    }
  };

  // Référence pour appeler les méthodes de capture et de cadrage du graphique
  const chartRef = useRef<BacktestChartHandle | null>(null);
  // ID unique du trade en cours d'exportation pour afficher un spinner
  const [exportantTradeId, setExportantTradeId] = useState<string | null>(null);

  // ─── États pour le Mode Studio Collecte IA ────────────────────────────────
  const [modeStudioIA, setModeStudioIA] = useState(false);
  const [nbBougiesIA, setNbBougiesIA] = useState(80);
  const [modalAIDatasetOuverte, setModalAIDatasetOuverte] = useState(false);
  const [nbEchantillonsIA, setNbEchantillonsIA] = useState(0);
  const [capturantIA, setCapturantIA] = useState(false);
  const [saisieLibreBougies, setSaisieLibreBougies] = useState('');

  // Charge le nombre d'échantillons déjà présents dans le dataset local
  useEffect(() => {
    recupererTousLesEchantillons().then((items) => {
      setNbEchantillonsIA(items.length);
    }).catch((err) => {
      console.warn('⚠️ [Workspace] Erreur lecture dataset IA:', err);
    });
  }, []);

  // Capture un échantillon standardisé pour le dataset IA
  const capturerSetupIA = async (typeEchantillon: 'positif' | 'negatif') => {
    if (!chartRef.current) return;
    setCapturantIA(true);
    try {
      console.log(`🚀 [Workspace] Début de la capture IA (${typeEchantillon})...`);
      const resultat = await chartRef.current.capturerImageIA({ nbBougies: nbBougiesIA });
      if (!resultat.blobClean || !resultat.blobAnnotated) {
        addToast("Impossible de générer l'image IA du graphique", 'error');
        return;
      }

      const [cleanBase64, annotatedBase64] = await Promise.all([
        compresserEtConvertirEnBase64(resultat.blobClean),
        compresserEtConvertirEnBase64(resultat.blobAnnotated),
      ]);

      const bougieCourante = donneesCompletes[indexCourant];
      const dateDeclencheur = bougieCourante ? bougieCourante.time : Date.now();
      const session = typeof dateDeclencheur === 'number' ? detecterSession(dateDeclencheur) : 'London';

      const gain = positionActive ? Math.abs(positionActive.takeProfit - positionActive.prixEntree) : 0;
      const risque = positionActive ? Math.abs(positionActive.prixEntree - positionActive.stopLoss) : 0;
      const rr = risque > 0 ? Number((gain / risque).toFixed(2)) : undefined;

      const nouvelEchantillon: EchantillonIA = {
        id: crypto.randomUUID(),
        dateCreation: new Date().toISOString(),
        paire: actif !== 'Aucun actif' && actif ? actif : paireCloud,
        timeframe: timeframeSauvegarde || 'M5',
        typeEchantillon,
        direction: typeEchantillon === 'positif' && positionActive ? positionActive.direction : 'neutre',
        nbBougies: nbBougiesIA,
        dateBougieDeclencheur: dateDeclencheur,
        prixEntree: positionActive?.prixEntree,
        stopLoss: positionActive?.stopLoss,
        takeProfit: positionActive?.takeProfit,
        ratioRR: rr,
        resultatTrade: positionActive?.resultat || 'inconnu',
        sessionTrading: session as any,
        imageCleanBase64: cleanBase64,
        imageAnnotatedBase64: annotatedBase64,
        boundingBoxes: typeEchantillon === 'positif' ? resultat.boundingBoxes : [],
      };

      await sauvegarderEchantillon(nouvelEchantillon);
      const tous = await recupererTousLesEchantillons();
      setNbEchantillonsIA(tous.length);

      addToast(
        typeEchantillon === 'positif'
          ? `✅ Setup IA capturé (${resultat.boundingBoxes.length} boîte YOLO calculée)`
          : "✅ Échantillon négatif capturé pour l'IA (équilibrage dataset)",
        'success'
      );
    } catch (err) {
      console.error('❌ [Workspace] Erreur capture IA :', err);
      addToast("Erreur lors de la capture de l'échantillon IA", 'error');
    } finally {
      setCapturantIA(false);
    }
  };

  // Gère l'affichage du menu déroulant de capture d'écran
  const [menuCaptureOuvert, setMenuCaptureOuvert] = useState(false);
  // Indique si une capture d'écran manuelle est en cours d'upload
  const [capturantManuel, setCapturantManuel] = useState(false);
  // Référence pour le conteneur du menu (permet de détecter les clics extérieurs)
  const menuRef = useRef<HTMLDivElement>(null);
  // Référence pour le bouton de l'appareil photo
  const boutonRef = useRef<HTMLButtonElement>(null);
  // Position calculée à l'écran pour le menu déroulant fixe (évite l'overflow du header)
  const [positionMenu, setPositionMenu] = useState<{ top: number; right: number } | null>(null);


  useEffect(() => {
    // Met à jour la largeur et hauteur de la fenêtre lors du redimensionnement ou rotation d'écran
    const gererResize = () => {
      setLargeurFenetre(window.innerWidth);
      setHauteurFenetre(window.innerHeight);
    };
    window.addEventListener('resize', gererResize);
    return () => window.removeEventListener('resize', gererResize);
  }, []);

  // Ferme le menu déroulant de capture d'écran lorsqu'on clique à l'extérieur de celui-ci
  useEffect(() => {
    console.log('🔌 [Workspace] Effect ClicExtérieur : menuCaptureOuvert =', menuCaptureOuvert);
    const gererClicExterieur = (evenement: MouseEvent) => {
      console.log('🖱️ [Workspace] Clic détecté sur le document, cible :', evenement.target);
      if (menuRef.current) {
        const estInterieur = menuRef.current.contains(evenement.target as Node);
        console.log('🖱️ [Workspace] Clic à l\'intérieur du menu ?', estInterieur);
        if (!estInterieur) {
          console.log('❌ [Workspace] Clic extérieur détecté → Fermeture du menu');
          setMenuCaptureOuvert(false);
        }
      }
    };
    if (menuCaptureOuvert) {
      document.addEventListener('mousedown', gererClicExterieur);
    }
    return () => {
      console.log('🔌 [Workspace] Nettoyage Effect ClicExtérieur');
      document.removeEventListener('mousedown', gererClicExterieur);
    };
  }, [menuCaptureOuvert]);

  // Bascule entre le mode standard et le mode Plein Écran Total immersif
  const basculerPleinEcran = useCallback(() => {
    if (!estPleinEcran) {
      setEstPleinEcran(true);
      try {
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      } catch (e) {
        // Ignorer si non supporté sur la plateforme
      }
    } else {
      setEstPleinEcran(false);
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      } catch (e) {
        // Ignorer
      }
    }
  }, [estPleinEcran]);

  // Synchronisation avec les événements de plein écran natif du navigateur / Android
  useEffect(() => {
    const gererChangementFullscreen = () => {
      if (!document.fullscreenElement && estPleinEcran) {
        setEstPleinEcran(false);
      }
    };
    document.addEventListener('fullscreenchange', gererChangementFullscreen);
    return () => document.removeEventListener('fullscreenchange', gererChangementFullscreen);
  }, [estPleinEcran]);

  const estMobile = largeurFenetre < 768;

  // Hauteur du graphique optimisée :
  // - En plein écran TOTAL : prend 100% de la hauteur de l'écran (aucune barre parasite)
  // - Sur smartphone Android (hors plein écran) : calcul dynamique pour maximiser la vue des bougies
  // - Sur tablette et Desktop : 600px pour un grand confort d'analyse
  const hauteurGraphique = estPleinEcran
    ? hauteurFenetre
    : estMobile
      ? Math.max(440, hauteurFenetre - 160)
      : 600;

  // Classes CSS calculées selon le thème courant
  const C = getThemeClasses(theme);

  // Modale d'upload CSV Macro
  const [showMacroUploaderModal, setShowMacroUploaderModal] = useState(false);

  // ─── Store de Backtesting (Zustand) ─────────────────────────────────────────
  const {
    actif,
    donneesCompletes,
    indexCourant,
    estEnLecture,
    vitesseLecture,
    positionActive,
    historiqueSimule,
    chargerDonnees,
    avancerBougie,
    reculerBougie,
    setEstEnLecture,
    setVitesseLecture,
    ouvrirPosition,
    archiverPositionActive,
    fermerPositionManuellement,
    supprimerTradeHistorique,
    mettreAJourDonneesMtf,
    setDonneesM1,
    paireCloud,
    anneeCloud,
    timeframeSauvegarde,
    journalDest,
    setPaireCloud,
    setAnneeCloud,
    setTimeframeSauvegarde,
    setJournalDest,
    contexteRestauration,
    nettoyerRestaurationContexte,
    fundamentalModeEnabled,
    toggleFundamentalMode,
    activeSnapshot,
    macroEvents,
    afficherProtectedSwings,
    toggleProtectedSwings,
    afficherUnmitigatedProfile,
    toggleUnmitigatedProfile,
    afficherZigZag,
    toggleZigZag,
    afficherLuxAlgoSMC,
    toggleLuxAlgoSMC,
  } = useBacktestStore();

  // Le timeframe local est initialisé depuis le store persisté (timeframeSauvegarde)
  // On utilise un useState local pour la réactivité UI, mais on le synchronise au store
  const [timeframe, setTimeframeLocal] = useState(timeframeSauvegarde || 'H1');
  const [modalIndicateursOuvert, setModalIndicateursOuvert] = useState(false);
  const [scriptIdPourEdition, setScriptIdPourEdition] = useState<string | null>(null);
  const [ongletInitialIndicateurs, setOngletInitialIndicateurs] = useState<'indicateurs' | 'configuration' | 'editeur' | 'telemetrie'>('indicateurs');
  const [modalBotOuverte, setModalBotOuverte] = useState(false);
  const [botReplayActif, setBotReplayActif] = useState<TradingBot | null>(null);

  const scriptsIndicateurs = useBacktestStore((s) => s.scriptsIndicateurs);

  // Nombre d'indicateurs actuellement visibles sur le graphique
  const nbIndicateursActifs = scriptsIndicateurs.filter((s) => s.visibleSurGraphique).length;

  // Fonction pour changer l'UT et mémoriser dans le store en même temps
  // Exemple : setTimeframe('H4') → met à jour l'UI et persist dans le sessionStorage
  const setTimeframe = (tf: string) => {
    setTimeframeLocal(tf);
    setTimeframeSauvegarde(tf);
  };

  const openNewTradeWithPrefill = useUIStore((s) => s.openNewTradeWithPrefill);
  const isNewTradeOpen = useUIStore((s) => s.isNewTradeOpen);
  const addToast = useUIStore((s) => s.addToast);
  const tradeActifReplay = useLaboratoireStore((s) => s.contexteTradeActif);

  // Chargement automatique au premier montage OU si les données M1 ont été perdues après navigation
  // Si donneesCompletes ou donneesM1Chargees est vide, on recharge depuis IndexedDB ou le Cloud
  useEffect(() => {
    // Si on a une restauration en cours, on laisse le useEffect dédié gérer
    if (contexteRestauration) return;

    if (donneesCompletes.length === 0 || donneesM1Chargees.length === 0) {
      // Recharge la paire/année mémorisée dans le store depuis le cache IndexedDB ou le Cloud
      chargerDonneesCloud(paireCloud, anneeCloud);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Détecte la demande de restauration de contexte depuis le journal (Replay Link)
  useEffect(() => {
    if (!contexteRestauration) return;

    const restaurer = async () => {
      const { pair, annee, timeframe: tfRestaurer, timestamp, position, tradeInfo } = contexteRestauration;
      console.log(`🔄 [Replay Link] Demande de restauration vers ${pair} ${annee} ${tfRestaurer} à timestamp ${timestamp}`, position);
      
      // 1. Met à jour l'UT locale
      setTimeframeLocal(tfRestaurer);
      setTimeframeSauvegarde(tfRestaurer);

      // 2. Transmet le trade actif au Laboratoire pour l'associer à la sonde
      if (tradeInfo) {
        useLaboratoireStore.getState().definirTradeActif({
          id: tradeInfo.id,
          titre: tradeInfo.titre,
          noteQualite: tradeInfo.noteQualite,
          setupName: tradeInfo.setupName,
          pair,
        });
      }

      // 3. Charge les données avec ciblage précis de la bougie et restauration de la position active
      await chargerDonneesCloud(pair, annee, timestamp, tfRestaurer, position);

      // 4. Consomme le contexte pour ne pas reboucler
      nettoyerRestaurationContexte();
      const noteLabel = tradeInfo?.noteQualite ? ` [${tradeInfo.noteQualite}]` : '';
      addToast(`Replay positionné sur l'entrée du trade (${pair} en ${tfRestaurer})${noteLabel}`, 'info');
    };

    restaurer();
  }, [contexteRestauration]); // eslint-disable-line react-hooks/exhaustive-deps


  // Ré-agrégation automatique au changement d'unité de temps (UT) pour les données locales/cloud M1
  useEffect(() => {
    if (donneesM1Chargees.length === 0) return;
    console.log(`⏱️ [Re-Aggregation] Changement d'UT vers ${timeframe}. Ré-agrégation des données M1...`);
    const bougiesAgregees = agregerBougies(donneesM1Chargees, timeframe);
    mettreAJourDonneesMtf(bougiesAgregees);
    console.log(`⏱️ [Re-Aggregation] Données ré-agrégées en ${timeframe} — ${bougiesAgregees.length} bougies générées`);
  }, [timeframe, donneesM1Chargees, mettreAJourDonneesMtf]);

  // ─── Boucle de lecture du Replay avec support Bot Automatique ───────────────
  useEffect(() => {
    if (!estEnLecture) return;

    const intervalle = setInterval(() => {
      // 1. Si un bot tourne et que la position précédente est clôturée par le SL/TP, on l'archive pour enchaîner
      const stateStore = useBacktestStore.getState();
      if (botReplayActif && stateStore.positionActive && stateStore.positionActive.estCloturee) {
        archiverPositionActive();
      }

      // 2. Faire avancer le graphique d'une bougie
      const continuer = avancerBougie();
      if (!continuer) {
        clearInterval(intervalle);
        addToast('Replay terminé — fin des données disponibles.', 'info');
        return;
      }

      // 3. Si un bot automatique est activé en Replay Visuel
      if (botReplayActif) {
        const stateApres = useBacktestStore.getState();
        const indexActuel = stateApres.indexCourant;
        const posActuelle = stateApres.positionActive;

        if (!posActuelle && indexActuel >= 30) {
          const bougies = stateApres.donneesCompletes;
          const bougie = bougies[indexActuel];
          const debutFenetre = Math.max(0, indexActuel - 120);
          const fenetre = bougies.slice(debutFenetre, indexActuel + 1);

          const smc = calculerLuxAlgoSMC(fenetre);
          const swings = calculerProtectedSwings(fenetre);
          const zigzag = calculerZigZag(fenetre);
          const uvp = calculerUnmitigatedVolumeProfile(fenetre);

          // Évaluation dynamique des indicateurs en scripts avec télémétrie active
          const scriptsStockes = stateApres.scriptsIndicateurs.length > 0
            ? stateApres.scriptsIndicateurs
            : recupererIndicateursStockes();
          const scriptsDonnees: Record<string, any> = {};

          for (const s of scriptsStockes) {
            if (s.collecteActive) {
              try {
                const resScript = evaluerIndicateurScript(s.code, {
                  bougies: fenetre,
                  parametres: s.parametres || {},
                });
                if (resScript) {
                  scriptsDonnees[s.id] = resScript.donnees;
                }
              } catch (e) {
                // Silencieux
              }
            }
          }

          const decision = evaluerBotScript(botReplayActif.code, {
            bougie: bougie,
            index: indexActuel,
            historique: fenetre,
            indicateurs: {
              smc,
              swings,
              zigzag,
              uvp,
              scripts: scriptsDonnees,
              ...scriptsDonnees,
            },
            positionActive: null,
            compte: { capitalInitial: 10000, capitalActuel: 10000, tradesEffectues: stateApres.historiqueSimule.length },
            parametres: botReplayActif.parametres,
          });

          if (decision && (decision.action === 'BUY' || decision.action === 'SELL')) {
            const direction = decision.action === 'BUY' ? 'long' : 'short';
            const prixEntree = decision.prixEntree || bougie.close;
            const sl = decision.stopLoss || (direction === 'long' ? prixEntree * 0.995 : prixEntree * 1.005);
            const dist = Math.abs(prixEntree - sl);
            const ratio = Number(botReplayActif.parametres.ratioRR || 2.0);
            const tp = decision.takeProfit || (direction === 'long' ? prixEntree + dist * ratio : prixEntree - dist * ratio);

            ouvrirPosition(direction, prixEntree, sl, tp);
            addToast(`🤖 [${botReplayActif.nom}] Ordre ${decision.action} exécuté à ${prixEntree}`, 'info');
          }
        }
      }
    }, vitesseLecture);

    return () => clearInterval(intervalle);
  }, [estEnLecture, vitesseLecture, avancerBougie, botReplayActif, archiverPositionActive, ouvrirPosition, addToast]);

  // ─── Automatisation du Journaling en 2 Étapes ───────────────────────────────
  const [initialisantPlanification, setInitialisantPlanification] = useState(false);
  const [initialisantResolution, setInitialisantResolution] = useState(false);

  // Modale mobile ultra-rapide (< 16ms) pour planifier/enregistrer un trade sans freeze
  const [modalMobileOuverte, setModalMobileOuverte] = useState(false);
  const [promiseCaptureMobile, setPromiseCaptureMobile] = useState<Promise<{ id: string; url: string; source: 'upload'; phase: 'avant' | 'apres'; storage_path?: string } | null> | null>(null);

  // Capture le graphique et upload vers Supabase — utilisée automatiquement ET manuellement
  // Retourne l'objet image prêt à insérer dans le formulaire, ou null si erreur
  const capturerGraphique = useCallback(async (phase: 'avant' | 'apres'): Promise<{ id: string; url: string; source: 'upload'; phase: 'avant' | 'apres'; storage_path?: string } | null> => {
    try {
      if (!chartRef.current) return null;
      const blob = await chartRef.current.takeScreenshot();
      if (!blob) return null;
      
      // On convertit le screenshot en base64 pour que ce soit instantané/offline-first
      const base64Url = await compresserEtConvertirEnBase64(blob);
      return { 
        id: crypto.randomUUID(), 
        url: base64Url, 
        source: 'upload' as const, 
        phase,
        storage_path: 'local_pending'
      };
    } catch (err) {
      console.error('❌ [Backtest] Échec de la capture :', err);
      return null;
    }
  }, []);

  // Calcule automatiquement la session de trading en fonction de l'heure UTC de la bougie d'entrée
  const detecterSession = (timestampUnix: number): string => {
    const date = new Date(timestampUnix * 1000);
    const heure = date.getUTCHours();
    // Session London : 07h00 - 12h00 UTC
    // Session New York : 12h00 - 20h00 UTC
    // Session Asian : 20h00 - 07h00 UTC
    if (heure >= 7 && heure < 12) return 'London';
    if (heure >= 12 && heure < 20) return 'New York';
    return 'Asian';
  };

  // Convertit un timestamp Unix en format d'heure HH:MM pour le formulaire
  const formaterHeure = (timestampUnix: number | undefined): string => {
    if (!timestampUnix) return '';
    const date = new Date(timestampUnix * 1000);
    const h = String(date.getUTCHours()).padStart(2, '0');
    const m = String(date.getUTCMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  };

  // Propose une unité de temps (timeframe) logique et supérieure pour le POI
  const calculerPoiTimeframe = (tfBacktest: string): string => {
    switch (tfBacktest) {
      case '1m': return 'M15';
      case '3m': return 'M15';
      case '5m': return 'H1';
      case '15m': return 'H1';
      case '30m': return 'H4';
      case '1h': return 'H4';
      case '4h': return 'D1';
      case '1d': return 'W1';
      default: return 'H1';
    }
  };

  const initialiserPlanificationTrade = useCallback(async (position: PositionSimulee, forcerDesktop: boolean = false) => {
    // 🚀 Sur mobile (smartphone) : ouverture instantanée de la modal tactile dédiée (< 16ms)
    // La capture d'écran s'effectue en arrière-plan sans bloquer l'interface
    if (estMobile && !forcerDesktop) {
      console.log('⚡ [Backtest] Ouverture instantanée de la modale mobile de planification');
      const capturePromise = capturerGraphique('avant');
      setPromiseCaptureMobile(capturePromise);
      setModalMobileOuverte(true);
      return;
    }

    // 1️⃣ Capture automatique du graphique EN PREMIER (mode bureau)
    const imageAvant = await capturerGraphique('avant');

    // 2️⃣ Activation de l'état d'initialisation pour faire sortir le drawer
    setInitialisantPlanification(true);

    const dateTexte = typeof position.dateEntree === 'number'
      ? new Date(position.dateEntree * 1000).toISOString().split('T')[0]
      : String(position.dateEntree).split('T')[0];

    const plannedDiff = Math.abs(position.takeProfit - position.prixEntree);
    const plannedRisk = Math.abs(position.prixEntree - position.stopLoss);
    const rrP = plannedRisk > 0 ? (plannedDiff / plannedRisk).toFixed(2) : '1.00';

    const imageAvant_obj = imageAvant ?? null;

    const timestampUnix = typeof position.dateEntree === 'number'
      ? position.dateEntree
      : Math.floor(new Date(position.dateEntree).getTime() / 1000);

    const contextReplay = {
      pair: actif !== 'Aucun actif' && actif ? actif : paireCloud,
      annee: anneeCloud,
      timeframe: timeframe,
      timestamp: timestampUnix,
      prixEntree: position.prixEntree,
      stopLoss: position.stopLoss,
      takeProfit: position.takeProfit,
      direction: position.direction,
      dureeEstimeeHeures: position.dureeEstimeeHeures,
      dureeEstimeeBougies: position.dureeEstimeeBougies,
      dureeEstimeeLargeur: position.dureeEstimeeLargeur,
    };

    const prefillObj = {
      pair: actif !== 'Aucun actif' && actif ? actif : paireCloud,
      direction: position.direction,
      date_backtested: dateTexte,
      result: 'win' as const,
      journal_type: journalDest,
      entry_price: position.prixEntree.toFixed(5),
      entry_sl: position.stopLoss.toFixed(5),
      entry_tp: position.takeProfit.toFixed(5),
      rr_planned: rrP,
      
      // -- Enrichissements intelligents --
      session: detecterSession(timestampUnix),
      entry_time: formaterHeure(timestampUnix),
      duree_estimee_heures: position.dureeEstimeeHeures !== undefined ? String(position.dureeEstimeeHeures) : '',
      duree_estimee_bougies: position.dureeEstimeeBougies !== undefined ? String(position.dureeEstimeeBougies) : '',
      
      biais_timeframe: mapperTimeframe(timeframe),
      biais_direction: position.direction === 'long' ? 'Haussier' : 'Baissier',
      poi_timeframe: calculerPoiTimeframe(timeframe),
      poi_type: 'Order Block',
      entry_timeframe: mapperTimeframe(timeframe),

      // Configuration des 3 sections d'avant-position
      biais_images: imageAvant_obj ? [imageAvant_obj] : [],
      poi_images: imageAvant_obj ? [imageAvant_obj] : [],
      entry_images: imageAvant_obj ? [imageAvant_obj] : [],
      backtest_context: contextReplay,
    };

    console.log("📡 [Backtest] Pré-remplissage Planification :", prefillObj);
    openNewTradeWithPrefill(prefillObj);

    setInitialisantPlanification(false);
  }, [actif, paireCloud, journalDest, timeframe, openNewTradeWithPrefill, capturerGraphique, estMobile]);

  const initialiserResolutionTrade = useCallback(async (position: PositionSimulee, forcerDesktop: boolean = false) => {
    // 🚀 Sur mobile (smartphone) : ouverture instantanée de la modal tactile dédiée (< 16ms)
    // La capture d'écran s'effectue en arrière-plan sans bloquer l'interface
    if (estMobile && !forcerDesktop) {
      console.log('⚡ [Backtest] Ouverture instantanée de la modale mobile de résolution');
      const capturePromise = capturerGraphique('apres');
      setPromiseCaptureMobile(capturePromise);
      setModalMobileOuverte(true);
      return;
    }

    // 1️⃣ Capture automatique du graphique EN PREMIER (mode bureau)
    const imageApres = await capturerGraphique('apres');

    // 2️⃣ Activation de l'état d'initialisation pour faire sortir le drawer
    setInitialisantResolution(true);

    const imageApres_obj = imageApres ?? null;

    const resultMapping = position.resultat === 'win' ? 'win' as const
      : position.resultat === 'loss' ? 'loss' as const
      : position.resultat === 'breakeven' ? 'breakeven' as const
      : 'missed' as const;

    const plannedDiff = Math.abs(position.takeProfit - position.prixEntree);
    const plannedRisk = Math.abs(position.prixEntree - position.stopLoss);
    const rrP = plannedRisk > 0 ? (plannedDiff / plannedRisk).toFixed(2) : '1.00';

    const realizedDiff = Math.abs((position.prixSortie || 0) - position.prixEntree);
    const rrR = position.resultat === 'missed'
      ? '0.00'
      : plannedRisk > 0 ? (realizedDiff / plannedRisk).toFixed(2) : '0';

    const timestampUnix = typeof position.dateEntree === 'number'
      ? position.dateEntree
      : Math.floor(new Date(position.dateEntree).getTime() / 1000);

    const timestampSortie = typeof position.dateSortie === 'number'
      ? position.dateSortie
      : position.dateSortie ? Math.floor(new Date(position.dateSortie).getTime() / 1000) : undefined;

    // Déterminer le type de sortie exact (TP, SL, ou Manuel)
    let exitType: 'tp' | 'sl' | 'manual' | 'breakeven' = 'manual';
    if (position.resultat === 'win') {
      exitType = 'tp';
    } else if (position.resultat === 'loss') {
      exitType = 'sl';
    } else if (position.resultat === 'breakeven') {
      exitType = 'breakeven';
    }

    const contextReplay = {
      pair: actif !== 'Aucun actif' && actif ? actif : paireCloud,
      annee: anneeCloud,
      timeframe: timeframe,
      timestamp: timestampUnix,
      prixEntree: position.prixEntree,
      stopLoss: position.stopLoss,
      takeProfit: position.takeProfit,
      direction: position.direction,
      dureeEstimeeHeures: position.dureeEstimeeHeures,
      dureeEstimeeBougies: position.dureeEstimeeBougies,
      dureeEstimeeLargeur: position.dureeEstimeeLargeur,
    };

    const prefillObj = {
      pair: actif !== 'Aucun actif' && actif ? actif : paireCloud,
      direction: position.direction,
      result: resultMapping,
      journal_type: journalDest,
      entry_price: position.prixEntree.toFixed(5),
      entry_sl: position.stopLoss.toFixed(5),
      entry_tp: position.takeProfit.toFixed(5),
      rr_planned: rrP,
      rr_realized: rrR,
      pnl: position.resultat === 'missed' ? 0 : (position.pnl !== undefined ? Number(position.pnl.toFixed(2)) : 0),
      duree_reelle_bougies: position.dureeReelleBougies !== undefined ? String(position.dureeReelleBougies) : '',
      
      // -- Enrichissements intelligents --
      session: detecterSession(timestampUnix),
      entry_time: formaterHeure(timestampUnix),
      exit_time: timestampSortie ? formaterHeure(timestampSortie) : '',
      exit_type: exitType,
      duree_estimee_heures: position.dureeEstimeeHeures !== undefined ? String(position.dureeEstimeeHeures) : '',
      duree_estimee_bougies: position.dureeEstimeeBougies !== undefined ? String(position.dureeEstimeeBougies) : '',
      
      biais_timeframe: mapperTimeframe(timeframe),
      poi_timeframe: calculerPoiTimeframe(timeframe),
      entry_timeframe: mapperTimeframe(timeframe),

      entry_images: imageApres_obj ? [imageApres_obj] : [],
      backtest_context: contextReplay,
    };

    console.log("📡 [Backtest] Pré-remplissage Résolution :", prefillObj);
    openNewTradeWithPrefill(prefillObj);

    setInitialisantResolution(false);
  }, [actif, paireCloud, journalDest, timeframe, openNewTradeWithPrefill, capturerGraphique, estMobile]);

  // Permet à l'utilisateur sur mobile d'ouvrir le grand formulaire complet avec confluences
  const handleOuvrirFormulaireComplet = useCallback(() => {
    setModalMobileOuverte(false);
    if (!positionActive) return;
    if (!positionActive.estCloturee) {
      initialiserPlanificationTrade(positionActive, true);
    } else {
      initialiserResolutionTrade(positionActive, true);
    }
  }, [positionActive, initialiserPlanificationTrade, initialiserResolutionTrade]);

  // Hook pour observer l'ouverture d'une nouvelle position active (Étape 1) - Déclenchement auto désactivé
  const lastPositionRef = useRef<PositionSimulee | null>(null);
  useEffect(() => {
    if (!positionActive) {
      lastPositionRef.current = null;
    }
  }, [positionActive]);

  // Hook pour observer la clôture d'une position active (Étape 2) - Toast informatif
  const lastClotureRef = useRef<boolean>(false);
  useEffect(() => {
    if (!positionActive || !positionActive.estCloturee) {
      lastClotureRef.current = false;
      return;
    }

    if (positionActive.estCloturee && !lastClotureRef.current) {
      lastClotureRef.current = true;
      if (positionActive.resultat === 'missed') {
        addToast("🟡 Position Manquée : Le cours a atteint l'objectif sans déclencher l'ordre d'entrée !", "info");
      } else if (positionActive.resultat === 'win') {
        addToast("🎯 Take Profit atteint !", "success");
      } else if (positionActive.resultat === 'loss') {
        addToast("❌ Stop Loss touché !", "error");
      }
    }
  }, [positionActive, addToast]);


  // ─── Raccourcis clavier ─────────────────────────────────────────────────────
  useEffect(() => {
    const gererTouche = (e: KeyboardEvent) => {
      // Espace : basculer Play/Pause (ne pas intercepter si focus sur input)
      if (e.code === 'Space' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        setEstEnLecture(!estEnLecture);
      }
      // Flèche droite : avancer d'une bougie
      if (e.code === 'ArrowRight') {
        e.preventDefault();
        avancerBougie();
      }
      // Échap : quitter plein écran et revenir au curseur
      if (e.code === 'Escape') {
        if (estPleinEcran) {
          basculerPleinEcran();
        }
        setOutilActif(null);
      }
    };
    window.addEventListener('keydown', gererTouche);
    return () => window.removeEventListener('keydown', gererTouche);
  }, [estEnLecture, avancerBougie, setEstEnLecture, estPleinEcran, basculerPleinEcran]);

  // ─── Importation CSV (Supporte la sélection multiple .csv et .csv.gz) ──────
  const gererCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fichiers = e.target.files;
    if (!fichiers || fichiers.length === 0) return;
    setChargement(true);
    try {
      let toutesBougiesM1: Bougie[] = [];
      let anneeStart = 2025;
      let nomActif = '';

      // Lecture et combinaison de tous les fichiers sélectionnés
      for (let i = 0; i < fichiers.length; i++) {
        const fichier = fichiers[i];
        let texteCsv = '';
        if (fichier.name.endsWith('.gz')) {
          const stream = fichier.stream().pipeThrough(new DecompressionStream('gzip'));
          const reponse = new Response(stream);
          texteCsv = await reponse.text();
        } else {
          texteCsv = await fichier.text();
        }
        
        const bougiesM1 = parserCsvPrix(texteCsv);
        toutesBougiesM1 = toutesBougiesM1.concat(bougiesM1);

        if (!nomActif) nomActif = fichier.name.replace(/\.csv(\.gz)?$/, '').split('_')[0];
        
        const anneeTrouvee = fichier.name.match(/\d{4}/);
        if (anneeTrouvee) {
          const annee = parseInt(anneeTrouvee[0]);
          if (annee < anneeStart || i === 0) anneeStart = annee;
        }
      }

      // Trier toutes les bougies par ordre chronologique
      toutesBougiesM1.sort((a, b) => {
        const tA = typeof a.time === 'number' ? a.time : new Date(a.time).getTime() / 1000;
        const tB = typeof b.time === 'number' ? b.time : new Date(b.time).getTime() / 1000;
        return tA - tB;
      });

      const paireActuelle = nomActif.toUpperCase() || 'INCONNU';

      setDonneesM1Chargees(toutesBougiesM1);
      setDonneesM1(toutesBougiesM1);
      setAnneeMinimumChargee(anneeStart);
      setPaireCloud(paireActuelle);
      setAnneeCloud(String(anneeStart));

      // Sauvegarde dans IndexedDB pour permettre l'utilisation et le replay 100% offline
      await sauvegarderBougiesM1Cache(paireActuelle, String(anneeStart), toutesBougiesM1);

      // Agréger pour le timeframe actif
      const bougiesAgregees = agregerBougies(toutesBougiesM1, timeframe);
      chargerDonnees(bougiesAgregees, paireActuelle);
      addToast(`${fichiers.length} fichier(s) lus — ${toutesBougiesM1.length} bougies agrégées en ${timeframe}`, 'success');
    } catch (err: any) {
      addToast(err.message || 'Erreur lors de la lecture des fichiers', 'error');
    } finally {
      setChargement(false);
      e.target.value = '';
    }
  };

  // ─── Téléchargement Cloud Multi-Miroirs (avec système de fallback automatique) ─
  /**
   * Télécharge un fichier Forex compressé (.csv.gz) depuis le Cloud avec basculement automatique sur plusieurs miroirs.
   * Résout les blocages et les timeouts réseau en tentant GitHub Raw en priorité.
   * 
   * Exemple :
   * const reponse = await telechargerFichierCloud('EURUSD_M1_2025.csv.gz');
   */
  const telechargerFichierCloud = async (nomFichier: string): Promise<Response> => {
    // Miroirs en ordre de priorité — GitHub Raw est le plus fiable pour les fichiers publics
    const miroirs = [
      `https://raw.githubusercontent.com/fre-max/Forex_Data/main/forex_data/${nomFichier}`,
      `https://github.com/fre-max/Forex_Data/raw/main/forex_data/${nomFichier}`,
      `https://cdn.jsdelivr.net/gh/fre-max/Forex_Data@main/forex_data/${nomFichier}`,
      `https://cdn.statically.io/gh/fre-max/Forex_Data/main/forex_data/${nomFichier}`,
    ];

    // Résumé des tentatives pour afficher un message d'erreur utile à l'utilisateur
    const tentatives: string[] = [];
    let derniereErreur: Error | null = null;

    for (const url of miroirs) {
      try {
        console.log(`📡 [Cloud Loader] Tentative sur : ${url}`);
        // Timeout de 25s — assez long pour les connexions mobiles lentes
        const controleur = new AbortController();
        const idTimeout = setTimeout(() => controleur.abort(), 25000);

        // mode: 'cors' est explicite pour éviter les requêtes opaque sur les CDN
        const reponse = await fetch(url, {
          signal: controleur.signal,
          mode: 'cors',
          cache: 'default',
        });
        clearTimeout(idTimeout);

        if (reponse.ok) {
          console.log(`✅ [Cloud Loader] Succès sur : ${url}`);
          return reponse;
        } else {
          const msg = `HTTP ${reponse.status} sur ${url}`;
          console.warn(`⚠️ [Cloud Loader] ${msg}`);
          tentatives.push(msg);
          derniereErreur = new Error(msg);
        }
      } catch (erreur: any) {
        const message = erreur?.name === 'AbortError'
          ? `Timeout (25s) sur ${url}`
          : `${erreur?.message || String(erreur)} — sur ${url}`;
        console.warn(`⚠️ [Cloud Loader] Échec miroir : ${message}`);
        tentatives.push(message);
        derniereErreur = erreur;
      }
    }

    // Message d'erreur détaillé avec toutes les tentatives pour faciliter le debug
    const detail = tentatives.map((t, i) => `${i + 1}. ${t}`).join('\n');
    throw new Error(
      `Impossible de télécharger ${nomFichier}.\n\nTentatives échouées :\n${detail}\n\nVérifie ta connexion ou charge un fichier CSV localement.`
    );
  };

  /**
   * Décompresse un fichier gzip en texte de manière universelle.
   * Tente d'abord le DecompressionStream natif du navigateur, et bascule sur pako
   * si la WebView Android ne fournit pas de flux de décompression complet.
   */
  const decompresserGzipEnTexte = async (reponse: Response): Promise<string> => {
    const buffer = await reponse.arrayBuffer();

    // 1. Essai avec DecompressionStream natif
    if (typeof DecompressionStream !== 'undefined') {
      try {
        const blob = new Blob([buffer]);
        const stream = blob.stream().pipeThrough(new DecompressionStream('gzip'));
        const texte = await new Response(stream).text();
        if (texte && texte.length > 0) return texte;
      } catch (e) {
        console.warn('⚠️ [Decompress] Fallback vers le décompresseur pako:', e);
      }
    }

    // 2. Fallback universel pako (supporté sur 100% des smartphones Android et iOS)
    const pako = await import('pako');
    return pako.ungzip(new Uint8Array(buffer), { to: 'string' });
  };

  // ─── Chargement Cloud / Cache Local depuis IndexedDB ───────────────────────
  const chargerDonneesCloud = async (
    paireSel: string,
    anneeSel: string,
    targetTimestamp?: number,
    targetTimeframe?: string,
    targetPosition?: ContexteRestaurationReplay['position']
  ) => {
    setChargement(true);
    setErreur(null);
    try {
      const activeTf = targetTimeframe || timeframe;
      let bougiesM1: Bougie[] | null = null;

      // 1️⃣ Tentative de lecture depuis le cache IndexedDB local (Mode Offline First)
      bougiesM1 = await recupererBougiesM1Cache(paireSel, anneeSel);

      // 2️⃣ Si les données ne sont pas en cache local, on les télécharge depuis le Cloud
      if (!bougiesM1 || bougiesM1.length === 0) {
        const nomFichier = `${paireSel.toUpperCase()}_M1_${anneeSel}.csv.gz`;
        
        console.log(`📡 [Cloud Loader] Début du téléchargement de ${nomFichier}...`);
        const reponse = await telechargerFichierCloud(nomFichier);
        const texteCsv = await decompresserGzipEnTexte(reponse);
        bougiesM1 = parserCsvPrix(texteCsv);

        // 3️⃣ Enregistrement dans IndexedDB pour les prochaines fois (et le mode offline)
        await sauvegarderBougiesM1Cache(paireSel, anneeSel, bougiesM1);
      } else {
        console.log(`⚡ [Cloud Loader] Données M1 de ${paireSel} (${anneeSel}) chargées directement depuis le cache offline IndexedDB.`);
      }

      setDonneesM1Chargees(bougiesM1);
      setDonneesM1(bougiesM1);
      const anneeInt = parseInt(anneeSel);
      setAnneeMinimumChargee(anneeInt);

      // Mémoriser la paire et l'année dans le store (persisté en sessionStorage)
      setPaireCloud(paireSel.toUpperCase());
      setAnneeCloud(anneeSel);

      // Agréger pour le timeframe actif
      const bougiesAgregees = agregerBougies(bougiesM1, activeTf);
      chargerDonnees(bougiesAgregees, paireSel.toUpperCase());

      // Si un timestamp de ciblage est spécifié (restauration de trade)
      if (targetTimestamp !== undefined) {
        const targetTimeVal = targetTimestamp;
        let indexTrouve = -1;

        // 1. Recherche exacte
        indexTrouve = bougiesAgregees.findIndex((b) => {
          const tempsSec: number = typeof b.time === 'number' ? b.time : Math.floor(new Date(b.time).getTime() / 1000);
          return tempsSec === targetTimeVal;
        });

        // 2. Si non trouvé exactement (ex: trade pris en cours de bougie H1 ou M15),
        // on cherche la dernière bougie dont le timestamp est <= targetTimeVal
        if (indexTrouve === -1) {
          for (let i = bougiesAgregees.length - 1; i >= 0; i--) {
            const rawTime = bougiesAgregees[i].time;
            const tempsSec: number = typeof rawTime === 'number'
              ? rawTime
              : Math.floor(new Date(rawTime).getTime() / 1000);
            if (tempsSec <= targetTimeVal) {
              indexTrouve = i;
              break;
            }
          }
        }

        if (indexTrouve >= 0 && indexTrouve < bougiesAgregees.length) {
          // 👉 POSITION EXACTE : la bougie courante est PRÉCISÉMENT la bougie d'entrée du trade
          const indexCible = indexTrouve;
          console.log(`🎯 [Replay Link] Replay positionné au moment EXACT de la prise de position (index ${indexCible}, bougie ${bougiesAgregees[indexCible].time})`);

          // 3. Si une position est fournie, on initialise directement l'objet position active pour l'afficher sur le graphique
          let positionActiveRestauree: PositionSimulee | null = null;
          if (targetPosition && targetPosition.prixEntree) {
            const bougieEntree = bougiesAgregees[indexCible];
            positionActiveRestauree = {
              direction: targetPosition.direction,
              prixEntree: targetPosition.prixEntree,
              stopLoss: targetPosition.stopLoss,
              takeProfit: targetPosition.takeProfit,
              dateEntree: bougieEntree.time,
              indexEntree: indexCible,
              dureeEstimeeLargeur: targetPosition.dureeEstimeeLargeur ?? 30,
              dureeEstimeeBougies: targetPosition.dureeEstimeeBougies ?? 12,
              dureeEstimeeHeures: targetPosition.dureeEstimeeHeures,
              tradeIdSupabase: targetPosition.tradeIdSupabase,
              estCloturee: false,
            };
            console.log(`📦 [Replay Link] Objet position restauré et affiché sur le graphique :`, positionActiveRestauree);
          }

          useBacktestStore.setState({
            indexCourant: indexCible,
            positionActive: positionActiveRestauree,
            historiqueSimule: [],
            estEnLecture: false,
          });

          // 4. Cadrage du graphique sur la bougie d'entrée avec du recul à gauche pour voir le setup
          setTimeout(() => {
            if (chartRef.current) {
              chartRef.current.cadrerSurIndex(indexCible, 50);
            }
          }, 200);
        } else {
          console.warn(`[Replay Link] Impossible de trouver la bougie pour le timestamp ${targetTimestamp}`);
        }
      }

      addToast(`${paireSel.toUpperCase()} (${anneeSel}) — Données chargées et agrégées en ${activeTf}`, 'success');
    } catch (err: any) {
      console.error(err);
      const estHorsLigne = typeof navigator !== 'undefined' && !navigator.onLine;
      const messageErreur = estHorsLigne
        ? `Mode Hors-ligne : L'historique pour ${paireSel.toUpperCase()} (${anneeSel}) n'a pas encore été téléchargé sur cet appareil.`
        : (err.message || "Erreur lors du chargement des données.");
      
      setErreur(messageErreur);
      addToast(messageErreur, "error");
    } finally {
      setChargement(false);
    }
  };


  // ─── Défilement Infini : Chargement automatique de l'année précédente ──────
  const chargerAnneePrecedenteCloud = useCallback(async () => {
    if (isFetchingPrevYear.current || anneeMinimumChargee <= 2000 || donneesM1Chargees.length === 0) return;
    
    isFetchingPrevYear.current = true;
    const anneePrecedente = anneeMinimumChargee - 1;
    const paireActive = paireCloud.toUpperCase();
    const nomFichier = `${paireActive}_M1_${anneePrecedente}.csv.gz`;

    console.log(`☁️ [Cloud Loader] Chargement de l'année ${anneePrecedente} depuis le Cloud...`);
    
    try {
      const reponse = await telechargerFichierCloud(nomFichier);
      const texteCsv = await decompresserGzipEnTexte(reponse);
      const anciennesBougiesM1 = parserCsvPrix(texteCsv);

      const nouvellesBougiesM1 = [...anciennesBougiesM1, ...donneesM1Chargees];
      setDonneesM1Chargees(nouvellesBougiesM1);
      setDonneesM1(nouvellesBougiesM1);
      setAnneeMinimumChargee(anneePrecedente);

      const anciennesBougiesAgregees = agregerBougies(anciennesBougiesM1, timeframe);
      
      const injecterDonneesPrecedentes = useBacktestStore.getState().injecterDonneesPrecedentes;
      injecterDonneesPrecedentes(anciennesBougiesAgregees);

      console.log(`✅ [Cloud Loader] Année ${anneePrecedente} fusionnée avec succès (${anciennesBougiesAgregees.length} nouvelles bougies en ${timeframe})`);
    } catch (err: any) {
      console.error(`[Cloud Loader] Erreur lors du chargement de l'année ${anneePrecedente}:`, err);
    } finally {
      isFetchingPrevYear.current = false;
    }
  }, [anneeMinimumChargee, paireCloud, donneesM1Chargees, timeframe, addToast]);

  // ─── Export d'un trade simulé vers le formulaire du Journal ─────────────────
  const exporterVersJournal = async (trade: PositionSimulee) => {
    const tradeUid = `${trade.dateEntree}-${trade.prixEntree}`;
    console.log('🚀 [Backtest] Début de l\'exportation du trade vers le journal :', journalDest);
    setExportantTradeId(tradeUid);

    let imageUrlPublic = '';
    try {
      if (chartRef.current) {
        const blob = await chartRef.current.takeScreenshot();
        if (blob) {
          console.log('📡 [Backtest] Conversion de la capture en Base64 locale...');
          imageUrlPublic = await compresserEtConvertirEnBase64(blob);
          console.log('✅ [Backtest] Capture d\'écran convertie !');
        }
      }
    } catch (err) {
      console.error('❌ [Backtest] Échec de la génération de la capture Base64 :', err);
      addToast('Impossible de générer la capture du graphique. Le trade sera pré-rempli sans image.', 'info');
    } finally {
      setExportantTradeId(null);
    }

    const dateTexte = typeof trade.dateEntree === 'number'
      ? new Date(trade.dateEntree * 1000).toISOString().split('T')[0]
      : String(trade.dateEntree).split('T')[0];

    const gain = Math.abs(trade.takeProfit - trade.prixEntree);
    const risque = Math.abs(trade.prixEntree - trade.stopLoss);
    const rr = risque > 0 ? (gain / risque).toFixed(2) : '1.00';
    const rrRealise = trade.resultat === 'win' ? rr : trade.resultat === 'loss' ? '-1.00' : '0';

    // Prépare l'image avec un ID unique pour le pré-remplissage
    const imageElement = imageUrlPublic ? {
      id: crypto.randomUUID(),
      url: imageUrlPublic,
      source: 'upload' as const,
      phase: 'avant' as const,
      storage_path: 'local_pending'
    } : null;

    // Prépare l'objet de pré-remplissage selon le type de journal
    const localPrefill: any = {
      pair: actif !== 'Aucun actif' && actif ? actif : paireCloud,
      direction: trade.direction,
      date_backtested: dateTexte,
      result: trade.resultat,
      journal_type: journalDest,
      duree_estimee_heures: trade.dureeEstimeeHeures !== undefined && trade.dureeEstimeeHeures !== null ? String(trade.dureeEstimeeHeures) : '',
      duree_estimee_bougies: trade.dureeEstimeeBougies !== undefined && trade.dureeEstimeeBougies !== null ? String(trade.dureeEstimeeBougies) : '',
      duree_reelle_bougies: trade.dureeReelleBougies !== undefined && trade.dureeReelleBougies !== null ? String(trade.dureeReelleBougies) : '',
    };

    // Adapte la configuration de l'export en fonction du journal sélectionné
    if (journalDest === 'global') {
      localPrefill.entry_price = trade.prixEntree.toFixed(5);
      localPrefill.entry_sl = trade.stopLoss.toFixed(5);
      localPrefill.entry_tp = trade.takeProfit.toFixed(5);
      localPrefill.rr_planned = rr;
      localPrefill.rr_realized = rrRealise;
      localPrefill.exit_type = trade.resultat === 'win' ? 'tp' : trade.resultat === 'loss' ? 'sl' : 'breakeven';
      localPrefill.entry_images = imageElement ? [imageElement] : [];
    } else if (journalDest === 'bias') {
      localPrefill.biais_timeframe = mapperTimeframe(timeframe);
      localPrefill.biais_direction = trade.direction === 'long' ? 'Haussier' : 'Baissier';
      localPrefill.biais_images = imageElement ? [imageElement] : [];
    } else if (journalDest === 'poi') {
      localPrefill.poi_timeframe = mapperTimeframe(timeframe);
      localPrefill.poi_images = imageElement ? [imageElement] : [];
      // On pré-remplit également les prix pour faciliter la saisie
      localPrefill.entry_price = trade.prixEntree.toFixed(5);
      localPrefill.entry_sl = trade.stopLoss.toFixed(5);
      localPrefill.entry_tp = trade.takeProfit.toFixed(5);
    } else if (journalDest === 'confirmation') {
      localPrefill.entry_timeframe = mapperTimeframe(timeframe);
      localPrefill.entry_price = trade.prixEntree.toFixed(5);
      localPrefill.entry_sl = trade.stopLoss.toFixed(5);
      localPrefill.entry_tp = trade.takeProfit.toFixed(5);
      localPrefill.rr_planned = rr;
      localPrefill.rr_realized = rrRealise;
      localPrefill.exit_type = trade.resultat === 'win' ? 'tp' : trade.resultat === 'loss' ? 'sl' : 'breakeven';
      localPrefill.entry_images = imageElement ? [imageElement] : [];
    }

    console.log('📡 [Backtest] Pré-remplissage du formulaire avec :', localPrefill);
    openNewTradeWithPrefill(localPrefill);
    addToast(`Formulaire du journal (${journalDest}) pré-rempli avec succès !`, 'success');
  };

  // ─── Capture manuelle à la volée ─────────────────────────────────────────────
  // Permet à l'utilisateur de prendre une capture d'écran du graphique à tout moment
  // et de l'associer directement à la bonne section (Biais, POI ou Entrée).
  // Cela permet par exemple d'enregistrer des analyses de Biais HTF au tout début du trade.
  const effectuerCaptureManuelle = async (cible: 'biais' | 'poi' | 'entry_avant' | 'entry_apres') => {
    console.log('🚀 [Workspace] ① effectuerCaptureManuelle démarrée, cible =', cible);
    setMenuCaptureOuvert(false);
    setCapturantManuel(true);

    let imageUrlPublic = '';
    try {
      console.log('🚀 [Workspace] ② chartRef.current =', chartRef.current ? 'OK' : 'NULL ❌');
      if (chartRef.current) {
        console.log('🚀 [Workspace] ③ Appel takeScreenshot()...');
        const blob = await chartRef.current.takeScreenshot();
        console.log('🚀 [Workspace] ④ blob =', blob ? `OK (${blob.size} octets)` : 'NULL ❌');
        if (blob) {
          console.log('🚀 [Workspace] ⑤ Conversion en Base64 local...');
          imageUrlPublic = await compresserEtConvertirEnBase64(blob);
          console.log('🚀 [Workspace] ⑥ Capture d\'écran convertie !');
        } else {
          console.warn('⚠️ [Workspace] blob null → on continue SANS image');
        }
      } else {
        console.warn('⚠️ [Workspace] chartRef.current NULL → pas de capture');
      }
    } catch (err) {
      console.error('❌ [Backtest] Échec de la capture manuelle Base64 :', err);
      addToast('Impossible de générer la capture.', 'error');
      setCapturantManuel(false);
      return;
    }

    setCapturantManuel(false);
    console.log('🚀 [Workspace] ⑨ Construction du prefillData...');

    // Initialisation du formulaire pré-rempli avec les champs de base requis
    const localPrefill: any = {
      pair: actif !== 'Aucun actif' ? actif : paireCloud,
      date_backtested: new Date().toISOString().split('T')[0],
      journal_type: 'global',
    };

    // Si une position est actuellement ouverte ou tracée, on l'utilise pour pré-remplir la direction et les prix
    if (positionActive) {
      localPrefill.direction = positionActive.direction;
      localPrefill.entry_price = positionActive.prixEntree.toFixed(5);
      localPrefill.entry_sl = positionActive.stopLoss.toFixed(5);
      localPrefill.entry_tp = positionActive.takeProfit.toFixed(5);
      
      const gain = Math.abs(positionActive.takeProfit - positionActive.prixEntree);
      const risque = Math.abs(positionActive.prixEntree - positionActive.stopLoss);
      localPrefill.rr_planned = risque > 0 ? (gain / risque).toFixed(2) : '1.00';
    }

    // Objet image conforme aux schémas d'images d'étapes
    const imageElement = {
      id: crypto.randomUUID(),
      url: imageUrlPublic,
      source: 'upload' as const,
      phase: (cible === 'entry_apres' ? 'apres' as const : 'avant' as const),
      storage_path: 'local_pending'
    };

    // Selon la cible choisie, on injecte l'image dans le bon tableau et configure le type de journal
    if (cible === 'biais') {
      localPrefill.journal_type = 'bias';
      localPrefill.biais_images = [imageElement];
    } else if (cible === 'poi') {
      localPrefill.journal_type = 'poi';
      localPrefill.poi_images = [imageElement];
    } else if (cible === 'entry_avant') {
      localPrefill.journal_type = 'confirmation';
      localPrefill.entry_images = [imageElement];
    } else if (cible === 'entry_apres') {
      localPrefill.journal_type = 'global';
      localPrefill.entry_images = [imageElement];
      if (positionActive?.prixSortie) {
        localPrefill.result = positionActive.resultat;
      }
    }

    console.log('🚀 [Workspace] ⑩ prefillData :', localPrefill);
    console.log('🚀 [Workspace] ⑪ Appel openNewTradeWithPrefill...');
    openNewTradeWithPrefill(localPrefill);
    console.log('🚀 [Workspace] ⑫ TERMINÉ ✅');
    addToast('Capture d\'écran chargée ! Complète les détails du trade.', 'success');
  };

  // ─── Calcul du PnL flottant de la position active ────────────────────────────
  const prixActuel = donneesCompletes[indexCourant]?.close ?? 0;
  const pnlFlottant = positionActive
    ? positionActive.direction === 'long'
      ? ((prixActuel - positionActive.prixEntree) / positionActive.prixEntree) * 100
      : ((positionActive.prixEntree - prixActuel) / positionActive.prixEntree) * 100
    : null;

  // ─── Winrate de la session ────────────────────────────────────────────────────
  const wins = historiqueSimule.filter((t) => t.resultat === 'win').length;
  const winrate = historiqueSimule.length > 0 ? Math.round((wins / historiqueSimule.length) * 100) : 0;

  // ─── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <div className={`flex flex-col overflow-hidden transition-colors duration-200 ${C.bgWorkspace}
      ${estPleinEcran ? 'fixed inset-0 z-[200] w-screen h-screen' : 'flex-1'}`}
    >

      {/* ══════════════════════════════════════════════════════════ */}
      {/* BARRE SUPÉRIEURE — Masquée en Mode Plein Écran Total      */}
      {/* ══════════════════════════════════════════════════════════ */}
      {!estPleinEcran && (
        <div className={`flex items-center gap-2 px-4 h-12 border-b flex-shrink-0 overflow-x-auto whitespace-nowrap scrollbar-none ${C.bgHeader}`}>



        {/* Sélection du journal de destination */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`text-[11px] ${C.textMuted}`}>Journal :</span>
          <select
            value={journalDest}
            onChange={(e) => setJournalDest(e.target.value as any)}
            className={`border-0 rounded px-2 py-1 text-[12px] font-semibold outline-none focus:ring-1 focus:ring-[#2962ff] cursor-pointer ${C.select}`}
            title="Journal de trading de destination"
          >
            <option value="global">📋 Global</option>
            <option value="bias">🎯 Biais</option>
            <option value="poi">🗺️ POI</option>
            <option value="confirmation">⚡ Confirmation</option>
          </select>
        </div>

        {/* Import CSV multi-fichiers */}
        <input type="file" accept=".csv,.gz" multiple ref={fileInputRef} onChange={gererCsv} className="hidden" />
        <button
          onClick={() => fileInputRef.current?.click()}
          className={`flex-shrink-0 px-3 py-1 text-[12px] font-medium rounded transition-colors flex items-center gap-1.5 ${C.btnBase}`}
        >
          📁 CSV
        </button>
 
        <div className={`flex-shrink-0 h-5 w-px ${C.separator}`} />
 
        {/* Import Cloud (GitHub CDN) */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <select
            value={paireCloud}
            onChange={(e) => setPaireCloud(e.target.value)}
            className={`border-0 rounded px-1.5 py-1 text-[12px] font-semibold outline-none focus:ring-1 focus:ring-[#2962ff] cursor-pointer ${C.select}`}
            title="Sélectionner l'actif Forex à charger depuis le Cloud"
          >
            {['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'USDCHF', 'NZDUSD', 'GBPJPY', 'EURJPY', 'EURGBP', 'AUDJPY', 'GBPAUD', 'EURAUD', 'EURCAD', 'AUDNZD', 'CADJPY', 'CHFJPY'].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
 
          <select
            value={anneeCloud}
            onChange={(e) => setAnneeCloud(e.target.value)}
            className={`border-0 rounded px-1.5 py-1 text-[12px] font-semibold outline-none focus:ring-1 focus:ring-[#2962ff] cursor-pointer ${C.select}`}
            title="Sélectionner l'année de l'historique M1"
          >
            {Array.from({ length: 26 }, (_, i) => String(2025 - i)).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
 
          <button
            onClick={() => chargerDonneesCloud(paireCloud, anneeCloud)}
            disabled={chargement}
            className={`flex-shrink-0 px-2.5 py-1 text-[12px] font-semibold rounded disabled:opacity-50 transition-colors flex items-center gap-1.5 ${C.btnBase}`}
            title="Charger l'historique M1 depuis ton dépôt GitHub public"
          >
            {chargement ? '⌛' : '☁️ Cloud'}
          </button>
        </div>
 
        <div className="hidden md:block flex-1" />

        {/* Infos bougie courante */}
        {donneesCompletes.length > 0 && (
          <div className={`text-[12px] font-mono flex-shrink-0 whitespace-nowrap ${C.textMuted}`}>
            <span className={`font-semibold hidden sm:inline ${C.textNormal}`}>{actif}</span>
            <span className="sm:ml-2">Bougie {indexCourant + 1}/{donneesCompletes.length}</span>
          </div>
        )}

        <div className={`flex-shrink-0 h-5 w-px ${C.separator}`} />

        {/* Sélecteur de vitesse de replay remis dans le header */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`text-[11px] ${C.textMuted}`}>Vitesse :</span>
          <select
            value={vitesseLecture}
            onChange={(e) => setVitesseLecture(Number(e.target.value))}
            className={`border-0 rounded px-2 py-1 text-[12px] outline-none cursor-pointer w-20 ${C.select}`}
          >
            <option value="2000">×0.5</option>
            <option value="1000">×1</option>
            <option value="500">×2</option>
            <option value="200">×5</option>
            <option value="100">×10</option>
          </select>
        </div>

        <div className={`flex-shrink-0 h-5 w-px ${C.separator}`} />

        {/* ── Bouton Capture d'Écran Manuel ── */}
        <div ref={menuRef} className="relative flex-shrink-0">
          <button
            ref={boutonRef}
            onClick={(evenement) => {
              evenement.stopPropagation();
              const rect = boutonRef.current?.getBoundingClientRect();
              if (rect) {
                setPositionMenu({
                  top: rect.bottom + window.scrollY + 6,
                  right: window.innerWidth - rect.right - window.scrollX,
                });
              }
              setMenuCaptureOuvert(!menuCaptureOuvert);
            }}
            disabled={capturantManuel}
            title="Prendre une capture d'écran du graphique"
            className={`w-8 h-8 flex items-center justify-center rounded transition-colors text-base relative ${C.btnBase} ${menuCaptureOuvert ? 'bg-[#2a2e39] text-[#2962ff]' : ''}`}
          >
            {capturantManuel ? (
              <span className="w-4 h-4 border-2 border-[#2962ff]/20 border-t-[#2962ff] rounded-full animate-spin"></span>
            ) : (
              '📸'
            )}
          </button>

          {menuCaptureOuvert && (
            <div 
              style={{
                position: 'fixed',
                top: positionMenu?.top ?? 0,
                right: positionMenu?.right ?? 0,
              }}
              className={`w-52 rounded-lg border shadow-xl z-[999] py-1.5 text-xs font-medium flex flex-col transition-all animate-fadeIn
                ${theme === 'dark' ? 'bg-[#1e222d] border-[#2a2e39] text-[#d1d4dc]' : 'bg-white border-[#e0e3eb] text-[#131722]'}`}
            >
              <div className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border-b ${theme === 'dark' ? 'text-[#787b86] border-[#2a2e39]' : 'text-[#9598a1] border-[#e0e3eb]'}`}>
                Où envoyer la capture ?
              </div>
              <button
                onClick={() => effectuerCaptureManuelle('biais')}
                className={`px-3 py-2 text-left transition-colors flex items-center gap-2 ${theme === 'dark' ? 'hover:bg-[#2a2e39]' : 'hover:bg-[#f0f3fa]'}`}
              >
                <span className="text-[14px]">🧭</span> Biais de Marché (Avant)
              </button>
              <button
                onClick={() => effectuerCaptureManuelle('poi')}
                className={`px-3 py-2 text-left transition-colors flex items-center gap-2 ${theme === 'dark' ? 'hover:bg-[#2a2e39]' : 'hover:bg-[#f0f3fa]'}`}
              >
                <span className="text-[14px]">🎯</span> Zone d'Intérêt POI (Avant)
              </button>
              <button
                onClick={() => effectuerCaptureManuelle('entry_avant')}
                className={`px-3 py-2 text-left transition-colors flex items-center gap-2 ${theme === 'dark' ? 'hover:bg-[#2a2e39]' : 'hover:bg-[#f0f3fa]'}`}
              >
                <span className="text-[14px]">⚡</span> Prise de Position (Avant)
              </button>
              <button
                onClick={() => effectuerCaptureManuelle('entry_apres')}
                className={`px-3 py-2 text-left transition-colors flex items-center gap-2 border-t ${theme === 'dark' ? 'hover:bg-[#2a2e39] border-[#2a2e39]' : 'hover:bg-[#f0f3fa] border-[#e0e3eb]'}`}
              >
                <span className="text-[14px]">🔴</span> Résultat / Sortie (Après)
              </button>
            </div>
          )}
        </div>

        {/* Bouton de clôture manuelle contextuel de la position active */}
        {positionActive && (
          <>
            <div className={`flex-shrink-0 h-5 w-px ${C.separator}`} />
            <button
              onClick={fermerPositionManuellement}
              className="flex-shrink-0 px-3 h-8 bg-[#ef5350] hover:bg-[#e53935] text-white text-[11px] font-bold rounded shadow-sm transition-colors flex items-center gap-1.5"
              title="Clôturer manuellement la position active"
            >
              🔒 Clôturer ({pnlFlottant !== null ? `${pnlFlottant >= 0 ? '+' : ''}${pnlFlottant.toFixed(2)}%` : 'Active'})
            </button>

            {/* Bouton manuel d'écriture du trade (au choix de l'utilisateur) */}
            {!positionActive.estCloturee ? (
              <button
                onClick={() => initialiserPlanificationTrade(positionActive)}
                disabled={initialisantPlanification}
                className="flex-shrink-0 px-3 h-8 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-[11px] font-bold rounded shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
                title="Pré-remplir et ouvrir le journal pour planifier ce trade"
              >
                {initialisantPlanification ? (
                  <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                ) : (
                  '📝 Planifier'
                )}
              </button>
            ) : (
              <button
                onClick={() => initialiserResolutionTrade(positionActive)}
                disabled={initialisantResolution}
                className="flex-shrink-0 px-3 h-8 bg-[#10b981] hover:bg-[#059669] text-white text-[11px] font-bold rounded shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
                title="Pré-remplir et ouvrir le journal pour enregistrer le résultat"
              >
                {initialisantResolution ? (
                  <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                ) : (
                  '📝 Enregistrer'
                )}
              </button>
            )}
          </>
        )}


        <div className={`flex-shrink-0 h-5 w-px ${C.separator}`} />

        {/* ── Toggle Mode Fondamental ── */}
        <button
          onClick={toggleFundamentalMode}
          className={`flex-shrink-0 px-2.5 py-1 text-[12px] font-semibold rounded transition-all flex items-center gap-1.5 border ${
            fundamentalModeEnabled
              ? 'bg-purple-950/80 border-purple-600 text-purple-200 shadow-sm'
              : C.btnBase
          }`}
          title="Activer/Désactiver l'Analyse Fondamentale"
        >
          <span className={fundamentalModeEnabled ? 'text-purple-400 font-bold' : 'text-slate-400'}>🌐 Macro</span>
          <span className={`text-[10px] px-1 rounded font-bold ${fundamentalModeEnabled ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
            {fundamentalModeEnabled ? 'ON' : 'OFF'}
          </span>
        </button>

        {fundamentalModeEnabled && (
          <button
            onClick={() => setShowMacroUploaderModal(true)}
            className="flex-shrink-0 px-2.5 py-1 text-[11px] font-medium rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center gap-1"
            title="Gérer ou importer les fichiers CSV d'événements économiques"
          >
            📊 CSV ({macroEvents.length})
          </button>
        )}

        {/* ── Toggle Mode Studio IA ── */}
        <button
          onClick={() => {
            const nouveauMode = !modeStudioIA;
            setModeStudioIA(nouveauMode);
            if (nouveauMode && chartRef.current) {
              chartRef.current.cadrerFenetreBougies(nbBougiesIA);
            }
          }}
          className={`flex-shrink-0 px-2.5 py-1 text-[12px] font-semibold rounded transition-all flex items-center gap-1.5 border ${
            modeStudioIA
              ? 'bg-indigo-950/80 border-indigo-500 text-indigo-200 shadow-sm'
              : C.btnBase
          }`}
          title="Activer la barre d'outils de collecte de données et captures pour l'IA"
        >
          <span className={modeStudioIA ? 'text-indigo-400 font-bold' : 'text-slate-400'}>🤖 Mode IA</span>
          {nbEchantillonsIA > 0 && (
            <span className={`text-[10px] px-1 rounded font-bold font-mono ${modeStudioIA ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
              {nbEchantillonsIA}
            </span>
          )}
        </button>

        {/* ── Bouton Modal Gestionnaire d'Indicateurs & Télémétrie (Style TradingView) ── */}
        <button
          onClick={() => setModalIndicateursOuvert(true)}
          className={`flex-shrink-0 px-2.5 py-1 text-[12px] font-semibold rounded transition-all flex items-center gap-1.5 border ${
            nbIndicateursActifs > 0
              ? 'bg-sky-950/80 border-sky-500 text-sky-200 shadow-sm'
              : C.btnBase
          }`}
          title="Ouvrir le gestionnaire d'indicateurs graphiques et la configuration de télémétrie"
        >
          <span className="flex items-center justify-center w-4 h-4 text-[10px] font-bold text-sky-400 bg-sky-900/60 rounded border border-sky-500/40">
            fx
          </span>
          <span className={nbIndicateursActifs > 0 ? 'text-sky-300 font-bold' : 'text-slate-400'}>
            Indicateurs
          </span>
          {nbIndicateursActifs > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold font-mono bg-sky-600 text-white">
              {nbIndicateursActifs}
            </span>
          )}
        </button>

        {/* ── Bouton Modal Gestionnaire de Bots Automatisés ── */}
        <button
          onClick={() => setModalBotOuverte(true)}
          className={`flex-shrink-0 px-2.5 py-1 text-[12px] font-semibold rounded transition-all flex items-center gap-1.5 border ${
            botReplayActif
              ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200 shadow-sm animate-pulse'
              : C.btnBase
          }`}
          title="Ouvrir le studio de bots de trading automatisés (extensions sans recompilation)"
        >
          <span>🤖</span>
          <span className={botReplayActif ? 'text-emerald-300 font-bold' : 'text-slate-400'}>
            Bots {botReplayActif ? `(${botReplayActif.nom.slice(0, 10)}...)` : ''}
          </span>
          {botReplayActif && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                setBotReplayActif(null);
                addToast('Replay visuel du bot arrêté.', 'info');
              }}
              className="ml-1 text-[10px] text-rose-400 hover:text-rose-200 px-1 rounded hover:bg-rose-950/50"
              title="Arrêter le bot"
            >
              ✕
            </span>
          )}
        </button>

        <div className={`flex-shrink-0 h-5 w-px ${C.separator}`} />

        {/* ── Bouton Thème (Clair / Sombre) ── */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title={theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre'}
          className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded transition-colors text-base ${C.btnBase}`}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>

        {/* ── Bouton Plein Écran ── */}
        <button
          onClick={basculerPleinEcran}
          title={estPleinEcran ? 'Quitter le plein écran (Esc)' : 'Plein écran'}
          className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded transition-colors text-base ${C.btnBase}`}
        >
          {estPleinEcran ? '⊡' : '⊞'}
        </button>
      </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* BANDEAU ET ACCORDÉONS ANALYSE FONDAMENTALE (MODE SPLIT)     */}
      {/* ══════════════════════════════════════════════════════════ */}
      {!estPleinEcran && fundamentalModeEnabled && (
        <div className="flex flex-col gap-2 p-2 bg-[#131722]/95 border-b border-[#2a2e39] flex-shrink-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <FundamentalHeaderBadge snapshot={activeSnapshot} />

            <button
              onClick={() => setShowMacroUploaderModal(true)}
              className="px-2.5 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors flex items-center gap-1"
            >
              📥 Importer Données CSV
            </button>
          </div>

          {activeSnapshot && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto scrollbar-thin">
              <MacroAccordionTable state={activeSnapshot.baseState} title={`Devise Base : ${activeSnapshot.baseAsset}`} defaultExpanded={true} />
              <MacroAccordionTable state={activeSnapshot.quoteState} title={`Devise Contrepartie : ${activeSnapshot.quoteAsset}`} defaultExpanded={true} />
            </div>
          )}
        </div>
      )}

      {/* Modale d'importation CSV Macro */}
      {showMacroUploaderModal && (
        <div className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <MacroCSVUploader onClose={() => setShowMacroUploaderModal(false)} />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* BANDEAU STUDIO COLLECTE IA (QUAND LE MODE IA EST ACTIF)  */}
      {/* ══════════════════════════════════════════════════════════ */}
      {!estPleinEcran && modeStudioIA && (
        <div className="flex items-center justify-between gap-3 px-4 py-2 bg-indigo-950/40 border-b border-indigo-500/30 flex-shrink-0 overflow-x-auto text-xs">
          <div className="flex items-center gap-3">
            <span className="font-bold text-indigo-400 flex items-center gap-1.5 whitespace-nowrap">
              <span className="text-base">🤖</span>
              <span>Studio IA :</span>
            </span>

            {/* Sélecteur de cadrage standardisé enrichi avec grandes options */}
            <div className="flex items-center gap-1.5 bg-[#131722]/90 p-1 rounded-lg border border-indigo-500/30">
              <span className="text-[11px] text-indigo-300 font-medium px-1 flex items-center gap-1">
                <span>📐</span> Cadrage :
              </span>

              {/* Boutons rapides pour les échelles les plus courantes */}
              <div className="flex items-center gap-1">
                {[60, 100, 150, 200, 300, 500].map((nb) => (
                  <button
                    key={nb}
                    onClick={() => {
                      setNbBougiesIA(nb);
                      setSaisieLibreBougies('');
                      chartRef.current?.cadrerFenetreBougies(nb);
                    }}
                    className={`px-1.5 py-0.5 rounded text-xs font-mono font-bold transition-all ${
                      nbBougiesIA === nb
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#2a2e39]'
                    }`}
                    title={`Cadrer exactement ${nb} bougies`}
                  >
                    {nb}b
                  </button>
                ))}
              </div>

              {/* Menu déroulant pour toutes les échelles (notamment les plus grandes) */}
              <select
                value={nbBougiesIA}
                onChange={(e) => {
                  const nb = Number(e.target.value);
                  setNbBougiesIA(nb);
                  setSaisieLibreBougies('');
                  chartRef.current?.cadrerFenetreBougies(nb);
                }}
                className="bg-[#1e222d] text-indigo-300 border border-indigo-500/40 rounded px-1.5 py-0.5 text-xs font-mono font-semibold outline-none cursor-pointer hover:border-indigo-400"
                title="Toutes les options de cadrage (précision ou grand contexte)"
              >
                <optgroup label="Zoom précision">
                  <option value={40}>40 bougies (Micro)</option>
                  <option value={60}>60 bougies (Court terme)</option>
                  <option value={80}>80 bougies (Standard)</option>
                </optgroup>
                <optgroup label="Contexte intermédiaire">
                  <option value={100}>100 bougies</option>
                  <option value={120}>120 bougies</option>
                  <option value={150}>150 bougies</option>
                  <option value={180}>180 bougies</option>
                  <option value={200}>200 bougies</option>
                </optgroup>
                <optgroup label="Grand Contexte (Macro / Structure)">
                  <option value={250}>250 bougies (Structure swing)</option>
                  <option value={300}>300 bougies (Session étendue)</option>
                  <option value={350}>350 bougies</option>
                  <option value={400}>400 bougies (Grand swing)</option>
                  <option value={500}>500 bougies (Multi-jours)</option>
                  <option value={600}>600 bougies</option>
                  <option value={800}>800 bougies (Vue globale)</option>
                  <option value={1000}>1000 bougies (Historique macro)</option>
                </optgroup>
              </select>

              {/* Champ de saisie manuelle libre */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const nb = Number(saisieLibreBougies);
                  if (nb >= 10 && nb <= 5000) {
                    setNbBougiesIA(nb);
                    chartRef.current?.cadrerFenetreBougies(nb);
                  }
                }}
                className="flex items-center gap-1 pl-1 border-l border-[#2a2e39]"
              >
                <input
                  type="number"
                  min="10"
                  max="5000"
                  placeholder="Autre..."
                  value={saisieLibreBougies}
                  onChange={(e) => setSaisieLibreBougies(e.target.value)}
                  onBlur={() => {
                    const nb = Number(saisieLibreBougies);
                    if (nb >= 10 && nb <= 5000) {
                      setNbBougiesIA(nb);
                      chartRef.current?.cadrerFenetreBougies(nb);
                    }
                  }}
                  className="w-16 bg-[#131722] text-white border border-[#2a2e39] focus:border-indigo-500 rounded px-1.5 py-0.5 text-xs font-mono outline-none"
                  title="Saisir un nombre exact de bougies (ex: 350, 750)"
                />
                <button
                  type="submit"
                  className="px-1.5 py-0.5 bg-indigo-700/60 hover:bg-indigo-600 text-white rounded text-[10px] font-bold transition-colors"
                  title="Appliquer ce nombre de bougies"
                >
                  OK
                </button>
              </form>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Bouton de capture positive */}
            <button
              onClick={() => capturerSetupIA('positif')}
              disabled={capturantIA}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow-md flex items-center gap-1.5 transition-all disabled:opacity-50 whitespace-nowrap"
              title="Capture le setup actuel (Clean + Annoté + Coordonnées YOLO)"
            >
              {capturantIA ? (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                '📸'
              )}
              <span>Capturer Setup (Positif)</span>
            </button>

            {/* Bouton de capture négative (faux signal) */}
            <button
              onClick={() => capturerSetupIA('negatif')}
              disabled={capturantIA}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-50 whitespace-nowrap"
              title="Capture la fenêtre actuelle comme échantillon négatif pour éviter les faux positifs"
            >
              <span>🚫</span>
              <span>Faux Signal (Négatif)</span>
            </button>

            {/* Bouton pour ouvrir la modale de gestion du Dataset */}
            <button
              onClick={() => setModalAIDatasetOuverte(true)}
              className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 font-semibold rounded-lg flex items-center gap-1.5 transition-all whitespace-nowrap"
              title="Voir les images collectées, vérifier les labels et exporter le dataset"
            >
              <span>📂</span>
              <span>Dataset ({nbEchantillonsIA})</span>
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* CORPS PRINCIPAL : Toolbar Gauche + Graphique + Panel Droit */}
      {/* ══════════════════════════════════════════════════════════ */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden relative">

        {/* ─── BARRE D'OUTILS DE TRACAGE — Masquée en Plein Écran Total ─── */}
        {!estPleinEcran && (
          <div className={`w-full md:w-14 h-10 md:h-auto flex flex-row md:flex-col items-center p-1 md:pt-2 gap-1 md:gap-0.5 border-b md:border-b-0 md:border-r flex-shrink-0 overflow-x-auto md:overflow-y-auto scrollbar-none ${C.bgSidebar}`}>
            {OUTILS_TRACAGE.map((groupe) => (
              <React.Fragment key={groupe.group}>
                {groupe.items.map((outil) => {
                  const estActif = outilActif === outil.id;
                  return (
                    <button
                      key={String(outil.id)}
                      onClick={() => setOutilActif(estActif ? null : outil.id)}
                      title={outil.title}
                      className={`w-9 md:w-12 h-7 md:h-9 flex flex-col items-center justify-center rounded text-[8.5px] md:text-[9px] font-bold tracking-tight transition-all leading-tight px-0.5 flex-shrink-0
                        ${estActif ? C.btnActive : C.btnBase}`}
                    >
                      {/* Icône SVG pour le curseur, texte pour les autres */}
                      {outil.label === 'CURSOR' ? (
                        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 md:w-4 md:h-4" fill="currentColor">
                          <path d="M2 1l12 6.5L9.5 9l-1 5.5L2 1z" />
                        </svg>
                      ) : (
                        <span className="text-[9px] md:text-[10px] font-bold">{outil.label}</span>
                      )}
                    </button>
                  );
                })}
                <div className={`w-px md:w-8 h-5 md:h-px mx-1 md:mx-0 my-0 md:my-1 flex-shrink-0 ${C.separator}`} />
              </React.Fragment>
            ))}
          </div>
        )}

        {/* ─── GRAPHIQUE PRINCIPAL (Prend 100% de l'espace) ─── */}
        <div className="flex-1 min-w-0 flex-shrink-0 relative w-full h-full">

          {/* En mode normal : WIDGET UT (Timeframe) flottant et déplaçable */}
          {!estPleinEcran && (
            <div
              style={
                hasDraggedUt
                  ? { position: 'absolute', left: `${utPos.x}px`, top: `${utPos.y}px`, zIndex: 35 }
                  : estMobile
                    ? { position: 'absolute', left: '10px', top: '10px', zIndex: 35 }
                    : { position: 'absolute', left: '80px', top: '20px', zIndex: 35 }
              }
              className={`flex items-center gap-1 p-1 md:p-1.5 rounded-lg border shadow-lg backdrop-blur-md select-none max-w-[calc(100vw-20px)] ${
                theme === 'dark' ? 'bg-[#1e222d]/85 border-[#2a2e39]/90' : 'bg-white/85 border-[#e0e3eb]/90'
              }`}
            >
              {/* Poignée de drag */}
              <div
                onMouseDown={handleDragStart}
                onTouchStart={handleDragStart}
                className={`cursor-grab active:cursor-grabbing px-1 text-xs select-none font-bold tracking-tight ${
                  theme === 'dark' ? 'text-[#787b86]' : 'text-[#9598a1]'
                }`}
                title="Maintenir pour déplacer le sélecteur d'UT"
              >
                ⋮⋮
              </div>
              
              {/* Boutons d'UT avec défilement horizontal fluide sur mobile */}
              <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-none py-0.5">
                {TIMEFRAMES.map((tf) => (
                  <button
                    key={tf.value}
                    onClick={() => setTimeframe(tf.value)}
                    className={`px-2 py-0.5 md:px-2.5 md:py-1 text-[10px] md:text-[11px] font-semibold rounded transition-colors whitespace-nowrap ${
                      timeframe === tf.value ? C.btnActive : C.btnBase
                    }`}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>

              {/* Bouton raccourci Plein Écran toujours à portée de main */}
              <div className="w-px h-4 bg-border2 mx-0.5" />
              <button
                onClick={basculerPleinEcran}
                className="px-2 py-0.5 md:px-2.5 md:py-1 text-[10px] md:text-[11px] font-bold rounded bg-accent/15 hover:bg-accent/25 text-accent flex items-center gap-1 transition-all whitespace-nowrap"
                title="Passer en mode Plein Écran immersif"
              >
                <span>⛶</span>
                <span className="hidden sm:inline">Plein Écran</span>
              </button>
            </div>
          )}

          {/* En mode normal : DOCK FLOATING DE REPLAY */}
          {!estPleinEcran && (
            <div
              style={
                hasDraggedReplay
                  ? { position: 'absolute', left: `${replayPos.x}px`, top: `${replayPos.y}px`, zIndex: 90 }
                  : estMobile
                    ? { position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)', zIndex: 90 }
                    : { position: 'absolute', right: '24px', bottom: '24px', zIndex: 90 }
              }
              className={`flex items-center gap-1 md:gap-1.5 p-1.5 md:p-2 rounded-xl border shadow-2xl backdrop-blur-md select-none ${
                theme === 'dark' ? 'bg-[#1e222d]/90 border-[#2a2e39]' : 'bg-white/90 border-[#e0e3eb]'
              }`}
            >
              {/* Poignée de drag */}
              <div
                onMouseDown={handleDragReplayStart}
                onTouchStart={handleDragReplayStart}
                className={`cursor-grab active:cursor-grabbing px-1.5 py-1 text-xs select-none font-bold tracking-tight ${
                  theme === 'dark' ? 'text-[#787b86]' : 'text-[#9598a1]'
                }`}
                title="Maintenir pour déplacer les contrôles de Replay"
              >
                ⋮⋮
              </div>

              {/* 🎯 Badge Trade Rejoué Lié à la Sonde */}
              {tradeActifReplay && (
                <div
                  onClick={() => setOutilActif(outilActif === 'setup-probe' ? null : 'setup-probe')}
                  className="cursor-pointer hidden sm:flex items-center gap-1.5 px-2 py-1 bg-amber-500/15 border border-amber-500/30 rounded-lg text-[11px] font-bold text-amber-300 hover:bg-amber-500/25 transition-colors"
                  title="Trade rejoué actif : Cliquez pour sonder sa bougie de sweep avec 🎯"
                >
                  <span>🎯</span>
                  <span className="truncate max-w-[110px]">{tradeActifReplay.titre || tradeActifReplay.pair}</span>
                  <span className="bg-amber-500 text-black px-1 rounded text-[10px] font-black">
                    {tradeActifReplay.noteQualite || 'A+'}
                  </span>
                </div>
              )}

              {/* Mode Replay / Découpe ✂️ */}
              <button
                onClick={() => setOutilActif(outilActif === 'replay-cut' ? null : 'replay-cut')}
                title="Mode Replay — Cliquer sur une bougie pour démarrer"
                className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-colors ${
                  outilActif === 'replay-cut' ? C.btnActive : C.btnBase
                }`}
              >
                ✂️
              </button>

              {/* 🎯 Outil Sondeur de Setup */}
              <button
                onClick={() => setOutilActif(outilActif === 'setup-probe' ? null : 'setup-probe')}
                title="Sonder Setup Wyckoff / Liquidation — 1 clic sur la bougie du Sweep"
                className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-colors ${
                  outilActif === 'setup-probe' ? 'bg-pink-600 text-white shadow' : C.btnBase
                }`}
              >
                🎯
              </button>

              {/* 🔍 Outil Diagnostic Setup (SMC & Sandbox) */}
              <button
                onClick={() => setOutilActif(outilActif === 'inspect-setup' ? null : 'inspect-setup')}
                title="Diagnostic Setup (SMC & Sandbox) 🔍 — Affiche et inspecte les S/R analysés, les scores et la sélection"
                className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-colors ${
                  outilActif === 'inspect-setup' ? 'bg-cyan-600 text-white shadow ring-2 ring-cyan-400/50' : C.btnBase
                }`}
              >
                🔍
              </button>

              {/* 🧪 Outil Banque de Setups & Synthèse */}
              <button
                onClick={() => useLaboratoireStore.getState().ouvrirBanque()}
                title="Banque de Setups & Rétro-Ingénierie Statistique"
                className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-colors ${C.btnBase}`}
              >
                🧪
              </button>

              <div className={`w-px h-5 ${C.separator}`} />

              {/* ⏪ Reculer/Bougie précédente */}
              <button
                onClick={() => reculerBougie()}
                title="Bougie précédente"
                className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-colors ${C.btnBase}`}
              >
                ⏪
              </button>

              {/* ▶ / ⏸ Play / Pause */}
              <button
                onClick={() => setEstEnLecture(!estEnLecture)}
                title={estEnLecture ? 'Pause (Espace)' : 'Lecture (Espace)'}
                className={`w-9 h-8 flex items-center justify-center rounded-lg text-sm font-bold transition-all ${
                  estEnLecture ? 'bg-[#ff9800] text-white hover:bg-[#f57c00]' : 'bg-[#26a69a] text-white hover:bg-[#00897b]'
                }`}
              >
                {estEnLecture ? '⏸' : '▶'}
              </button>

              {/* ⏩ Avancer / Bougie suivante */}
              <button
                onClick={() => {
                  setEstEnLecture(false);
                  avancerBougie();
                }}
                title="Bougie suivante (→)"
                className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-colors ${C.btnBase}`}
              >
                ⏩
              </button>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════ */}
          {/* CONTRÔLES EN MODE PLEIN ÉCRAN TOTAL                        */}
          {/* Layout : Haut-Gauche (paire+TF) | Haut-Droite (thème+quit) */}
          {/*          Bas-Gauche (outils)    | Bas-Droite (replay)       */}
          {/* ══════════════════════════════════════════════════════════ */}
          {estPleinEcran && (
            <>
              {/* 1️⃣ HAUT-GAUCHE : Badge paire + Timeframes */}
              <div className="absolute top-2.5 left-2.5 z-[110] flex items-center gap-1.5 p-1 rounded-xl bg-[#1e222d]/85 border border-[#2a2e39] backdrop-blur-md shadow-xl text-white select-none">
                {/* Badge Actif avec indicateur live */}
                <div className="flex items-center gap-1.5 px-2 py-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-bold text-xs tracking-wide">
                    {actif !== 'Aucun actif' && actif ? actif : paireCloud}
                  </span>
                </div>

                <div className="w-px h-3.5 bg-white/15" />

                {/* Timeframes : clic direct, pas de menu déroulant */}
                <div className="flex items-center gap-0.5">
                  {['1m', '5m', '15m', '1h', '4h', '1d'].map((tf) => (
                    <button
                      key={tf}
                      onClick={() => setTimeframe(tf)}
                      className={`px-1.5 py-0.5 rounded-md text-[10.5px] font-bold transition-all ${
                        timeframe === tf
                          ? 'bg-[#2962ff] text-white shadow'
                          : 'text-white/60 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2️⃣ HAUT-DROITE : Bouton trade + Thème + Quitter */}
              <div className="absolute top-2.5 right-2.5 z-[110] flex items-center gap-1.5 select-none">

                {/* Bouton Bots en mode plein écran */}
                <button
                  onClick={() => setModalBotOuverte(true)}
                  className={`flex items-center gap-1 px-2 h-7 rounded-xl backdrop-blur-md border text-xs font-bold shadow-xl transition-all active:scale-95 ${
                    botReplayActif
                      ? 'bg-emerald-600/90 text-white border-emerald-400/40 animate-pulse'
                      : 'bg-[#1e222d]/85 hover:bg-[#2a2e39] text-white border-[#2a2e39]'
                  }`}
                  title="Ouvrir le Studio de Bots"
                >
                  <span>🤖</span>
                  <span className="hidden sm:inline">{botReplayActif ? 'Bot Actif' : 'Bots'}</span>
                </button>

                {/* Bouton Planifier / Enregistrer — visible uniquement si une position est active */}
                {positionActive && (
                  !positionActive.estCloturee ? (
                    // Position ouverte → bouton Planifier
                    <button
                      onClick={() => initialiserPlanificationTrade(positionActive)}
                      disabled={initialisantPlanification}
                      className="flex items-center gap-1 px-2.5 h-7 rounded-xl bg-[#7c3aed]/90 hover:bg-[#6d28d9] backdrop-blur-md border border-[#7c3aed]/40 text-white text-[10px] font-bold shadow-xl transition-all active:scale-95 disabled:opacity-50"
                      title="Planifier ce trade dans le journal"
                    >
                      {initialisantPlanification ? (
                        <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : '📝'}
                      Planifier
                    </button>
                  ) : (
                    // Position clôturée → bouton Enregistrer
                    <button
                      onClick={() => initialiserResolutionTrade(positionActive)}
                      disabled={initialisantResolution}
                      className="flex items-center gap-1 px-2.5 h-7 rounded-xl bg-[#10b981]/90 hover:bg-[#059669] backdrop-blur-md border border-[#10b981]/40 text-white text-[10px] font-bold shadow-xl transition-all active:scale-95 disabled:opacity-50"
                      title="Enregistrer le résultat dans le journal"
                    >
                      {initialisantResolution ? (
                        <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : '📝'}
                      Enregistrer
                    </button>
                  )
                )}

                {/* Toggle thème clair/sombre */}
                <button
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  title={theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre'}
                  className="w-7 h-7 flex items-center justify-center rounded-xl bg-[#1e222d]/85 hover:bg-[#2a2e39] backdrop-blur-md border border-[#2a2e39] text-white text-xs shadow-xl transition-all active:scale-95"
                >
                  {theme === 'dark' ? '☀️' : '🌙'}
                </button>

                {/* Quitter le plein écran */}
                <button
                  onClick={basculerPleinEcran}
                  className="flex items-center justify-center w-7 h-7 rounded-xl bg-[#1e222d]/85 hover:bg-red-500/90 hover:border-red-500/40 backdrop-blur-md border border-[#2a2e39] text-white text-xs font-bold shadow-xl transition-all active:scale-95"
                  title="Quitter le mode plein écran (Esc)"
                >
                  ✕
                </button>
              </div>

              {/* 5️⃣ TRADE DRAWER EN PLEIN ÉCRAN */}
              {/* En mode fullscreen (z-[200]), le TradeDrawer doit être à z-[300] pour passer par-dessus */}
              {/* Sans ça, le drawer (z-[100]) resterait masqué par le conteneur plein écran */}
              {(isNewTradeOpen || initialisantPlanification || initialisantResolution) && (
                <div className="absolute inset-0 z-[300] flex">
                  {/* Overlay semi-transparent derrière le drawer */}
                  <div className="absolute inset-0 bg-black/60" />

                  {/* Le panneau du drawer à droite */}
                  <div className="absolute top-0 right-0 h-full w-full max-w-[420px] flex flex-col bg-surface border-l border-border shadow-2xl">
                    {initialisantPlanification || initialisantResolution ? (
                      // Spinner pendant la capture automatique du graphique
                      <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-3 text-center">
                        <span className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs font-semibold text-txt">
                          {initialisantPlanification
                            ? 'Planification : capture automatique du graphique...'
                            : 'Résolution : capture automatique de clôture...'}
                        </p>
                        <p className="text-[10px] text-txt3">Veuillez patienter pendant l'upload...</p>
                      </div>
                    ) : (
                      <TradeDrawer isInline={true} backtestMode={true} onCaptureGraphique={capturerGraphique} />
                    )}
                  </div>
                </div>
              )}

              {/* 3️⃣ BAS-GAUCHE : Barre horizontale d'outils de dessin (toujours visible) */}
              {/* Les outils sont en bas pour que le pouce les atteigne facilement sur mobile */}
              <div className="absolute bottom-2.5 left-2.5 z-[110] flex items-center gap-0.5 p-1 rounded-2xl bg-[#1e222d]/90 border border-[#2a2e39] backdrop-blur-md shadow-2xl select-none">
                {/* Curseur */}
                <button
                  onClick={() => setOutilActif(null)}
                  className={`w-8 h-8 flex items-center justify-center rounded-xl text-xs font-bold transition-colors ${
                    outilActif === null ? 'bg-[#2962ff] text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                  title="Curseur / Sélection"
                >
                  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor">
                    <path d="M2 1l12 6.5L9.5 9l-1 5.5L2 1z" />
                  </svg>
                </button>

                <div className="w-px h-4 bg-white/10 mx-0.5" />

                {/* Ligne de tendance */}
                <button
                  onClick={() => setOutilActif(outilActif === 'trend-line' ? null : 'trend-line')}
                  className={`w-8 h-8 flex items-center justify-center rounded-xl text-xs font-bold transition-colors ${
                    outilActif === 'trend-line' ? 'bg-[#2962ff] text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                  title="Ligne de tendance ╱"
                >
                  ╱
                </button>

                {/* Ligne horizontale */}
                <button
                  onClick={() => setOutilActif(outilActif === 'horizontal-line' ? null : 'horizontal-line')}
                  className={`w-8 h-8 flex items-center justify-center rounded-xl text-xs font-bold transition-colors ${
                    outilActif === 'horizontal-line' ? 'bg-[#2962ff] text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                  title="Ligne horizontale ―"
                >
                  ―
                </button>

                {/* Rectangle / Zone POI */}
                <button
                  onClick={() => setOutilActif(outilActif === 'rectangle' ? null : 'rectangle')}
                  className={`w-8 h-8 flex items-center justify-center rounded-xl text-xs font-bold transition-colors ${
                    outilActif === 'rectangle' ? 'bg-[#2962ff] text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                  title="Zone POI / Rectangle ▭"
                >
                  ▭
                </button>

                {/* Retracement Fibonacci */}
                <button
                  onClick={() => setOutilActif(outilActif === 'fib-retracement' ? null : 'fib-retracement')}
                  className={`w-8 h-8 flex items-center justify-center rounded-xl text-xs font-bold transition-colors ${
                    outilActif === 'fib-retracement' ? 'bg-[#2962ff] text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                  title="Retracement Fibonacci ≡"
                >
                  ≡
                </button>

                {/* Annotation Texte */}
                <button
                  onClick={() => setOutilActif(outilActif === 'text-annotation' ? null : 'text-annotation')}
                  className={`w-8 h-8 flex items-center justify-center rounded-xl text-xs font-bold transition-colors ${
                    outilActif === 'text-annotation' ? 'bg-[#2962ff] text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                  title="Annotation Texte T"
                >
                  T
                </button>

                <div className="w-px h-4 bg-white/10 mx-0.5" />

                {/* Position Long */}
                <button
                  onClick={() => setOutilActif(outilActif === 'pos-long' ? null : 'pos-long')}
                  className={`w-8 h-8 flex items-center justify-center rounded-xl text-xs font-bold transition-colors ${
                    outilActif === 'pos-long' ? 'bg-emerald-500 text-white' : 'text-emerald-400 hover:bg-white/10'
                  }`}
                  title="Position Long ▲"
                >
                  ▲
                </button>

                {/* Position Short */}
                <button
                  onClick={() => setOutilActif(outilActif === 'pos-short' ? null : 'pos-short')}
                  className={`w-8 h-8 flex items-center justify-center rounded-xl text-xs font-bold transition-colors ${
                    outilActif === 'pos-short' ? 'bg-rose-500 text-white' : 'text-rose-400 hover:bg-white/10'
                  }`}
                  title="Position Short ▼"
                >
                  ▼
                </button>
              </div>

              {/* 4️⃣ BAS-DROITE : Mini barre de Replay (toujours visible, pas de toggle) */}
              <div className="absolute bottom-2.5 right-2.5 z-[110] flex items-center gap-1 p-1 rounded-2xl bg-[#1e222d]/90 border border-[#2a2e39] backdrop-blur-md shadow-2xl select-none">
                {/* Découpe Replay — positionner le début du replay sur une bougie */}
                <button
                  onClick={() => setOutilActif(outilActif === 'replay-cut' ? null : 'replay-cut')}
                  className={`w-7 h-7 flex items-center justify-center rounded-xl text-xs transition-colors ${
                    outilActif === 'replay-cut' ? 'bg-amber-500 text-white shadow' : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                  title="Découpe Replay ✂️"
                >
                  ✂️
                </button>

                {/* 🎯 Outil Sondeur de Setup */}
                <button
                  onClick={() => setOutilActif(outilActif === 'setup-probe' ? null : 'setup-probe')}
                  className={`w-7 h-7 flex items-center justify-center rounded-xl text-xs transition-colors ${
                    outilActif === 'setup-probe' ? 'bg-pink-600 text-white shadow' : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                  title="Sonder Setup Wyckoff / Liquidation 🎯"
                >
                  🎯
                </button>

                {/* 🔍 Outil Diagnostic Setup (SMC & Sandbox) */}
                <button
                  onClick={() => setOutilActif(outilActif === 'inspect-setup' ? null : 'inspect-setup')}
                  className={`w-7 h-7 flex items-center justify-center rounded-xl text-xs transition-colors ${
                    outilActif === 'inspect-setup' ? 'bg-cyan-600 text-white shadow ring-2 ring-cyan-400/50' : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                  title="Diagnostic Setup (SMC & Sandbox) 🔍 — Affiche et inspecte les S/R analysés, les scores et la sélection"
                >
                  🔍
                </button>

                {/* 🧪 Outil Banque de Setups */}
                <button
                  onClick={() => useLaboratoireStore.getState().ouvrirBanque()}
                  className="w-7 h-7 flex items-center justify-center rounded-xl text-xs text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                  title="Banque de Setups & Rétro-Ingénierie 🧪"
                >
                  🧪
                </button>

                <div className="w-px h-3.5 bg-white/15" />

                {/* Bougie précédente */}
                <button
                  onClick={() => reculerBougie()}
                  className="w-7 h-7 flex items-center justify-center rounded-xl text-xs text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                  title="Bougie précédente"
                >
                  ⏪
                </button>

                {/* Play / Pause */}
                <button
                  onClick={() => setEstEnLecture(!estEnLecture)}
                  className={`px-2.5 h-7 flex items-center justify-center rounded-xl text-xs font-bold transition-all shadow ${
                    estEnLecture ? 'bg-[#ff9800] text-white' : 'bg-[#26a69a] text-white'
                  }`}
                  title="Lecture / Pause (Espace)"
                >
                  {estEnLecture ? '⏸' : '▶'}
                </button>

                {/* Bougie suivante */}
                <button
                  onClick={() => {
                    setEstEnLecture(false);
                    avancerBougie();
                  }}
                  className="w-7 h-7 flex items-center justify-center rounded-xl text-xs text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                  title="Bougie suivante (→)"
                >
                  ⏩
                </button>

                {/* Compteur bougie discret */}
                {donneesCompletes.length > 0 && (
                  <span className="text-white/40 text-[10px] font-mono px-1 hidden sm:inline">
                    {indexCourant + 1}/{donneesCompletes.length}
                  </span>
                )}
              </div>
            </>
          )}
          {erreur && (
            <div className={`border-b text-xs px-4 py-2 ${C.errBg}`}>
              ⚠️ {erreur}
            </div>
          )}
          <BacktestChart
            ref={chartRef}
            activeTool={outilActif}
            onDrawingComplete={() => setOutilActif(null)}
            onScrollToLeft={chargerAnneePrecedenteCloud}
            height={hauteurGraphique}
            theme={theme}
            timeframe={timeframe}
            onOpenIndicatorModal={(scriptId, onglet) => {
              setScriptIdPourEdition(scriptId || null);
              setOngletInitialIndicateurs(onglet || (scriptId ? 'configuration' : 'indicateurs'));
              setModalIndicateursOuvert(true);
            }}
          />
        </div>

        {/* ─── PANEL DROIT / MODAL MOBILE : Affiché uniquement hors mode plein écran ─── */}
        {/* En mode plein écran, le TradeDrawer est rendu à l'intérieur du conteneur fixed (voir section 5️⃣) */}
        {!estPleinEcran && (isNewTradeOpen || initialisantPlanification || initialisantResolution) && (
          estMobile ? (
            // Sur smartphone Android, le TradeDrawer s'affiche comme une modal en plein écran avec bouton retour
            <TradeDrawer isInline={false} backtestMode={true} onCaptureGraphique={capturerGraphique} />
          ) : (
            // Sur tablette et desktop, on garde le panneau latéral élégant fixé à droite du graphique
            <div className="w-[420px] flex flex-col border-l flex-shrink-0 transition-all duration-300 bg-surface">
              {initialisantPlanification || initialisantResolution ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-3 text-center bg-surface">
                  <span className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"></span>
                  <p className="text-xs font-semibold text-txt">
                    {initialisantPlanification
                      ? 'Planification : capture automatique du graphique...'
                      : 'Résolution : capture automatique de clôture...'}
                  </p>
                  <p className="text-[10px] text-txt3">Veuillez patienter pendant l'upload...</p>
                </div>
              ) : (
                <TradeDrawer isInline={true} backtestMode={true} onCaptureGraphique={capturerGraphique} />
              )}
            </div>
          )
        )}
      </div>

      <AIDatasetModal
        ouvert={modalAIDatasetOuverte}
        onFermer={() => setModalAIDatasetOuverte(false)}
        onNombreChange={(nb) => setNbEchantillonsIA(nb)}
      />

      {/* Fiche modale tactile ultra-rapide (< 16ms) pour smartphone sans bloquer l'UI */}
      <BacktestTradeModal
        ouvert={modalMobileOuverte}
        onFermer={() => setModalMobileOuverte(false)}
        position={positionActive}
        paire={actif !== 'Aucun actif' && actif ? actif : paireCloud}
        timeframe={timeframe}
        annee={String(anneeCloud)}
        journal_type={journalDest}
        onOuvrirFormulaireComplet={handleOuvrirFormulaireComplet}
        promiseCapture={promiseCaptureMobile}
        onRecapturer={capturerGraphique}
      />

      {/* Modal Style TradingView pour ajouter/supprimer indicateurs et régler la télémétrie */}
      <BacktestIndicatorsModal
        isOpen={modalIndicateursOuvert}
        onClose={() => {
          setModalIndicateursOuvert(false);
          setScriptIdPourEdition(null);
        }}
        idInitialScriptSelectionne={scriptIdPourEdition}
        ongletInitial={ongletInitialIndicateurs}
      />

      {/* Modal Studio de Bots Automatisés (Extensions sans recompilation) */}
      <BacktestBotModal
        isOpen={modalBotOuverte}
        onClose={() => setModalBotOuverte(false)}
        bougies={donneesCompletes}
        onLancerReplayVisuel={(bot) => {
          setBotReplayActif(bot);
          setEstEnLecture(true);
          addToast(`🤖 Bot "${bot.nom}" démarré en Replay Visuel !`, 'success');
        }}
      />

      {/* 🧪 Modal Inspecteur de Setup (Sondeur de Rétro-Ingénierie) */}
      <ModalInspecteurSetup />

      {/* 📊 Modal Banque de Setups & Synthèse Statistique */}
      <ModalBanqueSetups />
    </div>
  );
}