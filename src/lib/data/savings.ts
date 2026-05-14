import { db, generateId, nowISO, type SavingsGoal, type SavingsMovement } from '@/lib/db-client';

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
    await db.transaction('rw', [db.savingsGoals, db.savingsMovements], async () => {
      await db.savingsMovements.where('savingsGoalId').equals(id).delete();
      await db.savingsGoals.delete(id);
    });
  },

  async addMovement(
    goalId: string,
    amount: number,
    type: 'deposit' | 'withdraw',
    description?: string
  ): Promise<SavingsMovement> {
    const movement: SavingsMovement = {
      id: generateId(),
      savingsGoalId: goalId,
      amount,
      type,
      description,
      createdAt: nowISO(),
    };

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

    return movement;
  },
};
