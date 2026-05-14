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
  PieChart,
  ArrowLeftRight,
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
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { dashboardService, useAsyncData } from '@/lib/data'
import { formatCurrency, formatDate, MONTHS_ES, CHART_COLORS } from '@/lib/finance-utils'

// ─── Neon Color Map for stat cards ────────────────────────────────

const NEON_STYLES: Record<string, { color: string; shadow: string; border: string }> = {
  green: {
    color: 'text-neon-green',
    shadow: 'shadow-neon-green',
    border: 'border-neon-green/30',
  },
  pink: {
    color: 'text-neon-pink',
    shadow: 'shadow-neon-pink',
    border: 'border-neon-pink/30',
  },
  orange: {
    color: 'text-[#ff8c00]',
    shadow: '[box-shadow:0_0_5px_rgba(255,140,0,0.3),0_0_10px_rgba(255,140,0,0.1)]',
    border: 'border-[#ff8c00]/30',
  },
  blue: {
    color: 'text-neon-blue',
    shadow: 'shadow-neon-blue',
    border: 'border-neon-blue/30',
  },
  cyan: {
    color: 'text-neon-cyan',
    shadow: '[box-shadow:0_0_5px_rgba(5,217,232,0.3),0_0_10px_rgba(5,217,232,0.1)]',
    border: 'border-neon-cyan/30',
  },
  purple: {
    color: 'text-neon-purple',
    shadow: '[box-shadow:0_0_5px_rgba(211,0,197,0.3),0_0_10px_rgba(211,0,197,0.1)]',
    border: 'border-neon-purple/30',
  },
  yellow: {
    color: 'text-neon-yellow',
    shadow: '[box-shadow:0_0_5px_rgba(249,240,2,0.3),0_0_10px_rgba(249,240,2,0.1)]',
    border: 'border-neon-yellow/30',
  },
}

// ─── Stat Card Component ──────────────────────────────────────────

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
  neonKey: string
  footer?: string
  index: number
}) {
  const style = NEON_STYLES[neonKey] ?? NEON_STYLES.blue

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
    >
      <Card
        className={`relative overflow-hidden bg-card/80 backdrop-blur-sm border ${style.border} hover:${style.border} transition-colors`}
      >
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
          <div className={`rounded-md p-2 bg-background/50 ${style.shadow}`}>
            <Icon className={`size-4 ${style.color}`} />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <p className={`text-2xl font-bold ${style.color}`}>{value}</p>
        </CardContent>
        {footer && (
          <CardFooter className="pt-0">
            <p className="text-xs text-muted-foreground">{footer}</p>
          </CardFooter>
        )}
      </Card>
    </motion.div>
  )
}

// ─── Skeleton Grid ────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="bg-card/80">
            <CardHeader className="pb-2">
              <Skeleton className="h-3 w-24" />
            </CardHeader>
            <CardContent className="pt-0">
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-card/80">
          <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
          <CardContent><Skeleton className="h-64 w-full" /></CardContent>
        </Card>
        <Card className="bg-card/80">
          <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
          <CardContent><Skeleton className="h-64 w-full" /></CardContent>
        </Card>
      </div>
      <Card className="bg-card/80">
        <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
        <CardContent><Skeleton className="h-48 w-full" /></CardContent>
      </Card>
    </div>
  )
}

// ─── Custom Tooltip ───────────────────────────────────────────────

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

// ─── Dashboard Page ───────────────────────────────────────────────

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

  // ── Budget summary calculations ──
  const budgetTotals = useMemo(() => {
    if (!data) return { budgeted: 0, spent: 0 }
    const budgeted = data.budgetSummary.reduce((s, b) => s + b.budgetAmount, 0)
    const spent = data.budgetSummary.reduce((s, b) => s + b.spent, 0)
    return { budgeted, spent }
  }, [data])

  // ── Recent transactions (last 5) ──
  const recentTx = useMemo(() => {
    if (!data) return []
    return data.recentTransactions.slice(0, 5)
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
      title: 'Ingresos del Mes',
      value: formatCurrency(data.totalIncome),
      icon: TrendingUp,
      neonKey: 'green',
      footer: `${MONTHS_ES[month - 1]} ${year}`,
    },
    {
      title: 'Gastos del Mes',
      value: formatCurrency(data.totalExpenses),
      icon: TrendingDown,
      neonKey: 'pink',
      footer: 'Solo transacciones',
    },
    {
      title: 'Gastos Ajustados',
      value: formatCurrency(data.adjustedExpenses),
      icon: DollarSign,
      neonKey: 'orange',
      footer: 'Transac. + Servicios + Deudas',
    },
    {
      title: 'Balance',
      value: formatCurrency(data.balance),
      icon: Scale,
      neonKey: 'blue',
      footer: data.balance >= 0 ? 'Positivo' : 'Negativo',
    },
    {
      title: 'Total Ahorros',
      value: formatCurrency(data.savingsTotal),
      icon: PiggyBank,
      neonKey: 'cyan',
      footer: 'Metas de ahorro',
    },
    {
      title: 'Total Deudas',
      value: formatCurrency(data.debtsTotal),
      icon: CreditCard,
      neonKey: 'purple',
      footer: 'Deudas activas',
    },
    {
      title: 'Presupuesto Usado',
      value: `${formatCurrency(budgetTotals.spent)} / ${formatCurrency(budgetTotals.budgeted)}`,
      icon: PieChart,
      neonKey: 'yellow',
      footer: budgetTotals.budgeted > 0
        ? `${((budgetTotals.spent / budgetTotals.budgeted) * 100).toFixed(1)}% utilizado`
        : 'Sin presupuestos',
    },
    {
      title: 'Transacciones',
      value: String(data.recentTransactions.length),
      icon: ArrowLeftRight,
      neonKey: 'pink',
      footer: 'Transacciones recientes',
    },
  ]

  return (
    <div className="p-4 md:p-6 space-y-6 overflow-y-auto cyber-scrollbar">
      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-2xl font-bold text-neon-blue">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Resumen financiero — {MONTHS_ES[month - 1]} {year}
        </p>
      </motion.div>

      {/* ── 8 Stat Cards (2 rows of 4) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Monthly Trend Area Chart */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <Card className="bg-card/80 backdrop-blur-sm border-neon-blue/20">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Tendencia Mensual
              </CardTitle>
            </CardHeader>
            <CardContent>
              {trendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradientIncome" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#05d9e8" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#05d9e8" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradientExpenses" x1="0" y1="0" x2="0" y2="1">
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
                      fill="url(#gradientIncome)"
                      dot={false}
                      activeDot={{ r: 4, stroke: '#05d9e8', strokeWidth: 2, fill: '#0a0a1a' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="Gastos"
                      stroke="#ff2a6d"
                      strokeWidth={2}
                      fill="url(#gradientExpenses)"
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
            </CardContent>
          </Card>
        </motion.div>

        {/* Expense by Category Pie Chart */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <Card className="bg-card/80 backdrop-blur-sm border-neon-pink/20">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Gastos por Categoría
              </CardTitle>
            </CardHeader>
            <CardContent>
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
                <div className="flex items-center justify-center h-[260px] text-muted-foreground text-sm">
                  Sin gastos este mes
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ── Recent Transactions Table ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.5 }}
      >
        <Card className="bg-card/80 backdrop-blur-sm border-neon-blue/20">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Transacciones Recientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentTx.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="border-border/40 hover:bg-transparent">
                    <TableHead className="text-muted-foreground text-xs">Descripción</TableHead>
                    <TableHead className="text-muted-foreground text-xs">Monto</TableHead>
                    <TableHead className="text-muted-foreground text-xs hidden sm:table-cell">Categoría</TableHead>
                    <TableHead className="text-muted-foreground text-xs hidden md:table-cell">Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentTx.map((tx) => (
                    <TableRow key={tx.id} className="border-border/20">
                      <TableCell className="text-sm font-medium max-w-[180px] truncate">
                        {tx.description}
                      </TableCell>
                      <TableCell
                        className={`text-sm font-semibold tabular-nums ${
                          tx.type === 'income' ? 'text-neon-green' : 'text-neon-pink'
                        }`}
                      >
                        {tx.type === 'income' ? '+' : '-'}
                        {formatCurrency(tx.amount)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground hidden sm:table-cell">
                        {tx.categoryId ? '—' : 'Sin categoría'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
                        {formatDate(tx.date)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                No hay transacciones recientes
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
