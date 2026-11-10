import React from 'react';
import { Users, ShieldCheck, ArrowRight, Wallet, CheckCircle2 } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';

interface FamilyConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinueToDashboard: () => void;
  familyName: string;
  role: 'owner' | 'member' | string;
  userName: string;
  joiningCode?: string;
  adminName?: string;
}

export const FamilyConnectionModal: React.FC<FamilyConnectionModalProps> = ({
  isOpen,
  onClose,
  onContinueToDashboard,
  familyName,
  role,
  userName,
  joiningCode,
  adminName,
}) => {
  const isOwner = role === 'owner' || role === 'Family Administrator';
  const roleDisplay = isOwner ? 'Family Administrator' : 'Family Member';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      description=""
      maxWidth="md"
    >
      <div className="py-2 text-center space-y-6">
        {/* ================================================================= */}
        {/* ELEGANT CONNECTING NETWORK VISUAL                                 */}
        {/* ================================================================= */}
        <div className="relative py-6 px-4 bg-gradient-to-b from-blue-50/70 via-slate-50 to-white rounded-2xl border border-blue-100 overflow-hidden">
          {/* Subtle background connection waves */}
          <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
            <div className="w-56 h-56 rounded-full border border-fintech-primary/40 animate-fintech-pulse-ring" />
          </div>

          <div className="relative z-10 flex items-center justify-center gap-6 sm:gap-10">
            {/* Left Node: Administrator Account */}
            <div className="flex flex-col items-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0070E0] to-[#003087] text-white flex items-center justify-center shadow-md animate-fintech-pop">
                <Wallet className="w-7 h-7" />
              </div>
              <span className="text-[10px] font-bold text-fintech-navy uppercase tracking-wider mt-2">
                Administrator Account
              </span>
            </div>

            {/* Connecting Line with Animated Flow Indicator */}
            <div className="relative w-16 sm:w-28 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div className="absolute inset-0 bg-fintech-primary rounded-full animate-fintech-shimmer" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-fintech-primary shadow-[0_0_10px_#0070E0] ring-4 ring-blue-100 animate-signal-pulse" />
            </div>

            {/* Right Node: User Profile */}
            <div className="flex flex-col items-center">
              <div className="w-14 h-14 rounded-2xl bg-white border-2 border-emerald-500 text-emerald-600 flex items-center justify-center shadow-md animate-fintech-pop">
                <Users className="w-7 h-7" />
              </div>
              <span className="text-[10px] font-bold text-fintech-navy uppercase tracking-wider mt-2">
                {roleDisplay}
              </span>
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* HEADINGS & ROLE DETAILS                                           */}
        {/* ================================================================= */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Connection Verified & Active</span>
          </div>

          <h3 className="text-2xl font-black text-fintech-navy tracking-tight">
            Family Connection Successful
          </h3>

          <p className="text-xs text-fintech-muted max-w-sm mx-auto leading-relaxed">
            Welcome to <strong className="text-fintech-navy font-semibold">{familyName}</strong>. Your personal wallet and family financial rules are now securely synchronized.
          </p>
        </div>

        {/* ================================================================= */}
        {/* METRICS CARD                                                      */}
        {/* ================================================================= */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-left space-y-2 text-xs">
          <div className="flex justify-between items-center py-1 border-b border-slate-200/70">
            <span className="text-fintech-muted">Family Group</span>
            <span className="font-bold text-fintech-navy">{familyName}</span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-slate-200/70">
            <span className="text-fintech-muted">Connected User</span>
            <span className="font-semibold text-fintech-navy">{userName}</span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-slate-200/70">
            <span className="text-fintech-muted">Your Role</span>
            <Badge variant={isOwner ? 'primary' : 'neutral'} size="sm">
              {roleDisplay}
            </Badge>
          </div>

          {adminName && !isOwner && (
            <div className="flex justify-between items-center py-1">
              <span className="text-fintech-muted">Administrator</span>
              <span className="font-medium text-slate-700">{adminName}</span>
            </div>
          )}

          {joiningCode && isOwner && (
            <div className="flex justify-between items-center py-1">
              <span className="text-fintech-muted">Unique Joining Code</span>
              <span className="font-mono font-bold text-fintech-primary">{joiningCode}</span>
            </div>
          )}
        </div>

        {/* ================================================================= */}
        {/* CTA BUTTON                                                        */}
        {/* ================================================================= */}
        <Button
          type="button"
          variant="primary"
          size="lg"
          onClick={onContinueToDashboard}
          icon={<ArrowRight className="w-4 h-4" />}
          className="w-full"
        >
          Continue to Dashboard
        </Button>
      </div>
    </Modal>
  );
};

