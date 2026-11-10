import { SUPPORTED_BANKS, BankInfo } from '../components/fintech/BankLogos';
import { maskAccountNumber } from './onboardingStorage';

export interface DiscoveredBankAccount {
  id: string;
  bankId: string;
  bankName: string;
  accountType: 'Savings Account' | 'Salary Account' | 'Current Account';
  accountNumber: string;
  maskedAccountNumber: string;
  accountHolderName: string;
  ifscCode: string;
  branchName: string;
  isPrimary?: boolean;
}

export type DiscoveryScenario = 'auto' | 'single' | 'multiple' | 'empty' | 'fail';

export const bankDiscoveryService = {
  /**
   * Discovers bank accounts associated with the verified mobile number and bank.
   * Uses simulated authorized institutional discovery (PhonePe / GPay style).
   */
  async fetchLinkedAccounts(
    bankId: string,
    mobile: string,
    userName: string = 'Account Holder',
    scenario: DiscoveryScenario = 'auto'
  ): Promise<DiscoveredBankAccount[]> {
    // Artificial smooth latency to simulate institutional API handshake
    await new Promise((resolve) => setTimeout(resolve, 800));

    const cleanMobile = mobile.replace(/\D/g, '');
    const bank = SUPPORTED_BANKS.find((b) => b.id.toLowerCase() === bankId.toLowerCase()) || SUPPORTED_BANKS[0];

    // Scenario 1: Empty / No matching accounts
    if (scenario === 'empty' || cleanMobile.endsWith('0000') || cleanMobile === '0000000000') {
      return [];
    }

    // Scenario 2: Multiple accounts
    if (scenario === 'multiple' || (scenario !== 'single' && (cleanMobile.endsWith('2222') || cleanMobile.endsWith('8888') || bank.id === 'sbi'))) {
      const acc1Number = bank.sampleAccount;
      const acc2Number = `${bank.sampleAccount.slice(0, -4)}9104`;

      return [
        {
          id: `disc_${bank.id}_01`,
          bankId: bank.id,
          bankName: bank.name,
          accountType: 'Savings Account',
          accountNumber: acc1Number,
          maskedAccountNumber: maskAccountNumber(acc1Number),
          accountHolderName: userName.trim() || 'Rajesh Sharma',
          ifscCode: bank.defaultIfscPrefix,
          branchName: `${bank.shortName} Retail Branch`,
          isPrimary: true,
        },
        {
          id: `disc_${bank.id}_02`,
          bankId: bank.id,
          bankName: bank.name,
          accountType: 'Salary Account',
          accountNumber: acc2Number,
          maskedAccountNumber: maskAccountNumber(acc2Number),
          accountHolderName: userName.trim() || 'Rajesh Sharma',
          ifscCode: `${bank.defaultIfscPrefix.slice(0, -3)}890`,
          branchName: `${bank.shortName} Corporate Campus Branch`,
          isPrimary: false,
        },
      ];
    }

    // Scenario 3: Standard single matching account (Default)
    const accNumber = bank.sampleAccount;
    return [
      {
        id: `disc_${bank.id}_primary`,
        bankId: bank.id,
        bankName: bank.name,
        accountType: 'Savings Account',
        accountNumber: accNumber,
        maskedAccountNumber: maskAccountNumber(accNumber),
        accountHolderName: userName.trim() || 'Rajesh Sharma',
        ifscCode: bank.defaultIfscPrefix,
        branchName: `${bank.shortName} Premier Banking Branch`,
        isPrimary: true,
      },
    ];
  },

  /**
   * Simulates institutional ownership verification using the verified mobile binding.
   */
  async verifyAccountOwnership(
    account: DiscoveredBankAccount,
    mobile: string,
    scenario: DiscoveryScenario = 'auto'
  ): Promise<{ success: boolean; error?: string }> {
    await new Promise((resolve) => setTimeout(resolve, 600));

    const cleanMobile = mobile.replace(/\D/g, '');
    if (scenario === 'fail' || cleanMobile.endsWith('9999')) {
      return {
        success: false,
        error: `Institutional ownership verification failed for ${account.bankName}. Mobile binding signature token did not match.`,
      };
    }

    return { success: true };
  },
};
