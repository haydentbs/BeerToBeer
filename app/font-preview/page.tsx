import type { CSSProperties } from 'react'
import { Beer, Users } from 'lucide-react'

/** Ordered list: screenshot as `font-preview-${String(i+1).padStart(2,'0')}-${id}.png` */
export const FONTS: FontPreviewEntry[] = [
  { id: 'space-grotesk', label: 'Space Grotesk (reference)', cssVar: 'var(--font-space-grotesk)' },
  { id: 'archivo-black', label: 'Archivo Black', cssVar: 'var(--font-archivo-black)' },
  { id: 'syne', label: 'Syne', cssVar: 'var(--font-syne)' },
  { id: 'bebas-neue', label: 'Bebas Neue', cssVar: 'var(--font-bebas-neue)' },
  { id: 'rubik', label: 'Rubik', cssVar: 'var(--font-rubik)' },
  { id: 'anton', label: 'Anton', cssVar: 'var(--font-anton)' },
  { id: 'unbounded', label: 'Unbounded', cssVar: 'var(--font-unbounded)' },
  { id: 'lexend', label: 'Lexend', cssVar: 'var(--font-lexend)' },
  { id: 'oswald', label: 'Oswald', cssVar: 'var(--font-oswald)' },
  { id: 'staatliches', label: 'Staatliches', cssVar: 'var(--font-staatliches)' },
  { id: 'righteous', label: 'Righteous', cssVar: 'var(--font-righteous)' },
  { id: 'black-ops-one', label: 'Black Ops One', cssVar: 'var(--font-black-ops-one)' },
  { id: 'orbitron', label: 'Orbitron', cssVar: 'var(--font-orbitron)' },
  { id: 'outfit', label: 'Outfit', cssVar: 'var(--font-outfit)' },
  /* Bungee-adjacent: chunky / poster / rounded display */
  { id: 'bungee', label: 'Bungee', cssVar: 'var(--font-bungee)' },
  { id: 'bungee-inline', label: 'Bungee Inline', cssVar: 'var(--font-bungee-inline)' },
  { id: 'bungee-shade', label: 'Bungee Shade', cssVar: 'var(--font-bungee-shade)' },
  { id: 'bowlby-one', label: 'Bowlby One', cssVar: 'var(--font-bowlby-one)' },
  { id: 'titan-one', label: 'Titan One', cssVar: 'var(--font-titan-one)' },
  { id: 'luckiest-guy', label: 'Luckiest Guy', cssVar: 'var(--font-luckiest-guy)' },
  { id: 'bangers', label: 'Bangers', cssVar: 'var(--font-bangers)' },
  { id: 'rubik-mono-one', label: 'Rubik Mono One', cssVar: 'var(--font-rubik-mono-one)' },
  {
    id: 'bungee-lexend',
    label: 'Bungee + Lexend',
    primaryFont: 'var(--font-bungee)',
    secondaryFont: 'var(--font-lexend)',
  },
  /* System stack */
  {
    id: 'impact-georgia',
    label: 'Impact + Georgia (system)',
    primaryFont: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif',
    secondaryFont: 'Georgia, "Times New Roman", Times, serif',
  },
  /* Matches BeerScore-Hackathon.pptx: Arial (labels), Impact (hero), Georgia italic (body) */
  {
    id: 'pptx-hackathon',
    label: 'BeerScore-Hackathon.pptx (Arial / Impact / Georgia)',
    kind: 'pptx-hackathon',
  },
]

/** System stacks from the deck (slide 1: THE·Arial, BEERSCORE·Impact, taglines·Georgia italic; slide 2: Arial + Georgia). */
const PPTX_ARIAL = 'Arial, Helvetica, sans-serif'
const PPTX_IMPACT = 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif'
const PPTX_GEORGIA = 'Georgia, "Times New Roman", Times, serif'

export type FontPreviewEntry =
  | { id: string; label: string; cssVar: string }
  | { id: string; label: string; primaryFont: string; secondaryFont: string }
  | { id: string; label: string; kind: 'pptx-hackathon' }

export function fontPreviewFilename(index: number, id: string): string {
  return `font-preview-${String(index + 1).padStart(2, '0')}-${id}.png`
}

function georgiaSecondaryStyle(secondaryFont: string): CSSProperties {
  const base: CSSProperties = { fontFamily: secondaryFont }
  if (secondaryFont.includes('Georgia')) {
    base.fontWeight = 700
  }
  return base
}

function FontSample({ entry }: { entry: FontPreviewEntry }) {
  if ('kind' in entry && entry.kind === 'pptx-hackathon') {
    return <PptxHackathonSample label={entry.label} />
  }

  if ('cssVar' in entry) {
    return (
      <section className="border-b-3 border-border bg-background px-6 py-10" style={{ fontFamily: entry.cssVar }}>
        <FontSampleInner label={entry.label} />
      </section>
    )
  }

  if (!('primaryFont' in entry)) {
    return null
  }

  const { primaryFont, secondaryFont, label } = entry
  const secondary = georgiaSecondaryStyle(secondaryFont)

  return (
    <section className="border-b-3 border-border bg-background px-6 py-10">
      <p
        className="mb-6 text-xs font-bold uppercase tracking-widest text-muted-foreground"
        style={secondary}
      >
        {label}
      </p>

      <div className="mx-auto flex max-w-sm flex-col items-center">
        <div className="relative mb-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-3 border-border bg-primary shadow-brutal">
            <Beer className="h-10 w-10 text-primary-foreground" />
          </div>
        </div>

        <h1 className="mb-1 text-center text-3xl font-bold text-foreground" style={{ fontFamily: primaryFont }}>
          BeerScore
        </h1>
        <p className="mb-8 max-w-xs text-center text-base text-muted-foreground" style={secondary}>
          Jump in as a guest with a cookie-backed session, or continue with Google for a saved account.
        </p>

        <div
          className="mb-5 w-full max-w-xs rounded-2xl border-2 border-primary/30 bg-primary/10 px-4 py-3 text-sm text-foreground"
          style={secondary}
        >
          Preview typography — bets, ledger, and crew names use this family.
        </div>

        <div className="mb-4 w-full max-w-xs rounded-2xl border-3 border-border bg-card p-4 text-card-foreground shadow-brutal-sm">
          <p className="mb-1 text-sm font-bold" style={{ fontFamily: primaryFont }}>
            Tonight&apos;s tab
          </p>
          <p className="text-sm text-muted-foreground" style={secondary}>
            Net position: +2 drinks · 3 open bets
          </p>
        </div>

        <div className="flex w-full max-w-xs flex-col gap-3">
          <button
            type="button"
            className="rounded-xl border-2 border-border bg-primary px-5 py-3 font-display font-normal text-primary-foreground shadow-brutal-sm"
            style={{ fontFamily: primaryFont }}
          >
            Start tonight&apos;s tab
          </button>
          <button
            type="button"
            className="flex items-center justify-center gap-2 rounded-xl border-2 border-border bg-card px-5 py-3 font-bold text-card-foreground shadow-brutal-sm"
            style={{ fontFamily: primaryFont }}
          >
            <Users className="h-5 w-5" />
            Join with crew code
          </button>
        </div>
      </div>
    </section>
  )
}

function PptxHackathonSample({ label }: { label: string }) {
  const georgiaBody = {
    fontFamily: PPTX_GEORGIA,
    fontStyle: 'italic' as const,
    fontWeight: 700 as const,
  }

  return (
    <section className="border-b-3 border-border bg-background px-6 py-10">
      <p
        className="mb-6 text-xs font-bold uppercase tracking-widest text-muted-foreground"
        style={{ fontFamily: PPTX_ARIAL }}
      >
        {label}
      </p>

      <div className="mx-auto flex max-w-sm flex-col items-center">
        <div className="relative mb-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-3 border-border bg-primary shadow-brutal">
            <Beer className="h-10 w-10 text-primary-foreground" />
          </div>
        </div>

        <p
          className="mb-1 text-center text-sm font-bold tracking-[0.35em] text-muted-foreground"
          style={{ fontFamily: PPTX_ARIAL }}
        >
          THE
        </p>

        <h1
          className="mb-2 text-center text-4xl font-bold uppercase leading-none tracking-tight text-foreground"
          style={{ fontFamily: PPTX_IMPACT }}
        >
          BeerScore
        </h1>

        <p className="mb-8 max-w-xs text-center text-base text-muted-foreground" style={georgiaBody}>
          The betting app where the stakes are real drinks.
        </p>

        <div
          className="mb-5 w-full max-w-xs rounded-2xl border-2 border-primary/30 bg-primary/10 px-4 py-3 text-sm text-foreground"
          style={georgiaBody}
        >
          Preview typography — bets, ledger, and crew names follow this deck mix.
        </div>

        <div className="mb-4 w-full max-w-xs rounded-2xl border-3 border-border bg-card p-4 text-card-foreground shadow-brutal-sm">
          <p className="mb-1 text-sm font-bold" style={{ fontFamily: PPTX_ARIAL }}>
            Tonight&apos;s tab
          </p>
          <p className="text-sm text-muted-foreground" style={georgiaBody}>
            Net position: +2 drinks · 3 open bets
          </p>
        </div>

        <div className="flex w-full max-w-xs flex-col gap-3">
          <button
            type="button"
            className="rounded-xl border-2 border-border bg-primary px-5 py-3 font-display font-normal text-primary-foreground shadow-brutal-sm"
            style={{ fontFamily: PPTX_ARIAL }}
          >
            Start tonight&apos;s tab
          </button>
          <button
            type="button"
            className="flex items-center justify-center gap-2 rounded-xl border-2 border-border bg-card px-5 py-3 font-bold text-card-foreground shadow-brutal-sm"
            style={{ fontFamily: PPTX_ARIAL }}
          >
            <Users className="h-5 w-5" />
            Join with crew code
          </button>
        </div>
      </div>
    </section>
  )
}

function FontSampleInner({ label }: { label: string }) {
  return (
    <>
      <p className="mb-6 text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</p>

      <div className="mx-auto flex max-w-sm flex-col items-center">
        <div className="relative mb-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-3 border-border bg-primary shadow-brutal">
            <Beer className="h-10 w-10 text-primary-foreground" />
          </div>
        </div>

        <h1 className="mb-1 text-center text-3xl font-bold text-foreground">BeerScore</h1>
        <p className="mb-8 max-w-xs text-center text-base text-muted-foreground">
          Jump in as a guest with a cookie-backed session, or continue with Google for a saved account.
        </p>

        <div className="mb-5 w-full max-w-xs rounded-2xl border-2 border-primary/30 bg-primary/10 px-4 py-3 text-sm text-foreground">
          Preview typography — bets, ledger, and crew names use this family.
        </div>

        <div className="mb-4 w-full max-w-xs rounded-2xl border-3 border-border bg-card p-4 text-card-foreground shadow-brutal-sm">
          <p className="mb-1 text-sm font-bold">Tonight&apos;s tab</p>
          <p className="text-sm text-muted-foreground">Net position: +2 drinks · 3 open bets</p>
        </div>

        <div className="flex w-full max-w-xs flex-col gap-3">
          <button
            type="button"
            className="rounded-xl border-2 border-border bg-primary px-5 py-3 font-display font-normal text-primary-foreground shadow-brutal-sm"
          >
            Start tonight&apos;s tab
          </button>
          <button
            type="button"
            className="flex items-center justify-center gap-2 rounded-xl border-2 border-border bg-card px-5 py-3 font-bold text-card-foreground shadow-brutal-sm"
          >
            <Users className="h-5 w-5" />
            Join with crew code
          </button>
        </div>
      </div>
    </>
  )
}

interface FontPreviewPageProps {
  searchParams?: Promise<{ id?: string }>
}

export default async function FontPreviewPage({ searchParams }: FontPreviewPageProps) {
  const params = await searchParams
  const onlyId = params?.id
  const list = onlyId ? FONTS.filter((f) => f.id === onlyId) : FONTS

  return (
    <main className="min-h-screen bg-background">
      {!onlyId && (
        <div className="sticky top-0 z-10 border-b-3 border-border bg-surface-elevated px-6 py-4">
          <h1 className="text-lg font-bold text-foreground">Neobrutalist font preview</h1>
          <p className="text-sm text-muted-foreground">
            Same UI chrome; font changes per section. Append{' '}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">?id=bungee-inline</code> for a single view.
            Screenshots: <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">font-preview-01-space-grotesk.png</code>{' '}
            … ordered by the list in <code className="font-mono text-xs">page.tsx</code>.
          </p>
        </div>
      )}
      {list.map((f) => (
        <FontSample key={f.id} entry={f} />
      ))}
    </main>
  )
}
