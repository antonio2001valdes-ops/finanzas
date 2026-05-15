import { db, generateId, nowISO, type Transaction } from '@/lib/db-client';

export interface TransactionFilters {
  month?: number;
  year?: number;
  type?: string;
  accountId?: string;
  categoryId?: string;
  categoryType?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface TransactionListResult {
  data: Transaction[];
  total: number;
}

export const transactionService = {
  async getAll(filters?: TransactionFilters): Promise<TransactionListResult> {
    let collection = db.transactions.orderBy('date').reverse();

    let results = await collection.toArray();

    // Apply filters
    if (filters) {
      if (filters.month !== undefined && filters.year !== undefined) {
        const startDate = new Date(filters.year, filters.month - 1, 1).toISOString();
        const endDate = new Date(filters.year, filters.month, 0, 23, 59, 59, 999).toISOString();
        results = results.filter((t) => t.date >= startDate && t.date <= endDate);
      }

      if (filters.type) {
        results = results.filter((t) => t.type === filters.type);
      }

      if (filters.accountId) {
        results = results.filter((t) => t.accountId === filters.accountId);
      }

      if (filters.categoryId) {
        results = results.filter((t) => t.categoryId === filters.categoryId);
      }

      if (filters.categoryType) {
        results = results.filter((t) => t.categoryType === filters.categoryType);
      }

      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        results = results.filter(
          (t) =>
            t.description?.toLowerCase().includes(searchLower) ||
            t.notes?.toLowerCase().includes(searchLower)
        );
      }
    }

    const total = results.length;

    // Pagination
    if (filters?.page && filters?.pageSize) {
      const start = (filters.page - 1) * filters.pageSize;
      results = results.slice(start, start + filters.pageSize);
    }

    return { data: results, total };
  },

  async create(data: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>): Promise<Transaction> {
    // Auto-categorize using rules if no category is set
    let categoryType = data.categoryType;
    let categoryId = data.categoryId;

    if (!categoryId && data.description) {
      // Use orderBy('priority') instead of .where('isActive') because
      // isActive is not an indexed keyPath in the current schema
      const rules = await db.categorizationRules.orderBy('priority').toArray();

      for (const rule of rules) {
        if (!rule.isActive) continue;
        const pattern = new RegExp(rule.descriptionPattern, 'i');
        if (pattern.test(data.description)) {
          categoryType = rule.categoryType;
          categoryId = rule.categoryId;
          break;
        }
      }
    }

    const transaction: Transaction = {
      ...data,
      categoryType,
      categoryId,
      id: generateId(),
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };

    await db.transaction('rw', [db.transactions, db.accounts], async () => {
      await db.transactions.add(transaction);

      // Update account balance
      if (transaction.accountId) {
        const account = await db.accounts.get(transaction.accountId);
        if (account) {
          const delta =
            transaction.type === 'income'
              ? transaction.amount
              : transaction.type === 'expense'
                ? -transaction.amount
                : 0;
          await db.accounts.update(transaction.accountId, {
            balance: account.balance + delta,
            updatedAt: nowISO(),
          });
        }
      }
    });

    return transaction;
  },

  async update(id: string, data: Partial<Transaction>): Promise<void> {
    await db.transaction('rw', [db.transactions, db.accounts], async () => {
      const oldTransaction = await db.transactions.get(id);
      if (!oldTransaction) throw new Error('Transacción no encontrada');

      // Revert old account balance
      if (oldTransaction.accountId) {
        const oldAccount = await db.accounts.get(oldTransaction.accountId);
        if (oldAccount) {
          const oldDelta =
            oldTransaction.type === 'income'
              ? -oldTransaction.amount
              : oldTransaction.type === 'expense'
                ? oldTransaction.amount
                : 0;
          await db.accounts.update(oldTransaction.accountId, {
            balance: oldAccount.balance + oldDelta,
            updatedAt: nowISO(),
          });
        }
      }

      // Apply new data
      const updatedTransaction: Transaction = {
        ...oldTransaction,
        ...data,
        updatedAt: nowISO(),
      };
      await db.transactions.put(updatedTransaction);

      // Apply new account balance
      if (updatedTransaction.accountId) {
        const newAccount = await db.accounts.get(updatedTransaction.accountId);
        if (newAccount) {
          const newDelta =
            updatedTransaction.type === 'income'
              ? updatedTransaction.amount
              : updatedTransaction.type === 'expense'
                ? -updatedTransaction.amount
                : 0;
          await db.accounts.update(updatedTransaction.accountId, {
            balance: newAccount.balance + newDelta,
            updatedAt: nowISO(),
          });
        }
      }
    });
  },

  async delete(id: string): Promise<void> {
    await db.transaction('rw', [db.transactions, db.accounts], async () => {
      const transaction = await db.transactions.get(id);
      if (!transaction) return;

      // Revert account balance
      if (transaction.accountId) {
        const account = await db.accounts.get(transaction.accountId);
        if (account) {
          const delta =
            transaction.type === 'income'
              ? -transaction.amount
              : transaction.type === 'expense'
                ? transaction.amount
                : 0;
          await db.accounts.update(transaction.accountId, {
            balance: account.balance + delta,
            updatedAt: nowISO(),
          });
        }
      }

      await db.transactions.delete(id);
    });
  },
};
