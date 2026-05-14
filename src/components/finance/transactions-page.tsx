'use client'

import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  ArrowRightLeft,
  Split,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'

import {
  transactionService,
  accountService,
  categoryService,
  transferService,
  useAsyncData,
} from '@/lib/data'
import { formatCurrency, formatDate, TRANSACTION_TYPES, ACCOUNT_TYPES } from '@/lib/finance-utils'
import type { Transaction, Account, IncomeCategory, ExpenseCategory } from '@/lib/db-client'

// ─── Zod Schemas ──────────────────────────────────────────────────

const transactionSchema = z.object({
  type: z.string().min(1, 'Selecciona un tipo'),
  amount: z.coerce.number().min(1, 'El monto debe ser mayor a 0'),
  description: z.string().min(1, 'La descripción es requerida'),
  categoryType: z.string().optional(),
  categoryId: z.string().optional(),
  accountId: z.string().min(1, 'Selecciona una cuenta'),
  date: z.string().min(1, 'La fecha es requerida'),
  notes: z.string().optional(),
  tags: z.string().optional(),
  isRecurring: z.boolean().optional(),
})

type TransactionFormValues = z.infer<typeof transactionSchema>

const transferSchema = z.object({
  fromAccountId: z.string().min(1, 'Selecciona cuenta de origen'),
  toAccountId: z.string().min(1, 'Selecciona cuenta de destino'),
  amount: z.coerce.number().min(1, 'El monto debe ser mayor a 0'),
  description: z.string().optional(),
})

type TransferFormValues = z.infer<typeof transferSchema>

const splitSchema = z.object({
  splits: z
    .array(
      z.object({
        amount: z.coerce.number().min(1, 'Monto requerido'),
        categoryId: z.string().min(1, 'Categoría requerida'),
        description: z.string().min(1, 'Descripción requerida'),
      })
    )
    .min(2, 'Debe haber al menos 2 partes'),
})

type SplitFormValues = z.infer<typeof splitSchema>

// ─── Component ────────────────────────────────────────────────────

interface TransactionsPageProps {
  currentMonth?: number
  currentYear?: number
}

export function TransactionsPage({ currentMonth, currentYear }: TransactionsPageProps) {
  // ── Filter State ──
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [accountFilter, setAccountFilter] = useState<string>('all')
  const [searchFilter, setSearchFilter] = useState<string>('')
  const [page, setPage] = useState(1)
  const pageSize = 10

  // ── Dialog State ──
  const [txDialogOpen, setTxDialogOpen] = useState(false)
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const [splitDialogOpen, setSplitDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [deletingTxId, setDeletingTxId] = useState<string | null>(null)
  const [splittingTx, setSplittingTx] = useState<Transaction | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // ── Data Fetching ──
  const {
    data: txResult,
    loading: txLoading,
    refetch: refetchTx,
  } = useAsyncData(
    () =>
      transactionService.getAll({
        month: currentMonth,
        year: currentYear,
        type: typeFilter !== 'all' ? typeFilter : undefined,
        categoryId: categoryFilter !== 'all' ? categoryFilter : undefined,
        accountId: accountFilter !== 'all' ? accountFilter : undefined,
        search: searchFilter || undefined,
        page,
        pageSize,
      }),
    [currentMonth, currentYear, typeFilter, categoryFilter, accountFilter, searchFilter, page]
  )

  const { data: accounts, refetch: refetchAccounts } = useAsyncData(() => accountService.getAll(), [])

  const { data: incomeCategories } = useAsyncData(
    () => categoryService.getAll('income') as Promise<IncomeCategory[]>,
    []
  )
  const { data: expenseCategories } = useAsyncData(
    () => categoryService.getAll('expense') as Promise<ExpenseCategory[]>,
    []
  )

  // ── Category lookup map ──
  const categoryMap = useCallback(() => {
    const map: Record<string, string> = {}
    for (const c of incomeCategories ?? []) map[c.id] = c.name
    for (const c of expenseCategories ?? []) map[c.id] = c.name
    return map
  }, [incomeCategories, expenseCategories])

  const accountMap = useCallback(() => {
    const map: Record<string, string> = {}
    for (const a of accounts ?? []) map[a.id] = a.name
    return map
  }, [accounts])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [typeFilter, categoryFilter, accountFilter, searchFilter])

  // ── Transaction Form ──
  const txForm = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: 'expense',
      amount: 0,
      description: '',
      categoryType: 'expense',
      categoryId: '',
      accountId: '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
      tags: '',
      isRecurring: false,
    },
  })

  const watchedType = txForm.watch('type')

  // Reset category when type changes
  useEffect(() => {
    txForm.setValue('categoryType', watchedType === 'income' ? 'income' : 'expense')
    txForm.setValue('categoryId', '')
  }, [watchedType, txForm])

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

  // ── Split Form ──
  const splitForm = useForm<SplitFormValues>({
    resolver: zodResolver(splitSchema),
    defaultValues: {
      splits: [
        { amount: 0, categoryId: '', description: '' },
        { amount: 0, categoryId: '', description: '' },
      ],
    },
  })

  // ── Open Edit Dialog ──
  const openEdit = (tx: Transaction) => {
    setEditingTx(tx)
    txForm.reset({
      type: tx.type === 'transfer' ? 'expense' : tx.type,
      amount: tx.amount,
      description: tx.description || '',
      categoryType: tx.categoryType || 'expense',
      categoryId: tx.categoryId || '',
      accountId: tx.accountId || '',
      date: tx.date ? tx.date.split('T')[0] : new Date().toISOString().split('T')[0],
      notes: tx.notes || '',
      tags: tx.tags || '',
      isRecurring: tx.isRecurring || false,
    })
    setTxDialogOpen(true)
  }

  // ── Open Create Dialog ──
  const openCreate = () => {
    setEditingTx(null)
    txForm.reset({
      type: 'expense',
      amount: 0,
      description: '',
      categoryType: 'expense',
      categoryId: '',
      accountId: '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
      tags: '',
      isRecurring: false,
    })
    setTxDialogOpen(true)
  }

  // ── Submit Transaction ──
  const onSubmitTx = async (values: TransactionFormValues) => {
    setSubmitting(true)
    try {
      const txData = {
        type: values.type,
        amount: values.amount,
        description: values.description,
        categoryType: values.type === 'income' ? 'income' : 'expense',
        categoryId: values.categoryId || undefined,
        accountId: values.accountId,
        date: new Date(values.date + 'T12:00:00').toISOString(),
        notes: values.notes || undefined,
        tags: values.tags || undefined,
        isRecurring: values.isRecurring ?? false,
      }

      if (editingTx) {
        await transactionService.update(editingTx.id, txData)
        toast.success('Transacción actualizada')
      } else {
        await transactionService.create(txData)
        toast.success('Transacción creada')
      }
      setTxDialogOpen(false)
      refetchTx()
      refetchAccounts()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Delete Transaction ──
  const onDelete = async () => {
    if (!deletingTxId) return
    try {
      await transactionService.delete(deletingTxId)
      toast.success('Transacción eliminada')
      refetchTx()
      refetchAccounts()
    } catch (err) {
      toast.error('Error al eliminar')
    } finally {
      setDeleteDialogOpen(false)
      setDeletingTxId(null)
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
      refetchTx()
      refetchAccounts()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error en transferencia')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Open Split Dialog ──
  const openSplit = (tx: Transaction) => {
    setSplittingTx(tx)
    splitForm.reset({
      splits: [
        { amount: 0, categoryId: tx.categoryId || '', description: tx.description || '' },
        { amount: 0, categoryId: '', description: '' },
      ],
    })
    setSplitDialogOpen(true)
  }

  // ── Submit Split ──
  const onSubmitSplit = async (values: SplitFormValues) => {
    if (!splittingTx) return
    const totalSplits = values.splits.reduce((sum, s) => sum + s.amount, 0)
    if (totalSplits > splittingTx.amount) {
      toast.error('La suma de las partes excede el monto original')
      return
    }
    setSubmitting(true)
    try {
      // Update the original transaction with split info
      await transactionService.update(splittingTx.id, {
        parentTransactionId: splittingTx.id,
        splitIndex: 0,
        amount: values.splits[0].amount,
        categoryId: values.splits[0].categoryId,
        description: values.splits[0].description,
      })

      // Create child splits
      for (let i = 1; i < values.splits.length; i++) {
        await transactionService.create({
          type: splittingTx.type,
          amount: values.splits[i].amount,
          description: values.splits[i].description,
          categoryType: splittingTx.categoryType,
          categoryId: values.splits[i].categoryId,
          accountId: splittingTx.accountId,
          date: splittingTx.date,
          isRecurring: false,
          parentTransactionId: splittingTx.id,
          splitIndex: i,
        })
      }

      toast.success('Transacción dividida correctamente')
      setSplitDialogOpen(false)
      refetchTx()
      refetchAccounts()
    } catch (err) {
      toast.error('Error al dividir transacción')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Pagination helpers ──
  const totalPages = Math.ceil((txResult?.total ?? 0) / pageSize)

  const amountColor = (tx: Transaction) => {
    if (tx.type === 'income') return 'text-neon-green'
    if (tx.type === 'expense') return 'text-neon-pink'
    return 'text-neon-blue'
  }

  const amountPrefix = (tx: Transaction) => {
    if (tx.type === 'income') return '+'
    if (tx.type === 'expense') return '-'
    return '↔'
  }

  const categories = watchedType === 'income' ? incomeCategories : expenseCategories
  const catMap = categoryMap()
  const accMap = accountMap()

  return (
    <div className="page-enter p-4 md:p-6 space-y-4 overflow-auto">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-neon-blue">Transacciones</h1>
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={openCreate}
            className="bg-neon-blue text-black hover:bg-neon-blue/80 shadow-neon-blue"
          >
            <Plus className="size-4" />
            Nueva Transacción
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
            Nueva Transferencia
          </Button>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <Card className="border-neon-blue/10 bg-card/50 backdrop-blur-sm">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Type Tabs */}
            <Tabs value={typeFilter} onValueChange={setTypeFilter}>
              <TabsList className="bg-muted/50">
                <TabsTrigger value="all">Todos</TabsTrigger>
                <TabsTrigger value="income">Ingreso</TabsTrigger>
                <TabsTrigger value="expense">Gasto</TabsTrigger>
                <TabsTrigger value="transfer">Transferencia</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar transacciones..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="pl-8 border-neon-blue/20 focus-visible:border-neon-blue/50"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {/* Category Filter */}
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[200px] border-neon-blue/20">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {incomeCategories?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    🟢 {c.name}
                  </SelectItem>
                ))}
                {expenseCategories?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    🔴 {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Account Filter */}
            <Select value={accountFilter} onValueChange={setAccountFilter}>
              <SelectTrigger className="w-full sm:w-[200px] border-neon-blue/20">
                <SelectValue placeholder="Cuenta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las cuentas</SelectItem>
                {accounts?.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.icon} {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ── Transaction Table ── */}
      <Card className="border-neon-blue/10 bg-card/50 backdrop-blur-sm">
        <CardContent className="p-0">
          {txLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-8 animate-spin text-neon-blue" />
              <span className="ml-3 text-muted-foreground">Cargando transacciones...</span>
            </div>
          ) : !txResult?.data?.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <AlertTriangle className="size-10 mb-3 text-neon-yellow" />
              <p className="text-lg font-medium">No hay transacciones</p>
              <p className="text-sm">Crea una nueva transacción para comenzar</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="border-neon-blue/10 hover:bg-transparent">
                    <TableHead className="text-neon-blue/70">Fecha</TableHead>
                    <TableHead className="text-neon-blue/70">Descripción</TableHead>
                    <TableHead className="text-neon-blue/70 hidden md:table-cell">Categoría</TableHead>
                    <TableHead className="text-neon-blue/70 hidden sm:table-cell">Cuenta</TableHead>
                    <TableHead className="text-neon-blue/70 text-right">Monto</TableHead>
                    <TableHead className="text-neon-blue/70 text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {txResult.data.map((tx) => (
                    <TableRow
                      key={tx.id}
                      className="border-neon-blue/5 hover:bg-neon-blue/5 transition-colors"
                    >
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(tx.date)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="truncate max-w-[180px]">{tx.description}</span>
                          {tx.parentTransactionId && (
                            <Badge
                              variant="outline"
                              className="text-[10px] border-neon-purple/40 text-neon-purple"
                            >
                              Split
                            </Badge>
                          )}
                          {tx.type === 'transfer' && (
                            <Badge
                              variant="outline"
                              className="text-[10px] border-neon-blue/40 text-neon-blue"
                            >
                              ↕
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {tx.categoryId ? (
                          <Badge
                            variant="outline"
                            className="text-xs border-neon-blue/20"
                          >
                            {catMap[tx.categoryId] || 'Sin categoría'}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                        {tx.accountId ? accMap[tx.accountId] || '—' : '—'}
                      </TableCell>
                      <TableCell className={`text-right font-mono font-semibold ${amountColor(tx)}`}>
                        {amountPrefix(tx)}{formatCurrency(tx.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {tx.type !== 'transfer' && !tx.parentTransactionId && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground hover:text-neon-purple"
                              onClick={() => openSplit(tx)}
                              title="Dividir"
                            >
                              <Split className="size-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-neon-blue"
                            onClick={() => openEdit(tx)}
                            title="Editar"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-neon-pink"
                            onClick={() => {
                              setDeletingTxId(tx.id)
                              setDeleteDialogOpen(true)
                            }}
                            title="Eliminar"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-neon-blue/10">
                <span className="text-xs text-muted-foreground">
                  {txResult.total} transacción{txResult.total !== 1 ? 'es' : ''}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="border-neon-blue/20 size-8"
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground min-w-[80px] text-center">
                    {page} / {totalPages || 1}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="border-neon-blue/20 size-8"
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Create/Edit Transaction Dialog ── */}
      <Dialog open={txDialogOpen} onOpenChange={setTxDialogOpen}>
        <DialogContent className="sm:max-w-lg border-neon-blue/20 bg-card">
          <DialogHeader>
            <DialogTitle className="text-neon-blue">
              {editingTx ? 'Editar Transacción' : 'Nueva Transacción'}
            </DialogTitle>
            <DialogDescription>
              {editingTx
                ? 'Modifica los datos de la transacción'
                : 'Completa los datos para crear una transacción'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={txForm.handleSubmit(onSubmitTx)} className="space-y-4">
            {/* Type */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={txForm.watch('type')}
                  onValueChange={(val) => txForm.setValue('type', val)}
                >
                  <SelectTrigger className="border-neon-blue/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Ingreso</SelectItem>
                    <SelectItem value="expense">Gasto</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <Label>Monto</Label>
                <Input
                  type="number"
                  step="1"
                  min="1"
                  placeholder="0"
                  {...txForm.register('amount')}
                  className="border-neon-blue/20 focus-visible:border-neon-blue/50"
                />
                {txForm.formState.errors.amount && (
                  <p className="text-xs text-destructive">
                    {txForm.formState.errors.amount.message}
                  </p>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input
                placeholder="Descripción de la transacción"
                {...txForm.register('description')}
                className="border-neon-blue/20 focus-visible:border-neon-blue/50"
              />
              {txForm.formState.errors.description && (
                <p className="text-xs text-destructive">
                  {txForm.formState.errors.description.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Category */}
              <div className="space-y-2">
                <Label>Categoría</Label>
                <Select
                  value={txForm.watch('categoryId') || ''}
                  onValueChange={(val) => txForm.setValue('categoryId', val)}
                >
                  <SelectTrigger className="border-neon-blue/20">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.icon} {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Account */}
              <div className="space-y-2">
                <Label>Cuenta</Label>
                <Select
                  value={txForm.watch('accountId') || ''}
                  onValueChange={(val) => txForm.setValue('accountId', val)}
                >
                  <SelectTrigger className="border-neon-blue/20">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts?.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.icon} {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {txForm.formState.errors.accountId && (
                  <p className="text-xs text-destructive">
                    {txForm.formState.errors.accountId.message}
                  </p>
                )}
              </div>
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label>Fecha</Label>
              <Input
                type="date"
                {...txForm.register('date')}
                className="border-neon-blue/20 focus-visible:border-neon-blue/50"
              />
              {txForm.formState.errors.date && (
                <p className="text-xs text-destructive">
                  {txForm.formState.errors.date.message}
                </p>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notas (opcional)</Label>
              <Textarea
                placeholder="Notas adicionales..."
                {...txForm.register('notes')}
                className="border-neon-blue/20 focus-visible:border-neon-blue/50 min-h-[60px]"
              />
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label>Etiquetas (opcional)</Label>
              <Input
                placeholder="Separadas por coma: comida, outside"
                {...txForm.register('tags')}
                className="border-neon-blue/20 focus-visible:border-neon-blue/50"
              />
            </div>

            {/* isRecurring */}
            <div className="flex items-center gap-3">
              <Switch
                checked={txForm.watch('isRecurring') ?? false}
                onCheckedChange={(val) => txForm.setValue('isRecurring', val)}
              />
              <Label>Transacción recurrente</Label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setTxDialogOpen(false)}
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
                {editingTx ? 'Actualizar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Transfer Dialog ── */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent className="sm:max-w-md border-neon-blue/20 bg-card">
          <DialogHeader>
            <DialogTitle className="text-neon-blue">Nueva Transferencia</DialogTitle>
            <DialogDescription>Transfiere fondos entre cuentas</DialogDescription>
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

      {/* ── Split Transaction Dialog ── */}
      <Dialog open={splitDialogOpen} onOpenChange={setSplitDialogOpen}>
        <DialogContent className="sm:max-w-lg border-neon-purple/20 bg-card">
          <DialogHeader>
            <DialogTitle className="text-neon-purple">Dividir Transacción</DialogTitle>
            <DialogDescription>
              Divide &quot;{splittingTx?.description}&quot; ({splittingTx ? formatCurrency(splittingTx.amount) : ''}) en múltiples partes
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={splitForm.handleSubmit(onSubmitSplit)} className="space-y-4">
            {splitForm.watch('splits')?.map((split, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg border border-neon-purple/10 bg-background/50 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-neon-purple">
                    Parte {idx + 1}
                  </span>
                  {idx > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive h-6 px-2"
                      onClick={() => {
                        const current = [...splitForm.getValues('splits')]
                        current.splice(idx, 1)
                        splitForm.setValue('splits', current)
                      }}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Monto</Label>
                    <Input
                      type="number"
                      step="1"
                      min="1"
                      placeholder="0"
                      {...splitForm.register(`splits.${idx}.amount`)}
                      className="border-neon-purple/20 focus-visible:border-neon-purple/50 h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Categoría</Label>
                    <Select
                      value={splitForm.watch(`splits.${idx}.categoryId`) || ''}
                      onValueChange={(val) =>
                        splitForm.setValue(`splits.${idx}.categoryId`, val)
                      }
                    >
                      <SelectTrigger className="border-neon-purple/20 h-8 text-sm">
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {(splittingTx?.type === 'income' ? incomeCategories : expenseCategories)?.map(
                          (c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.icon} {c.name}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Descripción</Label>
                  <Input
                    placeholder="Descripción de esta parte"
                    {...splitForm.register(`splits.${idx}.description`)}
                    className="border-neon-purple/20 focus-visible:border-neon-purple/50 h-8 text-sm"
                  />
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-neon-purple/30 text-neon-purple hover:bg-neon-purple/10"
              onClick={() => {
                const current = [...splitForm.getValues('splits')]
                current.push({ amount: 0, categoryId: '', description: '' })
                splitForm.setValue('splits', current)
              }}
            >
              <Plus className="size-3.5" />
              Agregar parte
            </Button>

            {/* Split total */}
            <div className="flex items-center justify-between px-3 py-2 rounded-md bg-background/50 border border-neon-purple/10">
              <span className="text-sm text-muted-foreground">Total dividido:</span>
              <span className="font-mono font-semibold text-neon-purple">
                {formatCurrency(splitForm.watch('splits')?.reduce((sum, s) => sum + (s.amount || 0), 0) ?? 0)}
                {' / '}
                {splittingTx ? formatCurrency(splittingTx.amount) : '$0'}
              </span>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSplitDialogOpen(false)}
                className="border-neon-purple/20"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-neon-purple text-white hover:bg-neon-purple/80 shadow-neon-blue"
              >
                {submitting && <Loader2 className="size-4 animate-spin" />}
                Dividir
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="border-neon-pink/20 bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-neon-pink">Eliminar Transacción</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar esta transacción? Esta acción no se puede
              deshacer y el saldo de la cuenta se ajustará automáticamente.
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
