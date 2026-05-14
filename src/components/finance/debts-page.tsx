'use client'

import { useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod/v4'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  CreditCard,
  Plus,
  Pencil,
  Trash2,
  Banknote,
  ChevronDown,
  ChevronUp,
  CalendarDays,
  Percent,
  TrendingDown,
} from 'lucide-react'
import { toast } from 'sonner'
import { debtService, useAsyncData } from '@/lib/data'
import { formatCurrency, formatDate, DEBT_STATUS } from '@/lib/finance-utils'
import type { Debt, DebtPayment } from '@/lib/db-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
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

const debtSchema = z.object({
  name: z.string().min(1, 'Nombre es requerido'),
  creditor: z.string().min(1, 'Acreedor es requerido'),
  totalAmount: z.number().min(1, 'El monto total debe ser mayor a 0'),
  remainingAmount: z.number().min(0, 'El monto restante no puede ser negativo'),
  interestRate: z.number().min(0, 'La tasa de interés no puede ser negativa'),
  monthlyPayment: z.number().min(0, 'El pago mensual no puede ser negativo'),
  status: z.enum(['active', 'paid']),
  endDate: z.string().optional(),
})

const paymentSchema = z.object({
  amount: z.number().min(1, 'El monto debe ser mayor a 0'),
  description: z.string().optional(),
})

type DebtForm = z.infer<typeof debtSchema>
type PaymentForm = z.infer<typeof paymentSchema>

// ─── Component ──────────────────────────────────────────────────────

export function DebtsPage({ currentMonth, currentYear }: { currentMonth?: number; currentYear?: number }) {
  // Data
  const { data: debts, loading, refetch } = useAsyncData<Debt[]>(() => debtService.getAll(), [])

  // Dialog states
  const [debtDialogOpen, setDebtDialogOpen] = useState(false)
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null)
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [debtToDelete, setDebtToDelete] = useState<Debt | null>(null)

  // Payment history expansion
  const [expandedDebtId, setExpandedDebtId] = useState<string | null>(null)
  const [payments, setPayments] = useState<DebtPayment[]>([])
  const [loadingPayments, setLoadingPayments] = useState(false)

  // Submitting states
  const [submittingDebt, setSubmittingDebt] = useState(false)
  const [submittingPayment, setSubmittingPayment] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // ─── Debt Form ──────────────────────────────────────────────────

  const debtForm = useForm<DebtForm>({
    resolver: zodResolver(debtSchema),
    defaultValues: {
      name: '',
      creditor: '',
      totalAmount: 0,
      remainingAmount: 0,
      interestRate: 0,
      monthlyPayment: 0,
      status: 'active',
      endDate: '',
    },
  })

  const openCreateDebt = () => {
    setEditingDebt(null)
    debtForm.reset({
      name: '',
      creditor: '',
      totalAmount: 0,
      remainingAmount: 0,
      interestRate: 0,
      monthlyPayment: 0,
      status: 'active',
      endDate: '',
    })
    setDebtDialogOpen(true)
  }

  const openEditDebt = (debt: Debt) => {
    setEditingDebt(debt)
    debtForm.reset({
      name: debt.name,
      creditor: debt.creditor,
      totalAmount: debt.totalAmount,
      remainingAmount: debt.remainingAmount,
      interestRate: debt.interestRate,
      monthlyPayment: debt.monthlyPayment,
      status: debt.status as 'active' | 'paid',
      endDate: debt.endDate || '',
    })
    setDebtDialogOpen(true)
  }

  const onSubmitDebt = async (data: DebtForm) => {
    setSubmittingDebt(true)
    try {
      if (editingDebt) {
        await debtService.update(editingDebt.id, {
          name: data.name,
          creditor: data.creditor,
          totalAmount: data.totalAmount,
          remainingAmount: data.remainingAmount,
          interestRate: data.interestRate,
          monthlyPayment: data.monthlyPayment,
          status: data.status,
          endDate: data.endDate || undefined,
        })
        toast.success('Deuda actualizada')
      } else {
        await debtService.create({
          name: data.name,
          creditor: data.creditor,
          totalAmount: data.totalAmount,
          remainingAmount: data.remainingAmount,
          interestRate: data.interestRate,
          monthlyPayment: data.monthlyPayment,
          status: data.status,
          endDate: data.endDate || undefined,
        })
        toast.success('Deuda creada')
      }
      setDebtDialogOpen(false)
      refetch()
    } catch {
      toast.error('Error al guardar la deuda')
    } finally {
      setSubmittingDebt(false)
    }
  }

  // ─── Payment Form ───────────────────────────────────────────────

  const paymentForm = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: 0,
      description: '',
    },
  })

  const openPaymentDialog = (debt: Debt) => {
    setSelectedDebt(debt)
    paymentForm.reset({
      amount: debt.monthlyPayment || 0,
      description: '',
    })
    setPaymentDialogOpen(true)
  }

  const onSubmitPayment = async (data: PaymentForm) => {
    if (!selectedDebt) return
    setSubmittingPayment(true)
    try {
      await debtService.addPayment(selectedDebt.id, data.amount, data.description)
      toast.success(`Pago de ${formatCurrency(data.amount)} registrado`)
      setPaymentDialogOpen(false)
      refetch()
      if (expandedDebtId === selectedDebt.id) {
        loadPayments(selectedDebt.id)
      }
    } catch {
      toast.error('Error al registrar el pago')
    } finally {
      setSubmittingPayment(false)
    }
  }

  // ─── Delete Debt ────────────────────────────────────────────────

  const confirmDeleteDebt = (debt: Debt) => {
    setDebtToDelete(debt)
    setDeleteDialogOpen(true)
  }

  const onDeleteDebt = async () => {
    if (!debtToDelete) return
    setDeleting(true)
    try {
      await debtService.delete(debtToDelete.id)
      toast.success('Deuda eliminada')
      setDeleteDialogOpen(false)
      refetch()
    } catch {
      toast.error('Error al eliminar la deuda')
    } finally {
      setDeleting(false)
    }
  }

  // ─── Payment History ────────────────────────────────────────────

  const loadPayments = useCallback(async (debtId: string) => {
    setLoadingPayments(true)
    try {
      const { db } = await import('@/lib/db-client')
      const pmts = await db.debtPayments
        .where('debtId')
        .equals(debtId)
        .reverse()
        .sortBy('createdAt')
      setPayments(pmts)
    } catch {
      setPayments([])
    } finally {
      setLoadingPayments(false)
    }
  }, [])

  const togglePayments = (debtId: string) => {
    if (expandedDebtId === debtId) {
      setExpandedDebtId(null)
    } else {
      setExpandedDebtId(debtId)
      loadPayments(debtId)
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────

  const getPaidAmount = (debt: Debt) => debt.totalAmount - debt.remainingAmount
  const getPaidPercentage = (debt: Debt) => {
    if (debt.totalAmount <= 0) return 0
    return Math.min(100, Math.round((getPaidAmount(debt) / debt.totalAmount) * 100))
  }

  // ─── Render ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="page-enter p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-neon-purple">Deudas</h1>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border-neon-purple/20 animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-1/3 mb-4" />
                <div className="h-3 bg-muted rounded w-2/3 mb-2" />
                <div className="h-2 bg-muted rounded w-full mb-4" />
                <div className="h-8 bg-muted rounded w-1/4" />
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
          <CreditCard className="size-7 text-neon-purple" />
          <h1 className="text-2xl font-bold text-neon-purple">Deudas</h1>
        </div>
        <Button
          onClick={openCreateDebt}
          className="bg-neon-purple/20 border border-neon-purple/50 text-neon-purple hover:bg-neon-purple/30 hover:shadow-neon-pink transition-all"
        >
          <Plus className="size-4 mr-2" />
          Nueva Deuda
        </Button>
      </div>

      {/* Empty State */}
      {!debts || debts.length === 0 ? (
        <Card className="border-neon-purple/20">
          <CardContent className="p-12 text-center">
            <CreditCard className="size-16 text-neon-purple/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">
              No hay deudas registradas
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Agrega tus deudas para llevar un control de tus pagos
            </p>
            <Button
              onClick={openCreateDebt}
              className="bg-neon-purple/20 border border-neon-purple/50 text-neon-purple hover:bg-neon-purple/30"
            >
              <Plus className="size-4 mr-2" />
              Agregar Deuda
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Debts List */
        <div className="space-y-4">
          {debts.map((debt) => {
            const paidAmount = getPaidAmount(debt)
            const paidPercentage = getPaidPercentage(debt)
            const isActive = debt.status === 'active'
            const isExpanded = expandedDebtId === debt.id

            return (
              <Card
                key={debt.id}
                className={`border-neon-purple/20 hover:border-neon-purple/40 transition-all ${
                  isActive ? 'hover:shadow-neon-pink' : 'opacity-70'
                }`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div>
                        <CardTitle className="text-base text-foreground">{debt.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">{debt.creditor}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        className={
                          isActive
                            ? 'border-neon-pink/50 text-neon-pink bg-neon-pink/10'
                            : 'border-neon-green/50 text-neon-green bg-neon-green/10'
                        }
                        variant="outline"
                      >
                        {DEBT_STATUS[debt.status] || debt.status}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDebt(debt)}
                        className="size-8 p-0 text-muted-foreground hover:text-neon-purple"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => confirmDeleteDebt(debt)}
                        className="size-8 p-0 text-muted-foreground hover:text-neon-pink"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Progress info */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-neon-green font-medium">
                      {formatCurrency(paidAmount)} pagado
                    </span>
                    <span className="text-muted-foreground">
                      de {formatCurrency(debt.totalAmount)}
                    </span>
                  </div>

                  {/* Progress bar with dual colors */}
                  <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
                    {/* Paid portion in green */}
                    <div
                      className="absolute top-0 left-0 h-full rounded-full transition-all"
                      style={{
                        width: `${paidPercentage}%`,
                        backgroundColor: '#01ff89',
                        boxShadow: '0 0 8px rgba(1, 255, 137, 0.4)',
                      }}
                    />
                    {/* Remaining portion indicator */}
                    <div
                      className="absolute top-0 right-0 h-full rounded-r-full transition-all"
                      style={{
                        width: `${100 - paidPercentage}%`,
                        backgroundColor: '#d300c533',
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="flex items-center gap-1.5">
                      <TrendingDown className="size-3 text-neon-pink" />
                      <div>
                        <p className="text-muted-foreground">Restante</p>
                        <p className="text-neon-pink font-medium">{formatCurrency(debt.remainingAmount)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Percent className="size-3 text-neon-yellow" />
                      <div>
                        <p className="text-muted-foreground">Tasa</p>
                        <p className="text-neon-yellow font-medium">{debt.interestRate}%</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Banknote className="size-3 text-neon-purple" />
                      <div>
                        <p className="text-muted-foreground">Cuota Mensual</p>
                        <p className="text-neon-purple font-medium">{formatCurrency(debt.monthlyPayment)}</p>
                      </div>
                    </div>
                    {debt.endDate && (
                      <div className="flex items-center gap-1.5">
                        <CalendarDays className="size-3 text-muted-foreground" />
                        <div>
                          <p className="text-muted-foreground">Fecha Fin</p>
                          <p className="font-medium">{formatDate(debt.endDate)}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    {isActive && (
                      <Button
                        size="sm"
                        onClick={() => openPaymentDialog(debt)}
                        className="bg-neon-green/15 border border-neon-green/40 text-neon-green hover:bg-neon-green/25 text-xs"
                      >
                        <Banknote className="size-3 mr-1" />
                        Pagar
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => togglePayments(debt.id)}
                      className="text-xs text-muted-foreground hover:text-neon-purple"
                    >
                      {isExpanded ? <ChevronUp className="size-3 mr-1" /> : <ChevronDown className="size-3 mr-1" />}
                      Historial de pagos
                    </Button>
                  </div>

                  {/* Payment history */}
                  {isExpanded && (
                    <div className="max-h-48 overflow-y-auto cyber-scrollbar space-y-1.5 pt-1">
                      {loadingPayments ? (
                        <p className="text-xs text-muted-foreground text-center py-2">Cargando...</p>
                      ) : payments.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-2">
                          Sin pagos registrados
                        </p>
                      ) : (
                        payments.map((payment) => (
                          <div
                            key={payment.id}
                            className="flex items-center justify-between text-xs py-1.5 px-2 rounded bg-muted/30"
                          >
                            <div className="flex items-center gap-2">
                              <Banknote className="size-3 text-neon-green" />
                              {payment.description && (
                                <span className="text-muted-foreground truncate max-w-[120px]">
                                  {payment.description}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-neon-green font-medium">
                                {formatCurrency(payment.amount)}
                              </span>
                              <span className="text-muted-foreground">
                                {formatDate(payment.createdAt)}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* ─── Create/Edit Debt Dialog ──────────────────────────────── */}
      <Dialog open={debtDialogOpen} onOpenChange={setDebtDialogOpen}>
        <DialogContent className="bg-card border-neon-purple/20 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-neon-purple">
              {editingDebt ? 'Editar Deuda' : 'Nueva Deuda'}
            </DialogTitle>
            <DialogDescription>
              {editingDebt
                ? 'Modifica los datos de la deuda'
                : 'Registra una nueva deuda para llevar control de tus pagos'}
            </DialogDescription>
          </DialogHeader>

          <Form {...debtForm}>
            <form onSubmit={debtForm.handleSubmit(onSubmitDebt)} className="space-y-4">
              <FormField
                control={debtForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ej: Préstamo personal"
                        {...field}
                        className="border-neon-purple/20 focus:border-neon-purple/50"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={debtForm.control}
                name="creditor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Acreedor</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ej: Banco de Chile"
                        {...field}
                        className="border-neon-purple/20 focus:border-neon-purple/50"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={debtForm.control}
                  name="totalAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monto Total</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="0"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                          className="border-neon-purple/20 focus:border-neon-purple/50"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={debtForm.control}
                  name="remainingAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monto Restante</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="0"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                          className="border-neon-purple/20 focus:border-neon-purple/50"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={debtForm.control}
                  name="interestRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tasa de Interés (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="0"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                          className="border-neon-purple/20 focus:border-neon-purple/50"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={debtForm.control}
                  name="monthlyPayment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cuota Mensual</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="0"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                          className="border-neon-purple/20 focus:border-neon-purple/50"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={debtForm.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="border-neon-purple/20 focus:border-neon-purple/50 w-full">
                          <SelectValue placeholder="Selecciona el estado" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Activa</SelectItem>
                        <SelectItem value="paid">Pagada</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={debtForm.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha de Término (opcional)</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        className="border-neon-purple/20 focus:border-neon-purple/50"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDebtDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={submittingDebt}
                  className="bg-neon-purple/20 border border-neon-purple/50 text-neon-purple hover:bg-neon-purple/30"
                >
                  {submittingDebt ? 'Guardando...' : editingDebt ? 'Actualizar' : 'Crear Deuda'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ─── Payment Dialog ───────────────────────────────────────── */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="bg-card border-neon-green/20">
          <DialogHeader>
            <DialogTitle className="text-neon-green">
              Pagar {selectedDebt?.name}
            </DialogTitle>
            <DialogDescription>
              Restante: {selectedDebt ? formatCurrency(selectedDebt.remainingAmount) : '$0'} •
              Cuota: {selectedDebt ? formatCurrency(selectedDebt.monthlyPayment) : '$0'}
            </DialogDescription>
          </DialogHeader>

          <Form {...paymentForm}>
            <form onSubmit={paymentForm.handleSubmit(onSubmitPayment)} className="space-y-4">
              <FormField
                control={paymentForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monto del Pago</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="0"
                        max={selectedDebt?.remainingAmount}
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                        className="border-neon-green/20 focus:border-neon-green/50"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={paymentForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción (opcional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ej: Cuota mensual"
                        {...field}
                        className="border-neon-green/20 focus:border-neon-green/50"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPaymentDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={submittingPayment}
                  className="bg-neon-green/20 border border-neon-green/50 text-neon-green hover:bg-neon-green/30"
                >
                  <Banknote className="size-4 mr-2" />
                  {submittingPayment ? 'Registrando...' : 'Registrar Pago'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation ──────────────────────────────────── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border-neon-pink/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-neon-pink">Eliminar Deuda</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de eliminar la deuda &quot;{debtToDelete?.name}&quot;? Se eliminarán
              todos los pagos registrados. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDeleteDebt}
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
