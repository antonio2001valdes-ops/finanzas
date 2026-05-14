'use client'

import { useMemo, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Scale,
  PiggyBank,
  CreditCard,
  PieChart,
  Receipt,
  Calendar,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'
import {
  AreaChart,
  Area,
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
import { dashboardService, useAsyncData } from '@/lib/data'
import { formatCurrency, formatDate, MONTHS_ES, CHART_COLORS } from '@/lib/finance-utils'
import { db } from '@/lib/db-client'

// ─── Neon Color Definitions ─────────────────────────────────────────

const NEON_COLORS = {
  green: { hex: '#01ff89', rgb: '1,255,137' },
  pink: { hex: '#ff2a6d', rgb: '255,42,109' },
  orange: { hex: '#ff8c00', rgb: '255,140,0' },
  cyan: { hex: '#05d9e8', rgb: '5,217,232' },
  yellow: { hex: '#f9f002', rgb: '249,240,2' },
  blue: { hex: '#05d9e8', rgb: '5,217,232' },
  purple: { hex: '#d300c5', rgb: '211,0,197' },
}

type NeonColorKey = keyof typeof NEON_COLORS

function neonBorderClass(key: NeonColorKey): string {
  const map: Record<NeonColorKey, string> = {
    green: 'border-[#01ff89]/30',
    pink: 'border-[#ff2a6d]/30',
    orange: 'border-[#ff8c00]/30',
    cyan: 'border-neon-cyan/30',
    yellow: 'border-[#f9f002]/30',
    blue: 'border-neon-blue/30',
    purple: 'border-[#d300c5]/30',
  }
  return map[key]
}

function neonShadow(key: NeonColorKey): string {
  const c = NEON_COLORS[key]
  return `0 0 8px rgba(${c.rgb},0.15), 0 0 16px rgba(${c.rgb},0.06)`
}

function neonTextClass(key: NeonColorKey): string {
  const map: Record<NeonColorKey, string> = {
    green: 'text-neon-green',
    pink: 'text-neon-pink',
    orange: 'text-[#ff8c00]',
    cyan: 'text-neon-cyan',
    yellow: 'text-neon-yellow',
    blue: 'text-neon-blue',
    purple: 'text-[#d300c5]',
  }
  return map[key]
}

// ─── Compact Currency Format ($X.XK) ────────────────────────────────

function formatCurrencyK(amount: number): string {
  const abs = Math.abs(amount)
  if (abs >= 1_000_000) {
    const val = abs / 1_000_000
    return `${amount < 0 ? '-' : ''}$${val.toFixed(1)}M`
  }
  if (abs >= 1_000) {
    const val = abs / 1_000
    return `${amount < 0 ? '-' : ''}$${val.toFixed(1)}K`
  }
  return formatCurrency(amount)
}

// ─── Extended Dashboard Data ────────────────────────────────────────

interface ServiceSummary {
  totalPaid: number
  paidCount: number
  pendingAmount: number
}

interface DebtSummary {
  activeCount: number
  monthlyPayment: number
}

interface SavingsSummary {
  totalTarget: number
  rate: number
}

interface UpcomingDueItem {
  id: string
  name: string
  dueDate: string
  amount: number
  daysRemaining: number
  type: 'service' | 'recurring'
  color: string
  icon: string
}

interface BudgetCategoryDetail {
  categoryId: string
  categoryName: string
  categoryIcon: string
  categoryColor: string
  budgetAmount: number
  spent: number
  percentage: number
}

// ─── Stat Card Component ────────────────────────────────────────────

function StatCard({
  title,
  value,
  icon: Icon,
  neonKey,
  footer,
  index,
}: {
  title: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  neonKey: NeonColorKey
  footer?: string
  index: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
    >
      <Card
        className={`relative overflow-hidden bg-card/80 backdrop-blur-sm border ${neonBorderClass(neonKey)} transition-all hover:scale-[1.02]`}
        style={{ boxShadow: neonShadow(neonKey) }}
      >
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
          <div
            className="rounded-md p-2"
            style={{
              backgroundColor: `rgba(${NEON_COLORS[neonKey].rgb},0.1)`,
              boxShadow: `0 0 6px rgba(${NEON_COLORS[neonKey].rgb},0.3)`,
            }}
          >
            <Icon className={`size-4 ${neonTextClass(neonKey)}`} />
          </div>
        </CardHeader>
        <CardContent className="pt-0 pb-2">
          <p className={`text-xl font-bold ${neonTextClass(neonKey)}`} style={{ textShadow: `0 0 8px rgba(${NEON_COLORS[neonKey].rgb},0.4)` }}>
            {value}
          </p>
        </CardContent>
        {footer && (
          <div className="px-6 pb-3">
            <p className="text-[11px] text-muted-foreground">{footer}</p>
          </div>
        )}
      </Card>
    </motion.div>
  )
}

// ─── Section Card Wrapper ───────────────────────────────────────────

function SectionCard({
  title,
  icon: Icon,
  neonKey,
  children,
  delay = 0,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  neonKey: NeonColorKey
  children: React.ReactNode
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <Card
        className={`relative overflow-hidden bg-card/80 backdrop-blur-sm border ${neonBorderClass(neonKey)}`}
        style={{ boxShadow: neonShadow(neonKey) }}
      >
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Icon className={`size-4 ${neonTextClass(neonKey)}`} />
            <span className={neonTextClass(neonKey)} style={{ textShadow: `0 0 6px rgba(${NEON_COLORS[neonKey].rgb},0.3)` }}>
              {title}
            </span>
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

function BudgetProgressBar({ detail }: { detail: BudgetCategoryDetail }) {
  const pct = Math.min(detail.percentage, 100)
  let barColor: string
  if (detail.percentage > 100) {
    barColor = NEON_COLORS.pink.hex
  } else if (detail.percentage >= 75) {
    barColor = NEON_COLORS.yellow.hex
  } else {
    barColor = NEON_COLORS.green.hex
  }

  const glowRgb =
    detail.percentage > 100
      ? NEON_COLORS.pink.rgb
      : detail.percentage >= 75
        ? NEON_COLORS.yellow.rgb
        : NEON_COLORS.green.rgb

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">{detail.categoryIcon}</span>
          <span className="text-sm font-medium text-foreground">{detail.categoryName}</span>
          {detail.percentage > 100 && (
            <span className="text-[10px] font-semibold text-neon-pink px-1.5 py-0.5 rounded bg-neon-pink/10">
              +{Math.round(detail.percentage - 100)}%
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatCurrencyK(detail.spent)} / {formatCurrencyK(detail.budgetAmount)}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted/50 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            backgroundColor: barColor,
            boxShadow: `0 0 8px rgba(${glowRgb},0.4), 0 0 2px rgba(${glowRgb},0.6)`,
          }}
        />
      </div>
    </div>
  )
}

// ─── Upcoming Due Item ──────────────────────────────────────────────

function DueItem({ item }: { item: UpcomingDueItem }) {
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

// ─── Hex to RGB helper ──────────────────────────────────────────────

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16)
    const g = parseInt(h[1] + h[1], 16)
    const b = parseInt(h[2] + h[2], 16)
    return `${r},${g},${b}`
  }
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `${r},${g},${b}`
}

// ─── Skeleton ───────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="space-y-1">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="bg-card/80">
            <CardHeader className="pb-2">
              <Skeleton className="h-3 w-20" />
            </CardHeader>
            <CardContent className="pt-0">
              <Skeleton className="h-6 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-card/80">
          <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
          <CardContent><Skeleton className="h-48 w-full" /></CardContent>
        </Card>
        <Card className="bg-card/80">
          <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
          <CardContent><Skeleton className="h-48 w-full" /></CardContent>
        </Card>
      </div>
      <Card className="bg-card/80">
        <CardHeader><Skeleton className="h-5 w-48" /></CardHeader>
        <CardContent><Skeleton className="h-40 w-full" /></CardContent>
      </Card>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-card/80">
          <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
          <CardContent><Skeleton className="h-56 w-full" /></CardContent>
        </Card>
        <Card className="bg-card/80">
          <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
          <CardContent><Skeleton className="h-56 w-full" /></CardContent>
        </Card>
      </div>
    </div>
  )
}

// ─── Main Dashboard Page ────────────────────────────────────────────

interface DashboardPageProps {
  currentMonth?: number
  currentYear?: number
}

export function DashboardPage({ currentMonth, currentYear }: DashboardPageProps) {
  const now = new Date()
  const month = currentMonth ?? now.getMonth() + 1
  const year = currentYear ?? now.getFullYear()

  const { data, loading, error } = useAsyncData(
    () => dashboardService.getData(month, year),
    [month, year]
  )

  // ── Extended Data Fetching ──
  const [serviceSummary, setServiceSummary] = useState<ServiceSummary>({ totalPaid: 0, paidCount: 0, pendingAmount: 0 })
  const [debtSummary, setDebtSummary] = useState<DebtSummary>({ activeCount: 0, monthlyPayment: 0 })
  const [savingsSummary, setSavingsSummary] = useState<SavingsSummary>({ totalTarget: 0, rate: 0 })
  const [upcomingDue, setUpcomingDue] = useState<UpcomingDueItem[]>([])
  const [budgetDetails, setBudgetDetails] = useState<BudgetCategoryDetail[]>([])

  useEffect(() => {
    if (!data) return

    async function fetchExtended() {
      const startDate = new Date(year, month - 1, 1).toISOString()
      const endDate = new Date(year, month, 0, 23, 59, 59, 999).toISOString()

      // ── Service Summary ──
      const allBills = await db.serviceBills.toArray()
      const monthBills = allBills.filter(b => b.dueDate >= startDate && b.dueDate <= endDate)
      const paidBills = monthBills.filter(b => b.paid)
      const unpaidBills = monthBills.filter(b => !b.paid)
      setServiceSummary({
        totalPaid: paidBills.reduce((s, b) => s + b.amount, 0),
        paidCount: paidBills.length,
        pendingAmount: unpaidBills.reduce((s, b) => s + b.amount, 0),
      })

      // ── Debt Summary ──
      const allDebts = await db.debts.toArray()
      const activeDebts = allDebts.filter(d => d.status === 'active')
      setDebtSummary({
        activeCount: activeDebts.length,
        monthlyPayment: activeDebts.reduce((s, d) => s + d.monthlyPayment, 0),
      })

      // ── Savings Summary ──
      const allSavings = await db.savingsGoals.toArray()
      const totalTarget = allSavings.reduce((s, g) => s + g.targetAmount, 0)
      const totalCurrent = allSavings.reduce((s, g) => s + g.currentAmount, 0)
      setSavingsSummary({
        totalTarget,
        rate: totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0,
      })

      // ── Upcoming Due Dates ──
      const serviceAccounts = await db.serviceAccounts.toArray()
      const recurringPayments = await db.recurringPayments.toArray()

      const serviceDueItems: UpcomingDueItem[] = allBills
        .filter(b => !b.paid && b.dueDate >= new Date().toISOString())
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        .slice(0, 5)
        .map(b => {
          const acct = serviceAccounts.find(a => a.id === b.serviceAccountId)
          const dueDate = new Date(b.dueDate)
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          dueDate.setHours(0, 0, 0, 0)
          const daysRemaining = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          return {
            id: b.id,
            name: acct?.name ?? 'Servicio',
            dueDate: b.dueDate,
            amount: b.amount,
            daysRemaining,
            type: 'service' as const,
            color: acct?.color ?? NEON_COLORS.orange.hex,
            icon: acct?.icon ?? '📄',
          }
        })

      const recurringDueItems: UpcomingDueItem[] = recurringPayments
        .filter(r => r.isActive && r.nextDueDate >= new Date().toISOString())
        .sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate))
        .slice(0, 5)
        .map(r => {
          const dueDate = new Date(r.nextDueDate)
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          dueDate.setHours(0, 0, 0, 0)
          const daysRemaining = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          return {
            id: r.id,
            name: r.name,
            dueDate: r.nextDueDate,
            amount: r.amount,
            daysRemaining,
            type: 'recurring' as const,
            color: NEON_COLORS.cyan.hex,
            icon: '🔄',
          }
        })

      setUpcomingDue(
        [...serviceDueItems, ...recurringDueItems]
          .sort((a, b) => a.daysRemaining - b.daysRemaining)
          .slice(0, 8)
      )

      // ── Budget Category Details ──
      const categories = await db.expenseCategories.toArray()
      const details: BudgetCategoryDetail[] = data.budgetSummary.map(b => {
        const cat = categories.find(c => c.id === b.categoryId)
        return {
          categoryId: b.categoryId,
          categoryName: b.categoryName,
          categoryIcon: cat?.icon ?? '📦',
          categoryColor: cat?.color ?? NEON_COLORS.pink.hex,
          budgetAmount: b.budgetAmount,
          spent: b.spent,
          percentage: b.percentage,
        }
      }).sort((a, b) => b.percentage - a.percentage)
      setBudgetDetails(details)
    }

    fetchExtended()
  }, [data, month, year])

  // ── Monthly Trend Chart Data ──
  const trendData = useMemo(() => {
    if (!data) return []
    return data.monthlyTrend.map((t) => ({
      name: `${MONTHS_ES[t.month - 1].substring(0, 3)} ${t.year}`,
      Ingresos: t.income,
      Gastos: t.expenses,
    }))
  }, [data])

  // ── Expense by Category Pie Data ──
  const pieData = useMemo(() => {
    if (!data) return []
    return data.expenseByCategory.map((c, i) => ({
      name: c.categoryName,
      value: c.amount,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }))
  }, [data])

  // ── Budget totals ──
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
    const projected = data.balance + avg3 * 0.1 // slight projection based on average
    const trendDir = avg3 >= 0 ? 'positive' : 'negative'
    return { avg3, projected: data.balance, trend: trendDir }
  }, [data])

  // ── Over-budget calculation ──
  const overBudgetAmount = useMemo(() => {
    return data?.budgetSummary
      .filter(b => b.spent > b.budgetAmount)
      .reduce((s, b) => s + (b.spent - b.budgetAmount), 0) ?? 0
  }, [data])

  if (loading) return <DashboardSkeleton />
  if (error) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[50vh]">
        <Card className="bg-card/80 border-neon-pink/30 max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-neon-pink text-sm">Error al cargar datos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">{error.message}</p>
          </CardContent>
        </Card>
      </div>
    )
  }
  if (!data) return null

  // ── Stat Cards Configuration ──
  const statCards = [
    {
      title: 'Ingresos',
      value: formatCurrency(data.totalIncome),
      icon: TrendingUp,
      neonKey: 'green' as NeonColorKey,
    },
    {
      title: 'Gastos',
      value: formatCurrency(data.totalExpenses),
      icon: TrendingDown,
      neonKey: 'pink' as NeonColorKey,
    },
    {
      title: 'Gastos Ajustados',
      value: formatCurrency(data.adjustedExpenses),
      icon: DollarSign,
      neonKey: 'orange' as NeonColorKey,
    },
    {
      title: 'Balance',
      value: formatCurrency(data.balance),
      icon: Scale,
      neonKey: 'cyan' as NeonColorKey,
    },
    {
      title: 'Servicios',
      value: formatCurrency(serviceSummary.totalPaid),
      icon: Receipt,
      neonKey: 'orange' as NeonColorKey,
      footer: `${serviceSummary.paidCount} pagada${serviceSummary.paidCount !== 1 ? 's' : ''} - ${formatCurrency(serviceSummary.pendingAmount)} pendiente`,
    },
    {
      title: 'Deudas',
      value: formatCurrency(data.debtsTotal),
      icon: CreditCard,
      neonKey: 'pink' as NeonColorKey,
      footer: `${debtSummary.activeCount} activa${debtSummary.activeCount !== 1 ? 's' : ''} - Cuota: ${formatCurrency(debtSummary.monthlyPayment)}`,
    },
    {
      title: 'Ahorro',
      value: formatCurrency(data.savingsTotal),
      icon: PiggyBank,
      neonKey: 'cyan' as NeonColorKey,
      footer: `Meta: ${formatCurrency(savingsSummary.totalTarget)} - Tasa: ${savingsSummary.rate.toFixed(1)}%`,
    },
    {
      title: 'Presupuesto',
      value: `${formatCurrency(budgetTotals.spent)} / ${formatCurrency(budgetTotals.budgeted)}`,
      icon: PieChart,
      neonKey: 'yellow' as NeonColorKey,
    },
  ]

  return (
    <div className="p-4 md:p-6 space-y-5 overflow-y-auto cyber-scrollbar">
      {/* ── 1. Header ── */}
      <motion.div
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1
          className="text-2xl font-bold text-neon-blue"
          style={{ textShadow: '0 0 12px rgba(5,217,232,0.5), 0 0 24px rgba(5,217,232,0.2)' }}
        >
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Resumen financiero — {MONTHS_ES[month - 1]} {year}
        </p>
      </motion.div>

      {/* ── 2. Stat Cards Row (8 cards) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {statCards.map((card, i) => (
          <StatCard
            key={card.title}
            title={card.title}
            value={card.value}
            icon={card.icon}
            neonKey={card.neonKey}
            footer={card.footer}
            index={i}
          />
        ))}
      </div>

      {/* ── 3. Presupuestos Section ── */}
      <SectionCard title="Presupuestos" icon={Calendar} neonKey="yellow" delay={0.3}>
        {budgetDetails.length > 0 ? (
          <div className="space-y-4">
            {/* Over-budget warning */}
            {overBudgetAmount > 0 && (
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-md bg-neon-pink/10 border border-neon-pink/30"
                style={{ boxShadow: '0 0 8px rgba(255,42,109,0.15)' }}
              >
                <TrendingDown className="size-4 text-neon-pink" />
                <span className="text-sm font-semibold text-neon-pink">
                  Excedido por {formatCurrency(overBudgetAmount)}
                </span>
              </div>
            )}

            {/* Category Progress Bars */}
            <div className="space-y-3 max-h-64 overflow-y-auto cyber-scrollbar pr-1">
              {budgetDetails.map((detail) => (
                <BudgetProgressBar key={detail.categoryId} detail={detail} />
              ))}
            </div>

            {/* Total Presupuesto Summary Box */}
            <div
              className="mt-3 p-3 rounded-lg border border-[#f9f002]/30 bg-[#f9f002]/5"
              style={{ boxShadow: '0 0 8px rgba(249,240,2,0.1)' }}
            >
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Presupuesto</p>
                  <p className="text-sm font-bold text-neon-cyan tabular-nums">{formatCurrency(budgetTotals.budgeted)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Gastado</p>
                  <p className="text-sm font-bold text-neon-pink tabular-nums">{formatCurrency(budgetTotals.spent)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Restante</p>
                  <p className="text-sm font-bold text-neon-green tabular-nums">{formatCurrency(budgetTotals.remaining)}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
            Sin presupuestos configurados
          </div>
        )}
      </SectionCard>

      {/* ── 4. Proyección de Balance ── */}
      <SectionCard title="Proyección de Balance" icon={BarChart3} neonKey="cyan" delay={0.4}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
              style={{ textShadow: `0 0 6px rgba(${balanceProjection.projected >= 0 ? NEON_COLORS.green.rgb : NEON_COLORS.pink.rgb},0.3)` }}
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

      {/* ── 5. Próximos Vencimientos ── */}
      <SectionCard title="Próximos Vencimientos" icon={Calendar} neonKey="orange" delay={0.5}>
        {upcomingDue.length > 0 ? (
          <div className="max-h-72 overflow-y-auto cyber-scrollbar">
            {upcomingDue.map((item) => (
              <DueItem key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
            Sin vencimientos próximos
          </div>
        )}
      </SectionCard>

      {/* ── 6. Gastos por Categoría + 7. Monthly Trend ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pie Chart */}
        <SectionCard title="Gastos por Categoría" icon={PieChart} neonKey="pink" delay={0.55}>
          {pieData.length > 0 ? (
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={220}>
                <RechartsPie>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={85}
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
                    contentStyle={{
                      backgroundColor: 'rgba(17,17,40,0.95)',
                      border: '1px solid rgba(5,217,232,0.2)',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    itemStyle={{ color: '#e0e6f0' }}
                    labelStyle={{ color: '#7c8ba1' }}
                  />
                </RechartsPie>
              </ResponsiveContainer>
              {/* Legend */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 justify-center">
                {pieData.map((entry, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span
                      className="inline-block size-2.5 rounded-full"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-[11px] text-muted-foreground">{entry.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[220px] text-muted-foreground text-sm">
              Sin gastos este mes
            </div>
          )}
        </SectionCard>

        {/* Monthly Trend Area Chart */}
        <SectionCard title="Tendencia Mensual" icon={BarChart3} neonKey="cyan" delay={0.6}>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="dashGradientIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#05d9e8" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#05d9e8" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="dashGradientExpenses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff2a6d" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#ff2a6d" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#7c8ba1', fontSize: 11 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#7c8ba1', fontSize: 11 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickLine={false}
                  tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<NeonTooltip />} />
                <Area
                  type="monotone"
                  dataKey="Ingresos"
                  stroke="#05d9e8"
                  strokeWidth={2}
                  fill="url(#dashGradientIncome)"
                  dot={false}
                  activeDot={{ r: 4, stroke: '#05d9e8', strokeWidth: 2, fill: '#0a0a1a' }}
                />
                <Area
                  type="monotone"
                  dataKey="Gastos"
                  stroke="#ff2a6d"
                  strokeWidth={2}
                  fill="url(#dashGradientExpenses)"
                  dot={false}
                  activeDot={{ r: 4, stroke: '#ff2a6d', strokeWidth: 2, fill: '#0a0a1a' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[260px] text-muted-foreground text-sm">
              Sin datos suficientes
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
