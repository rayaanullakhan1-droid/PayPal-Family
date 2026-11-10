import { QRPayload, DemoMerchant } from '../types';

export const DEMO_QR_FORMAT = 'paypal_family_qr_v1';

/**
 * Validates and parses a raw QR code string.
 * Strict validation: ensures payload is JSON with format 'paypal_family_qr_v1',
 * required merchant metadata, valid currency 'INR', positive amount in paise, and invoice ID.
 */
export function parseAndValidateQRPayload(rawString: string): {
  success: boolean;
  payload?: QRPayload;
  error?: string;
} {
  if (!rawString || typeof rawString !== 'string') {
    return { success: false, error: 'Empty or invalid QR code format.' };
  }

  const trimmed = rawString.trim();

  // Try parsing JSON payload
  try {
    const data = JSON.parse(trimmed);

    if (data.format !== DEMO_QR_FORMAT) {
      return {
        success: false,
        error: `Invalid QR code standard. Expected format "${DEMO_QR_FORMAT}", received "${data.format || 'unknown'}". Only supported PayPal Family merchant QR codes can be processed.`,
      };
    }

    if (!data.merchantId || typeof data.merchantId !== 'string') {
      return { success: false, error: 'Invalid merchant identifier in QR code.' };
    }

    if (!data.merchantName || typeof data.merchantName !== 'string') {
      return { success: false, error: 'Missing merchant name in QR code.' };
    }

    if (data.currency !== 'INR') {
      return {
        success: false,
        error: `Unsupported currency "${data.currency}". Only INR is supported for this family account.`,
      };
    }

    if (!Number.isInteger(data.amountPaise) || data.amountPaise <= 0) {
      return { success: false, error: 'Invalid payment amount specified in QR code.' };
    }

    if (!data.invoiceId || typeof data.invoiceId !== 'string') {
      return { success: false, error: 'Missing invoice reference in QR payload.' };
    }

    const payload: QRPayload = {
      format: DEMO_QR_FORMAT,
      merchantId: data.merchantId,
      merchantName: data.merchantName,
      merchantCategory: data.merchantCategory || 'General Merchandise',
      amountPaise: data.amountPaise,
      currency: 'INR',
      invoiceId: data.invoiceId,
    };

    return { success: true, payload };
  } catch {
    return {
      success: false,
      error: 'Unrecognized QR code encoding. Please scan a valid PayPal Family merchant QR code or enter the merchant code manually.',
    };
  }
}

/**
 * Encodes a demo merchant payload into a valid JSON string for QR code generation.
 */
export function encodeQRPayload(
  merchantId: string,
  merchantName: string,
  merchantCategory: string,
  amountPaise: number,
  invoiceId?: string
): string {
  const payload: QRPayload = {
    format: DEMO_QR_FORMAT,
    merchantId,
    merchantName,
    merchantCategory,
    amountPaise,
    currency: 'INR',
    invoiceId: invoiceId || `INV-${Date.now().toString().slice(-6)}`,
  };
  return JSON.stringify(payload);
}

/**
 * Curated sample merchants with realistic amounts for immediate testing.
 */
export const DEMO_MERCHANTS: DemoMerchant[] = [
  {
    id: 'MERCH_CAMPUS_CAFE',
    name: 'Campus Cafeteria & Bakery',
    category: 'Dining & Snacks',
    defaultAmountPaise: 18000, // ₹180
    description: 'Artisan sandwiches, fresh juice, and coffee',
    iconName: 'Coffee',
  },
  {
    id: 'MERCH_BOOKSTORE',
    name: 'City Academic Bookstore',
    category: 'Education & Books',
    defaultAmountPaise: 45000, // ₹450
    description: 'Engineering textbooks, notebooks & stationary',
    iconName: 'BookOpen',
  },
  {
    id: 'MERCH_METRO_RAIL',
    name: 'City Metro Transit',
    category: 'Transportation',
    defaultAmountPaise: 25000, // ₹250
    description: 'Smart transit card monthly top-up pass',
    iconName: 'Train',
  },
  {
    id: 'MERCH_PHARMACY',
    name: 'Apollo Health & Wellness',
    category: 'Healthcare',
    defaultAmountPaise: 32000, // ₹320
    description: 'Prescription medicines and personal care',
    iconName: 'ShieldAlert',
  },
  {
    id: 'MERCH_TECH_STORE',
    name: 'GadgetZone Tech Accessories',
    category: 'Electronics',
    defaultAmountPaise: 120000, // ₹1,200 (useful to test single transaction limit violations!)
    description: 'USB-C fast charger, braided cable, and earbuds',
    iconName: 'Laptop',
  },
];

