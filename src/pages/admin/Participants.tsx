import { ChevronRight, Download, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Spinner } from '../../components/ui'
import { displayPhone, fmtDateTime, fmtFull } from '../../lib/format'
import type { Participant } from '../../lib/types'
import { useAdminData } from './data'
import { needsWhatsApp, PageTitle, ParticipantModal, STATUS_LABEL, StatusBadge, WaBadge, waText } from './shared'

const FILTERS = [
  { id: 'todos', label: 'Todos' },
  { id: 'valido', label: 'Válidos' },
  { id: 'desclassificado', label: 'Desclassificados' },
  { id: 'excluido', label: 'Excluídos' },
  { id: 'whatsapp', label: 'WhatsApp pendente' },
  { id: 'vencedores', label: 'Vencedores' },
] as const

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function Participants() {
  const { participants, loading } = useAdminData()
  const [params, setParams] = useSearchParams()
  const filter = (params.get('filtro') ?? 'todos') as (typeof FILTERS)[number]['id']
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<Participant | null>(null)

  const rows = useMemo(() => {
    const term = norm(q.trim())
    const digits = q.replace(/\D/g, '')
    return participants.filter((p) => {
      if (filter === 'valido' && p.status !== 'valido') return false
      if (filter === 'desclassificado' && p.status !== 'desclassificado') return false
      if (filter === 'excluido' && p.status !== 'excluido') return false
      if (filter === 'whatsapp' && !needsWhatsApp(p)) return false
      if (filter === 'vencedores' && !p.is_winner) return false
      if (!term) return true
      return norm(p.full_name).includes(term) || p.email.includes(term) ||
        (digits.length > 0 && (p.number.includes(digits.padStart(Math.min(4, digits.length), '0')) || String(p.lucky_number) === digits || p.phone.includes(digits)))
    })
  }, [participants, filter, q])

  function exportCsv() {
    const head = ['Número', 'Nome', 'Telefone', 'E-mail', 'Status', 'Motivo', 'Cadastro', 'Consent. WhatsApp', 'WhatsApp', 'Vencedor']
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const lines = rows.map((p) => [p.number, p.full_name, displayPhone(p.phone), p.email, STATUS_LABEL[p.status], p.status_reason ?? '', fmtFull(p.created_at), p.whatsapp_consent ? 'Sim' : 'Não', waText(p).label, p.is_winner ? 'Sim' : 'Não'].map(esc).join(';'))
    const blob = new Blob(['﻿' + [head.map(esc).join(';'), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `sunset-house-participantes-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <>
      <PageTitle kicker={`${participants.length} cadastros`} title="Participantes">
        <button className="btn btn-sm btn-paper !shadow-hard-sm" onClick={exportCsv}><Download className="h-4 w-4" /> Exportar CSV</button>
      </PageTitle>

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-graphite-500" />
        <input className="field !pl-12" placeholder="Buscar por nome, número, telefone ou e-mail" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {FILTERS.map((f) => (
          <button key={f.id} onClick={() => setParams(f.id === 'todos' ? {} : { filtro: f.id })}
            className={`shrink-0 rounded-full border-2 border-ink px-3.5 py-1.5 text-[13px] font-bold transition-colors ${filter === f.id ? 'bg-ink text-sun' : 'bg-white hover:bg-sun'}`}>
            {f.label}
          </button>
        ))}
      </div>

      <p className="mt-4 text-[13px] text-graphite-500">{rows.length} resultado(s)</p>
      {loading && participants.length === 0 && <div className="grid h-40 place-items-center"><Spinner /></div>}

      {/* Mobile: cards */}
      <ul className="mt-2 space-y-2 md:hidden">
        {rows.map((p) => (
          <li key={p.id}>
            <button onClick={() => setOpen(p)} className="flex w-full items-center gap-3 rounded-2xl border-2 border-ink/10 bg-white p-3 text-left active:bg-sun/40">
              <span className="grid h-12 w-16 shrink-0 place-items-center rounded-xl bg-ink font-display text-lg font-black text-sun tabular-nums">{p.number}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{p.full_name}</span>
                <span className="block text-[12px] text-graphite-500">{displayPhone(p.phone)} · {fmtDateTime(p.created_at)}</span>
                <span className="mt-1 flex items-center gap-2"><StatusBadge p={p} /> <WaBadge p={p} /></span>
              </span>
              <ChevronRight className="h-5 w-5 text-graphite-500" />
            </button>
          </li>
        ))}
      </ul>

      {/* Desktop: tabela */}
      <div className="mt-2 hidden overflow-hidden rounded-2xl border-[2.5px] border-ink bg-white md:block">
        <table className="w-full text-left text-[14px]">
          <thead className="bg-ink font-display text-[11px] uppercase tracking-wider text-paper">
            <tr>{['Número', 'Nome', 'Telefone', 'E-mail', 'Cadastro', 'Status', 'WhatsApp'].map((h) => <th key={h} className="px-4 py-3 font-extrabold">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-ink/10">
            {rows.map((p) => (
              <tr key={p.id} onClick={() => setOpen(p)} className="cursor-pointer hover:bg-sun/30">
                <td className="px-4 py-3 font-display text-base font-black tabular-nums">{p.number}</td>
                <td className="max-w-[220px] truncate px-4 py-3 font-semibold">{p.full_name}</td>
                <td className="whitespace-nowrap px-4 py-3">{displayPhone(p.phone)}</td>
                <td className="max-w-[220px] truncate px-4 py-3">{p.email}</td>
                <td className="whitespace-nowrap px-4 py-3 text-graphite-700">{fmtDateTime(p.created_at)}</td>
                <td className="px-4 py-3"><StatusBadge p={p} /></td>
                <td className="px-4 py-3"><WaBadge p={p} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="py-10 text-center text-sm text-graphite-500">Nenhum participante encontrado.</p>}
      </div>

      <ParticipantModal participant={open} onClose={() => setOpen(null)} />
    </>
  )
}
