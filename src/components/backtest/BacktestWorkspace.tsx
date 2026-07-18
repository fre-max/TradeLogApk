import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useBacktestStore } from '@/store/backtestStore';
import { parserCsvPrix, agregerBougies } from '@/lib/chartDataHelper';
import type { Bougie } from '@/lib/chartDataHelper';
import { BacktestChart } from './BacktestChart';
import { useUIStore } from '@/store';
import { TradeDrawer } from '@/components/trade/TradeDrawer';
import type { PositionSimulee } from '@/store/backtestStore';
import { supabase } from '@/lib/supabase';
import { uploadImage } from '@/lib/storage';

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
  { group: 'Fibonacci', items: [
    { id: 'fib-retracement', label: 'FIB',   title: 'Fibonacci Retracement — 2 clics : sommet puis creux (ou inverse)' },
  ]},
  { group: 'Trading', items: [
    { id: 'pos-long',  label: 'LONG',  title: 'Position Long ▲ — 3 clics : ① Entrée  ② Stop Loss  ③ Take Profit' },
    { id: 'pos-short', label: 'SHORT', title: 'Position Short ▼ — 3 clics : ① Entrée  ② Stop Loss  ③ Take Profit' },
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
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [outilActif, setOutilActif] = useState<string | null>(null);
  const [estPleinEcran, setEstPleinEcran] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('light');


  // Cache des données brutes M1 pour la ré-agrégation MTF à la volée et le scroll infini
  const [donneesM1Chargees, setDonneesM1Chargees] = useState<Bougie[]>([]);
  const [anneeMinimumChargee, setAnneeMinimumChargee] = useState<number>(2025);
  const isFetchingPrevYear = useRef(false);

  // Type de journal de destination choisi dans l'en-tête pour l'export des trades
  const [journalDest, setJournalDest] = useState<'global' | 'bias' | 'poi' | 'confirmation'>('global');

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

  // Référence pour appeler les méthodes de capture du graphique
  const chartRef = useRef<{ takeScreenshot: () => Promise<Blob | null> } | null>(null);
  // ID unique du trade en cours d'exportation pour afficher un spinner
  const [exportantTradeId, setExportantTradeId] = useState<string | null>(null);

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
    // Met à jour la largeur de la fenêtre lors du redimensionnement
    const gererResize = () => setLargeurFenetre(window.innerWidth);
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

  const estMobile = largeurFenetre < 768;

  // Hauteur du graphique : plus grande en plein écran, réduite à 350px sur mobile
  const hauteurGraphique = estPleinEcran
    ? window.innerHeight - 120
    : estMobile
      ? 350
      : 500;

  // Classes CSS calculées selon le thème courant
  const C = getThemeClasses(theme);

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
    revenirDebut,
    setEstEnLecture,
    setVitesseLecture,
    fermerPositionManuellement,
    supprimerTradeHistorique,
    mettreAJourDonneesMtf,
    // Paramètres de session persistés
    paireCloud,
    anneeCloud,
    timeframeSauvegarde,
    setPaireCloud,
    setAnneeCloud,
    setTimeframeSauvegarde,
    contexteRestauration,
    nettoyerRestaurationContexte,
  } = useBacktestStore();

  // Le timeframe local est initialisé depuis le store persisté (timeframeSauvegarde)
  // On utilise un useState local pour la réactivité UI, mais on le synchronise au store
  const [timeframe, setTimeframeLocal] = useState(timeframeSauvegarde || 'H1');

  // Fonction pour changer l'UT et mémoriser dans le store en même temps
  // Exemple : setTimeframe('H4') → met à jour l'UI et persist dans le sessionStorage
  const setTimeframe = (tf: string) => {
    setTimeframeLocal(tf);
    setTimeframeSauvegarde(tf);
  };

  const openNewTradeWithPrefill = useUIStore((s) => s.openNewTradeWithPrefill);
  const isNewTradeOpen = useUIStore((s) => s.isNewTradeOpen);
  const addToast = useUIStore((s) => s.addToast);

  // Chargement automatique au premier montage OU si les données ont été perdues
  // (ex: retour depuis une autre page après une réactualisation)
  // Si donneesCompletes est vide MAIS que paireCloud est connu (persisté), on recharge automatiquement
  useEffect(() => {
    // Si on a une restauration en cours, on laisse le useEffect dédié gérer
    if (contexteRestauration) return;

    if (donneesCompletes.length === 0) {
      // Recharge la paire/année mémorisée dans le store (par défaut EURUSD 2025)
      chargerDonneesCloud(paireCloud, anneeCloud);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Détecte la demande de restauration de contexte depuis le journal (Replay Link)
  useEffect(() => {
    if (!contexteRestauration) return;

    const restaurer = async () => {
      const { pair, annee, timeframe: tfRestaurer, timestamp } = contexteRestauration;
      console.log(`🔄 [Replay Link] Demande de restauration vers ${pair} ${annee} ${tfRestaurer} à timestamp ${timestamp}`);
      
      // 1. Met à jour l'UT locale
      setTimeframeLocal(tfRestaurer);
      setTimeframeSauvegarde(tfRestaurer);

      // 2. Charge les données avec ciblage de bougie
      await chargerDonneesCloud(pair, annee, timestamp, tfRestaurer);

      // 3. Consomme le contexte pour ne pas reboucler
      nettoyerRestaurationContexte();
      addToast(`Replay positionné sur l'entrée de ton trade (${pair} en ${tfRestaurer})`, 'info');
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

  // ─── Boucle de lecture du Replay ─────────────────────────────────────────────
  useEffect(() => {
    if (!estEnLecture) return;
    const intervalle = setInterval(() => {
      const continuer = avancerBougie();
      if (!continuer) {
        clearInterval(intervalle);
        addToast('Replay terminé — fin des données disponibles.', 'info');
      }
    }, vitesseLecture);
    return () => clearInterval(intervalle);
  }, [estEnLecture, vitesseLecture, avancerBougie]);

  // ─── Automatisation du Journaling en 2 Étapes ───────────────────────────────
  const [initialisantPlanification, setInitialisantPlanification] = useState(false);
  const [initialisantResolution, setInitialisantResolution] = useState(false);

  // Capture le graphique et upload vers Supabase — utilisée automatiquement ET manuellement
  // Retourne l'objet image prêt à insérer dans le formulaire, ou null si erreur
  const capturerGraphique = useCallback(async (phase: 'avant' | 'apres'): Promise<{ id: string; url: string; source: 'upload'; phase: 'avant' | 'apres' } | null> => {
    try {
      if (!chartRef.current) return null;
      const blob = await chartRef.current.takeScreenshot();
      if (!blob) return null;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const path = `trade_images/${user.id}/${Date.now()}-backtest-${phase}.jpg`;
      const url = await uploadImage(blob, path);
      return { id: crypto.randomUUID(), url, source: 'upload' as const, phase };
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

  const initialiserPlanificationTrade = useCallback(async (position: PositionSimulee) => {
    setInitialisantPlanification(true);
    // Capture automatique au moment de la pose de la position
    const imageAvant = await capturerGraphique('avant');

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
  }, [actif, paireCloud, journalDest, timeframe, openNewTradeWithPrefill, capturerGraphique]);

  const initialiserResolutionTrade = useCallback(async (position: PositionSimulee) => {
    setInitialisantResolution(true);
    // Capture automatique à la clôture du trade
    const imageApres = await capturerGraphique('apres');

    const imageApres_obj = imageApres ?? null;

    const resultMapping = position.resultat === 'win' ? 'win' as const
      : position.resultat === 'loss' ? 'loss' as const
      : position.resultat === 'breakeven' ? 'breakeven' as const
      : 'missed' as const;

    const plannedDiff = Math.abs(position.takeProfit - position.prixEntree);
    const plannedRisk = Math.abs(position.prixEntree - position.stopLoss);
    const rrP = plannedRisk > 0 ? (plannedDiff / plannedRisk).toFixed(2) : '1.00';

    const realizedDiff = Math.abs((position.prixSortie || 0) - position.prixEntree);
    const rrR = plannedRisk > 0 ? (realizedDiff / plannedRisk).toFixed(2) : '0';

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
      pnl: position.pnl !== undefined ? Number(position.pnl.toFixed(2)) : 0,
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
  }, [actif, paireCloud, journalDest, timeframe, openNewTradeWithPrefill, capturerGraphique]);

  // Hook pour observer l'ouverture d'une nouvelle position active (Étape 1) - Déclenchement auto désactivé
  const lastPositionRef = useRef<PositionSimulee | null>(null);
  useEffect(() => {
    if (!positionActive) {
      lastPositionRef.current = null;
    }
  }, [positionActive]);

  // Hook pour observer la clôture d'une position active (Étape 2) - Déclenchement auto désactivé
  const lastClotureRef = useRef<boolean>(false);
  useEffect(() => {
    if (!positionActive || !positionActive.estCloturee) {
      lastClotureRef.current = false;
    }
  }, [positionActive]);


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
        setEstPleinEcran(false);
        setOutilActif(null);
      }
    };
    window.addEventListener('keydown', gererTouche);
    return () => window.removeEventListener('keydown', gererTouche);
  }, [estEnLecture, avancerBougie, setEstEnLecture]);

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
      setAnneeMinimumChargee(anneeStart);
      setPaireCloud(paireActuelle);

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

  // ─── Chargement Cloud depuis le Dépôt GitHub public ────────────────────────
  const chargerDonneesCloud = async (paireSel: string, anneeSel: string, targetTimestamp?: number, targetTimeframe?: string) => {
    setChargement(true);
    setErreur(null);
    try {
      const nomFichier = `${paireSel.toUpperCase()}_M1_${anneeSel}.csv.gz`;
      const url = `https://cdn.jsdelivr.net/gh/fre-max/Forex_Data@main/forex_data/${nomFichier}`;
      
      console.log(`📡 [Cloud Loader] Téléchargement de ${url}...`);
      const reponse = await fetch(url);
      if (!reponse.ok) {
        throw new Error(
          `Impossible de trouver le fichier ${nomFichier} sur GitHub.`
        );
      }
      
      const stream = reponse.body?.pipeThrough(new DecompressionStream('gzip'));
      if (!stream) throw new Error("Impossible d'initialiser le flux de décompression.");
      
      const texteCsv = await new Response(stream).text();
      const bougiesM1 = parserCsvPrix(texteCsv);
      
      setDonneesM1Chargees(bougiesM1);
      const anneeInt = parseInt(anneeSel);
      setAnneeMinimumChargee(anneeInt);
      // Mémoriser la paire et l'année dans le store (persisté en sessionStorage)
      // Cela permet de recharger les bonnes données si l'utilisateur revient sur la page
      setPaireCloud(paireSel.toUpperCase());
      setAnneeCloud(anneeSel);

      const activeTf = targetTimeframe || timeframe;

      // Agréger pour le timeframe actif
      const bougiesAgregees = agregerBougies(bougiesM1, activeTf);
      chargerDonnees(bougiesAgregees, paireSel.toUpperCase());

      // Si un timestamp de ciblage est spécifié (restauration de trade)
      if (targetTimestamp !== undefined) {
        const targetTimeVal = targetTimestamp;
        let indexTrouve = bougiesAgregees.findIndex(b => {
          const t = typeof b.time === 'number' ? b.time : Math.floor(new Date(b.time).getTime() / 1000);
          return t === targetTimeVal;
        });

        // Si non trouvé exactement, cherche le plus proche inférieur ou égal
        if (indexTrouve === -1) {
          indexTrouve = bougiesAgregees.findIndex(b => {
            const t = typeof b.time === 'number' ? b.time : Math.floor(new Date(b.time).getTime() / 1000);
            return t > targetTimeVal;
          }) - 1;
        }

        if (indexTrouve >= 0 && indexTrouve < bougiesAgregees.length) {
          // On avance l'index de + 15 bougies pour laisser voir le déclenchement et un bout du déroulement
          const indexCible = Math.min(indexTrouve + 15, bougiesAgregees.length - 1);
          console.log(`🎯 [Replay Link] Positionnement du graphique à l'index ${indexCible} (bougie exacte index ${indexTrouve})`);
          useBacktestStore.setState({ indexCourant: indexCible });
        } else {
          console.warn(`[Replay Link] Impossible de trouver la bougie pour le timestamp ${targetTimestamp}`);
        }
      }

      addToast(`${paireSel.toUpperCase()} (${anneeSel}) — Données chargées et agrégées en ${activeTf}`, 'success');
    } catch (err: any) {
      console.error(err);
      setErreur(err.message || "Erreur lors du chargement des données depuis le Cloud.");
      addToast(err.message || "Échec du chargement Cloud", "error");
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
    const url = `https://cdn.jsdelivr.net/gh/fre-max/Forex_Data@main/forex_data/${nomFichier}`;

    console.log(`☁️ [Cloud Loader] Chargement de l'année ${anneePrecedente} depuis le Cloud...`);
    
    try {
      const reponse = await fetch(url);
      if (!reponse.ok) {
        console.warn(`[Cloud Loader] L'année ${anneePrecedente} n'est pas disponible pour ${paireActive}.`);
        isFetchingPrevYear.current = false;
        setAnneeMinimumChargee(anneePrecedente);
        return;
      }

      const stream = reponse.body?.pipeThrough(new DecompressionStream('gzip'));
      if (!stream) throw new Error("Impossible d'initialiser le flux de décompression.");

      const texteCsv = await new Response(stream).text();
      const anciennesBougiesM1 = parserCsvPrix(texteCsv);

      const nouvellesBougiesM1 = [...anciennesBougiesM1, ...donneesM1Chargees];
      setDonneesM1Chargees(nouvellesBougiesM1);
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
  // Prend automatiquement une capture d'écran combinée (graphique + overlay)
  // et l'associe directement à l'étape correspondante du journal choisi.
  const exporterVersJournal = async (trade: PositionSimulee) => {
    const tradeUid = `${trade.dateEntree}-${trade.prixEntree}`;
    console.log('🚀 [Backtest] Début de l\'exportation du trade vers le journal :', journalDest);
    setExportantTradeId(tradeUid);

    let imageUrlPublic = '';
    try {
      if (chartRef.current) {
        const blob = await chartRef.current.takeScreenshot();
        if (blob) {
          console.log('📡 [Backtest] Upload de la capture d\'écran vers Supabase Storage...');
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('Utilisateur non connecté');

          const path = `trade_images/${user.id}/${Date.now()}-backtest.jpg`;
          imageUrlPublic = await uploadImage(blob, path);
          console.log('✅ [Backtest] Capture d\'écran uploadée ! URL :', imageUrlPublic);
        }
      }
    } catch (err) {
      console.error('❌ [Backtest] Échec de la génération ou de l\'upload de la capture :', err);
      addToast('Impossible de générer ou d\'uploader la capture du graphique. Le trade sera pré-rempli sans image.', 'info');
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
      phase: 'avant' as const
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
          console.log('🚀 [Workspace] ⑤ Récupération user Supabase...');
          const { data: { user }, error: userError } = await supabase.auth.getUser();
          console.log('🚀 [Workspace] ⑥ user =', user?.id ?? 'NULL ❌', '| error =', userError);
          if (!user) throw new Error('Utilisateur non connecté');

          const path = `trade_images/${user.id}/${Date.now()}-backtest.jpg`;
          console.log('🚀 [Workspace] ⑦ Upload vers path :', path);
          imageUrlPublic = await uploadImage(blob, path);
          console.log('🚀 [Workspace] ⑧ Upload terminé ! URL :', imageUrlPublic);
        } else {
          console.warn('⚠️ [Workspace] blob null → on continue SANS image');
        }
      } else {
        console.warn('⚠️ [Workspace] chartRef.current NULL → pas de capture');
      }
    } catch (err) {
      console.error('❌ [Backtest] Échec de la capture manuelle :', err);
      addToast('Impossible de générer ou d\'uploader la capture.', 'error');
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
      ${estPleinEcran ? 'fixed inset-0 z-[200]' : 'flex-1'}`}
    >

      {/* ══════════════════════════════════════════════════════════ */}
      {/* BARRE SUPÉRIEURE — style TradingView Header               */}
      {/* ══════════════════════════════════════════════════════════ */}
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
          onClick={() => setEstPleinEcran(!estPleinEcran)}
          title={estPleinEcran ? 'Quitter le plein écran (Esc)' : 'Plein écran'}
          className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded transition-colors text-base ${C.btnBase}`}
        >
          {estPleinEcran ? '⊡' : '⊞'}
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* CORPS PRINCIPAL : Toolbar Gauche + Graphique + Panel Droit */}
      {/* ══════════════════════════════════════════════════════════ */}
      <div className="flex flex-col md:flex-row flex-1 overflow-y-auto md:overflow-hidden">

        {/* ─── BARRE D'OUTILS DE TRACAGE (style TradingView) ─── */}
        {/* Horizontale et défilante sur mobile, verticale sur écran moyen (md) */}
        <div className={`w-full md:w-14 h-12 md:h-auto flex flex-row md:flex-col items-center p-1.5 md:pt-2 gap-1 md:gap-0.5 border-b md:border-b-0 md:border-r flex-shrink-0 overflow-x-auto md:overflow-y-auto scrollbar-none ${C.bgSidebar}`}>
          {OUTILS_TRACAGE.map((groupe) => (
            <React.Fragment key={groupe.group}>
              {groupe.items.map((outil) => {
                const estActif = outilActif === outil.id;
                return (
                  <button
                    key={String(outil.id)}
                    onClick={() => setOutilActif(estActif ? null : outil.id)}
                    title={outil.title}
                    className={`w-10 md:w-12 h-8 md:h-9 flex flex-col items-center justify-center rounded text-[9px] font-bold tracking-tight transition-all leading-tight px-0.5 flex-shrink-0
                      ${estActif ? C.btnActive : C.btnBase}`}
                  >
                    {/* Icône SVG pour le curseur, texte pour les autres */}
                    {outil.label === 'CURSOR' ? (
                      <svg viewBox="0 0 16 16" className="w-4 h-4" fill="currentColor">
                        <path d="M2 1l12 6.5L9.5 9l-1 5.5L2 1z" />
                      </svg>
                    ) : (
                      <span className="text-[10px] font-bold">{outil.label}</span>
                    )}
                  </button>
                );
              })}
              <div className={`w-px md:w-8 h-6 md:h-px mx-1 md:mx-0 my-0 md:my-1 flex-shrink-0 ${C.separator}`} />
            </React.Fragment>
          ))}
        </div>

        {/* ─── GRAPHIQUE PRINCIPAL ─── */}
        <div className="flex-1 min-w-0 flex-shrink-0 relative">
          
          {/* WIDGET UT (Timeframe) flottant et déplaçable par l'utilisateur */}
          <div
            style={
              hasDraggedUt
                ? { position: 'absolute', left: `${utPos.x}px`, top: `${utPos.y}px`, zIndex: 100 }
                : { position: 'absolute', left: '80px', top: '20px', zIndex: 100 }
            }
            className={`flex items-center gap-1.5 p-1.5 rounded-lg border shadow-lg backdrop-blur-md select-none ${
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
            
            {/* Boutons d'UT */}
            <div className="flex items-center gap-0.5">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf.value}
                  onClick={() => setTimeframe(tf.value)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded transition-colors ${
                    timeframe === tf.value ? C.btnActive : C.btnBase
                  }`}
                >
                  {tf.label}
                </button>
              ))}
            </div>
          </div>

          {/* DOCK FLOATING DE REPLAY (Déplaçable et facile d'accès tactile pour tablette, sans vitesse) */}
          <div
            style={
              hasDraggedReplay
                ? { position: 'absolute', left: `${replayPos.x}px`, top: `${replayPos.y}px`, zIndex: 90 }
                : { position: 'absolute', right: '24px', bottom: '24px', zIndex: 90 }
            }
            className={`flex items-center gap-1.5 p-2 rounded-xl border shadow-2xl backdrop-blur-md select-none ${
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

            <div className={`w-px h-5 ${C.separator}`} />

            {/* ⏮ Retour au début */}
            <button
              onClick={revenirDebut}
              title="Retour au début"
              className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-colors ${C.btnBase}`}
            >
              ⏮
            </button>

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
          />
        </div>

        {/* ─── PANEL DROIT : Uniquement affiché pour l'écriture/détail du TradeDrawer ─── */}
        {/* L'historique et les statistiques passives ont été supprimés pour maximiser l'espace du graphique */}
        {(isNewTradeOpen || initialisantPlanification || initialisantResolution) && (
          <div className="w-full md:w-[420px] flex flex-col border-t md:border-t-0 md:border-l flex-shrink-0 transition-all duration-300 bg-surface">
            {initialisantPlanification || initialisantResolution ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-3 text-center bg-surface">
                <span className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"></span>
                <p className="text-xs font-semibold text-txt">
                  {initialisantPlanification 
                    ? "Planification : capture automatique du graphique..." 
                    : "Résolution : capture automatique de clôture..."}
                </p>
                <p className="text-[10px] text-txt3">Veuillez patienter pendant l'upload...</p>
              </div>
            ) : (
              <TradeDrawer isInline={true} backtestMode={true} onCaptureGraphique={capturerGraphique} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}