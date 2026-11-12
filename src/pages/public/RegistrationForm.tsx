import { AlertCircle, ArrowRight } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Checkbox, Spinner } from '../../components/ui'
import { backend, TURNSTILE_SITE_KEY } from '../../lib/backend'
import { maskPhone, validateEmail, validateName, validatePhone } from '../../lib/format'
import { saveTicket } from '../../lib/ticketStore'
import type { Ticket } from '../../lib/types'

type Errors = Partial<Record<'name' | 'phone' | 'email' | 'privacyConsent', string>>

export default function RegistrationForm({ onDone }: { onDone: (t: Ticket) => void }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [privacy, setPrivacy] = useState(false)
  const [wa, setWa] = useState(false)
  const [website, setWebsite] = useState('') // honeypot
  const [errors, setErrors] = useState<Errors>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState('')
  const startedAt = useRef(Date.now())
  const inflight = useRef(false)

  const validate = (): Errors => ({
    name: validateName(name) ?? undefined,
    phone: validatePhone(phone) ?? undefined,
    email: validateEmail(email) ?? undefined,
    privacyConsent: privacy ? undefined : 'Aceite o regulamento e a política de privacidade para participar.',
  })

  useEffect(() => {
    const v = validate()
    setErrors((prev) => {
      const next: Errors = {}
      for (const k of Object.keys(v) as (keyof Errors)[]) if (touched[k] || prev[k]) next[k] = v[k]
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, phone, email, privacy, touched])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (inflight.current) return
    const v = validate()
    const has = Object.values(v).some(Boolean)
    setTouched({ name: true, phone: true, email: true, privacyConsent: true })
    setErrors(v)
    if (has) {
      const first = (['name', 'phone', 'email', 'privacyConsent'] as const).find((k) => v[k])
      document.getElementById('f-' + first)?.focus()
      return
    }
    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setFormError('Aguarde a verificação anti-robô terminar.')
      return
    }
    inflight.current = true
    setSending(true)
    setFormError(null)
    try {
      const r = await backend.register({
        name: name.replace(/\s+/g, ' ').trim(), phone, email: email.trim(), privacyConsent: privacy, whatsappConsent: wa,
        website, startedAt: startedAt.current, turnstileToken,
      })
      if (r.ok) {
        const t: Ticket = { ...r.participant, receiptToken: r.receiptToken, whatsapp: r.whatsapp, createdAt: new Date().toISOString() }
        saveTicket(t)
        onDone(t)
      } else {
        if (r.fieldErrors) setErrors(r.fieldErrors as Errors)
        setFormError(r.message)
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Não foi possível concluir. Tente novamente.')
    } finally {
      inflight.current = false
      setSending(false)
    }
  }

  const blur = (k: string) => () => setTouched((t) => ({ ...t, [k]: true }))

  return (
    <form onSubmit={submit} noValidate className="space-y-4" aria-busy={sending}>
      {formError && (
        <div role="alert" className="flex gap-3 rounded-2xl border-[2.5px] border-ink bg-[#ff5a3c] p-3.5 text-[14px] font-semibold leading-snug animate-pop">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      <Field id="f-name" label="Nome completo" error={errors.name}>
        <input id="f-name" className={`field ${errors.name ? 'field-error' : ''}`} value={name} onChange={(e) => setName(e.target.value)}
          onBlur={blur('name')} autoComplete="name" placeholder="Seu nome e sobrenome" maxLength={120} aria-invalid={Boolean(errors.name)} />
      </Field>

      <Field id="f-phone" label="Celular com DDD" error={errors.phone}>
        <input id="f-phone" className={`field ${errors.phone ? 'field-error' : ''}`} value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))}
          onBlur={blur('phone')} inputMode="tel" autoComplete="tel-national" placeholder="(11) 99999-9999" aria-invalid={Boolean(errors.phone)} />
      </Field>

      <Field id="f-email" label="E-mail" error={errors.email}>
        <input id="f-email" type="email" className={`field ${errors.email ? 'field-error' : ''}`} value={email} onChange={(e) => setEmail(e.target.value)}
          onBlur={blur('email')} inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="voce@email.com" maxLength={160} aria-invalid={Boolean(errors.email)} />
      </Field>

      {/* Honeypot anti-bot: invisível para pessoas */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
      </div>

      <div className="space-y-3.5 pt-1">
        <Checkbox id="f-privacyConsent" checked={privacy} onChange={(v) => { setPrivacy(v); setTouched((t) => ({ ...t, privacyConsent: true })) }} error={errors.privacyConsent}>
          Li e aceito o <Link to="/regulamento" className="font-bold underline underline-offset-2">regulamento</Link> e a{' '}
          <Link to="/privacidade" className="font-bold underline underline-offset-2">política de privacidade</Link>. <span className="text-graphite-500">(obrigatório)</span>
        </Checkbox>
        <Checkbox id="f-wa" checked={wa} onChange={setWa}>
          Autorizo receber meu número da sorte no WhatsApp informado. <span className="text-graphite-500">(opcional)</span>
        </Checkbox>
      </div>

      {TURNSTILE_SITE_KEY && <Turnstile onToken={setTurnstileToken} />}

      <button type="submit" disabled={sending} className="btn btn-lg btn-ink w-full">
        {sending ? (<><Spinner /> Gerando seu número…</>) : (<>Gerar meu número da sorte <ArrowRight className="h-5 w-5" strokeWidth={3} /></>)}
      </button>
      <p className="text-center text-[12px] leading-snug text-graphite-700">Um número por pessoa. Seus dados são usados apenas para este sorteio.</p>
    </form>
  )
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block font-display text-[13px] font-extrabold uppercase tracking-wider">{label}</label>
      {children}
      {error && <p className="mt-1.5 text-[13px] font-semibold text-[#c22a14]" role="alert">{error}</p>}
    </div>
  )
}

declare global {
  interface Window { turnstile?: { render: (el: HTMLElement, o: Record<string, unknown>) => string } }
}

function Turnstile({ onToken }: { onToken: (t: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const render = () => window.turnstile && ref.current && !ref.current.childElementCount &&
      window.turnstile.render(ref.current, { sitekey: TURNSTILE_SITE_KEY, callback: onToken, 'expired-callback': () => onToken(''), theme: 'light', language: 'pt-br' })
    if (window.turnstile) render()
    else {
      const s = document.createElement('script')
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      s.async = true
      s.onload = render
      document.head.appendChild(s)
    }
  }, [onToken])
  return <div ref={ref} className="flex justify-center" />
}
