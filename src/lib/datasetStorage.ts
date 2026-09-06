import { get, set } from 'idb-keyval';
import type { EchantillonIA, BoundingBoxYOLO } from '@/types/dataset';

// Clé unique pour stocker la liste des échantillons dans IndexedDB
const CLE_STORAGE_DATASET = 'ai_dataset_samples_v1';

/**
 * Récupère tous les échantillons IA stockés en local dans IndexedDB.
 * 
 * Exemple :
 * const echantillons = await recupererTousLesEchantillons();
 * console.log(`Nombre d'échantillons: ${echantillons.length}`);
 */
export async function recupererTousLesEchantillons(): Promise<EchantillonIA[]> {
  try {
    const data = await get<EchantillonIA[]>(CLE_STORAGE_DATASET);
    return data || [];
  } catch (erreur) {
    console.error('❌ [datasetStorage] Erreur de lecture IndexedDB:', erreur);
    return [];
  }
}

/**
 * Enregistre ou met à jour un échantillon dans IndexedDB.
 * 
 * Exemple :
 * await sauvegarderEchantillon(nouvelEchantillon);
 */
export async function sauvegarderEchantillon(echantillon: EchantillonIA): Promise<void> {
  try {
    const existants = await recupererTousLesEchantillons();
    // Met à jour s'il existe déjà, sinon l'ajoute en tête de liste
    const index = existants.findIndex((item) => item.id === echantillon.id);
    let listeMisAJour: EchantillonIA[];
    
    if (index >= 0) {
      listeMisAJour = [...existants];
      listeMisAJour[index] = echantillon;
    } else {
      listeMisAJour = [echantillon, ...existants];
    }
    
    await set(CLE_STORAGE_DATASET, listeMisAJour);
    console.log('✅ [datasetStorage] Échantillon sauvegardé avec succès:', echantillon.id);
  } catch (erreur) {
    console.error('❌ [datasetStorage] Erreur de sauvegarde IndexedDB:', erreur);
    throw erreur;
  }
}

/**
 * Supprime un échantillon par son identifiant unique.
 * 
 * Exemple :
 * await supprimerEchantillon('123e4567-e89b-12d3-a456-426614174000');
 */
export async function supprimerEchantillon(id: string): Promise<void> {
  try {
    const existants = await recupererTousLesEchantillons();
    const filtre = existants.filter((item) => item.id !== id);
    await set(CLE_STORAGE_DATASET, filtre);
    console.log('🗑️ [datasetStorage] Échantillon supprimé:', id);
  } catch (erreur) {
    console.error('❌ [datasetStorage] Erreur de suppression IndexedDB:', erreur);
    throw erreur;
  }
}

/**
 * Efface tous les échantillons du dataset (remise à zéro).
 */
export async function effacerToutLeDataset(): Promise<void> {
  try {
    await set(CLE_STORAGE_DATASET, []);
    console.log('🧹 [datasetStorage] Dataset entièrement vidé.');
  } catch (erreur) {
    console.error('❌ [datasetStorage] Erreur vidage dataset:', erreur);
    throw erreur;
  }
}

/**
 * Formate une boîte englobante au format texte standard YOLO.
 * Format YOLO : <classe_id> <x_centre> <y_centre> <largeur> <hauteur> (valeurs normalisées entre 0 et 1).
 * 
 * Exemple :
 * const ligne = formaterLigneYOLO(boite); // "0 0.523000 0.412000 0.085000 0.142000"
 */
export function formaterLigneYOLO(boite: BoundingBoxYOLO): string {
  // Limite strictement les coordonnées entre 0.0 et 1.0 pour éviter toute erreur de parsing YOLO
  const clamp = (val: number) => Math.max(0, Math.min(1, val));
  
  const x = clamp(boite.xCentre).toFixed(6);
  const y = clamp(boite.yCentre).toFixed(6);
  const w = clamp(boite.largeur).toFixed(6);
  const h = clamp(boite.hauteur).toFixed(6);
  
  return `${boite.classeId} ${x} ${y} ${w} ${h}`;
}

/**
 * Extrait les données binaires base64 pour JSZip en supprimant le préfixe data:image/...;base64,
 */
function extraireBase64Pur(dataUrl: string): string {
  const virguleIndex = dataUrl.indexOf(',');
  if (virguleIndex !== -1) {
    return dataUrl.slice(virguleIndex + 1);
  }
  return dataUrl;
}

/**
 * Génère une archive .ZIP complète prête pour l'entraînement (YOLO / PyTorch / Colab).
 * 
 * Arborescence générée dans le ZIP :
 *  dataset/
 *    images/ (images clean au format JPEG)
 *    labels/ (annotations .txt au format YOLO)
 *    annotated/ (images de vérification visuelle)
 *    metadata.json (données complètes au format JSON)
 *    dataset.yaml (fichier de configuration YOLO standard)
 * 
 * Exemple :
 * const zipBlob = await exporterDatasetEnZip(mesEchantillons);
 * telechargerBlob(zipBlob, 'dataset_ia_trading.zip');
 */
export async function exporterDatasetEnZip(echantillons: EchantillonIA[]): Promise<Blob> {
  // Import dynamique de JSZip pour ne pas alourdir le bundle principal au démarrage
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  
  const racine = zip.folder('dataset');
  if (!racine) throw new Error('Impossible de créer le dossier racine dans le ZIP');
  
  const dossierImages = racine.folder('images');
  const dossierLabels = racine.folder('labels');
  const dossierAnnotated = racine.folder('annotated');
  
  // 1️⃣ Ajout de chaque échantillon dans les dossiers images et labels
  echantillons.forEach((echantillon, index) => {
    // Nommage ordonné et descriptif : sample_001_EURUSD_M5_pos
    const num = String(index + 1).padStart(4, '0');
    const prefixeType = echantillon.typeEchantillon === 'positif' ? 'pos' : 'neg';
    const nomFichierBase = `sample_${num}_${echantillon.paire}_${echantillon.timeframe}_${prefixeType}`;
    
    // Image Clean (utilisée pour l'IA)
    if (dossierImages && echantillon.imageCleanBase64) {
      const base64Clean = extraireBase64Pur(echantillon.imageCleanBase64);
      dossierImages.file(`${nomFichierBase}.jpg`, base64Clean, { base64: true });
    }
    
    // Image Annotée (pour le contrôle visuel humain)
    if (dossierAnnotated && echantillon.imageAnnotatedBase64) {
      const base64Annotated = extraireBase64Pur(echantillon.imageAnnotatedBase64);
      dossierAnnotated.file(`${nomFichierBase}_annotated.jpg`, base64Annotated, { base64: true });
    }
    
    // Fichier d'annotations YOLO (.txt)
    if (dossierLabels) {
      let contenuLabels = '';
      if (echantillon.typeEchantillon === 'positif' && echantillon.boundingBoxes.length > 0) {
        contenuLabels = echantillon.boundingBoxes.map(formaterLigneYOLO).join('\n');
      }
      // Pour les échantillons négatifs, le fichier .txt reste vide (convention standard YOLO)
      dossierLabels.file(`${nomFichierBase}.txt`, contenuLabels);
    }
  });
  
  // 2️⃣ Fichier metadata.json récapitulatif
  const metadataClean = echantillons.map((e) => ({
    id: e.id,
    dateCreation: e.dateCreation,
    paire: e.paire,
    timeframe: e.timeframe,
    typeEchantillon: e.typeEchantillon,
    direction: e.direction,
    nbBougies: e.nbBougies,
    prixEntree: e.prixEntree,
    stopLoss: e.stopLoss,
    takeProfit: e.takeProfit,
    ratioRR: e.ratioRR,
    resultatTrade: e.resultatTrade,
    sessionTrading: e.sessionTrading,
    scoreMacro: e.scoreMacro,
    boundingBoxes: e.boundingBoxes,
  }));
  racine.file('metadata.json', JSON.stringify(metadataClean, null, 2));
  
  // 3️⃣ Fichier dataset.yaml prêt pour YOLOv8 / YOLO11
  const contenuYaml = `# Configuration Dataset IA générée par TradeLog
path: ./dataset
train: images
val: images

# Classes d'objets
names:
  0: long
  1: short
  2: poi
`;
  racine.file('dataset.yaml', contenuYaml);
  
  // 4️⃣ Génération du blob ZIP final
  return await zip.generateAsync({ type: 'blob' });
}

/**
 * Télécharge un fichier Blob dans le navigateur.
 */
export function telechargerBlobDansNavigateur(blob: Blob, nomFichier: string): void {
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  document.body.removeChild(lien);
  URL.revokeObjectURL(url);
}
