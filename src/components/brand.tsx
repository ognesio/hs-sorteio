import caos from '../assets/brand/caos.png'
import caosWhite from '../assets/brand/caos-white.png'
import cloud1 from '../assets/brand/cloud-1.webp'
import cloud2 from '../assets/brand/cloud-2.webp'
import cloud3 from '../assets/brand/cloud-3.webp'
import crew from '../assets/brand/crew.webp'
import logoBlack from '../assets/brand/logo-black.png'
import logoNeon from '../assets/brand/logo-neon.png'
import logoWhite from '../assets/brand/logo-white.png'
import napiteira from '../assets/brand/napiteira.webp'
import sparkle from '../assets/brand/sparkle.webp'
import vinyl from '../assets/brand/vinyl.webp'

export const brand = { crew, vinyl }

/** Logotipo oficial Sunset House (proporção original preservada) */
export function Logo({ tone = 'black', className = '' }: { tone?: 'black' | 'neon' | 'white'; className?: string }) {
  const src = tone === 'neon' ? logoNeon : tone === 'white' ? logoWhite : logoBlack
  return <img src={src} alt="Sunset House" className={`h-auto select-none ${className}`} draggable={false} width={680} height={229} />
}

const CLOUDS = [cloud1, cloud2, cloud3]
export function Cloud({ v = 0, className = '' }: { v?: 0 | 1 | 2; className?: string }) {
  return <img src={CLOUDS[v]} alt="" aria-hidden className={`pointer-events-none select-none ${className}`} draggable={false} />
}

export function Sparkle({ className = '', delay = 0 }: { className?: string; delay?: number }) {
  return (
    <img src={sparkle} alt="" aria-hidden draggable={false}
      className={`pointer-events-none select-none animate-twinkle ${className}`} style={{ animationDelay: `${delay}s` }} />
  )
}

/** Disco de vinil verde-amarelado translúcido, girando */
export function Vinyl({ className = '', speed = 'slow' }: { className?: string; speed?: 'slow' | 'mid' | 'off' }) {
  const anim = speed === 'off' ? '' : speed === 'mid' ? 'animate-spin-mid' : 'animate-spin-slow'
  return (
    <div className={`${/\b(absolute|fixed)\b/.test(className) ? '' : 'relative'} aspect-square ${className}`} aria-hidden>
      <img src={vinyl} alt="" draggable={false} className={`h-full w-full rounded-full ${anim}`} />
      <div className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,.35),transparent_45%)]" />
    </div>
  )
}

/** Raios de "brilho" do flyer */
export function Rays({ className = '', flip = false }: { className?: string; flip?: boolean }) {
  return (
    <svg viewBox="0 0 60 60" className={`animate-rays ${className}`} style={flip ? { transform: 'scaleX(-1)' } : undefined} aria-hidden>
      <g stroke="#111" strokeWidth="6" strokeLinecap="round">
        <line x1="8" y1="14" x2="22" y2="24" />
        <line x1="4" y1="34" x2="20" y2="34" />
        <line x1="8" y1="54" x2="22" y2="44" />
      </g>
    </svg>
  )
}

export function Sponsors({ tone = 'dark', className = '' }: { tone?: 'dark' | 'light'; className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-5 sm:gap-8 ${className}`}>
      <img src={tone === 'light' ? caosWhite : caos} alt="Caos" className="h-9 w-auto sm:h-11" width={600} height={219} />
      <span className={`h-9 w-[2px] ${tone === 'light' ? 'bg-white/40' : 'bg-ink/70'}`} aria-hidden />
      <img src={napiteira} alt="Napiteira" className="h-11 w-auto sm:h-14" width={760} height={253} />
    </div>
  )
}

export function Crew({ className = '' }: { className?: string }) {
  return <img src={crew} alt="Ilustração: amigos tocando discos de vinil no Sunset House" className={`h-auto select-none ${className}`} draggable={false} width={820} height={486} />
}
