import {
  Space_Grotesk,
  Archivo_Black,
  Syne,
  Bebas_Neue,
  Rubik,
  Anton,
  Unbounded,
  Lexend,
  Oswald,
  Staatliches,
  Righteous,
  Bungee,
  Bungee_Inline,
  Bungee_Shade,
  Bowlby_One,
  Titan_One,
  Luckiest_Guy,
  Bangers,
  Rubik_Mono_One,
  Black_Ops_One,
  Orbitron,
  Outfit,
} from 'next/font/google'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
})
const archivoBlack = Archivo_Black({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-archivo-black',
})
const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
})
const bebasNeue = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bebas-neue',
})
const rubik = Rubik({
  subsets: ['latin'],
  variable: '--font-rubik',
})
const anton = Anton({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-anton',
})
const unbounded = Unbounded({
  subsets: ['latin'],
  variable: '--font-unbounded',
})
const lexend = Lexend({
  subsets: ['latin'],
  variable: '--font-lexend',
})
const oswald = Oswald({
  weight: ['400', '600', '700'],
  subsets: ['latin'],
  variable: '--font-oswald',
})
const staatliches = Staatliches({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-staatliches',
})
const righteous = Righteous({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-righteous',
})
const blackOpsOne = Black_Ops_One({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-black-ops-one',
})
const orbitron = Orbitron({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-orbitron',
})
const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
})
const bungee = Bungee({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bungee',
})
const bungeeInline = Bungee_Inline({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bungee-inline',
})
const bungeeShade = Bungee_Shade({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bungee-shade',
})
const bowlbyOne = Bowlby_One({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bowlby-one',
})
const titanOne = Titan_One({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-titan-one',
})
const luckiestGuy = Luckiest_Guy({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-luckiest-guy',
})
const bangers = Bangers({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bangers',
})
const rubikMonoOne = Rubik_Mono_One({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-rubik-mono-one',
})

const fontVars = [
  spaceGrotesk.variable,
  archivoBlack.variable,
  syne.variable,
  bebasNeue.variable,
  rubik.variable,
  anton.variable,
  unbounded.variable,
  lexend.variable,
  oswald.variable,
  staatliches.variable,
  righteous.variable,
  blackOpsOne.variable,
  orbitron.variable,
  outfit.variable,
  bungee.variable,
  bungeeInline.variable,
  bungeeShade.variable,
  bowlbyOne.variable,
  titanOne.variable,
  luckiestGuy.variable,
  bangers.variable,
  rubikMonoOne.variable,
].join(' ')

/** Supplies CSS variables for alternate sans families; only this route loads these fonts. */
export default function FontPreviewLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className={fontVars}>{children}</div>
}
