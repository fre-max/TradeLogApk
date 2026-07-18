import { GoogleGenAI } from 'npm:@google/genai'
import { analyserImageUrlAvecGemini, isGeminiQuotaError, messageErreurQuotaGemini } from '../_shared/gemini.ts'
import { jsonResponse, corsHeaders, SMC_CLOSE_ANALYSIS_PROMPT } from '../_shared/utils.ts'

const apiKey = Deno.env.get('GEMINI_API_KEY')
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return jsonResponse({ error: 'Méthode non autorisée' }, 405)
  }

  if (!ai) {
    return jsonResponse({ error: 'Clé API Gemini non configurée sur le serveur' }, 500)
  }

  let imageUrl = ''
  let mode = 'setup'
  let direction = 'long'
  let entry_price: number | null = null
  let sl: number | null = null
  let tp: number | null = null
  let stats: any = null

  if (req.method === 'POST') {
    try {
      const body = await req.json()
      imageUrl = body.url
      mode = body.mode || 'setup'
      direction = body.direction || 'long'
      entry_price = body.entry_price || null
      sl = body.sl || null
      tp = body.tp || null
      stats = body.stats || null
    } catch (e) {
      return jsonResponse({ error: 'Payload JSON invalide' }, 400)
    }
  } else {
    // Mode GET
    const urlParams = new URL(req.url).searchParams
    imageUrl = urlParams.get('url') || ''
    mode = urlParams.get('mode') || 'setup'
  }

  if (mode !== 'coaching' && !imageUrl) {
    return jsonResponse({ error: "URL de l'image manquante" }, 400)
  }

  try {
    let prompt: string | undefined
    
    if (mode === 'coaching') {
      console.log('🧠 [Analyze Edge Function] Mode Coaching : génération du plan d action avec Gemini...')
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          { text: `Tu es un coach de trading SMC professionnel et psychologue. Voici mes statistiques de performance basées sur mon journal de trading :
${JSON.stringify(stats, null, 2)}

Rédige-moi un plan d'action personnalisé, constructif et motivant en 3-4 points clés en français pour optimiser mon trading, corriger mes faiblesses émotionnelles ou techniques, et renforcer mes forces. Formatage sous forme de Markdown propre et agréable à lire.` }
        ]
      })
      return jsonResponse({ analysis: response.text })
    }

    if (mode === 'close') {
      console.log('🧠 [Analyze Edge Function] Mode Clôture : comparaison des prix avec Gemini...')
      prompt = SMC_CLOSE_ANALYSIS_PROMPT
        .replace('{direction}', direction)
        .replace('{entry_price}', entry_price != null ? String(entry_price) : '—')
        .replace('{sl}', sl != null ? String(sl) : '—')
        .replace('{tp}', tp != null ? String(tp) : '—')
    }

    const data = await analyserImageUrlAvecGemini(ai, imageUrl, prompt)
    return jsonResponse(data)
  } catch (error: unknown) {
    if (isGeminiQuotaError(error)) {
      console.error('❌ [Analyze API] Quota Gemini Free Tier :', error)
      return jsonResponse({ error: messageErreurQuotaGemini(error) }, 429)
    }
    const message = error instanceof Error ? error.message : "Erreur interne lors de l'analyse de l'image"
    console.error("❌ [Analyze API] Erreur d'analyse :", error)
    return jsonResponse({ error: message }, 500)
  }
})
