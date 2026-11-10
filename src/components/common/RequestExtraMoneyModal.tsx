import React, { useState, useEffect } from 'react';
import {
  HandCoins,
  Send,
  AlertCircle,
  CheckCircle2,
  Wallet,
  ShieldCheck,
  Sparkles,
  Info,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatCurrency, toPaise } from '../../utils/currency';
import { formatDateTime } from '../../utils/dates';
import { Modal } from './Modal';
import { Button } from './Button';
import { Badge } from './Badge';
import { MoneyRequest, Transaction } from '../../types';

interface RequestExtraMoneyModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialAmountPaise?: number;
  initialMessage?: string;
  currentBalancePaise?: number;
  requiredAmountPaise?: number;
  shortfallPaise?: number;
  sourceContext?: string;
  onSuccess?: (request: MoneyRequest) => void;
}

export const RequestExtraMoneyModal: React.FC<RequestExtraMoneyModalProps> = ({
  isOpen,
  onClose,
  initialAmountPaise,
  initialMessage = '',
  currentBalancePaise,
  requiredAmountPaise,
  shortfallPaise,
  sourceContext,
  onSuccess,
}) => {
  const { currentUser, family, familyMembers, submitExtraMoneyRequest } = useApp();
  const owner = familyMembers.find((m) => m.role === 'owner');

  const defaultAmountRupees = initialAmountPaise
    ? (initialAmountPaise / 100).toString()
    : shortfallPaise
    ? (shortfallPaise / 100).toString()
    : '';

  const [amountRupees, setAmountRupees] = useState(defaultAmountRupees);
  const [message, setMessage] = useState(initialMessage);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdRequest, setCreatedRequest] = useState<MoneyRequest | null>(null);
  const [authorizedTxn, setAuthorizedTxn] = useState<Transaction | null>(null);

  useEffect(() => {
    if (isOpen) {
      const initRupees = initialAmountPaise
        ? (initialAmountPaise / 100).toString()
        : shortfallPaise
        ? (shortfallPaise / 100).toString()
        : '';
      setAmountRupees(initRupees);
      setMessage(initialMessage || '');
      setError(null);
      setCreatedRequest(null);
      setAuthorizedTxn(null);
      setIsSubmitting(false);
    }
  }, [isOpen, initialAmountPaise, shortfallPaise, initialMessage]);

  const parsedPaise = toPaise(amountRupees);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (parsedPaise <= 0) {
      setError('Please enter a valid requested amount greater than ₹0.');
      return;
    }

    if (!message.trim()) {
      setError('Please enter a message explaining why you need the additional money.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitExtraMoneyRequest(parsedPaise, message.trim(), sourceContext);
      if (res.success) {
        if (res.autoAuthorized && res.transaction) {
          // CASE A / B: Transaction within limit -> Auto-authorized!
          setAuthorizedTxn(res.transaction);
        } else if (res.requiresApproval && res.request) {
          // CASE C: Transaction above limit -> Approval request created!
          setCreatedRequest(res.request);
          if (onSuccess) {
            onSuccess(res.request);
          }
        }
      } else {
        setError(res.error || 'Failed to submit extra money request.');
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setError(null);
    setCreatedRequest(null);
    setAuthorizedTxn(null);
    onClose();
  };

  const quickReasons = [
    'Semester textbooks & supplies',
    'Emergency medical expense',
    'Daily meal & groceries',
    'Travel & commute',
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        authorizedTxn
          ? 'Transaction Authorized'
          : createdRequest
          ? 'Request Submitted for Approval'
          : 'Request Extra Money'
      }
      description={
        authorizedTxn
          ? 'Funds have been transferred automatically within your spending limits'
          : createdRequest
          ? 'Your request has been routed to the Family Administrator for review'
          : `Request funds from Administrator ${owner?.name || 'Rajesh Sharma'}`
      }
      maxWidth="md"
    >
      {!authorizedTxn && !createdRequest ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Context Banner if insufficient balance or allowance */}
          {(shortfallPaise !== undefined || sourceContext) && (
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/80 rounded-xl text-xs text-amber-950 dark:text-amber-100 space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-950 dark:text-amber-100">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>
                  {sourceContext ? `Insufficient Funds for ${sourceContext}` : 'Insufficient Available Balance'}
                </span>
              </div>
              <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed font-medium">
                Your current balance or spending limit is insufficient for this transaction. You can request extra money from your Family Administrator.
              </p>
              {currentBalancePaise !== undefined && requiredAmountPaise !== undefined && (
                <div className="pt-2 border-t border-amber-300/70 dark:border-amber-700/60 flex justify-between text-[11px] font-semibold text-amber-950 dark:text-amber-200">
                  <span>Current Balance: <strong>{formatCurrency(currentBalancePaise)}</strong></span>
                  <span>Required: <strong>{formatCurrency(requiredAmountPaise)}</strong></span>
                  {shortfallPaise && (
                    <span className="text-red-700 dark:text-red-400 font-bold">
                      Shortfall: +{formatCurrency(shortfallPaise)}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 rounded-xl text-xs text-red-800 dark:text-red-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* Amount Input */}
          <div>
            <label className="block text-xs font-bold text-fintech-navy dark:text-slate-100 mb-1">
              Requested Amount (INR) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500 dark:text-slate-400">
                ₹
              </span>
              <input
                type="number"
                min="1"
                step="any"
                value={amountRupees}
                onChange={(e) => setAmountRupees(e.target.value)}
                placeholder="e.g. 1500"
                className="w-full pl-8 pr-3.5 py-2.5 text-base font-bold text-fintech-navy dark:text-white border border-fintech-border dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-fintech-primary/30 focus:border-fintech-primary bg-white dark:bg-slate-900 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                required
              />
            </div>
            {parsedPaise > 0 && (
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                Amount: <strong className="text-fintech-navy dark:text-white">{formatCurrency(parsedPaise)}</strong>
              </p>
            )}

            {/* Quick Amount Suggestion Buttons */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[500, 1000, 2000, 3000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setAmountRupees(amt.toString())}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-fintech-navy dark:text-slate-100 rounded-lg transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
                >
                  ₹{amt.toLocaleString('en-IN')}
                </button>
              ))}
              {shortfallPaise && shortfallPaise > 0 && (
                <button
                  type="button"
                  onClick={() => setAmountRupees((shortfallPaise / 100).toString())}
                  className="px-2.5 py-1 text-[11px] font-bold bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60 text-amber-950 dark:text-amber-200 rounded-lg transition-colors cursor-pointer border border-amber-300 dark:border-amber-700"
                >
                  Exact Shortfall (₹{(shortfallPaise / 100).toLocaleString('en-IN')})
                </button>
              )}
            </div>
          </div>

          {/* Message Input (Required) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-fintech-navy dark:text-slate-100">
                Message to Administrator <span className="text-red-500">*</span>
              </label>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                Explain why you need the extra money
              </span>
            </div>
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g., Need additional funds for semester project equipment and advanced textbooks..."
              className="w-full p-3 text-xs text-fintech-navy dark:text-white border border-fintech-border dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-fintech-primary/30 focus:border-fintech-primary bg-white dark:bg-slate-900 placeholder:text-slate-400 dark:placeholder:text-slate-500 resize-none font-medium"
              required
            />

            {/* Quick reason pills */}
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {quickReasons.map((reason, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setMessage(reason)}
                  className="text-[10px] bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-fintech-primary dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-md transition-colors cursor-pointer text-left truncate max-w-full font-medium"
                >
                  + {reason}
                </button>
              ))}
            </div>
          </div>

          {/* High-Contrast Information / Security Box (Mandated by Screenshot 1) */}
          <div className="p-3.5 bg-blue-50/90 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded-xl flex items-start gap-2.5 text-xs text-blue-950 dark:text-blue-100">
            <ShieldCheck className="w-5 h-5 text-fintech-primary dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-blue-950 dark:text-blue-200">
                Two-Account Transaction Security
              </div>
              <p className="text-[11px] text-slate-700 dark:text-blue-200 leading-relaxed font-normal">
                Amounts within your permitted limit authorize automatically and transfer funds from the Administrator Account directly to your Member Account. Amounts exceeding your limit require explicit Administrator authorization.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-fintech-border dark:border-slate-800">
            <Button type="button" variant="outline" size="md" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSubmitting}
              disabled={isSubmitting || !message.trim() || parsedPaise <= 0}
              icon={<Send className="w-4 h-4" />}
              className="bg-fintech-primary hover:bg-[#005bb5] text-white font-bold"
            >
              Request Funds
            </Button>
          </div>
        </form>
      ) : authorizedTxn ? (
        /* ========================================================= */
        /* CASE A / B: IMMEDIATE AUTOMATIC AUTHORIZATION STATE       */
        /* ========================================================= */
        <div className="space-y-4 py-2">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3 shadow-xs">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <Badge variant="success" size="md" className="mb-1 font-bold">
              TRANSACTION AUTHORIZED
            </Badge>
            <h3 className="text-lg font-bold text-fintech-navy dark:text-white mt-1">
              {formatCurrency(authorizedTxn.amountPaise)} Transferred Automatically
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-sm">
              Your transaction is within permitted spending limits. Funds have been debited directly from the Administrator Account and credited to your Personal Account.
            </p>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs space-y-2.5">
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Transaction ID:</span>
              <span className="font-mono font-bold text-fintech-navy dark:text-slate-200">{authorizedTxn.reference}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Amount Transferred:</span>
              <strong className="text-emerald-700 dark:text-emerald-400 text-sm font-bold">
                +{formatCurrency(authorizedTxn.amountPaise)}
              </strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Debited From:</span>
              <span className="text-fintech-navy dark:text-slate-200 font-semibold">{owner?.name || 'Rajesh Sharma'} (Administrator Account)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Credited To:</span>
              <span className="text-fintech-navy dark:text-slate-200 font-semibold">{currentUser.name} (Member Account)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Status:</span>
              <Badge variant="success" size="sm">COMPLETED</Badge>
            </div>
          </div>

          <div className="pt-2 border-t border-fintech-border dark:border-slate-800">
            <Button type="button" variant="primary" size="md" onClick={handleClose} className="w-full font-bold">
              Done
            </Button>
          </div>
        </div>
      ) : createdRequest ? (
        /* ========================================================= */
        /* CASE C: PENDING ADMINISTRATOR APPROVAL STATE              */
        /* ========================================================= */
        <div className="space-y-4 py-2">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-3 shadow-xs">
              <Clock className="w-8 h-8" />
            </div>
            <Badge variant="warning" size="md" className="mb-1 font-bold">
              PENDING APPROVAL
            </Badge>
            <h3 className="text-base font-bold text-fintech-navy dark:text-white mt-1">
              Request Sent to Administrator for Approval
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-sm">
              Your request for <strong>{formatCurrency(createdRequest.amountPaise)}</strong> exceeds configured limits and has been delivered to <strong>{owner?.name || 'Administrator'}</strong> for review.
            </p>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Requested Amount:</span>
              <strong className="text-fintech-navy dark:text-white text-sm font-bold">
                {formatCurrency(createdRequest.amountPaise)}
              </strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Status:</span>
              <Badge variant="warning" size="sm">PENDING</Badge>
            </div>
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
              <span className="text-slate-600 dark:text-slate-400 block mb-0.5">Your Message:</span>
              <p className="text-slate-800 dark:text-slate-200 font-medium italic bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                "{createdRequest.message || createdRequest.purpose}"
              </p>
            </div>
            <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
              <span>Submitted by: {currentUser.name}</span>
              <span>Reviewer: {owner?.name || 'Rajesh Sharma'}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-fintech-border dark:border-slate-800">
            <Button type="button" variant="primary" size="md" onClick={handleClose} className="w-full font-bold">
              Done
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
};
