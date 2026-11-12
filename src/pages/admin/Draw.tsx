import { Copy, Dices, Expand, MessageCircle, RotateCcw, ShieldCheck, Trophy, UserRound } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Cloud, Logo, Sparkle, Vinyl } from '../../components/brand'
import sparkleImg from '../../assets/brand/sparkle.webp'
import { Checkbox, Modal, Spinner, useToast } from '../../components/ui'
import { backend } from '../../lib/backend'
import { copyText, fmtFull, pad } from '../../lib/format'
import type { DrawResult, Participant } from '../../lib/types'
import { waLink, winnerMessage } from '../../lib/whatsapp'
import { useAdminData } from './data'
import { PageTitle, ParticipantModal } from './shared'

type Phase = 'idle' | 'rolling' | 'result'
const MIN_ROLL_MS = 3600

export default function DrawPage() {
  const { prizes, draws, participants, stats, refresh } = useAdminData()
  const toast = useToast()
  const validDraws = draws.filter((d) => d.status === 'valido')
  const nextPrize = prizes.find((p) => !validDraws.some((d) => d.prize_id === p.id))
  const [prizeId, setPrizeId] = useState<string | undefined>(nextPrize?.id)
  const prize = prizes.find((p) => p.id === prizeId) ?? nextPrize ?? prizes[0]
  const existing = prize ? validDraws.find((d) => d.prize_id === prize.id) : undefined

  const [phase, setPhase] = useState<Phase>('idle')
  const [display, setDisplay] = useState('0000')
  const [result, setResult] = useState<DrawResult | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [redoOpen, setRedoOpen] = useState(false)
  const [redoReason, setRedoReason] = useState('')
  const [redoAck, setRedoAck] = useState(false)
  const [viewing, setViewing] = useState<Participant | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const timer = useRef<number>()

  useEffect(() => { if (!prizeId && nextPrize) setPrizeId(nextPrize.id) }, [nextPrize, prizeId])
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const poolNumbers = useMemo(() => {
    const won = new Set(validDraws.map((d) => d.participant_id))
    return participants.filter((p) => p.status === 'valido' && !won.has(p.id)).map((p) => p.number)
  }, [participants, validDraws])

  // Mostra o resultado já salvo quando troca de prêmio
  useEffect(() => {
    if (phase === 'rolling') return
    if (existing) {
      setResult({ draw_id: existing.id, round: existing.round, prize: existing.prize_title, number: pad(existing.lucky_number), participant_id: existing.participant_id,
        name: existing.winner_name, phone: participants.find((p) => p.id === existing.participant_id)?.phone ?? '', email: '', pool_size: existing.pool_size, pool_hash: existing.pool_hash, created_at: existing.created_at })
      setDisplay(pad(existing.lucky_number))
      setPhase('result')
    } else {
      setResult(null)
      setDisplay('0000')
      setPhase('idle')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prize?.id, existing?.id])

  function roll(final: Promise<DrawResult>) {
    setPhase('rolling')
    const start = performance.now()
    const pool = poolNumbers.length ? poolNumbers : ['0000']
    let resolved: DrawResult | null = null
    let failed = false
    final.then((r) => { resolved = r }).catch((e) => {
      failed = true
      toast(e instanceof Error ? e.message : 'Erro no sorteio', 'error')
      setDisplay(existing ? pad(existing.lucky_number) : '0000')
      setPhase(existing ? 'result' : 'idle')
    })
    const tick = () => {
      if (failed) return
      const t = performance.now() - start
      setDisplay(pool[Math.floor(Math.random() * pool.length)])
      if (resolved && t >= MIN_ROLL_MS) {
        const r = resolved as DrawResult
        setDisplay(r.number)
        setResult(r)
        setPhase('result')
        refresh()
        return
      }
      // desacelera ao longo do tempo
      const delay = 40 + Math.min(1, t / MIN_ROLL_MS) ** 3 * 260
      timer.current = window.setTimeout(tick, delay)
    }
    tick()
  }

  function start() {
    if (!prize) return
    setConfirmOpen(false)
    roll(backend.admin.performDraw(prize.id))
  }

  function redo() {
    if (!prize || !redoReason.trim() || !redoAck) return
    setRedoOpen(false)
    const reason = redoReason.trim()
    setRedoReason('')
    setRedoAck(false)
    roll(backend.admin.performDraw(prize.id, true, reason))
  }

  async function copyResult() {
    if (!result) return
    await copyText(`SUNSET HOUSE — ${result.round}º sorteio (${result.prize})\nNúmero sorteado: ${result.number}\nGanhador: ${result.name}\n${fmtFull(result.created_at)}`)
    toast('Resultado copiado')
  }

  const fullscreen = () => stageRef.current?.requestFullscreen?.().catch(() => {})
  const winner = result ? participants.find((p) => p.id === result.participant_id) : undefined

  return (
    <>
      <PageTitle kicker="Sorteio oficial" title="Realizar sorteio" />

      {/* Seleção do prêmio */}
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-4 sm:px-0">
        {prizes.map((p) => {
          const d = validDraws.find((x) => x.prize_id === p.id)
          const active = p.id === prize?.id
          return (
            <button key={p.id} disabled={phase === 'rolling'} onClick={() => setPrizeId(p.id)}
              className={`min-w-[150px] shrink-0 rounded-2xl border-[2.5px] p-3 text-left transition-all ${active ? 'border-ink bg-sun shadow-hard' : 'border-ink/15 bg-white hover:border-ink'}`}>
              <p className="font-display text-[11px] font-extrabold uppercase tracking-wider text-graphite-700">{p.round}º sorteio</p>
              <p className="mt-0.5 font-display text-[15px] font-extrabold uppercase leading-tight">{p.title}</p>
              <p className={`mt-2 text-[12px] font-bold ${d ? 'text-ink' : 'text-graphite-500'}`}>{d ? `✓ ${pad(d.lucky_number)} · ${d.winner_name.split(' ')[0]}` : 'Pendente'}</p>
            </button>
          )
        })}
      </div>

      {/* Palco */}
      <div ref={stageRef} className="relative overflow-hidden rounded-[30px] border-[2.5px] border-ink bg-ink px-5 py-9 text-center text-paper sm:px-10 sm:py-12 [&:fullscreen]:grid [&:fullscreen]:place-content-center [&:fullscreen]:rounded-none">
        <Vinyl className="absolute -left-24 -top-24 w-72 opacity-30" speed={phase === 'rolling' ? 'mid' : 'slow'} />
        <Vinyl className="absolute -bottom-28 -right-20 w-80 opacity-30" speed={phase === 'rolling' ? 'mid' : 'slow'} />
        <Cloud v={0} className="absolute left-6 top-6 hidden w-32 animate-drift md:block" />
        <Cloud v={2} className="absolute bottom-6 right-6 hidden w-28 animate-drift-slow md:block" />
        <button onClick={fullscreen} className="absolute right-4 top-4 hidden h-9 w-9 place-items-center rounded-xl bg-white/10 hover:bg-white/20 sm:grid" aria-label="Tela cheia"><Expand className="h-4 w-4" /></button>

        <div className="relative">
          <Logo tone="neon" className="mx-auto w-28 sm:w-36" />
          {phase !== 'result' ? (
            <>
              <h2 className="display mt-6 text-[48px] text-neon sm:text-[72px]">Hora da sorte!</h2>
              <p className="mt-2 text-[15px] text-paper/75 sm:text-lg">Quem será o grande vencedor do Sunset House?</p>
            </>
          ) : (
            <h2 className="display mt-6 text-[44px] text-neon animate-pop sm:text-[68px]">Temos um vencedor!</h2>
          )}
          {prize && <p className="mt-4 inline-block rounded-full border-2 border-neon/60 px-4 py-1 font-display text-[12px] font-extrabold uppercase tracking-[0.16em] text-neon">{prize.round}º sorteio · {prize.title}</p>}

          <div className={`mx-auto mt-6 w-full max-w-md rounded-[26px] border-[2.5px] border-ink bg-sun px-4 py-4 text-ink ${phase === 'result' ? 'animate-pop shadow-[0_0_0_8px_rgba(232,255,26,.18)]' : ''}`}>
            {phase === 'result' && <p className="font-display text-[12px] font-extrabold uppercase tracking-[0.2em]">Número sorteado</p>}
            <p className={`font-display text-[92px] font-black leading-none tabular-nums tracking-tight sm:text-[128px] ${phase === 'rolling' ? 'blur-[0.6px]' : ''}`} aria-live="polite">{display}</p>
          </div>

          {phase === 'result' && result && (
            <div className="animate-rise">
              <p className="mt-6 font-display text-[12px] font-extrabold uppercase tracking-[0.2em] text-paper/60">Ganhador</p>
              <p className="display mt-1 text-[34px] sm:text-[48px]">{result.name}</p>
              <p className="mt-2 text-[12px] text-paper/50">{fmtFull(result.created_at)} · {result.pool_size} números concorreram</p>
            </div>
          )}

          {phase === 'idle' && (
            <>
              <button onClick={() => setConfirmOpen(true)} disabled={!prize || poolNumbers.length === 0} className="btn btn-lg btn-sun mx-auto mt-8 w-full max-w-xs !shadow-[4px_4px_0_0_#E8FF1A]">
                <Dices className="h-6 w-6" /> Iniciar sorteio
              </button>
              <p className="mt-3 text-[13px] text-paper/60">{poolNumbers.length} números válidos concorrendo</p>
            </>
          )}
          {phase === 'rolling' && <p className="mt-8 flex items-center justify-center gap-2 font-display font-bold uppercase tracking-wider text-neon"><Spinner /> Sorteando…</p>}
        </div>

        {phase === 'result' && <Confetti key={result?.draw_id} />}
      </div>

      {phase === 'result' && result && (
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <button className="btn btn-md btn-paper" onClick={() => winner && setViewing(winner)}><UserRound className="h-5 w-5" /> Ver participante</button>
          <button className="btn btn-md btn-paper" onClick={copyResult}><Copy className="h-5 w-5" /> Copiar resultado</button>
          <a className="btn btn-md btn-ink" href={waLink(winner?.phone ?? result.phone, winnerMessage(result.name, result.number, result.prize))} target="_blank" rel="noreferrer">
            <MessageCircle className="h-5 w-5" /> Contatar vencedor
          </a>
          <div className="flex flex-wrap gap-2 sm:col-span-3">
            {nextPrize && nextPrize.id !== prize?.id && (
              <button className="btn btn-sm btn-sun" onClick={() => setPrizeId(nextPrize.id)}><Trophy className="h-4 w-4" /> Próximo: {nextPrize.round}º · {nextPrize.title}</button>
            )}
            <button className="btn btn-sm btn-ghost ml-auto" onClick={() => setRedoOpen(true)}><RotateCcw className="h-4 w-4" /> Refazer este sorteio</button>
          </div>
        </div>
      )}

      {/* Histórico / auditoria */}
      <section className="mt-10">
        <h3 className="display text-2xl">Histórico de sorteios</h3>
        <ul className="mt-3 space-y-2">
          {draws.length === 0 && <li className="rounded-2xl bg-white p-5 text-center text-sm text-graphite-500">Nenhum sorteio realizado ainda.</li>}
          {draws.map((d) => (
            <li key={d.id} className={`rounded-2xl border-2 bg-white p-4 ${d.status === 'anulado' ? 'border-dashed border-graphite-300 opacity-70' : 'border-ink/10'}`}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-display text-xl font-black tabular-nums">{pad(d.lucky_number)}</span>
                <span className="font-semibold">{d.winner_name}</span>
                <span className="text-[13px] text-graphite-700">· {d.round}º {d.prize_title}</span>
                {d.status === 'anulado' ? <span className="chip border-graphite-500 bg-graphite-300/40">Anulado</span> : <span className="chip bg-neon">Válido</span>}
              </div>
              <p className="mt-1 text-[12px] text-graphite-500">
                {fmtFull(d.created_at)} · por {d.performed_by_email ?? '—'} · {d.pool_size} números · <ShieldCheck className="inline h-3 w-3" /> {d.pool_hash.slice(0, 12)}
                {d.void_reason && <> · motivo da anulação: <i>{d.void_reason}</i></>}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirmar sorteio">
        <p className="text-[15px]">Sortear o <b>{prize?.round}º prêmio — {prize?.title}</b> entre <b>{poolNumbers.length}</b> números válidos?</p>
        <ul className="mt-3 space-y-1 text-[13px] text-graphite-700">
          <li>• O resultado é gerado no servidor e salvo imediatamente.</li>
          <li>• Quem já ganhou não participa novamente.</li>
          {stats?.registrations_open && <li className="font-semibold text-ink">• As inscrições ainda estão abertas — novos cadastros não entram neste sorteio depois de iniciado.</li>}
        </ul>
        <button className="btn btn-lg btn-ink mt-5 w-full" onClick={start}><Dices className="h-5 w-5" /> Sortear agora</button>
      </Modal>

      <Modal open={redoOpen} onClose={() => setRedoOpen(false)} title="Refazer sorteio">
        <p className="text-[14px]">O resultado atual (<b>{result?.number} — {result?.name}</b>) será <b>anulado</b> e ficará registrado no histórico. Esse número não volta a concorrer a este prêmio.</p>
        <textarea className="field mt-4 min-h-[84px]" placeholder="Motivo (ex.: ganhador não estava presente)" value={redoReason} onChange={(e) => setRedoReason(e.target.value)} />
        <div className="mt-3"><Checkbox id="redo-ack" checked={redoAck} onChange={setRedoAck}>Confirmo que desejo anular o resultado anterior.</Checkbox></div>
        <button className="btn btn-md btn-danger mt-5 w-full" disabled={!redoReason.trim() || !redoAck} onClick={redo}><RotateCcw className="h-5 w-5" /> Anular e sortear novamente</button>
      </Modal>

      <ParticipantModal participant={viewing} onClose={() => setViewing(null)} />
    </>
  )
}

function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 34 }, (_, i) => {
    const a = (i / 34) * Math.PI * 2 + Math.random() * 0.4
    const r = 160 + Math.random() * 260
    return { dx: Math.cos(a) * r, dy: Math.sin(a) * r * 0.8 - 60, rot: Math.random() * 540 - 270, kind: i % 3, delay: Math.random() * 0.25, size: 10 + Math.random() * 16 }
  }), [])
  return (
    <div className="pointer-events-none absolute left-1/2 top-[48%]" aria-hidden>
      {pieces.map((p, i) => (
        <span key={i} className="absolute animate-burst" style={{ ['--dx' as string]: `${p.dx}px`, ['--dy' as string]: `${p.dy}px`, ['--rot' as string]: `${p.rot}deg`, animationDelay: `${p.delay}s`, width: p.size, height: p.size }}>
          {p.kind === 0 ? <img src={sparkleImg} alt="" className="h-full w-full" /> : p.kind === 1 ? <span className="block h-full w-full rounded-full border-[3px] border-ink bg-ink shadow-[inset_0_0_0_3px_#E8FF1A]" /> : <span className="block h-full w-1/2 rounded-sm bg-neon" />}
        </span>
      ))}
      <Sparkle className="absolute -left-40 -top-28 w-10" />
      <Sparkle className="absolute left-32 -top-36 w-8" delay={0.5} />
    </div>
  )
}
