import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Bell, ShieldAlert, LogOut, CheckCircle2, UserCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useI18n } from '../../context/I18nContext';
import { DemoUserSwitcher } from '../common/DemoUserSwitcher';
import { Badge } from '../common/Badge';

export const Header: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, family, isCustomUser, logoutUser } = useApp();
  const { t } = useI18n();

  const handleLogout = () => {
    logoutUser();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-fintech-border dark:border-slate-800 px-4 sm:px-6 py-3 transition-colors">
      <div className="flex items-center justify-between gap-4">
        {/* Left Side: Mobile Logo & Title */}
        <div className="flex items-center gap-3 lg:hidden">
          <NavLink
            to={currentUser.role === 'owner' && !isCustomUser ? '/' : '/dashboard'}
            className="flex items-center gap-2"
            title={currentUser.role === 'owner' && !isCustomUser ? 'Return to Welcome / Landing page' : 'Go to Dashboard'}
          >
            <div className="w-8 h-8 rounded-lg bg-fintech-primary flex items-center justify-center text-white font-bold text-base shadow-xs">
              P
            </div>
            <div className="flex items-center gap-1">
              <span className="font-bold text-base text-fintech-navy dark:text-white">PayPal</span>
              <span className="text-fintech-primary font-bold text-base">Family</span>
            </div>
          </NavLink>
        </div>

        {/* Center / Left on Desktop: Breadcrumb/Context */}
        <div className="hidden lg:flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <span className="font-bold text-fintech-navy dark:text-white">{family.name}</span>
          <span className="text-slate-400 dark:text-slate-500">•</span>
          <span>
            {t('nav.role', 'Role')}:{' '}
            <strong className="text-fintech-primary dark:text-blue-400 font-bold">
              {currentUser.role === 'owner' ? t('nav.administrator', 'Family Administrator') : t('nav.familyMember', 'Family Member')}
            </strong>
          </span>
          {isCustomUser && (
            <Badge variant="primary" size="sm" className="ml-1 text-[10px]">
              {t('nav.customAccount', 'Custom Account')}
            </Badge>
          )}
        </div>

        {/* Right Side: Demo Switcher (Admin only), Sign Out & Profile */}
        <div className="flex items-center gap-2.5 sm:gap-3 ml-auto">
          {/* Quick Demo Account Switcher (strictly for Demo Mode only: Rajesh, Priya, Aarav) */}
          {!isCustomUser && <DemoUserSwitcher />}

          {/* Sign Out Button (Visible to both, label customized) */}
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 border border-slate-300 dark:border-slate-700 transition-all cursor-pointer"
            title={currentUser.role === 'owner' && !isCustomUser ? 'Exit demo and return to Welcome / Landing page' : 'Sign out of account'}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {currentUser.role === 'owner' && !isCustomUser ? t('nav.exitDemo', 'Exit Demo') : t('nav.signOut', 'Sign Out')}
            </span>
          </button>

          {/* User Profile Pill: Avatar, Member Name, Account Role */}
          <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200 dark:border-slate-700">
            <img
              src={currentUser.avatarUrl}
              alt={currentUser.name}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover ring-2 ring-fintech-primary/30"
            />
            <div className="hidden sm:block text-left">
              <div className="text-xs font-bold text-fintech-navy dark:text-white leading-tight">{currentUser.name}</div>
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-tight">
                {currentUser.role === 'owner' ? t('nav.administrator', 'Family Administrator') : t('nav.familyMember', 'Family Member')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
