/** Concatena clases condicionales (reemplaza clsx/cn) */
export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

/** Formatea número como moneda peruana */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
  }).format(value);
}

/** Formatea número con 2 decimales */
export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat('es-PE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** Formatea fecha a dd/mm/yyyy */
export function formatDate(value: string | Date): string {
  return new Date(value).toLocaleDateString('es-PE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

/** Formatea fecha + hora */
export function formatDateTime(value: string | Date | undefined | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-PE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/** Diferencia porcentual entre dos valores */
export function pctChange(current: number, previous: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

/** Primer y último día del mes actual en formato YYYY-MM-DD */
export function currentMonthRange(): { from: string; to: string } {
  const now   = new Date();
  const from  = new Date(now.getFullYear(), now.getMonth(), 1);
  const to    = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    from: from.toISOString().split('T')[0],
    to:   to.toISOString().split('T')[0],
  };
}

/** Trunca texto largo */
export function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
}
