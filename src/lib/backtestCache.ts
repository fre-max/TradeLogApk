import { get, set } from 'idb-keyval';
import type { Bougie } from '@/lib/chartDataHelper';

/**
 * Génère une clé de stockage unique dans IndexedDB pour une paire et une année données.
 * 
 * Exemple :
 * const key = obtenirCleCache('EURUSD', '2025'); // "backtest_m1_EURUSD_2025"
 */
function obtenirCleCache(paire: string, annee: string): string {
  return `backtest_m1_${paire.toUpperCase()}_${annee}`;
}

/**
 * Enregistre les bougies M1 dans la base IndexedDB locale du navigateur.
 * Permet de conserver l'historique sur l'appareil pour une utilisation 100% offline.
 * 
 * Exemple :
 * await sauvegarderBougiesM1Cache('EURUSD', '2025', mesBougiesM1);
 */
export async function sauvegarderBougiesM1Cache(
  paire: string,
  annee: string,
  bougies: Bougie[]
): Promise<void> {
  // 1️⃣ Vérification des paramètres
  if (!paire || !annee || !bougies || bougies.length === 0) {
    console.warn('⚠️ [Backtest Cache] Tentative de sauvegarde avec des données invalides.');
    return;
  }

  try {
    const key = obtenirCleCache(paire, annee);
    // 2️⃣ Enregistrement dans IndexedDB
    await set(key, bougies);
    console.log(`💾 [Backtest Cache] ${bougies.length} bougies M1 sauvegardées dans IndexedDB pour ${paire} (${annee})`);
  } catch (error) {
    console.error('❌ [Backtest Cache] Erreur lors de la sauvegarde dans IndexedDB:', error);
  }
}

/**
 * Récupère les bougies M1 sauvegardées dans IndexedDB.
 * Retourne null si aucune donnée n'est trouvée pour cette paire et année.
 * 
 * Exemple :
 * const bougiesLocales = await recupererBougiesM1Cache('EURUSD', '2025');
 * if (bougiesLocales) {
 *   console.log('Données chargées en mode offline !');
 * }
 */
export async function recupererBougiesM1Cache(
  paire: string,
  annee: string
): Promise<Bougie[] | null> {
  // 1️⃣ Vérification des paramètres
  if (!paire || !annee) return null;

  try {
    const key = obtenirCleCache(paire, annee);
    // 2️⃣ Lecture depuis IndexedDB
    const bougies = await get<Bougie[]>(key);
    
    if (bougies && Array.isArray(bougies) && bougies.length > 0) {
      console.log(`⚡ [Backtest Cache] ${bougies.length} bougies M1 récupérées depuis IndexedDB (${paire} ${annee})`);
      return bougies;
    }
    
    return null;
  } catch (error) {
    console.error('❌ [Backtest Cache] Erreur lors de la lecture depuis IndexedDB:', error);
    return null;
  }
}
