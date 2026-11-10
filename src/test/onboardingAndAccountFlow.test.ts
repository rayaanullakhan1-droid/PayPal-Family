import { describe, it, expect, beforeEach } from 'vitest';
import { onboardingStorage, maskAccountNumber, generateJoiningCode } from '../services/onboardingStorage';
import { INITIAL_OWNER, INITIAL_MEMBERS, INITIAL_OWNER_WALLET, INITIAL_FAMILY } from '../context/AppContext';

describe('PayPal Family – Complete Onboarding, Registration, Family Creation & Approval Suite', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // --------------------------------------------------------------------------
  // TEST 1: Utility helpers (Account Masking & Joining Code Generation)
  // --------------------------------------------------------------------------
  it('1. Utility: masks account numbers to display only last 4 digits and generates unique joining codes', () => {
    const masked1 = maskAccountNumber('123456789012');
    expect(masked1).toBe('•••• •••• 9012');

    const masked2 = maskAccountNumber('9876543210987654');
    expect(masked2).toBe('•••• •••• 7654');

    const code1 = generateJoiningCode();
    const code2 = generateJoiningCode();
    expect(code1).toMatch(/^JOIN-[A-Z0-9]{5}$/);
    expect(code2).toMatch(/^JOIN-[A-Z0-9]{5}$/);
    expect(code1).not.toBe(code2);
  });

  // --------------------------------------------------------------------------
  // TEST 2: Step 1 - Mobile Registration with unlimited user support
  // --------------------------------------------------------------------------
  it('2. Step 1: registers new users with full name and mobile number, setting step to bank linking', () => {
    const user1 = onboardingStorage.registerMobileUser('David Miller', '+91', '9811122233');
    expect(user1).toBeDefined();
    expect(user1.id).toMatch(/^usr_reg_/);
    expect(user1.name).toBe('David Miller');
    expect(user1.mobile).toBe('9811122233');
    expect(user1.countryCode).toBe('+91');
    expect(user1.onboardingStep).toBe('bank');
    expect(user1.isCustomUser).toBe(true);

    // Active user is set in localStorage
    expect(onboardingStorage.getActiveUserId()).toBe(user1.id);

    // Registering with the same mobile returns existing account for continuity
    const user1Resume = onboardingStorage.registerMobileUser('David Miller', '+91', '9811122233');
    expect(user1Resume.id).toBe(user1.id);
  });

  // --------------------------------------------------------------------------
  // TEST 3: Step 2 - Simulated Bank Account Linking with number masking
  // --------------------------------------------------------------------------
  it('3. Step 2: links simulated bank account and securely masks account number', () => {
    const user = onboardingStorage.registerMobileUser('David Miller', '+91', '9811122233');

    const updatedUser = onboardingStorage.linkBankAccount(user.id, {
      accountHolderName: 'David Miller',
      bankName: 'HDFC Bank',
      accountNumber: '50100234567890',
      ifscCode: 'HDFC0001234',
    });

    expect(updatedUser.bankAccount).toBeDefined();
    expect(updatedUser.bankAccount?.bankName).toBe('HDFC Bank');
    expect(updatedUser.bankAccount?.accountNumber).toBe('•••• •••• 7890');
    expect(updatedUser.bankAccount?.ifscCode).toBe('HDFC0001234');
    expect(updatedUser.onboardingStep).toBe('family_choice');

    // Confirm persisted in localStorage
    const reloaded = onboardingStorage.getUserById(user.id);
    expect(reloaded?.bankAccount?.accountNumber).toBe('•••• •••• 7890');
  });

  // --------------------------------------------------------------------------
  // TEST 4: Step 3 & 4A - Create Family & Become Family Administrator
  // --------------------------------------------------------------------------
  it('4. Step 4A: creates family group, assigns Administrator role, sets opening balance, and generates joining code', () => {
    const adminUser = onboardingStorage.registerMobileUser('David Miller', '+91', '9811122233');
    onboardingStorage.linkBankAccount(adminUser.id, {
      accountHolderName: 'David Miller',
      bankName: 'HDFC Bank',
      accountNumber: '50100234567890',
      ifscCode: 'HDFC0001234',
    });

    const result = onboardingStorage.createCustomFamily(adminUser.id, 'The Miller Household', 20000);

    expect(result.family).toBeDefined();
    expect(result.family.name).toBe('The Miller Household');
    expect(result.family.ownerId).toBe(adminUser.id);
    expect(result.family.initialBalancePaise).toBe(2000000); // ₹20,000 in paise
    expect(result.joiningCode).toMatch(/^JOIN-[A-Z0-9]{5}$/);

    // Verify Admin User updated profile
    expect(result.user.role).toBe('owner');
    expect(result.user.relationship).toBe('Family Administrator');
    expect(result.user.onboardingStep).toBe('completed');
    expect(result.user.membershipStatus).toBe('ACTIVE');

    // Verify Central Pool / Admin Wallet initialized
    const wallets = onboardingStorage.getWallets();
    expect(wallets[result.family.id]).toBeDefined();
    expect(wallets[result.family.id].balancePaise).toBe(2000000);
    expect(wallets[adminUser.id].balancePaise).toBe(2000000);

    // Verify initial funding transaction recorded
    const transactions = onboardingStorage.getTransactions(result.family.id);
    expect(transactions.length).toBe(1);
    expect(transactions[0].type).toBe('ADD_MONEY');
    expect(transactions[0].amountPaise).toBe(2000000);
  });

  it('4b. Step 4A (Correction): creates family with ₹0 initial balance using Administrator linked bank account as funding source without artificial deposit', () => {
    const adminUser = onboardingStorage.registerMobileUser('Sarah Connor', '+91', '9811199988');
    onboardingStorage.linkBankAccount(adminUser.id, {
      accountHolderName: 'Sarah Connor',
      bankName: 'HDFC Bank',
      accountNumber: '50100482910482',
      ifscCode: 'HDFC0001234',
    });

    // Call without initial balance (defaults to 0)
    const result = onboardingStorage.createCustomFamily(adminUser.id, 'The Connor Family');

    expect(result.family).toBeDefined();
    expect(result.family.name).toBe('The Connor Family');
    expect(result.family.ownerId).toBe(adminUser.id);
    expect(result.family.initialBalancePaise).toBe(0);
    expect(result.family.bankAccount?.bankName).toBe('HDFC Bank');
    expect(result.family.fundingSource).toContain('HDFC Bank');
    expect(result.joiningCode).toMatch(/^JOIN-[A-Z0-9]{5}$/);

    // Verify Admin User updated profile
    expect(result.user.role).toBe('owner');
    expect(result.user.relationship).toBe('Family Administrator');
    expect(result.user.onboardingStep).toBe('completed');
    expect(result.user.membershipStatus).toBe('ACTIVE');

    // Central Pool Wallet initialized with ₹0
    const wallets = onboardingStorage.getWallets();
    expect(wallets[result.family.id]).toBeDefined();
    expect(wallets[result.family.id].balancePaise).toBe(0);

    // No artificial deposit transaction recorded
    const transactions = onboardingStorage.getTransactions(result.family.id);
    expect(transactions.length).toBe(0);
  });

  // --------------------------------------------------------------------------
  // TEST 5: Step 4B - Member Joining Code Verification & Request Submission
  // --------------------------------------------------------------------------
  it('5. Step 4B: verifies family joining code, rejects invalid codes, and submits pending membership request', () => {
    // 1. Setup Admin & Family
    const adminUser = onboardingStorage.registerMobileUser('David Miller', '+91', '9811122233');
    onboardingStorage.linkBankAccount(adminUser.id, {
      accountHolderName: 'David Miller',
      bankName: 'HDFC Bank',
      accountNumber: '50100234567890',
      ifscCode: 'HDFC0001234',
    });
    const { family, joiningCode } = onboardingStorage.createCustomFamily(adminUser.id, 'The Miller Household', 15000);

    // 2. Register Second User (Member Applicant)
    const memberUser = onboardingStorage.registerMobileUser('Elena Miller', '+91', '9822233344');
    onboardingStorage.linkBankAccount(memberUser.id, {
      accountHolderName: 'Elena Miller',
      bankName: 'ICICI Bank',
      accountNumber: '60200987654321',
      ifscCode: 'ICIC0005678',
    });

    // 3. Test Invalid Code
    const invalidVerification = onboardingStorage.verifyJoiningCode('INVALID-999');
    expect(invalidVerification.valid).toBe(false);
    expect(invalidVerification.error).toBeDefined();

    // 4. Test Valid Code
    const validVerification = onboardingStorage.verifyJoiningCode(joiningCode);
    expect(validVerification.valid).toBe(true);
    expect(validVerification.family?.id).toBe(family.id);
    expect(validVerification.adminName).toBe('David Miller');

    // 5. Submit Membership Request
    const requestResult = onboardingStorage.submitMembershipRequest(memberUser.id, joiningCode);
    expect(requestResult.success).toBe(true);
    expect(requestResult.request).toBeDefined();
    expect(requestResult.request?.status).toBe('PENDING');
    expect(requestResult.request?.userName).toBe('Elena Miller');
    expect(requestResult.request?.familyId).toBe(family.id);

    // 6. Member status is PENDING and cannot access member dashboard yet
    const memberStatus = onboardingStorage.checkUserMembershipStatus(memberUser.id);
    expect(memberStatus.status).toBe('PENDING');

    const updatedMemberUser = onboardingStorage.getUserById(memberUser.id);
    expect(updatedMemberUser?.onboardingStep).toBe('pending_approval');
    expect(updatedMemberUser?.membershipStatus).toBe('PENDING');

    // 7. Administrator sees request in pending queue
    const adminPendingRequests = onboardingStorage.getMembershipRequests(family.id);
    expect(adminPendingRequests.length).toBe(1);
    expect(adminPendingRequests[0].userId).toBe(memberUser.id);
    expect(adminPendingRequests[0].status).toBe('PENDING');
  });

  // --------------------------------------------------------------------------
  // TEST 6: Administrator Approval Workflow
  // --------------------------------------------------------------------------
  it('6. Approval Workflow: Administrator approves member request, activating account with ₹0 personal wallet & default limits', () => {
    // Admin creates family
    const admin = onboardingStorage.registerMobileUser('David Miller', '+91', '9811122233');
    onboardingStorage.linkBankAccount(admin.id, {
      accountHolderName: 'David Miller',
      bankName: 'HDFC Bank',
      accountNumber: '50100234567890',
      ifscCode: 'HDFC0001234',
    });
    const { family, joiningCode } = onboardingStorage.createCustomFamily(admin.id, 'The Miller Household', 20000);

    // Member submits request
    const member = onboardingStorage.registerMobileUser('Elena Miller', '+91', '9822233344');
    onboardingStorage.linkBankAccount(member.id, {
      accountHolderName: 'Elena Miller',
      bankName: 'ICICI Bank',
      accountNumber: '60200987654321',
      ifscCode: 'ICIC0005678',
    });
    const requestResult = onboardingStorage.submitMembershipRequest(member.id, joiningCode);
    const requestId = requestResult.request!.id;

    // Administrator approves the request
    const approval = onboardingStorage.approveMembershipRequest(requestId);
    expect(approval.success).toBe(true);

    // Member is now ACTIVE and onboarding is completed
    const approvedMember = onboardingStorage.getUserById(member.id);
    expect(approvedMember?.role).toBe('member');
    expect(approvedMember?.relationship).toBe('Family Member');
    expect(approvedMember?.membershipStatus).toBe('ACTIVE');
    expect(approvedMember?.onboardingStep).toBe('completed');
    expect(approvedMember?.familyId).toBe(family.id);

    // Member personal account is initialized with 0 balance
    const wallets = onboardingStorage.getWallets();
    expect(wallets[member.id]).toBeDefined();
    expect(wallets[member.id].balancePaise).toBe(0);

    // Member spending limits are configured
    const rules = onboardingStorage.getSpendingRules();
    expect(rules[member.id]).toBeDefined();
    expect(rules[member.id].singleTransactionLimitPaise).toBe(200000); // ₹2,000
    expect(rules[member.id].dailyLimitPaise).toBe(500000);             // ₹5,000
    expect(rules[member.id].monthlyLimitPaise).toBe(1000000);          // ₹10,000

    // Membership request status is APPROVED
    const memberStatus = onboardingStorage.checkUserMembershipStatus(member.id);
    expect(memberStatus.status).toBe('ACTIVE');
  });

  // --------------------------------------------------------------------------
  // TEST 7: Multi-User & Multi-Family Isolation (4 independent registered accounts)
  // --------------------------------------------------------------------------
  it('7. Multi-Family Isolation: registers 4 independent accounts across 2 families without data mixing', () => {
    // Family A: Miller Household
    const user1Admin = onboardingStorage.registerMobileUser('David Miller', '+91', '9811122233');
    onboardingStorage.linkBankAccount(user1Admin.id, {
      accountHolderName: 'David Miller',
      bankName: 'HDFC Bank',
      accountNumber: '50100111111111',
      ifscCode: 'HDFC0001111',
    });
    const familyA = onboardingStorage.createCustomFamily(user1Admin.id, 'Miller Household', 10000);

    const user2Member = onboardingStorage.registerMobileUser('Elena Miller', '+91', '9822233344');
    onboardingStorage.linkBankAccount(user2Member.id, {
      accountHolderName: 'Elena Miller',
      bankName: 'HDFC Bank',
      accountNumber: '50100222222222',
      ifscCode: 'HDFC0002222',
    });
    const req2 = onboardingStorage.submitMembershipRequest(user2Member.id, familyA.joiningCode);
    onboardingStorage.approveMembershipRequest(req2.request!.id);

    // Family B: Chen Household
    const user3Admin = onboardingStorage.registerMobileUser('Lucas Chen', '+91', '9833344455');
    onboardingStorage.linkBankAccount(user3Admin.id, {
      accountHolderName: 'Lucas Chen',
      bankName: 'State Bank of India',
      accountNumber: '30100333333333',
      ifscCode: 'SBIN0003333',
    });
    const familyB = onboardingStorage.createCustomFamily(user3Admin.id, 'Chen Household', 30000);

    const user4Member = onboardingStorage.registerMobileUser('Maya Chen', '+91', '9844455566');
    onboardingStorage.linkBankAccount(user4Member.id, {
      accountHolderName: 'Maya Chen',
      bankName: 'Axis Bank',
      accountNumber: '90100444444444',
      ifscCode: 'UTIB0004444',
    });
    const req4 = onboardingStorage.submitMembershipRequest(user4Member.id, familyB.joiningCode);
    onboardingStorage.approveMembershipRequest(req4.request!.id);

    // Confirm 4 distinct registered users
    const allRegistered = onboardingStorage.getRegisteredUsers();
    expect(allRegistered.length).toBe(4);

    // Confirm 2 distinct families with unique codes
    expect(familyA.family.id).not.toBe(familyB.family.id);
    expect(familyA.joiningCode).not.toBe(familyB.joiningCode);

    // Confirm family wallet balances are isolated
    const wallets = onboardingStorage.getWallets();
    expect(wallets[familyA.family.id].balancePaise).toBe(1000000); // ₹10,000
    expect(wallets[familyB.family.id].balancePaise).toBe(3000000); // ₹30,000

    // Confirm family transactions are isolated
    const txnsA = onboardingStorage.getTransactions(familyA.family.id);
    const txnsB = onboardingStorage.getTransactions(familyB.family.id);
    expect(txnsA.length).toBe(1);
    expect(txnsB.length).toBe(1);
    expect(txnsA[0].familyId).toBe(familyA.family.id);
    expect(txnsB[0].familyId).toBe(familyB.family.id);
  });

  // --------------------------------------------------------------------------
  // TEST 8: Returning Users Login via Mobile Number & Onboarding Resumption
  // --------------------------------------------------------------------------
  it('8. Returning User Login: logs in with mobile number, rejects unknown numbers, and resumes onboarding from saved step', () => {
    // 1. Register complete user
    const userComplete = onboardingStorage.registerMobileUser('David Miller', '+91', '9811122233');
    onboardingStorage.linkBankAccount(userComplete.id, {
      accountHolderName: 'David Miller',
      bankName: 'HDFC Bank',
      accountNumber: '50100111111111',
      ifscCode: 'HDFC0001111',
    });
    onboardingStorage.createCustomFamily(userComplete.id, 'Miller Household', 10000);

    // 2. Register incomplete user (stopped at bank linking)
    const userIncomplete = onboardingStorage.registerMobileUser('Sofia Patel', '+91', '9899900011');
    expect(userIncomplete.onboardingStep).toBe('bank');

    // 3. Test Unknown Mobile Login
    const unknownLogin = onboardingStorage.loginMobileUser('+91', '9111111111');
    expect(unknownLogin.success).toBe(false);
    expect(unknownLogin.error).toContain('No registered account found');

    // 4. Test Completed User Login
    const completeLogin = onboardingStorage.loginMobileUser('+91', '9811122233');
    expect(completeLogin.success).toBe(true);
    expect(completeLogin.user?.id).toBe(userComplete.id);
    expect(completeLogin.user?.onboardingStep).toBe('completed');
    expect(onboardingStorage.getActiveUserId()).toBe(userComplete.id);

    // 5. Test Incomplete User Login (Resumption)
    const incompleteLogin = onboardingStorage.loginMobileUser('+91', '9899900011');
    expect(incompleteLogin.success).toBe(true);
    expect(incompleteLogin.user?.id).toBe(userIncomplete.id);
    expect(incompleteLogin.user?.onboardingStep).toBe('bank');
    expect(onboardingStorage.getActiveUserId()).toBe(userIncomplete.id);
  });

  // --------------------------------------------------------------------------
  // TEST 9: Preservation of Original 3 Demo Accounts (Rajesh, Priya, Aarav)
  // --------------------------------------------------------------------------
  it('9. Demo Accounts Preservation: original demo accounts (Rajesh, Priya, Aarav) remain intact with their wallets and demo joining code', () => {
    // Demo accounts exist in initial seed data
    expect(INITIAL_OWNER.id).toBe('usr_owner_rajesh');
    expect(INITIAL_OWNER.name).toBe('Rajesh Sharma');
    expect(INITIAL_OWNER.role).toBe('owner');

    const priya = INITIAL_MEMBERS.find((m) => m.id === 'usr_member_priya');
    expect(priya?.name).toBe('Priya Sharma');
    expect(priya?.role).toBe('member');

    const aarav = INITIAL_MEMBERS.find((m) => m.id === 'usr_member_aarav');
    expect(aarav?.name).toBe('Aarav Sharma');
    expect(aarav?.role).toBe('member');

    expect(INITIAL_FAMILY.name).toBe('The Sharma Family');
    expect(INITIAL_OWNER_WALLET.balancePaise).toBe(1000000); // ₹10,000

    // Demo joining code SHARMA-2026 resolves accurately
    const demoVerification = onboardingStorage.verifyJoiningCode('SHARMA-2026');
    expect(demoVerification.valid).toBe(true);
    expect(demoVerification.family?.name).toBe('The Sharma Family');
    expect(demoVerification.adminName).toBe('Rajesh Sharma');
  });
});
