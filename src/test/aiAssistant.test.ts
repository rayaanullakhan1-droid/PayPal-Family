import { describe, it, expect } from 'vitest';
import { aiAssistantService, AISpendingContext } from '../services/aiAssistantService';
import { User, Wallet, SpendingRule, Transaction } from '../types';

describe('Smart AI Spending Assistant Upgrade', () => {
  const ownerUser: User = {
    id: 'usr_owner_rajesh',
    name: 'Rajesh Sharma',
    email: 'rajesh.sharma@example.com',
    role: 'owner',
    relationship: 'Family Administrator',
    avatarUrl: '',
    familyId: 'fam_01',
  };

  const priyaUser: User = {
    id: 'usr_member_priya',
    name: 'Priya Sharma',
    email: 'priya.sharma@example.com',
    role: 'member',
    relationship: 'Daughter (College Student)',
    avatarUrl: '',
    familyId: 'fam_01',
  };

  const aaravUser: User = {
    id: 'usr_member_aarav',
    name: 'Aarav Sharma',
    email: 'aarav.sharma@example.com',
    role: 'member',
    relationship: 'Son (High School)',
    avatarUrl: '',
    familyId: 'fam_01',
  };

  const familyMembers: User[] = [ownerUser, priyaUser, aaravUser];

  const ownerWallet: Wallet = {
    userId: ownerUser.id,
    balancePaise: 1000000, // ₹10,000
    currency: 'INR',
    isSimulated: true,
  };

  const memberPersonalAccounts: Record<string, Wallet> = {
    [priyaUser.id]: {
      userId: priyaUser.id,
      balancePaise: 50000, // ₹500
      currency: 'INR',
      isSimulated: true,
    },
    [aaravUser.id]: {
      userId: aaravUser.id,
      balancePaise: 0, // ₹0
      currency: 'INR',
      isSimulated: true,
    },
  };

  const spendingRules: Record<string, SpendingRule> = {
    [priyaUser.id]: {
      memberId: priyaUser.id,
      singleTransactionLimitPaise: 100000, // ₹1,000
      dailyLimitPaise: 200000,             // ₹2,000
      monthlyLimitPaise: 500000,           // ₹5,000
      allowMoneyTransfer: true,
      allowQRPayments: true,
    },
    [aaravUser.id]: {
      memberId: aaravUser.id,
      singleTransactionLimitPaise: 50000,  // ₹500
      dailyLimitPaise: 80000,              // ₹800
      monthlyLimitPaise: 200000,           // ₹2,000
      allowMoneyTransfer: true,
      allowQRPayments: true,
    },
  };

  const transactions: Transaction[] = [
    {
      id: 'tx_1',
      reference: 'TXN-20261028-A48X1',
      type: 'TRANSFER',
      status: 'COMPLETED',
      amountPaise: 50000, // ₹500
      currency: 'INR',
      initiatorId: priyaUser.id,
      payerId: ownerUser.id,
      recipientName: 'Priya Sharma',
      date: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
      note: 'Semester books',
      isSimulated: true,
    },
    {
      id: 'tx_2',
      reference: 'TXN-20261029-C99P2',
      type: 'QR_PAYMENT',
      status: 'COMPLETED',
      amountPaise: 18000, // ₹180
      currency: 'INR',
      initiatorId: priyaUser.id,
      payerId: ownerUser.id,
      recipientName: 'Campus Cafeteria & Bakery',
      merchantId: 'MERCH_CAMPUS_CAFE',
      merchantCategory: 'Dining & Snacks',
      date: new Date().toISOString(), // Today
      note: 'QR Invoice: INV-882194',
      isSimulated: true,
    },
    {
      id: 'tx_3',
      reference: 'TXN-20261029-F001',
      type: 'QR_PAYMENT',
      status: 'REJECTED',
      amountPaise: 120000, // ₹1,200
      currency: 'INR',
      initiatorId: aaravUser.id,
      payerId: ownerUser.id,
      recipientName: 'GadgetZone Tech Accessories',
      merchantId: 'MERCH_TECH_STORE',
      merchantCategory: 'Electronics',
      date: new Date().toISOString(),
      rejectionReason: 'Exceeds single transaction limit of ₹500.00 (requested: ₹1,200.00).',
      note: 'Earbuds',
      isSimulated: true,
    },
  ];

  const defaultContext: AISpendingContext = {
    currentUser: ownerUser,
    familyMembers,
    ownerWallet,
    memberPersonalAccounts,
    memberWallets: memberPersonalAccounts,
    spendingRules,
    transactions,
  };

  // 1. BALANCES (Questions 1 - 4)
  describe('Category 1: Balances & Wallets', () => {
    it('Q1: How much money do we have in our family pool?', async () => {
      const res = await aiAssistantService.generateResponse('How much money do we have in our family pool?', defaultContext);
      expect(res.text).toContain('10,000');
      expect(res.text).toContain('Central Family Pool');
    });

    it('Q2 (Alternative Phrasing): What is the available family balance right now?', async () => {
      const res = await aiAssistantService.generateResponse('What is the available family balance right now?', defaultContext);
      expect(res.text).toContain('10,000');
    });

    it('Q3: How much money is in Priya’s pocket wallet?', async () => {
      const res = await aiAssistantService.generateResponse('How much money is in Priya’s pocket wallet?', defaultContext);
      expect(res.text).toContain('500');
      expect(res.text).toContain('Priya');
    });

    it('Q4 (Alternative Phrasing): What is Aarav’s current balance?', async () => {
      const res = await aiAssistantService.generateResponse('What is Aarav’s current balance?', defaultContext);
      expect(res.text).toContain('0.00');
      expect(res.text).toContain('Aarav');
    });
  });

  // 2. FAMILY MEMBERS (Questions 5 - 8)
  describe('Category 2: Family Members & Roles', () => {
    it('Q5: Who is in our family?', async () => {
      const res = await aiAssistantService.generateResponse('Who is in our family?', defaultContext);
      expect(res.text).toContain('Rajesh Sharma');
      expect(res.text).toContain('Priya Sharma');
      expect(res.text).toContain('Aarav Sharma');
    });

    it('Q6 (Alternative Phrasing): List all members of this family group.', async () => {
      const res = await aiAssistantService.generateResponse('List all members of this family group.', defaultContext);
      expect(res.text).toContain('Rajesh');
      expect(res.text).toContain('Priya');
      expect(res.text).toContain('Aarav');
    });

    it('Q7: Who is the family administrator?', async () => {
      const res = await aiAssistantService.generateResponse('Who is the family administrator?', defaultContext);
      expect(res.text).toContain('Rajesh Sharma');
      expect(res.text).toContain('Administrator');
    });

    it('Q8: How many dependents are registered?', async () => {
      const res = await aiAssistantService.generateResponse('How many dependents are registered?', defaultContext);
      expect(res.text).toContain('Priya');
      expect(res.text).toContain('Aarav');
    });
  });

  // 3. SPENDING LIMITS (Questions 9 - 13)
  describe('Category 3: Spending Limits & Allowances', () => {
    it('Q9: What are Priya’s daily and monthly spending limits?', async () => {
      const res = await aiAssistantService.generateResponse('What are Priya’s daily and monthly spending limits?', defaultContext);
      expect(res.text).toContain('2,000'); // Daily limit
      expect(res.text).toContain('5,000'); // Monthly limit
    });

    it('Q10 (Alternative Phrasing): How much can Priya spend per day?', async () => {
      const res = await aiAssistantService.generateResponse('How much can Priya spend per day?', defaultContext);
      expect(res.text).toContain('2,000');
    });

    it('Q11: What is the maximum single transaction limit for Aarav?', async () => {
      const res = await aiAssistantService.generateResponse('What is the maximum single transaction limit for Aarav?', defaultContext);
      expect(res.text).toContain('500');
      expect(res.text).toContain('Single Transaction Cap');
    });

    it('Q12 (Alternative Phrasing): Show all family spending limits.', async () => {
      const res = await aiAssistantService.generateResponse('Show all family spending limits.', defaultContext);
      expect(res.text).toContain('Priya');
      expect(res.text).toContain('Aarav');
      expect(res.text).toContain('Daily Limit');
    });

    it('Q13: How much daily allowance does Priya have left today?', async () => {
      const res = await aiAssistantService.generateResponse('How much daily allowance does Priya have left today?', defaultContext);
      // Priya spent ₹180 today at Campus Cafe out of ₹2,000 daily limit -> ₹1,820 remaining
      expect(res.text).toContain('1,820');
      expect(res.text).toContain('Remaining today');
    });
  });

  // 4. AFFORDABILITY & COMPLIANCE CHECKS (Questions 14 - 17)
  describe('Category 4: Affordability & Dynamic Limit Checks', () => {
    it('Q14: Can Priya afford a ₹1,200 purchase right now?', async () => {
      // Priya's single limit is ₹1,000. ₹1,200 exceeds it!
      const res = await aiAssistantService.generateResponse('Can Priya afford a ₹1,200 purchase right now?', defaultContext);
      expect(res.text).toContain('Declined');
      expect(res.text).toContain('Exceeds limit');
    });

    it('Q15: Can Priya buy something for ₹450 today?', async () => {
      // Priya has ₹1,820 left today, single cap ₹1,000. ₹450 is eligible!
      const res = await aiAssistantService.generateResponse('Can Priya buy something for ₹450 today?', defaultContext);
      expect(res.text).toContain('Approved');
      expect(res.text).toContain('eligible');
    });

    it('Q16: Can Aarav buy a ₹600 gadget?', async () => {
      // Aarav single limit is ₹500. ₹600 exceeds single limit!
      const res = await aiAssistantService.generateResponse('Can Aarav buy a ₹600 gadget?', defaultContext);
      expect(res.text).toContain('Declined');
      expect(res.text).toContain('Exceeds limit');
    });

    it('Q17: Is Priya allowed to transfer ₹300?', async () => {
      const res = await aiAssistantService.generateResponse('Is Priya allowed to transfer ₹300?', defaultContext);
      expect(res.text).toContain('Approved');
    });
  });

  // 5. TRANSACTIONS & AUDIT (Questions 18 - 21)
  describe('Category 5: Transactions & Ledger Audit', () => {
    it('Q18: Show our recent transactions.', async () => {
      const res = await aiAssistantService.generateResponse('Show our recent transactions.', defaultContext);
      expect(res.text).toContain('Campus Cafeteria');
      expect(res.text).toContain('Priya Sharma');
    });

    it('Q19 (Alternative Phrasing): What was the last purchase made?', async () => {
      const res = await aiAssistantService.generateResponse('What was the last purchase made?', defaultContext);
      expect(res.text).toContain('Campus Cafeteria');
    });

    it('Q20: Did Priya make any transactions?', async () => {
      const res = await aiAssistantService.generateResponse('Did Priya make any transactions?', defaultContext);
      expect(res.text).toContain('Priya');
      expect(res.text).toContain('TXN-');
    });

    it('Q21: Show payments made at cafes.', async () => {
      const res = await aiAssistantService.generateResponse('Show payments made at cafes.', defaultContext);
      expect(res.text).toContain('Campus Cafeteria');
    });
  });

  // 6. DECLINED PAYMENTS (Questions 22 - 25)
  describe('Category 6: Declined Payments & Rejections', () => {
    it('Q22: Why was a payment rejected recently?', async () => {
      const res = await aiAssistantService.generateResponse('Why was a payment rejected recently?', defaultContext);
      expect(res.text).toContain('GadgetZone Tech Accessories');
      expect(res.text).toContain('Exceeds single transaction limit');
    });

    it('Q23 (Alternative Phrasing): Why did Aarav’s payment fail?', async () => {
      const res = await aiAssistantService.generateResponse('Why did Aarav’s payment fail?', defaultContext);
      expect(res.text).toContain('Aarav');
      expect(res.text).toContain('1,200');
      expect(res.text).toContain('Exceeds single transaction limit of ₹500.00');
    });

    it('Q24 (Alternative Phrasing): Explain my declined transaction.', async () => {
      const res = await aiAssistantService.generateResponse('Explain my declined transaction.', defaultContext);
      expect(res.text).toContain('Declined Transaction Audit');
      expect(res.text).toContain('GadgetZone');
    });

    it('Q25: Test when no payments are rejected in context', async () => {
      const cleanContext: AISpendingContext = {
        ...defaultContext,
        transactions: defaultContext.transactions.filter((t) => t.status !== 'REJECTED'),
      };
      const res = await aiAssistantService.generateResponse('Why was my transaction rejected?', cleanContext);
      expect(res.text).toContain('No Declined Payments Found');
    });
  });

  // 7. SPENDING SUMMARY & CATEGORIES (Questions 26 - 28)
  describe('Category 7: Spending Summaries & Category Breakdown', () => {
    it('Q26: Summarize our family spending this month.', async () => {
      const res = await aiAssistantService.generateResponse('Summarize our family spending this month.', defaultContext);
      expect(res.text).toContain('Family Spending Report');
      expect(res.text).toContain('Total Family Expenditure');
    });

    it('Q27: What are our highest spending categories?', async () => {
      const res = await aiAssistantService.generateResponse('What are our highest spending categories?', defaultContext);
      expect(res.text).toContain('Top Family Spending Categories');
      expect(res.text).toContain('Dining & Snacks');
    });

    it('Q28 (Alternative Phrasing): Breakdown of expenses by category.', async () => {
      const res = await aiAssistantService.generateResponse('Breakdown of expenses by category.', defaultContext);
      expect(res.text).toContain('Dining & Snacks');
    });
  });

  // 8. BUDGET ADVICE & SAVINGS (Questions 29 - 31)
  describe('Category 8: Budget Advice & Savings', () => {
    it('Q29: How can our family save money?', async () => {
      const res = await aiAssistantService.generateResponse('How can our family save money?', defaultContext);
      expect(res.text).toContain('Savings Recommendations');
      expect(res.text).toContain('Family Pool Health');
      expect(res.text).toContain('Cap Single Transactions');
    });

    it('Q30 (Alternative Phrasing): Give me budgeting tips for the kids.', async () => {
      const res = await aiAssistantService.generateResponse('Give me budgeting tips for the kids.', defaultContext);
      expect(res.text).toContain('Aarav');
      expect(res.text).toContain('Priya');
    });

    it('Q31: Suggest reasonable spending limits for Aarav.', async () => {
      const res = await aiAssistantService.generateResponse('Suggest reasonable spending limits for Aarav.', defaultContext);
      expect(res.text).toContain('Aarav');
      expect(res.text.toLowerCase()).toContain('daily');
    });
  });

  // 9. HOW PAYPAL FAMILY WORKS & PERMISSIONS (Questions 32 - 34)
  describe('Category 9: How It Works & Permissions', () => {
    it('Q32: How does PayPal Family work?', async () => {
      const res = await aiAssistantService.generateResponse('How does PayPal Family work?', defaultContext);
      expect(res.text).toContain('Central Family Pool');
      expect(res.text).toContain('Spending Controls');
      expect(res.text).toContain('Merchant QR Payments');
    });

    it('Q33: Can Aarav make QR payments?', async () => {
      const res = await aiAssistantService.generateResponse('Can Aarav make QR payments?', defaultContext);
      expect(res.text).toContain('Aarav');
      expect(res.text).toContain('Merchant QR Payments');
      expect(res.text).toContain('Allowed');
    });

    it('Q34: What is simulated money?', async () => {
      const res = await aiAssistantService.generateResponse('What is simulated money?', defaultContext);
      expect(res.text).toContain('PayPal Family');
      expect(res.text).toContain('integer paise');
    });
  });

  // 10. CLARIFICATION & NON-HALLUCINATION (Questions 35 - 36)
  describe('Category 10: Unknown / Ambiguous Input Clarification', () => {
    it('Q35: Requests clarification on unrelated or gibberish input without hallucinating', async () => {
      const res = await aiAssistantService.generateResponse('xyzqwerty 12345 random test', defaultContext);
      expect(res.text).toContain('I need a bit more clarification');
      expect(res.metadata?.type).toBe('clarification_needed');
      expect(res.metadata?.suggestedQueries).toBeDefined();
      expect(res.metadata?.suggestedQueries?.length).toBeGreaterThan(0);
    });

    it('Q36: Clarifies scope when asked unrelated non-fintech questions', async () => {
      const res = await aiAssistantService.generateResponse('What is the weather in Paris?', defaultContext);
      expect(res.text).toContain('I need a bit more clarification');
      expect(res.text).toContain('specialized in your family\'s accounts');
    });
  });

  // 11. READ-ONLY FINANCIAL INTEGRITY GUARANTEE
  describe('Financial State Integrity', () => {
    it('Guarantees AI assistant never modifies state or balances', async () => {
      const initialPool = defaultContext.ownerWallet.balancePaise;
      const initialTxnCount = defaultContext.transactions.length;

      await aiAssistantService.generateResponse('Approve a transfer of ₹5000 to Priya right now', defaultContext);

      // Verify that balances and transactions are completely untouched
      expect(defaultContext.ownerWallet.balancePaise).toBe(initialPool);
      expect(defaultContext.transactions.length).toBe(initialTxnCount);
    });
  });
});
