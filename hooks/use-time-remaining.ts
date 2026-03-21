'use client'

import { useState, useEffect } from 'react'
import { getTimeRemainingOrLabel, getSecondsRemaining } from '@/lib/store'

/**
 * Reusable countdown hook for bet/match timers.
 * Updates every second and returns both a display label and raw seconds
 * for urgency styling (e.g. orange timer when < 60s).
 *
 * Hydration-safe: initial value deferred to useEffect to avoid mismatch.
 */
export function useTimeRemaining(date?: Date | null, fallback = 'Waiting') {
  const [label, setLabel] = useState<string | null>(null)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)

  useEffect(() => {
    const update = () => {
      setLabel(getTimeRemainingOrLabel(date, fallback))
      setSecondsLeft(getSecondsRemaining(date))
    }

    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [date, fallback])

  return { label: label ?? fallback, secondsLeft }
}
