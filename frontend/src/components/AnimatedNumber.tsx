import { useEffect, useRef, useState } from 'react';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  format?: (value: number) => string;
  prefix?: string;
  suffix?: string;
  className?: string;
  withDelay?: number;
}

const defaultFormat = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export function AnimatedNumber({
  value,
  duration = 800,
  format = defaultFormat,
  prefix = '',
  suffix = '',
  className = '',
  withDelay = 0,
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const previousValueRef = useRef(0);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Clear any existing animation/timeout
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    const startAnimation = () => {
      const startValue = previousValueRef.current;
      const diff = value - startValue;

      startTimeRef.current = null;

      const animateStep = (timestamp: number) => {
        if (startTimeRef.current === null) {
          startTimeRef.current = timestamp;
        }

        const elapsed = timestamp - startTimeRef.current;
        const progress = Math.min(elapsed / duration, 1);

        // Ease-out cubic for smooth deceleration
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = startValue + diff * eased;

        setDisplayValue(current);

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animateStep);
        } else {
          setDisplayValue(value);
          previousValueRef.current = value;
        }
      };

      animationRef.current = requestAnimationFrame(animateStep);
    };

    if (withDelay > 0) {
      timerRef.current = setTimeout(startAnimation, withDelay);
    } else {
      startAnimation();
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [value, duration, withDelay]);

  return (
    <span className={className}>
      {prefix}{format(displayValue)}{suffix}
    </span>
  );
}
