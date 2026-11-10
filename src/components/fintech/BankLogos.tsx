import React from 'react';

export interface BankLogoProps {
  bankId: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export interface BankInfo {
  id: string;
  name: string;
  shortName: string;
  defaultIfscPrefix: string;
  sampleAccount: string;
  tagline: string;
}

export const SUPPORTED_BANKS: BankInfo[] = [
  {
    id: 'hdfc',
    name: 'HDFC Bank',
    shortName: 'HDFC',
    defaultIfscPrefix: 'HDFC0001234',
    sampleAccount: '50100482910482',
    tagline: "We Understand Your World",
  },
  {
    id: 'sbi',
    name: 'State Bank of India',
    shortName: 'SBI',
    defaultIfscPrefix: 'SBIN0000300',
    sampleAccount: '3098765432101',
    tagline: 'The Banker to Every Indian',
  },
  {
    id: 'icici',
    name: 'ICICI Bank',
    shortName: 'ICICI',
    defaultIfscPrefix: 'ICIC0000001',
    sampleAccount: '000401567890',
    tagline: 'Hum Hai Na, Khayal Aapka',
  },
  {
    id: 'axis',
    name: 'Axis Bank',
    shortName: 'Axis',
    defaultIfscPrefix: 'UTIB0000004',
    sampleAccount: '912010045678901',
    tagline: 'Badhti Ka Naam Zindagi',
  },
  {
    id: 'kotak',
    name: 'Kotak Mahindra Bank',
    shortName: 'Kotak',
    defaultIfscPrefix: 'KKBK0000958',
    sampleAccount: '7812903456',
    tagline: "Let's Make Money Simple",
  },
  {
    id: 'pnb',
    name: 'Punjab National Bank',
    shortName: 'PNB',
    defaultIfscPrefix: 'PUNB0000100',
    sampleAccount: '0153000100123456',
    tagline: 'The Name You Can Bank Upon',
  },
];

export const BankLogo: React.FC<BankLogoProps> = ({ bankId, className = '', size = 'md' }) => {
  const sizeMap = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-base',
    xl: 'w-20 h-20 text-lg',
  };

  const id = bankId.toLowerCase();

  if (id.includes('hdfc')) {
    return (
      <div
        className={`rounded-xl flex items-center justify-center font-bold tracking-tight shadow-xs bg-[#004C8F] text-white shrink-0 overflow-hidden relative ${sizeMap[size]} ${className}`}
        title="HDFC Bank"
      >
        <div className="absolute inset-0 flex items-center justify-center opacity-20">
          <div className="w-full h-1 bg-[#ED232A]" />
          <div className="h-full w-1 bg-[#ED232A] absolute" />
        </div>
        <div className="relative z-10 flex flex-col items-center leading-none">
          <span className="font-extrabold text-[9px] uppercase tracking-tighter">HDFC</span>
          <span className="text-[6px] tracking-widest text-slate-200 uppercase font-semibold">BANK</span>
        </div>
      </div>
    );
  }

  if (id.includes('sbi') || id.includes('state bank')) {
    return (
      <div
        className={`rounded-xl flex items-center justify-center font-bold shadow-xs bg-[#224099] text-white shrink-0 relative ${sizeMap[size]} ${className}`}
        title="State Bank of India"
      >
        <svg viewBox="0 0 100 100" className="w-3/4 h-3/4 fill-current">
          <circle cx="50" cy="50" r="46" fill="#00A5EC" />
          <circle cx="50" cy="42" r="14" fill="#224099" />
          <rect x="44" y="42" width="12" height="36" fill="#224099" rx="2" />
        </svg>
      </div>
    );
  }

  if (id.includes('icici')) {
    return (
      <div
        className={`rounded-xl flex items-center justify-center font-bold shadow-xs bg-[#B02A30] text-white shrink-0 relative overflow-hidden ${sizeMap[size]} ${className}`}
        title="ICICI Bank"
      >
        <div className="absolute -right-2 -bottom-2 w-8 h-8 rounded-full bg-[#F58220] opacity-80" />
        <div className="relative z-10 flex flex-col items-center leading-none">
          <span className="font-extrabold text-[10px] tracking-tight text-white">ICICI</span>
          <span className="text-[6px] text-amber-200 font-semibold tracking-wider">BANK</span>
        </div>
      </div>
    );
  }

  if (id.includes('axis')) {
    return (
      <div
        className={`rounded-xl flex items-center justify-center font-bold shadow-xs bg-[#861F41] text-white shrink-0 relative ${sizeMap[size]} ${className}`}
        title="Axis Bank"
      >
        <svg viewBox="0 0 100 100" className="w-3/4 h-3/4">
          <polygon points="50,15 85,85 62,85 50,56 38,85 15,85" fill="#FFFFFF" />
          <polygon points="50,32 72,75 28,75" fill="#861F41" />
        </svg>
      </div>
    );
  }

  if (id.includes('kotak')) {
    return (
      <div
        className={`rounded-xl flex items-center justify-center font-bold shadow-xs bg-[#ED1C24] text-white shrink-0 relative ${sizeMap[size]} ${className}`}
        title="Kotak Mahindra Bank"
      >
        <div className="flex flex-col items-center leading-none">
          <span className="text-[13px] font-black tracking-tighter">∞</span>
          <span className="text-[7px] font-extrabold tracking-tight uppercase -mt-0.5">KOTAK</span>
        </div>
      </div>
    );
  }

  if (id.includes('pnb') || id.includes('punjab')) {
    return (
      <div
        className={`rounded-xl flex items-center justify-center font-bold shadow-xs bg-[#A20038] text-white shrink-0 relative ${sizeMap[size]} ${className}`}
        title="Punjab National Bank"
      >
        <div className="flex flex-col items-center leading-none">
          <span className="text-[9px] font-black text-[#FFD700] tracking-wider">PNB</span>
          <span className="text-[6px] text-white tracking-widest font-semibold uppercase">INDIA</span>
        </div>
      </div>
    );
  }

  // Fallback bank emblem
  return (
    <div
      className={`rounded-xl flex items-center justify-center font-bold shadow-xs bg-slate-700 text-white shrink-0 ${sizeMap[size]} ${className}`}
    >
      <span className="text-[9px] uppercase font-bold">{bankId.substring(0, 3)}</span>
    </div>
  );
};

export interface VerifiedBankLogoProps {
  bankId: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  isVerifying?: boolean;
  isVerified?: boolean;
}

export const VerifiedBankLogo: React.FC<VerifiedBankLogoProps> = ({
  bankId,
  size = 'lg',
  className = '',
  isVerifying = false,
  isVerified = false,
}) => {
  const badgeSizeClasses = {
    sm: 'w-4 h-4 -bottom-1 -right-1 border',
    md: 'w-5 h-5 -bottom-1 -right-1 border-1.5',
    lg: 'w-7 h-7 -bottom-1.5 -right-1.5 border-2',
    xl: 'w-8 h-8 -bottom-2 -right-2 border-2',
  };

  const iconSizes = {
    sm: 'w-2.5 h-2.5',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
    xl: 'w-4.5 h-4.5',
  };

  return (
    <div
      className={`relative inline-flex items-center justify-center transition-all duration-300 ${
        isVerified ? 'animate-bank-glow-success' : ''
      } ${className}`}
    >
      {/* Rotating blue scanning ring around logo when verifying */}
      {isVerifying && (
        <div className="absolute -inset-3 sm:-inset-3.5 rounded-2xl sm:rounded-3xl border-2 border-transparent border-t-fintech-primary border-r-fintech-primary/60 animate-scan-ring pointer-events-none" />
      )}

      {/* The main bank logo card */}
      <div
        className={`rounded-2xl flex items-center justify-center p-1.5 transition-all duration-300 ${
          isVerified
            ? 'ring-2 ring-emerald-500/50 bg-emerald-50/20'
            : isVerifying
            ? 'ring-2 ring-blue-300 bg-blue-50/30'
            : 'bg-white'
        }`}
      >
        <BankLogo bankId={bankId} size={size} />
      </div>

      {/* Green verification tick directly at the bottom-right corner of the logo */}
      {isVerified && (
        <div
          className={`absolute ${badgeSizeClasses[size]} rounded-full bg-[#16803C] text-white flex items-center justify-center shadow-md animate-fintech-pop border-white z-20`}
          title="Bank Account Verified"
        >
          <svg className={iconSizes[size]} viewBox="0 0 20 20" fill="none">
            <path
              d="M4.5 10.5 L8.5 14.5 L15.5 5.5"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="checkmark-check"
            />
          </svg>
        </div>
      )}
    </div>
  );
};

