import React, { useState, useMemo } from 'react';
import type { SetupOrchestreSMC, ZoneShvedAvecScore } from '@/lib/indicators/favoris/orchestrateurSMC';
import { calculerPorteeDynamiqueUOP } from '@/lib/indicators/favoris/orchestrateurSMC';

interface DiagnosticVoletLateralSMCProps {
  // Le setup réel actuellement sélectionné
  setup: SetupOrchestreSMC;
  // Liste complète des setups détectés pour la navigation
  setupsTotaux?: SetupOrchestreSMC[];
  // Callback lors du changement de setup
  onSelectSetup?: (setup: SetupOrchestreSMC) => void;
  // Fermeture du volet
  onClose: () => void;
  // Callback lorsqu'une simulation interactive modifie les paramètres (carburant, péage)
  onSimulationChange?: (setupSimule: SetupOrchestreSMC | null) => void;
}

/**
 * 🔍 Volet Latéral Rétractable de Diagnostic SMC & Simulation TP en Direct
 * 
 * Permet au trader d'analyser le setup tout en gardant une visibilité totale sur les bougies :
 * 1. Voir la source du carburant (retests S/R et mèche de balayage).
 * 2. Suivre la simulation de parcours pas-à-pas (traversée des paliers UOP et mur bloquant).
 * 3. Expérimenter en direct avec des curseurs (carburant, péage) pour voir le TP bouger en temps réel sur le graphique.
 */
export function DiagnosticVoletLateralSMC({
  setup,
  setupsTotaux = [],
  onSelectSetup,
  onClose,
  onSimulationChange,
}: DiagnosticVoletLateralSMCProps) {
  // État de repliement du volet (mode réduit pour libérer tout le graphique si besoin)
  const [estReplie, setEstReplie] = useState(false);

  // Valeurs réelles issues du calcul initial
  const carburantReel = setup.carburantInitial ?? setup.detailsCarburant?.carburantTotal ?? 300;
  const peageReel = 100;

  // États des curseurs d'expérimentation en direct
  const [carburantSimule, setCarburantSimule] = useState<number>(carburantReel);
  const [peageSimule, setPeageSimule] = useState<number>(peageReel);
  const [modeExperimentation, setModeExperimentation] = useState(false);

  // Onglet sélectionné : 'simulation' (UOP & Paliers), 'sr' (Supports/Résistances)
  const [ongletActif, setOngletActif] = useState<'simulation' | 'sr'>('simulation');

  // Détection du type de position
  const estAchat = setup.type === 'ACHAT';
  const couleurBadge = estAchat
    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
    : 'bg-rose-500/15 border-rose-500/40 text-rose-300';

  // Navigation dans la liste des setups
  const indexActuel = setupsTotaux.findIndex((s) => s.id === setup.id);
  const aPrecedent = indexActuel > 0;
  const aSuivant = indexActuel >= 0 && indexActuel < setupsTotaux.length - 1;

  // Recalcul en direct de la simulation si le trader ajuste les curseurs
  const resultatSimulation = useMemo(() => {
    if (!modeExperimentation) {
      return null;
    }

    const tpsCandidats = setup.tousPaliersUOPCandidats || [];
    if (tpsCandidats.length === 0) return null;

    // Calcul de la portée dynamique avec les paramètres modifiés
    const res = calculerPorteeDynamiqueUOP({
      prixEntree: setup.prixEntree,
      prixSL: setup.prixSL,
      direction: setup.type,
      carburantInitial: carburantSimule,
      tpsCandidats,
      hauteurMoyenne: Math.max(0.0001, setup.distanceSL),
      peagePalierUOP: peageSimule,
      coutParATR: 50,
    });

    const distanceSL = Math.max(0.0001, Math.abs(setup.prixEntree - setup.prixSL));
    const distanceTP = Math.abs(res.prixTPOptimal - setup.prixEntree);
    const ratioRR = Number((distanceTP / distanceSL).toFixed(2));

    // Création d'un clone du setup avec les valeurs simulées
    const setupModifie: SetupOrchestreSMC = {
      ...setup,
      prixTP: res.prixTPOptimal,
      ordreTP: res.ordreTP,
      distanceTP,
      ratioRR,
      carburantInitial: res.carburantInitial,
      carburantRestant: res.carburantRestant,
      paliersTraverses: res.paliersTraverses,
      estLimiteParPalier: res.estLimiteParPalier,
      paliersAnalyses: res.paliersAnalyses,
      etapesPaliersUOP: res.etapesDetails,
    };

    return { res, setupModifie };
  }, [modeExperimentation, carburantSimule, peageSimule, setup]);

  // Propagation du setup simulé au graphique
  React.useEffect(() => {
    if (onSimulationChange) {
      if (modeExperimentation && resultatSimulation) {
        onSimulationChange(resultatSimulation.setupModifie);
      } else {
        onSimulationChange(null);
      }
    }
  }, [modeExperimentation, resultatSimulation, onSimulationChange]);

  // Données actives à afficher (réelles ou simulées)
  const setupAffiche = (modeExperimentation && resultatSimulation?.setupModifie) ? resultatSimulation.setupModifie : setup;
  const carburantActuel = setupAffiche.carburantInitial ?? carburantReel;
  const carburantRestant = setupAffiche.carburantRestant ?? 0;
  const etapesUOP = setupAffiche.etapesPaliersUOP || [];
  const detailsCarburant = setup.detailsCarburant;
  const zonesCandidates: ZoneShvedAvecScore[] = setup.zonesShvedCandidates || (setup.meilleureZoneShved ? [setup.meilleureZoneShved] : []);

  // Pourcentage de carburant consommé
  const pourcentageRestant = carburantActuel > 0
    ? Math.max(0, Math.min(100, Math.round((carburantRestant / carburantActuel) * 100)))
    : 0;

  // Réinitialiser les curseurs d'expérimentation aux valeurs d'origine
  const reinitialiserSimulation = () => {
    setCarburantSimule(carburantReel);
    setPeageSimule(peageReel);
    setModeExperimentation(false);
  };

  // Si le volet est replié, on affiche juste un bouton élégant pour le réouvrir
  if (estReplie) {
    return (
      <div className="absolute top-14 right-2 z-30 animate-in fade-in slide-in-from-right-4 duration-200">
        <button
          onClick={() => setEstReplie(false)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-cyan-500/50 text-white shadow-2xl backdrop-blur-md transition-all group"
          title="Rouvrir le volet de diagnostic SMC"
        >
          <span className="text-cyan-400 text-sm font-bold">🔍 Diag #{setup.indexDoji}</span>
          <span className="text-xs text-slate-400 group-hover:text-cyan-300">◀ Déplier</span>
        </button>
      </div>
    );
  }

  return (
    <div className="absolute top-0 right-0 bottom-0 z-30 w-84 sm:w-96 flex flex-col bg-[#131722]/95 backdrop-blur-md border-l border-[#2a2e39] text-slate-100 shadow-2xl select-none animate-in fade-in slide-in-from-right-6 duration-200">
      
      {/* ─── 1️⃣ En-tête du Volet Latéral ─── */}
      <div className="flex items-center justify-between px-3.5 py-3 border-b border-[#2a2e39] bg-[#1a1e29]/70">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEstReplie(true)}
            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition-colors text-xs"
            title="Replier le volet (libérer le graphique)"
          >
            ▶
          </button>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs text-white">Diagnostic SMC</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${couleurBadge}`}>
                {estAchat ? 'ACHAT' : 'VENTE'}
              </span>
              <span className="px-1.5 py-0.2 rounded text-[9.5px] font-mono bg-cyan-950/80 text-cyan-300 border border-cyan-700/40">
                #{setup.indexDoji}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              Entrée: {setup.prixEntree} · SL: {setup.prixSL}
            </span>
          </div>
        </div>

        {/* Navigation entre setups & Bouton Fermer */}
        <div className="flex items-center gap-1">
          {setupsTotaux.length > 1 && (
            <div className="flex items-center bg-[#0d1017] rounded-md border border-[#2a2e39] p-0.5">
              <button
                onClick={() => aPrecedent && onSelectSetup && onSelectSetup(setupsTotaux[indexActuel - 1])}
                disabled={!aPrecedent}
                className="px-1.5 py-0.5 text-[10px] text-slate-300 hover:text-white disabled:opacity-25 transition-colors"
                title="Setup précédent"
              >
                ◀
              </button>
              <span className="text-[9px] font-mono px-1 text-slate-400">
                {indexActuel + 1}/{setupsTotaux.length}
              </span>
              <button
                onClick={() => aSuivant && onSelectSetup && onSelectSetup(setupsTotaux[indexActuel + 1])}
                disabled={!aSuivant}
                className="px-1.5 py-0.5 text-[10px] text-slate-300 hover:text-white disabled:opacity-25 transition-colors"
                title="Setup suivant"
              >
                ▶
              </button>
            </div>
          )}
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition-colors text-xs ml-1"
            title="Fermer le diagnostic"
          >
            ✕
          </button>
        </div>
      </div>

      {/* ─── 2️⃣ Onglets de Navigation ─── */}
      <div className="flex border-b border-[#2a2e39] bg-[#0d1017]/60 text-xs">
        <button
          onClick={() => setOngletActif('simulation')}
          className={`flex-1 py-2 font-semibold text-center border-b-2 transition-colors flex items-center justify-center gap-1.5 text-[11px] ${
            ongletActif === 'simulation'
              ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>⚡ Simulation TP & UOP</span>
        </button>
        <button
          onClick={() => setOngletActif('sr')}
          className={`flex-1 py-2 font-semibold text-center border-b-2 transition-colors flex items-center justify-center gap-1.5 text-[11px] ${
            ongletActif === 'sr'
              ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>🎯 S/R Shved ({zonesCandidates.length})</span>
        </button>
      </div>

      {/* ─── 3️⃣ Corps Défilable ─── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3.5 text-xs">

        {/* ═══════════════ ONGLET SIMULATION TP & UOP ═══════════════ */}
        {ongletActif === 'simulation' && (
          <>
            {/* Résumé de l'Objectif TP Optimal */}
            <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-950/30 to-slate-900/60 border border-emerald-500/40 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1">
                  🎯 TAKE PROFIT OPTIMAL (UOP)
                </span>
                <span className="font-mono font-bold text-xs text-white px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40">
                  {setupAffiche.prixTP ?? '-'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10.5px] text-slate-300 font-mono">
                <span>Ratio Risque/Rendement :</span>
                <span className="font-bold text-emerald-400">{setupAffiche.ratioRR} R</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <span>Paliers UOP traversés :</span>
                <span className="text-cyan-300 font-bold">{setupAffiche.paliersTraverses ?? 0}</span>
              </div>
            </div>

            {/* Jauge d'Énergie et Carburant */}
            <div className="p-3 rounded-xl bg-[#181c27] border border-cyan-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-cyan-400 text-xs flex items-center gap-1">
                  ⚡ Carburant de Liquidation
                </span>
                <span className="font-mono font-bold text-xs text-cyan-300">
                  {carburantRestant} / {carburantActuel} pts
                </span>
              </div>

              {/* Barre de progression visuelle */}
              <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden border border-white/5 relative">
                <div
                  className="h-full rounded-full transition-all duration-300 bg-gradient-to-r from-emerald-500 via-cyan-400 to-amber-400"
                  style={{ width: `${pourcentageRestant}%` }}
                />
              </div>

              {/* Décomposition source du carburant */}
              <div className="p-2 rounded-lg bg-black/30 border border-white/5 text-[10px] font-mono text-slate-300 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">• Retests S/R ({detailsCarburant?.nombreRetests ?? 0}) :</span>
                  <span className="font-bold text-white">{detailsCarburant?.pointsRetests ?? 0} pts</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">• Multiplicateur mèche :</span>
                  <span className="font-bold text-cyan-300">x{detailsCarburant?.multiplicateurMeche ?? 1.0}</span>
                </div>
                <div className="flex justify-between border-t border-white/5 pt-1 text-emerald-300 font-bold">
                  <span>➔ Réservoir Initial Total :</span>
                  <span>{setup.carburantInitial ?? 0} pts</span>
                </div>
              </div>
            </div>

            {/* ─── 🧪 Simulateur d'Expérimentation Directe (Point 3) ─── */}
            <div className="p-3 rounded-xl bg-[#181c27]/80 border border-amber-500/30 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-300 text-xs flex items-center gap-1">
                  🧪 Expérimenter en Direct
                </span>
                {modeExperimentation && (
                  <button
                    onClick={reinitialiserSimulation}
                    className="text-[9.5px] px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 transition-colors"
                  >
                    ↺ Valeurs réelles
                  </button>
                )}
              </div>

              {/* Curseur 1 : Carburant Total */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10.5px]">
                  <span className="text-slate-400">Carburant Initial :</span>
                  <span className="font-mono font-bold text-amber-300">{carburantSimule} pts</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="1000"
                  step="25"
                  value={carburantSimule}
                  onChange={(e) => {
                    setCarburantSimule(Number(e.target.value));
                    setModeExperimentation(true);
                  }}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
              </div>

              {/* Curseur 2 : Coût Péage Palier */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10.5px]">
                  <span className="text-slate-400">Péage par Palier UOP :</span>
                  <span className="font-mono font-bold text-amber-300">{peageSimule} pts</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="250"
                  step="10"
                  value={peageSimule}
                  onChange={(e) => {
                    setPeageSimule(Number(e.target.value));
                    setModeExperimentation(true);
                  }}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
              </div>

              {modeExperimentation && (
                <div className="text-[10px] text-amber-300/90 italic bg-amber-950/20 p-1.5 rounded border border-amber-500/20">
                  ⚡ Simulation active : Le TP et la portée sur le graphique sont mis à jour en direct !
                </div>
              )}
            </div>

            {/* ─── 🛣️ Timeline Pas-à-Pas des Paliers UOP ─── */}
            <div className="space-y-2">
              <span className="text-[10.5px] font-bold text-slate-300 uppercase tracking-wider block">
                Voyage à Travers les Paliers UOP
              </span>

              {etapesUOP.length === 0 ? (
                <div className="p-3 rounded-lg bg-black/20 border border-white/5 text-slate-400 text-center text-[11px]">
                  Aucun palier UOP n'a été rencontré devant ce setup.
                </div>
              ) : (
                <div className="space-y-2">
                  {etapesUOP.map((etape) => (
                    <div
                      key={etape.ordre}
                      className={`p-2.5 rounded-lg border transition-all ${
                        etape.estPerce
                          ? 'bg-sky-950/20 border-sky-500/40 text-sky-200'
                          : 'bg-amber-950/25 border-amber-500/50 text-amber-200 ring-1 ring-amber-500/20'
                      }`}
                    >
                      <div className="flex items-center justify-between pb-1 border-b border-white/10">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-white">
                            Palier #{etape.ordre}
                          </span>
                          <span className="font-mono text-[10.5px] text-slate-300">
                            @ {etape.prixCible}
                          </span>
                        </div>
                        <span className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold border ${
                          etape.estPerce
                            ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        }`}>
                          {etape.estPerce ? '✓ PERCÉ' : '🛑 MUR BLOQUANT'}
                        </span>
                      </div>

                      <div className="mt-1.5 grid grid-cols-2 gap-1.5 text-[9.5px] font-mono text-slate-300">
                        <div>
                          • Péage : <span className="font-bold text-white">-{etape.peagePalier} pts</span>
                        </div>
                        <div>
                          • Reste : <span className="font-bold text-cyan-300">{etape.budgetApres} pts</span>
                        </div>
                      </div>

                      <div className="mt-1 text-[9px] text-slate-400 italic">
                        {etape.explication}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ═══════════════ ONGLET SUPPORTS & RÉSISTANCES ═══════════════ */}
        {ongletActif === 'sr' && (
          <div className="space-y-2.5">
            <span className="text-[10.5px] font-bold text-slate-300 uppercase tracking-wider block">
              Zones Shved Analysées dans la Plage
            </span>

            {zonesCandidates.length === 0 ? (
              <div className="p-3 rounded-lg bg-black/20 border border-white/5 text-slate-400 text-center text-[11px]">
                Aucune zone Shved candidate n'a été détectée dans la plage.
              </div>
            ) : (
              <div className="space-y-2">
                {zonesCandidates.map((candidat, idx) => {
                  const estRetenue = setup.meilleureZoneShved?.zone.id === candidat.zone.id;
                  return (
                    <div
                      key={candidat.zone.id || idx}
                      className={`p-2.5 rounded-lg border transition-all ${
                        estRetenue
                          ? 'bg-emerald-950/25 border-emerald-500/50 ring-1 ring-emerald-500/20'
                          : 'bg-[#181c27]/60 border-[#2a2e39] opacity-75'
                      }`}
                    >
                      <div className="flex items-center justify-between pb-1 border-b border-white/5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-white">
                            {candidat.zone.type === 'SUPPORT' ? '🟢 Support' : '🔴 Résistance'}
                          </span>
                          {estRetenue && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/30 text-emerald-200 border border-emerald-500/40">
                              ⭐ UTILISÉ
                            </span>
                          )}
                        </div>
                        <span className="font-bold font-mono text-[10.5px] text-amber-400">
                          {candidat.score}/100 pts
                        </span>
                      </div>

                      <div className="mt-1.5 grid grid-cols-3 gap-1 text-[9.5px] font-mono text-center">
                        <div className="p-1 rounded bg-black/20">
                          <span className="text-[8.5px] text-slate-400 block font-sans">Médian</span>
                          <span className="font-bold text-white">{candidat.zone.prixMedian}</span>
                        </div>
                        <div className="p-1 rounded bg-black/20">
                          <span className="text-[8.5px] text-slate-400 block font-sans">Haut</span>
                          <span className="text-slate-300">{candidat.zone.prixHaut}</span>
                        </div>
                        <div className="p-1 rounded bg-black/20">
                          <span className="text-[8.5px] text-slate-400 block font-sans">Bas</span>
                          <span className="text-slate-300">{candidat.zone.prixBas}</span>
                        </div>
                      </div>

                      <div className="mt-1 text-[9px] text-slate-400 font-mono flex justify-between">
                        <span>Retests: {candidat.retestsAvant} ({candidat.pointsRetests} pts)</span>
                        <span>Rejet: {candidat.pointsRejets} pts</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
