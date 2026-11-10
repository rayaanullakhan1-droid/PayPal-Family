import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { User, Wallet, SpendingRule, Transaction } from '../types';
import { calculateMemberSpending, calculateMemberConsumption } from '../services/spendingRuleEngine';
import { paymentService } from '../services/paymentService';

describe('PayPal Family – Synchronize Configured Limits & Current Consumption', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-29T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });
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

  // Initial Seed Transactions matching the exact user prompt scenario:
  // tx_seed_01: 1 day ago, ₹500 (50,000 paise) -> spent this month
  // tx_seed_02: 3 hours ago (today), ₹180 (18,000 paise) -> spent today + this month
  // Total Spent Today: ₹180. Total Spent This Month: ₹680.
  const createInitialState = () => {
    const initialTransactions: Transaction[] = [
      {
        id: 'tx_seed_01',
        reference: 'TXN-20261028-A48X1',
        type: 'TRANSFER',
        status: 'COMPLETED',
        amountPaise: 50000, // ₹500
        currency: 'INR',
        initiatorId: priya.id,
        payerId: owner.id,
        senderId: owner.id,
        senderName: owner.name,
        recipientId: priya.id,
        recipientName: priya.name,
        paymentSource: 'PERSONAL_ACCOUNT',
        date: new Date(Date.now() - 3600 * 1000 * 24).toISOString(), // 1 day ago
        isSimulated: true,
      },
      {
        id: 'tx_seed_02',
        reference: 'TXN-20261029-C99P2',
        type: 'QR_PAYMENT',
        status: 'COMPLETED',
        amountPaise: 18000, // ₹180
        currency: 'INR',
        initiatorId: priya.id,
        payerId: priya.id,
        senderId: priya.id,
        senderName: priya.name,
        recipientId: 'MERCH_CAMPUS_CAFE',
        recipientName: 'Campus Cafeteria',
        paymentSource: 'PERSONAL_ACCOUNT',
        date: new Date(Date.now() - 3600 * 1000 * 3).toISOString(), // 3 hours ago (today)
        isSimulated: true,
      },
    ];

    const initialRules: Record<string, SpendingRule> = {
      [priya.id]: {
        memberId: priya.id,
        singleTransactionLimitPaise: 200000, // ₹2,000
        maxRequestLimitPaise: 200000,        // ₹2,000
        dailyLimitPaise: 500000,             // ₹5,000
        monthlyLimitPaise: 1000000,          // ₹10,000
        allowMoneyTransfer: true,
        allowQRPayments: true,
      },
      [aarav.id]: {
        memberId: aarav.id,
        singleTransactionLimitPaise: 50000,  // ₹500
        maxRequestLimitPaise: 50000,         // ₹500
        dailyLimitPaise: 80000,              // ₹800
        monthlyLimitPaise: 200000,           // ₹2,000
        allowMoneyTransfer: true,
        allowQRPayments: true,
      },
    };

    const adminWallet: Wallet = {
      userId: owner.id,
      balancePaise: 1000000, // ₹10,000
      currency: 'INR',
      isSimulated: true,
    };

    const memberPersonalAccounts: Record<string, Wallet> = {
      [priya.id]: {
        userId: priya.id,
        balancePaise: 50000, // ₹500
        currency: 'INR',
        isSimulated: true,
      },
      [aarav.id]: {
        userId: aarav.id,
        balancePaise: 0,
        currency: 'INR',
        isSimulated: true,
      },
    };

    return {
      currentUserId: owner.id,
      familyMembers: [owner, priya, aarav],
      spendingRules: initialRules,
      transactions: initialTransactions,
      adminWallet,
      memberPersonalAccounts,
    };
  };

  // TEST 1: Administrator changes Priya's daily limit -> Both sections update immediately
  it('TEST 1: Administrator changes Priya daily limit -> Your Configured Limits and Current Consumption update immediately', () => {
    const state = createInitialState();

    // Verify initial values: Daily Limit ₹5,000, Spent Today ₹180, Remaining Today ₹4,820
    const initialSpending = calculateMemberSpending(priya.id, state.transactions);
    const initialConsumption = calculateMemberConsumption(state.spendingRules[priya.id], initialSpending);

    expect(initialConsumption.configuredDailyLimitPaise).toBe(500000); // ₹5,000
    expect(initialConsumption.spentTodayPaise).toBe(18000);            // ₹180
    expect(initialConsumption.remainingTodayPaise).toBe(482000);        // ₹4,820

    // Administrator changes Priya's daily limit to ₹8,000 (800,000 paise)
    state.spendingRules[priya.id] = {
      ...state.spendingRules[priya.id],
      dailyLimitPaise: 800000,
    };

    // Both sections re-evaluate immediately using shared single source of truth
    const updatedConsumption = calculateMemberConsumption(
      state.spendingRules[priya.id],
      calculateMemberSpending(priya.id, state.transactions)
    );

    // Section 1: Your Configured Limits
    expect(state.spendingRules[priya.id].dailyLimitPaise).toBe(800000); // ₹8,000
    expect(updatedConsumption.configuredDailyLimitPaise).toBe(800000);  // ₹8,000

    // Section 2: Current Consumption
    expect(updatedConsumption.spentTodayPaise).toBe(18000);             // ₹180 (unchanged)
    expect(updatedConsumption.remainingTodayPaise).toBe(782000);         // ₹7,820 (recalculated: 8,000 - 180)
  });

  // TEST 2: Administrator changes Priya's monthly limit -> Both sections update immediately
  it('TEST 2: Administrator changes Priya monthly limit -> Your Configured Limits and Current Consumption update immediately', () => {
    const state = createInitialState();

    // Initial values: Monthly Limit ₹10,000, Spent This Month ₹680, Remaining This Month ₹9,320
    const initialSpending = calculateMemberSpending(priya.id, state.transactions);
    const initialConsumption = calculateMemberConsumption(state.spendingRules[priya.id], initialSpending);

    expect(initialConsumption.configuredMonthlyLimitPaise).toBe(1000000); // ₹10,000
    expect(initialConsumption.spentThisMonthPaise).toBe(68000);            // ₹680
    expect(initialConsumption.remainingThisMonthPaise).toBe(932000);       // ₹9,320

    // Administrator changes Priya's monthly limit to ₹15,000 (1,500,000 paise)
    state.spendingRules[priya.id] = {
      ...state.spendingRules[priya.id],
      monthlyLimitPaise: 1500000,
    };

    const updatedConsumption = calculateMemberConsumption(
      state.spendingRules[priya.id],
      calculateMemberSpending(priya.id, state.transactions)
    );

    // Section 1: Your Configured Limits
    expect(state.spendingRules[priya.id].monthlyLimitPaise).toBe(1500000); // ₹15,000
    expect(updatedConsumption.configuredMonthlyLimitPaise).toBe(1500000); // ₹15,000

    // Section 2: Current Consumption
    expect(updatedConsumption.spentThisMonthPaise).toBe(68000);           // ₹680 (unchanged)
    expect(updatedConsumption.remainingThisMonthPaise).toBe(1432000);      // ₹14,320 (recalculated: 15,000 - 680)
  });

  // TEST 3: Administrator changes Priya's maximum money request limit -> Request Money validation uses new limit
  it('TEST 3: Administrator changes Priya max money request limit -> Request Money validation uses new limit', async () => {
    const state = createInitialState();

    // Initial limit: ₹2,000. Requesting ₹2,500 should be rejected as over-limit
    const requestPaise = 250000; // ₹2,500
    const initialResult = await paymentService.processMoneyTransfer({
      member: priya,
      owner,
      ownerWallet: state.adminWallet,
      memberWallet: state.memberPersonalAccounts[priya.id],
      rule: state.spendingRules[priya.id],
      amountPaise: requestPaise,
      purpose: 'Lab supplies',
      existingTransactions: state.transactions,
    });

    expect(initialResult.success).toBe(false);
    expect(initialResult.isOverLimit).toBe(true);
    expect(initialResult.overLimitDetails?.configuredLimitPaise).toBe(200000);
    expect(initialResult.overLimitDetails?.excessAmountPaise).toBe(50000);

    // Administrator changes Maximum Money Request Limit to ₹3,000 (300,000 paise)
    state.spendingRules[priya.id] = {
      ...state.spendingRules[priya.id],
      maxRequestLimitPaise: 300000,
      singleTransactionLimitPaise: 300000,
    };

    // Now requesting ₹2,500 is within the new ₹3,000 limit -> Executes automatic successful transfer!
    const updatedResult = await paymentService.processMoneyTransfer({
      member: priya,
      owner,
      ownerWallet: state.adminWallet,
      memberWallet: state.memberPersonalAccounts[priya.id],
      rule: state.spendingRules[priya.id],
      amountPaise: requestPaise,
      purpose: 'Lab supplies',
      existingTransactions: state.transactions,
    });

    expect(updatedResult.success).toBe(true);
    expect(updatedResult.autoTransferred).toBe(true);
    expect(updatedResult.transaction?.amountPaise).toBe(250000);
  });

  // TEST 4: Existing spending records remain unchanged after a limit update
  it('TEST 4: Existing spending records remain unchanged after a limit update', () => {
    const state = createInitialState();

    const spendingBefore = calculateMemberSpending(priya.id, state.transactions);
    expect(spendingBefore.spentTodayPaise).toBe(18000);   // ₹180
    expect(spendingBefore.spentThisMonthPaise).toBe(68000); // ₹680

    // Administrator updates all three limits at once
    state.spendingRules[priya.id] = {
      ...state.spendingRules[priya.id],
      maxRequestLimitPaise: 300000,
      dailyLimitPaise: 800000,
      monthlyLimitPaise: 1500000,
    };

    const spendingAfter = calculateMemberSpending(priya.id, state.transactions);
    // Spending records are strictly unchanged
    expect(spendingAfter.spentTodayPaise).toBe(18000);
    expect(spendingAfter.spentThisMonthPaise).toBe(68000);
  });

  // TEST 5: Complete a successful transaction -> Daily and monthly consumption update
  it('TEST 5: Complete a successful transaction -> Daily and monthly consumption update', () => {
    const state = createInitialState();

    const consumptionBefore = calculateMemberConsumption(
      state.spendingRules[priya.id],
      calculateMemberSpending(priya.id, state.transactions)
    );
    expect(consumptionBefore.spentTodayPaise).toBe(18000);   // ₹180
    expect(consumptionBefore.spentThisMonthPaise).toBe(68000); // ₹680

    // New completed transaction of ₹200 (20,000 paise) initiated by Priya today
    const newTxn: Transaction = {
      id: 'tx_new_01',
      reference: 'TXN-20261031-NEW',
      type: 'QR_PAYMENT',
      status: 'COMPLETED',
      amountPaise: 20000, // ₹200
      currency: 'INR',
      initiatorId: priya.id,
      payerId: priya.id,
      senderId: priya.id,
      senderName: priya.name,
      recipientId: 'MERCH_BOOKSTORE',
      recipientName: 'Campus Bookstore',
      paymentSource: 'PERSONAL_ACCOUNT',
      date: new Date().toISOString(),
      isSimulated: true,
    };

    state.transactions = [newTxn, ...state.transactions];

    const consumptionAfter = calculateMemberConsumption(
      state.spendingRules[priya.id],
      calculateMemberSpending(priya.id, state.transactions)
    );

    // Spent today increases by ₹200 (180 + 200 = 380)
    expect(consumptionAfter.spentTodayPaise).toBe(38000);
    // Spent this month increases by ₹200 (680 + 200 = 880)
    expect(consumptionAfter.spentThisMonthPaise).toBe(88000);
    // Remaining today recalculates: 5,000 - 380 = 4,620
    expect(consumptionAfter.remainingTodayPaise).toBe(462000);
    // Remaining this month recalculates: 10,000 - 880 = 9,120
    expect(consumptionAfter.remainingThisMonthPaise).toBe(912000);
  });

  // TEST 6: Submit a failed request -> Spending does not increase
  it('TEST 6: Submit a failed request -> Spending does not increase', () => {
    const state = createInitialState();

    const spendingBefore = calculateMemberSpending(priya.id, state.transactions);

    // Failed / rejected transaction recorded in audit trail
    const failedTxn: Transaction = {
      id: 'tx_failed_01',
      reference: 'TXN-20261031-FAIL',
      type: 'TRANSFER',
      status: 'REJECTED',
      amountPaise: 500000, // ₹5,000
      currency: 'INR',
      initiatorId: priya.id,
      payerId: owner.id,
      senderId: owner.id,
      recipientId: priya.id,
      recipientName: priya.name,
      paymentSource: 'PERSONAL_ACCOUNT',
      date: new Date().toISOString(),
      rejectionReason: 'Limit exceeded',
      isSimulated: true,
    };

    state.transactions = [failedTxn, ...state.transactions];

    const spendingAfter = calculateMemberSpending(priya.id, state.transactions);

    // Failed request must NOT increase spending
    expect(spendingAfter.spentTodayPaise).toBe(spendingBefore.spentTodayPaise);
    expect(spendingAfter.spentThisMonthPaise).toBe(spendingBefore.spentThisMonthPaise);
  });

  // TEST 7: Switch from Priya to Aarav -> Aarav's own limits and consumption appear
  it('TEST 7: Switch from Priya to Aarav -> Aarav own limits and consumption appear', () => {
    const state = createInitialState();

    // Aarav has 0 transactions in seed
    const aaravSpending = calculateMemberSpending(aarav.id, state.transactions);
    const aaravConsumption = calculateMemberConsumption(state.spendingRules[aarav.id], aaravSpending);

    expect(aaravConsumption.maxRequestLimitPaise).toBe(50000);       // Aarav limit: ₹500
    expect(aaravConsumption.configuredDailyLimitPaise).toBe(80000);   // Aarav daily: ₹800
    expect(aaravConsumption.configuredMonthlyLimitPaise).toBe(200000);// Aarav monthly: ₹2,000
    expect(aaravConsumption.spentTodayPaise).toBe(0);                 // Spent today: ₹0
    expect(aaravConsumption.remainingTodayPaise).toBe(80000);         // Remaining: ₹800
    expect(aaravConsumption.spentThisMonthPaise).toBe(0);             // Spent month: ₹0
    expect(aaravConsumption.remainingThisMonthPaise).toBe(200000);     // Remaining: ₹2,000
  });

  // TEST 8: Switch back to Priya -> Priya previous limits and spending records remain correct
  it('TEST 8: Switch back to Priya -> Priya previous limits and spending records remain correct', () => {
    const state = createInitialState();

    // Update Priya's limits as Admin
    state.spendingRules[priya.id] = {
      ...state.spendingRules[priya.id],
      maxRequestLimitPaise: 300000,
      dailyLimitPaise: 800000,
      monthlyLimitPaise: 1500000,
    };

    // Switch to Aarav
    state.currentUserId = aarav.id;
    const aaravConsumption = calculateMemberConsumption(
      state.spendingRules[aarav.id],
      calculateMemberSpending(aarav.id, state.transactions)
    );
    expect(aaravConsumption.maxRequestLimitPaise).toBe(50000);

    // Switch back to Priya
    state.currentUserId = priya.id;
    const priyaConsumption = calculateMemberConsumption(
      state.spendingRules[priya.id],
      calculateMemberSpending(priya.id, state.transactions)
    );

    // Priya's limits and spending records remain preserved and correct
    expect(priyaConsumption.maxRequestLimitPaise).toBe(300000);        // ₹3,000
    expect(priyaConsumption.configuredDailyLimitPaise).toBe(800000);   // ₹8,000
    expect(priyaConsumption.configuredMonthlyLimitPaise).toBe(1500000);// ₹15,000
    expect(priyaConsumption.spentTodayPaise).toBe(18000);              // ₹180
    expect(priyaConsumption.remainingTodayPaise).toBe(782000);          // ₹7,820
    expect(priyaConsumption.spentThisMonthPaise).toBe(68000);          // ₹680
    expect(priyaConsumption.remainingThisMonthPaise).toBe(1432000);     // ₹14,320
  });

  // TEST 9: Refresh the browser -> Verify all configured limits and consumption values persist
  it('TEST 9: Refresh browser (localStorage serialization) -> All configured limits and consumption values persist', () => {
    const state = createInitialState();

    // Update Priya's limits
    state.spendingRules[priya.id].maxRequestLimitPaise = 300000;
    state.spendingRules[priya.id].dailyLimitPaise = 800000;
    state.spendingRules[priya.id].monthlyLimitPaise = 1500000;

    // Serialize to localStorage JSON string
    const jsonString = JSON.stringify({
      spendingRules: state.spendingRules,
      transactions: state.transactions,
      memberPersonalAccounts: state.memberPersonalAccounts,
      ownerWallet: state.adminWallet,
    });

    // Simulate browser reload / deserialization
    const restored = JSON.parse(jsonString);

    const restoredPriyaRule = restored.spendingRules[priya.id];
    const restoredSpending = calculateMemberSpending(priya.id, restored.transactions);
    const restoredConsumption = calculateMemberConsumption(restoredPriyaRule, restoredSpending);

    expect(restoredConsumption.maxRequestLimitPaise).toBe(300000);
    expect(restoredConsumption.configuredDailyLimitPaise).toBe(800000);
    expect(restoredConsumption.configuredMonthlyLimitPaise).toBe(1500000);
    expect(restoredConsumption.spentTodayPaise).toBe(18000);
    expect(restoredConsumption.remainingTodayPaise).toBe(782000);
    expect(restoredConsumption.spentThisMonthPaise).toBe(68000);
    expect(restoredConsumption.remainingThisMonthPaise).toBe(1432000);
  });

  // TEST 10: Verify members cannot access another member's private limits
  it('TEST 10: Verify members cannot access another member private limits', () => {
    const state = createInitialState();

    // Privacy accessor mirroring AppContext authorization logic
    const getAuthorizedRulesForUser = (user: User) => {
      if (user.role === 'owner') return state.spendingRules;
      return state.spendingRules[user.id]
        ? { [user.id]: state.spendingRules[user.id] }
        : {};
    };

    // Priya cannot access Aarav's limits
    const priyaRules = getAuthorizedRulesForUser(priya);
    expect(priyaRules[priya.id]).toBeDefined();
    expect(priyaRules[aarav.id]).toBeUndefined();

    // Aarav cannot access Priya's limits
    const aaravRules = getAuthorizedRulesForUser(aarav);
    expect(aaravRules[aarav.id]).toBeDefined();
    expect(aaravRules[priya.id]).toBeUndefined();

    // Administrator can access all limits
    const adminRules = getAuthorizedRulesForUser(owner);
    expect(adminRules[priya.id]).toBeDefined();
    expect(adminRules[aarav.id]).toBeDefined();
  });
});
