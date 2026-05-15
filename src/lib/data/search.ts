import { db } from '@/lib/db-client';

export interface SearchMatch {
  id: string;
  label: string;         // Main text to display
  sublabel?: string;     // Secondary text (provider, creditor, etc.)
  amount?: number;       // Amount if relevant
  date?: string;         // Date if relevant
  page: string;          // Navigation target page
  pageLabel: string;     // Human-readable page name
  matchField: string;    // Which field matched (for highlighting context)
}

export interface SearchGroup {
  page: string;
  pageLabel: string;
  icon: string;          // Icon name for the group
  color: string;         // Neon color for the group
  results: SearchMatch[];
}

export const searchService = {
  async search(query: string): Promise<SearchGroup[]> {
    const q = query.toLowerCase().trim();
    if (!q) return [];

    const [
      allTransactions,
      allServiceAccounts,
      allRecurring,
      allSavingsGoals,
      allDebts,
      allAccounts,
      allExpenseCats,
      allIncomeCats,
      allBills,
      allBudgets,
    ] = await Promise.all([
      db.transactions.toArray(),
      db.serviceAccounts.toArray(),
      db.recurringPayments.toArray(),
      db.savingsGoals.toArray(),
      db.debts.toArray(),
      db.accounts.toArray(),
      db.expenseCategories.toArray(),
      db.incomeCategories.toArray(),
      db.serviceBills.toArray(),
      db.budgets.toArray(),
    ]);

    const groups: SearchGroup[] = [];

    // ─── Transacciones ────────────────────────────────────────
    const txMatches = allTransactions
      .filter((t) =>
        t.description?.toLowerCase().includes(q) ||
        t.notes?.toLowerCase().includes(q) ||
        t.tags?.toLowerCase().includes(q)
      )
      .map((t) => ({
        id: t.id,
        label: t.description || 'Sin descripción',
        amount: t.amount,
        date: t.date,
        page: 'transactions',
        pageLabel: 'Transacciones',
        matchField: t.description?.toLowerCase().includes(q) ? 'descripción'
          : t.notes?.toLowerCase().includes(q) ? 'notas'
          : 'etiquetas',
      }))
      .slice(0, 10);

    if (txMatches.length > 0) {
      groups.push({
        page: 'transactions',
        pageLabel: 'Transacciones',
        icon: 'ArrowLeftRight',
        color: '#05d9e8',
        results: txMatches,
      });
    }

    // ─── Cuentas ──────────────────────────────────────────────
    const acctMatches = allAccounts
      .filter((a) =>
        a.name.toLowerCase().includes(q) ||
        a.notes?.toLowerCase().includes(q) ||
        a.type.toLowerCase().includes(q)
      )
      .map((a) => ({
        id: a.id,
        label: `${a.icon} ${a.name}`,
        sublabel: a.type,
        amount: a.balance,
        page: 'accounts',
        pageLabel: 'Cuentas',
        matchField: a.name.toLowerCase().includes(q) ? 'nombre'
          : a.notes?.toLowerCase().includes(q) ? 'notas'
          : 'tipo',
      }))
      .slice(0, 10);

    if (acctMatches.length > 0) {
      groups.push({
        page: 'accounts',
        pageLabel: 'Cuentas',
        icon: 'Wallet',
        color: '#01ff89',
        results: acctMatches,
      });
    }

    // ─── Servicios ────────────────────────────────────────────
    const svcMatches = allServiceAccounts
      .filter((s) =>
        s.name.toLowerCase().includes(q) ||
        s.provider.toLowerCase().includes(q) ||
        s.notes?.toLowerCase().includes(q)
      )
      .map((s) => ({
        id: s.id,
        label: s.name,
        sublabel: s.provider,
        amount: s.amount,
        page: 'services',
        pageLabel: 'Servicios',
        matchField: s.name.toLowerCase().includes(q) ? 'nombre'
          : s.provider.toLowerCase().includes(q) ? 'proveedor'
          : 'notas',
      }))
      .slice(0, 10);

    if (svcMatches.length > 0) {
      groups.push({
        page: 'services',
        pageLabel: 'Servicios',
        icon: 'Receipt',
        color: '#f9f002',
        results: svcMatches,
      });
    }

    // ─── Facturas (Bills) ─────────────────────────────────────
    // Match by service name linked to the bill
    const billMatches = allBills
      .filter((b) => {
        const sa = allServiceAccounts.find((s) => s.id === b.serviceAccountId);
        return sa && (
          sa.name.toLowerCase().includes(q) ||
          sa.provider.toLowerCase().includes(q)
        );
      })
      .map((b) => {
        const sa = allServiceAccounts.find((s) => s.id === b.serviceAccountId);
        return {
          id: b.id,
          label: `Factura - ${sa?.name || 'Servicio'}`,
          sublabel: sa?.provider,
          amount: b.amount,
          date: b.dueDate,
          page: 'services',
          pageLabel: 'Servicios',
          matchField: 'factura',
        };
      })
      .slice(0, 10);

    if (billMatches.length > 0) {
      // Merge into services group if it exists
      const existingGroup = groups.find((g) => g.page === 'services');
      if (existingGroup) {
        existingGroup.results.push(...billMatches);
      } else {
        groups.push({
          page: 'services',
          pageLabel: 'Servicios',
          icon: 'Receipt',
          color: '#f9f002',
          results: billMatches,
        });
      }
    }

    // ─── Deudas ───────────────────────────────────────────────
    const debtMatches = allDebts
      .filter((d) =>
        d.name.toLowerCase().includes(q) ||
        d.creditor.toLowerCase().includes(q)
      )
      .map((d) => ({
        id: d.id,
        label: d.name,
        sublabel: d.creditor,
        amount: d.remainingAmount,
        page: 'debts',
        pageLabel: 'Deudas',
        matchField: d.name.toLowerCase().includes(q) ? 'nombre' : 'acreedor',
      }))
      .slice(0, 10);

    if (debtMatches.length > 0) {
      groups.push({
        page: 'debts',
        pageLabel: 'Deudas',
        icon: 'CreditCard',
        color: '#d946ef',
        results: debtMatches,
      });
    }

    // ─── Metas de Ahorro ─────────────────────────────────────
    const savMatches = allSavingsGoals
      .filter((s) => s.name.toLowerCase().includes(q))
      .map((s) => ({
        id: s.id,
        label: `${s.icon} ${s.name}`,
        amount: s.currentAmount,
        page: 'savings',
        pageLabel: 'Ahorros',
        matchField: 'nombre',
      }))
      .slice(0, 10);

    if (savMatches.length > 0) {
      groups.push({
        page: 'savings',
        pageLabel: 'Ahorros',
        icon: 'PiggyBank',
        color: '#4deeea',
        results: savMatches,
      });
    }

    // ─── Pagos Recurrentes ────────────────────────────────────
    const recMatches = allRecurring
      .filter((r) =>
        r.name.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q)
      )
      .map((r) => ({
        id: r.id,
        label: r.name,
        amount: r.amount,
        date: r.nextDueDate,
        page: 'recurring',
        pageLabel: 'Recurrentes',
        matchField: r.name.toLowerCase().includes(q) ? 'nombre' : 'descripción',
      }))
      .slice(0, 10);

    if (recMatches.length > 0) {
      groups.push({
        page: 'recurring',
        pageLabel: 'Recurrentes',
        icon: 'Repeat',
        color: '#00fff5',
        results: recMatches,
      });
    }

    // ─── Categorías (Gasto) ──────────────────────────────────
    const expCatMatches = allExpenseCats
      .filter((c) => c.name.toLowerCase().includes(q))
      .map((c) => ({
        id: c.id,
        label: `${c.icon} ${c.name}`,
        page: 'categories',
        pageLabel: 'Categorías',
        matchField: 'nombre',
      }))
      .slice(0, 10);

    // ─── Categorías (Ingreso) ────────────────────────────────
    const incCatMatches = allIncomeCats
      .filter((c) => c.name.toLowerCase().includes(q))
      .map((c) => ({
        id: c.id,
        label: `${c.icon} ${c.name}`,
        page: 'categories',
        pageLabel: 'Categorías',
        matchField: 'nombre',
      }))
      .slice(0, 10);

    const catMatches = [...expCatMatches, ...incCatMatches].slice(0, 10);
    if (catMatches.length > 0) {
      groups.push({
        page: 'categories',
        pageLabel: 'Categorías',
        icon: 'Tags',
        color: '#7c3aed',
        results: catMatches,
      });
    }

    // ─── Presupuestos ────────────────────────────────────────
    const budgetMatches = allBudgets
      .filter((b) => {
        const cat = allExpenseCats.find((c) => c.id === b.categoryId);
        return cat && cat.name.toLowerCase().includes(q);
      })
      .map((b) => {
        const cat = allExpenseCats.find((c) => c.id === b.categoryId);
        return {
          id: b.id,
          label: cat ? `${cat.icon} ${cat.name}` : 'Sin categoría',
          amount: b.amount,
          page: 'budgets',
          pageLabel: 'Presupuestos',
          matchField: 'categoría',
        };
      })
      .slice(0, 10);

    if (budgetMatches.length > 0) {
      groups.push({
        page: 'budgets',
        pageLabel: 'Presupuestos',
        icon: 'PieChart',
        color: '#f97316',
        results: budgetMatches,
      });
    }

    return groups;
  },
};
