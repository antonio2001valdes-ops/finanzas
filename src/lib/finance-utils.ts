// ─── Currency Formatting ────────────────────────────────────────────

export function formatCurrency(amount: number): string {
  const isNegative = amount < 0;
  const abs = Math.abs(Math.round(amount));
  const formatted = abs.toLocaleString('es-CL');
  return isNegative ? `-$${formatted}` : `$${formatted}`;
}

// ─── Date Formatting ────────────────────────────────────────────────

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatMonthYear(month: number, year: number): string {
  return `${MONTHS_ES[month - 1]} ${year}`;
}

// ─── Constants ──────────────────────────────────────────────────────

export const MONTHS_ES: string[] = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export const TRANSACTION_TYPES: Record<string, string> = {
  income: 'Ingreso',
  expense: 'Gasto',
  transfer: 'Transferencia',
};

export const ACCOUNT_TYPES: Record<string, string> = {
  checking: 'Corriente',
  savings: 'Ahorro',
  cash: 'Efectivo',
  credit: 'Crédito',
};

export const DEBT_STATUS: Record<string, string> = {
  active: 'Activa',
  paid: 'Pagada',
};

export const RECURRING_INTERVALS: Record<string, string> = {
  monthly: 'Mensual',
  weekly: 'Semanal',
  yearly: 'Anual',
};

export const CHART_COLORS: string[] = [
  '#05d9e8',
  '#ff2a6d',
  '#01ff89',
  '#d300c5',
  '#f9f002',
];
