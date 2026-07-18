import { createClient } from 'npm:@supabase/supabase-js@2.48.1'
import { GoogleGenAI } from 'npm:@google/genai'
import { jsonResponse, corsHeaders } from '../_shared/utils.ts'

// Initialisation de Gemini API
const apiKey = Deno.env.get('GEMINI_API_KEY')
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null

// URLs Supabase
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('VITE_SUPABASE_URL')
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('VITE_SUPABASE_ANON_KEY')

/**
 * Détermine les devises concernées par une paire de devises.
 * Exemple : EURUSD -> ['EUR', 'USD']
 */
function obtenirDevisesDepuisPaire(pair: string): string[] {
  const p = pair.toUpperCase()
  const devises: string[] = []
  if (p.includes('EUR')) devises.push('EUR')
  if (p.includes('GBP')) devises.push('GBP')
  if (p.includes('USD') || p.includes('XAU') || p.includes('NAS') || p.includes('US30')) devises.push('USD')
  if (p.includes('JPY')) devises.push('JPY')
  if (p.includes('AUD')) devises.push('AUD')
  if (p.includes('CAD')) devises.push('CAD')
  if (p.includes('CHF')) devises.push('CHF')
  if (p.includes('NZD')) devises.push('NZD')
  
  if (devises.length === 0) {
    devises.push('USD') // Devise par défaut
  }
  return devises
}

/**
 * Construit un récapitulatif textuel markdown à partir du tableau des nouvelles.
 */
function genererNotesNews(newsList: any[]): string {
  if (!newsList || newsList.length === 0) {
    return "Aucune annonce économique majeure n'a été détectée dans l'intervalle de cette position."
  }

  let notes = "### 📢 Annonces Économiques Détectées\n\n"
  for (const n of newsList) {
    const impactEmoji = n.impact === 'High' ? '🔴' : '🟠'
    notes += `${impactEmoji} **${n.name}** (${n.currency}) - **${n.time || 'Heure inconnue'}**\n`
    notes += `*   **Impact :** ${n.impact}\n`
    notes += `*   **Valeurs :** Réel: \`${n.actual || '—'}\` | Attendu: \`${n.forecast || '—'}\` | Précédent: \`${n.previous || '—'}\`\n`
    if (n.interpretation) {
      notes += `*   **Interprétation :** ${n.interpretation}\n`
    }
    notes += '\n'
  }
  return notes
}

Deno.serve(async (req) => {
  // Gestion de la politique CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Méthode non autorisée. Utilisez POST.' }, 405)
  }

  if (!ai) {
    return jsonResponse({ error: 'Clé API Gemini non configurée sur le serveur.' }, 500)
  }

  try {
    const body = await req.json()
    const { trade_id, pair, date, entry_time, exit_time } = body

    if (!pair || !date) {
      return jsonResponse({ error: 'Les paramètres pair et date sont obligatoires.' }, 400)
    }

    console.log(`📡 [Detect News] Recherche d'annonces pour ${pair} le ${date} (Entrée: ${entry_time ?? '—'}, Sortie: ${exit_time ?? '—'})`)

    const devises = obtenirDevisesDepuisPaire(pair)
    const devisesStr = devises.join(' et ')

    // Prompt configuré pour la recherche web
    const prompt = `Tu es un assistant spécialisé dans l'analyse de calendrier économique de trading.
Utilise l'outil Google Search pour trouver toutes les annonces économiques d'impact Fort (High impact) ou Moyen (Medium impact) publiées le ${date} pour les devises : ${devisesStr}.

L'heure de début (entrée) de la position était ${entry_time ?? 'inconnue'}.
L'heure de fin (sortie) de la position était ${exit_time ?? 'inconnue'}.

Instructions :
1. Recherche sur le web (ex: Forex Factory, Investing.com, DailyFX) le calendrier économique complet de la journée du ${date} pour ${devisesStr}.
2. Identifie les nouvelles économiques publiées (ex: NFP, CPI, Décision de taux, PPI, ISM, etc.).
3. Si les heures de début et de fin de position sont fournies, filtre ou mets particulièrement en valeur les nouvelles publiées entre 1 heure avant ${entry_time} et 1 heure après ${exit_time}.
4. Récupère les données réelles (Actual), attendues (Forecast), et précédentes (Previous).

Retourne UNIQUEMENT un objet JSON valide contenant le tableau des nouvelles économiques détectées. Ne mets pas d'explication de texte avant ou après, ne mets pas de balises de code markdown (comme \`\`\`json). Respecte ce format :
{
  "news": [
    {
      "name": "Nom de l'événement (ex: CPI m/m)",
      "currency": "Devise (ex: USD)",
      "impact": "High" ou "Medium",
      "time": "Heure de publication (ex: 14:30)",
      "actual": "Valeur réelle (ex: 0.2%)",
      "forecast": "Valeur attendue (ex: 0.1%)",
      "previous": "Valeur précédente (ex: 0.0%)",
      "interpretation": "Interprétation concise de l'impact (ex: Inflation plus forte que prévu, haussier pour le USD)"
    }
  ]
}
Si aucun événement n'est trouvé, retourne :
{
  "news": []
}`

    // Appel à Gemini avec Google Search Grounding activé
    console.log(`🤖 [Detect News] Appel à Gemini avec Search Grounding...`)
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }]
      }
    })

    const responseText = response.text || ''
    console.log(`🤖 [Detect News] Réponse brute de Gemini reçue. Longueur : ${responseText.length}`)

    // Extraction du JSON depuis la réponse
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error(`Gemini n'a pas renvoyé de format JSON valide. Réponse brute : ${responseText}`)
    }

    const newsData = JSON.parse(jsonMatch[0])
    const newsList = newsData.news || []
    console.log(`✅ [Detect News] Nombre d'annonces identifiées : ${newsList.length}`)

    // Si trade_id et l'autorisation sont fournis, on enregistre ou met à jour en BDD
    const authHeader = req.headers.get('authorization')
    if (trade_id && authHeader && supabaseUrl && supabaseAnonKey) {
      console.log(`💾 [Detect News] Enregistrement en base de données pour le trade : ${trade_id}`)
      
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      })

      // 1. Chercher si une étape de type 'news' existe déjà pour ce trade
      const { data: existingSteps, error: fetchError } = await supabase
        .from('steps')
        .select('id')
        .eq('trade_id', trade_id)
        .eq('type', 'news')

      const stepNotes = genererNotesNews(newsList)
      const stepFields = { news: newsList }

      if (fetchError) {
        console.error(`⚠️ [Detect News] Erreur lors de la vérification de l'étape news existante :`, fetchError)
      } else if (existingSteps && existingSteps.length > 0) {
        // Mettre à jour l'étape existante
        const stepId = existingSteps[0].id
        console.log(`💾 [Detect News] Mise à jour de l'étape news existante : ${stepId}`)
        const { error: updateError } = await supabase
          .from('steps')
          .update({
            notes: stepNotes,
            fields: stepFields
          })
          .eq('id', stepId)

        if (updateError) {
          console.error(`❌ [Detect News] Échec de la mise à jour de l'étape news :`, updateError)
        }
      } else {
        // Déterminer l'ordre (au-dessus des autres, après l'entrée par exemple)
        // Général : 0, Biais : 1, POI : 2, Entrée : 3, News : 4, Résultat : 5
        console.log(`💾 [Detect News] Création d'une nouvelle étape news pour le trade`)
        const { error: insertError } = await supabase
          .from('steps')
          .insert({
            trade_id,
            order: 4,
            type: 'news',
            title: 'Annonces Économiques',
            notes: stepNotes,
            fields: stepFields
          })

        if (insertError) {
          console.error(`❌ [Detect News] Échec de la création de l'étape news :`, insertError)
        }
      }
    }

    return jsonResponse({
      success: true,
      news: newsList
    })

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erreur interne de détection des news'
    console.error(`❌ [Detect News] Erreur :`, error)
    return jsonResponse({ error: msg }, 500)
  }
})
