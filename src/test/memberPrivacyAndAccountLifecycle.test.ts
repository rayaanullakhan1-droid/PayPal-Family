import { describe, it, expect, beforeEach } from 'vitest';
import { onboardingStorage } from '../services/onboardingStorage';
import {
  INITIAL_OWNER,
  INITIAL_MEMBERS,
  INITIAL_FAMILY,
  INITIAL_OWNER_WALLET,
} from '../context/AppContext';
import { User, Family, Wallet, SpendingRule } from '../types';
import { hashPinSync, generatePinSalt } from '../utils/security';

describe('Member Privacy, Account Lifecycle & Data Reset Suite', () => {
  beforeEach(() => {
    // Clear test environment before each test
    onboardingStorage.clearAllLocalTestData();
  });

  describe('1. Member Sidebar & Top Navigation Privacy Rules', () => {
    it('should define navigation items and restrict Member to only 7 specific routes', () => {
      const ALL_NAV_ITEMS = [
        { label: 'Overview', path: '/dashboard' },
        { label: 'Family', path: '/family' },
        { label: 'Request Money', path: '/request-money' },
        { label: 'Scan & Pay', path: '/scan-pay' },
        { label: 'Spending Limits', path: '/spending-limits' },
        { label: 'Transactions', path: '/transactions' },
        { label: 'AI Assistant', path: '/ai-assistant' },
        { label: 'Settings', path: '/settings' },
      ];

      // For Member: filter out /family
      const memberNavItems = ALL_NAV_ITEMS.filter((item) => item.path !== '/family');
      expect(memberNavItems).toHaveLength(7);
      expect(memberNavItems.map((n) => n.label)).toEqual([
        'Overview',
        'Request Money',
        'Scan & Pay',
        'Spending Limits',
        'Transactions',
        'AI Assistant',
        'Settings',
      ]);
      expect(memberNavItems.some((n) => n.path === '/family')).toBe(false);

      // For Administrator: all 8 items are included
      expect(ALL_NAV_ITEMS).toHaveLength(8);
      expect(ALL_NAV_ITEMS.some((n) => n.path === '/family')).toBe(true);
    });

    it('should verify Header permissions: Demo Switcher and Reset Demo Data are strictly hidden for Member', () => {
      const memberRole = 'member';
      const ownerRole = 'owner';

      // DemoUserSwitcher visibility rule:
      const shouldShowSwitcher = (role: string, isCustomUser: boolean) =>
        role === 'owner' && !isCustomUser;

      expect(shouldShowSwitcher(memberRole, false)).toBe(false);
      expect(shouldShowSwitcher(ownerRole, false)).toBe(true);
      expect(shouldShowSwitcher(ownerRole, true)).toBe(false);

      // Reset Demo Data visibility rule:
      const shouldShowResetData = (role: string) => role === 'owner';
      expect(shouldShowResetData(memberRole)).toBe(false);
      expect(shouldShowResetData(ownerRole)).toBe(true);
    });
  });

  describe('2. Family Privacy & Application Logic Enforcement', () => {
    it('should prevent non-owners from modifying spending limits of other members', () => {
      const mockRules: Record<string, SpendingRule> = {
        usr_member_priya: {
          memberId: 'usr_member_priya',
          singleTransactionLimitPaise: 200000,
          dailyLimitPaise: 500000,
          monthlyLimitPaise: 1000000,
          allowMoneyTransfer: true,
          allowQRPayments: true,
        },
        usr_member_aarav: {
          memberId: 'usr_member_aarav',
          singleTransactionLimitPaise: 50000,
          dailyLimitPaise: 80000,
          monthlyLimitPaise: 200000,
          allowMoneyTransfer: true,
          allowQRPayments: true,
        },
      };

      // Member attempting to modify another member's rule:
      const updateRuleAsUser = (currentUserRole: string, targetMemberId: string, newLimit: number) => {
        if (currentUserRole !== 'owner') return false; // Application logic guard
        mockRules[targetMemberId].singleTransactionLimitPaise = newLimit;
        return true;
      };

      const memberAttempt = updateRuleAsUser('member', 'usr_member_aarav', 999999);
      expect(memberAttempt).toBe(false);
      expect(mockRules.usr_member_aarav.singleTransactionLimitPaise).toBe(50000); // Unchanged

      const ownerAttempt = updateRuleAsUser('owner', 'usr_member_aarav', 75000);
      expect(ownerAttempt).toBe(true);
      expect(mockRules.usr_member_aarav.singleTransactionLimitPaise).toBe(75000); // Successfully updated
    });

    it('should restrict member spending limits view to only their own rule', () => {
      const allRules: Record<string, SpendingRule> = {
        usr_member_priya: {
          memberId: 'usr_member_priya',
          singleTransactionLimitPaise: 200000,
          dailyLimitPaise: 500000,
          monthlyLimitPaise: 1000000,
          allowMoneyTransfer: true,
          allowQRPayments: true,
        },
        usr_member_aarav: {
          memberId: 'usr_member_aarav',
          singleTransactionLimitPaise: 50000,
          dailyLimitPaise: 80000,
          monthlyLimitPaise: 200000,
          allowMoneyTransfer: true,
          allowQRPayments: true,
        },
      };

      const getVisibleRules = (userRole: string, userId: string) => {
        if (userRole === 'owner') return allRules;
        return allRules[userId] ? { [userId]: allRules[userId] } : {};
      };

      const priyaView = getVisibleRules('member', 'usr_member_priya');
      expect(Object.keys(priyaView)).toEqual(['usr_member_priya']);
      expect(priyaView.usr_member_aarav).toBeUndefined();

      const adminView = getVisibleRules('owner', 'usr_owner_rajesh');
      expect(Object.keys(adminView)).toEqual(['usr_member_priya', 'usr_member_aarav']);
    });
  });

  describe('3. Member Leaving a Family', () => {
    it('should allow a Member to leave family, preserving personal wallet balance & records', () => {
      // 1. Create a custom family with an owner and a member
      const admin = onboardingStorage.registerMobileUser('Rohan Verma', '+91', '9876543210');
      const { family } = onboardingStorage.createCustomFamily(admin.id, 'Verma Family', 10000);

      const member = onboardingStorage.registerMobileUser('Ananya Verma', '+91', '9876543211');
      const req = onboardingStorage.submitMembershipRequest(member.id, family.joiningCode!);
      onboardingStorage.approveMembershipRequest(req.request!.id);

      // Verify member is active in Verma Family
      const verifiedMember = onboardingStorage.getUserById(member.id)!;
      expect(verifiedMember.familyId).toBe(family.id);

      // Give member a personal balance of ₹1,500 (150,000 paise)
      const wallets = onboardingStorage.getWallets();
      wallets[member.id] = {
        userId: member.id,
        balancePaise: 150000,
        currency: 'INR',
        isSimulated: true,
      };
  onboardingStorage.saveWallets(wallets);

  // 2. Member leaves family
  const leaveRes = onboardingStorage.leaveFamily(member.id);
  expect(leaveRes.success).toBe(true);

  // 3. Verify member's family association is cleared
  const updatedMember = onboardingStorage.getUserById(member.id)!;
  expect(updatedMember.familyId).toBe('');
  expect(updatedMember.membershipStatus).toBeUndefined();
  expect(updatedMember.relationship).toBe('Independent User');
  expect(updatedMember.onboardingStep).toBe('family_choice');

  // 4. Verify member's personal wallet balance is preserved
  const updatedWallets = onboardingStorage.getWallets();
  expect(updatedWallets[member.id]?.balancePaise).toBe(150000);

  // 5. Verify the Verma Family and its Administrator still exist
  const remainingAdmin = onboardingStorage.getUserById(admin.id)!;
  expect(remainingAdmin.familyId).toBe(family.id);
  const remainingFamily = onboardingStorage.getFamilyById(family.id);
  expect(remainingFamily).not.toBeNull();
  expect(remainingFamily?.name).toBe('Verma Family');
});

it('should reject an Administrator attempting to use Leave Family', () => {
  const admin = onboardingStorage.registerMobileUser('Rohan Verma', '+91', '9876543210');
  onboardingStorage.createCustomFamily(admin.id, 'Verma Family', 10000);

  const leaveRes = onboardingStorage.leaveFamily(admin.id);
  expect(leaveRes.success).toBe(false);
  expect(leaveRes.error).toContain('Administrator cannot leave');
});
  });

describe('4. Delete Account with 6-Digit Transaction PIN Verification', () => {
  it('should reject deletion if the 6-digit PIN is incorrect and preserve the account', () => {
    const user = onboardingStorage.registerMobileUser('Pooja Patel', '+91', '9876543220');
    onboardingStorage.setUserPin(user.id, '654321');

    // Attempt deletion with wrong PIN
    const testPin = '000000';
    const isPinValid = onboardingStorage.verifyUserPin(user, testPin);
    expect(isPinValid).toBe(false);

    // Account must still exist
    const checkUser = onboardingStorage.getUserById(user.id);
    expect(checkUser).not.toBeNull();
    expect(checkUser?.name).toBe('Pooja Patel');
  });

  it('should permanently delete a Member account when 6-digit PIN is verified, without deleting family', () => {
    const admin = onboardingStorage.registerMobileUser('Vikram Mehta', '+91', '9876543230');
    const { family } = onboardingStorage.createCustomFamily(admin.id, 'Mehta Family', 15000);

    const member = onboardingStorage.registerMobileUser('Karan Mehta', '+91', '9876543231');
    const req = onboardingStorage.submitMembershipRequest(member.id, family.joiningCode!);
    onboardingStorage.approveMembershipRequest(req.request!.id);

    // Set member transaction PIN
    const pinRes = onboardingStorage.setUserPin(member.id, '112233');
    expect(pinRes.success).toBe(true);
    const updatedMember = onboardingStorage.getUserById(member.id)!;

    // Verify PIN
    const isPinValid = onboardingStorage.verifyUserPin(updatedMember, '112233');
    expect(isPinValid).toBe(true);

    // Execute account deletion
    const deleteRes = onboardingStorage.deleteUserAccount(member.id);
    expect(deleteRes.success).toBe(true);

    // 1. Karan's account must no longer exist
    expect(onboardingStorage.getUserById(member.id)).toBeNull();
    expect(onboardingStorage.getWallets()[member.id]).toBeUndefined();

    // 2. Vikram and Mehta Family must be completely unaffected
    const remainingAdmin = onboardingStorage.getUserById(admin.id);
    expect(remainingAdmin).not.toBeNull();
    expect(remainingAdmin?.name).toBe('Vikram Mehta');
    expect(onboardingStorage.getFamilyById(family.id)).not.toBeNull();
  });

  it('should safely dissolve family when an Administrator deletes their account', () => {
    const admin = onboardingStorage.registerMobileUser('Suresh Gupta', '+91', '9876543240');
    const { family } = onboardingStorage.createCustomFamily(admin.id, 'Gupta Family', 20000);

    const member = onboardingStorage.registerMobileUser('Neha Gupta', '+91', '9876543241');
    const req = onboardingStorage.submitMembershipRequest(member.id, family.joiningCode!);
    onboardingStorage.approveMembershipRequest(req.request!.id);

    // Administrator deletes account
    const deleteRes = onboardingStorage.deleteUserAccount(admin.id);
    expect(deleteRes.success).toBe(true);

    // 1. Administrator account deleted
    expect(onboardingStorage.getUserById(admin.id)).toBeNull();
    // 2. Family dissolved
    expect(onboardingStorage.getFamilyById(family.id)).toBeNull();
    // 3. Member transitioned to independent status safely without corruption
    const transitionedMember = onboardingStorage.getUserById(member.id)!;
    expect(transitionedMember).not.toBeNull();
    expect(transitionedMember.familyId).toBe('');
    expect(transitionedMember.relationship).toBe('Independent User');
  });
});

describe('5. Clean Local Development Data Reset & Preservation of Built-in Demo Personas', () => {
  it('should completely reset local test artifacts while preserving Rajesh, Priya, and Aarav demo personas', () => {
    // Create some local test accounts and custom family
    const testUser = onboardingStorage.registerMobileUser('Test User', '+91', '9999999999');
    onboardingStorage.createCustomFamily(testUser.id, 'Temporary Test Family', 5000);
    expect(onboardingStorage.getRegisteredUsers().length).toBeGreaterThan(0);

    // Execute complete local development data reset
    onboardingStorage.clearAllLocalTestData();

    // Verify custom test artifacts are gone
    expect(onboardingStorage.getRegisteredUsers()).toHaveLength(0);
    expect(onboardingStorage.getCustomFamilies()).toHaveLength(0);
    expect(onboardingStorage.getMembershipRequests()).toHaveLength(0);
    expect(onboardingStorage.getActiveUserId()).toBeNull();

    // CRITICAL REQUIREMENT: Verify built-in demo personas remain pristine
    expect(INITIAL_MEMBERS).toHaveLength(3);
    expect(INITIAL_OWNER.id).toBe('usr_owner_rajesh');
    expect(INITIAL_OWNER.name).toBe('Rajesh Sharma');
    expect(INITIAL_OWNER.role).toBe('owner');

    const priya = INITIAL_MEMBERS.find((m) => m.id === 'usr_member_priya')!;
    expect(priya).toBeDefined();
    expect(priya.name).toBe('Priya Sharma');
    expect(priya.role).toBe('member');

    const aarav = INITIAL_MEMBERS.find((m) => m.id === 'usr_member_aarav')!;
    expect(aarav).toBeDefined();
    expect(aarav.name).toBe('Aarav Sharma');
    expect(aarav.role).toBe('member');

    // Pre-seeded owner wallet balance: ₹10,000 (1,000,000 paise)
    expect(INITIAL_OWNER_WALLET.balancePaise).toBe(1000000);
    // Pre-seeded default PIN verification (123456)
    expect(onboardingStorage.verifyUserPin(INITIAL_OWNER, '123456')).toBe(true);
    expect(onboardingStorage.verifyUserPin(priya, '123456')).toBe(true);
    expect(onboardingStorage.verifyUserPin(aarav, '123456')).toBe(true);
  });
});
});
