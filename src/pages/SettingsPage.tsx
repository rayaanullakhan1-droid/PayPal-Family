import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Settings,
  RotateCcw,
  ShieldCheck,
  AlertTriangle,
  Server,
  Key,
  CheckCircle2,
  ExternalLink,
  Code2,
  Database,
  Lock,
  User,
  Bell,
  Globe,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Edit3,
  Smartphone,
  Mail,
  Info,
  LogOut,
  Check,
  Sliders,
  Sparkles,
  Eye,
  EyeOff,
  Shield,
  FileText,
  UserMinus,
  Trash2,
  Search,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../context/I18nContext';
import { payPalSandboxService } from '../services/paypalSandboxService';
import { validatePinFormat } from '../utils/security';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { CountrySelector } from '../components/common/CountrySelector';
import { getCountryByCode, validatePhoneNumber, CountryData } from '../utils/countries';

interface AppNotificationSettings {
  paymentNotifications: boolean;
  transactionAlerts: boolean;
  spendingLimitAlerts: boolean;
  exceptionRequestAlerts: boolean;
}

const DEFAULT_NOTIFICATIONS: AppNotificationSettings = {
  paymentNotifications: true,
  transactionAlerts: true,
  spendingLimitAlerts: true,
  exceptionRequestAlerts: true,
};

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    currentUser,
    family,
    isCustomUser,
    resetDemoData,
    updateUserProfile,
    changeUserPin,
    setUserPin,
    leaveFamily,
    deleteAccount,
  } = useApp();
  const { theme, setTheme } = useTheme();
  const { language, setLanguage, supportedLanguages, t } = useI18n();

  // Active Tab: 'account' | 'app' | 'system'
  const initialTab = (searchParams.get('tab') as 'account' | 'app' | 'system') || 'account';
  const [activeTab, setActiveTab] = useState<'account' | 'app' | 'system'>(initialTab);

  // Sync tab with URL
  const handleTabChange = (tab: 'account' | 'app' | 'system') => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // -------------------------------------------------------------
  // ACCOUNT SETTINGS STATE
  // -------------------------------------------------------------
  // Profile edit
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState(currentUser.name);
  const [profileCountry, setProfileCountry] = useState<CountryData>(() =>
    getCountryByCode(currentUser.country || currentUser.phone || '+91')
  );
  const [profilePhone, setProfilePhone] = useState(currentUser.phone || '9876543210');
  const [profilePhoneError, setProfilePhoneError] = useState<string | null>(null);
  const [profileSaveSuccess, setProfileSaveSuccess] = useState(false);

  useEffect(() => {
    setProfileName(currentUser.name);
    const countryObj = getCountryByCode(currentUser.country || currentUser.phone || '+91');
    setProfileCountry(countryObj);
    if (currentUser.phone) {
      const cleanDigits = currentUser.phone.replace(countryObj.dialCode, '').trim();
      setProfilePhone(cleanDigits || currentUser.phone);
    }
  }, [currentUser]);

  // Change PIN state
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [showPins, setShowPins] = useState(false);
  const [pinChangeError, setPinChangeError] = useState<string | null>(null);
  const [pinChangeSuccess, setPinChangeSuccess] = useState(false);

  // Leave Family state (Members only)
  const [isLeaveFamilyModalOpen, setIsLeaveFamilyModalOpen] = useState(false);
  const [leaveFamilyLoading, setLeaveFamilyLoading] = useState(false);
  const [leaveFamilyError, setLeaveFamilyError] = useState<string | null>(null);

  // Delete Account state (PIN Verified)
  const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] = useState(false);
  const [deletePinInput, setDeletePinInput] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeletePin, setShowDeletePin] = useState(false);

  // -------------------------------------------------------------
  // APPLICATION SETTINGS STATE
  // -------------------------------------------------------------
  const [notifications, setNotifications] = useState<AppNotificationSettings>(() => {
    try {
      const saved = localStorage.getItem('pf_app_notifications');
      return saved ? JSON.parse(saved) : DEFAULT_NOTIFICATIONS;
    } catch {
      return DEFAULT_NOTIFICATIONS;
    }
  });
  const [notificationSavedMsg, setNotificationSavedMsg] = useState(false);

  const [languageSearch, setLanguageSearch] = useState('');

  // FAQ Accordion State
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  // Modals state
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  const checklist = payPalSandboxService.getReadinessChecklist();

  // Filtered languages for search
  const filteredLanguages = supportedLanguages.filter((l) => {
    if (!languageSearch.trim()) return true;
    const q = languageSearch.toLowerCase().trim();
    return (
      l.name.toLowerCase().includes(q) ||
      l.nativeName.toLowerCase().includes(q) ||
      l.code.toLowerCase().includes(q) ||
      (l.region && l.region.toLowerCase().includes(q))
    );
  });

  // -------------------------------------------------------------
  // ACCOUNT HANDLERS
  // -------------------------------------------------------------
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName.trim()) return;

    setProfilePhoneError(null);
    const phoneVal = validatePhoneNumber(profileCountry, profilePhone);
    if (!phoneVal.valid) {
      setProfilePhoneError(phoneVal.error || `Please enter a valid phone number for ${profileCountry.name}.`);
      return;
    }

    const cleanDigits = profilePhone.replace(/\D/g, '');
    const formattedPhone = `${profileCountry.dialCode} ${cleanDigits}`;

    updateUserProfile({
      name: profileName.trim(),
      phone: formattedPhone,
      mobile: cleanDigits,
      country: profileCountry.name,
    });
    setIsEditingProfile(false);
    setProfileSaveSuccess(true);
    setTimeout(() => setProfileSaveSuccess(false), 3000);
  };

  const handleChangePin = (e: React.FormEvent) => {
    e.preventDefault();
    setPinChangeError(null);
    setPinChangeSuccess(false);

    // Validate new PIN format
    const val = validatePinFormat(newPinInput);
    if (!val.valid) {
      setPinChangeError(val.error || 'New PIN must be 6 numeric digits.');
      return;
    }

    if (newPinInput !== confirmPinInput) {
      setPinChangeError('New PIN and confirmation PIN do not match.');
      return;
    }

    // Call changeUserPin
    const res = changeUserPin(currentPinInput, newPinInput);
    if (res.success) {
      setPinChangeSuccess(true);
      setCurrentPinInput('');
      setNewPinInput('');
      setConfirmPinInput('');
      setTimeout(() => setPinChangeSuccess(false), 4000);
    } else {
      setPinChangeError(res.error || 'Failed to update transaction PIN.');
    }
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to log out of PayPal Family?')) {
      navigate('/login');
    }
  };

  const handleConfirmLeaveFamily = async () => {
    setLeaveFamilyLoading(true);
    setLeaveFamilyError(null);
    try {
      const res = await leaveFamily();
      if (res.success) {
        setIsLeaveFamilyModalOpen(false);
        navigate('/register?step=3&mode=create');
      } else {
        setLeaveFamilyError(res.error || 'Failed to leave family.');
      }
    } catch (err: any) {
      setLeaveFamilyError(err?.message || 'Unexpected error occurred.');
    } finally {
      setLeaveFamilyLoading(false);
    }
  };

  const handleConfirmDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (deletePinInput.length !== 6) {
      setDeleteError('Please enter your complete 6-digit transaction PIN.');
      return;
    }
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const res = await deleteAccount(deletePinInput);
      if (res.success) {
        setIsDeleteAccountModalOpen(false);
        navigate('/');
      } else {
        setDeleteError(res.error || 'PIN verification failed. Account was not deleted.');
      }
    } catch (err: any) {
      setDeleteError(err?.message || 'Unexpected error occurred during verification.');
    } finally {
      setDeleteLoading(false);
    }
  };

  // -------------------------------------------------------------
  // APPLICATION HANDLERS
  // -------------------------------------------------------------
  const handleToggleNotification = (key: keyof AppNotificationSettings) => {
    setNotifications((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem('pf_app_notifications', JSON.stringify(updated));
      } catch {}
      setNotificationSavedMsg(true);
      setTimeout(() => setNotificationSavedMsg(false), 2000);
      return updated;
    });
  };

  const toggleFaq = (index: number) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  // -------------------------------------------------------------
  // SYSTEM HANDLERS
  // -------------------------------------------------------------
  const handleReset = () => {
    if (window.confirm('Restore all demo balances, family members, limits, and transactions to default settings?')) {
      resetDemoData();
      setResetDone(true);
      setTimeout(() => setResetDone(false), 3000);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Title */}
      <div className="pb-2 border-b border-fintech-border/70">
        <h1 className="text-2xl sm:text-3xl font-bold text-fintech-navy tracking-tight">Settings & Controls</h1>
        <p className="text-xs sm:text-sm text-fintech-muted mt-0.5">
          Manage your account profile, 6-digit transaction PIN, notifications, and application preferences.
        </p>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-fintech-border gap-2">
        <button
          onClick={() => handleTabChange('account')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'account'
              ? 'border-fintech-primary text-fintech-primary'
              : 'border-transparent text-fintech-muted hover:text-fintech-text'
          }`}
        >
          <User className="w-4 h-4" />
          <span>Account Settings</span>
        </button>

        <button
          onClick={() => handleTabChange('app')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'app'
              ? 'border-fintech-primary text-fintech-primary'
              : 'border-transparent text-fintech-muted hover:text-fintech-text'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Application Settings</span>
        </button>

        <button
          onClick={() => handleTabChange('system')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'system'
              ? 'border-fintech-primary text-fintech-primary'
              : 'border-transparent text-fintech-muted hover:text-fintech-text'
          }`}
        >
          <Server className="w-4 h-4" />
          <span>System & Architecture</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: ACCOUNT SETTINGS                                   */}
      {/* ========================================================= */}
      {activeTab === 'account' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Profile & Info */}
          <div className="space-y-5 lg:col-span-1">
            {/* Active Persona Card */}
            <Card>
              <div className="flex items-center justify-between pb-3 border-b border-fintech-border/70 mb-4">
                <h2 className="text-xs font-bold text-fintech-navy uppercase tracking-wider">
                  Profile Information
                </h2>
                <Badge variant={currentUser.role === 'owner' ? 'primary' : 'neutral'} size="sm">
                  {currentUser.role === 'owner' ? 'Administrator' : 'Family Member'}
                </Badge>
              </div>

              <div className="flex flex-col items-center text-center mb-4">
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.name}
                  className="w-20 h-20 rounded-full object-cover ring-4 ring-blue-100 mb-2 shadow-xs"
                />
                <h3 className="text-lg font-bold text-fintech-navy">{currentUser.name}</h3>
                <p className="text-xs text-fintech-muted">{currentUser.email}</p>
                <div className="text-[11px] font-mono text-slate-500 mt-1 flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{currentUser.phone || `${profileCountry.dialCode} 9876543210`}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-fintech-border text-xs text-fintech-muted space-y-2">
                <div className="flex justify-between">
                  <span>Country / Region:</span>
                  <span className="text-fintech-text font-medium flex items-center gap-1.5">
                    <span>{profileCountry.flag}</span>
                    <span>{currentUser.country || profileCountry.name}</span>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Family Group:</span>
                  <strong className="text-fintech-text">{family.name}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Relationship:</span>
                  <strong className="text-fintech-text">{currentUser.relationship}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Account ID:</span>
                  <span className="font-mono text-[11px] text-slate-500">{currentUser.id}</span>
                </div>
              </div>

              {profileSaveSuccess && (
                <div className="mt-3 p-2.5 bg-emerald-50 border border-emerald-200 text-fintech-success rounded-lg text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Profile updated successfully!</span>
                </div>
              )}

              <div className="mt-4 pt-3 border-t border-fintech-border flex flex-col gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Edit3 className="w-3.5 h-3.5 text-fintech-primary" />}
                  onClick={() => setIsEditingProfile(!isEditingProfile)}
                  className="w-full"
                >
                  {isEditingProfile ? 'Cancel Editing' : 'Edit Profile Name, Country & Phone'}
                </Button>

                <Button
                  variant="danger"
                  size="sm"
                  icon={<LogOut className="w-3.5 h-3.5" />}
                  onClick={handleLogout}
                  className="w-full"
                >
                  Log Out
                </Button>
              </div>
            </Card>

            {/* Edit Profile Form (if toggled) */}
            {isEditingProfile && (
              <Card className="border-blue-200 bg-blue-50/30">
                <form onSubmit={handleSaveProfile} className="space-y-3">
                  <h3 className="text-xs font-bold text-fintech-navy uppercase tracking-wider">
                    Edit Profile Details
                  </h3>

                  <div>
                    <label className="block text-xs font-semibold text-fintech-navy mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-fintech-border text-xs focus:outline-none focus:ring-2 focus:ring-fintech-primary bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-fintech-navy mb-1">
                      Country Name with International Calling Code
                    </label>
                    <CountrySelector
                      selectedCountry={profileCountry}
                      onSelectCountry={(c: CountryData) => {
                        setProfileCountry(c);
                        setProfilePhoneError(null);
                      }}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-fintech-navy mb-1">
                      Mobile Number
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs font-mono font-semibold text-slate-500">
                        {profileCountry.dialCode}
                      </span>
                      <input
                        type="tel"
                        required
                        value={profilePhone}
                        placeholder={profileCountry.placeholder}
                        onChange={(e) => {
                          setProfilePhone(e.target.value);
                          setProfilePhoneError(null);
                        }}
                        className="w-full pl-16 pr-3 py-2 rounded-lg border border-fintech-border text-xs focus:outline-none focus:ring-2 focus:ring-fintech-primary bg-white"
                      />
                    </div>
                    {profilePhoneError ? (
                      <p className="text-[11px] text-red-600 mt-1 font-medium">{profilePhoneError}</p>
                    ) : (
                      <p className="text-[11px] text-fintech-muted mt-1">
                        Expected digits: {profileCountry.minDigits === profileCountry.maxDigits ? `${profileCountry.minDigits} digits` : `${profileCountry.minDigits}-${profileCountry.maxDigits} digits`} (e.g. {profileCountry.placeholder})
                      </p>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditingProfile(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" variant="primary" size="sm">
                      Save Profile
                    </Button>
                  </div>
                </form>
              </Card>
            )}
          </div>

          {/* Right Column: Transaction PIN Management & Security Status */}
          <div className="space-y-5 lg:col-span-2">
            {/* Transaction PIN Management Card */}
            <Card>
              <div className="flex items-center justify-between pb-3 border-b border-fintech-border/70 mb-4">
                <div>
                  <h2 className="text-base font-bold text-fintech-navy flex items-center gap-2">
                    <Key className="w-5 h-5 text-fintech-primary" />
                    Six-Digit Transaction PIN
                  </h2>
                  <p className="text-xs text-fintech-muted">
                    Required for spending money, transfers, and QR merchant payments
                  </p>
                </div>
                <Badge variant="success" size="sm">
                  PIN Active
                </Badge>
              </div>

              {/* Status Banner */}
              <div className="p-3.5 bg-blue-50/90 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded-xl text-xs text-blue-950 dark:text-blue-100 flex items-start gap-3 mb-5">
                <ShieldCheck className="w-5 h-5 text-fintech-primary dark:text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-blue-950 dark:text-white">Cryptographically Salted & Hashed (SHA-256)</div>
                  <p className="text-slate-700 dark:text-blue-200 mt-0.5 leading-relaxed font-normal">
                    Your 6-digit transaction PIN protects your funds across all devices.{' '}
                    {!isCustomUser && (
                      <>
                        Pre-seeded demo accounts (Rajesh, Priya, Aarav) default to demo PIN{' '}
                        <code className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded text-fintech-primary dark:text-blue-400 font-bold border border-blue-200 dark:border-blue-800">
                          123456
                        </code>
                        .{' '}
                      </>
                    )}
                    You can change your PIN below at any time.
                  </p>
                </div>
              </div>

              {/* Success Notification */}
              {pinChangeSuccess && (
                <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 text-fintech-success rounded-xl text-xs flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <span className="font-semibold">
                    Transaction PIN changed successfully! Your new 6-digit PIN is now active for all financial authorizations.
                  </span>
                </div>
              )}

              {/* Error Notification */}
              {pinChangeError && (
                <div className="mb-4 p-3.5 bg-red-50 border border-red-200 text-fintech-error rounded-xl text-xs flex items-center gap-2.5">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <span>{pinChangeError}</span>
                </div>
              )}

              {/* Change PIN Form */}
              <form onSubmit={handleChangePin} className="space-y-4 max-w-lg">
                <div>
                  <label className="block text-xs font-semibold text-fintech-navy mb-1">
                    Current 6-Digit PIN
                  </label>
                  <input
                    type={showPins ? 'text' : 'password'}
                    required
                    maxLength={6}
                    value={currentPinInput}
                    onChange={(e) => {
                      setCurrentPinInput(e.target.value.replace(/\D/g, ''));
                      setPinChangeError(null);
                    }}
                    placeholder="Enter current PIN (e.g. 123456)"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-fintech-border text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-fintech-primary"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-fintech-navy mb-1">
                      New 6-Digit PIN
                    </label>
                    <input
                      type={showPins ? 'text' : 'password'}
                      required
                      maxLength={6}
                      value={newPinInput}
                      onChange={(e) => {
                        setNewPinInput(e.target.value.replace(/\D/g, ''));
                        setPinChangeError(null);
                      }}
                      placeholder="6 numeric digits"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-fintech-border text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-fintech-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-fintech-navy mb-1">
                      Confirm New PIN
                    </label>
                    <input
                      type={showPins ? 'text' : 'password'}
                      required
                      maxLength={6}
                      value={confirmPinInput}
                      onChange={(e) => {
                        setConfirmPinInput(e.target.value.replace(/\D/g, ''));
                        setPinChangeError(null);
                      }}
                      placeholder="Re-enter 6 digits"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-fintech-border text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-fintech-primary"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => setShowPins(!showPins)}
                    className="text-xs text-fintech-primary hover:underline flex items-center gap-1.5 font-medium"
                  >
                    {showPins ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {showPins ? 'Hide PIN digits' : 'Show PIN digits'}
                  </button>

                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={currentPinInput.length !== 6 || newPinInput.length !== 6 || confirmPinInput.length !== 6}
                  >
                    Update Transaction PIN
                  </Button>
                </div>
              </form>
            </Card>

            {/* Security Architecture Info */}
            <Card className="bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700">
              <h3 className="text-xs font-bold text-fintech-navy dark:text-white uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Security Standards & Controls
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600 dark:text-slate-300">
                <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/80 dark:border-slate-700">
                  <div className="font-bold text-fintech-navy dark:text-white mb-0.5">Salted SHA-256 Hashing</div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
                    PINs are salted per account with a cryptographically generated salt and stored only as a SHA-256 hash digest.
                  </p>
                </div>
                <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/80 dark:border-slate-700">
                  <div className="font-bold text-fintech-navy dark:text-white mb-0.5">Mandatory Verification</div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
                    Zero balance deductions occur if an entered PIN does not match. No plain-text PIN is ever logged or transmitted.
                  </p>
                </div>
              </div>
            </Card>

            {/* Leave Family Card (Members Only) */}
            {currentUser.role === 'member' && (
              <Card className="border-amber-200/80 bg-amber-50/20">
                <div className="flex items-center justify-between pb-3 border-b border-amber-200/60 mb-3">
                  <div>
                    <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                      <UserMinus className="w-4 h-4 text-amber-600" />
                      Family Membership Management
                    </h3>
                    <p className="text-xs text-fintech-muted mt-0.5">
                      Current family group: <strong>{family.name}</strong>
                    </p>
                  </div>
                  <Badge variant="warning" size="sm">
                    Active Member
                  </Badge>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  Leaving removes you from {family.name}. Your personal wallet balance and your personal transaction records remain intact. After leaving, you can create a new family as Administrator via onboarding or join another family.
                </p>

                <Button
                  variant="outline"
                  size="sm"
                  icon={<UserMinus className="w-3.5 h-3.5 text-amber-600" />}
                  onClick={() => {
                    setLeaveFamilyError(null);
                    setIsLeaveFamilyModalOpen(true);
                  }}
                  className="w-full border-amber-300 text-amber-800 hover:bg-amber-50"
                >
                  Leave Family Group
                </Button>
              </Card>
            )}

            {/* Permanent Account Deletion Card (Danger Zone) */}
            <Card className="border-red-200/80 bg-red-50/20">
              <div className="flex items-center justify-between pb-3 border-b border-red-200/60 mb-3">
                <div>
                  <h3 className="text-xs font-bold text-fintech-error uppercase tracking-wider flex items-center gap-1.5">
                    <Trash2 className="w-4 h-4 text-red-600" />
                    Danger Zone: Permanent Account Deletion
                  </h3>
                  <p className="text-xs text-fintech-muted mt-0.5">
                    Permanently delete your account, login credentials, and wallet
                  </p>
                </div>
                <Badge variant="error" size="sm">
                  Irreversible
                </Badge>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Permanently purge your account, credentials, and wallet. Deletion is irreversible and strictly requires identity verification using your <strong>6-digit transaction PIN</strong>.
              </p>

              <Button
                variant="danger"
                size="sm"
                icon={<Trash2 className="w-3.5 h-3.5" />}
                onClick={() => {
                  setDeletePinInput('');
                  setDeleteError(null);
                  setIsDeleteAccountModalOpen(true);
                }}
                className="w-full"
              >
                Delete Account Permanently
              </Button>
            </Card>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: APPLICATION SETTINGS                               */}
      {/* ========================================================= */}
      {activeTab === 'app' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Notification Preferences */}
            <Card>
              <div className="flex items-center justify-between pb-3 border-b border-fintech-border/70 mb-4">
                <div>
                  <h2 className="text-base font-bold text-fintech-navy flex items-center gap-2">
                    <Bell className="w-5 h-5 text-fintech-primary" />
                    Notification Preferences
                  </h2>
                  <p className="text-xs text-fintech-muted">
                    Configure real-time transaction and approval notifications
                  </p>
                </div>
                {notificationSavedMsg && (
                  <Badge variant="success" size="sm" className="animate-fade-in">
                    Saved
                  </Badge>
                )}
              </div>

              <div className="space-y-4">
                {/* Item 1: Payment Notifications */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 hover:bg-slate-50 transition-colors">
                  <div>
                    <div className="text-xs font-bold text-fintech-navy">Payment Notifications</div>
                    <p className="text-[11px] text-fintech-muted">
                      Receive alerts on incoming allowances and outgoing transfers
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleNotification('paymentNotifications')}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                      notifications.paymentNotifications ? 'bg-fintech-primary' : 'bg-slate-300'
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        notifications.paymentNotifications ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Item 2: Transaction Alerts */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 hover:bg-slate-50 transition-colors">
                  <div>
                    <div className="text-xs font-bold text-fintech-navy">Transaction Activity Alerts</div>
                    <p className="text-[11px] text-fintech-muted">
                      Real-time confirmation badges and receipt generation
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleNotification('transactionAlerts')}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                      notifications.transactionAlerts ? 'bg-fintech-primary' : 'bg-slate-300'
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        notifications.transactionAlerts ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Item 3: Spending Limit Alerts */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 hover:bg-slate-50 transition-colors">
                  <div>
                    <div className="text-xs font-bold text-fintech-navy">Spending Limit Threshold Alerts</div>
                    <p className="text-[11px] text-fintech-muted">
                      Notify members when reaching 80% of daily or monthly limit
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleNotification('spendingLimitAlerts')}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                      notifications.spendingLimitAlerts ? 'bg-fintech-primary' : 'bg-slate-300'
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        notifications.spendingLimitAlerts ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Item 4: Exception Request Alerts */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 hover:bg-slate-50 transition-colors">
                  <div>
                    <div className="text-xs font-bold text-fintech-navy">Exception Request Alerts</div>
                    <p className="text-[11px] text-fintech-muted">
                      Alert Administrator immediately when a limit exception is submitted
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleNotification('exceptionRequestAlerts')}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                      notifications.exceptionRequestAlerts ? 'bg-fintech-primary' : 'bg-slate-300'
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        notifications.exceptionRequestAlerts ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </Card>

            {/* Display & Language Preferences */}
            <div className="space-y-6">
              {/* Theme Preference */}
              <Card>
                <div className="pb-3 border-b border-fintech-border/70 mb-4">
                  <h2 className="text-base font-bold text-fintech-navy">
                    {t('settings.themeTitle', 'Theme & Visual Mode')}
                  </h2>
                  <p className="text-xs text-fintech-muted">
                    {t('settings.themeDesc', 'Select your preferred application visual appearance')}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setTheme('light')}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      theme === 'light'
                        ? 'border-fintech-primary bg-blue-50/70 ring-2 ring-fintech-primary/30 text-fintech-primary font-bold'
                        : 'border-slate-200 text-fintech-muted hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-sm font-semibold">{t('settings.light', 'Light')}</div>
                    <div className="text-[10px] mt-0.5 opacity-80">{t('settings.lightDesc', 'Default Fintech')}</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTheme('dark')}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      theme === 'dark'
                        ? 'border-fintech-primary bg-blue-50/70 ring-2 ring-fintech-primary/30 text-fintech-primary font-bold'
                        : 'border-slate-200 text-fintech-muted hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-sm font-semibold">{t('settings.dark', 'Dark')}</div>
                    <div className="text-[10px] mt-0.5 opacity-80">{t('settings.darkDesc', 'Night Theme')}</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTheme('system')}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      theme === 'system'
                        ? 'border-fintech-primary bg-blue-50/70 ring-2 ring-fintech-primary/30 text-fintech-primary font-bold'
                        : 'border-slate-200 text-fintech-muted hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-sm font-semibold">{t('settings.system', 'System')}</div>
                    <div className="text-[10px] mt-0.5 opacity-80">{t('settings.systemDesc', 'OS Match')}</div>
                  </button>
                </div>
              </Card>

              {/* Language Preference (Available to all accounts) */}
              <Card>
                <div className="pb-3 border-b border-fintech-border/70 mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold text-fintech-navy flex items-center gap-2">
                      <Globe className="w-5 h-5 text-fintech-primary" />
                      {t('settings.languageTitle', 'Language / भाषा')}
                    </h2>
                    <p className="text-xs text-fintech-muted">
                      {t('settings.languageDesc', 'Choose your preferred application language (22 supported languages)')}
                    </p>
                  </div>
                  <div className="text-xs font-semibold px-2.5 py-1 rounded bg-blue-50 text-fintech-primary border border-blue-200 self-start sm:self-auto">
                    Active: {supportedLanguages.find((l) => l.code === language)?.name || 'English'}
                  </div>
                </div>

                {/* Quick Search */}
                <div className="mb-3 relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search languages by name, dialect or script..."
                    value={languageSearch}
                    onChange={(e) => setLanguageSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-fintech-border text-xs focus:outline-none focus:ring-2 focus:ring-fintech-primary bg-white"
                  />
                </div>

                {/* 22 Languages Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
                  {filteredLanguages.map((lang) => {
                    const isSelected = language === lang.code;
                    return (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => setLanguage(lang.code)}
                        className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'border-fintech-primary bg-blue-50/70 ring-2 ring-fintech-primary/30 text-fintech-navy font-bold'
                            : 'border-slate-200 text-fintech-muted hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs sm:text-sm font-semibold text-fintech-navy">
                            {lang.nativeName}
                          </span>
                          {lang.dir === 'rtl' && (
                            <span className="text-[9px] uppercase px-1 py-0.2 bg-purple-100 text-purple-800 rounded font-bold">
                              RTL
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-fintech-muted mt-1">
                          <span className="truncate">{lang.name}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-fintech-primary font-bold shrink-0 ml-1" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Card>
            </div>
          </div>

          {/* Help & Support FAQ Accordion */}
          <Card>
            <div className="pb-3 border-b border-fintech-border/70 mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-fintech-navy flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-fintech-primary" />
                  Help & Frequently Asked Questions
                </h2>
                <p className="text-xs text-fintech-muted">
                  Instant guidance on family balances, spending limits, PIN security, and integrations
                </p>
              </div>
              <Badge variant="primary" size="sm">Knowledge Base</Badge>
            </div>

            <div className="space-y-3">
              {[
                {
                  q: 'How does the Administrator central pool differ from Member personal wallets?',
                  a: 'The Administrator maintains a central family pool. When an Administrator sends money or approves a member request, money is transferred directly from the central pool to the member’s personal wallet. Members spend exclusively from their personal wallets.',
                },
                {
                  q: 'What happens when a member transaction exceeds their spending limit?',
                  a: 'The transaction is immediately blocked. The member is presented with exactly two options: REQUEST (submits a limit exception request to the Administrator for approval) or CANCEL (aborts the transaction with zero balance changes).',
                },
                {
                  q: 'How is the 6-digit transaction PIN secured?',
                  a: 'Every user PIN is cryptographically salted using a unique salt and stored as a SHA-256 hash digest. Plain-text PINs are never stored in localStorage or transmitted across APIs.',
                },
                {
                  q: 'How does the PayPal Sandbox integration work?',
                  a: 'PayPal Sandbox enables the Administrator to add real funds to the family pool using official PayPal JavaScript SDK Checkout buttons. Transactions are verified and captured server-side via the PayPal Orders API.',
                },
                {
                  q: 'How does the AI Spending Assistant provide advice?',
                  a: 'The Spending Assistant connects directly to the Google Gemini GenAI API through a secure backend proxy, evaluating real family transaction records, category breakdowns, and limits to give personalized financial advice.',
                },
              ].map((faq, idx) => {
                const isOpen = expandedFaq === idx;
                return (
                  <div
                    key={idx}
                    className="border border-slate-200 rounded-xl overflow-hidden transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => toggleFaq(idx)}
                      className="w-full p-3.5 text-left flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors font-semibold text-xs text-fintech-navy"
                    >
                      <span>{faq.q}</span>
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-fintech-primary shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                    </button>
                    {isOpen && (
                      <div className="p-3.5 pt-0 text-xs text-fintech-muted leading-relaxed border-t border-slate-100 bg-slate-50/50">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-5 pt-4 border-t border-fintech-border/70 flex flex-wrap items-center justify-between gap-3">
              <Button
                variant="outline"
                size="sm"
                icon={<Info className="w-3.5 h-3.5 text-fintech-primary" />}
                onClick={() => setIsAboutModalOpen(true)}
              >
                About PayPal Family
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon={<FileText className="w-3.5 h-3.5 text-fintech-primary" />}
                onClick={() => setIsTermsModalOpen(true)}
              >
                Terms & Privacy Disclosures
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: SYSTEM ARCHITECTURE                                */}
      {/* ========================================================= */}
      {activeTab === 'system' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Math & Data Reset */}
          <div className="space-y-5">
            {/* Financial Math Standard */}
            <Card className="bg-slate-50">
              <h2 className="text-xs font-bold text-fintech-navy uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Code2 className="w-4 h-4 text-fintech-primary" />
                Integer Paise Financial Math
              </h2>
              <p className="text-xs text-fintech-muted leading-relaxed">
                In strict accordance with banking software standards, all balances and limits in PayPal Family are stored as <strong>strictly integer paise (1 INR = 100 paise)</strong>. Floating point arithmetic is never used for currency operations.
              </p>
            </Card>

            {/* Reset Demo Data Card (Strictly visible ONLY to Built-in Demo Family Administrator) */}
            {currentUser.role === 'owner' && !isCustomUser && (
              <Card className="border-red-200/70 bg-red-50/20">
                <h2 className="text-xs font-bold text-fintech-error uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4" />
                  Reset Family Data State
                </h2>
                <p className="text-xs text-fintech-muted leading-relaxed mb-4">
                  Restores the ₹10,000 owner pool balance, resets member balances to ₹0, restores initial limits, and pre-seeds standard transactions.
                </p>

                {resetDone ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-fintech-success rounded-lg text-xs flex items-center gap-2 mb-3">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Family data reset successfully!</span>
                  </div>
                ) : null}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  className="w-full border-red-300 text-fintech-error hover:bg-red-50"
                >
                  Reset to Initial Demo State
                </Button>
              </Card>
            )}
          </div>

          {/* Right Column: PayPal Sandbox Integration Roadmap & Security */}
          <div className="lg:col-span-2 space-y-5">
            {/* Security Disclaimer */}
            <Card className="border-blue-200 bg-blue-50/40">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-6 h-6 text-fintech-primary shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-sm font-bold text-fintech-navy">
                    Security & Authorization Architecture
                  </h2>
                  <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                    All spending rule configurations, transaction authorizations, and security checks are isolated to protect family finances. Enterprise implementations connect securely to authorized banking switches and PCI-DSS compliant processing endpoints.
                  </p>
                </div>
              </div>
            </Card>

            {/* PayPal Sandbox Roadmap */}
            <Card>
              <div className="flex items-center justify-between pb-3 border-b border-fintech-border/70 mb-4">
                <div>
                  <h2 className="text-base font-bold text-fintech-navy">
                    PayPal Sandbox Integration Checklist
                  </h2>
                  <p className="text-xs text-fintech-muted">
                    Full-stack architecture with Node.js / Express backend and official PayPal JavaScript SDK
                  </p>
                </div>
                <Badge variant="success">Connected</Badge>
              </div>

              <div className="space-y-3">
                {checklist.map((item, index) => (
                  <div
                    key={index}
                    className="p-3.5 rounded-xl border border-fintech-border bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-fintech-navy">{item.item}</div>
                      <p className="text-[11px] text-fintech-muted max-w-md">{item.description}</p>
                    </div>
                    <Badge
                      variant={
                        item.status === 'Ready'
                          ? 'success'
                          : item.status === 'Pending Backend'
                          ? 'neutral'
                          : 'warning'
                      }
                      size="sm"
                      className="self-start sm:self-center shrink-0"
                    >
                      {item.status}
                    </Badge>
                  </div>
                ))}
              </div>

              <div className="mt-5 p-4 bg-slate-900 text-slate-300 rounded-xl text-xs space-y-2">
                <div className="flex items-center gap-2 text-white font-semibold">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  <span>Payment Gateway & Security Architecture:</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Sandbox transactions connect to api-m.sandbox.paypal.com via OAuth 2.0 Client Credentials. Server-side capture verification guarantees the family pool is only funded upon genuine authorization.
                </p>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* About Modal */}
      <Modal
        isOpen={isAboutModalOpen}
        onClose={() => setIsAboutModalOpen(false)}
        title="About PayPal Family"
        description="Hackathon Edition • Official Technologies & Simulation Architecture"
        maxWidth="md"
      >
        <div className="space-y-4 text-xs text-fintech-navy">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="font-bold text-sm text-fintech-primary">PayPal Family v2.4.0</div>
            <p className="text-fintech-muted mt-0.5">
              Designed for the PayPal Hackathon to demonstrate smart family financial governance, real PayPal Sandbox checkout, and generative AI financial guidance.
            </p>
          </div>

          <div className="space-y-2">
            <div className="font-bold">Key Technologies:</div>
            <ul className="list-disc pl-5 space-y-1 text-fintech-muted">
              <li><strong>PayPal Sandbox Checkout:</strong> Official JavaScript SDK, Orders API v2 (Create/Capture)</li>
              <li><strong>Google Gemini GenAI:</strong> @google/genai SDK with real family ledger analytics</li>
              <li><strong>Financial Precision:</strong> Integer Paise standard (100 paise = 1 INR)</li>
              <li><strong>Security:</strong> Salted SHA-256 Transaction PIN protection</li>
            </ul>
          </div>

          <div className="pt-2 flex justify-end">
            <Button variant="primary" size="sm" onClick={() => setIsAboutModalOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Terms & Privacy Modal */}
      <Modal
        isOpen={isTermsModalOpen}
        onClose={() => setIsTermsModalOpen(false)}
        title="Terms & Privacy Disclosures"
        description="Security model, data storage, and hackathon evaluation disclosures"
        maxWidth="md"
      >
        <div className="space-y-4 text-xs text-fintech-navy">
          <div>
            <h4 className="font-bold text-sm mb-1">Hackathon Prototype Disclosure</h4>
            <p className="text-fintech-muted leading-relaxed">
              This application is built for evaluation purposes. Internal family transfers, allowances, and QR codes simulate domestic retail settlement. Real sandbox testing operates exclusively through the official PayPal Sandbox gateway and Google Gemini API.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-sm mb-1">Local Storage Security</h4>
            <p className="text-fintech-muted leading-relaxed">
              Transaction history and simulated family wallets are persisted client-side in browser storage. Transaction PINs are protected with salted SHA-256 hashing. Production deployments require enterprise database persistence and hardware security modules (HSMs).
            </p>
          </div>

          <div className="pt-2 flex justify-end">
            <Button variant="primary" size="sm" onClick={() => setIsTermsModalOpen(false)}>
              Understood
            </Button>
          </div>
        </div>
      </Modal>

      {/* Leave Family Confirmation Modal (Members Only) */}
      <Modal
        isOpen={isLeaveFamilyModalOpen}
        onClose={() => {
          if (!leaveFamilyLoading) {
            setIsLeaveFamilyModalOpen(false);
            setLeaveFamilyError(null);
          }
        }}
        title="Leave Family Group"
        description={`Confirm departure from ${family.name}`}
        maxWidth="md"
      >
        <div className="space-y-4 text-xs text-fintech-navy">
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm">Are you sure you want to leave {family.name}?</div>
              <p className="mt-1 leading-relaxed text-amber-800">
                Leaving removes you from this family group and relinquishes family spending limits and allowance requests.
              </p>
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="font-bold text-fintech-navy">What happens when you leave:</div>
            <ul className="list-disc pl-5 space-y-1 text-fintech-muted">
              <li><strong>Your personal wallet & balance</strong> remain yours and will not be lost.</li>
              <li><strong>Your personal transaction history</strong> is preserved.</li>
              <li><strong>Other family members & central pool</strong> are completely unaffected.</li>
              <li>You will be able to <strong>create your own new family</strong> as Administrator through onboarding or join another family with an invitation code.</li>
            </ul>
          </div>

          {leaveFamilyError && (
            <div className="p-3 bg-red-50 border border-red-200 text-fintech-error rounded-xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{leaveFamilyError}</span>
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <Button
              variant="outline"
              size="sm"
              disabled={leaveFamilyLoading}
              onClick={() => {
                setIsLeaveFamilyModalOpen(false);
                setLeaveFamilyError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={leaveFamilyLoading}
              onClick={handleConfirmLeaveFamily}
            >
              {leaveFamilyLoading ? 'Leaving...' : 'Confirm & Leave Family'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Account Modal (PIN Verification Required) */}
      <Modal
        isOpen={isDeleteAccountModalOpen}
        onClose={() => {
          if (!deleteLoading) {
            setIsDeleteAccountModalOpen(false);
            setDeletePinInput('');
            setDeleteError(null);
          }
        }}
        title="Delete Account Permanently"
        description="Irreversible account teardown and identity verification"
        maxWidth="md"
      >
        <div className="space-y-4 text-xs text-fintech-navy">
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-900 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm">Warning: This action is permanent and cannot be undone</div>
              <p className="mt-1 leading-relaxed text-red-800">
                Deleting your account will permanently purge your user profile, login credentials, family association, personal wallet data, and membership records.
              </p>
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-fintech-muted">
            <div className="font-bold text-fintech-navy">Account Deletion Policy:</div>
            {currentUser.role === 'member' ? (
              <p>
                Deleting your personal member account deletes only your profile and wallet. Other family accounts and the Administrator central fund remain fully operational.
              </p>
            ) : (
              <p>
                As Administrator, deleting your account dissolves this family group safely and releases all family associations.
              </p>
            )}
          </div>

          <form onSubmit={handleConfirmDeleteAccount} className="space-y-3 pt-1">
            <div>
              <label className="block text-xs font-bold text-fintech-navy mb-1">
                Enter your 6-digit transaction PIN to confirm identity
              </label>
              <div className="relative">
                <input
                  type={showDeletePin ? 'text' : 'password'}
                  required
                  maxLength={6}
                  value={deletePinInput}
                  onChange={(e) => {
                    setDeletePinInput(e.target.value.replace(/\D/g, ''));
                    setDeleteError(null);
                  }}
                  placeholder="6-digit PIN"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-red-200 font-mono text-base tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-red-500 bg-red-50/20"
                />
              </div>
              <div className="flex justify-between items-center mt-1">
                <button
                  type="button"
                  onClick={() => setShowDeletePin(!showDeletePin)}
                  className="text-[11px] text-fintech-primary hover:underline"
                >
                  {showDeletePin ? 'Hide PIN' : 'Show PIN'}
                </button>
                <span className="text-[10px] text-fintech-muted">6 numeric digits</span>
              </div>
            </div>

            {deleteError && (
              <div className="p-3 bg-red-50 border border-red-200 text-fintech-error rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span className="font-semibold">{deleteError}</span>
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={deleteLoading}
                onClick={() => {
                  setIsDeleteAccountModalOpen(false);
                  setDeletePinInput('');
                  setDeleteError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="danger"
                size="sm"
                disabled={deleteLoading || deletePinInput.length !== 6}
              >
                {deleteLoading ? 'Verifying & Deleting...' : 'Verify PIN & Delete Permanently'}
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
};
