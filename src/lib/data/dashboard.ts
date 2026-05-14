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

    // Recurring payments this month (paid ones are already in transactions due to `pay()`)
    // So they are already counted in totalExpenses

    const adjustedExpenses = totalExpenses + servicePaymentsTotal + debtPaymentsTotal;
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
    };
  },
};
