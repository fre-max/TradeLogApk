# 🚀 Guide d'Installation : Scanner SMC sur cTrader Cloud (0 € de VPS)

Ce guide vous explique pas à pas comment installer votre **Scanner Multi-Paires SMC** sur **cTrader** et l'activer sur le **Cloud cTrader gratuit 24h/24**, sans avoir besoin de laisser votre ordinateur allumé ni de payer un VPS.

---

## 📋 Prérequis

1. Avoir un compte de démonstration ou réel cTrader :
   - **FTMO** : Lors de la création d'un compte démo ou challenge sur FTMO, choisissez la plateforme **cTrader**.
   - **IC Markets** : Sur votre espace client IC Markets, créez un compte démo avec la plateforme **cTrader**.
2. Avoir téléchargé **cTrader Desktop** (ou simplement utiliser la version Web sur [app.ctrader.com](https://app.ctrader.com)).

---

## 🛠️ Étape 1 : Ouvrir l'espace de programmation « Automate »

1. Lancez **cTrader** sur votre PC (ou ouvrez [app.ctrader.com](https://app.ctrader.com) dans votre navigateur).
2. Connectez-vous avec votre **cTrader ID** et sélectionnez votre compte (ex: FTMO Démo ou IC Markets Démo).
3. Dans la barre latérale tout à gauche, cliquez sur l'icône **« Automate »** (représentée par un robot ou des engrenages `⚙️`).

---

## 📝 Étape 2 : Créer le nouveau robot (cBot)

1. En haut à gauche de la section Automate, cliquez sur le bouton vert **`+ Nouveau cBot`** (ou `+ New cBot`).
2. Nommez votre robot :  
   `ScannerMultiPairesSMC`
3. Un éditeur de code s'affiche au centre. **Supprimez tout le texte exemple** qui s'y trouve déjà.
4. Ouvrez le fichier suivant sur votre ordinateur :  
   `c:\Dev\JournalMobileAPK\ctrader_orchestrateur_smc\ScannerMultiPairesSMC_cBot.cs`
5. **Copiez tout son contenu (Ctrl + A puis Ctrl + C)** et collez-le directement dans l'éditeur cTrader (Ctrl + V).

---

## 🔨 Étape 3 : Compiler le cBot (Build)

1. En haut de l'éditeur cTrader, cliquez sur le bouton **`Build`** (ou raccourci clavier `F6` ou `Ctrl + B`).
2. Dans le panneau de sortie en bas, vous devez voir :  
   `Build Succeeded (0 Errors, 0 Warnings)` ✅

---

## ⚙️ Étape 4 : Ajouter une instance et vérifier les paramètres

1. Dans la liste de gauche, cliquez sur le petit `+` à côté de **ScannerMultiPairesSMC** pour ajouter une instance.
2. Choisissez n'importe quel graphique de base (par exemple `EURUSD, h1`).
3. Dans le panneau des paramètres à droite, vérifiez :
   - **Jeton Bot Telegram** : `9013814792:AAEfxmqtIBkPNYowfjWN6vHx9H3urrhdoLY`
   - **Chat ID Telegram** : `626484487`
   - **Activer les alertes Telegram** : `true`
   - **Envoyer le graphique TradingView** : `true`
   - **Timeframes** : M15, M30, H1, H4 cochés selon vos préférences.

---

## ☁️ Étape 5 : Lancer dans le Cloud cTrader (0 € de VPS !)

C'est ici la magie de cTrader :

1. À côté du nom de votre instance, vous avez le bouton **`Play` (Démarrer)**.
2. Pour qu'il tourne sans votre PC :
   - Faites un clic droit sur l'instance ou cliquez sur les trois petits points `...`.
   - Cliquez sur **`Exécuter dans le Cloud`** (ou **`Run on Cloud`**).
3. Une petite icône de nuage `☁️` verte apparaît à côté de votre robot.
4. **Vérification immédiate** :
   - Vous recevrez instantanément une notification Telegram de bienvenue sur votre téléphone :
     `🟢 [cTrader SMC LIVE] Scanner Multi-Paires Activé !`
   - Le scanner analyse désormais toutes les paires 24h/24 et 7j/7.
   - **Vous pouvez fermer cTrader et éteindre votre ordinateur**, le scanner continue de tourner sur les serveurs de cTrader gratuitement !

---

## 📦 Rappel : Vos deux versions restent sauvegardées

Vos deux versions sont conservées dans le projet pour parer à toute éventualité :

| Plateforme | Emplacement des fichiers | Type d'hébergement |
| :--- | :--- | :--- |
| **MetaTrader 5 (MT5)** | `c:\Dev\JournalMobileAPK\mt5_orchestrateur_smc\` | VPS Windows (ou Ubuntu Wine) |
| **cTrader** | `c:\Dev\JournalMobileAPK\ctrader_orchestrateur_smc\` | Cloud cTrader Gratuit (0 €) |

