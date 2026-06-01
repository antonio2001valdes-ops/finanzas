'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Bell,
  X,
  Check,
  CheckCheck,
  Trash2,
  Settings,
  AlertTriangle,
  TrendingDown,
  Receipt,
  Repeat,
  Scale,
  PiggyBank,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { notificationService } from '@/lib/data'
import type { AppNotification, NotificationSettings } from '@/lib/db-client'
import { formatDate } from '@/lib/finance-utils'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'

// ─── Neon Color Constants ──────────────────────────────────────────

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ff2a6d',
  warning: '#ff8c00',
  info: '#05d9e8',
  success: '#01ff89',
}

const SEVERITY_GLOW: Record<string, string> = {
  critical: '0 0 8px rgba(255,42,109,0.4), 0 0 16px rgba(255,42,109,0.15)',
  warning: '0 0 8px rgba(255,140,0,0.4), 0 0 16px rgba(255,140,0,0.15)',
  info: '0 0 8px rgba(5,217,232,0.4), 0 0 16px rgba(5,217,232,0.15)',
  success: '0 0 8px rgba(1,255,137,0.4), 0 0 16px rgba(1,255,137,0.15)',
}

const SEVERITY_BG: Record<string, string> = {
  critical: 'rgba(255,42,109,0.08)',
  warning: 'rgba(255,140,0,0.08)',
  info: 'rgba(5,217,232,0.08)',
  success: 'rgba(1,255,137,0.08)',
}

// ─── Type → Icon Mapping ───────────────────────────────────────────

function getNotificationIcon(type: AppNotification['type']) {
  switch (type) {
    case 'budget_exceeded':
      return AlertTriangle
    case 'service_due':
      return Receipt
    case 'recurring_pending':
      return Repeat
    case 'negative_balance':
      return TrendingDown
    case 'savings_goal_reached':
      return PiggyBank
    default:
      return Bell
  }
}

function getNotificationColor(notification: AppNotification): string {
  if (notification.type === 'service_due' && notification.severity === 'critical') {
    return SEVERITY_COLORS.critical
  }
  if (notification.type === 'budget_exceeded' && notification.severity === 'warning') {
    return SEVERITY_COLORS.warning
  }
  return SEVERITY_COLORS[notification.severity] ?? SEVERITY_COLORS.info
}

// ─── Animation Variants ────────────────────────────────────────────

const dropdownVariants = {
  hidden: { opacity: 0, y: -8, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.96,
    transition: { duration: 0.15, ease: 'easeIn' },
  },
}

const itemVariants = {
  hidden: { opacity: 0, x: -12 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.04, duration: 0.2, ease: 'easeOut' },
  }),
  exit: { opacity: 0, x: 12, transition: { duration: 0.12 } },
}

const settingsVariants = {
  hidden: { opacity: 0, x: 20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
  },
  exit: { opacity: 0, x: 20, transition: { duration: 0.15 } },
}

// ─── Settings Config ───────────────────────────────────────────────

interface SettingToggle {
  key: keyof NotificationSettings
  label: string
  color: string
}

const SETTING_TOGGLES: SettingToggle[] = [
  { key: 'budgetExceeded', label: 'Presupuesto excedido', color: '#ff2a6d' },
  { key: 'serviceDue', label: 'Servicio por vencer', color: '#ff8c00' },
  { key: 'recurringPending', label: 'Pago recurrente pendiente', color: '#05d9e8' },
  { key: 'negativeBalance', label: 'Balance negativo', color: '#ff2a6d' },
  { key: 'savingsGoalReached', label: 'Meta de ahorro alcanzada', color: '#01ff89' },
]

// ─── Component ─────────────────────────────────────────────────────

interface NotificationCenterProps {
  onNavigate: (page: string) => void
}

export function NotificationCenter({ onNavigate }: NotificationCenterProps) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState<NotificationSettings | null>(null)
  const [loading, setLoading] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)

  // ── Load notifications ──
  const loadNotifications = async () => {
    try {
      setLoading(true)
      const notifs = await notificationService.getAll()
      setNotifications(notifs)
    } catch (error) {
      console.error('Error loading notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  // ── Load settings ──
  const loadSettings = async () => {
    try {
      const s = await notificationService.getSettings()
      setSettings(s)
    } catch (error) {
      console.error('Error loading notification settings:', error)
    }
  }

  // Load on mount and when dropdown opens
  useEffect(() => {
    loadNotifications()
    loadSettings()
  }, [])

  useEffect(() => {
    if (open) {
      loadNotifications()
      loadSettings()
    }
  }, [open])

  // ── Close on outside click ──
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSettingsOpen(false)
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  // ── Actions ──
  const handleToggleDropdown = () => {
    if (!open) {
      setSettingsOpen(false)
    }
    setOpen((prev) => !prev)
  }

  const handleNotificationClick = async (notification: AppNotification) => {
    try {
      if (!notification.read) {
        await notificationService.markAsRead(notification.id)
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
        )
      }
      if (notification.relatedPage) {
        onNavigate(notification.relatedPage)
      }
      setOpen(false)
      setSettingsOpen(false)
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    } catch (error) {
      console.error('Error marking all as read:', error)
    }
  }

  const handleClearAll = async () => {
    try {
      await notificationService.clearAll()
      setNotifications([])
    } catch (error) {
      console.error('Error clearing notifications:', error)
    }
  }

  const handleSettingToggle = async (key: keyof NotificationSettings, value: boolean) => {
    // Special handling for browser notifications — request permission
    if (key === 'browserNotifications' && value) {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          // User denied — don't enable the toggle
          return
        }
      } else {
        // Browser doesn't support notifications — don't enable
        return
      }
    }

    try {
      const updated = await notificationService.updateSettings({ [key]: value })
      setSettings(updated)
    } catch (error) {
      console.error('Error updating notification settings:', error)
    }
  }

  // ── Computed ──
  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div ref={containerRef} className="relative">
      {/* ── Bell Button ── */}
      <button
        onClick={handleToggleDropdown}
        className="relative flex items-center justify-center size-9 rounded-md text-muted-foreground hover:text-neon-cyan hover:bg-neon-cyan/10 transition-all duration-200"
        aria-label={`Notificaciones${unreadCount > 0 ? ` (${unreadCount} sin leer)` : ''}`}
      >
        <Bell className="size-4.5" />
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold leading-none"
              style={{
                backgroundColor: '#ff2a6d',
                color: '#fff',
                boxShadow: '0 0 8px rgba(255,42,109,0.6)',
              }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* ── Dropdown Panel ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            variants={dropdownVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute right-0 top-full mt-2 w-[380px] sm:w-[420px] z-50 rounded-xl border overflow-hidden"
            style={{
              backgroundColor: 'var(--card)',
              borderColor: 'rgba(5,217,232,0.15)',
              boxShadow:
                '0 0 30px rgba(5,217,232,0.12), 0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(5,217,232,0.08)',
            }}
          >
            {/* ── Header ── */}
            <div
              className="flex items-center justify-between px-4 py-3 border-b"
              style={{ borderColor: 'rgba(5,217,232,0.1)' }}
            >
              <div className="flex items-center gap-2">
                <Bell className="size-4 text-neon-cyan" />
                <h3 className="text-sm font-bold tracking-wide text-foreground">
                  NOTIFICACIONES
                </h3>
                {unreadCount > 0 && (
                  <span
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded-full"
                    style={{
                      backgroundColor: 'rgba(255,42,109,0.15)',
                      color: '#ff2a6d',
                      border: '1px solid rgba(255,42,109,0.25)',
                    }}
                  >
                    {unreadCount} nueva{unreadCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {/* Settings toggle */}
                <button
                  onClick={() => setSettingsOpen((prev) => !prev)}
                  className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-neon-cyan hover:bg-neon-cyan/10 transition-all"
                  aria-label="Configuración de notificaciones"
                >
                  <Settings className={`size-3.5 transition-transform duration-300 ${settingsOpen ? 'rotate-90 text-neon-cyan' : ''}`} />
                </button>
                {/* Close */}
                <button
                  onClick={() => { setOpen(false); setSettingsOpen(false) }}
                  className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
                  aria-label="Cerrar notificaciones"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </div>

            {/* ── Action Buttons ── */}
            {notifications.length > 0 && (
              <div
                className="flex items-center gap-2 px-4 py-2 border-b"
                style={{ borderColor: 'rgba(5,217,232,0.06)' }}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMarkAllRead}
                  disabled={unreadCount === 0}
                  className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-neon-cyan hover:bg-neon-cyan/10 disabled:opacity-30"
                >
                  <CheckCheck className="size-3" />
                  Marcar todas leídas
                </Button>
                <div className="flex-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAll}
                  className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-neon-pink hover:bg-neon-pink/10"
                >
                  <Trash2 className="size-3" />
                  Limpiar
                </Button>
              </div>
            )}

            {/* ── Content Area ── */}
            <div className="relative" style={{ minHeight: '120px' }}>
              <AnimatePresence mode="wait">
                {settingsOpen ? (
                  // ── Settings Panel ──
                  <motion.div
                    key="settings"
                    variants={settingsVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="max-h-[400px] overflow-y-auto cyber-scrollbar"
                  >
                    <div className="p-4 space-y-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Settings className="size-4 text-neon-cyan" />
                        <h4 className="text-sm font-bold text-foreground tracking-wide">
                          CONFIGURACIÓN
                        </h4>
                      </div>

                      {settings ? (
                        <div className="space-y-3">
                          {SETTING_TOGGLES.map((toggle) => (
                            <div
                              key={toggle.key}
                              className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border transition-all"
                              style={{
                                borderColor: (settings[toggle.key] as boolean)
                                  ? toggle.color + '30'
                                  : 'rgba(5,217,232,0.06)',
                                backgroundColor: (settings[toggle.key] as boolean)
                                  ? toggle.color + '08'
                                  : 'transparent',
                              }}
                            >
                              <div className="flex items-center gap-2.5">
                                <div
                                  className="size-2 rounded-full shrink-0"
                                  style={{
                                    backgroundColor: toggle.color,
                                    boxShadow: `0 0 6px ${toggle.color}60`,
                                  }}
                                />
                                <span className="text-sm text-foreground/90">
                                  {toggle.label}
                                </span>
                              </div>
                              <Switch
                                checked={settings[toggle.key] as boolean}
                                onCheckedChange={(checked: boolean) =>
                                  handleSettingToggle(toggle.key, checked)
                                }
                                className="data-[state=checked]:border-transparent"
                                style={
                                  (settings[toggle.key] as boolean)
                                    ? { backgroundColor: toggle.color }
                                    : undefined
                                }
                              />
                            </div>
                          ))}

                          {/* Browser notifications toggle */}
                          <div
                            className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border transition-all"
                            style={{
                              borderColor: settings.browserNotifications
                                ? 'rgba(5,217,232,0.25)'
                                : 'rgba(5,217,232,0.06)',
                              backgroundColor: settings.browserNotifications
                                ? 'rgba(5,217,232,0.06)'
                                : 'transparent',
                            }}
                          >
                            <div className="flex items-center gap-2.5">
                              <div
                                className="size-2 rounded-full shrink-0"
                                style={{
                                  backgroundColor: '#05d9e8',
                                  boxShadow: '0 0 6px rgba(5,217,232,0.5)',
                                }}
                              />
                              <div className="flex flex-col">
                                <span className="text-sm text-foreground/90">
                                  Notificaciones del navegador
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {typeof window !== 'undefined' && 'Notification' in window
                                    ? Notification.permission === 'granted'
                                      ? 'Permiso concedido'
                                      : Notification.permission === 'denied'
                                        ? 'Permiso denegado'
                                        : 'Se solicitará permiso'
                                    : 'No soportado en este navegador'}
                                </span>
                              </div>
                            </div>
                            <Switch
                              checked={settings.browserNotifications}
                              onCheckedChange={(checked: boolean) =>
                                handleSettingToggle('browserNotifications', checked)
                              }
                              className="data-[state=checked]:border-transparent"
                              style={
                                settings.browserNotifications
                                  ? { backgroundColor: '#05d9e8' }
                                  : undefined
                              }
                            />
                          </div>
                        </div>
                      ) : (
                        // Loading settings
                        <div className="flex items-center justify-center py-8">
                          <div
                            className="size-5 border-2 rounded-full animate-spin"
                            style={{
                              borderColor: 'rgba(5,217,232,0.2)',
                              borderTopColor: '#05d9e8',
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </motion.div>
                ) : (
                  // ── Notifications List ──
                  <motion.div
                    key="notifications"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, transition: { duration: 0.15 } }}
                    exit={{ opacity: 0, transition: { duration: 0.1 } }}
                    className="max-h-[400px] overflow-y-auto cyber-scrollbar"
                  >
                    {loading && notifications.length === 0 ? (
                      // Loading state
                      <div className="flex items-center justify-center py-12">
                        <div
                          className="size-6 border-2 rounded-full animate-spin"
                          style={{
                            borderColor: 'rgba(5,217,232,0.2)',
                            borderTopColor: '#05d9e8',
                          }}
                        />
                      </div>
                    ) : notifications.length === 0 ? (
                      // Empty state
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <Bell className="size-8 mb-3 opacity-20" style={{ color: '#05d9e8' }} />
                        <p className="text-sm font-medium">Sin notificaciones</p>
                        <p className="text-xs mt-1 text-muted-foreground/60">
                          Todo está en orden por ahora
                        </p>
                      </div>
                    ) : (
                      // Notification items
                      <div className="py-1">
                        <AnimatePresence>
                          {notifications.map((notification, index) => {
                            const Icon = getNotificationIcon(notification.type)
                            const color = getNotificationColor(notification)
                            const isUnread = !notification.read

                            return (
                              <motion.div
                                key={notification.id}
                                custom={index}
                                variants={itemVariants}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                layout
                                onClick={() => handleNotificationClick(notification)}
                                className="group flex items-start gap-3 px-4 py-3 cursor-pointer transition-all duration-150 relative"
                                style={{
                                  backgroundColor: isUnread
                                    ? SEVERITY_BG[notification.severity] ?? 'transparent'
                                    : 'transparent',
                                  borderLeft: isUnread
                                    ? `2px solid ${color}`
                                    : '2px solid transparent',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor =
                                    SEVERITY_BG[notification.severity] ?? 'rgba(5,217,232,0.04)'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = isUnread
                                    ? SEVERITY_BG[notification.severity] ?? 'transparent'
                                    : 'transparent'
                                }}
                              >
                                {/* Icon */}
                                <div
                                  className="shrink-0 mt-0.5 size-8 rounded-md flex items-center justify-center"
                                  style={{
                                    backgroundColor: color + '15',
                                    border: `1px solid ${color}30`,
                                    boxShadow: isUnread ? SEVERITY_GLOW[notification.severity] : 'none',
                                  }}
                                >
                                  <Icon className="size-4" style={{ color }} />
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <p
                                      className={`text-sm leading-tight ${
                                        isUnread ? 'font-semibold text-foreground' : 'font-medium text-foreground/70'
                                      }`}
                                    >
                                      {notification.title}
                                    </p>
                                    {isUnread && (
                                      <span
                                        className="shrink-0 mt-1 size-2 rounded-full"
                                        style={{
                                          backgroundColor: color,
                                          boxShadow: `0 0 6px ${color}80`,
                                        }}
                                      />
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                                    {notification.message}
                                  </p>
                                  <p
                                    className="text-[10px] font-mono mt-1"
                                    style={{ color: color + '99' }}
                                  >
                                    {formatDate(notification.createdAt)}
                                  </p>
                                </div>

                                {/* Read indicator on hover */}
                                {isUnread && (
                                  <div className="shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Check
                                      className="size-3.5"
                                      style={{ color }}
                                    />
                                  </div>
                                )}
                              </motion.div>
                            )
                          })}
                        </AnimatePresence>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── Footer ── */}
            {notifications.length > 0 && !settingsOpen && (
              <div
                className="px-4 py-2 border-t flex items-center justify-center"
                style={{ borderColor: 'rgba(5,217,232,0.06)' }}
              >
                <p className="text-[10px] text-muted-foreground/50 font-mono">
                  {notifications.length} notificación{notifications.length !== 1 ? 'es' : ''}
                  {unreadCount > 0 ? ` · ${unreadCount} sin leer` : ''}
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
