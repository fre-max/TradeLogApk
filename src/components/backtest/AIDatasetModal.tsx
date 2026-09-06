import React, { useState, useEffect } from 'react';
import type { EchantillonIA } from '@/types/dataset';
import {
  recupererTousLesEchantillons,
  supprimerEchantillon,
  effacerToutLeDataset,
  exporterDatasetEnZip,
  telechargerBlobDansNavigateur,
  formaterLigneYOLO,
} from '@/lib/datasetStorage';

interface AIDatasetModalProps {
  ouvert: boolean;
  onFermer: () => void;
  onNombreChange?: (nb: number) => void;
}

/**
 * Modale de visualisation et de gestion du Dataset d'images pour l'IA.
 * Permet de visualiser les captures Clean et Annotées, de vérifier les boîtes YOLO
 * et de télécharger l'archive ZIP complète pour l'entraînement.
 */
export const AIDatasetModal: React.FC<AIDatasetModalProps> = ({
  ouvert,
  onFermer,
  onNombreChange,
}) => {
  // Liste des échantillons chargés depuis IndexedDB
  const [echantillons, setEchantillons] = useState<EchantillonIA[]>([]);
  const [chargement, setChargement] = useState(true);
  const [exportEnCours, setExportEnCours] = useState(false);
  
  // Filtre actif : 'tous' | 'positif' | 'negatif'
  const [filtreType, setFiltreType] = useState<'tous' | 'positif' | 'negatif'>('tous');
  
  // Vue choisie pour les vignettes : 'clean' (pour l'IA) ou 'annotated' (humain)
  const [vueMode, setVueMode] = useState<'clean' | 'annotated'>('clean');

  // Chargement des échantillons au moment de l'ouverture
  const rafraichirListe = async () => {
    setChargement(true);
    try {
      const data = await recupererTousLesEchantillons();
      setEchantillons(data);
      if (onNombreChange) {
        onNombreChange(data.length);
      }
    } catch (err) {
      console.error('❌ [AIDatasetModal] Impossible de charger les données :', err);
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    if (ouvert) {
      rafraichirListe();
    }
  }, [ouvert]);

  if (!ouvert) return null;

  // Calcul des statistiques
  const nbPositifs = echantillons.filter((e) => e.typeEchantillon === 'positif').length;
  const nbNegatifs = echantillons.filter((e) => e.typeEchantillon === 'negatif').length;

  // Filtrage selon l'onglet sélectionné
  const echantillonsFiltres = echantillons.filter((e) => {
    if (filtreType === 'tous') return true;
    return e.typeEchantillon === filtreType;
  });

  // Action : Supprimer un échantillon
  const handleSupprimer = async (id: string) => {
    if (!window.confirm('Voulez-vous vraiment supprimer cet échantillon du dataset ?')) {
      return;
    }
    try {
      await supprimerEchantillon(id);
      await rafraichirListe();
    } catch (err) {
      console.error('❌ Erreur suppression :', err);
    }
  };

  // Action : Vider tout le dataset
  const handleViderTout = async () => {
    if (!window.confirm('⚠️ ATTENTION : Cela va effacer TOUT votre dataset d\'images IA local. Êtes-vous sûr ?')) {
      return;
    }
    try {
      await effacerToutLeDataset();
      await rafraichirListe();
    } catch (err) {
      console.error('❌ Erreur vidage :', err);
    }
  };

  // Action : Exporter en ZIP
  const handleTelechargerZip = async () => {
    if (echantillons.length === 0) return;
    setExportEnCours(true);
    try {
      console.log('🚀 [AIDatasetModal] Génération de l\'archive ZIP...');
      const blobZip = await exporterDatasetEnZip(echantillons);
      const dateAujourdhui = new Date().toISOString().split('T')[0];
      const nomFichier = `dataset_ia_trading_${dateAujourdhui}.zip`;
      telechargerBlobDansNavigateur(blobZip, nomFichier);
      console.log('✅ [AIDatasetModal] Téléchargement du ZIP lancé !');
    } catch (err) {
      console.error('❌ [AIDatasetModal] Échec de l\'export ZIP :', err);
      alert('Une erreur est survenue lors de la création du fichier ZIP.');
    } finally {
      setExportEnCours(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-[#1e222d] border border-[#2a2e39] text-[#d1d4dc] w-full max-w-5xl max-h-[92vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* ─── En-tête de la Modale ─── */}
        <div className="p-4 border-b border-[#2a2e39] flex flex-wrap items-center justify-between gap-3 bg-[#181b24]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-xl">
              🤖
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Atelier Dataset IA
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-mono">
                  {echantillons.length} images
                </span>
              </h2>
              <p className="text-xs text-[#787b86]">
                Échantillons standardisés prêts pour l'entraînement (YOLOv8 / ViT / PyTorch)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {echantillons.length > 0 && (
              <>
                <button
                  onClick={handleViderTout}
                  className="px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-950/40 border border-rose-900/50 rounded-lg transition-colors"
                  title="Effacer toutes les captures"
                >
                  Vider
                </button>
                <button
                  onClick={handleTelechargerZip}
                  disabled={exportEnCours}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-md flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  {exportEnCours ? (
                    <>
                      <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Génération ZIP...
                    </>
                  ) : (
                    <>
                      <span>📥</span> Exporter (.ZIP)
                    </>
                  )}
                </button>
              </>
            )}
            <button
              onClick={onFermer}
              className="p-1.5 rounded-lg text-[#787b86] hover:text-white hover:bg-[#2a2e39] transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* ─── Barre de Filtres et Commutateur de Vue ─── */}
        <div className="px-4 py-3 border-b border-[#2a2e39] flex flex-wrap items-center justify-between gap-3 bg-[#131722]/50 text-xs">
          {/* Onglets Filtres */}
          <div className="flex items-center gap-1.5 bg-[#181b24] p-1 rounded-lg border border-[#2a2e39]">
            <button
              onClick={() => setFiltreType('tous')}
              className={`px-3 py-1 rounded-md transition-colors ${
                filtreType === 'tous'
                  ? 'bg-indigo-600 text-white font-medium shadow-sm'
                  : 'text-[#787b86] hover:text-[#d1d4dc]'
              }`}
            >
              Tous ({echantillons.length})
            </button>
            <button
              onClick={() => setFiltreType('positif')}
              className={`px-3 py-1 rounded-md transition-colors ${
                filtreType === 'positif'
                  ? 'bg-emerald-600 text-white font-medium shadow-sm'
                  : 'text-[#787b86] hover:text-[#d1d4dc]'
              }`}
            >
              Positifs / Setups ({nbPositifs})
            </button>
            <button
              onClick={() => setFiltreType('negatif')}
              className={`px-3 py-1 rounded-md transition-colors ${
                filtreType === 'negatif'
                  ? 'bg-rose-600 text-white font-medium shadow-sm'
                  : 'text-[#787b86] hover:text-[#d1d4dc]'
              }`}
            >
              Négatifs / Faux signaux ({nbNegatifs})
            </button>
          </div>

          {/* Commutateur Vue Clean vs Annotée */}
          <div className="flex items-center gap-2">
            <span className="text-[#787b86]">Mode affichage :</span>
            <div className="inline-flex p-0.5 rounded-lg bg-[#181b24] border border-[#2a2e39]">
              <button
                onClick={() => setVueMode('clean')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  vueMode === 'clean'
                    ? 'bg-[#2962ff] text-white font-medium'
                    : 'text-[#787b86] hover:text-[#d1d4dc]'
                }`}
                title="Graphique brut sans dessin (ce que reçoit l'IA)"
              >
                Clean (IA)
              </button>
              <button
                onClick={() => setVueMode('annotated')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  vueMode === 'annotated'
                    ? 'bg-[#2962ff] text-white font-medium'
                    : 'text-[#787b86] hover:text-[#d1d4dc]'
                }`}
                title="Graphique avec positions et SL/TP (pour vérification)"
              >
                Annoté (Humain)
              </button>
            </div>
          </div>
        </div>

        {/* ─── Corps de la Galerie ─── */}
        <div className="p-4 flex-1 overflow-y-auto">
          {chargement ? (
            <div className="py-20 text-center text-[#787b86] flex flex-col items-center justify-center gap-3">
              <span className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
              <span>Chargement du dataset local...</span>
            </div>
          ) : echantillonsFiltres.length === 0 ? (
            <div className="py-20 text-center text-[#787b86] flex flex-col items-center justify-center gap-3">
              <div className="text-4xl opacity-50">📂</div>
              <p className="text-sm font-medium text-[#d1d4dc]">
                Aucun échantillon dans cette catégorie
              </p>
              <p className="text-xs max-w-md text-[#787b86]">
                Activez le <strong>Mode IA</strong> dans le graphique de backtest, cadrez votre fenêtre (80 bougies) et cliquez sur <strong>📸 Capturer Setup</strong> ou <strong>🚫 Faux Signal</strong>.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {echantillonsFiltres.map((item, idx) => {
                const imageAffichee =
                  vueMode === 'clean' ? item.imageCleanBase64 : item.imageAnnotatedBase64;
                const estPositif = item.typeEchantillon === 'positif';

                return (
                  <div
                    key={item.id}
                    className="bg-[#181b24] border border-[#2a2e39] rounded-xl overflow-hidden shadow-lg flex flex-col hover:border-[#3b4150] transition-colors"
                  >
                    {/* Zone de prévisualisation de l'image */}
                    <div className="relative aspect-[4/3] bg-black/40 overflow-hidden group">
                      <img
                        src={imageAffichee}
                        alt={`Échantillon ${item.paire}`}
                        className="w-full h-full object-contain"
                      />

                      {/* Badge Type (Positif / Négatif) */}
                      <div className="absolute top-2 left-2 flex items-center gap-1.5">
                        {estPositif ? (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            item.direction === 'long'
                              ? 'bg-emerald-500/90 text-white shadow-sm'
                              : 'bg-rose-500/90 text-white shadow-sm'
                          }`}>
                            {item.direction === 'long' ? '▲ LONG' : '▼ SHORT'}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-700/90 text-slate-200">
                            🚫 NÉGATIF
                          </span>
                        )}
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-black/60 text-slate-300 font-mono">
                          {item.nbBougies}b
                        </span>
                      </div>

                      {/* Bouton de suppression au survol */}
                      <button
                        onClick={() => handleSupprimer(item.id)}
                        className="absolute top-2 right-2 p-1.5 rounded-md bg-rose-600/80 hover:bg-rose-600 text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-md text-xs"
                        title="Supprimer cet échantillon"
                      >
                        🗑️
                      </button>
                    </div>

                    {/* Informations et Métadonnées */}
                    <div className="p-3 flex-1 flex flex-col justify-between text-xs gap-2">
                      <div className="flex items-center justify-between font-semibold text-white">
                        <span className="font-mono text-sm">{item.paire}</span>
                        <span className="text-[#787b86] font-normal">{item.timeframe}</span>
                      </div>

                      <div className="flex items-center justify-between text-[#787b86] text-[11px]">
                        <span>Session : {item.sessionTrading || 'Standard'}</span>
                        {item.ratioRR && <span>R:R 1:{item.ratioRR.toFixed(1)}</span>}
                      </div>

                      {/* Coordonnées YOLO extraites */}
                      {estPositif && item.boundingBoxes.length > 0 && (
                        <div className="mt-1 pt-2 border-t border-[#2a2e39]/60">
                          <div className="text-[10px] text-[#787b86] font-mono flex items-center justify-between">
                            <span>Label YOLO :</span>
                            <span className="text-indigo-400">
                              {formaterLigneYOLO(item.boundingBoxes[0])}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── Pied de page de la modale ─── */}
        <div className="p-3 border-t border-[#2a2e39] bg-[#181b24] flex items-center justify-between text-xs text-[#787b86]">
          <span>
            Stockage local persistant (IndexedDB). Les images ne dépendent d'aucune connexion.
          </span>
          <button
            onClick={onFermer}
            className="px-4 py-1.5 bg-[#2a2e39] hover:bg-[#3b4150] text-[#d1d4dc] rounded-lg transition-colors"
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
};
