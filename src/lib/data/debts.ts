import { db, generateId, nowISO, type Debt, type DebtPayment } from '@/lib/db-client';

export const debtService = {
  async getAll(): Promise<Debt[]> {
    return db.debts.orderBy('name').toArray();
  },

  async create(data: Omit<Debt, 'id' | 'createdAt' | 'updatedAt'>): Promise<Debt> {
    const debt: Debt = {
      ...data,
      id: generateId(),
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };
    await db.debts.add(debt);
    return debt;
  },

  async update(id: string, data: Partial<Debt>): Promise<void> {
    await db.debts.update(id, {
      ...data,
      updatedAt: nowISO(),
    });
  },

  async delete(id: string): Promise<void> {
    await db.transaction('rw', [db.debts, db.debtPayments], async () => {
      await db.debtPayments.where('debtId').equals(id).delete();
      await db.debts.delete(id);
    });
  },

  async addPayment(debtId: string, amount: number, description?: string): Promise<DebtPayment> {
    const payment: DebtPayment = {
      id: generateId(),
      debtId,
      amount,
      description,
      createdAt: nowISO(),
    };

    await db.transaction('rw', [db.debtPayments, db.debts], async () => {
      await db.debtPayments.add(payment);

      const debt = await db.debts.get(debtId);
      if (debt) {
        const newRemaining = debt.remainingAmount - amount;
        await db.debts.update(debtId, {
          remainingAmount: Math.max(0, newRemaining),
          status: newRemaining <= 0 ? 'paid' : 'active',
          updatedAt: nowISO(),
        });
      }
    });

    return payment;
  },
};
