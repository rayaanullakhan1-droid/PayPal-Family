import React, { useState } from 'react';
import {
  Sliders,
  ShieldCheck,
  AlertTriangle,
  Save,
  CheckCircle2,
  HandCoins,
  QrCode,
  DollarSign,
  Info,
  ArrowRight,
  TrendingDown,
  Check,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { toPaise, formatCurrency } from '../utils/currency';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';

export const SpendingLimitsPage: React.FC = () => {
  const {
    currentUser,
    familyMembers,
    spendingRules,
    updateSpendingRule,
    getMemberConsumption,
  } = useApp();

  const isOwner = currentUser.role === 'owner';

  // Selected member tab for editing (Only for Administrator)
  const dependentMembers = familyMembers.filter((m) => m.role === 'member');
  const [selectedMemberId, setSelectedMemberId] = useState(
    isOwner ? (dependentMembers[0]?.id || '') : currentUser.id
  );

  // PRIVACY: Dependent members can ONLY see their own member rule!
  const activeMember = isOwner
    ? (familyMembers.find((m) => m.id === selectedMemberId) || dependentMembers[0])
    : currentUser;

  const activeRule = spendingRules[activeMember?.id] || {
    memberId: activeMember?.id || currentUser.id,
    singleTransactionLimitPaise: 50000,
    maxRequestLimitPaise: 50000,
    dailyLimitPaise: 100000,
    monthlyLimitPaise: 300000,
    allowMoneyTransfer: true,
    allowQRPayments: true,
  };

  // Synchronized member consumption from single source of truth
  const consumption = getMemberConsumption(activeMember?.id || currentUser.id);

  // Local form state for Administrator editing
  const [dailyLimitInput, setDailyLimitInput] = useState(
    (activeRule.dailyLimitPaise / 100).toString()
  );
  const [monthlyLimitInput, setMonthlyLimitInput] = useState(
    (activeRule.monthlyLimitPaise / 100).toString()
  );
  const [allowTransfer, setAllowTransfer] = useState(activeRule.allowMoneyTransfer);
  const [allowQR, setAllowQR] = useState(activeRule.allowQRPayments);

  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync state if currentUser, activeMember, or spendingRules change
  React.useEffect(() => {
    const targetMember = isOwner
      ? (familyMembers.find((m) => m.id === selectedMemberId) || dependentMembers[0])
      : currentUser;
    if (targetMember) {
      const rule = spendingRules[targetMember.id];
      if (rule) {
        setDailyLimitInput((rule.dailyLimitPaise / 100).toString());
        setMonthlyLimitInput((rule.monthlyLimitPaise / 100).toString());
        setAllowTransfer(rule.allowMoneyTransfer);
        setAllowQR(rule.allowQRPayments);
      }
    }
  }, [currentUser.id, isOwner, selectedMemberId, spendingRules]);

  // When changing member tab (Administrator only)
  const handleSelectMember = (memberId: string) => {
    if (!isOwner) return; // Privacy guard
    setSelectedMemberId(memberId);
    const rule = spendingRules[memberId];
    if (rule) {
      setDailyLimitInput((rule.dailyLimitPaise / 100).toString());
      setMonthlyLimitInput((rule.monthlyLimitPaise / 100).toString());
      setAllowTransfer(rule.allowMoneyTransfer);
      setAllowQR(rule.allowQRPayments);
    }
    setSaveSuccess(false);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMember || !isOwner) return;

    updateSpendingRule(activeMember.id, {
      singleTransactionLimitPaise: toPaise(dailyLimitInput),
      maxRequestLimitPaise: toPaise(dailyLimitInput),
      dailyLimitPaise: toPaise(dailyLimitInput),
      monthlyLimitPaise: toPaise(monthlyLimitInput),
      allowMoneyTransfer: allowTransfer,
      allowQRPayments: allowQR,
    });

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Title */}
      <div className="pb-2 border-b border-fintech-border/70">
        <h1 className="text-2xl sm:text-3xl font-bold text-fintech-navy tracking-tight">Spending Limits & Permissions</h1>
        <p className="text-xs sm:text-sm text-fintech-muted mt-0.5">
          Configure daily allowances, monthly caps, and channel permissions.
        </p>
      </div>

      {/* Security notice */}
      <div className="p-4 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs text-blue-950 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-fintech-primary shrink-0 mt-0.5" />
        <div>
          <div className="font-bold mb-0.5 text-fintech-navy">Family Spending Rules & Safety Policy</div>
          All spending limits, category filters, and channel controls configured here apply instantaneously across all linked family member wallets and cards.
        </div>
      </div>

      {/* Member Selector Tabs (PRIVACY: Visible only to Family Administrator) */}
      {isOwner ? (
        <div className="flex border-b border-fintech-border gap-2 overflow-x-auto pb-1">
          {dependentMembers.map((member) => (
            <button
              key={member.id}
              onClick={() => handleSelectMember(member.id)}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-semibold transition-all border-b-2 ${
                activeMember?.id === member.id
                  ? 'border-fintech-primary text-fintech-primary bg-white shadow-xs'
                  : 'border-transparent text-fintech-muted hover:text-fintech-navy'
              }`}
            >
              <img
                src={member.avatarUrl}
                alt={member.name}
                className="w-6 h-6 rounded-full object-cover"
              />
              <span>{member.name}</span>
              <span className="text-[11px] text-fintech-muted hidden sm:inline">({member.relationship?.split(' ')[0]})</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="p-3 bg-blue-50/70 border border-blue-200/70 rounded-xl text-xs text-fintech-navy flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-fintech-primary shrink-0" />
          <span>
            <strong>Personal Limits Privacy:</strong> You are viewing your individual spending boundaries. Only the Administrator can modify spending limits.
          </span>
        </div>
      )}

      {activeMember && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Your Configured Limits & Edit Controls */}
          <div className="lg:col-span-2 space-y-5">
            {/* 1. YOUR CONFIGURED LIMITS CARD */}
            <Card className="border-fintech-border">
              <div className="flex items-center justify-between pb-4 border-b border-fintech-border/70 mb-4">
                <div>
                  <h2 className="text-base font-bold text-fintech-navy">
                    Your Configured Limits
                  </h2>
                  <p className="text-xs text-fintech-muted">
                    {isOwner
                      ? `Active configuration for ${activeMember.name} (Source of Truth)`
                      : 'Financial boundaries established by Family Administrator'}
                  </p>
                </div>
                <Badge variant="primary" size="sm">
                  {isOwner ? 'Administrator View' : 'Personal Member View'}
                </Badge>
              </div>

              {/* Configured Limit Metrics Grid - ONLY 2 LIMITS: Daily & Monthly */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                  <div className="text-[11px] font-semibold text-fintech-muted">
                    Daily Spending Limit
                  </div>
                  <div className="text-xl font-bold text-fintech-navy mt-1">
                    {formatCurrency(consumption.configuredDailyLimitPaise)}
                  </div>
                  <div className="text-[10px] text-emerald-700 font-medium mt-1">
                    Rolling 24-hour total allowance • Auto-transfers within limit
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                  <div className="text-[11px] font-semibold text-fintech-muted">
                    Monthly Spending Limit
                  </div>
                  <div className="text-xl font-bold text-fintech-navy mt-1">
                    {formatCurrency(consumption.configuredMonthlyLimitPaise)}
                  </div>
                  <div className="text-[10px] text-fintech-muted font-medium mt-1">
                    Calendar month cumulative ceiling
                  </div>
                </div>
              </div>

              {/* Channel Permissions Display */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                <div className="text-[11px] font-bold text-fintech-navy uppercase tracking-wider">
                  Channel Permissions
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200">
                    <span className="font-semibold text-fintech-text">Direct Money Requests:</span>
                    <Badge variant={activeRule.allowMoneyTransfer ? 'success' : 'error'} size="sm">
                      {activeRule.allowMoneyTransfer ? 'Allowed' : 'Disabled'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200">
                    <span className="font-semibold text-fintech-text">Merchant QR Payments:</span>
                    <Badge variant={activeRule.allowQRPayments ? 'success' : 'error'} size="sm">
                      {activeRule.allowQRPayments ? 'Allowed' : 'Disabled'}
                    </Badge>
                  </div>
                </div>
              </div>
            </Card>

            {/* Administrator Configuration Form (Only visible to Administrator) */}
            {isOwner && (
              <Card>
                <div className="pb-3 border-b border-fintech-border/70 mb-4">
                  <h3 className="text-sm font-bold text-fintech-navy">
                    Modify Configured Limits for {activeMember.name}
                  </h3>
                  <p className="text-xs text-fintech-muted">
                    Updates synchronize immediately with Current Consumption and Request Money validation.
                  </p>
                </div>

                <form onSubmit={handleSave} className="space-y-4">
                  {/* Daily Spending Limit Input */}
                  <div>
                    <label className="block text-xs font-semibold text-fintech-navy mb-1">
                      Daily Spending Limit (INR)
                    </label>
                    <div className="relative max-w-sm">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-sm font-bold text-fintech-muted">
                        ₹
                      </span>
                      <input
                        type="number"
                        step="1"
                        min="100"
                        max="100000"
                        value={dailyLimitInput}
                        onChange={(e) => setDailyLimitInput(e.target.value)}
                        className="w-full pl-8 pr-3.5 py-2.5 rounded-lg border border-fintech-border text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-fintech-primary"
                      />
                    </div>
                  </div>

                  {/* Monthly Spending Limit Input */}
                  <div>
                    <label className="block text-xs font-semibold text-fintech-navy mb-1">
                      Monthly Spending Limit (INR)
                    </label>
                    <div className="relative max-w-sm">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-sm font-bold text-fintech-muted">
                        ₹
                      </span>
                      <input
                        type="number"
                        step="1"
                        min="100"
                        max="500000"
                        value={monthlyLimitInput}
                        onChange={(e) => setMonthlyLimitInput(e.target.value)}
                        className="w-full pl-8 pr-3.5 py-2.5 rounded-lg border border-fintech-border text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-fintech-primary"
                      />
                    </div>
                  </div>

                  {/* Channel Permission Toggles */}
                  <div className="pt-3 border-t border-fintech-border/70 space-y-2.5">
                    <div className="text-xs font-semibold text-fintech-navy uppercase tracking-wider">
                      Channel Permission Toggles
                    </div>

                    <label className="flex items-center justify-between p-3 rounded-xl border border-fintech-border hover:bg-slate-50 cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-fintech-primary flex items-center justify-center">
                          <HandCoins className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-fintech-text">Direct Money Requests</div>
                          <div className="text-[11px] text-fintech-muted">
                            Allow member to request money from Administrator
                          </div>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={allowTransfer}
                        onChange={(e) => setAllowTransfer(e.target.checked)}
                        className="w-5 h-5 text-fintech-primary rounded focus:ring-fintech-primary"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 rounded-xl border border-fintech-border hover:bg-slate-50 cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                          <QrCode className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-fintech-text">Merchant QR Payments</div>
                          <div className="text-[11px] text-fintech-muted">
                            Allow member to pay verified merchants with Personal Account
                          </div>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={allowQR}
                        onChange={(e) => setAllowQR(e.target.checked)}
                        className="w-5 h-5 text-fintech-primary rounded focus:ring-fintech-primary"
                      />
                    </label>
                  </div>

                  {saveSuccess && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 text-fintech-success rounded-lg text-xs flex items-center gap-2 animate-in fade-in">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Spending limits and permissions updated successfully! Both sections are synchronized.</span>
                    </div>
                  )}

                  <div className="pt-2">
                    <Button type="submit" variant="primary" size="md" icon={<Save className="w-4 h-4" />}>
                      Save Spending Controls
                    </Button>
                  </div>
                </form>
              </Card>
            )}
          </div>

          {/* Right Column: 2. CURRENT CONSUMPTION */}
          <div className="space-y-4">
            <Card className="bg-slate-50 border-fintech-border shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-fintech-border/70 mb-4">
                <h3 className="text-xs font-bold text-fintech-navy uppercase tracking-wider">
                  Current Consumption
                </h3>
                <Badge variant="neutral" size="sm">Synchronized</Badge>
              </div>

              {/* Today's Consumption */}
              <div className="space-y-2 mb-5">
                <div className="flex justify-between text-xs">
                  <span className="text-fintech-muted font-medium">Spent Today:</span>
                  <span className="font-bold text-fintech-navy">
                    {formatCurrency(consumption.spentTodayPaise)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-fintech-muted font-medium">Configured Daily Limit:</span>
                  <span className="font-bold text-fintech-navy">
                    {formatCurrency(consumption.configuredDailyLimitPaise)}
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-2.5 rounded-full transition-all duration-300 ${
                      consumption.dailyPct > 80 ? 'bg-fintech-error' : 'bg-fintech-primary'
                    }`}
                    style={{ width: `${consumption.dailyPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs pt-1">
                  <span className="text-fintech-muted font-medium">Remaining Today:</span>
                  <span className="font-bold text-emerald-700">
                    {formatCurrency(consumption.remainingTodayPaise)}
                  </span>
                </div>
              </div>

              {/* Month's Consumption */}
              <div className="space-y-2 pt-3 border-t border-slate-200">
                <div className="flex justify-between text-xs">
                  <span className="text-fintech-muted font-medium">Spent This Month:</span>
                  <span className="font-bold text-fintech-navy">
                    {formatCurrency(consumption.spentThisMonthPaise)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-fintech-muted font-medium">Configured Monthly Limit:</span>
                  <span className="font-bold text-fintech-navy">
                    {formatCurrency(consumption.configuredMonthlyLimitPaise)}
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-2.5 rounded-full transition-all duration-300 ${
                      consumption.monthlyPct > 80 ? 'bg-fintech-error' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${consumption.monthlyPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs pt-1">
                  <span className="text-fintech-muted font-medium">Remaining This Month:</span>
                  <span className="font-bold text-emerald-700">
                    {formatCurrency(consumption.remainingThisMonthPaise)}
                  </span>
                </div>
              </div>
            </Card>

            <Card className="bg-blue-50/50 border-blue-200/60 p-4">
              <div className="text-xs font-bold text-fintech-primary mb-1">
                Policy Enforcement Logic
              </div>
              <p className="text-[11px] text-fintech-muted leading-relaxed">
                Whenever a member initiates a transfer or QR payment, the engine checks both remaining daily and monthly limits simultaneously. If the requested amount is within both limits, it is automatically authorized. If either limit is exceeded, it is routed for Administrator approval.
              </p>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

