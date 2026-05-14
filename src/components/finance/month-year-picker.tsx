'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { MONTHS_ES } from '@/lib/finance-utils'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface MonthYearPickerProps {
  month: number
  year: number
  onChange: (month: number, year: number) => void
  collapsed?: boolean
}

export function MonthYearPicker({ month, year, onChange, collapsed = false }: MonthYearPickerProps) {
  const handlePrevYear = () => {
    onChange(month, year - 1)
  }

  const handleNextYear = () => {
    onChange(month, year + 1)
  }

  const handleMonthClick = (m: number) => {
    onChange(m, year)
  }

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-1 px-1 py-2">
        <button
          onClick={handlePrevYear}
          className="text-muted-foreground hover:text-neon-blue transition-colors"
        >
          <ChevronLeft className="size-3" />
        </button>
        <span className="text-[10px] font-bold text-neon-blue leading-none">
          {MONTHS_ES[month - 1].substring(0, 3).toUpperCase()}
        </span>
        <span className="text-[9px] text-muted-foreground leading-none">{year}</span>
        <button
          onClick={handleNextYear}
          className="text-muted-foreground hover:text-neon-blue transition-colors"
        >
          <ChevronRight className="size-3" />
        </button>
      </div>
    )
  }

  return (
    <div className="px-3 py-2">
      {/* Year navigation */}
      <div className="flex items-center justify-between mb-2">
        <Button
          variant="ghost"
          size="icon"
          className="size-6 text-muted-foreground hover:text-neon-blue hover:bg-neon-blue/10"
          onClick={handlePrevYear}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-bold text-neon-blue tabular-nums">{year}</span>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 text-muted-foreground hover:text-neon-blue hover:bg-neon-blue/10"
          onClick={handleNextYear}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* Month grid 4x3 */}
      <div className="grid grid-cols-4 gap-1">
        {MONTHS_ES.map((name, i) => {
          const m = i + 1
          const isActive = m === month
          return (
            <button
              key={m}
              onClick={() => handleMonthClick(m)}
              className={cn(
                'rounded px-1 py-1 text-[11px] font-medium transition-all',
                isActive
                  ? 'bg-neon-blue/20 text-neon-blue border border-neon-blue/40 shadow-neon-blue'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground border border-transparent'
              )}
            >
              {name.substring(0, 3)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
