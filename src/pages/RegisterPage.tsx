import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  ShieldCheck,
  Users,
  Building,
  CheckCircle2,
  Copy,
  Clock,
  ArrowRight,
  Phone,
  Lock,
  Sparkles,
  AlertCircle,
  Landmark,
  UserCheck,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { formatCurrency } from '../utils/currency';
import { BankLinkingExperience } from '../components/fintech/BankLinkingExperience';
import { FamilyConnectionModal } from '../components/fintech/FamilyConnectionModal';
import { VerifiedBankLogo } from '../components/fintech/BankLogos';
import { TransactionPinModal } from '../components/common/TransactionPinModal';
import { CountrySelector } from '../components/common/CountrySelector';
import { getCountryByCode, validatePhoneNumber, CountryData } from '../utils/countries';

const POPULAR_BANKS = [
  'HDFC Bank',
  'State Bank of India (SBI)',
  'ICICI Bank',
  'Axis Bank',
  'Kotak Mahindra Bank',
  'Punjab National Bank',
];

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    currentUser,
    registerMobileUser,
    linkBankAccount,
    createCustomFamily,
    verifyJoiningCode,
    submitMembershipRequest,
    checkUserMembershipStatus,
    switchUser,
  } = useApp();

  const initialCodeParam = searchParams.get('code') || '';
  const initialStepParam = searchParams.get('step') || '1';

  // Wizard state: 1 (Mobile), 2 (Bank), 3 (Action Choice), 4 (Create or Join)
  const [currentStep, setCurrentStep] = useState<number>(() => {
    const s = parseInt(initialStepParam, 10);
    return isNaN(s) || s < 1 || s > 4 ? 1 : s;
  });

  // Track sub-step for Step 4 ('create' | 'join')
  const [step4Mode, setStep4Mode] = useState<'create' | 'join'>(() => {
    const m = searchParams.get('mode');
    return m === 'join' ? 'join' : 'create';
  });

  // STEP 1 STATE: Mobile Registration
  const [fullName, setFullName] = useState(currentUser?.name && currentUser.isCustomUser ? currentUser.name : '');
  const [selectedCountry, setSelectedCountry] = useState<CountryData>(() =>
    getCountryByCode(currentUser?.countryCode || '+91')
  );
  const [countryCode, setCountryCode] = useState(currentUser?.countryCode || '+91');
  const [mobileNumber, setMobileNumber] = useState(currentUser?.mobile || '');
  const [generatedOTP, setGeneratedOTP] = useState<string | null>(null);
  const [enteredOTP, setEnteredOTP] = useState('');
  const [isOTPSent, setIsOTPSent] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [registeredUserId, setRegisteredUserId] = useState<string | null>(
    currentUser?.isCustomUser ? currentUser.id : null
  );

  // STEP 2 STATE: Add Bank Account
  const [accountHolderName, setAccountHolderName] = useState('');
  const [selectedBank, setSelectedBank] = useState('HDFC Bank');
  const [customBank, setCustomBank] = useState('');
  const [accountNumber, setAccountNumber] = useState('50100482910482');
  const [ifscCode, setIfscCode] = useState('HDFC0001234');
  const [maskedAccountDisplay, setMaskedAccountDisplay] = useState<string | null>(null);

  // STEP 4A STATE: Create Family
  const [familyName, setFamilyName] = useState('');
  const [createdFamilyResult, setCreatedFamilyResult] = useState<{
    familyId: string;
    familyName: string;
    joiningCode: string;
    balancePaise: number;
  } | null>(null);

  // STEP 4B STATE: Join Family
  const [joiningCodeInput, setJoiningCodeInput] = useState(initialCodeParam);
  const [verifiedFamily, setVerifiedFamily] = useState<{
    familyId: string;
    familyName: string;
    adminName: string;
  } | null>(null);
  const [joinCodeError, setJoinCodeError] = useState<string | null>(null);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [isSubmittingJoin, setIsSubmittingJoin] = useState(false);
  const [isPendingApproval, setIsPendingApproval] = useState(false);
  const [pendingFamilyName, setPendingFamilyName] = useState('');

  // General error / notification
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [copiedCodeSuccess, setCopiedCodeSuccess] = useState(false);
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);
  const [connectionModalData, setConnectionModalData] = useState<{
    familyName: string;
    role: string;
    joiningCode?: string;
    adminName?: string;
  } | null>(null);

  // Post-registration 6-digit transaction PIN setup state
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);

  const handleProceedToDashboard = () => {
    if (registeredUserId) switchUser(registeredUserId);
    if (!currentUser?.hasTransactionPin) {
      setIsPinModalOpen(true);
    } else {
      navigate('/dashboard');
    }
  };

  // Auto-fill account holder name when Full Name changes
  useEffect(() => {
    if (fullName && !accountHolderName) {
      setAccountHolderName(fullName);
    }
  }, [fullName, accountHolderName]);

  // If user opened with invite code in URL, prepare Step 4 Join mode
  useEffect(() => {
    if (initialCodeParam) {
      setJoiningCodeInput(initialCodeParam);
      setStep4Mode('join');
    }
  }, [initialCodeParam]);

  // If user is already registered and logged in with an onboarding step, resume
  useEffect(() => {
    if (currentUser?.isCustomUser) {
      setRegisteredUserId(currentUser.id);
      if (currentUser.name) setFullName(currentUser.name);
      if (currentUser.mobile) setMobileNumber(currentUser.mobile);
      if (currentUser.countryCode) setCountryCode(currentUser.countryCode);

      if (currentUser.bankAccount) {
        setMaskedAccountDisplay(currentUser.bankAccount.accountNumber);
      }

      if (currentUser.onboardingStep === 'bank' && currentStep === 1) {
        setCurrentStep(2);
      } else if (currentUser.onboardingStep === 'family_choice' && currentStep === 1) {
        setCurrentStep(3);
      } else if (currentUser.onboardingStep === 'pending_approval') {
        setCurrentStep(4);
        setStep4Mode('join');
        setIsPendingApproval(true);
        if (currentUser.familyId) {
          const status = checkUserMembershipStatus(currentUser.id);
          if (status.family) setPendingFamilyName(status.family.name);
        }
      }
    }
  }, [currentUser]);

  // ---------------------------------------------------------
  // HANDLER: Step 1 Send OTP
  // ---------------------------------------------------------
  const handleSendOTP = (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError(null);
    setGeneralError(null);

    const validation = validatePhoneNumber(mobileNumber, selectedCountry);
    if (!validation.valid) {
      setOtpError(validation.error || 'Please enter a valid mobile phone number.');
      return;
    }

    // Generate simulated 6-digit OTP
    const mockOTP = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOTP(mockOTP);
    setIsOTPSent(true);
  };

  // ---------------------------------------------------------
  // HANDLER: Step 1 Verify OTP & Create User
  // ---------------------------------------------------------
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError(null);

    if (enteredOTP.trim() !== generatedOTP) {
      setOtpError('Invalid verification code. Please enter the simulated OTP shown above.');
      return;
    }

    try {
      const user = await registerMobileUser(
        fullName,
        selectedCountry.dialCode,
        mobileNumber,
        selectedCountry.name
      );
      setRegisteredUserId(user.id);
      switchUser(user.id);
      setCurrentStep(2); // Advance to Step 2: Bank Account
    } catch (err: any) {
      setGeneralError(err.message || 'Registration failed.');
    }
  };

  // ---------------------------------------------------------
  // HANDLER: Step 2 Link Bank Account
  // ---------------------------------------------------------
  const handleLinkBank = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    if (!registeredUserId) {
      setGeneralError('User session expired. Please re-enter your mobile number.');
      setCurrentStep(1);
      return;
    }

    const bankName = selectedBank === 'Other' ? customBank.trim() || 'Bank' : selectedBank;
    if (!accountNumber || accountNumber.trim().length < 6) {
      setGeneralError('Please enter a valid account number.');
      return;
    }

    try {
      const updatedUser = await linkBankAccount(registeredUserId, {
        accountHolderName: accountHolderName.trim() || fullName,
        bankName,
        accountNumber: accountNumber.trim(),
        ifscCode: ifscCode.trim().toUpperCase() || 'HDFC0001234',
      });

      if (updatedUser.bankAccount) {
        setMaskedAccountDisplay(updatedUser.bankAccount.accountNumber);
      }
      setCurrentStep(3); // Advance to Step 3: Choose Family Action
    } catch (err: any) {
      setGeneralError(err.message || 'Failed to link bank account.');
    }
  };

  // ---------------------------------------------------------
  // HANDLER: Step 4A Create Family
  // ---------------------------------------------------------
  const handleCreateFamilySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    if (!registeredUserId) {
      setGeneralError('User session not found.');
      setCurrentStep(1);
      return;
    }

    const groupName = familyName.trim() || `${fullName}'s Family`;

    try {
      // Family utilizes the Administrator's linked bank account as its funding source (₹0 starting balance)
      const result = await createCustomFamily(registeredUserId, groupName, 0);
      setCreatedFamilyResult({
        familyId: result.family.id,
        familyName: result.family.name,
        joiningCode: result.joiningCode,
        balancePaise: 0,
      });
    } catch (err: any) {
      setGeneralError(err.message || 'Failed to create family group.');
    }
  };

  // ---------------------------------------------------------
  // HANDLER: Step 4B Verify Code
  // ---------------------------------------------------------
  const handleVerifyCode = () => {
    setJoinCodeError(null);
    setVerifiedFamily(null);

    if (!joiningCodeInput.trim()) {
      setJoinCodeError('Please enter a Family Joining Code.');
      return;
    }

    setIsVerifyingCode(true);
    const res = verifyJoiningCode(joiningCodeInput.trim());
    setIsVerifyingCode(false);

    if (res.valid && res.family) {
      setVerifiedFamily({
        familyId: res.family.id,
        familyName: res.family.name,
        adminName: res.adminName || 'Family Administrator',
      });
    } else {
      setJoinCodeError(res.error || 'Invalid or expired Family Joining Code.');
    }
  };

  // ---------------------------------------------------------
  // HANDLER: Step 4B Submit Membership Request
  // ---------------------------------------------------------
  const handleSubmitMembershipRequest = async () => {
    if (!registeredUserId) {
      setGeneralError('User session not found.');
      setCurrentStep(1);
      return;
    }

    if (!verifiedFamily) return;

    setIsSubmittingJoin(true);
    const res = await submitMembershipRequest(registeredUserId, joiningCodeInput.trim());
    setIsSubmittingJoin(false);

    if (res.success && res.request) {
      setIsPendingApproval(true);
      setPendingFamilyName(verifiedFamily.familyName);
    } else {
      setJoinCodeError(res.error || 'Failed to submit membership request.');
    }
  };

  // ---------------------------------------------------------
  // HANDLER: Check Pending Approval Status
  // ---------------------------------------------------------
  const handleCheckApprovalStatus = () => {
    if (!registeredUserId) return;
    const statusResult = checkUserMembershipStatus(registeredUserId);

    if (statusResult.status === 'ACTIVE') {
      // User was approved by Administrator! Enter dashboard
      switchUser(registeredUserId);
      setConnectionModalData({
        familyName: statusResult.family?.name || 'PayPal Family',
        role: 'member',
        adminName: 'Family Administrator',
      });
      setIsConnectionModalOpen(true);
    } else if (statusResult.status === 'REJECTED') {
      alert('Your membership request was declined by the administrator. You may join another family or create your own.');
      setIsPendingApproval(false);
      setVerifiedFamily(null);
    } else {
      alert('Your membership request is still PENDING approval from the Family Administrator.');
    }
  };

  // Helper: Copy Joining Code to Clipboard
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeSuccess(true);
    setTimeout(() => setCopiedCodeSuccess(false), 2200);
  };

  const linkedBankName = currentUser?.bankAccount?.bankName || selectedBank || 'HDFC Bank';
  const linkedAccountMasked = currentUser?.bankAccount?.accountNumber || maskedAccountDisplay || '•••• •••• 1048';

  return (
    <div className="min-h-screen bg-fintech-bg flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      {/* Header Logo */}
      <div className="sm:mx-auto sm:w-full sm:max-w-xl text-center mb-6">
        <Link to="/" className="inline-flex items-center gap-2 mb-3 group">
          <div className="w-10 h-10 rounded-xl bg-fintech-primary flex items-center justify-center text-white font-bold text-xl shadow-sm group-hover:scale-105 transition-transform">
            P
          </div>
          <span className="font-bold text-2xl text-fintech-navy">PayPal</span>
          <span className="font-bold text-2xl text-fintech-primary">Family</span>
        </Link>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-fintech-navy tracking-tight">
          New User Registration
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-fintech-muted">
          Complete individual account verification, link your simulated bank, and configure family membership.
        </p>

        {/* Step Progress Indicators */}
        <div className="mt-6 grid grid-cols-4 gap-2 max-w-md mx-auto">
          {[
            { step: 1, label: 'Mobile' },
            { step: 2, label: 'Bank' },
            { step: 3, label: 'Action' },
            { step: 4, label: 'Family' },
          ].map((item) => {
            const isCompleted = currentStep > item.step;
            const isCurrent = currentStep === item.step;
            return (
              <div key={item.step} className="text-center">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    isCompleted
                      ? 'bg-fintech-success'
                      : isCurrent
                      ? 'bg-fintech-primary ring-2 ring-blue-200'
                      : 'bg-slate-200'
                  }`}
                />
                <span
                  className={`text-[10px] mt-1 block font-semibold ${
                    isCurrent ? 'text-fintech-primary' : isCompleted ? 'text-emerald-700' : 'text-slate-400'
                  }`}
                >
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-xl">
        <Card className="shadow-elevated p-6 sm:p-8">
          {generalError && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-fintech-error flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-fintech-error shrink-0 mt-0.5" />
              <span>{generalError}</span>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 1: MOBILE REGISTRATION WITH SIMULATED OTP */}
          {/* ========================================================= */}
          {currentStep === 1 && (
            <div>
              <div className="mb-5 pb-3 border-b border-fintech-border/70">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-fintech-navy">Step 1: Mobile Registration</h3>
                    <p className="text-xs text-fintech-muted">Create your individual user profile with mobile verification.</p>
                  </div>
                  <Badge variant="primary">Step 1 of 4</Badge>
                </div>
              </div>

              {!isOTPSent ? (
                <form onSubmit={handleSendOTP} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-fintech-navy mb-1.5">
                      Full Legal Name
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. David Miller"
                      required
                      className="w-full px-3.5 py-2.5 rounded-lg border border-fintech-border text-sm focus:outline-none focus:ring-2 focus:ring-fintech-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-fintech-navy mb-1.5">
                      Mobile Number with Country Code
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                      <div className="sm:col-span-2">
                        <CountrySelector
                          selectedCountry={selectedCountry}
                          onChange={(c) => {
                            setSelectedCountry(c);
                            setCountryCode(c.dialCode);
                          }}
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <input
                          type="tel"
                          value={mobileNumber}
                          onChange={(e) => setMobileNumber(e.target.value)}
                          placeholder={selectedCountry.placeholder}
                          required
                          className="w-full h-full min-h-[42px] px-3.5 py-2 rounded-lg border border-fintech-border text-sm focus:outline-none focus:ring-2 focus:ring-fintech-primary font-mono tracking-wide"
                        />
                      </div>
                    </div>
                    <p className="text-[11px] text-fintech-muted mt-1">
                      Selected: <strong>{selectedCountry.name} ({selectedCountry.dialCode})</strong> • Valid digits: {selectedCountry.minDigits}{selectedCountry.minDigits !== selectedCountry.maxDigits ? `-${selectedCountry.maxDigits}` : ''}
                    </p>
                    <p className="text-[11px] text-fintech-muted mt-0.5">
                      A simulated OTP will be delivered instantly to verify this number.
                    </p>
                  </div>

                  {otpError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-fintech-error flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-fintech-error shrink-0 mt-0.5" />
                      <span>{otpError}</span>
                    </div>
                  )}

                  <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-fintech-navy flex items-start gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-fintech-primary shrink-0 mt-0.5" />
                    <span>
                      Supports unlimited individual registrations. Each registration creates an independent profile and wallet.
                    </span>
                  </div>

                  <Button type="submit" variant="primary" size="lg" className="w-full mt-2">
                    Send Verification Code (OTP) &rarr;
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOTP} className="space-y-4">
                  {/* Simulated SMS Notification Banner */}
                  <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                        <Phone className="w-4 h-4 text-emerald-600" />
                        <span>Simulated SMS Delivered</span>
                      </div>
                      <Badge variant="primary" size="sm">Instant Delivery</Badge>
                    </div>
                    <p className="text-xs text-emerald-800">
                      Message sent to <strong>{countryCode} {mobileNumber}</strong>:
                    </p>
                    <div className="p-2.5 bg-white border border-emerald-200 rounded-lg flex items-center justify-between">
                      <span className="font-mono text-sm tracking-widest font-extrabold text-emerald-950">
                        {generatedOTP}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (generatedOTP) setEnteredOTP(generatedOTP);
                        }}
                        className="text-[11px] font-bold text-fintech-primary hover:underline bg-blue-50 px-2 py-1 rounded border border-blue-200"
                      >
                        Auto-fill OTP
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-fintech-navy mb-1.5">
                      Enter 6-Digit Verification Code
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={enteredOTP}
                      onChange={(e) => setEnteredOTP(e.target.value.replace(/\D/g, ''))}
                      placeholder="e.g. 582910"
                      required
                      autoFocus
                      className="w-full text-center text-xl font-mono tracking-widest py-3 rounded-lg border border-fintech-border focus:outline-none focus:ring-2 focus:ring-fintech-primary"
                    />
                  </div>

                  {otpError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-fintech-error flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-fintech-error shrink-0 mt-0.5" />
                      <span>{otpError}</span>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      onClick={() => setIsOTPSent(false)}
                      className="w-1/3"
                    >
                      Back
                    </Button>
                    <Button type="submit" variant="primary" size="lg" className="w-2/3">
                      Verify & Create Account &rarr;
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 2: ADD BANK ACCOUNT (PREMIUM FINTECH SELECTION & VERIFICATION) */}
          {/* ========================================================= */}
          {currentStep === 2 && (
            <div>
              <BankLinkingExperience
                initialAccountHolderName={accountHolderName || fullName}
                userMobile={mobileNumber}
                userCountryCode={countryCode}
                initialSubStep={(searchParams.get('bankSubStep') as any) || undefined}
                onBankLinked={async (bankData) => {
                  if (!registeredUserId) {
                    setGeneralError('User session expired. Please register your mobile number.');
                    setCurrentStep(1);
                    return;
                  }
                  try {
                    const updatedUser = await linkBankAccount(registeredUserId, bankData);
                    if (updatedUser.bankAccount) {
                      setMaskedAccountDisplay(updatedUser.bankAccount.accountNumber);
                    }
                    setCurrentStep(3); // Advance to Step 3: Choose Family Action
                  } catch (err: any) {
                    setGeneralError(err.message || 'Failed to link bank account.');
                  }
                }}
                onBack={() => setCurrentStep(1)}
              />
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 3: CHOOSE FAMILY ACTION (CREATE vs JOIN) */}
          {/* ========================================================= */}
          {currentStep === 3 && (
            <div>
              <div className="mb-5 pb-3 border-b border-fintech-border/70">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-fintech-navy">Step 3: Choose Family Action</h3>
                    <p className="text-xs text-fintech-muted">Select how you want to participate in PayPal Family.</p>
                  </div>
                  <Badge variant="primary">Step 3 of 4</Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* OPTION A: CREATE FAMILY */}
                <div
                  onClick={() => {
                    setStep4Mode('create');
                    setCurrentStep(4);
                  }}
                  className="group cursor-pointer rounded-2xl border-2 border-fintech-border hover:border-fintech-primary p-5 text-left transition-all hover:shadow-card-hover bg-slate-50/60 hover:bg-white flex flex-col justify-between"
                >
                  <div>
                    <div className="w-12 h-12 rounded-xl bg-blue-100 text-fintech-primary flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                      <Users className="w-6 h-6" />
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-base font-bold text-fintech-navy group-hover:text-fintech-primary">
                        Create Family
                      </h4>
                      <Badge variant="primary" size="sm">
                        Admin
                      </Badge>
                    </div>
                    <p className="text-xs text-fintech-muted leading-relaxed">
                      You become the <strong>Family Administrator</strong>. Manage a central family pool, approve requests, configure member spending limits, and view transactions.
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-200 flex items-center justify-between text-xs font-bold text-fintech-primary">
                    <span>Create Family Hub</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>

                {/* OPTION B: JOIN FAMILY */}
                <div
                  onClick={() => {
                    setStep4Mode('join');
                    setCurrentStep(4);
                  }}
                  className="group cursor-pointer rounded-2xl border-2 border-fintech-border hover:border-emerald-600 p-5 text-left transition-all hover:shadow-card-hover bg-slate-50/60 hover:bg-white flex flex-col justify-between"
                >
                  <div>
                    <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                      <Lock className="w-6 h-6" />
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-base font-bold text-fintech-navy group-hover:text-emerald-700">
                        Join Family
                      </h4>
                      <Badge variant="neutral" size="sm">
                        Member
                      </Badge>
                    </div>
                    <p className="text-xs text-fintech-muted leading-relaxed">
                      Enter a <strong>Family Joining Code</strong> from your Administrator. Request membership and access spending allowances once approved.
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-200 flex items-center justify-between text-xs font-bold text-emerald-700">
                    <span>Join with Code</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-fintech-border text-center">
                <Button variant="ghost" size="sm" onClick={() => setCurrentStep(2)}>
                  &larr; Back to Bank Setup
                </Button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 4A: CREATE FAMILY FORM & GENERATE CODE */}
          {/* ========================================================= */}
          {currentStep === 4 && step4Mode === 'create' && !createdFamilyResult && (
            <div>
              <div className="mb-5 pb-3 border-b border-fintech-border/70">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-fintech-navy">Step 4A: Create Family Hub</h3>
                    <p className="text-xs text-fintech-muted">Set up your group name and connect your verified administrator funding source.</p>
                  </div>
                  <Badge variant="primary">Step 4 of 4</Badge>
                </div>
              </div>

              <form onSubmit={handleCreateFamilySubmit} className="space-y-4">
                {/* 1. Family Group Name */}
                <div>
                  <label className="block text-xs font-semibold text-fintech-navy mb-1.5">
                    Family Group Name
                  </label>
                  <input
                    type="text"
                    value={familyName}
                    onChange={(e) => setFamilyName(e.target.value)}
                    placeholder="e.g. The Miller Family"
                    required
                    className="w-full px-3.5 py-2.5 rounded-lg border border-fintech-border text-sm focus:outline-none focus:ring-2 focus:ring-fintech-primary"
                  />
                </div>

                {/* 2. Administrator Full Name (automatically filled) */}
                <div>
                  <label className="block text-xs font-semibold text-fintech-navy mb-1.5">
                    Administrator Full Name (Auto-filled)
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    readOnly
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-slate-100 text-slate-700 text-sm font-semibold cursor-not-allowed"
                  />
                </div>

                {/* 3. Display the already linked and verified bank account */}
                <div>
                  <label className="block text-xs font-semibold text-fintech-navy mb-1.5">
                    Linked & Verified Bank Account
                  </label>
                  <div className="p-3.5 bg-gradient-to-r from-blue-50/70 to-slate-50 border border-blue-200/80 rounded-xl flex items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-3">
                      <VerifiedBankLogo bankId={linkedBankName} size="md" isVerified={true} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-fintech-navy">{linkedBankName}</span>
                          <Badge variant="success" size="sm">Verified</Badge>
                        </div>
                        <p className="text-xs text-fintech-muted font-mono tracking-wide mt-0.5">
                          Account: {linkedAccountMasked}
                        </p>
                      </div>
                    </div>
                    <div className="text-right hidden sm:block">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Source</span>
                      <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1 justify-end">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Primary Funding
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4. Notice: Your family will use the Administrator's linked account as its funding source. No initial family deposit is required. */}
                <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-fintech-navy flex items-start gap-2.5">
                  <ShieldCheck className="w-4.5 h-4.5 text-fintech-primary shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-fintech-navy">
                      Your family will use the Administrator's linked account as its funding source. No initial family deposit is required.
                    </p>
                    <p className="text-[11px] text-fintech-muted">
                      On submission, a unique <strong>Family Joining Code</strong> will be generated. You can share it with family members to let them request membership.
                    </p>
                  </div>
                </div>

                {/* 5. Create Family & Generate Code button */}
                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={() => setCurrentStep(3)}
                    className="w-1/3"
                  >
                    Back
                  </Button>
                  <Button type="submit" variant="primary" size="lg" className="w-2/3">
                    Create Family & Generate Code &rarr;
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 4A SUCCESS: CODE GENERATED & DASHBOARD BUTTON */}
          {/* ========================================================= */}
          {currentStep === 4 && step4Mode === 'create' && createdFamilyResult && (
            <div className="space-y-5 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <h3 className="text-xl font-extrabold text-fintech-navy">Family Hub Created Successfully!</h3>
                <p className="text-xs text-fintech-muted mt-1">
                  You are now the Family Administrator of <strong>{createdFamilyResult.familyName}</strong>.
                </p>
              </div>

              {/* Unique Joining Code Box */}
              <div className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-dashed border-fintech-primary/50 rounded-2xl max-w-md mx-auto text-center space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-fintech-muted block">
                  Family Unique Joining Code
                </span>
                <div className="font-mono text-3xl font-extrabold tracking-widest text-fintech-navy">
                  {createdFamilyResult.joiningCode}
                </div>
                <p className="text-xs text-fintech-muted">
                  Share this code with your family members. They will enter it during registration to request membership.
                </p>
                <div className="pt-2">
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => handleCopyCode(createdFamilyResult.joiningCode)}
                    icon={<Copy className="w-4 h-4" />}
                    className="mx-auto"
                  >
                    {copiedCodeSuccess ? 'Copied to Clipboard!' : 'Copy Joining Code'}
                  </Button>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-fintech-muted flex items-center justify-around">
                <div>
                  <span className="text-[10px] uppercase font-bold block">Primary Funding Source</span>
                  <strong className="text-fintech-navy text-sm font-bold flex items-center gap-1 justify-center">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline" />
                    {linkedBankName}
                  </strong>
                </div>
                <div className="h-6 w-px bg-slate-200" />
                <div>
                  <span className="text-[10px] uppercase font-bold block">Administrator</span>
                  <strong className="text-fintech-navy text-sm font-bold">{fullName}</strong>
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    setConnectionModalData({
                      familyName: createdFamilyResult.familyName,
                      role: 'owner',
                      joiningCode: createdFamilyResult.joiningCode,
                      adminName: fullName,
                    });
                    setIsConnectionModalOpen(true);
                  }}
                  icon={<Sparkles className="w-4 h-4 text-fintech-primary" />}
                  className="w-1/2"
                >
                  Family Connected
                </Button>
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleProceedToDashboard}
                  className="w-1/2"
                >
                  Dashboard &rarr;
                </Button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 4B: JOIN FAMILY (CODE VERIFICATION & REQUEST APPROVAL) */}
          {/* ========================================================= */}
          {currentStep === 4 && step4Mode === 'join' && !isPendingApproval && (
            <div>
              <div className="mb-5 pb-3 border-b border-fintech-border/70">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-fintech-navy">Step 4B: Join Existing Family</h3>
                    <p className="text-xs text-fintech-muted">Enter the joining code provided by your Family Administrator.</p>
                  </div>
                  <Badge variant="neutral">Member Path</Badge>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-fintech-navy mb-1.5">
                    Family Joining Code
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={joiningCodeInput}
                      onChange={(e) => setJoiningCodeInput(e.target.value.toUpperCase())}
                      placeholder="e.g. JOIN-8K92A"
                      className="flex-1 px-3.5 py-2.5 rounded-lg border border-fintech-border text-sm font-mono uppercase tracking-wider font-bold focus:outline-none focus:ring-2 focus:ring-fintech-primary"
                    />
                    <Button
                      type="button"
                      variant="primary"
                      size="md"
                      onClick={handleVerifyCode}
                      isLoading={isVerifyingCode}
                    >
                      Verify Code
                    </Button>
                  </div>
                </div>

                {joinCodeError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-fintech-error flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-fintech-error shrink-0 mt-0.5" />
                    <span>{joinCodeError}</span>
                  </div>
                )}

                {/* Verified Family Card */}
                {verifiedFamily && (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        <h4 className="text-sm font-bold text-emerald-950">Matching Family Group Found</h4>
                      </div>
                      <Badge variant="simulated">Verified</Badge>
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-emerald-200/80 text-xs text-emerald-900 space-y-1">
                      <div className="text-sm font-bold text-fintech-navy">{verifiedFamily.familyName}</div>
                      <div>Administrator: <strong className="text-fintech-text">{verifiedFamily.adminName}</strong></div>
                      <div className="text-[11px] text-fintech-muted">Code: <span className="font-mono">{joiningCodeInput}</span></div>
                    </div>

                    <Button
                      type="button"
                      variant="primary"
                      size="lg"
                      onClick={handleSubmitMembershipRequest}
                      isLoading={isSubmittingJoin}
                      className="w-full bg-emerald-600 hover:bg-emerald-700"
                    >
                      Request Membership to Join Family &rarr;
                    </Button>
                  </div>
                )}

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-fintech-muted space-y-1">
                  <div className="font-semibold text-fintech-navy">How approval works:</div>
                  <p>
                    After requesting membership, your status will become <strong>Pending Approval</strong>. The Family Administrator will be notified in their dashboard to approve your access.
                  </p>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={() => setCurrentStep(3)}
                    className="w-full"
                  >
                    Back to Action Selection
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 4B: PENDING APPROVAL SCREEN */}
          {/* ========================================================= */}
          {currentStep === 4 && step4Mode === 'join' && isPendingApproval && (
            <div className="space-y-5 text-center py-2">
              <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto animate-pulse">
                <Clock className="w-9 h-9" />
              </div>

              <div>
                <Badge variant="simulated" size="md" className="bg-amber-100 text-amber-800 border-amber-300">
                  Pending Administrator Approval
                </Badge>
                <h3 className="text-xl font-extrabold text-fintech-navy mt-3">
                  Membership Request Submitted
                </h3>
                <p className="text-xs text-fintech-muted max-w-md mx-auto mt-1">
                  Your request to join <strong>{pendingFamilyName || 'your family group'}</strong> has been delivered.
                </p>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl max-w-md mx-auto text-left text-xs text-fintech-text space-y-2">
                <div className="flex items-center gap-2 text-fintech-navy font-bold">
                  <UserCheck className="w-4 h-4 text-fintech-primary" />
                  <span>Next Steps:</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-fintech-muted">
                  <li>Ask your Family Administrator to open their <strong>Family Management</strong> dashboard.</li>
                  <li>The Administrator will review and approve your membership request.</li>
                  <li>Once approved, your personal wallet and spending allowance will activate automatically.</li>
                </ul>
              </div>

              <div className="space-y-2 pt-2">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleCheckApprovalStatus}
                  icon={<RefreshCw className="w-4 h-4" />}
                  className="w-full"
                >
                  Check Approval Status
                </Button>

                <Button
                  variant="outline"
                  size="md"
                  onClick={() => navigate('/')}
                  className="w-full"
                >
                  Return to Landing Page
                </Button>
              </div>
            </div>
          )}

          {/* Bottom Link for Returning Users */}
          <div className="mt-6 pt-4 border-t border-fintech-border text-center text-xs text-fintech-muted">
            Already have an account?{' '}
            <Link to="/login" className="text-fintech-primary font-bold hover:underline">
              Log In with Mobile Number &rarr;
            </Link>
          </div>
        </Card>
      </div>

      {/* Premium Family Connection Feedback Modal */}
      {connectionModalData && (
        <FamilyConnectionModal
          isOpen={isConnectionModalOpen}
          onClose={() => setIsConnectionModalOpen(false)}
          onContinueToDashboard={() => {
            setIsConnectionModalOpen(false);
            handleProceedToDashboard();
          }}
          familyName={connectionModalData.familyName}
          role={connectionModalData.role}
          userName={fullName || 'Family User'}
          joiningCode={connectionModalData.joiningCode}
          adminName={connectionModalData.adminName}
        />
      )}

      {/* Post-Registration 6-Digit Transaction PIN Setup Modal */}
      <TransactionPinModal
        isOpen={isPinModalOpen}
        onClose={() => navigate('/dashboard')}
        onSuccess={() => navigate('/dashboard')}
        title="Create 6-Digit Transaction PIN"
        description="Set up your 6-digit PIN to securely authorize future payments and transfers"
        actionLabel="Save PIN & Enter Dashboard"
      />
    </div>
  );
};
