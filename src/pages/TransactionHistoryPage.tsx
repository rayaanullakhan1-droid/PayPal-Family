import React, { useState } from 'react';
import {
  History,
  Search,
  Filter,
  HandCoins,
  QrCode,
  ArrowUpRight,
  ArrowDownLeft,
  XCircle,
  CheckCircle2,
  Receipt,
  FileSpreadsheet,
  PlusCircle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatCurrency } from '../utils/currency';
import { formatDateTime } from '../utils/dates';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { TransactionReceiptModal } from '../components/common/TransactionReceiptModal';
import { Transaction } from '../types';

export const TransactionHistoryPage: React.FC = () => {
  const { transactions, currentUser, familyMembers, isCustomUser } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'TRANSFER' | 'QR_PAYMENT' | 'ADD_MONEY'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMPLETED' | 'REJECTED'>('ALL');
  const [selectedReceiptTxn, setSelectedReceiptTxn] = useState<Transaction | null>(null);

  const isOwner = currentUser.role === 'owner';

  // Filter list
  const filteredTransactions = transactions.filter((txn) => {
    // If member, show transactions where member is initiator or recipient
    if (!isOwner && txn.initiatorId !== currentUser.id && txn.recipientId !== currentUser.id) {
      return false;
    }

    if (typeFilter !== 'ALL' && txn.type !== typeFilter) {
      return false;
    }

    if (statusFilter !== 'ALL' && txn.status !== statusFilter) {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchRecipient = txn.recipientName.toLowerCase().includes(q);
      const matchSender = (txn.senderName || '').toLowerCase().includes(q);
      const matchRef = txn.reference.toLowerCase().includes(q);
      const matchNote = (txn.note || '').toLowerCase().includes(q);
      return matchRecipient || matchSender || matchRef || matchNote;
    }

    return true;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Title & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-fintech-border/70">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-fintech-navy tracking-tight">Transaction Ledger</h1>
          <p className="text-xs sm:text-sm text-fintech-muted mt-0.5">
            {isCustomUser
              ? 'Complete audit trail of family transfers and payments.'
              : 'Complete audit trail of simulated family transfers and merchant payments.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!isCustomUser && <Badge variant="simulated">Simulated Financial History</Badge>}
        </div>
      </div>

      {/* Filters & Search Bar */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Search box */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-fintech-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by merchant, member, or reference ID (e.g. TXN-...)"
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-fintech-border text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-fintech-primary"
            />
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-1.5 w-full md:w-auto">
            <span className="text-xs text-fintech-muted font-medium shrink-0">Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="px-3 py-2 rounded-lg border border-fintech-border text-xs bg-white focus:outline-none focus:ring-2 focus:ring-fintech-primary"
            >
              <option value="ALL">All Types</option>
              <option value="TRANSFER">Family Transfers</option>
              <option value="ADD_MONEY">Money Added</option>
              <option value="QR_PAYMENT">Merchant QR</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 w-full md:w-auto">
            <span className="text-xs text-fintech-muted font-medium shrink-0">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 rounded-lg border border-fintech-border text-xs bg-white focus:outline-none focus:ring-2 focus:ring-fintech-primary"
            >
              <option value="ALL">All Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="REJECTED">Declined / Rejected</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Transactions Table / List */}
      <Card className="p-0 overflow-hidden">
        {filteredTransactions.length === 0 ? (
          <div className="p-12 text-center text-xs text-fintech-muted space-y-2">
            <History className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="font-semibold text-fintech-navy">No transactions match your search</div>
            <p>Try resetting your filter parameters or initiating a transfer or payment.</p>
          </div>
        ) : (
          <div className="divide-y divide-fintech-border">
            {filteredTransactions.map((txn) => {
              const isAddMoney = txn.type === 'ADD_MONEY';
              const isTransfer = txn.type === 'TRANSFER';
              const isSuccess = txn.status === 'COMPLETED';
              const isOutgoing = isAddMoney
                ? false
                : isOwner
                ? true
                : !isTransfer;

              const senderDisplay = isAddMoney
                ? (txn.senderName || 'Linked Bank Account')
                : (txn.senderName || 'Rajesh Sharma (Administrator)');
              const receiverDisplay = txn.recipientName;

              const titleDisplay = isAddMoney
                ? 'Money added to Administrator Account'
                : isTransfer
                ? isOwner
                  ? `Money sent to ${receiverDisplay}`
                  : `Money received from ${senderDisplay}`
                : receiverDisplay;

              return (
                <div
                  key={txn.id}
                  onClick={() => setSelectedReceiptTxn(txn)}
                  className="p-4 sm:px-6 sm:py-4 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
                        !isSuccess
                          ? 'bg-red-50 text-fintech-error'
                          : isAddMoney
                          ? 'bg-emerald-50 text-emerald-600'
                          : isTransfer
                          ? isOutgoing
                            ? 'bg-blue-50 text-fintech-primary'
                            : 'bg-emerald-50 text-emerald-600'
                          : 'bg-indigo-50 text-indigo-600'
                      }`}
                    >
                      {isAddMoney ? (
                        <PlusCircle className="w-5 h-5" />
                      ) : isTransfer ? (
                        <HandCoins className="w-5 h-5" />
                      ) : (
                        <QrCode className="w-5 h-5" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="text-sm font-bold text-fintech-text">
                          {titleDisplay}
                        </span>
                        <Badge
                          variant={
                            !isSuccess
                              ? 'error'
                              : isAddMoney
                              ? 'success'
                              : isTransfer
                              ? isOutgoing
                                ? 'primary'
                                : 'success'
                              : 'neutral'
                          }
                          size="sm"
                        >
                          {isAddMoney
                            ? 'Money Added'
                            : isTransfer
                            ? (isOutgoing ? 'Money Sent' : 'Money Received')
                            : 'Merchant QR'}
                        </Badge>
                        {txn.paymentSource && (
                          <Badge variant="simulated" size="sm" className="bg-slate-100 text-slate-700">
                            {txn.paymentSource === 'ADMIN_ACCOUNT'
                              ? 'Admin Account'
                              : 'Personal Account'}
                          </Badge>
                        )}
                        {!isSuccess && (
                          <Badge variant="error" size="sm">
                            Declined
                          </Badge>
                        )}
                      </div>

                      <div className="text-xs text-fintech-muted flex flex-wrap items-center gap-2 mt-1">
                        <span><strong>Time:</strong> {formatDateTime(txn.date)}</span>
                        <span>•</span>
                        <span><strong>Ref ID:</strong> <span className="font-mono text-slate-600">{txn.reference}</span></span>
                        <span>•</span>
                        <span><strong>Sender:</strong> {senderDisplay}</span>
                        <span>•</span>
                        <span><strong>Receiver:</strong> {receiverDisplay}</span>
                      </div>

                      {txn.note && (
                        <p className="text-[11px] text-slate-500 mt-1 italic">
                          "{txn.note}"
                        </p>
                      )}

                      {!isSuccess && txn.rejectionReason && (
                        <p className="text-[11px] text-fintech-error font-medium mt-1">
                          Reason: {txn.rejectionReason}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0 pl-3">
                    <div
                      className={`text-sm sm:text-base font-bold ${
                        !isSuccess
                          ? 'text-slate-400 line-through'
                          : isOutgoing
                          ? 'text-fintech-navy'
                          : 'text-fintech-success'
                      }`}
                    >
                      {isOutgoing ? '-' : '+'}{formatCurrency(txn.amountPaise)}
                    </div>
                    <div className="text-[11px] text-fintech-muted flex items-center justify-end gap-1 mt-0.5">
                      <Receipt className="w-3 h-3 text-fintech-primary" />
                      <span>View Receipt</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Receipt Modal */}
      <TransactionReceiptModal
        transaction={selectedReceiptTxn}
        isOpen={Boolean(selectedReceiptTxn)}
        onClose={() => setSelectedReceiptTxn(null)}
      />
    </div>
  );
};

