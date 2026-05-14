import { db, generateId, nowISO, type ServiceAccount, type ServiceBill } from '@/lib/db-client';

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
    await db.transaction('rw', [db.serviceAccounts, db.serviceBills], async () => {
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

  async payBill(billId: string): Promise<void> {
    await db.transaction('rw', [db.serviceBills, db.transactions, db.accounts, db.serviceAccounts], async () => {
      const bill = await db.serviceBills.get(billId);
      if (!bill) throw new Error('Boleta no encontrada');

      // Create expense transaction
      const serviceAccount = await db.serviceAccounts.get(bill.serviceAccountId);
      const transaction = {
        id: generateId(),
        type: 'expense',
        amount: bill.amount,
        description: `Servicio: ${serviceAccount?.name ?? 'Desconocido'}`,
        categoryType: 'expense' as const,
        categoryId: serviceAccount?.categoryId,
        isRecurring: false,
        date: nowISO(),
        createdAt: nowISO(),
        updatedAt: nowISO(),
      };

      await db.transactions.add(transaction);

      // Mark bill as paid
      await db.serviceBills.update(billId, {
        paid: true,
        paidDate: nowISO(),
      });
    });
  },

  async unpayBill(billId: string): Promise<void> {
    await db.transaction('rw', [db.serviceBills, db.transactions, db.serviceAccounts], async () => {
      const bill = await db.serviceBills.get(billId);
      if (!bill) throw new Error('Boleta no encontrada');

      // Find and delete the associated transaction
      const serviceAccount = await db.serviceAccounts.get(bill.serviceAccountId);
      const description = `Servicio: ${serviceAccount?.name ?? 'Desconocido'}`;

      const matchingTransactions = await db.transactions
        .where('type')
        .equals('expense')
        .toArray();

      const transactionToDelete = matchingTransactions.find(
        (t) =>
          t.description === description &&
          t.amount === bill.amount &&
          t.date === bill.paidDate
      );

      if (transactionToDelete) {
        await db.transactions.delete(transactionToDelete.id);
      }

      // Mark bill as unpaid
      await db.serviceBills.update(billId, {
        paid: false,
        paidDate: undefined,
      });
    });
  },
};
