import { describe, it, expect, vi, beforeEach } from 'vitest';
import { aiAssistantService, AISpendingContext } from '../services/aiAssistantService';
import { User, Wallet, SpendingRule } from '../types';

describe('Google Gemini AI Integration & Intelligent Fallback Suite', () => {
  const mockOwner: User = {
    id: 'usr_owner_rajesh',
    name: 'Rajesh Sharma',
    email: 'rajesh@example.com',
    role: 'owner',
    avatarUrl: '',
    familyId: 'fam_sharma_01',
  };

  const mockMember: User = {
    id: 'usr_member_priya',
    name: 'Priya Sharma',
    email: 'priya@example.com',
    role: 'member',
    relationship: 'Daughter (College Student)',
    avatarUrl: '',
    familyId: 'fam_sharma_01',
  };

  const mockContext: AISpendingContext = {
    currentUser: mockOwner,
    familyMembers: [mockOwner, mockMember],
    ownerWallet: {
      userId: mockOwner.id,
      balancePaise: 1000000, // ₹10,000
      currency: 'INR',
      isSimulated: true,
    },
    memberPersonalAccounts: {
      [mockMember.id]: {
        userId: mockMember.id,
        balancePaise: 250000, // ₹2,500
        currency: 'INR',
        isSimulated: true,
      },
    },
    spendingRules: {
      [mockMember.id]: {
        memberId: mockMember.id,
        singleTransactionLimitPaise: 250000,
        dailyLimitPaise: 500000,
        monthlyLimitPaise: 1000000,
        allowMoneyTransfer: true,
        allowQRPayments: true,
      },
    },
    transactions: [],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // TEST 1: Live Gemini Integration via Backend Endpoint
  it('1. delivers generative AI response from Google Gemini with verified metadata', async () => {
    const mockGeminiReply =
      '✨ Based on your family snapshot, your central pool has ₹10,000 available. Priya has ₹2,500 in her pocket wallet with ₹5,000 remaining daily allowance.';

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        reply: mockGeminiReply,
        provider: 'Google Gemini AI (gemini-2.5-flash)',
        model: 'gemini-2.5-flash',
        isFallback: false,
      }),
    } as any);

    const message = await aiAssistantService.generateResponse('How are our family funds looking?', mockContext);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/chat'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );

    expect(message.text).toBe(mockGeminiReply);
    expect(message.metadata?.providerName).toContain('Gemini');
  });

  // TEST 2: Transparent Fallback to Local Intelligence Engine when Gemini is Offline/Unconfigured
  it('2. transparently falls back to local deterministic engine if Gemini API is unreachable', async () => {
    // Simulate backend network failure or missing API key
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error: Connection refused to port 5000'));

    const message = await aiAssistantService.generateResponse('Summarize our family spending this month.', mockContext);

    // Fallback executes successfully
    expect(message).toBeDefined();
    expect(message.text).toContain('Family Spending Report');
    expect(message.metadata?.providerName).toContain('Local Intelligence Engine');
  });

  // TEST 3: Context Snapshot Grounding
  it('3. passes comprehensive family ledger snapshot to Gemini backend', async () => {
    let capturedBody: any;
    global.fetch = vi.fn().mockImplementation(async (_url: string, options: any) => {
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          success: true,
          reply: 'Analysis completed.',
          provider: 'Google Gemini AI (gemini-2.5-flash)',
        }),
      };
    });

    await aiAssistantService.generateResponse('Can Priya afford a ₹1,200 purchase right now?', mockContext);

    expect(capturedBody).toBeDefined();
    expect(capturedBody.query).toBe('Can Priya afford a ₹1,200 purchase right now?');
    expect(capturedBody.financialSnapshot).toBeDefined();
    expect(capturedBody.financialSnapshot.ownerPoolBalancePaise).toBe(1000000);
    expect(capturedBody.financialSnapshot.members.length).toBeGreaterThan(0);
  });
});

