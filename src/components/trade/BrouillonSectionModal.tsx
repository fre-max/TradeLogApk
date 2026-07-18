import { useState, useEffect } from 'react'
import { useBrouillonStore } from '@/store/brouillonStore'
import type { SectionType, BrouillonBiais, BrouillonPoi, BrouillonEntry, BrouillonResult } from '@/store/brouillonStore'
import { ComboField } from '@/components/fields/ComboField'
import { TradeImageManager } from './TradeImageManager'
import { cn } from '@/lib/utils'
import type { TradeImage } from '@/types'

// Labels affichés dans le sélecteur de section
const SECTIONS_LABELS: Record<SectionType, string> = {
  images: '🖼️ Images',
  biais: '📊 Biais',
  poi: '📍 POI / Zone',
  entry: '🎯 Entrée',
  result: '📈 Résultat & Review',
}

/**
 * Modal d'édition d'une section de brouillon.
 * Affiché quand l'utilisateur clique sur "Éditer Biais", "Éditer POI", etc.
 * dans le BrouillonPanel.
 *
 * Les formulaires sont identiques aux StepBlock du TradeDrawer.
 */
export function BrouillonSectionModal() {
  const { modalOuvert, slotActif, sectionActive, fermerModal, sauvegarderSection, brouillons } = useBrouillonStore()

  // État local du formulaire pour la section en cours d'édition
  const [sectionSelectionnee, setSectionSelectionnee] = useState<SectionType>('biais')

  // Données du formulaire Biais
  const [biais, setBiais] = useState<BrouillonBiais>({
    biais_timeframe: 'H4',
    biais_direction: 'Haussier',
    biais_reasons: '',
  })

  // Données du formulaire POI
  const [poi, setPoi] = useState<BrouillonPoi>({
    poi_timeframe: 'H1',
    poi_type: 'Order Block',
    poi_confluences: '',
  })

  // Données du formulaire Entrée
  const [entry, setEntry] = useState<BrouillonEntry>({
    entry_timeframe: 'M5',
    entry_setup: '',
    entry_price: '',
    entry_sl: '',
    entry_tp: '',
    entry_trailing: '',
    entry_reasons: '',
  })

  // Données du formulaire Résultat
  const [result, setResult] = useState<BrouillonResult>({
    result: '',
    rr_planned: '',
    rr_realized: '',
    exit_type: 'tp',
    emotion: '',
    review_good: '',
    review_bad: '',
  })

  // Données du formulaire Images
  const [images, setImages] = useState<Partial<TradeImage>[]>([])

  // Quand le modal s'ouvre, on charge les données existantes du brouillon
  useEffect(() => {
    if (!modalOuvert || !slotActif) return

    const brouillon = brouillons[slotActif - 1]
    setSectionSelectionnee(sectionActive ?? 'biais')

    // Pré-remplir chaque section avec ce qui est déjà dans le brouillon
    if (brouillon.sections.biais) setBiais(brouillon.sections.biais)
    if (brouillon.sections.poi) setPoi(brouillon.sections.poi)
    if (brouillon.sections.entry) setEntry(brouillon.sections.entry)
    if (brouillon.sections.result) setResult(brouillon.sections.result)
    if (brouillon.sections.images) setImages(brouillon.sections.images)
    else setImages([])
  }, [modalOuvert, slotActif, sectionActive, brouillons])

  // Sauvegarde la section active dans le brouillon et ferme le modal
  const handleSauvegarder = () => {
    if (!slotActif) return

    if (sectionSelectionnee === 'biais') sauvegarderSection(slotActif, 'biais', biais)
    if (sectionSelectionnee === 'poi') sauvegarderSection(slotActif, 'poi', poi)
    if (sectionSelectionnee === 'entry') sauvegarderSection(slotActif, 'entry', entry)
    if (sectionSelectionnee === 'result') sauvegarderSection(slotActif, 'result', result)
    if (sectionSelectionnee === 'images') sauvegarderSection(slotActif, 'images', images)

    fermerModal()
  }

  if (!modalOuvert || !slotActif) return null

  return (
    // Overlay sombre derrière le modal
    <div
      className="fixed inset-0 bg-black/70 z-[200] flex items-end sm:items-center justify-center"
      onClick={fermerModal}
    >
      {/* Contenu du modal — stoppe la propagation du clic */}
      <div
        className="bg-surface border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-[520px] max-h-[90vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div>
            <h3 className="text-txt font-semibold text-[15px]">
              Brouillon {slotActif}
            </h3>
            <p className="text-txt3 text-[12px]">Remplir une section</p>
          </div>
          <button
            onClick={fermerModal}
            className="text-txt3 hover:text-txt text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Sélecteur de section (onglets) */}
        <div className="flex gap-1 px-4 pt-4 pb-3 border-b border-border flex-shrink-0 overflow-x-auto">
          {(Object.keys(SECTIONS_LABELS) as SectionType[]).map((section) => (
            <button
              key={section}
              type="button"
              onClick={() => setSectionSelectionnee(section)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap transition-all',
                sectionSelectionnee === section
                  ? 'bg-accent text-white'
                  : 'bg-surface2 text-txt3 hover:text-txt hover:bg-surface2/80'
              )}
            >
              {SECTIONS_LABELS[section]}
            </button>
          ))}
        </div>

        {/* Corps du formulaire — scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
          {sectionSelectionnee === 'images' && (
            <TradeImageManager images={images} onChange={setImages} />
          )}
          {sectionSelectionnee === 'biais' && (
            <FormulaireBiais data={biais} onChange={setBiais} />
          )}
          {sectionSelectionnee === 'poi' && (
            <FormulairePoi data={poi} onChange={setPoi} />
          )}
          {sectionSelectionnee === 'entry' && (
            <FormulaireEntry data={entry} onChange={setEntry} />
          )}
          {sectionSelectionnee === 'result' && (
            <FormulaireResult data={result} onChange={setResult} />
          )}
        </div>

        {/* Pied du modal — bouton de sauvegarde */}
        <div className="flex gap-2 px-5 py-4 border-t border-border flex-shrink-0">
          <button
            type="button"
            onClick={fermerModal}
            className="flex-1 px-4 py-2.5 border border-border2 rounded-lg text-txt2 text-[13px] font-medium hover:bg-surface2 hover:text-txt transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSauvegarder}
            className="flex-1 px-4 py-2.5 bg-accent text-white rounded-lg text-[13px] font-medium hover:bg-accent/90 transition-colors"
          >
            💾 Sauvegarder
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Sous-composants réutilisables ────────────────────────────────────────────

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-txt3 text-[11px] font-medium uppercase tracking-wider">{label}</label>
      {children}
    </div>
  )
}

function Grille({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>
}

function SelectChamp({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-bg border border-border2 rounded-md text-txt px-3 py-2 text-[13px] outline-none focus:border-accent"
    >
      {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
    </select>
  )
}

function InputChamp(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full bg-bg border border-border2 rounded-md text-txt px-3 py-2 text-[13px] outline-none focus:border-accent"
    />
  )
}

function TextareaChamp(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="w-full bg-bg border border-border2 rounded-md text-txt px-3 py-2 text-[13px] outline-none focus:border-accent resize-y min-h-[64px]"
    />
  )
}

// ─── Formulaire Biais ─────────────────────────────────────────────────────────

function FormulaireBiais({ data, onChange }: { data: BrouillonBiais; onChange: (d: BrouillonBiais) => void }) {
  // Met à jour un seul champ sans perdre les autres
  const maj = (champ: keyof BrouillonBiais, valeur: string) => onChange({ ...data, [champ]: valeur })

  return (
    <>
      <Grille>
        <Champ label="Timeframe d'analyse">
          <SelectChamp value={data.biais_timeframe} onChange={(v) => maj('biais_timeframe', v)} options={['W1','D1','H4','H1','M30','M15']} />
        </Champ>
        <Champ label="Direction du biais">
          <SelectChamp value={data.biais_direction} onChange={(v) => maj('biais_direction', v)} options={['Haussier','Baissier','Neutre / Range']} />
        </Champ>
      </Grille>
      <Champ label="Raisons du biais">
        <ComboField
          fieldKey="brouillon_biais_reasons"
          placeholder="Ex: BOS haussier H4, liquidités prises..."
          presets={['BOS haussier sur H4','CHoCH baissier confirmé','Liquidités basses prises','Prix au-dessus EQ H4']}
          value={data.biais_reasons}
          onChange={(v) => maj('biais_reasons', v)}
        />
      </Champ>
    </>
  )
}

// ─── Formulaire POI ───────────────────────────────────────────────────────────

function FormulairePoi({ data, onChange }: { data: BrouillonPoi; onChange: (d: BrouillonPoi) => void }) {
  const maj = (champ: keyof BrouillonPoi, valeur: string) => onChange({ ...data, [champ]: valeur })

  return (
    <>
      <Grille>
        <Champ label="Timeframe du POI">
          <SelectChamp value={data.poi_timeframe} onChange={(v) => maj('poi_timeframe', v)} options={['H4','H1','M30','M15','M5','M1']} />
        </Champ>
        <Champ label="Type de zone">
          <SelectChamp value={data.poi_type} onChange={(v) => maj('poi_type', v)} options={['Order Block','FVG','S&R','Liquidity','EQ / Equilibrium','Autre...']} />
        </Champ>
      </Grille>
      <Champ label="Confluences">
        <ComboField
          fieldKey="brouillon_poi_confluences"
          placeholder="Ex: OB aligné avec 50% du swing..."
          presets={['OB aligné avec 50% du dernier swing','FVG en dessous comme support','Zone premium / discount']}
          value={data.poi_confluences}
          onChange={(v) => maj('poi_confluences', v)}
        />
      </Champ>
    </>
  )
}

// ─── Formulaire Entrée ────────────────────────────────────────────────────────

function FormulaireEntry({ data, onChange }: { data: BrouillonEntry; onChange: (d: BrouillonEntry) => void }) {
  const maj = (champ: keyof BrouillonEntry, valeur: string) => onChange({ ...data, [champ]: valeur })

  return (
    <>
      <Grille>
        <Champ label="Timeframe">
          <SelectChamp value={data.entry_timeframe} onChange={(v) => maj('entry_timeframe', v)} options={['M15','M5','M1','M30','H1']} />
        </Champ>
        <Champ label="Setup / Pattern">
          <ComboField
            fieldKey="brouillon_entry_setup"
            placeholder="Ex: CHoCH, OB M5..."
            presets={['BOS','CHoCH','Order Block','FVG','Liquidity grab','EMA confluence']}
            value={data.entry_setup}
            onChange={(v) => maj('entry_setup', v)}
          />
        </Champ>
        <Champ label="Prix d'entrée">
          <InputChamp type="number" step="0.00001" placeholder="0.00000" value={data.entry_price} onChange={(e) => maj('entry_price', e.target.value)} />
        </Champ>
        <Champ label="Stop Loss">
          <InputChamp type="number" step="0.00001" placeholder="0.00000" value={data.entry_sl} onChange={(e) => maj('entry_sl', e.target.value)} />
        </Champ>
        <Champ label="Take Profit">
          <InputChamp type="number" step="0.00001" placeholder="0.00000" value={data.entry_tp} onChange={(e) => maj('entry_tp', e.target.value)} />
        </Champ>
        <Champ label="Trailing Stop">
          <InputChamp type="text" placeholder="ex: 20 pips" value={data.entry_trailing} onChange={(e) => maj('entry_trailing', e.target.value)} />
        </Champ>
      </Grille>
      <Champ label="Raisons de l'entrée">
        <ComboField
          fieldKey="brouillon_entry_reasons"
          placeholder="Ex: CHoCH M5 sur le POI..."
          presets={["CHoCH M5 confirmé sur le POI","Bougie englobante haussière","Retest du bris de structure","Confluences multiples alignées"]}
          value={data.entry_reasons}
          onChange={(v) => maj('entry_reasons', v)}
        />
      </Champ>
    </>
  )
}

// ─── Formulaire Résultat ──────────────────────────────────────────────────────

function FormulaireResult({ data, onChange }: { data: BrouillonResult; onChange: (d: BrouillonResult) => void }) {
  const maj = (champ: keyof BrouillonResult, valeur: string) => onChange({ ...data, [champ]: valeur })

  const boutons: { key: 'win' | 'loss' | 'breakeven'; label: string }[] = [
    { key: 'win', label: '✓ Win' },
    { key: 'loss', label: '✗ Loss' },
    { key: 'breakeven', label: '— Breakeven' },
  ]

  const couleurs = {
    win: 'border-win bg-win/10 text-win',
    loss: 'border-loss bg-loss/10 text-loss',
    breakeven: 'border-be bg-be/10 text-be',
  }

  return (
    <>
      <Champ label="Résultat">
        <div className="flex gap-2">
          {boutons.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => maj('result', key)}
              className={cn(
                'flex-1 py-2 rounded-md border-[1.5px] text-[12px] font-medium transition-all',
                data.result === key ? couleurs[key] : 'border-border2 bg-bg text-txt3'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </Champ>
      <Grille>
        <Champ label="R:R prévu">
          <InputChamp type="number" step="0.1" placeholder="2.0" value={data.rr_planned} onChange={(e) => maj('rr_planned', e.target.value)} />
        </Champ>
        <Champ label="R:R réalisé">
          <InputChamp type="number" step="0.1" placeholder="0.0" value={data.rr_realized} onChange={(e) => maj('rr_realized', e.target.value)} />
        </Champ>
        <Champ label="Sortie via">
          <SelectChamp value={data.exit_type} onChange={(v) => maj('exit_type', v)} options={['tp','sl','breakeven','trailing','manual']} />
        </Champ>
        <Champ label="État émotionnel">
          <SelectChamp value={data.emotion} onChange={(v) => maj('emotion', v)} options={['','Discipliné','Confiant','FOMO','Impatient','Revenge','Hésitant','Neutre','Focalisé']} />
        </Champ>
      </Grille>
      <Champ label="Ce que j'ai bien fait">
        <TextareaChamp placeholder="..." value={data.review_good} onChange={(e) => maj('review_good', e.target.value)} />
      </Champ>
      <Champ label="À améliorer">
        <TextareaChamp placeholder="..." value={data.review_bad} onChange={(e) => maj('review_bad', e.target.value)} />
      </Champ>
    </>
  )
}
