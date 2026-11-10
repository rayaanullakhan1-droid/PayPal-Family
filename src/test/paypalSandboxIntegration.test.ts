import { describe, it, expect, vi, beforeEach } from 'vitest';
import { payPalSandboxService } from '../services/paypalSandboxService';

describe('PayPal Sandbox Official Integration & Orders API Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // TEST 1: Config Fetching without Exposing Secrets
  it('1. retrieves public PayPal configuration without exposing secret keys', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        clientId: 'MOCK_SANDBOX_CLIENT_ID_123',
        environment: 'sandbox',
        currency: 'USD',
        isConfigured: true,
      }),
    } as any);

    const config = await payPalSandboxService.getServerConfig();

    expect(config.environment).toBe('sandbox');
    expect(config.currency).toBe('USD');
    expect(config.clientId).toBe('MOCK_SANDBOX_CLIENT_ID_123');
    expect((config as any).clientSecret).toBeUndefined();
    expect((config as any).secret).toBeUndefined();
  });

  // TEST 2: Order Creation via Backend Orders v2 API
  it('2. creates PayPal Sandbox order via backend server-to-server Orders API', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        orderId: 'ORD_SANDBOX_987654321',
        status: 'CREATED',
        links: [
          { href: 'https://www.sandbox.paypal.com/checkoutnow?token=ORD_SANDBOX_987654321', rel: 'approve', method: 'GET' },
        ],
      }),
    } as any);

    const result = await payPalSandboxService.createSandboxOrder({
      amountPaise: 500000, // ₹5,000
      description: 'Family Pool Top-Up',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/create-order'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );

    expect(result.orderId).toBe('ORD_SANDBOX_987654321');
    expect(result.status).toBe('CREATED');
  });

  // TEST 3: Order Capture and Server-Side Verification
  it('3. captures approved order and verifies completed status server-side', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        orderId: 'ORD_SANDBOX_987654321',
        status: 'COMPLETED',
        captureId: 'CAP_SANDBOX_112233',
        amount: { currency_code: 'USD', value: '58.82' },
        payer: { name: { given_name: 'Rajesh', surname: 'Sharma' } },
      }),
    } as any);

    const captureResult = await payPalSandboxService.captureSandboxOrder('ORD_SANDBOX_987654321');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/capture-order'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ orderId: 'ORD_SANDBOX_987654321' }),
      })
    );

    expect(captureResult.success).toBe(true);
    expect(captureResult.status).toBe('COMPLETED');
    expect(captureResult.captureId).toBe('CAP_SANDBOX_112233');
  });

  // TEST 4: Graceful Handling of Unconfigured Sandbox Credentials
  it('4. gracefully handles unconfigured backend credentials with descriptive guidance', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: 'PayPal Sandbox is not configured. Please set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in server/.env.',
        isConfigured: false,
      }),
    } as any);

    await expect(
      payPalSandboxService.createSandboxOrder({ amountPaise: 100000 })
    ).rejects.toThrow(/PayPal Sandbox is not configured/);
  });
});

