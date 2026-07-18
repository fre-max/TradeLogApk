import { GoogleGenAI } from 'npm:@google/genai'
import { getGeminiVisionModel, SMC_ANALYSIS_PROMPT } from './utils.ts'

const MAX_GEMINI_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 20_000;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function isGeminiQuotaError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status
    if (status === 429) return true
  }

  const message = error instanceof Error ? error.message : String(error)
  return (
    message.includes('429') ||
    message.includes('Quota exceeded') ||
    message.includes('Too Many Requests') ||
    message.includes('RESOURCE_EXHAUSTED')
  )
}

/** Extrait le délai suggéré par l'API ("Please retry in 19.2s") ou utilise 20 s par défaut. */
export function parseGeminiRetryDelayMs(error: unknown): number {
  const message = error instanceof Error ? error.message : String(error)
  const match = message.match(/retry in (\d+(?:\.\d+)?)\s*s/i)
  if (match) {
    return Math.ceil(parseFloat(match[1]) * 1000) + 1_000
  }
  return DEFAULT_RETRY_DELAY_MS
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function generateContentWithRetry(
  ai: GoogleGenAI,
  inlineData: { data: string; mimeType: string },
  prompt: string
) {
  const contents = [
    { inlineData },
    { text: prompt }
  ]

  let lastError: unknown

  for (let attempt = 1; attempt <= MAX_GEMINI_RETRIES; attempt++) {
    try {
      return await ai.models.generateContent({
        model: getGeminiVisionModel(),
        contents: contents,
      })
    } catch (error) {
      lastError = error

      if (!isGeminiQuotaError(error) || attempt === MAX_GEMINI_RETRIES) {
        throw error
      }

      // Sur Supabase Edge, on a un timeout très large, on peut se permettre de prendre le délai recommandé
      const delayMs = parseGeminiRetryDelayMs(error)
      console.warn(
        `⚠️ [Gemini] Quota / rate limit (429) — tentative ${attempt}/${MAX_GEMINI_RETRIES}, attente ${Math.round(delayMs / 1000)}s`
      )
      await sleep(delayMs)
    }
  }

  throw lastError
}

/**
 * Télécharge, compresse et analyse une capture TradingView via Gemini Vision.
 * Gère automatiquement les retries en cas de 429 (Free Tier).
 */
export async function analyserImageUrlAvecGemini(
  ai: GoogleGenAI,
  imageUrl: string,
  prompt: string = SMC_ANALYSIS_PROMPT
): Promise<Record<string, unknown>> {
  const imageRes = await fetch(imageUrl)
  if (!imageRes.ok) {
    throw new Error(`Échec du téléchargement de l'image (${imageRes.status})`)
  }

  const arrayBuffer = await imageRes.arrayBuffer()
  
  let contentType = imageRes.headers.get('content-type') || 'image/jpeg'
  // Les serveurs comme Telegram renvoient souvent "application/octet-stream", ce qui fait échouer Gemini.
  // On déduit donc le bon type MIME à partir de l'extension de l'URL pour que Gemini puisse le décoder.
  if (contentType === 'application/octet-stream' || !contentType.startsWith('image/')) {
    const extension = imageUrl.split('.').pop()?.split('?')[0]?.toLowerCase()
    if (extension === 'png') {
      contentType = 'image/png'
    } else if (extension === 'webp') {
      contentType = 'image/webp'
    } else if (extension === 'heic') {
      contentType = 'image/heic'
    } else if (extension === 'heif') {
      contentType = 'image/heif'
    } else {
      contentType = 'image/jpeg'
    }
  }
  
  console.log(`🖼️ [Gemini] Image brute téléchargée : ${arrayBuffer.byteLength} octets, Type MIME configuré : ${contentType}`)
  const base64 = arrayBufferToBase64(arrayBuffer)

  const result = await generateContentWithRetry(ai, { data: base64, mimeType: contentType }, prompt)

  const responseText = result.text
  const jsonMatch = responseText?.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error("Gemini n'a pas retourné de JSON valide")
  }

  return JSON.parse(jsonMatch[0]) as Record<string, unknown>
}

/** Message utilisateur clair quand le Free Tier est saturé. */
export function messageErreurQuotaGemini(error: unknown): string {
  const delaySec = Math.round(parseGeminiRetryDelayMs(error) / 1000)
  return (
    `Quota Gemini Free Tier atteint. Patiente ~${delaySec}s puis réessaie. ` +
    'Astuce : envoie des captures plus petites ou espacées dans le temps.'
  )
}
