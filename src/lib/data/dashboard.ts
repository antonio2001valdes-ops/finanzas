import { db, type Transaction } from '@/lib/db-client';
import { categoryService } from './categories';

export interface DashboardData {
  totalIncome: number;
  totalExpenses: number;
  adjustedExpenses: number;
  balance: number;
  savingsTotal: number;
  debtsTotal: number;
  expenseByCategory: { categoryId: string; categoryName: string; categoryIcon: string; categoryColor: string; amount: number }[];
  incomeByCategory: { categoryId: string; categoryName: string; categoryIcon: string; categoryColor: string; amount: number }[];
  monthlyTrend: { month: number; year: number; income: number; expenses: number }[];
  budgetSummary: { categoryId: string; categoryName: string; budgetAmount: number; spent: number; percentage: number }[];
  recentTransactions: Transaction[];
  // ── New fields for redesigned dashboard ──
  dailyData: { day: number; income: number; expenses: number }[];
  previousMonthIncome: number;
  previousMonthExpenses: number;
  previousMonthBalance: number;
  serviceSummary: { totalPaid: number; paidCount: number; pendingAmount: number; pendingCount: number; totalBills: number };
  debtSummary: { activeCount: number; totalDebt: number; remainingAmount: number; paidAmount: number };
  savingsSummary: { totalTarget: number; totalCurrent: number; rate: number };
  accountSummaries: { id: string; name: string; type: string; balance: number; income: number; expenses: number; icon: string; color: string }[];
  upcomingDue: { id: string; name: string; dueDate: string; amount: number; daysRemaining: number; type: 'service' | 'recurring'; icon: string; color: string }[];
  recurringSummary: { activeCount: number; totalAmount: number; paidThisMonth: number; pendingThisMonth: number; pendingCount: number };
  debtPaymentsTotal: number;
}

export const dashboardService = {
  async getData(month: number, year: number): Promise<DashboardData> {
    const startDate = new Date(year, month - 1, 1).toISOString();
    const endDate = new Date(year, month, 0, 23, 59, 59, 999).toISOString();

    // Fetch all transactions for the month
    const allTransactions = await db.transactions.toArray();
    const monthTransactions = allTransactions.filter((t) => t.date >= startDate && t.date <= endDate);

    // Income and expense totals from transactions
    const incomeTransactions = monthTransactions.filter((t) => t.type === 'income');
    const expenseTransactions = monthTransactions.filter((t) => t.type === 'expense');

    const totalIncome = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = expenseTransactions.reduce((sum, t) => sum + t.amount, 0);

    // Service bills paid this month
    const serviceBills = await db.serviceBills.toArray();
    const paidBillsThisMonth = serviceBills.filter(
      (b) => b.paid && b.paidDate && b.paidDate >= startDate && b.paidDate <= endDate
    );
    const servicePaymentsTotal = paidBillsThisMonth.reduce((sum, b) => sum + b.amount, 0);

    // Debt payments this month
    const debtPayments = await db.debtPayments.toArray();
    const debtPaymentsThisMonth = debtPayments.filter(
      (p) => p.createdAt >= startDate && p.createdAt <= endDate
    );
    const debtPaymentsTotal = debtPaymentsThisMonth.reduce((sum, p) => sum + p.amount, 0);

    // ── Recurring payments for this month ──
    const recurringPayments = await db.recurringPayments.toArray();
    const activeRecurring = recurringPayments.filter((r) => r.isActive);

    // Recurring payments due this month (nextDueDate falls within the month)
    const recurringDueThisMonth = activeRecurring.filter(
      (r) => r.nextDueDate >= startDate && r.nextDueDate <= endDate
    );

    // Recurring already paid this month (transactions with isRecurring=true in this month)
    const paidRecurringThisMonth = expenseTransactions.filter((t) => t.isRecurring);
    const paidRecurringTotal = paidRecurringThisMonth.reduce((sum, t) => sum + t.amount, 0);

    // Recurring pending this month (due but not yet paid)
    const paidRecurringNames = new Set(paidRecurringThisMonth.map((t) => t.description));
    const pendingRecurring = recurringDueThisMonth.filter(
      (r) => !paidRecurringNames.has(r.name)
    );
    const pendingRecurringTotal = pendingRecurring.reduce((sum, r) => sum + r.amount, 0);

    const recurringSummary = {
      activeCount: activeRecurring.length,
      totalAmount: activeRecurring.reduce((sum, r) => sum + r.amount, 0),
      paidThisMonth: paidRecurringTotal,
      pendingThisMonth: pendingRecurringTotal,
      pendingCount: pendingRecurring.length,
    };

    // adjustedExpenses: totalExpenses already includes paid service bills (via transactions) and paid recurring (via transactions)
    // We only add pending items that don't have transactions yet
    const adjustedExpenses = totalExpenses + pendingRecurringTotal;
    const balance = totalIncome - adjustedExpenses;

    // Savings total
    const savingsGoals = await db.savingsGoals.toArray();
    const savingsTotal = savingsGoals.reduce((sum, g) => sum + g.currentAmount, 0);

    // Debts total (remaining)
    const debts = await db.debts.toArray();
    const debtsTotal = debts.filter((d) => d.status === 'active').reduce((sum, d) => sum + d.remainingAmount, 0);

    // Expense by category
    const categories = await categoryService.getAll();
    const allExpenseCategories = categories.expense;
    const allIncomeCategories = categories.income;

    const expenseByCategoryMap = new Map<string, number>();
    for (const t of expenseTransactions) {
      if (t.categoryId) {
        expenseByCategoryMap.set(t.categoryId, (expenseByCategoryMap.get(t.categoryId) ?? 0) + t.amount);
      }
    }

    const expenseByCategory = Array.from(expenseByCategoryMap.entries()).map(([categoryId, amount]) => {
      const cat = allExpenseCategories.find((c) => c.id === categoryId);
      return {
        categoryId,
        categoryName: cat?.name ?? 'Sin categoría',
        categoryIcon: cat?.icon ?? '📦',
        categoryColor: cat?.color ?? '#888',
        amount,
      };
    });

    // Income by category
    const incomeByCategoryMap = new Map<string, number>();
    for (const t of incomeTransactions) {
      if (t.categoryId) {
        incomeByCategoryMap.set(t.categoryId, (incomeByCategoryMap.get(t.categoryId) ?? 0) + t.amount);
      }
    }

    const incomeByCategory = Array.from(incomeByCategoryMap.entries()).map(([categoryId, amount]) => {
      const cat = allIncomeCategories.find((c) => c.id === categoryId);
      return {
        categoryId,
        categoryName: cat?.name ?? 'Sin categoría',
        categoryIcon: cat?.icon ?? '💰',
        categoryColor: cat?.color ?? '#888',
        amount,
      };
    });

    // Monthly trend (last 6 months)
    const monthlyTrend: { month: number; year: number; income: number; expenses: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const trendDate = new Date(year, month - 1 - i, 1);
      const tMonth = trendDate.getMonth() + 1;
      const tYear = trendDate.getFullYear();
      const tStart = new Date(tYear, tMonth - 1, 1).toISOString();
      const tEnd = new Date(tYear, tMonth, 0, 23, 59, 59, 999).toISOString();

      const tMonthTransactions = allTransactions.filter((t) => t.date >= tStart && t.date <= tEnd);
      const tIncome = tMonthTransactions.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
      const tExpenses = tMonthTransactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

      monthlyTrend.push({ month: tMonth, year: tYear, income: tIncome, expenses: tExpenses });
    }

    // Budget summary
    const budgets = await db.budgets
      .where({ month, year })
      .toArray();

    const budgetSummary = budgets.map((budget) => {
      const cat = allExpenseCategories.find((c) => c.id === budget.categoryId);
      const bStart = new Date(budget.year, budget.month - 1, 1).toISOString();
      const bEnd = new Date(budget.year, budget.month, 0, 23, 59, 59, 999).toISOString();

      const spent = expenseTransactions
        .filter((t) => t.categoryId === budget.categoryId && t.date >= bStart && t.date <= bEnd)
        .reduce((sum, t) => sum + t.amount, 0);

      return {
        categoryId: budget.categoryId,
        categoryName: cat?.name ?? 'Sin categoría',
        budgetAmount: budget.amount,
        spent,
        percentage: budget.amount > 0 ? (spent / budget.amount) * 100 : 0,
      };
    });

    // Recent transactions (last 10)
    const recentTransactions = allTransactions
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10);

    // ── Daily data for the current month ──
    const daysInMonth = new Date(year, month, 0).getDate();
    const dailyData: { day: number; income: number; expenses: number }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dayStart = new Date(year, month - 1, d, 0, 0, 0, 0).toISOString();
      const dayEnd = new Date(year, month - 1, d, 23, 59, 59, 999).toISOString();
      const dayIncome = monthTransactions
        .filter((t) => t.date >= dayStart && t.date <= dayEnd && t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
      const dayExpenses = monthTransactions
        .filter((t) => t.date >= dayStart && t.date <= dayEnd && t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
      dailyData.push({ day: d, income: dayIncome, expenses: dayExpenses });
    }

    // ── Previous month comparison ──
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevStart = new Date(prevYear, prevMonth - 1, 1).toISOString();
    const prevEnd = new Date(prevYear, prevMonth, 0, 23, 59, 59, 999).toISOString();
    const prevMonthTransactions = allTransactions.filter((t) => t.date >= prevStart && t.date <= prevEnd);
    const previousMonthIncome = prevMonthTransactions.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const previousMonthExpenses = prevMonthTransactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const previousMonthBalance = previousMonthIncome - previousMonthExpenses;

    // ── Service Summary ──
    const monthBills = serviceBills.filter((b) => b.dueDate >= startDate && b.dueDate <= endDate);
    const paidBills = monthBills.filter((b) => b.paid);
    const unpaidBills = monthBills.filter((b) => !b.paid);
    const serviceSummary = {
      totalPaid: paidBills.reduce((s, b) => s + b.amount, 0),
      paidCount: paidBills.length,
      pendingAmount: unpaidBills.reduce((s, b) => s + b.amount, 0),
      pendingCount: unpaidBills.length,
      totalBills: monthBills.length,
    };

    // ── Debt Summary ──
    const activeDebts = debts.filter((d) => d.status === 'active');
    const totalDebtOriginal = activeDebts.reduce((s, d) => s + d.originalAmount, 0);
    const totalDebtRemaining = activeDebts.reduce((s, d) => s + d.remainingAmount, 0);
    const debtSummary = {
      activeCount: activeDebts.length,
      totalDebt: totalDebtOriginal,
      remainingAmount: totalDebtRemaining,
      paidAmount: totalDebtOriginal - totalDebtRemaining,
    };

    // ── Savings Summary ──
    const totalTarget = savingsGoals.reduce((s, g) => s + g.targetAmount, 0);
    const totalCurrent = savingsGoals.reduce((s, g) => s + g.currentAmount, 0);
    const savingsSummary = {
      totalTarget,
      totalCurrent,
      rate: totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0,
    };

    // ── Account Summaries ──
    const accounts = await db.accounts.toArray();
    const accountTypes = categories.income; // we'll use a simpler mapping
    const accountSummaries = accounts.map((a) => {
      const acctIncome = monthTransactions
        .filter((t) => t.accountId === a.id && t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
      const acctExpenses = monthTransactions
        .filter((t) => t.accountId === a.id && t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
      // Map account type to icon/color
      const typeMap: Record<string, { icon: string; color: string }> = {
        savings: { icon: '🐷', color: '#d300c5' },
        checking: { icon: '🏦', color: '#05d9e8' },
        cash: { icon: '💵', color: '#01ff89' },
        credit: { icon: '💳', color: '#ff2a6d' },
      };
      const typeInfo = typeMap[a.type] ?? { icon: '💰', color: '#05d9e8' };
      return {
        id: a.id,
        name: a.name,
        type: a.type,
        balance: a.balance,
        income: acctIncome,
        expenses: acctExpenses,
        icon: typeInfo.icon,
        color: typeInfo.color,
      };
    });

    // ── Upcoming Due Items ──
    const serviceAccounts = await db.serviceAccounts.toArray();
    const now = new Date().toISOString();

    const serviceDueItems = serviceBills
      .filter((b) => !b.paid && b.dueDate >= now)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 5)
      .map((b) => {
        const acct = serviceAccounts.find((a) => a.id === b.serviceAccountId);
        const dueDate = new Date(b.dueDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        dueDate.setHours(0, 0, 0, 0);
        const daysRemaining = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return {
          id: b.id,
          name: acct?.name ?? 'Servicio',
          dueDate: b.dueDate,
          amount: b.amount,
          daysRemaining,
          type: 'service' as const,
          icon: acct?.icon ?? '📄',
          color: acct?.color ?? '#ff8c00',
        };
      });

    const recurringDueItems = activeRecurring
      .filter((r) => r.nextDueDate >= now)
      .sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate))
      .slice(0, 5)
      .map((r) => {
        const dueDate = new Date(r.nextDueDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        dueDate.setHours(0, 0, 0, 0);
        const daysRemaining = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return {
          id: r.id,
          name: r.name,
          dueDate: r.nextDueDate,
          amount: r.amount,
          daysRemaining,
          type: 'recurring' as const,
          icon: '🔄',
          color: '#05d9e8',
        };
      });

    const upcomingDue = [...serviceDueItems, ...recurringDueItems]
      .sort((a, b) => a.daysRemaining - b.daysRemaining)
      .slice(0, 8);

    return {
      totalIncome,
      totalExpenses,
      adjustedExpenses,
      balance,
      savingsTotal,
      debtsTotal,
      expenseByCategory,
      incomeByCategory,
      monthlyTrend,
      budgetSummary,
      recentTransactions,
      dailyData,
      previousMonthIncome,
      previousMonthExpenses,
      previousMonthBalance,
      serviceSummary,
      debtSummary,
      savingsSummary,
      accountSummaries,
      upcomingDue,
      recurringSummary,
      debtPaymentsTotal,
    };
  },
};
