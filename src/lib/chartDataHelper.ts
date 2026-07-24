/**
 * Structure de données pour une bougie (OHLC) compatible avec TradingView Lightweight Charts
 */
export interface Bougie {
  time: number | string; // Date au format YYYY-MM-DD ou Timestamp UNIX en secondes
  open: number;
  high: number;
  low: number;
  close: number;
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

  // 1️⃣ Découpage par ligne et nettoyage
  const lignes = contenuTextuel.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lignes.length < 1) {
    throw new Error("Le fichier CSV est vide.");
  }

  // 2️⃣ Détection du séparateur (virgule, point-virgule ou tabulation)
  const premiereLigne = lignes[0];
  const separateur = premiereLigne.includes(';') ? ';' : (premiereLigne.includes('\t') ? '\t' : ',');
  const colonnesPremiereLigne = premiereLigne.split(separateur).map(c => c.trim().toLowerCase());
  
  // Déterminer s'il y a un en-tête dans le fichier
  const aUnEntete = colonnesPremiereLigne.some(c => 
    c.includes('date') || c.includes('time') || c.includes('open') || c.includes('close') || c.includes('high')
  );

  let indexDate = -1;
  let indexHeure = -1;
  let indexOpen = -1;
  let indexHigh = -1;
  let indexLow = -1;
  let indexClose = -1;
  let formatSansEntete: 'histdata' | 'metatrader' | 'standard' = 'standard';
  let ligneDeDepart = 0;

  if (aUnEntete) {
    console.log(`📡 [CSV Parser] En-tête détecté avec séparateur "${separateur}" :`, colonnesPremiereLigne);
    indexDate = colonnesPremiereLigne.findIndex(c => c.includes('date') || c.includes('time') || c.includes('timestamp') || c.includes('heure'));
    indexOpen = colonnesPremiereLigne.findIndex(c => c === 'open' || c === 'o' || c === 'ouvert' || c === 'ouverture');
    indexHigh = colonnesPremiereLigne.findIndex(c => c === 'high' || c === 'h' || c === 'haut' || c === 'maximum');
    indexLow = colonnesPremiereLigne.findIndex(c => c === 'low' || c === 'l' || c === 'bas' || c === 'minimum');
    indexClose = colonnesPremiereLigne.findIndex(c => c === 'close' || c === 'c' || c === 'cloture' || c === 'fermeture');
    ligneDeDepart = 1;
  } else {
    // Fichier sans en-tête : détection automatique selon les premières colonnes
    console.log(`📡 [CSV Parser] Aucun en-tête détecté. Analyse de la première ligne :`, colonnesPremiereLigne);
    ligneDeDepart = 0;
    
    // Si la colonne 0 est de type date YYYY.MM.DD et la colonne 1 de type heure HH:MM (MetaTrader)
    const estDateMetaTrader = /^\d{4}[\.\-\/]\d{2}[\.\-\/]\d{2}$/.test(colonnesPremiereLigne[0]);
    const estHeureMetaTrader = /^\d{2}:\d{2}(:\d{2})?$/.test(colonnesPremiereLigne[1]);
    
    if (estDateMetaTrader && estHeureMetaTrader) {
      console.log("👉 [CSV Parser] Format sans en-tête identifié : MetaTrader (Date;Heure;O;H;L;C)");
      formatSansEntete = 'metatrader';
      indexDate = 0;
      indexHeure = 1;
      indexOpen = 2;
      indexHigh = 3;
      indexLow = 4;
      indexClose = 5;
    } else {
      // Par défaut, format HistData sans en-tête (DateHeure;O;H;L;C;Volume)
      console.log("👉 [CSV Parser] Format sans en-tête identifié par défaut : HistData (DateHeure;O;H;L;C;Volume)");
      formatSansEntete = 'histdata';
      indexDate = 0;
      indexOpen = 1;
      indexHigh = 2;
      indexLow = 3;
      indexClose = 4;
    }
  }

  // Vérifier qu'on a bien mappé toutes les colonnes requises
  if (indexDate === -1 || indexOpen === -1 || indexHigh === -1 || indexLow === -1 || indexClose === -1) {
    throw new Error(
      "En-tête ou structure CSV non reconnue. Les colonnes requises doivent être identifiables."
    );
  }

  const resultats: Bougie[] = [];

  // 4️⃣ Parcours et parsing des lignes
  for (let i = ligneDeDepart; i < lignes.length; i++) {
    const valeurs = lignes[i].split(separateur).map(v => v.trim());
    if (valeurs.length <= Math.max(indexDate, indexOpen, indexHigh, indexLow, indexClose)) continue;

    try {
      let dateTimestamp: number | string;

      // Parsing de la date selon le format identifié
      if (formatSansEntete === 'histdata') {
        // Format HistData : "YYYYMMDD HHMMSS" (ex: "20180101 170000")
        const dateBrute = valeurs[indexDate];
        if (dateBrute.length >= 15) {
          const annee = dateBrute.substring(0, 4);
          const mois = dateBrute.substring(4, 6);
          const jour = dateBrute.substring(6, 8);
          const heure = dateBrute.substring(9, 11);
          const minute = dateBrute.substring(11, 13);
          const seconde = dateBrute.substring(13, 15);
          
          const dateISO = `${annee}-${mois}-${jour}T${heure}:${minute}:${seconde}Z`;
          dateTimestamp = Math.floor(Date.parse(dateISO) / 1000);
        } else {
          continue;
        }
      } else if (formatSansEntete === 'metatrader') {
        // Format MetaTrader : Date ("YYYY.MM.DD") et Heure ("HH:MM")
        const dateBrute = valeurs[indexDate].replace(/\./g, '-');
        const heureBrute = valeurs[indexHeure];
        const dateISO = `${dateBrute}T${heureBrute}:00Z`;
        dateTimestamp = Math.floor(Date.parse(dateISO) / 1000);
      } else {
        // Format standard avec en-tête
        const dateBrute = valeurs[indexDate];
        const timestampMs = Date.parse(dateBrute);
        if (isNaN(timestampMs)) {
          if (/^\d{4}-\d{2}-\d{2}$/.test(dateBrute)) {
            dateTimestamp = dateBrute;
          } else {
            continue;
          }
        } else {
          dateTimestamp = Math.floor(timestampMs / 1000);
        }
      }

      if (typeof dateTimestamp === 'number' && isNaN(dateTimestamp)) {
        continue;
      }

      // Parsing des prix (gestion des nombres décimaux à virgule française)
      const open = parseFloat(valeurs[indexOpen].replace(',', '.'));
      const high = parseFloat(valeurs[indexHigh].replace(',', '.'));
      const low = parseFloat(valeurs[indexLow].replace(',', '.'));
      const close = parseFloat(valeurs[indexClose].replace(',', '.'));

      if (isNaN(open) || isNaN(high) || isNaN(low) || isNaN(close)) {
        continue;
      }

      resultats.push({
        time: dateTimestamp,
        open,
        high,
        low,
        close
      });
    } catch (err) {
      // Ligne corrompue passée sous silence
    }
  }

  if (resultats.length === 0) {
    throw new Error("Aucune ligne de données valide n'a pu être lue du fichier CSV.");
  }

  // Tri chronologique des bougies
  const bougiesTriees = resultats.sort((a, b) => {
    const tempsA = typeof a.time === 'number' ? a.time : Date.parse(a.time);
    const tempsB = typeof b.time === 'number' ? b.time : Date.parse(b.time);
    return tempsA - tempsB;
  });

  // Élimination des bougies doublons (lightweight-charts l'exige)
  const bougiesFinales: Bougie[] = [];
  const setTempsDetectes = new Set<string | number>();

  for (const b of bougiesTriees) {
    if (!setTempsDetectes.has(b.time)) {
      setTempsDetectes.add(b.time);
      bougiesFinales.push(b);
    }
  }

  console.log(`✅ [CSV Parser] Analyse terminée. ${bougiesFinales.length} bougies prêtes pour le graphique.`);
  return bougiesFinales;
}

/**
 * Agrège des bougies M1 en bougies d'une unité de temps supérieure (ex: 5m, 15m, 1h, 1d)
 */
export function agregerBougies(bougiesM1: Bougie[], timeframeSuperior: string): Bougie[] {
  // 1 minute : pas d'agrégation nécessaire
  if (timeframeSuperior === '1m' || timeframeSuperior === 'M1') {
    return bougiesM1;
  }

  console.log(`⏱️ [MTF Aggregator] Agrégation de ${bougiesM1.length} bougies M1 en format ${timeframeSuperior}...`);

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

  const groupes = new Map<number, Bougie[]>();

  // Regrouper les bougies M1 par intervalle de temps
  for (const b of bougiesM1) {
    const timestampSec = typeof b.time === 'number' ? b.time : Math.floor(Date.parse(b.time as string) / 1000);
    if (isNaN(timestampSec)) continue;

    const bucketStart = getBucketStart(timestampSec);

    if (!groupes.has(bucketStart)) {
      groupes.set(bucketStart, []);
    }
    groupes.get(bucketStart)!.push({
      ...b,
      time: timestampSec
    });
  }

  const resultats: Bougie[] = [];

  // Agrégation de chaque bucket
  for (const [bucketTime, listeM1] of groupes.entries()) {
    listeM1.sort((a, b) => (a.time as number) - (b.time as number));

    const open = listeM1[0].open;
    const close = listeM1[listeM1.length - 1].close;
    const high = Math.max(...listeM1.map(b => b.high));
    const low = Math.min(...listeM1.map(b => b.low));

    resultats.push({
      time: bucketTime,
      open,
      high,
      low,
      close
    });
  }

  const finalAggregated = resultats.sort((a, b) => (a.time as number) - (b.time as number));
  console.log(`✅ [MTF Aggregator] Agrégation terminée. ${finalAggregated.length} bougies ${timeframeSuperior} générées.`);
  return finalAggregated;
}
