import { Check, Copy, MessageCircle, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Logo, Vinyl } from '../../components/brand'
import { Spinner, useToast } from '../../components/ui'
import { backend } from '../../lib/backend'
import { copyText, firstName } from '../../lib/format'
import { saveTicket } from '../../lib/ticketStore'
import type { Ticket } from '../../lib/types'

/** Número com efeito "roleta" ao aparecer pela primeira vez */
function RollingNumber({ value, animate }: { value: string; animate: boolean }) {
  const [shown, setShown] = useState(animate ? value.replace(/\d/g, '0') : value)
  useEffect(() => {
    if (!animate) return
    let frame = 0
    const total = 22
    const id = setInterval(() => {
      frame++
      const lock = Math.floor((frame / total) * value.length)
      setShown(value.split('').map((c, i) => (i < lock ? c : String(Math.floor(Math.random() * 10)))).join(''))
      if (frame >= total) { clearInterval(id); setShown(value) }
    }, 45)
    return () => clearInterval(id)
  }, [value, animate])
  return <span className="tabular-nums">{shown}</span>
}

export default function TicketCard({ ticket, fresh, onChange, onReset }: {
  ticket: Ticket; fresh: boolean; onChange: (t: Ticket) => void; onReset: () => void
}) {
  const toast = useToast()
  const [copied, setCopied] = useState(false)
  const [sending, setSending] = useState(false)
  const wa = ticket.whatsapp

  async function copy() {
    if (await copyText(ticket.number)) {
      setCopied(true)
      toast('Número copiado!')
      setTimeout(() => setCopied(false), 1800)
    }
  }

  async function requestWa() {
    setSending(true)
    try {
      const r = await backend.requestWhatsApp(ticket.id, ticket.receiptToken)
      const next: Ticket = { ...ticket, whatsapp: r.whatsapp ?? (r.ok ? ticket.whatsapp : 'falhou') }
      saveTicket(next)
      onChange(next)
      if (!r.ok && r.message) toast(r.message, 'error')
    } catch {
      toast('Sem conexão agora. Tente de novo em instantes.', 'error')
    } finally {
      setSending(false)
    }
  }

  const sent = wa === 'pendente' || wa === 'ja_enviado'

  return (
    <div className="mx-auto w-full max-w-md animate-rise">
      {/* Ingresso digital */}
      <div className="relative">
        <div className="absolute inset-0 translate-x-[6px] translate-y-[6px] rounded-[28px] bg-ink/90" aria-hidden />
        <article className="ticket-notch relative overflow-hidden rounded-[28px] bg-ink text-paper" style={{ ['--notch' as string]: 'calc(100% - 97px)' }}>
          <div className="grain relative px-6 pb-6 pt-6">
            <div className="flex items-center justify-between">
              <Logo tone="neon" className="w-[112px]" />
              <span className="rounded-full border-2 border-neon/80 px-2.5 py-0.5 font-display text-[11px] font-extrabold tracking-wider text-neon">15.11.2026</span>
            </div>

            <h2 className="display mt-6 text-[34px] text-neon">Você está na lista da sorte!</h2>
            <p className="mt-3 font-display text-lg font-bold">Olá, {firstName(ticket.name)}!</p>
            <p className="mt-1 text-[14px] leading-snug text-paper/75">Obrigado por participar do sorteio oficial do Sunset House.</p>

            <p className="mt-5 font-display text-[12px] font-extrabold uppercase tracking-[0.18em] text-paper/60">Seu número da sorte é:</p>
            <div className={`relative mt-2 overflow-hidden rounded-[22px] border-[2.5px] border-ink bg-sun px-4 py-3 text-center text-ink ${fresh ? 'animate-pop' : ''}`}>
              <Vinyl className="absolute -right-10 -top-10 w-32 opacity-40" speed="mid" />
              <div className="relative font-display text-[84px] font-black leading-none tracking-tight sm:text-[96px]" aria-live="polite">
                <RollingNumber value={ticket.number} animate={fresh} />
              </div>
            </div>
          </div>

          {/* picote */}
          <div className="mx-6 border-t-[2.5px] border-dashed border-paper/25" aria-hidden />

          <div className="flex items-center justify-between gap-4 px-6 py-5">
            <div>
              <p className="font-display text-[15px] font-extrabold uppercase leading-tight">Boa sorte e curta a festa!</p>
              <p className="mt-1 font-display text-[11px] font-extrabold uppercase tracking-[0.2em] text-neon">Sunset House</p>
            </div>
            <Vinyl className="w-14 shrink-0" />
          </div>
        </article>
      </div>

      {/* Ações */}
      <div className="mt-7 space-y-3">
        {!sent && wa !== 'nao_configurado' && (
          <div className="sticker p-4">
            <p className="font-display text-[15px] font-extrabold uppercase leading-tight">
              {wa === 'falhou' ? 'Não conseguimos enviar agora.' : 'Deseja receber seu número da sorte pelo WhatsApp?'}
            </p>
            <button onClick={requestWa} disabled={sending} className="btn btn-md btn-ink mt-3 w-full">
              {sending ? <Spinner /> : <MessageCircle className="h-5 w-5" strokeWidth={2.5} />}
              {wa === 'falhou' ? 'Tentar de novo' : 'Receber pelo WhatsApp'}
            </button>
            <p className="mt-2 text-[12px] leading-snug text-graphite-700">
              Ao tocar, você autoriza o envio de uma mensagem com seu número para {ticket.phoneMasked}.
            </p>
          </div>
        )}
        {sent && (
          <div className="flex items-start gap-3 rounded-2xl border-[2.5px] border-ink bg-paper p-4 text-[14px] leading-snug">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink text-sun"><Check className="h-4 w-4" strokeWidth={3} /></span>
            <span><b>Mensagem encaminhada ao WhatsApp</b> {ticket.phoneMasked}. Pode levar alguns instantes para chegar.</span>
          </div>
        )}
        {wa === 'nao_configurado' && (
          <div className="rounded-2xl border-[2.5px] border-ink bg-paper p-4 text-[14px] leading-snug">
            <b>Seu número já está garantido.</b> O envio automático pelo WhatsApp não está disponível neste momento — copie o número ou tire um print desta tela.
          </div>
        )}

        <button onClick={copy} className="btn btn-md btn-paper w-full">
          {copied ? <Check className="h-5 w-5" strokeWidth={3} /> : <Copy className="h-5 w-5" strokeWidth={2.5} />}
          {copied ? 'Copiado!' : 'Copiar meu número'}
        </button>

        <button onClick={onReset} className="mx-auto flex items-center gap-1.5 pt-2 text-[13px] font-semibold text-ink/70 underline underline-offset-4 hover:text-ink">
          <RotateCcw className="h-3.5 w-3.5" /> Cadastrar outra pessoa neste aparelho
        </button>
      </div>
    </div>
  )
}
