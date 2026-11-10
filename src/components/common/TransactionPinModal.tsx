import React, { useState, useEffect, useRef } from 'react';
import { Lock, ShieldCheck, AlertCircle, KeyRound, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { useApp } from '../../context/AppContext';
import { validatePinFormat } from '../../utils/security';
import { formatCurrency } from '../../utils/currency';

interface TransactionPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  amountPaise?: number;
  title?: string;
  description?: string;
  actionLabel?: string;
}

export const TransactionPinModal: React.FC<TransactionPinModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  amountPaise,
  title = 'Enter Transaction PIN',
  description = 'Authorize this financial transaction using your 6-digit PIN',
  actionLabel = 'Authorize Payment',
}) => {
  const { currentUser, verifyUserPin, setUserPin } = useApp();

  const isPinConfigured = Boolean(currentUser.hasTransactionPin);

  // Verification state
  const [pinDigits, setPinDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [showPin, setShowPin] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Setup state (if user does not have PIN yet)
  const [isSetupMode, setIsSetupMode] = useState(!isPinConfigured);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [setupSuccess, setSetupSuccess] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (isOpen) {
      setPinDigits(['', '', '', '', '', '']);
      setErrorMessage('');
      setIsSubmitting(false);
      setIsSetupMode(!currentUser.hasTransactionPin);
      setNewPin('');
      setConfirmPin('');
      setSetupSuccess(false);

      setTimeout(() => {
        if (inputRefs.current[0]) {
          inputRefs.current[0].focus();
        }
      }, 150);
    }
  }, [isOpen, currentUser.hasTransactionPin]);

  const handleDigitChange = (index: number, value: string) => {
    // Only accept numeric digit
    const cleaned = value.replace(/\D/g, '');
    if (!cleaned && value !== '') return;

    const newDigits = [...pinDigits];
    newDigits[index] = cleaned.slice(-1);
    setPinDigits(newDigits);
    setErrorMessage('');

    // Auto-advance to next box
    if (cleaned && index < 5 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pinDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length > 0) {
      const newDigits = [...pinDigits];
      for (let i = 0; i < 6; i++) {
        newDigits[i] = pasted[i] || '';
      }
      setPinDigits(newDigits);
      const nextIndex = Math.min(pasted.length, 5);
      inputRefs.current[nextIndex]?.focus();
    }
  };

  const enteredPinString = pinDigits.join('');

  const handleVerifySubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage('');

    if (enteredPinString.length !== 6) {
      setErrorMessage('Please enter all 6 numeric digits of your transaction PIN.');
      return;
    }

    setIsSubmitting(true);

    const isValid = verifyUserPin(enteredPinString);
    if (!isValid) {
      setIsSubmitting(false);
      setErrorMessage('Incorrect 6-digit transaction PIN. Please try again.');
      setPinDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      return;
    }

    // Success
    setIsSubmitting(false);
    onSuccess();
    onClose();
  };

  const handleSetupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const val = validatePinFormat(newPin);
    if (!val.valid) {
      setErrorMessage(val.error || 'PIN must be 6 numeric digits.');
      return;
    }

    if (newPin !== confirmPin) {
      setErrorMessage('Confirmation PIN does not match. Please verify both entries.');
      return;
    }

    const res = setUserPin(newPin);
    if (!res.success) {
      setErrorMessage(res.error || 'Failed to set PIN.');
      return;
    }

    setSetupSuccess(true);
    setTimeout(() => {
      setIsSetupMode(false);
      setSetupSuccess(false);
      onSuccess();
      onClose();
    }, 900);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isSetupMode ? 'Create Six-Digit Transaction PIN' : title}
      description={
        isSetupMode
          ? 'Set up a secure 6-digit PIN required for all financial transactions'
          : description
      }
      maxWidth="sm"
    >
      <div className="space-y-5">
        {isSetupMode ? (
          /* ========================================================= */
          /* PIN SETUP FORM                                            */
          /* ========================================================= */
          <form onSubmit={handleSetupSubmit} className="space-y-4">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-fintech-navy flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-fintech-primary shrink-0 mt-0.5" />
              <span>
                Your 6-digit transaction PIN is cryptographically salted and hashed (SHA-256). It is never stored or transmitted in plain text.
              </span>
            </div>

            {setupSuccess ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <div className="font-bold text-sm">PIN Created Successfully!</div>
                <div className="text-xs text-emerald-700">Authorizing transaction...</div>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-semibold text-fintech-navy mb-1">
                    Enter New 6-Digit PIN
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="••••••"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-fintech-border text-center font-mono text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-fintech-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-fintech-navy mb-1">
                    Confirm 6-Digit PIN
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="••••••"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-fintech-border text-center font-mono text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-fintech-primary"
                  />
                </div>

                {errorMessage && (
                  <div className="p-3 bg-red-50 border border-red-200 text-xs text-fintech-error rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" size="sm" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={newPin.length !== 6 || confirmPin.length !== 6}
                  >
                    Save PIN & Authorize
                  </Button>
                </div>
              </>
            )}
          </form>
        ) : (
          /* ========================================================= */
          /* PIN VERIFICATION FORM                                     */
          /* ========================================================= */
          <form onSubmit={handleVerifySubmit} className="space-y-4">
            {amountPaise && amountPaise > 0 ? (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-center">
                <div className="text-[10px] text-fintech-muted dark:text-slate-400 uppercase font-semibold">Authorizing Amount</div>
                <div className="text-xl font-bold text-fintech-navy dark:text-slate-100 font-mono mt-0.5">
                  {formatCurrency(amountPaise)}
                </div>
              </div>
            ) : (
              <div className="flex justify-center my-2">
                <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-fintech-primary dark:text-blue-400 flex items-center justify-center">
                  <Lock className="w-6 h-6" />
                </div>
              </div>
            )}

            <div className="text-center">
              <div className="text-xs text-fintech-muted dark:text-slate-400 mb-3">
                Enter your 6-digit transaction PIN to confirm this action:
              </div>

              {/* 6 Digit Box Inputs */}
              <div className="flex justify-center gap-2 sm:gap-2.5" onPaste={handlePaste}>
                {pinDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (inputRefs.current[idx] = el)}
                    type={showPin ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    className="w-10 h-12 sm:w-11 sm:h-12 text-center text-xl font-bold font-mono rounded-xl border border-fintech-border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-fintech-primary text-fintech-navy dark:text-slate-100 shadow-xs transition-all"
                  />
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between px-2">
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="text-[11px] text-fintech-primary dark:text-blue-400 hover:underline flex items-center gap-1 font-medium"
                >
                  {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {showPin ? 'Hide PIN' : 'Show PIN'}
                </button>

                {/* Demo Helper Hint */}
                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                  Demo PIN: <strong className="text-slate-700 dark:text-slate-200">123456</strong>
                </span>
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-fintech-error dark:text-red-300 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isSubmitting}
                disabled={enteredPinString.length !== 6 || isSubmitting}
                className="px-5 font-bold"
              >
                {actionLabel}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};
