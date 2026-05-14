import { db, generateId, nowISO, type Debt, type DebtPayment } from '@/lib/db-client';
import { transactionService } from './transactions';

export const debtService = {
  async getAll(): Promise<Debt[]> {
    const debts = await db.debts.toArray();
    return debts.sort((a, b) => a.name.localeCompare(b.name));
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
    await db.transaction('rw', [db.debts, db.debtPayments, db.transactions, db.accounts], async () => {
      // Find and revert transactions linked to this debt's payments
      const payments = await db.debtPayments.where('debtId').equals(id).toArray();
      for (const payment of payments) {
        const linkedTx = await db.transactions.toArray();
        const txToDelete = linkedTx.find((t) => t.sourceDebtPaymentId === payment.id);
        if (txToDelete) {
          // Restore account balance
          if (txToDelete.accountId) {
            const acct = await db.accounts.get(txToDelete.accountId);
            if (acct) {
              await db.accounts.update(txToDelete.accountId, {
                balance: acct.balance + txToDelete.amount,
                updatedAt: nowISO(),
              });
            }
          }
          await db.transactions.delete(txToDelete.id);
        }
      }
      await db.debtPayments.where('debtId').equals(id).delete();
      await db.debts.delete(id);
    });
  },

  async addPayment(debtId: string, amount: number, accountId: string, description?: string): Promise<DebtPayment> {
    const debt = await db.debts.get(debtId);
    if (!debt) throw new Error('Deuda no encontrada');

    // Validate payment amount
    if (amount <= 0) throw new Error('El monto debe ser mayor a 0');
    if (amount > debt.remainingAmount) {
      throw new Error(`El monto excede la deuda restante ($${debt.remainingAmount.toLocaleString('es-CL')})`);
    }

    // Validate account balance
    const account = await db.accounts.get(accountId);
    if (!account) throw new Error('Cuenta no encontrada');
    if (account.balance < amount) {
      throw new Error(`Saldo insuficiente. Disponible: $${account.balance.toLocaleString('es-CL')}, Monto: $${amount.toLocaleString('es-CL')}`);
    }

    const paymentId = generateId();
    const payment: DebtPayment = {
      id: paymentId,
      debtId,
      amount,
      description,
      createdAt: nowISO(),
    };

    // Create debt payment record and update debt
    await db.transaction('rw', [db.debtPayments, db.debts], async () => {
      await db.debtPayments.add(payment);

      const currentDebt = await db.debts.get(debtId);
      if (currentDebt) {
        const newRemaining = currentDebt.remainingAmount - amount;
        await db.debts.update(debtId, {
          remainingAmount: Math.max(0, newRemaining),
          status: newRemaining <= 0 ? 'paid' : 'active',
          updatedAt: nowISO(),
        });
      }
    });

    // Create expense transaction (updates account balance automatically)
    await transactionService.create({
      type: 'expense',
      amount,
      description: `Deuda: ${debt.name}${description ? ` - ${description}` : ''}`,
      categoryType: 'expense',
      accountId,
      isRecurring: false,
      tags: 'deuda',
      sourceDebtPaymentId: paymentId,
      date: nowISO(),
    });

    return payment;
  },

  async deletePayment(paymentId: string): Promise<void> {
    const payment = await db.debtPayments.get(paymentId);
    if (!payment) return;

    // Find and delete the linked transaction (restores account balance)
    const allTransactions = await db.transactions.toArray();
    const linkedTx = allTransactions.find((t) => t.sourceDebtPaymentId === paymentId);
    if (linkedTx) {
      await transactionService.delete(linkedTx.id);
    }

    // Restore debt remaining amount
    await db.transaction('rw', [db.debtPayments, db.debts], async () => {
      const debt = await db.debts.get(payment.debtId);
      if (debt) {
        await db.debts.update(payment.debtId, {
          remainingAmount: debt.remainingAmount + payment.amount,
          status: 'active',
          updatedAt: nowISO(),
        });
      }
      await db.debtPayments.delete(paymentId);
    });
  },
};
