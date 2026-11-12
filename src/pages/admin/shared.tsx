import { Ban, CheckCircle2, ExternalLink, MessageCircle, RotateCcw, Send, Trash2, Trophy } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Modal, Spinner, useToast } from '../../components/ui'
import { backend } from '../../lib/backend'
import { displayPhone, fmtFull } from '../../lib/format'
import type { Participant, ParticipantStatus } from '../../lib/types'
import { luckyNumberMessage, waLink } from '../../lib/whatsapp'
import { useAdminData } from './data'

export function PageTitle({ title, kicker, children }: { title: string; kicker?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        {kicker && <p className="font-display text-[11px] font-extrabold uppercase tracking-[0.2em] text-graphite-500">{kicker}</p>}
        <h1 className="display text-[34px] sm:text-[42px]">{title}</h1>
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  )
}

export const STATUS_LABEL: Record<ParticipantStatus, string> = { valido: 'Válido', desclassificado: 'Desclassificado', excluido: 'Excluído' }

export function StatusBadge({ p }: { p: Pick<Participant, 'status' | 'is_winner'> }) {
  if (p.is_winner) return <span className="chip bg-neon"><Trophy className="h-3 w-3" /> Vencedor</span>
  if (p.status === 'valido') return <span className="chip border-ink/20 bg-white">Válido</span>
  if (p.status === 'desclassificado') return <span className="chip border-[#c22a14] bg-[#fff1ec] text-[#a3200d]">Desclass.</span>
  return <span className="chip border-graphite-500 bg-graphite-300/40 text-graphite-700">Excluído</span>
}

export function waText(p: Participant): { label: string; tone: string } {
  if (!p.whatsapp_consent) return { label: 'Sem autorização', tone: 'text-graphite-500' }
  switch (p.whatsapp_status) {
    case 'lido': return { label: 'Lido', tone: 'text-emerald-700' }
    case 'entregue': return { label: 'Entregue', tone: 'text-emerald-700' }
    case 'enviado': return { label: p.whatsapp_channel === 'whatsapp_manual' ? 'Enviado (manual)' : 'Enviado', tone: 'text-emerald-700' }
    case 'pendente': return { label: 'Aguardando confirmação', tone: 'text-amber-700' }
    case 'falhou': return { label: 'Falhou', tone: 'text-[#c22a14]' }
    default: return { label: 'Pendente de envio', tone: 'text-amber-700' }
  }
}

export function WaBadge({ p }: { p: Participant }) {
  const w = waText(p)
  return <span className={`text-[12px] font-semibold ${w.tone}`}>{w.label}</span>
}

export function needsWhatsApp(p: Participant) {
  return p.whatsapp_consent && p.status !== 'excluido' && !['enviado', 'entregue', 'lido'].includes(p.whatsapp_status ?? '')
}

export function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-white px-3.5 py-2.5">
      <dt className="text-[11px] font-bold uppercase tracking-wider text-graphite-500">{label}</dt>
      <dd className="mt-0.5 break-words text-[15px] font-semibold">{children}</dd>
    </div>
  )
}

/** Detalhes + ações administrativas de um participante */
export function ParticipantModal({ participant, onClose }: { participant: Participant | null; onClose: () => void }) {
  const { refresh, participants } = useAdminData()
  const toast = useToast()
  const p = participants.find((x) => x.id === participant?.id) ?? participant
  const [action, setAction] = useState<ParticipantStatus | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  if (!p) return null

  async function run(key: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(key)
    try {
      await fn()
      await refresh()
      toast(ok)
      return true
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro', 'error')
      return false
    } finally {
      setBusy(null)
    }
  }

  async function changeStatus() {
    if (!action || !reason.trim()) return
    if (await run('status', () => backend.admin.setStatus(p!.id, action, reason.trim()), 'Status atualizado e registrado na auditoria')) {
      setAction(null)
      setReason('')
    }
  }

  async function resend() {
    setBusy('api')
    try {
      const r = await backend.admin.resendWhatsApp(p!.id)
      if (r.whatsapp === 'nao_configurado') toast('API do WhatsApp ainda não configurada. Use o envio manual.', 'info')
      else if (r.ok) toast('Mensagem encaminhada à API do WhatsApp')
      else toast(r.message ?? 'Falha no envio', 'error')
      await refresh()
    } finally {
      setBusy(null)
    }
  }

  return (
    <Modal open={Boolean(participant)} onClose={onClose} title={`Nº ${p.number}`} wide>
      <div className="flex flex-wrap items-center gap-2"><StatusBadge p={p} /> <WaBadge p={p} /></div>
      <dl className="mt-4 grid gap-2 sm:grid-cols-2">
        <Info label="Nome">{p.full_name}</Info>
        <Info label="Telefone">{displayPhone(p.phone)}</Info>
        <Info label="E-mail">{p.email}</Info>
        <Info label="Inscrição">{fmtFull(p.created_at)}</Info>
        <Info label="Consentimento privacidade">{p.privacy_consent ? `Sim · ${fmtFull(p.privacy_consent_at)}` : 'Não'}</Info>
        <Info label="Consentimento WhatsApp">{p.whatsapp_consent ? `Sim · ${fmtFull(p.whatsapp_consent_at)}` : 'Não'}</Info>
        {p.status_reason && <div className="sm:col-span-2"><Info label="Motivo do status">{p.status_reason}</Info></div>}
        {p.whatsapp_error && <div className="sm:col-span-2"><Info label="Erro do WhatsApp">{p.whatsapp_error}</Info></div>}
      </dl>

      {p.whatsapp_consent && p.status !== 'excluido' && (
        <div className="mt-5 rounded-2xl border-2 border-ink/10 bg-white p-4">
          <p className="font-display text-sm font-extrabold uppercase">WhatsApp</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <a className="btn btn-sm btn-paper !shadow-hard-sm" href={waLink(p.phone, luckyNumberMessage(p.full_name, p.number))} target="_blank" rel="noreferrer">
              <MessageCircle className="h-4 w-4" /> Abrir conversa <ExternalLink className="h-3 w-3" />
            </a>
            <button className="btn btn-sm btn-paper !shadow-hard-sm" disabled={busy !== null} onClick={() => run('manual', () => backend.admin.markManualWhatsApp(p.id), 'Envio manual registrado')}>
              {busy === 'manual' ? <Spinner className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />} Marcar enviado
            </button>
            <button className="btn btn-sm btn-paper !shadow-hard-sm" disabled={busy !== null} onClick={resend}>
              {busy === 'api' ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />} Enviar pela API
            </button>
          </div>
          <p className="mt-2 text-[12px] text-graphite-500">“Abrir conversa” abre o WhatsApp com a mensagem pronta. Depois de enviar, toque em “Marcar enviado”.</p>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {p.status === 'valido' ? (
          <>
            <button className="btn btn-sm btn-paper !shadow-hard-sm" onClick={() => setAction('desclassificado')}><Ban className="h-4 w-4" /> Desclassificar</button>
            <button className="btn btn-sm btn-danger !shadow-hard-sm" onClick={() => setAction('excluido')}><Trash2 className="h-4 w-4" /> Excluir</button>
          </>
        ) : (
          <button className="btn btn-sm btn-paper !shadow-hard-sm" onClick={() => setAction('valido')}><RotateCcw className="h-4 w-4" /> Reativar</button>
        )}
      </div>

      {action && (
        <div className="mt-4 rounded-2xl border-[2.5px] border-ink bg-sun p-4 animate-rise">
          <p className="font-display font-extrabold uppercase">
            {action === 'valido' ? 'Reativar participante' : action === 'excluido' ? 'Excluir participante' : 'Desclassificar participante'}
          </p>
          <p className="mt-1 text-[13px]">
            {action === 'valido' ? 'O número volta a concorrer.' : 'O número sai do sorteio. O registro e o número são mantidos para auditoria e não são reutilizados.'}
            {p.is_winner && action !== 'valido' && ' Atenção: este participante já venceu um sorteio — se necessário, refaça o sorteio do prêmio.'}
          </p>
          <textarea className="field mt-3 min-h-[80px]" placeholder="Motivo (obrigatório)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="mt-3 flex gap-2">
            <button className="btn btn-sm btn-ink" disabled={!reason.trim() || busy !== null} onClick={changeStatus}>{busy === 'status' && <Spinner className="h-4 w-4" />} Confirmar</button>
            <button className="btn btn-sm btn-ghost" onClick={() => { setAction(null); setReason('') }}>Cancelar</button>
          </div>
        </div>
      )}
    </Modal>
  )
}
