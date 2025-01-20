/**
 * Formats a price from cents (Stripe format) to Mexican Pesos
 * @param amount - The amount in cents (e.g., 10000 for $100.00 MXN)
 * @param currency - The currency code (default: 'MXN')
 * @returns Formatted price string (e.g., "$100.00")
 */
export function formatPrice(
  amount: number | null | undefined,
  currency = "MXN",
): string {
  if (amount == null) return "$0.00";

  const formatter = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  });

  return formatter.format(amount / 100);
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}
