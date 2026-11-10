import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Bot,
  Send,
  Sparkles,
  ShieldAlert,
  Info,
  Clock,
  UserCheck,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  aiAssistantService,
  PRESET_PROMPTS,
} from '../services/aiAssistantService';
import { AssistantMessage } from '../types';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';

export const AIAssistantPage: React.FC = () => {
  const {
    currentUser,
    familyMembers,
    ownerWallet,
    memberPersonalAccounts,
    spendingRules,
    transactions,
    isCustomUser,
  } = useApp();

  const [searchParams] = useSearchParams();
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: 'msg_welcome',
      sender: 'assistant',
      text: `👋 Hello ${currentUser.name.split(' ')[0]}! I am the **PayPal Family Financial Insights Assistant**.\n\nI can analyze your family's ${isCustomUser ? 'live spending' : 'live demo spending'}, verify whether an upcoming purchase is eligible under current daily/monthly caps, explain why past transactions were declined, or suggest budgets.\n\nChoose an inquiry below or ask your own question!`,
      timestamp: new Date().toISOString(),
    },
  ]);

  const [inputQuery, setInputQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    const qParam = searchParams.get('q');
    if (qParam && qParam.trim()) {
      handleSendMessage(qParam.trim());
    }
  }, [searchParams]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputQuery).trim();
    if (!query || isTyping) return;

    const userMessage: AssistantMessage = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!textToSend) setInputQuery('');
    setIsTyping(true);

    try {
      const response = await aiAssistantService.generateResponse(query, {
        currentUser,
        familyMembers,
        ownerWallet,
        memberPersonalAccounts,
        spendingRules,
        transactions,
      });

      setMessages((prev) => [...prev, response]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          sender: 'assistant',
          text: 'Sorry, I encountered an issue analyzing the financial context. Please try again.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto flex flex-col h-[calc(100vh-140px)]">
      {/* Title */}
      <div className="pb-2 border-b border-fintech-border/70 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-fintech-primary text-white flex items-center justify-center shadow-sm">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-fintech-navy">
                AI Spending Assistant
              </h1>
              <p className="text-xs text-fintech-muted">
                Natural language financial intelligence grounded in live family ledger
              </p>
            </div>
          </div>
          <Badge variant="primary">Smart AI Financial Engine</Badge>
        </div>
      </div>

      {/* Safety Notice regarding AI financial limitations */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-fintech-navy shrink-0 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-fintech-primary shrink-0 mt-0.5" />
        <div className="text-[11px] leading-relaxed">
          <strong>Fintech Safety Boundary:</strong> This assistant provides read-only budgeting analysis. Per fintech governance principles, AI cannot execute transfers, alter balances, or bypass spending limits. All payments are independently verified by the rules engine.
        </div>
      </div>

      {/* Suggested Quick Prompts */}
      <div className="shrink-0 flex items-center gap-2 overflow-x-auto pb-1">
        <span className="text-[11px] font-semibold text-fintech-muted uppercase tracking-wider shrink-0">
          Suggested:
        </span>
        {PRESET_PROMPTS.map((prompt) => (
          <button
            key={prompt.id}
            onClick={() => handleSendMessage(prompt.query)}
            disabled={isTyping}
            className="shrink-0 text-xs px-3 py-1.5 rounded-full bg-white border border-fintech-border hover:border-fintech-primary hover:text-fintech-primary transition-colors font-medium shadow-xs"
          >
            {prompt.label}
          </button>
        ))}
      </div>

      {/* Chat Messages Container */}
      <Card className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/50">
        {messages.map((msg) => {
          const isAssistant = msg.sender === 'assistant';
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${
                isAssistant ? 'justify-start' : 'justify-end'
              }`}
            >
              {isAssistant && (
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 mt-1">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed shadow-xs whitespace-pre-line ${
                  isAssistant
                    ? 'bg-white text-fintech-text border border-fintech-border'
                    : 'bg-fintech-primary text-white rounded-tr-none'
                }`}
              >
                {isAssistant && msg.metadata?.providerName && (
                  <div className="mb-2.5 pb-2 border-b border-slate-100 flex items-center justify-between gap-2">
                    {msg.metadata.providerName.includes('Gemini') ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 border border-indigo-200 text-indigo-700">
                        <Sparkles className="w-3 h-3 text-indigo-600" />
                        Powered by Google Gemini AI
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 border border-slate-200 text-slate-600">
                        <ShieldAlert className="w-3 h-3 text-slate-500" />
                        Local Intelligence Engine (Fallback Mode)
                      </span>
                    )}
                  </div>
                )}
                {msg.text}
                {isAssistant && msg.metadata?.suggestedQueries && msg.metadata.suggestedQueries.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap gap-1.5">
                    {msg.metadata.suggestedQueries.map((query, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSendMessage(query)}
                        className="text-[11px] font-medium text-fintech-primary bg-blue-50/80 hover:bg-blue-100 border border-blue-200/60 rounded-full px-2.5 py-1 text-left transition-colors"
                      >
                        {query}
                      </button>
                    ))}
                  </div>
                )}
                <div
                  className={`text-[10px] mt-2 ${
                    isAssistant ? 'text-slate-400' : 'text-blue-100'
                  } text-right`}
                >
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>

              {!isAssistant && (
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.name}
                  className="w-8 h-8 rounded-full object-cover shrink-0 mt-1 ring-1 ring-slate-200"
                />
              )}
            </div>
          );
        })}

        {isTyping && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-white border border-fintech-border rounded-2xl px-4 py-3 text-xs text-fintech-muted flex items-center gap-2 shadow-xs">
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.4s]" />
              </span>
              <span>Analyzing family spending rules and transactions...</span>
            </div>
          </div>
        )}
      </Card>

      {/* Input Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="shrink-0 flex items-center gap-2 pt-1"
      >
        <input
          type="text"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          placeholder="Ask anything about family limits, recent transactions, or budget tips..."
          disabled={isTyping}
          className="flex-1 px-4 py-3 rounded-full border border-fintech-border text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-fintech-primary shadow-xs bg-white"
        />
        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={!inputQuery.trim() || isTyping}
          className="rounded-full px-5"
          icon={<Send className="w-4 h-4" />}
        >
          Ask
        </Button>
      </form>
    </div>
  );
};

