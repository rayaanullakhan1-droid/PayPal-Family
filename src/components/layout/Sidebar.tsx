import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  HandCoins,
  QrCode,
  Sliders,
  History,
  Bot,
  Settings,
  ShieldCheck,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useI18n } from '../../context/I18nContext';
import { formatCurrency } from '../../utils/currency';

interface NavItem {
  key: string;
  label: string;
  path: string;
  icon: React.ElementType;
  badge?: string;
  ownerOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'nav.overview', label: 'Overview', path: '/dashboard', icon: LayoutDashboard },
  { key: 'nav.family', label: 'Family', path: '/family', icon: Users },
  { key: 'nav.requestMoney', label: 'Request Money', path: '/request-money', icon: HandCoins },
  { key: 'nav.scanPay', label: 'Scan & Pay', path: '/scan-pay', icon: QrCode },
  { key: 'nav.spendingLimits', label: 'Spending Limits', path: '/spending-limits', icon: Sliders },
  { key: 'nav.transactions', label: 'Transactions', path: '/transactions', icon: History },
  { key: 'nav.aiAssistant', label: 'AI Assistant', path: '/ai-assistant', icon: Bot, badge: 'Smart' },
  { key: 'nav.settings', label: 'Settings', path: '/settings', icon: Settings },
];

export const Sidebar: React.FC = () => {
  const { currentUser, family, ownerWallet, memberPersonalAccounts, isCustomUser } = useApp();
  const { t } = useI18n();
  const isOwner = currentUser.role === 'owner';
  const memberBalance = memberPersonalAccounts[currentUser.id]?.balancePaise || 0;

  // Filter navigation items by role:
  // For Members: strictly Overview, Request Money, Scan & Pay, Spending Limits, Transactions, AI Assistant, Settings.
  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (item.path === '/family' && !isOwner) return false;
    return true;
  });

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-white dark:bg-slate-900 border-r border-fintech-border dark:border-slate-800 h-screen sticky top-0 shrink-0 z-30 select-none transition-colors">
      {/* Brand Header */}
      <div className="p-6 border-b border-fintech-border/70 dark:border-slate-800 flex items-center justify-between">
        <NavLink
          to={isOwner && !isCustomUser ? '/' : '/dashboard'}
          className="flex items-center gap-2.5 group"
          title={isOwner && !isCustomUser ? 'Return to Welcome / Landing Page' : 'Go to Dashboard'}
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-fintech-deep to-fintech-primary flex items-center justify-center text-white font-bold text-xl shadow-md group-hover:scale-105 transition-transform">
            P
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-lg text-fintech-navy dark:text-white tracking-tight">PayPal</span>
              <span className="text-fintech-primary font-bold text-lg">Family</span>
            </div>
            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 tracking-wider uppercase">
              Family Finance
            </p>
          </div>
        </NavLink>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 py-5 space-y-1.5 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {isOwner ? t('nav.adminMenu', 'Administrator Menu') : t('nav.memberMenu', 'Member Menu')}
        </div>
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-fintech-accent dark:bg-blue-950/60 text-fintech-primary dark:text-blue-300 font-bold shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-fintech-navy dark:hover:text-white'
                }`
              }
            >
              <div className="flex items-center gap-3">
                <Icon className="w-5 h-5 shrink-0" />
                <span>{t(item.key, item.label)}</span>
              </div>
              {item.badge && (
                <span className="bg-blue-100 dark:bg-blue-900/60 text-fintech-primary dark:text-blue-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}

        {/* Back to Landing Page Link (Built-in Demo Administrator only; removed for real/custom accounts and Members) */}
        {isOwner && !isCustomUser && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <NavLink
              to="/"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-fintech-primary dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              title="Return to Welcome / Landing Page"
            >
              <ArrowLeft className="w-4 h-4 text-fintech-primary dark:text-blue-400 shrink-0" />
              <span>{t('nav.landingPage', 'Landing Page')}</span>
            </NavLink>
          </div>
        )}
      </nav>

      {/* Account Balance Summary Card at bottom of sidebar */}
      <div className="p-4 border-t border-fintech-border/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80">
        <div className="bg-white dark:bg-slate-800/90 rounded-xl p-3.5 border border-fintech-border dark:border-slate-700 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span className="font-bold text-fintech-navy dark:text-slate-200">
              {isOwner ? t('dash.adminAccountBalance', 'Administrator Account') : t('dash.personalAccountBalance', 'Personal Account Balance')}
            </span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-lg font-bold text-fintech-navy dark:text-white">
            {formatCurrency(isOwner ? ownerWallet.balancePaise : memberBalance)}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
            {isOwner ? `Main Account (${family.name})` : `Available Balance (${currentUser.name.split(' ')[0]})`}
          </p>
        </div>
      </div>
    </aside>
  );
};
