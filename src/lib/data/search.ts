import { db } from '@/lib/db-client';

export interface SearchResult {
  transactions: { id: string; description: string; type: string; amount: number; date: string }[];
  services: { id: string; name: string; provider: string; amount: number }[];
  recurring: { id: string; name: string; amount: number; nextDueDate: string }[];
  savingsGoals: { id: string; name: string; currentAmount: number; targetAmount: number }[];
  debts: { id: string; name: string; creditor: string; remainingAmount: number }[];
  accounts: { id: string; name: string; type: string; balance: number }[];
}

export const searchService = {
  async search(query: string): Promise<SearchResult> {
    const q = query.toLowerCase();
    if (!q.trim()) {
      return {
        transactions: [],
        services: [],
        recurring: [],
        savingsGoals: [],
        debts: [],
        accounts: [],
      };
    }

    const [
      allTransactions,
      allServiceAccounts,
      allRecurring,
      allSavingsGoals,
      allDebts,
      allAccounts,
    ] = await Promise.all([
      db.transactions.toArray(),
      db.serviceAccounts.toArray(),
      db.recurringPayments.toArray(),
      db.savingsGoals.toArray(),
      db.debts.toArray(),
      db.accounts.toArray(),
    ]);

    const transactions = allTransactions
      .filter(
        (t) =>
          t.description?.toLowerCase().includes(q) ||
          t.notes?.toLowerCase().includes(q) ||
          t.tags?.toLowerCase().includes(q)
      )
      .map((t) => ({
        id: t.id,
        description: t.description,
        type: t.type,
        amount: t.amount,
        date: t.date,
      }))
      .slice(0, 20);

    const services = allServiceAccounts
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.provider.toLowerCase().includes(q) ||
          s.notes?.toLowerCase().includes(q)
      )
      .map((s) => ({
        id: s.id,
        name: s.name,
        provider: s.provider,
        amount: s.amount,
      }))
      .slice(0, 20);

    const recurring = allRecurring
      .filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.description?.toLowerCase().includes(q)
      )
      .map((r) => ({
        id: r.id,
        name: r.name,
        amount: r.amount,
        nextDueDate: r.nextDueDate,
      }))
      .slice(0, 20);

    const savingsGoals = allSavingsGoals
      .filter((s) => s.name.toLowerCase().includes(q))
      .map((s) => ({
        id: s.id,
        name: s.name,
        currentAmount: s.currentAmount,
        targetAmount: s.targetAmount,
      }))
      .slice(0, 20);

    const debts = allDebts
      .filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.creditor.toLowerCase().includes(q)
      )
      .map((d) => ({
        id: d.id,
        name: d.name,
        creditor: d.creditor,
        remainingAmount: d.remainingAmount,
      }))
      .slice(0, 20);

    const accounts = allAccounts
      .filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.notes?.toLowerCase().includes(q)
      )
      .map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        balance: a.balance,
      }))
      .slice(0, 20);

    return { transactions, services, recurring, savingsGoals, debts, accounts };
  },
};
