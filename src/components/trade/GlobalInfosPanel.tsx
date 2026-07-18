import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { FieldGrid, Field, Input, Select, Textarea } from '@/components/ui/FormHelper'
import type { FormDataState } from '@/lib/tradeForm'
import { useStrategies } from '@/hooks/useStrategies'

interface GlobalInfosPanelProps {
  formData: FormDataState
  setFormData: React.Dispatch<React.SetStateAction<FormDataState>>
  onDefaultStatusChange: (isDefault: boolean) => void
}

/**
 * Panel d'informations globales du trade (Paire, Session, Direction, R:R, Résultat, Description).
 * Rétractable et masqué par défaut pour libérer l'espace visuel.
 * Détecte également si les informations restent à leurs valeurs par défaut.
 *
 * Exemple d'utilisation :
 * <GlobalInfosPanel
 *   formData={formData}
 *   setFormData={setFormData}
 *   onDefaultStatusChange={(isDefault) => console.log('Est par défaut ?', isDefault)}
 * />
 */
export function GlobalInfosPanel({
  formData,
  setFormData,
  onDefaultStatusChange,
}: GlobalInfosPanelProps) {
  const [open, setOpen] = useState(false)
  const { data: strategies } = useStrategies()

  // Détection des valeurs par défaut pour déclencher le garde-fou
  useEffect(() => {
    const isDefault =
      formData.pair === 'XAUUSD' &&
      formData.direction === 'long' &&
      formData.session === 'London' &&
      formData.rr_planned === '' &&
      formData.rr_realized === '' &&
      formData.result === 'win'

    onDefaultStatusChange(isDefault)
  }, [
    formData.pair,
    formData.direction,
    formData.session,
    formData.rr_planned,
    formData.rr_realized,
    formData.result,
    onDefaultStatusChange,
  ])

  // Met à jour une clé spécifique dans le state de formulaire
  const updateField = (key: keyof FormDataState, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  // Options pour les boutons de résultats rapides
  const resultOptions = [
    { key: 'win' as const, label: '✓ Win', classes: 'border-win bg-win/10 text-win' },
    { key: 'loss' as const, label: '✗ Loss', classes: 'border-loss bg-loss/10 text-loss' },
    { key: 'breakeven' as const, label: '— BE', classes: 'border-be bg-be/10 text-be' },
    { key: 'missed' as const, label: '🟡 Missed', classes: 'border-[#f5a623] bg-[#f5a623]/10 text-[#f5a623]' },
  ]

  return (
    <div className="border border-border2 rounded-xl overflow-hidden bg-surface mb-4 transition-all">
      {/* ─── Bouton Toggle Header ───────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-surface2 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-[15px]">⚙️</span>
          <span className="text-[13.5px] font-semibold text-txt">Informations Globales du Trade</span>
          <span className="text-[10px] text-txt3 bg-surface2 px-1.5 py-0.5 rounded border border-border2">
            {formData.pair} · {formData.direction.toUpperCase()} · {formData.session}
          </span>
        </div>
        <span className={cn('text-txt3 text-[10px] transition-transform duration-200', open && 'rotate-180')}>
          ▼
        </span>
      </button>

      {/* ─── Contenu Déroulable ─────────────────────────────── */}
      {open && (
        <div className="p-5 bg-bg/40 border-t border-border2 space-y-4 animate-slideDown">
          {/* Grille 1 : Paire, Direction, Date, Session */}
          <FieldGrid>
            <Field label="Paire / Actif">
              <Input
                type="text"
                placeholder="Ex: EURUSD, XAUUSD..."
                value={formData.pair}
                onChange={(e) => updateField('pair', e.target.value.toUpperCase())}
              />
            </Field>
            <Field label="Direction">
              <Select
                value={formData.direction}
                onChange={(e) => updateField('direction', e.target.value as 'long' | 'short')}
              >
                <option value="long">🟢 LONG (Achat)</option>
                <option value="short">🔴 SHORT (Vente)</option>
              </Select>
            </Field>
          </FieldGrid>

          <FieldGrid>
            <Field label="Date du Trade">
              <Input
                type="date"
                value={formData.date_backtested}
                onChange={(e) => updateField('date_backtested', e.target.value)}
              />
            </Field>
            <Field label="Session">
              <Select
                value={formData.session}
                onChange={(e) => updateField('session', e.target.value)}
              >
                {['London', 'New York', 'Asia', 'Overlap', 'Autre'].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </Field>
          </FieldGrid>

          {/* Grille 2 : R:R prévu, R:R réalisé, Stratégie */}
          <FieldGrid>
            <Field label="R:R prévu">
              <Input
                type="number"
                step="0.1"
                placeholder="Ex: 2.5"
                value={formData.rr_planned}
                onChange={(e) => updateField('rr_planned', e.target.value)}
              />
            </Field>
            <Field label="R:R réalisé">
              <Input
                type="number"
                step="0.1"
                placeholder="Ex: 3.2"
                disabled={formData.result === 'missed'}
                value={formData.result === 'missed' ? '0' : formData.rr_realized}
                onChange={(e) => updateField('rr_realized', e.target.value)}
              />
            </Field>
          </FieldGrid>

          <FieldGrid>
            <Field label="Stratégie (Playbook)">
              <Select
                value={formData.strategy_id}
                onChange={(e) => updateField('strategy_id', e.target.value)}
              >
                <option value="">Aucune stratégie</option>
                {strategies?.map((strat) => (
                  <option key={strat.id} value={strat.id}>
                    {strat.name} (v{strat.version})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Émotion / État d'esprit">
              <Input
                type="text"
                placeholder="Ex: Calme, FOMO, Confiant..."
                value={formData.emotion}
                onChange={(e) => updateField('emotion', e.target.value)}
              />
            </Field>
          </FieldGrid>
 
          {/* Section d'Analyse Temporelle (⏱️ Durées) */}
          <div className="pt-3 border-t border-border2/60">
            <span className="text-txt3 text-[10px] font-bold uppercase tracking-wider block mb-2.5">⏱️ Analyse Temporelle (Backtest)</span>
            <FieldGrid>
              <Field label="Délai estimé (heures)">
                <Input
                  type="number"
                  step="any"
                  placeholder="Ex: 4.5"
                  value={formData.duree_estimee_heures}
                  onChange={(e) => updateField('duree_estimee_heures', e.target.value)}
                />
              </Field>
              <Field label="Délai estimé (bougies)">
                <Input
                  type="number"
                  placeholder="Ex: 18"
                  value={formData.duree_estimee_bougies}
                  onChange={(e) => updateField('duree_estimee_bougies', e.target.value)}
                />
              </Field>
              <Field label="Durée réelle (bougies)">
                <Input
                  type="number"
                  placeholder="Ex: 24"
                  value={formData.duree_reelle_bougies}
                  onChange={(e) => updateField('duree_reelle_bougies', e.target.value)}
                />
              </Field>
            </FieldGrid>
          </div>

          {/* Résultat du Trade */}
          <div className="space-y-1.5">
            <label className="text-txt3 text-[11px] font-medium uppercase tracking-wider block">Résultat Global</label>
            <div className="flex gap-2.5">
              {resultOptions.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => {
                    updateField('result', opt.key)
                    if (opt.key === 'missed') {
                      updateField('rr_realized', '0')
                    }
                  }}
                  className={cn(
                    'flex-1 py-2 text-center text-xs font-semibold rounded-lg border transition-all duration-200',
                    formData.result === opt.key ? opt.classes : 'border-border2 bg-bg text-txt2 hover:bg-surface2'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Écart de Missed Trade (uniquement si missed) */}
          {formData.result === 'missed' && (
            <div className="animate-fadeIn">
              <Field label="Écart en pips (si ordre non déclenché)">
                <Input
                  type="number"
                  step="0.1"
                  placeholder="Ex: 1.5 pips"
                  value={formData.missed_gap}
                  onChange={(e) => updateField('missed_gap', e.target.value)}
                />
              </Field>
            </div>
          )}

          {/* Description Globale */}
          <Field label="Description / Notes globales">
            <Textarea
              placeholder="Ajoute des commentaires libres sur le trade (contextes particuliers, gestion de position, etc.)..."
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
            />
          </Field>
        </div>
      )}
    </div>
  )
}
