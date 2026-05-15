'use client'

import { useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod/v4'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  PiggyBank,
  Plus,
  Pencil,
  Trash2,
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronDown,
  ChevronUp,
  CalendarDays,
  Target,
  Wallet,
  TrendingUp,
  Loader2,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { savingsService, accountService, useAsyncData } from '@/lib/data'
import { formatCurrency, formatDate } from '@/lib/finance-utils'
import type { SavingsGoal, SavingsMovement, Account } from '@/lib/db-client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DatePickerField } from '@/components/ui/date-picker-field'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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

const savingsGoalSchema = z.object({
  name: z.string().min(1, 'Nombre es requerido'),
  targetAmount: z.number().min(1, 'El monto objetivo debe ser mayor a 0'),
  currentAmount: z.number().min(0, 'El monto actual no puede ser negativo'),
  deadline: z.string().optional(),
  icon: z.string().min(1, 'Icono es requerido'),
  color: z.string().min(1, 'Color es requerido'),
})

const movementSchema = z.object({
  amount: z.number().min(1, 'El monto debe ser mayor a 0'),
  description: z.string().optional(),
})

type SavingsGoalForm = z.infer<typeof savingsGoalSchema>
type MovementForm = z.infer<typeof movementSchema>

// ─── Theme Colors ────────────────────────────────────────────────────

const CYAN = '#00fff5'
const CYAN_M = '#05d9e8'

// ─── Component ──────────────────────────────────────────────────────

export function SavingsPage({ currentMonth, currentYear }: { currentMonth?: number; currentYear?: number }) {
  // Data
  const { data: goals, loading, refetch } = useAsyncData<SavingsGoal[]>(() => savingsService.getAll(), [])

  // Dialog states
  const [goalDialogOpen, setGoalDialogOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null)
  const [depositDialogOpen, setDepositDialogOpen] = useState(false)
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false)
  const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [goalToDelete, setGoalToDelete] = useState<SavingsGoal | null>(null)

  // Movement history expansion
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null)
  const [movements, setMovements] = useState<SavingsMovement[]>([])
  const [loadingMovements, setLoadingMovements] = useState(false)

  // Submitting states
  const [submittingGoal, setSubmittingGoal] = useState(false)
  const [submittingMovement, setSubmittingMovement] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Account selection for deposit/withdraw
  const [movementAccountId, setMovementAccountId] = useState<string>('')
  const { data: accounts } = useAsyncData<Account[]>(() => accountService.getAll(), [])

  // ─── Goal Form ───────────────────────────────────────────────────

  const goalForm = useForm<SavingsGoalForm>({
    resolver: zodResolver(savingsGoalSchema),
    defaultValues: {
      name: '',
      targetAmount: 0,
      currentAmount: 0,
      deadline: '',
      icon: '🐷',
      color: '#05d9e8',
    },
  })

  const openCreateGoal = () => {
    setEditingGoal(null)
    goalForm.reset({
      name: '',
      targetAmount: 0,
      currentAmount: 0,
      deadline: '',
      icon: '🐷',
      color: '#05d9e8',
    })
    setGoalDialogOpen(true)
  }

  const openEditGoal = (goal: SavingsGoal) => {
    setEditingGoal(goal)
    goalForm.reset({
      name: goal.name,
      targetAmount: goal.targetAmount,
      currentAmount: goal.currentAmount,
      deadline: goal.deadline || '',
      icon: goal.icon,
      color: goal.color,
    })
    setGoalDialogOpen(true)
  }

  const onSubmitGoal = async (data: SavingsGoalForm) => {
    setSubmittingGoal(true)
    try {
      if (editingGoal) {
        await savingsService.update(editingGoal.id, {
          name: data.name,
          targetAmount: data.targetAmount,
          currentAmount: data.currentAmount,
          deadline: data.deadline || undefined,
          icon: data.icon,
          color: data.color,
        })
        toast.success('Meta de ahorro actualizada')
      } else {
        await savingsService.create({
          name: data.name,
          targetAmount: data.targetAmount,
          currentAmount: data.currentAmount,
          deadline: data.deadline || undefined,
          icon: data.icon,
          color: data.color,
        })
        toast.success('Meta de ahorro creada')
      }
      setGoalDialogOpen(false)
      refetch()
    } catch {
      toast.error('Error al guardar la meta de ahorro')
    } finally {
      setSubmittingGoal(false)
    }
  }

  // ─── Movement Form ───────────────────────────────────────────────

  const movementForm = useForm<MovementForm>({
    resolver: zodResolver(movementSchema),
    defaultValues: {
      amount: 0,
      description: '',
    },
  })

  const openDepositDialog = (goal: SavingsGoal) => {
    setSelectedGoal(goal)
    movementForm.reset({ amount: 0, description: '' })
    setMovementAccountId(accounts?.[0]?.id ?? '')
    setDepositDialogOpen(true)
  }

  const openWithdrawDialog = (goal: SavingsGoal) => {
    setSelectedGoal(goal)
    movementForm.reset({ amount: 0, description: '' })
    setMovementAccountId(accounts?.[0]?.id ?? '')
    setWithdrawDialogOpen(true)
  }

  const onSubmitDeposit = async (data: MovementForm) => {
    if (!selectedGoal || !movementAccountId) return
    const selectedAcct = accounts?.find((a) => a.id === movementAccountId)
    if (selectedAcct && selectedAcct.balance < data.amount) {
      toast.error('Saldo insuficiente en la cuenta seleccionada')
      return
    }
    setSubmittingMovement(true)
    try {
      await savingsService.addMovement(selectedGoal.id, data.amount, 'deposit', movementAccountId, data.description)
      toast.success(`Depósito de ${formatCurrency(data.amount)} realizado`)
      setDepositDialogOpen(false)
      refetch()
      if (expandedGoalId === selectedGoal.id) {
        loadMovements(selectedGoal.id)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al realizar el depósito')
    } finally {
      setSubmittingMovement(false)
    }
  }

  const onSubmitWithdraw = async (data: MovementForm) => {
    if (!selectedGoal || !movementAccountId) return
    setSubmittingMovement(true)
    try {
      await savingsService.addMovement(selectedGoal.id, data.amount, 'withdraw', movementAccountId, data.description)
      toast.success(`Retiro de ${formatCurrency(data.amount)} realizado`)
      setWithdrawDialogOpen(false)
      refetch()
      if (expandedGoalId === selectedGoal.id) {
        loadMovements(selectedGoal.id)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al realizar el retiro')
    } finally {
      setSubmittingMovement(false)
    }
  }

  // ─── Delete Goal ─────────────────────────────────────────────────

  const confirmDeleteGoal = (goal: SavingsGoal) => {
    setGoalToDelete(goal)
    setDeleteDialogOpen(true)
  }

  const onDeleteGoal = async () => {
    if (!goalToDelete) return
    setDeleting(true)
    try {
      await savingsService.delete(goalToDelete.id)
      toast.success('Meta de ahorro eliminada')
      setDeleteDialogOpen(false)
      refetch()
    } catch {
      toast.error('Error al eliminar la meta de ahorro')
    } finally {
      setDeleting(false)
    }
  }

  // ─── Movement History ────────────────────────────────────────────

  const loadMovements = useCallback(async (goalId: string) => {
    setLoadingMovements(true)
    try {
      const { db } = await import('@/lib/db-client')
      const movs = await db.savingsMovements
        .where('savingsGoalId')
        .equals(goalId)
        .reverse()
        .sortBy('createdAt')
      setMovements(movs)
    } catch {
      setMovements([])
    } finally {
      setLoadingMovements(false)
    }
  }, [])

  const toggleMovements = (goalId: string) => {
    if (expandedGoalId === goalId) {
      setExpandedGoalId(null)
    } else {
      setExpandedGoalId(goalId)
      loadMovements(goalId)
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────

  const getProgress = (current: number, target: number) => {
    if (target <= 0) return 0
    return Math.min(100, Math.round((current / target) * 100))
  }

  const getRemaining = (current: number, target: number) => {
    return Math.max(0, target - current)
  }

  // ─── Computed summary ────────────────────────────────────────────

  const totalSaved = goals?.reduce((sum, g) => sum + g.currentAmount, 0) ?? 0
  const totalTarget = goals?.reduce((sum, g) => sum + g.targetAmount, 0) ?? 0
  const overallProgress = totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0

  // ─── Render ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="page-enter p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-neon-cyan">Metas de Ahorro</h1>
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
            <PiggyBank className="size-5 text-neon-cyan" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: CYAN, textShadow: `0 0 20px ${CYAN}44` }}>
              Metas de Ahorro
            </h1>
            <p className="text-sm text-muted-foreground">Gestiona tus metas de ahorro</p>
          </div>
        </div>
        <Button
          onClick={openCreateGoal}
          className="bg-neon-cyan/20 border border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/30 hover:shadow-[0_0_15px_rgba(5,217,232,0.3)] transition-all"
        >
          <Plus className="size-4" />
          Nueva Meta
        </Button>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Ahorrado */}
        <Card className="border-neon-cyan/20 bg-card/50 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-lg bg-neon-cyan/10 border border-neon-cyan/30">
              <Wallet className="size-5 text-neon-cyan" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Ahorrado</p>
              <p className="text-lg font-bold text-neon-cyan font-mono">{formatCurrency(totalSaved)}</p>
            </div>
          </CardContent>
        </Card>
        {/* Meta Total */}
        <Card className="border-neon-green/20 bg-card/50 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-lg bg-neon-green/10 border border-neon-green/30">
              <Target className="size-5 text-neon-green" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Meta Total</p>
              <p className="text-lg font-bold text-neon-green font-mono">{formatCurrency(totalTarget)}</p>
            </div>
          </CardContent>
        </Card>
        {/* Progreso */}
        <Card className="border-neon-yellow/20 bg-card/50 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-lg bg-neon-yellow/10 border border-neon-yellow/30">
              <TrendingUp className="size-5 text-neon-yellow" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Progreso</p>
              <p className="text-lg font-bold text-neon-yellow font-mono">{overallProgress}%</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Empty State ── */}
      {(!goals || goals.length === 0) ? (
        <Card className="border-neon-cyan/10 bg-card/50 backdrop-blur-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <PiggyBank className="size-10 mb-3 text-neon-cyan/30" />
            <p className="text-lg font-medium">No hay metas de ahorro</p>
            <p className="text-sm mb-4">Crea tu primera meta de ahorro para empezar a guardar</p>
            <Button
              onClick={openCreateGoal}
              className="bg-neon-cyan/20 border border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/30"
            >
              <Plus className="size-4" />
              Crear Meta
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
                  <TableHead className="text-neon-cyan/70 text-right">Meta</TableHead>
                  <TableHead className="text-neon-cyan/70 text-right hidden sm:table-cell">Ahorrado</TableHead>
                  <TableHead className="text-neon-cyan/70 text-right hidden md:table-cell">Restante</TableHead>
                  <TableHead className="text-neon-cyan/70 hidden lg:table-cell">Progreso</TableHead>
                  <TableHead className="text-neon-cyan/70 hidden lg:table-cell">Fecha Límite</TableHead>
                  <TableHead className="text-neon-cyan/70 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {goals.map((goal) => {
                  const progress = getProgress(goal.currentAmount, goal.targetAmount)
                  const remaining = getRemaining(goal.currentAmount, goal.targetAmount)
                  const isOver = goal.currentAmount > goal.targetAmount
                  const isExpanded = expandedGoalId === goal.id

                  return (
                    <>
                      <TableRow
                        key={goal.id}
                        className="border-neon-cyan/5 hover:bg-neon-cyan/5 transition-colors"
                      >
                        {/* Nombre */}
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{goal.icon}</span>
                            <span className="font-medium truncate max-w-[150px]">{goal.name}</span>
                          </div>
                        </TableCell>
                        {/* Meta */}
                        <TableCell className="text-right font-mono text-neon-cyan">
                          {formatCurrency(goal.targetAmount)}
                        </TableCell>
                        {/* Ahorrado */}
                        <TableCell className="text-right font-mono text-neon-green hidden sm:table-cell">
                          {formatCurrency(goal.currentAmount)}
                        </TableCell>
                        {/* Restante */}
                        <TableCell className="text-right font-mono hidden md:table-cell" style={{ color: isOver ? '#ff2a6d' : '#f9f002' }}>
                          {isOver ? '+' + formatCurrency(goal.currentAmount - goal.targetAmount) : formatCurrency(remaining)}
                        </TableCell>
                        {/* Progreso */}
                        <TableCell className="hidden lg:table-cell">
                          <div className="flex items-center gap-2 min-w-[120px]">
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${progress}%`,
                                  backgroundColor: goal.color,
                                  boxShadow: `0 0 6px ${goal.color}66`,
                                }}
                              />
                            </div>
                            <span className="text-xs font-mono font-medium w-8 text-right" style={{ color: goal.color }}>
                              {progress}%
                            </span>
                          </div>
                        </TableCell>
                        {/* Fecha Límite */}
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                          {goal.deadline ? formatDate(goal.deadline) : '—'}
                        </TableCell>
                        {/* Acciones */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-neon-green hover:text-neon-green hover:bg-neon-green/10"
                              onClick={() => openDepositDialog(goal)}
                              title="Depositar"
                            >
                              <ArrowDownToLine className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-neon-yellow hover:text-neon-yellow hover:bg-neon-yellow/10"
                              onClick={() => openWithdrawDialog(goal)}
                              title="Retirar"
                            >
                              <ArrowUpFromLine className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground hover:text-neon-blue hover:bg-neon-blue/10"
                              onClick={() => openEditGoal(goal)}
                              title="Editar"
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground hover:text-neon-pink hover:bg-neon-pink/10"
                              onClick={() => confirmDeleteGoal(goal)}
                              title="Eliminar"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground hover:text-neon-cyan hover:bg-neon-cyan/10"
                              onClick={() => toggleMovements(goal.id)}
                              title="Historial"
                            >
                              {isExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Expanded Movement History */}
                      {isExpanded && (
                        <TableRow key={`${goal.id}-movements`} className="border-neon-cyan/5">
                          <TableCell colSpan={7} className="bg-muted/20 p-0">
                            <div className="max-h-48 overflow-y-auto cyber-scrollbar p-3 space-y-1.5">
                              {loadingMovements ? (
                                <p className="text-xs text-muted-foreground text-center py-2">Cargando...</p>
                              ) : movements.length === 0 ? (
                                <p className="text-xs text-muted-foreground text-center py-2">Sin movimientos</p>
                              ) : (
                                movements.map((mov) => (
                                  <div
                                    key={mov.id}
                                    className="flex items-center justify-between text-xs py-1.5 px-2 rounded bg-muted/30"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className={mov.type === 'deposit' ? 'text-neon-cyan' : 'text-neon-pink'}>
                                        {mov.type === 'deposit' ? '↓ Depósito' : '↑ Retiro'}
                                      </span>
                                      {mov.description && (
                                        <span className="text-muted-foreground truncate max-w-[120px]">
                                          {mov.description}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className={mov.type === 'deposit' ? 'text-neon-cyan font-medium' : 'text-neon-pink font-medium'}>
                                        {mov.type === 'deposit' ? '+' : '-'}{formatCurrency(mov.amount)}
                                      </span>
                                      <span className="text-muted-foreground">
                                        {formatDate(mov.createdAt)}
                                      </span>
                                    </div>
                                  </div>
                                ))
                              )}
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

      {/* ─── Create/Edit Goal Dialog ──────────────────────────────── */}
      <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
        <DialogContent className="bg-card border-neon-cyan/20">
          <DialogHeader>
            <DialogTitle className="text-neon-cyan">
              {editingGoal ? 'Editar Meta de Ahorro' : 'Nueva Meta de Ahorro'}
            </DialogTitle>
            <DialogDescription>
              {editingGoal
                ? 'Modifica los datos de tu meta de ahorro'
                : 'Define una nueva meta de ahorro para alcanzar tus objetivos'}
            </DialogDescription>
          </DialogHeader>

          <Form {...goalForm}>
            <form onSubmit={goalForm.handleSubmit(onSubmitGoal)} className="space-y-4">
              <FormField
                control={goalForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ej: Vacaciones de verano"
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
                  control={goalForm.control}
                  name="targetAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monto Objetivo</FormLabel>
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
                  control={goalForm.control}
                  name="currentAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monto Actual</FormLabel>
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
              </div>

              <FormField
                control={goalForm.control}
                name="deadline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha Límite (opcional)</FormLabel>
                    <FormControl>
                      <DatePickerField
                        {...field}
                        accentColor="#05d9e8"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={goalForm.control}
                  name="icon"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Icono (emoji)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="🐷"
                          {...field}
                          className="border-neon-cyan/20 focus:border-neon-cyan/50"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={goalForm.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Color (hex)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="#05d9e8"
                          {...field}
                          className="border-neon-cyan/20 focus:border-neon-cyan/50"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setGoalDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={submittingGoal}
                  className="bg-neon-cyan/20 border border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/30"
                >
                  {submittingGoal ? 'Guardando...' : editingGoal ? 'Actualizar' : 'Crear Meta'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ─── Deposit Dialog ───────────────────────────────────────── */}
      <Dialog open={depositDialogOpen} onOpenChange={setDepositDialogOpen}>
        <DialogContent className="bg-card border-neon-cyan/20">
          <DialogHeader>
            <DialogTitle className="text-neon-cyan">Depositar a {selectedGoal?.name}</DialogTitle>
            <DialogDescription>
              Ingresa el monto que deseas depositar a esta meta
            </DialogDescription>
          </DialogHeader>

          <Form {...movementForm}>
            <form onSubmit={movementForm.handleSubmit(onSubmitDeposit)} className="space-y-4">
              <FormField
                control={movementForm.control}
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
                control={movementForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción (opcional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ej: Depósito mensual"
                        {...field}
                        className="border-neon-cyan/20 focus:border-neon-cyan/50"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Account selection */}
              <div className="space-y-2">
                <Label>Cuenta de Origen</Label>
                <Select
                  value={movementAccountId}
                  onValueChange={setMovementAccountId}
                >
                  <SelectTrigger className="border-neon-cyan/20 focus:border-neon-cyan/50 w-full">
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
                  <p className="text-xs text-muted-foreground">No hay cuentas registradas.</p>
                )}
              </div>

              {/* Saldo insuficiente warning */}
              {(() => {
                const selectedAcct = accounts?.find((a) => a.id === movementAccountId)
                const depAmount = movementForm.watch('amount') || 0
                const insufficient = selectedAcct && selectedAcct.balance < depAmount
                return insufficient ? (
                  <div className="flex items-center gap-2 p-3 rounded-lg border border-neon-pink/30 bg-neon-pink/10">
                    <AlertTriangle className="size-4 text-neon-pink shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-neon-pink">Saldo insuficiente</p>
                      <p className="text-[10px] text-muted-foreground">
                        Disponible: {formatCurrency(selectedAcct?.balance ?? 0)} • Necesitas: {formatCurrency(depAmount)}
                      </p>
                    </div>
                  </div>
                ) : null
              })()}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDepositDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={submittingMovement || !movementAccountId}
                  className="bg-neon-cyan/20 border border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/30 disabled:opacity-50"
                >
                  <ArrowDownToLine className="size-4 mr-2" />
                  {submittingMovement ? 'Depositando...' : 'Depositar'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ─── Withdraw Dialog ──────────────────────────────────────── */}
      <Dialog open={withdrawDialogOpen} onOpenChange={setWithdrawDialogOpen}>
        <DialogContent className="bg-card border-neon-yellow/20">
          <DialogHeader>
            <DialogTitle className="text-neon-yellow">Retirar de {selectedGoal?.name}</DialogTitle>
            <DialogDescription>
              Disponible: {selectedGoal ? formatCurrency(selectedGoal.currentAmount) : '$0'}
            </DialogDescription>
          </DialogHeader>

          <Form {...movementForm}>
            <form onSubmit={movementForm.handleSubmit(onSubmitWithdraw)} className="space-y-4">
              <FormField
                control={movementForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monto</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="0"
                        max={selectedGoal?.currentAmount}
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                        className="border-neon-yellow/20 focus:border-neon-yellow/50"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={movementForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción (opcional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ej: Emergencia"
                        {...field}
                        className="border-neon-yellow/20 focus:border-neon-yellow/50"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Account selection */}
              <div className="space-y-2">
                <Label>Cuenta de Destino</Label>
                <Select
                  value={movementAccountId}
                  onValueChange={setMovementAccountId}
                >
                  <SelectTrigger className="border-neon-yellow/20 focus:border-neon-yellow/50 w-full">
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
                  <p className="text-xs text-muted-foreground">No hay cuentas registradas.</p>
                )}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setWithdrawDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={submittingMovement || !movementAccountId}
                  className="bg-neon-yellow/20 border border-neon-yellow/50 text-neon-yellow hover:bg-neon-yellow/30 disabled:opacity-50"
                >
                  <ArrowUpFromLine className="size-4 mr-2" />
                  {submittingMovement ? 'Retirando...' : 'Retirar'}
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
            <AlertDialogTitle className="text-neon-pink">Eliminar Meta</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de eliminar la meta &quot;{goalToDelete?.name}&quot;? Se eliminarán
              todos los movimientos asociados. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDeleteGoal}
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
