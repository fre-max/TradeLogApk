#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
📱 RELAIS AUTOMATIQUE TELEGRAM POUR LE SCANNER SMC FTMO (VPS METATRADER 5)
=============================================================================
Responsabilités :
1. Détecte automatiquement le Chat ID dès que l'utilisateur envoie "/start"
   ou "salut" au bot Telegram (@fredy_smc_ftmo_bot).
2. Surveille le dossier `MQL5/Files/AlertesTelegram/` de MetaTrader 5.
3. Dès qu'une capture d'écran HD (`.png`) + sa fiche (`.txt`) sont générées
   par le Scanner SMC, envoie instantanément la photo + la fiche sur Telegram.
=============================================================================
"""

import os
import time
import json
import glob
import subprocess
import urllib.request
import urllib.parse

TOKEN_TELEGRAM = "9013814792:AAEfxmqtIBkPNYowfjWN6vHx9H3urrhdoLY"
FICHIER_CHAT_IDS = "/root/.smc_telegram_chat_ids.json"
DOSSIERS_SURVEILLES = [
    "/root/.wine/drive_c/Program Files/MetaTrader 5/MQL5/Files/AlertesTelegram",
    "/root/.mt5/drive_c/Program Files/MetaTrader 5/MQL5/Files/AlertesTelegram",
]


def charger_chat_ids():
    """Charge la liste des Chat IDs enregistrés depuis le disque."""
    if os.path.exists(FICHIER_CHAT_IDS):
        try:
            with open(FICHIER_CHAT_IDS, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    return data
        except Exception as e:
            print(f"❌ [Telegram] Erreur lecture Chat IDs: {e}")
    return []


def sauvegarder_chat_ids(liste_ids):
    """Sauvegarde la liste des Chat IDs sur le disque."""
    try:
        with open(FICHIER_CHAT_IDS, "w", encoding="utf-8") as f:
            json.dump(liste_ids, f)
    except Exception as e:
        print(f"❌ [Telegram] Erreur sauvegarde Chat IDs: {e}")


def envoyer_message_texte(chat_id, texte):
    """Envoie un message texte simple sur Telegram."""
    try:
        url = f"https://api.telegram.org/bot{TOKEN_TELEGRAM}/sendMessage"
        payload = urllib.parse.urlencode({"chat_id": str(chat_id), "text": texte}).encode("utf-8")
        req = urllib.request.Request(url, data=payload)
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status == 200
    except Exception as e:
        print(f"❌ [Telegram] Erreur envoi message: {e}")
        return False


def envoyer_photo_telegram(chat_id, chemin_png, legende):
    """Envoie une capture d'écran HD (.png) accompagnée de sa légende via curl."""
    try:
        url = f"https://api.telegram.org/bot{TOKEN_TELEGRAM}/sendPhoto"
        cmd = [
            "curl", "-s", "-X", "POST", url,
            "-F", f"chat_id={chat_id}",
            "-F", f"photo=@{chemin_png}",
            "-F", f"caption={legende[:1020]}"
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        ok = '"ok":true' in res.stdout
        if ok:
            print(f"✅ [Telegram] Capture HD envoyée avec succès à {chat_id} : {os.path.basename(chemin_png)}")
        else:
            print(f"⚠️ [Telegram] Réponse API sendPhoto: {res.stdout}")
        return ok
    except Exception as e:
        print(f"❌ [Telegram] Erreur envoi photo: {e}")
        return False


def verifier_nouveaux_messages_bot(dernier_update_id, chat_ids):
    """Vérifie si l'utilisateur a écrit au bot pour enregistrer son Chat ID automatiquement."""
    try:
        url = f"https://api.telegram.org/bot{TOKEN_TELEGRAM}/getUpdates?offset={dernier_update_id + 1}&timeout=1"
        with urllib.request.urlopen(url, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))

        if not data.get("ok"):
            return dernier_update_id

        for upd in data.get("result", []):
            uid = upd.get("update_id", 0)
            if uid > dernier_update_id:
                dernier_update_id = uid

            msg = upd.get("message") or upd.get("edited_message") or {}
            chat = msg.get("chat") or {}
            cid = chat.get("id")
            texte = (msg.get("text") or "").strip()
            prenom = chat.get("first_name") or "Trader"

            if cid and cid not in chat_ids:
                chat_ids.append(cid)
                sauvegarder_chat_ids(chat_ids)
                print(f"🎉 [Telegram] Nouveau Chat ID enregistré : {cid} ({prenom})")
                bienvenue = (
                    f"✅ Salut {prenom} ! Ton Scanner SMC FTMO (VPS 185.247.118.35) est maintenant relié à ton Telegram (Chat ID : {cid}).\n\n"
                    f"📸 Dès qu'un setup valide ses 3 bougies de confirmation sur MT5 (ou si tu cliques sur le bouton [📸 Test Telegram] sur ton graphique MT5), "
                    f"tu recevras directement ici la capture d'écran HD du graphique avec tout le tracé (Doji, S/R Shved, Collines ⛰️, ZigZag Dynamique, SL et TP) !"
                )
                envoyer_message_texte(cid, bienvenue)
            elif cid and texte.lower() in ("/start", "/status", "salut", "test"):
                envoyer_message_texte(
                    cid,
                    f"📡 Le Relais Telegram SMC FTMO est actif sur ton VPS (Chat ID : {cid}).\n"
                    f"💡 Clique sur le bouton [📸 Test Telegram] en haut à droite du tableau sur ton graphique MT5 pour recevoir une capture d'écran HD immédiatement !"
                )

    except Exception as e:
        pass

    return dernier_update_id


def scanner_captures_mt5(chat_ids):
    """Parcourt le dossier AlertesTelegram de MT5 et envoie toute nouvelle capture HD (.png + .txt)."""
    if not chat_ids:
        return

    for dossier in DOSSIERS_SURVEILLES:
        if not os.path.isdir(dossier):
            continue

        fichiers_txt = sorted(glob.glob(os.path.join(dossier, "*.txt")))
        for chemin_txt in fichiers_txt:
            base = chemin_txt[:-4]
            chemin_png = base + ".png"

            # Attendre jusqu'à 2 secondes si le fichier PNG est encore en train d'être écrit par MT5
            for _ in range(10):
                if os.path.exists(chemin_png) and os.path.getsize(chemin_png) > 1000:
                    break
                time.sleep(0.2)

            try:
                with open(chemin_txt, "r", encoding="utf-8", errors="replace") as f:
                    legende = f.read().strip()
            except Exception:
                legende = "🚨 Nouveau Setup SMC détecté sur MetaTrader 5"

            envoye_au_moins_un = False
            for cid in chat_ids:
                if os.path.exists(chemin_png) and os.path.getsize(chemin_png) > 500:
                    if envoyer_photo_telegram(cid, chemin_png, legende):
                        envoye_au_moins_un = True
                else:
                    if envoyer_message_texte(cid, legende):
                        envoye_au_moins_un = True

            if envoye_au_moins_un:
                try:
                    os.remove(chemin_txt)
                    if os.path.exists(chemin_png):
                        os.remove(chemin_png)
                except Exception as e:
                    print(f"⚠️ [Telegram] Erreur nettoyage fichier: {e}")


def boucle_principale():
    print("🚀 [Telegram SMC] Démarrage du service de relais Telegram + Capture HD...")
    for d in DOSSIERS_SURVEILLES:
        try:
            os.makedirs(d, exist_ok=True)
        except Exception:
            pass

    chat_ids = charger_chat_ids()
    dernier_update_id = 0
    print(f"📋 [Telegram SMC] Chat IDs connus au démarrage : {chat_ids}")

    while True:
        dernier_update_id = verifier_nouveaux_messages_bot(dernier_update_id, chat_ids)
        scanner_captures_mt5(chat_ids)
        time.sleep(1.5)


if __name__ == "__main__":
    boucle_principale()

