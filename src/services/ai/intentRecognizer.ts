import { User } from '../../types';
import { AISpendingContext } from '../aiAssistantService';
import { toPaise } from '../../utils/currency';

export type UserIntent =
  | 'BALANCE_INQUIRY'
  | 'FAMILY_MEMBERS_INQUIRY'
  | 'SPENDING_LIMITS_INQUIRY'
  | 'AFFORDABILITY_CHECK'
  | 'SPENDING_SUMMARY'
  | 'CATEGORY_BREAKDOWN'
  | 'TRANSACTIONS_INQUIRY'
  | 'PAYMENT_FAILURE_EXPLANATION'
  | 'BUDGET_ADVICE_AND_SAVINGS'
  | 'PERMISSIONS_INQUIRY'
  | 'HOW_IT_WORKS_HELP'
  | 'UNKNOWN_OR_AMBIGUOUS';

export interface ExtractedEntities {
  targetMember?: User;
  isSelfReferencing: boolean;
  isFamilyWide: boolean;
  amountPaise?: number;
  actionType?: 'TRANSFER' | 'QR_PAYMENT';
  categoryFilter?: string;
  timeframe?: 'today' | 'month' | 'recent' | 'all';
}

export interface ParsedIntent {
  intent: UserIntent;
  confidence: number;
  entities: ExtractedEntities;
  rawQuery: string;
}

export class IntentRecognizer {
  /**
   * Parses natural language query into intent + structured entities.
   */
  static parse(query: string, context: AISpendingContext): ParsedIntent {
    const raw = query.trim();
    // Clean punctuation like question marks and exclamation marks, while carefully preserving digits, commas, and periods in currency
    const normalized = raw.toLowerCase().replace(/[?!;:]/g, ' ').replace(/\s+/g, ' ');

    const entities = this.extractEntities(normalized, context);
    const intent = this.classifyIntent(normalized, entities);

    return {
      intent,
      confidence: intent === 'UNKNOWN_OR_AMBIGUOUS' ? 0.2 : 0.95,
      entities,
      rawQuery: raw,
    };
  }

  private static extractEntities(text: string, context: AISpendingContext): ExtractedEntities {
    // 1. Detect Self or Family Referencing
    const isSelfReferencing = /\b(my|i|me|mine|myself)\b/.test(text);
    const isFamilyWide = /\b(family|everyone|our|we|all members|total|pool|shared)\b/.test(text);

    // 2. Identify Target Member
    let targetMember: User | undefined;

    for (const member of context.familyMembers) {
      const firstName = member.name.toLowerCase().split(' ')[0];
      const fullName = member.name.toLowerCase();
      const relation = (member.relationship || '').toLowerCase();

      if (text.includes(firstName) || text.includes(fullName)) {
        targetMember = member;
        break;
      }

      if (text.includes('daughter') && relation.includes('daughter')) {
        targetMember = member;
        break;
      }
      if (text.includes('son') && relation.includes('son')) {
        targetMember = member;
        break;
      }
      if (
        (text.includes('father') ||
          text.includes('dad') ||
          text.includes('admin') ||
          text.includes('administrator') ||
          text.includes('owner') ||
          text.includes('head')) &&
        member.role === 'owner'
      ) {
        targetMember = member;
        break;
      }
    }

    if (!targetMember && isSelfReferencing) {
      targetMember = context.currentUser;
    }

    // 3. Extract Amount
    let amountPaise: number | undefined;

    // First check for shorthand like "1.5k" or "2k"
    const kRegex = /\b([0-9]+(?:\.[0-9]+)?)\s*k\b/i;
    const kMatch = text.match(kRegex);
    if (kMatch && kMatch[1]) {
      amountPaise = toPaise(parseFloat(kMatch[1]) * 1000);
    } else {
      // Match patterns with ₹, Rs, INR, or plain numbers following monetary verbs
      const rupeeRegex = /(?:₹|rs\.?|inr)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/i;
      const rupeeAfterRegex = /([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)\s*(?:₹|rs\.?|rupees?|inr)/i;
      const verbNumberRegex = /(?:afford|spend|buy|purchase|pay|transfer|cost|for|of)\s*(?:a\s*)?(?:an\s*)?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/i;

      const m1 = text.match(rupeeRegex);
      const m2 = text.match(rupeeAfterRegex);
      const m3 = text.match(verbNumberRegex);

      const chosenMatch = m1 || m2 || m3;
      if (chosenMatch && chosenMatch[1]) {
        const numStr = chosenMatch[1];
        const parsedNum = parseFloat(numStr.replace(/,/g, ''));
        if (!isNaN(parsedNum) && parsedNum > 0 && parsedNum !== 2026) {
          amountPaise = toPaise(numStr);
        }
      }
    }

    // 4. Action Type
    let actionType: 'TRANSFER' | 'QR_PAYMENT' | undefined;
    if (/\b(qr|qr payment|qr payments|merchant|scan|store|shop|cafe|market|purchase|pos)\b/.test(text)) {
      actionType = 'QR_PAYMENT';
    } else if (/\b(transfer|transfers|request|requests|send|send money|pocket money|cash)\b/.test(text)) {
      actionType = 'TRANSFER';
    }

    // 5. Category
    let categoryFilter: string | undefined;
    if (/\b(cafe|cafes|coffee|food|dining|snack|snacks|restaurant|bakery|lunch)\b/.test(text)) {
      categoryFilter = 'Dining & Snacks';
    } else if (/\b(book|books|bookstore|stationary|study|education|academic)\b/.test(text)) {
      categoryFilter = 'Education & Books';
    } else if (/\b(metro|train|transit|travel|transport|bus)\b/.test(text)) {
      categoryFilter = 'Transportation';
    } else if (/\b(health|pharmacy|medicine|apollo|medical)\b/.test(text)) {
      categoryFilter = 'Healthcare';
    } else if (/\b(tech|gadget|gadgets|electronics|phone|laptop|charger)\b/.test(text)) {
      categoryFilter = 'Electronics';
    }

    // 6. Timeframe
    let timeframe: 'today' | 'month' | 'recent' | 'all' | undefined;
    if (/\b(today|now|currently)\b/.test(text)) timeframe = 'today';
    else if (/\b(month|monthly|this month)\b/.test(text)) timeframe = 'month';
    else if (/\b(recent|latest|last|yesterday|past)\b/.test(text)) timeframe = 'recent';

    return {
      targetMember,
      isSelfReferencing,
      isFamilyWide,
      amountPaise,
      actionType,
      categoryFilter,
      timeframe,
    };
  }

  private static classifyIntent(text: string, entities: ExtractedEntities): UserIntent {
    // 1. Payment Rejection / Failure Explanation
    if (
      /\b(reject(?:ed|ion|s)?|decline[ds]?|fail(?:ed|ure|s)?|blocked|denied|unsuccessful)\b/.test(text) ||
      (/\bwhy\s+(?:did|was|were)\b/.test(text) && /\b(?:payment|transaction|request|transfer|purchase)\b/.test(text))
    ) {
      return 'PAYMENT_FAILURE_EXPLANATION';
    }

    // 2. Budget Advice and Savings (check before limits so "suggest limits" routes here)
    if (
      /\b(suggest(?:ion|ions|ed)?|recommend(?:ation|ations|ed)?|budget(?:ing|s)?|saving|savings|save money|how (?:can (?:we|i|our family)|to) save|spending tips|financial advice|advice)\b/.test(
        text
      ) ||
      /\bhow can (?:we|our family|i) save\b/.test(text)
    ) {
      return 'BUDGET_ADVICE_AND_SAVINGS';
    }

    // 3. Affordability Check (when evaluating if a member can spend a specific amount)
    if (
      entities.amountPaise !== undefined &&
      /\b(can|could|afford|allowed to|eligible to|buy|spend|pay|purchase|transfer)\b/.test(text)
    ) {
      return 'AFFORDABILITY_CHECK';
    }

    // 4. Permissions Inquiry
    if (
      /\b(permission|permissions|enabled|disabled)\b/.test(text) ||
      /\ballowed to\s+(?:make|use|do|pay with|scan)?\s*(?:qr|transfers?|payments?)\b/.test(text) ||
      /\bcan\s+(?:i|priya|aarav|members?|dependents?)\s+(?:make|do|use|perform|pay with)?\s*(?:qr|qr payments?|transfers?|requests?)\b/.test(
        text
      )
    ) {
      return 'PERMISSIONS_INQUIRY';
    }

    // 5. Spending Limits Inquiry
    if (
      /\b(limit|limits|cap|caps|allowance|allowances|daily limit|monthly limit|single limit|single transaction limit|threshold)\b/.test(
        text
      ) ||
      /\bhow much can\s+(?:i|priya|aarav|we|members?)\s+spend\s+(?:per day|daily|per month|monthly)\b/.test(text)
    ) {
      return 'SPENDING_LIMITS_INQUIRY';
    }

    // 6. Balance Inquiry
    if (
      /\b(balance|balances|funds?|how much (?:do i have|money|is left|in the pool|in (?:my|priya'?s?|aarav'?s?|the)? wallet)|pocket money|available funds?|pool balance)\b/.test(
        text
      )
    ) {
      return 'BALANCE_INQUIRY';
    }

    // 7. Category Breakdown
    if (
      /\b(categor(?:y|ies)|highest spending|most spent|where do we spend|breakdown by category|top expense|top expenses)\b/.test(
        text
      )
    ) {
      return 'CATEGORY_BREAKDOWN';
    }

    // 8. Spending Summary
    if (
      /\b(summar(?:y|ize)|spending report|total spend|spent this month|monthly spending|expenditure|how much did (?:we|family) spend|overview of expenses)\b/.test(
        text
      )
    ) {
      return 'SPENDING_SUMMARY';
    }

    // 9. Transactions Inquiry (Audit / History)
    if (
      /\b(transaction|transactions|history|ledger|receipt|receipts|last payment|last purchase|recent purchases?|past payments?|what did (?:i|priya|aarav|we) buy|show records)\b/.test(
        text
      ) ||
      (/\b(show|view|list|find|any)\s+(?:payments?|purchases?)\b/.test(text) && !/\bhow much\b/.test(text)) ||
      (entities.categoryFilter && /\b(payments?|purchases?|transactions?)\b/.test(text))
    ) {
      return 'TRANSACTIONS_INQUIRY';
    }

    // 10. Family Members Inquiry
    if (
      /\b(who is in (?:the|our|this) family|family members?|members of (?:this|our|the) family|how many (?:members|children|kids|dependents)|who is (?:the )?(?:family )?(?:admin(?:istrator)?|owner|head)|show members?|dependents?|directory)\b/.test(
        text
      ) ||
      /\bwho is.*(?:admin(?:istrator)?|owner|head)\b/.test(text) ||
      /\b(list|show|view|who are)\s+(?:all\s+)?members?\b/.test(text)
    ) {
      return 'FAMILY_MEMBERS_INQUIRY';
    }

    // 11. General Help / How It Works
    if (
      /\b(how does (?:this|it|paypal family) work|what is (?:paypal family|this app|simulated money)|explain (?:the )?app|is this real money|how to (?:request money|scan qr|set limits)|rules of paypal family|help|what can you do|features)\b/.test(
        text
      ) ||
      /^(hi|hello|hey|help|greetings)$/.test(text.trim())
    ) {
      return 'HOW_IT_WORKS_HELP';
    }

    return 'UNKNOWN_OR_AMBIGUOUS';
  }
}
