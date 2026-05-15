'use client'

import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod/v4'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Pencil, Trash2, Tags, TrendingUp, TrendingDown } from 'lucide-react'
import { toast } from 'sonner'
import { categoryService, useAsyncData } from '@/lib/data'
import { formatCurrency } from '@/lib/finance-utils'
import type { IncomeCategory, ExpenseCategory } from '@/lib/db-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
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
import { Skeleton } from '@/components/ui/skeleton'

// ─── Zod Schemas ───────────────────────────────────────────────────

const incomeCategorySchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  icon: z.string().min(1, 'El ícono es requerido'),
  color: z.string().min(1, 'El color es requerido'),
})

const expenseCategorySchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  icon: z.string().min(1, 'El ícono es requerido'),
  color: z.string().min(1, 'El color es requerido'),
  budgetLimit: z.number().min(0, 'El límite debe ser positivo').optional(),
})

type IncomeCategoryForm = z.infer<typeof incomeCategorySchema>
type ExpenseCategoryForm = z.infer<typeof expenseCategorySchema>

// ─── Category Dialog ───────────────────────────────────────────────

function CategoryDialog({
  open,
  onOpenChange,
  type,
  category,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: 'income' | 'expense'
  category?: (IncomeCategory & { budgetLimit?: number }) | null
  onSaved: () => void
}) {
  const isEditing = !!category
  const title = isEditing
    ? `Editar Categoría de ${type === 'income' ? 'Ingreso' : 'Gasto'}`
    : `Nueva Categoría de ${type === 'income' ? 'Ingreso' : 'Gasto'}`

  const form = useForm<IncomeCategoryForm | ExpenseCategoryForm>({
    resolver: zodResolver(
      type === 'expense' ? expenseCategorySchema : incomeCategorySchema
    ),
    defaultValues: {
      name: category?.name ?? '',
      icon: category?.icon ?? '📦',
      color: category?.color ?? '#05d9e8',
      budgetLimit: (category as ExpenseCategory)?.budgetLimit ?? undefined,
    },
  })

  // Reset form when dialog opens or category changes
  useEffect(() => {
    if (open) {
      form.reset({
        name: category?.name ?? '',
        icon: category?.icon ?? '📦',
        color: category?.color ?? '#05d9e8',
        budgetLimit: (category as ExpenseCategory)?.budgetLimit ?? undefined,
      })
    }
  }, [open, category, form])

  const onSubmit = async (data: IncomeCategoryForm | ExpenseCategoryForm) => {
    try {
      if (isEditing && category) {
        await categoryService.update(type, category.id, data)
        toast.success('Categoría actualizada correctamente')
      } else {
        await categoryService.create(type, data)
        toast.success('Categoría creada correctamente')
      }
      onSaved()
      onOpenChange(false)
    } catch (err) {
      toast.error('Error al guardar la categoría')
      console.error(err)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-neon-blue/20 bg-card">
        <DialogHeader>
          <DialogTitle className="text-neon-blue">{title}</DialogTitle>
          <DialogDescription>
            {type === 'income'
              ? 'Configura los detalles de la categoría de ingreso'
              : 'Configura los detalles de la categoría de gasto'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ej: Salario, Alimentación..."
                      {...field}
                      className="border-neon-blue/20 focus-visible:border-neon-blue/50"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="icon"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ícono (emoji)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="📦"
                        {...field}
                        className="border-neon-blue/20 focus-visible:border-neon-blue/50"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color (hex)</FormLabel>
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Input
                          placeholder="#05d9e8"
                          {...field}
                          className="border-neon-blue/20 focus-visible:border-neon-blue/50"
                        />
                      </FormControl>
                      <div
                        className="size-8 rounded-md border border-border shrink-0"
                        style={{ backgroundColor: field.value || '#05d9e8' }}
                      />
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {type === 'expense' && (
              <FormField
                control={form.control}
                name="budgetLimit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Límite de Presupuesto (opcional)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Ej: 200000"
                        value={field.value ?? ''}
                        onChange={(e) => {
                          const val = e.target.value
                          field.onChange(val === '' ? undefined : Number(val))
                        }}
                        className="border-neon-blue/20 focus-visible:border-neon-blue/50"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

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
                {isEditing ? 'Guardar Cambios' : 'Crear Categoría'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Delete Confirmation ───────────────────────────────────────────

function DeleteCategoryDialog({
  open,
  onOpenChange,
  category,
  type,
  onDeleted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  category: IncomeCategory | ExpenseCategory | null
  type: 'income' | 'expense'
  onDeleted: () => void
}) {
  const handleDelete = async () => {
    if (!category) return
    try {
      await categoryService.delete(category.id, type)
      toast.success('Categoría eliminada correctamente')
      onDeleted()
      onOpenChange(false)
    } catch (err) {
      toast.error('Error al eliminar la categoría')
      console.error(err)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="border-neon-pink/20 bg-card">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-neon-pink">
            ¿Eliminar categoría?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción no se puede deshacer. Se eliminará la categoría{' '}
            <span className="font-semibold text-foreground">
              {category?.icon} {category?.name}
            </span>{' '}
            permanentemente.
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

// ─── Category Card ─────────────────────────────────────────────────

function CategoryCard({
  category,
  type,
  onEdit,
  onDelete,
}: {
  category: IncomeCategory | ExpenseCategory
  type: 'income' | 'expense'
  onEdit: (cat: IncomeCategory | ExpenseCategory) => void
  onDelete: (cat: IncomeCategory | ExpenseCategory) => void
}) {
  const isExpense = type === 'expense'
  const expenseCat = category as ExpenseCategory

  return (
    <Card className="group relative border-border/50 bg-card/80 backdrop-blur-sm hover:border-neon-blue/30 hover:shadow-neon-blue transition-all duration-300">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="text-2xl shrink-0">{category.icon}</span>
            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-foreground truncate">
                {category.name}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <div
                  className="size-3 rounded-full shrink-0"
                  style={{ backgroundColor: category.color }}
                />
                <span className="text-xs text-muted-foreground font-mono">
                  {category.color}
                </span>
              </div>
              {isExpense && expenseCat.budgetLimit && (
                <p className="text-xs text-neon-green mt-1">
                  Límite: {formatCurrency(expenseCat.budgetLimit)}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-neon-blue"
              onClick={() => onEdit(category)}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-neon-pink"
              onClick={() => onDelete(category)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Main Categories Page ──────────────────────────────────────────

export function CategoriesPage({
  currentMonth,
  currentYear,
}: {
  currentMonth?: number
  currentYear?: number
}) {
  const [activeTab, setActiveTab] = useState<'income' | 'expense'>('expense')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<
    (IncomeCategory & { budgetLimit?: number }) | null
  >(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingCategory, setDeletingCategory] = useState<
    IncomeCategory | ExpenseCategory | null
  >(null)

  const fetchCategories = useCallback(async () => {
    const result = await categoryService.getAll()
    return result as { income: IncomeCategory[]; expense: ExpenseCategory[] }
  }, [])

  const { data: categories, loading, refetch } = useAsyncData(fetchCategories, [])

  const incomeCategories = categories?.income ?? []
  const expenseCategories = categories?.expense ?? []

  const handleCreate = () => {
    setEditingCategory(null)
    setDialogOpen(true)
  }

  const handleEdit = (cat: IncomeCategory | ExpenseCategory) => {
    setEditingCategory(cat as IncomeCategory & { budgetLimit?: number })
    setDialogOpen(true)
  }

  const handleDelete = (cat: IncomeCategory | ExpenseCategory) => {
    setDeletingCategory(cat)
    setDeleteDialogOpen(true)
  }

  return (
    <div className="page-enter p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Tags className="size-6 text-neon-blue" />
          <h1 className="text-2xl font-bold text-neon-blue">Categorías</h1>
        </div>
        <Button
          onClick={handleCreate}
          className="bg-neon-blue/20 text-neon-blue border border-neon-blue/30 hover:bg-neon-blue/30"
        >
          <Plus className="size-4" />
          Nueva Categoría
        </Button>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'income' | 'expense')}
      >
        <TabsList className="bg-muted/50 border border-border/50">
          <TabsTrigger
            value="income"
            className="data-[state=active]:bg-neon-green/20 data-[state=active]:text-neon-green"
          >
            <TrendingUp className="size-4" />
            Ingresos
          </TabsTrigger>
          <TabsTrigger
            value="expense"
            className="data-[state=active]:bg-neon-pink/20 data-[state=active]:text-neon-pink"
          >
            <TrendingDown className="size-4" />
            Gastos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="income" className="mt-4">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          ) : incomeCategories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <TrendingUp className="size-12 mb-4 opacity-30" />
              <p className="text-lg font-medium">No hay categorías de ingreso</p>
              <p className="text-sm mt-1">
                Crea una categoría para comenzar a clasificar tus ingresos
              </p>
              <Button
                onClick={handleCreate}
                variant="outline"
                className="mt-4 border-neon-green/30 text-neon-green hover:bg-neon-green/10"
              >
                <Plus className="size-4" />
                Crear Categoría de Ingreso
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {incomeCategories.map((cat) => (
                <CategoryCard
                  key={cat.id}
                  category={cat}
                  type="income"
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="expense" className="mt-4">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          ) : expenseCategories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <TrendingDown className="size-12 mb-4 opacity-30" />
              <p className="text-lg font-medium">No hay categorías de gasto</p>
              <p className="text-sm mt-1">
                Crea una categoría para comenzar a clasificar tus gastos
              </p>
              <Button
                onClick={handleCreate}
                variant="outline"
                className="mt-4 border-neon-pink/30 text-neon-pink hover:bg-neon-pink/10"
              >
                <Plus className="size-4" />
                Crear Categoría de Gasto
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {expenseCategories.map((cat) => (
                <CategoryCard
                  key={cat.id}
                  category={cat}
                  type="expense"
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Category Create/Edit Dialog */}
      <CategoryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        type={activeTab}
        category={editingCategory}
        onSaved={refetch}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteCategoryDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        category={deletingCategory}
        type={activeTab}
        onDeleted={refetch}
      />
    </div>
  )
}
