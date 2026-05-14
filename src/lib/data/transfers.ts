import { db, generateId, nowISO, type AccountTransfer } from '@/lib/db-client';

export const transferService = {
  async create(
    fromAccountId: string,
    toAccountId: string,
    amount: number,
    description?: string
  ): Promise<AccountTransfer> {
    if (fromAccountId === toAccountId) {
      throw new Error('Las cuentas de origen y destino no pueden ser iguales');
    }

    const transfer: AccountTransfer = {
      id: generateId(),
      fromAccountId,
      toAccountId,
      amount,
      description,
      createdAt: nowISO(),
    };

    await db.transaction('rw', [db.accountTransfers, db.accounts, db.transactions], async () => {
      const fromAccount = await db.accounts.get(fromAccountId);
      const toAccount = await db.accounts.get(toAccountId);

      if (!fromAccount) throw new Error('Cuenta de origen no encontrada');
      if (!toAccount) throw new Error('Cuenta de destino no encontrada');

      if (fromAccount.balance < amount) {
        throw new Error('Saldo insuficiente en la cuenta de origen');
      }

      // Decrement fromAccount
      await db.accounts.update(fromAccountId, {
        balance: fromAccount.balance - amount,
        updatedAt: nowISO(),
      });

      // Increment toAccount
      await db.accounts.update(toAccountId, {
        balance: toAccount.balance + amount,
        updatedAt: nowISO(),
      });

      // Create two transfer transactions
      const transferOut = {
        id: generateId(),
        type: 'transfer',
        amount,
        description: description ?? `Transferencia a ${toAccount.name}`,
        accountId: fromAccountId,
        isRecurring: false,
        date: nowISO(),
        createdAt: nowISO(),
        updatedAt: nowISO(),
      };

      const transferIn = {
        id: generateId(),
        type: 'transfer',
        amount,
        description: description ?? `Transferencia desde ${fromAccount.name}`,
        accountId: toAccountId,
        isRecurring: false,
        date: nowISO(),
        createdAt: nowISO(),
        updatedAt: nowISO(),
      };

      await db.transactions.bulkAdd([transferOut, transferIn]);
      await db.accountTransfers.add(transfer);
    });

    return transfer;
  },
};
