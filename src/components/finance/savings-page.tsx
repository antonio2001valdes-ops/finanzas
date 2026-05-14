'use client'

import { useState, useEffect, useCallback } from 'react'
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
} from 'lucide-react'
import { toast } from 'sonner'
import { savingsService, categoryService, useAsyncData } from '@/lib/data'
import { formatCurrency, formatDate } from '@/lib/finance-utils'
import type { SavingsGoal, SavingsMovement, ExpenseCategory } from '@/lib/db-client'
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
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form'

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
    setDepositDialogOpen(true)
  }

  const openWithdrawDialog = (goal: SavingsGoal) => {
    setSelectedGoal(goal)
    movementForm.reset({ amount: 0, description: '' })
    setWithdrawDialogOpen(true)
  }

  const onSubmitDeposit = async (data: MovementForm) => {
    if (!selectedGoal) return
    setSubmittingMovement(true)
    try {
      await savingsService.addMovement(selectedGoal.id, data.amount, 'deposit', data.description)
      toast.success(`Depósito de ${formatCurrency(data.amount)} realizado`)
      setDepositDialogOpen(false)
      refetch()
      if (expandedGoalId === selectedGoal.id) {
        loadMovements(selectedGoal.id)
      }
    } catch {
      toast.error('Error al realizar el depósito')
    } finally {
      setSubmittingMovement(false)
    }
  }

  const onSubmitWithdraw = async (data: MovementForm) => {
    if (!selectedGoal) return
    if (data.amount > selectedGoal.currentAmount) {
      toast.error('No puedes retirar más de lo disponible')
      return
    }
    setSubmittingMovement(true)
    try {
      await savingsService.addMovement(selectedGoal.id, data.amount, 'withdraw', data.description)
      toast.success(`Retiro de ${formatCurrency(data.amount)} realizado`)
      setWithdrawDialogOpen(false)
      refetch()
      if (expandedGoalId === selectedGoal.id) {
        loadMovements(selectedGoal.id)
      }
    } catch {
      toast.error('Error al realizar el retiro')
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

  // ─── Render ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="page-enter p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-neon-cyan">Metas de Ahorro</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border-neon-cyan/20 animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-1/2 mb-4" />
                <div className="h-3 bg-muted rounded w-3/4 mb-2" />
                <div className="h-2 bg-muted rounded w-full mb-4" />
                <div className="h-8 bg-muted rounded w-1/3" />
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
          <PiggyBank className="size-7 text-neon-cyan" />
          <h1 className="text-2xl font-bold text-neon-cyan">Metas de Ahorro</h1>
        </div>
        <Button
          onClick={openCreateGoal}
          className="bg-neon-cyan/20 border border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/30 hover:shadow-neon-blue transition-all"
        >
          <Plus className="size-4 mr-2" />
          Nueva Meta
        </Button>
      </div>

      {/* Empty State */}
      {!goals || goals.length === 0 ? (
        <Card className="border-neon-cyan/20">
          <CardContent className="p-12 text-center">
            <PiggyBank className="size-16 text-neon-cyan/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">
              No hay metas de ahorro
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Crea tu primera meta de ahorro para empezar a guardar
            </p>
            <Button
              onClick={openCreateGoal}
              className="bg-neon-cyan/20 border border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/30"
            >
              <Plus className="size-4 mr-2" />
              Crear Meta
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Goals Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {goals.map((goal) => {
            const progress = getProgress(goal.currentAmount, goal.targetAmount)
            const remaining = getRemaining(goal.currentAmount, goal.targetAmount)
            const isExpanded = expandedGoalId === goal.id

            return (
              <Card
                key={goal.id}
                className="border-neon-cyan/20 hover:border-neon-cyan/40 hover:shadow-neon-blue transition-all"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{goal.icon}</span>
                      <CardTitle className="text-base text-foreground">{goal.name}</CardTitle>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditGoal(goal)}
                        className="size-8 p-0 text-muted-foreground hover:text-neon-cyan"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => confirmDeleteGoal(goal)}
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
                    <span className="text-neon-cyan font-medium">
                      {formatCurrency(goal.currentAmount)}
                    </span>
                    <span className="text-muted-foreground">
                      de {formatCurrency(goal.targetAmount)}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="relative">
                    <Progress
                      value={progress}
                      className="h-3 bg-muted"
                    />
                    <div
                      className="absolute top-0 left-0 h-3 rounded-full transition-all"
                      style={{
                        width: `${progress}%`,
                        background: `linear-gradient(90deg, ${goal.color}, ${goal.color}cc)`,
                        boxShadow: `0 0 8px ${goal.color}66`,
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <Badge
                      variant="outline"
                      className="border-neon-cyan/40 text-neon-cyan"
                    >
                      {progress}%
                    </Badge>
                    <span className="text-muted-foreground">
                      Falta: {formatCurrency(remaining)}
                    </span>
                  </div>

                  {/* Deadline */}
                  {goal.deadline && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarDays className="size-3" />
                      <span>Fecha límite: {formatDate(goal.deadline)}</span>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => openDepositDialog(goal)}
                      className="flex-1 bg-neon-cyan/15 border border-neon-cyan/40 text-neon-cyan hover:bg-neon-cyan/25 text-xs"
                    >
                      <ArrowDownToLine className="size-3 mr-1" />
                      Depositar
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => openWithdrawDialog(goal)}
                      className="flex-1 bg-neon-purple/15 border border-neon-purple/40 text-neon-purple hover:bg-neon-purple/25 text-xs"
                    >
                      <ArrowUpFromLine className="size-3 mr-1" />
                      Retirar
                    </Button>
                  </div>

                  {/* Movement history toggle */}
                  <button
                    onClick={() => toggleMovements(goal.id)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-neon-cyan transition-colors w-full pt-1"
                  >
                    {isExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                    <span>Historial de movimientos</span>
                  </button>

                  {/* Movement history */}
                  {isExpanded && (
                    <div className="max-h-48 overflow-y-auto cyber-scrollbar space-y-1.5 pt-1">
                      {loadingMovements ? (
                        <p className="text-xs text-muted-foreground text-center py-2">Cargando...</p>
                      ) : movements.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-2">
                          Sin movimientos
                        </p>
                      ) : (
                        movements.map((mov) => (
                          <div
                            key={mov.id}
                            className="flex items-center justify-between text-xs py-1.5 px-2 rounded bg-muted/30"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={
                                  mov.type === 'deposit'
                                    ? 'text-neon-cyan'
                                    : 'text-neon-pink'
                                }
                              >
                                {mov.type === 'deposit' ? '↓ Depósito' : '↑ Retiro'}
                              </span>
                              {mov.description && (
                                <span className="text-muted-foreground truncate max-w-[80px]">
                                  {mov.description}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={
                                  mov.type === 'deposit'
                                    ? 'text-neon-cyan font-medium'
                                    : 'text-neon-pink font-medium'
                                }
                              >
                                {mov.type === 'deposit' ? '+' : '-'}
                                {formatCurrency(mov.amount)}
                              </span>
                              <span className="text-muted-foreground">
                                {formatDate(mov.createdAt)}
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
                      <Input
                        type="date"
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
                  disabled={submittingMovement}
                  className="bg-neon-cyan/20 border border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/30"
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
        <DialogContent className="bg-card border-neon-purple/20">
          <DialogHeader>
            <DialogTitle className="text-neon-purple">Retirar de {selectedGoal?.name}</DialogTitle>
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
                        className="border-neon-purple/20 focus:border-neon-purple/50"
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
                  onClick={() => setWithdrawDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={submittingMovement}
                  className="bg-neon-purple/20 border border-neon-purple/50 text-neon-purple hover:bg-neon-purple/30"
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
