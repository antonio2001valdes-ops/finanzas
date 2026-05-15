import { db, clearAllData } from '@/lib/db-client';

export const backupService = {
  async export(): Promise<string> {
    const data = {
      incomeCategories: await db.incomeCategories.toArray(),
      expenseCategories: await db.expenseCategories.toArray(),
      accounts: await db.accounts.toArray(),
      transactions: await db.transactions.toArray(),
      budgets: await db.budgets.toArray(),
      savingsGoals: await db.savingsGoals.toArray(),
      savingsMovements: await db.savingsMovements.toArray(),
      debts: await db.debts.toArray(),
      debtPayments: await db.debtPayments.toArray(),
      recurringPayments: await db.recurringPayments.toArray(),
      serviceAccounts: await db.serviceAccounts.toArray(),
      serviceBills: await db.serviceBills.toArray(),
      accountTransfers: await db.accountTransfers.toArray(),
      categorizationRules: await db.categorizationRules.toArray(),
      schemaVersions: await db.schemaVersions.toArray(),
      exportedAt: new Date().toISOString(),
      version: '3.2.0',
    };
    return JSON.stringify(data, null, 2);
  },

  async restore(jsonString: string): Promise<void> {
    const data = JSON.parse(jsonString);

    await clearAllData();

    await db.transaction(
      'rw',
      [
        db.incomeCategories,
        db.expenseCategories,
        db.accounts,
        db.transactions,
        db.budgets,
        db.savingsGoals,
        db.savingsMovements,
        db.debts,
        db.debtPayments,
        db.recurringPayments,
        db.serviceAccounts,
        db.serviceBills,
        db.accountTransfers,
        db.categorizationRules,
        db.schemaVersions,
      ],
      async () => {
        if (data.incomeCategories?.length) await db.incomeCategories.bulkAdd(data.incomeCategories);
        if (data.expenseCategories?.length) await db.expenseCategories.bulkAdd(data.expenseCategories);
        if (data.accounts?.length) await db.accounts.bulkAdd(data.accounts);
        if (data.transactions?.length) await db.transactions.bulkAdd(data.transactions);
        if (data.budgets?.length) await db.budgets.bulkAdd(data.budgets);
        if (data.savingsGoals?.length) await db.savingsGoals.bulkAdd(data.savingsGoals);
        if (data.savingsMovements?.length) await db.savingsMovements.bulkAdd(data.savingsMovements);
        if (data.debts?.length) await db.debts.bulkAdd(data.debts);
        if (data.debtPayments?.length) await db.debtPayments.bulkAdd(data.debtPayments);
        if (data.recurringPayments?.length) await db.recurringPayments.bulkAdd(data.recurringPayments);
        if (data.serviceAccounts?.length) await db.serviceAccounts.bulkAdd(data.serviceAccounts);
        if (data.serviceBills?.length) await db.serviceBills.bulkAdd(data.serviceBills);
        if (data.accountTransfers?.length) await db.accountTransfers.bulkAdd(data.accountTransfers);
        if (data.categorizationRules?.length) await db.categorizationRules.bulkAdd(data.categorizationRules);
        if (data.schemaVersions?.length) await db.schemaVersions.bulkAdd(data.schemaVersions);
      }
    );
  },
};
