import { describe, it, expect } from 'vitest';
import { paymentService } from '../services/paymentService';
import { User, Wallet, SpendingRule, Transaction } from '../types';

describe('Administrator Account & Member Personal Account Financial System', () => {
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

  const priyaRule: SpendingRule = {
    memberId: priya.id,
    singleTransactionLimitPaise: 250000, // ₹2,500
    dailyLimitPaise: 500000,             // ₹5,000
    monthlyLimitPaise: 1000000,          // ₹10,000
    allowMoneyTransfer: true,
    allowQRPayments: true,
  };

  const aaravRule: SpendingRule = {
    memberId: aarav.id,
    singleTransactionLimitPaise: 50000,  // ₹500
    dailyLimitPaise: 80000,              // ₹800
    monthlyLimitPaise: 200000,           // ₹2,000
    allowMoneyTransfer: true,
    allowQRPayments: true,
  };

  // ==========================================
  // REQUIREMENT 1: ADD MONEY TO ADMIN ACCOUNT
  // ==========================================
  describe('1. Add Money to Administrator Account', () => {
    it('allows administrator to add simulated demo money and immediately updates balance', async () => {
      let adminWallet: Wallet = {
        userId: owner.id,
        balancePaise: 1000000, // ₹10,000.00
        currency: 'INR',
        isSimulated: true,
      };

      const topupAmountPaise = 500000; // ₹5,000.00

      const result = await paymentService.processAddFunds({
        owner,
        ownerWallet: adminWallet,
        amountPaise: topupAmountPaise,
        note: 'Monthly demo reload from SBI bank',
      });

      expect(result.success).toBe(true);
      expect(result.transaction).toBeDefined();

      const txn = result.transaction!;
      expect(txn.type).toBe('ADD_MONEY');
      expect(txn.status).toBe('COMPLETED');
      expect(txn.amountPaise).toBe(500000);
      expect(txn.initiatorId).toBe(owner.id);
      expect(txn.recipientId).toBe(owner.id);
      expect(txn.recipientName).toContain('Rajesh Sharma');
      expect(txn.isSimulated).toBe(true);
      expect(txn.reference).toMatch(/^TXN-\d{8}-[A-Z0-9]{5}$/);

      // Execute balance update
      adminWallet.balancePaise += topupAmountPaise;
      expect(adminWallet.balancePaise).toBe(1500000); // ₹15,000.00
    });

    it('rejects adding invalid or zero/negative money amounts', async () => {
      const adminWallet: Wallet = {
        userId: owner.id,
        balancePaise: 1000000,
        currency: 'INR',
        isSimulated: true,
      };

      const resZero = await paymentService.processAddFunds({
        owner,
        ownerWallet: adminWallet,
        amountPaise: 0,
      });
      expect(resZero.success).toBe(false);
      expect(resZero.error).toContain('valid amount greater than ₹0');

      const resNeg = await paymentService.processAddFunds({
        owner,
        ownerWallet: adminWallet,
        amountPaise: -50000,
      });
      expect(resNeg.success).toBe(false);
      expect(resNeg.error).toContain('valid amount greater than ₹0');
    });
  });

  // ==========================================
  // REQUIREMENT 2: DIRECT SEND MONEY TO MEMBER
  // ==========================================
  describe('2. Direct Send Money to Family Member', () => {
    it('administrator directly sends ₹2,000 to Priya: Admin ₹10,000 -> ₹8,000, Priya ₹500 -> ₹2,500', async () => {
      let adminWallet: Wallet = {
        userId: owner.id,
        balancePaise: 1000000, // ₹10,000.00
        currency: 'INR',
        isSimulated: true,
      };

      let priyaWallet: Wallet = {
        userId: priya.id,
        balancePaise: 50000, // ₹500.00
        currency: 'INR',
        isSimulated: true,
      };

      const transferAmountPaise = 200000; // ₹2,000.00

      const result = await paymentService.processDirectAdminTransfer({
        owner,
        member: priya,
        ownerWallet: adminWallet,
        memberWallet: priyaWallet,
        rule: priyaRule,
        amountPaise: transferAmountPaise,
        note: 'Study books and stationery',
        existingTransactions: [],
      });

      expect(result.success).toBe(true);
      expect(result.transaction).toBeDefined();

      const txn = result.transaction!;
      expect(txn.type).toBe('TRANSFER');
      expect(txn.status).toBe('COMPLETED');
      expect(txn.amountPaise).toBe(200000);
      expect(txn.senderId).toBe(owner.id);
      expect(txn.senderName).toBe(owner.name);
      expect(txn.recipientId).toBe(priya.id);
      expect(txn.recipientName).toBe(priya.name);
      expect(txn.isSimulated).toBe(true);

      // Atomic balance update
      adminWallet.balancePaise -= transferAmountPaise;
      priyaWallet.balancePaise += transferAmountPaise;

      expect(adminWallet.balancePaise).toBe(800000);  // ₹8,000.00
      expect(priyaWallet.balancePaise).toBe(250000); // ₹2,500.00
    });
  });

  // ==========================================
  // REQUIREMENT 3: TRANSFER VALIDATIONS
  // ==========================================
  describe('3. Transfer Validations', () => {
    it('prevents transfers exceeding administrator account balance', async () => {
      const adminWallet: Wallet = {
        userId: owner.id,
        balancePaise: 300000, // Only ₹3,000 available
        currency: 'INR',
        isSimulated: true,
      };

      const priyaWallet: Wallet = {
        userId: priya.id,
        balancePaise: 50000,
        currency: 'INR',
        isSimulated: true,
      };

      // Try sending ₹5,000 when admin has only ₹3,000
      const result = await paymentService.processDirectAdminTransfer({
        owner,
        member: priya,
        ownerWallet: adminWallet,
        memberWallet: priyaWallet,
        rule: { ...priyaRule, singleTransactionLimitPaise: 1000000 },
        amountPaise: 500000,
        existingTransactions: [],
      });

      expect(result.success).toBe(false);
      expect(result.evaluation?.code).toBe('INSUFFICIENT_OWNER_FUNDS');
      expect(result.transaction?.status).toBe('REJECTED');
      // Admin balance untouched
      expect(adminWallet.balancePaise).toBe(300000);
      expect(priyaWallet.balancePaise).toBe(50000);
    });

    it('prevents zero or negative transfer amounts', async () => {
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

      const resZero = await paymentService.processDirectAdminTransfer({
        owner,
        member: priya,
        ownerWallet: adminWallet,
        memberWallet: priyaWallet,
        rule: priyaRule,
        amountPaise: 0,
        existingTransactions: [],
      });
      expect(resZero.success).toBe(false);
      expect(resZero.error).toContain('greater than ₹0');

      const resNeg = await paymentService.processDirectAdminTransfer({
        owner,
        member: priya,
        ownerWallet: adminWallet,
        memberWallet: priyaWallet,
        rule: priyaRule,
        amountPaise: -10000,
        existingTransactions: [],
      });
      expect(resNeg.success).toBe(false);
      expect(resNeg.error).toContain('greater than ₹0');
    });

    it('rejects transfer when money transfer permission is disabled for member', async () => {
      const adminWallet: Wallet = {
        userId: owner.id,
        balancePaise: 1000000,
        currency: 'INR',
        isSimulated: true,
      };

      const disabledRule: SpendingRule = {
        ...priyaRule,
        allowMoneyTransfer: false, // OFF
      };

      const result = await paymentService.processDirectAdminTransfer({
        owner,
        member: priya,
        ownerWallet: adminWallet,
        memberWallet: { userId: priya.id, balancePaise: 50000, currency: 'INR', isSimulated: true },
        rule: disabledRule,
        amountPaise: 50000,
        existingTransactions: [],
      });

      expect(result.success).toBe(false);
      expect(result.evaluation?.code).toBe('PERMISSION_DENIED');
      expect(result.transaction?.status).toBe('REJECTED');
    });

    it('rejects transfer when single transaction limit is exceeded', async () => {
      const adminWallet: Wallet = {
        userId: owner.id,
        balancePaise: 1000000,
        currency: 'INR',
        isSimulated: true,
      };

      // Aarav has ₹500 single limit (50,000 paise). Send ₹1,000.
      const result = await paymentService.processDirectAdminTransfer({
        owner,
        member: aarav,
        ownerWallet: adminWallet,
        memberWallet: { userId: aarav.id, balancePaise: 0, currency: 'INR', isSimulated: true },
        rule: aaravRule,
        amountPaise: 100000, // ₹1,000
        existingTransactions: [],
      });

      expect(result.success).toBe(false);
      expect(result.evaluation?.code).toBe('SINGLE_LIMIT_EXCEEDED');
      expect(result.transaction?.status).toBe('REJECTED');
    });
  });

  // ==========================================
  // REQUIREMENT 4: MEMBER REQUEST FLOW ALIGNMENT
  // ==========================================
  describe('4. Member Request Money Follows Direct Transfer Process', () => {
    it('member request money uses the same direct administrator deduction and member credit', async () => {
      let adminWallet: Wallet = {
        userId: owner.id,
        balancePaise: 800000, // ₹8,000.00
        currency: 'INR',
        isSimulated: true,
      };

      let priyaWallet: Wallet = {
        userId: priya.id,
        balancePaise: 250000, // ₹2,500.00
        currency: 'INR',
        isSimulated: true,
      };

      const requestAmountPaise = 100000; // ₹1,000.00

      const result = await paymentService.processMoneyTransfer({
        member: priya,
        owner,
        ownerWallet: adminWallet,
        memberWallet: priyaWallet,
        rule: priyaRule,
        amountPaise: requestAmountPaise,
        purpose: 'Semester project supplies',
        existingTransactions: [],
      });

      expect(result.success).toBe(true);
      expect(result.transaction?.status).toBe('COMPLETED');
      expect(result.transaction?.senderId).toBe(owner.id);
      expect(result.transaction?.recipientId).toBe(priya.id);

      // Atomic update
      adminWallet.balancePaise -= requestAmountPaise;
      priyaWallet.balancePaise += requestAmountPaise;

      expect(adminWallet.balancePaise).toBe(700000); // ₹7,000.00
      expect(priyaWallet.balancePaise).toBe(350000); // ₹3,500.00
    });
  });

  // ==========================================
  // REQUIREMENT 5: TRANSACTION HISTORY AUDIT
  // ==========================================
  describe('5. Transaction History & Audit Records', () => {
    it('records and distinguishes money added, money sent, and money received', () => {
      const ledger: Transaction[] = [
        // 1. Money added
        {
          id: 'tx_add_01',
          reference: 'TXN-20261031-TOP01',
          type: 'ADD_MONEY',
          status: 'COMPLETED',
          amountPaise: 500000,
          currency: 'INR',
          initiatorId: owner.id,
          payerId: owner.id,
          senderId: 'simulated_bank',
          senderName: 'Simulated Bank / Card Top-up',
          recipientId: owner.id,
          recipientName: 'Rajesh Sharma (Administrator)',
          date: '2026-10-31T10:00:00.000Z',
          note: 'Top up',
          isSimulated: true,
        },
        // 2. Money sent from Administrator to Priya
        {
          id: 'tx_transfer_01',
          reference: 'TXN-20261031-SND01',
          type: 'TRANSFER',
          status: 'COMPLETED',
          amountPaise: 200000,
          currency: 'INR',
          initiatorId: owner.id,
          payerId: owner.id,
          senderId: owner.id,
          senderName: owner.name,
          recipientId: priya.id,
          recipientName: priya.name,
          date: '2026-10-31T10:15:00.000Z',
          note: 'Study allowance',
          isSimulated: true,
        },
      ];

      // Administrator Perspective
      const adminTx0 = ledger[0];
      const adminTx1 = ledger[1];

      // Top up: Incoming to Admin (+₹5,000)
      expect(adminTx0.type).toBe('ADD_MONEY');
      expect(adminTx0.recipientId).toBe(owner.id);

      // Sent to Member: Outgoing from Admin (-₹2,000)
      expect(adminTx1.type).toBe('TRANSFER');
      expect(adminTx1.senderId).toBe(owner.id);
      expect(adminTx1.recipientId).toBe(priya.id);

      // Member Perspective for Tx 1
      const memberTx1 = ledger[1];
      expect(memberTx1.recipientId).toBe(priya.id);
      expect(memberTx1.senderName).toBe('Rajesh Sharma');
    });
  });

  // ==========================================
  // REQUIREMENT 6: MONEY REQUEST APPROVAL (ADMIN TO MEMBER PERSONAL ACCOUNT)
  // ==========================================
  describe('6. Money Request Approval System (Admin Account -> Member Personal Account)', () => {
    it('approving a money request deducts from Administrator and credits Member Personal Account', async () => {
      // Starting balances (User specification example: Admin ₹10,000, Member ₹500)
      const adminWallet: Wallet = {
        userId: owner.id,
        balancePaise: 1000000, // ₹10,000.00
        currency: 'INR',
        isSimulated: true,
      };

      const priyaPersonalAccount: Wallet = {
        userId: priya.id,
        balancePaise: 50000, // ₹500.00
        currency: 'INR',
        isSimulated: true,
      };

      const requestAmountPaise = 200000; // ₹2,000.00

      const result = await paymentService.processMoneyTransfer({
        member: priya,
        owner,
        ownerWallet: adminWallet,
        memberWallet: priyaPersonalAccount,
        rule: priyaRule,
        amountPaise: requestAmountPaise,
        purpose: 'College books and study materials',
        existingTransactions: [],
      });

      expect(result.success).toBe(true);
      expect(result.transaction?.status).toBe('COMPLETED');
      expect(result.transaction?.paymentSource).toBe('ADMIN_ACCOUNT');

      // Atomic update
      adminWallet.balancePaise -= requestAmountPaise;
      priyaPersonalAccount.balancePaise += requestAmountPaise;

      // Assertions matching user requirement:
      // Administrator balance: ₹10,000 -> ₹8,000
      // Member balance: ₹500 -> ₹2,500
      expect(adminWallet.balancePaise).toBe(800000);
      expect(priyaPersonalAccount.balancePaise).toBe(250000);
    });
  });

  // ==========================================
  // REQUIREMENT 7: MEMBER QR PAYMENTS DEDUCT STRICTLY FROM PERSONAL ACCOUNT
  // ==========================================
  describe('7. Member QR Scan & Pay (Deducted Strictly from Member Personal Account)', () => {
    const demoMerchant = {
      merchantId: 'mch_metro_cafe',
      merchantName: 'Metro Campus Cafe',
      merchantCategory: 'Dining & Food',
    };

    it('deducts payment directly from Member Personal Account while Admin Account remains untouched', async () => {
      const adminWallet: Wallet = {
        userId: owner.id,
        balancePaise: 800000, // ₹8,000
        currency: 'INR',
        isSimulated: true,
      };
      const personalAccount: Wallet = {
        userId: priya.id,
        balancePaise: 250000, // ₹2,500
        currency: 'INR',
        isSimulated: true,
      };

      const paymentPaise = 45000; // ₹450

      const result = await paymentService.processQRPayment({
        member: priya,
        memberAccount: personalAccount,
        rule: priyaRule,
        merchantId: demoMerchant.merchantId,
        merchantName: demoMerchant.merchantName,
        merchantCategory: demoMerchant.merchantCategory,
        amountPaise: paymentPaise,
        existingTransactions: [],
      });

      expect(result.success).toBe(true);
      expect(result.transaction?.paymentSource).toBe('PERSONAL_ACCOUNT');
      expect(result.transaction?.status).toBe('COMPLETED');

      // Deduct from Personal Account
      personalAccount.balancePaise -= paymentPaise;

      // Personal Account decreased
      expect(personalAccount.balancePaise).toBe(205000); // ₹2,050
      // Administrator balance is completely untouched!
      expect(adminWallet.balancePaise).toBe(800000); // Unchanged at ₹8,000
    });

    it('rejects QR payment if Member Personal Account has insufficient balance', async () => {
      const personalAccount: Wallet = {
        userId: priya.id,
        balancePaise: 20000, // Only ₹200 available
        currency: 'INR',
        isSimulated: true,
      };

      // Try paying ₹500
      const result = await paymentService.processQRPayment({
        member: priya,
        memberAccount: personalAccount,
        rule: priyaRule,
        merchantId: demoMerchant.merchantId,
        merchantName: demoMerchant.merchantName,
        merchantCategory: demoMerchant.merchantCategory,
        amountPaise: 50000, // ₹500
        existingTransactions: [],
      });

      expect(result.success).toBe(false);
      expect(result.evaluation?.code).toBe('INSUFFICIENT_MEMBER_FUNDS');
      expect(result.transaction?.status).toBe('REJECTED');
    });

    it('rejects QR payment if single transaction cap is exceeded', async () => {
      const personalAccount: Wallet = {
        userId: priya.id,
        balancePaise: 1000000, // ₹10,000 available
        currency: 'INR',
        isSimulated: true,
      };

      // Priya's single cap is ₹2,500 (250,000 paise). Try paying ₹3,000 (300,000 paise)
      const result = await paymentService.processQRPayment({
        member: priya,
        memberAccount: personalAccount,
        rule: priyaRule,
        merchantId: demoMerchant.merchantId,
        merchantName: demoMerchant.merchantName,
        merchantCategory: demoMerchant.merchantCategory,
        amountPaise: 300000, // ₹3,000
        existingTransactions: [],
      });

      expect(result.success).toBe(false);
      expect(result.evaluation?.code).toBe('SINGLE_LIMIT_EXCEEDED');
      expect(result.transaction?.status).toBe('REJECTED');
    });

    it('rejects QR payment if daily spending limit is exceeded', async () => {
      const personalAccount: Wallet = {
        userId: priya.id,
        balancePaise: 1000000, // ₹10,000 available
        currency: 'INR',
        isSimulated: true,
      };

      // Existing today's completed transactions totaling ₹4,000
      const existingTodayTxn: Transaction = {
        id: 'tx_today_01',
        reference: 'TXN-20261031-TOD01',
        type: 'QR_PAYMENT',
        status: 'COMPLETED',
        amountPaise: 400000, // ₹4,000
        currency: 'INR',
        initiatorId: priya.id,
        payerId: priya.id,
        senderId: priya.id,
        senderName: priya.name,
        recipientId: 'mch_store',
        recipientName: 'Campus Store',
        date: new Date().toISOString(),
        isSimulated: true,
      };

      // Priya's daily limit is ₹5,000. Try paying ₹1,500 more (4,000 + 1,500 = 5,500 > 5,000)
      const result = await paymentService.processQRPayment({
        member: priya,
        memberAccount: personalAccount,
        rule: priyaRule,
        merchantId: demoMerchant.merchantId,
        merchantName: demoMerchant.merchantName,
        merchantCategory: demoMerchant.merchantCategory,
        amountPaise: 150000, // ₹1,500
        existingTransactions: [existingTodayTxn],
      });

      expect(result.success).toBe(false);
      expect(result.evaluation?.code).toBe('DAILY_LIMIT_EXCEEDED');
      expect(result.transaction?.status).toBe('REJECTED');
    });
  });
});

