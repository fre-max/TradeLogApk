import React, { useState } from 'react';
import type { SetupOrchestreSMC, ZoneShvedAvecScore } from '@/lib/indicators/favoris/orchestrateurSMC';

interface DiagnosticSetupSMCModalProps {
  setup: SetupOrchestreSMC;
  setupsTotaux?: SetupOrchestreSMC[];
  onSelectSetup?: (setup: SetupOrchestreSMC) => void;
  onClose: () => void;
  surbrillanceActive: boolean;
  onToggleSurbrillance: (active: boolean) => void;
}

/**
 * 🔍 Fenêtre de Diagnostic Détaillé pour le Chef d'Orchestre SMC
 * 
 * Permet au trader et au développeur d'analyser en profondeur chaque setup SMC :
 * 1. Voir TOUS les Supports et Résistances Shved analysés dans la plage (et lequel a été retenu).
 * 2. Voir le Profil d'Overlap UOP et la simulation pas-à-pas du carburant vs friction/péages.
 * 3. Activer/désactiver la surbrillance temporaire sur le graphique pour examiner les zones.
 * 4. Naviguer entre les différents setups détectés sur le graphique.
 */
export function DiagnosticSetupSMCModal({
  setup,
  setupsTotaux = [],
  onSelectSetup,
  onClose,
  surbrillanceActive,
  onToggleSurbrillance,
}: DiagnosticSetupSMCModalProps) {
  // Onglet actif : 'sr' (Supports/Résistances), 'uop' (Profil d'Overlaps & Carburant), 'confirmation' (Range 3 bougies)
  const [ongletActif, setOngletActif] = useState<'sr' | 'uop' | 'confirmation'>('sr');

  const estAchat = setup.type === 'ACHAT';
  const couleurPrincipale = estAchat ? '#00E676' : '#FF3B30';
  const couleurTexte = estAchat ? 'text-emerald-400' : 'text-rose-400';
  const couleurBadge = estAchat
    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
    : 'bg-rose-500/15 border-rose-500/40 text-rose-300';

  // Navigation entre les setups de la liste
  const indexActuel = setupsTotaux.findIndex((s) => s.id === setup.id);
  const aPrecedent = indexActuel > 0;
  const aSuivant = indexActuel >= 0 && indexActuel < setupsTotaux.length - 1;

  const passerAuPrecedent = () => {
    if (aPrecedent && onSelectSetup) {
      onSelectSetup(setupsTotaux[indexActuel - 1]);
    }
  };

  const passerAuSuivant = () => {
    if (aSuivant && onSelectSetup) {
      onSelectSetup(setupsTotaux[indexActuel + 1]);
    }
  };

  const zonesCandidates: ZoneShvedAvecScore[] = setup.zonesShvedCandidates || (setup.meilleureZoneShved ? [setup.meilleureZoneShved] : []);
  const meilleureZone = setup.meilleureZoneShved;
  const etapesUOP = setup.etapesPaliersUOP || [];
  const detailsCarburant = setup.detailsCarburant;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-[#131722] border border-[#2a2e39] text-slate-100 shadow-2xl overflow-hidden">
        
        {/* ─── 1️⃣ En-tête Modale ─── */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#2a2e39] bg-[#1a1e29]/70">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-base">🔍</span>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white tracking-wide">
                  Diagnostic Setup SMC
                </span>
                <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${couleurBadge}`}>
                  {estAchat ? 'ACHAT (Spring)' : 'VENTE (UTAD)'}
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-950/80 text-cyan-300 border border-cyan-700/40">
                  Bougie #{setup.indexDoji}
                </span>
              </div>
              <span className="text-[10.5px] text-slate-400">
                Date : {String(setup.tempsDoji)} · Entrée : <span className="text-slate-200 font-mono font-medium">{setup.prixEntree}</span> · SL : <span className="text-rose-400 font-mono font-medium">{setup.prixSL}</span>
              </span>
            </div>
          </div>

          {/* Boutons Navigation & Fermeture */}
          <div className="flex items-center gap-1.5">
            {setupsTotaux.length > 1 && (
              <div className="flex items-center bg-[#0d1017] rounded-lg border border-[#2a2e39] p-0.5 mr-1">
                <button
                  onClick={passerAuPrecedent}
                  disabled={!aPrecedent}
                  className="px-2 py-1 text-xs text-slate-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  title="Setup précédent"
                >
                  ◀
                </button>
                <span className="text-[10px] font-mono px-1.5 text-slate-400">
                  {indexActuel + 1}/{setupsTotaux.length}
                </span>
                <button
                  onClick={passerAuSuivant}
                  disabled={!aSuivant}
                  className="px-2 py-1 text-xs text-slate-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  title="Setup suivant"
                >
                  ▶
                </button>
              </div>
            )}
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors text-sm"
              title="Fermer (Échap)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* ─── 2️⃣ Barre de Statut et Résumé Rapide ─── */}
        <div className="px-4 py-2.5 bg-[#0d1017]/80 border-b border-[#2a2e39] flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Statut du Trade */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Statut :</span>
              {setup.estTermine ? (
                setup.resultatTrade === 'TP_TOUCHE' ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    🏆 TP TOUCHÉ ({setup.ratioRR}R)
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                    🛑 SL TOUCHÉ (-1R)
                  </span>
                )
              ) : setup.statut === 'CONFIRME' ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  ✅ CONFIRMÉ EN COURS
                </span>
              ) : setup.statut === 'EN_COURS' ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  ⏳ RANGE DE CONFIRMATION
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-500/20 text-slate-300 border border-slate-500/40">
                  ❌ INVALIDÉ (SORTIE SL)
                </span>
              )}
            </div>

            {/* Score Shved */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Score S/R :</span>
              <span className="font-bold text-amber-400">
                {setup.scoreShved}/100 pts
              </span>
            </div>

            {/* Carburant initial capté */}
            {setup.carburantInitial !== undefined && (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Liquidité Captée :</span>
                <span className="font-bold font-mono text-cyan-300">
                  ⚡ {setup.carburantInitial} pts
                </span>
              </div>
            )}

            {/* Take Profit Optimal */}
            {setup.prixTP !== undefined && (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">TP Optimal :</span>
                <span className="font-bold font-mono text-emerald-400">
                  {setup.prixTP} ({setup.ratioRR}R)
                </span>
              </div>
            )}
          </div>

          {/* Toggle surbrillance graphique */}
          <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-300 hover:text-white transition-colors select-none">
            <input
              type="checkbox"
              checked={surbrillanceActive}
              onChange={(e) => onToggleSurbrillance(e.target.checked)}
              className="rounded border-[#2a2e39] text-cyan-500 focus:ring-0 bg-[#131722]"
            />
            <span>Tracé sur le graphique</span>
          </label>
        </div>

        {/* ─── 3️⃣ Onglets de Navigation ─── */}
        <div className="flex border-b border-[#2a2e39] bg-[#1a1e29]/40 px-3">
          <button
            onClick={() => setOngletActif('sr')}
            className={`px-3 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              ongletActif === 'sr'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>🏰</span> Supports & Résistances ({zonesCandidates.length})
          </button>
          <button
            onClick={() => setOngletActif('uop')}
            className={`px-3 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              ongletActif === 'uop'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>🌊</span> Overlap UOP & Énergie ({etapesUOP.length} Paliers)
          </button>
          <button
            onClick={() => setOngletActif('confirmation')}
            className={`px-3 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              ongletActif === 'confirmation'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>🛡️</span> Validation du Range (3 Bougies)
          </button>
        </div>

        {/* ─── 4️⃣ Contenu Défilant des Onglets ─── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          
          {/* ═══════════════════════════════════════════════════════════════════════ */}
          {/* 🏰 ONGLET 1 : SUPPORTS & RÉSISTANCES ANALYSÉS DANS LA PLAGE          */}
          {/* ═══════════════════════════════════════════════════════════════════════ */}
          {ongletActif === 'sr' && (
            <div className="space-y-3.5">
              <div className="p-2.5 rounded-xl bg-cyan-950/20 border border-cyan-800/30 text-cyan-200 text-[11px] leading-relaxed">
                <span className="font-bold text-cyan-300">💡 Mécanique d'analyse S/R : </span>
                L'algorithme a scruté la plage temporelle ciblée précédant le Doji. Toutes les zones de S/R Shved formées ont été évaluées. La zone ayant obtenu le score le plus élevé a été retenue comme niveau de balayage institutionnel.
              </div>

              <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>Zones Shved Analysées ({zonesCandidates.length})</span>
                <span className="text-[10px] text-slate-400 font-normal lowercase">
                  classées par score décroissant
                </span>
              </div>

              {zonesCandidates.length === 0 ? (
                <div className="p-4 rounded-xl bg-black/20 border border-white/5 text-center text-slate-400">
                  Aucune zone Shved candidate n'a été détectée dans la plage temporelle.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {zonesCandidates.map((candidat, idx) => {
                    const estRetenue = meilleureZone?.zone.id === candidat.zone.id;
                    return (
                      <div
                        key={candidat.zone.id || idx}
                        className={`p-3 rounded-xl border transition-all ${
                          estRetenue
                            ? 'bg-emerald-950/25 border-emerald-500/50 shadow-md ring-1 ring-emerald-500/20'
                            : 'bg-[#181c27]/60 border-[#2a2e39] opacity-75 hover:opacity-100'
                        }`}
                      >
                        {/* En-tête de la zone */}
                        <div className="flex items-center justify-between flex-wrap gap-1.5 pb-2 border-b border-white/5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-xs">
                              {candidat.zone.type === 'SUPPORT' ? '🟢 Support' : '🔴 Résistance'} #{idx + 1}
                            </span>
                            {estRetenue && (
                              <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-emerald-500/30 text-emerald-200 border border-emerald-500/40 flex items-center gap-1">
                                ⭐ ZONE RETENUE
                              </span>
                            )}
                            <span className="text-[10px] font-mono text-slate-400">
                              ID: {candidat.zone.id}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 text-[11px]">Score Total :</span>
                            <span className={`font-bold font-mono text-xs px-2 py-0.5 rounded ${estRetenue ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-300'}`}>
                              {candidat.score}/100 pts
                            </span>
                          </div>
                        </div>

                        {/* Niveaux de prix clés */}
                        <div className="grid grid-cols-3 gap-2 mt-2 pt-1 text-[11px] font-mono">
                          <div className="p-1.5 rounded bg-black/20 border border-white/5 text-center">
                            <span className="text-[9.5px] text-slate-400 block font-sans">Prix Médian</span>
                            <span className="font-bold text-white">{candidat.zone.prixMedian}</span>
                          </div>
                          <div className="p-1.5 rounded bg-black/20 border border-white/5 text-center">
                            <span className="text-[9.5px] text-slate-400 block font-sans">Borne Haute</span>
                            <span className="text-slate-300">{candidat.zone.prixHaut}</span>
                          </div>
                          <div className="p-1.5 rounded bg-black/20 border border-white/5 text-center">
                            <span className="text-[9.5px] text-slate-400 block font-sans">Borne Basse</span>
                            <span className="text-slate-300">{candidat.zone.prixBas}</span>
                          </div>
                        </div>

                        {/* Décomposition mathématique du Score sur 100 */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 pt-1 text-[10px]">
                          <div className="p-1.5 rounded bg-black/15">
                            <span className="text-slate-400 block">Retests ({candidat.retestsAvant})</span>
                            <span className="font-bold font-mono text-cyan-300">{candidat.pointsRetests} / 35 pts</span>
                          </div>
                          <div className="p-1.5 rounded bg-black/15">
                            <span className="text-slate-400 block">Rejet / Montagne</span>
                            <span className="font-bold font-mono text-cyan-300">{candidat.pointsRejets} / 30 pts</span>
                          </div>
                          <div className="p-1.5 rounded bg-black/15">
                            <span className="text-slate-400 block">Proportionnalité</span>
                            <span className="font-bold font-mono text-cyan-300">{candidat.pointsProportionnalite} / 25 pts</span>
                          </div>
                          <div className="p-1.5 rounded bg-black/15">
                            <span className="text-slate-400 block">Intégrité / Fraîcheur</span>
                            <span className="font-bold font-mono text-cyan-300">{candidat.pointsIntegrite} / 10 pts</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════════ */}
          {/* 🌊 ONGLET 2 : PROFIL D'OVERLAP UOP & MOTEUR D'ÉNERGIE (CARBURANT)     */}
          {/* ═══════════════════════════════════════════════════════════════════════ */}
          {ongletActif === 'uop' && (
            <div className="space-y-4">
              {/* Carte Carburant Initial */}
              <div className="p-3.5 rounded-xl bg-[#181c27] border border-cyan-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-cyan-400 font-bold text-sm">⚡ Réservoir de Carburant Initial (B₀)</span>
                  </div>
                  <span className="font-mono font-bold text-base text-cyan-300 px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-600/40">
                    {setup.carburantInitial ?? 0} pts
                  </span>
                </div>

                <div className="text-[10.5px] text-slate-300 leading-relaxed font-mono bg-black/30 p-2 rounded-lg border border-white/5 space-y-1">
                  <div>
                    • Retests S/R passés : <span className="text-cyan-300 font-bold">{detailsCarburant?.nombreRetests ?? 0} retest(s)</span> ➔ <span className="text-white font-bold">{detailsCarburant?.pointsRetests ?? 0} points</span>
                  </div>
                  <div>
                    • Mèche de balayage : profondeur <span className="text-cyan-300 font-bold">{detailsCarburant?.profondeurMeche?.toFixed(4) ?? 0}</span> ➔ Multiplicateur <span className="text-white font-bold">x{detailsCarburant?.multiplicateurMeche ?? 1.0}</span>
                  </div>
                  <div className="text-emerald-400 font-bold pt-0.5 border-t border-white/10">
                    ➔ Budget Initial Total = {detailsCarburant?.pointsRetests ?? 0} × {detailsCarburant?.multiplicateurMeche ?? 1.0} = {setup.carburantInitial ?? 0} points de carburant !
                  </div>
                </div>
              </div>

              {/* Simulation pas-à-pas des Paliers d'Overlap UOP */}
              <div className="space-y-2.5">
                <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                  <span>Traversée des Paliers UOP & Péages</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    Friction continue + Péage de 100 pts par palier
                  </span>
                </div>

                {etapesUOP.length === 0 ? (
                  <div className="p-4 rounded-xl bg-black/20 border border-white/5 text-center text-slate-400">
                    Aucun palier UOP traversé ou rencontré. TP de secours calculé par défaut.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {etapesUOP.map((etape) => (
                      <div
                        key={etape.ordre}
                        className={`p-3 rounded-xl border transition-all ${
                          etape.estPerce
                            ? 'bg-sky-950/20 border-sky-500/40 text-sky-200'
                            : 'bg-amber-950/25 border-amber-500/50 text-amber-200 shadow-md ring-1 ring-amber-500/20'
                        }`}
                      >
                        <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-xs">
                              Palier UOP #{etape.ordre}
                            </span>
                            <span className="font-mono text-slate-300 text-[11px]">
                              @ {etape.prixCible}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              (+{etape.distancePoints} pts)
                            </span>
                          </div>

                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            etape.estPerce
                              ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
                              : 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                          }`}>
                            {etape.estPerce ? '✅ PALIER PERCÉ' : '🛑 MUR BLOQUANT'}
                          </span>
                        </div>

                        {/* Données chiffrées de consommation */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 text-[10.5px] font-mono">
                          <div className="p-1 rounded bg-black/20 text-center">
                            <span className="text-[9px] text-slate-400 block font-sans">Overlap (Friction)</span>
                            <span className="font-bold text-white">{etape.tauxChevauchement}x</span>
                          </div>
                          <div className="p-1 rounded bg-black/20 text-center">
                            <span className="text-[9px] text-slate-400 block font-sans">Conso Distance</span>
                            <span className="text-rose-300 font-bold">-{etape.consommationDistance} pts</span>
                          </div>
                          <div className="p-1 rounded bg-black/20 text-center">
                            <span className="text-[9px] text-slate-400 block font-sans">Péage Mur</span>
                            <span className="text-rose-300 font-bold">-{etape.peagePalier} pts</span>
                          </div>
                          <div className="p-1 rounded bg-black/20 text-center">
                            <span className="text-[9px] text-slate-400 block font-sans">Budget Restant</span>
                            <span className="text-cyan-300 font-bold">{etape.budgetApres} pts</span>
                          </div>
                        </div>

                        {/* Explication pédagogique */}
                        <div className="mt-2 text-[10px] italic text-slate-300/90 pt-1 border-t border-white/5">
                          💬 {etape.explication}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Conclusion Take Profit Optimal */}
                {setup.prixTP !== undefined && (
                  <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-emerald-200 space-y-1">
                    <div className="flex items-center justify-between font-bold text-xs">
                      <span>🎯 Ancrage Final du Take Profit Optimal</span>
                      <span className="font-mono text-emerald-300 text-sm">{setup.prixTP}</span>
                    </div>
                    <div className="text-[10.5px] text-slate-300 leading-relaxed">
                      Distance totale : <span className="font-mono font-bold text-white">{setup.distanceTP?.toFixed(4)}</span> · Ratio Risque/Rendement institutionnel : <span className="font-mono font-bold text-emerald-400 text-xs">{setup.ratioRR}R</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════════ */}
          {/* 🛡️ ONGLET 3 : VALIDATION DU RANGE DE CONFIRMATION (3 BOUGIES)         */}
          {/* ═══════════════════════════════════════════════════════════════════════ */}
          {ongletActif === 'confirmation' && (
            <div className="space-y-3.5">
              <div className="p-3 rounded-xl bg-[#181c27] border border-[#2a2e39] space-y-2">
                <div className="font-bold text-xs text-white">
                  Règle de Confirmation du Range (Filtre Anti-Faux Rebond)
                </div>
                <div className="text-[11px] text-slate-300 leading-relaxed space-y-1">
                  <div>
                    • Niveau de Stop Loss naturel : <span className="font-mono font-bold text-rose-400">{setup.prixSL}</span> (extrême de la mèche de liquidation du Doji).
                  </div>
                  <div>
                    • Règle : Les 3 bougies suivant le Doji doivent clôturer et osciller sans briser ce niveau de Stop Loss.
                  </div>
                  <div>
                    • Résultat d'observation : <span className="font-bold text-white">{setup.bougiesObservees} bougie(s) observée(s)</span>.
                  </div>
                </div>

                <div className={`p-2.5 rounded-lg border mt-2 text-xs font-semibold ${
                  setup.statut === 'CONFIRME'
                    ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                    : setup.statut === 'EN_COURS'
                    ? 'bg-amber-950/30 border-amber-500/40 text-amber-300'
                    : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                }`}>
                  {setup.statut === 'CONFIRME' && '✅ Les 3 bougies ont respecté le SL avec succès. Setup validé pour exécution !'}
                  {setup.statut === 'EN_COURS' && '⏳ Range encore en cours d\'observation sur les dernières bougies.'}
                  {setup.statut === 'ANNULE' && `❌ Setup invalidé à la bougie #${setup.bougieInvalidationIndex ?? setup.indexDoji + 1} par sortie sous le Stop Loss.`}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* ─── 5️⃣ Pied de Modale ─── */}
        <div className="px-4 py-3 border-t border-[#2a2e39] bg-[#1a1e29]/70 flex items-center justify-between">
          <div className="text-[10px] text-slate-400">
            Astuce : coche "Tracé sur le graphique" pour voir les zones candidates projetées directement sur le chart.
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-white font-semibold text-xs transition-colors"
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
}
