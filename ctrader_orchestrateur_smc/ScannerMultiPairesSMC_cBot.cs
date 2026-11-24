using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using cAlgo.API;
using cAlgo.API.Internals;

namespace cAlgo.Robots
{
    /**
     * ==============================================================================
     * 🎼 SCANNER MULTI-PAIRES SMC - VERSION CTRADER CLOUD (0 € DE VPS)
     * ==============================================================================
     * Ce robot (cBot) analyse en continu l'ensemble des marchés (Forex, Indices, Métaux, Cryptos)
     * sur plusieurs unités de temps (M15, M30, H1, H4).
     *
     * Dès qu'un setup SMC (Smart Money Concepts) est confirmé par 3 bougies (Sweep + Réintégration),
     * il envoie instantanément une alerte Telegram avec :
     * 1. Le rapport texte détaillé (Entrée, Stop Loss, Take Profit, Ratio R:R)
     * 2. Un graphique épuré style TradingView en thème sombre (chandeliers japonais purs).
     *
     * Il peut tourner 24h/24 et 7j/7 directement dans le Cloud cTrader GRATUITEMENT !
     */
    [Robot(TimeZone = TimeZones.UTC, AccessRights = AccessRights.FullAccess)]
    public class ScannerMultiPairesSMC_cBot : Robot
    {
        // ==============================================================================
        // ⚙️ PARAMÈTRES CONFIGURABLES DANS L'INTERFACE CTRADER
        // ==============================================================================

        [Parameter("Jeton Bot Telegram (Token)", Group = "🔔 Telegram", DefaultValue = "9013814792:AAEfxmqtIBkPNYowfjWN6vHx9H3urrhdoLY")]
        public string TelegramBotToken { get; set; }

        [Parameter("Chat ID Telegram", Group = "🔔 Telegram", DefaultValue = "626484487")]
        public string TelegramChatId { get; set; }

        [Parameter("Activer les alertes Telegram", Group = "🔔 Telegram", DefaultValue = true)]
        public bool ActiverTelegram { get; set; }

        [Parameter("Envoyer le graphique TradingView", Group = "🔔 Telegram", DefaultValue = true)]
        public bool EnvoyerGraphiqueImage { get; set; }

        [Parameter("Surveiller Timeframe M15", Group = "⏱️ Timeframes", DefaultValue = true)]
        public bool ScannerM15 { get; set; }

        [Parameter("Surveiller Timeframe M30", Group = "⏱️ Timeframes", DefaultValue = true)]
        public bool ScannerM30 { get; set; }

        [Parameter("Surveiller Timeframe H1", Group = "⏱️ Timeframes", DefaultValue = true)]
        public bool ScannerH1 { get; set; }

        [Parameter("Surveiller Timeframe H4", Group = "⏱️ Timeframes", DefaultValue = true)]
        public bool ScannerH4 { get; set; }

        [Parameter("Inclure Forex Majeur & Mineur", Group = "🌐 Filtres Symboles", DefaultValue = true)]
        public bool InclureForex { get; set; }

        [Parameter("Exclure Forex Exotiques (spreds élevés)", Group = "🌐 Filtres Symboles", DefaultValue = true)]
        public bool ExclureExotiques { get; set; }

        [Parameter("Inclure Métaux (XAUUSD, XAGUSD...)", Group = "🌐 Filtres Symboles", DefaultValue = true)]
        public bool InclureMetaux { get; set; }

        [Parameter("Inclure Indices Cash (US100, US30...)", Group = "🌐 Filtres Symboles", DefaultValue = true)]
        public bool InclureIndices { get; set; }

        [Parameter("Inclure Cryptomonnaies (BTC, ETH...)", Group = "🌐 Filtres Symboles", DefaultValue = true)]
        public bool InclureCryptos { get; set; }

        [Parameter("Liste Manuelle (vide = automatique)", Group = "🌐 Filtres Symboles", DefaultValue = "")]
        public string ListePairesManuelle { get; set; }

        [Parameter("Profondeur Swing High/Low", Group = "🕯️ Stratégie SMC", DefaultValue = 7)]
        public int ProfondeurSwing { get; set; }

        [Parameter("Ratio Risque/Rendement Minimal (ex: 2.0 = 1:2)", Group = "🕯️ Stratégie SMC", DefaultValue = 2.0)]
        public double RatioMinimalRR { get; set; }

        // ==============================================================================
        // 📦 STRUCTURES DE DONNÉES SIMPLES
        // ==============================================================================

        // Représente un créneau (Paire x Timeframe) à surveiller dans la boucle
        private class SlotSurveillance
        {
            public string Symbole;
            public TimeFrame Periode;
            public string NomTimeframe;
            public DateTime DerniereBougieTraitee;
            public DateTime DerniereAlerteEnvoyee;
            public Bars DonneesBougies;
        }

        // Représente un setup de trading SMC détecté
        private class SetupSMC
        {
            public string Symbole;
            public string Timeframe;
            public string Direction;      // "ACHAT" ou "VENTE"
            public string NomStructure;   // "Spring (Achat)" ou "UTAD (Vente)"
            public double PrixEntree;
            public double StopLoss;
            public double TakeProfit;
            public double RatioRR;
            public DateTime HeureDetection;
            public List<BougieSimple> DernieresBougies = new List<BougieSimple>();
        }

        // Bougie simplifiée pour dessiner le graphique TradingView
        public class BougieSimple
        {
            public DateTime Heure;
            public double Open;
            public double High;
            public double Low;
            public double Close;
        }

        // Variables internes
        private readonly List<SlotSurveillance> _slots = new List<SlotSurveillance>();
        private int _indexSlotCourant = 0;
        private readonly HttpClient _httpClient = new HttpClient();
        private readonly HashSet<string> _devisesExotiques = new HashSet<string>
        {
            "TRY", "ZAR", "MXN", "PLN", "CZK", "HUF", "SEK", "NOK",
            "SGD", "HKD", "CNH", "CNY", "RUB", "DKK", "THB", "ILS"
        };

        // ==============================================================================
        // 1️⃣ DÉMARRAGE DU CBOT (Initialisation dans cTrader ou cTrader Cloud)
        // ==============================================================================
        protected override void OnStart()
        {
            Print("🚀 [cTrader SMC] Démarrage du Scanner Multi-Paires...");

            // 1. Initialiser la liste des créneaux de surveillance
            InitialiserSlotsDeSurveillance();

            Print($"✅ [cTrader SMC] {_slots.Count} créneaux (Paire x Timeframe) configurés et actifs !");

            // 2. Définir le minuteur de cadence pour analyser 1 slot toutes les 100 millisecondes
            // Cela permet de scanner en continu sans surcharger le processeur
            Timer.Start(TimeSpan.FromMilliseconds(100));

            // 3. Envoyer une notification Telegram de confirmation de démarrage
            if (ActiverTelegram)
            {
                string msgBienvenue = "🟢 *[cTrader SMC LIVE] Scanner Multi-Paires Activé !*\n\n" +
                                     $"📊 *Créneaux surveillés :* {_slots.Count} (Paires x UT)\n" +
                                     "☁️ *Hébergement :* cTrader Cloud 24h/24 (0 € VPS)\n" +
                                     "🎯 *Stratégie :* SMC Wyckoff (Spring/UTAD + Confirmation 3 bougies)\n" +
                                     "🎨 *Graphiques :* Rendu TradingView Dark Theme activé.";

                Task.Run(async () => await EnvoyerMessageTexteTelegramAsync(TelegramChatId, msgBienvenue));
            }
        }

        // ==============================================================================
        // 2️⃣ BOUCLE DU MINUTEUR : Analyse continue des paires l'une après l'autre
        // ==============================================================================
        protected override void OnTimer()
        {
            // Vérification de sécurité
            if (_slots.Count == 0) return;

            // 1. Récupérer le slot à analyser
            SlotSurveillance slot = _slots[_indexSlotCourant];

            // 2. Passer au slot suivant pour le prochain tick
            _indexSlotCourant = (_indexSlotCourant + 1) % _slots.Count;

            // 3. Analyser ce slot
            AnalyserSlot(slot);
        }

        // ==============================================================================
        // 3️⃣ ANALYSE D'UN SLOT SPÉCIFIQUE (Paire x Timeframe)
        // ==============================================================================
        private void AnalyserSlot(SlotSurveillance slot)
        {
            try
            {
                // Récupérer les bougies actuelles
                Bars bougies = slot.DonneesBougies ?? MarketData.GetBars(slot.Periode, slot.Symbole);
                slot.DonneesBougies = bougies;

                // Il faut au moins 50 bougies pour identifier les structures SMC
                if (bougies.Count < 50) return;

                // Vérifier si la dernière bougie clôturée a déjà été analysée (évite les calculs inutiles)
                DateTime dateDerniereBougie = bougies.OpenTimes.Last(1);
                if (slot.DerniereBougieTraitee == dateDerniereBougie)
                {
                    return; // Déjà analysé pour cette clôture
                }
                slot.DerniereBougieTraitee = dateDerniereBougie;

                // 4️⃣ Recherche du Setup SMC
                SetupSMC setup = DetecterSetupSMC(slot.Symbole, slot.NomTimeframe, bougies);

                if (setup != null)
                {
                    // Éviter les alertes en double rapprochées sur la même paire (délai de 30 minutes)
                    if ((DateTime.UtcNow - slot.DerniereAlerteEnvoyee).TotalMinutes > 30)
                    {
                        slot.DerniereAlerteEnvoyee = DateTime.UtcNow;
                        Print($"🚨 [SMC VALIDÉ] {setup.Direction} sur {setup.Symbole} ({setup.Timeframe}) | Entrée: {setup.PrixEntree} | SL: {setup.StopLoss} | TP: {setup.TakeProfit}");

                        // Déclencher l'alerte Telegram avec graphique TradingView
                        DeclencherAlerteTelegram(setup);
                    }
                }
            }
            catch (Exception ex)
            {
                Print($"⚠️ [Erreur Scan] {slot.Symbole} {slot.NomTimeframe} : {ex.Message}");
            }
        }

        // ==============================================================================
        // 4️⃣ MOTEUR DE DÉTECTION SMC (Wyckoff Spring / UTAD + Confirmation 3 Bougies)
        // ==============================================================================
        private SetupSMC DetecterSetupSMC(string symbole, string nomTf, Bars bougies)
        {
            int total = bougies.Count;
            if (total < 60) return null;

            // Bougie 1 (clôturée la plus récente) = index 1
            // Bougie 2 (précédente) = index 2
            // Bougie 3 (balayage / sweep) = index 3
            double open1 = bougies.OpenPrices.Last(1);
            double high1 = bougies.HighPrices.Last(1);
            double low1 = bougies.LowPrices.Last(1);
            double close1 = bougies.ClosePrices.Last(1);

            double high2 = bougies.HighPrices.Last(2);
            double low2 = bougies.LowPrices.Last(2);
            double close2 = bougies.ClosePrices.Last(2);

            double high3 = bougies.HighPrices.Last(3);
            double low3 = bougies.LowPrices.Last(3);

            // 1. Calculer le plus haut et le plus bas des 30 bougies précédentes (zone de liquidité)
            double plusHautPrecedent = double.MinValue;
            double plusBasPrecedent = double.MaxValue;

            for (int i = 4; i <= 35; i++)
            {
                double h = bougies.HighPrices.Last(i);
                double l = bougies.LowPrices.Last(i);
                if (h > plusHautPrecedent) plusHautPrecedent = h;
                if (l < plusBasPrecedent) plusBasPrecedent = l;
            }

            // Calcul de la taille moyenne des bougies (ATR simplifié) pour les marges de SL
            double sommeTaille = 0;
            for (int i = 1; i <= 14; i++)
            {
                sommeTaille += (bougies.HighPrices.Last(i) - bougies.LowPrices.Last(i));
            }
            double tailleMoyenne = sommeTaille / 14.0;
            if (tailleMoyenne <= 0) tailleMoyenne = 0.0001;

            // ==========================================================================
            // CAS A : SETUP VENTE (UTAD / Balayage haussier de liquidité)
            // ==========================================================================
            // - Bougie 3 a percé au-dessus du plus haut précédent (prise de liquidité)
            // - Bougie 2 a réintégré vers le bas (clôture sous le niveau de liquidité)
            // - Bougie 1 confirme la baisse (clôture rouge sous la clôture 2)
            bool estSweepHaut = (high3 > plusHautPrecedent);
            bool estReintegrationBaisse = (close2 < plusHautPrecedent);
            bool estConfirmationBaisse = (close1 < open1 && close1 < close2);

            if (estSweepHaut && estReintegrationBaisse && estConfirmationBaisse)
            {
                double entree = close1;
                double sl = high3 + (tailleMoyenne * 0.25); // SL au-dessus de la mèche de sweep
                double distanceRisque = sl - entree;

                if (distanceRisque > 0)
                {
                    double tp = entree - (distanceRisque * RatioMinimalRR); // TP minimal 1:2
                    double ratioReel = (entree - tp) / distanceRisque;

                    SetupSMC s = new SetupSMC
                    {
                        Symbole = symbole,
                        Timeframe = nomTf,
                        Direction = "VENTE",
                        NomStructure = "UTAD (Liquidation Achat -> Vente)",
                        PrixEntree = entree,
                        StopLoss = sl,
                        TakeProfit = tp,
                        RatioRR = Math.Round(ratioReel, 2),
                        HeureDetection = DateTime.UtcNow
                    };

                    RemplirHistoriqueBougies(s, bougies, 35);
                    return s;
                }
            }

            // ==========================================================================
            // CAS B : SETUP ACHAT (Spring / Balayage baissier de liquidité)
            // ==========================================================================
            // - Bougie 3 a percé sous le plus bas précédent (prise de liquidité vendeuse)
            // - Bougie 2 a réintégré vers le haut (clôture au-dessus du niveau)
            // - Bougie 1 confirme la hausse (clôture verte au-dessus de la clôture 2)
            bool estSweepBas = (low3 < plusBasPrecedent);
            bool estReintegrationHausse = (close2 > plusBasPrecedent);
            bool estConfirmationHausse = (close1 > open1 && close1 > close2);

            if (estSweepBas && estReintegrationHausse && estConfirmationHausse)
            {
                double entree = close1;
                double sl = low3 - (tailleMoyenne * 0.25); // SL en-dessous de la mèche de sweep
                double distanceRisque = entree - sl;

                if (distanceRisque > 0)
                {
                    double tp = entree + (distanceRisque * RatioMinimalRR); // TP minimal 1:2
                    double ratioReel = (tp - entree) / distanceRisque;

                    SetupSMC s = new SetupSMC
                    {
                        Symbole = symbole,
                        Timeframe = nomTf,
                        Direction = "ACHAT",
                        NomStructure = "Spring (Liquidation Vente -> Achat)",
                        PrixEntree = entree,
                        StopLoss = sl,
                        TakeProfit = tp,
                        RatioRR = Math.Round(ratioReel, 2),
                        HeureDetection = DateTime.UtcNow
                    };

                    RemplirHistoriqueBougies(s, bougies, 35);
                    return s;
                }
            }

            return null;
        }

        // Remplit les 35 dernières bougies pour générer le graphique
        private void RemplirHistoriqueBougies(SetupSMC setup, Bars bougies, int nombreBougies)
        {
            int n = Math.Min(nombreBougies, bougies.Count - 1);
            for (int i = n; i >= 1; i--)
            {
                setup.DernieresBougies.Add(new BougieSimple
                {
                    Heure = bougies.OpenTimes.Last(i),
                    Open = bougies.OpenPrices.Last(i),
                    High = bougies.HighPrices.Last(i),
                    Low = bougies.LowPrices.Last(i),
                    Close = bougies.ClosePrices.Last(i)
                });
            }
        }

        // ==============================================================================
        // 5️⃣ DÉCLENCHEMENT DE L'ALERTE TELEGRAM (Texte + Graphique TradingView)
        // ==============================================================================
        private void DeclencherAlerteTelegram(SetupSMC setup)
        {
            if (!ActiverTelegram) return;

            string iconeDirection = setup.Direction == "ACHAT" ? "🟢" : "🔴";
            string iconeTitre = setup.Direction == "ACHAT" ? "🚀 [SIGNAL ACHAT SMC]" : "💥 [SIGNAL VENTE SMC]";

            // Format du texte soigné
            string texteRapport = $"{iconeTitre}\n" +
                                  $"━━━━━━━━━━━━━━━━━━━━━\n" +
                                  $"📌 *Paire :* `{setup.Symbole}`\n" +
                                  $"⏱️ *Timeframe :* `{setup.Timeframe}`\n" +
                                  $"🎯 *Structure :* {setup.NomStructure}\n" +
                                  $"━━━━━━━━━━━━━━━━━━━━━\n" +
                                  $"⚡ *Entrée :* `{setup.PrixEntree:F5}`\n" +
                                  $"🛡️ *Stop Loss :* `{setup.StopLoss:F5}`\n" +
                                  $"🎯 *Take Profit :* `{setup.TakeProfit:F5}`\n" +
                                  $"⚖️ *Ratio R:R :* `1:{setup.RatioRR}`\n" +
                                  $"━━━━━━━━━━━━━━━━━━━━━\n" +
                                  $"🤖 *Scanner :* cTrader Cloud Execution (24/7)\n" +
                                  $"⏰ *Heure UTC :* {setup.HeureDetection:HH:mm:ss}";

            // 1. Si l'option graphique est activée : générer l'URL de l'image TradingView HD et l'envoyer
            if (EnvoyerGraphiqueImage && setup.DernieresBougies.Count > 0)
            {
                Task.Run(async () =>
                {
                    bool succesImage = await EnvoyerPhotoTelegramAvecGraphiqueAsync(TelegramChatId, setup, texteRapport);

                    // Si l'envoi de la photo a échoué (problème d'API image), envoyer au moins le texte de secours
                    if (!succesImage)
                    {
                        await EnvoyerMessageTexteTelegramAsync(TelegramChatId, texteRapport);
                    }
                });
            }
            else
            {
                // Envoi texte direct
                Task.Run(async () =>
                {
                    await EnvoyerMessageTexteTelegramAsync(TelegramChatId, texteRapport);
                });
            }
        }

        // ==============================================================================
        // 6️⃣ ENVOI HTTP VERS TELEGRAM (Cloud Native, sans aucune dépendance Windows)
        // ==============================================================================

        // Envoie un message texte simple avec format Markdown
        private async Task<bool> EnvoyerMessageTexteTelegramAsync(string chatId, string texte)
        {
            try
            {
                string url = $"https://api.telegram.org/bot{TelegramBotToken}/sendMessage";
                var parametres = new Dictionary<string, string>
                {
                    { "chat_id", chatId },
                    { "text", texte },
                    { "parse_mode", "Markdown" }
                };

                var content = new FormUrlEncodedContent(parametres);
                var reponse = await _httpClient.PostAsync(url, content);
                return reponse.IsSuccessStatusCode;
            }
            catch (Exception ex)
            {
                Print($"❌ [Telegram Texte] Erreur: {ex.Message}");
                return false;
            }
        }

        // Envoie une photo avec légende à Telegram
        private async Task<bool> EnvoyerPhotoTelegramAvecGraphiqueAsync(string chatId, SetupSMC setup, string legende)
        {
            try
            {
                // Construit l'URL du graphique dynamique via l'API de rendu QuickChart (style TradingView Dark)
                string urlGraphique = ConstruireUrlGraphiqueTradingView(setup);

                string urlTelegram = $"https://api.telegram.org/bot{TelegramBotToken}/sendPhoto";
                var parametres = new Dictionary<string, string>
                {
                    { "chat_id", chatId },
                    { "photo", urlGraphique },
                    { "caption", legende },
                    { "parse_mode", "Markdown" }
                };

                var content = new FormUrlEncodedContent(parametres);
                var reponse = await _httpClient.PostAsync(urlTelegram, content);

                if (reponse.IsSuccessStatusCode)
                {
                    Print($"✅ [Telegram] Graphique TradingView envoyé avec succès pour {setup.Symbole} ({setup.Timeframe})");
                    return true;
                }
                else
                {
                    string erreur = await reponse.Content.ReadAsStringAsync();
                    Print($"⚠️ [Telegram Photo] Réponse API: {erreur}");
                    return false;
                }
            }
            catch (Exception ex)
            {
                Print($"❌ [Telegram Photo] Erreur: {ex.Message}");
                return false;
            }
        }

        // ==============================================================================
        // 7️⃣ CONSTRUCTEUR D'URL GRAPHIQUE STYLE TRADINGVIEW DARK (#131722)
        // ==============================================================================
        private string ConstruireUrlGraphiqueTradingView(SetupSMC setup)
        {
            // Prépare les données de bougies
            var labels = new StringBuilder();
            var ohlcData = new StringBuilder();

            int count = Math.Min(setup.DernieresBougies.Count, 30);
            for (int i = 0; i < count; i++)
            {
                var b = setup.DernieresBougies[i];
                if (i > 0)
                {
                    labels.Append(",");
                    ohlcData.Append(",");
                }
                labels.Append($"'{b.Heure:HH:mm}'");
                ohlcData.Append($"{{o:{b.Open.ToString(CultureInfo.InvariantCulture)},h:{b.High.ToString(CultureInfo.InvariantCulture)},l:{b.Low.ToString(CultureInfo.InvariantCulture)},c:{b.Close.ToString(CultureInfo.InvariantCulture)}}}");
            }

            // Couleur SL (rouge) et TP (vert)
            string slVal = setup.StopLoss.ToString(CultureInfo.InvariantCulture);
            string tpVal = setup.TakeProfit.ToString(CultureInfo.InvariantCulture);
            string entreeVal = setup.PrixEntree.ToString(CultureInfo.InvariantCulture);

            // Construction du JSON Chart.js / QuickChart pour un rendu pur chandeliers japonais
            string chartConfig = "{" +
                "type:'candlestick'," +
                "data:{" +
                    $"labels:[{labels}]," +
                    "datasets:[{" +
                        $"label:'{setup.Symbole} {setup.Timeframe}'," +
                        $"data:[{ohlcData}]," +
                        "color:{up:'#089981',down:'#f23645',unchanged:'#888888'}" +
                    "}]" +
                "}," +
                "options:{" +
                    "scales:{" +
                        "x:{grid:{color:'#1e222d'},ticks:{color:'#d1d4dc'}}," +
                        "y:{grid:{color:'#1e222d'},ticks:{color:'#d1d4dc'}}" +
                    "}," +
                    "plugins:{" +
                        "legend:{labels:{color:'#ffffff'}}," +
                        "annotation:{" +
                            "annotations:{" +
                                $"sl:{{type:'line',yMin:{slVal},yMax:{slVal},borderColor:'#f23645',borderWidth:2,label:{{content:'SL: {slVal}',enabled:true,backgroundColor:'#f23645'}}}}," +
                                $"tp:{{type:'line',yMin:{tpVal},yMax:{tpVal},borderColor:'#089981',borderWidth:2,label:{{content:'TP: {tpVal}',enabled:true,backgroundColor:'#089981'}}}}," +
                                $"entree:{{type:'line',yMin:{entreeVal},yMax:{entreeVal},borderColor:'#2962ff',borderWidth:1,borderDash:[4,4],label:{{content:'Entrée',enabled:true,backgroundColor:'#2962ff'}}}}" +
                            "}" +
                        "}" +
                    "}" +
                "}" +
            "}";

            string encodedConfig = Uri.EscapeDataString(chartConfig);
            return $"https://quickchart.io/chart?backgroundColor=%23131722&width=1000&height=550&c={encodedConfig}";
        }

        // ==============================================================================
        // 8️⃣ INITIALISATION AUTOMATIQUE DE LA LISTE DES CRÉNEAUX (PAIRES X TIMEFRAMES)
        // ==============================================================================
        private void InitialiserSlotsDeSurveillance()
        {
            _slots.Clear();

            // 1. Liste des Timeframes activés
            var timeframesActifs = new List<Tuple<TimeFrame, string>>();
            if (ScannerM15) timeframesActifs.Add(new Tuple<TimeFrame, string>(TimeFrame.Minute15, "M15"));
            if (ScannerM30) timeframesActifs.Add(new Tuple<TimeFrame, string>(TimeFrame.Minute30, "M30"));
            if (ScannerH1)  timeframesActifs.Add(new Tuple<TimeFrame, string>(TimeFrame.Hour, "H1"));
            if (ScannerH4)  timeframesActifs.Add(new Tuple<TimeFrame, string>(TimeFrame.Hour4, "H4"));

            // Si aucun timeframe sélectionné, forcer H1 par défaut
            if (timeframesActifs.Count == 0)
            {
                timeframesActifs.Add(new Tuple<TimeFrame, string>(TimeFrame.Hour, "H1"));
            }

            // 2. Déterminer les symboles à surveiller
            List<string> symbolesSelectionnes = new List<string>();

            // Option A : Liste manuelle saisie par l'utilisateur
            if (!string.IsNullOrWhiteSpace(ListePairesManuelle))
            {
                string[] paires = ListePairesManuelle.Split(new[] { ',', ';', ' ' }, StringSplitOptions.RemoveEmptyEntries);
                foreach (string p in paires)
                {
                    string nomNettoye = p.Trim();
                    if (!string.IsNullOrEmpty(nomNettoye))
                    {
                        symbolesSelectionnes.Add(nomNettoye);
                    }
                }
            }
            // Option B : Sélection automatique des symboles du broker (FTMO / IC Markets)
            else
            {
                foreach (var symbole in Symbols)
                {
                    string s = symbole.ToUpper();

                    // Vérifier si c'est une paire Forex exotique à exclure
                    if (ExclureExotiques && EstSymboleForexExotique(s))
                    {
                        continue;
                    }

                    // Filtrer par catégorie selon les paramètres
                    if (EstSymboleRetenu(s))
                    {
                        symbolesSelectionnes.Add(symbole);
                    }
                }

                // Si la recherche automatique retourne une liste vide (broker sécurisé), utiliser la liste universelle
                if (symbolesSelectionnes.Count == 0)
                {
                    symbolesSelectionnes = new List<string>
                    {
                        "EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD", "USDCHF", "NZDUSD",
                        "EURGBP", "EURJPY", "GBPJPY", "AUDJPY", "CADJPY", "CHFJPY", "EURAUD",
                        "XAUUSD", "XAGUSD", "US100", "US30", "US500", "GER40", "BTCUSD", "ETHUSD"
                    };
                }
            }

            // 3. Créer la combinaison (Chaque Symbole x Chaque Timeframe)
            foreach (string sym in symbolesSelectionnes)
            {
                foreach (var tf in timeframesActifs)
                {
                    _slots.Add(new SlotSurveillance
                    {
                        Symbole = sym,
                        Periode = tf.Item1,
                        NomTimeframe = tf.Item2,
                        DerniereBougieTraitee = DateTime.MinValue,
                        DerniereAlerteEnvoyee = DateTime.MinValue,
                        DonneesBougies = null
                    });
                }
            }
        }

        // Vérifie si un symbole appartient aux catégories sélectionnées
        private bool EstSymboleRetenu(string s)
        {
            // Métaux
            if (s.Contains("XAU") || s.Contains("XAG") || s.Contains("GOLD") || s.Contains("SILVER"))
            {
                return InclureMetaux;
            }

            // Indices
            if (s.Contains("US100") || s.Contains("US30") || s.Contains("US500") || s.Contains("GER40") ||
                s.Contains("NAS100") || s.Contains("DJ30") || s.Contains("SPX500") || s.Contains("DE40"))
            {
                return InclureIndices;
            }

            // Cryptos
            if (s.Contains("BTC") || s.Contains("ETH") || s.Contains("SOL") || s.Contains("XRP"))
            {
                return InclureCryptos;
            }

            // Forex Majeur / Mineur (Longueur standard 6 lettres, ex: EURUSD)
            if (s.Length == 6 && (s.StartsWith("EUR") || s.StartsWith("GBP") || s.StartsWith("USD") ||
                                  s.StartsWith("AUD") || s.StartsWith("NZD") || s.StartsWith("CAD") ||
                                  s.StartsWith("CHF") || s.StartsWith("JPY")))
            {
                return InclureForex;
            }

            return false;
        }

        // Vérifie si un symbole Forex contient une devise exotique
        private bool EstSymboleForexExotique(string s)
        {
            foreach (string exo in _devisesExotiques)
            {
                if (s.Contains(exo)) return true;
            }
            return false;
        }

        // ==============================================================================
        // 9️⃣ ARRÊT DU CBOT
        // ==============================================================================
        protected override void OnStop()
        {
            Timer.Stop();
            Print("🛑 [cTrader SMC] Scanner arrêté proprement.");
        }
    }
}

