'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Scale,
  PiggyBank,
  CreditCard,
  PieChart as PieChartIcon,
  Receipt,
  Calendar,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Wallet,
  FileText,
  Target,
  Clock,
  ArrowLeftRight,
  RefreshCw,
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPie,
  Pie,
  Cell,
} from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { dashboardService, useAsyncData } from '@/lib/data'
import { formatCurrency, formatDate, MONTHS_ES, CHART_COLORS, ACCOUNT_TYPES } from '@/lib/finance-utils'
import { cn } from '@/lib/utils'

// ─── Neon Color Definitions ─────────────────────────────────────────

const NEON = {
  green: { hex: '#01ff89', rgb: '1,255,137' },
  pink: { hex: '#ff2a6d', rgb: '255,42,109' },
  orange: { hex: '#ff8c00', rgb: '255,140,0' },
  cyan: { hex: '#05d9e8', rgb: '5,217,232' },
  yellow: { hex: '#f9f002', rgb: '249,240,2' },
  purple: { hex: '#d300c5', rgb: '211,0,197' },
}

type NeonKey = keyof typeof NEON

function neonBorder(key: NeonKey): string {
  const map: Record<NeonKey, string> = {
    green: 'border-[#01ff89]/40',
    pink: 'border-[#ff2a6d]/40',
    orange: 'border-[#ff8c00]/40',
    cyan: 'border-[#05d9e8]/40',
    yellow: 'border-[#f9f002]/40',
    purple: 'border-[#d300c5]/40',
  }
  return map[key]
}

function neonShadow(key: NeonKey): string {
  const c = NEON[key]
  return `0 0 8px rgba(${c.rgb},0.12), 0 0 20px rgba(${c.rgb},0.05)`
}

function neonText(key: NeonKey): string {
  const map: Record<NeonKey, string> = {
    green: 'text-neon-green',
    pink: 'text-neon-pink',
    orange: 'text-[#ff8c00]',
    cyan: 'text-neon-cyan',
    yellow: 'text-neon-yellow',
    purple: 'text-[#d300c5]',
  }
  return map[key]
}

function neonHex(key: NeonKey): string {
  return NEON[key].hex
}

function neonRgb(key: NeonKey): string {
  return NEON[key].rgb
}

// ─── Format helpers ─────────────────────────────────────────────────

function formatK(amount: number): string {
  const abs = Math.abs(amount)
  if (abs >= 1_000_000) return `${amount < 0 ? '-' : ''}$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${amount < 0 ? '-' : ''}$${(abs / 1_000).toFixed(1)}K`
  return formatCurrency(amount)
}

function pctChange(current: number, previous: number): { value: string; isPositive: boolean } {
  if (previous === 0) return { value: '0.0%', isPositive: current >= 0 }
  const change = ((current - previous) / Math.abs(previous)) * 100
  return { value: `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`, isPositive: change >= 0 }
}

// ─── Reusable Section Card ──────────────────────────────────────────

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
              <Icon className={`size-4 ${neonText(neonKey)}`} />
              <span className={neonText(neonKey)} style={{ textShadow: `0 0 6px rgba(${neonRgb(neonKey)},0.3)` }}>
                {title}
              </span>
            </div>
            {actionLabel && onAction && (
              <button
                onClick={onAction}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {actionLabel}
                <ArrowRight className="size-3" />
              </button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </motion.div>
  )
}

// ─── Custom Tooltip ─────────────────────────────────────────────────

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

// ─── Budget Progress Bar ────────────────────────────────────────────

function BudgetBar({ name, icon, spent, budget, percentage }: { name: string; icon: string; spent: number; budget: number; percentage: number }) {
  const pct = Math.min(percentage, 100)
  let barColor: string
  let barRgb: string
  if (percentage > 100) {
    barColor = NEON.pink.hex; barRgb = NEON.pink.rgb
  } else if (percentage >= 75) {
    barColor = NEON.yellow.hex; barRgb = NEON.yellow.rgb
  } else {
    barColor = NEON.green.hex; barRgb = NEON.green.rgb
  }
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <span className="text-sm font-medium text-foreground">{name}</span>
          {percentage > 100 && (
            <span className="text-[10px] font-semibold text-neon-pink px-1.5 py-0.5 rounded bg-neon-pink/10">
              +{Math.round(percentage - 100)}%
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatK(spent)} / {formatK(budget)}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted/50 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            backgroundColor: barColor,
            boxShadow: `0 0 8px rgba(${barRgb},0.4)`,
          }}
        />
      </div>
    </div>
  )
}

// ─── Due Item ───────────────────────────────────────────────────────

function DueItem({ item }: { item: { id: string; name: string; dueDate: string; amount: number; daysRemaining: number; type: string; icon: string; color: string } }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
      <div className="flex items-center gap-3">
        <div
          className="flex items-center justify-center size-8 rounded-full text-sm shrink-0"
          style={{
            backgroundColor: `rgba(${hexToRgb(item.color)},0.15)`,
            boxShadow: `0 0 6px rgba(${hexToRgb(item.color)},0.2)`,
          }}
        >
          {item.icon || (item.type === 'service' ? '📄' : '🔄')}
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{item.name}</p>
          <p className="text-[11px] text-muted-foreground">{formatDate(item.dueDate)}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold text-foreground tabular-nums">{formatCurrency(item.amount)}</p>
        <p className={`text-[11px] font-medium ${item.daysRemaining <= 3 ? 'text-neon-pink' : 'text-neon-green'}`}>
          {item.daysRemaining <= 0 ? 'Vencida' : `En ${item.daysRemaining} día${item.daysRemaining !== 1 ? 's' : ''}`}
        </p>
      </div>
    </div>
  )
}

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  if (h.length === 3) {
    return `${parseInt(h[0] + h[0], 16)},${parseInt(h[1] + h[1], 16)},${parseInt(h[2] + h[2], 16)}`
  }
  return `${parseInt(h.substring(0, 2), 16)},${parseInt(h.substring(2, 4), 16)},${parseInt(h.substring(4, 6), 16)}`
}

// ─── Skeleton ───────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="space-y-1">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="bg-card/80">
            <CardHeader className="pb-2"><Skeleton className="h-3 w-20" /></CardHeader>
            <CardContent className="pt-0"><Skeleton className="h-6 w-24" /></CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-card/80"><CardHeader><Skeleton className="h-5 w-40" /></CardHeader><CardContent><Skeleton className="h-48 w-full" /></CardContent></Card>
        <Card className="bg-card/80"><CardHeader><Skeleton className="h-5 w-40" /></CardHeader><CardContent><Skeleton className="h-48 w-full" /></CardContent></Card>
      </div>
      <Card className="bg-card/80"><CardHeader><Skeleton className="h-5 w-48" /></CardHeader><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card>
    </div>
  )
}

// ─── Main Dashboard Page ────────────────────────────────────────────

interface DashboardPageProps {
  currentMonth?: number
  currentYear?: number
  onMonthChange?: (month: number, year: number) => void
  onNavigate?: (page: string) => void
}

export function DashboardPage({ currentMonth, currentYear, onMonthChange, onNavigate }: DashboardPageProps) {
  const now = new Date()
  const month = currentMonth ?? now.getMonth() + 1
  const year = currentYear ?? now.getFullYear()

  const { data, loading, error } = useAsyncData(
    () => dashboardService.getData(month, year),
    [month, year]
  )

  // ── Chart data ──
  const dailyChartData = useMemo(() => {
    if (!data) return []
    return data.dailyData.map(d => ({ name: d.day, Ingresos: d.income, Gastos: d.expenses }))
  }, [data])

  const trendChartData = useMemo(() => {
    if (!data) return []
    return data.monthlyTrend.map(t => ({
      name: `${MONTHS_ES[t.month - 1].substring(0, 3)}`,
      Ingresos: t.income,
      Gastos: t.expenses,
      Balance: t.income - t.expenses,
    }))
  }, [data])

  const pieData = useMemo(() => {
    if (!data) return []
    return data.expenseByCategory.map((c, i) => ({
      name: c.categoryName,
      value: c.amount,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }))
  }, [data])

  // ── Budget details ──
  const budgetDetails = useMemo(() => {
    if (!data) return []
    return data.budgetSummary.sort((a, b) => b.percentage - a.percentage)
  }, [data])

  const budgetTotals = useMemo(() => {
    if (!data) return { budgeted: 0, spent: 0, remaining: 0 }
    const budgeted = data.budgetSummary.reduce((s, b) => s + b.budgetAmount, 0)
    const spent = data.budgetSummary.reduce((s, b) => s + b.spent, 0)
    return { budgeted, spent, remaining: budgeted - spent }
  }, [data])

  // ── Balance Projection ──
  const balanceProjection = useMemo(() => {
    if (!data) return { avg3: 0, projected: 0, trend: 'neutral' as const }
    const trend = data.monthlyTrend
    if (trend.length < 2) return { avg3: data.balance, projected: data.balance, trend: 'neutral' as const }
    const last3 = trend.slice(-3)
    const avg3 = last3.reduce((s, t) => s + (t.income - t.expenses), 0) / last3.length
    const trendDir = avg3 >= 0 ? 'positive' : 'negative'
    return { avg3, projected: data.balance, trend: trendDir }
  }, [data])

  // ── Month comparison ──
  const monthComparison = useMemo(() => {
    if (!data) return { income: { value: '0.0%', isPositive: true }, expenses: { value: '0.0%', isPositive: false }, balance: { value: '0.0%', isPositive: true } }
    return {
      income: pctChange(data.totalIncome, data.previousMonthIncome),
      expenses: pctChange(data.totalExpenses, data.previousMonthExpenses),
      balance: pctChange(data.balance, data.previousMonthBalance),
    }
  }, [data])

  if (loading) return <DashboardSkeleton />
  if (error) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[50vh]">
        <Card className="bg-card/80 border-[#ff2a6d]/30 max-w-md w-full">
          <CardHeader><CardTitle className="text-neon-pink text-sm">Error al cargar datos</CardTitle></CardHeader>
          <CardContent><p className="text-muted-foreground text-sm">{error.message}</p></CardContent>
        </Card>
      </div>
    )
  }
  if (!data) return null

  // ── Month navigation helpers ──
  const handlePrevMonth = () => {
    const m = month === 1 ? 12 : month - 1
    const y = month === 1 ? year - 1 : year
    onMonthChange?.(m, y)
  }
  const handleNextMonth = () => {
    const m = month === 12 ? 1 : month + 1
    const y = month === 12 ? year + 1 : year
    onMonthChange?.(m, y)
  }

  // ── Combined income/expense for stat cards ──
  // totalExpenses already includes: paid service bills, paid recurring, and paid debt installments (via transactionService.create())
  // We add only pending obligations that haven't been paid yet
  const totalIncomeCombined = data.totalIncome
  const totalExpensesCombined = data.totalExpenses + data.serviceSummary.pendingAmount + data.recurringSummary.pendingThisMonth

  return (
    <div className="p-4 md:p-6 space-y-5 overflow-y-auto cyber-scrollbar">

      {/* ── 1. Header with Month Navigation ── */}
      <motion.div
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col gap-3"
      >
        <div className="flex items-center justify-between">
          <h1
            className="text-2xl font-bold text-neon-cyan"
            style={{ textShadow: '0 0 12px rgba(5,217,232,0.5), 0 0 24px rgba(5,217,232,0.2)' }}
          >
            Dashboard
          </h1>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-neon-cyan hover:bg-neon-cyan/10"
            onClick={handlePrevMonth}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm font-bold text-neon-cyan tabular-nums min-w-[140px] text-center">
            {MONTHS_ES[month - 1]} {year}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-neon-cyan hover:bg-neon-cyan/10"
            onClick={handleNextMonth}
          >
            <ChevronRight className="size-4" />
          </Button>
          {month === now.getMonth() + 1 && year === now.getFullYear() && (
            <span className="text-[10px] font-medium text-neon-cyan px-2 py-0.5 rounded-full bg-neon-cyan/10 border border-neon-cyan/30">
              Hoy
            </span>
          )}
        </div>

        {/* Month grid */}
        <div className="grid grid-cols-6 sm:grid-cols-12 gap-1">
          {MONTHS_ES.map((name, i) => {
            const m = i + 1
            const isActive = m === month
            return (
              <button
                key={m}
                onClick={() => onMonthChange?.(m, year)}
                className={cn(
                  'rounded px-1 py-1 text-[10px] font-medium transition-all',
                  isActive
                    ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40 shadow-neon-blue'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground border border-transparent'
                )}
              >
                {name.substring(0, 3)}
              </button>
            )
          })}
        </div>
      </motion.div>

      {/* ── 2. Stat Cards Grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {/* Ingresos */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className={`bg-card/80 backdrop-blur-sm border ${neonBorder('green')} hover:scale-[1.02] transition-transform`} style={{ boxShadow: neonShadow('green') }}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">Ingresos</CardTitle>
              <div className="rounded-md p-1.5" style={{ backgroundColor: 'rgba(1,255,137,0.1)', boxShadow: '0 0 6px rgba(1,255,137,0.3)' }}>
                <TrendingUp className="size-3.5 text-neon-green" />
              </div>
            </CardHeader>
            <CardContent className="pt-0 pb-2">
              <p className="text-xl font-bold text-neon-green tabular-nums" style={{ textShadow: '0 0 8px rgba(1,255,137,0.4)' }}>
                {formatCurrency(totalIncomeCombined)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Ingresos del mes</p>
            </CardContent>
            <div className="px-5 pb-2">
              <button onClick={() => onNavigate?.('transactions')} className="flex items-center gap-1 text-[10px] text-neon-green/70 hover:text-neon-green transition-colors">
                Ver todo <ArrowRight className="size-2.5" />
              </button>
            </div>
          </Card>
        </motion.div>

        {/* Gastos */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className={`bg-card/80 backdrop-blur-sm border ${neonBorder('pink')} hover:scale-[1.02] transition-transform`} style={{ boxShadow: neonShadow('pink') }}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">Gastos</CardTitle>
              <div className="rounded-md p-1.5" style={{ backgroundColor: 'rgba(255,42,109,0.1)', boxShadow: '0 0 6px rgba(255,42,109,0.3)' }}>
                <TrendingDown className="size-3.5 text-neon-pink" />
              </div>
            </CardHeader>
            <CardContent className="pt-0 pb-2">
              <p className="text-xl font-bold text-neon-pink tabular-nums" style={{ textShadow: '0 0 8px rgba(255,42,109,0.4)' }}>
                {formatCurrency(totalExpensesCombined)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Pagados + Servicios pendientes + Recurrentes pendientes</p>
            </CardContent>
            <div className="px-5 pb-2">
              <button onClick={() => onNavigate?.('transactions')} className="flex items-center gap-1 text-[10px] text-neon-pink/70 hover:text-neon-pink transition-colors">
                Ver todo <ArrowRight className="size-2.5" />
              </button>
            </div>
          </Card>
        </motion.div>

        {/* Balance */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className={`bg-card/80 backdrop-blur-sm border ${neonBorder('cyan')} hover:scale-[1.02] transition-transform`} style={{ boxShadow: neonShadow('cyan') }}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">Balance</CardTitle>
              <div className="rounded-md p-1.5" style={{ backgroundColor: 'rgba(5,217,232,0.1)', boxShadow: '0 0 6px rgba(5,217,232,0.3)' }}>
                <Scale className="size-3.5 text-neon-cyan" />
              </div>
            </CardHeader>
            <CardContent className="pt-0 pb-2">
              <p className="text-xl font-bold text-neon-cyan tabular-nums" style={{ textShadow: '0 0 8px rgba(5,217,232,0.4)' }}>
                {formatCurrency(data.balance)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Ingresos - Gastos totales</p>
            </CardContent>
            <div className="px-5 pb-2">
              <button onClick={() => onNavigate?.('accounts')} className="flex items-center gap-1 text-[10px] text-neon-cyan/70 hover:text-neon-cyan transition-colors">
                Ver todo <ArrowRight className="size-2.5" />
              </button>
            </div>
          </Card>
        </motion.div>

        {/* Servicios */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className={`bg-card/80 backdrop-blur-sm border ${neonBorder('orange')} hover:scale-[1.02] transition-transform`} style={{ boxShadow: neonShadow('orange') }}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">Servicios</CardTitle>
              <div className="rounded-md p-1.5" style={{ backgroundColor: 'rgba(255,140,0,0.1)', boxShadow: '0 0 6px rgba(255,140,0,0.3)' }}>
                <Receipt className="size-3.5 text-[#ff8c00]" />
              </div>
            </CardHeader>
            <CardContent className="pt-0 pb-2">
              <p className="text-xl font-bold text-[#ff8c00] tabular-nums" style={{ textShadow: '0 0 8px rgba(255,140,0,0.4)' }}>
                {formatCurrency(data.serviceSummary.totalPaid)}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="inline-flex items-center gap-1 text-[10px]">
                  <span className="inline-block size-2 rounded-full bg-neon-green" />
                  {data.serviceSummary.paidCount} pagada{data.serviceSummary.paidCount !== 1 ? 's' : ''}
                </span>
                <span className="text-[10px] text-muted-foreground">-</span>
                <span className="inline-flex items-center gap-1 text-[10px]">
                  <span className="inline-block size-2 rounded-full bg-neon-pink" />
                  {formatCurrency(data.serviceSummary.pendingAmount)} pendiente
                </span>
              </div>
            </CardContent>
            <div className="px-5 pb-2">
              <button onClick={() => onNavigate?.('services')} className="flex items-center gap-1 text-[10px] text-[#ff8c00]/70 hover:text-[#ff8c00] transition-colors">
                Ver todo <ArrowRight className="size-2.5" />
              </button>
            </div>
          </Card>
        </motion.div>

        {/* Deudas */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className={`bg-card/80 backdrop-blur-sm border ${neonBorder('pink')} hover:scale-[1.02] transition-transform`} style={{ boxShadow: neonShadow('pink') }}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">Deudas</CardTitle>
              <div className="rounded-md p-1.5" style={{ backgroundColor: 'rgba(255,42,109,0.1)', boxShadow: '0 0 6px rgba(255,42,109,0.3)' }}>
                <CreditCard className="size-3.5 text-neon-pink" />
              </div>
            </CardHeader>
            <CardContent className="pt-0 pb-2">
              <p className="text-xl font-bold text-neon-pink tabular-nums" style={{ textShadow: '0 0 8px rgba(255,42,109,0.4)' }}>
                {formatCurrency(data.debtSummary.totalDebt)}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-muted-foreground">{data.debtSummary.activeCount} activa{data.debtSummary.activeCount !== 1 ? 's' : ''}</span>
                <span className="text-[10px] text-muted-foreground">-</span>
                <span className="text-[10px] text-muted-foreground">Cuenta: {formatCurrency(data.debtSummary.remainingAmount)}</span>
              </div>
            </CardContent>
            <div className="px-5 pb-2">
              <button onClick={() => onNavigate?.('debts')} className="flex items-center gap-1 text-[10px] text-neon-pink/70 hover:text-neon-pink transition-colors">
                Ver todo <ArrowRight className="size-2.5" />
              </button>
            </div>
          </Card>
        </motion.div>

        {/* Ahorro */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className={`bg-card/80 backdrop-blur-sm border ${neonBorder('purple')} hover:scale-[1.02] transition-transform`} style={{ boxShadow: neonShadow('purple') }}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">Ahorro</CardTitle>
              <div className="rounded-md p-1.5" style={{ backgroundColor: 'rgba(211,0,197,0.1)', boxShadow: '0 0 6px rgba(211,0,197,0.3)' }}>
                <PiggyBank className="size-3.5 text-[#d300c5]" />
              </div>
            </CardHeader>
            <CardContent className="pt-0 pb-2">
              <p className="text-xl font-bold text-[#d300c5] tabular-nums" style={{ textShadow: '0 0 8px rgba(211,0,197,0.4)' }}>
                {formatCurrency(data.savingsSummary.totalCurrent)}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-muted-foreground">Meta: {formatCurrency(data.savingsSummary.totalTarget)}</span>
                <span className="text-[10px] text-muted-foreground">-</span>
                <span className="text-[10px] text-muted-foreground">Tasa: {data.savingsSummary.rate.toFixed(1)}%</span>
              </div>
            </CardContent>
            <div className="px-5 pb-2">
              <button onClick={() => onNavigate?.('savings')} className="flex items-center gap-1 text-[10px] text-[#d300c5]/70 hover:text-[#d300c5] transition-colors">
                Ver todo <ArrowRight className="size-2.5" />
              </button>
            </div>
          </Card>
        </motion.div>

        {/* Recurrentes */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <Card className={`bg-card/80 backdrop-blur-sm border ${neonBorder('cyan')} hover:scale-[1.02] transition-transform`} style={{ boxShadow: neonShadow('cyan') }}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">Recurrentes</CardTitle>
              <div className="rounded-md p-1.5" style={{ backgroundColor: 'rgba(5,217,232,0.1)', boxShadow: '0 0 6px rgba(5,217,232,0.3)' }}>
                <RefreshCw className="size-3.5 text-neon-cyan" />
              </div>
            </CardHeader>
            <CardContent className="pt-0 pb-2">
              <p className="text-xl font-bold text-neon-cyan tabular-nums" style={{ textShadow: '0 0 8px rgba(5,217,232,0.4)' }}>
                {formatCurrency(data.recurringSummary.pendingThisMonth)}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-muted-foreground">{data.recurringSummary.activeCount} activo{data.recurringSummary.activeCount !== 1 ? 's' : ''}</span>
                <span className="text-[10px] text-muted-foreground">-</span>
                <span className="text-[10px] text-muted-foreground">{data.recurringSummary.pendingCount} pendiente{data.recurringSummary.pendingCount !== 1 ? 's' : ''} este mes</span>
              </div>
            </CardContent>
            <div className="px-5 pb-2">
              <button onClick={() => onNavigate?.('recurring')} className="flex items-center gap-1 text-[10px] text-neon-cyan/70 hover:text-neon-cyan transition-colors">
                Ver todo <ArrowRight className="size-2.5" />
              </button>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* ── 3. Service Expenses + Debt Summary (Side by Side) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SectionCard title="Gastos de Servicios" icon={FileText} neonKey="orange" delay={0.35} actionLabel="Ver todo" onAction={() => onNavigate?.('services')}>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Facturas del Mes</span>
              <span className="text-sm font-bold text-[#ff8c00] tabular-nums">{formatCurrency(data.serviceSummary.totalPaid + data.serviceSummary.pendingAmount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-block size-3 rounded-full bg-neon-green" />
                <span className="text-sm text-muted-foreground">Pagadas</span>
              </div>
              <span className="text-sm font-semibold text-neon-green tabular-nums">{data.serviceSummary.paidCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-block size-3 rounded-full bg-neon-pink" />
                <span className="text-sm text-muted-foreground">Pendientes</span>
              </div>
              <span className="text-sm font-semibold text-neon-pink tabular-nums">{data.serviceSummary.pendingCount}</span>
            </div>
            {data.serviceSummary.totalBills === 0 && (
              <p className="text-center text-sm text-muted-foreground py-4">Sin servicios registrados</p>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Resumen de Deudas" icon={FileText} neonKey="pink" delay={0.4} actionLabel="Ver todo" onAction={() => onNavigate?.('debts')}>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Deuda Total</span>
              <span className="text-sm font-bold text-neon-pink tabular-nums">{formatCurrency(data.debtSummary.totalDebt)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Restante</span>
              <span className="text-sm font-bold text-[#ff8c00] tabular-nums">{formatCurrency(data.debtSummary.remainingAmount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Pagado</span>
              <span className="text-sm font-bold text-neon-green tabular-nums">{formatCurrency(data.debtSummary.paidAmount)}</span>
            </div>
            {data.debtSummary.activeCount === 0 && (
              <p className="text-center text-sm text-muted-foreground py-4">Sin deudas activas</p>
            )}
          </div>
        </SectionCard>
      </div>

      {/* ── 4. Monthly Comparison ── */}
      <SectionCard title="Comparación Mensual" icon={BarChart3} neonKey="cyan" delay={0.45}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Ingresos vs mes anterior</p>
            <p className="text-lg font-bold text-neon-green tabular-nums" style={{ textShadow: '0 0 6px rgba(1,255,137,0.3)' }}>
              {formatCurrency(data.totalIncome)}
            </p>
            <span className={`text-xs font-medium ${monthComparison.income.isPositive ? 'text-neon-green' : 'text-neon-pink'}`}>
              {monthComparison.income.value}
            </span>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Gastos vs mes anterior</p>
            <p className="text-lg font-bold text-neon-pink tabular-nums" style={{ textShadow: '0 0 6px rgba(255,42,109,0.3)' }}>
              {formatCurrency(data.totalExpenses)}
            </p>
            <span className={`text-xs font-medium ${!monthComparison.expenses.isPositive ? 'text-neon-green' : 'text-neon-pink'}`}>
              {monthComparison.expenses.value}
            </span>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Balance vs mes anterior</p>
            <p className="text-lg font-bold text-neon-cyan tabular-nums" style={{ textShadow: '0 0 6px rgba(5,217,232,0.3)' }}>
              {formatCurrency(data.balance)}
            </p>
            <span className={`text-xs font-medium ${monthComparison.balance.isPositive ? 'text-neon-green' : 'text-neon-pink'}`}>
              {monthComparison.balance.value}
            </span>
          </div>
        </div>
      </SectionCard>

      {/* ── 5. Charts Row (3 columns) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Ingresos vs Gastos Diarios */}
        <SectionCard title="Ingresos vs Gastos Diarios" icon={TrendingUp} neonKey="green" delay={0.5}>
          {dailyChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={dailyChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" tick={{ fill: '#7c8ba1', fontSize: 10 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} />
                <YAxis tick={{ fill: '#7c8ba1', fontSize: 10 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} tickFormatter={(v: number) => formatK(v)} />
                <Tooltip content={<NeonTooltip />} />
                <Line type="monotone" dataKey="Ingresos" stroke="#01ff89" strokeWidth={2} dot={false} activeDot={{ r: 3, stroke: '#01ff89', strokeWidth: 2, fill: '#0a0a1a' }} />
                <Line type="monotone" dataKey="Gastos" stroke="#ff2a6d" strokeWidth={2} dot={false} activeDot={{ r: 3, stroke: '#ff2a6d', strokeWidth: 2, fill: '#0a0a1a' }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">Sin datos</div>
          )}
        </SectionCard>

        {/* Gastos por Categoría */}
        <SectionCard title="Gastos por Categoría" icon={PieChartIcon} neonKey="pink" delay={0.55}>
          {pieData.length > 0 ? (
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={180}>
                <RechartsPie>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ backgroundColor: 'rgba(17,17,40,0.95)', border: '1px solid rgba(5,217,232,0.2)', borderRadius: '8px', fontSize: '12px' }}
                    itemStyle={{ color: '#e0e6f0' }}
                    labelStyle={{ color: '#7c8ba1' }}
                  />
                </RechartsPie>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 justify-center">
                {pieData.map((entry, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="inline-block size-2 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-[10px] text-muted-foreground">{entry.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">Sin gastos este mes</div>
          )}
        </SectionCard>

        {/* Tendencia 6 Meses */}
        <SectionCard title="Tendencia 6 Meses" icon={BarChart3} neonKey="cyan" delay={0.6}>
          {trendChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trendChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" tick={{ fill: '#7c8ba1', fontSize: 10 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} />
                <YAxis tick={{ fill: '#7c8ba1', fontSize: 10 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} tickFormatter={(v: number) => formatK(v)} />
                <Tooltip content={<NeonTooltip />} />
                <Line type="monotone" dataKey="Ingresos" stroke="#01ff89" strokeWidth={2} dot={{ r: 3, fill: '#01ff89', stroke: '#0a0a1a', strokeWidth: 2 }} />
                <Line type="monotone" dataKey="Gastos" stroke="#ff2a6d" strokeWidth={2} dot={{ r: 3, fill: '#ff2a6d', stroke: '#0a0a1a', strokeWidth: 2 }} />
                <Line type="monotone" dataKey="Balance" stroke="#05d9e8" strokeWidth={2} dot={{ r: 3, fill: '#05d9e8', stroke: '#0a0a1a', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">Sin datos suficientes</div>
          )}
        </SectionCard>
      </div>

      {/* ── 6. Cuentas Bancarias ── */}
      <SectionCard title="Cuentas Bancarias" icon={Wallet} neonKey="cyan" delay={0.65} actionLabel="Ver todo" onAction={() => onNavigate?.('accounts')}>
        {data.accountSummaries.length > 0 ? (
          <div className="space-y-3">
            {data.accountSummaries.map((acct) => (
              <div key={acct.id} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                <div className="flex items-center gap-3">
                  <div
                    className="flex items-center justify-center size-10 rounded-full text-lg shrink-0"
                    style={{
                      backgroundColor: `rgba(${hexToRgb(acct.color)},0.15)`,
                      boxShadow: `0 0 6px rgba(${hexToRgb(acct.color)},0.2)`,
                    }}
                  >
                    {acct.icon}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{acct.name}</p>
                    <p className="text-[11px] text-muted-foreground">{ACCOUNT_TYPES[acct.type] ?? acct.type}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold tabular-nums" style={{ color: acct.color }}>{formatCurrency(acct.balance)}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[10px] text-neon-green">+{formatCurrency(acct.income)}</span>
                    <span className="text-[10px] text-neon-pink">-{formatCurrency(acct.expenses)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground py-4">Sin cuentas registradas</p>
        )}
      </SectionCard>

      {/* ── 7. Bottom Sections (2x2 grid) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Presupuesto */}
        <SectionCard title="Resumen de Presupuesto" icon={Target} neonKey="yellow" delay={0.7}>
          {budgetDetails.length > 0 ? (
            <div className="space-y-3">
              {budgetDetails.map((b) => {
                const cat = data.expenseByCategory.find(c => c.categoryId === b.categoryId)
                return (
                  <BudgetBar
                    key={b.categoryId}
                    name={b.categoryName}
                    icon={cat?.categoryIcon ?? '📦'}
                    spent={b.spent}
                    budget={b.budgetAmount}
                    percentage={b.percentage}
                  />
                )
              })}
              <div className="mt-3 p-2.5 rounded-lg border border-[#f9f002]/30 bg-[#f9f002]/5" style={{ boxShadow: '0 0 8px rgba(249,240,2,0.1)' }}>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Presupuesto</p>
                    <p className="text-xs font-bold text-neon-cyan tabular-nums">{formatCurrency(budgetTotals.budgeted)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Gastado</p>
                    <p className="text-xs font-bold text-neon-pink tabular-nums">{formatCurrency(budgetTotals.spent)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Restante</p>
                    <p className="text-xs font-bold text-neon-green tabular-nums">{formatCurrency(budgetTotals.remaining)}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-8">Sin presupuestos configurados para este mes</p>
          )}
        </SectionCard>

        {/* Proyección de Balance */}
        <SectionCard title="Proyección de Balance" icon={BarChart3} neonKey="cyan" delay={0.75}>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Promedio 3 meses</p>
              <p className="text-lg font-bold text-neon-cyan tabular-nums" style={{ textShadow: '0 0 6px rgba(5,217,232,0.3)' }}>
                {formatCurrency(balanceProjection.avg3)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Balance proyectado</p>
              <p
                className={`text-lg font-bold tabular-nums ${balanceProjection.projected >= 0 ? 'text-neon-green' : 'text-neon-pink'}`}
                style={{ textShadow: `0 0 6px rgba(${balanceProjection.projected >= 0 ? NEON.green.rgb : NEON.pink.rgb},0.3)` }}
              >
                {formatCurrency(balanceProjection.projected)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Tendencia</p>
              <div className="flex items-center gap-2">
                {balanceProjection.trend === 'positive' ? (
                  <>
                    <ArrowUpRight className="size-5 text-neon-green" />
                    <span className="text-lg font-bold text-neon-green">Positiva</span>
                  </>
                ) : (
                  <>
                    <ArrowDownRight className="size-5 text-neon-pink" />
                    <span className="text-lg font-bold text-neon-pink">Negativa</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Próximos Vencimientos */}
        <SectionCard title="Próximos Vencimientos" icon={Calendar} neonKey="orange" delay={0.8}>
          {data.upcomingDue.length > 0 ? (
            <div className="max-h-72 overflow-y-auto cyber-scrollbar">
              {data.upcomingDue.map((item) => (
                <DueItem key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-8">No hay vencimientos próximos</p>
          )}
        </SectionCard>

        {/* Transacciones Recientes */}
        <SectionCard title="Transacciones Recientes" icon={Clock} neonKey="cyan" delay={0.85} actionLabel="Ver todo" onAction={() => onNavigate?.('transactions')}>
          {data.recentTransactions.length > 0 ? (
            <div className="space-y-0 max-h-72 overflow-y-auto cyber-scrollbar">
              {data.recentTransactions.slice(0, 8).map((t) => (
                <div key={t.id} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center size-8 rounded-full text-sm shrink-0 bg-muted/50">
                      <ArrowLeftRight className="size-3.5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground truncate max-w-[180px]">{t.description}</p>
                      <p className="text-[11px] text-muted-foreground">{formatDate(t.date)}</p>
                    </div>
                  </div>
                  <p className={`text-sm font-semibold tabular-nums ${t.type === 'income' ? 'text-neon-green' : 'text-neon-pink'}`}>
                    {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-8">No hay transacciones este mes</p>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
