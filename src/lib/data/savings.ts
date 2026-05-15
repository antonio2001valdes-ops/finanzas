import { db, generateId, nowISO, type SavingsGoal, type SavingsMovement } from '@/lib/db-client';
import { transactionService } from './transactions';

export const savingsService = {
  async getAll(): Promise<SavingsGoal[]> {
    return db.savingsGoals.orderBy('name').toArray();
  },

  async create(data: Omit<SavingsGoal, 'id' | 'createdAt' | 'updatedAt'>): Promise<SavingsGoal> {
    const goal: SavingsGoal = {
      ...data,
      id: generateId(),
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };
    await db.savingsGoals.add(goal);
    return goal;
  },

  async update(id: string, data: Partial<SavingsGoal>): Promise<void> {
    await db.savingsGoals.update(id, {
      ...data,
      updatedAt: nowISO(),
    });
  },

  async delete(id: string): Promise<void> {
    await db.transaction('rw', [db.savingsGoals, db.savingsMovements, db.transactions, db.accounts], async () => {
      // Find and revert transactions linked to this goal's movements
      const movements = await db.savingsMovements.where('savingsGoalId').equals(id).toArray();
      for (const movement of movements) {
        const linkedTx = await db.transactions.toArray();
        const txToDelete = linkedTx.find((t) => t.sourceSavingsMovementId === movement.id);
        if (txToDelete) {
          // Restore account balance
          if (txToDelete.accountId) {
            const acct = await db.accounts.get(txToDelete.accountId);
            if (acct) {
              const delta = txToDelete.type === 'expense' ? txToDelete.amount : -txToDelete.amount;
              await db.accounts.update(txToDelete.accountId, {
                balance: acct.balance + delta,
                updatedAt: nowISO(),
              });
            }
          }
          await db.transactions.delete(txToDelete.id);
        }
      }
      await db.savingsMovements.where('savingsGoalId').equals(id).delete();
      await db.savingsGoals.delete(id);
    });
  },

  async addMovement(
    goalId: string,
    amount: number,
    type: 'deposit' | 'withdraw',
    accountId: string,
    description?: string
  ): Promise<SavingsMovement> {
    if (amount <= 0) throw new Error('El monto debe ser mayor a 0');

    // Validate account balance for deposits
    const account = await db.accounts.get(accountId);
    if (!account) throw new Error('Cuenta no encontrada');

    if (type === 'deposit') {
      if (account.balance < amount) {
        throw new Error(`Saldo insuficiente. Disponible: $${account.balance.toLocaleString('es-CL')}, Monto: $${amount.toLocaleString('es-CL')}`);
      }
    }

    // Validate goal balance for withdrawals
    if (type === 'withdraw') {
      const goal = await db.savingsGoals.get(goalId);
      if (goal && amount > goal.currentAmount) {
        throw new Error(`No puedes retirar más de lo disponible ($${goal.currentAmount.toLocaleString('es-CL')})`);
      }
    }

    const movementId = generateId();
    const movement: SavingsMovement = {
      id: movementId,
      savingsGoalId: goalId,
      amount,
      type,
      description,
      createdAt: nowISO(),
    };

    // Update savings goal current amount
    await db.transaction('rw', [db.savingsMovements, db.savingsGoals], async () => {
      await db.savingsMovements.add(movement);

      const goal = await db.savingsGoals.get(goalId);
      if (goal) {
        const delta = type === 'deposit' ? amount : -amount;
        await db.savingsGoals.update(goalId, {
          currentAmount: goal.currentAmount + delta,
          updatedAt: nowISO(),
        });
      }
    });

    // Create transaction to update account balance
    const goal = await db.savingsGoals.get(goalId);
    if (type === 'deposit') {
      // Deposit to savings = expense from account (money leaves the account)
      await transactionService.create({
        type: 'expense',
        amount,
        description: `Ahorro: ${goal?.name ?? 'Meta'}${description ? ` - ${description}` : ''}`,
        categoryType: 'expense',
        accountId,
        isRecurring: false,
        tags: 'ahorro',
        sourceSavingsMovementId: movementId,
        date: nowISO(),
      });
    } else {
      // Withdraw from savings = income to account (money returns to the account)
      await transactionService.create({
        type: 'income',
        amount,
        description: `Retiro ahorro: ${goal?.name ?? 'Meta'}${description ? ` - ${description}` : ''}`,
        categoryType: 'income',
        accountId,
        isRecurring: false,
        tags: 'ahorro',
        sourceSavingsMovementId: movementId,
        date: nowISO(),
      });
    }

    return movement;
  },
};
