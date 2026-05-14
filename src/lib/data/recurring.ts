import { db, generateId, nowISO, type RecurringPayment, type Transaction } from '@/lib/db-client';
import { transactionService } from './transactions';

function calculateNextDueDate(dueDay: number, interval: string): string {
  const now = new Date();
  let nextDate: Date;

  if (interval === 'monthly') {
    // Use noon (12:00 local) to avoid timezone offset shifting the date
    nextDate = new Date(now.getFullYear(), now.getMonth(), dueDay, 12, 0, 0);
    if (nextDate <= now) {
      nextDate = new Date(now.getFullYear(), now.getMonth() + 1, dueDay, 12, 0, 0);
    }
  } else if (interval === 'weekly') {
    nextDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
    nextDate.setDate(now.getDate() + (7 - now.getDay() + dueDay) % 7 || 7);
  } else if (interval === 'yearly') {
    // dueDay here represents the month number (1-12) for yearly payments
    nextDate = new Date(now.getFullYear(), dueDay - 1, 1, 12, 0, 0);
    if (nextDate <= now) {
      nextDate = new Date(now.getFullYear() + 1, dueDay - 1, 1, 12, 0, 0);
    }
  } else {
    nextDate = new Date(now.getFullYear(), now.getMonth(), dueDay, 12, 0, 0);
    if (nextDate <= now) {
      nextDate = new Date(now.getFullYear(), now.getMonth() + 1, dueDay, 12, 0, 0);
    }
  }

  return nextDate.toISOString();
}

function advanceNextDueDate(current: string, interval: string): string {
  const date = new Date(current);
  if (interval === 'monthly') {
    date.setMonth(date.getMonth() + 1);
  } else if (interval === 'weekly') {
    date.setDate(date.getDate() + 7);
  } else if (interval === 'yearly') {
    date.setFullYear(date.getFullYear() + 1);
  }
  return date.toISOString();
}

export const recurringService = {
  async getAll(): Promise<RecurringPayment[]> {
    // Recalculate nextDueDate for any active recurring payments that are past due
    const all = await db.recurringPayments.orderBy('nextDueDate').toArray();
    const now = new Date();
    for (const payment of all) {
      if (payment.isActive && new Date(payment.nextDueDate) <= now) {
        const nextDueDate = calculateNextDueDate(payment.dueDay, payment.interval);
        await db.recurringPayments.update(payment.id, { nextDueDate, updatedAt: nowISO() });
        // Update the in-memory object too
        payment.nextDueDate = nextDueDate;
      }
    }
    return all;
  },

  async create(data: Omit<RecurringPayment, 'id' | 'nextDueDate' | 'createdAt' | 'updatedAt'>): Promise<RecurringPayment> {
    const nextDueDate = calculateNextDueDate(data.dueDay, data.interval);

    const payment: RecurringPayment = {
      ...data,
      nextDueDate,
      id: generateId(),
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };
    await db.recurringPayments.add(payment);
    return payment;
  },

  async update(id: string, data: Partial<RecurringPayment>): Promise<void> {
    // If dueDay or interval changed, recalculate nextDueDate
    if (data.dueDay !== undefined || data.interval !== undefined) {
      const current = await db.recurringPayments.get(id);
      if (current) {
        const dueDay = data.dueDay ?? current.dueDay;
        const interval = data.interval ?? current.interval;
        data.nextDueDate = calculateNextDueDate(dueDay, interval);
      }
    }
    await db.recurringPayments.update(id, {
      ...data,
      updatedAt: nowISO(),
    });
  },

  async delete(id: string): Promise<void> {
    await db.recurringPayments.delete(id);
  },

  async pay(id: string, accountId: string): Promise<void> {
    const recurring = await db.recurringPayments.get(id);
    if (!recurring) throw new Error('Pago recurrente no encontrado');

    // Validate account balance
    const account = await db.accounts.get(accountId);
    if (!account) throw new Error('Cuenta no encontrada');
    if (account.balance < recurring.amount) {
      throw new Error(`Saldo insuficiente. Disponible: $${account.balance.toLocaleString('es-CL')}, Monto: $${recurring.amount.toLocaleString('es-CL')}`);
    }

    // Use transactionService.create() which updates account balance automatically
    await transactionService.create({
      type: 'expense',
      amount: recurring.amount,
      description: recurring.name,
      categoryType: 'expense',
      categoryId: recurring.categoryId,
      accountId,
      isRecurring: true,
      tags: 'recurrente',
      sourceRecurringId: id,
      date: nowISO(),
    });

    // Advance next due date
    const nextDueDate = advanceNextDueDate(recurring.nextDueDate, recurring.interval);
    await db.recurringPayments.update(id, {
      nextDueDate,
      updatedAt: nowISO(),
    });
  },

  async getPaymentHistory(recurringId: string): Promise<Transaction[]> {
    // Find all transactions linked to this recurring payment via sourceRecurringId
    const allTransactions = await db.transactions.toArray();
    return allTransactions
      .filter((t) => t.sourceRecurringId === recurringId)
      .sort((a, b) => b.date.localeCompare(a.date));
  },
};
