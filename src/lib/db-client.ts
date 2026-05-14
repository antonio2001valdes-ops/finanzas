import Dexie, { type EntityTable } from 'dexie';

// ─── Type Definitions ───────────────────────────────────────────────

export interface IncomeCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  budgetLimit?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
  icon: string;
  color: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  categoryType?: string;
  categoryId?: string;
  paymentMethod?: string;
  accountId?: string;
  notes?: string;
  isRecurring: boolean;
  tags?: string;
  parentTransactionId?: string;
  splitIndex?: number;
  date: string;
  createdAt: string;
  updatedAt: string;
}

export interface Budget {
  id: string;
  categoryId: string;
  month: number;
  year: number;
  amount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
  icon: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavingsMovement {
  id: string;
  savingsGoalId: string;
  amount: number;
  type: string;
  description?: string;
  createdAt: string;
}

export interface Debt {
  id: string;
  name: string;
  creditor: string;
  totalAmount: number;
  remainingAmount: number;
  interestRate: number;
  monthlyPayment: number;
  status: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DebtPayment {
  id: string;
  debtId: string;
  amount: number;
  description?: string;
  createdAt: string;
}

export interface RecurringPayment {
  id: string;
  name: string;
  amount: number;
  interval: string;
  dueDay: number;
  nextDueDate: string;
  categoryId?: string;
  isActive: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceAccount {
  id: string;
  name: string;
  provider: string;
  accountNumber?: string;
  categoryId?: string;
  amount: number;
  dueDay?: number;
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceBill {
  id: string;
  serviceAccountId: string;
  amount: number;
  dueDate: string;
  paid: boolean;
  paidDate?: string;
  createdAt: string;
}

export interface AccountTransfer {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  description?: string;
  createdAt: string;
}

export interface CategorizationRule {
  id: string;
  name: string;
  descriptionPattern: string;
  categoryType: string;
  categoryId?: string;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SchemaVersion {
  id: string;
  version: number;
  appliedAt: string;
}

// ─── Database ───────────────────────────────────────────────────────

const db = new Dexie('khorven-finance') as Dexie & {
  incomeCategories: EntityTable<IncomeCategory, 'id'>;
  expenseCategories: EntityTable<ExpenseCategory, 'id'>;
  accounts: EntityTable<Account, 'id'>;
  transactions: EntityTable<Transaction, 'id'>;
  budgets: EntityTable<Budget, 'id'>;
  savingsGoals: EntityTable<SavingsGoal, 'id'>;
  savingsMovements: EntityTable<SavingsMovement, 'id'>;
  debts: EntityTable<Debt, 'id'>;
  debtPayments: EntityTable<DebtPayment, 'id'>;
  recurringPayments: EntityTable<RecurringPayment, 'id'>;
  serviceAccounts: EntityTable<ServiceAccount, 'id'>;
  serviceBills: EntityTable<ServiceBill, 'id'>;
  accountTransfers: EntityTable<AccountTransfer, 'id'>;
  categorizationRules: EntityTable<CategorizationRule, 'id'>;
  schemaVersions: EntityTable<SchemaVersion, 'id'>;
};

db.version(1).stores({
  incomeCategories: 'id, name',
  expenseCategories: 'id, name',
  accounts: 'id, name, type',
  transactions: 'id, date, type, categoryType, categoryId, accountId, [categoryType+categoryId]',
  budgets: 'id, categoryId, month, year, [categoryId+month+year]',
  savingsGoals: 'id, name',
  savingsMovements: 'id, savingsGoalId',
  debts: 'id, status',
  debtPayments: 'id, debtId',
  recurringPayments: 'id, nextDueDate, isActive',
  serviceAccounts: 'id, name, isActive',
  serviceBills: 'id, serviceAccountId, dueDate, paid',
  accountTransfers: 'id, fromAccountId, toAccountId',
  categorizationRules: 'id, priority',
  schemaVersions: 'id',
});

export { db };

// ─── Helper Functions ───────────────────────────────────────────────

export function generateId(): string {
  return 'c' + Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function todayAtNoon(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0).toISOString();
}

export async function isDbSeeded(): Promise<boolean> {
  const count = await db.incomeCategories.count();
  return count > 0;
}

export async function clearAllData(): Promise<void> {
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
      await Promise.all([
        db.incomeCategories.clear(),
        db.expenseCategories.clear(),
        db.accounts.clear(),
        db.transactions.clear(),
        db.budgets.clear(),
        db.savingsGoals.clear(),
        db.savingsMovements.clear(),
        db.debts.clear(),
        db.debtPayments.clear(),
        db.recurringPayments.clear(),
        db.serviceAccounts.clear(),
        db.serviceBills.clear(),
        db.accountTransfers.clear(),
        db.categorizationRules.clear(),
        db.schemaVersions.clear(),
      ]);
    }
  );
}
