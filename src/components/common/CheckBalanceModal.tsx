import React, { useState, useEffect } from 'react';
import {
  Lock,
  ShieldCheck,
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle2,
  Wallet,
  Building,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Modal } from './Modal';
import { Button } from './Button';
import { Badge } from './Badge';
import { formatCurrency } from '../../utils/currency';
import { formatDateTime } from '../../utils/dates';

interface CheckBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBalanceRevealed?: () => void;
}

export const CheckBalanceModal: React.FC<CheckBalanceModalProps> = ({
  isOpen,
  onClose,
  onBalanceRevealed,
}) => {
  const {
    currentUser,
    family,
    ownerWallet,
    memberPersonalAccounts,
    getMemberConsumption,
    verifyUserPin,
    isCustomUser,
  } = useApp();

  const isOwner = currentUser.role === 'owner';
  const balancePaise = isOwner
    ? ownerWallet.balancePaise
    : memberPersonalAccounts[currentUser.id]?.balancePaise || 0;
  const consumption = getMemberConsumption(currentUser.id);

  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [verifiedAt, setVerifiedAt] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setShowPin(false);
      setError(null);
      setIsVerified(false);
      setVerifiedAt('');
    }
  }, [isOpen]);

  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!pin || pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      setError('Please enter your complete 6-digit transaction PIN.');
      return;
    }

    const isValid = verifyUserPin(pin);
    if (!isValid) {
      setError('Incorrect 6-digit transaction PIN. Identity verification failed; balance cannot be displayed.');
      setIsVerified(false);
      return;
    }

    setIsVerified(true);
    setVerifiedAt(new Date().toISOString());
    if (onBalanceRevealed) {
      onBalanceRevealed();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isVerified ? 'Account Balance Details' : 'Check Account Balance'}
      description={
        isVerified
          ? `Verified secure balance as of ${formatDateTime(verifiedAt)}`
          : 'Enter your 6-digit transaction PIN to view your verified account balance'
      }
      maxWidth="sm"
    >
      {!isVerified ? (
        // ====================================================================
        // STATE 1: PIN VERIFICATION FORM (Balance is Strictly Hidden)
        // ====================================================================
        <form onSubmit={handleVerifyPin} className="space-y-4">
          <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-xl text-xs text-fintech-navy dark:text-blue-100 flex items-start gap-2.5">
            <Lock className="w-5 h-5 text-fintech-primary dark:text-blue-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-fintech-navy dark:text-blue-200">PIN Verification Required</div>
              <p className="text-fintech-muted dark:text-blue-300 mt-0.5 leading-relaxed">
                For security and role privacy, enter your 6-digit transaction PIN to reveal your account balance.
              </p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-fintech-navy dark:text-slate-200">
                6-Digit Transaction PIN
              </label>
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="text-xs text-fintech-primary dark:text-blue-400 hover:underline flex items-center gap-1 font-medium"
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
                setError(null);
              }}
              className="w-full text-center text-2xl font-mono tracking-widest px-4 py-2.5 rounded-lg border border-fintech-border dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-fintech-primary bg-white dark:bg-slate-800 text-fintech-navy dark:text-white"
            />

            {error ? (
              <div className="mt-2 p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-fintech-error dark:text-red-300 rounded-lg text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            ) : !isCustomUser ? (
              <p className="text-[11px] text-fintech-muted dark:text-slate-400 mt-1 text-center">
                Demo default PIN: <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono font-bold text-fintech-primary dark:text-blue-400">123456</code>
              </p>
            ) : null}
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-fintech-border dark:border-slate-800">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={pin.length !== 6}
              icon={<ShieldCheck className="w-4 h-4" />}
            >
              Verify PIN
            </Button>
          </div>
        </form>
      ) : (
        // ====================================================================
        // STATE 2: VERIFIED BALANCE DISPLAY (Shown only after successful PIN)
        // ====================================================================
        <div className="space-y-4">
          <div className="p-5 bg-gradient-to-br from-fintech-deep to-fintech-navy text-white rounded-xl shadow-md space-y-3 relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center justify-between text-xs text-blue-200">
                <span className="font-semibold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-blue-300" />
                  {isOwner ? 'Administrator Account Balance' : 'Personal Account Balance'}
                </span>
                <Badge variant="success" size="sm" className="bg-emerald-500/20 text-emerald-200 border-emerald-400/30">
                  PIN Verified
                </Badge>
              </div>

              <div className="text-3xl font-bold tracking-tight text-white my-1">
                {formatCurrency(balancePaise)}
              </div>

              <p className="text-xs text-blue-100/80 leading-relaxed">
                {isOwner
                  ? `Administrator main account for ${family.name}. Source of funds transferred to family members and authorized payments.`
                  : `Individual funds belonging to ${currentUser.name}. Used for your direct payments and QR transactions.`}
              </p>
            </div>
          </div>

          {/* Breakdown / Role Information */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-fintech-muted dark:text-slate-400">Account Holder:</span>
              <strong className="text-fintech-navy dark:text-slate-100">{currentUser.name}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-fintech-muted dark:text-slate-400">Account Role:</span>
              <span className="text-fintech-primary dark:text-blue-400 font-semibold">
                {isOwner ? 'Family Administrator' : 'Family Member'}
              </span>
            </div>
            {isOwner ? (
              <>
                <div className="flex justify-between">
                  <span className="text-fintech-muted dark:text-slate-400">Family Group:</span>
                  <span className="text-fintech-text dark:text-slate-200 font-medium">{family.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-fintech-muted dark:text-slate-400">Funding Source:</span>
                  <span className="text-fintech-text dark:text-slate-200 font-medium">
                    {family.fundingSource || 'Verified Bank Account'}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-fintech-muted dark:text-slate-400">Today's Remaining Allowance:</span>
                  <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                    {formatCurrency(consumption.effectiveRemainingTodayPaise)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-fintech-muted dark:text-slate-400">Monthly Budget Remaining:</span>
                  <span className="text-fintech-navy dark:text-slate-100 font-bold">
                    {formatCurrency(consumption.remainingThisMonthPaise)}
                  </span>
                </div>
              </>
            )}
            <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400">
              <span>Verified Timestamp:</span>
              <span className="font-mono">{formatDateTime(verifiedAt)}</span>
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-fintech-border dark:border-slate-800">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={onClose}
              className="w-full sm:w-auto"
            >
              Done
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
