import { cn } from '@/lib/utils'

// ─── Skeleton de base ─────────────────────────────────────
// Barre animée qui simule le chargement d'un contenu
//
// Exemple :
// <Skeleton className="w-24 h-4" />
// <Skeleton className="w-full h-10 rounded-lg" />

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'bg-surface2 rounded animate-pulse',
        className
      )}
    />
  )
}

// ─── Skeleton pour une ligne de texte ─────────────────────
// Simule une ligne de texte avec une largeur variable
//
// Exemple :
// <SkeletonLine width="w-32" />

interface SkeletonLineProps {
  width?: string
}

export function SkeletonLine({ width = 'w-24' }: SkeletonLineProps) {
  return <Skeleton className={cn('h-3.5', width)} />
}

// ─── Skeleton pour un badge ───────────────────────────────
// Simule un petit badge (résultat, direction, etc.)

export function SkeletonBadge() {
  return <Skeleton className="w-14 h-5 rounded-full" />
}

// ─── Skeleton pour une ligne de tableau ───────────────────
// Simule une ligne complète du TradeTable
// Les largeurs varient pour un rendu naturel

export function SkeletonTableRow() {
  return (
    <tr className="border-b border-border">
      <td className="px-3 py-3"><SkeletonLine width="w-20" /></td>
      <td className="px-3 py-3"><SkeletonLine width="w-16" /></td>
      <td className="px-3 py-3"><SkeletonBadge /></td>
      <td className="px-3 py-3"><SkeletonLine width="w-28" /></td>
      <td className="px-3 py-3"><SkeletonLine width="w-14" /></td>
      <td className="px-3 py-3"><SkeletonLine width="w-10" /></td>
      <td className="px-3 py-3"><SkeletonBadge /></td>
      <td className="px-3 py-3">
        <div className="flex gap-1">
          <Skeleton className="w-1.5 h-1.5 rounded-full" />
          <Skeleton className="w-1.5 h-1.5 rounded-full" />
          <Skeleton className="w-1.5 h-1.5 rounded-full" />
        </div>
      </td>
    </tr>
  )
}

// ─── Skeleton pour une section de TradeDetail ─────────────
// Simule une section (Infos, Biais, POI, etc.)

export function SkeletonSection() {
  return (
    <div className="bg-surface2 border border-border rounded-lg overflow-hidden">
      {/* Header de section */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
        <SkeletonLine width="w-32" />
      </div>
      {/* Contenu */}
      <div className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Skeleton className="w-12 h-2.5" />
              <Skeleton className="w-20 h-4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
