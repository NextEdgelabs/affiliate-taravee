/** Range-aware INR (en-IN) price formatting: "₹305" or "₹305 – ₹7,500". */
export function formatPrice(min: number, max: number, currency: string): string {
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
    }).format(n);
  return max > min ? `${fmt(min)} – ${fmt(max)}` : fmt(min);
}
