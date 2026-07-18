import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric'
  }).format(new Date(date))
}

export function formatRR(rr: number | null | undefined): string {
  if (rr == null) return '—'
  return `${rr.toFixed(1)}R`
}
