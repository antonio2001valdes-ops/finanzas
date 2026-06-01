'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Settings2, GripVertical, Eye, EyeOff, RotateCcw, X, ChevronUp, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { dashboardPrefsService, DEFAULT_DASHBOARD_SECTIONS } from '@/lib/data'
import type { DashboardSectionConfig } from '@/lib/db-client'
import { Button } from '@/components/ui/button'

// ─── Neon Color Constants ──────────────────────────────────────────

const NEON_CYAN = '#05d9e8'
const NEON_CYAN_RGB = '5,217,232'
const NEON_GREEN = '#01ff89'
const NEON_GREEN_RGB = '1,255,137'
const NEON_PINK = '#ff2a6d'
const NEON_PINK_RGB = '255,42,109'
const NEON_YELLOW = '#f9f002'

// ─── Component Props ───────────────────────────────────────────────

interface DashboardCustomizeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPreferencesChange: () => void
}

// ─── Section Row Component ─────────────────────────────────────────

function SectionRow({
  section,
  index,
  totalCount,
  onToggleVisible,
  onMoveUp,
  onMoveDown,
  isDragTarget,
  isDragging,
  dragListeners,
  dragRef,
}: {
  section: DashboardSectionConfig
  index: number
  totalCount: number
  onToggleVisible: (key: string) => void
  onMoveUp: (index: number) => void
  onMoveDown: (index: number) => void
  isDragTarget: boolean
  isDragging: boolean
  dragListeners?: React.HTMLAttributes<HTMLElement>
  dragRef?: (el: HTMLElement | null) => void
}) {
  const canMoveUp = index > 0
  const canMoveDown = index < totalCount - 1

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -12 }}
      animate={{
        opacity: isDragging ? 0.4 : 1,
        x: 0,
        scale: isDragging ? 0.97 : 1,
      }}
      transition={{ duration: 0.2, delay: index * 0.03 }}
      ref={dragRef}
      className={`
        group relative flex items-center gap-2 rounded-lg border px-3 py-2.5
        transition-all duration-200 select-none
        ${isDragTarget
          ? 'border-[#05d9e8]/60 bg-[#05d9e8]/8'
          : 'border-border/40 bg-card/60 hover:bg-card/80 hover:border-[#05d9e8]/30'
        }
        ${isDragging ? 'shadow-lg' : ''}
      `}
      style={
        isDragTarget
          ? {
              boxShadow: `0 0 12px rgba(${NEON_CYAN_RGB},0.25), inset 0 0 12px rgba(${NEON_CYAN_RGB},0.06)`,
            }
          : isDragging
            ? {
                boxShadow: `0 0 20px rgba(${NEON_CYAN_RGB},0.15)`,
              }
            : undefined
      }
    >
      {/* Drag Handle — pointer-event driven */}
      <div
        {...dragListeners}
        className="flex items-center justify-center shrink-0 cursor-grab active:cursor-grabbing touch-none p-1 -ml-1 rounded hover:bg-muted/30 transition-colors"
      >
        <GripVertical
          className="size-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors"
        />
      </div>

      {/* Drag indicator line (shown when this is drop target) */}
      {isDragTarget && (
        <motion.div
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full"
          style={{
            backgroundColor: NEON_CYAN,
            boxShadow: `0 0 6px rgba(${NEON_CYAN_RGB},0.6)`,
          }}
        />
      )}

      {/* Section Label */}
      <span
        className={`flex-1 text-sm font-medium transition-colors ${
          section.visible
            ? 'text-foreground'
            : 'text-muted-foreground line-through decoration-muted-foreground/40'
        }`}
      >
        {section.label}
      </span>

      {/* Move Up / Move Down Buttons */}
      <div className="flex flex-col items-center shrink-0 gap-0.5">
        <button
          onClick={() => onMoveUp(index)}
          disabled={!canMoveUp}
          className={`flex items-center justify-center size-5 rounded transition-all duration-200 ${
            canMoveUp
              ? 'text-muted-foreground hover:text-[#05d9e8] hover:bg-[#05d9e8]/10'
              : 'text-muted-foreground/20 cursor-not-allowed'
          }`}
          title="Mover arriba"
        >
          <ChevronUp className="size-3.5" />
        </button>
        <button
          onClick={() => onMoveDown(index)}
          disabled={!canMoveDown}
          className={`flex items-center justify-center size-5 rounded transition-all duration-200 ${
            canMoveDown
              ? 'text-muted-foreground hover:text-[#05d9e8] hover:bg-[#05d9e8]/10'
              : 'text-muted-foreground/20 cursor-not-allowed'
          }`}
          title="Mover abajo"
        >
          <ChevronDown className="size-3.5" />
        </button>
      </div>

      {/* Visibility Toggle */}
      <button
        onClick={() => onToggleVisible(section.key)}
        className={`
          flex items-center justify-center size-8 rounded-md
          transition-all duration-200 shrink-0
          ${section.visible
            ? 'text-[#05d9e8] hover:bg-[#05d9e8]/10'
            : 'text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/30'
          }
        `}
        style={
          section.visible
            ? {
                textShadow: `0 0 8px rgba(${NEON_CYAN_RGB},0.5)`,
              }
            : undefined
        }
        title={section.visible ? 'Ocultar sección' : 'Mostrar sección'}
      >
        {section.visible ? (
          <Eye className="size-4" />
        ) : (
          <EyeOff className="size-4" />
        )}
      </button>
    </motion.div>
  )
}

// ─── Main Dialog Component ─────────────────────────────────────────

export function DashboardCustomizeDialog({
  open,
  onOpenChange,
  onPreferencesChange,
}: DashboardCustomizeDialogProps) {
  const [sections, setSections] = useState<DashboardSectionConfig[]>([])
  const [hasChanges, setHasChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // ── Pointer-based drag state ──
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragTargetIndex, setDragTargetIndex] = useState<number | null>(null)
  const dragStartY = useRef<number>(0)
  const dragCurrentY = useRef<number>(0)
  const listRef = useRef<HTMLDivElement>(null)
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  // ── Load preferences when dialog opens ──
  const loadPreferences = useCallback(async () => {
    try {
      const prefs = await dashboardPrefsService.get()
      const sorted = [...prefs.sections].sort((a, b) => a.order - b.order)
      setSections(sorted)
      setHasChanges(false)
      setDragIndex(null)
      setDragTargetIndex(null)
    } catch {
      // Fallback to defaults
      setSections([...DEFAULT_DASHBOARD_SECTIONS])
      setHasChanges(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      loadPreferences()
    }
  }, [open, loadPreferences])

  // ── Toggle section visibility ──
  const handleToggleVisible = useCallback((key: string) => {
    setSections((prev) =>
      prev.map((s) => (s.key === key ? { ...s, visible: !s.visible } : s))
    )
    setHasChanges(true)
  }, [])

  // ── Move section up/down (always reliable) ──
  const handleMoveUp = useCallback((index: number) => {
    if (index <= 0) return
    setSections((prev) => {
      const updated = [...prev]
      const temp = updated[index]
      updated[index] = updated[index - 1]
      updated[index - 1] = temp
      return updated.map((s, i) => ({ ...s, order: i }))
    })
    setHasChanges(true)
  }, [])

  const handleMoveDown = useCallback((index: number) => {
    setSections((prev) => {
      if (index >= prev.length - 1) return prev
      const updated = [...prev]
      const temp = updated[index]
      updated[index] = updated[index + 1]
      updated[index + 1] = temp
      return updated.map((s, i) => ({ ...s, order: i }))
    })
    setHasChanges(true)
  }, [])

  // ── Pointer-based drag handlers ──
  const getTargetIndexFromY = useCallback((clientY: number): number | null => {
    let closestIndex: number | null = null
    let closestDistance = Infinity

    rowRefs.current.forEach((el, idx) => {
      if (!el) return
      const rect = el.getBoundingClientRect()
      const midY = rect.top + rect.height / 2
      const distance = Math.abs(clientY - midY)
      if (distance < closestDistance) {
        closestDistance = distance
        closestIndex = idx
      }
    })

    return closestIndex
  }, [])

  const handleDragPointerDown = useCallback((e: React.PointerEvent, index: number) => {
    // Only start drag from the grip handle (left mouse button or touch)
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()

    setDragIndex(index)
    setDragTargetIndex(null)
    dragStartY.current = e.clientY
    dragCurrentY.current = e.clientY

    // Capture pointer for reliable tracking
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [])

  const handleDragPointerMove = useCallback((e: React.PointerEvent) => {
    if (dragIndex === null) return
    e.preventDefault()

    dragCurrentY.current = e.clientY
    const targetIdx = getTargetIndexFromY(e.clientY)
    if (targetIdx !== null && targetIdx !== dragIndex) {
      setDragTargetIndex(targetIdx)
    } else {
      setDragTargetIndex(null)
    }
  }, [dragIndex, getTargetIndexFromY])

  const handleDragPointerUp = useCallback((e: React.PointerEvent) => {
    if (dragIndex === null) return
    e.preventDefault()

    const targetIdx = getTargetIndexFromY(e.clientY)

    if (targetIdx !== null && targetIdx !== dragIndex) {
      // Perform the reorder
      setSections((prev) => {
        const updated = [...prev]
        const [removed] = updated.splice(dragIndex, 1)
        updated.splice(targetIdx, 0, removed)
        return updated.map((s, i) => ({ ...s, order: i }))
      })
      setHasChanges(true)
    }

    setDragIndex(null)
    setDragTargetIndex(null)
  }, [dragIndex, getTargetIndexFromY])

  // ── Global pointer move/up listeners (for drag outside grip area) ──
  useEffect(() => {
    if (dragIndex === null) return

    const handleMove = (e: PointerEvent) => {
      dragCurrentY.current = e.clientY
      const targetIdx = getTargetIndexFromY(e.clientY)
      if (targetIdx !== null && targetIdx !== dragIndex) {
        setDragTargetIndex(targetIdx)
      } else {
        setDragTargetIndex(null)
      }
    }

    const handleUp = (e: PointerEvent) => {
      const targetIdx = getTargetIndexFromY(e.clientY)

      if (targetIdx !== null && targetIdx !== dragIndex) {
        setSections((prev) => {
          const updated = [...prev]
          const [removed] = updated.splice(dragIndex, 1)
          updated.splice(targetIdx, 0, removed)
          return updated.map((s, i) => ({ ...s, order: i }))
        })
        setHasChanges(true)
      }

      setDragIndex(null)
      setDragTargetIndex(null)
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  }, [dragIndex, getTargetIndexFromY])

  // ── Reset to defaults ──
  const handleReset = useCallback(() => {
    setSections(DEFAULT_DASHBOARD_SECTIONS.map((s, i) => ({ ...s, order: i })))
    setHasChanges(true)
  }, [])

  // ── Save changes ──
  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      const reordered = sections.map((s, i) => ({ ...s, order: i }))
      await dashboardPrefsService.update(reordered)
      setHasChanges(false)
      onPreferencesChange()
      onOpenChange(false)
    } catch {
      // Silent fail — user can retry
    } finally {
      setIsSaving(false)
    }
  }, [sections, onPreferencesChange, onOpenChange])

  // ── Cancel ──
  const handleCancel = useCallback(() => {
    setHasChanges(false)
    onOpenChange(false)
  }, [onOpenChange])

  // ── Count visible sections ──
  const visibleCount = sections.filter((s) => s.visible).length
  const allHidden = sections.length > 0 && visibleCount === 0

  // ── Drag listeners factory for grip handle ──
  const getDragListeners = useCallback((index: number) => ({
    onPointerDown: (e: React.PointerEvent) => handleDragPointerDown(e, index),
  }), [handleDragPointerDown])

  // ── Ref callback for row tracking ──
  const getRowRef = useCallback((index: number) => (el: HTMLDivElement | null) => {
    if (el) {
      rowRefs.current.set(index, el)
    } else {
      rowRefs.current.delete(index)
    }
  }, [])

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* ── Backdrop overlay ── */}
          <motion.div
            key="customize-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={handleCancel}
          />

          {/* ── Dialog ── */}
          <motion.div
            key="customize-dialog"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="pointer-events-auto relative w-full max-w-lg rounded-xl border bg-card/95 backdrop-blur-md shadow-2xl overflow-hidden"
              style={{
                borderColor: `rgba(${NEON_CYAN_RGB},0.35)`,
                boxShadow: `
                  0 0 30px rgba(${NEON_CYAN_RGB},0.12),
                  0 0 60px rgba(${NEON_CYAN_RGB},0.05),
                  0 25px 50px -12px rgba(0,0,0,0.5)
                `,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* ── Top neon accent line ── */}
              <div
                className="h-[2px] w-full"
                style={{
                  background: `linear-gradient(90deg, transparent, ${NEON_CYAN}, transparent)`,
                  boxShadow: `0 0 8px rgba(${NEON_CYAN_RGB},0.6)`,
                }}
              />

              {/* ── Header ── */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="flex items-center justify-center size-9 rounded-lg"
                    style={{
                      backgroundColor: `rgba(${NEON_CYAN_RGB},0.1)`,
                      boxShadow: `0 0 8px rgba(${NEON_CYAN_RGB},0.2)`,
                    }}
                  >
                    <Settings2
                      className="size-4.5 text-[#05d9e8]"
                      style={{ textShadow: `0 0 6px rgba(${NEON_CYAN_RGB},0.5)` }}
                    />
                  </div>
                  <div>
                    <h2
                      className="text-base font-bold text-[#05d9e8]"
                      style={{ textShadow: `0 0 10px rgba(${NEON_CYAN_RGB},0.4)` }}
                    >
                      Personalizar Dashboard
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Arrastra o usa las flechas para reordenar · Oculta las secciones que no necesites
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleCancel}
                  className="flex items-center justify-center size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* ── Warning: All sections hidden ── */}
              <AnimatePresence>
                {allHidden && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mx-5 mb-2 overflow-hidden"
                  >
                    <div
                      className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium"
                      style={{
                        borderColor: `rgba(${NEON_PINK_RGB},0.4)`,
                        backgroundColor: `rgba(${NEON_PINK_RGB},0.08)`,
                        color: NEON_PINK,
                      }}
                    >
                      <EyeOff className="size-3.5 shrink-0" />
                      <span>Todas las secciones están ocultas. El dashboard se verá vacío.</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Section count badge ── */}
              <div className="px-5 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">
                    {visibleCount} de {sections.length} secciones visibles
                  </span>
                  <span
                    className="inline-block size-1.5 rounded-full"
                    style={{
                      backgroundColor: NEON_CYAN,
                      boxShadow: `0 0 4px rgba(${NEON_CYAN_RGB},0.5)`,
                    }}
                  />
                </div>
              </div>

              {/* ── Draggable section list ── */}
              <div className="px-5 pb-4 max-h-[400px] overflow-y-auto cyber-scrollbar">
                <div className="space-y-1.5" ref={listRef}>
                  {sections.map((section, index) => (
                    <SectionRow
                      key={section.key}
                      section={section}
                      index={index}
                      totalCount={sections.length}
                      onToggleVisible={handleToggleVisible}
                      onMoveUp={handleMoveUp}
                      onMoveDown={handleMoveDown}
                      isDragTarget={dragTargetIndex === index && dragIndex !== null && dragIndex !== index}
                      isDragging={dragIndex === index}
                      dragListeners={getDragListeners(index)}
                      dragRef={getRowRef(index)}
                    />
                  ))}
                </div>
              </div>

              {/* ── Bottom neon accent line ── */}
              <div
                className="h-px w-full"
                style={{
                  background: `linear-gradient(90deg, transparent, rgba(${NEON_CYAN_RGB},0.3), transparent)`,
                }}
              />

              {/* ── Footer actions ── */}
              <div className="flex items-center justify-between px-5 py-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                  className="text-muted-foreground hover:text-[#f9f002] gap-1.5 text-xs"
                >
                  <RotateCcw className="size-3.5" />
                  Restaurar por defecto
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancel}
                    className="text-muted-foreground hover:text-foreground text-xs"
                  >
                    Cancelar
                  </Button>

                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={!hasChanges || isSaving}
                    className={`
                      relative overflow-hidden text-xs font-semibold
                      transition-all duration-300
                      ${hasChanges
                        ? 'bg-[#05d9e8]/15 text-[#05d9e8] border border-[#05d9e8]/40 hover:bg-[#05d9e8]/25 hover:border-[#05d9e8]/60'
                        : 'bg-muted/30 text-muted-foreground/50 border border-transparent cursor-not-allowed'
                      }
                    `}
                    style={
                      hasChanges
                        ? {
                            boxShadow: `0 0 12px rgba(${NEON_CYAN_RGB},0.2)`,
                            textShadow: `0 0 6px rgba(${NEON_CYAN_RGB},0.4)`,
                          }
                        : undefined
                    }
                  >
                    {isSaving ? (
                      <span className="flex items-center gap-1.5">
                        <motion.span
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          className="inline-block size-3 border-2 border-[#05d9e8]/40 border-t-[#05d9e8] rounded-full"
                        />
                        Guardando...
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <Settings2 className="size-3.5" />
                        Guardar
                      </span>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
