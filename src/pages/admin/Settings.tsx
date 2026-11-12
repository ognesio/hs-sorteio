import { CheckCircle2, CircleAlert, Lock, LockOpen, Plus, Save, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Modal, Spinner, useToast } from '../../components/ui'
import { backend } from '../../lib/backend'
import { fmtFull } from '../../lib/format'
import type { AuditEntry, Prize, Settings, WaIntegrationStatus } from '../../lib/types'
import { useAdminData } from './data'
import { needsWhatsApp, PageTitle } from './shared'

const ACTIONS: Record<string, string> = {
  update_settings: 'Configurações alteradas', participant_status: 'Status de participante alterado', draw_performed: 'Sorteio realizado',
  draw_voided: 'Sorteio anulado', whatsapp_manual: 'WhatsApp manual registrado', whatsapp_api_resend: 'WhatsApp reenviado pela API',
  insert_prizes: 'Prêmio criado', update_prizes: 'Prêmio alterado', delete_prizes: 'Prêmio removido',
}

export default function SettingsPage() {
  const { prizes, draws, participants, refresh } = useAdminData()
  const toast = useToast()
  const [s, setS] = useState<Settings | null>(null)
  const [saving, setSaving] = useState(false)
  const [toggleOpen, setToggleOpen] = useState(false)
  const [wa, setWa] = useState<WaIntegrationStatus | null | undefined>(undefined)
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [editing, setEditing] = useState<Partial<Prize> | null>(null)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)

  const load = () => Promise.all([backend.admin.settings().then(setS), backend.admin.audit().then(setAudit)]).catch((e) => toast(e.message, 'error'))
  useEffect(() => {
    load()
    backend.admin.waStatus().then(setWa).catch(() => setWa(null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!s) return <div className="grid h-64 place-items-center"><Spinner className="h-8 w-8" /></div>

  async function save(patch: Partial<Settings>, msg = 'Configurações salvas') {
    setSaving(true)
    try {
      const m = { ...s!, ...patch }
      await backend.admin.updateSettings({
        raffle_name: m.raffle_name, raffle_description: m.raffle_description, registrations_open: m.registrations_open,
        max_participants: m.max_participants, allow_same_winner: m.allow_same_winner, rules_text: m.rules_text,
      })
      await Promise.all([load(), refresh()])
      toast(msg)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro ao salvar', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function savePrize() {
    if (!editing?.title?.trim() || !editing.round) return
    try {
      await backend.admin.savePrize({ ...editing, title: editing.title.trim(), round: Number(editing.round) } as Prize)
      setEditing(null)
      await Promise.all([refresh(), load()])
      toast('Prêmio salvo')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro', 'error')
    }
  }

  async function removePrize(p: Prize) {
    try {
      await backend.admin.deletePrize(p.id)
      await Promise.all([refresh(), load()])
      toast('Prêmio removido')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro', 'error')
    }
  }

  const pendingWa = participants.filter(needsWhatsApp).length

  return (
    <>
      <PageTitle kicker="Regras e integrações" title="Configurações" />

      {/* Inscrições */}
      <section className={`flex flex-wrap items-center justify-between gap-4 rounded-[26px] border-[2.5px] border-ink p-5 ${s.registrations_open ? 'bg-sun' : 'bg-white'}`}>
        <div className="flex items-center gap-4">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-ink text-sun">{s.registrations_open ? <LockOpen className="h-5 w-5" /> : <Lock className="h-5 w-5" />}</span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider">Inscrições</p>
            <p className="display text-[28px]">{s.registrations_open ? 'Abertas' : 'Encerradas'}</p>
          </div>
        </div>
        <button className={`btn btn-md ${s.registrations_open ? 'btn-ink' : 'btn-sun'}`} onClick={() => setToggleOpen(true)}>
          {s.registrations_open ? 'Encerrar inscrições' : 'Reabrir inscrições'}
        </button>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Sorteio */}
        <section className="rounded-[26px] border-2 border-ink/10 bg-white p-5">
          <h2 className="display text-xl">Sorteio</h2>
          <div className="mt-4 space-y-3">
            <L label="Nome do sorteio"><input className="field" value={s.raffle_name} onChange={(e) => setS({ ...s, raffle_name: e.target.value })} /></L>
            <L label="Descrição"><textarea className="field min-h-[80px]" value={s.raffle_description} onChange={(e) => setS({ ...s, raffle_description: e.target.value })} /></L>
            <L label="Limite de participantes (vazio = sem limite)">
              <input className="field" inputMode="numeric" value={s.max_participants ?? ''} placeholder="Sem limite"
                onChange={(e) => setS({ ...s, max_participants: e.target.value.replace(/\D/g, '') ? Number(e.target.value.replace(/\D/g, '')) : null })} />
            </L>
            <L label="Regras de participação (aparece no regulamento)"><textarea className="field min-h-[110px]" value={s.rules_text} onChange={(e) => setS({ ...s, rules_text: e.target.value })} /></L>
            <label className="flex items-start gap-3 rounded-2xl bg-paper p-3 text-[14px]">
              <input type="checkbox" className="mt-1 h-5 w-5 accent-ink" checked={s.allow_same_winner} onChange={(e) => setS({ ...s, allow_same_winner: e.target.checked })} />
              <span><b>Permitir que a mesma pessoa ganhe mais de um prêmio</b><br /><span className="text-graphite-700">Recomendado: desligado.</span></span>
            </label>
            <button className="btn btn-md btn-ink w-full" disabled={saving} onClick={() => save({})}>{saving ? <Spinner /> : <Save className="h-5 w-5" />} Salvar alterações</button>
            <p className="text-[12px] text-graphite-500">Última alteração: {fmtFull(s.updated_at)} · {s.last_number} números já gerados</p>
          </div>
        </section>

        {/* Prêmios */}
        <section className="rounded-[26px] border-2 border-ink/10 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="display text-xl">Prêmios</h2>
            <button className="btn btn-sm btn-paper !shadow-hard-sm" onClick={() => setEditing({ round: (prizes.at(-1)?.round ?? 0) + 1, title: '', description: '' })}><Plus className="h-4 w-4" /> Adicionar</button>
          </div>
          <ul className="mt-4 space-y-2">
            {prizes.map((p) => {
              const drawn = draws.some((d) => d.prize_id === p.id && d.status === 'valido')
              return (
                <li key={p.id} className="flex items-center gap-3 rounded-2xl bg-paper p-3">
                  <span className="font-display text-2xl font-black">{p.round}º</span>
                  <button className="min-w-0 flex-1 text-left" onClick={() => setEditing(p)}>
                    <span className="block truncate font-display font-extrabold uppercase">{p.title}</span>
                    <span className="block text-[12px] text-graphite-500">{drawn ? 'Já sorteado' : 'Pendente'} · toque para editar</span>
                  </button>
                  {!drawn && (confirmDel === p.id
                    ? <button className="btn btn-sm btn-danger !shadow-none" onClick={() => { setConfirmDel(null); removePrize(p) }}>Remover?</button>
                    : <button className="grid h-9 w-9 place-items-center rounded-xl hover:bg-white" aria-label="Remover" onClick={() => setConfirmDel(p.id)}><Trash2 className="h-4 w-4" /></button>)}
                </li>
              )
            })}
          </ul>
        </section>

        {/* WhatsApp */}
        <section className="rounded-[26px] border-2 border-ink/10 bg-white p-5">
          <h2 className="display text-xl">Integração WhatsApp</h2>
          {wa === undefined ? <div className="py-6"><Spinner /></div> : (
            <div className="mt-4 space-y-2 text-[14px]">
              <Row ok={Boolean(wa?.configured)} label="Credenciais da Cloud API" detail={wa?.configured ? `${wa.apiVersion} · template ${wa.templateName} (${wa.templateLang})` : 'Não configuradas — envio automático desativado'} />
              <Row ok={Boolean(wa?.webhookConfigured)} label="Webhook de status" detail={wa?.webhookConfigured ? 'Recebendo confirmações de entrega' : 'Sem confirmação de entrega/leitura'} />
              <div className="flex items-center justify-between rounded-2xl bg-sun px-4 py-3">
                <span><b>{pendingWa}</b> participante(s) autorizaram e ainda não receberam</span>
                <Link to="/admin/participantes?filtro=whatsapp" className="btn btn-sm btn-ink">Ver</Link>
              </div>
              {!wa?.configured && <p className="text-[12px] text-graphite-700">Enquanto a API não estiver ativa, nenhuma mensagem é marcada como enviada automaticamente. Use “Abrir conversa” + “Marcar enviado” em cada participante. Passo a passo de ativação no README do projeto.</p>}
            </div>
          )}
        </section>

        {/* Auditoria */}
        <section className="rounded-[26px] border-2 border-ink/10 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="display text-xl">Auditoria</h2>
            <Link to="/admin/sorteio" className="text-[13px] font-semibold underline underline-offset-4">Histórico de sorteios</Link>
          </div>
          <ul className="mt-3 max-h-[420px] divide-y divide-ink/10 overflow-y-auto pr-1 text-[13px]">
            {audit.length === 0 && <li className="py-6 text-center text-graphite-500">Nenhuma ação registrada.</li>}
            {audit.map((a) => (
              <li key={a.id} className="py-2.5">
                <p className="font-semibold">{ACTIONS[a.action] ?? a.action}{describe(a)}</p>
                <p className="text-[12px] text-graphite-500">{fmtFull(a.created_at)} · {a.actor_email ?? 'sistema'}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <Modal open={toggleOpen} onClose={() => setToggleOpen(false)} title={s.registrations_open ? 'Encerrar inscrições?' : 'Reabrir inscrições?'}>
        <p className="text-[15px]">{s.registrations_open
          ? 'A página pública passará a exibir “INSCRIÇÕES ENCERRADAS” e nenhum novo número será gerado.'
          : 'A página pública volta a aceitar cadastros e gerar números.'}</p>
        <button className="btn btn-lg btn-ink mt-5 w-full" disabled={saving}
          onClick={async () => { await save({ registrations_open: !s.registrations_open }, s.registrations_open ? 'Inscrições encerradas' : 'Inscrições reabertas'); setToggleOpen(false) }}>
          {saving && <Spinner />} Confirmar
        </button>
      </Modal>

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? 'Editar prêmio' : 'Novo prêmio'}>
        {editing && (
          <div className="space-y-3">
            <L label="Ordem do sorteio"><input className="field" inputMode="numeric" value={editing.round ?? ''} onChange={(e) => setEditing({ ...editing, round: Number(e.target.value.replace(/\D/g, '')) || undefined })} /></L>
            <L label="Prêmio"><input className="field" value={editing.title ?? ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="Ex.: Kit Napiteira" /></L>
            <L label="Descrição (opcional)"><input className="field" value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></L>
            <button className="btn btn-md btn-ink w-full" disabled={!editing.title?.trim() || !editing.round} onClick={savePrize}><Save className="h-5 w-5" /> Salvar prêmio</button>
          </div>
        )}
      </Modal>
    </>
  )
}

function describe(a: AuditEntry) {
  const d = a.details as Record<string, unknown> | null
  if (!d) return ''
  if (a.action === 'draw_performed') return ` — ${d.round}º · ${d.number} · ${d.winner}`
  if (a.action === 'draw_voided') return ` — ${d.round}º · ${d.number} (${d.reason})`
  if (a.action === 'participant_status') return ` — ${d.number}: ${d.from} → ${d.to}`
  return ''
}

const L = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block"><span className="mb-1.5 block text-[12px] font-bold uppercase tracking-wider text-graphite-700">{label}</span>{children}</label>
)

const Row = ({ ok, label, detail }: { ok: boolean; label: string; detail: string }) => (
  <div className="flex items-start gap-3 rounded-2xl bg-paper px-4 py-3">
    {ok ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /> : <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />}
    <span><b>{label}</b><br /><span className="text-graphite-700">{detail}</span></span>
  </div>
)
