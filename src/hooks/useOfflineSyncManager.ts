import { useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOfflineSyncStore } from '@/store/offlineSyncStore';
import { useQueryClient } from '@tanstack/react-query';

export function useOfflineSyncManager() {
  const { queue, retirerDeLaFile } = useOfflineSyncStore();
  const queryClient = useQueryClient();

  const synchroniserFileDAttente = useCallback(async () => {
    // Si la file est vide ou si on n'a pas internet, on annule
    if (queue.length === 0 || !navigator.onLine) return;

    // Vérifier si l'utilisateur est connecté à Supabase
    let sessionData = null;
    try {
      const res = await supabase.auth.getSession();
      sessionData = res.data;
    } catch (e) {
      console.warn('🔄 [SyncManager] Erreur récupération session Supabase (hors-ligne):', e);
      return;
    }

    if (!sessionData?.session) {
      console.log('🔄 [SyncManager] Pas de session Supabase active. Synchronisation reportée.');
      return;
    }

    console.log(`🔄 [SyncManager] Démarrage de la synchro de ${queue.length} trade(s)...`);

    for (const item of queue) {
      try {
        console.log(`[SyncManager] Traitement de l'action ${item.action} pour le trade ${item.tradeId}`);

        if (item.action === 'DELETE') {
          // Suppression asynchrone sur Supabase
          const { error } = await supabase.from('trades').delete().eq('id', item.tradeId);
          if (error) throw error;
          retirerDeLaFile(item.id);
          continue;
        }

        // Pour INSERT et UPDATE
        let tradeDataToInsert = { ...item.tradeData };

        // Si le trade a été créé hors-ligne avec un ID temporaire, on lui attribue l'ID de l'utilisateur connecté
        if (tradeDataToInsert.user_id === 'local-user' || !tradeDataToInsert.user_id) {
          tradeDataToInsert.user_id = sessionData.session.user.id;
        }

        // 1. Upload des images locales (Base64) vers Supabase Storage
        let updatedImages = item.images || [];
        if (updatedImages.length > 0) {
          const { base64ToBlob, uploadImage } = await import('@/lib/storage');
          updatedImages = await Promise.all(updatedImages.map(async (img: any) => {
            if (img.url?.startsWith('data:image/')) {
              console.log(`[SyncManager] Upload de l'image locale pour phase: ${img.phase}`);
              const blob = base64ToBlob(img.url);
              const cleanFileName = `offline_sync_${img.phase}_${img.context}_${Date.now()}.jpg`;
              const path = `trade_images/${sessionData.session.user.id}/${item.tradeId}/${cleanFileName}`;
              
              const publicUrl = await uploadImage(blob as File, path);
              
              return { ...img, url: publicUrl, storage_path: path };
            }
            return img;
          }));
        }

        // 2. Traitement du trade
        if (item.action === 'INSERT') {
          const { error } = await supabase.from('trades').insert(tradeDataToInsert);
          if (error) throw error;
        } else if (item.action === 'UPDATE') {
          const { error } = await supabase.from('trades').update(tradeDataToInsert).eq('id', item.tradeId);
          if (error) throw error;
        }

        // 3. Traitement des étapes
        if (item.steps && item.steps.length > 0) {
          const { error: stepsError } = await supabase.from('steps').upsert(item.steps);
          if (stepsError) throw stepsError;
        }

        // 4. Traitement des raisons
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

        // 5. Traitement des images (mise à jour des liens publics dans la BDD)
        if (updatedImages.length > 0 || (item.images && item.images.length === 0)) {
          await supabase.from('trade_images').delete().eq('trade_id', item.tradeId);
          if (updatedImages.length > 0) {
            const inserts = updatedImages.map((img: any) => ({
              trade_id: item.tradeId,
              phase: img.phase,
              context: img.context,
              url: img.url,
              source: img.source || 'upload',
              storage_path: img.storage_path || null
            }));
            const { error: imagesError } = await supabase.from('trade_images').insert(inserts);
            if (imagesError) throw imagesError;
          }
        }

        console.log(`✅ [SyncManager] Action ${item.action} réussie pour le trade ! ID: ${item.tradeId}`);
        
        // 6. On retire le trade de la file d'attente locale
        retirerDeLaFile(item.id);

        // 7. Déclenchement de l'IA (detect-news) en arrière-plan (seulement sur INSERT)
        if (item.action === 'INSERT' && tradeDataToInsert.date_backtested && tradeDataToInsert.entry_time) {
          console.log(`🤖 [SyncManager] Lancement de l'IA pour le trade ${item.tradeId}...`);
          const token = sessionData?.session?.access_token;
          supabase.functions.invoke('detect-news', {
            body: {
              trade_id: item.tradeId,
              pair: tradeDataToInsert.pair,
              date: tradeDataToInsert.date_backtested,
              entry_time: tradeDataToInsert.entry_time,
              exit_time: tradeDataToInsert.exit_time || null,
            },
            headers: token ? { Authorization: `Bearer ${token}` } : undefined
          }).catch(err => console.error(`❌ [SyncManager] Erreur IA:`, err));
        }

      } catch (err: any) {
        console.error(`❌ [SyncManager] Erreur inattendue pour l'action ${item.action} (${item.tradeId}):`, err.message || err);
      }
    }

    // Rafraîchit les données React Query une fois la file traitée
    queryClient.invalidateQueries({ queryKey: ['trades'] });

  }, [queue, retirerDeLaFile, queryClient]);

  // Fonction principale : copie TOUT Supabase vers la base locale
  // Appelée au moment du login ou quand le réseau revient avec une session active
  const syncAll = useCallback(async () => {
    if (!navigator.onLine) return;
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session) return;

    try {
      console.log('🔄 [SyncManager] Téléchargement des données annexes (Offline-First)...');
      const { useLocalDatabase } = await import('@/store/useLocalDatabase');
      
      // 1. Stratégies
      const { data: strategies } = await supabase.from('strategies').select('*').order('created_at', { ascending: false });
      if (strategies) useLocalDatabase.getState().setStrategies(strategies);

      // 2. Familles de raisons
      const { data: reasonFamilies } = await supabase.from('reason_families').select('*').order('order', { ascending: true });
      if (reasonFamilies) useLocalDatabase.getState().setReasonFamilies(reasonFamilies);

      // 3. Catalogue complet
      const { data: catalog } = await supabase.from('reason_catalog').select('*, family: reason_families (id, name, slug), variants: reason_variants (*)')
        .order('created_at', { ascending: false });
      if (catalog) {
        const itemsAvecType = catalog.map((item: any) => {
          const familyName = (item.family?.name || '').toLowerCase()
          let type = 'confirmation'
          if (familyName.includes('biais')) type = 'biais'
          else if (familyName.includes('poi') || familyName.includes('zone')) type = 'poi'
          else if (familyName.includes('sl') || familyName.includes('stop loss') || familyName.includes('loss')) type = 'sl'
          else if (familyName.includes('tp') || familyName.includes('take profit') || familyName.includes('profit')) type = 'tp'
          else if (familyName.includes('trailing')) type = 'trailing'
          else if (familyName.includes('entr') || familyName.includes('setup')) type = 'entry'
          return { ...item, type }
        })
        useLocalDatabase.getState().setCatalogItems(itemsAvecType);
      }

      // 4. Les Trades (avec étapes, images, et raisons)
      console.log('🔄 [SyncManager] Téléchargement des trades pour accès hors-ligne...');
      const { data: allTrades, error: tradesError } = await supabase
        .from('trades')
        .select(`
          *,
          steps (*, images: step_images (*)),
          images: trade_images (*),
          reasons: trade_reasons (reason_id, variant_name)
        `)
        .order('created_at', { ascending: false });

      if (tradesError) {
        console.error('❌ [SyncManager] Erreur récupération trades:', tradesError);
      } else if (allTrades) {
        useLocalDatabase.getState().setTrades(allTrades as any);
        console.log(`✅ [SyncManager] ${allTrades.length} trades sauvegardés localement.`);
        queryClient.invalidateQueries({ queryKey: ['trades'] });
      }
      
      // Mettre à jour React Query
      queryClient.invalidateQueries({ queryKey: ['strategies'] });
      queryClient.invalidateQueries({ queryKey: ['reason_families'] });
      queryClient.invalidateQueries({ queryKey: ['reason_catalog'] });
      
      console.log('✅ [SyncManager] Données annexes copiées en local !');
    } catch (error) {
      console.error('❌ [SyncManager] Erreur lors de la synchro annexe:', error);
    }
  }, [queryClient]);

  // Écoute les événements en ligne / hors ligne du navigateur (Capacitor Webview)
  useEffect(() => {
    window.addEventListener('online', synchroniserFileDAttente);
    // Quand le réseau revient, on vide la file d'attente + on resync si session active
    window.addEventListener('online', syncAll);
    
    // Vérification de la file d'attente au démarrage et toutes les 30 secondes
    synchroniserFileDAttente();
    const interval = setInterval(() => {
      synchroniserFileDAttente();
    }, 30000);

    return () => {
      window.removeEventListener('online', synchroniserFileDAttente);
      window.removeEventListener('online', syncAll);
      clearInterval(interval);
    };
  }, [synchroniserFileDAttente, syncAll]);

  // Retourner syncAll pour que App.tsx puisse l'appeler au moment du login
  return { syncAll };
}
