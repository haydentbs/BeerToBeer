import { describe, expect, it } from 'vitest'
import { buildGuestSession } from '@/lib/auth'

describe('auth helpers', () => {
  it('builds a guest session with a stable guest id', () => {
    const session = buildGuestSession('Sam Carter')
    expect(session.isGuest).toBe(true)
    expect(session.user.id).toContain('guest-sam-carter')
    expect(session.user.initials).toBe('SC')
  })
})
