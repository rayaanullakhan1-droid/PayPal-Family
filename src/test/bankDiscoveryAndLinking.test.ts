import { describe, it, expect, beforeEach } from 'vitest';
import { bankDiscoveryService, DiscoveredBankAccount } from '../services/bankDiscoveryService';
import { onboardingStorage, maskAccountNumber } from '../services/onboardingStorage';
import { SUPPORTED_BANKS } from '../components/fintech/BankLogos';

describe('PayPal Family – Modern Bank Account Discovery & Linking Suite (PhonePe / GPay Style)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // --------------------------------------------------------------------------
  // TEST 1: Matching Single Account Discovery
  // --------------------------------------------------------------------------
  it('1. Matching Single Account: discovers primary savings account for all 6 major institutional banks', async () => {
    const testBanks = ['hdfc', 'sbi', 'icici', 'axis', 'kotak', 'pnb'];

    for (const bankId of testBanks) {
      const accounts = await bankDiscoveryService.fetchLinkedAccounts(bankId, '9811122233', 'Rajesh Sharma', 'single');

      expect(accounts.length).toBe(1);
      const acc = accounts[0];
      expect(acc.bankId).toBe(bankId);
      expect(acc.accountHolderName).toBe('Rajesh Sharma');
      expect(acc.accountType).toBe('Savings Account');
      expect(acc.maskedAccountNumber).toMatch(/^•••• •••• \d{4}$/);
      expect(acc.ifscCode).toBeDefined();
      expect(acc.branchName).toBeDefined();
      expect(acc.isPrimary).toBe(true);
    }
  }, 15000);

  // --------------------------------------------------------------------------
  // TEST 2: Multiple Accounts Discovery & Selection
  // --------------------------------------------------------------------------
  it('2. Multiple Accounts: returns multiple matching accounts (Savings and Salary) allowing user selection', async () => {
    const accounts = await bankDiscoveryService.fetchLinkedAccounts('hdfc', '9811122222', 'Priya Sharma', 'multiple');

    expect(accounts.length).toBe(2);

    // Account 1: Savings Account
    expect(accounts[0].accountType).toBe('Savings Account');
    expect(accounts[0].isPrimary).toBe(true);
    expect(accounts[0].maskedAccountNumber).toMatch(/^•••• •••• \d{4}$/);

    // Account 2: Salary Account
    expect(accounts[1].accountType).toBe('Salary Account');
    expect(accounts[1].isPrimary).toBe(false);
    expect(accounts[1].maskedAccountNumber).toMatch(/^•••• •••• \d{4}$/);
    expect(accounts[0].accountNumber).not.toBe(accounts[1].accountNumber);
  });

  // --------------------------------------------------------------------------
  // TEST 3: No Matching Accounts Found
  // --------------------------------------------------------------------------
  it('3. No Matching Accounts: returns empty list when mobile number is not registered with selected bank', async () => {
    // Test with number ending in 0000 or scenario empty
    const accountsA = await bankDiscoveryService.fetchLinkedAccounts('icici', '9800000000', 'Unknown User', 'empty');
    expect(accountsA.length).toBe(0);

    const accountsB = await bankDiscoveryService.fetchLinkedAccounts('axis', '0000000000', 'Unknown User', 'auto');
    expect(accountsB.length).toBe(0);
  });

  // --------------------------------------------------------------------------
  // TEST 4: Verification Success
  // --------------------------------------------------------------------------
  it('4. Verification Success: verifies account ownership via mobile binding token successfully', async () => {
    const accounts = await bankDiscoveryService.fetchLinkedAccounts('hdfc', '9811122233', 'Rajesh Sharma', 'single');
    expect(accounts.length).toBeGreaterThan(0);

    const verification = await bankDiscoveryService.verifyAccountOwnership(accounts[0], '9811122233', 'single');
    expect(verification.success).toBe(true);
    expect(verification.error).toBeUndefined();
  });

  // --------------------------------------------------------------------------
  // TEST 5: Verification Failure
  // --------------------------------------------------------------------------
  it('5. Verification Failure: handles signature mismatch or failure gracefully with clear institutional error', async () => {
    const accounts = await bankDiscoveryService.fetchLinkedAccounts('kotak', '9811199999', 'Rajesh Sharma', 'single');
    expect(accounts.length).toBeGreaterThan(0);

    const verification = await bankDiscoveryService.verifyAccountOwnership(accounts[0], '9811199999', 'fail');
    expect(verification.success).toBe(false);
    expect(verification.error).toBeDefined();
    expect(verification.error).toContain('verification failed');
  });

  // --------------------------------------------------------------------------
  // TEST 6: Complete Discovery to Onboarding Integration
  // --------------------------------------------------------------------------
  it('6. Full Integration: discovered account is linked to registered user session and advances onboarding', async () => {
    // 1. Mobile Registration
    const user = onboardingStorage.registerMobileUser('Amit Patel', '+91', '9812345678');
    expect(user.onboardingStep).toBe('bank');

    // 2. Discover Account
    const discovered = await bankDiscoveryService.fetchLinkedAccounts('pnb', user.mobile || '9812345678', user.name);
    expect(discovered.length).toBeGreaterThan(0);
    const chosenAcc = discovered[0];

    // 3. Link Account
    const updatedUser = onboardingStorage.linkBankAccount(user.id, {
      accountHolderName: chosenAcc.accountHolderName,
      bankName: chosenAcc.bankName,
      accountNumber: chosenAcc.accountNumber,
      ifscCode: chosenAcc.ifscCode,
    });

    expect(updatedUser.bankAccount).toBeDefined();
    expect(updatedUser.bankAccount?.bankName).toBe(chosenAcc.bankName);
    expect(updatedUser.bankAccount?.accountNumber).toBe(chosenAcc.maskedAccountNumber);
    expect(updatedUser.onboardingStep).toBe('family_choice');
  });
});

