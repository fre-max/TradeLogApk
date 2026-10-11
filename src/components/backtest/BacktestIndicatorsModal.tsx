import React, { useState, useEffect, useRef } from 'react';
import { useBacktestStore } from '@/store/backtestStore';
import type { IndicatorScript, VariableExterneDef } from '@/types/indicatorScript';
import {
  recupererIndicateursStockes,
  sauvegarderIndicateurStocke,
  supprimerIndicateurStocke,
  reinitialiserIndicateursParDefaut,
  evaluerIndicateurScript,
  convertirScriptTypeScriptEnJavaScript,
  INDICATEURS_PAR_DEFAUT,
} from '@/lib/indicators/indicatorEngine';
import { VariablesConfigPanel } from './VariablesConfigPanel';

interface BacktestIndicatorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  idInitialScriptSelectionne?: string | null;
  ongletInitial?: 'indicateurs' | 'configuration' | 'editeur' | 'telemetrie';
}

/**
 * Modale Studio d'Indicateurs Scriptables (Style Pine Script TradingView).
 * Permet de gérer, éditer le code JavaScript, importer et activer/désactiver
 * les indicateurs directement sur smartphone sans recompiler l'application.
 * 
 * Exemple :
 * <BacktestIndicatorsModal
 *   isOpen={modalOuverte}
 *   onClose={() => setModalOuverte(false)}
 *   idInitialScriptSelectionne="script-luxalgo-smc"
 * />
 */
export const BacktestIndicatorsModal: React.FC<BacktestIndicatorsModalProps> = ({
  isOpen,
  onClose,
  idInitialScriptSelectionne,
  ongletInitial,
}) => {
  // Navigation principale des 4 onglets : Bibliothèque, Configuration visuelle, Éditeur JS, Télémétrie
  const [ongletActif, setOngletActif] = useState<'indicateurs' | 'configuration' | 'editeur' | 'telemetrie'>('indicateurs');

  // Liste de tous les scripts d'indicateurs stockés
  const [indicateurs, setIndicateurs] = useState<IndicatorScript[]>([]);
  // Indicateur sélectionné pour l'édition de code et la configuration
  const [indicateurSelectionne, setIndicateurSelectionne] = useState<IndicatorScript | null>(null);

  // Filtre d'affichage dans la bibliothèque : tous | sur le graphique | officiels | personnalisés
  const [filtreType, setFiltreType] = useState<'tous' | 'actifs' | 'officiels' | 'custom'>('tous');

  // Champs de l'éditeur de code
  const [nomIndicateur, setNomIndicateur] = useState('');
  const [descriptionIndicateur, setDescriptionIndicateur] = useState('');
  const [codeIndicateur, setCodeIndicateur] = useState('');
  const [parametresTexte, setParametresTexte] = useState('{}');

  // Résultat du banc de test de script en direct
  const [resultatTest, setResultatTest] = useState<{
    succes: boolean;
    tempsMs: number;
    nbBoites: number;
    nbLignes: number;
    nbLabels: number;
    erreur?: string;
  } | null>(null);

  // Message de confirmation temporaire
  const [notification, setNotification] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Actions unifiées du store Zustand
  const scriptsIndicateurs = useBacktestStore((s) => s.scriptsIndicateurs);
  const toggleVisibiliteScript = useBacktestStore((s) => s.toggleVisibiliteScript);
  const sauvegarderScriptIndicateur = useBacktestStore((s) => s.sauvegarderScriptIndicateur);
  const optionsCollecte = useBacktestStore((s) => s.optionsCollecte);
  const setOptionCollecte = useBacktestStore((s) => s.setOptionCollecte);

  // Charge les indicateurs stockés à l'ouverture de la modale
  useEffect(() => {
    if (isOpen) {
      chargerIndicateurs();
    }
  }, [isOpen, idInitialScriptSelectionne, ongletInitial]);

  const chargerIndicateurs = () => {
    const scripts = recupererIndicateursStockes();
    setIndicateurs(scripts);

    if (idInitialScriptSelectionne) {
      const cible = scripts.find((s) => s.id === idInitialScriptSelectionne);
      if (cible) {
        selectionnerPourEdition(cible);
        if (ongletInitial) {
          setOngletActif(ongletInitial);
        } else {
          setOngletActif('editeur');
        }
        return;
      }
    }

    if (scripts.length > 0 && !indicateurSelectionne) {
      selectionnerPourEdition(scripts[0]);
    }
  };

  const afficherAlerte = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  // Sélectionne un indicateur et remplit les formulaires d'édition
  const selectionnerPourEdition = (ind: IndicatorScript) => {
    setIndicateurSelectionne(ind);
    setNomIndicateur(ind.nom);
    setDescriptionIndicateur(ind.description || '');
    setCodeIndicateur(ind.code);
    setParametresTexte(JSON.stringify(ind.parametres, null, 2));
    setResultatTest(null);
  };

  // ⚙️ Met à jour les variables externes depuis le formulaire visuel et applique en direct
  const mettreAJourParametresVisuels = (nouveauxParametres: Record<string, any>) => {
    if (!indicateurSelectionne) return;

    const indAJour: IndicatorScript = {
      ...indicateurSelectionne,
      parametres: nouveauxParametres,
      misAJourLe: new Date().toISOString(),
    };

    setIndicateurSelectionne(indAJour);
    setParametresTexte(JSON.stringify(nouveauxParametres, null, 2));
    sauvegarderScriptIndicateur(indAJour);
    sauvegarderIndicateurStocke(indAJour);

    // Met à jour la liste des indicateurs en mémoire
    setIndicateurs((prev) => prev.map((s) => (s.id === indAJour.id ? indAJour : s)));
  };

  // 💾 Enregistre explicitement avec notification
  const enregistrerParametresVisuels = () => {
    afficherAlerte('✅ Paramètres enregistrés et appliqués en direct sur le graphique !');
  };

  // 🔄 Rétablit les paramètres et définitions par défaut de l'indicateur sélectionné
  const reinitialiserParametresIndicateur = () => {
    if (!indicateurSelectionne) return;

    const officiel = INDICATEURS_PAR_DEFAUT.find((d) => d.id === indicateurSelectionne.id);
    if (officiel) {
      const indReinit: IndicatorScript = {
        ...indicateurSelectionne,
        parametres: { ...officiel.parametres },
        definitionsVariables: officiel.definitionsVariables ? [...officiel.definitionsVariables] : [],
        code: officiel.code,
        nom: officiel.nom,
        description: officiel.description,
        misAJourLe: new Date().toISOString(),
      };
      setIndicateurSelectionne(indReinit);
      setParametresTexte(JSON.stringify(officiel.parametres, null, 2));
      sauvegarderScriptIndicateur(indReinit);
      sauvegarderIndicateurStocke(indReinit);
      setIndicateurs((prev) => prev.map((s) => (s.id === indReinit.id ? indReinit : s)));
      afficherAlerte('🔄 Indicateur entièrement réinitialisé aux valeurs officielles.');
      return;
    }

    let paramsParDefaut: Record<string, any> = {};
    if (indicateurSelectionne.definitionsVariables) {
      for (const def of indicateurSelectionne.definitionsVariables) {
        paramsParDefaut[def.cle] = def.valeurParDefaut;
      }
    }

    mettreAJourParametresVisuels(paramsParDefaut);
    afficherAlerte('🔄 Paramètres réinitialisés aux valeurs d\'origine.');
  };

  // ➕ Ajoute une nouvelle définition de variable externe
  const ajouterNouvelleDefinitionVariable = (nouvelleDef: VariableExterneDef) => {
    if (!indicateurSelectionne) return;

    const defsActuelles = indicateurSelectionne.definitionsVariables || [];
    const indAJour: IndicatorScript = {
      ...indicateurSelectionne,
      definitionsVariables: [...defsActuelles, nouvelleDef],
      misAJourLe: new Date().toISOString(),
    };

    setIndicateurSelectionne(indAJour);
    sauvegarderScriptIndicateur(indAJour);
    sauvegarderIndicateurStocke(indAJour);
    setIndicateurs((prev) => prev.map((s) => (s.id === indAJour.id ? indAJour : s)));
    afficherAlerte(`➕ Paramètre "${nouvelleDef.label}" ajouté à la configuration !`);
  };

  // 1️⃣ Créer un nouvel indicateur personnalisé
  const creerNouvelIndicateur = () => {
    const nouveau: IndicatorScript = {
      id: `custom-ind-${Date.now()}`,
      nom: 'Mon Nouvel Indicateur',
      description: 'Indicateur personnalisé',
      auteur: 'Trader',
      version: '1.0.0',
      type: 'overlay',
      actif: true,
      visibleSurGraphique: true,
      collecteActive: true,
      parametres: {
        couleurLigne: '#2962ff',
        periode: 14,
      },
      creeLe: new Date().toISOString(),
      misAJourLe: new Date().toISOString(),
      code: `/**
 * Mon Indicateur Personnalisé
 * Exemple : trace une ligne sur le plus haut récent
 */
return {
  calculer: function(contexte) {
    const { bougies, parametres } = contexte;
    if (!bougies || bougies.length < 5) return { donnees: {}, primitives: {} };

    // Exemple de calcul de max sur 20 bougies
    const debut = Math.max(0, bougies.length - 20);
    let maxPrix = bougies[debut].high;
    for (let i = debut + 1; i < bougies.length; i++) {
      if (bougies[i].high > maxPrix) maxPrix = bougies[i].high;
    }

    const lignes = [];
    const boites = [];
    const labels = [];

    lignes.push({
      prix: maxPrix,
      dateDebut: bougies[debut].time,
      couleur: String(parametres.couleurLigne || '#2962ff'),
      style: 'dashed',
      label: 'Plus Haut 20b'
    });

    return {
      donnees: { plusHaut: maxPrix },
      primitives: { boites, lignes, labels }
    };
  }
};`,
    };

    sauvegarderScriptIndicateur(nouveau);
    chargerIndicateurs();
    selectionnerPourEdition(nouveau);
    setOngletActif('editeur');
    afficherAlerte('Nouvel indicateur créé ! Modifiez le code et sauvegardez.');
  };

  // 2️⃣ Sauvegarder les modifications du code de l'indicateur
  const sauvegarderModificationsCode = () => {
    if (!indicateurSelectionne) return;

    let paramsObj = indicateurSelectionne.parametres;
    try {
      paramsObj = JSON.parse(parametresTexte);
    } catch (e) {
      afficherAlerte('⚠️ Erreur de syntaxe dans les paramètres JSON.');
      return;
    }

    const indAJour: IndicatorScript = {
      ...indicateurSelectionne,
      nom: nomIndicateur,
      description: descriptionIndicateur,
      code: codeIndicateur,
      parametres: paramsObj,
      misAJourLe: new Date().toISOString(),
    };

    sauvegarderScriptIndicateur(indAJour);
    setIndicateurSelectionne(indAJour);
    chargerIndicateurs();
    afficherAlerte('✅ Script sauvegardé et appliqué instantanément au graphique !');
  };

  // 3️⃣ Tester l'exécution du script en direct sur des bougies simulées
  const testerScriptEnDirect = () => {
    try {
      const debut = performance.now();
      let params = {};
      try {
        params = JSON.parse(parametresTexte);
      } catch (e) {
        setResultatTest({ succes: false, tempsMs: 0, nbBoites: 0, nbLignes: 0, nbLabels: 0, erreur: 'JSON paramètres invalide' });
        return;
      }

      // Bougies réalistes pour le test sandbox
      const bougiesTest = Array.from({ length: 40 }, (_, i) => ({
        time: 1700000000 + i * 300,
        open: 1.0800 + Math.sin(i / 5) * 0.002,
        high: 1.0820 + Math.sin(i / 5) * 0.002,
        low: 1.0780 + Math.sin(i / 5) * 0.002,
        close: 1.0810 + Math.sin(i / 5) * 0.002,
      }));

      const res = evaluerIndicateurScript(codeIndicateur, {
        bougies: bougiesTest,
        parametres: params,
      });

      const duree = Math.round((performance.now() - debut) * 10) / 10;

      if (!res) {
        setResultatTest({ succes: false, tempsMs: duree, nbBoites: 0, nbLignes: 0, nbLabels: 0, erreur: 'Le script n\'a rien retourné (vérifiez return { calculer: ... })' });
      } else {
        setResultatTest({
          succes: true,
          tempsMs: duree,
          nbBoites: res.primitives?.boites?.length || 0,
          nbLignes: res.primitives?.lignes?.length || 0,
          nbLabels: res.primitives?.labels?.length || 0,
        });
      }
    } catch (err: any) {
      setResultatTest({ succes: false, tempsMs: 0, nbBoites: 0, nbLignes: 0, nbLabels: 0, erreur: err.message });
    }
  };

  // 4️⃣ Supprimer un indicateur personnalisé
  const supprimerIndicateur = (id: string) => {
    const ind = indicateurs.find((i) => i.id === id);
    const estOfficiel = ind ? (ind.id.startsWith('script-') || INDICATEURS_PAR_DEFAUT.some((def) => def.id === ind.id)) : false;
    if (estOfficiel) {
      afficherAlerte('⚠️ Les indicateurs officiels ne peuvent pas être supprimés (utilisez le bouton réinitialiser).');
      return;
    }

    supprimerIndicateurStocke(id);
    chargerIndicateurs();
    afficherAlerte('🗑️ Indicateur supprimé.');
  };

  // 5️⃣ Dupliquer un indicateur (pour personnaliser un officiel en toute sécurité)
  const dupliquerIndicateur = (ind: IndicatorScript) => {
    const copie: IndicatorScript = {
      ...ind,
      id: `custom-clone-${Date.now()}`,
      nom: `${ind.nom} (Copie Custom)`,
      description: `Variante personnalisée de ${ind.nom}`,
      creeLe: new Date().toISOString(),
      misAJourLe: new Date().toISOString(),
    };
    sauvegarderScriptIndicateur(copie);
    chargerIndicateurs();
    selectionnerPourEdition(copie);
    setOngletActif('editeur');
    afficherAlerte(`📋 Copie "${copie.nom}" créée. Vous pouvez modifier son code sans risque !`);
  };

  // 6️⃣ Importer un script (.js, .ts, .tsx, .json, .txt)
  const gererImportationFichier = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const lecteur = new FileReader();
    lecteur.onload = (event) => {
      try {
        const contenu = event.target?.result as string;
        if (!contenu) return;

        let nouveau: IndicatorScript;
        if (file.name.endsWith('.json')) {
          const obj = JSON.parse(contenu);
          nouveau = {
            id: `custom-ind-${Date.now()}`,
            nom: obj.nom || file.name.replace('.json', ''),
            description: obj.description || 'Indicateur importé',
            code: obj.code ? convertirScriptTypeScriptEnJavaScript(obj.code) : '',
            parametres: obj.parametres || {},
            definitionsVariables: obj.definitionsVariables,
            type: obj.type || 'overlay',
            actif: true,
            visibleSurGraphique: true,
            collecteActive: true,
            creeLe: new Date().toISOString(),
            misAJourLe: new Date().toISOString(),
          };
        } else {
          // Traitement des scripts JS ou TypeScript (.ts / .tsx / .txt)
          // La fonction retire les types TS, interfaces et imports incompatibles avec new Function()
          const codeExecutable = convertirScriptTypeScriptEnJavaScript(contenu);
          const nomFichierNettoye = file.name
            .replace(/\.[^/.]+$/, '')
            .replace(/[_-]/g, ' ');

          const estTypeScript = file.name.endsWith('.ts') || file.name.endsWith('.tsx');

          nouveau = {
            id: `custom-ind-${Date.now()}`,
            nom: nomFichierNettoye || 'Indicateur Importé',
            description: estTypeScript
              ? 'Indicateur TypeScript converti et importé avec succès'
              : 'Indicateur importé depuis fichier script',
            code: codeExecutable,
            parametres: {},
            type: 'overlay',
            actif: true,
            visibleSurGraphique: true,
            collecteActive: true,
            creeLe: new Date().toISOString(),
            misAJourLe: new Date().toISOString(),
          };
        }

        sauvegarderScriptIndicateur(nouveau);
        chargerIndicateurs();
        selectionnerPourEdition(nouveau);
        setOngletActif('editeur');
        afficherAlerte(`✅ Indicateur "${nouveau.nom}" importé avec succès !`);
      } catch (err: any) {
        afficherAlerte(`❌ Erreur d'import : ${err.message}`);
      }
    };
    lecteur.readAsText(file);
    e.target.value = '';
  };

  // 7️⃣ Exporter le script en fichier téléchargeable
  const exporterScript = (ind: IndicatorScript) => {
    try {
      const blob = new Blob([ind.code], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${ind.nom.toLowerCase().replace(/[^a-z0-9]/g, '_')}.js`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      afficherAlerte('📥 Script exporté en téléchargement.');
    } catch (err: any) {
      afficherAlerte(`Erreur d'export : ${err.message}`);
    }
  };

  // 8️⃣ Basculer l'affichage graphique d'un indicateur (unifié avec le store)
  const basculerVisibilite = (ind: IndicatorScript) => {
    toggleVisibiliteScript(ind.id);
    const scripts = recupererIndicateursStockes();
    setIndicateurs(scripts);
    if (indicateurSelectionne?.id === ind.id) {
      const maj = scripts.find(s => s.id === ind.id);
      if (maj) setIndicateurSelectionne(maj);
    }
  };

  // Vérifie si un indicateur est actuellement affiché
  const estAfficheSurGraphique = (ind: IndicatorScript): boolean => {
    const duStore = scriptsIndicateurs.find((s) => s.id === ind.id);
    return duStore ? duStore.visibleSurGraphique : ind.visibleSurGraphique;
  };

  // Nombre d'indicateurs actifs
  const totalActifs = indicateurs.filter(estAfficheSurGraphique).length;

  // Filtrage de la liste
  const indicateursFiltres = indicateurs.filter(i => {
    const estOfficiel = i.id.startsWith('script-') || INDICATEURS_PAR_DEFAUT.some((def) => def.id === i.id);
    if (filtreType === 'actifs') return estAfficheSurGraphique(i);
    if (filtreType === 'officiels') return estOfficiel;
    if (filtreType === 'custom') return !estOfficiel;
    return true;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex flex-col w-full sm:max-w-4xl h-[100dvh] sm:h-auto sm:max-h-[92vh] bg-[#131722] border-0 sm:border border-[#2a2e39] rounded-none sm:rounded-2xl shadow-2xl overflow-hidden text-slate-100">
        
        {/* ── En-tête de la Modale ── */}
        <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 border-b border-[#2a2e39] bg-[#1e222d] shrink-0">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <span className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 text-xs sm:text-sm font-bold text-sky-400 bg-sky-950/80 border border-sky-500/40 rounded-xl shadow-inner shrink-0">
              fx
            </span>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold tracking-wide text-white flex items-center gap-1.5 sm:gap-2 truncate">
                <span>Studio d'Indicateurs</span>
                <span className="hidden sm:inline-flex text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400 font-mono border border-sky-500/30">
                  Modulaire · Zéro Recompilation
                </span>
              </h2>
              <p className="text-[10px] sm:text-[11px] text-slate-400 truncate hidden xs:block sm:block">
                Gérez vos indicateurs en JavaScript pur, modifiez leurs paramètres en direct et nourrissez vos bots
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

        {/* ── Onglets de Navigation (Scrollable horizontalement sur smartphone) ── */}
        <div className="flex items-center justify-between border-b border-[#2a2e39] px-2 sm:px-4 bg-[#181b24] shrink-0 overflow-x-auto no-scrollbar gap-2">
          <div className="flex gap-1 shrink-0">
            <button
              onClick={() => setOngletActif('indicateurs')}
              className={`px-2.5 sm:px-3.5 py-2 sm:py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
                ongletActif === 'indicateurs'
                  ? 'border-sky-500 text-sky-400 bg-sky-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>📈 Bibliothèque</span>
              {totalActifs > 0 && (
                <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-sky-950 border border-sky-600/60 text-sky-300 font-bold font-mono">
                  {totalActifs}
                </span>
              )}
            </button>

            <button
              onClick={() => setOngletActif('configuration')}
              className={`px-2.5 sm:px-3.5 py-2 sm:py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
                ongletActif === 'configuration'
                  ? 'border-sky-500 text-sky-400 bg-sky-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>⚙️ Config<span className="hidden sm:inline"> (Inputs)</span></span>
              {indicateurSelectionne && (
                <span className="text-[10px] text-sky-400/80 max-w-[100px] truncate hidden md:inline font-mono">
                  ({indicateurSelectionne.nom})
                </span>
              )}
            </button>

            <button
              onClick={() => setOngletActif('editeur')}
              className={`px-2.5 sm:px-3.5 py-2 sm:py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
                ongletActif === 'editeur'
                  ? 'border-sky-500 text-sky-400 bg-sky-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>💻 Code JS</span>
            </button>

            <button
              onClick={() => setOngletActif('telemetrie')}
              className={`px-2.5 sm:px-3.5 py-2 sm:py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
                ongletActif === 'telemetrie'
                  ? 'border-sky-500 text-sky-400 bg-sky-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>🤖 Télémétrie</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 py-1.5 shrink-0">
            <button
              onClick={creerNouvelIndicateur}
              className="px-2 sm:px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-lg shadow transition-all flex items-center gap-1 active:scale-95 whitespace-nowrap"
              title="Créer un nouvel indicateur personnalisé en JavaScript"
            >
              <span>➕</span>
              <span className="hidden sm:inline">Nouveau</span>
            </button>

            <input
              type="file"
              accept=".js,.ts,.tsx,.json,.txt,text/*,application/javascript,*/*"
              ref={fileInputRef}
              onChange={gererImportationFichier}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-2 sm:px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 active:scale-95 whitespace-nowrap"
              title="Importer un fichier de script (.js, .ts, .json, .txt)"
            >
              <span>📥</span>
              <span className="hidden sm:inline">Importer</span>
            </button>
          </div>
        </div>

        {/* Message d'alerte temporaire */}
        {notification && (
          <div className="px-4 py-1.5 bg-sky-950/80 border-b border-sky-500/40 text-sky-300 text-xs font-medium flex items-center gap-2 animate-in fade-in">
            <span>ℹ️</span>
            <span>{notification}</span>
          </div>
        )}

        {/* ── Contenu selon l'onglet ── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* ══════════════════════════════════════════════════════════ */}
          {/* ONGLET 1 : MES INDICATEURS (BIBLIOTHÈQUE)                */}
          {/* ══════════════════════════════════════════════════════════ */}
          {ongletActif === 'indicateurs' && (
            <div className="space-y-4">
              
              {/* Filtres de catégorie */}
              <div className="flex items-center justify-between gap-2 p-2 bg-[#1e222d] border border-[#2a2e39] rounded-xl text-xs">
                <div className="flex items-center gap-1 flex-wrap">
                  <button
                    onClick={() => setFiltreType('tous')}
                    className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                      filtreType === 'tous' ? 'bg-[#2a2e39] text-white font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Tous ({indicateurs.length})
                  </button>
                  <button
                    onClick={() => setFiltreType('actifs')}
                    className={`px-3 py-1 rounded-lg font-medium transition-colors flex items-center gap-1 ${
                      filtreType === 'actifs' ? 'bg-[#2a2e39] text-white font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>👁️ Sur le Chart</span>
                    <span className="text-[10px] px-1 rounded-full bg-emerald-500/20 text-emerald-400 font-mono">
                      {totalActifs}
                    </span>
                  </button>
                  <button
                    onClick={() => setFiltreType('officiels')}
                    className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                      filtreType === 'officiels' ? 'bg-[#2a2e39] text-white font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    💎 Officiels SMC
                  </button>
                  <button
                    onClick={() => setFiltreType('custom')}
                    className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                      filtreType === 'custom' ? 'bg-[#2a2e39] text-white font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    🛠️ Scripts Personnalisés
                  </button>
                </div>

                <button
                  onClick={() => {
                    const resets = reinitialiserIndicateursParDefaut();
                    setIndicateurs(resets);
                    afficherAlerte('🔄 Indicateurs officiels réinitialisés.');
                  }}
                  className="text-[10.5px] sm:text-[11px] text-slate-400 hover:text-amber-400 transition-colors whitespace-nowrap active:scale-95"
                  title="Restaurer tous les indicateurs d'origine"
                >
                  Restaurer par défaut
                </button>
              </div>

              {/* Grille des indicateurs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {indicateursFiltres.map((ind) => {
                  const estAffiche = estAfficheSurGraphique(ind);
                  const estSelectionne = indicateurSelectionne?.id === ind.id;
                  const estOfficiel = ind.id.startsWith('script-') || INDICATEURS_PAR_DEFAUT.some((def) => def.id === ind.id);

                  return (
                    <div
                      key={ind.id}
                      className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                        estAffiche
                          ? 'bg-[#181b24] border-sky-500/40 shadow-sm'
                          : 'bg-[#141720] border-[#2a2e39] opacity-80 hover:opacity-100'
                      } ${estSelectionne ? 'ring-1 ring-sky-500' : ''}`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${estAffiche ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-slate-600'}`} />
                            <h3 className="text-xs font-bold text-white tracking-wide truncate max-w-[200px]">
                              {ind.nom}
                            </h3>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                              estOfficiel
                                ? 'bg-purple-950/60 text-purple-300 border border-purple-800/40'
                                : 'bg-amber-950/60 text-amber-300 border border-amber-800/40'
                            }`}>
                              {estOfficiel ? 'Officiel' : 'Script'}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">v{ind.version || '1.0'}</span>
                          </div>
                        </div>

                        <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                          {ind.description || 'Aucune description fournie.'}
                        </p>

                        {/* Paramètres rapides aperçu */}
                        <div className="flex items-center gap-1.5 flex-wrap pt-1">
                          {Object.entries(ind.parametres || {}).slice(0, 3).map(([k, v]) => (
                            <span
                              key={k}
                              className="text-[9.5px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 font-mono"
                            >
                              {k}: <strong className="text-slate-300">{String(v)}</strong>
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Barre d'actions (Responsive flex-wrap) */}
                      <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-800/60 text-xs flex-wrap gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            onClick={() => basculerVisibilite(ind)}
                            className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-all flex items-center gap-1 active:scale-95 ${
                              estAffiche
                                ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/40'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700'
                            }`}
                          >
                            <span>{estAffiche ? '👁️ Sur le chart' : '⏹️ Masqué'}</span>
                          </button>

                          <button
                            onClick={() => {
                              selectionnerPourEdition(ind);
                              setOngletActif('configuration');
                            }}
                            className="px-2.5 py-1 rounded-lg font-semibold text-[11px] bg-sky-950/80 hover:bg-sky-900 text-sky-300 border border-sky-600/50 transition-all flex items-center gap-1 shadow-sm active:scale-95"
                            title="Configurer les variables externes de cet indicateur"
                          >
                            <span>⚙️ Configurer</span>
                          </button>
                        </div>

                        <div className="flex items-center gap-1 flex-wrap">
                          <button
                            onClick={() => {
                              selectionnerPourEdition(ind);
                              setOngletActif('editeur');
                            }}
                            className="p-1.5 text-slate-400 hover:text-sky-300 rounded hover:bg-slate-800 transition-colors"
                            title="Ouvrir le code JavaScript dans l'éditeur"
                          >
                            ✏️ Code
                          </button>

                          <button
                            onClick={() => dupliquerIndicateur(ind)}
                            className="p-1.5 text-slate-400 hover:text-emerald-300 rounded hover:bg-slate-800 transition-colors"
                            title="Dupliquer pour créer une variante sans risque"
                          >
                            📋 Dupliquer
                          </button>

                          <button
                            onClick={() => exporterScript(ind)}
                            className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                            title="Télécharger le fichier .js"
                          >
                            📥
                          </button>

                          {!estOfficiel && (
                            <button
                              onClick={() => supprimerIndicateur(ind.id)}
                              className="p-1.5 text-slate-400 hover:text-red-400 rounded hover:bg-slate-800 transition-colors"
                              title="Supprimer ce script personnalisé"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════ */}
          {/* ONGLET 2 : CONFIGURATION VISUELLE DES VARIABLES EXTERNES   */}
          {/* ══════════════════════════════════════════════════════════ */}
          {ongletActif === 'configuration' && indicateurSelectionne && (
            <div className="space-y-4">
              {/* Sélecteur de script actif */}
              <div className="flex items-center justify-between gap-3 p-3 bg-[#1e222d] border border-[#2a2e39] rounded-xl flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-medium">Indicateur sélectionné :</span>
                  <select
                    value={indicateurSelectionne.id}
                    onChange={(e) => {
                      const trouve = indicateurs.find((i) => i.id === e.target.value);
                      if (trouve) selectionnerPourEdition(trouve);
                    }}
                    className="bg-[#131722] border border-[#2a2e39] rounded-lg px-2.5 py-1 text-xs font-semibold text-sky-400 outline-none"
                  >
                    {indicateurs.map((ind) => (
                      <option key={ind.id} value={ind.id}>
                        {ind.nom} {estAfficheSurGraphique(ind) ? '👁️' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => basculerVisibilite(indicateurSelectionne)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                      estAfficheSurGraphique(indicateurSelectionne)
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                  >
                    <span>{estAfficheSurGraphique(indicateurSelectionne) ? '👁️ Affiché sur le chart' : '⏹️ Masqué'}</span>
                  </button>

                  <button
                    onClick={() => setOngletActif('editeur')}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold rounded-lg transition-all flex items-center gap-1"
                    title="Voir ou modifier le code source JavaScript"
                  >
                    <span>💻 Voir le Code</span>
                  </button>
                </div>
              </div>

              {/* Formulaire visuel moderne des variables externes */}
              <VariablesConfigPanel
                titre={`Paramètres : ${indicateurSelectionne.nom}`}
                sousTitre={indicateurSelectionne.description || 'Modifiez les variables externes ci-dessous'}
                parametres={indicateurSelectionne.parametres || {}}
                definitions={indicateurSelectionne.definitionsVariables}
                onChangeParametres={mettreAJourParametresVisuels}
                onEnregistrer={enregistrerParametresVisuels}
                onReinitialiser={reinitialiserParametresIndicateur}
                onAjouterDefinition={ajouterNouvelleDefinitionVariable}
                themeCouleur="sky"
              />
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════ */}
          {/* ONGLET 3 : ÉDITEUR DE SCRIPT JAVASCRIPT                   */}
          {/* ══════════════════════════════════════════════════════════ */}
          {ongletActif === 'editeur' && (
            <div className="space-y-4">
              
              {/* Sélecteur de script actif + actions */}
              <div className="flex items-center justify-between gap-3 p-3 bg-[#1e222d] border border-[#2a2e39] rounded-xl flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Script en cours d'édition :</span>
                  <select
                    value={indicateurSelectionne?.id || ''}
                    onChange={(e) => {
                      const trouve = indicateurs.find(i => i.id === e.target.value);
                      if (trouve) selectionnerPourEdition(trouve);
                    }}
                    className="bg-[#131722] border border-[#2a2e39] rounded-lg px-2.5 py-1 text-xs font-semibold text-sky-400 outline-none"
                  >
                    {indicateurs.map(ind => (
                      <option key={ind.id} value={ind.id}>
                        {ind.nom} {estAfficheSurGraphique(ind) ? '👁️' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={testerScriptEnDirect}
                    className="px-2.5 sm:px-3 py-1 bg-amber-600/80 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-all shadow flex items-center gap-1.5 active:scale-95"
                    title="Exécute le script sur 40 bougies de test pour vérifier la validité du code"
                  >
                    <span>▶</span>
                    <span>Tester<span className="hidden sm:inline"> l'évaluation</span></span>
                  </button>

                  <button
                    onClick={sauvegarderModificationsCode}
                    className="px-2.5 sm:px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition-all shadow flex items-center gap-1.5 active:scale-95"
                  >
                    <span>💾</span>
                    <span>Enregistrer<span className="hidden sm:inline"> & Appliquer</span></span>
                  </button>
                </div>
              </div>

              {/* Résultat du test d'exécution */}
              {resultatTest && (
                <div className={`p-2.5 rounded-xl border text-xs flex items-center justify-between animate-in fade-in ${
                  resultatTest.succes
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                    : 'bg-red-950/40 border-red-500/40 text-red-300'
                }`}>
                  <div className="flex items-center gap-2">
                    <span>{resultatTest.succes ? '✅' : '❌'}</span>
                    <span>
                      {resultatTest.succes
                        ? `Calculé avec succès en ${resultatTest.tempsMs}ms : ${resultatTest.nbBoites} boîte(s), ${resultatTest.nbLignes} ligne(s), ${resultatTest.nbLabels} label(s)`
                        : `Erreur d'exécution : ${resultatTest.erreur}`}
                    </span>
                  </div>
                  <button onClick={() => setResultatTest(null)} className="text-slate-400 hover:text-white px-1">✕</button>
                </div>
              )}

              {/* Formulaire Métadonnées */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-medium">Nom de l'indicateur</label>
                  <input
                    type="text"
                    value={nomIndicateur}
                    onChange={(e) => setNomIndicateur(e.target.value)}
                    className="w-full mt-1 bg-[#181b24] border border-[#2a2e39] focus:border-sky-500 rounded-lg px-3 py-1.5 text-xs text-white outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 font-medium">Description</label>
                  <input
                    type="text"
                    value={descriptionIndicateur}
                    onChange={(e) => setDescriptionIndicateur(e.target.value)}
                    className="w-full mt-1 bg-[#181b24] border border-[#2a2e39] focus:border-sky-500 rounded-lg px-3 py-1.5 text-xs text-white outline-none"
                  />
                </div>
              </div>

              {/* Paramètres JSON */}
              <div>
                <label className="text-xs text-slate-400 font-medium flex items-center justify-between">
                  <span>Paramètres Configurables (Format JSON)</span>
                  <span className="text-[10px] text-slate-500 font-mono">Modifiez les seuils, couleurs et longueurs</span>
                </label>
                <textarea
                  value={parametresTexte}
                  onChange={(e) => setParametresTexte(e.target.value)}
                  rows={4}
                  className="w-full mt-1 bg-[#181b24] border border-[#2a2e39] focus:border-sky-500 rounded-xl p-2.5 text-xs font-mono text-amber-300 outline-none resize-none leading-relaxed"
                />
              </div>

              {/* Éditeur de Code JavaScript */}
              <div>
                <label className="text-xs text-slate-400 font-medium flex items-center justify-between pb-1">
                  <span>Code JavaScript Exécutable</span>
                  <span className="text-[10px] text-slate-500 font-mono">Sandbox sécurisée isolée</span>
                </label>

                <textarea
                  value={codeIndicateur}
                  onChange={(e) => setCodeIndicateur(e.target.value)}
                  rows={10}
                  spellCheck={false}
                  className="w-full bg-[#0d1017] border border-[#2a2e39] focus:border-sky-500 rounded-xl p-3 text-xs font-mono text-sky-300 outline-none leading-relaxed resize-y shadow-inner sm:rows-[16]"
                />

                {/* Guide de l'API Primitives */}
                <div className="p-3 bg-[#181b24] border border-[#2a2e39] rounded-xl text-[11px] space-y-1.5 text-slate-300 mt-2">
                  <div className="font-bold text-white flex items-center gap-1">
                    <span>📖</span>
                    <span>Primitives visuelles retournées par votre méthode calculer(contexte) :</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-400 font-mono text-[10px]">
                    <li><strong className="text-slate-200">primitives.boites</strong> : {`[{ prixHaut, prixBas, dateDebut, dateFin, couleurFond, label }]`}</li>
                    <li><strong className="text-slate-200">primitives.lignes</strong> : {`[{ prix, dateDebut, dateFin, couleur, style: 'solid'|'dashed', label }]`}</li>
                    <li><strong className="text-slate-200">primitives.labels</strong> : {`[{ prix, date, texte: 'HH', couleur, position: 'above'|'below' }]`}</li>
                    <li><strong className="text-slate-200">primitives.courbes</strong> : {`[{ nom: 'EMA', couleur: '#2962ff', points: [{ time, value }] }]`}</li>
                    <li><strong className="text-slate-200">donnees</strong> : Objet télémétrique transmis directement à vos bots de trading via contexte.indicateurs</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════ */}
          {/* ONGLET 3 : TÉLÉMÉTRIE POUR BOTS ET JOURNAL               */}
          {/* ══════════════════════════════════════════════════════════ */}
          {ongletActif === 'telemetrie' && (
            <div className="space-y-4">
              <div className="p-3 bg-sky-950/30 border border-sky-500/30 rounded-xl text-xs text-sky-200 flex items-start gap-2.5">
                <span className="text-base">🤖</span>
                <div>
                  <strong>Alimentation Télémétrique des Bots de Trading :</strong>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Sélectionnez les indicateurs dont les métriques précises sont capturées lors de chaque bougie.
                    Ces données sont injectées dans <code>contexte.indicateurs</code> pour orienter les décisions d'achat et de vente de vos bots.
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                {indicateurs.map((ind) => {
                  const estCoche = ind.collecteActive;
                  return (
                    <div
                      key={ind.id}
                      onClick={() => {
                        const maj = { ...ind, collecteActive: !estCoche };
                        sauvegarderScriptIndicateur(maj);
                        chargerIndicateurs();

                        // Mise à jour rétrocompatible pour les 4 clés
                        if (ind.id === 'script-luxalgo-smc') setOptionCollecte('luxAlgoSMC', !estCoche);
                        if (ind.id === 'script-protected-swings') setOptionCollecte('protectedSwings', !estCoche);
                        if (ind.id === 'script-unmitigated-profile') setOptionCollecte('unmitigatedProfile', !estCoche);
                        if (ind.id === 'script-zigzag-smc') setOptionCollecte('zigzag', !estCoche);
                      }}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        estCoche
                          ? 'bg-sky-950/20 border-sky-500/60'
                          : 'bg-[#181b24] border-[#2a2e39] opacity-70 hover:opacity-100'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-white">{ind.nom}</h4>
                          <span className="text-[10px] text-sky-400 font-mono">contexte.indicateurs['{ind.id}']</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">{ind.description}</p>
                      </div>

                      <div className={`w-5 h-5 rounded-md border flex items-center justify-center font-bold text-xs transition-colors ${
                        estCoche ? 'bg-sky-600 border-sky-500 text-white' : 'border-slate-600 bg-slate-800'
                      }`}>
                        {estCoche ? '✓' : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* ── Pied de la Modale (avec safe-area pour encoche/barre de gestes Android/iOS) ── */}
        <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-2.5 border-t border-[#2a2e39] bg-[#1e222d] text-xs shrink-0 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
          <div className="text-[10px] sm:text-[11px] text-slate-400 flex items-center gap-2 truncate">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            <span className="truncate">{totalActifs} indicateur(s) actif(s) sur le chart</span>
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
