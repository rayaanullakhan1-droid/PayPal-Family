import { User, Wallet, SpendingRule, Transaction } from '../../types';
import { AISpendingContext } from '../aiAssistantService';
import { formatCurrency, fromPaise } from '../../utils/currency';
import { calculateMemberSpending, evaluateSpendingEligibility, RuleEvaluationResult } from '../spendingRuleEngine';
import { isSameDay, isSameMonth } from '../../utils/dates';

export interface MemberFinancialProfile {
  member: User;
  wallet: Wallet;
  rule?: SpendingRule;
  spentTodayPaise: number;
  spentThisMonthPaise: number;
  remainingDailyPaise: number;
  remainingMonthlyPaise: number;
  dailyPctUsed: number;
  monthlyPctUsed: number;
  canTransfer: boolean;
  canQRPay: boolean;
}

export interface CategoryExpense {
  category: string;
  totalPaise: number;
  count: number;
  percentage: number;
}

export interface FamilyFinancialSnapshot {
  familyName: string;
  owner: User;
  ownerPoolBalancePaise: number;
  totalDependents: number;
  members: MemberFinancialProfile[];
  totalSimulatedWealthPaise: number;
  totalSpentThisMonthPaise: number;
  totalCompletedTransactionsCount: number;
  totalRejectedTransactionsCount: number;
  recentTransactions: Transaction[];
  recentRejectedTransaction?: Transaction;
  categories: CategoryExpense[];
}

export class FinancialAnalytics {
  /**
   * Builds an accurate, non-hallucinated financial snapshot from live context.
   */
  static getSnapshot(context: AISpendingContext): FamilyFinancialSnapshot {
    const owner = context.familyMembers.find((m) => m.role === 'owner') || context.currentUser;
    const ownerPoolBalancePaise = context.ownerWallet?.balancePaise ?? 0;

    let totalMemberPersonalAccountsPaise = 0;
    const memberProfiles: MemberFinancialProfile[] = [];
    const accounts = context.memberPersonalAccounts || context.memberWallets || {};

    context.familyMembers.forEach((member) => {
      const wallet = accounts[member.id] || {
        userId: member.id,
        balancePaise: 0,
        currency: 'INR',
        isSimulated: true,
      };

      if (member.role === 'member') {
        totalMemberPersonalAccountsPaise += wallet.balancePaise;
        const rule = context.spendingRules[member.id];
        const spending = calculateMemberSpending(member.id, context.transactions);

        const dailyLimit = rule?.dailyLimitPaise || 0;
        const monthlyLimit = rule?.monthlyLimitPaise || 0;

        const remainingDailyPaise = Math.max(0, dailyLimit - spending.spentTodayPaise);
        const remainingMonthlyPaise = Math.max(0, monthlyLimit - spending.spentThisMonthPaise);

        const dailyPctUsed = dailyLimit > 0 ? Math.min(100, Math.round((spending.spentTodayPaise / dailyLimit) * 100)) : 0;
        const monthlyPctUsed = monthlyLimit > 0 ? Math.min(100, Math.round((spending.spentThisMonthPaise / monthlyLimit) * 100)) : 0;

        memberProfiles.push({
          member,
          wallet,
          rule,
          spentTodayPaise: spending.spentTodayPaise,
          spentThisMonthPaise: spending.spentThisMonthPaise,
          remainingDailyPaise,
          remainingMonthlyPaise,
          dailyPctUsed,
          monthlyPctUsed,
          canTransfer: rule?.allowMoneyTransfer ?? false,
          canQRPay: rule?.allowQRPayments ?? false,
        });
      }
    });

    // Transactions breakdown
    const completedTxns = context.transactions.filter((t) => t.status === 'COMPLETED');
    const rejectedTxns = context.transactions
      .filter((t) => t.status === 'REJECTED')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    let totalSpentThisMonthPaise = 0;
    const now = new Date();
    const catMap: Record<string, { totalPaise: number; count: number }> = {};

    completedTxns.forEach((t) => {
      const txnDate = new Date(t.date);
      if (isSameMonth(txnDate, now)) {
        totalSpentThisMonthPaise += t.amountPaise;
      }

      const cat = t.merchantCategory || (t.type === 'TRANSFER' ? 'Family Transfers' : 'General Purchases');
      if (!catMap[cat]) {
        catMap[cat] = { totalPaise: 0, count: 0 };
      }
      catMap[cat].totalPaise += t.amountPaise;
      catMap[cat].count += 1;
    });

    const totalSpentAllTimePaise = completedTxns.reduce((sum, t) => sum + t.amountPaise, 0);
    const categories: CategoryExpense[] = Object.entries(catMap)
      .map(([category, info]) => ({
        category,
        totalPaise: info.totalPaise,
        count: info.count,
        percentage: totalSpentAllTimePaise > 0 ? Math.round((info.totalPaise / totalSpentAllTimePaise) * 100) : 0,
      }))
      .sort((a, b) => b.totalPaise - a.totalPaise);

    return {
      familyName: 'The Sharma Family',
      owner,
      ownerPoolBalancePaise,
      totalDependents: memberProfiles.length,
      members: memberProfiles,
      totalSimulatedWealthPaise: ownerPoolBalancePaise + totalMemberPersonalAccountsPaise,
      totalSpentThisMonthPaise,
      totalCompletedTransactionsCount: completedTxns.length,
      totalRejectedTransactionsCount: rejectedTxns.length,
      recentTransactions: context.transactions.slice(0, 10),
      recentRejectedTransaction: rejectedTxns[0],
      categories,
    };
  }

  /**
   * Looks up a specific member by partial name, role, or ID.
   */
  static findMember(query: string, context: AISpendingContext): User | undefined {
    const q = query.trim().toLowerCase();
    if (!q) return undefined;

    // Check direct matches
    for (const member of context.familyMembers) {
      const name = member.name.toLowerCase();
      const firstName = name.split(' ')[0];
      const rel = (member.relationship || '').toLowerCase();

      if (member.id.toLowerCase() === q) return member;
      if (name.includes(q) || q.includes(firstName)) return member;
      if (q.includes('daughter') && rel.includes('daughter')) return member;
      if (q.includes('son') && rel.includes('son')) return member;
      if ((q.includes('owner') || q.includes('admin') || q.includes('father') || q.includes('dad') || q.includes('head')) && member.role === 'owner') {
        return member;
      }
    }

    return undefined;
  }

  /**
   * Rigorously checks whether a member can afford an amount for a given channel.
   * Utilizes the exact spending rule engine used by the payment processor.
   */
  static evaluateAffordability(
    member: User,
    amountPaise: number,
    actionType: 'TRANSFER' | 'QR_PAYMENT',
    context: AISpendingContext
  ): {
    eligible: boolean;
    ruleResult: RuleEvaluationResult;
    ownerPoolPaise: number;
    rule?: SpendingRule;
    spending: { spentTodayPaise: number; spentThisMonthPaise: number };
  } {
    const rule = context.spendingRules[member.id] || {
      memberId: member.id,
      singleTransactionLimitPaise: 50000,
      dailyLimitPaise: 100000,
      monthlyLimitPaise: 300000,
      allowMoneyTransfer: true,
      allowQRPayments: true,
    };

    const spending = calculateMemberSpending(member.id, context.transactions);

    const ruleResult = evaluateSpendingEligibility({
      amountPaise,
      actionType,
      member,
      ownerWallet: context.ownerWallet,
      rule,
      allTransactions: context.transactions,
    });

    return {
      eligible: ruleResult.eligible,
      ruleResult,
      ownerPoolPaise: context.ownerWallet?.balancePaise ?? 0,
      rule,
      spending,
    };
  }
}

