'use client'

import { useState, useEffect, useCallback } from 'react'
import { Settings2, GripVertical, Eye, EyeOff, RotateCcw, X } from 'lucide-react'
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
  onToggleVisible,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDraggedOver,
  isDragging,
}: {
  section: DashboardSectionConfig
  index: number
  onToggleVisible: (key: string) => void
  onDragStart: (e: React.DragEvent, index: number) => void
  onDragOver: (e: React.DragEvent, index: number) => void
  onDrop: (e: React.DragEvent, index: number) => void
  onDragEnd: () => void
  isDraggedOver: boolean
  isDragging: boolean
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: isDragging ? 0.4 : 1, x: 0, scale: isDragging ? 0.97 : 1 }}
      transition={{ duration: 0.2, delay: index * 0.03 }}
      draggable
      onDragStart={(e) => onDragStart(e as unknown as React.DragEvent, index)}
      onDragOver={(e) => onDragOver(e as unknown as React.DragEvent, index)}
      onDrop={(e) => onDrop(e as unknown as React.DragEvent, index)}
      onDragEnd={onDragEnd}
      className={`
        group relative flex items-center gap-3 rounded-lg border px-3 py-2.5
        transition-all duration-200 cursor-grab active:cursor-grabbing select-none
        ${isDraggedOver
          ? 'border-[#05d9e8]/60 bg-[#05d9e8]/8'
          : 'border-border/40 bg-card/60 hover:bg-card/80 hover:border-[#05d9e8]/30'
        }
        ${isDragging ? 'shadow-lg' : ''}
      `}
      style={
        isDraggedOver
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
      {/* Grip Handle */}
      <div className="flex items-center justify-center shrink-0">
        <GripVertical
          className="size-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors"
        />
      </div>

      {/* Drag indicator line (shown on drag-over) */}
      {isDraggedOver && (
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
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // ── Load preferences when dialog opens ──
  const loadPreferences = useCallback(async () => {
    try {
      const prefs = await dashboardPrefsService.get()
      const sorted = [...prefs.sections].sort((a, b) => a.order - b.order)
      setSections(sorted)
      setHasChanges(false)
      setDragIndex(null)
      setDragOverIndex(null)
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

  // ── Drag & Drop handlers (HTML5 native) ──
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDragIndex(index)
    // Set drag image data
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', String(index))
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move'
    }
    setDragOverIndex(index)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent, dropIndex: number) => {
      e.preventDefault()
      if (dragIndex === null || dragIndex === dropIndex) {
        setDragIndex(null)
        setDragOverIndex(null)
        return
      }

      setSections((prev) => {
        const updated = [...prev]
        const [removed] = updated.splice(dragIndex, 1)
        updated.splice(dropIndex, 0, removed)
        // Reassign order values
        return updated.map((s, i) => ({ ...s, order: i }))
      })

      setHasChanges(true)
      setDragIndex(null)
      setDragOverIndex(null)
    },
    [dragIndex]
  )

  const handleDragEnd = useCallback(() => {
    setDragIndex(null)
    setDragOverIndex(null)
  }, [])

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
                      Arrastra para reordenar · Oculta las secciones que no necesites
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
                <div className="space-y-1.5">
                  {sections.map((section, index) => (
                    <SectionRow
                      key={section.key}
                      section={section}
                      index={index}
                      onToggleVisible={handleToggleVisible}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      onDragEnd={handleDragEnd}
                      isDraggedOver={dragOverIndex === index && dragIndex !== null && dragIndex !== index}
                      isDragging={dragIndex === index}
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
