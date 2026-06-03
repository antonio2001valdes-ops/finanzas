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
      initialBalance: data.initialBalance ?? data.balance,
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

  /**
   * Recalculates the balance of an account from its initialBalance + all transaction deltas.
   * This is the source of truth for balance reconciliation.
   *
   * Formula: balance = initialBalance + sum(income) - sum(expense) + sum(transfer_in) - sum(transfer_out)
   *
   * For transfer transactions, we look up the AccountTransfer table to determine direction.
   */
  async recalculateBalance(accountId: string): Promise<number> {
    const account = await db.accounts.get(accountId);
    if (!account) throw new Error('Cuenta no encontrada');

    const initialBalance = account.initialBalance ?? account.balance;

    // Get all transactions for this account
    const transactions = await db.transactions
      .where('accountId')
      .equals(accountId)
      .toArray();

    let delta = 0;

    for (const tx of transactions) {
      if (tx.type === 'income') {
        delta += tx.amount;
      } else if (tx.type === 'expense') {
        delta -= tx.amount;
      } else if (tx.type === 'transfer') {
        // For transfers, check direction via AccountTransfer table
        // If this account is the "from" account, it's a debit (-)
        // If this account is the "to" account, it's a credit (+)
        const transferOut = await db.accountTransfers
          .where('fromAccountId')
          .equals(accountId)
          .toArray();
        const transferIn = await db.accountTransfers
          .where('toAccountId')
          .equals(accountId)
          .toArray();

        // Check if this transaction's date/time matches a known transfer
        const isOutgoing = transferOut.some(
          (t) => t.amount === tx.amount && Math.abs(new Date(t.createdAt).getTime() - new Date(tx.createdAt).getTime()) < 5000
        );
        const isIncoming = transferIn.some(
          (t) => t.amount === tx.amount && Math.abs(new Date(t.createdAt).getTime() - new Date(tx.createdAt).getTime()) < 5000
        );

        if (isOutgoing) {
          delta -= tx.amount;
        } else if (isIncoming) {
          delta += tx.amount;
        }
      }
    }

    const newBalance = initialBalance + delta;

    await db.accounts.update(accountId, {
      balance: newBalance,
      updatedAt: nowISO(),
    });

    return newBalance;
  },

  /**
   * Recalculates balances for ALL accounts. Useful as a "fix all" utility.
   */
  async recalculateAllBalances(): Promise<void> {
    const accounts = await db.accounts.toArray();
    for (const account of accounts) {
      await this.recalculateBalance(account.id);
    }
  },

  /**
   * Updates the initialBalance of an account and recalculates the actual balance.
   * This is the correct way to handle manual balance edits.
   */
  async updateInitialBalance(accountId: string, newInitialBalance: number): Promise<number> {
    await db.accounts.update(accountId, {
      initialBalance: newInitialBalance,
      updatedAt: nowISO(),
    });
    return this.recalculateBalance(accountId);
  },
};
