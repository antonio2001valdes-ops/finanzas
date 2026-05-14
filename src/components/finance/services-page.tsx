'use client'

import { useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import {
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  Receipt,
  CircleDollarSign,
  CalendarDays,
  Power,
  PowerOff,
  CheckCircle2,
  XCircle,
  Banknote,
  AlertTriangle,
  Loader2,
  StickyNote,
} from 'lucide-react'

import { serviceService, categoryService, useAsyncData } from '@/lib/data'
import { formatCurrency, formatDate } from '@/lib/finance-utils'
import type { ServiceAccount, ServiceBill, ExpenseCategory } from '@/lib/db-client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

// ─── CategoryBadge ─────────────────────────────────────────────────

function CategoryBadge({ name, color }: { name: string; color?: string }) {
  const c = color || '#ff6b35'
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

const serviceAccountSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  provider: z.string().min(1, 'El proveedor es requerido'),
  accountNumber: z.string().optional().default(''),
  categoryId: z.string().optional().default(''),
  isActive: z.boolean().default(true),
  notes: z.string().optional().default(''),
})

type ServiceAccountForm = z.infer<typeof serviceAccountSchema>

const billSchema = z.object({
  amount: z.coerce.number().min(1, 'El monto debe ser mayor a 0'),
  dueDate: z.string().min(1, 'La fecha es requerida'),
})

type BillForm = z.infer<typeof billSchema>

// ─── Theme Colors ────────────────────────────────────────────────────

const ORANGE = '#ff6b35'
const YELLOW = '#f9f002'

// ─── Props ──────────────────────────────────────────────────────────

interface ServicesPageProps {
  currentMonth?: number
  currentYear?: number
}

// ─── Main Component ─────────────────────────────────────────────────

export function ServicesPage({ currentMonth, currentYear }: ServicesPageProps) {
  // Data state
  const [refreshKey, setRefreshKey] = useState(0)
  const {
    data: accounts,
    loading: accountsLoading,
  } = useAsyncData(() => serviceService.getAllAccounts(), [refreshKey])

  const {
    data: expenseCategories,
  } = useAsyncData(() => categoryService.getAll('expense') as Promise<ExpenseCategory[]>, [])

  // Dialog state
  const [accountDialogOpen, setAccountDialogOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<ServiceAccount | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null)

  // Bill dialog state
  const [billDialogOpen, setBillDialogOpen] = useState(false)
  const [billAccountId, setBillAccountId] = useState<string | null>(null)

  // Expanded accounts for bills
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set())

  const toggleExpand = (id: string) => {
    setExpandedAccounts((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  // ─── Account Form ───────────────────────────────────────────────

  const accountForm = useForm<ServiceAccountForm>({
    resolver: zodResolver(serviceAccountSchema),
    defaultValues: {
      name: '',
      provider: '',
      accountNumber: '',
      categoryId: '',
      isActive: true,
      notes: '',
    },
  })

  const openCreateAccount = () => {
    setEditingAccount(null)
    // Find the 'Servicios' category to set as default
    const serviciosCat = expenseCategories?.find((c) => c.name === 'Servicios')
    accountForm.reset({
      name: '',
      provider: '',
      accountNumber: '',
      categoryId: serviciosCat?.id ?? '',
      isActive: true,
      notes: '',
    })
    setAccountDialogOpen(true)
  }

  const openEditAccount = (account: ServiceAccount) => {
    setEditingAccount(account)
    accountForm.reset({
      name: account.name,
      provider: account.provider,
      accountNumber: account.accountNumber ?? '',
      categoryId: account.categoryId ?? '',
      isActive: account.isActive,
      notes: account.notes ?? '',
    })
    setAccountDialogOpen(true)
  }

  const onSubmitAccount = async (values: ServiceAccountForm) => {
    try {
      const data = {
        name: values.name,
        provider: values.provider,
        accountNumber: values.accountNumber || undefined,
        categoryId: values.categoryId || undefined,
        amount: 0,
        dueDay: undefined,
        isActive: values.isActive,
        notes: values.notes || undefined,
      }

      if (editingAccount) {
        await serviceService.updateAccount(editingAccount.id, data)
        toast.success('Servicio actualizado')
      } else {
        await serviceService.createAccount(data as Omit<ServiceAccount, 'id' | 'createdAt' | 'updatedAt'>)
        toast.success('Servicio creado')
      }

      setAccountDialogOpen(false)
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar el servicio.')
    }
  }

  // ─── Delete Account ─────────────────────────────────────────────

  const confirmDeleteAccount = async () => {
    if (!deletingAccountId) return
    try {
      await serviceService.deleteAccount(deletingAccountId)
      toast.success('Servicio eliminado')
      setDeleteDialogOpen(false)
      setDeletingAccountId(null)
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo eliminar el servicio.')
    }
  }

  // ─── Bill Form ──────────────────────────────────────────────────

  const billForm = useForm<BillForm>({
    resolver: zodResolver(billSchema),
    defaultValues: {
      amount: 0,
      dueDate: '',
    },
  })

  const openCreateBill = (accountId: string) => {
    setBillAccountId(accountId)
    const now = new Date()
    const yearStr = currentYear ?? now.getFullYear()
    const monthStr = String(currentMonth ?? now.getMonth() + 1).padStart(2, '0')
    billForm.reset({
      amount: 0,
      dueDate: `${yearStr}-${monthStr}-05`,
    })
    setBillDialogOpen(true)
  }

  const onSubmitBill = async (values: BillForm) => {
    if (!billAccountId) return
    try {
      await serviceService.createBill({
        serviceAccountId: billAccountId,
        amount: values.amount,
        dueDate: new Date(values.dueDate + 'T12:00:00').toISOString(),
        paid: false,
      })
      toast.success('Factura creada')
      setBillDialogOpen(false)
      setBillAccountId(null)
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo crear la factura.')
    }
  }

  // ─── Pay / Unpay Bill ───────────────────────────────────────────

  const handlePayBill = async (billId: string) => {
    try {
      await serviceService.payBill(billId)
      toast.success('Factura pagada')
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo pagar la factura.')
    }
  }

  const handleUnpayBill = async (billId: string) => {
    try {
      await serviceService.unpayBill(billId)
      toast.success('Pago anulado')
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo anular el pago.')
    }
  }

  // ─── Category name lookup ───────────────────────────────────────

  const getCategoryInfo = (categoryId?: string) => {
    if (!categoryId || !expenseCategories) return null
    const cat = expenseCategories.find((c) => c.id === categoryId)
    return cat ? { name: cat.name, color: cat.color } : null
  }

  // ─── Computed summary ────────────────────────────────────────────

  const activeAccounts = accounts?.filter((a) => a.isActive) ?? []
  const totalServices = activeAccounts.reduce((sum, a) => sum + a.amount, 0)

  // ─── Loading ────────────────────────────────────────────────────

  if (accountsLoading) {
    return (
      <div className="page-enter p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-neon-orange">Servicios</h1>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border-neon-orange/20 animate-pulse">
              <CardContent className="p-4">
                <div className="h-4 bg-muted rounded w-1/2 mb-3" />
                <div className="h-6 bg-muted rounded w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="border-neon-orange/10 animate-pulse">
          <CardContent className="p-6">
            <div className="h-40 bg-muted rounded" />
          </CardContent>
        </Card>
      </div>
    )
  }

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <div className="page-enter p-4 md:p-6 space-y-4 overflow-auto">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center size-10 rounded-lg border border-neon-orange/30 bg-neon-orange/10">
            <Receipt className="size-5 text-neon-orange" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: ORANGE, textShadow: `0 0 20px ${ORANGE}44` }}>
              Servicios
            </h1>
            <p className="text-sm text-muted-foreground">Gestiona tus cuentas de servicios y facturas</p>
          </div>
        </div>
        <Button
          onClick={openCreateAccount}
          className="bg-neon-orange/20 border border-neon-orange/50 text-neon-orange hover:bg-neon-orange/30 hover:shadow-[0_0_15px_rgba(255,107,53,0.3)] transition-all"
        >
          <Plus className="size-4" />
          Nuevo Servicio
        </Button>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Pagadas */}
        <ServiceBillSummaryCard
          accounts={accounts}
          expenseCategories={expenseCategories}
          refreshKey={refreshKey}
          type="paid"
        />
        {/* Pendientes */}
        <ServiceBillSummaryCard
          accounts={accounts}
          expenseCategories={expenseCategories}
          refreshKey={refreshKey}
          type="unpaid"
        />
      </div>

      {/* ── Empty State ── */}
      {(!accounts || accounts.length === 0) ? (
        <Card className="border-neon-orange/10 bg-card/50 backdrop-blur-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Receipt className="size-10 mb-3 text-neon-orange/30" />
            <p className="text-lg font-medium">Sin servicios registrados</p>
            <p className="text-sm mb-4">Agrega tus cuentas de servicios como electricidad, agua, internet</p>
            <Button
              onClick={openCreateAccount}
              className="bg-neon-orange/20 border border-neon-orange/50 text-neon-orange hover:bg-neon-orange/30"
            >
              <Plus className="size-4" />
              Agregar Primer Servicio
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* ── Table ── */
        <Card className="border-neon-orange/10 bg-card/50 backdrop-blur-sm">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-neon-orange/10 hover:bg-transparent">
                  <TableHead className="text-neon-orange/70">Nombre</TableHead>
                  <TableHead className="text-neon-orange/70 hidden sm:table-cell">Proveedor</TableHead>
                  <TableHead className="text-neon-orange/70 hidden md:table-cell">N° Cuenta</TableHead>
                  <TableHead className="text-neon-orange/70 hidden lg:table-cell">Categoría</TableHead>
                  <TableHead className="text-neon-orange/70 hidden sm:table-cell">Estado</TableHead>
                  <TableHead className="text-neon-orange/70 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => {
                  const isExpanded = expandedAccounts.has(account.id)
                  const categoryInfo = getCategoryInfo(account.categoryId)
                  const isActive = account.isActive

                  return (
                    <>
                      <TableRow
                        key={account.id}
                        className={`border-neon-orange/5 hover:bg-neon-orange/5 transition-colors ${!isActive ? 'opacity-50' : ''}`}
                      >
                        {/* Nombre */}
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-6 p-0 text-muted-foreground hover:text-neon-orange"
                              onClick={() => toggleExpand(account.id)}
                            >
                              {isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                            </Button>
                            <Receipt className="size-4 text-neon-orange shrink-0" />
                            <span className="font-medium truncate max-w-[130px]">{account.name}</span>
                          </div>
                        </TableCell>
                        {/* Proveedor */}
                        <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                          {account.provider}
                        </TableCell>
                        {/* N° Cuenta */}
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                          {account.accountNumber || '—'}
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
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground hover:text-neon-blue hover:bg-neon-blue/10"
                              onClick={() => openEditAccount(account)}
                              title="Editar"
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground hover:text-neon-pink hover:bg-neon-pink/10"
                              onClick={() => {
                                setDeletingAccountId(account.id)
                                setDeleteDialogOpen(true)
                              }}
                              title="Eliminar"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Expanded Bills Sub-Table */}
                      {isExpanded && (
                        <TableRow key={`${account.id}-bills`} className="border-neon-orange/5">
                          <TableCell colSpan={6} className="bg-muted/20 p-0">
                            <div className="p-3">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-sm font-medium text-muted-foreground">Facturas</h4>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="border-neon-orange/20 text-neon-orange hover:bg-neon-orange/10 text-xs h-7"
                                  onClick={() => openCreateBill(account.id)}
                                >
                                  <Plus className="size-3" />
                                  Nueva Factura
                                </Button>
                              </div>
                              <BillsSubTable
                                accountId={account.id}
                                onPayBill={handlePayBill}
                                onUnpayBill={handleUnpayBill}
                                refreshKey={refreshKey}
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

      {/* ── Create/Edit Account Dialog ─────────────────────────────── */}
      <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
        <DialogContent className="border-neon-orange/20 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-neon-orange">
              {editingAccount ? 'Editar Servicio' : 'Nuevo Servicio'}
            </DialogTitle>
            <DialogDescription>
              {editingAccount
                ? 'Modifica los datos de la cuenta de servicio.'
                : 'Agrega una nueva cuenta de servicio para gestionar sus facturas.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={accountForm.handleSubmit(onSubmitAccount)} className="space-y-4">
            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="svc-name">Nombre</Label>
              <Input
                id="svc-name"
                placeholder="Ej: Electricidad, Internet..."
                className="border-neon-orange/20 focus:border-neon-orange/50"
                {...accountForm.register('name')}
              />
              {accountForm.formState.errors.name && (
                <p className="text-xs text-destructive">
                  {accountForm.formState.errors.name.message}
                </p>
              )}
            </div>

            {/* Provider */}
            <div className="grid gap-2">
              <Label htmlFor="svc-provider">Proveedor</Label>
              <Input
                id="svc-provider"
                placeholder="Ej: CGE, Movistar..."
                className="border-neon-orange/20 focus:border-neon-orange/50"
                {...accountForm.register('provider')}
              />
              {accountForm.formState.errors.provider && (
                <p className="text-xs text-destructive">
                  {accountForm.formState.errors.provider.message}
                </p>
              )}
            </div>

            {/* Account Number */}
            <div className="grid gap-2">
              <Label htmlFor="svc-account-number">
                N° de Cuenta <span className="text-muted-foreground text-xs">(opcional)</span>
              </Label>
              <Input
                id="svc-account-number"
                placeholder="Número de cliente o cuenta"
                className="border-neon-orange/20 focus:border-neon-orange/50"
                {...accountForm.register('accountNumber')}
              />
            </div>

            {/* Category */}
            <div className="grid gap-2">
              <Label>Categoría</Label>
              <Select
                value={accountForm.watch('categoryId') || '__none__'}
                onValueChange={(val) => {
                  accountForm.setValue('categoryId', val === '__none__' ? '' : val)
                }}
              >
                <SelectTrigger className="w-full border-neon-orange/20 focus:border-neon-orange/50">
                  <SelectValue placeholder="Sin categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin categoría</SelectItem>
                  {expenseCategories?.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Active Switch */}
            <div className="grid gap-2">
              <Label>Estado</Label>
              <div className="flex items-center gap-3 h-9">
                <Switch
                  checked={accountForm.watch('isActive')}
                  onCheckedChange={(checked) => accountForm.setValue('isActive', checked)}
                />
                <span className="text-sm">
                  {accountForm.watch('isActive') ? (
                    <span className="text-neon-green flex items-center gap-1">
                      <Power className="size-3" /> Activo
                    </span>
                  ) : (
                    <span className="text-neon-pink flex items-center gap-1">
                      <PowerOff className="size-3" /> Inactivo
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Notes */}
            <div className="grid gap-2">
              <Label htmlFor="svc-notes">
                Notas <span className="text-muted-foreground text-xs">(opcional)</span>
              </Label>
              <Textarea
                id="svc-notes"
                placeholder="Notas adicionales..."
                rows={2}
                className="border-neon-orange/20 focus:border-neon-orange/50"
                {...accountForm.register('notes')}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAccountDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-neon-orange/20 border border-neon-orange/50 text-neon-orange hover:bg-neon-orange/30"
              >
                {editingAccount ? 'Guardar Cambios' : 'Crear Servicio'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Create Bill Dialog ─────────────────────────────────────── */}
      <Dialog open={billDialogOpen} onOpenChange={setBillDialogOpen}>
        <DialogContent className="border-neon-orange/20 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-neon-orange">Nueva Factura</DialogTitle>
            <DialogDescription>
              Ingresa los datos de la factura para este servicio.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={billForm.handleSubmit(onSubmitBill)} className="space-y-4">
            {/* Amount */}
            <div className="grid gap-2">
              <Label htmlFor="bill-amount">Monto</Label>
              <Input
                id="bill-amount"
                type="number"
                min={1}
                placeholder="$0"
                className="border-neon-orange/20 focus:border-neon-orange/50"
                {...billForm.register('amount', { valueAsNumber: true })}
              />
              {billForm.formState.errors.amount && (
                <p className="text-xs text-destructive">
                  {billForm.formState.errors.amount.message}
                </p>
              )}
            </div>

            {/* Due Date */}
            <div className="grid gap-2">
              <Label htmlFor="bill-due-date">Fecha de Vencimiento</Label>
              <Input
                id="bill-due-date"
                type="date"
                className="border-neon-orange/20 focus:border-neon-orange/50"
                {...billForm.register('dueDate')}
              />
              {billForm.formState.errors.dueDate && (
                <p className="text-xs text-destructive">
                  {billForm.formState.errors.dueDate.message}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setBillDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-neon-orange/20 border border-neon-orange/50 text-neon-orange hover:bg-neon-orange/30"
              >
                Crear Factura
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ─────────────────────────────── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="border-neon-pink/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-neon-pink">Eliminar Servicio</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de eliminar este servicio? Se eliminarán también todas sus facturas asociadas. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteAccount}
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

// ─── Bill Summary Card ────────────────────────────────────────────

function ServiceBillSummaryCard({
  accounts,
  expenseCategories,
  refreshKey,
  type,
}: {
  accounts?: ServiceAccount[]
  expenseCategories?: ExpenseCategory[]
  refreshKey: number
  type: 'paid' | 'unpaid'
}) {
  const [count, setCount] = useState(0)

  useAsyncData(async () => {
    if (!accounts || accounts.length === 0) {
      setCount(0)
      return null
    }
    let total = 0
    for (const acc of accounts) {
      const bills = await serviceService.getBills(acc.id)
      for (const bill of bills) {
        if (type === 'paid' && bill.paid) total++
        if (type === 'unpaid' && !bill.paid) total++
      }
    }
    setCount(total)
    return null
  }, [refreshKey, accounts, type])

  const isPaid = type === 'paid'
  const color = isPaid ? '#01ff89' : '#ff2a6d'
  const label = isPaid ? 'Pagadas' : 'Pendientes'
  const Icon = isPaid ? CheckCircle2 : XCircle
  const borderColor = isPaid ? 'border-neon-green/20' : 'border-neon-pink/20'
  const iconBg = isPaid ? 'bg-neon-green/10 border-neon-green/30' : 'bg-neon-pink/10 border-neon-pink/30'

  return (
    <Card className={`${borderColor} bg-card/50 backdrop-blur-sm`}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`flex items-center justify-center size-10 rounded-lg ${iconBg} border`}>
          <Icon className="size-5" style={{ color }} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold font-mono" style={{ color }}>
            {count}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Bills Sub-Table Component ────────────────────────────────────

interface BillsSubTableProps {
  accountId: string
  onPayBill: (billId: string) => void
  onUnpayBill: (billId: string) => void
  refreshKey: number
}

function BillsSubTable({ accountId, onPayBill, onUnpayBill, refreshKey }: BillsSubTableProps) {
  const { data: bills, loading: billsLoading } = useAsyncData(
    () => serviceService.getBills(accountId),
    [accountId, refreshKey]
  )

  if (billsLoading) {
    return (
      <div className="space-y-2 py-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-8 bg-muted/50 rounded animate-pulse" />
        ))}
      </div>
    )
  }

  if (!bills || bills.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-4 bg-muted/20 rounded-md">
        Sin facturas registradas
      </p>
    )
  }

  return (
    <div className="rounded-md border border-neon-orange/10 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-neon-orange/10 hover:bg-transparent">
            <TableHead className="text-neon-orange/60 text-xs h-8">Fecha Vencimiento</TableHead>
            <TableHead className="text-neon-orange/60 text-xs h-8 text-right">Monto</TableHead>
            <TableHead className="text-neon-orange/60 text-xs h-8 text-center">Estado</TableHead>
            <TableHead className="text-neon-orange/60 text-xs h-8 hidden sm:table-cell">Fecha Pago</TableHead>
            <TableHead className="text-neon-orange/60 text-xs h-8 text-right">Acción</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bills.map((bill) => (
            <TableRow key={bill.id} className="border-neon-orange/5 hover:bg-neon-orange/5">
              {/* Fecha Vencimiento */}
              <TableCell className="text-xs py-1.5">
                {formatDate(bill.dueDate)}
              </TableCell>
              {/* Monto */}
              <TableCell className="text-xs py-1.5 text-right font-mono font-medium">
                {formatCurrency(bill.amount)}
              </TableCell>
              {/* Estado */}
              <TableCell className="text-xs py-1.5 text-center">
                {bill.paid ? (
                  <span
                    className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium"
                    style={{ backgroundColor: '#01ff8922', border: '1px solid #01ff8944', color: '#01ff89' }}
                  >
                    <CheckCircle2 className="size-3 mr-0.5" />
                    Pagada
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium"
                    style={{ backgroundColor: '#ff2a6d22', border: '1px solid #ff2a6d44', color: '#ff2a6d' }}
                  >
                    <XCircle className="size-3 mr-0.5" />
                    Pendiente
                  </span>
                )}
              </TableCell>
              {/* Fecha Pago */}
              <TableCell className="text-xs py-1.5 text-muted-foreground hidden sm:table-cell">
                {bill.paid && bill.paidDate ? formatDate(bill.paidDate) : '—'}
              </TableCell>
              {/* Acción */}
              <TableCell className="text-xs py-1.5 text-right">
                {bill.paid ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] text-neon-pink hover:text-neon-pink hover:bg-neon-pink/10 px-2"
                    onClick={() => onUnpayBill(bill.id)}
                  >
                    Anular
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="h-6 text-[10px] bg-neon-green/20 text-neon-green hover:bg-neon-green/30 border border-neon-green/30 px-2"
                    onClick={() => onPayBill(bill.id)}
                  >
                    Pagar
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
