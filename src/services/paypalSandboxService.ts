/**
 * PayPal Sandbox Integration Service
 *
 * Communicates with the secure Node.js Express backend to execute
 * authentic PayPal Orders API operations without exposing client secrets.
 */

export interface PayPalServerConfig {
  clientId: string;
  environment: 'sandbox' | 'production';
  currency: string;
  isConfigured: boolean;
}

export interface CreateOrderParams {
  amountPaise?: number;
  amountUSD?: number;
  description?: string;
  referenceId?: string;
}

export interface CreateOrderResult {
  orderId: string;
  status: string;
  links?: Array<{ href: string; rel: string; method: string }>;
}

export interface CaptureOrderResult {
  success: boolean;
  orderId: string;
  status: string;
  captureId?: string;
  amount?: { currency_code: string; value: string };
  payer?: any;
  error?: string;
}

export class PayPalSandboxService {
  private apiBase: string;

  constructor() {
    this.apiBase = (import.meta as any).env?.VITE_BACKEND_API_BASE_URL || '/api/paypal';
  }

  /**
   * Fetch public PayPal configuration from the secure backend.
   * Exposes only the public Client ID (never the secret key).
   */
  async getServerConfig(): Promise<PayPalServerConfig> {
    try {
      const res = await fetch(`${this.apiBase}/config`);
      if (!res.ok) {
        return {
          clientId: '',
          environment: 'sandbox',
          currency: 'USD',
          isConfigured: false,
        };
      }
      return await res.json();
    } catch {
      return {
        clientId: '',
        environment: 'sandbox',
        currency: 'USD',
        isConfigured: false,
      };
    }
  }

  /**
   * Request backend to create an authentic PayPal Sandbox order.
   */
  async createSandboxOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
    const res = await fetch(`${this.apiBase}/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const data = await res.json();
    if (!res.ok || !data.orderId) {
      throw new Error(data.error || 'Failed to create PayPal order via backend.');
    }

    return {
      orderId: data.orderId,
      status: data.status,
      links: data.links,
    };
  }

  /**
   * Request backend to capture an approved PayPal Sandbox order.
   */
  async captureSandboxOrder(orderId: string): Promise<CaptureOrderResult> {
    const res = await fetch(`${this.apiBase}/capture-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        orderId,
        status: data.status || 'FAILED',
        error: data.error || 'Failed to capture PayPal Sandbox order.',
      };
    }

    return {
      success: true,
      orderId: data.orderId,
      status: data.status,
      captureId: data.captureId,
      amount: data.amount,
      payer: data.payer,
    };
  }

  /**
   * Readiness checklist detailing PayPal sandbox capabilities.
   */
  getReadinessChecklist() {
    return [
      {
        item: 'Official PayPal JavaScript & React SDK',
        status: 'Ready',
        description: '@paypal/react-paypal-js integrated for rendering official PayPal Checkout buttons.',
      },
      {
        item: 'Secure Node.js & Express Backend',
        status: 'Ready',
        description: 'Server at server/index.js securely authenticates with api-m.sandbox.paypal.com.',
      },
      {
        item: 'PayPal Orders v2 API (Create & Capture)',
        status: 'Ready',
        description: 'Backend implements server-to-server OAuth2 client credentials, order creation, and capture.',
      },
      {
        item: 'Client Secret Protection',
        status: 'Ready',
        description: 'Server credentials are strictly stored on the backend and never bundled in frontend assets.',
      },
    ];
  }
}

export const payPalSandboxService = new PayPalSandboxService();
