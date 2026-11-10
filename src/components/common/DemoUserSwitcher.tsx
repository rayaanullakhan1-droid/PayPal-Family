import React from 'react';
import { Users } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const DemoUserSwitcher: React.FC = () => {
  const { currentUser, familyMembers, switchUser } = useApp();

  // Order demo personas: Rajesh, Priya, Aarav
  const demoOrder = ['usr_owner_rajesh', 'usr_member_priya', 'usr_member_aarav'];
  const sortedMembers = [...familyMembers].sort((a, b) => {
    const idxA = demoOrder.indexOf(a.id);
    const idxB = demoOrder.indexOf(b.id);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return 0;
  });

  const getRoleLabel = (role: string) => {
    return role === 'owner' ? 'Owner/Administrator' : 'Family Member';
  };

  return (
    <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-full border border-fintech-border/80 dark:border-slate-700">
      <div className="hidden xl:flex items-center gap-1 pl-2 pr-1 text-[11px] font-bold text-fintech-muted dark:text-slate-400 uppercase tracking-wider">
        <Users className="w-3.5 h-3.5 text-fintech-primary dark:text-blue-400" />
        <span>Demo:</span>
      </div>
      <div className="flex items-center gap-1">
        {sortedMembers.map((member) => {
          const isActive = member.id === currentUser.id;
          const isOwner = member.role === 'owner';
          const firstName = member.name.split(' ')[0];
          const roleLabel = getRoleLabel(member.role);

          return (
            <button
              key={member.id}
              type="button"
              onClick={() => switchUser(member.id)}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 cursor-pointer ${
                isActive
                  ? 'bg-white dark:bg-slate-900 text-fintech-navy dark:text-white shadow-xs border border-fintech-border dark:border-slate-700 ring-1 ring-fintech-primary/30'
                  : 'text-slate-600 dark:text-slate-400 hover:text-fintech-navy dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/60'
              }`}
              title={`Switch to ${firstName} – ${roleLabel}`}
              aria-label={`Switch to ${firstName} – ${roleLabel}`}
            >
              <img
                src={member.avatarUrl}
                alt={member.name}
                className="w-4 h-4 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700 shrink-0"
              />
              <span className="font-bold">{firstName}</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal hidden sm:inline">–</span>
              <span
                className={`text-[10px] font-medium hidden sm:inline ${
                  isOwner
                    ? 'text-fintech-primary dark:text-blue-400 font-bold'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {roleLabel}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

