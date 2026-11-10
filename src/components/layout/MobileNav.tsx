import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  HandCoins,
  QrCode,
  History,
  Bot,
  Sliders,
  Users,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useI18n } from '../../context/I18nContext';

export const MobileNav: React.FC = () => {
  const { currentUser } = useApp();
  const { t } = useI18n();
  const isOwner = currentUser.role === 'owner';

  const navItems = [
    { key: 'nav.overview', label: 'Overview', path: '/dashboard', icon: LayoutDashboard },
    ...(isOwner ? [{ key: 'nav.family', label: 'Family', path: '/family', icon: Users }] : []),
    { key: 'nav.requestMoney', label: 'Request', path: '/request-money', icon: HandCoins },
    { key: 'nav.scanPay', label: 'Scan & Pay', path: '/scan-pay', icon: QrCode, isFab: true },
    { key: 'nav.spendingLimits', label: 'Limits', path: '/spending-limits', icon: Sliders },
    { key: 'nav.aiAssistant', label: 'AI Insights', path: '/ai-assistant', icon: Bot },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-fintech-border z-30 px-2 py-1.5 shadow-elevated">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-1 px-2 rounded-lg transition-colors text-[10px] font-medium ${
                  isActive
                    ? 'text-fintech-primary font-bold'
                    : 'text-fintech-muted hover:text-fintech-navy'
                } ${item.isFab ? 'relative -top-2' : ''}`
              }
            >
              {item.isFab ? (
                <div className="w-11 h-11 rounded-full bg-fintech-primary text-white flex items-center justify-center shadow-md mb-0.5 ring-4 ring-white">
                  <Icon className="w-5 h-5" />
                </div>
              ) : (
                <Icon className="w-5 h-5 mb-0.5" />
              )}
              <span>{t(item.key, item.label)}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

