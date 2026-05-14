'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, BarChart3 } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
} from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { dashboardService, useAsyncData } from '@/lib/data'
import { db } from '@/lib/db-client'
import { formatCurrency, MONTHS_ES, CHART_COLORS } from '@/lib/finance-utils'

// ─── Extended Neon Color Palette for Charts ───────────────────────

const EXTENDED_COLORS = [
  '#05d9e8', // cyan/blue
  '#ff2a6d', // pink
  '#01ff89', // green
  '#d300c5', // purple
  '#f9f002', // yellow
  '#ff8c00', // orange
  '#7b68ee', // medium slate blue
  '#00ced1', // dark turquoise
  '#ff69b4', // hot pink
  '#32cd32', // lime green
  '#ffa500', // orange
  '#8a2be2', // blue violet
]

// ─── Custom Neon Tooltip ──────────────────────────────────────────

function NeonTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
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

// ─── Chart Section Card Wrapper ───────────────────────────────────

function ChartCard({
  title,
  children,
  delay = 0,
  borderClass = 'border-neon-blue/20',
}: {
  title: string
  children: React.ReactNode
  delay?: number
  borderClass?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <Card className={`bg-card/80 backdrop-blur-sm ${borderClass}`}>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </motion.div>
  )
}

// ─── Empty Chart State ────────────────────────────────────────────

function EmptyChart({ height = 280 }: { height?: number }) {
  return (
    <div
      className="flex items-center justify-center text-muted-foreground text-sm"
      style={{ height }}
    >
      Sin datos disponibles
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────

function ReportsSkeleton() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="bg-card/80">
            <CardHeader>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ─── Transaction interface for yearly data ────────────────────────

interface MonthlyData {
  month: number
  year: number
  income: number
  expenses: number
  balance: number
}

// ─── Reports Page ─────────────────────────────────────────────────

interface ReportsPageProps {
  currentMonth?: number
  currentYear?: number
}

export function ReportsPage({ currentMonth, currentYear }: ReportsPageProps) {
  const now = new Date()
  const initialMonth = currentMonth ?? now.getMonth() + 1
  const initialYear = currentYear ?? now.getFullYear()

  const [selectedMonth, setSelectedMonth] = useState(initialMonth)
  const [selectedYear, setSelectedYear] = useState(initialYear)

  // Fetch dashboard data for selected month
  const { data: dashData, loading: dashLoading } = useAsyncData(
    () => dashboardService.getData(selectedMonth, selectedYear),
    [selectedMonth, selectedYear]
  )

  // Fetch all transactions for the full year for monthly comparisons
  const { data: yearlyData, loading: yearlyLoading } = useAsyncData(async () => {
    const allTransactions = await db.transactions.toArray()
    const months: MonthlyData[] = []

    for (let m = 1; m <= 12; m++) {
      const startDate = new Date(selectedYear, m - 1, 1).toISOString()
      const endDate = new Date(selectedYear, m, 0, 23, 59, 59, 999).toISOString()

      const monthTx = allTransactions.filter((t) => t.date >= startDate && t.date <= endDate)
      const income = monthTx
        .filter((t) => t.type === 'income')
        .reduce((s, t) => s + t.amount, 0)
      const expenses = monthTx
        .filter((t) => t.type === 'expense')
        .reduce((s, t) => s + t.amount, 0)

      months.push({
        month: m,
        year: selectedYear,
        income,
        expenses,
        balance: income - expenses,
      })
    }

    return months
  }, [selectedYear])

  const loading = dashLoading || yearlyLoading

  // ── 1. Resumen Mensual — Bar chart income vs expenses ──
  const monthlySummaryData = useMemo(() => {
    if (!yearlyData) return []
    return yearlyData.map((m) => ({
      name: MONTHS_ES[m.month - 1].substring(0, 3),
      Ingresos: m.income,
      Gastos: m.expenses,
    }))
  }, [yearlyData])

  // ── 2. Distribución de Gastos — Pie chart for selected month ──
  const expenseDistributionData = useMemo(() => {
    if (!dashData) return []
    return dashData.expenseByCategory.map((c, i) => ({
      name: c.categoryName,
      value: c.amount,
      color: EXTENDED_COLORS[i % EXTENDED_COLORS.length],
    }))
  }, [dashData])

  // ── 3. Tendencia de Ingresos — Line chart over 12 months ──
  const incomeTrendData = useMemo(() => {
    if (!yearlyData) return []
    return yearlyData.map((m) => ({
      name: MONTHS_ES[m.month - 1].substring(0, 3),
      Ingresos: m.income,
    }))
  }, [yearlyData])

  // ── 4. Balance Mensual — Area chart net balance ──
  const balanceData = useMemo(() => {
    if (!yearlyData) return []
    return yearlyData.map((m) => ({
      name: MONTHS_ES[m.month - 1].substring(0, 3),
      Balance: m.balance,
    }))
  }, [yearlyData])

  // ── 5. Top Categorías de Gasto — Horizontal bar top 5 ──
  const topCategoriesData = useMemo(() => {
    if (!dashData) return []
    return [...dashData.expenseByCategory]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
      .map((c, i) => ({
        name: c.categoryName.length > 14 ? c.categoryName.substring(0, 14) + '…' : c.categoryName,
        Monto: c.amount,
        fill: EXTENDED_COLORS[i % EXTENDED_COLORS.length],
      }))
  }, [dashData])

  // ── 6. Comparativa Presupuesto vs Real ──
  const budgetComparisonData = useMemo(() => {
    if (!dashData) return []
    return dashData.budgetSummary.map((b, i) => ({
      name:
        b.categoryName.length > 10
          ? b.categoryName.substring(0, 10) + '…'
          : b.categoryName,
      Presupuesto: b.budgetAmount,
      Real: b.spent,
    }))
  }, [dashData])

  // ── Month Navigation ──
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12)
      setSelectedYear((y) => y - 1)
    } else {
      setSelectedMonth((m) => m - 1)
    }
  }

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1)
      setSelectedYear((y) => y + 1)
    } else {
      setSelectedMonth((m) => m + 1)
    }
  }

  if (loading) return <ReportsSkeleton />

  return (
    <div className="p-4 md:p-6 space-y-6 overflow-y-auto cyber-scrollbar">
      {/* ── Header with Month/Year Selector ── */}
      <motion.div
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      >
        <div>
          <h1 className="text-2xl font-bold text-neon-blue">Reportes</h1>
          <p className="text-sm text-muted-foreground">
            Análisis detallado de tus finanzas
          </p>
        </div>

        {/* Month/Year Selector */}
        <div className="flex items-center gap-2 rounded-lg border border-neon-blue/20 bg-card/60 backdrop-blur-sm px-3 py-1.5">
          <button
            onClick={handlePrevMonth}
            className="text-muted-foreground hover:text-neon-blue transition-colors p-1"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-sm font-semibold text-neon-blue min-w-[130px] text-center tabular-nums">
            {MONTHS_ES[selectedMonth - 1]} {selectedYear}
          </span>
          <button
            onClick={handleNextMonth}
            className="text-muted-foreground hover:text-neon-blue transition-colors p-1"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </motion.div>

      {/* ── Charts Grid (2 columns on desktop) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 1. Resumen Mensual — Bar Chart */}
        <ChartCard title="Resumen Mensual" delay={0.1} borderClass="border-neon-blue/20">
          {monthlySummaryData.some((d) => d.Ingresos > 0 || d.Gastos > 0) ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlySummaryData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
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
                <Bar dataKey="Ingresos" fill="#05d9e8" radius={[4, 4, 0, 0]} barSize={16} />
                <Bar dataKey="Gastos" fill="#ff2a6d" radius={[4, 4, 0, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>

        {/* 2. Distribución de Gastos — Pie Chart */}
        <ChartCard title="Distribución de Gastos" delay={0.15} borderClass="border-neon-pink/20">
          {expenseDistributionData.length > 0 ? (
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={expenseDistributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {expenseDistributionData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: 'rgba(17,17,40,0.95)',
                      border: '1px solid rgba(255,42,109,0.2)',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    itemStyle={{ color: '#e0e6f0' }}
                    labelStyle={{ color: '#7c8ba1' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 justify-center">
                {expenseDistributionData.map((entry, i) => (
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
            <EmptyChart />
          )}
        </ChartCard>

        {/* 3. Tendencia de Ingresos — Line Chart */}
        <ChartCard title="Tendencia de Ingresos" delay={0.2} borderClass="border-neon-green/20">
          {incomeTrendData.some((d) => d.Ingresos > 0) ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={incomeTrendData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
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
                <Line
                  type="monotone"
                  dataKey="Ingresos"
                  stroke="#01ff89"
                  strokeWidth={2}
                  dot={{ r: 4, fill: '#01ff89', stroke: '#0a0a1a', strokeWidth: 2 }}
                  activeDot={{ r: 6, stroke: '#01ff89', strokeWidth: 2, fill: '#0a0a1a' }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>

        {/* 4. Balance Mensual — Area Chart */}
        <ChartCard title="Balance Mensual" delay={0.25} borderClass="border-neon-blue/20">
          {balanceData.some((d) => d.Balance !== 0) ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={balanceData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradientBalance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#05d9e8" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#05d9e8" stopOpacity={0} />
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
                  tickFormatter={(v: number) =>
                    v >= 0 ? `$${(v / 1000).toFixed(0)}k` : `-$${(Math.abs(v) / 1000).toFixed(0)}k`
                  }
                />
                <Tooltip content={<NeonTooltip />} />
                <Area
                  type="monotone"
                  dataKey="Balance"
                  stroke="#05d9e8"
                  strokeWidth={2}
                  fill="url(#gradientBalance)"
                  dot={{ r: 3, fill: '#05d9e8', stroke: '#0a0a1a', strokeWidth: 2 }}
                  activeDot={{ r: 5, stroke: '#05d9e8', strokeWidth: 2, fill: '#0a0a1a' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>

        {/* 5. Top Categorías de Gasto — Horizontal Bar Chart */}
        <ChartCard
          title="Top Categorías de Gasto"
          delay={0.3}
          borderClass="border-neon-purple/20"
        >
          {topCategoriesData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                layout="vertical"
                data={topCategoriesData}
                margin={{ top: 5, right: 10, left: 10, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.06)"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={{ fill: '#7c8ba1', fontSize: 11 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickLine={false}
                  tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: '#7c8ba1', fontSize: 11 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickLine={false}
                  width={80}
                />
                <Tooltip content={<NeonTooltip />} />
                <Bar dataKey="Monto" radius={[0, 4, 4, 0]} barSize={20}>
                  {topCategoriesData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>

        {/* 6. Comparativa Presupuesto vs Real — Grouped Bar Chart */}
        <ChartCard
          title="Comparativa Presupuesto vs Real"
          delay={0.35}
          borderClass="border-neon-yellow/20"
        >
          {budgetComparisonData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={budgetComparisonData}
                margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
              >
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
                <Bar dataKey="Presupuesto" fill="#f9f002" radius={[4, 4, 0, 0]} barSize={16} />
                <Bar dataKey="Real" fill="#ff2a6d" radius={[4, 4, 0, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>
      </div>
    </div>
  )
}
