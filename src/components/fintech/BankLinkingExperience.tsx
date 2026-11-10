import React, { useState, useEffect } from 'react';
import {
  Search,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Phone,
  ArrowRight,
  Lock,
  Building,
  RefreshCw,
  Landmark,
  Layers,
  Sparkles,
  ArrowLeft,
} from 'lucide-react';
import { SUPPORTED_BANKS, BankInfo, BankLogo, VerifiedBankLogo } from './BankLogos';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { maskAccountNumber } from '../../services/onboardingStorage';
import {
  bankDiscoveryService,
  DiscoveredBankAccount,
  DiscoveryScenario,
} from '../../services/bankDiscoveryService';

export interface BankLinkingExperienceProps {
  initialAccountHolderName: string;
  userMobile: string;
  userCountryCode?: string;
  initialSubStep?: LinkingSubStep;
  onBankLinked: (bankData: {
    accountHolderName: string;
    bankName: string;
    accountNumber: string;
    ifscCode: string;
  }) => void;
  onBack?: () => void;
}

export type LinkingSubStep =
  | 'select_bank'          // STEP 2: Select Bank from Institutional Cards
  | 'fetching_accounts'    // STEP 3: "Fetching bank accounts..." Scanning animation
  | 'select_account'       // STEP 4: Display available accounts (Single or Multiple)
  | 'no_accounts'          // STEP 6: "No linked bank account found" screen
  | 'manual_entry'         // STEP 6 Alternative: Optional manual entry
  | 'verifying_animation'  // STEP 5: Verification animation with green checkmark on logo
  | 'verification_failed'  // Error recovery screen
  | 'success_display';     // STEP 5 Complete: Success display card

export const BankLinkingExperience: React.FC<BankLinkingExperienceProps> = ({
  initialAccountHolderName,
  userMobile,
  userCountryCode = '+91',
  initialSubStep,
  onBankLinked,
  onBack,
}) => {
  // Normalize initial sub-step (supports legacy query params)
  const resolvedInitialStep = (): LinkingSubStep => {
    if (initialSubStep === ('simulated_otp' as any)) return 'select_account';
    if (initialSubStep) return initialSubStep;
    return 'select_bank';
  };

  const [subStep, setSubStep] = useState<LinkingSubStep>(resolvedInitialStep());

  // Testing & review scenario selector (default normal auto discovery)
  const [testScenario] = useState<DiscoveryScenario>('auto');

  // Bank selection & search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBank, setSelectedBank] = useState<BankInfo>(SUPPORTED_BANKS[0]);

  // Default preview account for deep-links or initial sub-steps
  const defaultSampleAccount: DiscoveredBankAccount = {
    id: `disc_${SUPPORTED_BANKS[0].id}_01`,
    bankId: SUPPORTED_BANKS[0].id,
    bankName: SUPPORTED_BANKS[0].name,
    accountType: 'Savings Account',
    accountNumber: SUPPORTED_BANKS[0].sampleAccount,
    maskedAccountNumber: maskAccountNumber(SUPPORTED_BANKS[0].sampleAccount),
    accountHolderName: initialAccountHolderName || 'Rajesh Sharma',
    ifscCode: SUPPORTED_BANKS[0].defaultIfscPrefix,
    branchName: `${SUPPORTED_BANKS[0].shortName} Retail Branch`,
    isPrimary: true,
  };

  // Discovered accounts state
  const [discoveredAccounts, setDiscoveredAccounts] = useState<DiscoveredBankAccount[]>(() => {
    if (initialSubStep && initialSubStep !== 'select_bank') {
      return [defaultSampleAccount];
    }
    return [];
  });
  const [selectedAccount, setSelectedAccount] = useState<DiscoveredBankAccount | null>(() => {
    if (initialSubStep && initialSubStep !== 'select_bank') {
      return defaultSampleAccount;
    }
    return null;
  });

  // Manual fallback state
  const [manualHolderName, setManualHolderName] = useState(initialAccountHolderName || 'Account Holder');
  const [manualAccountNumber, setManualAccountNumber] = useState(SUPPORTED_BANKS[0].sampleAccount);
  const [manualIfsc, setManualIfsc] = useState(SUPPORTED_BANKS[0].defaultIfscPrefix);
  const [manualError, setManualError] = useState<string | null>(null);

  // Verification animation state
  const [animPhase, setAnimPhase] = useState<number>(1);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // Filtered banks based on search query
  const filteredBanks = SUPPORTED_BANKS.filter(
    (b) =>
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.shortName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.defaultIfscPrefix.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // --------------------------------------------------------------------------
  // STEP 2 -> STEP 3: Bank Selected -> Initiate Account Discovery
  // --------------------------------------------------------------------------
  const handleBankChosen = async (bank: BankInfo) => {
    setSelectedBank(bank);
    setManualIfsc(bank.defaultIfscPrefix);
    setManualAccountNumber(bank.sampleAccount);
    setSubStep('fetching_accounts');

    try {
      const accounts = await bankDiscoveryService.fetchLinkedAccounts(
        bank.id,
        userMobile || '9811122233',
        initialAccountHolderName || 'Account Holder',
        testScenario
      );

      setDiscoveredAccounts(accounts);
      if (accounts.length > 0) {
        setSelectedAccount(accounts[0]);
        setSubStep('select_account');
      } else {
        setSelectedAccount(null);
        setSubStep('no_accounts');
      }
    } catch {
      setSubStep('no_accounts');
    }
  };

  // --------------------------------------------------------------------------
  // STEP 4 -> STEP 5: Account Selected -> Start Ownership Verification
  // --------------------------------------------------------------------------
  const handleInitiateVerification = async (accountToVerify: DiscoveredBankAccount) => {
    setSelectedAccount(accountToVerify);
    setSubStep('verifying_animation');
    setAnimPhase(1);
    setVerificationError(null);

    // Sequence per prompt requirements:
    // 1. "Connecting to bank..." (0 to 900ms) with rotating scanning ring around logo
    // 2. "Checking account details..." (900ms to 1800ms)
    // 3. "Verifying account ownership..." (1800ms to 2700ms)
    // 4. Verification Check:
    //    - If success: "Bank Account Successfully Verified" with green tick overlay on logo
    //    - If failure: Show verification failure screen
    // 5. Complete verification and transition to Success Display Card (at 4200ms)

    const timer1 = setTimeout(() => setAnimPhase(2), 900);
    const timer2 = setTimeout(() => setAnimPhase(3), 1800);

    const timer3 = setTimeout(async () => {
      const result = await bankDiscoveryService.verifyAccountOwnership(
        accountToVerify,
        userMobile || '9811122233',
        testScenario
      );

      if (!result.success) {
        setVerificationError(result.error || 'Failed to verify account ownership.');
        setSubStep('verification_failed');
      } else {
        setAnimPhase(4); // Green checkmark directly on bank logo
      }
    }, 2700);

    const timer4 = setTimeout(() => {
      setAnimPhase(5);
      setSubStep('success_display');
    }, 4200);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  };

  // --------------------------------------------------------------------------
  // STEP 6: Manual Entry Submission Handler
  // --------------------------------------------------------------------------
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setManualError(null);

    const cleanAcc = manualAccountNumber.replace(/\D/g, '');
    if (cleanAcc.length < 8) {
      setManualError('Please enter a valid bank account number (at least 8 digits).');
      return;
    }

    if (!manualIfsc || manualIfsc.trim().length < 6) {
      setManualError('Please enter a valid institutional IFSC code (e.g. HDFC0001234).');
      return;
    }

    const syntheticAccount: DiscoveredBankAccount = {
      id: `manual_${selectedBank.id}_${Date.now()}`,
      bankId: selectedBank.id,
      bankName: selectedBank.name,
      accountType: 'Savings Account',
      accountNumber: manualAccountNumber.trim(),
      maskedAccountNumber: maskAccountNumber(manualAccountNumber.trim()),
      accountHolderName: manualHolderName.trim() || initialAccountHolderName || 'Account Holder',
      ifscCode: manualIfsc.trim().toUpperCase(),
      branchName: `${selectedBank.shortName} Branch`,
      isPrimary: true,
    };

    handleInitiateVerification(syntheticAccount);
  };

  // --------------------------------------------------------------------------
  // STEP 5 COMPLETE: Finish Linking and Advance to Family Setup
  // --------------------------------------------------------------------------
  const handleFinishLinking = () => {
    if (!selectedAccount) return;

    onBankLinked({
      accountHolderName: selectedAccount.accountHolderName,
      bankName: selectedAccount.bankName,
      accountNumber: selectedAccount.accountNumber,
      ifscCode: selectedAccount.ifscCode,
    });
  };

  return (
    <div className="space-y-6">
      {/* ==================================================================== */}
      {/* STEP 2: SELECT BANK (MAJOR INSTITUTIONAL CARDS)                      */}
      {/* ==================================================================== */}
      {subStep === 'select_bank' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-fintech-border/70">
            <div>
              <h3 className="text-base font-bold text-fintech-navy">Step 2: Select Your Bank</h3>
              <p className="text-xs text-fintech-muted">
                Accounts linked to verified mobile{' '}
                <strong className="text-fintech-navy font-mono">
                  {userCountryCode} {userMobile || '98111 22233'}
                </strong>{' '}
                will be fetched automatically.
              </p>
            </div>
            <Badge variant="primary">Fast Discovery</Badge>
          </div>

          {/* Search Bank Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search bank by name or IFSC code..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-fintech-border text-sm focus:outline-none focus:ring-2 focus:ring-fintech-primary focus:border-transparent bg-white shadow-xs"
            />
          </div>

          {/* Bank Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[360px] overflow-y-auto pr-1">
            {filteredBanks.map((bank) => {
              const isSelected = selectedBank.id === bank.id;
              return (
                <button
                  type="button"
                  key={bank.id}
                  onClick={() => setSelectedBank(bank)}
                  onDoubleClick={() => handleBankChosen(bank)}
                  className={`p-3.5 rounded-xl border-2 text-left transition-all flex items-center justify-between group ${
                    isSelected
                      ? 'border-fintech-primary bg-blue-50/70 shadow-sm ring-1 ring-fintech-primary'
                      : 'border-fintech-border bg-white hover:border-slate-300 hover:bg-slate-50/60 shadow-xs'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <BankLogo bankId={bank.id} size="md" className="group-hover:scale-105 transition-transform" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-fintech-navy truncate">{bank.name}</span>
                        {isSelected && (
                          <span className="w-2 h-2 rounded-full bg-fintech-primary shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-fintech-muted truncate">{bank.tagline}</p>
                    </div>
                  </div>

                  <div className="shrink-0 pl-2">
                    {isSelected ? (
                      <div className="w-6 h-6 rounded-full bg-fintech-primary text-white flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full border border-slate-300 group-hover:border-slate-400" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {filteredBanks.length === 0 && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-fintech-muted">
              No matching banks found for "{searchQuery}". Select one of our major supported banks above.
            </div>
          )}

          {/* Action Row */}
          <div className="flex gap-2.5 pt-2">
            {onBack && (
              <Button type="button" variant="outline" size="lg" onClick={onBack} className="w-1/3">
                Back
              </Button>
            )}
            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={() => handleBankChosen(selectedBank)}
              className={onBack ? 'w-2/3' : 'w-full'}
            >
              Continue with {selectedBank.shortName} &rarr;
            </Button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* STEP 3: FETCHING LINKED BANK ACCOUNTS (ANIMATED SCANNING)            */}
      {/* ==================================================================== */}
      {subStep === 'fetching_accounts' && (
        <div className="py-12 px-4 text-center space-y-6 animate-fintech-pop">
          {/* Animated Bank Logo with Scanning Ring */}
          <div className="relative inline-flex items-center justify-center p-3">
            <VerifiedBankLogo bankId={selectedBank.id} size="xl" isVerifying={true} />
          </div>

          <div className="space-y-2">
            <h4 className="text-xl font-bold text-fintech-navy">Fetching bank accounts...</h4>
            <p className="text-xs text-fintech-muted max-w-md mx-auto">
              Simulating authorized institutional discovery for verified mobile{' '}
              <strong className="text-fintech-navy font-mono">
                {userCountryCode} {userMobile || '98111 22233'}
              </strong>{' '}
              at {selectedBank.name}.
            </p>
          </div>

          {/* Animated Institutional Loading Steps */}
          <div className="max-w-sm mx-auto p-4 bg-slate-50 border border-slate-200 rounded-2xl text-left space-y-3">
            <div className="flex items-center gap-2.5 text-xs text-fintech-navy font-semibold">
              <span className="w-2 h-2 rounded-full bg-fintech-primary animate-ping" />
              <span>Connecting to {selectedBank.name} API Switch...</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-fintech-muted">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Verified Mobile Number Token Linked</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-fintech-muted">
              <ShieldCheck className="w-3.5 h-3.5 text-fintech-primary" />
              <span>End-to-End Encrypted Registry Query</span>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* STEP 4: DISPLAY AVAILABLE ACCOUNTS (PHONEPE / GPAY CARD DISCOVERY)  */}
      {/* ==================================================================== */}
      {subStep === 'select_account' && (
        <div className="space-y-5 animate-fintech-pop">
          <div className="flex items-center justify-between pb-2 border-b border-fintech-border/70">
            <div className="flex items-center gap-3">
              <BankLogo bankId={selectedBank.id} size="sm" />
              <div>
                <h3 className="text-base font-bold text-fintech-navy">{selectedBank.name}</h3>
                <p className="text-xs text-fintech-muted">
                  Discovered accounts linked with {userCountryCode} {userMobile || '98111 22233'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSubStep('select_bank')}
              className="text-xs font-semibold text-fintech-primary hover:underline"
            >
              Change Bank
            </button>
          </div>

          <div className="space-y-3">
            <span className="text-xs font-semibold text-fintech-navy block">
              {discoveredAccounts.length > 1
                ? `Select which account to link (${discoveredAccounts.length} found):`
                : 'Matching bank account discovered:'}
            </span>

            {discoveredAccounts.map((acc) => {
              const isSelected = selectedAccount?.id === acc.id;
              return (
                <div
                  key={acc.id}
                  onClick={() => setSelectedAccount(acc)}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative ${
                    isSelected
                      ? 'border-fintech-primary bg-gradient-to-r from-blue-50/70 via-white to-blue-50/40 shadow-sm ring-1 ring-fintech-primary'
                      : 'border-fintech-border bg-white hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <VerifiedBankLogo bankId={selectedBank.id} size="md" isVerified={true} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-fintech-navy">{acc.bankName}</span>
                          <Badge variant="primary" size="sm">
                            {acc.accountType}
                          </Badge>
                        </div>
                        <div className="font-mono text-sm font-extrabold text-fintech-navy mt-1 tracking-wider">
                          {acc.maskedAccountNumber}
                        </div>
                        <p className="text-xs text-fintech-muted mt-0.5">
                          Holder: <strong className="text-slate-700">{acc.accountHolderName}</strong> • IFSC: {acc.ifscCode}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 flex flex-col items-end gap-2">
                      <Button
                        type="button"
                        variant={isSelected ? 'primary' : 'outline'}
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInitiateVerification(acc);
                        }}
                        className="text-xs font-bold"
                      >
                        Link Account &rarr;
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Security Guarantee Notice */}
          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-fintech-navy flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-fintech-primary shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold">Simulated Fintech Account Discovery:</span>
              <p className="text-[11px] text-fintech-muted">
                Accounts verified securely via mobile binding. No banking passwords, UPI PINs, or ATM PINs are ever requested.
              </p>
            </div>
          </div>

          {/* Secondary Action */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setSubStep('select_bank')}
              className="text-xs font-semibold text-fintech-muted hover:text-fintech-navy inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Choose Another Bank</span>
            </button>
            <button
              type="button"
              onClick={() => setSubStep('manual_entry')}
              className="text-xs font-semibold text-fintech-primary hover:underline"
            >
              Enter account manually (Alternative) &rarr;
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* STEP 6: NO MATCHING ACCOUNT SCREEN                                   */}
      {/* ==================================================================== */}
      {subStep === 'no_accounts' && (
        <div className="py-8 px-4 text-center space-y-6 animate-fintech-pop">
          <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto shadow-xs">
            <AlertCircle className="w-8 h-8" />
          </div>

          <div className="space-y-1.5 max-w-md mx-auto">
            <h4 className="text-xl font-bold text-fintech-navy">No linked bank account found</h4>
            <p className="text-xs text-fintech-muted leading-relaxed">
              We couldn't find any active accounts at <strong>{selectedBank.name}</strong> registered under{' '}
              <strong className="text-fintech-navy font-mono">
                {userCountryCode} {userMobile || '98111 22233'}
              </strong>.
            </p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl max-w-md mx-auto text-left text-xs space-y-2">
            <span className="font-bold text-fintech-navy block">What would you like to do?</span>
            <ul className="text-fintech-muted list-disc list-inside space-y-1 text-[11px]">
              <li>Retry account discovery (check institutional availability)</li>
              <li>Select a different bank where your mobile number is linked</li>
              <li>Use a pre-verified simulated demo account for instant testing</li>
              <li>Enter account details manually as an alternative</li>
            </ul>
          </div>

          <div className="max-w-md mx-auto space-y-2.5 pt-2">
            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={() => handleBankChosen(selectedBank)}
              icon={<RefreshCw className="w-4 h-4" />}
              className="w-full"
            >
              Retry Account Discovery
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => setSubStep('select_bank')}
                className="w-full text-xs"
              >
                Choose Another Bank
              </Button>
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => {
                  const demoAcc: DiscoveredBankAccount = {
                    id: `demo_${selectedBank.id}_verified`,
                    bankId: selectedBank.id,
                    bankName: selectedBank.name,
                    accountType: 'Savings Account',
                    accountNumber: selectedBank.sampleAccount,
                    maskedAccountNumber: maskAccountNumber(selectedBank.sampleAccount),
                    accountHolderName: initialAccountHolderName || 'Account Holder',
                    ifscCode: selectedBank.defaultIfscPrefix,
                    branchName: `${selectedBank.shortName} Main Branch`,
                    isPrimary: true,
                  };
                  handleInitiateVerification(demoAcc);
                }}
                className="w-full text-xs text-fintech-primary border-fintech-primary hover:bg-blue-50"
              >
                Use Demo Account
              </Button>
            </div>
            <button
              type="button"
              onClick={() => setSubStep('manual_entry')}
              className="text-xs text-fintech-muted hover:text-fintech-navy underline pt-2 block mx-auto"
            >
              Enter account details manually (Alternative fallback)
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* STEP 6 ALTERNATIVE: MANUAL ENTRY FALLBACK (OPTIONAL)                 */}
      {/* ==================================================================== */}
      {subStep === 'manual_entry' && (
        <form onSubmit={handleManualSubmit} className="space-y-4 animate-fintech-pop">
          <div className="flex items-center justify-between pb-2 border-b border-fintech-border/70">
            <div>
              <h3 className="text-base font-bold text-fintech-navy">Manual Account Entry (Alternative)</h3>
              <p className="text-xs text-fintech-muted">Enter institutional routing details for {selectedBank.name}.</p>
            </div>
            <button
              type="button"
              onClick={() => setSubStep('select_bank')}
              className="text-xs font-semibold text-fintech-primary hover:underline"
            >
              Back to Discovery
            </button>
          </div>

          {manualError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-fintech-error flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-fintech-error shrink-0 mt-0.5" />
              <span>{manualError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-fintech-navy mb-1.5">
              Account Holder Name
            </label>
            <input
              type="text"
              value={manualHolderName}
              onChange={(e) => setManualHolderName(e.target.value)}
              placeholder="Name on bank passbook"
              required
              className="w-full px-3.5 py-2.5 rounded-lg border border-fintech-border text-sm focus:outline-none focus:ring-2 focus:ring-fintech-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-fintech-navy mb-1.5">
              Account Number
            </label>
            <input
              type="text"
              value={manualAccountNumber}
              onChange={(e) => setManualAccountNumber(e.target.value)}
              placeholder="e.g. 50100482910482"
              required
              className="w-full px-3.5 py-2.5 rounded-lg border border-fintech-border text-sm font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-fintech-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-fintech-navy mb-1.5">
              IFSC Code
            </label>
            <input
              type="text"
              value={manualIfsc}
              onChange={(e) => setManualIfsc(e.target.value.toUpperCase())}
              placeholder="e.g. HDFC0001234"
              required
              className="w-full px-3.5 py-2.5 rounded-lg border border-fintech-border text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-fintech-primary"
            />
          </div>

          <div className="flex gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => setSubStep('select_bank')}
              className="w-1/3"
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="lg" className="w-2/3">
              Verify & Link Account &rarr;
            </Button>
          </div>
        </form>
      )}

      {/* ==================================================================== */}
      {/* STEP 5: VERIFYING ANIMATION (4-PHASE SEQUENCE WITH GREEN CHECKMARK)  */}
      {/* ==================================================================== */}
      {subStep === 'verifying_animation' && (
        <div className="py-8 px-4 text-center space-y-6 animate-fintech-pop">
          {/* Bank Logo with Rotating Blue Scanning Ring & Green Verification Tick Overlay */}
          <div className="relative inline-flex items-center justify-center p-3">
            <VerifiedBankLogo
              bankId={selectedAccount?.bankId || selectedBank.id}
              size="xl"
              isVerifying={animPhase < 4}
              isVerified={animPhase >= 4}
            />
          </div>

          <div className="space-y-1.5 transition-all">
            {animPhase === 1 && (
              <>
                <h4 className="text-lg font-bold text-fintech-navy">Connecting to bank...</h4>
                <p className="text-xs text-fintech-muted">Establishing secure institutional handshake with {selectedBank.name}</p>
              </>
            )}

            {animPhase === 2 && (
              <>
                <h4 className="text-lg font-bold text-fintech-navy">Checking account details...</h4>
                <p className="text-xs text-fintech-muted">Matching account holder name and IFSC branch routing</p>
              </>
            )}

            {animPhase === 3 && (
              <>
                <h4 className="text-lg font-bold text-fintech-navy">Verifying account ownership...</h4>
                <p className="text-xs text-fintech-muted">
                  Validating mobile binding with {userCountryCode} {userMobile || '98111 22233'}
                </p>
              </>
            )}

            {animPhase >= 4 && (
              <>
                <h4 className="text-lg font-extrabold text-[#16803C] animate-fintech-pop">
                  Bank Account Successfully Verified
                </h4>
                <p className="text-xs text-emerald-800">
                  Direct institutional link confirmed for {selectedAccount?.bankName || selectedBank.name}
                </p>
              </>
            )}
          </div>

          {/* Progress Indicators */}
          <div className="flex items-center justify-center gap-2 pt-2">
            <div
              className={`h-1.5 rounded-full transition-all duration-300 ${
                animPhase >= 1 ? 'w-6 bg-fintech-primary' : 'w-2 bg-slate-200'
              }`}
            />
            <div
              className={`h-1.5 rounded-full transition-all duration-300 ${
                animPhase >= 2 ? 'w-6 bg-fintech-primary' : 'w-2 bg-slate-200'
              }`}
            />
            <div
              className={`h-1.5 rounded-full transition-all duration-300 ${
                animPhase >= 3 ? 'w-6 bg-fintech-primary' : 'w-2 bg-slate-200'
              }`}
            />
            <div
              className={`h-1.5 rounded-full transition-all duration-300 ${
                animPhase >= 4 ? 'w-8 bg-[#16803C]' : 'w-2 bg-slate-200'
              }`}
            />
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* VERIFICATION FAILURE STATE                                           */}
      {/* ==================================================================== */}
      {subStep === 'verification_failed' && (
        <div className="py-8 px-4 text-center space-y-6 animate-fintech-pop">
          <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto shadow-xs">
            <AlertCircle className="w-8 h-8" />
          </div>

          <div className="space-y-1.5 max-w-md mx-auto">
            <h4 className="text-xl font-bold text-fintech-navy">Ownership Verification Failed</h4>
            <p className="text-xs text-fintech-error">
              {verificationError || 'Institutional signature token mismatch for this account.'}
            </p>
          </div>

          <div className="flex gap-2 max-w-sm mx-auto pt-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => setSubStep('select_account')}
              className="w-1/2"
            >
              Back to Accounts
            </Button>
            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={() => {
                if (selectedAccount) handleInitiateVerification(selectedAccount);
              }}
              className="w-1/2"
            >
              Try Again
            </Button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* STEP 5 COMPLETE: SUCCESS DISPLAY CARD (SECTION 9)                    */}
      {/* ==================================================================== */}
      {subStep === 'success_display' && selectedAccount && (
        <div className="space-y-6 text-center animate-fintech-pop">
          {/* Verified Bank Logo with green tick overlay */}
          <div className="mx-auto flex justify-center">
            <VerifiedBankLogo
              bankId={selectedAccount.bankId}
              size="lg"
              isVerified={true}
            />
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 mb-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Verified & Active</span>
            </div>
            <h3 className="text-2xl font-extrabold text-fintech-navy">Bank Account Linked Successfully</h3>
            <p className="text-xs text-fintech-muted mt-1">
              Your institutional account is verified and ready as your primary funding source.
            </p>
          </div>

          {/* Linked Bank Card Preview */}
          <div className="p-5 bg-gradient-to-br from-blue-50/90 via-white to-emerald-50/50 border-2 border-fintech-primary/30 rounded-2xl max-w-md mx-auto text-left shadow-sm">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200/60">
              <div className="flex items-center gap-3.5">
                <VerifiedBankLogo bankId={selectedAccount.bankId} size="md" isVerified={true} />
                <div>
                  <h5 className="font-bold text-sm text-fintech-navy">{selectedAccount.bankName}</h5>
                  <p className="text-[11px] text-fintech-muted">{selectedAccount.accountType}</p>
                </div>
              </div>
              <Badge variant="success" size="sm">
                Verified
              </Badge>
            </div>

            <div className="p-3.5 bg-white/90 backdrop-blur-xs rounded-xl border border-slate-200/80 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-fintech-muted">Account Holder</span>
                <span className="font-bold text-fintech-navy">{selectedAccount.accountHolderName}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-fintech-muted">Account Number</span>
                <span className="font-mono font-bold text-fintech-navy">
                  {selectedAccount.maskedAccountNumber}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-fintech-muted">IFSC Code</span>
                <span className="font-mono font-medium text-slate-700">{selectedAccount.ifscCode}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-fintech-muted">Status</span>
                <span className="font-bold text-[#16803C] flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#16803C]" />
                  Verified
                </span>
              </div>
            </div>
          </div>

          {/* Continue Button */}
          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={handleFinishLinking}
            className="w-full mt-2"
          >
            Continue to Family Setup &rarr;
          </Button>
        </div>
      )}
    </div>
  );
};
