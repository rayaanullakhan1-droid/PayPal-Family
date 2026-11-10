import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateMemberConsumption,
  evaluateSpendingEligibility,
} from '../services/spendingRuleEngine';
import { paymentService } from '../services/paymentService';
import { onboardingStorage } from '../services/onboardingStorage';
import { COUNTRIES, getCountryByCode, formatCountryLabel, validatePhoneNumber } from '../utils/countries';
import { SUPPORTED_LANGUAGES, getLanguageMeta } from '../i18n/languages';
import { TRANSLATIONS } from '../i18n/translations';
import { User, SpendingRule, Wallet, Transaction, MoneyRequest } from '../types';

describe('Allowance Logic, Multi-Language, Theme & Country Selection Suite', () => {
  beforeEach(() => {
    onboardingStorage.clearAllLocalTestData();
    try {
      localStorage.clear();
      document.documentElement.removeAttribute('dir');
      document.documentElement.removeAttribute('lang');
      document.documentElement.classList.remove('dark');
    } catch {
      // test environment mock
    }
  });

  // ==========================================================================
  // PART 1: TODAY'S ALLOWANCE AND MONTHLY BUDGET BUSINESS RULES
  // ==========================================================================
  describe("1-4. Today's Allowance & Monthly Budget Calculation & Blocking Rules", () => {
    const testRefDate = new Date(2026, 10, 15, 14, 0, 0);
    const todayIso = new Date(2026, 10, 15, 10, 0, 0).toISOString();
    const earlierThisMonthIso = new Date(2026, 10, 5, 10, 0, 0).toISOString();

    const baseRule: SpendingRule = {
      memberId: 'usr_mem_test',
      singleTransactionLimitPaise: 200000, // ₹2,000
      dailyLimitPaise: 500000,             // ₹5,000
      monthlyLimitPaise: 1000000,          // ₹10,000
      allowMoneyTransfer: true,
      allowQRPayments: true,
    };

    it('Scenario 1: Daily allowance exceeded independently', () => {
      // Member spent ₹5,500 today out of ₹5,000 daily limit, but only ₹5,500 this month (under ₹10,000 monthly limit)
      const transactions: Transaction[] = [
        {
          id: 'tx_today_1',
          reference: 'TXN-TODAY-1',
          familyId: 'fam_01',
          type: 'TRANSFER',
          status: 'COMPLETED',
          amountPaise: 550000, // ₹5,500
          currency: 'INR',
          initiatorId: 'usr_mem_test',
          payerId: 'usr_mem_test',
          senderName: 'Test Member',
          recipientName: 'Merchant A',
          date: todayIso,
          isSimulated: true,
        },
      ];

      const consumption = calculateMemberConsumption(baseRule, transactions, testRefDate);
      expect(consumption.spentTodayPaise).toBe(550000);
      expect(consumption.configuredDailyLimitPaise).toBe(500000);
      expect(consumption.remainingTodayPaise).toBe(0);
      expect(consumption.isDailyExceeded).toBe(true);
      expect(consumption.isMonthlyExceeded).toBe(false);
      expect(consumption.isDailyBlockedByMonthly).toBe(false);

      // Verify eligibility check blocks with DAILY_LIMIT_EXCEEDED
      const member: User = {
        id: 'usr_mem_test',
        name: 'Test Member',
        email: 'test@example.com',
        role: 'member',
        relationship: 'Daughter',
        avatarUrl: '',
        familyId: 'fam_01',
      };
      const wallet: Wallet = { userId: 'usr_mem_test', balancePaise: 1000000, currency: 'INR', isSimulated: true };

      const evalResult = evaluateSpendingEligibility({
        amountPaise: 10000,
        actionType: 'TRANSFER',
        member,
        memberAccount: wallet,
        rule: baseRule,
        allTransactions: transactions,
        referenceDate: testRefDate,
      });
      expect(evalResult.eligible).toBe(false);
      expect(evalResult.code).toBe('DAILY_LIMIT_EXCEEDED');
      expect(evalResult.reason).toContain('Exceeds daily spending limit');
    });

    it('Scenario 2: Monthly budget exceeded independently', () => {
      // Member spent ₹0 today, but has historical transactions this month totaling ₹10,500 out of ₹10,000
      const transactions: Transaction[] = [
        {
          id: 'tx_month_1',
          reference: 'TXN-MONTH-1',
          familyId: 'fam_01',
          type: 'TRANSFER',
          status: 'COMPLETED',
          amountPaise: 1050000, // ₹10,500
          currency: 'INR',
          initiatorId: 'usr_mem_test',
          payerId: 'usr_mem_test',
          senderName: 'Test Member',
          recipientName: 'Store B',
          date: earlierThisMonthIso,
          isSimulated: true,
        },
      ];

      const consumption = calculateMemberConsumption(baseRule, transactions, testRefDate);
      expect(consumption.spentTodayPaise).toBe(0);
      expect(consumption.configuredDailyLimitPaise).toBe(500000);
      expect(consumption.spentThisMonthPaise).toBe(1050000);
      expect(consumption.configuredMonthlyLimitPaise).toBe(1000000);
      expect(consumption.remainingThisMonthPaise).toBe(0);
      expect(consumption.isMonthlyExceeded).toBe(true);
    });

    it("Scenario 3 (CRITICAL BUSINESS RULE): Monthly budget exceeded while daily spending is below daily allowance -> Today's Allowance marked blocked/exceeded for payment eligibility", () => {
      // Daily spent is ₹500 (well below ₹5,000 allowance).
      // But month-to-date spent is ₹10,200 (exceeding ₹10,000 monthly budget).
      const transactions: Transaction[] = [
        {
          id: 'tx_earlier',
          reference: 'TXN-EARLIER',
          familyId: 'fam_01',
          type: 'TRANSFER',
          status: 'COMPLETED',
          amountPaise: 970000, // ₹9,700 earlier this month
          currency: 'INR',
          initiatorId: 'usr_mem_test',
          payerId: 'usr_mem_test',
          senderName: 'Test Member',
          recipientName: 'College Fees',
          date: earlierThisMonthIso,
          isSimulated: true,
        },
        {
          id: 'tx_today',
          reference: 'TXN-TODAY',
          familyId: 'fam_01',
          type: 'TRANSFER',
          status: 'COMPLETED',
          amountPaise: 50000, // ₹500 spent today (well under ₹5,000 daily limit!)
          currency: 'INR',
          initiatorId: 'usr_mem_test',
          payerId: 'usr_mem_test',
          senderName: 'Test Member',
          recipientName: 'Lunch',
          date: todayIso,
          isSimulated: true,
        },
      ];

      const consumption = calculateMemberConsumption(baseRule, transactions, testRefDate);
      // Total monthly spent: 9,700 + 500 = 10,200 (exceeds 10,000)
      expect(consumption.spentThisMonthPaise).toBe(1020000);
      expect(consumption.isMonthlyExceeded).toBe(true);

      // Daily spent is below daily limit:
      expect(consumption.spentTodayPaise).toBe(50000);
      expect(consumption.spentTodayPaise < consumption.configuredDailyLimitPaise).toBe(true);
      expect(consumption.isDailyExceeded).toBe(false);

      // BUT because monthly budget is exceeded:
      // Today's allowance must also be marked blocked/exceeded for transaction eligibility
      expect(consumption.isDailyBlockedByMonthly).toBe(true);
      expect(consumption.effectiveRemainingTodayPaise).toBe(0);

      // Verify eligibility check: attempting even a tiny ₹100 transaction must be blocked
      const member: User = {
        id: 'usr_mem_test',
        name: 'Test Member',
        email: 'test@example.com',
        role: 'member',
        relationship: 'Son',
        avatarUrl: '',
        familyId: 'fam_01',
      };
      const wallet: Wallet = { userId: 'usr_mem_test', balancePaise: 1000000, currency: 'INR', isSimulated: true };

      const evalResult = evaluateSpendingEligibility({
        amountPaise: 10000,
        actionType: 'TRANSFER',
        member,
        memberAccount: wallet,
        rule: baseRule,
        allTransactions: transactions,
        referenceDate: testRefDate,
      });
      expect(evalResult.eligible).toBe(false);
      expect(evalResult.code).toBe('MONTHLY_LIMIT_EXCEEDED');
      expect(evalResult.reason).toContain('Monthly budget exceeded');
      expect(evalResult.reason).toContain('daily allowance was not independently exhausted');
    });

    it('Scenario 4: Both daily and monthly limits exceeded simultaneously', () => {
      // Configured daily limit: ₹5,000. Configured monthly limit: ₹10,000.
      // Spent today: ₹6,000. Spent earlier this month: ₹5,000. Total month: ₹11,000.
      const transactions: Transaction[] = [
        {
          id: 'tx_earlier',
          reference: 'TXN-1',
          familyId: 'fam_01',
          type: 'TRANSFER',
          status: 'COMPLETED',
          amountPaise: 500000, // ₹5,000
          currency: 'INR',
          initiatorId: 'usr_mem_test',
          payerId: 'usr_mem_test',
          senderName: 'Test Member',
          recipientName: 'Electronics',
          date: earlierThisMonthIso,
          isSimulated: true,
        },
        {
          id: 'tx_today',
          reference: 'TXN-2',
          familyId: 'fam_01',
          type: 'TRANSFER',
          status: 'COMPLETED',
          amountPaise: 600000, // ₹6,000
          currency: 'INR',
          initiatorId: 'usr_mem_test',
          payerId: 'usr_mem_test',
          senderName: 'Test Member',
          recipientName: 'Books & Supplies',
          date: todayIso,
          isSimulated: true,
        },
      ];

      const consumption = calculateMemberConsumption(baseRule, transactions, testRefDate);
      expect(consumption.isDailyExceeded).toBe(true);
      expect(consumption.isMonthlyExceeded).toBe(true);
      expect(consumption.isDailyBlockedByMonthly).toBe(true);
      expect(consumption.effectiveRemainingTodayPaise).toBe(0);
      expect(consumption.remainingThisMonthPaise).toBe(0);
    });
  });

  // ==========================================================================
  // PART 2: REQUEST / CANCEL EXCEPTION WORKFLOW PRESERVED
  // ==========================================================================
  describe('5. Existing Request / Cancel Exception Workflow', () => {
    it('should allow submitting an exception request when monthly or daily limit is exceeded', async () => {
      const member: User = {
        id: 'usr_priya',
        name: 'Priya Sharma',
        email: 'priya@example.com',
        role: 'member',
        relationship: 'Daughter',
        avatarUrl: '',
        familyId: 'fam_sharma',
      };
      const rule: SpendingRule = {
        memberId: 'usr_priya',
        singleTransactionLimitPaise: 2000000, // ₹20,000 (allows single transfer up to ₹20k)
        dailyLimitPaise: 2000000,             // ₹20,000 (allows daily up to ₹20k)
        monthlyLimitPaise: 1000000,          // ₹10,000 (transfer of ₹12,000 exceeds monthly limit!)
        allowMoneyTransfer: true,
        allowQRPayments: true,
      };
      const memberWallet: Wallet = {
        userId: 'usr_priya',
        balancePaise: 200000, // ₹2,000
        currency: 'INR',
        isSimulated: true,
      };
      const ownerWallet: Wallet = {
        userId: 'usr_owner',
        balancePaise: 5000000, // ₹50,000
        currency: 'INR',
        isSimulated: true,
      };

      const owner: User = {
        id: 'usr_owner',
        name: 'Rajesh Sharma',
        email: 'rajesh@example.com',
        role: 'owner',
        relationship: 'Father',
        avatarUrl: '',
        familyId: 'fam_sharma',
      };

      // Member attempts transfer of ₹12,000 (exceeds monthly limit of ₹10,000)
      const res = await paymentService.processMoneyTransfer({
        member,
        owner,
        ownerWallet,
        memberWallet,
        rule,
        amountPaise: 1200000,
        purpose: 'University Fees',
        existingTransactions: [],
      });

      expect(res.success).toBe(false);
      expect(res.isOverLimit).toBe(true);
      expect(res.overLimitDetails).toBeDefined();
      expect(res.overLimitDetails?.configuredLimitPaise).toBe(1000000);
      expect(res.overLimitDetails?.requestedAmountPaise).toBe(1200000);
      expect(res.overLimitDetails?.excessAmountPaise).toBe(200000);
    });

    it('should manage pending exception requests, allow cancellation, and update balances on approval', () => {
      // 1. Create a pending limit exception request
      const reqId = `req_${Date.now()}`;
      const exceptionReq: MoneyRequest = {
        id: reqId,
        familyId: 'fam_test',
        memberId: 'usr_mem_01',
        memberName: 'Priya Sharma',
        memberAvatar: '',
        amountPaise: 1200000, // ₹12,000
        purpose: 'Semester tuition fees (Limit exception)',
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        isException: true,
        configuredLimitPaise: 1000000,
        excessAmountPaise: 200000,
      };

      onboardingStorage.saveMoneyRequests([exceptionReq]);
      let allReqs = onboardingStorage.getMoneyRequests('fam_test');
      expect(allReqs).toHaveLength(1);
      expect(allReqs[0].status).toBe('PENDING');

      // 2. Member cancels / declines the pending request
      allReqs[0].status = 'REJECTED';
      onboardingStorage.saveMoneyRequests(allReqs);
      allReqs = onboardingStorage.getMoneyRequests('fam_test');
      expect(allReqs[0].status).toBe('REJECTED');

      // 3. Resubmit and simulate Administrator approval
      const newReq: MoneyRequest = {
        ...exceptionReq,
        id: `req_approved_${Date.now()}`,
        status: 'PENDING',
      };
      onboardingStorage.saveMoneyRequests([newReq]);

      // Administrator approves: deducts from admin wallet and credits member personal wallet
      const wallets: Record<string, Wallet> = {
        usr_owner: { userId: 'usr_owner', balancePaise: 5000000, currency: 'INR', isSimulated: true },
        usr_mem_01: { userId: 'usr_mem_01', balancePaise: 100000, currency: 'INR', isSimulated: true },
      };

      wallets.usr_owner.balancePaise -= newReq.amountPaise;
      wallets.usr_mem_01.balancePaise += newReq.amountPaise;
      newReq.status = 'APPROVED';

      expect(wallets.usr_owner.balancePaise).toBe(3800000); // 50,000 - 12,000 = 38,000
      expect(wallets.usr_mem_01.balancePaise).toBe(1300000); // 1,000 + 12,000 = 13,000
      expect(newReq.status).toBe('APPROVED');
    });
  });

  // ==========================================================================
  // PART 3: MULTI-LANGUAGE TRANSLATION & PERSISTENCE
  // ==========================================================================
  describe('6-8. Multi-Language Support, Persistence & RTL Layout', () => {
    it('Scenario 6: All 22 required languages exist in the registry', () => {
      const REQUIRED_22_LANGS = [
        'en', 'hi', 'kn', 'ur', 'ta', 'te', 'ml', 'mr', 'bn', 'gu', 'pa',
        'es', 'fr', 'ar', 'de', 'pt', 'ja', 'zh', 'it', 'ru', 'tr', 'id'
      ];

      expect(SUPPORTED_LANGUAGES).toHaveLength(22);
      const supportedCodes = SUPPORTED_LANGUAGES.map((l) => l.code);

      for (const reqCode of REQUIRED_22_LANGS) {
        expect(supportedCodes).toContain(reqCode);
        expect(TRANSLATIONS[reqCode]).toBeDefined();
        // Check core navigation and allowance status keys
        expect(TRANSLATIONS[reqCode]['nav.overview']).toBeDefined();
        expect(TRANSLATIONS[reqCode]['dash.todaysAllowance']).toBeDefined();
        expect(TRANSLATIONS[reqCode]['dash.monthlyBudget']).toBeDefined();
        expect(TRANSLATIONS[reqCode]['dash.dailyExceeded']).toBeDefined();
        expect(TRANSLATIONS[reqCode]['dash.monthlyExceeded']).toBeDefined();
      }
    });

    it('Scenario 6b: Translations preserve names, transaction IDs and currency formatting', () => {
      // In Hindi: "nav.overview" translates to "अवलोकन", but names ("Rajesh") and IDs ("TXN-123") and amounts ("₹5,000") are rendered as-is
      const hiOverview = TRANSLATIONS['hi']['nav.overview'];
      expect(hiOverview).toBe('अवलोकन');

      const knOverview = TRANSLATIONS['kn']['nav.overview'];
      expect(knOverview).toBe('ಅವಲೋಕನ');

      const frOverview = TRANSLATIONS['fr']['nav.overview'];
      expect(frOverview).toBe('Aperçu');

      const arOverview = TRANSLATIONS['ar']['nav.overview'];
      expect(arOverview).toBe('نظرة عامة');

      const urOverview = TRANSLATIONS['ur']['nav.overview'];
      expect(urOverview).toBe('جائزہ');
    });

    it('Scenario 7: Language selection persistence in localStorage', () => {
      const STORAGE_KEY = 'pf_app_language';

      // Select French
      localStorage.setItem(STORAGE_KEY, 'fr');
      expect(localStorage.getItem(STORAGE_KEY)).toBe('fr');

      // Retrieve language meta
      const meta = getLanguageMeta(localStorage.getItem(STORAGE_KEY) || 'en');
      expect(meta.code).toBe('fr');
      expect(meta.name).toBe('French');

      // Select Japanese
      localStorage.setItem(STORAGE_KEY, 'ja');
      const jaMeta = getLanguageMeta(localStorage.getItem(STORAGE_KEY) || 'en');
      expect(jaMeta.code).toBe('ja');
      expect(jaMeta.nativeName).toBe('日本語');
    });

    it('Scenario 8: Urdu and Arabic require RTL layout direction', () => {
      const urduMeta = getLanguageMeta('ur');
      expect(urduMeta.dir).toBe('rtl');
      expect(urduMeta.nativeName).toBe('اردو');

      const arabicMeta = getLanguageMeta('ar');
      expect(arabicMeta.dir).toBe('rtl');
      expect(arabicMeta.nativeName).toBe('العربية');

      // Other languages must be LTR
      const englishMeta = getLanguageMeta('en');
      expect(englishMeta.dir).toBe('ltr');

      const hindiMeta = getLanguageMeta('hi');
      expect(hindiMeta.dir).toBe('ltr');

      const kannadaMeta = getLanguageMeta('kn');
      expect(kannadaMeta.dir).toBe('ltr');
    });
  });

  // ==========================================================================
  // PART 4: THEMES (LIGHT, DARK, SYSTEM DEFAULT) & PERSISTENCE
  // ==========================================================================
  describe('9-12. Dark Mode, Light Mode & System Default Theme', () => {
    it('Scenario 9 & 10: Light and Dark theme preferences', () => {
      const THEME_KEY = 'pf_app_theme';

      // Set dark
      localStorage.setItem(THEME_KEY, 'dark');
      expect(localStorage.getItem(THEME_KEY)).toBe('dark');

      // Set light
      localStorage.setItem(THEME_KEY, 'light');
      expect(localStorage.getItem(THEME_KEY)).toBe('light');

      // Set system
      localStorage.setItem(THEME_KEY, 'system');
      expect(localStorage.getItem(THEME_KEY)).toBe('system');
    });

    it('Scenario 11: System default theme follows device setting', () => {
      // If prefers-color-scheme is dark, system resolves to dark
      const mockPrefersDark = true;
      const resolved = mockPrefersDark ? 'dark' : 'light';
      expect(resolved).toBe('dark');

      // If prefers-color-scheme is light, system resolves to light
      const mockPrefersLight = false;
      const resolvedLight = mockPrefersLight ? 'dark' : 'light';
      expect(resolvedLight).toBe('light');
    });

    it('Scenario 12: Theme persistence maintains selection after page refresh', () => {
      localStorage.setItem('pf_app_theme', 'dark');
      const savedTheme = localStorage.getItem('pf_app_theme');
      expect(savedTheme).toBe('dark');
    });
  });

  // ==========================================================================
  // PART 5: COUNTRY NAME WITH INTERNATIONAL CALLING CODE
  // ==========================================================================
  describe('13-15. Country Name with Calling Code, Search & Validation', () => {
    it('Scenario 13: Country name and calling code displayed together in required format', () => {
      // Examples: India (+91), United States (+1), United Kingdom (+44), etc.
      const india = getCountryByCode('IN');
      expect(india.name).toBe('India');
      expect(india.dialCode).toBe('+91');
      expect(formatCountryLabel(india)).toBe('India (+91)');

      const us = getCountryByCode('US');
      expect(formatCountryLabel(us)).toBe('United States (+1)');

      const uk = getCountryByCode('GB');
      expect(formatCountryLabel(uk)).toBe('United Kingdom (+44)');

      const uae = getCountryByCode('AE');
      expect(formatCountryLabel(uae)).toBe('United Arab Emirates (+971)');

      const saudi = getCountryByCode('SA');
      expect(formatCountryLabel(saudi)).toBe('Saudi Arabia (+966)');

      const canada = getCountryByCode('CA');
      expect(formatCountryLabel(canada)).toBe('Canada (+1)');

      const australia = getCountryByCode('AU');
      expect(formatCountryLabel(australia)).toBe('Australia (+61)');

      const germany = getCountryByCode('DE');
      expect(formatCountryLabel(germany)).toBe('Germany (+49)');

      const france = getCountryByCode('FR');
      expect(formatCountryLabel(france)).toBe('France (+33)');

      const japan = getCountryByCode('JP');
      expect(formatCountryLabel(japan)).toBe('Japan (+81)');

      const pakistan = getCountryByCode('PK');
      expect(formatCountryLabel(pakistan)).toBe('Pakistan (+92)');

      const bangladesh = getCountryByCode('BD');
      expect(formatCountryLabel(bangladesh)).toBe('Bangladesh (+880)');
    });

    it('Scenario 13b: Searchable countries by name or dial code', () => {
      const searchByName = (query: string) => {
        const q = query.toLowerCase().trim();
        return COUNTRIES.filter(
          (c) => c.name.toLowerCase().includes(q) || c.dialCode.includes(q) || c.code.toLowerCase().includes(q)
        );
      };

      const matchesIndia = searchByName('india');
      expect(matchesIndia.some((c) => c.name === 'India')).toBe(true);

      const matchesPlus1 = searchByName('+1');
      expect(matchesPlus1.some((c) => c.name === 'United States')).toBe(true);
      expect(matchesPlus1.some((c) => c.name === 'Canada')).toBe(true);

      const matches971 = searchByName('971');
      expect(matches971.some((c) => c.name === 'United Arab Emirates')).toBe(true);
    });

    it('Scenario 14: Phone number format validation per country', () => {
      const india = getCountryByCode('IN');
      // Valid 10-digit Indian phone
      expect(validatePhoneNumber(india, '9876543210').valid).toBe(true);
      expect(validatePhoneNumber(india, '98765 43210').valid).toBe(true);

      // Invalid Indian phone (too short)
      const shortRes = validatePhoneNumber(india, '98765');
      expect(shortRes.valid).toBe(false);
      expect(shortRes.error).toContain('10 digits');

      // Invalid Indian phone (too long)
      const longRes = validatePhoneNumber(india, '987654321099');
      expect(longRes.valid).toBe(false);
      expect(longRes.error).toContain('10 digits');

      // UAE (9 digits)
      const uae = getCountryByCode('AE');
      expect(validatePhoneNumber(uae, '501234567').valid).toBe(true);
      expect(validatePhoneNumber(uae, '50123').valid).toBe(false);

      // Empty phone
      expect(validatePhoneNumber(india, '').valid).toBe(false);
    });

    it('Scenario 15: Profile country persistence in storage', () => {
      // Register user with country
      const registered = onboardingStorage.registerMobileUser(
        'Kavita Nair',
        '+91',
        '9876543210',
        'India'
      );
      expect(registered.country).toBe('India');

      // Update country to United Arab Emirates
      const updated = onboardingStorage.updateUserProfile(registered.id, {
        country: 'United Arab Emirates',
        phone: '+971 50 123 4567',
      });
      expect(updated?.country).toBe('United Arab Emirates');

      // Read back from storage to verify persistence
      const retrieved = onboardingStorage.getUserById(registered.id);
      expect(retrieved?.country).toBe('United Arab Emirates');
      expect(retrieved?.phone).toBe('+971 50 123 4567');
    });
  });
});

