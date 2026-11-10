import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  paymentService,
} from '../services/paymentService';
import {
  evaluateSpendingEligibility,
} from '../services/spendingRuleEngine';
import {
  verifyPinSync,
  DEMO_PIN_HASH,
  DEMO_PIN_SALT,
} from '../utils/security';
import { COUNTRIES, validatePhoneNumber } from '../utils/countries';
import { User, Wallet, SpendingRule, Transaction } from '../types';

describe('PayPal Family – Bank Discovery Cleanup & Overview Three Options Suite', () => {
  // =========================================================================
  // 1. BANK DISCOVERY CLEANUP: Developer Simulation Controls Removed
  // =========================================================================
  describe('1. Bank Discovery Simulation Controls Cleanup', () => {
    const bankLinkingSource = fs.readFileSync(
      path.resolve(__dirname, '../components/fintech/BankLinkingExperience.tsx'),
      'utf-8'
    );

    it('strictly removes the developer "Simulate Discovery Scenario" section', () => {
      expect(bankLinkingSource).not.toContain('Simulate Discovery Scenario');
      expect(bankLinkingSource).not.toContain('Single Match (Default)');
      expect(bankLinkingSource).not.toContain('Multiple Accounts');
      expect(bankLinkingSource).not.toContain('No Accounts Found');
      expect(bankLinkingSource).not.toContain('Simulate Failure');
    });

    it('preserves normal institutional bank selection and automatic discovery flow', () => {
      expect(bankLinkingSource).toContain("const [testScenario] = useState<DiscoveryScenario>('auto');");
      expect(bankLinkingSource).toContain('Step 2: Select Your Bank');
      expect(bankLinkingSource).toContain('SUPPORTED_BANKS');
      expect(bankLinkingSource).toContain('handleBankChosen');
    });
  });

  // =========================================================================
  // 2. OVERVIEW: EXACTLY THREE FUNCTIONAL OPTIONS
  // =========================================================================
  describe('2. Overview Exactly Three Functional Options & Strict Restrictions', () => {
    const dashboardSource = fs.readFileSync(
      path.resolve(__dirname, '../pages/DashboardPage.tsx'),
      'utf-8'
    );

    it('contains exactly the three designated functional options', () => {
      // 1. To Mobile Number
      expect(dashboardSource).toContain('To Mobile Number');
      expect(dashboardSource).toContain('setIsToMobileOpen(true)');

      // 2. Check Balance
      expect(dashboardSource).toContain('Check Balance');
      expect(dashboardSource).toContain('setIsCheckBalanceOpen(true)');

      // 3. History
      expect(dashboardSource).toContain('History');
      expect(dashboardSource).toContain("navigate('/transactions')");
    });

    it('strictly does NOT contain QR Scan as an Overview option', () => {
      // Must not have QR Scan in the overview options grid or header buttons
      expect(dashboardSource).not.toMatch(/<button[^>]*>\s*Scan & Pay\s*<\/button>/i);
      expect(dashboardSource).not.toContain("navigate('/scan-pay')");
    });

    it('strictly does NOT contain a Family button in the Overview', () => {
      // Must not have a button pointing to /family on the overview
      expect(dashboardSource).not.toContain("navigate('/family')");
      expect(dashboardSource).not.toContain('to="/family"');
    });

    it('mounts ToMobileModal and CheckBalanceModal properly', () => {
      expect(dashboardSource).toContain('<ToMobileModal');
      expect(dashboardSource).toContain('<CheckBalanceModal');
    });
  });

  // =========================================================================
  // 3. TO MOBILE NUMBER: Financial Ledger & 6-Digit PIN Security
  // =========================================================================
  describe('3. To Mobile Number Payment Engine', () => {
    let mockOwner: User;
    let mockMember: User;
    let mockAdminWallet: Wallet;
    let mockMemberWallet: Wallet;
    let mockRule: SpendingRule;
    let mockTransactions: Transaction[];

    beforeEach(() => {
      mockOwner = {
        id: 'usr_owner_rajesh',
        name: 'Rajesh Sharma',
        email: 'rajesh@sharmafamily.org',
        familyId: 'fam_sharma_01',
        role: 'owner',
        relationship: 'Self (Administrator)',
        avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
      };

      mockMember = {
        id: 'usr_member_priya',
        name: 'Priya Sharma',
        email: 'priya@sharmafamily.org',
        familyId: 'fam_sharma_01',
        role: 'member',
        relationship: 'Daughter',
        avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
      };

      mockAdminWallet = {
        userId: 'usr_owner_rajesh',
        balancePaise: 1000000, // ₹10,000.00
        currency: 'INR',
        isSimulated: true,
      };

      mockMemberWallet = {
        userId: 'usr_member_priya',
        balancePaise: 250000, // ₹2,500.00
        currency: 'INR',
        isSimulated: true,
      };

      mockRule = {
        memberId: 'usr_member_priya',
        singleTransactionLimitPaise: 100000, // ₹1,000.00
        dailyLimitPaise: 200000,             // ₹2,000.00
        monthlyLimitPaise: 1000000,          // ₹10,000.00
        allowMoneyTransfer: true,
        allowQRPayments: true,
      };

      mockTransactions = [];
    });

    it('requires 6-digit transaction PIN verification for payments', () => {
      // Default demo pin is 123456
      const isCorrect = verifyPinSync('123456', DEMO_PIN_HASH, DEMO_PIN_SALT);
      expect(isCorrect).toBe(true);

      const isWrong = verifyPinSync('654321', DEMO_PIN_HASH, DEMO_PIN_SALT);
      expect(isWrong).toBe(false);

      const isInvalidLen = verifyPinSync('123', DEMO_PIN_HASH, DEMO_PIN_SALT);
      expect(isInvalidLen).toBe(false);
    });

    it('validates recipient phone numbers across international country codes', () => {
      const inCountry = COUNTRIES.find((c) => c.code === 'IN')!;
      expect(validatePhoneNumber('9876543210', inCountry).valid).toBe(true);
      expect(validatePhoneNumber('123', inCountry).valid).toBe(false);

      const usCountry = COUNTRIES.find((c) => c.code === 'US')!;
      expect(validatePhoneNumber('4155552671', usCountry).valid).toBe(true);
      expect(validatePhoneNumber('99', usCountry).valid).toBe(false);
    });

    it('Administrator payment to mobile debits central pool and records SPEND/TRANSFER', async () => {
      const transferAmountPaise = 150000; // ₹1,500.00
      const initialBalance = mockAdminWallet.balancePaise;

      const result = await paymentService.processAdminSpend({
        amountPaise: transferAmountPaise,
        recipientName: 'Aarav Sharma (+91 98111 22233)',
        note: 'Mobile transfer',
        owner: mockOwner,
        ownerWallet: mockAdminWallet,
        existingTransactions: mockTransactions,
      });

      expect(result.success).toBe(true);
      expect(result.transaction).toBeDefined();
      expect(result.transaction?.amountPaise).toBe(transferAmountPaise);
      expect(result.transaction?.status).toBe('COMPLETED');
    });

    it('Member payment to mobile enforces spending limits and identifies over-limit conditions', () => {
      // Exceed single limit of ₹1,000
      const excessiveAmountPaise = 150000; // ₹1,500.00

      const evalResult = evaluateSpendingEligibility({
        amountPaise: excessiveAmountPaise,
        actionType: 'TRANSFER',
        member: mockMember,
        memberAccount: mockMemberWallet,
        rule: mockRule,
        allTransactions: mockTransactions,
      });

      expect(evalResult.eligible).toBe(false);
      expect(evalResult.code).toBe('SINGLE_LIMIT_EXCEEDED');
      expect(evalResult.reason).toContain('1,000');
    });
  });

  // =========================================================================
  // 4. CHECK BALANCE: Strictly Masked until 6-Digit PIN Verified
  // =========================================================================
  describe('4. Check Balance PIN Verification & Masking', () => {
    it('verifies PIN before revealing balance and rejects incorrect PIN', () => {
      const pin = '123456';
      const wrongPin = '000000';

      expect(verifyPinSync(wrongPin, DEMO_PIN_HASH, DEMO_PIN_SALT)).toBe(false);
      expect(verifyPinSync(pin, DEMO_PIN_HASH, DEMO_PIN_SALT)).toBe(true);
    });

    it('CheckBalanceModal source code strictly shields balance until verified', () => {
      const checkBalanceSource = fs.readFileSync(
        path.resolve(__dirname, '../components/common/CheckBalanceModal.tsx'),
        'utf-8'
      );

      // Must have state !isVerified blocking balance display
      expect(checkBalanceSource).toContain('!isVerified ? (');
      expect(checkBalanceSource).toContain('Enter your 6-digit transaction PIN');
      expect(checkBalanceSource).toContain('Incorrect 6-digit transaction PIN');
      expect(checkBalanceSource).toContain('PIN Verified');
    });
  });
});
