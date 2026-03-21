'use client'

import { Bomb, ChevronRight, Clock3, Swords } from 'lucide-react'
import { useCurrentUser } from '@/lib/current-user'
import { formatDrinks, getTimeRemainingOrLabel, type Night } from '@/lib/store'

interface PendingInviteBannersProps {
  night: Night
  onSelectBet: (betId: string) => void
  onSelectBeerBombMatch: (matchId: string) => void
  onBetOfferAccept: (betId: string) => Promise<void> | void
  onBetOfferDecline: (betId: string) => Promise<void> | void
  onBeerBombAccept: (matchId: string) => Promise<void> | void
  onBeerBombDecline: (matchId: string) => Promise<void> | void
}

export function PendingInviteBanners({
  night,
  onSelectBet,
  onSelectBeerBombMatch,
  onBetOfferAccept,
  onBetOfferDecline,
  onBeerBombAccept,
  onBeerBombDecline,
}: PendingInviteBannersProps) {
  const currentUser = useCurrentUser()
  const currentMembershipId = currentUser.membershipId ?? currentUser.id

  const actionableBetOffers = night.bets
    .filter((bet) => bet.type === 'h2h' && bet.status === 'pending_accept' && bet.challenger?.membershipId === currentMembershipId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  const sentBetOffers = night.bets
    .filter((bet) => bet.type === 'h2h' && bet.status === 'pending_accept' && bet.creator.membershipId === currentMembershipId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  const actionableMiniGameMatches = night.miniGameMatches
    .filter((match) => match.status === 'pending' && match.opponent.membershipId === currentMembershipId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  const sentMiniGameMatches = night.miniGameMatches
    .filter((match) => match.status === 'pending' && match.challenger.membershipId === currentMembershipId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  if (
    actionableBetOffers.length === 0 &&
    actionableMiniGameMatches.length === 0 &&
    sentBetOffers.length === 0 &&
    sentMiniGameMatches.length === 0
  ) {
    return null
  }

  return (
    <section className="space-y-3 px-4">
      {actionableBetOffers.map((bet) => (
        <div key={bet.id} className="rounded-2xl border-2 border-primary/40 bg-primary/10 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.24em] text-primary">
                <Swords className="h-3.5 w-3.5" />
                Bet offer
              </p>
              <h2 className="mt-2 text-lg font-black text-card-foreground">{bet.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {bet.creator.name} wants to go head-to-head for {formatDrinks(bet.challengeWager ?? 0)} drinks.
              </p>
            </div>
            <div className="rounded-full border border-primary/30 bg-background/70 px-3 py-1 text-xs font-semibold text-card-foreground">
              {formatDrinks(bet.challengeWager ?? 0)}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5 text-primary" />
            <span>{getTimeRemainingOrLabel(bet.respondByAt, 'Waiting')}</span>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => onBetOfferAccept(bet.id)}
              className="flex-1 rounded-xl border-2 border-border bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition-all active:translate-y-[1px]"
            >
              Accept & place {formatDrinks(bet.challengeWager ?? 0)}
            </button>
            <button
              onClick={() => onBetOfferDecline(bet.id)}
              className="rounded-xl border-2 border-border bg-card px-4 py-3 text-sm font-bold text-card-foreground transition-colors hover:bg-surface"
            >
              Decline
            </button>
          </div>
        </div>
      ))}

      {actionableMiniGameMatches.map((match) => (
        <div key={match.id} className="rounded-2xl border-2 border-primary/40 bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.24em] text-primary">
                <Bomb className="h-3.5 w-3.5" />
                Game invite
              </p>
              <h2 className="mt-2 text-lg font-black text-card-foreground">{match.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {match.challenger.name} challenged you for {formatDrinks(match.proposedWager)} drinks.
              </p>
            </div>
            <div className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              {formatDrinks(match.proposedWager)}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5 text-primary" />
            <span>{getTimeRemainingOrLabel(match.respondByAt, 'Waiting')}</span>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => onBeerBombAccept(match.id)}
              className="flex-1 rounded-xl border-2 border-border bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition-all active:translate-y-[1px]"
            >
              Accept & play for {formatDrinks(match.proposedWager)}
            </button>
            <button
              onClick={() => onBeerBombDecline(match.id)}
              className="rounded-xl border-2 border-border bg-card px-4 py-3 text-sm font-bold text-card-foreground transition-colors hover:bg-surface"
            >
              Decline
            </button>
          </div>
        </div>
      ))}

      {sentBetOffers.map((bet) => (
        <button
          key={bet.id}
          onClick={() => onSelectBet(bet.id)}
          className="w-full rounded-2xl border-2 border-border bg-card p-4 text-left transition-all active:scale-[0.99]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.24em] text-muted-foreground">
                <Swords className="h-3.5 w-3.5 text-primary" />
                Pending bet invite
              </p>
              <h2 className="mt-2 text-base font-black text-card-foreground">{bet.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Waiting for {bet.challenger?.name ?? 'your opponent'} to accept {formatDrinks(bet.challengeWager ?? 0)} drinks.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-right">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Pending</p>
                <p className="mt-1 text-xs text-muted-foreground">{getTimeRemainingOrLabel(bet.respondByAt, 'Waiting')}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </button>
      ))}

      {sentMiniGameMatches.map((match) => (
        <button
          key={match.id}
          onClick={() => onSelectBeerBombMatch(match.id)}
          className="w-full rounded-2xl border-2 border-border bg-card p-4 text-left transition-all active:scale-[0.99]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.24em] text-muted-foreground">
                <Bomb className="h-3.5 w-3.5 text-primary" />
                Pending invite
              </p>
              <h2 className="mt-2 text-base font-black text-card-foreground">{match.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Waiting for {match.opponent.name} to accept your {formatDrinks(match.proposedWager)} Beer Bomb challenge.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-right">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Pending</p>
                <p className="mt-1 text-xs text-muted-foreground">{getTimeRemainingOrLabel(match.respondByAt, 'Waiting')}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </button>
      ))}
    </section>
  )
}
