import { describe, it, expect, beforeEach } from 'vitest';
import { paymentService } from '../services/paymentService';
import {
  hashPinSync,
  verifyPinSync,
  generatePinSalt,
  validatePinFormat,
  DEMO_PIN_HASH,
  DEMO_PIN_SALT,
} from '../utils/security';
import { onboardingStorage } from '../services/onboardingStorage';
import { Wallet, SpendingRule, User, QRPayload } from '../types';

describe('Financial Workflows, Transaction Security & PIN Verification Suite', () => {
  let owner: User;
  let priya: User;
  let ownerWallet: Wallet;
  let priyaWallet: Wallet;
  let priyaRule: SpendingRule;

  beforeEach(() => {
    owner = {
      id: 'usr_owner_rajesh',
      name: 'Rajesh Sharma',
      email: 'rajesh.sharma@example.com',
      role: 'owner',
      relationship: 'Family Administrator',
      avatarUrl: 'https://avatar.test',
      familyId: 'fam_demo',
    };

    priya = {
      id: 'usr_member_priya',
      name: 'Priya Sharma',
      email: 'priya.sharma@example.com',
      role: 'member',
      relationship: 'Daughter (Student)',
      avatarUrl: 'https://avatar.test',
      familyId: 'fam_demo',
    };

    // Administrator Central Pool: ₹10,000 (1,000,000 paise)
    ownerWallet = {
      userId: owner.id,
      balancePaise: 1000000,
      currency: 'INR',
      isSimulated: true,
    };

    // Member Personal Account: Priya ₹500 (50,000 paise)
    priyaWallet = {
      userId: priya.id,
      balancePaise: 50000,
      currency: 'INR',
      isSimulated: true,
    };

    // Spending rules: Priya ₹2,000 single limit (200,000 paise)
    priyaRule = {
      memberId: priya.id,
      dailyLimitPaise: 300000,
      monthlyLimitPaise: 1000000,
      singleTransactionLimitPaise: 200000,
      maxRequestLimitPaise: 200000,
      allowMoneyTransfer: true,
      allowQRPayments: true,
    };
  });

  // =========================================================================
  // 1. ADMINISTRATOR SPENDING
  // =========================================================================
  describe('1. Administrator Spending from Central Pool', () => {
    it('successfully processes Administrator spending and debits central pool', async () => {
      const initialAdminBal = ownerWallet.balancePaise;
      const spendAmountPaise = 150000; // ₹1,500

      const result = await paymentService.processAdminSpend({
        owner,
        ownerWallet,
        amountPaise: spendAmountPaise,
        recipientName: 'Electricity & Utility Bill',
        category: 'UTILITIES',
        note: 'Monthly home utility settlement',
        existingTransactions: [],
      });

      expect(result.success).toBe(true);
      expect(result.transaction).toBeDefined();
      expect(result.transaction?.type).toBe('SPEND');
      expect(result.transaction?.paymentSource).toBe('ADMIN_ACCOUNT');
      expect(result.transaction?.amountPaise).toBe(spendAmountPaise);
      expect(result.transaction?.recipientName).toBe('Electricity & Utility Bill');

      // Caller mutates owner central pool balance
      ownerWallet.balancePaise -= spendAmountPaise;
      expect(ownerWallet.balancePaise).toBe(initialAdminBal - spendAmountPaise);
    });

    it('rejects spending when central pool has insufficient balance without modifying funds', async () => {
      const initialAdminBal = ownerWallet.balancePaise;
      const excessiveAmountPaise = initialAdminBal + 50000; // ₹10,500

      const result = await paymentService.processAdminSpend({
        owner,
        ownerWallet,
        amountPaise: excessiveAmountPaise,
        recipientName: 'Luxury Electronics',
        category: 'ELECTRONICS',
        note: 'Excessive purchase',
        existingTransactions: [],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient balance in Administrator');
      expect(ownerWallet.balancePaise).toBe(initialAdminBal);
    });

    it('rejects zero or negative spending amounts', async () => {
      const initialAdminBal = ownerWallet.balancePaise;

      const zeroResult = await paymentService.processAdminSpend({
        owner,
        ownerWallet,
        amountPaise: 0,
        recipientName: 'Zero Item',
        existingTransactions: [],
      });
      expect(zeroResult.success).toBe(false);
      expect(zeroResult.error).toContain('greater than ₹0');

      const negResult = await paymentService.processAdminSpend({
        owner,
        ownerWallet,
        amountPaise: -5000,
        recipientName: 'Negative Item',
        existingTransactions: [],
      });
      expect(negResult.success).toBe(false);
      expect(negResult.error).toContain('greater than ₹0');

      expect(ownerWallet.balancePaise).toBe(initialAdminBal);
    });
  });

  // =========================================================================
  // 2. ADMINISTRATOR SEND MONEY TO FAMILY MEMBERS
  // =========================================================================
  describe('2. Administrator Send Money to Members', () => {
    it('transfers money from Administrator central pool to Member personal wallet', async () => {
      const initialAdminBal = ownerWallet.balancePaise;
      const initialPriyaBal = priyaWallet.balancePaise;
      const transferAmount = 150000; // ₹1,500 <= ₹2,000 limit

      const result = await paymentService.processMoneyTransfer({
        owner,
        member: priya,
        ownerWallet,
        memberWallet: priyaWallet,
        rule: priyaRule,
        amountPaise: transferAmount,
        purpose: 'Semester stationery & books',
        existingTransactions: [],
      });

      expect(result.success).toBe(true);
      expect(result.transaction).toBeDefined();
      expect(result.transaction?.type).toBe('TRANSFER');
      expect(result.transaction?.senderId).toBe(owner.id);
      expect(result.transaction?.recipientId).toBe(priya.id);

      // Caller mutates balances
      ownerWallet.balancePaise -= transferAmount;
      priyaWallet.balancePaise += transferAmount;
      expect(ownerWallet.balancePaise).toBe(initialAdminBal - transferAmount);
      expect(priyaWallet.balancePaise).toBe(initialPriyaBal + transferAmount);
    });

    it('prevents Administrator transfer if central pool balance is insufficient', async () => {
      const initialAdminBal = ownerWallet.balancePaise;
      const initialPriyaBal = priyaWallet.balancePaise;
      const excessAmount = initialAdminBal + 100000;

      const result = await paymentService.processMoneyTransfer({
        owner,
        member: priya,
        ownerWallet,
        memberWallet: priyaWallet,
        rule: priyaRule,
        amountPaise: excessAmount,
        purpose: 'Excess transfer',
        existingTransactions: [],
      });

      expect(result.success).toBe(false);
      expect(ownerWallet.balancePaise).toBe(initialAdminBal);
      expect(priyaWallet.balancePaise).toBe(initialPriyaBal);
    });
  });

  // =========================================================================
  // 3. MEMBER SPENDING LIMITS & EXCEPTION REQUESTS
  // =========================================================================
  describe('3. Member Spending Limits & Strict REQUEST / CANCEL Options', () => {
    it('executes member transfer when within configured limit', async () => {
      const allowedAmount = 150000; // ₹1,500 <= ₹2,000 limit

      const result = await paymentService.processMoneyTransfer({
        owner,
        member: priya,
        ownerWallet,
        memberWallet: priyaWallet,
        rule: priyaRule,
        amountPaise: allowedAmount,
        purpose: 'College project materials',
        existingTransactions: [],
      });

      expect(result.success).toBe(true);
    });

    it('blocks member request exceeding configured limit with isOverLimit and overLimitDetails', async () => {
      const initialAdminBal = ownerWallet.balancePaise;
      const initialPriyaBal = priyaWallet.balancePaise;
      const overLimitAmount = 350000; // ₹3,500 > ₹2,000 limit

      const result = await paymentService.processMoneyTransfer({
        owner,
        member: priya,
        ownerWallet,
        memberWallet: priyaWallet,
        rule: priyaRule,
        amountPaise: overLimitAmount,
        purpose: 'New Smartphone',
        existingTransactions: [],
      });

      expect(result.success).toBe(false);
      expect(result.isOverLimit).toBe(true);
      expect(result.overLimitDetails).toBeDefined();
      expect(result.overLimitDetails?.configuredLimitPaise).toBe(200000);
      expect(result.overLimitDetails?.requestedAmountPaise).toBe(350000);
      expect(result.overLimitDetails?.excessAmountPaise).toBe(150000);

      // Crucial: Balances remain strictly untouched!
      expect(ownerWallet.balancePaise).toBe(initialAdminBal);
      expect(priyaWallet.balancePaise).toBe(initialPriyaBal);
    });
  });

  // =========================================================================
  // 4. QR SCAN & PAY (ADMINISTRATOR VS MEMBER)
  // =========================================================================
  describe('4. QR Scan & Pay Account Selection', () => {
    it('Administrator QR payment debits directly from central pool (ADMIN_ACCOUNT)', async () => {
      const initialAdminBal = ownerWallet.balancePaise;
      const qrPayload: QRPayload = {
        format: 'paypal_family_qr_v1',
        merchantId: 'MERCH_CAMPUS_CAFE',
        merchantName: 'Campus Cafe & Roastery',
        merchantCategory: 'DINING',
        amountPaise: 45000, // ₹450
        currency: 'INR',
        invoiceId: 'INV-TEST-001',
      };

      const result = await paymentService.processQRPayment({
        member: owner,
        ownerWallet,
        paymentSource: 'ADMIN_ACCOUNT',
        rule: priyaRule,
        qrPayload,
        amountPaise: 45000,
        merchantId: qrPayload.merchantId,
        merchantName: qrPayload.merchantName,
        merchantCategory: qrPayload.merchantCategory,
        existingTransactions: [],
      });

      expect(result.success).toBe(true);
      expect(result.transaction?.paymentSource).toBe('ADMIN_ACCOUNT');
      expect(result.transaction?.payerId).toBe(owner.id);

      ownerWallet.balancePaise -= 45000;
      expect(ownerWallet.balancePaise).toBe(initialAdminBal - 45000);
    });

    it('Member QR payment debits directly from Personal Account while Administrator balance is unaffected', async () => {
      const initialAdminBal = ownerWallet.balancePaise;
      const initialPriyaBal = priyaWallet.balancePaise; // 50,000 paise (₹500)

      const qrPayload: QRPayload = {
        format: 'paypal_family_qr_v1',
        merchantId: 'MERCH_BOOKSTORE',
        merchantName: 'University Bookstore',
        merchantCategory: 'EDUCATION',
        amountPaise: 25000, // ₹250
        currency: 'INR',
        invoiceId: 'INV-TEST-002',
      };

      const result = await paymentService.processQRPayment({
        member: priya,
        memberAccount: priyaWallet,
        ownerWallet,
        paymentSource: 'PERSONAL_ACCOUNT',
        rule: priyaRule,
        qrPayload,
        amountPaise: 25000,
        merchantId: qrPayload.merchantId,
        merchantName: qrPayload.merchantName,
        merchantCategory: qrPayload.merchantCategory,
        existingTransactions: [],
      });

      expect(result.success).toBe(true);
      expect(result.transaction?.paymentSource).toBe('PERSONAL_ACCOUNT');
      expect(result.transaction?.payerId).toBe(priya.id);

      priyaWallet.balancePaise -= 25000;
      expect(priyaWallet.balancePaise).toBe(initialPriyaBal - 25000);
      // Administrator pool is completely untouched!
      expect(ownerWallet.balancePaise).toBe(initialAdminBal);
    });

    it('Member QR payment exceeding single transaction limit returns isOverLimit and overLimitDetails', async () => {
      // Ensure sufficient wallet balance (₹1,000) so balance sufficiency passes
      priyaWallet.balancePaise = 100000;

      // Set single transaction limit to ₹150 (15,000 paise)
      const strictRule: SpendingRule = {
        ...priyaRule,
        singleTransactionLimitPaise: 15000,
        maxRequestLimitPaise: 15000,
      };

      const qrPayload: QRPayload = {
        format: 'paypal_family_qr_v1',
        merchantId: 'MERCH_TECH_STORE',
        merchantName: 'Electronics Hub',
        merchantCategory: 'ELECTRONICS',
        amountPaise: 30000, // ₹300 > ₹150 cap
        currency: 'INR',
        invoiceId: 'INV-TEST-003',
      };

      const result = await paymentService.processQRPayment({
        member: priya,
        memberAccount: priyaWallet,
        ownerWallet,
        paymentSource: 'PERSONAL_ACCOUNT',
        rule: strictRule,
        qrPayload,
        amountPaise: 30000,
        merchantId: qrPayload.merchantId,
        merchantName: qrPayload.merchantName,
        merchantCategory: qrPayload.merchantCategory,
        existingTransactions: [],
      });

      expect(result.success).toBe(false);
      expect(result.isOverLimit).toBe(true);
      expect(result.overLimitDetails?.configuredLimitPaise).toBe(15000);
      expect(result.overLimitDetails?.requestedAmountPaise).toBe(30000);
      expect(result.overLimitDetails?.excessAmountPaise).toBe(15000);
    });
  });

  // =========================================================================
  // 5. 6-DIGIT TRANSACTION PIN ENFORCEMENT & SECURITY
  // =========================================================================
  describe('5. 6-Digit Transaction PIN Security System', () => {
    it('validates 6-digit PIN format strictly (accepts only 6 numeric digits)', () => {
      expect(validatePinFormat('123456').valid).toBe(true);
      expect(validatePinFormat('000000').valid).toBe(true);
      expect(validatePinFormat('987654').valid).toBe(true);

      // Rejections
      expect(validatePinFormat('12345').valid).toBe(false); // 5 digits
      expect(validatePinFormat('1234567').valid).toBe(false); // 7 digits
      expect(validatePinFormat('12a456').valid).toBe(false); // alphabetic
      expect(validatePinFormat('12 456').valid).toBe(false); // space
      expect(validatePinFormat('').valid).toBe(false); // empty
    });

    it('verifies default pre-seeded demo PIN (123456) using SHA-256 and salt', () => {
      const isValid = verifyPinSync('123456', DEMO_PIN_HASH, DEMO_PIN_SALT);
      expect(isValid).toBe(true);

      const isWrongPin = verifyPinSync('654321', DEMO_PIN_HASH, DEMO_PIN_SALT);
      expect(isWrongPin).toBe(false);
    });

    it('generates unique cryptographic salt and hashes new PIN correctly', () => {
      const salt = generatePinSalt();
      const newPin = '654321';
      const hash = hashPinSync(newPin, salt);

      expect(hash).toHaveLength(64); // SHA-256 hex is 64 chars
      expect(verifyPinSync(newPin, hash, salt)).toBe(true);
      expect(verifyPinSync('123456', hash, salt)).toBe(false);
    });

    it('updates user PIN through onboarding storage with salted hash storage', () => {
      const user: User = {
        id: 'usr_test_pin',
        name: 'Test User',
        email: 'test@example.com',
        role: 'member',
        avatarUrl: 'https://avatar.test',
        familyId: 'fam_demo',
      };

      onboardingStorage.saveUser(user);

      const setRes = onboardingStorage.setUserPin(user.id, '998877');
      expect(setRes.success).toBe(true);

      const savedUser = onboardingStorage.getUserById(user.id);
      expect(savedUser?.hasTransactionPin).toBe(true);
      expect(savedUser?.pinHash).toBeDefined();
      expect(savedUser?.pinSalt).toBeDefined();
      expect(savedUser?.pinSetAt).toBeDefined();

      // Verify correct PIN passes
      expect(onboardingStorage.verifyUserPin(savedUser!, '998877')).toBe(true);
      // Verify incorrect PIN fails
      expect(onboardingStorage.verifyUserPin(savedUser!, '112233')).toBe(false);

      // Change PIN with current PIN check
      const changeFail = onboardingStorage.changeUserPin(user.id, 'wrong_pin', '554433');
      expect(changeFail.success).toBe(false);
      expect(changeFail.error).toContain('Incorrect current transaction PIN');

      const changeSuccess = onboardingStorage.changeUserPin(user.id, '998877', '554433');
      expect(changeSuccess.success).toBe(true);

      const updatedUser = onboardingStorage.getUserById(user.id);
      expect(onboardingStorage.verifyUserPin(updatedUser!, '554433')).toBe(true);
    });
  });

  // =========================================================================
  // 6. ACCOUNT & APPLICATION SETTINGS PERSISTENCE
  // =========================================================================
  describe('6. Account & Application Settings Persistence', () => {
    it('updates user profile name and mobile in storage', () => {
      const user: User = {
        id: 'usr_custom_profile',
        name: 'Original Name',
        email: 'orig@example.com',
        role: 'owner',
        avatarUrl: 'https://avatar.test',
        familyId: 'fam_demo',
        isCustomUser: true,
      };

      // Save user in storage
      onboardingStorage.saveUser(user);

      // Update profile
      const updated = onboardingStorage.updateUserProfile('usr_custom_profile', {
        name: 'Updated Rajesh Sharma',
        mobile: '9876543210',
      });

      expect(updated).toBeDefined();
      expect(updated?.name).toBe('Updated Rajesh Sharma');
      expect(updated?.mobile).toBe('9876543210');
    });
  });
});
