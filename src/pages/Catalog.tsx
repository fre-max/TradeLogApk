import { useState } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { useUIStore } from '@/store'
import { uploadImage } from '@/lib/storage'
import { supabase } from '@/lib/supabase'
import {
  useCatalog,
  useCreateCatalogItem,
  useUpdateCatalogItem,
  useDeleteCatalogItem,
} from '@/hooks/useCatalog'
import {
  useReasonFamilies,
  useCreateReasonFamily,
  useDeleteReasonFamily,
  useUpdateReasonFamily,
} from '@/hooks/useReasonFamilies'
import type { ReasonCatalogItem, ReasonVariant } from '@/types'
import { cn } from '@/lib/utils'

export default function Catalog() {
  // Données des Familles et du Catalogue
  const { data: families, isLoading: loadingFamilies } = useReasonFamilies()
  const { data: catalogItems, isLoading: loadingCatalog } = useCatalog()
  
  // Mutations
  const { mutateAsync: createItem } = useCreateCatalogItem()
  const { mutateAsync: updateItem } = useUpdateCatalogItem()
  const { mutateAsync: deleteItem } = useDeleteCatalogItem()
  const { mutateAsync: createFamily } = useCreateReasonFamily()
  const { mutateAsync: deleteFamily } = useDeleteReasonFamily()
  const { mutateAsync: updateFamily } = useUpdateReasonFamily()
  
  const addToast = useUIStore((state) => state.addToast)

  // Filtres
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Modal Item (Concept)
  const [viewingItem, setViewingItem] = useState<ReasonCatalogItem | null>(null)
  const [editingItem, setEditingItem] = useState<ReasonCatalogItem | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)

  // Modal Famille (Création & Modification)
  const [isFamilyFormOpen, setIsFamilyFormOpen] = useState(false)
  const [newFamilyName, setNewFamilyName] = useState('')
  const [isFamilyEditOpen, setIsFamilyEditOpen] = useState(false)
  const [editingFamilyId, setEditingFamilyId] = useState<string | null>(null)
  const [editingFamilyName, setEditingFamilyName] = useState('')

  // État du formulaire Concept
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formFamilyId, setFormFamilyId] = useState<string>('')
  const [formVariants, setFormVariants] = useState<Omit<ReasonVariant, 'id' | 'reason_id' | 'created_at'>[]>([])
  const [saving, setSaving] = useState(false)

  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null)

  // ─── GESTION DES FAMILLES ─────────────────────────────────────────────
  
  // Ouvre le formulaire d'édition de la famille avec les valeurs existantes
  const handleEditFamily = (id: string, name: string) => {
    setEditingFamilyId(id)
    setEditingFamilyName(name)
    setIsFamilyEditOpen(true)
  }

  // Met à jour la famille en BDD et synchronise l'affichage
  const handleUpdateFamily = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingFamilyId || !editingFamilyName.trim()) return

    setSaving(true)
    try {
      console.log('🚀 [Catalog] Modification de la famille ID:', editingFamilyId)
      await updateFamily({ id: editingFamilyId, name: editingFamilyName.trim() })
      addToast('Famille modifiée avec succès !', 'success')
      setIsFamilyEditOpen(false)
      setEditingFamilyId(null)
      setEditingFamilyName('')
    } catch (e) {
      console.error('❌ [Catalog] Erreur lors de la modification:', e)
      addToast('Erreur lors de la modification de la famille', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveFamily = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFamilyName.trim()) return

    setSaving(true)
    try {
      await createFamily({ name: newFamilyName.trim() })
      addToast('Famille créée avec succès !', 'success')
      setIsFamilyFormOpen(false)
      setNewFamilyName('')
    } catch (e) {
      console.error(e)
      addToast('Erreur lors de la création de la famille', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteFamily = async (id: string) => {
    if (confirm('Attention : Supprimer cette famille supprimera AUSSI toutes les raisons qui sont dedans. Es-tu sûr ?')) {
      try {
        await deleteFamily(id)
        addToast('Famille supprimée', 'success')
        if (selectedFamilyId === id) setSelectedFamilyId('all')
      } catch (e) {
        console.error(e)
        addToast('Erreur lors de la suppression', 'error')
      }
    }
  }

  // ─── GESTION DES CONCEPTS ────────────────────────────────────────────
  const handleOpenCreate = () => {
    if (!families || families.length === 0) {
      addToast('Tu dois d\'abord créer une Famille de raisons !', 'error')
      return
    }
    setEditingItem(null)
    setFormTitle('')
    setFormDescription('')
    setFormFamilyId(selectedFamilyId !== 'all' ? selectedFamilyId : families[0].id)
    setFormVariants([{ name: 'Standard', image_url: '', notes: '' }])
    setIsFormOpen(true)
  }

  const handleOpenEdit = (item: ReasonCatalogItem) => {
    setEditingItem(item)
    setFormTitle(item.title)
    setFormDescription(item.description || '')
    setFormFamilyId(item.family_id)
    setFormVariants(
      item.variants.map((v) => ({
        name: v.name,
        image_url: v.image_url || '',
        notes: v.notes || '',
      }))
    )
    setIsFormOpen(true)
  }

  const handleAddFormVariant = () => setFormVariants((prev) => [...prev, { name: '', image_url: '', notes: '' }])
  const handleRemoveFormVariant = (index: number) => setFormVariants((prev) => prev.filter((_, i) => i !== index))
  const handleUpdateFormVariant = (index: number, key: keyof Omit<ReasonVariant, 'id'|'reason_id'|'created_at'>, val: string) => {
    setFormVariants((prev) => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [key]: val }
      return copy
    })
  }

  const handleUploadImage = async (index: number, file: File) => {
    if (!file) return
    setUploadingIndex(index)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Utilisateur non connecté')

      const cleanFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_')
      const path = `catalog/${user.id}/${Date.now()}-${cleanFileName}`
      
      const publicUrl = await uploadImage(file, path)
      handleUpdateFormVariant(index, 'image_url', publicUrl)
      addToast('Image importée !', 'success')
    } catch (e) {
      console.error(e)
      addToast('Erreur lors de l\'upload', 'error')
    } finally {
      setUploadingIndex(null)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formTitle.trim()) {
      addToast('Le titre est requis', 'error')
      return
    }

    setSaving(true)
    try {
      const itemData = {
        title: formTitle.trim(),
        description: formDescription.trim() || null,
        family_id: formFamilyId,
      }

      const validVariants = formVariants
        .filter((v) => v.name.trim() !== '')
        .map((v) => ({
          name: v.name.trim(),
          image_url: v.image_url?.trim() || null,
          notes: v.notes?.trim() || null,
        }))

      if (editingItem) {
        await updateItem({ id: editingItem.id, item: itemData, variants: validVariants })
        addToast('Concept modifié !', 'success')
      } else {
        await createItem({ item: itemData, variants: validVariants })
        addToast('Concept ajouté !', 'success')
      }
      setIsFormOpen(false)
    } catch (e) {
      console.error(e)
      addToast('Erreur lors de la sauvegarde', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('Es-tu sûr de vouloir supprimer ce concept ?')) {
      try {
        await deleteItem(id)
        addToast('Concept supprimé', 'success')
        if (viewingItem?.id === id) setViewingItem(null)
      } catch (e) {
        console.error(e)
        addToast('Erreur', 'error')
      }
    }
  }

  const itemsFiltrés = catalogItems?.filter((item) => {
    const matchFamily = selectedFamilyId === 'all' || item.family_id === selectedFamilyId
    const matchSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
    return matchFamily && matchSearch
  })

  const isLoading = loadingFamilies || loadingCatalog

  return (
    <AppLayout title="Catalogue de Raisons">
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        
        {/* En-tête */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface border border-border rounded-xl p-5 shadow-sm">
          <div>
            <h1 className="text-lg font-semibold text-txt tracking-tight">Catalogue de Raisons</h1>
            <p className="text-txt3 text-xs mt-1 max-w-xl">
              Gère tes familles de raisons (Entrée, TP, Contexte...) et les concepts qui s'y rattachent.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setIsFamilyFormOpen(true)}
              className="px-4 py-2 bg-surface2 hover:bg-surface border border-border2 text-txt rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              📂 Nouvelle Famille
            </button>
            <button
              onClick={handleOpenCreate}
              className="px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded-md text-xs font-semibold tracking-wide transition-colors flex items-center justify-center gap-1.5"
            >
              <span>+</span> Nouveau Concept
            </button>
          </div>
        </div>

        {/* Barre d'Onglets (Familles) & Recherche */}
        <div className="flex flex-col gap-3.5 bg-surface/50 border border-border/80 rounded-xl p-4">
          <input
            type="text"
            placeholder="Rechercher un concept..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-bg border border-border2 rounded-lg text-txt px-3.5 py-2 text-xs outline-none focus:border-accent transition-colors"
          />

          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            <button
              onClick={() => setSelectedFamilyId('all')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all whitespace-nowrap',
                selectedFamilyId === 'all'
                  ? 'bg-accent/10 border-accent/25 text-accent font-semibold'
                  : 'bg-transparent border-transparent text-txt2 hover:bg-surface2 hover:text-txt'
              )}
            >
              Toutes ({catalogItems?.length || 0})
            </button>
            {families?.map((fam) => {
              const count = catalogItems?.filter((x) => x.family_id === fam.id).length || 0
              return (
                <div key={fam.id} className="group relative flex items-center pr-2">
                  <button
                    onClick={() => setSelectedFamilyId(fam.id)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all whitespace-nowrap mr-3',
                      selectedFamilyId === fam.id
                        ? 'bg-accent/10 border-accent/25 text-accent font-semibold'
                        : 'bg-transparent border-transparent text-txt2 hover:bg-surface2 hover:text-txt'
                    )}
                  >
                    {fam.name} ({count})
                  </button>
                  {selectedFamilyId === fam.id && (
                    <div className="absolute top-0 right-0 flex gap-0.5 z-[5]">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleEditFamily(fam.id, fam.name); }}
                        className="bg-accent text-white rounded-full w-4 h-4 text-[9px] flex items-center justify-center hover:scale-110 transition-transform shadow"
                        title="Modifier la famille"
                      >
                        ✏️
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteFamily(fam.id); }}
                        className="bg-loss text-white rounded-full w-4 h-4 text-[8px] flex items-center justify-center hover:scale-110 transition-transform shadow"
                        title="Supprimer la famille"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Chargement */}
        {isLoading && (
          <div className="py-20 flex justify-center text-txt3 text-xs animate-pulse">
            Chargement du catalogue...
          </div>
        )}

        {/* Liste */}
        {!isLoading && itemsFiltrés?.length === 0 && (
          <div className="py-20 text-center border border-dashed border-border2 rounded-2xl">
            <p className="text-txt3 text-xs">Aucun concept trouvé.</p>
          </div>
        )}

        {!isLoading && itemsFiltrés && itemsFiltrés.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {itemsFiltrés.map((item) => {
              const fam = families?.find(f => f.id === item.family_id)
              return (
                <div
                  key={item.id}
                  onClick={() => setViewingItem(item)}
                  className="group relative bg-surface border border-border rounded-xl p-5 hover:border-accent/30 hover:scale-[1.01] transition-all duration-300 cursor-pointer shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider uppercase bg-surface2 text-txt2 border border-border2">
                        {fam?.name || 'Inconnu'}
                      </span>
                      <span className="text-[10px] text-txt3 font-medium">
                        {item.variants.length} variante(s)
                      </span>
                    </div>

                    <h3 className="text-[14px] font-semibold text-txt group-hover:text-accent transition-colors">
                      {item.title}
                    </h3>
                    {item.description && (
                      <p className="text-txt2 text-xs mt-2 line-clamp-3 leading-relaxed">
                        {item.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-5 pt-3.5 border-t border-border flex items-center justify-between">
                    <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleOpenEdit(item); }}
                        className="p-1.5 hover:bg-surface2 rounded text-txt2 hover:text-txt text-xs"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                        className="p-1.5 hover:bg-loss/10 rounded text-txt3 hover:text-loss text-xs"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ─── MODAL FAMILLE ────────────────────────────────────────────── */}
        {isFamilyFormOpen && (
          <div className="fixed inset-0 bg-black/75 z-[200] flex items-center justify-center p-4">
            <div className="bg-surface border border-border w-full max-w-sm rounded-xl p-5 shadow-2xl">
              <h2 className="text-sm font-semibold mb-4">Nouvelle Famille</h2>
              <form onSubmit={handleSaveFamily}>
                <input
                  autoFocus
                  type="text"
                  placeholder="Ex: Vitesse, Contexte, Biais..."
                  value={newFamilyName}
                  onChange={(e) => setNewFamilyName(e.target.value)}
                  className="w-full bg-bg border border-border2 rounded-lg px-3 py-2 text-sm text-txt mb-4 outline-none focus:border-accent"
                />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setIsFamilyFormOpen(false)} className="px-3 py-1.5 text-xs text-txt3 hover:text-txt">Annuler</button>
                  <button type="submit" disabled={saving} className="px-3 py-1.5 bg-accent text-white rounded text-xs font-semibold">Sauvegarder</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── MODAL MODIFICATION FAMILLE ─────────────────────────────────── */}
        {isFamilyEditOpen && (
          <div className="fixed inset-0 bg-black/75 z-[200] flex items-center justify-center p-4">
            <div className="bg-surface border border-border w-full max-w-sm rounded-xl p-5 shadow-2xl">
              <h2 className="text-sm font-semibold mb-4 text-txt">Modifier la Famille</h2>
              <form onSubmit={handleUpdateFamily}>
                <input
                  autoFocus
                  type="text"
                  placeholder="Ex: Vitesse, Contexte, Biais..."
                  value={editingFamilyName}
                  onChange={(e) => setEditingFamilyName(e.target.value)}
                  className="w-full bg-bg border border-border2 rounded-lg px-3 py-2 text-sm text-txt mb-4 outline-none focus:border-accent"
                />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => { setIsFamilyEditOpen(false); setEditingFamilyId(null); }} className="px-3 py-1.5 text-xs text-txt3 hover:text-txt">Annuler</button>
                  <button type="submit" disabled={saving} className="px-3 py-1.5 bg-accent text-white rounded text-xs font-semibold">Sauvegarder</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── MODAL CONCEPT (FORM) ─────────────────────────────────────── */}
        {isFormOpen && (
          <div className="fixed inset-0 bg-black/75 z-[200] flex items-center justify-center p-4">
            <div className="bg-surface border border-border w-full max-w-2xl rounded-2xl flex flex-col max-h-[85vh] shadow-2xl overflow-hidden animate-slideUp">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <h2 className="text-sm font-semibold text-txt">
                  {editingItem ? 'Modifier le Concept' : 'Ajouter un Concept'}
                </h2>
                <button onClick={() => setIsFormOpen(false)} className="text-txt3 hover:text-txt">✕</button>
              </div>

              <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-txt3 uppercase">Titre</label>
                    <input type="text" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} className="bg-bg border border-border2 rounded-lg px-3 py-2 text-xs" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-txt3 uppercase">Famille</label>
                    <select value={formFamilyId} onChange={(e) => setFormFamilyId(e.target.value)} className="bg-bg border border-border2 rounded-lg px-3 py-2 text-xs outline-none focus:border-accent">
                      {families?.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-txt3 uppercase">Description</label>
                  <textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} className="bg-bg border border-border2 rounded-lg px-3 py-2 text-xs min-h-[60px] resize-y" />
                </div>

                {/* Variantes Simplifiées */}
                <div className="pt-4 border-t border-border">
                  <div className="flex justify-between mb-3">
                    <h3 className="text-xs font-semibold text-txt">Variantes</h3>
                    <button type="button" onClick={handleAddFormVariant} className="text-xs text-accent">+ Ajouter</button>
                  </div>
                  <div className="space-y-3">
                    {formVariants.map((v, i) => (
                      <div key={i} className="bg-bg/50 p-3 rounded-lg border border-border2">
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <input type="text" placeholder="Nom" value={v.name} onChange={e => handleUpdateFormVariant(i, 'name', e.target.value)} className="bg-surface border border-border2 rounded px-2 text-xs py-1" />
                          <input type="text" placeholder="Notes" value={v.notes || ''} onChange={e => handleUpdateFormVariant(i, 'notes', e.target.value)} className="bg-surface border border-border2 rounded px-2 text-xs py-1" />
                        </div>
                        <div className="flex gap-2">
                          <input type="url" placeholder="Lien image" value={v.image_url || ''} onChange={e => handleUpdateFormVariant(i, 'image_url', e.target.value)} className="flex-1 bg-surface border border-border2 rounded px-2 text-xs py-1" />
                          <button type="button" onClick={() => handleRemoveFormVariant(i)} className="text-loss text-xs px-2">Supprimer</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </form>

              <div className="px-5 py-4 border-t border-border flex justify-end gap-2.5">
                <button onClick={() => setIsFormOpen(false)} className="px-4 py-2 text-xs text-txt2">Annuler</button>
                <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-accent text-white text-xs font-semibold rounded-lg">Sauvegarder</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  )
}
