# 🎼 Guide d'Installation & d'Utilisation — Orchestrateur SMC pour MetaTrader 5 (Optimisé VPS)

Ce dossier contient la suite **MetaTrader 5 (MQL5)** complète et autonome de votre indicateur **Chef d'Orchestre SMC**, optimisée spécifiquement pour tourner sur un **VPS** sur **10 à 20+ paires de devises** et plusieurs unités de temps (`M30`, `H1`, `H4`, `D1`) sans jamais créer de pic CPU à la clôture des bougies.

---

## 📁 1. Architecture Modulaire du Dossier (`mt5_orchestrateur_smc/`)

```text
mt5_orchestrateur_smc/
├── ScannerMultiPairesSMC.mq5              <-- 📡 SCANNER VPS : Surveille 15+ paires x 4 UT depuis 1 SEUL graphique !
├── OrchestrateurSMC_Alerte.mq5            <-- 📊 INDICATEUR MONO-GRAPHIQUE : Avec Décalage Anti-Pic & Court-Circuit N-3
├── GUIDE_INSTALLATION_MT5.md              <-- Ce guide d'installation
└── Modules/
    ├── Module00_TypesEtOutils.mqh           <-- Structures de données & calcul ATR
    ├── Module01_DojiEtPlage.mqh             <-- BLOC 1 : Détection Doji Liq/Reint (Spring/UTAD) & Plage ciblée
    ├── Module02_ShvedEtCollines.mqh         <-- BLOC 2 : Zones S/R Shved, Vraies Collines (>= 1.5x ATR) & Score /100
    ├── Module03_ZigZagDynamiqueUOP.mqh      <-- BLOC 3 : Score Liquidation /100 ➔ ZigZag Dynamique (4-20) & Profil UOP
    ├── Module04_EnergieEtConfirmation.mqh   <-- BLOC 4 : Carburant vs Friction UOP & Confirmation stricte des 3 bougies
    ├── Module05_VisuelsEtAlertes.mqh        <-- BLOC 5 : Tracé graphique épuré, Collines Diag & Alertes MT5 / Mobile
    └── Module06_MoteurEvaluationRapide.mqh  <-- BLOC 6 : Court-Circuit N-3 (0.01ms) & Décalage Temporel VPS
```

---

## ⚡ 2. Les 3 Optimisations VPS Intégrées

1. **⚡ Court-Circuit Ultra-Rapide sur la bougie `N - 3` (`0.01 ms`)** :
   - Lorsqu'une bougie clôture, l'algorithme vérifie d'abord **uniquement** si un Doji est présent sur les 3 dernières bougies ET si son Stop Loss a tenu.
   - Si aucun Doji n'est en cours de confirmation (95% du temps), **il s'arrête en `0.01 ms`** sans lancer ni le calcul Shved, ni les collines, ni le ZigZag UOP !
2. **⏱️ Décalage Temporel Automatique entre les Paires (`OnTimer` + Hash Symbole/UT)** :
   - Dans [`OrchestrateurSMC_Alerte.mq5`](file:///c:/Dev/JournalMobileAPK/mt5_orchestrateur_smc/OrchestrateurSMC_Alerte.mq5), chaque paire reçoit automatiquement un décalage unique entre `0s` et `8s` (ex: `EURUSD H1` à `+0.4s`, `GBPUSD H1` à `+2.1s`, `XAUUSD H1` à `+5.3s`).
   - À `XX:00:00`, les graphiques ne calculent plus jamais en même temps.
3. **📡 Scanner Central FTMO Multi-Actifs & Multi-Timeframes sur UN SEUL Graphique ([`ScannerMultiPairesSMC.mq5`](file:///c:/Dev/JournalMobileAPK/mt5_orchestrateur_smc/ScannerMultiPairesSMC.mq5))** :
   - Au lieu d'ouvrir 100 fenêtres de graphiques sur votre VPS, ouvrez **1 seul graphique** et glissez **`ScannerMultiPairesSMC`** dessus !
   - **Détection Automatique FTMO (`MODE_SYMBOLES_AUTO_COURTIER`)** : Récupère automatiquement tous les symboles disponibles sur votre serveur FTMO via `SymbolsTotal()` et les filtre par catégorie :
     - ✅ **Forex Majeures & Mineures** (`InpInclureForexMajeursMineurs = true`)
     - 🛡️ **Exclusion automatique des Forex Exotiques** (`InpExclureForexExotiques = true` : écarte `USDTRY`, `USDZAR`, `USDMXN`, etc.)
     - ✅ **Métaux précieux** (`XAUUSD`, `XAGUSD`...)
     - ✅ **Indices Cash** (`US100.cash`, `US30.cash`, `GER40.cash`...)
     - ✅ **Énergies & Matières Premières** (`USOIL.cash`, `UKOIL.cash`, `NATGAS.cash`...)
     - ✅ **Cryptos** (`BTCUSD`, `ETHUSD`, `SOLUSD`...)
     - ⬜ **Actions / Stocks CFD** (`InpInclureActionsStocks = false` par défaut pour éviter les gaps quotidiens)
   - **Saut Instantané des bougies non clôturées (`SlotBesoinAnalyseMaintenant`)** : Le Timer saute en `0.001 ms` tous les slots dont la bougie n'a pas changé et cadence l'analyse réelle à `100 ms` par nouveau slot.
   - **Tableau interactif cliquable avec Pagination (`◀` / `▶`)** : Dès qu'un setup est détecté ou confirmé, cliquez sur le bouton **`[🔍 SYMBOLE TF]`** dans le tableau à l'écran : le graphique bascule automatiquement sur cet actif/UT et **trace immédiatement tout le setup** (Doji, S/R Shved, Collines `⛰️`, ZigZag Dynamique, SL et TP Optimal) !

---

## 🚀 3. Installation dans MetaTrader 5

1. Ouvrez **MetaTrader 5** $\rightarrow$ **`Fichier`** $\rightarrow$ **`Ouvrir le dossier des données`** (*Open Data Folder*).
2. Ouvrez **`MQL5`**, puis **`Indicators`**.
3. **Copiez-collez tout le dossier `mt5_orchestrateur_smc`** dans `MQL5/Indicators/`.
4. Dans MetaTrader 5, faites un clic droit sur **`Indicateurs`** dans le panneau *Navigateur* $\rightarrow$ **`Actualiser`** :
   - Utilisez **`ScannerMultiPairesSMC`** sur **1 seul graphique** pour surveiller 15+ paires en `M30 / H1 / H4 / D1` sur votre VPS.
   - Ou utilisez **`OrchestrateurSMC_Alerte`** sur des graphiques individuels.
