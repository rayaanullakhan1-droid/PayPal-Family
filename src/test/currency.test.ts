import { describe, it, expect } from 'vitest';
import { toPaise, fromPaise, formatCurrency, isValidPaiseAmount } from '../utils/currency';

describe('Currency Utility (Integer Paise Calculations)', () => {
  it('correctly converts numeric rupee amounts to integer paise', () => {
    expect(toPaise(500)).toBe(50000);
    expect(toPaise(10000)).toBe(1000000);
    expect(toPaise(0)).toBe(0);
    expect(toPaise(12.5)).toBe(1250);
    expect(toPaise(0.75)).toBe(75);
  });

  it('correctly converts string input to integer paise without float inaccuracies', () => {
    expect(toPaise('500')).toBe(50000);
    expect(toPaise('500.50')).toBe(50050);
    expect(toPaise('1,200.75')).toBe(120075);
    expect(toPaise('0.05')).toBe(5);
    expect(toPaise('10000.00')).toBe(1000000);
  });

  it('handles negative or invalid string inputs gracefully', () => {
    expect(toPaise('-50')).toBe(0);
    expect(toPaise('abc')).toBe(0);
    expect(toPaise('')).toBe(0);
  });

  it('converts integer paise back to rupees', () => {
    expect(fromPaise(50000)).toBe(500);
    expect(fromPaise(1000000)).toBe(10000);
    expect(fromPaise(1250)).toBe(12.5);
  });

  it('formats currency correctly in Indian numbering system', () => {
    const formatted = formatCurrency(1000000);
    // Should contain ₹ and 10,000
    expect(formatted).toContain('₹');
    expect(formatted).toContain('10,000');
  });

  it('validates paise amount bounds', () => {
    expect(isValidPaiseAmount(50000)).toBe(true);
    expect(isValidPaiseAmount(0)).toBe(false);
    expect(isValidPaiseAmount(-100)).toBe(false);
    expect(isValidPaiseAmount(1.5)).toBe(false);
  });
});

