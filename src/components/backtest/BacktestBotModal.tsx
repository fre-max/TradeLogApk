import React, { useState, useEffect, useRef } from 'react';
import type { Bougie } from '@/lib/chartDataHelper';
import type { TradingBot, RapportPerformance } from '@/types/bot';
import type { VariableExterneDef } from '@/types/indicatorScript';
import {
  recupererBotsStockes,
  sauvegarderBotStocke,
  supprimerBotStocke,
  executerSimulationBatch,
  BOTS_PAR_DEFAUT,
} from '@/lib/bot/botEngine';
import { convertirScriptTypeScriptEnJavaScript } from '@/lib/indicators/indicatorEngine';
import { VariablesConfigPanel } from './VariablesConfigPanel';

interface BacktestBotModalProps {
  isOpen: boolean;
  onClose: () => void;
  bougies: Bougie[];
  onLancerReplayVisuel: (bot: TradingBot) => void;
  idInitialBotSelectionne?: string | null;
  ongletInitial?: 'bibliotheque' | 'configuration' | 'editeur' | 'rapport';
}

/**
 * Modale Studio de Bots de Trading pour Backtest.
 * Permet de gérer, importer, éditer et tester des algorithmes de trading
 * sans jamais recompiler l'APK.
 * 
 * Exemple :
 * <BacktestBotModal
 *   isOpen={estOuvert}
 *   onClose={() => setEstOuvert(false)}
 *   bougies={bougiesM1}
 *   onLancerReplayVisuel={(bot) => lancerSimulationVisuelle(bot)}
 * />
 */
export const BacktestBotModal: React.FC<BacktestBotModalProps> = ({
  isOpen,
  onClose,
  bougies,
  onLancerReplayVisuel,
  idInitialBotSelectionne,
  ongletInitial,
}) => {
  // Liste des bots disponibles
  const [bots, setBots] = useState<TradingBot[]>([]);
  // Bot actuellement sélectionné
  const [botSelectionne, setBotSelectionne] = useState<TradingBot | null>(null);
  // Onglet actif : 'bibliotheque' | 'configuration' | 'editeur' | 'rapport'
  const [ongletActif, setOngletActif] = useState<'bibliotheque' | 'configuration' | 'editeur' | 'rapport'>('bibliotheque');

  // Champs de l'éditeur
  const [nomBot, setNomBot] = useState('');
  const [descriptionBot, setDescriptionBot] = useState('');
  const [codeBot, setCodeBot] = useState('');
  const [ratioRR, setRatioRR] = useState(2.0);
  const [risquePourcent, setRisquePourcent] = useState(1.0);
  const [capitalSimulation, setCapitalSimulation] = useState(10000);

  // Rapport de simulation batch
  const [rapportActuel, setRapportActuel] = useState<RapportPerformance | null>(null);
  const [enSimulation, setEnSimulation] = useState(false);
  const [messageNotification, setMessageNotification] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Charge les bots à l'ouverture
  useEffect(() => {
    if (isOpen) {
      const botsCharges = recupererBotsStockes();
      setBots(botsCharges);
      if (idInitialBotSelectionne) {
        const trouve = botsCharges.find((b) => b.id === idInitialBotSelectionne);
        if (trouve) {
          selectionnerBot(trouve);
          if (ongletInitial) setOngletActif(ongletInitial);
          return;
        }
      }
      if (botsCharges.length > 0 && !botSelectionne) {
        selectionnerBot(botsCharges[0]);
      }
      if (ongletInitial) {
        setOngletActif(ongletInitial);
      }
    }
  }, [isOpen, idInitialBotSelectionne, ongletInitial]);

  // Sélectionne un bot et remplit les champs de l'éditeur
  const selectionnerBot = (bot: TradingBot) => {
    setBotSelectionne(bot);
    setNomBot(bot.nom);
    setDescriptionBot(bot.description || '');
    setCodeBot(bot.code);
    setRatioRR(Number(bot.parametres.ratioRR || 2.0));
    setRisquePourcent(Number(bot.parametres.risquePourcent || 1.0));
  };

  // ⚙️ Met à jour les variables externes du bot en direct
  const mettreAJourParametresBot = (nouveauxParams: Record<string, any>) => {
    if (!botSelectionne) return;

    const botAJour: TradingBot = {
      ...botSelectionne,
      parametres: nouveauxParams,
      misAJourLe: new Date().toISOString(),
    };

    setBotSelectionne(botAJour);
    setRatioRR(Number(nouveauxParams.ratioRR || 2.0));
    setRisquePourcent(Number(nouveauxParams.risquePourcent || 1.0));
    sauvegarderBotStocke(botAJour);
    setBots((prev) => prev.map((b) => (b.id === botAJour.id ? botAJour : b)));
  };

  // 💾 Enregistre avec confirmation
  const enregistrerParametresBot = () => {
    afficherNotification('✅ Paramètres du bot enregistrés avec succès !');
  };

  // 🔄 Rétablit les paramètres par défaut du bot sélectionné
  const reinitialiserParametresBot = () => {
    if (!botSelectionne) return;

    const officiel = BOTS_PAR_DEFAUT.find((d) => d.id === botSelectionne.id);
    let paramsParDefaut: Record<string, any> = {};

    if (officiel) {
      paramsParDefaut = { ...officiel.parametres };
    } else if (botSelectionne.definitionsVariables) {
      for (const def of botSelectionne.definitionsVariables) {
        paramsParDefaut[def.cle] = def.valeurParDefaut;
      }
    }

    mettreAJourParametresBot(paramsParDefaut);
    afficherNotification('🔄 Paramètres réinitialisés aux valeurs par défaut.');
  };

  // ➕ Ajoute une nouvelle variable externe à la configuration du bot
  const ajouterNouvelleVariableBot = (nouvelleDef: VariableExterneDef) => {
    if (!botSelectionne) return;

    const defsActuelles = botSelectionne.definitionsVariables || [];
    const botAJour: TradingBot = {
      ...botSelectionne,
      definitionsVariables: [...defsActuelles, nouvelleDef],
      misAJourLe: new Date().toISOString(),
    };

    setBotSelectionne(botAJour);
    sauvegarderBotStocke(botAJour);
    setBots((prev) => prev.map((b) => (b.id === botAJour.id ? botAJour : b)));
    afficherNotification(`➕ Variable "${nouvelleDef.label}" ajoutée au bot !`);
  };

  // Notification temporaire
  const afficherNotification = (msg: string) => {
    setMessageNotification(msg);
    setTimeout(() => setMessageNotification(null), 3000);
  };

  // 1️⃣ Créer un nouveau bot
  const creerNouveauBot = () => {
    const nouveau: TradingBot = {
      id: `bot-custom-${Date.now()}`,
      nom: 'Nouveau Bot Personnalisé',
      description: 'Stratégie sur mesure',
      code: `/**
 * Mon Bot Personnalisé
 */
return {
  onBar: function(contexte) {
    const { bougie, indicateurs, positionActive, parametres } = contexte;
    if (positionActive) return null;

    // Exemple : Achat si la bougie est haussière et que le SMC détecte un OB
    if (bougie.close > bougie.open) {
      // return { action: 'BUY', stopLoss: bougie.low, takeProfit: bougie.close + 0.0010 };
    }

    return null;
  }
};`,
      parametres: {
        ratioRR: 2.0,
        risquePourcent: 1.0,
      },
      actif: true,
      creeLe: new Date().toISOString(),
      misAJourLe: new Date().toISOString(),
    };

    sauvegarderBotStocke(nouveau);
    const listeAjour = recupererBotsStockes();
    setBots(listeAjour);
    selectionnerBot(nouveau);
    setOngletActif('editeur');
    afficherNotification('Nouveau bot créé ! Modifiez le code et sauvegardez.');
  };

  // 2️⃣ Sauvegarder les modifications du bot sélectionné
  const sauvegarderModifications = () => {
    if (!botSelectionne) return;

    const botModifie: TradingBot = {
      ...botSelectionne,
      nom: nomBot,
      description: descriptionBot,
      code: codeBot,
      parametres: {
        ...botSelectionne.parametres,
        ratioRR: ratioRR,
        risquePourcent: risquePourcent,
      },
      misAJourLe: new Date().toISOString(),
    };

    sauvegarderBotStocke(botModifie);
    const listeAjour = recupererBotsStockes();
    setBots(listeAjour);
    setBotSelectionne(botModifie);
    afficherNotification('✅ Modifications sauvegardées avec succès.');
  };

  // 3️⃣ Supprimer le bot sélectionné
  const supprimerBot = (botId: string) => {
    if (bots.length <= 1) {
      afficherNotification('⚠️ Impossible de supprimer le dernier bot.');
      return;
    }
    supprimerBotStocke(botId);
    const listeAjour = recupererBotsStockes();
    setBots(listeAjour);
    if (listeAjour.length > 0) {
      selectionnerBot(listeAjour[0]);
    }
    afficherNotification('🗑️ Bot supprimé.');
  };

  // 4️⃣ Importer un fichier JavaScript de bot (.js ou .json)
  const gererImportFichier = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const lecteur = new FileReader();
    lecteur.onload = (event) => {
      try {
        const contenu = event.target?.result as string;
        if (!contenu) return;

        let nouveauBot: TradingBot;

        // Si le fichier est un JSON exporté
        if (file.name.endsWith('.json')) {
          const objet = JSON.parse(contenu);
          nouveauBot = {
            id: `bot-import-${Date.now()}`,
            nom: objet.nom || file.name.replace('.json', ''),
            description: objet.description || 'Bot importé depuis fichier JSON',
            code: objet.code ? convertirScriptTypeScriptEnJavaScript(objet.code) : '',
            parametres: objet.parametres || { ratioRR: 2.0, risquePourcent: 1.0 },
            definitionsVariables: objet.definitionsVariables,
            actif: true,
            creeLe: new Date().toISOString(),
            misAJourLe: new Date().toISOString(),
          };
        } else {
          // Si le fichier est un script .js, .ts, .tsx ou .txt
          const codeExecutable = convertirScriptTypeScriptEnJavaScript(contenu);
          const nomNettoye = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
          const estTS = file.name.endsWith('.ts') || file.name.endsWith('.tsx');

          nouveauBot = {
            id: `bot-import-${Date.now()}`,
            nom: nomNettoye || 'Bot Importé',
            description: estTS ? 'Bot TypeScript converti et importé avec succès' : 'Bot importé depuis fichier JS',
            code: codeExecutable,
            parametres: { ratioRR: 2.0, risquePourcent: 1.0 },
            actif: true,
            creeLe: new Date().toISOString(),
            misAJourLe: new Date().toISOString(),
          };
        }

        sauvegarderBotStocke(nouveauBot);
        const listeAjour = recupererBotsStockes();
        setBots(listeAjour);
        selectionnerBot(nouveauBot);
        setOngletActif('editeur');
        afficherNotification(`✅ Bot "${nouveauBot.nom}" importé avec succès !`);
      } catch (err: any) {
        afficherNotification(`❌ Erreur d'importation : ${err.message}`);
      }
    };
    lecteur.readAsText(file);
    e.target.value = '';
  };

  // 5️⃣ Exporter le script du bot en fichier téléchargeable
  const exporterBot = (bot: TradingBot) => {
    try {
      const blob = new Blob([bot.code], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${bot.nom.toLowerCase().replace(/[^a-z0-9]/g, '_')}.js`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      afficherNotification('📥 Script exporté en téléchargement.');
    } catch (err: any) {
      afficherNotification(`Erreur d'export : ${err.message}`);
    }
  };

  // 6️⃣ Lancer le Backtest Éclair (Batch Simulation)
  const lancerBacktestEclair = () => {
    if (!botSelectionne) return;
    if (bougies.length < 10) {
      afficherNotification('⚠️ Veuillez charger au moins 50 bougies dans le graphique.');
      return;
    }

    setEnSimulation(true);
    // Petit timeout pour laisser l'interface respirer avant le calcul intensif
    setTimeout(() => {
      try {
        const rapport = executerSimulationBatch(botSelectionne, bougies, {
          capitalInitial: capitalSimulation,
          risquePourcent: Number(botSelectionne.parametres.risquePourcent || 1.0),
        });
        setRapportActuel(rapport);
        setOngletActif('rapport');
        afficherNotification(`⚡ Simulation terminée : ${rapport.totalTrades} trades testés.`);
      } catch (err: any) {
        afficherNotification(`❌ Erreur lors du backtest : ${err.message}`);
      } finally {
        setEnSimulation(false);
      }
    }, 50);
  };

  // 7️⃣ Démarrer le Replay Visuel avec ce bot
  const demarrerReplayVisuel = () => {
    if (!botSelectionne) return;
    onLancerReplayVisuel(botSelectionne);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex flex-col w-full sm:max-w-4xl h-[100dvh] sm:h-auto sm:max-h-[92vh] bg-[#131722] border-0 sm:border border-[#2a2e39] rounded-none sm:rounded-2xl shadow-2xl overflow-hidden text-slate-100">
        
        {/* ── En-tête de la Modale ── */}
        <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 border-b border-[#2a2e39] bg-[#1e222d] shrink-0">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <span className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 text-sm sm:text-base bg-emerald-950/80 border border-emerald-500/40 rounded-xl shrink-0">
              🤖
            </span>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold tracking-wide text-white flex items-center gap-1.5 sm:gap-2 truncate">
                <span>Studio de Bots</span>
                <span className="hidden sm:inline-flex text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono border border-emerald-500/30">
                  Sans Recompilation
                </span>
              </h2>
              <p className="text-[10px] sm:text-[11px] text-slate-400 truncate hidden xs:block sm:block">
                Créez, importez (.js) et backtestez des stratégies automatisées avec SMC & Swings
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors shrink-0"
            title="Fermer"
          >
            ✕
          </button>
        </div>

        {/* ── Navigation des Onglets (Scrollable horizontalement sur smartphone) ── */}
        <div className="flex items-center justify-between border-b border-[#2a2e39] px-2 sm:px-4 bg-[#181b24] shrink-0 overflow-x-auto no-scrollbar gap-2">
          <div className="flex gap-1 shrink-0">
            <button
              onClick={() => setOngletActif('bibliotheque')}
              className={`px-2.5 sm:px-3.5 py-2 sm:py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
                ongletActif === 'bibliotheque'
                  ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>📚 Bibliothèque</span>
              <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-slate-800 text-slate-300 font-mono">
                {bots.length}
              </span>
            </button>

            <button
              onClick={() => setOngletActif('configuration')}
              className={`px-2.5 sm:px-3.5 py-2 sm:py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
                ongletActif === 'configuration'
                  ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>⚙️ Config<span className="hidden sm:inline"> (Variables)</span></span>
              {botSelectionne && (
                <span className="text-[10px] text-emerald-400/80 max-w-[100px] truncate hidden md:inline font-mono">
                  ({botSelectionne.nom})
                </span>
              )}
            </button>

            <button
              onClick={() => setOngletActif('editeur')}
              className={`px-2.5 sm:px-3.5 py-2 sm:py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
                ongletActif === 'editeur'
                  ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>💻 Code JS</span>
            </button>

            <button
              onClick={() => setOngletActif('rapport')}
              className={`px-2.5 sm:px-3.5 py-2 sm:py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
                ongletActif === 'rapport'
                  ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>📊 Rapport</span>
              {rapportActuel && (
                <span className={`px-1.5 py-0.2 text-[10px] rounded-full font-bold font-mono ${
                  rapportActuel.pnlNetMontant >= 0 ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                }`}>
                  {rapportActuel.pnlNetMontant >= 0 ? '+' : ''}{rapportActuel.pnlNetPourcentage}%
                </span>
              )}
            </button>
          </div>

          {/* Action rapide : Lancer le backtest éclair directement */}
          {botSelectionne && (
            <div className="flex items-center gap-1.5 sm:gap-2 py-1.5 shrink-0">
              <button
                onClick={lancerBacktestEclair}
                disabled={enSimulation}
                className="px-2.5 sm:px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow transition-all active:scale-95 flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap"
                title="Simuler toutes les bougies en mémoire en moins d'une seconde"
              >
                {enSimulation ? (
                  <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : '⚡'}
                <span>Test<span className="hidden sm:inline"> Éclair</span></span>
              </button>

              <button
                onClick={demarrerReplayVisuel}
                className="px-2.5 sm:px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-lg shadow transition-all active:scale-95 flex items-center gap-1.5 whitespace-nowrap"
                title="Lancer le replay visuel sur le graphique avec ce bot"
              >
                <span>▶️</span>
                <span>Replay<span className="hidden sm:inline"> Visuel</span></span>
              </button>
            </div>
          )}
        </div>

        {/* Message de notification temporaire */}
        {messageNotification && (
          <div className="px-4 py-1.5 bg-emerald-950/80 border-b border-emerald-500/40 text-emerald-300 text-xs font-medium flex items-center gap-2">
            <span>ℹ️</span>
            <span>{messageNotification}</span>
          </div>
        )}

        {/* ── Contenu Principal selon l'onglet ── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* ══════════════════════════════════════════════════════════ */}
          {/* ONGLET 1 : BIBLIOTHÈQUE DE BOTS                          */}
          {/* ══════════════════════════════════════════════════════════ */}
          {ongletActif === 'bibliotheque' && (
            <div className="space-y-4">
              
              {/* Barre d'outils de la bibliothèque */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-[#1e222d] border border-[#2a2e39] rounded-xl">
                <div className="flex items-center gap-2">
                  <button
                    onClick={creerNouveauBot}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow"
                  >
                    <span>➕</span>
                    <span>Créer un Bot</span>
                  </button>

                  <input
                    type="file"
                    accept=".js,.ts,.tsx,.json,.txt,text/*,application/javascript,*/*"
                    ref={fileInputRef}
                    onChange={gererImportFichier}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
                    title="Importer un fichier (.js, .ts, .json, .txt) depuis votre smartphone"
                  >
                    <span>📥</span>
                    <span>Importer</span>
                  </button>
                </div>

                <div className="text-[11px] text-slate-400">
                  {bougies.length} bougies disponibles pour le test
                </div>
              </div>

              {/* Grille de cartes des bots */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {bots.map((bot) => {
                  const estChoisi = botSelectionne?.id === bot.id;
                  return (
                    <div
                      key={bot.id}
                      onClick={() => selectionnerBot(bot)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                        estChoisi
                          ? 'bg-emerald-950/20 border-emerald-500/80 shadow-lg shadow-emerald-950/40 ring-1 ring-emerald-500/50'
                          : 'bg-[#181b24] border-[#2a2e39] hover:border-slate-600'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                              <span>🤖</span>
                              <span>{bot.nom}</span>
                            </h3>
                            <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                              {bot.description || 'Aucune description fournie.'}
                            </p>
                          </div>
                          {estChoisi && (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 whitespace-nowrap">
                              Sélectionné
                            </span>
                          )}
                        </div>

                        {/* Badges de paramètres */}
                        <div className="flex flex-wrap items-center gap-2 mt-3 pt-2 border-t border-[#2a2e39]/60 text-[10px] text-slate-400 font-mono">
                          <span className="px-2 py-0.5 rounded bg-[#1e222d] border border-[#2a2e39]">
                            R:R = {String(bot.parametres.ratioRR || 2.0)}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-[#1e222d] border border-[#2a2e39]">
                            Risque = {String(bot.parametres.risquePourcent || 1.0)}%
                          </span>
                        </div>
                      </div>

                      {/* Actions par carte (Responsive flex-wrap) */}
                      <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-[#2a2e39]/60 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              selectionnerBot(bot);
                              setOngletActif('configuration');
                            }}
                            className="px-2.5 py-1 rounded-lg font-semibold text-[11px] bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-600/50 transition-all flex items-center gap-1 shadow-sm active:scale-95"
                            title="Configurer les variables externes (inputs) de ce bot"
                          >
                            <span>⚙️ Configurer</span>
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              selectionnerBot(bot);
                              setOngletActif('editeur');
                            }}
                            className="p-1 text-slate-400 hover:text-emerald-300 rounded hover:bg-slate-800 text-[11px] font-medium flex items-center gap-1 active:scale-95"
                            title="Voir et modifier le script JS"
                          >
                            <span>💻 Code</span>
                          </button>
                        </div>

                        <div className="flex items-center gap-1 flex-wrap">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              exporterBot(bot);
                            }}
                            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
                            title="Télécharger le fichier .js"
                          >
                            📤
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              supprimerBot(bot.id);
                            }}
                            className="p-1 text-rose-400 hover:text-rose-300 rounded hover:bg-rose-950/30"
                            title="Supprimer ce bot"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════ */}
          {/* ONGLET 2 : CONFIGURATION DES VARIABLES EXTERNES (INPUTS)   */}
          {/* ══════════════════════════════════════════════════════════ */}
          {ongletActif === 'configuration' && botSelectionne && (
            <div className="space-y-4">
              {/* Sélecteur de bot actif + actions rapides */}
              <div className="flex items-center justify-between gap-3 p-3 bg-[#1e222d] border border-[#2a2e39] rounded-xl flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-medium">Stratégie sélectionnée :</span>
                  <select
                    value={botSelectionne.id}
                    onChange={(e) => {
                      const trouve = bots.find((b) => b.id === e.target.value);
                      if (trouve) selectionnerBot(trouve);
                    }}
                    className="bg-[#131722] border border-[#2a2e39] rounded-lg px-2.5 py-1 text-xs font-semibold text-emerald-400 outline-none"
                  >
                    {bots.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.nom}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={lancerBacktestEclair}
                    disabled={enSimulation}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <span>⚡ Test Éclair</span>
                  </button>

                  <button
                    onClick={() => setOngletActif('editeur')}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold rounded-lg transition-all flex items-center gap-1"
                    title="Voir ou éditer le code source JavaScript"
                  >
                    <span>💻 Code Source</span>
                  </button>
                </div>
              </div>

              {/* Formulaire visuel des variables externes du bot */}
              <VariablesConfigPanel
                titre={`Variables : ${botSelectionne.nom}`}
                sousTitre={botSelectionne.description || 'Ajustez le ratio R:R, risque et paramètres de stratégie'}
                parametres={botSelectionne.parametres || {}}
                definitions={botSelectionne.definitionsVariables}
                onChangeParametres={mettreAJourParametresBot}
                onEnregistrer={enregistrerParametresBot}
                onReinitialiser={reinitialiserParametresBot}
                onAjouterDefinition={ajouterNouvelleVariableBot}
                themeCouleur="emerald"
              />
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════ */}
          {/* ONGLET 3 : ÉDITEUR DE CODE & PARAMÈTRES                   */}
          {/* ══════════════════════════════════════════════════════════ */}
          {ongletActif === 'editeur' && (
            <div className="space-y-4">
              
              {/* Informations du bot */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-[#1e222d] border border-[#2a2e39] rounded-xl">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Nom du Bot
                  </label>
                  <input
                    type="text"
                    value={nomBot}
                    onChange={(e) => setNomBot(e.target.value)}
                    className="w-full bg-[#131722] border border-[#2a2e39] focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
                    placeholder="Ex: Mon Bot SMC..."
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Description de la stratégie
                  </label>
                  <input
                    type="text"
                    value={descriptionBot}
                    onChange={(e) => setDescriptionBot(e.target.value)}
                    className="w-full bg-[#131722] border border-[#2a2e39] focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
                    placeholder="Ex: Entre lors du retest OB après CHoCH..."
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Ratio Risque/Rendement (R:R) par défaut
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.5"
                    max="20"
                    value={ratioRR}
                    onChange={(e) => setRatioRR(Number(e.target.value))}
                    className="w-full bg-[#131722] border border-[#2a2e39] focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Risque par trade (% du capital)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="10"
                    value={risquePourcent}
                    onChange={(e) => setRisquePourcent(Number(e.target.value))}
                    className="w-full bg-[#131722] border border-[#2a2e39] focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none font-mono"
                  />
                </div>
              </div>

              {/* Zone de code source */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <span>⚡ Script JavaScript du Bot</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      (Exécuté en sandbox sécurisé)
                    </span>
                  </label>

                  <button
                    onClick={sauvegarderModifications}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow flex items-center gap-1.5"
                  >
                    <span>💾</span>
                    <span>Sauvegarder</span>
                  </button>
                </div>

                <textarea
                  value={codeBot}
                  onChange={(e) => setCodeBot(e.target.value)}
                  rows={10}
                  spellCheck={false}
                  className="w-full bg-[#0d1017] border border-[#2a2e39] focus:border-emerald-500 rounded-xl p-3 text-xs font-mono text-emerald-300 outline-none leading-relaxed resize-y shadow-inner sm:rows-[14]"
                />

                {/* Guide d'aide sur l'API */}
                <div className="p-3 bg-[#181b24] border border-[#2a2e39] rounded-xl text-[11px] space-y-1.5 text-slate-300">
                  <div className="font-bold text-white flex items-center gap-1">
                    <span>📖</span>
                    <span>Variables disponibles dans contexte :</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-400 font-mono text-[10px]">
                    <li><strong className="text-slate-200">contexte.bougie</strong> : {`{ open, high, low, close, time, volume }`}</li>
                    <li><strong className="text-slate-200">contexte.indicateurs.smc</strong> : {`{ orderBlocks, fvgs, chochs, bos, zoneActuelle }`}</li>
                    <li><strong className="text-slate-200">contexte.indicateurs.swings</strong> : {`{ swingsHigh, swingsLow, tendance }`}</li>
                    <li><strong className="text-slate-200">contexte.indicateurs.zigzag</strong> : {`{ pivots: [{ prix, index, type }] }`}</li>
                    <li><strong className="text-slate-200">contexte.positionActive</strong> : null si libre, sinon la position en cours</li>
                    <li><strong className="text-slate-200">Retour attendu</strong> : {`{ action: 'BUY' | 'SELL', stopLoss, takeProfit }`} ou null</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════ */}
          {/* ONGLET 3 : RAPPORT DE PERFORMANCE                        */}
          {/* ══════════════════════════════════════════════════════════ */}
          {ongletActif === 'rapport' && (
            <div className="space-y-4">
              {!rapportActuel ? (
                <div className="p-8 text-center bg-[#1e222d] border border-[#2a2e39] rounded-xl space-y-3">
                  <span className="text-3xl">📊</span>
                  <h3 className="text-sm font-bold text-white">Aucun rapport de simulation disponible</h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Sélectionnez un bot et cliquez sur « Test Éclair » pour simuler immédiatement des milliers de bougies et générer vos statistiques.
                  </p>
                  <button
                    onClick={lancerBacktestEclair}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
                  >
                    ⚡ Lancer le Test Éclair Maintenant
                  </button>
                </div>
              ) : (
                <>
                  {/* Cartes de métriques clés */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    
                    {/* Winrate */}
                    <div className="p-3 bg-[#1e222d] border border-[#2a2e39] rounded-xl">
                      <span className="text-[10px] text-slate-400 font-semibold block">Taux de Réussite (Winrate)</span>
                      <span className="text-lg font-bold text-emerald-400 font-mono">
                        {rapportActuel.winratePourcentage}%
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {rapportActuel.tradesGagnants}W / {rapportActuel.tradesPerdants}L
                      </span>
                    </div>

                    {/* Profit Factor */}
                    <div className="p-3 bg-[#1e222d] border border-[#2a2e39] rounded-xl">
                      <span className="text-[10px] text-slate-400 font-semibold block">Profit Factor</span>
                      <span className={`text-lg font-bold font-mono ${
                        rapportActuel.profitFactor >= 1.5 ? 'text-emerald-400' : rapportActuel.profitFactor >= 1.0 ? 'text-amber-400' : 'text-rose-400'
                      }`}>
                        {rapportActuel.profitFactor}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {rapportActuel.totalTrades} trades totaux
                      </span>
                    </div>

                    {/* PnL Net */}
                    <div className="p-3 bg-[#1e222d] border border-[#2a2e39] rounded-xl">
                      <span className="text-[10px] text-slate-400 font-semibold block">PnL Net</span>
                      <span className={`text-lg font-bold font-mono ${
                        rapportActuel.pnlNetMontant >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {rapportActuel.pnlNetMontant >= 0 ? '+' : ''}{rapportActuel.pnlNetMontant} $
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        ({rapportActuel.pnlNetPourcentage >= 0 ? '+' : ''}{rapportActuel.pnlNetPourcentage}%)
                      </span>
                    </div>

                    {/* Max Drawdown */}
                    <div className="p-3 bg-[#1e222d] border border-[#2a2e39] rounded-xl">
                      <span className="text-[10px] text-slate-400 font-semibold block">Drawdown Max</span>
                      <span className="text-lg font-bold text-rose-400 font-mono">
                        -{rapportActuel.maxDrawdownPourcentage}%
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        Ratio R:R moy: {rapportActuel.ratioRRMoyen}
                      </span>
                    </div>
                  </div>

                  {/* Courbe de capital simplifiée (Equity Curve) */}
                  {rapportActuel.courbeEquity.length > 1 && (
                    <div className="p-3.5 bg-[#1e222d] border border-[#2a2e39] rounded-xl space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                        <span>📈 Courbe de Capital (Equity Curve)</span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {rapportActuel.capitalInitial}$ ➔ {rapportActuel.capitalFinal}$
                        </span>
                      </div>

                      {/* Tracé SVG ultra-léger */}
                      <div className="w-full h-24 bg-[#131722] rounded-lg p-1.5 flex items-center justify-center overflow-hidden">
                        <svg className="w-full h-full" viewBox="0 0 500 100" preserveAspectRatio="none">
                          {(() => {
                            const points = rapportActuel.courbeEquity;
                            const minVal = Math.min(...points.map(p => p.capital));
                            const maxVal = Math.max(...points.map(p => p.capital));
                            const ecart = maxVal - minVal || 1;

                            const chemin = points.map((p, idx) => {
                              const x = (idx / (points.length - 1)) * 500;
                              const y = 90 - ((p.capital - minVal) / ecart) * 80;
                              return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                            }).join(' ');

                            const estGagnant = rapportActuel.capitalFinal >= rapportActuel.capitalInitial;

                            return (
                              <>
                                <path
                                  d={chemin}
                                  fill="none"
                                  stroke={estGagnant ? '#10b981' : '#f43f5e'}
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                />
                              </>
                            );
                          })()}
                        </svg>
                      </div>
                    </div>
                  )}

                  {/* Liste détaillée des trades */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-200">
                        Journal des Trades Exécutés ({rapportActuel.trades.length})
                      </h4>
                    </div>

                    <div className="overflow-x-auto border border-[#2a2e39] rounded-xl bg-[#181b24] max-h-60 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                      <table className="w-full text-left text-[11px] min-w-[480px]">
                        <thead className="bg-[#1e222d] text-slate-400 border-b border-[#2a2e39] sticky top-0">
                          <tr>
                            <th className="p-2">Type</th>
                            <th className="p-2">Date Entrée</th>
                            <th className="p-2">Entrée</th>
                            <th className="p-2">Sortie</th>
                            <th className="p-2">Résultat</th>
                            <th className="p-2">PnL</th>
                            <th className="p-2">R:R</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#2a2e39]/60 font-mono">
                          {rapportActuel.trades.map((trade) => {
                            const estWin = trade.resultat === 'win';
                            return (
                              <tr key={trade.id} className="hover:bg-white/5 transition-colors">
                                <td className="p-2 font-bold">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                    trade.direction === 'long' ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                                  }`}>
                                    {trade.direction.toUpperCase()}
                                  </span>
                                </td>
                                <td className="p-2 text-slate-300">{trade.dateEntree.slice(0, 16)}</td>
                                <td className="p-2 text-slate-200">{trade.prixEntree}</td>
                                <td className="p-2 text-slate-200">{trade.prixSortie}</td>
                                <td className="p-2 font-bold">
                                  <span className={estWin ? 'text-emerald-400' : 'text-rose-400'}>
                                    {estWin ? 'WIN 🎯' : 'LOSS ❌'}
                                  </span>
                                </td>
                                <td className={`p-2 font-bold ${estWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {trade.pnlMontant >= 0 ? '+' : ''}{trade.pnlMontant.toFixed(1)} $
                                </td>
                                <td className="p-2 text-slate-300">{trade.ratioRR > 0 ? trade.ratioRR.toFixed(1) : '-1.0'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Pied de la Modale (avec safe-area pour encoche/barre de gestes Android/iOS) ── */}
        <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-2.5 border-t border-[#2a2e39] bg-[#1e222d] text-xs shrink-0 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
          <div className="text-[10px] sm:text-[11px] text-slate-400 truncate">
            {botSelectionne ? `Bot actif : ${botSelectionne.nom}` : 'Aucun bot sélectionné'}
          </div>
          <button
            onClick={onClose}
            className="px-3 sm:px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-semibold transition-colors shrink-0 active:scale-95"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
