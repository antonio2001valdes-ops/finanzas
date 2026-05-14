import { db, generateId, nowISO, type Budget } from '@/lib/db-client';

export interface BudgetWithSpent extends Budget {
  spent: number;
  categoryName?: string;
  categoryIcon?: string;
  categoryColor?: string;
}

export const budgetService = {
  async getAll(month?: number, year?: number): Promise<BudgetWithSpent[]> {
    let collection = db.budgets.toCollection();
    let budgets = await collection.toArray();

    if (month !== undefined) {
      budgets = budgets.filter((b) => b.month === month);
    }
    if (year !== undefined) {
      budgets = budgets.filter((b) => b.year === year);
    }

    // Calculate spent for each budget
    const budgetWithSpent: BudgetWithSpent[] = await Promise.all(
      budgets.map(async (budget) => {
        const category = await db.expenseCategories.get(budget.categoryId);
        const startDate = new Date(budget.year, budget.month - 1, 1).toISOString();
        const endDate = new Date(budget.year, budget.month, 0, 23, 59, 59, 999).toISOString();

        const transactions = await db.transactions
          .where('[categoryType+categoryId]')
          .equals(['expense', budget.categoryId])
          .toArray();

        const spent = transactions
          .filter((t) => t.date >= startDate && t.date <= endDate)
          .reduce((sum, t) => sum + t.amount, 0);

        return {
          ...budget,
          spent,
          categoryName: category?.name,
          categoryIcon: category?.icon,
          categoryColor: category?.color,
        };
      })
    );

    return budgetWithSpent;
  },

  async upsert(data: Omit<Budget, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Budget> {
    // Check if budget exists for this category/month/year
    const existing = await db.budgets
      .where('[categoryId+month+year]')
      .equals([data.categoryId, data.month, data.year])
      .first();

    if (existing) {
      await db.budgets.update(existing.id, {
        amount: data.amount,
        updatedAt: nowISO(),
      });
      return (await db.budgets.get(existing.id))!;
    }

    const budget: Budget = {
      ...data,
      id: generateId(),
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };
    await db.budgets.add(budget);
    return budget;
  },

  async delete(id: string): Promise<void> {
    await db.budgets.delete(id);
  },
};
