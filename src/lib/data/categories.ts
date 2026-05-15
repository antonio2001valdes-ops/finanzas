import { db, generateId, nowISO, type IncomeCategory, type ExpenseCategory } from '@/lib/db-client';

function getAllCategories(): Promise<{ income: IncomeCategory[]; expense: ExpenseCategory[] }>;
function getAllCategories(type: 'income'): Promise<IncomeCategory[]>;
function getAllCategories(type: 'expense'): Promise<ExpenseCategory[]>;
function getAllCategories(
  type?: string
): Promise<IncomeCategory[] | ExpenseCategory[] | { income: IncomeCategory[]; expense: ExpenseCategory[] }> {
  if (type === 'income') {
    return db.incomeCategories.orderBy('name').toArray();
  }
  if (type === 'expense') {
    return db.expenseCategories.orderBy('name').toArray();
  }
  return Promise.all([
    db.incomeCategories.orderBy('name').toArray(),
    db.expenseCategories.orderBy('name').toArray(),
  ]).then(([income, expense]) => ({ income, expense }));
}

export const categoryService = {
  getAll: getAllCategories,

  async create(
    type: 'income' | 'expense',
    data: Omit<IncomeCategory, 'id' | 'createdAt' | 'updatedAt'> | Omit<ExpenseCategory, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<IncomeCategory | ExpenseCategory> {
    const now = nowISO();
    const id = generateId();

    if (type === 'income') {
      const category: IncomeCategory = {
        ...(data as Omit<IncomeCategory, 'id' | 'createdAt' | 'updatedAt'>),
        id,
        createdAt: now,
        updatedAt: now,
      };
      await db.incomeCategories.add(category);
      return category;
    } else {
      const category: ExpenseCategory = {
        ...(data as Omit<ExpenseCategory, 'id' | 'createdAt' | 'updatedAt'>),
        id,
        createdAt: now,
        updatedAt: now,
      };
      await db.expenseCategories.add(category);
      return category;
    }
  },

  async update(type: 'income' | 'expense', id: string, data: Partial<IncomeCategory | ExpenseCategory>): Promise<void> {
    const table = type === 'income' ? db.incomeCategories : db.expenseCategories;
    await table.update(id, {
      ...data,
      updatedAt: nowISO(),
    });
  },

  async delete(id: string, type: 'income' | 'expense'): Promise<void> {
    const table = type === 'income' ? db.incomeCategories : db.expenseCategories;
    await table.delete(id);
  },
};
