import { useState, useRef, useEffect } from 'react'
import { useComboMemory } from '@/hooks/useComboMemory'
import { cn } from '@/lib/utils'

interface ComboFieldProps {
  fieldKey: string
  placeholder?: string
  presets?: string[]
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
}

export function ComboField({
  fieldKey,
  placeholder,
  presets = [],
  value,
  onChange,
  onBlur,
}: ComboFieldProps) {
  const [open, setOpen] = useState(false)
  const { suggestions, saveValue } = useComboMemory(fieldKey)
  const wrapRef = useRef<HTMLDivElement>(null)

  const memoryValues = suggestions.map((s) => s.value)
  const allOptions = [...new Set([...presets, ...memoryValues])]
  const filtered = allOptions.filter((o) =>
    o.toLowerCase().includes(value.toLowerCase())
  )

  const select = (val: string) => {
    onChange(val)
    saveValue(val)
    setOpen(false)
  }

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={wrapRef} className="relative">
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Save custom value on blur if non-empty
          if (value.trim()) saveValue(value.trim())
          onBlur?.()
        }}
        className="w-full bg-bg border border-border2 rounded-md text-txt px-3 py-2 text-[13.5px] outline-none focus:border-accent"
      />

      {open && filtered.length > 0 && (
        <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-surface2 border border-border2 rounded-md z-50 max-h-44 overflow-y-auto">
          {filtered.map((option) => (
            <button
              key={option}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                select(option)
              }}
              className={cn(
                'w-full text-left px-3 py-2 text-[13px] hover:bg-border transition-colors',
                memoryValues.includes(option) ? 'text-txt2' : 'text-txt3 italic'
              )}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
