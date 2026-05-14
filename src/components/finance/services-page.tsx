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
  Hash,
  StickyNote,
  Power,
  PowerOff,
  CheckCircle2,
  XCircle,
} from 'lucide-react'

import { serviceService, categoryService, useAsyncData } from '@/lib/data'
import { formatCurrency, formatDate } from '@/lib/finance-utils'
import type { ServiceAccount, ServiceBill, ExpenseCategory } from '@/lib/db-client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

// ─── Zod Schemas ────────────────────────────────────────────────────

const serviceAccountSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  provider: z.string().min(1, 'El proveedor es requerido'),
  accountNumber: z.string().optional().default(''),
  categoryId: z.string().optional().default(''),
  amount: z.coerce.number().min(0, 'El monto debe ser mayor o igual a 0'),
  dueDay: z.coerce.number().min(1, 'Mínimo 1').max(31, 'Máximo 31').optional().default(0),
  isActive: z.boolean().default(true),
  notes: z.string().optional().default(''),
})

type ServiceAccountForm = z.infer<typeof serviceAccountSchema>

const billSchema = z.object({
  amount: z.coerce.number().min(1, 'El monto debe ser mayor a 0'),
  dueDate: z.string().min(1, 'La fecha es requerida'),
})

type BillForm = z.infer<typeof billSchema>

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
    refetch: refetchAccounts,
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
      amount: 0,
      dueDay: 0,
      isActive: true,
      notes: '',
    },
  })

  const openCreateAccount = () => {
    setEditingAccount(null)
    accountForm.reset({
      name: '',
      provider: '',
      accountNumber: '',
      categoryId: '',
      amount: 0,
      dueDay: 0,
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
      amount: account.amount,
      dueDay: account.dueDay ?? 0,
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
        amount: values.amount,
        dueDay: values.dueDay || undefined,
        isActive: values.isActive,
        notes: values.notes || undefined,
      }

      if (editingAccount) {
        await serviceService.updateAccount(editingAccount.id, data)
        toast.success('Servicio actualizado', {
          description: `"${values.name}" fue actualizado correctamente.`,
        })
      } else {
        await serviceService.createAccount(data as Omit<ServiceAccount, 'id' | 'createdAt' | 'updatedAt'>)
        toast.success('Servicio creado', {
          description: `"${values.name}" fue creado correctamente.`,
        })
      }

      setAccountDialogOpen(false)
      refresh()
    } catch (err) {
      toast.error('Error', {
        description: err instanceof Error ? err.message : 'No se pudo guardar el servicio.',
      })
    }
  }

  // ─── Delete Account ─────────────────────────────────────────────

  const confirmDeleteAccount = async () => {
    if (!deletingAccountId) return
    try {
      await serviceService.deleteAccount(deletingAccountId)
      toast.success('Servicio eliminado', {
        description: 'El servicio y sus facturas fueron eliminados.',
      })
      setDeleteDialogOpen(false)
      setDeletingAccountId(null)
      refresh()
    } catch (err) {
      toast.error('Error', {
        description: err instanceof Error ? err.message : 'No se pudo eliminar el servicio.',
      })
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
      toast.success('Factura creada', {
        description: `Factura por ${formatCurrency(values.amount)} creada correctamente.`,
      })
      setBillDialogOpen(false)
      setBillAccountId(null)
      refresh()
    } catch (err) {
      toast.error('Error', {
        description: err instanceof Error ? err.message : 'No se pudo crear la factura.',
      })
    }
  }

  // ─── Pay / Unpay Bill ───────────────────────────────────────────

  const handlePayBill = async (billId: string) => {
    try {
      await serviceService.payBill(billId)
      toast.success('Factura pagada', {
        description: 'Se registró el pago y el gasto correspondiente.',
      })
      refresh()
    } catch (err) {
      toast.error('Error', {
        description: err instanceof Error ? err.message : 'No se pudo pagar la factura.',
      })
    }
  }

  const handleUnpayBill = async (billId: string) => {
    try {
      await serviceService.unpayBill(billId)
      toast.success('Pago anulado', {
        description: 'Se eliminó el gasto asociado y se marcó como impaga.',
      })
      refresh()
    } catch (err) {
      toast.error('Error', {
        description: err instanceof Error ? err.message : 'No se pudo anular el pago.',
      })
    }
  }

  // ─── Category name lookup ───────────────────────────────────────

  const getCategoryName = (categoryId?: string) => {
    if (!categoryId || !expenseCategories) return null
    const cat = expenseCategories.find((c) => c.id === categoryId)
    return cat?.name ?? null
  }

  // ─── Loading ────────────────────────────────────────────────────

  if (accountsLoading) {
    return (
      <div className="page-enter p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-neon-yellow">Servicios</h1>
        </div>
        {[1, 2, 3].map((i) => (
          <Card key={i} className="border-neon-yellow/10 animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-muted rounded w-1/3 mb-3" />
              <div className="h-3 bg-muted rounded w-1/2 mb-2" />
              <div className="h-3 bg-muted rounded w-1/4" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <div className="page-enter p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center size-10 rounded-lg border border-neon-yellow/30 bg-neon-yellow/10">
            <Receipt className="size-5 text-neon-yellow" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-neon-yellow">Servicios</h1>
            <p className="text-sm text-muted-foreground">
              Gestiona tus cuentas de servicios y facturas
            </p>
          </div>
        </div>
        <Button
          onClick={openCreateAccount}
          className="bg-neon-yellow text-black hover:bg-neon-yellow/80 shadow-neon-yellow hover:shadow-neon-yellow font-semibold"
          style={{ '--tw-shadow-color': 'rgba(249, 240, 2, 0.3)' } as React.CSSProperties}
        >
          <Plus className="size-4" />
          Nuevo Servicio
        </Button>
      </div>

      {/* Empty State */}
      {!accounts || accounts.length === 0 ? (
        <Card className="border-neon-yellow/10">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="size-16 rounded-full border border-neon-yellow/20 bg-neon-yellow/5 flex items-center justify-center mb-4">
              <Receipt className="size-8 text-neon-yellow/50" />
            </div>
            <h3 className="text-lg font-semibold mb-1">Sin servicios registrados</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-4">
              Agrega tus cuentas de servicios como electricidad, agua, internet, teléfono y gestiona sus facturas mensuales.
            </p>
            <Button
              onClick={openCreateAccount}
              variant="outline"
              className="border-neon-yellow/30 text-neon-yellow hover:bg-neon-yellow/10"
            >
              <Plus className="size-4" />
              Agregar Primer Servicio
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Service Accounts List */
        <div className="space-y-4">
          {accounts.map((account) => (
            <ServiceAccountCard
              key={account.id}
              account={account}
              isExpanded={expandedAccounts.has(account.id)}
              onToggleExpand={() => toggleExpand(account.id)}
              onEdit={() => openEditAccount(account)}
              onDelete={() => {
                setDeletingAccountId(account.id)
                setDeleteDialogOpen(true)
              }}
              onAddBill={() => openCreateBill(account.id)}
              onPayBill={handlePayBill}
              onUnpayBill={handleUnpayBill}
              getCategoryName={getCategoryName}
              refreshKey={refreshKey}
            />
          ))}
        </div>
      )}

      {/* ── Create/Edit Account Dialog ─────────────────────────────── */}
      <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
        <DialogContent className="border-neon-yellow/20 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-neon-yellow">
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
                className="border-neon-yellow/20 focus:border-neon-yellow/50"
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
                className="border-neon-yellow/20 focus:border-neon-yellow/50"
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
                className="border-neon-yellow/20 focus:border-neon-yellow/50"
                {...accountForm.register('accountNumber')}
              />
            </div>

            {/* Category + Amount Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Category */}
              <div className="grid gap-2">
                <Label>Categoría</Label>
                <Select
                  value={accountForm.watch('categoryId') || '__none__'}
                  onValueChange={(val) => {
                    accountForm.setValue('categoryId', val === '__none__' ? '' : val)
                  }}
                >
                  <SelectTrigger className="w-full border-neon-yellow/20 focus:border-neon-yellow/50">
                    <SelectValue placeholder="Sin categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin categoría</SelectItem>
                    {expenseCategories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Amount */}
              <div className="grid gap-2">
                <Label htmlFor="svc-amount">Monto Mensual</Label>
                <Input
                  id="svc-amount"
                  type="number"
                  min={0}
                  placeholder="$0"
                  className="border-neon-yellow/20 focus:border-neon-yellow/50"
                  {...accountForm.register('amount', { valueAsNumber: true })}
                />
                {accountForm.formState.errors.amount && (
                  <p className="text-xs text-destructive">
                    {accountForm.formState.errors.amount.message}
                  </p>
                )}
              </div>
            </div>

            {/* Due Day + Active Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Due Day */}
              <div className="grid gap-2">
                <Label htmlFor="svc-due-day">
                  Día de Vencimiento <span className="text-muted-foreground text-xs">(1-31)</span>
                </Label>
                <Input
                  id="svc-due-day"
                  type="number"
                  min={1}
                  max={31}
                  placeholder="Ej: 10"
                  className="border-neon-yellow/20 focus:border-neon-yellow/50"
                  {...accountForm.register('dueDay', { valueAsNumber: true })}
                />
                {accountForm.formState.errors.dueDay && (
                  <p className="text-xs text-destructive">
                    {accountForm.formState.errors.dueDay.message}
                  </p>
                )}
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
                className="border-neon-yellow/20 focus:border-neon-yellow/50"
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
                className="bg-neon-yellow text-black hover:bg-neon-yellow/80 font-semibold"
              >
                {editingAccount ? 'Guardar Cambios' : 'Crear Servicio'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Create Bill Dialog ─────────────────────────────────────── */}
      <Dialog open={billDialogOpen} onOpenChange={setBillDialogOpen}>
        <DialogContent className="border-neon-yellow/20 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-neon-yellow">Nueva Factura</DialogTitle>
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
                className="border-neon-yellow/20 focus:border-neon-yellow/50"
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
                className="border-neon-yellow/20 focus:border-neon-yellow/50"
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
                className="bg-neon-yellow text-black hover:bg-neon-yellow/80 font-semibold"
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
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─── Service Account Card Component ────────────────────────────────

interface ServiceAccountCardProps {
  account: ServiceAccount
  isExpanded: boolean
  onToggleExpand: () => void
  onEdit: () => void
  onDelete: () => void
  onAddBill: () => void
  onPayBill: (billId: string) => void
  onUnpayBill: (billId: string) => void
  getCategoryName: (categoryId?: string) => string | null
  refreshKey: number
}

function ServiceAccountCard({
  account,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onAddBill,
  onPayBill,
  onUnpayBill,
  getCategoryName,
  refreshKey,
}: ServiceAccountCardProps) {
  const categoryName = getCategoryName(account.categoryId)

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
      <Card className="border-neon-yellow/15 hover:border-neon-yellow/30 transition-colors">
        <CardHeader className="pb-0">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-3 min-w-0">
              <CollapsibleTrigger asChild>
                <button className="mt-0.5 text-muted-foreground hover:text-neon-yellow transition-colors shrink-0 cursor-pointer">
                  {isExpanded ? (
                    <ChevronDown className="size-5" />
                  ) : (
                    <ChevronRight className="size-5" />
                  )}
                </button>
              </CollapsibleTrigger>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-base text-foreground truncate">
                    {account.name}
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className={
                      account.isActive
                        ? 'border-neon-green/40 text-neon-green bg-neon-green/10'
                        : 'border-neon-pink/40 text-neon-pink bg-neon-pink/10'
                    }
                  >
                    {account.isActive ? 'Activo' : 'Inactivo'}
                  </Badge>
                  {categoryName && (
                    <Badge variant="secondary" className="text-xs">
                      {categoryName}
                    </Badge>
                  )}
                </div>
                <CardDescription className="mt-1 flex items-center gap-3 flex-wrap">
                  <span className="flex items-center gap-1">
                    <CircleDollarSign className="size-3" />
                    {account.provider}
                  </span>
                  {account.accountNumber && (
                    <span className="flex items-center gap-1">
                      <Hash className="size-3" />
                      {account.accountNumber}
                    </span>
                  )}
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="text-right mr-2">
                <div className="text-lg font-bold text-neon-yellow">
                  {formatCurrency(account.amount)}
                </div>
                {account.dueDay && (
                  <div className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                    <CalendarDays className="size-3" />
                    Vence el {account.dueDay}
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-neon-blue"
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit()
                }}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-neon-pink"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete()
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Notes */}
        {account.notes && (
          <CardContent className="pb-0 pt-2">
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 rounded-md p-2">
              <StickyNote className="size-3 mt-0.5 shrink-0" />
              <span>{account.notes}</span>
            </div>
          </CardContent>
        )}

        {/* Bills Section */}
        <CollapsibleContent>
          <CardContent className="pt-2">
            <BillsList
              accountId={account.id}
              onPayBill={onPayBill}
              onUnpayBill={onUnpayBill}
              onAddBill={onAddBill}
              refreshKey={refreshKey}
            />
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

// ─── Bills List Component ──────────────────────────────────────────

interface BillsListProps {
  accountId: string
  onPayBill: (billId: string) => void
  onUnpayBill: (billId: string) => void
  onAddBill: () => void
  refreshKey: number
}

function BillsList({ accountId, onPayBill, onUnpayBill, onAddBill, refreshKey }: BillsListProps) {
  const { data: bills, loading: billsLoading } = useAsyncData(
    () => serviceService.getBills(accountId),
    [accountId, refreshKey]
  )

  if (billsLoading) {
    return (
      <div className="space-y-2 pt-2">
        <div className="h-3 bg-muted rounded w-1/4" />
        {[1, 2].map((i) => (
          <div key={i} className="h-8 bg-muted/50 rounded animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-muted-foreground">Facturas</h4>
        <Button
          variant="outline"
          size="sm"
          className="border-neon-yellow/20 text-neon-yellow hover:bg-neon-yellow/10 text-xs h-7"
          onClick={onAddBill}
        >
          <Plus className="size-3" />
          Nueva Factura
        </Button>
      </div>

      {!bills || bills.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4 bg-muted/20 rounded-md">
          Sin facturas registradas
        </p>
      ) : (
        <div className="rounded-md border border-neon-yellow/10 overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] sm:grid-cols-[1fr_auto_auto_auto] gap-2 px-3 py-2 bg-muted/30 text-xs font-medium text-muted-foreground">
            <span>Vencimiento</span>
            <span className="text-right">Monto</span>
            <span className="text-center">Estado</span>
            <span className="text-right">Acción</span>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-neon-yellow/5 max-h-96 overflow-y-auto cyber-scrollbar">
            {bills.map((bill) => (
              <BillRow
                key={bill.id}
                bill={bill}
                onPay={() => onPayBill(bill.id)}
                onUnpay={() => onUnpayBill(bill.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Bill Row Component ────────────────────────────────────────────

interface BillRowProps {
  bill: ServiceBill
  onPay: () => void
  onUnpay: () => void
}

function BillRow({ bill, onPay, onUnpay }: BillRowProps) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-3 py-2 text-sm items-center hover:bg-muted/20 transition-colors">
      {/* Due Date */}
      <div className="flex flex-col">
        <span className="text-xs">{formatDate(bill.dueDate)}</span>
        {bill.paid && bill.paidDate && (
          <span className="text-[10px] text-muted-foreground">
            Pagado: {formatDate(bill.paidDate)}
          </span>
        )}
      </div>

      {/* Amount */}
      <span className="text-right font-medium text-foreground">
        {formatCurrency(bill.amount)}
      </span>

      {/* Status */}
      {bill.paid ? (
        <Badge className="border-neon-green/40 text-neon-green bg-neon-green/10 text-[10px] px-1.5 py-0">
          <CheckCircle2 className="size-3 mr-0.5" />
          Pagada
        </Badge>
      ) : (
        <Badge className="border-neon-pink/40 text-neon-pink bg-neon-pink/10 text-[10px] px-1.5 py-0">
          <XCircle className="size-3 mr-0.5" />
          Impaga
        </Badge>
      )}

      {/* Action */}
      <div className="text-right">
        {bill.paid ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-neon-pink hover:text-neon-pink hover:bg-neon-pink/10"
            onClick={onUnpay}
          >
            Anular pago
          </Button>
        ) : (
          <Button
            size="sm"
            className="h-7 text-xs bg-neon-green/20 text-neon-green hover:bg-neon-green/30 border border-neon-green/30"
            onClick={onPay}
          >
            Pagar
          </Button>
        )}
      </div>
    </div>
  )
}
