export const CURRENCY_SYMBOL: Record<string, string> = { GBP: "£", USD: "$", EUR: "€", EGP: "E£", AED: "د.إ", SAR: "SAR ", INR: "₹" };

export function currencySymbol(code: string | null | undefined): string {
  return (code && CURRENCY_SYMBOL[code]) || "£";
}
