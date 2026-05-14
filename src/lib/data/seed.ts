import { db, generateId, nowISO, isDbSeeded, clearAllData } from '@/lib/db-client';

const DEFAULT_INCOME_CATEGORIES = [
  { name: 'Salario', icon: '💼', color: '#05d9e8' },
  { name: 'Freelance', icon: '💻', color: '#01ff89' },
  { name: 'Inversiones', icon: '📈', color: '#f9f002' },
  { name: 'Ventas', icon: '🛒', color: '#ff2a6d' },
  { name: 'Regalías', icon: '👑', color: '#d300c5' },
  { name: 'Otros', icon: '💰', color: '#888888' },
];

const DEFAULT_EXPENSE_CATEGORIES = [
  { name: 'Alimentación', icon: '🍔', color: '#ff2a6d', budgetLimit: 200000 },
  { name: 'Transporte', icon: '🚗', color: '#05d9e8', budgetLimit: 100000 },
  { name: 'Vivienda', icon: '🏠', color: '#01ff89', budgetLimit: 400000 },
  { name: 'Entretenimiento', icon: '🎮', color: '#d300c5', budgetLimit: 50000 },
  { name: 'Salud', icon: '⚕️', color: '#f9f002', budgetLimit: 80000 },
  { name: 'Educación', icon: '📚', color: '#05d9e8', budgetLimit: 100000 },
  { name: 'Ropa', icon: '👕', color: '#ff2a6d', budgetLimit: 60000 },
  { name: 'Servicios', icon: '💡', color: '#01ff89', budgetLimit: 80000 },
  { name: 'Seguros', icon: '🛡️', color: '#d300c5', budgetLimit: 50000 },
  { name: 'Otros', icon: '📦', color: '#888888', budgetLimit: 50000 },
];

const DEFAULT_ACCOUNTS = [
  { name: 'Corriente', type: 'checking', balance: 0, currency: 'USD', icon: '🏦', color: '#05d9e8' },
  { name: 'Ahorro', type: 'savings', balance: 0, currency: 'USD', icon: '🐷', color: '#01ff89' },
  { name: 'Efectivo', type: 'cash', balance: 0, currency: 'USD', icon: '💵', color: '#f9f002' },
];

export const seedService = {
  async ensureSeeded(): Promise<void> {
    const seeded = await isDbSeeded();
    if (!seeded) {
      await seedService.seedDefaults();
    }
  },

  async seedDefaults(): Promise<void> {
    const now = nowISO();

    await db.transaction(
      'rw',
      [db.incomeCategories, db.expenseCategories, db.accounts],
      async () => {
        // Seed income categories
        await db.incomeCategories.bulkAdd(
          DEFAULT_INCOME_CATEGORIES.map((cat) => ({
            id: generateId(),
            ...cat,
            createdAt: now,
            updatedAt: now,
          }))
        );

        // Seed expense categories
        await db.expenseCategories.bulkAdd(
          DEFAULT_EXPENSE_CATEGORIES.map((cat) => ({
            id: generateId(),
            ...cat,
            createdAt: now,
            updatedAt: now,
          }))
        );

        // Seed accounts
        await db.accounts.bulkAdd(
          DEFAULT_ACCOUNTS.map((acc) => ({
            id: generateId(),
            ...acc,
            createdAt: now,
            updatedAt: now,
          }))
        );
      }
    );
  },

  async resetAndSeed(): Promise<void> {
    await clearAllData();
    await seedService.seedDefaults();
  },
};
