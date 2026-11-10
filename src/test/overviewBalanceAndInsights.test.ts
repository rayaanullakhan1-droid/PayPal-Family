import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  INITIAL_OWNER,
  INITIAL_MEMBERS,
  INITIAL_OWNER_WALLET,
  INITIAL_MEMBER_PERSONAL_ACCOUNTS,
  INITIAL_SPENDING_RULES,
} from '../context/AppContext';
import {
  calculateMemberSpending,
  calculateMemberConsumption,
} from '../services/spendingRuleEngine';
import { verifyPinSync, DEMO_PIN_HASH, DEMO_PIN_SALT } from '../utils/security';
import { formatCurrency } from '../utils/currency';

describe('PayPal Family – Overview Page, Balance Separation & Account Visibility Suite', () => {
  const dashboardSource = fs.readFileSync(
    path.resolve(__dirname, '../pages/DashboardPage.tsx'),
    'utf-8'
  );
  const checkBalanceSource = fs.readFileSync(
    path.resolve(__dirname, '../components/common/CheckBalanceModal.tsx'),
    'utf-8'
  );
  const sidebarSource = fs.readFileSync(
    path.resolve(__dirname, '../components/layout/Sidebar.tsx'),
    'utf-8'
  );
  const appContextSource = fs.readFileSync(
    path.resolve(__dirname, '../context/AppContext.tsx'),
    'utf-8'
  );

  // =========================================================================
  // 1. ACCOUNT BALANCE CORRECTNESS & ROLE-BASED SEPARATION
  // =========================================================================
  describe('1. Account Balance Separation & Accuracy', () => {
    it('maintains original PayPal Family account architecture: ONE Administrator main account and personal accounts for members', () => {
      // Administrator has ONE main account (ownerWallet)
      expect(INITIAL_OWNER_WALLET.balancePaise).toBe(1000000); // ₹10,000.00 Administrator Main Account
      expect(INITIAL_MEMBER_PERSONAL_ACCOUNTS['usr_owner_rajesh']).toBeUndefined();

      // Each Member has ONE personal account
      expect(INITIAL_MEMBER_PERSONAL_ACCOUNTS['usr_member_priya'].balancePaise).toBe(50000); // ₹500.00
      expect(INITIAL_MEMBER_PERSONAL_ACCOUNTS['usr_member_aarav'].balancePaise).toBe(0); // ₹0.00
    });

    it('enforces privacy so Members never receive or see the Administrator balance', () => {
      // In AppContext, authorizedMemberPersonalAccounts only exposes currentUser.id for member
      expect(appContextSource).toContain("if (currentUser.role === 'owner') return rawMemberPersonalAccounts;");
      expect(appContextSource).toContain('return { [currentUser.id]: myAcc };');

      // In DashboardPage, member view only references memberPersonalAccount.balancePaise
      expect(dashboardSource).toContain('memberPersonalAccount = memberPersonalAccounts[currentUser.id]');
    });

    it('completely removes Central Family Pool Balance and Current Monthly Spending cards from Overview, and does not directly display Administrator balance', () => {
      // Overview page must not have Central Family Pool Balance or Current Monthly Spending cards
      expect(dashboardSource).not.toContain('Central Family Pool Balance');
      expect(dashboardSource).not.toContain('Current Monthly Spending');
      expect(dashboardSource).not.toContain('Administrator Personal');

      // Member Overview displays Personal Account Balance
      expect(dashboardSource).toContain('Personal Account Balance');
      expect(dashboardSource).toContain('memberPersonalAccount.balancePaise');
    });

    it('sidebar displays clean account balances without pool references', () => {
      expect(sidebarSource).toContain("isOwner ? t('dash.adminAccountBalance', 'Administrator Account')");
      expect(sidebarSource).toContain("t('dash.personalAccountBalance', 'Personal Account Balance')");
      expect(sidebarSource).not.toContain('Pool:');
    });
  });

  // =========================================================================
  // 2. CHECK BALANCE MODAL PIN VERIFICATION & BALANCE REVELATION
  // =========================================================================
  describe('2. Check Balance Modal: 6-Digit PIN Security & Account-Specific Display', () => {
    it('strictly hides balance in State 1 and requires 6-digit transaction PIN verification', () => {
      expect(checkBalanceSource).toContain('const [isVerified, setIsVerified] = useState(false);');
      expect(checkBalanceSource).toContain('verifyUserPin(pin)');
      expect(checkBalanceSource).toContain('Incorrect 6-digit transaction PIN. Identity verification failed');
      expect(checkBalanceSource).toContain('maxLength={6}');
    });

    it('successfully validates default 6-digit demo PIN 123456 and rejects incorrect PINs', () => {
      expect(verifyPinSync('123456', DEMO_PIN_HASH, DEMO_PIN_SALT)).toBe(true);
      expect(verifyPinSync('000000', DEMO_PIN_HASH, DEMO_PIN_SALT)).toBe(false);
      expect(verifyPinSync('999999', DEMO_PIN_HASH, DEMO_PIN_SALT)).toBe(false);
    });

    it('in verified state for Member, shows only Member personal account balance', () => {
      expect(checkBalanceSource).toContain("isOwner ? 'Administrator Account Balance' : 'Personal Account Balance'");
      expect(checkBalanceSource).toContain('Individual funds belonging to');
      expect(checkBalanceSource).toContain("Today's Remaining Allowance:");
    });

    it('in verified state for Administrator, shows Administrator Account Balance and no pool balance', () => {
      expect(checkBalanceSource).toContain('Administrator Account Balance');
      expect(checkBalanceSource).not.toContain('Central Family Pool Balance');
      expect(checkBalanceSource).toContain('ownerWallet.balancePaise');
    });
  });

  // =========================================================================
  // 3. OVERVIEW PAGE: THREE MAIN ACTIONS & CONSISTENT FINTECH DESIGN
  // =========================================================================
  describe('3. Overview Page: Three Main Actions & Visual Consistency', () => {
    it('retains exactly the three main actions: To Mobile Number, Check Balance, History', () => {
      expect(dashboardSource).toContain('To Mobile Number');
      expect(dashboardSource).toContain('Check Balance');
      expect(dashboardSource).toContain('History');

      // Handlers correctly wired
      expect(dashboardSource).toContain('setIsToMobileOpen(true)');
      expect(dashboardSource).toContain('setIsCheckBalanceOpen(true)');
      expect(dashboardSource).toContain("navigate('/transactions')");
    });

    it('applies consistent PayPal Family blue-and-white card styling', () => {
      expect(dashboardSource).toContain('bg-white dark:bg-slate-900 rounded-2xl border border-fintech-border');
      expect(dashboardSource).toContain('bg-blue-50 dark:bg-blue-950/50 text-fintech-primary');
      expect(dashboardSource).toContain('text-fintech-navy');
    });
  });

  // =========================================================================
  // 4. USEFUL OVERVIEW INFORMATION: ALLOWANCES, BUDGETS & AI INTELLIGENCE
  // =========================================================================
  describe('4. Useful Overview Information: Allowances, Spending & AI Insights', () => {
    it('displays Today Allowance and Monthly Budget progress cards exclusively for members and not in Administrator Overview', () => {
      expect(dashboardSource).toContain("t('dash.todaysAllowance', \"Today's Allowance\")");
      expect(dashboardSource).toContain("t('dash.monthlyBudget', 'Monthly Budget')");
      // Must not appear in owner section
      expect(dashboardSource).toContain("// OWNER VIEW: Family AI Spend Intelligence & Pending Requests (Today's Allowance & Monthly Budget appear exclusively in Member accounts)");
      expect(dashboardSource).toContain('consumption.spentTodayPaise');
      expect(dashboardSource).toContain('consumption.configuredDailyLimitPaise');
      expect(dashboardSource).toContain('consumption.spentThisMonthPaise');
      expect(dashboardSource).toContain('consumption.configuredMonthlyLimitPaise');
    });

    it('calculates consumption using single source of truth rule engine', () => {
      const priyaRule = INITIAL_SPENDING_RULES['usr_member_priya'];
      const spending = { spentTodayPaise: 18000, spentThisMonthPaise: 68000 };
      const consumption = calculateMemberConsumption(priyaRule, spending);

      expect(consumption.spentTodayPaise).toBe(18000);
      expect(consumption.remainingTodayPaise).toBe(500000 - 18000);
      expect(consumption.dailyPct).toBe(4); // 18000/500000 = 3.6% -> 4%
      expect(consumption.isDailyExceeded).toBe(false);
      expect(consumption.isMonthlyExceeded).toBe(false);
    });

    it('embeds dynamic AI Spend Intelligence with interactive question pills linking to /ai-assistant', () => {
      expect(dashboardSource).toContain('AI Spend Intelligence');
      expect(dashboardSource).toContain('aiInsight.text');
      expect(dashboardSource).toContain('navigate(`/ai-assistant?q=');
      expect(dashboardSource).toContain('Ask Spending Assistant');
    });

    it('displays recent transactions scoped to the logged-in user with clickable receipt modals', () => {
      expect(dashboardSource).toContain('displayTransactions');
      expect(dashboardSource).toContain('setSelectedReceiptTxn(txn)');
      expect(dashboardSource).toContain('TransactionReceiptModal');
      expect(dashboardSource).toContain('View all');
    });
  });

  // =========================================================================
  // 5. ACCOUNT-BASED UI VISIBILITY (CUSTOM ACCOUNTS VS DEMO ACCOUNTS)
  // =========================================================================
  describe('5. Real/Custom Account Visibility vs Built-in Demo Accounts', () => {
    const bannerSource = fs.readFileSync(
      path.resolve(__dirname, '../components/common/SimulationBanner.tsx'),
      'utf-8'
    );
    const settingsSource = fs.readFileSync(
      path.resolve(__dirname, '../pages/SettingsPage.tsx'),
      'utf-8'
    );

    it('strictly hides demo-only banner, language option, and reset controls for custom users', () => {
      expect(bannerSource).toContain('if (isCustomUser)');
      expect(bannerSource).toContain('return null;');
      expect(settingsSource).toContain('!isCustomUser &&');
      expect(sidebarSource).toContain('!isCustomUser');
    });

    it('preserves built-in demo features for demo users', () => {
      expect(settingsSource).toContain('resetDemoData');
      expect(sidebarSource).toContain("t('nav.landingPage', 'Landing Page')");
    });
  });
});
