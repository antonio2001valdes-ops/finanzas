import { db, generateId, nowISO, type ServiceAccount, type ServiceBill, type Transaction } from '@/lib/db-client';
import { transactionService } from './transactions';

export const serviceService = {
  async getAllAccounts(): Promise<ServiceAccount[]> {
    return db.serviceAccounts.orderBy('name').toArray();
  },

  async createAccount(data: Omit<ServiceAccount, 'id' | 'createdAt' | 'updatedAt'>): Promise<ServiceAccount> {
    const account: ServiceAccount = {
      ...data,
      id: generateId(),
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };
    await db.serviceAccounts.add(account);
    return account;
  },

  async updateAccount(id: string, data: Partial<ServiceAccount>): Promise<void> {
    await db.serviceAccounts.update(id, {
      ...data,
      updatedAt: nowISO(),
    });
  },

  async deleteAccount(id: string): Promise<void> {
    await db.transaction('rw', [db.serviceAccounts, db.serviceBills, db.transactions], async () => {
      // Find and delete transactions linked to this account's bills
      const bills = await db.serviceBills.where('serviceAccountId').equals(id).toArray();
      for (const bill of bills) {
        if (bill.paid) {
          // Find the transaction linked to this bill
          const linkedTx = await db.transactions.where('type').equals('expense').toArray();
          const txToDelete = linkedTx.find((t) => t.sourceBillId === bill.id);
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
      }
      await db.serviceBills.where('serviceAccountId').equals(id).delete();
      await db.serviceAccounts.delete(id);
    });
  },

  async getBills(accountId: string): Promise<ServiceBill[]> {
    return db.serviceBills
      .where('serviceAccountId')
      .equals(accountId)
      .sortBy('dueDate');
  },

  async createBill(data: Omit<ServiceBill, 'id' | 'createdAt'>): Promise<ServiceBill> {
    const bill: ServiceBill = {
      ...data,
      id: generateId(),
      createdAt: nowISO(),
    };
    await db.serviceBills.add(bill);
    return bill;
  },

  async updateBill(id: string, data: Partial<ServiceBill>): Promise<void> {
    await db.serviceBills.update(id, data);
  },

  async deleteBill(id: string): Promise<void> {
    // If bill was paid, reverse the linked transaction
    const bill = await db.serviceBills.get(id);
    if (bill?.paid) {
      const allTransactions = await db.transactions.toArray();
      const linkedTx = allTransactions.find((t) => t.sourceBillId === id);
      if (linkedTx) {
        await transactionService.delete(linkedTx.id);
      }
    }
    await db.serviceBills.delete(id);
  },

  async payBill(billId: string, accountId: string): Promise<void> {
    const bill = await db.serviceBills.get(billId);
    if (!bill) throw new Error('Boleta no encontrada');

    // Validate account balance
    const account = await db.accounts.get(accountId);
    if (!account) throw new Error('Cuenta no encontrada');
    if (account.balance < bill.amount) {
      throw new Error(`Saldo insuficiente. Disponible: $${account.balance.toLocaleString('es-CL')}, Monto: $${bill.amount.toLocaleString('es-CL')}`);
    }

    const serviceAccount = await db.serviceAccounts.get(bill.serviceAccountId);

    // Use transactionService.create() which updates account balance automatically
    await transactionService.create({
      type: 'expense',
      amount: bill.amount,
      description: `Servicio: ${serviceAccount?.name ?? 'Desconocido'}`,
      categoryType: 'expense',
      categoryId: serviceAccount?.categoryId,
      accountId,
      isRecurring: false,
      sourceBillId: billId,
      date: nowISO(),
    });

    // Mark bill as paid
    await db.serviceBills.update(billId, {
      paid: true,
      paidDate: nowISO(),
    });
  },

  async unpayBill(billId: string): Promise<void> {
    const bill = await db.serviceBills.get(billId);
    if (!bill) throw new Error('Boleta no encontrada');

    // Find the transaction linked to this bill via sourceBillId
    const allTransactions = await db.transactions.toArray();
    const linkedTx = allTransactions.find((t) => t.sourceBillId === billId);

    if (linkedTx) {
      // Use transactionService.delete() which restores account balance automatically
      await transactionService.delete(linkedTx.id);
    }

    // Mark bill as unpaid
    await db.serviceBills.update(billId, {
      paid: false,
      paidDate: undefined,
    });
  },
};
