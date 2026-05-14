'use client'

import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod/v4'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Pencil, Trash2, PieChart, TrendingDown } from 'lucide-react'
import { toast } from 'sonner'
import { budgetService, categoryService, useAsyncData } from '@/lib/data'
import type { BudgetWithSpent } from '@/lib/data'
import { formatCurrency, formatMonthYear } from '@/lib/finance-utils'
import type { ExpenseCategory } from '@/lib/db-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
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

// ─── Zod Schema ────────────────────────────────────────────────────

const budgetSchema = z.object({
  categoryId: z.string().min(1, 'La categoría es requerida'),
  amount: z.number().min(1, 'El monto debe ser mayor a 0'),
})

type BudgetForm = z.infer<typeof budgetSchema>

// ─── Progress Color Helper ─────────────────────────────────────────

function getProgressColor(percentage: number): string {
  if (percentage <= 50) return '#01ff89' // neon-green
  if (percentage <= 75) return '#05d9e8' // neon-blue
  if (percentage <= 100) return '#f9f002' // neon-yellow
  return '#ff2a6d' // neon-pink
}

function getProgressLabel(percentage: number): string {
  if (percentage <= 50) return 'text-neon-green'
  if (percentage <= 75) return 'text-neon-blue'
  if (percentage <= 100) return 'text-neon-yellow'
  return 'text-neon-pink'
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
      toast.success(
        isEditing
          ? 'Presupuesto actualizado correctamente'
          : 'Presupuesto creado correctamente'
      )
      onSaved()
      onOpenChange(false)
    } catch (err) {
      toast.error('Error al guardar el presupuesto')
      console.error(err)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-neon-blue/20 bg-card">
        <DialogHeader>
          <DialogTitle className="text-neon-blue">
            {isEditing ? 'Editar Presupuesto' : 'Nuevo Presupuesto'}
          </DialogTitle>
          <DialogDescription>
            Define el límite de gasto para una categoría en{' '}
            {formatMonthYear(currentMonth, currentYear)}
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
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={isEditing}
                  >
                    <FormControl>
                      <SelectTrigger className="border-neon-blue/20 focus:border-neon-blue/50 w-full">
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
                      className="border-neon-blue/20 focus-visible:border-neon-blue/50"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="rounded-md border border-neon-blue/10 bg-neon-blue/5 p-3">
              <p className="text-xs text-muted-foreground">
                📅 Período: <span className="text-foreground">{formatMonthYear(currentMonth, currentYear)}</span>
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="border-neon-blue/20 hover:border-neon-blue/50"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-neon-blue/20 text-neon-blue border border-neon-blue/30 hover:bg-neon-blue/30"
              >
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
          <AlertDialogTitle className="text-neon-pink">
            ¿Eliminar presupuesto?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Se eliminará el presupuesto para{' '}
            <span className="font-semibold text-foreground">
              {budget?.categoryIcon} {budget?.categoryName}
            </span>
            . Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-neon-blue/20 hover:border-neon-blue/50">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-neon-pink/20 text-neon-pink border border-neon-pink/30 hover:bg-neon-pink/30"
          >
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ─── Budget Card ───────────────────────────────────────────────────

function BudgetCard({
  budget,
  onEdit,
  onDelete,
}: {
  budget: BudgetWithSpent
  onEdit: (b: BudgetWithSpent) => void
  onDelete: (b: BudgetWithSpent) => void
}) {
  const percentage = budget.amount > 0 ? Math.round((budget.spent / budget.amount) * 100) : 0
  const remaining = budget.amount - budget.spent
  const isOverBudget = remaining < 0
  const progressColor = getProgressColor(percentage)
  const progressLabelClass = getProgressLabel(percentage)

  return (
    <Card className="group border-border/50 bg-card/80 backdrop-blur-sm hover:border-neon-blue/30 hover:shadow-neon-blue transition-all duration-300">
      <CardContent className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="text-2xl shrink-0">{budget.categoryIcon || '💰'}</span>
            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-foreground truncate">
                {budget.categoryName || 'Sin categoría'}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                {budget.categoryColor && (
                  <div
                    className="size-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: budget.categoryColor }}
                  />
                )}
                <span className="text-xs text-muted-foreground">
                  Presupuesto: {formatCurrency(budget.amount)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-neon-blue"
              onClick={() => onEdit(budget)}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-neon-pink"
              onClick={() => onDelete(budget)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Gastado: <span className="text-foreground font-medium">{formatCurrency(budget.spent)}</span>
            </span>
            <span className={`font-mono font-bold ${progressLabelClass}`}>
              {percentage}%
            </span>
          </div>
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-primary/20">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(percentage, 100)}%`,
                backgroundColor: progressColor,
                boxShadow: `0 0 8px ${progressColor}40`,
              }}
            />
          </div>
        </div>

        {/* Remaining */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Restante:</span>
          <span
            className={`text-sm font-semibold ${
              isOverBudget ? 'text-neon-pink' : 'text-neon-green'
            }`}
          >
            {isOverBudget ? '-' : ''}
            {formatCurrency(Math.abs(remaining))}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Summary Card ──────────────────────────────────────────────────

function SummaryCard({ budgets }: { budgets: BudgetWithSpent[] }) {
  const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0)
  const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0)
  const totalRemaining = totalBudget - totalSpent
  const overallPercentage = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0
  const progressColor = getProgressColor(overallPercentage)
  const progressLabelClass = getProgressLabel(overallPercentage)
  const isOverBudget = totalRemaining < 0

  return (
    <Card className="border-neon-blue/20 bg-card/90 backdrop-blur-sm shadow-neon-blue">
      <CardContent className="p-4 md:p-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-4">
          Resumen del Período
        </h3>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Total presupuestado</p>
            <p className="text-lg font-bold text-neon-blue">
              {formatCurrency(totalBudget)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Total gastado</p>
            <p className="text-lg font-bold text-neon-pink">
              {formatCurrency(totalSpent)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Total restante</p>
            <p
              className={`text-lg font-bold ${
                isOverBudget ? 'text-neon-pink' : 'text-neon-green'
              }`}
            >
              {isOverBudget ? '-' : ''}
              {formatCurrency(Math.abs(totalRemaining))}
            </p>
          </div>
        </div>

        {/* Overall progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Progreso general</span>
            <span className={`font-mono font-bold ${progressLabelClass}`}>
              {overallPercentage}%
            </span>
          </div>
          <div className="relative h-3 w-full overflow-hidden rounded-full bg-primary/20">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(overallPercentage, 100)}%`,
                backgroundColor: progressColor,
                boxShadow: `0 0 10px ${progressColor}50`,
              }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Main Budgets Page ─────────────────────────────────────────────

export function BudgetsPage({
  currentMonth,
  currentYear,
}: {
  currentMonth?: number
  currentYear?: number
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

  return (
    <div className="page-enter p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PieChart className="size-6 text-neon-blue" />
          <div>
            <h1 className="text-2xl font-bold text-neon-blue">Presupuestos</h1>
            <p className="text-sm text-muted-foreground">
              {formatMonthYear(month, year)}
            </p>
          </div>
        </div>
        <Button
          onClick={handleCreate}
          className="bg-neon-blue/20 text-neon-blue border border-neon-blue/30 hover:bg-neon-blue/30"
        >
          <Plus className="size-4" />
          Nuevo Presupuesto
        </Button>
      </div>

      {loading ? (
        <div className="space-y-6">
          <Skeleton className="h-40 rounded-xl" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        </div>
      ) : budgetList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <TrendingDown className="size-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">No hay presupuestos</p>
          <p className="text-sm mt-1">
            Crea un presupuesto para controlar tus gastos en{' '}
            {formatMonthYear(month, year)}
          </p>
          <Button
            onClick={handleCreate}
            variant="outline"
            className="mt-4 border-neon-blue/30 text-neon-blue hover:bg-neon-blue/10"
          >
            <Plus className="size-4" />
            Crear Primer Presupuesto
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Card */}
          <SummaryCard budgets={budgetList} />

          {/* Budget Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {budgetList.map((budget) => (
              <BudgetCard
                key={budget.id}
                budget={budget}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
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
