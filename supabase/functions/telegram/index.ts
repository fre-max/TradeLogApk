import { createClient } from 'npm:@supabase/supabase-js@2.48.1'
import { GoogleGenAI } from 'npm:@google/genai'
import { analyserImageUrlAvecGemini, isGeminiQuotaError, messageErreurQuotaGemini } from '../_shared/gemini.ts'
import { getGeminiVisionModel, jsonResponse, corsHeaders } from '../_shared/utils.ts'

const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
const ai = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL') ?? Deno.env.get('SUPABASE_URL')
const supabaseAnonKey = Deno.env.get('VITE_SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')

interface TelegramFile {
  file_id: string
}

interface TelegramDocument {
  file_id: string
  mime_type?: string
  file_name?: string
}

interface TelegramMessage {
  message_id: number
  date: number
  photo?: TelegramFile[]
  document?: TelegramDocument
  caption?: string
}

// Représente une structure simplifiée et unifiée contenant uniquement ce dont on a besoin pour l'image
interface MessageImageValide {
  message_id: number
  date: number
  file_id: string
  caption?: string
}

interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
  edited_message?: TelegramMessage
  channel_post?: TelegramMessage
  edited_channel_post?: TelegramMessage
}

interface TelegramResponse {
  ok: boolean
  result: TelegramUpdate[]
}

interface TelegramFileResponse {
  ok: boolean
  result: { file_path: string }
}

interface WebhookInfoResponse {
  ok: boolean
  result: { url?: string }
}

// Vérifie si un webhook est déjà actif sur le bot
async function verifierWebhook(token: string): Promise<string | null> {
  const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)
  const data: WebhookInfoResponse = await res.json()
  return data.result?.url || null
}

/**
 * Récupère le dernier message contenant une image (photo classique ou document de type image)
 * sur le bot Telegram en inspectant tous les types d'updates disponibles.
 * 
 * Exemple d'utilisation :
 * const { message, maxUpdateId } = await getDernierMessagePhoto(token);
 * if (message) {
 *   console.log('Image récupérée avec le file_id :', message.file_id);
 * }
 */
async function getDernierMessagePhoto(token: string): Promise<{
  message: MessageImageValide | null
  maxUpdateId: number
}> {
  const webhookUrl = await verifierWebhook(token)
  if (webhookUrl) {
    throw new Error(
      'Un webhook Telegram est actif sur ce bot. Ouvrez https://api.telegram.org/bot<VOTRE_TOKEN>/deleteWebhook dans le navigateur pour activer le Quick Entry.'
    )
  }

  // On demande les messages, les messages édités, les posts de canaux et les posts de canaux édités
  const allowedUpdates = JSON.stringify(["message", "edited_message", "channel_post", "edited_channel_post"])
  const updatesRes = await fetch(
    `https://api.telegram.org/bot${token}/getUpdates?limit=100&allowed_updates=${encodeURIComponent(allowedUpdates)}`
  )
  const updates: TelegramResponse = await updatesRes.json()

  if (!updates.ok || !updates.result?.length) {
    return { message: null, maxUpdateId: 0 }
  }

  let dernierMessageImage: MessageImageValide | null = null
  let maxUpdateId = 0

  for (const update of updates.result) {
    maxUpdateId = Math.max(maxUpdateId, update.update_id)
    
    // On extrait le message de n'importe quel canal d'update Telegram possible
    const msg = update.message || update.channel_post || update.edited_message || update.edited_channel_post
    if (!msg) continue

    let fileId: string | null = null

    // Cas 1 : C'est une photo Telegram standard compressée
    if (msg.photo && msg.photo.length > 0) {
      // On prend la version de la photo ayant la plus haute résolution (la dernière du tableau)
      fileId = msg.photo[msg.photo.length - 1].file_id
    }
    // Cas 2 : C'est un document (ex: image envoyée sans compression comme fichier)
    else if (msg.document) {
      const mimeType = msg.document.mime_type || ''
      const fileName = msg.document.file_name || ''
      const estUneImage = mimeType.startsWith('image/') || /\.(png|jpe?g|webp|gif|heic|heif)$/i.test(fileName)
      
      if (estUneImage) {
        fileId = msg.document.file_id
      }
    }

    if (!fileId) continue

    // getUpdates retournant les éléments dans l'ordre chronologique (par update_id croissant),
    // le dernier message contenant une image qu'on rencontre dans cette boucle est forcément le plus récent.
    dernierMessageImage = {
      message_id: msg.message_id,
      date: msg.date,
      file_id: fileId,
      caption: msg.caption,
    }
  }

  return { message: dernierMessageImage, maxUpdateId }
}

async function acquitterUpdates(token: string, maxUpdateId: number): Promise<void> {
  if (maxUpdateId > 0) {
    await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=${maxUpdateId + 1}`)
  }
}

interface TelegramBotInfo {
  id: number
  username: string
  first_name: string
}

interface TelegramMeResponse {
  ok: boolean
  result: TelegramBotInfo
}

async function testerConnexionBot(token: string): Promise<Response> {
  const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`)
  const meData: TelegramMeResponse = await meRes.json()

  if (!meData.ok) {
    return jsonResponse({ mode: 'ping', ok: false, error: 'Token Telegram invalide' }, 401)
  }

  const webhookUrl = await verifierWebhook(token)

  const updatesRes = await fetch(
    `https://api.telegram.org/bot${token}/getUpdates?limit=100&allowed_updates=${encodeURIComponent('["message"]')}`
  )
  const updates: TelegramResponse = await updatesRes.json()

  const pendingUpdates = updates.result?.length ?? 0
  let pendingPhotos = 0
  for (const update of updates.result ?? []) {
    if (update.message?.photo?.length) pendingPhotos++
  }

  return jsonResponse({
    mode: 'ping',
    ok: true,
    bot: {
      id: meData.result.id,
      username: meData.result.username,
      name: meData.result.first_name,
    },
    webhook: {
      active: Boolean(webhookUrl),
      url: webhookUrl,
    },
    queue: {
      pendingUpdates,
      pendingPhotos,
    },
    gemini: {
      configured: Boolean(ai),
      model: getGeminiVisionModel(),
    },
  })
}

async function analyserImageAvecGemini(imageUrl: string): Promise<Record<string, unknown>> {
  if (!ai) {
    throw new Error('Clé API Gemini non configurée sur le serveur')
  }
  return analyserImageUrlAvecGemini(ai, imageUrl)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Le client frontend React-Query fait parfois des requêtes POST via Supabase invoke
  // mais notre code fetch dans react envoyait du GET. Supabase .invoke() utilise POST par défaut.
  // On autorise POST et GET.
  if (req.method !== 'GET' && req.method !== 'POST') {
    return jsonResponse({ error: 'Méthode non autorisée' }, 405)
  }

  const token = Deno.env.get('TELEGRAM_BOT_TOKEN')
  if (!token) {
    return jsonResponse({ error: 'Token du bot Telegram non configuré' }, 500)
  }

  const url = new URL(req.url)
  // Support pour GET ?ping=1 mais aussi pour le payload body POST pour Supabase invoke
  let isPing = url.searchParams.get('ping') === '1' || url.searchParams.get('test') === '1'
  let stepIdFromParam = url.searchParams.get('step_id')
  let proxyImageUrl = url.searchParams.get('proxy_image_url')
  // Le mode est désormais transmis par le frontend selon le bouton pressé :
  // - 'quick' → bouton flottant "Bot Telegram" ou "+ Nouveau" : analyse Gemini + création du trade
  // - 'standard' → bouton dans le formulaire d'étape : import d'image simple, sans analyse
  let modeFromClient: 'quick' | 'standard' = 'quick'

  if (req.method === 'POST') {
    try {
      const body = await req.json()
      if (body.ping || body.test) isPing = true
      if (body.step_id) stepIdFromParam = body.step_id
      if (body.proxy_image_url) proxyImageUrl = body.proxy_image_url
      // On récupère le mode envoyé par le frontend, avec 'quick' comme valeur par défaut
      if (body.mode === 'standard') modeFromClient = 'standard'
    } catch (e) {
      // Body vide ou pas du JSON, on ignore
    }
  }

  // --- Proxy d'image pour éviter les erreurs CORS côté client ---
  if (proxyImageUrl) {
    try {
      const proxyRes = await fetch(proxyImageUrl)
      if (!proxyRes.ok) throw new Error('Erreur proxy')
      
      let contentType = proxyRes.headers.get('content-type') || 'image/jpeg'
      // Afin d'aider le navigateur à afficher l'image correctement au lieu de la télécharger,
      // on remplace le type "application/octet-stream" de Telegram par le bon type MIME image.
      if (contentType === 'application/octet-stream' || !contentType.startsWith('image/')) {
        const extension = proxyImageUrl.split('.').pop()?.split('?')[0]?.toLowerCase()
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

      return new Response(proxyRes.body, {
        headers: {
          ...corsHeaders,
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*'
        }
      })
    } catch (e) {
      return jsonResponse({ error: "Impossible de proxyfier l'image" }, 500)
    }
  }

  if (isPing) {
    return testerConnexionBot(token)
  }

  try {
    console.log('📡 [Telegram API] Récupération du dernier message Telegram...')

    const { message, maxUpdateId } = await getDernierMessagePhoto(token)
    if (!message) {
      console.log('❌ [Telegram API] Aucune image récente trouvée dans le bot')
      await acquitterUpdates(token, maxUpdateId)
      return jsonResponse({
        error: "Aucune image en attente. Envoie d'abord une capture dans le canal Telegram, puis clique à nouveau sur le bouton.",
      }, 422)
    }

    const fileRes = await fetch(
      `https://api.telegram.org/bot${token}/getFile?file_id=${message.file_id}`
    )
    const fileData: TelegramFileResponse = await fileRes.json()

    if (!fileData.ok || !fileData.result?.file_path) {
      throw new Error('Impossible de récupérer le fichier Telegram')
    }

    const fileUrl = `https://api.telegram.org/file/bot${token}/${fileData.result.file_path}`
    console.log(`✅ [Telegram API] Image trouvée. Mode demandé par le client : ${modeFromClient}`)

    // Mode 'quick' : demandé par le bouton flottant ou "+ Nouveau"
    // L'image est analysée par Gemini et le trade est créé directement en base de données
    if (modeFromClient === 'quick') {
      console.log('🚀 [Telegram API] Mode Quick Entry : analyse Gemini + création du trade')
      const analysisData = await analyserImageAvecGemini(fileUrl)

      const authHeader = req.headers.get('authorization')
      if (!authHeader || !supabaseUrl || !supabaseAnonKey) {
        console.log("⚠️ [Telegram API] Pas d'en-tête d'autorisation, renvoi des données pour création client")
        await acquitterUpdates(token, maxUpdateId)
        return jsonResponse({
          mode: 'quick_fallback',
          fileUrl,
          analysis: analysisData,
          date: message.date,
        })
      }

      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      })

      const { data: { user }, error: userError } = await (supabase.auth as any).getUser()
      if (userError || !user) {
        throw new Error('JWT invalide ou utilisateur non authentifié côté Supabase')
      }

      const analysis = analysisData as any
      const autoExitType = analysis.result === 'win' ? 'tp' : (analysis.result === 'loss' ? 'sl' : (analysis.result === 'breakeven' ? 'breakeven' : null))
      
      const tradeData = {
        user_id: user.id,
        pair: analysis.pair || 'XAUUSD',
        direction: (analysis.direction || 'long') as 'long' | 'short',
        session: analysis.session || 'London',
        date_backtested: analysis.date_backtested || new Date().toISOString().split('T')[0],
        entry_time: analysis.entry_time || null,
        exit_time: analysis.exit_time || null,
        result: analysis.result || null,
        rr_planned: analysis.rr ? parseFloat(String(analysis.rr)) : null,
        rr_realized: analysis.rr_realized ? parseFloat(String(analysis.rr_realized)) : null,
        exit_type: autoExitType,
        emotion: null,
        status: 'quick' as const,
      }

      const { data: insertedTrade, error: tradeInsertError } = await supabase
        .from('trades')
        .insert(tradeData)
        .select()
        .single()

      if (tradeInsertError || !insertedTrade) {
        throw tradeInsertError || new Error('Erreur lors de la création du trade')
      }

      const stepData = {
        trade_id: insertedTrade.id,
        order: 0,
        type: 'biais',
        title: 'Quick Entry — IA',
        timeframe: analysis.timeframe || null,
        notes: analysis.patterns?.length
            ? `Patterns SMC identifiés : ${analysis.patterns.join(', ')}`
            : null,
        fields: {
          is_quick_entry: true,
          extracted: analysis,
          entry_price: analysis.entry_price,
          sl: analysis.sl,
          tp: analysis.tp,
          rr: analysis.rr,
          rr_realized: analysis.rr_realized,
          exit_time: analysis.exit_time,
          patterns: analysis.patterns,
          confidence: analysis.confidence,
        },
      }

      const { data: insertedStep, error: stepInsertError } = await supabase
        .from('steps')
        .insert(stepData)
        .select()
        .single()

      if (stepInsertError || !insertedStep) {
        throw stepInsertError || new Error("Erreur lors de la création de l'étape générale")
      }

      const { error: imageInsertError } = await supabase
        .from('step_images')
        .insert({
          step_id: insertedStep.id,
          source: 'telegram',
          url: fileUrl,
        })

      if (imageInsertError) {
        console.error("❌ [Telegram API] Erreur lors de l'enregistrement de l'image :", imageInsertError)
      }

      console.log('✅ [Telegram API] Trade rapide et étape créés en BDD. ID Trade :', insertedTrade.id)

      // Déclenchement automatique et asynchrone de la détection des news
      if (insertedTrade.date_backtested && insertedTrade.entry_time && insertedTrade.exit_time) {
        const functionUrl = `${supabaseUrl}/functions/v1/detect-news`
        console.log(`📡 [Telegram API] Déclenchement automatique de la détection des news sur ${functionUrl}...`)
        
        fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader || '',
          },
          body: JSON.stringify({
            trade_id: insertedTrade.id,
            pair: insertedTrade.pair,
            date: insertedTrade.date_backtested,
            entry_time: insertedTrade.entry_time,
            exit_time: insertedTrade.exit_time,
          })
        })
        .then(async (res) => {
          if (!res.ok) {
            console.error(`❌ [Telegram API] Réponse KO de detect-news (${res.status}) :`, await res.text())
          } else {
            console.log('✅ [Telegram API] News détectées et enregistrées avec succès en tâche de fond')
          }
        })
        .catch(err => {
          console.error('\u274c [Telegram API] Erreur réseau lors de l\'appel à detect-news :', err)
        })
      }

      await acquitterUpdates(token, maxUpdateId)
      return jsonResponse({
        mode: 'quick',
        tradeId: insertedTrade.id,
        analysis: analysisData,
        fileUrl,
        date: message.date,
      })
    }

    console.log("🚀 [Telegram API] Mode Standard détecté (stockage d'image simple)")
    
    const stepId = stepIdFromParam
    if (stepId) {
      console.log("📎 [Telegram API] step_id fourni, attachement de l'image au step :", stepId)
      
      if (!supabaseUrl || !supabaseAnonKey) {
        console.warn("⚠️ [Telegram API] Supabase non configuré, impossible d'attacher l'image au step")
      } else {
        const authHeader = req.headers.get('authorization')
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: authHeader || '' } },
        })

        const { error: imageInsertError } = await supabase
          .from('step_images')
          .insert({
            step_id: stepId,
            source: 'telegram',
            url: fileUrl,
          })

        if (imageInsertError) {
          console.error("❌ [Telegram API] Erreur lors de l'enregistrement de l'image :", imageInsertError)
        } else {
          console.log('✅ [Telegram API] Image attachée au step avec succès')
        }
      }
    }
    
    await acquitterUpdates(token, maxUpdateId)
    return jsonResponse({
      mode: 'standard',
      fileUrl,
      date: message.date,
      stepId: stepId || null,
    })
  } catch (error: unknown) {
    if (isGeminiQuotaError(error)) {
      console.error('❌ [Telegram API] Quota Gemini Free Tier :', error)
      return jsonResponse({ error: messageErreurQuotaGemini(error) }, 429)
    }
    const message = error instanceof Error ? error.message : 'Erreur lors du traitement du message Telegram'
    console.error('❌ [Telegram API] Erreur générale :', error)
    return jsonResponse({ error: message }, 500)
  }
})
