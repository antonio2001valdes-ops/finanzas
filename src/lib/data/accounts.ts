import { db, generateId, nowISO, type Account } from '@/lib/db-client';

export const accountService = {
  async getAll(): Promise<Account[]> {
    return db.accounts.orderBy('name').toArray();
  },

  async getById(id: string): Promise<Account | undefined> {
    return db.accounts.get(id);
  },

  async create(data: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>): Promise<Account> {
    const account: Account = {
      ...data,
      id: generateId(),
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };
    await db.accounts.add(account);
    return account;
  },

  async update(id: string, data: Partial<Account>): Promise<void> {
    await db.accounts.update(id, {
      ...data,
      updatedAt: nowISO(),
    });
  },

  async delete(id: string): Promise<void> {
    await db.accounts.delete(id);
  },
};
