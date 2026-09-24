# 📘 Guide d'Automatisation MT5 : Template & Captures pour l'IA

Ce dossier contient les outils nécessaires pour exporter vos trades depuis l'application TradeLog et générer automatiquement des captures d'écran standardisées et de haute qualité dans MetaTrader 5 pour l'entraînement de votre modèle d'IA.

---

## 🛠️ Contenu des Outils

1. **`TradeLogDatasetStudio.mq5` (Recommandé - Expert Advisor Interactif)** :
   - Panneau de contrôle visuel (HUD) intégré directement sur votre graphique MT5.
   - Permet de feuilleter vos trades un par un (`◀ Précédent`, `Suivant ▶`, `⏭ Non Capturé`).
   - Changement d'unité de temps en 1 clic (`M1`, `M5`, `M15`, `M30`, `H1`, `H4`, `D1`) en maintenant automatiquement le trade parfaitement cadré à l'écran.
   - Zoom et ajustement manuel libre du graphique avant de déclencher la capture.
   - Bouton de capture ou raccourci clavier `Espace` (l'interface se masque automatiquement au moment du snapshot pour une image 100% propre de 640x640).
   - **Mémorisation permanente de l'avancement** : un fichier `tradelog_progression.txt` retient sur quel trade vous vous êtes arrêté et quels trades ont déjà été capturés. Vous pouvez fermer MT5 et reprendre le lendemain exactement là où vous en étiez !

2. **`ConfigurateurTemplateMT5.mq5`** :
   - Script autonome à glisser-déposer sur n'importe quel graphique.
   - Supprime automatiquement TOUS les indicateurs techniques et sous-fenêtres présents sur le graphique.
   - Masque totalement les volumes, grilles et boutons parasites.
   - Configure le style sombre TradeLog (`#131722`), zoom optimal `3`, décalage bord droit `12%`.
   - Sauvegarde automatiquement ce modèle 100% nu sous le nom **`TradeLog.tpl`** dans les templates MetaTrader 5.

3. **`GenerateurCapturesMT5.mq5` (Mode Automatique en Lot)** :
   - Script de traitement automatisé par lot pour ceux qui souhaitent générer tout le dossier d'un coup.

---

## 🚀 Procédure pas-à-pas

### Étape 1 : Installer les scripts dans MetaTrader 5
1. Dans MetaTrader 5, cliquez sur le menu **Fichier** > **Ouvrir le dossier des données** (ou `Ctrl + Shift + D`).
2. Allez dans le dossier **`MQL5\Scripts\`**.
3. Copiez-y les deux fichiers :
   - `ConfigurateurTemplateMT5.mq5`
   - `GenerateurCapturesMT5.mq5`
4. Ouvrez **MetaEditor** (touche `F4`), ouvrez chaque script et cliquez sur **Compiler** (touche `F7`).

---

### Étape 2 : Créer et enregistrer votre Template Standard (100% nu)
1. Ouvrez un graphique sur MetaTrader 5 (ex: `EURUSD`).
2. Dans le panneau de navigation à gauche (`Ctrl + N`), déroulez la section **Scripts**.
3. Faites glisser **`ConfigurateurTemplateMT5`** sur le graphique.
4. Le script nettoie instantanément tout indicateur existant, masque les volumes et enregistre le modèle `TradeLog.tpl`.
5. Une boîte de dialogue confirme l'opération.

---

### Étape 3 : Exporter les trades depuis TradeLog
1. Dans l'application TradeLog, allez dans **Paramètres** (roue crantée).
2. Cliquez sur le bouton **🤖 Exporter JSON MT5** (ou **📊 Exporter CSV** pour analyse complète).
3. Sur votre téléphone ou tablette, le fichier téléchargé se trouve dans votre dossier **Téléchargements** (`Download`).
4. Transférez le fichier `trades_mt5_dataset_AAAA-MM-JJ.json` sur votre PC.
5. Renommez-le en `trades_mt5_dataset.json` (ou gardez son nom et ajustez le paramètre dans le script).
6. Copiez-le dans le dossier **`MQL5\Files\`** de votre MetaTrader 5.

---

## 🎨 Utilisation du Studio Interactif (`TradeLogDatasetStudio.mq5`)

C'est l'outil recommandé pour contrôler manuellement chaque cadrage, timeframe et prise de vue :

1. **Compilation** :
   - Ouvrez **MetaEditor** dans MT5 (touche `F4`).
   - Dans l'arborescence à gauche, ouvrez **Experts** > double-cliquez sur **`TradeLogDatasetStudio.mq5`**.
   - Appuyez sur **`F7`** (ou cliquez sur le bouton vert **Compiler**).
   - Vérifiez en bas : `0 errors, 0 warnings`.
2. **Lancement sur un Graphique** :
   - Revenez sur MT5.
   - Dans le panneau **Navigateur** (`Ctrl + N`), ouvrez **Experts Advisors** (Conseillers Experts).
   - Glissez-déposez **`TradeLogDatasetStudio`** sur votre graphique.
   - Dans la fenêtre de paramètres qui s'affiche :
     - `InpNomFichierJSON` : laissez la valeur par défaut (`trades_mt5_dataset_2026-09-23 (2).json`) ou le nom de votre fichier. Si vous laissez vide, il détecte automatiquement le premier fichier JSON de dataset dans `MQL5/Files`.
     - Cliquez sur **OK**.
3. **Fonctionnalités du HUD (Panneau de Contrôle à l'écran)** :
   - **Compteur & Statut** : affiche le numéro du trade en cours `[Trade X / Y]` et un badge vert `✅ CAPTURÉ` ou orange `⏳ À CAPTURER`.
   - **Détails du trade** : Symbole, Direction (BUY/SELL), Date, TF conseillé, R:R, Prix d'entrée, Stop Loss, Take Profit.
   - **Boutons de Navigation** :
     - `[◀ Précédent]` / `[Suivant ▶]` : change de trade (raccourcis : flèches `Gauche` et `Droite` du clavier).
     - `[⏭ Non Capturé]` : saute directement au prochain trade non encore pris en photo.
   - **Boutons Timeframe en 1 clic** :
     - `[M1]`, `[M5]`, `[M15]`, `[M30]`, `[H1]`, `[H4]`, `[D1]` : change instantanément l'unité de temps du graphique tout en recentrant précisément la bougie du trade.
   - **Outils de Vue** :
     - `[📍 Recadrer la Vue]` : recentre le trade si vous avez fait défiler le graphique manuellement avec la souris.
     - `[📐 Niveaux: VISIBLES / MASQUÉS]` : affiche ou masque d'un clic les lignes Entrée / SL / TP.
   - **Prise de Capture** :
     - Cliquez sur **`[ 📸 PRENDRE LA CAPTURE (ESPACE) ]`** ou appuyez sur la barre **`Espace`** de votre clavier.
     - Le panneau HUD se masque automatiquement pendant une fraction de seconde pour que l'image enregistrée ne contienne que le graphique pur (640x640).
     - L'image est enregistrée dans `MQL5/Files/dataset_ia/tous/` et dans `wins/` ou `losses/`.
     - Le trade est marqué comme capturé, sa position est mémorisée dans `tradelog_progression.txt`, et le studio avance automatiquement au trade suivant !
4. **Reprise de session** :
   - Vous pouvez fermer MT5 à tout moment. En rouvrant le studio plus tard, il rouvrira exactement au dernier trade consulté et se souviendra de tous les trades déjà capturés.
