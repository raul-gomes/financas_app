import { cn } from '@/lib/utils';

/** Product name shown in the wordmark and used as the accessible label. */
export const BRAND_NAME = 'Placo';

type LogoSize = 'sm' | 'md' | 'lg';

/** Tailwind classes per size: mark box and wordmark font. */
const SIZE_CLASSES: Record<LogoSize, { mark: string; word: string }> = {
  sm: { mark: 'h-6 w-6', word: 'text-lg' },
  md: { mark: 'h-8 w-8', word: 'text-2xl' },
  lg: { mark: 'h-12 w-12', word: 'text-3xl' },
};

interface LogoProps {
  /** Mark size; the wordmark scales with it. */
  size?: LogoSize;
  /** Render the "Placo" wordmark next to the mark. */
  showWordmark?: boolean;
  className?: string;
}

/**
 * Placo logo: a rounded-square monogram "P" with two ascending bars
 * (finance hint). Colors come from the design tokens, so it follows the
 * light/dark theme: the square uses `primary`, the glyph `primary-foreground`.
 *
 * With the wordmark visible the mark is decorative (the text names the
 * product); without it the SVG carries the accessible name.
 */
export function Logo({ size = 'md', showWordmark = true, className }: LogoProps) {
  const sizes = SIZE_CLASSES[size];
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <svg
        viewBox="0 0 64 64"
        className={cn('shrink-0 text-primary', sizes.mark)}
        {...(showWordmark
          ? { 'aria-hidden': true, focusable: false }
          : { role: 'img', 'aria-label': BRAND_NAME })}
      >
        <rect width="64" height="64" rx="16" fill="currentColor" />
        <g transform="translate(-2.5 0)" className="fill-primary-foreground">
          <path
            d="M22 50V16h12a10 10 0 0 1 0 20H22"
            fill="none"
            strokeWidth="8"
            strokeLinejoin="round"
            strokeLinecap="round"
            className="stroke-primary-foreground"
          />
          <rect x="36" y="44" width="6" height="8" rx="2" />
          <rect x="45" y="40" width="6" height="12" rx="2" />
        </g>
      </svg>
      {showWordmark && (
        <span className={cn('font-bold leading-none tracking-tight text-foreground', sizes.word)}>
          {BRAND_NAME}
        </span>
      )}
    </span>
  );
}
