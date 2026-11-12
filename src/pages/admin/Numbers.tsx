import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Participant } from '../../lib/types'
import { useAdminData } from './data'
import { PageTitle, ParticipantModal } from './shared'

export default function Numbers() {
  const { participants } = useAdminData()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<Participant | null>(null)
  const valid = participants.filter((p) => p.status === 'valido').length
  const list = useMemo(() => {
    const d = q.replace(/\D/g, '')
    return d ? participants.filter((p) => p.number.includes(d)) : participants
  }, [participants, q])

  return (
    <>
      <PageTitle kicker="Todos os números gerados" title="Números da sorte" />

      <div className="mb-4 grid grid-cols-3 gap-2 sm:max-w-xl">
        <Count label="Válidos" value={valid} hi />
        <Count label="Gerados" value={participants.length} />
        <Count label="Fora do sorteio" value={participants.length - valid} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-graphite-500" />
          <input className="field !py-2.5 !pl-12" inputMode="numeric" placeholder="Buscar número" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-3 text-[12px] font-semibold">
          <Legend className="bg-ink" label="Válido" />
          <Legend className="bg-neon" label="Vencedor" />
          <Legend className="bg-graphite-300" label="Desclassificado / excluído" />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 xl:grid-cols-10">
        {list.map((p) => (
          <button key={p.id} onClick={() => setOpen(p)} title={p.full_name}
            className={`aspect-[4/3] rounded-xl border-2 font-display text-[17px] font-black tabular-nums transition-transform hover:-translate-y-0.5 sm:text-lg ${
              p.is_winner ? 'border-ink bg-neon text-ink shadow-hard-sm' : p.status === 'valido' ? 'border-ink bg-ink text-sun' : 'border-graphite-300 bg-graphite-300/50 text-graphite-500 line-through'}`}>
            {p.number}
          </button>
        ))}
      </div>
      {list.length === 0 && <p className="py-10 text-center text-sm text-graphite-500">Nenhum número encontrado.</p>}
      <ParticipantModal participant={open} onClose={() => setOpen(null)} />
    </>
  )
}

function Count({ label, value, hi }: { label: string; value: number; hi?: boolean }) {
  return (
    <div className={`rounded-2xl border-[2.5px] border-ink px-3 py-2.5 ${hi ? 'bg-sun' : 'bg-white'}`}>
      <p className="font-display text-[28px] font-black leading-none tabular-nums">{value}</p>
      <p className="mt-1 text-[11px] font-bold uppercase tracking-wide">{label}</p>
    </div>
  )
}

const Legend = ({ className, label }: { className: string; label: string }) => (
  <span className="flex items-center gap-1.5"><span className={`h-3.5 w-3.5 rounded border-2 border-ink ${className}`} /> {label}</span>
)
