'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, ArrowLeftRight, Tags, PieChart, PiggyBank, CreditCard, Repeat, Receipt, Wallet, BarChart3, LayoutDashboard } from 'lucide-react'
import { NavigationProvider, useNavigation } from '@/lib/navigation-context'
import { OrgProvider } from '@/lib/org-context'
import { useEnsureSeeded, searchService } from '@/lib/data'
import type { SearchResult } from '@/lib/data'
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
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { formatCurrency } from '@/lib/finance-utils'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transacciones', icon: ArrowLeftRight },
  { id: 'categories', label: 'Categorías', icon: Tags },
  { id: 'budgets', label: 'Presupuestos', icon: PieChart },
  { id: 'savings', label: 'Ahorros', icon: PiggyBank },
  { id: 'debts', label: 'Deudas', icon: CreditCard },
  { id: 'recurring', label: 'Recurrentes', icon: Repeat },
  { id: 'services', label: 'Servicios', icon: Receipt },
  { id: 'accounts', label: 'Cuentas', icon: Wallet },
  { id: 'reports', label: 'Reportes', icon: BarChart3 },
]

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

function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult | null>(null)
  const { navigateTo } = useNavigation()

  useEffect(() => {
    if (!query.trim()) {
      return
    }
    const timer = setTimeout(() => {
      searchService.search(query).then(setResults)
    }, 200)
    return () => clearTimeout(timer)
  }, [query])

  const displayResults = query.trim() ? results : null

  const handleSelect = (type: string) => {
    navigateTo(type)
    onOpenChange(false)
    setQuery('')
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Buscar en KHORVEN"
      description="Buscar transacciones, cuentas, servicios y más..."
    >
      <CommandInput
        placeholder="Buscar..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No se encontraron resultados.</CommandEmpty>

        {/* Navigation suggestions when no query */}
        {!query && (
          <CommandGroup heading="Navegación">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <CommandItem
                  key={item.id}
                  onSelect={() => handleSelect(item.id)}
                  className="cursor-pointer"
                >
                  <Icon className="size-4 text-neon-blue" />
                  <span>{item.label}</span>
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}

        {/* Search results */}
        {displayResults && displayResults.transactions.length > 0 && (
          <CommandGroup heading="Transacciones">
            {displayResults.transactions.slice(0, 5).map((t) => (
              <CommandItem
                key={t.id}
                onSelect={() => handleSelect('transactions')}
                className="cursor-pointer"
              >
                <ArrowLeftRight className="size-4 text-neon-pink" />
                <span className="flex-1 truncate">{t.description}</span>
                <span className="text-xs text-muted-foreground">
                  {formatCurrency(t.amount)}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {displayResults && displayResults.accounts.length > 0 && (
          <CommandGroup heading="Cuentas">
            {displayResults.accounts.slice(0, 5).map((a) => (
              <CommandItem
                key={a.id}
                onSelect={() => handleSelect('accounts')}
                className="cursor-pointer"
              >
                <Wallet className="size-4 text-neon-green" />
                <span className="flex-1">{a.name}</span>
                <span className="text-xs text-muted-foreground">
                  {formatCurrency(a.balance)}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {displayResults && displayResults.services.length > 0 && (
          <CommandGroup heading="Servicios">
            {displayResults.services.slice(0, 5).map((s) => (
              <CommandItem
                key={s.id}
                onSelect={() => handleSelect('services')}
                className="cursor-pointer"
              >
                <Receipt className="size-4 text-neon-yellow" />
                <span className="flex-1">{s.name}</span>
                <span className="text-xs text-muted-foreground">
                  {formatCurrency(s.amount)}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {displayResults && displayResults.debts.length > 0 && (
          <CommandGroup heading="Deudas">
            {displayResults.debts.slice(0, 5).map((d) => (
              <CommandItem
                key={d.id}
                onSelect={() => handleSelect('debts')}
                className="cursor-pointer"
              >
                <CreditCard className="size-4 text-neon-purple" />
                <span className="flex-1">{d.name}</span>
                <span className="text-xs text-muted-foreground">
                  {formatCurrency(d.remainingAmount)}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {displayResults && displayResults.savingsGoals.length > 0 && (
          <CommandGroup heading="Metas de Ahorro">
            {displayResults.savingsGoals.slice(0, 5).map((s) => (
              <CommandItem
                key={s.id}
                onSelect={() => handleSelect('savings')}
                className="cursor-pointer"
              >
                <PiggyBank className="size-4 text-neon-green" />
                <span className="flex-1">{s.name}</span>
                <span className="text-xs text-muted-foreground">
                  {formatCurrency(s.currentAmount)}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {displayResults && displayResults.recurring.length > 0 && (
          <CommandGroup heading="Pagos Recurrentes">
            {displayResults.recurring.slice(0, 5).map((r) => (
              <CommandItem
                key={r.id}
                onSelect={() => handleSelect('recurring')}
                className="cursor-pointer"
              >
                <Repeat className="size-4 text-neon-cyan" />
                <span className="flex-1">{r.name}</span>
                <span className="text-xs text-muted-foreground">
                  {formatCurrency(r.amount)}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}

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
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

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
            className="flex items-center gap-2 rounded-md border border-neon-blue/20 bg-background/50 px-3 py-1.5 text-xs text-muted-foreground hover:border-neon-blue/40 hover:text-neon-blue transition-all"
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
