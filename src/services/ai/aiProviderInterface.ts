import { AISpendingContext } from '../aiAssistantService';
import { FinancialAnalytics, FamilyFinancialSnapshot } from './financialAnalytics';
import { ParsedIntent } from './intentRecognizer';

export interface AIProviderResponse {
  text: string;
  metadata?: {
    type?: string;
    data?: any;
    providerName: string;
    isFallback: boolean;
    suggestedQueries?: string[];
  };
}

export interface IAIProvider {
  readonly id: string;
  readonly displayName: string;
  readonly isFallback: boolean;

  /**
   * Generates a grounded response based on parsed intent, live snapshot, and user query.
   * Guaranteed to be strictly READ-ONLY.
   */
  processQuery(
    parsed: ParsedIntent,
    context: AISpendingContext,
    snapshot: FamilyFinancialSnapshot
  ): Promise<AIProviderResponse>;
}

