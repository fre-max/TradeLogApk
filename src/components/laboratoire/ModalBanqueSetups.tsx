import React, { useMemo } from 'react';
import { useLaboratoireStore } from '@/store/laboratoireStore';
import { calculerSyntheseSetups } from '@/lib/bot/laboratoire/sondeurSetup';
import { useUIStore } from '@/store';

/**
 * 🧪 Modale de la Banque de Setups & Rétro-Ingénierie
 * 
 * Permet de visualiser l'ensemble des fiches capturées avec la sonde,
 * de filtrer par note qualité (A+, A, B), par paire, par direction ou mot-clé,
 * et de recalculer en temps réel les invariants statistiques et règles d'or du futur bot !
 */
export const ModalBanqueSetups: React.FC = () => {
  const estOuvert = useLaboratoireStore((s) => s.banqueOuverte);
  const fermerBanque = useLaboratoireStore((s) => s.fermerBanque);
  const setups = useLaboratoireStore((s) => s.setups);
  const supprimerSetup = useLaboratoireStore((s) => s.supprimerSetup);
  const ouvrirInspecteur = useLaboratoireStore((s) => s.ouvrirInspecteur);
  const addToast = useUIStore((s) => s.addToast);

  // Filtres issus du store
  const filtreNote = useLaboratoireStore((s) => s.filtreNoteQualite);
  const setFiltreNote = useLaboratoireStore((s) => s.definirFiltreNoteQualite);
  const filtreDirection = useLaboratoireStore((s) => s.filtreDirection);
  const setFiltreDirection = useLaboratoireStore((s) => s.definirFiltreDirection);
  const filtrePaire = useLaboratoireStore((s) => s.filtrePaire);
  const setFiltrePaire = useLaboratoireStore((s) => s.definirFiltrePaire);
  const recherche = useLaboratoireStore((s) => s.rechercheTitre);
  const setRecherche = useLaboratoireStore((s) => s.definirRechercheTitre);
  const reinitialiserFiltres = useLaboratoireStore((s) => s.reinitialiserFiltres);

  // 1️⃣ Extraction des paires uniques disponibles parmi les setups
  const pairesDisponibles = useMemo(() => {
    const ens = new Set<string>();
    for (const s of setups) {
      if (s.paire) ens.add(s.paire.toUpperCase());
    }
    return Array.from(ens);
  }, [setups]);

  // 2️⃣ Comptage par note pour les badges des boutons
  const comptagesNotes = useMemo(() => {
    return {
      tous: setups.length,
      aPlus: setups.filter((s) => s.noteQualite === 'A+').length,
      a: setups.filter((s) => s.noteQualite === 'A').length,
      b: setups.filter((s) => s.noteQualite === 'B').length,
    };
  }, [setups]);

  // 3️⃣ Filtrage direct des fiches de setups
  const setupsFiltres = useMemo(() => {
    return setups.filter((s) => {
      // Filtre Note
      if (filtreNote !== 'TOUS' && s.noteQualite !== filtreNote) return false;
      // Filtre Direction
      if (filtreDirection !== 'TOUS' && s.direction !== filtreDirection) return false;
      // Filtre Paire
      if (filtrePaire !== 'TOUTES' && s.paire.toUpperCase() !== filtrePaire.toUpperCase()) return false;
      // Filtre Recherche textuelle
      if (recherche.trim()) {
        const query = recherche.toLowerCase();
        const matchTitre = s.titre.toLowerCase().includes(query);
        const matchPaire = s.paire.toLowerCase().includes(query);
        const matchNotes = (s.notesTrader || '').toLowerCase().includes(query);
        if (!matchTitre && !matchPaire && !matchNotes) return false;
      }
      return true;
    });
  }, [setups, filtreNote, filtreDirection, filtrePaire, recherche]);

  // 4️⃣ Synthèse statistique recalculée dynamiquement sur l'échantillon filtré
  const synthese = useMemo(() => {
    return calculerSyntheseSetups(setupsFiltres);
  }, [setupsFiltres]);

  const estFiltreActif =
    filtreNote !== 'TOUS' ||
    filtreDirection !== 'TOUS' ||
    filtrePaire !== 'TOUTES' ||
    recherche.trim().length > 0;

  if (!estOuvert) return null;

  // Copie des règles recommandées dans le presse-papier
  const copierRegles = () => {
    const texte = JSON.stringify(synthese.reglesRecommandees, null, 2);
    navigator.clipboard.writeText(texte);
    addToast('Règles du bot copiées dans le presse-papier !', 'success');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-[#1e222d] border border-[#2a2e39] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        
        {/* ─── EN-TÊTE DE LA BANQUE ─── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#2a2e39] bg-[#171b26]">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🧪</span>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                Banque de Setups & Rétro-Ingénierie
                <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-mono">
                  {setupsFiltres.length} / {setups.length} setup(s)
                </span>
              </h2>
              <p className="text-[11px] text-gray-400">
                Filtrez vos meilleurs setups pour calibrer votre bot avec une précision chirurgicale.
              </p>
            </div>
          </div>

          <button
            onClick={fermerBanque}
            className="text-gray-400 hover:text-white p-1 rounded-lg transition-colors text-lg"
          >
            ✕
          </button>
        </div>

        {/* ─── BARRE DE FILTRES UNIVERSELLE ─── */}
        <div className="bg-[#151924] border-b border-[#2a2e39] px-5 py-3 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            
            {/* 🌟 Filtre par Note Qualité */}
            <div className="flex items-center gap-1.5 bg-[#1e222d] p-1 rounded-xl border border-[#2a2e39]">
              <span className="text-[11px] font-bold text-gray-400 px-2">Qualité :</span>
              
              <button
                type="button"
                onClick={() => setFiltreNote('TOUS')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  filtreNote === 'TOUS'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                Tous ({comptagesNotes.tous})
              </button>

              <button
                type="button"
                onClick={() => setFiltreNote('A+')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  filtreNote === 'A+'
                    ? 'bg-amber-500 text-black font-black shadow-md shadow-amber-500/20'
                    : 'text-amber-400 hover:bg-amber-500/10'
                }`}
              >
                <span>⭐ A+</span>
                <span className="text-[10px] opacity-80">({comptagesNotes.aPlus})</span>
              </button>

              <button
                type="button"
                onClick={() => setFiltreNote('A')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  filtreNote === 'A'
                    ? 'bg-emerald-600 text-white font-bold shadow'
                    : 'text-emerald-400 hover:bg-emerald-500/10'
                }`}
              >
                <span>🟢 A</span>
                <span className="text-[10px] opacity-80">({comptagesNotes.a})</span>
              </button>

              <button
                type="button"
                onClick={() => setFiltreNote('B')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  filtreNote === 'B'
                    ? 'bg-indigo-600 text-white font-bold shadow'
                    : 'text-indigo-400 hover:bg-indigo-500/10'
                }`}
              >
                <span>🔵 B</span>
                <span className="text-[10px] opacity-80">({comptagesNotes.b})</span>
              </button>
            </div>

            {/* ⬆️⬇️ Filtre par Direction */}
            <div className="flex items-center gap-1 bg-[#1e222d] p-1 rounded-xl border border-[#2a2e39]">
              <button
                type="button"
                onClick={() => setFiltreDirection('TOUS')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  filtreDirection === 'TOUS' ? 'bg-[#2a2e39] text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Tous
              </button>
              <button
                type="button"
                onClick={() => setFiltreDirection('ACHAT')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  filtreDirection === 'ACHAT'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold'
                    : 'text-emerald-400/70 hover:text-emerald-400'
                }`}
              >
                ↑ Long
              </button>
              <button
                type="button"
                onClick={() => setFiltreDirection('VENTE')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  filtreDirection === 'VENTE'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 font-bold'
                    : 'text-rose-400/70 hover:text-rose-400'
                }`}
              >
                ↓ Short
              </button>
            </div>

            {/* 💱 Filtre Paire */}
            {pairesDisponibles.length > 0 && (
              <select
                value={filtrePaire}
                onChange={(e) => setFiltrePaire(e.target.value)}
                className="bg-[#1e222d] border border-[#2a2e39] text-xs font-medium text-white px-2.5 py-1.5 rounded-xl focus:outline-none focus:border-blue-500"
              >
                <option value="TOUTES">Toutes les paires</option>
                {pairesDisponibles.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            )}

            {/* 🔍 Recherche texte */}
            <div className="relative flex-1 min-w-[140px] max-w-[220px]">
              <input
                type="text"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="🔍 Titre ou note..."
                className="w-full bg-[#1e222d] border border-[#2a2e39] text-xs text-white px-2.5 py-1.5 rounded-xl focus:outline-none focus:border-blue-500 placeholder:text-gray-500"
              />
              {recherche && (
                <button
                  type="button"
                  onClick={() => setRecherche('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Réinitialiser */}
            {estFiltreActif && (
              <button
                type="button"
                onClick={reinitialiserFiltres}
                className="text-xs text-rose-400 hover:text-rose-300 underline font-medium px-1 py-1"
              >
                Effacer filtres
              </button>
            )}
          </div>
        </div>

        {/* ─── CORPS PRINCIPAL SCROLLABLE ─── */}
        <div className="p-5 space-y-6 overflow-y-auto flex-1 text-sm text-gray-200">
          
          {setups.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <span className="text-4xl">🎯</span>
              <h3 className="text-base font-bold text-white">Aucun setup sondé pour le moment</h3>
              <p className="text-xs text-gray-400 max-w-md mx-auto">
                Rejouez un trade depuis le Journal ou ouvrez le Replay, puis cliquez sur <b>« 🎯 Sonder Setup »</b> pour capturer les caractéristiques exactes de vos setups favoris.
              </p>
            </div>
          ) : setupsFiltres.length === 0 ? (
            <div className="text-center py-12 space-y-3 bg-[#131722] border border-[#2a2e39] rounded-xl p-6">
              <span className="text-3xl">🔍</span>
              <h3 className="text-sm font-bold text-white">Aucun setup ne correspond à vos filtres</h3>
              <p className="text-xs text-gray-400">
                Essayez d'élargir la note qualité ou d'effacer le terme de recherche.
              </p>
              <button
                type="button"
                onClick={reinitialiserFiltres}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold"
              >
                Afficher tous les setups ({setups.length})
              </button>
            </div>
          ) : (
            <>
              {/* ─── 📊 SYNTHÈSE STATISTIQUE DYNAMIQUE ─── */}
              <div className="bg-[#131722] border border-[#2a2e39] rounded-xl p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#2a2e39] pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base">📈</span>
                    <h3 className="text-sm font-bold text-white">
                      Invariants Statistiques
                      {filtreNote !== 'TOUS' && (
                        <span className="ml-2 text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded font-mono font-bold">
                          Échantillon {filtreNote} ({setupsFiltres.length})
                        </span>
                      )}
                    </h3>
                  </div>

                  <div className="text-xs flex gap-3 text-gray-400 font-mono">
                    <span className="text-emerald-400">Achats : {synthese.totalAchats}</span>
                    <span className="text-rose-400">Ventes : {synthese.totalVentes}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* Carte 1 : Profondeur Sweep */}
                  <div className="bg-[#1e222d] p-3 rounded-lg border border-[#2a2e39]">
                    <span className="text-[11px] text-gray-400 block mb-1">Sweep Moyen</span>
                    <span className="text-lg font-bold font-mono text-cyan-400">
                      {synthese.profondeurSweepMoyennePips} pips
                    </span>
                    <span className="text-[10px] text-gray-500 block mt-0.5">
                      Min: {synthese.profondeurSweepMinPips}p • Max: {synthese.profondeurSweepMaxPips}p
                    </span>
                  </div>

                  {/* Carte 2 : Ratio Mèche */}
                  <div className="bg-[#1e222d] p-3 rounded-lg border border-[#2a2e39]">
                    <span className="text-[11px] text-gray-400 block mb-1">Rejet Mèche Moyen</span>
                    <span className="text-lg font-bold font-mono text-amber-400">
                      {synthese.ratioMecheMoyenPourcent}%
                    </span>
                    <span className="text-[10px] text-gray-500 block mt-0.5">
                      Proportion mèche / corps
                    </span>
                  </div>

                  {/* Carte 3 : Réintégration */}
                  <div className="bg-[#1e222d] p-3 rounded-lg border border-[#2a2e39]">
                    <span className="text-[11px] text-gray-400 block mb-1">Délai Réintégration</span>
                    <span className="text-lg font-bold font-mono text-emerald-400">
                      {synthese.delaiReintegrationMoyenBougies} bougie(s)
                    </span>
                    <span className="text-[10px] text-gray-500 block mt-0.5">
                      {synthese.pourcentageDisplacement}% avec Displacement
                    </span>
                  </div>

                  {/* Carte 4 : Range Post-Sweep */}
                  <div className="bg-[#1e222d] p-3 rounded-lg border border-[#2a2e39]">
                    <span className="text-[11px] text-gray-400 block mb-1">Range Post-Sweep</span>
                    <span className="text-lg font-bold font-mono text-indigo-400">
                      ~{synthese.dureeMoyenneRangeBougies} bougies
                    </span>
                    <span className="text-[10px] text-emerald-400 block mt-0.5 font-bold">
                      {synthese.pourcentagePrixProtegePreserve}% SL protégé respecté
                    </span>
                  </div>
                </div>

                {/* ─── 🤖 RÈGLES CALIBRÉES POUR LE BOT ─── */}
                <div className="bg-gradient-to-r from-blue-950/40 to-indigo-950/40 border border-blue-800/40 rounded-xl p-3.5 text-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-blue-300">
                        🎯 Règles d'Or Recommandées pour le Bot :
                      </span>
                      {filtreNote === 'A+' && (
                        <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-bold">
                          100% calibré sur vos trades A+
                        </span>
                      )}
                    </div>
                    <span className="text-gray-300 text-xs">
                      Sweep entre <b>{synthese.reglesRecommandees.sweepPipsMin}</b> et <b>{synthese.reglesRecommandees.sweepPipsMax} pips</b> • Réintégration sous <b>{synthese.reglesRecommandees.delaiReintegrationMax} bougies</b> • Range de <b>{synthese.reglesRecommandees.dureeRangeCible} bougies</b> • Mèche min <b>{synthese.reglesRecommandees.ratioMecheMin}%</b>.
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={copierRegles}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-mono text-xs whitespace-nowrap font-semibold transition-colors flex items-center gap-1.5"
                    title="Copier les paramètres calibrés au format JSON"
                  >
                    <span>📋 Copier règles</span>
                  </button>
                </div>
              </div>

              {/* ─── 📋 LISTE DES ÉCHANTILLONS FILTRÉS ─── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Échantillons ({setupsFiltres.length}) :
                  </h3>
                  {estFiltreActif && (
                    <span className="text-[11px] text-gray-500">
                      {setups.length - setupsFiltres.length} masqué(s) par les filtres
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  {setupsFiltres.map((s) => {
                    const estAchat = s.direction === 'ACHAT';
                    return (
                      <div
                        key={s.id}
                        className="bg-[#131722] hover:bg-[#181d2a] border border-[#2a2e39] rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            estAchat ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                          }`}>
                            {s.direction}
                          </span>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-sm">{s.titre}</span>
                              <span className={`text-[10px] font-black px-1.5 py-0.2 rounded ${
                                s.noteQualite === 'A+'
                                  ? 'bg-amber-500 text-black'
                                  : s.noteQualite === 'A'
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-indigo-600 text-white'
                              }`}>
                                {s.noteQualite}
                              </span>
                              {s.paire && (
                                <span className="text-[10px] font-mono text-gray-400 bg-white/5 px-1.5 py-0.5 rounded">
                                  {s.paire}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {s.liquidite.description} • Sweep de <b>{s.sweep.profondeurPips} pips</b> ({s.sweep.ratioMechePourcent}% mèche) • Réintégration: <b>{s.reintegration.delaiBougies}b</b> • Range: <b>{s.rangePostSweep.dureeBougies}b</b>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => ouvrirInspecteur(s)}
                            className="px-3 py-1.5 bg-[#2a2e39] hover:bg-blue-600 text-white text-xs rounded-lg transition-colors"
                          >
                            Détails
                          </button>
                          <button
                            type="button"
                            onClick={() => supprimerSetup(s.id)}
                            className="px-2 py-1.5 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 text-xs rounded-lg transition-colors"
                            title="Supprimer cet échantillon"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ─── PIED DE PAGE ─── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-[#2a2e39] bg-[#171b26]">
          <span className="text-xs text-gray-400">
            {setupsFiltres.length >= 10
              ? '✅ Échantillonnage solide pour coder le bot institutionnel.'
              : `🎯 Continuez à sonder (recommandé: 10 à 20 échantillons, actuellement ${setupsFiltres.length}).`}
          </span>

          <button
            type="button"
            onClick={fermerBanque}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#2a2e39] hover:bg-[#363a45] text-white transition-colors"
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
};
