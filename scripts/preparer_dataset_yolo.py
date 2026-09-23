"""
Script de préparation et structuration du Dataset YOLO pour l'entraînement IA.

Rôle :
1. Lit le fichier d'export JSON des trades généré par TradeLog.
2. Associe les images capturées depuis MetaTrader 5 (dans MQL5/Files/dataset_ia).
3. Génère les fichiers d'annotations YOLO (.txt) pour chaque image.
4. Répartit les données en Train (80%) et Validation (20%).
5. Génère le fichier de configuration standard dataset.yaml pour YOLOv8 / YOLO11.

Exemple d'utilisation :
python scripts/preparer_dataset_yolo.py --json trades_mt5_dataset_2026-09-23.json --images C:/Chemin/MQL5/Files/dataset_ia/tous
"""

import os
import sys
import json
import shutil
import random
import argparse
from pathlib import Path


def charger_donnees_json(chemin_fichier_json: str) -> list:
    """Charge le fichier JSON des trades exporté depuis TradeLog."""
    try:
        with open(chemin_fichier_json, "r", encoding="utf-8") as f:
            trades = json.load(f)
        print(f"📖 [JSON] {len(trades)} trades chargés avec succès depuis '{chemin_fichier_json}'.")
        return trades
    except Exception as e:
        print(f"❌ Erreur lors de la lecture du fichier JSON : {e}")
        sys.exit(1)


def creer_arborescence_yolo(dossier_racine: Path):
    """Crée les dossiers standards nécessaires pour l'entraînement YOLO."""
    for split in ["train", "val"]:
        (dossier_racine / "images" / split).mkdir(parents=True, exist_ok=True)
        (dossier_racine / "labels" / split).mkdir(parents=True, exist_ok=True)
    print("📁 Arborescence standard YOLO créée : dataset/images et dataset/labels.")


def generer_dataset(chemin_json: str, dossier_images_mt5: str, dossier_destination: str = "dataset_yolo"):
    """
    Parcourt les images MT5, calcule les labels YOLO et organise le dataset.
    """
    trades = charger_donnees_json(chemin_json)
    source_images = Path(dossier_images_mt5)
    dest = Path(dossier_destination)
    
    if not source_images.exists():
        print(f"❌ Le dossier d'images MT5 '{source_images}' est introuvable.")
        print("💡 Assurez-vous d'avoir exécuté le script 'GenerateurCapturesMT5.mq5' dans MetaTrader 5 au préalable.")
        return

    creer_arborescence_yolo(dest)

    # Dictionnaire d'accès rapide aux trades par ID
    trades_par_id = {t["id"]: t for t in trades}

    # Liste des images PNG disponibles
    images_trouvees = list(source_images.glob("*.png"))
    print(f"🖼️ [Images MT5] {len(images_trouvees)} images trouvées dans le dossier source.")

    if len(images_trouvees) == 0:
        print("⚠️ Aucune image PNG trouvée à traiter.")
        return

    # Mélange aléatoire pour la répartition train/val
    random.seed(42)
    random.shuffle(images_trouvees)

    nb_total = len(images_trouvees)
    nb_train = int(nb_total * 0.8)  # 80% train, 20% validation

    succes = 0

    for index, chemin_img in enumerate(images_trouvees):
        split = "train" if index < nb_train else "val"
        nom_base = chemin_img.stem

        # Recherche du trade correspondant via son ID dans le nom de l'image
        trade_associe = None
        for trade_id, t in trades_par_id.items():
            if trade_id in nom_base:
                trade_associe = t
                break

        # 1️⃣ Copie de l'image dans le dossier YOLO correspondant
        dest_image = dest / "images" / split / chemin_img.name
        shutil.copy2(chemin_img, dest_image)

        # 2️⃣ Génération du fichier d'annotations YOLO (.txt)
        dest_label = dest / "labels" / split / f"{nom_base}.txt"
        
        # Détermination de la classe :
        # 0 = Setup BUY (Long), 1 = Setup SELL (Short)
        classe_id = 0
        if trade_associe:
            classe_id = 0 if trade_associe.get("direction") == "BUY" else 1

        # Position de la boîte YOLO normalisée (centre_x, centre_y, largeur, hauteur)
        # Par défaut : le setup est cadré sur le dernier tiers droit de l'image
        x_centre = 0.70
        y_centre = 0.50
        largeur = 0.35
        hauteur = 0.45

        # Écriture de la ligne standard YOLO
        ligne_yolo = f"{classe_id} {x_centre:.4f} {y_centre:.4f} {largeur:.4f} {hauteur:.4f}\n"

        with open(dest_label, "w", encoding="utf-8") as f_label:
            f_label.write(ligne_yolo)

        succes += 1

    # 3️⃣ Création du fichier dataset.yaml
    chemin_yaml = dest / "dataset.yaml"
    contenu_yaml = f"""# Configuration Dataset IA de Trading - Générée par TradeLog
path: {dest.resolve().as_posix()}
train: images/train
val: images/val

# Classes de détection
names:
  0: buy_setup
  1: sell_setup
"""
    with open(chemin_yaml, "w", encoding="utf-8") as f_yaml:
        f_yaml.write(contenu_yaml)

    print("\n" + "=" * 60)
    print(f"🎉 Dataset YOLO prêt avec succès !")
    print(f"📊 Total images : {succes} ({nb_train} train / {succes - nb_train} val)")
    print(f"📄 Fichier de config : {chemin_yaml}")
    print("\n🚀 Pour lancer l'entraînement avec YOLO :")
    print(f"   yolo detect train data={chemin_yaml} model=yolov8n.pt epochs=50 imgsz=640")
    print("=" * 60)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Prépare le dataset YOLO à partir des captures MT5.")
    parser.add_argument("--json", type=str, default="trades_mt5_dataset.json", help="Chemin du fichier JSON exporté")
    parser.add_argument("--images", type=str, default="dataset_ia/tous", help="Dossier contenant les images générées par MT5")
    parser.add_argument("--output", type=str, default="dataset_yolo", help="Dossier de sortie du dataset final")

    args = parser.parse_args()
    generer_dataset(args.json, args.images, args.output)
