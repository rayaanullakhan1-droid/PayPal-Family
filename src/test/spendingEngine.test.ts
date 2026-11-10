import { describe, it, expect } from 'vitest';
import { evaluateSpendingEligibility, calculateMemberSpending } from '../services/spendingRuleEngine';
import { User, Wallet, SpendingRule, Transaction } from '../types';

describe('Spending Rule Engine', () => {
  const member: User = {
    id: 'usr_member_test',
    name: 'Test Member',
    email: 'member@test.com',
    role: 'member',
    avatarUrl: '',
    familyId: 'fam_01',
  };

  const ownerWallet: Wallet = {
    userId: 'usr_owner',
    balancePaise: 1000000, // ₹10,000
    currency: 'INR',
    isSimulated: true,
  };

  const rule: SpendingRule = {
    memberId: member.id,
    singleTransactionLimitPaise: 100000, // ₹1,000 single limit
    dailyLimitPaise: 200000,             // ₹2,000 daily limit
    monthlyLimitPaise: 500000,           // ₹5,000 monthly limit
    allowMoneyTransfer: true,
    allowQRPayments: true,
  };

  const existingTransactions: Transaction[] = [];

  it('approves an eligible transfer within all limits', () => {
    const result = evaluateSpendingEligibility({
      amountPaise: 50000, // ₹500
      actionType: 'TRANSFER',
      member,
      ownerWallet,
      rule,
      allTransactions: existingTransactions,
    });

    expect(result.eligible).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('rejects a transfer exceeding single transaction limit', () => {
    const result = evaluateSpendingEligibility({
      amountPaise: 150000, // ₹1,500 > ₹1,000
      actionType: 'TRANSFER',
      member,
      ownerWallet,
      rule,
      allTransactions: existingTransactions,
    });

    expect(result.eligible).toBe(false);
    expect(result.code).toBe('SINGLE_LIMIT_EXCEEDED');
    expect(result.reason).toContain('Exceeds single transaction limit');
  });

  it('rejects when owner balance is insufficient', () => {
    const poorOwnerWallet: Wallet = {
      ...ownerWallet,
      balancePaise: 20000, // only ₹200 left
    };

    const result = evaluateSpendingEligibility({
      amountPaise: 50000, // ₹500
      actionType: 'TRANSFER',
      member,
      ownerWallet: poorOwnerWallet,
      rule,
      allTransactions: existingTransactions,
    });

    expect(result.eligible).toBe(false);
    expect(result.code).toBe('INSUFFICIENT_OWNER_FUNDS');
  });

  it('rejects when permission is toggled off', () => {
    const noQrRule: SpendingRule = {
      ...rule,
      allowQRPayments: false,
    };

    const result = evaluateSpendingEligibility({
      amountPaise: 10000, // ₹100
      actionType: 'QR_PAYMENT',
      member,
      ownerWallet,
      rule: noQrRule,
      allTransactions: existingTransactions,
    });

    expect(result.eligible).toBe(false);
    expect(result.code).toBe('PERMISSION_DENIED');
  });

  it('accumulates daily spending and rejects when daily limit is exceeded', () => {
    const todayTxn: Transaction = {
      id: 'tx_prev_1',
      reference: 'TXN-1',
      type: 'TRANSFER',
      status: 'COMPLETED',
      amountPaise: 180000, // ₹1,800 spent today
      currency: 'INR',
      initiatorId: member.id,
      payerId: 'usr_owner',
      recipientName: member.name,
      date: new Date().toISOString(),
      isSimulated: true,
    };

    // Member already spent ₹1,800 today, daily limit is ₹2,000.
    // An attempt of ₹300 should fail (1,800 + 300 = 2,100 > 2,000).
    const result = evaluateSpendingEligibility({
      amountPaise: 30000, // ₹300
      actionType: 'TRANSFER',
      member,
      ownerWallet,
      rule,
      allTransactions: [todayTxn],
    });

    expect(result.eligible).toBe(false);
    expect(result.code).toBe('DAILY_LIMIT_EXCEEDED');
    expect(result.reason).toContain('Exceeds daily spending limit');
  });
});

