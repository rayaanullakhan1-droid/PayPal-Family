import React, { useState } from 'react';
import { XCircle, AlertTriangle, Send, X, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '../../utils/currency';
import { Modal } from './Modal';
import { Button } from './Button';
import { Badge } from './Badge';

interface OverLimitRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  configuredLimitPaise: number;
  requestedAmountPaise: number;
  excessAmountPaise: number;
  purpose: string;
  onConfirmSendToAdmin: (customMessage?: string) => Promise<void> | void;
}

export const OverLimitRequestModal: React.FC<OverLimitRequestModalProps> = ({
  isOpen,
  onClose,
  configuredLimitPaise,
  requestedAmountPaise,
  excessAmountPaise,
  purpose,
  onConfirmSendToAdmin,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);
  const [customMessage, setCustomMessage] = useState(purpose || '');

  React.useEffect(() => {
    if (isOpen) {
      setCustomMessage(purpose || '');
      setSentSuccess(false);
      setIsSubmitting(false);
    }
  }, [isOpen, purpose]);

  const handleYes = async () => {
    setIsSubmitting(true);
    try {
      await onConfirmSendToAdmin(customMessage.trim() || purpose);
      setSentSuccess(true);
    } catch {
      // error handled
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSentSuccess(false);
    setIsSubmitting(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Request Outcome: Limit Check"
      description="Simulated fintech limit enforcement"
      maxWidth="md"
    >
      <div className="space-y-5">
        {!sentSuccess ? (
          <>
            {/* Failed Receipt Header */}
            <div className="flex flex-col items-center justify-center pt-2 pb-3 text-center border-b border-fintech-border/70 dark:border-slate-800">
              <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 flex items-center justify-center text-fintech-error dark:text-red-400 mb-3 shadow-xs">
                <XCircle className="w-8 h-8" />
              </div>
              <Badge variant="error" size="md" className="mb-1 font-bold">
                REQUEST FAILED
              </Badge>
              <h3 className="text-base font-bold text-fintech-navy dark:text-slate-100 mt-1">
                Your requested amount exceeds your configured request limit.
              </h3>
              <p className="text-xs text-fintech-muted dark:text-slate-400 mt-0.5">
                No money has been transferred from the Administrator. Your personal balance remains unchanged.
              </p>
            </div>

            {/* Breakdown Box mandated by Requirement 3 */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-200/70 dark:border-slate-700/60">
                <span className="text-fintech-muted dark:text-slate-400 font-medium">Configured Limit:</span>
                <span className="font-bold text-fintech-navy dark:text-slate-100 text-sm">
                  {formatCurrency(configuredLimitPaise)}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/70 dark:border-slate-700/60">
                <span className="text-fintech-muted dark:text-slate-400 font-medium">Requested Amount:</span>
                <span className="font-bold text-red-600 dark:text-red-400 text-sm">
                  {formatCurrency(requestedAmountPaise)}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-amber-800 dark:text-amber-300 font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  Excess Amount:
                </span>
                <span className="font-bold text-amber-700 dark:text-amber-400 text-sm">
                  +{formatCurrency(excessAmountPaise)}
                </span>
              </div>
              {purpose && (
                <div className="pt-2 border-t border-slate-200/70 dark:border-slate-700/60 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="font-medium text-fintech-navy dark:text-slate-200">Purpose:</span> {purpose}
                </div>
              )}
            </div>

            {/* Message to Administrator (Reason) */}
            <div className="space-y-1.5 text-left">
              <label className="block text-xs font-semibold text-fintech-navy dark:text-slate-200">
                Message to Administrator (Explain why extra funds / limit exception is needed):
              </label>
              <textarea
                rows={2}
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Explain why you need additional money (e.g. semester textbooks, emergency expense)..."
                className="w-full p-2.5 text-xs text-fintech-navy dark:text-slate-100 border border-fintech-border dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-fintech-primary/30 focus:border-fintech-primary bg-white dark:bg-slate-900 resize-none"
              />
            </div>

            {/* Choice Section: REQUEST or CANCEL */}
            <div className="p-4 bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl text-center space-y-3">
              <p className="text-xs font-bold text-amber-950 dark:text-amber-200">
                This transaction exceeds your configured spending limit. Submit a limit-exception request to the Administrator?
              </p>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  isLoading={isSubmitting}
                  disabled={isSubmitting}
                  onClick={handleYes}
                  icon={<Send className="w-4 h-4" />}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold tracking-wide"
                >
                  REQUEST
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  disabled={isSubmitting}
                  onClick={handleClose}
                  className="w-full text-slate-700 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-800 font-bold tracking-wide"
                >
                  CANCEL
                </Button>
              </div>
              <p className="text-[10px] text-amber-800 dark:text-amber-400">
                Selecting REQUEST submits this to the Administrator approval queue. Selecting CANCEL cancels the transaction with zero changes.
              </p>
            </div>
          </>
        ) : (
          /* Confirmation when YES was clicked */
          <div className="text-center py-4 space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-fintech-navy dark:text-slate-100">
                Limit Exception Request Sent
              </h3>
              <p className="text-xs text-fintech-muted dark:text-slate-400 mt-1 max-w-sm mx-auto">
                Your request for <strong>{formatCurrency(requestedAmountPaise)}</strong> has been sent to the Family Administrator for review. Balances will update if approved.
              </p>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-left text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-fintech-muted dark:text-slate-400">Status:</span>
                <Badge variant="warning" size="sm">PENDING APPROVAL</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-fintech-muted dark:text-slate-400">Excess Amount:</span>
                <span className="font-semibold text-amber-700 dark:text-amber-400">+{formatCurrency(excessAmountPaise)}</span>
              </div>
              {customMessage && (
                <div className="pt-1.5 border-t border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 italic">
                  "{customMessage}"
                </div>
              )}
            </div>

            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={handleClose}
              className="w-full"
            >
              Done
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
};

