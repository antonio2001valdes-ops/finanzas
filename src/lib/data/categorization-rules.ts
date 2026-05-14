import { db, generateId, nowISO, type CategorizationRule } from '@/lib/db-client';

export const categorizationRuleService = {
  async getAll(): Promise<CategorizationRule[]> {
    return db.categorizationRules.orderBy('priority').toArray();
  },

  async create(data: Omit<CategorizationRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<CategorizationRule> {
    const rule: CategorizationRule = {
      ...data,
      id: generateId(),
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };
    await db.categorizationRules.add(rule);
    return rule;
  },

  async update(id: string, data: Partial<CategorizationRule>): Promise<void> {
    await db.categorizationRules.update(id, {
      ...data,
      updatedAt: nowISO(),
    });
  },

  async delete(id: string): Promise<void> {
    await db.categorizationRules.delete(id);
  },
};
