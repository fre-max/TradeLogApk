#!/bin/bash
# ============================================================================
# SCRIPT D'INSTALLATION AUTOMATIQUE DE METATRADER 5 SUR UBUNTU 24.04 (XRDP)
# ============================================================================
# Utilisation sur le VPS Ubuntu :
#   wget https://download.mql5.com/cdn/web/metaquotes.software.corp/mt5/mt5ubuntu.sh
#   chmod +x mt5ubuntu.sh
#   sudo ./mt5ubuntu.sh
# ============================================================================

echo "🚀 [MT5 Ubuntu] Démarrage de l'installation officielle MetaTrader 5..."

# 1️⃣ Téléchargement du script officiel de MetaQuotes pour Ubuntu
wget -O /tmp/mt5ubuntu.sh https://download.mql5.com/cdn/web/metaquotes.software.corp/mt5/mt5ubuntu.sh

# 2️⃣ Rendre le script exécutable et lancer l'installation (WineHQ + MT5)
chmod +x /tmp/mt5ubuntu.sh
sudo /tmp/mt5ubuntu.sh

echo "✅ [MT5 Ubuntu] Installation terminée !"

