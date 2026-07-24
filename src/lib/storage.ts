import { supabase } from './supabase'

const BUCKET = 'trade-images'

/**
 * Compresse une image côté client (format JPEG, max 1600px, qualité 80 %)
 * pour réduire la taille des fichiers de ~90% sans perdre en lisibilité.
 * 
 * Exemple :
 * const blobCompresse = await compresserImage(monFichierImage);
 */
export async function compresserImage(fileOrBlob: File | Blob, maxWidth = 1200, maxQuality = 0.7): Promise<Blob> {
  // Ignorer la compression si ce n'est pas une image ou si c'est un format animé/vectoriel
  if (!fileOrBlob.type.startsWith('image/') || fileOrBlob.type === 'image/svg+xml' || fileOrBlob.type === 'image/gif') {
    return fileOrBlob
  }

  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        let width = img.width
        let height = img.height

        // Calcul des dimensions en préservant le ratio d'aspect
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width)
            width = maxWidth
          }
        } else {
          if (height > maxWidth) {
            width = Math.round((width * maxWidth) / height)
            height = maxWidth
          }
        }

        // Création du canvas pour le redimensionnement
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          console.warn('⚠️ [Storage] Canvas 2D non supporté, envoi du fichier original')
          resolve(fileOrBlob)
          return
        }

        ctx.drawImage(img, 0, 0, width, height)

        // Compression JPEG optimisée pour la légèreté
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob)
            } else {
              resolve(fileOrBlob)
            }
          },
          'image/jpeg',
          maxQuality
        )
      }
      img.onerror = () => resolve(fileOrBlob)
      img.src = event.target?.result as string
    }
    reader.onerror = () => resolve(fileOrBlob)
    reader.readAsDataURL(fileOrBlob)
  })
}

/**
 * Convertit un File/Blob en chaîne Base64 (Data URL)
 */
export async function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = error => reject(error)
    reader.readAsDataURL(file)
  })
}

/**
 * Compresse une image/capture d'écran et la retourne rapidement en Base64 léger (~80-150ko)
 * 
 * Exemple :
 * const base64 = await compresserEtConvertirEnBase64(blob);
 */
export async function compresserEtConvertirEnBase64(file: File | Blob): Promise<string> {
  try {
    // 1. Compression rapide (1000px max, qualité 0.65) idéale pour les captures de graphiques
    const compressedBlob = await compresserImage(file, 1000, 0.65)
    return await fileToBase64(compressedBlob)
  } catch (err) {
    console.error('❌ [Storage] Échec compression, conversion base64 directe :', err)
    return await fileToBase64(file)
  }
}

/**
 * Reconvertit une Data URL (Base64) en Blob pour l'upload Supabase
 */
export function base64ToBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(',')
  const mimeMatch = arr[0].match(/:(.*?);/)
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg'
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new Blob([u8arr], { type: mime })
}

export async function uploadImage(
  file: File | Blob,
  path: string
): Promise<string> {
  console.log('🚀 [Storage] Début upload image, taille originale :', file.size, 'octets')

  let fichierAEnvoyer = file
  try {
    fichierAEnvoyer = await compresserImage(file)
    console.log('✅ [Storage] Image compressée avec succès, nouvelle taille :', fichierAEnvoyer.size, 'octets')
  } catch (err) {
    console.error('❌ [Storage] Échec de la compression client, envoi du fichier brut :', err)
  }

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, fichierAEnvoyer, { upsert: true })

  if (error) throw error

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function deleteImage(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw error
}

export function buildImagePath(tradeId: string, stepId: string, filename: string): string {
  return `${tradeId}/${stepId}/${filename}`
}
