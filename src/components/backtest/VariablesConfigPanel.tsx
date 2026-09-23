import React, { useState } from 'react';
import type { VariableExterneDef } from '@/types/indicatorScript';
import { genererDefinitionsVariablesAutomatiques } from '@/lib/indicators/indicatorEngine';

interface VariablesConfigPanelProps {
  titre?: string;
  sousTitre?: string;
  parametres: Record<string, any>;
  definitions?: VariableExterneDef[];
  onChangeParametres: (nouveauxParametres: Record<string, any>) => void;
  onReinitialiser?: () => void;
  onEnregistrer?: () => void;
  onAjouterDefinition?: (nouvelleDef: VariableExterneDef) => void;
  themeCouleur?: 'sky' | 'emerald';
}

/**
 * Composant de panneau de configuration visuelle pour les variables externes.
 * Transforme les paramètres techniques d'un indicateur ou d'un bot en une
 * interface intuitive avec switchs, sliders, boutons +/- et groupements.
 * 
 * Exemple :
 * <VariablesConfigPanel
 *   titre="Configuration LuxAlgo SMC"
 *   parametres={script.parametres}
 *   definitions={script.definitionsVariables}
 *   onChangeParametres={(nouveaux) => mettreAJour(nouveaux)}
 *   onEnregistrer={() => sauvegarder()}
 * />
 */
export const VariablesConfigPanel: React.FC<VariablesConfigPanelProps> = ({
  titre,
  sousTitre,
  parametres,
  definitions = [],
  onChangeParametres,
  onReinitialiser,
  onEnregistrer,
  onAjouterDefinition,
  themeCouleur = 'sky',
}) => {
  // Modal pour ajouter une nouvelle variable externe manuellement
  const [modalAjoutOuverte, setModalAjoutOuverte] = useState(false);
  const [nouvelleCle, setNouvelleCle] = useState('');
  const [nouveauLabel, setNouveauLabel] = useState('');
  const [nouveauType, setNouveauType] = useState<'number' | 'boolean' | 'string'>('number');
  const [nouvelleValeurDefaut, setNouvelleValeurDefaut] = useState<string>('10');
  const [nouveauGroupe, setNouveauGroupe] = useState('Paramètres Personnalisés');

  // Couleurs de thème dynamiques
  const estThemeVert = themeCouleur === 'emerald';

  // 1️⃣ Réconciliation des définitions : on utilise les définitions fournies ou on les infère
  const definitionsEffectives: VariableExterneDef[] = React.useMemo(() => {
    if (definitions && definitions.length > 0) {
      // Vérifier si des clés dans parametres ne sont pas encore définies
      const clesDefinies = new Set(definitions.map((d) => d.cle));
      const paramsSansDef: Record<string, any> = {};
      for (const [cle, val] of Object.entries(parametres)) {
        if (!clesDefinies.has(cle)) {
          paramsSansDef[cle] = val;
        }
      }
      const defsAuto = genererDefinitionsVariablesAutomatiques(paramsSansDef);
      return [...definitions, ...defsAuto];
    }
    return genererDefinitionsVariablesAutomatiques(parametres);
  }, [definitions, parametres]);

  // 2️⃣ Regroupement par catégorie
  const groupes: Record<string, VariableExterneDef[]> = React.useMemo(() => {
    const map: Record<string, VariableExterneDef[]> = {};
    for (const def of definitionsEffectives) {
      const nomGroupe = def.groupe || 'Paramètres Généraux';
      if (!map[nomGroupe]) map[nomGroupe] = [];
      map[nomGroupe].push(def);
    }
    return map;
  }, [definitionsEffectives]);

  // Met à jour la valeur d'une clé spécifique
  const modifierValeur = (cle: string, valeur: any) => {
    onChangeParametres({
      ...parametres,
      [cle]: valeur,
    });
  };

  // Ajuste une valeur numérique avec les boutons +/-
  const ajusterNombre = (def: VariableExterneDef, direction: 1 | -1) => {
    const valActuelle = Number(parametres[def.cle] ?? def.valeurParDefaut ?? 0);
    const pas = def.step || (Number.isInteger(valActuelle) ? 1 : 0.1);
    let nouvelleVal = valActuelle + direction * pas;

    if (def.min !== undefined && nouvelleVal < def.min) nouvelleVal = def.min;
    if (def.max !== undefined && nouvelleVal > def.max) nouvelleVal = def.max;

    // Arrondi pour éviter les erreurs d'imprécision flottante JS (ex: 0.1 + 0.2 = 0.30000000004)
    nouvelleVal = Number(nouvelleVal.toFixed(4));
    modifierValeur(def.cle, nouvelleVal);
  };

  // Traite l'ajout d'une nouvelle variable externe
  const validerAjoutVariable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nouvelleCle.trim() || !nouveauLabel.trim()) return;

    const cleNettoyee = nouvelleCle.trim().replace(/\s+/g, '_');
    let valeurFinale: any = nouvelleValeurDefaut;

    if (nouveauType === 'number') {
      valeurFinale = Number(nouvelleValeurDefaut) || 0;
    } else if (nouveauType === 'boolean') {
      valeurFinale = nouvelleValeurDefaut === 'true';
    }

    const nouvelleDef: VariableExterneDef = {
      cle: cleNettoyee,
      label: nouveauLabel.trim(),
      type: nouveauType,
      valeurParDefaut: valeurFinale,
      groupe: nouveauGroupe.trim() || 'Variables Personnalisées',
      min: nouveauType === 'number' ? 0 : undefined,
      max: nouveauType === 'number' ? Math.max(valeurFinale * 3, 100) : undefined,
      step: nouveauType === 'number' ? (Number.isInteger(valeurFinale) ? 1 : 0.1) : undefined,
    };

    // Met à jour les paramètres et notifie le parent
    modifierValeur(cleNettoyee, valeurFinale);
    if (onAjouterDefinition) {
      onAjouterDefinition(nouvelleDef);
    }

    // Réinitialise le formulaire d'ajout
    setNouvelleCle('');
    setNouveauLabel('');
    setNouvelleValeurDefaut('10');
    setModalAjoutOuverte(false);
  };

  return (
    <div className="space-y-4">
      {/* ── En-tête du panneau de configuration ── */}
      {(titre || sousTitre) && (
        <div className="flex items-center justify-between p-2.5 sm:p-3 bg-[#1e222d] border border-[#2a2e39] rounded-xl flex-wrap gap-2">
          <div className="min-w-0 flex-1">
            {titre && <h3 className="text-xs font-bold text-white tracking-wide truncate">{titre}</h3>}
            {sousTitre && <p className="text-[10.5px] sm:text-[11px] text-slate-400 mt-0.5 line-clamp-1">{sousTitre}</p>}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setModalAjoutOuverte(true)}
              className="px-2 sm:px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 shadow-sm active:scale-95"
              title="Ajouter une nouvelle variable externe"
            >
              <span>➕</span>
              <span className="hidden xs:inline sm:inline">Nouveau </span>
              <span>Paramètre</span>
            </button>

            {onReinitialiser && (
              <button
                type="button"
                onClick={onReinitialiser}
                className="px-2 sm:px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 shadow-sm active:scale-95"
                title="Rétablir toutes les valeurs par défaut"
              >
                <span>🔄</span>
                <span className="hidden sm:inline">Défaut</span>
              </button>
            )}

            {onEnregistrer && (
              <button
                type="button"
                onClick={onEnregistrer}
                className={`px-2.5 sm:px-3 py-1 text-white text-xs font-bold rounded-lg transition-all shadow-md flex items-center gap-1.5 active:scale-95 ${
                  estThemeVert
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : 'bg-sky-600 hover:bg-sky-500'
                }`}
              >
                <span>💾</span>
                <span>Appliquer</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Groupes de paramètres ── */}
      <div className="space-y-4">
        {Object.entries(groupes).map(([nomGroupe, listeDefs]) => (
          <div
            key={nomGroupe}
            className="p-3.5 bg-[#181b24] border border-[#2a2e39] rounded-xl space-y-3"
          >
            {/* Titre de la catégorie */}
            <div className="flex items-center gap-2 border-b border-[#2a2e39] pb-2">
              <span className={`w-2 h-2 rounded-full ${estThemeVert ? 'bg-emerald-400' : 'bg-sky-400'}`} />
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                {nomGroupe}
              </h4>
              <span className="text-[10px] text-slate-500 font-mono">
                ({listeDefs.length} variable{listeDefs.length > 1 ? 's' : ''})
              </span>
            </div>

            {/* Liste des champs configurables */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
              {listeDefs.map((def) => {
                const valActuelle = parametres[def.cle] !== undefined
                  ? parametres[def.cle]
                  : def.valeurParDefaut;

                return (
                  <div
                    key={def.cle}
                    className="p-2.5 bg-[#131722] border border-[#232733] hover:border-[#2a2e39] rounded-xl flex flex-col justify-between gap-2 transition-all shadow-sm"
                  >
                    {/* Libellé + description */}
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <label className="text-xs font-semibold text-slate-200">
                          {def.label}
                        </label>
                        <span className="text-[10px] font-mono text-slate-500 bg-[#1e222d] px-1.5 py-0.5 rounded">
                          {def.cle}
                        </span>
                      </div>
                      {def.description && (
                        <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                          {def.description}
                        </p>
                      )}
                    </div>

                    {/* Contrôle visuel selon le type */}
                    <div className="mt-1">
                      {/* TYPE 1 : BOOLÉEN (SWITCH MODERNE) */}
                      {def.type === 'boolean' && (
                        <div className="flex items-center justify-between pt-1">
                          <span className={`text-[11px] font-bold ${valActuelle ? (estThemeVert ? 'text-emerald-400' : 'text-sky-400') : 'text-slate-500'}`}>
                            {valActuelle ? 'Activé (Oui)' : 'Désactivé (Non)'}
                          </span>
                          <button
                            type="button"
                            onClick={() => modifierValeur(def.cle, !valActuelle)}
                            className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 focus:outline-none ${
                              valActuelle
                                ? (estThemeVert ? 'bg-emerald-500' : 'bg-sky-500')
                                : 'bg-slate-700'
                            }`}
                          >
                            <div
                              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                                valActuelle ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      )}

                      {/* TYPE 2 : NOMBRE (INPUT + BOUTONS +/- ET SLIDER SI DISPONIBLE) */}
                      {def.type === 'number' && (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => ajusterNombre(def, -1)}
                              className="w-9 h-9 flex items-center justify-center bg-[#1e222d] hover:bg-[#2a2e39] text-white rounded-lg text-base font-bold border border-[#2a2e39] active:scale-95 transition-transform touch-manipulation select-none"
                              title="Diminuer"
                            >
                              –
                            </button>

                            <input
                              type="number"
                              step={def.step || (Number.isInteger(Number(valActuelle)) ? 1 : 0.1)}
                              min={def.min}
                              max={def.max}
                              value={Number(valActuelle)}
                              onChange={(e) => modifierValeur(def.cle, Number(e.target.value))}
                              className="flex-1 h-9 bg-[#181b24] border border-[#2a2e39] focus:border-sky-500 text-center rounded-lg py-1 text-xs font-mono text-white outline-none font-bold"
                            />

                            <button
                              type="button"
                              onClick={() => ajusterNombre(def, 1)}
                              className="w-9 h-9 flex items-center justify-center bg-[#1e222d] hover:bg-[#2a2e39] text-white rounded-lg text-base font-bold border border-[#2a2e39] active:scale-95 transition-transform touch-manipulation select-none"
                              title="Augmenter"
                            >
                              +
                            </button>
                          </div>

                          {/* Curseur slider si min et max sont connus */}
                          {def.min !== undefined && def.max !== undefined && (
                            <div className="flex items-center gap-2 pt-0.5">
                              <span className="text-[9px] text-slate-500 font-mono">{def.min}</span>
                              <input
                                type="range"
                                min={def.min}
                                max={def.max}
                                step={def.step || 1}
                                value={Number(valActuelle)}
                                onChange={(e) => modifierValeur(def.cle, Number(e.target.value))}
                                className={`flex-1 h-1.5 bg-[#1e222d] rounded-lg appearance-none cursor-pointer ${
                                  estThemeVert ? 'accent-emerald-500' : 'accent-sky-500'
                                }`}
                              />
                              <span className="text-[9px] text-slate-500 font-mono">{def.max}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* TYPE 3 : SÉLECTION DÉROULANTE (SELECT) */}
                      {def.type === 'select' && (
                        <select
                          value={String(valActuelle)}
                          onChange={(e) => modifierValeur(def.cle, e.target.value)}
                          className="w-full bg-[#181b24] border border-[#2a2e39] focus:border-sky-500 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
                        >
                          {(def.options || []).map((opt) => (
                            <option key={String(opt.value)} value={String(opt.value)}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      )}

                      {/* TYPE 4 : CHAÎNE / COULEUR (TEXTE) */}
                      {def.type === 'string' && (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={String(valActuelle || '')}
                            onChange={(e) => modifierValeur(def.cle, e.target.value)}
                            className="w-full bg-[#181b24] border border-[#2a2e39] focus:border-sky-500 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none font-mono"
                            placeholder="Valeur..."
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ── Modal pour ajouter une nouvelle variable externe personnalisée ── */}
      {modalAjoutOuverte && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-[#181b24] border border-[#2a2e39] rounded-2xl shadow-2xl p-4 text-slate-100 space-y-4 max-h-[88dvh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#2a2e39] pb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>➕</span>
                <span>Déclarer une Variable Externe</span>
              </h3>
              <button
                type="button"
                onClick={() => setModalAjoutOuverte(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={validerAjoutVariable} className="space-y-3">
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">
                  Nom du paramètre (Label) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Seuil de Déviation, Période EMA..."
                  value={nouveauLabel}
                  onChange={(e) => {
                    setNouveauLabel(e.target.value);
                    if (!nouvelleCle) {
                      setNouvelleCle(
                        e.target.value
                          .toLowerCase()
                          .replace(/[^\w\s]/gi, '')
                          .replace(/\s+/g, '')
                      );
                    }
                  }}
                  className="w-full bg-[#131722] border border-[#2a2e39] focus:border-sky-500 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">
                  Identifiant technique (Clé dans le code) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: periodeEMA, seuilDeviation..."
                  value={nouvelleCle}
                  onChange={(e) => setNouvelleCle(e.target.value)}
                  className="w-full bg-[#131722] border border-[#2a2e39] focus:border-sky-500 rounded-lg px-2.5 py-1.5 text-xs font-mono text-sky-400 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300 font-semibold block mb-1">
                    Type de valeur
                  </label>
                  <select
                    value={nouveauType}
                    onChange={(e) => setNouveauType(e.target.value as any)}
                    className="w-full bg-[#131722] border border-[#2a2e39] rounded-lg px-2 py-1.5 text-xs text-white outline-none"
                  >
                    <option value="number">Nombre (Numérique)</option>
                    <option value="boolean">Booléen (Oui / Non)</option>
                    <option value="string">Texte / Chaîne</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-semibold block mb-1">
                    Valeur par défaut
                  </label>
                  {nouveauType === 'boolean' ? (
                    <select
                      value={nouvelleValeurDefaut}
                      onChange={(e) => setNouvelleValeurDefaut(e.target.value)}
                      className="w-full bg-[#131722] border border-[#2a2e39] rounded-lg px-2 py-1.5 text-xs text-white outline-none"
                    >
                      <option value="true">Vrai (Activé)</option>
                      <option value="false">Faux (Désactivé)</option>
                    </select>
                  ) : (
                    <input
                      type={nouveauType === 'number' ? 'number' : 'text'}
                      value={nouvelleValeurDefaut}
                      onChange={(e) => setNouvelleValeurDefaut(e.target.value)}
                      className="w-full bg-[#131722] border border-[#2a2e39] rounded-lg px-2.5 py-1.5 text-xs font-mono text-white outline-none"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">
                  Catégorie / Groupe
                </label>
                <input
                  type="text"
                  placeholder="Ex: Calculs, Affichage, Filtres..."
                  value={nouveauGroupe}
                  onChange={(e) => setNouveauGroupe(e.target.value)}
                  className="w-full bg-[#131722] border border-[#2a2e39] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#2a2e39]">
                <button
                  type="button"
                  onClick={() => setModalAjoutOuverte(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg text-white shadow ${
                    estThemeVert ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-sky-600 hover:bg-sky-500'
                  }`}
                >
                  Ajouter au formulaire
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
