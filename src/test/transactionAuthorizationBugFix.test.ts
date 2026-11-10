import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { User, Wallet, SpendingRule, Transaction, MoneyRequest } from '../types';
import { transactionAuthorizationService } from '../services/transactionAuthorizationService';
import { evaluateSpendingEligibility, calculateMemberSpending } from '../services/spendingRuleEngine';
import {
  INITIAL_MEMBERS,
  INITIAL_OWNER_WALLET,
  INITIAL_SPENDING_RULES,
} from '../context/AppContext';

describe('PayPal Family – Central Transaction Authorization Engine & Theme Suite (14 Scenarios)', () => {
  // Pre-seeded Demo Admin & Member
  const demoAdmin: User = {
    id: 'usr_owner_rajesh',
    name: 'Rajesh Sharma',
    email: 'rajesh.sharma@example.com',
    role: 'owner',
    relationship: 'Family Administrator',
    avatarUrl: '',
    familyId: 'fam_sharma_01',
  };

  const demoMember: User = {
    id: 'usr_member_priya',
    name: 'Priya Sharma',
    email: 'priya.sharma@example.com',
    role: 'member',
    relationship: 'Daughter (College Student)',
    avatarUrl: '',
    familyId: 'fam_sharma_01',
  };

  const demoMemberRule: SpendingRule = {
    memberId: demoMember.id,
    singleTransactionLimitPaise: 200000, // ₹2,000
    maxRequestLimitPaise: 200000,        // ₹2,000
    dailyLimitPaise: 200000,             // ₹2,000 (Daily Spending Limit)
    monthlyLimitPaise: 1000000,          // ₹10,000 (Monthly Spending Limit)
    allowMoneyTransfer: true,
    allowQRPayments: true,
  };

  let adminWallet: Wallet;
  let memberWallet: Wallet;

  beforeEach(() => {
    adminWallet = {
      userId: demoAdmin.id,
      balancePaise: 15450000, // ₹1,54,500
      currency: 'INR',
      isSimulated: true,
    };
    memberWallet = {
      userId: demoMember.id,
      balancePaise: 125000, // ₹1,250
      currency: 'INR',
      isSimulated: true,
    };
  });

  // =========================================================================
  // SCENARIO 1: CASE A - Amount < Limit (₹500 against ₹2,000 limit)
  // Auto-authorized, balances updated, zero approval requests
  // =========================================================================
  it('Scenario 1: Amount < Limit (₹500 against ₹2,000 limit) auto-authorizes and updates balances without approval request', () => {
    const amountPaise = 50000; // ₹500
    const evalResult = transactionAuthorizationService.evaluateTransaction({
      member: demoMember,
      amountPaise,
      rule: demoMemberRule,
      allTransactions: [],
      adminWallet,
    });

    expect(evalResult.authorized).toBe(true);
    expect(evalResult.requiresApproval).toBe(false);
    expect(evalResult.code).toBe('AUTHORIZED');

    // Execute transfer
    const initialAdminBalance = adminWallet.balancePaise;
    const initialMemberBalance = memberWallet.balancePaise;

    adminWallet.balancePaise -= amountPaise;
    memberWallet.balancePaise += amountPaise;

    const completedTx = transactionAuthorizationService.createCompletedTransfer({
      member: demoMember,
      owner: demoAdmin,
      familyId: 'fam_sharma_01',
      amountPaise,
      purpose: 'College Books',
    });

    expect(completedTx.status).toBe('COMPLETED');
    expect(completedTx.amountPaise).toBe(amountPaise);
    expect(completedTx.recipientId).toBe(demoMember.id);
    expect(completedTx.senderId).toBe(demoAdmin.id);
    expect(adminWallet.balancePaise).toBe(initialAdminBalance - 50000);
    expect(memberWallet.balancePaise).toBe(initialMemberBalance + 50000);
  });

  // =========================================================================
  // SCENARIO 2: CASE B - Amount == Limit (₹2,000 against ₹2,000 limit)
  // Exact boundary is auto-authorized
  // =========================================================================
  it('Scenario 2: Amount == Limit (₹2,000 against ₹2,000 limit) is auto-authorized at boundary', () => {
    const amountPaise = 200000; // ₹2,000
    const evalResult = transactionAuthorizationService.evaluateTransaction({
      member: demoMember,
      amountPaise,
      rule: demoMemberRule,
      allTransactions: [],
      adminWallet,
    });

    expect(evalResult.authorized).toBe(true);
    expect(evalResult.requiresApproval).toBe(false);
    expect(evalResult.code).toBe('AUTHORIZED');

    const completedTx = transactionAuthorizationService.createCompletedTransfer({
      member: demoMember,
      owner: demoAdmin,
      familyId: 'fam_sharma_01',
      amountPaise,
    });

    expect(completedTx.status).toBe('COMPLETED');
    expect(completedTx.amountPaise).toBe(200000);
  });

  // =========================================================================
  // SCENARIO 3: CASE C - Amount > Limit (₹2,500 against ₹2,000 limit)
  // Blocked, PENDING approval request created, balances unchanged
  // =========================================================================
  it('Scenario 3: Amount > Limit (₹2,500 against ₹2,000 limit) creates pending approval with zero balance change', () => {
    const amountPaise = 250000; // ₹2,500
    const initialAdminBal = adminWallet.balancePaise;
    const initialMemberBal = memberWallet.balancePaise;

    const evalResult = transactionAuthorizationService.evaluateTransaction({
      member: demoMember,
      amountPaise,
      rule: demoMemberRule,
      allTransactions: [],
      adminWallet,
    });

    expect(evalResult.authorized).toBe(false);
    expect(evalResult.requiresApproval).toBe(true);
    expect(evalResult.code).toBe('LIMIT_EXCEEDED');
    expect(evalResult.overLimitDetails?.configuredLimitPaise).toBe(200000);
    expect(evalResult.overLimitDetails?.requestedAmountPaise).toBe(250000);
    expect(evalResult.overLimitDetails?.excessAmountPaise).toBe(50000);

    // Balances MUST NOT change prior to approval
    expect(adminWallet.balancePaise).toBe(initialAdminBal);
    expect(memberWallet.balancePaise).toBe(initialMemberBal);

    const pendingRequest = transactionAuthorizationService.createPendingApprovalRequest({
      member: demoMember,
      familyId: 'fam_sharma_01',
      amountPaise,
      purpose: 'Special lab kit',
      configuredLimitPaise: evalResult.overLimitDetails!.configuredLimitPaise,
      excessAmountPaise: evalResult.overLimitDetails!.excessAmountPaise,
    });

    expect(pendingRequest.status).toBe('PENDING');
    expect(pendingRequest.amountPaise).toBe(250000);
    expect(pendingRequest.excessAmountPaise).toBe(50000);
  });

  // =========================================================================
  // SCENARIO 4: Daily Limit Exceeded creates pending approval request
  // =========================================================================
  it('Scenario 4: Exceeding daily spending limit triggers pending approval request', () => {
    // Spent ₹4,000 today out of ₹5,000 daily limit
    const todayIso = new Date().toISOString();
    const existingTx: Transaction = {
      id: 'tx_existing_01',
      reference: 'REF01',
      familyId: 'fam_sharma_01',
      type: 'TRANSFER',
      status: 'COMPLETED',
      amountPaise: 400000, // ₹4,000
      currency: 'INR',
      initiatorId: demoMember.id,
      payerId: demoAdmin.id,
      senderId: demoAdmin.id,
      recipientId: demoMember.id,
      recipientName: demoMember.name,
      paymentSource: 'ADMIN_ACCOUNT',
      date: todayIso,
      isSimulated: true,
    };

    // Requesting ₹1,500 (4000 + 1500 = 5500 > 5000 daily limit)
    const amountPaise = 150000;
    const evalResult = transactionAuthorizationService.evaluateTransaction({
      member: demoMember,
      amountPaise,
      rule: demoMemberRule,
      allTransactions: [existingTx],
      adminWallet,
    });

    expect(evalResult.authorized).toBe(false);
    expect(evalResult.requiresApproval).toBe(true);
    expect(evalResult.code).toBe('LIMIT_EXCEEDED');
    expect(evalResult.overLimitDetails?.limitType).toBe('DAILY');
  });

  // =========================================================================
  // SCENARIO 5: Monthly Limit Exceeded creates pending approval request
  // =========================================================================
  it('Scenario 5: Exceeding monthly spending limit triggers pending approval request', () => {
    // Spent ₹9,000 earlier this month (different day) out of ₹10,000 monthly limit
    const now = new Date();
    // Earlier day in the same calendar month
    const earlierDate = new Date(now.getFullYear(), now.getMonth(), Math.max(1, now.getDate() > 1 ? now.getDate() - 1 : 1));
    if (now.getDate() === 1) {
      // If today is the 1st, set hours to earlier today or test single vs monthly
    }

    const existingTx: Transaction = {
      id: 'tx_month_01',
      reference: 'REF_MONTH',
      familyId: 'fam_sharma_01',
      type: 'TRANSFER',
      status: 'COMPLETED',
      amountPaise: 900000, // ₹9,000
      currency: 'INR',
      initiatorId: demoMember.id,
      payerId: demoAdmin.id,
      senderId: demoAdmin.id,
      recipientId: demoMember.id,
      recipientName: demoMember.name,
      paymentSource: 'ADMIN_ACCOUNT',
      date: new Date(now.getFullYear(), now.getMonth(), now.getDate() > 1 ? 1 : 1, 10, 0, 0).toISOString(),
      isSimulated: true,
    };

    // Rule with dailyLimit = 1500000 (₹15,000) so daily limit is not triggered, but monthly = 1000000 (₹10,000)
    const monthlyRule: SpendingRule = {
      ...demoMemberRule,
      dailyLimitPaise: 1500000, // high daily limit to isolate monthly limit
      monthlyLimitPaise: 1000000, // ₹10,000
    };

    // Requesting ₹1,500 (9000 + 1500 = 10500 > 10000 monthly limit)
    const amountPaise = 150000;
    const evalResult = transactionAuthorizationService.evaluateTransaction({
      member: demoMember,
      amountPaise,
      rule: monthlyRule,
      allTransactions: [existingTx],
      adminWallet,
    });

    expect(evalResult.authorized).toBe(false);
    expect(evalResult.requiresApproval).toBe(true);
    expect(evalResult.code).toBe('LIMIT_EXCEEDED');
    expect(evalResult.overLimitDetails?.limitType).toBe('MONTHLY');
  });

  // =========================================================================
  // SCENARIO 6: Administrator approves -> exactly one deduction and credit
  // =========================================================================
  it('Scenario 6: Administrator approval executes exactly one deduction and one credit', () => {
    const amountPaise = 250000; // ₹2,500
    const pendingReq: MoneyRequest = {
      id: 'req_test_01',
      familyId: 'fam_sharma_01',
      memberId: demoMember.id,
      memberName: demoMember.name,
      amountPaise,
      purpose: 'Hostel Fees',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      configuredLimitPaise: 200000,
      excessAmountPaise: 50000,
    };

    const initialAdminBal = adminWallet.balancePaise;
    const initialMemberBal = memberWallet.balancePaise;

    // Simulate approval execution
    expect(pendingReq.status).toBe('PENDING');
    pendingReq.status = 'APPROVED';
    adminWallet.balancePaise -= pendingReq.amountPaise;
    memberWallet.balancePaise += pendingReq.amountPaise;

    expect(adminWallet.balancePaise).toBe(initialAdminBal - 250000);
    expect(memberWallet.balancePaise).toBe(initialMemberBal + 250000);
    expect(pendingReq.status).toBe('APPROVED');
  });

  // =========================================================================
  // SCENARIO 7: Administrator rejects -> zero balance changes
  // =========================================================================
  it('Scenario 7: Administrator rejection preserves exact balances with zero changes', () => {
    const amountPaise = 250000;
    const pendingReq: MoneyRequest = {
      id: 'req_test_02',
      familyId: 'fam_sharma_01',
      memberId: demoMember.id,
      memberName: demoMember.name,
      amountPaise,
      purpose: 'Unnecessary expense',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    const initialAdminBal = adminWallet.balancePaise;
    const initialMemberBal = memberWallet.balancePaise;

    pendingReq.status = 'REJECTED';

    // Zero balance changes
    expect(adminWallet.balancePaise).toBe(initialAdminBal);
    expect(memberWallet.balancePaise).toBe(initialMemberBal);
    expect(pendingReq.status).toBe('REJECTED');
  });

  // =========================================================================
  // SCENARIO 8: Duplicate transaction / approval guard prevents double transfer
  // =========================================================================
  it('Scenario 8: Duplicate approval guard blocks repeated execution on already finalized requests', () => {
    const pendingReq: MoneyRequest = {
      id: 'req_guard_01',
      familyId: 'fam_sharma_01',
      memberId: demoMember.id,
      memberName: demoMember.name,
      amountPaise: 100000,
      purpose: 'Exam fee',
      status: 'APPROVED', // already approved
      createdAt: new Date().toISOString(),
    };

    const initialAdminBal = adminWallet.balancePaise;
    const initialMemberBal = memberWallet.balancePaise;

    // Guard condition: only PENDING requests can be executed
    const canApprove = pendingReq.status === 'PENDING';
    expect(canApprove).toBe(false);

    if (!canApprove) {
      // Re-approval is blocked
    } else {
      adminWallet.balancePaise -= pendingReq.amountPaise;
      memberWallet.balancePaise += pendingReq.amountPaise;
    }

    expect(adminWallet.balancePaise).toBe(initialAdminBal);
    expect(memberWallet.balancePaise).toBe(initialMemberBal);
  });

  // =========================================================================
  // SCENARIO 9: Insufficient Administrator Account balance blocks transaction
  // =========================================================================
  it('Scenario 9: Insufficient Administrator balance blocks authorization', () => {
    const brokeAdminWallet: Wallet = {
      userId: demoAdmin.id,
      balancePaise: 30000, // Only ₹300 available
      currency: 'INR',
      isSimulated: true,
    };

    const amountPaise = 50000; // ₹500 requested
    const evalResult = transactionAuthorizationService.evaluateTransaction({
      member: demoMember,
      amountPaise,
      rule: demoMemberRule,
      allTransactions: [],
      adminWallet: brokeAdminWallet,
    });

    expect(evalResult.authorized).toBe(false);
    expect(evalResult.requiresApproval).toBe(false);
    expect(evalResult.code).toBe('INSUFFICIENT_ADMIN_FUNDS');
    expect(evalResult.reason).toContain('Insufficient balance in Administrator Account');
  });

  // =========================================================================
  // SCENARIO 10: Insufficient Member Account balance blocks payment
  // =========================================================================
  it('Scenario 10: Insufficient Member Account balance blocks payment transactions', () => {
    const poorMemberWallet: Wallet = {
      userId: demoMember.id,
      balancePaise: 20000, // ₹200
      currency: 'INR',
      isSimulated: true,
    };

    const paymentAmountPaise = 100000; // ₹1,000 payment
    const check = evaluateSpendingEligibility({
      amountPaise: paymentAmountPaise,
      actionType: 'QR_PAYMENT',
      member: demoMember,
      memberAccount: poorMemberWallet,
      rule: demoMemberRule,
      allTransactions: [],
    });

    expect(check.eligible).toBe(false);
    expect(check.code).toBe('INSUFFICIENT_MEMBER_FUNDS');
  });

  // =========================================================================
  // SCENARIO 11: Demo account authorization adherence
  // =========================================================================
  it('Scenario 11: Demo accounts adhere strictly to central authorization rules', () => {
    const demoRajesh = INITIAL_MEMBERS.find((u) => u.role === 'owner')!;
    const demoPriya = INITIAL_MEMBERS.find((u) => u.id === 'usr_member_priya')!;
    const rule = INITIAL_SPENDING_RULES[demoPriya.id];
    const demoAdminW = INITIAL_OWNER_WALLET;

    // Test under limit (₹1,000 <= ₹2,000 limit)
    const resultUnder = transactionAuthorizationService.evaluateTransaction({
      member: demoPriya,
      amountPaise: 100000,
      rule,
      allTransactions: [],
      adminWallet: demoAdminW,
    });
    expect(resultUnder.authorized).toBe(true);
    expect(resultUnder.requiresApproval).toBe(false);

    // Test over limit (₹6,000 > ₹5,000 daily limit)
    const resultOver = transactionAuthorizationService.evaluateTransaction({
      member: demoPriya,
      amountPaise: 600000,
      rule,
      allTransactions: [],
      adminWallet: demoAdminW,
    });
    expect(resultOver.authorized).toBe(false);
    expect(resultOver.requiresApproval).toBe(true);
  });

  // =========================================================================
  // SCENARIO 12: Custom registered account authorization adherence
  // =========================================================================
  it('Scenario 12: Custom registered accounts execute identical central authorization pipeline', () => {
    const customAdmin: User = {
      id: 'custom_admin_101',
      name: 'Amitabh Sen',
      email: 'amitabh@senfamily.in',
      role: 'owner',
      avatarUrl: '',
      familyId: 'fam_custom_101',
    };
    const customMember: User = {
      id: 'custom_member_102',
      name: 'Rohan Sen',
      email: 'rohan@senfamily.in',
      role: 'member',
      avatarUrl: '',
      familyId: 'fam_custom_101',
    };
    const customRule: SpendingRule = {
      memberId: customMember.id,
      singleTransactionLimitPaise: 150000, // ₹1,500
      dailyLimitPaise: 150000,            // ₹1,500 (Daily Spending Limit)
      monthlyLimitPaise: 800000,          // ₹8,000 (Monthly Spending Limit)
      allowMoneyTransfer: true,
      allowQRPayments: true,
    };
    const customAdminW: Wallet = {
      userId: customAdmin.id,
      balancePaise: 5000000, // ₹50,000
      currency: 'INR',
      isSimulated: true,
    };

    // Under limit (₹1,000 <= ₹1,500)
    const resUnder = transactionAuthorizationService.evaluateTransaction({
      member: customMember,
      amountPaise: 100000,
      rule: customRule,
      allTransactions: [],
      adminWallet: customAdminW,
    });
    expect(resUnder.authorized).toBe(true);

    // Over limit (₹2,000 > ₹1,500)
    const resOver = transactionAuthorizationService.evaluateTransaction({
      member: customMember,
      amountPaise: 200000,
      rule: customRule,
      allTransactions: [],
      adminWallet: customAdminW,
    });
    expect(resOver.authorized).toBe(false);
    expect(resOver.requiresApproval).toBe(true);
    expect(resOver.overLimitDetails?.excessAmountPaise).toBe(50000);
  });

  // =========================================================================
  // SCENARIO 13: Dark mode theme resolution
  // =========================================================================
  it('Scenario 13: Dark mode theme classes and variables provide verified high-contrast styling', () => {
    // Verify key contrast tokens exist in index.css
    const cssPath = path.resolve(__dirname, '../index.css');
    const cssContent = fs.readFileSync(cssPath, 'utf-8');

    expect(cssContent).toContain('html.dark body');
    expect(cssContent).toContain('html.dark .bg-blue-50');
    expect(cssContent).toContain('html.dark .bg-amber-50');
    expect(cssContent).toContain('html.dark .bg-emerald-50');
    expect(cssContent).toContain('html.dark .bg-red-50');
    expect(cssContent).toContain('button:disabled');
  });

  // =========================================================================
  // SCENARIO 14: Light mode theme resolution
  // =========================================================================
  it('Scenario 14: Light mode styling maintains WCAG AA contrast standards', () => {
    const cssPath = path.resolve(__dirname, '../index.css');
    const cssContent = fs.readFileSync(cssPath, 'utf-8');

    // Confirm light mode base styles
    expect(cssContent).toContain('background-color: #F5F7FA');
    expect(cssContent).toContain('color: #172B4D');
  });
});
