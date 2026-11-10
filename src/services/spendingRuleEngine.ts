import { SpendingRule, Transaction, Wallet, User } from '../types';
import { isSameDay, isSameMonth } from '../utils/dates';
import { formatCurrency } from '../utils/currency';

export interface RuleEvaluationResult {
  eligible: boolean;
  reason?: string;
  code?:
    | 'INSUFFICIENT_OWNER_FUNDS'
    | 'INSUFFICIENT_MEMBER_FUNDS'
    | 'PERMISSION_DENIED'
    | 'SINGLE_LIMIT_EXCEEDED'
    | 'DAILY_LIMIT_EXCEEDED'
    | 'MONTHLY_LIMIT_EXCEEDED'
    | 'INVALID_MEMBER';
  details?: {
    singleLimitPaise: number;
    spentTodayPaise: number;
    dailyLimitPaise: number;
    remainingTodayPaise: number;
    spentThisMonthPaise: number;
    monthlyLimitPaise: number;
    remainingMonthPaise: number;
    ownerBalancePaise: number;
  };
}

/**
 * Calculates current daily and monthly spending for a given member
 * based on completed transactions.
 */
export function calculateMemberSpending(
  memberId: string,
  transactions: Transaction[],
  referenceDate: Date = new Date()
): { spentTodayPaise: number; spentThisMonthPaise: number } {
  let spentTodayPaise = 0;
  let spentThisMonthPaise = 0;

  for (const txn of transactions) {
    // Count completed transactions initiated, paid, or sent by this member
    const isMemberTxn =
      txn.initiatorId === memberId ||
      txn.payerId === memberId ||
      txn.senderId === memberId;

    if (txn.status !== 'COMPLETED' || !isMemberTxn) {
      continue;
    }

    const txnDate = new Date(txn.date);

    if (isSameMonth(txnDate, referenceDate)) {
      spentThisMonthPaise += txn.amountPaise;
      if (isSameDay(txnDate, referenceDate)) {
        spentTodayPaise += txn.amountPaise;
      }
    }
  }

  return { spentTodayPaise, spentThisMonthPaise };
}

export interface MemberConsumption {
  spentTodayPaise: number;
  configuredDailyLimitPaise: number;
  remainingTodayPaise: number;
  spentThisMonthPaise: number;
  configuredMonthlyLimitPaise: number;
  remainingThisMonthPaise: number;
  maxRequestLimitPaise: number;
  dailyPct: number;
  monthlyPct: number;
  isDailyExceeded: boolean;
  isMonthlyExceeded: boolean;
  isDailyBlockedByMonthly: boolean;
  effectiveRemainingTodayPaise: number;
}

/**
 * Single source of truth calculation for member consumption and remaining allowances.
 */
export function calculateMemberConsumption(
  rule: SpendingRule,
  spendingOrTransactions: { spentTodayPaise: number; spentThisMonthPaise: number } | Transaction[],
  referenceDate: Date = new Date()
): MemberConsumption {
  const spending = Array.isArray(spendingOrTransactions)
    ? calculateMemberSpending(rule.memberId, spendingOrTransactions, referenceDate)
    : spendingOrTransactions;

  const configuredDailyLimitPaise = rule.dailyLimitPaise;
  const configuredMonthlyLimitPaise = rule.monthlyLimitPaise;
  const maxRequestLimitPaise = rule.maxRequestLimitPaise ?? rule.singleTransactionLimitPaise;

  const spentTodayPaise = spending.spentTodayPaise;
  const spentThisMonthPaise = spending.spentThisMonthPaise;

  const remainingTodayPaise = Math.max(0, configuredDailyLimitPaise - spentTodayPaise);
  const remainingThisMonthPaise = Math.max(0, configuredMonthlyLimitPaise - spentThisMonthPaise);

  const dailyPct = configuredDailyLimitPaise > 0
    ? Math.min(100, Math.round((spentTodayPaise / configuredDailyLimitPaise) * 100))
    : 0;
  const monthlyPct = configuredMonthlyLimitPaise > 0
    ? Math.min(100, Math.round((spentThisMonthPaise / configuredMonthlyLimitPaise) * 100))
    : 0;

  const isDailyExceeded = configuredDailyLimitPaise > 0 && spentTodayPaise >= configuredDailyLimitPaise;
  const isMonthlyExceeded = configuredMonthlyLimitPaise > 0 && spentThisMonthPaise >= configuredMonthlyLimitPaise;

  // IMPORTANT BUSINESS RULE:
  // If the monthly budget is exceeded, the account must also be treated as having
  // exceeded its allowance for payment eligibility, even if the daily allowance
  // has not independently been exhausted.
  const isDailyBlockedByMonthly = isMonthlyExceeded;
  const effectiveRemainingTodayPaise = isMonthlyExceeded ? 0 : remainingTodayPaise;

  return {
    spentTodayPaise,
    configuredDailyLimitPaise,
    remainingTodayPaise,
    spentThisMonthPaise,
    configuredMonthlyLimitPaise,
    remainingThisMonthPaise,
    maxRequestLimitPaise,
    dailyPct,
    monthlyPct,
    isDailyExceeded,
    isMonthlyExceeded,
    isDailyBlockedByMonthly,
    effectiveRemainingTodayPaise,
  };
}

/**
 * Pure evaluation engine checking all fintech spending rules for a money transfer or QR payment.
 */
export function evaluateSpendingEligibility(params: {
  amountPaise: number;
  actionType: 'TRANSFER' | 'QR_PAYMENT';
  member: User;
  ownerWallet?: Wallet;
  memberAccount?: Wallet;
  rule: SpendingRule;
  allTransactions: Transaction[];
  referenceDate?: Date;
}): RuleEvaluationResult {
  const { amountPaise, actionType, member, ownerWallet, memberAccount, rule, allTransactions, referenceDate = new Date() } = params;

  // 1. Check family membership
  if (member.role !== 'member') {
    return {
      eligible: false,
      code: 'INVALID_MEMBER',
      reason: 'Only registered family members are evaluated under spending rules.',
    };
  }

  // 2. Check action permissions
  if (actionType === 'TRANSFER' && !rule.allowMoneyTransfer) {
    return {
      eligible: false,
      code: 'PERMISSION_DENIED',
      reason: 'Direct money requests have been disabled by your family administrator.',
    };
  }

  if (actionType === 'QR_PAYMENT' && !rule.allowQRPayments) {
    return {
      eligible: false,
      code: 'PERMISSION_DENIED',
      reason: 'Merchant QR payments have been disabled by your family administrator.',
    };
  }

  // 3. Balance checks
  if (actionType === 'TRANSFER' && ownerWallet && ownerWallet.balancePaise < amountPaise) {
    return {
      eligible: false,
      code: 'INSUFFICIENT_OWNER_FUNDS',
      reason: `Insufficient simulated balance in Administrator Account. Available: ${formatCurrency(ownerWallet.balancePaise)}, Requested: ${formatCurrency(amountPaise)}.`,
    };
  }

  if (actionType === 'QR_PAYMENT' && memberAccount && memberAccount.balancePaise < amountPaise) {
    return {
      eligible: false,
      code: 'INSUFFICIENT_MEMBER_FUNDS',
      reason: `Insufficient balance in Personal Account. Available: ${formatCurrency(memberAccount.balancePaise)}, Required: ${formatCurrency(amountPaise)}.`,
    };
  }

  // Calculate current period spending using only Daily and Monthly limits
  const { spentTodayPaise, spentThisMonthPaise } = calculateMemberSpending(member.id, allTransactions, referenceDate);
  const remainingTodayPaise = Math.max(0, rule.dailyLimitPaise - spentTodayPaise);
  const remainingMonthPaise = Math.max(0, rule.monthlyLimitPaise - spentThisMonthPaise);

  const details = {
    singleLimitPaise: rule.singleTransactionLimitPaise || rule.dailyLimitPaise,
    spentTodayPaise,
    dailyLimitPaise: rule.dailyLimitPaise,
    remainingTodayPaise,
    spentThisMonthPaise,
    monthlyLimitPaise: rule.monthlyLimitPaise,
    remainingMonthPaise,
    ownerBalancePaise: ownerWallet?.balancePaise ?? 0,
  };

  // 4. Single Transaction Limit (if set)
  if (rule.singleTransactionLimitPaise > 0 && amountPaise > rule.singleTransactionLimitPaise) {
    return {
      eligible: false,
      code: 'SINGLE_LIMIT_EXCEEDED',
      reason: `Exceeds single transaction limit. Transaction amount: ${formatCurrency(amountPaise)}, Limit: ${formatCurrency(rule.singleTransactionLimitPaise)}.`,
      details,
    };
  }

  // 5. Evaluate Allowance Limits (Daily & Monthly Limits)
  const isDailyExceeded =
    rule.dailyLimitPaise > 0 && spentTodayPaise + amountPaise > rule.dailyLimitPaise;
  const isMonthlyExceeded =
    rule.monthlyLimitPaise > 0 && spentThisMonthPaise + amountPaise > rule.monthlyLimitPaise;

  if (isDailyExceeded && isMonthlyExceeded) {
    return {
      eligible: false,
      code: 'DAILY_LIMIT_EXCEEDED',
      reason: `Both daily spending allowance and monthly budget are exceeded. Spent today: ${formatCurrency(spentTodayPaise)} / ${formatCurrency(rule.dailyLimitPaise)}, Spent this month: ${formatCurrency(spentThisMonthPaise)} / ${formatCurrency(rule.monthlyLimitPaise)}.`,
      details,
    };
  }

  // If the monthly budget is exceeded, transactions are blocked for payment eligibility
  if (isMonthlyExceeded) {
    return {
      eligible: false,
      code: 'MONTHLY_LIMIT_EXCEEDED',
      reason: `Monthly budget exceeded. Spent this month: ${formatCurrency(spentThisMonthPaise)}, Monthly Limit: ${formatCurrency(rule.monthlyLimitPaise)} (transactions blocked even if daily allowance was not independently exhausted).`,
      details,
    };
  }

  if (isDailyExceeded) {
    return {
      eligible: false,
      code: 'DAILY_LIMIT_EXCEEDED',
      reason: `Exceeds daily spending limit. Spent today: ${formatCurrency(spentTodayPaise)}, Daily Limit: ${formatCurrency(rule.dailyLimitPaise)}, Remaining daily allowance: ${formatCurrency(remainingTodayPaise)}.`,
      details,
    };
  }

  return {
    eligible: true,
    details,
  };
}

