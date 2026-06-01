import { db, generateId, nowISO, type AppNotification, type NotificationSettings } from '@/lib/db-client';
import { formatCurrency } from '@/lib/finance-utils';

// ─── Default notification settings ────────────────────────────────────

const DEFAULT_SETTINGS: NotificationSettings = {
  id: 'default',
  budgetExceeded: true,
  serviceDue: true,
  recurringPending: true,
  negativeBalance: true,
  savingsGoalReached: true,
  browserNotifications: false,
  updatedAt: new Date().toISOString(),
};

// ─── Notification Service ─────────────────────────────────────────────

export const notificationService = {
  // Get all notifications, newest first
  async getAll(): Promise<AppNotification[]> {
    return db.notifications.orderBy('createdAt').reverse().toArray();
  },

  // Get unread count
  async getUnreadCount(): Promise<number> {
    return db.notifications.where('read').equals(0).count();
  },

  // Mark a notification as read
  async markAsRead(id: string): Promise<void> {
    await db.notifications.update(id, { read: true });
  },

  // Mark all as read
  async markAllAsRead(): Promise<void> {
    await db.notifications.toCollection().modify({ read: true });
  },

  // Delete a notification
  async delete(id: string): Promise<void> {
    await db.notifications.delete(id);
  },

  // Clear all notifications
  async clearAll(): Promise<void> {
    await db.notifications.clear();
  },

  // ── Settings ──

  async getSettings(): Promise<NotificationSettings> {
    const settings = await db.notificationSettings.get('default');
    return settings ?? { ...DEFAULT_SETTINGS };
  },

  async updateSettings(partial: Partial<NotificationSettings>): Promise<NotificationSettings> {
    const current = await this.getSettings();
    const updated = { ...current, ...partial, updatedAt: new Date().toISOString() };
    await db.notificationSettings.put(updated);
    return updated;
  },

  // ── Alert Detection Engine ──

  async checkAndGenerateAlerts(month: number, year: number): Promise<number> {
    const settings = await this.getSettings();
    const now = nowISO();
    let generated = 0;

    // Delete old notifications of same types to avoid duplicates
    const existing = await db.notifications.toArray();

    // ── 1. Budget Exceeded ──
    if (settings.budgetExceeded) {
      const sDate = new Date(year, month - 1, 1).toISOString();
      const eDate = new Date(year, month, 0, 23, 59, 59, 999).toISOString();

      const budgets = await db.budgets.where({ month, year }).toArray();
      const allTx = await db.transactions.toArray();
      const expCats = await db.expenseCategories.toArray();
      const mTx = allTx.filter(t => t.date >= sDate && t.date <= eDate && t.type === 'expense');

      for (const budget of budgets) {
        const spent = mTx.filter(t => t.categoryId === budget.categoryId).reduce((s, t) => s + t.amount, 0);
        const pct = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;

        if (pct >= 100) {
          const cat = expCats.find(c => c.id === budget.categoryId);
          const catName = cat?.name ?? 'Sin categoría';
          const notifKey = `budget_exceeded_${budget.categoryId}_${month}_${year}`;

          // Only create if not already exists
          if (!existing.some(n => n.id === notifKey)) {
            await db.notifications.put({
              id: notifKey,
              type: 'budget_exceeded',
              title: 'Presupuesto excedido',
              message: `${catName}: gastado ${formatCurrency(spent)} de ${formatCurrency(budget.amount)} (${pct.toFixed(0)}%)`,
              severity: 'critical',
              read: false,
              relatedPage: 'budgets',
              relatedId: budget.id,
              createdAt: now,
            });
            generated++;
          }
        } else if (pct >= 75) {
          const cat = expCats.find(c => c.id === budget.categoryId);
          const catName = cat?.name ?? 'Sin categoría';
          const notifKey = `budget_warning_${budget.categoryId}_${month}_${year}`;

          if (!existing.some(n => n.id === notifKey)) {
            await db.notifications.put({
              id: notifKey,
              type: 'budget_exceeded',
              title: 'Presupuesto al límite',
              message: `${catName}: gastado ${formatCurrency(spent)} de ${formatCurrency(budget.amount)} (${pct.toFixed(0)}%)`,
              severity: 'warning',
              read: false,
              relatedPage: 'budgets',
              relatedId: budget.id,
              createdAt: now,
            });
            generated++;
          }
        }
      }
    }

    // ── 2. Service Due (within 3 days) ──
    if (settings.serviceDue) {
      const svcBills = await db.serviceBills.toArray();
      const svcAccounts = await db.serviceAccounts.toArray();
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
      const threeDaysISO = threeDaysFromNow.toISOString();

      const dueSoon = svcBills.filter(b => !b.paid && b.dueDate <= threeDaysISO && b.dueDate >= now);
      for (const bill of dueSoon) {
        const acct = svcAccounts.find(a => a.id === bill.serviceAccountId);
        const name = acct?.name ?? 'Servicio';
        const notifKey = `service_due_${bill.id}`;

        if (!existing.some(n => n.id === notifKey)) {
          const dueDate = new Date(bill.dueDate);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          dueDate.setHours(0, 0, 0, 0);
          const daysRemaining = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

          await db.notifications.put({
            id: notifKey,
            type: 'service_due',
            title: daysRemaining <= 0 ? 'Servicio vencido' : 'Servicio por vencer',
            message: `${name}: ${formatCurrency(bill.amount)} ${daysRemaining <= 0 ? '(vencido)' : `vence en ${daysRemaining} día${daysRemaining !== 1 ? 's' : ''}`}`,
            severity: daysRemaining <= 0 ? 'critical' : 'warning',
            read: false,
            relatedPage: 'services',
            relatedId: bill.id,
            createdAt: now,
          });
          generated++;
        }
      }
    }

    // ── 3. Recurring Payment Pending ──
    if (settings.recurringPending) {
      const recurring = await db.recurringPayments.where('isActive').equals(1).toArray();
      const sDate = new Date(year, month - 1, 1).toISOString();
      const eDate = new Date(year, month, 0, 23, 59, 59, 999).toISOString();
      const allTx = await db.transactions.toArray();
      const mExpTx = allTx.filter(t => t.date >= sDate && t.date <= eDate && t.type === 'expense' && t.isRecurring);

      const paidNames = new Set(mExpTx.map(t => t.description));

      const dueThisMonth = recurring.filter(r => r.nextDueDate >= sDate && r.nextDueDate <= eDate);
      const pendingRecurring = dueThisMonth.filter(r => !paidNames.has(r.name));

      for (const rp of pendingRecurring) {
        const notifKey = `recurring_pending_${rp.id}_${month}_${year}`;
        if (!existing.some(n => n.id === notifKey)) {
          await db.notifications.put({
            id: notifKey,
            type: 'recurring_pending',
            title: 'Pago recurrente pendiente',
            message: `${rp.name}: ${formatCurrency(rp.amount)} pendiente este mes`,
            severity: 'info',
            read: false,
            relatedPage: 'recurring',
            relatedId: rp.id,
            createdAt: now,
          });
          generated++;
        }
      }
    }

    // ── 4. Negative Balance ──
    if (settings.negativeBalance) {
      const sDate = new Date(year, month - 1, 1).toISOString();
      const eDate = new Date(year, month, 0, 23, 59, 59, 999).toISOString();
      const allTx = await db.transactions.toArray();
      const mTx = allTx.filter(t => t.date >= sDate && t.date <= eDate);
      const income = mTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const expenses = mTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      const balance = income - expenses;

      if (balance < 0) {
        const notifKey = `negative_balance_${month}_${year}`;
        if (!existing.some(n => n.id === notifKey)) {
          await db.notifications.put({
            id: notifKey,
            type: 'negative_balance',
            title: 'Balance negativo',
            message: `El balance de ${formatCurrency(balance)} es negativo este mes. Los gastos superan los ingresos.`,
            severity: 'critical',
            read: false,
            relatedPage: 'dashboard',
            createdAt: now,
          });
          generated++;
        }
      }
    }

    // ── 5. Savings Goal Reached ──
    if (settings.savingsGoalReached) {
      const goals = await db.savingsGoals.toArray();
      for (const goal of goals) {
        if (goal.currentAmount >= goal.targetAmount && goal.targetAmount > 0) {
          const notifKey = `savings_reached_${goal.id}`;
          if (!existing.some(n => n.id === notifKey)) {
            await db.notifications.put({
              id: notifKey,
              type: 'savings_goal_reached',
              title: '¡Meta de ahorro alcanzada! 🎉',
              message: `${goal.name}: ahorrado ${formatCurrency(goal.currentAmount)} de ${formatCurrency(goal.targetAmount)}`,
              severity: 'success',
              read: false,
              relatedPage: 'savings',
              relatedId: goal.id,
              createdAt: now,
            });
            generated++;
          }
        }
      }
    }

    // Send browser notifications for new alerts
    if (settings.browserNotifications && generated > 0 && typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        const newNotifs = await db.notifications.where('read').equals(0).limit(3).toArray();
        for (const n of newNotifs) {
          new Notification(n.title, { body: n.message, icon: '/finanzas/logo.svg' });
        }
      }
    }

    return generated;
  },
};
