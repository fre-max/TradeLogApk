import React, { useState } from 'react';
import { useBacktestStore } from '@/store/backtestStore';
import { parseMacroCSV } from '@/lib/fundamentalEngine';

// Exemple de jeu de données de démo pour tester sans fichier externe
const DEMO_MACRO_CSV = `date,asset,event,category,actual,forecast,previous,impact_weight
2024-01-11 13:30:00,USD,CPI YoY,inflation,3.4,3.2,3.1,3
2024-01-25 13:15:00,EUR,ECB Rate Decision,interest_rate,4.50,4.50,4.50,3
2024-02-02 13:30:00,USD,Non Farm Payrolls,employment,353,180,333,3
2024-02-13 13:30:00,USD,CPI YoY,inflation,3.1,2.9,3.4,3
2024-03-07 13:15:00,EUR,ECB Rate Decision,interest_rate,4.50,4.50,4.50,3
2024-03-08 13:30:00,USD,Non Farm Payrolls,employment,275,200,229,3
2024-03-12 12:30:00,USD,CPI YoY,inflation,3.2,3.1,3.1,3
2024-04-10 12:30:00,USD,CPI YoY,inflation,3.5,3.4,3.2,3
2024-04-11 12:15:00,EUR,ECB Rate Decision,interest_rate,4.50,4.50,4.50,3
`;

interface MacroCSVUploaderProps {
  onClose?: () => void;
}

/**
 * Composant Modale/Widget permettant d'importer des événements économiques depuis un fichier CSV
 * ou de charger une banque de données macro de démonstration.
 * 
 * Exemple d'utilisation :
 * <MacroCSVUploader onClose={() => setShowModal(false)} />
 */
export const MacroCSVUploader: React.FC<MacroCSVUploaderProps> = ({ onClose }) => {
  const { setMacroEvents, clearMacroEvents, macroEvents } = useBacktestStore();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Gestion du chargement de fichier CSV local
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const events = parseMacroCSV(text);

        if (events.length === 0) {
          setErrorMessage("Aucun événement valide n'a pu être extrait. Vérifiez l'en-tête du fichier CSV.");
          return;
        }

        setMacroEvents(events);
        setSuccessMessage(`${events.length} événements macroéconomiques importés avec succès !`);
      } catch (err) {
        console.error("❌ Erreur lecture CSV:", err);
        setErrorMessage("Erreur lors de la lecture du fichier CSV.");
      }
    };
    reader.readAsText(file);
  };

  // Chargement rapide des données de démo
  const handleLoadDemo = () => {
    setErrorMessage(null);
    const events = parseMacroCSV(DEMO_MACRO_CSV);
    setMacroEvents(events);
    setSuccessMessage(`${events.length} événements de démo chargés !`);
  };

  return (
    <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl max-w-md w-full text-slate-200">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
        <div className="flex items-center gap-2 font-bold text-sm text-slate-100">
          <span>📊 Importation Données Macro (CSV)</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-xs px-2 py-1 rounded bg-slate-800"
          >
            ✕ Fermer
          </button>
        )}
      </div>

      {/* Explication du format CSV */}
      <div className="text-xs text-slate-400 mb-4 bg-slate-950 p-3 rounded-xl border border-slate-800/80 leading-relaxed">
        <p className="font-semibold text-slate-300 mb-1">Format CSV attendu :</p>
        <code className="text-[10px] text-emerald-400 block font-mono">
          date,asset,event,category,actual,forecast,previous,impact_weight
        </code>
      </div>

      {/* Messages de feedback */}
      {errorMessage && (
        <div className="mb-4 p-2.5 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-300 text-xs">
          ⚠️ {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="mb-4 p-2.5 rounded-lg bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs">
          ✅ {successMessage}
        </div>
      )}

      {/* Actions d'importation */}
      <div className="space-y-3">
        <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-xl cursor-pointer bg-slate-950/50 hover:bg-slate-950 transition-all group">
          <span className="text-sm font-semibold text-slate-300 group-hover:text-emerald-400">
            📁 Choisir un fichier .CSV
          </span>
          <span className="text-[11px] text-slate-500 mt-1">Glisser-déposer ou cliquer pour naviguer</span>
          <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
        </label>

        <div className="flex items-center gap-2">
          <button
            onClick={handleLoadDemo}
            className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold text-xs transition-colors shadow-sm"
          >
            🚀 Charger Données Démo (2024)
          </button>

          {macroEvents.length > 0 && (
            <button
              onClick={() => {
                clearMacroEvents();
                setSuccessMessage("Données réinitialisées.");
              }}
              className="py-2 px-3 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/60 rounded-xl text-xs font-semibold transition-colors"
            >
              🗑️ Vider
            </button>
          )}
        </div>
      </div>

      {/* Statut actuel */}
      <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
        <span>Événements chargés :</span>
        <span className="font-bold text-slate-200">{macroEvents.length}</span>
      </div>
    </div>
  );
};
