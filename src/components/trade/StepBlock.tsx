import { useState } from 'react'
import { cn } from '@/lib/utils'
import { ComboField } from '@/components/fields/ComboField'
import { CatalogReasonSelector } from '@/components/fields/CatalogReasonSelector'
import type { FormDataState } from '@/lib/tradeForm'
import { useBrouillonStore } from '@/store/brouillonStore'
import type { Brouillon } from '@/store/brouillonStore'
import { ImageField } from '@/components/fields/ImageField'
import { supabase } from '@/lib/supabase'
import { useStrategies } from '@/hooks/useStrategies'
import { TradeReasonsAccordions } from './TradeReasonsAccordions'
import type { SelectedTradeReason } from '@/hooks/useTradeReasons'

type StepType = 'general' | 'biais' | 'poi' | 'entry' | 'result' | 'custom' | 'reasons'

interface StepBlockProps {
  number: number
  title: string
  type: StepType
  defaultOpen?: boolean
  formData: FormDataState
  setFormData: React.Dispatch<React.SetStateAction<FormDataState>>
  tradeId?: string
  stepId?: string
  // IDs simples pour la compatibilité (calculé à partir de selectedReasons)
  selectedReasonIds?: string[]
  setSelectedReasonIds?: React.Dispatch<React.SetStateAction<string[]>>
  // Objets complets avec variantes (nouvelle fonctionnalité)
  selectedReasons?: SelectedTradeReason[]
  setSelectedReasons?: React.Dispatch<React.SetStateAction<SelectedTradeReason[]>>
  tradeImages?: any[]
}

/**
 * Bloc accordéon représentant une étape de la configuration du trade.
 * Il affiche les formulaires adaptés au type de l'étape et modifie l'état partagé.
 * 
 * Exemple d'utilisation :
 * <StepBlock
 *   number={1}
 *   title="Infos générales"
 *   type="general"
 *   formData={formData}
 *   setFormData={setFormData}
 * />
 */
export function StepBlock({
  number,
  title,
  type,
  defaultOpen = false,
  formData,
  setFormData,
  tradeId,
  stepId,
  selectedReasonIds = [],
  setSelectedReasonIds,
  selectedReasons,
  setSelectedReasons,
  tradeImages = [],
}: StepBlockProps) {
  const [open, setOpen] = useState(defaultOpen)

  // ─── Récupère les brouillons depuis le store pour le bouton d'import ────────
  const brouillons = useBrouillonStore((state) => state.brouillons)
  const [showImportMenu, setShowImportMenu] = useState(false)

  // Clé du tableau d'images dans formData pour cette étape (ex: biais_images)
  const imagesKey = `${type}_images` as const
  const stepImages = (formData as any)[imagesKey] || []

  // Récupère toutes les images présentes dans les autres étapes de ce trade pour pouvoir les réutiliser
  const toutesLesEtapes = ['biais', 'poi', 'entry', 'result']
  const autresImagesDuTrade = toutesLesEtapes
    .filter((t) => t !== type)
    .flatMap((t) => (formData as any)[`${t}_images`] || [])
    // Filtrer pour éviter les doublons d'URL et ne pas proposer les images déjà associées à ce step
    .filter((img: any, idx: number, self: any[]) => 
      self.findIndex((i) => i.url === img.url) === idx &&
      !stepImages.some((stepImg: any) => stepImg.url === img.url)
    )

  // Ajoute une image à l'étape actuelle pour une phase donnée
  const handleAddImage = (phase: 'avant' | 'apres', url: string) => {
    const nouvelleImage = {
      id: crypto.randomUUID(),
      url,
      source: url.includes('telegram') ? ('telegram' as const) : ('upload' as const),
      phase,
    }
    setFormData((prev: any) => ({
      ...prev,
      [imagesKey]: [...(prev[imagesKey] || []), nouvelleImage],
    }))
  }

  // Supprime une image de l'étape actuelle
  const handleRemoveImage = (id: string) => {
    setFormData((prev: any) => ({
      ...prev,
      [imagesKey]: (prev[imagesKey] || []).filter((img: any) => img.id !== id),
    }))
  }

  // Détermine quels brouillons ont des données pour la section courante
  // Exemple : pour type='biais', on cherche les brouillons avec sections.biais rempli
  const brouillonsDisponibles = brouillons.filter((b: Brouillon) => {
    if (type === 'biais') return Boolean(b.sections.biais)
    if (type === 'poi') return Boolean(b.sections.poi)
    if (type === 'entry') return Boolean(b.sections.entry)
    return false
  })

  // Injecte les données du brouillon sélectionné dans le formulaire principal, y compris ses images associées
  const importerDepuisBrouillon = (brouillon: Brouillon) => {
    const imagesDuBrouillon = brouillon.sections.images || []

    if (type === 'biais' && brouillon.sections.biais) {
      const { biais_timeframe, biais_direction, biais_reasons } = brouillon.sections.biais
      const imagesFiltrees = imagesDuBrouillon
        .filter(img => img.context === 'superieur')
        .map(img => ({
          id: img.id || crypto.randomUUID(),
          url: img.url || '',
          source: img.source || 'upload',
          phase: img.phase || 'avant'
        }))
      setFormData((prev: any) => ({
        ...prev,
        biais_timeframe,
        biais_direction,
        biais_reasons,
        biais_images: [...(prev.biais_images || []), ...imagesFiltrees]
      }))
    }
    if (type === 'poi' && brouillon.sections.poi) {
      const { poi_timeframe, poi_type, poi_confluences } = brouillon.sections.poi
      const imagesFiltrees = imagesDuBrouillon
        .filter(img => img.context === 'intermediaire')
        .map(img => ({
          id: img.id || crypto.randomUUID(),
          url: img.url || '',
          source: img.source || 'upload',
          phase: img.phase || 'avant'
        }))
      setFormData((prev: any) => ({
        ...prev,
        poi_timeframe,
        poi_type,
        poi_confluences,
        poi_images: [...(prev.poi_images || []), ...imagesFiltrees]
      }))
    }
    if (type === 'entry' && brouillon.sections.entry) {
      const { entry_timeframe, entry_setup, entry_price, entry_sl, entry_tp, entry_trailing, entry_reasons } = brouillon.sections.entry
      const imagesFiltrees = imagesDuBrouillon
        .filter(img => img.context === 'inferieur')
        .map(img => ({
          id: img.id || crypto.randomUUID(),
          url: img.url || '',
          source: img.source || 'upload',
          phase: img.phase || 'avant'
        }))
      setFormData((prev: any) => ({
        ...prev,
        entry_timeframe,
        entry_setup,
        entry_price,
        entry_sl,
        entry_tp,
        entry_trailing,
        entry_reasons,
        entry_images: [...(prev.entry_images || []), ...imagesFiltrees]
      }))
    }
    setShowImportMenu(false)
  }

  // Les sections qui supportent l'import de brouillon
  const sectionAvecImport = type === 'biais' || type === 'poi' || type === 'entry'

  return (
    <div className="border-b border-border">
      {/* En-tête cliquable pour ouvrir/fermer l'étape */}
      <div className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-3 flex-1 text-left"
        >
          <div className={cn(
            'w-[22px] h-[22px] rounded-full border-[1.5px] flex items-center justify-center text-[11px] font-semibold flex-shrink-0 transition-all',
            open ? 'border-accent bg-accent text-white' : 'border-border2 text-txt3'
          )}>
            {number}
          </div>
          <span className="text-txt text-[13.5px] font-medium flex-1">{title}</span>
          <span className={cn('text-txt3 text-[11px] transition-transform', open && 'rotate-90')}>▶</span>
        </button>

        {/* Bouton d'import depuis brouillon — visible uniquement si des données existent */}
        {sectionAvecImport && brouillonsDisponibles.length > 0 && (
          <div className="relative flex-shrink-0">
            <button
              type="button"
              onClick={() => setShowImportMenu((v) => !v)}
              title="Importer depuis un brouillon"
              className="text-[11px] px-2 py-1 bg-[#7c3aed]/10 text-[#7c3aed] border border-[#7c3aed]/25 rounded-md hover:bg-[#7c3aed]/20 transition-colors font-medium"
            >
              💾 Importer
            </button>

            {/* Dropdown des brouillons disponibles */}
            {showImportMenu && (
              <>
                {/* Overlay transparent pour fermer en cliquant ailleurs */}
                <div className="fixed inset-0 z-[5]" onClick={() => setShowImportMenu(false)} />
                <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-xl z-[10] min-w-[160px] overflow-hidden">
                  <p className="text-txt3 text-[10px] px-3 py-1.5 border-b border-border uppercase tracking-wider">Choisir un brouillon</p>
                  {brouillonsDisponibles.map((brouillon: Brouillon) => (
                    <button
                      key={brouillon.id}
                      type="button"
                      onClick={() => importerDepuisBrouillon(brouillon)}
                      className="w-full text-left px-3 py-2 text-[12.5px] text-txt hover:bg-accent/8 transition-colors flex items-center gap-2"
                    >
                      <span className="w-5 h-5 rounded-full bg-[#7c3aed]/15 text-[#7c3aed] flex items-center justify-center text-[10px] font-bold">{brouillon.id}</span>
                      Brouillon {brouillon.id}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Contenu de l'étape affiché si ouvert */}
      {open && (
        <div className="px-5 pb-5 pl-[54px]">
          {type === 'general' && <GeneralFields formData={formData} setFormData={setFormData} />}
          {type === 'biais' && (
            <BiaisFields
              formData={formData}
              setFormData={setFormData}
              tradeId={tradeId}
              stepId={stepId}
              images={stepImages}
              onAddImage={handleAddImage}
              onRemoveImage={handleRemoveImage}
              imagesReutilisables={autresImagesDuTrade}
            />
          )}
          {type === 'poi' && (
            <PoiFields
              formData={formData}
              setFormData={setFormData}
              tradeId={tradeId}
              stepId={stepId}
              images={stepImages}
              onAddImage={handleAddImage}
              onRemoveImage={handleRemoveImage}
              imagesReutilisables={autresImagesDuTrade}
            />
          )}
          {type === 'entry' && (
            <EntryFields
              formData={formData}
              setFormData={setFormData}
              tradeId={tradeId}
              stepId={stepId}
              images={stepImages}
              onAddImage={handleAddImage}
              onRemoveImage={handleRemoveImage}
              imagesReutilisables={autresImagesDuTrade}
            />
          )}
          {type === 'reasons' && (setSelectedReasonIds || setSelectedReasons) && (
            <TradeReasonsAccordions
              selectedReasonIds={selectedReasonIds}
              onChange={(ids) => setSelectedReasonIds?.(ids)}
              selectedReasons={selectedReasons}
              onChangeReasons={setSelectedReasons}
            />
          )}
          {type === 'result' && (
            <ResultFields
              formData={formData}
              setFormData={setFormData}
              tradeId={tradeId}
              stepId={stepId}
              images={stepImages}
              onAddImage={handleAddImage}
              onRemoveImage={handleRemoveImage}
              imagesReutilisables={autresImagesDuTrade}
            />
          )}
        </div>
      )}
    </div>
  )
}

interface SubFieldProps {
  formData: FormDataState
  setFormData: React.Dispatch<React.SetStateAction<FormDataState>>
  tradeId?: string
  stepId?: string
  images: any[]
  onAddImage: (phase: 'avant' | 'apres', url: string) => void
  onRemoveImage: (id: string) => void
  imagesReutilisables?: any[]
}

interface StepImageSectionProps {
  title: string
  phase: 'avant' | 'apres'
  tradeId: string
  stepId: string
  images: any[]
  onAddImage: (phase: 'avant' | 'apres', url: string) => void
  onRemoveImage: (id: string) => void
  imagesReutilisables?: any[]
}

// Composant réutilisable pour afficher la galerie miniature d'images de l'étape et uploader via ImageField
function StepImageSection({
  title,
  phase,
  tradeId,
  stepId,
  images,
  onAddImage,
  onRemoveImage,
  imagesReutilisables,
}: StepImageSectionProps) {
  const imagesFiltrees = images.filter((img) => img.phase === phase)

  return (
    <div className="mt-3 p-3 bg-bg/30 border border-border2 rounded-lg space-y-3">
      <h4 className="text-[11.5px] font-semibold text-txt2 uppercase tracking-wider">{title}</h4>
      
      {/* Galerie d'images miniatures */}
      {imagesFiltrees.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {imagesFiltrees.map((img) => (
            <div key={img.id} className="relative group aspect-video rounded-md overflow-hidden border border-border bg-surface2">
              <img src={img.url} className="w-full h-full object-cover" alt="Step capture" loading="lazy" />
              <button
                type="button"
                onClick={() => onRemoveImage(img.id)}
                className="absolute top-1.5 right-1.5 bg-loss text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold hover:scale-110 shadow-md transition-transform"
                title="Supprimer la capture"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload/Saisie d'images */}
      {tradeId && stepId ? (
        <div className="space-y-3.5">
          <ImageField
            tradeId={tradeId}
            stepId={stepId}
            onUpload={(url) => onAddImage(phase, url)}
          />

          {/* Section de réutilisation des captures existantes du trade */}
          {imagesReutilisables && imagesReutilisables.length > 0 && (
            <div className="pt-2 border-t border-border/20">
              <p className="text-[10px] text-txt3 font-semibold uppercase tracking-wider mb-1.5">
                🔗 Réutiliser une capture existante de ce trade :
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-border">
                {imagesReutilisables.map((img) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => onAddImage(phase, img.url)}
                    className="relative w-[70px] aspect-video rounded border border-border2 overflow-hidden hover:border-accent hover:scale-105 transition-all flex-shrink-0 bg-surface"
                    title="Cliquer pour lier cette capture existante à cette phase"
                  >
                    <img src={img.url} className="w-full h-full object-cover" alt="Existante" loading="lazy" />
                    <div className="absolute inset-0 bg-black/45 hover:bg-black/15 transition-colors flex items-center justify-center">
                      <span className="text-[11px] text-white font-bold">＋</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-txt3 text-[11px] italic text-center py-2">Enregistre d'abord le trade pour ajouter des images.</p>
      )}
    </div>
  )
}

// ─── COMPOSANTS REUTILISABLES POUR LES CHAMPS ────────────────

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 mb-3">{children}</div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-txt3 text-[11px] font-medium uppercase tracking-wider">{label}</label>
      {children}
    </div>
  )
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full bg-bg border border-border2 rounded-md text-txt px-3 py-2 text-[13.5px] outline-none focus:border-accent"
    />
  )
}

function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="w-full bg-bg border border-border2 rounded-md text-txt px-3 py-2 text-[13.5px] outline-none focus:border-accent"
    >
      {children}
    </select>
  )
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="w-full bg-bg border border-border2 rounded-md text-txt px-3 py-2 text-[13.5px] outline-none focus:border-accent resize-y min-h-[72px]"
    />
  )
}

// ─── FORMULAIRES D'ÉTAPES SPÉCIFIQUES ────────────────────────

// Met à jour une propriété spécifique du store de formulaire global
// Exemple d'utilisation : updateField('pair', 'EURUSD')
const createFieldUpdater = (setFormData: React.Dispatch<React.SetStateAction<FormDataState>>) => 
  (key: keyof FormDataState, val: any) => {
    setFormData((prev) => ({ ...prev, [key]: val }))
  }

// Étape 1 : Informations générales du trade (Paire, date, session, heure, type de journal)
function GeneralFields({ formData, setFormData }: { formData: FormDataState; setFormData: React.Dispatch<React.SetStateAction<FormDataState>> }) {
  const updateField = createFieldUpdater(setFormData)
  const isBiais = formData.journal_type === 'bias'
  const { data: strategies = [] } = useStrategies()
  const [showChecklist, setShowChecklist] = useState(false)

  const selectedStrategy = strategies.find(s => s.id === formData.strategy_id)

  return (
    <>
      {/* Modale Checklist Stratégie */}
      {showChecklist && selectedStrategy && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50" onClick={() => setShowChecklist(false)}>
          <div className="bg-surface border border-border rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border bg-surface2 flex items-center justify-between">
              <h3 className="font-bold text-txt">
                Checklist : {selectedStrategy.name} <span className="text-accent text-[11px] uppercase ml-2">{selectedStrategy.version}</span>
              </h3>
              <button onClick={() => setShowChecklist(false)} className="text-txt3 hover:text-txt">✕</button>
            </div>
            <div className="p-5 overflow-y-auto space-y-4 bg-bg text-[13px] text-txt2 leading-relaxed">
              {selectedStrategy.context_rules && (
                <div>
                  <strong className="text-txt text-xs uppercase block mb-1">🗺️ Contexte & Biais</strong>
                  <p className="whitespace-pre-wrap">{selectedStrategy.context_rules}</p>
                </div>
              )}
              {selectedStrategy.entry_rules && (
                <div>
                  <strong className="text-txt text-xs uppercase block mb-1">⚡ Conditions d'Entrée</strong>
                  <p className="whitespace-pre-wrap">{selectedStrategy.entry_rules}</p>
                </div>
              )}
              {selectedStrategy.risk_rules && (
                <div>
                  <strong className="text-txt text-xs uppercase block mb-1">🛡️ Gestion du Risque</strong>
                  <p className="whitespace-pre-wrap">{selectedStrategy.risk_rules}</p>
                </div>
              )}
              {selectedStrategy.management_rules && (
                <div>
                  <strong className="text-txt text-xs uppercase block mb-1">⚖️ Gestion du Trade</strong>
                  <p className="whitespace-pre-wrap">{selectedStrategy.management_rules}</p>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-border flex justify-end">
              <button onClick={() => setShowChecklist(false)} className="px-4 py-2 bg-accent text-white rounded-md text-[13px] font-medium">J'ai compris</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <Field label="Type de Journal">

          <Select
            value={formData.journal_type}
            onChange={(e) => updateField('journal_type', e.target.value as any)}
          >
            <option value="global">📋 Global</option>
            <option value="bias">🎯 Biais</option>
            <option value="poi">🗺️ POI / Zones</option>
            <option value="confirmation">⚡ Confirmation</option>
          </Select>
        </Field>
        
        <Field label="Version de la Stratégie">
          <div className="flex gap-2">
            <Select
              value={formData.strategy_id}
              onChange={(e) => updateField('strategy_id', e.target.value)}
            >
              <option value="">Aucune stratégie</option>
              {strategies.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.version})</option>
              ))}
            </Select>
            {formData.strategy_id && (
              <button
                type="button"
                onClick={() => setShowChecklist(true)}
                className="flex-shrink-0 px-3 py-2 bg-accent/10 text-accent border border-accent/20 rounded-md text-[12px] font-medium hover:bg-accent/20 transition-colors"
                title="Voir la checklist"
              >
                📋 Règles
              </button>
            )}
          </div>
        </Field>
      </div>

      <FieldGrid>
        <Field label="Paire">
          <Select
            value={formData.pair}
            onChange={(e) => updateField('pair', e.target.value)}
          >
            {['XAUUSD','EURUSD','GBPUSD','NAS100','US30','BTCUSD'].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
            <option value="Autre">Autre...</option>
          </Select>
        </Field>
        <Field label="Date backtestée">
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
            {['Asian','London','NY','London/NY'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </Field>
        <Field label={isBiais ? "Début validité Biais" : "Heure d'entrée"}>
          <Input
            type="time"
            value={formData.entry_time}
            onChange={(e) => updateField('entry_time', e.target.value)}
          />
        </Field>
        {isBiais && (
          <Field label="Fin validité Biais">
            <Input
              type="time"
              value={formData.exit_time}
              onChange={(e) => updateField('exit_time', e.target.value)}
            />
          </Field>
        )}
      </FieldGrid>
      
      <Field label={isBiais ? "Biais (Direction)" : "Direction"}>
        <div className="flex rounded-md overflow-hidden border border-border2">
          {(['long', 'short'] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => updateField('direction', d)}
              className={cn(
                'flex-1 py-2 text-[13px] font-medium transition-colors',
                formData.direction === d && d === 'long' && 'bg-accent/10 text-accent',
                formData.direction === d && d === 'short' && 'bg-[#f08a4f]/10 text-[#f08a4f]',
                formData.direction !== d && 'bg-bg text-txt3'
              )}
            >
              {d === 'long' ? '↑ Long (Acheteur)' : '↓ Short (Vendeur)'}
            </button>
          ))}
        </div>
      </Field>
    </>
  )
}

// Étape 2 : Analyse du Biais (Direction du biais, Timeframe d'analyse, Raisons)
function BiaisFields({
  formData,
  setFormData,
  tradeId,
  stepId,
  images,
  onAddImage,
  onRemoveImage,
  imagesReutilisables,
}: SubFieldProps) {
  const updateField = createFieldUpdater(setFormData)

  return (
    <div className="space-y-4">
      {/* 🟢 AVANT LA POSITION */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-accent uppercase tracking-wider">🟢 Analyse Initiale (Avant position)</h3>
        <FieldGrid>
          <Field label="Timeframe d'analyse">
            <Select
              value={formData.biais_timeframe}
              onChange={(e) => updateField('biais_timeframe', e.target.value)}
            >
              {['W1','D1','H4','H1','M30','M15'].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
          </Field>
          <Field label="Direction du biais">
            <Select
              value={formData.biais_direction}
              onChange={(e) => updateField('biais_direction', e.target.value)}
            >
              {['Haussier','Baissier','Neutre / Range'].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
          </Field>
        </FieldGrid>
        <div className="mb-3">
          <Field label="Raisons du biais">
            <ComboField
              fieldKey="biais_reasons"
              placeholder="Ex: BOS haussier H4, liquidités prises..."
              presets={['BOS haussier sur H4','CHoCH baissier confirmé','Liquidités basses prises','Prix au-dessus EQ H4']}
              value={formData.biais_reasons}
              onChange={(val) => updateField('biais_reasons', val)}
            />
          </Field>
        </div>
        <div className="mb-3">
          <Field label="Concepts du Catalogue (Biais)">
            <CatalogReasonSelector
              contextType={['biais', 'confirmation']}
              value={formData.biais_catalog_reasons}
              onChange={(val) => updateField('biais_catalog_reasons', val)}
            />
          </Field>
        </div>
        <StepImageSection
          title="Capture d'Analyse (Avant)"
          phase="avant"
          tradeId={tradeId || ''}
          stepId={stepId || ''}
          images={images}
          onAddImage={onAddImage}
          onRemoveImage={onRemoveImage}
          imagesReutilisables={imagesReutilisables}
        />
      </div>

      {/* 🔄 APRÈS LA POSITION */}
      <div className="pt-4 border-t border-border/40 space-y-3">
        <h3 className="text-xs font-semibold text-txt uppercase tracking-wider">🔄 Déroulement Réel (Après position)</h3>
        {formData.journal_type === 'bias' && (
          <div className="mb-3">
            <label className="text-txt3 text-[11px] font-medium uppercase tracking-wider block mb-1.5">Le Biais s'est-il réalisé ?</label>
            <div className="flex gap-2">
              {[
                { key: 'win', label: '✓ Oui (Correct)' },
                { key: 'loss', label: '✗ Non (Incorrect)' },
                { key: 'breakeven', label: '— Invalide / BE' }
              ].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => updateField('result', key)}
                  className={cn(
                    'flex-1 py-1.5 rounded-md border text-[12px] font-medium transition-all',
                    formData.result === key 
                      ? (key === 'win' ? 'border-win bg-win/10 text-win' : key === 'loss' ? 'border-loss bg-loss/10 text-loss' : 'border-be bg-be/10 text-be')
                      : 'border-border2 bg-bg text-txt3'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
        <StepImageSection
          title="Capture de Déroulement (Après)"
          phase="apres"
          tradeId={tradeId || ''}
          stepId={stepId || ''}
          images={images}
          onAddImage={onAddImage}
          onRemoveImage={onRemoveImage}
          imagesReutilisables={imagesReutilisables}
        />
      </div>
    </div>
  )
}

// Étape 3 : Point d'intérêt / Zone (Type de zone, Timeframe, Confluences)
function PoiFields({
  formData,
  setFormData,
  tradeId,
  stepId,
  images,
  onAddImage,
  onRemoveImage,
  imagesReutilisables,
}: SubFieldProps) {
  const updateField = createFieldUpdater(setFormData)

  return (
    <div className="space-y-4">
      {/* 🟢 AVANT LA POSITION */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-accent uppercase tracking-wider">🟢 Zone Planifiée (Avant position)</h3>
        <FieldGrid>
          <Field label="Timeframe du POI">
            <Select
              value={formData.poi_timeframe}
              onChange={(e) => updateField('poi_timeframe', e.target.value)}
            >
              {['H4','H1','M30','M15','M5','M1'].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
          </Field>
          <Field label="Type de zone">
            <Select
              value={formData.poi_type}
              onChange={(e) => updateField('poi_type', e.target.value)}
            >
              {['Order Block','FVG','S&R','Liquidity','EQ / Equilibrium','Autre...'].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
          </Field>
        </FieldGrid>
        <div className="mb-3">
          <Field label="Confluences">
            <ComboField
              fieldKey="poi_confluences"
              placeholder="Ex: OB aligné avec 50% du swing..."
              presets={['OB aligné avec 50% du dernier swing','FVG en dessous comme support','Zone premium / discount']}
              value={formData.poi_confluences}
              onChange={(val) => updateField('poi_confluences', val)}
            />
          </Field>
        </div>
        <div className="mb-3">
          <Field label="Concepts du Catalogue (POI)">
            <CatalogReasonSelector
              contextType="poi"
              value={formData.poi_catalog_reasons}
              onChange={(val) => updateField('poi_catalog_reasons', val)}
            />
          </Field>
        </div>
        <StepImageSection
          title="Capture du POI Planifié (Avant)"
          phase="avant"
          tradeId={tradeId || ''}
          stepId={stepId || ''}
          images={images}
          onAddImage={onAddImage}
          onRemoveImage={onRemoveImage}
          imagesReutilisables={imagesReutilisables}
        />
      </div>

      {/* 🔄 APRÈS LA POSITION */}
      <div className="pt-4 border-t border-border/40 space-y-3">
        <h3 className="text-xs font-semibold text-txt uppercase tracking-wider">🔄 Déroulement Réel (Après position)</h3>
        {formData.journal_type === 'poi' && (
          <div className="mb-3">
            <label className="text-txt3 text-[11px] font-medium uppercase tracking-wider block mb-1.5">Réaction sur la zone ?</label>
            <div className="flex gap-2">
              {[
                { key: 'win', label: '✓ Réagi (Zone respectée)' },
                { key: 'loss', label: '✗ Cassé (Zone traversée)' },
                { key: 'breakeven', label: '— Non atteint' }
              ].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => updateField('result', key)}
                  className={cn(
                    'flex-1 py-1.5 rounded-md border text-[12px] font-medium transition-all',
                    formData.result === key 
                      ? (key === 'win' ? 'border-win bg-win/10 text-win' : key === 'loss' ? 'border-loss bg-loss/10 text-loss' : 'border-be bg-be/10 text-be')
                      : 'border-border2 bg-bg text-txt3'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
        <StepImageSection
          title="Capture de Réaction (Après)"
          phase="apres"
          tradeId={tradeId || ''}
          stepId={stepId || ''}
          images={images}
          onAddImage={onAddImage}
          onRemoveImage={onRemoveImage}
          imagesReutilisables={imagesReutilisables}
        />
      </div>
    </div>
  )
}

// Étape 4 : Détails d'Entrée sur le marché (SL, TP, Setup, Prix, Trailing, Sortie)
function EntryFields({
  formData,
  setFormData,
  tradeId,
  stepId,
  images,
  onAddImage,
  onRemoveImage,
  imagesReutilisables,
}: SubFieldProps) {
  const updateField = createFieldUpdater(setFormData)

  return (
    <div className="space-y-4">
      {/* 🟢 AVANT LA POSITION */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-accent uppercase tracking-wider">🟢 Planification d'Ordre (Avant position)</h3>
        <FieldGrid>
          <Field label="Timeframe">
            <Select
              value={formData.entry_timeframe}
              onChange={(e) => updateField('entry_timeframe', e.target.value)}
            >
              {['M15','M5','M1','M30','H1'].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
          </Field>
          <Field label="Setup / Pattern">
            <ComboField
              fieldKey="entry_setup"
              placeholder="Ex: CHoCH, OB M5..."
              presets={['BOS','CHoCH','Order Block','FVG','Liquidity grab','EMA confluence']}
              value={formData.entry_setup}
              onChange={(val) => updateField('entry_setup', val)}
            />
          </Field>
          <Field label="Prix d'entrée">
            <Input
              type="number"
              step="0.00001"
              placeholder="0.00000"
              value={formData.entry_price}
              onChange={(e) => updateField('entry_price', e.target.value)}
            />
          </Field>
          <Field label="Stop Loss">
            <Input
              type="number"
              step="0.00001"
              placeholder="0.00000"
              value={formData.entry_sl}
              onChange={(e) => updateField('entry_sl', e.target.value)}
            />
          </Field>
          <Field label="Take Profit">
            <Input
              type="number"
              step="0.00001"
              placeholder="0.00000"
              value={formData.entry_tp}
              onChange={(e) => updateField('entry_tp', e.target.value)}
            />
          </Field>
          <Field label="Trailing Stop">
            <Input
              type="text"
              placeholder="ex: 20 pips"
              value={formData.entry_trailing}
              onChange={(e) => updateField('entry_trailing', e.target.value)}
            />
          </Field>
          <Field label="R:R prévu">
            <Input
              type="number"
              step="0.1"
              placeholder="2.0"
              value={formData.rr_planned}
              onChange={(e) => updateField('rr_planned', e.target.value)}
            />
          </Field>
          <Field label="Sortie via">
            <Select
              value={formData.exit_type}
              onChange={(e) => updateField('exit_type', e.target.value as any)}
            >
              {[
                { key: 'tp', label: 'TP atteint' },
                { key: 'sl', label: 'SL atteint' },
                { key: 'breakeven', label: 'Breakeven' },
                { key: 'trailing', label: 'Trailing Stop' },
                { key: 'manual', label: 'Sortie manuelle' },
              ].map((t) => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </Select>
          </Field>
        </FieldGrid>
        <div className="mb-4 pt-3 border-t border-border/40 space-y-3">
          <p className="text-[11px] font-semibold text-txt2 uppercase tracking-wider">Concepts du Catalogue Technique</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <Field label="Concepts SL (Catalogue)">
              <CatalogReasonSelector
                contextType="sl"
                value={formData.sl_catalog_reasons}
                onChange={(val) => updateField('sl_catalog_reasons', val)}
              />
            </Field>
   
            <Field label="Concepts TP (Catalogue)">
              <CatalogReasonSelector
                contextType="tp"
                value={formData.tp_catalog_reasons}
                onChange={(val) => updateField('tp_catalog_reasons', val)}
              />
            </Field>
          </div>
   
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <Field label="Concepts Trailing (Catalogue)">
              <CatalogReasonSelector
                contextType="trailing"
                value={formData.trailing_catalog_reasons}
                onChange={(val) => updateField('trailing_catalog_reasons', val)}
              />
            </Field>
   
            <Field label="Concepts Entrée (Catalogue)">
              <CatalogReasonSelector
                contextType={['entry', 'confirmation']}
                value={formData.entry_catalog_reasons}
                onChange={(val) => updateField('entry_catalog_reasons', val)}
              />
            </Field>
          </div>
        </div>
   
        <div className="mb-3">
          <Field label="Raisons de l'entrée">
            <ComboField
              fieldKey="entry_reasons"
              placeholder="Ex: CHoCH M5 sur le POI..."
              presets={["CHoCH M5 confirmed sur le POI","Bougie englobante haussière","Retest du bris de structure","Confluences multiples alignées"]}
              value={formData.entry_reasons}
              onChange={(val) => updateField('entry_reasons', val)}
            />
          </Field>
        </div>
        <StepImageSection
          title="Capture de Planification d'Entrée (Avant)"
          phase="avant"
          tradeId={tradeId || ''}
          stepId={stepId || ''}
          images={images}
          onAddImage={onAddImage}
          onRemoveImage={onRemoveImage}
          imagesReutilisables={imagesReutilisables}
        />
      </div>

      {/* 🔄 APRÈS LA POSITION */}
      <div className="pt-4 border-t border-border/40 space-y-3">
        <h3 className="text-xs font-semibold text-txt uppercase tracking-wider">🔄 Déroulement Réel (Après position)</h3>
        {(formData.journal_type === 'global' || formData.journal_type === 'confirmation') && (
          <div className="mb-3">
            <label className="text-txt3 text-[11px] font-medium uppercase tracking-wider block mb-1.5">Le trade s'est-il déclenché ?</label>
            <div className="flex gap-2 flex-wrap">
              {[
                { key: 'win', label: '✓ Déclenché & Win' },
                { key: 'loss', label: '✗ Déclenché & Loss' },
                { key: 'breakeven', label: '— Déclenché & BE' },
                { key: 'missed', label: '🟡 Non déclenché (Missed)' }
              ].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    updateField('result', key)
                    if (key === 'missed') {
                      updateField('rr_realized', '0')
                    }
                  }}
                  className={cn(
                    'flex-1 py-1.5 rounded-md border text-[12px] font-medium transition-all min-w-[120px]',
                    formData.result === key 
                      ? (key === 'win' ? 'border-win bg-win/10 text-win' : key === 'loss' ? 'border-loss bg-loss/10 text-loss' : key === 'breakeven' ? 'border-be bg-be/10 text-be' : 'border-[#f5a623] bg-[#f5a623]/10 text-[#f5a623]')
                      : 'border-border2 bg-bg text-txt3'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
        <StepImageSection
          title="Capture d'Exécution / Déroulement (Après)"
          phase="apres"
          tradeId={tradeId || ''}
          stepId={stepId || ''}
          images={images}
          onAddImage={onAddImage}
          onRemoveImage={onRemoveImage}
          imagesReutilisables={imagesReutilisables}
        />
      </div>
    </div>
  )
}

// Étape 5 : Résultat, émotions et revue écrite
function ResultFields({
  formData,
  setFormData,
  tradeId,
  stepId,
  images,
  onAddImage,
  onRemoveImage,
  imagesReutilisables,
}: SubFieldProps) {
  const updateField = createFieldUpdater(setFormData)
  const [analysantIA, setAnalysantIA] = useState(false)

  // Appelle l'Edge Function pour analyser le dénouement (win, loss, missed) depuis la capture de fin
  const analyserDenouementAvecIA = async () => {
    const apresImage = images?.find(img => img.phase === 'apres')
    if (!apresImage) {
      alert("Ajoutez d'abord une image dans la section APRÈS (ci-dessous) pour utiliser l'IA.")
      return
    }

    setAnalysantIA(true)
    console.log("🚀 [ResultFields] Début de l'analyse IA de clôture...")

    try {
      const response = await supabase.functions.invoke('analyze', {
        body: {
          url: apresImage.url,
          mode: 'close',
          direction: formData.direction,
          entry_price: formData.entry_price ? parseFloat(formData.entry_price) : null,
          sl: formData.entry_sl ? parseFloat(formData.entry_sl) : null,
          tp: formData.entry_tp ? parseFloat(formData.entry_tp) : null,
        }
      })

      if (response.error) throw response.error

      const res = response.data
      console.log('✅ [ResultFields] Analyse IA terminée. Résultat détecté :', res)

      // Mettre à jour les champs du formulaire avec les prédictions de Gemini
      if (res.result) {
        updateField('result', res.result)
      }
      if (res.rr_realized != null) {
        updateField('rr_realized', String(res.rr_realized))
      }
      if (res.missed_gap != null) {
        updateField('missed_gap', String(res.missed_gap))
      }
      if (res.missed_reason) {
        updateField('missed_reason', res.missed_reason)
      }
      if (res.exit_time) {
        setFormData((prev) => ({ ...prev, exit_time: res.exit_time }))
      }

    } catch (err: any) {
      console.error("❌ [ResultFields] Échec de l'analyse IA :", err)
      alert(err.message || "Erreur lors de l'analyse par l'IA.")
    } finally {
      setAnalysantIA(false)
    }
  }

  const typeJournal = formData.journal_type || 'global'

  // Boutons personnalisés selon le type de journal
  let labelResultat = "Résultat"
  let buttons: { key: 'win' | 'loss' | 'breakeven' | 'missed'; label: string }[] = [
    { key: 'win' as const, label: '✓ Win' },
    { key: 'loss' as const, label: '✗ Loss' },
    { key: 'breakeven' as const, label: '— Breakeven' },
  ]

  if (typeJournal === 'bias') {
    labelResultat = "Biais Correct ?"
    buttons = [
      { key: 'win' as const, label: '✓ Oui' },
      { key: 'loss' as const, label: '✗ Non' },
      { key: 'breakeven' as const, label: '— Invalide / BE' },
    ]
  } else if (typeJournal === 'poi') {
    labelResultat = "Réaction du POI ?"
    buttons = [
      { key: 'win' as const, label: '✓ Réagi' },
      { key: 'loss' as const, label: '✗ Cassé' },
      { key: 'breakeven' as const, label: '— Non atteint' },
    ]
  } else {
    // Si c'est global ou confirmation, on propose l'option de trade manqué
    buttons.push({ key: 'missed' as const, label: '🟡 Missed' })
  }

  const colors = {
    win: 'border-win bg-win/10 text-win',
    loss: 'border-loss bg-loss/10 text-loss',
    breakeven: 'border-be bg-be/10 text-be',
    missed: 'border-[#f5a623] bg-[#f5a623]/10 text-[#f5a623]',
  }

  const afficherInfosFinancieres = typeJournal === 'global' || typeJournal === 'confirmation'

  return (
    <div className="space-y-4">
      <div className="mb-3">
        <label className="text-txt3 text-[11px] font-medium uppercase tracking-wider block mb-1.5">{labelResultat}</label>
        <div className="flex gap-2 flex-wrap">
          {buttons.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                updateField('result', key)
                // Si c'est missed, le R:R réalisé est de 0
                if (key === 'missed') {
                  updateField('rr_realized', '0')
                }
              }}
              className={cn(
                'flex-1 py-2 rounded-md border-[1.5px] text-[12.5px] font-medium transition-all min-w-[80px]',
                formData.result === key ? colors[key] : 'border-border2 bg-bg text-txt3'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      
      {afficherInfosFinancieres && formData.result !== 'missed' && (
        <FieldGrid>
          <Field label="R:R réalisé">
            <Input
              type="number"
              step="0.1"
              placeholder="0.0"
              value={formData.rr_realized}
              onChange={(e) => updateField('rr_realized', e.target.value)}
            />
          </Field>
          <Field label="État émotionnel">
            <Select
              value={formData.emotion}
              onChange={(e) => updateField('emotion', e.target.value)}
            >
              <option value="">Sélectionner...</option>
              {['Discipliné','Confiant','FOMO','Impatient','Revenge','Hésitant','Neutre','Focalisé'].map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </Select>
          </Field>
        </FieldGrid>
      )}

      {/* Champs affichés spécifiquement si l'ordre a été manqué / non déclenché */}
      {afficherInfosFinancieres && formData.result === 'missed' && (
        <FieldGrid>
          <Field label="Écart de déclenchement (Pips)">
            <Input
              type="number"
              step="0.1"
              placeholder="ex: 2.5"
              value={formData.missed_gap}
              onChange={(e) => updateField('missed_gap', e.target.value)}
            />
          </Field>
          <Field label="Raison du manquement">
            <Input
              type="text"
              placeholder="ex: OB non atteint de peu"
              value={formData.missed_reason}
              onChange={(e) => updateField('missed_reason', e.target.value)}
            />
          </Field>
        </FieldGrid>
      )}

      <div className="flex flex-col gap-3 mb-3">
        <Field label="Ce que j'ai bien fait">
          <Textarea
            placeholder="..."
            value={formData.review_good}
            onChange={(e) => updateField('review_good', e.target.value)}
          />
        </Field>
        <Field label="À améliorer">
          <Textarea
            placeholder="..."
            value={formData.review_bad}
            onChange={(e) => updateField('review_bad', e.target.value)}
          />
        </Field>
      </div>

      <StepImageSection
        title="Capture Globale Finale (Clôture / Après)"
        phase="apres"
        tradeId={tradeId || ''}
        stepId={stepId || ''}
        images={images}
        onAddImage={onAddImage}
        onRemoveImage={onRemoveImage}
        imagesReutilisables={imagesReutilisables}
      />

      {images && images.filter(img => img.phase === 'apres').length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={analyserDenouementAvecIA}
            disabled={analysantIA}
            className="w-full py-2 bg-[#7c3aed]/10 text-[#7c3aed] border border-[#7c3aed]/25 hover:bg-[#7c3aed]/15 rounded-md text-[12.5px] font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
          >
            {analysantIA ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-[#7c3aed]/20 border-t-[#7c3aed] rounded-full animate-spin" />
                <span>Analyse du dénouement par Gemini...</span>
              </>
            ) : (
              <>
                <span>🧠</span>
                <span>Analyser la capture APRÈS par l'IA</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}


