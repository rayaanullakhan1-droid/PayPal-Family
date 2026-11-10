import { User, Wallet, SpendingRule, Transaction, AssistantMessage } from '../types';
import { FinancialAnalytics, FamilyFinancialSnapshot } from './ai/financialAnalytics';
import { IntentRecognizer, ParsedIntent } from './ai/intentRecognizer';
import { IAIProvider, AIProviderResponse } from './ai/aiProviderInterface';
import { LocalFintechAIProvider } from './ai/localAIProvider';
import { BackendAIProxyProvider } from './ai/backendAIProvider';

export interface AISpendingContext {
  currentUser: User;
  familyMembers: User[];
  ownerWallet: Wallet;
  memberPersonalAccounts?: Record<string, Wallet>;
  memberWallets?: Record<string, Wallet>;
  spendingRules: Record<string, SpendingRule>;
  transactions: Transaction[];
}

export interface PresetPrompt {
  id: string;
  label: string;
  query: string;
}

export const PRESET_PROMPTS: PresetPrompt[] = [
  {
    id: 'monthly_summary',
    label: '📊 Monthly Spending Summary',
    query: 'Summarize our family spending this month.',
  },
  {
    id: 'member_affordability',
    label: '💳 Can Priya spend ₹1,200 today?',
    query: 'Can Priya afford a ₹1,200 purchase right now?',
  },
  {
    id: 'aarav_limits',
    label: '🛡️ Aarav’s spending limits',
    query: 'What are Aarav’s daily and monthly spending limits?',
  },
  {
    id: 'pool_balance',
    label: '🏦 Family pool balance',
    query: 'How much money is left in our family pool?',
  },
  {
    id: 'budget_suggestion',
    label: '💡 Budget suggestions & savings',
    query: 'Suggest reasonable spending limits and budget tips for our family.',
  },
  {
    id: 'rejection_explanation',
    label: '❓ Why was a payment declined?',
    query: 'Explain why my recent transaction was rejected.',
  },
  {
    id: 'category_breakdown',
    label: '🛍️ Top spending categories',
    query: 'What are our family’s highest spending categories?',
  },
];

export class AISpendingAssistantService {
  private localProvider: IAIProvider;
  private backendProvider: BackendAIProxyProvider;

  constructor() {
    this.localProvider = new LocalFintechAIProvider();
    this.backendProvider = new BackendAIProxyProvider();
  }

  /**
   * Generates a context-aware response using natural language intent recognition,
   * grounded live financial analytics, and pluggable AI providers.
   *
   * SECURITY & GOVERNANCE:
   * - Strictly READ-ONLY: Never initiates payments, never mutates limits, never debits wallets.
   * - No secret keys exposed on the frontend.
   * - Gracefully falls back to the local semantic engine if no backend AI API is configured.
   */
  async generateResponse(query: string, context: AISpendingContext): Promise<AssistantMessage> {
    const trimmed = query.trim();
    if (!trimmed) {
      return {
        id: `msg_${Date.now()}`,
        sender: 'assistant',
        text: 'Please enter a question about your family finances, balances, limits, or transactions.',
        timestamp: new Date().toISOString(),
      };
    }

    // Micro delay to simulate thought and smooth UX transition
    await new Promise((resolve) => setTimeout(resolve, 300));

    // 1. Compute exact mathematical snapshot of current state
    const snapshot: FamilyFinancialSnapshot = FinancialAnalytics.getSnapshot(context);

    // 2. Parse natural language query (intent + entities + amounts)
    const parsed: ParsedIntent = IntentRecognizer.parse(trimmed, context);

    let providerResponse: AIProviderResponse;

    // 3. Try backend provider if configured, else use local provider
    if (this.backendProvider.isConfigured()) {
      try {
        providerResponse = await this.backendProvider.processQuery(parsed, context, snapshot);
      } catch {
        // Transparent fallback to local engine
        providerResponse = await this.localProvider.processQuery(parsed, context, snapshot);
      }
    } else {
      providerResponse = await this.localProvider.processQuery(parsed, context, snapshot);
    }

    return {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sender: 'assistant',
      text: providerResponse.text,
      timestamp: new Date().toISOString(),
      metadata: {
        type: (providerResponse.metadata?.type as any) || 'general',
        data: providerResponse.metadata?.data,
        suggestedQueries: providerResponse.metadata?.suggestedQueries,
        providerName: providerResponse.metadata?.providerName,
      },
    };
  }

  /**
   * Expose snapshot calculation for external inspection/testing.
   */
  getSnapshot(context: AISpendingContext): FamilyFinancialSnapshot {
    return FinancialAnalytics.getSnapshot(context);
  }

  /**
   * Expose intent parsing for external inspection/testing.
   */
  parseIntent(query: string, context: AISpendingContext): ParsedIntent {
    return IntentRecognizer.parse(query, context);
  }
}

export const aiAssistantService = new AISpendingAssistantService();
