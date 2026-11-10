import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  User,
  Family,
  SpendingRule,
  Wallet,
  Transaction,
  QRPayload,
  MoneyRequest,
  MembershipRequest,
  PaymentSource,
} from '../types';
import { paymentService, PaymentExecutionResult } from '../services/paymentService';
import { calculateMemberSpending, calculateMemberConsumption, evaluateSpendingEligibility, MemberConsumption } from '../services/spendingRuleEngine';
import { transactionAuthorizationService } from '../services/transactionAuthorizationService';
import { generateTransactionReference } from '../utils/id';
import { onboardingStorage, maskAccountNumber, generateJoiningCode } from '../services/onboardingStorage';
import {
  DEMO_PIN_HASH,
  DEMO_PIN_SALT,
  verifyPinSync,
  hashPinSync,
  validatePinFormat,
  generatePinSalt,
} from '../utils/security';

interface AppContextType {
  currentUser: User;
  family: Family;
  familyMembers: User[];
  ownerWallet: Wallet;
  memberPersonalAccounts: Record<string, Wallet>;
  spendingRules: Record<string, SpendingRule>;
  transactions: Transaction[];
  moneyRequests: MoneyRequest[];
  pendingMembershipRequests: MembershipRequest[];
  familyJoiningCode: string;
  isCustomUser: boolean;
  switchUser: (userId: string) => void;
  resetDemoData: () => void;
  updateSpendingRule: (memberId: string, updates: Partial<SpendingRule>) => void;
  inviteMember: (name: string, email: string, relationship: string) => void;
  removeMember: (memberId: string) => void;
  requestMoney: (amountPaise: number, purpose: string) => Promise<PaymentExecutionResult>;
  submitLimitExceptionRequest: (
    amountPaise: number,
    purpose: string,
    configuredLimitPaise?: number,
    excessAmountPaise?: number,
    message?: string
  ) => Promise<{ success: boolean; request?: MoneyRequest; error?: string }>;
  submitExtraMoneyRequest: (
    amountPaise: number,
    message: string,
    reason?: string
  ) => Promise<{
    success: boolean;
    autoAuthorized?: boolean;
    requiresApproval?: boolean;
    transaction?: Transaction;
    request?: MoneyRequest;
    error?: string;
    overLimitDetails?: any;
  }>;
  requestExtraMoney: (
    amountPaise: number,
    message: string,
    reason?: string
  ) => Promise<{
    success: boolean;
    autoAuthorized?: boolean;
    requiresApproval?: boolean;
    transaction?: Transaction;
    request?: MoneyRequest;
    error?: string;
    overLimitDetails?: any;
  }>;
  createMoneyRequest: (
    amountPaise: number,
    purpose: string
  ) => Promise<{
    success: boolean;
    autoAuthorized?: boolean;
    requiresApproval?: boolean;
    transaction?: Transaction;
    request?: MoneyRequest;
    error?: string;
    overLimitDetails?: any;
  }>;
  approveMoneyRequest: (requestId: string) => Promise<PaymentExecutionResult>;
  rejectMoneyRequest: (requestId: string, reason?: string) => Promise<{ success: boolean; request?: MoneyRequest }>;
  sendMoney: (memberId: string, amountPaise: number, note?: string) => Promise<PaymentExecutionResult>;
  spendMoney: (amountPaise: number, recipientName: string, category?: string, note?: string) => Promise<PaymentExecutionResult>;
  addMoneyToAdmin: (amountPaise: number, note?: string) => Promise<PaymentExecutionResult>;
  payMerchantQR: (qrPayload: QRPayload) => Promise<PaymentExecutionResult>;
  payToMobile: (params: {
    mobile: string;
    countryCode: string;
    amountPaise: number;
    recipientName?: string;
    note?: string;
    pin: string;
  }) => Promise<PaymentExecutionResult>;
  getMemberSpending: (memberId: string) => { spentTodayPaise: number; spentThisMonthPaise: number };
  getMemberConsumption: (memberId: string) => MemberConsumption;
  
  // Transaction PIN & Profile Security
  setUserPin: (pin: string) => { success: boolean; error?: string };
  verifyUserPin: (pin: string) => boolean;
  changeUserPin: (currentPin: string, newPin: string) => { success: boolean; error?: string };
  updateUserProfile: (updates: Partial<User>) => void;
  
  // New Onboarding & Multi-User Methods
  registerMobileUser: (name: string, countryCode: string, mobile: string, country?: string) => Promise<User>;
  linkBankAccount: (userId: string, data: { accountHolderName: string; bankName: string; accountNumber: string; ifscCode: string }) => Promise<User>;
  createCustomFamily: (userId: string, familyName: string, initialBalanceRupees?: number) => Promise<{ family: Family; joiningCode: string; user: User }>;
  verifyJoiningCode: (code: string) => { valid: boolean; family?: Family; adminName?: string; error?: string };
  submitMembershipRequest: (userId: string, joiningCode: string) => Promise<{ success: boolean; request?: MembershipRequest; error?: string }>;
  checkUserMembershipStatus: (userId: string) => { status: 'ACTIVE' | 'PENDING' | 'REJECTED' | 'NONE'; family?: Family; request?: MembershipRequest };
  approveMembershipRequest: (requestId: string) => Promise<boolean>;
  rejectMembershipRequest: (requestId: string, reason?: string) => Promise<boolean>;
  loginMobileUser: (countryCode: string, mobile: string) => Promise<{ success: boolean; user?: User; error?: string }>;
  logoutUser: () => void;
  leaveFamily: () => Promise<{ success: boolean; error?: string }>;
  deleteAccount: (pin: string) => Promise<{ success: boolean; error?: string }>;
  clearAllLocalTestData: () => void;
}

// Initial Demo State (Rajesh, Priya, Aarav)
export const INITIAL_OWNER: User = {
  id: 'usr_owner_rajesh',
  name: 'Rajesh Sharma',
  email: 'rajesh.sharma@example.com',
  role: 'owner',
  relationship: 'Family Administrator',
  avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  familyId: 'fam_sharma_01',
  phone: '+91 98765 43210',
  mobile: '9876543210',
  country: 'India',
  countryCode: '+91',
  membershipStatus: 'ACTIVE',
  onboardingStep: 'completed',
  bankAccount: {
    accountHolderName: 'Rajesh Sharma',
    bankName: 'HDFC Bank Ltd',
    accountNumber: '•••• •••• 4821',
    rawAccountNumber: '50100482914821',
    ifscCode: 'HDFC0001234',
    linkedAt: '2026-01-15T08:00:00.000Z',
  },
  hasTransactionPin: true,
  pinHash: DEMO_PIN_HASH,
  pinSalt: DEMO_PIN_SALT,
  pinSetAt: '2026-01-01T00:00:00.000Z',
};

export const INITIAL_MEMBERS: User[] = [
  INITIAL_OWNER,
  {
    id: 'usr_member_priya',
    name: 'Priya Sharma',
    email: 'priya.sharma@example.com',
    role: 'member',
    relationship: 'Daughter (College Student)',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    familyId: 'fam_sharma_01',
    phone: '+91 98765 43211',
    mobile: '9876543211',
    country: 'India',
    countryCode: '+91',
    membershipStatus: 'ACTIVE',
    onboardingStep: 'completed',
    bankAccount: {
      accountHolderName: 'Priya Sharma',
      bankName: 'State Bank of India',
      accountNumber: '•••• •••• 8832',
      rawAccountNumber: '30200883298832',
      ifscCode: 'SBIN0004567',
      linkedAt: '2026-01-16T10:00:00.000Z',
    },
    hasTransactionPin: true,
    pinHash: DEMO_PIN_HASH,
    pinSalt: DEMO_PIN_SALT,
    pinSetAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'usr_member_aarav',
    name: 'Aarav Sharma',
    email: 'aarav.sharma@example.com',
    role: 'member',
    relationship: 'Son (High School)',
    avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
    familyId: 'fam_sharma_01',
    phone: '+91 98765 43212',
    mobile: '9876543212',
    country: 'India',
    countryCode: '+91',
    membershipStatus: 'ACTIVE',
    onboardingStep: 'completed',
    bankAccount: {
      accountHolderName: 'Aarav Sharma',
      bankName: 'ICICI Bank',
      accountNumber: '•••• •••• 1290',
      rawAccountNumber: '10200129041290',
      ifscCode: 'ICIC0007890',
      linkedAt: '2026-01-16T10:30:00.000Z',
    },
    hasTransactionPin: true,
    pinHash: DEMO_PIN_HASH,
    pinSalt: DEMO_PIN_SALT,
    pinSetAt: '2026-01-01T00:00:00.000Z',
  },
];

export const INITIAL_FAMILY: Family = {
  id: 'fam_sharma_01',
  name: 'The Sharma Family',
  ownerId: INITIAL_OWNER.id,
  createdAt: '2026-01-15T08:00:00.000Z',
  currency: 'INR',
  joiningCode: 'SHARMA-2026',
  fundingSource: 'HDFC Bank (•••• •••• 4821)',
  bankAccount: {
    accountHolderName: 'Rajesh Sharma',
    bankName: 'HDFC Bank Ltd',
    accountNumber: '•••• •••• 4821',
    rawAccountNumber: '50100482914821',
    ifscCode: 'HDFC0001234',
    linkedAt: '2026-01-15T08:00:00.000Z',
  },
};

export const INITIAL_OWNER_WALLET: Wallet = {
  userId: INITIAL_OWNER.id,
  balancePaise: 1000000, // ₹10,000.00 Administrator Main Account
  currency: 'INR',
  isSimulated: true,
};

export const INITIAL_MEMBER_PERSONAL_ACCOUNTS: Record<string, Wallet> = {
  usr_member_priya: {
    userId: 'usr_member_priya',
    balancePaise: 50000, // ₹500.00
    currency: 'INR',
    isSimulated: true,
  },
  usr_member_aarav: {
    userId: 'usr_member_aarav',
    balancePaise: 0,
    currency: 'INR',
    isSimulated: true,
  },
};

const INITIAL_MONEY_REQUESTS: MoneyRequest[] = [
  {
    id: 'req_seed_01',
    familyId: 'fam_sharma_01',
    memberId: 'usr_member_priya',
    memberName: 'Priya Sharma',
    memberAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    amountPaise: 300000, // ₹3,000.00
    purpose: 'Semester project equipment & advanced textbooks',
    message: 'Semester project equipment & advanced textbooks',
    status: 'PENDING',
    createdAt: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
    isException: true,
    configuredLimitPaise: 200000,
    excessAmountPaise: 100000,
  },
];

export const INITIAL_SPENDING_RULES: Record<string, SpendingRule> = {
  usr_owner_rajesh: {
    memberId: 'usr_owner_rajesh',
    singleTransactionLimitPaise: 500000, // ₹5,000
    maxRequestLimitPaise: 500000,
    dailyLimitPaise: 1000000,            // ₹10,000
    monthlyLimitPaise: 2500000,          // ₹25,000
    allowMoneyTransfer: true,
    allowQRPayments: true,
  },
  usr_member_priya: {
    memberId: 'usr_member_priya',
    singleTransactionLimitPaise: 200000, // ₹2,000
    maxRequestLimitPaise: 200000,
    dailyLimitPaise: 500000,             // ₹5,000 (Daily Spending Limit)
    monthlyLimitPaise: 1000000,          // ₹10,000 (Monthly Spending Limit)
    allowMoneyTransfer: true,
    allowQRPayments: true,
  },
  usr_member_aarav: {
    memberId: 'usr_member_aarav',
    singleTransactionLimitPaise: 50000,  // ₹500
    maxRequestLimitPaise: 50000,
    dailyLimitPaise: 80000,              // ₹800 (Daily Spending Limit)
    monthlyLimitPaise: 200000,           // ₹2,000 (Monthly Spending Limit)
    allowMoneyTransfer: true,
    allowQRPayments: true,
  },
};

const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx_seed_01',
    reference: 'TXN-20261028-A48X1',
    familyId: 'fam_sharma_01',
    type: 'TRANSFER',
    status: 'COMPLETED',
    amountPaise: 50000,
    currency: 'INR',
    initiatorId: 'usr_member_priya',
    payerId: 'usr_owner_rajesh',
    senderId: 'usr_owner_rajesh',
    senderName: 'Rajesh Sharma',
    recipientId: 'usr_member_priya',
    recipientName: 'Priya Sharma',
    paymentSource: 'PERSONAL_ACCOUNT',
    date: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
    note: 'Semester books & study stationery',
    isSimulated: true,
  },
  {
    id: 'tx_seed_02',
    reference: 'TXN-20261029-C99P2',
    familyId: 'fam_sharma_01',
    type: 'QR_PAYMENT',
    status: 'COMPLETED',
    amountPaise: 18000,
    currency: 'INR',
    initiatorId: 'usr_member_priya',
    payerId: 'usr_member_priya',
    senderId: 'usr_member_priya',
    senderName: 'Priya Sharma',
    recipientId: 'MERCH_CAMPUS_CAFE',
    recipientName: 'Campus Cafeteria & Bakery',
    paymentSource: 'PERSONAL_ACCOUNT',
    merchantId: 'MERCH_CAMPUS_CAFE',
    merchantCategory: 'Dining & Snacks',
    date: new Date(Date.now() - 3600 * 1000 * 3).toISOString(),
    note: 'QR Invoice: INV-882194',
    isSimulated: true,
  },
];

const STORAGE_KEY = 'paypal_family_data_v1';

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Sync tick to force re-render when custom storage updates
  const [syncTick, setSyncTick] = useState(0);
  const triggerSync = useCallback(() => setSyncTick((t) => t + 1), []);

  // Demo state
  const [demoData, setDemoData] = useState(() => {
    let baseData: any = {
      currentUserId: INITIAL_OWNER.id,
      familyMembers: INITIAL_MEMBERS,
      ownerWallet: INITIAL_OWNER_WALLET,
      memberPersonalAccounts: INITIAL_MEMBER_PERSONAL_ACCOUNTS,
      spendingRules: INITIAL_SPENDING_RULES,
      transactions: INITIAL_TRANSACTIONS,
      moneyRequests: INITIAL_MONEY_REQUESTS,
    };
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.familyMembers && Array.isArray(parsed.familyMembers)) {
          parsed.familyMembers = parsed.familyMembers.map((m: User) => {
            const init = INITIAL_MEMBERS.find((im) => im.id === m.id);
            if (init) {
              return {
                ...init,
                ...m,
                phone: m.phone || init.phone,
                mobile: m.mobile || init.mobile,
                country: m.country || init.country,
                countryCode: m.countryCode || init.countryCode,
                bankAccount: m.bankAccount || init.bankAccount,
                membershipStatus: m.membershipStatus || init.membershipStatus,
                onboardingStep: m.onboardingStep || init.onboardingStep,
              };
            }
            return m;
          });
        } else {
          parsed.familyMembers = INITIAL_MEMBERS;
        }
        if (!parsed.memberPersonalAccounts) {
          parsed.memberPersonalAccounts = INITIAL_MEMBER_PERSONAL_ACCOUNTS;
        } else {
          delete parsed.memberPersonalAccounts['usr_owner_rajesh'];
        }
        if (!parsed.spendingRules) {
          parsed.spendingRules = INITIAL_SPENDING_RULES;
        } else if (!parsed.spendingRules['usr_owner_rajesh']) {
          parsed.spendingRules['usr_owner_rajesh'] = INITIAL_SPENDING_RULES['usr_owner_rajesh'];
        }
        if (!parsed.moneyRequests) {
          parsed.moneyRequests = INITIAL_MONEY_REQUESTS;
        }
        delete parsed.memberWallets;
        baseData = parsed;
      }
    } catch {}

    try {
      const params = new URLSearchParams(window.location.search);
      const urlUser = params.get('user');
      if (urlUser === 'usr_member_priya' || urlUser === 'usr_member_aarav' || urlUser === 'usr_owner_rajesh') {
        baseData.currentUserId = urlUser;
        onboardingStorage.setActiveUserId(null);
      }
    } catch {}

    return baseData;
  });

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlUser = params.get('user');
      if (urlUser === 'usr_member_priya' || urlUser === 'usr_member_aarav' || urlUser === 'usr_owner_rajesh') {
        onboardingStorage.setActiveUserId(null);
        setDemoData((prev: any) => ({ ...prev, currentUserId: urlUser }));
      }
    } catch {}
  }, []);

  // Save demo data to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(demoData));
    } catch {}
  }, [demoData]);

  // Determine active user ID (checks onboarding storage first, then demoData)
  const activeUserId = useMemo(() => {
    const savedActive = onboardingStorage.getActiveUserId();
    if (savedActive) return savedActive;
    return demoData.currentUserId || INITIAL_OWNER.id;
  }, [demoData.currentUserId, syncTick]);

  // Check if active user is a custom registered user
  const customUser = useMemo(() => {
    return onboardingStorage.getUserById(activeUserId);
  }, [activeUserId, syncTick]);

  const isCustomUser = Boolean(customUser);

  // Switch user / demo switcher
  const switchUser = (userId: string) => {
    const custom = onboardingStorage.getUserById(userId);
    if (custom) {
      onboardingStorage.setActiveUserId(userId);
    } else {
      onboardingStorage.setActiveUserId(null);
      setDemoData((prev: any) => {
        const next = { ...prev, currentUserId: userId };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {}
        return next;
      });
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.has('user')) {
          url.searchParams.set('user', userId);
          window.history.replaceState({}, '', url.toString());
        }
      } catch {}
    }
    triggerSync();
  };

  const logoutUser = () => {
    onboardingStorage.setActiveUserId(null);
    setDemoData((prev: any) => ({ ...prev, currentUserId: INITIAL_OWNER.id }));
    triggerSync();
  };

  const resetDemoData = () => {
    localStorage.removeItem(STORAGE_KEY);
    onboardingStorage.setActiveUserId(null);
    setDemoData({
      currentUserId: INITIAL_OWNER.id,
      familyMembers: INITIAL_MEMBERS,
      ownerWallet: INITIAL_OWNER_WALLET,
      memberPersonalAccounts: INITIAL_MEMBER_PERSONAL_ACCOUNTS,
      spendingRules: INITIAL_SPENDING_RULES,
      transactions: INITIAL_TRANSACTIONS,
      moneyRequests: INITIAL_MONEY_REQUESTS,
    });
    triggerSync();
  };

  // Derive Current User
  const currentUser: User = useMemo(() => {
    if (customUser) {
      return customUser;
    }
    return demoData.familyMembers.find((m: User) => m.id === activeUserId) || INITIAL_OWNER;
  }, [customUser, activeUserId, demoData.familyMembers]);

  // Derive Active Family
  const activeFamily: Family = useMemo(() => {
    if (customUser && customUser.familyId) {
      const fam = onboardingStorage.getFamilyById(customUser.familyId);
      if (fam) return fam;
    }
    return INITIAL_FAMILY;
  }, [customUser, syncTick]);

  // Derive Family Members
  const familyMembers: User[] = useMemo(() => {
    if (customUser && customUser.familyId) {
      const allUsers = onboardingStorage.getRegisteredUsers();
      const members = allUsers.filter(
        (u) => u.familyId === customUser.familyId && (u.membershipStatus === 'ACTIVE' || u.role === 'owner')
      );
      return members.length > 0 ? members : [customUser];
    }
    return demoData.familyMembers;
  }, [customUser, demoData.familyMembers, syncTick]);

  // Derive Family Joining Code
  const familyJoiningCode: string = useMemo(() => {
    if (isCustomUser) {
      return activeFamily.joiningCode || 'JOIN-ACTIVE';
    }
    return 'SHARMA-2026';
  }, [isCustomUser, activeFamily]);

  // Derive Owner Wallet (Family Central Pool)
  const ownerWallet: Wallet = useMemo(() => {
    if (customUser && customUser.familyId) {
      const wallets = onboardingStorage.getWallets();
      return (
        wallets[activeFamily.id] ||
        wallets[activeFamily.ownerId] || {
          userId: activeFamily.ownerId,
          balancePaise: activeFamily.initialBalancePaise !== undefined ? activeFamily.initialBalancePaise : 0,
          currency: 'INR',
          isSimulated: true,
        }
      );
    }
    return demoData.ownerWallet;
  }, [customUser, activeFamily, demoData.ownerWallet, syncTick]);

  // Derive Member Personal Accounts
  const rawMemberPersonalAccounts: Record<string, Wallet> = useMemo(() => {
    if (customUser && customUser.familyId) {
      const wallets = onboardingStorage.getWallets();
      const scoped: Record<string, Wallet> = {};
      for (const m of familyMembers) {
        scoped[m.id] = wallets[m.id] || {
          userId: m.id,
          balancePaise: 0,
          currency: 'INR',
          isSimulated: true,
        };
      }
      return scoped;
    }
    return demoData.memberPersonalAccounts || INITIAL_MEMBER_PERSONAL_ACCOUNTS;
  }, [customUser, familyMembers, demoData.memberPersonalAccounts, syncTick]);

  // Derive Spending Rules
  const rawSpendingRules: Record<string, SpendingRule> = useMemo(() => {
    if (customUser && customUser.familyId) {
      const rules = onboardingStorage.getSpendingRules();
      const scoped: Record<string, SpendingRule> = {};
      for (const m of familyMembers) {
        scoped[m.id] = rules[m.id] || {
          memberId: m.id,
          singleTransactionLimitPaise: 200000,
          maxRequestLimitPaise: 200000,
          dailyLimitPaise: 500000,
          monthlyLimitPaise: 1000000,
          allowMoneyTransfer: true,
          allowQRPayments: true,
        };
      }
      return scoped;
    }
    return demoData.spendingRules || INITIAL_SPENDING_RULES;
  }, [customUser, familyMembers, demoData.spendingRules, syncTick]);

  // Derive Transactions
  const rawTransactions: Transaction[] = useMemo(() => {
    if (customUser && customUser.familyId) {
      return onboardingStorage.getTransactions(activeFamily.id);
    }
    return demoData.transactions || INITIAL_TRANSACTIONS;
  }, [customUser, activeFamily.id, demoData.transactions, syncTick]);

  // Derive Money Requests
  const rawMoneyRequests: MoneyRequest[] = useMemo(() => {
    if (customUser && customUser.familyId) {
      return onboardingStorage.getMoneyRequests(activeFamily.id);
    }
    return demoData.moneyRequests || INITIAL_MONEY_REQUESTS;
  }, [customUser, activeFamily.id, demoData.moneyRequests, syncTick]);

  // Derive Pending Membership Requests for this Family (Administrator view)
  const pendingMembershipRequests: MembershipRequest[] = useMemo(() => {
    if (isCustomUser && activeFamily.id) {
      return onboardingStorage.getMembershipRequests(activeFamily.id).filter((r) => r.status === 'PENDING');
    }
    return onboardingStorage.getMembershipRequests('fam_sharma_01').filter((r) => r.status === 'PENDING');
  }, [isCustomUser, activeFamily.id, syncTick]);

  // Privacy Enforcements:
  const authorizedSpendingRules = useMemo(() => {
    if (currentUser.role === 'owner') return rawSpendingRules;
    return rawSpendingRules[currentUser.id] ? { [currentUser.id]: rawSpendingRules[currentUser.id] } : {};
  }, [currentUser.role, currentUser.id, rawSpendingRules]);

  const authorizedMoneyRequests = useMemo(() => {
    if (currentUser.role === 'owner') return rawMoneyRequests;
    return rawMoneyRequests.filter((r) => r.memberId === currentUser.id);
  }, [currentUser.role, currentUser.id, rawMoneyRequests]);

  const authorizedMemberPersonalAccounts = useMemo(() => {
    if (currentUser.role === 'owner') return rawMemberPersonalAccounts;
    const myAcc = rawMemberPersonalAccounts[currentUser.id] || {
      userId: currentUser.id,
      balancePaise: 0,
      currency: 'INR',
      isSimulated: true,
    };
    return { [currentUser.id]: myAcc };
  }, [currentUser.role, currentUser.id, rawMemberPersonalAccounts]);

  const authorizedTransactions = useMemo(() => {
    if (currentUser.role === 'owner') return rawTransactions;
    return rawTransactions.filter(
      (txn) =>
        txn.initiatorId === currentUser.id ||
        txn.recipientId === currentUser.id ||
        txn.senderId === currentUser.id ||
        txn.payerId === currentUser.id
    );
  }, [currentUser.role, currentUser.id, rawTransactions]);

  // Spending & Consumption Helpers
  const getMemberSpending = (memberId: string) => {
    if (currentUser.role !== 'owner' && currentUser.id !== memberId) {
      return { spentTodayPaise: 0, spentThisMonthPaise: 0 };
    }
    return calculateMemberSpending(memberId, rawTransactions);
  };

  const getMemberConsumption = (memberId: string): MemberConsumption => {
    if (currentUser.role !== 'owner' && currentUser.id !== memberId) {
      return {
        spentTodayPaise: 0,
        configuredDailyLimitPaise: 0,
        remainingTodayPaise: 0,
        spentThisMonthPaise: 0,
        configuredMonthlyLimitPaise: 0,
        remainingThisMonthPaise: 0,
        maxRequestLimitPaise: 0,
        dailyPct: 0,
        monthlyPct: 0,
        isDailyExceeded: false,
        isMonthlyExceeded: false,
        isDailyBlockedByMonthly: false,
        effectiveRemainingTodayPaise: 0,
      };
    }
    const rule = rawSpendingRules[memberId] || {
      memberId,
      singleTransactionLimitPaise: 200000,
      maxRequestLimitPaise: 200000,
      dailyLimitPaise: 500000,
      monthlyLimitPaise: 1000000,
      allowMoneyTransfer: true,
      allowQRPayments: true,
    };
    const spending = calculateMemberSpending(memberId, rawTransactions);
    return calculateMemberConsumption(rule, spending);
  };

  // Rule Updates
  const updateSpendingRule = (memberId: string, updates: Partial<SpendingRule>) => {
    if (currentUser.role !== 'owner') return;

    if (isCustomUser) {
      const allRules = onboardingStorage.getSpendingRules();
      const current = allRules[memberId] || {
        memberId,
        singleTransactionLimitPaise: 200000,
        maxRequestLimitPaise: 200000,
        dailyLimitPaise: 500000,
        monthlyLimitPaise: 1000000,
        allowMoneyTransfer: true,
        allowQRPayments: true,
      };
      allRules[memberId] = {
        ...current,
        ...updates,
        singleTransactionLimitPaise:
          updates.singleTransactionLimitPaise ?? updates.maxRequestLimitPaise ?? current.singleTransactionLimitPaise,
        maxRequestLimitPaise:
          updates.maxRequestLimitPaise ?? updates.singleTransactionLimitPaise ?? current.maxRequestLimitPaise,
      };
      onboardingStorage.saveSpendingRules(allRules);
      triggerSync();
      return;
    }

    setDemoData((prev: any) => {
      const current = prev.spendingRules?.[memberId] || rawSpendingRules[memberId] || {
        memberId,
        singleTransactionLimitPaise: 200000,
        maxRequestLimitPaise: 200000,
        dailyLimitPaise: 500000,
        monthlyLimitPaise: 1000000,
        allowMoneyTransfer: true,
        allowQRPayments: true,
      };
      return {
        ...prev,
        spendingRules: {
          ...prev.spendingRules,
          [memberId]: {
            ...current,
            ...updates,
            singleTransactionLimitPaise:
              updates.singleTransactionLimitPaise ??
              updates.maxRequestLimitPaise ??
              current.singleTransactionLimitPaise,
            maxRequestLimitPaise:
              updates.maxRequestLimitPaise ??
              updates.singleTransactionLimitPaise ??
              current.maxRequestLimitPaise,
          },
        },
      };
    });
  };

  const inviteMember = (name: string, email: string, relationship: string) => {
    if (currentUser.role !== 'owner') return;

    if (isCustomUser) {
      // In custom family, generate member profile
      const newId = `usr_mem_${Date.now()}`;
      const newMember: User = {
        id: newId,
        name,
        email,
        role: 'member',
        relationship,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
        familyId: activeFamily.id,
        onboardingStep: 'completed',
        membershipStatus: 'ACTIVE',
        isCustomUser: true,
      };
      onboardingStorage.saveUser(newMember);

      const wallets = onboardingStorage.getWallets();
      wallets[newId] = { userId: newId, balancePaise: 0, currency: 'INR', isSimulated: true };
      onboardingStorage.saveWallets(wallets);

      const rules = onboardingStorage.getSpendingRules();
      rules[newId] = {
        memberId: newId,
        singleTransactionLimitPaise: 200000,
        dailyLimitPaise: 500000,
        monthlyLimitPaise: 1000000,
        allowMoneyTransfer: true,
        allowQRPayments: true,
      };
      onboardingStorage.saveSpendingRules(rules);
      triggerSync();
      return;
    }

    const newId = `usr_member_${Date.now()}`;
    const newMember: User = {
      id: newId,
      name,
      email,
      role: 'member',
      relationship,
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
      familyId: INITIAL_FAMILY.id,
      onboardingStep: 'completed',
      membershipStatus: 'ACTIVE',
      country: 'India',
      countryCode: '+91',
      hasTransactionPin: true,
      pinHash: DEMO_PIN_HASH,
      pinSalt: DEMO_PIN_SALT,
      pinSetAt: new Date().toISOString(),
    };

    const defaultRule: SpendingRule = {
      memberId: newId,
      singleTransactionLimitPaise: 200000,
      maxRequestLimitPaise: 200000,
      dailyLimitPaise: 500000,
      monthlyLimitPaise: 1000000,
      allowMoneyTransfer: true,
      allowQRPayments: true,
    };

    const newPersonalAccount: Wallet = {
      userId: newId,
      balancePaise: 0,
      currency: 'INR',
      isSimulated: true,
    };

    setDemoData((prev: any) => ({
      ...prev,
      familyMembers: [...prev.familyMembers, newMember],
      memberPersonalAccounts: { ...prev.memberPersonalAccounts, [newId]: newPersonalAccount },
      spendingRules: { ...prev.spendingRules, [newId]: defaultRule },
    }));
  };

  const removeMember = (memberId: string) => {
    if (currentUser.role !== 'owner') return;

    if (isCustomUser) {
      const allUsers = onboardingStorage.getRegisteredUsers();
      const target = allUsers.find((u) => u.id === memberId);
      if (target) {
        target.membershipStatus = 'REJECTED';
        target.familyId = '';
        onboardingStorage.saveUser(target);
        triggerSync();
      }
      return;
    }

    setDemoData((prev: any) => ({
      ...prev,
      familyMembers: prev.familyMembers.filter((m: User) => m.id !== memberId),
      currentUserId: prev.currentUserId === memberId ? INITIAL_OWNER.id : prev.currentUserId,
    }));
  };

  // FINANCIAL FLOWS
  const requestMoney = async (amountPaise: number, purpose: string): Promise<PaymentExecutionResult> => {
    if (!amountPaise || amountPaise <= 0 || isNaN(amountPaise)) {
      return { success: false, error: 'Please enter a valid amount greater than ₹0.' };
    }

    const memberRule = rawSpendingRules[currentUser.id] || {
      memberId: currentUser.id,
      singleTransactionLimitPaise: 200000,
      maxRequestLimitPaise: 200000,
      dailyLimitPaise: 500000,
      monthlyLimitPaise: 1000000,
      allowMoneyTransfer: true,
      allowQRPayments: true,
    };

    // Evaluate with central TransactionAuthorizationService
    const evaluation = transactionAuthorizationService.evaluateTransaction({
      member: currentUser,
      amountPaise,
      rule: memberRule,
      allTransactions: rawTransactions,
      adminWallet: ownerWallet,
      actionType: 'TRANSFER',
    });

    if (!evaluation.authorized) {
      return {
        success: false,
        isOverLimit: evaluation.requiresApproval,
        error: evaluation.reason,
        overLimitDetails: evaluation.overLimitDetails,
      };
    }

    const memberPersonalAccount = rawMemberPersonalAccounts[currentUser.id] || {
      userId: currentUser.id,
      balancePaise: 0,
      currency: 'INR' as const,
      isSimulated: true as const,
    };

    const owner = familyMembers.find((m) => m.role === 'owner') || currentUser;
    const completedTxn = transactionAuthorizationService.createCompletedTransfer({
      member: currentUser,
      owner,
      familyId: activeFamily.id,
      amountPaise,
      purpose: purpose.trim() || 'Family fund request (Automatic)',
    });

    if (isCustomUser) {
      const wallets = onboardingStorage.getWallets();
      const pool = wallets[activeFamily.id] || ownerWallet;
      pool.balancePaise = Math.max(0, pool.balancePaise - amountPaise);
      wallets[activeFamily.id] = pool;
      wallets[activeFamily.ownerId] = pool;

      const memAcc = wallets[currentUser.id] || memberPersonalAccount;
      memAcc.balancePaise += amountPaise;
      wallets[currentUser.id] = memAcc;
      onboardingStorage.saveWallets(wallets);

      const txns = onboardingStorage.getTransactions();
      txns.unshift(completedTxn);
      onboardingStorage.saveTransactions(txns);

      triggerSync();
    } else {
      setDemoData((prev: any) => {
        const currentMemAcc = prev.memberPersonalAccounts[currentUser.id] || memberPersonalAccount;
        const nextData = {
          ...prev,
          transactions: [completedTxn, ...prev.transactions],
          ownerWallet: { ...prev.ownerWallet, balancePaise: Math.max(0, prev.ownerWallet.balancePaise - amountPaise) },
          memberPersonalAccounts: {
            ...prev.memberPersonalAccounts,
            [currentUser.id]: {
              ...currentMemAcc,
              balancePaise: currentMemAcc.balancePaise + amountPaise,
            },
          },
        };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(nextData));
        } catch {}
        return nextData;
      });
    }

    return {
      success: true,
      autoTransferred: true,
      transaction: completedTxn,
    };
  };

  const submitLimitExceptionRequest = async (
    amountPaise: number,
    purpose: string,
    configuredLimitPaise?: number,
    excessAmountPaise?: number,
    message?: string
  ): Promise<{ success: boolean; request?: MoneyRequest; error?: string }> => {
    if (!amountPaise || amountPaise <= 0 || isNaN(amountPaise)) {
      return { success: false, error: 'Please enter a valid amount greater than ₹0.' };
    }

    const memberRule = rawSpendingRules[currentUser.id];
    const maxLimit = configuredLimitPaise ?? (memberRule?.maxRequestLimitPaise ?? memberRule?.singleTransactionLimitPaise ?? 200000);
    const excess = excessAmountPaise ?? Math.max(0, amountPaise - maxLimit);
    const finalMsg = (message && message.trim()) || purpose.trim() || 'Limit Exception Request';

    const exceptionRequest = transactionAuthorizationService.createPendingApprovalRequest({
      member: currentUser,
      familyId: activeFamily.id,
      amountPaise,
      purpose: finalMsg,
      message: finalMsg,
      configuredLimitPaise: maxLimit,
      excessAmountPaise: excess,
      isException: true,
      isExtraMoneyRequest: false,
    });

    if (isCustomUser) {
      const allReqs = onboardingStorage.getMoneyRequests();
      allReqs.unshift(exceptionRequest);
      onboardingStorage.saveMoneyRequests(allReqs);
      triggerSync();
    } else {
      setDemoData((prev: any) => ({
        ...prev,
        moneyRequests: [exceptionRequest, ...(prev.moneyRequests || [])],
      }));
    }

    return { success: true, request: exceptionRequest };
  };

  const submitExtraMoneyRequest = async (
    amountPaise: number,
    message?: string,
    reason?: string
  ): Promise<{
    success: boolean;
    autoAuthorized?: boolean;
    requiresApproval?: boolean;
    transaction?: Transaction;
    request?: MoneyRequest;
    error?: string;
    overLimitDetails?: any;
  }> => {
    if (!amountPaise || amountPaise <= 0 || isNaN(amountPaise)) {
      return { success: false, error: 'Please enter a valid amount greater than ₹0.' };
    }
    const trimmedMsg = (message && message.trim()) || 'Family fund request';

    const memberRule = rawSpendingRules[currentUser.id] || {
      memberId: currentUser.id,
      singleTransactionLimitPaise: 200000,
      maxRequestLimitPaise: 200000,
      dailyLimitPaise: 500000,
      monthlyLimitPaise: 1000000,
      allowMoneyTransfer: true,
      allowQRPayments: true,
    };

    // Central Transaction Authorization: Check limits
    const evaluation = transactionAuthorizationService.evaluateTransaction({
      member: currentUser,
      amountPaise,
      rule: memberRule,
      allTransactions: rawTransactions,
      adminWallet: ownerWallet,
      actionType: 'TRANSFER',
    });

    // CASE A / CASE B: Amount <= permitted limit & within daily & within monthly -> AUTO AUTHORIZE
    if (evaluation.authorized) {
      const autoResult = await requestMoney(amountPaise, trimmedMsg);
      if (autoResult.success && autoResult.transaction) {
        return {
          success: true,
          autoAuthorized: true,
          requiresApproval: false,
          transaction: autoResult.transaction,
        };
      }
      return {
        success: false,
        error: autoResult.error || 'Failed to auto-authorize transaction.',
      };
    }

    // CASE C: Amount > permitted limit OR daily/monthly exceeded -> PENDING APPROVAL REQUEST
    if (evaluation.requiresApproval) {
      const maxLimit = evaluation.overLimitDetails?.configuredLimitPaise ?? (memberRule.maxRequestLimitPaise ?? memberRule.singleTransactionLimitPaise);
      const excess = evaluation.overLimitDetails?.excessAmountPaise ?? Math.max(0, amountPaise - maxLimit);

      const extraMoneyRequest = transactionAuthorizationService.createPendingApprovalRequest({
        member: currentUser,
        familyId: activeFamily.id,
        amountPaise,
        purpose: trimmedMsg,
        message: trimmedMsg,
        configuredLimitPaise: maxLimit,
        excessAmountPaise: excess,
        isException: true,
        isExtraMoneyRequest: true,
      });

      if (isCustomUser) {
        const allReqs = onboardingStorage.getMoneyRequests();
        allReqs.unshift(extraMoneyRequest);
        onboardingStorage.saveMoneyRequests(allReqs);
        triggerSync();
      } else {
        setDemoData((prev: any) => {
          const nextData = {
            ...prev,
            moneyRequests: [extraMoneyRequest, ...(prev.moneyRequests || [])],
          };
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(nextData));
          } catch {}
          return nextData;
        });
      }

      return {
        success: true,
        autoAuthorized: false,
        requiresApproval: true,
        request: extraMoneyRequest,
        overLimitDetails: evaluation.overLimitDetails,
      };
    }

    // Other blocks (e.g. insufficient admin funds or disabled transfers)
    return {
      success: false,
      error: evaluation.reason || 'Transaction could not be authorized.',
    };
  };

  const createMoneyRequest = async (
    amountPaise: number,
    purpose?: string
  ): Promise<{
    success: boolean;
    autoAuthorized?: boolean;
    requiresApproval?: boolean;
    transaction?: Transaction;
    request?: MoneyRequest;
    error?: string;
    overLimitDetails?: any;
  }> => {
    return submitExtraMoneyRequest(amountPaise, (purpose && purpose.trim()) || 'Family fund request');
  };

  const approveMoneyRequest = async (requestId: string): Promise<PaymentExecutionResult> => {
    if (currentUser.role !== 'owner') {
      return { success: false, error: 'Unauthorized: Only the Family Administrator can approve requests.' };
    }

    const req = rawMoneyRequests.find((r) => r.id === requestId);
    if (!req) return { success: false, error: 'Money request not found.' };
    if (req.status !== 'PENDING') return { success: false, error: `This request has already been ${req.status.toLowerCase()}.` };

    if (ownerWallet.balancePaise < req.amountPaise) {
      return {
        success: false,
        error: `Insufficient administrator balance. Available: ₹${(ownerWallet.balancePaise / 100).toLocaleString('en-IN')}.`,
      };
    }

    const requestingMember = familyMembers.find((m) => m.id === req.memberId) || {
      id: req.memberId,
      name: req.memberName,
      role: 'member' as const,
      email: '',
      avatarUrl: req.memberAvatar || '',
      familyId: activeFamily.id,
    };

    const completedTxn: Transaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      reference: generateTransactionReference(),
      familyId: activeFamily.id,
      type: 'TRANSFER',
      status: 'COMPLETED',
      amountPaise: req.amountPaise,
      currency: 'INR',
      initiatorId: req.memberId,
      payerId: currentUser.id,
      senderId: currentUser.id,
      senderName: currentUser.name,
      recipientId: req.memberId,
      recipientName: req.memberName,
      paymentSource: 'ADMIN_ACCOUNT',
      date: new Date().toISOString(),
      note: req.isExtraMoneyRequest
        ? `Approved extra money request: ${req.message || req.purpose}`
        : req.isException
        ? `Approved limit exception: ${req.purpose}`
        : req.purpose,
      isSimulated: true,
    };

    if (isCustomUser) {
      const wallets = onboardingStorage.getWallets();
      const pool = wallets[activeFamily.id] || ownerWallet;
      pool.balancePaise = Math.max(0, pool.balancePaise - req.amountPaise);
      wallets[activeFamily.id] = pool;
      wallets[activeFamily.ownerId] = pool;

      const memWallet = wallets[req.memberId] || { userId: req.memberId, balancePaise: 0, currency: 'INR', isSimulated: true };
      memWallet.balancePaise += req.amountPaise;
      wallets[req.memberId] = memWallet;
      onboardingStorage.saveWallets(wallets);

      const allReqs = onboardingStorage.getMoneyRequests();
      const targetReq = allReqs.find((r) => r.id === requestId);
      if (targetReq) {
        targetReq.status = 'APPROVED';
        targetReq.resolvedAt = new Date().toISOString();
        targetReq.transactionReference = completedTxn.reference;
        onboardingStorage.saveMoneyRequests(allReqs);
      }

      const txns = onboardingStorage.getTransactions();
      txns.unshift(completedTxn);
      onboardingStorage.saveTransactions(txns);

      triggerSync();
    } else {
      setDemoData((prev: any) => {
        const nextData = {
          ...prev,
          transactions: [completedTxn, ...prev.transactions],
          moneyRequests: (prev.moneyRequests || []).map((r: MoneyRequest) =>
            r.id === requestId
              ? { ...r, status: 'APPROVED', resolvedAt: new Date().toISOString(), transactionReference: completedTxn.reference }
              : r
          ),
          ownerWallet: { ...prev.ownerWallet, balancePaise: Math.max(0, prev.ownerWallet.balancePaise - req.amountPaise) },
          memberPersonalAccounts: {
            ...prev.memberPersonalAccounts,
            [req.memberId]: {
              ...(prev.memberPersonalAccounts[req.memberId] || rawMemberPersonalAccounts[req.memberId] || { userId: req.memberId, balancePaise: 0, currency: 'INR', isSimulated: true }),
              balancePaise: ((prev.memberPersonalAccounts[req.memberId]?.balancePaise ?? rawMemberPersonalAccounts[req.memberId]?.balancePaise) || 0) + req.amountPaise,
            },
          },
        };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(nextData));
        } catch {}
        return nextData;
      });
    }

    return { success: true, transaction: completedTxn };
  };

  const rejectMoneyRequest = async (
    requestId: string,
    reason?: string
  ): Promise<{ success: boolean; request?: MoneyRequest; error?: string }> => {
    if (currentUser.role !== 'owner') {
      return { success: false, error: 'Unauthorized: Only Family Administrator can reject requests.' };
    }

    if (isCustomUser) {
      const allReqs = onboardingStorage.getMoneyRequests();
      const req = allReqs.find((r) => r.id === requestId);
      if (!req) return { success: false, error: 'Request not found' };
      if (req.status !== 'PENDING') return { success: false, error: `This request has already been ${req.status.toLowerCase()}.` };
      req.status = 'REJECTED';
      req.resolvedAt = new Date().toISOString();
      req.rejectionReason = reason || 'Declined by Administrator';
      onboardingStorage.saveMoneyRequests(allReqs);
      triggerSync();
      return { success: true, request: req };
    }

    const req = (demoData.moneyRequests || []).find((r: MoneyRequest) => r.id === requestId);
    if (!req) return { success: false, error: 'Request not found' };
    if (req.status !== 'PENDING') return { success: false, error: `This request has already been ${req.status.toLowerCase()}.` };

    const updatedReq: MoneyRequest = {
      ...req,
      status: 'REJECTED',
      resolvedAt: new Date().toISOString(),
      rejectionReason: reason || 'Declined by Administrator',
    };

    setDemoData((prev: any) => ({
      ...prev,
      moneyRequests: (prev.moneyRequests || []).map((r: MoneyRequest) => (r.id === requestId ? updatedReq : r)),
    }));

    return { success: true, request: updatedReq };
  };

  const addMoneyToAdmin = async (amountPaise: number, note?: string): Promise<PaymentExecutionResult> => {
    if (currentUser.role !== 'owner') {
      return { success: false, error: 'Unauthorized.' };
    }

    const completedTxn: Transaction = {
      id: `tx_${Date.now()}`,
      reference: generateTransactionReference(),
      familyId: activeFamily.id,
      type: 'ADD_MONEY',
      status: 'COMPLETED',
      amountPaise,
      currency: 'INR',
      initiatorId: currentUser.id,
      payerId: currentUser.id,
      senderName: currentUser.name,
      recipientName: `${activeFamily.name} Central Pool`,
      paymentSource: 'ADMIN_ACCOUNT',
      date: new Date().toISOString(),
      note: note || 'Family Pool Top-Up',
      isSimulated: true,
    };

    if (isCustomUser) {
      const wallets = onboardingStorage.getWallets();
      const pool = wallets[activeFamily.id] || ownerWallet;
      pool.balancePaise += amountPaise;
      wallets[activeFamily.id] = pool;
      wallets[activeFamily.ownerId] = pool;
      onboardingStorage.saveWallets(wallets);

      const txns = onboardingStorage.getTransactions();
      txns.unshift(completedTxn);
      onboardingStorage.saveTransactions(txns);

      triggerSync();
      return { success: true, transaction: completedTxn };
    }

    const result = await paymentService.processAddFunds({
      owner: currentUser,
      ownerWallet,
      amountPaise,
      note,
    });

    if (result.success && result.transaction) {
      result.transaction.familyId = activeFamily.id;
      setDemoData((prev: any) => ({
        ...prev,
        transactions: [result.transaction!, ...prev.transactions],
        ownerWallet: { ...prev.ownerWallet, balancePaise: prev.ownerWallet.balancePaise + amountPaise },
      }));
    }

    return result;
  };

  const sendMoney = async (
    memberId: string,
    amountPaise: number,
    note?: string
  ): Promise<PaymentExecutionResult> => {
    if (currentUser.role !== 'owner') {
      return { success: false, error: 'Unauthorized: Only the Family Administrator can transfer funds directly.' };
    }

    const member = familyMembers.find((m) => m.id === memberId);
    if (!member) {
      return { success: false, error: 'Selected family member not found.' };
    }

    const memberWallet = rawMemberPersonalAccounts[memberId] || {
      userId: memberId,
      balancePaise: 0,
      currency: 'INR',
      isSimulated: true,
    };

    const rule = rawSpendingRules[memberId] || {
      memberId,
      singleTransactionLimitPaise: 250000,
      dailyLimitPaise: 500000,
      monthlyLimitPaise: 1000000,
      allowMoneyTransfer: true,
      allowQRPayments: true,
    };

    const result = await paymentService.processDirectAdminTransfer({
      owner: currentUser,
      member,
      ownerWallet,
      memberWallet,
      rule,
      amountPaise,
      note,
      existingTransactions: rawTransactions,
    });

    if (result.transaction) {
      result.transaction.familyId = activeFamily.id;

      if (isCustomUser) {
        if (result.success) {
          const wallets = onboardingStorage.getWallets();
          const pool = wallets[activeFamily.id] || ownerWallet;
          pool.balancePaise = Math.max(0, pool.balancePaise - amountPaise);
          wallets[activeFamily.id] = pool;
          wallets[activeFamily.ownerId] = pool;

          const memW = wallets[memberId] || memberWallet;
          memW.balancePaise += amountPaise;
          wallets[memberId] = memW;
          onboardingStorage.saveWallets(wallets);
        }

        const txns = onboardingStorage.getTransactions();
        txns.unshift(result.transaction);
        onboardingStorage.saveTransactions(txns);

        triggerSync();
      } else {
        setDemoData((prev: any) => {
          const nextTxns = [result.transaction!, ...prev.transactions];
          if (result.success) {
            const currentMemAcc = prev.memberPersonalAccounts[memberId] || memberWallet;
            const nextData = {
              ...prev,
              transactions: nextTxns,
              ownerWallet: { ...prev.ownerWallet, balancePaise: Math.max(0, prev.ownerWallet.balancePaise - amountPaise) },
              memberPersonalAccounts: {
                ...prev.memberPersonalAccounts,
                [memberId]: {
                  ...currentMemAcc,
                  balancePaise: currentMemAcc.balancePaise + amountPaise,
                },
              },
            };
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(nextData));
            } catch {}
            return nextData;
          }
          return { ...prev, transactions: nextTxns };
        });
      }
    }

    return result;
  };

  const spendMoney = async (
    amountPaise: number,
    recipientName: string,
    category?: string,
    note?: string
  ): Promise<PaymentExecutionResult> => {
    if (currentUser.role !== 'owner') {
      return { success: false, error: 'Unauthorized: Only the Family Administrator can spend directly from the central account.' };
    }

    if (!amountPaise || amountPaise <= 0 || isNaN(amountPaise)) {
      return { success: false, error: 'Please enter a valid spending amount greater than ₹0.' };
    }

    if (ownerWallet.balancePaise < amountPaise) {
      return {
        success: false,
        error: `Insufficient balance in Administrator Account. Available: ₹${(ownerWallet.balancePaise / 100).toLocaleString('en-IN')}.`,
      };
    }

    const result = await paymentService.processAdminSpend({
      owner: currentUser,
      ownerWallet,
      amountPaise,
      recipientName,
      category,
      note,
      existingTransactions: rawTransactions,
    });

    if (result.success && result.transaction) {
      result.transaction.familyId = activeFamily.id;

      if (isCustomUser) {
        const wallets = onboardingStorage.getWallets();
        const pool = wallets[activeFamily.id] || ownerWallet;
        pool.balancePaise = Math.max(0, pool.balancePaise - amountPaise);
        wallets[activeFamily.id] = pool;
        wallets[activeFamily.ownerId] = pool;
        onboardingStorage.saveWallets(wallets);

        const txns = onboardingStorage.getTransactions();
        txns.unshift(result.transaction);
        onboardingStorage.saveTransactions(txns);

        triggerSync();
      } else {
        setDemoData((prev: any) => ({
          ...prev,
          transactions: [result.transaction!, ...prev.transactions],
          ownerWallet: { ...prev.ownerWallet, balancePaise: prev.ownerWallet.balancePaise - amountPaise },
        }));
      }
    }

    return result;
  };

  const payMerchantQR = async (qrPayload: QRPayload): Promise<PaymentExecutionResult> => {
    // 1. If Administrator scans QR: Pay directly from central pool
    if (currentUser.role === 'owner') {
      if (ownerWallet.balancePaise < qrPayload.amountPaise) {
        return {
          success: false,
          error: `Insufficient balance in Administrator Account. Available: ₹${(ownerWallet.balancePaise / 100).toLocaleString('en-IN')}.`,
        };
      }

      const result = await paymentService.processQRPayment({
        member: currentUser,
        owner: currentUser,
        ownerWallet,
        paymentSource: 'ADMIN_ACCOUNT',
        rule: {
          memberId: currentUser.id,
          singleTransactionLimitPaise: 100000000,
          dailyLimitPaise: 100000000,
          monthlyLimitPaise: 100000000,
          allowMoneyTransfer: true,
          allowQRPayments: true,
        },
        qrPayload,
        existingTransactions: rawTransactions,
      });

      if (result.success && result.transaction) {
        result.transaction.familyId = activeFamily.id;

        if (isCustomUser) {
          const wallets = onboardingStorage.getWallets();
          const pool = wallets[activeFamily.id] || ownerWallet;
          pool.balancePaise = Math.max(0, pool.balancePaise - qrPayload.amountPaise);
          wallets[activeFamily.id] = pool;
          wallets[activeFamily.ownerId] = pool;
          onboardingStorage.saveWallets(wallets);

          const txns = onboardingStorage.getTransactions();
          txns.unshift(result.transaction);
          onboardingStorage.saveTransactions(txns);
          triggerSync();
        } else {
          setDemoData((prev: any) => ({
            ...prev,
            transactions: [result.transaction!, ...prev.transactions],
            ownerWallet: { ...prev.ownerWallet, balancePaise: Math.max(0, prev.ownerWallet.balancePaise - qrPayload.amountPaise) },
          }));
        }
      }

      return result;
    }

    // 2. If Member scans QR: Pay from Personal Account subject to limits
    const rule = rawSpendingRules[currentUser.id] || {
      memberId: currentUser.id,
      singleTransactionLimitPaise: 250000,
      dailyLimitPaise: 500000,
      monthlyLimitPaise: 1000000,
      allowMoneyTransfer: true,
      allowQRPayments: true,
    };

    const personalAccount = rawMemberPersonalAccounts[currentUser.id] || {
      userId: currentUser.id,
      balancePaise: 0,
      currency: 'INR',
      isSimulated: true,
    };

    const result = await paymentService.processQRPayment({
      member: currentUser,
      memberAccount: personalAccount,
      paymentSource: 'PERSONAL_ACCOUNT',
      rule,
      qrPayload,
      existingTransactions: rawTransactions,
    });

    if (result.transaction) {
      result.transaction.familyId = activeFamily.id;

      if (isCustomUser) {
        if (result.success) {
          const wallets = onboardingStorage.getWallets();
          const memW = wallets[currentUser.id] || personalAccount;
          memW.balancePaise = Math.max(0, memW.balancePaise - qrPayload.amountPaise);
          wallets[currentUser.id] = memW;
          onboardingStorage.saveWallets(wallets);
        }
        const txns = onboardingStorage.getTransactions();
        txns.unshift(result.transaction);
        onboardingStorage.saveTransactions(txns);
        triggerSync();
      } else {
        setDemoData((prev: any) => {
          const nextTxns = [result.transaction!, ...prev.transactions];
          if (result.success) {
            const currentMemAcc = prev.memberPersonalAccounts[currentUser.id] || personalAccount;
            return {
              ...prev,
              transactions: nextTxns,
              memberPersonalAccounts: {
                ...prev.memberPersonalAccounts,
                [currentUser.id]: {
                  ...currentMemAcc,
                  balancePaise: Math.max(0, currentMemAcc.balancePaise - qrPayload.amountPaise),
                },
              },
            };
          }
          return { ...prev, transactions: nextTxns };
        });
      }
    }

    return result;
  };

  const payToMobile = async (params: {
    mobile: string;
    countryCode: string;
    amountPaise: number;
    recipientName?: string;
    note?: string;
    pin: string;
  }): Promise<PaymentExecutionResult> => {
    const { mobile, countryCode, amountPaise, recipientName, note, pin } = params;

    // 1. Mandatory 6-digit transaction PIN verification
    const pinValid = verifyUserPin(pin);
    if (!pinValid) {
      return {
        success: false,
        error: 'Incorrect 6-digit transaction PIN. Payment not authorized.',
      };
    }

    // 2. Validate amount
    if (!amountPaise || amountPaise <= 0 || isNaN(amountPaise)) {
      return { success: false, error: 'Please enter a valid payment amount greater than ₹0.' };
    }

    const cleanDigits = mobile.replace(/\D/g, '');
    const cleanCode = countryCode.trim() || '+91';

    // 3. Recipient discovery: check family members, then registered users, or external mobile contact
    const matchedFamilyMember = familyMembers.find((m) => {
      const mPhone = (m.phone || m.mobile || '').replace(/\D/g, '');
      return mPhone && cleanDigits && (mPhone.endsWith(cleanDigits) || cleanDigits.endsWith(mPhone));
    });

    const registeredUsers = onboardingStorage.getRegisteredUsers();
    const matchedRegisteredUser = registeredUsers.find((u) => {
      const uPhone = (u.phone || u.mobile || '').replace(/\D/g, '');
      return uPhone && cleanDigits && (uPhone.endsWith(cleanDigits) || cleanDigits.endsWith(uPhone));
    });

    const targetRecipientName =
      matchedFamilyMember?.name ||
      matchedRegisteredUser?.name ||
      recipientName?.trim() ||
      `Mobile (${cleanCode} ${cleanDigits})`;

    const targetRecipientId =
      matchedFamilyMember?.id ||
      matchedRegisteredUser?.id ||
      `ext_mob_${cleanDigits}`;

    // 4. Role-based execution
    if (currentUser.role === 'owner') {
      // ADMINISTRATOR SENDING TO MOBILE:
      if (ownerWallet.balancePaise < amountPaise) {
        return {
          success: false,
          error: `Insufficient balance in Administrator Account. Available: ₹${(ownerWallet.balancePaise / 100).toLocaleString('en-IN')}.`,
        };
      }

      // Check if recipient is a family dependent
      if (matchedFamilyMember && matchedFamilyMember.id !== currentUser.id) {
        return sendMoney(matchedFamilyMember.id, amountPaise, note || 'Mobile Transfer');
      }

      // Spend/Transfer from central pool to external contact or another registered user
      const result = await paymentService.processAdminSpend({
        owner: currentUser,
        ownerWallet,
        amountPaise,
        recipientName: targetRecipientName,
        category: 'Mobile Transfer',
        note: note || `Mobile transfer to ${cleanCode} ${cleanDigits}`,
        existingTransactions: rawTransactions,
      });

      if (result.success && result.transaction) {
        result.transaction.familyId = activeFamily.id;
        result.transaction.type = 'TRANSFER';
        result.transaction.recipientId = targetRecipientId;

        if (isCustomUser) {
          const wallets = onboardingStorage.getWallets();
          const pool = wallets[activeFamily.id] || ownerWallet;
          pool.balancePaise = Math.max(0, pool.balancePaise - amountPaise);
          wallets[activeFamily.id] = pool;
          wallets[activeFamily.ownerId] = pool;

          // If recipient is another registered user, credit their wallet
          if (matchedRegisteredUser && wallets[matchedRegisteredUser.id]) {
            wallets[matchedRegisteredUser.id].balancePaise += amountPaise;
          }
          onboardingStorage.saveWallets(wallets);

          const txns = onboardingStorage.getTransactions();
          txns.unshift(result.transaction);
          onboardingStorage.saveTransactions(txns);
          triggerSync();
        } else {
          if (matchedRegisteredUser) {
            const wallets = onboardingStorage.getWallets();
            if (wallets[matchedRegisteredUser.id]) {
              wallets[matchedRegisteredUser.id].balancePaise += amountPaise;
              onboardingStorage.saveWallets(wallets);
            }
          }
          setDemoData((prev: any) => ({
            ...prev,
            transactions: [result.transaction!, ...prev.transactions],
            ownerWallet: { ...prev.ownerWallet, balancePaise: Math.max(0, prev.ownerWallet.balancePaise - amountPaise) },
          }));
        }
      }
      return result;
    }

    // MEMBER SENDING TO MOBILE (Subject to spending limits):
    const rule = rawSpendingRules[currentUser.id] || {
      memberId: currentUser.id,
      singleTransactionLimitPaise: 250000,
      dailyLimitPaise: 500000,
      monthlyLimitPaise: 1000000,
      allowMoneyTransfer: true,
      allowQRPayments: true,
    };

    const personalAccount = rawMemberPersonalAccounts[currentUser.id] || {
      userId: currentUser.id,
      balancePaise: 0,
      currency: 'INR',
      isSimulated: true,
    };

    // Check spending rules
    const evaluation = evaluateSpendingEligibility({
      amountPaise,
      actionType: 'TRANSFER',
      member: currentUser,
      memberAccount: personalAccount,
      rule,
      allTransactions: rawTransactions,
    });

    if (!evaluation.eligible) {
      const maxLimit = rule.maxRequestLimitPaise ?? rule.singleTransactionLimitPaise;
      const isOverLimit =
        amountPaise > maxLimit ||
        evaluation.code === 'DAILY_LIMIT_EXCEEDED' ||
        evaluation.code === 'MONTHLY_LIMIT_EXCEEDED';

      let configuredLimitPaise = maxLimit;
      let excessAmountPaise = Math.max(0, amountPaise - maxLimit);

      if (evaluation.code === 'MONTHLY_LIMIT_EXCEEDED') {
        configuredLimitPaise = rule.monthlyLimitPaise;
        excessAmountPaise = Math.max(
          0,
          (evaluation.details?.spentThisMonthPaise || 0) + amountPaise - rule.monthlyLimitPaise
        );
      } else if (evaluation.code === 'DAILY_LIMIT_EXCEEDED') {
        configuredLimitPaise = rule.dailyLimitPaise;
        excessAmountPaise = Math.max(
          0,
          (evaluation.details?.spentTodayPaise || 0) + amountPaise - rule.dailyLimitPaise
        );
      }

      return {
        success: false,
        error: evaluation.reason,
        isOverLimit,
        overLimitDetails: isOverLimit
          ? {
              configuredLimitPaise,
              requestedAmountPaise: amountPaise,
              excessAmountPaise,
            }
          : undefined,
      };
    }

    // Check personal balance
    if (personalAccount.balancePaise < amountPaise) {
      return {
        success: false,
        error: `Insufficient personal balance. Available: ₹${(personalAccount.balancePaise / 100).toLocaleString('en-IN')}.`,
      };
    }

    // Execute member payment
    const completedTxn: Transaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      reference: generateTransactionReference(),
      familyId: activeFamily.id,
      type: 'TRANSFER',
      status: 'COMPLETED',
      amountPaise,
      currency: 'INR',
      initiatorId: currentUser.id,
      payerId: currentUser.id,
      senderId: currentUser.id,
      senderName: currentUser.name,
      recipientId: targetRecipientId,
      recipientName: targetRecipientName,
      paymentSource: 'PERSONAL_ACCOUNT',
      date: new Date().toISOString(),
      note: note || `Mobile transfer to ${cleanCode} ${cleanDigits}`,
      isSimulated: true,
    };

    if (isCustomUser) {
      const wallets = onboardingStorage.getWallets();
      const memW = wallets[currentUser.id] || personalAccount;
      memW.balancePaise = Math.max(0, memW.balancePaise - amountPaise);
      wallets[currentUser.id] = memW;

      if (matchedFamilyMember && wallets[matchedFamilyMember.id]) {
        wallets[matchedFamilyMember.id].balancePaise += amountPaise;
      }
      onboardingStorage.saveWallets(wallets);

      const txns = onboardingStorage.getTransactions();
      txns.unshift(completedTxn);
      onboardingStorage.saveTransactions(txns);
      triggerSync();
    } else {
      setDemoData((prev: any) => {
        const nextPersonalAccounts = { ...prev.memberPersonalAccounts };
        const currentSenderAcc = nextPersonalAccounts[currentUser.id] || personalAccount;
        nextPersonalAccounts[currentUser.id] = {
          ...currentSenderAcc,
          balancePaise: Math.max(0, currentSenderAcc.balancePaise - amountPaise),
        };

        let nextOwnerWallet = prev.ownerWallet;
        if (matchedFamilyMember) {
          if (matchedFamilyMember.role === 'owner') {
            nextOwnerWallet = {
              ...prev.ownerWallet,
              balancePaise: prev.ownerWallet.balancePaise + amountPaise,
            };
          } else if (matchedFamilyMember.id !== currentUser.id) {
            const recipientAcc = nextPersonalAccounts[matchedFamilyMember.id] || rawMemberPersonalAccounts[matchedFamilyMember.id] || {
              userId: matchedFamilyMember.id,
              balancePaise: 0,
              currency: 'INR',
              isSimulated: true,
            };
            nextPersonalAccounts[matchedFamilyMember.id] = {
              ...recipientAcc,
              balancePaise: recipientAcc.balancePaise + amountPaise,
            };
          }
        }

        return {
          ...prev,
          transactions: [completedTxn, ...prev.transactions],
          ownerWallet: nextOwnerWallet,
          memberPersonalAccounts: nextPersonalAccounts,
        };
      });
    }

    return {
      success: true,
      transaction: completedTxn,
    };
  };

  // Transaction PIN Helpers
  const setUserPin = (pin: string): { success: boolean; error?: string } => {
    const val = validatePinFormat(pin);
    if (!val.valid) return { success: false, error: val.error };
    const salt = generatePinSalt();
    const hash = hashPinSync(pin, salt);

    if (isCustomUser) {
      onboardingStorage.setUserPin(currentUser.id, pin);
      triggerSync();
    } else {
      setDemoData((prev: any) => ({
        ...prev,
        familyMembers: prev.familyMembers.map((m: User) =>
          m.id === currentUser.id
            ? { ...m, hasTransactionPin: true, pinHash: hash, pinSalt: salt, pinSetAt: new Date().toISOString() }
            : m
        ),
      }));
    }
    return { success: true };
  };

  const verifyUserPin = (pin: string): boolean => {
    return onboardingStorage.verifyUserPin(currentUser, pin);
  };

  const changeUserPin = (currentPin: string, newPin: string): { success: boolean; error?: string } => {
    if (!verifyUserPin(currentPin)) {
      return { success: false, error: 'Current transaction PIN is incorrect.' };
    }
    return setUserPin(newPin);
  };

  const updateUserProfile = (updates: Partial<User>) => {
    if (isCustomUser) {
      onboardingStorage.updateUserProfile(currentUser.id, updates);
      triggerSync();
    } else {
      setDemoData((prev: any) => ({
        ...prev,
        familyMembers: prev.familyMembers.map((m: User) =>
          m.id === currentUser.id ? { ...m, ...updates } : m
        ),
      }));
    }
  };

  // ONBOARDING & REGISTRATION METHODS
  const registerMobileUser = async (
    name: string,
    countryCode: string,
    mobile: string,
    country?: string
  ): Promise<User> => {
    const newUser = onboardingStorage.registerMobileUser(name, countryCode, mobile, country);
    triggerSync();
    return newUser;
  };

  const linkBankAccount = async (
    userId: string,
    data: { accountHolderName: string; bankName: string; accountNumber: string; ifscCode: string }
  ): Promise<User> => {
    const updated = onboardingStorage.linkBankAccount(userId, data);
    triggerSync();
    return updated;
  };

  const createCustomFamily = async (
    userId: string,
    familyName: string,
    initialBalanceRupees: number = 0
  ): Promise<{ family: Family; joiningCode: string; user: User }> => {
    const res = onboardingStorage.createCustomFamily(userId, familyName, initialBalanceRupees);
    triggerSync();
    return res;
  };

  const verifyJoiningCode = (code: string) => {
    return onboardingStorage.verifyJoiningCode(code);
  };

  const submitMembershipRequest = async (
    userId: string,
    joiningCode: string
  ): Promise<{ success: boolean; request?: MembershipRequest; error?: string }> => {
    const res = onboardingStorage.submitMembershipRequest(userId, joiningCode);
    triggerSync();
    return res;
  };

  const checkUserMembershipStatus = (userId: string) => {
    return onboardingStorage.checkUserMembershipStatus(userId);
  };

  const approveMembershipRequest = async (requestId: string): Promise<boolean> => {
    if (currentUser.role !== 'owner') return false;
    const res = onboardingStorage.approveMembershipRequest(requestId);
    if (res.success) {
      triggerSync();
      return true;
    }
    return false;
  };

  const rejectMembershipRequest = async (requestId: string, reason?: string): Promise<boolean> => {
    if (currentUser.role !== 'owner') return false;
    const res = onboardingStorage.rejectMembershipRequest(requestId, reason);
    if (res.success) {
      triggerSync();
      return true;
    }
    return false;
  };

  const leaveFamily = async (): Promise<{ success: boolean; error?: string }> => {
    if (currentUser.role !== 'member') {
      return { success: false, error: 'Only family members can leave a family.' };
    }

    if (isCustomUser) {
      const res = onboardingStorage.leaveFamily(currentUser.id);
      if (res.success) {
        triggerSync();
        return { success: true };
      }
      return res;
    }

    // Demo member (e.g. Priya or Aarav): remove from familyMembers, preserving balance & transactions
    setDemoData((prev: any) => ({
      ...prev,
      familyMembers: prev.familyMembers.filter((m: User) => m.id !== currentUser.id),
      currentUserId: INITIAL_OWNER.id,
    }));
    triggerSync();
    return { success: true };
  };

  const deleteAccount = async (pin: string): Promise<{ success: boolean; error?: string }> => {
    // 1. Mandatory 6-digit transaction PIN verification
    const isValid = verifyUserPin(pin);
    if (!isValid) {
      return {
        success: false,
        error: 'Incorrect 6-digit transaction PIN. Identity verification failed; account was not deleted.',
      };
    }

    const deletingUserId = currentUser.id;
    const isOwner = currentUser.role === 'owner';

    if (isCustomUser) {
      const res = onboardingStorage.deleteUserAccount(deletingUserId);
      if (res.success) {
        logoutUser();
        return { success: true };
      }
      return res;
    }

    // Built-in demo persona deletion
    if (!isOwner) {
      setDemoData((prev: any) => {
        const nextMembers = prev.familyMembers.filter((m: User) => m.id !== deletingUserId);
        const nextAccounts = { ...prev.memberPersonalAccounts };
        delete nextAccounts[deletingUserId];
        const nextRules = { ...prev.spendingRules };
        delete nextRules[deletingUserId];

        return {
          ...prev,
          familyMembers: nextMembers,
          memberPersonalAccounts: nextAccounts,
          spendingRules: nextRules,
          currentUserId: INITIAL_OWNER.id,
        };
      });
      logoutUser();
      return { success: true };
    } else {
      resetDemoData();
      logoutUser();
      return { success: true };
    }
  };

  const clearAllLocalTestData = () => {
    onboardingStorage.clearAllLocalTestData();
    localStorage.removeItem(STORAGE_KEY);
    setDemoData({
      currentUserId: INITIAL_OWNER.id,
      familyMembers: INITIAL_MEMBERS,
      ownerWallet: INITIAL_OWNER_WALLET,
      memberPersonalAccounts: INITIAL_MEMBER_PERSONAL_ACCOUNTS,
      spendingRules: INITIAL_SPENDING_RULES,
      transactions: INITIAL_TRANSACTIONS,
      moneyRequests: INITIAL_MONEY_REQUESTS,
    });
    triggerSync();
  };

  const loginMobileUser = async (
    countryCode: string,
    mobile: string
  ): Promise<{ success: boolean; user?: User; error?: string }> => {
    const res = onboardingStorage.loginMobileUser(countryCode, mobile);
    if (res.success && res.user) {
      triggerSync();
    }
    return res;
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        family: activeFamily,
        familyMembers,
        ownerWallet,
        memberPersonalAccounts: authorizedMemberPersonalAccounts,
        spendingRules: authorizedSpendingRules,
        transactions: authorizedTransactions,
        moneyRequests: authorizedMoneyRequests,
        pendingMembershipRequests,
        familyJoiningCode,
        isCustomUser,
        switchUser,
        resetDemoData,
        updateSpendingRule,
        inviteMember,
        removeMember,
        requestMoney,
        submitLimitExceptionRequest,
        submitExtraMoneyRequest,
        requestExtraMoney: submitExtraMoneyRequest,
        createMoneyRequest,
        approveMoneyRequest,
        rejectMoneyRequest,
        sendMoney,
        spendMoney,
        addMoneyToAdmin,
        payMerchantQR,
        payToMobile,
        getMemberSpending,
        getMemberConsumption,
        setUserPin,
        verifyUserPin,
        changeUserPin,
        updateUserProfile,
        registerMobileUser,
        linkBankAccount,
        createCustomFamily,
        verifyJoiningCode,
        submitMembershipRequest,
        checkUserMembershipStatus,
        approveMembershipRequest,
        rejectMembershipRequest,
        loginMobileUser,
        logoutUser,
        leaveFamily,
        deleteAccount,
        clearAllLocalTestData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
