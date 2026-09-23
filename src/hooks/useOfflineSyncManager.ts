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
 * Envoie un trade complet (table trades, steps, images, reasons) vers Supabase.
 * Force le user_id de la session courante pour satisfaire RLS et nettoie les clés étrangères.
 * 
 * Exemple :
 * const succes = await televerserTradeVersSupabase(trade, session.user.id);
 */
export async function televerserTradeVersSupabase(
  trade: TradeWithSteps | Record<string, any>,
  userId: string
): Promise<boolean> {
  try {
    const tradeDataToInsert = { ...trade };

    // 1️⃣ Séparation des colonnes pures de la table "trades"
    const {
      steps: rawSteps,
      images: rawImages,
      reasons: rawReasons,
      ...champsTrades
    } = tradeDataToInsert;

    const tradeId = trade.id || crypto.randomUUID();

    const pureTradeData: Record<string, any> = {
      ...champsTrades,
      id: tradeId,
      user_id: userId, // FORCE le user_id de la session active pour respecter la politique RLS Supabase
    };

    // Nettoyage strategy_id : UUID valide ou NULL
    if (!pureTradeData.strategy_id || typeof pureTradeData.strategy_id !== 'string' || pureTradeData.strategy_id.trim() === '') {
      pureTradeData.strategy_id = null;
    }

    // Nettoyage des heures pour éviter les erreurs de type 'time' dans PostgreSQL
    if (pureTradeData.entry_time && (typeof pureTradeData.entry_time !== 'string' || pureTradeData.entry_time.trim() === '')) {
      pureTradeData.entry_time = null;
    }
    if (pureTradeData.exit_time && (typeof pureTradeData.exit_time !== 'string' || pureTradeData.exit_time.trim() === '')) {
      pureTradeData.exit_time = null;
    }

    // Valeurs par défaut indispensables
    if (!pureTradeData.pair) pureTradeData.pair = 'EURUSD';
    if (!pureTradeData.direction) pureTradeData.direction = 'long';
    if (!pureTradeData.session) pureTradeData.session = 'London';
    if (!pureTradeData.date_backtested) {
      pureTradeData.date_backtested = new Date().toISOString().split('T')[0];
    }
    if (!pureTradeData.status) pureTradeData.status = 'complete';
    if (!pureTradeData.journal_type) pureTradeData.journal_type = 'global';

    // 2️⃣ Téléversement des images en Base64 vers Supabase Storage si nécessaire
    let updatedImages = rawImages || [];
    if (updatedImages.length > 0) {
      try {
        const { base64ToBlob, uploadImage } = await import('@/lib/storage');
        updatedImages = await Promise.all(
          updatedImages.map(async (img: any) => {
            if (img.url?.startsWith('data:image/')) {
              try {
                const blob = base64ToBlob(img.url);
                const cleanFileName = `offline_sync_${img.phase || 'avant'}_${img.context || 'intermediaire'}_${Date.now()}.jpg`;
                const path = `trade_images/${userId}/${tradeId}/${cleanFileName}`;
                const publicUrl = await uploadImage(blob as File, path);
                return { ...img, url: publicUrl, storage_path: path };
              } catch (singleImgErr) {
                console.warn(`⚠️ [SyncManager] Échec upload storage pour une image du trade ${tradeId}:`, singleImgErr);
                return img;
              }
            }
            return img;
          })
        );
      } catch (imgErr) {
        console.warn(`⚠️ [SyncManager] Erreur globale upload images pour ${tradeId}:`, imgErr);
      }
    }

    // 3️⃣ Upsert du trade principal dans Supabase
    let { error: tradeError } = await supabase.from('trades').upsert(pureTradeData);

    // Si échec à cause d'une clé étrangère sur strategy_id, on réessaie sans la stratégie
    if (tradeError && tradeError.message?.includes('strategy_id')) {
      console.warn(`⚠️ [SyncManager] strategy_id non trouvé sur Supabase pour ${tradeId}, réessai avec null...`);
      pureTradeData.strategy_id = null;
      const retry = await supabase.from('trades').upsert(pureTradeData);
      tradeError = retry.error;
    }

    if (tradeError) {
      console.error(`❌ [SyncManager] Échec upsert trade ${tradeId}:`, tradeError.message || tradeError);
      return false;
    }

    // 4️⃣ Upsert des étapes (steps)
    if (rawSteps && rawSteps.length > 0) {
      const stepsPropres = rawSteps.map((s: any, index: number) => ({
        id: s.id || crypto.randomUUID(),
        trade_id: tradeId,
        order: s.order ?? index,
        type: s.type || 'entry',
        title: s.title || 'Étape',
        timeframe: s.timeframe || null,
        notes: s.notes || null,
        fields: s.fields || {},
      }));

      const { error: stepsError } = await supabase.from('steps').upsert(stepsPropres);
      if (stepsError) {
        console.warn(`⚠️ [SyncManager] Erreur upsert steps pour ${tradeId}:`, stepsError.message || stepsError);
      }
    }

    // 5️⃣ Insertion des images dans trade_images avec DÉDUPLICATION par (phase, context)
    if (updatedImages && updatedImages.length > 0) {
      try {
        await supabase.from('trade_images').delete().eq('trade_id', tradeId);

        // Déduplication pour respecter la contrainte UNIQUE(trade_id, phase, context)
        const carteImages = new Map<string, any>();
        for (const img of updatedImages) {
          const cle = `${img.phase || 'avant'}_${img.context || 'intermediaire'}`;
          carteImages.set(cle, img);
        }

        const insertsImages = Array.from(carteImages.values()).map((img: any) => ({
          trade_id: tradeId,
          phase: img.phase || 'avant',
          context: img.context || 'intermediaire',
          url: img.url || '',
          source: img.source || 'upload',
          storage_path: img.storage_path || null,
        })).filter((img) => img.url && img.url.length > 0 && !img.url.startsWith('data:'));

        if (insertsImages.length > 0) {
          const { error: imagesError } = await supabase.from('trade_images').insert(insertsImages);
          if (imagesError) {
            console.warn(`⚠️ [SyncManager] Erreur insertion trade_images pour ${tradeId}:`, imagesError.message || imagesError);
          }
        }
      } catch (errImages) {
        console.warn(`⚠️ [SyncManager] Exception traitement images pour ${tradeId}:`, errImages);
      }
    }

    // 6️⃣ Insertion des raisons (trade_reasons)
    if (rawReasons && rawReasons.length > 0) {
      try {
        await supabase.from('trade_reasons').delete().eq('trade_id', tradeId);
        const insertsReasons = rawReasons.map((r: any) => ({
          trade_id: tradeId,
          reason_id: r.reason_id,
          variant_name: r.variant_name || 'Standard',
        }));
        await supabase.from('trade_reasons').insert(insertsReasons);
      } catch (reasonsErr) {
        console.warn(`⚠️ [SyncManager] Erreur trade_reasons pour ${tradeId}:`, reasonsErr);
      }
    }

    // Met à jour la base locale avec le user_id de la session
    useLocalDatabase.getState().updateTrade(tradeId, { user_id: userId });

    return true;
  } catch (globalErr) {
    console.error(`❌ [SyncManager] Exception inattendue lors de televerserTradeVersSupabase:`, globalErr);
    return false;
  }
}

/**
 * Hook de synchronisation hors-ligne / Cloud (Offline-First).
 * 
 * Responsabilités claires :
 * 1. synchroniserFileDAttente : envoie les modifications locales (INSERT, UPDATE, DELETE) vers Supabase.
 * 2. syncAll : synchronisation bidirectionnelle complète :
 *    - Envoie les modifications de la file.
 *    - Détecte et envoie tous les trades locaux/tablette absents de Supabase.
 *    - Télécharge et fusionne les données du Cloud sans jamais écraser les trades locaux.
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
          const tradeDataToInsert = { ...item.tradeData, id: item.tradeId };
          if (item.steps) tradeDataToInsert.steps = item.steps;
          if (item.images) tradeDataToInsert.images = item.images;
          if (item.reasons) tradeDataToInsert.reasons = item.reasons;

          const succes = await televerserTradeVersSupabase(tradeDataToInsert, sessionData.session.user.id);
          if (!succes) {
            throw new Error(`Échec du téléversement Supabase pour le trade ${item.tradeId}`);
          }

          console.log(`✅ [SyncManager] Action ${item.action} réussie pour le trade ${item.tradeId}`);
          retirerDeLaFile(item.id);

          // Déclenchement de l'IA (detect-news) en arrière-plan (sur INSERT)
          if (item.action === 'INSERT' && tradeDataToInsert.date_backtested && tradeDataToInsert.entry_time) {
            const token = sessionData?.session?.access_token;
            supabase.functions.invoke('detect-news', {
              body: {
                trade_id: item.tradeId,
                pair: tradeDataToInsert.pair,
                date: tradeDataToInsert.date_backtested,
                entry_time: tradeDataToInsert.entry_time,
                exit_time: tradeDataToInsert.exit_time || null,
              },
              headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            }).catch((err) => console.error(`❌ [SyncManager] Erreur IA:`, err));
          }
        } catch (itemErr: any) {
          console.error(`❌ [SyncManager] Erreur pour l'action ${item.action} (${item.tradeId}):`, itemErr.message || itemErr);
          
          // Incrémenter les tentatives pour ne pas bloquer la file éternellement
          const tentatives = (item.tentatives || 0) + 1;
          incrementerTentative(item.id);

          // Si l'élément a échoué 3 fois, on le retire pour débloquer l'app
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

  // ─── 2. Synchronisation globale bidirectionnelle (Local ↔ Cloud) ───────────────
  const syncAll = useCallback(async () => {
    if (!navigator.onLine || synchroEnExecutionRef.current) return;

    // S'assurer que le stockage local IndexedDB est prêt
    await attendreHydratationLocale();

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session) return;

    const userId = sessionData.session.user.id;

    // 1️⃣ On vide d'abord la file d'attente vers Supabase
    await synchroniserFileDAttente();

    synchroEnExecutionRef.current = true;
    setSyncEnCours(true);

    try {
      console.log('🔄 [SyncManager] Synchronisation bidirectionnelle Cloud / Local...');

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
        const idsCloud = new Set(allTrades.map((t: any) => t.id));
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

        // ─── ÉTAPE CRUCIALE : DÉTECTION ET UPLOAD DES TRADES LOCAUX ABSENTS DU CLOUD ───
        // Si la tablette contient des trades qui ne sont pas encore sur Supabase
        const tradesManquantsSurCloud = tradesLocauxActuels.filter(
          (t) => !idsCloud.has(t.id) && !idsSupprimes.has(t.id)
        );

        if (tradesManquantsSurCloud.length > 0) {
          console.log(`📤 [SyncManager] ${tradesManquantsSurCloud.length} trade(s) local/tablette manquant(s) sur le Cloud. Téléversement automatique en cours...`);
          for (const localTrade of tradesManquantsSurCloud) {
            const uploadOk = await televerserTradeVersSupabase(localTrade, userId);
            if (uploadOk) {
              idsCloud.add(localTrade.id);
            }
          }
        }

        // 5. Fusion NON-DESTRUCTRICE des trades locaux et du Cloud
        const tradesMap = new Map<string, TradeWithSteps>();

        // 1. Conserver TOUS les trades locaux actuels (sauf ceux marqués pour suppression)
        for (const localTrade of tradesLocauxActuels) {
          if (!idsSupprimes.has(localTrade.id)) {
            tradesMap.set(localTrade.id, localTrade);
          }
        }

        // 2. Fusionner les trades reçus du Cloud
        for (const cloudTrade of (allTrades as TradeWithSteps[])) {
          if (idsSupprimes.has(cloudTrade.id)) continue;
          if (idsModifiesLocalement.has(cloudTrade.id)) continue;
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

