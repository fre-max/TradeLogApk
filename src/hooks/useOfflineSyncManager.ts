import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useOfflineSyncStore } from '@/store/offlineSyncStore';
import { useLocalDatabase } from '@/store/useLocalDatabase';
import { useQueryClient } from '@tanstack/react-query';
import type { TradeWithSteps } from '@/types';

// Attend que le store IndexedDB soit totalement hydraté en mémoire
// Exemple : await attendreHydratationLocale();
async function attendreHydratationLocale(): Promise<void> {
  if (!useLocalDatabase.persist.hasHydrated()) {
    await new Promise<void>((resolve) => {
      const unsub = useLocalDatabase.persist.onFinishHydration(() => {
        unsub();
        resolve();
      });
    });
  }
}

/**
 * Hook de synchronisation hors-ligne / Cloud (Offline-First).
 * 
 * Responsabilités claires :
 * 1. synchroniserFileDAttente : envoie les modifications locales (INSERT, UPDATE, DELETE) vers Supabase.
 * 2. syncAll : envoie la file d'abord, puis télécharge les données Cloud sans jamais écraser les trades locaux.
 * 3. Surveillance du réseau (événement 'online') et timer régulier (toutes les 30s).
 */
export function useOfflineSyncManager() {
  const { queue, retirerDeLaFile, incrementerTentative, setDerniereSynchroReussie, setSyncEnCours } = useOfflineSyncStore();
  const queryClient = useQueryClient();

  // Verrou pour éviter deux exécutions simultanées de la synchronisation
  const synchroEnExecutionRef = useRef(false);

  // ─── 1. Synchronisation de la file d'attente (Local → Supabase) ───────────────
  const synchroniserFileDAttente = useCallback(async () => {
    // Si la file est vide, si on n'a pas internet ou si déjà en cours d'exécution, on sort
    const currentQueue = useOfflineSyncStore.getState().queue;
    if (currentQueue.length === 0 || !navigator.onLine || synchroEnExecutionRef.current) return;

    // S'assurer que le stockage local IndexedDB est prêt
    await attendreHydratationLocale();

    // Vérifier si l'utilisateur est connecté à Supabase
    let sessionData = null;
    try {
      const res = await supabase.auth.getSession();
      sessionData = res.data;
    } catch (e) {
      console.warn('🔄 [SyncManager] Erreur session Supabase (hors-ligne):', e);
      return;
    }

    if (!sessionData?.session) {
      console.log('🔄 [SyncManager] Pas de session Supabase active. Synchronisation reportée.');
      return;
    }

    synchroEnExecutionRef.current = true;
    setSyncEnCours(true);
    console.log(`🔄 [SyncManager] Début de la synchro de ${currentQueue.length} élément(s)...`);

    try {
      for (const item of currentQueue) {
        try {
          console.log(`[SyncManager] Traitement ${item.action} pour le trade ${item.tradeId}`);

          // ─── CAS A : SUPPRESSION ───────────────────────────
          if (item.action === 'DELETE') {
            const { error } = await supabase.from('trades').delete().eq('id', item.tradeId);
            if (error) throw error;
            retirerDeLaFile(item.id);
            continue;
          }

          // ─── CAS B : INSERTION / MODIFICATION ──────────────
          const tradeDataToInsert = { ...item.tradeData };

          // 1. Extraire uniquement les colonnes pures de la table "trades"
          // Retire les champs imbriqués (steps, images, reasons) pour ne pas déclencher d'erreur PostgREST
          const {
            steps: _steps,
            images: _images,
            reasons: _reasons,
            ...champsTrades
          } = tradeDataToInsert;

          const pureTradeData: Record<string, any> = {
            ...champsTrades,
            id: item.tradeId, // Toujours forcer l'ID pour que l'upsert Supabase modifie la ligne existante au lieu d'en créer une nouvelle
          };

          // Si le trade a été créé hors-ligne avec 'local-user', on lui assigne le vrai UUID
          if (pureTradeData.user_id === 'local-user' || !pureTradeData.user_id) {
            pureTradeData.user_id = sessionData.session.user.id;
            // Met également à jour la base locale
            useLocalDatabase.getState().updateTrade(item.tradeId, { user_id: sessionData.session.user.id });
          }

          // Nettoyage de strategy_id : PostgreSQL exige un UUID valide ou NULL (pas de chaîne vide "")
          if (!pureTradeData.strategy_id || typeof pureTradeData.strategy_id !== 'string' || pureTradeData.strategy_id.trim() === '') {
            pureTradeData.strategy_id = null;
          }

          // 2. Upload des images locales (Base64) vers Supabase Storage
          let updatedImages = item.images || [];
          if (updatedImages.length > 0) {
            try {
              const { base64ToBlob, uploadImage } = await import('@/lib/storage');
              updatedImages = await Promise.all(
                updatedImages.map(async (img: any) => {
                  if (img.url?.startsWith('data:image/')) {
                    console.log(`[SyncManager] Upload de l'image locale pour phase: ${img.phase}`);
                    const blob = base64ToBlob(img.url);
                    const cleanFileName = `offline_sync_${img.phase}_${img.context}_${Date.now()}.jpg`;
                    const path = `trade_images/${sessionData.session.user.id}/${item.tradeId}/${cleanFileName}`;
                    const publicUrl = await uploadImage(blob as File, path);
                    return { ...img, url: publicUrl, storage_path: path };
                  }
                  return img;
                })
              );
            } catch (imgErr) {
              console.warn(`⚠️ [SyncManager] Erreur upload images pour ${item.tradeId}, poursuite du trade:`, imgErr);
            }
          }

          // 3. Upsert du trade principal dans Supabase
          const { error: tradeError } = await supabase.from('trades').upsert(pureTradeData);
          if (tradeError) throw tradeError;

          // 4. Traitement des étapes
          if (item.steps && item.steps.length > 0) {
            const stepsPropres = item.steps.map((s: any) => ({
              id: s.id || crypto.randomUUID(),
              trade_id: item.tradeId,
              order: s.order ?? 0,
              type: s.type,
              title: s.title,
              timeframe: s.timeframe || null,
              notes: s.notes || null,
              fields: s.fields || {},
            }));
            const { error: stepsError } = await supabase.from('steps').upsert(stepsPropres);
            if (stepsError) throw stepsError;
          }

          // 5. Traitement des raisons (trade_reasons)
          if (item.reasons) {
            await supabase.from('trade_reasons').delete().eq('trade_id', item.tradeId);
            if (item.reasons.length > 0) {
              const inserts = item.reasons.map((r: any) => ({
                trade_id: item.tradeId,
                reason_id: r.reason_id,
                variant_name: r.variant_name || 'Standard',
              }));
              const { error: reasonsError } = await supabase.from('trade_reasons').insert(inserts);
              if (reasonsError) throw reasonsError;
            }
          }

          // 6. Traitement des images dans la table trade_images
          if (updatedImages.length > 0 || (item.images && item.images.length === 0)) {
            await supabase.from('trade_images').delete().eq('trade_id', item.tradeId);
            if (updatedImages.length > 0) {
              const inserts = updatedImages.map((img: any) => ({
                trade_id: item.tradeId,
                phase: img.phase,
                context: img.context,
                url: img.url,
                source: img.source || 'upload',
                storage_path: img.storage_path || null,
              }));
              const { error: imagesError } = await supabase.from('trade_images').insert(inserts);
              if (imagesError) throw imagesError;
            }
          }

          console.log(`✅ [SyncManager] Action ${item.action} réussie pour le trade ${item.tradeId}`);
          retirerDeLaFile(item.id);

          // 7. Déclenchement de l'IA (detect-news) en arrière-plan (sur INSERT)
          if (item.action === 'INSERT' && pureTradeData.date_backtested && pureTradeData.entry_time) {
            const token = sessionData?.session?.access_token;
            supabase.functions.invoke('detect-news', {
              body: {
                trade_id: item.tradeId,
                pair: pureTradeData.pair,
                date: pureTradeData.date_backtested,
                entry_time: pureTradeData.entry_time,
                exit_time: pureTradeData.exit_time || null,
              },
              headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            }).catch((err) => console.error(`❌ [SyncManager] Erreur IA:`, err));
          }
        } catch (itemErr: any) {
          console.error(`❌ [SyncManager] Erreur pour l'action ${item.action} (${item.tradeId}):`, itemErr.message || itemErr);
          
          // Incrémenter les tentatives pour ne pas bloquer la file éternellement
          const tentatives = (item.tentatives || 0) + 1;
          incrementerTentative(item.id);

          // Si l'élément a échoué 3 fois (ex: contrainte BDD invalide), on le retire pour débloquer l'app
          if (tentatives >= 3) {
            console.warn(`⚠️ [SyncManager] Abandon de l'élément ${item.tradeId} après 3 tentatives infructueuses.`);
            retirerDeLaFile(item.id);
          }
        }
      }

      setDerniereSynchroReussie(new Date().toISOString());
      queryClient.invalidateQueries({ queryKey: ['trades'] });
    } finally {
      synchroEnExecutionRef.current = false;
      setSyncEnCours(false);
    }
  }, [retirerDeLaFile, incrementerTentative, queryClient, setDerniereSynchroReussie, setSyncEnCours]);

  // ─── 2. Synchronisation globale (Supabase → Local) ────────────────────────────
  // Télécharge l'ensemble des données Cloud tout en préservant TOUS les trades locaux
  const syncAll = useCallback(async () => {
    if (!navigator.onLine || synchroEnExecutionRef.current) return;

    // S'assurer que le stockage local IndexedDB est prêt
    await attendreHydratationLocale();

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session) return;

    const userId = sessionData.session.user.id;

    // 1️⃣ On vide d'abord la file d'attente vers Supabase pour que rien ne soit écrasé
    await synchroniserFileDAttente();

    synchroEnExecutionRef.current = true;
    setSyncEnCours(true);

    try {
      console.log('🔄 [SyncManager] Téléchargement des données depuis Supabase...');

      // 1. Stratégies
      const { data: strategies } = await supabase
        .from('strategies')
        .select('*')
        .order('created_at', { ascending: false });
      if (strategies) useLocalDatabase.getState().setStrategies(strategies);

      // 2. Familles de raisons
      const { data: reasonFamilies } = await supabase
        .from('reason_families')
        .select('*')
        .order('order', { ascending: true });
      if (reasonFamilies) useLocalDatabase.getState().setReasonFamilies(reasonFamilies);

      // 3. Catalogue complet
      const { data: catalog } = await supabase
        .from('reason_catalog')
        .select('*, family: reason_families (id, name, slug), variants: reason_variants (*)')
        .order('created_at', { ascending: false });

      if (catalog) {
        const itemsAvecType = catalog.map((item: any) => {
          const familyName = (item.family?.name || '').toLowerCase();
          let type = 'confirmation';
          if (familyName.includes('biais')) type = 'biais';
          else if (familyName.includes('poi') || familyName.includes('zone')) type = 'poi';
          else if (familyName.includes('sl') || familyName.includes('stop loss') || familyName.includes('loss')) type = 'sl';
          else if (familyName.includes('tp') || familyName.includes('take profit') || familyName.includes('profit')) type = 'tp';
          else if (familyName.includes('trailing')) type = 'trailing';
          else if (familyName.includes('entr') || familyName.includes('setup')) type = 'entry';
          return { ...item, type };
        });
        useLocalDatabase.getState().setCatalogItems(itemsAvecType);
      }

      // 4. Les Trades de l'utilisateur connecté depuis Supabase
      // Remarque : On charge les steps et trade_images (step_images n'existe plus dans le schéma)
      const { data: allTrades, error: tradesError } = await supabase
        .from('trades')
        .select(`
          *,
          steps (*),
          images: trade_images (*),
          reasons: trade_reasons (reason_id, variant_name)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (tradesError) {
        console.error('❌ [SyncManager] Erreur récupération trades Supabase:', tradesError);
      } else if (allTrades) {
        // 5. Fusion NON-DESTRUCTRICE des trades locaux et du Cloud
        const tradesLocauxActuels = useLocalDatabase.getState().trades;
        const fileActuelle = useOfflineSyncStore.getState().queue;

        // IDs supprimés localement en attente
        const idsSupprimes = new Set(
          fileActuelle.filter((q) => q.action === 'DELETE').map((q) => q.tradeId)
        );

        // IDs modifiés localement en attente
        const idsModifiesLocalement = new Set(
          fileActuelle.filter((q) => q.action === 'UPDATE').map((q) => q.tradeId)
        );

        const tradesMap = new Map<string, TradeWithSteps>();

        // 1. Conserver TOUS les trades locaux actuels (sauf ceux marqués pour suppression)
        for (const localTrade of tradesLocauxActuels) {
          if (!idsSupprimes.has(localTrade.id)) {
            tradesMap.set(localTrade.id, localTrade);
          }
        }

        // 2. Fusionner les trades reçus du Cloud
        for (const cloudTrade of (allTrades as TradeWithSteps[])) {
          if (idsSupprimes.has(cloudTrade.id)) {
            continue; // Trade supprimé localement, on ne l'ajoute pas
          }
          if (idsModifiesLocalement.has(cloudTrade.id)) {
            // Modification locale en cours, on préserve la version locale
            continue;
          }
          // On applique la version Cloud
          tradesMap.set(cloudTrade.id, cloudTrade);
        }

        // 3. Trier la liste finale par date de création décroissante
        const listeFusionnee = Array.from(tradesMap.values()).sort((a, b) => {
          const dateA = new Date(a.created_at || 0).getTime();
          const dateB = new Date(b.created_at || 0).getTime();
          return dateB - dateA;
        });

        useLocalDatabase.getState().setTrades(listeFusionnee);
        console.log(`✅ [SyncManager] ${listeFusionnee.length} trades enregistrés dans la base locale.`);
        queryClient.invalidateQueries({ queryKey: ['trades'] });
      }

      // Rafraîchir les requêtes de l'interface
      queryClient.invalidateQueries({ queryKey: ['strategies'] });
      queryClient.invalidateQueries({ queryKey: ['reason_families'] });
      queryClient.invalidateQueries({ queryKey: ['reason_catalog'] });

      setDerniereSynchroReussie(new Date().toISOString());
      console.log('✅ [SyncManager] Synchronisation globale terminée avec succès.');
    } catch (error) {
      console.error('❌ [SyncManager] Erreur inattendue lors de syncAll:', error);
    } finally {
      synchroEnExecutionRef.current = false;
      setSyncEnCours(false);
    }
  }, [synchroniserFileDAttente, queryClient, setDerniereSynchroReussie, setSyncEnCours]);

  // ─── 3. Références stables pour les événements et timers ─────────────────────
  const syncAllRef = useRef(syncAll);
  syncAllRef.current = syncAll;

  const synchroniserFileDAttenteRef = useRef(synchroniserFileDAttente);
  synchroniserFileDAttenteRef.current = synchroniserFileDAttente;

  // Initialisation unique au montage
  const initMonteRef = useRef(false);
  useEffect(() => {
    if (!initMonteRef.current) {
      initMonteRef.current = true;
      if (navigator.onLine) {
        void syncAllRef.current();
      }
    }
  }, []);

  // Écouteurs de réseau et intervalle régulier (30s)
  useEffect(() => {
    const onNetworkOnline = () => {
      console.log('🌐 [SyncManager] Connexion rétablie. Lancement de la synchronisation...');
      void syncAllRef.current();
    };

    window.addEventListener('online', onNetworkOnline);

    const interval = setInterval(() => {
      if (navigator.onLine) {
        void synchroniserFileDAttenteRef.current();
      }
    }, 30000);

    return () => {
      window.removeEventListener('online', onNetworkOnline);
      clearInterval(interval);
    };
  }, []);

  // Déclencher immédiatement la synchro dès qu'un nouvel élément arrive dans la file
  useEffect(() => {
    if (queue.length > 0 && navigator.onLine && !synchroEnExecutionRef.current) {
      void synchroniserFileDAttenteRef.current();
    }
  }, [queue.length]);

  return { syncAll, synchroniserFileDAttente };
}

