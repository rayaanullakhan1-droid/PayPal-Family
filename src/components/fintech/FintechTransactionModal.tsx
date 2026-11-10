import React, { useState, useEffect } from 'react';
import {
  Send,
  ArrowRight,
  User as UserIcon,
  Clock,
  FileText,
  RotateCw,
  Wallet,
  ShieldCheck,
  Building,
  Store,
  CheckCircle2,
  AlertCircle,
  Radio,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { AnimatedCheckmark } from './AnimatedCheckmark';
import { AnimatedAmountCounter } from './AnimatedAmountCounter';
import { formatCurrency } from '../../utils/currency';
import { formatDateTime } from '../../utils/dates';
import { Transaction } from '../../types';

export type TransactionFlowType =
  | 'send_money'
  | 'request_money'
  | 'receive_money'
  | 'qr_payment';

export interface FintechTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  flowType: TransactionFlowType;
  amountPaise: number;
  senderName: string;
  senderAvatar?: string;
  recipientName: string;
  recipientAvatar?: string;
  merchantName?: string;
  merchantCategory?: string;
  isProcessing?: boolean;
  isSuccess?: boolean;
  failureReason?: string;
  transaction?: Transaction | null;
  onViewReceipt?: (transaction: Transaction) => void;
  onRetry?: () => void;
  requestStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export const FintechTransactionModal: React.FC<FintechTransactionModalProps> = ({
  isOpen,
  onClose,
  flowType,
  amountPaise,
  senderName,
  senderAvatar,
  recipientName,
  recipientAvatar,
  merchantName,
  merchantCategory,
  isProcessing = false,
  isSuccess = false,
  failureReason,
  transaction,
  onViewReceipt,
  onRetry,
  requestStatus = 'PENDING',
}) => {
  const amountRupees = Math.round(amountPaise / 100);

  return (
    <Modal
      isOpen={isOpen}
      onClose={isProcessing ? () => {} : onClose}
      title=""
      description=""
      maxWidth="md"
    >
      <div className="py-2 text-center space-y-5">
        {/* ================================================================= */}
        {/* 1. MONEY TRANSFER: PROCESSING STATE (ANIMATED MONEY MOVEMENT)     */}
        {/* ================================================================= */}
        {isProcessing && flowType === 'send_money' && (
          <div className="py-6 space-y-6 animate-fintech-pop">
            {/* Sender and Receiver Profiles with Path and Glowing Particle */}
            <div className="p-4 bg-gradient-to-r from-blue-50/70 via-slate-50 to-blue-50/70 border border-fintech-border rounded-2xl relative overflow-hidden">
              {/* Central Transfer Amount */}
              <div className="mb-4">
                <span className="text-[11px] font-bold text-fintech-muted uppercase tracking-wider block">
                  Transfer Amount
                </span>
                <span className="text-3xl font-black text-fintech-navy font-mono">
                  {formatCurrency(amountPaise)}
                </span>
              </div>

              {/* Profiles Row with Animated Payment Path */}
              <div className="flex items-center justify-between relative px-2 sm:px-6 py-2">
                {/* Sender Profile */}
                <div className="flex flex-col items-center z-10">
                  <div className="w-14 h-14 rounded-2xl bg-fintech-deep text-white flex items-center justify-center font-bold text-base shadow-md ring-4 ring-blue-100">
                    {senderAvatar ? (
                      <img src={senderAvatar} alt={senderName} className="w-full h-full rounded-2xl object-cover" />
                    ) : (
                      senderName.substring(0, 2).toUpperCase()
                    )}
                  </div>
                  <span className="text-xs font-bold text-fintech-navy mt-1.5 truncate max-w-[90px]">
                    {senderName.split(' ')[0]}
                  </span>
                  <span className="text-[10px] text-fintech-muted uppercase font-semibold">Admin</span>
                </div>

                {/* Animated Payment Path & Travelling Particle */}
                <div className="flex-1 px-4 relative flex flex-col items-center">
                  <div className="w-full h-2 bg-slate-200 rounded-full relative overflow-hidden">
                    {/* Glowing blue particle travelling along path */}
                    <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-fintech-primary shadow-[0_0_12px_#0070E0] animate-payment-particle" />
                  </div>
                  <span className="text-[10px] text-fintech-primary font-bold mt-1.5 animate-pulse uppercase tracking-wider">
                    Moving Funds...
                  </span>
                </div>

                {/* Receiver Profile */}
                <div className="flex flex-col items-center z-10">
                  <div className="w-14 h-14 rounded-2xl bg-white border-2 border-slate-300 text-slate-700 flex items-center justify-center font-bold text-base shadow-md">
                    {recipientAvatar ? (
                      <img src={recipientAvatar} alt={recipientName} className="w-full h-full rounded-2xl object-cover" />
                    ) : (
                      recipientName.substring(0, 2).toUpperCase()
                    )}
                  </div>
                  <span className="text-xs font-bold text-fintech-navy mt-1.5 truncate max-w-[90px]">
                    {recipientName.split(' ')[0]}
                  </span>
                  <span className="text-[10px] text-fintech-muted uppercase font-semibold">Member</span>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-bold text-fintech-navy">Processing Transfer...</h3>
              <p className="text-xs text-fintech-muted">
                Validating family spending rules & allocating funds securely
              </p>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* 2. GENERAL PROCESSING FOR OTHER FLOWS                             */}
        {/* ================================================================= */}
        {isProcessing && flowType !== 'send_money' && (
          <div className="py-8 space-y-6 animate-fintech-pop">
            <div className="relative inline-flex items-center justify-center">
              <div className="w-20 h-20 rounded-full border-4 border-slate-100 border-t-fintech-primary animate-fintech-spin" />
              <div className="absolute inset-0 flex items-center justify-center text-fintech-primary">
                {flowType === 'qr_payment' ? (
                  <Store className="w-8 h-8 animate-pulse" />
                ) : flowType === 'request_money' ? (
                  <Radio className="w-8 h-8 animate-pulse text-fintech-primary" />
                ) : (
                  <Send className="w-8 h-8 animate-pulse" />
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xl font-bold text-fintech-navy">
                {flowType === 'request_money' && 'Sending Request to Administrator...'}
                {flowType === 'qr_payment' && 'Authorizing Payment...'}
                {flowType === 'receive_money' && 'Crediting Personal Account...'}
              </h3>
              <p className="text-xs text-fintech-muted">
                {flowType === 'qr_payment'
                  ? `Verifying single and daily limits for ${merchantName || 'Merchant'}`
                  : 'Synchronizing with live family rules'}
              </p>
            </div>

            <div className="text-2xl font-black text-fintech-navy font-mono">
              {formatCurrency(amountPaise)}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* 3. FAILED TRANSACTION STATE (ERROR RED & DECLINE REASON)          */}
        {/* ================================================================= */}
        {!isProcessing && !isSuccess && (
          <div className="space-y-5 animate-fintech-pop">
            <div className="mx-auto flex justify-center">
              <AnimatedCheckmark size="lg" variant="error" />
            </div>

            <div>
              <h3 className="text-2xl font-black text-fintech-navy">
                {flowType === 'request_money' ? 'Request Not Approved' : 'Payment Declined'}
              </h3>
              <p className="text-xs text-fintech-muted mt-1">
                Transaction was not executed. Your balance remains untouched.
              </p>
            </div>

            {/* Prominent Amount */}
            <div className="text-3xl font-black text-slate-800 font-mono">
              {formatCurrency(amountPaise)}
            </div>

            {/* Error Detail Card */}
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-left text-xs space-y-2">
              <div className="flex justify-between items-center text-red-900 font-semibold border-b border-red-200/80 pb-1.5">
                <span className="flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-fintech-error" />
                  Decline Reason
                </span>
                <span className="text-[10px] uppercase bg-red-200/60 px-2 py-0.5 rounded text-red-800 font-bold">
                  Rule Enforcement
                </span>
              </div>
              <p className="text-red-800 leading-relaxed font-medium">
                {failureReason || 'Declined by family spending control limits.'}
              </p>
            </div>

            {/* Parties Summary */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs text-fintech-muted">
              <div>
                <span className="block text-[10px] uppercase font-bold text-slate-400">From</span>
                <span className="font-semibold text-fintech-navy">{senderName}</span>
              </div>
              <div className="text-slate-300">&rarr;</div>
              <div className="text-right">
                <span className="block text-[10px] uppercase font-bold text-slate-400">To</span>
                <span className="font-semibold text-fintech-navy">
                  {flowType === 'qr_payment' ? merchantName || recipientName : recipientName}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2.5 pt-2">
              <Button type="button" variant="outline" size="lg" onClick={onClose} className="w-1/2">
                Dismiss
              </Button>
              {onRetry && (
                <Button type="button" variant="primary" size="lg" onClick={onRetry} className="w-1/2">
                  Try Again
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* 4. SUCCESS: MONEY REQUEST (SIGNAL TO ADMINISTRATOR) (SECTION 6)   */}
        {/* ================================================================= */}
        {!isProcessing && isSuccess && flowType === 'request_money' && (
          <div className="space-y-5 animate-fintech-pop">
            <div className="mx-auto flex justify-center">
              <AnimatedCheckmark size="lg" variant={requestStatus === 'APPROVED' ? 'success' : 'primary'} />
            </div>

            <div>
              <h3 className="text-2xl font-black text-fintech-navy">
                {requestStatus === 'APPROVED' ? 'Request Approved & Transferred!' : 'Request Sent to Administrator'}
              </h3>
              <p className="text-xs text-fintech-muted mt-1">
                {requestStatus === 'APPROVED'
                  ? 'Allowance was automatically approved and credited to your personal account.'
                  : 'Dispatched to Rajesh Sharma for approval.'}
              </p>
            </div>

            <div className="text-3xl font-black text-fintech-navy font-mono">
              {formatCurrency(amountPaise)}
            </div>

            {/* Signal Transmission Card */}
            <div className="p-4 bg-gradient-to-r from-blue-50/80 to-slate-50 border border-blue-200 rounded-2xl text-left space-y-2.5 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-blue-200/70">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-fintech-primary flex items-center justify-center font-bold">
                    {senderName.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <span className="text-[10px] text-fintech-muted uppercase font-semibold block">Requested By</span>
                    <span className="font-bold text-fintech-navy">{senderName}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-100/80 text-fintech-primary text-[11px] font-bold">
                  <Radio className="w-3.5 h-3.5 animate-signal-pulse" />
                  <span>Signal Sent</span>
                </div>

                <div className="flex items-center gap-2 text-right">
                  <div>
                    <span className="text-[10px] text-fintech-muted uppercase font-semibold block">Reviewer</span>
                    <span className="font-bold text-fintech-navy">{recipientName}</span>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center font-bold">
                    {recipientName.substring(0, 2).toUpperCase()}
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center pt-1">
                <span className="text-fintech-muted">Request Status</span>
                <Badge variant={requestStatus === 'APPROVED' ? 'success' : 'warning'} size="sm">
                  {requestStatus === 'APPROVED' ? 'APPROVED & CREDITED' : 'PENDING APPROVAL'}
                </Badge>
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <Button type="button" variant="primary" size="lg" onClick={onClose} className="w-full">
                Done
              </Button>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* 5. SUCCESS: MONEY TRANSFER (ADMIN -> MEMBER) (SECTION 4)          */}
        {/* ================================================================= */}
        {!isProcessing && isSuccess && flowType === 'send_money' && (
          <div className="space-y-5 animate-fintech-pop">
            <div className="mx-auto flex justify-center">
              <AnimatedCheckmark size="lg" variant="success" />
            </div>

            <div>
              <h3 className="text-2xl font-black text-fintech-navy">Money Sent Successfully</h3>
              <p className="text-xs text-fintech-muted mt-1">
                Funds debited from Administrator pool and credited to Member Personal Account.
              </p>
            </div>

            {/* Completed Transfer Visual */}
            <div className="p-4 bg-gradient-to-r from-blue-50/70 via-white to-emerald-50/70 border border-fintech-border rounded-2xl flex items-center justify-between shadow-xs">
              {/* Sender */}
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-xl bg-fintech-deep text-white flex items-center justify-center font-bold text-sm shadow-xs">
                  {senderAvatar ? (
                    <img src={senderAvatar} alt={senderName} className="w-full h-full rounded-xl object-cover" />
                  ) : (
                    senderName.substring(0, 2).toUpperCase()
                  )}
                </div>
                <span className="text-xs font-bold text-fintech-navy mt-1 truncate max-w-[90px]">
                  {senderName.split(' ')[0]}
                </span>
                <span className="text-[9px] text-fintech-muted uppercase font-semibold">Admin</span>
              </div>

              {/* Amount Transferred */}
              <div className="flex-1 px-3 flex flex-col items-center">
                <span className="text-lg font-black text-fintech-success font-mono">
                  {formatCurrency(amountPaise)}
                </span>
                <div className="w-full h-1.5 bg-emerald-100 rounded-full my-1 relative overflow-hidden">
                  <div className="absolute inset-0 bg-[#16803C] rounded-full" />
                </div>
                <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-[#16803C]" />
                  Transferred
                </span>
              </div>

              {/* Receiver (Glowing green indicating balance increase) */}
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-xl bg-white border-2 border-[#16803C] text-[#16803C] flex items-center justify-center font-bold text-sm shadow-xs ring-4 ring-emerald-100 animate-fintech-pop">
                  {recipientAvatar ? (
                    <img src={recipientAvatar} alt={recipientName} className="w-full h-full rounded-xl object-cover" />
                  ) : (
                    recipientName.substring(0, 2).toUpperCase()
                  )}
                </div>
                <span className="text-xs font-bold text-fintech-navy mt-1 truncate max-w-[90px]">
                  {recipientName.split(' ')[0]}
                </span>
                <span className="text-[9px] text-[#16803C] uppercase font-bold">+ Balance</span>
              </div>
            </div>

            {/* Transaction Key Details */}
            {transaction && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-left text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-fintech-muted">Reference ID</span>
                  <span className="font-mono font-bold text-fintech-navy">{transaction.reference}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-fintech-muted">Completed At</span>
                  <span className="font-medium text-slate-700">{formatDateTime(transaction.date)}</span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2.5 pt-2">
              {transaction && onViewReceipt && (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => onViewReceipt(transaction)}
                  icon={<FileText className="w-4 h-4" />}
                  className="w-1/2"
                >
                  View Receipt
                </Button>
              )}
              <Button
                type="button"
                variant="primary"
                size="lg"
                onClick={onClose}
                className={transaction && onViewReceipt ? 'w-1/2' : 'w-full'}
              >
                Done
              </Button>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* 6. SUCCESS: MONEY RECEIVED (LARGE COUNTING UP +₹2,000) (SEC 5)    */}
        {/* ================================================================= */}
        {!isProcessing && isSuccess && flowType === 'receive_money' && (
          <div className="space-y-6 animate-fintech-pop">
            <div className="mx-auto flex justify-center">
              <AnimatedCheckmark size="lg" variant="success" />
            </div>

            <div>
              <h3 className="text-2xl font-black text-fintech-navy">Money Received Successfully!</h3>
              <p className="text-xs text-fintech-muted mt-1">
                Credited directly to your Personal Spending Account.
              </p>
            </div>

            {/* Large +₹2,000 with Expanding Blue Circular Ring & Animated Counting */}
            <div className="relative py-6 px-4 bg-gradient-to-b from-blue-50/80 via-emerald-50/40 to-white border-2 border-emerald-300 rounded-2xl max-w-sm mx-auto shadow-sm overflow-hidden">
              {/* Expanding subtle blue circular ring */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-44 h-44 rounded-full border border-fintech-primary/30 animate-fintech-pulse-ring" />
              </div>

              <div className="relative z-10">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 block mb-1">
                  Amount Credited
                </span>
                <div className="text-4xl sm:text-5xl font-black text-[#16803C] font-mono tracking-tight flex items-center justify-center">
                  <span>+₹</span>
                  <AnimatedAmountCounter targetRupees={amountRupees} durationMs={1200} prefix="" />
                </div>
              </div>
            </div>

            {/* Summary Details */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-left text-xs space-y-2">
              <div className="flex justify-between items-center py-1 border-b border-slate-200">
                <span className="text-fintech-muted">Sender</span>
                <span className="font-bold text-fintech-navy">{senderName} (Family Admin)</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200">
                <span className="text-fintech-muted">Account Credited</span>
                <span className="font-semibold text-[#16803C]">{recipientName} Personal Account</span>
              </div>
              {transaction && (
                <>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200">
                    <span className="text-fintech-muted">Transaction ID</span>
                    <span className="font-mono font-bold text-fintech-navy">{transaction.reference}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-fintech-muted">Date & Time</span>
                    <span className="font-medium text-slate-700">{formatDateTime(transaction.date)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2.5 pt-2">
              {transaction && onViewReceipt && (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => onViewReceipt(transaction)}
                  icon={<FileText className="w-4 h-4" />}
                  className="w-1/2"
                >
                  View Receipt
                </Button>
              )}
              <Button
                type="button"
                variant="primary"
                size="lg"
                onClick={onClose}
                className={transaction && onViewReceipt ? 'w-1/2' : 'w-full'}
              >
                Done
              </Button>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* 7. SUCCESS: QR SCAN & PAY (SECTION 7)                             */}
        {/* ================================================================= */}
        {!isProcessing && isSuccess && flowType === 'qr_payment' && (
          <div className="space-y-5 animate-fintech-pop">
            <div className="mx-auto flex justify-center">
              <AnimatedCheckmark size="lg" variant="success" />
            </div>

            <div>
              <h3 className="text-2xl font-black text-fintech-navy">Payment Successful</h3>
              <p className="text-xs text-fintech-muted mt-1">
                Debited strictly from your Member Personal Account.
              </p>
            </div>

            {/* Merchant Banner */}
            <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3 text-left">
                <div className="w-10 h-10 rounded-xl bg-fintech-primary text-white flex items-center justify-center font-bold">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-fintech-navy">{merchantName || 'Campus Store'}</h4>
                  <p className="text-[11px] text-fintech-muted">{merchantCategory || 'Dining & Retail'}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-fintech-muted uppercase block">Amount Paid</span>
                <span className="text-lg font-black text-fintech-navy font-mono">
                  {formatCurrency(amountPaise)}
                </span>
              </div>
            </div>

            {/* Transaction Breakdown */}
            {transaction && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-left text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-fintech-muted">Payment Source</span>
                  <Badge variant="primary" size="sm">Member Personal Account</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-fintech-muted">Reference ID</span>
                  <span className="font-mono font-bold text-fintech-navy">{transaction.reference}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-fintech-muted">Timestamp</span>
                  <span className="font-medium text-slate-700">{formatDateTime(transaction.date)}</span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2.5 pt-2">
              {transaction && onViewReceipt && (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => onViewReceipt(transaction)}
                  icon={<FileText className="w-4 h-4" />}
                  className="w-1/2"
                >
                  View Receipt
                </Button>
              )}
              <Button
                type="button"
                variant="primary"
                size="lg"
                onClick={onClose}
                className={transaction && onViewReceipt ? 'w-1/2' : 'w-full'}
              >
                Done
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
