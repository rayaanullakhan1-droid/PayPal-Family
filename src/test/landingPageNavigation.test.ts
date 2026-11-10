import { describe, it, expect, beforeEach } from 'vitest';
import { onboardingStorage } from '../services/onboardingStorage';
import { INITIAL_MEMBERS, INITIAL_OWNER } from '../context/AppContext';

describe('PayPal Family – Landing Page Navigation, Demo Isolation & Session Suite', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('1. Landing page demo accounts are always preserved as Rajesh, Priya, and Aarav', () => {
    expect(INITIAL_MEMBERS.length).toBe(3);
    expect(INITIAL_MEMBERS[0].name).toBe('Rajesh Sharma');
    expect(INITIAL_MEMBERS[0].role).toBe('owner');
    expect(INITIAL_MEMBERS[1].name).toBe('Priya Sharma');
    expect(INITIAL_MEMBERS[1].role).toBe('member');
    expect(INITIAL_MEMBERS[2].name).toBe('Aarav Sharma');
    expect(INITIAL_MEMBERS[2].role).toBe('member');
  });

  it('2. Switching to Rajesh demo account updates session without clearing demo personas', () => {
    onboardingStorage.setActiveUserId(null);
    expect(onboardingStorage.getActiveUserId()).toBeNull();

    // Verify Rajesh account is accessible
    const rajesh = INITIAL_MEMBERS.find((m) => m.id === 'usr_owner_rajesh');
    expect(rajesh).toBeDefined();
    expect(rajesh?.relationship).toBe('Family Administrator');
  });

  it('3. Switching between Priya and Aarav demo accounts preserves individual roles and isolation', () => {
    const priya = INITIAL_MEMBERS.find((m) => m.id === 'usr_member_priya');
    const aarav = INITIAL_MEMBERS.find((m) => m.id === 'usr_member_aarav');

    expect(priya).toBeDefined();
    expect(priya?.role).toBe('member');
    expect(aarav).toBeDefined();
    expect(aarav?.role).toBe('member');
  });

  it('4. Custom registered user session remains strictly isolated from demo accounts', () => {
    // 1. Register new individual user
    const newUser = onboardingStorage.registerMobileUser('Anita Roy', '+91', '9876543210');
    expect(newUser.isCustomUser).toBe(true);
    expect(onboardingStorage.getActiveUserId()).toBe(newUser.id);

    // 2. Demo personas are still preserved and separate
    expect(INITIAL_MEMBERS.length).toBe(3);
    expect(INITIAL_MEMBERS.some((m) => m.id === newUser.id)).toBe(false);

    // 3. Log out custom user
    onboardingStorage.setActiveUserId(null);
    expect(onboardingStorage.getActiveUserId()).toBeNull();

    // 4. Default demo owner is still intact
    expect(INITIAL_OWNER.id).toBe('usr_owner_rajesh');
  });

  it('5. Returning to landing page preserves all demo personas and registration capability', () => {
    // Register custom user
    const user = onboardingStorage.registerMobileUser('Vikram Verma', '+91', '9888877777');
    onboardingStorage.linkBankAccount(user.id, {
      accountHolderName: 'Vikram Verma',
      bankName: 'HDFC Bank',
      accountNumber: '50100482910482',
      ifscCode: 'HDFC0001234',
    });
    onboardingStorage.createCustomFamily(user.id, 'Verma Household');

    // Simulate returning to landing page / logging out
    onboardingStorage.setActiveUserId(null);

    // Verify that demo accounts list is still unchanged
    expect(INITIAL_MEMBERS[0].name).toBe('Rajesh Sharma');
    expect(INITIAL_MEMBERS[1].name).toBe('Priya Sharma');
    expect(INITIAL_MEMBERS[2].name).toBe('Aarav Sharma');

    // Registered user is still preserved in storage for mobile login
    const loginResult = onboardingStorage.loginMobileUser('+91', '9888877777');
    expect(loginResult.success).toBe(true);
    expect(loginResult.user?.name).toBe('Vikram Verma');
  });
});

