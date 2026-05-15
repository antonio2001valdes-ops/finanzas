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
  ChevronDown,
  ChevronRight,
  Power,
  PowerOff,
  CheckCircle,
  Clock,
  AlertTriangle,
  FileText,
  History,
} from 'lucide-react'
import { toast } from 'sonner'
import { recurringService, categoryService, serviceService, accountService, useAsyncData } from '@/lib/data'
import { formatCurrency, formatDate } from '@/lib/finance-utils'
import type { RecurringPayment, ExpenseCategory, ServiceAccount, Account, Transaction } from '@/lib/db-client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DatePickerField } from '@/components/ui/date-picker-field'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
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

// ─── CategoryBadge ─────────────────────────────────────────────────

function CategoryBadge({ name, color }: { name: string; color?: string }) {
  const c = color || '#05d9e8'
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: c + '22', border: `1px solid ${c}44`, color: c }}
    >
      {name}
    </span>
  )
}

// ─── Zod Schemas ────────────────────────────────────────────────────

const recurringSchema = z.object({
  name: z.string().min(1, 'Nombre es requerido'),
  amount: z.coerce.number().min(1, 'El monto debe ser mayor a 0'),
  interval: z.enum(['monthly', 'weekly', 'yearly']),
  dueDay: z.number().min(1, 'Día mínimo es 1').max(31, 'Día máximo es 31'),
  categoryId: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean(),
})

type RecurringForm = z.infer<typeof recurringSchema>

const billSchema = z.object({
  serviceAccountId: z.string().min(1, 'Selecciona un servicio'),
  amount: z.coerce.number().min(1, 'El monto debe ser mayor a 0'),
  dueDate: z.string().min(1, 'La fecha es requerida'),
})

type BillForm = z.infer<typeof billSchema>

// ─── Theme Colors ────────────────────────────────────────────────────

const CYAN = '#00fff5'

// ─── Component ──────────────────────────────────────────────────────

export function RecurringPage({ currentMonth, currentYear }: { currentMonth?: number; currentYear?: number }) {
  // Data
  const { data: recurringPayments, loading, refetch } = useAsyncData<RecurringPayment[]>(
    () => recurringService.getAll(),
    []
  )

  // Service accounts for bill creation
  const { data: serviceAccounts } = useAsyncData<ServiceAccount[]>(
    () => serviceService.getAllAccounts(),
    []
  )

  // Expense categories for select & badge display
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [recurringToDelete, setRecurringToDelete] = useState<RecurringPayment | null>(null)
  const [selectedRecurring, setSelectedRecurring] = useState<RecurringPayment | null>(null)

  // Bill dialog state
  const [billDialogOpen, setBillDialogOpen] = useState(false)
  const [selectedRecurringForBill, setSelectedRecurringForBill] = useState<RecurringPayment | null>(null)

  // Pay dialog with account selection
  const [payAccountId, setPayAccountId] = useState<string>('')
  const [paying, setPaying] = useState(false)

  // Accounts for pay dialog
  const { data: accounts } = useAsyncData<Account[]>(() => accountService.getAll(), [])

  // Expanded rows for payment history
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const toggleExpand = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

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
    }
  }

  // ─── Bill Form ───────────────────────────────────────────────────

  const billForm = useForm<BillForm>({
    resolver: zodResolver(billSchema),
    defaultValues: {
      serviceAccountId: '',
      amount: 0,
      dueDate: '',
    },
  })

  const openBillDialog = (payment: RecurringPayment) => {
    setSelectedRecurringForBill(payment)
    billForm.reset({
      serviceAccountId: '',
      amount: 0,
      dueDate: '',
    })
    setBillDialogOpen(true)
  }

  const onSubmitBill = async (data: BillForm) => {
    try {
      await serviceService.createBill({
        serviceAccountId: data.serviceAccountId,
        amount: data.amount,
        dueDate: data.dueDate,
        paid: false,
      })
      toast.success('Factura creada')
      setBillDialogOpen(false)
      refetch()
    } catch {
      toast.error('Error al crear la factura')
    }
  }

  // ─── Pay ────────────────────────────────────────────────────────

  const openPayDialog = (payment: RecurringPayment) => {
    setSelectedRecurring(payment)
    setPayAccountId(accounts?.[0]?.id ?? '')
    setPayDialogOpen(true)
  }

  const onConfirmPay = async () => {
    if (!selectedRecurring || !payAccountId) return
    const selectedAcct = accounts?.find((a) => a.id === payAccountId)
    if (selectedAcct && selectedAcct.balance < selectedRecurring.amount) {
      toast.error('Saldo insuficiente en la cuenta seleccionada')
      return
    }
    setPaying(true)
    try {
      await recurringService.pay(selectedRecurring.id, payAccountId)
      toast.success(`Pago registrado como gasto`)
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
    try {
      await recurringService.delete(recurringToDelete.id)
      toast.success('Pago recurrente eliminado')
      setDeleteDialogOpen(false)
      refetch()
    } catch {
      toast.error('Error al eliminar el pago recurrente')
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────

  const getCategoryInfo = (categoryId?: string) => {
    if (!categoryId) return null
    const cat = expenseCategories.find((c) => c.id === categoryId)
    return cat ? { name: cat.name, color: cat.color } : null
  }

  const getIntervalBadge = (interval: string) => {
    const config: Record<string, { color: string; bg: string; border: string; label: string }> = {
      monthly: { color: '#05d9e8', bg: '#05d9e822', border: '#05d9e844', label: 'Mensual' },
      weekly: { color: '#4deeea', bg: '#4deeea22', border: '#4deeea44', label: 'Semanal' },
      yearly: { color: '#f9f002', bg: '#f9f00222', border: '#f9f00244', label: 'Anual' },
    }
    const c = config[interval]
    if (!c) return <span className="text-xs text-muted-foreground">{interval}</span>
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
        style={{ backgroundColor: c.bg, border: `1px solid ${c.border}`, color: c.color }}
      >
        {c.label}
      </span>
    )
  }

  // ─── Computed summary ────────────────────────────────────────────

  const activeRecurring = recurringPayments?.filter((r) => r.isActive) ?? []
  const activeCount = activeRecurring.length

  // Next due date (earliest among active)
  const nextDueDate = activeRecurring.length > 0
    ? activeRecurring.reduce((earliest, r) => {
        const d = new Date(r.nextDueDate)
        const e = new Date(earliest)
        return d < e ? r.nextDueDate : earliest
      }, activeRecurring[0].nextDueDate)
    : null

  // ─── Render ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="page-enter p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-neon-cyan">Pagos Recurrentes</h1>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border-neon-cyan/20 animate-pulse">
              <CardContent className="p-4">
                <div className="h-4 bg-muted rounded w-1/2 mb-3" />
                <div className="h-6 bg-muted rounded w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="border-neon-cyan/10 animate-pulse">
          <CardContent className="p-6">
            <div className="h-40 bg-muted rounded" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="page-enter p-4 md:p-6 space-y-4 overflow-auto">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center size-10 rounded-lg border border-neon-cyan/30 bg-neon-cyan/10">
            <Repeat className="size-5 text-neon-cyan" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: CYAN, textShadow: `0 0 20px ${CYAN}44` }}>
              Pagos Recurrentes
            </h1>
            <p className="text-sm text-muted-foreground">Gestiona tus pagos periódicos</p>
          </div>
        </div>
        <Button
          onClick={openCreateRecurring}
          className="bg-neon-cyan/20 border border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/30 hover:shadow-[0_0_15px_rgba(5,217,232,0.3)] transition-all"
        >
          <Plus className="size-4" />
          Nuevo Recurrente
        </Button>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Activos */}
        <Card className="border-neon-green/20 bg-card/50 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-lg bg-neon-green/10 border border-neon-green/30">
              <CheckCircle className="size-5 text-neon-green" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Activos</p>
              <p className="text-lg font-bold text-neon-green font-mono">{activeCount}</p>
            </div>
          </CardContent>
        </Card>
        {/* Próximo Vencimiento */}
        <Card className="border-neon-orange/20 bg-card/50 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-lg bg-neon-orange/10 border border-neon-orange/30">
              <Clock className="size-5 text-neon-orange" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Próximo Vencimiento</p>
              <p className="text-lg font-bold text-neon-orange font-mono">
                {nextDueDate ? formatDate(nextDueDate) : '—'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Empty State ── */}
      {(!recurringPayments || recurringPayments.length === 0) ? (
        <Card className="border-neon-cyan/10 bg-card/50 backdrop-blur-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Repeat className="size-10 mb-3 text-neon-cyan/30" />
            <p className="text-lg font-medium">No hay pagos recurrentes</p>
            <p className="text-sm mb-4">Agrega tus pagos recurrentes para no olvidar ninguna fecha</p>
            <Button
              onClick={openCreateRecurring}
              className="bg-neon-cyan/20 border border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/30"
            >
              <Plus className="size-4" />
              Agregar Recurrente
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* ── Table ── */
        <Card className="border-neon-cyan/10 bg-card/50 backdrop-blur-sm">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-neon-cyan/10 hover:bg-transparent">
                  <TableHead className="text-neon-cyan/70">Nombre</TableHead>
                  <TableHead className="text-neon-cyan/70 hidden sm:table-cell">Intervalo</TableHead>
                  <TableHead className="text-neon-cyan/70 text-right">Monto</TableHead>
                  <TableHead className="text-neon-cyan/70 hidden md:table-cell">Día de Pago</TableHead>
                  <TableHead className="text-neon-cyan/70 hidden lg:table-cell">Categoría</TableHead>
                  <TableHead className="text-neon-cyan/70 hidden sm:table-cell">Estado</TableHead>
                  <TableHead className="text-neon-cyan/70 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recurringPayments.map((payment) => {
                  const isActive = payment.isActive
                  const categoryInfo = getCategoryInfo(payment.categoryId)
                  const isExpanded = expandedRows.has(payment.id)

                  return (
                    <>
                      <TableRow
                        key={payment.id}
                        className={`border-neon-cyan/5 hover:bg-neon-cyan/5 transition-colors ${!isActive ? 'opacity-50' : ''}`}
                      >
                        {/* Nombre + Chevron */}
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-6 p-0 text-muted-foreground hover:text-neon-cyan"
                              onClick={() => toggleExpand(payment.id)}
                            >
                              {isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                            </Button>
                            <Repeat className={`size-4 shrink-0 ${isActive ? 'text-neon-cyan' : 'text-muted-foreground'}`} />
                            <span className="font-medium truncate max-w-[130px]">{payment.name}</span>
                          </div>
                        </TableCell>
                        {/* Intervalo */}
                        <TableCell className="hidden sm:table-cell">
                          {getIntervalBadge(payment.interval)}
                        </TableCell>
                        {/* Monto */}
                        <TableCell className="text-right">
                          <span className="font-mono font-medium text-sm">{formatCurrency(payment.amount)}</span>
                        </TableCell>
                        {/* Día de Pago */}
                        <TableCell className="hidden md:table-cell">
                          <div className="flex items-center gap-1.5">
                            <CalendarClock className="size-3 text-muted-foreground" />
                            <span className="text-sm">Día {payment.dueDay}</span>
                          </div>
                        </TableCell>
                        {/* Categoría */}
                        <TableCell className="hidden lg:table-cell">
                          {categoryInfo ? (
                            <CategoryBadge name={categoryInfo.name} color={categoryInfo.color} />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        {/* Estado */}
                        <TableCell className="hidden sm:table-cell">
                          {isActive ? (
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                              style={{ backgroundColor: '#01ff8922', border: '1px solid #01ff8944', color: '#01ff89' }}
                            >
                              <Power className="size-3 mr-1" />
                              Activo
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                              style={{ backgroundColor: '#6b728022', border: '1px solid #6b728044', color: '#6b7280' }}
                            >
                              <PowerOff className="size-3 mr-1" />
                              Inactivo
                            </span>
                          )}
                        </TableCell>
                        {/* Acciones */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Calendar / Add Bill button */}
                            {isActive && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 gap-1 px-2 border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/15 hover:border-neon-cyan/50 hover:shadow-[0_0_8px_rgba(5,217,232,0.25)] transition-all text-xs"
                                onClick={() => openBillDialog(payment)}
                                title="Agregar Factura"
                              >
                                <CalendarDays className="size-3.5" />
                                <span className="hidden xl:inline">Factura</span>
                              </Button>
                            )}
                            {isActive && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 text-neon-green hover:text-neon-green hover:bg-neon-green/10"
                                onClick={() => openPayDialog(payment)}
                                title="Pagar"
                              >
                                <Banknote className="size-3.5" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground hover:text-neon-blue hover:bg-neon-blue/10"
                              onClick={() => openEditRecurring(payment)}
                              title="Editar"
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground hover:text-neon-pink hover:bg-neon-pink/10"
                              onClick={() => confirmDeleteRecurring(payment)}
                              title="Eliminar"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Expanded Payment History */}
                      {isExpanded && (
                        <TableRow key={`${payment.id}-history`} className="border-neon-cyan/5">
                          <TableCell colSpan={7} className="bg-muted/20 p-0">
                            <div className="p-3">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                                  <History className="size-3.5" />
                                  Pagos Anteriores
                                </h4>
                              </div>
                              <PaymentHistorySubTable
                                recurringId={payment.id}
                                accounts={accounts}
                                refreshKey={expandedRows.size}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
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

              <FormField
                control={recurringForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monto</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
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

              <div className="grid grid-cols-2 gap-4">
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
              </div>

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
                  className="bg-neon-cyan/20 border border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/30"
                >
                  {editingRecurring
                      ? 'Actualizar'
                      : 'Crear Recurrente'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ─── Add Bill Dialog ─────────────────────────────────────── */}
      <Dialog open={billDialogOpen} onOpenChange={setBillDialogOpen}>
        <DialogContent className="bg-card border-neon-yellow/20 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-neon-yellow">
              Agregar Factura
            </DialogTitle>
            <DialogDescription>
              {selectedRecurringForBill
                ? `Crear factura para el recurrente "${selectedRecurringForBill.name}"`
                : 'Crea una nueva factura asociada a un servicio'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={billForm.handleSubmit(onSubmitBill)} className="space-y-4">
            {/* Servicio */}
            <div className="space-y-2">
              <Label>Servicio</Label>
              <Select
                value={billForm.watch('serviceAccountId') || ''}
                onValueChange={(val) => billForm.setValue('serviceAccountId', val)}
              >
                <SelectTrigger className="border-neon-yellow/20 focus:border-neon-yellow/50 w-full">
                  <SelectValue placeholder="Seleccionar servicio" />
                </SelectTrigger>
                <SelectContent>
                  {serviceAccounts?.map((sa) => (
                    <SelectItem key={sa.id} value={sa.id}>
                      {sa.name} {sa.provider ? `- ${sa.provider}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {billForm.formState.errors.serviceAccountId && (
                <p className="text-xs text-destructive">{billForm.formState.errors.serviceAccountId.message}</p>
              )}
              {(!serviceAccounts || serviceAccounts.length === 0) && (
                <p className="text-xs text-muted-foreground">No hay servicios registrados. Crea uno primero en la sección de Servicios.</p>
              )}
            </div>

            {/* Monto */}
            <div className="space-y-2">
              <Label>Monto</Label>
              <Input
                type="number"
                step="1"
                placeholder="0"
                {...billForm.register('amount')}
                className="border-neon-yellow/20 focus-visible:border-neon-yellow/50"
              />
              {billForm.formState.errors.amount && (
                <p className="text-xs text-destructive">{billForm.formState.errors.amount.message}</p>
              )}
            </div>

            {/* Fecha de vencimiento */}
            <div className="space-y-2">
              <Label>Fecha de vencimiento</Label>
              <DatePickerField
                {...billForm.register('dueDate')}
                accentColor="#f9f002"
              />
              {billForm.formState.errors.dueDate && (
                <p className="text-xs text-destructive">{billForm.formState.errors.dueDate.message}</p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setBillDialogOpen(false)}
                className="border-neon-yellow/20"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={false}
                className="bg-neon-yellow/20 border border-neon-yellow/50 text-neon-yellow hover:bg-neon-yellow/30"
              >
                <>
                  <FileText className="size-4 mr-2" />
                  Crear Factura
                </>
              </Button>
            </DialogFooter>
          </form>
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
              Se descontará de la cuenta seleccionada y se avanzará la fecha del próximo pago
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
                <span className="font-bold text-neon-pink">{formatCurrency(selectedRecurring.amount)}</span>
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

              {/* Account selection */}
              <div className="pt-2 border-t border-border/30">
                <Label className="mb-2 block">Cuenta de Pago</Label>
                <Select
                  value={payAccountId}
                  onValueChange={setPayAccountId}
                >
                  <SelectTrigger className="border-neon-green/20 focus:border-neon-green/50 w-full">
                    <SelectValue placeholder="Seleccionar cuenta" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts?.map((acct) => (
                      <SelectItem key={acct.id} value={acct.id}>
                        {acct.icon} {acct.name} ({formatCurrency(acct.balance)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(!accounts || accounts.length === 0) && (
                  <p className="text-xs text-muted-foreground mt-1">No hay cuentas registradas.</p>
                )}
              </div>

              {/* Saldo insuficiente warning */}
              {(() => {
                const selectedAcct = accounts?.find((a) => a.id === payAccountId)
                const insufficient = selectedAcct && selectedRecurring && selectedAcct.balance < selectedRecurring.amount
                return insufficient ? (
                  <div className="flex items-center gap-2 p-3 rounded-lg border border-neon-pink/30 bg-neon-pink/10">
                    <AlertTriangle className="size-4 text-neon-pink shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-neon-pink">Saldo insuficiente</p>
                      <p className="text-[10px] text-muted-foreground">
                        Disponible: {formatCurrency(selectedAcct?.balance ?? 0)} • Necesitas: {formatCurrency(selectedRecurring?.amount ?? 0)}
                      </p>
                    </div>
                  </div>
                ) : null
              })()}
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
              disabled={paying || !payAccountId || (() => { const a = accounts?.find((x) => x.id === payAccountId); return !!a && !!selectedRecurring && a.balance < selectedRecurring.amount })()}
              className="bg-neon-green/20 border border-neon-green/50 text-neon-green hover:bg-neon-green/30 disabled:opacity-50"
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
              className="bg-neon-pink/20 border border-neon-pink/50 text-neon-pink hover:bg-neon-pink/30"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─── Payment History Sub-Table Component ────────────────────────────

function PaymentHistorySubTable({
  recurringId,
  accounts,
  refreshKey,
}: {
  recurringId: string
  accounts?: Account[]
  refreshKey: number
}) {
  const { data: payments, loading } = useAsyncData<Transaction[]>(
    () => recurringService.getPaymentHistory(recurringId),
    [recurringId, refreshKey]
  )

  if (loading) {
    return (
      <div className="space-y-2 py-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-8 bg-muted/50 rounded animate-pulse" />
        ))}
      </div>
    )
  }

  if (!payments || payments.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-4 bg-muted/20 rounded-md">
        Sin pagos anteriores registrados
      </p>
    )
  }

  const getAccountName = (accountId?: string) => {
    if (!accountId || !accounts) return '—'
    const acct = accounts.find((a) => a.id === accountId)
    return acct ? `${acct.icon} ${acct.name}` : '—'
  }

  return (
    <div className="rounded-md border border-neon-cyan/10 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-neon-cyan/10 hover:bg-transparent">
            <TableHead className="text-neon-cyan/60 text-xs h-8">Fecha</TableHead>
            <TableHead className="text-neon-cyan/60 text-xs h-8 text-right">Monto</TableHead>
            <TableHead className="text-neon-cyan/60 text-xs h-8 hidden sm:table-cell">Cuenta</TableHead>
            <TableHead className="text-neon-cyan/60 text-xs h-8 text-center">Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((tx) => (
            <TableRow key={tx.id} className="border-neon-cyan/5 hover:bg-neon-cyan/5">
              {/* Fecha */}
              <TableCell className="text-xs py-1.5">
                {formatDate(tx.date)}
              </TableCell>
              {/* Monto */}
              <TableCell className="text-xs py-1.5 text-right font-mono font-medium text-neon-pink">
                {formatCurrency(tx.amount)}
              </TableCell>
              {/* Cuenta */}
              <TableCell className="text-xs py-1.5 text-muted-foreground hidden sm:table-cell">
                {getAccountName(tx.accountId)}
              </TableCell>
              {/* Estado */}
              <TableCell className="text-xs py-1.5 text-center">
                <span
                  className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium"
                  style={{ backgroundColor: '#01ff8922', border: '1px solid #01ff8944', color: '#01ff89' }}
                >
                  <CheckCircle className="size-3 mr-0.5" />
                  Pagado
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
