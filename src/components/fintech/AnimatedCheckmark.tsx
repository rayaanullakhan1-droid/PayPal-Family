import React from 'react';

interface AnimatedCheckmarkProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'success' | 'error' | 'primary';
  className?: string;
}

export const AnimatedCheckmark: React.FC<AnimatedCheckmarkProps> = ({
  size = 'md',
  variant = 'success',
  className = '',
}) => {
  const sizeConfig = {
    sm: { box: 'w-10 h-10', svg: 40, stroke: 3, r: 18 },
    md: { box: 'w-14 h-14', svg: 56, stroke: 3.5, r: 25 },
    lg: { box: 'w-20 h-20', svg: 80, stroke: 4, r: 36 },
    xl: { box: 'w-24 h-24', svg: 96, stroke: 4.5, r: 44 },
  };

  const current = sizeConfig[size];

  if (variant === 'error') {
    return (
      <div className={`relative flex items-center justify-center animate-fintech-pop ${current.box} ${className}`}>
        <svg
          width={current.svg}
          height={current.svg}
          viewBox="0 0 60 60"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            cx="30"
            cy="30"
            r="26"
            stroke="#FEE2E2"
            strokeWidth="4"
            fill="#FEF2F2"
          />
          <circle
            cx="30"
            cy="30"
            r="26"
            stroke="#DC2626"
            strokeWidth="3.5"
            strokeLinecap="round"
            className="checkmark-circle"
          />
          <line
            x1="20"
            y1="20"
            x2="40"
            y2="40"
            stroke="#DC2626"
            strokeWidth="3.5"
            strokeLinecap="round"
            className="checkmark-check"
          />
          <line
            x1="40"
            y1="20"
            x2="20"
            y2="40"
            stroke="#DC2626"
            strokeWidth="3.5"
            strokeLinecap="round"
            className="checkmark-check"
          />
        </svg>
      </div>
    );
  }

  const strokeColor = variant === 'primary' ? '#0070E0' : '#16803C';
  const bgCircleColor = variant === 'primary' ? '#EFF6FF' : '#ECFDF5';
  const borderRingColor = variant === 'primary' ? '#BFDBFE' : '#A7F3D0';

  return (
    <div
      className={`relative flex items-center justify-center animate-fintech-pop ${
        variant === 'success' ? 'animate-fintech-pulse-green' : 'animate-fintech-pulse-ring'
      } rounded-full ${current.box} ${className}`}
    >
      <svg
        width={current.svg}
        height={current.svg}
        viewBox="0 0 60 60"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="30"
          cy="30"
          r="26"
          stroke={borderRingColor}
          strokeWidth="4"
          fill={bgCircleColor}
        />
        <circle
          cx="30"
          cy="30"
          r="26"
          stroke={strokeColor}
          strokeWidth="3.5"
          strokeLinecap="round"
          className="checkmark-circle"
        />
        <path
          d="M17 31 L26 39 L43 21"
          stroke={strokeColor}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="checkmark-check"
        />
      </svg>
    </div>
  );
};

