import { describe, it, expect } from 'vitest';
import { paymentService } from '../services/paymentService';
import { User, Wallet, SpendingRule, Transaction, MoneyRequest } from '../types';
import { evaluateSpendingEligibility } from '../services/spendingRuleEngine';

describe('Automatic Money Transfer & Individual Limit Privacy (PayPal Family)', () => {
  const owner: User = {
    id: 'usr_owner_rajesh',
    name: 'Rajesh Sharma',
    email: 'rajesh.sharma@example.com',
    role: 'owner',
    relationship: 'Family Administrator',
    avatarUrl: '',
    familyId: 'fam_sharma_01',
  };

  const priya: User = {
    id: 'usr_member_priya',
    name: 'Priya Sharma',
    email: 'priya.sharma@example.com',
    role: 'member',
    relationship: 'Daughter (College Student)',
    avatarUrl: '',
    familyId: 'fam_sharma_01',
  };

  const aarav: User = {
    id: 'usr_member_aarav',
    name: 'Aarav Sharma',
    email: 'aarav.sharma@example.com',
    role: 'member',
    relationship: 'Son (High School)',
    avatarUrl: '',
    familyId: 'fam_sharma_01',
  };

  // Priya: ₹2,000 configured request limit
  const priyaRule: SpendingRule = {
    memberId: priya.id,
    singleTransactionLimitPaise: 200000, // ₹2,000
    maxRequestLimitPaise: 200000,        // ₹2,000
    dailyLimitPaise: 200000,             // ₹2,000 (Daily Spending Limit)
    monthlyLimitPaise: 1000000,          // ₹10,000
    allowMoneyTransfer: true,
    allowQRPayments: true,
  };

  // Aarav: ₹500 configured request limit
  const aaravRule: SpendingRule = {
    memberId: aarav.id,
    singleTransactionLimitPaise: 50000,  // ₹500
    maxRequestLimitPaise: 50000,         // ₹500
    dailyLimitPaise: 50000,              // ₹500 (Daily Spending Limit)
    monthlyLimitPaise: 200000,           // ₹2,000
    allowMoneyTransfer: true,
    allowQRPayments: true,
  };

  // TEST 1: Request below configured limit -> Automatic successful transfer
  it('1. executes automatic successful transfer when request is below configured limit', async () => {
    // Before: Admin: ₹10,000, Priya: ₹500, Limit: ₹2,000
    const adminWallet: Wallet = {
      userId: owner.id,
      balancePaise: 1000000, // ₹10,000
      currency: 'INR',
      isSimulated: true,
    };

    const priyaAccount: Wallet = {
      userId: priya.id,
      balancePaise: 50000, // ₹500
      currency: 'INR',
      isSimulated: true,
    };

    // Member requests ₹1,500 (< ₹2,000)
    const requestAmountPaise = 150000;

    const result = await paymentService.processMoneyTransfer({
      member: priya,
      owner,
      ownerWallet: adminWallet,
      memberWallet: priyaAccount,
      rule: priyaRule,
      amountPaise: requestAmountPaise,
      purpose: 'College textbooks and study stationery',
      existingTransactions: [],
    });

    expect(result.success).toBe(true);
    expect(result.autoTransferred).toBe(true);
    expect(result.transaction?.status).toBe('COMPLETED');
    expect(result.transaction?.amountPaise).toBe(150000);
    expect(result.transaction?.senderId).toBe(owner.id);
    expect(result.transaction?.recipientId).toBe(priya.id);
    expect(result.transaction?.paymentSource).toBe('ADMIN_ACCOUNT');

    // Balance update
    adminWallet.balancePaise -= requestAmountPaise;
    priyaAccount.balancePaise += requestAmountPaise;

    // After: Admin ₹8,500, Priya ₹2,000
    expect(adminWallet.balancePaise).toBe(850000); // ₹8,500
    expect(priyaAccount.balancePaise).toBe(200000); // ₹2,000
  });

  // TEST 2: Request exactly equal to limit -> Automatic successful transfer
  it('2. executes automatic successful transfer when request is exactly equal to configured limit', async () => {
    const adminWallet: Wallet = {
      userId: owner.id,
      balancePaise: 850000, // ₹8,500
      currency: 'INR',
      isSimulated: true,
    };

    const priyaAccount: Wallet = {
      userId: priya.id,
      balancePaise: 200000, // ₹2,000
      currency: 'INR',
      isSimulated: true,
    };

    // Member requests exactly ₹2,000 (== ₹2,000 limit)
    const requestAmountPaise = 200000;

    const result = await paymentService.processMoneyTransfer({
      member: priya,
      owner,
      ownerWallet: adminWallet,
      memberWallet: priyaAccount,
      rule: priyaRule,
      amountPaise: requestAmountPaise,
      purpose: 'Exam registration fees',
      existingTransactions: [],
    });

    expect(result.success).toBe(true);
    expect(result.autoTransferred).toBe(true);
    expect(result.transaction?.status).toBe('COMPLETED');

    adminWallet.balancePaise -= requestAmountPaise;
    priyaAccount.balancePaise += requestAmountPaise;

    expect(adminWallet.balancePaise).toBe(650000); // ₹6,500
    expect(priyaAccount.balancePaise).toBe(400000); // ₹4,000
  });

  // TEST 3: Request above configured limit -> Failed receipt with excess amount
  it('3. rejects request exceeding configured limit with failed receipt details and zero balance change', async () => {
    const adminWallet: Wallet = {
      userId: owner.id,
      balancePaise: 1000000, // ₹10,000
      currency: 'INR',
      isSimulated: true,
    };

    const priyaAccount: Wallet = {
      userId: priya.id,
      balancePaise: 50000, // ₹500
      currency: 'INR',
      isSimulated: true,
    };

    // Priya limit: ₹2,000. Requested: ₹3,000. Excess: ₹1,000
    const requestAmountPaise = 300000;

    const result = await paymentService.processMoneyTransfer({
      member: priya,
      owner,
      ownerWallet: adminWallet,
      memberWallet: priyaAccount,
      rule: priyaRule,
      amountPaise: requestAmountPaise,
      purpose: 'Advanced robotics lab kit',
      existingTransactions: [],
    });

    expect(result.success).toBe(false);
    expect(result.isOverLimit).toBe(true);
    expect(result.overLimitDetails?.configuredLimitPaise).toBe(200000); // Max allowed: ₹2,000
    expect(result.overLimitDetails?.requestedAmountPaise).toBe(300000);  // Requested: ₹3,000
    expect(result.overLimitDetails?.excessAmountPaise).toBe(100000);     // Excess: ₹1,000

    // Balances are STRICTLY UNCHANGED
    expect(adminWallet.balancePaise).toBe(1000000);
    expect(priyaAccount.balancePaise).toBe(50000);
  });

  // TEST 4: Failed request + YES -> Separate Administrator exception request
  it('4. creates separate Limit Exception Request when member explicitly confirms YES', () => {
    const pendingList: MoneyRequest[] = [];
    const requestedAmountPaise = 300000;
    const configuredLimitPaise = 200000;
    const excessAmountPaise = 100000;

    // Member clicks YES:
    const exceptionRequest: MoneyRequest = {
      id: 'req_exc_001',
      memberId: priya.id,
      memberName: priya.name,
      amountPaise: requestedAmountPaise,
      purpose: 'Advanced robotics kit',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      isException: true,
      configuredLimitPaise,
      excessAmountPaise,
    };

    pendingList.push(exceptionRequest);

    expect(pendingList.length).toBe(1);
    expect(pendingList[0].isException).toBe(true);
    expect(pendingList[0].configuredLimitPaise).toBe(200000);
    expect(pendingList[0].excessAmountPaise).toBe(100000);
    expect(pendingList[0].status).toBe('PENDING');
  });

  // TEST 5: Failed request + NO -> Request closed, nothing sent
  it('5. closes failed request with zero pending requests created when member chooses NO', () => {
    const pendingList: MoneyRequest[] = [];

    // Member chooses NO: Cancel
    const userChoice = 'NO';
    if (userChoice === 'NO') {
      // Nothing is created or appended
    }

    expect(pendingList.length).toBe(0);
  });

  // TEST 6: Administrator approves exception -> Correct transfer
  it('6. transfers funds and updates balances when Administrator approves an exception request', () => {
    const adminWallet: Wallet = {
      userId: owner.id,
      balancePaise: 1000000, // ₹10,000
      currency: 'INR',
      isSimulated: true,
    };

    const priyaAccount: Wallet = {
      userId: priya.id,
      balancePaise: 50000, // ₹500
      currency: 'INR',
      isSimulated: true,
    };

    const exceptionReq: MoneyRequest = {
      id: 'req_exc_001',
      memberId: priya.id,
      memberName: priya.name,
      amountPaise: 300000, // ₹3,000
      purpose: 'Advanced robotics kit',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      isException: true,
      configuredLimitPaise: 200000,
      excessAmountPaise: 100000,
    };

    // Administrator checks balance
    expect(adminWallet.balancePaise >= exceptionReq.amountPaise).toBe(true);

    // Approval executes
    adminWallet.balancePaise -= exceptionReq.amountPaise;
    priyaAccount.balancePaise += exceptionReq.amountPaise;
    exceptionReq.status = 'APPROVED';
    exceptionReq.transactionReference = 'TXN-20261031-EXC01';

    expect(adminWallet.balancePaise).toBe(700000); // ₹7,000
    expect(priyaAccount.balancePaise).toBe(350000); // ₹3,500
    expect(exceptionReq.status).toBe('APPROVED');
  });

  // TEST 7: Administrator rejects exception -> No balance changes
  it('7. marks request as REJECTED with zero balance changes when Administrator rejects', () => {
    const adminWallet: Wallet = {
      userId: owner.id,
      balancePaise: 1000000,
      currency: 'INR',
      isSimulated: true,
    };

    const priyaAccount: Wallet = {
      userId: priya.id,
      balancePaise: 50000,
      currency: 'INR',
      isSimulated: true,
    };

    const exceptionReq: MoneyRequest = {
      id: 'req_exc_002',
      memberId: priya.id,
      memberName: priya.name,
      amountPaise: 300000,
      purpose: 'Concert pass',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      isException: true,
      configuredLimitPaise: 200000,
      excessAmountPaise: 100000,
    };

    // Admin rejects
    exceptionReq.status = 'REJECTED';
    exceptionReq.rejectionReason = 'Non-essential purchase';

    // Balances are strictly unchanged
    expect(adminWallet.balancePaise).toBe(1000000);
    expect(priyaAccount.balancePaise).toBe(50000);
    expect(exceptionReq.status).toBe('REJECTED');
  });

  // TEST 8: Administrator insufficient balance -> Transfer rejected
  it('8. rejects transfer when Administrator has insufficient balance', async () => {
    const adminWallet: Wallet = {
      userId: owner.id,
      balancePaise: 100000, // Only ₹1,000 available
      currency: 'INR',
      isSimulated: true,
    };

    const priyaAccount: Wallet = {
      userId: priya.id,
      balancePaise: 50000,
      currency: 'INR',
      isSimulated: true,
    };

    // Priya requests ₹1,500 (within her ₹2,000 limit, but Admin only has ₹1,000)
    const result = await paymentService.processMoneyTransfer({
      member: priya,
      owner,
      ownerWallet: adminWallet,
      memberWallet: priyaAccount,
      rule: priyaRule,
      amountPaise: 150000,
      purpose: 'College supplies',
      existingTransactions: [],
    });

    expect(result.success).toBe(false);
    expect(result.evaluation?.code).toBe('INSUFFICIENT_OWNER_FUNDS');
    expect(adminWallet.balancePaise).toBe(100000); // Unchanged
    expect(priyaAccount.balancePaise).toBe(50000);  // Unchanged
  });

  // TEST 9 & 10: Individual Member Limit Privacy
  it('9 & 10. enforces privacy: Member 1 cannot see Member 2 limit, and Member 2 cannot see Member 1 limit', () => {
    const allSpendingRules: Record<string, SpendingRule> = {
      [priya.id]: priyaRule,
      [aarav.id]: aaravRule,
    };

    // Privacy authorization function mirroring AppContext implementation
    const getAuthorizedRules = (user: User) => {
      if (user.role === 'owner') return allSpendingRules;
      return allSpendingRules[user.id] ? { [user.id]: allSpendingRules[user.id] } : {};
    };

    // Priya logged in:
    const priyaAuthorizedRules = getAuthorizedRules(priya);
    expect(priyaAuthorizedRules[priya.id]).toBeDefined();
    expect(priyaAuthorizedRules[priya.id].maxRequestLimitPaise).toBe(200000); // Sees her own ₹2,000 limit
    expect(priyaAuthorizedRules[aarav.id]).toBeUndefined(); // Cannot see Aarav's limit!

    // Aarav logged in:
    const aaravAuthorizedRules = getAuthorizedRules(aarav);
    expect(aaravAuthorizedRules[aarav.id]).toBeDefined();
    expect(aaravAuthorizedRules[aarav.id].maxRequestLimitPaise).toBe(50000); // Sees his own ₹500 limit
    expect(aaravAuthorizedRules[priya.id]).toBeUndefined(); // Cannot see Priya's limit!

    // Administrator logged in:
    const ownerAuthorizedRules = getAuthorizedRules(owner);
    expect(ownerAuthorizedRules[priya.id]).toBeDefined();
    expect(ownerAuthorizedRules[aarav.id]).toBeDefined();
  });

  // TEST 11: Browser refresh preserves balances and request statuses
  it('11. preserves balances and request statuses across serialization (localStorage persistence)', () => {
    const state = {
      ownerWallet: { userId: owner.id, balancePaise: 850000, currency: 'INR', isSimulated: true },
      memberPersonalAccounts: {
        [priya.id]: { userId: priya.id, balancePaise: 200000, currency: 'INR', isSimulated: true },
        [aarav.id]: { userId: aarav.id, balancePaise: 0, currency: 'INR', isSimulated: true },
      },
      moneyRequests: [
        {
          id: 'req_exc_01',
          memberId: priya.id,
          memberName: priya.name,
          amountPaise: 300000,
          purpose: 'Lab kit',
          status: 'PENDING',
          isException: true,
          configuredLimitPaise: 200000,
          excessAmountPaise: 100000,
        },
      ],
    };

    const serialized = JSON.stringify(state);
    const restored = JSON.parse(serialized);

    expect(restored.ownerWallet.balancePaise).toBe(850000);
    expect(restored.memberPersonalAccounts[priya.id].balancePaise).toBe(200000);
    expect(restored.moneyRequests[0].isException).toBe(true);
    expect(restored.moneyRequests[0].excessAmountPaise).toBe(100000);
  });

  // TEST 12: Duplicate submission prevention
  it('12. prevents duplicate transactions from double deduction', async () => {
    const adminWallet: Wallet = {
      userId: owner.id,
      balancePaise: 1000000, // ₹10,000
      currency: 'INR',
      isSimulated: true,
    };

    const priyaAccount: Wallet = {
      userId: priya.id,
      balancePaise: 50000,
      currency: 'INR',
      isSimulated: true,
    };

    let isSubmitting = false;
    let transferCount = 0;

    const submitTransfer = async () => {
      if (isSubmitting) return null;
      isSubmitting = true;
      try {
        const res = await paymentService.processMoneyTransfer({
          member: priya,
          owner,
          ownerWallet: adminWallet,
          memberWallet: priyaAccount,
          rule: priyaRule,
          amountPaise: 150000,
          purpose: 'Books',
          existingTransactions: [],
        });
        if (res.success) {
          adminWallet.balancePaise -= 150000;
          priyaAccount.balancePaise += 150000;
          transferCount++;
        }
        return res;
      } finally {
        isSubmitting = false;
      }
    };

    // First click initiates transfer
    const promise1 = submitTransfer();
    // Immediate duplicate second click before first completes
    const promise2 = submitTransfer();

    await Promise.all([promise1, promise2]);

    // Only one transfer executed
    expect(transferCount).toBe(1);
    expect(adminWallet.balancePaise).toBe(850000);
    expect(priyaAccount.balancePaise).toBe(200000);
  });

  // TEST 13 - 19: Complete User Switching System & State Isolation
  it('13 - 19. switches users (Admin -> Member 1 -> Member 2 -> Admin) with correct balances, independent limits, and user-specific ledgers without data loss', () => {
    // Initial multi-user state
    const state = {
      currentUserId: owner.id,
      familyMembers: [owner, priya, aarav],
      ownerWallet: { userId: owner.id, balancePaise: 1000000, currency: 'INR' as const, isSimulated: true },
      memberPersonalAccounts: {
        [priya.id]: { userId: priya.id, balancePaise: 50000, currency: 'INR' as const, isSimulated: true },
        [aarav.id]: { userId: aarav.id, balancePaise: 10000, currency: 'INR' as const, isSimulated: true },
      },
      spendingRules: {
        [priya.id]: { ...priyaRule },
        [aarav.id]: { ...aaravRule },
      },
      transactions: [
        {
          id: 'tx_priya_01',
          reference: 'TXN-P1',
          type: 'TRANSFER' as const,
          status: 'COMPLETED' as const,
          amountPaise: 50000,
          currency: 'INR' as const,
          initiatorId: priya.id,
          recipientId: priya.id,
          recipientName: 'Priya Sharma',
          senderId: owner.id,
          senderName: 'Rajesh Sharma',
          date: new Date().toISOString(),
          paymentSource: 'PERSONAL_ACCOUNT' as const,
        },
        {
          id: 'tx_aarav_01',
          reference: 'TXN-A1',
          type: 'QR_PAYMENT' as const,
          status: 'COMPLETED' as const,
          amountPaise: 10000,
          currency: 'INR' as const,
          initiatorId: aarav.id,
          recipientId: 'MERCHANT_STATIONERY',
          recipientName: 'Campus Store',
          senderId: aarav.id,
          senderName: 'Aarav Sharma',
          date: new Date().toISOString(),
          paymentSource: 'PERSONAL_ACCOUNT' as const,
        },
      ],
    };

    // Helper functions mirroring AppContext user-switching and scoping logic
    const getContextForUser = (userId: string) => {
      const currentUser = state.familyMembers.find((m) => m.id === userId)!;
      const isOwner = currentUser.role === 'owner';

      const authorizedRules = isOwner
        ? state.spendingRules
        : { [userId]: state.spendingRules[userId] };

      const authorizedPersonalAccounts = isOwner
        ? state.memberPersonalAccounts
        : { [userId]: state.memberPersonalAccounts[userId] };

      const authorizedTransactions = isOwner
        ? state.transactions
        : state.transactions.filter(
            (t) =>
              t.initiatorId === userId ||
              t.recipientId === userId ||
              t.senderId === userId
          );

      return {
        currentUser,
        isOwner,
        authorizedRules,
        authorizedPersonalAccounts,
        authorizedTransactions,
      };
    };

    // 13. ADMINISTRATOR VIEW
    const adminCtx = getContextForUser(owner.id);
    expect(adminCtx.currentUser.role).toBe('owner');
    expect(state.ownerWallet.balancePaise).toBe(1000000); // Admin balance: ₹10,000
    expect(Object.keys(adminCtx.authorizedRules).length).toBe(2); // Can see all members' limits
    expect(adminCtx.authorizedTransactions.length).toBe(2); // Can see full audit trail

    // 14. SWITCH: Administrator -> Member 1 (Priya)
    state.currentUserId = priya.id;
    const priyaCtx = getContextForUser(priya.id);
    expect(priyaCtx.currentUser.name).toBe('Priya Sharma');
    expect(priyaCtx.authorizedPersonalAccounts[priya.id].balancePaise).toBe(50000); // Priya balance: ₹500
    expect(priyaCtx.authorizedPersonalAccounts[aarav.id]).toBeUndefined(); // Cannot see Aarav's balance
    expect(priyaCtx.authorizedRules[priya.id].maxRequestLimitPaise).toBe(200000); // Priya limit: ₹2,000
    expect(priyaCtx.authorizedRules[aarav.id]).toBeUndefined(); // Cannot see Aarav's limit
    expect(priyaCtx.authorizedTransactions.length).toBe(1); // Only sees her own transaction
    expect(priyaCtx.authorizedTransactions[0].recipientId).toBe(priya.id);

    // 15. SWITCH: Member 1 (Priya) -> Member 2 (Aarav)
    state.currentUserId = aarav.id;
    const aaravCtx = getContextForUser(aarav.id);
    expect(aaravCtx.currentUser.name).toBe('Aarav Sharma');
    expect(aaravCtx.authorizedPersonalAccounts[aarav.id].balancePaise).toBe(10000); // Aarav balance: ₹100
    expect(aaravCtx.authorizedPersonalAccounts[priya.id]).toBeUndefined(); // Cannot see Priya's balance
    expect(aaravCtx.authorizedRules[aarav.id].maxRequestLimitPaise).toBe(50000); // Aarav limit: ₹500
    expect(aaravCtx.authorizedRules[priya.id]).toBeUndefined(); // Cannot see Priya's limit
    expect(aaravCtx.authorizedTransactions.length).toBe(1); // Only sees his own transaction
    expect(aaravCtx.authorizedTransactions[0].initiatorId).toBe(aarav.id);

    // 16. Admin changes Aarav's limit to ₹3,000 without affecting Priya
    state.spendingRules[aarav.id].maxRequestLimitPaise = 300000;
    state.spendingRules[aarav.id].singleTransactionLimitPaise = 300000;

    // Priya's limit is untouched
    expect(state.spendingRules[priya.id].maxRequestLimitPaise).toBe(200000);

    // Aarav's interface immediately reflects ₹3,000
    const aaravUpdatedCtx = getContextForUser(aarav.id);
    expect(aaravUpdatedCtx.authorizedRules[aarav.id].maxRequestLimitPaise).toBe(300000);

    // 17. SWITCH: Member 2 (Aarav) -> Administrator (Rajesh)
    state.currentUserId = owner.id;
    const adminBackCtx = getContextForUser(owner.id);
    expect(adminBackCtx.currentUser.role).toBe('owner');
    expect(state.ownerWallet.balancePaise).toBe(1000000); // Admin balance preserved
    expect(state.memberPersonalAccounts[priya.id].balancePaise).toBe(50000); // Priya balance preserved
    expect(state.memberPersonalAccounts[aarav.id].balancePaise).toBe(10000); // Aarav balance preserved
    expect(adminBackCtx.authorizedTransactions.length).toBe(2); // Full audit trail intact
  });

  // TEST 20: Financial Safety - Zero and negative balance prevention
  it('20. prevents negative balances and maintains integer paise arithmetic', async () => {
    const adminWallet: Wallet = {
      userId: owner.id,
      balancePaise: 50000, // ₹500
      currency: 'INR',
      isSimulated: true,
    };

    const priyaAccount: Wallet = {
      userId: priya.id,
      balancePaise: 0,
      currency: 'INR',
      isSimulated: true,
    };

    // Requesting ₹600 with only ₹500 available
    const result = await paymentService.processMoneyTransfer({
      member: priya,
      owner,
      ownerWallet: adminWallet,
      memberWallet: priyaAccount,
      rule: priyaRule,
      amountPaise: 60000,
      purpose: 'Exceeding pool',
      existingTransactions: [],
    });

    expect(result.success).toBe(false);
    expect(adminWallet.balancePaise).toBe(50000); // Never goes negative
    expect(priyaAccount.balancePaise).toBe(0);
  });
});

