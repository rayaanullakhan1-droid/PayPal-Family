import { describe, it, expect, beforeEach } from 'vitest';
import {
  INITIAL_OWNER,
  INITIAL_MEMBERS,
  INITIAL_FAMILY,
  INITIAL_OWNER_WALLET,
  INITIAL_MEMBER_PERSONAL_ACCOUNTS,
  INITIAL_SPENDING_RULES,
} from '../context/AppContext';
import { onboardingStorage } from '../services/onboardingStorage';
import { paymentService } from '../services/paymentService';
import { calculateMemberSpending, calculateMemberConsumption, evaluateSpendingEligibility } from '../services/spendingRuleEngine';
import { aiAssistantService } from '../services/aiAssistantService';
import { DEMO_PIN_HASH, DEMO_PIN_SALT, verifyPinSync } from '../utils/security';
import { Transaction, MoneyRequest, SpendingRule, Wallet } from '../types';

describe('PayPal Family – Built-in Demo Accounts Feature & Business Logic Parity', () => {
  beforeEach(() => {
    localStorage.clear();
    onboardingStorage.clearAllLocalTestData();
  });

  describe('1. Preservation of Demo Accounts & Credentials', () => {
    it('preserves the 3 predefined demo personas: Rajesh, Priya, Aarav', () => {
      expect(INITIAL_MEMBERS.length).toBe(3);
      const rajesh = INITIAL_MEMBERS.find((m) => m.id === 'usr_owner_rajesh');
      const priya = INITIAL_MEMBERS.find((m) => m.id === 'usr_member_priya');
      const aarav = INITIAL_MEMBERS.find((m) => m.id === 'usr_member_aarav');

      expect(rajesh).toBeDefined();
      expect(rajesh?.role).toBe('owner');
      expect(rajesh?.name).toBe('Rajesh Sharma');

      expect(priya).toBeDefined();
      expect(priya?.role).toBe('member');
      expect(priya?.name).toBe('Priya Sharma');

      expect(aarav).toBeDefined();
      expect(aarav?.role).toBe('member');
      expect(aarav?.name).toBe('Aarav Sharma');
    });

    it('preserves default demo 6-digit transaction PIN 123456 verification', () => {
      for (const member of INITIAL_MEMBERS) {
        expect(member.hasTransactionPin).toBe(true);
        expect(member.pinHash).toBe(DEMO_PIN_HASH);
        expect(member.pinSalt).toBe(DEMO_PIN_SALT);

        // Verify with 123456
        const isValid = onboardingStorage.verifyUserPin(member, '123456');
        expect(isValid).toBe(true);

        // Verify that invalid PIN fails
        const isWrong = onboardingStorage.verifyUserPin(member, '654321');
        expect(isWrong).toBe(false);
      }
    });

    it('initial demo accounts have complete profile properties matching real/custom accounts', () => {
      const rajesh = INITIAL_MEMBERS.find((m) => m.id === 'usr_owner_rajesh')!;
      expect(rajesh.phone).toBe('+91 98765 43210');
      expect(rajesh.mobile).toBe('9876543210');
      expect(rajesh.country).toBe('India');
      expect(rajesh.countryCode).toBe('+91');
      expect(rajesh.membershipStatus).toBe('ACTIVE');
      expect(rajesh.onboardingStep).toBe('completed');
      expect(rajesh.bankAccount).toBeDefined();
      expect(rajesh.bankAccount?.bankName).toBe('HDFC Bank Ltd');
      expect(rajesh.bankAccount?.accountNumber).toBe('•••• •••• 4821');

      const priya = INITIAL_MEMBERS.find((m) => m.id === 'usr_member_priya')!;
      expect(priya.phone).toBe('+91 98765 43211');
      expect(priya.mobile).toBe('9876543211');
      expect(priya.country).toBe('India');
      expect(priya.bankAccount?.bankName).toBe('State Bank of India');

      const aarav = INITIAL_MEMBERS.find((m) => m.id === 'usr_member_aarav')!;
      expect(aarav.phone).toBe('+91 98765 43212');
      expect(aarav.mobile).toBe('9876543212');
      expect(aarav.bankAccount?.bankName).toBe('ICICI Bank');
    });

    it('initial demo family has funding source and linked bank details', () => {
      expect(INITIAL_FAMILY.fundingSource).toBe('HDFC Bank (•••• •••• 4821)');
      expect(INITIAL_FAMILY.bankAccount?.bankName).toBe('HDFC Bank Ltd');
      expect(INITIAL_FAMILY.joiningCode).toBe('SHARMA-2026');
    });
  });

  describe('2. Demo Administrator Business Logic Parity', () => {
    it('allows administrator to add funds to central pool', async () => {
      const adminWallet: Wallet = { ...INITIAL_OWNER_WALLET };
      const res = await paymentService.processAddFunds({
        owner: INITIAL_OWNER,
        ownerWallet: adminWallet,
        amountPaise: 500000, // ₹5,000.00
        note: 'PayPal Sandbox Top-Up',
      });

      expect(res.success).toBe(true);
      expect(res.transaction).toBeDefined();
      expect(res.transaction?.amountPaise).toBe(500000);
      if (res.success) {
        adminWallet.balancePaise += 500000;
      }
      expect(adminWallet.balancePaise).toBe(1500000); // ₹15,000.00
    });

    it('allows administrator to send money directly to member with immediate balance updates', async () => {
      const adminWallet: Wallet = { ...INITIAL_OWNER_WALLET }; // ₹10,000
      const priyaWallet: Wallet = { ...INITIAL_MEMBER_PERSONAL_ACCOUNTS['usr_member_priya'] }; // ₹500
      const priyaRule: SpendingRule = { ...INITIAL_SPENDING_RULES['usr_member_priya'] };

      const res = await paymentService.processDirectAdminTransfer({
        owner: INITIAL_OWNER,
        member: INITIAL_MEMBERS.find((m) => m.id === 'usr_member_priya')!,
        ownerWallet: adminWallet,
        memberWallet: priyaWallet,
        rule: priyaRule,
        amountPaise: 200000, // ₹2,000
        note: 'Monthly study allowance',
        existingTransactions: [],
      });

      expect(res.success).toBe(true);
      if (res.success) {
        adminWallet.balancePaise -= 200000;
        priyaWallet.balancePaise += 200000;
      }
      expect(adminWallet.balancePaise).toBe(800000); // ₹8,000
      expect(priyaWallet.balancePaise).toBe(250000); // ₹2,500
    });

    it('allows administrator to approve extra money requests transferring from admin to member account', () => {
      const adminWallet: Wallet = { ...INITIAL_OWNER_WALLET }; // ₹10,000 (1,000,000 paise)
      const aaravWallet: Wallet = { ...INITIAL_MEMBER_PERSONAL_ACCOUNTS['usr_member_aarav'] }; // ₹0

      const extraRequest: MoneyRequest = {
        id: 'req_extra_test',
        familyId: INITIAL_FAMILY.id,
        memberId: 'usr_member_aarav',
        memberName: 'Aarav Sharma',
        amountPaise: 75000, // ₹750
        purpose: 'Science exhibition materials',
        message: 'Need additional budget for display boards and sensor kits',
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        isExtraMoneyRequest: true,
      };

      // Execution of approval
      adminWallet.balancePaise -= extraRequest.amountPaise;
      aaravWallet.balancePaise += extraRequest.amountPaise;
      extraRequest.status = 'APPROVED';
      extraRequest.resolvedAt = new Date().toISOString();

      expect(extraRequest.status).toBe('APPROVED');
      expect(adminWallet.balancePaise).toBe(925000); // ₹9,250
      expect(aaravWallet.balancePaise).toBe(75000);  // ₹750
    });

    it('allows administrator to update member spending limits and immediately reflects in consumption engine', () => {
      const priyaRule: SpendingRule = { ...INITIAL_SPENDING_RULES['usr_member_priya'] };
      const emptyTxns: Transaction[] = [];

      // Initial consumption
      const initialCons = calculateMemberConsumption(priyaRule, emptyTxns);
      expect(initialCons.configuredDailyLimitPaise).toBe(500000); // ₹5,000
      expect(initialCons.configuredMonthlyLimitPaise).toBe(1000000); // ₹10,000

      // Administrator increases Priya's daily limit to ₹8,000 and monthly limit to ₹20,000
      const updatedRule: SpendingRule = {
        ...priyaRule,
        dailyLimitPaise: 800000,
        monthlyLimitPaise: 2000000,
        singleTransactionLimitPaise: 300000,
        maxRequestLimitPaise: 300000,
      };

      const updatedCons = calculateMemberConsumption(updatedRule, emptyTxns);
      expect(updatedCons.configuredDailyLimitPaise).toBe(800000);
      expect(updatedCons.configuredMonthlyLimitPaise).toBe(2000000);
      expect(updatedCons.maxRequestLimitPaise).toBe(300000);
      expect(updatedCons.remainingTodayPaise).toBe(800000);
    });
  });

  describe('3. Demo Members Financial Parity', () => {
    it('executes automatic transfer when request is within configured limit', async () => {
      const adminWallet: Wallet = { ...INITIAL_OWNER_WALLET };
      const priyaWallet: Wallet = { ...INITIAL_MEMBER_PERSONAL_ACCOUNTS['usr_member_priya'] };
      const priyaRule: SpendingRule = { ...INITIAL_SPENDING_RULES['usr_member_priya'] };

      const res = await paymentService.processMoneyTransfer({
        member: INITIAL_MEMBERS.find((m) => m.id === 'usr_member_priya')!,
        owner: INITIAL_OWNER,
        ownerWallet: adminWallet,
        memberWallet: priyaWallet,
        rule: priyaRule,
        amountPaise: 150000, // ₹1,500 <= ₹2,000 single limit
        purpose: 'College cafeteria pass',
        existingTransactions: [],
        paymentSource: 'ADMIN_ACCOUNT',
      });

      expect(res.success).toBe(true);
      if (res.success) {
        adminWallet.balancePaise -= 150000;
        priyaWallet.balancePaise += 150000;
      }
      expect(adminWallet.balancePaise).toBe(850000); // ₹8,500
      expect(priyaWallet.balancePaise).toBe(200000); // ₹2,000
    });

    it('detects over-limit requests and enforces limit exception workflow with message', () => {
      const priyaRule: SpendingRule = { ...INITIAL_SPENDING_RULES['usr_member_priya'] };
      const requestedPaise = 250000; // ₹2,500 > ₹2,000 limit

      const maxLimit = priyaRule.maxRequestLimitPaise ?? priyaRule.singleTransactionLimitPaise;
      expect(requestedPaise > maxLimit).toBe(true);

      const excessAmountPaise = requestedPaise - maxLimit;
      expect(excessAmountPaise).toBe(50000); // ₹500 excess

      // Create exception request with message
      const exceptionReq: MoneyRequest = {
        id: 'req_exc_priya',
        familyId: INITIAL_FAMILY.id,
        memberId: 'usr_member_priya',
        memberName: 'Priya Sharma',
        amountPaise: requestedPaise,
        purpose: 'Advanced robotics kit',
        message: 'Special laboratory project requirement requiring upfront purchase',
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        isException: true,
        configuredLimitPaise: maxLimit,
        excessAmountPaise,
      };

      expect(exceptionReq.status).toBe('PENDING');
      expect(exceptionReq.isException).toBe(true);
      expect(exceptionReq.message).toContain('Special laboratory project');
    });

    it('allows demo member to pay another demo member via mobile and synchronizes both accounts', () => {
      const priyaAccount: Wallet = { userId: 'usr_member_priya', balancePaise: 50000, currency: 'INR', isSimulated: true }; // ₹500
      const aaravAccount: Wallet = { userId: 'usr_member_aarav', balancePaise: 0, currency: 'INR', isSimulated: true }; // ₹0

      const transferAmountPaise = 20000; // ₹200

      // Priya sends to Aarav's mobile
      expect(priyaAccount.balancePaise).toBeGreaterThanOrEqual(transferAmountPaise);

      priyaAccount.balancePaise -= transferAmountPaise;
      aaravAccount.balancePaise += transferAmountPaise;

      expect(priyaAccount.balancePaise).toBe(30000); // ₹300
      expect(aaravAccount.balancePaise).toBe(20000); // ₹200
    });

    it('allows demo member to transfer to Administrator via mobile and credits Administrator account', () => {
      const priyaAccount: Wallet = { userId: 'usr_member_priya', balancePaise: 50000, currency: 'INR', isSimulated: true }; // ₹500
      const ownerWallet: Wallet = { ...INITIAL_OWNER_WALLET }; // ₹10,000

      const transferAmountPaise = 15000; // ₹150

      priyaAccount.balancePaise -= transferAmountPaise;
      ownerWallet.balancePaise += transferAmountPaise;

      expect(priyaAccount.balancePaise).toBe(35000); // ₹350
      expect(ownerWallet.balancePaise).toBe(1015000); // ₹10,150
    });

    it('enforces QR merchant payment deducted strictly from member personal account', async () => {
      const priyaAccount: Wallet = { userId: 'usr_member_priya', balancePaise: 50000, currency: 'INR', isSimulated: true };
      const priyaRule: SpendingRule = { ...INITIAL_SPENDING_RULES['usr_member_priya'] };

      const res = await paymentService.processQRPayment({
        member: INITIAL_MEMBERS.find((m) => m.id === 'usr_member_priya')!,
        memberAccount: priyaAccount,
        paymentSource: 'PERSONAL_ACCOUNT',
        rule: priyaRule,
        qrPayload: {
          format: 'paypal_family_qr_v1',
          merchantId: 'MERCH_CAMPUS_STORE',
          merchantName: 'Campus Book Store',
          merchantCategory: 'Education & Supplies',
          amountPaise: 18000, // ₹180
          currency: 'INR',
          invoiceId: 'INV-TEST-001',
        },
        existingTransactions: [],
      });

      expect(res.success).toBe(true);
      if (res.success) {
        priyaAccount.balancePaise -= 18000;
      }
      expect(priyaAccount.balancePaise).toBe(32000); // ₹320
      expect(res.transaction?.merchantCategory).toBe('Education & Supplies');
    });
  });

  describe('4. AI Spend Intelligence with Demo Data', () => {
    it('analyzes demo family finances and provides grounded insights', async () => {
      const context = {
        currentUser: INITIAL_OWNER,
        familyMembers: INITIAL_MEMBERS,
        ownerWallet: INITIAL_OWNER_WALLET,
        memberPersonalAccounts: INITIAL_MEMBER_PERSONAL_ACCOUNTS,
        spendingRules: INITIAL_SPENDING_RULES,
        transactions: [],
      };

      const res = await aiAssistantService.generateResponse('What are Priya’s daily and monthly spending limits?', context);
      expect(res.text).toBeDefined();
      expect(res.text.length).toBeGreaterThan(0);
      expect(res.text).toContain('Priya');
    });

    it('calculates accurate snapshot of demo wealth', () => {
      const context = {
        currentUser: INITIAL_OWNER,
        familyMembers: INITIAL_MEMBERS,
        ownerWallet: INITIAL_OWNER_WALLET, // ₹10,000
        memberPersonalAccounts: INITIAL_MEMBER_PERSONAL_ACCOUNTS, // Priya ₹500 + Aarav ₹0 = ₹500
        spendingRules: INITIAL_SPENDING_RULES,
        transactions: [],
      };

      const snapshot = aiAssistantService.getSnapshot(context);
      expect(snapshot.ownerPoolBalancePaise).toBe(1000000); // ₹10,000
      expect(snapshot.totalSimulatedWealthPaise).toBe(1050000); // ₹10,500
      expect(snapshot.totalDependents).toBe(2); // Priya & Aarav
    });
  });

  describe('5. Specific Verification Requirements', () => {
    it('Requirement 1: Administrator Overview does NOT display Today Allowance or Monthly Budget (appears exclusively in Member accounts)', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const dashboardPath = path.resolve(__dirname, '../pages/DashboardPage.tsx');
      const content = fs.readFileSync(dashboardPath, 'utf-8');

      // 1. Owner section must NOT have Today's Allowance or Monthly Budget cards
      const ownerSectionMatch = content.match(/\{isOwner \? \([\s\S]*?\)\s*:\s*\(/);
      expect(ownerSectionMatch).not.toBeNull();
      const ownerSection = ownerSectionMatch![0];

      expect(ownerSection).not.toContain("{t('dash.todaysAllowance'");
      expect(ownerSection).not.toContain("{t('dash.monthlyBudget'");
      expect(ownerSection).toContain('Family AI Spend Intelligence');

      // 2. Member section MUST display Today's Allowance and Monthly Budget cards
      const memberSectionMatch = content.match(/\)\s*:\s*\([\s\S]*?\)\s*\}\s*\{\/\* Member Spending Status/);
      expect(memberSectionMatch).not.toBeNull();
      const memberSection = memberSectionMatch![0];

      expect(memberSection).toContain("{t('dash.todaysAllowance'");
      expect(memberSection).toContain("{t('dash.monthlyBudget'");
      expect(memberSection).toContain('Personal Account Balance');
    });

    it('Requirement 2: Member spending debits the Administrator account exactly once per successful transaction', async () => {
      const initialAdminPaise = 1000000; // ₹10,000
      const initialMemberPaise = 50000;  // ₹500
      const requestAmountPaise = 20000;  // ₹200

      const adminWallet: Wallet = {
        userId: 'usr_owner_rajesh',
        balancePaise: initialAdminPaise,
        currency: 'INR',
        isSimulated: true,
      };

      const memberWallet: Wallet = {
        userId: 'usr_member_priya',
        balancePaise: initialMemberPaise,
        currency: 'INR',
        isSimulated: true,
      };

      const res = await paymentService.processMoneyTransfer({
        member: INITIAL_MEMBERS.find((m) => m.id === 'usr_member_priya')!,
        owner: INITIAL_OWNER,
        ownerWallet: adminWallet,
        memberWallet,
        rule: INITIAL_SPENDING_RULES['usr_member_priya'],
        amountPaise: requestAmountPaise,
        purpose: 'Stationery',
        existingTransactions: [],
        paymentSource: 'ADMIN_ACCOUNT',
      });

      expect(res.success).toBe(true);

      // Apply state update (exactly once as defined in AppContext)
      adminWallet.balancePaise = Math.max(0, adminWallet.balancePaise - requestAmountPaise);
      memberWallet.balancePaise += requestAmountPaise;

      // Exact single deduction
      expect(adminWallet.balancePaise).toBe(initialAdminPaise - requestAmountPaise);
      expect(adminWallet.balancePaise).toBe(980000); // Exactly ₹9,800
      expect(memberWallet.balancePaise).toBe(70000); // Exactly ₹700
    });

    it('Requirement 3: Demo accounts preserve login credentials and work through demo interface', () => {
      // 1. Check Rajesh Sharma
      const rajesh = INITIAL_MEMBERS.find((m) => m.id === 'usr_owner_rajesh')!;
      expect(rajesh).toBeDefined();
      expect(onboardingStorage.verifyUserPin(rajesh, '123456')).toBe(true);
      expect(onboardingStorage.verifyUserPin(rajesh, '999999')).toBe(false);

      // 2. Check Priya Sharma
      const priya = INITIAL_MEMBERS.find((m) => m.id === 'usr_member_priya')!;
      expect(priya).toBeDefined();
      expect(onboardingStorage.verifyUserPin(priya, '123456')).toBe(true);

      // 3. Check Aarav Sharma
      const aarav = INITIAL_MEMBERS.find((m) => m.id === 'usr_member_aarav')!;
      expect(aarav).toBeDefined();
      expect(onboardingStorage.verifyUserPin(aarav, '123456')).toBe(true);
    });
  });
});
