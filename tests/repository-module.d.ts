declare module '@/lib/server/repository' {
  export const loadAppState: (...args: any[]) => Promise<any>
  export const joinCrewAsGuest: (...args: any[]) => Promise<any>
  export const resetPublicAppData: (...args: any[]) => Promise<any>
  export const runExpirationSweep: (...args: any[]) => Promise<any>
  export const mutateAppState: (...args: any[]) => Promise<any>
}
