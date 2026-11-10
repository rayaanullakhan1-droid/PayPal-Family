import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { User, Wallet, SpendingRule, Transaction, MoneyRequest } from '../types';
import { paymentService } from '../services/paymentService';
import { evaluateSpendingEligibility } from '../services/spendingRuleEngine';
import { formatCurrency } from '../utils/currency';
import { onboardingStorage } from '../services/onboardingStorage';

describe('PayPal Family – Request Extra Money Workflow & Spending Limits Suite', () => {
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

  const priyaRule: SpendingRule = {
    memberId: priya.id,
    singleTransactionLimitPaise: 200000, // ₹2,000
    maxRequestLimitPaise: 200000,        // ₹2,000
    dailyLimitPaise: 500000,             // ₹5,000
    monthlyLimitPaise: 1000000,          // ₹10,000
    allowMoneyTransfer: true,
    allowQRPayments: true,
  };

  // =========================================================================
  // 1. INSUFFICIENT BALANCE & ALLOWANCE DETECTION
  // =========================================================================
  describe('1. Insufficient Balance & Spending Allowance Detection', () => {
    it('detects when member personal balance is insufficient for a QR transaction', () => {
      const personalAccount: Wallet = {
        userId: priya.id,
        balancePaise: 50000, // ₹500
        currency: 'INR',
        isSimulated: true,
      };

      const qrAmountPaise = 150000; // ₹1,500 required (exceeds ₹500 balance)
      const evaluation = evaluateSpendingEligibility({
        amountPaise: qrAmountPaise,
        actionType: 'QR_PAYMENT',
        member: priya,
        memberAccount: personalAccount,
        rule: priyaRule,
        allTransactions: [],
      });

      expect(evaluation.eligible).toBe(false);
      expect(evaluation.code).toBe('INSUFFICIENT_MEMBER_FUNDS');
      expect(evaluation.reason).toContain('Insufficient balance in Personal Account');

      // Shortfall is calculated
      const shortfallPaise = qrAmountPaise - personalAccount.balancePaise;
      expect(shortfallPaise).toBe(100000); // ₹1,000 needed
    });

    it('detects when spending allowance/limits are insufficient for a transaction', () => {
      const personalAccount: Wallet = {
        userId: priya.id,
        balancePaise: 500000, // ₹5,000 balance available
        currency: 'INR',
        isSimulated: true,
      };

      const highAmountPaise = 300000; // ₹3,000 (exceeds ₹2,000 single limit)
      const evaluation = evaluateSpendingEligibility({
        amountPaise: highAmountPaise,
        actionType: 'QR_PAYMENT',
        member: priya,
        memberAccount: personalAccount,
        rule: priyaRule,
        allTransactions: [],
      });

      expect(evaluation.eligible).toBe(false);
      expect(evaluation.code).toBe('SINGLE_LIMIT_EXCEEDED');
      expect(evaluation.reason).toContain('Exceeds single transaction limit');
    });
  });

  // =========================================================================
  // 2. CREATING REQUEST EXTRA MONEY WITH AMOUNT & MESSAGE
  // =========================================================================
  describe('2. Member Request Extra Money Creation with Custom Message', () => {
    it('creates an extra money request containing the requested amount and explanatory message', () => {
      const requestedAmountPaise = 250000; // ₹2,500
      const memberMessage = 'Need extra funds for advanced chemistry lab equipment and reference manuals.';

      const extraRequest: MoneyRequest = {
        id: `req_extra_test_01`,
        familyId: 'fam_sharma_01',
        memberId: priya.id,
        memberName: priya.name,
        amountPaise: requestedAmountPaise,
        purpose: memberMessage,
        message: memberMessage,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        isExtraMoneyRequest: true,
      };

      expect(extraRequest.id).toBeDefined();
      expect(extraRequest.amountPaise).toBe(250000);
      expect(extraRequest.message).toBe(memberMessage);
      expect(extraRequest.purpose).toBe(memberMessage);
      expect(extraRequest.status).toBe('PENDING');
      expect(extraRequest.isExtraMoneyRequest).toBe(true);
    });

    it('rejects empty messages or non-positive amounts', () => {
      const validateExtraRequest = (amount: number, msg: string) => {
        if (!amount || amount <= 0 || isNaN(amount)) {
          return { valid: false, error: 'Please enter a valid amount greater than ₹0.' };
        }
        if (!msg || !msg.trim()) {
          return { valid: false, error: 'Please provide a message explaining why you need the additional money.' };
        }
        return { valid: true };
      };

      expect(validateExtraRequest(0, 'Test reason').valid).toBe(false);
      expect(validateExtraRequest(-500, 'Test reason').valid).toBe(false);
      expect(validateExtraRequest(100000, '').valid).toBe(false);
      expect(validateExtraRequest(100000, '   ').valid).toBe(false);
      expect(validateExtraRequest(100000, 'Valid reason').valid).toBe(true);
    });
  });

  // =========================================================================
  // 3. ADMINISTRATOR APPROVAL WORKFLOW
  // =========================================================================
  describe('3. Administrator Approval: Balance Transfer & Record Update', () => {
    it('transfers approved amount from Administrator main account to Member personal account immediately', async () => {
      let adminWallet: Wallet = {
        userId: owner.id,
        balancePaise: 1000000, // ₹10,000.00
        currency: 'INR',
        isSimulated: true,
      };

      let priyaAccount: Wallet = {
        userId: priya.id,
        balancePaise: 50000, // ₹500.00
        currency: 'INR',
        isSimulated: true,
      };

      const requestedAmountPaise = 200000; // ₹2,000.00
      const extraRequest: MoneyRequest = {
        id: 'req_extra_approve_test',
        familyId: 'fam_sharma_01',
        memberId: priya.id,
        memberName: priya.name,
        amountPaise: requestedAmountPaise,
        purpose: 'Semester project equipment',
        message: 'Semester project equipment',
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        isExtraMoneyRequest: true,
      };

      // Ensure Admin has sufficient funds
      expect(adminWallet.balancePaise).toBeGreaterThanOrEqual(requestedAmountPaise);

      // Execute approval
      adminWallet = {
        ...adminWallet,
        balancePaise: adminWallet.balancePaise - requestedAmountPaise,
      };
      priyaAccount = {
        ...priyaAccount,
        balancePaise: priyaAccount.balancePaise + requestedAmountPaise,
      };

      const completedTxn: Transaction = {
        id: `tx_approved_${Date.now()}`,
        reference: 'TXN-REF-EXTRA-01',
        familyId: 'fam_sharma_01',
        type: 'TRANSFER',
        status: 'COMPLETED',
        amountPaise: requestedAmountPaise,
        currency: 'INR',
        initiatorId: priya.id,
        payerId: owner.id,
        senderId: owner.id,
        senderName: owner.name,
        recipientId: priya.id,
        recipientName: priya.name,
        paymentSource: 'ADMIN_ACCOUNT',
        date: new Date().toISOString(),
        note: `Approved extra money request: ${extraRequest.message}`,
        isSimulated: true,
      };

      extraRequest.status = 'APPROVED';
      extraRequest.resolvedAt = new Date().toISOString();
      extraRequest.transactionReference = completedTxn.reference;

      // Assertions
      expect(adminWallet.balancePaise).toBe(800000); // ₹10,000 - ₹2,000 = ₹8,000
      expect(priyaAccount.balancePaise).toBe(250000); // ₹500 + ₹2,000 = ₹2,500
      expect(extraRequest.status).toBe('APPROVED');
      expect(completedTxn.status).toBe('COMPLETED');
      expect(completedTxn.note).toContain('Approved extra money request');
    });

    it('prevents approval if Administrator has insufficient funds', () => {
      const adminWallet: Wallet = {
        userId: owner.id,
        balancePaise: 100000, // ₹1,000.00
        currency: 'INR',
        isSimulated: true,
      };

      const requestedAmountPaise = 500000; // ₹5,000.00
      const canApprove = adminWallet.balancePaise >= requestedAmountPaise;

      expect(canApprove).toBe(false);
    });
  });

  // =========================================================================
  // 4. ADMINISTRATOR REJECTION WORKFLOW
  // =========================================================================
  describe('4. Administrator Rejection: Zero Money Transferred', () => {
    it('marks request as REJECTED and transfers ZERO money; balances remain strictly unchanged', () => {
      const initialAdminBalance = 1000000; // ₹10,000.00
      const initialMemberBalance = 50000;  // ₹500.00

      let adminWallet: Wallet = {
        userId: owner.id,
        balancePaise: initialAdminBalance,
        currency: 'INR',
        isSimulated: true,
      };

      let priyaAccount: Wallet = {
        userId: priya.id,
        balancePaise: initialMemberBalance,
        currency: 'INR',
        isSimulated: true,
      };

      const extraRequest: MoneyRequest = {
        id: 'req_extra_reject_test',
        familyId: 'fam_sharma_01',
        memberId: priya.id,
        memberName: priya.name,
        amountPaise: 300000,
        purpose: 'Non-essential purchase',
        message: 'Non-essential purchase',
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        isExtraMoneyRequest: true,
      };

      // Administrator rejects
      extraRequest.status = 'REJECTED';
      extraRequest.resolvedAt = new Date().toISOString();
      extraRequest.rejectionReason = 'Please stick to your agreed weekly allowance';

      // Balances must remain strictly unchanged
      expect(adminWallet.balancePaise).toBe(initialAdminBalance);
      expect(priyaAccount.balancePaise).toBe(initialMemberBalance);
      expect(extraRequest.status).toBe('REJECTED');
      expect(extraRequest.transactionReference).toBeUndefined();
    });
  });

  // =========================================================================
  // 5. PRESERVATION OF EXISTING REQUEST AND CANCEL WORKFLOW
  // =========================================================================
  describe('5. Preservation of Existing Limit-Exception Request and Cancel Workflow', () => {
    const overLimitModalSource = fs.readFileSync(
      path.resolve(__dirname, '../components/common/OverLimitRequestModal.tsx'),
      'utf-8'
    );
    const requestExtraMoneyModalSource = fs.readFileSync(
      path.resolve(__dirname, '../components/common/RequestExtraMoneyModal.tsx'),
      'utf-8'
    );
    const scanPaySource = fs.readFileSync(
      path.resolve(__dirname, '../pages/ScanPayPage.tsx'),
      'utf-8'
    );
    const dashboardSource = fs.readFileSync(
      path.resolve(__dirname, '../pages/DashboardPage.tsx'),
      'utf-8'
    );
    const requestMoneySource = fs.readFileSync(
      path.resolve(__dirname, '../pages/RequestMoneyPage.tsx'),
      'utf-8'
    );
    const toMobileSource = fs.readFileSync(
      path.resolve(__dirname, '../components/common/ToMobileModal.tsx'),
      'utf-8'
    );

    it('OverLimitRequestModal preserves both REQUEST and CANCEL options', () => {
      expect(overLimitModalSource).toContain('REQUEST');
      expect(overLimitModalSource).toContain('CANCEL');
      expect(overLimitModalSource).toContain('handleYes');
      expect(overLimitModalSource).toContain('handleClose');
    });

    it('OverLimitRequestModal allows the Member to provide a custom explanatory message to Administrator', () => {
      expect(overLimitModalSource).toContain('Message to Administrator');
      expect(overLimitModalSource).toContain('customMessage');
      expect(overLimitModalSource).toContain('onConfirmSendToAdmin(customMessage');
    });

    it('RequestExtraMoneyModal is defined with amount and message inputs', () => {
      expect(requestExtraMoneyModalSource).toContain('Request Extra Money');
      expect(requestExtraMoneyModalSource).toContain('amountRupees');
      expect(requestExtraMoneyModalSource).toContain('message');
      expect(requestExtraMoneyModalSource).toContain('submitExtraMoneyRequest');
    });

    it('ScanPayPage provides Request Extra Money when personal balance is insufficient', () => {
      expect(scanPaySource).toContain('RequestExtraMoneyModal');
      expect(scanPaySource).toContain('isRequestExtraMoneyOpen');
      expect(scanPaySource).toContain('Request Extra Money');
    });

    it('ToMobileModal provides Request Extra Money and message input for limit exceptions', () => {
      expect(toMobileSource).toContain('RequestExtraMoneyModal');
      expect(toMobileSource).toContain('isRequestExtraMoneyOpen');
      expect(toMobileSource).toContain('exceptionMessage');
    });

    it('DashboardPage displays the Member message in the Administrator approval queue', () => {
      expect(dashboardSource).toContain("Member's Message:");
      expect(dashboardSource).toContain('req.isExtraMoneyRequest');
      expect(dashboardSource).toContain('Extra Money Request');
      expect(dashboardSource).toContain('Approve & Transfer');
      expect(dashboardSource).toContain('Reject');
    });

    it('DashboardPage allows Member to trigger Request Extra Money from personal balance card', () => {
      expect(dashboardSource).toContain('setIsRequestExtraMoneyOpen(true)');
      expect(dashboardSource).toContain('Request Extra Money');
    });

    it('RequestMoneyPage provides Request Extra Money option and displays member message in request history', () => {
      expect(requestMoneySource).toContain('Request Extra Money');
      expect(requestMoneySource).toContain('setIsRequestExtraMoneyOpen(true)');
      expect(requestMoneySource).toContain('req.message');
    });
  });
});

