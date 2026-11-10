import React, { useState, useEffect } from 'react';
import { Send, User as UserIcon, AlertCircle, ShieldCheck, CheckCircle2, ChevronRight, Wallet } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatCurrency, toPaise } from '../../utils/currency';
import { Modal } from './Modal';
import { Button } from './Button';
import { Badge } from './Badge';
import { Transaction, User } from '../../types';
import { FintechTransactionModal } from '../fintech/FintechTransactionModal';
import { TransactionPinModal } from './TransactionPinModal';

interface SendMoneyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (transaction: Transaction) => void;
  initialMemberId?: string;
}

const PRESET_AMOUNTS = [500, 1000, 2000, 5000];

export const SendMoneyModal: React.FC<SendMoneyModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialMemberId,
}) => {
  const {
    ownerWallet,
    familyMembers,
    memberPersonalAccounts,
    spendingRules,
    getMemberSpending,
    sendMoney,
    isCustomUser,
  } = useApp();

  const members = familyMembers.filter((m) => m.role === 'member');

  const [selectedMemberId, setSelectedMemberId] = useState<string>(
    initialMemberId || members[0]?.id || ''
  );
  const [amountStr, setAmountStr] = useState('2000');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [animModal, setAnimModal] = useState<{
    isOpen: boolean;
    isProcessing: boolean;
    isSuccess: boolean;
    failureReason?: string;
    transaction?: Transaction | null;
  }>({
    isOpen: false,
    isProcessing: false,
    isSuccess: false,
  });

  // Sync initialMemberId if passed or modal re-opens
  useEffect(() => {
    if (initialMemberId && members.some((m) => m.id === initialMemberId)) {
      setSelectedMemberId(initialMemberId);
    } else if (!selectedMemberId && members.length > 0) {
      setSelectedMemberId(members[0].id);
    }
  }, [initialMemberId, isOpen, members]);

  const selectedMember = members.find((m) => m.id === selectedMemberId);
  const selectedAccount = selectedMember ? memberPersonalAccounts[selectedMember.id] : null;
  const selectedRule = selectedMember ? spendingRules[selectedMember.id] : null;
  const selectedSpending = selectedMember ? getMemberSpending(selectedMember.id) : { spentTodayPaise: 0, spentThisMonthPaise: 0 };

  const parsedPaise = toPaise(amountStr);

  // Validation checks (Using only 2 limits: Daily & Monthly)
  const exceedsAdminBalance = parsedPaise > ownerWallet.balancePaise;
  const isTransferDisabled = selectedRule ? !selectedRule.allowMoneyTransfer : false;
  const exceedsDailyLimit = selectedRule
    ? selectedSpending.spentTodayPaise + parsedPaise > selectedRule.dailyLimitPaise
    : false;
  const exceedsMonthlyLimit = selectedRule
    ? selectedSpending.spentThisMonthPaise + parsedPaise > selectedRule.monthlyLimitPaise
    : false;

  const hasValidationError =
    parsedPaise <= 0 ||
    exceedsAdminBalance ||
    isTransferDisabled ||
    exceedsDailyLimit ||
    exceedsMonthlyLimit;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!selectedMember) {
      setErrorMessage('Please select a family member.');
      return;
    }

    if (parsedPaise <= 0) {
      setErrorMessage('Please enter a valid transfer amount greater than ₹0.');
      return;
    }

    if (exceedsAdminBalance) {
      setErrorMessage(
        `Insufficient administrator balance. Available: ${formatCurrency(ownerWallet.balancePaise)}, Requested: ${formatCurrency(parsedPaise)}.`
      );
      return;
    }

    if (isTransferDisabled) {
      setErrorMessage(
        `Money transfers are disabled for ${selectedMember.name} in Spending Limits settings.`
      );
      return;
    }

    if (exceedsDailyLimit) {
      setErrorMessage(
        `Amount exceeds ${selectedMember.name}'s daily limit of ${formatCurrency(selectedRule!.dailyLimitPaise)}.`
      );
      return;
    }

    if (exceedsMonthlyLimit) {
      setErrorMessage(
        `Amount exceeds ${selectedMember.name}'s monthly limit of ${formatCurrency(selectedRule!.monthlyLimitPaise)}.`
      );
      return;
    }

    // Require transaction PIN verification before execution
    setIsPinModalOpen(true);
  };

  const handlePinSuccessAndExecute = async () => {
    if (!selectedMember) return;

    setIsSubmitting(true);
    setAnimModal({
      isOpen: true,
      isProcessing: true,
      isSuccess: false,
    });

    try {
      const transferNote = note.trim() || `Direct transfer from Administrator to ${selectedMember.name}`;
      const res = await sendMoney(selectedMember.id, parsedPaise, transferNote);

      if (res.success && res.transaction) {
        setAnimModal({
          isOpen: true,
          isProcessing: false,
          isSuccess: true,
          transaction: res.transaction,
        });
        onSuccess(res.transaction);
        setAmountStr('2000');
        setNote('');
      } else {
        setAnimModal({
          isOpen: true,
          isProcessing: false,
          isSuccess: false,
          failureReason: res.error || 'Transfer was declined by the rules engine.',
        });
      }
    } catch (err: any) {
      setAnimModal({
        isOpen: true,
        isProcessing: false,
        isSuccess: false,
        failureReason: err.message || 'An unexpected error occurred during money transfer.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Send Money to Family Member"
      description="Direct transfer from Administrator balance to Member Personal Account • Updates both accounts immediately"
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Administrator Balance Banner */}
        <div className="p-3.5 bg-slate-50 border border-fintech-border rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-fintech-deep text-white flex items-center justify-center font-bold text-sm">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-fintech-muted uppercase font-semibold">
                Administrator Available Balance
              </div>
              <div className="text-lg font-bold text-fintech-navy">
                {formatCurrency(ownerWallet.balancePaise)}
              </div>
            </div>
          </div>
          {!isCustomUser && (
            <Badge variant="simulated" size="sm">
              Simulated
            </Badge>
          )}
        </div>

        {/* Member Selector */}
        <div>
          <label className="block text-xs font-semibold text-fintech-navy mb-2">
            Select Family Member to Receive Money
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {members.map((member) => {
              const isSelected = member.id === selectedMemberId;
              const account = memberPersonalAccounts[member.id];
              const rule = spendingRules[member.id];
              const canTransfer = rule?.allowMoneyTransfer !== false;

              return (
                <div
                  key={member.id}
                  onClick={() => {
                    setSelectedMemberId(member.id);
                    setErrorMessage('');
                  }}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-fintech-primary bg-blue-50/70 ring-2 ring-fintech-primary/30 shadow-xs'
                      : 'border-fintech-border bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={member.avatarUrl}
                      alt={member.name}
                      className="w-10 h-10 rounded-full object-cover ring-1 ring-slate-200"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-fintech-text truncate">
                          {member.name}
                        </h4>
                        {isSelected && (
                          <CheckCircle2 className="w-4 h-4 text-fintech-primary shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-fintech-muted truncate">
                        {member.relationship}
                      </p>
                      <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-100">
                        <span className="text-[11px] font-semibold text-fintech-primary">
                          Personal Account: {formatCurrency(account?.balancePaise || 0)}
                        </span>
                        <span
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                            canTransfer
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {canTransfer ? 'Eligible' : 'Transfer Disabled'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Amount Input */}
        <div>
          <label className="block text-xs font-semibold text-fintech-navy mb-1.5">
            Transfer Amount (INR)
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-fintech-navy">
              ₹
            </span>
            <input
              type="number"
              min="1"
              step="any"
              value={amountStr}
              onChange={(e) => {
                setAmountStr(e.target.value);
                setErrorMessage('');
              }}
              placeholder="0.00"
              disabled={isSubmitting}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-fintech-border text-lg font-bold text-fintech-navy focus:outline-none focus:ring-2 focus:ring-fintech-primary focus:border-transparent transition-all"
            />
          </div>

          {/* Quick presets */}
          <div className="flex flex-wrap gap-2 mt-2.5">
            {PRESET_AMOUNTS.map((amt) => {
              const isSelected = parsedPaise === amt * 100;
              return (
                <button
                  key={amt}
                  type="button"
                  onClick={() => {
                    setAmountStr(amt.toString());
                    setErrorMessage('');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-fintech-primary text-white shadow-xs'
                      : 'bg-slate-100 text-fintech-text hover:bg-slate-200'
                  }`}
                >
                  {formatCurrency(amt * 100, { hideDecimalsIfZero: true })}
                </button>
              );
            })}
          </div>
        </div>

        {/* Note input */}
        <div>
          <label className="block text-xs font-semibold text-fintech-navy mb-1">
            Purpose / Transfer Memo
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Study books, pocket money, weekend snacks"
            maxLength={80}
            disabled={isSubmitting}
            className="w-full px-3.5 py-2 rounded-lg border border-fintech-border text-xs text-fintech-text focus:outline-none focus:ring-2 focus:ring-fintech-primary"
          />
        </div>

        {/* Live Validation Warnings */}
        {exceedsAdminBalance && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-fintech-error">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              <strong>Insufficient Funds:</strong> Transfer amount ({formatCurrency(parsedPaise)}) exceeds Administrator available balance ({formatCurrency(ownerWallet.balancePaise)}).
            </span>
          </div>
        )}

        {isTransferDisabled && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-fintech-error">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              <strong>Permission Disabled:</strong> Money transfers are disabled for {selectedMember?.name} in Spending Limits settings.
            </span>
          </div>
        )}

        {exceedsDailyLimit && !isTransferDisabled && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-800">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              <strong>Daily Spending Limit Exceeded:</strong> {selectedMember?.name}'s limit is {formatCurrency(selectedRule!.dailyLimitPaise)} (transfer is {formatCurrency(parsedPaise)}).
            </span>
          </div>
        )}

        {exceedsMonthlyLimit && !isTransferDisabled && !exceedsDailyLimit && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-800">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              <strong>Monthly Spending Limit Exceeded:</strong> {selectedMember?.name}'s limit is {formatCurrency(selectedRule!.monthlyLimitPaise)} (transfer is {formatCurrency(parsedPaise)}).
            </span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-fintech-error">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Transaction Summary Preview */}
        {selectedMember && parsedPaise > 0 && !hasValidationError && (
          <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl text-xs space-y-1.5">
            <div className="font-semibold text-fintech-navy flex items-center justify-between">
              <span>Transfer Preview</span>
              <span className="text-emerald-700 font-bold">Ready to Transfer</span>
            </div>
            <div className="flex justify-between text-fintech-muted">
              <span>Admin balance after transfer:</span>
              <span className="font-semibold text-fintech-text">
                {formatCurrency(Math.max(0, ownerWallet.balancePaise - parsedPaise))}
              </span>
            </div>
            <div className="flex justify-between text-fintech-muted">
              <span>{selectedMember.name}'s Personal Account after transfer:</span>
              <span className="font-semibold text-emerald-700">
                {formatCurrency((selectedAccount?.balancePaise || 0) + parsedPaise)}
              </span>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-fintech-border/70">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isSubmitting}
            disabled={hasValidationError || isSubmitting}
            icon={<Send className="w-4 h-4" />}
          >
            Send {formatCurrency(parsedPaise)} to {selectedMember ? selectedMember.name.split(' ')[0] : 'Member'}
          </Button>
        </div>
      </form>
    </Modal>

    {/* Transaction PIN Verification Modal */}
    <TransactionPinModal
      isOpen={isPinModalOpen}
      onClose={() => setIsPinModalOpen(false)}
      onSuccess={handlePinSuccessAndExecute}
      title="Authorize Family Transfer"
      description={`Enter PIN to transfer ${formatCurrency(parsedPaise)} to ${selectedMember ? selectedMember.name : 'Member'}`}
      actionLabel="Authorize & Transfer"
    />

    {/* Premium Animated Money Transfer Feedback Modal */}
    <FintechTransactionModal
      isOpen={animModal.isOpen}
      onClose={() => {
        const wasSuccess = animModal.isSuccess;
        setAnimModal((prev) => ({ ...prev, isOpen: false }));
        if (wasSuccess) {
          onClose();
        }
      }}
      flowType="send_money"
      amountPaise={parsedPaise}
      senderName="Administrator"
      recipientName={selectedMember ? selectedMember.name : 'Family Member'}
      recipientAvatar={selectedMember?.avatarUrl}
      isProcessing={animModal.isProcessing}
      isSuccess={animModal.isSuccess}
      failureReason={animModal.failureReason}
      transaction={animModal.transaction}
      onViewReceipt={onSuccess}
    />
  </>
  );
};

