import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qzjcgfvxbwrbjwqqqhci.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6amNnZnZ4YndyYmp3cXFxaGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0MzUwNjYsImV4cCI6MjA5NzAxMTA2Nn0.Ez_Jst2kUowARSeJR-2sCaw8hM-B6CxXS3isl1W_Iis';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runDiagnostic() {
  console.log('🩺 === DIAGNOSTIC DU BACKEND SUPABASE ===');
  console.log(`📍 URL: ${SUPABASE_URL}`);

  // 1. Test ping / santé HTTP basique
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: { apikey: SUPABASE_ANON_KEY }
    });
    console.log(`✅ [HTTP REST API] Réponse HTTP: ${res.status} ${res.statusText}`);
  } catch (err) {
    console.error(`❌ [HTTP REST API] Erreur de connexion:`, err.message);
  }

  // 2. Test table 'trades'
  try {
    const { data, count, error } = await supabase
      .from('trades')
      .select('*', { count: 'exact', head: false })
      .limit(5);

    if (error) {
      console.error(`❌ [Table trades] Erreur: ${error.message} (Code: ${error.code})`);
      if (error.code === '42501' || error.message.includes('row-level security') || error.message.includes('policy')) {
        console.warn(`⚠️ [RLS] Note: La table 'trades' est protégée par Row Level Security (RLS). Une session utilisateur authentifiée est obligatoire pour lire les trades !`);
      }
    } else {
      console.log(`✅ [Table trades] Succès ! Total trades accessibles: ${count ?? data?.length} (Aperçu de ${data?.length} éléments)`);
    }
  } catch (err) {
    console.error(`❌ [Table trades] Exception:`, err.message);
  }

  // 3. Test table 'strategies'
  try {
    const { data, count, error } = await supabase
      .from('strategies')
      .select('*', { count: 'exact' })
      .limit(5);

    if (error) {
      console.error(`❌ [Table strategies] Erreur: ${error.message}`);
    } else {
      console.log(`✅ [Table strategies] Accessible ! Total: ${count ?? data?.length}`);
    }
  } catch (err) {
    console.error(`❌ [Table strategies] Exception:`, err.message);
  }

  // 4. Test table 'reason_families' & 'reason_catalog'
  try {
    const { data: families, error: famErr } = await supabase.from('reason_families').select('*').limit(5);
    if (famErr) {
      console.error(`❌ [Table reason_families] Erreur: ${famErr.message}`);
    } else {
      console.log(`✅ [Table reason_families] Accessible ! Nombre: ${families?.length}`);
    }
  } catch (err) {
    console.error(`❌ [Table reason_families] Exception:`, err.message);
  }

  // 5. Test Storage 'trade-images'
  try {
    const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
    if (bErr) {
      console.error(`❌ [Storage] Erreur listage buckets: ${bErr.message}`);
    } else {
      console.log(`✅ [Storage] Buckets disponibles:`, buckets.map(b => b.name));
    }
  } catch (err) {
    console.error(`❌ [Storage] Exception:`, err.message);
  }

  console.log('🩺 === FIN DU DIAGNOSTIC ===');
}

runDiagnostic();
