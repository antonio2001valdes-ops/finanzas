// ─── Currency Formatting ────────────────────────────────────────────

export function formatCurrency(amount: number): string {
  const isNegative = amount < 0;
  const abs = Math.abs(Math.round(amount));
  const formatted = abs.toLocaleString('es-CL');
  return isNegative ? `-$${formatted}` : `$${formatted}`;
}

// ─── Date Formatting ────────────────────────────────────────────────

export function formatDate(dateStr: string): string {
  // Extract date parts directly from the ISO string to avoid timezone offset issues.
  // ISO format: "YYYY-MM-DDTHH:mm:ss.sssZ" or "YYYY-MM-DD"
  const datePart = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const [year, month, day] = datePart.split('-');
  if (year && month && day) {
    return `${day}/${month}/${year}`;
  }
  // Fallback for unexpected formats
  const date = new Date(dateStr);
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
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
