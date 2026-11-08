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
from PIL import Image, ImageDraw


def generer_graphique_tradingview(fichier_sortie, symbole, periode, direction, prix_entree, prix_sl, prix_tp, bougies):
    """
    Génère un graphique en chandeliers pur style TradingView (Dark Theme) avec Pillow.
    Affiche les bougies vertes/rouges et les niveaux horizontaux Entrée (Bleu), SL (Rouge), TP (Vert).
    """
    largeur = 1280
    hauteur = 720

    # Couleurs TradingView Dark
    COULEUR_FOND = (19, 23, 34)       # #131722
    COULEUR_GRILLE = (30, 34, 45)     # #1e222d
    COULEUR_HAUSSE = (8, 153, 129)    # #089981 (Vert TradingView)
    COULEUR_BAISSE = (242, 54, 69)    # #f23645 (Rouge TradingView)
    COULEUR_ENTREE = (41, 98, 255)    # #2962ff (Bleu TradingView)
    COULEUR_TEXTE = (209, 212, 220)   # #d1d4dc
    COULEUR_BLANC = (255, 255, 255)

    img = Image.new("RGB", (largeur, hauteur), COULEUR_FOND)
    draw = ImageDraw.Draw(img)

    marge_gauche = 40
    marge_droite = 110
    marge_haut = 60
    marge_bas = 50

    zone_largeur = largeur - marge_gauche - marge_droite
    zone_hauteur = hauteur - marge_haut - marge_bas

    tous_les_prix = [prix_entree, prix_sl, prix_tp]
    for b in bougies:
        tous_les_prix.append(float(b.get('high', 0.0)))
        tous_les_prix.append(float(b.get('low', 0.0)))

    prix_min = min(tous_les_prix)
    prix_max = max(tous_les_prix)
    delta_prix = max(prix_max - prix_min, 0.0001)
    prix_min -= delta_prix * 0.06
    prix_max += delta_prix * 0.06
    delta_prix = prix_max - prix_min

    def prix_vers_y(p):
        return int(marge_haut + (prix_max - p) / delta_prix * zone_hauteur)

    # Grille horizontale
    for i in range(5):
        y_grid = int(marge_haut + (i / 4.0) * zone_hauteur)
        draw.line([(marge_gauche, y_grid), (largeur - marge_droite, y_grid)], fill=COULEUR_GRILLE, width=1)
        p_val = prix_max - (i / 4.0) * delta_prix
        draw.text((largeur - marge_droite + 10, y_grid - 6), f"{p_val:.4f}", fill=COULEUR_TEXTE)

    # Bougies japonaises pures
    nb_bougies = len(bougies)
    if nb_bougies > 0:
        largeur_colonne = zone_largeur / nb_bougies
        largeur_corps = max(3, int(largeur_colonne * 0.70))

        for i, b in enumerate(bougies):
            centre_x = int(marge_gauche + (i + 0.5) * largeur_colonne)
            y_open = prix_vers_y(float(b.get('open', 0.0)))
            y_close = prix_vers_y(float(b.get('close', 0.0)))
            y_high = prix_vers_y(float(b.get('high', 0.0)))
            y_low = prix_vers_y(float(b.get('low', 0.0)))

            est_haussiere = float(b.get('close', 0.0)) >= float(b.get('open', 0.0))
            couleur = COULEUR_HAUSSE if est_haussiere else COULEUR_BAISSE

            # Mèches
            draw.line([(centre_x, y_high), (centre_x, y_low)], fill=couleur, width=1)

            # Corps
            y_haut_corps = min(y_open, y_close)
            y_bas_corps = max(y_open, y_close)
            if y_bas_corps == y_haut_corps:
                y_bas_corps += 1

            x1 = centre_x - (largeur_corps // 2)
            x2 = centre_x + (largeur_corps // 2)
            draw.rectangle([x1, y_haut_corps, x2, y_bas_corps], fill=couleur, outline=couleur)

    # Lignes des niveaux Entrée, SL, TP
    def tracer_niveau(prix, couleur, texte):
        y = prix_vers_y(prix)
        if marge_haut <= y <= (hauteur - marge_bas):
            for x in range(marge_gauche, largeur - marge_droite, 8):
                draw.line([(x, y), (min(x + 4, largeur - marge_droite), y)], fill=couleur, width=2)
            draw.rectangle([largeur - marge_droite + 2, y - 9, largeur - 5, y + 9], fill=couleur)
            draw.text((largeur - marge_droite + 6, y - 6), f"{texte} {prix:.4f}", fill=COULEUR_BLANC)

    tracer_niveau(prix_entree, COULEUR_ENTREE, "ENTRÉE")
    tracer_niveau(prix_sl, COULEUR_BAISSE, "SL")
    tracer_niveau(prix_tp, COULEUR_HAUSSE, "TP")

    # En-tête
    sens_txt = "🟢 ACHAT (Spring)" if "ACHAT" in direction.upper() else "🔴 VENTE (UTAD)"
    draw.text((marge_gauche, 18), f"{symbole} • {periode} • TradingView Style SMC", fill=COULEUR_BLANC)
    draw.text((marge_gauche + 360, 18), f"Signal : {sens_txt}", fill=COULEUR_HAUSSE if "ACHAT" in direction.upper() else COULEUR_BAISSE)

    img.save(fichier_sortie, "PNG")

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
            chemin_json = base + ".json"

            # Si le PNG n'existe pas encore mais qu'un JSON avec les bougies est présent : générer le graphique TradingView HD
            if (not os.path.exists(chemin_png) or os.path.getsize(chemin_png) < 100) and os.path.exists(chemin_json):
                try:
                    with open(chemin_json, "r", encoding="utf-8") as jf:
                        cfg = json.load(jf)
                    generer_graphique_tradingview(
                        chemin_png,
                        cfg.get("symbole", "SMC"),
                        cfg.get("periode", ""),
                        cfg.get("direction", "ACHAT"),
                        float(cfg.get("entree", 0.0)),
                        float(cfg.get("sl", 0.0)),
                        float(cfg.get("tp", 0.0)),
                        cfg.get("bougies", [])
                    )
                except Exception as ej:
                    print(f"⚠️ [Telegram] Erreur génération TradingView: {ej}")

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
                    if os.path.exists(chemin_json):
                        os.remove(chemin_json)
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

