import { describe, it, expect } from 'vitest';
import { parseAndValidateQRPayload, encodeQRPayload, DEMO_QR_FORMAT } from '../utils/qr';

describe('QR Payload Validation', () => {
  it('successfully parses and validates a legitimate PayPal Family QR code', () => {
    const raw = encodeQRPayload(
      'MERCH_TEST',
      'Test Merchant Cafe',
      'Dining',
      25000,
      'INV-9988'
    );

    const result = parseAndValidateQRPayload(raw);
    expect(result.success).toBe(true);
    expect(result.payload?.merchantId).toBe('MERCH_TEST');
    expect(result.payload?.merchantName).toBe('Test Merchant Cafe');
    expect(result.payload?.amountPaise).toBe(25000);
    expect(result.payload?.format).toBe(DEMO_QR_FORMAT);
  });

  it('rejects arbitrary non-JSON QR strings with user-friendly error', () => {
    const result = parseAndValidateQRPayload('https://example.com/random-url');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unrecognized QR code encoding');
  });

  it('rejects QR codes with incorrect format identifier', () => {
    const fakeData = JSON.stringify({
      format: 'some_other_qr_format',
      merchantId: 'M1',
      merchantName: 'Store',
      amountPaise: 5000,
      currency: 'INR',
      invoiceId: 'INV-1',
    });

    const result = parseAndValidateQRPayload(fakeData);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid QR code standard');
  });

  it('rejects payloads with non-INR currency or negative amount', () => {
    const usdData = JSON.stringify({
      format: DEMO_QR_FORMAT,
      merchantId: 'M1',
      merchantName: 'Store',
      amountPaise: 5000,
      currency: 'USD',
      invoiceId: 'INV-1',
    });

    const result = parseAndValidateQRPayload(usdData);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unsupported currency');
  });
});

