import { ArrowDown, Lock } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Cloud, Crew, Logo, Rays, Sparkle, Sponsors, Vinyl } from '../../components/brand'
import { Modal, Spinner } from '../../components/ui'
import { backend } from '../../lib/backend'
import { clearTicket, loadTicket } from '../../lib/ticketStore'
import type { PublicConfig, Ticket } from '../../lib/types'
import RegistrationForm from './RegistrationForm'
import TicketCard from './TicketCard'

export default function Home() {
  const [config, setConfig] = useState<PublicConfig | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [ticket, setTicket] = useState<Ticket | null>(() => loadTicket())
  const [fresh, setFresh] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const formRef = useRef<HTMLElement>(null)

  useEffect(() => {
    backend.getPublicConfig().then(setConfig).catch(() => setLoadError(true))
  }, [])

  const goForm = () => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  function onDone(t: Ticket) {
    setFresh(true)
    setTicket(t)
    requestAnimationFrame(goForm)
  }

  function reset() {
    setResetOpen(false)
    clearTicket()
    setTicket(null)
    setFresh(false)
  }

  const closed = config && !config.registrations_open

  return (
    <div className="relative min-h-dvh overflow-x-clip bg-sun">
      {/* HEADER */}
      <header className="relative z-10 px-5 pt-6 sm:pt-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center">
          <div className="flex items-center gap-1.5">
            <Rays className="w-7 sm:w-9" />
            <Logo className="w-[210px] sm:w-[270px]" />
            <Rays className="w-7 sm:w-9" flip />
          </div>
          <p className="mt-3 rounded-full border-2 border-ink px-3 py-1 font-display text-[11px] font-extrabold uppercase tracking-[0.16em] sm:text-xs">
            15/11 · 15:00 · Rua Alfredo Shammas, 21
          </p>
        </div>
      </header>

      {/* HERO */}
      <section className="relative z-[1] px-5 pb-8 pt-8 sm:pt-12">
        <div className="mx-auto grid max-w-6xl items-center gap-6 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
          <div className="text-center lg:text-left">
            <h1 className="display text-[clamp(52px,15vw,104px)] !leading-[1] animate-rise">
              Sua sorte<br />começa<br className="lg:hidden" /> aqui.
            </h1>
            <p className="mx-auto mt-5 max-w-md text-[17px] font-medium leading-snug lg:mx-0 lg:text-lg animate-rise [animation-delay:.08s]">
              Participe do sorteio oficial do Sunset House, garanta seu número da sorte e aproveite a festa!
            </p>
            <div className="mt-7 animate-rise [animation-delay:.16s]">
              <button onClick={goForm} className="btn btn-lg btn-ink w-full max-w-sm px-8 sm:w-auto">
                {ticket ? 'Ver meu número' : 'Quero participar'} <ArrowDown className="h-5 w-5" strokeWidth={3} />
              </button>
            </div>
          </div>

          {/* Composição: vinil + galera + nuvens */}
          <div className="relative mx-auto aspect-[1/0.92] w-full max-w-[520px]" aria-hidden>
            <Vinyl className="absolute right-[-6%] top-[-2%] w-[78%] drop-shadow-[0_18px_24px_rgba(0,0,0,.18)]" />
            <Cloud v={0} className="absolute left-[-4%] top-[4%] w-[30%] animate-drift" />
            <Cloud v={2} className="absolute right-[-2%] bottom-[30%] w-[26%] animate-drift-slow" />
            <Sparkle className="absolute left-[34%] top-[0%] w-[9%]" />
            <Sparkle className="absolute right-[4%] bottom-[8%] w-[7%]" delay={1.1} />
            <Crew className="absolute bottom-0 left-[-3%] w-[92%]" />
          </div>
        </div>
      </section>

      {/* PARTICIPAR */}
      <section ref={formRef} id="participar" className="relative z-[2] scroll-mt-4 px-5 pb-14 pt-4">
        <Cloud v={1} className="absolute -left-10 top-24 hidden w-56 animate-drift-slow md:block" />
        <Sparkle className="absolute right-[12%] top-6 hidden w-12 md:block" delay={0.6} />
        <div className="mx-auto max-w-md">
          {!config && !loadError && !ticket && (
            <div className="sticker flex items-center justify-center gap-3 p-10 font-display font-bold"><Spinner /> Carregando…</div>
          )}
          {loadError && !ticket && (
            <div className="sticker p-6 text-center">
              <p className="display text-2xl">Ops! Sem conexão.</p>
              <p className="mt-2 text-sm">Verifique sua internet e recarregue a página.</p>
              <button className="btn btn-md btn-ink mt-4" onClick={() => location.reload()}>Recarregar</button>
            </div>
          )}

          {ticket ? (
            <TicketCard ticket={ticket} fresh={fresh} onChange={setTicket} onReset={() => setResetOpen(true)} />
          ) : closed ? (
            <div className="sticker relative overflow-hidden p-7 text-center animate-rise">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-ink text-sun"><Lock className="h-5 w-5" /></span>
              <h2 className="display mt-4 text-[40px]">Inscrições encerradas</h2>
              <p className="mt-3 font-medium leading-snug">
                {config?.closed_reason === 'full' ? 'Atingimos o limite de participantes. ' : ''}Obrigado por participar do sorteio oficial do Sunset House!
              </p>
            </div>
          ) : config ? (
            <div className="sticker p-5 sm:p-7 animate-rise">
              <div className="mb-5">
                <p className="font-display text-[12px] font-extrabold uppercase tracking-[0.18em] text-graphite-500">Cadastro rápido · 30s</p>
                <h2 className="display mt-1 text-[34px]">Garanta seu número</h2>
              </div>
              <RegistrationForm onDone={onDone} />
            </div>
          ) : null}
        </div>
      </section>

      {/* PRÊMIOS */}
      {config && config.prizes.length > 0 && (
        <section className="relative z-[1] bg-ink px-5 py-14 text-paper">
          <div className="mx-auto max-w-4xl">
            <div className="flex items-center justify-center gap-2">
              <Rays className="w-6 invert" />
              <h2 className="display text-center text-[40px] text-neon sm:text-5xl">Prêmios da noite</h2>
              <Rays className="w-6 invert" flip />
            </div>
            <ol className="mt-8 grid gap-3 sm:grid-cols-2">
              {config.prizes.map((p) => (
                <li key={p.round} className="flex items-center gap-4 rounded-[22px] border-2 border-paper/15 bg-graphite px-5 py-4">
                  <span className="font-display text-[44px] font-black leading-none text-neon">{p.round}º</span>
                  <span>
                    <span className="block font-display text-[11px] font-extrabold uppercase tracking-[0.18em] text-paper/50">Sorteio</span>
                    <span className="block font-display text-lg font-extrabold uppercase leading-tight">{p.title}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      <Modal open={resetOpen} onClose={() => setResetOpen(false)} title="Cadastrar outra pessoa?">
        <p className="text-[15px]">Seu número <b>{ticket?.number}</b> continua garantido no sorteio. Anote ou copie antes de continuar — esta tela vai abrir o formulário em branco.</p>
        <button className="btn btn-md btn-ink mt-5 w-full" onClick={reset}>Abrir formulário</button>
      </Modal>

      {/* RODAPÉ */}
      <footer className="relative z-[1] px-5 pb-10 pt-12">
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-display text-[12px] font-extrabold uppercase tracking-[0.22em]">Sorteio patrocinado por</p>
          <Sponsors className="mt-5" />
          <nav className="mt-10 flex justify-center gap-5 text-[13px] font-semibold underline underline-offset-4">
            <Link to="/regulamento">Regulamento</Link>
            <Link to="/privacidade">Privacidade</Link>
          </nav>
          <p className="mt-4 text-[12px] text-ink/60">© 2026 Sunset House</p>
        </div>
      </footer>
    </div>
  )
}
