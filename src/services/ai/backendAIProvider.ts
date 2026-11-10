import { IAIProvider, AIProviderResponse } from './aiProviderInterface';
import { AISpendingContext } from '../aiAssistantService';
import { FamilyFinancialSnapshot } from './financialAnalytics';
import { ParsedIntent } from './intentRecognizer';

/**
 * External Backend AI Provider (Google Gemini Integration)
 *
 * Communicates with the secure Node.js Express server (/api/ai/chat) which holds
 * the GEMINI_API_KEY and invokes the official @google/genai SDK.
 *
 * If the backend server is unreachable or GEMINI_API_KEY is not configured,
 * it throws an error causing automatic, seamless fallback to LocalFintechAIProvider.
 */
export class BackendAIProxyProvider implements IAIProvider {
  readonly id = 'backend_ai_proxy';
  readonly displayName = 'Google Gemini AI (gemini-2.5-flash)';
  readonly isFallback = false;

  private endpointUrl: string;

  constructor() {
    this.endpointUrl = (import.meta as any).env?.VITE_AI_BACKEND_URL || '/api/ai';
  }

  isConfigured(): boolean {
    return true; // Attempt backend by default; transparently falls back if server/key is absent
  }

  async processQuery(
    parsed: ParsedIntent,
    context: AISpendingContext,
    snapshot: FamilyFinancialSnapshot
  ): Promise<AIProviderResponse> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(`${this.endpointUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: parsed.rawQuery,
          intent: parsed.intent,
          entities: parsed.entities,
          financialSnapshot: {
            familyName: snapshot.familyName,
            ownerPoolBalancePaise: snapshot.ownerPoolBalancePaise,
            members: snapshot.members.map((m) => ({
              name: m.member.name,
              role: m.member.role,
              relationship: m.member.relationship,
              walletBalancePaise: m.wallet.balancePaise,
              spentTodayPaise: m.spentTodayPaise,
              spentThisMonthPaise: m.spentThisMonthPaise,
              dailyLimitPaise: m.rule?.dailyLimitPaise,
              monthlyLimitPaise: m.rule?.monthlyLimitPaise,
              singleTransactionLimitPaise: m.rule?.singleTransactionLimitPaise,
            })),
            recentTransactions: snapshot.recentTransactions.slice(0, 5),
            recentRejectedTransaction: snapshot.recentRejectedTransaction,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Backend AI returned status ${response.status}`);
      }

      const data = await response.json();

      if (!data.success && data.fallbackToLocal) {
        throw new Error(data.error || 'Backend indicated fallback.');
      }

      return {
        text: data.reply || data.text,
        metadata: {
          type: parsed.intent.toLowerCase(),
          providerName: data.provider || this.displayName,
          isFallback: false,
          data: data.metadata,
        },
      };
    } catch (err: any) {
      throw new Error(`Failed to contact Cloud AI Gateway: ${err.message}`);
    }
  }
}
