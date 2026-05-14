'use client'

import { forwardRef } from 'react'
import { Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * A date input field with a prominent neon-styled calendar button.
 * Wraps the native <input type="date"> with a visible clickable calendar icon
 * that stands out in the cyberpunk dark theme.
 */
const DatePickerField = forwardRef<
  HTMLInputElement,
  React.ComponentProps<'input'> & {
    accentColor?: string
  }
>(({ className, accentColor, ...props }, ref) => {
  const color = accentColor || '#05d9e8'
  const colorRgb = hexToRgb(color)

  return (
    <div className="relative flex items-center">
      <input
        type="date"
        ref={ref}
        data-slot="date-picker"
        className={cn(
          'flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 pr-10 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm',
          'dark:bg-input/30',
          'placeholder:text-muted-foreground',
          'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        style={{
          borderColor: `${color}33`,
          colorScheme: 'dark',
        }}
        {...props}
      />
      {/* Prominent calendar button overlay */}
      <button
        type="button"
        tabIndex={-1}
        className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center size-7 rounded-md transition-all cursor-pointer"
        style={{
          backgroundColor: `${color}15`,
          border: `1px solid ${color}44`,
          color: color,
          boxShadow: `0 0 6px ${colorRgb ? `${colorRgb.r},${colorRgb.g},${colorRgb.b},0.2` : 'rgba(5,217,232,0.2)'}`,
        }}
        onClick={() => {
          // Find the input and trigger the native date picker
          const input = (props.id
            ? document.getElementById(props.id)
            : ref && 'current' in ref
              ? ref.current
              : null) as HTMLInputElement | null
          if (input) {
            try {
              input.showPicker()
            } catch {
              // Fallback: just focus the input
              input.focus()
            }
          }
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = `${color}30`
          e.currentTarget.style.borderColor = `${color}66`
          e.currentTarget.style.boxShadow = `0 0 10px ${colorRgb ? `${colorRgb.r},${colorRgb.g},${colorRgb.b},0.4` : 'rgba(5,217,232,0.4)'}`
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = `${color}15`
          e.currentTarget.style.borderColor = `${color}44`
          e.currentTarget.style.boxShadow = `0 0 6px ${colorRgb ? `${colorRgb.r},${colorRgb.g},${colorRgb.b},0.2` : 'rgba(5,217,232,0.2)'}`
        }}
      >
        <Calendar className="size-3.5" />
      </button>
    </div>
  )
})

DatePickerField.displayName = 'DatePickerField'

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null
}

export { DatePickerField }
