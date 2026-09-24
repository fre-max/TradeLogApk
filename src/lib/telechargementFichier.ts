import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/**
 * Sauvegarde ou exporte un fichier de manière universelle :
 * - Sur Android / Tablette (APK natif) : Écrit le fichier sur l'appareil et ouvre
 *   la boîte de dialogue native Android pour enregistrer dans les Téléchargements ou partager.
 * - Sur Navigateur Web (PC) : Déclenche le téléchargement automatique classique.
 * 
 * Exemple :
 * await exporterEtTelechargerFichier('trades.csv', contenuCsv, 'text/csv;charset=utf-8;');
 */
export async function exporterEtTelechargerFichier(
  nomFichier: string,
  contenuTexte: string,
  typeMime: string = 'text/plain;charset=utf-8;'
): Promise<{ succes: boolean; message: string }> {
  // 1️⃣ Cas Mobile Natif (Android / APK / Tablette)
  if (Capacitor.isNativePlatform()) {
    try {
      console.log(`📱 [Export Mobile] Enregistrement natif du fichier '${nomFichier}'...`);

      // Écriture dans le cache accessible par le système de partage
      const ecritureResult = await Filesystem.writeFile({
        path: nomFichier,
        data: contenuTexte,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      });

      // Tentative supplémentaire d'écriture dans le dossier Documents public de l'appareil
      try {
        await Filesystem.writeFile({
          path: nomFichier,
          data: contenuTexte,
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
        });
        console.log(`✅ [Export Mobile] Copie enregistrée dans le dossier Documents.`);
      } catch (errDocs) {
        console.warn(`⚠️ [Export Mobile] Impossible d'écrire directement dans Documents:`, errDocs);
      }

      // Récupération de l'URI du fichier
      const fileUri = await Filesystem.getUri({
        path: nomFichier,
        directory: Directory.Cache,
      });

      // Ouverture de la boîte de dialogue native Android (Enregistrer dans Fichiers, Drive, Telegram, etc.)
      const canShare = await Share.canShare();
      if (canShare.value) {
        await Share.share({
          title: nomFichier,
          text: `Fichier exporté depuis TradeLog : ${nomFichier}`,
          url: fileUri.uri,
          dialogTitle: 'Enregistrer ou partager le fichier',
        });
        return {
          succes: true,
          message: `Fichier prêt ! Choisissez 'Enregistrer' ou l'application de votre choix.`,
        };
      } else {
        return {
          succes: true,
          message: `Fichier enregistré dans les documents de l'appareil (${fileUri.uri}).`,
        };
      }
    } catch (erreurMobile: any) {
      console.error(`❌ [Export Mobile] Erreur lors de l'enregistrement mobile:`, erreurMobile);
      // Tentative de repli web même sur mobile si possible
      declencherTelechargementWeb(nomFichier, contenuTexte, typeMime);
      return {
        succes: true,
        message: `Fichier généré. Vérifiez votre dossier Téléchargements.`,
      };
    }
  }

  // 2️⃣ Cas Navigateur Web (PC / Mac)
  try {
    declencherTelechargementWeb(nomFichier, contenuTexte, typeMime);
    return {
      succes: true,
      message: `Fichier téléchargé dans votre dossier Téléchargements.`,
    };
  } catch (erreurWeb: any) {
    console.error(`❌ [Export Web] Erreur lors du téléchargement web:`, erreurWeb);
    return {
      succes: false,
      message: `Erreur lors de la génération du fichier.`,
    };
  }
}

/**
 * Déclenche le téléchargement standard via le navigateur web.
 */
function declencherTelechargementWeb(nomFichier: string, contenu: string, typeMime: string): void {
  const blob = new Blob([contenu], { type: typeMime });
  const urlBlob = URL.createObjectURL(blob);
  const lien = document.createElement('a');

  lien.href = urlBlob;
  lien.download = nomFichier;
  if (lien.style) {
    lien.style.display = 'none';
  }

  document.body.appendChild(lien);
  lien.click();

  // Nettoyage après un court délai
  setTimeout(() => {
    document.body.removeChild(lien);
    URL.revokeObjectURL(urlBlob);
  }, 100);
}
