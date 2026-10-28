import { parserCsvPrix, type Bougie } from '@/lib/chartDataHelper';
import { recupererBougiesM1Cache, sauvegarderBougiesM1Cache } from '@/lib/backtestCache';

/**
 * ──────────────────────────────────────────────────────────────────────────────
 * 📡 CHARGEUR CLOUD & CACHE LOCAL DES DONNÉES DE MARCHÉ
 * ──────────────────────────────────────────────────────────────────────────────
 * Télécharge les historiques de bougies M1 compressés (.csv.gz) depuis les dépôts
 * Forex avec gestion multi-miroirs, sauvegarde automatique dans IndexedDB (Offline-First),
 * et concaténation multi-années chronologique pour les longues séances de backtest.
 * 
 * Exemple :
 * const bougiesM1 = await chargerBougiesM1('EURUSD', '2023-2025');
 */

// Paires Forex réelles présentes sur le dépôt GitHub fre-max/Forex_Data
export const PAIRES_CLOUD_DISPONIBLES = [
  'EURUSD',
  'GBPUSD',
  'USDJPY',
  'AUDUSD',
  'USDCAD',
  'USDCHF',
  'NZDUSD',
  'GBPJPY',
  'EURJPY',
  'EURGBP',
  'EURAUD',
  'EURCAD',
  'AUDJPY',
  'AUDNZD',
  'CADJPY',
  'CHFJPY',
  'GBPAUD',
];

// Historique disponible de 2025 à 2000 (26 années complètes)
export const ANNEES_CLOUD_DISPONIBLES = Array.from({ length: 26 }, (_, i) => String(2025 - i));

// Presets multi-années prêts à l'emploi pour les longues séances de backtesting
export const PRESETS_MULTI_ANNEES = [
  { label: '2025 (Année en cours)', valeur: '2025' },
  { label: '2024 (Année complète)', valeur: '2024' },
  { label: '2023 (Année complète)', valeur: '2023' },
  { label: '2023 - 2025 (3 ans cumulés)', valeur: '2023-2025' },
  { label: '2021 - 2025 (5 ans cumulés)', valeur: '2021-2025' },
  { label: '2020 - 2024 (5 ans historiques)', valeur: '2020-2024' },
];

/**
 * Décompose une sélection textuelle d'années en liste ordonnée d'années.
 * 
 * Exemples :
 * extraireAnneesDepuisSelection('2023-2025') -> ['2023', '2024', '2025']
 * extraireAnneesDepuisSelection('2024') -> ['2024']
 */
export function extraireAnneesDepuisSelection(anneeSelection: string): string[] {
  const texte = anneeSelection.trim();

  // 1️⃣ Format plage : "2023-2025"
  if (texte.includes('-')) {
    const morceaux = texte.split('-').map((m) => parseInt(m.trim(), 10));
    if (morceaux.length === 2 && !isNaN(morceaux[0]) && !isNaN(morceaux[1])) {
      const debut = Math.min(morceaux[0], morceaux[1]);
      const fin = Math.max(morceaux[0], morceaux[1]);
      const liste: string[] = [];
      for (let an = debut; an <= fin; an++) {
        liste.push(String(an));
      }
      return liste;
    }
  }

  // 2️⃣ Format liste séparée par des virgules : "2023, 2024"
  if (texte.includes(',')) {
    return texte.split(',').map((a) => a.trim()).filter((a) => a.length === 4);
  }

  // 3️⃣ Année unique : "2024"
  return [texte];
}

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
 * Charge une année unique de données M1 depuis IndexedDB ou le Cloud
 */
async function chargerBougiesM1UneAnnee(
  paireUpper: string,
  annee: string
): Promise<Bougie[]> {
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

/**
 * Récupère les données M1 soit pour une année unique, soit pour une plage de plusieurs années.
 * Si plusieurs années sont fournies, elles sont concaténées chronologiquement en une seule séquence.
 * 
 * Exemples :
 * const b1 = await chargerBougiesM1('EURUSD', '2024');
 * const bMulti = await chargerBougiesM1('EURUSD', '2023-2025');
 */
export async function chargerBougiesM1(
  paire: string,
  anneeOuPlage: string,
  surProgression?: (annee: string, index: number, total: number) => void
): Promise<Bougie[]> {
  const paireUpper = paire.toUpperCase();
  const annees = extraireAnneesDepuisSelection(anneeOuPlage);

  // 1. Cas simple : une seule année
  if (annees.length === 1) {
    return chargerBougiesM1UneAnnee(paireUpper, annees[0]);
  }

  // 2. Cas combiné multi-années : chargement séquentiel et assemblage chronologique
  console.log(`📚 [Cloud Loader] Chargement multi-années pour ${paireUpper} : [${annees.join(', ')}]`);
  const toutesLesBougies: Bougie[] = [];

  for (let i = 0; i < annees.length; i++) {
    const an = annees[i];
    if (surProgression) {
      surProgression(an, i + 1, annees.length);
    }
    console.log(`⏳ [Cloud Loader] Chargement année ${an} (${i + 1}/${annees.length})...`);
    const bougiesAnnee = await chargerBougiesM1UneAnnee(paireUpper, an);
    // ⚠️ Pas de push(...bougiesAnnee) : avec ~370 000 bougies M1 par an,
    // le spread dépasse la taille maximale de la pile ("Maximum call stack size exceeded").
    // Une boucle simple ajoute les bougies une par une sans risque.
    for (let k = 0; k < bougiesAnnee.length; k++) {
      toutesLesBougies.push(bougiesAnnee[k]);
    }
  }

  // 3. Tri chronologique et dédoublonnage de sécurité aux frontières d'années
  toutesLesBougies.sort((a, b) => {
    const ta = typeof a.time === 'number' ? a.time : Math.floor(new Date(a.time).getTime() / 1000);
    const tb = typeof b.time === 'number' ? b.time : Math.floor(new Date(b.time).getTime() / 1000);
    return ta - tb;
  });

  const bougiesUniques: Bougie[] = [];
  let dernierTimestamp = -1;

  for (let k = 0; k < toutesLesBougies.length; k++) {
    const b = toutesLesBougies[k];
    const ts = typeof b.time === 'number' ? b.time : Math.floor(new Date(b.time).getTime() / 1000);
    if (ts !== dernierTimestamp) {
      bougiesUniques.push(b);
      dernierTimestamp = ts;
    }
  }

  console.log(`✅ [Cloud Loader] Session multi-années assemblée : ${bougiesUniques.length} bougies M1 au total.`);
  return bougiesUniques;
}
