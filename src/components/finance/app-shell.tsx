'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  ArrowLeftRight,
  Tags,
  PieChart,
  PiggyBank,
  CreditCard,
  Repeat,
  Receipt,
  Wallet,
  BarChart3,
  LayoutDashboard,
  X,
  ArrowRight,
  Sparkles,
} from 'lucide-react'
import { NavigationProvider, useNavigation } from '@/lib/navigation-context'
import { OrgProvider } from '@/lib/org-context'
import { useEnsureSeeded, searchService } from '@/lib/data'
import type { SearchGroup, SearchMatch } from '@/lib/data'
import { Sidebar } from './sidebar'
import { DashboardPage } from './dashboard-page'
import { TransactionsPage } from './transactions-page'
import { AccountsPage } from './accounts-page'
import { CategoriesPage } from './categories-page'
import { BudgetsPage } from './budgets-page'
import { SavingsPage } from './savings-page'
import { DebtsPage } from './debts-page'
import { RecurringPage } from './recurring-page'
import { ServicesPage } from './services-page'
import { ReportsPage } from './reports-page'
import { Input } from '@/components/ui/input'
import { formatCurrency, formatDate } from '@/lib/finance-utils'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, color: '#05d9e8' },
  { id: 'transactions', label: 'Transacciones', icon: ArrowLeftRight, color: '#05d9e8' },
  { id: 'categories', label: 'Categorías', icon: Tags, color: '#7c3aed' },
  { id: 'budgets', label: 'Presupuestos', icon: PieChart, color: '#f97316' },
  { id: 'savings', label: 'Ahorros', icon: PiggyBank, color: '#4deeea' },
  { id: 'debts', label: 'Deudas', icon: CreditCard, color: '#d946ef' },
  { id: 'recurring', label: 'Recurrentes', icon: Repeat, color: '#00fff5' },
  { id: 'services', label: 'Servicios', icon: Receipt, color: '#f9f002' },
  { id: 'accounts', label: 'Cuentas', icon: Wallet, color: '#01ff89' },
  { id: 'reports', label: 'Reportes', icon: BarChart3, color: '#05d9e8' },
]

// Map icon name to component for search results
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  ArrowLeftRight,
  Wallet,
  Receipt,
  CreditCard,
  PiggyBank,
  Repeat,
  Tags,
  PieChart,
}

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  enter: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}

function PageRenderer({ page, currentMonth, currentYear, onMonthChange, onNavigate }: { page: string; currentMonth: number; currentYear: number; onMonthChange: (month: number, year: number) => void; onNavigate: (page: string) => void }) {
  const pageMap: Record<string, React.ComponentType<{ currentMonth?: number; currentYear?: number; onMonthChange?: (month: number, year: number) => void; onNavigate?: (page: string) => void }>> = {
    dashboard: DashboardPage,
    transactions: TransactionsPage,
    accounts: AccountsPage,
    categories: CategoriesPage,
    budgets: BudgetsPage,
    savings: SavingsPage,
    debts: DebtsPage,
    recurring: RecurringPage,
    services: ServicesPage,
    reports: ReportsPage,
  }

  const PageComponent = pageMap[page] || DashboardPage

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={page}
        variants={pageVariants}
        initial="initial"
        animate="enter"
        exit="exit"
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="flex-1 overflow-auto"
      >
        <PageComponent currentMonth={currentMonth} currentYear={currentYear} onMonthChange={onMonthChange} onNavigate={onNavigate} />
      </motion.div>
    </AnimatePresence>
  )
}

// ─── Search Dialog ──────────────────────────────────────────────────

function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchGroup[]>([])
  const [searching, setSearching] = useState(false)
  const { navigateTo } = useNavigation()
  const inputRef = useRef<HTMLInputElement>(null)

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }
    setSearching(true)
    const timer = setTimeout(() => {
      searchService.search(query).then((res) => {
        setResults(res)
        setSearching(false)
      })
    }, 200)
    return () => clearTimeout(timer)
  }, [query])

  // Auto-focus input when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    } else {
      setQuery('')
      setResults([])
    }
  }, [open])

  const handleSelect = (page: string) => {
    navigateTo(page)
    onOpenChange(false)
    setQuery('')
    setResults([])
  }

  // Total results count
  const totalResults = results.reduce((sum, g) => sum + g.results.length, 0)

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => onOpenChange(false)}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-x-0 top-[5%] z-50 mx-auto w-full max-w-2xl"
          >
            <div className="mx-4 rounded-xl border border-neon-cyan/20 bg-card/95 backdrop-blur-md shadow-[0_0_40px_rgba(5,217,232,0.15)] overflow-hidden">
              {/* Search Input */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-neon-cyan/10">
                <Search className="size-5 text-neon-cyan shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar en KHORVEN... (transacciones, cuentas, servicios, etc.)"
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                />
                {query && (
                  <button
                    onClick={() => { setQuery(''); inputRef.current?.focus() }}
                    className="size-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
                <kbd className="rounded bg-muted/50 border border-border/50 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                  ESC
                </kbd>
              </div>

              {/* Results area */}
              <div className="max-h-[70vh] overflow-y-auto">
                {/* No query — show navigation suggestions */}
                {!query.trim() && (
                  <div className="p-4">
                    <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
                      <Sparkles className="size-3 text-neon-cyan" />
                      Navegación rápida
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {NAV_ITEMS.map((item) => {
                        const Icon = item.icon
                        return (
                          <button
                            key={item.id}
                            onClick={() => handleSelect(item.id)}
                            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-border/30 hover:border-neon-cyan/30 hover:bg-neon-cyan/5 transition-all text-left group"
                          >
                            <div
                              className="size-8 rounded-md flex items-center justify-center shrink-0"
                              style={{ backgroundColor: item.color + '15', border: `1px solid ${item.color}33` }}
                            >
                              <Icon className="size-4" style={{ color: item.color }} />
                            </div>
                            <span className="text-sm font-medium text-foreground/80 group-hover:text-foreground">
                              {item.label}
                            </span>
                            <ArrowRight className="size-3 ml-auto text-muted-foreground/0 group-hover:text-neon-cyan transition-colors" />
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Query with results */}
                {query.trim() && results.length > 0 && (
                  <div className="p-4 space-y-3">
                    {/* Results count */}
                    <p className="text-xs text-muted-foreground">
                      {totalResults} resultado{totalResults !== 1 ? 's' : ''} en {results.length} sección{results.length !== 1 ? 'es' : ''}
                    </p>

                    {/* Grouped results */}
                    {results.map((group) => {
                      const GroupIcon = ICON_MAP[group.icon] || ArrowLeftRight
                      return (
                        <div key={group.page} className="space-y-1">
                          {/* Group header */}
                          <button
                            onClick={() => handleSelect(group.page)}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/30 transition-colors group"
                          >
                            <div
                              className="size-6 rounded flex items-center justify-center shrink-0"
                              style={{ backgroundColor: group.color + '15', border: `1px solid ${group.color}33` }}
                            >
                              <GroupIcon className="size-3.5" style={{ color: group.color }} />
                            </div>
                            <span className="text-xs font-semibold" style={{ color: group.color }}>
                              {group.pageLabel}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              ({group.results.length})
                            </span>
                            <ArrowRight className="size-3 ml-auto text-muted-foreground/0 group-hover:text-foreground transition-colors" />
                          </button>

                          {/* Individual results */}
                          <div className="ml-4 space-y-0.5 border-l-2 pl-3" style={{ borderColor: group.color + '33' }}>
                            {group.results.slice(0, 8).map((match: SearchMatch) => (
                              <button
                                key={match.id}
                                onClick={() => handleSelect(group.page)}
                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left hover:bg-muted/30 transition-colors group"
                              >
                                <span className="flex-1 text-sm text-foreground/90 truncate">
                                  {match.label}
                                </span>
                                {match.sublabel && (
                                  <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">
                                    {match.sublabel}
                                  </span>
                                )}
                                {match.amount !== undefined && (
                                  <span className="text-xs font-mono font-medium shrink-0" style={{ color: group.color }}>
                                    {formatCurrency(match.amount)}
                                  </span>
                                )}
                                {match.date && (
                                  <span className="text-[10px] text-muted-foreground shrink-0">
                                    {formatDate(match.date)}
                                  </span>
                                )}
                                <span className="text-[9px] px-1 py-0.5 rounded bg-muted/50 text-muted-foreground shrink-0">
                                  {match.matchField}
                                </span>
                              </button>
                            ))}
                            {group.results.length > 8 && (
                              <button
                                onClick={() => handleSelect(group.page)}
                                className="w-full text-center py-1 text-xs text-neon-cyan/60 hover:text-neon-cyan transition-colors"
                              >
                                +{group.results.length - 8} más en {group.pageLabel} →
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Query with no results */}
                {query.trim() && !searching && results.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Search className="size-8 mb-3 text-neon-cyan/20" />
                    <p className="text-sm font-medium">Sin resultados</p>
                    <p className="text-xs mt-1">
                      No se encontró &quot;{query}&quot; en ninguna sección
                    </p>
                  </div>
                )}

                {/* Searching */}
                {query.trim() && searching && (
                  <div className="flex items-center justify-center py-12">
                    <div className="size-6 border-2 border-neon-cyan/30 border-t-neon-cyan rounded-full animate-spin" />
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ─── App Shell ──────────────────────────────────────────────────────

function AppShellInner() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const { activePage, navigateTo } = useNavigation()

  const now = new Date()
  const [currentMonth, setCurrentMonth] = useState(now.getMonth() + 1)
  const [currentYear, setCurrentYear] = useState(now.getFullYear())

  // Seed database on mount
  useEnsureSeeded()

  // Ctrl+K / Cmd+K to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen((prev) => !prev)
      }
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [searchOpen])

  const handleMonthYearChange = (month: number, year: number) => {
    setCurrentMonth(month)
    setCurrentYear(year)
  }

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => !prev)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
      />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar with search trigger */}
        <header className="flex items-center justify-between px-4 py-2 border-b border-neon-blue/10 bg-card/50 backdrop-blur-sm shrink-0">
          <h2 className="text-sm font-medium text-muted-foreground">
            {NAV_ITEMS.find((n) => n.id === activePage)?.label || 'Dashboard'}
          </h2>
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 rounded-md border border-neon-cyan/20 bg-background/50 px-3 py-1.5 text-xs text-muted-foreground hover:border-neon-cyan/40 hover:text-neon-cyan hover:shadow-[0_0_10px_rgba(5,217,232,0.15)] transition-all"
          >
            <Search className="size-3.5" />
            <span>Buscar...</span>
            <kbd className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
              ⌘K
            </kbd>
          </button>
        </header>

        {/* Page content */}
        <PageRenderer
          page={activePage}
          currentMonth={currentMonth}
          currentYear={currentYear}
          onMonthChange={handleMonthYearChange}
          onNavigate={navigateTo}
        />
      </main>

      {/* Search Dialog */}
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  )
}

export function AppShell() {
  return (
    <OrgProvider>
      <NavigationProvider>
        <AppShellInner />
      </NavigationProvider>
    </OrgProvider>
  )
}
