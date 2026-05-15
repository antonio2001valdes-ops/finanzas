'use client'

import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod/v4'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Pencil, Trash2, PieChart, TrendingDown, TrendingUp, DollarSign, ChevronLeft, ChevronRight, Calendar, BarChart3 } from 'lucide-react'
import { toast } from 'sonner'
import { budgetService, categoryService, useAsyncData } from '@/lib/data'
import type { BudgetWithSpent } from '@/lib/data'
import { formatCurrency, formatMonthYear, MONTHS_ES } from '@/lib/finance-utils'
import type { ExpenseCategory } from '@/lib/db-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

// ─── Zod Schema ────────────────────────────────────────────────────

const budgetSchema = z.object({
  categoryId: z.string().min(1, 'La categoría es requerida'),
  amount: z.number().min(1, 'El monto debe ser mayor a 0'),
})

type BudgetForm = z.infer<typeof budgetSchema>

// ─── Percentage Badge ──────────────────────────────────────────────

function PercentageBadge({ percentage }: { percentage: number }) {
  let bgColor: string, borderColor: string, textColor: string

  if (percentage < 75) {
    bgColor = '#01ff8920'; borderColor = '#01ff8944'; textColor = '#01ff89'
  } else if (percentage <= 100) {
    bgColor = '#f9f00220'; borderColor = '#f9f00244'; textColor = '#f9f002'
  } else {
    bgColor = '#ff2a6d20'; borderColor = '#ff2a6d44'; textColor = '#ff2a6d'
  }

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold"
      style={{ backgroundColor: bgColor, border: `1px solid ${borderColor}`, color: textColor }}
    >
      {percentage}%
    </span>
  )
}

// ─── Budget Dialog ─────────────────────────────────────────────────

function BudgetDialog({
  open,
  onOpenChange,
  budget,
  expenseCategories,
  currentMonth,
  currentYear,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  budget: BudgetWithSpent | null
  expenseCategories: ExpenseCategory[]
  currentMonth: number
  currentYear: number
  onSaved: () => void
}) {
  const isEditing = !!budget

  const form = useForm<BudgetForm>({
    resolver: zodResolver(budgetSchema),
    defaultValues: {
      categoryId: budget?.categoryId ?? '',
      amount: budget?.amount ?? 0,
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        categoryId: budget?.categoryId ?? '',
        amount: budget?.amount ?? 0,
      })
    }
  }, [open, budget, form])

  const onSubmit = async (data: BudgetForm) => {
    try {
      await budgetService.upsert({
        id: budget?.id,
        categoryId: data.categoryId,
        month: currentMonth,
        year: currentYear,
        amount: data.amount,
      })
      toast.success(isEditing ? 'Presupuesto actualizado correctamente' : 'Presupuesto creado correctamente')
      onSaved()
      onOpenChange(false)
    } catch (err) {
      toast.error('Error al guardar el presupuesto')
      console.error(err)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[#f9f002]/20 bg-card">
        <DialogHeader>
          <DialogTitle className="text-neon-yellow">
            {isEditing ? 'Editar Presupuesto' : 'Nuevo Presupuesto'}
          </DialogTitle>
          <DialogDescription>
            Define el límite de gasto para una categoría en {formatMonthYear(currentMonth, currentYear)}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoría de Gasto</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={isEditing}>
                    <FormControl>
                      <SelectTrigger className="border-[#f9f002]/20 focus:border-[#f9f002]/50 w-full">
                        <SelectValue placeholder="Selecciona una categoría" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {expenseCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          <span className="flex items-center gap-2">
                            <span>{cat.icon}</span>
                            <span>{cat.name}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto del Presupuesto</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="Ej: 200000"
                      value={field.value || ''}
                      onChange={(e) => {
                        const val = e.target.value
                        field.onChange(val === '' ? 0 : Number(val))
                      }}
                      className="border-[#f9f002]/20 focus-visible:border-[#f9f002]/50"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="rounded-md border border-[#f9f002]/10 bg-[#f9f002]/5 p-3">
              <p className="text-xs text-muted-foreground">
                📅 Período: <span className="text-foreground">{formatMonthYear(currentMonth, currentYear)}</span>
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-[#f9f002]/20">
                Cancelar
              </Button>
              <Button type="submit" className="bg-[#f9f002]/20 text-neon-yellow border border-[#f9f002]/30 hover:bg-[#f9f002]/30">
                {isEditing ? 'Guardar Cambios' : 'Crear Presupuesto'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Delete Confirmation ───────────────────────────────────────────

function DeleteBudgetDialog({
  open,
  onOpenChange,
  budget,
  onDeleted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  budget: BudgetWithSpent | null
  onDeleted: () => void
}) {
  const handleDelete = async () => {
    if (!budget) return
    try {
      await budgetService.delete(budget.id)
      toast.success('Presupuesto eliminado correctamente')
      onDeleted()
      onOpenChange(false)
    } catch (err) {
      toast.error('Error al eliminar el presupuesto')
      console.error(err)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="border-neon-pink/20 bg-card">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-neon-pink">¿Eliminar presupuesto?</AlertDialogTitle>
          <AlertDialogDescription>
            Se eliminará el presupuesto para{' '}
            <span className="font-semibold text-foreground">{budget?.categoryIcon} {budget?.categoryName}</span>.
            Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-neon-blue/20">Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} className="bg-neon-pink/20 text-neon-pink border border-neon-pink/30 hover:bg-neon-pink/30">
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ─── Main Budgets Page ─────────────────────────────────────────────

export function BudgetsPage({
  currentMonth,
  currentYear,
  onMonthChange,
}: {
  currentMonth?: number
  currentYear?: number
  onMonthChange?: (month: number, year: number) => void
}) {
  const now = new Date()
  const month = currentMonth ?? now.getMonth() + 1
  const year = currentYear ?? now.getFullYear()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingBudget, setEditingBudget] = useState<BudgetWithSpent | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingBudget, setDeletingBudget] = useState<BudgetWithSpent | null>(null)
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([])

  const fetchBudgets = useCallback(async () => {
    const [budgets, categories] = await Promise.all([
      budgetService.getAll(month, year),
      categoryService.getAll('expense') as Promise<ExpenseCategory[]>,
    ])
    setExpenseCategories(categories)
    return budgets
  }, [month, year])

  const { data: budgets, loading, refetch } = useAsyncData(fetchBudgets, [month, year])

  const handleCreate = () => {
    setEditingBudget(null)
    setDialogOpen(true)
  }

  const handleEdit = (budget: BudgetWithSpent) => {
    setEditingBudget(budget)
    setDialogOpen(true)
  }

  const handleDelete = (budget: BudgetWithSpent) => {
    setDeletingBudget(budget)
    setDeleteDialogOpen(true)
  }

  const budgetList = budgets ?? []

  // ── Summary calculations ──
  const totalBudget = budgetList.reduce((sum, b) => sum + b.amount, 0)
  const totalSpent = budgetList.reduce((sum, b) => sum + b.spent, 0)
  const totalRemaining = totalBudget - totalSpent
  const isOverBudget = totalRemaining < 0

  // ── Month navigation ──
  const handlePrevMonth = () => {
    const m = month === 1 ? 12 : month - 1
    const y = month === 1 ? year - 1 : year
    onMonthChange?.(m, y)
  }
  const handleNextMonth = () => {
    const m = month === 12 ? 1 : month + 1
    const y = month === 12 ? year + 1 : year
    onMonthChange?.(m, y)
  }

  return (
    <div className="page-enter p-4 md:p-6 space-y-5 overflow-y-auto cyber-scrollbar">
      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <PieChart className="size-6 text-neon-yellow" />
          <div>
            <h1
              className="text-2xl font-bold text-neon-yellow"
              style={{ textShadow: '0 0 10px rgba(249,240,2,0.4)' }}
            >
              Presupuestos — {formatCurrency(totalBudget)} total
            </h1>
            <p className="text-sm text-muted-foreground">{formatMonthYear(month, year)}</p>
          </div>
        </div>
        <Button
          onClick={handleCreate}
          className="bg-[#f9f002]/20 text-neon-yellow border border-[#f9f002]/30 hover:bg-[#f9f002]/30"
          style={{ boxShadow: '0 0 10px #f9f00220' }}
        >
          <Plus className="size-4" />
          Agregar Presupuesto
        </Button>
      </motion.div>

      {/* ── Calendar Month Selector ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="border-[#f9f002]/30 bg-card/80 backdrop-blur-sm" style={{ boxShadow: '0 0 12px rgba(249,240,2,0.1)' }}>
          <CardContent className="p-3">
            {/* Navigation row */}
            <div className="flex items-center justify-between mb-2">
              <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-neon-yellow hover:bg-neon-yellow/10" onClick={handlePrevMonth}>
                <ChevronLeft className="size-4" />
              </Button>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-neon-yellow tabular-nums">
                  {MONTHS_ES[month - 1]} {year}
                </span>
                {month === now.getMonth() + 1 && year === now.getFullYear() && (
                  <span className="text-[10px] font-medium text-neon-yellow px-2 py-0.5 rounded-full bg-neon-yellow/10 border border-neon-yellow/30">
                    Hoy
                  </span>
                )}
              </div>
              <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-neon-yellow hover:bg-neon-yellow/10" onClick={handleNextMonth}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
            {/* Month grid 6x2 */}
            <div className="grid grid-cols-6 sm:grid-cols-12 gap-1">
              {MONTHS_ES.map((name, i) => {
                const m = i + 1
                const isActive = m === month
                return (
                  <button
                    key={m}
                    onClick={() => onMonthChange?.(m, year)}
                    className={cn(
                      'rounded px-1 py-1 text-[10px] font-medium transition-all',
                      isActive
                        ? 'bg-neon-yellow/20 text-neon-yellow border border-neon-yellow/40'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground border border-transparent'
                    )}
                  >
                    {name.substring(0, 3)}
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Summary Cards (3 cols) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="border-[#05d9e8]/30 bg-card/80" style={{ boxShadow: '0 0 10px #05d9e820' }}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="size-4 text-neon-cyan" />
                <p className="text-xs text-muted-foreground">Total Presupuestado</p>
              </div>
              <p className="text-2xl font-bold text-neon-cyan tabular-nums" style={{ textShadow: '0 0 8px rgba(5,217,232,0.4)' }}>
                {formatCurrency(totalBudget)}
              </p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="border-[#ff2a6d]/30 bg-card/80" style={{ boxShadow: '0 0 10px #ff2a6d20' }}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="size-4 text-neon-pink" />
                <p className="text-xs text-muted-foreground">Total Gastado</p>
              </div>
              <p className="text-2xl font-bold text-neon-pink tabular-nums" style={{ textShadow: '0 0 8px rgba(255,42,109,0.4)' }}>
                {formatCurrency(totalSpent)}
              </p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="border-[#01ff89]/30 bg-card/80" style={{ boxShadow: '0 0 10px #01ff8920' }}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="size-4 text-neon-green" />
                <p className="text-xs text-muted-foreground">Total Restante</p>
              </div>
              <p
                className="text-2xl font-bold tabular-nums"
                style={{ color: isOverBudget ? '#ff2a6d' : '#01ff89', textShadow: `0 0 8px rgba(${isOverBudget ? '255,42,109' : '1,255,137'},0.4)` }}
              >
                {isOverBudget ? '-' : ''}{formatCurrency(Math.abs(totalRemaining))}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ── Budgets Table or Empty State ── */}
      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : budgetList.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card
            className="border-[#f9f002]/10 bg-card/50 backdrop-blur-sm"
            style={{ boxShadow: '0 0 10px #f9f00210' }}
          >
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <BarChart3 className="size-12 mb-4 opacity-30" />
              <p className="text-lg font-medium">Sin presupuestos</p>
              <p className="text-sm mt-1">
                Agrega tu primer presupuesto para controlar tus gastos mensuales
              </p>
              <Button
                onClick={handleCreate}
                variant="outline"
                className="mt-4 border-[#f9f002]/30 text-neon-yellow hover:bg-[#f9f002]/10"
              >
                <Plus className="size-4" />
                Crear Primer Presupuesto
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card
            className="border-neon-yellow/20 bg-card/80 backdrop-blur-sm"
            style={{ boxShadow: '0 0 15px #f9f00210' }}
          >
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-neon-yellow/10 hover:bg-transparent">
                      <TableHead className="text-muted-foreground">Categoría</TableHead>
                      <TableHead className="text-muted-foreground text-right">Presupuestado</TableHead>
                      <TableHead className="text-muted-foreground text-right">Gastado</TableHead>
                      <TableHead className="text-muted-foreground text-right">Restante</TableHead>
                      <TableHead className="text-muted-foreground text-center">Porcentaje</TableHead>
                      <TableHead className="text-muted-foreground text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {budgetList.map((budget) => {
                      const percentage = budget.amount > 0 ? Math.round((budget.spent / budget.amount) * 100) : 0
                      const remaining = budget.amount - budget.spent
                      const isOver = remaining < 0

                      return (
                        <TableRow key={budget.id} className="border-neon-yellow/5 hover:bg-neon-yellow/5 transition-colors">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{budget.categoryIcon || '💰'}</span>
                              <span className="font-medium">{budget.categoryName || 'Sin categoría'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono" style={{ color: '#05d9e8' }}>
                            {formatCurrency(budget.amount)}
                          </TableCell>
                          <TableCell className="text-right font-mono" style={{ color: '#ff2a6d' }}>
                            {formatCurrency(budget.spent)}
                          </TableCell>
                          <TableCell
                            className="text-right font-mono font-semibold"
                            style={{ color: isOver ? '#ff2a6d' : '#01ff89' }}
                          >
                            {isOver ? '-' : ''}{formatCurrency(Math.abs(remaining))}
                          </TableCell>
                          <TableCell className="text-center">
                            <PercentageBadge percentage={percentage} />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-neon-blue" onClick={() => handleEdit(budget)} title="Editar">
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-neon-pink" onClick={() => handleDelete(budget)} title="Eliminar">
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}

                    {/* TOTAL row */}
                    <TableRow className="border-[#f9f002]/20 bg-[#f9f002]/5 hover:bg-[#f9f002]/10">
                      <TableCell className="font-bold" style={{ color: '#f9f002' }}>TOTAL</TableCell>
                      <TableCell className="text-right font-mono font-bold" style={{ color: '#05d9e8' }}>
                        {formatCurrency(totalBudget)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold" style={{ color: '#ff2a6d' }}>
                        {formatCurrency(totalSpent)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold" style={{ color: isOverBudget ? '#ff2a6d' : '#01ff89' }}>
                        {isOverBudget ? '-' : ''}{formatCurrency(Math.abs(totalRemaining))}
                      </TableCell>
                      <TableCell className="text-center">
                        <PercentageBadge percentage={totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0} />
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Budget Create/Edit Dialog */}
      <BudgetDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        budget={editingBudget}
        expenseCategories={expenseCategories}
        currentMonth={month}
        currentYear={year}
        onSaved={refetch}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteBudgetDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        budget={deletingBudget}
        onDeleted={refetch}
      />
    </div>
  )
}


