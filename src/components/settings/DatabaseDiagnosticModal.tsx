import { useState } from 'react';
import { supabase, supabaseUrl, supabaseAnonKey } from '@/lib/supabase';
import { useLocalDatabase } from '@/store/useLocalDatabase';
import { useOfflineSyncStore } from '@/store/offlineSyncStore';
import { useOfflineSyncManager } from '@/hooks/useOfflineSyncManager';
import { cn } from '@/lib/utils';

interface DatabaseDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DiagnosticResultat {
  connectivite: { ok: boolean; latenceMs: number; message: string };
  auth: { ok: boolean; email?: string; userId?: string; message: string };
  trades: { ok: boolean; countCloud: number; countLocal: number; queueSize: number; message: string };
  strategies: { ok: boolean; countCloud: number; countLocal: number; message: string };
  storage: { ok: boolean; message: string };
}

/**
 * Modale de Diagnostic Complet du Backend Supabase et de la Base de Données Locale.
 * Permet à l'utilisateur de vérifier l'état de santé du cloud, de l'authentification
 * et de la synchronisation de ses données en un seul clic.
 */
export function DatabaseDiagnosticModal({ isOpen, onClose }: DatabaseDiagnosticModalProps) {
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState<DiagnosticResultat | null>(null);
  const [erreurGlobale, setErreurGlobale] = useState<string | null>(null);

  const localTrades = useLocalDatabase((state) => state.trades);
  const localStrategies = useLocalDatabase((state) => state.strategies);
  const fileAttente = useOfflineSyncStore((state) => state.queue);
  const { syncAll } = useOfflineSyncManager();

  // Lance l'ensemble des vérifications sur Supabase
  const lancerDiagnostic = async () => {
    setEnCours(true);
    setErreurGlobale(null);

    const debut = performance.now();
    try {
      // 1️⃣ Test de connectivité HTTP vers Supabase
      let pingOk = false;
      let latenceMs = 0;
      try {
        const pingDebut = performance.now();
        const rep = await fetch(`${supabaseUrl}/rest/v1/`, {
          headers: { apikey: supabaseAnonKey },
        });
        latenceMs = Math.round(performance.now() - pingDebut);
        // Supabase REST répond souvent 200 ou 401 si anon sans token
        pingOk = rep.status === 200 || rep.status === 401;
      } catch (err: any) {
        console.warn('⚠️ Erreur ping HTTP Supabase:', err);
      }

      // 2️⃣ Vérification de l'authentification et de la session
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      const session = sessionData?.session;
      const user = session?.user;

      // 3️⃣ Vérification de la table 'trades' sur Supabase
      let cloudTradesCount = 0;
      let tradesOk = false;
      let tradesMsg = '';

      if (user) {
        const { count, error } = await supabase
          .from('trades')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        if (error) {
          tradesMsg = `Erreur Cloud: ${error.message}`;
        } else {
          tradesOk = true;
          cloudTradesCount = count || 0;
          tradesMsg = `${cloudTradesCount} trade(s) sur le Cloud Supabase`;
        }
      } else {
        tradesMsg = 'Non connecté : RLS empêche la lecture sans session';
      }

      // 4️⃣ Vérification de la table 'strategies' sur Supabase
      let cloudStratCount = 0;
      let stratOk = false;
      let stratMsg = '';

      if (user) {
        const { count, error } = await supabase
          .from('strategies')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        if (!error) {
          stratOk = true;
          cloudStratCount = count || 0;
          stratMsg = `${cloudStratCount} stratégie(s) sur le Cloud`;
        } else {
          stratMsg = error.message;
        }
      }

      // 5️⃣ Test de l'accès au Storage (Images de trades)
      let storageOk = false;
      let storageMsg = '';
      try {
        const { error: storageErr } = await supabase.storage.getBucket('trade-images');
        if (!storageErr) {
          storageOk = true;
          storageMsg = 'Bucket "trade-images" accessible et opérationnel';
        } else {
          storageMsg = `Bucket: ${storageErr.message}`;
        }
      } catch (e: any) {
        storageMsg = `Erreur storage: ${e.message}`;
      }

      // Synthèse des résultats
      setResultat({
        connectivite: {
          ok: pingOk,
          latenceMs,
          message: pingOk ? `Serveur en ligne (${latenceMs} ms)` : 'Impossible de joindre le serveur Supabase',
        },
        auth: {
          ok: !!user,
          email: user?.email,
          userId: user?.id,
          message: user ? `Connecté avec ${user.email}` : 'Mode hors-ligne (Non connecté)',
        },
        trades: {
          ok: tradesOk || (!user && localTrades.length >= 0),
          countCloud: cloudTradesCount,
          countLocal: localTrades.length,
          queueSize: fileAttente.length,
          message: tradesMsg,
        },
        strategies: {
          ok: stratOk || !user,
          countCloud: cloudStratCount,
          countLocal: localStrategies.length,
          message: stratMsg || `${localStrategies.length} en local`,
        },
        storage: {
          ok: storageOk,
          message: storageMsg,
        },
      });
    } catch (err: any) {
      console.error('❌ Erreur diagnostic Supabase:', err);
      setErreurGlobale(err?.message || 'Erreur inconnue lors du diagnostic');
    } finally {
      setEnCours(false);
    }
  };

  // Synchronisation immédiate déclenchée depuis la modale
  const [syncEnCours, setSyncEnCours] = useState(false);
  const handleSyncRapide = async () => {
    setSyncEnCours(true);
    try {
      await syncAll();
      await lancerDiagnostic();
    } finally {
      setSyncEnCours(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface border border-border rounded-xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* En-tête */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-[20px]">🩺</span>
            <h3 className="text-txt text-[16px] font-semibold">Diagnostic Backend & Supabase</h3>
          </div>
          <button
            onClick={onClose}
            className="text-txt3 hover:text-txt transition-colors text-lg p-1"
          >
            ✕
          </button>
        </div>

        {/* Corps */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-[13px]">
          <p className="text-txt3">
            Cet outil teste la connectivité réseau avec Supabase, l'authentification et compare les données stockées sur votre appareil avec celles du Cloud.
          </p>

          {/* Bouton de lancement */}
          <div className="flex gap-2">
            <button
              onClick={lancerDiagnostic}
              disabled={enCours}
              className={cn(
                'flex-1 py-2.5 px-4 rounded-lg font-medium text-white transition-all flex items-center justify-center gap-2',
                enCours ? 'bg-accent/50 cursor-wait' : 'bg-accent hover:bg-accent/90 active:scale-98'
              )}
            >
              {enCours ? (
                <>
                  <span className="animate-spin text-[15px]">⟳</span>
                  Vérification en cours...
                </>
              ) : (
                <>
                  <span>🚀</span>
                  Lancer le diagnostic Supabase
                </>
              )}
            </button>
          </div>

          {/* Résultats du diagnostic */}
          {resultat && (
            <div className="space-y-3 pt-2">
              
              {/* 1. Connexion Supabase */}
              <div className="p-3 rounded-lg border border-border bg-bg/50 flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-txt flex items-center gap-2">
                    <span>{resultat.connectivite.ok ? '🟢' : '🔴'}</span>
                    Serveur Supabase Cloud
                  </p>
                  <p className="text-txt3 text-[12px] mt-0.5">{resultat.connectivite.message}</p>
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded bg-surface2 text-txt3 font-mono">
                  {resultat.connectivite.latenceMs} ms
                </span>
              </div>

              {/* 2. Authentification */}
              <div className="p-3 rounded-lg border border-border bg-bg/50">
                <p className="font-semibold text-txt flex items-center gap-2">
                  <span>{resultat.auth.ok ? '🟢' : '🟡'}</span>
                  Session Utilisateur
                </p>
                <p className="text-txt3 text-[12px] mt-0.5">{resultat.auth.message}</p>
                {resultat.auth.userId && (
                  <p className="text-txt4 text-[11px] font-mono mt-1 truncate">
                    ID: {resultat.auth.userId}
                  </p>
                )}
              </div>

              {/* 3. Données des Trades (Local vs Cloud) */}
              <div className="p-3 rounded-lg border border-border bg-bg/50 space-y-2">
                <p className="font-semibold text-txt flex items-center gap-2">
                  <span>{resultat.trades.ok ? '🟢' : '🟡'}</span>
                  Base de données des Trades
                </p>
                <div className="grid grid-cols-2 gap-2 text-[12px]">
                  <div className="p-2 rounded bg-surface border border-border/50 text-center">
                    <span className="block text-txt3 text-[11px]">Sur cet appareil</span>
                    <span className="text-[16px] font-bold text-accent">{resultat.trades.countLocal}</span>
                    <span className="text-txt4 text-[11px]"> trades</span>
                  </div>
                  <div className="p-2 rounded bg-surface border border-border/50 text-center">
                    <span className="block text-txt3 text-[11px]">Sur le Cloud Supabase</span>
                    <span className="text-[16px] font-bold text-win">{resultat.trades.countCloud}</span>
                    <span className="text-txt4 text-[11px]"> trades</span>
                  </div>
                </div>

                {resultat.trades.queueSize > 0 && (
                  <p className="text-[11.5px] text-amber-400 bg-amber-500/10 p-2 rounded border border-amber-500/20">
                    ⏳ {resultat.trades.queueSize} modification(s) en attente d'envoi vers le Cloud.
                  </p>
                )}
              </div>

              {/* 4. Stockage d'images */}
              <div className="p-3 rounded-lg border border-border bg-bg/50">
                <p className="font-semibold text-txt flex items-center gap-2">
                  <span>{resultat.storage.ok ? '🟢' : '🟡'}</span>
                  Stockage d'images (Storage)
                </p>
                <p className="text-txt3 text-[12px] mt-0.5">{resultat.storage.message}</p>
              </div>

              {/* Bouton de synchronisation manuelle si connecté */}
              {resultat.auth.ok && (
                <button
                  onClick={handleSyncRapide}
                  disabled={syncEnCours}
                  className="w-full py-2 px-3 bg-surface2 hover:bg-border border border-border rounded-lg text-txt text-[12.5px] font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {syncEnCours ? (
                    <>
                      <span className="animate-spin">⟳</span>
                      Synchronisation en cours...
                    </>
                  ) : (
                    <>
                      <span>🔄</span>
                      Forcer la synchronisation Cloud ↔ Local maintenant
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {erreurGlobale && (
            <div className="p-3 bg-loss/10 border border-loss/20 text-loss rounded-lg text-[12px]">
              ❌ {erreurGlobale}
            </div>
          )}
        </div>

        {/* Pied de page */}
        <div className="px-5 py-3 border-t border-border flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-surface2 hover:bg-border text-txt rounded-lg font-medium transition-colors"
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
}
