import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useBacktestStore } from '@/store/backtestStore';
import { useBotJournalStore, type SessionBacktestBot } from '@/store/botJournalStore';
import { executerSimulationOrchestrateurSMC } from '@/lib/bot/simulateurOrchestrateurSMC';
import { useUIStore } from '@/store';
import { useLocalDatabase } from '@/store/useLocalDatabase';
import { cn } from '@/lib/utils';
import type { TradeBotSimule } from '@/types/bot';
import type { TypeChevauchementUOP } from '@/lib/bot/modules/03_tp_uop/unmitigatedOverlapProfile';
import { chargerBougiesM1 } from '@/lib/cloudDataLoader';
import { agregerBougies } from '@/lib/chartDataHelper';

const PAIRES_DISPONIBLES = ['XAUUSD', 'EURUSD', 'GBPUSD', 'NAS100', 'US30', 'BTCUSD'];
const ANNEES_DISPONIBLES = ['2025', '2024', '2023'];
const TIMEFRAMES_DISPONIBLES = [
  { label: 'M1', value: '1m' },
  { label: 'M5', value: '5m' },
  { label: 'M15', value: '15m' },
  { label: 'M30', value: '30m' },
  { label: 'H1', value: '1h' },
  { label: 'H4', value: '4h' },
  { label: 'D1', value: '1d' },
];

/**
 * ──────────────────────────────────────────────────────────────────────────────
 * 🤖 WORKSPACE DU STUDIO ET JOURNAL DE TRADING DES BOTS (OPTION B AVANCÉE)
 * ──────────────────────────────────────────────────────────────────────────────
 * Fonctionnalités complètes :
 * 1. Sélecteur de données Cloud intégré (Paire, Année, Timeframe) avec cache IndexedDB.
 * 2. Moteur de simulation batch instantané pour le Chef d'Orchestre SMC.
 * 3. Journal de trading dédié avec calcul du Win Rate, Profit Factor, R:R et Max Drawdown.
 * 4. Replay Link interactif : visualisez n'importe quel trade du bot directement sur le graphique.
 * 5. Export de trades prometteurs vers le Journal Manuel personnel.
 * 6. Courbe d'équité (Equity Curve) vectorielle fluide.
 * 7. Historique des sessions et export CSV des résultats.
 * 
 * Exemple :
 * <BotBacktestWorkspace />
 */
export function BotBacktestWorkspace() {
  const [, setSearchParams] = useSearchParams();
  const addToast = useUIStore((s) => s.addToast);
  const addTradeManuel = useLocalDatabase((s) => s.addTrade);

  // ─── Données de marché du Backtest Store ──────────────────────────────────
  const donneesCompletes = useBacktestStore((s) => s.donneesCompletes);
  const donneesM1 = useBacktestStore((s) => s.donneesM1);
  const paireCloud = useBacktestStore((s) => s.paireCloud);
  const anneeCloud = useBacktestStore((s) => s.anneeCloud);
  const actif = useBacktestStore((s) => s.actif);
  const timeframeSauvegarde = useBacktestStore((s) => s.timeframeSauvegarde);
  const chargerDonneesDansStore = useBacktestStore((s) => s.chargerDonnees);
  const setDonneesM1 = useBacktestStore((s) => s.setDonneesM1);
  const setPaireCloud = useBacktestStore((s) => s.setPaireCloud);
  const setAnneeCloud = useBacktestStore((s) => s.setAnneeCloud);
  const setTimeframeSauvegarde = useBacktestStore((s) => s.setTimeframeSauvegarde);
  const lancerRestaurationContexte = useBacktestStore((s) => s.lancerRestaurationContexte);

  // Paire et UT affichées
  const paireActuelle = actif && actif !== 'Aucun actif' ? actif : paireCloud || 'XAUUSD';
  const anneeActuelle = anneeCloud || '2025';
  const timeframeActuel = timeframeSauvegarde || '5m';

  // ─── États pour le chargeur de données intégré (Option B) ────────────────
  const [paireChoisie, setPaireChoisie] = useState<string>(paireActuelle);
  const [anneeChoisie, setAnneeChoisie] = useState<string>(anneeActuelle);
  const [timeframeChoisi, setTimeframeChoisi] = useState<string>(timeframeActuel);
  const [enTelechargement, setEnTelechargement] = useState<boolean>(false);

  // ─── Store du Journal des Bots ───────────────────────────────────────────
  const {
    sessions,
    sessionActiveId,
    enregistrerRapportSimulation,
    supprimerSession,
    effacerToutesLesSessions,
    selectionnerSession,
  } = useBotJournalStore();

  // Session actuellement affichée (ou la plus récente par défaut)
  const sessionActive: SessionBacktestBot | null = useMemo(() => {
    if (sessionActiveId) {
      const trouvee = sessions.find((s) => s.id === sessionActiveId);
      if (trouvee) return trouvee;
    }
    return sessions.length > 0 ? sessions[0] : null;
  }, [sessions, sessionActiveId]);

  // ─── Paramètres de configuration du Bot ─────────────────────────────────
  const [palierTPVise, setPalierTPVise] = useState<'AUTO' | 'TP1' | 'TP2' | 'TP3'>('AUTO');
  const [typeChevauchement, setTypeChevauchement] = useState<TypeChevauchementUOP>('PONDERE');
  const [capitalInitial, setCapitalInitial] = useState<number>(10000);
  const [risquePourcent, setRisquePourcent] = useState<number>(1.0);
  const [scoreShvedMin, setScoreShvedMin] = useState<number>(15);
  const [enSimulation, setEnSimulation] = useState<boolean>(false);

  // ─── Filtre et recherche dans le tableau des trades ─────────────────────
  const [filtreResultat, setFiltreResultat] = useState<'tous' | 'win' | 'loss' | 'breakeven'>('tous');
  const [rechercheTrade, setRechercheTrade] = useState<string>('');
  const [ongletVue, setOngletVue] = useState<'journal' | 'equity' | 'historique'>('journal');
  const [tradeSelectionne, setTradeSelectionne] = useState<TradeBotSimule | null>(null);

  // ─── Action : Chargement des données de marché autonome ───────────────────
  const telechargerDonnees = async () => {
    setEnTelechargement(true);
    try {
      addToast(`Chargement de ${paireChoisie} (${anneeChoisie})...`, 'info');
      // 1. Récupération des bougies M1 (depuis cache local ou Cloud)
      const bougiesM1 = await chargerBougiesM1(paireChoisie, anneeChoisie);

      // 2. Enregistrement M1 et agrégation vers le timeframe choisi
      setDonneesM1(bougiesM1);
      setPaireCloud(paireChoisie);
      setAnneeCloud(anneeChoisie);
      setTimeframeSauvegarde(timeframeChoisi);

      const bougiesAgregees = agregerBougies(bougiesM1, timeframeChoisi);
      chargerDonneesDansStore(bougiesAgregees, paireChoisie);

      addToast(
        `✅ Données prêtes : ${bougiesAgregees.length} bougies chargées (${paireChoisie} · ${timeframeChoisi})`,
        'success'
      );
    } catch (err: any) {
      console.error('❌ [BotWorkspace] Erreur chargement données :', err);
      addToast(`Erreur chargement : ${err?.message || 'Vérifiez la connexion.'}`, 'error');
    } finally {
      setEnTelechargement(false);
    }
  };

  // ─── Chargement automatique au montage si aucune bougie n'est chargée ────
  React.useEffect(() => {
    if (!donneesCompletes || donneesCompletes.length === 0) {
      telechargerDonnees();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Action : Lancement de la simulation du Bot ──────────────────────────
  const lancerSimulation = () => {
    if (!donneesCompletes || donneesCompletes.length < 30) {
      addToast(
        '⚠️ Aucune donnée disponible. Cliquez sur "Charger les données" ci-dessous d\'abord.',
        'info'
      );
      return;
    }

    setEnSimulation(true);

    try {
      // 1. Exécution du moteur de simulation batch avec donneesM1
      const rapport = executerSimulationOrchestrateurSMC(donneesCompletes, {
        capitalInitial,
        risquePourcent,
        paire: paireActuelle,
        timeframe: timeframeActuel,
        donneesM1: donneesM1 && donneesM1.length > 0 ? donneesM1 : donneesCompletes,
        parametresSMC: {
          palierTPVise,
          typeChevauchementUOP: typeChevauchement,
          scoreMinimumShved: scoreShvedMin,
        },
      });

      // 2. Enregistrement dans le Journal dédié aux bots
      const nouvelleSession = enregistrerRapportSimulation(rapport, paireActuelle, timeframeActuel);

      addToast(
        `✅ Simulation terminée : ${nouvelleSession.totalTrades} trades exécutés (Win Rate : ${nouvelleSession.winratePourcentage}%)`,
        'success'
      );
      setOngletVue('journal');
    } catch (erreur) {
      console.error('❌ [BotBacktest] Erreur exécution simulation :', erreur);
      addToast('Erreur lors de la simulation du bot.', 'error');
    } finally {
      setEnSimulation(false);
    }
  };

  // ─── Action : Replay Link (Voir sur le Graphique Replay) ─────────────────
  const voirTradeSurGraphique = (trade: TradeBotSimule) => {
    const timestampUnix = typeof trade.dateEntree === 'number'
      ? trade.dateEntree
      : Math.floor(new Date(trade.dateEntree).getTime() / 1000);

    // Configuration de la restauration automatique dans le store
    lancerRestaurationContexte({
      pair: sessionActive?.paire || paireActuelle,
      annee: anneeCloud || '2025',
      timeframe: sessionActive?.timeframe || timeframeActuel,
      timestamp: timestampUnix,
      position: {
        direction: trade.direction,
        prixEntree: trade.prixEntree,
        stopLoss: trade.stopLoss,
        takeProfit: trade.takeProfit,
      },
      tradeInfo: {
        id: trade.id,
        titre: `[Bot SMC] ${trade.direction.toUpperCase()} @ ${trade.prixEntree}`,
        setupName: "Chef d'Orchestre SMC",
      },
    });

    addToast(`Graphique Replay positionné sur l'entrée du trade (${trade.prixEntree})`, 'info');

    // Bascule vers le mode manuel
    setSearchParams({ mode: 'manuel' });
  };

  // ─── Action : Copier vers le Journal Personnel ───────────────────────────
  const copierVersJournalManuel = (trade: TradeBotSimule) => {
    try {
      const nouveauTrade = {
        id: crypto.randomUUID(),
        user_id: 'local-user',
        pair: sessionActive?.paire || paireActuelle,
        direction: trade.direction,
        entry_price: trade.prixEntree,
        stop_loss: trade.stopLoss,
        take_profit: trade.takeProfit,
        exit_price: trade.prixSortie,
        pnl: trade.pnlMontant,
        rr_realized: trade.ratioRR,
        result: trade.resultat,
        timeframe: sessionActive?.timeframe || timeframeActuel,
        created_at: new Date(trade.dateEntree).toISOString(),
        notes: `[Bot SMC Copié] ${trade.commentaire || ''} · Résultat : ${trade.resultat.toUpperCase()}`,
        status: 'closed' as const,
      };

      addTradeManuel(nouveauTrade as any);
      addToast('✅ Trade copié avec succès dans votre Journal Manuel !', 'success');
    } catch (err) {
      console.error('❌ [BotWorkspace] Erreur copie trade :', err);
      addToast('Impossible de copier le trade dans le journal.', 'error');
    }
  };

  // ─── Action : Export CSV des trades de la session ────────────────────────
  const exporterCsvTrades = () => {
    if (!sessionActive || sessionActive.trades.length === 0) return;

    const entetes = ['ID,Date,Direction,Prix Entree,Stop Loss,Take Profit,Sortie,Resultat,RR,PnL $,Commentaire'];
    const lignes = sessionActive.trades.map((t) =>
      `"${t.id}","${t.dateEntree}","${t.direction}","${t.prixEntree}","${t.stopLoss}","${t.takeProfit}","${t.prixSortie}","${t.resultat}","${t.ratioRR}","${t.pnlMontant}","${t.commentaire || ''}"`
    );

    const contenuCsv = [entetes, ...lignes].join('\n');
    const blob = new Blob([contenuCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const lien = document.createElement('a');
    lien.setAttribute('href', url);
    lien.setAttribute('download', `trades_bot_${sessionActive.paire}_${Date.now()}.csv`);
    document.body.appendChild(lien);
    lien.click();
    document.body.removeChild(lien);
    addToast('✅ Fichier CSV exporté avec succès !', 'success');
  };

  // Filtrage des trades de la session active
  const tradesFiltres = useMemo(() => {
    if (!sessionActive || !sessionActive.trades) return [];
    return sessionActive.trades.filter((t) => {
      if (filtreResultat !== 'tous' && t.resultat !== filtreResultat) return false;
      if (rechercheTrade.trim() !== '') {
        const query = rechercheTrade.toLowerCase();
        const directionMatch = t.direction.toLowerCase().includes(query);
        const commentMatch = (t.commentaire || '').toLowerCase().includes(query);
        const dateMatch = t.dateEntree.toLowerCase().includes(query);
        if (!directionMatch && !commentMatch && !dateMatch) return false;
      }
      return true;
    });
  }, [sessionActive, filtreResultat, rechercheTrade]);

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 max-w-7xl mx-auto w-full text-txt pb-20">
      {/* ─── En-tête : Présentation du Studio Bots ─────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface border border-border rounded-xl p-4 md:p-5 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🤖</span>
            <h1 className="text-lg md:text-xl font-bold tracking-tight text-txt">
              Studio & Journal des Bots de Trading
            </h1>
            <span className="bg-accent/15 text-accent text-xs font-semibold px-2.5 py-0.5 rounded-full border border-accent/20">
              Chef d'Orchestre SMC
            </span>
          </div>
          <p className="text-xs md:text-sm text-txt3">
            Simulez vos stratégies algorithmiques en temps réel, visualisez chaque setup sur le Replay graphique et enrichissez votre journal.
          </p>
        </div>

        {/* Badge Dataset Actif */}
        <div className="flex items-center gap-3 bg-surface2 border border-border/80 px-3.5 py-2 rounded-lg text-xs self-start md:self-auto">
          <div className="flex flex-col">
            <span className="text-txt3 text-[11px] uppercase font-semibold">Dataset Actif</span>
            <span className="font-semibold text-txt">
              {paireActuelle} · {timeframeActuel} ({donneesCompletes?.length || 0} bougies)
            </span>
          </div>
        </div>
      </div>

      {/* ─── Panneau 1 : Sélecteur de Données Cloud Intégré (Option B) ─────── */}
      <div className="bg-surface border border-border rounded-xl p-4 md:p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-base">📡</span>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-txt">
              Chargement des Données de Marché (Cloud / Cache Offline)
            </h2>
          </div>
          <span className="text-[11px] text-txt3">
            Télécharge ou lit depuis IndexedDB en 1 clic
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Paire */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-txt3 uppercase">Actif / Paire</label>
            <select
              value={paireChoisie}
              onChange={(e) => setPaireChoisie(e.target.value)}
              className="w-full bg-bg border border-border rounded-lg px-2.5 py-1.5 text-xs text-txt outline-none focus:border-accent"
            >
              {PAIRES_DISPONIBLES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Année */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-txt3 uppercase">Année</label>
            <select
              value={anneeChoisie}
              onChange={(e) => setAnneeChoisie(e.target.value)}
              className="w-full bg-bg border border-border rounded-lg px-2.5 py-1.5 text-xs text-txt outline-none focus:border-accent"
            >
              {ANNEES_DISPONIBLES.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          {/* Timeframe */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-txt3 uppercase">Timeframe (UT)</label>
            <select
              value={timeframeChoisi}
              onChange={(e) => setTimeframeChoisi(e.target.value)}
              className="w-full bg-bg border border-border rounded-lg px-2.5 py-1.5 text-xs text-txt outline-none focus:border-accent"
            >
              {TIMEFRAMES_DISPONIBLES.map((tf) => (
                <option key={tf.value} value={tf.value}>{tf.label} ({tf.value})</option>
              ))}
            </select>
          </div>

          {/* Bouton de chargement */}
          <div className="flex items-end">
            <button
              id="btn-charger-bougies"
              onClick={telechargerDonnees}
              disabled={enTelechargement}
              className={cn(
                'w-full py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-xs',
                enTelechargement
                  ? 'bg-surface2 text-txt3 cursor-not-allowed border border-border'
                  : 'bg-surface2 hover:bg-surface2/80 text-txt border border-border hover:border-accent'
              )}
            >
              {enTelechargement ? (
                <>
                  <span className="animate-spin text-xs">⏳</span>
                  <span>Téléchargement...</span>
                </>
              ) : (
                <>
                  <span>📥</span>
                  <span>Charger les Bougies</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ─── Panneau 2 : Configuration du Bot & Simulation ──────────────────── */}
      <div className="bg-surface border border-border rounded-xl p-4 md:p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-base">⚙️</span>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-txt">
              Paramètres du Backtest Algorithmique
            </h2>
          </div>
          <span className="text-xs text-txt3">
            Algorithme actif : <strong className="text-txt font-semibold">Doji Étoile + Shved S/R + UOP</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Palier TP Visé */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-txt2 flex items-center justify-between">
              <span>Palier TP Cible</span>
              <span className="text-[10px] text-accent font-semibold">Critère Clé</span>
            </label>
            <select
              value={palierTPVise}
              onChange={(e) => setPalierTPVise(e.target.value as any)}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-xs font-medium text-txt outline-none focus:border-accent transition-colors"
            >
              <option value="AUTO">AUTO (Progressif dynamique)</option>
              <option value="TP1">TP1 (Premier palier / Autoroute)</option>
              <option value="TP2">TP2 (Deuxième palier)</option>
              <option value="TP3">TP3 (Troisième palier lointain)</option>
            </select>
            <p className="text-[10px] text-txt3">
              {palierTPVise === 'TP1'
                ? 'Sécurise le premier palier non mitigé pour maximiser le Win Rate.'
                : palierTPVise === 'AUTO'
                ? 'Choisit intelligemment le palier offrant un R:R suffisant.'
                : `Vise le palier ${palierTPVise} pour de plus grands ratios R:R.`}
            </p>
          </div>

          {/* 2. Poids du chevauchement UOP */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-txt2">
              Pondération UOP (Corps vs Mèches)
            </label>
            <select
              value={typeChevauchement}
              onChange={(e) => setTypeChevauchement(e.target.value as any)}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-xs font-medium text-txt outline-none focus:border-accent transition-colors"
            >
              <option value="PONDERE">Pondéré (Corps 1.0 / Mèche 0.25)</option>
              <option value="BRUT">Brut (Mèche = Corps = 1.0)</option>
            </select>
            <p className="text-[10px] text-txt3">
              Le mode pondéré filtre les faux chevauchements causés par de simples mèches isolées.
            </p>
          </div>

          {/* 3. Capital Initial ($) */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-txt2">
              Capital Initial ($)
            </label>
            <input
              type="number"
              min={100}
              step={500}
              value={capitalInitial}
              onChange={(e) => setCapitalInitial(Number(e.target.value) || 10000)}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-xs font-medium text-txt outline-none focus:border-accent transition-colors"
            />
            <p className="text-[10px] text-txt3">Montant de départ de la simulation monétaire.</p>
          </div>

          {/* 4. Risque par trade (%) */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-txt2">
              Risque par Trade (%)
            </label>
            <input
              type="number"
              min={0.1}
              max={10}
              step={0.5}
              value={risquePourcent}
              onChange={(e) => setRisquePourcent(Number(e.target.value) || 1.0)}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-xs font-medium text-txt outline-none focus:border-accent transition-colors"
            />
            <p className="text-[10px] text-txt3">Pourcentage du capital risqué sur chaque position (1R).</p>
          </div>
        </div>

        {/* Bouton de déclenchement principal */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2 text-xs text-txt3">
            <span>ℹ️</span>
            <span>
              Simulation instantanée en mémoire · Ne modifie pas vos comptes ni vos trades manuels.
            </span>
          </div>

          <button
            id="btn-lancer-backtest-bot"
            onClick={lancerSimulation}
            disabled={enSimulation || !donneesCompletes || donneesCompletes.length < 30}
            className={cn(
              'w-full sm:w-auto px-5 py-2.5 rounded-lg text-xs md:text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-sm',
              enSimulation || !donneesCompletes || donneesCompletes.length < 30
                ? 'bg-surface2 text-txt3 cursor-not-allowed border border-border'
                : 'bg-accent hover:bg-accent/90 text-white shadow-accent/20 hover:shadow-md'
            )}
          >
            {enSimulation ? (
              <>
                <span className="animate-spin text-base">⏳</span>
                <span>Calcul de l'Orchestrateur en cours...</span>
              </>
            ) : (
              <>
                <span className="text-base">⚡</span>
                <span>Lancer le Backtest du Bot</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ─── Cartes KPIs de la Session Active ─────────────────────────────────── */}
      {sessionActive ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Win Rate */}
          <div className="bg-surface border border-border rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
            <span className="text-[11px] font-semibold uppercase text-txt3">Win Rate</span>
            <div className="my-1.5 flex items-baseline gap-1">
              <span
                className={cn(
                  'text-2xl font-bold tracking-tight',
                  sessionActive.winratePourcentage >= 50
                    ? 'text-emerald-500'
                    : sessionActive.winratePourcentage >= 40
                    ? 'text-amber-500'
                    : 'text-rose-500'
                )}
              >
                {sessionActive.winratePourcentage}%
              </span>
            </div>
            <div className="w-full bg-surface2 h-1.5 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  sessionActive.winratePourcentage >= 50 ? 'bg-emerald-500' : 'bg-rose-500'
                )}
                style={{ width: `${Math.min(100, sessionActive.winratePourcentage)}%` }}
              />
            </div>
          </div>

          {/* Profit Factor */}
          <div className="bg-surface border border-border rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
            <span className="text-[11px] font-semibold uppercase text-txt3">Profit Factor</span>
            <div className="my-1.5">
              <span
                className={cn(
                  'text-2xl font-bold tracking-tight',
                  sessionActive.profitFactor >= 1.5
                    ? 'text-emerald-500'
                    : sessionActive.profitFactor >= 1.0
                    ? 'text-amber-500'
                    : 'text-rose-500'
                )}
              >
                {sessionActive.profitFactor}
              </span>
            </div>
            <span className="text-[10px] text-txt3">
              {sessionActive.profitFactor >= 1.5 ? 'Rentable & Robuste' : sessionActive.profitFactor >= 1.0 ? 'Équilibré' : 'À optimiser'}
            </span>
          </div>

          {/* PnL Net */}
          <div className="bg-surface border border-border rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
            <span className="text-[11px] font-semibold uppercase text-txt3">Gain Net</span>
            <div className="my-1.5">
              <span
                className={cn(
                  'text-2xl font-bold tracking-tight',
                  sessionActive.pnlNetMontant >= 0 ? 'text-emerald-500' : 'text-rose-500'
                )}
              >
                {sessionActive.pnlNetMontant >= 0 ? '+' : ''}
                {sessionActive.pnlNetMontant} $
              </span>
            </div>
            <span className="text-[10px] text-txt3">
              {sessionActive.pnlNetPourcentage >= 0 ? '+' : ''}
              {sessionActive.pnlNetPourcentage}% de ROI
            </span>
          </div>

          {/* Ratio R:R Moyen */}
          <div className="bg-surface border border-border rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
            <span className="text-[11px] font-semibold uppercase text-txt3">R:R Moyen Réalisé</span>
            <div className="my-1.5">
              <span className="text-2xl font-bold tracking-tight text-accent">
                1:{sessionActive.ratioRRMoyen}
              </span>
            </div>
            <span className="text-[10px] text-txt3">Sur positions gagnantes</span>
          </div>

          {/* Max Drawdown */}
          <div className="bg-surface border border-border rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
            <span className="text-[11px] font-semibold uppercase text-txt3">Max Drawdown</span>
            <div className="my-1.5">
              <span className="text-2xl font-bold tracking-tight text-rose-500">
                -{sessionActive.maxDrawdownPourcentage}%
              </span>
            </div>
            <span className="text-[10px] text-txt3">Pertes maximales subies</span>
          </div>

          {/* Total Trades */}
          <div className="bg-surface border border-border rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
            <span className="text-[11px] font-semibold uppercase text-txt3">Total Trades</span>
            <div className="my-1.5">
              <span className="text-2xl font-bold tracking-tight text-txt">
                {sessionActive.totalTrades}
              </span>
            </div>
            <span className="text-[10px] text-txt3 flex items-center gap-1.5">
              <span className="text-emerald-500 font-semibold">{sessionActive.tradesGagnants}W</span>
              <span>/</span>
              <span className="text-rose-500 font-semibold">{sessionActive.tradesPerdants}L</span>
              {sessionActive.tradesBreakeven > 0 && (
                <>
                  <span>/</span>
                  <span className="text-txt3">{sessionActive.tradesBreakeven}BE</span>
                </>
              )}
            </span>
          </div>
        </div>
      ) : (
        <div className="bg-surface border border-dashed border-border rounded-xl p-8 text-center space-y-2">
          <span className="text-3xl">📊</span>
          <h3 className="text-sm font-semibold text-txt">Aucune session de simulation enregistrée</h3>
          <p className="text-xs text-txt3 max-w-md mx-auto">
            Sélectionnez vos paramètres ci-dessus et cliquez sur <strong>"Lancer le Backtest du Bot"</strong> pour générer votre premier journal de trading automatisé.
          </p>
        </div>
      )}

      {/* ─── Navigation par Onglets (Journal / Equity / Historique) ─────────── */}
      {sessionActive && (
        <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5 bg-surface2/50 flex-wrap gap-2">
            <div className="flex items-center gap-1.5">
              <button
                id="tab-journal-trades"
                onClick={() => setOngletVue('journal')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5',
                  ongletVue === 'journal'
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-txt3 hover:text-txt hover:bg-surface2'
                )}
              >
                <span>📋</span>
                <span>Journal des Trades ({sessionActive.totalTrades})</span>
              </button>

              <button
                id="tab-courbe-equity"
                onClick={() => setOngletVue('equity')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5',
                  ongletVue === 'equity'
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-txt3 hover:text-txt hover:bg-surface2'
                )}
              >
                <span>📈</span>
                <span>Courbe d'Équité</span>
              </button>

              <button
                id="tab-historique-sessions"
                onClick={() => setOngletVue('historique')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5',
                  ongletVue === 'historique'
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-txt3 hover:text-txt hover:bg-surface2'
                )}
              >
                <span>📜</span>
                <span>Sessions Précédentes ({sessions.length})</span>
              </button>
            </div>

            {/* Actions rapides à droite */}
            <div className="flex items-center gap-2">
              <button
                onClick={exporterCsvTrades}
                className="px-2.5 py-1 bg-surface border border-border rounded-md text-[11px] font-medium text-txt2 hover:text-txt hover:border-accent transition-colors flex items-center gap-1"
                title="Exporter tous les trades de cette session en CSV"
              >
                <span>📄</span>
                <span>Export CSV</span>
              </button>
              <span className="text-[11px] text-txt3">
                {new Date(sessionActive.dateExecution).toLocaleString('fr-FR')}
              </span>
            </div>
          </div>

          {/* ─── VUE 1 : JOURNAL DES TRADES DU BOT ─────────────────────────── */}
          {ongletVue === 'journal' && (
            <div className="p-4 space-y-3">
              {/* Filtres de recherche du tableau */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-1 bg-surface2 p-1 rounded-lg border border-border w-full sm:w-auto">
                  <button
                    onClick={() => setFiltreResultat('tous')}
                    className={cn(
                      'px-2.5 py-1 rounded-md text-xs font-medium transition-all',
                      filtreResultat === 'tous' ? 'bg-surface text-txt shadow-xs' : 'text-txt3 hover:text-txt'
                    )}
                  >
                    Tous ({sessionActive.trades.length})
                  </button>
                  <button
                    onClick={() => setFiltreResultat('win')}
                    className={cn(
                      'px-2.5 py-1 rounded-md text-xs font-medium transition-all text-emerald-500',
                      filtreResultat === 'win' ? 'bg-surface shadow-xs font-semibold' : 'opacity-70 hover:opacity-100'
                    )}
                  >
                    Gagnants ({sessionActive.tradesGagnants})
                  </button>
                  <button
                    onClick={() => setFiltreResultat('loss')}
                    className={cn(
                      'px-2.5 py-1 rounded-md text-xs font-medium transition-all text-rose-500',
                      filtreResultat === 'loss' ? 'bg-surface shadow-xs font-semibold' : 'opacity-70 hover:opacity-100'
                    )}
                  >
                    Perdants ({sessionActive.tradesPerdants})
                  </button>
                </div>

                <div className="relative w-full sm:w-64">
                  <input
                    type="text"
                    placeholder="Filtrer par direction, palier..."
                    value={rechercheTrade}
                    onChange={(e) => setRechercheTrade(e.target.value)}
                    className="w-full bg-bg border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-txt outline-none focus:border-accent transition-colors"
                  />
                  <span className="absolute left-2.5 top-2 text-txt3 text-xs">🔍</span>
                </div>
              </div>

              {/* Tableau interactif des trades avec Replay Link */}
              <div className="overflow-x-auto border border-border rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface2 text-txt3 font-semibold uppercase text-[10px] border-b border-border">
                    <tr>
                      <th className="py-2.5 px-3">Date / Entrée</th>
                      <th className="py-2.5 px-3">Direction</th>
                      <th className="py-2.5 px-3">Prix Entrée</th>
                      <th className="py-2.5 px-3">Stop Loss</th>
                      <th className="py-2.5 px-3">Take Profit</th>
                      <th className="py-2.5 px-3">R:R</th>
                      <th className="py-2.5 px-3">Résultat</th>
                      <th className="py-2.5 px-3">Gain / Perte</th>
                      <th className="py-2.5 px-3">Détails Bot</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {tradesFiltres.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-6 text-center text-txt3 text-xs">
                          Aucun trade ne correspond aux critères de filtre.
                        </td>
                      </tr>
                    ) : (
                      tradesFiltres.map((t) => {
                        const estGagnant = t.resultat === 'win';
                        const estPerdant = t.resultat === 'loss';

                        return (
                          <tr
                            key={t.id}
                            onClick={() => setTradeSelectionne(t)}
                            className="hover:bg-surface2/60 cursor-pointer transition-colors"
                          >
                            <td className="py-2 px-3 font-mono text-[11px] text-txt2 whitespace-nowrap">
                              {t.dateEntree}
                            </td>
                            <td className="py-2 px-3">
                              <span
                                className={cn(
                                  'px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase',
                                  t.direction === 'long'
                                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                    : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                                )}
                              >
                                {t.direction === 'long' ? '▲ LONG' : '▼ SHORT'}
                              </span>
                            </td>
                            <td className="py-2 px-3 font-mono font-medium text-txt">
                              {t.prixEntree}
                            </td>
                            <td className="py-2 px-3 font-mono text-rose-400">
                              {t.stopLoss}
                            </td>
                            <td className="py-2 px-3 font-mono text-emerald-400">
                              {t.takeProfit}
                            </td>
                            <td className="py-2 px-3 font-mono font-semibold text-accent">
                              1:{t.ratioRR}
                            </td>
                            <td className="py-2 px-3">
                              <span
                                className={cn(
                                  'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase',
                                  estGagnant
                                    ? 'bg-emerald-500/15 text-emerald-500'
                                    : estPerdant
                                    ? 'bg-rose-500/15 text-rose-500'
                                    : 'bg-surface2 text-txt3'
                                )}
                              >
                                {estGagnant ? '✅ TP Touché' : estPerdant ? '❌ SL Touché' : '⚪ Breakeven'}
                              </span>
                            </td>
                            <td
                              className={cn(
                                'py-2 px-3 font-mono font-bold whitespace-nowrap',
                                t.pnlMontant > 0
                                  ? 'text-emerald-500'
                                  : t.pnlMontant < 0
                                  ? 'text-rose-500'
                                  : 'text-txt3'
                              )}
                            >
                              {t.pnlMontant > 0 ? '+' : ''}
                              {t.pnlMontant} $ ({t.pnlPourcentage > 0 ? '+' : ''}
                              {t.pnlPourcentage}%)
                            </td>
                            <td className="py-2 px-3 text-txt3 text-[11px] truncate max-w-xs">
                              {t.commentaire || '-'}
                            </td>
                            <td className="py-2 px-3 text-right">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  voirTradeSurGraphique(t);
                                }}
                                className="px-2 py-1 bg-surface2 hover:bg-accent hover:text-white rounded text-[11px] font-semibold text-txt2 transition-all flex items-center gap-1 ml-auto shadow-2xs"
                                title="Visualiser l'entrée et l'autoroute UOP directement sur le graphique Replay"
                              >
                                <span>🎯</span>
                                <span className="hidden sm:inline">Replay</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─── VUE 2 : COURBE D'ÉQUITÉ (EQUITY CURVE) ───────────────────── */}
          {ongletVue === 'equity' && (
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-txt">Évolution du Capital dans le Temps</h3>
                  <p className="text-xs text-txt3">
                    Capital de départ : {sessionActive.capitalInitial} $ · Capital final : {sessionActive.capitalFinal} $
                  </p>
                </div>
                <span
                  className={cn(
                    'text-sm font-bold font-mono',
                    sessionActive.pnlNetMontant >= 0 ? 'text-emerald-500' : 'text-rose-500'
                  )}
                >
                  {sessionActive.pnlNetMontant >= 0 ? '+' : ''}
                  {sessionActive.pnlNetMontant} $ ({sessionActive.pnlNetPourcentage}%)
                </span>
              </div>

              {/* Graphique SVG responsive de la Courbe d'Équité */}
              <div className="h-64 w-full bg-bg border border-border rounded-xl p-4 flex items-center justify-center relative overflow-hidden">
                <CourbeEquitySvg courbe={sessionActive.courbeEquity} capitalInitial={sessionActive.capitalInitial} />
              </div>
            </div>
          )}

          {/* ─── VUE 3 : HISTORIQUE DES SESSIONS DE BOTS ──────────────────── */}
          {ongletVue === 'historique' && (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2.5">
                <span className="text-xs text-txt3">
                  Toutes les sessions de backtest sont persistées localement (Offline-First).
                </span>
                {sessions.length > 0 && (
                  <button
                    onClick={() => {
                      if (window.confirm('Voulez-vous supprimer tout l\'historique des sessions de bots ?')) {
                        effacerToutesLesSessions();
                      }
                    }}
                    className="text-xs text-rose-500 hover:underline"
                  >
                    Effacer tout l'historique
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {sessions.map((s) => {
                  const estActive = s.id === sessionActive.id;

                  return (
                    <div
                      key={s.id}
                      onClick={() => selectionnerSession(s.id)}
                      className={cn(
                        'flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border transition-all cursor-pointer gap-2',
                        estActive
                          ? 'bg-accent/10 border-accent/40 shadow-xs'
                          : 'bg-surface2/60 border-border hover:bg-surface2'
                      )}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-txt">{s.botNom}</span>
                          <span className="text-[10px] bg-surface px-2 py-0.5 rounded border border-border text-txt2">
                            {s.paire} · {s.timeframe}
                          </span>
                          {estActive && (
                            <span className="text-[10px] bg-accent text-white px-2 py-0.5 rounded-full font-semibold">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-txt3">
                          {new Date(s.dateExecution).toLocaleString('fr-FR')} · {s.totalTrades} trades pris
                        </p>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-xs font-bold text-txt">
                            Win Rate : <span className="text-emerald-500">{s.winratePourcentage}%</span>
                          </div>
                          <div
                            className={cn(
                              'text-[11px] font-mono font-semibold',
                              s.pnlNetMontant >= 0 ? 'text-emerald-500' : 'text-rose-500'
                            )}
                          >
                            {s.pnlNetMontant >= 0 ? '+' : ''}
                            {s.pnlNetMontant} $ ({s.pnlNetPourcentage}%)
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            supprimerSession(s.id);
                          }}
                          className="w-7 h-7 flex items-center justify-center text-txt3 hover:text-rose-500 hover:bg-rose-500/10 rounded-md transition-colors"
                          title="Supprimer cette session"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Modale d'inspection d'un trade du Bot (Option B) ────────────────── */}
      {tradeSelectionne && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setTradeSelectionne(null)}
        >
          <div
            className="bg-surface border border-border rounded-xl p-5 max-w-lg w-full space-y-4 shadow-xl text-txt"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🤖</span>
                <h3 className="font-bold text-sm">Détail du Trade Simulé par le Bot</h3>
              </div>
              <button
                onClick={() => setTradeSelectionne(null)}
                className="w-7 h-7 rounded-md hover:bg-surface2 text-txt3 hover:text-txt flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-surface2 p-3 rounded-lg border border-border">
                <div>
                  <span className="text-txt3 text-[10px] uppercase font-semibold">Direction</span>
                  <p className="font-bold text-xs uppercase mt-0.5">
                    {tradeSelectionne.direction === 'long' ? '▲ ACHAT / LONG' : '▼ VENTE / SHORT'}
                  </p>
                </div>
                <div>
                  <span className="text-txt3 text-[10px] uppercase font-semibold">Résultat</span>
                  <p
                    className={cn(
                      'font-bold text-xs mt-0.5',
                      tradeSelectionne.resultat === 'win' ? 'text-emerald-500' : 'text-rose-500'
                    )}
                  >
                    {tradeSelectionne.resultat === 'win' ? '✅ Gain (TP Touché)' : '❌ Perte (SL Touché)'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="bg-surface2/60 p-2.5 rounded-lg border border-border">
                  <span className="text-txt3 text-[10px]">Prix Entrée</span>
                  <p className="font-mono font-semibold text-txt mt-0.5">{tradeSelectionne.prixEntree}</p>
                </div>
                <div className="bg-surface2/60 p-2.5 rounded-lg border border-border">
                  <span className="text-txt3 text-[10px]">Stop Loss</span>
                  <p className="font-mono font-semibold text-rose-400 mt-0.5">{tradeSelectionne.stopLoss}</p>
                </div>
                <div className="bg-surface2/60 p-2.5 rounded-lg border border-border">
                  <span className="text-txt3 text-[10px]">Take Profit</span>
                  <p className="font-mono font-semibold text-emerald-400 mt-0.5">{tradeSelectionne.takeProfit}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-surface2/60 p-2.5 rounded-lg border border-border">
                  <span className="text-txt3 text-[10px]">Ratio R:R Réalisé</span>
                  <p className="font-mono font-bold text-accent mt-0.5">1:{tradeSelectionne.ratioRR}</p>
                </div>
                <div className="bg-surface2/60 p-2.5 rounded-lg border border-border">
                  <span className="text-txt3 text-[10px]">PnL Net</span>
                  <p
                    className={cn(
                      'font-mono font-bold mt-0.5',
                      tradeSelectionne.pnlMontant >= 0 ? 'text-emerald-500' : 'text-rose-500'
                    )}
                  >
                    {tradeSelectionne.pnlMontant >= 0 ? '+' : ''}
                    {tradeSelectionne.pnlMontant} $ ({tradeSelectionne.pnlPourcentage}%)
                  </p>
                </div>
              </div>

              <div className="bg-surface2/60 p-3 rounded-lg border border-border space-y-1">
                <span className="text-txt3 text-[10px] uppercase font-semibold">Analyse de l'Orchestrateur</span>
                <p className="text-txt text-xs">{tradeSelectionne.commentaire || 'Aucun commentaire.'}</p>
              </div>
            </div>

            {/* Actions de l'Option B : Replay & Copie Journal */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-border/80">
              <button
                onClick={() => copierVersJournalManuel(tradeSelectionne)}
                className="w-full sm:w-auto px-3 py-2 bg-surface2 hover:bg-surface2/80 rounded-lg text-xs font-semibold text-txt transition-colors flex items-center justify-center gap-1.5"
                title="Ajouter ce trade dans votre Journal de trading principal"
              >
                <span>📋</span>
                <span>Copier dans mon Journal</span>
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  onClick={() => voirTradeSurGraphique(tradeSelectionne)}
                  className="w-full sm:w-auto px-3.5 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-sm"
                  title="Caler le graphique Replay sur ce setup"
                >
                  <span>🎯</span>
                  <span>Voir sur le Graphique Replay</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * ──────────────────────────────────────────────────────────────────────────────
 * 📈 GRAPHIQUE SVG DE LA COURBE D'ÉQUITÉ
 * ──────────────────────────────────────────────────────────────────────────────
 * Trace la ligne d'évolution du capital trade après trade avec un gradient élégant.
 */
function CourbeEquitySvg({
  courbe,
  capitalInitial,
}: {
  courbe: Array<{ date: string; capital: number }>;
  capitalInitial: number;
}) {
  if (!courbe || courbe.length < 2) {
    return (
      <div className="text-txt3 text-xs">
        Pas assez de points d'équité pour tracer le graphique.
      </div>
    );
  }

  const valeurs = courbe.map((c) => c.capital);
  const minVal = Math.min(...valeurs, capitalInitial * 0.95);
  const maxVal = Math.max(...valeurs, capitalInitial * 1.05);
  const range = Math.max(1, maxVal - minVal);

  const largeurSvg = 800;
  const hauteurSvg = 200;
  const paddingH = 30;
  const paddingV = 20;

  const points = courbe.map((c, i) => {
    const x = paddingH + (i / (courbe.length - 1)) * (largeurSvg - 2 * paddingH);
    const y = hauteurSvg - paddingV - ((c.capital - minVal) / range) * (hauteurSvg - 2 * paddingV);
    return { x, y, capital: c.capital };
  });

  const pathD = points.reduce((acc, p, i) => {
    return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, '');

  const yBase =
    hauteurSvg - paddingV - ((capitalInitial - minVal) / range) * (hauteurSvg - 2 * paddingV);

  const premierPoint = points[0];
  const dernierPoint = points[points.length - 1];
  const areaD = `${pathD} L ${dernierPoint.x} ${hauteurSvg - paddingV} L ${premierPoint.x} ${hauteurSvg - paddingV} Z`;

  const capitalFinal = courbe[courbe.length - 1].capital;
  const estPositif = capitalFinal >= capitalInitial;
  const couleurLigne = estPositif ? '#10b981' : '#f43f5e';

  return (
    <svg
      viewBox={`0 0 ${largeurSvg} ${hauteurSvg}`}
      className="w-full h-full overflow-visible"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={couleurLigne} stopOpacity="0.25" />
          <stop offset="100%" stopColor={couleurLigne} stopOpacity="0.0" />
        </linearGradient>
      </defs>

      <line
        x1={paddingH}
        y1={yBase}
        x2={largeurSvg - paddingH}
        y2={yBase}
        stroke="#787b86"
        strokeDasharray="4 4"
        strokeOpacity="0.5"
        strokeWidth="1"
      />
      <text
        x={largeurSvg - paddingH + 5}
        y={yBase + 3}
        fill="#787b86"
        fontSize="10"
        fontFamily="monospace"
      >
        {capitalInitial} $
      </text>

      <path d={areaD} fill="url(#equityGradient)" />

      <path
        d={pathD}
        fill="none"
        stroke={couleurLigne}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <circle
        cx={dernierPoint.x}
        cy={dernierPoint.y}
        r="4"
        fill={couleurLigne}
      />
    </svg>
  );
}
