import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import {
  Users,
  UserPlus,
  ShieldCheck,
  Trash2,
  Sliders,
  Mail,
  AlertCircle,
  CheckCircle2,
  Send,
  Copy,
  Clock,
  UserCheck,
  XCircle,
  Phone,
  Landmark,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { SendMoneyModal } from '../components/common/SendMoneyModal';
import { TransactionReceiptModal } from '../components/common/TransactionReceiptModal';
import { FamilyConnectionModal } from '../components/fintech/FamilyConnectionModal';
import { formatCurrency } from '../utils/currency';
import { formatDateTime } from '../utils/dates';
import { Transaction, MembershipRequest } from '../types';

export const FamilyManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    currentUser,
    family,
    familyMembers,
    familyJoiningCode,
    pendingMembershipRequests,
    approveMembershipRequest,
    rejectMembershipRequest,
    inviteMember,
    removeMember,
    spendingRules,
    memberPersonalAccounts,
    ownerWallet,
  } = useApp();

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRelationship, setInviteRelationship] = useState('Daughter (College Student)');
  const [inviteSuccessMsg, setInviteSuccessMsg] = useState('');
  const [isSendMoneyOpen, setIsSendMoneyOpen] = useState(false);
  const [selectedSendMemberId, setSelectedSendMemberId] = useState<string | undefined>();
  const [selectedReceiptTxn, setSelectedReceiptTxn] = useState<Transaction | null>(null);

  const [copyCodeSuccess, setCopyCodeSuccess] = useState(false);
  const [approvalActionMsg, setApprovalActionMsg] = useState<string | null>(null);
  const [connectionModalData, setConnectionModalData] = useState<{
    isOpen: boolean;
    familyName: string;
    role: string;
    userName: string;
  }>({
    isOpen: false,
    familyName: '',
    role: 'member',
    userName: '',
  });

  const isOwner = currentUser.role === 'owner';

  // Strict role-based security: Members cannot view or access family management
  if (!isOwner) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleCopyJoiningCode = () => {
    navigator.clipboard.writeText(familyJoiningCode);
    setCopyCodeSuccess(true);
    setTimeout(() => setCopyCodeSuccess(false), 2000);
  };

  const handleApproveRequest = async (reqId: string, applicantName: string) => {
    const ok = await approveMembershipRequest(reqId);
    if (ok) {
      setApprovalActionMsg(`Approved membership for ${applicantName}! They are now an active family member.`);
      setConnectionModalData({
        isOpen: true,
        familyName: family.name,
        role: 'member',
        userName: applicantName,
      });
      setTimeout(() => setApprovalActionMsg(null), 3500);
    } else {
      alert('Failed to approve membership request.');
    }
  };

  const handleRejectRequest = async (reqId: string, applicantName: string) => {
    if (window.confirm(`Decline membership request for ${applicantName}?`)) {
      const ok = await rejectMembershipRequest(reqId);
      if (ok) {
        setApprovalActionMsg(`Declined membership request for ${applicantName}.`);
        setTimeout(() => setApprovalActionMsg(null), 3500);
      }
    }
  };

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName || !inviteEmail) return;

    inviteMember(inviteName, inviteEmail, inviteRelationship);
    setInviteSuccessMsg(`Invitation sent! Profile created for ${inviteName}.`);
    setInviteName('');
    setInviteEmail('');

    setTimeout(() => {
      setInviteSuccessMsg('');
      setIsInviteModalOpen(false);
    }, 1200);
  };

  const handleRemoveMember = (memberId: string, memberName: string) => {
    if (window.confirm(`Are you sure you want to remove ${memberName} from the family group?`)) {
      removeMember(memberId);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-fintech-border/70">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-fintech-navy tracking-tight">Family Management</h1>
          <p className="text-xs sm:text-sm text-fintech-muted mt-0.5">
            Manage members, review joining requests, and supervise permissions for {family.name}.
          </p>
        </div>

        {isOwner && (
          <Button
            variant="primary"
            size="md"
            icon={<UserPlus className="w-4 h-4" />}
            onClick={() => setIsInviteModalOpen(true)}
          >
            Invite Member
          </Button>
        )}
      </div>

      {approvalActionMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{approvalActionMsg}</span>
          </div>
          <button
            onClick={() => setApprovalActionMsg(null)}
            className="text-xs text-emerald-700 hover:underline font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Family Info Summary Banner */}
      <Card className="bg-gradient-to-r from-slate-900 to-fintech-navy text-white border-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-fintech-primary/30 border border-white/20 flex items-center justify-center text-white">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold">{family.name}</h2>
                <Badge variant="simulated" size="sm" className="bg-white/20 text-white border-white/30">
                  Verified Family Group
                </Badge>
              </div>
              <p className="text-xs text-blue-200 mt-0.5">
                Created: {new Date(family.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} • {familyMembers.length} Active Member(s)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-blue-200 bg-white/10 px-3.5 py-2 rounded-lg border border-white/10">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Parental Financial Governance Enabled</span>
          </div>
        </div>
      </Card>

      {/* Family Joining Code Card (For Administrator) */}
      {isOwner && (
        <Card className="bg-gradient-to-br from-blue-50/70 to-indigo-50/50 border border-blue-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm font-bold text-fintech-navy">Family Unique Joining Code</h3>
                <Badge variant="primary" size="sm">Share with Dependents</Badge>
              </div>
              <p className="text-xs text-fintech-muted">
                Family members enter this code on the registration page to request membership to <strong>{family.name}</strong>.
              </p>
            </div>

            <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-blue-300 shadow-xs">
              <span className="font-mono text-lg font-extrabold tracking-widest text-fintech-navy">
                {familyJoiningCode}
              </span>
              <Button
                variant="primary"
                size="sm"
                onClick={handleCopyJoiningCode}
                icon={<Copy className="w-3.5 h-3.5" />}
              >
                {copyCodeSuccess ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Pending Membership Requests Section (Administrator Review & Approval) */}
      {isOwner && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-fintech-navy">Pending Membership Requests</h2>
              {pendingMembershipRequests.length > 0 && (
                <span className="bg-amber-100 text-amber-800 text-[11px] font-bold px-2 py-0.5 rounded-full border border-amber-300">
                  {pendingMembershipRequests.length} Pending
                </span>
              )}
            </div>
            <p className="text-xs text-fintech-muted">Applicants awaiting administrator approval</p>
          </div>

          {pendingMembershipRequests.length === 0 ? (
            <Card className="bg-slate-50/60 border-dashed border-slate-300 text-center py-6">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <div className="text-xs font-semibold text-fintech-navy">All Membership Requests Up to Date</div>
              <p className="text-[11px] text-fintech-muted mt-0.5">
                When new users register with joining code <strong className="font-mono">{familyJoiningCode}</strong>, their approval requests will appear here.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingMembershipRequests.map((req: MembershipRequest) => (
                <Card key={req.id} className="border-amber-200 bg-amber-50/30 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={req.userAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                          alt={req.userName}
                          className="w-11 h-11 rounded-full object-cover ring-2 ring-amber-300"
                        />
                        <div>
                          <div className="text-sm font-bold text-fintech-navy">{req.userName}</div>
                          <div className="text-xs text-fintech-muted flex items-center gap-1.5 mt-0.5">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{req.userMobile}</span>
                          </div>
                        </div>
                      </div>
                      <Badge variant="simulated" size="sm" className="bg-amber-100 text-amber-900 border-amber-300">
                        Pending
                      </Badge>
                    </div>

                    <div className="p-2.5 bg-white rounded-lg border border-amber-200/80 text-xs text-fintech-text space-y-1 mb-3">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Landmark className="w-3.5 h-3.5 text-fintech-primary" />
                        <span>Simulated Bank: <strong>{req.bankSummary || 'Linked Bank'}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Requested: {formatDateTime(req.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-amber-200">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleApproveRequest(req.id, req.userName)}
                      icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    >
                      Approve Member
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRejectRequest(req.id, req.userName)}
                      icon={<XCircle className="w-3.5 h-3.5 text-red-500" />}
                      className="text-red-600 hover:bg-red-50 border-red-200"
                    >
                      Decline
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Non-owner advisory */}
      {!isOwner && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs text-fintech-navy flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-fintech-primary shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold mb-0.5">Member View Only</div>
            Only the Family Administrator ({familyMembers.find((m) => m.role === 'owner')?.name}) can add new members or approve joining requests.
          </div>
        </div>
      )}

      {/* Members Directory List */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-fintech-navy">Registered Family Members</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {familyMembers.map((member) => {
            const isMemberOwner = member.role === 'owner';
            const rule = spendingRules[member.id];

            return (
              <Card key={member.id} className="flex flex-col justify-between hover:shadow-card-hover transition-all">
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={member.avatarUrl}
                        alt={member.name}
                        className="w-12 h-12 rounded-full object-cover ring-2 ring-slate-100"
                      />
                      <div>
                        <h3 className="text-sm font-bold text-fintech-text">{member.name}</h3>
                        <p className="text-xs text-fintech-muted">{member.relationship || 'Member'}</p>
                      </div>
                    </div>
                    <Badge variant={isMemberOwner ? 'primary' : 'neutral'} size="sm">
                      {isMemberOwner ? 'Administrator' : 'Member'}
                    </Badge>
                  </div>

                  <div className="space-y-2 text-xs py-3 border-t border-b border-fintech-border/70 mb-4">
                    {(isOwner || member.id === currentUser.id) && (
                      <div className="flex items-center justify-between py-1 bg-slate-50 px-2.5 rounded-lg border border-slate-100">
                        <span className="text-fintech-muted font-medium">
                          {isMemberOwner ? 'Admin Pool Account:' : 'Personal Spending Account:'}
                        </span>
                        <span className="font-bold text-fintech-navy text-sm">
                          {formatCurrency(isMemberOwner ? ownerWallet.balancePaise : (memberPersonalAccounts[member.id]?.balancePaise || 0))}
                        </span>
                      </div>
                    )}

                    {member.mobile ? (
                      <div className="flex items-center gap-2 text-fintech-muted">
                        <Phone className="w-3.5 h-3.5" />
                        <span>{member.countryCode || '+91'} {member.mobile}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-fintech-muted">
                        <Mail className="w-3.5 h-3.5" />
                        <span className="truncate">{member.email}</span>
                      </div>
                    )}

                    {!isMemberOwner && (isOwner || member.id === currentUser.id) && rule && (
                      <div className="pt-1">
                        <div className="text-[11px] font-semibold text-fintech-navy uppercase tracking-wider mb-1">
                          Current Spending Caps
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-slate-700 bg-slate-50 p-2 rounded-lg">
                          <div>
                            <span className="text-[10px] text-fintech-muted block">Daily Limit:</span>
                            <span className="font-bold">{formatCurrency(rule.dailyLimitPaise)}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-fintech-muted block">Monthly Cap:</span>
                            <span className="font-bold">{formatCurrency(rule.monthlyLimitPaise)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Owner Actions */}
                {isOwner && !isMemberOwner && (
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<Send className="w-3.5 h-3.5" />}
                      onClick={() => {
                        setSelectedSendMemberId(member.id);
                        setIsSendMoneyOpen(true);
                      }}
                      className="flex-1 text-xs"
                    >
                      Send Money
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      icon={<Sliders className="w-3.5 h-3.5" />}
                      onClick={() => navigate('/spending-limits')}
                      className="px-2.5 text-xs"
                      title="Adjust limits"
                    >
                      Limits
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      icon={<Trash2 className="w-3.5 h-3.5" />}
                      onClick={() => handleRemoveMember(member.id, member.name)}
                      className="px-2.5 text-xs"
                      title="Remove member from family"
                    >
                      Remove
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {/* Invite Member Modal */}
      <Modal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        title="Invite Family Member"
        description="Share your Family Joining Code or add a profile directly"
        maxWidth="md"
      >
        {inviteSuccessMsg ? (
          <div className="p-6 text-center">
            <CheckCircle2 className="w-12 h-12 text-fintech-success mx-auto mb-3" />
            <div className="text-sm font-bold text-fintech-navy">{inviteSuccessMsg}</div>
          </div>
        ) : (
          <form onSubmit={handleInviteSubmit} className="space-y-4">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-1.5 text-xs">
              <span className="font-bold text-fintech-navy block">Quickest Way to Invite:</span>
              <p className="text-fintech-muted">
                Ask your family member to visit <strong>Register</strong> and enter your joining code:
              </p>
              <div className="flex items-center justify-between bg-white px-3 py-1.5 rounded-lg border border-blue-200">
                <span className="font-mono text-base font-bold text-fintech-primary">{familyJoiningCode}</span>
                <button
                  type="button"
                  onClick={handleCopyJoiningCode}
                  className="text-[11px] font-bold text-fintech-primary hover:underline"
                >
                  {copyCodeSuccess ? 'Copied!' : 'Copy Code'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-fintech-navy mb-1">Full Name</label>
              <input
                type="text"
                required
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="e.g. Maya Miller"
                className="w-full px-3.5 py-2.5 rounded-lg border border-fintech-border text-sm focus:outline-none focus:ring-2 focus:ring-fintech-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-fintech-navy mb-1">Email or Mobile</label>
              <input
                type="text"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="e.g. maya@example.com or mobile"
                className="w-full px-3.5 py-2.5 rounded-lg border border-fintech-border text-sm focus:outline-none focus:ring-2 focus:ring-fintech-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-fintech-navy mb-1">Family Role / Relationship</label>
              <select
                value={inviteRelationship}
                onChange={(e) => setInviteRelationship(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-fintech-border text-sm focus:outline-none focus:ring-2 focus:ring-fintech-primary bg-white"
              >
                <option value="Daughter (College Student)">Daughter (College Student)</option>
                <option value="Son (High School)">Son (High School)</option>
                <option value="Partner / Spouse">Partner / Spouse</option>
                <option value="Dependent Parent">Dependent Parent</option>
                <option value="Family Relative">Family Relative</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsInviteModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Add Member Directly
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Send Money Modal */}
      <SendMoneyModal
        isOpen={isSendMoneyOpen}
        onClose={() => setIsSendMoneyOpen(false)}
        onSuccess={(txn) => setSelectedReceiptTxn(txn)}
        initialMemberId={selectedSendMemberId}
      />

      {/* Transaction Receipt Modal */}
      <TransactionReceiptModal
        transaction={selectedReceiptTxn}
        isOpen={Boolean(selectedReceiptTxn)}
        onClose={() => setSelectedReceiptTxn(null)}
      />

      {/* Premium Family Connection Feedback Modal on Approval */}
      <FamilyConnectionModal
        isOpen={connectionModalData.isOpen}
        onClose={() => setConnectionModalData((prev) => ({ ...prev, isOpen: false }))}
        onContinueToDashboard={() => setConnectionModalData((prev) => ({ ...prev, isOpen: false }))}
        familyName={connectionModalData.familyName}
        role={connectionModalData.role}
        userName={connectionModalData.userName}
        adminName={currentUser.name}
      />
    </div>
  );
};
