import { parserCsvPrix, type Bougie } from '@/lib/chartDataHelper';
import { recupererBougiesM1Cache, sauvegarderBougiesM1Cache } from '@/lib/backtestCache';

/**
 * ──────────────────────────────────────────────────────────────────────────────
 * 📡 CHARGEUR CLOUD & CACHE LOCAL DES DONNÉES DE MARCHÉ
 * ──────────────────────────────────────────────────────────────────────────────
 * Télécharge les historiques de bougies M1 compressés (.csv.gz) depuis les dépôts
 * Forex avec gestion multi-miroirs et sauvegarde automatique dans IndexedDB (Offline-First).
 * 
 * Exemple :
 * const bougiesM1 = await chargerBougiesM1('XAUUSD', '2025');
 */

/**
 * Télécharge un fichier depuis les miroirs Cloud
 */
export async function telechargerFichierCloud(nomFichier: string): Promise<Response> {
  const miroirs = [
    `https://raw.githubusercontent.com/fre-max/Forex_Data/main/forex_data/${nomFichier}`,
    `https://github.com/fre-max/Forex_Data/raw/main/forex_data/${nomFichier}`,
    `https://cdn.jsdelivr.net/gh/fre-max/Forex_Data@main/forex_data/${nomFichier}`,
    `https://cdn.statically.io/gh/fre-max/Forex_Data/main/forex_data/${nomFichier}`,
  ];

  const tentatives: string[] = [];

  for (const url of miroirs) {
    try {
      const controleur = new AbortController();
      const idTimeout = setTimeout(() => controleur.abort(), 25000);

      const reponse = await fetch(url, {
        signal: controleur.signal,
        mode: 'cors',
        cache: 'default',
      });
      clearTimeout(idTimeout);

      if (reponse.ok) {
        return reponse;
      } else {
        tentatives.push(`HTTP ${reponse.status} sur ${url}`);
      }
    } catch (erreur: any) {
      const message = erreur?.name === 'AbortError'
        ? `Timeout (25s) sur ${url}`
        : `${erreur?.message || String(erreur)} — sur ${url}`;
      tentatives.push(message);
    }
  }

  throw new Error(
    `Impossible de télécharger ${nomFichier}.\nTentatives échouées :\n${tentatives.join('\n')}`
  );
}

/**
 * Décompresse un flux gzip en texte CSV brut
 */
export async function decompresserGzipEnTexte(reponse: Response): Promise<string> {
  const buffer = await reponse.arrayBuffer();

  // 1. Essai avec DecompressionStream natif
  if (typeof DecompressionStream !== 'undefined') {
    try {
      const blob = new Blob([buffer]);
      const stream = blob.stream().pipeThrough(new DecompressionStream('gzip'));
      const texte = await new Response(stream).text();
      if (texte && texte.length > 0) return texte;
    } catch (e) {
      console.warn('⚠️ [Decompress] Fallback vers le décompresseur pako:', e);
    }
  }

  // 2. Fallback universel pako (supporté sur 100% des smartphones Android)
  const pako = await import('pako');
  return pako.ungzip(new Uint8Array(buffer), { to: 'string' });
}

/**
 * Récupère les données M1 soit depuis le cache local IndexedDB, soit depuis le Cloud
 */
export async function chargerBougiesM1(
  paire: string,
  annee: string
): Promise<Bougie[]> {
  const paireUpper = paire.toUpperCase();

  // 1️⃣ Tentative de lecture depuis le cache IndexedDB
  const cacheLocal = await recupererBougiesM1Cache(paireUpper, annee);
  if (cacheLocal && cacheLocal.length > 0) {
    return cacheLocal;
  }

  // 2️⃣ Téléchargement depuis le Cloud si absent
  const nomFichier = `${paireUpper}_M1_${annee}.csv.gz`;
  const reponse = await telechargerFichierCloud(nomFichier);
  const texteCsv = await decompresserGzipEnTexte(reponse);
  const bougiesM1 = parserCsvPrix(texteCsv);

  // 3️⃣ Mise en cache pour les prochaines exécutions hors-ligne
  await sauvegarderBougiesM1Cache(paireUpper, annee, bougiesM1);

  return bougiesM1;
}
