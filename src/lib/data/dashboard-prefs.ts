import { db, nowISO, type DashboardPreferences, type DashboardSectionConfig } from '@/lib/db-client';

// ─── Default Dashboard Sections ───────────────────────────────────────

export const DEFAULT_DASHBOARD_SECTIONS: DashboardSectionConfig[] = [
  { key: 'statCards', label: 'Tarjetas de Estadísticas', visible: true, order: 0 },
  { key: 'serviceDebtSummary', label: 'Servicios y Deudas', visible: true, order: 1 },
  { key: 'monthlyComparison', label: 'Comparación Mensual', visible: true, order: 2 },
  { key: 'dailyChart', label: 'Gráfico Diario', visible: true, order: 3 },
  { key: 'categoryChart', label: 'Gastos por Categoría', visible: true, order: 4 },
  { key: 'trendChart', label: 'Tendencia 6 Meses', visible: true, order: 5 },
  { key: 'accounts', label: 'Cuentas Bancarias', visible: true, order: 6 },
  { key: 'budgets', label: 'Presupuestos', visible: true, order: 7 },
  { key: 'upcomingDue', label: 'Próximos Vencimientos', visible: true, order: 8 },
  { key: 'recentTransactions', label: 'Transacciones Recientes', visible: true, order: 9 },
];

// ─── Dashboard Preferences Service ────────────────────────────────────

export const dashboardPrefsService = {
  async get(): Promise<DashboardPreferences> {
    const prefs = await db.dashboardPreferences.get('default');
    if (prefs) return prefs;

    // Create default
    const defaultPrefs: DashboardPreferences = {
      id: 'default',
      sections: [...DEFAULT_DASHBOARD_SECTIONS],
      updatedAt: nowISO(),
    };
    await db.dashboardPreferences.put(defaultPrefs);
    return defaultPrefs;
  },

  async update(sections: DashboardSectionConfig[]): Promise<void> {
    await db.dashboardPreferences.put({
      id: 'default',
      sections,
      updatedAt: nowISO(),
    });
  },

  async toggleSection(key: string, visible: boolean): Promise<DashboardSectionConfig[]> {
    const prefs = await this.get();
    const sections = prefs.sections.map(s => s.key === key ? { ...s, visible } : s);
    await this.update(sections);
    return sections;
  },

  async reorderSections(sections: DashboardSectionConfig[]): Promise<void> {
    const reordered = sections.map((s, i) => ({ ...s, order: i }));
    await this.update(reordered);
  },

  async resetToDefault(): Promise<void> {
    await this.update([...DEFAULT_DASHBOARD_SECTIONS]);
  },

  isSectionVisible(prefs: DashboardPreferences | null, key: string): boolean {
    if (!prefs) return true;
    const section = prefs.sections.find(s => s.key === key);
    return section?.visible ?? true;
  },

  getSortedSections(prefs: DashboardPreferences | null): DashboardSectionConfig[] {
    if (!prefs) return [...DEFAULT_DASHBOARD_SECTIONS];
    return [...prefs.sections].sort((a, b) => a.order - b.order);
  },
};
