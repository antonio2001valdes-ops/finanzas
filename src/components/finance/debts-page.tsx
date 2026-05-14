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
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { debtService, useAsyncData } from '@/lib/data'
import { formatCurrency, formatDate, DEBT_STATUS } from '@/lib/finance-utils'
import type { Debt, DebtPayment } from '@/lib/db-client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

// ─── Status Badge ───────────────────────────────────────────────────

function DebtStatusBadge({ status }: { status: string }) {
  const isActive = status === 'active'
  const bgColor = isActive ? '#ff6b3520' : '#01ff8920'
  const borderColor = isActive ? '#ff6b3544' : '#01ff8944'
  const textColor = isActive ? '#ff6b35' : '#01ff89'
  const label = DEBT_STATUS[status] || status

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold"
      style={{ backgroundColor: bgColor, border: `1px solid ${borderColor}`, color: textColor }}
    >
      {label}
    </span>
  )
}

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

  // ─── Summary ─────────────────────────────────────────────────────

  const debtList = debts ?? []
  const totalDebt = debtList
    .filter((d) => d.status === 'active')
    .reduce((sum, d) => sum + d.remainingAmount, 0)
  const totalPaid = debtList.reduce(
    (sum, d) => sum + (d.totalAmount - d.remainingAmount),
    0
  )

  // ─── Render ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="page-enter p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold" style={{ color: '#ff6b35', textShadow: '0 0 10px #ff6b3566' }}>
            Deudas
          </h1>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <Card key={i} className="border-[#ff6b35]/20 animate-pulse">
                <CardContent className="p-4">
                  <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                  <div className="h-6 bg-muted rounded w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="border-[#ff6b35]/20 animate-pulse">
            <CardContent className="p-6">
              <div className="h-40 bg-muted rounded" />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="page-enter p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CreditCard className="size-7" style={{ color: '#ff6b35' }} />
          <h1
            className="text-2xl font-bold"
            style={{ color: '#ff6b35', textShadow: '0 0 10px #ff6b3566' }}
          >
            Deudas
          </h1>
        </div>
        <Button
          onClick={openCreateDebt}
          className="bg-[#ff6b35]/20 border border-[#ff6b35]/50 text-[#ff6b35] hover:bg-[#ff6b35]/30 hover:shadow-[0_0_10px_#ff6b3544] transition-all"
        >
          <Plus className="size-4 mr-2" />
          Nueva Deuda
        </Button>
      </div>

      {/* Empty State */}
      {debtList.length === 0 ? (
        <Card
          className="border-[#ff6b35]/20"
          style={{ boxShadow: '0 0 10px #ff6b3510' }}
        >
          <CardContent className="p-12 text-center">
            <CreditCard className="size-16 mx-auto mb-4" style={{ color: '#ff6b3540' }} />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">
              No hay deudas registradas
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Agrega tus deudas para llevar un control de tus pagos
            </p>
            <Button
              onClick={openCreateDebt}
              className="bg-[#ff6b35]/20 border border-[#ff6b35]/50 text-[#ff6b35] hover:bg-[#ff6b35]/30"
            >
              <Plus className="size-4 mr-2" />
              Agregar Deuda
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card
              className="border-[#ff6b35]/30 bg-card/80"
              style={{ boxShadow: '0 0 10px #ff6b3520' }}
            >
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Total Deuda</p>
                <p className="text-2xl font-bold" style={{ color: '#ff6b35' }}>
                  {formatCurrency(totalDebt)}
                </p>
              </CardContent>
            </Card>
            <Card
              className="border-[#01ff89]/30 bg-card/80"
              style={{ boxShadow: '0 0 10px #01ff8920' }}
            >
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Total Pagado</p>
                <p className="text-2xl font-bold" style={{ color: '#01ff89' }}>
                  {formatCurrency(totalPaid)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Table */}
          <Card
            className="border-[#ff6b35]/20 bg-card/80 backdrop-blur-sm"
            style={{ boxShadow: '0 0 15px #ff6b3510' }}
          >
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#ff6b35]/10 hover:bg-transparent">
                      <TableHead className="text-muted-foreground">Nombre</TableHead>
                      <TableHead className="text-muted-foreground hidden sm:table-cell">Acreedor</TableHead>
                      <TableHead className="text-muted-foreground text-right">Total</TableHead>
                      <TableHead className="text-muted-foreground text-right">Restante</TableHead>
                      <TableHead className="text-muted-foreground text-right hidden md:table-cell">Tasa Interés %</TableHead>
                      <TableHead className="text-muted-foreground text-right hidden lg:table-cell">Pago Mensual</TableHead>
                      <TableHead className="text-muted-foreground text-center">Estado</TableHead>
                      <TableHead className="text-muted-foreground hidden lg:table-cell">Fecha Fin</TableHead>
                      <TableHead className="text-muted-foreground text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {debtList.map((debt) => {
                      const isActive = debt.status === 'active'

                      return (
                        <TableRow
                          key={debt.id}
                          className={`border-[#ff6b35]/5 hover:bg-[#ff6b35]/5 transition-colors ${
                            !isActive ? 'opacity-60' : ''
                          }`}
                        >
                          <TableCell className="font-medium">{debt.name}</TableCell>
                          <TableCell className="hidden sm:table-cell text-muted-foreground">
                            {debt.creditor}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(debt.totalAmount)}
                          </TableCell>
                          <TableCell
                            className="text-right font-mono font-semibold"
                            style={{ color: debt.remainingAmount === 0 ? '#01ff89' : '#ff6b35' }}
                          >
                            {formatCurrency(debt.remainingAmount)}
                          </TableCell>
                          <TableCell className="text-right font-mono hidden md:table-cell" style={{ color: '#f9f002' }}>
                            {debt.interestRate}%
                          </TableCell>
                          <TableCell className="text-right font-mono hidden lg:table-cell" style={{ color: '#d300c5' }}>
                            {formatCurrency(debt.monthlyPayment)}
                          </TableCell>
                          <TableCell className="text-center">
                            <DebtStatusBadge status={debt.status} />
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-muted-foreground">
                            {debt.endDate ? formatDate(debt.endDate) : '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {isActive && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7 text-muted-foreground hover:text-neon-green"
                                  onClick={() => openPaymentDialog(debt)}
                                  title="Pagar"
                                >
                                  <Banknote className="size-3.5" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 text-muted-foreground hover:text-neon-blue"
                                onClick={() => openEditDebt(debt)}
                                title="Editar"
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 text-muted-foreground hover:text-neon-pink"
                                onClick={() => confirmDeleteDebt(debt)}
                                title="Eliminar"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── Create/Edit Debt Dialog ──────────────────────────────── */}
      <Dialog open={debtDialogOpen} onOpenChange={setDebtDialogOpen}>
        <DialogContent className="bg-card border-[#ff6b35]/20 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ color: '#ff6b35' }}>
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
                        className="border-[#ff6b35]/20 focus:border-[#ff6b35]/50"
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
                        className="border-[#ff6b35]/20 focus:border-[#ff6b35]/50"
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
                          className="border-[#ff6b35]/20 focus:border-[#ff6b35]/50"
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
                          className="border-[#ff6b35]/20 focus:border-[#ff6b35]/50"
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
                          className="border-[#ff6b35]/20 focus:border-[#ff6b35]/50"
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
                          className="border-[#ff6b35]/20 focus:border-[#ff6b35]/50"
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
                        <SelectTrigger className="border-[#ff6b35]/20 focus:border-[#ff6b35]/50 w-full">
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
                        className="border-[#ff6b35]/20 focus:border-[#ff6b35]/50"
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
                  className="bg-[#ff6b35]/20 border border-[#ff6b35]/50 text-[#ff6b35] hover:bg-[#ff6b35]/30"
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
