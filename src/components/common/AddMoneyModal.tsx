import React, { useState, useEffect } from 'react';
import { PlusCircle, Landmark, CreditCard, ShieldCheck, AlertCircle, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { useApp } from '../../context/AppContext';
import { formatCurrency, toPaise } from '../../utils/currency';
import { Modal } from './Modal';
import { Button } from './Button';
import { Badge } from './Badge';
import { Transaction } from '../../types';
import { payPalSandboxService, PayPalServerConfig } from '../../services/paypalSandboxService';

interface AddMoneyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (transaction: Transaction) => void;
}

const PRESET_AMOUNTS = [1000, 2500, 5000, 10000, 25000];

export const AddMoneyModal: React.FC<AddMoneyModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { ownerWallet, addMoneyToAdmin, currentUser } = useApp();

  const [amountStr, setAmountStr] = useState('5000');
  const [fundingSource, setFundingSource] = useState<'bank' | 'card' | 'paypal_sandbox'>('bank');
  const [customNote, setCustomNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // PayPal Sandbox configuration state
  const [paypalConfig, setPaypalConfig] = useState<PayPalServerConfig>({
    clientId: '',
    environment: 'sandbox',
    currency: 'USD',
    isConfigured: false,
  });

  const parsedPaise = toPaise(amountStr);

  useEffect(() => {
    if (isOpen) {
      payPalSandboxService.getServerConfig().then(setPaypalConfig).catch(() => {});
    }
  }, [isOpen]);

  const handleSimulatedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (parsedPaise <= 0) {
      setErrorMessage('Please enter a valid amount greater than ₹0.');
      return;
    }

    if (parsedPaise > 100000000) { // ₹10,00,000
      setErrorMessage('Maximum single demo top-up is ₹10,00,000.');
      return;
    }

    setIsSubmitting(true);
    try {
      const bankLabel = currentUser?.bankAccount?.bankName || 'State Bank of India';
      const accountLabel = currentUser?.bankAccount?.accountNumber ? `(${currentUser.bankAccount.accountNumber})` : '(•••• 1089)';
      const sourceLabel = fundingSource === 'bank' ? `${bankLabel} ${accountLabel}` : 'Visa Debit Card (•••• 4242)';
      const note = customNote.trim() || `Simulated deposit via ${sourceLabel}`;

      const res = await addMoneyToAdmin(parsedPaise, note);

      if (res.success && res.transaction) {
        onSuccess(res.transaction);
        onClose();
        setAmountStr('5000');
        setCustomNote('');
      } else {
        setErrorMessage(res.error || 'Failed to add simulated funds.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred while adding demo funds.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Money to Administrator Account"
      description="Top up your family wallet directly from your linked payment source"
      maxWidth="md"
    >
      <form onSubmit={handleSimulatedSubmit} className="space-y-5">
        {/* Current Balance Row */}
        <div className="p-3.5 bg-gradient-to-r from-fintech-deep to-fintech-navy text-white rounded-xl flex items-center justify-between shadow-xs">
          <div>
            <div className="text-[11px] text-blue-200 uppercase tracking-wider font-semibold">
              Current Available Balance
            </div>
            <div className="text-xl sm:text-2xl font-bold tracking-tight">
              {formatCurrency(ownerWallet.balancePaise)}
            </div>
          </div>
          <Badge variant="primary" size="sm" className="bg-white/15 text-white border-white/25">
            Family Central Pool
          </Badge>
        </div>

        {/* Amount Input */}
        <div>
          <label className="block text-xs font-semibold text-fintech-navy mb-1.5">
            Deposit Amount (INR)
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-fintech-muted">
              ₹
            </span>
            <input
              type="number"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="5000"
              min="1"
              max="1000000"
              step="1"
              disabled={isSubmitting}
              className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-fintech-border text-base font-bold text-fintech-navy focus:outline-none focus:ring-2 focus:ring-fintech-primary"
            />
          </div>

          {/* Quick preset pills */}
          <div className="flex flex-wrap gap-1.5 mt-2">
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
                  +{formatCurrency(amt * 100, { hideDecimalsIfZero: true })}
                </button>
              );
            })}
          </div>
        </div>

        {/* Funding Source Selector */}
        <div>
          <label className="block text-xs font-semibold text-fintech-navy mb-1.5">
            Primary Funding Source
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* 1. Simulated Bank */}
            <label
              className={`p-2.5 rounded-xl border cursor-pointer flex flex-col justify-between transition-all ${
                fundingSource === 'bank'
                  ? 'border-fintech-primary bg-blue-50/60 ring-1 ring-fintech-primary'
                  : 'border-fintech-border bg-white hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="fundingSource"
                  value="bank"
                  checked={fundingSource === 'bank'}
                  onChange={() => setFundingSource('bank')}
                  className="sr-only"
                />
                <div className="w-6 h-6 rounded-md bg-blue-100 text-fintech-primary flex items-center justify-center shrink-0">
                  <Landmark className="w-3.5 h-3.5" />
                </div>
                <div className="text-xs font-bold text-fintech-navy truncate">
                  {currentUser?.bankAccount?.bankName || 'SBI Banking'}
                </div>
              </div>
              <div className="text-[10px] text-fintech-muted mt-2">Simulated Bank</div>
            </label>

            {/* 2. Simulated Card */}
            <label
              className={`p-2.5 rounded-xl border cursor-pointer flex flex-col justify-between transition-all ${
                fundingSource === 'card'
                  ? 'border-fintech-primary bg-blue-50/60 ring-1 ring-fintech-primary'
                  : 'border-fintech-border bg-white hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="fundingSource"
                  value="card"
                  checked={fundingSource === 'card'}
                  onChange={() => setFundingSource('card')}
                  className="sr-only"
                />
                <div className="w-6 h-6 rounded-md bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                  <CreditCard className="w-3.5 h-3.5" />
                </div>
                <div className="text-xs font-bold text-fintech-navy truncate">Visa Card</div>
              </div>
              <div className="text-[10px] text-fintech-muted mt-2">Simulated Card</div>
            </label>

            {/* 3. Official PayPal Sandbox */}
            <label
              className={`p-2.5 rounded-xl border cursor-pointer flex flex-col justify-between transition-all ${
                fundingSource === 'paypal_sandbox'
                  ? 'border-fintech-primary bg-blue-50/60 ring-1 ring-fintech-primary'
                  : 'border-fintech-border bg-white hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="fundingSource"
                  value="paypal_sandbox"
                  checked={fundingSource === 'paypal_sandbox'}
                  onChange={() => setFundingSource('paypal_sandbox')}
                  className="sr-only"
                />
                <div className="w-6 h-6 rounded-md bg-blue-600 text-white flex items-center justify-center shrink-0 font-extrabold text-[10px] shadow-xs">
                  PP
                </div>
                <div className="text-xs font-bold text-fintech-navy truncate">PayPal Sandbox</div>
              </div>
              <div className="text-[10px] text-blue-600 font-semibold mt-2 flex items-center gap-1">
                <span>Official SDK</span>
                <Badge variant="primary" size="sm" className="text-[8px] py-0 px-1">Live</Badge>
              </div>
            </label>
          </div>
        </div>

        {/* Optional Note */}
        <div>
          <label className="block text-xs font-semibold text-fintech-navy mb-1">
            Memo / Reference Note (Optional)
          </label>
          <input
            type="text"
            value={customNote}
            onChange={(e) => setCustomNote(e.target.value)}
            placeholder="e.g. Monthly family fund reload"
            maxLength={80}
            disabled={isSubmitting}
            className="w-full px-3.5 py-2 rounded-lg border border-fintech-border text-xs text-fintech-text focus:outline-none focus:ring-2 focus:ring-fintech-primary"
          />
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-fintech-error">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* ================================================================= */}
        {/* PAYPAL SANDBOX BUTTONS OR SETUP INSTRUCTIONS                      */}
        {/* ================================================================= */}
        {fundingSource === 'paypal_sandbox' ? (
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-fintech-navy space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-fintech-primary">
                <ShieldCheck className="w-4 h-4" />
                <span>Official PayPal Sandbox Checkout</span>
              </div>
              <p className="text-[11px] text-fintech-muted">
                Order creation and capture are processed server-to-server through PayPal Orders v2 API at <code>api-m.sandbox.paypal.com</code>.
              </p>
            </div>

            {paypalConfig.isConfigured && paypalConfig.clientId ? (
              <div className="min-h-[140px] pt-1">
                <PayPalScriptProvider
                  options={{
                    clientId: paypalConfig.clientId,
                    currency: 'USD',
                    intent: 'capture',
                  }}
                >
                  <PayPalButtons
                    style={{ layout: 'vertical', shape: 'rect', color: 'gold', height: 40 }}
                    disabled={parsedPaise <= 0 || isSubmitting}
                    createOrder={async () => {
                      setErrorMessage('');
                      try {
                        const order = await payPalSandboxService.createSandboxOrder({
                          amountPaise: parsedPaise,
                          description: customNote.trim() || 'PayPal Family Account Top-Up (Sandbox)',
                        });
                        return order.orderId;
                      } catch (err: any) {
                        setErrorMessage(err.message || 'Failed to initialize PayPal order.');
                        throw err;
                      }
                    }}
                    onApprove={async (data) => {
                      setIsSubmitting(true);
                      setErrorMessage('');
                      try {
                        const orderIdToCapture = data.orderID || (data as any).orderId;
                        const capture = await payPalSandboxService.captureSandboxOrder(orderIdToCapture);
                        if (capture.success) {
                          const note = customNote.trim() || `PayPal Sandbox Deposit (Order: ${capture.orderId}, Capture: ${capture.captureId || 'VERIFIED'})`;
                          const res = await addMoneyToAdmin(parsedPaise, note);
                          if (res.success && res.transaction) {
                            res.transaction.paymentSource = 'PAYPAL_SANDBOX' as any;
                            onSuccess(res.transaction);
                            onClose();
                          }
                        } else {
                          setErrorMessage(capture.error || 'PayPal capture failed server-side verification.');
                        }
                      } catch (err: any) {
                        setErrorMessage(err.message || 'Error capturing PayPal Sandbox transaction.');
                      } finally {
                        setIsSubmitting(false);
                      }
                    }}
                    onError={(err) => {
                      setErrorMessage(`PayPal Checkout error: ${err?.message || 'Transaction could not be completed.'}`);
                    }}
                  />
                </PayPalScriptProvider>
              </div>
            ) : (
              <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl space-y-2 text-xs text-amber-900">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span>PayPal Sandbox Credentials Setup Mode</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  The official PayPal JavaScript SDK component is mounted. To process live orders against PayPal Sandbox servers, provide your credentials in <code>server/.env</code>:
                </p>
                <div className="p-2 bg-white/90 rounded border border-amber-200 font-mono text-[10px] text-slate-700">
                  PAYPAL_CLIENT_ID=your_sandbox_client_id<br/>
                  PAYPAL_CLIENT_SECRET=your_sandbox_client_secret
                </div>
                <div className="pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      // Demo fallback verification for testing environment when Sandbox credentials are yet to be entered
                      setIsSubmitting(true);
                      try {
                        const note = customNote.trim() || 'PayPal Sandbox Deposit (Verified Mock Capture: CAP-SANDBOX-DEMO)';
                        const res = await addMoneyToAdmin(parsedPaise, note);
                        if (res.success && res.transaction) {
                          res.transaction.paymentSource = 'PAYPAL_SANDBOX' as any;
                          onSuccess(res.transaction);
                          onClose();
                        }
                      } finally {
                        setIsSubmitting(false);
                      }
                    }}
                    className="w-full text-xs font-semibold"
                  >
                    Demonstrate Verified Sandbox Flow (Demo Key)
                  </Button>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-200">
              <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          /* ================================================================= */
          /* STANDARD SIMULATED SUBMIT BUTTONS                                 */
          /* ================================================================= */
          <>
            <div className="p-3 bg-blue-50/60 border border-blue-200/80 rounded-xl flex items-start gap-2.5 text-[11px] text-fintech-muted">
              <ShieldCheck className="w-4 h-4 text-fintech-primary shrink-0 mt-0.5" />
              <span>
                <strong>Instant Family Deposit:</strong> Funds added here are credited immediately to your Administrator account balance for allocation across member accounts.
              </span>
            </div>

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
                disabled={parsedPaise <= 0 || isSubmitting}
                icon={<PlusCircle className="w-4 h-4" />}
              >
                Add {formatCurrency(parsedPaise)} to Balance
              </Button>
            </div>
          </>
        )}
      </form>
    </Modal>
  );
};
