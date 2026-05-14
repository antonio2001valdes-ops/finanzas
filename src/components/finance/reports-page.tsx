'use client'

import { useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Download,
  Upload,
  FileText,
  FileDown,
  AlertTriangle,
  Plus,
  Pencil,
  Trash2,
  Loader2,
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { dashboardService, backupService, useAsyncData } from '@/lib/data'
import { db } from '@/lib/db-client'
import { formatCurrency, MONTHS_ES, CHART_COLORS, ACCOUNT_TYPES } from '@/lib/finance-utils'
import { generateMonthlySummaryPDF } from '@/lib/pdf-summary'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

// ─── Neon Colors ───────────────────────────────────────────────────

const NEON = {
  green: { hex: '#01ff89', rgb: '1,255,137' },
  pink: { hex: '#ff2a6d', rgb: '255,42,109' },
  cyan: { hex: '#05d9e8', rgb: '5,217,232' },
  yellow: { hex: '#f9f002', rgb: '249,240,2' },
  purple: { hex: '#d300c5', rgb: '211,0,197' },
  orange: { hex: '#ff8c00', rgb: '255,140,0' },
}

type NeonKey = keyof typeof NEON

function neonBorder(key: NeonKey): string {
  const map: Record<NeonKey, string> = {
    green: 'border-[#01ff89]/40',
    pink: 'border-[#ff2a6d]/40',
    cyan: 'border-[#05d9e8]/40',
    yellow: 'border-[#f9f002]/40',
    purple: 'border-[#d300c5]/40',
    orange: 'border-[#ff8c00]/40',
  }
  return map[key]
}

function neonShadow(key: NeonKey): string {
  const c = NEON[key]
  return `0 0 8px rgba(${c.rgb},0.12), 0 0 20px rgba(${c.rgb},0.05)`
}

// ─── Custom Tooltip ────────────────────────────────────────────────

function NeonTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload) return null
  return (
    <div className="rounded-lg border border-border bg-card/95 backdrop-blur-sm px-3 py-2 shadow-lg">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-xs font-medium" style={{ color: entry.color }}>
          {entry.name}: {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  )
}

// ─── Section Card ──────────────────────────────────────────────────

function SectionCard({
  title,
  icon: Icon,
  neonKey,
  children,
  delay = 0,
  actionLabel,
  onAction,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  neonKey: NeonKey
  children: React.ReactNode
  delay?: number
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
    >
      <Card
        className={`relative overflow-hidden bg-card/80 backdrop-blur-sm border ${neonBorder(neonKey)}`}
        style={{ boxShadow: neonShadow(neonKey) }}
      >
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-sm font-semibold">
            <div className="flex items-center gap-2">
              <Icon className={`size-4 ${neonKey === 'green' ? 'text-neon-green' : neonKey === 'pink' ? 'text-neon-pink' : neonKey === 'cyan' ? 'text-neon-cyan' : neonKey === 'yellow' ? 'text-neon-yellow' : neonKey === 'purple' ? 'text-[#d300c5]' : 'text-[#ff8c00]'}`} />
              <span className={neonKey === 'green' ? 'text-neon-green' : neonKey === 'pink' ? 'text-neon-pink' : neonKey === 'cyan' ? 'text-neon-cyan' : neonKey === 'yellow' ? 'text-neon-yellow' : neonKey === 'purple' ? 'text-[#d300c5]' : 'text-[#ff8c00]'} style={{ textShadow: `0 0 6px rgba(${NEON[neonKey].rgb},0.3)` }}>
                {title}
              </span>
            </div>
            {actionLabel && onAction && (
              <button onClick={onAction} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                {actionLabel}
              </button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </motion.div>
  )
}

// ─── Monthly Data Interface ────────────────────────────────────────

interface MonthlyData {
  month: number
  year: number
  income: number
  expenses: number
  balance: number
  savings: number
}

// ─── Categorization Rule Schema ────────────────────────────────────

const ruleSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  descriptionPattern: z.string().min(1, 'El patrón es requerido'),
  categoryId: z.string().min(1, 'La categoría es requerida'),
})

type RuleFormValues = z.infer<typeof ruleSchema>

// ─── Skeleton ──────────────────────────────────────────────────────

function ReportsSkeleton() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="bg-card/80"><CardHeader><Skeleton className="h-5 w-40" /></CardHeader><CardContent><Skeleton className="h-64 w-full" /></CardContent></Card>
        ))}
      </div>
    </div>
  )
}

// ─── Reports Page ──────────────────────────────────────────────────

interface ReportsPageProps {
  currentMonth?: number
  currentYear?: number
  onMonthChange?: (month: number, year: number) => void
  onNavigate?: (page: string) => void
}

export function ReportsPage({ currentMonth, currentYear, onMonthChange, onNavigate }: ReportsPageProps) {
  const now = new Date()
  const selectedYear = currentYear ?? now.getFullYear()
  const selectedMonth = currentMonth ?? now.getMonth() + 1

  // ── Fetch dashboard data for selected month ──
  const { data: dashData, loading: dashLoading } = useAsyncData(
    () => dashboardService.getData(selectedMonth, selectedYear),
    [selectedMonth, selectedYear]
  )

  // ── Fetch yearly monthly data ──
  const fetchYearlyData = useCallback(async () => {
    const allTransactions = await db.transactions.toArray()
    const savingsGoals = await db.savingsGoals.toArray()
    const months: MonthlyData[] = []
    let cumulative = 0

    for (let m = 1; m <= 12; m++) {
      const startDate = new Date(selectedYear, m - 1, 1).toISOString()
      const endDate = new Date(selectedYear, m, 0, 23, 59, 59, 999).toISOString()

      const monthTx = allTransactions.filter((t) => t.date >= startDate && t.date <= endDate)
      const income = monthTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
      const expenses = monthTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
      const balance = income - expenses
      cumulative += balance

      // Calculate savings movements for the month
      const savings = savingsGoals.reduce((s, g) => s + g.currentAmount, 0) // simplified

      months.push({ month: m, year: selectedYear, income, expenses, balance, savings: m <= selectedMonth ? savings : 0 })
    }
    return months
  }, [selectedYear, selectedMonth])

  const { data: yearlyData, loading: yearlyLoading } = useAsyncData(fetchYearlyData, [selectedYear, selectedMonth])

  // ── Categorization rules ──
  const { data: rules, refetch: refetchRules } = useAsyncData(async () => {
    return db.categorizationRules.toArray()
  }, [])

  const { data: expenseCategories } = useAsyncData(async () => {
    const cats = await db.expenseCategories.toArray()
    return cats
  }, [])

  const loading = dashLoading || yearlyLoading

  // ── Chart data ──
  const monthlyChartData = useMemo(() => {
    if (!yearlyData) return []
    return yearlyData.map((m) => ({
      name: MONTHS_ES[m.month - 1].substring(0, 3),
      Ingresos: m.income,
      Gastos: m.expenses,
    }))
  }, [yearlyData])

  const balanceChartData = useMemo(() => {
    if (!yearlyData) return []
    let cumulative = 0
    return yearlyData.map((m) => {
      cumulative += m.balance
      return {
        name: MONTHS_ES[m.month - 1].substring(0, 3),
        Balance: cumulative,
      }
    })
  }, [yearlyData])

  // ── Year totals for summary cards ──
  const yearTotals = useMemo(() => {
    if (!yearlyData) return { income: 0, expenses: 0, balance: 0 }
    const income = yearlyData.reduce((s, m) => s + m.income, 0)
    const expenses = yearlyData.reduce((s, m) => s + m.expenses, 0)
    return { income, expenses, balance: income - expenses }
  }, [yearlyData])

  // ── Month/Year Navigation ──
  const handlePrevYear = () => onMonthChange?.(selectedMonth, selectedYear - 1)
  const handleNextYear = () => onMonthChange?.(selectedMonth, selectedYear + 1)

  // ── Export Functions ──
  const handleExportCSV = async (type: 'transactions' | 'all') => {
    try {
      let csvContent = ''
      if (type === 'transactions' || type === 'all') {
        const transactions = await db.transactions.toArray()
        const categories = await db.expenseCategories.toArray()
        csvContent = 'Fecha,Descripción,Tipo,Monto,Categoría,Cuenta\n'
        csvContent += transactions.map(t => {
          const cat = categories.find(c => c.id === t.categoryId)
          return `${t.date},"${t.description}",${t.type},${t.amount},"${cat?.name ?? ''}","${t.accountId ?? ''}"`
        }).join('\n')
      }
      if (type === 'all') {
        csvContent += '\n\n--- Cuentas ---\n'
        const accounts = await db.accounts.toArray()
        csvContent += 'Nombre,Tipo,Balance,Moneda\n'
        csvContent += accounts.map(a => `"${a.name}",${a.type},${a.balance},${a.currency}`).join('\n')
      }
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `khorven-${type === 'transactions' ? 'transacciones' : 'todo'}-${selectedYear}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('CSV exportado exitosamente')
    } catch {
      toast.error('Error al exportar CSV')
    }
  }

  const [pdfLoading, setPdfLoading] = useState(false)

  const handleExportPDF = async () => {
    setPdfLoading(true)
    toast.info('Generando PDF del resumen mensual...')
    try {
      await generateMonthlySummaryPDF(selectedMonth, selectedYear)
      toast.success('PDF generado exitosamente')
    } catch (err) {
      console.error(err)
      toast.error('Error al generar PDF')
    } finally {
      setPdfLoading(false)
    }
  }

  const handleBackupJSON = async () => {
    try {
      const json = await backupService.export()
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `khorven-backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Backup creado exitosamente')
    } catch {
      toast.error('Error al crear backup')
    }
  }

  const handleRestoreBackup = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        await backupService.import(text)
        toast.success('Backup restaurado exitosamente')
        window.location.reload()
      } catch {
        toast.error('Error al restaurar backup')
      }
    }
    input.click()
  }

  const handleResetDB = async () => {
    try {
      await db.delete()
      window.location.reload()
    } catch {
      toast.error('Error al resetear la base de datos')
    }
  }

  // ── Categorization Rule Dialog ──
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<{ id: string; name: string; descriptionPattern: string; categoryId: string } | null>(null)
  const [deleteRuleDialogOpen, setDeleteRuleDialogOpen] = useState(false)
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null)

  const ruleForm = useForm<RuleFormValues>({
    resolver: zodResolver(ruleSchema),
    defaultValues: { name: '', descriptionPattern: '', categoryId: '' },
  })

  const openCreateRule = () => {
    setEditingRule(null)
    ruleForm.reset({ name: '', descriptionPattern: '', categoryId: '' })
    setRuleDialogOpen(true)
  }

  const openEditRule = (rule: { id: string; name: string; descriptionPattern: string; categoryId: string }) => {
    setEditingRule(rule)
    ruleForm.reset({ name: rule.name, descriptionPattern: rule.descriptionPattern, categoryId: rule.categoryId })
    setRuleDialogOpen(true)
  }

  const onSubmitRule = async (values: RuleFormValues) => {
    try {
      if (editingRule) {
        await db.categorizationRules.update(editingRule.id, {
          name: values.name,
          descriptionPattern: values.descriptionPattern,
          categoryId: values.categoryId,
        })
        toast.success('Regla actualizada')
      } else {
        await db.categorizationRules.add({
          id: crypto.randomUUID(),
          name: values.name,
          descriptionPattern: values.descriptionPattern,
          categoryType: 'expense',
          categoryId: values.categoryId,
          priority: 0,
          isActive: true,
          createdAt: new Date().toISOString(),
        })
        toast.success('Regla creada')
      }
      setRuleDialogOpen(false)
      refetchRules()
    } catch {
      toast.error('Error al guardar la regla')
    }
  }

  const onDeleteRule = async () => {
    if (!deletingRuleId) return
    try {
      await db.categorizationRules.delete(deletingRuleId)
      toast.success('Regla eliminada')
      refetchRules()
    } catch {
      toast.error('Error al eliminar la regla')
    } finally {
      setDeleteRuleDialogOpen(false)
      setDeletingRuleId(null)
    }
  }

  // ── Cumulative balance for table ──
  const tableDataWithCumulative = useMemo(() => {
    if (!yearlyData) return []
    let cumulative = 0
    return yearlyData.map(m => {
      cumulative += m.balance
      return { ...m, cumulative }
    })
  }, [yearlyData])

  if (loading) return <ReportsSkeleton />

  return (
    <div className="p-4 md:p-6 space-y-5 overflow-y-auto cyber-scrollbar">
      {/* ── Header with Year Selector ── */}
      <motion.div
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      >
        <div>
          <h1
            className="text-2xl font-bold text-neon-cyan"
            style={{ textShadow: '0 0 12px rgba(5,217,232,0.5)' }}
          >
            Reportes
          </h1>
          <p className="text-sm text-muted-foreground">Análisis detallado de tus finanzas</p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Año</Label>
          <div className="flex items-center gap-1 rounded-lg border border-neon-cyan/20 bg-card/60 backdrop-blur-sm px-2 py-1">
            <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-neon-cyan" onClick={handlePrevYear}>
              <ChevronLeft className="size-3" />
            </Button>
            <span className="text-sm font-bold text-neon-cyan tabular-nums min-w-[50px] text-center">{selectedYear}</span>
            <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-neon-cyan" onClick={handleNextYear}>
              <ChevronRight className="size-3" />
            </Button>
          </div>
        </div>
      </motion.div>

      {/* ── Summary Cards (3 cols) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className={`bg-card/80 backdrop-blur-sm border ${neonBorder('green')}`} style={{ boxShadow: neonShadow('green') }}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">Ingresos Totales</CardTitle>
              <div className="rounded-md p-1.5" style={{ backgroundColor: 'rgba(1,255,137,0.1)' }}>
                <TrendingUp className="size-3.5 text-neon-green" />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-2xl font-bold text-neon-green tabular-nums" style={{ textShadow: '0 0 8px rgba(1,255,137,0.4)' }}>
                {formatCurrency(yearTotals.income)}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className={`bg-card/80 backdrop-blur-sm border ${neonBorder('pink')}`} style={{ boxShadow: neonShadow('pink') }}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">Gastos Totales</CardTitle>
              <div className="rounded-md p-1.5" style={{ backgroundColor: 'rgba(255,42,109,0.1)' }}>
                <TrendingDown className="size-3.5 text-neon-pink" />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-2xl font-bold text-neon-pink tabular-nums" style={{ textShadow: '0 0 8px rgba(255,42,109,0.4)' }}>
                {formatCurrency(yearTotals.expenses)}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className={`bg-card/80 backdrop-blur-sm border ${neonBorder('cyan')}`} style={{ boxShadow: neonShadow('cyan') }}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">Balance Neto</CardTitle>
              <div className="rounded-md p-1.5" style={{ backgroundColor: 'rgba(5,217,232,0.1)' }}>
                <DollarSign className="size-3.5 text-neon-cyan" />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className={`text-2xl font-bold tabular-nums ${yearTotals.balance >= 0 ? 'text-neon-cyan' : 'text-neon-pink'}`} style={{ textShadow: `0 0 8px rgba(${yearTotals.balance >= 0 ? '5,217,232' : '255,42,109'},0.4)` }}>
                {formatCurrency(yearTotals.balance)}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ── Charts Row (2 cols) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Ingresos vs Gastos Mensuales */}
        <SectionCard title="Ingresos vs Gastos Mensuales" icon={TrendingUp} neonKey="green" delay={0.2}>
          {monthlyChartData.some(d => d.Ingresos > 0 || d.Gastos > 0) ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={monthlyChartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" tick={{ fill: '#7c8ba1', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} />
                <YAxis tick={{ fill: '#7c8ba1', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<NeonTooltip />} />
                <Line type="monotone" dataKey="Ingresos" stroke="#01ff89" strokeWidth={2} dot={{ r: 3, fill: '#01ff89', stroke: '#0a0a1a', strokeWidth: 2 }} />
                <Line type="monotone" dataKey="Gastos" stroke="#ff2a6d" strokeWidth={2} dot={{ r: 3, fill: '#ff2a6d', stroke: '#0a0a1a', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[260px] text-muted-foreground text-sm">Sin datos disponibles</div>
          )}
          {/* Legend */}
          <div className="flex items-center justify-center gap-4 mt-2">
            <div className="flex items-center gap-1.5">
              <span className="inline-block size-3 rounded-full bg-neon-green" />
              <span className="text-[11px] text-muted-foreground">Ingresos</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block size-3 rounded-full bg-neon-pink" />
              <span className="text-[11px] text-muted-foreground">Gastos</span>
            </div>
          </div>
        </SectionCard>

        {/* Balance Acumulado */}
        <SectionCard title="Balance Acumulado" icon={DollarSign} neonKey="cyan" delay={0.25}>
          {balanceChartData.some(d => d.Balance !== 0) ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={balanceChartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" tick={{ fill: '#7c8ba1', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} />
                <YAxis tick={{ fill: '#7c8ba1', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<NeonTooltip />} />
                <Line type="monotone" dataKey="Balance" stroke="#05d9e8" strokeWidth={2} dot={{ r: 3, fill: '#05d9e8', stroke: '#0a0a1a', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[260px] text-muted-foreground text-sm">Sin datos disponibles</div>
          )}
        </SectionCard>
      </div>

      {/* ── Resumen Mensual Table ── */}
      <SectionCard title="Resumen Mensual" icon={BarChart3} neonKey="cyan" delay={0.3}>
        {tableDataWithCumulative.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-neon-cyan/10 hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Mes</TableHead>
                  <TableHead className="text-muted-foreground text-right">Ingreso</TableHead>
                  <TableHead className="text-muted-foreground text-right">Gasto</TableHead>
                  <TableHead className="text-muted-foreground text-right">Balance</TableHead>
                  <TableHead className="text-muted-foreground text-right hidden sm:table-cell">Ahorros</TableHead>
                  <TableHead className="text-muted-foreground text-right hidden sm:table-cell">Acumulado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableDataWithCumulative.map((m) => (
                  <TableRow key={m.month} className="border-neon-cyan/5 hover:bg-neon-cyan/5 transition-colors">
                    <TableCell className="font-medium">{MONTHS_ES[m.month - 1]}</TableCell>
                    <TableCell className="text-right font-mono text-neon-green tabular-nums">{formatCurrency(m.income)}</TableCell>
                    <TableCell className="text-right font-mono text-neon-pink tabular-nums">{formatCurrency(m.expenses)}</TableCell>
                    <TableCell className={`text-right font-mono font-semibold tabular-nums ${m.balance >= 0 ? 'text-neon-green' : 'text-neon-pink'}`}>{formatCurrency(m.balance)}</TableCell>
                    <TableCell className="text-right font-mono text-neon-cyan tabular-nums hidden sm:table-cell">{formatCurrency(m.savings)}</TableCell>
                    <TableCell className={`text-right font-mono font-semibold tabular-nums hidden sm:table-cell ${m.cumulative >= 0 ? 'text-neon-cyan' : 'text-neon-pink'}`}>{formatCurrency(m.cumulative)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground py-8">Sin datos para este año</p>
        )}
      </SectionCard>

      {/* ── Exportar Datos ── */}
      <SectionCard title="Exportar Datos" icon={FileDown} neonKey="yellow" delay={0.35}>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => handleExportCSV('transactions')}
            className="border-[#f9f002]/30 text-[#f9f002] hover:bg-[#f9f002]/10"
          >
            <Download className="size-4 mr-2" />
            Exportar Transacciones CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => handleExportCSV('all')}
            className="border-[#f9f002]/30 text-[#f9f002] hover:bg-[#f9f002]/10"
          >
            <Download className="size-4 mr-2" />
            Exportar Todo CSV
          </Button>
          <Button
            variant="outline"
            onClick={handleExportPDF}
            disabled={pdfLoading}
            className="border-[#f9f002]/30 text-[#f9f002] hover:bg-[#f9f002]/10"
          >
            {pdfLoading ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : (
              <FileText className="size-4 mr-2" />
            )}
            {pdfLoading ? 'Generando...' : 'Resumen Mensual PDF'}
          </Button>
        </div>
      </SectionCard>

      {/* ── Backup / Restaurar ── */}
      <SectionCard title="Backup / Restaurar" icon={Upload} neonKey="green" delay={0.4}>
        <div className="space-y-3">
          <div
            className="flex items-start gap-2 p-3 rounded-md border border-[#ff8c00]/30 bg-[#ff8c00]/5"
          >
            <AlertTriangle className="size-4 text-[#ff8c00] shrink-0 mt-0.5" />
            <p className="text-xs text-[#ff8c00]">
              Restaurar un backup sobrescribirá todos los datos existentes. Asegúrate de crear un backup antes de restaurar.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              onClick={handleBackupJSON}
              className="border-[#01ff89]/30 text-[#01ff89] hover:bg-[#01ff89]/10"
            >
              <Download className="size-4 mr-2" />
              Crear Backup JSON
            </Button>
            <Button
              variant="outline"
              onClick={handleRestoreBackup}
              className="border-[#01ff89]/30 text-[#01ff89] hover:bg-[#01ff89]/10"
            >
              <Upload className="size-4 mr-2" />
              Restaurar Backup
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetDB}
              className="text-muted-foreground hover:text-neon-pink ml-auto"
            >
              Reset DB
            </Button>
          </div>
        </div>
      </SectionCard>

      {/* ── Reglas de Categorización ── */}
      <SectionCard title="Reglas de Categorización" icon={BarChart3} neonKey="purple" delay={0.45} actionLabel="+ Nueva Regla" onAction={openCreateRule}>
        {rules && rules.length > 0 ? (
          <div className="space-y-2">
            {rules.map((rule) => {
              const cat = expenseCategories?.find(c => c.id === rule.categoryId)
              return (
                <div key={rule.id} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-foreground">{rule.name}</span>
                    <span className="text-xs text-muted-foreground">/</span>
                    <span className="text-sm font-mono text-[#d300c5]">"{rule.descriptionPattern}"</span>
                    <span className="text-xs text-muted-foreground">→</span>
                    <span className="text-sm">{cat?.icon ?? '📦'} {cat?.name ?? 'Sin categoría'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-neon-blue" onClick={() => openEditRule({ id: rule.id, name: rule.name, descriptionPattern: rule.descriptionPattern, categoryId: rule.categoryId ?? '' })}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-neon-pink" onClick={() => { setDeletingRuleId(rule.id); setDeleteRuleDialogOpen(true) }}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground py-6">
            No hay reglas de categorización. Crea una para auto-categorizar transacciones.
          </p>
        )}
      </SectionCard>

      {/* ── Categorization Rule Dialog ── */}
      <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
        <DialogContent className="sm:max-w-md border-[#d300c5]/20 bg-card">
          <DialogHeader>
            <DialogTitle className="text-[#d300c5]">
              {editingRule ? 'Editar Regla' : 'Nueva Regla de Categorización'}
            </DialogTitle>
            <DialogDescription>
              Las transacciones que contengan la palabra clave se categorizarán automáticamente.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={ruleForm.handleSubmit(onSubmitRule)} className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre de la Regla</Label>
              <Input
                placeholder="Ej: Suscripción Spotify"
                {...ruleForm.register('name')}
                className="border-[#d300c5]/20 focus-visible:border-[#d300c5]/50"
              />
              {ruleForm.formState.errors.name && (
                <p className="text-xs text-destructive">{ruleForm.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Patrón de Descripción</Label>
              <Input
                placeholder="Ej: spotify, netflix, sueldo..."
                {...ruleForm.register('descriptionPattern')}
                className="border-[#d300c5]/20 focus-visible:border-[#d300c5]/50"
              />
              {ruleForm.formState.errors.descriptionPattern && (
                <p className="text-xs text-destructive">{ruleForm.formState.errors.descriptionPattern.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select value={ruleForm.watch('categoryId') || ''} onValueChange={(val) => ruleForm.setValue('categoryId', val)}>
                <SelectTrigger className="border-[#d300c5]/20">
                  <SelectValue placeholder="Selecciona una categoría" />
                </SelectTrigger>
                <SelectContent>
                  {expenseCategories?.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <span className="flex items-center gap-2">
                        <span>{cat.icon}</span>
                        <span>{cat.name}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {ruleForm.formState.errors.categoryId && (
                <p className="text-xs text-destructive">{ruleForm.formState.errors.categoryId.message}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRuleDialogOpen(false)} className="border-[#d300c5]/20">
                Cancelar
              </Button>
              <Button type="submit" className="bg-[#d300c5]/20 text-[#d300c5] border border-[#d300c5]/30 hover:bg-[#d300c5]/30">
                {editingRule ? 'Guardar' : 'Crear Regla'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Rule Confirmation ── */}
      <AlertDialog open={deleteRuleDialogOpen} onOpenChange={setDeleteRuleDialogOpen}>
        <AlertDialogContent className="border-neon-pink/20 bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-neon-pink">¿Eliminar regla?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta regla de categorización se eliminará permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-neon-cyan/20">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onDeleteRule} className="bg-destructive text-white hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
