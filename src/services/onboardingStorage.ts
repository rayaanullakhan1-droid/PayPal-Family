import {
  User,
  Family,
  Wallet,
  SpendingRule,
  Transaction,
  MoneyRequest,
  MembershipRequest,
  BankAccount,
  OnboardingStep,
} from '../types';
import {
  generatePinSalt,
  hashPinSync,
  verifyPinSync,
  validatePinFormat,
  DEMO_PIN_HASH,
  DEMO_PIN_SALT,
} from '../utils/security';

const STORAGE_KEYS = {
  USERS: 'pf_registered_users',
  FAMILIES: 'pf_custom_families',
  MEMBERSHIP_REQUESTS: 'pf_membership_requests',
  WALLETS: 'pf_custom_wallets',
  SPENDING_RULES: 'pf_custom_spending_rules',
  TRANSACTIONS: 'pf_custom_transactions',
  MONEY_REQUESTS: 'pf_custom_money_requests',
  ACTIVE_USER_ID: 'pf_active_user_id',
};

// Safe LocalStorage helpers
function readItem<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

function writeItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error('LocalStorage write error for key', key, err);
  }
}

export function maskAccountNumber(acc: string): string {
  const clean = acc.replace(/\s+/g, '');
  if (clean.length <= 4) return clean;
  const last4 = clean.slice(-4);
  return `•••• •••• ${last4}`;
}

export function generateJoiningCode(): string {
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `JOIN-${rand}`;
}

const DEFAULT_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
];

export const onboardingStorage = {
  // ----------------------------------------------------
  // USERS
  // ----------------------------------------------------
  getRegisteredUsers(): User[] {
    return readItem<User[]>(STORAGE_KEYS.USERS, []);
  },

  getUserById(id: string): User | null {
    const users = this.getRegisteredUsers();
    return users.find((u) => u.id === id) || null;
  },

  getUserByMobile(countryCode: string, mobile: string): User | null {
    const cleanMobile = mobile.replace(/\D/g, '');
    const cleanCode = countryCode.trim();
    const users = this.getRegisteredUsers();
    return (
      users.find(
        (u) =>
          u.mobile?.replace(/\D/g, '') === cleanMobile &&
          (u.countryCode?.trim() === cleanCode || !u.countryCode)
      ) ||
      users.find((u) => u.mobile?.replace(/\D/g, '') === cleanMobile) ||
      null
    );
  },

  saveUser(user: User): void {
    const users = this.getRegisteredUsers();
    const idx = users.findIndex((u) => u.id === user.id);
    if (idx !== -1) {
      users[idx] = user;
    } else {
      users.push(user);
    }
    writeItem(STORAGE_KEYS.USERS, users);
  },

  getActiveUserId(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEYS.ACTIVE_USER_ID);
    } catch {
      return null;
    }
  },

  setActiveUserId(id: string | null): void {
    try {
      if (id) {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_USER_ID, id);
      } else {
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_USER_ID);
      }
    } catch {}
  },

  // ----------------------------------------------------
  // TRANSACTION PIN & SECURITY
  // ----------------------------------------------------
  setUserPin(userId: string, pin: string): { success: boolean; user?: User; error?: string } {
    const val = validatePinFormat(pin);
    if (!val.valid) return { success: false, error: val.error };
    const user = this.getUserById(userId);
    if (!user) return { success: false, error: 'User not found.' };

    const salt = generatePinSalt();
    const hash = hashPinSync(pin, salt);

    user.hasTransactionPin = true;
    user.pinHash = hash;
    user.pinSalt = salt;
    user.pinSetAt = new Date().toISOString();
    this.saveUser(user);

    return { success: true, user };
  },

  verifyUserPin(user: User, pin: string): boolean {
    if (!pin || !/^\d{6}$/.test(pin)) return false;
    // If user has custom salt & hash
    if (user.pinHash && user.pinSalt) {
      return verifyPinSync(pin, user.pinHash, user.pinSalt);
    }
    // Fallback for default demo accounts
    return verifyPinSync(pin, DEMO_PIN_HASH, DEMO_PIN_SALT);
  },

  changeUserPin(userId: string, currentPin: string, newPin: string): { success: boolean; error?: string } {
    const user = this.getUserById(userId);
    if (!user) return { success: false, error: 'User not found.' };

    if (user.hasTransactionPin && !this.verifyUserPin(user, currentPin)) {
      return { success: false, error: 'Incorrect current transaction PIN.' };
    }

    const val = validatePinFormat(newPin);
    if (!val.valid) return { success: false, error: val.error };

    const salt = generatePinSalt();
    const hash = hashPinSync(newPin, salt);
    user.hasTransactionPin = true;
    user.pinHash = hash;
    user.pinSalt = salt;
    user.pinSetAt = new Date().toISOString();
    this.saveUser(user);

    return { success: true };
  },

  updateUserProfile(userId: string, updates: Partial<User>): User | null {
    const user = this.getUserById(userId);
    if (!user) return null;
    const updated = { ...user, ...updates };
    this.saveUser(updated);
    return updated;
  },

  // ----------------------------------------------------
  // STEP 1: MOBILE REGISTRATION
  // ----------------------------------------------------
  registerMobileUser(name: string, countryCode: string, mobile: string, country?: string): User {
    const cleanName = name.trim();
    const cleanMobile = mobile.replace(/\D/g, '');
    const cleanCode = countryCode.trim() || '+91';

    // If an account already exists with this mobile, return it to resume onboarding
    const existing = this.getUserByMobile(cleanCode, cleanMobile);
    if (existing) {
      if (country) existing.country = country;
      this.saveUser(existing);
      this.setActiveUserId(existing.id);
      return existing;
    }

    const userId = `usr_reg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const randomAvatar = DEFAULT_AVATARS[Math.floor(Math.random() * DEFAULT_AVATARS.length)];

    const newUser: User = {
      id: userId,
      name: cleanName,
      email: `${cleanMobile}@paypalfamily.local`,
      role: 'member', // will become 'owner' if they create family, or member if they join
      avatarUrl: randomAvatar,
      familyId: '',
      mobile: cleanMobile,
      phone: `${cleanCode} ${cleanMobile}`,
      country: country || (cleanCode === '+91' ? 'India' : 'International'),
      countryCode: cleanCode,
      onboardingStep: 'bank',
      membershipStatus: 'PENDING',
      isCustomUser: true,
      createdAt: new Date().toISOString(),
    };

    this.saveUser(newUser);
    this.setActiveUserId(userId);
    return newUser;
  },

  // ----------------------------------------------------
  // STEP 2: LINK SIMULATED BANK ACCOUNT
  // ----------------------------------------------------
  linkBankAccount(
    userId: string,
    data: {
      accountHolderName: string;
      bankName: string;
      accountNumber: string;
      ifscCode: string;
    }
  ): User {
    const user = this.getUserById(userId);
    if (!user) {
      throw new Error('User not found. Please register first.');
    }

    const rawAcc = data.accountNumber.trim();
    const masked = maskAccountNumber(rawAcc);

    const bankAccount: BankAccount = {
      accountHolderName: data.accountHolderName.trim() || user.name,
      bankName: data.bankName.trim() || 'HDFC Bank',
      accountNumber: masked,
      rawAccountNumber: rawAcc,
      ifscCode: data.ifscCode.trim().toUpperCase() || 'HDFC0001234',
      linkedAt: new Date().toISOString(),
    };

    user.bankAccount = bankAccount;
    user.onboardingStep = 'family_choice';
    this.saveUser(user);
    return user;
  },

  // ----------------------------------------------------
  // STEP 3 & 4A: CREATE FAMILY
  // ----------------------------------------------------
  getCustomFamilies(): Family[] {
    return readItem<Family[]>(STORAGE_KEYS.FAMILIES, []);
  },

  getFamilyById(id: string): Family | null {
    const families = this.getCustomFamilies();
    return families.find((f) => f.id === id) || null;
  },

  getFamilyByJoiningCode(code: string): Family | null {
    const clean = code.trim().toUpperCase();
    const families = this.getCustomFamilies();
    return families.find((f) => f.joiningCode?.toUpperCase() === clean) || null;
  },

  saveFamily(family: Family): void {
    const families = this.getCustomFamilies();
    const idx = families.findIndex((f) => f.id === family.id);
    if (idx !== -1) {
      families[idx] = family;
    } else {
      families.push(family);
    }
    writeItem(STORAGE_KEYS.FAMILIES, families);
  },

  createCustomFamily(
    userId: string,
    familyName: string,
    initialBalanceRupees: number = 0
  ): { family: Family; joiningCode: string; user: User } {
    const user = this.getUserById(userId);
    if (!user) {
      throw new Error('User not found.');
    }

    const familyId = `fam_custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const joiningCode = generateJoiningCode();
    // Default to ₹0 starting balance (no artificial balance created)
    const initialPaise = Math.max(0, Number(initialBalanceRupees) || 0) * 100;

    const newFamily: Family = {
      id: familyId,
      name: familyName.trim() || `${user.name}'s Family`,
      ownerId: user.id,
      createdAt: new Date().toISOString(),
      currency: 'INR',
      joiningCode,
      initialBalancePaise: initialPaise,
      isCustomFamily: true,
      bankAccount: user.bankAccount,
      fundingSource: user.bankAccount
        ? `${user.bankAccount.bankName} (${user.bankAccount.accountNumber})`
        : 'Linked Bank Account',
    };

    // Update user to Family Administrator
    user.role = 'owner';
    user.familyId = familyId;
    user.relationship = 'Family Administrator';
    user.onboardingStep = 'completed';
    user.membershipStatus = 'ACTIVE';

    this.saveFamily(newFamily);
    this.saveUser(user);

    // Initialize Administrator / Central Pool Wallet
    const wallets = this.getWallets();
    const poolWallet: Wallet = {
      userId: user.id,
      balancePaise: initialPaise,
      currency: 'INR',
      isSimulated: true,
    };
    wallets[familyId] = poolWallet;
    wallets[user.id] = poolWallet;
    writeItem(STORAGE_KEYS.WALLETS, wallets);

    const rules = this.getSpendingRules();
    rules[user.id] = {
      memberId: user.id,
      singleTransactionLimitPaise: 1000000,
      maxRequestLimitPaise: 1000000,
      dailyLimitPaise: 2500000,
      monthlyLimitPaise: 5000000,
      allowMoneyTransfer: true,
      allowQRPayments: true,
    };
    writeItem(STORAGE_KEYS.SPENDING_RULES, rules);

    // Only record initial deposit transaction if initial funds are explicitly provided (> 0)
    if (initialPaise > 0) {
      const initialTxn: Transaction = {
        id: `tx_${Date.now()}`,
        reference: `TXN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
        familyId,
        type: 'ADD_MONEY',
        status: 'COMPLETED',
        amountPaise: initialPaise,
        currency: 'INR',
        initiatorId: user.id,
        payerId: user.id,
        senderName: user.name,
        recipientName: `${newFamily.name} Pool`,
        paymentSource: 'ADMIN_ACCOUNT',
        date: new Date().toISOString(),
        note: 'Initial Family Pool Funding',
        isSimulated: true,
      };

      const txns = this.getTransactions();
      txns.unshift(initialTxn);
      writeItem(STORAGE_KEYS.TRANSACTIONS, txns);
    }

    return { family: newFamily, joiningCode, user };
  },

  // ----------------------------------------------------
  // STEP 4B: JOIN FAMILY (CODE VERIFICATION & APPROVAL)
  // ----------------------------------------------------
  verifyJoiningCode(code: string): {
    valid: boolean;
    family?: Family;
    adminName?: string;
    error?: string;
  } {
    const clean = code.trim().toUpperCase();
    if (!clean) {
      return { valid: false, error: 'Please enter a family joining code.' };
    }

    // Check demo family joining code
    if (clean === 'SHARMA-2026') {
      const demoFamily: Family = {
        id: 'fam_sharma_01',
        name: 'The Sharma Family',
        ownerId: 'usr_owner_rajesh',
        createdAt: '2026-01-15T08:00:00.000Z',
        currency: 'INR',
        joiningCode: 'SHARMA-2026',
      };
      return {
        valid: true,
        family: demoFamily,
        adminName: 'Rajesh Sharma',
      };
    }

    // Check custom families
    const family = this.getFamilyByJoiningCode(clean);
    if (!family) {
      return {
        valid: false,
        error: 'Invalid or expired Family Joining Code. Please ask your Family Administrator for the code.',
      };
    }

    const admin = this.getUserById(family.ownerId);
    return {
      valid: true,
      family,
      adminName: admin?.name || 'Family Administrator',
    };
  },

  getMembershipRequests(familyId?: string): MembershipRequest[] {
    const all = readItem<MembershipRequest[]>(STORAGE_KEYS.MEMBERSHIP_REQUESTS, []);
    if (!familyId) return all;
    return all.filter((r) => r.familyId === familyId);
  },

  submitMembershipRequest(
    userId: string,
    joiningCode: string
  ): {
    success: boolean;
    request?: MembershipRequest;
    error?: string;
  } {
    const verification = this.verifyJoiningCode(joiningCode);
    if (!verification.valid || !verification.family) {
      return { success: false, error: verification.error || 'Invalid joining code.' };
    }

    const user = this.getUserById(userId);
    if (!user) {
      return { success: false, error: 'User profile not found.' };
    }

    const family = verification.family;

    // Check if user already has a pending or active request for this family
    const allReqs = this.getMembershipRequests();
    const existing = allReqs.find(
      (r) => r.userId === userId && r.familyId === family.id && r.status === 'PENDING'
    );

    if (existing) {
      user.familyId = family.id;
      user.onboardingStep = 'pending_approval';
      user.membershipStatus = 'PENDING';
      this.saveUser(user);
      return { success: true, request: existing };
    }

    const newReq: MembershipRequest = {
      id: `req_mem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      familyId: family.id,
      familyName: family.name,
      userId: user.id,
      userName: user.name,
      userMobile: `${user.countryCode || '+91'} ${user.mobile}`,
      userAvatar: user.avatarUrl,
      bankSummary: user.bankAccount
        ? `${user.bankAccount.bankName} (${user.bankAccount.accountNumber})`
        : 'Linked Bank Account',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    allReqs.unshift(newReq);
    writeItem(STORAGE_KEYS.MEMBERSHIP_REQUESTS, allReqs);

    // Update user state to pending approval
    user.familyId = family.id;
    user.relationship = 'Family Member (Pending)';
    user.onboardingStep = 'pending_approval';
    user.membershipStatus = 'PENDING';
    this.saveUser(user);

    return { success: true, request: newReq };
  },

  checkUserMembershipStatus(userId: string): {
    status: 'ACTIVE' | 'PENDING' | 'REJECTED' | 'NONE';
    family?: Family;
    request?: MembershipRequest;
  } {
    const user = this.getUserById(userId);
    if (!user) return { status: 'NONE' };

    if (user.role === 'owner' && user.familyId) {
      const family = this.getFamilyById(user.familyId);
      return { status: 'ACTIVE', family: family || undefined };
    }

    if (user.membershipStatus === 'ACTIVE' && user.familyId) {
      const family = this.getFamilyById(user.familyId);
      return { status: 'ACTIVE', family: family || undefined };
    }

    const allReqs = this.getMembershipRequests();
    const req = allReqs.find((r) => r.userId === userId);
    if (!req) {
      return { status: 'NONE' };
    }

    const family = this.getFamilyById(req.familyId);
    const resolvedStatus: 'ACTIVE' | 'PENDING' | 'REJECTED' | 'NONE' =
      req.status === 'APPROVED' ? 'ACTIVE' : req.status === 'REJECTED' ? 'REJECTED' : 'PENDING';
    return {
      status: resolvedStatus,
      family: family || undefined,
      request: req,
    };
  },

  approveMembershipRequest(requestId: string): {
    success: boolean;
    user?: User;
    family?: Family;
    error?: string;
  } {
    const allReqs = this.getMembershipRequests();
    const req = allReqs.find((r) => r.id === requestId);
    if (!req) {
      return { success: false, error: 'Membership request not found.' };
    }

    if (req.status !== 'PENDING') {
      return { success: false, error: `Request already ${req.status.toLowerCase()}.` };
    }

    req.status = 'APPROVED';
    req.resolvedAt = new Date().toISOString();
    writeItem(STORAGE_KEYS.MEMBERSHIP_REQUESTS, allReqs);

    // Update applicant user to active member
    const user = this.getUserById(req.userId);
    if (user) {
      user.role = 'member';
      user.familyId = req.familyId;
      user.relationship = 'Family Member';
      user.onboardingStep = 'completed';
      user.membershipStatus = 'ACTIVE';
      this.saveUser(user);

      // Create personal wallet starting at 0
      const wallets = this.getWallets();
      if (!wallets[user.id]) {
        wallets[user.id] = {
          userId: user.id,
          balancePaise: 0,
          currency: 'INR',
          isSimulated: true,
        };
        writeItem(STORAGE_KEYS.WALLETS, wallets);
      }

      // Create default spending rule
      const rules = this.getSpendingRules();
      if (!rules[user.id]) {
        rules[user.id] = {
          memberId: user.id,
          singleTransactionLimitPaise: 200000, // ₹2,000
          maxRequestLimitPaise: 200000,
          dailyLimitPaise: 500000,             // ₹5,000
          monthlyLimitPaise: 1000000,          // ₹10,000
          allowMoneyTransfer: true,
          allowQRPayments: true,
        };
        writeItem(STORAGE_KEYS.SPENDING_RULES, rules);
      }
    }

    const family = this.getFamilyById(req.familyId);
    return { success: true, user: user || undefined, family: family || undefined };
  },

  rejectMembershipRequest(requestId: string, reason?: string): { success: boolean; error?: string } {
    const allReqs = this.getMembershipRequests();
    const req = allReqs.find((r) => r.id === requestId);
    if (!req) {
      return { success: false, error: 'Membership request not found.' };
    }

    req.status = 'REJECTED';
    req.rejectionReason = reason || 'Declined by Administrator';
    req.resolvedAt = new Date().toISOString();
    writeItem(STORAGE_KEYS.MEMBERSHIP_REQUESTS, allReqs);

    const user = this.getUserById(req.userId);
    if (user) {
      user.membershipStatus = 'REJECTED';
      this.saveUser(user);
    }

    return { success: true };
  },

  // ----------------------------------------------------
  // RETURNING USERS LOGIN VIA MOBILE
  // ----------------------------------------------------
  loginMobileUser(
    countryCode: string,
    mobile: string
  ): {
    success: boolean;
    user?: User;
    error?: string;
  } {
    const cleanMobile = mobile.replace(/\D/g, '');
    const cleanCode = countryCode.trim() || '+91';

    const user = this.getUserByMobile(cleanCode, cleanMobile);
    if (!user) {
      return {
        success: false,
        error: `No registered account found for ${cleanCode} ${cleanMobile}. Please click Register to create a new account.`,
      };
    }

    this.setActiveUserId(user.id);
    return { success: true, user };
  },

  // ----------------------------------------------------
  // WALLETS, RULES, TRANSACTIONS, MONEY REQUESTS
  // ----------------------------------------------------
  getWallets(): Record<string, Wallet> {
    return readItem<Record<string, Wallet>>(STORAGE_KEYS.WALLETS, {});
  },

  saveWallets(wallets: Record<string, Wallet>): void {
    writeItem(STORAGE_KEYS.WALLETS, wallets);
  },

  getSpendingRules(): Record<string, SpendingRule> {
    return readItem<Record<string, SpendingRule>>(STORAGE_KEYS.SPENDING_RULES, {});
  },

  saveSpendingRules(rules: Record<string, SpendingRule>): void {
    writeItem(STORAGE_KEYS.SPENDING_RULES, rules);
  },

  getTransactions(familyId?: string): Transaction[] {
    const all = readItem<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, []);
    if (!familyId) return all;
    return all.filter((t) => t.familyId === familyId);
  },

  saveTransactions(transactions: Transaction[]): void {
    writeItem(STORAGE_KEYS.TRANSACTIONS, transactions);
  },

  getMoneyRequests(familyId?: string): MoneyRequest[] {
    const all = readItem<MoneyRequest[]>(STORAGE_KEYS.MONEY_REQUESTS, []);
    if (!familyId) return all;
    return all.filter((r) => r.familyId === familyId);
  },

  saveMoneyRequests(requests: MoneyRequest[]): void {
    writeItem(STORAGE_KEYS.MONEY_REQUESTS, requests);
  },

  // ----------------------------------------------------
  // ACCOUNT LIFECYCLE: LEAVE FAMILY & DELETE ACCOUNT
  // ----------------------------------------------------
  leaveFamily(userId: string): { success: boolean; error?: string } {
    const user = this.getUserById(userId);
    if (!user) return { success: false, error: 'User not found.' };

    if (user.role === 'owner') {
      return {
        success: false,
        error: 'Administrator cannot leave their own family. You may delete the family account from settings.',
      };
    }

    // Remove any membership requests
    const allReqs = this.getMembershipRequests();
    const updatedReqs = allReqs.filter((r) => r.userId !== userId);
    writeItem(STORAGE_KEYS.MEMBERSHIP_REQUESTS, updatedReqs);

    // Remove family association while keeping personal account balance and personal transactions
    user.familyId = '';
    delete user.membershipStatus;
    user.relationship = 'Independent User';
    user.onboardingStep = 'family_choice';
    this.saveUser(user);

    return { success: true };
  },

  deleteUserAccount(userId: string): { success: boolean; error?: string } {
    const user = this.getUserById(userId);
    if (!user) return { success: false, error: 'User not found.' };

    const isOwner = user.role === 'owner';
    const familyId = user.familyId;

    // 1. Remove user from registered users
    const allUsers = this.getRegisteredUsers().filter((u) => u.id !== userId);
    writeItem(STORAGE_KEYS.USERS, allUsers);

    // 2. Remove user personal wallet
    const wallets = this.getWallets();
    delete wallets[userId];
    if (isOwner && familyId) {
      delete wallets[familyId];
    }
    writeItem(STORAGE_KEYS.WALLETS, wallets);

    // 3. Remove user spending rule
    const rules = this.getSpendingRules();
    delete rules[userId];
    writeItem(STORAGE_KEYS.SPENDING_RULES, rules);

    // 4. Remove membership requests
    const reqs = this.getMembershipRequests().filter((r) => r.userId !== userId);
    writeItem(STORAGE_KEYS.MEMBERSHIP_REQUESTS, reqs);

    // 5. If Administrator deletes their account: dissolve family safely
    if (isOwner && familyId) {
      const families = this.getCustomFamilies().filter((f: Family) => f.id !== familyId);
      writeItem(STORAGE_KEYS.FAMILIES, families);

      // Transition remaining members to independent status
      const updatedRemaining = allUsers.map((u) => {
        if (u.familyId === familyId) {
          return {
            ...u,
            familyId: '',
            membershipStatus: undefined,
            relationship: 'Independent User',
            onboardingStep: 'family_choice' as OnboardingStep,
          };
        }
        return u;
      });
      writeItem(STORAGE_KEYS.USERS, updatedRemaining);
    }

    // 6. Clear active user session if it was this user
    if (this.getActiveUserId() === userId) {
      this.setActiveUserId(null);
    }

    return { success: true };
  },

  // ----------------------------------------------------
  // DATA RESET: CLEAR ALL LOCAL TEST ARTIFACTS
  // ----------------------------------------------------
  clearAllLocalTestData(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.USERS);
      localStorage.removeItem(STORAGE_KEYS.FAMILIES);
      localStorage.removeItem(STORAGE_KEYS.MEMBERSHIP_REQUESTS);
      localStorage.removeItem(STORAGE_KEYS.WALLETS);
      localStorage.removeItem(STORAGE_KEYS.SPENDING_RULES);
      localStorage.removeItem(STORAGE_KEYS.TRANSACTIONS);
      localStorage.removeItem(STORAGE_KEYS.MONEY_REQUESTS);
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_USER_ID);
      sessionStorage.clear();
    } catch (e) {
      console.error('Failed to clear local test data', e);
    }
  },
};
