import { ArrowRight, Dices, Hash, MessageCircle, Ticket, Trophy, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Vinyl } from '../../components/brand'
import { Spinner } from '../../components/ui'
import { displayPhone, fmtDateTime } from '../../lib/format'
import { useAdminData } from './data'
import { needsWhatsApp, PageTitle } from './shared'

export default function Dashboard() {
  const { stats, participants, prizes, draws, loading } = useAdminData()
  if (loading && !stats) return <div className="grid h-64 place-items-center"><Spinner className="h-8 w-8" /></div>
  if (!stats) return null

  const validDraws = draws.filter((d) => d.status === 'valido')
  const next = prizes.find((p) => !validDraws.some((d) => d.prize_id === p.id))
  const recent = [...participants].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 6)
  const pendingWa = participants.filter(needsWhatsApp).length
  const drawStatus = stats.prizes_drawn === 0 ? 'Não iniciado' : stats.prizes_drawn >= stats.prizes_total ? 'Concluído' : 'Em andamento'

  const kpis = [
    { label: 'Participantes cadastrados', value: stats.participants_total, icon: Users, sub: `${stats.participants_valid} válidos` },
    { label: 'Números gerados', value: stats.numbers_generated, icon: Ticket, sub: stats.max_participants ? `limite ${stats.max_participants}` : 'sem limite' },
    { label: 'Disponíveis p/ sorteio', value: stats.numbers_available, icon: Hash, sub: 'válidos e ainda sem prêmio', hi: true },
    { label: 'WhatsApp enviados', value: stats.whatsapp_sent, icon: MessageCircle, sub: `${stats.whatsapp_pending} aguardando envio` },
  ]

  return (
    <>
      <PageTitle kicker="Sunset House · 15/11" title="Dashboard" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className={`relative overflow-hidden rounded-2xl border-[2.5px] border-ink p-4 ${k.hi ? 'bg-sun shadow-hard' : 'bg-white'}`}>
            <k.icon className="h-5 w-5" strokeWidth={2.4} />
            <p className="mt-3 font-display text-[40px] font-black leading-none tabular-nums">{k.value}</p>
            <p className="mt-2 text-[12px] font-bold uppercase leading-tight tracking-wide">{k.label}</p>
            <p className="mt-0.5 text-[12px] text-graphite-700">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <StatusTile label="Inscrições" value={stats.registrations_open ? 'Abertas' : 'Encerradas'} on={stats.registrations_open} to="/admin/configuracoes" cta="Gerenciar" />
        <StatusTile label="Sorteio" value={`${drawStatus} · ${stats.prizes_drawn}/${stats.prizes_total}`} on={stats.prizes_drawn > 0 && stats.prizes_drawn < stats.prizes_total} to="/admin/sorteio" cta="Abrir" />
      </div>

      <div className="mt-6 grid items-start gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="relative overflow-hidden rounded-[26px] bg-ink p-6 text-paper">
          <Vinyl className="absolute -right-16 -top-16 w-56 opacity-60" />
          <p className="font-display text-[11px] font-extrabold uppercase tracking-[0.2em] text-neon">Próximo sorteio</p>
          {next ? (
            <>
              <p className="display relative mt-2 text-[34px]">{next.round}º · {next.title}</p>
              <p className="relative mt-2 text-sm text-paper/70">{stats.numbers_available} números concorrendo agora.</p>
              <Link to="/admin/sorteio" className="btn btn-md btn-sun relative mt-5 !shadow-none"><Dices className="h-5 w-5" /> Ir para o sorteio</Link>
            </>
          ) : (
            <p className="display relative mt-2 text-[30px]">Todos os prêmios sorteados 🎉</p>
          )}
          {validDraws.length > 0 && (
            <ul className="relative mt-6 space-y-1.5 border-t border-white/15 pt-4 text-sm">
              {[...validDraws].sort((a, b) => a.round - b.round).map((d) => (
                <li key={d.id} className="flex items-center gap-2"><Trophy className="h-4 w-4 text-neon" /> {d.round}º · <b className="font-display">{String(d.lucky_number).padStart(4, '0')}</b> · {d.winner_name}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-[26px] border-[2.5px] border-ink bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="font-display text-sm font-extrabold uppercase">Últimos cadastros</p>
            <Link to="/admin/participantes" className="flex items-center gap-1 text-[13px] font-semibold underline underline-offset-4">Ver todos <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
          <ul className="mt-3 divide-y divide-ink/10">
            {recent.length === 0 && <li className="py-6 text-center text-sm text-graphite-500">Nenhum cadastro ainda.</li>}
            {recent.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5">
                <span className="w-14 font-display text-lg font-black tabular-nums">{p.number}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold">{p.full_name}</span>
                  <span className="block text-[12px] text-graphite-500">{displayPhone(p.phone)}</span>
                </span>
                <span className="text-[12px] text-graphite-500">{fmtDateTime(p.created_at)}</span>
              </li>
            ))}
          </ul>
          {pendingWa > 0 && (
            <Link to="/admin/participantes?filtro=whatsapp" className="mt-3 flex items-center justify-between rounded-xl bg-sun px-3 py-2.5 text-[13px] font-bold">
              <span className="flex items-center gap-2"><MessageCircle className="h-4 w-4" /> {pendingWa} aguardando WhatsApp</span> <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>
    </>
  )
}

function StatusTile({ label, value, on, to, cta }: { label: string; value: string; on: boolean; to: string; cta: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-ink/10 bg-white px-4 py-3.5">
      <div className="flex items-center gap-3">
        <span className={`h-3 w-3 rounded-full ${on ? 'bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,.2)]' : 'bg-graphite-500'}`} />
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-graphite-500">{label}</p>
          <p className="font-display text-[17px] font-extrabold">{value}</p>
        </div>
      </div>
      <Link to={to} className="btn btn-sm btn-paper !shadow-hard-sm">{cta}</Link>
    </div>
  )
}
