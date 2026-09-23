"""
Serveur d'Inférence IA Local (Cerveau Centralisé).

Rôle :
Permet à la fois :
1. À ton application TradeLog (en mode Bar-Replay)
2. À MetaTrader 5 (via un Expert Advisor en live ou backtest)
d'interroger le même modèle IA en direct et d'obtenir les détections de setups.

Lancement :
    python scripts/serveur_ia.py
    (Le serveur écoute sur http://localhost:8000)
"""

import io
import base64
from pathlib import Path
from typing import Optional

# Essaye d'importer FastAPI et Uvicorn
try:
    import uvicorn
    from fastapi import FastAPI, File, UploadFile
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel
    from PIL import Image
except ImportError:
    print("❌ Bibliothèques manquantes pour le serveur IA.")
    print("👉 Installez-les avec la commande suivante :")
    print("   pip install fastapi uvicorn pillow pydantic")
    exit(1)

# Essaye de charger Ultralytics (YOLO)
MODELE_CHARGE = None
try:
    from ultralytics import YOLO
    chemin_poids = Path("best.pt")
    if chemin_poids.exists():
        MODELE_CHARGE = YOLO(str(chemin_poids))
        print("✅ [IA] Modèle YOLO personnalisé 'best.pt' chargé avec succès !")
    else:
        print("💡 [IA] Fichier 'best.pt' non trouvé. Le serveur démarrera en mode simulation (démo).")
except ImportError:
    print("💡 [IA] Ultralytics non installé. Mode simulation actif.")

app = FastAPI(
    title="TradeLog AI Detection Server",
    description="Micro-serveur pour l'inférence temps réel et le backtest des setups de trading",
    version="1.0.0"
)

# ─── Activation du CORS pour autoriser les requêtes de l'App TradeLog ───
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Autorise localhost:5173, etc.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class RequeteBase64(BaseModel):
    image_base64: str


@app.get("/")
def index():
    return {
        "statut": "en_ligne",
        "modele_charge": MODELE_CHARGE is not None,
        "message": "Serveur d'Inférence IA TradeLog prêt pour le Replay et le Live."
    }


def analyser_image_avec_yolo(image_pil: Image.Image):
    """Exécute l'inférence avec YOLO ou retourne une détection simulée si aucun modèle n'est encore entraîné."""
    if MODELE_CHARGE:
        # Exécution réelle avec le modèle YOLO entraîné
        resultats = MODELE_CHARGE(image_pil, conf=0.5)
        detections = []
        for r in resultats:
            for box in r.boxes:
                coords = box.xywhn[0].tolist()  # [x_centre, y_centre, largeur, hauteur] (0..1)
                confiance = float(box.conf[0])
                classe_id = int(box.cls[0])
                nom_classe = "buy_setup" if classe_id == 0 else "sell_setup"

                detections.append({
                    "detecte": True,
                    "classe": nom_classe,
                    "confiance": round(confiance, 3),
                    "boite": {
                        "xCentre": round(coords[0], 4),
                        "yCentre": round(coords[1], 4),
                        "largeur": round(coords[2], 4),
                        "hauteur": round(coords[3], 4),
                    }
                })
        
        if len(detections) > 0:
            return detections[0]

        return {"detecte": False, "message": "Aucun setup détecté avec confiance suffisante."}
    
    # ─── Mode Simulation (si 'best.pt' n'a pas encore été entraîné) ───
    return {
        "detecte": True,
        "classe": "buy_setup",
        "confiance": 0.88,
        "mode": "simulation",
        "boite": {
            "xCentre": 0.70,
            "yCentre": 0.48,
            "largeur": 0.25,
            "hauteur": 0.35,
        },
        "message": "Détection simulée (Placez 'best.pt' dans ce dossier pour activer votre modèle réel)."
    }


@app.post("/detecter")
async def detecter_setup_fichier(file: UploadFile = File(...)):
    """Route appelée avec un fichier image binaire (compatible MT5 WebRequest)."""
    contenu = await file.read()
    image = Image.open(io.BytesIO(contenu)).convert("RGB")
    return analyser_image_avec_yolo(image)


@app.post("/detecter-base64")
async def detecter_setup_base64(data: RequeteBase64):
    """Route appelée avec une image encodée en base64 (idéale pour TradeLog Canvas)."""
    brut = data.image_base64
    if "," in brut:
        brut = brut.split(",")[1]
    
    donnees_binaires = base64.b64decode(brut)
    image = Image.open(io.BytesIO(donnees_binaires)).convert("RGB")
    return analyser_image_avec_yolo(image)


if __name__ == "__main__":
    print("🚀 [TradeLog AI Server] Démarrage du serveur local sur http://localhost:8000 ...")
    uvicorn.run(app, host="0.0.0.0", port=8000)
