export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

export function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { 
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

export const GEMINI_MODEL_DEFAUT = "gemini-3.1-flash-lite";

const MODELES_GEMINI_OBSOLETES = new Set([
  "gemini-1.5-flash",
  "gemini-1.5-flash-latest",
  "gemini-1.5-flash-8b",
  "gemini-1.5-pro",
  "gemini-2.0-flash",
]);

/** Lu à l'exécution pour ignorer les anciens modèles. */
export function getGeminiVisionModel(): string {
  const configure = Deno.env.get('GEMINI_MODEL')?.trim();
  const modele = configure || GEMINI_MODEL_DEFAUT;
  if (MODELES_GEMINI_OBSOLETES.has(modele)) {
    console.warn(
      `⚠️ [Gemini] Modèle "${modele}" obsolète — utilisation de ${GEMINI_MODEL_DEFAUT}`,
    );
    return GEMINI_MODEL_DEFAUT;
  }
  return modele;
}

export const SMC_ANALYSIS_PROMPT = `Tu es un assistant IA spécialisé en analyse de graphiques et de positions de trading (principalement issus de TradingView, MetaTrader, etc.).
Analyse cette capture d'écran et extrais avec une précision chirurgicale les données suivantes.
Reste extrêmement attentif aux petits détails textuels et aux étiquettes de couleur.

Voici comment localiser les informations sur l'image :
1. **Actif & Timeframe (En haut à gauche du graphique) :**
   - Cherche le texte de la paire de devises (ex: "British Pound / New Zealand Dollar" ou "GBPNZD", "Gold / U.S. Dollar" ou "XAUUSD").
   - Traduis les noms longs en symboles de 6 lettres (ex: "British Pound / New Zealand Dollar" -> "GBPNZD", "Gold" -> "XAUUSD", "Euro / U.S. Dollar" -> "EURUSD").
   - Juste à côté, repère l'unité de temps (ex: "4h", "1h", "M15", "5m").
2. **Direction de la Position (Outil de position Long/Short de TradingView) :**
   - L'outil dessine une zone translucide bicolore (généralement verte et rouge) :
     - Si la zone verte (profit) est en bas et rouge (perte) en haut : la direction est "short".
     - Si la zone verte (profit) est en haut et rouge (perte) en bas : la direction est "long".
3. **Prix clés (Sur l'axe vertical tout à fait à droite) :**
   - **Prix d'entrée :** Repère l'étiquette grise, bleue ou sombre située exactement à la séparation entre la zone rouge et verte sur l'axe des prix.
   - **Stop Loss (SL) :** Repère l'étiquette rouge/orange sur l'axe des prix à droite, ou lis la valeur dans la petite étiquette de texte "Stop: X.XXXXX" aux extrémités de l'outil.
   - **Take Profit (TP) :** Repère l'étiquette verte sur l'axe des prix à droite, ou lis la valeur "Target: X.XXXXX" aux extrémités de l'outil.
4. **Ratio Risk/Reward (R:R) :**
   - Regarde le rectangle de statut au centre de l'outil de position (au milieu de la séparation rouge/verte).
   - Lis la valeur écrite à côté de "Risk/reward ratio:" (ex: "2.64"). C'est le ratio planifié (rr).
5. **Dénouement & Résultat :**
   - Observe les bougies japonaises (le prix) qui se développent vers la droite à partir du début de l'outil de position.
   - **Distinction cruciale entre Activé (Win/Loss) et Manqué (Missed) :**
     * **Ordre Manqué (Missed) :** Regarde si le prix (les mèches des bougies de retracement) a rebondi *avant* de toucher ou traverser la ligne d'entrée bleue/grise (la frontière entre le vert et le rouge). Si le prix repart dans la direction prévue sans avoir touché cette ligne de prix d'entrée, alors le résultat est **"missed"** et le R:R réalisé (`rr_realized`) doit être **0**.
     * **Ordre Déclenché (Win/Loss) :** Si les mèches des bougies touchent ou traversent la ligne d'entrée, l'ordre s'est déclenché.
       * Si le prix traverse entièrement la boîte verte et touche le Take Profit sans toucher le SL : le résultat est **"win"** et `rr_realized` est égal à `rr`.
       * Si le prix traverse la boîte rouge et touche le Stop Loss : le résultat est **"loss"** et `rr_realized` est **-1**.
       * Si le trade est coupé manuellement ou fini à l'équilibre : le résultat est **"breakeven"** (le R:R réalisé est de 0 ou proche de 0).
6. **Date & Heure (Sur l'axe horizontal tout à fait en bas) :**
   - Cherche les étiquettes de couleur (bleues, grises ou sombres) sur l'axe du temps en bas.
   - L'étiquette de gauche correspond à l'entrée/début du trade (date_backtested et entry_time). Convertis le jour (ex: "Thu 02 Apr '26" -> "2026-04-02") et note l'heure (ex: "01:00").
   - L'étiquette de droite correspond à la sortie/fin du trade (exit_time) (ex: "Fri 17 Apr '26 09:00" -> "09:00").

Retourne UNIQUEMENT ce format JSON, sans aucun texte markdown (pas de \`\`\`json) ou texte d'explication :
{
  "pair": "symbole standard à 6 lettres ou plus (ex: GBPNZD, XAUUSD...)",
  "direction": "long" ou "short",
  "entry_price": nombre ou null,
  "sl": nombre ou null,
  "tp": nombre ou null,
  "timeframe": "timeframe visible (ex: M15, H4, H1...)",
  "session": "Asian, London, NY ou London/NY selon l'heure d'entrée, ou null",
  "rr": nombre de R:R planifié (ex: 2.64) ou null,
  "rr_realized": nombre de R:R réellement réalisé (ex: 2.64 si TP, -1 si SL, 0 si BE ou missed) ou null,
  "result": "win", "loss", "breakeven" ou "missed" ou null,
  "missed_gap": nombre ou null, // Si le résultat est "missed", estime l'écart en pips ou points entre le prix le plus bas/haut atteint et le prix d'entrée
  "date_backtested": "date de début au format AAAA-MM-JJ (ex: 2026-04-02) ou null",
  "entry_time": "heure d'entrée au format HH:MM (ex: 01:00) ou null",
  "exit_time": "heure de sortie au format HH:MM (ex: 09:00) ou null",
  "patterns": ["patterns SMC visibles si annotés"],
  "confidence": {
    "pair": 0.0 à 1.0,
    "direction": 0.0 à 1.0,
    "entry_price": 0.0 à 1.0,
    "sl": 0.0 à 1.0,
    "tp": 0.0 à 1.0,
    "date_backtested": 0.0 à 1.0,
    "entry_time": 0.0 à 1.0,
    "exit_time": 0.0 à 1.0
  }
}`;

export const SMC_CLOSE_ANALYSIS_PROMPT = `Tu es un assistant IA spécialisé en analyse de graphiques de trading (TradingView, MetaTrader, etc.).
On te fournit la capture d'écran de FIN d'un trade, ainsi que les paramètres théoriques planifiés au départ :
- Direction du trade : {direction}
- Prix d'entrée théorique : {entry_price}
- Stop Loss (SL) : {sl}
- Take Profit (TP) : {tp}

Analyse les bougies japonaises (le développement des prix à droite de la ligne d'entrée) et détermine avec précision :
1. **Déclenchement (Trigger) :** Le prix a-t-il atteint/touché le prix d'entrée théorique ?
   - Si non, le trade est "missed" (non déclenché). Estime l'écart (en pips/points) entre le niveau le plus proche atteint par le retracement du prix et le prix d'entrée théorique. Indique aussi une raison courte (ex: "A rebondi X pips avant l'entrée").
   - Si oui, le trade s'est déclenché.
2. **Dénouement (si déclenché) :**
   - Le prix a-t-il touché le Take Profit (TP) en premier ? Le résultat est alors "win", et le R:R réalisé est égal au R:R planifié.
   - Le prix a-t-il touché le Stop Loss (SL) en premier ? Le résultat est alors "loss", et le R:R réalisé est de -1.
   - Le prix a-t-il oscillé puis a été coupé à l'équilibre ? Le résultat est alors "breakeven", et le R:R réalisé est de 0 ou proche.

Observe attentivement les étiquettes de temps sur l'axe horizontal en bas pour estimer l'heure de sortie si elle est visible.

Retourne UNIQUEMENT ce format JSON, sans aucun texte markdown (pas de \`\`\`json) ou texte d'explication :
{
  "triggered": true ou false,
  "result": "win", "loss", "breakeven" ou "missed",
  "rr_realized": nombre (ex: 2.5 pour win, -1 pour loss, 0 pour breakeven/missed) ou null,
  "missed_gap": nombre (écart en pips/points si missed) ou null,
  "missed_reason": "raison textuelle courte si missed" ou null,
  "exit_time": "heure de sortie détectée au format HH:MM ou null"
}`;
