import React, { useState } from 'react';
import {
  CreditCard,
  Building,
  ShoppingBag,
  Zap,
  GraduationCap,
  HeartPulse,
  Landmark,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatCurrency, toPaise } from '../../utils/currency';
import { Modal } from './Modal';
import { Button } from './Button';
import { Badge } from './Badge';
import { TransactionPinModal } from './TransactionPinModal';
import { TransactionReceiptModal } from './TransactionReceiptModal';
import { Transaction } from '../../types';

interface SpendMoneyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (transaction: Transaction) => void;
}

const SPENDING_CATEGORIES = [
  { id: 'Utilities', label: 'Utilities & Bills', icon: Zap },
  { id: 'Groceries', label: 'Groceries & Mart', icon: ShoppingBag },
  { id: 'Education', label: 'School & Tuition', icon: GraduationCap },
  { id: 'Healthcare', label: 'Healthcare & Pharmacy', icon: HeartPulse },
  { id: 'General', label: 'General Expense', icon: Building },
];

const PRESET_AMOUNTS = [500, 1500, 3000, 5000, 10000];

export const SpendMoneyModal: React.FC<SpendMoneyModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { ownerWallet, spendMoney, currentUser } = useApp();

  const [step, setStep] = useState<'details' | 'review'>('details');
  const [amountStr, setAmountStr] = useState('1500');
  const [recipient, setRecipient] = useState('');
  const [category, setCategory] = useState('Utilities');
  const [paymentMethod, setPaymentMethod] = useState<'bank' | 'card'>('bank');
  const [memo, setMemo] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedTxn, setCompletedTxn] = useState<Transaction | null>(null);

  const parsedPaise = toPaise(amountStr);
  const exceedsBalance = parsedPaise > ownerWallet.balancePaise;

  const handleProceedToReview = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (parsedPaise <= 0) {
      setErrorMessage('Please enter a spending amount greater than ₹0.');
      return;
    }

    if (!recipient.trim()) {
      setErrorMessage('Please enter a recipient or payment description (e.g. Electric Board, School).');
      return;
    }

    if (exceedsBalance) {
      setErrorMessage(
        `Insufficient balance in Administrator Account. Available: ${formatCurrency(ownerWallet.balancePaise)}.`
      );
      return;
    }

    setStep('review');
  };

  const handleOpenPinVerification = () => {
    setIsPinModalOpen(true);
  };

  const handlePinSuccessAndExecute = async () => {
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const res = await spendMoney(
        parsedPaise,
        recipient.trim(),
        category,
        memo.trim() || `${category} payment to ${recipient.trim()}`
      );

      if (res.success && res.transaction) {
        setCompletedTxn(res.transaction);
        if (onSuccess) onSuccess(res.transaction);
        handleClose();
      } else {
        setErrorMessage(res.error || 'Failed to complete spending transaction.');
        setStep('details');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Transaction execution failed.');
      setStep('details');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setStep('details');
    setErrorMessage('');
    setIsSubmitting(false);
    onClose();
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title={step === 'details' ? 'Administrator Spend Money' : 'Review & Confirm Payment'}
        description={
          step === 'details'
            ? 'Spend funds directly from the central family account for household expenses, bills, or purchases'
            : 'Carefully verify recipient and amount before final transaction PIN authorization'
        }
        maxWidth="md"
      >
        {step === 'details' ? (
          /* ========================================================= */
          /* STEP 1: PAYMENT DETAILS ENTRY                             */
          /* ========================================================= */
          <form onSubmit={handleProceedToReview} className="space-y-4">
            {/* Administrator Account Balance Display */}
            <div className="p-3.5 bg-gradient-to-r from-fintech-deep to-fintech-navy text-white rounded-xl flex items-center justify-between shadow-xs">
              <div>
                <div className="text-[10px] text-blue-200 uppercase tracking-wider font-semibold">
                  Administrator Account Available
                </div>
                <div className="text-2xl font-bold tracking-tight">
                  {formatCurrency(ownerWallet.balancePaise)}
                </div>
              </div>
              <Badge variant="primary" size="sm" className="bg-white/15 text-white border-white/25">
                Funding Account
              </Badge>
            </div>

            {/* Amount Input */}
            <div>
              <label className="block text-xs font-semibold text-fintech-navy mb-1">
                Payment Amount (INR)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-fintech-muted">
                  ₹
                </span>
                <input
                  type="number"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  placeholder="1500"
                  min="1"
                  step="1"
                  className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-fintech-border text-base font-bold text-fintech-navy focus:outline-none focus:ring-2 focus:ring-fintech-primary"
                />
              </div>

              {/* Preset buttons */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {PRESET_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      setAmountStr(amt.toString());
                      setErrorMessage('');
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      parsedPaise === amt * 100
                        ? 'bg-fintech-primary text-white'
                        : 'bg-slate-100 text-fintech-text hover:bg-slate-200'
                    }`}
                  >
                    +{formatCurrency(amt * 100, { hideDecimalsIfZero: true })}
                  </button>
                ))}
              </div>
            </div>

            {/* Recipient / Merchant */}
            <div>
              <label className="block text-xs font-semibold text-fintech-navy mb-1">
                Recipient or Merchant Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="e.g. Tata Power Electricity, D-Mart Supermarket, College Tuition"
                maxLength={60}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-fintech-border text-xs text-fintech-text focus:outline-none focus:ring-2 focus:ring-fintech-primary"
              />
            </div>

            {/* Category Selector */}
            <div>
              <label className="block text-xs font-semibold text-fintech-navy mb-1.5">
                Expense Category
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {SPENDING_CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className={`p-2 rounded-xl border text-left flex items-center gap-2 transition-all ${
                        isSelected
                          ? 'border-fintech-primary bg-blue-50/70 ring-1 ring-fintech-primary text-fintech-primary font-bold'
                          : 'border-fintech-border bg-white text-fintech-text hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="text-xs truncate">{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Payment Method Selector */}
            <div>
              <label className="block text-xs font-semibold text-fintech-navy mb-1.5">
                Payment Channel
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label
                  className={`p-2.5 rounded-xl border cursor-pointer flex items-center gap-2.5 transition-all ${
                    paymentMethod === 'bank'
                      ? 'border-fintech-primary bg-blue-50/60 ring-1 ring-fintech-primary'
                      : 'border-fintech-border bg-white hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="spendMethod"
                    checked={paymentMethod === 'bank'}
                    onChange={() => setPaymentMethod('bank')}
                    className="sr-only"
                  />
                  <Landmark className="w-4 h-4 text-fintech-primary" />
                  <div>
                    <div className="text-xs font-bold text-fintech-navy">Direct Bank Debit</div>
                    <div className="text-[10px] text-fintech-muted">Administrator Account</div>
                  </div>
                </label>

                <label
                  className={`p-2.5 rounded-xl border cursor-pointer flex items-center gap-2.5 transition-all ${
                    paymentMethod === 'card'
                      ? 'border-fintech-primary bg-blue-50/60 ring-1 ring-fintech-primary'
                      : 'border-fintech-border bg-white hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="spendMethod"
                    checked={paymentMethod === 'card'}
                    onChange={() => setPaymentMethod('card')}
                    className="sr-only"
                  />
                  <CreditCard className="w-4 h-4 text-indigo-600" />
                  <div>
                    <div className="text-xs font-bold text-fintech-navy">Family Debit Card</div>
                    <div className="text-[10px] text-fintech-muted">Visa Debit (•••• 4242)</div>
                  </div>
                </label>
              </div>
            </div>

            {/* Memo */}
            <div>
              <label className="block text-xs font-semibold text-fintech-navy mb-1">
                Memo / Note (Optional)
              </label>
              <input
                type="text"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="e.g. Monthly electricity bill for family home"
                maxLength={80}
                className="w-full px-3.5 py-2 rounded-lg border border-fintech-border text-xs text-fintech-text focus:outline-none focus:ring-2 focus:ring-fintech-primary"
              />
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 text-xs text-fintech-error rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
              <Button type="button" variant="outline" size="sm" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={parsedPaise <= 0 || !recipient.trim() || exceedsBalance}
              >
                Review Payment &rarr;
              </Button>
            </div>
          </form>
        ) : (
          /* ========================================================= */
          /* STEP 2: REVIEW PAYMENT INFORMATION & TRIGGER PIN          */
          /* ========================================================= */
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                <span className="text-xs text-fintech-muted">Recipient / Merchant:</span>
                <span className="text-sm font-bold text-fintech-navy">{recipient}</span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                <span className="text-xs text-fintech-muted">Expense Category:</span>
                <Badge variant="primary" size="sm">{category}</Badge>
              </div>

              <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                <span className="text-xs text-fintech-muted">Payment Channel:</span>
                <span className="text-xs font-semibold text-fintech-navy">
                  {paymentMethod === 'bank' ? 'Direct Bank Debit' : 'Family Debit Card'}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                <span className="text-xs text-fintech-muted">Funding Account:</span>
                <span className="text-xs font-semibold text-fintech-navy">
                  Administrator Account (Available: {formatCurrency(ownerWallet.balancePaise)})
                </span>
              </div>

              {memo && (
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                  <span className="text-xs text-fintech-muted">Memo / Reference:</span>
                  <span className="text-xs text-slate-700 italic">{memo}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <span className="text-sm font-bold text-fintech-navy">Total Debit Amount:</span>
                <span className="text-2xl font-black text-red-600 font-mono">
                  -{formatCurrency(parsedPaise)}
                </span>
              </div>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-fintech-navy flex items-start gap-2">
              <Lock className="w-4 h-4 text-fintech-primary shrink-0 mt-0.5" />
              <span>
                To execute this spending transaction, your 6-digit transaction PIN will be verified. Funds will be deducted immediately from the central account.
              </span>
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 text-xs text-fintech-error rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <Button type="button" variant="outline" size="sm" onClick={() => setStep('details')}>
                &larr; Back to Details
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleOpenPinVerification}
                isLoading={isSubmitting}
                className="bg-emerald-600 hover:bg-emerald-700 font-bold"
              >
                Confirm & Enter PIN
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Transaction PIN Verification Modal */}
      <TransactionPinModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onSuccess={handlePinSuccessAndExecute}
        title="Authorize Administrator Spending"
        description={`Enter PIN to confirm spending ${formatCurrency(parsedPaise)} to ${recipient}`}
        actionLabel="Authorize & Pay"
      />

      {/* Success Receipt Modal */}
      <TransactionReceiptModal
        transaction={completedTxn}
        isOpen={Boolean(completedTxn)}
        onClose={() => setCompletedTxn(null)}
      />
    </>
  );
};

