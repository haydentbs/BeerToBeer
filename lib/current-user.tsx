'use client'

import { createContext, useContext } from 'react'
import type { User } from '@/lib/store'

const CurrentUserContext = createContext<User | null>(null)

export function CurrentUserProvider({
  user,
  children,
}: {
  user: User
  children: React.ReactNode
}) {
  return (
    <CurrentUserContext.Provider value={user}>
      {children}
    </CurrentUserContext.Provider>
  )
}

export function useCurrentUser() {
  const user = useContext(CurrentUserContext)
  if (!user) {
    throw new Error('useCurrentUser must be used inside CurrentUserProvider')
  }

  return user
}
