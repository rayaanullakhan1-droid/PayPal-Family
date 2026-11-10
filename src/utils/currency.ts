/**
 * Currency utility using strictly integer paise internally.
 * 1 Indian Rupee (INR) = 100 Paise.
 * Prevents floating-point rounding inaccuracies in financial logic.
 */

/**
 * Converts a rupee decimal or number string into integer paise.
 * Handles cases like "500", "500.5", "500.50", "0.75" without float drift.
 */
export function toPaise(rupeesInput: number | string): number {
  if (typeof rupeesInput === 'number') {
    if (isNaN(rupeesInput) || rupeesInput <= 0) return 0;
    return Math.round(rupeesInput * 100);
  }

  const cleaned = rupeesInput.trim().replace(/,/g, '');
  if (!cleaned || isNaN(Number(cleaned)) || Number(cleaned) <= 0) return 0;

  const parts = cleaned.split('.');
  const whole = parseInt(parts[0] || '0', 10);
  if (parts.length === 1) {
    return whole * 100;
  }

  // Pad or truncate decimal part to exactly 2 digits
  const decimalStr = (parts[1] + '00').slice(0, 2);
  const decimal = parseInt(decimalStr, 10);

  return whole * 100 + decimal;
}

/**
 * Converts integer paise back to numeric rupees (for display/inputs if needed).
 */
export function fromPaise(paise: number): number {
  if (typeof paise !== 'number' || isNaN(paise)) return 0;
  return Math.floor(paise) / 100;
}

/**
 * Formats integer paise into a clean Indian Rupee currency string.
 * Example: 1000000 paise -> "₹10,000.00" or "₹10,000"
 */
export function formatCurrency(paise: number, options?: { hideDecimalsIfZero?: boolean; includeSymbol?: boolean }): string {
  const { hideDecimalsIfZero = false, includeSymbol = true } = options || {};
  const validPaise = Math.max(0, Math.floor(isNaN(paise) ? 0 : paise));
  const rupees = validPaise / 100;

  const formatted = rupees.toLocaleString('en-IN', {
    minimumFractionDigits: hideDecimalsIfZero && validPaise % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });

  return includeSymbol ? `₹${formatted}` : formatted;
}

/**
 * Validates that an amount in paise is a positive integer within realistic bounds.
 */
export function isValidPaiseAmount(paise: number): boolean {
  return Number.isInteger(paise) && paise > 0 && paise <= 100_000_000; // max ₹10 Lakhs demo cap
}
