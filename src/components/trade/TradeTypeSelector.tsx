import { cn } from '@/lib/utils'

interface TradeTypeSelectorProps {
  onSelect: (type: 'bias' | 'poi' | 'confirmation') => void
}

/**
 * Composant de sélection du point d'entrée pour la création d'un nouveau trade.
 * Affiche 3 cartes cliquables pour Biais, POI ou Entrée.
 *
 * Exemple d'utilisation :
 * <TradeTypeSelector onSelect={(type) => console.log('Type sélectionné:', type)} />
 */
export function TradeTypeSelector({ onSelect }: TradeTypeSelectorProps) {
  const options = [
    {
      key: 'bias' as const,
      title: 'Biais HTF',
      icon: '🧭',
      description: 'Définir un biais sur une unité de temps supérieure (H4/H1)',
      color: 'from-blue-500/10 to-indigo-500/10 border-blue-500/30 hover:border-blue-500 text-blue-500',
    },
    {
      key: 'poi' as const,
      title: 'Zone POI',
      icon: '🎯',
      description: 'Identifier et suivre une zone d’intérêt (POI) planifiée',
      color: 'from-emerald-500/10 to-teal-500/10 border-emerald-500/30 hover:border-emerald-500 text-emerald-500',
    },
    {
      key: 'confirmation' as const,
      title: 'Entrée Directe',
      icon: '⚡',
      description: 'Enregistrer une prise de position avec confirmation LTF (M5/M1)',
      color: 'from-amber-500/10 to-orange-500/10 border-amber-500/30 hover:border-amber-500 text-amber-500',
    },
  ]

  return (
    <div className="flex flex-col items-center justify-center p-6 text-center space-y-6 h-full">
      <div className="space-y-2 animate-fadeIn">
        <h3 className="text-lg font-semibold text-txt">Comment veux-tu commencer ?</h3>
        <p className="text-txt3 text-xs max-w-sm">
          Choisis le point d'entrée pour ton journal. Les autres sections resteront accessibles dans le formulaire.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 w-full max-w-md animate-slideUp">
        {options.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => {
              console.log(`🚀 [TradeTypeSelector] Sélection du type: ${opt.key}`)
              onSelect(opt.key)
            }}
            className={cn(
              "flex items-center gap-4 p-4 rounded-xl border bg-gradient-to-br text-left transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-lg",
              opt.color
            )}
          >
            <span className="text-3xl flex-shrink-0">{opt.icon}</span>
            <div className="flex-1 min-w-0">
              <span className="font-bold text-sm text-txt block mb-0.5">{opt.title}</span>
              <span className="text-xs text-txt3 line-clamp-2 leading-relaxed">{opt.description}</span>
            </div>
            <span className="text-txt3 text-sm font-semibold flex-shrink-0">→</span>
          </button>
        ))}
      </div>
    </div>
  )
}
