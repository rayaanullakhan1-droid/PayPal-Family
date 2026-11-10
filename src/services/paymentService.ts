import { Transaction, Wallet, User, SpendingRule, QRPayload, PaymentSource } from '../types';
import { evaluateSpendingEligibility, RuleEvaluationResult } from './spendingRuleEngine';
import { generateTransactionReference } from '../utils/id';
import { formatCurrency } from '../utils/currency';

export interface PaymentExecutionResult {
  success: boolean;
  transaction?: Transaction;
  error?: string;
  evaluation?: RuleEvaluationResult;
  isOverLimit?: boolean;
  autoTransferred?: boolean;
  overLimitDetails?: {
    configuredLimitPaise: number;
    requestedAmountPaise: number;
    excessAmountPaise: number;
  };
}

export interface IPaymentService {
  processMoneyTransfer(params: {
    member: User;
    owner: User;
    ownerWallet: Wallet;
    memberWallet: Wallet;
    rule: SpendingRule;
    amountPaise: number;
    purpose: string;
    existingTransactions: Transaction[];
    paymentSource?: PaymentSource;
  }): Promise<PaymentExecutionResult>;

  processDirectAdminTransfer(params: {
    owner: User;
    member: User;
    ownerWallet: Wallet;
    memberWallet: Wallet;
    rule: SpendingRule;
    amountPaise: number;
    note?: string;
    existingTransactions: Transaction[];
  }): Promise<PaymentExecutionResult>;

  processAddFunds(params: {
    owner: User;
    ownerWallet: Wallet;
    amountPaise: number;
    note?: string;
  }): Promise<PaymentExecutionResult>;

  processAdminSpend(params: {
    owner: User;
    ownerWallet: Wallet;
    amountPaise: number;
    recipientName: string;
    category?: string;
    note?: string;
    existingTransactions: Transaction[];
  }): Promise<PaymentExecutionResult>;

  processQRPayment(params: {
    member: User;
    memberAccount?: Wallet;
    owner?: User;
    ownerWallet?: Wallet;
    personalAccount?: Wallet;
    memberPersonalAccount?: Wallet;
    paymentSource?: PaymentSource;
    rule: SpendingRule;
    qrPayload?: QRPayload;
    merchantId?: string;
    merchantName?: string;
    merchantCategory?: string;
    amountPaise?: number;
    existingTransactions: Transaction[];
  }): Promise<PaymentExecutionResult>;
}

/**
 * In-memory simulated payment service with rule validation.
 * Represents a local fintech transaction engine for PayPal Family prototype.
 */
class SimulatedPaymentService implements IPaymentService {
  /**
   * Process a family member requesting money from the owner.
   * On success:
   *  - Deducts from owner's simulated wallet
   *  - Credits member's simulated wallet
   *  - Counts towards member's daily/monthly spending allowance
   */
  async processMoneyTransfer(params: {
    member: User;
    owner: User;
    ownerWallet: Wallet;
    memberWallet: Wallet;
    rule: SpendingRule;
    amountPaise: number;
    purpose: string;
    existingTransactions: Transaction[];
    paymentSource?: PaymentSource;
  }): Promise<PaymentExecutionResult> {
    const { member, owner, ownerWallet, rule, amountPaise, purpose, existingTransactions, paymentSource = 'ADMIN_ACCOUNT' } = params;

    // Simulate micro-latency for realistic UI feedback
    await new Promise((resolve) => setTimeout(resolve, 350));

    // Evaluate rules
    const evaluation = evaluateSpendingEligibility({
      amountPaise,
      actionType: 'TRANSFER',
      member,
      ownerWallet,
      rule,
      allTransactions: existingTransactions,
    });

    if (!evaluation.eligible) {
      // Record rejected transaction for audit trail
      const rejectedTxn: Transaction = {
        id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        reference: generateTransactionReference(),
        type: 'TRANSFER',
        status: 'REJECTED',
        amountPaise,
        currency: 'INR',
        initiatorId: member.id,
        payerId: owner.id,
        senderId: owner.id,
        senderName: owner.name,
        recipientId: member.id,
        recipientName: member.name,
        paymentSource,
        date: new Date().toISOString(),
        rejectionReason: evaluation.reason,
        note: purpose,
        isSimulated: true,
      };

      const maxLimit = rule.maxRequestLimitPaise ?? rule.singleTransactionLimitPaise;
      const isOverLimit =
        amountPaise > maxLimit ||
        evaluation.code === 'DAILY_LIMIT_EXCEEDED' ||
        evaluation.code === 'MONTHLY_LIMIT_EXCEEDED';

      let configuredLimitPaise = maxLimit;
      let excessAmountPaise = Math.max(0, amountPaise - maxLimit);

      if (evaluation.code === 'MONTHLY_LIMIT_EXCEEDED') {
        configuredLimitPaise = rule.monthlyLimitPaise;
        excessAmountPaise = Math.max(
          0,
          (evaluation.details?.spentThisMonthPaise || 0) + amountPaise - rule.monthlyLimitPaise
        );
      } else if (evaluation.code === 'DAILY_LIMIT_EXCEEDED') {
        configuredLimitPaise = rule.dailyLimitPaise;
        excessAmountPaise = Math.max(
          0,
          (evaluation.details?.spentTodayPaise || 0) + amountPaise - rule.dailyLimitPaise
        );
      }

      return {
        success: false,
        error: evaluation.reason,
        evaluation,
        transaction: rejectedTxn,
        isOverLimit,
        overLimitDetails: isOverLimit
          ? {
              configuredLimitPaise,
              requestedAmountPaise: amountPaise,
              excessAmountPaise,
            }
          : undefined,
      };
    }

    // Success transaction
    const completedTxn: Transaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      reference: generateTransactionReference(),
      type: 'TRANSFER',
      status: 'COMPLETED',
      amountPaise,
      currency: 'INR',
      initiatorId: member.id,
      payerId: owner.id,
      senderId: owner.id,
      senderName: owner.name,
      recipientId: member.id,
      recipientName: member.name,
      paymentSource,
      date: new Date().toISOString(),
      note: purpose,
      isSimulated: true,
    };

    return {
      success: true,
      autoTransferred: true,
      transaction: completedTxn,
      evaluation,
    };
  }

  /**
   * Process Administrator directly sending money to a family member.
   * On success:
   *  - Deducts from Administrator's account
   *  - Credits selected member's personal account
   *  - Generates transaction receipt
   */
  async processDirectAdminTransfer(params: {
    owner: User;
    member: User;
    ownerWallet: Wallet;
    memberWallet: Wallet;
    rule: SpendingRule;
    amountPaise: number;
    note?: string;
    existingTransactions: Transaction[];
  }): Promise<PaymentExecutionResult> {
    const { owner, member, ownerWallet, rule, amountPaise, note, existingTransactions } = params;

    await new Promise((resolve) => setTimeout(resolve, 350));

    // 1. Validate transfer amount
    if (!amountPaise || amountPaise <= 0 || isNaN(amountPaise)) {
      return {
        success: false,
        error: 'Please enter a valid transfer amount greater than ₹0.',
      };
    }

    // 2. Validate family membership
    if (member.role !== 'member') {
      return {
        success: false,
        error: 'Transfers can only be sent to registered family members.',
      };
    }

    // 3. Evaluate rules (permissions, admin balance sufficiency, and limits)
    const evaluation = evaluateSpendingEligibility({
      amountPaise,
      actionType: 'TRANSFER',
      member,
      ownerWallet,
      rule,
      allTransactions: existingTransactions,
    });

    if (!evaluation.eligible) {
      const rejectedTxn: Transaction = {
        id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        reference: generateTransactionReference(),
        type: 'TRANSFER',
        status: 'REJECTED',
        amountPaise,
        currency: 'INR',
        initiatorId: owner.id,
        payerId: owner.id,
        senderId: owner.id,
        senderName: owner.name,
        recipientId: member.id,
        recipientName: member.name,
        paymentSource: 'ADMIN_ACCOUNT',
        date: new Date().toISOString(),
        rejectionReason: evaluation.reason,
        note: note || `Direct transfer to ${member.name}`,
        isSimulated: true,
      };

      return {
        success: false,
        error: evaluation.reason,
        evaluation,
        transaction: rejectedTxn,
      };
    }

    // 4. Completed transaction
    const completedTxn: Transaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      reference: generateTransactionReference(),
      type: 'TRANSFER',
      status: 'COMPLETED',
      amountPaise,
      currency: 'INR',
      initiatorId: owner.id,
      payerId: owner.id,
      senderId: owner.id,
      senderName: owner.name,
      recipientId: member.id,
      recipientName: member.name,
      paymentSource: 'ADMIN_ACCOUNT',
      date: new Date().toISOString(),
      note: note || `Direct transfer from Administrator to ${member.name}`,
      isSimulated: true,
    };

    return {
      success: true,
      transaction: completedTxn,
      evaluation,
    };
  }

  /**
   * Process Administrator adding funds to their own account.
   * On success:
   *  - Credits Administrator's account immediately
   *  - Records completed ADD_MONEY transaction
   */
  async processAddFunds(params: {
    owner: User;
    ownerWallet: Wallet;
    amountPaise: number;
    note?: string;
  }): Promise<PaymentExecutionResult> {
    const { owner, amountPaise, note } = params;

    await new Promise((resolve) => setTimeout(resolve, 300));

    if (!amountPaise || amountPaise <= 0 || isNaN(amountPaise)) {
      return {
        success: false,
        error: 'Please enter a valid amount greater than ₹0.',
      };
    }

    if (amountPaise > 100000000) { // Max ₹10,00,000 topup
      return {
        success: false,
        error: 'Maximum single demo top-up limit is ₹10,00,000.',
      };
    }

    const completedTxn: Transaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      reference: generateTransactionReference(),
      type: 'ADD_MONEY',
      status: 'COMPLETED',
      amountPaise,
      currency: 'INR',
      initiatorId: owner.id,
      payerId: owner.id,
      senderId: 'simulated_bank',
      senderName: 'Simulated Bank / Card Top-up',
      recipientId: owner.id,
      recipientName: `${owner.name} (Administrator)`,
      paymentSource: 'ADMIN_ACCOUNT',
      date: new Date().toISOString(),
      note: note || 'Simulated demo money added to Administrator balance',
      isSimulated: true,
    };

    return {
      success: true,
      transaction: completedTxn,
    };
  }

  /**
   * Process Administrator spending directly from the central family pool.
   * On success:
   *  - Validates amount > 0 and balance sufficiency
   *  - Deducts from Administrator's central account
   *  - Generates transaction with type 'SPEND' and paymentSource 'ADMIN_ACCOUNT'
   */
  async processAdminSpend(params: {
    owner: User;
    ownerWallet: Wallet;
    amountPaise: number;
    recipientName: string;
    category?: string;
    note?: string;
    existingTransactions: Transaction[];
  }): Promise<PaymentExecutionResult> {
    const { owner, ownerWallet, amountPaise, recipientName, category, note } = params;

    await new Promise((resolve) => setTimeout(resolve, 300));

    // 1. Validate payment amount
    if (!amountPaise || amountPaise <= 0 || isNaN(amountPaise)) {
      return {
        success: false,
        error: 'Please enter a valid spending amount greater than ₹0.',
      };
    }

    // 2. Validate recipient
    if (!recipientName || recipientName.trim().length === 0) {
      return {
        success: false,
        error: 'Please enter a valid recipient or payment description.',
      };
    }

    // 3. Check Administrator central account balance
    if (ownerWallet.balancePaise < amountPaise) {
      return {
        success: false,
        error: `Insufficient balance in Administrator Account. Available: ${formatCurrency(ownerWallet.balancePaise)}.`,
      };
    }

    // 4. Record successful spending transaction
    const completedTxn: Transaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      reference: generateTransactionReference(),
      type: 'SPEND',
      status: 'COMPLETED',
      amountPaise,
      currency: 'INR',
      initiatorId: owner.id,
      payerId: owner.id,
      senderId: owner.id,
      senderName: `${owner.name} (Administrator)`,
      recipientId: `recip_${Date.now()}`,
      recipientName: recipientName.trim(),
      paymentSource: 'ADMIN_ACCOUNT',
      merchantCategory: category || 'General Expense',
      date: new Date().toISOString(),
      note: note || `Administrator payment to ${recipientName.trim()}`,
      isSimulated: true,
    };

    return {
      success: true,
      transaction: completedTxn,
    };
  }

  /**
   * Process a member or administrator scanning a merchant QR code.
   * When member:
   *  - Deducts from member's Personal Account
   *  - Validates available balance & spending limits
   *  - If limit exceeded, flags overLimitDetails for Request / Cancel flow
   * When administrator:
   *  - Deducts directly from central Administrator Account
   *  - Validates central account balance
   *  - Records QR_PAYMENT transaction with paymentSource: 'ADMIN_ACCOUNT'
   */
  async processQRPayment(params: {
    member: User;
    memberAccount?: Wallet;
    owner?: User;
    ownerWallet?: Wallet;
    personalAccount?: Wallet;
    memberPersonalAccount?: Wallet;
    paymentSource?: PaymentSource;
    rule: SpendingRule;
    qrPayload?: QRPayload;
    merchantId?: string;
    merchantName?: string;
    merchantCategory?: string;
    amountPaise?: number;
    existingTransactions: Transaction[];
  }): Promise<PaymentExecutionResult> {
    const effectiveQrPayload: QRPayload = params.qrPayload || {
      format: 'paypal_family_qr_v1',
      merchantId: params.merchantId || 'mch_demo',
      merchantName: params.merchantName || 'Demo Merchant',
      merchantCategory: params.merchantCategory || 'Shopping',
      amountPaise: params.amountPaise || 0,
      currency: 'INR',
      invoiceId: `INV-${Date.now()}`,
    };
    const { member, rule, existingTransactions } = params;

    await new Promise((resolve) => setTimeout(resolve, 350));

    // Handle Administrator QR payment directly from central pool
    const isOwnerPayment =
      params.paymentSource === 'ADMIN_ACCOUNT' ||
      member.role === 'owner';

    if (isOwnerPayment) {
      const adminWallet = params.ownerWallet || params.memberAccount;
      if (!adminWallet || adminWallet.balancePaise < effectiveQrPayload.amountPaise) {
        return {
          success: false,
          error: `Insufficient balance in Administrator Account. Available: ${formatCurrency(adminWallet?.balancePaise || 0)}.`,
        };
      }

      const completedTxn: Transaction = {
        id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        reference: generateTransactionReference(),
        type: 'QR_PAYMENT',
        status: 'COMPLETED',
        amountPaise: effectiveQrPayload.amountPaise,
        currency: 'INR',
        initiatorId: member.id,
        payerId: member.id,
        senderId: member.id,
        senderName: `${member.name} (Administrator Account)`,
        recipientId: effectiveQrPayload.merchantId,
        recipientName: effectiveQrPayload.merchantName,
        paymentSource: 'ADMIN_ACCOUNT',
        merchantId: effectiveQrPayload.merchantId,
        merchantCategory: effectiveQrPayload.merchantCategory,
        date: new Date().toISOString(),
        note: `QR Invoice: ${effectiveQrPayload.invoiceId} (Administrator Pool)`,
        isSimulated: true,
      };

      return {
        success: true,
        transaction: completedTxn,
      };
    }

    const effectiveAccount = params.memberAccount || params.personalAccount || params.memberPersonalAccount;

    // 1. Evaluate spending eligibility and Personal Account balance for members
    const evaluation = evaluateSpendingEligibility({
      amountPaise: effectiveQrPayload.amountPaise,
      actionType: 'QR_PAYMENT',
      member,
      memberAccount: effectiveAccount,
      rule,
      allTransactions: existingTransactions,
    });

    if (!evaluation.eligible) {
      const rejectedTxn: Transaction = {
        id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        reference: generateTransactionReference(),
        type: 'QR_PAYMENT',
        status: 'REJECTED',
        amountPaise: effectiveQrPayload.amountPaise,
        currency: 'INR',
        initiatorId: member.id,
        payerId: member.id,
        senderId: member.id,
        senderName: `${member.name} (Personal Account)`,
        recipientId: effectiveQrPayload.merchantId,
        recipientName: effectiveQrPayload.merchantName,
        paymentSource: 'PERSONAL_ACCOUNT',
        merchantId: effectiveQrPayload.merchantId,
        merchantCategory: effectiveQrPayload.merchantCategory,
        date: new Date().toISOString(),
        rejectionReason: evaluation.reason,
        note: `QR Invoice: ${effectiveQrPayload.invoiceId}`,
        isSimulated: true,
      };

      const maxLimit = rule.singleTransactionLimitPaise;
      const isOverLimit =
        effectiveQrPayload.amountPaise > maxLimit ||
        evaluation.code === 'DAILY_LIMIT_EXCEEDED' ||
        evaluation.code === 'MONTHLY_LIMIT_EXCEEDED';

      let configuredLimitPaise = maxLimit;
      let excessAmountPaise = Math.max(0, effectiveQrPayload.amountPaise - maxLimit);

      if (evaluation.code === 'MONTHLY_LIMIT_EXCEEDED') {
        configuredLimitPaise = rule.monthlyLimitPaise;
        excessAmountPaise = Math.max(
          0,
          (evaluation.details?.spentThisMonthPaise || 0) + effectiveQrPayload.amountPaise - rule.monthlyLimitPaise
        );
      } else if (evaluation.code === 'DAILY_LIMIT_EXCEEDED') {
        configuredLimitPaise = rule.dailyLimitPaise;
        excessAmountPaise = Math.max(
          0,
          (evaluation.details?.spentTodayPaise || 0) + effectiveQrPayload.amountPaise - rule.dailyLimitPaise
        );
      }

      return {
        success: false,
        error: evaluation.reason,
        evaluation,
        transaction: rejectedTxn,
        isOverLimit,
        overLimitDetails: isOverLimit
          ? {
              configuredLimitPaise,
              requestedAmountPaise: effectiveQrPayload.amountPaise,
              excessAmountPaise,
            }
          : undefined,
      };
    }

    // 2. Success: Payment completed directly from member Personal Account
    const completedTxn: Transaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      reference: generateTransactionReference(),
      type: 'QR_PAYMENT',
      status: 'COMPLETED',
      amountPaise: effectiveQrPayload.amountPaise,
      currency: 'INR',
      initiatorId: member.id,
      payerId: member.id,
      senderId: member.id,
      senderName: `${member.name} (Personal Account)`,
      recipientId: effectiveQrPayload.merchantId,
      recipientName: effectiveQrPayload.merchantName,
      paymentSource: 'PERSONAL_ACCOUNT',
      merchantId: effectiveQrPayload.merchantId,
      merchantCategory: effectiveQrPayload.merchantCategory,
      date: new Date().toISOString(),
      note: `QR Invoice: ${effectiveQrPayload.invoiceId}`,
      isSimulated: true,
    };

    return {
      success: true,
      transaction: completedTxn,
      evaluation,
    };
  }
}

export const paymentService: IPaymentService = new SimulatedPaymentService();

