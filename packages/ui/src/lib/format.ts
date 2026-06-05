/** Shared formatters so money, rates, and statuses read the same in every app. */

/**
 * A commission rate stored as a FRACTION (0..1) → a percent string. Whole
 * percents render without decimals (12%), fractional ones keep one decimal
 * (12.5%) — the SAME rule everywhere so a rate never reads as 13% in one place
 * and 12.5% in another. null/undefined ⇒ em dash.
 */
export function formatRate(rate?: number | null): string {
  if (rate == null) return "—";
  const pct = rate * 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(1)}%`;
}

/** Currency formatter (defaults to the India locale + INR). */
export function formatMoney(amount: number, currency = "INR", locale = "en-IN"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
}

/** Title-case a lowercase status enum for display (pending → Pending). */
export function titleCase(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}
