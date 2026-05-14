'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod/v4'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Repeat,
  Plus,
  Pencil,
  Trash2,
  Banknote,
  CalendarClock,
  CalendarDays,
  Tag,
  Power,
  PowerOff,
} from 'lucide-react'
import { toast } from 'sonner'
import { recurringService, categoryService, useAsyncData } from '@/lib/data'
import { formatCurrency, formatDate, RECURRING_INTERVALS } from '@/lib/finance-utils'
import type { RecurringPayment, ExpenseCategory } from '@/lib/db-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form'

// ─── Zod Schemas ────────────────────────────────────────────────────

const recurringSchema = z.object({
  name: z.string().min(1, 'Nombre es requerido'),
  amount: z.number().min(1, 'El monto debe ser mayor a 0'),
  interval: z.enum(['monthly', 'weekly', 'yearly']),
  dueDay: z.number().min(1, 'Día mínimo es 1').max(31, 'Día máximo es 31'),
  categoryId: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean(),
})

type RecurringForm = z.infer<typeof recurringSchema>

// ─── Component ──────────────────────────────────────────────────────

export function RecurringPage({ currentMonth, currentYear }: { currentMonth?: number; currentYear?: number }) {
  // Data
  const { data: recurringPayments, loading, refetch } = useAsyncData<RecurringPayment[]>(
    () => recurringService.getAll(),
    []
  )

  // Expense categories for select
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([])
  useEffect(() => {
    categoryService.getAll('expense').then((cats) => {
      if (Array.isArray(cats)) {
        setExpenseCategories(cats as ExpenseCategory[])
      }
    })
  }, [])

  // Dialog states
  const [recurringDialogOpen, setRecurringDialogOpen] = useState(false)
  const [editingRecurring, setEditingRecurring] = useState<RecurringPayment | null>(null)
  const [payDialogOpen, setPayDialogOpen] = useState(false)
  const [selectedRecurring, setSelectedRecurring] = useState<RecurringPayment | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [recurringToDelete, setRecurringToDelete] = useState<RecurringPayment | null>(null)

  // Submitting states
  const [submittingRecurring, setSubmittingRecurring] = useState(false)
  const [paying, setPaying] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // ─── Recurring Form ─────────────────────────────────────────────

  const recurringForm = useForm<RecurringForm>({
    resolver: zodResolver(recurringSchema),
    defaultValues: {
      name: '',
      amount: 0,
      interval: 'monthly',
      dueDay: 1,
      categoryId: '',
      description: '',
      isActive: true,
    },
  })

  const openCreateRecurring = () => {
    setEditingRecurring(null)
    recurringForm.reset({
      name: '',
      amount: 0,
      interval: 'monthly',
      dueDay: 1,
      categoryId: '',
      description: '',
      isActive: true,
    })
    setRecurringDialogOpen(true)
  }

  const openEditRecurring = (payment: RecurringPayment) => {
    setEditingRecurring(payment)
    recurringForm.reset({
      name: payment.name,
      amount: payment.amount,
      interval: payment.interval as 'monthly' | 'weekly' | 'yearly',
      dueDay: payment.dueDay,
      categoryId: payment.categoryId || '',
      description: payment.description || '',
      isActive: payment.isActive,
    })
    setRecurringDialogOpen(true)
  }

  const onSubmitRecurring = async (data: RecurringForm) => {
    setSubmittingRecurring(true)
    try {
      if (editingRecurring) {
        await recurringService.update(editingRecurring.id, {
          name: data.name,
          amount: data.amount,
          interval: data.interval,
          dueDay: data.dueDay,
          categoryId: data.categoryId || undefined,
          description: data.description || undefined,
          isActive: data.isActive,
        })
        toast.success('Pago recurrente actualizado')
      } else {
        await recurringService.create({
          name: data.name,
          amount: data.amount,
          interval: data.interval,
          dueDay: data.dueDay,
          categoryId: data.categoryId || undefined,
          description: data.description || undefined,
          isActive: data.isActive,
        })
        toast.success('Pago recurrente creado')
      }
      setRecurringDialogOpen(false)
      refetch()
    } catch {
      toast.error('Error al guardar el pago recurrente')
    } finally {
      setSubmittingRecurring(false)
    }
  }

  // ─── Pay ────────────────────────────────────────────────────────

  const openPayDialog = (payment: RecurringPayment) => {
    setSelectedRecurring(payment)
    setPayDialogOpen(true)
  }

  const onConfirmPay = async () => {
    if (!selectedRecurring) return
    setPaying(true)
    try {
      await recurringService.pay(selectedRecurring.id)
      toast.success(`Pago de ${formatCurrency(selectedRecurring.amount)} registrado como gasto`)
      setPayDialogOpen(false)
      refetch()
    } catch {
      toast.error('Error al registrar el pago')
    } finally {
      setPaying(false)
    }
  }

  // ─── Delete Recurring ──────────────────────────────────────────

  const confirmDeleteRecurring = (payment: RecurringPayment) => {
    setRecurringToDelete(payment)
    setDeleteDialogOpen(true)
  }

  const onDeleteRecurring = async () => {
    if (!recurringToDelete) return
    setDeleting(true)
    try {
      await recurringService.delete(recurringToDelete.id)
      toast.success('Pago recurrente eliminado')
      setDeleteDialogOpen(false)
      refetch()
    } catch {
      toast.error('Error al eliminar el pago recurrente')
    } finally {
      setDeleting(false)
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────

  const getCategoryName = (categoryId?: string) => {
    if (!categoryId) return null
    const cat = expenseCategories.find((c) => c.id === categoryId)
    return cat?.name || null
  }

  const getIntervalBadge = (interval: string) => {
    const colors: Record<string, string> = {
      monthly: 'border-neon-cyan/50 text-neon-cyan bg-neon-cyan/10',
      weekly: 'border-neon-blue/50 text-neon-blue bg-neon-blue/10',
      yearly: 'border-neon-yellow/50 text-neon-yellow bg-neon-yellow/10',
    }
    return (
      <Badge
        variant="outline"
        className={colors[interval] || 'border-muted text-muted-foreground'}
      >
        {RECURRING_INTERVALS[interval] || interval}
      </Badge>
    )
  }

  // ─── Render ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="page-enter p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-neon-cyan">Pagos Recurrentes</h1>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border-neon-cyan/20 animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-1/3 mb-4" />
                <div className="h-3 bg-muted rounded w-1/2 mb-2" />
                <div className="h-3 bg-muted rounded w-1/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="page-enter p-6 cyber-scrollbar overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Repeat className="size-7 text-neon-cyan" />
          <h1 className="text-2xl font-bold text-neon-cyan">Pagos Recurrentes</h1>
        </div>
        <Button
          onClick={openCreateRecurring}
          className="bg-neon-cyan/20 border border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/30 hover:shadow-neon-blue transition-all"
        >
          <Plus className="size-4 mr-2" />
          Nuevo Recurrente
        </Button>
      </div>

      {/* Empty State */}
      {!recurringPayments || recurringPayments.length === 0 ? (
        <Card className="border-neon-cyan/20">
          <CardContent className="p-12 text-center">
            <Repeat className="size-16 text-neon-cyan/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">
              No hay pagos recurrentes
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Agrega tus pagos recurrentes para no olvidar ninguna fecha
            </p>
            <Button
              onClick={openCreateRecurring}
              className="bg-neon-cyan/20 border border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/30"
            >
              <Plus className="size-4 mr-2" />
              Agregar Recurrente
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Recurring Payments List */
        <div className="space-y-3">
          {recurringPayments.map((payment) => {
            const isActive = payment.isActive
            const categoryName = getCategoryName(payment.categoryId)

            return (
              <Card
                key={payment.id}
                className={`transition-all ${
                  isActive
                    ? 'border-neon-cyan/20 hover:border-neon-cyan/40 hover:shadow-neon-blue'
                    : 'border-muted/30 opacity-60'
                }`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Repeat
                        className={`size-5 ${
                          isActive ? 'text-neon-cyan' : 'text-muted-foreground'
                        }`}
                      />
                      <div>
                        <CardTitle className="text-base text-foreground">
                          {payment.name}
                        </CardTitle>
                        {categoryName && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                            <Tag className="size-3" />
                            <span>{categoryName}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        className={
                          isActive
                            ? 'border-neon-green/50 text-neon-green bg-neon-green/10'
                            : 'border-muted text-muted-foreground bg-muted/10'
                        }
                        variant="outline"
                      >
                        {isActive ? (
                          <><Power className="size-3 mr-1" />Activo</>
                        ) : (
                          <><PowerOff className="size-3 mr-1" />Inactivo</>
                        )}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditRecurring(payment)}
                        className="size-8 p-0 text-muted-foreground hover:text-neon-cyan"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => confirmDeleteRecurring(payment)}
                        className="size-8 p-0 text-muted-foreground hover:text-neon-pink"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs mb-0.5">Monto</p>
                      <p className="text-neon-cyan font-semibold">{formatCurrency(payment.amount)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-0.5">Intervalo</p>
                      {getIntervalBadge(payment.interval)}
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-0.5">Día de Pago</p>
                      <div className="flex items-center gap-1">
                        <CalendarClock className="size-3 text-muted-foreground" />
                        <span className="font-medium">Día {payment.dueDay}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-0.5">Próximo Vencimiento</p>
                      <div className="flex items-center gap-1">
                        <CalendarDays className="size-3 text-muted-foreground" />
                        <span className="font-medium">{formatDate(payment.nextDueDate)}</span>
                      </div>
                    </div>
                  </div>

                  {payment.description && (
                    <p className="text-xs text-muted-foreground mt-2">{payment.description}</p>
                  )}

                  {/* Pay button */}
                  {isActive && (
                    <div className="mt-3 pt-2 border-t border-border/50">
                      <Button
                        size="sm"
                        onClick={() => openPayDialog(payment)}
                        className="bg-neon-green/15 border border-neon-green/40 text-neon-green hover:bg-neon-green/25 text-xs"
                      >
                        <Banknote className="size-3 mr-1" />
                        Pagar {formatCurrency(payment.amount)}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* ─── Create/Edit Recurring Dialog ─────────────────────────── */}
      <Dialog open={recurringDialogOpen} onOpenChange={setRecurringDialogOpen}>
        <DialogContent className="bg-card border-neon-cyan/20 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-neon-cyan">
              {editingRecurring ? 'Editar Pago Recurrente' : 'Nuevo Pago Recurrente'}
            </DialogTitle>
            <DialogDescription>
              {editingRecurring
                ? 'Modifica los datos del pago recurrente'
                : 'Configura un nuevo pago recurrente para automatizar tus gastos'}
            </DialogDescription>
          </DialogHeader>

          <Form {...recurringForm}>
            <form onSubmit={recurringForm.handleSubmit(onSubmitRecurring)} className="space-y-4">
              <FormField
                control={recurringForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ej: Arriendo"
                        {...field}
                        className="border-neon-cyan/20 focus:border-neon-cyan/50"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={recurringForm.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monto</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="0"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                          className="border-neon-cyan/20 focus:border-neon-cyan/50"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={recurringForm.control}
                  name="interval"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Intervalo</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="border-neon-cyan/20 focus:border-neon-cyan/50 w-full">
                            <SelectValue placeholder="Selecciona" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="monthly">Mensual</SelectItem>
                          <SelectItem value="weekly">Semanal</SelectItem>
                          <SelectItem value="yearly">Anual</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={recurringForm.control}
                  name="dueDay"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Día de Pago (1-31)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={31}
                          placeholder="1"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value) || 1)}
                          className="border-neon-cyan/20 focus:border-neon-cyan/50"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={recurringForm.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoría</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value || '__none__'}
                      >
                        <FormControl>
                          <SelectTrigger className="border-neon-cyan/20 focus:border-neon-cyan/50 w-full">
                            <SelectValue placeholder="Sin categoría" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">Sin categoría</SelectItem>
                          {expenseCategories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.icon} {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={recurringForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción (opcional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Notas adicionales..."
                        {...field}
                        className="border-neon-cyan/20 focus:border-neon-cyan/50 resize-none"
                        rows={2}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={recurringForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border border-neon-cyan/20 p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Activo</FormLabel>
                      <p className="text-xs text-muted-foreground">
                        Los pagos inactivos no generarán recordatorios
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRecurringDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={submittingRecurring}
                  className="bg-neon-cyan/20 border border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/30"
                >
                  {submittingRecurring
                    ? 'Guardando...'
                    : editingRecurring
                      ? 'Actualizar'
                      : 'Crear Recurrente'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ─── Pay Confirmation Dialog ──────────────────────────────── */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="bg-card border-neon-green/20">
          <DialogHeader>
            <DialogTitle className="text-neon-green">
              Confirmar Pago Recurrente
            </DialogTitle>
            <DialogDescription>
              Se creará un gasto y se avanzará la fecha del próximo pago
            </DialogDescription>
          </DialogHeader>

          {selectedRecurring && (
            <div className="space-y-3 py-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Nombre</span>
                <span className="font-medium">{selectedRecurring.name}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Monto</span>
                <span className="text-neon-cyan font-semibold">
                  {formatCurrency(selectedRecurring.amount)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Próximo Vencimiento</span>
                <span className="font-medium">
                  {formatDate(selectedRecurring.nextDueDate)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Intervalo</span>
                {getIntervalBadge(selectedRecurring.interval)}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPayDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={onConfirmPay}
              disabled={paying}
              className="bg-neon-green/20 border border-neon-green/50 text-neon-green hover:bg-neon-green/30"
            >
              <Banknote className="size-4 mr-2" />
              {paying ? 'Procesando...' : 'Confirmar Pago'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation ──────────────────────────────────── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border-neon-pink/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-neon-pink">Eliminar Pago Recurrente</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de eliminar el pago recurrente &quot;{recurringToDelete?.name}&quot;?
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDeleteRecurring}
              disabled={deleting}
              className="bg-neon-pink/20 border border-neon-pink/50 text-neon-pink hover:bg-neon-pink/30"
            >
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
