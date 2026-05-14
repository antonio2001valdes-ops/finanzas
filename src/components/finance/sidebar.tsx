'use client'

import {
  LayoutDashboard,
  ArrowLeftRight,
  Tags,
  PieChart,
  PiggyBank,
  CreditCard,
  Repeat,
  Receipt,
  Wallet,
  BarChart3,
  Download,
  Upload,
  ChevronLeft,
  ChevronRight,
  Diamond,
} from 'lucide-react'
import { useNavigation } from '@/lib/navigation-context'
import { generateGitHubZip, backupService } from '@/lib/data'
import { MonthYearPicker } from './month-year-picker'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface NavItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const NAV_ITEMS: NavItem[] = [
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

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  currentMonth: number
  currentYear: number
  onMonthYearChange: (month: number, year: number) => void
}

export function Sidebar({
  collapsed,
  onToggle,
  currentMonth,
  currentYear,
  onMonthYearChange,
}: SidebarProps) {
  const { activePage, navigateTo } = useNavigation()

  const handleDownloadZip = async () => {
    try {
      const blob = await generateGitHubZip()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'khorven-finance-v3.2.0.zip'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('ZIP descargado exitosamente')
    } catch {
      toast.error('Error al descargar ZIP')
    }
  }

  const handleExport = async () => {
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
      toast.success('Datos exportados exitosamente')
    } catch {
      toast.error('Error al exportar datos')
    }
  }

  return (
    <aside
      className={cn(
        'flex flex-col h-screen bg-[var(--sidebar-background)] border-r transition-all duration-300',
        collapsed ? 'w-16' : 'w-64',
        'border-neon-blue/10'
      )}
    >
      {/* Logo + Toggle */}
      <div className={cn(
        'flex items-center shrink-0 border-b border-neon-blue/10',
        collapsed ? 'px-2 py-3 justify-center' : 'px-4 py-3 justify-between'
      )}>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Diamond className="size-6 text-neon-blue animate-diamond-pulse" />
            <div className="flex flex-col">
              <span className="text-base font-black tracking-wider text-neon-blue leading-none">
                KHORVEN
              </span>
              <span className="text-[9px] tracking-[0.2em] text-muted-foreground leading-none mt-0.5">
                FINANZAS v3.2
              </span>
            </div>
          </div>
        )}
        {collapsed && (
          <Diamond className="size-7 text-neon-blue animate-diamond-pulse" />
        )}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'size-7 text-muted-foreground hover:text-neon-blue hover:bg-neon-blue/10 shrink-0',
            collapsed && 'mt-2'
          )}
          onClick={onToggle}
        >
          {collapsed ? (
            <ChevronRight className="size-4" />
          ) : (
            <ChevronLeft className="size-4" />
          )}
        </Button>
      </div>

      {/* Month/Year Picker */}
      <div className={cn(
        'shrink-0 border-b border-neon-blue/10',
        !collapsed && 'py-1'
      )}>
        <MonthYearPicker
          month={currentMonth}
          year={currentYear}
          onChange={onMonthYearChange}
          collapsed={collapsed}
        />
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 cyber-scrollbar">
        <nav className={cn('flex flex-col gap-0.5 p-2')}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = activePage === item.id

            if (collapsed) {
              return (
                <Tooltip key={item.id} delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => navigateTo(item.id)}
                      className={cn(
                        'flex items-center justify-center rounded-md size-10 mx-auto transition-all',
                        isActive
                          ? 'bg-neon-blue/15 text-neon-blue border-l-2 border-neon-blue shadow-neon-blue'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                      )}
                    >
                      <Icon className="size-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="font-medium">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              )
            }

            return (
              <button
                key={item.id}
                onClick={() => navigateTo(item.id)}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all',
                  isActive
                    ? 'bg-neon-blue/15 text-neon-blue border-l-2 border-neon-blue shadow-neon-blue'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground border-l-2 border-transparent'
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>
      </ScrollArea>

      {/* Bottom Actions */}
      <div className="shrink-0 border-t border-neon-blue/10 p-2">
        {collapsed ? (
          <div className="flex flex-col items-center gap-1">
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 text-muted-foreground hover:text-neon-blue hover:bg-neon-blue/10"
                  onClick={handleDownloadZip}
                >
                  <Download className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Descargar ZIP</TooltipContent>
            </Tooltip>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 text-muted-foreground hover:text-neon-green hover:bg-neon-green/10"
                  onClick={handleExport}
                >
                  <Upload className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Exportar</TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <Button
              variant="ghost"
              className="justify-start gap-2 text-muted-foreground hover:text-neon-blue hover:bg-neon-blue/10 h-9"
              onClick={handleDownloadZip}
            >
              <Download className="size-4" />
              <span className="text-xs">Descargar ZIP</span>
            </Button>
            <Button
              variant="ghost"
              className="justify-start gap-2 text-muted-foreground hover:text-neon-green hover:bg-neon-green/10 h-9"
              onClick={handleExport}
            >
              <Upload className="size-4" />
              <span className="text-xs">Exportar</span>
            </Button>
          </div>
        )}
        {!collapsed && (
          <>
            <Separator className="my-2 bg-neon-blue/10" />
            <div className="px-3 py-1">
              <p className="text-[10px] text-muted-foreground/50 text-center">
                KHORVEN Finanzas Personales v3.2.0
              </p>
            </div>
          </>
        )}
      </div>
    </aside>
  )
}
