'use client'

import { useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Plus,
  Pencil,
  Trash2,
  ArrowRightLeft,
  Loader2,
  AlertTriangle,
  Wallet,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
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
import { Card, CardContent } from '@/components/ui/card'

import { accountService, transferService, useAsyncData } from '@/lib/data'
import { formatCurrency, ACCOUNT_TYPES } from '@/lib/finance-utils'
import type { Account } from '@/lib/db-client'

// ─── Zod Schemas ──────────────────────────────────────────────────

const accountSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  type: z.string().min(1, 'Selecciona un tipo'),
  balance: z.coerce.number({ invalid_type_error: 'Ingresa un número válido' }),
  currency: z.string().min(1, 'La moneda es requerida'),
  icon: z.string().optional(),
  color: z.string().optional(),
  notes: z.string().optional(),
})

type AccountFormValues = z.infer<typeof accountSchema>

const transferSchema = z.object({
  fromAccountId: z.string().min(1, 'Selecciona cuenta de origen'),
  toAccountId: z.string().min(1, 'Selecciona cuenta de destino'),
  amount: z.coerce.number().min(1, 'El monto debe ser mayor a 0'),
  description: z.string().optional(),
})

type TransferFormValues = z.infer<typeof transferSchema>

// ─── Neon glow helper ─────────────────────────────────────────────

function neonBorderForColor(color: string): string {
  const c = color || '#05d9e8'
  return `border-color: ${c}; box-shadow: 0 0 8px ${c}33, 0 0 16px ${c}11;`
}

// ─── Component ────────────────────────────────────────────────────

interface AccountsPageProps {
  currentMonth?: number
  currentYear?: number
}

export function AccountsPage({ currentMonth, currentYear }: AccountsPageProps) {
  // ── Dialog State ──
  const [dialogOpen, setDialogOpen] = useState(false)
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // ── Data Fetching ──
  const { data: accounts, loading, refetch } = useAsyncData(() => accountService.getAll(), [])

  // ── Account Form ──
  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: '',
      type: 'checking',
      balance: 0,
      currency: 'USD',
      icon: '💰',
      color: '#05d9e8',
      notes: '',
    },
  })

  // ── Transfer Form ──
  const transferForm = useForm<TransferFormValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      fromAccountId: '',
      toAccountId: '',
      amount: 0,
      description: '',
    },
  })

  // ── Open Create ──
  const openCreate = () => {
    setEditingAccount(null)
    form.reset({
      name: '',
      type: 'checking',
      balance: 0,
      currency: 'USD',
      icon: '💰',
      color: '#05d9e8',
      notes: '',
    })
    setDialogOpen(true)
  }

  // ── Open Edit ──
  const openEdit = (account: Account) => {
    setEditingAccount(account)
    form.reset({
      name: account.name,
      type: account.type,
      balance: account.balance,
      currency: account.currency,
      icon: account.icon || '💰',
      color: account.color || '#05d9e8',
      notes: account.notes || '',
    })
    setDialogOpen(true)
  }

  // ── Submit Account ──
  const onSubmit = async (values: AccountFormValues) => {
    setSubmitting(true)
    try {
      const accountData = {
        name: values.name,
        type: values.type,
        balance: values.balance,
        currency: values.currency,
        icon: values.icon || '💰',
        color: values.color || '#05d9e8',
        notes: values.notes || undefined,
      }

      if (editingAccount) {
        await accountService.update(editingAccount.id, accountData)
        toast.success('Cuenta actualizada')
      } else {
        await accountService.create(accountData)
        toast.success('Cuenta creada')
      }
      setDialogOpen(false)
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Delete Account ──
  const onDelete = async () => {
    if (!deletingAccountId) return
    try {
      await accountService.delete(deletingAccountId)
      toast.success('Cuenta eliminada')
      refetch()
    } catch (err) {
      toast.error('Error al eliminar la cuenta')
    } finally {
      setDeleteDialogOpen(false)
      setDeletingAccountId(null)
    }
  }

  // ── Submit Transfer ──
  const onSubmitTransfer = async (values: TransferFormValues) => {
    setSubmitting(true)
    try {
      await transferService.create(
        values.fromAccountId,
        values.toAccountId,
        values.amount,
        values.description || undefined
      )
      toast.success('Transferencia realizada')
      setTransferDialogOpen(false)
      transferForm.reset()
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error en transferencia')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Total Balance ──
  const totalBalance = accounts?.reduce((sum, a) => sum + a.balance, 0) ?? 0

  return (
    <div className="page-enter p-4 md:p-6 space-y-4 overflow-auto">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neon-blue">Cuentas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Balance total: <span className="font-mono font-semibold text-neon-green">{formatCurrency(totalBalance)}</span>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={openCreate}
            className="bg-neon-blue text-black hover:bg-neon-blue/80 shadow-neon-blue"
          >
            <Plus className="size-4" />
            Nueva Cuenta
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              transferForm.reset()
              setTransferDialogOpen(true)
            }}
            className="border-neon-blue/30 text-neon-blue hover:bg-neon-blue/10"
          >
            <ArrowRightLeft className="size-4" />
            Transferir
          </Button>
        </div>
      </div>

      {/* ── Accounts Grid ── */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-8 animate-spin text-neon-blue" />
          <span className="ml-3 text-muted-foreground">Cargando cuentas...</span>
        </div>
      ) : !accounts?.length ? (
        <Card className="border-neon-blue/10 bg-card/50 backdrop-blur-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <AlertTriangle className="size-10 mb-3 text-neon-yellow" />
            <p className="text-lg font-medium">No hay cuentas</p>
            <p className="text-sm">Crea una nueva cuenta para comenzar</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((account) => (
            <Card
              key={account.id}
              className="border-2 bg-card/80 backdrop-blur-sm hover:bg-card/90 transition-all group"
              style={neonBorderForColor(account.color)}
            >
              <CardContent className="p-4 space-y-3">
                {/* Top row: Icon + Name + Type badge */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-2xl shrink-0">{account.icon || '💰'}</span>
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{account.name}</h3>
                      <Badge
                        variant="outline"
                        className="text-[10px] mt-0.5"
                        style={{
                          borderColor: `${account.color || '#05d9e8'}40`,
                          color: account.color || '#05d9e8',
                        }}
                      >
                        {(ACCOUNT_TYPES as Record<string, string>)[account.type] || account.type}
                      </Badge>
                    </div>
                  </div>
                  <span
                    className="w-3 h-3 rounded-full shrink-0 mt-1"
                    style={{ backgroundColor: account.color || '#05d9e8' }}
                  />
                </div>

                {/* Balance */}
                <div>
                  <p className="text-xs text-muted-foreground">Saldo</p>
                  <p
                    className="text-2xl font-mono font-bold"
                    style={{ color: account.color || '#05d9e8' }}
                  >
                    {formatCurrency(account.balance)}
                  </p>
                  <p className="text-xs text-muted-foreground">{account.currency}</p>
                </div>

                {/* Notes */}
                {account.notes && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{account.notes}</p>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-neon-blue h-7 px-2"
                    onClick={() => openEdit(account)}
                  >
                    <Pencil className="size-3.5 mr-1" />
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-neon-pink h-7 px-2"
                    onClick={() => {
                      setDeletingAccountId(account.id)
                      setDeleteDialogOpen(true)
                    }}
                  >
                    <Trash2 className="size-3.5 mr-1" />
                    Eliminar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Create/Edit Account Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg border-neon-blue/20 bg-card">
          <DialogHeader>
            <DialogTitle className="text-neon-blue">
              {editingAccount ? 'Editar Cuenta' : 'Nueva Cuenta'}
            </DialogTitle>
            <DialogDescription>
              {editingAccount
                ? 'Modifica los datos de la cuenta'
                : 'Completa los datos para crear una cuenta'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {/* Name */}
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input
                  placeholder="Nombre de la cuenta"
                  {...form.register('name')}
                  className="border-neon-blue/20 focus-visible:border-neon-blue/50"
                />
                {form.formState.errors.name && (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>

              {/* Type */}
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={form.watch('type')}
                  onValueChange={(val) => form.setValue('type', val)}
                >
                  <SelectTrigger className="border-neon-blue/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="checking">Corriente</SelectItem>
                    <SelectItem value="savings">Ahorro</SelectItem>
                    <SelectItem value="cash">Efectivo</SelectItem>
                    <SelectItem value="credit">Crédito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Balance */}
              <div className="space-y-2">
                <Label>Saldo</Label>
                <Input
                  type="number"
                  step="1"
                  placeholder="0"
                  {...form.register('balance')}
                  className="border-neon-blue/20 focus-visible:border-neon-blue/50"
                />
                {form.formState.errors.balance && (
                  <p className="text-xs text-destructive">{form.formState.errors.balance.message}</p>
                )}
              </div>

              {/* Currency */}
              <div className="space-y-2">
                <Label>Moneda</Label>
                <Input
                  placeholder="USD"
                  {...form.register('currency')}
                  className="border-neon-blue/20 focus-visible:border-neon-blue/50"
                />
                {form.formState.errors.currency && (
                  <p className="text-xs text-destructive">{form.formState.errors.currency.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Icon */}
              <div className="space-y-2">
                <Label>Icono (emoji)</Label>
                <Input
                  placeholder="💰"
                  {...form.register('icon')}
                  className="border-neon-blue/20 focus-visible:border-neon-blue/50"
                />
              </div>

              {/* Color */}
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="#05d9e8"
                    {...form.register('color')}
                    className="border-neon-blue/20 focus-visible:border-neon-blue/50 flex-1"
                  />
                  <div
                    className="w-9 h-9 rounded-md border border-white/10 shrink-0"
                    style={{ backgroundColor: form.watch('color') || '#05d9e8' }}
                  />
                </div>
              </div>
            </div>

            {/* Predefined Colors */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Colores predefinidos</Label>
              <div className="flex gap-2 flex-wrap">
                {['#05d9e8', '#ff2a6d', '#01ff89', '#d300c5', '#f9f002', '#ff6b35', '#8b5cf6', '#06b6d4'].map(
                  (color) => (
                    <button
                      key={color}
                      type="button"
                      className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                      style={{
                        backgroundColor: color,
                        borderColor: form.watch('color') === color ? 'white' : 'transparent',
                      }}
                      onClick={() => form.setValue('color', color)}
                    />
                  )
                )}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notas (opcional)</Label>
              <Textarea
                placeholder="Notas adicionales..."
                {...form.register('notes')}
                className="border-neon-blue/20 focus-visible:border-neon-blue/50 min-h-[60px]"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="border-neon-blue/20"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-neon-blue text-black hover:bg-neon-blue/80 shadow-neon-blue"
              >
                {submitting && <Loader2 className="size-4 animate-spin" />}
                {editingAccount ? 'Actualizar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Transfer Between Accounts Dialog ── */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent className="sm:max-w-md border-neon-blue/20 bg-card">
          <DialogHeader>
            <DialogTitle className="text-neon-blue">Transferir entre Cuentas</DialogTitle>
            <DialogDescription>Transfiere fondos de una cuenta a otra</DialogDescription>
          </DialogHeader>

          <form onSubmit={transferForm.handleSubmit(onSubmitTransfer)} className="space-y-4">
            {/* From Account */}
            <div className="space-y-2">
              <Label>Cuenta de origen</Label>
              <Select
                value={transferForm.watch('fromAccountId') || ''}
                onValueChange={(val) => transferForm.setValue('fromAccountId', val)}
              >
                <SelectTrigger className="border-neon-blue/20">
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {accounts?.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.icon} {a.name} ({formatCurrency(a.balance)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {transferForm.formState.errors.fromAccountId && (
                <p className="text-xs text-destructive">
                  {transferForm.formState.errors.fromAccountId.message}
                </p>
              )}
            </div>

            {/* To Account */}
            <div className="space-y-2">
              <Label>Cuenta de destino</Label>
              <Select
                value={transferForm.watch('toAccountId') || ''}
                onValueChange={(val) => transferForm.setValue('toAccountId', val)}
              >
                <SelectTrigger className="border-neon-blue/20">
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {accounts
                    ?.filter((a) => a.id !== transferForm.watch('fromAccountId'))
                    .map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.icon} {a.name} ({formatCurrency(a.balance)})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {transferForm.formState.errors.toAccountId && (
                <p className="text-xs text-destructive">
                  {transferForm.formState.errors.toAccountId.message}
                </p>
              )}
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label>Monto</Label>
              <Input
                type="number"
                step="1"
                min="1"
                placeholder="0"
                {...transferForm.register('amount')}
                className="border-neon-blue/20 focus-visible:border-neon-blue/50"
              />
              {transferForm.formState.errors.amount && (
                <p className="text-xs text-destructive">
                  {transferForm.formState.errors.amount.message}
                </p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Descripción (opcional)</Label>
              <Input
                placeholder="Descripción de la transferencia"
                {...transferForm.register('description')}
                className="border-neon-blue/20 focus-visible:border-neon-blue/50"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setTransferDialogOpen(false)}
                className="border-neon-blue/20"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-neon-blue text-black hover:bg-neon-blue/80 shadow-neon-blue"
              >
                {submitting && <Loader2 className="size-4 animate-spin" />}
                Transferir
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="border-neon-pink/20 bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-neon-pink">Eliminar Cuenta</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar esta cuenta? Esta acción no se puede deshacer.
              Las transacciones asociadas no se eliminarán, pero perderán la referencia a esta
              cuenta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-neon-blue/20">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
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
