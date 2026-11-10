import { User, Wallet, SpendingRule, Transaction, MoneyRequest } from '../types';
import { calculateMemberSpending } from './spendingRuleEngine';
import { generateTransactionReference } from '../utils/id';
import { formatCurrency } from '../utils/currency';

export interface AuthorizationEvaluationResult {
  authorized: boolean;
  requiresApproval: boolean;
  code: 'AUTHORIZED' | 'LIMIT_EXCEEDED' | 'INSUFFICIENT_ADMIN_FUNDS' | 'PERMISSION_DENIED' | 'INVALID_MEMBER';
  reason?: string;
  overLimitDetails?: {
    configuredLimitPaise: number;
    requestedAmountPaise: number;
    excessAmountPaise: number;
    limitType: 'SINGLE' | 'DAILY' | 'MONTHLY';
  };
  details?: {
    singleLimitPaise: number;
    spentTodayPaise: number;
    dailyLimitPaise: number;
    spentThisMonthPaise: number;
    monthlyLimitPaise: number;
    adminBalancePaise: number;
  };
}

export interface CentralTransactionResult {
  success: boolean;
  autoAuthorized: boolean;
  requiresApproval: boolean;
  transaction?: Transaction;
  request?: MoneyRequest;
  error?: string;
  overLimitDetails?: AuthorizationEvaluationResult['overLimitDetails'];
}

/**
 * Single Central Transaction Authorization Engine for PayPal Family
 * Applies identically to Demo Accounts and Custom Registered Accounts.
 *
 * Rules:
 *  - CASE A: Transaction amount <= permitted limit & within daily & within monthly -> AUTO AUTHORIZE.
 *  - CASE B: Transaction amount == permitted limit -> AUTO AUTHORIZE.
 *  - CASE C: Transaction amount > permitted limit OR daily/monthly exceeded -> PENDING APPROVAL REQUEST.
 *  - ONLY TWO ACCOUNTS: Administrator Account and Member Account.
 */
export class TransactionAuthorizationService {
  /**
   * Evaluate transaction against all configured limits.
   */
  evaluateTransaction(params: {
    member: User;
    amountPaise: number;
    rule: SpendingRule;
    allTransactions: Transaction[];
    adminWallet: Wallet;
    actionType?: 'TRANSFER' | 'QR_PAYMENT' | 'MOBILE_TRANSFER';
  }): AuthorizationEvaluationResult {
    const { member, amountPaise, rule, allTransactions, adminWallet, actionType = 'TRANSFER' } = params;

    // 1. Verify member identity
    if (member.role !== 'member') {
      return {
        authorized: false,
        requiresApproval: false,
        code: 'INVALID_MEMBER',
        reason: 'Only family members are subject to member authorization rules.',
      };
    }

    // 2. Permission check
    if (actionType === 'TRANSFER' && rule.allowMoneyTransfer === false) {
      return {
        authorized: false,
        requiresApproval: false,
        code: 'PERMISSION_DENIED',
        reason: 'Direct money transfers have been disabled by your Family Administrator.',
      };
    }
    if (actionType === 'QR_PAYMENT' && rule.allowQRPayments === false) {
      return {
        authorized: false,
        requiresApproval: false,
        code: 'PERMISSION_DENIED',
        reason: 'QR merchant payments have been disabled by your Family Administrator.',
      };
    }

    // Calculate current period consumption using only Daily and Monthly limits
    const { spentTodayPaise, spentThisMonthPaise } = calculateMemberSpending(member.id, allTransactions);
    const remainingTodayPaise = Math.max(0, rule.dailyLimitPaise - spentTodayPaise);
    const remainingMonthPaise = Math.max(0, rule.monthlyLimitPaise - spentThisMonthPaise);

    const details = {
      singleLimitPaise: rule.dailyLimitPaise,
      spentTodayPaise,
      dailyLimitPaise: rule.dailyLimitPaise,
      remainingTodayPaise,
      spentThisMonthPaise,
      monthlyLimitPaise: rule.monthlyLimitPaise,
      remainingMonthPaise,
      adminBalancePaise: adminWallet.balancePaise,
    };

    // 3. Evaluate ONLY Daily Spending Limit (within remaining = authorize, exceeds = approval)
    if (rule.dailyLimitPaise > 0 && spentTodayPaise + amountPaise > rule.dailyLimitPaise) {
      return {
        authorized: false,
        requiresApproval: true,
        code: 'LIMIT_EXCEEDED',
        reason: `Exceeds daily spending limit. Spent today: ${formatCurrency(spentTodayPaise)}, Daily Limit: ${formatCurrency(rule.dailyLimitPaise)}, Remaining daily allowance: ${formatCurrency(remainingTodayPaise)}.`,
        overLimitDetails: {
          configuredLimitPaise: rule.dailyLimitPaise,
          requestedAmountPaise: amountPaise,
          excessAmountPaise: spentTodayPaise + amountPaise - rule.dailyLimitPaise,
          limitType: 'DAILY',
        },
        details,
      };
    }

    // 4. Evaluate ONLY Monthly Spending Limit (within remaining = authorize, exceeds = approval)
    if (rule.monthlyLimitPaise > 0 && spentThisMonthPaise + amountPaise > rule.monthlyLimitPaise) {
      return {
        authorized: false,
        requiresApproval: true,
        code: 'LIMIT_EXCEEDED',
        reason: `Exceeds monthly budget. Spent this month: ${formatCurrency(spentThisMonthPaise)}, Monthly Limit: ${formatCurrency(rule.monthlyLimitPaise)}, Remaining monthly budget: ${formatCurrency(remainingMonthPaise)}.`,
        overLimitDetails: {
          configuredLimitPaise: rule.monthlyLimitPaise,
          requestedAmountPaise: amountPaise,
          excessAmountPaise: spentThisMonthPaise + amountPaise - rule.monthlyLimitPaise,
          limitType: 'MONTHLY',
        },
        details,
      };
    }

    // 5. Check Administrator balance for funding
    if (adminWallet.balancePaise < amountPaise) {
      return {
        authorized: false,
        requiresApproval: false,
        code: 'INSUFFICIENT_ADMIN_FUNDS',
        reason: `Insufficient balance in Administrator Account. Available: ${formatCurrency(adminWallet.balancePaise)}, Requested: ${formatCurrency(amountPaise)}.`,
        details,
      };
    }

    // Fits within BOTH remaining limits (Daily & Monthly) & Admin has funds -> AUTO AUTHORIZE
    return {
      authorized: true,
      requiresApproval: false,
      code: 'AUTHORIZED',
      details,
    };
  }

  /**
   * Creates a completed transaction for an authorized transfer.
   */
  createCompletedTransfer(params: {
    member: User;
    owner: User;
    familyId: string;
    amountPaise: number;
    purpose?: string;
  }): Transaction {
    const { member, owner, familyId, amountPaise, purpose } = params;
    return {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      reference: generateTransactionReference(),
      familyId,
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
      paymentSource: 'ADMIN_ACCOUNT',
      date: new Date().toISOString(),
      note: purpose || 'Family Fund Transfer',
      isSimulated: true,
    };
  }

  /**
   * Creates a pending money request for above-limit transactions.
   */
  createPendingApprovalRequest(params: {
    member: User;
    familyId: string;
    amountPaise: number;
    purpose?: string;
    message?: string;
    configuredLimitPaise: number;
    excessAmountPaise: number;
    isException?: boolean;
    isExtraMoneyRequest?: boolean;
  }): MoneyRequest {
    const {
      member,
      familyId,
      amountPaise,
      purpose,
      message,
      configuredLimitPaise,
      excessAmountPaise,
      isException = true,
      isExtraMoneyRequest = false,
    } = params;

    const trimmedMsg = (message && message.trim()) || (purpose && purpose.trim()) || 'Over-limit family fund request';

    return {
      id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      familyId,
      memberId: member.id,
      memberName: member.name,
      memberAvatar: member.avatarUrl,
      amountPaise,
      purpose: trimmedMsg,
      message: trimmedMsg,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      isException,
      isExtraMoneyRequest,
      configuredLimitPaise,
      excessAmountPaise,
    };
  }
}

export const transactionAuthorizationService = new TransactionAuthorizationService();

