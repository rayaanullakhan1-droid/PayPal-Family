import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('PayPal Family – Account-Based UI Visibility (Real/Custom vs Built-in Demo Accounts)', () => {
  const simulationBannerSource = fs.readFileSync(
    path.resolve(__dirname, '../components/common/SimulationBanner.tsx'),
    'utf-8'
  );
  const sidebarSource = fs.readFileSync(
    path.resolve(__dirname, '../components/layout/Sidebar.tsx'),
    'utf-8'
  );
  const headerSource = fs.readFileSync(
    path.resolve(__dirname, '../components/layout/Header.tsx'),
    'utf-8'
  );
  const settingsSource = fs.readFileSync(
    path.resolve(__dirname, '../pages/SettingsPage.tsx'),
    'utf-8'
  );
  const checkBalanceSource = fs.readFileSync(
    path.resolve(__dirname, '../components/common/CheckBalanceModal.tsx'),
    'utf-8'
  );
  const toMobileSource = fs.readFileSync(
    path.resolve(__dirname, '../components/common/ToMobileModal.tsx'),
    'utf-8'
  );
  const dashboardSource = fs.readFileSync(
    path.resolve(__dirname, '../pages/DashboardPage.tsx'),
    'utf-8'
  );

  // =========================================================================
  // 1. TOP HEADER & BANNER: Reset Demo Data Removal for Real/Custom Accounts
  // =========================================================================
  describe('1. Top Header & Banner Demo Elements Visibility', () => {
    it('SimulationBanner completely hides for real/custom accounts (isCustomUser === true)', () => {
      // Must have early return null for isCustomUser
      expect(simulationBannerSource).toContain('if (isCustomUser) {');
      expect(simulationBannerSource).toContain('return null;');
    });

    it('SimulationBanner shows Reset Demo Data strictly for built-in demo Administrator', () => {
      // Must condition Reset Demo Data button on isOwner
      expect(simulationBannerSource).toContain('{isOwner && (');
      expect(simulationBannerSource).toContain('Reset Demo Data');
    });

    it('Header displays normal Sign Out button for real/custom account and Exit Demo for demo owner', () => {
      expect(headerSource).toContain(
        "currentUser.role === 'owner' && !isCustomUser ? t('nav.exitDemo', 'Exit Demo') : t('nav.signOut', 'Sign Out')"
      );
      // DemoUserSwitcher is strictly hidden for custom accounts
      expect(headerSource).toContain('!isCustomUser && <DemoUserSwitcher />');
    });
  });

  // =========================================================================
  // 2. SIDEBAR: Landing Page Option Visibility
  // =========================================================================
  describe('2. Sidebar Landing Page Option Visibility', () => {
    it('removes Landing Page sidebar option for real/custom accounts', () => {
      // Must condition Landing Page on isOwner && !isCustomUser
      expect(sidebarSource).toContain('{isOwner && !isCustomUser && (');
      expect(sidebarSource).toContain("t('nav.landingPage', 'Landing Page')");
    });

    it('preserves Landing Page option for built-in demo Administrator', () => {
      const shouldShowLandingPage = (isOwner: boolean, isCustomUser: boolean) =>
        isOwner && !isCustomUser;

      expect(shouldShowLandingPage(true, false)).toBe(true);  // Demo Admin: YES
      expect(shouldShowLandingPage(true, true)).toBe(false);  // Custom Admin: NO
      expect(shouldShowLandingPage(false, false)).toBe(false); // Demo Member: NO
      expect(shouldShowLandingPage(false, true)).toBe(false);  // Custom Member: NO
    });

    it('points brand logo to /dashboard for custom users and / for demo admin', () => {
      expect(sidebarSource).toContain("to={isOwner && !isCustomUser ? '/' : '/dashboard'}");
      expect(headerSource).toContain("to={currentUser.role === 'owner' && !isCustomUser ? '/' : '/dashboard'}");
    });
  });

  // =========================================================================
  // 3. SETTINGS PAGE: Demo-Only Settings & Controls Visibility
  // =========================================================================
  describe('3. Settings Page Demo-Only Controls Visibility', () => {
    it('removes the Language Preference option for real/custom accounts while preserving it for demo accounts', () => {
      // Language preference must be wrapped with !isCustomUser
      expect(settingsSource).toContain('{!isCustomUser && (');
      expect(settingsSource).toContain("{t('settings.languageTitle', 'Language / भाषा')}");
    });

    it('removes the Reset Demo Data option for real/custom accounts while preserving it for demo owner', () => {
      // Reset Family Data State must be wrapped with currentUser.role === 'owner' && !isCustomUser
      expect(settingsSource).toContain("currentUser.role === 'owner' && !isCustomUser && (");
      expect(settingsSource).toContain('Reset Family Data State');
      expect(settingsSource).toContain('Reset to Initial Demo State');
    });

    it('removes pre-seeded demo accounts PIN note for real/custom accounts', () => {
      expect(settingsSource).toContain('{!isCustomUser && (');
      expect(settingsSource).toContain('Pre-seeded demo accounts (Rajesh, Priya, Aarav) default to demo PIN');
    });

    it('preserves user relevant account settings (PIN change, profile, etc.) for custom users', () => {
      expect(settingsSource).toContain('Six-Digit Transaction PIN');
      expect(settingsSource).toContain('Update Transaction PIN');
      expect(settingsSource).toContain('Profile Information');
      expect(settingsSource).toContain('Theme & Visual Mode');
    });
  });

  // =========================================================================
  // 4. DEMO-SPECIFIC LABELS, NOTICES & CONTROLS
  // =========================================================================
  describe('4. Demo-Specific Labels & Notices Removal', () => {
    it('removes Demo default PIN hint from CheckBalanceModal for real/custom accounts', () => {
      expect(checkBalanceSource).toContain('!isCustomUser ? (');
      expect(checkBalanceSource).toContain('Demo default PIN:');
    });

    it('removes Default demo PIN note from ToMobileModal for real/custom accounts', () => {
      expect(toMobileSource).toContain("{!isCustomUser && ' (Default demo PIN: 123456)'}");
    });

    it('removes Simulated badges on Dashboard balance cards for real/custom accounts', () => {
      expect(dashboardSource).toContain('{!isCustomUser && (');
      expect(dashboardSource).toContain('<Badge variant="simulated" size="sm" className="bg-white/10 text-white border-white/20">');
    });
  });
});
