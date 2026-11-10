import React from 'react';
import { CheckCircle2, XCircle, ArrowUpRight, QrCode, ShieldCheck, Printer } from 'lucide-react';
import { Transaction } from '../../types';
import { formatCurrency } from '../../utils/currency';
import { formatDateTime } from '../../utils/dates';
import { Modal } from './Modal';
import { Button } from './Button';
import { Badge } from './Badge';

interface TransactionReceiptModalProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
}

export const TransactionReceiptModal: React.FC<TransactionReceiptModalProps> = ({
  transaction,
  isOpen,
  onClose,
}) => {
  if (!transaction) return null;

  const isSuccess = transaction.status === 'COMPLETED';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Transaction Receipt"
      description="Official transaction confirmation and payment details"
      maxWidth="md"
    >
      <div className="space-y-6">
        {/* Status Header */}
        <div className="flex flex-col items-center justify-center pt-2 pb-4 border-b border-fintech-border/60 text-center">
          {isSuccess ? (
            <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-fintech-success mb-3 shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>
          ) : (
            <div className="w-14 h-14 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-fintech-error mb-3 shadow-sm">
              <XCircle className="w-8 h-8" />
            </div>
          )}

          <div className="text-2xl font-bold text-fintech-text tracking-tight">
            {formatCurrency(transaction.amountPaise)}
          </div>

          <div className="mt-1 flex items-center gap-2">
            <Badge variant={isSuccess ? 'success' : 'error'}>
              {transaction.status}
            </Badge>
            <Badge variant="neutral">
              {transaction.type === 'ADD_MONEY'
                ? 'Account Top-Up'
                : transaction.type === 'TRANSFER'
                ? 'Direct Family Transfer'
                : 'Merchant QR Payment'}
            </Badge>
            {transaction.paymentSource && (
              <Badge variant="primary">
                {transaction.paymentSource === 'ADMIN_ACCOUNT'
                  ? 'Administrator Account'
                  : 'Member Personal Account'}
              </Badge>
            )}
          </div>

          {!isSuccess && transaction.rejectionReason && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-fintech-error text-left w-full">
              <strong>Decline Reason:</strong> {transaction.rejectionReason}
            </div>
          )}
        </div>

        {/* Receipt Key-Value Rows */}
        <div className="space-y-3 text-xs sm:text-sm">
          <div className="flex justify-between py-1.5 border-b border-slate-100">
            <span className="text-fintech-muted">Transaction ID (Reference)</span>
            <span className="font-mono font-medium text-fintech-navy">{transaction.reference}</span>
          </div>

          <div className="flex justify-between py-1.5 border-b border-slate-100">
            <span className="text-fintech-muted">Date & Time</span>
            <span className="font-medium text-fintech-text">{formatDateTime(transaction.date)}</span>
          </div>

          <div className="flex justify-between py-1.5 border-b border-slate-100">
            <span className="text-fintech-muted">Sender</span>
            <span className="font-semibold text-fintech-text">
              {transaction.type === 'ADD_MONEY'
                ? (transaction.senderName || 'Linked Bank Account')
                : transaction.type === 'QR_PAYMENT'
                ? `${transaction.senderName || 'Member Personal Account'}`
                : `${transaction.senderName || 'Rajesh Sharma'} (Administrator Account)`}
            </span>
          </div>

          <div className="flex justify-between py-1.5 border-b border-slate-100">
            <span className="text-fintech-muted">Receiver</span>
            <span className="font-semibold text-fintech-text">
              {transaction.type === 'ADD_MONEY'
                ? `${transaction.recipientName} (Administrator Account)`
                : transaction.type === 'TRANSFER'
                ? `${transaction.recipientName} (Personal Account)`
                : `${transaction.recipientName} (Merchant)`}
            </span>
          </div>

          <div className="flex justify-between py-1.5 border-b border-slate-100">
            <span className="text-fintech-muted">Payment Source</span>
            <span className="font-semibold text-fintech-primary">
              {transaction.paymentSource === 'ADMIN_ACCOUNT'
                ? 'Administrator Account'
                : transaction.paymentSource === 'PERSONAL_ACCOUNT'
                ? 'Member Personal Account'
                : transaction.type === 'ADD_MONEY'
                ? 'Bank Account Transfer'
                : 'Administrator Account'}
            </span>
          </div>

          <div className="flex justify-between py-1.5 border-b border-slate-100">
            <span className="text-fintech-muted">Status</span>
            <span className={`font-semibold ${isSuccess ? 'text-fintech-success' : 'text-fintech-error'}`}>
              {transaction.status}
            </span>
          </div>

          {transaction.merchantCategory && (
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-fintech-muted">Category</span>
              <span className="text-fintech-text">{transaction.merchantCategory}</span>
            </div>
          )}

          {transaction.note && (
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-fintech-muted">Purpose / Note</span>
              <span className="text-fintech-text">{transaction.note}</span>
            </div>
          )}

          <div className="flex justify-between py-1.5 border-b border-slate-100">
            <span className="text-fintech-muted">Funding Source</span>
            <span className="text-fintech-text">
              {transaction.type === 'ADD_MONEY'
                ? 'Linked Bank Account'
                : transaction.paymentSource === 'PERSONAL_ACCOUNT'
                ? 'Member Personal Account'
                : `Administrator Account (${transaction.senderName || 'Rajesh Sharma'})`}
            </span>
          </div>

          <div className="flex justify-between py-1.5 border-b border-slate-100">
            <span className="text-fintech-muted">Settlement Mode</span>
            <span className="text-indigo-600 font-medium">Instant Family Settlement</span>
          </div>
        </div>

        {/* Security confirmation box */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-fintech-muted flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-fintech-primary shrink-0 mt-0.5" />
          <span>
            This receipt is an electronic record confirming the transaction details. All family funds and transfers are logged with instantaneous balance settlement.
          </span>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-1.5" />
            Print Receipt
          </Button>
          <Button variant="primary" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
};

