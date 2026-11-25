/**
 * Structure de données pour une bougie (OHLC) compatible avec TradingView Lightweight Charts
 */
export interface Bougie {
  time: number | string; // Date au format YYYY-MM-DD ou Timestamp UNIX en secondes
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/**
 * Récupère les données historiques réelles de Binance (API publique gratuite)
 * 
 * Exemple :
 * const btc = await recupererDonneesBinance('BTCUSDT', '1h');
 */
export async function recupererDonneesBinance(symbole: string, intervalle: string = '1h', limite: number = 500): Promise<Bougie[]> {
  console.log(`📡 [Binance API] Récupération de ${limite} bougies pour ${symbole} (${intervalle})...`);
  try {
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbole}&interval=${intervalle}&limit=${limite}`;
    const reponse = await fetch(url);
    if (!reponse.ok) throw new Error(`Erreur API Binance: ${reponse.statusText}`);

    const rawData = await reponse.json();
    console.log(`✅ [Binance API] ${rawData.length} bougies récupérées.`);

    // Conversion du format brut Binance vers notre interface Bougie
    return rawData.map((ligne: any) => ({
      time: Math.floor(ligne[0] / 1000), // Conversion du timestamp ms en secondes
      open: parseFloat(ligne[1]),
      high: parseFloat(ligne[2]),
      low: parseFloat(ligne[3]),
      close: parseFloat(ligne[4])
    }));
  } catch (erreur) {
    console.error(`❌ [Binance API] Impossible de charger les données:`, erreur);
    throw erreur;
  }
}

/**
 * Analyse et convertit le contenu textuel d'un fichier CSV en liste de bougies.
 * Supporte les séparateurs de type virgule (,) et point-virgule (;).
 * 
 * Exemple :
 * const bougies = parserCsvPrix("Date,Open,High,Low,Close\n2026-07-01,10,12,9,11");
 */
export function parserCsvPrix(contenuTextuel: string): Bougie[] {
  console.log('🚀 [CSV Parser] Début de l\'analyse du fichier CSV...');

  // 1️⃣ Découpage direct par ligne (sans map ni filter intermédiaires pour préserver la RAM mobile)
  const lignes = contenuTextuel.split(/\r?\n/);
  if (lignes.length < 1) {
    throw new Error("Le fichier CSV est vide.");
  }

  // 2️⃣ Analyse de la première ligne non vide
  let premiereLigneIndex = 0;
  while (premiereLigneIndex < lignes.length && lignes[premiereLigneIndex].trim().length === 0) {
    premiereLigneIndex++;
  }
  if (premiereLigneIndex >= lignes.length) {
    throw new Error("Le fichier CSV ne contient aucune donnée.");
  }

  const premiereLigne = lignes[premiereLigneIndex].trim();
  const separateur = premiereLigne.includes(';') ? ';' : (premiereLigne.includes('\t') ? '\t' : ',');
  const colonnesPremiereLigne = premiereLigne.split(separateur).map(c => c.trim().toLowerCase());

  // Déterminer s'il y a un en-tête dans le fichier
  const aUnEntete = colonnesPremiereLigne.some(c => 
    c.includes('date') || c.includes('time') || c.includes('open') || c.includes('close') || c.includes('high')
  );

  let indexDate = 0;
  let indexHeure = -1;
  let indexOpen = 1;
  let indexHigh = 2;
  let indexLow = 3;
  let indexClose = 4;
  let formatSansEntete: 'histdata' | 'metatrader' | 'standard' = 'histdata';
  let ligneDeDepart = premiereLigneIndex;

  if (aUnEntete) {
    console.log(`📡 [CSV Parser] En-tête détecté avec séparateur "${separateur}"`);
    indexDate = colonnesPremiereLigne.findIndex(c => c.includes('date') || c.includes('time') || c.includes('timestamp') || c.includes('heure'));
    indexOpen = colonnesPremiereLigne.findIndex(c => c === 'open' || c === 'o' || c === 'ouvert' || c === 'ouverture');
    indexHigh = colonnesPremiereLigne.findIndex(c => c === 'high' || c === 'h' || c === 'haut' || c === 'maximum');
    indexLow = colonnesPremiereLigne.findIndex(c => c === 'low' || c === 'l' || c === 'bas' || c === 'minimum');
    indexClose = colonnesPremiereLigne.findIndex(c => c === 'close' || c === 'c' || c === 'cloture' || c === 'fermeture');
    formatSansEntete = 'standard';
    ligneDeDepart = premiereLigneIndex + 1;
  } else {
    // Fichier sans en-tête : détection automatique
    const estDateMetaTrader = /^\d{4}[\.\-\/]\d{2}[\.\-\/]\d{2}$/.test(colonnesPremiereLigne[0]);
    const estHeureMetaTrader = /^\d{2}:\d{2}(:\d{2})?$/.test(colonnesPremiereLigne[1]);

    if (estDateMetaTrader && estHeureMetaTrader) {
      console.log("👉 [CSV Parser] Format MetaTrader détecté");
      formatSansEntete = 'metatrader';
      indexDate = 0;
      indexHeure = 1;
      indexOpen = 2;
      indexHigh = 3;
      indexLow = 4;
      indexClose = 5;
    } else {
      // Par défaut : format HistData (DateHeure;O;H;L;C;Volume) utilisé par Forex_Data Cloud
      formatSansEntete = 'histdata';
      indexDate = 0;
      indexOpen = 1;
      indexHigh = 2;
      indexLow = 3;
      indexClose = 4;
    }
  }

  const resultats: Bougie[] = [];
  let dernierTempsEnregistre: number | string | null = null;
  const separateurChar = separateur;

  // 3️⃣ Parcours direct et ultra-rapide des lignes
  for (let i = ligneDeDepart; i < lignes.length; i++) {
    const rawLine = lignes[i];
    if (rawLine.length < 10) continue;

    const v = rawLine.split(separateurChar);
    if (v.length < 5) continue;

    try {
      let dateTimestamp: number | string;

      if (formatSansEntete === 'histdata') {
        // Format HistData : "YYYYMMDD HHMMSS" (ex: "20250101 170000")
        const d = v[indexDate].trim();
        if (d.length >= 15) {
          // Date.UTC direct sans allocation de chaîne ISO intermédiaire
          const annee = parseInt(d.substring(0, 4), 10);
          const mois = parseInt(d.substring(4, 6), 10) - 1;
          const jour = parseInt(d.substring(6, 8), 10);
          const heure = parseInt(d.substring(9, 11), 10);
          const minute = parseInt(d.substring(11, 13), 10);
          const seconde = parseInt(d.substring(13, 15), 10);

          dateTimestamp = Math.floor(Date.UTC(annee, mois, jour, heure, minute, seconde) / 1000);
        } else {
          continue;
        }
      } else if (formatSansEntete === 'metatrader') {
        const dateBrute = v[indexDate].trim().replace(/\./g, '-');
        const heureBrute = v[indexHeure].trim();
        dateTimestamp = Math.floor(Date.parse(`${dateBrute}T${heureBrute}:00Z`) / 1000);
      } else {
        const dateBrute = v[indexDate].trim();
        const ts = Date.parse(dateBrute);
        if (isNaN(ts)) {
          if (/^\d{4}-\d{2}-\d{2}$/.test(dateBrute)) {
            dateTimestamp = dateBrute;
          } else {
            continue;
          }
        } else {
          dateTimestamp = Math.floor(ts / 1000);
        }
      }

      if (typeof dateTimestamp === 'number' && isNaN(dateTimestamp)) continue;

      const open = parseFloat(v[indexOpen]);
      const high = parseFloat(v[indexHigh]);
      const low = parseFloat(v[indexLow]);
      const close = parseFloat(v[indexClose]);

      if (isNaN(open) || isNaN(high) || isNaN(low) || isNaN(close)) continue;

      // Élimination immédiate des doublons consécutifs (très fréquent en M1)
      if (dateTimestamp === dernierTempsEnregistre) continue;
      dernierTempsEnregistre = dateTimestamp;

      resultats.push({
        time: dateTimestamp,
        open,
        high,
        low,
        close,
      });
    } catch {
      // Ignorer une éventuelle ligne corrompue
    }
  }

  if (resultats.length === 0) {
    throw new Error("Aucune bougie valide n'a pu être extraite du fichier.");
  }

  // Garantir le tri chronologique strict et l'absence de doublons non consécutifs
  const bougiesPropres = nettoyerEtTrierBougies(resultats);

  console.log(`✅ [CSV Parser] ${bougiesPropres.length} bougies parsées avec succès.`);
  return bougiesPropres;
}

/**
 * Convertit le champ `time` d'une bougie (nombre ou chaîne de date) en timestamp Unix (secondes).
 *
 * Exemple :
 * const ts = extraireTimestampSecondes(1577664000); // 1577664000
 */
export function extraireTimestampSecondes(temps: number | string): number {
  if (typeof temps === 'number') {
    return temps;
  }
  const ms = Date.parse(temps);
  return isNaN(ms) ? 0 : Math.floor(ms / 1000);
}

/**
 * Garantit qu'une liste de bougies est strictement triée par ordre chronologique croissant
 * et fusionne les éventuels doublons de timestamp (ex: bougie W1 ou D1 à cheval sur deux années).
 * Indispensable pour éviter l'erreur Lightweight Charts : "data must be asc ordered by time".
 *
 * Exemple :
 * const bougiesPropres = nettoyerEtTrierBougies(bougiesBrutes);
 */
export function nettoyerEtTrierBougies(bougies: Bougie[]): Bougie[] {
  if (!bougies || bougies.length <= 1) {
    return bougies || [];
  }

  // 1️⃣ Vérifier en un seul passage si le tableau est déjà strictement croissant
  let estDejaStrictementCroissant = true;
  let estTrieAvecDoublons = true;
  let tempsPrecedent = extraireTimestampSecondes(bougies[0].time);

  for (let i = 1; i < bougies.length; i++) {
    const tempsActuel = extraireTimestampSecondes(bougies[i].time);
    if (tempsActuel <= tempsPrecedent) {
      estDejaStrictementCroissant = false;
      if (tempsActuel < tempsPrecedent) {
        estTrieAvecDoublons = false;
        break;
      }
    }
    tempsPrecedent = tempsActuel;
  }

  // Si tout est déjà strictement croissant, on retourne le tableau tel quel sans copie inutile
  if (estDejaStrictementCroissant) {
    return bougies;
  }

  // 2️⃣ Si l'ordre chronologique n'est pas respecté, on trie une copie du tableau
  const listeTriee = estTrieAvecDoublons
    ? bougies
    : [...bougies].sort((a, b) => extraireTimestampSecondes(a.time) - extraireTimestampSecondes(b.time));

  // 3️⃣ Fusion des bougies ayant exactement le même timestamp (ex: semaine à cheval entre fin 2019 et début 2020)
  const resultats: Bougie[] = [];
  let dernierTemps = -Infinity;

  for (let i = 0; i < listeTriee.length; i++) {
    const bougie = listeTriee[i];
    const temps = extraireTimestampSecondes(bougie.time);
    if (!temps || isNaN(temps)) continue;

    if (temps === dernierTemps && resultats.length > 0) {
      // Fusion OHLC : on conserve l'ouverture initiale et la dernière clôture
      const precedente = resultats[resultats.length - 1];
      resultats[resultats.length - 1] = {
        ...precedente,
        high: Math.max(precedente.high, bougie.high),
        low: Math.min(precedente.low, bougie.low),
        close: bougie.close,
      };
    } else if (temps > dernierTemps) {
      resultats.push(bougie);
      dernierTemps = temps;
    }
  }

  return resultats;
}

// ─── 🚀 Cache Mémoïsé pour l'Agrégation Multi-Timeframe (MTF) ────────────────
// Évite de ré-agréger 50 000 bougies M1 à chaque tic de replay ou boucle de backtest.
const cacheAgregationMTF = new Map<string, Bougie[]>();

/**
 * Agrège des bougies M1 en bougies d'une unité de temps supérieure (ex: 5m, 15m, 1h, 1d).
 * Utilise un cache mémoïsé ultra-rapide pour des performances maximales.
 */
export function agregerBougies(bougiesM1: Bougie[], timeframeSuperior: string): Bougie[] {
  // 1 minute : pas d'agrégation nécessaire, mais on s'assure de l'ordre strict sans doublons
  if (timeframeSuperior === '1m' || timeframeSuperior === 'M1') {
    return nettoyerEtTrierBougies(bougiesM1);
  }

  if (!bougiesM1 || bougiesM1.length === 0) {
    return [];
  }

  // 1️⃣ Clé de cache rapide basée sur la taille et les bornes temporelles
  const premiere = bougiesM1[0];
  const derniere = bougiesM1[bougiesM1.length - 1];
  const cleCache = `${timeframeSuperior}_${bougiesM1.length}_${premiere?.time}_${derniere?.time}`;

  const resultatEnCache = cacheAgregationMTF.get(cleCache);
  if (resultatEnCache) {
    return resultatEnCache;
  }

  const isMonthly = timeframeSuperior === '1M' || timeframeSuperior === 'Monthly' || timeframeSuperior === 'MN' || timeframeSuperior === 'monthly';
  const isWeekly = timeframeSuperior === '1w' || timeframeSuperior === 'W1' || timeframeSuperior === '1W' || timeframeSuperior === 'weekly';
  const isDaily = timeframeSuperior === '1d' || timeframeSuperior === 'D1' || timeframeSuperior === 'daily';
  const isH4 = timeframeSuperior === '4h' || timeframeSuperior === 'H4';
  const isH1 = timeframeSuperior === '1h' || timeframeSuperior === 'H1';
  const isM30 = timeframeSuperior === '30m' || timeframeSuperior === 'M30';
  const isM15 = timeframeSuperior === '15m' || timeframeSuperior === 'M15';
  const isM5 = timeframeSuperior === '5m' || timeframeSuperior === 'M5';

  const getBucketStart = (timestampSec: number): number => {
    if (isM5) {
      return Math.floor(timestampSec / 300) * 300;
    } else if (isM15) {
      return Math.floor(timestampSec / 900) * 900;
    } else if (isM30) {
      return Math.floor(timestampSec / 1800) * 1800;
    } else if (isH1) {
      return Math.floor(timestampSec / 3600) * 3600;
    } else if (isH4) {
      return Math.floor(timestampSec / 14400) * 14400;
    } else if (isDaily) {
      return Math.floor(timestampSec / 86400) * 86400;
    } else if (isWeekly) {
      const d = new Date(timestampSec * 1000);
      const day = d.getUTCDay(); // 0 = Dimanche, 1 = Lundi, ..., 6 = Samedi
      const diffToMonday = (day + 6) % 7;
      const mondayDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diffToMonday));
      return Math.floor(mondayDate.getTime() / 1000);
    } else if (isMonthly) {
      const d = new Date(timestampSec * 1000);
      const firstOfMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
      return Math.floor(firstOfMonth.getTime() / 1000);
    }

    return Math.floor(timestampSec / 3600) * 3600;
  };

  // 🚀 Agrégation linéaire en un seul passage O(N) quand les bougies M1 sont déjà triées chronologiquement.
  // Évite de créer 370 000 copies d'objets + 74 000 tableaux intermédiaires et tris lors du changement d'UT.
  const resultats: Bougie[] = [];
  let estStrictementCroissant = true;
  let dernierBucket = -Infinity;
  let bougieCourante: Bougie | null = null;

  for (let i = 0; i < bougiesM1.length; i++) {
    const b = bougiesM1[i];
    const timestampSec = typeof b.time === 'number' ? b.time : Math.floor(Date.parse(b.time as string) / 1000);
    if (isNaN(timestampSec)) continue;

    const bucketStart = getBucketStart(timestampSec);

    if (bucketStart === dernierBucket && bougieCourante !== null) {
      // Même bougie agrégée : mise à jour directe en place O(1)
      if (b.high > bougieCourante.high) bougieCourante.high = b.high;
      if (b.low < bougieCourante.low) bougieCourante.low = b.low;
      bougieCourante.close = b.close;
    } else if (bucketStart > dernierBucket) {
      // Nouvelle bougie agrégée strictement postérieure
      bougieCourante = {
        time: bucketStart,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      };
      resultats.push(bougieCourante);
      dernierBucket = bucketStart;
    } else {
      // Données source non triées : on bascule sur le repli sécurisé par Map
      estStrictementCroissant = false;
      break;
    }
  }

  let finalAggregated: Bougie[];

  if (estStrictementCroissant) {
    finalAggregated = resultats;
  } else {
    // Repli sécurisé sans tableaux intermédiaires ni spread inutile si la source n'était pas triée
    const groupes = new Map<number, { time: number; minT: number; maxT: number; open: number; high: number; low: number; close: number }>();

    for (let i = 0; i < bougiesM1.length; i++) {
      const b = bougiesM1[i];
      const timestampSec = typeof b.time === 'number' ? b.time : Math.floor(Date.parse(b.time as string) / 1000);
      if (isNaN(timestampSec)) continue;

      const bucketStart = getBucketStart(timestampSec);
      const existant = groupes.get(bucketStart);
      if (!existant) {
        groupes.set(bucketStart, {
          time: bucketStart,
          minT: timestampSec,
          maxT: timestampSec,
          open: b.open,
          high: b.high,
          low: b.low,
          close: b.close,
        });
      } else {
        if (b.high > existant.high) existant.high = b.high;
        if (b.low < existant.low) existant.low = b.low;
        if (timestampSec < existant.minT) {
          existant.minT = timestampSec;
          existant.open = b.open;
        }
        if (timestampSec >= existant.maxT) {
          existant.maxT = timestampSec;
          existant.close = b.close;
        }
      }
    }

    const bucketTries = Array.from(groupes.values()).sort((a, b) => a.time - b.time);
    finalAggregated = bucketTries.map((g) => ({
      time: g.time,
      open: g.open,
      high: g.high,
      low: g.low,
      close: g.close,
    }));
  }

  // Conserver au maximum 50 séries agrégées en cache pour économiser la mémoire mobile
  if (cacheAgregationMTF.size >= 50) {
    const premiereCle = cacheAgregationMTF.keys().next().value;
    if (premiereCle) cacheAgregationMTF.delete(premiereCle);
  }
  cacheAgregationMTF.set(cleCache, finalAggregated);

  return finalAggregated;
}
