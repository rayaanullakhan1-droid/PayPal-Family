import React, { useEffect, useState } from 'react';

interface AnimatedAmountCounterProps {
  targetRupees: number;
  durationMs?: number;
  prefix?: string;
  className?: string;
}

export const AnimatedAmountCounter: React.FC<AnimatedAmountCounterProps> = ({
  targetRupees,
  durationMs = 1200,
  prefix = '₹',
  className = '',
}) => {
  const [currentValue, setCurrentValue] = useState<number>(0);

  useEffect(() => {
    // Check prefers-reduced-motion
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setCurrentValue(targetRupees);
      return;
    }

    if (targetRupees <= 0) {
      setCurrentValue(0);
      return;
    }

    const startTime = performance.now();
    let animationFrameId: number;

    const updateCounter = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / durationMs, 1);

      // Ease out expo formula for smooth fintech deceleration
      const easeOut = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const nextValue = Math.round(targetRupees * easeOut);

      setCurrentValue(nextValue);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(updateCounter);
      }
    };

    animationFrameId = requestAnimationFrame(updateCounter);

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [targetRupees, durationMs]);

  const formatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(currentValue);

  return (
    <span className={`font-extrabold tracking-tight ${className}`}>
      {prefix}
      {formatted}
    </span>
  );
};

