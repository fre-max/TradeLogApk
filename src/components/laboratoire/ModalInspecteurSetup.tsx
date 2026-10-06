import React, { useState, useEffect } from 'react';
import { useLaboratoireStore } from '@/store/laboratoireStore';
import type { FicheSetupSonde } from '@/lib/bot/laboratoire/types';

export const ModalInspecteurSetup: React.FC = () => {
  const setupInitial = useLaboratoireStore((s) => s.setupEnCoursInspection);
  const estOuvert = useLaboratoireStore((s) => s.inspecteurOuvert);
  const fermerInspecteur = useLaboratoireStore((s) => s.fermerInspecteur);
  const sauvegarderSetup = useLaboratoireStore((s) => s.sauvegarderSetup);

  const [setup, setSetup] = useState<FicheSetupSonde | null>(setupInitial);

  useEffect(() => {
    setSetup(setupInitial);
  }, [setupInitial]);

  if (!estOuvert || !setup) return null;

  const estAchat = setup.direction === 'ACHAT';

  const handleChangerTitre = (val: string) => {
    setSetup((prev) => (prev ? { ...prev, titre: val } : null));
  };

  const handleChangerNote = (note: 'A+' | 'A' | 'B') => {
    setSetup((prev) => (prev ? { ...prev, noteQualite: note } : null));
  };

  const handleChangerNotesTrader = (notes: string) => {
    setSetup((prev) => (prev ? { ...prev, notesTrader: notes } : null));
  };

  const handleSauvegarder = () => {
    if (setup) {
      sauvegarderSetup(setup);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#1e222d] border border-[#2a2e39] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* En-tête de la Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2e39] bg-[#171b26]">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${estAchat ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse`} />
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>🔬 Sondeur de Setup :</span>
                <span className={estAchat ? 'text-emerald-400' : 'text-rose-400'}>
                  {estAchat ? 'Achat (Spring Wyckoff)' : 'Vente (UTAD Wyckoff)'}
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                Bougie #{setup.indexBougieSweep} • {setup.paire} ({setup.timeframe})
              </p>
            </div>
          </div>

          <button
            onClick={fermerInspecteur}
            className="text-gray-400 hover:text-white p-1 rounded-lg transition-colors text-lg"
          >
            ✕
          </button>
        </div>

        {/* Corps de l'Inspecteur (Scrollable) */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-sm text-gray-200">
          {/* Titre et Note du setup */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-400 mb-1 font-medium">Libellé du Setup :</label>
              <input
                type="text"
                value={setup.titre}
                onChange={(e) => handleChangerTitre(e.target.value)}
                className="w-full bg-[#131722] border border-[#2a2e39] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1 font-medium">Qualité du Setup :</label>
              <div className="flex gap-2">
                {(['A+', 'A', 'B'] as const).map((note) => (
                  <button
                    key={note}
                    type="button"
                    onClick={() => handleChangerNote(note)}
                    className={`flex-1 py-2 rounded-lg font-bold text-xs transition-colors ${
                      setup.noteQualite === note
                        ? 'bg-blue-600 text-white shadow'
                        : 'bg-[#131722] text-gray-400 hover:text-white border border-[#2a2e39]'
                    }`}
                  >
                    {note}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ─── GRILLE DES 4 CAPTEURS D'ANALYSE ─── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Capteur Liquidité */}
            <div className="bg-[#131722] border border-[#2a2e39] rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-amber-400 border-b border-[#2a2e39] pb-2">
                <span className="flex items-center gap-1.5">
                  <span>🎯</span> 1. Liquidité Percutée
                </span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded">
                  {setup.liquidite.type}
                </span>
              </div>
              <p className="text-xs text-gray-300">{setup.liquidite.description}</p>
              <div className="flex justify-between items-center text-xs pt-1">
                <span className="text-gray-400">Niveau de prix :</span>
                <span className="font-mono font-bold text-white">{setup.liquidite.prixNiveau.toFixed(5)}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400">Ancienneté du niveau :</span>
                <span className="text-gray-300">{setup.liquidite.bougiesEcoulees} bougies</span>
              </div>
            </div>

            {/* 2. Capteur Sweep */}
            <div className="bg-[#131722] border border-[#2a2e39] rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-cyan-400 border-b border-[#2a2e39] pb-2">
                <span className="flex items-center gap-1.5">
                  <span>📏</span> 2. Incursion / Sweep
                </span>
                <span className="font-mono text-cyan-300 font-bold">
                  {setup.sweep.profondeurPips} pips
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400">Prix Protégé (SL Extrême) :</span>
                <span className="font-mono text-white font-bold">{setup.sweep.prixProtegeExtreme.toFixed(5)}</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Ratio Mèche de rejet :</span>
                  <span className="font-bold text-cyan-300">{setup.sweep.ratioMechePourcent}%</span>
                </div>
                <div className="w-full bg-[#1e222d] rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-cyan-500 h-1.5 rounded-full"
                    style={{ width: `${setup.sweep.ratioMechePourcent}%` }}
                  />
                </div>
              </div>
              <div className="flex justify-between items-center text-xs pt-0.5">
                <span className="text-gray-400">Bougies passées hors zone :</span>
                <span className="text-gray-300">{setup.sweep.bougiesHorsZone} bougie(s)</span>
              </div>
            </div>

            {/* 3. Capteur Réintégration */}
            <div className="bg-[#131722] border border-[#2a2e39] rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-400 border-b border-[#2a2e39] pb-2">
                <span className="flex items-center gap-1.5">
                  <span>⚡</span> 3. Réintégration & Rejet
                </span>
                <span className="text-xs text-emerald-300">
                  {setup.reintegration.delaiBougies === 0 ? 'Immédiat (0b)' : `En ${setup.reintegration.delaiBougies} bougie(s)`}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400">Amplitude du rejet :</span>
                <span className="font-mono font-bold text-emerald-300">+{setup.reintegration.amplitudeRejetPips} pips</span>
              </div>
              <div className="flex gap-2 pt-1">
                <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                  setup.reintegration.aDisplacement ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gray-800 text-gray-500'
                }`}>
                  {setup.reintegration.aDisplacement ? '✅ Displacement Net' : '∅ Pas de Displacement'}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                  setup.reintegration.aFvg ? 'bg-purple-500/20 text-purple-300' : 'bg-gray-800 text-gray-500'
                }`}>
                  {setup.reintegration.aFvg ? '✅ FVG Détecté' : '∅ Pas de FVG'}
                </span>
              </div>
            </div>

            {/* 4. Capteur Range Post-Sweep */}
            <div className="bg-[#131722] border border-[#2a2e39] rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-indigo-400 border-b border-[#2a2e39] pb-2">
                <span className="flex items-center gap-1.5">
                  <span>📦</span> 4. Range Post-Sweep
                </span>
                <span className="font-mono text-indigo-300">
                  ~{setup.rangePostSweep.dureeBougies} bougies
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400">Amplitude du range :</span>
                <span className="font-mono font-bold text-white">{setup.rangePostSweep.amplitudeRangePips} pips</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400">SL Protégé intact :</span>
                <span className={`font-bold ${setup.rangePostSweep.prixProtegePreserve ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {setup.rangePostSweep.prixProtegePreserve ? '✅ Oui (Inviolé)' : '❌ Non (Cassé)'}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs pt-1 border-t border-[#1e222d]">
                <span className="text-gray-400">Entrée idéale suggérée :</span>
                <span className="font-mono text-blue-400 font-bold">{setup.rangePostSweep.prixEntreeSuggere.toFixed(5)}</span>
              </div>
            </div>
          </div>

          {/* Remarques / Observations du trader */}
          <div>
            <label className="block text-xs text-gray-400 mb-1 font-medium">Notes & Observations personnelles :</label>
            <textarea
              rows={2}
              value={setup.notesTrader || ''}
              onChange={(e) => handleChangerNotesTrader(e.target.value)}
              placeholder="Ex: Belle compression avant l'ouverture de New York, volume élevé sur la mèche..."
              className="w-full bg-[#131722] border border-[#2a2e39] rounded-lg p-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-xs"
            />
          </div>
        </div>

        {/* Pied de page avec actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#2a2e39] bg-[#171b26]">
          <button
            type="button"
            onClick={fermerInspecteur}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-400 hover:text-white hover:bg-[#2a2e39] transition-colors"
          >
            Annuler
          </button>

          <button
            type="button"
            onClick={handleSauvegarder}
            className="px-5 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30 transition-all flex items-center gap-2"
          >
            <span>💾</span>
            <span>Sauvegarder dans ma Banque de Setups</span>
          </button>
        </div>
      </div>
    </div>
  );
};
