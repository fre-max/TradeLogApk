import React, { useState } from 'react';
import type { SignalSandboxPlage, ZoneShvedAvecScore } from '@/lib/indicators/favoris/sandboxDojiShvedPlage';

interface DiagnosticVoletLateralSandboxProps {
  // Le signal Sandbox actuel inspecté
  signal: SignalSandboxPlage;
  // Liste complète des signaux Sandbox pour la navigation
  signauxTotaux?: SignalSandboxPlage[];
  // Zone Shved actuellement sélectionnée / cliquée pour inspection
  zoneSelectionneeId?: string | null;
  // Callback lors du clic sur une zone Shved
  onSelectZone?: (zoneId: string | null) => void;
  // Callback lors du changement de signal
  onSelectSignal?: (signal: SignalSandboxPlage) => void;
  // Fermeture du volet
  onClose: () => void;
}

/**
 * 🔍 Volet Latéral Rétractable de Diagnostic Sandbox (Doji + S/R Shved dans la Plage)
 * 
 * Permet au trader d'inspecter en direct tous les supports/résistances apparus
 * dans la plage temporelle d'un Doji, de cliquer sur n'importe quel niveau pour
 * comprendre son score et analyser pourquoi il a été retenu ou écarté.
 */
export function DiagnosticVoletLateralSandbox({
  signal,
  signauxTotaux = [],
  zoneSelectionneeId,
  onSelectZone,
  onSelectSignal,
  onClose,
}: DiagnosticVoletLateralSandboxProps) {
  // État de repliement du volet (mode réduit pour libérer le graphique)
  const [estReplie, setEstReplie] = useState(false);

  // Type de setup
  const estAchat = signal.type === 'ACHAT';
  const couleurBadge = estAchat
    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
    : 'bg-rose-500/15 border-rose-500/40 text-rose-300';

  // Navigation dans la liste des signaux Doji
  const indexActuel = signauxTotaux.findIndex((s) => (s.id && s.id === signal.id) || s.indexBougie === signal.indexBougie);
  const aPrecedent = indexActuel > 0;
  const aSuivant = indexActuel >= 0 && indexActuel < signauxTotaux.length - 1;

  // Données des zones
  const toutesLesZones: ZoneShvedAvecScore[] = signal.toutesZonesCandidates || signal.niveauxShved || [];
  const zoneRetenue = signal.zoneRetenue || (signal.niveauxShved && signal.niveauxShved.length > 0 ? signal.niveauxShved[0] : null);

  // Zone actuellement inspectée en détail
  const zoneInspectee = toutesLesZones.find((z) => z.zone.id === zoneSelectionneeId) || null;

  // Calcul du recul de la plage en nombre de bougies
  const reculBougies = Math.max(1, signal.indexBougie - signal.indexDebutPlage);

  // Si le volet est replié, on affiche uniquement une petite languette discrète
  if (estReplie) {
    return (
      <div className="absolute top-14 right-2 z-30 animate-in fade-in duration-200">
        <button
          onClick={() => setEstReplie(false)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#131722]/95 border border-cyan-500/50 text-cyan-300 text-xs font-bold shadow-2xl backdrop-blur-md hover:bg-cyan-950/80 transition-all hover:scale-105"
          title="Rouvrir le diagnostic Sandbox"
        >
          <span>🔍</span>
          <span>Diag Sandbox (#{signal.indexBougie})</span>
          <span className="text-[10px] text-slate-400">▶</span>
        </button>
      </div>
    );
  }

  return (
    <div className="absolute top-12 right-2 bottom-12 z-30 w-80 sm:w-96 flex flex-col bg-[#131722]/95 border border-[#2a2e39] rounded-xl shadow-2xl backdrop-blur-md overflow-hidden text-slate-100 animate-in slide-in-from-right duration-200">
      {/* ─── 🏷️ Barre d'En-tête & Contrôles ─── */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-[#181c27] border-b border-[#2a2e39]">
        <div className="flex items-center gap-2">
          <span className="text-base">🔍</span>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs text-white">Diagnostic Sandbox</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${couleurBadge}`}>
                {estAchat ? '🟢 ACHAT (Spring)' : '🔴 VENTE (UTAD)'}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              Bougie #{signal.indexBougie} • {signal.temps}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Bouton Replier */}
          <button
            onClick={() => setEstReplie(true)}
            className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            title="Réduire le volet de diagnostic"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          {/* Bouton Fermer */}
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
            title="Fermer le diagnostic"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* ─── 🧭 Navigation Rapide Entre Signaux ─── */}
      {signauxTotaux.length > 1 && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-[#141722] border-b border-[#2a2e39]/60 text-[11px]">
          <button
            disabled={!aPrecedent}
            onClick={() => aPrecedent && onSelectSignal && onSelectSignal(signauxTotaux[indexActuel - 1])}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
              aPrecedent
                ? 'bg-[#1e222d] hover:bg-sky-900/40 text-sky-300 border border-sky-500/30'
                : 'text-slate-600 border border-transparent cursor-not-allowed'
            }`}
          >
            ◀ Précédent
          </button>

          <span className="text-[10.5px] text-slate-300 font-mono">
            Setup <span className="font-bold text-white">#{indexActuel + 1}</span> sur {signauxTotaux.length}
          </span>

          <button
            disabled={!aSuivant}
            onClick={() => aSuivant && onSelectSignal && onSelectSignal(signauxTotaux[indexActuel + 1])}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
              aSuivant
                ? 'bg-[#1e222d] hover:bg-sky-900/40 text-sky-300 border border-sky-500/30'
                : 'text-slate-600 border border-transparent cursor-not-allowed'
            }`}
          >
            Suivant ▶
          </button>
        </div>
      )}

      {/* ─── 📜 Corps Défilant du Diagnostic ─── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3.5">
        
        {/* ─── 📍 Fiche d'Identité : Doji & Plage Temporelle ─── */}
        <div className="p-2.5 rounded-lg bg-[#181c27] border border-[#2a2e39] space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-200">Plage Temporelle Ciblée</span>
            <span className="font-mono text-cyan-400 font-bold">{reculBougies} bougies</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
            <div className="p-1.5 rounded bg-black/30 border border-white/5">
              <span className="text-slate-400 block font-sans">Extrême Doji</span>
              <span className="font-bold text-white text-xs">{signal.prixExtreme}</span>
            </div>
            <div className="p-1.5 rounded bg-black/30 border border-white/5">
              <span className="text-slate-400 block font-sans">Extrême Précédent</span>
              <span className="font-bold text-cyan-300 text-xs">{signal.prixExtremePrecedent}</span>
            </div>
          </div>

          <div className="text-[9.5px] text-slate-400 italic">
            {`Plage ciblée depuis l'extrême précédent (#${signal.indexDebutPlage}) jusqu'au Doji (#${signal.indexBougie}).`}
          </div>
        </div>

        {/* ─── ⭐ Niveau Retenu (Gagnant du Tri) ─── */}
        <div className="space-y-1.5">
          <span className="text-[10.5px] font-bold text-slate-300 uppercase tracking-wider block">
            Niveau Retenu par le Système
          </span>

          {zoneRetenue ? (
            <div className="p-3 rounded-lg bg-emerald-950/25 border border-emerald-500/50 ring-1 ring-emerald-500/20 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs text-white">
                    ⭐ {zoneRetenue.zone.type === 'SUPPORT' ? 'Support Retenu' : 'Résistance Retenue'}
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/30 text-emerald-200 border border-emerald-500/40">
                    SÉLECTIONNÉ
                  </span>
                  {zoneRetenue.estSectionnee && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-cyan-500/30 text-cyan-200 border border-cyan-500/40">
                      ✂️ SECTIONNÉ
                    </span>
                  )}
                </div>
                <span className="font-bold font-mono text-xs text-amber-400">
                  {zoneRetenue.score}/100 pts
                </span>
              </div>

              {/* Prix Médian / Haut / Bas */}
              <div className="grid grid-cols-3 gap-1 text-[9.5px] font-mono text-center">
                <div className="p-1 rounded bg-black/30">
                  <span className="text-[8.5px] text-slate-400 block font-sans">Médian</span>
                  <span className="font-bold text-white">{zoneRetenue.zone.prixMedian}</span>
                </div>
                <div className="p-1 rounded bg-black/30">
                  <span className="text-[8.5px] text-slate-400 block font-sans">Haut</span>
                  <span className="text-slate-300">{zoneRetenue.zone.prixHaut}</span>
                </div>
                <div className="p-1 rounded bg-black/30">
                  <span className="text-[8.5px] text-slate-400 block font-sans">Bas</span>
                  <span className="text-slate-300">{zoneRetenue.zone.prixBas}</span>
                </div>
              </div>

              {/* Détail des 4 Piliers du Score */}
              <div className="space-y-1 text-[9.5px] font-mono pt-1 border-t border-emerald-500/20">
                <div className="flex justify-between text-slate-300">
                  <span>1. Retests ({zoneRetenue.retestsAvant} touches) :</span>
                  <span className="font-bold text-emerald-300">{zoneRetenue.pointsRetests} / 35 pts</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>2. Rejet moyen ({zoneRetenue.rejetMoyen.toFixed(4)}) :</span>
                  <span className="font-bold text-emerald-300">{zoneRetenue.pointsRejets} / 30 pts</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>3. Proportionnalité ({Math.round(zoneRetenue.ratioProportion * 100)}%) :</span>
                  <span className="font-bold text-emerald-300">{zoneRetenue.pointsProportionnalite} / 25 pts</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>4. Intégrité de la zone :</span>
                  <span className="font-bold text-emerald-300">{zoneRetenue.pointsIntegrite} / 10 pts</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-500/30 text-amber-300 text-xs text-center">
              Aucun niveau Shved n'a respecté les critères de sélection actuels pour ce Doji.
            </div>
          )}
        </div>

        {/* ─── 🔍 Section Interactive : Tous les Niveaux Candidats ─── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold text-slate-300 uppercase tracking-wider">
              {estAchat ? 'Supports' : 'Résistances'} Détectés dans la Plage
            </span>
            <span className="px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold bg-[#1e222d] text-cyan-300 border border-[#2a2e39]">
              {toutesLesZones.length} niveau{toutesLesZones.length > 1 ? 'x' : ''}
            </span>
          </div>

          <div className="text-[10px] text-slate-400 italic">
            💡 Cliquez sur un niveau ci-dessous (ou sur sa ligne sur le graphique) pour voir pourquoi il n'a pas été retenu.
          </div>

          {toutesLesZones.length === 0 ? (
            <div className="p-3 rounded-lg bg-black/20 border border-white/5 text-slate-400 text-center text-xs">
              Aucun niveau Shved du sens correspondant n'a été détecté dans cette plage.
            </div>
          ) : (
            <div className="space-y-2">
              {toutesLesZones.map((cand, idx) => {
                const estCeRetenu = zoneRetenue?.zone?.id === cand.zone.id;
                const estInspecte = zoneSelectionneeId === cand.zone.id;

                return (
                  <div
                    key={cand.zone.id || idx}
                    onClick={() => {
                      if (onSelectZone) {
                        onSelectZone(estInspecte ? null : cand.zone.id);
                      }
                    }}
                    className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                      estInspecte
                        ? 'bg-amber-950/30 border-amber-400 ring-2 ring-amber-400/30 shadow-lg'
                        : estCeRetenu
                        ? 'bg-emerald-950/20 border-emerald-500/40 hover:border-emerald-400'
                        : 'bg-[#181c27]/70 border-[#2a2e39] hover:border-slate-500 hover:bg-[#1f2433]'
                    }`}
                  >
                    {/* En-tête de la carte */}
                    <div className="flex items-center justify-between pb-1 border-b border-white/5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-white">
                          {cand.zone.type === 'SUPPORT' ? '🟢 Support' : '🔴 Résistance'} @ {cand.zone.prixMedian}
                        </span>
                        {estCeRetenu && (
                          <span className="px-1.5 py-0.2 rounded text-[8.5px] font-bold bg-emerald-500/30 text-emerald-200 border border-emerald-500/40">
                            ⭐ RETENU
                          </span>
                        )}
                        {estInspecte && (
                          <span className="px-1.5 py-0.2 rounded text-[8.5px] font-bold bg-amber-500/30 text-amber-200 border border-amber-500/40">
                            🔍 INSPECTÉ
                          </span>
                        )}
                        {cand.estSectionnee && (
                          <span className="px-1.5 py-0.2 rounded text-[8.5px] font-bold bg-cyan-500/30 text-cyan-200 border border-cyan-500/40">
                            ✂️ SECTIONNÉ
                          </span>
                        )}
                      </div>

                      <span className="font-bold font-mono text-[11px] text-amber-400">
                        {cand.score}/100 pts
                      </span>
                    </div>

                    {/* Résumé des métriques */}
                    <div className="mt-1.5 grid grid-cols-3 gap-1 text-[9px] font-mono text-center">
                      <div className="p-1 rounded bg-black/20">
                        <span className="text-[8px] text-slate-400 block font-sans">Retests</span>
                        <span className="font-bold text-white">{cand.retestsAvant} touches</span>
                      </div>
                      <div className="p-1 rounded bg-black/20">
                        <span className="text-[8px] text-slate-400 block font-sans">Rejet</span>
                        <span className="text-slate-300">{cand.pointsRejets} pts</span>
                      </div>
                      <div className="p-1 rounded bg-black/20">
                        <span className="text-[8px] text-slate-400 block font-sans">Proportion</span>
                        <span className="text-slate-300">{cand.pointsProportionnalite} pts</span>
                      </div>
                    </div>

                    {/* ─── 🔍 Bloc de Diagnostic Détaillé (Déplié si inspecté) ─── */}
                    {estInspecte && (
                      <div className="mt-2.5 pt-2 border-t border-amber-500/20 space-y-1.5 text-[9.5px] animate-in fade-in duration-150">
                        <div className="font-bold text-amber-300 flex items-center gap-1">
                          <span>🔬 Analyse Comparative du Niveau :</span>
                        </div>

                        {/* Motif de sélection ou rejet */}
                        <div className={`p-1.5 rounded font-medium ${
                          estCeRetenu
                            ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/30'
                            : 'bg-rose-950/30 text-rose-300 border border-rose-500/20'
                        }`}>
                          {cand.motifSelection || (estCeRetenu ? 'Niveau retenu' : 'Niveau non retenu')}
                        </div>

                        {/* Comparaison détaillée face au niveau retenu */}
                        {!estCeRetenu && zoneRetenue && (
                          <div className="space-y-1 text-slate-300 font-mono bg-black/30 p-2 rounded border border-white/5">
                            <div className="flex justify-between">
                              <span>• Écart de Score :</span>
                              <span className="font-bold text-rose-400">{cand.score - zoneRetenue.score} pts</span>
                            </div>
                            <div className="flex justify-between">
                              <span>• Retests prouvés :</span>
                              <span>{cand.retestsAvant} ({cand.pointsRetests} pts) vs {zoneRetenue.retestsAvant} ({zoneRetenue.pointsRetests} pts)</span>
                            </div>
                            <div className="flex justify-between">
                              <span>• Rejet moyen :</span>
                              <span>{cand.pointsRejets} pts vs {zoneRetenue.pointsRejets} pts</span>
                            </div>
                            <div className="flex justify-between">
                              <span>• Proportion mèche :</span>
                              <span>{cand.pointsProportionnalite} pts vs {zoneRetenue.pointsProportionnalite} pts</span>
                            </div>
                            <div className="flex justify-between">
                              <span>• Intégrité zone :</span>
                              <span>{cand.zone.estCassee ? 'Cassée (-10 pts)' : 'Intacte (10 pts)'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>• Bornes dans plage :</span>
                              <span>{cand.estStrictementDansPlage ? 'Strictement dedans' : 'Déborde hors plage'}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
