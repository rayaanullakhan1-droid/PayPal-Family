import { IAIProvider, AIProviderResponse } from './aiProviderInterface';
import { AISpendingContext } from '../aiAssistantService';
import { FinancialAnalytics, FamilyFinancialSnapshot } from './financialAnalytics';
import { ParsedIntent } from './intentRecognizer';
import { formatCurrency } from '../../utils/currency';
import { formatDateTime } from '../../utils/dates';

export class LocalFintechAIProvider implements IAIProvider {
  readonly id = 'local_fintech_engine';
  readonly displayName = 'PayPal Family Local Intelligence Engine (Fallback Mode)';
  readonly isFallback = true;

  async processQuery(
    parsed: ParsedIntent,
    context: AISpendingContext,
    snapshot: FamilyFinancialSnapshot
  ): Promise<AIProviderResponse> {
    const { intent, entities, rawQuery } = parsed;

    switch (intent) {
      case 'BALANCE_INQUIRY':
        return this.handleBalanceInquiry(entities, context, snapshot);

      case 'FAMILY_MEMBERS_INQUIRY':
        return this.handleFamilyMembersInquiry(context, snapshot);

      case 'SPENDING_LIMITS_INQUIRY':
        return this.handleSpendingLimitsInquiry(entities, context, snapshot);

      case 'AFFORDABILITY_CHECK':
        return this.handleAffordabilityCheck(entities, context, snapshot, rawQuery);

      case 'SPENDING_SUMMARY':
        return this.handleSpendingSummary(context, snapshot);

      case 'CATEGORY_BREAKDOWN':
        return this.handleCategoryBreakdown(entities, snapshot);

      case 'TRANSACTIONS_INQUIRY':
        return this.handleTransactionsInquiry(entities, context, snapshot);

      case 'PAYMENT_FAILURE_EXPLANATION':
        return this.handlePaymentFailureExplanation(entities, context, snapshot);

      case 'BUDGET_ADVICE_AND_SAVINGS':
        return this.handleBudgetAdviceAndSavings(entities, context, snapshot);

      case 'PERMISSIONS_INQUIRY':
        return this.handlePermissionsInquiry(entities, context, snapshot);

      case 'HOW_IT_WORKS_HELP':
        return this.handleHowItWorksHelp(context);

      case 'UNKNOWN_OR_AMBIGUOUS':
      default:
        return this.handleUnknownOrAmbiguous(rawQuery, context);
    }
  }

  // 1. Balance Inquiry
  private handleBalanceInquiry(
    entities: ParsedIntent['entities'],
    context: AISpendingContext,
    snapshot: FamilyFinancialSnapshot
  ): AIProviderResponse {
    const target = entities.targetMember;

    // A. Specific member wallet requested
    if (target && target.role === 'member') {
      const profile = snapshot.members.find((m) => m.member.id === target.id);
      const balance = profile ? formatCurrency(profile.wallet.balancePaise) : '₹0.00';
      const remainingDaily = profile ? formatCurrency(profile.remainingDailyPaise) : '₹0.00';
      const remainingMonthly = profile ? formatCurrency(profile.remainingMonthlyPaise) : '₹0.00';

      const text = `💰 **Wallet Balance for ${target.name}**\n\n` +
        `• **Direct Pocket Wallet:** **${balance}** (Funds transferred to personal account)\n` +
        `• **Remaining Daily Allowance:** ${remainingDaily}\n` +
        `• **Remaining Monthly Allowance:** ${remainingMonthly}\n` +
        `• **Central Family Pool Available:** ${formatCurrency(snapshot.ownerPoolBalancePaise)}\n\n` +
        `💡 *Note: Dependent wallet funds come from approved family transfer requests. Merchant QR payments are debited directly from the family pool.*`;

      return {
        text,
        metadata: {
          type: 'balance_inquiry',
          providerName: this.displayName,
          isFallback: this.isFallback,
          data: { memberId: target.id, balancePaise: profile?.wallet.balancePaise },
        },
      };
    }

    // B. Specific owner / admin balance requested
    if (target && target.role === 'owner') {
      const text = `🏦 **Central Family Pool Balance (${target.name})**\n\n` +
        `• **Available Family Pool:** **${formatCurrency(snapshot.ownerPoolBalancePaise)}**\n` +
        `• **Account Status:** Active Simulated Master Ledger\n` +
        `• **Total Dependents Supported:** ${snapshot.totalDependents}\n` +
        `• **Combined Family Wealth:** ${formatCurrency(snapshot.totalSimulatedWealthPaise)}\n\n` +
        `This central pool funds all dependent transfers and merchant QR payments.`;

      return {
        text,
        metadata: {
          type: 'balance_inquiry',
          providerName: this.displayName,
          isFallback: this.isFallback,
          data: { ownerPoolBalancePaise: snapshot.ownerPoolBalancePaise },
        },
      };
    }

    // C. General Family Pool / Total Balance
    let memberBalancesText = '';
    snapshot.members.forEach((m) => {
      memberBalancesText += `• **${m.member.name} (${m.member.relationship?.split(' ')[0]}):** ${formatCurrency(m.wallet.balancePaise)} direct wallet (Remaining today: ${formatCurrency(m.remainingDailyPaise)})\n`;
    });

    const text = `🏦 **Family Financial Balances Overview**\n\n` +
      `• **Central Family Pool (Owner):** **${formatCurrency(snapshot.ownerPoolBalancePaise)}**\n` +
      `• **Total Combined Family Assets:** **${formatCurrency(snapshot.totalSimulatedWealthPaise)}**\n\n` +
      `**Dependent Pocket Wallets:**\n${memberBalancesText}\n` +
      `💡 *As the Family Administrator, funds in the central pool are shared across dependents subject to their individual spending limits.*`;

    return {
      text,
      metadata: {
        type: 'balance_inquiry',
        providerName: this.displayName,
        isFallback: this.isFallback,
        data: { ownerPool: snapshot.ownerPoolBalancePaise, totalWealth: snapshot.totalSimulatedWealthPaise },
      },
    };
  }

  // 2. Family Members Inquiry
  private handleFamilyMembersInquiry(
    context: AISpendingContext,
    snapshot: FamilyFinancialSnapshot
  ): AIProviderResponse {
    let membersList = `👨‍👩‍👧‍👦 **${snapshot.familyName} Membership Directory**\n\n`;
    membersList += `• **${snapshot.owner.name}** (Administrator / Family Head)\n  Email: ${snapshot.owner.email} • Master Fund: ${formatCurrency(snapshot.ownerPoolBalancePaise)}\n\n`;

    snapshot.members.forEach((m) => {
      membersList += `• **${m.member.name}** (${m.member.relationship || 'Dependent'})\n`;
      membersList += `  Email: ${m.member.email}\n`;
      membersList += `  Pocket Balance: ${formatCurrency(m.wallet.balancePaise)} • Daily Limit: ${m.rule ? formatCurrency(m.rule.dailyLimitPaise) : 'N/A'} • Monthly Cap: ${m.rule ? formatCurrency(m.rule.monthlyLimitPaise) : 'N/A'}\n`;
      membersList += `  Permissions: Transfers [${m.canTransfer ? '✅' : '❌'}], QR Merchant [${m.canQRPay ? '✅' : '❌'}]\n\n`;
    });

    membersList += `To invite new family members or remove a member, navigate to the **Family** tab in the sidebar.`;

    return {
      text: membersList,
      metadata: {
        type: 'family_members',
        providerName: this.displayName,
        isFallback: this.isFallback,
        data: { count: context.familyMembers.length },
      },
    };
  }

  // 3. Spending Limits Inquiry
  private handleSpendingLimitsInquiry(
    entities: ParsedIntent['entities'],
    context: AISpendingContext,
    snapshot: FamilyFinancialSnapshot
  ): AIProviderResponse {
    const target = entities.targetMember;

    if (target && target.role === 'member') {
      const profile = snapshot.members.find((m) => m.member.id === target.id);
      if (!profile || !profile.rule) {
        return {
          text: `No active spending rule configured for ${target.name}. Default limits apply.`,
          metadata: { providerName: this.displayName, isFallback: this.isFallback },
        };
      }

      const rule = profile.rule;
      const text = `⚙️ **Spending Controls for ${target.name} (${target.relationship})**\n\n` +
        `• **Single Transaction Cap:** **${formatCurrency(rule.singleTransactionLimitPaise)}** (Max per single purchase or request)\n` +
        `• **Daily Spending Limit:** **${formatCurrency(rule.dailyLimitPaise)}**\n` +
        `  - Spent today: ${formatCurrency(profile.spentTodayPaise)} (${profile.dailyPctUsed}%)\n` +
        `  - Remaining today: **${formatCurrency(profile.remainingDailyPaise)}**\n` +
        `• **Monthly Spending Limit:** **${formatCurrency(rule.monthlyLimitPaise)}**\n` +
        `  - Spent this month: ${formatCurrency(profile.spentThisMonthPaise)} (${profile.monthlyPctUsed}%)\n` +
        `  - Remaining this month: **${formatCurrency(profile.remainingMonthlyPaise)}**\n` +
        `• **Channel Permissions:**\n` +
        `  - Money Transfers: ${rule.allowMoneyTransfer ? '✅ Enabled' : '❌ Disabled'}\n` +
        `  - QR Merchant Payments: ${rule.allowQRPayments ? '✅ Enabled' : '❌ Disabled'}\n\n` +
        `Limits are enforced authoritatively by the PayPal Family rules engine.`;

      return {
        text,
        metadata: {
          type: 'spending_limits',
          providerName: this.displayName,
          isFallback: this.isFallback,
          data: rule,
        },
      };
    }

    // Family-wide limits summary
    let text = `⚙️ **Family Spending Limits Summary**\n\n`;
    snapshot.members.forEach((m) => {
      if (m.rule) {
        text += `• **${m.member.name}**:\n` +
          `  - Single Txn Cap: ${formatCurrency(m.rule.singleTransactionLimitPaise)}\n` +
          `  - Daily Limit: ${formatCurrency(m.rule.dailyLimitPaise)} (${formatCurrency(m.remainingDailyPaise)} remaining today)\n` +
          `  - Monthly Limit: ${formatCurrency(m.rule.monthlyLimitPaise)} (${formatCurrency(m.remainingMonthlyPaise)} remaining this month)\n` +
          `  - Permissions: Transfer [${m.canTransfer ? '✅' : '❌'}], QR [${m.canQRPay ? '✅' : '❌'}]\n\n`;
      }
    });

    text += `Family Administrators can adjust these limits anytime on the **Spending Limits** page.`;

    return {
      text,
      metadata: {
        type: 'spending_limits_all',
        providerName: this.displayName,
        isFallback: this.isFallback,
      },
    };
  }

  // 4. Affordability Check
  private handleAffordabilityCheck(
    entities: ParsedIntent['entities'],
    context: AISpendingContext,
    snapshot: FamilyFinancialSnapshot,
    rawQuery: string
  ): AIProviderResponse {
    let target = entities.targetMember;
    if (!target || target.role !== 'member') {
      // Pick first member if owner asks generally or no target
      target = snapshot.members[0]?.member;
    }

    if (!target) {
      return {
        text: `Please specify which family member you are checking affordability for (e.g. Priya or Aarav).`,
        metadata: { providerName: this.displayName, isFallback: this.isFallback },
      };
    }

    // Determine amount
    let amountPaise = entities.amountPaise;
    if (!amountPaise || amountPaise <= 0) {
      // Default to common testing inquiry
      amountPaise = 50000; // ₹500
    }

    const actionType = entities.actionType || 'QR_PAYMENT';
    const profile = snapshot.members.find((m) => m.member.id === target?.id);
    const rule = profile?.rule;

    const evaluation = FinancialAnalytics.evaluateAffordability(target, amountPaise, actionType, context);

    const testAmountFormatted = formatCurrency(amountPaise);
    const channelLabel = actionType === 'QR_PAYMENT' ? 'Merchant QR Payment' : 'Direct Money Transfer';

    let breakdown = `🔎 **Affordability Analysis for ${target.name}**\n` +
      `• **Proposed Amount:** **${testAmountFormatted}**\n` +
      `• **Intended Channel:** ${channelLabel}\n\n` +
      `**Compliance Checks:**\n`;

    const canSingle = rule ? amountPaise <= rule.singleTransactionLimitPaise : false;
    const canDaily = profile ? amountPaise <= profile.remainingDailyPaise : false;
    const canMonthly = profile ? amountPaise <= profile.remainingMonthlyPaise : false;
    const canPool = snapshot.ownerPoolBalancePaise >= amountPaise;
    const canPerm = actionType === 'QR_PAYMENT' ? (profile?.canQRPay ?? false) : (profile?.canTransfer ?? false);

    breakdown += `• **Channel Permission:** ${canPerm ? '✅ Allowed' : '❌ Blocked by administrator'}\n`;
    breakdown += `• **Single Transaction Cap:** ${rule ? formatCurrency(rule.singleTransactionLimitPaise) : 'N/A'} (${canSingle ? '✅ Within limit' : `❌ Exceeds limit by ${formatCurrency(amountPaise - (rule?.singleTransactionLimitPaise || 0))}`})\n`;
    breakdown += `• **Remaining Daily Allowance:** ${profile ? formatCurrency(profile.remainingDailyPaise) : 'N/A'} (${canDaily ? '✅ Within limit' : `❌ Exceeds daily headroom`})\n`;
    breakdown += `• **Remaining Monthly Cap:** ${profile ? formatCurrency(profile.remainingMonthlyPaise) : 'N/A'} (${canMonthly ? '✅ Within limit' : `❌ Exceeds monthly budget`})\n`;
    breakdown += `• **Central Family Pool:** ${formatCurrency(snapshot.ownerPoolBalancePaise)} (${canPool ? '✅ Available' : '❌ Insufficient pool funds'})\n\n`;

    if (evaluation.eligible) {
      breakdown += `🎉 **Verdict: Approved.** ${target.name} is fully eligible to complete this ${testAmountFormatted} transaction right now.`;
    } else {
      breakdown += `⚠️ **Verdict: Declined.** This payment would be blocked by the rules engine.\n**Exact Reason:** ${evaluation.ruleResult.reason}`;
    }

    return {
      text: breakdown,
      metadata: {
        type: 'affordability_check',
        providerName: this.displayName,
        isFallback: this.isFallback,
        data: { eligible: evaluation.eligible, amountPaise, targetId: target.id },
      },
    };
  }

  // 5. Spending Summary
  private handleSpendingSummary(
    context: AISpendingContext,
    snapshot: FamilyFinancialSnapshot
  ): AIProviderResponse {
    let text = `📊 **Family Spending Report (Current Month)**\n\n` +
      `• **Total Family Expenditure:** **${formatCurrency(snapshot.totalSpentThisMonthPaise)}**\n` +
      `• **Completed Transactions:** ${snapshot.totalCompletedTransactionsCount}\n` +
      `• **Declined Transactions:** ${snapshot.totalRejectedTransactionsCount}\n` +
      `• **Active Central Family Pool:** ${formatCurrency(snapshot.ownerPoolBalancePaise)}\n\n` +
      `**Expenditure by Dependent:**\n`;

    snapshot.members.forEach((m) => {
      text += `• **${m.member.name}**: ${formatCurrency(m.spentThisMonthPaise)} spent out of ${m.rule ? formatCurrency(m.rule.monthlyLimitPaise) : '₹0'} monthly limit (${m.monthlyPctUsed}%)\n`;
      text += `  - Today's spending: ${formatCurrency(m.spentTodayPaise)} (${formatCurrency(m.remainingDailyPaise)} left today)\n`;
    });

    text += `\n💡 *Tip: Keeping member monthly utilization below 80% prevents unexpected end-of-month card blocks.*`;

    return {
      text,
      metadata: {
        type: 'spending_summary',
        providerName: this.displayName,
        isFallback: this.isFallback,
        data: { totalSpentMonthPaise: snapshot.totalSpentThisMonthPaise },
      },
    };
  }

  // 6. Category Breakdown
  private handleCategoryBreakdown(
    entities: ParsedIntent['entities'],
    snapshot: FamilyFinancialSnapshot
  ): AIProviderResponse {
    if (snapshot.categories.length === 0) {
      return {
        text: `🛍️ **Spending Category Breakdown**\n\nNo completed transactions found yet. Test a money transfer or scan a merchant QR code (such as Campus Cafeteria or City Bookstore) to start generating category analytics!`,
        metadata: { providerName: this.displayName, isFallback: this.isFallback },
      };
    }

    // Specific category requested?
    if (entities.categoryFilter) {
      const match = snapshot.categories.find(
        (c) => c.category.toLowerCase().includes(entities.categoryFilter!.toLowerCase())
      );

      if (match) {
        return {
          text: `🛍️ **Category Details: ${match.category}**\n\n` +
            `• **Total Spent:** **${formatCurrency(match.totalPaise)}**\n` +
            `• **Transaction Count:** ${match.count} payment(s)\n` +
            `• **Share of Family Spending:** ${match.percentage}% of all expenditures.`,
          metadata: { providerName: this.displayName, isFallback: this.isFallback, data: match },
        };
      } else {
        return {
          text: `🛍️ **Category: ${entities.categoryFilter}**\n\nNo recorded transactions found in this category yet. Current family expenditures are concentrated in: ${snapshot.categories.map((c) => c.category).join(', ')}.`,
          metadata: { providerName: this.displayName, isFallback: this.isFallback },
        };
      }
    }

    // All categories list
    let text = `🛍️ **Top Family Spending Categories**\n\n`;
    snapshot.categories.forEach((cat, index) => {
      text += `${index + 1}. **${cat.category}**: **${formatCurrency(cat.totalPaise)}** (${cat.percentage}% • ${cat.count} txn)\n`;
    });

    text += `\n*Transactions are automatically categorized when scanning supported merchant QR codes.*`;

    return {
      text,
      metadata: {
        type: 'category_breakdown',
        providerName: this.displayName,
        isFallback: this.isFallback,
        data: snapshot.categories,
      },
    };
  }

  // 7. Transactions Inquiry
  private handleTransactionsInquiry(
    entities: ParsedIntent['entities'],
    context: AISpendingContext,
    snapshot: FamilyFinancialSnapshot
  ): AIProviderResponse {
    let txns = context.transactions;

    // Filter by member if specified
    if (entities.targetMember) {
      txns = txns.filter((t) => t.initiatorId === entities.targetMember?.id);
    }

    // Filter by action type
    if (entities.actionType) {
      txns = txns.filter((t) => t.type === entities.actionType);
    }

    // Filter by category
    if (entities.categoryFilter) {
      txns = txns.filter((t) => (t.merchantCategory || '').toLowerCase().includes(entities.categoryFilter!.toLowerCase()));
    }

    if (txns.length === 0) {
      return {
        text: `📋 **Transaction Search**\n\nNo transactions matched your criteria (${entities.targetMember ? entities.targetMember.name : 'all members'}, ${entities.actionType || 'all types'}).`,
        metadata: { providerName: this.displayName, isFallback: this.isFallback },
      };
    }

    const displayTxns = txns.slice(0, 5);
    let text = `📋 **Recent Transactions Log (${displayTxns.length} of ${txns.length})**\n\n`;

    displayTxns.forEach((t) => {
      const isCompleted = t.status === 'COMPLETED';
      const typeLabel = t.type === 'TRANSFER' ? 'Transfer' : 'QR Payment';
      const initiator = context.familyMembers.find((m) => m.id === t.initiatorId)?.name || 'Member';

      text += `• **${t.recipientName}** — **${formatCurrency(t.amountPaise)}**\n` +
        `  Status: ${isCompleted ? '✅ COMPLETED' : '❌ DECLINED'} | Type: ${typeLabel} | By: ${initiator}\n` +
        `  Ref: \`${t.reference}\` | Date: ${formatDateTime(t.date)}\n`;
      if (!isCompleted && t.rejectionReason) {
        text += `  *Decline reason: ${t.rejectionReason}*\n`;
      }
      text += `\n`;
    });

    text += `View full receipts and printable records under the **Transactions** ledger.`;

    return {
      text,
      metadata: {
        type: 'transactions_list',
        providerName: this.displayName,
        isFallback: this.isFallback,
        data: { count: txns.length },
      },
    };
  }

  // 8. Payment Failure Explanation
  private handlePaymentFailureExplanation(
    entities: ParsedIntent['entities'],
    context: AISpendingContext,
    snapshot: FamilyFinancialSnapshot
  ): AIProviderResponse {
    const rejectedTxns = context.transactions
      .filter((t) => t.status === 'REJECTED')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    let targetTxn = rejectedTxns[0];

    // If target member specified, pick their recent rejection
    if (entities.targetMember) {
      targetTxn = rejectedTxns.find((t) => t.initiatorId === entities.targetMember?.id) || targetTxn;
    }

    if (!targetTxn) {
      return {
        text: `✅ **No Declined Payments Found**\n\nAll family payments and money requests in the current session have complied with spending limits and processed successfully!\n\nTo test how declined payments are handled, try requesting ₹15,000 (exceeds pool balance) or scanning a ₹1,200 merchant item with a ₹500 single limit.`,
        metadata: { providerName: this.displayName, isFallback: this.isFallback },
      };
    }

    const initiator = context.familyMembers.find((m) => m.id === targetTxn.initiatorId)?.name || 'Member';
    const channelLabel = targetTxn.type === 'TRANSFER' ? 'Family Transfer' : 'Merchant QR Payment';

    let explanation = `🔍 **Declined Transaction Audit**\n\n` +
      `• **Amount:** **${formatCurrency(targetTxn.amountPaise)}**\n` +
      `• **Initiated By:** ${initiator} on ${formatDateTime(targetTxn.date)}\n` +
      `• **Type / Merchant:** ${channelLabel} (${targetTxn.recipientName})\n` +
      `• **Reference ID:** \`${targetTxn.reference}\`\n\n` +
      `🛑 **Authoritative Decline Reason:**\n` +
      `> "${targetTxn.rejectionReason || 'Spending limit policy exceeded'}"\n\n` +
      `**How to Resolve This:**\n` +
      `1. The Family Administrator can adjust the member's daily/monthly limit in **Spending Limits**.\n` +
      `2. Verify that the central family pool has sufficient funds (${formatCurrency(snapshot.ownerPoolBalancePaise)} currently available).\n` +
      `3. Verify that channel permissions for ${channelLabel} are toggled ON.\n\n` +
      `*Note: As an AI assistant, I can explain decline reasons but cannot override rules or alter limits.*`;

    return {
      text: explanation,
      metadata: {
        type: 'rejection_explanation',
        providerName: this.displayName,
        isFallback: this.isFallback,
        data: targetTxn,
      },
    };
  }

  // 9. Budget Advice and Savings
  private handleBudgetAdviceAndSavings(
    entities: ParsedIntent['entities'],
    context: AISpendingContext,
    snapshot: FamilyFinancialSnapshot
  ): AIProviderResponse {
    let text = `💡 **Personalized Family Budget & Savings Recommendations**\n\n`;

    // Calculate savings rate in central pool
    const initialPoolPaise = 1000000; // ₹10,000 base
    const currentPool = snapshot.ownerPoolBalancePaise;
    const poolPreservedPct = Math.round((currentPool / initialPoolPaise) * 100);

    text += `• **Family Pool Health:** ${formatCurrency(currentPool)} available (${poolPreservedPct}% of starting pool intact).\n\n`;

    text += `**Member-Specific Budget Insights:**\n`;
    snapshot.members.forEach((m) => {
      const isCollege = (m.member.relationship || '').toLowerCase().includes('college');
      const isSchool = (m.member.relationship || '').toLowerCase().includes('school');

      text += `• **${m.member.name} (${m.member.relationship}):**\n`;
      text += `  - Daily usage: ${m.dailyPctUsed}% (${formatCurrency(m.spentTodayPaise)} / ${m.rule ? formatCurrency(m.rule.dailyLimitPaise) : 'N/A'})\n`;
      text += `  - Monthly usage: ${m.monthlyPctUsed}% (${formatCurrency(m.spentThisMonthPaise)} / ${m.rule ? formatCurrency(m.rule.monthlyLimitPaise) : 'N/A'})\n`;

      if (isCollege) {
        text += `  - *Advice:* Keep daily cap at ₹1,500 - ₹2,000 to accommodate textbooks and campus cafeteria expenses without card friction.\n`;
      } else if (isSchool) {
        text += `  - *Advice:* Maintain a ₹500 - ₹800 daily ceiling with single-transaction caps of ₹500 to protect against accidental high-value QR scans.\n`;
      } else {
        text += `  - *Advice:* Review monthly caps every 30 days to align with real spending trends.\n`;
      }
      text += `\n`;
    });

    text += `**3 Practical Savings Rules:**\n` +
      `1. **Cap Single Transactions:** Setting single limits lower than daily limits prevents impulse buys.\n` +
      `2. **Prefer QR Payments for Outings:** QR merchant payments debit directly from the family pool without leaving idle cash in dependent wallets.\n` +
      `3. **Review Ledger Weekly:** Check the **Transactions** tab to spot recurring micro-expenses at cafes and kiosks.`;

    return {
      text,
      metadata: {
        type: 'budget_advice',
        providerName: this.displayName,
        isFallback: this.isFallback,
      },
    };
  }

  // 10. Permissions Inquiry
  private handlePermissionsInquiry(
    entities: ParsedIntent['entities'],
    context: AISpendingContext,
    snapshot: FamilyFinancialSnapshot
  ): AIProviderResponse {
    const target = entities.targetMember;

    if (target && target.role === 'member') {
      const profile = snapshot.members.find((m) => m.member.id === target.id);
      const text = `🔒 **Channel Permissions for ${target.name}**\n\n` +
        `• **Direct Money Transfers:** ${profile?.canTransfer ? '✅ Allowed' : '❌ Disabled by Administrator'}\n` +
        `• **Merchant QR Payments:** ${profile?.canQRPay ? '✅ Allowed' : '❌ Disabled by Administrator'}\n\n` +
        `When disabled, any attempt by ${target.name} to use that payment channel will be automatically rejected by the spending policy engine. Permissions can be changed in **Spending Limits**.`;

      return {
        text,
        metadata: {
          type: 'permissions_inquiry',
          providerName: this.displayName,
          isFallback: this.isFallback,
        },
      };
    }

    let text = `🔒 **Family Permissions Overview**\n\n`;
    snapshot.members.forEach((m) => {
      text += `• **${m.member.name}**: Transfers [${m.canTransfer ? '✅' : '❌'}], QR Merchant [${m.canQRPay ? '✅' : '❌'}]\n`;
    });
    text += `\nOnly the Family Administrator (${snapshot.owner.name}) can toggle these permissions.`;

    return {
      text,
      metadata: {
        type: 'permissions_inquiry_all',
        providerName: this.displayName,
        isFallback: this.isFallback,
      },
    };
  }

  // 11. General Help / How It Works
  private handleHowItWorksHelp(context: AISpendingContext): AIProviderResponse {
    const text = `👋 **How PayPal Family Works**\n\n` +
      `PayPal Family is a modern fintech application that provides safe, guided financial freedom for family dependents:\n\n` +
      `1. **Central Family Pool:** The family administrator (${context.familyMembers.find((m) => m.role === 'owner')?.name}) manages a shared pool of simulated funds (₹10,000).\n` +
      `2. **Spending Controls:** The owner sets single-transaction limits, daily allowances, and monthly caps for each family member.\n` +
      `3. **Money Requests:** Dependents can request money directly into their personal pocket wallets.\n` +
      `4. **Merchant QR Payments:** Dependents can scan QR codes at supported demo merchants (cafes, transit, bookstores) — payments debit straight from the family pool without exceeding member limits.\n` +
      `5. **Strict Safety & Precision:** All money is modeled in **integer paise** (no floating point errors) and simulated play funds.\n\n` +
      `Ask me anything about your balances, member limits, recent transactions, or budget advice!`;

    return {
      text,
      metadata: {
        type: 'how_it_works',
        providerName: this.displayName,
        isFallback: this.isFallback,
      },
    };
  }

  // 12. Clarification Needed / Unknown
  private handleUnknownOrAmbiguous(rawQuery: string, context: AISpendingContext): AIProviderResponse {
    const text = `🤔 **I need a bit more clarification**\n\n` +
      `I am the **PayPal Family Financial Assistant**, specialized in your family's accounts, spending limits, balances, and transactions.\n\n` +
      `I couldn't quite determine what financial information you're looking for regarding: *"${rawQuery}"*.\n\n` +
      `**Here are some questions you can ask me right now:**\n` +
      `• *"How much money is in our family pool?"*\n` +
      `• *"Can Priya afford a ₹1,200 purchase today?"*\n` +
      `• *"What are Aarav's spending limits?"*\n` +
      `• *"Why was my recent transaction declined?"*\n` +
      `• *"Summarize our family spending this month."*\n` +
      `• *"What are our highest spending categories?"*\n` +
      `• *"Who is in our family group?"*`;

    return {
      text,
      metadata: {
        type: 'clarification_needed',
        providerName: this.displayName,
        isFallback: this.isFallback,
        suggestedQueries: [
          'How much money is in our family pool?',
          'Can Priya spend ₹1,200 today?',
          'What are Aarav’s spending limits?',
          'Summarize our spending this month',
          'Why was my transaction declined?',
        ],
      },
    };
  }
}

