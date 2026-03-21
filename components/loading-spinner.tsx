'use client'

import { cn } from '@/lib/utils'

/**
 * Spinning beer bottle loading animation.
 * Bottle spins flat on its side like spin-the-bottle.
 */
export function LoadingSpinner({
  message = 'Checking your tab…',
  submessage,
  className,
}: {
  message?: string
  submessage?: string
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-6', className)}>
      {/* Bottle container */}
      <div className="relative h-24 w-24 flex items-center justify-center">
        {/* Shadow underneath */}
        <div className="absolute bottom-2 h-3 w-14 rounded-full bg-foreground/8 blur-sm animate-pulse" />

        {/* Spinning bottle */}
        <div className="animate-bottle-spin">
          <svg
            width="72"
            height="72"
            viewBox="0 0 72 72"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="drop-shadow-md"
          >
            {/* Cap (left) */}
            <rect x="2" y="31" width="7" height="10" rx="2" className="fill-primary" />
            {/* Neck */}
            <rect x="8" y="32" width="14" height="8" rx="2" className="fill-primary/80" />
            {/* Neck-to-body taper */}
            <path d="M22 32 L26 26 L26 46 L22 40 Z" className="fill-primary/75" />
            {/* Main body */}
            <rect x="26" y="24" width="30" height="24" rx="4" className="fill-primary/80" />
            {/* Label */}
            <rect x="30" y="29" width="22" height="14" rx="2" className="fill-card/50" />
            {/* Label detail lines */}
            <rect x="33" y="32" width="16" height="2" rx="1" className="fill-primary/40" />
            <rect x="35" y="36" width="12" height="1.5" rx="0.75" className="fill-primary/25" />
            {/* Body highlight */}
            <rect x="27" y="25.5" width="28" height="3" rx="1.5" className="fill-card/15" />
            {/* Bottom curve (right) */}
            <rect x="54" y="26" width="12" height="20" rx="6" className="fill-primary/70" />
            {/* Bottom highlight */}
            <rect x="55" y="27.5" width="10" height="3" rx="1.5" className="fill-card/10" />
          </svg>
        </div>
      </div>

      {/* Text */}
      <div className="text-center space-y-1.5">
        <h2 className="font-display text-xl text-foreground tracking-wide">{message}</h2>
        {submessage && (
          <p className="text-sm text-muted-foreground">{submessage}</p>
        )}
      </div>
    </div>
  )
}
