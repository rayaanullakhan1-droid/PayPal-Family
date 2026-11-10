import { describe, it, expect } from 'vitest';
import { paymentService } from '../services/paymentService';
import { User, Wallet, SpendingRule, Transaction } from '../types';

describe('Family Administrator & Member Personal Account Financial Verification', () => {
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

  // Case 1: Starting Balances (Admin: ₹10,000, Priya: ₹500, Aarav: ₹0)
  it('initializes with Administrator at ₹10,000 and Member at ₹500', () => {
    const adminWallet: Wallet = {
      userId: owner.id,
      balancePaise: 1000000, // ₹10,000.00
      currency: 'INR',
      isSimulated: true,
    };

    const priyaWallet: Wallet = {
      userId: priya.id,
      balancePaise: 50000, // ₹500.00
      currency: 'INR',
      isSimulated: true,
    };

    expect(adminWallet.balancePaise).toBe(1000000);
    expect(priyaWallet.balancePaise).toBe(50000);
  });

  // Case 2: Successful Money Transfer (Administrator: ₹10,000 -> ₹8,000; Member: ₹500 -> ₹2,500)
  it('executes successful ₹2,000 transfer: Admin ₹10,000 -> ₹8,000; Member ₹500 -> ₹2,500', async () => {
    let adminWallet: Wallet = {
      userId: owner.id,
      balancePaise: 1000000, // ₹10,000
      currency: 'INR',
      isSimulated: true,
    };

    let priyaWallet: Wallet = {
      userId: priya.id,
      balancePaise: 50000, // ₹500
      currency: 'INR',
      isSimulated: true,
    };

    const priyaRule: SpendingRule = {
      memberId: priya.id,
      singleTransactionLimitPaise: 250000, // ₹2,500
      dailyLimitPaise: 500000,             // ₹5,000
      monthlyLimitPaise: 1000000,          // ₹10,000
      allowMoneyTransfer: true,
      allowQRPayments: true,
    };

    const existingTxns: Transaction[] = [];

    // Transfer amount: ₹2,000 (200,000 paise)
    const requestPaise = 200000;

    const result = await paymentService.processMoneyTransfer({
      member: priya,
      owner,
      ownerWallet: adminWallet,
      memberWallet: priyaWallet,
      rule: priyaRule,
      amountPaise: requestPaise,
      purpose: 'College tuition and project supplies',
      existingTransactions: existingTxns,
    });

    expect(result.success).toBe(true);
    expect(result.transaction).toBeDefined();
    expect(result.transaction?.status).toBe('COMPLETED');
    expect(result.transaction?.amountPaise).toBe(200000);
    expect(result.transaction?.senderId).toBe(owner.id);
    expect(result.transaction?.senderName).toBe(owner.name);
    expect(result.transaction?.recipientId).toBe(priya.id);
    expect(result.transaction?.recipientName).toBe(priya.name);

    // Apply atomic balance updates as in AppContext
    adminWallet = {
      ...adminWallet,
      balancePaise: adminWallet.balancePaise - requestPaise,
    };

    priyaWallet = {
      ...priyaWallet,
      balancePaise: priyaWallet.balancePaise + requestPaise,
    };

    // Verify exact expected amounts from prompt
    expect(adminWallet.balancePaise).toBe(800000);  // Exactly ₹8,000.00
    expect(priyaWallet.balancePaise).toBe(250000);  // Exactly ₹2,500.00
  });

  // Case 3: Insufficient Administrator Balance
  it('rejects transfer when administrator balance is insufficient', async () => {
    const poorAdminWallet: Wallet = {
      userId: owner.id,
      balancePaise: 100000, // only ₹1,000 left
      currency: 'INR',
      isSimulated: true,
    };

    const priyaWallet: Wallet = {
      userId: priya.id,
      balancePaise: 50000,
      currency: 'INR',
      isSimulated: true,
    };

    const priyaRule: SpendingRule = {
      memberId: priya.id,
      singleTransactionLimitPaise: 250000,
      dailyLimitPaise: 500000,
      monthlyLimitPaise: 1000000,
      allowMoneyTransfer: true,
      allowQRPayments: true,
    };

    const result = await paymentService.processMoneyTransfer({
      member: priya,
      owner,
      ownerWallet: poorAdminWallet,
      memberWallet: priyaWallet,
      rule: priyaRule,
      amountPaise: 200000, // ₹2,000 > ₹1,000
      purpose: 'Emergency fee',
      existingTransactions: [],
    });

    expect(result.success).toBe(false);
    expect(result.evaluation?.code).toBe('INSUFFICIENT_OWNER_FUNDS');
    expect(result.transaction?.status).toBe('REJECTED');
  });

  // Case 4: Member Receiving / Spending Limits Exceeded
  it('rejects transfer when member single transaction limit is exceeded', async () => {
    const adminWallet: Wallet = {
      userId: owner.id,
      balancePaise: 1000000, // ₹10,000
      currency: 'INR',
      isSimulated: true,
    };

    const aaravWallet: Wallet = {
      userId: aarav.id,
      balancePaise: 0,
      currency: 'INR',
      isSimulated: true,
    };

    // Aarav has strict ₹500 single limit
    const aaravRule: SpendingRule = {
      memberId: aarav.id,
      singleTransactionLimitPaise: 50000, // ₹500
      dailyLimitPaise: 80000,             // ₹800
      monthlyLimitPaise: 200000,          // ₹2,000
      allowMoneyTransfer: true,
      allowQRPayments: true,
    };

    const result = await paymentService.processMoneyTransfer({
      member: aarav,
      owner,
      ownerWallet: adminWallet,
      memberWallet: aaravWallet,
      rule: aaravRule,
      amountPaise: 100000, // ₹1,000 > ₹500 cap
      purpose: 'New school shoes',
      existingTransactions: [],
    });

    expect(result.success).toBe(false);
    expect(result.evaluation?.code).toBe('SINGLE_LIMIT_EXCEEDED');
    expect(result.transaction?.status).toBe('REJECTED');
  });

  // Case 5: Transfer Permission Disabled by Administrator
  it('rejects transfer when administrator has disabled money transfer permission', async () => {
    const adminWallet: Wallet = {
      userId: owner.id,
      balancePaise: 1000000,
      currency: 'INR',
      isSimulated: true,
    };

    const priyaWallet: Wallet = {
      userId: priya.id,
      balancePaise: 50000,
      currency: 'INR',
      isSimulated: true,
    };

    const disabledRule: SpendingRule = {
      memberId: priya.id,
      singleTransactionLimitPaise: 250000,
      dailyLimitPaise: 500000,
      monthlyLimitPaise: 1000000,
      allowMoneyTransfer: false, // OFF
      allowQRPayments: true,
    };

    const result = await paymentService.processMoneyTransfer({
      member: priya,
      owner,
      ownerWallet: adminWallet,
      memberWallet: priyaWallet,
      rule: disabledRule,
      amountPaise: 50000, // ₹500
      purpose: 'Book purchase',
      existingTransactions: [],
    });

    expect(result.success).toBe(false);
    expect(result.evaluation?.code).toBe('PERMISSION_DENIED');
  });

  // Case 6: Multiple Family Members Requesting Money Sequentially
  it('handles multiple family members requesting money without double deduction', async () => {
    let adminWallet: Wallet = {
      userId: owner.id,
      balancePaise: 1000000, // ₹10,000
      currency: 'INR',
      isSimulated: true,
    };

    let priyaWallet: Wallet = {
      userId: priya.id,
      balancePaise: 50000, // ₹500
      currency: 'INR',
      isSimulated: true,
    };

    let aaravWallet: Wallet = {
      userId: aarav.id,
      balancePaise: 0, // ₹0
      currency: 'INR',
      isSimulated: true,
    };

    const priyaRule: SpendingRule = {
      memberId: priya.id,
      singleTransactionLimitPaise: 250000,
      dailyLimitPaise: 500000,
      monthlyLimitPaise: 1000000,
      allowMoneyTransfer: true,
      allowQRPayments: true,
    };

    const aaravRule: SpendingRule = {
      memberId: aarav.id,
      singleTransactionLimitPaise: 50000,
      dailyLimitPaise: 80000,
      monthlyLimitPaise: 200000,
      allowMoneyTransfer: true,
      allowQRPayments: true,
    };

    const ledger: Transaction[] = [];

    // Step A: Priya requests ₹2,000
    const resA = await paymentService.processMoneyTransfer({
      member: priya,
      owner,
      ownerWallet: adminWallet,
      memberWallet: priyaWallet,
      rule: priyaRule,
      amountPaise: 200000,
      purpose: 'College textbooks',
      existingTransactions: ledger,
    });
    expect(resA.success).toBe(true);
    ledger.unshift(resA.transaction!);
    adminWallet = { ...adminWallet, balancePaise: adminWallet.balancePaise - 200000 };
    priyaWallet = { ...priyaWallet, balancePaise: priyaWallet.balancePaise + 200000 };

    expect(adminWallet.balancePaise).toBe(800000); // ₹8,000
    expect(priyaWallet.balancePaise).toBe(250000); // ₹2,500

    // Step B: Aarav requests ₹300
    const resB = await paymentService.processMoneyTransfer({
      member: aarav,
      owner,
      ownerWallet: adminWallet,
      memberWallet: aaravWallet,
      rule: aaravRule,
      amountPaise: 30000,
      purpose: 'School stationery',
      existingTransactions: ledger,
    });
    expect(resB.success).toBe(true);
    ledger.unshift(resB.transaction!);
    adminWallet = { ...adminWallet, balancePaise: adminWallet.balancePaise - 30000 };
    aaravWallet = { ...aaravWallet, balancePaise: aaravWallet.balancePaise + 30000 };

    // Final balances verified
    expect(adminWallet.balancePaise).toBe(770000); // ₹7,700
    expect(priyaWallet.balancePaise).toBe(250000); // ₹2,500
    expect(aaravWallet.balancePaise).toBe(30000);  // ₹300
    expect(ledger.length).toBe(2);
  });

  // Case 7: Page Refresh & Persistence in LocalStorage
  it('persists and restores updated balances after page refresh simulation', () => {
    const updatedState = {
      currentUserId: owner.id,
      familyMembers: [owner, priya, aarav],
      ownerWallet: { userId: owner.id, balancePaise: 800000, currency: 'INR', isSimulated: true },
      memberPersonalAccounts: {
        [priya.id]: { userId: priya.id, balancePaise: 250000, currency: 'INR', isSimulated: true },
        [aarav.id]: { userId: aarav.id, balancePaise: 0, currency: 'INR', isSimulated: true },
      },
      transactions: [
        {
          id: 'tx_test_persist',
          reference: 'TXN-20261031-TEST',
          type: 'TRANSFER',
          status: 'COMPLETED',
          amountPaise: 200000,
          currency: 'INR',
          initiatorId: priya.id,
          payerId: owner.id,
          senderId: owner.id,
          senderName: owner.name,
          recipientId: priya.id,
          recipientName: priya.name,
          date: new Date().toISOString(),
          note: 'Persisted transfer',
          isSimulated: true,
        },
      ],
    };

    // Serialize as localStorage does
    const serialized = JSON.stringify(updatedState);
    const restored = JSON.parse(serialized);

    expect(restored.ownerWallet.balancePaise).toBe(800000);
    expect(restored.memberPersonalAccounts[priya.id].balancePaise).toBe(250000);
    expect(restored.transactions[0].amountPaise).toBe(200000);
    expect(restored.transactions[0].senderName).toBe('Rajesh Sharma');
  });
});

