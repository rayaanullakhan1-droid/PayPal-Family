import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  Wallet,
  HandCoins,
  QrCode,
  Sliders,
  Users,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldCheck,
  TrendingUp,
  AlertCircle,
  Clock,
  Sparkles,
  ChevronRight,
  PlusCircle,
  Send,
  Landmark,
  Smartphone,
  Lock,
  History,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useI18n } from '../context/I18nContext';
import { formatCurrency } from '../utils/currency';
import { formatDateTime } from '../utils/dates';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { TransactionReceiptModal } from '../components/common/TransactionReceiptModal';
import { AddMoneyModal } from '../components/common/AddMoneyModal';
import { SendMoneyModal } from '../components/common/SendMoneyModal';
import { SpendMoneyModal } from '../components/common/SpendMoneyModal';
import { ToMobileModal } from '../components/common/ToMobileModal';
import { CheckBalanceModal } from '../components/common/CheckBalanceModal';
import { RequestExtraMoneyModal } from '../components/common/RequestExtraMoneyModal';
import { FintechTransactionModal } from '../components/fintech/FintechTransactionModal';
import { Transaction, MoneyRequest } from '../types';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    currentUser,
    family,
    familyMembers,
    ownerWallet,
    memberPersonalAccounts,
    spendingRules,
    transactions,
    moneyRequests,
    pendingMembershipRequests,
    familyJoiningCode,
    approveMoneyRequest,
    rejectMoneyRequest,
    getMemberSpending,
    getMemberConsumption,
    isCustomUser,
  } = useApp();
  const { t } = useI18n();

  const [selectedReceiptTxn, setSelectedReceiptTxn] = useState<Transaction | null>(null);
  const [isToMobileOpen, setIsToMobileOpen] = useState(false);
  const [isCheckBalanceOpen, setIsCheckBalanceOpen] = useState(false);
  const [isAddMoneyOpen, setIsAddMoneyOpen] = useState(false);
  const [isSendMoneyOpen, setIsSendMoneyOpen] = useState(false);
  const [isSpendMoneyOpen, setIsSpendMoneyOpen] = useState(false);
  const [sendMoneyInitialMemberId, setSendMoneyInitialMemberId] = useState<string | undefined>();
  const [requestActionMsg, setRequestActionMsg] = useState<string | null>(null);
  const [isRequestExtraMoneyOpen, setIsRequestExtraMoneyOpen] = useState(false);

  // Premium fintech animation modal state
  const [animModal, setAnimModal] = useState<{
    isOpen: boolean;
    isProcessing: boolean;
    isSuccess: boolean;
    flowType: 'send_money' | 'receive_money';
    amountPaise: number;
    senderName: string;
    recipientName: string;
    failureReason?: string;
    transaction?: Transaction | null;
  }>({
    isOpen: false,
    isProcessing: false,
    isSuccess: false,
    flowType: 'send_money',
    amountPaise: 0,
    senderName: '',
    recipientName: '',
  });

  useEffect(() => {
    const animParam = searchParams.get('anim');
    if (animParam === 'success') {
      setAnimModal({
        isOpen: true,
        isProcessing: false,
        isSuccess: true,
        flowType: 'send_money',
        amountPaise: 250000,
        senderName: 'Rajesh Sharma',
        recipientName: 'Priya Sharma',
        transaction: {
          id: 'tx_demo_anim_success',
          reference: 'TXN-20261101-SUCC1',
          familyId: 'fam_sharma_01',
          type: 'TRANSFER',
          status: 'COMPLETED',
          amountPaise: 250000,
          currency: 'INR',
          initiatorId: 'usr_owner_rajesh',
          payerId: 'usr_owner_rajesh',
          senderId: 'usr_owner_rajesh',
          senderName: 'Rajesh Sharma',
          recipientId: 'usr_member_priya',
          recipientName: 'Priya Sharma',
          paymentSource: 'ADMIN_ACCOUNT',
          date: new Date().toISOString(),
          note: 'College semester allowance',
          isSimulated: true,
        },
      });
    } else if (animParam === 'failure') {
      setAnimModal({
        isOpen: true,
        isProcessing: false,
        isSuccess: false,
        failureReason: 'Daily family spending limit of ₹800 exceeded. Please request limit approval from Rajesh Sharma.',
        flowType: 'send_money',
        amountPaise: 120000,
        senderName: 'Rajesh Sharma',
        recipientName: 'Aarav Sharma',
      });
    }
  }, [searchParams]);

  const isOwner = currentUser.role === 'owner';

  // Synchronized member metrics from single source of truth
  const memberPersonalAccount = memberPersonalAccounts[currentUser.id] || { balancePaise: 0 };
  const consumption = getMemberConsumption(currentUser.id);

  const pendingRequests = (moneyRequests || []).filter((r: MoneyRequest) => r.status === 'PENDING');

  const handleApprove = async (requestId: string) => {
    setRequestActionMsg(null);
    const targetReq = pendingRequests.find((r) => r.id === requestId);
    const res = await approveMoneyRequest(requestId);
    if (res.success && res.transaction) {
      setAnimModal({
        isOpen: true,
        isProcessing: false,
        isSuccess: true,
        flowType: 'send_money',
        amountPaise: res.transaction.amountPaise,
        senderName: 'Administrator',
        recipientName: targetReq?.memberName || 'Member',
        transaction: res.transaction,
      });
      setRequestActionMsg('Money request approved! Funds transferred to member personal account.');
    } else {
      alert(res.error || 'Failed to approve request.');
    }
  };

  const handleReject = async (requestId: string) => {
    setRequestActionMsg(null);
    const res = await rejectMoneyRequest(requestId);
    if (res.success) {
      setRequestActionMsg('Money request rejected.');
    }
  };

  // Transactions to show (already privacy-scoped in AppContext)
  const displayTransactions = transactions.slice(0, 5);

  const totalFamilySpentPaise = useMemo(() => {
    return transactions
      .filter((t) => t.status === 'COMPLETED')
      .reduce((acc, t) => acc + t.amountPaise, 0);
  }, [transactions]);

  // Dynamic AI Spend Insights calculation
  const aiInsight = useMemo(() => {
    if (isOwner) {
      const dependents = familyMembers.filter((m) => m.role === 'member');
      const overLimitDependents = dependents.filter((m) => {
        const c = getMemberConsumption(m.id);
        return c.isDailyExceeded || c.isMonthlyExceeded || c.isDailyBlockedByMonthly;
      });

      if (pendingRequests.length > 0) {
        return {
          title: `${pendingRequests.length} Pending Approval(s)`,
          badge: 'Action Required',
          badgeVariant: 'warning' as const,
          text: `You have ${pendingRequests.length} pending family money request(s) awaiting your review. Administrator Account has funds available to fulfill approved requests.`,
          prompts: [
            'Summarize our family spending this month.',
            'How can I adjust family spending limits?',
            'Suggest reasonable spending limits and budget tips for our family.',
          ],
        };
      }

      if (overLimitDependents.length > 0) {
        const depNames = overLimitDependents.map((d) => d.name.split(' ')[0]).join(', ');
        return {
          title: 'Limit Alert Detected',
          badge: 'Spending Cap',
          badgeVariant: 'warning' as const,
          text: `${depNames} reached configured spending limits. Review spending rules or limit exceptions to ensure smooth family allowances.`,
          prompts: [
            'What are our family’s highest spending categories?',
            'Suggest reasonable spending limits and budget tips for our family.',
            'Summarize our family spending this month.',
          ],
        };
      }

      return {
        title: 'Family Spending Healthy',
        badge: 'Optimal',
        badgeVariant: 'success' as const,
        text: `All family dependents are operating within limits. Family monthly spending is tracked and on schedule.`,
        prompts: [
          'Summarize our family spending this month.',
          'What are our family’s highest spending categories?',
          'How can I adjust family spending limits?',
        ],
      };
    } else {
      // Member-specific AI Insights
      if (consumption.isDailyBlockedByMonthly) {
        return {
          title: 'Monthly Budget Limit Reached',
          badge: 'Spending Paused',
          badgeVariant: 'error' as const,
          text: `Transactions are currently restricted because the family monthly budget of ${formatCurrency(consumption.configuredMonthlyLimitPaise)} has been reached. Contact Administrator ${familyMembers.find((m) => m.role === 'owner')?.name || 'Family Administrator'} for a limit adjustment.`,
          prompts: [
            'Explain why my recent transaction was rejected.',
            'What are my daily and monthly spending limits?',
            'Can I afford a ₹1,200 purchase right now?',
          ],
        };
      }

      if (consumption.isDailyExceeded) {
        return {
          title: 'Daily Allowance Reached',
          badge: 'Approval Needed',
          badgeVariant: 'error' as const,
          text: `You have spent ${formatCurrency(consumption.spentTodayPaise)}, reaching your daily limit of ${formatCurrency(consumption.configuredDailyLimitPaise)}. Submit an exception request to proceed with further spending.`,
          prompts: [
            'Explain why my recent transaction was rejected.',
            'What are my daily and monthly spending limits?',
            'Can I afford a ₹1,200 purchase right now?',
          ],
        };
      }

      if (consumption.dailyPct >= 75) {
        return {
          title: 'Daily Allowance High',
          badge: 'Approaching Limit',
          badgeVariant: 'warning' as const,
          text: `You have used ${consumption.dailyPct}% of today's allowance (${formatCurrency(consumption.spentTodayPaise)}). You have ${formatCurrency(consumption.remainingTodayPaise)} remaining for today.`,
          prompts: [
            'Can I afford a ₹1,200 purchase right now?',
            'What are my daily and monthly spending limits?',
            'Summarize our family spending this month.',
          ],
        };
      }

      return {
        title: 'Spending On Track',
        badge: 'Safe to Spend',
        badgeVariant: 'success' as const,
        text: `You have ${formatCurrency(consumption.remainingTodayPaise)} remaining on today's allowance. Monthly budget is ${consumption.monthlyPct}% utilized with ${formatCurrency(consumption.remainingThisMonthPaise)} available.`,
        prompts: [
          'Can I afford a ₹1,200 purchase right now?',
          'What are my daily and monthly spending limits?',
          'What are our family’s highest spending categories?',
        ],
      };
    }
  }, [isOwner, transactions, familyMembers, pendingRequests, ownerWallet.balancePaise, consumption, totalFamilySpentPaise]);

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-fintech-border/70">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-fintech-navy tracking-tight">
            Hello, {currentUser.name.split(' ')[0]}
          </h1>
          <p className="text-xs sm:text-sm text-fintech-muted mt-0.5">
            {isOwner
              ? `Family Administrator of ${family.name} • Full financial oversight`
              : `${currentUser.relationship} • Authorized family spending account`}
          </p>
        </div>
        {isOwner && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAddMoneyOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              Add Money
            </button>
            <button
              type="button"
              onClick={() => setIsSpendMoneyOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-fintech-primary hover:bg-fintech-secondary text-white font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
            >
              <Send className="w-4 h-4" />
              Spend Money
            </button>
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* OVERVIEW CORE ACTIONS: EXACTLY THREE FUNCTIONAL OPTIONS              */}
      {/* 1. To Mobile Number  |  2. Check Balance  |  3. History              */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* 1. To Mobile Number */}
        <button
          type="button"
          onClick={() => setIsToMobileOpen(true)}
          className="group relative p-5 bg-white dark:bg-slate-900 rounded-2xl border border-fintech-border dark:border-slate-800 shadow-xs hover:border-fintech-primary/50 hover:shadow-md transition-all text-left flex items-start gap-4 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-fintech-primary/30"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-fintech-primary flex items-center justify-center shrink-0 group-hover:bg-fintech-primary group-hover:text-white transition-colors shadow-xs">
            <Smartphone className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-fintech-navy dark:text-slate-100 group-hover:text-fintech-primary transition-colors">
                To Mobile Number
              </h3>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-fintech-primary transition-colors" />
            </div>
            <p className="text-xs text-fintech-muted mt-1 leading-snug">
              Send money directly to any mobile contact or family member with 6-digit PIN security
            </p>
          </div>
        </button>

        {/* 2. Check Balance */}
        <button
          type="button"
          onClick={() => setIsCheckBalanceOpen(true)}
          className="group relative p-5 bg-white dark:bg-slate-900 rounded-2xl border border-fintech-border dark:border-slate-800 shadow-xs hover:border-fintech-primary/50 hover:shadow-md transition-all text-left flex items-start gap-4 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-fintech-primary/30"
        >
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors shadow-xs">
            <Lock className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-fintech-navy dark:text-slate-100 group-hover:text-indigo-600 transition-colors">
                Check Balance
              </h3>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
            </div>
            <p className="text-xs text-fintech-muted mt-1 leading-snug">
              Verify 6-digit transaction PIN to view authenticated account balance
            </p>
          </div>
        </button>

        {/* 3. History */}
        <button
          type="button"
          onClick={() => navigate('/transactions')}
          className="group relative p-5 bg-white dark:bg-slate-900 rounded-2xl border border-fintech-border dark:border-slate-800 shadow-xs hover:border-fintech-primary/50 hover:shadow-md transition-all text-left flex items-start gap-4 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-fintech-primary/30"
        >
          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0 group-hover:bg-fintech-navy group-hover:text-white transition-colors shadow-xs">
            <History className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-fintech-navy dark:text-slate-100 group-hover:text-fintech-primary transition-colors">
                History
              </h3>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-fintech-primary transition-colors" />
            </div>
            <p className="text-xs text-fintech-muted mt-1 leading-snug">
              Open existing transaction history with receipts, ledger audit and filters
            </p>
          </div>
        </button>
      </div>

      {/* Pending Membership Requests Notification for Administrator */}
      {isOwner && pendingMembershipRequests && pendingMembershipRequests.length > 0 && (
        <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl flex items-center justify-between text-xs text-amber-900 shadow-xs">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
            </span>
            <span>
              You have <strong>{pendingMembershipRequests.length} pending membership request(s)</strong> waiting for approval in {family.name}.
            </span>
          </div>
        </div>
      )}

      {/* Primary Financial Overview Cards */}
      {isOwner ? (
        // OWNER VIEW: Family AI Spend Intelligence & Pending Requests (Today's Allowance & Monthly Budget appear exclusively in Member accounts)
        <div className="space-y-6">
          {/* Family AI Spending Insight Widget (Admin) */}
          <Card className="bg-blue-50/50 border-blue-200/80 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-blue-200/60">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-fintech-primary flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-fintech-navy">Family AI Spend Intelligence</h3>
                  <p className="text-[11px] text-fintech-muted">Real-time financial analysis across all family dependent spending</p>
                </div>
              </div>
              <Badge variant={aiInsight.badgeVariant} size="sm">
                {aiInsight.badge}
              </Badge>
            </div>

            <div className="mt-3 space-y-3">
              <p className="text-xs text-fintech-navy font-medium leading-relaxed">
                {aiInsight.text}
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[11px] font-semibold text-fintech-muted">Quick inquiries:</span>
                {aiInsight.prompts.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => navigate(`/ai-assistant?q=${encodeURIComponent(p)}`)}
                    className="text-[11px] bg-white border border-blue-200 hover:border-fintech-primary text-fintech-navy hover:text-fintech-primary px-3 py-1 rounded-full transition-all cursor-pointer shadow-2xs flex items-center gap-1"
                  >
                    <span>💬</span> {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-blue-200/60 flex items-center justify-between text-xs font-semibold text-fintech-primary">
              <Link to="/ai-assistant" className="hover:underline flex items-center gap-1">
                Ask Spending Assistant <ChevronRight className="w-3.5 h-3.5" />
              </Link>
              <span className="text-[11px] text-fintech-muted font-normal">Single source of truth accounting</span>
            </div>
          </Card>

          {/* Pending Money Requests (Owner View) */}
          {pendingRequests.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/40 p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-amber-200/80 mb-4 gap-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-600" />
                  <h2 className="text-base font-bold text-fintech-navy">
                    Pending Family Money Requests
                  </h2>
                  <Badge variant="warning" size="sm">
                    {pendingRequests.length} pending
                  </Badge>
                </div>
                <span className="text-xs text-amber-800 font-medium">
                  Approvals deduct directly from Administrator Account to Member's Personal Account
                </span>
              </div>

              {requestActionMsg && (
                <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{requestActionMsg}</span>
                </div>
              )}

              <div className="space-y-3">
                {pendingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 bg-white rounded-xl border border-amber-200/70 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3">
                      <img
                        src={req.memberAvatar || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150'}
                        alt={req.memberName}
                        className="w-10 h-10 rounded-full object-cover ring-2 ring-amber-100"
                      />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-fintech-navy">{req.memberName}</span>
                          {req.isExtraMoneyRequest ? (
                            <Badge variant="primary" size="sm" className="bg-blue-100 text-blue-900 border-blue-300">
                              Extra Money Request
                            </Badge>
                          ) : req.isException ? (
                            <Badge variant="warning" size="sm" className="bg-amber-100 text-amber-900 border-amber-300">
                              Limit Exception Request
                            </Badge>
                          ) : (
                            <Badge variant="primary" size="sm" className="bg-blue-50 text-blue-800 border-blue-200">
                              Money Request
                            </Badge>
                          )}
                          <span className="text-xs text-fintech-muted">• {formatDateTime(req.createdAt)}</span>
                        </div>
                        <p className="text-xs text-slate-700 mt-0.5">
                          <strong className="text-fintech-navy">Member's Message:</strong> "{req.message || req.purpose}"
                        </p>
                        <div className="text-[11px] text-amber-800 mt-1 flex flex-wrap items-center gap-2">
                          <span>Requested: <strong className="text-fintech-navy">{formatCurrency(req.amountPaise)}</strong></span>
                          {req.isException && req.configuredLimitPaise && (
                            <>
                              <span>•</span>
                              <span>Configured Limit: <strong>{formatCurrency(req.configuredLimitPaise)}</strong></span>
                              <span>•</span>
                              <span className="text-red-700 font-bold">Excess: +{formatCurrency(req.excessAmountPaise || (req.amountPaise - req.configuredLimitPaise))}</span>
                            </>
                          )}
                          <span>•</span>
                          <span>
                            Status:{' '}
                            <strong className={ownerWallet.balancePaise >= req.amountPaise ? 'text-emerald-700' : 'text-amber-600'}>
                              {ownerWallet.balancePaise >= req.amountPaise ? 'Sufficient Admin Funds' : 'Admin Balance Inadequate'}
                            </strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:bg-red-50 hover:border-red-300"
                        onClick={() => handleReject(req.id)}
                      >
                        Reject
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => handleApprove(req.id)}
                      >
                        Approve & Transfer
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      ) : (
        // MEMBER VIEW: Single Personal Account Balance, Daily Allowance, Monthly Budget & AI Insights
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Main Personal Account Balance Card */}
            <Card className="bg-gradient-to-br from-fintech-deep to-fintech-navy text-white border-0 shadow-lg relative overflow-hidden flex flex-col justify-between">
              <div className="relative z-10">
                <div className="flex items-center justify-between text-xs text-blue-200 mb-2">
                  <span className="font-semibold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5 text-blue-300" />
                    Personal Account Balance
                  </span>
                  {!isCustomUser && (
                    <Badge variant="simulated" size="sm" className="bg-white/10 text-white border-white/20">
                      Simulated
                    </Badge>
                  )}
                </div>
                <div className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">
                  {formatCurrency(memberPersonalAccount.balancePaise)}
                </div>
                <p className="text-xs text-blue-100/80 leading-relaxed">
                  Your individual funds received from approved money requests or Administrator direct transfers. Used for your payments.
                </p>

                {/* Card Action */}
                <div className="mt-4 flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsCheckBalanceOpen(true)}
                    className="px-3.5 py-1.5 rounded-lg bg-white/15 text-white hover:bg-white/25 border border-white/20 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5 text-blue-200" />
                    Verify & Check Balance
                  </button>
                </div>

                {/* Configured Spending Limits Info */}
                <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-blue-100">
                  <span>Daily Spending Allowance: <strong className="text-white font-bold">{formatCurrency(consumption.configuredDailyLimitPaise)}</strong></span>
                  <span className="text-[11px] text-blue-200 bg-white/10 px-2 py-0.5 rounded">Auto-transfers within limit</span>
                </div>
              </div>
              <div className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
            </Card>

            {/* Daily Allowance Progress */}
            <Card>
              <div className="flex items-center justify-between text-xs text-fintech-muted mb-2">
                <span className="font-semibold uppercase tracking-wider text-[11px]">
                  {t('dash.todaysAllowance', "Today's Allowance")}
                </span>
                {consumption.isDailyBlockedByMonthly && consumption.isDailyExceeded ? (
                  <span className="text-[10px] font-bold text-red-600 bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded border border-red-200 dark:border-red-800">
                    {t('dash.dailyExceeded', 'DAILY EXCEEDED')} & {t('dash.monthlyExceeded', 'MONTHLY EXCEEDED')}
                  </span>
                ) : consumption.isDailyBlockedByMonthly ? (
                  <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-800">
                    {t('dash.todayBlocked', "TODAY'S ALLOWANCE BLOCKED")}
                  </span>
                ) : consumption.isDailyExceeded ? (
                  <span className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded border border-red-200 dark:border-red-800">
                    {t('dash.dailyExceeded', 'DAILY ALLOWANCE EXCEEDED')}
                  </span>
                ) : (
                  <span className="text-xs font-medium text-fintech-navy">
                    {consumption.dailyPct}% {t('dash.used', 'used')}
                  </span>
                )}
              </div>
              <div className="text-2xl font-bold text-fintech-navy">
                {formatCurrency(consumption.spentTodayPaise)}
                <span className="text-sm font-normal text-fintech-muted"> / {formatCurrency(consumption.configuredDailyLimitPaise)}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 mt-3 overflow-hidden">
                <div
                  className={`h-2.5 rounded-full transition-all duration-300 ${consumption.isDailyExceeded || consumption.isDailyBlockedByMonthly
                      ? 'bg-fintech-error'
                      : consumption.dailyPct > 85
                        ? 'bg-fintech-error'
                        : consumption.dailyPct > 60
                          ? 'bg-fintech-warning'
                          : 'bg-fintech-primary'
                    }`}
                  style={{ width: `${Math.min(100, consumption.dailyPct)}%` }}
                />
              </div>
              <div className="mt-3 text-xs text-fintech-muted flex items-center justify-between">
                <span>{t('dash.remainingToday', 'Remaining today:')}</span>
                <span className={`font-semibold ${consumption.isDailyBlockedByMonthly || consumption.isDailyExceeded ? 'text-red-600 dark:text-red-400' : 'text-fintech-text'}`}>
                  {consumption.isDailyBlockedByMonthly
                    ? `${formatCurrency(0)} (${t('dash.todayBlocked', 'Blocked')})`
                    : formatCurrency(consumption.remainingTodayPaise)}
                </span>
              </div>
              {consumption.isDailyBlockedByMonthly ? (
                <div className="mt-2.5 pt-2 border-t border-amber-200/60 dark:border-amber-900/40 text-[11px] text-amber-800 dark:text-amber-300 leading-snug">
                  {t('dash.monthlyBlockedDesc', "Transactions blocked: family monthly budget is exceeded, halting today's spending.")}
                </div>
              ) : consumption.isDailyExceeded ? (
                <div className="mt-2.5 pt-2 border-t border-red-200/60 dark:border-red-900/40 text-[11px] text-red-700 dark:text-red-400 leading-snug">
                  {t('dash.dailyExceededDesc', 'Daily limit reached. Further spending requires approval.')}
                </div>
              ) : null}

              {(consumption.isDailyBlockedByMonthly || consumption.isDailyExceeded) && (
                <div className="mt-2 pt-2 border-t border-amber-200/80 flex items-center justify-between">
                  <span className="text-[11px] text-amber-900 font-medium">Allowance exhausted?</span>
                  <button
                    type="button"
                    onClick={() => setIsRequestExtraMoneyOpen(true)}
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] rounded transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <HandCoins className="w-3 h-3" />
                    Request Extra Money
                  </button>
                </div>
              )}
            </Card>

            {/* Monthly Budget Progress */}
            <Card>
              <div className="flex items-center justify-between text-xs text-fintech-muted mb-2">
                <span className="font-semibold uppercase tracking-wider text-[11px]">
                  {t('dash.monthlyBudget', 'Monthly Budget')}
                </span>
                {consumption.isMonthlyExceeded ? (
                  <span className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded border border-red-200 dark:border-red-800">
                    {t('dash.monthlyExceeded', 'MONTHLY BUDGET EXCEEDED')}
                  </span>
                ) : (
                  <span className="text-xs font-medium text-fintech-navy">
                    {consumption.monthlyPct}% {t('dash.used', 'used')}
                  </span>
                )}
              </div>
              <div className="text-2xl font-bold text-fintech-navy">
                {formatCurrency(consumption.spentThisMonthPaise)}
                <span className="text-sm font-normal text-fintech-muted"> / {formatCurrency(consumption.configuredMonthlyLimitPaise)}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 mt-3 overflow-hidden">
                <div
                  className={`h-2.5 rounded-full transition-all duration-300 ${consumption.isMonthlyExceeded
                      ? 'bg-fintech-error'
                      : consumption.monthlyPct > 85
                        ? 'bg-fintech-error'
                        : consumption.monthlyPct > 60
                          ? 'bg-fintech-warning'
                          : 'bg-emerald-500'
                    }`}
                  style={{ width: `${Math.min(100, consumption.monthlyPct)}%` }}
                />
              </div>
              <div className="mt-3 text-xs text-fintech-muted flex items-center justify-between">
                <span>{t('dash.remainingMonth', 'Remaining this month:')}</span>
                <span className={`font-semibold ${consumption.isMonthlyExceeded ? 'text-red-600 dark:text-red-400' : 'text-fintech-text'}`}>
                  {consumption.isMonthlyExceeded
                    ? `${formatCurrency(0)} (${t('dash.monthlyExceeded', 'Exceeded')})`
                    : formatCurrency(consumption.remainingThisMonthPaise)}
                </span>
              </div>
              {consumption.isMonthlyExceeded && (
                <div className="mt-2.5 pt-2 border-t border-red-200/60 dark:border-red-900/40 text-[11px] text-red-700 dark:text-red-400 leading-snug">
                  {t('dash.monthlyExceededDesc', 'Family monthly budget exceeded. Transactions blocked until next month or Administrator limit adjustment.')}
                </div>
              )}
            </Card>
          </div>

          {/* AI Spending Insight Widget (Member View) */}
          <Card className="bg-blue-50/50 border-blue-200/80 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-blue-200/60">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-fintech-primary flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-fintech-navy">AI Spend Intelligence</h3>
                  <p className="text-[11px] text-fintech-muted">Personalized insights based on your authenticated spending and daily limits</p>
                </div>
              </div>
              <Badge variant={aiInsight.badgeVariant} size="sm">
                {aiInsight.badge}
              </Badge>
            </div>

            <div className="mt-3 space-y-3">
              <p className="text-xs text-fintech-navy font-medium leading-relaxed">
                {aiInsight.text}
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[11px] font-semibold text-fintech-muted">Quick inquiries:</span>
                {aiInsight.prompts.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => navigate(`/ai-assistant?q=${encodeURIComponent(p)}`)}
                    className="text-[11px] bg-white border border-blue-200 hover:border-fintech-primary text-fintech-navy hover:text-fintech-primary px-3 py-1 rounded-full transition-all cursor-pointer shadow-2xs flex items-center gap-1"
                  >
                    <span>💬</span> {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-blue-200/60 flex items-center justify-between text-xs font-semibold text-fintech-primary">
              <Link to="/ai-assistant" className="hover:underline flex items-center gap-1">
                Ask Spending Assistant <ChevronRight className="w-3.5 h-3.5" />
              </Link>
              <span className="text-[11px] text-fintech-muted font-normal">Single source of truth accounting</span>
            </div>
          </Card>
        </div>
      )}

      {/* Member Spending Status Cards (Owner Only) */}
      {isOwner && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base sm:text-lg font-bold text-fintech-navy">Family Dependents Spending Live Status</h2>
            <Link to="/spending-limits" className="text-xs font-semibold text-fintech-primary hover:underline">
              Adjust limits & permissions &rarr;
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {familyMembers
              .filter((m) => m.role === 'member')
              .map((member) => {
                const rule = spendingRules[member.id];
                const mConsumption = getMemberConsumption(member.id);

                return (
                  <Card key={member.id} className="p-5">
                    <div className="flex items-center justify-between pb-3 border-b border-fintech-border/70 mb-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={member.avatarUrl}
                          alt={member.name}
                          className="w-10 h-10 rounded-full object-cover ring-1 ring-slate-200"
                        />
                        <div>
                          <h3 className="text-sm font-bold text-fintech-text">{member.name}</h3>
                          <div className="flex items-center flex-wrap gap-2 mt-0.5">
                            <span className="text-xs font-semibold text-fintech-primary">
                              Personal Account: {formatCurrency(memberPersonalAccounts[member.id]?.balancePaise || 0)}
                            </span>
                            <span className="text-[11px] text-fintech-muted">• {member.relationship}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex gap-1.5">
                          <Badge variant={rule?.allowMoneyTransfer ? 'success' : 'error'} size="sm">
                            {rule?.allowMoneyTransfer ? 'Transfer ON' : 'Transfer OFF'}
                          </Badge>
                          <Badge variant={rule?.allowQRPayments ? 'success' : 'error'} size="sm">
                            {rule?.allowQRPayments ? 'QR ON' : 'QR OFF'}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-fintech-muted">Today's Usage ({formatCurrency(mConsumption.spentTodayPaise)} / {formatCurrency(mConsumption.configuredDailyLimitPaise)})</span>
                          <span className="font-semibold text-fintech-navy">{mConsumption.dailyPct}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${mConsumption.dailyPct > 80 ? 'bg-fintech-error' : 'bg-fintech-primary'}`}
                            style={{ width: `${mConsumption.dailyPct}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-fintech-muted">Month-to-Date ({formatCurrency(mConsumption.spentThisMonthPaise)} / {formatCurrency(mConsumption.configuredMonthlyLimitPaise)})</span>
                          <span className="font-semibold text-fintech-navy">{mConsumption.monthlyPct}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${mConsumption.monthlyPct > 80 ? 'bg-fintech-error' : 'bg-emerald-500'}`}
                            style={{ width: `${mConsumption.monthlyPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
          </div>
        </div>
      )}

      {/* Recent Transactions List */}
      <Card className="p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-fintech-border flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-fintech-navy">
              {isOwner ? 'Recent Family Activity' : 'Your Recent Transactions'}
            </h2>
            <p className="text-xs text-fintech-muted">Click any item to view its detailed transaction receipt</p>
          </div>
          <Link
            to="/transactions"
            className="text-xs font-semibold text-fintech-primary hover:underline flex items-center gap-1"
          >
            View all <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {displayTransactions.length === 0 ? (
          <div className="p-8 text-center text-fintech-muted text-xs">
            No transactions recorded yet in this family group.
          </div>
        ) : (
          <div className="divide-y divide-fintech-border">
            {displayTransactions.map((txn) => {
              const isAddMoney = txn.type === 'ADD_MONEY';
              const isTransfer = txn.type === 'TRANSFER';
              const isSuccess = txn.status === 'COMPLETED';

              // Determine perspective-based title and direction
              const isOutgoing = isAddMoney
                ? false
                : isOwner
                  ? true
                  : !isTransfer;

              const displayTitle = isAddMoney
                ? 'Money added to Administrator Account'
                : isTransfer
                  ? isOwner
                    ? `Money sent to ${txn.recipientName}`
                    : `Money received from ${txn.senderName || 'Rajesh Sharma'}`
                  : txn.recipientName;

              return (
                <div
                  key={txn.id}
                  onClick={() => {
                    if (!isOwner && txn.type === 'TRANSFER' && txn.status === 'COMPLETED') {
                      setAnimModal({
                        isOpen: true,
                        isProcessing: false,
                        isSuccess: true,
                        flowType: 'receive_money',
                        amountPaise: txn.amountPaise,
                        senderName: txn.senderName || 'Rajesh Sharma',
                        recipientName: currentUser.name,
                        transaction: txn,
                      });
                    } else {
                      setSelectedReceiptTxn(txn);
                    }
                  }}
                  className="px-6 py-4 flex items-center justify-between hover:bg-slate-50/80 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${!isSuccess
                          ? 'bg-red-50 text-fintech-error'
                          : isAddMoney
                            ? 'bg-emerald-50 text-emerald-600'
                            : isTransfer
                              ? isOutgoing
                                ? 'bg-blue-50 text-fintech-primary'
                                : 'bg-emerald-50 text-emerald-600'
                              : 'bg-indigo-50 text-indigo-600'
                        }`}
                    >
                      {isAddMoney ? (
                        <PlusCircle className="w-5 h-5" />
                      ) : isTransfer ? (
                        <HandCoins className="w-5 h-5" />
                      ) : (
                        <QrCode className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-fintech-text flex items-center flex-wrap gap-2">
                        <span>{displayTitle}</span>
                        {isAddMoney && (
                          <Badge variant="success" size="sm">
                            Money Added
                          </Badge>
                        )}
                        {txn.paymentSource && (
                          <Badge variant={isCustomUser ? 'primary' : 'simulated'} size="sm" className="bg-slate-100 text-slate-700">
                            {txn.paymentSource === 'ADMIN_ACCOUNT'
                              ? 'Admin Account'
                              : 'Personal Account'}
                          </Badge>
                        )}
                        {!isSuccess && (
                          <Badge variant="error" size="sm">
                            Declined
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-fintech-muted flex items-center gap-2 mt-0.5">
                        <span>{formatDateTime(txn.date)}</span>
                        <span>•</span>
                        <span className="font-mono text-[11px]">{txn.reference}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div
                      className={`text-sm font-bold ${!isSuccess
                          ? 'text-fintech-muted line-through'
                          : isOutgoing
                            ? 'text-fintech-navy'
                            : 'text-fintech-success'
                        }`}
                    >
                      {isOutgoing ? '-' : '+'}{formatCurrency(txn.amountPaise)}
                    </div>
                    <div className="text-[11px] text-fintech-muted">
                      {txn.status}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* To Mobile Number Modal */}
      <ToMobileModal
        isOpen={isToMobileOpen}
        onClose={() => setIsToMobileOpen(false)}
        onSuccess={(txn) => setSelectedReceiptTxn(txn)}
      />

      {/* Check Balance Modal */}
      <CheckBalanceModal
        isOpen={isCheckBalanceOpen}
        onClose={() => setIsCheckBalanceOpen(false)}
      />

      {/* Add Money Modal */}
      <AddMoneyModal
        isOpen={isAddMoneyOpen}
        onClose={() => setIsAddMoneyOpen(false)}
        onSuccess={(txn) => setSelectedReceiptTxn(txn)}
      />

      {/* Send Money Modal */}
      <SendMoneyModal
        isOpen={isSendMoneyOpen}
        onClose={() => setIsSendMoneyOpen(false)}
        onSuccess={(txn) => setSelectedReceiptTxn(txn)}
        initialMemberId={sendMoneyInitialMemberId}
      />

      {/* Spend Money Modal (Administrator Central Pool) */}
      <SpendMoneyModal
        isOpen={isSpendMoneyOpen}
        onClose={() => setIsSpendMoneyOpen(false)}
        onSuccess={(txn) => setSelectedReceiptTxn(txn)}
      />

      {/* Transaction Receipt Dialog */}
      <TransactionReceiptModal
        transaction={selectedReceiptTxn}
        isOpen={Boolean(selectedReceiptTxn)}
        onClose={() => setSelectedReceiptTxn(null)}
      />

      {/* Premium Fintech Transaction Modal (Money Transfer / Money Received Counting) */}
      <FintechTransactionModal
        isOpen={animModal.isOpen}
        onClose={() => setAnimModal((prev) => ({ ...prev, isOpen: false }))}
        flowType={animModal.flowType}
        amountPaise={animModal.amountPaise}
        senderName={animModal.senderName}
        recipientName={animModal.recipientName}
        isProcessing={animModal.isProcessing}
        isSuccess={animModal.isSuccess}
        failureReason={animModal.failureReason}
        transaction={animModal.transaction}
        onViewReceipt={(txn) => {
          setAnimModal((prev) => ({ ...prev, isOpen: false }));
          setSelectedReceiptTxn(txn);
        }}
      />
      {/* Request Extra Money Modal for Member */}
      <RequestExtraMoneyModal
        isOpen={isRequestExtraMoneyOpen}
        onClose={() => setIsRequestExtraMoneyOpen(false)}
        currentBalancePaise={memberPersonalAccount.balancePaise}
        sourceContext={
          consumption.isDailyBlockedByMonthly
            ? 'Monthly Budget Cap'
            : consumption.isDailyExceeded
              ? 'Daily Allowance Cap'
              : undefined
        }
      />
    </div>
  );
};

