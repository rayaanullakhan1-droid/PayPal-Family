import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  ShieldCheck,
  AlertCircle,
  Eye,
  EyeOff,
  User,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Sparkles,
  HandCoins,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Modal } from './Modal';
import { Button } from './Button';
import { Badge } from './Badge';
import { RequestExtraMoneyModal } from './RequestExtraMoneyModal';
import { CountrySelector } from './CountrySelector';
import { COUNTRIES, CountryData, validatePhoneNumber } from '../../utils/countries';
import { formatCurrency } from '../../utils/currency';
import { Transaction } from '../../types';

interface ToMobileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (transaction: Transaction) => void;
}

export const ToMobileModal: React.FC<ToMobileModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const {
    currentUser,
    family,
    familyMembers,
    ownerWallet,
    memberPersonalAccounts,
    spendingRules,
    payToMobile,
    submitLimitExceptionRequest,
    isCustomUser,
  } = useApp();

  const isOwner = currentUser.role === 'owner';
  const availableBalancePaise = isOwner
    ? ownerWallet.balancePaise
    : memberPersonalAccounts[currentUser.id]?.balancePaise || 0;

  // Step state: 1 = Input Details, 2 = Review & 6-Digit PIN
  const [step, setStep] = useState<1 | 2>(1);

  // Form state
  const [selectedCountry, setSelectedCountry] = useState<CountryData>(COUNTRIES[0]);
  const [mobileNumber, setMobileNumber] = useState('');
  const [amountRupees, setAmountRupees] = useState('');
  const [note, setNote] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);

  // Status & error states
  const [detectedRecipient, setDetectedRecipient] = useState<{
    name: string;
    isFamilyMember: boolean;
    relationship?: string;
  } | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Limit exception state (if member exceeds spending limit)
  const [overLimitState, setOverLimitState] = useState<{
    isOverLimit: boolean;
    reason: string;
    details?: {
      configuredLimitPaise: number;
      requestedAmountPaise: number;
      excessAmountPaise: number;
    };
  } | null>(null);
  const [exceptionSubmitting, setExceptionSubmitting] = useState(false);
  const [exceptionSubmitted, setExceptionSubmitted] = useState(false);
  const [exceptionMessage, setExceptionMessage] = useState('');
  const [isRequestExtraMoneyOpen, setIsRequestExtraMoneyOpen] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setMobileNumber('');
      setAmountRupees('');
      setNote('');
      setPin('');
      setShowPin(false);
      setPhoneError(null);
      setAmountError(null);
      setPinError(null);
      setDetectedRecipient(null);
      setOverLimitState(null);
      setExceptionSubmitting(false);
      setExceptionSubmitted(false);
      setSelectedCountry(COUNTRIES[0]);
    }
  }, [isOpen]);

  // Recipient auto-detection when typing phone
  useEffect(() => {
    const cleanDigits = mobileNumber.replace(/\D/g, '');
    if (!cleanDigits || cleanDigits.length < 5) {
      setDetectedRecipient(null);
      return;
    }

    // Match family members
    const matchedFamily = familyMembers.find((m) => {
      if (m.id === currentUser.id) return false;
      const mPhone = (m.phone || m.mobile || '').replace(/\D/g, '');
      return mPhone && (mPhone.endsWith(cleanDigits) || cleanDigits.endsWith(mPhone));
    });

    if (matchedFamily) {
      setDetectedRecipient({
        name: matchedFamily.name,
        isFamilyMember: true,
        relationship: matchedFamily.relationship,
      });
      return;
    }

    setDetectedRecipient(null);
  }, [mobileNumber, familyMembers, currentUser.id]);

  const amountPaise = Math.round((parseFloat(amountRupees) || 0) * 100);

  // Step 1 validation -> Advance to Step 2 (Review & PIN)
  const handleProceedToReview = (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError(null);
    setAmountError(null);

    // Validate phone number
    const phoneVal = validatePhoneNumber(mobileNumber, selectedCountry);
    if (!phoneVal.valid) {
      setPhoneError(phoneVal.error || `Please enter a valid phone number for ${selectedCountry.name}.`);
      return;
    }

    // Validate amount
    if (!amountRupees || isNaN(amountPaise) || amountPaise <= 0) {
      setAmountError('Please enter a valid amount greater than ₹0.');
      return;
    }

    if (amountPaise > availableBalancePaise) {
      setAmountError(
        `Insufficient balance. You have ${formatCurrency(availableBalancePaise)} available.`
      );
      return;
    }

    setStep(2);
  };

  // Step 2 validation -> Execute Payment
  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    setOverLimitState(null);

    if (!pin || pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      setPinError('Please enter your complete 6-digit transaction PIN.');
      return;
    }

    setIsSubmitting(true);
    try {
      const recipientDisplayName = detectedRecipient?.name;

      const res = await payToMobile({
        mobile: mobileNumber.trim(),
        countryCode: selectedCountry.dialCode,
        amountPaise,
        recipientName: recipientDisplayName,
        note: note.trim() || undefined,
        pin,
      });

      if (res.success && res.transaction) {
        onClose();
        onSuccess(res.transaction);
      } else if (res.isOverLimit) {
        // Exceeded configured spending limit
        setOverLimitState({
          isOverLimit: true,
          reason: res.error || 'Spending limit exceeded.',
          details: res.overLimitDetails,
        });
      } else {
        setPinError(res.error || 'Payment failed. Please verify your PIN and try again.');
      }
    } catch (err: any) {
      setPinError(err?.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Limit Exception Request (Preserves Request / Cancel Workflow)
  const handleSubmitException = async () => {
    if (!overLimitState?.details) return;
    setExceptionSubmitting(true);
    try {
      const defaultMsg = note.trim() || `Mobile transfer exception: ${selectedCountry.dialCode} ${mobileNumber}`;
      const res = await submitLimitExceptionRequest(
        amountPaise,
        exceptionMessage.trim() || defaultMsg,
        overLimitState.details.configuredLimitPaise,
        overLimitState.details.excessAmountPaise,
        exceptionMessage.trim() || defaultMsg
      );

      if (res.success) {
        setExceptionSubmitted(true);
      } else {
        setPinError(res.error || 'Failed to submit exception request.');
      }
    } catch (err: any) {
      setPinError(err?.message || 'Failed to submit exception request.');
    } finally {
      setExceptionSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="To Mobile Number"
      description="Send money directly to any mobile number with 6-digit PIN verification"
      maxWidth="md"
    >
      {step === 1 ? (
        // ====================================================================
        // STEP 1: ENTER RECIPIENT MOBILE NUMBER & PAYMENT AMOUNT
        // ====================================================================
        <form onSubmit={handleProceedToReview} className="space-y-4">
          {/* Account Balance Indicator */}
          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center justify-between text-xs">
            <span className="text-fintech-muted font-medium">
              Paying from {isOwner ? 'Administrator Pool' : 'Personal Account'}:
            </span>
            <span className="text-fintech-navy font-bold">{formatCurrency(availableBalancePaise)}</span>
          </div>

          {/* Country Selection */}
          <div>
            <label className="block text-xs font-semibold text-fintech-navy mb-1.5">
              Recipient Country Code
            </label>
            <CountrySelector
              selectedCountry={selectedCountry}
              onChange={(c) => {
                setSelectedCountry(c);
                setPhoneError(null);
              }}
            />
          </div>

          {/* Mobile Number Input */}
          <div>
            <label className="block text-xs font-semibold text-fintech-navy mb-1.5">
              Recipient Mobile Number
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-xs font-mono font-semibold text-slate-500">
                {selectedCountry.dialCode}
              </span>
              <input
                type="tel"
                required
                value={mobileNumber}
                placeholder={selectedCountry.placeholder}
                onChange={(e) => {
                  setMobileNumber(e.target.value);
                  setPhoneError(null);
                }}
                className="w-full pl-16 pr-3.5 py-2.5 rounded-lg border border-fintech-border text-sm focus:outline-none focus:ring-2 focus:ring-fintech-primary bg-white font-mono"
              />
            </div>
            {phoneError ? (
              <p className="text-[11px] text-red-600 mt-1 font-medium">{phoneError}</p>
            ) : detectedRecipient ? (
              <div className="mt-1.5 p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Verified: <strong>{detectedRecipient.name}</strong> ({detectedRecipient.relationship || 'Family Member'})
                </span>
              </div>
            ) : (
              <p className="text-[11px] text-fintech-muted mt-1">
                Format: {selectedCountry.minDigits === selectedCountry.maxDigits ? `${selectedCountry.minDigits} digits` : `${selectedCountry.minDigits}-${selectedCountry.maxDigits} digits`} (e.g. {selectedCountry.placeholder})
              </p>
            )}
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-xs font-semibold text-fintech-navy mb-1.5">
              Payment Amount (₹)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-base font-bold text-fintech-navy">₹</span>
              <input
                type="number"
                required
                min="1"
                step="any"
                placeholder="0.00"
                value={amountRupees}
                onChange={(e) => {
                  setAmountRupees(e.target.value);
                  setAmountError(null);
                }}
                className="w-full pl-8 pr-3.5 py-2.5 rounded-lg border border-fintech-border text-base font-bold text-fintech-navy focus:outline-none focus:ring-2 focus:ring-fintech-primary bg-white"
              />
            </div>
            {amountError && (
              <p className="text-[11px] text-red-600 mt-1 font-medium">{amountError}</p>
            )}
          </div>

          {/* Note / Purpose */}
          <div>
            <label className="block text-xs font-semibold text-fintech-navy mb-1.5">
              Payment Note (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. College books, groceries, rent"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg border border-fintech-border text-xs focus:outline-none focus:ring-2 focus:ring-fintech-primary bg-white"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-fintech-border">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Review Payment &rarr;
            </Button>
          </div>
        </form>
      ) : (
        // ====================================================================
        // STEP 2: PAYMENT REVIEW & MANDATORY 6-DIGIT TRANSACTION PIN
        // ====================================================================
        <form onSubmit={handleConfirmPayment} className="space-y-4">
          {/* Over-Limit Exception Card (if spending limit triggered) */}
          {overLimitState && (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-3">
              <div className="flex items-start gap-2 text-amber-900">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold">Spending Limit Exceeded</div>
                  <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                    {overLimitState.reason}
                  </p>
                  {overLimitState.details && (
                    <div className="mt-2 text-[11px] space-y-0.5 font-medium">
                      <div>Configured Limit: <strong>{formatCurrency(overLimitState.details.configuredLimitPaise)}</strong></div>
                      <div>Requested Amount: <strong>{formatCurrency(overLimitState.details.requestedAmountPaise)}</strong></div>
                      <div className="text-red-700 font-bold">Excess: +{formatCurrency(overLimitState.details.excessAmountPaise)}</div>
                    </div>
                  )}
                </div>
              </div>

              {!exceptionSubmitted && (
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-amber-900 block">
                    Message to Administrator (Explain why extra funds / limit exception is needed):
                  </label>
                  <textarea
                    rows={2}
                    value={exceptionMessage}
                    onChange={(e) => setExceptionMessage(e.target.value)}
                    placeholder="Explain why you need additional funds for this mobile transfer..."
                    className="w-full p-2 text-xs border border-amber-300 rounded-lg bg-white resize-none"
                  />
                </div>
              )}

              {exceptionSubmitted ? (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Limit exception request submitted to Administrator for approval!</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    className="bg-amber-600 hover:bg-amber-700 text-white text-xs"
                    disabled={exceptionSubmitting}
                    onClick={handleSubmitException}
                  >
                    {exceptionSubmitting ? 'Submitting...' : 'Request Limit Exception'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setOverLimitState(null)}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Payment Review Summary Box */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
              <span className="text-xs text-fintech-muted font-medium">Recipient:</span>
              <span className="text-xs font-bold text-fintech-navy">
                {detectedRecipient ? detectedRecipient.name : `Mobile Contact`}
              </span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
              <span className="text-xs text-fintech-muted font-medium">Mobile Number:</span>
              <span className="text-xs font-mono font-bold text-fintech-navy">
                {selectedCountry.flag} {selectedCountry.dialCode} {mobileNumber}
              </span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
              <span className="text-xs text-fintech-muted font-medium">Paying From:</span>
              <Badge variant={isCustomUser ? 'primary' : 'simulated'} size="sm">
                {isOwner ? `Administrator Account (${family.name})` : `Personal Account (${currentUser.name})`}
              </Badge>
            </div>
            {note && (
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                <span className="text-xs text-fintech-muted font-medium">Note:</span>
                <span className="text-xs text-fintech-navy italic">{note}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-1">
              <span className="text-sm font-bold text-fintech-navy">Total Debit:</span>
              <span className="text-xl font-bold text-fintech-primary">{formatCurrency(amountPaise)}</span>
            </div>
          </div>

          {/* 6-Digit Transaction PIN Input */}
          {!overLimitState && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-fintech-navy flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-fintech-primary" />
                  Enter 6-Digit Transaction PIN
                </label>
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="text-xs text-fintech-primary hover:underline flex items-center gap-1"
                >
                  {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showPin ? 'Hide' : 'Show'}</span>
                </button>
              </div>

              <input
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                required
                autoFocus
                placeholder="••••••"
                value={pin}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setPin(val);
                  setPinError(null);
                }}
                className="w-full text-center text-xl font-mono tracking-widest px-4 py-2.5 rounded-lg border border-fintech-border focus:outline-none focus:ring-2 focus:ring-fintech-primary bg-white"
              />
              {pinError ? (
                <div className="mt-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-700 space-y-1.5 text-left">
                  <p className="font-medium">{pinError}</p>
                  {!isOwner && (
                    <div className="pt-1.5 border-t border-red-200/80 flex items-center justify-between">
                      <span>Need more funds for this transfer?</span>
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
                </div>
              ) : (
                <p className="text-[11px] text-fintech-muted mt-1 text-center">
                  Protected with salted cryptographic verification{!isCustomUser && ' (Default demo PIN: 123456)'}
                </p>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between items-center gap-2.5 pt-3 border-t border-fintech-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={<ArrowLeft className="w-4 h-4" />}
              onClick={() => {
                setStep(1);
                setPinError(null);
                setOverLimitState(null);
              }}
            >
              Back
            </Button>
            {!overLimitState && (
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isSubmitting || pin.length !== 6}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isSubmitting ? 'Authorizing Payment...' : `Authorize & Pay ${formatCurrency(amountPaise)}`}
              </Button>
            )}
          </div>
        </form>
      )}

      {/* Request Extra Money Modal for Insufficient Funds */}
      <RequestExtraMoneyModal
        isOpen={isRequestExtraMoneyOpen}
        onClose={() => setIsRequestExtraMoneyOpen(false)}
        initialAmountPaise={
          !isOwner
            ? Math.max(0, amountPaise - (memberPersonalAccounts[currentUser.id]?.balancePaise || 0))
            : undefined
        }
        shortfallPaise={
          !isOwner
            ? Math.max(0, amountPaise - (memberPersonalAccounts[currentUser.id]?.balancePaise || 0))
            : undefined
        }
        currentBalancePaise={!isOwner ? memberPersonalAccounts[currentUser.id]?.balancePaise || 0 : undefined}
        requiredAmountPaise={amountPaise}
        sourceContext={`Mobile Transfer to ${selectedCountry.dialCode} ${mobileNumber}`}
        initialMessage={`Need additional funds for mobile transfer to ${detectedRecipient?.name || mobileNumber}`}
        onSuccess={() => {
          setPinError(null);
        }}
      />
    </Modal>
  );
};
