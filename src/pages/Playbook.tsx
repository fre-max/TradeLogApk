import { useState } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { useStrategies, useCreateStrategy, useUpdateStrategy, useDeleteStrategy } from '@/hooks/useStrategies'
import type { Strategy } from '@/types'
import { cn } from '@/lib/utils'

export default function Playbook() {
  const { data: strategies = [], isLoading } = useStrategies()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  return (
    <AppLayout title="Playbook Stratégies">
      <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-bg">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-txt">Mon Playbook</h1>
            <p className="text-txt3 text-sm mt-1">
              Définis les règles strictes de tes stratégies. Associe tes trades à une version pour filtrer tes statistiques.
            </p>
          </div>
          <button
            onClick={() => setIsCreating(true)}
            className="px-4 py-2 bg-accent text-white rounded-md text-[13px] font-medium hover:bg-accent/90 transition-colors"
          >
            + Nouvelle Stratégie
          </button>
        </div>

        {isLoading ? (
          <div className="text-txt3 text-sm animate-pulse">Chargement du Playbook...</div>
        ) : (
          <div className="space-y-6">
            {isCreating && (
              <StrategyForm
                onCancel={() => setIsCreating(false)}
                onSuccess={() => setIsCreating(false)}
              />
            )}

            {!isCreating && strategies.length === 0 && (
              <div className="text-center py-12 bg-surface border border-border rounded-lg text-txt3 text-sm">
                Aucune stratégie définie pour le moment. Commence par en créer une !
              </div>
            )}

            {strategies.map((strategy) => (
              <div key={strategy.id}>
                {editingId === strategy.id ? (
                  <StrategyForm
                    strategy={strategy}
                    onCancel={() => setEditingId(null)}
                    onSuccess={() => setEditingId(null)}
                  />
                ) : (
                  <StrategyCard
                    strategy={strategy}
                    onEdit={() => setEditingId(strategy.id)}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}

function StrategyCard({ strategy, onEdit }: { strategy: Strategy; onEdit: () => void }) {
  const { mutate: deleteStrategy, isPending: isDeleting } = useDeleteStrategy()

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <div className="p-4 md:p-5 border-b border-border bg-surface2/30 flex justify-between items-start">
        <div>
          <h2 className="text-lg font-bold text-txt flex items-center gap-2">
            {strategy.name}
            <span className="px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider bg-accent/10 text-accent rounded-md border border-accent/20">
              {strategy.version}
            </span>
          </h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="px-3 py-1.5 text-[12px] font-medium text-txt2 hover:text-txt hover:bg-surface2 rounded-md border border-border transition-colors"
          >
            Modifier
          </button>
          <button
            onClick={() => {
              if (confirm('Voulez-vous vraiment supprimer cette stratégie ?')) {
                deleteStrategy(strategy.id)
              }
            }}
            disabled={isDeleting}
            className="px-3 py-1.5 text-[12px] font-medium text-loss hover:bg-loss/10 rounded-md border border-transparent transition-colors disabled:opacity-50"
          >
            Supprimer
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 md:p-5">
        <RuleSection title="Contexte & Biais" icon="🗺️" content={strategy.context_rules} />
        <RuleSection title="Conditions d'Entrée" icon="⚡" content={strategy.entry_rules} />
        <RuleSection title="Gestion du Risque (SL & TP)" icon="🛡️" content={strategy.risk_rules} />
        <RuleSection title="Gestion du Trade (Breakeven, etc.)" icon="⚖️" content={strategy.management_rules} />
      </div>
    </div>
  )
}

function RuleSection({ title, icon, content }: { title: string; icon: string; content?: string | null }) {
  if (!content) return null

  return (
    <div className="bg-bg border border-border2 rounded-lg p-3.5">
      <h3 className="text-[12px] font-bold text-txt3 uppercase tracking-wider flex items-center gap-1.5 mb-2">
        <span>{icon}</span> {title}
      </h3>
      <p className="text-[13px] text-txt2 whitespace-pre-wrap leading-relaxed">
        {content}
      </p>
    </div>
  )
}

function StrategyForm({ strategy, onCancel, onSuccess }: { strategy?: Strategy; onCancel: () => void; onSuccess: () => void }) {
  const { mutate: createStrategy, isPending: isCreating } = useCreateStrategy()
  const { mutate: updateStrategy, isPending: isUpdating } = useUpdateStrategy()
  const isSaving = isCreating || isUpdating

  const [formData, setFormData] = useState({
    name: strategy?.name || '',
    version: strategy?.version || 'v1.0',
    context_rules: strategy?.context_rules || '',
    entry_rules: strategy?.entry_rules || '',
    risk_rules: strategy?.risk_rules || '',
    management_rules: strategy?.management_rules || '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name || !formData.version) {
      alert('Le nom et la version sont obligatoires')
      return
    }

    if (strategy) {
      updateStrategy({ id: strategy.id, ...formData }, { onSuccess })
    } else {
      createStrategy(formData as any, { onSuccess })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-surface border border-accent/30 rounded-lg p-4 md:p-5 shadow-sm">
      <h2 className="text-[15px] font-bold text-txt mb-4">
        {strategy ? 'Modifier la Stratégie' : 'Nouvelle Stratégie'}
      </h2>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="text-txt3 text-[11px] font-medium uppercase tracking-wider block mb-1">Nom de la stratégie</label>
          <input
            type="text"
            required
            placeholder="ex: SMC Intraday"
            value={formData.name}
            onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
            className="w-full bg-bg border border-border2 rounded-md text-txt px-3 py-2 text-[13.5px] outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="text-txt3 text-[11px] font-medium uppercase tracking-wider block mb-1">Version</label>
          <input
            type="text"
            required
            placeholder="ex: v1.0"
            value={formData.version}
            onChange={(e) => setFormData(p => ({ ...p, version: e.target.value }))}
            className="w-full bg-bg border border-border2 rounded-md text-txt px-3 py-2 text-[13.5px] outline-none focus:border-accent"
          />
        </div>
      </div>

      <div className="space-y-4 mb-6">
        <div>
          <label className="text-txt3 text-[11px] font-medium uppercase tracking-wider block mb-1">🗺️ Contexte & Biais (Paires, Sessions, HTF)</label>
          <textarea
            placeholder="- Uniquement sur EURUSD et GBPUSD&#10;- Session de Londres uniquement&#10;- Biais aligné avec H4"
            value={formData.context_rules}
            onChange={(e) => setFormData(p => ({ ...p, context_rules: e.target.value }))}
            className="w-full bg-bg border border-border2 rounded-md text-txt px-3 py-2 text-[13.5px] outline-none focus:border-accent resize-y min-h-[80px]"
          />
        </div>
        <div>
          <label className="text-txt3 text-[11px] font-medium uppercase tracking-wider block mb-1">⚡ Conditions d'Entrée (Setups obligatoires)</label>
          <textarea
            placeholder="- Attendre prise de liquidité (Sweep)&#10;- CHoCH en M5 obligatoire&#10;- Entrée sur FVG ou OB"
            value={formData.entry_rules}
            onChange={(e) => setFormData(p => ({ ...p, entry_rules: e.target.value }))}
            className="w-full bg-bg border border-border2 rounded-md text-txt px-3 py-2 text-[13.5px] outline-none focus:border-accent resize-y min-h-[80px]"
          />
        </div>
        <div>
          <label className="text-txt3 text-[11px] font-medium uppercase tracking-wider block mb-1">🛡️ Gestion du Risque (SL & R:R)</label>
          <textarea
            placeholder="- Risque par trade: 1% du capital&#10;- SL placé sous le plus bas/haut du sweep + 1 pip&#10;- Minimum R:R cible = 2"
            value={formData.risk_rules}
            onChange={(e) => setFormData(p => ({ ...p, risk_rules: e.target.value }))}
            className="w-full bg-bg border border-border2 rounded-md text-txt px-3 py-2 text-[13.5px] outline-none focus:border-accent resize-y min-h-[80px]"
          />
        </div>
        <div>
          <label className="text-txt3 text-[11px] font-medium uppercase tracking-wider block mb-1">⚖️ Gestion du Trade (Breakeven, Partiels)</label>
          <textarea
            placeholder="- Passage à BE dès que le prix atteint 1R&#10;- Clôture de 50% de la position à 2R&#10;- Laisser courir le reste jusqu'au TP final"
            value={formData.management_rules}
            onChange={(e) => setFormData(p => ({ ...p, management_rules: e.target.value }))}
            className="w-full bg-bg border border-border2 rounded-md text-txt px-3 py-2 text-[13.5px] outline-none focus:border-accent resize-y min-h-[80px]"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-border">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="px-4 py-2 text-[13px] font-medium text-txt2 hover:text-txt hover:bg-surface2 rounded-md border border-border transition-colors disabled:opacity-50"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="px-4 py-2 bg-accent text-white rounded-md text-[13px] font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {isSaving ? 'Enregistrement...' : 'Enregistrer la stratégie'}
        </button>
      </div>
    </form>
  )
}
