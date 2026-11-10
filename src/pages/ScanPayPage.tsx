import React, { useState, useEffect, useRef } from 'react';
import {
  QrCode,
  Camera,
  Keyboard,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Coffee,
  BookOpen,
  Train,
  ShieldAlert,
  Laptop,
  ArrowRight,
  Info,
  Sparkles,
  Users,
  Landmark,
  HandCoins,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { QRCodeSVG } from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';
import { useApp } from '../context/AppContext';
import {
  DEMO_MERCHANTS,
  encodeQRPayload,
  parseAndValidateQRPayload,
} from '../utils/qr';
import { formatCurrency } from '../utils/currency';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { TransactionReceiptModal } from '../components/common/TransactionReceiptModal';
import { TransactionPinModal } from '../components/common/TransactionPinModal';
import { OverLimitRequestModal } from '../components/common/OverLimitRequestModal';
import { RequestExtraMoneyModal } from '../components/common/RequestExtraMoneyModal';
import { FintechTransactionModal } from '../components/fintech/FintechTransactionModal';
import { AnimatedAmountCounter } from '../components/fintech/AnimatedAmountCounter';
import { QRPayload, Transaction } from '../types';

export const ScanPayPage: React.FC = () => {
  const {
    currentUser,
    payMerchantQR,
    submitLimitExceptionRequest,
    spendingRules,
    getMemberSpending,
    getMemberConsumption,
    ownerWallet,
    memberPersonalAccounts,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'presets' | 'camera' | 'manual'>('presets');
  const [selectedPreset, setSelectedPreset] = useState<typeof DEMO_MERCHANTS[0] | null>(DEMO_MERCHANTS[0]);

  // Payload verification & payment confirmation state
  const [scannedPayload, setScannedPayload] = useState<QRPayload | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [successReceiptTxn, setSuccessReceiptTxn] = useState<Transaction | null>(null);

  // 6-Digit Transaction PIN modal state
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);

  // Over-limit modal state (strictly REQUEST / CANCEL)
  const [overLimitDetails, setOverLimitDetails] = useState<{
    configuredLimitPaise: number;
    requestedAmountPaise: number;
    excessAmountPaise: number;
  } | null>(null);
  const [isOverLimitModalOpen, setIsOverLimitModalOpen] = useState(false);
  const [isRequestExtraMoneyOpen, setIsRequestExtraMoneyOpen] = useState(false);
  const [limitExceptionSubmitted, setLimitExceptionSubmitted] = useState<string | null>(null);

  // Premium Fintech QR Animation Modal
  const [animModal, setAnimModal] = useState<{
    isOpen: boolean;
    isProcessing: boolean;
    isSuccess: boolean;
    failureReason?: string;
    amountPaise: number;
    merchantName: string;
    merchantCategory?: string;
    transaction?: Transaction | null;
  }>({
    isOpen: false,
    isProcessing: false,
    isSuccess: false,
    amountPaise: 0,
    merchantName: '',
  });

  // Manual code entry
  const [manualCodeInput, setManualCodeInput] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  // Camera scanner state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const isOwner = currentUser.role === 'owner';
  const memberRule = spendingRules[currentUser.id];
  const memberSpending = getMemberSpending(currentUser.id);

  // Stop camera when leaving tab or unmounting
  useEffect(() => {
    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    setCameraActive(true);

    try {
      const qrScanner = new Html5Qrcode('qr-reader-target');
      scannerRef.current = qrScanner;

      await qrScanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          handleScannedString(decodedText);
          qrScanner.stop().catch(() => {});
          setCameraActive(false);
        },
        () => {
          // scanning frame ignored
        }
      );
    } catch (err: any) {
      setCameraError(
        'Unable to access camera or camera permission was denied. You can test instantly using the Interactive Merchant Presets or Manual Code Entry below.'
      );
      setCameraActive(false);
    }
  };

  const stopCamera = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      await scannerRef.current.stop();
    }
    setCameraActive(false);
  };

  const handleScannedString = (rawText: string) => {
    setPaymentError(null);
    const result = parseAndValidateQRPayload(rawText);

    if (result.success && result.payload) {
      setScannedPayload(result.payload);
      setIsConfirmModalOpen(true);
    } else {
      setPaymentError(result.error || 'Invalid QR code. Only supported PayPal Family merchant codes can be scanned.');
    }
  };

  const handlePresetSelect = (merchant: typeof DEMO_MERCHANTS[0]) => {
    setSelectedPreset(merchant);
    const rawJson = encodeQRPayload(
      merchant.id,
      merchant.name,
      merchant.category,
      merchant.defaultAmountPaise
    );
    handleScannedString(rawJson);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setManualError(null);

    // If user typed a preset merchant ID, create its payload
    const matchedMerchant = DEMO_MERCHANTS.find(
      (m) => m.id.toLowerCase() === manualCodeInput.trim().toLowerCase()
    );

    if (matchedMerchant) {
      handlePresetSelect(matchedMerchant);
      return;
    }

    const result = parseAndValidateQRPayload(manualCodeInput);
    if (result.success && result.payload) {
      setScannedPayload(result.payload);
      setIsConfirmModalOpen(true);
    } else {
      setManualError(
        result.error ||
          'Unrecognized merchant code. Please enter valid JSON payload or a supported Merchant ID like "MERCH_CAMPUS_CAFE".'
      );
    }
  };

  const handleInitiatePayment = () => {
    if (!scannedPayload || isProcessing) return;
    setPaymentError(null);

    if (isOwner) {
      if (ownerWallet.balancePaise < scannedPayload.amountPaise) {
        setPaymentError('Insufficient central account balance to complete this transaction.');
        return;
      }
      // Valid admin transaction -> require 6-digit PIN
      setIsConfirmModalOpen(false);
      setIsPinModalOpen(true);
    } else {
      // Member flow: Check against remaining daily and monthly limits
      const consumption = getMemberConsumption(currentUser.id);
      const remainingToday = consumption.remainingTodayPaise;
      const remainingMonth = consumption.remainingThisMonthPaise;

      if (scannedPayload.amountPaise > remainingToday || scannedPayload.amountPaise > remainingMonth) {
        setIsConfirmModalOpen(false);
        const limitingRemaining = Math.min(remainingToday, remainingMonth);
        setOverLimitDetails({
          configuredLimitPaise: limitingRemaining,
          requestedAmountPaise: scannedPayload.amountPaise,
          excessAmountPaise: scannedPayload.amountPaise - limitingRemaining,
        });
        setIsOverLimitModalOpen(true);
        return;
      }

      const personalBal = memberPersonalAccounts[currentUser.id]?.balancePaise || 0;
      if (personalBal < scannedPayload.amountPaise) {
        setPaymentError('Insufficient personal account balance to complete this transaction.');
        return;
      }

      // Within limit and sufficient balance -> require 6-digit PIN
      setIsConfirmModalOpen(false);
      setIsPinModalOpen(true);
    }
  };

  const handlePinVerified = async () => {
    setIsPinModalOpen(false);
    await executePayment();
  };

  const executePayment = async () => {
    if (!scannedPayload || isProcessing) return;

    const payload = scannedPayload;
    setIsProcessing(true);
    setPaymentError(null);

    setAnimModal({
      isOpen: true,
      isProcessing: true,
      isSuccess: false,
      amountPaise: payload.amountPaise,
      merchantName: payload.merchantName,
      merchantCategory: payload.merchantCategory,
    });

    try {
      const result = await payMerchantQR(payload);

      if (result.success && result.transaction) {
        try {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 },
          });
        } catch {}
        setAnimModal({
          isOpen: true,
          isProcessing: false,
          isSuccess: true,
          amountPaise: payload.amountPaise,
          merchantName: payload.merchantName,
          merchantCategory: payload.merchantCategory,
          transaction: result.transaction,
        });
        setSuccessReceiptTxn(result.transaction);
        setScannedPayload(null);
      } else if (result.isOverLimit && result.overLimitDetails) {
        // Exceeds limit -> Show strictly REQUEST and CANCEL modal
        setAnimModal((prev) => ({ ...prev, isOpen: false }));
        setOverLimitDetails(result.overLimitDetails);
        setIsOverLimitModalOpen(true);
      } else {
        const errReason = result.error || 'QR Payment declined by spending control policy.';
        setPaymentError(errReason);
        setAnimModal({
          isOpen: true,
          isProcessing: false,
          isSuccess: false,
          amountPaise: payload.amountPaise,
          merchantName: payload.merchantName,
          merchantCategory: payload.merchantCategory,
          failureReason: errReason,
        });
      }
    } catch (err: any) {
      const msg = err.message || 'Payment execution failed.';
      setPaymentError(msg);
      setAnimModal({
        isOpen: true,
        isProcessing: false,
        isSuccess: false,
        amountPaise: payload.amountPaise,
        merchantName: payload.merchantName,
        merchantCategory: payload.merchantCategory,
        failureReason: msg,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmSendToAdmin = async (customMessage?: string) => {
    if (!overLimitDetails || !scannedPayload) return;
    try {
      const defaultMsg = `Merchant Payment: ${scannedPayload.merchantName} (${scannedPayload.merchantCategory})`;
      const res = await submitLimitExceptionRequest(
        overLimitDetails.requestedAmountPaise,
        customMessage || defaultMsg,
        overLimitDetails.configuredLimitPaise,
        overLimitDetails.excessAmountPaise,
        customMessage || defaultMsg
      );
      if (res.success) {
        setLimitExceptionSubmitted(
          `Spending limit exception request for ${formatCurrency(overLimitDetails.requestedAmountPaise)} was successfully sent to the Administrator for approval.`
        );
        setIsOverLimitModalOpen(false);
        setScannedPayload(null);
      } else {
        setPaymentError(res.error || 'Failed to submit exception request.');
      }
    } catch (err: any) {
      setPaymentError(err.message || 'Failed to submit exception request.');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Title */}
      <div className="pb-2 border-b border-fintech-border/70">
        <h1 className="text-2xl sm:text-3xl font-bold text-fintech-navy tracking-tight">QR Scan & Pay</h1>
        <p className="text-xs sm:text-sm text-fintech-muted mt-0.5">
          Scan supported merchant QR codes to make simulated payments debited directly from your Personal Account or Administrator Pool.
        </p>
      </div>

      {/* Limit Exception Submission Banner */}
      {limitExceptionSubmitted && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm">Spending Exception Submitted to Administrator</div>
              <div className="mt-0.5">{limitExceptionSubmitted}</div>
            </div>
          </div>
          <button
            onClick={() => setLimitExceptionSubmitted(null)}
            className="text-amber-700 hover:text-amber-900 font-bold text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Advisory if current user is Owner */}
      {isOwner && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs text-fintech-navy flex items-start gap-3">
          <Info className="w-5 h-5 text-fintech-primary shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold mb-0.5">Administrator Spending Mode</div>
            Direct merchant QR purchases are conducted by family members using their configured allowance. As Family Administrator, payments are authorized against your central family pool.
          </div>
        </div>
      )}

      {/* Tab Switcher */}
      <div className="flex border-b border-fintech-border gap-2">
        <button
          onClick={() => {
            setActiveTab('presets');
            stopCamera();
          }}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'presets'
              ? 'border-fintech-primary text-fintech-primary'
              : 'border-transparent text-fintech-muted hover:text-fintech-text'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Demo Merchant Showcase (1-Click)</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('camera');
            startCamera();
          }}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'camera'
              ? 'border-fintech-primary text-fintech-primary'
              : 'border-transparent text-fintech-muted hover:text-fintech-text'
          }`}
        >
          <Camera className="w-4 h-4" />
          <span>Live Camera Scanner</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('manual');
            stopCamera();
          }}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'manual'
              ? 'border-fintech-primary text-fintech-primary'
              : 'border-transparent text-fintech-muted hover:text-fintech-text'
          }`}
        >
          <Keyboard className="w-4 h-4" />
          <span>Manual Merchant Code</span>
        </button>
      </div>

      {/* TAB 1: Demo Merchant Presets */}
      {activeTab === 'presets' && (
        <div className="space-y-6">
          <div className="p-4 bg-blue-50/60 border border-blue-200/60 rounded-xl text-xs text-fintech-navy flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-fintech-primary shrink-0" />
              <span>
                Click any merchant card below to instantly simulate scanning its authenticated QR payload.
              </span>
            </div>
            <Badge variant="simulated">PayPal Family QR v1</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {DEMO_MERCHANTS.map((merchant) => {
              const payloadStr = encodeQRPayload(
                merchant.id,
                merchant.name,
                merchant.category,
                merchant.defaultAmountPaise
              );

              return (
                <Card
                  key={merchant.id}
                  className="flex flex-col justify-between hover:border-fintech-primary hover:shadow-card-hover transition-all group"
                >
                  <div>
                    {/* QR Code visual rendering */}
                    <div className="flex justify-center p-4 bg-slate-50 rounded-xl mb-4 border border-slate-100 group-hover:bg-blue-50/30 transition-colors">
                      <QRCodeSVG value={payloadStr} size={130} level="M" />
                    </div>

                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-semibold text-fintech-primary uppercase tracking-wide">
                        {merchant.category}
                      </span>
                      <span className="text-sm font-bold text-fintech-navy">
                        {formatCurrency(merchant.defaultAmountPaise)}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-fintech-text mb-1 group-hover:text-fintech-primary transition-colors">
                      {merchant.name}
                    </h3>
                    <p className="text-xs text-fintech-muted line-clamp-2 mb-3">
                      {merchant.description}
                    </p>

                    <div className="text-[10px] font-mono text-slate-400 truncate mb-4">
                      ID: {merchant.id}
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full"
                    icon={<QrCode className="w-4 h-4" />}
                    onClick={() => handlePresetSelect(merchant)}
                  >
                    Simulate Scan & Pay {formatCurrency(merchant.defaultAmountPaise)}
                  </Button>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: Live Camera Scanner */}
      {activeTab === 'camera' && (
        <Card className="text-center py-8">
          <div className="max-w-md mx-auto space-y-4">
            <h2 className="text-lg font-bold text-fintech-navy">Live Device QR Scanner</h2>
            <p className="text-xs text-fintech-muted">
              Point your smartphone or web camera at any PayPal Family merchant QR code.
            </p>

            <div className="relative w-full max-w-[320px] h-[320px] mx-auto rounded-2xl overflow-hidden border-2 border-fintech-primary bg-slate-900 shadow-md">
              {/* Four Scanning Corners with Subtle Pulsing */}
              <div className="absolute top-3 left-3 w-7 h-7 border-t-3 border-l-3 border-fintech-primary rounded-tl-lg z-20 pointer-events-none animate-corner-pulse" />
              <div className="absolute top-3 right-3 w-7 h-7 border-t-3 border-r-3 border-fintech-primary rounded-tr-lg z-20 pointer-events-none animate-corner-pulse" />
              <div className="absolute bottom-3 left-3 w-7 h-7 border-b-3 border-l-3 border-fintech-primary rounded-bl-lg z-20 pointer-events-none animate-corner-pulse" />
              <div className="absolute bottom-3 right-3 w-7 h-7 border-b-3 border-r-3 border-fintech-primary rounded-br-lg z-20 pointer-events-none animate-corner-pulse" />

              {/* Animated Laser Scanning Beam */}
              <div className="absolute left-3 right-3 h-0.5 bg-gradient-to-r from-transparent via-[#0070E0] to-transparent shadow-[0_0_12px_#0070E0] animate-laser-sweep z-20 pointer-events-none" />

              <div
                id="qr-reader-target"
                className="w-full h-full flex items-center justify-center text-white"
              >
                {!cameraActive && (
                  <div className="p-4 text-xs text-slate-400">
                    <Camera className="w-10 h-10 mx-auto mb-2 text-slate-500 animate-pulse" />
                    Camera preview ready. Click start to activate.
                  </div>
                )}
              </div>
            </div>

            {cameraError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-fintech-error text-left">
                {cameraError}
              </div>
            )}

            <div className="flex justify-center gap-3">
              {cameraActive ? (
                <Button variant="danger" size="sm" onClick={stopCamera}>
                  Stop Camera
                </Button>
              ) : (
                <Button variant="primary" size="sm" onClick={startCamera}>
                  Restart Camera
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* TAB 3: Manual Merchant Code */}
      {activeTab === 'manual' && (
        <Card className="max-w-xl mx-auto">
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-fintech-navy mb-1">Manual Merchant Code Entry</h2>
              <p className="text-xs text-fintech-muted mb-4">
                Enter a demo merchant code (e.g. <code className="bg-slate-100 px-1 py-0.5 rounded text-fintech-primary font-bold">MERCH_CAMPUS_CAFE</code>) or paste raw JSON.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-fintech-navy mb-1">
                Merchant Code or Payload
              </label>
              <textarea
                value={manualCodeInput}
                onChange={(e) => {
                  setManualCodeInput(e.target.value);
                  setManualError(null);
                }}
                required
                rows={4}
                placeholder='e.g. MERCH_BOOKSTORE or {"format":"paypal_family_qr_v1", ...}'
                className="w-full px-3.5 py-2.5 rounded-lg border border-fintech-border text-xs font-mono focus:outline-none focus:ring-2 focus:ring-fintech-primary"
              />
            </div>

            {manualError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-fintech-error">
                {manualError}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setManualCodeInput('MERCH_CAMPUS_CAFE')}
              >
                Fill Campus Cafe
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Verify Merchant Code
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Payment Confirmation Modal */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => {
          if (!isProcessing) {
            setIsConfirmModalOpen(false);
            setPaymentError(null);
          }
        }}
        title="Confirm Simulated QR Payment"
        description="Verify merchant invoice details before authorization"
        maxWidth="md"
      >
        {scannedPayload && (
          <div className="space-y-5">
            {/* Merchant Info Card */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <div className="text-xs text-fintech-muted uppercase font-semibold">Merchant</div>
              <div className="text-lg font-bold text-fintech-navy mt-0.5">{scannedPayload.merchantName}</div>
              <Badge variant="neutral" size="sm" className="mt-1">
                {scannedPayload.merchantCategory}
              </Badge>

              <div className="text-3xl font-black text-fintech-navy mt-4 mb-1 font-mono flex items-center justify-center">
                <span>₹</span>
                <AnimatedAmountCounter targetRupees={Math.round(scannedPayload.amountPaise / 100)} prefix="" />
              </div>
              <div className="text-[11px] text-fintech-muted">
                Invoice Reference: {scannedPayload.invoiceId}
              </div>
            </div>

            {/* Payment Source: Administrator Central Pool vs Member Personal Account */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-fintech-navy">
                Payment Source
              </label>

              {isOwner ? (
                <div className="p-3.5 rounded-xl border border-fintech-primary bg-blue-50/70 ring-2 ring-fintech-primary/30 shadow-xs">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-blue-100 text-fintech-primary flex items-center justify-center shrink-0">
                        <Landmark className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-fintech-navy">Administrator Account (Central Pool)</span>
                          <Badge variant="primary" size="sm">Central Account</Badge>
                        </div>
                        <p className="text-[11px] text-fintech-muted mt-0.5">
                          Deducted directly from the Administrator central balance • Transaction recorded in admin ledger
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold text-fintech-navy">
                        {formatCurrency(ownerWallet.balancePaise)}
                      </div>
                      <span
                        className={`text-[10px] font-semibold ${
                          ownerWallet.balancePaise >= scannedPayload.amountPaise
                            ? 'text-emerald-700'
                            : 'text-fintech-error'
                        }`}
                      >
                        {ownerWallet.balancePaise >= scannedPayload.amountPaise
                          ? 'Available'
                          : 'Insufficient Balance'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl border border-fintech-primary bg-blue-50/70 ring-2 ring-fintech-primary/30 shadow-xs">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-blue-100 text-fintech-primary flex items-center justify-center shrink-0">
                        <Landmark className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-fintech-navy">Personal Account</span>
                          <Badge variant="primary" size="sm">Active Source</Badge>
                        </div>
                        <p className="text-[11px] text-fintech-muted mt-0.5">
                          Deducted directly from your Personal Account • Administrator balance is unaffected
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold text-fintech-navy">
                        {formatCurrency(memberPersonalAccounts[currentUser.id]?.balancePaise || 0)}
                      </div>
                      <span
                        className={`text-[10px] font-semibold ${
                          (memberPersonalAccounts[currentUser.id]?.balancePaise || 0) >= scannedPayload.amountPaise
                            ? 'text-emerald-700'
                            : 'text-fintech-error'
                        }`}
                      >
                        {(memberPersonalAccounts[currentUser.id]?.balancePaise || 0) >= scannedPayload.amountPaise
                          ? 'Available'
                          : 'Insufficient Funds'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Error banner if rules failed */}
            {paymentError && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-fintech-error space-y-2">
                <div className="flex items-start gap-2.5">
                  <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">Transaction Blocked</div>
                    <div>{paymentError}</div>
                  </div>
                </div>
                {!isOwner && scannedPayload && (memberPersonalAccounts[currentUser.id]?.balancePaise || 0) < scannedPayload.amountPaise && (
                  <div className="pt-2 border-t border-red-200/80 flex items-center justify-between">
                    <span className="text-[11px] text-red-800 font-medium">Need more funds to complete this payment?</span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsConfirmModalOpen(false);
                        setIsRequestExtraMoneyOpen(true);
                      }}
                      className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
                    >
                      <HandCoins className="w-3.5 h-3.5" />
                      Request Extra Money
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                size="md"
                disabled={isProcessing}
                onClick={() => {
                  setIsConfirmModalOpen(false);
                  setPaymentError(null);
                }}
              >
                Cancel
              </Button>

              <Button
                variant="primary"
                size="md"
                isLoading={isProcessing}
                disabled={isProcessing}
                onClick={handleInitiatePayment}
                className="px-6"
              >
                {isOwner
                  ? `Pay ${formatCurrency(scannedPayload.amountPaise)} from Administrator Account`
                  : `Pay ${formatCurrency(scannedPayload.amountPaise)} from Personal Account`}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 6-Digit Transaction PIN Modal */}
      <TransactionPinModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onSuccess={handlePinVerified}
        amountPaise={scannedPayload?.amountPaise || 0}
        title="Authorize Merchant Payment"
        description={`Enter your 6-digit transaction PIN to pay ${scannedPayload?.merchantName || 'merchant'}`}
        actionLabel="Verify & Pay"
      />

      {/* Spending Limit Exceeded Modal (Strictly REQUEST / CANCEL) */}
      {overLimitDetails && (
        <OverLimitRequestModal
          isOpen={isOverLimitModalOpen}
          onClose={() => {
            setIsOverLimitModalOpen(false);
            setOverLimitDetails(null);
          }}
          configuredLimitPaise={overLimitDetails.configuredLimitPaise}
          requestedAmountPaise={overLimitDetails.requestedAmountPaise}
          excessAmountPaise={overLimitDetails.excessAmountPaise}
          purpose={`Merchant Payment: ${scannedPayload?.merchantName || 'Merchant'}`}
          onConfirmSendToAdmin={handleConfirmSendToAdmin}
        />
      )}

      {/* Request Extra Money Modal for Insufficient Funds */}
      <RequestExtraMoneyModal
        isOpen={isRequestExtraMoneyOpen}
        onClose={() => setIsRequestExtraMoneyOpen(false)}
        initialAmountPaise={
          scannedPayload
            ? Math.max(0, scannedPayload.amountPaise - (memberPersonalAccounts[currentUser.id]?.balancePaise || 0))
            : undefined
        }
        shortfallPaise={
          scannedPayload
            ? Math.max(0, scannedPayload.amountPaise - (memberPersonalAccounts[currentUser.id]?.balancePaise || 0))
            : undefined
        }
        currentBalancePaise={memberPersonalAccounts[currentUser.id]?.balancePaise || 0}
        requiredAmountPaise={scannedPayload?.amountPaise || 0}
        sourceContext={scannedPayload ? `QR Payment to ${scannedPayload.merchantName}` : 'QR Scan & Pay'}
        initialMessage={scannedPayload ? `Need extra funds to complete QR payment to ${scannedPayload.merchantName}` : ''}
        onSuccess={() => {
          setPaymentError(null);
        }}
      />

      {/* Success Receipt Modal */}
      <TransactionReceiptModal
        transaction={successReceiptTxn}
        isOpen={Boolean(successReceiptTxn)}
        onClose={() => setSuccessReceiptTxn(null)}
      />

      {/* Premium Fintech QR Scan & Pay Animation Modal */}
      <FintechTransactionModal
        isOpen={animModal.isOpen}
        onClose={() => setAnimModal((prev) => ({ ...prev, isOpen: false }))}
        flowType="qr_payment"
        amountPaise={animModal.amountPaise}
        senderName={currentUser.name}
        recipientName={animModal.merchantName}
        merchantName={animModal.merchantName}
        merchantCategory={animModal.merchantCategory}
        isProcessing={animModal.isProcessing}
        isSuccess={animModal.isSuccess}
        failureReason={animModal.failureReason}
        transaction={animModal.transaction}
        onViewReceipt={(txn) => {
          setAnimModal((prev) => ({ ...prev, isOpen: false }));
          setSuccessReceiptTxn(txn);
        }}
        onRetry={() => {
          setAnimModal((prev) => ({ ...prev, isOpen: false }));
          if (scannedPayload) setIsConfirmModalOpen(true);
        }}
      />
    </div>
  );
};

