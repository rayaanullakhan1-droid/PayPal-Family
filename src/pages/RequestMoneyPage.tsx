import React, { useState } from 'react';
import {
  HandCoins,
  Send,
  AlertCircle,
  CheckCircle2,
  Info,
  ShieldAlert,
  ArrowRight,
  TrendingDown,
  Sparkles,
  Clock,
  Zap,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useApp } from '../context/AppContext';
import { toPaise, formatCurrency } from '../utils/currency';
import { formatDateTime } from '../utils/dates';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { TransactionReceiptModal } from '../components/common/TransactionReceiptModal';
import { TransactionPinModal } from '../components/common/TransactionPinModal';
import { OverLimitRequestModal } from '../components/common/OverLimitRequestModal';
import { RequestExtraMoneyModal } from '../components/common/RequestExtraMoneyModal';
import { FintechTransactionModal } from '../components/fintech/FintechTransactionModal';
import { Transaction, MoneyRequest } from '../types';

export const RequestMoneyPage: React.FC = () => {
  const {
    currentUser,
    ownerWallet,
    spendingRules,
    requestMoney,
    createMoneyRequest,
    submitLimitExceptionRequest,
    moneyRequests,
    getMemberConsumption,
    familyMembers,
  } = useApp();

  const isOwner = currentUser.role === 'owner';
  const owner = familyMembers.find((m) => m.role === 'owner');

  const [rupeesInput, setRupeesInput] = useState('');
  const [purpose, setPurpose] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedSuccess, setSubmittedSuccess] = useState<{
    amount: string;
    isException?: boolean;
    message?: string;
  } | null>(null);

  // Success transaction receipt state (for automatic transfers)
  const [successReceiptTxn, setSuccessReceiptTxn] = useState<Transaction | null>(null);

  // Over-limit failed request state (for YES/NO choice)
  const [overLimitDetails, setOverLimitDetails] = useState<{
    configuredLimitPaise: number;
    requestedAmountPaise: number;
    excessAmountPaise: number;
  } | null>(null);
  const [isOverLimitModalOpen, setIsOverLimitModalOpen] = useState(false);
  const [isRequestExtraMoneyOpen, setIsRequestExtraMoneyOpen] = useState(false);

  // 6-Digit Transaction PIN modal state
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);

  // Premium fintech animation modal state
  const [animModal, setAnimModal] = useState<{
    isOpen: boolean;
    isProcessing: boolean;
    isSuccess: boolean;
    failureReason?: string;
    requestStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
    amountPaise: number;
    transaction?: Transaction | null;
  }>({
    isOpen: false,
    isProcessing: false,
    isSuccess: false,
    amountPaise: 0,
  });

  // Synchronized member consumption from single source of truth
  const consumption = getMemberConsumption(currentUser.id);

  const parsedPaise = toPaise(rupeesInput);

  // Privacy-scoped limits directly from synchronized single source of truth
  const maxRequestLimit = consumption.maxRequestLimitPaise;
  const dailyLimit = consumption.configuredDailyLimitPaise;
  const monthlyLimit = consumption.configuredMonthlyLimitPaise;
  const todaysAvailablePaise = consumption.remainingTodayPaise;
  const monthlyAvailablePaise = consumption.remainingThisMonthPaise;

  const memberRequests = (moneyRequests || []).filter((r: MoneyRequest) => r.memberId === currentUser.id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (parsedPaise <= 0) {
      setErrorMessage('Please enter a valid amount greater than ₹0.');
      return;
    }

    setErrorMessage(null);
    setSubmittedSuccess(null);
    setIsSubmitting(true);

    setAnimModal({
      isOpen: true,
      isProcessing: true,
      isSuccess: false,
      amountPaise: parsedPaise,
    });

    try {
      const finalPurpose = purpose.trim() || 'Family fund request';
      const result = await createMoneyRequest(parsedPaise, finalPurpose);

      if (result.success && result.autoAuthorized && result.transaction) {
        // CASE A / B: Transaction within limit -> Auto-authorized and transferred immediately!
        try {
          confetti({
            particleCount: 75,
            spread: 65,
            origin: { y: 0.6 },
          });
        } catch {}

        setSuccessReceiptTxn(result.transaction);
        setSubmittedSuccess({
          amount: formatCurrency(parsedPaise),
          isException: false,
          message: `${formatCurrency(parsedPaise)} transferred automatically.`,
        });
        setAnimModal({
          isOpen: true,
          isProcessing: false,
          isSuccess: true,
          requestStatus: 'APPROVED',
          amountPaise: parsedPaise,
          transaction: result.transaction,
        });
        setRupeesInput('');
        setPurpose('');
      } else if (result.success && result.requiresApproval && result.request) {
        // CASE C: Exceeds limit -> Pending administrator approval request created immediately!
        const exceededLimitDesc = parsedPaise > todaysAvailablePaise
          ? `your remaining daily allowance of ${formatCurrency(todaysAvailablePaise)}`
          : `your remaining monthly limit of ${formatCurrency(monthlyAvailablePaise)}`;
        setSubmittedSuccess({
          amount: formatCurrency(parsedPaise),
          isException: true,
          message: `Your request for ${formatCurrency(parsedPaise)} exceeds ${exceededLimitDesc} and has been sent to ${owner?.name || 'Administrator'} for approval.`,
        });
        setAnimModal({
          isOpen: true,
          isProcessing: false,
          isSuccess: true,
          requestStatus: 'PENDING',
          amountPaise: parsedPaise,
        });
        setRupeesInput('');
        setPurpose('');
      } else {
        setAnimModal({
          isOpen: true,
          isProcessing: false,
          isSuccess: false,
          failureReason: result.error || 'Failed to process request.',
          amountPaise: parsedPaise,
        });
        setErrorMessage(result.error || 'Failed to process request.');
      }
    } catch (err: any) {
      setAnimModal({
        isOpen: true,
        isProcessing: false,
        isSuccess: false,
        failureReason: err.message || 'An unexpected error occurred during request submission.',
        amountPaise: parsedPaise,
      });
      setErrorMessage(err.message || 'An unexpected error occurred during request submission.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePinVerified = async () => {
    setIsPinModalOpen(false);
  };

  const handleConfirmSendToAdmin = async (customMessage?: string) => {
    if (!overLimitDetails) return;
    const finalPurpose = customMessage?.trim() || purpose || 'Limit Exception Request';
    setAnimModal({
      isOpen: true,
      isProcessing: true,
      isSuccess: false,
      amountPaise: overLimitDetails.requestedAmountPaise,
    });
    const res = await submitLimitExceptionRequest(
      overLimitDetails.requestedAmountPaise,
      finalPurpose,
      overLimitDetails.configuredLimitPaise,
      overLimitDetails.excessAmountPaise,
      finalPurpose
    );
    if (res.success) {
      setAnimModal({
        isOpen: true,
        isProcessing: false,
        isSuccess: true,
        requestStatus: 'PENDING',
        amountPaise: overLimitDetails.requestedAmountPaise,
      });
      setSubmittedSuccess({
        amount: formatCurrency(overLimitDetails.requestedAmountPaise),
        isException: true,
        message: `Limit exception request for ${formatCurrency(overLimitDetails.requestedAmountPaise)} was sent to ${owner?.name || 'Administrator'} for approval.`,
      });
      setPurpose('');
    } else {
      setAnimModal({
        isOpen: true,
        isProcessing: false,
        isSuccess: false,
        failureReason: res.error || 'Failed to deliver request to Administrator.',
        amountPaise: overLimitDetails.requestedAmountPaise,
      });
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Title */}
      <div className="pb-2 border-b border-fintech-border/70">
        <h1 className="text-2xl sm:text-3xl font-bold text-fintech-navy tracking-tight">Request Family Funds</h1>
        <p className="text-xs sm:text-sm text-fintech-muted mt-0.5">
          Requests within your configured limit transfer automatically. Over-limit amounts require Administrator approval.
        </p>
      </div>

      {/* Advisory if current user is Owner */}
      {isOwner && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs text-fintech-navy flex items-start gap-3">
          <Info className="w-5 h-5 text-fintech-primary shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold mb-0.5">Administrator Spending Overview</div>
            Money requests are submitted by family members for allowance disbursement. As Family Administrator, pending allowance requests can be reviewed and authorized directly from your Family Dashboard.
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Side: Transfer Form */}
        <div className="md:col-span-2">
          <Card>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Amount Input */}
              <div>
                <label className="block text-xs font-semibold text-fintech-navy mb-2">
                  Requested Amount (INR)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-2xl font-bold text-fintech-navy">
                    ₹
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={rupeesInput}
                    onChange={(e) => {
                      setRupeesInput(e.target.value);
                      setErrorMessage(null);
                    }}
                    required
                    placeholder="0.00"
                    disabled={isSubmitting}
                    className="w-full pl-10 pr-4 py-3 text-2xl font-bold text-fintech-navy border border-fintech-border rounded-xl focus:outline-none focus:ring-2 focus:ring-fintech-primary focus:border-transparent placeholder:text-slate-300"
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-fintech-muted mt-1.5 px-1">
                  <span>Equivalent to: <strong>{parsedPaise.toLocaleString()} Paise</strong></span>
                  <span className="text-[11px] text-indigo-600 font-medium">Integer arithmetic precision</span>
                </div>
              </div>

              {/* Purpose / Note */}
              <div>
                <label className="block text-xs font-semibold text-fintech-navy mb-1">
                  Purpose / Expense Note
                </label>
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="e.g. Science lab equipment, cafeteria pass"
                  required
                  disabled={isSubmitting}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-fintech-border text-sm focus:outline-none focus:ring-2 focus:ring-fintech-primary"
                />
              </div>

              {/* Error Banner */}
              {errorMessage && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-fintech-error flex items-start gap-3 animate-in fade-in">
                  <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold mb-0.5">Request Declined</div>
                    <div>{errorMessage}</div>
                  </div>
                </div>
              )}

              {/* Dynamic Transaction Receipt Banner */}
              {submittedSuccess && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-2 animate-in fade-in">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>{submittedSuccess.isException ? 'EXCEPTION REQUEST SUBMITTED' : 'TRANSACTION SUCCESSFUL'}</span>
                  </div>
                  <div className="text-base font-bold text-fintech-navy">
                    {submittedSuccess.isException
                      ? submittedSuccess.message
                      : `${submittedSuccess.amount} transferred automatically.`}
                  </div>
                  {!submittedSuccess.isException && (
                    <div className="pt-2 border-t border-emerald-200/80 flex flex-col gap-1 text-[11px] text-emerald-800">
                      <div>From: <strong className="text-fintech-navy">Administrator Account</strong></div>
                      <div>To: <strong className="text-fintech-navy">Member Personal Account</strong></div>
                    </div>
                  )}
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isSubmitting}
                disabled={isSubmitting || parsedPaise <= 0}
                className="w-full"
                icon={<Send className="w-4 h-4" />}
              >
                {isSubmitting ? 'Evaluating & Processing...' : `Send Request for ${formatCurrency(parsedPaise)}`}
              </Button>
            </form>
          </Card>
        </div>

        {/* Right Side: Member Financial Status & Limits Summary */}
        <div className="space-y-4">
          <Card className="bg-slate-50 border-fintech-border">
            <h3 className="text-xs font-bold text-fintech-navy uppercase tracking-wider mb-3">
              Account Balances & Limits Check
            </h3>

            {!isOwner ? (
              <div className="space-y-3 text-xs">
                {/* Today's Available Balance */}
                <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs">
                  <div className="text-fintech-muted font-medium text-xs">Today's Available Balance</div>
                  <div className="text-2xl font-bold text-fintech-navy mt-1">
                    {formatCurrency(consumption.remainingTodayPaise)}
                  </div>
                  <div className="text-[11px] text-fintech-muted mt-1.5 flex items-center justify-between pt-2 border-t border-slate-100">
                    <span>Daily Limit: {formatCurrency(consumption.configuredDailyLimitPaise)}</span>
                    <span>Spent: {formatCurrency(consumption.spentTodayPaise)}</span>
                  </div>
                </div>

                {/* Monthly Available Balance */}
                <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs">
                  <div className="text-fintech-muted font-medium text-xs">Monthly Available Balance</div>
                  <div className="text-2xl font-bold text-fintech-navy mt-1">
                    {formatCurrency(consumption.remainingThisMonthPaise)}
                  </div>
                  <div className="text-[11px] text-fintech-muted mt-1.5 flex items-center justify-between pt-2 border-t border-slate-100">
                    <span>Monthly Limit: {formatCurrency(consumption.configuredMonthlyLimitPaise)}</span>
                    <span>Spent: {formatCurrency(consumption.spentThisMonthPaise)}</span>
                  </div>
                </div>

                {/* Request Extra Money Option */}
                <div className="p-3.5 bg-gradient-to-br from-blue-50 to-indigo-50/50 rounded-xl border border-blue-200/80 shadow-xs space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-fintech-primary">
                    <HandCoins className="w-4 h-4" />
                    <span>Need Extra Money?</span>
                  </div>
                  <p className="text-[11px] text-fintech-navy leading-relaxed">
                    If your balance or spending limits are insufficient, you can send an extra money request with an explanation message directly to the Administrator.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsRequestExtraMoneyOpen(true)}
                    className="w-full text-xs font-bold text-fintech-primary border-blue-300 hover:bg-blue-100/60 bg-white"
                  >
                    Request Extra Money
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-xs text-fintech-muted">
                Logged in as Family Administrator.
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Member Recent Requests History */}
      {memberRequests.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-fintech-border flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-fintech-navy">Your Money & Exception Requests</h3>
              <p className="text-xs text-fintech-muted">Extra money and limit exception requests submitted to Administrator for approval</p>
            </div>
          </div>
          <div className="divide-y divide-fintech-border">
            {memberRequests.map((req: MoneyRequest) => (
              <div key={req.id} className="px-6 py-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                      req.status === 'APPROVED'
                        ? 'bg-emerald-50 text-emerald-600'
                        : req.status === 'REJECTED'
                        ? 'bg-red-50 text-fintech-error'
                        : 'bg-amber-50 text-amber-600'
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-fintech-text">{req.message || req.purpose}</span>
                      {req.isExtraMoneyRequest ? (
                        <Badge variant="primary" size="sm" className="bg-blue-100 text-blue-900 border-blue-200">
                          Extra Money
                        </Badge>
                      ) : req.isException ? (
                        <Badge variant="warning" size="sm">
                          Limit Exception
                        </Badge>
                      ) : null}
                    </div>
                    <div className="text-[11px] text-fintech-muted mt-0.5 flex flex-wrap items-center gap-2">
                      <span>{formatDateTime(req.createdAt)}</span>
                      {req.isException && (
                        <span className="text-amber-700 font-semibold">
                          • Excess: +{formatCurrency(req.excessAmountPaise || 0)}
                        </span>
                      )}
                      {req.transactionReference && (
                        <span>• Ref: <span className="font-mono">{req.transactionReference}</span></span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-sm font-bold text-fintech-navy">
                    {formatCurrency(req.amountPaise)}
                  </div>
                  <Badge
                    variant={
                      req.status === 'APPROVED'
                        ? 'success'
                        : req.status === 'REJECTED'
                        ? 'error'
                        : 'warning'
                    }
                    size="sm"
                    className="mt-0.5"
                  >
                    {req.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 6-Digit Transaction PIN Modal */}
      <TransactionPinModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onSuccess={handlePinVerified}
        amountPaise={parsedPaise}
        title="Authorize Allowance Transfer"
        description="Enter your 6-digit transaction PIN to receive funds into your wallet"
        actionLabel="Verify & Transfer"
      />

      {/* Success Transaction Receipt Modal (Automatic Transfer) */}
      <TransactionReceiptModal
        transaction={successReceiptTxn}
        isOpen={Boolean(successReceiptTxn)}
        onClose={() => setSuccessReceiptTxn(null)}
      />

      {/* Failed Request Over-Limit Modal (YES/NO Choice) */}
      <OverLimitRequestModal
        isOpen={isOverLimitModalOpen}
        onClose={() => setIsOverLimitModalOpen(false)}
        configuredLimitPaise={overLimitDetails?.configuredLimitPaise || 0}
        requestedAmountPaise={overLimitDetails?.requestedAmountPaise || 0}
        excessAmountPaise={overLimitDetails?.excessAmountPaise || 0}
        purpose={purpose}
        onConfirmSendToAdmin={handleConfirmSendToAdmin}
      />

      {/* Premium Money Request Fintech Animation Modal */}
      <FintechTransactionModal
        isOpen={animModal.isOpen}
        onClose={() => setAnimModal((prev) => ({ ...prev, isOpen: false }))}
        flowType="request_money"
        amountPaise={animModal.amountPaise}
        senderName={currentUser.name}
        recipientName={owner?.name || 'Administrator'}
        isProcessing={animModal.isProcessing}
        isSuccess={animModal.isSuccess}
        failureReason={animModal.failureReason}
        requestStatus={animModal.requestStatus}
        transaction={animModal.transaction}
        onViewReceipt={(txn) => {
          setAnimModal((prev) => ({ ...prev, isOpen: false }));
          setSuccessReceiptTxn(txn);
        }}
      />

      {/* Dedicated Request Extra Money Modal */}
      <RequestExtraMoneyModal
        isOpen={isRequestExtraMoneyOpen}
        onClose={() => setIsRequestExtraMoneyOpen(false)}
        initialMessage={purpose}
        onSuccess={() => {
          setPurpose('');
          setRupeesInput('');
        }}
      />
    </div>
  );
};
