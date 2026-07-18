import React from 'react'

// Grille de 2 colonnes pour aligner les champs de formulaire
export function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 mb-3">{children}</div>
}

// Label avec espacement et label stylisé pour un champ
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-txt3 text-[11px] font-medium uppercase tracking-wider">{label}</label>
      {children}
    </div>
  )
}

// Input stylisé
export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full bg-bg border border-border2 rounded-md text-txt px-3 py-2 text-[13.5px] outline-none focus:border-accent"
    />
  )
}

// Select stylisé
export function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="w-full bg-bg border border-border2 rounded-md text-txt px-3 py-2 text-[13.5px] outline-none focus:border-accent"
    >
      {children}
    </select>
  )
}

// Textarea stylisé
export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="w-full bg-bg border border-border2 rounded-md text-txt px-3 py-2 text-[13.5px] outline-none focus:border-accent resize-y min-h-[72px]"
    />
  )
}
